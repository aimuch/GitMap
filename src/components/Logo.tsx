import { useId } from "react";

const TOP = "#333942";
const BOTTOM = "#181B20";
const ACCENT = "#2383E2";

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * 应用图标：克制的深石墨圆角方块与纸页块结构，搭配一点蓝色高亮块。
 * 小尺寸自动切换简化笔触，在浅色与深色侧边栏下均清晰耐看。
 */
export function Logo({ size = 24, className }: LogoProps) {
  const id = useId();
  const detailed = size >= 32;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="OpenNotion"
      style={{ flexShrink: 0, display: "block" }}
    >
      <defs>
        <linearGradient id={`${id}-tile`} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor={TOP} />
          <stop offset="1" stopColor={BOTTOM} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}-tile)`} />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="1.5" />
      {detailed ? (
        <>
          <rect x="24.5" y="12" width="24" height="34" rx="5" fill="#fff" opacity=".22" transform="rotate(8 36.5 29)" />
          <path
            d="M17.5 17a5.5 5.5 0 0 1 5.5-5.5h13.2L46 21.3V47a5.5 5.5 0 0 1-5.5 5.5H23a5.5 5.5 0 0 1-5.5-5.5z"
            fill="#fff"
          />
          <path d="M36.2 11.5v5.8a4 4 0 0 0 4 4H46z" fill={BOTTOM} opacity=".22" />
          <rect x="22.5" y="26.5" width="5.5" height="5.5" rx="1.7" fill={ACCENT} />
          <rect x="31" y="27.7" width="10.5" height="3.1" rx="1.55" fill={BOTTOM} opacity=".62" />
          <rect x="22.5" y="35" width="5.5" height="5.5" rx="1.7" fill={BOTTOM} opacity=".35" />
          <rect x="31" y="36.2" width="7.5" height="3.1" rx="1.55" fill={BOTTOM} opacity=".42" />
          <rect x="22.5" y="43.5" width="5.5" height="5.5" rx="1.7" fill={BOTTOM} opacity=".2" />
          <rect x="31" y="44.7" width="9.5" height="3.1" rx="1.55" fill={BOTTOM} opacity=".26" />
        </>
      ) : (
        <>
          <path d="M15 16a6 6 0 0 1 6-6h16.5L49 21.5V48a6 6 0 0 1-6 6H21a6 6 0 0 1-6-6z" fill="#fff" />
          <path d="M37.5 10v6.5a5 5 0 0 0 5 5H49z" fill={BOTTOM} opacity=".24" />
          <rect x="21" y="27" width="7.5" height="7.5" rx="2.2" fill={ACCENT} />
          <rect x="32" y="28.6" width="11" height="4.2" rx="2.1" fill={BOTTOM} opacity=".62" />
          <rect x="21" y="39" width="7.5" height="7.5" rx="2.2" fill={BOTTOM} opacity=".34" />
          <rect x="32" y="40.6" width="8" height="4.2" rx="2.1" fill={BOTTOM} opacity=".42" />
        </>
      )}
    </svg>
  );
}

/** 文字标：Open 轻、Notion 重。 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark${className ? ` ${className}` : ""}`}>
      <span className="wordmark-light">Open</span>
      <span className="wordmark-bold">Notion</span>
    </span>
  );
}
