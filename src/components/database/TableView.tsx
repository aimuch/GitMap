import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, FileText, Maximize2, Plus, Trash2 } from "lucide-react";
import type { DatabaseDef, PageMeta, PropertyDef, PropType, ViewDef } from "../../../shared/types";
import {
  PROP_TYPES,
  addProperty,
  changePropertyType,
  removeProperty,
  updateProperty,
  updateView,
} from "../../db";
import { navigate, trashPage, updatePage } from "../../store";
import { MenuDivider, MenuItem, Popover, cx } from "../Popover";
import { PropIcon, PropertyCell } from "./cells";

interface Props {
  page: PageMeta;
  db: DatabaseDef;
  view: ViewDef;
  rows: PageMeta[];
  /** 所有行（不受筛选影响），修改属性类型时要转换全部的值 */
  allRows: PageMeta[];
  focusRowId: string | null;
  onAddRow: () => void;
}

export function TableView({ page, db, view, rows, allRows, focusRowId, onAddRow }: Props) {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; propId: string } | null>(null);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const columns = `var(--db-title-col, minmax(260px, 2fr)) ${db.properties.map(() => "minmax(150px, 1fr)").join(" ")} 44px`;
  const menuDef = menu ? db.properties.find((p) => p.id === menu.propId) : undefined;

  return (
    <div className="db-table-scroll">
      <div className="db-table" role="table" style={{ gridTemplateColumns: columns }}>
        <div className="db-row db-head" role="row">
          <div className="db-th" role="columnheader">
            <PropIcon type="title" />
            <span className="db-th-name">名称</span>
            <SortMark view={view} propId="title" />
          </div>
          {db.properties.map((def) => (
            <button
              key={def.id}
              type="button"
              role="columnheader"
              className={cx("db-th", menu?.propId === def.id && "open")}
              onClick={(e) => setMenu(menu?.propId === def.id ? null : { anchor: e.currentTarget, propId: def.id })}
            >
              <PropIcon type={def.type} />
              <span className="db-th-name">{def.name}</span>
              <SortMark view={view} propId={def.id} />
            </button>
          ))}
          <button
            type="button"
            className="db-th db-th-add"
            title="添加属性"
            aria-label="添加属性"
            onClick={(e) => setAddAnchor(addAnchor ? null : e.currentTarget)}
          >
            <Plus size={15} />
          </button>
        </div>

        {rows.map((row) => (
          <div key={row.id} className="db-row" role="row">
            <TitleCell row={row} autoFocus={row.id === focusRowId} />
            {db.properties.map((def) => (
              <div key={def.id} className="db-td" role="cell">
                <PropertyCell row={row} def={def} dbPage={page} />
              </div>
            ))}
            <div className="db-td db-td-tail">
              <button
                type="button"
                className="icon-btn small"
                title="移到回收站"
                aria-label={`把“${row.title || "无标题"}”移到回收站`}
                onClick={() => void trashPage(row.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="db-add-row" onClick={onAddRow}>
        <Plus size={15} /> 新建
      </button>
      <div className="db-count">共 {rows.length} 条</div>

      {menu && menuDef && (
        <PropertyMenu
          anchor={menu.anchor}
          page={page}
          def={menuDef}
          view={view}
          allRows={allRows}
          onClose={() => setMenu(null)}
        />
      )}
      {addAnchor && (
        <Popover anchor={addAnchor} onClose={() => setAddAnchor(null)} align="end" className="menu">
          <div className="menu-title">属性类型</div>
          {PROP_TYPES.map((t) => (
            <MenuItem
              key={t.type}
              icon={<PropIcon type={t.type} size={16} />}
              label={t.label}
              onClick={() => {
                addProperty(page, t.type);
                setAddAnchor(null);
              }}
            />
          ))}
        </Popover>
      )}
    </div>
  );
}

function SortMark({ view, propId }: { view: ViewDef; propId: string }) {
  if (view.sort?.propId !== propId) return null;
  return view.sort.dir === "asc" ? <ArrowUp size={13} className="db-sort-mark" /> : <ArrowDown size={13} className="db-sort-mark" />;
}

function TitleCell({ row, autoFocus }: { row: PageMeta; autoFocus: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <div className="db-td db-td-title" role="cell">
      <span className="tree-icon">{row.icon ?? <FileText size={15} />}</span>
      <input
        ref={ref}
        className="cell-input cell-title"
        value={row.title}
        placeholder="无标题"
        aria-label="名称"
        onChange={(e) => updatePage(row.id, { title: e.target.value })}
        onKeyDown={(e) => {
          if (!e.nativeEvent.isComposing && e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <button type="button" className="db-open" title="作为页面打开" onClick={() => navigate(row.id)}>
        <Maximize2 size={12} /> 打开
      </button>
    </div>
  );
}

interface PropertyMenuProps {
  anchor: HTMLElement;
  page: PageMeta;
  def: PropertyDef;
  view: ViewDef;
  allRows: PageMeta[];
  onClose: () => void;
}

function PropertyMenu({ anchor, page, def, view, allRows, onClose }: PropertyMenuProps) {
  const sortBy = (dir: "asc" | "desc") => {
    const same = view.sort?.propId === def.id && view.sort.dir === dir;
    updateView(page, view.id, { sort: same ? null : { propId: def.id, dir } });
    onClose();
  };
  const setType = (type: PropType) => changePropertyType(page, allRows, def.id, type);

  return (
    <Popover anchor={anchor} onClose={onClose} className="menu prop-menu">
      <input
        className="menu-input"
        autoFocus
            onFocus={(e) => e.target.select()}
        value={def.name}
        aria-label="属性名称"
        onChange={(e) => updateProperty(page, def.id, { name: e.target.value })}
        onKeyDown={(e) => {
          if (!e.nativeEvent.isComposing && e.key === "Enter") onClose();
        }}
      />
      <div className="menu-title">类型</div>
      {PROP_TYPES.map((t) => (
        <MenuItem
          key={t.type}
          icon={<PropIcon type={t.type} size={16} />}
          label={t.label}
          hint={def.type === t.type ? "当前" : undefined}
          onClick={() => setType(t.type)}
        />
      ))}
      <MenuDivider />
      <MenuItem
        icon={view.sort?.propId === def.id && view.sort.dir === "asc" ? <Check size={16} /> : <ArrowUp size={16} />}
        label="升序排列"
        onClick={() => sortBy("asc")}
      />
      <MenuItem
        icon={view.sort?.propId === def.id && view.sort.dir === "desc" ? <Check size={16} /> : <ArrowDown size={16} />}
        label="降序排列"
        onClick={() => sortBy("desc")}
      />
      <MenuDivider />
      <MenuItem
        icon={<Trash2 size={16} />}
        label="删除属性"
        danger
        onClick={() => {
          onClose();
          if (window.confirm(`删除属性“${def.name}”？所有行里这一列的内容都会被丢弃。`)) removeProperty(page, def.id);
        }}
      />
    </Popover>
  );
}
