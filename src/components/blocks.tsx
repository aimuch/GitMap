import { useEffect, useState } from "react";
import { createReactBlockSpec, useEditorChange } from "@blocknote/react";
import { Bookmark, ExternalLink, ListTree, LoaderCircle, Palette, Pencil, Sigma } from "lucide-react";
import { unfurlLink } from "../store";
import { EmojiPicker } from "./pickers";
import { cx } from "./Popover";

const CALLOUT_TONES = ["gray", "blue", "green", "yellow", "orange", "red", "purple"] as const;
const TONE_LABELS: Record<string, string> = {
  gray: "默认灰",
  blue: "海洋蓝",
  green: "森林绿",
  yellow: "暖阳黄",
  orange: "琥珀橙",
  red: "珊瑚红",
  purple: "薰衣草紫",
};

/** 提示框（Callout）：左侧可换 emoji 图标，支持 7 种底色，内部保留完整富文本编辑能力 */
export const createCalloutBlock = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      icon: { default: "💡" },
      tone: { default: "gray" },
    },
    content: "inline",
  },
  {
    render: ({ block, editor, contentRef }) => {
      const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
      const editable = editor.isEditable;
      const cycleTone = () => {
        if (!editable) return;
        const idx = CALLOUT_TONES.indexOf(block.props.tone as (typeof CALLOUT_TONES)[number]);
        const next = CALLOUT_TONES[(idx + 1) % CALLOUT_TONES.length];
        editor.updateBlock(block, { props: { tone: next } });
      };

      return (
        <div className={cx("callout-block", `callout-${block.props.tone}`)}>
          <button
            type="button"
            className="callout-icon"
            contentEditable={false}
            disabled={!editable}
            title={editable ? "点击更换图标" : undefined}
            onClick={(e) => {
              if (editable) setEmojiAnchor(emojiAnchor ? null : e.currentTarget);
            }}
          >
            {block.props.icon || "💡"}
          </button>
          <div className="callout-content" ref={contentRef} />
          {editable && (
            <button
              type="button"
              className="callout-tone-btn"
              contentEditable={false}
              title={`切换底色（当前：${TONE_LABELS[block.props.tone] ?? "默认"}）`}
              aria-label="切换提示框底色"
              onClick={cycleTone}
            >
              <Palette size={13} />
            </button>
          )}
          {emojiAnchor && (
            <EmojiPicker
              anchor={emojiAnchor}
              hasIcon={false}
              onPick={(icon) => editor.updateBlock(block, { props: { icon: icon ?? "💡" } })}
              onClose={() => setEmojiAnchor(null)}
            />
          )}
        </div>
      );
    },
    parse: (el) => (el.tagName === "ASIDE" ? { icon: "💡", tone: "gray" } : undefined),
    toExternalHTML: ({ block, contentRef }) => (
      <aside>
        <span>{block.props.icon} </span>
        <span ref={contentRef} />
      </aside>
    ),
  },
);

interface HeadingItem {
  id: string;
  level: number;
  text: string;
}

function collectHeadings(blocks: unknown[], out: HeadingItem[] = []): HeadingItem[] {
  for (const raw of blocks) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as {
      id?: string;
      type?: string;
      props?: { level?: number };
      content?: { text?: string }[];
      children?: unknown[];
    };
    if (b.type === "heading" && b.id) {
      const text = Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("").trim() : "";
      out.push({ id: b.id, level: Number(b.props?.level ?? 1), text: text || "无标题章节" });
    }
    if (Array.isArray(b.children) && b.children.length > 0) collectHeadings(b.children, out);
  }
  return out;
}

