/**
 * Shared inline-SVG glyphs — the Lumière icon language (stroke, currentColor,
 * 1.7 width, 24-box). Replaces emoji-as-icons across legacy surfaces so icons
 * are theme-aware, crisp, and consistent (no emoji as icons).
 */

export type GlyphName =
  | "moon" | "share" | "trash" | "sparkle" | "bell" | "bell-off"
  | "chat" | "box" | "import" | "receipt" | "alert"
  | "phone" | "copy" | "check";

const PATHS: Record<GlyphName, string> = {
  moon: "M20 14.5A8 8 0 1 1 9.5 4 6.2 6.2 0 0 0 20 14.5z",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
  trash: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6",
  sparkle: "M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM19 14l.8 2 .2.8.8.2 2 .8-2 .8-.8.2-.2.8-.8 2-.8-2-.2-.8-.8-.2-2-.8 2-.8.2-.8.8-2z",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  "bell-off": "M8.7 6.7A6 6 0 0 1 18 8c0 4 1 6 2 7M6 8c0 7-3 9-3 9h13M13.7 21a2 2 0 0 1-3.4 0M3 3l18 18",
  chat: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.2A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z",
  box: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  import: "M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2",
  receipt: "M6 2h12v20l-3-2-3 2-3-2-3 2V2zM9 7h6M9 11h6M9 15h4",
  alert: "M12 3 2 20h20L12 3zM12 9v5M12 17.5v.5",
  phone: "M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L19 17l-1 4a16 16 0 0 1-13-13z",
  copy: "M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  check: "M4 12.5l5 5L20 6",
};

export default function Glyph({
  name,
  className = "",
  size = 18,
}: {
  name: GlyphName;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={"inline-block shrink-0 " + className}
      style={{ verticalAlign: "-0.18em" }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
