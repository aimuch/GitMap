/** 数据库（表格 / 看板）相关的纯逻辑：默认结构、读写属性、排序、筛选、类型转换、导出。 */
import type {
  ActionStep,
  CalcFn,
  DatabaseDef,
  FilterGroup,
  FilterOp,
  FilterRule,
  PageMeta,
  PropertyDef,
  PropType,
  PropValue,
  RollupFn,
  SelectOption,
  ViewDef,
} from "../shared/types";
import { runFormula, type FormulaValue } from "./formula";
import { createPage, getState, updatePage } from "./store";

export const SUB_PARENT_KEY = "__subParent";

export const TAG_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;

export const PROP_TYPES: { type: PropType; label: string }[] = [
  { type: "text", label: "文本" },
  { type: "number", label: "数字" },
  { type: "select", label: "单选" },
  { type: "multiSelect", label: "多选" },
  { type: "date", label: "日期" },
  { type: "checkbox", label: "复选框" },
  { type: "url", label: "网址" },
  { type: "button", label: "按钮" },
  { type: "relation", label: "关联" },
  { type: "rollup", label: "汇总" },
  { type: "formula", label: "公式" },
];

export const ROLLUP_FNS: { fn: RollupFn; label: string }[] = [
  { fn: "show", label: "显示原值" },
  { fn: "count", label: "计数" },
  { fn: "sum", label: "求和" },
  { fn: "avg", label: "平均值" },
  { fn: "min", label: "最小值" },
  { fn: "max", label: "最大值" },
];

/** 由其他数据算出来、不能直接编辑的属性 */
export const isComputed = (type: PropType) => type === "rollup" || type === "formula";

export const shortId = () => Math.random().toString(36).slice(2, 10);

/** 自动配色时的先后顺序：相邻的选项尽量色相差得远，容易区分 */
const COLOR_ORDER = ["blue", "green", "orange", "purple", "red", "yellow", "pink", "brown", "gray"];

function nextColor(options: SelectOption[]): string {
  const used = new Set(options.map((o) => o.color));
  return COLOR_ORDER.find((c) => !used.has(c)) ?? COLOR_ORDER[options.length % COLOR_ORDER.length];
}

const isSelect = (type: PropType) => type === "select" || type === "multiSelect";

export function defaultDatabase(first: ViewDef["type"] = "table"): DatabaseDef {
  const status = shortId();
  const date = shortId();
  const views: ViewDef[] = [
    { id: shortId(), name: "表格", type: "table" },
    { id: shortId(), name: "看板", type: "board", groupBy: status },
    { id: shortId(), name: "日历", type: "calendar", dateProp: date },
  ];
  return {
    properties: [
      {
        id: status,
        name: "状态",
        type: "select",
        options: [
          { id: shortId(), name: "待办", color: "gray" },
          { id: shortId(), name: "进行中", color: "blue" },
          { id: shortId(), name: "已完成", color: "green" },
        ],
      },
      { id: date, name: "日期", type: "date" },
      { id: shortId(), name: "标签", type: "multiSelect", options: [] },
    ],
    // 选中的那种视图排在最前面，作为默认打开的视图
    views: [...views.filter((v) => v.type === first), ...views.filter((v) => v.type !== first)],
  };
}

const EMPTY: DatabaseDef = { properties: [], views: [] };

export function getDatabase(page: PageMeta): DatabaseDef {
  return page.database ?? EMPTY;
}

export function visibleProperties(db: DatabaseDef, view: ViewDef | undefined): PropertyDef[] {
  const hidden = new Set(view?.hiddenProps ?? []);
  return db.properties.filter((p) => !hidden.has(p.id));
}

