import { useEffect, useMemo } from "react";
import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  insertOrUpdateBlockForSlashMenu,
  type PartialBlock,
} from "@blocknote/core";
import { codeBlockOptions, syntaxHighlighter } from "@blocknote/code-block";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { zh } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import {
  SuggestionMenuController,
  createReactInlineContentSpec,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { FilePlus2, FileText, FileX2, Link2, PanelTop, RefreshCw, Table2 } from "lucide-react";
import { defaultDatabase } from "../db";
import { createDatabaseBlock } from "./database/InlineDatabase";
import { createSyncedBlock, registerNestedEditor } from "./SyncedBlock";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import type { PageRecord } from "../../shared/types";
import {
  createPage,
  flushPatch,
  getState,
  navigate,
  updatePage,
  uploadFile,
  useResolvedTheme,
  useStore,
} from "../store";
import { cx } from "./Popover";

/** 行内的页面链接（@ 提及）。标题和图标始终取自最新的页面数据。 */
function PageChip({ pageId }: { pageId: string }) {
  const page = useStore((s) => s.pages[pageId]);
  const gone = !page;
  return (
    <span
      className={cx("page-chip", (gone || page.trashed) && "gone")}
      role="link"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (!gone) navigate(pageId);
      }}
    >
      <span className="page-chip-icon">{gone ? <FileX2 size={15} /> : (page.icon ?? (page.kind === "database" ? <Table2 size={15} /> : <FileText size={15} />))}</span>
      <span className="page-chip-title">{gone ? "已删除的页面" : page.title || "无标题"}</span>
    </span>
  );
}

const pageMention = createReactInlineContentSpec(
  {
    type: "pageMention",
    propSchema: { pageId: { default: "" } },
    content: "none",
  },
  {
    render: ({ inlineContent }) => <PageChip pageId={inlineContent.props.pageId} />,
    toExternalHTML: ({ inlineContent }) => {
      const page = getState().pages[inlineContent.props.pageId];
      return <a href={`#/${inlineContent.props.pageId}`}>{page?.title || "无标题"}</a>;
    },
  },
);

export const schema = BlockNoteSchema.create({
  // 带语法高亮的代码块
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
    // 内嵌在正文里的数据库
    database: createDatabaseBlock(),
    // 同步块：多处引用、编辑的是同一份内容
    synced: createSyncedBlock(),
  },
  inlineContentSpecs: { ...defaultInlineContentSpecs, pageMention },
});

export type NoteEditor = typeof schema.BlockNoteEditor;

interface Props {
  page: PageRecord;
  editable: boolean;
  onReady: (editor: NoteEditor | null) => void;
  /** 内容第一次被修改时调用 */
  onDirty?: () => void;
  /** 嵌在别的界面里（同步块、历史预览）：不提供新建子页面、数据库、同步块的命令 */
  nested?: boolean;
}

