import React from "react";

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse shadow-sm">
      {/* Table header */}
      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-6 py-3">
        {Array.from({ length: cols }).map((_, cIdx) => (
          <div
            key={cIdx}
            className={`h-4 bg-slate-200 dark:bg-slate-700 rounded ${
              cIdx === 0 ? "w-1/3" : "flex-1"
            }`}
          />
        ))}
      </div>

      {/* Table rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex items-center gap-4 px-6 py-4">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className={`h-4 bg-slate-100 dark:bg-slate-800 rounded ${
                  cIdx === 0 ? "w-1/3" : "flex-1"
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