export function calcOptionsFor(def: PropertyDef | null): { fn: CalcFn; label: string }[] {
  const common: { fn: CalcFn; label: string }[] = [
    { fn: "none", label: "不计算" },
    { fn: "count", label: "总行数" },
    { fn: "filled", label: "已填写" },
    { fn: "empty", label: "未填写" },
    { fn: "percentFilled", label: "已填写占比" },
  ];
  if (!def) return common;
  if (def.type === "checkbox") {
    return [
      { fn: "none", label: "不计算" },
      { fn: "checked", label: "已勾选" },
      { fn: "unchecked", label: "未勾选" },
      { fn: "percentChecked", label: "已完成占比" },
    ];
  }
  if (def.type === "number" || def.type === "rollup" || def.type === "formula") {
    return [
      ...common,
      { fn: "sum", label: "求和" },
      { fn: "avg", label: "平均值" },
      { fn: "min", label: "最小值" },
      { fn: "max", label: "最大值" },
    ];
  }
  return common;
}

export function calculateColumn(rows: PageMeta[], def: PropertyDef | null, fn: CalcFn): { label: string; value: string } | null {
  if (!fn || fn === "none") return null;
  const total = rows.length;
  if (fn === "count") return { label: "总数", value: String(total) };

  if (def?.type === "checkbox" && (fn === "checked" || fn === "unchecked" || fn === "percentChecked")) {
    const checked = rows.filter((r) => cellValue(r, def) === true).length;
    if (fn === "checked") return { label: "已勾选", value: String(checked) };
    if (fn === "unchecked") return { label: "未勾选", value: String(total - checked) };
    const pct = total === 0 ? 0 : Math.round((checked / total) * 100);
    return { label: "完成率", value: `${pct}%` };
  }

  const filledCount = rows.filter((r) => (def ? !isEmptyValue(cellValue(r, def)) : Boolean(r.title.trim()))).length;
  if (fn === "filled") return { label: "已填", value: String(filledCount) };
  if (fn === "empty") return { label: "未填", value: String(total - filledCount) };
  if (fn === "percentFilled") {
    const pct = total === 0 ? 0 : Math.round((filledCount / total) * 100);
    return { label: "已填", value: `${pct}%` };
  }

  if (!def) return null;
  const nums = rows
    .map((r) => {
      const v = cellValue(r, def);
      return typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    })
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return { label: fn === "sum" ? "求和" : fn === "avg" ? "均值" : fn === "min" ? "最小" : "最大", value: "0" };
  const sum = nums.reduce((a, b) => a + b, 0);
  if (fn === "sum") return { label: "求和", value: String(Number(sum.toPrecision(12))) };
  if (fn === "avg") return { label: "均值", value: String(Number((sum / nums.length).toPrecision(6))) };
  if (fn === "min") return { label: "最小", value: String(Math.min(...nums)) };
  if (fn === "max") return { label: "最大", value: String(Math.max(...nums)) };
  return null;
}

export function updateDatabase(page: PageMeta, change: (db: DatabaseDef) => DatabaseDef) {
  // 总是基于最新状态修改，避免同一时刻的两次修改互相覆盖
  const latest = getState().pages[page.id] ?? page;
  updatePage(page.id, { database: change(getDatabase(latest)) });
}

export function updateView(page: PageMeta, viewId: string, patch: Partial<ViewDef>) {
  updateDatabase(page, (db) => ({
    ...db,
    views: db.views.map((v) => (v.id === viewId ? { ...v, ...patch } : v)),
  }));
}

export function updateProperty(page: PageMeta, propId: string, patch: Partial<PropertyDef>) {
  updateDatabase(page, (db) => ({
    ...db,
    properties: db.properties.map((p) => (p.id === propId ? { ...p, ...patch } : p)),
  }));
}

export function addProperty(page: PageMeta, type: PropType): string {
  const id = shortId();
  const label = PROP_TYPES.find((t) => t.type === type)?.label ?? "属性";
  const taken = new Set(getDatabase(page).properties.map((p) => p.name));
  let name = label;
  for (let i = 2; taken.has(name); i++) name = `${label} ${i}`;
  updateDatabase(page, (db) => ({
    ...db,
    properties: [...db.properties, { id, name, type, ...defaultConfig(page, type) }],
  }));
  return id;
}

