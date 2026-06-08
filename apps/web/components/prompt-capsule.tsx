"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

export type PromptEntry = {
  id: string;
  text: string;
  label: string;
  /** data-flow-block index or scroll target selector */
  scrollTargetSelector?: string;
};

type PromptCapsuleProps = {
  /** 大模型摘要文本，优先使用后端返回值 */
  summary: string;
  /** 本轮所有用户 prompt 条目 */
  entries: PromptEntry[];
  /** 滚动容器 ref，用于 IntersectionObserver root 和跳转滚动 */
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  /** 顶栏安全区域高度（胶囊 top 偏移） */
  topOffset?: number;
  /** 是否激活（仅在 running/clarifying/summary/plans/refining/selected 等视图激活） */
  active: boolean;
  /** 点击"编辑需求"回调 */
  onEdit?: () => void;
};

/**
 * Prompt 冻结胶囊 + 展开面板。
 *
 * 滚动检测：IntersectionObserver 监听 [data-prompt-anchor] 元素。
 * 滚出视口时显示毛玻璃胶囊，滚回视口时隐藏。
 * 点击胶囊展开全屏面板，显示本轮所有 prompt。
 */
export function PromptCapsule({
  summary,
  entries,
  scrollContainerRef,
  topOffset = 96,
  active,
  onEdit
}: PromptCapsuleProps) {
  const prefersReducedMotion = useReducedMotion();
  const [capsuleVisible, setCapsuleVisible] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // IntersectionObserver: 监听 data-prompt-anchor 元素
  useEffect(() => {
    if (!active || !scrollContainerRef.current) {
      setCapsuleVisible(false);
      return;
    }

    const container = scrollContainerRef.current;
    const anchor = container.querySelector("[data-prompt-anchor]");

    if (!anchor) {
      setCapsuleVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // anchor 不在视口内时显示胶囊
        setCapsuleVisible(!entry.isIntersecting);
      },
      {
        root: container,
        threshold: 0
      }
    );

    observer.observe(anchor);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [active, scrollContainerRef]);

  // active 变为 false 时重置状态
  useEffect(() => {
    if (!active) {
      setCapsuleVisible(false);
      setPanelOpen(false);
    }
  }, [active]);

  const openPanel = useCallback(() => {
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const scrollToEntry = useCallback(
    (entry: PromptEntry) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      setPanelOpen(false);

      // 优先使用 scrollTargetSelector
      if (entry.scrollTargetSelector) {
        const target = container.querySelector(entry.scrollTargetSelector) as HTMLElement | null;
        if (target) {
          target.scrollIntoView({ behavior: prefersReducedMotion ? "instant" : "smooth", block: "start" });
          return;
        }
      }

      // fallback: 查找 data-prompt-anchor
      const anchor = container.querySelector("[data-prompt-anchor]") as HTMLElement | null;
      if (anchor) {
        anchor.scrollIntoView({ behavior: prefersReducedMotion ? "instant" : "smooth", block: "start" });
      }
    },
    [scrollContainerRef, prefersReducedMotion]
  );

  // 不激活时不渲染
  if (!active) {
    return null;
  }

  const animDuration = prefersReducedMotion ? 0 : 0.22;

  return (
    <>
      {/* 冻结胶囊 */}
      <AnimatePresence>
        {capsuleVisible && !panelOpen && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: animDuration }}
            onClick={openPanel}
            className="absolute inset-x-0 z-[21] flex justify-center"
            style={{ top: topOffset }}
            aria-label="展开本轮需求摘要"
          >
            <span
              className="max-w-[80%] truncate rounded-full border border-white/70 px-4 py-2 text-center text-[13px] font-black text-[#20283a] shadow-[0_8px_26px_rgba(32,40,58,0.12)]"
              style={{
                background: "var(--dz-blur-capsule-bg, rgba(255, 255, 255, 0.62))",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)"
              }}
            >
              {summary}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* 展开面板 */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            className="absolute inset-0 z-30 p-6"
            style={{
              background: "var(--dz-blur-panel-overlay, rgba(255, 255, 255, 0.52))",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)"
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: animDuration }}
            onClick={closePanel}
          >
            <motion.section
              initial={{ y: -16, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: -12, scale: 0.98 }}
              transition={{ duration: animDuration }}
              onClick={(event) => event.stopPropagation()}
              className="mt-[96px] max-h-[70%] overflow-y-auto rounded-[26px] bg-white/90 p-5 shadow-[0_24px_80px_rgba(32,40,58,0.18)] backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-[#4f68ff]">本轮需求摘要</p>
                  <h3 className="mt-1 text-xl font-black text-[#20283a]">{summary}</h3>
                </div>
                <button
                  onClick={closePanel}
                  className="rounded-full bg-[#f3f4f7] px-3 py-1 text-xs font-black text-[#687083]"
                >
                  收起
                </button>
              </div>
              <div className="space-y-3">
                {entries.map((entry, index) => (
                  <button
                    key={entry.id}
                    onClick={() => scrollToEntry(entry)}
                    className="grid w-full grid-cols-[28px_1fr] gap-3 rounded-2xl border border-[#edf0f6] bg-white px-3 py-3 text-left transition-colors hover:bg-[#f8f9fc]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef1ff] text-xs font-black text-[#4f68ff]">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-xs font-black text-[#7a8190]">{entry.label}</span>
                      <span className="mt-1 block text-sm font-semibold leading-6 text-[#20283a]">{entry.text}</span>
                    </span>
                  </button>
                ))}
              </div>
              {onEdit && (
                <button
                  onClick={() => {
                    closePanel();
                    onEdit();
                  }}
                  className="mt-4 w-full rounded-2xl bg-[#20283a] px-4 py-3 text-sm font-black text-white"
                >
                  编辑需求并重新规划
                </button>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
