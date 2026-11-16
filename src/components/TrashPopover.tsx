import { useState } from "react";
import { Eraser, FileText, RefreshCw, Search, SearchX, Trash, Trash2, Undo2 } from "lucide-react";
import type { PageMeta } from "../../shared/types";
import { cleanOrphanSynced, deletePage, emptyTrash, navigate, restorePage, useStore } from "../store";
import { Popover } from "./Popover";

interface Props {
  anchor: HTMLElement;
  items: PageMeta[];
  onClose: () => void;
}

export function TrashPopover({ anchor, items, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [cleanedMsg, setCleanedMsg] = useState<string | null>(null);
  const hasHiddenSynced = useStore((s) => Object.values(s.pages).some((p) => p.hidden));
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((p) => (p.title || "无标题").toLowerCase().includes(q)) : items;

  return (
    <Popover anchor={anchor} onClose={onClose} placement="right" className="trash-popover">
      <div className="trash-search">
        <Search size={14} />
        <input
          autoFocus
          value={query}
          placeholder="在回收站中筛选页面…"
          aria-label="筛选回收站"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="trash-list">
        {shown.map((p) => (
          <div
            key={p.id}
            className="trash-row"
            role="button"
            tabIndex={0}
            onClick={() => {
              navigate(p.id);
              onClose();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target === e.currentTarget) {
                navigate(p.id);
                onClose();
              }
            }}
          >
            <span className="tree-icon">{p.icon ?? <FileText size={16} />}</span>
            <span className="trash-title">{p.title || "无标题"}</span>
            <button
              type="button"
              className="icon-btn small"
              title="恢复"
              aria-label={`恢复“${p.title || "无标题"}”`}
              onClick={(e) => {
                e.stopPropagation();
                void restorePage(p.id);
              }}
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="icon-btn small"
              title="永久删除"
              aria-label={`永久删除“${p.title || "无标题"}”`}
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`永久删除“${p.title || "无标题"}”及其子页面？此操作无法撤销。`)) {
                  void deletePage(p.id);
                }
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {shown.length === 0 && (
          <div className="trash-empty">
            {items.length === 0 ? <Trash size={28} strokeWidth={1.5} /> : <SearchX size={28} strokeWidth={1.5} />}
            {items.length === 0 ? "回收站是空的" : "没有匹配的页面"}
          </div>
        )}
      </div>
      {(items.length > 0 || hasHiddenSynced || cleanedMsg) && (
        <div className="trash-footer">
          {items.length > 0 && (
            <button
              type="button"
              className="text-btn danger"
              onClick={() => {
                if (window.confirm(`永久删除回收站中的全部 ${items.length} 个页面？此操作无法撤销。`)) {
                  void emptyTrash();
                }
              }}
            >
              <Eraser size={14} /> 清空回收站
            </button>
          )}
          {hasHiddenSynced && (
            <button
              type="button"
              className="text-btn"
              title="删除没有被任何页面引用的闲置同步块内容"
              onClick={async () => {
                const n = await cleanOrphanSynced();
                setCleanedMsg(n > 0 ? `已清理 ${n} 个闲置同步块` : "没有未引用的同步块");
              }}
            >
              <RefreshCw size={13} /> 清理闲置同步块
            </button>
          )}
          {cleanedMsg && <span className="trash-clean-note">{cleanedMsg}</span>}
        </div>
      )}
    </Popover>
  );
}
