import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, GanttChart, Plus } from "lucide-react";
import type { DatabaseDef, PageMeta, ViewDef } from "../../../shared/types";
import { addProperty } from "../../db";
import { navigate, setPeekRowId } from "../../store";
import { cx } from "../Popover";
import { toIso } from "./CalendarView";

interface Props {
  page: PageMeta;
  db: DatabaseDef;
  view: ViewDef;
  rows: PageMeta[];
  onPatchView: (patch: Partial<ViewDef>) => void;
  onCreate: (dateProp: string, date: string) => void;
}

const DAY = 86_400_000;
const DAY_WIDTH = 34;
const ROW_HEIGHT = 36;
const HEAD_HEIGHT = 50;
/** 一屏显示多少天 */
const SPAN = 42;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const parse = (value: unknown): number | null => {
  const m = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** 时间轴：每行一条横条，并在配置了前后置依赖列时绘制 SVG 依赖箭头与冲突提示。 */
export function TimelineView({ page, db, view, rows, onPatchView, onCreate }: Props) {
  const dateProps = db.properties.filter((p) => p.type === "date");
  const startDef = dateProps.find((p) => p.id === view.dateProp) ?? dateProps[0];
  const endDef = dateProps.find((p) => p.id === view.endProp && p.id !== startDef?.id);
  const depDef = db.dependencyProp ? db.properties.find((p) => p.id === db.dependencyProp && p.type === "relation") : undefined;
  const [origin, setOrigin] = useState(() => startOfDay(new Date()) - 7 * DAY);
  const today = startOfDay(new Date());

  const days = useMemo(
    () =>
      Array.from({ length: SPAN }, (_, i) => {
        const base = new Date(origin);
        return new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      }),
    [origin],
  );

  if (!startDef) {
    return (
      <div className="db-empty">
        <GanttChart size={30} strokeWidth={1.5} />
        <p>时间轴需要按“日期”属性来排布，这个数据库里还没有。</p>
        <button
          type="button"
          className="primary-btn"
          onClick={() => onPatchView({ dateProp: addProperty(page, "date") })}
        >
          <Plus size={16} /> 添加“日期”属性
        </button>
      </div>
    );
  }

  const first = days[0].getTime();
  const last = days[SPAN - 1].getTime();
  const dayIndex = (time: number) => Math.round((time - first) / DAY);
  const shift = (count: number) => {
    const base = new Date(origin);
    setOrigin(new Date(base.getFullYear(), base.getMonth(), base.getDate() + count).getTime());
  };

  const scheduled: { row: PageMeta; from: number; to: number }[] = [];
  const unscheduled: PageMeta[] = [];
  for (const row of rows) {
    const from = parse(row.props[startDef.id]);
    if (from === null) {
      unscheduled.push(row);
      continue;
    }
    const end = endDef ? parse(row.props[endDef.id]) : null;
    scheduled.push({ row, from, to: end !== null && end >= from ? end : from });
  }

  // 计算前后置依赖箭头几何坐标
  const scheduledIndex = new Map(scheduled.map((item, idx) => [item.row.id, { ...item, idx }]));
  const depEdges: { key: string; d: string; conflict: boolean }[] = [];
  if (depDef) {
    scheduled.forEach(({ row, from }, targetIdx) => {
      const predIds = Array.isArray(row.props[depDef.id]) ? (row.props[depDef.id] as string[]) : [];
      for (const predId of predIds) {
        const pred = scheduledIndex.get(predId);
        if (!pred) continue;
        const predEndCol = Math.max(0, Math.min(SPAN - 1, dayIndex(pred.to)));
        const targetStartCol = Math.max(0, Math.min(SPAN - 1, dayIndex(from)));
        const x1 = 200 + (predEndCol + 1) * DAY_WIDTH - 2;
        const y1 = HEAD_HEIGHT + pred.idx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const x2 = 200 + targetStartCol * DAY_WIDTH + 2;
        const y2 = HEAD_HEIGHT + targetIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const conflict = from < pred.to;
        const midX = x2 >= x1 + 14 ? (x1 + x2) / 2 : x1 + 14;
        const d =
          x2 >= x1 + 10
            ? `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
            : `M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x1 + 10} ${(y1 + y2) / 2} L ${x2 - 10} ${(y1 + y2) / 2} L ${x2 - 10} ${y2} L ${x2} ${y2}`;
        depEdges.push({ key: `${predId}->${row.id}`, d, conflict });
      }
    });
  }

  const monthLabel = (d: Date, i: number) => (i === 0 || d.getDate() === 1 ? `${d.getFullYear()}年${d.getMonth() + 1}月` : "");

  return (
    <div className="timeline">
      <div className="cal-head">
        <h2 className="cal-title">
          {days[0].getMonth() + 1}月{days[0].getDate()}日 – {days[SPAN - 1].getMonth() + 1}月{days[SPAN - 1].getDate()}日
        </h2>
        <button type="button" className="text-btn" onClick={() => setOrigin(today - 7 * DAY)}>
          今天
        </button>
        <button type="button" className="icon-btn" title="往前两周" aria-label="往前两周" onClick={() => shift(-14)}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" className="icon-btn" title="往后两周" aria-label="往后两周" onClick={() => shift(14)}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="timeline-scroll">
        <div className="timeline-grid" style={{ width: 200 + SPAN * DAY_WIDTH, position: "relative" }}>
          {depEdges.length > 0 && (
            <svg
              className="timeline-deps-svg"
              width={200 + SPAN * DAY_WIDTH}
              height={HEAD_HEIGHT + scheduled.length * ROW_HEIGHT}
              aria-label="前后置依赖连线"
            >
              <defs>
                <marker id="tl-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,1 L7,4 L0,7 Z" fill="var(--accent)" />
                </marker>
                <marker id="tl-arrow-err" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,1 L7,4 L0,7 Z" fill="var(--danger)" />
                </marker>
              </defs>
              {depEdges.map((edge) => (
                <path
                  key={edge.key}
                  d={edge.d}
                  fill="none"
                  stroke={edge.conflict ? "var(--danger)" : "var(--accent)"}
                  strokeWidth="1.6"
                  strokeDasharray={edge.conflict ? "4 2" : undefined}
                  markerEnd={edge.conflict ? "url(#tl-arrow-err)" : "url(#tl-arrow)"}
                  opacity="0.82"
                />
              ))}
            </svg>
          )}

          <div className="timeline-row timeline-head">
            <div className="timeline-name">名称</div>
            <div className="timeline-track" style={{ width: SPAN * DAY_WIDTH }}>
              {days.map((d, i) => (
                <div
                  key={d.getTime()}
                  className={cx(
                    "timeline-day",
                    (d.getDay() === 0 || d.getDay() === 6) && "weekend",
                    d.getTime() === today && "today",
                  )}
                  style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                >
                  <span className="timeline-month">{monthLabel(d, i)}</span>
                  <span className="timeline-weekday">{WEEKDAYS[d.getDay()]}</span>
                  <span className="timeline-date">{d.getDate()}</span>
                </div>
              ))}
            </div>
          </div>

          {scheduled.map(({ row, from, to }) => {
            const visible = to >= first && from <= last;
            const a = Math.max(0, dayIndex(from));
            const b = Math.min(SPAN - 1, dayIndex(to));
            return (
              <div key={row.id} className="timeline-row">
                <button
                  type="button"
                  className="timeline-name"
                  onClick={(e) => (e.metaKey || e.ctrlKey ? navigate(row.id) : setPeekRowId(row.id))}
                >
                  <span className="tree-icon">{row.icon ?? <FileText size={15} />}</span>
                  <span className="timeline-title">{row.title || "无标题"}</span>
                </button>
                <div className="timeline-track" style={{ width: SPAN * DAY_WIDTH }}>
                  {days.map((d, i) =>
                    d.getDay() === 0 || d.getDay() === 6 || d.getTime() === today ? (
                      <span
                        key={d.getTime()}
                        className={cx("timeline-stripe", d.getTime() === today && "today")}
                        style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                      />
                    ) : null,
                  )}
                  {visible ? (
                    <button
                      type="button"
                      className={cx("timeline-bar", from < first && "cut-left", to > last && "cut-right")}
                      style={{ left: a * DAY_WIDTH + 2, width: (b - a + 1) * DAY_WIDTH - 4 }}
                      title={`${toIso(new Date(from))}${to > from ? ` → ${toIso(new Date(to))}` : ""}`}
                      onClick={(e) => (e.metaKey || e.ctrlKey ? navigate(row.id) : setPeekRowId(row.id))}
                    >
                      {row.title || "无标题"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={cx("timeline-jump", to < first ? "left" : "right")}
                      title="跳到这一行所在的日期"
                      onClick={() => setOrigin(from - 7 * DAY)}
                    >
                      {to < first ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                      {toIso(new Date(from))}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="timeline-row">
            <button type="button" className="timeline-name timeline-add" onClick={() => onCreate(startDef.id, toIso(new Date()))}>
              <Plus size={15} /> 新建
            </button>
            <div className="timeline-track" style={{ width: SPAN * DAY_WIDTH }} />
          </div>
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="cal-unscheduled">
          <div className="cal-unscheduled-title">
            未安排日期 <span>{unscheduled.length}</span>
          </div>
          <div className="timeline-unscheduled">
            {unscheduled.map((row) => (
              <button
                key={row.id}
                type="button"
                className="row-chip row-chip-button"
                onClick={(e) => (e.metaKey || e.ctrlKey ? navigate(row.id) : setPeekRowId(row.id))}
              >
                <span className="row-chip-icon">{row.icon ?? <FileText size={13} />}</span>
                <span className="tag-name">{row.title || "无标题"}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
