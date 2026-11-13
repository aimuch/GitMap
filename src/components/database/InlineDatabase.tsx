import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createReactBlockSpec } from "@blocknote/react";
import { Maximize2, Table2, Trash2, Undo2 } from "lucide-react";
import { getState, navigate, restorePage, updatePage, useStore } from "../../store";
import { DatabaseView } from "./DatabaseView";

/**
 * 这些事件在内嵌数据库里发生时，不让它们冒泡到编辑器：
 * 否则编辑器会把在数据库里打字、拖卡片当成是在编辑正文。
 * 鼠标移动类事件不拦，块左侧的拖动手柄仍然要靠它们显示。
 */
const ISOLATED_EVENTS = [
  "keydown",
  "keyup",
  "keypress",
  "beforeinput",
  "input",
  "compositionstart",
  "compositionupdate",
  "compositionend",
  "paste",
  "copy",
  "cut",
  "mousedown",
  "click",
  "dblclick",
  "contextmenu",
  "dragstart",
  "dragenter",
  "dragover",
  "dragleave",
  "drop",
  "dragend",
];

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

/**
 * 把数据库渲染成一个独立的 React 根（“孤岛”），并在它外面拦住事件。
 * 这样数据库有自己的事件入口，编辑器完全感知不到里面的操作。
 */
function IslandHost({ pageId, interactive }: { pageId: string; interactive: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const mount = document.createElement("div");
    host.appendChild(mount);
    const root = createRoot(mount);
    root.render(<DatabaseIsland pageId={pageId} />);

    const stop = (e: Event) => e.stopPropagation();
    for (const type of ISOLATED_EVENTS) host.addEventListener(type, stop);

    return () => {
      for (const type of ISOLATED_EVENTS) host.removeEventListener(type, stop);
      // 不能在外层 React 渲染过程中同步卸载另一个根，推迟到下一个任务
      window.setTimeout(() => {
        root.unmount();
        mount.remove();
      }, 0);
    };
  }, [pageId]);

  return <div ref={hostRef} className="inline-db-host" contentEditable={false} inert={!interactive} />;
}

export const createDatabaseBlock = createReactBlockSpec(
  {
    type: "database",
    propSchema: { pageId: { default: "" } },
    content: "none",
  },
  {
    render: ({ block, editor }) => <IslandHost pageId={block.props.pageId} interactive={editor.isEditable} />,
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
