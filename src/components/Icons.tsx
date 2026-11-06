import React from "react";

export type IconProps = {
  className?: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

const base = (
  size = 18,
  strokeWidth = 2,
  className = "",
  color = "currentColor"
) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: `inline-block shrink-0 ${className}`.trim(),
});

export const PaletteIcon: React.FC<IconProps> = ({ size, strokeWidth, className, color }) => (
  <svg {...base(size, strokeWidth, className, color)}>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

export const ArcticIcon: React.FC<IconProps> = ({ size, strokeWidth, className, color }) => (
  <svg {...base(size, strokeWidth, className, color)}>
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const SunsetIcon: React.FC<IconProps> = ({ size, strokeWidth, className, color }) => (
  <svg {...base(size, strokeWidth, className, color)}>
    <path d="M17 18a5 5 0 0 0-10 0" />
    <line x1="12" y1="2" x2="12" y2="9" />
    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
    <line x1="1" y1="18" x2="3" y2="18" />
    <line x1="21" y1="18" x2="23" y2="18" />
    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
    <line x1="23" y1="22" x2="1" y2="22" />
  </svg>
);

export const EmeraldIcon: React.FC<IconProps> = ({ size, strokeWidth, className, color }) => (
  <svg {...base(size, strokeWidth, className, color)}>
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);

export const MidnightIcon: React.FC<IconProps> = ({ size, strokeWidth, className, color }) => (
  <svg {...base(size, strokeWidth, className, color)}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    <path d="M19 3v4" />
    <path d="M21 5h-4" />
  </svg>
);

export const RoyalIcon: React.FC<IconProps> = ({ size, strokeWidth, className, color }) => (
  <svg {...base(size, strokeWidth, className, color)}>
    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.201a4 4 0 0 1-3.856 2.929H8.709a4 4 0 0 1-3.856-2.929L2.019 6.02a.5.5 0 0 1 .798-.52l4.276 3.665a1 1 0 0 0 1.516-.294z" />
  </svg>
);

export const MetaIcon: React.FC<IconProps> = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`inline-block shrink-0 ${className}`}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export const TikTokIcon: React.FC<IconProps> = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`inline-block shrink-0 ${className}`}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.99v7.92c0 1.77-.45 3.55-1.42 4.97-1.39 2.05-3.69 3.32-6.15 3.48-1.57.1-3.15-.24-4.57-.96-2.07-1.05-3.62-2.91-4.23-5.15-.36-1.3-.39-2.69-.13-4.03.62-2.92 2.77-5.28 5.62-6.14.7-.21 1.43-.32 2.16-.33v4.18c-.85.04-1.7.32-2.38.86-.92.74-1.48 1.88-1.47 3.06.01 1.05.51 2.06 1.34 2.72.82.66 1.91.95 2.95.81 1.25-.16 2.37-.96 2.87-2.11.23-.52.34-1.08.34-1.65V.02z" />
  </svg>
);

export const LinkedInIcon: React.FC<IconProps> = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`inline-block shrink-0 ${className}`}>
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.76v8.37H6.46V10.9M7.84 6.78a1.62 1.62 0 0 0-1.62 1.62c0 .9.72 1.62 1.62 1.62a1.62 1.62 0 0 0 1.62-1.62c0-.9-.72-1.62-1.62-1.62Z" />
  </svg>
);

export const SparklesIcon: React.FC<IconProps> = ({ size, strokeWidth, className, color }) => (
  <svg {...base(size, strokeWidth, className, color)}>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

export const RocketIcon: React.FC<IconProps> = ({ size, strokeWidth, className, color }) => (
  <svg {...base(size, strokeWidth, className, color)}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);
