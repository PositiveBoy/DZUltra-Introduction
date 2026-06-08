"use client";

/* ------------------------------------------------------------------ */
/*  PlanSkeleton — 方案生成中的骨架占位                                   */
/* ------------------------------------------------------------------ */

export function PlanSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="min-w-[85%] shrink-0 animate-pulse rounded-2xl border border-dz-line bg-white p-4"
        >
          {/* Title bar */}
          <div className="mb-3 h-5 w-3/5 rounded bg-neutral-200" />

          {/* Map area */}
          <div className="mb-4 h-[180px] rounded-xl bg-neutral-200" />

          {/* Transport info: 3 bars */}
          <div className="mb-3 space-y-2">
            <div className="h-3 w-2/3 rounded bg-neutral-200" />
            <div className="h-3 w-1/2 rounded bg-neutral-200" />
            <div className="h-3 w-3/5 rounded bg-neutral-200" />
          </div>

          {/* 3 stop rows */}
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="mb-3 flex items-center gap-3">
              {/* Circle */}
              <div className="h-10 w-10 shrink-0 rounded-xl bg-neutral-200" />
              {/* Text bars */}
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-neutral-200" />
                <div className="h-3 w-1/2 rounded bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
