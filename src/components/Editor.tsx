import { useEffect, useMemo, useState } from "react";
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
import {
  Bookmark,
  FilePlus2,
  FileText,
  FileX2,
  Languages,
  Lightbulb,
  Link2,
  ListChecks,
  ListTree,
  PanelTop,
  RefreshCw,
  Sigma,
  Sparkles,
  Table2,
  WandSparkles,
} from "lucide-react";
import { defaultDatabase, shortId } from "../db";
import { AiInlineBar } from "./AiInlineBar";
import { createBookmarkBlock, createCalloutBlock, createEquationBlock, createTocBlock } from "./blocks";
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
      <span className="page-chip-icon">
        {gone ? <FileX2 size={15} /> : (page.icon ?? (page.kind === "database" ? <Table2 size={15} /> : <FileText size={15} />))}
      </span>
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
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
    callout: createCalloutBlock(),
    toc: createTocBlock(),
    equation: createEquationBlock(),
    bookmark: createBookmarkBlock(),
    database: createDatabaseBlock(),
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
  /** 同步块实时广播回调 */
  onContentSync?: (blocks: unknown[]) => void;
  /** 外部（如空白页“AI 帮我写”）触发打开内联 AI 的计数信号 */
  aiTrigger?: number;
  /** 嵌在别的界面里（同步块、历史预览）：不提供新建子页面、数据库、同步块的命令 */
  nested?: boolean;
}