/** 新建或换成某种类型时，这种类型需要的初始配置 */
function defaultConfig(page: PageMeta, type: PropType): Partial<PropertyDef> {
  if (isSelect(type)) return { options: [] };
  if (type === "relation") {
    // 默认关联到另一个数据库；只有这一个数据库时就关联自己（比如“子任务”）
    const other = Object.values(getState().pages).find(
      (p) => p.kind === "database" && !p.trashed && !p.hidden && p.id !== page.id,
    );
    return { relationDb: other?.id ?? page.id };
  }
  if (type === "rollup") {
    const relation = getDatabase(getState().pages[page.id] ?? page).properties.find((p) => p.type === "relation");
    return { rollup: { relationProp: relation?.id ?? "", targetProp: "title", fn: "show" } };
  }
  if (type === "formula") return { formula: "" };
  if (type === "button") return { buttonLabel: "执行", buttonActions: [] };
  return {};
}

export function removeProperty(page: PageMeta, propId: string) {
  updateDatabase(page, (db) => ({
    properties: db.properties.filter((p) => p.id !== propId),
    views: db.views.map((v) => ({
      ...v,
      groupBy: v.groupBy === propId ? null : v.groupBy,
      dateProp: v.dateProp === propId ? null : v.dateProp,
      endProp: v.endProp === propId ? null : v.endProp,
      sort: v.sort?.propId === propId ? null : v.sort,
      filters: v.filters?.filter((f) => f.propId !== propId),
    })),
  }));
}

const automationLock = new Set<string>();

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function resolveActionValue(val: PropValue | undefined): PropValue {
  if (val === "$today") return todayIso();
  return val ?? null;
}

export async function executeRowActions(row: PageMeta, dbPage: PageMeta, steps: ActionStep[] | undefined) {
  if (!steps || steps.length === 0) return;
  const latest = getState().pages[row.id] ?? row;
  const nextProps = { ...latest.props };
  let mutated = false;
  for (const step of steps) {
    if (step.type === "set_prop" && step.propId) {
      nextProps[step.propId] = resolveActionValue(step.value);
      mutated = true;
    } else if (step.type === "create_row") {
      const title = (step.title || "自动新建记录").replace(/\{\{title\}\}/g, latest.title || "无标题");
      await createPage({ parentId: dbPage.id, title });
    }
  }
  if (mutated) {
    updatePage(row.id, { props: nextProps });
  }
}

export function runRowCreatedAutomations(rowId: string, dbPage: PageMeta) {
  const db = getDatabase(getState().pages[dbPage.id] ?? dbPage);
  const row = getState().pages[rowId];
  if (!row || !db.automations?.length) return;
  for (const auto of db.automations) {
    if (auto.enabled && auto.trigger.type === "row_created") {
      void executeRowActions(row, dbPage, auto.actions);
    }
  }
}

export function setProp(row: PageMeta, propId: string, value: PropValue) {
  const latest = getState().pages[row.id] ?? row;
  const prevValue = latest.props[propId];
  updatePage(row.id, { props: { ...latest.props, [propId]: value } });

  if (prevValue === value || !latest.parentId) return;
  const lockKey = `${row.id}:${propId}`;
  if (automationLock.has(lockKey)) return;
  const dbPage = getState().pages[latest.parentId];
  const automations = dbPage?.database?.automations;
  if (!dbPage || !automations?.length) return;

  const matched = automations.filter((a) => {
    if (!a.enabled || a.trigger.type !== "prop_changed" || a.trigger.propId !== propId) return false;
    if (!a.trigger.value) return true;
    if (typeof value === "boolean") return String(value) === a.trigger.value;
    if (Array.isArray(value)) return value.includes(a.trigger.value);
    return String(value ?? "") === a.trigger.value;
  });
  if (matched.length === 0) return;

  automationLock.add(lockKey);
  try {
    const freshRow = getState().pages[row.id] ?? latest;
    for (const auto of matched) {
      void executeRowActions(freshRow, dbPage, auto.actions);
    }
  } finally {
    window.setTimeout(() => automationLock.delete(lockKey), 0);
  }
}

