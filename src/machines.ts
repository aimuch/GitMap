/**
 * 应用内核心状态机定义与纯状态转移函数。
 *
 * 用可辨识联合类型（Discriminated Unions）替代零散的布尔值与模块级可变变量，
 * 从类型层面消除“既在加载又已报错”“弹层多层同时响应 Esc 关闭”“跨数据库误拖拽”等非法状态，
 * 同时为界面提供统一的 data-* 状态标记与只读诊断快照。
 */
import { useCallback, useReducer } from "react";
import type { AiChatMessage, HistoryEntry, PageRecord } from "../shared/types";
import type { ImportResult } from "./notionImport";

/** 轻量状态机 Hook：用纯 reducer 驱动显式事件转移 */
export function useMachine<S, E>(reducer: (state: S, event: E) => S, initial: S): [S, (event: E) => void] {
  const [state, dispatch] = useReducer(reducer, initial);
  const send = useCallback((event: E) => dispatch(event), []);
  return [state, send];
}

/* =========================================================
 * 1. 页面持久化保存状态机（Per-Page & Global Save Machine）
 * ========================================================= */

export type PageSavePhase = "debouncing" | "saving" | "error";

export type SaveSummary =
  | { phase: "idle" }
  | { phase: "saving"; count: number }
  | { phase: "error"; message: string; failedIds: string[] };

export function summarizeSaveStates(
  perPage: ReadonlyMap<string, { phase: PageSavePhase; error?: string }>,
): SaveSummary {
  let activeCount = 0;
  const failedIds: string[] = [];
  let lastError = "";
  for (const [id, entry] of perPage) {
    if (entry.phase === "debouncing" || entry.phase === "saving") activeCount++;
    else if (entry.phase === "error") {
      failedIds.push(id);
      if (entry.error) lastError = entry.error;
    }
  }
  if (activeCount > 0) return { phase: "saving", count: activeCount };
  if (failedIds.length > 0) {
    return { phase: "error", message: lastError || "保存失败，点击重试", failedIds };
  }
  return { phase: "idle" };
}

/* =========================================================
 * 2. 全局浮层与弹窗栈状态机（Overlay & Modal Stack Machine）
 *    规则：搜索弹窗与 AI 助手互斥；AI 设置可叠在最上层；
 *    按 Esc 时严格按“最上层优先（LIFO）”逐层关闭，绝不一次关光。
 * ========================================================= */

export type PrimaryModal = "none" | "search" | "ai";

export interface OverlayState {
  modal: PrimaryModal;
  aiSettings: boolean;
  peekRowId: string | null;
}

export type OverlayEvent =
  | { type: "OPEN_SEARCH" }
  | { type: "CLOSE_SEARCH" }
  | { type: "TOGGLE_SEARCH" }
  | { type: "OPEN_AI" }
  | { type: "CLOSE_AI" }
  | { type: "TOGGLE_AI" }
  | { type: "OPEN_AI_SETTINGS" }
  | { type: "CLOSE_AI_SETTINGS" }
  | { type: "OPEN_PEEK"; rowId: string }
  | { type: "CLOSE_PEEK" }
  | { type: "ESCAPE" }
  | { type: "NAVIGATED" };

export const INITIAL_OVERLAY_STATE: OverlayState = {
  modal: "none",
  aiSettings: false,
  peekRowId: null,
};

export function transitionOverlay(state: OverlayState, event: OverlayEvent): OverlayState {
  switch (event.type) {
    case "OPEN_SEARCH":
      return { ...state, modal: "search", aiSettings: false };
    case "CLOSE_SEARCH":
      return state.modal === "search" ? { ...state, modal: "none" } : state;
    case "TOGGLE_SEARCH":
      return state.modal === "search"
        ? { ...state, modal: "none" }
        : { ...state, modal: "search", aiSettings: false };
    case "OPEN_AI":
      return { ...state, modal: "ai" };
    case "CLOSE_AI":
      return state.modal === "ai" ? { ...state, modal: "none" } : state;
    case "TOGGLE_AI":
      return state.modal === "ai" ? { ...state, modal: "none" } : { ...state, modal: "ai" };
    case "OPEN_AI_SETTINGS":
      return { ...state, aiSettings: true };
    case "CLOSE_AI_SETTINGS":
      return state.aiSettings ? { ...state, aiSettings: false } : state;
    case "OPEN_PEEK":
      return { ...state, peekRowId: event.rowId };
    case "CLOSE_PEEK":
      return state.peekRowId ? { ...state, peekRowId: null } : state;
    case "NAVIGATED":
      return { ...state, modal: "none", peekRowId: null };
    case "ESCAPE":
      if (state.aiSettings) return { ...state, aiSettings: false };
      if (state.modal !== "none") return { ...state, modal: "none" };
      if (state.peekRowId) return { ...state, peekRowId: null };
      return state;
  }
}