/** 目录块（Table of Contents）：实时提取页面内的一/二/三级标题，点击平滑滚动定位 */
export const createTocBlock = createReactBlockSpec(
  {
    type: "toc",
    propSchema: {},
    content: "none",
  },
  {
    render: ({ editor }) => {
      const [, setTick] = useState(0);
      useEditorChange(() => setTick((n) => n + 1), editor);
      const headings = collectHeadings(editor.document);
      const minLevel = headings.reduce((m, h) => Math.min(m, h.level), 3);

      return (
        <nav className="toc-block" contentEditable={false} aria-label="页面目录">
          <div className="toc-head">
            <ListTree size={14} /> 目录
          </div>
          {headings.length === 0 ? (
            <div className="toc-empty">在页面中添加一、二、三级标题后，这里会自动生成可跳转的目录。</div>
          ) : (
            <div className="toc-list">
              {headings.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className="toc-item"
                  style={{ paddingLeft: 8 + Math.max(0, h.level - minLevel) * 16 }}
                  onClick={() => {
                    const target = document.querySelector(`[data-id="${h.id}"]`);
                    target?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  {h.text}
                </button>
              ))}
            </div>
          )}
        </nav>
      );
    },
    toExternalHTML: () => <p>（目录）</p>,
  },
);

const LATEX_SYMBOLS: [RegExp, string][] = [
  [/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1) / ($2)"],
  [/\\sqrt\{([^{}]+)\}/g, "√($1)"],
  [/\\sum/g, "∑"],
  [/\\prod/g, "∏"],
  [/\\int/g, "∫"],
  [/\\infty/g, "∞"],
  [/\\approx/g, "≈"],
  [/\\neq/g, "≠"],
  [/\\leq|\\le/g, "≤"],
  [/\\geq|\\ge/g, "≥"],
  [/\\pm/g, "±"],
  [/\\times/g, "×"],
  [/\\div/g, "÷"],
  [/\\cdot/g, "·"],
  [/\\rightarrow|\\to/g, "→"],
  [/\\leftarrow/g, "←"],
  [/\\Rightarrow/g, "⇒"],
  [/\\alpha/g, "α"],
  [/\\beta/g, "β"],
  [/\\gamma/g, "γ"],
  [/\\delta/g, "δ"],
  [/\\Delta/g, "Δ"],
  [/\\theta/g, "θ"],
  [/\\lambda/g, "λ"],
  [/\\mu/g, "μ"],
  [/\\pi/g, "π"],
  [/\\sigma/g, "σ"],
  [/\\omega/g, "ω"],
];

function formatMathPreview(latex: string): string {
  let out = latex.trim();
  for (const [re, rep] of LATEX_SYMBOLS) out = out.replace(re, rep);
  return out;
}

/** 数学公式块（Equation）：点击输入 LaTeX / 数学表达式，预览清晰排版 */
export const createEquationBlock = createReactBlockSpec(
  {
    type: "equation",
    propSchema: {
      latex: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const editable = editor.isEditable;
      const [editing, setEditing] = useState(!block.props.latex);
      const [draft, setDraft] = useState(block.props.latex);

      useEffect(() => {
        setDraft(block.props.latex);
      }, [block.props.latex]);

      const commit = () => {
        editor.updateBlock(block, { props: { latex: draft.trim() } });
        if (draft.trim()) setEditing(false);
      };

      if (editable && editing) {
        return (
          <div className="equation-block editing" contentEditable={false} onKeyDown={(e) => e.stopPropagation()}>
            <Sigma size={15} className="equation-icon" />
            <input
              autoFocus
              value={draft}
              placeholder="输入数学公式或 LaTeX，如 E = mc^2 或 \sum_{i=1}^n x_i = \frac{n(n+1)}{2}"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (!e.nativeEvent.isComposing && (e.key === "Enter" || e.key === "Escape")) {
                  e.preventDefault();
                  commit();
                }
              }}
            />
          </div>
        );
      }

      return (
        <div
          className={cx("equation-block", editable && "clickable")}
          contentEditable={false}
          role={editable ? "button" : undefined}
          tabIndex={editable ? 0 : undefined}
          onClick={() => editable && setEditing(true)}
          onKeyDown={(e) => {
            if (editable && e.key === "Enter") setEditing(true);
          }}
        >
          <span className="equation-display">{formatMathPreview(block.props.latex) || "点击编辑公式"}</span>
        </div>
      );
    },
    toExternalHTML: ({ block }) => <pre>{`$$${block.props.latex}$$`}</pre>,
  },
);

