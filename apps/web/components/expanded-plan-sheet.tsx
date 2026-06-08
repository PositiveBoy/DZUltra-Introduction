"use client";

import { ExternalLink, Utensils } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { DemoPoiStop, DemoRoutePlan } from "@/types/dzultra";
import { PoiStopRow, RouteMapPreview } from "./plan-card";

/* ------------------------------------------------------------------ */
/*  ExpandedPlanSheet                                                  */
/* ------------------------------------------------------------------ */

export function ExpandedPlanSheet({
  plan,
  onChoose
}: {
  plan: DemoRoutePlan;
  onClose: () => void;
  onChoose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  hasPrevious: boolean;
  hasNext: boolean;
}) {
  const [mockJump, setMockJump] = useState<string | null>(null);

  function showMockJump(message: string) {
    setMockJump(message);
    window.setTimeout(() => setMockJump(null), 1800);
  }

  return (
    <motion.div
      className="absolute inset-0 z-50 bg-white"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="h-full overflow-y-auto overscroll-contain px-[23px] pb-[210px] pt-[128px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <motion.div
          key={plan.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-[30px] font-semibold leading-[42px] text-black">{plan.title}</h1>
          <p className="mt-1 text-[19px] font-normal leading-[30px] text-black">
            {plan.description || plan.subtitle}
          </p>

          <div className="mt-4">
            <RouteMapPreview plan={plan} onClick={() => showMockJump("这是 Mock 地图跳转：真实接入后会打开高德/点评地图页。")} />
          </div>

          <h2 className="mb-3 mt-6 text-[22px] font-semibold leading-[31px] text-black">地点顺序</h2>

          <div className="space-y-7">
            {plan.stops.map((stop, index) => (
              <DetailStop
                key={stop.poiId}
                stop={stop}
                index={index}
                onMockJump={() => showMockJump(`这是 Mock POI 跳转：真实接入后会打开「${stop.poiName}」详情页。`)}
              />
            ))}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {mockJump && <MockJumpToast message={mockJump} />}
      </AnimatePresence>

      <footer className="absolute bottom-[92px] left-0 right-0 z-20 px-[22px] pb-2">
        <button
          onClick={(event) => {
            event.stopPropagation();
            onChoose();
          }}
          className="h-[58px] w-full rounded-full border border-white bg-[#FF5B2A] text-[20px] font-semibold text-white shadow-[0_8px_32px_rgba(48,104,156,0.10)]"
        >
          选用此方案
        </button>
      </footer>
    </motion.div>
  );
}

function DetailStop({
  stop,
  index,
  onMockJump
}: {
  stop: DemoPoiStop;
  index: number;
  onMockJump: () => void;
}) {
  const dishes = detailDishesForStop(stop);
  const images = detailImagesForStop(stop);

  return (
    <section>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onMockJump();
        }}
        className="block w-full rounded-[14px] border border-[#F3EEE3] bg-white text-left shadow-[0_8px_32px_rgba(48,104,156,0.10)] transition active:scale-[0.99]"
      >
        <PoiStopRow stop={stop} index={index} isHighlighted={false} showWrapper={false} compact />
      </button>

      <div className="mt-4 space-y-1 text-[19px] leading-[31px] text-black">
        <p>
          <span className="font-semibold">口味口碑：</span>
          {stop.tasteSummary || stop.ugcSummary}
        </p>
        <p>
          <span className="font-semibold">环境服务：</span>
          {stop.envSummary || "环境稳定，动线清楚，适合本轮路线节奏；服务和到店体验来自本地 Mock UGC 摘要。"}
        </p>
      </div>

      {stop.category === "food" && dishes.length > 0 && (
        <div className="mt-4 rounded-[16px] bg-[#FFF6EE] px-3 py-3">
          <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-[#D45B22]">
            <Utensils className="h-4 w-4" />
            菜单里的推荐菜
          </div>
          <div className="flex flex-wrap gap-2">
            {dishes.map((dish) => (
              <span key={dish} className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-[#4B3A31] shadow-sm">
                {dish}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-1.5 overflow-hidden rounded-[8px]">
        {images.slice(0, 3).map((image, imageIndex) => (
          <button
            type="button"
            key={`${image}-${imageIndex}`}
            onClick={(event) => {
              event.stopPropagation();
              onMockJump();
            }}
            className="aspect-[1/1.12] overflow-hidden bg-neutral-100"
          >
            <img
              src={image}
              alt={`${stop.poiName} UGC ${imageIndex + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </section>
  );
}

function detailImagesForStop(stop: DemoPoiStop) {
  if (stop.images?.length) {
    return stop.images;
  }
  if (stop.category === "culture") {
    return [
      "/mock-reference-assets/todo-reference-art-ticket.png",
      "/mock-reference-assets/todo-reference-lakeside-walk.png",
      "/mock-reference-assets/todo-reference-coffee-deal.png"
    ];
  }
  if (stop.category === "dessert") {
    return [
      "/mock-reference-assets/todo-reference-dessert-deal.png",
      "/mock-reference-assets/todo-reference-coffee-deal.png",
      "/mock-reference-assets/todo-reference-bistro-deal.png"
    ];
  }
  return [
    "/mock-reference-assets/todo-reference-bistro-deal.png",
    "/mock-reference-assets/todo-reference-japanese-queue.png",
    "/mock-reference-assets/todo-reference-dessert-deal.png"
  ];
}

function detailDishesForStop(stop: DemoPoiStop) {
  if (stop.recommendedDishes?.length) {
    return stop.recommendedDishes.slice(0, 4);
  }
  if (stop.category === "food") {
    return ["炭火鸡肉串", "柚子胡椒鸡腿肉", "海胆温泉蛋", "梅子苏打"];
  }
  return [];
}

function MockJumpToast({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="absolute left-6 right-6 top-[120px] z-30 rounded-[18px] border border-[#FFE0D2] bg-white/94 px-4 py-3 text-[12px] font-semibold leading-5 text-[#20283A] shadow-[0_16px_44px_rgba(32,40,58,0.16)] backdrop-blur"
    >
      <div className="flex items-start gap-2">
        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5B2A]" />
        <span>{message}</span>
      </div>
    </motion.div>
  );
}
