import { useEffect, useRef, useState } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import {
  Check,
  Copy,
  Eraser,
  FilePlus2,
  FileText,
  LoaderCircle,
  Send,
  Settings2,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import type { AiChatMessage, AiCitation } from "../../shared/types";
import { loadAiConfig, saveAiConfig, streamAiChat, useAiConfig } from "../ai";
import {
  createPage,
  fetchPage,
  flushPatch,
  navigate,
  reloadPageContent,
  setAiOpen,
  setAiSettingsOpen,
  updatePage,
  useStore,
} from "../store";
import { schema } from "./Editor";
import { cx } from "./Popover";

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  citations?: AiCitation[];
  error?: string;
}

const STARTERS = [
  { label: "梳理工作区进展", prompt: "请梳理我工作区里各个页面和数据库的主要内容与待办进展。", scope: "workspace" as const },
  { label: "查找未完成任务", prompt: "帮我列出工作区数据库和笔记里所有未完成的任务或待办事项。", scope: "workspace" as const },
  { label: "总结当前页面", prompt: "请提炼并总结当前页面的核心要点和行动项。", scope: "page" as const },
  { label: "起草方案框架", prompt: "帮我起草一份清晰的产品功能设计文档框架，包含背景、目标、方案对比与里程碑。", scope: "none" as const },
];

