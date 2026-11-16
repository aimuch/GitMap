import { useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  ChevronsLeft,
  Ellipsis,
  FileStack,
  FileText,
  Import,
  Layers,
  LoaderCircle,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings2,
  Sparkles,
  SquarePen,
  Star,
  Sun,
  Table2,
  Trash2,
} from "lucide-react";
import { importNotionZip, type ImportResult } from "../notionImport";
import { Logo, Wordmark } from "./Logo";
import type { PageMeta } from "../../shared/types";
import {
  createPage,
  getState,
  isDescendant,
  movePage,
  navigate,
  setAiOpen,
  setAiSettingsOpen,
  setExpanded,
  setSearchOpen,
  setSidebarCollapsed,
  setSidebarWidth,
  setTheme,
  useStore,
  useTree,
  type ThemeSetting,
  type Tree,
} from "../store";
import { PageMenu } from "./PageMenu";
import { cx } from "./Popover";
import { TrashPopover } from "./TrashPopover";

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
export const modKey = isMac ? "⌘" : "Ctrl+";

/** 当前正在拖动的页面 id（HTML5 拖拽在 dragover 阶段读不到 dataTransfer 的内容） */
let draggingId: string | null = null;

type DropPosition = "before" | "after" | "inside";

async function newPage(parentId: string | null = null) {
  const id = await createPage({ parentId });
  if (id) navigate(id);
}

