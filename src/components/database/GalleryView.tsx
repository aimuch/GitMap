import { useEffect, useRef } from "react";
import { FileText, Plus } from "lucide-react";
import type { DatabaseDef, PageMeta, PropertyDef, ViewDef } from "../../../shared/types";
import { cellValue, valueText, visibleProperties } from "../../db";
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

/** 画廊视图：支持切换卡片尺寸（小/中/大）与封面预览模式（页面封面 / 属性摘要 / 无封面） */
export function GalleryView({ db, view, rows, editingId, onEditDone, onCreate }: Props) {
  const shownDefs = visibleProperties(db, view);
  const size = view.cardSize ?? "medium";
  const coverMode = view.cardCover ?? "cover";

  return (
    <div className={cx("gallery", `gallery-${size}`)} data-card-size={size} data-card-cover={coverMode}>
      {rows.map((row) => (
        <GalleryCard
          key={row.id}
          row={row}
          defs={shownDefs}
          coverMode={coverMode}
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
  coverMode: "cover" | "content" | "none";
  editing: boolean;
  onEditDone: () => void;
}

function GalleryCard({ row, defs, coverMode, editing, onEditDone }: CardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const summaryText =
    coverMode === "content"
      ? defs
          .map((d) => {
            const t = valueText(cellValue(row, d), d);
            return t ? `${d.name}：${t}` : "";
          })
          .filter(Boolean)
          .slice(0, 3)
          .join("\n")
      : "";

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
      {coverMode !== "none" && (
        <div
          className={cx("gallery-cover", (!row.cover || coverMode === "content") && "empty")}
          style={coverMode === "cover" && row.cover ? coverStyle(row.cover, row.coverY) : undefined}
        >
          {coverMode === "content" ? (
            <div className="gallery-excerpt">
              {summaryText || <span className="gallery-cover-icon">{row.icon ?? <FileText size={24} strokeWidth={1.5} />}</span>}
            </div>
          ) : (
            !row.cover && <span className="gallery-cover-icon">{row.icon ?? <FileText size={28} strokeWidth={1.5} />}</span>
          )}
        </div>
      )}
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
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.stopPropagation();
                  e.currentTarget.blur();
                }
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
