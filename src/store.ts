import { useMemo, useSyncExternalStore } from "react";
import type { HistoryEntry, NewPageInput, PageMeta, PagePatch, PageRecord, SearchHit, UnfurlData } from "../shared/types";

export type ThemeSetting = "light" | "dark" | "system";

interface State {
  pages: Record<string, PageMeta>;
  /** 页面正文被整体替换（恢复历史、套用模板）的次数；变了就要重新加载编辑器 */
  revisions: Record<string, number>;
  loaded: boolean;
  /** 正在进行或排队中的保存请求数 */
  saving: number;
  error: string | null;
  expanded: Record<string, true>;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  theme: ThemeSetting;
  searchOpen: boolean;
  aiOpen: boolean;
  aiSettingsOpen: boolean;
  /** 数据库右侧抽屉（Side Peek）打开的行 id */
  peekRowId: string | null;
}

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`on:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(`on:${key}`, JSON.stringify(value));
  } catch {
    /* 隐私模式下可能不可用，忽略 */
  }
}

function readTheme(): ThemeSetting {
  try {
    const t = localStorage.getItem("on:theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

/** 手机宽度下侧边栏是浮层：默认收起，且不改动桌面端记住的展开状态 */
const narrowQuery = window.matchMedia("(max-width: 720px)");
export const isNarrow = () => narrowQuery.matches;

let state: State = {
  pages: {},
  revisions: {},
  loaded: false,
  saving: 0,
  error: null,
  expanded: readLocal<Record<string, true>>("expanded", {}),
  sidebarCollapsed: narrowQuery.matches ? true : readLocal("sidebarCollapsed", false),
  sidebarWidth: readLocal("sidebarWidth", 260),
  theme: readTheme(),
  searchOpen: false,
  aiOpen: false,
  aiSettingsOpen: false,
  peekRowId: null,
};

const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getState = () => state;

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/* ---------- 请求 ---------- */

async function request<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `请求失败（${res.status}）`);
  return data as T;
}

function reportError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  set({ error: message });
  window.setTimeout(() => {
    if (state.error === message) set({ error: null });
  }, 5000);
}

function setPages(list: PageMeta[]) {
  const pages: Record<string, PageMeta> = {};
  for (const p of list) {
    // 尚未保存的本地修改（例如正在输入的标题）优先于服务器返回的值
    const pending = pendingPatches.get(p.id);
    const { content: _content, ...metaPatch } = pending?.patch ?? {};
    pages[p.id] = pending ? { ...p, ...metaPatch } : p;
  }
  set({ pages });
}

/* ---------- 页面数据 ---------- */

export async function loadPages() {
  try {
    const { pages } = await request<{ pages: PageMeta[] }>("/api/pages");
    setPages(pages);
    set({ loaded: true });
  } catch (err) {
    reportError(err);
  }
}

export async function fetchPage(id: string): Promise<PageRecord> {
  await flushPatch(id);
  const { page } = await request<{ page: PageRecord }>(`/api/pages/${id}`);
  return page;
}

export async function createPage(input: NewPageInput & { quiet?: boolean } = {}): Promise<string | null> {
  try {
    const { quiet, ...body } = input;
    const { id, pages } = await request<{ id: string; pages: PageMeta[] }>("/api/pages", {
      method: "POST",
      json: { ...body, parentId: input.parentId ?? null },
    });
    setPages(pages);
    // 批量导入时不逐个展开侧边栏
    if (input.parentId && !quiet) setExpanded(input.parentId, true);
    return id;
  } catch (err) {
    reportError(err);
    return null;
  }
}

async function mutate(url: string, method: string, json: unknown = {}) {
  try {
    const data = await request<{ id?: string; pages: PageMeta[] }>(url, { method, json });
    setPages(data.pages);
    return data;
  } catch (err) {
    reportError(err);
    return null;
  }
}

export async function trashPage(id: string) {
  await flushPatch(id);
  return mutate(`/api/pages/${id}/trash`, "POST");
}

export const restorePage = (id: string) => mutate(`/api/pages/${id}/restore`, "POST");

export async function deletePage(id: string) {
  dropPatch(id);
  return mutate(`/api/pages/${id}`, "DELETE");
}

export const emptyTrash = () => mutate("/api/trash", "DELETE");

export async function duplicatePage(id: string): Promise<string | null> {
  await flushPatch(id);
  const data = await mutate(`/api/pages/${id}/duplicate`, "POST");
  return data?.id ?? null;
}

export function movePage(id: string, parentId: string | null, index: number) {
  if (parentId) setExpanded(parentId, true);
  return mutate(`/api/pages/${id}/move`, "POST", { parentId, index });
}

/** 正文在服务器上被整体换掉之后调用：丢掉本地还没发出的修改，并让编辑器重新加载 */
function reloadContent(id: string) {
  dropPatch(id);
  set({ revisions: { ...state.revisions, [id]: (state.revisions[id] ?? 0) + 1 } });
}

export async function fetchHistory(id: string): Promise<HistoryEntry[]> {
  await flushPatch(id);
  const { versions } = await request<{ versions: HistoryEntry[] }>(`/api/pages/${id}/history`);
  return versions;
}

export async function fetchVersion(id: string, ts: number): Promise<PageRecord> {
  const { version } = await request<{ version: { title: string; icon: string | null; content: unknown[] } }>(
    `/api/pages/${id}/history/${ts}`,
  );
  // 套上页面当前的其余信息，拼成一个可以交给编辑器预览的记录
  return { ...state.pages[id], ...version, id };
}

export async function restoreVersion(id: string, ts: number): Promise<boolean> {
  await flushPatch(id);
  const done = await mutate(`/api/pages/${id}/history/${ts}/restore`, "POST");
  if (done) reloadContent(id);
  return !!done;
}

export async function applyTemplate(targetId: string, templateId: string): Promise<boolean> {
  await flushPatch(targetId);
  const done = await mutate(`/api/pages/${targetId}/apply-template`, "POST", { templateId });
  if (done) reloadContent(targetId);
  return !!done;
}

export async function searchPages(q: string): Promise<SearchHit[]> {
  const { hits } = await request<{ hits: SearchHit[] }>(`/api/search?q=${encodeURIComponent(q)}`);
  return hits;
}

export async function fetchBacklinks(id: string): Promise<SearchHit[]> {
  const { backlinks } = await request<{ backlinks: SearchHit[] }>(`/api/pages/${id}/backlinks`);
  return backlinks;
}

export async function cleanOrphanSynced(): Promise<number> {
  const data = await request<{ removed: number; pages: PageMeta[] }>("/api/synced/cleanup", { method: "POST", json: {} });
  setPages(data.pages);
  return data.removed;
}

export async function unfurlLink(url: string): Promise<UnfurlData> {
  const { data } = await request<{ data: UnfurlData }>(`/api/unfurl?url=${encodeURIComponent(url)}`);
  return data;
}

export async function uploadFile(file: File): Promise<string> {
  const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "X-Upload": "1", "Content-Type": "application/octet-stream" },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "上传失败");
  return data.url as string;
}

/* ---------- 带防抖的自动保存 ---------- */

interface Pending {
  patch: PagePatch;
  timer: number;
}

const pendingPatches = new Map<string, Pending>();
const inflight = new Map<string, Promise<void>>();
const SAVE_DELAY = 500;

/** 立即更新界面，稍后把修改合并成一次请求写入磁盘。 */
export function updatePage(id: string, patch: PagePatch) {
  const current = state.pages[id];
  const { content: _content, ...metaPatch } = patch;
  if (current && Object.keys(metaPatch).length > 0) {
    set({ pages: { ...state.pages, [id]: { ...current, ...metaPatch, updatedAt: Date.now() } } });
  }
  const existing = pendingPatches.get(id);
  if (existing) {
    window.clearTimeout(existing.timer);
  } else {
    set({ saving: state.saving + 1 });
  }
  pendingPatches.set(id, {
    patch: { ...existing?.patch, ...patch },
    timer: window.setTimeout(() => void flushPatch(id), SAVE_DELAY),
  });
}

function dropPatch(id: string) {
  const pending = pendingPatches.get(id);
  if (!pending) return;
  window.clearTimeout(pending.timer);
  pendingPatches.delete(id);
  set({ saving: Math.max(0, state.saving - 1) });
}

export function flushPatch(id: string): Promise<void> {
  const pending = pendingPatches.get(id);
  const previous = inflight.get(id) ?? Promise.resolve();
  if (!pending) return previous;
  window.clearTimeout(pending.timer);
  pendingPatches.delete(id);
  // 同一页面的保存请求按顺序发出，避免旧内容覆盖新内容
  const next = previous
    .then(() => request(`/api/pages/${id}`, { method: "PATCH", json: pending.patch, keepalive: byteLength(pending.patch) < 60_000 }))
    .then(
      () => {},
      (err) => reportError(err),
    )
    .finally(() => {
      set({ saving: Math.max(0, state.saving - 1) });
      if (inflight.get(id) === next) inflight.delete(id);
    });
  inflight.set(id, next);
  return next;
}

function byteLength(value: unknown) {
  return JSON.stringify(value).length * 3;
}

export function flushAll(): Promise<void> {
  // 既包括还在防抖等待的修改，也包括已经发出但还没返回的请求
  const ids = new Set([...pendingPatches.keys(), ...inflight.keys()]);
  return Promise.all([...ids].map((id) => flushPatch(id))).then(() => {});
}

// 桌面版在关闭窗口前通过它确认所有修改都已保存
(window as unknown as { __openNotionFlush?: () => Promise<void> }).__openNotionFlush = flushAll;

window.addEventListener("pagehide", () => void flushAll());
window.addEventListener("beforeunload", (e) => {
  if (state.saving > 0) {
    void flushAll();
    e.preventDefault();
  }
});

/* ---------- 界面状态 ---------- */

export function setExpanded(id: string, open: boolean) {
  const expanded = { ...state.expanded };
  if (open) expanded[id] = true;
  else delete expanded[id];
  set({ expanded });
  writeLocal("expanded", expanded);
}

export function setSidebarCollapsed(collapsed: boolean) {
  set({ sidebarCollapsed: collapsed });
  if (!isNarrow()) writeLocal("sidebarCollapsed", collapsed);
}

export function setSidebarWidth(width: number, persist = false) {
  const w = Math.round(Math.max(200, Math.min(480, width)));
  if (w !== state.sidebarWidth) set({ sidebarWidth: w });
  if (persist) writeLocal("sidebarWidth", w);
}

export function setSearchOpen(open: boolean) {
  set({ searchOpen: open });
}

export function setAiOpen(open: boolean) {
  set({ aiOpen: open });
}

export function setAiSettingsOpen(open: boolean) {
  set({ aiSettingsOpen: open });
}

export function setPeekRowId(id: string | null) {
  set({ peekRowId: id });
}

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

export function resolveTheme(theme: ThemeSetting): "light" | "dark" {
  return theme === "system" ? (systemDark.matches ? "dark" : "light") : theme;
}

function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme(state.theme);
}

export function setTheme(theme: ThemeSetting) {
  set({ theme });
  try {
    localStorage.setItem("on:theme", theme);
  } catch {
    /* 忽略 */
  }
  applyTheme();
}

systemDark.addEventListener("change", applyTheme);

export function useResolvedTheme(): "light" | "dark" {
  const theme = useStore((s) => s.theme);
  const systemIsDark = useSyncExternalStore(
    (cb) => {
      systemDark.addEventListener("change", cb);
      return () => systemDark.removeEventListener("change", cb);
    },
    () => systemDark.matches,
  );
  return theme === "system" ? (systemIsDark ? "dark" : "light") : theme;
}

/* ---------- 页面树 ---------- */

export interface Tree {
  /** 未删除的子页面，按顺序排列；根页面的 key 为 "" */
  children: Map<string, PageMeta[]>;
  favorites: PageMeta[];
  /** 回收站中最上层的页面（其父页面未被删除） */
  trash: PageMeta[];
}

export function buildTree(pages: Record<string, PageMeta>): Tree {
  const children = new Map<string, PageMeta[]>();
  const favorites: PageMeta[] = [];
  const trash: PageMeta[] = [];
  for (const p of Object.values(pages)) {
    // 内部页面（同步块的内容）不出现在页面树、收藏和回收站里
    if (p.hidden) continue;
    if (p.trashed) {
      const parent = p.parentId ? pages[p.parentId] : undefined;
      if (!parent || !parent.trashed || parent.trashedAt !== p.trashedAt) trash.push(p);
      continue;
    }
    const key = p.parentId && pages[p.parentId] && !pages[p.parentId].trashed ? p.parentId : "";
    const list = children.get(key);
    if (list) list.push(p);
    else children.set(key, [p]);
    if (p.favorite) favorites.push(p);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  }
  favorites.sort((a, b) => a.title.localeCompare(b.title, "zh"));
  trash.sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
  return { children, favorites, trash };
}

export function useTree(): Tree {
  const pages = useStore((s) => s.pages);
  return useMemo(() => buildTree(pages), [pages]);
}

export function ancestorsOf(pages: Record<string, PageMeta>, id: string): PageMeta[] {
  const chain: PageMeta[] = [];
  const seen = new Set<string>();
  let cur = pages[id]?.parentId ?? null;
  while (cur && pages[cur] && !seen.has(cur)) {
    seen.add(cur);
    chain.unshift(pages[cur]);
    cur = pages[cur].parentId;
  }
  return chain;
}

export function isDescendant(pages: Record<string, PageMeta>, id: string, ancestorId: string): boolean {
  return ancestorsOf(pages, id).some((p) => p.id === ancestorId);
}

/* ---------- 路由（hash） ---------- */

function currentPageId(): string | null {
  const m = /^#\/([a-f0-9]{16})$/.exec(window.location.hash);
  return m ? m[1] : null;
}

export function useRoute(): string | null {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    currentPageId,
  );
}

export function navigate(id: string | null, replace = false) {
  // 手机上选中页面后自动收起侧边栏浮层
  if (isNarrow() && !replace && !state.sidebarCollapsed) set({ sidebarCollapsed: true });
  if (state.peekRowId) set({ peekRowId: null });
  const hash = id ? `#/${id}` : "#/";
  if (replace) {
    window.history.replaceState(null, "", hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
}
