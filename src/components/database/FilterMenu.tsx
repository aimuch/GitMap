import { Plus, X } from "lucide-react";
import type { DatabaseDef, FilterOp, FilterRule, PageMeta, ViewDef } from "../../../shared/types";
import { filterOps, needsValue, newFilter, updateView } from "../../db";
import { Popover } from "../Popover";

interface Props {
  anchor: HTMLElement;
  page: PageMeta;
  db: DatabaseDef;
  view: ViewDef;
  onClose: () => void;
}

/** 按属性筛选的面板：每行一个条件（属性 + 关系 + 值）。 */
export function FilterMenu({ anchor, page, db, view, onClose }: Props) {
  const rules = view.filters ?? [];
  const setRules = (filters: FilterRule[]) => updateView(page, view.id, { filters });
  const patch = (id: string, change: Partial<FilterRule>) =>
    setRules(rules.map((r) => (r.id === id ? { ...r, ...change } : r)));

  return (
    <Popover anchor={anchor} onClose={onClose} align="end" className="filter-menu">
      {rules.length === 0 && <div className="filter-empty">还没有筛选条件。添加一个，只显示符合条件的行。</div>}

      {rules.length > 1 && (
        <label className="db-select filter-mode">
          显示满足
          <select
            value={view.filterMode ?? "and"}
            onChange={(e) => updateView(page, view.id, { filterMode: e.target.value as "and" | "or" })}
          >
            <option value="and">全部条件</option>
            <option value="or">任一条件</option>
          </select>
          的行
        </label>
      )}

      {rules.map((rule) => {
        const def = db.properties.find((p) => p.id === rule.propId);
        const type = def?.type ?? "title";
        const ops = filterOps(type);
        return (
          <div key={rule.id} className="filter-rule">
            <select
              aria-label="属性"
              value={def ? def.id : "title"}
              onChange={(e) => {
                const next = db.properties.find((p) => p.id === e.target.value);
                // 换属性后，原来的关系和值多半不适用，重置
                patch(rule.id, {
                  propId: e.target.value,
                  op: filterOps(next?.type ?? "title")[0].op,
                  value: "",
                });
              }}
            >
              <option value="title">名称</option>
              {db.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="条件"
              value={rule.op}
              onChange={(e) => patch(rule.id, { op: e.target.value as FilterOp })}
            >
              {ops.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </select>
            {needsValue(rule.op) ? (
              type === "select" || type === "multiSelect" ? (
                <select
                  aria-label="值"
                  className="filter-value"
                  value={rule.value ?? ""}
                  onChange={(e) => patch(rule.id, { value: e.target.value })}
                >
                  <option value="">选择选项…</option>
                  {def?.options?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label="值"
                  className="filter-value"
                  type={type === "date" ? "date" : "text"}
                  inputMode={type === "number" ? "decimal" : undefined}
                  placeholder={type === "number" ? "数字" : "输入内容…"}
                  value={rule.value ?? ""}
                  onChange={(e) => patch(rule.id, { value: e.target.value })}
                />
              )
            ) : (
              <span className="filter-value" />
            )}
            <button
              type="button"
              className="icon-btn small"
              title="删除这个条件"
              aria-label="删除这个条件"
              onClick={() => setRules(rules.filter((r) => r.id !== rule.id))}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      <div className="filter-actions">
        <button type="button" className="text-btn" onClick={() => setRules([...rules, newFilter(db)])}>
          <Plus size={14} /> 添加筛选条件
        </button>
        {rules.length > 0 && (
          <button type="button" className="text-btn danger" onClick={() => setRules([])}>
            清除全部
          </button>
        )}
      </div>
    </Popover>
  );
}
