import { useEffect, useRef, useState } from "react";
import { ChevronRight, CornerDownRight, FileText, Plus, Trash2 } from "lucide-react";
import type { DatabaseDef, PageMeta, PropertyDef, PropValue, ViewDef } from "../../../shared/types";
import { SUB_PARENT_KEY, buildSubItemTree, cellValue, groupRowsByProp } from "../../db";
import { navigate, setPeekRowId, trashPage, updatePage } from "../../store";
import { cx } from "../Popover";
import { Tag, ValueDisplay } from "./cells";

interface Props {
  db: DatabaseDef;
  view: ViewDef;
  rows: PageMeta[];
  defs: PropertyDef[];
  editingId: string | null;
  onEditDone: () => void;
  onPatchView: (patch: Partial<ViewDef>) => void;
  onCreate: (props?: Record<string, PropValue>) => void;
}

/** 列表视图：紧凑展示图标、名称与属性摘要，支持按任意属性折叠分组及子任务树展开 */
export function ListView({ db, view, rows, defs, editingId, onEditDone, onPatchView, onCreate }: Props) {
  const [collapsedSubs, setCollapsedSubs] = useState<Set<string>>(() => new Set());
  const collapsedGroups = new Set(view.collapsedGroups ?? []);
  const groups = groupRowsByProp(rows, db, view.groupBy);

  const toggleGroup = (key: string) => {
    const next = collapsedGroups.has(key)
      ? (view.collapsedGroups ?? []).filter((k) => k !== key)
      : [...(view.collapsedGroups ?? []), key];
    onPatchView({ collapsedGroups: next });
  };

  const renderItems = (list: PageMeta[]) => {
    const items = db.subItemsEnabled
      ? buildSubItemTree(list, collapsedSubs)
      : list.map((row) => ({ row, depth: 0, childCount: 0 }));

    return items.map(({ row, depth, childCount }) => (
      <ListRow
        key={row.id}
        row={row}
        depth={depth}
        childCount={childCount}
        subCollapsed={collapsedSubs.has(row.id)}
        subItemsEnabled={Boolean(db.subItemsEnabled)}
        onToggleSub={() =>
          setCollapsedSubs((prev) => {
            const next = new Set(prev);
            if (next.has(row.id)) next.delete(row.id);
            else next.add(row.id);
            return next;
          })
        }
        onAddSubItem={() => onCreate({ [SUB_PARENT_KEY]: row.id })}
        defs={defs}
        editing={row.id === editingId}
        onEditDone={onEditDone}
      />
    ));
  };

  return (
    <div className="db-list">
      {groups
        ? groups.map((g) => {
            const isCollapsed = collapsedGroups.has(g.key);
            return (
              <div key={g.key} className="db-list-group">
                <div className="db-group-bar">
                  <button type="button" className="db-group-toggle" onClick={() => toggleGroup(g.key)}>
                    <ChevronRight size={14} className={cx("db-group-chevron", !isCollapsed && "open")} />
                    {g.option ? <Tag option={g.option} /> : <span className="db-group-name">{g.label}</span>}
                    <span className="board-count">{g.rows.length}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn small"
                    title={`在“${g.label}”下新建`}
                    onClick={() => onCreate(g.defaultProps)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {!isCollapsed && renderItems(g.rows)}
              </div>
            );
          })
        : renderItems(rows)}
      <button type="button" className="db-add-row" onClick={() => onCreate()}>
        <Plus size={15} /> 新建
      </button>
    </div>
  );
}

function ListRow({
  row,
  depth,
  childCount,
  subCollapsed,
  subItemsEnabled,
  onToggleSub,
  onAddSubItem,
  defs,
  editing,
  onEditDone,
}: {
  row: PageMeta;
  depth: number;
  childCount: number;
  subCollapsed: boolean;
  subItemsEnabled: boolean;
  onToggleSub: () => void;
  onAddSubItem: () => void;
  defs: PropertyDef[];
  editing: boolean;
  onEditDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div
      className="db-list-row"
      role="button"
      tabIndex={0}
      style={depth > 0 ? { paddingLeft: 8 + depth * 20 } : undefined}
      onMouseDown={() => {
        wasEditing.current = editing;
      }}
      onClick={(e) => {
        if (editing || wasEditing.current) {
          wasEditing.current = false;
          return;
        }
        if (e.metaKey || e.ctrlKey) navigate(row.id);
        else setPeekRowId(row.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) setPeekRowId(row.id);
      }}
    >
      {subItemsEnabled && (
        <button
          type="button"
          className={cx("tree-toggle", !subCollapsed && childCount > 0 && "open", childCount === 0 && "hidden")}
          disabled={childCount === 0}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSub();
          }}
        >
          <ChevronRight size={13} />
        </button>
      )}
      <span className="tree-icon">{row.icon ?? <FileText size={15} />}</span>
      {editing ? (
        <input
          ref={inputRef}
          className="cell-input cell-title"
          value={row.title}
          placeholder="输入名称…"
          aria-label="名称"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updatePage(row.id, { title: e.target.value })}
          onBlur={onEditDone}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.stopPropagation();
              e.currentTarget.blur();
            }
          }}
        />
      ) : (
        <span className={cx("db-list-title", !row.title && "untitled")}>{row.title || "无标题"}</span>
      )}
      <div className="db-list-props">
        {defs.map((def) => {
          const node = ValueDisplay({ value: cellValue(row, def), def });
          return node ? (
            <span key={def.id} className="db-list-prop">
              {node}
            </span>
          ) : null;
        })}
      </div>
      {subItemsEnabled && (
        <button
          type="button"
          className="db-open db-list-del"
          title="新建子任务"
          onClick={(e) => {
            e.stopPropagation();
            onAddSubItem();
          }}
        >
          <CornerDownRight size={11} /> 子项
        </button>
      )}
      <button
        type="button"
        className="icon-btn small db-list-del"
        title="移到回收站"
        aria-label={`把“${row.title || "无标题"}”移到回收站`}
        onClick={(e) => {
          e.stopPropagation();
          void trashPage(row.id);
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
