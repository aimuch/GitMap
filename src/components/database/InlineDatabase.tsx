import { createReactBlockSpec } from "@blocknote/react";
import { Maximize2, Table2, Trash2, Undo2 } from "lucide-react";
import { getState, navigate, restorePage, updatePage, useStore } from "../../store";
import { Island } from "../Island";
import { DatabaseView } from "./DatabaseView";

/** 内嵌在正文里的数据库本体。它的数据就是一个普通的数据库子页面。 */
function DatabaseIsland({ pageId }: { pageId: string }) {
  const page = useStore((s) => s.pages[pageId]);

  if (!page || page.kind !== "database") {
    return (
      <div className="inline-db-missing">
        <Table2 size={16} /> 这个数据库已被永久删除，可以把这个块删掉。
      </div>
    );
  }

  if (page.trashed) {
    return (
      <div className="inline-db-missing">
        <Trash2 size={16} /> “{page.title || "无标题数据库"}”在回收站中。
        <button type="button" className="text-btn" onClick={() => void restorePage(pageId)}>
          <Undo2 size={14} /> 恢复
        </button>
      </div>
    );
  }

  return (
    <div className="inline-db">
      <div className="inline-db-head">
        <span className="tree-icon">{page.icon ?? <Table2 size={16} />}</span>
        <input
          className="inline-db-title"
          value={page.title}
          placeholder="无标题数据库"
          aria-label="数据库名称"
          onChange={(e) => updatePage(pageId, { title: e.target.value })}
          onKeyDown={(e) => {
            if (!e.nativeEvent.isComposing && e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <button type="button" className="db-open" title="作为整页打开" onClick={() => navigate(pageId)}>
          <Maximize2 size={12} /> 打开
        </button>
      </div>
      <DatabaseView page={page} />
    </div>
  );
}

export const createDatabaseBlock = createReactBlockSpec(
  {
    type: "database",
    propSchema: { pageId: { default: "" } },
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <Island
        id={block.props.pageId}
        className="inline-db-host"
        interactive={editor.isEditable}
        render={() => <DatabaseIsland pageId={block.props.pageId} />}
      />
    ),
    // 导出 Markdown 等外部格式时，退化成一个指向数据库页面的链接
    toExternalHTML: ({ block }) => {
      const page = getState().pages[block.props.pageId];
      return (
        <p>
          <a href={`#/${block.props.pageId}`}>{page?.title || "无标题数据库"}</a>
        </p>
      );
    },
  },
);