/* ---------- 子任务树（Sub-items）与通用分组（Group by） ---------- */

export interface FlatSubRow {
  row: PageMeta;
  depth: number;
  childCount: number;
}

export function getSubParentId(row: PageMeta): string | null {
  const v = row.props[SUB_PARENT_KEY];
  return typeof v === "string" && v ? v : null;
}

export function buildSubItemTree(rows: PageMeta[], collapsedIds: ReadonlySet<string>): FlatSubRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const childrenMap = new Map<string, PageMeta[]>();
  const topRows: PageMeta[] = [];

  for (const r of rows) {
    const pid = getSubParentId(r);
    // 防止环引用，且父行不在当前过滤列表里时自动作为顶层展示
    if (pid && pid !== r.id && byId.has(pid)) {
      let cur: string | null = pid;
      let cycle = false;
      const seen = new Set<string>([r.id]);
      while (cur && byId.has(cur)) {
        if (seen.has(cur)) {
          cycle = true;
          break;
        }
        seen.add(cur);
        cur = getSubParentId(byId.get(cur)!);
      }
      if (!cycle) {
        const list = childrenMap.get(pid);
        if (list) list.push(r);
        else childrenMap.set(pid, [r]);
        continue;
      }
    }
    topRows.push(r);
  }

  const out: FlatSubRow[] = [];
  const walk = (list: PageMeta[], depth: number) => {
    for (const r of list) {
      const kids = childrenMap.get(r.id) ?? [];
      out.push({ row: r, depth, childCount: kids.length });
      if (kids.length > 0 && !collapsedIds.has(r.id)) {
        walk(kids, depth + 1);
      }
    }
  };
  walk(topRows, 0);
  return out;
}

export interface RowGroup {
  key: string;
  label: string;
  option?: SelectOption;
  rows: PageMeta[];
  defaultProps: Record<string, PropValue>;
}

export function groupRowsByProp(rows: PageMeta[], db: DatabaseDef, propId: string | null | undefined): RowGroup[] | null {
  if (!propId) return null;
  const def = db.properties.find((p) => p.id === propId);
  if (!def) return null;

  if (def.type === "select") {
    const opts = def.options ?? [];
    const known = new Set(opts.map((o) => o.id));
    const groups: RowGroup[] = opts.map((opt) => ({
      key: opt.id,
      label: opt.name,
      option: opt,
      rows: rows.filter((r) => r.props[def.id] === opt.id),
      defaultProps: { [def.id]: opt.id },
    }));
    const ungrouped = rows.filter((r) => !known.has(String(r.props[def.id] ?? "")));
    if (ungrouped.length > 0 || groups.length === 0) {
      groups.push({ key: "__empty__", label: "未分组", rows: ungrouped, defaultProps: {} });
    }
    return groups;
  }

  if (def.type === "checkbox") {
    return [
      {
        key: "true",
        label: `${def.name}：已勾选`,
        rows: rows.filter((r) => cellValue(r, def) === true),
        defaultProps: { [def.id]: true },
      },
      {
        key: "false",
        label: `${def.name}：未勾选`,
        rows: rows.filter((r) => cellValue(r, def) !== true),
        defaultProps: { [def.id]: false },
      },
    ];
  }

  if (def.type === "multiSelect") {
    const opts = def.options ?? [];
    const groups: RowGroup[] = opts.map((opt) => ({
      key: opt.id,
      label: opt.name,
      option: opt,
      rows: rows.filter((r) => Array.isArray(r.props[def.id]) && (r.props[def.id] as string[]).includes(opt.id)),
      defaultProps: { [def.id]: [opt.id] },
    }));
    const empty = rows.filter((r) => !Array.isArray(r.props[def.id]) || (r.props[def.id] as string[]).length === 0);
    if (empty.length > 0) groups.push({ key: "__empty__", label: "未选择", rows: empty, defaultProps: {} });
    return groups;
  }

  const map = new Map<string, PageMeta[]>();
  const emptyRows: PageMeta[] = [];
  for (const r of rows) {
    const txt = valueText(cellValue(r, def), def).trim();
    if (!txt) {
      emptyRows.push(r);
      continue;
    }
    const list = map.get(txt);
    if (list) list.push(r);
    else map.set(txt, [r]);
  }
  const out: RowGroup[] = [...map.entries()].map(([label, list]) => ({
    key: label,
    label,
    rows: list,
    defaultProps: def.type === "text" || def.type === "date" || def.type === "url" ? { [def.id]: label } : {},
  }));
  if (emptyRows.length > 0 || out.length === 0) {
    out.push({ key: "__empty__", label: "未填写", rows: emptyRows, defaultProps: {} });
  }
  return out;
}

