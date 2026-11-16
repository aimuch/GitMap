import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, GanttChart, Plus } from "lucide-react";
import type { DatabaseDef, PageMeta, ViewDef } from "../../../shared/types";
import { addProperty, updateView } from "../../db";
import { navigate } from "../../store";
import { cx } from "../Popover";
import { toIso } from "./CalendarView";

interface Props {
  page: PageMeta;
  db: DatabaseDef;
  view: ViewDef;
  rows: PageMeta[];
  onCreate: (dateProp: string, date: string) => void;
}

const DAY = 86_400_000;
const DAY_WIDTH = 34;
/** 一屏显示多少天 */
const SPAN = 42;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const parse = (value: unknown): number | null => {
  const m = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** 时间轴：每行一条横条，从开始日期画到结束日期。 */
export function TimelineView({ page, db, view, rows, onCreate }: Props) {
  const dateProps = db.properties.filter((p) => p.type === "date");
  const startDef = dateProps.find((p) => p.id === view.dateProp) ?? dateProps[0];
  const endDef = dateProps.find((p) => p.id === view.endProp && p.id !== startDef?.id);
  // 默认从一周前开始，今天落在偏左的位置
  const [origin, setOrigin] = useState(() => startOfDay(new Date()) - 7 * DAY);
  const today = startOfDay(new Date());

  const days = useMemo(
    () =>
      Array.from({ length: SPAN }, (_, i) => {
        // 用日历日推进而不是加毫秒，避开夏令时那天不是 24 小时的问题
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
          onClick={() => updateView(page, view.id, { dateProp: addProperty(page, "date") })}
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
    // 结束早于开始时按一天处理，免得画出负宽度
    scheduled.push({ row, from, to: end !== null && end >= from ? end : from });
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
        <div className="timeline-grid" style={{ width: 200 + SPAN * DAY_WIDTH }}>
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
                <button type="button" className="timeline-name" onClick={() => navigate(row.id)}>
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
                      onClick={() => navigate(row.id)}
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
              <button key={row.id} type="button" className="row-chip row-chip-button" onClick={() => navigate(row.id)}>
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