export function Sidebar({ currentId }: { currentId: string | null }) {
  const tree = useTree();
  const width = useStore((s) => s.sidebarWidth);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const theme = useStore((s) => s.theme);
  const [trashAnchor, setTrashAnchor] = useState<HTMLElement | null>(null);
  const [rootDrop, setRootDrop] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState<
    { status: "running"; text: string } | { status: "done"; result: ImportResult } | { status: "error"; message: string } | null
  >(null);

  const runImport = async (file: File) => {
    setImporting({ status: "running", text: "正在读取压缩包…" });
    try {
      const result = await importNotionZip(file, (text) => setImporting({ status: "running", text }));
      setImporting({ status: "done", result });
    } catch (err) {
      setImporting({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };
  const roots = tree.children.get("") ?? [];

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add("resizing");
    const onMove = (ev: PointerEvent) => setSidebarWidth(ev.clientX);
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      document.body.classList.remove("resizing");
      setSidebarWidth(getState().sidebarWidth, true);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  const nextTheme: Record<ThemeSetting, ThemeSetting> = { system: "light", light: "dark", dark: "system" };
  const themeLabel: Record<ThemeSetting, string> = { system: "跟随系统", light: "浅色", dark: "深色" };
  const ThemeIcon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;

  return (
    <aside
      className={cx("sidebar", collapsed && "collapsed")}
      style={{ width: collapsed ? 0 : width }}
      aria-hidden={collapsed}
      inert={collapsed}
    >
      <div className="sidebar-inner" style={{ width }}>
        <div className="sidebar-header">
          <Logo size={24} />
          <Wordmark className="workspace-name" />
          <button
            type="button"
            className="icon-btn"
            title={`收起侧边栏 ${modKey}\\`}
            aria-label="收起侧边栏"
            onClick={() => setSidebarCollapsed(true)}
          >
            <ChevronsLeft size={18} />
          </button>
          <button type="button" className="icon-btn" title="新建页面" aria-label="新建页面" onClick={() => void newPage()}>
            <SquarePen size={17} />
          </button>
        </div>

        <div className="sidebar-nav">
          <button type="button" className="nav-row" onClick={() => setSearchOpen(true)}>
            <Search size={16} />
            <span>搜索</span>
            <kbd>{modKey}K</kbd>
          </button>
          <button type="button" className="nav-row" onClick={() => setAiOpen(true)}>
            <Sparkles size={16} />
            <span>AI 助手</span>
            <kbd>{modKey}J</kbd>
          </button>
        </div>

        <div className="sidebar-scroll">
          {tree.favorites.length > 0 && (
            <section className="sidebar-section">
              <div className="section-title">
                <span className="section-label">
                  <Star size={12} /> 收藏
                </span>
              </div>
              {tree.favorites.map((p) => (
                <TreeNode key={p.id} page={p} depth={0} tree={tree} currentId={currentId} draggable={false} />
              ))}
            </section>
          )}

          <section
            className={cx("sidebar-section", "grow", rootDrop && "root-drop")}
            onDragOver={(e) => {
              if (!draggingId || e.target !== e.currentTarget) return;
              e.preventDefault();
              setRootDrop(true);
            }}
            onDragLeave={() => setRootDrop(false)}
            onDrop={(e) => {
              setRootDrop(false);
              if (!draggingId || e.target !== e.currentTarget) return;
              e.preventDefault();
              void movePage(draggingId, null, roots.filter((p) => p.id !== draggingId).length);
            }}
          >
            <div className="section-title">
              <span className="section-label">
                <Layers size={12} /> 页面
              </span>
              <button type="button" className="icon-btn small" title="新建页面" aria-label="新建页面" onClick={() => void newPage()}>
                <Plus size={15} />
              </button>
            </div>
            {roots.map((p) => (
              <TreeNode key={p.id} page={p} depth={0} tree={tree} currentId={currentId} draggable />
            ))}
            {roots.length === 0 && (
              <div className="tree-empty with-icon">
                <FileStack size={14} /> 还没有页面
              </div>
            )}
            <button type="button" className="nav-row muted add-page" onClick={() => void newPage()}>
              <Plus size={16} />
              <span>新页面</span>
            </button>
          </section>
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className={cx("nav-row", trashAnchor && "active")}
            onClick={(e) => setTrashAnchor(trashAnchor ? null : e.currentTarget)}
          >
            <Trash2 size={16} />
            <span>回收站</span>
            {tree.trash.length > 0 && <span className="count">{tree.trash.length}</span>}
          </button>
          <button type="button" className="nav-row" onClick={() => fileRef.current?.click()}>
            <Import size={16} />
            <span>导入 Notion 导出包</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              // 清空选择，这样同一个文件可以再选一次
              e.target.value = "";
              if (file) void runImport(file);
            }}
          />
          <button type="button" className="nav-row" onClick={() => setAiSettingsOpen(true)}>
            <Settings2 size={16} />
            <span>AI 模型设置</span>
          </button>
          <button
            type="button"
            className="nav-row"
            title="切换主题"
            onClick={() => setTheme(nextTheme[theme])}
          >
            <ThemeIcon size={16} />
            <span>主题：{themeLabel[theme]}</span>
          </button>
        </div>
      </div>

      {trashAnchor && <TrashPopover anchor={trashAnchor} items={tree.trash} onClose={() => setTrashAnchor(null)} />}
      {importing &&
        createPortal(
          <div className="modal-backdrop">
            <div className="import-modal" role="dialog" aria-modal="true" aria-label="导入 Notion 导出包">
              <h2>导入 Notion 导出包</h2>
              {importing.status === "running" && (
                <p className="import-progress" aria-live="polite">
                  <LoaderCircle size={15} className="spin" /> {importing.text}
                </p>
              )}
              {importing.status === "done" && (
                <>
                  <p>
                    导入完成：{importing.result.pages} 个页面，{importing.result.databases} 个数据库（共{" "}
                    {importing.result.rows} 行），{importing.result.files} 个图片或附件。
                  </p>
                  <p className="import-note">内容都放在“Notion 导入”页面下面。数据库的列类型是按内容猜的，拿不准的都当作文本。</p>
                  <div className="import-actions">
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => {
                        navigate(importing.result.rootId);
                        setExpanded(importing.result.rootId, true);
                        setImporting(null);
                      }}
                    >
                      查看导入的内容
                    </button>
                  </div>
                </>
              )}
              {importing.status === "error" && (
                <>
                  <p className="value-error">{importing.message}</p>
                  <div className="import-actions">
                    <button type="button" className="text-btn" onClick={() => setImporting(null)}>
                      关闭
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
      <div className="sidebar-resizer" onPointerDown={startResize} role="separator" aria-orientation="vertical" />
    </aside>
  );
}

interface TreeNodeProps {
  page: PageMeta;
  depth: number;
  tree: Tree;
  currentId: string | null;
  draggable: boolean;
}

function TreeNode({ page, depth, tree, currentId, draggable }: TreeNodeProps) {
  // 收藏区和页面区各自记住展开状态
  const expandKey = draggable ? page.id : `fav:${page.id}`;
  const expanded = useStore((s) => !!s.expanded[expandKey]);
  const [drop, setDrop] = useState<DropPosition | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  // 数据库的行不在侧边栏里展开，免得成百上千行把页面树淹没
  const isDatabase = page.kind === "database";
  const kids = isDatabase ? [] : (tree.children.get(page.id) ?? []);
  const active = currentId === page.id;

  const canDropHere = () => {
    if (!draggable || !draggingId || draggingId === page.id) return false;
    return !isDescendant(getState().pages, page.id, draggingId);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!canDropHere()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    setDrop(ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "inside");
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const position = drop;
    setDrop(null);
    if (!canDropHere() || !position || !draggingId) return;
    e.preventDefault();
    const id = draggingId;
    if (position === "inside") {
      void movePage(id, page.id, kids.filter((p) => p.id !== id).length);
      return;
    }
    const siblings = (tree.children.get(page.parentId ?? "") ?? []).filter((p) => p.id !== id);
    const at = siblings.findIndex((p) => p.id === page.id);
    void movePage(id, page.parentId, position === "before" ? at : at + 1);
  };

  return (
    <div role="treeitem" aria-expanded={expanded} aria-selected={active}>
      <div
        ref={rowRef}
        className={cx("tree-row", active && "active", menuAnchor && "menu-open", drop && `drop-${drop}`)}
        style={{ paddingLeft: 6 + depth * 14 }}
        tabIndex={0}
        draggable={draggable}
        onClick={() => navigate(page.id)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter") navigate(page.id);
          if (e.key === "ArrowRight") setExpanded(expandKey, true);
          if (e.key === "ArrowLeft") setExpanded(expandKey, false);
        }}
        onDragStart={(e) => {
          draggingId = page.id;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", page.title || "无标题");
        }}
        onDragEnd={() => {
          draggingId = null;
          setDrop(null);
        }}
        onDragOver={onDragOver}
        onDragLeave={() => setDrop(null)}
        onDrop={onDrop}
      >
        <button
          type="button"
          disabled={isDatabase}
          className={cx("tree-toggle", expanded && !isDatabase && "open", isDatabase && "hidden")}
          aria-label={expanded ? "收起" : "展开"}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(expandKey, !expanded);
          }}
        >
          <ChevronRight size={14} />
        </button>
        <span className="tree-icon">{page.icon ?? (isDatabase ? <Table2 size={16} /> : <FileText size={16} />)}</span>
        <span className={cx("tree-title", !page.title && "untitled")}>{page.title || "无标题"}</span>
        {page.template && <span className="tree-badge">模板</span>}
        <span className="tree-actions">
          <button
            type="button"
            className="icon-btn small"
            title="更多操作"
            aria-label="更多操作"
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(menuAnchor ? null : e.currentTarget);
            }}
          >
            <Ellipsis size={15} />
          </button>
          <button
            type="button"
            className="icon-btn small"
            title={isDatabase ? "新建一行" : "新建子页面"}
            aria-label={isDatabase ? "新建一行" : "新建子页面"}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(expandKey, true);
              void newPage(page.id);
            }}
          >
            <Plus size={15} />
          </button>
        </span>
      </div>

      {menuAnchor && (
        <PageMenu page={page} anchor={menuAnchor} currentId={currentId} onClose={() => setMenuAnchor(null)} />
      )}

      {expanded && !isDatabase && (
        <div role="group">
          {kids.map((child) => (
            <TreeNode
              key={child.id}
              page={child}
              depth={depth + 1}
              tree={tree}
              currentId={currentId}
              draggable={draggable}
            />
          ))}
          {kids.length === 0 && (
            <div className="tree-empty" style={{ paddingLeft: 6 + (depth + 1) * 14 + 22 }}>
              没有子页面
            </div>
          )}
        </div>
      )}
    </div>
  );
}
