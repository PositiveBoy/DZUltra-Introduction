"use client";

import {
  Activity,
  AlertTriangle,
  Braces,
  CheckCircle2,
  CircleDot,
  Clock3,
  Database,
  GitBranch,
  History,
  Layers3,
  MapPin,
  PackageSearch,
  Plus,
  Route,
  ShieldCheck,
  Sparkles,
  Shuffle,
  Timer,
  UserPlus,
  Wrench,
  XCircle,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { demoRoutePlans, generateMockPois, generateMockUser, getTrace, listTraces } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDemoStore } from "@/stores/use-demo-store";
import type {
  AgentStrategy,
  AgentTrace,
  DemoRoutePlan,
  GeneratedMockResponse,
  GenerateMockPoisRequest,
  GenerateMockUserRequest,
  LlmRequestInfo,
  LlmResponseInfo,
  MobileShellView,
  MockLocation,
  MockPoi,
  MockUserFull,
  TraceEvent,
  TraceEventMetadata,
  TraceSummary
} from "@/types/dzultra";
import { SvgRouteMap } from "./svg-route-map";

type DebugView = "trace" | "history" | "mock";

type CandidateItem = {
  id: string;
  name: string;
  meta: string;
  reason: string;
  status: "accepted" | "rejected";
};

type ConstraintItem = {
  name: string;
  status: "pass" | "warning" | "fail";
  detail: string;
};

type PlanScoreSnapshot = {
  planId: string;
  title: string;
  score: number;
  rankReason: string;
  breakdown: Record<string, number>;
};

type RejectedRouteSnapshot = {
  routeId: string;
  reason: string;
  score: number;
};

type MapLegSnapshot = {
  origin: string;
  destination: string;
  distanceMeters?: number;
  durationMinutes?: number;
  mode?: string;
};

type MapSnapshot = {
  provider: string;
  previewType: string;
  fallbackUsed: boolean;
  coordinateConfidence: string;
  totalDistanceMeters?: number;
  totalDurationMinutes?: number;
  legs: MapLegSnapshot[];
  note: string;
};

type AgentEventGroup = {
  id: string;
  label: string;
  agentName?: string;
  strategy?: AgentStrategy;
  events: TraceEvent[];
  eventCount: number;
  toolCount: number;
  fallbackCount: number;
  durationMs: number;
};

const debugTabs: Array<{ id: DebugView; label: string; icon: LucideIcon }> = [
  { id: "trace", label: "Debug Trace", icon: Activity },
  { id: "history", label: "History", icon: History },
  { id: "mock", label: "AI Mock 生成器", icon: Database }
];

