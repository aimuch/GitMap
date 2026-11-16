import { useEffect, useRef } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import type { PageMeta, PropertyDef } from "../../../shared/types";
import { cellValue } from "../../db";
import { navigate, setPeekRowId, trashPage, updatePage } from "../../store";
import { cx } from "../Popover";
import { ValueDisplay } from "./cells";

interface Props {
  rows: PageMeta[];
  defs: PropertyDef[];
  editingId: string | null;
  onEditDone: () => void;
  onCreate: () => void;
}

/** 列表视图：紧凑展示每一行的图标、名称与所选属性摘要，点击在侧边抽屉打开 */
export function ListView({ rows, defs, editingId, onEditDone, onCreate }: Props) {
  return (
    <div className="db-list">
      {rows.map((row) => (
        <ListRow
          key={row.id}
          row={row}
          defs={defs}
          editing={row.id === editingId}
          onEditDone={onEditDone}
        />
      ))}
      <button type="button" className="db-add-row" onClick={onCreate}>
        <Plus size={15} /> 新建
      </button>
    </div>
  );
}

function ListRow({
  row,
  defs,
  editing,
  onEditDone,
}: {
  row: PageMeta;
  defs: PropertyDef[];
  editing: boolean;
  onEditDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div
      className="db-list-row"
      role="button"
      tabIndex={0}
      onMouseDown={() => {
        wasEditing.current = editing;
      }}
      onClick={(e) => {
        if (editing || wasEditing.current) {
          wasEditing.current = false;
          return;
        }
        if (e.metaKey || e.ctrlKey) navigate(row.id);
        else setPeekRowId(row.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) setPeekRowId(row.id);
      }}
    >
      <span className="tree-icon">{row.icon ?? <FileText size={15} />}</span>
      {editing ? (
        <input
          ref={inputRef}
          className="cell-input cell-title"
          value={row.title}
          placeholder="输入名称…"
          aria-label="名称"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updatePage(row.id, { title: e.target.value })}
          onBlur={onEditDone}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          }}
        />
      ) : (
        <span className={cx("db-list-title", !row.title && "untitled")}>{row.title || "无标题"}</span>
      )}
      <div className="db-list-props">
        {defs.map((def) => {
          const node = ValueDisplay({ value: cellValue(row, def), def });
          return node ? (
            <span key={def.id} className="db-list-prop">
              {node}
            </span>
          ) : null;
        })}
      </div>
      <button
        type="button"
        className="icon-btn small db-list-del"
        title="移到回收站"
        aria-label={`把“${row.title || "无标题"}”移到回收站`}
        onClick={(e) => {
          e.stopPropagation();
          void trashPage(row.id);
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
