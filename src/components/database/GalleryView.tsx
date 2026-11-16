import { useEffect, useRef } from "react";
import { FileText, Plus } from "lucide-react";
import type { DatabaseDef, PageMeta, PropertyDef, ViewDef } from "../../../shared/types";
import { cellValue, visibleProperties } from "../../db";
import { navigate, setPeekRowId, updatePage } from "../../store";
import { coverStyle } from "../pickers";
import { cx } from "../Popover";
import { ValueDisplay } from "./cells";

interface Props {
  db: DatabaseDef;
  view: ViewDef;
  rows: PageMeta[];
  editingId: string | null;
  onEditDone: () => void;
  onCreate: () => void;
}

/** 画廊：每一行是一张带封面的卡片。封面取页面自己的封面。 */
export function GalleryView({ db, view, rows, editingId, onEditDone, onCreate }: Props) {
  const shownDefs = visibleProperties(db, view);
  return (
    <div className="gallery">
      {rows.map((row) => (
        <GalleryCard
          key={row.id}
          row={row}
          defs={shownDefs}
          editing={row.id === editingId}
          onEditDone={onEditDone}
        />
      ))}
      <button type="button" className="gallery-new" onClick={onCreate}>
        <Plus size={16} /> 新建
      </button>
    </div>
  );
}

interface CardProps {
  row: PageMeta;
  defs: PropertyDef[];
  editing: boolean;
  onEditDone: () => void;
}

function GalleryCard({ row, defs, editing, onEditDone }: CardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div
      className="gallery-card"
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if (!editing) {
          if (e.metaKey || e.ctrlKey) navigate(row.id);
          else setPeekRowId(row.id);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) setPeekRowId(row.id);
      }}
    >
      <div className={cx("gallery-cover", !row.cover && "empty")} style={row.cover ? coverStyle(row.cover) : undefined}>
        {!row.cover && <span className="gallery-cover-icon">{row.icon ?? <FileText size={28} strokeWidth={1.5} />}</span>}
      </div>
      <div className="gallery-body">
        <div className="board-card-title">
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
            <span className={cx("board-card-name", !row.title && "untitled")}>{row.title || "无标题"}</span>
          )}
        </div>
        <div className="board-card-props">
          {defs.map((def) => (
            <ValueDisplay key={def.id} value={cellValue(row, def)} def={def} />
          ))}
        </div>
      </div>
    </div>
  );
}