/** 新增一个选项并返回它（名称已存在时直接返回已有的）。 */
export function ensureOption(page: PageMeta, def: PropertyDef, name: string): SelectOption {
  const options = def.options ?? [];
  const existing = options.find((o) => o.name === name);
  if (existing) return existing;
  const option = { id: shortId(), name, color: nextColor(options) };
  updateProperty(page, def.id, { options: [...options, option] });
  return option;
}

/** 把属性值转成可读文本（用于筛选、导出、类型转换）。 */
export function valueText(value: PropValue | undefined, def: PropertyDef): string {
  if (value === null || value === undefined || value === "") return "";
  if (def.type === "checkbox") return value === true ? "是" : "";
  if (isSelect(def.type)) {
    const ids = Array.isArray(value) ? value : [String(value)];
    return ids
      .map((id) => def.options?.find((o) => o.id === id)?.name)
      .filter(Boolean)
      .join("、");
  }
  if (def.type === "relation") {
    return relatedRows(value)
      .map((row) => row.title || "无标题")
      .join("、");
  }
  if (typeof value === "boolean") return value ? "是" : "否";
  return Array.isArray(value) ? value.join("、") : String(value);
}

/** 关联属性的值 → 仍然存在的那些行 */
export function relatedRows(value: PropValue | undefined): PageMeta[] {
  if (!Array.isArray(value)) return [];
  const pages = getState().pages;
  return value.map((id) => pages[id]).filter((p): p is PageMeta => !!p && !p.trashed);
}

/** 公式或汇总出错时显示的内容 */
export const COMPUTE_ERROR = "#错误";

/**
 * 一行里某个属性“实际显示的值”：普通属性就是存下来的值，
 * 汇总和公式是现算的。depth 用来防止公式互相引用造成死循环。
 */
export function cellValue(row: PageMeta, def: PropertyDef, depth = 0): PropValue {
  if (!isComputed(def.type)) return row.props[def.id] ?? null;
  if (depth > 6) return COMPUTE_ERROR;
  const pages = getState().pages;
  const db = row.parentId ? pages[row.parentId]?.database : null;
  if (!db) return null;

  if (def.type === "formula") {
    const result = runFormula(def.formula ?? "", (name): FormulaValue => {
      if (name === "名称" || name.toLowerCase() === "title" || name.toLowerCase() === "name") {
        // 属性里真有叫这个名字的就用属性，否则指页面标题
        if (!db.properties.some((p) => p.name === name)) return row.title;
      }
      const target = db.properties.find((p) => p.name === name);
      if (!target) throw new Error(`没有叫“${name}”的属性`);
      const value = cellValue(row, target, depth + 1);
      if (value === COMPUTE_ERROR) throw new Error(`“${name}”计算出错`);
      if (value === null || typeof value === "number" || typeof value === "boolean") return value;
      // 单选、多选、关联等转成文字；日期和文本本来就是字符串
      return target.type === "text" || target.type === "url" || target.type === "date" || isComputed(target.type)
        ? String(value)
        : valueText(value, target);
    });
    return "error" in result ? COMPUTE_ERROR : result.value;
  }

  const config = def.rollup;
  const relation = db.properties.find((p) => p.id === config?.relationProp && p.type === "relation");
  if (!config || !relation) return null;
  const rows = relatedRows(row.props[relation.id]);
  if (config.fn === "count") return rows.length;
  const targetDb = relation.relationDb ? pages[relation.relationDb]?.database : null;
  const target = targetDb?.properties.find((p) => p.id === config.targetProp);
  const texts = rows.map((r) =>
    target ? valueText(cellValue(r, target, depth + 1), target) : r.title || "无标题",
  );
  if (config.fn === "show") return texts.filter(Boolean).join("、") || null;
  const numbers = rows
    .map((r, i) => {
      const raw = target ? cellValue(r, target, depth + 1) : null;
      return typeof raw === "number" ? raw : parseFloat(texts[i]);
    })
    .filter((n) => Number.isFinite(n));
  if (numbers.length === 0) return null;
  const total = numbers.reduce((a, b) => a + b, 0);
  const result =
    config.fn === "sum"
      ? total
      : config.fn === "avg"
        ? total / numbers.length
        : config.fn === "min"
          ? Math.min(...numbers)
          : Math.max(...numbers);
  return Number(result.toPrecision(12));
}

