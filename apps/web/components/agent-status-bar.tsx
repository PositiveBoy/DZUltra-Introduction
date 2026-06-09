"use client";

import { ChevronDown, Cpu, Map as MapIcon, CloudSun, Users2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDemoStore, type ProviderStatus } from "@/stores/use-demo-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_DZULTRA_API_BASE_URL ?? "/api";

// 后端 /providers/status 返回的 provider 结构
type ApiProviderStatus = {
  category: string;
  provider: string;
  configured: boolean;
  active: boolean;
  fallback_provider?: string | null;
  notes?: string | null;
};

// 将后端状态映射为前端 ProviderStatus
function mapApiToProviderStatus(apiProviders: ApiProviderStatus[]): ProviderStatus[] {
  const labelMap: Record<string, { label: string; shortLabel: string }> = {
    amap: { label: "高德地图", shortLabel: "地图" },
    caiyun: { label: "彩云天气", shortLabel: "天气" },
    longcat: { label: "LongCat LLM", shortLabel: "LLM" },
  };
  return apiProviders.map((p) => {
    const labels = labelMap[p.provider] ?? { label: p.provider, shortLabel: p.provider };
    const status: ProviderStatus["status"] = p.active
      ? "connected"
      : p.configured
        ? "timeout"
        : "mock";
    return {
      name: p.provider,
      label: labels.label,
      shortLabel: labels.shortLabel,
      status,
      lastDegradedReason: !p.active && p.configured ? "Key 已配置但调用失败，已降级" : undefined,
    };
  });
}

const agentSteps = [
  { id: "InteractionRouterAgent", short: "Router" },
  { id: "ConstraintDiscoveryAgent", short: "Discovery" },
  { id: "UserPreferenceAgent", short: "Preference" },
  { id: "ContextGroundingAgent", short: "Grounding" },
  { id: "PlanSolverAgent", short: "Solver" },
  { id: "PlanEvaluatorAgent", short: "Evaluator" },
  { id: "PlanExplanationAgent", short: "Explanation" },
];

type StepStatus = "completed" | "running" | "pending" | "failed";

function getAgentStatus(agentId: string, activeStep: string | null, events: { agent?: string; type: string }[]): StepStatus {
  if (!events.length && !activeStep) return "pending";

  const agentEvents = events.filter((e) => e.agent === agentId);
  const hasCompleted = agentEvents.some((e) =>
    ["run_completed", "handoff", "route_scored", "route_candidate_generated", "chat_answered", "requirements_summarized", "constraint_checked"].includes(e.type)
  );
  const hasStarted = agentEvents.some((e) => ["agent_started", "tool_called"].includes(e.type));

  if (hasCompleted) return "completed";
  if (activeStep === agentId || hasStarted) return "running";

  const activeIndex = agentSteps.findIndex((n) => n.id === activeStep);
  const nodeIndex = agentSteps.findIndex((n) => n.id === agentId);
  if (activeIndex >= 0 && nodeIndex < activeIndex) return "completed";

  return "pending";
}

function getTotalElapsedMs(events: { duration_ms?: number; durationMs?: number }[]): number {
  return events.reduce((sum, e) => sum + (e.duration_ms ?? e.durationMs ?? 0), 0);
}

type ProviderJump = {
  subTab: "summary" | "candidates" | "ranking" | "map" | "json";
  label: string;
  hint: string;
  Icon: typeof MapIcon;
};

// 把每个 Provider 映射到工作台下方最相关的子标签
function getProviderJump(providerName: string): ProviderJump | null {
  switch (providerName) {
    case "amap":
      return { subTab: "map", label: "查看地图距离", hint: "→ 跳到地图距离", Icon: MapIcon };
    case "caiyun":
      return { subTab: "summary", label: "查看天气约束", hint: "→ 跳到约束摘要", Icon: CloudSun };
    case "longcat":
      return { subTab: "summary", label: "查看 LLM 调用", hint: "→ 跳到约束摘要", Icon: Users2 };
    default:
      return null;
  }
}