export function AiModal({ currentPageId }: { currentPageId: string | null }) {
  const cfg = useAiConfig();
  const currentPage = useStore((s) => (currentPageId ? s.pages[currentPageId] : undefined));
  const [scope, setScope] = useState<"workspace" | "page" | "none">(currentPageId ? "workspace" : "none");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cfg) void loadAiConfig().catch(() => {});
  }, [cfg]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns]);

  const activeProvider = cfg?.providers.find((p) => p.id === cfg.activeProviderId) ?? cfg?.providers[0];
  const configured = Boolean(activeProvider && (activeProvider.hasKey || activeProvider.keyOptional));

  const sendPrompt = async (promptText?: string, forceScope?: "workspace" | "page" | "none") => {
    const text = (promptText ?? input).trim();
    if (!text || running) return;
    const useScope = forceScope ?? scope;
    if (forceScope) setScope(forceScope);
    if (!promptText) setInput("");

    const userTurn: Turn = { id: `${Date.now()}-u`, role: "user", content: text };
    const assistantId = `${Date.now()}-a`;
    const assistantTurn: Turn = { id: assistantId, role: "assistant", content: "" };
    const historyMessages: AiChatMessage[] = [
      ...turns
        .filter((t) => !t.error && t.content.trim())
        .map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: text },
    ];

    setTurns((prev) => [...prev, userTurn, assistantTurn]);
    setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await streamAiChat({
        messages: historyMessages,
        scope: useScope,
        pageId: currentPageId,
        signal: ctrl.signal,
        onCitations: (citations) => {
          setTurns((prev) => prev.map((t) => (t.id === assistantId ? { ...t, citations } : t)));
        },
        onReasoning: (_d, full) => {
          setTurns((prev) => prev.map((t) => (t.id === assistantId ? { ...t, reasoning: full } : t)));
        },
        onDelta: (_d, full) => {
          setTurns((prev) => prev.map((t) => (t.id === assistantId ? { ...t, content: full } : t)));
        },
      });
    } catch (err) {
      if (!ctrl.signal.aborted) {
        const message = err instanceof Error ? err.message : String(err);
        setTurns((prev) => prev.map((t) => (t.id === assistantId ? { ...t, error: message } : t)));
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const saveAsNewPage = async (markdown: string) => {
    const editor = BlockNoteEditor.create({ schema });
    const headingMatch = /^#\s+(.+)$/m.exec(markdown);
    const title = headingMatch?.[1]?.trim() || "AI 生成笔记";
    const bodyMd = headingMatch ? markdown.replace(/^#\s+.+\n?/, "").trim() : markdown;
    const blocks = bodyMd ? await editor.tryParseMarkdownToBlocks(bodyMd) : [];
    const id = await createPage({ title, icon: "✨", content: blocks });
    if (id) {
      setAiOpen(false);
      navigate(id);
    }
  };

  const appendToCurrentPage = async (markdown: string) => {
    if (!currentPageId || !currentPage || currentPage.kind === "database" || currentPage.trashed || currentPage.locked) return;
    const editor = BlockNoteEditor.create({ schema });
    const blocks = await editor.tryParseMarkdownToBlocks(markdown);
    const record = await fetchPage(currentPageId);
    updatePage(currentPageId, { content: [...record.content, ...blocks] });
    await flushPatch(currentPageId);
    reloadPageContent(currentPageId);
    setAiOpen(false);
  };

  const canAppendCurrent =
    Boolean(currentPage && currentPage.kind === "page" && !currentPage.trashed && !currentPage.locked);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setAiOpen(false)}>
      <div
        className="ai-modal"
        role="dialog"
        aria-modal="true"
        aria-label="AI 助手"
        data-ai-modal-state={running ? "streaming" : "idle"}
      >
        <header className="ai-modal-head">
          <span className="ai-brand">
            <Sparkles size={16} /> AI 助手
          </span>
          <div className="ai-scope-tabs" role="tablist" aria-label="问答范围">
            <button
              type="button"
              className={cx("ai-scope-tab", scope === "workspace" && "active")}
              onClick={() => setScope("workspace")}
            >
              全工作区问答
            </button>
            {currentPage && (
              <button
                type="button"
                className={cx("ai-scope-tab", scope === "page" && "active")}
                onClick={() => setScope("page")}
              >
                当前页面
              </button>
            )}
            <button
              type="button"
              className={cx("ai-scope-tab", scope === "none" && "active")}
              onClick={() => setScope("none")}
            >
              自由对话
            </button>
          </div>
          <div className="ai-head-right">
            {cfg && (
              <select
                className="ai-model-select"
                aria-label="切换模型"
                value={`${cfg.activeProviderId}::${cfg.activeModel}`}
                onChange={(e) => {
                  const [providerId, model] = e.target.value.split("::");
                  void saveAiConfig({ activeProviderId: providerId, activeModel: model });
                }}
              >
                {cfg.providers.map((p) => (
                  <optgroup
                    key={p.id}
                    label={`${p.name}${p.hasKey || p.keyOptional ? "" : "（未配 Key）"}`}
                  >
                    {p.models.map((m) => (
                      <option key={`${p.id}::${m}`} value={`${p.id}::${m}`}>
                        {p.name.replace(/（.+）/, "")} · {m}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            <button
              type="button"
              className="text-btn small"
              title="配置国产、国外或自定义大模型"
              onClick={() => setAiSettingsOpen(true)}
            >
              <Settings2 size={14} /> 模型设置
            </button>
            {turns.length > 0 && (
              <button type="button" className="icon-btn small" title="清空对话" aria-label="清空对话" onClick={() => setTurns([])}>
                <Eraser size={15} />
              </button>
            )}
            <button type="button" className="icon-btn small" aria-label="关闭" onClick={() => setAiOpen(false)}>
              <X size={16} />
            </button>
          </div>
        </header>

        {!configured && (
          <div className="ai-setup-banner">
            <span>
              当前选中的 <strong>{activeProvider?.name ?? "模型"}</strong> 还未填写 API Key（支持 DeepSeek、Kimi、豆包、通义千问、Claude、OpenAI、Gemini、Ollama 及任意自定义接口）。
            </span>
            <button type="button" className="primary-btn small" onClick={() => setAiSettingsOpen(true)}>
              去配置模型
            </button>
          </div>
        )}

        <div className="ai-messages" ref={scrollRef}>
          {turns.length === 0 ? (
            <div className="ai-welcome">
              <div className="ai-welcome-title">有什么可以帮你？</div>
              <p className="ai-welcome-sub">
                可检索本地笔记与数据库回答问题，或直接起草、总结、翻译文档。在编辑器里输入 <code>/ai</code> 也能就地续写和改写。
              </p>
              <div className="ai-starter-grid">
                {STARTERS.filter((s) => s.scope !== "page" || currentPage).map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className="ai-starter-card"
                    onClick={() => void sendPrompt(s.prompt, s.scope)}
                  >
                    <strong>{s.label}</strong>
                    <span>{s.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className={cx("ai-turn", `ai-turn-${turn.role}`)}>
                <div className="ai-turn-role">{turn.role === "user" ? "你" : "AI"}</div>
                <div className="ai-turn-body">
                  {turn.citations && turn.citations.length > 0 && (
                    <div className="ai-citations">
                      <span>参考页面：</span>
                      {turn.citations.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="row-chip row-chip-button"
                          onClick={() => {
                            setAiOpen(false);
                            navigate(c.id);
                          }}
                        >
                          <span className="row-chip-icon">{c.icon ?? <FileText size={12} />}</span>
                          <span className="tag-name">{c.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {turn.reasoning && (
                    <details className="ai-reasoning">
                      <summary>思考过程</summary>
                      <pre>{turn.reasoning}</pre>
                    </details>
                  )}
                  {turn.error ? (
                    <div className="value-error">
                      {turn.error}{" "}
                      <button type="button" className="text-btn small" onClick={() => setAiSettingsOpen(true)}>
                        打开模型设置
                      </button>
                    </div>
                  ) : turn.content ? (
                    <div className="ai-markdown">{turn.content}</div>
                  ) : (
                    <span className="ai-thinking">
                      <LoaderCircle size={14} className="spin" /> 正在思考…
                    </span>
                  )}
                  {turn.role === "assistant" && turn.content && !running && (
                    <div className="ai-turn-actions">
                      <button
                        type="button"
                        className="text-btn small"
                        onClick={() => {
                          void navigator.clipboard?.writeText(turn.content);
                          setCopiedId(turn.id);
                          window.setTimeout(() => setCopiedId(null), 1500);
                        }}
                      >
                        {copiedId === turn.id ? <Check size={13} /> : <Copy size={13} />} 复制
                      </button>
                      <button type="button" className="text-btn small" onClick={() => void saveAsNewPage(turn.content)}>
                        <FilePlus2 size={13} /> 存为新页面
                      </button>
                      {canAppendCurrent && (
                        <button
                          type="button"
                          className="text-btn small"
                          onClick={() => void appendToCurrentPage(turn.content)}
                        >
                          插入当前页末尾
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <form
          className="ai-input-bar"
          onSubmit={(e) => {
            e.preventDefault();
            void sendPrompt();
          }}
        >
          <textarea
            autoFocus
            rows={2}
            value={input}
            placeholder={
              scope === "workspace"
                ? "向整个本地工作区提问，或让 AI 帮你整理资料…（Enter 发送，Shift+Enter 换行）"
                : scope === "page"
                  ? `围绕《${currentPage?.title || "当前页面"}》提问或生成内容…`
                  : "输入任何问题或写作要求…"
            }
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendPrompt();
              }
            }}
          />
          {running ? (
            <button type="button" className="primary-btn small danger-btn" onClick={stop}>
              <Square size={13} /> 停止
            </button>
          ) : (
            <button type="submit" className="primary-btn small" disabled={!input.trim()}>
              <Send size={14} /> 发送
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