export function isEmptyValue(value: PropValue | undefined): boolean {
  return value === null || value === undefined || value === "" || value === false || (Array.isArray(value) && value.length === 0);
}

export function rowMatches(row: PageMeta, query: string, db: DatabaseDef): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if ((row.title || "无标题").toLowerCase().includes(q)) return true;
  return db.properties.some((def) => valueText(cellValue(row, def), def).toLowerCase().includes(q));
}

export function sortRows(rows: PageMeta[], db: DatabaseDef, sort: ViewDef["sort"]): PageMeta[] {
  if (!sort) return rows;
  const def = db.properties.find((p) => p.id === sort.propId);
  if (sort.propId !== "title" && !def) return rows;
  const key = (row: PageMeta): string | number | null => {
    if (!def) return row.title || null;
    const value = cellValue(row, def);
    if (def.type === "checkbox") return value === true ? 1 : 0;
    if (isEmptyValue(value)) return null;
    // 数字属性，以及算出数字的汇总 / 公式，都按数值大小排
    if (typeof value === "number") return value;
    if (def.type === "number") return null;
    if (isSelect(def.type)) {
      // 按选项在定义里的先后顺序，而不是按名称
      const first = Array.isArray(value) ? value[0] : value;
      const at = def.options?.findIndex((o) => o.id === first) ?? -1;
      return at < 0 ? null : at;
    }
    return valueText(value, def);
  };
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    // 空值始终排在最后
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x).localeCompare(String(y), "zh") * sign;
  });
}

