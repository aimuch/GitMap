import { useEffect, useRef, useState, type DragEvent } from "react";
import { FileText, Kanban, Plus } from "lucide-react";
import type { DatabaseDef, PageMeta, PropertyDef, PropValue, SelectOption, ViewDef } from "../../../shared/types";
import { addProperty, ensureOption, setProp, updateProperty, updateView } from "../../db";
import { createPage, getState, navigate, updatePage } from "../../store";
import { cx } from "../Popover";
import { Tag, ValueDisplay } from "./cells";

interface Props {
  page: PageMeta;
  db: DatabaseDef;
  view: ViewDef;
  rows: PageMeta[];
  /** 新建卡片时预填的属性值（来自当前视图的筛选条件） */
  rowDefaults: Record<string, PropValue>;
}

/** 当前正在拖动的卡片 id */
let draggingCard: string | null = null;

export function BoardView({ page, db, view, rows, rowDefaults }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const selects = db.properties.filter((p) => p.type === "select");
  const group = selects.find((p) => p.id === view.groupBy) ?? selects[0];

  if (!group) {
    return (
      <div className="db-empty">
        <Kanban size={30} strokeWidth={1.5} />
        <p>看板需要按一个“单选”属性来分组，这个数据库里还没有。</p>
        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            const id = addProperty(page, "select");
            updateProperty(page, id, { name: "状态" });
            updateView(page, view.id, { groupBy: id });
          }}
        >
          <Plus size={16} /> 添加“状态”属性
        </button>
      </div>
    );
  }

  const options = group.options ?? [];
  const known = new Set(options.map((o) => o.id));
  const columns: { option: SelectOption | null; rows: PageMeta[] }[] = [
    { option: null, rows: rows.filter((r) => !known.has(String(r.props[group.id] ?? ""))) },
    ...options.map((option) => ({ option, rows: rows.filter((r) => r.props[group.id] === option.id) })),
  ];
  // 卡片上展示除分组属性外的其他属性
  const cardProps = db.properties.filter((p) => p.id !== group.id);

  const addCard = async (option: SelectOption | null) => {
    const id = await createPage({
      parentId: page.id,
      props: { ...rowDefaults, ...(option ? { [group.id]: option.id } : {}) },
    });
    if (id) setEditingId(id);
  };

  return (
    <div className="board">
      {columns.map(({ option, rows: cards }) => (
        <BoardColumn
          key={option?.id ?? "none"}
          option={option}
          cards={cards}
          group={group}
          cardProps={cardProps}
          editingId={editingId}
          onEditDone={() => setEditingId(null)}
          onAdd={() => void addCard(option)}
        />
      ))}
      <div className="board-column board-new-group">
        {addingGroup ? (
          <input
            autoFocus
            className="board-group-input"
            placeholder="分组名称"
            aria-label="新分组名称"
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name) ensureOption(page, group, name);
              setAddingGroup(false);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setAddingGroup(false);
            }}
          />
        ) : (
          <button type="button" className="board-add" onClick={() => setAddingGroup(true)}>
            <Plus size={15} /> 添加分组
          </button>
        )}
      </div>
    </div>
  );
}

interface ColumnProps {
  option: SelectOption | null;
  cards: PageMeta[];
  group: PropertyDef;
  cardProps: PropertyDef[];
  editingId: string | null;
  onEditDone: () => void;
  onAdd: () => void;
}

function BoardColumn({ option, cards, group, cardProps, editingId, onEditDone, onAdd }: ColumnProps) {
  const [over, setOver] = useState(false);

  const onDragOver = (e: DragEvent) => {
    if (!draggingCard) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOver(true);
  };

  const onDrop = (e: DragEvent) => {
    setOver(false);
    const id = draggingCard;
    if (!id) return;
    e.preventDefault();
    const row = getState().pages[id];
    // 已经在这一列里就不用动
    if (row && !cards.some((c) => c.id === id)) setProp(row, group.id, option?.id ?? null);
  };

  return (
    <div
      className={cx("board-column", over && "drag-over")}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={onDrop}
    >
      <div className="board-column-head">
        {option ? <Tag option={option} /> : <span className="board-none">未分组</span>}
        <span className="board-count">{cards.length}</span>
        <button
          type="button"
          className="icon-btn small"
          title="在这一列新建"
          aria-label={`在“${option?.name ?? "未分组"}”中新建`}
          onClick={onAdd}
        >
          <Plus size={15} />
        </button>
      </div>
      <div className="board-cards">
        {cards.map((card) => (
          <BoardCard
            key={card.id}
            card={card}
            cardProps={cardProps}
            editing={card.id === editingId}
            onEditDone={onEditDone}
          />
        ))}
      </div>
      <button type="button" className="board-add" onClick={onAdd}>
        <Plus size={15} /> 新建
      </button>
    </div>
  );
}

interface CardProps {
  card: PageMeta;
  cardProps: PropertyDef[];
  editing: boolean;
  onEditDone: () => void;
}

function BoardCard({ card, cardProps, editing, onEditDone }: CardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div
      className="board-card"
      role="button"
      tabIndex={0}
      draggable={!editing}
      onClick={() => {
        if (!editing) navigate(card.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) navigate(card.id);
      }}
      onDragStart={(e) => {
        draggingCard = card.id;
        e.dataTransfer.effectAllowed = "move";
        // 用自定义类型而不是 text/plain：内嵌在正文里时，卡片被拖到文字上不会把标题当文本插进去
        e.dataTransfer.setData("application/x-opennotion-row", card.id);
      }}
      onDragEnd={() => {
        draggingCard = null;
      }}
    >
      <div className="board-card-title">
        <span className="tree-icon">{card.icon ?? <FileText size={15} />}</span>
        {editing ? (
          <input
            ref={inputRef}
            className="cell-input cell-title"
            value={card.title}
            placeholder="输入名称…"
            aria-label="名称"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updatePage(card.id, { title: e.target.value })}
            onBlur={onEditDone}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
          />
        ) : (
          <span className={cx("board-card-name", !card.title && "untitled")}>{card.title || "无标题"}</span>
        )}
      </div>
      <CardValues card={card} defs={cardProps} />
    </div>
  );
}

function CardValues({ card, defs }: { card: PageMeta; defs: PropertyDef[] }) {
  const items = defs
    .map((def) => ({ def, node: ValueDisplay({ value: card.props[def.id], def }) }))
    .filter((item) => item.node !== null);
  if (items.length === 0) return null;
  return (
    <div className="board-card-props">
      {items.map(({ def, node }) => (
        <div key={def.id} className="board-card-prop">
          {node}
        </div>
      ))}
    </div>
  );
}
