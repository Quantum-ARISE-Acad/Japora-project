/**
 * Shared inline-SVG glyphs — the Lumière icon language (stroke, currentColor,
 * 1.7 width, 24-box). Replaces emoji-as-icons across legacy surfaces so icons
 * are theme-aware, crisp, and consistent (no emoji as icons).
 */

export type GlyphName =
  | "moon" | "share" | "trash" | "sparkle" | "bell" | "bell-off"
  | "chat" | "box" | "import" | "receipt" | "alert"
  | "phone" | "copy" | "check"
  // Added for the dashboard, which still carried emoji as iconography.
  | "megaphone" | "refresh" | "close" | "star" | "print" | "cog"
  | "key" | "link" | "book" | "bolt" | "flask" | "plug" | "card"
  | "chart" | "camera" | "trending" | "folder" | "plus" | "bot"
  | "bag" | "feed" | "send" | "search" | "pencil" | "clock"
  | "mail" | "handshake" | "globe" | "star-filled" | "cart" | "shield";

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

  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 8.5a5 5 0 0 1 0 7M18 6a9 9 0 0 1 0 12",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  close: "M6 6l12 12M18 6L6 18",
  "star-filled": "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.5z",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.5z",
  print: "M7 8V3h10v5M7 18H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v7H7v-7z",
  cog: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM12 2.5v2.6M12 18.9v2.6M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.9 19.1l1.9-1.9M17.2 6.8l1.9-1.9",
  key: "M15.5 8.5a3.5 3.5 0 1 1-3.1 5.1L11 15h-2v2H7v2H4v-3l6.4-6.4a3.5 3.5 0 0 1 5.1-1.1zM16 8.5h.01",
  link: "M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.4 6.4M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.4-1.4",
  book: "M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5v-15zM8 3v18M11 8h5M11 12h5",
  bolt: "M13 2.5L5 13.5h5l-1 8 8-11h-5l1-8z",
  flask: "M9 3h6M10 3v5.5L5.5 17A2.5 2.5 0 0 0 7.8 21h8.4a2.5 2.5 0 0 0 2.3-4L14 8.5V3M7.5 14h9",
  plug: "M9 3v5M15 3v5M6 8h12v2a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8zM12 16v5",
  card: "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8zM3 11h18M6.5 15h3",
  chart: "M4 20V4M4 20h16M8 20v-6M12.5 20V9M17 20v-9",
  camera: "M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h7.2l1.2 2h2.2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9zM12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  trending: "M3 17l6-6 4 4 8-8M15 7h6v6",
  folder: "M3 7a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z",
  plus: "M12 5v14M5 12h14",
  bot: "M7 9h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM12 5.5V9M12 3.5h.01M9.5 13.5h.01M14.5 13.5h.01M3 13v3M21 13v3",
  bag: "M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2",
  feed: "M4 5h16v5H4V5zM4 14h7v5H4v-5zM13 14h7v5h-7v-5z",
  send: "M4 12l16-8-6 16-3-6-7-2z",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20",
  pencil: "M4 20h4L20 8l-4-4L4 16v4zM14.5 5.5l4 4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3.5 2",
  mail: "M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7zM3.4 6.6l8.6 6.4 8.6-6.4",
  handshake: "M8 11.5l2.5-2.5a1.5 1.5 0 0 1 2.1 0l1.2 1.2M3 9.5l4-3 4 4-2 2a1.4 1.4 0 0 0 0 2l3 3a1.4 1.4 0 0 0 2 0l1-1 2 2 4-3.5-5.5-6",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.3 9h17.4M3.3 15h17.4M12 3a13 13 0 0 1 0 18 13 13 0 0 1 0-18z",
  cart: "M3 4h2.2l2.3 11h10l2.2-7.5H6.4M10 20h.01M17 20h.01",
  shield: "M12 3l7.5 2.8v5.4c0 4.4-3 8-7.5 9.8-4.5-1.8-7.5-5.4-7.5-9.8V5.8L12 3z",
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
      <path d={PATHS[name]} fill={name === "star-filled" ? "currentColor" : "none"} />
    </svg>
  );
}
