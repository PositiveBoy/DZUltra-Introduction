"use client";

import { Minus, Plus, Smartphone, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { DebugTracePanel } from "@/components/debug-trace-panel";
import { MobileShell } from "@/components/mobile-shell";
import { ProjectIntroBar } from "@/components/project-intro-bar";
import { AgentStatusBar } from "@/components/agent-status-bar";
import { useDemoStore } from "@/stores/use-demo-store";
import { cn } from "@/lib/utils";

const PHONE_FRAME_WIDTH = 450;
const PHONE_FRAME_HEIGHT = 920;
const MIN_PHONE_SCALE = 0.48;
const MAX_PHONE_SCALE = 1.1;

export default function Home() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#f7f4ed]">
      <ProjectIntroBar />

      <div className="min-h-0 flex-1 w-full overflow-hidden">
        <Group
          id="dzultra-desktop-workbench"
          orientation="horizontal"
          resizeTargetMinimumSize={{ coarse: 36, fine: 16 }}
          className="h-full w-full"
        >
          <Panel id="mobile-shell-panel" defaultSize="42%" minSize="320px" maxSize="72%" className="overflow-hidden">
            <MobilePreviewStage />
          </Panel>

          <Separator className="group flex w-3 shrink-0 cursor-col-resize items-center justify-center bg-neutral-200/70 transition-colors hover:bg-neutral-300 active:bg-dz-orange/30">
            <div className="flex h-14 w-1.5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200 transition-colors group-hover:ring-dz-orange/50">
              <div className="h-8 w-0.5 rounded-full bg-neutral-300 transition-colors group-hover:bg-dz-orange group-active:bg-dz-orange" />
            </div>
          </Separator>

          <Panel id="debug-trace-panel" defaultSize="58%" minSize="360px" maxSize="78%" className="overflow-hidden">
            <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-tl-lg border-l border-t border-dz-line bg-white">
              <AgentStatusBar />

              <div className="min-h-0 flex-1 overflow-hidden">
                <DebugTracePanel />
              </div>
            </div>
          </Panel>
        </Group>
      </div>
    </div>
  );
}

function MobilePreviewStage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [manualScale, setManualScale] = useState(0.72);
  const [fitToWindow, setFitToWindow] = useState(true);

  useEffect(() => {
    const target = stageRef.current;
    if (!target) {
      return;
    }

    const updateSize = () => {
      const rect = target.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    if (!stageSize.width || !stageSize.height) {
      return manualScale;
    }

    const widthScale = (stageSize.width - 32) / PHONE_FRAME_WIDTH;
    const heightScale = (stageSize.height - 28) / PHONE_FRAME_HEIGHT;
    return clamp(Math.min(widthScale, heightScale), MIN_PHONE_SCALE, MAX_PHONE_SCALE);
  }, [manualScale, stageSize.height, stageSize.width]);

  const appliedScale = fitToWindow ? fitScale : manualScale;
  const appliedMockUsers = useDemoStore((s) => s.appliedMockUsers);
  const activeUserId = useDemoStore((s) => s.activeUserId);
  const activeMockUser = appliedMockUsers.find((u) => u.id === activeUserId) ?? appliedMockUsers[0];
  const setMockBoardTab = useDemoStore((s) => s.setMockBoardTab);
  const setMockBoardExpanded = useDemoStore((s) => s.setMockBoardExpanded);
  const setActiveDebugTab = useDemoStore((s) => s.setActiveDebugTab);

  const openMockBoard = () => {
    setActiveDebugTab("mock");
    setMockBoardTab("user");
    setMockBoardExpanded(true);
  };

  const displayScale = Math.round(appliedScale * 100);

  function nudgeScale(delta: number) {
    setFitToWindow(false);
    setManualScale((value) => clamp(value + delta, MIN_PHONE_SCALE, MAX_PHONE_SCALE));
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-gradient-to-b from-[#f7f4ed] to-[#f0ece3]">
      <div className="flex min-h-[54px] shrink-0 flex-wrap items-center gap-2 border-b border-white/70 bg-white/72 px-4 py-2 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <Smartphone className="h-4 w-4 text-dz-orange" />
          <span className="text-xs font-black text-dz-ink">用户端演示</span>
          <span className="rounded-full bg-[#fff7dd] px-2 py-0.5 text-[11px] font-bold text-[#9a5c00]">
            {displayScale}%
          </span>
        </div>
        {/* Mock User 状态胶囊 */}
        {activeMockUser ? (
          <button
            type="button"
            onClick={openMockBoard}
            className="flex items-center gap-1.5 rounded-full border border-dz-orange/30 bg-dz-soft/60 px-2.5 py-1 backdrop-blur-sm transition hover:border-dz-orange hover:shadow-sm"
          >
            <User className="h-3 w-3 text-dz-orange" />
            <span className="max-w-[120px] truncate text-[11px] font-bold text-dz-ink">
              {activeMockUser.name}
            </span>
            <span className="rounded-full bg-dz-orange/15 px-1.5 py-px text-[10px] font-semibold text-dz-orange">
              {activeMockUser.user_type === "new" ? "新用户" : "老用户"}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={openMockBoard}
            className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 transition hover:border-dz-orange/50 hover:bg-dz-soft/40"
          >
            <User className="h-3 w-3 text-neutral-400" />
            <span className="text-[11px] font-medium text-neutral-400">未设置用户</span>
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => nudgeScale(-0.06)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-dz-line bg-white text-neutral-600 transition hover:border-dz-orange hover:text-dz-orange"
            aria-label="缩小手机预览"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => nudgeScale(0.06)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-dz-line bg-white text-neutral-600 transition hover:border-dz-orange hover:text-dz-orange"
            aria-label="放大手机预览"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFitToWindow((value) => !value)}
            className={cn(
              "h-8 rounded-full border px-3 text-xs font-bold transition",
              fitToWindow
                ? "border-dz-orange bg-dz-soft text-dz-orange"
                : "border-dz-line bg-white text-neutral-500 hover:border-dz-orange hover:text-dz-orange"
            )}
          >
            适应窗口
          </button>
        </div>
      </div>

      <div ref={stageRef} className="min-h-0 flex-1 overflow-auto p-3 [scrollbar-width:thin]">
        <div
          className="mx-auto"
          style={{
            width: PHONE_FRAME_WIDTH * appliedScale,
            height: PHONE_FRAME_HEIGHT * appliedScale
          }}
        >
          <div
            style={{
              width: PHONE_FRAME_WIDTH,
              height: PHONE_FRAME_HEIGHT,
              transform: `scale(${appliedScale})`,
              transformOrigin: "top left"
            }}
          >
            <MobileShell />
          </div>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
