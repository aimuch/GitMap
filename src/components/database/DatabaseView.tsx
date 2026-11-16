import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  CalendarDays,
  GanttChart,
  Kanban,
  LayoutGrid,
  ListFilter,
  Plus,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import type { PageMeta, PropValue, ViewDef } from "../../../shared/types";
import {
  PROP_TYPES,
  addProperty,
  defaultsFromFilters,
  getDatabase,
  isActiveFilter,
  matchesFilters,
  rowMatches,
  shortId,
  sortRows,
  updateDatabase,
  updateView,
} from "../../db";
import { createPage, readLocal, useTree, writeLocal } from "../../store";
import { MenuDivider, MenuItem, Popover, cx } from "../Popover";
import { BoardView } from "./BoardView";
import { CalendarView, toIso } from "./CalendarView";
import { FilterMenu } from "./FilterMenu";
import { GalleryView } from "./GalleryView";
import { TimelineView } from "./TimelineView";
import { PropIcon, PropertyCell } from "./cells";
import { TableView } from "./TableView";

const VIEW_ICONS = {
  table: Table2,
  board: Kanban,
  calendar: CalendarDays,
  gallery: LayoutGrid,
  timeline: GanttChart,
} as const;
const VIEW_LABELS = { table: "表格", board: "看板", calendar: "日历", gallery: "画廊", timeline: "时间轴" } as const;
const VIEW_TYPES = Object.keys(VIEW_LABELS) as ViewDef["type"][];

