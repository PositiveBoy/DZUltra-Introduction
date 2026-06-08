"use client";

import { Bike, Car, Footprints, MapPinned, Star, TrainFront } from "lucide-react";
import { motion } from "motion/react";
import type { DemoPoiStop, DemoRoutePlan } from "@/types/dzultra";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

export function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "fill-dz-orange text-dz-orange",
            i < Math.floor(rating) ? "opacity-100" : "opacity-30"
          )}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

export function transportIcon(mode: string) {
  const iconClass = "h-3.5 w-3.5";
  switch (mode) {
    case "bike":
      return <Bike className={cn(iconClass, "text-[#FFD84D]")} />;
    case "metro":
    case "transit":
      return <TrainFront className={cn(iconClass, "text-[#CE7170]")} />;
    case "walk":
      return <Footprints className={cn(iconClass, "text-[#3D7BEA]")} />;
    case "drive":
    case "taxi":
      return <Car className={cn(iconClass, "text-[#FF9166]")} />;
    default:
      return <MapPinned className={cn(iconClass, "text-dz-orange")} />;
  }
}

export function routeMapImageSrc(stopCount: number) {
  const count = Math.min(5, Math.max(3, stopCount || 3));
  return `/mock-reference-assets/map${count}.png`;
}

export function RouteMapPreview({
  plan,
  compact = false,
  onClick
}: {
  plan: DemoRoutePlan;
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "block w-full overflow-hidden bg-[#F6F0E7] text-left transition active:scale-[0.99]",
        compact ? "rounded-[18px] p-[10px]" : "rounded-[18px]"
      )}
      aria-label="查看路线地图"
    >
      <img
        src={routeMapImageSrc(plan.stops.length)}
        alt={`${plan.title} 伪地图`}
        className={cn("w-full object-cover", compact ? "h-[107px] rounded-[12px]" : "h-[198px] rounded-t-[18px]")}
        loading="lazy"
      />
      {!compact && (
        <div className="flex h-12 items-center justify-center bg-white text-[15px] font-medium text-black">
          查看地图
        </div>
      )}
    </button>
  );
}

function RatingStrip({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-[1px]">
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className="flex h-[13px] w-[13px] items-center justify-center rounded-[2px] bg-[#FF612D]">
          <Star className="h-[8px] w-[8px] fill-white text-white" />
        </span>
      ))}
      <span className="ml-1 text-[12px] font-medium leading-none text-[#FF612D]">{rating.toFixed(1)}</span>
    </span>
  );
}

function primaryBadge(stop: DemoPoiStop) {
  return stop.platformBadges?.[0] ?? stop.platformBadge;
}

function stopDistanceLabel(stop: DemoPoiStop, index: number) {
  if (index === 0) {
    return "距目的地1.0km";
  }
  if (stop.distanceFromPrevious.includes("步行") || stop.distanceFromPrevious.includes("打车")) {
    return stop.distanceFromPrevious.replace("约 ", "");
  }
  return stop.distanceFromPrevious;
}

/* ------------------------------------------------------------------ */
/*  POI Stop Row                                                       */
/* ------------------------------------------------------------------ */

