import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

interface PopoverProps {
  /** 弹层依附的元素；点击它不会被当作“点击外部” */
  anchor: HTMLElement;
  onClose: () => void;
  children: ReactNode;
  align?: "start" | "end";
  placement?: "bottom" | "top" | "right";
  className?: string;
}

export function Popover({ anchor, onClose, children, align = "start", placement = "bottom", className }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = anchor.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const gap = 4;
    let left = align === "start" ? a.left : a.right - r.width;
    let top = a.bottom + gap;
    if (placement === "top") top = a.top - r.height - gap;
    if (placement === "right") {
      left = a.right + gap;
      top = a.top;
    }
    if (top + r.height > window.innerHeight - 8) {
      top = placement === "right" ? window.innerHeight - r.height - 8 : a.top - r.height - gap;
    }
    top = Math.max(8, top);
    left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));
    setPos({ left, top });
  }, [anchor, align, placement]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      className={cx("popover", className)}
      // 定位完成前用透明而不是 visibility:hidden，否则里面的输入框无法自动获得焦点
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, opacity: pos ? 1 : 0, pointerEvents: pos ? undefined : "none" }}
    >
      {children}
    </div>,
    document.body,
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
}

export function MenuItem({ icon, label, hint, danger, onClick }: MenuItemProps) {
  return (
    <button type="button" className={cx("menu-item", danger && "danger")} onClick={onClick}>
      {icon && <span className="menu-item-icon">{icon}</span>}
      <span className="menu-item-label">{label}</span>
      {hint && <span className="menu-item-hint">{hint}</span>}
    </button>
  );
}

export const MenuDivider = () => <div className="menu-divider" />;
