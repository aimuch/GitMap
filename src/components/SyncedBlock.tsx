import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { RefreshCw } from "lucide-react";
import type { PageRecord } from "../../shared/types";
import { fetchPage, getState, updatePage, useStore } from "../store";
import { Island } from "./Island";

interface NestedEditorProps {
  page: PageRecord;
  editable: boolean;
  onReady: (editor: null) => void;
  nested?: boolean;
}

/**
 * 同步块里要再放一个编辑器，而编辑器的定义又要引用同步块，两个文件会互相依赖。
 * 所以由编辑器那边在加载后把自己登记进来。
 */
let NestedEditor: ComponentType<NestedEditorProps> | null = null;

export function registerNestedEditor(component: ComponentType<NestedEditorProps>) {
  NestedEditor = component;
}

/** 同步块的内容存成一个不显示在页面树里的内部页面，所有引用它的块编辑的是同一份。 */
function SyncedIsland({ sourceId }: { sourceId: string }) {
  const source = useStore((s) => s.pages[sourceId]);
  const [record, setRecord] = useState<PageRecord | null>(null);
  const [failed, setFailed] = useState(false);
  const noop = useCallback(() => {}, []);

  useEffect(() => {
    let alive = true;
    fetchPage(sourceId).then(
      (r) => alive && setRecord(r),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [sourceId]);

  if (failed || (!source && record === null && getState().loaded && !getState().pages[sourceId])) {
    return <div className="inline-db-missing">这个同步块的内容已被删除，可以把这个块删掉。</div>;
  }

  return (
    <div className="synced">
      <div className="synced-head">
        <RefreshCw size={13} />
        <input
          value={source?.title ?? ""}
          placeholder="给同步块起个名字"
          aria-label="同步块名称"
          onChange={(e) => updatePage(sourceId, { title: e.target.value })}
        />
        <span className="synced-hint">在别处输入 /同步 可插入同一个块</span>
      </div>
      {record && NestedEditor ? (
        <NestedEditor page={record} editable onReady={noop} nested />
      ) : (
        <div className="synced-loading">正在加载…</div>
      )}
    </div>
  );
}

function SyncedHost({ sourceId, interactive }: { sourceId: string; interactive: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [nestedInside, setNestedInside] = useState(false);

  // 同步块里再放同一个同步块会无限套娃，直接拒绝嵌套
  useEffect(() => {
    setNestedInside(!!ref.current?.parentElement?.closest(".synced"));
  }, []);

  return (
    <div ref={ref} className="synced-wrap">
      {nestedInside ? (
        <div className="inline-db-missing">同步块里不能再放同步块。</div>
      ) : (
        <Island
          id={sourceId}
          className="synced-host"
          interactive={interactive}
          render={() => <SyncedIsland sourceId={sourceId} />}
        />
      )}
    </div>
  );
}

export const createSyncedBlock = createReactBlockSpec(
  {
    type: "synced",
    propSchema: { sourceId: { default: "" } },
    content: "none",
  },
  {
    render: ({ block, editor }) => <SyncedHost sourceId={block.props.sourceId} interactive={editor.isEditable} />,
    toExternalHTML: ({ block }) => {
      const source = getState().pages[block.props.sourceId];
      return <p>（同步块：{source?.title || "未命名"}）</p>;
    },
  },
);