/** 修改属性类型，并尽量把已有的值转换过去。 */
export function changePropertyType(page: PageMeta, rows: PageMeta[], propId: string, type: PropType) {
  const def = getDatabase(page).properties.find((p) => p.id === propId);
  if (!def || def.type === type) return;
  const options: SelectOption[] = isSelect(type) && isSelect(def.type) ? [...(def.options ?? [])] : [];
  const optionId = (name: string) => {
    let option = options.find((o) => o.name === name);
    if (!option) {
      option = { id: shortId(), name, color: nextColor(options) };
      options.push(option);
    }
    return option.id;
  };

  for (const row of rows) {
    const old = row.props[propId];
    if (old === undefined || old === null) continue;
    const text = valueText(old, def);
    let next: PropValue = null;
    if (type === "text" || type === "url") next = text || null;
    else if (type === "number") {
      const n = parseFloat(text);
      next = Number.isFinite(n) ? n : null;
    } else if (type === "checkbox") next = !isEmptyValue(old);
    else if (type === "date") next = /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
    else if (type === "select") {
      if (isSelect(def.type)) next = Array.isArray(old) ? (old[0] ?? null) : old;
      else next = text ? optionId(text) : null;
    } else if (type === "multiSelect") {
      if (isSelect(def.type)) next = Array.isArray(old) ? old : [String(old)];
      else
        next = text
          .split(/[,，、]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map(optionId);
    }
    // 关联保持原样；换成关联时旧值无法对应到具体的行，清空
    if (type === "relation") next = def.type === "relation" ? old : null;
    // 汇总和公式是现算的，不看存下来的值，原值留着以便换回来
    if (isComputed(type)) continue;
    if (JSON.stringify(next) !== JSON.stringify(old)) setProp(row, propId, next);
  }

  updateDatabase(page, (db) => ({
    ...db,
    properties: db.properties.map((p) =>
      p.id === propId
        ? { id: p.id, name: p.name, type, ...defaultConfig(page, type), ...(isSelect(type) ? { options } : {}) }
        : p,
    ),
    // 看板只能按单选属性分组，日历只能按日期属性排布
    views: db.views.map((v) => ({
      ...v,
      groupBy: v.groupBy === propId && type !== "select" ? null : v.groupBy,
      dateProp: v.dateProp === propId && type !== "date" ? null : v.dateProp,
      endProp: v.endProp === propId && type !== "date" ? null : v.endProp,
      // 换了类型后原来的条件多半不再适用
      filters: v.filters?.filter((f) => f.propId !== propId),
    })),
  }));
}

export function exportCsv(page: PageMeta, rows: PageMeta[]) {
  const db = getDatabase(page);
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [
    ["名称", ...db.properties.map((p) => p.name)],
    ...rows.map((row) => [row.title || "无标题", ...db.properties.map((def) => valueText(cellValue(row, def), def))]),
  ].map((line) => line.map(cell).join(","));
  // 加 BOM，Excel 才能正确识别中文
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(page.title || "无标题").replace(/[\\/:*?"<>|]/g, "_")}.csv`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- 高级筛选 ---------- */

const VALUELESS: FilterOp[] = ["isEmpty", "isNotEmpty", "checked", "unchecked"];

export const needsValue = (op: FilterOp) => !VALUELESS.includes(op);

const EMPTY_OPS: { op: FilterOp; label: string }[] = [
  { op: "isEmpty", label: "为空" },
  { op: "isNotEmpty", label: "不为空" },
];

/** 每种属性类型可用的筛选条件 */
export function filterOps(type: PropType | "title"): { op: FilterOp; label: string }[] {
  switch (type) {
    case "number":
      return [
        { op: "is", label: "=" },
        { op: "isNot", label: "≠" },
        { op: "gt", label: ">" },
        { op: "lt", label: "<" },
        { op: "gte", label: "≥" },
        { op: "lte", label: "≤" },
        ...EMPTY_OPS,
      ];
    case "select":
      return [{ op: "is", label: "是" }, { op: "isNot", label: "不是" }, ...EMPTY_OPS];
    case "multiSelect":
      return [{ op: "contains", label: "包含" }, { op: "notContains", label: "不包含" }, ...EMPTY_OPS];
    case "date":
      return [
        { op: "is", label: "是" },
        { op: "before", label: "早于" },
        { op: "after", label: "晚于" },
        ...EMPTY_OPS,
      ];
    case "checkbox":
      return [
        { op: "checked", label: "已勾选" },
        { op: "unchecked", label: "未勾选" },
      ];
    default:
      return [
        { op: "contains", label: "包含" },
        { op: "notContains", label: "不包含" },
        { op: "is", label: "等于" },
        { op: "isNot", label: "不等于" },
        ...EMPTY_OPS,
      ];
  }
}

export function newFilter(db: DatabaseDef): FilterRule {
  const def = db.properties[0];
  const type = def?.type ?? "title";
  return { id: shortId(), propId: def?.id ?? "title", op: filterOps(type)[0].op, value: "" };
}

/** 条件还没填完整（需要值但没填）时不参与筛选 */
export function isActiveFilter(rule: FilterRule, db: DatabaseDef): boolean {
  if (rule.propId !== "title" && !db.properties.some((p) => p.id === rule.propId)) return false;
  return !needsValue(rule.op) || (rule.value ?? "") !== "";
}

function matchRule(row: PageMeta, rule: FilterRule, db: DatabaseDef): boolean {
  const def = db.properties.find((p) => p.id === rule.propId);
  const raw: PropValue | undefined = def ? cellValue(row, def) : row.title;
  const want = rule.value ?? "";

  if (rule.op === "isEmpty") return isEmptyValue(raw);
  if (rule.op === "isNotEmpty") return !isEmptyValue(raw);
  if (rule.op === "checked") return raw === true;
  if (rule.op === "unchecked") return raw !== true;

  if (def?.type === "number") {
    const a = typeof raw === "number" ? raw : NaN;
    const b = parseFloat(want);
    if (Number.isNaN(b)) return true;
    if (rule.op === "isNot") return a !== b;
    if (Number.isNaN(a)) return false;
    if (rule.op === "is") return a === b;
    if (rule.op === "gt") return a > b;
    if (rule.op === "lt") return a < b;
    if (rule.op === "gte") return a >= b;
    return a <= b;
  }

  if (def && isSelect(def.type)) {
    const ids = Array.isArray(raw) ? raw : typeof raw === "string" && raw ? [raw] : [];
    const has = ids.includes(want);
    return rule.op === "is" || rule.op === "contains" ? has : !has;
  }

  if (def?.type === "date") {
    const date = typeof raw === "string" ? raw : "";
    if (!date) return false;
    if (rule.op === "before") return date < want;
    if (rule.op === "after") return date > want;
    return date === want;
  }

  const text = (def ? valueText(raw, def) : row.title).toLowerCase();
  const q = want.toLowerCase();
  if (rule.op === "contains") return text.includes(q);
  if (rule.op === "notContains") return !text.includes(q);
  if (rule.op === "is") return text === q;
  return text !== q;
}

export function countActiveFilters(db: DatabaseDef, view: ViewDef): number {
  const base = (view.filters ?? []).filter((r) => isActiveFilter(r, db)).length;
  const groups = (view.filterGroups ?? []).reduce(
    (sum, g) => sum + g.rules.filter((r) => isActiveFilter(r, db)).length,
    0,
  );
  return base + groups;
}

function evalGroup(row: PageMeta, group: FilterGroup, db: DatabaseDef): boolean {
  const active = group.rules.filter((r) => isActiveFilter(r, db));
  if (active.length === 0) return true;
  return group.mode === "or"
    ? active.some((r) => matchRule(row, r, db))
    : active.every((r) => matchRule(row, r, db));
}

export function matchesFilters(row: PageMeta, db: DatabaseDef, view: ViewDef): boolean {
  const rules = (view.filters ?? []).filter((rule) => isActiveFilter(rule, db));
  const activeGroups = (view.filterGroups ?? []).filter((g) => g.rules.some((r) => isActiveFilter(r, db)));
  if (rules.length === 0 && activeGroups.length === 0) return true;

  const predicates: boolean[] = [
    ...rules.map((r) => matchRule(row, r, db)),
    ...activeGroups.map((g) => evalGroup(row, g, db)),
  ];
  return view.filterMode === "or" ? predicates.some(Boolean) : predicates.every(Boolean);
}

/**
 * 在带筛选的视图里新建行时，预先填好能让它留在当前视图里的属性值，
 * 否则新建的行会立刻被筛掉、看起来像没建成功。
 */
export function defaultsFromFilters(db: DatabaseDef, view: ViewDef): Record<string, PropValue> {
  const out: Record<string, PropValue> = {};
  const active = (view.filters ?? []).filter((rule) => isActiveFilter(rule, db));
  // “任一条件”模式下满足哪个都行，没法替用户选；只有一个条件时两种模式等价
  if (view.filterMode === "or" && active.length > 1) return out;
  for (const rule of active) {
    const def = db.properties.find((p) => p.id === rule.propId);
    if (!def) continue;
    if (def.type === "select" && rule.op === "is") out[def.id] = rule.value ?? null;
    else if (def.type === "multiSelect" && rule.op === "contains") out[def.id] = [rule.value ?? ""];
    else if (def.type === "checkbox" && rule.op === "checked") out[def.id] = true;
    else if (def.type === "date" && rule.op === "is") out[def.id] = rule.value ?? null;
  }
  return out;
}
