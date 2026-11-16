import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  CornerDownLeft,
  LoaderCircle,
  Replace,
  RotateCcw,
  Settings2,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import type { AiChatMessage } from "../../shared/types";
import { AI_ACTIONS, loadAiConfig, streamAiChat, useAiConfig, type AiActionPreset } from "../ai";
import { setAiSettingsOpen } from "../store";

interface Props {
  pageTitle: string;
  selectedText: string;
  initialActionId?: string | null;
  getPageMarkdown: () => string;
  onInsert: (markdown: string, mode: "insert" | "replace") => Promise<void>;
  onClose: () => void;
}

export function AiInlineBar({
  pageTitle,
  selectedText,
  initialActionId,
  getPageMarkdown,
  onInsert,
  onClose,
}: Props) {
  const cfg = useAiConfig();
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<AiChatMessage[]>([]);
  const lastPromptRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cfg) void loadAiConfig().catch(() => {});
  }, [cfg]);

  const runWithMessages = async (messages: AiChatMessage[]) => {
    setRunning(true);
    setError(null);
    setOutput("");
    setReasoning("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const full = await streamAiChat({
        messages,
        signal: ctrl.signal,
        onReasoning: (_d, r) => setReasoning(r),
        onDelta: (_d, t) => setOutput(t),
      });
      setHistory([...messages, { role: "assistant", content: full }]);
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const runAction = (action: AiActionPreset) => {
    const source =
      action.group === "page"
        ? getPageMarkdown()
        : (selectedText.trim() || getPageMarkdown());
    const userPrompt = action.buildPrompt(source, pageTitle);
    lastPromptRef.current = userPrompt;
    void runWithMessages([{ role: "user", content: userPrompt }]);
  };

  useEffect(() => {
    if (initialActionId) {
      const preset = AI_ACTIONS.find((a) => a.id === initialActionId);
      if (preset) {
        runAction(preset);
        return;
      }
    }
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitFreePrompt = () => {
    const text = prompt.trim();
    if (!text || running) return;
    setPrompt("");
    if (history.length > 0 && output) {
      // 在已有生成结果的基础上继续追问修改
      const next: AiChatMessage[] = [
        ...history,
        { role: "user", content: `请按以下修改意见调整刚才生成的内容，直接输出修改后的完整正文：\n${text}` },
      ];
      void runWithMessages(next);
      return;
    }
    const context = selectedText.trim()
      ? `选中文本：\n${selectedText}\n\n`
      : getPageMarkdown().trim()
        ? `当前页面《${pageTitle || "无标题"}》已有内容参考：\n${getPageMarkdown().slice(0, 5000)}\n\n`
        : `当前页面标题：${pageTitle || "无标题"}\n\n`;
    const fullPrompt = `${context}写作要求：${text}`;
    lastPromptRef.current = fullPrompt;
    void runWithMessages([{ role: "user", content: fullPrompt }]);
  };

  const activeProvider = cfg?.providers.find((p) => p.id === cfg.activeProviderId) ?? cfg?.providers[0];
  const hasSelection = Boolean(selectedText.trim());

  return (
    <div className="ai-inline" role="region" aria-label="AI 写作助手">
      <div className="ai-inline-top">
        <Sparkles size={15} className="ai-inline-icon" />
        <input
          ref={inputRef}
          value={prompt}
          placeholder={
            output
              ? "输入修改意见（例如“再简短一点”、“改成表格”）后回车…"
              : hasSelection
                ? "告诉 AI 如何处理选中的内容，或点下方快捷操作…"
                : "告诉 AI 要写什么，或点下方快捷指令…"
          }
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              submitFreePrompt();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              abortRef.current?.abort();
              onClose();
            }
          }}
        />
        <button
          type="button"
          className="ai-model-pill"
          title="切换或配置大模型"
          onClick={() => setAiSettingsOpen(true)}
        >
          <Settings2 size={12} />
          <span>{cfg ? `${activeProvider?.name.replace(/（.+）/, "") ?? ""} · ${cfg.activeModel}` : "模型设置"}</span>
        </button>
        {running ? (
          <button
            type="button"
            className="text-btn small danger"
            onClick={() => {
              abortRef.current?.abort();
              setRunning(false);
            }}
          >
            <Square size={12} /> 停止
          </button>
        ) : (
          <button type="button" className="primary-btn small" disabled={!prompt.trim()} onClick={submitFreePrompt}>
            生成
          </button>
        )}
        <button type="button" className="icon-btn small" aria-label="关闭 AI 助手" onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      {hasSelection && !output && !running && (
        <div className="ai-inline-selection">已选中 {selectedText.trim().length} 字：{selectedText.trim().slice(0, 70)}{selectedText.trim().length > 70 ? "…" : ""}</div>
      )}

      {(running || output || error) && (
        <div className="ai-inline-preview">
          {reasoning && (
            <details className="ai-reasoning">
              <summary>思考过程</summary>
              <pre>{reasoning}</pre>
            </details>
          )}
          {error ? (
            <div className="value-error">
              {error}{" "}
              <button type="button" className="text-btn small" onClick={() => setAiSettingsOpen(true)}>
                去配置 API Key
              </button>
            </div>
          ) : output ? (
            <div className="ai-markdown">{output}</div>
          ) : (
            <div className="ai-thinking">
              <LoaderCircle size={14} className="spin" /> 正在生成…
            </div>
          )}
        </div>
      )}

      {!running && output && (
        <div className="ai-inline-actions">
          <button type="button" className="primary-btn small" onClick={() => void onInsert(output, "insert")}>
            <CornerDownLeft size={13} /> 插入正文
          </button>
          {hasSelection && (
            <button type="button" className="text-btn small" onClick={() => void onInsert(output, "replace")}>
              <Replace size={13} /> 替换选中内容
            </button>
          )}
          <button
            type="button"
            className="text-btn small"
            onClick={() => {
              if (lastPromptRef.current) void runWithMessages([{ role: "user", content: lastPromptRef.current }]);
            }}
          >
            <RotateCcw size={13} /> 重试
          </button>
          <button
            type="button"
            className="text-btn small"
            onClick={() => {
              void navigator.clipboard?.writeText(output);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} 复制
          </button>
          <button type="button" className="text-btn small danger" onClick={onClose}>
            弃用
          </button>
        </div>
      )}

      {!running && !output && (
        <div className="ai-inline-presets">
          {hasSelection && (
            <div className="ai-preset-group">
              <span className="ai-preset-label">改写选中</span>
              {AI_ACTIONS.filter((a) => a.group === "selection").map((a) => (
                <button key={a.id} type="button" className="ai-preset-btn" onClick={() => runAction(a)}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <div className="ai-preset-group">
            <span className="ai-preset-label">当前页面</span>
            {AI_ACTIONS.filter((a) => a.group === "page").map((a) => (
              <button key={a.id} type="button" className="ai-preset-btn" onClick={() => runAction(a)}>
                {a.label}
              </button>
            ))}
          </div>
          <div className="ai-preset-group">
            <span className="ai-preset-label">翻译</span>
            {AI_ACTIONS.filter((a) => a.group === "translate").map((a) => (
              <button key={a.id} type="button" className="ai-preset-btn" onClick={() => runAction(a)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
