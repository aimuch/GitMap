import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CircleAlert,
  Ellipsis,
  FileText,
  HardDriveDownload,
  Image as ImageIcon,
  Kanban,
  LayoutTemplate,
  LoaderCircle,
  PanelLeft,
  Smile,
  Star,
  Table2,
  Trash2,
  Undo2,
} from "lucide-react";
import type { PageMeta, PageRecord } from "../../shared/types";
import {
  ancestorsOf,
  deletePage,
  fetchPage,
  navigate,
  restorePage,
  setSidebarCollapsed,
  updatePage,
  useStore,
} from "../store";
import { applyTemplate, buildTree, getState } from "../store";
import { BUILTIN_TEMPLATES } from "../templates";
import { HistoryModal } from "./HistoryModal";
import { MenuItem, Popover } from "./Popover";
import { defaultDatabase, exportCsv } from "../db";
import { DatabaseView, RowProperties } from "./database/DatabaseView";
import { Editor, type NoteEditor } from "./Editor";
import { PageMenu } from "./PageMenu";
import { CoverPicker, EmojiPicker, coverStyle, randomCover } from "./pickers";
import { cx } from "./Popover";
import { modKey } from "./Sidebar";

export function PageView({ id }: { id: string }) {
  const meta = useStore((s) => s.pages[id]);
  const parent = useStore((s) => (meta?.parentId ? s.pages[meta.parentId] : undefined));
  const [dirty, setDirty] = useState(false);
  const onDirty = useCallback(() => setDirty(true), []);
  const [record, setRecord] = useState<PageRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [templateAnchor, setTemplateAnchor] = useState<HTMLElement | null>(null);
  const allPages = useStore((s) => s.pages);
  const editorRef = useRef<NoteEditor | null>(null);
  const onReady = useCallback((editor: NoteEditor | null) => {
    editorRef.current = editor;
  }, []);

  useEffect(() => {
    let alive = true;
    fetchPage(id).then(
      (page) => alive && setRecord(page),
      (err: Error) => alive && setLoadError(err.message),
    );
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    document.title = meta ? `${meta.title || "无标题"} · OpenNotion` : "OpenNotion";
  }, [meta?.title, meta]);

  if (!meta) return null;

  const isDatabase = meta.kind === "database";
  const userTemplates = Object.values(allPages)
    .filter((p) => p.template && !p.trashed && !p.hidden && p.id !== meta.id)
    .sort((a, b) => a.title.localeCompare(b.title, "zh"));
  const isRow = parent?.kind === "database" && !parent.trashed;
  const blank = !isDatabase && !isRow && !meta.trashed && !dirty && record?.content.length === 0;

  const exportMarkdown = () => {
    if (isDatabase) {
      exportCsv(meta, buildTree(getState().pages).children.get(meta.id) ?? []);
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    const body = editor.blocksToMarkdownLossy(editor.document);
    const blob = new Blob([`# ${meta.title || "无标题"}\n\n${body}`], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(meta.title || "无标题").replace(/[\\/:*?"<>|]/g, "_")}.md`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="page">
      <Topbar
        page={meta}
        onExport={exportMarkdown}
        exportLabel={isDatabase ? "导出为 CSV" : "导出为 Markdown"}
        onHistory={isDatabase ? undefined : () => setHistoryOpen(true)}
      />
      {meta.trashed && <TrashBanner page={meta} />}
      <div className="page-scroll">
        {meta.cover && <Cover page={meta} />}
        <div
          className={cx(
            "page-body",
            meta.fullWidth && "full-width",
            meta.cover && "has-cover",
            isDatabase && "database-page",
          )}
        >
          <PageHeader page={meta} onEnter={() => editorRef.current?.focus()} />
          {isRow && parent && (
            <div inert={meta.trashed}>
              <RowProperties row={meta} dbPage={parent} />
            </div>
          )}
          {isDatabase ? (
            <div inert={meta.trashed}>
              <DatabaseView page={meta} />
            </div>
          ) : record ? (
            <>
              <Editor page={record} editable={!meta.trashed} onReady={onReady} onDirty={onDirty} />
              {blank && (
                <div className="starters">
                  <button type="button" onClick={(e) => setTemplateAnchor(templateAnchor ? null : e.currentTarget)}>
                    <LayoutTemplate size={15} /> 使用模板
                  </button>
                  <span>或者把这个页面变成数据库：</span>
                  <button type="button" onClick={() => updatePage(meta.id, { kind: "database", database: defaultDatabase("table") })}>
                    <Table2 size={15} /> 表格
                  </button>
                  <button type="button" onClick={() => updatePage(meta.id, { kind: "database", database: defaultDatabase("board") })}>
                    <Kanban size={15} /> 看板
                  </button>
                  <button type="button" onClick={() => updatePage(meta.id, { kind: "database", database: defaultDatabase("calendar") })}>
                    <CalendarDays size={15} /> 日历
                  </button>
                </div>
              )}
            </>
          ) : loadError ? (
            <div className="page-message">
              <CircleAlert size={16} /> 加载失败：{loadError}
            </div>
          ) : (
            <div className="editor-skeleton" aria-hidden>
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      </div>
      {historyOpen && <HistoryModal page={meta} onClose={() => setHistoryOpen(false)} />}
      {templateAnchor && (
        <Popover anchor={templateAnchor} onClose={() => setTemplateAnchor(null)} className="menu template-menu">
          <div className="menu-title">内置模板</div>
          {BUILTIN_TEMPLATES.map((tpl) => (
            <MenuItem
              key={tpl.id}
              icon={<span className="template-icon">{tpl.icon}</span>}
              label={tpl.name}
              hint={tpl.description}
              onClick={() => {
                setTemplateAnchor(null);
                const editor = editorRef.current;
                if (!editor) return;
                // 直接替换编辑器里的内容，随后由编辑器的自动保存写入
                editor.replaceBlocks(editor.document, tpl.content as Parameters<typeof editor.replaceBlocks>[1]);
                updatePage(meta.id, { icon: meta.icon ?? tpl.icon, title: meta.title || tpl.name });
              }}
            />
          ))}
          {userTemplates.length > 0 && <div className="menu-title">我的模板</div>}
          {userTemplates.map((tpl) => (
            <MenuItem
              key={tpl.id}
              icon={<span className="template-icon">{tpl.icon ?? "📄"}</span>}
              label={tpl.title || "无标题"}
              onClick={() => {
                setTemplateAnchor(null);
                void applyTemplate(meta.id, tpl.id);
              }}
            />
          ))}
          <div className="menu-footnote">在任意页面的菜单里选“设为模板”，它就会出现在这里。</div>
        </Popover>
      )}
    </div>
  );
}

interface TopbarProps {
  page: PageMeta;
  onExport: () => void;
  exportLabel: string;
  onHistory?: () => void;
}

function Topbar({ page, onExport, exportLabel, onHistory }: TopbarProps) {
  const pages = useStore((s) => s.pages);
  const saving = useStore((s) => s.saving > 0);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const chain = [...ancestorsOf(pages, page.id), page];
  // 层级太深时只保留首尾
  const crumbs: (PageMeta | null)[] = chain.length > 4 ? [chain[0], null, ...chain.slice(-2)] : chain;

  return (
    <header className="topbar">
      {collapsed && (
        <button
          type="button"
          className="icon-btn"
          title={`展开侧边栏 ${modKey}\\`}
          aria-label="展开侧边栏"
          onClick={() => setSidebarCollapsed(false)}
        >
          <PanelLeft size={18} />
        </button>
      )}
      <nav className="breadcrumbs" aria-label="页面路径">
        {crumbs.map((p, i) => (
          <Fragment key={p?.id ?? "gap"}>
            {i > 0 && <span className="crumb-sep">/</span>}
            {p ? (
              <button type="button" className="crumb" onClick={() => navigate(p.id)}>
                <span className="crumb-icon">{p.icon ?? (p.kind === "database" ? <Table2 size={15} /> : <FileText size={15} />)}</span>
                <span className="crumb-title">{p.title || "无标题"}</span>
              </button>
            ) : (
              <span className="crumb-gap">…</span>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="topbar-right">
        <span className="save-state" aria-live="polite">
          {saving ? <LoaderCircle size={13} className="spin" /> : <HardDriveDownload size={13} />}
          {saving ? "保存中…" : "已保存到本地"}
        </span>
        {!page.trashed && (
          <>
            <button
              type="button"
              className={cx("icon-btn", page.favorite && "starred")}
              title={page.favorite ? "取消收藏" : "添加到收藏"}
              aria-label={page.favorite ? "取消收藏" : "添加到收藏"}
              aria-pressed={page.favorite}
              onClick={() => updatePage(page.id, { favorite: !page.favorite })}
            >
              <Star size={17} fill={page.favorite ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title="更多操作"
              aria-label="更多操作"
              onClick={(e) => setMenuAnchor(menuAnchor ? null : e.currentTarget)}
            >
              <Ellipsis size={18} />
            </button>
          </>
        )}
      </div>
      {menuAnchor && (
        <PageMenu
          page={page}
          anchor={menuAnchor}
          currentId={page.id}
          align="end"
          showLayout
          onExport={onExport}
          exportLabel={exportLabel}
          onHistory={onHistory}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </header>
  );
}

function TrashBanner({ page }: { page: PageMeta }) {
  return (
    <div className="trash-banner" role="status">
      <span className="trash-banner-text">
        <Trash2 size={15} /> 此页面在回收站中，暂时不能编辑。
      </span>
      <button type="button" onClick={() => void restorePage(page.id)}>
        <Undo2 size={14} /> 恢复页面
      </button>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("永久删除此页面及其子页面？此操作无法撤销。")) void deletePage(page.id);
        }}
      >
        <Trash2 size={14} /> 永久删除
      </button>
    </div>
  );
}

function Cover({ page }: { page: PageMeta }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <div className={cx("cover", anchor && "picking")} style={coverStyle(page.cover!)}>
      {!page.trashed && (
        <div className="cover-actions">
          <button type="button" onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}>
            更换封面
          </button>
        </div>
      )}
      {anchor && (
        <CoverPicker anchor={anchor} onPick={(cover) => updatePage(page.id, { cover })} onClose={() => setAnchor(null)} />
      )}
    </div>
  );
}

function PageHeader({ page, onEnter }: { page: PageMeta; onEnter: () => void }) {
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const editable = !page.trashed;

  // 标题随内容自动增高；窗口或侧边栏宽度变化导致折行改变时也要重新计算
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    let lastWidth = -1;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    const observer = new ResizeObserver(() => {
      if (el.offsetWidth === lastWidth) return;
      lastWidth = el.offsetWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [page.title]);

  // 新建的空白页面，直接把光标放进标题
  useEffect(() => {
    if (editable && page.title === "") titleRef.current?.focus();
    // 只在进入页面时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page-header">
      {page.icon && (
        <button
          type="button"
          className="page-icon"
          aria-label="更换图标"
          disabled={!editable}
          onClick={(e) => setEmojiAnchor(emojiAnchor ? null : e.currentTarget)}
        >
          {page.icon}
        </button>
      )}
      {editable && (!page.icon || !page.cover) && (
        <div className={cx("page-controls", emojiAnchor && "visible")}>
          {!page.icon && (
            <button type="button" onClick={(e) => setEmojiAnchor(emojiAnchor ? null : e.currentTarget)}>
              <Smile size={15} /> 添加图标
            </button>
          )}
          {!page.cover && (
            <button type="button" onClick={() => updatePage(page.id, { cover: randomCover() })}>
              <ImageIcon size={15} /> 添加封面
            </button>
          )}
        </div>
      )}
      <textarea
        ref={titleRef}
        className="page-title"
        rows={1}
        value={page.title}
        placeholder="无标题"
        aria-label="页面标题"
        readOnly={!editable}
        spellCheck={false}
        onChange={(e) => updatePage(page.id, { title: e.target.value.replace(/\n/g, " ") })}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" || e.key === "ArrowDown") {
            e.preventDefault();
            onEnter();
          }
        }}
      />
      {emojiAnchor && (
        <EmojiPicker
          anchor={emojiAnchor}
          hasIcon={!!page.icon}
          onPick={(icon) => updatePage(page.id, { icon })}
          onClose={() => setEmojiAnchor(null)}
        />
      )}
    </div>
  );
}
