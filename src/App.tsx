import { useEffect } from "react";
import { CircleAlert, PanelLeft, Plus } from "lucide-react";
import { AiModal } from "./components/AiModal";
import { AiSettingsModal } from "./components/AiSettingsModal";
import { Logo } from "./components/Logo";
import { RowDrawer } from "./components/database/RowDrawer";
import { topOverlayName } from "./machines";
import {
  createPage,
  dismissTopOverlay,
  getState,
  loadPages,
  navigate,
  sendOverlay,
  setAiSettingsOpen,
  setSidebarCollapsed,
  useRoute,
  useStore,
  useTree,
} from "./store";
import { PageView } from "./components/PageView";
import { SearchModal } from "./components/SearchModal";
import { Sidebar } from "./components/Sidebar";

const LAST_PAGE_KEY = "on:lastPage";

export function App() {
  const loaded = useStore((s) => s.loaded);
  const pages = useStore((s) => s.pages);
  const overlay = useStore((s) => s.overlay);
  const searchOpen = overlay.modal === "search";
  const aiOpen = overlay.modal === "ai";
  const aiSettingsOpen = overlay.aiSettings;
  const peekRowId = overlay.peekRowId;
  const topOverlay = topOverlayName(overlay);
  const revisions = useStore((s) => s.revisions);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const error = useStore((s) => s.error);
  const route = useRoute();
  const tree = useTree();
  const current = route && pages[route] ? route : null;

  useEffect(() => {
    void loadPages();
  }, []);

  useEffect(() => {
    if (!loaded || current) return;
    let last: string | null;
    try {
      last = localStorage.getItem(LAST_PAGE_KEY);
    } catch {
      last = null;
    }
    const fallback = last && pages[last] && !pages[last].trashed ? last : (tree.children.get("")?.[0]?.id ?? null);
    if (fallback) navigate(fallback, true);
    else if (route) navigate(null, true);
  }, [loaded, current, route, pages, tree]);

  useEffect(() => {
    if (!current) return;
    try {
      localStorage.setItem(LAST_PAGE_KEY, current);
    } catch {
      /* 忽略 */
    }
  }, [current]);

  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "k" || key === "p") {
        const sel = window.getSelection();
        const inEditor = (e.target as HTMLElement | null)?.closest?.(".bn-editor");
        if (key === "k" && inEditor && sel && !sel.isCollapsed) return;
        e.preventDefault();
        e.stopPropagation();
        sendOverlay({ type: "TOGGLE_SEARCH" });
      } else if (key === "j") {
        e.preventDefault();
        e.stopPropagation();
        sendOverlay({ type: "TOGGLE_AI" });
      } else if (e.key === "\\") {
        e.preventDefault();
        setSidebarCollapsed(!getState().sidebarCollapsed);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      // 局部模态框（如页面历史、导入进度）优先于全局浮层栈
      if (document.querySelector("[data-local-modal]")) return;
      if (dismissTopOverlay()) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onShortcut, true);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onShortcut, true);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div
      className="app"
      data-boot-state={loaded ? "ready" : "loading"}
      data-top-overlay={topOverlay}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const link = (e.target as HTMLElement | null)?.closest?.("a");
        if (!link || link.closest(".bn-editor[contenteditable='true']")) return;
        const m = /^#\/([a-f0-9]{16})$/.exec(link.getAttribute("href") ?? "");
        if (m) {
          e.preventDefault();
          navigate(m[1]);
        }
      }}
    >
      <Sidebar currentId={current} />
      {!collapsed && <div className="sidebar-backdrop" onClick={() => setSidebarCollapsed(true)} />}
      <main className="main">
        {current ? (
          <PageView key={`${current}:${revisions[current] ?? 0}`} id={current} />
        ) : (
          <div className="page">
            {collapsed && (
              <header className="topbar">
                <button type="button" className="icon-btn" aria-label="展开侧边栏" onClick={() => setSidebarCollapsed(false)}>
                  <PanelLeft size={18} />
                </button>
              </header>
            )}
            {!loaded && (
              <div className="splash" role="status" aria-label="正在加载">
                <Logo size={64} />
              </div>
            )}
            {loaded && (
              <div className="empty-state">
                <Logo size={72} className="empty-logo" />
                <h1>这里还没有页面</h1>
                <p>新建一个页面，开始记录吧。</p>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={async () => {
                    const id = await createPage();
                    if (id) navigate(id);
                  }}
                >
                  <Plus size={16} /> 新建页面
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      {peekRowId && <RowDrawer id={peekRowId} />}
      {searchOpen && <SearchModal />}
      {aiOpen && <AiModal currentPageId={current} />}
      {aiSettingsOpen && <AiSettingsModal onClose={() => setAiSettingsOpen(false)} />}
      {error && (
        <div className="toast" role="alert">
          <CircleAlert size={16} />
          {error}
        </div>
      )}
    </div>
  );
}
