import { GitBranch, ListTree, Plus, Trash2, Zap } from "lucide-react";
import type { ActionStep, DatabaseAutomation, DatabaseDef, PageMeta, PropertyDef } from "../../../shared/types";
import { addProperty, isComputed, shortId, updateDatabase, updateProperty } from "../../db";
import { Popover } from "../Popover";

/** 可复用的自动化动作步骤编辑器（供自动化规则与数据库“按钮”属性共用） */
export function ActionStepsEditor({
  db,
  steps,
  onChange,
}: {
  db: DatabaseDef;
  steps: ActionStep[];
  onChange: (next: ActionStep[]) => void;
}) {
  const writable = db.properties.filter((p) => !isComputed(p.type) && p.type !== "button");

  const patch = (id: string, change: Partial<ActionStep>) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...change } : s)));
  };

  const addStep = () => {
    const first = writable[0];
    onChange([
      ...steps,
      {
        id: shortId(),
        type: first ? "set_prop" : "create_row",
        propId: first?.id,
        value: first?.type === "checkbox" ? true : first?.type === "date" ? "$today" : (first?.options?.[0]?.id ?? ""),
        title: "跟进：{{title}}",
      },
    ]);
  };

  return (
    <div className="auto-steps">
      {steps.map((step) => {
        const target = writable.find((p) => p.id === step.propId);
        return (
          <div key={step.id} className="auto-step-row">
            <select
              value={step.type}
              onChange={(e) => {
                const t = e.target.value as ActionStep["type"];
                if (t === "create_row") patch(step.id, { type: "create_row", title: "跟进：{{title}}" });
                else patch(step.id, { type: "set_prop", propId: writable[0]?.id, value: "" });
              }}
            >
              <option value="set_prop">设置属性</option>
              <option value="create_row">新建关联行</option>
            </select>

            {step.type === "set_prop" ? (
              <>
                <select
                  value={target?.id ?? ""}
                  onChange={(e) => {
                    const nextDef = writable.find((p) => p.id === e.target.value);
                    patch(step.id, {
                      propId: e.target.value,
                      value:
                        nextDef?.type === "checkbox"
                          ? true
                          : nextDef?.type === "date"
                            ? "$today"
                            : (nextDef?.options?.[0]?.id ?? ""),
                    });
                  }}
                >
                  {writable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <StepValueInput def={target} value={step.value} onChange={(v) => patch(step.id, { value: v })} />
              </>
            ) : (
              <input
                className="auto-step-val"
                value={step.title ?? ""}
                placeholder="新行标题（支持 {{title}}）"
                onChange={(e) => patch(step.id, { title: e.target.value })}
              />
            )}

            <button
              type="button"
              className="icon-btn small"
              aria-label="移除动作"
              onClick={() => onChange(steps.filter((s) => s.id !== step.id))}
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
      <button type="button" className="text-btn small" onClick={addStep}>
        <Plus size={13} /> 添加执行动作
      </button>
    </div>
  );
}

function StepValueInput({
  def,
  value,
  onChange,
}: {
  def: PropertyDef | undefined;
  value: ActionStep["value"];
  onChange: (v: ActionStep["value"]) => void;
}) {
  if (!def) return null;
  if (def.type === "checkbox") {
    return (
      <select value={value === false ? "false" : "true"} onChange={(e) => onChange(e.target.value === "true")}>
        <option value="true">已勾选</option>
        <option value="false">未勾选</option>
      </select>
    );
  }
  if (def.type === "select" || def.type === "multiSelect") {
    const cur = Array.isArray(value) ? (value[0] ?? "") : String(value ?? "");
    return (
      <select
        value={cur}
        onChange={(e) => onChange(def.type === "multiSelect" ? (e.target.value ? [e.target.value] : []) : e.target.value)}
      >
        <option value="">清空</option>
        {(def.options ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    );
  }
  if (def.type === "date") {
    return (
      <select
        value={value === "$today" ? "$today" : "custom"}
        onChange={(e) => onChange(e.target.value === "$today" ? "$today" : new Date().toISOString().slice(0, 10))}
      >
        <option value="$today">触发当天日期</option>
        <option value="custom">固定日期</option>
      </select>
    );
  }
  return (
    <input
      className="auto-step-val"
      value={value === null || value === undefined ? "" : String(value)}
      placeholder="设为值…"
      onChange={(e) =>
        onChange(def.type === "number" ? (Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : null) : e.target.value)
      }
    />
  );
}

/** 数据库层级（子任务）、前后置依赖与自动化触发器配置面板 */
export function AutomationsMenu({
  anchor,
  page,
  db,
  onClose,
}: {
  anchor: HTMLElement;
  page: PageMeta;
  db: DatabaseDef;
  onClose: () => void;
}) {
  const selfRelations = db.properties.filter((p) => p.type === "relation" && p.relationDb === page.id);
  const automations = db.automations ?? [];
  const triggerableProps = db.properties.filter((p) => p.type === "select" || p.type === "checkbox" || p.type === "text");

  const setAutomations = (next: DatabaseAutomation[]) => {
    updateDatabase(page, (d) => ({ ...d, automations: next }));
  };

  const addAutomation = () => {
    const firstSelect = db.properties.find((p) => p.type === "select");
    const rule: DatabaseAutomation = {
      id: shortId(),
      name: "状态流转规则",
      enabled: true,
      trigger: firstSelect
        ? { type: "prop_changed", propId: firstSelect.id, value: firstSelect.options?.[firstSelect.options.length - 1]?.id ?? "" }
        : { type: "row_created" },
      actions: [],
    };
    setAutomations([...automations, rule]);
  };

  const createDependencyColumn = () => {
    const id = addProperty(page, "relation");
    updateProperty(page, id, { name: "前置任务", relationDb: page.id });
    updateDatabase(page, (d) => ({ ...d, dependencyProp: id }));
  };

  return (
    <Popover anchor={anchor} onClose={onClose} align="end" className="automations-menu">
      <div className="auto-section">
        <div className="menu-title">
          <ListTree size={13} /> 子任务与时间轴依赖
        </div>
        <label className="auto-toggle-row">
          <input
            type="checkbox"
            checked={Boolean(db.subItemsEnabled)}
            onChange={(e) => updateDatabase(page, (d) => ({ ...d, subItemsEnabled: e.target.checked }))}
          />
          <span>开启子任务层级（表格与列表支持无限展开子行）</span>
        </label>

        <div className="auto-dep-row">
          <span>
            <GitBranch size={13} /> 时间轴前后置依赖列
          </span>
          {selfRelations.length > 0 ? (
            <select
              value={db.dependencyProp ?? ""}
              onChange={(e) => updateDatabase(page, (d) => ({ ...d, dependencyProp: e.target.value || null }))}
            >
              <option value="">不显示依赖连线</option>
              {selfRelations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <button type="button" className="ghost-btn small" onClick={createDependencyColumn}>
              <Plus size={13} /> 新建“前置任务”列
            </button>
          )}
        </div>
      </div>

      <div className="auto-section">
        <div className="menu-title">
          <Zap size={13} /> 自动化规则（Automations）
        </div>
        {automations.length === 0 && (
          <div className="filter-empty">还没有自动化规则。可设置“当状态变为已完成时，自动记录完成日期”等动作。</div>
        )}
        {automations.map((auto) => {
          const trigDef = triggerableProps.find((p) => p.id === auto.trigger.propId);
          return (
            <div key={auto.id} className="auto-card">
              <div className="auto-card-head">
                <input
                  type="checkbox"
                  checked={auto.enabled}
                  title="启用或暂停此规则"
                  onChange={(e) =>
                    setAutomations(automations.map((a) => (a.id === auto.id ? { ...a, enabled: e.target.checked } : a)))
                  }
                />
                <span className="auto-when">当</span>
                <select
                  value={auto.trigger.type === "row_created" ? "__created__" : (auto.trigger.propId ?? "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__created__") {
                      setAutomations(
                        automations.map((a) => (a.id === auto.id ? { ...a, trigger: { type: "row_created" } } : a)),
                      );
                    } else {
                      const nextDef = triggerableProps.find((p) => p.id === val);
                      setAutomations(
                        automations.map((a) =>
                          a.id === auto.id
                            ? {
                                ...a,
                                trigger: {
                                  type: "prop_changed",
                                  propId: val,
                                  value: nextDef?.type === "checkbox" ? "true" : (nextDef?.options?.[0]?.id ?? ""),
                                },
                              }
                            : a,
                        ),
                      );
                    }
                  }}
                >
                  <option value="__created__">新建一行时</option>
                  {triggerableProps.map((p) => (
                    <option key={p.id} value={p.id}>
                      “{p.name}”变为
                    </option>
                  ))}
                </select>

                {auto.trigger.type === "prop_changed" && trigDef && (
                  trigDef.type === "select" ? (
                    <select
                      value={auto.trigger.value ?? ""}
                      onChange={(e) =>
                        setAutomations(
                          automations.map((a) =>
                            a.id === auto.id ? { ...a, trigger: { ...a.trigger, value: e.target.value } } : a,
                          ),
                        )
                      }
                    >
                      <option value="">任意值</option>
                      {(trigDef.options ?? []).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  ) : trigDef.type === "checkbox" ? (
                    <select
                      value={auto.trigger.value ?? "true"}
                      onChange={(e) =>
                        setAutomations(
                          automations.map((a) =>
                            a.id === auto.id ? { ...a, trigger: { ...a.trigger, value: e.target.value } } : a,
                          ),
                        )
                      }
                    >
                      <option value="true">已勾选</option>
                      <option value="false">未勾选</option>
                    </select>
                  ) : (
                    <input
                      className="auto-trig-val"
                      placeholder="匹配值（留空为任意变更）"
                      value={auto.trigger.value ?? ""}
                      onChange={(e) =>
                        setAutomations(
                          automations.map((a) =>
                            a.id === auto.id ? { ...a, trigger: { ...a.trigger, value: e.target.value } } : a,
                          ),
                        )
                      }
                    />
                  )
                )}

                <button
                  type="button"
                  className="icon-btn small"
                  aria-label="删除此规则"
                  onClick={() => setAutomations(automations.filter((a) => a.id !== auto.id))}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <ActionStepsEditor
                db={db}
                steps={auto.actions}
                onChange={(actions) =>
                  setAutomations(automations.map((a) => (a.id === auto.id ? { ...a, actions } : a)))
                }
              />
            </div>
          );
        })}

        <button type="button" className="ghost-btn small" onClick={addAutomation}>
          <Plus size={13} /> 新建自动化规则
        </button>
      </div>
    </Popover>
  );
}
