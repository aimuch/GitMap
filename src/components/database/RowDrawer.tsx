import { useCallback, useEffect, useRef, useState } from "react";
import {
  CircleAlert,
  Ellipsis,
  Image as ImageIcon,
  Lock,
  Maximize2,
  MessageSquare,
  RotateCcw,
  Smile,
  Star,
  X,
} from "lucide-react";
import { transitionPageLoad, useMachine } from "../../machines";
import { fetchPage, navigate, setPeekRowId, updatePage, useStore } from "../../store";
import { CommentsBox } from "../CommentsBox";
import { Editor, type NoteEditor } from "../Editor";
import { PageMenu } from "../PageMenu";
import { CoverPicker, EmojiPicker, coverStyle, randomCover } from "../pickers";
import { cx } from "../Popover";
import { RowProperties } from "./DatabaseView";

/** 数据库侧边抽屉（Side Peek）：不离开当前数据库即可查看和编辑一行的全部属性与正文 */
export function RowDrawer({ id }: { id: string }) {
  const meta = useStore((s) => s.pages[id]);
  const parent = useStore((s) => (meta?.parentId ? s.pages[meta.parentId] : undefined));
  const revision = useStore((s) => s.revisions[id] ?? 0);
  const [loadState, sendLoad] = useMachine(transitionPageLoad, { status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const [coverAnchor, setCoverAnchor] = useState<HTMLElement | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const editorRef = useRef<NoteEditor | null>(null);
  const onReady = useCallback((ed: NoteEditor | null) => {
    editorRef.current = ed;
  }, []);
  const onDirty = useCallback(() => sendLoad({ type: "MARK_DIRTY" }), [sendLoad]);

  useEffect(() => {
    let alive = true;
    sendLoad({ type: "RELOAD" });
    fetchPage(id).then(
      (p) => alive && sendLoad({ type: "LOADED", record: p }),
      (err: Error) => alive && sendLoad({ type: "FAILED", message: err.message }),
    );
    return () => {
      alive = false;
    };
  }, [id, revision, reloadKey, sendLoad]);

  if (!meta || meta.trashed) return null;
  const editable = !meta.locked;

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPeekRowId(null)}>
      <aside
        className={cx("row-drawer", `font-${meta.font ?? "sans"}`, meta.smallText && "small-text")}
        role="dialog"
        aria-label={meta.title || "数据库行详情"}
        data-drawer-state={loadState.status}
      >
        <header className="drawer-head">
          <button
            type="button"
            className="text-btn small"
            title="作为整页打开"
            onClick={() => navigate(meta.id)}
          >
            <Maximize2 size={14} /> 展开为整页
          </button>
          <div className="drawer-head-right">
            {meta.locked && (
              <button
                type="button"
                className="text-btn small"
                onClick={() => updatePage(meta.id, { locked: false })}
              >
                <Lock size={13} /> 已锁定（点击解锁）
              </button>
            )}
            <button
              type="button"
              className={cx("icon-btn small", meta.favorite && "starred")}
              aria-label={meta.favorite ? "取消收藏" : "添加到收藏"}
              onClick={() => updatePage(meta.id, { favorite: !meta.favorite })}
            >
              <Star size={16} fill={meta.favorite ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              className="icon-btn small"
              aria-label="更多操作"
              onClick={(e) => setMenuAnchor(menuAnchor ? null : e.currentTarget)}
            >
              <Ellipsis size={16} />
            </button>
            <button type="button" className="icon-btn small" aria-label="关闭抽屉" onClick={() => setPeekRowId(null)}>
              <X size={17} />
            </button>
          </div>
          {menuAnchor && (
            <PageMenu
              page={meta}
              anchor={menuAnchor}
              currentId={null}
              align="end"
              showLayout
              onClose={() => setMenuAnchor(null)}
            />
          )}
        </header>

        <div className="drawer-scroll">
          {meta.cover && (
            <div className="cover drawer-cover" style={coverStyle(meta.cover)}>
              {editable && (
                <div className="cover-actions">
                  <button type="button" onClick={(e) => setCoverAnchor(coverAnchor ? null : e.currentTarget)}>
                    更换封面
                  </button>
                </div>
              )}
              {coverAnchor && (
                <CoverPicker
                  anchor={coverAnchor}
                  onPick={(cover) => updatePage(meta.id, { cover })}
                  onClose={() => setCoverAnchor(null)}
                />
              )}
            </div>
          )}

          <div className="drawer-body">
            <div className="page-header">
              {meta.icon && (
                <button
                  type="button"
                  className="page-icon"
                  disabled={!editable}
                  onClick={(e) => setEmojiAnchor(emojiAnchor ? null : e.currentTarget)}
                >
                  {meta.icon}
                </button>
              )}
              {editable && (
                <div className={cx("page-controls", emojiAnchor && "visible")}>
                  {!meta.icon && (
                    <button type="button" onClick={(e) => setEmojiAnchor(emojiAnchor ? null : e.currentTarget)}>
                      <Smile size={14} /> 添加图标
                    </button>
                  )}
                  {!meta.cover && (
                    <button type="button" onClick={() => updatePage(meta.id, { cover: randomCover() })}>
                      <ImageIcon size={14} /> 添加封面
                    </button>
                  )}
                  <button type="button" onClick={() => setCommentOpen(true)}>
                    <MessageSquare size={14} /> 添加批注
                  </button>
                </div>
              )}
              <input
                className="page-title drawer-title"
                value={meta.title}
                readOnly={!editable}
                placeholder="无标题"
                onChange={(e) => updatePage(meta.id, { title: e.target.value })}
                onKeyDown={(e) => {
                  if (!e.nativeEvent.isComposing && e.key === "Enter") editorRef.current?.focus();
                }}
              />
              {emojiAnchor && (
                <EmojiPicker
                  anchor={emojiAnchor}
                  hasIcon={Boolean(meta.icon)}
                  onPick={(icon) => updatePage(meta.id, { icon })}
                  onClose={() => setEmojiAnchor(null)}
                />
              )}
            </div>

            {parent?.kind === "database" && (
              <div inert={!editable}>
                <RowProperties row={meta} dbPage={parent} />
              </div>
            )}

            <CommentsBox page={meta} openComposer={commentOpen} onCloseComposer={() => setCommentOpen(false)} />

            {loadState.status === "ready" ? (
              <Editor key={`${id}:${revision}`} page={loadState.record} editable={editable} onReady={onReady} onDirty={onDirty} />
            ) : loadState.status === "error" ? (
              <div className="page-message">
                <CircleAlert size={16} /> 加载失败：{loadState.message}
                <button type="button" className="text-btn small" onClick={() => setReloadKey((n) => n + 1)}>
                  <RotateCcw size={13} /> 重试
                </button>
              </div>
            ) : (
              <div className="editor-skeleton" aria-hidden>
                <span />
                <span />
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