export function AgentStatusBar() {
  const {
    activeTrace,
    activeAgentStep,
    providerStatuses,
    setProviderStatuses,
    setSelectedTraceEventId,
    selectedAgentStep,
    setSelectedAgentStep,
    setActiveDebugTab,
    setActiveDebugSubTab,
    mobileView
  } = useDemoStore();
  const events = activeTrace?.events ?? [];
  const totalMs = getTotalElapsedMs(events);
  const totalSec = (totalMs / 1000).toFixed(1);
  const budgetSec = 10;
  const ratio = Math.min(totalMs / (budgetSec * 1000), 1);

  // Provider 灯下拉展开状态（用 createPortal 渲染到 body，避免被 overflow-x:auto 顺带裁切 overflow-y）
  const [openProvider, setOpenProvider] = useState<{ name: string; rect: DOMRect } | null>(null);
  const [mounted, setMounted] = useState(false);
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // 从后端 /providers/status 获取真实 provider 状态
  const fetchProviderStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/providers/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.providers) {
        setProviderStatuses(mapApiToProviderStatus(data.providers));
      }
    } catch {
      // API 不可用时保留 store 默认值
    }
  }, [setProviderStatuses]);

  useEffect(() => {
    setMounted(true);
    fetchProviderStatus();
    // 每 30s 刷新一次 provider 状态
    const interval = setInterval(fetchProviderStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchProviderStatus]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inBar = dropdownContainerRef.current?.contains(target) ?? false;
      const inPortal = portalRef.current?.contains(target) ?? false;
      if (!inBar && !inPortal) {
        setOpenProvider(null);
      }
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenProvider(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  function handleProviderClick(p: ProviderStatus) {
    if (openProvider?.name === p.name) {
      setOpenProvider(null);
    } else {
      const button = buttonRefs.current[p.name];
      if (button) {
        setOpenProvider({ name: p.name, rect: button.getBoundingClientRect() });
      }
    }
  }

  function handleProviderJump(p: ProviderStatus) {
    const target = getProviderJump(p.name);
    if (!target) return;
    setActiveDebugTab("trace");
    setActiveDebugSubTab(target.subTab);
    setOpenProvider(null);
    // 关闭任何正在播放的 trace 选中态，让用户能直接看到对应子标签
    if (target.subTab === "map") {
      requestAnimationFrame(() => {
        document.getElementById("debug-map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function handleAgentClick(agentId: string) {
    setSelectedAgentStep(agentId);
    const event = events.find((e) => e.agent === agentId);
    setSelectedTraceEventId(event?.id);
    setActiveDebugTab("trace");
    requestAnimationFrame(() => {
      document.getElementById(`debug-agent-${agentId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  return (
    <div className="relative z-50 flex h-11 items-center gap-4 overflow-x-auto border-b border-dz-line bg-white/60 pl-0 pr-4 text-xs [scrollbar-width:thin]">
      {/* AI 工作台 标题 - 固定不滚动，向左溢出覆盖外层左 padding */}
      <div className="sticky left-0 z-10 -ml-2 flex shrink-0 self-stretch items-center gap-4 bg-white/80 pl-5 pr-3 shadow-[2px_0_6px_-1px_rgba(0,0,0,0.12)] backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-dz-orange" />
          <span className="text-xs font-black text-dz-ink">AI 工作台</span>
        </div>
        <div className="h-4 w-px bg-neutral-200" />
      </div>

      {/* Agent 进度 */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* API 请求期间（activeTrace 为 undefined 且正在运行）：展示 loading 态 */}
        {!activeTrace && mobileView === "running" ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            正在调用后端…
          </span>
        ) : (
        agentSteps.map((step, i) => {
          const status = getAgentStatus(step.id, activeAgentStep, events);
          return (
            <button
              key={step.id}
              onClick={() => handleAgentClick(step.id)}
              className="flex items-center gap-1 transition-colors"
              title={step.id}
            >
              {i > 0 && <span className="text-neutral-300">›</span>}
              <span
                className={`
                  inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium transition-all
                  ${status === "running"
                    ? "bg-blue-100 text-blue-700"
                    : status === "completed"
                      ? "bg-green-100 text-green-700"
                      : selectedAgentStep === step.id
                        ? "bg-dz-soft text-dz-orange ring-1 ring-dz-orange/40"
                      : "bg-neutral-100 text-neutral-400"
                  }
                `}
              >
                <span
                  className={`
                    inline-block h-1.5 w-1.5 rounded-full
                    ${status === "running" ? "animate-pulse bg-blue-500" : status === "completed" ? "bg-green-500" : "bg-neutral-300"}
                  `}
                />
                {step.short}
              </span>
            </button>
          );
        })
        )}
      </div>

      {/* 分隔线 */}
      <div className="h-4 w-px shrink-0 bg-neutral-200" />

      {/* Provider 状态灯 - 点击展开下拉，跳转工作台下方对应子标签 */}
      <div className="flex shrink-0 items-center gap-2" ref={dropdownContainerRef}>
        {providerStatuses.map((p) => {
          const jump = getProviderJump(p.name);
          const isOpen = openProvider?.name === p.name;
          const statusText = p.status === "connected" ? "已接入" : p.status === "mock" ? "Mock降级" : "超时";
          return (
            <div key={p.name} className="relative">
              <button
                ref={(el) => {
                  buttonRefs.current[p.name] = el;
                }}
                onClick={() => handleProviderClick(p)}
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors ${
                  isOpen ? "bg-dz-soft" : "hover:bg-neutral-100"
                }`}
                title={`${p.label}：${statusText}（点击展开）`}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    p.status === "connected" ? "bg-green-500" : p.status === "mock" ? "bg-yellow-500" : "bg-red-500"
                  }`}
                />
                <span className="text-[11px] font-medium text-neutral-700">{p.shortLabel}</span>
                <ChevronDown className={`h-3 w-3 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && jump && openProvider && mounted && createPortal(
                <div
                  ref={portalRef}
                  style={{
                    position: "fixed",
                    top: openProvider.rect.bottom + 4,
                    left: openProvider.rect.left,
                    zIndex: 9999
                  }}
                  className="w-44 overflow-hidden rounded-md border border-dz-line bg-white shadow-lg"
                >
                  <div className="border-b border-dz-line/60 bg-dz-soft/50 px-2 py-1.5 text-[10px] font-bold text-neutral-500">
                    {p.label} · {statusText}
                  </div>
                  <button
                    onClick={() => handleProviderJump(p)}
                    className="flex w-full items-start gap-2 px-2 py-1.5 text-left text-xs transition-colors hover:bg-dz-soft"
                  >
                    <jump.Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dz-orange" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-dz-ink">{jump.label}</span>
                      <span className="block text-[10px] text-neutral-500">{jump.hint}</span>
                    </span>
                  </button>
                </div>,
                document.body
              )}
            </div>
          );
        })}
      </div>

      {/* 分隔线 */}
      <div className="h-4 w-px shrink-0 bg-neutral-200" />

      {/* 耗时 */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              ratio < 0.7 ? "bg-green-500" : ratio < 0.9 ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <span className="font-mono text-[11px] text-neutral-500">
          {events.length ? `${totalSec}s` : "—"}<span className="text-neutral-300">/{budgetSec}s</span>
        </span>
      </div>
    </div>
  );
}