export function Editor({ page, editable, onReady, onDirty, onContentSync, aiTrigger, nested }: Props) {
  const theme = useResolvedTheme();
  const pageId = page.id;
  const pageTitle = useStore((s) => s.pages[pageId]?.title ?? page.title);
  const [aiBar, setAiBar] = useState<{
    selectedText: string;
    actionId?: string | null;
    anchorBlockId?: string;
  } | null>(null);
  const [selectedSnippet, setSelectedSnippet] = useState("");

  const editor = useCreateBlockNote({
    schema,
    dictionary: zh,
    initialContent:
      page.content.length > 0
        ? (page.content as PartialBlock<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>[])
        : undefined,
    uploadFile,
    extensions: [syntaxHighlighter],
  });

  useEffect(() => {
    onReady(editor);
    return () => {
      onReady(null);
      void flushPatch(pageId);
    };
  }, [editor, onReady, pageId]);

  useEffect(() => {
    if (aiTrigger && aiTrigger > 0 && editable && !nested) {
      setAiBar({ selectedText: editor.getSelectedText() || "", actionId: null });
    }
  }, [aiTrigger, editable, nested, editor]);

  const openInlineAi = (actionId: string | null = null) => {
    const selText = editor.getSelectedText() || "";
    let anchorBlockId: string | undefined;
    try {
      anchorBlockId = editor.getTextCursorPosition().block.id;
    } catch {
      anchorBlockId = undefined;
    }
    setAiBar({ selectedText: selText, actionId, anchorBlockId });
  };

  const slashItems = useMemo(
    () => async (query: string) => {
      const calloutItem: DefaultReactSuggestionItem = {
        title: "提示框",
        subtext: "带图标和底色的重点提示块",
        aliases: ["callout", "tip", "alert", "note", "tishikuang", "高亮", "提示框"],
        group: "常用扩展块",
        icon: <Lightbulb size={18} />,
        onItemClick: () => {
          insertOrUpdateBlockForSlashMenu(editor, { type: "callout", props: { icon: "💡", tone: "gray" } });
        },
      };
      const tocItem: DefaultReactSuggestionItem = {
        title: "目录",
        subtext: "自动提取本页各级标题并生成跳转大纲",
        aliases: ["toc", "outline", "contents", "mulu", "dagang", "目录", "大纲"],
        group: "常用扩展块",
        icon: <ListTree size={18} />,
        onItemClick: () => {
          insertOrUpdateBlockForSlashMenu(editor, { type: "toc" });
        },
      };
      const equationItem: DefaultReactSuggestionItem = {
        title: "数学公式",
        subtext: "插入独立排版的数学或 LaTeX 公式块",
        aliases: ["math", "latex", "equation", "formula", "gongshi", "公式", "数学"],
        group: "常用扩展块",
        icon: <Sigma size={18} />,
        onItemClick: () => {
          insertOrUpdateBlockForSlashMenu(editor, { type: "equation", props: { latex: "" } });
        },
      };
      const bookmarkItem: DefaultReactSuggestionItem = {
        title: "网页书签",
        subtext: "抓取网页标题与摘要，生成可视书签卡片",
        aliases: ["bookmark", "embed", "link", "url", "shuqian", "书签", "链接卡片"],
        group: "常用扩展块",
        icon: <Bookmark size={18} />,
        onItemClick: () => {
          insertOrUpdateBlockForSlashMenu(editor, { type: "bookmark", props: { url: "" } });
        },
      };

      if (nested) {
        return filterSuggestionItems(
          [...getDefaultReactSlashMenuItems(editor), calloutItem, equationItem, bookmarkItem],
          query,
        );
      }

      const aiItems: DefaultReactSuggestionItem[] = [
        {
          title: "AI 写作助手",
          subtext: "起草、改写、翻译、头脑风暴（支持国产/国外/自定义模型）",
          aliases: ["ai", "gpt", "deepseek", "kimi", "qwen", "doubao", "claude", "xiezuo", "助手"],
          group: "AI 助手",
          icon: <Sparkles size={18} />,
          onItemClick: () => openInlineAi(null),
        },
        {
          title: "AI 总结本页",
          subtext: "提炼当前页面的核心结论与要点",
          aliases: ["ai", "summary", "summarize", "zongjie", "总结"],
          group: "AI 助手",
          icon: <WandSparkles size={18} />,
          onItemClick: () => openInlineAi("summarize"),
        },
        {
          title: "AI 顺着续写",
          subtext: "根据上文语境自然往下续写",
          aliases: ["ai", "continue", "xuxie", "续写"],
          group: "AI 助手",
          icon: <Sparkles size={18} />,
          onItemClick: () => openInlineAi("continue"),
        },
        {
          title: "AI 提取待办",
          subtext: "从正文中抽取可执行的复选清单",
          aliases: ["ai", "todo", "action", "daiban", "待办"],
          group: "AI 助手",
          icon: <ListChecks size={18} />,
          onItemClick: () => openInlineAi("todos"),
        },
        {
          title: "AI 翻译本页",
          subtext: "将内容翻译为英文或其他语言",
          aliases: ["ai", "translate", "fanyi", "翻译"],
          group: "AI 助手",
          icon: <Languages size={18} />,
          onItemClick: () => openInlineAi("translate_en"),
        },
      ];

      const subPage: DefaultReactSuggestionItem = {
        title: "子页面",
        subtext: "在当前页面下新建一个页面",
        aliases: ["page", "subpage", "ye", "yemian", "zi", "ziyemian", "页面"],
        group: "页面与数据库",
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
      const dbAliases = ["database", "table", "board", "kanban", "calendar", "list", "shujuku", "biaoge", "rili", "表格", "看板", "日历", "列表"];
      const inlineDatabase: DefaultReactSuggestionItem = {
        title: "数据库（内嵌）",
        subtext: "在正文里直接放一个表格 / 看板 / 列表 / 日历",
        aliases: [...dbAliases, "inline", "neiqian", "数据库"],
        group: "页面与数据库",
        icon: <Table2 size={18} />,
        onItemClick: async () => {
          const id = await createPage({ parentId: pageId, kind: "database", database: defaultDatabase("table") });
          if (!id) return;
          insertOrUpdateBlockForSlashMenu(editor, { type: "database", props: { pageId: id, blockKey: shortId() } });
        },
      };
      const fullDatabase: DefaultReactSuggestionItem = {
        title: "数据库（整页）",
        subtext: "新建一个数据库子页面并打开",
        aliases: [...dbAliases, "full", "zhengye", "数据库"],
        group: "页面与数据库",
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

      const pages = Object.values(getState().pages).filter((p) => !p.trashed);
      const recent = (list: typeof pages) => list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);

      const linkedDatabases: DefaultReactSuggestionItem[] = recent(
        pages.filter((p) => p.kind === "database" && !p.hidden),
      ).map((p) => ({
        title: `链接数据库：${p.title || "无标题"}`,
        subtext: "把这个已有的数据库嵌到这里（可独立切换视图）",
        aliases: [...dbAliases, "link", "lianjie", "链接", "数据库"],
        group: "页面与数据库",
        icon: <Link2 size={18} />,
        onItemClick: () => {
          insertOrUpdateBlockForSlashMenu(editor, {
            type: "database",
            props: { pageId: p.id, blockKey: shortId(), linked: "true" },
          });
        },
      }));

      const syncAliases = ["sync", "synced", "tongbu", "同步", "同步块"];
      const newSynced: DefaultReactSuggestionItem = {
        title: "新建同步块",
        subtext: "新建一块可以在多个页面里实时同步显示的内容",
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
          ...aiItems,
          calloutItem,
          tocItem,
          equationItem,
          bookmarkItem,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleAiInsert = async (markdown: string, mode: "insert" | "replace") => {
    const parsed = await editor.tryParseMarkdownToBlocks(markdown);
    if (parsed.length === 0) {
      setAiBar(null);
      return;
    }
    const sel = editor.getSelection();
    if (mode === "replace" && sel && sel.blocks.length > 0) {
      editor.replaceBlocks(sel.blocks, parsed);
    } else {
      const anchor =
        (aiBar?.anchorBlockId && editor.document.find((b) => b.id === aiBar.anchorBlockId)) ||
        editor.document[editor.document.length - 1];
      if (anchor) editor.insertBlocks(parsed, anchor, "after");
      else editor.replaceBlocks(editor.document, parsed);
    }
    onDirty?.();
    updatePage(pageId, { content: editor.document });
    setAiBar(null);
  };

  return (
    <div className="editor-wrap">
      {editable && !nested && selectedSnippet && !aiBar && (
        <div className="ai-selection-pill">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => openInlineAi(null)}
          >
            <Sparkles size={13} /> AI 改写 / 翻译所选内容
          </button>
        </div>
      )}
      {aiBar && !nested && (
        <AiInlineBar
          pageTitle={pageTitle}
          selectedText={aiBar.selectedText}
          initialActionId={aiBar.actionId}
          getPageMarkdown={() => editor.blocksToMarkdownLossy(editor.document)}
          onInsert={handleAiInsert}
          onClose={() => setAiBar(null)}
        />
      )}
      <BlockNoteView
        editor={editor}
        theme={theme}
        editable={editable}
        slashMenu={false}
        onSelectionChange={() => {
          if (!editable || nested) return;
          setSelectedSnippet(editor.getSelectedText().trim());
        }}
        onChange={() => {
          if (!editable) return;
          onDirty?.();
          onContentSync?.(editor.document);
          updatePage(pageId, { content: editor.document });
        }}
      >
        <SuggestionMenuController triggerCharacter="/" getItems={slashItems} />
        <SuggestionMenuController triggerCharacter="@" getItems={mentionItems} />
      </BlockNoteView>
    </div>
  );
}

// 同步块里嵌的也是这个编辑器；在这里登记，避免两个文件互相引用
registerNestedEditor(Editor as unknown as Parameters<typeof registerNestedEditor>[0]);