export function DebugTracePanel() {
  const [traceHistory, setTraceHistory] = useState<TraceSummary[]>([]);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "error">("idle");

  // 用户手动选择 subTab 的标记：为 true 时，pickSubTabForMobileView 不再自动切换，
  // 除非 mobileView 发生重大变化（如从 running 切到 plans）
  const userManuallySelectedSubTab = useRef(false);
  // 记录上一次的 mobileView，用于判断是否发生了重大变化
  const prevMobileView = useRef<string | null>(null);

  const selectedTraceEventId = useDemoStore((state) => state.selectedTraceEventId);
  const setSelectedTraceEventId = useDemoStore((state) => state.setSelectedTraceEventId);
  const activeTrace = useDemoStore((state) => state.activeTrace);
  const setActiveTrace = useDemoStore((state) => state.setActiveTrace);
  const currentRoutePlans = useDemoStore((state) => state.currentRoutePlans);
  const selectedPlanId = useDemoStore((state) => state.selectedPlanId);
  const mobileView = useDemoStore((state) => state.mobileView);
  const setMobileView = useDemoStore((state) => state.setMobileView);
  const userPreferences = useDemoStore((state) => state.userPreferences);
  const startNewTraceRun = useDemoStore((state) => state.startNewTraceRun);
  const applyGeneratedUser = useDemoStore((state) => state.applyGeneratedUser);
  const setActiveUserId = useDemoStore((state) => state.setActiveUserId);
  const setGeneratedMockUsers = useDemoStore((state) => state.setGeneratedMockUsers);
  const applyGeneratedPoi = useDemoStore((state) => state.applyGeneratedPoi);
  const setGeneratedMockPois = useDemoStore((state) => state.setGeneratedMockPois);
  const applyMockLocation = useDemoStore((state) => state.applyMockLocation);
  const setGeneratedMockLocations = useDemoStore((state) => state.setGeneratedMockLocations);
  const generatedMockLocations = useDemoStore((state) => state.generatedMockLocations);
  const debugView = useDemoStore((state) => state.activeDebugTab);
  const setDebugView = useDemoStore((state) => state.setActiveDebugTab);
  const traceDetailMode = useDemoStore((state) => state.activeDebugSubTab);
  const setTraceDetailMode = useDemoStore((state) => state.setActiveDebugSubTab);
  const activeAgentStep = useDemoStore((state) => state.activeAgentStep);
  const selectedAgentStep = useDemoStore((state) => state.selectedAgentStep);
  const setSelectedAgentStep = useDemoStore((state) => state.setSelectedAgentStep);
  const setUserManuallySelectedAgent = useDemoStore((state) => state.setUserManuallySelectedAgent);
  const setCurrentRoutePlans = useDemoStore((state) => state.setCurrentRoutePlans);
  const startMockHistoryReplay = useDemoStore((state) => state.startMockHistoryReplay);

  const hasActiveRun = !!activeTrace && (activeTrace.status === "ready" || activeTrace.status === "running" || !!activeTrace.events.length);
  const visibleEvents = useMemo(() => (hasActiveRun ? activeTrace!.events : []), [activeTrace, hasActiveRun]);
  const agentGroups = useMemo(() => buildAgentGroups(visibleEvents, activeTrace?.agent_strategy), [visibleEvents, activeTrace?.agent_strategy]);
  const selected = (() => {
    if (selectedTraceEventId) {
      return visibleEvents.find((event) => event.id === selectedTraceEventId);
    }
    if (selectedAgentStep) {
      // 从 selectedGroup 中找第一个 event
      const group = agentGroups.find((g) => g.agentName === selectedAgentStep);
      const firstEvent = group?.events[0];
      if (firstEvent) return firstEvent;
      // group 存在但 events 为空，返回 undefined 让 SummaryView 显示策略信息
      return undefined;
    }
    return visibleEvents[0];
  })();
  const plans = currentRoutePlans;
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const isChatRun = visibleEvents.some((event) => event.type === "chat_answered") && !visibleEvents.some((event) => event.type === "route_candidate_generated");

  const costSummary = useMemo(() => summarizeTraceCost(visibleEvents), [visibleEvents]);
  const candidateSnapshot = useMemo(() => buildCandidateSnapshot(visibleEvents, plans), [visibleEvents, plans]);

  // 计算当前选中 Agent 所属的 group，用于按 Agent 过滤子 Tab
  const selectedGroup =
    agentGroups.find((group) => group.events.some((event) => event.id === selected?.id)) ??
    agentGroups.find((group) => group.agentName === selectedAgentStep);
  const currentAgentName = selectedGroup?.agentName ?? selectedAgentStep ?? undefined;

  const agentCostSummary = useMemo(() => (selectedGroup ? summarizeTraceCost(selectedGroup.events) : null), [selectedGroup]);
  const isAgentLevel = !!currentAgentName;
  const constraints = useMemo(() => buildConstraintSnapshot(visibleEvents, selectedPlan), [visibleEvents, selectedPlan]);
  const planScores = useMemo(() => buildPlanScores(visibleEvents, plans), [visibleEvents, plans]);
  const rejectedRoutes = useMemo(() => buildRejectedRoutes(visibleEvents), [visibleEvents]);
  const mapSnapshot = useMemo(() => buildMapSnapshot(visibleEvents, selectedPlan), [visibleEvents, selectedPlan]);
  const selectedCost = selected ? eventCostDetail(selected) : null;
  const totalDuration = activeTrace?.total_duration_ms ?? visibleEvents.reduce((sum, event) => sum + eventDuration(event), 0);
  const toolEvents = visibleEvents.filter((event) => event.tool_name);
  const handoffEvents = visibleEvents.filter((event) => event.type === "handoff" || event.handoff_from || event.handoff_to);
  const jsonPayload = activeTrace ?? null;

  // 根据当前 Agent 和 isChatRun 计算相关子 Tab
  const relevantSubTabs = useMemo(
    () => getRelevantSubTabs(currentAgentName, isChatRun),
    [currentAgentName, isChatRun]
  );

  // 当当前子标签不在相关列表中时，自动切换到摘要
  useEffect(() => {
    if (relevantSubTabs.length > 0 && !relevantSubTabs.includes(traceDetailMode)) {
      setTraceDetailMode("summary");
    }
  }, [relevantSubTabs, traceDetailMode, setTraceDetailMode]);

  useEffect(() => {
    if (debugView !== "history") {
      return;
    }

    let cancelled = false;
    setHistoryStatus("loading");
    listTraces()
      .then((items) => {
        if (cancelled) {
          return;
        }
        setTraceHistory(items);
        setHistoryStatus("idle");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setTraceHistory([]);
        setHistoryStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [debugView]);

  // 根据 mobileView 自动联动：选中最贴近当前环节的事件 + 切到最相关的子 Tab
  // 当用户手动选择过 subTab 后，不再自动切换，除非 mobileView 发生重大变化（如 running → plans）
  useEffect(() => {
    if (!hasActiveRun) {
      return;
    }

    // 判断 mobileView 是否发生了重大变化
    const isMajorChange = prevMobileView.current !== null && prevMobileView.current !== mobileView;
    // 从非 plans 切到 plans 是重大变化，需要重置手动选择标记
    if (isMajorChange && mobileView === "plans") {
      userManuallySelectedSubTab.current = false;
    }
    prevMobileView.current = mobileView;

    const target = pickEventForMobileView(visibleEvents, mobileView);
    if (target && target.id !== selectedTraceEventId) {
      setSelectedTraceEventId(target.id);
    }

    // 只有用户没有手动选择过 subTab 时，才自动联动
    if (!userManuallySelectedSubTab.current) {
      const targetTab = pickSubTabForMobileView(mobileView);
      if (targetTab) {
        setTraceDetailMode(targetTab);
      }
    }
  }, [mobileView, hasActiveRun, visibleEvents, selectedTraceEventId, setSelectedTraceEventId, setTraceDetailMode, isChatRun]);

  // startNewTraceRun 时重置手动选择标记（activeTrace 被清空意味着新 run 开始）
  useEffect(() => {
    if (!activeTrace) {
      userManuallySelectedSubTab.current = false;
      prevMobileView.current = null;
    }
  }, [activeTrace]);

  async function openTrace(traceId: string) {
    try {
      const trace = await getTrace(traceId);
      setActiveTrace(trace);
      setSelectedTraceEventId(trace.events[0]?.id);
      setSelectedAgentStep(trace.events[0]?.agent ?? trace.agent_strategy?.[0]?.name ?? null);
      setDebugView("trace");
      startMockHistoryReplay(trace);
    } catch {
      setHistoryStatus("error");
    }
  }

  async function quickGenerateUser(userType: "new" | "regular") {
    // 1. 生成位置
    const location = randomChinaMockLocation();
    applyMockLocation(location);
    setGeneratedMockLocations([location, ...generatedMockLocations].slice(0, 5));

    // 2. 生成用户
    await generateAndApplyMockUser({
      userType,
      city: location.city,
      area: location.area ?? "三里屯",
      scenario: userType === "new" ? "新用户首次使用点仔 Ultra" : "一键生成点仔 Ultra 演示用户",
      currentLocation: location,
      setGeneratedMockUsers,
      applyGeneratedUser,
      setActiveUserId,
    });

    // 3. 生成 POI
    const poiResult = await generateMockPois({
      city: location.city,
      area: location.area ?? "三里屯",
      count: 30,
    });
    setGeneratedMockPois(poiResult.pois);
    poiResult.pois.forEach((poi) => applyGeneratedPoi(poi));

    setDebugView("mock");
  }

  return (
    <div className="flex h-full flex-col overflow-x-hidden">
      {/* Tab 栏 */}
      <div className="flex items-center gap-1 border-b border-dz-line bg-[#fbfaf7] px-4 pt-2">
        {debugTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDebugView(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-bold transition",
              debugView === tab.id ? "bg-white text-dz-orange shadow-sm" : "text-neutral-500 hover:text-dz-ink"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-hidden">
        {debugView === "trace" &&
          (hasActiveRun ? (
            <div className="flex h-full overflow-x-hidden">
              {/* 左侧 Agent 流程 */}
              <aside className="w-[300px] shrink-0 overflow-y-auto overflow-x-hidden border-r border-dz-line bg-[#fbfaf7] [scrollbar-width:thin]">
                <div className="border-b border-dz-line px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dz-orange">Agent Flow</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">按真实 Agent 边界聚合事件、tool use、handoff 和 fallback。</p>
                </div>
                <div className="space-y-2 p-2">
                  {agentGroups.map((group, groupIndex) => {
                    const selectedInGroup = group.events.some((event) => event.id === selected?.id) || group.agentName === selectedAgentStep;
                    const agentOrdinal = agentGroups.slice(0, groupIndex + 1).filter((item) => item.agentName).length;
                    const groupHasFallback = group.fallbackCount > 0;
                    const agentStatus = getAgentGroupStatus(group, activeAgentStep);
                    return (
                      <section
                        key={group.id}
                        id={group.agentName ? `debug-agent-${group.agentName}` : undefined}
                        className={cn(
                          "rounded-md border bg-white p-2 transition",
                          selectedInGroup ? "border-dz-orange shadow-sm" :
                          agentStatus === "running" ? "border-blue-400 shadow-sm" :
                          agentStatus === "failed" ? "border-red-400" :
                          agentStatus === "completed" ? "border-green-300" :
                          groupHasFallback ? "border-yellow-400" :
                          "border-dz-line",
                          agentStatus === "running" && "animate-[dz-agent-pulse_2s_ease-in-out_infinite]"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAgentStep(group.agentName ?? null);
                            setSelectedTraceEventId(group.events[0]?.id);
                            setUserManuallySelectedAgent(true);
                            // 联动跳转：mobileView 只在 trace 完成后切换，subTab 随时切换
                            const targetView = getMobileViewForAgent(group.agentName);
                            if (targetView && activeTrace?.status === "completed") {
                              setMobileView(targetView);
                            }
                            const targetSubTab = getSubTabForAgent(group.agentName);
                            // 检查目标 subTab 是否在当前 Agent 的相关列表中，不在则降级到 summary
                            const relevant = getRelevantSubTabs(group.agentName, isChatRun);
                            const finalSubTab = relevant.includes(targetSubTab) ? targetSubTab : "summary";
                            userManuallySelectedSubTab.current = true;
                            setTraceDetailMode(finalSubTab);
                          }}
                          className="flex w-full items-start gap-2 text-left"
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
                              selectedInGroup ? "bg-dz-orange text-white" :
                              agentStatus === "running" ? "bg-blue-500 text-white" :
                              agentStatus === "completed" ? "bg-green-500 text-white" :
                              agentStatus === "failed" ? "bg-red-500 text-white" :
                              "bg-neutral-200 text-neutral-400"
                            )}
                          >
                            {agentStatus === "completed" && !selectedInGroup ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : agentStatus === "failed" && !selectedInGroup ? (
                              <XCircle className="h-3.5 w-3.5" />
                            ) : agentStatus === "running" && !selectedInGroup ? (
                              <CircleDot className="h-3.5 w-3.5" />
                            ) : group.agentName ? (
                              agentOrdinal
                            ) : (
                              <Activity className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className={cn(
                                "truncate font-mono text-xs font-black",
                                agentStatus === "pending" && "text-neutral-400"
                              )}>{group.label}</h4>
                              <div className="flex shrink-0 items-center gap-1">
                                {groupHasFallback && (
                                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                )}
                                <span className="font-mono text-[10px] text-neutral-400">{group.durationMs}ms</span>
                              </div>
                            </div>
                            <p className={cn(
                              "mt-1 line-clamp-2 text-[11px] leading-4",
                              agentStatus === "pending" ? "text-neutral-300" : "text-neutral-500"
                            )}>
                              {group.strategy?.responsibility ?? "Run 生命周期事件，不属于单个业务 Agent。"}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className={cn(
                                "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                                agentStatus === "pending" ? "bg-neutral-100 text-neutral-300" : "bg-[#fbfaf7] text-neutral-500"
                              )}>
                                {group.eventCount} events
                              </span>
                              <span className={cn(
                                "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                                agentStatus === "pending" ? "bg-neutral-100 text-neutral-300" : "bg-[#fbfaf7] text-neutral-500"
                              )}>
                                {group.toolCount} tools
                              </span>
                              {group.fallbackCount ? (
                                <span className="rounded-full bg-yellow-50 px-1.5 py-0.5 text-[9px] font-bold text-yellow-700">
                                  {group.fallbackCount} fallback
                                </span>
                              ) : null}
                              {agentStatus !== "pending" && agentStatus !== "completed" && (
                                <span className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                                  agentStatus === "running" ? "bg-blue-50 text-blue-700" :
                                  agentStatus === "failed" ? "bg-red-50 text-red-700" : ""
                                )}>
                                  {agentStatus}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        <div className="mt-2 space-y-1 border-t border-dz-line pt-2">
                          {group.events.map((event) => {
                            const completed = isEventCompleted(event);
                            return (
                              <button
                                key={event.id}
                                onClick={() => {
                                  setSelectedTraceEventId(event.id);
                                  setSelectedAgentStep(event.agent ?? group.agentName ?? null);
                                  setUserManuallySelectedAgent(true);
                                }}
                                className={cn(
                                  "w-full rounded-md px-2 py-1.5 text-left transition",
                                  selected?.id === event.id ? "bg-dz-soft text-dz-ink" : "hover:bg-[#fff7ed]"
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate text-[11px] font-bold">{event.label}</span>
                                  <span className="shrink-0 font-mono text-[9px] text-neutral-400">{eventDuration(event)}ms</span>
                                </div>
                                <div className="mt-1 flex items-center gap-1">
                                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", eventTypeClass(event.type))}>
                                    {event.type}
                                  </span>
                                  {event.tool_name ? (
                                    <span className="truncate rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-neutral-500">
                                      {event.tool_name}
                                    </span>
                                  ) : null}
                                  {event.fallback_used ? (
                                    <span className="rounded-full bg-yellow-50 px-1.5 py-0.5 text-[9px] font-bold text-yellow-700">
                                      fallback
                                    </span>
                                  ) : completed ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}
                          {!group.events.length ? (
                            <div className="rounded-md border border-dashed border-neutral-200 bg-[#fffdf8] px-2 py-2 text-[11px] leading-4 text-neutral-400">
                              等待真实 run 数据。用户输入后，这里会出现该 Agent 的事件、tool 调用和 fallback 记录。
                            </div>
                          ) : null}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </aside>

              {/* 右侧详情区 */}
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5 [scrollbar-width:thin]">
                {/* 详情子 Tab — 只渲染当前 Agent 相关的子 Tab */}
                <div className="mb-4 flex items-center gap-1 rounded-md bg-[#fbfaf7] p-1">
                  {([
                    { id: "summary" as const, label: "摘要", icon: Activity },
                    { id: "candidates" as const, label: "候选池", icon: PackageSearch },
                    { id: "ranking" as const, label: "排序", icon: Layers3 },
                    { id: "map" as const, label: "地图", icon: MapPin },
                    { id: "json" as const, label: "JSON", icon: Braces },
                  ] as const).filter((sub) => relevantSubTabs.includes(sub.id)).map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => { userManuallySelectedSubTab.current = true; setTraceDetailMode(sub.id); }}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition",
                        traceDetailMode === sub.id ? "bg-white text-dz-orange shadow-sm" : "text-neutral-500 hover:text-dz-ink"
                      )}
                    >
                      <sub.icon className="h-3 w-3" />
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* 运行信息头 */}
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dz-orange">Agent Run</p>
                    <h3 className="mt-0.5 truncate text-lg font-bold">{activeTrace?.user_goal ?? "低排队约会路线生成"}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-neutral-500">
                      <span className="rounded-full bg-[#fbfaf7] px-2 py-0.5">trace: {activeTrace?.id ?? "unknown"}</span>
                      <span className="rounded-full bg-[#fbfaf7] px-2 py-0.5">runner: {activeTrace?.runner_mode ?? "real_agent_ai_generated_data"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-dz-soft px-2.5 py-1.5 text-xs font-semibold">
                    {activeTrace?.status === "running" ? (
                      <CircleDot className="h-3.5 w-3.5 animate-pulse text-blue-500" />
                    ) : activeTrace?.status === "ready" ? (
                      <CircleDot className="h-3.5 w-3.5 text-neutral-400" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    )}
                    {activeTrace?.status ?? "completed"}
                  </div>
                </div>

                {/* 指标卡片 — 按 Agent 上下文切换 */}
                {isAgentLevel ? (
                  <div className="mb-4 grid grid-cols-4 gap-2">
                    <MetricCard icon={Timer} label="Agent 耗时" value={`${selectedGroup?.durationMs ?? 0}ms`} caption={`${selectedGroup?.eventCount ?? 0} events`} />
                    <MetricCard icon={Wrench} label="Tool 调用" value={String(selectedGroup?.toolCount ?? 0)} caption={currentAgentName ?? ""} />
                    <MetricCard icon={Braces} label="Token 用量" value={String(agentCostSummary?.totalTokens ?? 0)} caption={`in ${agentCostSummary?.totalInputTokens ?? 0} / out ${agentCostSummary?.totalOutputTokens ?? 0}`} />
                    <MetricCard icon={ShieldCheck} label="Fallback" value={String(selectedGroup?.fallbackCount ?? 0)} caption={selectedGroup?.fallbackCount ? "存在 provider 降级" : "无 fallback"} />
                  </div>
                ) : (
                  <div className="mb-4 grid grid-cols-4 gap-2">
                    <MetricCard icon={Timer} label="总耗时" value={`${totalDuration}ms`} caption="按 Trace duration 累计" />
                    <MetricCard icon={Wrench} label="Tool 调用" value={String(toolEvents.length)} caption={`${handoffEvents.length} 次 handoff`} />
                    <MetricCard icon={Route} label="方案数" value={isChatRun ? "0" : String(plans.length)} caption={isChatRun ? "普通问答链路" : "当前展示 3 套"} />
                    <MetricCard icon={MapPin} label="地图 Provider" value={mapSnapshot.provider} caption={mapSnapshot.coordinateConfidence} />
                  </div>
                )}

                {traceDetailMode === "summary" && (
                  <SummaryView
                    selected={selected}
                    selectedCost={selectedCost}
                    costSummary={costSummary}
                    events={visibleEvents}
                    selectedTraceEventId={selected?.id}
                    toolEvents={toolEvents}
                    handoffEvents={handoffEvents}
                    agentStrategy={activeTrace?.agent_strategy}
                    agentGroup={selectedGroup}
                    traceStatus={activeTrace?.status}
                  />
                )}

                {traceDetailMode === "candidates" && (
                  <CandidatePoolView snapshot={candidateSnapshot} constraints={constraints} selectedEvent={selected} isChatRun={isChatRun} />
                )}

                {traceDetailMode === "ranking" && (
                  <PlanRankingView scores={planScores} rejectedRoutes={rejectedRoutes} selectedPlanId={selectedPlanId} constraints={constraints} isChatRun={isChatRun} />
                )}

                {traceDetailMode === "map" && <div id="debug-map-section"><MapProviderView snapshot={mapSnapshot} selectedPlan={selectedPlan} /></div>}

                {traceDetailMode === "json" && <TraceJsonView payload={jsonPayload} />}
              </div>
            </div>
          ) : (
            <TraceEmptyState
              onNewRun={startNewTraceRun}
              onOpenHistory={() => setDebugView("history")}
              onOpenMock={() => setDebugView("mock")}
              onQuickGenerateUser={quickGenerateUser}
            />
          ))}

        {debugView === "history" && (
          <div className="h-full overflow-y-auto overflow-x-hidden p-5 [scrollbar-width:thin]">
            <TraceHistoryView
              traces={traceHistory}
              status={historyStatus}
              activeTraceId={activeTrace?.id}
              onOpenTrace={openTrace}
              onOpenMockTrace={(trace) => {
                setActiveTrace(trace);
                setSelectedTraceEventId(trace.events[0]?.id);
                setSelectedAgentStep(trace.events[0]?.agent ?? trace.agent_strategy?.[0]?.name ?? null);
                setDebugView("trace");
                startMockHistoryReplay(trace);
              }}
              onNewDemo={() => {
                startNewTraceRun();
                setDebugView("trace");
              }}
            />
          </div>
        )}

        {debugView === "mock" && (
          <div className="h-full overflow-y-auto overflow-x-hidden p-5 [scrollbar-width:thin]">
            <MockDataView
              preferences={userPreferences}
              plans={plans}
              activeTrace={activeTrace}
              hasActiveRun={hasActiveRun}
              mapSnapshot={mapSnapshot}
              isChatRun={isChatRun}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryView({
  selected,
  selectedCost,
  costSummary,
  events,
  selectedTraceEventId,
  toolEvents,
  handoffEvents,
  agentStrategy,
  agentGroup,
  traceStatus
}: {
  selected?: TraceEvent;
  selectedCost: ReturnType<typeof eventCostDetail>;
  costSummary: ReturnType<typeof summarizeTraceCost>;
  events: TraceEvent[];
  selectedTraceEventId?: string;
  toolEvents: TraceEvent[];
  handoffEvents: TraceEvent[];
  agentStrategy?: AgentStrategy[];
  agentGroup?: AgentEventGroup;
  traceStatus?: string;
}) {
  if (!selected) {
    if (agentGroup?.agentName) {
      // 有 agentName 但无 events：显示策略信息而非 Skeleton
      if (agentGroup.events.length === 0 && agentGroup.strategy) {
        return (
          <section className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dz-orange">Agent 等待执行</p>
                <h4 className="mt-1 font-mono text-sm font-black">{agentGroup.agentName}</h4>
                <p className="mt-2 text-xs leading-5 text-neutral-600">
                  {agentGroup.strategy.responsibility ?? "等待真实 Agent 事件。"}
                </p>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-neutral-400">0 events</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-md bg-white p-3">
                <div className="font-bold text-neutral-500">输入</div>
                <div className="mt-1 leading-5 text-neutral-700">{agentGroup.strategy.inputs.join("、") || "等待用户输入"}</div>
              </div>
              <div className="rounded-md bg-white p-3">
                <div className="font-bold text-neutral-500">输出</div>
                <div className="mt-1 leading-5 text-neutral-700">{agentGroup.strategy.outputs.join("、") || "等待 Agent 输出"}</div>
              </div>
              <div className="rounded-md bg-white p-3">
                <div className="font-bold text-neutral-500">Fallback</div>
                <div className="mt-1 leading-5 text-neutral-700">{agentGroup.strategy.failure_fallback || "真实运行后展示降级原因"}</div>
              </div>
            </div>
          </section>
        );
      }
      return <SkeletonAgentSummary group={agentGroup} />;
    }
    return (
      <section className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
        <h4 className="text-sm font-black">
          {traceStatus === "running" ? "正在等待后端 Agent 响应…" : "等待真实 run 数据"}
        </h4>
        <p className="mt-2 text-xs leading-5 text-neutral-500">
          {traceStatus === "running"
            ? "用户已提交请求，后端 Agent 正在处理。事件、tool 调用和 provider 记录会逐步出现在这里。"
            : "新演示已经创建 Agent 框架；用户在左侧输入后，这里会替换为真实事件、tool 调用、provider 和 fallback 记录。"}
        </p>
      </section>
    );
  }

  const agentName = agentGroup?.agentName;
  const hasAgentSpecificView = agentName && agentName !== "system";

  return (
    <>
      {/* Fallback 警告横幅 */}
      {(selected.fallback_used === true || Boolean(selected.metadata?.fallback_reason) || Boolean(selected.metadata?.fallback_provider)) && (
        <section className="mb-4 rounded-md border-2 border-yellow-400 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
            <div>
              <h4 className="text-sm font-black text-yellow-800">Fallback 已触发</h4>
              <p className="mt-1 text-xs leading-5 text-yellow-700">
                {selected.metadata?.fallback_reason
                  ? String(selected.metadata.fallback_reason)
                  : "本步骤使用了 provider 兜底逻辑；只有 fallback 数据需要单独看原因。"}
              </p>
              {selected.metadata?.fallback_provider ? (
                <p className="mt-1 text-xs font-mono text-yellow-700">
                  fallback_provider: {String(selected.metadata.fallback_provider)}
                </p>
              ) : null}
              {(selected.metadata?.http_status_code != null) && (
                <p className="mt-1 text-xs font-mono text-yellow-700">
                  HTTP {selected.metadata.http_status_code}
                </p>
              )}
              {selected.metadata?.request_duration_ms != null && (
                <p className="mt-1 text-xs font-mono text-yellow-700">
                  耗时 {selected.metadata.request_duration_ms}ms
                </p>
              )}
              {selected.metadata?.http_response_body && (
                <p className="mt-1 text-xs font-mono text-yellow-700">
                  响应体: {String(selected.metadata.http_response_body).length > 200 ? String(selected.metadata.http_response_body).slice(0, 200) + "…" : String(selected.metadata.http_response_body)}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Agent 差异化摘要 or 通用模板 */}
      {hasAgentSpecificView ? (
        <AgentSummaryView agentName={agentName!} group={agentGroup!} selected={selected} selectedCost={selectedCost} />
      ) : (
        <GenericSummarySection selected={selected} selectedCost={selectedCost} />
      )}

      {/* Tool Call 详情展开 */}
      {selected.tool_name && (
        <section className="mt-5 rounded-md border border-dz-line bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-dz-orange" />
            <h4 className="text-sm font-black">Tool Call 详情</h4>
            {selected.fallback_used && (
              <span className="rounded-full border border-yellow-400 bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                fallback
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Tool 名称" value={selected.tool_name} mono />
            {selected.tool_output?.provider ? <Field label="Provider" value={String(selected.tool_output.provider)} mono /> : null}
            {selected.metadata?.tool_duration_ms ? <Field label="Tool 耗时" value={`${selected.metadata.tool_duration_ms}ms`} mono /> : null}
          </div>
          {selected.tool_input && Object.keys(selected.tool_input).length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-bold text-neutral-500">输入参数</h5>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-[#f8f6f0] p-3 text-[11px] leading-5 text-neutral-700 [scrollbar-width:thin]">
                {JSON.stringify(selected.tool_input, null, 2)}
              </pre>
            </div>
          )}
          {selected.tool_output && Object.keys(selected.tool_output).length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-bold text-neutral-500">输出摘要</h5>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-[#f8f6f0] p-3 text-[11px] leading-5 text-neutral-700 [scrollbar-width:thin]">
                {JSON.stringify(selected.tool_output, null, 2)}
              </pre>
            </div>
          )}
        </section>
      )}

      {/* LLM 请求/响应详情 */}
      {selected.metadata?.llm_request && (
        <LlmCallDetail
          llmRequest={selected.metadata.llm_request}
          llmResponse={selected.metadata.llm_response}
          metadata={selected.metadata}
        />
      )}

      {/* LLM Streaming 输出 */}
      {selected.metadata?.streaming_tokens && (
        <LlmStreamingPanel streamingTokens={String(selected.metadata.streaming_tokens)} />
      )}

      {/* Observations */}
      {extractObservations(selected).length > 0 && (
        <section className="mt-5 rounded-md border border-dz-line bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Route className="h-4 w-4 text-dz-orange" />
            <h4 className="text-sm font-black">Observations</h4>
          </div>
          <div className="space-y-2">
            {extractObservations(selected).map((obs, index) => (
              <div key={index} className="rounded-md bg-[#fffdf8] px-3 py-2 text-xs leading-5 text-neutral-700">
                {obs}
              </div>
            ))}
          </div>
        </section>
      )}

      <LatencyTimeline events={events} selectedTraceEventId={selectedTraceEventId} />

      <section className="mt-5 grid grid-cols-2 gap-4">
        <ToolList title="Tool 调用" icon={Wrench} events={toolEvents} emptyText="本轮没有 tool 调用事件。" />
        <ToolList title="Handoff" icon={GitBranch} events={handoffEvents} emptyText="本轮没有显式 handoff。" />
      </section>

      <section className="mt-5 rounded-md border border-dz-line bg-[#fffdf8] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-black">LLM 请求耗时与成本</h4>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              真实 LLM span 会展示模型名、token、耗时和成本；接口降级时继续展示可复现的 fallback 计量，方便评审对齐链路。
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-dz-orange">
            {costSummary.billableEventCount} calls
          </span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
          <MiniStat label="总 Token" value={String(costSummary.totalTokens)} sub={`in ${costSummary.totalInputTokens} / out ${costSummary.totalOutputTokens}`} />
          <MiniStat label="模型耗时" value={`${costSummary.totalModelDurationMs}ms`} />
          <MiniStat label="估算成本" value={formatCost(costSummary.totalCostCny)} />
          <MiniStat label="模型" value={costSummary.modelNames.length ? costSummary.modelNames.join(" / ") : "暂无计量"} />
        </div>
      </section>

      {agentStrategy?.length ? <AgentStrategySection strategies={agentStrategy} selectedAgent={selected.agent} /> : null}
    </>
  );
}

function SkeletonAgentSummary({ group }: { group: AgentEventGroup }) {
  return (
    <section className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dz-orange">Agent Skeleton</p>
          <h4 className="mt-1 font-mono text-sm font-black">{group.agentName}</h4>
          <p className="mt-2 text-xs leading-5 text-neutral-600">
            {group.strategy?.responsibility ?? "等待真实 Agent 事件。"}
          </p>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-neutral-400">0 events</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-md bg-white p-3">
          <div className="font-bold text-neutral-500">输入</div>
          <div className="mt-1 leading-5 text-neutral-700">{group.strategy?.inputs.join("、") || "等待用户输入"}</div>
        </div>
        <div className="rounded-md bg-white p-3">
          <div className="font-bold text-neutral-500">输出</div>
          <div className="mt-1 leading-5 text-neutral-700">{group.strategy?.outputs.join("、") || "等待 Agent 输出"}</div>
        </div>
        <div className="rounded-md bg-white p-3">
          <div className="font-bold text-neutral-500">Fallback</div>
          <div className="mt-1 leading-5 text-neutral-700">{group.strategy?.failure_fallback || "真实运行后展示降级原因"}</div>
        </div>
      </div>
    </section>
  );
}

/** 通用摘要区：当 agent 为空或未知时展示"输入/处理/输出"三栏 */
function GenericSummarySection({
  selected,
  selectedCost
}: {
  selected: TraceEvent;
  selectedCost: ReturnType<typeof eventCostDetail>;
}) {
  const detail = getTraceDetail(selected);

  return (
    <>
      <section className="rounded-md border border-dz-line p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-dz-orange" />
            <h4 className="font-black">{selected.label}</h4>
          </div>
          <span className="rounded-full bg-[#fbfaf7] px-2 py-1 font-mono text-[11px] font-bold text-neutral-500">
            {eventDuration(selected)}ms
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Field label="事件类型" value={selected.type} mono />
          <Field label="Agent" value={selected.agent ?? "system"} mono />
          <div className="col-span-2">
            <dt className="text-neutral-500">摘要</dt>
            <dd className="mt-1 leading-7">{selected.summary}</dd>
          </div>
          {selected.handoff_from && selected.handoff_to && (
            <Field label="Handoff" value={`${selected.handoff_from} -> ${selected.handoff_to}`} mono wide />
          )}
          {selectedCost && (
            <>
              <Field label="模型" value={selectedCost.modelName} mono />
              <Field label="Token" value={String(selectedCost.totalTokens)} mono />
              <Field label="模型耗时" value={`${selectedCost.modelDurationMs}ms`} mono />
              <Field label="估算成本" value={formatCost(selectedCost.estimatedCostCny)} mono />
            </>
          )}
        </dl>
      </section>

      <section className="mt-5 grid grid-cols-3 gap-3">
        {([
          ["输入", detail.input],
          ["处理摘要", detail.process],
          ["输出", detail.output]
        ] as const).map(([title, items]) => (
          <div key={title} className="rounded-md border border-dz-line bg-[#fffdf8] p-4">
            <h4 className="mb-3 text-sm font-black text-dz-orange">{title}</h4>
            <div className="space-y-2">
              {(items as string[]).map((item) => (
                <p key={item} className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-neutral-600">
                  {item}
                </p>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

// ─── Agent 差异化摘要 ───────────────────────────────────────────────

/** 从 Agent group 的所有 events 中查找第一个包含指定 key 的事件的 output/tool_output */
function findEventOutput(group: AgentEventGroup, key: string): Record<string, unknown> | undefined {
  for (const event of group.events) {
    const sources = [event.output, event.tool_output].filter(isRecord);
    for (const src of sources) {
      if (key in src) {
        return src;
      }
    }
  }
  return undefined;
}

/** 从 Agent group 的所有 events 中合并所有匹配 key 的数组 */
function collectArrayField(group: AgentEventGroup, key: string): unknown[] {
  const result: unknown[] = [];
  for (const event of group.events) {
    const sources = [event.output, event.tool_output, event.input, event.tool_input].filter(isRecord);
    for (const src of sources) {
      const value = src[key];
      if (Array.isArray(value)) {
        result.push(...value);
      }
    }
  }
  return result;
}

/** 安全取字符串，缺失时返回 fallback */
function strOr(value: unknown, fallback: string): string;
function strOr(value: unknown, fallback?: undefined): string | undefined;
function strOr(value: unknown, fallback: string | undefined): string | undefined;
function strOr(value: unknown, fallback?: string): string | undefined {
  return typeof value === "string" ? value : fallback;
}

/** Agent 摘要行：label + value，value 缺失时展示"未提供" */
function SummaryRow({ label, value, mono }: { label: string; value: string | undefined; mono?: boolean }) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className={cn("mt-1", mono && "font-mono")}>{value ?? "未提供"}</dd>
    </div>
  );
}

/** Agent 摘要标签 */
function SummaryTag({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "green" | "yellow" | "red" | "blue" }) {
  const cls: Record<string, string> = {
    default: "bg-[#f1eee7] text-neutral-600",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", cls[variant])}>{children}</span>;
}

/** Agent 摘要卡片 */
function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dz-line bg-[#fffdf8] p-4">
      <h5 className="mb-3 text-xs font-black text-dz-orange">{title}</h5>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/** Agent 摘要列表项 */
function SummaryListItem({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-neutral-700">
      <span className="font-bold">{label}</span>
      {detail && <span className="ml-1 text-neutral-500">{detail}</span>}
    </div>
  );
}

function AgentSummaryView({
  agentName,
  group,
  selected,
  selectedCost
}: {
  agentName: string;
  group: AgentEventGroup;
  selected: TraceEvent;
  selectedCost: ReturnType<typeof eventCostDetail>;
}) {
  return (
    <section className="rounded-md border border-dz-line p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-dz-orange" />
          <h4 className="font-black">{agentName}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#fbfaf7] px-2 py-1 font-mono text-[11px] font-bold text-neutral-500">
            {group.durationMs}ms
          </span>
          {selectedCost && (
            <span className="rounded-full bg-dz-soft px-2 py-1 font-mono text-[11px] font-bold text-dz-orange">
              {selectedCost.totalTokens} tokens
            </span>
          )}
        </div>
      </div>

      <p className="mb-4 text-xs leading-5 text-neutral-500">{selected.summary}</p>

      {renderAgentSpecificContent(agentName, group)}

      <AgentToolUseList group={group} />

      {/* Agent 级 LLM 信息 */}
      {selectedCost && (
        <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
          <MiniStat label="模型" value={selectedCost.modelName} />
          <MiniStat label="Token" value={String(selectedCost.totalTokens)} />
          <MiniStat label="模型耗时" value={`${selectedCost.modelDurationMs}ms`} />
          <MiniStat label="估算成本" value={formatCost(selectedCost.estimatedCostCny)} />
        </div>
      )}
    </section>
  );
}

function AgentToolUseList({ group }: { group: AgentEventGroup }) {
  const tools = group.events.filter((event) => event.tool_name);
  return (
    <section className="mt-4 rounded-md border border-dz-line bg-[#fffdf8] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-dz-orange" />
          <h5 className="text-sm font-black">ToolUse 调用</h5>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-500">{tools.length} tools</span>
      </div>
      {tools.length ? (
        <div className="space-y-2">
          {tools.map((event) => {
            const providerCall = isRecord(event.tool_output?.provider_call) ? event.tool_output.provider_call : undefined;
            const providerMetadata = isRecord(providerCall?.metadata) ? providerCall.metadata : undefined;
            const provider = strOr(event.tool_output?.provider, strOr(providerCall?.provider, strOr(event.tool_output?.provider_name, undefined)));
            const dataOrigin = strOr(event.tool_output?.data_origin, strOr(event.metadata?.data_origin, strOr(providerMetadata?.data_origin, undefined)));
            const reliability = strOr(event.tool_output?.reliability, strOr(providerCall?.reliability, undefined));
            const httpStatusCode = numberValue(event.tool_output?.http_status_code) ?? numberValue(event.metadata?.http_status_code) ?? numberValue(providerMetadata?.http_status_code);
            const requestDurationMs = numberValue(event.tool_output?.request_duration_ms) ?? numberValue(event.metadata?.request_duration_ms) ?? numberValue(providerMetadata?.request_duration_ms);
            const httpResponseBody = strOr(event.tool_output?.http_response_body, strOr(event.metadata?.http_response_body, strOr(providerMetadata?.http_response_body, undefined)));
            return (
              <details key={event.id} className="rounded-md border border-dz-line bg-white p-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs font-black text-dz-orange">{event.tool_name}</div>
                      <p className="mt-1 text-xs leading-5 text-neutral-600">{event.summary}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {provider ? <span className="rounded-full bg-[#fbfaf7] px-2 py-0.5 text-[10px] font-bold text-neutral-500">{provider}</span> : null}
                      {dataOrigin ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{dataOrigin}</span> : null}
                      {reliability ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">{reliability}</span> : null}
                      {event.fallback_used ? <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-700">fallback</span> : null}
                      {httpStatusCode != null ? <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", httpStatusCode >= 400 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700")}>HTTP {httpStatusCode}</span> : null}
                      {requestDurationMs != null ? <span className="rounded-full bg-[#fbfaf7] px-2 py-0.5 text-[10px] font-bold text-neutral-500">{requestDurationMs}ms</span> : null}
                    </div>
                  </div>
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <h6 className="text-[11px] font-bold text-neutral-500">tool_input</h6>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-[#171717] p-3 text-[11px] leading-5 text-[#d8f8d8]">
                      {JSON.stringify(event.tool_input ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h6 className="text-[11px] font-bold text-neutral-500">tool_output</h6>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-[#171717] p-3 text-[11px] leading-5 text-[#d8f8d8]">
                      {JSON.stringify(event.tool_output ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
                {httpResponseBody && (
                  <div className="mt-3">
                    <h6 className="text-[11px] font-bold text-red-500">错误响应体</h6>
                    <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-red-50 p-3 text-[11px] leading-5 text-red-700">
                      {String(httpResponseBody).length > 200 ? String(httpResponseBody).slice(0, 200) + "…" : String(httpResponseBody)}
                    </pre>
                  </div>
                )}
              </details>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-neutral-500">
          本 Agent 未调用 tool，只处理结构化状态或接收上游结果。
        </p>
      )}
    </section>
  );
}

function renderAgentSpecificContent(agentName: string, group: AgentEventGroup) {
  switch (agentName) {
    case "InteractionRouterAgent":
      return <InteractionRouterSummary group={group} />;
    case "ConstraintDiscoveryAgent":
      return <ConstraintDiscoverySummary group={group} />;
    case "UserPreferenceAgent":
      return <UserPreferenceSummary group={group} />;
    case "ContextGroundingAgent":
      return <ContextGroundingSummary group={group} />;
    case "PlanSolverAgent":
      return <PlanSolverSummary group={group} />;
    case "PlanEvaluatorAgent":
      return <PlanEvaluatorSummary group={group} />;
    case "PlanExplanationAgent":
      return <PlanExplanationSummary group={group} />;
    default:
      return <UnknownAgentSummary group={group} />;
  }
}

// ─── InteractionRouterAgent ────────────────────────────────────────

function InteractionRouterSummary({ group }: { group: AgentEventGroup }) {
  const output = findEventOutput(group, "interaction_type");
  const routingReason = strOr(output?.routing_reason, strOr(output?.reason, undefined));
  const confidence = output?.confidence;
  const routingSource = strOr(output?.routing_source, strOr(output?.provider, undefined));
  const schemaValidation = strOr(output?.schema_validation, strOr(output?.validation_result, undefined));
  const fallbackReason = strOr(
    group.events.find((e) => e.metadata?.fallback_reason)?.metadata?.fallback_reason,
    undefined
  );

  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <SummaryRow label="分流结果" value={strOr(output?.interaction_type, undefined)} mono />
      <SummaryRow
        label="置信度"
        value={typeof confidence === "number" ? `${(confidence * 100).toFixed(0)}%` : typeof confidence === "string" ? confidence : undefined}
      />
      <SummaryRow label="分流来源" value={routingSource} mono />
      <SummaryRow label="Schema 校验" value={schemaValidation} mono />
      {fallbackReason && (
        <div className="col-span-2">
          <SummaryRow label="Fallback 原因" value={fallbackReason} />
        </div>
      )}
      {routingReason && (
        <div className="col-span-2">
          <SummaryRow label="分流理由" value={routingReason} />
        </div>
      )}
    </div>
  );
}

// ─── ConstraintDiscoveryAgent ──────────────────────────────────────

function ConstraintDiscoverySummary({ group }: { group: AgentEventGroup }) {
  // 需求摘要
  const reqOutput = findEventOutput(group, "requirement_summary") ?? findEventOutput(group, "city");
  const city = strOr(reqOutput?.city, undefined);
  const timeWindow = strOr(reqOutput?.time_window, strOr(reqOutput?.time_window_summary, undefined));
  const peopleCount = reqOutput?.people_count ?? reqOutput?.party_size;
  const includeDining = reqOutput?.include_dining ?? reqOutput?.need_dining;

  // 约束账本
  const hardConstraints = collectArrayField(group, "hard_constraints");
  const softConstraints = collectArrayField(group, "soft_constraints");

  // 补全卡片
  const clarificationCards = collectArrayField(group, "clarification_cards");
  const missingFields = collectArrayField(group, "missing_fields");

  // Grounding 请求
  const groundingRequests = collectArrayField(group, "grounding_requests");

  return (
    <div className="space-y-4">
      {/* 需求摘要 */}
      <SummaryCard title="需求摘要">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryRow label="城市" value={city} />
          <SummaryRow label="时间窗" value={timeWindow} />
          <SummaryRow label="人数" value={typeof peopleCount === "number" ? String(peopleCount) : typeof peopleCount === "string" ? peopleCount : undefined} />
          <SummaryRow
            label="安排吃喝"
            value={typeof includeDining === "boolean" ? (includeDining ? "是" : "否") : typeof includeDining === "string" ? includeDining : undefined}
          />
        </div>
      </SummaryCard>

      {/* 约束账本草稿 */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard title="硬约束">
          {hardConstraints.length > 0 ? (
            hardConstraints.map((item, i) => (
              <SummaryListItem key={i} label={String(isRecord(item) ? (item.name ?? item.key ?? JSON.stringify(item)) : item)} detail={isRecord(item) ? strOr(item.detail ?? item.description, "") : ""} />
            ))
          ) : (
            <p className="text-xs text-neutral-400">未提供</p>
          )}
        </SummaryCard>
        <SummaryCard title="软约束">
          {softConstraints.length > 0 ? (
            softConstraints.map((item, i) => (
              <SummaryListItem key={i} label={String(isRecord(item) ? (item.name ?? item.key ?? JSON.stringify(item)) : item)} detail={isRecord(item) ? strOr(item.detail ?? item.description, "") : ""} />
            ))
          ) : (
            <p className="text-xs text-neutral-400">未提供</p>
          )}
        </SummaryCard>
      </div>

      {/* 补全卡片 */}
      {(clarificationCards.length > 0 || missingFields.length > 0) && (
        <SummaryCard title="补全卡片">
          {missingFields.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {missingFields.map((field, i) => (
                <SummaryTag key={i} variant="yellow">{String(isRecord(field) ? (field.name ?? field.key ?? JSON.stringify(field)) : field)}</SummaryTag>
              ))}
            </div>
          )}
          {clarificationCards.map((card, i) => (
            <SummaryListItem
              key={i}
              label={String(isRecord(card) ? (card.question ?? card.title ?? card.field ?? `追问 ${i + 1}`) : card)}
              detail={isRecord(card) ? strOr(card.reason ?? card.description, "") : ""}
            />
          ))}
        </SummaryCard>
      )}

      {/* Grounding 请求 */}
      {groundingRequests.length > 0 && (
        <SummaryCard title="Grounding 请求">
          <div className="flex flex-wrap gap-1">
            {groundingRequests.map((req, i) => (
              <SummaryTag key={i} variant="blue">{String(req)}</SummaryTag>
            ))}
          </div>
        </SummaryCard>
      )}
    </div>
  );
}

// ─── UserPreferenceAgent ───────────────────────────────────────────

function UserPreferenceSummary({ group }: { group: AgentEventGroup }) {
  const prefOutput = findEventOutput(group, "preference_sources") ?? findEventOutput(group, "preferences");
  const preferenceSources = collectArrayField(group, "preference_sources");
  const preferences = collectArrayField(group, "preferences");
  const warmupPending = prefOutput?.preference_warmup_pending ?? prefOutput?.warmup_pending;
  const nonBlockingNote = strOr(prefOutput?.non_blocking_note, strOr(prefOutput?.note, undefined));

  return (
    <div className="space-y-4">
      {/* 偏好来源 */}
      <SummaryCard title="偏好来源">
        {preferenceSources.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {preferenceSources.map((src, i) => (
              <SummaryTag key={i} variant="default">{String(isRecord(src) ? (src.name ?? src.source ?? JSON.stringify(src)) : src)}</SummaryTag>
            ))}
          </div>
        ) : preferences.length > 0 ? (
          <div className="space-y-1">
            {preferences.map((pref, i) => (
              <SummaryListItem
                key={i}
                label={String(isRecord(pref) ? (pref.label ?? pref.name ?? pref.id ?? `偏好 ${i + 1}`) : pref)}
                detail={isRecord(pref) ? strOr(pref.source ?? pref.reason, "") : ""}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-400">未提供偏好来源</p>
        )}
      </SummaryCard>

      {/* Warmup 状态 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <SummaryRow
          label="preference_warmup_pending"
          value={typeof warmupPending === "boolean" ? (warmupPending ? "是" : "否") : undefined}
        />
      </div>

      {/* 非阻塞说明 */}
      {nonBlockingNote && (
        <div className="rounded-md bg-[#fffdf8] px-3 py-2 text-xs leading-5 text-neutral-600">
          {nonBlockingNote}
        </div>
      )}
    </div>
  );
}

// ─── ContextGroundingAgent ─────────────────────────────────────────

function ContextGroundingSummary({ group }: { group: AgentEventGroup }) {
  // POI 搜索结果
  const poiOutput = findEventOutput(group, "accepted_pois") ?? findEventOutput(group, "candidates") ?? findEventOutput(group, "related_pois");
  const acceptedCount = Array.isArray(poiOutput?.accepted_pois) ? poiOutput!.accepted_pois.length
    : Array.isArray(poiOutput?.candidates) ? poiOutput!.candidates.length
    : Array.isArray(poiOutput?.related_pois) ? poiOutput!.related_pois.length
    : undefined;
  const rejectedCount = Array.isArray(poiOutput?.rejected_pois) ? poiOutput!.rejected_pois.length
    : Array.isArray(poiOutput?.rejected) ? poiOutput!.rejected.length
    : undefined;

  // 天气约束
  const weatherOutput = findEventOutput(group, "weather");
  const weatherSummary = strOr(weatherOutput?.weather_summary, strOr(weatherOutput?.condition, undefined));
  const weatherProvider = strOr(weatherOutput?.weather_provider, strOr(weatherOutput?.provider, undefined));

  // 地图距离 provider
  const mapOutput = findEventOutput(group, "provider") ?? findEventOutput(group, "legs");
  const mapProvider = strOr(mapOutput?.provider, undefined);
  const mapFallback = mapOutput?.fallback_used;

  // 深度字段 Mock 标记
  const mockFields: string[] = [];
  for (const event of group.events) {
    if (event.fallback_used) {
      mockFields.push(event.tool_name ?? event.type);
    }
    if (event.tool_output && isRecord(event.tool_output)) {
      const reliability = event.tool_output.reliability ?? event.tool_output.coordinate_confidence;
      if (typeof reliability === "string" && reliability.includes("mock")) {
        mockFields.push(event.tool_name ?? "unknown_tool");
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* POI 搜索结果摘要 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <SummaryRow label="Accepted POI" value={typeof acceptedCount === "number" ? String(acceptedCount) : undefined} />
        <SummaryRow label="Rejected POI" value={typeof rejectedCount === "number" ? String(rejectedCount) : undefined} />
      </div>

      {/* 天气约束 */}
      <SummaryCard title="天气约束">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryRow label="天气概况" value={weatherSummary} />
          <SummaryRow label="天气 Provider" value={weatherProvider} mono />
        </div>
      </SummaryCard>

      {/* 地图距离 Provider */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <SummaryRow label="地图 Provider" value={mapProvider} mono />
        <SummaryRow
          label="Fallback"
          value={typeof mapFallback === "boolean" ? (mapFallback ? "已触发" : "未触发") : undefined}
        />
      </div>

      {/* 深度字段 Mock 标记 */}
      {mockFields.length > 0 && (
        <SummaryCard title="深度字段 Mock 标记">
          <div className="flex flex-wrap gap-1">
            {mockFields.map((field, i) => (
              <SummaryTag key={i} variant="yellow">{field}</SummaryTag>
            ))}
          </div>
        </SummaryCard>
      )}
    </div>
  );
}

// ─── PlanSolverAgent ───────────────────────────────────────────────

function PlanSolverSummary({ group }: { group: AgentEventGroup }) {
  const solverOutput = findEventOutput(group, "candidate_plans") ?? findEventOutput(group, "plans");
  const candidateCount = Array.isArray(solverOutput?.candidate_plans) ? solverOutput!.candidate_plans.length
    : Array.isArray(solverOutput?.plans) ? solverOutput!.plans.length
    : undefined;
  const slotAllocation = strOr(solverOutput?.slot_allocation, strOr(solverOutput?.slot_logic, undefined));
  const filteredRoutes = collectArrayField(group, "filtered_routes");
  const infeasibleRoutes = collectArrayField(group, "infeasible_routes");
  const solverNotes = strOr(solverOutput?.solver_notes, undefined);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <SummaryRow label="候选路线数量" value={typeof candidateCount === "number" ? String(candidateCount) : undefined} />
        <SummaryRow label="Slot 分配逻辑" value={slotAllocation} />
      </div>

      {/* 过滤掉的不可行路线 */}
      {(filteredRoutes.length > 0 || infeasibleRoutes.length > 0) && (
        <SummaryCard title="过滤掉的不可行路线">
          {[...filteredRoutes, ...infeasibleRoutes].map((route, i) => (
            <SummaryListItem
              key={i}
              label={String(isRecord(route) ? (route.route_id ?? route.id ?? `路线 ${i + 1}`) : route)}
              detail={isRecord(route) ? strOr(route.reason ?? route.rejection_reason, "") : ""}
            />
          ))}
        </SummaryCard>
      )}

      {/* Solver Notes */}
      {solverNotes && (
        <div className="rounded-md bg-[#fffdf8] px-3 py-2 text-xs leading-5 text-neutral-600">
          <span className="font-bold text-dz-orange">solver_notes: </span>{solverNotes}
        </div>
      )}
    </div>
  );
}

// ─── PlanEvaluatorAgent ────────────────────────────────────────────

function PlanEvaluatorSummary({ group }: { group: AgentEventGroup }) {
  // 评分拆解
  const scoreEvent = group.events.find((e) => e.type === "route_scored");
  const scoreOutput = scoreEvent?.output ?? scoreEvent?.tool_output;
  const planScores = isRecord(scoreOutput) && Array.isArray(scoreOutput.plan_scores)
    ? scoreOutput.plan_scores
    : [];

  // 淘汰理由
  const rejectedRoutes = isRecord(scoreOutput) && Array.isArray(scoreOutput.rejected_routes)
    ? scoreOutput.rejected_routes
    : [];

  // 硬约束违反
  const hardViolations = collectArrayField(group, "hard_constraint_violations");

  return (
    <div className="space-y-4">
      {/* 评分拆解 */}
      {planScores.length > 0 ? (
        <SummaryCard title="评分拆解">
          <div className="space-y-2">
            {planScores.map((item: unknown, i: number) => {
              const record = isRecord(item) ? item : {};
              const breakdown = isRecord(record.score_breakdown) ? record.score_breakdown : {};
              return (
                <div key={i} className="rounded-md bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold">{strOr(record.title ?? record.plan_id, `方案 ${i + 1}`)}</span>
                    <span className="font-mono font-bold text-dz-orange">{numberValue(record.score) ?? "-"}</span>
                  </div>
                  {Object.keys(breakdown).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(breakdown).map(([key, val]) => (
                        <span key={key} className="rounded-full bg-[#f1eee7] px-1.5 py-0.5 text-[9px] font-bold text-neutral-600">
                          {scoreLabel(key)}: {numberValue(val) ?? "-"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SummaryCard>
      ) : (
        <div className="text-sm">
          <SummaryRow label="评分拆解" value={undefined} />
        </div>
      )}

      {/* 淘汰理由 */}
      {rejectedRoutes.length > 0 && (
        <SummaryCard title="淘汰理由">
          {rejectedRoutes.map((item: unknown, i: number) => {
            const record = isRecord(item) ? item : {};
            return (
              <div key={i} className="rounded-md border border-red-200 bg-red-50/50 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-red-700">{strOr(record.route_id ?? record.routeId, `路线 ${i + 1}`)}</span>
                  <SummaryTag variant="red">{numberValue(record.score) ?? "-"} 分</SummaryTag>
                </div>
                <p className="mt-1 text-red-800">{strOr(record.reason ?? record.rejected_route_reason, "未提供淘汰原因")}</p>
              </div>
            );
          })}
        </SummaryCard>
      )}

      {/* 硬约束违反 */}
      {hardViolations.length > 0 && (
        <SummaryCard title="硬约束违反">
          {hardViolations.map((v, i) => (
            <div key={i} className="rounded-md border border-red-200 bg-red-50/50 px-3 py-2 text-xs text-red-800">
              {String(isRecord(v) ? (v.name ?? v.constraint ?? JSON.stringify(v)) : v)}
              {isRecord(v) && Boolean(v.detail) && <span className="ml-1 text-red-600">{String(v.detail)}</span>}
            </div>
          ))}
        </SummaryCard>
      )}
    </div>
  );
}

// ─── PlanExplanationAgent ──────────────────────────────────────────

function PlanExplanationSummary({ group }: { group: AgentEventGroup }) {
  const explainOutput = findEventOutput(group, "explanation") ?? findEventOutput(group, "explanation_draft");
  const explanationDraft = strOr(explainOutput?.explanation, strOr(explainOutput?.explanation_draft, undefined));
  const guardrailResult = strOr(explainOutput?.guardrail_result, strOr(explainOutput?.guardrail_check, undefined));
  const citedFacts = collectArrayField(group, "cited_facts");
  const guardrailPassed = explainOutput?.guardrail_passed;

  return (
    <div className="space-y-4">
      {/* LLM 解释草稿预览 */}
      {explanationDraft && (
        <SummaryCard title="LLM 解释草稿">
          <p className="text-xs leading-5 text-neutral-700">{explanationDraft}</p>
        </SummaryCard>
      )}
      {!explanationDraft && (
        <div className="text-sm">
          <SummaryRow label="解释草稿" value={undefined} />
        </div>
      )}

      {/* Guardrail 检查结果 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <SummaryRow
          label="Guardrail 检查"
          value={typeof guardrailPassed === "boolean" ? (guardrailPassed ? "通过" : "未通过") : guardrailResult}
        />
      </div>

      {/* 引用事实列表 */}
      {citedFacts.length > 0 && (
        <SummaryCard title="引用事实">
          {citedFacts.map((fact, i) => (
            <SummaryListItem
              key={i}
              label={String(isRecord(fact) ? (fact.type ?? fact.source ?? `事实 ${i + 1}`) : fact)}
              detail={isRecord(fact) ? strOr(fact.content ?? fact.value ?? fact.detail, "") : ""}
            />
          ))}
        </SummaryCard>
      )}
    </div>
  );
}

// ─── 未知 Agent fallback ───────────────────────────────────────────

function UnknownAgentSummary({ group }: { group: AgentEventGroup }) {
  const detail = getTraceDetail(group.events[0]);

  return (
    <section className="mt-5 grid grid-cols-3 gap-3">
      {([
        ["输入", detail.input],
        ["处理摘要", detail.process],
        ["输出", detail.output]
      ] as const).map(([title, items]) => (
        <div key={title} className="rounded-md border border-dz-line bg-[#fffdf8] p-4">
          <h4 className="mb-3 text-sm font-black text-dz-orange">{title}</h4>
          <div className="space-y-2">
            {(items as string[]).map((item) => (
              <p key={item} className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-neutral-600">
                {item}
              </p>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

async function generateAndApplyMockUser({
  userType,
  city,
  area,
  scenario,
  customization,
  currentLocation,
  setGeneratedMockUsers,
  applyGeneratedUser,
  setActiveUserId,
}: {
  userType: "new" | "regular";
  city: string;
  area?: string;
  scenario: string;
  customization?: string;
  currentLocation?: MockLocation;
  setGeneratedMockUsers: (users: MockUserFull[]) => void;
  applyGeneratedUser: (user: MockUserFull) => void;
  setActiveUserId: (userId: string) => void;
}) {
  const response = await generateMockUser({
    user_type: userType,
    city,
    area,
    scenario,
    customization,
    current_location: currentLocation,
  });
  setGeneratedMockUsers(response.users);
  const activeUser = response.users[0];
  if (activeUser) {
    applyGeneratedUser(activeUser);
    setActiveUserId(activeUser.id);
  }
  return response;
}

function createManualMockLocation(draft: { city: string; area: string; address: string }): MockLocation {
  const city = draft.city.trim() || "北京";
  const area = draft.area.trim();
  const address = draft.address.trim();
  return {
    id: `manual-location-${city}-${area || "city"}`,
    city,
    area: area || undefined,
    address: address || undefined,
    source: "manual",
    reliability: "user_input",
    label: area ? `${city} · ${area}` : city,
  };
}

const CHINA_LOCATION_PRESETS: Array<Omit<MockLocation, "id" | "source" | "reliability">> = [
  { city: "北京", area: "三里屯", address: "太古里北区", latitude: 39.9348, longitude: 116.4542, label: "北京 · 三里屯" },
  { city: "北京", area: "望京", address: "望京 SOHO 附近", latitude: 39.9959, longitude: 116.4811, label: "北京 · 望京" },
  { city: "北京", area: "五道口", address: "五道口购物中心附近", latitude: 39.9927, longitude: 116.3372, label: "北京 · 五道口" },
  { city: "上海", area: "静安寺", address: "南京西路商圈", latitude: 31.2239, longitude: 121.4452, label: "上海 · 静安寺" },
  { city: "上海", area: "徐家汇", address: "港汇恒隆广场附近", latitude: 31.1927, longitude: 121.4376, label: "上海 · 徐家汇" },
  { city: "上海", area: "新天地", address: "太仓路附近", latitude: 31.2209, longitude: 121.4751, label: "上海 · 新天地" },
  { city: "成都", area: "太古里", address: "春熙路太古里", latitude: 30.657, longitude: 104.081, label: "成都 · 太古里" },
  { city: "成都", area: "宽窄巷子", address: "宽窄巷子景区附近", latitude: 30.6695, longitude: 104.0554, label: "成都 · 宽窄巷子" },
  { city: "成都", area: "玉林", address: "玉林生活广场附近", latitude: 30.6261, longitude: 104.0575, label: "成都 · 玉林" },
  { city: "杭州", area: "湖滨", address: "西湖湖滨商圈", latitude: 30.2589, longitude: 120.1649, label: "杭州 · 湖滨" },
  { city: "杭州", area: "武林", address: "武林广场附近", latitude: 30.2741, longitude: 120.1642, label: "杭州 · 武林" },
  { city: "杭州", area: "滨江", address: "星光大道商圈", latitude: 30.2086, longitude: 120.2121, label: "杭州 · 滨江" },
  { city: "广州", area: "天河", address: "天环广场附近", latitude: 23.1322, longitude: 113.327, label: "广州 · 天河" },
  { city: "广州", area: "北京路", address: "北京路步行街", latitude: 23.1247, longitude: 113.2708, label: "广州 · 北京路" },
  { city: "广州", area: "珠江新城", address: "花城汇附近", latitude: 23.1196, longitude: 113.3235, label: "广州 · 珠江新城" },
  { city: "深圳", area: "南山", address: "海岸城商圈", latitude: 22.5178, longitude: 113.936, label: "深圳 · 南山" },
  { city: "深圳", area: "福田", address: "卓悦中心附近", latitude: 22.5431, longitude: 114.0579, label: "深圳 · 福田" },
  { city: "深圳", area: "宝安", address: "壹方城附近", latitude: 22.5547, longitude: 113.8878, label: "深圳 · 宝安" },
  { city: "重庆", area: "解放碑", address: "解放碑步行街", latitude: 29.5637, longitude: 106.5755, label: "重庆 · 解放碑" },
  { city: "重庆", area: "观音桥", address: "观音桥步行街", latitude: 29.5784, longitude: 106.5325, label: "重庆 · 观音桥" },
  { city: "西安", area: "小寨", address: "小寨商圈", latitude: 34.2236, longitude: 108.9531, label: "西安 · 小寨" },
  { city: "西安", area: "曲江", address: "大唐不夜城附近", latitude: 34.2097, longitude: 108.9743, label: "西安 · 曲江" },
  { city: "南京", area: "新街口", address: "德基广场附近", latitude: 32.0415, longitude: 118.7849, label: "南京 · 新街口" },
  { city: "南京", area: "老门东", address: "老门东历史街区", latitude: 32.0139, longitude: 118.7948, label: "南京 · 老门东" },
  { city: "武汉", area: "江汉路", address: "江汉路步行街", latitude: 30.5843, longitude: 114.2891, label: "武汉 · 江汉路" },
  { city: "武汉", area: "光谷", address: "光谷步行街", latitude: 30.5066, longitude: 114.4005, label: "武汉 · 光谷" },
  { city: "苏州", area: "观前街", address: "观前街商圈", latitude: 31.3143, longitude: 120.6229, label: "苏州 · 观前街" },
  { city: "苏州", area: "金鸡湖", address: "苏州中心附近", latitude: 31.3174, longitude: 120.6793, label: "苏州 · 金鸡湖" },
  { city: "长沙", area: "五一广场", address: "黄兴路步行街附近", latitude: 28.1934, longitude: 112.9767, label: "长沙 · 五一广场" },
  { city: "青岛", area: "五四广场", address: "万象城附近", latitude: 36.0647, longitude: 120.3826, label: "青岛 · 五四广场" },
];

function randomChinaMockLocation(): MockLocation {
  const preset = CHINA_LOCATION_PRESETS[Math.floor(Math.random() * CHINA_LOCATION_PRESETS.length)];
  const latitude = addCoordinateJitter(preset.latitude);
  const longitude = addCoordinateJitter(preset.longitude);
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    ...preset,
    id: `random-location-${Date.now()}-${suffix}`,
    latitude,
    longitude,
    source: "random",
    reliability: "mocked",
  };
}

function addCoordinateJitter(value?: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const jitter = (Math.random() - 0.5) * 0.012;
  return Number((value + jitter).toFixed(6));
}

// 首屏空态：还没有任何 run 时，引导用户创建空演示框架或生成模拟用户
function TraceEmptyState({
  onNewRun,
  onOpenHistory,
  onOpenMock,
  onQuickGenerateUser
}: {
  onNewRun: () => void;
  onOpenHistory: () => void;
  onOpenMock: () => void;
  onQuickGenerateUser: (userType: "new" | "regular") => Promise<void>;
}) {
  const [userType, setUserType] = useState<"new" | "regular">("regular");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOneClick() {
    setLoading(true);
    setError(null);
    try {
      await onQuickGenerateUser(userType);
    } catch (quickError) {
      setError(quickError instanceof Error ? quickError.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-8 [scrollbar-width:thin]">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-dz-soft">
          <Sparkles className="h-8 w-8 text-dz-orange" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dz-orange">Debug Trace</p>
        <h3 className="mt-1 text-lg font-black text-dz-ink">一键搭建演示数据</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          选择用户类型，一键生成用户、POI 和位置数据。
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <div className="inline-flex items-center rounded-full border border-dz-line bg-white p-0.5">
            <button
              type="button"
              onClick={() => setUserType("new")}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition",
                userType === "new"
                  ? "bg-dz-orange text-white shadow-sm"
                  : "text-neutral-500 hover:text-dz-ink"
              )}
            >
              新用户
            </button>
            <button
              type="button"
              onClick={() => setUserType("regular")}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition",
                userType === "regular"
                  ? "bg-dz-orange text-white shadow-sm"
                  : "text-neutral-500 hover:text-dz-ink"
              )}
            >
              常规用户
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleOneClick()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-dz-orange px-5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#e25a32] disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? "生成中..." : "一键生成"}
          </button>
        </div>
        {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p> : null}

        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onOpenMock}
            className="inline-flex items-center gap-1.5 rounded-full border border-dz-line bg-white px-4 py-2 text-xs font-bold text-neutral-600 transition hover:border-dz-orange hover:text-dz-orange"
          >
            <Database className="h-3.5 w-3.5" />
            打开生成器
          </button>
          <button
            type="button"
            onClick={onNewRun}
            className="inline-flex items-center gap-1.5 rounded-full border border-dz-line bg-white px-4 py-2 text-xs font-bold text-neutral-600 transition hover:border-dz-orange hover:text-dz-orange"
          >
            <Sparkles className="h-3.5 w-3.5" />
            新演示
          </button>
          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-1.5 rounded-full border border-dz-line bg-white px-4 py-2 text-xs font-bold text-neutral-600 transition hover:border-dz-orange hover:text-dz-orange"
          >
            <History className="h-3.5 w-3.5" />
            查看历史 Run
          </button>
        </div>
        <p className="mt-5 text-[11px] leading-5 text-neutral-400">
          Mock 数据只在生成器、History 快捷演示、当前 run 或 fallback 中展示，不会首屏预置业务数据。
        </p>
      </div>
    </div>
  );
}

function CandidatePoolView({
  snapshot,
  constraints,
  selectedEvent,
  isChatRun
}: {
  snapshot: ReturnType<typeof buildCandidateSnapshot>;
  constraints: ConstraintItem[];
  selectedEvent?: TraceEvent;
  isChatRun: boolean;
}) {
  const retrievalHighlighted =
    selectedEvent?.agent === "ContextGroundingAgent" ||
    selectedEvent?.type === "candidate_retrieved" ||
    selectedEvent?.type === "context_grounded" ||
    selectedEvent?.type === "tool_called";

  return (
    <>
      <section className={cn("rounded-md border p-5", retrievalHighlighted ? "border-dz-orange bg-dz-soft" : "border-dz-line bg-white")}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-black">
              {isChatRun ? "普通问答相关 POI" : "候选池与排除理由"}
            </h4>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {isChatRun
                ? "普通问答链路只返回 related_pois，不生成完整路线。"
                : "输入是结构化需求和候选 POI；处理是召回、过滤和记录原因；输出是可进入地图距离计算的候选池。"}
            </p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-dz-orange">
            {snapshot.accepted.length} accepted{!isChatRun && snapshot.rejected.length > 0 ? ` / ${snapshot.rejected.length} rejected` : ""}
          </span>
        </div>

        {isChatRun ? (
          /* 普通问答只展示 accepted（related_pois） */
          <div className="space-y-2">
            {snapshot.accepted.length ? (
              snapshot.accepted.map((item) => (
                <article key={`${item.status}-${item.id}`} className="rounded-md border border-dz-line bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h6 className="text-sm font-black">{item.name}</h6>
                    <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">related</span>
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-500">{item.meta}</p>
                  <p className="mt-2 text-xs leading-5 text-neutral-700">{item.reason}</p>
                </article>
              ))
            ) : (
              <p className="rounded-md bg-[#fffdf8] px-4 py-5 text-sm leading-6 text-neutral-500">
                当前问答链路没有返回 related_pois。
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <CandidateList title="进入候选池" items={snapshot.accepted} />
            <CandidateList title="已排除 POI" items={snapshot.rejected} />
          </div>
        )}
      </section>

      <section className="mt-5 grid grid-cols-[1fr_1fr] gap-4">
        <div className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
          <h4 className="text-sm font-black">UGC 命中摘要</h4>
          <div className="mt-3 space-y-2">
            {snapshot.ugcHits.length ? (
              snapshot.ugcHits.map((hit) => (
                <p key={hit} className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-neutral-600">
                  {hit}
                </p>
              ))
            ) : (
              <p className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-neutral-500">
                当前 run 没有 UGC 命中数据。
              </p>
            )}
          </div>
        </div>
        <ConstraintList constraints={constraints} />
      </section>
    </>
  );
}

function PlanRankingView({
  scores,
  rejectedRoutes,
  selectedPlanId,
  constraints,
  isChatRun
}: {
  scores: PlanScoreSnapshot[];
  rejectedRoutes: RejectedRouteSnapshot[];
  selectedPlanId?: string;
  constraints: ConstraintItem[];
  isChatRun: boolean;
}) {
  if (isChatRun) {
    return (
      <section className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
        <h4 className="text-sm font-black">普通 POI 问答链路</h4>
        <p className="mt-3 text-sm leading-7 text-neutral-600">
          当前 run 是 `answer + related_pois + trace`，不会生成完整路线，也不会展示 3 套方案评分。候选 POI 可以在“候选池”页签查看。
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-md border border-dz-line bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black">3 个方案的匹配度分与排序理由</h4>
            <p className="mt-1 text-xs leading-5 text-neutral-500">分数用于内部排序，用户端只弱化展示成“推荐 / 更轻松 / 少走路”等标签。</p>
          </div>
          <span className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">{scores.length} plans</span>
        </div>

        <div className="space-y-3">
          {scores.map((score, index) => (
            <article
              key={score.planId}
              className={cn(
                "rounded-md border p-4",
                score.planId === selectedPlanId ? "border-dz-orange bg-dz-soft" : "border-dz-line bg-[#fffdf8]"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-dz-orange">
                      #{index + 1}
                    </span>
                    <h5 className="font-black">{score.title}</h5>
                    {score.planId === selectedPlanId && (
                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-dz-orange">用户端当前选中</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">{score.rankReason}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-3xl font-black text-dz-orange">{score.score}</div>
                  <div className="text-[11px] text-neutral-500">匹配度分</div>
                </div>
              </div>
              <ScoreBreakdown breakdown={score.breakdown} />
            </article>
          ))}
        </div>
      </section>

      {rejectedRoutes.length > 0 && (
        <section className="mt-5 rounded-md border border-dz-line bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black">被淘汰候选</h4>
              <p className="mt-1 text-xs leading-5 text-neutral-500">以下候选路线因硬约束违反或评分不足被淘汰，不会出现在最终方案中。</p>
            </div>
            <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700">{rejectedRoutes.length} rejected</span>
          </div>
          <div className="space-y-2">
            {rejectedRoutes.map((rejected) => (
              <article key={rejected.routeId} className="rounded-md border border-red-200 bg-red-50/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-red-700">{rejected.routeId}</span>
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{rejected.score} 分</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-red-800">{rejected.reason}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5">
        <ConstraintList constraints={constraints} />
      </div>
    </>
  );
}

function MapProviderView({ snapshot, selectedPlan }: { snapshot: MapSnapshot; selectedPlan?: DemoRoutePlan }) {
  return (
    <>
      {/* Fallback 警告 */}
      {snapshot.fallbackUsed && (
        <section className="mb-4 rounded-md border-2 border-yellow-400 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
            <div>
              <h4 className="text-sm font-black text-yellow-800">地图 Provider 使用了 Fallback</h4>
              <p className="mt-1 text-xs leading-5 text-yellow-700">
                真实地图 provider（高德）不可用或返回异常，已降级到 mock_map_provider。坐标和距离数据可靠性为 mocked。
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-[minmax(0,1fr)_310px] gap-4">
        <div className="rounded-md border border-dz-line bg-white p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-black">地图与距离 Provider</h4>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                前端只消费统一的 map preview 和 route matrix；高德返回失败时可降级为 mock_map_provider，但 Trace 会保留 provider、参数和摘要。
              </p>
            </div>
            <span className={cn(
              "rounded-full px-2 py-1 text-[11px] font-bold",
              snapshot.fallbackUsed ? "bg-yellow-50 text-yellow-700" : "bg-dz-soft text-dz-orange"
            )}>
              {snapshot.provider}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <MiniStat label="Provider" value={snapshot.provider} />
            <MiniStat label="预览类型" value={snapshot.previewType} />
            <MiniStat label="总距离" value={formatMeters(snapshot.totalDistanceMeters)} />
            <MiniStat label="总耗时" value={snapshot.totalDurationMinutes ? `${snapshot.totalDurationMinutes} 分钟` : "-"} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className={cn(
              "rounded-md p-3 text-center",
              snapshot.fallbackUsed ? "bg-yellow-50" : "bg-green-50"
            )}>
              <div className="text-[10px] font-bold text-neutral-500">Fallback</div>
              <div className={cn("mt-1 text-sm font-black", snapshot.fallbackUsed ? "text-yellow-700" : "text-green-700")}>
                {snapshot.fallbackUsed ? "已触发" : "未触发"}
              </div>
            </div>
            <div className={cn(
              "rounded-md p-3 text-center",
              snapshot.coordinateConfidence === "verified" ? "bg-green-50" : snapshot.coordinateConfidence === "mocked" ? "bg-yellow-50" : "bg-red-50"
            )}>
              <div className="text-[10px] font-bold text-neutral-500">坐标置信度</div>
              <div className={cn(
                "mt-1 text-sm font-black",
                snapshot.coordinateConfidence === "verified" ? "text-green-700" : snapshot.coordinateConfidence === "mocked" ? "text-yellow-700" : "text-red-700"
              )}>
                {snapshot.coordinateConfidence}
              </div>
            </div>
            <div className="rounded-md bg-[#fffdf8] p-3 text-center">
              <div className="text-[10px] font-bold text-neutral-500">来源</div>
              <div className="mt-1 text-sm font-black text-neutral-700">{snapshot.provider === "amap" ? "高德" : "Mock"}</div>
            </div>
          </div>

          <div className="mt-4 rounded-md bg-[#fffdf8] p-4 text-sm leading-6 text-neutral-600">
            <div className="font-bold text-dz-ink">来源说明</div>
            <p className="mt-1">{snapshot.note}</p>
          </div>
        </div>

        {selectedPlan && (
          <div>
            <SvgRouteMap
              points={selectedPlan.mapPoints}
              tone={selectedPlan.mapTone}
              label={`${selectedPlan.title} · 伪地图`}
              summary={`当前方案 ${selectedPlan.score} 分`}
            />
          </div>
        )}
      </section>

      <section className="mt-5 rounded-md border border-dz-line bg-white p-5">
        <h4 className="text-sm font-black">距离矩阵 / 通勤估算</h4>
        <div className="mt-3 overflow-hidden rounded-md border border-dz-line">
          <div className="grid grid-cols-[1fr_1fr_120px_120px] bg-[#fbfaf7] px-3 py-2 text-xs font-bold text-neutral-500">
            <span>From</span>
            <span>To</span>
            <span>距离</span>
            <span>耗时</span>
          </div>
          {snapshot.legs.length ? (
            snapshot.legs.map((leg, index) => (
              <div key={`${leg.origin}-${leg.destination}-${index}`} className="grid grid-cols-[1fr_1fr_120px_120px] border-t border-dz-line px-3 py-3 text-sm">
                <span className="font-mono text-xs">{leg.origin}</span>
                <span className="font-mono text-xs">{leg.destination}</span>
                <span>{formatMeters(leg.distanceMeters)}</span>
                <span>{leg.durationMinutes ? `${leg.durationMinutes} 分钟` : "-"}</span>
              </div>
            ))
          ) : (
            <div className="px-3 py-5 text-sm text-neutral-500">当前 run 没有距离矩阵数据。</div>
          )}
        </div>
      </section>
    </>
  );
}

function traceHasMockUsage(trace?: AgentTrace) {
  if (!trace) {
    return false;
  }
  // 只有当 trace 中存在明确的 mock/fallback 标记时才认为有 mock 使用
  const hasFallbackEvent = trace.events.some((event) => {
    const eventMetadata = event.metadata ?? {};
    return (
      event.fallback_used === true ||
      Boolean(eventMetadata.fallback_reason) ||
      Boolean(eventMetadata.fallback_provider)
    );
  });
  if (hasFallbackEvent) {
    return true;
  }
  // 检查 tool_output 中是否有 mock provider
  return trace.events.some((event) => {
    if (!event.tool_output) {
      return false;
    }
    const provider = (event.tool_output as Record<string, unknown>).provider;
    return typeof provider === "string" && provider.includes("mock");
  });
}

function MockDataView({
  preferences,
  plans,
  activeTrace,
  hasActiveRun,
  mapSnapshot,
  isChatRun
}: {
  preferences: Array<{ id: string; label: string; source: string; confidence?: number }>;
  plans: DemoRoutePlan[];
  activeTrace?: AgentTrace;
  hasActiveRun: boolean;
  mapSnapshot: MapSnapshot;
  isChatRun: boolean;
}) {
  // AI Mock 生成器内部状态
  const [userForm, setUserForm] = useState<GenerateMockUserRequest>({ user_type: "regular", city: "北京", area: "三里屯", scenario: "一键生成点仔 Ultra 演示用户" });
  const [poiForm, setPoiForm] = useState<GenerateMockPoisRequest>({
    city: "北京",
    area: "三里屯",
    count: 30
  });
  const [locationDraft, setLocationDraft] = useState({ city: "北京", area: "三里屯", address: "" });
  const [mockCustomization, setMockCustomization] = useState("不喜欢排队，想要路线顺一点");
  const mockBoardTab = useDemoStore((s) => s.mockBoardTab);
  const setMockBoardTab = useDemoStore((s) => s.setMockBoardTab);
  const mockBoardExpanded = useDemoStore((s) => s.mockBoardExpanded);
  const setMockBoardExpanded = useDemoStore((s) => s.setMockBoardExpanded);
  const [userResponse, setUserResponse] = useState<GeneratedMockResponse | null>(null);
  const [poiResponse, setPoiResponse] = useState<GeneratedMockResponse | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [poiError, setPoiError] = useState<string | null>(null);
  const mockBoardRef = useRef<HTMLDivElement>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [poiLoading, setPoiLoading] = useState(false);
  const [oneClickLoading, setOneClickLoading] = useState(false);
  const [oneClickError, setOneClickError] = useState<string | null>(null);

  const generatedMockUsers = useDemoStore((state) => state.generatedMockUsers);
  const generatedMockPois = useDemoStore((state) => state.generatedMockPois);
  const generatedMockLocations = useDemoStore((state) => state.generatedMockLocations);
  const appliedMockUsers = useDemoStore((state) => state.appliedMockUsers);
  const appliedMockPois = useDemoStore((state) => state.appliedMockPois);
  const activeMockLocation = useDemoStore((state) => state.activeMockLocation);
  const activeUserId = useDemoStore((state) => state.activeUserId);
  const setGeneratedMockUsers = useDemoStore((state) => state.setGeneratedMockUsers);
  const setGeneratedMockPois = useDemoStore((state) => state.setGeneratedMockPois);
  const setGeneratedMockLocations = useDemoStore((state) => state.setGeneratedMockLocations);
  const applyGeneratedUser = useDemoStore((state) => state.applyGeneratedUser);
  const applyGeneratedPoi = useDemoStore((state) => state.applyGeneratedPoi);
  const applyMockLocation = useDemoStore((state) => state.applyMockLocation);
  const clearAppliedMock = useDemoStore((state) => state.clearAppliedMock);
  const setActiveUserId = useDemoStore((state) => state.setActiveUserId);

  const activeMockUser = appliedMockUsers.find((user) => user.id === activeUserId) ?? appliedMockUsers[0] ?? generatedMockUsers[0];

  async function handleGenerateUser() {
    setUserLoading(true);
    setUserError(null);
    try {
      const response = await generateAndApplyMockUser({
        userType: userForm.user_type ?? "regular",
        city: userForm.city ?? "北京",
        area: userForm.area ?? locationDraft.area,
        scenario: userForm.scenario ?? "一键生成点仔 Ultra 演示用户",
        customization: mockCustomization,
        currentLocation: activeMockLocation,
        setGeneratedMockUsers,
        applyGeneratedUser,
        setActiveUserId,
      });
      setUserResponse(response);
      mockBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "生成失败");
    } finally {
      setUserLoading(false);
    }
  }

  async function handleGeneratePois() {
    setPoiLoading(true);
    setPoiError(null);
    try {
      const response = await generateMockPois({
        ...poiForm,
        city: poiForm.city || activeMockLocation?.city || "北京",
        area: poiForm.area || activeMockLocation?.area || "三里屯",
        customization: poiForm.customization || mockCustomization,
        count: poiForm.count ?? 30,
      });
      setPoiResponse(response);
      setGeneratedMockPois(response.pois);
      response.pois.forEach((poi) => applyGeneratedPoi(poi));
      mockBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setPoiError(error instanceof Error ? error.message : "生成失败");
    } finally {
      setPoiLoading(false);
    }
  }

  function applyManualLocation() {
    const location = createManualMockLocation(locationDraft);
    setGeneratedMockLocations([location, ...generatedMockLocations.filter((item) => item.id !== location.id)].slice(0, 5));
    applyMockLocation(location);
  }

  function applyRandomLocation() {
    const location = randomChinaMockLocation();
    setLocationDraft({ city: location.city, area: location.area ?? "", address: location.address ?? "" });
    setGeneratedMockLocations([location, ...generatedMockLocations].slice(0, 5));
    applyMockLocation(location);
  }

  async function handleOneClickGenerate() {
    setOneClickLoading(true);
    setOneClickError(null);
    try {
      const location = locationDraft.city.trim()
        ? createManualMockLocation(locationDraft)
        : randomChinaMockLocation();
      applyMockLocation(location);
      setGeneratedMockLocations([location, ...generatedMockLocations].slice(0, 5));

      const nextUserForm = {
        ...userForm,
        city: location.city,
        area: location.area,
        scenario: "一键生成点仔 Ultra 演示用户",
        customization: mockCustomization,
      };
      const userResult = await generateAndApplyMockUser({
        userType: nextUserForm.user_type ?? "regular",
        city: location.city,
        area: location.area,
        scenario: nextUserForm.scenario,
        customization: mockCustomization,
        currentLocation: location,
        setGeneratedMockUsers,
        applyGeneratedUser,
        setActiveUserId,
      });
      setUserForm(nextUserForm);
      setUserResponse(userResult);

      const poiResult = await generateMockPois({
        city: location.city,
        area: location.area ?? "三里屯",
        customization: mockCustomization,
        count: 30,
      });
      setPoiForm({ city: location.city, area: location.area ?? "三里屯", customization: mockCustomization, count: 30 });
      setPoiResponse(poiResult);
      setGeneratedMockPois(poiResult.pois);
      poiResult.pois.forEach((poi) => applyGeneratedPoi(poi));
      setMockBoardTab("user");
      mockBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setOneClickError(error instanceof Error ? error.message : "一键生成失败");
    } finally {
      setOneClickLoading(false);
    }
  }

  const mergedUsers: MockUserFull[] = useMemo(() => {
    const result: MockUserFull[] = [];
    const seen = new Set<string>();
    for (const applied of appliedMockUsers) {
      if (!seen.has(applied.id)) {
        result.push(applied);
        seen.add(applied.id);
      }
    }
    return result;
  }, [appliedMockUsers]);

  const mergedPois: MockPoi[] = useMemo(() => {
    const seen = new Set<string>();
    const result: MockPoi[] = [];
    for (const applied of appliedMockPois) {
      if (!seen.has(applied.id)) {
        result.push(applied);
        seen.add(applied.id);
      }
    }
    return result;
  }, [appliedMockPois]);

  const ugcRows = plans.flatMap((plan) =>
    plan.stops.map((stop) => ({
      id: `${plan.id}-${stop.poiId}`,
      planTitle: plan.title,
      poiName: stop.poiName,
      summary: stop.ugcSummary
    }))
  );
  const hasRunMockUsage = hasActiveRun && traceHasMockUsage(activeTrace);
  const shouldShowRunMockData =
    hasRunMockUsage || mergedUsers.length > 0 || mergedPois.length > 0 || Boolean(activeMockLocation);

  // 从当前 trace 中提取标记为 mocked / fallback 的字段
  const mockFieldsFromTrace = useMemo(() => {
    if (!activeTrace) {
      return [];
    }
    const fields: Array<{ eventLabel: string; field: string; reason: string }> = [];
    for (const event of activeTrace.events) {
      const metadata = event.metadata ?? {};
      if (event.fallback_used || metadata.fallback_reason || metadata.fallback_provider) {
        fields.push({
          eventLabel: event.label,
          field: event.tool_name ?? event.type,
          reason: metadata.fallback_reason ? String(metadata.fallback_reason) : metadata.fallback_provider ? `fallback_provider: ${String(metadata.fallback_provider)}` : "fallback_used"
        });
      }
      if (event.tool_output && typeof event.tool_output === "object") {
        const toolOutput = event.tool_output as Record<string, unknown>;
        if (typeof toolOutput.provider === "string" && toolOutput.provider.includes("mock")) {
          fields.push({
            eventLabel: event.label,
            field: event.tool_name ?? "provider",
            reason: `provider: ${toolOutput.provider}`
          });
        }
        if (toolOutput.coordinate_confidence === "mocked") {
          fields.push({
            eventLabel: event.label,
            field: "coordinate_confidence",
            reason: "坐标置信度为 mocked"
          });
        }
      }
    }
    return fields;
  }, [activeTrace]);

  return (
    <>
      {/* AI Mock 生成器 头部说明 */}
      <section className="rounded-md border border-dz-orange/40 bg-dz-soft/40 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dz-orange">MockDataAgent · AI 生成真实结构数据源</p>
            <h3 className="mt-1 text-base font-black text-dz-ink">输入要求 → LLM 生成真实接口结构 → Pydantic 校验 → Agent 正式读取</h3>
            <p className="mt-2 text-xs leading-5 text-neutral-600">
              这里生成的是演示环境的正式数据源，字段结构按真实 API 设计；只有 LLM/API/schema 失败后的模板才算 fallback。
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-[10px] text-neutral-500">
            <button
              type="button"
              onClick={() => {
                setMockBoardTab("user");
                setMockBoardExpanded(true);
              }}
              className="max-w-[260px] rounded-full border border-dz-orange/30 bg-white px-3 py-1.5 text-left shadow-sm transition hover:border-dz-orange"
            >
              <span className="block truncate font-mono text-[10px] font-black text-dz-orange">
                {activeMockUser?.id ?? "mock-user-empty"}
              </span>
              <span className="block truncate text-[10px] font-bold text-neutral-600">
                {activeMockLocation?.label ?? activeMockUser?.city ?? "未设置 GPS 定位"}
              </span>
            </button>
            <span className="rounded-full bg-white px-2 py-0.5 font-bold text-dz-orange">
              {appliedMockUsers.length} 用户 / {appliedMockPois.length} POI / {activeMockLocation ? 1 : 0} 位置已应用
            </span>
            {(appliedMockUsers.length || appliedMockPois.length || activeMockLocation) ? (
              <button
                type="button"
                onClick={clearAppliedMock}
                className="inline-flex items-center gap-1 rounded-full border border-dz-line bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-500 hover:border-dz-orange hover:text-dz-orange"
              >
                <X className="h-3 w-3" />
                清空已应用
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-md border border-dz-line bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dz-orange">One Click Mock</p>
            <h4 className="mt-1 text-sm font-black">一键生成演示数据</h4>
          </div>
          <div className="ml-auto grid min-w-[520px] flex-1 grid-cols-[140px_1fr_1fr] gap-2">
            <select
              value={userForm.user_type ?? "regular"}
              onChange={(event) => setUserForm((prev) => ({ ...prev, user_type: event.target.value as "new" | "regular" }))}
              className="rounded-md border border-dz-line bg-[#fffdf8] px-2 py-2 text-xs font-bold focus:border-dz-orange focus:outline-none"
            >
              <option value="regular">老用户</option>
              <option value="new">新用户</option>
            </select>
            <input
              type="text"
              value={locationDraft.city}
              onChange={(event) => setLocationDraft((prev) => ({ ...prev, city: event.target.value }))}
              className="rounded-md border border-dz-line bg-[#fffdf8] px-2 py-2 text-xs focus:border-dz-orange focus:outline-none"
              placeholder="城市，如北京"
            />
            <input
              type="text"
              value={locationDraft.area}
              onChange={(event) => setLocationDraft((prev) => ({ ...prev, area: event.target.value }))}
              className="rounded-md border border-dz-line bg-[#fffdf8] px-2 py-2 text-xs focus:border-dz-orange focus:outline-none"
              placeholder="区域，如三里屯"
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_170px] gap-2">
          <input
            type="text"
            value={mockCustomization}
            onChange={(event) => setMockCustomization(event.target.value)}
            className="rounded-md border border-dz-line bg-[#fffdf8] px-3 py-2 text-xs focus:border-dz-orange focus:outline-none"
            placeholder="自然语言定制，比如：不喜欢排队、预算人均 150、喜欢安静聊天"
          />
          <button
            type="button"
            onClick={() => void handleOneClickGenerate()}
            disabled={oneClickLoading}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-dz-orange px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#e25a32] disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {oneClickLoading ? "生成中..." : "一键生成"}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-neutral-500">
          默认生成 1 个 AI 用户、1 个 GPS 位置和 30 个真实结构 POI。POI 数量先限制为 30，避免前端看板和本地状态占用过多内存。
        </p>
        {oneClickError ? <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{oneClickError}</p> : null}
      </section>

      {/* 表单区：User + POI + Location */}
      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* AI 用户数据生成器 */}
        <div className="rounded-md border border-dz-line bg-white p-5">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-dz-orange" />
            <h4 className="text-sm font-black">生成 AI 用户数据</h4>
            <span className="ml-auto rounded-full bg-dz-soft px-2 py-0.5 text-[10px] font-bold text-dz-orange">/mock/generate-user</span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 rounded-md bg-[#fff7ed] p-1">
              {(["new", "regular"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setUserForm((prev) => ({ ...prev, user_type: type }))}
                  className={cn(
                    "rounded px-2 py-1.5 text-[11px] font-black transition",
                    userForm.user_type === type
                      ? "bg-white text-dz-orange shadow-sm"
                      : "text-neutral-500 hover:text-dz-ink"
                  )}
                >
                  {type === "new" ? "新用户" : "常规用户"}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="font-bold text-neutral-500">城市</span>
              <input
                type="text"
                value={userForm.city ?? ""}
                onChange={(event) => setUserForm((prev) => ({ ...prev, city: event.target.value }))}
                className="mt-1 w-full rounded-md border border-dz-line bg-[#fffdf8] px-2 py-1.5 text-xs focus:border-dz-orange focus:outline-none"
                placeholder="北京"
              />
            </label>
            <label className="block">
              <span className="font-bold text-neutral-500">自然语言定制</span>
              <textarea
                value={mockCustomization}
                onChange={(event) => setMockCustomization(event.target.value)}
                rows={3}
                className="mt-1 w-full resize-none rounded-md border border-dz-line bg-[#fffdf8] px-2 py-1.5 text-xs leading-5 focus:border-dz-orange focus:outline-none"
                placeholder="比如：不喜欢排队、预算人均 150、喜欢安静聊天"
              />
            </label>
            <button
              type="button"
              onClick={handleGenerateUser}
              disabled={userLoading}
              className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-dz-orange px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#e25a32] disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {userLoading ? "生成中..." : "生成真实结构用户"}
            </button>
            <p className="text-[11px] leading-5 text-neutral-400">
              生成后会自动应用为活跃用户；新用户没有历史行为，老用户会带偏好、历史收藏、评分和 UGC。
            </p>
            {userError ? <p className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-600">{userError}</p> : null}
          </div>

          {userResponse ? (
            <div className="mt-3 space-y-2">
              <ResponseMetaCard response={userResponse} kind="user" />
              <div className="space-y-2">
                {userResponse.users.map((item) => (
                  <article key={item.id} className="rounded-md border border-dz-line bg-[#fffdf8] p-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] text-dz-orange">{item.id}</div>
                        <div className="mt-0.5 font-black">{item.name}</div>
                        <p className="mt-1 text-neutral-600">{item.scenario}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          applyGeneratedUser(item);
                          setActiveUserId(item.id);
                        }}
                        className="shrink-0 rounded-full border border-dz-orange bg-white px-2 py-1 text-[10px] font-bold text-dz-orange hover:bg-dz-soft"
                      >
                        应用为活跃用户
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.preferences.map((pref) => (
                        <span key={pref} className="rounded-full bg-white px-2 py-0.5 text-[10px] text-dz-orange">
                          {pref}
                        </span>
                      ))}
                    </div>
                    {item.priority_weights && Object.keys(item.priority_weights).length ? (
                      <p className="mt-2 font-mono text-[10px] text-neutral-500">
                        priority_weights: {JSON.stringify(item.priority_weights)}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* AI POI 数据生成器 */}
        <div className="rounded-md border border-dz-line bg-white p-5">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-dz-orange" />
            <h4 className="text-sm font-black">生成 AI POI 数据</h4>
            <span className="ml-auto rounded-full bg-dz-soft px-2 py-0.5 text-[10px] font-bold text-dz-orange">/mock/generate-pois</span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="font-bold text-neutral-500">城市</span>
                <input
                  type="text"
                  value={poiForm.city ?? ""}
                  onChange={(event) => setPoiForm((prev) => ({ ...prev, city: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-dz-line bg-[#fffdf8] px-2 py-1.5 text-xs focus:border-dz-orange focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="font-bold text-neutral-500">区域</span>
                <input
                  type="text"
                  value={poiForm.area ?? ""}
                  onChange={(event) => setPoiForm((prev) => ({ ...prev, area: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-dz-line bg-[#fffdf8] px-2 py-1.5 text-xs focus:border-dz-orange focus:outline-none"
                />
              </label>
            </div>
            <label className="block">
              <span className="font-bold text-neutral-500">自然语言定制（可选）</span>
              <input
                type="text"
                value={poiForm.customization ?? mockCustomization}
                onChange={(event) => setPoiForm((prev) => ({ ...prev, customization: event.target.value }))}
                className="mt-1 w-full rounded-md border border-dz-line bg-[#fffdf8] px-2 py-1.5 text-xs focus:border-dz-orange focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="font-bold text-neutral-500">数量（3-100）</span>
              <input
                type="number"
                min={3}
                max={100}
                value={poiForm.count ?? 6}
                onChange={(event) => setPoiForm((prev) => ({ ...prev, count: Number(event.target.value) }))}
                className="mt-1 w-full rounded-md border border-dz-line bg-[#fffdf8] px-2 py-1.5 text-xs focus:border-dz-orange focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={handleGeneratePois}
              disabled={poiLoading}
              className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-dz-orange px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#e25a32] disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {poiLoading ? "生成中..." : "调 MockDataAgent 生成"}
            </button>
            {poiError ? <p className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-600">{poiError}</p> : null}
          </div>

          {poiResponse ? (
            <div className="mt-3 space-y-2">
              <ResponseMetaCard response={poiResponse} kind="poi" />
              <div className="space-y-2">
                {poiResponse.pois.map((poi) => {
                  const inApplied = appliedMockPois.some((item) => item.id === poi.id);
                  return (
                    <article key={poi.id} className="rounded-md border border-dz-line bg-[#fffdf8] p-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] text-dz-orange">{poi.id}</div>
                          <div className="mt-0.5 font-black">{poi.name}</div>
                          <p className="mt-1 text-neutral-500">
                            {poi.area} · {poi.category} · {poi.rating} 分 · 排队 {poi.queueMinutes} 分钟
                          </p>
                          {poi.address ? <p className="mt-0.5 text-[10px] text-neutral-400">{poi.address}</p> : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => applyGeneratedPoi(poi)}
                          disabled={inApplied}
                          className={cn(
                            "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold transition",
                            inApplied
                              ? "border border-dz-line bg-white text-neutral-400"
                              : "border border-dz-orange bg-white text-dz-orange hover:bg-dz-soft"
                          )}
                        >
                          {inApplied ? "已加入候选池" : "加入候选池"}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {poi.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[10px] text-dz-orange">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* 地理位置设置 */}
        <div className="rounded-md border border-dz-line bg-white p-5">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-dz-orange" />
            <h4 className="text-sm font-black">地理位置设置</h4>
            <span className="ml-auto rounded-full bg-dz-soft px-2 py-0.5 text-[10px] font-bold text-dz-orange">全局位置</span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="font-bold text-neutral-500">城市</span>
                <input
                  type="text"
                  value={locationDraft.city}
                  onChange={(event) => setLocationDraft((prev) => ({ ...prev, city: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-dz-line bg-[#fffdf8] px-2 py-1.5 text-xs focus:border-dz-orange focus:outline-none"
                  placeholder="北京"
                />
              </label>
              <label className="block">
                <span className="font-bold text-neutral-500">区域</span>
                <input
                  type="text"
                  value={locationDraft.area}
                  onChange={(event) => setLocationDraft((prev) => ({ ...prev, area: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-dz-line bg-[#fffdf8] px-2 py-1.5 text-xs focus:border-dz-orange focus:outline-none"
                  placeholder="三里屯"
                />
              </label>
            </div>
            <label className="block">
              <span className="font-bold text-neutral-500">详细位置</span>
              <input
                type="text"
                value={locationDraft.address}
                onChange={(event) => setLocationDraft((prev) => ({ ...prev, address: event.target.value }))}
                className="mt-1 w-full rounded-md border border-dz-line bg-[#fffdf8] px-2 py-1.5 text-xs focus:border-dz-orange focus:outline-none"
                placeholder="可选，如太古里北区"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={applyManualLocation}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-dz-orange bg-white px-3 py-2 text-xs font-black text-dz-orange transition hover:bg-dz-soft"
              >
                <MapPin className="h-3.5 w-3.5" />
                应用位置
              </button>
              <button
                type="button"
                onClick={applyRandomLocation}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-dz-orange px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#e25a32]"
              >
                <Shuffle className="h-3.5 w-3.5" />
                随机中国位置
              </button>
            </div>
          </div>

          {activeMockLocation ? (
            <article className="mt-3 rounded-md border border-dz-line bg-[#fffdf8] p-3 text-xs leading-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-black">{activeMockLocation.label}</div>
                  <div className="mt-0.5 text-neutral-500">
                    {activeMockLocation.city}
                    {activeMockLocation.area ? ` · ${activeMockLocation.area}` : ""}
                  </div>
                  {activeMockLocation.address ? <div className="text-[10px] text-neutral-400">{activeMockLocation.address}</div> : null}
                </div>
                <span className="rounded-full bg-dz-soft px-2 py-0.5 text-[10px] font-bold text-dz-orange">
                  {activeMockLocation.source === "random" ? "随机" : "手动"}
                </span>
              </div>
              {typeof activeMockLocation.latitude === "number" && typeof activeMockLocation.longitude === "number" ? (
                <div className="mt-2 font-mono text-[10px] text-neutral-500">
                  {activeMockLocation.latitude.toFixed(4)}, {activeMockLocation.longitude.toFixed(4)}
                </div>
              ) : null}
            </article>
          ) : (
            <p className="mt-3 rounded-md bg-[#fffdf8] px-3 py-2 text-xs leading-5 text-neutral-500">
              尚未设置地理位置；未设置时后端仍使用请求默认城市。
            </p>
          )}
        </div>
      </section>

      {/* 链路口径提示 */}
      <section className="mt-4 rounded-md border border-dz-line bg-[#171717] p-4 text-xs leading-5 text-white">
        <div className="font-black">MockDataAgent 链路</div>
        <p className="mt-1 text-white/70">
          演示者输入生成要求 → LongCat 生成 ai_generated_dataset → Pydantic 校验 → 数据进入正式演示 API → Agent 真实判断。
          长 / 复杂生成会进入长 LLM 任务；
          {hasActiveRun
            ? `当前 provider = ${mapSnapshot.provider} · 坐标置信度 = ${mapSnapshot.coordinateConfidence}。`
            : "等待首次 Run 后再展示当前链路用到的数据源字段。"}
        </p>
        {generatedMockUsers.length || generatedMockPois.length || generatedMockLocations.length ? (
          <p className="mt-2 text-white/55">
            最近一次生成 {generatedMockUsers.length} 个用户 / {generatedMockPois.length} 个 POI / {generatedMockLocations.length} 个位置。
          </p>
        ) : null}
      </section>

      <div ref={mockBoardRef}>
        <MockDataBoard
          users={mergedUsers.length ? mergedUsers : generatedMockUsers}
          pois={mergedPois.length ? mergedPois : generatedMockPois}
          location={activeMockLocation}
          userResponse={userResponse}
          poiResponse={poiResponse}
          activeTab={mockBoardTab}
          expanded={mockBoardExpanded}
          onTabChange={setMockBoardTab}
          onExpandedChange={setMockBoardExpanded}
        />
      </div>

      {shouldShowRunMockData ? (
        <>
          {/* 当前 run 用到的 Mock 字段 */}
          {mockFieldsFromTrace.length > 0 && (
            <section className="mt-5 rounded-md border-2 border-yellow-400 bg-yellow-50/50 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-yellow-800">当前 run 用到的 AI 生成数据 / Fallback 字段</h4>
                  <p className="mt-1 text-xs leading-5 text-yellow-700">
                    AI 生成且校验通过的数据是正式输入；只有 fallback 字段需要关注降级原因。
                  </p>
                </div>
                <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-700">{mockFieldsFromTrace.length} 项</span>
              </div>
              <div className="space-y-2">
                {mockFieldsFromTrace.map((item, index) => (
                  <div key={index} className="rounded-md border border-yellow-300 bg-white px-3 py-2 text-xs leading-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-dz-ink">{item.eventLabel}</span>
                      <span className="font-mono text-[10px] text-yellow-700">{item.field}</span>
                    </div>
                    <p className="mt-1 text-neutral-600">{item.reason}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-md border border-dz-line bg-white p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black">当前 run / 已应用 AI 用户</h4>
                <span className="rounded-full bg-dz-soft px-2 py-0.5 text-[10px] font-bold text-dz-orange">{mergedUsers.length} users</span>
              </div>
              <div className="mt-3 space-y-2">
                {mergedUsers.length ? (
                  mergedUsers.map((item) => (
                    <div key={item.id} className="rounded-md bg-[#fffdf8] px-3 py-2 text-xs leading-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{item.name}</span>
                        <span className="rounded-full bg-dz-soft px-2 py-0.5 text-[10px] font-bold text-dz-orange">已应用</span>
                      </div>
                      <div className="text-neutral-500">{item.scenario}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.preferences.map((preference) => (
                          <span key={preference} className="rounded-full bg-white px-2 py-0.5 text-[10px] text-dz-orange">
                            {preference}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md bg-[#fffdf8] px-3 py-2 text-xs leading-5 text-neutral-500">
                    当前 run 没有展示完整 AI 用户数据；只展示 Trace 中实际命中的偏好和 fallback 字段。
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-md border border-dz-line bg-white p-5">
              <h4 className="text-sm font-black">当前 run 偏好与位置</h4>
              <div className="mt-3 space-y-2">
                {activeMockLocation ? (
                  <div className="rounded-md bg-[#fffdf8] px-3 py-2 text-xs leading-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{activeMockLocation.label}</span>
                      <span className="rounded-full bg-dz-soft px-2 py-0.5 text-[10px] font-bold text-dz-orange">已应用位置</span>
                    </div>
                    <div className="text-neutral-500">
                      {activeMockLocation.city}
                      {activeMockLocation.area ? ` · ${activeMockLocation.area}` : ""}
                      {activeMockLocation.address ? ` · ${activeMockLocation.address}` : ""}
                    </div>
                  </div>
                ) : null}
                {preferences.length ? (
                  preferences.map((preference) => (
                    <div key={preference.id} className="rounded-md bg-[#fffdf8] px-3 py-2 text-xs leading-5">
                      <div className="font-bold">{preference.label}</div>
                      <div className="text-neutral-500">
                        {preference.source}
                        {typeof preference.confidence === "number" ? ` · ${Math.round(preference.confidence * 100)}%` : ""}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md bg-[#fffdf8] px-3 py-2 text-xs leading-5 text-neutral-500">
                    本轮还没有从后端返回可展示的用户偏好档案。
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-md border border-dz-line bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black">当前 run 用到的 AI 生成 POI / UGC</h4>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  这里只展示本轮方案、fallback 或生成器应用过的数据，不展示全量基础数据池。
                </p>
              </div>
              <span className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">
                {isChatRun ? "chat run" : `${mergedPois.length} applied / ${plans.length} plans`}
              </span>
            </div>

            <div className="grid grid-cols-[1fr_1.2fr] gap-4">
              <div className="space-y-2">
                {mergedPois.length ? (
                  mergedPois.map((poi) => (
                    <div key={poi.id} className="rounded-md border border-dz-line bg-[#fffdf8] px-3 py-2 text-xs leading-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black">{poi.name}</span>
                        <span className="font-mono text-neutral-500">{poi.id}</span>
                      </div>
                      <div className="mt-1 text-neutral-500">
                        {poi.area} · {poi.category} · {poi.rating} 分 · 排队 {poi.queueMinutes} 分钟
                        <span className="ml-2 rounded-full bg-dz-soft px-1.5 py-0.5 text-[10px] font-bold text-dz-orange">已应用</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dz-line bg-[#fffdf8] px-3 py-2 text-xs leading-5 text-neutral-500">
                    没有手动应用的 AI 生成 POI；如果当前 run 使用了 fallback，可在右侧 UGC/方案摘要中查看用到的站点。
                  </p>
                )}
              </div>
              <div className="space-y-2">
                {ugcRows.length ? (
                  ugcRows.slice(0, 6).map((row) => (
                    <div key={row.id} className="rounded-md border border-dz-line bg-[#fffdf8] px-3 py-2 text-xs leading-5">
                      <div className="font-bold">{row.poiName}</div>
                      <div className="text-neutral-500">{row.planTitle}</div>
                      <p className="mt-1 text-neutral-700">{row.summary}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dz-line bg-[#fffdf8] px-3 py-2 text-xs leading-5 text-neutral-500">
                    当前还没有方案 stop 摘要。
                  </p>
                )}
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="mt-5 rounded-md border border-dz-line bg-white p-5">
          <h4 className="text-sm font-black">等待首次 Run</h4>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            首屏不展示基础用户池或 POI 池。开始一次规划、触发 fallback，或在上方生成并应用 AI 生成数据后，这里才会显示当前 run 用到的数据内容。
          </p>
        </section>
      )}
    </>
  );
}

function ResponseMetaCard({ response, kind }: { response: GeneratedMockResponse; kind: "user" | "poi" }) {
  const providerCall = isRecord(response.metadata.provider_call) ? response.metadata.provider_call : null;
  const validation = typeof response.metadata.validation === "string" ? response.metadata.validation : null;
  const validationError = typeof response.metadata.validation_error === "string" ? response.metadata.validation_error : null;
  const note = typeof response.metadata.note === "string" ? response.metadata.note : null;
  const geocodeReports = Array.isArray(response.metadata.geocode_reports) ? response.metadata.geocode_reports : [];
  const totalCount = kind === "user" ? response.users.length : response.pois.length;

  return (
    <div className="rounded-md border border-dz-line bg-white px-3 py-2 text-[11px] leading-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold",
            response.fallback_used ? "bg-yellow-50 text-yellow-700" : "bg-green-50 text-green-700"
          )}
        >
          {response.fallback_used ? "fallback_used" : "ai_generated_dataset"}
        </span>
        <span className="rounded-full bg-dz-soft px-2 py-0.5 text-[10px] font-bold text-dz-orange">{response.source}</span>
        <span className="text-neutral-500">{totalCount} 项</span>
        {validation ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{validation}</span>
        ) : null}
        {validationError ? (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">validation_error</span>
        ) : null}
      </div>
      {providerCall ? (
        <p className="mt-1 font-mono text-[10px] text-neutral-500">
          provider_call keys: {Object.keys(providerCall).join(", ") || "—"}
        </p>
      ) : null}
      {validationError ? <p className="mt-1 text-[10px] text-red-600">{validationError}</p> : null}
      {geocodeReports.length ? (
        <p className="mt-1 text-[10px] text-neutral-500">geocode_reports: {geocodeReports.length} 项地图校验报告</p>
      ) : null}
      {note ? <p className="mt-1 text-[10px] text-neutral-500">{note}</p> : null}
    </div>
  );
}

function MockDataBoard({
  users,
  pois,
  location,
  userResponse,
  poiResponse,
  activeTab,
  expanded,
  onTabChange,
  onExpandedChange
}: {
  users: MockUserFull[];
  pois: MockPoi[];
  location?: MockLocation;
  userResponse: GeneratedMockResponse | null;
  poiResponse: GeneratedMockResponse | null;
  activeTab: "user" | "location" | "pois" | "history" | "json";
  expanded: boolean;
  onTabChange: (tab: "user" | "location" | "pois" | "history" | "json") => void;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const board = (
    <section className={cn("rounded-md border border-dz-line bg-white p-5", expanded && "fixed inset-5 z-[100] overflow-hidden shadow-2xl")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-black">AI 生成数据看板</h4>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            查看当前生成或已应用的真实结构用户、定位、POI、历史行为和原始 JSON。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            className="rounded-full border border-dz-line bg-white px-3 py-1.5 text-xs font-bold text-neutral-600 hover:border-dz-orange hover:text-dz-orange"
          >
            {expanded ? "收起" : "展开"}
          </button>
          {expanded ? (
            <button
              type="button"
              onClick={() => onExpandedChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-dz-line bg-white text-neutral-500 hover:border-dz-orange hover:text-dz-orange"
              aria-label="关闭 AI 生成数据看板"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1 rounded-md bg-[#fbfaf7] p-1">
        {([
          ["user", "用户"],
          ["location", "当前位置"],
          ["pois", `POI ${pois.length}`],
          ["history", "历史/UGC"],
          ["json", "JSON"],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[11px] font-bold transition",
              activeTab === tab ? "bg-white text-dz-orange shadow-sm" : "text-neutral-500 hover:text-dz-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={cn("mt-4 overflow-y-auto [scrollbar-width:thin]", expanded ? "h-[calc(100vh-190px)]" : "max-h-[520px]")}>
        {activeTab === "user" && <MockBoardUsers users={users} />}
        {activeTab === "location" && <MockBoardLocation location={location} />}
        {activeTab === "pois" && <MockBoardPois pois={pois} />}
        {activeTab === "history" && <MockBoardHistory users={users} />}
        {activeTab === "json" && (
          <pre className="rounded-md bg-[#171717] p-4 text-[11px] leading-5 text-[#d8f8d8]">
            {JSON.stringify({ users, location, pois, userResponse, poiResponse }, null, 2)}
          </pre>
        )}
      </div>
    </section>
  );

  if (expanded && typeof document !== "undefined") {
    return createPortal(
      <div className="fixed inset-0 z-[99] bg-black/20 p-0 backdrop-blur-sm">{board}</div>,
      document.body
    );
  }
  return <div className="mt-5">{board}</div>;
}

function MockBoardUsers({ users }: { users: MockUserFull[] }) {
  if (!users.length) {
    return <p className="rounded-md bg-[#fffdf8] p-4 text-sm text-neutral-500">尚未生成 AI 用户数据。</p>;
  }
  return (
    <div className="space-y-3">
      {users.map((user) => (
        <article key={user.id} className="rounded-md border border-dz-line bg-[#fffdf8] p-4 text-xs leading-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] font-black text-dz-orange">{user.id}</div>
              <h5 className="mt-1 text-sm font-black">{user.name}</h5>
              <p className="mt-1 text-neutral-600">{user.scenario}</p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-neutral-500">
              {user.user_type === "new" ? "新用户" : "老用户"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <MiniField label="性别" value={user.gender ?? "未设置"} />
            <MiniField label="年龄" value={typeof user.age === "number" ? `${user.age}` : "未设置"} />
            <MiniField label="职业" value={user.occupation ?? "未设置"} />
            <MiniField label="预算" value={user.budget_per_person ? `¥${user.budget_per_person}/人` : "未设置"} />
          </div>
          <ChipRows title="偏好" items={user.preferences} />
          <ChipRows title="避雷" items={user.avoidances} tone="warning" />
          {user.history_summary ? <p className="mt-2 rounded-md bg-white px-3 py-2 text-neutral-600">{user.history_summary}</p> : null}
        </article>
      ))}
    </div>
  );
}

function MockBoardLocation({ location }: { location?: MockLocation }) {
  if (!location) {
    return <p className="rounded-md bg-[#fffdf8] p-4 text-sm text-neutral-500">尚未设置 AI 生成 GPS 定位。</p>;
  }
  return (
    <div className="rounded-md border border-dz-line bg-[#fffdf8] p-4 text-sm leading-6">
      <div className="font-black">{location.label}</div>
      <div className="text-neutral-600">{location.city}{location.area ? ` · ${location.area}` : ""}{location.address ? ` · ${location.address}` : ""}</div>
      <div className="mt-2 font-mono text-xs text-neutral-500">
        lat={location.latitude ?? "-"} / lng={location.longitude ?? "-"} / reliability={location.reliability}
      </div>
    </div>
  );
}

function MockBoardPois({ pois }: { pois: MockPoi[] }) {
  if (!pois.length) {
    return <p className="rounded-md bg-[#fffdf8] p-4 text-sm text-neutral-500">尚未生成 AI POI 数据。</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {pois.map((poi) => (
        <article key={poi.id} className="rounded-md border border-dz-line bg-[#fffdf8] p-3 text-xs leading-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-black">{poi.name}</div>
              <div className="mt-1 text-neutral-500">{poi.area} · {poi.category} · {poi.rating} 分 · 排队 {poi.queueMinutes} 分钟</div>
            </div>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-dz-orange">{poi.city ?? "AI 生成"}</span>
          </div>
          <ChipRows title="" items={poi.tags.slice(0, 5)} />
          {poi.ugcSummary ? <p className="mt-2 text-neutral-600">{poi.ugcSummary}</p> : null}
        </article>
      ))}
    </div>
  );
}

function MockBoardHistory({ users }: { users: MockUserFull[] }) {
  const user = users[0];
  if (!user) {
    return <p className="rounded-md bg-[#fffdf8] p-4 text-sm text-neutral-500">生成老用户后会展示历史收藏、浏览、评分和 UGC。</p>;
  }
  const rows = [
    ["历史收藏", user.saved_pois ?? []],
    ["浏览记录", user.viewed_pois ?? []],
    ["评分记录", user.rated_pois ?? []],
    ["UGC 评价", user.ugc_reviews ?? []],
  ] as const;
  return (
    <div className="space-y-3">
      {rows.map(([title, items]) => (
        <section key={title} className="rounded-md border border-dz-line bg-[#fffdf8] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h5 className="text-sm font-black">{title}</h5>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-500">{items.length} 条</span>
          </div>
          <div className="space-y-2">
            {items.length ? items.map((item, index) => (
              <pre key={index} className="overflow-auto rounded-md bg-white p-2 text-[11px] leading-5 text-neutral-700">
                {JSON.stringify(item, null, 2)}
              </pre>
            )) : <p className="text-xs text-neutral-500">新用户或空白画像没有该类历史。</p>}
          </div>
        </section>
      ))}
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <div className="text-[10px] font-bold text-neutral-400">{label}</div>
      <div className="mt-1 truncate font-bold text-neutral-700">{value}</div>
    </div>
  );
}

function ChipRows({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "warning" }) {
  if (!items.length) {
    return null;
  }
  return (
    <div className="mt-2">
      {title ? <div className="mb-1 text-[10px] font-bold text-neutral-400">{title}</div> : null}
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              tone === "warning" ? "bg-yellow-50 text-yellow-700" : "bg-white text-dz-orange"
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, caption }: { icon: LucideIcon; label: string; value: string; caption: string }) {
  return (
    <div className="rounded-md border border-dz-line p-4">
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <Icon className="h-4 w-4 text-dz-orange" />
        {label}
      </div>
      <div className="mt-2 truncate text-xl font-black">{value}</div>
      <div className="mt-1 truncate text-[11px] text-neutral-400">{caption}</div>
    </div>
  );
}

function Field({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-neutral-500">{label}</dt>
      <dd className={cn("mt-1", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-white p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 line-clamp-2 font-mono text-sm font-black">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-neutral-400">{sub}</div>}
    </div>
  );
}

function LatencyTimeline({ events, selectedTraceEventId }: { events: TraceEvent[]; selectedTraceEventId?: string }) {
  const maxDuration = Math.max(...events.map(eventDuration), 1);

  return (
    <section className="mt-5 rounded-md border border-dz-line bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Timer className="h-4 w-4 text-dz-orange" />
        <h4 className="text-sm font-black">Agent 时间线与模拟请求耗时</h4>
      </div>
      <div className="space-y-2">
        {events.map((event) => {
          const duration = eventDuration(event);
          return (
            <div key={event.id} className="grid grid-cols-[150px_1fr_70px] items-center gap-3 text-xs">
              <div className="truncate font-bold">{event.agent ?? event.type}</div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f1eee7]">
                <div
                  className={cn("h-full rounded-full", event.id === selectedTraceEventId ? "bg-dz-orange" : "bg-[#9bb3c7]")}
                  style={{ width: `${Math.max(8, Math.round((duration / maxDuration) * 100))}%` }}
                />
              </div>
              <div className="font-mono text-neutral-500">{duration}ms</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ToolList({
  title,
  icon: Icon,
  events,
  emptyText
}: {
  title: string;
  icon: LucideIcon;
  events: TraceEvent[];
  emptyText: string;
}) {
  return (
    <section className="rounded-md border border-dz-line bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-dz-orange" />
        <h4 className="text-sm font-black">{title}</h4>
      </div>
      {events.length ? (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-md bg-[#fffdf8] px-3 py-2 text-xs leading-5">
              <div className="font-mono font-black">{event.tool_name ?? event.label}</div>
              <div className="text-neutral-500">{event.summary}</div>
              {event.handoff_from && event.handoff_to && (
                <div className="mt-1 font-mono text-neutral-500">
                  {`${event.handoff_from} -> ${event.handoff_to}`}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-neutral-500">{emptyText}</p>
      )}
    </section>
  );
}

function CandidateList({ title, items }: { title: string; items: CandidateItem[] }) {
  return (
    <div>
      <h5 className="mb-3 text-xs font-black text-neutral-500">{title}</h5>
      <div className="space-y-2">
        {items.map((item) => (
          <article key={`${item.status}-${item.id}`} className="rounded-md border border-dz-line bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <h6 className="text-sm font-black">{item.name}</h6>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold",
                  item.status === "accepted" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}
              >
                {item.status}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">{item.meta}</p>
            <p className="mt-2 text-xs leading-5 text-neutral-700">{item.reason}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ConstraintList({ constraints }: { constraints: ConstraintItem[] }) {
  return (
    <section className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-dz-orange" />
        <h4 className="text-sm font-black">约束检查</h4>
      </div>
      <div className="space-y-2">
        {constraints.map((constraint) => (
          <div key={constraint.name} className="rounded-md bg-white px-3 py-2 text-xs leading-5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{constraint.name}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", constraintStatusClass(constraint.status))}>
                {constraint.status}
              </span>
            </div>
            <p className="mt-1 text-neutral-600">{constraint.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScoreBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown);
  const maxValue = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <div className="mt-4 grid grid-cols-5 gap-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md bg-white p-2">
          <div className="text-[11px] font-bold text-neutral-500">{scoreLabel(key)}</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f1eee7]">
            <div className="h-full rounded-full bg-dz-orange" style={{ width: `${Math.max(8, Math.round((value / maxValue) * 100))}%` }} />
          </div>
          <div className="mt-1 font-mono text-xs font-black">{value}</div>
        </div>
      ))}
    </div>
  );
}

function AgentStrategySection({ strategies, selectedAgent }: { strategies: AgentStrategy[]; selectedAgent?: string }) {
  return (
    <section className="mt-5 rounded-md border border-dz-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black">Agent Strategy</h4>
          <p className="mt-1 text-xs leading-5 text-neutral-500">后端声明的 Agent 顺序、职责、工具和交接条件。</p>
        </div>
        <span className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">{strategies.length} agents</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {strategies.map((strategy, index) => (
          <article
            key={strategy.name}
            className={cn(
              "grid grid-cols-[30px_1fr] gap-3 rounded-md border p-3",
              selectedAgent === strategy.name ? "border-dz-orange bg-dz-soft" : "border-dz-line bg-[#fffdf8]"
            )}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-dz-orange">
              {index + 1}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h5 className="font-mono text-sm font-black">{strategy.name}</h5>
                {strategy.tools.slice(0, 2).map((tool) => (
                  <span key={tool} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-neutral-500">
                    {tool}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-700">{strategy.responsibility}</p>
              <p className="mt-2 text-[11px] leading-5 text-neutral-500">
                交接条件：{strategy.handoff_conditions[0] ?? "完成本 Agent 输出后继续"}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TraceJsonView({ payload }: { payload: AgentTrace | null }) {
  const eventCount = payload?.events?.length ?? 0;

  return (
    <section className="rounded-md border border-dz-line bg-[#171717] p-4 text-white">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black">完整 JSON</h4>
          <p className="mt-1 text-xs leading-5 text-white/55">当前 activeTrace 的完整结构，不包含静态 fallback 或额外 debug 上下文。</p>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold text-white/70">{eventCount} events</span>
      </div>
      {payload ? (
        <pre className="max-h-[620px] overflow-auto rounded-md bg-black/55 p-4 text-[11px] leading-5 text-[#d8f8d8] [scrollbar-width:thin]">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : (
        <p className="rounded-md bg-black/30 px-4 py-5 text-sm text-white/50">没有 activeTrace 数据。</p>
      )}
    </section>
  );
}

function TraceHistoryView({
  traces,
  status,
  activeTraceId,
  onOpenTrace,
  onOpenMockTrace,
  onNewDemo
}: {
  traces: TraceSummary[];
  status: "idle" | "loading" | "error";
  activeTraceId?: string;
  onOpenTrace: (traceId: string) => void;
  onOpenMockTrace: (trace: AgentTrace) => void;
  onNewDemo: () => void;
}) {
  if (status === "loading") {
    return (
      <section className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-sm font-black">历史 Run</h4>
          <button
            type="button"
            onClick={onNewDemo}
            className="inline-flex items-center gap-1 rounded-full bg-dz-orange px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-[#e25a32]"
          >
            <Plus className="h-3.5 w-3.5" />
            新演示
          </button>
        </div>
        <p className="text-sm text-neutral-500">正在读取后端 Trace 列表...</p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <>
        <section className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-black">历史 Run</h4>
            <button
              type="button"
              onClick={onNewDemo}
              className="inline-flex items-center gap-1 rounded-full bg-dz-orange px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-[#e25a32]"
            >
              <Plus className="h-3.5 w-3.5" />
              新演示
            </button>
          </div>
          <p className="text-sm leading-6 text-neutral-500">Trace API 暂时不可用。下方仍可使用过往 Mock 历史快捷演示查看完整 Debug Trace。</p>
        </section>
        <MockHistoryQuickDemos activeTraceId={activeTraceId} onOpenMockTrace={onOpenMockTrace} />
      </>
    );
  }

  return (
    <section className="rounded-md border border-dz-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-black">历史 Run</h4>
          <p className="mt-1 text-xs leading-5 text-neutral-500">来自 `/traces` 的后端运行记录，点击可加载完整 Trace。</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">{traces.length} runs</span>
          <button
            type="button"
            onClick={onNewDemo}
            className="inline-flex items-center gap-1 rounded-full bg-dz-orange px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-[#e25a32]"
          >
            <Plus className="h-3.5 w-3.5" />
            新演示
          </button>
        </div>
      </div>
      {traces.length ? (
        <div className="space-y-3">
          {traces.map((trace) => (
            <button
              key={trace.id}
              onClick={() => onOpenTrace(trace.id)}
              className={cn(
                "w-full rounded-md border p-4 text-left transition",
                activeTraceId === trace.id ? "border-dz-orange bg-dz-soft" : "border-dz-line bg-[#fffdf8] hover:border-dz-orange"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs font-black text-dz-orange">{trace.id}</div>
                  <div className="mt-2 text-sm font-bold leading-6">{trace.user_goal}</div>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-neutral-500">{trace.status}</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-neutral-500">
                <span>{trace.runner_mode}</span>
                <span>{trace.event_count} events</span>
                <span>{trace.total_duration_ms}ms</span>
                <span>{trace.route_score ?? "-"} 分</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-[#fffdf8] px-4 py-5 text-sm leading-6 text-neutral-500">
          暂无历史 run。先在左侧手机端发送一次规划，后端保存 Trace 后这里会出现记录。
        </p>
      )}
      <MockHistoryQuickDemos activeTraceId={activeTraceId} onOpenMockTrace={onOpenMockTrace} />
    </section>
  );
}

function MockHistoryQuickDemos({
  activeTraceId,
  onOpenMockTrace
}: {
  activeTraceId?: string;
  onOpenMockTrace: (trace: AgentTrace) => void;
}) {
  const demos = useMemo(() => createMockHistoryTraces(), []);
  return (
    <section className="mt-5 rounded-md border border-dz-line bg-[#fffdf8] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-black">过往 Mock 历史快捷演示</h4>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            这 3 组是过往 Mock 的历史样例，可用来快捷演示完整 Debug Trace，不代表首屏真实 run。
          </p>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-dz-orange">3 mock runs</span>
      </div>
      <div className="grid gap-2">
        {demos.map((trace) => (
          <button
            key={trace.id}
            type="button"
            onClick={() => onOpenMockTrace(trace)}
            className={cn(
              "rounded-md border p-3 text-left transition",
              activeTraceId === trace.id ? "border-dz-orange bg-dz-soft" : "border-dz-line bg-white hover:border-dz-orange"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-xs font-black text-dz-orange">{trace.id}</div>
                <div className="mt-1 text-sm font-bold">{trace.user_goal}</div>
              </div>
              <span className="shrink-0 rounded-full bg-[#fbfaf7] px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                mock history
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-neutral-500">
              <span>{trace.events.length} events</span>
              <span>{trace.total_duration_ms}ms</span>
              <span>{trace.runner_mode}</span>
              <span>{trace.route_score ?? "-"} 分</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function createMockHistoryTraces(): AgentTrace[] {
  return [
    createMockHistoryTrace("mock-history-date-night", "今晚三里屯约会，想少排队", 92, "低排队和短距离移动同时命中，室内外搭配合理。"),
    createMockHistoryTrace("mock-history-family-weekend", "周末带老人孩子去颐和园附近", 88, "人数、天气和室内备选都已检查，步行强度适中。"),
    createMockHistoryTrace("mock-history-chat", "望京附近有什么好的日料店", 0, "普通问答链路，搜索到 13 家日料店并推荐 Top 5。", true),
  ];
}

function createMockHistoryTrace(id: string, goal: string, score: number, summary: string, chatRun = false): AgentTrace {
  const agents = [
    "InteractionRouterAgent",
    "ConstraintDiscoveryAgent",
    "UserPreferenceAgent",
    "ContextGroundingAgent",
    ...(chatRun ? ["PlanExplanationAgent"] : ["PlanSolverAgent", "PlanEvaluatorAgent", "PlanExplanationAgent"]),
  ];
  const events: TraceEvent[] = agents.map((agent, index) => {
    const typeByAgent: Record<string, TraceEvent["type"]> = {
      InteractionRouterAgent: "agent_started",
      ConstraintDiscoveryAgent: "constraint_discovered",
      UserPreferenceAgent: "preference_detected",
      ContextGroundingAgent: "candidate_retrieved",
      PlanSolverAgent: "route_candidate_generated",
      PlanEvaluatorAgent: "route_scored",
      PlanExplanationAgent: chatRun ? "chat_answered" : "run_completed",
    };
    return {
      id: `${id}-event-${index + 1}`,
      type: typeByAgent[agent],
      label: agent,
      agent,
      duration_ms: 120 + index * 45,
      summary: index === 0 ? summary : `${agent} 已完成 AI 生成历史回放步骤。`,
      output: {
        reliability: agent === "ContextGroundingAgent" ? "generated_validated" : "verified",
        observation: agent === "ContextGroundingAgent" ? "本样例使用过往 AI 生成真实结构 POI、UGC 和排队字段。" : undefined,
        plan_scores: agent === "PlanEvaluatorAgent" ? demoRoutePlans.map((plan) => ({ plan_id: plan.id, score: plan.score, rank_reason: plan.highlights[0], score_breakdown: { preference: 24, queue: 20, distance: 18, ugc: 16 } })) : undefined,
      },
      fallback_used: false,
      metadata: agent === "ContextGroundingAgent" ? { data_origin: chatRun ? "amap_api" : "ai_generated_dataset", provider_name: chatRun ? "amap_poi" : "mock_history_dataset" } : undefined,
      tool_name: agent === "ContextGroundingAgent" ? (chatRun ? "poi_search.nearby" : "poi_search.nearby") : undefined,
      tool_output: agent === "ContextGroundingAgent" ? {
        provider: chatRun ? "amap_poi" : "mock_history_dataset",
        data_origin: chatRun ? "amap_api" : "ai_generated_dataset",
        reliability: chatRun ? "api_validated" : "generated_validated",
        fallback_used: false,
        search_results_count: chatRun ? 13 : undefined,
        accepted_pois: chatRun ? [] : demoRoutePlans[0].stops.slice(0, 3).map((stop) => ({
          id: stop.poiId,
          name: stop.poiName,
          area: stop.area,
          rating: stop.rating,
          queueMinutes: stop.queueMinutes,
          reason: stop.reason,
        })),
        coordinate_confidence: "verified",
      } : undefined,
    };
  });
  return {
    id,
    user_goal: goal,
    status: "completed",
    total_duration_ms: events.reduce((sum, event) => sum + eventDuration(event), 0),
    route_score: score || undefined,
    runner_mode: "real_agent_ai_generated_data",
    agent_strategy: buildMockHistoryStrategies(),
    events,
    metadata: {
      mock_history: true,
      data_origin: "ai_generated_dataset",
      note: "过往 AI 生成数据历史快捷演示，用于查看完整 Debug Trace。",
    },
  };
}

function buildMockHistoryStrategies(): AgentStrategy[] {
  return [
    "InteractionRouterAgent",
    "ConstraintDiscoveryAgent",
    "UserPreferenceAgent",
    "ContextGroundingAgent",
    "PlanSolverAgent",
    "PlanEvaluatorAgent",
    "PlanExplanationAgent",
  ].map((name) => ({
    name,
    responsibility: agentResponsibility(name),
    inputs: ["mock history input"],
    outputs: ["mock history output"],
    tools: name === "ContextGroundingAgent" ? ["poi_search.nearby"] : [],
    handoff_conditions: ["完成后交给下一 Agent"],
    failure_fallback: "History 样例固定使用 Mock 数据，不调用真实 provider。",
    trace_events: ["agent_started" as const],
  }));
}

function agentResponsibility(name: string) {
  const copy: Record<string, string> = {
    InteractionRouterAgent: "判断用户输入类型和当前页面上下文。",
    ConstraintDiscoveryAgent: "拆解目标、硬约束、软约束和缺失信息。",
    UserPreferenceAgent: "读取用户长期偏好、历史行为和 Mock 画像。",
    ContextGroundingAgent: "调用 POI 搜索、地图距离、天气等 provider 补齐事实数据。",
    PlanSolverAgent: "生成多套候选路线。",
    PlanEvaluatorAgent: "检查约束并排序方案。",
    PlanExplanationAgent: "解释推荐理由、风险和 fallback 字段。",
  };
  return copy[name] ?? "Agent 历史回放节点。";
}

function buildAgentGroups(events: TraceEvent[], strategies: AgentStrategy[] = []): AgentEventGroup[] {
  const strategyByName = new Map(strategies.map((strategy) => [strategy.name, strategy]));
  const groups = new Map<string, AgentEventGroup>();

  const ensureGroup = (id: string, label: string, agentName?: string) => {
    const existing = groups.get(id);
    if (existing) {
      return existing;
    }
    const group: AgentEventGroup = {
      id,
      label,
      agentName,
      strategy: agentName ? strategyByName.get(agentName) : undefined,
      events: [],
      eventCount: 0,
      toolCount: 0,
      fallbackCount: 0,
      durationMs: 0
    };
    groups.set(id, group);
    return group;
  };

  for (const event of events) {
    const agentName = event.agent ?? event.handoff_from ?? event.handoff_to;
    const group = agentName
      ? ensureGroup(`agent:${agentName}`, agentName, agentName)
      : ensureGroup("system", "Run Lifecycle", "system");
    group.events.push(event);
    group.eventCount += 1;
    group.durationMs += eventDuration(event);
    if (event.tool_name) {
      group.toolCount += 1;
    }
    if (event.fallback_used) {
      group.fallbackCount += 1;
    }
  }

  const orderedGroups: AgentEventGroup[] = [];
  const systemGroup = groups.get("system");
  if (systemGroup?.events.length) {
    orderedGroups.push(systemGroup);
  }
  for (const strategy of strategies) {
    const group = groups.get(`agent:${strategy.name}`) ?? ensureGroup(`agent:${strategy.name}`, strategy.name, strategy.name);
    orderedGroups.push(group);
  }
  for (const group of groups.values()) {
    if (!orderedGroups.includes(group) && group.events.length) {
      orderedGroups.push(group);
    }
  }
  return orderedGroups;
}

function buildCandidateSnapshot(events: TraceEvent[], plans: DemoRoutePlan[]) {
  const retrievalEvent = events.find(
    (event) =>
      event.tool_output &&
      (hasArrayField(event.tool_output, "accepted_pois") ||
        hasArrayField(event.tool_output, "related_pois") ||
        hasArrayField(event.tool_output, "candidates"))
  );
  const output = retrievalEvent?.tool_output;
  const acceptedFromTrace = parseCandidateArray(getRecordValue(output, "accepted_pois"), "accepted");
  const relatedFromTrace = parseCandidateArray(getRecordValue(output, "related_pois"), "accepted");
  const candidatesFromTrace = parseCandidateArray(getRecordValue(output, "candidates"), "accepted");
  const rejectedFromTrace = [
    ...parseCandidateArray(getRecordValue(output, "rejected_pois"), "rejected"),
    ...parseCandidateArray(getRecordValue(output, "rejected"), "rejected")
  ];
  const accepted =
    acceptedFromTrace.length || relatedFromTrace.length || candidatesFromTrace.length
      ? [...acceptedFromTrace, ...relatedFromTrace, ...candidatesFromTrace]
      : acceptedCandidatesFromPlans(plans);
  const rejected = rejectedFromTrace.length ? rejectedFromTrace : [];
  const ugcHits = parseStringArray(getRecordValue(output, "ugc_hits"));

  return {
    accepted,
    rejected,
    ugcHits: ugcHits.length ? ugcHits : ugcHitsFromPlans(plans)
  };
}

function buildConstraintSnapshot(events: TraceEvent[], selectedPlan?: DemoRoutePlan): ConstraintItem[] {
  const constraintEvent = events.find((event) => event.type === "constraint_checked");
  const constraints = parseConstraints(getRecordValue(constraintEvent?.output, "constraints"));
  if (constraints.length) {
    return constraints;
  }

  const avgQueue = selectedPlan?.stops.length
    ? Math.round(selectedPlan.stops.reduce((sum, stop) => sum + stop.queueMinutes, 0) / selectedPlan.stops.length)
    : 5;

  return [
    { name: "营业时间", status: "pass", detail: "当前方案各站到达时段均通过营业时间校验。" },
    { name: "排队风险", status: avgQueue <= 10 ? "pass" : "warning", detail: `平均排队约 ${avgQueue} 分钟。` },
    { name: "预算", status: "pass", detail: "按人均 ¥100-200 的当前预算约束处理。" },
    { name: "移动距离", status: "pass", detail: "距离由地图 provider 统一计算，前端不自行估算。" }
  ];
}

function buildPlanScores(events: TraceEvent[], plans: DemoRoutePlan[]): PlanScoreSnapshot[] {
  const scoreEvent = events.find((event) => event.type === "route_scored");
  const scoreItems = parseScoreItems(getRecordValue(scoreEvent?.output, "plan_scores"));

  return plans.map((plan, index) => {
    const scoreItem = scoreItems.find((item) => item.planId === plan.id);
    return {
      planId: plan.id,
      title: plan.title,
      score: scoreItem?.score ?? plan.score,
      rankReason: scoreItem?.rankReason ?? fallbackRankReason(plan, index),
      breakdown: scoreItem?.breakdown ?? fallbackScoreBreakdown(plan)
    };
  });
}

function buildRejectedRoutes(events: TraceEvent[]): RejectedRouteSnapshot[] {
  const scoreEvent = events.find((event) => event.type === "route_scored");
  if (!scoreEvent?.output || !isRecord(scoreEvent.output)) {
    return [];
  }
  const rejectedRoutes = scoreEvent.output.rejected_routes;
  if (!Array.isArray(rejectedRoutes)) {
    return [];
  }
  return rejectedRoutes.map((item: unknown, index: number) => {
    const record = isRecord(item) ? item : {};
    return {
      routeId: stringValue(record.route_id) ?? stringValue(record.routeId) ?? `rejected-${index + 1}`,
      reason: stringValue(record.rejected_route_reason) ?? stringValue(record.reason) ?? "未提供淘汰原因。",
      score: numberValue(record.score) ?? 0,
    };
  });
}

function buildMapSnapshot(events: TraceEvent[], selectedPlan?: DemoRoutePlan): MapSnapshot {
  const mapEvent = events.find((event) => event.type === "map_context_resolved" || event.tool_name?.includes("route_matrix"));
  const output = mapEvent?.tool_output ?? mapEvent?.output;
  const legs = parseMapLegs(getRecordValue(output, "legs"));

  if (isRecord(output)) {
    return {
      provider: stringValue(output.provider) ?? "mock_map_provider",
      previewType: stringValue(output.preview_type) ?? "mock_vector",
      fallbackUsed: booleanValue(output.fallback_used) ?? false,
      coordinateConfidence: stringValue(output.coordinate_confidence) ?? "mocked",
      totalDistanceMeters: numberValue(output.total_distance_meters),
      totalDurationMinutes: numberValue(output.total_duration_minutes),
      legs: legs.length ? legs : fallbackMapLegs(selectedPlan),
      note: "这些数据来自 Trace 的 map_context_resolved/tool_output。"
    };
  }

  return {
    provider: "mock_map_provider",
    previewType: "mock_vector",
    fallbackUsed: false,
    coordinateConfidence: "mocked",
    totalDistanceMeters: selectedPlan ? selectedPlan.transports[0]?.minutes * 300 : undefined,
    totalDurationMinutes: selectedPlan?.transports[0]?.minutes,
    legs: fallbackMapLegs(selectedPlan),
    note: "当前 Trace 未返回地图字段，右侧用当前方案和本地 Mock 地图规则兜底。"
  };
}

function parseCandidateArray(value: unknown, status: CandidateItem["status"]): CandidateItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const record = isRecord(item) ? item : {};
    const poi = isRecord(record.poi) ? record.poi : record;
    const id = stringValue(poi.id) ?? stringValue(record.poi_id) ?? `${status}-${index + 1}`;
    const name = stringValue(poi.name) ?? stringValue(record.name) ?? stringValue(record.poi_name) ?? id;
    const queueMinutes = numberValue(poi.queue_minutes) ?? numberValue(poi.queueMinutes);
    const rating = numberValue(poi.rating);
    const area = stringValue(poi.area) ?? stringValue(record.area);
    const meta =
      stringValue(record.meta) ??
      [area, rating ? `${rating} 分` : undefined, typeof queueMinutes === "number" ? `排队 ${queueMinutes} 分钟` : undefined]
        .filter(Boolean)
        .join(" · ");
    return {
      id,
      name,
      meta: meta || "来自 Trace tool_output",
      reason: stringValue(record.reason) ?? "Trace 未提供详细理由，按当前候选状态展示。",
      status
    };
  });
}

function acceptedCandidatesFromPlans(plans: DemoRoutePlan[]): CandidateItem[] {
  const seen = new Set<string>();
  const items: CandidateItem[] = [];
  for (const plan of plans) {
    for (const stop of plan.stops) {
      if (seen.has(stop.poiId)) {
        continue;
      }
      seen.add(stop.poiId);
      items.push({
        id: stop.poiId,
        name: stop.poiName,
        meta: `${stop.area} · ${stop.rating} 分 · 排队 ${stop.queueMinutes} 分钟`,
        reason: stop.reason,
        status: "accepted"
      });
    }
  }
  return items;
}

function ugcHitsFromPlans(plans: DemoRoutePlan[]) {
  const hits = plans.flatMap((plan) => plan.stops.map((stop) => `${stop.poiName}：${stop.ugcSummary}`));
  return hits.length ? hits.slice(0, 5) : [];
}

function parseConstraints(value: unknown): ConstraintItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const record = isRecord(item) ? item : {};
    const rawStatus = stringValue(record.status);
    const satisfied = booleanValue(record.satisfied);
    return {
      name: stringValue(record.name) ?? stringValue(record.label) ?? stringValue(record.key) ?? `约束 ${index + 1}`,
      status:
        rawStatus === "warning" || rawStatus === "fail" || rawStatus === "pass"
          ? rawStatus
          : satisfied === false
            ? "fail"
            : "pass",
      detail: stringValue(record.detail) ?? "Trace 未提供详情。"
    };
  });
}

function parseScoreItems(value: unknown): PlanScoreSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const record = isRecord(item) ? item : {};
    return {
      planId: stringValue(record.plan_id) ?? stringValue(record.route_id) ?? "",
      title: stringValue(record.title) ?? stringValue(record.plan_id) ?? stringValue(record.route_id) ?? "方案",
      score: numberValue(record.score) ?? 0,
      rankReason: stringValue(record.rank_reason) ?? "Trace 未提供排序理由。",
      breakdown: parseNumberRecord(record.score_breakdown)
    };
  });
}

function parseMapLegs(value: unknown): MapLegSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const record = isRecord(item) ? item : {};
    return {
      origin: stringValue(record.origin_id) ?? `origin-${index + 1}`,
      destination: stringValue(record.destination_id) ?? `destination-${index + 1}`,
      distanceMeters: numberValue(record.distance_meters),
      durationMinutes: numberValue(record.duration_minutes),
      mode: stringValue(record.mode)
    };
  });
}

function fallbackMapLegs(selectedPlan?: DemoRoutePlan): MapLegSnapshot[] {
  if (!selectedPlan || selectedPlan.stops.length < 2) {
    return [
      { origin: "poi-001", destination: "poi-002", distanceMeters: 5600, durationMinutes: 18, mode: "taxi" },
      { origin: "poi-002", destination: "poi-003", distanceMeters: 3600, durationMinutes: 12, mode: "taxi" }
    ];
  }

  const averageMinutes = Math.max(6, Math.round((selectedPlan.transports[0]?.minutes ?? 24) / Math.max(selectedPlan.stops.length - 1, 1)));
  return selectedPlan.stops.slice(1).map((stop, index) => ({
    origin: selectedPlan.stops[index].poiId,
    destination: stop.poiId,
    distanceMeters: averageMinutes * 300,
    durationMinutes: averageMinutes,
    mode: selectedPlan.transports[0]?.mode ?? "taxi"
  }));
}

function fallbackRankReason(plan: DemoRoutePlan, index: number) {
  if (index === 0) {
    return "排队、移动距离和体验完整度最均衡，所以排在第一。";
  }
  if (plan.theme.includes("文艺") || plan.title.includes("文艺")) {
    return "拍照和展览体验更强，但移动时间略高。";
  }
  if (plan.theme.includes("舒适") || plan.title.includes("少走路")) {
    return "移动最省力，适合体力优先的用户。";
  }
  return plan.highlights[0] ?? "命中本轮偏好，作为备选方案保留。";
}

function fallbackScoreBreakdown(plan: DemoRoutePlan) {
  const avgQueue = plan.stops.length ? plan.stops.reduce((sum, stop) => sum + stop.queueMinutes, 0) / plan.stops.length : 8;
  return {
    preference: Math.max(12, Math.round(plan.score * 0.25)),
    queue: Math.max(10, 24 - Math.round(avgQueue)),
    distance: Math.max(10, Math.round(24 - plan.totalMinutes / 24)),
    budget: 14,
    ugc: Math.max(10, Math.round(plan.score * 0.16))
  };
}

function eventDuration(event: TraceEvent) {
  return event.durationMs ?? event.duration_ms ?? 0;
}

function summarizeTraceCost(events: TraceEvent[]) {
  return events.reduce(
    (summary, event) => {
      const detail = eventCostDetail(event);
      if (!detail) {
        return summary;
      }
      summary.billableEventCount += 1;
      summary.totalInputTokens += detail.inputTokens;
      summary.totalOutputTokens += detail.outputTokens;
      summary.totalTokens += detail.totalTokens;
      summary.totalCostCny += detail.estimatedCostCny;
      summary.totalModelDurationMs += detail.modelDurationMs;
      if (!summary.modelNames.includes(detail.modelName)) {
        summary.modelNames.push(detail.modelName);
      }
      return summary;
    },
    {
      billableEventCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCostCny: 0,
      totalModelDurationMs: 0,
      modelNames: [] as string[]
    }
  );
}

function eventCostDetail(event: TraceEvent) {
  const metadata = event.metadata;
  if (!metadata) {
    return null;
  }

  const modelName = typeof metadata.model_name === "string" ? metadata.model_name : undefined;
  const tokenUsage = metadata.token_usage && typeof metadata.token_usage === "object" ? (metadata.token_usage as Record<string, unknown>) : undefined;
  if (!modelName || !tokenUsage) {
    return null;
  }

  const inputTokens = numberFromUnknown(tokenUsage.input_tokens);
  const outputTokens = numberFromUnknown(tokenUsage.output_tokens);
  const totalTokens = numberFromUnknown(tokenUsage.total_tokens) || inputTokens + outputTokens;
  return {
    modelName,
    inputTokens,
    outputTokens,
    totalTokens,
    modelDurationMs: numberFromUnknown(metadata.model_duration_ms),
    estimatedCostCny: numberFromUnknown(metadata.estimated_cost_cny)
  };
}

function extractObservations(event: TraceEvent): string[] {
  const observations: string[] = [];
  if (event.output && typeof event.output === "object") {
    const output = event.output as Record<string, unknown>;
    if (output.grounded_sections && Array.isArray(output.grounded_sections)) {
      for (const section of output.grounded_sections as string[]) {
        observations.push(`已落地：${section}`);
      }
    }
    if (output.observation) {
      observations.push(String(output.observation));
    }
    if (output.reliability) {
      observations.push(`可靠性：${String(output.reliability)}`);
    }
  }
  if (event.tool_output && typeof event.tool_output === "object") {
    const toolOutput = event.tool_output as Record<string, unknown>;
    if (toolOutput.coordinate_confidence) {
      observations.push(`坐标置信度：${String(toolOutput.coordinate_confidence)}`);
    }
    if (toolOutput.fallback_used) {
      observations.push(`地图 provider 使用了 fallback。`);
    }
  }
  if (event.fallback_used) {
    observations.push("本步骤触发了 fallback，数据可靠性可能为 mocked。");
  }
  return observations;
}

// ─── LLM 请求/响应详情面板 ──────────────────────────────────────

function LlmCallDetail({
  llmRequest,
  llmResponse,
  metadata
}: {
  llmRequest: LlmRequestInfo;
  llmResponse?: LlmResponseInfo;
  metadata: TraceEventMetadata;
}) {
  const [showMessages, setShowMessages] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  return (
    <section className="mt-5 rounded-md border border-dz-line bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-dz-orange" />
        <h4 className="text-sm font-black">LLM 请求/响应详情</h4>
      </div>

      {/* 基本信息 */}
      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
        {llmRequest.model && <Field label="模型" value={llmRequest.model} mono />}
        {llmRequest.temperature != null && <Field label="Temperature" value={String(llmRequest.temperature)} mono />}
        {llmRequest.max_tokens != null && <Field label="Max Tokens" value={String(llmRequest.max_tokens)} mono />}
        {metadata.http_status_code != null && <Field label="HTTP 状态码" value={String(metadata.http_status_code)} mono />}
        {metadata.request_duration_ms != null && <Field label="请求耗时" value={`${metadata.request_duration_ms}ms`} mono />}
      </div>

      {/* 请求消息 */}
      {llmRequest.messages && llmRequest.messages.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowMessages(!showMessages)}
            className="flex items-center gap-1 text-xs font-bold text-dz-orange hover:underline"
          >
            <Shuffle className="h-3 w-3" />
            {showMessages ? "收起" : "展开"}请求消息 ({llmRequest.messages.length} 条)
          </button>
          {showMessages && (
            <div className="mt-2 space-y-2">
              {llmRequest.messages.map((msg, i) => (
                <div key={i} className="rounded-md border border-dz-line bg-[#fffdf8] p-3">
                  <span className={cn(
                    "mr-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
                    msg.role === "system" ? "bg-purple-50 text-purple-700" :
                    msg.role === "user" ? "bg-blue-50 text-blue-700" :
                    msg.role === "assistant" ? "bg-green-50 text-green-700" :
                    "bg-[#f1eee7] text-neutral-600"
                  )}>
                    {msg.role}
                  </span>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-neutral-700 [scrollbar-width:thin]">
                    {msg.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 响应内容 */}
      {llmResponse && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowResponse(!showResponse)}
            className="flex items-center gap-1 text-xs font-bold text-dz-orange hover:underline"
          >
            <Shuffle className="h-3 w-3" />
            {showResponse ? "收起" : "展开"}响应内容
          </button>
          {showResponse && (
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-[#171717] p-3 text-[11px] leading-5 text-[#d8f8d8] [scrollbar-width:thin]">
              {JSON.stringify(llmResponse, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Token 用量 */}
      {(llmResponse?.usage || metadata.token_usage) && (
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <MiniStat
            label="Input Tokens"
            value={String(llmResponse?.usage?.prompt_tokens ?? metadata.token_usage?.input_tokens ?? 0)}
          />
          <MiniStat
            label="Output Tokens"
            value={String(llmResponse?.usage?.completion_tokens ?? metadata.token_usage?.output_tokens ?? 0)}
          />
          <MiniStat
            label="Total Tokens"
            value={String(llmResponse?.usage?.total_tokens ?? metadata.token_usage?.total_tokens ?? 0)}
          />
        </div>
      )}
    </section>
  );
}

// ─── LLM Streaming 输出面板 ──────────────────────────────────────

function LlmStreamingPanel({ streamingTokens }: { streamingTokens: string }) {
  return (
    <section className="mt-5 rounded-md border border-dz-line bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-dz-orange" />
        <h4 className="text-sm font-black">LLM Streaming 输出</h4>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">streaming</span>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-[#171717] p-3 text-[11px] leading-5 text-[#d8f8d8] [scrollbar-width:thin]">
        {streamingTokens}
      </pre>
    </section>
  );
}

function getTraceDetail(event: TraceEvent) {
  const input = [
    ...formatPayload(event.input, "事件输入"),
    ...formatPayload(event.tool_input, "工具输入"),
    event.handoff_from && event.handoff_to ? `交接：${event.handoff_from} -> ${event.handoff_to}` : undefined
  ].filter(Boolean) as string[];

  const process = [
    event.agent ? `${event.agent} 负责本步骤。` : "系统级事件，负责推进本轮 run 状态。",
    event.tool_name ? `调用工具：${event.tool_name}。` : undefined,
    event.type === "handoff" ? "本事件记录 Agent 之间的上下文交接。" : undefined,
    event.fallback_used ? "本步骤使用了 provider 兜底逻辑，并在 Trace 中保留降级原因。" : undefined,
    event.metadata && Object.keys(event.metadata).length ? `调试元数据：${Object.keys(event.metadata).slice(0, 4).join("、")}。` : undefined
  ].filter(Boolean) as string[];

  const output = [...formatPayload(event.output, "事件输出"), ...formatPayload(event.tool_output, "工具输出")];

  return {
    input: input.length ? input : ["本事件没有额外输入字段。"],
    process: process.length ? process : [event.summary],
    output: output.length ? output : ["本事件没有额外输出字段。"]
  };
}

function formatPayload(payload: Record<string, unknown> | undefined, label: string) {
  if (!payload || Object.keys(payload).length === 0) {
    return [];
  }

  return Object.entries(payload)
    .slice(0, 5)
    .map(([key, value]) => `${label}.${key}: ${summarizeValue(value)}`);
}

function summarizeValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} 项 ${JSON.stringify(value.slice(0, 2))}`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).slice(0, 5);
    return `{ ${keys.join(", ")} }`;
  }
  return String(value);
}

function eventTypeClass(type: TraceEvent["type"]) {
  if (type === "tool_called" || type === "map_context_resolved" || type === "context_grounded") {
    return "bg-blue-50 text-blue-700";
  }
  if (type === "handoff") {
    return "bg-purple-50 text-purple-700";
  }
  if (type === "constraint_discovered" || type === "constraint_checked" || type === "route_scored" || type === "run_completed") {
    return "bg-green-50 text-green-700";
  }
  if (type === "run_failed") {
    return "bg-red-50 text-red-700";
  }
  return "bg-[#f1eee7] text-neutral-600";
}

// 已完成事件 = 左侧时间线已经有明确产出；只有 run_started / agent_started / run_failed / tool_called 不算完成态
function isEventCompleted(event: TraceEvent): boolean {
  if (event.type === "run_started" || event.type === "agent_started" || event.type === "run_failed") {
    return false;
  }
  if (event.type === "tool_called") {
    return false;
  }
  return true;
}

/** 判断 AgentEventGroup 的运行状态。
 *  - failed：group.events 中有 type === "run_failed"
 *  - running：group.agentName === activeAgentStep
 *  - completed：group.events 中有已完成事件（route_scored、constraint_checked、chat_answered 等）
 *  - pending：以上都不满足 */
function getAgentGroupStatus(
  group: AgentEventGroup,
  activeAgentStep: string | null
): "pending" | "running" | "completed" | "failed" {
  // 1. 有 run_failed → failed
  if (group.events.some((event) => event.type === "run_failed")) {
    return "failed";
  }

  // Run Lifecycle 特殊判断（group.id === "system"）
  if (group.id === "system") {
    if (group.events.some((event) => event.type === "run_completed")) {
      return "completed";
    }
    if (group.events.some((event) => event.type === "run_started")) {
      return "running";
    }
    return "pending";
  }

  // 2. 当前正在执行的 Agent → running
  if (group.agentName && group.agentName === activeAgentStep) {
    return "running";
  }

  // 3. 有已完成事件 → completed
  const completedTypes = new Set([
    "route_scored",
    "constraint_checked",
    "chat_answered",
    "route_candidate_generated",
    "requirements_summarized",
    "preference_detected",
    "context_grounded",
    "map_context_resolved",
    "run_completed",
    "clarification_requested",
    "handoff",
  ]);
  if (group.events.some((event) => completedTypes.has(event.type))) {
    return "completed";
  }

  // 4. 默认 → pending
  return "pending";
}

function constraintStatusClass(status: ConstraintItem["status"]) {
  if (status === "pass") {
    return "bg-green-50 text-green-700";
  }
  if (status === "warning") {
    return "bg-yellow-50 text-yellow-700";
  }
  return "bg-red-50 text-red-700";
}

function scoreLabel(key: string) {
  const labels: Record<string, string> = {
    hard_constraint: "硬约束",
    queue: "排队",
    business_hours: "营业时间",
    traffic: "交通",
    weather_fit: "天气适配",
    preference_fit: "偏好匹配",
    ugc_quality: "UGC",
    route_efficiency: "路线效率",
    budget: "预算",
    diversity: "多样性",
    // legacy keys kept for backward compatibility
    preference: "偏好",
    distance: "距离",
    ugc: "UGC",
    constraint: "约束",
    experience: "体验",
    rating: "评分",
    variant_delta: "变体差值",
  };
  return labels[key] ?? key;
}

function formatMeters(value?: number) {
  if (!value) {
    return "-";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}km`;
  }
  return `${value}m`;
}

function formatCost(costCny: number) {
  if (costCny > 0 && costCny < 0.0001) {
    return "<¥0.0001";
  }
  return `¥${costCny.toFixed(4)}`;
}

function parseNumberRecord(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, number>>((result, [key, item]) => {
    const number = numberValue(item);
    if (typeof number === "number") {
      result[key] = number;
    }
    return result;
  }, {});
}

function hasArrayField(record: Record<string, unknown>, field: string) {
  return Array.isArray(record[field]);
}

function getRecordValue(record: Record<string, unknown> | undefined, key: string) {
  return record?.[key];
}

function parseStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function numberFromUnknown(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// 把 mobileView 映射到当前最相关的 trace 事件
function pickEventForMobileView(events: TraceEvent[], view: string): TraceEvent | undefined {
  if (!events.length) {
    return undefined;
  }
  const findLast = (predicate: (event: TraceEvent) => boolean) => {
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (predicate(events[i])) {
        return events[i];
      }
    }
    return undefined;
  };

  switch (view) {
    case "entry":
    case "searching":
    case "start":
      return findLast((event) => event.type === "run_started") ?? events[0];
    case "running":
      return events[events.length - 1];
    case "clarifying":
      return (
        findLast((event) => event.type === "clarification_requested") ??
        findLast((event) => event.type === "constraint_discovered") ??
        events[events.length - 1]
      );
    case "summary":
      return (
        findLast((event) => event.type === "requirements_summarized") ??
        findLast((event) => event.type === "preference_detected") ??
        events[events.length - 1]
      );
    case "plans":
      return (
        findLast((event) => event.type === "route_scored") ??
        findLast((event) => event.type === "constraint_checked") ??
        findLast((event) => event.type === "route_candidate_generated") ??
        events[events.length - 1]
      );
    case "refining":
      return (
        findLast((event) => event.type === "user_refinement_received") ??
        findLast((event) => event.type === "tool_called") ??
        events[events.length - 1]
      );
    case "selected":
      return (
        findLast((event) => event.type === "run_completed") ??
        findLast((event) => event.type === "route_scored") ??
        events[events.length - 1]
      );
    case "answering":
      return findLast((event) => event.type === "chat_answered") ?? events[events.length - 1];
    default:
      return events[events.length - 1];
  }
}

type SubTab = "summary" | "candidates" | "ranking" | "map" | "json";

/** 根据当前选中的 Agent 名称，返回该 Agent 相关的子 Tab 列表。
 *  摘要和 JSON 始终展示；候选池、排序、地图按 Agent 职责决定。
 *  isChatRun 时排序和地图始终不展示。 */
function getRelevantSubTabs(agentName: string | undefined, isChatRun: boolean): SubTab[] {
  // 基础：摘要 + JSON 始终展示
  const tabs: SubTab[] = ["summary"];

  switch (agentName) {
    case "ContextGroundingAgent":
      tabs.push("candidates", "map");
      break;
    case "PlanSolverAgent":
      tabs.push("candidates");
      break;
    case "PlanEvaluatorAgent":
      tabs.push("candidates", "ranking");
      break;
    case "PlanExplanationAgent":
      tabs.push("ranking");
      break;
    // Run Lifecycle / InteractionRouterAgent / ConstraintDiscoveryAgent / UserPreferenceAgent
    // 只展示摘要 + JSON
    default:
      break;
  }

  // isChatRun 时排序和地图始终不展示
  if (isChatRun) {
    const filtered = tabs.filter((t) => t !== "ranking" && t !== "map");
    // 确保 JSON 在最后
    if (!filtered.includes("json")) {
      filtered.push("json");
    }
    return filtered;
  }

  tabs.push("json");
  return tabs;
}

// 不同 mobileView 下，右侧最值得看的子 Tab
// 只在 plans 时自动切到 ranking；其他场景不自动切换，保持用户当前选中的 subTab
function pickSubTabForMobileView(view: string): SubTab | null {
  switch (view) {
    case "plans":
      return "ranking";
    default:
      return null;
  }
}

/** 根据点击的 Agent 名称，返回应该跳转到的 mobileView。
 *  返回 null 表示不切换（如 Run Lifecycle）。 */
function getMobileViewForAgent(agentName: string | undefined): MobileShellView | null {
  switch (agentName) {
    case "InteractionRouterAgent":
      return "running";
    case "ConstraintDiscoveryAgent":
      return "clarifying";
    case "UserPreferenceAgent":
      return "running";
    case "ContextGroundingAgent":
      return "running";
    case "PlanSolverAgent":
      return "running";
    case "PlanEvaluatorAgent":
      return "plans";
    case "PlanExplanationAgent":
      return "plans";
    // Run Lifecycle 及其他：不切换
    default:
      return null;
  }
}

/** 根据点击的 Agent 名称，返回应该跳转到的 subTab。 */
function getSubTabForAgent(agentName: string | undefined): SubTab {
  switch (agentName) {
    case "ContextGroundingAgent":
      return "candidates";
    case "PlanSolverAgent":
      return "candidates";
    case "PlanEvaluatorAgent":
      return "ranking";
    // Run Lifecycle / InteractionRouterAgent / ConstraintDiscoveryAgent / UserPreferenceAgent / PlanExplanationAgent
    default:
      return "summary";
  }
}
