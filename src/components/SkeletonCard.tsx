import React from "react";

export function SkeletonCard({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 animate-pulse shadow-sm"
        >
          {/* Image thumbnail placeholder */}
          <div className="aspect-square w-full rounded-xl bg-slate-200 dark:bg-slate-800 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent animate-shimmer" />
          </div>

          {/* Title & subtitle */}
          <div className="space-y-2 pt-1">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/2" />
          </div>

          {/* Price & button */}
          <div className="flex items-center justify-between pt-2">
            <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/4" />
          </div>
        </div>
      ))}
    </>
  );
}
