import { useEffect, useState } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import type { PageMeta } from "../../shared/types";
import { shortId } from "../db";
import { updatePage } from "../store";

export function CommentsBox({
  page,
  openComposer,
  onCloseComposer,
}: {
  page: PageMeta;
  openComposer?: boolean;
  onCloseComposer?: () => void;
}) {
  const comments = page.comments ?? [];
  const [text, setText] = useState("");
  const [composing, setComposing] = useState(Boolean(openComposer));
  const editable = !page.trashed && !page.locked;

  useEffect(() => {
    if (openComposer) setComposing(true);
  }, [openComposer]);

  const closeComposer = () => {
    setComposing(false);
    onCloseComposer?.();
  };

  if (comments.length === 0 && !composing) return null;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    updatePage(page.id, {
      comments: [...comments, { id: shortId(), author: "我", text: trimmed, createdAt: Date.now() }],
    });
    setText("");
    closeComposer();
  };

  return (
    <section className="page-comments" aria-label="页面批注" data-comments-state={composing ? "composing" : "idle"}>
      {comments.map((c) => (
        <div key={c.id} className="comment-row">
          <span className="comment-avatar">{c.author.slice(0, 1)}</span>
          <div className="comment-body">
            <div className="comment-meta">
              <strong>{c.author}</strong>
              <span>
                {new Date(c.createdAt).toLocaleString("zh-CN", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="comment-text">{c.text}</div>
          </div>
          {editable && (
            <button
              type="button"
              className="icon-btn small comment-del"
              title="删除批注"
              aria-label="删除批注"
              onClick={() => updatePage(page.id, { comments: comments.filter((x) => x.id !== c.id) })}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      {editable && composing ? (
        <form
          className="comment-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <MessageSquare size={14} />
          <input
            autoFocus
            value={text}
            placeholder="添加批注或讨论记录…（回车发送）"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (!e.nativeEvent.isComposing && e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                closeComposer();
              }
            }}
          />
          <button type="submit" className="primary-btn small" disabled={!text.trim()}>
            <Send size={13} /> 发送
          </button>
        </form>
      ) : (
        editable &&
        comments.length > 0 && (
          <button type="button" className="text-btn small comment-more" onClick={() => setComposing(true)}>
            <MessageSquare size={13} /> 继续添加批注
          </button>
        )
      )}
    </section>
  );
}
