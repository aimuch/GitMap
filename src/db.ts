/** 数据库（表格 / 看板）相关的纯逻辑：默认结构、读写属性、排序、筛选、类型转换、导出。 */
import type {
  DatabaseDef,
  FilterOp,
  FilterRule,
  PageMeta,
  PropertyDef,
  PropType,
  PropValue,
  SelectOption,
  ViewDef,
} from "../shared/types";
import { getState, updatePage } from "./store";

export const TAG_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;

export const PROP_TYPES: { type: PropType; label: string }[] = [
  { type: "text", label: "文本" },
  { type: "number", label: "数字" },
  { type: "select", label: "单选" },
  { type: "multiSelect", label: "多选" },
  { type: "date", label: "日期" },
  { type: "checkbox", label: "复选框" },
  { type: "url", label: "网址" },
];

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
    properties: [...db.properties, { id, name, type, ...(isSelect(type) ? { options: [] } : {}) }],
  }));
  return id;
}

export function removeProperty(page: PageMeta, propId: string) {
  updateDatabase(page, (db) => ({
    properties: db.properties.filter((p) => p.id !== propId),
    views: db.views.map((v) => ({
      ...v,
      groupBy: v.groupBy === propId ? null : v.groupBy,
      dateProp: v.dateProp === propId ? null : v.dateProp,
      sort: v.sort?.propId === propId ? null : v.sort,
      filters: v.filters?.filter((f) => f.propId !== propId),
    })),
  }));
}

export function setProp(row: PageMeta, propId: string, value: PropValue) {
  const latest = getState().pages[row.id] ?? row;
  updatePage(row.id, { props: { ...latest.props, [propId]: value } });
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
  return Array.isArray(value) ? value.join("、") : String(value);
}

export function isEmptyValue(value: PropValue | undefined): boolean {
  return value === null || value === undefined || value === "" || value === false || (Array.isArray(value) && value.length === 0);
}

export function rowMatches(row: PageMeta, query: string, db: DatabaseDef): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if ((row.title || "无标题").toLowerCase().includes(q)) return true;
  return db.properties.some((def) => valueText(row.props[def.id], def).toLowerCase().includes(q));
}

export function sortRows(rows: PageMeta[], db: DatabaseDef, sort: ViewDef["sort"]): PageMeta[] {
  if (!sort) return rows;
  const def = db.properties.find((p) => p.id === sort.propId);
  if (sort.propId !== "title" && !def) return rows;
  const key = (row: PageMeta): string | number | null => {
    if (!def) return row.title || null;
    const value = row.props[def.id];
    if (isEmptyValue(value) && def.type !== "checkbox") return null;
    if (def.type === "number") return typeof value === "number" ? value : null;
    if (def.type === "checkbox") return value === true ? 1 : 0;
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
    if (JSON.stringify(next) !== JSON.stringify(old)) setProp(row, propId, next);
  }

  updateDatabase(page, (db) => ({
    ...db,
    properties: db.properties.map((p) =>
      p.id === propId ? { id: p.id, name: p.name, type, ...(isSelect(type) ? { options } : {}) } : p,
    ),
    // 看板只能按单选属性分组，日历只能按日期属性排布
    views: db.views.map((v) => ({
      ...v,
      groupBy: v.groupBy === propId && type !== "select" ? null : v.groupBy,
      dateProp: v.dateProp === propId && type !== "date" ? null : v.dateProp,
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
    ...rows.map((row) => [row.title || "无标题", ...db.properties.map((def) => valueText(row.props[def.id], def))]),
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
  const raw: PropValue | undefined = def ? row.props[def.id] : row.title;
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

export function matchesFilters(row: PageMeta, db: DatabaseDef, view: ViewDef): boolean {
  const rules = (view.filters ?? []).filter((rule) => isActiveFilter(rule, db));
  if (rules.length === 0) return true;
  return view.filterMode === "or"
    ? rules.some((rule) => matchRule(row, rule, db))
    : rules.every((rule) => matchRule(row, rule, db));
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
