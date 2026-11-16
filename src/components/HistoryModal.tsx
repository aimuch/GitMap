import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw, X } from "lucide-react";
import type { HistoryEntry, PageMeta, PageRecord } from "../../shared/types";
import { fetchHistory, fetchVersion, restoreVersion } from "../store";
import { Editor } from "./Editor";
import { cx } from "./Popover";

const formatTime = (ts: number) =>
  new Date(ts).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 页面历史：左边预览选中的版本（只读），右边是版本列表。 */
export function HistoryModal({ page, onClose }: { page: PageMeta; onClose: () => void }) {
  const [versions, setVersions] = useState<HistoryEntry[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [record, setRecord] = useState<PageRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noop = useCallback(() => {}, []);

  useEffect(() => {
    let alive = true;
    fetchHistory(page.id).then(
      (list) => {
        if (!alive) return;
        setVersions(list);
        setSelected(list[0]?.ts ?? null);
      },
      (err: Error) => alive && setError(err.message),
    );
    return () => {
      alive = false;
    };
  }, [page.id]);

  useEffect(() => {
    if (selected === null) return;
    let alive = true;
    setRecord(null);
    fetchVersion(page.id, selected).then(
      (r) => alive && setRecord(r),
      (err: Error) => alive && setError(err.message),
    );
    return () => {
      alive = false;
    };
  }, [page.id, selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const restore = async () => {
    if (selected === null) return;
    if (await restoreVersion(page.id, selected)) onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="history-modal" role="dialog" aria-modal="true" aria-label="页面历史">
        <div className="history-preview">
          {record ? (
            <>
              <div className="history-title">{record.title || "无标题"}</div>
              <Editor key={selected} page={record} editable={false} onReady={noop} nested />
            </>
          ) : (
            <div className="history-empty">
              {error ?? (versions?.length === 0 ? "这个页面还没有历史版本。" : "正在加载…")}
              {versions?.length === 0 && (
                <p>编辑页面时，大约每 10 分钟会自动保存一个版本，最多保留 40 个。</p>
              )}
            </div>
          )}
        </div>
        <aside className="history-side">
          <div className="history-side-head">
            <History size={15} /> 页面历史
            <button type="button" className="icon-btn small" aria-label="关闭" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
          <div className="history-list">
            {versions?.map((v) => (
              <button
                key={v.ts}
                type="button"
                className={cx("history-item", v.ts === selected && "active")}
                onClick={() => setSelected(v.ts)}
              >
                <span>{formatTime(v.ts)}</span>
                <span className="history-meta">{v.chars} 字</span>
              </button>
            ))}
          </div>
          <div className="history-actions">
            <button type="button" className="primary-btn" disabled={selected === null} onClick={() => void restore()}>
              <RotateCcw size={15} /> 恢复这个版本
            </button>
            <p>恢复前会先把现在的内容存成一个版本。</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
