import { useMemo, useState } from "react";
import { BarChart3, LineChart, PieChart } from "lucide-react";
import type { ChartKind, DatabaseDef, PageMeta, PropertyDef, ViewDef } from "../../../shared/types";
import { cellValue, groupRowsByProp } from "../../db";
import { setPeekRowId } from "../../store";
import { cx } from "../Popover";

interface Props {
  db: DatabaseDef;
  view: ViewDef;
  rows: PageMeta[];
  onPatchView: (patch: Partial<ViewDef>) => void;
}

const PALETTE = [
  "#2383e2",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

const TAG_HEX: Record<string, string> = {
  blue: "#2383e2",
  green: "#16a34a",
  orange: "#ea580c",
  yellow: "#ca8a04",
  purple: "#7c3aed",
  pink: "#db2777",
  red: "#dc2626",
  brown: "#92400e",
  gray: "#6b7280",
};

function numericProps(db: DatabaseDef): PropertyDef[] {
  return db.properties.filter((p) => p.type === "number" || p.type === "formula" || p.type === "rollup");
}

function computeMetric(
  list: PageMeta[],
  fn: "count" | "sum" | "avg" | "max",
  def: PropertyDef | undefined,
): number {
  if (fn === "count" || !def) return list.length;
  const nums = list
    .map((r) => {
      const v = cellValue(r, def);
      return typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    })
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  if (fn === "sum") return Number(sum.toFixed(2));
  if (fn === "avg") return Number((sum / nums.length).toFixed(2));
  return Math.max(...nums);
}

/** 数据库图表视图：支持柱状图、折线趋势图与环形占比图（纯矢量 SVG 渲染） */
export function ChartView({ db, view, rows, onPatchView }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const groupableProps = db.properties.filter((p) => p.type !== "button");
  const numProps = numericProps(db);

  const chartType: ChartKind = view.chartType ?? "bar";
  const groupPropId =
    (view.chartGroupBy && groupableProps.some((p) => p.id === view.chartGroupBy) ? view.chartGroupBy : null) ??
    groupableProps.find((p) => p.type === "select")?.id ??
    groupableProps[0]?.id ??
    null;

  const metricFn = view.chartMetric?.fn ?? "count";
  const metricProp = numProps.find((p) => p.id === view.chartMetric?.propId) ?? numProps[0];

  const series = useMemo(() => {
    const groups = groupPropId ? groupRowsByProp(rows, db, groupPropId) : null;
    if (!groups || groups.length === 0) {
      return [
        {
          key: "all",
          label: "全部记录",
          color: PALETTE[0],
          value: computeMetric(rows, metricFn, metricProp),
          sampleId: rows[0]?.id ?? null,
        },
      ];
    }
    return groups.map((g, i) => ({
      key: g.key,
      label: g.label,
      color: (g.option?.color && TAG_HEX[g.option.color]) || PALETTE[i % PALETTE.length],
      value: computeMetric(g.rows, metricFn, metricProp),
      sampleId: g.rows[0]?.id ?? null,
    }));
  }, [rows, db, groupPropId, metricFn, metricProp]);

  const maxVal = Math.max(1, ...series.map((s) => s.value));
  const totalVal = series.reduce((a, b) => a + b.value, 0);

  return (
    <div className="db-chart-view" data-chart-type={chartType}>
      <div className="db-chart-controls">
        <div className="chart-type-tabs" role="tablist" aria-label="图表类型">
          <button
            type="button"
            className={cx("ai-scope-tab", chartType === "bar" && "active")}
            onClick={() => onPatchView({ chartType: "bar" })}
          >
            <BarChart3 size={13} /> 柱状图
          </button>
          <button
            type="button"
            className={cx("ai-scope-tab", chartType === "line" && "active")}
            onClick={() => onPatchView({ chartType: "line" })}
          >
            <LineChart size={13} /> 折线图
          </button>
          <button
            type="button"
            className={cx("ai-scope-tab", chartType === "donut" && "active")}
            onClick={() => onPatchView({ chartType: "donut" })}
          >
            <PieChart size={13} /> 环形图
          </button>
        </div>

        {groupableProps.length > 0 && (
          <label className="db-select">
            分组维度
            <select
              value={groupPropId ?? ""}
              onChange={(e) => onPatchView({ chartGroupBy: e.target.value || null })}
            >
              {groupableProps.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="db-select">
          统计指标
          <select
            value={metricFn}
            onChange={(e) =>
              onPatchView({
                chartMetric: {
                  fn: e.target.value as "count" | "sum" | "avg" | "max",
                  propId: metricProp?.id ?? null,
                },
              })
            }
          >
            <option value="count">记录行数</option>
            {numProps.length > 0 && (
              <>
                <option value="sum">数值求和</option>
                <option value="avg">数值均值</option>
                <option value="max">最大值</option>
              </>
            )}
          </select>
        </label>

        {metricFn !== "count" && numProps.length > 0 && (
          <label className="db-select">
            数值列
            <select
              value={metricProp?.id ?? ""}
              onChange={(e) =>
                onPatchView({
                  chartMetric: { fn: metricFn, propId: e.target.value },
                })
              }
            >
              {numProps.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {chartType === "donut" ? (
        <div className="chart-donut-layout">
          <svg className="chart-donut-svg" viewBox="0 0 220 220" role="img" aria-label="环形占比图">
            <circle cx="110" cy="110" r="76" fill="none" stroke="var(--hover)" strokeWidth="28" />
            {(() => {
              const circumference = 2 * Math.PI * 76;
              let acc = 0;
              return series.map((item, i) => {
                const ratio = totalVal > 0 ? item.value / totalVal : 0;
                const dash = ratio * circumference;
                const offset = -acc * circumference;
                acc += ratio;
                if (dash <= 0) return null;
                return (
                  <circle
                    key={item.key}
                    cx="110"
                    cy="110"
                    r="76"
                    fill="none"
                    stroke={item.color}
                    strokeWidth={hoverIdx === i ? 32 : 28}
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={offset}
                    transform="rotate(-90 110 110)"
                    style={{ cursor: item.sampleId ? "pointer" : "default", transition: "stroke-width 0.15s ease" }}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    onClick={() => item.sampleId && setPeekRowId(item.sampleId)}
                  />
                );
              });
            })()}
            <text x="110" y="104" textAnchor="middle" className="chart-svg-total-num">
              {Number(totalVal.toFixed(2))}
            </text>
            <text x="110" y="125" textAnchor="middle" className="chart-svg-total-sub">
              {metricFn === "count" ? "总记录数" : `${metricProp?.name ?? ""}合计`}
            </text>
          </svg>

          <div className="chart-legend">
            {series.map((item, i) => {
              const pct = totalVal > 0 ? Math.round((item.value / totalVal) * 100) : 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cx("chart-legend-row", hoverIdx === i && "active")}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  onClick={() => item.sampleId && setPeekRowId(item.sampleId)}
                >
                  <span className="chart-swatch" style={{ background: item.color }} />
                  <span className="chart-legend-label">{item.label}</span>
                  <strong className="chart-legend-val">{item.value}</strong>
                  <span className="chart-legend-pct">{pct}%</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="chart-cartesian-wrap">
          <svg className="chart-cartesian-svg" viewBox="0 0 680 280" role="img" aria-label={chartType === "bar" ? "柱状图" : "折线图"}>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = 230 - t * 190;
              const tickVal = Number((maxVal * t).toFixed(1));
              return (
                <g key={t}>
                  <line x1="48" y1={y} x2="660" y2={y} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : "3 3"} />
                  <text x="40" y={y + 4} textAnchor="end" className="chart-axis-text">
                    {tickVal}
                  </text>
                </g>
              );
            })}

            {chartType === "bar" ? (
              series.map((item, i) => {
                const slotW = 600 / Math.max(1, series.length);
                const barW = Math.min(48, Math.max(16, slotW * 0.56));
                const x = 54 + i * slotW + (slotW - barW) / 2;
                const h = Math.max(item.value > 0 ? 4 : 0, (item.value / maxVal) * 190);
                const y = 230 - h;
                return (
                  <g
                    key={item.key}
                    style={{ cursor: item.sampleId ? "pointer" : "default" }}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    onClick={() => item.sampleId && setPeekRowId(item.sampleId)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx={5}
                      fill={item.color}
                      opacity={hoverIdx === null || hoverIdx === i ? 0.92 : 0.45}
                    />
                    <text x={x + barW / 2} y={y - 7} textAnchor="middle" className="chart-val-text">
                      {item.value}
                    </text>
                    <text x={x + barW / 2} y="252" textAnchor="middle" className="chart-axis-text">
                      {item.label.length > 8 ? `${item.label.slice(0, 8)}…` : item.label}
                    </text>
                  </g>
                );
              })
            ) : (
              <>
                {(() => {
                  const n = series.length;
                  const pts = series.map((item, i) => {
                    const x = n === 1 ? 354 : 80 + (i / (n - 1)) * 548;
                    const y = 230 - (item.value / maxVal) * 190;
                    return { x, y, item, i };
                  });
                  const linePath = pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
                  const areaPath =
                    pts.length > 1
                      ? `${linePath} L${pts[pts.length - 1].x},230 L${pts[0].x},230 Z`
                      : "";
                  return (
                    <>
                      {areaPath && <path d={areaPath} fill="var(--accent-soft)" opacity="0.55" />}
                      {pts.length > 1 && <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2.5" />}
                      {pts.map(({ x, y, item, i }) => (
                        <g
                          key={item.key}
                          style={{ cursor: item.sampleId ? "pointer" : "default" }}
                          onMouseEnter={() => setHoverIdx(i)}
                          onMouseLeave={() => setHoverIdx(null)}
                          onClick={() => item.sampleId && setPeekRowId(item.sampleId)}
                        >
                          <circle cx={x} cy={y} r={hoverIdx === i ? 6 : 4.5} fill="var(--bg)" stroke="var(--accent)" strokeWidth="2.5" />
                          <text x={x} y={y - 10} textAnchor="middle" className="chart-val-text">
                            {item.value}
                          </text>
                          <text x={x} y="252" textAnchor="middle" className="chart-axis-text">
                            {item.label.length > 8 ? `${item.label.slice(0, 8)}…` : item.label}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </>
            )}
          </svg>
        </div>
      )}
    </div>
  );
}
