import React from "react";

interface ProductPlaceholderProps {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

// Generate consistent soft pastel gradients based on product name
const GRADIENTS = [
  "from-emerald-500/20 via-teal-500/15 to-cyan-500/20 text-emerald-700 dark:text-emerald-300",
  "from-blue-500/20 via-indigo-500/15 to-violet-500/20 text-blue-700 dark:text-blue-300",
  "from-purple-500/20 via-fuchsia-500/15 to-pink-500/20 text-purple-700 dark:text-purple-300",
  "from-amber-500/20 via-orange-500/15 to-rose-500/20 text-amber-700 dark:text-amber-300",
  "from-teal-500/20 via-cyan-500/15 to-sky-500/20 text-teal-700 dark:text-teal-300",
];

export default function ProductPlaceholder({
  name,
  className = "",
  size = "md",
}: ProductPlaceholderProps) {
  const initial = (name || "P").trim().charAt(0).toUpperCase();
  const hash = (name || "P").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradient = GRADIENTS[hash % GRADIENTS.length];

  const sizeStyles = {
    sm: "text-lg",
    md: "text-3xl",
    lg: "text-5xl",
  }[size];

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br ${gradient} ${className}`}
    >
      {/* Subtle geometric SVG backdrop */}
      <svg
        className="absolute inset-0 h-full w-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <circle cx="20" cy="20" r="35" fill="currentColor" fillOpacity="0.3" />
        <circle cx="85" cy="85" r="45" fill="currentColor" fillOpacity="0.25" />
        <path d="M 0 50 Q 50 100 100 50" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.4" />
      </svg>
      <span className={`relative font-black tracking-wider drop-shadow-sm select-none ${sizeStyles}`}>
        {initial}
      </span>
    </div>
  );
}
