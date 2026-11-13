import { useId } from "react";

const TOP = "#FFAB52";
const BOTTOM = "#EE4628";

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * 应用图标：暖色圆角方块里的一页纸，纸上是一个个“块”。
 * 小尺寸（侧边栏、标签页）自动切换成线条更粗的简化版，保证清晰。
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
        <linearGradient id={`${id}-tile`} x1="6" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor={TOP} />
          <stop offset="1" stopColor={BOTTOM} />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="32" y1="0" x2="32" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity=".28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}-tile)`} />
      {detailed ? (
        <>
          <rect width="64" height="64" rx="15" fill={`url(#${id}-sheen)`} />
          <rect x="25" y="11.5" width="25" height="35" rx="5" fill="#fff" opacity=".4" transform="rotate(9 37.5 29)" />
          <path
            d="M17.5 17a5.5 5.5 0 0 1 5.5-5.5h13.2L46 21.3V47a5.5 5.5 0 0 1-5.5 5.5H23a5.5 5.5 0 0 1-5.5-5.5z"
            fill="#fff"
          />
          <path d="M36.2 11.5v5.800a4 4 0 0 0 4 4H46z" fill={BOTTOM} opacity=".3" />
          <rect x="22.500" y="26.500" width="5.500" height="5.500" rx="1.700" fill={BOTTOM} />
          <rect x="31" y="27.700" width="10.500" height="3.100" rx="1.550" fill={BOTTOM} opacity=".5" />
          <rect x="22.500" y="35" width="5.500" height="5.500" rx="1.700" fill={TOP} />
          <rect x="31" y="36.200" width="7" height="3.100" rx="1.550" fill={BOTTOM} opacity=".38" />
          <rect x="22.500" y="43.500" width="5.500" height="5.500" rx="1.700" fill={BOTTOM} opacity=".3" />
          <rect x="31" y="44.700" width="9" height="3.100" rx="1.550" fill={BOTTOM} opacity=".26" />
        </>
      ) : (
        <>
          <path d="M15 16a6 6 0 0 1 6-6h16.500L49 21.500V48a6 6 0 0 1-6 6H21a6 6 0 0 1-6-6z" fill="#fff" />
          <path d="M37.500 10v6.500a5 5 0 0 0 5 5H49z" fill={BOTTOM} opacity=".32" />
          <rect x="21" y="27" width="8" height="8" rx="2.400" fill={BOTTOM} />
          <rect x="32.500" y="28.750" width="11" height="4.500" rx="2.250" fill={BOTTOM} opacity=".5" />
          <rect x="21" y="39.500" width="8" height="8" rx="2.400" fill={TOP} />
          <rect x="32.500" y="41.250" width="7.500" height="4.500" rx="2.250" fill={BOTTOM} opacity=".4" />
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