export function Editor({ page, editable, onReady, onDirty, nested }: Props) {
  const theme = useResolvedTheme();
  const pageId = page.id;

  const editor = useCreateBlockNote({
    schema,
    dictionary: zh,
    initialContent: page.content.length > 0 ? (page.content as PartialBlock<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>[]) : undefined,
    uploadFile,
    extensions: [syntaxHighlighter],
  });

  useEffect(() => {
    onReady(editor);
    return () => {
      onReady(null);
      // 离开页面时立刻写入尚未保存的修改
      void flushPatch(pageId);
    };
  }, [editor, onReady, pageId]);

  const slashItems = useMemo(
    () => async (query: string) => {
      const subPage: DefaultReactSuggestionItem = {
        title: "子页面",
        subtext: "在当前页面下新建一个页面",
        aliases: ["page", "subpage", "ye", "yemian", "zi", "ziyemian", "页面"],
        group: "页面",
        icon: <FilePlus2 size={18} />,
        onItemClick: async () => {
          const id = await createPage({ parentId: pageId });
          if (!id) return;
          editor.insertInlineContent([{ type: "pageMention", props: { pageId: id } }, " "]);
          updatePage(pageId, { content: editor.document });
          await flushPatch(pageId);
          navigate(id);
        },
      };
      const dbAliases = ["database", "table", "board", "kanban", "calendar", "shujuku", "biaoge", "rili", "表格", "看板", "日历"];
      const inlineDatabase: DefaultReactSuggestionItem = {
        title: "数据库（内嵌）",
        subtext: "在正文里直接放一个表格 / 看板 / 日历",
        aliases: [...dbAliases, "inline", "neiqian", "数据库"],
        group: "页面",
        icon: <Table2 size={18} />,
        onItemClick: async () => {
          const id = await createPage({ parentId: pageId, kind: "database", database: defaultDatabase("table") });
          if (!id) return;
          insertOrUpdateBlockForSlashMenu(editor, { type: "database", props: { pageId: id } });
        },
      };
      const fullDatabase: DefaultReactSuggestionItem = {
        title: "数据库（整页）",
        subtext: "新建一个数据库子页面并打开",
        aliases: [...dbAliases, "full", "zhengye", "数据库"],
        group: "页面",
        icon: <PanelTop size={18} />,
        onItemClick: async () => {
          const id = await createPage({ parentId: pageId, kind: "database", database: defaultDatabase("table") });
          if (!id) return;
          editor.insertInlineContent([{ type: "pageMention", props: { pageId: id } }, " "]);
          updatePage(pageId, { content: editor.document });
          await flushPatch(pageId);
          navigate(id);
        },
      };
      if (nested) return filterSuggestionItems(getDefaultReactSlashMenuItems(editor), query);

      const pages = Object.values(getState().pages).filter((p) => !p.trashed);
      const recent = (list: typeof pages) => list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);

      // 把已有的数据库嵌进来：和原数据库是同一份数据
      const linkedDatabases: DefaultReactSuggestionItem[] = recent(
        pages.filter((p) => p.kind === "database" && !p.hidden),
      ).map((p) => ({
        title: `链接数据库：${p.title || "无标题"}`,
        subtext: "把这个已有的数据库嵌到这里",
        aliases: [...dbAliases, "link", "lianjie", "链接", "数据库"],
        group: "页面",
        icon: <Link2 size={18} />,
        onItemClick: () => {
          insertOrUpdateBlockForSlashMenu(editor, { type: "database", props: { pageId: p.id } });
        },
      }));

      const syncAliases = ["sync", "synced", "tongbu", "同步", "同步块"];
      const newSynced: DefaultReactSuggestionItem = {
        title: "新建同步块",
        subtext: "新建一块可以在多个页面里同步显示的内容",
        aliases: syncAliases,
        group: "同步块",
        icon: <RefreshCw size={18} />,
        onItemClick: async () => {
          const id = await createPage({ hidden: true });
          if (!id) return;
          insertOrUpdateBlockForSlashMenu(editor, { type: "synced", props: { sourceId: id } });
        },
      };
      const existingSynced: DefaultReactSuggestionItem[] = recent(pages.filter((p) => p.hidden)).map((p) => ({
        title: `同步块：${p.title || "未命名"}`,
        subtext: "插入这个已有的同步块",
        aliases: syncAliases,
        group: "同步块",
        icon: <RefreshCw size={18} />,
        onItemClick: () => {
          insertOrUpdateBlockForSlashMenu(editor, { type: "synced", props: { sourceId: p.id } });
        },
      }));

      return filterSuggestionItems(
        [
          ...getDefaultReactSlashMenuItems(editor),
          subPage,
          inlineDatabase,
          fullDatabase,
          ...linkedDatabases,
          newSynced,
          ...existingSynced,
        ],
        query,
      );
    },
    [editor, pageId, nested],
  );

  const mentionItems = useMemo(
    () => async (query: string) => {
      const items: DefaultReactSuggestionItem[] = Object.values(getState().pages)
        .filter((p) => !p.trashed && !p.hidden && p.id !== pageId)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((p) => ({
          title: p.title || "无标题",
          icon: <span className="mention-item-icon">{p.icon ?? <FileText size={18} />}</span>,
          onItemClick: () => {
            editor.insertInlineContent([{ type: "pageMention", props: { pageId: p.id } }, " "]);
          },
        }));
      return filterSuggestionItems(items, query).slice(0, 12);
    },
    [editor, pageId],
  );

  return (
    <BlockNoteView
      editor={editor}
      theme={theme}
      editable={editable}
      slashMenu={false}
      onChange={() => {
        if (!editable) return;
        onDirty?.();
        updatePage(pageId, { content: editor.document });
      }}
    >
      <SuggestionMenuController triggerCharacter="/" getItems={slashItems} />
      <SuggestionMenuController triggerCharacter="@" getItems={mentionItems} />
    </BlockNoteView>
  );
}

// 同步块里嵌的也是这个编辑器；在这里登记，避免两个文件互相引用
registerNestedEditor(Editor as Parameters<typeof registerNestedEditor>[0]);
