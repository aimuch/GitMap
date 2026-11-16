import { createReactBlockSpec } from "@blocknote/react";
import { Link2, Maximize2, Table2, Trash2, Undo2 } from "lucide-react";
import { getState, navigate, restorePage, updatePage, useStore } from "../../store";
import { Island } from "../Island";
import { DatabaseView } from "./DatabaseView";

/** 内嵌在正文里的数据库本体。链接数据库可各自记住当前选中的视图标签。 */
function DatabaseIsland({ pageId, blockKey, linked }: { pageId: string; blockKey: string; linked: boolean }) {
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
        {linked && (
          <span className="tree-badge" title="与原数据库共享同一份数据">
            <Link2 size={11} /> 链接
          </span>
        )}
        <button type="button" className="db-open" title="作为整页打开" onClick={() => navigate(pageId)}>
          <Maximize2 size={12} /> 打开
        </button>
      </div>
      <DatabaseView page={page} viewStorageKey={blockKey ? `view:${pageId}:${blockKey}` : `view:${pageId}`} />
    </div>
  );
}

export const createDatabaseBlock = createReactBlockSpec(
  {
    type: "database",
    propSchema: {
      pageId: { default: "" },
      blockKey: { default: "" },
      linked: { default: "false" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <Island
        id={`${block.props.pageId}:${block.props.blockKey}`}
        className="inline-db-host"
        interactive={editor.isEditable}
        render={() => (
          <DatabaseIsland
            pageId={block.props.pageId}
            blockKey={block.props.blockKey}
            linked={block.props.linked === "true"}
          />
        )}
      />
    ),
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