export function topOverlayName(state: OverlayState): "ai-settings" | "search" | "ai" | "peek" | "none" {
  if (state.aiSettings) return "ai-settings";
  if (state.modal !== "none") return state.modal;
  if (state.peekRowId) return "peek";
  return "none";
}

/* =========================================================
 * 3. 页面正文异步加载与编辑状态机（Page Document Load Machine）
 * ========================================================= */

export type PageLoadState =
  | { status: "loading" }
  | { status: "ready"; record: PageRecord; dirty: boolean }
  | { status: "error"; message: string };

export type PageLoadEvent =
  | { type: "RELOAD" }
  | { type: "LOADED"; record: PageRecord }
  | { type: "FAILED"; message: string }
  | { type: "MARK_DIRTY" };

export function transitionPageLoad(state: PageLoadState, event: PageLoadEvent): PageLoadState {
  switch (event.type) {
    case "RELOAD":
      return { status: "loading" };
    case "LOADED":
      return { status: "ready", record: event.record, dirty: false };
    case "FAILED":
      return { status: "error", message: event.message };
    case "MARK_DIRTY":
      return state.status === "ready" && !state.dirty ? { ...state, dirty: true } : state;
  }
}

/* =========================================================
 * 4. 内联 AI 生成与改写状态机（Inline AI Session Machine）
 * ========================================================= */

export type AiInlineState =
  | { phase: "idle" }
  | { phase: "streaming"; output: string; reasoning: string; baseHistory: AiChatMessage[] }
  | { phase: "ready"; output: string; reasoning: string; history: AiChatMessage[] }
  | { phase: "applying"; output: string; reasoning: string; history: AiChatMessage[] }
  | { phase: "error"; message: string; history: AiChatMessage[] };

export type AiInlineEvent =
  | { type: "START"; messages: AiChatMessage[] }
  | { type: "REASONING"; full: string }
  | { type: "DELTA"; full: string }
  | { type: "COMPLETE"; full: string }
  | { type: "STOP" }
  | { type: "FAIL"; message: string }
  | { type: "APPLY_START" }
  | { type: "APPLY_FAIL"; message: string };

export function transitionAiInline(state: AiInlineState, event: AiInlineEvent): AiInlineState {
  switch (event.type) {
    case "START":
      return { phase: "streaming", output: "", reasoning: "", baseHistory: event.messages };
    case "REASONING":
      return state.phase === "streaming" ? { ...state, reasoning: event.full } : state;
    case "DELTA":
      return state.phase === "streaming" ? { ...state, output: event.full } : state;
    case "COMPLETE": {
      if (state.phase !== "streaming") return state;
      const text = event.full || state.output;
      return {
        phase: "ready",
        output: text,
        reasoning: state.reasoning,
        history: [...state.baseHistory, { role: "assistant", content: text }],
      };
    }
    case "STOP": {
      if (state.phase !== "streaming") return state;
      if (!state.output.trim()) return { phase: "idle" };
      // 用户中途点停止时保留已流式输出的半截结果，允许继续追问或直接插入
      return {
        phase: "ready",
        output: state.output,
        reasoning: state.reasoning,
        history: [...state.baseHistory, { role: "assistant", content: state.output }],
      };
    }
    case "FAIL": {
      const history =
        state.phase === "streaming"
          ? state.baseHistory
          : state.phase === "ready" || state.phase === "applying" || state.phase === "error"
            ? state.history
            : [];
      return { phase: "error", message: event.message, history };
    }
    case "APPLY_START":
      return state.phase === "ready" ? { ...state, phase: "applying" } : state;
    case "APPLY_FAIL":
      return state.phase === "applying" ? { phase: "error", message: event.message, history: state.history } : state;
  }
}

/* =========================================================
 * 5. 页面历史版本预览与恢复状态机（History Modal Machine）
 * ========================================================= */

export type HistoryPreviewState =
  | { status: "loading" }
  | { status: "ready"; record: PageRecord }
  | { status: "restoring"; record: PageRecord }
  | { status: "error"; message: string };

export type HistoryModalState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "loaded"; versions: HistoryEntry[]; selectedTs: number; preview: HistoryPreviewState };

