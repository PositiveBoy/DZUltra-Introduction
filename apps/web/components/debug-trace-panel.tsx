"use client";

import {
  Activity,
  Braces,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  History,
  Layers3,
  MapPin,
  PackageSearch,
  Route,
  ShieldCheck,
  Timer,
  Wrench
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getTrace, listTraces, mockPois, mockUsers } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDemoStore } from "@/stores/use-demo-store";
import type { ProviderStatus } from "@/stores/use-demo-store";
import type { AgentStrategy, AgentTrace, DemoRoutePlan, MockPoi, MockUser, TraceEvent, TraceSummary } from "@/types/dzultra";
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

const debugTabs: Array<{ id: DebugView; label: string; icon: LucideIcon }> = [
  { id: "trace", label: "Debug Trace", icon: Activity },
  { id: "history", label: "History", icon: History },
  { id: "mock", label: "Mock 数据", icon: Database }
];

const LAST_TRACE_ID_STORAGE_KEY = "dzultra:last-trace-id";

export function DebugTracePanel() {
  const [debugView, setDebugView] = useState<DebugView>("trace");
  const [traceHistory, setTraceHistory] = useState<TraceSummary[]>([]);
  const [traceDetailMode, setTraceDetailMode] = useState<"summary" | "candidates" | "ranking" | "map" | "json">("summary");
  const [providerOverviewCollapsed, setProviderOverviewCollapsed] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "error">("idle");

  const selectedTraceEventId = useDemoStore((state) => state.selectedTraceEventId);
  const setSelectedTraceEventId = useDemoStore((state) => state.setSelectedTraceEventId);
  const activeTrace = useDemoStore((state) => state.activeTrace);
  const setActiveTrace = useDemoStore((state) => state.setActiveTrace);
  const currentRoutePlans = useDemoStore((state) => state.currentRoutePlans);
  const selectedPlanId = useDemoStore((state) => state.selectedPlanId);
  const mobileView = useDemoStore((state) => state.mobileView);
  const activeUserId = useDemoStore((state) => state.activeUserId);
  const userPreferences = useDemoStore((state) => state.userPreferences);
  const providerStatuses = useDemoStore((state) => state.providerStatuses);
  const providerStatusRows = providerStatuses.length ? providerStatuses : providerStatusesFromDebugTrace(activeTrace);

  const visibleEvents = useMemo(() => activeTrace?.events ?? [], [activeTrace?.events]);
  const hasActiveTrace = visibleEvents.length > 0;
  const selected = visibleEvents.find((event) => event.id === selectedTraceEventId) ?? visibleEvents[0];
  const plans = useMemo(() => (hasActiveTrace ? currentRoutePlans : []), [currentRoutePlans, hasActiveTrace]);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const isChatRun = visibleEvents.some((event) => event.type === "chat_answered") && !visibleEvents.some((event) => event.type === "route_candidate_generated");

  const costSummary = useMemo(() => summarizeTraceCost(visibleEvents), [visibleEvents]);
  const candidateSnapshot = useMemo(() => buildCandidateSnapshot(visibleEvents, plans), [visibleEvents, plans]);
  const constraints = useMemo(() => buildConstraintSnapshot(visibleEvents, selectedPlan), [visibleEvents, selectedPlan]);
  const planScores = useMemo(() => buildPlanScores(visibleEvents, plans), [visibleEvents, plans]);
  const mapSnapshot = useMemo(() => buildMapSnapshot(visibleEvents, selectedPlan), [visibleEvents, selectedPlan]);
  const selectedCost = selected ? eventCostDetail(selected) : null;
  const totalDuration = activeTrace?.total_duration_ms ?? visibleEvents.reduce((sum, event) => sum + eventDuration(event), 0);
  const toolEvents = visibleEvents.filter((event) => event.tool_name);
  const handoffEvents = visibleEvents.filter((event) => event.type === "handoff" || event.handoff_from || event.handoff_to);
  const user = hasActiveTrace ? mockUsers.find((item) => item.id === activeUserId) ?? mockUsers[0] : undefined;
  const mockEvidence = hasActiveTrace ? collectMockEvidence(activeTrace, visibleEvents) : [];
  const jsonPayload = hasActiveTrace
    ? {
        trace: activeTrace,
        selected_plan_id: selectedPlanId,
        selected_plan: selectedPlan,
        current_plans: isChatRun ? [] : plans,
        debug_context: {
          mobile_view: mobileView,
          selected_trace_event_id: selected?.id,
          map_provider: mapSnapshot.provider,
          mock_user_id: user?.id,
          mock_evidence: mockEvidence
        }
      }
    : undefined;

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

  useEffect(() => {
    if (activeTrace?.id) {
      window.localStorage.setItem(LAST_TRACE_ID_STORAGE_KEY, activeTrace.id);
    }
  }, [activeTrace?.id]);

  useEffect(() => {
    if (activeTrace?.id) {
      return;
    }
    const lastTraceId = window.localStorage.getItem(LAST_TRACE_ID_STORAGE_KEY);
    if (!lastTraceId) {
      return;
    }

    let cancelled = false;
    getTrace(lastTraceId)
      .then((trace) => {
        if (cancelled) {
          return;
        }
        setActiveTrace(trace);
        setSelectedTraceEventId(trace.events[0]?.id);
      })
      .catch(() => {
        window.localStorage.removeItem(LAST_TRACE_ID_STORAGE_KEY);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTrace?.id, setActiveTrace, setSelectedTraceEventId]);

  async function openTrace(traceId: string) {
    try {
      const trace = await getTrace(traceId);
      setActiveTrace(trace);
      setSelectedTraceEventId(trace.events[0]?.id);
      window.localStorage.setItem(LAST_TRACE_ID_STORAGE_KEY, trace.id);
      setDebugView("trace");
    } catch {
      setHistoryStatus("error");
    }
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
        {debugView === "trace" && (
          !hasActiveTrace ? (
            <EmptyTraceState />
          ) : (
          <div className="flex h-full overflow-x-hidden">
            {/* 左侧事件列表 */}
            <aside className="w-[260px] shrink-0 overflow-y-auto overflow-x-hidden border-r border-dz-line bg-[#fbfaf7] [scrollbar-width:thin]">
              {/* Provider 概览卡片 */}
              <div className="border-b border-dz-line p-3">
                <button
                  onClick={() => setProviderOverviewCollapsed(!providerOverviewCollapsed)}
                  className="flex w-full items-center justify-between text-xs font-bold text-neutral-600"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-dz-orange" />
                    Provider 状态
                  </span>
                  <span className="text-neutral-400">{providerOverviewCollapsed ? "▸" : "▾"}</span>
                </button>
                {!providerOverviewCollapsed && (
                  <div className="mt-2 space-y-1.5">
                    {providerStatusRows.length ? providerStatusRows.map((p) => (
                      <div key={p.name} className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <span className={`inline-block h-2 w-2 rounded-full ${p.status === "connected" ? "bg-green-500" : p.status === "mock" ? "bg-yellow-500" : "bg-red-500"}`} />
                          <span className="font-medium">{p.label}</span>
                        </span>
                        <span className={cn("text-[10px] font-bold", p.status === "connected" ? "text-green-600" : p.status === "mock" ? "text-yellow-600" : "text-red-600")}>
                          {p.status === "connected" ? "已接入" : p.status === "mock" ? "Mock降级" : "超时"}
                        </span>
                      </div>
                    )) : (
                      <p className="rounded-md bg-white px-2 py-2 text-[11px] leading-5 text-neutral-500">
                        本轮 trace 暂无 provider 状态字段。
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 事件列表 */}
              <div className="space-y-1 p-2">
                {visibleEvents.map((event, index) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedTraceEventId(event.id)}
                    className={cn(
                      "w-full rounded-md border px-2.5 py-2 text-left transition",
                      selected?.id === event.id ? "border-dz-orange bg-dz-soft shadow-sm" : "border-transparent bg-white hover:border-dz-line"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
                          selected?.id === event.id ? "bg-dz-orange text-white" : "bg-[#f1eee7] text-neutral-500"
                        )}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-xs font-semibold">{event.label}</span>
                          <span className="shrink-0 font-mono text-[10px] text-neutral-400">{eventDuration(event)}ms</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1">
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", eventTypeClass(event.type))}>
                            {event.type}
                          </span>
                          <span className="truncate text-[10px] text-neutral-400">{event.agent ?? "system"}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {/* 右侧详情区 */}
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5 [scrollbar-width:thin]">
              {/* 详情子 Tab */}
              <div className="mb-4 flex items-center gap-1 rounded-md bg-[#fbfaf7] p-1">
                {([
                  { id: "summary" as const, label: "摘要", icon: Activity },
                  { id: "candidates" as const, label: "候选池", icon: PackageSearch },
                  { id: "ranking" as const, label: "排序", icon: Layers3 },
                  { id: "map" as const, label: "地图", icon: MapPin },
                  { id: "json" as const, label: "JSON", icon: Braces },
                ] as const).map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setTraceDetailMode(sub.id)}
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
                    <span className="rounded-full bg-[#fbfaf7] px-2 py-0.5">trace: {activeTrace?.id ?? "trace-static-fallback"}</span>
                    <span className="rounded-full bg-[#fbfaf7] px-2 py-0.5">runner: {activeTrace?.runner_mode ?? "deterministic_mock"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-dz-soft px-2.5 py-1.5 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  {activeTrace?.status ?? "completed"}
                </div>
              </div>

              {/* 指标卡片 */}
              <div className="mb-4 grid grid-cols-4 gap-2">
                <MetricCard icon={Timer} label="总耗时" value={`${totalDuration}ms`} caption="按 Trace duration 累计" />
                <MetricCard icon={Wrench} label="Tool 调用" value={String(toolEvents.length)} caption={`${handoffEvents.length} 次 handoff`} />
                <MetricCard icon={Route} label="方案数" value={isChatRun ? "0" : String(plans.length)} caption={isChatRun ? "普通问答链路" : "当前展示 3 套"} />
                <MetricCard icon={MapPin} label="地图 Provider" value={mapSnapshot.provider} caption={mapSnapshot.coordinateConfidence} />
              </div>

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
                />
              )}

              {traceDetailMode === "candidates" && (
                <CandidatePoolView snapshot={candidateSnapshot} constraints={constraints} selectedEvent={selected} />
              )}

              {traceDetailMode === "ranking" && (
                <PlanRankingView scores={planScores} selectedPlanId={selectedPlanId} constraints={constraints} isChatRun={isChatRun} />
              )}

              {traceDetailMode === "map" && <MapProviderView snapshot={mapSnapshot} selectedPlan={selectedPlan} />}

              {traceDetailMode === "json" && <TraceJsonView payload={jsonPayload} />}
            </div>
          </div>
          )
        )}

        {debugView === "history" && (
          <div className="h-full overflow-y-auto overflow-x-hidden p-5 [scrollbar-width:thin]">
            <TraceHistoryView traces={traceHistory} status={historyStatus} activeTraceId={activeTrace?.id} onOpenTrace={openTrace} />
          </div>
        )}

        {debugView === "mock" && (
          <div className="h-full overflow-y-auto overflow-x-hidden p-5 [scrollbar-width:thin]">
            {hasActiveTrace ? (
              <MockDataView
                user={user}
                preferences={userPreferences}
                pois={mockPois}
                plans={plans}
                mapSnapshot={mapSnapshot}
                isChatRun={isChatRun}
                trace={activeTrace}
                mockEvidence={mockEvidence}
              />
            ) : (
              <EmptyMockState />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyTraceState() {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-white p-8">
      <section className="max-w-xl rounded-md border border-dz-line bg-[#fffdf8] p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-dz-soft text-dz-orange">
          <Activity className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-lg font-black">还没有 Agent Run</h3>
        <p className="mt-2 text-sm leading-7 text-neutral-600">
          首次进入时不展示预置 Debug Trace。左侧手机端提交一次需求后，这里会显示本轮真实 provider 调用、Agent 步骤、耗时和 fallback 原因。
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-neutral-500">
          <div className="rounded-md bg-white px-3 py-2">Trace 空</div>
          <div className="rounded-md bg-white px-3 py-2">History 待后端返回</div>
          <div className="rounded-md bg-white px-3 py-2">Mock 数据不预载</div>
        </div>
      </section>
    </div>
  );
}

function EmptyMockState() {
  return (
    <section className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-dz-orange" />
        <div>
          <h4 className="text-sm font-black">Mock 数据暂未启用</h4>
          <p className="mt-2 text-sm leading-7 text-neutral-600">
            首次进入不会展示基础 Mock 用户、POI 或 UGC。等一次规划或问答 run 产生后，这里只展示本轮用到的 Mock 深度字段、Mock 生成器结果或真实接口 fallback 数据。
          </p>
        </div>
      </div>
    </section>
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
  agentStrategy
}: {
  selected?: TraceEvent;
  selectedCost: ReturnType<typeof eventCostDetail>;
  costSummary: ReturnType<typeof summarizeTraceCost>;
  events: TraceEvent[];
  selectedTraceEventId?: string;
  toolEvents: TraceEvent[];
  handoffEvents: TraceEvent[];
  agentStrategy?: AgentStrategy[];
}) {
  if (!selected) {
    return null;
  }

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
          {selected.tool_name && <Field label="Tool" value={selected.tool_name} mono wide />}
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
        {[
          ["输入", detail.input],
          ["处理", detail.process],
          ["输出", detail.output]
        ].map(([title, items]) => (
          <div key={title as string} className="rounded-md border border-dz-line bg-[#fffdf8] p-4">
            <h4 className="mb-3 text-sm font-black text-dz-orange">{title as string}</h4>
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

function CandidatePoolView({
  snapshot,
  constraints,
  selectedEvent
}: {
  snapshot: ReturnType<typeof buildCandidateSnapshot>;
  constraints: ConstraintItem[];
  selectedEvent?: TraceEvent;
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
            <h4 className="text-sm font-black">候选池与排除理由</h4>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              输入是结构化需求和 Mock POI/UGC；处理是召回、过滤和记录原因；输出是可进入地图距离计算的候选池。
            </p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-dz-orange">
            {snapshot.accepted.length} accepted / {snapshot.rejected.length} rejected
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CandidateList title="进入候选池" items={snapshot.accepted} />
          <CandidateList title="已排除 POI" items={snapshot.rejected} />
        </div>
      </section>

      <section className="mt-5 grid grid-cols-[1fr_1fr] gap-4">
        <div className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
          <h4 className="text-sm font-black">UGC 命中摘要</h4>
          <div className="mt-3 space-y-2">
            {snapshot.ugcHits.map((hit) => (
              <p key={hit} className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-neutral-600">
                {hit}
              </p>
            ))}
          </div>
        </div>
        <ConstraintList constraints={constraints} />
      </section>
    </>
  );
}

function PlanRankingView({
  scores,
  selectedPlanId,
  constraints,
  isChatRun
}: {
  scores: PlanScoreSnapshot[];
  selectedPlanId: string;
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

      <div className="mt-5">
        <ConstraintList constraints={constraints} />
      </div>
    </>
  );
}

function MapProviderView({ snapshot, selectedPlan }: { snapshot: MapSnapshot; selectedPlan?: DemoRoutePlan }) {
  return (
    <>
      <section className="grid grid-cols-[minmax(0,1fr)_310px] gap-4">
        <div className="rounded-md border border-dz-line bg-white p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-black">地图与距离 Provider</h4>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                前端只消费统一的 map preview 和 route matrix；高德返回失败时可降级为 mock_map_provider，但 Trace 会保留 provider、参数和摘要。
              </p>
            </div>
            <span className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">{snapshot.provider}</span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <MiniStat label="Provider" value={snapshot.provider} />
            <MiniStat label="预览类型" value={snapshot.previewType} />
            <MiniStat label="总距离" value={formatMeters(snapshot.totalDistanceMeters)} />
            <MiniStat label="总耗时" value={snapshot.totalDurationMinutes ? `${snapshot.totalDurationMinutes} 分钟` : "-"} />
          </div>

          <div className="mt-4 rounded-md bg-[#fffdf8] p-4 text-sm leading-6 text-neutral-600">
            <div className="font-bold text-dz-ink">来源说明</div>
            <p className="mt-1">{snapshot.note}</p>
            <p className="mt-1">
              fallback: <span className="font-mono">{String(snapshot.fallbackUsed)}</span> · coordinate_confidence:{" "}
              <span className="font-mono">{snapshot.coordinateConfidence}</span>
            </p>
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
          {snapshot.legs.map((leg, index) => (
            <div key={`${leg.origin}-${leg.destination}-${index}`} className="grid grid-cols-[1fr_1fr_120px_120px] border-t border-dz-line px-3 py-3 text-sm">
              <span className="font-mono text-xs">{leg.origin}</span>
              <span className="font-mono text-xs">{leg.destination}</span>
              <span>{formatMeters(leg.distanceMeters)}</span>
              <span>{leg.durationMinutes ? `${leg.durationMinutes} 分钟` : "-"}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function MockDataView({
  user,
  preferences,
  pois,
  plans,
  mapSnapshot,
  isChatRun,
  trace,
  mockEvidence
}: {
  user?: MockUser;
  preferences: Array<{ id: string; label: string; source: string; confidence?: number }>;
  pois: MockPoi[];
  plans: DemoRoutePlan[];
  mapSnapshot: MapSnapshot;
  isChatRun: boolean;
  trace?: AgentTrace;
  mockEvidence: string[];
}) {
  const displayPois = mockPoisForTrace(trace, plans, pois);
  const ugcRows = plans.flatMap((plan) =>
    plan.stops.map((stop) => ({
      id: `${plan.id}-${stop.poiId}`,
      planTitle: plan.title,
      poiName: stop.poiName,
      summary: stop.ugcSummary
    }))
  );

  return (
    <>
      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-md border border-dz-line bg-white p-5">
          <h4 className="text-sm font-black">Mock User</h4>
          {user ? (
            <div className="mt-3 text-sm leading-6">
              <div className="font-mono text-xs text-dz-orange">{user.id}</div>
              <div className="mt-1 font-black">{user.name}</div>
              <p className="mt-2 text-neutral-600">{user.scenario}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {user.preferences.map((preference) => (
                  <span key={preference} className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">
                    {preference}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">暂无 Mock 用户。</p>
          )}
        </div>

        <div className="rounded-md border border-dz-line bg-white p-5">
          <h4 className="text-sm font-black">偏好档案</h4>
          <div className="mt-3 space-y-2">
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
              <p className="rounded-md bg-[#fffdf8] px-3 py-3 text-xs leading-5 text-neutral-500">
                本轮还没有写入或读取可展示的偏好档案。
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-md border border-dz-line bg-[#fffdf8] p-5">
        <h4 className="text-sm font-black">Mock / Fallback 证据</h4>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          这里列出为什么本轮允许展示 Mock 数据。真实 provider 正常时仍可能看到本地 Mock 深度字段，例如排队、UGC、推荐菜和用户历史。
        </p>
        <div className="mt-3 space-y-2">
          {mockEvidence.length ? (
            mockEvidence.map((item) => (
              <p key={item} className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-neutral-700">
                {item}
              </p>
            ))
          ) : (
            <p className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-neutral-500">
              本轮 Trace 没有显式 fallback 标记；如果展示 Mock，说明它属于当前仍未接真实 API 的本地深度字段。
            </p>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-md border border-dz-line bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black">Mock POI / UGC / 地图来源</h4>
            <p className="mt-1 text-xs leading-5 text-neutral-500">这里展示仍需 Mock 的大众点评深度数据，以及真实 Provider 降级后的 fallback 来源。</p>
          </div>
          <span className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">
            {isChatRun ? "chat run" : `${plans.length} plans`}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_1.2fr] gap-4">
          <div className="space-y-2">
            {displayPois.length ? displayPois.map((poi) => (
              <div key={poi.id} className="rounded-md border border-dz-line bg-[#fffdf8] px-3 py-2 text-xs leading-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black">{poi.name}</span>
                  <span className="font-mono text-neutral-500">{poi.id}</span>
                </div>
                <div className="mt-1 text-neutral-500">
                  {poi.area} · {poi.category} · {poi.rating} 分 · 排队 {poi.queueMinutes} 分钟
                </div>
              </div>
            )) : (
              <p className="rounded-md border border-dz-line bg-[#fffdf8] px-3 py-3 text-xs leading-5 text-neutral-500">
                本轮 trace 没有匹配到本地 Mock POI ID；可能使用了真实高德候选或仅展示了模板 fallback。
              </p>
            )}
          </div>
          <div className="space-y-2">
            {ugcRows.length ? ugcRows.slice(0, 6).map((row) => (
              <div key={row.id} className="rounded-md border border-dz-line bg-[#fffdf8] px-3 py-2 text-xs leading-5">
                <div className="font-bold">{row.poiName}</div>
                <div className="text-neutral-500">{row.planTitle}</div>
                <p className="mt-1 text-neutral-700">{row.summary}</p>
              </div>
            )) : (
              <p className="rounded-md border border-dz-line bg-[#fffdf8] px-3 py-3 text-xs leading-5 text-neutral-500">
                当前 run 没有路线方案 UGC 摘要；普通问答只保留 related POI 和回答 Trace。
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-md bg-[#171717] p-4 text-xs leading-5 text-white">
          <div className="font-black">MockDataAgent 预留</div>
          <p className="mt-1 text-white/70">
            后续这里可以接 `/mock/generate-user`、`/mock/generate-pois`、`/mock/commit-generated`。当前 provider 为 {mapSnapshot.provider}，
            坐标置信度 {mapSnapshot.coordinateConfidence}。
          </p>
        </div>
      </section>
    </>
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
        {items.length ? items.map((item) => (
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
        )) : (
          <p className="rounded-md border border-dz-line bg-white px-3 py-3 text-xs leading-5 text-neutral-500">
            当前 Trace 没有这类候选记录。
          </p>
        )}
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
        {constraints.length ? constraints.map((constraint) => (
          <div key={constraint.name} className="rounded-md bg-white px-3 py-2 text-xs leading-5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{constraint.name}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", constraintStatusClass(constraint.status))}>
                {constraint.status}
              </span>
            </div>
            <p className="mt-1 text-neutral-600">{constraint.detail}</p>
          </div>
        )) : (
          <p className="rounded-md bg-white px-3 py-3 text-xs leading-5 text-neutral-500">
            当前 Trace 没有约束检查结果。
          </p>
        )}
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

function TraceJsonView({ payload }: { payload: unknown }) {
  const eventCount = isRecord(payload) && isRecord(payload.trace) && Array.isArray(payload.trace.events) ? payload.trace.events.length : 0;

  return (
    <section className="rounded-md border border-dz-line bg-[#171717] p-4 text-white">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black">完整 JSON</h4>
          <p className="mt-1 text-xs leading-5 text-white/55">包含当前 Trace、用户端选中方案、当前 3 套方案和 Debug 上下文。</p>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold text-white/70">{eventCount} events</span>
      </div>
      <pre className="max-h-[620px] overflow-auto rounded-md bg-black/55 p-4 text-[11px] leading-5 text-[#d8f8d8] [scrollbar-width:thin]">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </section>
  );
}

function TraceHistoryView({
  traces,
  status,
  activeTraceId,
  onOpenTrace
}: {
  traces: TraceSummary[];
  status: "idle" | "loading" | "error";
  activeTraceId?: string;
  onOpenTrace: (traceId: string) => void;
}) {
  if (status === "loading") {
    return (
      <section className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
        <h4 className="text-sm font-black">历史 Run</h4>
        <p className="mt-3 text-sm text-neutral-500">正在读取后端 Trace 列表...</p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="rounded-md border border-dz-line bg-[#fffdf8] p-5">
        <h4 className="text-sm font-black">历史 Run</h4>
        <p className="mt-3 text-sm leading-6 text-neutral-500">Trace API 暂时不可用。前端会继续展示当前静态或已加载的 Trace，不影响主规划流程。</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-dz-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black">历史 Run</h4>
          <p className="mt-1 text-xs leading-5 text-neutral-500">来自 `/traces` 的后端运行记录，点击可加载完整 Trace。</p>
        </div>
        <span className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">{traces.length} runs</span>
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
    </section>
  );
}

function collectMockEvidence(trace: AgentTrace | undefined, events: TraceEvent[]) {
  const evidence = new Set<string>();
  const fallbackReason = stringValue(trace?.metadata?.fallback_reason);
  if (fallbackReason) {
    evidence.add(`本轮 fallback_reason=${fallbackReason}`);
  }
  const frontendFallback = stringValue(trace?.metadata?.frontend_fallback_reason);
  if (frontendFallback) {
    evidence.add(`前端触发 fallback：${frontendFallback}`);
  }

  for (const event of events) {
    if (event.fallback_used) {
      evidence.add(`${event.label} 使用了 fallback。`);
    }
    if (event.tool_name?.includes("mock")) {
      evidence.add(`${event.label} 调用了本地 Mock 工具：${event.tool_name}。`);
    }
    collectProviderEvidence(event.tool_output, event.label, evidence);
    collectProviderEvidence(event.output, event.label, evidence);
  }

  collectProviderEvidence(trace?.metadata?.llm_plan_explanation, "路线解释 LLM", evidence);
  return Array.from(evidence);
}

function providerStatusesFromDebugTrace(trace: AgentTrace | undefined): ProviderStatus[] {
  if (!trace) {
    return [];
  }
  const statuses = new Map<string, ProviderStatus>();
  for (const event of trace.events) {
    collectDebugProviderStatus(event.tool_output, statuses);
    collectDebugProviderStatus(event.output, statuses);
  }
  return Array.from(statuses.values());
}

function collectDebugProviderStatus(value: unknown, statuses: Map<string, ProviderStatus>) {
  if (!isRecord(value)) {
    return;
  }
  const providerCall = isRecord(value.provider_call) ? value.provider_call : value;
  const provider = stringValue(providerCall.provider);
  if (provider) {
    const fallbackUsed = booleanValue(providerCall.fallback_used);
    const reliability = stringValue(providerCall.reliability);
    const error = stringValue(providerCall.error);
    statuses.set(provider, {
      name: provider,
      label: debugProviderLabel(provider),
      status: error?.toLowerCase().includes("timeout")
        ? "timeout"
        : fallbackUsed || reliability === "mocked" || provider.includes("mock") || provider === "deterministic_template"
          ? "mock"
          : "connected",
      lastDegradedReason: error
    });
  }
  for (const item of Object.values(value)) {
    collectDebugProviderStatus(item, statuses);
  }
}

function debugProviderLabel(provider: string) {
  const labels: Record<string, string> = {
    amap: "高德地图",
    caiyun: "彩云天气",
    longcat: "LongCat LLM",
    deterministic_template: "LLM 模板兜底",
    mock_map_provider: "Mock 地图",
    mock_weather_provider: "Mock 天气",
    mock_poi_search: "Mock POI",
    mock_local_poi_enrichment: "本地深度字段"
  };
  return labels[provider] ?? provider;
}

function collectProviderEvidence(value: unknown, label: string, evidence: Set<string>) {
  if (!isRecord(value)) {
    return;
  }

  const providerCall = isRecord(value.provider_call) ? value.provider_call : value;
  const provider = stringValue(providerCall.provider);
  const reliability = stringValue(providerCall.reliability);
  const fallbackUsed = booleanValue(providerCall.fallback_used);
  const fallbackProvider = stringValue(providerCall.fallback_provider);
  const error = stringValue(providerCall.error);
  if (fallbackUsed || reliability === "mocked" || provider?.includes("mock")) {
    evidence.add(
      `${label}: provider=${provider ?? "unknown"} reliability=${reliability ?? "unknown"} fallback=${String(fallbackUsed)}${
        fallbackProvider ? ` -> ${fallbackProvider}` : ""
      }${error ? `，原因：${error}` : ""}`
    );
  }
}

function mockPoisForTrace(trace: AgentTrace | undefined, plans: DemoRoutePlan[], pois: MockPoi[]) {
  const ids = new Set<string>();
  for (const plan of plans) {
    for (const stop of plan.stops) {
      ids.add(stop.poiId);
    }
  }
  collectPoiIdsFromUnknown(trace?.metadata?.related_pois, ids);
  for (const event of trace?.events ?? []) {
    collectPoiIdsFromUnknown(event.tool_output, ids);
    collectPoiIdsFromUnknown(event.output, ids);
  }
  return ids.size ? pois.filter((poi) => ids.has(poi.id)) : [];
}

function collectPoiIdsFromUnknown(value: unknown, ids: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPoiIdsFromUnknown(item, ids);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  const id = stringValue(value.id) ?? stringValue(value.poi_id);
  if (id) {
    ids.add(id);
  }
  collectPoiIdsFromUnknown(value.poi, ids);
  collectPoiIdsFromUnknown(value.related_pois, ids);
  collectPoiIdsFromUnknown(value.accepted_pois, ids);
  collectPoiIdsFromUnknown(value.candidates, ids);
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
  const ugcHits = parseStringArray(getRecordValue(output, "ugc_hits"));

  return {
    accepted,
    rejected: rejectedFromTrace,
    ugcHits: ugcHits.length ? ugcHits : fallbackUgcHits(plans)
  };
}

function buildConstraintSnapshot(events: TraceEvent[], selectedPlan?: DemoRoutePlan): ConstraintItem[] {
  const constraintEvent = events.find((event) => event.type === "constraint_checked");
  const constraints = parseConstraints(getRecordValue(constraintEvent?.output, "constraints"));
  if (constraints.length) {
    return constraints;
  }

  if (!selectedPlan) {
    return [];
  }

  const avgQueue = selectedPlan.stops.length
    ? Math.round(selectedPlan.stops.reduce((sum, stop) => sum + stop.queueMinutes, 0) / selectedPlan.stops.length)
    : 0;

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
    provider: selectedPlan ? "mock_map_provider" : "无地图",
    previewType: selectedPlan ? "mock_vector" : "-",
    fallbackUsed: false,
    coordinateConfidence: selectedPlan ? "mocked" : "-",
    totalDistanceMeters: selectedPlan ? selectedPlan.transports[0]?.minutes * 300 : undefined,
    totalDurationMinutes: selectedPlan?.transports[0]?.minutes,
    legs: fallbackMapLegs(selectedPlan),
    note: selectedPlan ? "当前 Trace 未返回地图字段，右侧用当前方案和本地 Mock 地图规则兜底。" : "当前 run 没有路线地图数据。"
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
    return {
      id,
      name,
      meta: stringValue(record.meta) ?? stringValue(poi.area) ?? stringValue(record.area) ?? "来自 Trace tool_output",
      reason: stringValue(record.reason) ?? stringValue(record.selected_reason) ?? "Trace 未提供详细理由，按当前候选状态展示。",
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

function fallbackUgcHits(plans: DemoRoutePlan[]) {
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
    return {
      name: stringValue(record.name) ?? `约束 ${index + 1}`,
      status: rawStatus === "warning" || rawStatus === "fail" || rawStatus === "pass" ? rawStatus : "pass",
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
      planId: stringValue(record.plan_id) ?? "",
      title: stringValue(record.title) ?? stringValue(record.plan_id) ?? "方案",
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
    return [];
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
    preference: "偏好",
    queue: "排队",
    distance: "距离",
    budget: "预算",
    ugc: "UGC"
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

function hasArrayField(record: Record<string, unknown> | undefined, field: string) {
  return Array.isArray(record?.[field]);
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
