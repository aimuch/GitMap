import { useEffect, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type { AiConfigPublic, AiProtocol, AiProviderPublic, AiProviderUpdate, AiRegion } from "../../shared/types";
import { fetchRemoteModels, loadAiConfig, saveAiConfig, testAiProvider } from "../ai";
import { shortId } from "../db";
import { cx } from "./Popover";

interface DraftProvider extends AiProviderPublic {
  draftKey: string;
  clearKey: boolean;
  headersText: string;
}

function headersToText(headers?: Record<string, string>): string {
  if (!headers) return "";
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function textToHeaders(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && v) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function toDrafts(cfg: AiConfigPublic): DraftProvider[] {
  return cfg.providers.map((p) => ({
    ...p,
    models: [...p.models],
    draftKey: "",
    clearKey: false,
    headersText: headersToText(p.headers),
  }));
}

function toUpdates(drafts: DraftProvider[]): AiProviderUpdate[] {
  return drafts.map((d) => ({
    id: d.id,
    name: d.name,
    region: d.region,
    builtin: d.builtin,
    protocol: d.protocol,
    baseUrl: d.baseUrl,
    models: d.models,
    keyOptional: d.keyOptional,
    apiKey: d.clearKey ? "__CLEAR__" : d.draftKey.trim() || undefined,
    headers: textToHeaders(d.headersText),
  }));
}

const REGION_TITLES: { region: AiRegion; label: string }[] = [
  { region: "domestic", label: "国产大模型" },
  { region: "foreign", label: "国外主流模型" },
  { region: "custom", label: "本地与自定义模型" },
];

export function AiSettingsModal({ onClose }: { onClose: () => void }) {
  const [drafts, setDrafts] = useState<DraftProvider[]>([]);
  const [selectedId, setSelectedId] = useState<string>("deepseek");
  const [activeProviderId, setActiveProviderId] = useState<string>("deepseek");
  const [activeModel, setActiveModel] = useState<string>("");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string>("");
  const [showKey, setShowKey] = useState(false);
  const [newModel, setNewModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    loadAiConfig().then(
      (cfg) => {
        if (!alive) return;
        setDrafts(toDrafts(cfg));
        setSelectedId(cfg.activeProviderId);
        setActiveProviderId(cfg.activeProviderId);
        setActiveModel(cfg.activeModel);
        setTemperature(cfg.temperature);
        setCustomSystemPrompt(cfg.customSystemPrompt);
      },
      (err: Error) => alive && setStatus({ ok: false, text: err.message }),
    );
    return () => {
      alive = false;
    };
  }, []);

  const current = drafts.find((d) => d.id === selectedId) ?? drafts[0];

  const patchCurrent = (change: Partial<DraftProvider>) => {
    if (!current) return;
    setDrafts((prev) => prev.map((d) => (d.id === current.id ? { ...d, ...change } : d)));
    setStatus(null);
  };

  const addCustomProvider = () => {
    const id = `custom_${shortId()}`;
    const created: DraftProvider = {
      id,
      name: "自定义模型服务",
      region: "custom",
      builtin: false,
      protocol: "openai",
      baseUrl: "https://api.example.com/v1",
      models: ["gpt-4o-mini"],
      keyOptional: false,
      hasKey: false,
      keyHint: "",
      draftKey: "",
      clearKey: false,
      headersText: "",
    };
    setDrafts((prev) => [...prev, created]);
    setSelectedId(id);
    setStatus(null);
  };

  const removeCustomProvider = () => {
    if (!current || current.builtin) return;
    const next = drafts.filter((d) => d.id !== current.id);
    setDrafts(next);
    const fallback = next[0];
    if (fallback) {
      setSelectedId(fallback.id);
      if (activeProviderId === current.id) {
        setActiveProviderId(fallback.id);
        setActiveModel(fallback.models[0] ?? "");
      }
    }
  };

  const addModel = () => {
    if (!current) return;
    const m = newModel.trim();
    if (!m) return;
    const models = current.models.includes(m) ? current.models : [...current.models, m];
    patchCurrent({ models });
    setActiveProviderId(current.id);
    setActiveModel(m);
    setNewModel("");
  };

  const pullModels = async () => {
    if (!current) return;
    setFetchingModels(true);
    setStatus(null);
    try {
      const remote = await fetchRemoteModels({
        providerId: current.builtin ? current.id : undefined,
        protocol: current.protocol,
        baseUrl: current.baseUrl,
        apiKey: current.draftKey.trim() || undefined,
        headers: textToHeaders(current.headersText),
      });
      if (remote.length === 0) {
        setStatus({ ok: false, text: "接口未返回可用模型列表，可手动输入模型名称添加。" });
      } else {
        const merged = [...new Set([...current.models, ...remote.slice(0, 60)])];
        patchCurrent({ models: merged });
        if (!activeModel || activeProviderId === current.id) setActiveModel(remote[0]);
        setStatus({ ok: true, text: `已从接口同步 ${remote.length} 个模型` });
      }
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setFetchingModels(false);
    }
  };

  const runTest = async () => {
    if (!current) return;
    setTesting(true);
    setStatus(null);
    try {
      const modelToTest =
        activeProviderId === current.id && activeModel ? activeModel : (current.models[0] ?? newModel.trim());
      // 先落盘保存，确保后端能拿到已保存或新填写的 Key
      const saved = await saveAiConfig({
        providers: toUpdates(drafts),
        activeProviderId,
        activeModel,
        temperature,
        customSystemPrompt,
      });
      setDrafts(toDrafts(saved));
      const res = await testAiProvider({
        providerId: current.id,
        model: modelToTest,
        protocol: current.protocol,
        baseUrl: current.baseUrl,
        headers: textToHeaders(current.headersText),
      });
      setStatus({ ok: true, text: `连接正常（${res.ms} ms · ${res.model}）：${res.reply}` });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  const saveAndClose = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await saveAiConfig({
        providers: toUpdates(drafts),
        activeProviderId,
        activeModel,
        temperature,
        customSystemPrompt,
      });
      onClose();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ai-settings-modal" role="dialog" aria-modal="true" aria-label="AI 模型设置">
        <aside className="ai-settings-side">
          <div className="ai-settings-head">
            <Settings2 size={16} /> AI 模型设置
          </div>
          <div className="ai-provider-list">
            {REGION_TITLES.map(({ region, label }) => {
              const items = drafts.filter((d) => d.region === region);
              return (
                <div key={region} className="ai-provider-group">
                  <div className="ai-provider-group-title">{label}</div>
                  {items.map((p) => {
                    const configured = (p.hasKey && !p.clearKey) || Boolean(p.draftKey.trim()) || Boolean(p.keyOptional);
                    const isDefault = p.id === activeProviderId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={cx("ai-provider-item", p.id === current?.id && "active")}
                        onClick={() => {
                          setSelectedId(p.id);
                          setStatus(null);
                        }}
                      >
                        <span className={cx("ai-dot", configured && "ready")} />
                        <span className="ai-provider-name">{p.name}</span>
                        {isDefault && <span className="tree-badge">当前</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <button type="button" className="text-btn ai-add-provider" onClick={addCustomProvider}>
            <Plus size={14} /> 添加自定义模型服务
          </button>
        </aside>

        <div className="ai-settings-main">
          <div className="ai-settings-top">
            <div>
              <h2>{current?.name ?? "模型配置"}</h2>
              <p className="ai-settings-sub">
                密钥仅加密权限（0600）保存在本机 <code>data/ai.json</code> 中，请求由本机直连模型接口，不经过任何第三方服务器。
              </p>
            </div>
            <button type="button" className="icon-btn" aria-label="关闭" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {current && (
            <div className="ai-settings-body">
              {!current.builtin && (
                <div className="ai-form-row two-col">
                  <label className="ai-field">
                    <span>服务名称</span>
                    <input
                      value={current.name}
                      placeholder="例如：硅基流动 / OpenRouter / 公司网关"
                      onChange={(e) => patchCurrent({ name: e.target.value })}
                    />
                  </label>
                  <label className="ai-field">
                    <span>接口协议</span>
                    <select
                      value={current.protocol}
                      onChange={(e) => patchCurrent({ protocol: e.target.value as AiProtocol })}
                    >
                      <option value="openai">OpenAI 兼容 (/chat/completions)</option>
                      <option value="anthropic">Anthropic Messages (/messages)</option>
                      <option value="gemini">Google Gemini (generateContent)</option>
                    </select>
                  </label>
                </div>
              )}

              <label className="ai-field">
                <span className="ai-field-head">
                  <span>接口地址（Base URL）</span>
                  {current.defaultBaseUrl && current.baseUrl !== current.defaultBaseUrl && (
                    <button
                      type="button"
                      className="text-btn small"
                      onClick={() => patchCurrent({ baseUrl: current.defaultBaseUrl! })}
                    >
                      <RotateCcw size={12} /> 恢复默认
                    </button>
                  )}
                </span>
                <input
                  value={current.baseUrl}
                  placeholder="https://api.deepseek.com/v1"
                  spellCheck={false}
                  onChange={(e) => patchCurrent({ baseUrl: e.target.value })}
                />
              </label>

              <div className="ai-field">
                <span className="ai-field-head">
                  <span>
                    API Key
                    {current.hasKey && !current.clearKey && !current.draftKey && (
                      <em className="ai-key-saved">已保存：{current.keyHint}</em>
                    )}
                  </span>
                  <span className="ai-field-actions">
                    {!current.builtin && (
                      <label className="ai-inline-check">
                        <input
                          type="checkbox"
                          checked={Boolean(current.keyOptional)}
                          onChange={(e) => patchCurrent({ keyOptional: e.target.checked })}
                        />
                        免 Key（本地服务）
                      </label>
                    )}
                    {current.hasKey && !current.clearKey && (
                      <button
                        type="button"
                        className="text-btn small danger"
                        onClick={() => patchCurrent({ clearKey: true, draftKey: "" })}
                      >
                        清除已存 Key
                      </button>
                    )}
                  </span>
                </span>
                <div className="ai-key-input">
                  <input
                    type={showKey ? "text" : "password"}
                    value={current.draftKey}
                    placeholder={
                      current.hasKey && !current.clearKey
                        ? "留空则继续使用已保存的 Key，输入新值可替换"
                        : (current.keyPlaceholder ?? "输入 API Key…")
                    }
                    spellCheck={false}
                    onChange={(e) => patchCurrent({ draftKey: e.target.value, clearKey: false })}
                  />
                  <button
                    type="button"
                    className="icon-btn small"
                    aria-label={showKey ? "隐藏密钥" : "显示密钥"}
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="ai-field">
                <span className="ai-field-head">
                  <span>可用模型（点击设为当前默认使用的模型）</span>
                  <button
                    type="button"
                    className="text-btn small"
                    disabled={fetchingModels}
                    onClick={() => void pullModels()}
                  >
                    {fetchingModels ? <LoaderCircle size={13} className="spin" /> : <RefreshCw size={13} />} 从接口获取模型
                  </button>
                </span>
                {current.modelHint && <div className="ai-hint">{current.modelHint}</div>}
                <div className="ai-models-wrap">
                  {current.models.map((m) => {
                    const selected = activeProviderId === current.id && activeModel === m;
                    return (
                      <span key={m} className={cx("ai-model-chip", selected && "selected")}>
                        <button
                          type="button"
                          className="ai-model-pick"
                          onClick={() => {
                            setActiveProviderId(current.id);
                            setActiveModel(m);
                          }}
                        >
                          {selected ? <Check size={13} /> : <Sparkles size={12} />}
                          <span>{m}</span>
                        </button>
                        {current.models.length > 1 && (
                          <button
                            type="button"
                            className="tag-remove"
                            aria-label={`移除模型 ${m}`}
                            onClick={() => {
                              const nextModels = current.models.filter((x) => x !== m);
                              patchCurrent({ models: nextModels });
                              if (selected) setActiveModel(nextModels[0] ?? "");
                            }}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
                <div className="ai-add-model">
                  <input
                    value={newModel}
                    placeholder="输入自定义模型 ID 或接入点 ID（如 deepseek-v3 / ep-2026...）后回车添加"
                    spellCheck={false}
                    onChange={(e) => setNewModel(e.target.value)}
                    onKeyDown={(e) => {
                      if (!e.nativeEvent.isComposing && e.key === "Enter") {
                        e.preventDefault();
                        addModel();
                      }
                    }}
                  />
                  <button type="button" className="text-btn" onClick={addModel}>
                    <Plus size={14} /> 添加模型
                  </button>
                </div>
              </div>

              <details className="ai-advanced">
                <summary>高级设置（自定义请求头、温度、全局提示词）</summary>
                <div className="ai-advanced-body">
                  <label className="ai-field">
                    <span>自定义请求头（可选，每行一个 `Header: Value`）</span>
                    <textarea
                      rows={2}
                      spellCheck={false}
                      placeholder="例如：HTTP-Referer: https://opennotion.local"
                      value={current.headersText}
                      onChange={(e) => patchCurrent({ headersText: e.target.value })}
                    />
                  </label>
                  <div className="ai-form-row two-col">
                    <label className="ai-field">
                      <span>生成温度（Temperature：{temperature.toFixed(1)}）</span>
                      <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.1}
                        value={temperature}
                        onChange={(e) => setTemperature(Number(e.target.value))}
                      />
                    </label>
                    <label className="ai-field">
                      <span>当前默认模型</span>
                      <input
                        readOnly
                        value={`${drafts.find((d) => d.id === activeProviderId)?.name ?? activeProviderId} · ${activeModel}`}
                      />
                    </label>
                  </div>
                  <label className="ai-field">
                    <span>全局附加指令（可选，对所有 AI 对话与写作生效）</span>
                    <textarea
                      rows={2}
                      placeholder="例如：默认使用简体中文回答，行文尽量克制精炼。"
                      value={customSystemPrompt}
                      onChange={(e) => setCustomSystemPrompt(e.target.value)}
                    />
                  </label>
                </div>
              </details>

              {status && (
                <div className={cx("ai-status", status.ok ? "ok" : "err")} role="status">
                  {status.text}
                </div>
              )}
            </div>
          )}

          <div className="ai-settings-foot">
            <div className="ai-settings-foot-left">
              <button type="button" className="text-btn" disabled={testing} onClick={() => void runTest()}>
                {testing ? <LoaderCircle size={14} className="spin" /> : <Zap size={14} />} 测试连接
              </button>
              {current && !current.builtin && (
                <button type="button" className="text-btn danger" onClick={removeCustomProvider}>
                  <Trash2 size={14} /> 删除此服务
                </button>
              )}
            </div>
            <div className="ai-settings-foot-right">
              <button type="button" className="text-btn" onClick={onClose}>
                取消
              </button>
              <button type="button" className="primary-btn" disabled={saving} onClick={() => void saveAndClose()}>
                {saving ? "保存中…" : "保存设置"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