export type HistoryModalEvent =
  | { type: "LIST_LOADED"; versions: HistoryEntry[] }
  | { type: "LIST_FAILED"; message: string }
  | { type: "SELECT_VERSION"; ts: number }
  | { type: "VERSION_LOADED"; ts: number; record: PageRecord }
  | { type: "VERSION_FAILED"; ts: number; message: string }
  | { type: "RESTORE_START" }
  | { type: "RESTORE_FAILED"; message: string };

export function transitionHistory(state: HistoryModalState, event: HistoryModalEvent): HistoryModalState {
  switch (event.type) {
    case "LIST_LOADED":
      if (event.versions.length === 0) return { status: "empty" };
      return {
        status: "loaded",
        versions: event.versions,
        selectedTs: event.versions[0].ts,
        preview: { status: "loading" },
      };
    case "LIST_FAILED":
      return { status: "error", message: event.message };
    case "SELECT_VERSION":
      if (state.status !== "loaded" || state.preview.status === "restoring") return state;
      if (state.selectedTs === event.ts && state.preview.status === "ready") return state;
      return { ...state, selectedTs: event.ts, preview: { status: "loading" } };
    case "VERSION_LOADED":
      if (state.status !== "loaded" || state.selectedTs !== event.ts) return state;
      return { ...state, preview: { status: "ready", record: event.record } };
    case "VERSION_FAILED":
      if (state.status !== "loaded" || state.selectedTs !== event.ts) return state;
      return { ...state, preview: { status: "error", message: event.message } };
    case "RESTORE_START":
      if (state.status !== "loaded" || state.preview.status !== "ready") return state;
      return { ...state, preview: { status: "restoring", record: state.preview.record } };
    case "RESTORE_FAILED":
      if (state.status !== "loaded") return state;
      return { ...state, preview: { status: "error", message: event.message } };
  }
}

/* =========================================================
 * 6. Notion 导出包导入状态机（Zip Import Machine）
 * ========================================================= */

export type ImportModalState =
  | { status: "idle" }
  | { status: "running"; text: string }
  | { status: "done"; result: ImportResult }
  | { status: "error"; message: string };

export type ImportModalEvent =
  | { type: "START" }
  | { type: "PROGRESS"; text: string }
  | { type: "SUCCEED"; result: ImportResult }
  | { type: "FAIL"; message: string }
  | { type: "DISMISS" };

export function transitionImport(state: ImportModalState, event: ImportModalEvent): ImportModalState {
  switch (event.type) {
    case "START":
      return state.status === "running" ? state : { status: "running", text: "正在读取压缩包…" };
    case "PROGRESS":
      return state.status === "running" ? { status: "running", text: event.text } : state;
    case "SUCCEED":
      return { status: "done", result: event.result };
    case "FAIL":
      return { status: "error", message: event.message };
    case "DISMISS":
      // 正在导入中时不允许误触背景或按 Esc 半途关闭弹层
      return state.status === "running" ? state : { status: "idle" };
  }
}

/* =========================================================
 * 7. 带作用域隔离的拖拽会话状态机（Scoped Drag Session Machine）
 *    携带所属数据库 dbId，杜绝两个内嵌数据库之间串行污染属性或错移页面；
 *    并在全局 dragend / drop / Esc 时自动兜底复位。
 * ========================================================= */

export type DragSession =
  | { kind: "none" }
  | { kind: "page"; pageId: string }
  | { kind: "db-row"; dbId: string; rowId: string };

let currentDrag: DragSession = { kind: "none" };
let dragListenersBound = false;

function bindGlobalDragReset() {
  if (dragListenersBound || typeof window === "undefined") return;
  dragListenersBound = true;
  const reset = () => {
    currentDrag = { kind: "none" };
  };
  window.addEventListener("dragend", reset, true);
  window.addEventListener("drop", () => window.setTimeout(reset, 0), true);
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") reset();
    },
    true,
  );
}

export function startPageDrag(pageId: string) {
  bindGlobalDragReset();
  currentDrag = { kind: "page", pageId };
}

export function startDbRowDrag(dbId: string, rowId: string) {
  bindGlobalDragReset();
  currentDrag = { kind: "db-row", dbId, rowId };
}

export function endDragSession() {
  currentDrag = { kind: "none" };
}

export function getDraggedPageId(): string | null {
  return currentDrag.kind === "page" ? currentDrag.pageId : null;
}

/** 仅当正在拖动的是同一个数据库里的行时才返回行 id，跨库拖拽一律拒绝 */
export function getDraggedRowForDb(dbId: string): string | null {
  return currentDrag.kind === "db-row" && currentDrag.dbId === dbId ? currentDrag.rowId : null;
}

export function getDragSnapshot(): DragSession {
  return currentDrag;
}
