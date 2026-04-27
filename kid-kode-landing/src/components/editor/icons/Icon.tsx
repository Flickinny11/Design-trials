"use client";

import * as React from "react";

// Authored icon paths (SVG, y-down, 24x24 viewBox).
// Shared with the 3D extrude system conceptually, rendered with inner gradients to suggest depth.
const PATHS: Record<string, string> = {
  home: "M12 2 L22 11 L20 11 L20 22 L14 22 L14 14 L10 14 L10 22 L4 22 L4 11 L2 11 L12 2 Z",
  chart:
    "M3 21 L8 21 L8 10 L3 10 Z M10 21 L15 21 L15 4 L10 4 Z M17 21 L22 21 L22 14 L17 14 Z",
  user: "M12 4 A4 4 0 1 1 12 12 A4 4 0 1 1 12 4 Z M4 21 C4 15 8 14 12 14 C16 14 20 15 20 21 Z",
  lock: "M7 10 L7 7 C7 4 9 2 12 2 C15 2 17 4 17 7 L17 10 L15 10 L15 7 C15 5.5 13.5 4 12 4 C10.5 4 9 5.5 9 7 L9 10 Z M5 11 L19 11 L19 21 L5 21 Z",
  eye: "M2 12 C5 6 9 4 12 4 C15 4 19 6 22 12 C19 18 15 20 12 20 C9 20 5 18 2 12 Z M12 8 A4 4 0 1 1 12 16 A4 4 0 1 1 12 8 Z",
  code: "M8 4 L2 12 L8 20 L6 20 L1 13 L1 11 L6 4 Z M16 4 L22 12 L16 20 L18 20 L23 13 L23 11 L18 4 Z",
  play: "M6 4 L20 12 L6 20 Z",
  pause: "M6 4 L10 4 L10 20 L6 20 Z M14 4 L18 4 L18 20 L14 20 Z",
  search:
    "M10 4 A6 6 0 1 1 10 16 A6 6 0 1 1 10 4 Z M15 15 L22 22 L20 22 L14 16 Z",
  snow: "M12 2 L14 8 L20 6 L16 11 L22 12 L16 13 L20 18 L14 16 L12 22 L10 16 L4 18 L8 13 L2 12 L8 11 L4 6 L10 8 Z",
  close:
    "M5 6 L7 4 L12 9 L17 4 L19 6 L14 11 L19 16 L17 18 L12 13 L7 18 L5 16 L10 11 Z",
  chevron: "M9 6 L15 12 L9 18 L7 16 L11 12 L7 8 Z",
  sparkle: "M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z",
  refresh:
    "M20 12 A8 8 0 1 0 12 20 L12 17 A5 5 0 1 1 17 12 L14 12 L18 8 L22 12 Z",
  save: "M4 4 L17 4 L20 7 L20 20 L4 20 Z M7 6 L15 6 L15 10 L7 10 Z M7 13 L17 13 L17 18 L7 18 Z",
  link: "M8 7 L14 7 L14 9 L8 9 A3 3 0 1 0 8 15 L14 15 L14 17 L8 17 A5 5 0 1 1 8 7 Z M16 7 L16 17 A5 5 0 1 0 16 7 Z",
  server:
    "M3 4 L21 4 L21 10 L3 10 Z M3 12 L21 12 L21 18 L3 18 Z M6 6 L8 6 L8 8 L6 8 Z M6 14 L8 14 L8 16 L6 16 Z",
  layers: "M12 2 L22 8 L12 14 L2 8 Z M2 13 L12 19 L22 13 L22 15 L12 21 L2 15 Z",
  zap: "M13 2 L4 14 L11 14 L10 22 L20 10 L13 10 Z",
  grid: "M3 3 L10 3 L10 10 L3 10 Z M14 3 L21 3 L21 10 L14 10 Z M3 14 L10 14 L10 21 L3 21 Z M14 14 L21 14 L21 21 L14 21 Z",
  flow: "M4 6 L14 6 L14 4 L20 8 L14 12 L14 10 L4 10 Z M20 14 L10 14 L10 12 L4 16 L10 20 L10 18 L20 18 Z",
  check: "M4 12 L10 18 L20 6 L18 4 L10 14 L6 10 Z",
  pin: "M12 2 L16 8 L22 10 L18 14 L19 21 L12 18 L5 21 L6 14 L2 10 L8 8 Z",
  edit: "M3 17 L14 6 L18 10 L7 21 L3 21 Z M15 4 L18 4 L20 6 L20 9 L17 12 L12 7 Z",
  trash: "M5 6 L19 6 L18 21 L6 21 Z M9 3 L15 3 L15 6 L9 6 Z",
  plus: "M11 5 L13 5 L13 11 L19 11 L19 13 L13 13 L13 19 L11 19 L11 13 L5 13 L5 11 L11 11 Z",
  arrowRight: "M4 12 L16 12 L12 7 L14 5 L22 12 L14 19 L12 17 L16 12 Z",
  menu: "M3 5 L21 5 L21 7 L3 7 Z M3 11 L21 11 L21 13 L3 13 Z M3 17 L21 17 L21 19 L3 19 Z",
  compass:
    "M12 2 A10 10 0 1 1 12 22 A10 10 0 1 1 12 2 Z M12 6 L14 12 L20 12 L14 14 L12 20 L10 14 L4 12 L10 12 Z",
};

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: string;
  size?: number | string;
  color?: string;
  accent?: string;
  glow?: boolean;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

// 3D-styled icon: fills with a soft vertical gradient + subtle highlight to suggest extruded depth.
export function Icon({
  name,
  size = 16,
  color,
  accent,
  glow = false,
  className,
  style,
}: IconProps) {
  const path = PATHS[name] || PATHS.sparkle;
  const primary = color || "currentColor";
  const hi = accent || "rgba(255,255,255,0.35)";
  const uid = React.useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{
        filter: glow ? `drop-shadow(0 0 6px ${primary})` : undefined,
        ...style,
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`ig-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hi} stopOpacity="0.85" />
          <stop offset="0.45" stopColor={primary} stopOpacity="1" />
          <stop offset="1" stopColor={primary} stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`il-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="0.2" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#ig-${uid})`} fillRule="evenodd" />
      <path
        d={path}
        fill={`url(#il-${uid})`}
        fillRule="evenodd"
        opacity="0.5"
      />
    </svg>
  );
}
