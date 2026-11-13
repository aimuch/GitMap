import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Plus } from "lucide-react";
import type { DatabaseDef, PageMeta, PropertyDef, ViewDef } from "../../../shared/types";
import { addProperty, setProp, updateView } from "../../db";
import { getState, navigate, updatePage } from "../../store";
import { cx } from "../Popover";
import { ValueDisplay } from "./cells";

interface Props {
  page: PageMeta;
  db: DatabaseDef;
  view: ViewDef;
  rows: PageMeta[];
  /** 刚新建、正在就地输入名称的行 */
  editingId: string | null;
  onEditDone: () => void;
  /** 在某一天新建一行；date 为 YYYY-MM-DD */
  onCreate: (dateProp: string, date: string) => void;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const pad = (n: number) => String(n).padStart(2, "0");

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 当前正在拖动的行 id */
let draggingRow: string | null = null;

export function CalendarView({ page, db, view, rows, editingId, onEditDone, onCreate }: Props) {
  const dateProps = db.properties.filter((p) => p.type === "date");
  const dateDef = dateProps.find((p) => p.id === view.dateProp) ?? dateProps[0];
  const statusDef = db.properties.find((p) => p.type === "select");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [over, setOver] = useState<string | null>(null);
  const today = toIso(new Date());

  const { byDate, unscheduled } = useMemo(() => {
    const byDate = new Map<string, PageMeta[]>();
    const unscheduled: PageMeta[] = [];
    for (const row of rows) {
      const value = dateDef ? row.props[dateDef.id] : null;
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const list = byDate.get(value);
        if (list) list.push(row);
        else byDate.set(value, [row]);
      } else {
        unscheduled.push(row);
      }
    }
    return { byDate, unscheduled };
  }, [rows, dateDef]);

  // 新建的行不在当前显示的月份时，翻到它所在的月份
  useEffect(() => {
    if (!editingId || !dateDef) return;
    const value = getState().pages[editingId]?.props[dateDef.id];
    const m = typeof value === "string" ? /^(\d{4})-(\d{2})-/.exec(value) : null;
    if (m) setCursor({ year: Number(m[1]), month: Number(m[2]) - 1 });
    // 只在开始编辑某一行时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  if (!dateDef) {
    return (
      <div className="db-empty">
        <CalendarDays size={30} strokeWidth={1.5} />
        <p>日历需要按一个“日期”属性来排布，这个数据库里还没有。</p>
        <button
          type="button"
          className="primary-btn"
          onClick={() => updateView(page, view.id, { dateProp: addProperty(page, "date") })}
        >
          <Plus size={16} /> 添加“日期”属性
        </button>
      </div>
    );
  }

  const { year, month } = cursor;
  // 周一开头；按需要显示 4～6 周
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, i) => new Date(year, month, 1 - offset + i));

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const dropHandlers = (key: string, date: string | null) => ({
    onDragOver: (e: DragEvent) => {
      if (!draggingRow) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== key) setOver(key);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
    },
    onDrop: (e: DragEvent) => {
      setOver(null);
      const row = draggingRow ? getState().pages[draggingRow] : null;
      if (!row) return;
      e.preventDefault();
      if ((row.props[dateDef.id] ?? null) !== date) setProp(row, dateDef.id, date);
    },
  });

  const card = (row: PageMeta) => (
    <CalendarCard
      key={row.id}
      row={row}
      statusDef={statusDef}
      editing={row.id === editingId}
      onEditDone={onEditDone}
    />
  );

  return (
    <div className="calendar">
      <div className="cal-head">
        <h2 className="cal-title">
          {year}年{month + 1}月
        </h2>
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            const now = new Date();
            setCursor({ year: now.getFullYear(), month: now.getMonth() });
          }}
        >
          今天
        </button>
        <button type="button" className="icon-btn" title="上个月" aria-label="上个月" onClick={() => shift(-1)}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" className="icon-btn" title="下个月" aria-label="下个月" onClick={() => shift(1)}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="cal-scroll">
        <div className="cal-grid" role="grid" aria-label={`${year}年${month + 1}月`}>
          {WEEKDAYS.map((name, i) => (
            <div key={name} className={cx("cal-weekday", i >= 5 && "weekend")} role="columnheader">
              周{name}
            </div>
          ))}
          {days.map((d, i) => {
            const key = toIso(d);
            const outside = d.getMonth() !== month;
            const label = d.getDate() === 1 ? `${d.getMonth() + 1}月1日` : String(d.getDate());
            return (
              <div
                key={key}
                role="gridcell"
                aria-label={`${d.getMonth() + 1}月${d.getDate()}日`}
                className={cx(
                  "cal-cell",
                  outside && "outside",
                  i % 7 >= 5 && "weekend",
                  key === today && "today",
                  over === key && "drag-over",
                )}
                {...dropHandlers(key, key)}
              >
                <div className="cal-cell-head">
                  <button
                    type="button"
                    className="icon-btn small cal-add"
                    title="在这一天新建"
                    aria-label={`在${d.getMonth() + 1}月${d.getDate()}日新建`}
                    onClick={() => onCreate(dateDef.id, key)}
                  >
                    <Plus size={14} />
                  </button>
                  <span className="cal-day">{label}</span>
                </div>
                {byDate.get(key)?.map(card)}
              </div>
            );
          })}
        </div>
      </div>

      <div className={cx("cal-unscheduled", over === "none" && "drag-over")} {...dropHandlers("none", null)}>
        <div className="cal-unscheduled-title">
          未安排日期 <span>{unscheduled.length}</span>
        </div>
        {unscheduled.length > 0 ? (
          <div className="cal-unscheduled-list">{unscheduled.map(card)}</div>
        ) : (
          <div className="cal-unscheduled-hint">把卡片拖到这里可以清除它的日期</div>
        )}
      </div>
    </div>
  );
}

interface CardProps {
  row: PageMeta;
  statusDef: PropertyDef | undefined;
  editing: boolean;
  onEditDone: () => void;
}

function CalendarCard({ row, statusDef, editing, onEditDone }: CardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div
      className="cal-card"
      role="button"
      tabIndex={0}
      draggable={!editing}
      onClick={() => {
        if (!editing) navigate(row.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) navigate(row.id);
      }}
      onDragStart={(e) => {
        draggingRow = row.id;
        e.dataTransfer.effectAllowed = "move";
        // 用自定义类型而不是 text/plain：内嵌在正文里时，卡片被拖到文字上不会把标题当文本插进去
        e.dataTransfer.setData("application/x-opennotion-row", row.id);
      }}
      onDragEnd={() => {
        draggingRow = null;
      }}
    >
      <div className="cal-card-title">
        <span className="tree-icon">{row.icon ?? <FileText size={14} />}</span>
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
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
          />
        ) : (
          <span className={cx("cal-card-name", !row.title && "untitled")}>{row.title || "无标题"}</span>
        )}
      </div>
      {statusDef && <ValueDisplay value={row.props[statusDef.id]} def={statusDef} />}
    </div>
  );
}
