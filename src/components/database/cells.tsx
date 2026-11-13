import { useEffect, useRef, useState } from "react";
import {
  ALargeSmall,
  Calendar,
  Check,
  CircleChevronDown,
  ExternalLink,
  Hash,
  Link2,
  SquareCheck,
  Tags,
  Type,
  X,
} from "lucide-react";
import type { PageMeta, PropertyDef, PropType, PropValue, SelectOption } from "../../../shared/types";
import { ensureOption, setProp, updateProperty } from "../../db";
import { Popover, cx } from "../Popover";

const TYPE_ICONS: Record<PropType | "title", typeof Type> = {
  title: ALargeSmall,
  text: Type,
  number: Hash,
  select: CircleChevronDown,
  multiSelect: Tags,
  date: Calendar,
  checkbox: SquareCheck,
  url: Link2,
};

export function PropIcon({ type, size = 14 }: { type: PropType | "title"; size?: number }) {
  const Icon = TYPE_ICONS[type];
  return <Icon size={size} />;
}

export function Tag({ option, onRemove }: { option: SelectOption; onRemove?: () => void }) {
  return (
    <span className={cx("tag", `tag-${option.color}`)}>
      <span className="tag-name">{option.name}</span>
      {onRemove && (
        <button
          type="button"
          className="tag-remove"
          aria-label={`移除 ${option.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}

function selectedOptions(value: PropValue | undefined, def: PropertyDef): SelectOption[] {
  const ids = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
  return ids.map((id) => def.options?.find((o) => o.id === id)).filter((o): o is SelectOption => !!o);
}

/** 只读展示一个属性值（看板卡片上用）。空值返回 null。 */
export function ValueDisplay({ value, def }: { value: PropValue | undefined; def: PropertyDef }) {
  if (def.type === "select" || def.type === "multiSelect") {
    const options = selectedOptions(value, def);
    if (options.length === 0) return null;
    return (
      <span className="tag-list">
        {options.map((o) => (
          <Tag key={o.id} option={o} />
        ))}
      </span>
    );
  }
  if (def.type === "checkbox") {
    if (value !== true) return null;
    return (
      <span className="value-inline">
        <SquareCheck size={14} /> {def.name}
      </span>
    );
  }
  if (value === null || value === undefined || value === "") return null;
  if (def.type === "date") {
    return (
      <span className="value-inline">
        <Calendar size={13} /> {formatDate(String(value))}
      </span>
    );
  }
  return <span className="value-inline value-text">{String(value)}</span>;
}

export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const sameYear = Number(m[1]) === new Date().getFullYear();
  return `${sameYear ? "" : `${m[1]}年`}${Number(m[2])}月${Number(m[3])}日`;
}

interface CellProps {
  row: PageMeta;
  def: PropertyDef;
  /** 属性所属的数据库页面 */
  dbPage: PageMeta;
}

/** 可编辑的属性单元格，表格和页面属性面板共用。 */
export function PropertyCell({ row, def, dbPage }: CellProps) {
  const value = row.props[def.id];
  switch (def.type) {
    case "checkbox":
      return (
        <label className="cell cell-checkbox">
          <input
            type="checkbox"
            checked={value === true}
            aria-label={def.name}
            onChange={(e) => setProp(row, def.id, e.target.checked)}
          />
        </label>
      );
    case "date":
      return (
        <input
          className={cx("cell cell-input cell-date", !value && "empty")}
          type="date"
          value={typeof value === "string" ? value : ""}
          aria-label={def.name}
          onChange={(e) => setProp(row, def.id, e.target.value || null)}
        />
      );
    case "select":
    case "multiSelect":
      return <SelectCell row={row} def={def} dbPage={dbPage} />;
    default:
      return <TextCell row={row} def={def} />;
  }
}

function TextCell({ row, def }: { row: PageMeta; def: PropertyDef }) {
  const value = row.props[def.id];
  const text = value === null || value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(text);
  const focused = useRef(false);

  // 外部修改（例如撤销、另一处编辑）时同步进来，但不打断正在输入的内容
  useEffect(() => {
    if (!focused.current) setDraft(text);
  }, [text]);

  const commit = () => {
    const trimmed = draft.trim();
    let next: PropValue = trimmed || null;
    if (def.type === "number") {
      const n = parseFloat(trimmed);
      next = Number.isFinite(n) ? n : null;
      setDraft(next === null ? "" : String(next));
    }
    if (next !== (value ?? null)) setProp(row, def.id, next);
  };

  return (
    <span className="cell cell-text-wrap">
      <input
        className={cx("cell-input", def.type === "number" && "cell-number")}
        value={draft}
        inputMode={def.type === "number" ? "decimal" : def.type === "url" ? "url" : undefined}
        aria-label={def.name}
        onFocus={() => (focused.current = true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(text);
            e.currentTarget.blur();
          }
        }}
      />
      {def.type === "url" && text && (
        <a
          className="cell-link"
          href={/^[a-z][a-z0-9+.-]*:/i.test(text) ? safeUrl(text) : `https://${text}`}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="打开链接"
          title="打开链接"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </span>
  );
}

/** 只放行 http(s) 和 mailto，避免 javascript: 之类的链接被点开 */
function safeUrl(url: string): string {
  return /^(https?:|mailto:)/i.test(url) ? url : "about:blank";
}

function SelectCell({ row, def, dbPage }: CellProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const value = row.props[def.id];
  const selected = selectedOptions(value, def);
  const multi = def.type === "multiSelect";

  const toggle = (option: SelectOption) => {
    if (multi) {
      const ids = selected.map((o) => o.id);
      setProp(row, def.id, ids.includes(option.id) ? ids.filter((id) => id !== option.id) : [...ids, option.id]);
    } else {
      setProp(row, def.id, selected[0]?.id === option.id ? null : option.id);
      setAnchor(null);
    }
  };

  return (
    <>
      <button
        type="button"
        className={cx("cell cell-select", anchor && "open")}
        aria-label={def.name}
        aria-haspopup="listbox"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        {selected.length > 0 ? (
          <span className="tag-list">
            {selected.map((o) => (
              <Tag key={o.id} option={o} />
            ))}
          </span>
        ) : (
          <span className="cell-placeholder">空</span>
        )}
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="select-editor">
          <SelectEditor
            def={def}
            dbPage={dbPage}
            selected={selected}
            onToggle={toggle}
            onCreate={(name) => toggle(ensureOption(dbPage, def, name))}
          />
        </Popover>
      )}
    </>
  );
}

interface SelectEditorProps {
  def: PropertyDef;
  dbPage: PageMeta;
  selected: SelectOption[];
  onToggle: (option: SelectOption) => void;
  onCreate: (name: string) => void;
}

function SelectEditor({ def, dbPage, selected, onToggle, onCreate }: SelectEditorProps) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const options = def.options ?? [];
  const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase())) : options;
  const exact = options.some((o) => o.name === q);
  const selectedIds = new Set(selected.map((o) => o.id));

  return (
    <>
      <div className="select-search">
        {selected.map((o) => (
          <Tag key={o.id} option={o} onRemove={() => onToggle(o)} />
        ))}
        <input
          autoFocus
          value={query}
          placeholder={selected.length ? "" : "搜索或创建选项…"}
          aria-label="搜索或创建选项"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.key !== "Enter" || !q) return;
            e.preventDefault();
            const match = options.find((o) => o.name === q) ?? (shown.length === 1 ? shown[0] : null);
            if (match) onToggle(match);
            else onCreate(q);
            setQuery("");
          }}
        />
      </div>
      <div className="select-hint">选择一个选项，或输入名称后回车创建</div>
      <div className="select-options" role="listbox">
        {shown.map((o) => (
          <div
            key={o.id}
            className="select-option"
            role="option"
            aria-selected={selectedIds.has(o.id)}
            tabIndex={0}
            onClick={() => onToggle(o)}
            onKeyDown={(e) => e.key === "Enter" && onToggle(o)}
          >
            <Tag option={o} />
            {selectedIds.has(o.id) && <Check size={14} className="select-check" />}
            <button
              type="button"
              className="icon-btn small select-delete"
              title="删除这个选项"
              aria-label={`删除选项 ${o.name}`}
              onClick={(e) => {
                e.stopPropagation();
                updateProperty(dbPage, def.id, { options: options.filter((x) => x.id !== o.id) });
              }}
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {q && !exact && (
          <button
            type="button"
            className="select-option select-create"
            onClick={() => {
              onCreate(q);
              setQuery("");
            }}
          >
            创建 <Tag option={{ id: "new", name: q, color: "gray" }} />
          </button>
        )}
        {shown.length === 0 && !q && <div className="select-empty">还没有选项</div>}
      </div>
    </>
  );
}