export function PoiStopRow({
  stop,
  index,
  isHighlighted,
  compact = false,
  showWrapper = true,
  onClick
}: {
  stop: DemoPoiStop;
  index: number;
  isHighlighted: boolean;
  compact?: boolean;
  showWrapper?: boolean;
  onClick?: () => void;
}) {
  const headPicSrc = stop.headPic || stop.images?.[0];
  const badge = primaryBadge(stop);

  const content = (
    <>
      <div className="flex min-w-0 items-stretch">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center bg-[#FF9166] font-black text-white",
            compact ? "w-[31px] rounded-l-[14px] text-[30px] leading-none" : "w-[44px] rounded-l-[16px] text-[32px] leading-none"
          )}
        >
          {index + 1}
        </div>

        <div className={cn("min-w-0 flex-1 rounded-r-[14px] bg-white", compact ? "px-3 py-3" : "px-3.5 py-3")}>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={cn("shrink-0 overflow-hidden bg-neutral-100", compact ? "h-[54px] w-[54px] rounded-[7px]" : "h-[58px] w-[58px] rounded-[8px]")}>
              {headPicSrc ? (
                <img
                  src={headPicSrc}
                  alt={stop.poiName}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      parent.innerHTML = '<div class="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">暂无</div>';
                    }
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">暂无</div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-black leading-[18px] text-black">{stop.poiName}</div>

              <div className="mt-1 flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                <RatingStrip rating={stop.rating} />
                {stop.avgPrice && <span className="text-[11px] leading-none text-[#8D8D8D]">¥{stop.avgPrice}/人</span>}
                <span className="truncate text-[11px] leading-none text-[#8D8D8D]">{stopDistanceLabel(stop, index)}</span>
              </div>

              <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                {badge && (
                  <span className="inline-flex min-w-0 items-center rounded bg-[#FFF0E7] px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#D45B22]">
                    <span className="mr-1 rounded-[2px] bg-[#FF9166] px-0.5 text-white">榜</span>
                    <span className="truncate">{badge}</span>
                  </span>
                )}
                {stop.positiveRate && (
                  <span className="shrink-0 rounded bg-[#F5F5F5] px-1.5 py-0.5 text-[10px] font-bold leading-none text-[#999999]">
                    {stop.positiveRate}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {!compact && stop.recommendedDishes && stop.recommendedDishes.length > 0 && (
        <div className="mt-2 text-[12px] leading-5 text-neutral-600">
          <span className="font-bold text-dz-ink">推荐菜：</span>
          {stop.recommendedDishes.slice(0, 3).join("、")}
        </div>
      )}

      {showWrapper && stop.transportOptions && stop.transportOptions.length > 0 && (
        <div className="ml-[39px] mt-2 grid grid-cols-3 gap-2 border-l border-[#EFE8DB] pl-[18px]">
          {stop.transportOptions.slice(0, 3).map((transport) => (
            <div key={transport.mode} className="flex h-[22px] items-center justify-center gap-1 rounded-[8px] bg-[#F0F0F0] text-[8px] leading-none text-black">
              {transportIcon(transport.mode)}
              <span>{transport.label}</span>
              <span className="h-3 w-px bg-[#E6E6E6]" />
              <span>{transport.minutes}分钟</span>
            </div>
          ))}
        </div>
      )}

      {!showWrapper && stop.transportOptions && stop.transportOptions.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {stop.transportOptions.slice(0, 3).map((transport) => (
            <div key={transport.mode} className="flex h-8 items-center justify-center gap-1.5 rounded-[9px] bg-[#F0F0F0] text-[11px] text-black">
              {transportIcon(transport.mode)}
              <span>{transport.label}</span>
              <span className="h-3.5 w-px bg-[#E0E0E0]" />
              <span>{transport.minutes}分钟</span>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (!showWrapper) {
    return content;
  }

  return (
    <motion.button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      animate={
        isHighlighted
          ? {
              backgroundColor: ["#ffffff", "#fff7f0", "#ffffff"],
              borderColor: ["#F3EEE3", "#ffd4b8", "#F3EEE3"],
              boxShadow: [
                "0 8px 32px rgba(48,104,156,0.10)",
                "0 12px 28px rgba(255,102,43,0.16)",
                "0 8px 32px rgba(48,104,156,0.10)"
              ]
            }
          : {}
      }
      transition={{ duration: 1.05, ease: "easeInOut" }}
      className="block w-full rounded-[14px] border border-[#F3EEE3] bg-white text-left shadow-[0_8px_32px_rgba(48,104,156,0.10)]"
    >
      {content}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/*  PlanCard                                                           */
/* ------------------------------------------------------------------ */

export function PlanCard({
  plan,
  active,
  highlightedStopId,
  onExpand
}: {
  plan: DemoRoutePlan;
  active: boolean;
  highlightedStopId?: string;
  onExpand: () => void;
}) {
  return (
    <article
      onClick={onExpand}
      className={cn(
        "min-h-[632px] cursor-pointer rounded-[24px] border border-[#EBE7E0] bg-white px-5 py-5 shadow-[0_8px_32px_rgba(17,44,106,0.10)] transition active:scale-[0.995]",
        active && "border-[#EBE7E0]"
      )}
    >
      <div className="flex flex-col gap-[15px]">
        <div>
          <div className="flex items-center gap-4">
            <h2 className="truncate text-[20px] font-semibold leading-7 text-black">{plan.title}</h2>
            {plan.badge && (
              <span className="shrink-0 rounded-full bg-[#FFF3D5] px-2.5 py-1 text-[12px] font-medium leading-[17px] text-[#F58B00]">
                {plan.badge.includes("直接") ? "推荐" : plan.badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-[14px] font-normal leading-5 text-[#999999]">方案简介</p>
        </div>

        <RouteMapPreview plan={plan} compact />

        <div>
          <div className="mb-2 text-[16px] font-semibold leading-[22px] text-black">地点顺序</div>
          <div className="space-y-2">
            {plan.stops.map((stop, index) => (
              <PoiStopRow
                key={stop.poiId}
                stop={stop}
                index={index}
                isHighlighted={highlightedStopId === stop.poiId}
                compact
                onClick={onExpand}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
