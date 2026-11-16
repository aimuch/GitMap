import { useState } from "react";
import { Check, Plus, Send } from "lucide-react";
import type { DatabaseDef, PageMeta, PropertyDef, PropValue, ViewDef } from "../../../shared/types";
import { isComputed, visibleProperties } from "../../db";
import { setPeekRowId, useStore } from "../../store";
import { cx } from "../Popover";
import { PropIcon, Tag } from "./cells";

interface Props {
  page: PageMeta;
  db: DatabaseDef;
  view: ViewDef;
  onPatchView: (patch: Partial<ViewDef>) => void;
  onSubmitRow: (title: string, props: Record<string, PropValue>) => Promise<string | null>;
}

/** 数据库表单视图（Notion Forms）：把数据库结构转化为结构化信息收集表单，一键提交生成新行 */
export function FormView({ page, db, view, onPatchView, onSubmitRow }: Props) {
  const allPages = useStore((s) => s.pages);
  const fields = visibleProperties(db, view).filter((p) => !isComputed(p.type) && p.type !== "button");
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, PropValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const setVal = (propId: string, val: PropValue) => {
    setValues((prev) => ({ ...prev, [propId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const id = await onSubmitRow(title.trim(), values);
      if (id) {
        setSubmittedId(id);
        setTitle("");
        setValues({});
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedId) {
    return (
      <div className="db-form-wrap">
        <div className="db-form-card db-form-done" role="status">
          <div className="db-form-done-badge">
            <Check size={20} />
          </div>
          <h3>已成功提交到《{page.title || "无标题数据库"}》</h3>
          <p>新记录已写入本地数据库并自动触发相关规则。</p>
          <div className="db-form-done-actions">
            <button type="button" className="primary-btn small" onClick={() => setSubmittedId(null)}>
              <Plus size={14} /> 再填一份
            </button>
            <button type="button" className="ghost-btn small" onClick={() => setPeekRowId(submittedId)}>
              查看刚提交的记录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="db-form-wrap">
      <form className="db-form-card" onSubmit={(e) => void handleSubmit(e)}>
        <div className="db-form-head">
          <h3>{page.title || "数据收集表单"}</h3>
          <input
            className="db-form-desc"
            value={view.formDesc ?? ""}
            placeholder="添加表单填写说明（选填）…"
            onChange={(e) => onPatchView({ formDesc: e.target.value })}
          />
        </div>

        <div className="db-form-fields">
          <label className="db-form-field">
            <span className="db-form-label">
              <PropIcon type="title" /> 名称 <em>*</em>
            </span>
            <input
              required
              value={title}
              placeholder="输入条目名称…"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          {fields.map((def) => (
            <FormField
              key={def.id}
              def={def}
              value={values[def.id]}
              allPages={allPages}
              onChange={(v) => setVal(def.id, v)}
            />
          ))}
        </div>

        <div className="db-form-foot">
          <button type="submit" className="primary-btn" disabled={!title.trim() || submitting}>
            <Send size={14} /> {submitting ? "提交中…" : "提交记录"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  def,
  value,
  allPages,
  onChange,
}: {
  def: PropertyDef;
  value: PropValue | undefined;
  allPages: Record<string, PageMeta>;
  onChange: (v: PropValue) => void;
}) {
  if (def.type === "checkbox") {
    return (
      <label className="db-form-field db-form-check">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{def.name}</span>
      </label>
    );
  }

  if (def.type === "select" || def.type === "multiSelect") {
    const multi = def.type === "multiSelect";
    const selectedIds = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
    return (
      <div className="db-form-field">
        <span className="db-form-label">
          <PropIcon type={def.type} /> {def.name}
        </span>
        <div className="db-form-pills">
          {(def.options ?? []).map((opt) => {
            const on = selectedIds.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className={cx("db-form-pill", on && "selected")}
                onClick={() => {
                  if (multi) {
                    onChange(on ? selectedIds.filter((id) => id !== opt.id) : [...selectedIds, opt.id]);
                  } else {
                    onChange(on ? null : opt.id);
                  }
                }}
              >
                <Tag option={opt} />
              </button>
            );
          })}
          {(def.options ?? []).length === 0 && <span className="ai-hint">该属性暂无预设选项</span>}
        </div>
      </div>
    );
  }

  if (def.type === "relation") {
    const candidates = Object.values(allPages).filter(
      (p) => p.parentId === def.relationDb && !p.trashed && !p.hidden,
    );
    const selected = Array.isArray(value) ? value : [];
    return (
      <label className="db-form-field">
        <span className="db-form-label">
          <PropIcon type="relation" /> {def.name}
        </span>
        <select
          value={selected[0] ?? ""}
          onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
        >
          <option value="">不关联</option>
          {candidates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title || "无标题"}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="db-form-field">
      <span className="db-form-label">
        <PropIcon type={def.type} /> {def.name}
      </span>
      <input
        type={def.type === "date" ? "date" : def.type === "url" ? "url" : "text"}
        inputMode={def.type === "number" ? "decimal" : undefined}
        value={value === null || value === undefined ? "" : String(value)}
        placeholder={def.type === "number" ? "输入数字…" : def.type === "url" ? "https://..." : "填写内容…"}
        onChange={(e) => {
          const raw = e.target.value;
          if (def.type === "number") {
            const n = parseFloat(raw);
            onChange(raw.trim() === "" ? null : Number.isFinite(n) ? n : null);
          } else {
            onChange(raw || null);
          }
        }}
      />
    </label>
  );
}