type BookmarkState =
  | { phase: "editing"; draft: string; error: string | null }
  | { phase: "resolving"; draft: string }
  | { phase: "ready" };

/** 网页书签块（Web Bookmark）：输入网址自动抓取站点标题与简介并渲染为卡片，可随时修改网址 */
export const createBookmarkBlock = createReactBlockSpec(
  {
    type: "bookmark",
    propSchema: {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
      siteName: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const editable = editor.isEditable;
      const [bmState, setBmState] = useState<BookmarkState>(() =>
        block.props.url ? { phase: "ready" } : { phase: "editing", draft: "", error: null },
      );

      const effective: BookmarkState =
        !block.props.url && bmState.phase === "ready" ? { phase: "editing", draft: "", error: null } : bmState;

      const submit = async () => {
        if (effective.phase !== "editing") return;
        let raw = effective.draft.trim();
        if (!raw) return;
        if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
        setBmState({ phase: "resolving", draft: raw });
        try {
          const data = await unfurlLink(raw);
          editor.updateBlock(block, {
            props: {
              url: data.url,
              title: data.title,
              description: data.description,
              siteName: data.siteName,
            },
          });
          setBmState({ phase: "ready" });
        } catch (e) {
          setBmState({
            phase: "editing",
            draft: raw,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      };

      if (effective.phase !== "ready") {
        const loading = effective.phase === "resolving";
        const err = effective.phase === "editing" ? effective.error : null;
        return (
          <div
            className="bookmark-input-bar"
            contentEditable={false}
            data-bookmark-state={effective.phase}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Bookmark size={15} />
            <input
              autoFocus={editable}
              disabled={!editable || loading}
              value={effective.draft}
              placeholder="输入或粘贴网址（如 https://example.com），回车生成书签卡片…"
              onChange={(e) => setBmState({ phase: "editing", draft: e.target.value, error: null })}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                } else if (e.key === "Escape" && block.props.url) {
                  e.preventDefault();
                  setBmState({ phase: "ready" });
                }
              }}
            />
            <button
              type="button"
              className="primary-btn small"
              disabled={loading || !effective.draft.trim()}
              onClick={() => void submit()}
            >
              {loading ? <LoaderCircle size={13} className="spin" /> : "嵌入书签"}
            </button>
            {block.props.url && !loading && (
              <button type="button" className="text-btn small" onClick={() => setBmState({ phase: "ready" })}>
                取消
              </button>
            )}
            {err && <span className="value-error bookmark-err">{err}</span>}
          </div>
        );
      }

      return (
        <div className="bookmark-card-wrap" contentEditable={false} data-bookmark-state="ready">
          <a
            className="bookmark-card"
            href={/^https?:\/\//i.test(block.props.url) ? block.props.url : "about:blank"}
            target="_blank"
            rel="noreferrer noopener"
          >
            <div className="bookmark-card-main">
              <div className="bookmark-title">{block.props.title || block.props.url}</div>
              {block.props.description && <div className="bookmark-desc">{block.props.description}</div>}
              <div className="bookmark-meta">
                <ExternalLink size={12} />
                <span>{block.props.siteName || block.props.url}</span>
              </div>
            </div>
          </a>
          {editable && (
            <button
              type="button"
              className="bookmark-edit-btn"
              title="更换网址"
              aria-label="更换书签网址"
              onClick={() => setBmState({ phase: "editing", draft: block.props.url, error: null })}
            >
              <Pencil size={12} /> 更换网址
            </button>
          )}
        </div>
      );
    },
    toExternalHTML: ({ block }) => (
      <p>
        <a href={block.props.url}>{block.props.title || block.props.url}</a>
      </p>
    ),
  },
);
