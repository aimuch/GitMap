import { FolderPlus, Plus, X } from "lucide-react";
import type { DatabaseDef, FilterGroup, FilterOp, FilterRule, ViewDef } from "../../../shared/types";
import { filterOps, needsValue, newFilter, shortId } from "../../db";
import { Popover } from "../Popover";

interface Props {
  anchor: HTMLElement;
  db: DatabaseDef;
  view: ViewDef;
  onPatchView: (patch: Partial<ViewDef>) => void;
  onClose: () => void;
}

/** 支持多层 AND / OR 条件组的筛选面板 */
export function FilterMenu({ anchor, db, view, onPatchView, onClose }: Props) {
  const rules = view.filters ?? [];
  const groups = view.filterGroups ?? [];

  const setRules = (filters: FilterRule[]) => onPatchView({ filters });
  const setGroups = (filterGroups: FilterGroup[]) => onPatchView({ filterGroups });

  const patchRule = (id: string, change: Partial<FilterRule>) =>
    setRules(rules.map((r) => (r.id === id ? { ...r, ...change } : r)));

  const patchGroupRule = (groupId: string, ruleId: string, change: Partial<FilterRule>) =>
    setGroups(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, rules: g.rules.map((r) => (r.id === ruleId ? { ...r, ...change } : r)) }
          : g,
      ),
    );

  const addGroup = () => {
    setGroups([...groups, { id: shortId(), mode: "or", rules: [newFilter(db)] }]);
  };

  const totalCount = rules.length + groups.length;

  return (
    <Popover anchor={anchor} onClose={onClose} align="end" className="filter-menu">
      {totalCount === 0 && (
        <div className="filter-empty">还没有筛选条件。可添加单条条件，或嵌套“且 / 或”条件组。</div>
      )}

      {totalCount > 1 && (
        <label className="db-select filter-mode">
          外层关系：满足
          <select
            value={view.filterMode ?? "and"}
            onChange={(e) => onPatchView({ filterMode: e.target.value as "and" | "or" })}
          >
            <option value="and">全部条件与条件组（AND）</option>
            <option value="or">任一条件或条件组（OR）</option>
          </select>
        </label>
      )}

      {rules.map((rule) => (
        <RuleRow
          key={rule.id}
          db={db}
          rule={rule}
          onPatch={(change) => patchRule(rule.id, change)}
          onRemove={() => setRules(rules.filter((r) => r.id !== rule.id))}
        />
      ))}

      {groups.map((group) => (
        <div key={group.id} className="filter-group-box">
          <div className="filter-group-head">
            <span>条件组内满足</span>
            <select
              value={group.mode}
              onChange={(e) =>
                setGroups(
                  groups.map((g) => (g.id === group.id ? { ...g, mode: e.target.value as "and" | "or" } : g)),
                )
              }
            >
              <option value="and">全部（且 AND）</option>
              <option value="or">任一（或 OR）</option>
            </select>
            <button
              type="button"
              className="text-btn small danger"
              onClick={() => setGroups(groups.filter((g) => g.id !== group.id))}
            >
              删除组
            </button>
          </div>
          {group.rules.map((rule) => (
            <RuleRow
              key={rule.id}
              db={db}
              rule={rule}
              onPatch={(change) => patchGroupRule(group.id, rule.id, change)}
              onRemove={() => {
                const nextRules = group.rules.filter((r) => r.id !== rule.id);
                if (nextRules.length === 0) setGroups(groups.filter((g) => g.id !== group.id));
                else setGroups(groups.map((g) => (g.id === group.id ? { ...g, rules: nextRules } : g)));
              }}
            />
          ))}
          <button
            type="button"
            className="text-btn small"
            onClick={() =>
              setGroups(
                groups.map((g) => (g.id === group.id ? { ...g, rules: [...g.rules, newFilter(db)] } : g)),
              )
            }
          >
            <Plus size={13} /> 组内添加条件
          </button>
        </div>
      ))}

      <div className="filter-actions">
        <button type="button" className="text-btn" onClick={() => setRules([...rules, newFilter(db)])}>
          <Plus size={14} /> 添加条件
        </button>
        <button type="button" className="text-btn" onClick={addGroup}>
          <FolderPlus size={14} /> 添加条件组
        </button>
        {totalCount > 0 && (
          <button
            type="button"
            className="text-btn danger"
            onClick={() => onPatchView({ filters: [], filterGroups: [] })}
          >
            清除全部
          </button>
        )}
      </div>
    </Popover>
  );
}

function RuleRow({
  db,
  rule,
  onPatch,
  onRemove,
}: {
  db: DatabaseDef;
  rule: FilterRule;
  onPatch: (change: Partial<FilterRule>) => void;
  onRemove: () => void;
}) {
  const def = db.properties.find((p) => p.id === rule.propId);
  const type = def?.type ?? "title";
  const ops = filterOps(type);
  return (
    <div className="filter-rule">
      <select
        aria-label="属性"
        value={def ? def.id : "title"}
        onChange={(e) => {
          const next = db.properties.find((p) => p.id === e.target.value);
          onPatch({
            propId: e.target.value,
            op: filterOps(next?.type ?? "title")[0].op,
            value: "",
          });
        }}
      >
        <option value="title">名称</option>
        {db.properties
          .filter((p) => p.type !== "button")
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </select>
      <select
        aria-label="条件"
        value={rule.op}
        onChange={(e) => onPatch({ op: e.target.value as FilterOp })}
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
            onChange={(e) => onPatch({ value: e.target.value })}
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
            onChange={(e) => onPatch({ value: e.target.value })}
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
        onClick={onRemove}
      >
        <X size={14} />
      </button>
    </div>
  );
}