export function DatabaseView({ page }: { page: PageMeta }) {
  const tree = useTree();
  const db = getDatabase(page);
  const allRows = tree.children.get(page.id) ?? [];
  const [activeId, setActiveId] = useState(() => readLocal<string | null>(`view:${page.id}`, null));
  const [query, setQuery] = useState("");
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const [tabMenu, setTabMenu] = useState<HTMLElement | null>(null);
  const [addMenu, setAddMenu] = useState<HTMLElement | null>(null);
  const [sortMenu, setSortMenu] = useState<HTMLElement | null>(null);
  const [filterMenu, setFilterMenu] = useState<HTMLElement | null>(null);

  const view = db.views.find((v) => v.id === activeId) ?? db.views[0];
  const rows = useMemo(
    () =>
      sortRows(
        allRows.filter((row) => rowMatches(row, query, db) && (!view || matchesFilters(row, db, view))),
        db,
        view?.sort,
      ),
    [allRows, query, db, view],
  );

  const selectView = (id: string) => {
    setActiveId(id);
    writeLocal(`view:${page.id}`, id);
  };

  const addView = (type: ViewDef["type"]) => {
    const id = shortId();
    const taken = new Set(db.views.map((v) => v.name));
    let name: string = VIEW_LABELS[type];
    for (let i = 2; taken.has(name); i++) name = `${VIEW_LABELS[type]} ${i}`;
    const groupBy = type === "board" ? (db.properties.find((p) => p.type === "select")?.id ?? null) : undefined;
    const dateProp =
      type === "calendar" || type === "timeline" ? (db.properties.find((p) => p.type === "date")?.id ?? null) : undefined;
    updateDatabase(page, (d) => ({ ...d, views: [...d.views, { id, name, type, groupBy, dateProp }] }));
    selectView(id);
    setAddMenu(null);
  };

  // 没有任何视图的数据库（例如手动改坏了数据文件）：给一个入口重新建
  if (!view) {
    return (
      <div className="db-empty">
        <Table2 size={30} strokeWidth={1.5} />
        <p>这个数据库还没有视图。</p>
        <button type="button" className="primary-btn" onClick={() => addView("table")}>
          <Plus size={16} /> 添加表格视图
        </button>
      </div>
    );
  }

  const rowDefaults = defaultsFromFilters(db, view);
  const activeFilters = (view.filters ?? []).filter((rule) => isActiveFilter(rule, db)).length;

  const addRow = async (props: Record<string, PropValue> = {}) => {
    if (query) setQuery("");
    // 先填上能通过当前筛选条件的默认值，调用方指定的值优先
    const id = await createPage({ parentId: page.id, props: { ...rowDefaults, ...props } });
    if (id) setFocusRowId(id);
  };

  const selects = db.properties.filter((p) => p.type === "select");
  const dates = db.properties.filter((p) => p.type === "date");
  const calendarDate = dates.find((p) => p.id === view.dateProp) ?? dates[0];
  const usesDate = view.type === "calendar" || view.type === "timeline";
  // 日历和时间轴里点“新建”默认排在今天
  const addFromToolbar = () => void addRow(usesDate && calendarDate ? { [calendarDate.id]: toIso(new Date()) } : {});
  const sortName =
    view.sort?.propId === "title" ? "名称" : db.properties.find((p) => p.id === view.sort?.propId)?.name;

  return (
    <div className="database">
      <div className="db-toolbar">
        <div className="db-tabs" role="tablist">
          {db.views.map((v) => {
            const Icon = VIEW_ICONS[v.type];
            const active = v.id === view.id;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cx("db-tab", active && "active")}
                title={active ? "再点一次可以重命名或删除视图" : undefined}
                onClick={(e) => {
                  if (active) setTabMenu(tabMenu ? null : e.currentTarget);
                  else selectView(v.id);
                }}
              >
                <Icon size={15} /> {v.name}
              </button>
            );
          })}
          <button
            type="button"
            className="icon-btn small"
            title="添加视图"
            aria-label="添加视图"
            onClick={(e) => setAddMenu(addMenu ? null : e.currentTarget)}
          >
            <Plus size={15} />
          </button>
        </div>

        <div className="db-tools">
          <label className="db-search">
            <Search size={14} />
            <input
              value={query}
              placeholder="搜索…"
              aria-label="搜索行"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={cx("text-btn", activeFilters > 0 && "on")}
            onClick={(e) => setFilterMenu(filterMenu ? null : e.currentTarget)}
          >
            <ListFilter size={14} /> 筛选{activeFilters > 0 ? ` · ${activeFilters}` : ""}
          </button>
          {view.type === "board" && selects.length > 0 && (
            <label className="db-select">
              分组
              <select
                value={selects.find((p) => p.id === view.groupBy)?.id ?? selects[0].id}
                onChange={(e) => updateView(page, view.id, { groupBy: e.target.value })}
              >
                {selects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {usesDate && dates.length > 0 && (
            <label className="db-select">
              {view.type === "timeline" ? "开始" : "日期"}
              <select
                value={calendarDate?.id}
                onChange={(e) => updateView(page, view.id, { dateProp: e.target.value })}
              >
                {dates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {view.type === "timeline" && dates.length > 1 && (
            <label className="db-select">
              结束
              <select
                value={dates.some((p) => p.id === view.endProp) ? (view.endProp ?? "") : ""}
                onChange={(e) => updateView(page, view.id, { endProp: e.target.value || null })}
              >
                <option value="">不设（只占一天）</option>
                {dates
                  .filter((p) => p.id !== calendarDate?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className={cx("text-btn", view.sort && "on")}
            onClick={(e) => setSortMenu(sortMenu ? null : e.currentTarget)}
          >
            <ArrowUpDown size={14} /> {sortName ? `按${sortName}${view.sort?.dir === "asc" ? "升序" : "降序"}` : "排序"}
          </button>
          <button type="button" className="primary-btn small" onClick={addFromToolbar}>
            <Plus size={15} /> 新建
          </button>
        </div>
      </div>

      {view.type === "table" ? (
        <TableView
          page={page}
          db={db}
          view={view}
          rows={rows}
          allRows={allRows}
          focusRowId={focusRowId}
          onAddRow={() => void addRow()}
        />
      ) : view.type === "board" ? (
        <BoardView
          page={page}
          db={db}
          view={view}
          rows={rows}
          editingId={focusRowId}
          onEditDone={() => setFocusRowId(null)}
          onCreate={(props) => void addRow(props)}
        />
      ) : view.type === "gallery" ? (
        <GalleryView
          db={db}
          rows={rows}
          editingId={focusRowId}
          onEditDone={() => setFocusRowId(null)}
          onCreate={() => void addRow()}
        />
      ) : view.type === "timeline" ? (
        <TimelineView
          page={page}
          db={db}
          view={view}
          rows={rows}
          onCreate={(dateProp, date) => void addRow({ [dateProp]: date })}
        />
      ) : (
        <CalendarView
          page={page}
          db={db}
          view={view}
          rows={rows}
          editingId={focusRowId}
          onEditDone={() => setFocusRowId(null)}
          onCreate={(dateProp, date) => void addRow({ [dateProp]: date })}
        />
      )}

      {rows.length === 0 && allRows.length > 0 && (query || activeFilters > 0) && (
        <div className="db-no-match">{query ? `没有符合“${query}”的行` : "没有符合筛选条件的行"}</div>
      )}

      {filterMenu && (
        <FilterMenu anchor={filterMenu} page={page} db={db} view={view} onClose={() => setFilterMenu(null)} />
      )}

      {tabMenu && (
        <Popover anchor={tabMenu} onClose={() => setTabMenu(null)} className="menu prop-menu">
          <input
            className="menu-input"
            autoFocus
            onFocus={(e) => e.target.select()}
            value={view.name}
            aria-label="视图名称"
            onChange={(e) => updateView(page, view.id, { name: e.target.value })}
            onKeyDown={(e) => {
              if (!e.nativeEvent.isComposing && e.key === "Enter") setTabMenu(null);
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<Trash2 size={16} />}
            label={db.views.length > 1 ? "删除视图" : "至少保留一个视图"}
            danger={db.views.length > 1}
            onClick={() => {
              setTabMenu(null);
              if (db.views.length <= 1) return;
              updateDatabase(page, (d) => ({ ...d, views: d.views.filter((v) => v.id !== view.id) }));
            }}
          />
        </Popover>
      )}

      {addMenu && (
        <Popover anchor={addMenu} onClose={() => setAddMenu(null)} className="menu">
          <div className="menu-title">新视图</div>
          {VIEW_TYPES.map((type) => {
            const Icon = VIEW_ICONS[type];
            return <MenuItem key={type} icon={<Icon size={16} />} label={VIEW_LABELS[type]} onClick={() => addView(type)} />;
          })}
        </Popover>
      )}

      {sortMenu && (
        <Popover anchor={sortMenu} onClose={() => setSortMenu(null)} align="end" className="sort-menu">
          <label className="db-select">
            排序依据
            <select
              value={view.sort?.propId ?? ""}
              onChange={(e) =>
                updateView(page, view.id, {
                  sort: e.target.value ? { propId: e.target.value, dir: view.sort?.dir ?? "asc" } : null,
                })
              }
            >
              <option value="">手动顺序</option>
              <option value="title">名称</option>
              {db.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {view.sort && (
            <label className="db-select">
              方向
              <select
                value={view.sort.dir}
                onChange={(e) =>
                  updateView(page, view.id, {
                    sort: { propId: view.sort!.propId, dir: e.target.value as "asc" | "desc" },
                  })
                }
              >
                <option value="asc">升序</option>
                <option value="desc">降序</option>
              </select>
            </label>
          )}
        </Popover>
      )}
    </div>
  );
}

/** 数据库里的一行作为页面打开时，标题下方的属性面板。 */
export function RowProperties({ row, dbPage }: { row: PageMeta; dbPage: PageMeta }) {
  const db = getDatabase(dbPage);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <div className="row-props">
      {db.properties.map((def) => (
        <div key={def.id} className="row-prop">
          <span className="row-prop-name">
            <PropIcon type={def.type} /> <span>{def.name}</span>
          </span>
          <div className="row-prop-value">
            <PropertyCell row={row} def={def} dbPage={dbPage} />
          </div>
        </div>
      ))}
      <button type="button" className="row-prop-add" onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}>
        <Plus size={14} /> 添加属性
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="menu">
          <div className="menu-title">属性类型</div>
          <AddPropertyItems page={dbPage} onDone={() => setAnchor(null)} />
        </Popover>
      )}
    </div>
  );
}

function AddPropertyItems({ page, onDone }: { page: PageMeta; onDone: () => void }) {
  return (
    <>
      {PROP_TYPES.map(({ type, label }) => (
        <MenuItem
          key={type}
          icon={<PropIcon type={type} size={16} />}
          label={label}
          onClick={() => {
            addProperty(page, type);
            onDone();
          }}
        />
      ))}
    </>
  );
}
