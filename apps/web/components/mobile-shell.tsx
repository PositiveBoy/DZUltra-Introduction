"use client";

import {
  ArrowLeft,
  CalendarCheck2,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  Mic,
  MessageSquarePlus,
  Navigation,
  Pencil,
  Plus,
  ShoppingBag,
  Sparkles,
  Share2,
  Ticket,
  X
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, UIEvent } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper";
import "swiper/css";
import {
  agentSteps,
  chatRespond,
  createLocalChatTrace,
  createLocalFallbackTrace,
  createLocalRefinementTrace,
  deleteUserPreferenceOnApi,
  demoRoutePlans,
  getTrace,
  interactRespond,
  interactRespondStream,
  listTraces,
  listUserPreferences,
  planRoute,
  presetPrompts,
  refineRoute,
  updateUserPreferenceOnApi
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDemoStore, SKELETON_AGENT_STRATEGIES } from "@/stores/use-demo-store";
import type {
  AgentStrategy,
  AgentTrace,
  ApiRoutePlan,
  ChatResponsePayload,
  ClarificationCard,
  ClarificationState,
  DemoPoiStop,
  DemoRoutePlan,
  FlowBlockType,
  InteractionContext,
  InteractionRequestPayload,
  MobileShellView,
  RefinementDiff,
  RequirementSummary,
  TraceEvent,
  TraceSummary,
  TransportMode
} from "@/types/dzultra";
import { PromptCapsule } from "./prompt-capsule";
import type { PromptEntry } from "./prompt-capsule";
import { MobileComposer } from "./mobile-composer";
import { PlanCard } from "./plan-card";
import { ExpandedPlanSheet } from "./expanded-plan-sheet";

type PoiHint = {
  id: string;
  name: string;
  category: string;
  address: string;
  rating: number;
  meta: string;
  reason: string;
  latitude?: number;
  longitude?: number;
  recommendedDishes?: string[];
  openHours?: string;
  source?: "amap" | "mock";
  reliability?: Record<string, string>;
};

type AnsweringAgentStep = {
  id: string;
  label: string;
  status: "running" | "completed";
  detail?: string;
};

type DirectAnswer = {
  question: string;
  answer: string;
  poiHints: PoiHint[];
  agentSteps?: AnsweringAgentStep[];
  fallback_used?: boolean;
  fallback_reason?: string;
  poi_provider?: string;
  answer_provider?: string;
};

type ServiceItem = {
  src: string;
  label: string;
  framed?: boolean;
};

type RunningAgentStep = {
  id: string;
  agent: string;
  label: string;
  detail: string;
};

type EcosystemActionReceipt = {
  title: string;
  detail: string;
  url: string;
  status: "ready" | "disabled";
};

const FLOW_BLOCK_CLASS = `min-h-[620px] snap-start`;

const defaultClarification: ClarificationState = {
  people: 2,
  timeRange: "待确认",
  food: "待确认",
  budget: "待确认",
  taste: "待确认"
};

type ClarificationCardAnswers = Record<string, string | string[]>;

const actionIcon = {
  navigate: Navigation,
  queue: CalendarCheck2,
  deal: ShoppingBag,
  ticket: Ticket,
  book: CalendarCheck2,
  share: Share2
};

export function MobileShell() {
  const {
    mobileView,
    inputMode,
    selectedPlanId,
    selectedTransportMode,
    expandedStopId,
    highlightedStopId,
    completedTodoIds,
    activeTrace,
    activeAgentStep,
    activeUserId,
    activeMockLocation,
    preferenceDetectionEnabled,
    requireRequirementConfirmation,
    dataAuthorizationEnabled,
    userPreferences,
    flowBlocks,
    setMobileView,
    setInputMode,
    setSelectedPlanId,
    setSelectedTransportMode,
    setExpandedStopId,
    setHighlightedStopId,
    toggleTodo,
    resetMobileDemo,
    setSelectedTraceEventId,
    setActiveAgentStep,
    setActiveTrace,
    setActiveTraceMeta,
    appendTraceEvent,
    appendLlmChunk,
    finalizeActiveTrace,
    setCurrentRoutePlans,
    setUserPreferences,
    setActiveView,
    appendFlowBlock,
    clearFlowBlocks,
    refinementCount,
    incrementRefinementCount,
    resetRefinementCount,
    pendingReplayTrace,
    clearPendingReplayTrace
  } = useDemoStore();
  const [draft, setDraft] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState(presetPrompts[0]);
  const [clarification, setClarification] = useState(defaultClarification);
  const [dynamicClarificationCards, setDynamicClarificationCards] = useState<ClarificationCard[]>([]);
  const [clarificationCardAnswers, setClarificationCardAnswers] = useState<ClarificationCardAnswers>({});
  const [clarificationInputNotice, setClarificationInputNotice] = useState("");
  const [requirementSummary, setRequirementSummary] = useState<RequirementSummary | undefined>();
  const [plans, setPlans] = useState<DemoRoutePlan[]>([]);
  const [apiNotice, setApiNotice] = useState("等待首次 Run");
  const [refinementToast, setRefinementToast] = useState<string | null>(null);
  const [directAnswer, setDirectAnswer] = useState<DirectAnswer | undefined>(undefined);
  const [routePlanningEnabled, setRoutePlanningEnabled] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [voicePressed, setVoicePressed] = useState(false);
  const [flowIndex, setFlowIndex] = useState(0);
  const [flowBlockCount, setFlowBlockCount] = useState(1);
  const [confirmedClarification, setConfirmedClarification] = useState(defaultClarification);
  const [confirmedClarificationCards, setConfirmedClarificationCards] = useState<ClarificationCard[]>([]);
  const [confirmedClarificationCardAnswers, setConfirmedClarificationCardAnswers] = useState<ClarificationCardAnswers>({});
  const [hasConfirmedClarification, setHasConfirmedClarification] = useState(false);
  const [hasConfirmedSummary, setHasConfirmedSummary] = useState(false);
  const [postClarificationStep, setPostClarificationStep] = useState(0);
  const [runningAgentChainVisible, setRunningAgentChainVisible] = useState(false);
  const [promptSheetOpen, setPromptSheetOpen] = useState(false);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [historyPageOpen, setHistoryPageOpen] = useState(false);
  const [sidebarTraces, setSidebarTraces] = useState<TraceSummary[]>([]);
  const [promptEditDraft, setPromptEditDraft] = useState("");
  const [expandedPlanId, setExpandedPlanId] = useState<string | undefined>();
  const [homeSyncedPlanId, setHomeSyncedPlanId] = useState<string | undefined>();
  // 追踪是否已进入规划流（running/clarifying/summary/plans/refining/selected），
  // 一旦进入就保持 PlanningConversationView 挂载，实现内容块累积
  const [hasEnteredPlanning, setHasEnteredPlanning] = useState(false);
  const flowMainRef = useRef<HTMLElement | null>(null);
  const activePlanRequestIdRef = useRef(0);
  const continuationDelayRef = useRef(0);
  const planningRequestStartedAtRef = useRef(0);
  const planningMinimumDurationRef = useRef(6400);
  const promptEditorOpenRef = useRef(false);
  const flowIndexFrameRef = useRef<number | undefined>(undefined);
  const streamAbortRef = useRef<(() => void) | null>(null);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const promptSummary = createPromptSummary(submittedPrompt);
  const runningAgentSteps = useMemo(
    () => (activeTrace?.agent_strategy?.length ? activeTrace.agent_strategy.map(agentStrategyToRunningStep) : agentSteps),
    [activeTrace?.agent_strategy]
  );
  const shouldShowPromptSummary =
    !!submittedPrompt.trim() && !["entry", "searching", "start", "settings"].includes(mobileView);

  // 本轮所有用户 prompt 条目，用于 PromptCapsule 展开面板
  const promptEntries: PromptEntry[] = useMemo(() => {
    const entries: PromptEntry[] = [];
    if (submittedPrompt.trim()) {
      entries.push({
        id: "initial-prompt",
        text: submittedPrompt,
        label: "首次输入",
        scrollTargetSelector: "[data-prompt-anchor]"
      });
    }
    if (hasConfirmedClarification) {
      entries.push({
        id: "clarification-supplement",
        text: `${confirmedClarification.people} 人 · ${confirmedClarification.timeRange} · ${confirmedClarification.food}`,
        label: "补全信息"
      });
    }
    if (hasConfirmedSummary) {
      entries.push({
        id: "preference-confirm",
        text: `${confirmedClarification.budget} · ${confirmedClarification.taste}`,
        label: "偏好确认"
      });
    }
    return entries;
  }, [submittedPrompt, hasConfirmedClarification, hasConfirmedSummary, confirmedClarification]);

  // 旧 mutation 保留作为临时 fallback，当前主链路已统一走 interactionMutation
  const _planMutation = useMutation({
    mutationFn: planRoute,
    onSuccess: (response, variables) => {
      const applyResponse = () => {
        if (variables.client_request_id !== activePlanRequestIdRef.current || promptEditorOpenRef.current) {
          return;
        }
        const apiPlans = response.plans?.length ? response.plans : response.plan ? [response.plan] : [];
        const nextPlans = apiPlans.length ? apiPlans.map(apiPlanToDemoPlan) : [];
        setApiNotice(`API Trace 已生成：${response.trace_id}`);
        setActiveTrace(response.trace);
        const responseCards = response.clarification_cards ?? [];
        setDynamicClarificationCards(responseCards);
        setRequirementSummary(response.requirement_summary);
        if (variables.preference_detection_enabled && variables.user_id !== "anonymous") {
          window.setTimeout(() => {
            void syncUserPreferencesFromApi(variables.user_id);
          }, 300);
        }
        if (response.planning_status === "needs_clarification") {
          setClarificationCardAnswers(initializeClarificationCardAnswers(responseCards, clarification));
          setMobileView("clarifying");
          setSelectedTraceEventId(
            response.trace.events.find((event) => event.type === "clarification_requested")?.id ?? response.trace.events.at(-1)?.id
          );
          return;
        }
        setClarificationCardAnswers({});
        if (response.planning_status === "needs_confirmation") {
          setMobileView("summary");
          setSelectedTraceEventId(
            response.trace.events.find((event) => event.type === "requirements_summarized")?.id ?? response.trace.events.at(-1)?.id
          );
          return;
        }
        if (nextPlans.length) {
          setPlans(nextPlans);
          setCurrentRoutePlans(nextPlans);
          setSelectedPlanId(response.selected_plan_id ?? nextPlans[0].id);
          setExpandedStopId(nextPlans[0].stops[0]?.poiId);
          setActiveView("result");
          setMobileView("plans");
        }
        setSelectedTraceEventId(response.trace.events.find((event) => event.type === "tool_called")?.id ?? response.trace.events[0]?.id);
      };
      const elapsed = Date.now() - planningRequestStartedAtRef.current;
      // 仅保留极短过渡动效（≤200ms），不再强制等待完整最小时长
      const animationBudget = Math.max(0, Math.min(200, planningMinimumDurationRef.current - elapsed));
      const delay = Math.max(continuationDelayRef.current, animationBudget);
      continuationDelayRef.current = 0;
      if (delay > 0) {
        window.setTimeout(applyResponse, delay);
        return;
      }
      applyResponse();
    },
    onError: (_error, variables) => {
      if (variables.client_request_id !== activePlanRequestIdRef.current || promptEditorOpenRef.current) {
        return;
      }
      setApiNotice("API 未连接，已使用本地 Mock 跑完整流程");
      const elapsed = Date.now() - planningRequestStartedAtRef.current;
      // fallback 仅保留极短过渡动效
      const fallbackDelay = Math.max(200, Math.min(400, planningMinimumDurationRef.current - elapsed));
      window.setTimeout(() => {
        if (variables.client_request_id !== activePlanRequestIdRef.current || promptEditorOpenRef.current) {
          return;
        }
        const fallbackPlans = demoRoutePlans;
        const fallbackTrace = createLocalFallbackTrace(variables.goal, fallbackPlans[0].id);
        setPlans(fallbackPlans);
        setCurrentRoutePlans(fallbackPlans);
        setSelectedPlanId(fallbackPlans[0].id);
        setExpandedStopId(fallbackPlans[0].stops[0]?.poiId);
        setActiveTrace(fallbackTrace);
        setActiveView("result");
        setMobileView("plans");
        setSelectedTraceEventId(fallbackTrace.events.find((event) => event.type === "route_scored")?.id ?? fallbackTrace.events.at(-1)?.id);
      }, fallbackDelay);
    }
  });

  const _chatMutation = useMutation({
    mutationFn: chatRespond,
    onSuccess: (response, variables) => {
      setDirectAnswer(directAnswerFromChatResponse(variables.message, response));
      setApiNotice(
        response.trace.events.some((event) => event.fallback_used)
          ? "ChatAnswerAgent 已返回；LongCat 或真实 provider 失败的部分已在 Trace 标记 fallback。"
          : "ChatAnswerAgent 已调用后端完成普通问答，Trace 中可查看候选 POI 和 LLM 调用。"
      );
      setActiveTrace(response.trace);
      setSelectedTraceEventId(
        response.trace.events.find((event) => event.type === "chat_answered")?.id ??
          response.trace.events.find((event) => event.type === "candidate_retrieved")?.id ??
          response.trace.events.at(-1)?.id
      );
    },
    onError: (_error, variables) => {
      const fallbackTrace = createLocalChatTrace(variables.message);
      setDirectAnswer({ ...createDirectAnswer(variables.message), fallback_reason: "api_unavailable" });
      setApiNotice("API 不可用，展示的是本地 Mock 数据。");
      setActiveTrace(fallbackTrace);
      setSelectedTraceEventId(fallbackTrace.events.find((event) => event.type === "chat_answered")?.id ?? fallbackTrace.events.at(-1)?.id);
    }
  });

  const _refineMutation = useMutation({
    mutationFn: refineRoute,
    onSuccess: (response) => {
      const apiPlans = response.plans?.length ? response.plans : response.plan ? [response.plan] : [];
      const nextPlans = apiPlans.length ? apiPlans.map(apiPlanToDemoPlan) : [];
      setApiNotice("微调接口已返回，当前方案已更新");
      setActiveTrace(response.trace);
      if (nextPlans.length) {
        const selectedPlanIdFromApi = response.selected_plan_id ?? response.plan.id;
        const selectedPlanFromApi = nextPlans.find((plan) => plan.id === selectedPlanIdFromApi) ?? nextPlans[0];
        const changedStopId = getChangedStopIdFromDiff(selectedPlanFromApi, response.refinement_diff);
        setPlans(nextPlans);
        setCurrentRoutePlans(nextPlans);
        setSelectedPlanId(selectedPlanIdFromApi);
        setHighlightedStopId(changedStopId);
        window.setTimeout(() => setHighlightedStopId(undefined), 1200);
        // 微调成功 Toast
        const diff = response.refinement_diff;
        const replacedChange = diff?.changes?.find((c: { type: string }) => c.type === "replaced");
        if (replacedChange && replacedChange.stop_index !== undefined) {
          showRefinementToast(`已替换第 ${replacedChange.stop_index + 1} 站`);
        } else {
          showRefinementToast("已更新");
        }
        incrementRefinementCount();
      }
      setMobileView("plans");
      setSelectedTraceEventId(
        response.trace.events.find((event) => event.type === "user_refinement_received")?.id ?? response.trace.events.at(-1)?.id
      );
    },
    onError: () => {
      setApiNotice("微调接口未连接，已用本地 Mock 更新方案");
      showRefinementToast("修改失败，请重试");
    }
  });

  /**
   * 处理 interaction response 的通用逻辑，SSE 和 mutation 共用。
   * SSE 模式下 trace 已通过 appendTraceEvent 逐步渲染，这里只处理 plans/视图切换等。
   */
  function applyInteractionResponse(
    response: { interaction_type: string; trace_id: string; trace: typeof activeTrace; routing: { routing_reason: string }; chat?: ChatResponsePayload | null; route_plan?: { plans?: unknown[]; plan?: { id: string }; clarification_cards?: ClarificationCard[]; requirement_summary?: RequirementSummary; planning_status?: string; selected_plan_id?: string } | null; refinement?: { plans?: unknown[]; plan?: { id: string }; selected_plan_id?: string; refinement_diff?: RefinementDiff } | null },
    variables: { message: string; preference_detection_enabled?: boolean; user_id?: string }
  ) {
    if (promptEditorOpenRef.current) {
      return;
    }
    setApiNotice(`API Trace 已生成：${response.trace_id}（分流：${response.routing?.routing_reason ?? ""}）`);

    if (variables.preference_detection_enabled && variables.user_id && variables.user_id !== "anonymous") {
      window.setTimeout(() => {
        void syncUserPreferencesFromApi(variables.user_id!);
      }, 300);
    }

    const interactionType = response.interaction_type;
    const traceEvents = response.trace?.events ?? [];

    // chat_answer -> answering
    if (interactionType === "chat_answer" && response.chat) {
      setDirectAnswer(directAnswerFromChatResponse(variables.message, response.chat));
      setActiveView("result");
      setMobileView("answering");
      setSelectedTraceEventId(
        traceEvents.find((event) => event.type === "chat_answered")?.id ??
          traceEvents.find((event) => event.type === "candidate_retrieved")?.id ??
          traceEvents.at(-1)?.id
      );
      return;
    }

    // needs_clarification -> clarifying
    if (interactionType === "answer_clarification" || (response.route_plan && response.route_plan.planning_status === "needs_clarification")) {
      const routeResponse = response.route_plan;
      const responseCards = routeResponse?.clarification_cards ?? [];
      setDynamicClarificationCards(responseCards);
      setRequirementSummary(routeResponse?.requirement_summary);
      setClarificationCardAnswers(initializeClarificationCardAnswers(responseCards, clarification));
      setMobileView("clarifying");
      setSelectedTraceEventId(
        traceEvents.find((event) => event.type === "clarification_requested")?.id ?? traceEvents.at(-1)?.id
      );
      return;
    }

    // needs_confirmation -> summary
    if (interactionType === "confirm_requirements" || (response.route_plan && response.route_plan.planning_status === "needs_confirmation")) {
      const routeResponse = response.route_plan;
      setDynamicClarificationCards(routeResponse?.clarification_cards ?? []);
      setRequirementSummary(routeResponse?.requirement_summary);
      setMobileView("summary");
      setSelectedTraceEventId(
        traceEvents.find((event) => event.type === "requirements_summarized")?.id ?? traceEvents.at(-1)?.id
      );
      return;
    }

    // refine_current_plan -> plans/refining
    if (interactionType === "refine_current_plan" && response.refinement) {
      const refineResponse = response.refinement;
      const apiPlans = refineResponse.plans?.length ? refineResponse.plans : refineResponse.plan ? [refineResponse.plan] : [];
      const nextPlans = apiPlans.length ? (apiPlans as ApiRoutePlan[]).map(apiPlanToDemoPlan) : [];
      if (nextPlans.length) {
        const selectedPlanIdFromApi = refineResponse.selected_plan_id ?? refineResponse.plan!.id;
        const selectedPlanFromApi = nextPlans.find((plan) => plan.id === selectedPlanIdFromApi) ?? nextPlans[0];
        const changedStopId = getChangedStopIdFromDiff(selectedPlanFromApi, refineResponse.refinement_diff);
        setPlans(nextPlans);
        setCurrentRoutePlans(nextPlans);
        setSelectedPlanId(selectedPlanIdFromApi);
        setHighlightedStopId(changedStopId);
        window.setTimeout(() => setHighlightedStopId(undefined), 1200);
        // 微调成功 Toast
        const diff = refineResponse.refinement_diff;
        const replacedChange = diff?.changes?.find((c: { type: string }) => c.type === "replaced");
        if (replacedChange && replacedChange.stop_index !== undefined) {
          showRefinementToast(`已替换第 ${replacedChange.stop_index + 1} 站`);
        } else {
          showRefinementToast("已更新");
        }
        incrementRefinementCount();
      }
      setMobileView("plans");
      setSelectedTraceEventId(
        traceEvents.find((event) => event.type === "user_refinement_received")?.id ?? traceEvents.at(-1)?.id
      );
      return;
    }

    // new_planning_task / completed planning -> plans
    if (response.route_plan) {
      const routeResponse = response.route_plan;
      const apiPlans = routeResponse.plans?.length ? routeResponse.plans : routeResponse.plan ? [routeResponse.plan] : [];
      const nextPlans = apiPlans.length ? (apiPlans as ApiRoutePlan[]).map(apiPlanToDemoPlan) : [];
      const responseCards = routeResponse.clarification_cards ?? [];
      setDynamicClarificationCards(responseCards);
      setRequirementSummary(routeResponse.requirement_summary);

      // 防御：空壳 plan（stops 为空）不切换到 plans 视图
      const hasValidPlans = nextPlans.length > 0 && nextPlans.some((p: DemoRoutePlan) => p.stops && p.stops.length > 0);
      if (hasValidPlans) {
        setPlans(nextPlans);
        setCurrentRoutePlans(nextPlans);
        setSelectedPlanId(routeResponse.selected_plan_id ?? nextPlans[0].id);
        setExpandedStopId(nextPlans[0].stops[0]?.poiId);
        setActiveView("result");
        setMobileView("plans");
      } else if (routeResponse.planning_status === "needs_clarification" || routeResponse.clarification_cards?.length) {
        // 需要追问时走 clarifying
        setMobileView("clarifying");
      } else if (routeResponse.planning_status === "needs_confirmation") {
        // 需要确认时走 summary
        setMobileView("summary");
      }
      setSelectedTraceEventId(
        traceEvents.find((event) => event.type === "tool_called")?.id ?? traceEvents[0]?.id
      );
      return;
    }

    // fallback: 如果 interaction_type 没有匹配到具体处理，用 trace 的最后一个事件
    setSelectedTraceEventId(traceEvents.at(-1)?.id);
  }

  const interactionMutation = useMutation({
    mutationFn: interactRespond,
    onSuccess: (response, variables) => {
      const applyResponse = () => {
        setActiveTrace(response.trace);
        applyInteractionResponse(response, variables);
      };

      const elapsed = Date.now() - planningRequestStartedAtRef.current;
      // 仅保留极短过渡动效（≤200ms），不再强制等待完整最小时长
      const animationBudget = Math.max(0, Math.min(200, planningMinimumDurationRef.current - elapsed));
      const delay = Math.max(continuationDelayRef.current, animationBudget);
      continuationDelayRef.current = 0;
      if (delay > 0) {
        window.setTimeout(applyResponse, delay);
        return;
      }
      applyResponse();
    },
    onError: (_error, variables) => {
      if (promptEditorOpenRef.current) {
        return;
      }
      // 统一交互接口失败时，根据当前上下文 fallback 到旧接口
      const interactionCtx = variables.interaction_context;
      const page = interactionCtx?.page;

      // 方案页微调 fallback
      if (variables.interaction_context?.route_id) {
        setApiNotice("统一交互接口未连接，已用本地 Mock 更新方案");
        const traceForRefine = useDemoStore.getState().activeTrace;
        const { nextPlans, changedStopId } = applyMockRefinement(plans, variables.interaction_context.route_id, variables.message);
        window.setTimeout(() => {
          const refinementTrace = createLocalRefinementTrace(traceForRefine, variables.message, variables.interaction_context!.route_id!, changedStopId);
          setPlans(nextPlans);
          setCurrentRoutePlans(nextPlans);
          setHighlightedStopId(changedStopId);
          setActiveTrace(refinementTrace);
          setSelectedTraceEventId(
            refinementTrace.events.find((event) => event.type === "user_refinement_received")?.id ?? refinementTrace.events.at(-1)?.id
          );
          setMobileView("plans");
          setApiNotice(`已按"${variables.message}"更新当前方案`);
          showRefinementToast("已更新");
          incrementRefinementCount();
          window.setTimeout(() => setHighlightedStopId(undefined), 1200);
        }, 900);
        return;
      }

      // 普通问答 fallback（非路线规划上下文）
      if (page === "searching" || page === "answering") {
        const fallbackTrace = createLocalChatTrace(variables.message);
        setDirectAnswer({ ...createDirectAnswer(variables.message), fallback_reason: "api_unavailable" });
        setApiNotice("API 不可用，展示的是本地 Mock 数据。");
        setActiveTrace(fallbackTrace);
        setActiveView("result");
        setMobileView("answering");
        setSelectedTraceEventId(fallbackTrace.events.find((event) => event.type === "chat_answered")?.id ?? fallbackTrace.events.at(-1)?.id);
        return;
      }

      // 路线规划 fallback
      setApiNotice("统一交互接口未连接，已使用本地 Mock 跑完整流程");
      const elapsed = Date.now() - planningRequestStartedAtRef.current;
      // fallback 仅保留极短过渡动效
      const fallbackDelay = Math.max(200, Math.min(400, planningMinimumDurationRef.current - elapsed));
      window.setTimeout(() => {
        if (promptEditorOpenRef.current) {
          return;
        }
        const fallbackPlans = demoRoutePlans;
        const fallbackTrace = createLocalFallbackTrace(variables.message, fallbackPlans[0].id);
        setPlans(fallbackPlans);
        setCurrentRoutePlans(fallbackPlans);
        setSelectedPlanId(fallbackPlans[0].id);
        setExpandedStopId(fallbackPlans[0].stops[0]?.poiId);
        setActiveTrace(fallbackTrace);
        setActiveView("result");
        setMobileView("plans");
        setSelectedTraceEventId(fallbackTrace.events.find((event) => event.type === "route_scored")?.id ?? fallbackTrace.events.at(-1)?.id);
      }, fallbackDelay);
    }
  });

  // ── 微调 Toast 反馈 ──
  const showRefinementToast = useCallback((message: string) => {
    setRefinementToast(message);
    window.setTimeout(() => setRefinementToast(null), 2000);
  }, []);

  const activeTransport = useMemo(
    () => selectedPlan?.transports.find((item) => item.mode === selectedTransportMode) ?? selectedPlan?.transports[0],
    [selectedPlan, selectedTransportMode]
  );

  // 侧边栏打开时获取 trace 历史
  useEffect(() => {
    if (!settingsDrawerOpen) return;
    let cancelled = false;
    listTraces()
      .then((items) => { if (!cancelled) setSidebarTraces(items); })
      .catch(() => { if (!cancelled) setSidebarTraces([]); });
    return () => { cancelled = true; };
  }, [settingsDrawerOpen]);

  // 选中历史 trace：加载完整 trace 并跳转
  async function handleSelectTrace(traceId: string) {
    try {
      const trace = await getTrace(traceId);
      setActiveTrace(trace);
      setSelectedTraceEventId(trace.events[0]?.id);
      setSettingsDrawerOpen(false);
      setHistoryPageOpen(false);
      startMockHistoryReplay(trace);
    } catch {
      // 加载失败，忽略
    }
  }

  // ── Mock 历史渐进式回放 ──
  // 点击 Mock 历史后，用 setTimeout 逐步追加 flowBlocks、逐步切换 mobileView，
  // 模拟真实 Agent 流程的渐进式展示。
  function startMockHistoryReplay(trace: AgentTrace) {
    // 先中断之前的 SSE 流
    if (streamAbortRef.current) {
      streamAbortRef.current();
      streamAbortRef.current = null;
    }

    const isChat = trace.events.some((e) => e.type === "chat_answered");
    const goal = trace.user_goal;

    // 清空旧状态
    setSubmittedPrompt(goal);
    setDraft("");
    setKeyboardOpen(false);
    setPlans([]);
    setCurrentRoutePlans([]);
    setSelectedPlanId(undefined);
    setConfirmedClarification(defaultClarification);
    setConfirmedClarificationCards([]);
    setConfirmedClarificationCardAnswers({});
    setHasConfirmedClarification(false);
    setHasConfirmedSummary(false);
    setPostClarificationStep(0);
    clearFlowBlocks();
    setHasEnteredPlanning(false);
    setDirectAnswer(undefined);
    setRequirementSummary(undefined);
    setActiveTrace(trace);
    setSelectedTraceEventId(trace.events[0]?.id);

    if (isChat) {
      // 问答类：先显示 Agent 思考中，然后逐步推进摘要行，最后流式出答案
      setMobileView("answering");
      setApiNotice("Mock 历史回放：Agent 正在理解你的问题…");

      // 初始：只有第一步 running
      setDirectAnswer({
        question: goal,
        answer: "",
        poiHints: [],
        agentSteps: [
          { id: "step-understand", label: "理解你的需求中…", status: "running" },
        ],
        answer_provider: "LongCat LLM",
        poi_provider: "amap_poi",
      });

      // 800ms：理解完成 + 搜索中
      window.setTimeout(() => {
        setDirectAnswer((prev) => prev ? {
          ...prev,
          agentSteps: [
            { id: "step-understand", label: "理解你的需求", status: "completed", detail: "已识别为附近搜索" },
            { id: "step-search", label: "搜索中…", status: "running" },
          ],
        } : prev);
        setApiNotice("Mock 历史回放：正在搜索附近 POI…");
      }, 800);

      // 1600ms：搜索完成 + 输出回答
      window.setTimeout(() => {
        const mockAnswer = getMockChatAnswer(goal);
        const mockPois = getMockChatPois(goal);
        setDirectAnswer((prev) => prev ? {
          ...prev,
          answer: mockAnswer,
          poiHints: mockPois,
          agentSteps: [
            { id: "step-understand", label: "理解你的需求", status: "completed", detail: "已识别为附近搜索" },
            { id: "step-search", label: "搜索到 " + mockPois.length + " 家相关店铺", status: "completed", detail: "已筛选 Top " + Math.min(5, mockPois.length) },
            { id: "step-answer", label: "生成回答", status: "completed" },
          ],
        } : prev);
        setApiNotice("Mock 历史回放：回答已生成。");
      }, 1600);
    } else {
      // 路线规划类：渐进式回放
      // Step 1: running
      setMobileView("running");
      setApiNotice("Mock 历史回放：Agent 正在分析需求…");

      // Step 2: clarifying (800ms)
      window.setTimeout(() => {
        setMobileView("clarifying");
        setApiNotice("Mock 历史回放：需要补全关键信息…");
      }, 800);

      // Step 3: auto-confirm clarification (1600ms)
      window.setTimeout(() => {
        setHasConfirmedClarification(true);
        setConfirmedClarification(clarification);
        setPostClarificationStep(0);
        setMobileView("running");
        setApiNotice("Mock 历史回放：已吸收补全信息，正在检索候选…");
      }, 1600);

      // Step 4: summary (2400ms)
      window.setTimeout(() => {
        setMobileView("summary");
        setApiNotice("Mock 历史回放：请确认需求总结…");
      }, 2400);

      // Step 5: auto-confirm summary → plans (3200ms)
      window.setTimeout(() => {
        setHasConfirmedSummary(true);
        setPlans(demoRoutePlans);
        setCurrentRoutePlans(demoRoutePlans);
        setSelectedPlanId(demoRoutePlans[0].id);
        setMobileView("plans");
        setApiNotice(`Mock 历史回放：已生成 ${demoRoutePlans.length} 套方案。`);
      }, 3200);
    }
  }

  // 监听 store 中的 pendingReplayTrace，由 DebugTracePanel 通过 startMockHistoryReplay 触发
  useEffect(() => {
    if (pendingReplayTrace) {
      startMockHistoryReplay(pendingReplayTrace);
      clearPendingReplayTrace();
    }
  }, [pendingReplayTrace]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    promptEditorOpenRef.current = promptEditorOpen;
  }, [promptEditorOpen]);

  // ── FlowBlock 追加逻辑 ──
  // mobileView 变化时，根据当前流程阶段追加对应的内容块。
  // 块一旦追加就不会被移除，实现"纵向追加"而非"视图替换"。
  useEffect(() => {
    const planningViews: MobileShellView[] = ["running", "clarifying", "summary", "plans", "refining", "selected"];
    if (planningViews.includes(mobileView)) {
      setHasEnteredPlanning(true);
    }
    if (mobileView === "entry" || mobileView === "searching") {
      setHasEnteredPlanning(false);
    }

    // 根据 mobileView 和流程状态追加内容块
    const now = Date.now();
    const existingTypes = new Set(flowBlocks.map((b) => b.type));

    function appendOnce(id: string, type: FlowBlockType) {
      if (!flowBlocks.some((b) => b.id === id)) {
        appendFlowBlock({ id, type, timestamp: now });
      }
    }

    if (mobileView === "running" || mobileView === "clarifying" || mobileView === "summary" || mobileView === "plans" || mobileView === "refining" || mobileView === "selected") {
      // 用户输入块 + Agent 链块：进入规划流时追加
      appendOnce("fb-user-input", "user_input");
      appendOnce("fb-agent-chain", "agent_chain");
    }

    if (mobileView === "clarifying") {
      appendOnce("fb-clarification", "clarification");
    }

    // 补全确认后追加 agent_reaction 块
    if (hasConfirmedClarification && !existingTypes.has("agent_reaction")) {
      appendOnce("fb-reaction-absorb", "agent_reaction");
      appendOnce("fb-reaction-retrieve", "agent_reaction");
      appendOnce("fb-reaction-compose", "agent_reaction");
    }

    if (mobileView === "summary" || (hasConfirmedSummary && planningViews.includes(mobileView))) {
      appendOnce("fb-summary", "summary");
    }

    if ((mobileView === "plans" || mobileView === "refining") && plans.length > 0) {
      appendOnce("fb-plans", "plans");
    }

    if (mobileView === "selected") {
      appendOnce("fb-selected", "selected");
      appendOnce("fb-todo", "todo");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 需要 flowBlocks 判断去重，但不希望 flowBlocks 变化时重新触发
  }, [mobileView, hasConfirmedClarification, hasConfirmedSummary, plans.length, appendFlowBlock]);

  useEffect(() => {
    return () => {
      if (flowIndexFrameRef.current !== undefined) {
        window.cancelAnimationFrame(flowIndexFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mobileView !== "running" || !hasConfirmedClarification) {
      return;
    }

    setPostClarificationStep(0);
    const timers = [
      window.setTimeout(() => setPostClarificationStep(1), 620),
      window.setTimeout(() => setPostClarificationStep(2), 1240)
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [mobileView, hasConfirmedClarification]);

  useEffect(() => {
    if (mobileView !== "running" || hasConfirmedClarification || hasConfirmedSummary) {
      setRunningAgentChainVisible(false);
      return;
    }

    setRunningAgentChainVisible(false);
    const timer = window.setTimeout(() => setRunningAgentChainVisible(true), 1750);

    return () => window.clearTimeout(timer);
  }, [hasConfirmedClarification, hasConfirmedSummary, mobileView, submittedPrompt]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const target = flowMainRef.current;
      if (!target) {
        return;
      }

      const blocks = target.querySelectorAll<HTMLElement>("[data-flow-block]");
      const nextCount = Math.max(1, blocks.length || getFlowBlockCount(mobileView));
      setFlowBlockCount(nextCount);

      if (mobileView === "start") {
        target.scrollTo({ top: 0 });
        return;
      }

      const autofocusBlock = target.querySelector<HTMLElement>("[data-flow-autofocus='true']");
      if (autofocusBlock) {
        scrollFlowBlockIntoView(target, autofocusBlock);
        return;
      }

      if (mobileView !== "settings" && blocks.length && mobileView !== "running") {
        scrollFlowBlockIntoView(target, blocks[blocks.length - 1]);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    mobileView,
    dynamicClarificationCards.length,
    confirmedClarificationCards.length,
    hasConfirmedClarification,
    hasConfirmedSummary,
    postClarificationStep,
    runningAgentChainVisible,
    requirementSummary?.next_action,
    plans.length
  ]);

  function enterStart() {
    setMobileView("start");
    setDraft("");
    setKeyboardOpen(false);
    setFlowIndex(0);
  }

  function enterSearch() {
    setMobileView("searching");
    setDraft("帮我规划今天去哪玩");
    setKeyboardOpen(false);
  }

  function submitPrompt(prompt?: string) {
    const goal = (prompt ?? draft).trim();
    if (!goal) {
      return;
    }

    setSubmittedPrompt(goal);
    startInteractionRequest(goal, {
      plan_mode: routePlanningEnabled
    });
  }

  function startInteractionRequest(
    message: string,
    overrides: {
      plan_mode?: boolean;
      clarification_answers?: Record<string, unknown>;
      confirmed_requirements?: boolean;
      interaction_context?: Record<string, unknown>;
      constraints?: string[];
    } = {},
    flowOptions: { preserveCurrentFlow?: boolean } = {}
  ) {
    const requestId = activePlanRequestIdRef.current + 1;
    activePlanRequestIdRef.current = requestId;
    planningRequestStartedAtRef.current = Date.now();
    planningMinimumDurationRef.current = flowOptions.preserveCurrentFlow ? 400 : 800;
    setActiveView("planning");
    setDraft("");
    setKeyboardOpen(false);
    setMobileView("running");
    setApiNotice(flowOptions.preserveCurrentFlow ? "确认信息后继续规划中" : "正在获取基本信息");
    if (!flowOptions.preserveCurrentFlow) {
      setFlowIndex(0);
      setPlans([]);
      setCurrentRoutePlans([]);
      setSelectedPlanId(undefined);
      setConfirmedClarification(defaultClarification);
      setConfirmedClarificationCards([]);
      setConfirmedClarificationCardAnswers({});
      setHasConfirmedClarification(false);
      setHasConfirmedSummary(false);
      setPostClarificationStep(0);
      clearFlowBlocks();
      setHasEnteredPlanning(false);
    }
    setActiveTrace({
      id: `trace-running-${Date.now()}`,
      user_goal: message,
      status: "running",
      total_duration_ms: 0,
      runner_mode: "real_agent_ai_generated_data",
      agent_strategy: SKELETON_AGENT_STRATEGIES,
      events: [],
      metadata: { running: true, note: "正在等待后端 Agent 响应…" },
    });
    setDynamicClarificationCards([]);
    setClarificationCardAnswers({});
    setClarificationInputNotice("");
    if (!flowOptions.preserveCurrentFlow) {
      setRequirementSummary(undefined);
    }
    setSelectedTraceEventId(undefined);

    // 构造请求 payload
    const payload: InteractionRequestPayload = {
      user_id: dataAuthorizationEnabled && activeUserId ? activeUserId : "anonymous",
      message,
      city: activeMockLocation?.city ?? "北京",
      plan_mode: overrides.plan_mode ?? routePlanningEnabled,
      constraints: overrides.constraints ?? (dataAuthorizationEnabled
        ? Array.from(new Set(["约会", "看展", ...userPreferences.map((preference) => preference.label)]))
        : ["约会", "看展"]),
      preference_detection_enabled: preferenceDetectionEnabled,
      clarification_answers: overrides.clarification_answers,
      interaction_context: overrides.interaction_context as InteractionContext | undefined,
      require_confirmation: requireRequirementConfirmation,
      confirmed_requirements: overrides.confirmed_requirements
    };

    // 中断之前的 SSE 流
    if (streamAbortRef.current) {
      streamAbortRef.current();
      streamAbortRef.current = null;
    }

    // 优先尝试 SSE 流式调用
    let streamFailed = false;
    const abort = interactRespondStream(payload, {
      onTraceMeta: (trace) => {
        setActiveTraceMeta(trace);
        setApiNotice("SSE 流式接收中，Agent 逐步推送 Trace events…");
      },
      onTraceEvent: (event: TraceEvent) => {
        appendTraceEvent(event);
      },
      onLlmChunk: (chunk) => {
        appendLlmChunk(chunk.purpose, chunk.content, false);
      },
      onResponseComplete: (response) => {
        streamAbortRef.current = null;
        // 复用 interactionMutation 的 onSuccess 逻辑
        finalizeActiveTrace(response.trace);
        applyInteractionResponse(response, payload);
      },
      onError: () => {
        if (streamFailed) return;
        streamFailed = true;
        streamAbortRef.current = null;
        // SSE 失败，fallback 到普通 mutation
        interactionMutation.mutate(payload);
      }
    });
    streamAbortRef.current = abort;
  }

  async function syncUserPreferencesFromApi(userId: string) {
    try {
      const profile = await listUserPreferences(userId);
      setUserPreferences(profile.preferences);
    } catch {
      // API 不可用时保留本地偏好，保证 Demo 主流程不中断。
    }
  }

  function submitSearchQuestion(question: string) {
    const goal = question.trim() || "帮我规划今天去哪玩";

    setSubmittedPrompt(goal);
    setDirectAnswer({
      question: goal,
      answer: "",
      poiHints: [],
      agentSteps: [
        { id: "step-understand", label: "理解你的需求中…", status: "running" },
      ],
    });
    setApiNotice("正在调用 /interactions/respond：由后端 InteractionRouterAgent 决定分流。");

    startInteractionRequest(goal, {
      plan_mode: routePlanningEnabled,
      interaction_context: { page: "searching" },
      constraints: dataAuthorizationEnabled ? userPreferences.map((preference) => preference.label) : [],
    });
  }

  function confirmClarification() {
    if (dynamicClarificationCards.length) {
      setConfirmedClarification(clarification);
      setConfirmedClarificationCards(dynamicClarificationCards);
      setConfirmedClarificationCardAnswers(clarificationCardAnswers);
      setHasConfirmedClarification(true);
      setPostClarificationStep(0);
      continuationDelayRef.current = 1900;
      startInteractionRequest(submittedPrompt, {
        plan_mode: true,
        clarification_answers: buildClarificationAnswers(clarification, dynamicClarificationCards, clarificationCardAnswers),
        interaction_context: {
          page: "clarifying",
          trace_id: activeTrace?.id
        }
      }, { preserveCurrentFlow: true });
      return;
    }
    setConfirmedClarification(clarification);
    setHasConfirmedClarification(true);
    setPostClarificationStep(0);
    setMobileView("summary");
    setSelectedTraceEventId("trace-event-004");
  }

  function confirmSummary() {
    setHasConfirmedSummary(true);
    startInteractionRequest("确认需求，开始规划", {
      plan_mode: true,
      clarification_answers: buildClarificationAnswers(clarification, dynamicClarificationCards, clarificationCardAnswers),
      confirmed_requirements: true,
      interaction_context: {
        page: "summary",
        trace_id: activeTrace?.id
      }
    }, { preserveCurrentFlow: true });
  }

  function applyClarificationFreeformInput(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const parsed = applyFreeformClarificationInput(
      trimmed,
      clarification,
      dynamicClarificationCards,
      clarificationCardAnswers
    );
    setClarification(parsed.clarification);
    setClarificationCardAnswers(parsed.cardAnswers);
    setClarificationInputNotice(
      parsed.recognizedLabels.length
        ? `已从补充里识别：${parsed.recognizedLabels.join("、")}。你可以检查一下再点确定。`
        : "这句话暂时没有明确字段，我先保留为补充偏好；如果不对，可以直接点选卡片改掉。"
    );
  }

  function applySummaryFreeformInput(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const parsed = applyFreeformClarificationInput(trimmed, clarification, dynamicClarificationCards, clarificationCardAnswers);
    setClarification(parsed.clarification);
    setClarificationCardAnswers(parsed.cardAnswers);
    setRequirementSummary(undefined);
    setSubmittedPrompt(`${submittedPrompt}；补充：${trimmed}`);
    setClarificationInputNotice(
      parsed.recognizedLabels.length
        ? `已更新需求：${parsed.recognizedLabels.join("、")}。`
        : "已把这句话追加到本轮需求里，确认后会重新进入规划。"
    );
  }

  function openPromptEditor() {
    setPromptEditDraft(submittedPrompt);
    setPromptEditorOpen(true);
    setKeyboardOpen(false);
  }

  function cancelPromptEditor() {
    setPromptEditorOpen(false);
    setPromptEditDraft("");
  }

  function resubmitEditedPrompt() {
    const nextPrompt = promptEditDraft.trim();
    if (!nextPrompt) {
      return;
    }

    setPromptEditorOpen(false);
    setPromptEditDraft("");
    setSubmittedPrompt(nextPrompt);
    startInteractionRequest(nextPrompt, {
      plan_mode: routePlanningEnabled
    });
  }

  function selectPlan(planId: string) {
    setSelectedPlanId(planId);
    resetRefinementCount();
    const nextPlan = plans.find((plan) => plan.id === planId);
    setExpandedStopId(nextPlan?.stops[0]?.poiId);
    setSelectedTraceEventId(
      activeTrace?.events.find((event) => event.type === "route_scored" && event.output?.selected_plan_id === planId)?.id ??
        activeTrace?.events.find((event) => event.type === "route_scored")?.id ??
        "trace-event-011"
    );
  }

  function handleSwiperChange(swiper: SwiperInstance) {
    const nextPlan = plans[swiper.activeIndex];
    if (nextPlan) {
      selectPlan(nextPlan.id);
    }
  }

  function refineCurrentPlan(instruction?: string) {
    const text = (instruction ?? draft).trim();
    if (!text || !selectedPlan) {
      return;
    }

    setDraft("");
    setKeyboardOpen(false);
    setMobileView("refining");
    setSelectedTraceEventId(activeTrace?.events.find((event) => event.type === "user_refinement_received")?.id ?? "trace-event-012");
    const traceForRefine = useDemoStore.getState().activeTrace;
    planningRequestStartedAtRef.current = Date.now();
    planningMinimumDurationRef.current = 400;
    // 统一走 /interactions/respond，带上 interaction_context 标明当前方案页
    interactionMutation.mutate({
      user_id: dataAuthorizationEnabled && activeUserId ? activeUserId : "anonymous",
      message: text,
      city: activeMockLocation?.city ?? "北京",
      plan_mode: true,
      interaction_context: {
        page: "plans",
        trace_id: traceForRefine?.id,
        route_id: selectedPlan.id,
        selected_plan_id: selectedPlan.id
      },
      constraints: dataAuthorizationEnabled
        ? Array.from(new Set(["约会", "看展", ...userPreferences.map((preference) => preference.label)]))
        : ["约会", "看展"],
      preference_detection_enabled: preferenceDetectionEnabled
    });
  }

  function choosePlan() {
    if (!selectedPlan) {
      return;
    }
    setKeyboardOpen(false);
    setMobileView("selected");
    setHomeSyncedPlanId(selectedPlan.id);
    setSelectedTransportMode("taxi");
    setExpandedStopId(selectedPlan.stops[0]?.poiId);
    setSelectedTraceEventId(activeTrace?.events.find((event) => event.type === "run_completed")?.id ?? "trace-event-012");
  }

  function updateFlowIndexFromScroll(target: HTMLElement) {
    if (flowIndexFrameRef.current !== undefined) {
      return;
    }

    flowIndexFrameRef.current = window.requestAnimationFrame(() => {
      flowIndexFrameRef.current = undefined;
      updateFlowIndexFromScrollNow(target);
    });
  }

  function updateFlowIndexFromScrollNow(target: HTMLElement) {
    const blocks = Array.from(target.querySelectorAll<HTMLElement>("[data-flow-block]"));
    if (!blocks.length) {
      const { scrollTop, clientHeight } = target;
      setFlowIndex(Math.max(0, Math.round(scrollTop / Math.max(clientHeight, 1))));
      return;
    }

    const containerTop = target.getBoundingClientRect().top;
    const nextIndex = blocks.reduce(
      (best, block, index) => {
        const distance = Math.abs(block.getBoundingClientRect().top - containerTop);
        return distance < best.distance ? { index, distance } : best;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY }
    ).index;
    setFlowIndex(nextIndex);
  }

  return (
    <IPhoneFrame>
      <div
        className="relative flex h-full flex-col overflow-hidden bg-white"
        onPointerDown={(event) => {
          if (!keyboardOpen) {
            return;
          }
          const target = event.target as HTMLElement;
          if (target.closest("[data-mobile-composer]")) {
            return;
          }
          setKeyboardOpen(false);
        }}
      >
        {mobileView === "entry" ? (
          <EntryView
            syncedPlan={plans.find((plan) => plan.id === homeSyncedPlanId)}
            onSearch={enterSearch}
            onUltraEnter={enterStart}
            onOpenSyncedPlan={() => {
              if (homeSyncedPlanId) {
                setSelectedPlanId(homeSyncedPlanId);
                setMobileView("selected");
              }
            }}
          />
        ) : mobileView === "searching" ? (
          <SearchTransitionView
            draft={draft}
            setDraft={setDraft}
            onBack={() => setMobileView("entry")}
            onUltraEnter={() => submitSearchQuestion(draft || presetPrompts[0])}
            onOpenUltraHome={enterStart}
            routePlanningEnabled={routePlanningEnabled}
            onRoutePlanningToggle={() => setRoutePlanningEnabled((enabled) => !enabled)}
          />
        ) : (
          <>
            {mobileView === "start" && <DzAiBackground />}
            {mobileView !== "start" && <ShellEdgeGlass />}
            <MobileHeader
              title={mobileView === "selected" && selectedPlan ? selectedPlan.title : "点仔 Ultra"}
              hideLogo={shouldShowPromptSummary}
              onBack={() => {
                if (expandedPlanId) {
                  setExpandedPlanId(undefined);
                  return;
                }
                if (mobileView === "start") {
                  setMobileView("entry");
                  return;
                }
                if (mobileView === "selected") {
                  setMobileView("plans");
                  return;
                }
                resetMobileDemo();
              }}
              onSettings={() => {
                setKeyboardOpen(false);
                setHistoryPageOpen(false);
                setSettingsDrawerOpen(true);
              }}
            />
            <main
              data-mobile-flow="true"
              ref={flowMainRef}
              onScroll={(event) => updateFlowIndexFromScroll(event.currentTarget)}
              className={cn(
                "absolute inset-0 z-10 overflow-y-auto overscroll-contain px-4 pt-[120px] pb-[160px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-y snap-proximity [&_[data-flow-block]]:scroll-mt-[260px]",
                mobileView === "start" && "px-[42px] pt-[120px] pb-[100px]"
              )}
              style={
                mobileView !== "start"
                  ? {
                      maskImage:
                        "linear-gradient(to bottom, transparent 0%, black var(--dz-mask-fade-top, 18px), black calc(100% - var(--dz-mask-fade-bottom, 28px)), transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to bottom, transparent 0%, black var(--dz-mask-fade-top, 18px), black calc(100% - var(--dz-mask-fade-bottom, 28px)), transparent 100%)",
                      WebkitOverflowScrolling: "touch"
                    }
                  : { WebkitOverflowScrolling: "touch" }
              }
            >
              {/* 欢迎页：用户提交后淡出，但不被替换 */}
              <AnimatePresence>
                {mobileView === "start" && !hasEnteredPlanning && (
                  <StartView
                    keyboardOpen={keyboardOpen}
                    onSubmit={submitPrompt}
                  />
                )}
              </AnimatePresence>

              {/* 普通问答视图 */}
              <AnimatePresence>
                {mobileView === "answering" && (
                  <DirectAnswerView answer={directAnswer} apiNotice={apiNotice} onConvertToPlan={() => submitSearchQuestion(directAnswer?.question ?? submittedPrompt)} />
                )}
              </AnimatePresence>

              {/* 规划流内容块：一旦进入就保持挂载，块只追加不替换 */}
              {hasEnteredPlanning && (
                <PlanningConversationView
                  view={mobileView}
                  prompt={submittedPrompt}
                  apiNotice={apiNotice}
                  steps={runningAgentSteps}
                  activeAgentStep={activeAgentStep}
                  clarification={clarification}
                  confirmedClarification={confirmedClarification}
                  cards={dynamicClarificationCards}
                  confirmedCards={confirmedClarificationCards}
                  cardAnswers={clarificationCardAnswers}
                  confirmedCardAnswers={confirmedClarificationCardAnswers}
                  inputNotice={clarificationInputNotice}
                  hasConfirmedClarification={hasConfirmedClarification}
                  hasConfirmedSummary={hasConfirmedSummary}
                  postClarificationStep={postClarificationStep}
                  runningAgentChainVisible={runningAgentChainVisible}
                  requirementSummary={requirementSummary}
                  plans={plans}
                  selectedPlan={selectedPlan}
                  highlightedStopId={highlightedStopId}
                  isRefining={mobileView === "refining"}
                  expandedPlanId={expandedPlanId}
                  activeTransport={activeTransport}
                  selectedTransportMode={selectedTransportMode}
                  expandedStopId={expandedStopId}
                  completedTodoIds={completedTodoIds}
                  onEditPrompt={openPromptEditor}
                  durationMs={activeTrace?.total_duration_ms ?? 0}
                  onAgentStepClick={(agentName) => {
                    setActiveAgentStep(agentName);
                    const event = activeTrace?.events?.find((e) => e.agent === agentName);
                    if (event) setSelectedTraceEventId(event.id);
                  }}
                  setClarification={setClarification}
                  setCardAnswers={setClarificationCardAnswers}
                  onConfirmClarification={confirmClarification}
                  onConfirmSummary={confirmSummary}
                  onExpandPlan={setExpandedPlanId}
                  onCloseExpandedPlan={() => setExpandedPlanId(undefined)}
                  onSlideChange={handleSwiperChange}
                  onSelectPlan={selectPlan}
                  onQuickRefine={refineCurrentPlan}
                  onChoose={choosePlan}
                  setSelectedTransportMode={setSelectedTransportMode}
                  setExpandedStopId={setExpandedStopId}
                  toggleTodo={toggleTodo}
                />
              )}
            </main>
            <AnimatePresence>
              {settingsDrawerOpen && (
                <SettingsDrawer
                  onClose={() => {
                    setSettingsDrawerOpen(false);
                    setHistoryPageOpen(false);
                  }}
                  onNewChat={() => {
                    resetMobileDemo();
                    setMobileView("start");
                    setDraft("");
                    setKeyboardOpen(false);
                    setHistoryPageOpen(false);
                    setSettingsDrawerOpen(false);
                  }}
                  onOpenHistory={() => setHistoryPageOpen(true)}
                  traces={sidebarTraces}
                  onSelectTrace={handleSelectTrace}
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {historyPageOpen && (
                <ConversationHistoryPage
                  onBack={() => setHistoryPageOpen(false)}
                  onClose={() => {
                    setHistoryPageOpen(false);
                    setSettingsDrawerOpen(false);
                  }}
                  traces={sidebarTraces}
                  onSelectTrace={handleSelectTrace}
                />
              )}
            </AnimatePresence>
            <PromptCapsule
              summary={promptSummary}
              entries={promptEntries}
              scrollContainerRef={flowMainRef}
              topOffset={68}
              active={shouldShowPromptSummary}
              onEdit={openPromptEditor}
            />
            <AnimatePresence>
              {promptSheetOpen && (
                <PromptSheet
                  prompt={submittedPrompt}
                  summary={promptSummary}
                  clarification={clarification}
                  onClose={() => setPromptSheetOpen(false)}
                  onEdit={() => {
                    setPromptSheetOpen(false);
                    openPromptEditor();
                  }}
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {promptEditorOpen && (
                <PromptEditorOverlay
                  value={promptEditDraft}
                  onChange={setPromptEditDraft}
                  onCancel={cancelPromptEditor}
                  onSubmit={resubmitEditedPrompt}
                />
              )}
            </AnimatePresence>
            <FlowPageIndicator
              hidden={mobileView === "settings" || !!expandedPlanId}
              count={flowBlockCount}
              activeIndex={flowIndex}
              onJump={(index) => {
                const target = flowMainRef.current;
                if (!target) {
                  return;
                }
                const blocks = Array.from(target.querySelectorAll<HTMLElement>("[data-flow-block]"));
                const block = blocks[index];
                if (block) {
                  scrollFlowBlockIntoView(target, block);
                  return;
                }
                target.scrollTo({ top: index * target.clientHeight, behavior: "smooth" });
              }}
            />
            {/* 方案页底部固定按钮：浮在输入框之上 */}
            {(mobileView === "plans" || mobileView === "refining") && selectedPlan && !expandedPlanId && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-[72px] left-0 right-0 z-30 px-4"
              >
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    choosePlan();
                  }}
                  className="w-full rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur"
                  style={{ background: "rgba(255, 102, 43, 0.9)", border: "1px solid #FFFFFF", boxShadow: "0px 8px 32px rgba(48, 104, 156, 0.1)" }}
                >
                  选用此方案
                </button>
              </motion.div>
            )}

            {/* 微调 Toast 反馈 */}
            {refinementToast && (
              <div className="absolute bottom-[72px] left-0 right-0 z-40 flex justify-center pointer-events-none">
                <div className="rounded-lg bg-black/75 px-4 py-2 text-[13px] leading-5 text-white shadow-lg">
                  {refinementToast}
                </div>
              </div>
            )}

            {/* 连续微调保护提示 */}
            {refinementCount >= 5 && (mobileView === "plans" || mobileView === "refining") && (
              <div className="absolute bottom-[72px] left-0 right-0 z-30 flex justify-center">
                <button
                  onClick={() => {
                    resetRefinementCount();
                    submitSearchQuestion(submittedPrompt);
                  }}
                  className="rounded-lg bg-amber-500/90 px-4 py-2 text-[13px] leading-5 text-white shadow-lg backdrop-blur"
                >
                  需要我重新帮你规划吗？
                </button>
              </div>
            )}

            <MobileComposer
              view={mobileView}
              draft={draft}
              setDraft={setDraft}
              inputMode={inputMode}
              setInputMode={setInputMode}
              keyboardOpen={keyboardOpen}
              setKeyboardOpen={setKeyboardOpen}
              voicePressed={voicePressed}
              setVoicePressed={setVoicePressed}
              onSubmit={(voiceText) => {
                const composerText = voiceText ?? draft;
                if (mobileView === "plans" || mobileView === "refining" || mobileView === "selected") {
                  refineCurrentPlan(composerText);
                  return;
                }
                if (mobileView === "start" || mobileView === "answering" || mobileView === "running") {
                  submitSearchQuestion(composerText);
                  return;
                }
                if (mobileView === "clarifying") {
                  applyClarificationFreeformInput(composerText);
                  setDraft("");
                  return;
                }
                if (mobileView === "summary") {
                  applySummaryFreeformInput(composerText);
                  setDraft("");
                }
              }}
              routePlanningEnabled={routePlanningEnabled}
              onRoutePlanningToggle={() => setRoutePlanningEnabled((enabled) => !enabled)}
            />
          </>
        )}
      </div>
    </IPhoneFrame>
  );
}

function IPhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto h-[920px] w-[450px] shrink-0">
      {/* 内容层：402px 居中 */}
      <div className="absolute bottom-[23px] left-0 right-0 top-[23px] z-0 flex justify-center overflow-hidden">
        <div className="h-full w-[402px] overflow-hidden rounded-[48px] bg-white">
          {children}
        </div>
      </div>
      {/* Bezel 层：450px 覆盖 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 bg-contain bg-center bg-no-repeat drop-shadow-[0_28px_70px_rgba(20,20,20,0.24)]"
        style={{ backgroundImage: "url('/demo-assets/iphone-bezel.png')", backgroundSize: '450px 920px' }}
      />
    </div>
  );
}

function scrollFlowBlockIntoView(target: HTMLElement, block?: HTMLElement | null) {
  if (!block) {
    return;
  }

  // 计算目标位置：让块顶部对齐到视口 30% 处（中间偏上）
  const targetRect = target.getBoundingClientRect();
  const blockRect = block.getBoundingClientRect();
  const snapOffset = Math.round(targetRect.height * 0.3);
  const top = Math.max(0, target.scrollTop + blockRect.top - targetRect.top - snapOffset);
  // 使用 smooth 滚动，让 CSS snap 自然接管减速和吸附
  target.scrollTo({ top, behavior: "smooth" });
}

function EntryView({
  syncedPlan,
  onSearch,
  onUltraEnter,
  onOpenSyncedPlan
}: {
  syncedPlan?: DemoRoutePlan;
  onSearch: () => void;
  onUltraEnter: () => void;
  onOpenSyncedPlan: () => void;
}) {
  const [nearbyPage, setNearbyPage] = useState(0);
  const servicePages: ServiceItem[][] = [
    [
      { src: "/dianping-assets/find-nearby/food.png", label: "美食" },
      { src: "/dianping-assets/find-nearby/leisure.png", label: "休闲玩乐" },
      { src: "/dianping-assets/find-nearby/hotel.png", label: "酒店民宿" },
      { src: "/dianping-assets/find-nearby/scenic.png", label: "景点游玩" },
      { src: "/dianping-assets/find-nearby/movie.png", label: "电影演出" },
      { src: "/dianping-assets/find-nearby/medical.png", label: "医疗口腔" },
      { src: "/dianping-assets/find-nearby/deal.png", label: "特价团" },
      { src: "/dianping-assets/find-nearby/shopping.png", label: "商场购物" },
      { src: "/dianping-assets/find-nearby/massage.png", label: "按摩足疗" },
      { src: "/dianping-assets/find-nearby/haircut.png", label: "男士理发" }
    ],
    [
      { src: "/dianping-assets/find-nearby/waimai.png", label: "美团外卖" },
      { src: "/dianping-assets/find-nearby/flash.png", label: "闪购" },
      { src: "/dianping-assets/find-nearby/supermarket.png", label: "小象超市" },
      { src: "/dianping-assets/find-nearby/medical.png", label: "看病买药" },
      { src: "/dianping-assets/find-nearby/ktv.png", label: "KTV" },
      { src: "/dianping-assets/find-nearby/beauty-spa.jpg", label: "美容SPA", framed: true },
      { src: "/dianping-assets/find-nearby/cosmetic.png", label: "医美" },
      { src: "/dianping-assets/find-nearby/bath.png", label: "洗浴汗蒸" },
      { src: "/dianping-assets/find-nearby/fitness.png", label: "游泳健身" },
      { src: "/dianping-assets/find-nearby/family.png", label: "亲子乐园" },
      { src: "/dianping-assets/find-nearby/life.png", label: "生活服务" },
      { src: "/dianping-assets/find-nearby/pet.png", label: "宠物" },
      { src: "/dianping-assets/find-nearby/taxi.png", label: "美团打车" },
      { src: "/dianping-assets/find-nearby/qualification.jpg", label: "资质规则", framed: true },
      { src: "/dianping-assets/find-nearby/all.png", label: "全部服务" }
    ]
  ];

  function handleNearbyScroll(event: UIEvent<HTMLDivElement>) {
    const { scrollLeft, clientWidth } = event.currentTarget;
    const nextPage = Math.max(0, Math.min(1, Math.round(scrollLeft / clientWidth)));
    if (nextPage !== nearbyPage) {
      setNearbyPage(nextPage);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-[#20283a]">
      <div className="shrink-0 bg-white pb-2">
        <DianpingStatusBar />
        <div className="px-4">
          <div className="mt-4 flex items-end justify-between text-[17px] font-black text-[#566074]">
            {["关注", "北京", "附近", "品质外卖", "热点", "周末去哪"].map((tab) => (
              <button
                key={tab}
                className={cn(
                  "relative pb-2 tracking-normal",
                  tab === "北京" && "text-[#1f2738] after:absolute after:bottom-0 after:left-1/2 after:h-[2px] after:w-5 after:-translate-x-1/2 after:rounded-full after:bg-[#f26b43]"
                )}
              >
                {tab}
                {tab === "北京" && <span className="ml-1 text-[12px] text-[#8a91a0]">⌄</span>}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-[42px_1fr] items-center gap-3">
            <button className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-gradient-to-b from-[#ffb3a3] to-[#ffef6b] text-[11px] font-black text-[#f05a2a] shadow-sm">
              签到
            </button>
            <motion.button
              layoutId="dianping-search-box"
              whileTap={{ scale: 0.98 }}
              onClick={onSearch}
              className="grid h-12 grid-cols-[34px_1fr_42px_78px] items-center rounded-full border-[2px] border-[#f26b43] bg-white pl-3 text-left shadow-[0_1px_0_rgba(242,107,67,0.12)]"
            >
              <span
                className="h-5 w-5 bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/dianping-assets/home-titlebar-scan.png')" }}
              />
              <span className="truncate text-[17px] font-black text-[#20283a]">帮我规划今天去哪玩</span>
              <span
                className="h-6 w-6 bg-contain bg-center bg-no-repeat opacity-70"
                style={{ backgroundImage: "url('/dianping-assets/home-titlebar-camera.png')" }}
              />
              <span className="mr-[3px] rounded-full bg-[#f26b43] px-4 py-2 text-center text-[17px] font-black text-white">
                搜索
              </span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[84px]">
        <motion.div
          animate={{ height: nearbyPage === 1 ? 250 : 190 }}
          transition={{ type: "spring", stiffness: 360, damping: 34 }}
          className="-mx-3 overflow-hidden pt-3"
        >
          <div
            onScroll={handleNearbyScroll}
            className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {servicePages.map((services, pageIndex) => (
              <div
                key={pageIndex}
                className={cn(
                  "grid w-full shrink-0 snap-start grid-cols-5 gap-x-2 px-3",
                  pageIndex === 1 ? "grid-rows-3 gap-y-2" : "grid-rows-2 gap-y-3"
                )}
              >
                {services.map((item) => (
                  <button key={item.label} className="h-[78px] text-center">
                    <ServiceIcon src={item.src} framed={item.framed} />
                    <span className="mt-1.5 block whitespace-nowrap text-[13px] font-black leading-none text-[#2f3747]">{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </motion.div>
        <div className="mx-auto mt-3 h-1.5 w-9 rounded-full bg-[#e0e0e0]">
          <motion.div
            className="h-full w-4 rounded-full bg-[#f26b43]"
            animate={{ x: nearbyPage === 1 ? 20 : 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          />
        </div>

        <button
          onClick={onUltraEnter}
          className="mt-4 w-full"
        >
          <img
            src="/dianping-assets/banner.png"
            alt="点仔 Ultra · 本地路线智能规划"
            className="w-full rounded-2xl shadow-sm"
          />
        </button>

        {syncedPlan && (
          <button
            onClick={onOpenSyncedPlan}
            className="mt-3 w-full rounded-2xl border border-[#dbe6ff] bg-[#f2f6ff] px-3 py-3 text-left shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-black text-[#4f68ff]">您有一个预定好的计划</div>
                <div className="mt-1 truncate text-[15px] font-black text-[#20283a]">{syncedPlan.title}</div>
                <div className="mt-1 truncate text-[12px] font-semibold text-[#64708a]">
                  距出发 1h20m · 第一站 {syncedPlan.stops[0]?.poiName}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#4f68ff]" />
            </div>
          </button>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <PromoCard title="点评榜单" subtitle="吃喝玩乐指南" shop="李串串老店" meta="热门榜第1名  1.0km" warm />
          <PromoCard title="免费试" subtitle="今日43万个名额" shop="半重山老火锅双人套" meta="¥0  ¥273  994m" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <FeedCard
            title="超盒算NB北京首店来望京新世界了"
            author="旅行达人 徐"
            likes="6"
            distance="746m"
            tone="red"
          />
          <FeedCard
            title="望京悠乐汇 频繁出入的人是在干什么的？"
            author="三个诸葛亮力..."
            likes="5"
            distance=""
            tone="building"
          />
          <FeedCard
            title="从咖啡到小吃，望京这条街很适合下午走走"
            author="北京探店局"
            likes="18"
            distance="1.2km"
            tone="coffee"
          />
          <FeedCard
            title="今晚约会不踩雷，三站刚刚好"
            author="点仔精选"
            likes="31"
            distance="2.0km"
            tone="food"
          />
        </div>
      </div>

      <DianpingBottomBar />
    </div>
  );
}

function ServiceIcon({ src, framed = false }: { src: string; framed?: boolean }) {
  if (framed) {
    return (
      <span className="mx-auto flex h-[49px] w-[49px] items-center justify-center overflow-hidden rounded-2xl bg-[#fbfbfa]">
        <span
          className="block h-[56px] w-[56px] scale-[1.08] bg-cover bg-center bg-no-repeat mix-blend-multiply"
          style={{ backgroundImage: `url('${src}')` }}
        />
      </span>
    );
  }

  return (
    <span
      className="mx-auto block h-[49px] w-[49px] bg-contain bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${src}')` }}
    />
  );
}

function DianpingStatusBar() {
  return (
    <div
      aria-label="iPhone 状态栏"
      className="h-[62px] w-full shrink-0 bg-contain bg-top bg-no-repeat"
      style={{ backgroundImage: "url('/dianping-assets/status-bar.png')" }}
    />
  );
}

function PromoCard({
  title,
  subtitle,
  shop,
  meta,
  warm = false
}: {
  title: string;
  subtitle: string;
  shop: string;
  meta: string;
  warm?: boolean;
}) {
  return (
    <section className={cn("rounded-2xl border bg-white p-3", warm ? "border-[#ffe5c4]" : "border-[#ffe0ea]")}>
      <div className="mb-3 flex items-center gap-1 text-[15px] font-black">
        <span>{title}</span>
        <span className={cn("text-[12px] font-bold", warm ? "text-[#b98743]" : "text-[#59647a]")}>{subtitle}</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#a5a8af]" />
      </div>
      <div className="flex items-center gap-3">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg text-[11px] font-black text-white", warm ? "bg-[#c82922]" : "bg-[#d42f21]")}>
          {warm ? "李串串" : "火锅"}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-black text-[#20283a]">{shop}</div>
          <div className="mt-1 truncate text-[13px] font-semibold text-[#f26b43]">{meta}</div>
        </div>
      </div>
    </section>
  );
}

function FeedCard({
  title,
  author,
  likes,
  distance,
  tone
}: {
  title: string;
  author: string;
  likes: string;
  distance: string;
  tone: "red" | "building" | "coffee" | "food";
}) {
  const toneClass = {
    red: "from-[#6d1d27] via-[#df2635] to-[#ff6e53]",
    building: "from-[#d8e0e5] via-[#b8c3ce] to-[#8c99a8]",
    coffee: "from-[#e6e0d5] via-[#bfc3bd] to-[#6f7777]",
    food: "from-[#f8c27d] via-[#ae5f3f] to-[#40231d]"
  }[tone];

  return (
    <article className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className={cn("relative h-44 bg-gradient-to-br", toneClass)}>
        {distance && (
          <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-bold text-white">
            {distance}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-[16px] font-black leading-6 text-[#20283a]">{title}</h3>
        <div className="mt-3 flex items-center justify-between text-[12px] font-semibold text-[#687083]">
          <span className="truncate">{author}</span>
          <span className="flex items-center gap-1">♡ {likes}</span>
        </div>
      </div>
    </article>
  );
}

function DianpingBottomBar() {
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-20 grid h-[76px] grid-cols-5 items-center border-t border-[#f0f0f0] bg-white px-4 text-center text-[18px] font-black text-[#888d96]">
      <span className="text-[#f26b43]">
        首页
      </span>
      <span>地图</span>
      <button
        className="mx-auto h-16 w-16 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/dianping-assets/tabbar-plus.png')" }}
        aria-label="发布"
      >
        <span className="sr-only">发布</span>
      </button>
      <span>消息</span>
      <span>我的</span>
    </nav>
  );
}

function SearchTransitionView({
  draft,
  setDraft,
  onBack,
  onUltraEnter,
  onOpenUltraHome,
  routePlanningEnabled,
  onRoutePlanningToggle
}: {
  draft: string;
  setDraft: (value: string) => void;
  onBack: () => void;
  onUltraEnter: () => void;
  onOpenUltraHome: () => void;
  routePlanningEnabled: boolean;
  onRoutePlanningToggle: () => void;
}) {
  const [isAskMode, setIsAskMode] = useState(false);
  const [askTab, setAskTab] = useState<"try" | "recent">("try");
  const [swipePull, setSwipePull] = useState(0);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const historyWords = ["有小提琴表演的餐厅", "附近哪里逛街好逛", "周末去哪玩比较好", "小厨娘淮扬菜", "绿茶"];
  const searchDiscover = [
    ["喜上头头皮护理", "附近"],
    ["望京新世界百货", ""],
    ["免费试入口", ""],
    ["adidas旗舰店", ""],
    ["达美乐比萨", ""],
    ["周末休闲好去处", ""],
    ["0元免费探店", ""],
    ["望京华彩万象汇", ""]
  ];
  const hotRanks = [
    ["苏式绿豆汤到底什么味", "265.4万"],
    ["西湖最美时节便是荷花绽放时", "265.0万"],
    ["夏日升温来一场漂流吧", "258.8万"],
    ["高考加油冲刺复习", "255.7万"],
    ["田曦薇同款4KLive好出片", "254.2万"],
    ["水蜜桃上市了这口甜等了一整年", "253.4万"],
    ["独库公路今日正式解除冬季封闭", "253.0万"],
    ["金庸笔下卧龙谷夯爆了", "252.6万"]
  ];
  const askSuggestions = [
    ["有驻唱表演的音乐餐吧", "#选店攻略"],
    ["酒仙桥商圈露台夜景清吧", "#周边探索"],
    ["大山子口碑最好粤菜馆", "#口碑推荐"],
    ["附近有营业中的便利店吗", "#周边探索"],
    ["周末有什么展览可以看", "#玩乐出游"],
    ["工作日晚上适合去哪玩", "#玩乐出游"],
    ["吃饭唱歌一体的餐厅", "#选店攻略"],
    ["人气西餐厅Top3", "#口碑推荐"]
  ];
  const recentQuestions = [
    "大山子适合宴请的日料店",
    "有小提琴表演的餐厅",
    "附近哪里逛街好逛",
    "我有五个人，明天下午有五个小时空闲时间，你帮我安排",
    "周末去哪玩比较好"
  ];

  function handleSearchAction() {
    if (isAskMode) {
      onUltraEnter();
      return;
    }
    setIsAskMode(true);
    setAskTab("try");
  }

  function beginAiSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    swipeStartXRef.current = event.clientX;
    swipeStartYRef.current = event.clientY;
    setSwipePull(0);
  }

  function moveAiSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) {
      return;
    }
    const deltaX = swipeStartXRef.current - event.clientX;
    const deltaY = Math.abs(swipeStartYRef.current - event.clientY);
    if (deltaX <= 0 || deltaY > 42) {
      setSwipePull(0);
      return;
    }
    setSwipePull(Math.min(52, deltaX * 0.35));
  }

  function finishAiSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) {
      return;
    }
    const deltaX = swipeStartXRef.current - event.clientX;
    const deltaY = Math.abs(swipeStartYRef.current - event.clientY);
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    setSwipePull(0);
    if (deltaX > 86 && deltaY < 64) {
      onOpenUltraHome();
    }
  }

  return (
    <motion.div
      key="searching"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-full flex-col overflow-hidden bg-[#f6f6f7] text-[#20283a]"
      onPointerDown={beginAiSwipe}
      onPointerMove={moveAiSwipe}
      onPointerUp={finishAiSwipe}
      onPointerCancel={() => {
        swipeStartXRef.current = null;
        swipeStartYRef.current = null;
        setSwipePull(0);
      }}
    >
      <div className="shrink-0 bg-[#f6f6f7] pb-2">
        <DianpingStatusBar />
        <div className="px-3">
          <motion.div
            layoutId="dianping-search-box"
            className={cn(
              "mt-2 rounded-[18px] border-[2px] bg-white px-2.5 py-2 shadow-[0_1px_0_rgba(0,0,0,0.03)]",
              isAskMode ? "border-[#6868ff]" : "border-[#f26b43]"
            )}
          >
            <div className="grid grid-cols-[22px_1fr] items-center gap-1">
              <button onClick={onBack} className="flex h-7 w-7 items-center justify-center text-[#6d7482]">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearchAction();
                  }
                }}
                placeholder={isAskMode ? "能免费停车的咖啡厅" : "免费试入口"}
                className="h-7 min-w-0 bg-transparent text-[16px] font-semibold text-[#20283a] outline-none placeholder:text-[#c2c5cc]"
              />
            </div>
            <div className={cn("mt-2 grid items-center gap-2", isAskMode ? "grid-cols-[1fr_96px_62px]" : "grid-cols-[1fr_34px_62px]")}>
              <button
                onClick={() => {
                  setIsAskMode(!isAskMode);
                  setAskTab("try");
                }}
                className={cn(
                  "flex h-6 w-fit items-center rounded-full px-2 transition",
                  isAskMode ? "bg-[#eef0ff]" : "bg-[#f0f1f3]"
                )}
              >
                <span
                  aria-label={isAskMode ? "问点仔 AI 已开启" : "问点仔 AI 未开启"}
                  className="block h-4 w-[79px] bg-contain bg-left bg-no-repeat"
                  style={{
                    backgroundImage: `url('/dianping-assets/${isAskMode ? "问点仔AI_彩色Logo.png" : "问点仔AI_黑白Logo.png"}')`
                  }}
                />
                <span
                  className={cn(
                    "relative ml-1 h-3.5 w-6 rounded-full transition-colors",
                    isAskMode ? "bg-[#5f6dff]" : "bg-[#bfc3ca]"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform",
                      isAskMode ? "left-3" : "left-0.5"
                    )}
                  />
                </span>
              </button>
              {isAskMode ? (
                <motion.button
                  type="button"
                  aria-label={routePlanningEnabled ? "路线规划已开启" : "路线规划已关闭"}
                  aria-pressed={routePlanningEnabled}
                  onClick={onRoutePlanningToggle}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="h-[25px] w-[96px] bg-contain bg-center bg-no-repeat"
                  style={{
                    backgroundImage: `url('/dianping-assets/${routePlanningEnabled ? "路线规划按钮开启态.png" : "路线规划按钮关闭态.png"}')`
                  }}
                />
              ) : (
                <span
                  className="mx-auto h-6 w-6 bg-contain bg-center bg-no-repeat opacity-80"
                  style={{ backgroundImage: "url('/dianping-assets/home-titlebar-camera.png')" }}
                />
              )}
              <button
                onClick={handleSearchAction}
                className={cn(
                  "h-8 rounded-full text-[14px] font-semibold text-white",
                  isAskMode ? "bg-[#4f68ff]" : "bg-[#f26b43]"
                )}
              >
                {isAskMode ? "提问" : "搜索"}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[356px] pt-3">
        <AnimatePresence mode="wait">
          {!isAskMode ? (
            <motion.div
              key="search-mode"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[15px] font-black">历史搜索</h3>
                  <span className="text-[13px] text-[#a3a8b1]">⌫</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {historyWords.map((word) => (
                    <button
                      key={word}
                      onClick={() => setDraft(word)}
                      className="flex h-8 items-center gap-1 rounded-full bg-[#eef0f4] px-3 text-[12px] font-bold text-[#626a78]"
                    >
                      <Sparkles className="h-3 w-3 text-[#5f67ff]" />
                      {word}
                    </button>
                  ))}
                  <button className="flex h-8 items-center rounded-full bg-[#eef0f4] px-2 text-[#7c8492]">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </section>

              <section className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[15px] font-black">搜索发现</h3>
                  <span className="text-[13px] font-bold text-[#a3a8b1]">↻ ···</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[14px] font-semibold text-[#20283a]">
                  {searchDiscover.map(([word, tag]) => (
                    <button key={word} onClick={() => setDraft(word)} className="truncate text-left">
                      {word}
                      {tag && <span className="ml-1 text-[11px] text-[#f26b43]">{tag}</span>}
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-5 overflow-hidden rounded-[10px] border border-[#ffd9ce] bg-white">
                <div className="bg-gradient-to-r from-[#fff0e9] to-white px-3 py-3 text-[16px] font-black text-[#f06442]">
                  🔥 点评热点
                </div>
                <div className="divide-y divide-[#f1f1f1] px-3">
                  {hotRanks.map(([topic, heat], index) => (
                    <button
                      key={topic}
                      onClick={() => setDraft(topic)}
                      className="grid w-full grid-cols-[24px_1fr_62px] items-center gap-1 py-2.5 text-left text-[13px]"
                    >
                      <span className={cn("font-black", index < 3 ? "text-[#ff7a30]" : "text-[#a5aab3]")}>{index + 1}</span>
                      <span className="truncate font-semibold text-[#242b39]">{topic}</span>
                      <span className="text-right text-[12px] font-semibold text-[#ef6b45]">{heat}</span>
                    </button>
                  ))}
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="ask-mode"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <div className="mb-3 flex items-center gap-7 text-[15px] font-black">
                <button
                  onClick={() => setAskTab("try")}
                  className={cn("relative pb-1", askTab === "try" ? "text-[#20283a]" : "text-[#8f96a3]")}
                >
                  试试这样问
                  {askTab === "try" && (
                    <motion.span
                      layoutId="ask-tab-underline"
                      className="absolute bottom-0 left-1/2 h-0.5 w-9 -translate-x-1/2 rounded-full bg-[#4f68ff]"
                    />
                  )}
                </button>
                <button
                  onClick={() => setAskTab("recent")}
                  className={cn("relative pb-1", askTab === "recent" ? "text-[#20283a]" : "text-[#8f96a3]")}
                >
                  你最近问过
                  {askTab === "recent" && (
                    <motion.span
                      layoutId="ask-tab-underline"
                      className="absolute bottom-0 left-1/2 h-0.5 w-9 -translate-x-1/2 rounded-full bg-[#4f68ff]"
                    />
                  )}
                </button>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                {askTab === "try" ? (
                  <motion.div
                    key="ask-try"
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="grid grid-cols-2 gap-2"
                  >
                    {askSuggestions.map(([title, tag], index) => (
                      <motion.button
                        key={title}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.025, duration: 0.2 }}
                        onClick={() => setDraft(title)}
                        className="min-h-[58px] rounded-lg bg-[#eef1f6] px-3 py-2 text-left"
                      >
                        <span className="block text-[13px] font-black leading-5 text-[#20283a]">{title}</span>
                        <span className="mt-1 block text-[11px] font-semibold text-[#8b94a3]">{tag}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="ask-recent"
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 18 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden rounded-lg bg-[#eef1f6]"
                  >
                    {recentQuestions.map((question, index) => (
                      <motion.button
                        key={question}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03, duration: 0.18 }}
                        onClick={() => setDraft(question)}
                        className="grid w-full grid-cols-[18px_1fr_16px] items-center gap-2 border-b border-white/70 px-3 py-3 text-left text-[13px] font-black last:border-b-0"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[#5f67ff]" />
                        <span className="truncate">{question}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-[#a0a7b2]" />
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={() => setIsAskMode(true)}
        className="absolute bottom-[362px] right-4 z-20 flex h-9 items-center gap-1 rounded-full bg-white px-3 text-[13px] font-black text-[#5065ff] shadow-[0_4px_18px_rgba(80,101,255,0.2)]"
      >
        <Mic className="h-4 w-4" />
        语音搜
      </button>
      <motion.div
        className="absolute right-0 top-[248px] z-20 flex h-[148px] w-8 items-center justify-center overflow-visible"
        aria-label="左滑进入 AI 规划"
        style={{ transform: `translateX(${-swipePull}px)` }}
      >
        <span className="absolute inset-y-0 left-0 w-[200vw] bg-white/78 backdrop-blur" />
        <motion.button
          type="button"
          onClick={onOpenUltraHome}
          className="relative flex h-full w-8 items-center justify-center overflow-visible rounded-l-full bg-gradient-to-l from-white/78 via-white/55 to-transparent text-[11px] font-black leading-[13px] text-[#5065ff] shadow-[0_8px_28px_rgba(80,101,255,0.16)] backdrop-blur"
        >
          <motion.span
            aria-hidden="true"
            className="absolute -left-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full border border-[#6f80ff]/30"
            animate={{
              x: [0, -8, 0],
              scale: [0.85, 1.12, 0.85],
              opacity: [0.2, 0.62, 0.2]
            }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          />
          <motion.span
            aria-hidden="true"
            className="absolute -left-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-[#6f80ff]/10"
            animate={{ x: [0, -10, 0], opacity: [0.25, 0.65, 0.25] }}
            transition={{ repeat: Infinity, duration: 1.35, ease: "easeInOut" }}
          />
          <span
            className="relative block"
            style={{ writingMode: "vertical-rl" }}
          >
            左滑问点仔
          </span>
        </motion.button>
      </motion.div>
      <MockKeyboard onAction={handleSearchAction} />
    </motion.div>
  );
}

function MockKeyboard({ onAction }: { onAction: () => void }) {
  return (
    <button
      aria-label="模拟 iPhone 键盘"
      onClick={onAction}
      className="absolute bottom-0 left-0 right-0 z-10 h-[342px] bg-contain bg-bottom bg-no-repeat"
      style={{ backgroundImage: "url('/dianping-assets/Keyboard.png')" }}
    />
  );
}

function FlowPageIndicator({
  count,
  activeIndex,
  hidden,
  onJump
}: {
  count: number;
  activeIndex: number;
  hidden?: boolean;
  onJump: (index: number) => void;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const fadeTimerRef = useRef<number | undefined>(undefined);
  const lastJumpRef = useRef<number | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);
  const [isDimmed, setIsDimmed] = useState(false);

  useEffect(() => {
    wakeIndicator();
    return () => {
      if (fadeTimerRef.current) {
        window.clearTimeout(fadeTimerRef.current);
      }
    };
  }, [activeIndex, count]);

  function wakeIndicator() {
    setIsDimmed(false);
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
    }
    fadeTimerRef.current = window.setTimeout(() => {
      setIsDimmed(true);
    }, 2000);
  }

  function indexFromPointer(clientY: number) {
    const rail = railRef.current;
    if (!rail) {
      return activeIndex;
    }
    const rect = rail.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (clientY - rect.top) / Math.max(rect.height, 1)));
    return Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))));
  }

  function jumpFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const nextIndex = indexFromPointer(event.clientY);
    if (lastJumpRef.current === nextIndex) {
      return;
    }
    lastJumpRef.current = nextIndex;
    onJump(nextIndex);
  }

  if (hidden || count <= 1) {
    return null;
  }

  return (
    <div
      ref={railRef}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
        wakeIndicator();
        jumpFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (!isDragging) {
          return;
        }
        wakeIndicator();
        jumpFromPointer(event);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setIsDragging(false);
        lastJumpRef.current = undefined;
        wakeIndicator();
      }}
      onPointerCancel={() => {
        setIsDragging(false);
        lastJumpRef.current = undefined;
        wakeIndicator();
      }}
      onPointerEnter={wakeIndicator}
      className={cn(
        "pointer-events-auto absolute right-1.5 top-1/2 z-10 flex -translate-y-1/2 touch-none flex-col items-center gap-2 rounded-full bg-white/70 px-2 py-3 shadow-sm backdrop-blur transition-all duration-300",
        isDimmed && !isDragging ? "opacity-35" : "opacity-100",
        isDragging && "scale-110 bg-white/90 shadow-md"
      )}
      aria-label="内容块导航"
    >
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          aria-label={`跳到第 ${index + 1} 个内容块`}
          onClick={(event) => {
            event.stopPropagation();
            wakeIndicator();
            onJump(index);
          }}
          className={cn(
            "h-2 w-2 rounded-full transition-all",
            index === Math.min(activeIndex, count - 1) ? "h-5 bg-[#f26b43]" : "bg-[#d6d8de]",
            isDragging && "w-2.5"
          )}
        />
      ))}
    </div>
  );
}

function getFlowBlockCount(view: MobileShellView) {
  if (view === "start" || view === "answering") {
    return 3;
  }
  if (view === "running") {
    return 1;
  }
  if (view === "clarifying" || view === "summary" || view === "plans" || view === "refining" || view === "selected") {
    return 2;
  }
  return 1;
}

function DzAiBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-white">
      <div className="absolute -left-[13px] top-0 h-[155px] w-[359px] bg-[rgba(231,254,255,0.3)] blur-[50px]" />
      <div className="absolute left-[204px] top-0 h-[155px] w-[210px] bg-[rgba(248,230,255,0.2)] blur-[50px]" />
    </div>
  );
}

function ShellEdgeGlass() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[12] overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 backdrop-blur-[12px]"
        style={{
          height: "var(--dz-edge-glass-top, 172px)",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.82), rgba(255,255,255,0.36) 48%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.76) 48%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.76) 48%, transparent 100%)"
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 backdrop-blur-[14px]"
        style={{
          height: "var(--dz-edge-glass-bottom, 164px)",
          background: "linear-gradient(to top, rgba(255,255,255,0.86), rgba(255,255,255,0.38) 48%, transparent 100%)",
          maskImage: "linear-gradient(to top, #000 0%, rgba(0,0,0,0.74) 48%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, #000 0%, rgba(0,0,0,0.74) 48%, transparent 100%)"
        }}
      />
    </div>
  );
}

function MobileHeader({
  title,
  hideLogo = false,
  onBack,
  onSettings
}: {
  title: string;
  hideLogo?: boolean;
  onBack: () => void;
  onSettings?: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const showDzLogo = title === "点仔 Ultra";

  return (
    <header className="absolute inset-x-0 top-0 z-20 pb-[10px]">
      <DianpingStatusBar />
      <div className="mt-0 grid grid-cols-[44px_1fr_44px] items-start gap-2 px-6">
        <button
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white bg-blend-multiply shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
          aria-label="返回"
        >
          <span
            aria-hidden="true"
            className="block h-5 w-5 bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/dianping-assets/H5_Back@3x.png')" }}
          />
        </button>
        <div className="relative flex min-w-0 items-center justify-center">
          {showDzLogo ? (
            <motion.span
              aria-label="问点仔 AI"
              className="mt-[2px] block h-[38px] w-[112px] bg-contain bg-center bg-no-repeat"
              animate={{
                opacity: hideLogo ? 0 : 1,
                filter: hideLogo ? "blur(8px)" : "blur(0px)",
                scale: hideLogo ? 0.96 : 1
              }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
              style={{ backgroundImage: "url('/dianping-assets/问点仔AI_Logo.png')" }}
            />
          ) : (
            <span className="mt-2 truncate text-[16px] font-black text-[#20283a]">{title}</span>
          )}
        </div>
        {onSettings ? (
          <button
            onClick={onSettings}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white bg-blend-multiply shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
            aria-label="打开设置"
          >
            <span
              aria-hidden="true"
              className="block h-[19px] w-[19px] bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/dianping-assets/list.png')" }}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="h-11 w-11" />
        )}
      </div>
    </header>
  );
}

function PromptSheet({
  prompt,
  summary,
  clarification,
  onClose,
  onEdit
}: {
  prompt: string;
  summary: string;
  clarification: ClarificationState;
  onClose: () => void;
  onEdit: () => void;
}) {
  const prompts = [
    ["首次输入", prompt],
    ["补全信息", `${clarification.people} 人 · ${clarification.timeRange} · ${clarification.food}`],
    ["偏好确认", `${clarification.budget} · ${clarification.taste}`]
  ];

  return (
    <motion.div
      className="absolute inset-0 z-30 p-6"
      style={{
        background: "var(--dz-blur-panel-overlay, rgba(255, 255, 255, 0.52))",
        backdropFilter: `blur(var(--dz-blur-panel-radius, 16px))`,
        WebkitBackdropFilter: `blur(var(--dz-blur-panel-radius, 16px))`
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        initial={{ y: -16, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: -12, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        onClick={(event) => event.stopPropagation()}
        className="mt-[96px] rounded-[26px] bg-white/90 p-5 shadow-[0_24px_80px_rgba(32,40,58,0.18)] backdrop-blur"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-[#4f68ff]">本轮需求摘要</p>
            <h3 className="mt-1 text-xl font-black text-[#20283a]">{summary}</h3>
          </div>
          <button onClick={onClose} className="rounded-full bg-[#f3f4f7] px-3 py-1 text-xs font-black text-[#687083]">
            收起
          </button>
        </div>
        <div className="space-y-3">
          {prompts.map(([label, value], index) => (
            <button
              key={label}
              onClick={onClose}
              className="grid w-full grid-cols-[28px_1fr] gap-3 rounded-2xl border border-[#edf0f6] bg-white px-3 py-3 text-left"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef1ff] text-xs font-black text-[#4f68ff]">
                {index + 1}
              </span>
              <span>
                <span className="block text-xs font-black text-[#7a8190]">{label}</span>
                <span className="mt-1 block text-sm font-semibold leading-6 text-[#20283a]">{value}</span>
              </span>
            </button>
          ))}
        </div>
        <button onClick={onEdit} className="mt-4 w-full rounded-2xl bg-[#20283a] px-4 py-3 text-sm font-black text-white">
          编辑需求并重新规划
        </button>
      </motion.section>
    </motion.div>
  );
}

function PromptEditorOverlay({
  value,
  onChange,
  onCancel,
  onSubmit
}: {
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const overlayDuration = prefersReducedMotion ? 0 : 0.22;
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "cancel">("idle");
  const voiceStartYRef = useRef<number | null>(null);

  // Escape 键取消编辑
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <motion.div
      className="absolute inset-0 z-40 overflow-hidden bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: overlayDuration }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[13px] top-0 h-[155px] w-[359px] bg-[rgba(231,254,255,0.3)] blur-[50px]" />
        <div className="absolute left-[204px] top-0 h-[155px] w-[210px] bg-[rgba(248,230,255,0.2)] blur-[50px]" />
      </div>
      <header className="relative z-10">
        <DianpingStatusBar />
        <div className="mt-0 grid grid-cols-[44px_1fr_44px] items-start gap-2 px-6">
          <button
            onClick={onCancel}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
            aria-label="取消编辑"
          >
            <span
              aria-hidden="true"
              className="block h-5 w-5 bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/dianping-assets/H5_Back@3x.png')" }}
            />
          </button>
          <div className="mt-2 flex min-w-0 justify-center">
            <span className="max-w-[210px] truncate rounded-full border border-white bg-white/60 px-4 py-2 text-[13px] font-normal leading-4 text-[#777777] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)] backdrop-blur">
              编辑本轮需求
            </span>
          </div>
          <button
            onClick={onSubmit}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
            aria-label="提交编辑"
          >
            <span
              aria-hidden="true"
              className="block h-[19px] w-[19px] bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/dianping-assets/list.png')" }}
            />
          </button>
        </div>
      </header>
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: overlayDuration }}
        className="relative z-10 px-[66px] pt-[170px]"
      >
        <h2 className="text-[24px] font-semibold leading-[34px] text-black">直接编辑需求</h2>
        <p className="mt-1 text-[16px] font-normal leading-[22px] text-[#999999]">改完点右侧发送，我会重新规划</p>
        <textarea
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          className="mt-8 min-h-[180px] w-full resize-none border-0 bg-transparent p-0 text-[24px] font-semibold leading-[34px] text-black outline-none placeholder:text-[#b8b8b8]"
          placeholder="周末想找一条轻松拍照路线，最好少走路"
        />
      </motion.section>
      <div className="absolute bottom-[342px] left-0 right-0 z-20 px-[25px] pb-4">
        <div
          className={cn(
            "flex h-11 items-center gap-2 rounded-full border border-white py-[11px] pl-4 pr-1 shadow-[0_10px_24px_rgba(0,0,0,0.055)] transition",
            voiceState === "recording" && "bg-[rgba(15,111,255,0.95)] text-white",
            voiceState === "cancel" && "bg-[rgba(255,165,178,0.95)] text-[#f70000]",
            voiceState === "idle" && "bg-[rgba(243,243,243,0.9)] text-[#727272]"
          )}
        >
          <button
            type="button"
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center"
            aria-label="语音改写"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              voiceStartYRef.current = event.clientY;
              setVoiceState("recording");
            }}
            onPointerMove={(event) => {
              if (voiceStartYRef.current === null) return;
              setVoiceState(voiceStartYRef.current - event.clientY > 50 ? "cancel" : "recording");
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              const cancelled = voiceState === "cancel";
              voiceStartYRef.current = null;
              setVoiceState("idle");
              if (!cancelled) {
                onChange("周末想找一条轻松拍照路线，最好少走路");
              }
            }}
            onPointerCancel={() => {
              voiceStartYRef.current = null;
              setVoiceState("idle");
            }}
          >
            <Mic className="h-[22px] w-[22px]" />
          </button>
          <div className="min-w-0 flex-1 text-center text-[14px] font-normal leading-[22px]">
            {voiceState === "recording" ? "松手改写，上滑取消" : voiceState === "cancel" ? "松手取消" : "按住说话"}
          </div>
          <button
            onClick={onSubmit}
            className="flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-full bg-[#ff6430] bg-contain bg-center bg-no-repeat text-white"
            style={{ backgroundImage: "url('/dianping-assets/submit.png')" }}
            aria-label="发送编辑内容"
          />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <MockKeyboard onAction={onSubmit} />
      </div>
    </motion.div>
  );
}

function StartView({
  keyboardOpen,
  onSubmit
}: {
  keyboardOpen: boolean;
  onSubmit: (prompt?: string) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const promptSamples = [
    "今天下午想在北京约会，不想排队，想吃饭加看展",
    "周末想找一条轻松拍照路线，最好少走路",
    "今晚临时约朋友吃饭，想顺路喝点甜的"
  ];

  // Blur 参数与 CSS 变量 --dz-blur-exit-radius / --dz-blur-exit-duration 对齐
  const exitBlur = 10;
  const exitDuration = prefersReducedMotion ? 0 : 0.35;

  return (
    <motion.section
      key="start"
      initial={{ opacity: 0, filter: "blur(8px)", y: 16 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      exit={{ opacity: 0, filter: `blur(${exitBlur}px)`, y: -10 }}
      transition={{ duration: exitDuration }}
      className="h-full"
    >
      <section data-flow-block className="relative min-h-[628px] snap-start overflow-visible">
        <motion.div
          className="absolute left-0 overflow-visible py-1"
          animate={{ top: keyboardOpen ? 34 : 140 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-[24px] font-semibold leading-[34px] tracking-normal text-black">给你安排去哪玩</h1>
          <p className="relative mt-1 flex min-h-[26px] w-[321px] items-center overflow-visible whitespace-nowrap py-[3px] text-[14px] font-normal leading-5 text-[#999999]">
            <PromptLineText>说说</PromptLineText>
            <HighlightedWord delay={0.7}>想去哪儿</HighlightedWord>
            <PromptLineText>、</PromptLineText>
            <HighlightedWord delay={0.9}>几个人</HighlightedWord>
            <PromptLineText>、</PromptLineText>
            <HighlightedWord delay={1.1}>想怎么玩</HighlightedWord>
            <PromptLineText>，我来规划</PromptLineText>
          </p>
        </motion.div>

        <motion.section
          className="absolute left-0 w-[321px] rounded-[20px] border-2 border-white bg-[#f5faff] px-3 py-4"
          animate={{ top: keyboardOpen ? 186 : 351 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex h-[22px] items-center gap-1.5 px-1">
            <span
              aria-hidden="true"
              className="block h-[22px] w-[22px] bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/dianping-assets/点仔Logo.png')" }}
            />
            <h2 className="text-[16px] font-medium leading-[22px] text-[rgba(2,16,63,0.7)]">你可以这样开始</h2>
          </div>
          <div className="mt-3 flex flex-col items-start gap-2">
            {promptSamples.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onSubmit(prompt)}
                className="max-w-full rounded-[30px] border border-white bg-white/95 px-3 py-1.5 text-left text-[12px] font-normal leading-[17px] text-[#8c97b2] transition active:scale-[0.99]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </motion.section>
      </section>
    </motion.section>
  );
}

function PromptLineText({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-5 items-center leading-5">{children}</span>;
}

function HighlightedWord({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <span className="relative inline-flex h-5 items-center overflow-hidden rounded-[5px] px-[1px] leading-5">
      <motion.span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 z-0 bg-[#fbfb19]/70"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ delay, duration: 0.5, ease: "easeOut" }}
      />
      <motion.span
        className="relative z-10 text-[#202020]"
        animate={{ color: "#332400" }}
        transition={{ delay, duration: 0.5, ease: "easeOut" }}
      >
        {children}
      </motion.span>
    </span>
  );
}

function ShimmerSubtitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex max-w-full items-center overflow-hidden text-[#999999]", className)}>
      <span className="relative">
        {children}
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 -left-14 w-14 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/85 to-transparent"
          animate={{ x: [0, 300] }}
          transition={{ repeat: Infinity, duration: 1.35, ease: "easeInOut" }}
        />
      </span>
    </div>
  );
}

function MobileThinkingBlock({
  title,
  subtitle,
  autoFocus = false,
  promptAnchor = false,
  onTitleClick
}: {
  title: ReactNode;
  subtitle: ReactNode;
  autoFocus?: boolean;
  promptAnchor?: boolean;
  onTitleClick?: () => void;
}) {
  const content = (
    <>
      <h2 className="text-[24px] font-semibold leading-[34px] tracking-normal text-black">{title}</h2>
      <ShimmerSubtitle className="mt-1 text-[20px] font-normal leading-[28px]">{subtitle}</ShimmerSubtitle>
    </>
  );

  return (
    <section
      data-flow-block
      data-prompt-anchor={promptAnchor ? "true" : undefined}
      data-flow-autofocus={autoFocus ? "true" : undefined}
      className={cn(FLOW_BLOCK_CLASS, "relative flex flex-col justify-center overflow-hidden px-[26px] pb-[180px]")}
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        {onTitleClick ? (
          <button type="button" onClick={onTitleClick} className="block w-full text-left">
            {content}
          </button>
        ) : (
          content
        )}
      </motion.div>
    </section>
  );
}

function PlanningConversationView({
  view,
  prompt,
  apiNotice,
  steps,
  activeAgentStep,
  clarification,
  confirmedClarification,
  cards,
  confirmedCards,
  cardAnswers,
  confirmedCardAnswers,
  inputNotice,
  hasConfirmedClarification,
  hasConfirmedSummary,
  postClarificationStep,
  runningAgentChainVisible,
  requirementSummary,
  plans,
  selectedPlan,
  highlightedStopId,
  isRefining,
  expandedPlanId,
  activeTransport,
  selectedTransportMode,
  expandedStopId,
  completedTodoIds,
  onEditPrompt,
  durationMs,
  onAgentStepClick,
  setClarification,
  setCardAnswers,
  onConfirmClarification,
  onConfirmSummary,
  onExpandPlan,
  onCloseExpandedPlan,
  onSlideChange,
  onSelectPlan,
  onQuickRefine,
  onChoose,
  setSelectedTransportMode,
  setExpandedStopId,
  toggleTodo
}: {
  view: MobileShellView;
  prompt: string;
  apiNotice: string;
  steps: RunningAgentStep[];
  activeAgentStep: string | null;
  clarification: ClarificationState;
  confirmedClarification: ClarificationState;
  cards: ClarificationCard[];
  confirmedCards: ClarificationCard[];
  cardAnswers: ClarificationCardAnswers;
  confirmedCardAnswers: ClarificationCardAnswers;
  inputNotice: string;
  hasConfirmedClarification: boolean;
  hasConfirmedSummary: boolean;
  postClarificationStep: number;
  runningAgentChainVisible: boolean;
  requirementSummary?: RequirementSummary;
  plans: DemoRoutePlan[];
  selectedPlan?: DemoRoutePlan;
  highlightedStopId?: string;
  isRefining: boolean;
  expandedPlanId?: string;
  activeTransport?: DemoRoutePlan["transports"][number];
  selectedTransportMode: TransportMode;
  expandedStopId?: string;
  completedTodoIds: string[];
  onEditPrompt: () => void;
  durationMs?: number;
  onAgentStepClick?: (agentName: string) => void;
  setClarification: (state: ClarificationState) => void;
  setCardAnswers: (state: ClarificationCardAnswers) => void;
  onConfirmClarification: () => void;
  onConfirmSummary: () => void;
  onExpandPlan: (planId: string) => void;
  onCloseExpandedPlan: () => void;
  onSlideChange: (swiper: SwiperInstance) => void;
  onSelectPlan: (planId: string) => void;
  onQuickRefine: (instruction: string) => void;
  onChoose: () => void;
  setSelectedTransportMode: (mode: TransportMode) => void;
  setExpandedStopId: (stopId?: string) => void;
  toggleTodo: (todoId: string) => void;
}) {
  const showLiveClarification = view === "clarifying";
  const showConfirmedClarification = hasConfirmedClarification && view !== "clarifying";
  const showPostClarification = hasConfirmedClarification && view !== "clarifying";
  const showSummary = view === "summary" || hasConfirmedSummary || view === "plans" || view === "refining" || view === "selected";
  const showPlanGeneration = view === "running" && hasConfirmedSummary;
  const showPlans = (view === "plans" || view === "refining" || view === "selected") && plans.length > 0 && !!selectedPlan;
  const showSelected = view === "selected" && !!selectedPlan && !!activeTransport;
  const agentIsRunning = view === "running" && !hasConfirmedClarification && !hasConfirmedSummary;

  return (
    <motion.section
      key="planning-conversation"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <RunningView
        prompt={prompt}
        apiNotice={apiNotice}
        steps={steps}
        activeAgentStep={activeAgentStep}
        status={agentIsRunning ? "running" : "completed"}
        showAgentChain={agentIsRunning ? runningAgentChainVisible : true}
        autoFocus={view === "running" && !hasConfirmedClarification && !hasConfirmedSummary}
        durationMs={durationMs}
        onEditPrompt={onEditPrompt}
        onAgentStepClick={onAgentStepClick}
      />

      {showLiveClarification && (
        <ClarifyingView
          clarification={clarification}
          cards={cards}
          cardAnswers={cardAnswers}
          inputNotice={inputNotice}
          autoFocus
          setClarification={setClarification}
          setCardAnswers={setCardAnswers}
          onConfirm={onConfirmClarification}
        />
      )}

      {showConfirmedClarification && (
        <ClarificationRecapView
          clarification={confirmedClarification}
          cards={confirmedCards}
          cardAnswers={confirmedCardAnswers}
        />
      )}

      {showPostClarification && (
        <PostClarificationThinkingView
          activeStep={postClarificationStep}
          autoFocus={view === "running" && hasConfirmedClarification && !hasConfirmedSummary}
        />
      )}

      {showSummary && (
        <SummaryView
          prompt={prompt}
          clarification={hasConfirmedClarification ? confirmedClarification : clarification}
          requirementSummary={requirementSummary}
          autoFocus={view === "summary"}
          confirmed={hasConfirmedSummary}
          onConfirm={onConfirmSummary}
        />
      )}

      {showPlanGeneration && <PlanGenerationThinkingView autoFocus />}

      {showPlans && selectedPlan && (
        <PlansView
          plans={plans}
          selectedPlan={selectedPlan}
          highlightedStopId={highlightedStopId}
          isRefining={isRefining}
          apiNotice={apiNotice}
          expandedPlanId={expandedPlanId}
          autoFocus={view === "plans" || view === "refining"}
          onExpandPlan={onExpandPlan}
          onCloseExpandedPlan={onCloseExpandedPlan}
          onSlideChange={onSlideChange}
          onSelectPlan={onSelectPlan}
          onQuickRefine={onQuickRefine}
          onChoose={onChoose}
        />
      )}

      {showSelected && selectedPlan && activeTransport && (
        <SelectedPlanView
          plan={selectedPlan}
          activeTransport={activeTransport}
          selectedTransportMode={selectedTransportMode}
          expandedStopId={expandedStopId}
          completedTodoIds={completedTodoIds}
          autoFocus
          setSelectedTransportMode={setSelectedTransportMode}
          setExpandedStopId={setExpandedStopId}
          toggleTodo={toggleTodo}
        />
      )}
    </motion.section>
  );
}

function RunningView({
  prompt,
  apiNotice,
  status = "running",
  autoFocus = false,
  onEditPrompt
}: {
  prompt: string;
  apiNotice: string;
  steps: RunningAgentStep[];
  activeAgentStep: string | null;
  status?: "running" | "completed";
  showAgentChain: boolean;
  autoFocus?: boolean;
  durationMs?: number;
  onEditPrompt: () => void;
  onAgentStepClick?: (agentName: string) => void;
}) {
  const [typedPrompt, setTypedPrompt] = useState("");

  // 打字机效果保留，与 Agent 进度无关
  useEffect(() => {
    if (status === "completed") {
      setTypedPrompt(prompt);
      return;
    }

    setTypedPrompt("");

    const characters = Array.from(prompt);
    let characterIndex = 0;
    const typingTimer = window.setInterval(() => {
      characterIndex += 1;
      setTypedPrompt(characters.slice(0, characterIndex).join(""));
      if (characterIndex >= characters.length) {
        window.clearInterval(typingTimer);
      }
    }, Math.max(28, Math.min(56, 900 / Math.max(characters.length, 1))));

    return () => {
      window.clearInterval(typingTimer);
    };
  }, [prompt, status]);

  return (
    <motion.section
      key="running"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="space-y-4 pb-8"
    >
      <MobileThinkingBlock
        title={typedPrompt || prompt.slice(0, 1)}
        subtitle={status === "running" ? apiNotice || "稍等一下，我正在思考哦" : "已获取基本信息"}
        autoFocus={autoFocus}
        promptAnchor
        onTitleClick={onEditPrompt}
      />
    </motion.section>
  );
}

function DirectAnswerView({ answer, apiNotice, onConvertToPlan }: { answer: DirectAnswer | undefined; apiNotice: string; onConvertToPlan: () => void }) {
  const [typedAnswer, setTypedAnswer] = useState("");
  const [showPoiSection, setShowPoiSection] = useState(false);

  // 流式打字机效果：answer 变化时逐字显示
  useEffect(() => {
    if (!answer?.answer) {
      setTypedAnswer("");
      return;
    }

    // 如果 answer 已经完整且和 typedAnswer 相同，跳过
    if (answer.answer === typedAnswer) {
      return;
    }

    const characters = Array.from(answer.answer);
    let charIndex = 0;
    setTypedAnswer("");

    const timer = window.setInterval(() => {
      charIndex += 1;
      setTypedAnswer(characters.slice(0, charIndex).join(""));
      if (charIndex >= characters.length) {
        window.clearInterval(timer);
      }
    }, Math.max(20, Math.min(40, 600 / Math.max(characters.length, 1))));

    return () => { window.clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在 answer.answer 变化时触发
  }, [answer?.answer]);

  // answer 打完后显示 POI 区域
  useEffect(() => {
    if (!answer?.answer || !answer.poiHints.length) {
      setShowPoiSection(false);
      return;
    }
    if (typedAnswer.length >= answer.answer.length) {
      const timer = window.setTimeout(() => setShowPoiSection(true), 200);
      return () => window.clearTimeout(timer);
    }
  }, [typedAnswer, answer?.answer, answer?.poiHints.length]);

  if (!answer) {
    return null;
  }

  const isFallback = answer.fallback_used === true;
  const hasMockedFields = (poi: PoiHint) =>
    poi.source === "mock" ||
    (poi.reliability && Object.values(poi.reliability).some((v) => v === "mocked"));

  const isTyping = answer.answer && typedAnswer.length < answer.answer.length;

  return (
    <motion.section
      key="answering"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* fallback 全局提示条 */}
      {isFallback && (
        <section data-flow-block>
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-700">
            当前 API 不可用，展示的是本地模拟数据，仅供参考。
          </div>
        </section>
      )}

      {/* 用户问题 */}
      <section data-flow-block className={cn(FLOW_BLOCK_CLASS, "flex flex-col justify-center")}>
        <h2 className="text-2xl font-black leading-9 text-[#20283a]">{answer.question}</h2>
      </section>

      {/* Agent ToolUse 摘要行 */}
      {answer.agentSteps && answer.agentSteps.length > 0 && (
        <section data-flow-block className={cn(FLOW_BLOCK_CLASS)}>
          <div className="space-y-2">
            {answer.agentSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2 text-xs">
                {step.status === "running" ? (
                  <svg className="h-3.5 w-3.5 shrink-0 animate-spin text-[#4f68ff]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                )}
                <span className={cn("font-semibold", step.status === "running" ? "text-[#4f68ff]" : "text-neutral-500")}>
                  {step.label}
                </span>
                {step.detail && step.status === "completed" && (
                  <span className="text-neutral-400">· {step.detail}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LLM 回答卡片 */}
      <section data-flow-block className={cn(FLOW_BLOCK_CLASS, "flex flex-col justify-center")}>
        <div className={cn("rounded-3xl bg-white p-5 shadow-sm", isFallback && "border-2 border-amber-400")}>
          <div className="mb-3 flex items-center gap-2 text-sm font-black">
            <Sparkles className="h-4 w-4 text-[#4f68ff]" />
            点仔回答
            {answer.answer_provider && (
              <span className="ml-auto rounded-full bg-[#eef1ff] px-2 py-0.5 text-[10px] font-semibold text-[#5260c8]">
                {answer.answer_provider}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold leading-7 text-[#20283a]">
            {typedAnswer}
            {isTyping && <span className="inline-block w-[2px] animate-pulse bg-[#20283a]">&nbsp;</span>}
          </p>
          {!isTyping && apiNotice && (
            <p className="mt-4 rounded-2xl bg-[#eef1ff] px-3 py-3 text-xs leading-5 text-[#5260c8]">{apiNotice}</p>
          )}
        </div>
      </section>

      {/* POI 卡片区域：打字完成后淡入 */}
      {showPoiSection && answer.poiHints.length > 0 && (
        <motion.section
          data-flow-block
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(FLOW_BLOCK_CLASS, "py-2")}
        >
          <BlockTitle title="附近可参考 POI" subtitle="快速问答也会检索附近地点，帮助答案落地。" />
          <div className="space-y-3">
            {answer.poiHints.map((poi) => {
              const isMocked = hasMockedFields(poi);
              const isAmap = poi.source === "amap";
              return (
                <div
                  key={poi.id || poi.name}
                  className={cn(
                    "rounded-2xl bg-white p-4 shadow-sm",
                    isMocked && "bg-amber-50/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black">{poi.name}</h3>
                        {isAmap && (
                          <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                            高德数据
                          </span>
                        )}
                        {isMocked && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                            模拟数据
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-dz-orange">{poi.meta}</p>
                      {poi.address && (
                        <p className="mt-1 text-xs leading-4 text-neutral-400">{poi.address}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">附近</span>
                      {poi.rating > 0 && (
                        <span className="text-[11px] font-bold text-amber-500">{poi.rating} 分</span>
                      )}
                    </div>
                  </div>

                  {poi.recommendedDishes && poi.recommendedDishes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {poi.recommendedDishes.map((dish) => (
                        <span key={dish} className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-600">
                          {dish}
                        </span>
                      ))}
                    </div>
                  )}

                  {poi.openHours && (
                    <p className="mt-2 text-[11px] leading-4 text-neutral-400">
                      营业时间：{poi.openHours}
                    </p>
                  )}

                  <p className="mt-3 text-xs leading-5 text-neutral-600">{poi.reason}</p>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onConvertToPlan}
            className="mt-4 w-full rounded-2xl bg-[#4f68ff] px-4 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98] transition-transform"
          >
            转为路线规划
          </button>
        </motion.section>
      )}

      {/* POI 加载中 */}
      {!showPoiSection && answer.answer && typedAnswer.length >= answer.answer.length && !answer.poiHints.length && (
        <section data-flow-block className={cn(FLOW_BLOCK_CLASS)}>
          <div className="flex items-center gap-2 rounded-2xl bg-white p-4 text-xs leading-5 text-neutral-500 shadow-sm">
            <svg className="h-4 w-4 animate-spin text-neutral-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            正在检索相关地点
          </div>
        </section>
      )}
    </motion.section>
  );
}

function ClarificationRecapView({
  clarification,
  cards,
  cardAnswers
}: {
  clarification: ClarificationState;
  cards: ClarificationCard[];
  cardAnswers: ClarificationCardAnswers;
}) {
  const items = cards.length
    ? cards.map((card) => [card.question, formatClarificationAnswer(cardAnswers[card.id] ?? card.default_value ?? "已使用默认值")])
    : [
        ["人数", `${clarification.people} 人`],
        ["时间", clarification.timeRange],
        ["饮食", clarification.food],
        ["预算", clarification.budget],
        ["口味", clarification.taste]
      ];

  return (
    <section data-flow-block className={cn(FLOW_BLOCK_CLASS, "px-[18px] py-2")}>
      <div className="mb-7 pt-[42px]">
        <h2 className="text-[24px] font-semibold leading-[34px] text-black">已补全的信息</h2>
        <p className="mt-1 text-[16px] font-normal leading-[22px] text-[#999999]">
          这些回答会继续影响后面的候选地点和排序
        </p>
      </div>
      <div className="rounded-[20px] bg-[#f8f8f8] px-4 py-4">
        <div className="space-y-2">
          {items.map(([label, value]) => (
            <div key={label} className="flex min-h-[38px] items-center justify-between gap-4 rounded-[10px] bg-white px-3">
              <div className="shrink-0 text-[13px] font-normal leading-5 text-[#999999]">{label}</div>
              <div className="min-w-0 text-right text-[14px] font-normal leading-5 text-[#303030]">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PostClarificationThinkingView({
  activeStep,
  autoFocus = false
}: {
  activeStep: number;
  autoFocus?: boolean;
}) {
  const blocks = [
    {
      title: "已吸收补全信息",
      detail: "我会把人数、时间、饮食和偏好重新写进本轮约束，避免后面的推荐偏离你的回答。"
    },
    {
      title: "正在重新检索候选地点",
      detail: "先用 Mock POI 和用户偏好筛一遍，再交给地图 provider 计算距离与通勤时间。"
    },
    {
      title: "正在组合可解释路线",
      detail: "我会保留 3 套差异明显的方案，并把每套方案为什么被推荐写清楚。"
    }
  ];
  const block = blocks[Math.min(Math.max(activeStep, 0), blocks.length - 1)];

  return (
    <MobileThinkingBlock title={block.title} subtitle={block.detail} autoFocus={autoFocus} />
  );
}

function PlanGenerationThinkingView({ autoFocus = false }: { autoFocus?: boolean }) {
  return (
    <MobileThinkingBlock
      title="正在生成 3 套方案"
      subtitle="我会保留不同取舍，并把为什么推荐写清楚"
      autoFocus={autoFocus}
    />
  );
}

function ClarifyingView({
  clarification,
  cards,
  cardAnswers,
  inputNotice,
  autoFocus = false,
  setClarification,
  setCardAnswers,
  onConfirm
}: {
  clarification: ClarificationState;
  cards: ClarificationCard[];
  cardAnswers: ClarificationCardAnswers;
  inputNotice: string;
  autoFocus?: boolean;
  setClarification: (state: ClarificationState) => void;
  setCardAnswers: (state: ClarificationCardAnswers) => void;
  onConfirm: () => void;
}) {
  function updateCardAnswer(card: ClarificationCard, answer: string | string[]) {
    const nextAnswers = { ...cardAnswers, [card.id]: answer };
    setCardAnswers(nextAnswers);
    setClarification(applyClarificationCardAnswer(clarification, card, nextAnswers[card.id]));
  }

  const visibleCards = cards.length
    ? cards
    : ([
        {
          id: "local-people",
          type: "clarification_card",
          question: "几个人出行？",
          field: "people",
          selection_mode: "single",
          ui_component: "number_picker",
          options: ["1 人", "2 人", "3-4 人", "5 人以上", "其他"],
          blocks_planning: true,
          required: true,
          allow_skip: false,
          reason: "人数会影响餐厅订位和路线节奏。"
        },
        {
          id: "local-time",
          type: "clarification_card",
          question: "时段",
          field: "time_window",
          selection_mode: "single",
          ui_component: "time_range_picker",
          options: ["上午", "下午", "晚上", "随便"],
          blocks_planning: true,
          required: true,
          allow_skip: false,
          reason: "时间窗会影响营业状态和停留时长。"
        },
        {
          id: "local-food",
          type: "clarification_card",
          question: "想吃哪些菜系（可多选）",
          field: "food",
          selection_mode: "multiple",
          ui_component: "choice_buttons",
          options: ["川湘风味中餐（偏香辣）", "粤式/江浙风味中餐（清淡鲜爽）", "韩式/日式料理", "西式餐品", "随便"],
          default_value: "随便",
          blocks_planning: true,
          required: true,
          allow_skip: false,
          reason: "饮食偏好会影响候选 POI。"
        }
      ] satisfies ClarificationCard[]);

  return (
    <motion.section
      key="clarifying"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      <section
        data-flow-block
        data-flow-autofocus={autoFocus ? "true" : undefined}
        className={cn(FLOW_BLOCK_CLASS, "px-[18px] py-2")}
      >
        <div className="mb-7 pt-[42px]">
          <h2 className="text-[24px] font-semibold leading-[34px] text-black">确认关键信息</h2>
          <p className="mt-1 text-[16px] font-normal leading-[22px] text-[#999999]">
            需要明确几个必要信息，更好帮你规划
          </p>
        </div>
        {inputNotice && (
          <div className="mb-4 rounded-[14px] bg-[#f7f7f7] px-4 py-3 text-[12px] font-normal leading-5 text-[#777777]">
            {inputNotice}
          </div>
        )}
        <div className="space-y-5">
          {visibleCards.filter(isPeopleClarificationCard).slice(0, 2).map((card) => (
            <QuestionCard key={card.id} compact>
              <PeopleWheelControl
                title={card.question}
                value={clarification.people}
                onChange={(people) => updateCardAnswer(card, `${people} 人`)}
              />
            </QuestionCard>
          ))}
          {visibleCards.filter((card) => !isPeopleClarificationCard(card)).map((card) => (
            <ClarificationTemplateCard
              key={card.id}
              card={card}
              clarification={clarification}
              cardAnswers={cardAnswers}
              onAnswer={updateCardAnswer}
              setCardAnswers={setCardAnswers}
              setClarification={setClarification}
            />
          ))}
        </div>
        <button
          onClick={onConfirm}
          className="mt-6 w-full rounded-full bg-[#ff6430] px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(255,100,48,0.24)] active:scale-[0.99]"
        >
          确定
        </button>
        {/* 底部留白：防止确定按钮被输入框遮挡 */}
        <div className="h-[120px]" />
      </section>
    </motion.section>
  );
}

function QuestionCard({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <section
      className={cn(
        "rounded-[20px] bg-[#f8f8f8] px-4 py-4",
        compact ? "min-h-[192px]" : "w-full"
      )}
    >
      {children}
    </section>
  );
}

function ClarificationTemplateCard({
  card,
  clarification,
  cardAnswers,
  onAnswer,
  setCardAnswers,
  setClarification
}: {
  card: ClarificationCard;
  clarification: ClarificationState;
  cardAnswers: ClarificationCardAnswers;
  onAnswer: (card: ClarificationCard, answer: string | string[]) => void;
  setCardAnswers: (state: ClarificationCardAnswers) => void;
  setClarification: (state: ClarificationState) => void;
}) {
  if (isTimeClarificationCard(card)) {
    return (
      <QuestionCard>
        <TimeWindowControl
          value={clarification.timeRange}
          options={card.options}
          onChange={(timeRange) => onAnswer(card, timeRange)}
        />
      </QuestionCard>
    );
  }

  if (card.selection_mode === "free_text" || card.ui_component === "free_text" || !card.options.length) {
    return (
      <QuestionCard>
        <h3 className="border-b border-[#d8d8d8] pb-2 text-[16px] font-semibold leading-[22px] text-[#303030]">
          {card.question}
        </h3>
        <textarea
          value={String(cardAnswers[card.id] ?? "")}
          onChange={(event) => onAnswer(card, event.target.value)}
          rows={3}
          placeholder={card.default_value ?? "直接写你的偏好"}
          className="mt-3 w-full resize-none rounded-[12px] border border-[#eeeeee] bg-white px-3 py-3 text-[14px] leading-5 text-[#303030] outline-none focus:border-[#ff6430]"
        />
      </QuestionCard>
    );
  }

  return (
    <ChoiceQuestionControl
      card={card}
      clarification={clarification}
      cardAnswers={cardAnswers}
      setCardAnswers={setCardAnswers}
      setClarification={setClarification}
    />
  );
}

function PeopleWheelControl({
  title = "几个人出行？",
  value,
  onChange
}: {
  title?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const boundedValue = Math.min(20, Math.max(1, value || 1));
  const visibleValues = [boundedValue - 3, boundedValue - 2, boundedValue - 1, boundedValue, boundedValue + 1, boundedValue + 2, boundedValue + 3]
    .filter((item) => item >= 1 && item <= 20);

  return (
    <div>
      <h3 className="border-b border-[#d8d8d8] pb-2 text-[16px] font-semibold leading-[22px] text-[#303030]">{title}</h3>
      <div className="relative mx-auto mt-3 grid h-[118px] place-items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-[#f8f8f8] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-[#f8f8f8] to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[30px] w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-[7px] bg-[#eeeeee]" />
        <div className="flex flex-col items-center justify-center gap-1">
          {visibleValues.map((people) => {
            const distance = Math.abs(people - boundedValue);
            return (
              <button
                key={people}
                type="button"
                onClick={() => onChange(people)}
                className={cn(
                  "relative z-10 h-[22px] w-[72px] rounded-[7px] text-center text-[18px] leading-[22px] transition",
                  distance === 0 && "font-normal text-[#ff6430]",
                  distance === 1 && "text-[#cfcfcf]",
                  distance >= 2 && "text-[#e8e8e8]"
                )}
              >
                {people}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[Math.max(1, boundedValue - 1), Math.min(20, boundedValue + 1)].filter((item, index, array) => array.indexOf(item) === index && item !== boundedValue).map((people) => (
          <button
            key={people}
            onClick={() => onChange(people)}
            className={cn(
              "h-8 rounded-full bg-white text-[12px] font-normal text-[#999999]",
              boundedValue === 1 || boundedValue === 20 ? "col-span-2" : ""
            )}
          >
            {people} 人
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---- iOS 风格时间滚轮列 ---- */
function TimeWheelColumn({
  items,
  selectedIndex,
  onChange
}: {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ITEM_H = 30;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = selectedIndex * ITEM_H;
  }, [selectedIndex]);

  return (
    <div className="relative h-[150px] w-[72px] overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[60px] bg-gradient-to-b from-[#f8f8f8] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[60px] bg-gradient-to-t from-[#f8f8f8] to-transparent" />
      <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-[30px] -translate-y-1/2 rounded-[6px] bg-[#eeeeee]" />
      <div
        ref={ref}
        onScroll={() => {
          const el = ref.current;
          if (!el) return;
          const idx = Math.round(el.scrollTop / ITEM_H);
          if (idx !== selectedIndex && idx >= 0 && idx < items.length) {
            onChange(idx);
          }
        }}
        className="h-full snap-y snap-mandatory overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingTop: 60, paddingBottom: 60 }}
      >
        {items.map((item, i) => {
          const dist = Math.abs(i - selectedIndex);
          return (
            <div
              key={item}
              className="flex h-[30px] snap-start items-center justify-center text-[16px] leading-none transition-colors"
              style={{ color: dist === 0 ? "#ff6430" : dist === 1 ? "#cfcfcf" : "#e8e8e8" }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- 解析时间字符串中的小时和分钟 ---- */
function parseTimeHM(timeStr: string): { hour: number; minute: number } {
  const m = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (m) return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) };
  return { hour: 9, minute: 0 };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad2(i * 5));

function TimeWindowControl({
  value,
  options,
  onChange
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const shortcuts = options.length ? options : ["上午", "下午", "晚上", "随便"];
  const preview = createTimeWindowPreview(value);
  const [specificEnabled, setSpecificEnabled] = useState(!timeShortcutMatches(value, "随便"));

  const startHM = parseTimeHM(preview.start);
  const endHM = parseTimeHM(preview.end);
  const [startHourIdx, setStartHourIdx] = useState(HOURS.indexOf(pad2(startHM.hour)));
  const [startMinuteIdx, setStartMinuteIdx] = useState(MINUTES.indexOf(pad2(startHM.minute)));
  const [endHourIdx, setEndHourIdx] = useState(HOURS.indexOf(pad2(endHM.hour)));
  const [endMinuteIdx, setEndMinuteIdx] = useState(MINUTES.indexOf(pad2(endHM.minute)));

  function buildTimeRange(sh: number, sm: number, eh: number, em: number) {
    return `今天 ${pad2(sh)}:${pad2(sm)}-${pad2(eh)}:${pad2(em)}`;
  }

  return (
    <div>
      <h3 className="text-[16px] font-semibold leading-[22px] text-[#303030]">时段</h3>
      <div className="mt-3 flex gap-2 border-b border-[#d8d8d8] pb-3">
        {shortcuts.map((option) => {
          const optionValue = normalizeTimeOption(option);
          const selected = value === option || value === optionValue || timeShortcutMatches(value, option);
          return (
            <button
              type="button"
              key={option}
              onClick={() => {
                onChange(optionValue);
                setSpecificEnabled(!timeShortcutMatches(optionValue, "随便"));
              }}
              className={cn(
                "h-8 rounded-full px-3 text-[14px] font-normal transition",
                selected ? "bg-[#eeeeee] text-[#ff6430]" : "bg-[#eeeeee] text-[#303030]"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[14px] font-normal leading-5 text-[#777777]">具体时间</span>
        <button
          type="button"
          aria-pressed={specificEnabled}
          onClick={() => setSpecificEnabled((enabled) => !enabled)}
          className={cn(
            "relative h-6 w-12 rounded-full transition",
            specificEnabled ? "bg-[#ff6430]" : "bg-[#aaaaaa]"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
              specificEnabled ? "left-[26px]" : "left-0.5"
            )}
          />
        </button>
      </div>
      {specificEnabled && (
        <div className="mt-4 space-y-3">
          {/* 开始时间 */}
          <div className="rounded-[14px] bg-white px-3 py-2">
            <div className="mb-1 text-[12px] font-normal leading-4 text-[#999999]">开始时间</div>
            <div className="flex items-center justify-center gap-1">
              <TimeWheelColumn
                items={HOURS}
                selectedIndex={startHourIdx}
                onChange={(idx) => {
                  setStartHourIdx(idx);
                  onChange(buildTimeRange(idx, startMinuteIdx, endHourIdx, endMinuteIdx));
                }}
              />
              <span className="text-[18px] font-semibold text-[#303030]">:</span>
              <TimeWheelColumn
                items={MINUTES}
                selectedIndex={startMinuteIdx}
                onChange={(idx) => {
                  setStartMinuteIdx(idx);
                  onChange(buildTimeRange(startHourIdx, idx, endHourIdx, endMinuteIdx));
                }}
              />
            </div>
          </div>
          {/* 结束时间 */}
          <div className="rounded-[14px] bg-white px-3 py-2">
            <div className="mb-1 text-[12px] font-normal leading-4 text-[#999999]">结束时间</div>
            <div className="flex items-center justify-center gap-1">
              <TimeWheelColumn
                items={HOURS}
                selectedIndex={endHourIdx}
                onChange={(idx) => {
                  setEndHourIdx(idx);
                  onChange(buildTimeRange(startHourIdx, startMinuteIdx, idx, endMinuteIdx));
                }}
              />
              <span className="text-[18px] font-semibold text-[#303030]">:</span>
              <TimeWheelColumn
                items={MINUTES}
                selectedIndex={endMinuteIdx}
                onChange={(idx) => {
                  setEndMinuteIdx(idx);
                  onChange(buildTimeRange(startHourIdx, startMinuteIdx, endHourIdx, idx));
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceQuestionControl({
  card,
  clarification,
  cardAnswers,
  setCardAnswers,
  setClarification
}: {
  card: ClarificationCard;
  clarification: ClarificationState;
  cardAnswers: ClarificationCardAnswers;
  setCardAnswers: (state: ClarificationCardAnswers) => void;
  setClarification: (state: ClarificationState) => void;
}) {
  return (
    <QuestionCard>
      <h3 className="border-b border-[#d8d8d8] pb-2 text-[16px] font-semibold leading-[22px] text-[#303030]">
        {card.question}
      </h3>
      <div className="mt-3 space-y-2">
        {card.options.map((option) => {
          const selected = isClarificationOptionSelected(clarification, cardAnswers, card, option);
          return (
            <button
              type="button"
              key={option}
              onClick={() => {
                const nextAnswers = updateClarificationCardAnswers(cardAnswers, card, option);
                setCardAnswers(nextAnswers);
                setClarification(applyClarificationCardAnswer(clarification, card, nextAnswers[card.id]));
              }}
              className={cn(
                "flex min-h-[34px] w-full items-center gap-3 rounded-[9px] border bg-white px-3 text-left text-[14px] font-normal leading-5 transition",
                selected ? "border-[#ff6430] text-[#303030]" : "border-[#eeeeee] text-[#303030]"
              )}
            >
              <span
                className={cn(
                  "flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[3px] border",
                  selected ? "border-[#ff6430] bg-[#ff6430]" : "border-[#ff6430] bg-white"
                )}
              >
                {selected && <Check className="h-[12px] w-[12px] text-white" />}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </QuestionCard>
  );
}

function SummaryView({
  prompt,
  clarification,
  requirementSummary,
  autoFocus = false,
  confirmed = false,
  onConfirm
}: {
  prompt: string;
  clarification: ClarificationState;
  requirementSummary?: RequirementSummary;
  autoFocus?: boolean;
  confirmed?: boolean;
  onConfirm: () => void;
}) {
  const items = requirementSummary?.user_visible_summary.length
    ? requirementSummary.user_visible_summary.map(splitSummaryLine)
    : [
        ["目标", prompt],
        ["城市", "北京"],
        ["时间", clarification.timeRange],
        ["人数", `${clarification.people} 人`],
        ["饮食", clarification.food],
        ["预算", clarification.budget],
        ["口味", clarification.taste],
        ["偏好", "低排队、约会氛围、步行友好"]
      ];

  return (
    <motion.section
      key="summary"
      data-flow-block
      data-flow-autofocus={autoFocus ? "true" : undefined}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(FLOW_BLOCK_CLASS, "px-[18px] py-2")}
    >
      <div className="mb-7 pt-[42px]">
        <h2 className="text-[24px] font-semibold leading-[34px] text-black">确认你的需求</h2>
        <p className="mt-1 text-[16px] font-normal leading-[22px] text-[#999999]">
          {requirementSummary?.next_action ?? "确认后开始生成 3 套路线"}
        </p>
      </div>
      <div className="rounded-[20px] bg-[#f8f8f8] px-4 py-4">
        <div className="space-y-2">
          {items.map(([label, value]) => (
            <div key={label} className="flex min-h-[38px] items-center justify-between gap-4 rounded-[10px] bg-white px-3">
              <span className="shrink-0 text-[13px] font-normal leading-5 text-[#999999]">{label}</span>
              <span className="min-w-0 text-right text-[14px] font-normal leading-5 text-[#303030]">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[12px] bg-white px-3 py-3 text-[12px] leading-5 text-[#999999]">
          若后续想改，比如“第二站换成川菜”，可以在方案页直接输入。
        </div>
      </div>
      {confirmed ? (
        <div className="mt-4 rounded-full bg-[#f0f8f2] px-4 py-3 text-center text-[14px] font-semibold text-[#258b43]">
          已确认，继续生成路线方案
        </div>
      ) : (
        <button
          onClick={onConfirm}
          className="mt-6 w-full rounded-full bg-[#ff6430] px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(255,100,48,0.24)] active:scale-[0.99]"
        >
          确定，开始规划
        </button>
      )}
      {/* 底部留白：防止确定按钮被输入框遮挡 */}
      <div className="h-[120px]" />
    </motion.section>
  );
}

function PlansView({
  plans,
  selectedPlan,
  highlightedStopId,
  expandedPlanId,
  autoFocus = false,
  onExpandPlan,
  onCloseExpandedPlan,
  onSlideChange,
  onSelectPlan,
  onChoose
}: {
  plans: DemoRoutePlan[];
  selectedPlan: DemoRoutePlan;
  highlightedStopId?: string;
  isRefining: boolean;
  apiNotice: string;
  expandedPlanId?: string;
  autoFocus?: boolean;
  onExpandPlan: (planId: string) => void;
  onCloseExpandedPlan: () => void;
  onSlideChange: (swiper: SwiperInstance) => void;
  onSelectPlan: (planId: string) => void;
  onQuickRefine: (instruction: string) => void;
  onChoose: () => void;
}) {
  const expandedPlan = plans.find((plan) => plan.id === expandedPlanId);

  return (
    <motion.section
      key="plans"
      data-flow-block
      data-flow-autofocus={autoFocus ? "true" : undefined}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(FLOW_BLOCK_CLASS, "py-2")}
    >
      <div className="mb-7 pl-[5px] pr-6">
        <h2 className="text-[24px] font-semibold leading-[34px] text-black">喜欢哪个方案？</h2>
        <p className="mt-1 text-[20px] font-normal leading-[28px] text-[#999999]">
          左右滑动切换方案，哪里不满意？底部输入，我来帮你解决
        </p>
      </div>

      <Swiper slidesPerView={1.08} spaceBetween={12} onSlideChange={onSlideChange} className="!-mx-1 !px-1">
        {plans.map((plan) => (
          <SwiperSlide key={plan.id}>
            <PlanCard
              plan={plan}
              active={plan.id === selectedPlan.id}
              highlightedStopId={highlightedStopId}
              onExpand={() => {
                onSelectPlan(plan.id);
                onExpandPlan(plan.id);
              }}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      <AnimatePresence>
        {expandedPlan && (
          <ExpandedPlanSheet
            plan={expandedPlan}
            onClose={onCloseExpandedPlan}
            onChoose={() => {
              onCloseExpandedPlan();
              onChoose();
            }}
            onNavigate={(direction) => {
              const currentIndex = plans.findIndex((plan) => plan.id === expandedPlan.id);
              const nextPlan = plans[currentIndex + direction];
              if (nextPlan) {
                onSelectPlan(nextPlan.id);
                onExpandPlan(nextPlan.id);
              }
            }}
            hasPrevious={plans.findIndex((plan) => plan.id === expandedPlan.id) > 0}
            hasNext={plans.findIndex((plan) => plan.id === expandedPlan.id) < plans.length - 1}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/* transportIcon, StarRating, PlanCard, ExpandedPlanSheet moved to ./plan-card.tsx and ./expanded-plan-sheet.tsx */

function SelectedPlanView({
  plan,
  activeTransport,
  selectedTransportMode,
  expandedStopId,
  completedTodoIds,
  autoFocus = false,
  setSelectedTransportMode,
  setExpandedStopId,
  toggleTodo
}: {
  plan: DemoRoutePlan;
  activeTransport: DemoRoutePlan["transports"][number];
  selectedTransportMode: TransportMode;
  expandedStopId?: string;
  completedTodoIds: string[];
  autoFocus?: boolean;
  setSelectedTransportMode: (mode: TransportMode) => void;
  setExpandedStopId: (stopId?: string) => void;
  toggleTodo: (todoId: string) => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "sharing" | "done">("idle");
  const [shareUrl, setShareUrl] = useState("");
  const [lastAction, setLastAction] = useState<EcosystemActionReceipt | undefined>();
  const allDone = completedTodoIds.length === plan.todoItems.length;

  function mockShare() {
    setShareState("sharing");
    setLastAction(undefined);
    window.setTimeout(() => {
      const url = createMockShareUrl(plan);
      setShareUrl(url);
      setShareState("done");
      setLastAction({
        title: "分享链接已生成",
        detail: "已模拟调用美团 AWP，生成包含 POI、路线和时间线的 H5 链接。",
        url,
        status: "ready"
      });
    }, 650);
  }

  function handleStopAction(stop: DemoPoiStop, action: DemoPoiStop["actions"][number]) {
    setLastAction(createMockActionReceipt(plan, stop, action));
  }

  function handleTodoAction(todo: DemoRoutePlan["todoItems"][number]) {
    const stop = plan.stops.find((item) => item.poiId === todo.stopPoiId) ?? plan.stops[0];
    const action = actionForTodo(stop, todo);
    if (stop && action) {
      setLastAction(createMockActionReceipt(plan, stop, action));
    }
  }

  function handleTodoReferenceAction(
    todo: DemoRoutePlan["todoItems"][number],
    reference: DemoRoutePlan["todoItems"][number]["actionReferences"][number]
  ) {
    if (reference.actionKind === "share") {
      mockShare();
      return;
    }
    const stop = plan.stops.find((item) => item.poiId === todo.stopPoiId) ?? plan.stops[0];
    const action = stop?.actions.find((item) => item.kind === reference.actionKind) ?? actionForTodo(stop, todo);
    if (stop && action) {
      setLastAction(createMockActionReceipt(plan, stop, action));
    }
  }

  return (
    <motion.section key="selected" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      <section
        data-flow-block
        data-flow-autofocus={autoFocus ? "true" : undefined}
        className={cn(FLOW_BLOCK_CLASS, "py-2")}
      >
        <div className="rounded-2xl bg-dz-ink p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-dz-yellow">距出发还有 1 小时 20 分</p>
              <h2 className="mt-2 text-2xl font-black">{plan.title}</h2>
              <p className="mt-2 text-sm text-white/70">全程约 {plan.totalMinutes} 分钟 · 推荐 {activeTransport.label} · {activeTransport.cost}</p>
            </div>
            <button
              onClick={mockShare}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/12 px-3 py-2 text-xs font-black text-white backdrop-blur"
            >
              <Share2 className="h-3.5 w-3.5" />
              {shareState === "sharing" ? "生成中" : shareState === "done" ? "已生成" : "分享"}
            </button>
          </div>
          {shareState === "done" && shareUrl && (
            <div className="mt-4 rounded-2xl bg-white px-3 py-3 text-xs leading-5 text-dz-ink">
              <div className="font-black">Mock AWP 分享链接</div>
              <div className="mt-1 break-all font-mono text-[11px] text-neutral-600">{shareUrl}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {["微信", "朋友圈", "微博"].map((channel) => (
                  <span key={channel} className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">
                    可转发至{channel}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 rounded-2xl bg-white/10 px-3 py-3 text-xs font-semibold leading-5 text-white/80">
            已同步到大众点评首页：回到首页可看到“您有一个预定好的计划”，点击可继续查看本方案。
          </div>
        </div>

        {lastAction && (
          <div
            className={cn(
              "mt-4 rounded-2xl border px-4 py-3 text-xs leading-5 shadow-sm",
              lastAction.status === "disabled" ? "border-neutral-200 bg-neutral-50 text-neutral-500" : "border-dz-orange/25 bg-dz-soft text-dz-ink"
            )}
          >
            <div className="flex items-center gap-2 font-black">
              <ExternalLink className="h-3.5 w-3.5" />
              {lastAction.title}
            </div>
            <p className="mt-1">{lastAction.detail}</p>
            <p className="mt-2 break-all font-mono text-[11px] text-neutral-500">{lastAction.url}</p>
          </div>
        )}

        <div className="mt-4 rounded-2xl bg-white p-2 shadow-sm">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-dz-soft p-1">
            {plan.transports.map((transport) => (
              <button
                key={transport.mode}
                onClick={() => setSelectedTransportMode(transport.mode)}
                className={cn(
                  "rounded-xl px-2 py-2 text-xs font-bold",
                  selectedTransportMode === transport.mode ? "bg-white text-dz-orange shadow-sm" : "text-neutral-500"
                )}
              >
                {transport.label}
              </button>
            ))}
          </div>
          <p className="px-2 pt-3 text-xs leading-5 text-neutral-500">{activeTransport.detail} · 预计 {activeTransport.minutes} 分钟</p>
        </div>

        <div className="mt-4 space-y-3">
          {plan.stops.map((stop, index) => (
            <TimelineStop
              key={stop.poiId}
              stop={stop}
              index={index}
              expanded={expandedStopId === stop.poiId}
              onToggle={() => setExpandedStopId(expandedStopId === stop.poiId ? undefined : stop.poiId)}
              onAction={(action) => handleStopAction(stop, action)}
            />
          ))}
        </div>
      </section>

      <section data-flow-block className={cn(FLOW_BLOCK_CLASS, "rounded-2xl bg-white p-4 shadow-sm")}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black">To-do 清单</h3>
          <span className="text-xs text-neutral-500">{completedTodoIds.length}/{plan.todoItems.length}</span>
        </div>
        {allDone && (
          <div className="mb-3 rounded-2xl bg-green-50 px-3 py-3 text-xs font-black text-green-700">
            已充分准备好，玩得开心！
          </div>
        )}
        <div className="divide-y divide-dz-line">
          {[...plan.todoItems]
            .sort((a, b) => Number(completedTodoIds.includes(a.id)) - Number(completedTodoIds.includes(b.id)))
            .map((todo) => {
            const done = completedTodoIds.includes(todo.id);
            return (
              <TodoPreparationItem
                key={todo.id}
                todo={todo}
                done={done}
                onToggle={() => toggleTodo(todo.id)}
                onAction={() => handleTodoAction(todo)}
                onReferenceAction={(reference) => handleTodoReferenceAction(todo, reference)}
              />
            );
          })}
        </div>
      </section>
    </motion.section>
  );
}

function TodoPreparationItem({
  todo,
  done,
  onToggle,
  onAction,
  onReferenceAction
}: {
  todo: DemoRoutePlan["todoItems"][number];
  done: boolean;
  onToggle: () => void;
  onAction: () => void;
  onReferenceAction: (reference: DemoRoutePlan["todoItems"][number]["actionReferences"][number]) => void;
}) {
  return (
    <article className={cn("py-3 transition", done && "opacity-55")}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
            done && "border-green-500 bg-green-500 text-white"
          )}
          aria-label={done ? "标记为未完成" : "标记为已完成"}
        >
          {done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-[13px] font-black leading-5 text-[#20283a]">{todo.label}</h4>
            <button
              onClick={onAction}
              className="shrink-0 rounded-full bg-dz-soft px-2.5 py-1 text-[11px] font-black text-dz-orange"
            >
              {todo.actionLabel}
            </button>
          </div>

          {!!todo.constraints.length && (
            <div className="mt-2 space-y-1.5">
              {todo.constraints.map((constraint) => (
                <div
                  key={constraint.id}
                  className={cn(
                    "rounded-xl px-2.5 py-2 text-[11px] font-semibold leading-4",
                    constraint.severity === "required" && "bg-[#fff4ec] text-[#a94c1f]",
                    constraint.severity === "warning" && "bg-[#fff9df] text-[#8b6b12]",
                    constraint.severity === "info" && "bg-[#f1f5ff] text-[#4d63a5]",
                    !constraint.satisfied && "bg-red-50 text-red-700"
                  )}
                >
                  <span className="font-black">{constraint.label}：</span>
                  {constraint.detail}
                </div>
              ))}
            </div>
          )}

          {!!todo.actionReferences.length && (
            <div className="-mr-4 mt-3 flex snap-x gap-2 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {todo.actionReferences.map((reference) => (
                <TodoReferenceCard key={reference.id} reference={reference} onAction={() => onReferenceAction(reference)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function TodoReferenceCard({
  reference,
  onAction
}: {
  reference: DemoRoutePlan["todoItems"][number]["actionReferences"][number];
  onAction: () => void;
}) {
  const Icon = actionIcon[reference.actionKind] ?? ExternalLink;
  return (
    <button
      onClick={onAction}
      className="grid w-[150px] shrink-0 snap-start overflow-hidden rounded-xl border border-dz-line bg-white text-left shadow-[0_6px_20px_rgba(32,40,58,0.08)]"
    >
      <div
        className="relative h-[94px] bg-cover bg-center"
        style={{ backgroundImage: `url('${reference.imageUrl}')` }}
      >
        {reference.badge && (
          <span className="absolute left-0 top-0 rounded-br-lg bg-[#ff7a1a] px-2 py-1 text-[12px] font-black text-white">
            {reference.badge}
          </span>
        )}
      </div>
      <div className="p-2">
        <h5 className="line-clamp-2 min-h-[34px] text-[13px] font-black leading-[17px] text-[#20283a]">{reference.title}</h5>
        <p className="mt-1 line-clamp-2 min-h-[28px] text-[10px] font-semibold leading-[14px] text-neutral-500">{reference.subtitle}</p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <span className="truncate text-[14px] font-black text-red-500">{reference.price ?? "查看"}</span>
          <span className="shrink-0 text-[10px] font-bold text-neutral-400">{reference.distance}</span>
        </div>
        <span className="mt-2 inline-flex h-7 items-center gap-1 rounded-full bg-dz-soft px-2 text-[11px] font-black text-dz-orange">
          <Icon className="h-3.5 w-3.5" />
          {reference.actionLabel}
        </span>
      </div>
    </button>
  );
}

function TimelineStop({
  stop,
  index,
  expanded,
  onToggle,
  onAction
}: {
  stop: DemoPoiStop;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: DemoPoiStop["actions"][number]) => void;
}) {
  return (
    <section className="grid grid-cols-[42px_1fr] gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-dz-yellow text-xs font-black">{index + 1}</span>
        <span className="mt-2 h-full min-h-16 w-px bg-dz-line" />
      </div>
      <div className="rounded-2xl bg-white p-4 text-left shadow-sm">
        <button onClick={onToggle} className="flex w-full items-start justify-between gap-2 text-left">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-dz-orange">
              <Clock3 className="h-3.5 w-3.5" />
              {stop.startTime} · 停留 {stop.durationMinutes} 分钟
            </div>
            <h3 className="mt-2 text-base font-black">{stop.poiName}</h3>
            <p className="mt-1 text-xs text-neutral-500">{stop.address}</p>
          </div>
          <ChevronRight className={cn("mt-2 h-4 w-4 text-neutral-400 transition", expanded && "rotate-90")} />
        </button>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3">
            <p className="text-xs leading-5 text-neutral-600">{stop.ugcSummary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {stop.actions.map((action) => {
                const Icon = actionIcon[action.kind];
                return (
                  <button
                    key={action.id}
                    onClick={() => onAction(action)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold",
                      action.disabled ? "bg-neutral-100 text-neutral-400" : "bg-dz-soft text-dz-orange"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}


function SettingsDrawer({
  onClose,
  onNewChat,
  onOpenHistory,
  traces,
  onSelectTrace
}: {
  onClose: () => void;
  onNewChat: () => void;
  onOpenHistory: () => void;
  traces: TraceSummary[];
  onSelectTrace: (id: string) => void;
}) {
  return (
    <motion.div
      className="absolute inset-0 z-40 flex justify-end bg-[#151927]/48 backdrop-blur-[7px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-[80%] flex-col overflow-hidden rounded-l-[26px] bg-[#f6f7fb] shadow-[-18px_0_60px_rgba(9,15,30,0.24)]"
      >
        <div className="shrink-0 px-4 pb-3 pt-[58px]">
          <div className="rounded-[22px] bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onNewChat}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-[#20283a] px-3 py-2.5 text-left text-white"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/14">
                  <MessageSquarePlus className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black">新增聊天</span>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/62">开启一次新的路线规划</span>
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1f2f6] text-[#687083]"
                aria-label="关闭设置"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {traces.length > 0 ? traces.slice(0, 3).map((trace) => (
                <button
                  key={trace.id}
                  type="button"
                  onClick={() => onSelectTrace(trace.id)}
                  className="grid w-full grid-cols-[26px_1fr] items-start gap-2 rounded-2xl bg-[#f7f8fb] px-2.5 py-2 text-left"
                >
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 text-[#7f8eff]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-black text-[#20283a]">{trace.user_goal || "未命名"}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#8a91a0]">{trace.status === "completed" ? "已完成" : trace.status} · {trace.event_count} 事件</span>
                  </span>
                </button>
              )) : (
                <p className="px-2 py-2 text-[11px] text-[#8a91a0]">暂无对话历史</p>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenHistory}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-2xl bg-[#eef1ff] px-3 py-2 text-[12px] font-black text-[#4f68ff]"
            >
              查看更多
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SettingsView />
        </div>
      </motion.aside>
    </motion.div>
  );
}

function ConversationHistoryPage({ onBack, onClose, traces, onSelectTrace }: { onBack: () => void; onClose: () => void; traces: TraceSummary[]; onSelectTrace: (id: string) => void }) {
  return (
    <motion.section
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-[#f6f7fb] text-[#20283a]"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      <DianpingStatusBar />
      <header className="grid grid-cols-[44px_1fr_44px] items-center px-4 pb-3">
        <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm" aria-label="返回设置">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-center text-[16px] font-black">对话历史</h2>
        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm" aria-label="关闭历史">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-3">
          {traces.length > 0 ? traces.map((trace) => (
            <button key={trace.id} type="button" onClick={() => onSelectTrace(trace.id)} className="w-full rounded-[20px] bg-white p-4 text-left shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black">{trace.user_goal || "未命名"}</h3>
                  <p className="mt-1 text-[11px] font-semibold text-[#8a91a0]">{trace.status === "completed" ? "已完成" : trace.status} · {trace.event_count} 事件 · {trace.total_duration_ms}ms</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#b4bac5]" />
              </div>
              {trace.route_score != null && (
                <p className="mt-3 text-xs leading-5 text-[#66708a]">路线评分: {trace.route_score}</p>
              )}
            </button>
          )) : (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-[#8a91a0] shadow-sm">暂无对话历史</p>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function SettingsView() {
  const activeUserId = useDemoStore((state) => state.activeUserId);
  const requireRequirementConfirmation = useDemoStore((state) => state.requireRequirementConfirmation);
  const preferenceDetectionEnabled = useDemoStore((state) => state.preferenceDetectionEnabled);
  const dataAuthorizationEnabled = useDemoStore((state) => state.dataAuthorizationEnabled);
  const userPreferences = useDemoStore((state) => state.userPreferences);
  const appliedMockUsers = useDemoStore((state) => state.appliedMockUsers);
  const setRequireRequirementConfirmation = useDemoStore((state) => state.setRequireRequirementConfirmation);
  const setPreferenceDetectionEnabled = useDemoStore((state) => state.setPreferenceDetectionEnabled);
  const setDataAuthorizationEnabled = useDemoStore((state) => state.setDataAuthorizationEnabled);
  const setUserPreferences = useDemoStore((state) => state.setUserPreferences);
  const removeUserPreference = useDemoStore((state) => state.removeUserPreference);
  const updateUserPreference = useDemoStore((state) => state.updateUserPreference);
  const updateAppliedUser = useDemoStore((state) => state.updateAppliedUser);
  const setActiveUserId = useDemoStore((state) => state.setActiveUserId);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [preferenceSyncStatus, setPreferenceSyncStatus] = useState<"idle" | "loading" | "saved" | "error" | "local">("idle");
  const settings = [
    {
      id: "confirmation",
      title: "需求确认",
      desc: "开启后生成规划前会先给你看总结；关闭后信息足够就直接出方案。",
      enabled: requireRequirementConfirmation,
      onChange: setRequireRequirementConfirmation
    },
    {
      id: "preference",
      title: "AI 检测偏好",
      desc: "后台从本轮输入提取长期偏好，不影响当前规划速度。",
      enabled: preferenceDetectionEnabled,
      onChange: setPreferenceDetectionEnabled
    },
    {
      id: "data",
      title: "数据授权",
      desc: "关闭后本轮按匿名用户规划，不读取 mock 历史画像。",
      enabled: dataAuthorizationEnabled,
      onChange: setDataAuthorizationEnabled
    }
  ];
  const activeMockUser = appliedMockUsers.find((user) => user.id === activeUserId) ?? appliedMockUsers[0];

  function startEdit(field: string, currentValue: string) {
    setEditingField(field);
    setEditDraft(currentValue);
  }

  function commitEdit(field: string) {
    if (!activeMockUser) return;
    const trimmed = editDraft.trim();
    if (!trimmed) { setEditingField(null); return; }
    if (field === "用户 ID") {
      updateAppliedUser(activeMockUser.id, { id: trimmed });
      setActiveUserId(trimmed);
    } else if (field === "性别") {
      updateAppliedUser(activeMockUser.id, { gender: trimmed });
    } else if (field === "年龄") {
      const age = Number(trimmed);
      if (!isNaN(age) && age > 0) updateAppliedUser(activeMockUser.id, { age });
    } else if (field === "职业") {
      updateAppliedUser(activeMockUser.id, { occupation: trimmed });
    }
    setEditingField(null);
  }

  const profileRows: Array<[string, string]> = [
    ["用户 ID", activeMockUser?.id ?? (activeUserId || "anonymous")],
    ["性别", activeMockUser?.gender ?? "不透露"],
    ["年龄", typeof activeMockUser?.age === "number" ? `${activeMockUser.age}` : "青年人"],
    ["职业", activeMockUser?.occupation ?? "未设置"]
  ];
  const fixedPreferences = [
    ["常用出行区域", activeMockUser?.frequent_areas?.length ? activeMockUser.frequent_areas : ["望京", "大山子", "徐汇区"]],
    ["餐饮/体验偏好", activeMockUser?.preferences?.length ? activeMockUser.preferences : ["川菜", "日料", "甜品"]],
    ["避雷点", activeMockUser?.avoidances?.length ? activeMockUser.avoidances : ["少排队"]],
    ["消费水平", [activeMockUser?.budget_per_person ? `¥${activeMockUser.budget_per_person}/人` : "¥100-200"]],
    ["出行方式", [activeMockUser?.transport_preference ?? "步行 + 打车"]],
    ["兴趣标签", activeMockUser?.lifestyle_tags?.length ? activeMockUser.lifestyle_tags : ["小众去处", "看展", "安静聊天"]]
  ];

  useEffect(() => {
    if (!dataAuthorizationEnabled) {
      setPreferenceSyncStatus("local");
      return;
    }

    let cancelled = false;
    setPreferenceSyncStatus("loading");
    listUserPreferences(activeUserId)
      .then((profile) => {
        if (cancelled) {
          return;
        }
        setUserPreferences(profile.preferences);
        setPreferenceSyncStatus("idle");
      })
      .catch(() => {
        if (!cancelled) {
          setPreferenceSyncStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeUserId, dataAuthorizationEnabled, setUserPreferences]);

  async function handlePreferenceUpdate(preferenceId: string, label: string) {
    const nextLabel = correctedPreferenceLabel(label);
    updateUserPreference(preferenceId, nextLabel);
    if (!dataAuthorizationEnabled) {
      setPreferenceSyncStatus("local");
      return;
    }

    try {
      const updated = await updateUserPreferenceOnApi(activeUserId, preferenceId, nextLabel);
      setUserPreferences(userPreferences.map((preference) => (preference.id === preferenceId ? updated : preference)));
      setPreferenceSyncStatus("saved");
    } catch {
      setPreferenceSyncStatus("error");
    }
  }

  async function handlePreferenceDelete(preferenceId: string) {
    removeUserPreference(preferenceId);
    if (!dataAuthorizationEnabled) {
      setPreferenceSyncStatus("local");
      return;
    }

    try {
      const profile = await deleteUserPreferenceOnApi(activeUserId, preferenceId);
      setUserPreferences(profile.preferences);
      setPreferenceSyncStatus("saved");
    } catch {
      setPreferenceSyncStatus("error");
    }
  }

  return (
    <section className="space-y-3">
      <BlockTitle title="设置与偏好" subtitle="这些设置会影响下一次路线规划，偏好条目可本地修正或删除。" />

      <section className="rounded-[20px] bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black">个人基础信息</h3>
        <div className="mt-3 space-y-2">
          {profileRows.map(([label, value]) => (
            <div key={label}>
              {editingField === label ? (
                <div className="flex items-center gap-2 rounded-2xl bg-[#f7f8fb] px-3 py-2.5">
                  <span className="text-xs font-black text-[#66708a]">{label}</span>
                  <input
                    type="text"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={() => commitEdit(label)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(label); if (e.key === "Escape") setEditingField(null); }}
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-right text-xs font-semibold text-[#20283a] outline-none"
                  />
                </div>
              ) : (
                <button type="button" onClick={() => startEdit(label, value)} className="flex w-full items-center justify-between rounded-2xl bg-[#f7f8fb] px-3 py-2.5 text-left">
                  <span className="text-xs font-black text-[#66708a]">{label}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#20283a]">
                    {value}
                    <Pencil className="h-3 w-3 text-[#b4bac5]" />
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[20px] bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black">固定偏好设置</h3>
        <p className="mt-1 text-xs leading-5 text-neutral-500">AI 检测到的长期偏好会补充到这里，方便之后复用。</p>
        <div className="mt-3 space-y-3">
          {fixedPreferences.map(([label, values]) => (
            <div key={label as string}>
              <div className="text-[11px] font-black text-[#7a8190]">{label}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(values as string[]).map((value) => (
                  <span key={value} className="rounded-full bg-[#eef1ff] px-2.5 py-1 text-[11px] font-bold text-[#4f68ff]">
                    {value}
                  </span>
                ))}
                <button type="button" className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f1f2f6] text-[#7a8190]" aria-label={`新增${label}`}>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-3">
        {settings.map((setting) => (
          <div key={setting.id} className="rounded-[20px] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="min-w-0 pr-3">
                <div className="text-sm font-black">{setting.title}</div>
                <div className="mt-1 text-xs leading-5 text-neutral-500">{setting.desc}</div>
              </div>
              <button
                onClick={() => setting.onChange(!setting.enabled)}
                className={cn("h-6 w-11 shrink-0 rounded-full p-1 transition", setting.enabled ? "bg-[#4f68ff]" : "bg-neutral-200")}
                aria-label={`${setting.enabled ? "关闭" : "开启"}${setting.title}`}
              >
                <span className={cn("block h-4 w-4 rounded-full bg-white transition", setting.enabled && "translate-x-5")} />
              </button>
            </div>
          </div>
        ))}

        <section className="rounded-[20px] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black">已记录偏好</h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                可以理解为 Agent 之后会参考的小记忆；API 可用时会同步到用户档案 Mock 服务。
              </p>
            </div>
            <span className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">{userPreferences.length} 条</span>
          </div>
          <div className="mt-3 rounded-2xl bg-neutral-50 px-3 py-2 text-[11px] font-semibold leading-5 text-neutral-500">
            {preferenceSyncStatusText(preferenceSyncStatus)}
          </div>
          <div className="mt-3 space-y-2">
            {userPreferences.length ? (
              userPreferences.map((preference) => (
                <article key={preference.id} className="rounded-2xl border border-dz-line px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black">{preference.label}</div>
                      <div className="mt-1 text-[11px] leading-5 text-neutral-500">
                        来源：{preference.source}
                        {preference.confidence ? ` · 置信度 ${Math.round(preference.confidence * 100)}%` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => void handlePreferenceUpdate(preference.id, preference.label)}
                        className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange"
                      >
                        修正
                      </button>
                      <button
                        onClick={() => void handlePreferenceDelete(preference.id)}
                        className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-500"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-2xl bg-neutral-50 px-3 py-4 text-xs font-semibold leading-5 text-neutral-500">
                暂无偏好。开启 AI 检测偏好后，后续对话可继续补充这里。
              </p>
            )}
          </div>
        </section>

        <section className="rounded-[20px] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black">关于</h3>
          <div className="mt-3 space-y-2">
            {["功能介绍", "反馈与帮助"].map((item) => (
              <button key={item} type="button" className="flex w-full items-center justify-between rounded-2xl bg-[#f7f8fb] px-3 py-2.5 text-xs font-black text-[#20283a]">
                {item}
                <ChevronRight className="h-3.5 w-3.5 text-[#b4bac5]" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function correctedPreferenceLabel(label: string) {
  const corrections: Record<string, string> = {
    低排队: "可接受短队",
    约会氛围: "安静聊天",
    步行友好: "少走路",
    可拍照: "不必打卡"
  };
  return corrections[label] ?? "低排队";
}

function preferenceSyncStatusText(status: "idle" | "loading" | "saved" | "error" | "local") {
  const labels = {
    idle: "已从用户档案服务同步；下一次规划会把这些偏好交给 UserPreferenceAgent。",
    loading: "正在同步用户档案服务...",
    saved: "已保存到用户档案服务。",
    error: "用户档案服务暂时不可用，当前先保留本地偏好。",
    local: "数据授权已关闭，当前只做本地展示，不写入服务端档案。"
  };
  return labels[status];
}

function BlockTitle({ title, subtitle, compact = false }: { title: string; subtitle: string; compact?: boolean }) {
  return (
    <div className={cn(compact ? "mb-0" : "mb-4")}>
      <h2 className="text-xl font-black tracking-normal">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500">{subtitle}</p>
    </div>
  );
}

/**
 * 仅用于 UI 提示（例如搜索入口显示"这看起来像路线规划"），不再决定接口调用。
 * 所有用户输入统一走 /interactions/respond，由后端 InteractionRouterAgent 分流。
 */
function _isRoutePlanningGoal(goal: string) {
  const normalized = goal.replace(/\s/g, "");
  if (!normalized) {
    return false;
  }

  if (/(规划|路线|行程|安排|一日游|半日游|半天|一天|去哪玩|怎么玩)/.test(normalized)) {
    return true;
  }

  if (/(今天|明天|周末|下午|晚上).*(吃|逛|玩|看展|约会).*(安排|规划|路线|去哪)/.test(normalized)) {
    return true;
  }

  return /(几个小时|五个小时|四个小时|三小时|半天).*(安排|去哪|玩|逛|吃)/.test(normalized);
}

function createPromptSummary(prompt: string) {
  const normalized = prompt.replace(/[，。！？、,.!?]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "本轮路线规划";
  }

  const area = normalized.match(/(北京|上海|望京|徐汇|三里屯|亮马桥|798|蓝港|附近)/)?.[0];
  const time = normalized.match(/(今天下午|今晚|明天|周末|下午|晚上|半天|一天)/)?.[0];
  const activity = normalized.match(/(约会|看展|吃饭|咖啡|甜品|拍照|逛街|遛娃|小吃)/)?.[0];
  const parts = [time, area, activity].filter(Boolean);

  if (parts.length >= 2) {
    return `${parts.join(" · ")}路线`;
  }

  return normalized.length > 16 ? `${normalized.slice(0, 16)}...` : normalized;
}

function agentStrategyToRunningStep(strategy: AgentStrategy): RunningAgentStep {
  return {
    id: strategy.name,
    agent: strategy.name,
    label: agentDisplayLabel(strategy.name),
    detail: `${strategy.responsibility}${strategy.handoff_conditions[0] ? ` 交接条件：${strategy.handoff_conditions[0]}` : ""}`
  };
}

function agentDisplayLabel(agentName: string) {
  const labels: Record<string, string> = {
    InteractionRouterAgent: "判断任务类型",
    ConstraintDiscoveryAgent: "拆解目标和约束",
    UserPreferenceAgent: "读取长期偏好",
    ContextGroundingAgent: "落地事实约束",
    PlanSolverAgent: "生成候选方案",
    PlanEvaluatorAgent: "校验并排序",
    PlanExplanationAgent: "解释方案"
  };
  return labels[agentName] ?? agentName;
}

function buildClarificationAnswers(
  clarification: ClarificationState,
  cards: ClarificationCard[] = [],
  cardAnswers: ClarificationCardAnswers = {}
) {
  const answers: Record<string, string> = {
    people: `${clarification.people} 人`,
    time_window: clarification.timeRange,
    time: clarification.timeRange,
    food: clarification.food,
    budget: clarification.budget,
    taste: clarification.taste
  };

  cards.forEach((card) => {
    const rawAnswer = cardAnswers[card.id] ?? card.default_value;
    const answer = normalizeCardAnswerValue(rawAnswer);
    if (!answer) {
      return;
    }
    const field = normalizeClarificationField(card.field);
    answers[field] = answer;
    if (field === "time_window") {
      answers.time = answer;
    }
    if (field === "people" || field === "group_size") {
      answers.people = answer;
    }
  });

  return answers;
}

function initializeClarificationCardAnswers(
  cards: ClarificationCard[],
  clarification: ClarificationState
): ClarificationCardAnswers {
  return cards.reduce<ClarificationCardAnswers>((answers, card) => {
    const fallback = answerFromClarification(clarification, card);
    if (card.selection_mode === "multiple") {
      answers[card.id] = card.default_value ? [card.default_value] : fallback ? [fallback] : [];
    } else {
      answers[card.id] = card.default_value ?? fallback ?? "";
    }
    return answers;
  }, {});
}

function updateClarificationCardAnswers(
  current: ClarificationCardAnswers,
  card: ClarificationCard,
  option: string
): ClarificationCardAnswers {
  if (card.selection_mode !== "multiple") {
    return { ...current, [card.id]: option };
  }

  const existing = Array.isArray(current[card.id]) ? (current[card.id] as string[]) : [];
  const isSelected = existing.includes(option);
  const next = isSelected ? existing.filter((item) => item !== option) : [...existing.filter((item) => item !== "随便"), option];
  if (option === "随便" && !isSelected) {
    return { ...current, [card.id]: ["随便"] };
  }
  return { ...current, [card.id]: next };
}

function applyClarificationCardAnswer(
  current: ClarificationState,
  card: ClarificationCard,
  answer: string | string[] | undefined
): ClarificationState {
  const value = normalizeCardAnswerValue(answer);
  if (card.field === "people" || card.field === "group_size") {
    return { ...current, people: parsePeopleOption(value) };
  }
  if (card.field === "time" || card.field === "time_window") {
    return { ...current, timeRange: normalizeTimeOption(value) };
  }
  if (card.field === "food" || card.field === "food_preference") {
    return { ...current, food: value };
  }
  if (card.field === "budget" || card.field === "budget_per_person") {
    return { ...current, budget: value };
  }
  if (card.field === "taste") {
    return { ...current, taste: value };
  }
  return current;
}

function isClarificationOptionSelected(
  clarification: ClarificationState,
  cardAnswers: ClarificationCardAnswers,
  card: ClarificationCard,
  option: string
) {
  const answer = cardAnswers[card.id];
  if (Array.isArray(answer)) {
    return answer.includes(option);
  }
  if (typeof answer === "string" && answer) {
    return answer === option;
  }
  if (card.field === "people" || card.field === "group_size") {
    return clarification.people === parsePeopleOption(option);
  }
  if (card.field === "time" || card.field === "time_window") {
    return clarification.timeRange === normalizeTimeOption(option) || clarification.timeRange === option;
  }
  if (card.field === "food" || card.field === "food_preference") {
    return clarification.food === option;
  }
  if (card.field === "budget" || card.field === "budget_per_person") {
    return clarification.budget === option;
  }
  if (card.field === "taste") {
    return clarification.taste === option;
  }
  return false;
}

function normalizeCardAnswerValue(answer: string | string[] | undefined) {
  if (Array.isArray(answer)) {
    return answer.join("、");
  }
  return answer ?? "";
}

function normalizeClarificationField(field: string) {
  const fieldMap: Record<string, string> = {
    group_size: "people",
    time: "time_window",
    food_preference: "food",
    budget_per_person: "budget"
  };
  return fieldMap[field] ?? field;
}

function answerFromClarification(clarification: ClarificationState, card: ClarificationCard) {
  if (card.field === "people" || card.field === "group_size") {
    return `${clarification.people} 人`;
  }
  if (card.field === "time" || card.field === "time_window") {
    return clarification.timeRange;
  }
  if (card.field === "food" || card.field === "food_preference") {
    return clarification.food;
  }
  if (card.field === "budget" || card.field === "budget_per_person") {
    return clarification.budget;
  }
  if (card.field === "taste") {
    return clarification.taste;
  }
  return "";
}

function parsePeopleOption(option: string) {
  if (option.includes("5")) {
    return 5;
  }
  const match = option.match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function normalizeTimeOption(option: string) {
  const timeMap: Record<string, string> = {
    上午: "今天上午 09:00-12:00",
    下午: "今天下午 14:00-18:00",
    晚上: "今晚 18:00-21:30",
    随便: "随便"
  };
  return timeMap[option] ?? option;
}

type ParsedClarificationText = {
  people?: number;
  timeRange?: string;
  foodChoices?: string[];
  budget?: string;
  taste?: string;
  mobility?: string;
  goalIntent?: string;
  refinementContext?: string;
};

function applyFreeformClarificationInput(
  text: string,
  current: ClarificationState,
  cards: ClarificationCard[],
  cardAnswers: ClarificationCardAnswers
) {
  const parsed = parseFreeformClarificationText(text);
  const recognizedLabels: string[] = [];
  const nextClarification: ClarificationState = { ...current };
  const nextAnswers: ClarificationCardAnswers = { ...cardAnswers };

  if (parsed.people) {
    nextClarification.people = parsed.people;
    recognizedLabels.push(`人数 ${parsed.people} 人`);
  }
  if (parsed.timeRange) {
    nextClarification.timeRange = parsed.timeRange;
    recognizedLabels.push(`时间 ${parsed.timeRange}`);
  }
  if (parsed.foodChoices?.length) {
    nextClarification.food = parsed.foodChoices.join("、");
    recognizedLabels.push(`饮食 ${nextClarification.food}`);
  }
  if (parsed.budget) {
    nextClarification.budget = parsed.budget;
    recognizedLabels.push(`预算 ${parsed.budget}`);
  }
  if (parsed.taste) {
    nextClarification.taste = parsed.taste;
    recognizedLabels.push(`口味 ${parsed.taste}`);
  }

  cards.forEach((card) => {
    const answer = answerForClarificationCard(card, parsed, text);
    if (answer !== undefined) {
      nextAnswers[card.id] = answer;
    }
  });

  if (!recognizedLabels.length) {
    const freeTextCard = cards.find((card) => card.selection_mode === "free_text" || !card.options.length);
    if (freeTextCard) {
      nextAnswers[freeTextCard.id] = text;
    }
  }

  return {
    clarification: nextClarification,
    cardAnswers: nextAnswers,
    recognizedLabels: Array.from(new Set(recognizedLabels))
  };
}

function parseFreeformClarificationText(text: string): ParsedClarificationText {
  return {
    people: parsePeopleFromText(text),
    timeRange: parseTimeRangeFromText(text),
    foodChoices: parseFoodChoicesFromText(text),
    budget: parseBudgetFromText(text),
    taste: parseTasteFromText(text),
    mobility: parseMobilityFromText(text),
    goalIntent: parsePlanningGoalAnswer(text),
    refinementContext: parseRefinementContextAnswer(text)
  };
}

function parsePeopleFromText(text: string) {
  const normalized = text.replace(/\s/g, "");
  const numberMatch = normalized.match(/(\d{1,2})(?:个?人|位|人出行)/);
  if (numberMatch) {
    return Math.max(1, Math.min(20, Number(numberMatch[1])));
  }
  const chineseNumbers: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    俩: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };
  for (const [word, number] of Object.entries(chineseNumbers)) {
    if (normalized.includes(`${word}个人`) || normalized.includes(`${word}人`) || normalized.includes(`${word}位`)) {
      return number;
    }
  }
  if (/(情侣|约会|两人|双人)/.test(normalized)) {
    return 2;
  }
  return undefined;
}

function parseTimeRangeFromText(text: string) {
  const normalized = text.replace(/\s/g, "");
  const explicit = normalized.match(/(\d{1,2})(?:[:：点])?(\d{0,2})?(?:-|到|~|至)(\d{1,2})(?:[:：点])?(\d{0,2})?/);
  if (explicit) {
    const startHour = Number(explicit[1]);
    const startMinute = Number(explicit[2] || 0);
    const endHour = Number(explicit[3]);
    const endMinute = Number(explicit[4] || 0);
    if (startHour <= 23 && endHour <= 23) {
      return `今天 ${startHour.toString().padStart(2, "0")}:${startMinute.toString().padStart(2, "0")}-${endHour
        .toString()
        .padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`;
    }
  }
  if (/周末.*(半天|下午|上午|晚上)/.test(normalized)) {
    return "周末半天";
  }
  if (/(上午|早上)/.test(normalized)) {
    return normalizeTimeOption("上午");
  }
  if (/(下午|午后)/.test(normalized)) {
    return normalizeTimeOption("下午");
  }
  if (/(晚上|今晚|夜间)/.test(normalized)) {
    return normalizeTimeOption("晚上");
  }
  if (/半天/.test(normalized)) {
    return "今天半天";
  }
  return undefined;
}

function parseFoodChoicesFromText(text: string) {
  const normalized = text.replace(/\s/g, "");
  if (/(不吃|不安排吃|不吃任何|不用吃)/.test(normalized)) {
    return ["不吃任何东西"];
  }

  const choices: string[] = [];
  if (/(当地特色|特色小吃|本地小吃)/.test(normalized)) {
    choices.push("吃当地特色小吃");
  } else if (/(小吃|扫街)/.test(normalized)) {
    choices.push("吃小吃");
  }
  if (/(咖啡|奶茶|喝|饮品|甜品)/.test(normalized)) {
    choices.push("喝饮品");
  }
  if (/(吃饭|正餐|主食|餐厅|聚餐|火锅|川菜|日料|bistro)/i.test(normalized)) {
    choices.push("吃主食");
  }
  if (!choices.length && /随便/.test(normalized)) {
    choices.push("随便");
  }
  return choices.length ? Array.from(new Set(choices)) : undefined;
}

function parseBudgetFromText(text: string) {
  const normalized = text.replace(/\s/g, "");
  const numberMatch =
    normalized.match(/(?:人均|预算|每人|控制在|不超过|以内)[^\d]{0,6}(\d{2,4})/) ??
    normalized.match(/(\d{2,4})(?:元|块)(?:以内|左右|上下)?/);
  if (numberMatch) {
    return `人均 ¥${numberMatch[1]} 以内`;
  }
  if (/(一百五|一百五十|150)/.test(normalized)) {
    return "人均 ¥150 以内";
  }
  if (/(便宜|别太贵|性价比)/.test(normalized)) {
    return "人均 ¥150 以内";
  }
  if (/(高端|不计预算|贵一点)/.test(normalized)) {
    return "不计预算";
  }
  return undefined;
}

function parseTasteFromText(text: string) {
  const normalized = text.replace(/\s/g, "");
  if (/(不吃辣|一点辣都不行|不要辣|别辣|清淡)/.test(normalized)) {
    return "一点辣都不行";
  }
  if (/(微辣|一点辣|少辣)/.test(normalized)) {
    return "微辣可以";
  }
  if (/(无辣不欢|重辣|重口|川菜|火锅)/.test(normalized)) {
    return "无辣不欢";
  }
  if (/口味随便/.test(normalized)) {
    return "随便";
  }
  return undefined;
}

function parseMobilityFromText(text: string) {
  const normalized = text.replace(/\s/g, "");
  if (/(少走路|别太累|不想走|轻松)/.test(normalized)) {
    return "少走路";
  }
  if (/(多走走|散步|步行友好)/.test(normalized)) {
    return "步行友好";
  }
  return undefined;
}

function parsePlanningGoalAnswer(text: string) {
  const normalized = text.replace(/\s/g, "");
  if (/(继续|规划|路线|安排)/.test(normalized)) {
    return "继续规划路线";
  }
  if (/(先聊|聊清楚|补充)/.test(normalized)) {
    return "先聊需求";
  }
  if (/(取消|不规划|不用)/.test(normalized)) {
    return "取消本次规划";
  }
  return undefined;
}

function parseRefinementContextAnswer(text: string) {
  const normalized = text.replace(/\s/g, "");
  if (/(基于|当前|直接改|调整)/.test(normalized)) {
    return "基于当前方案调整";
  }
  if (/(重新|新方案|重来)/.test(normalized)) {
    return "重新生成新方案";
  }
  if (/(补充|完整需求|重新说)/.test(normalized)) {
    return "补充完整需求";
  }
  return undefined;
}

function answerForClarificationCard(card: ClarificationCard, parsed: ParsedClarificationText, text: string) {
  const field = normalizeClarificationField(card.field);
  if (field === "people" && parsed.people) {
    return `${parsed.people} 人`;
  }
  if (field === "time_window" && parsed.timeRange) {
    return parsed.timeRange;
  }
  if (field === "food" && parsed.foodChoices?.length) {
    return card.selection_mode === "multiple"
      ? matchMultipleCardOptions(card.options, parsed.foodChoices, text)
      : matchSingleCardOption(card.options, parsed.foodChoices.join("、")) ?? parsed.foodChoices.join("、");
  }
  if (field === "budget" && parsed.budget) {
    return matchBudgetCardOption(card.options, parsed.budget) ?? parsed.budget;
  }
  if (field === "taste" && parsed.taste) {
    return matchSingleCardOption(card.options, parsed.taste) ?? parsed.taste;
  }
  if (field === "mobility" && parsed.mobility) {
    return matchSingleCardOption(card.options, parsed.mobility) ?? parsed.mobility;
  }
  if (card.field === "goal" && parsed.goalIntent) {
    return matchSingleCardOption(card.options, parsed.goalIntent) ?? parsed.goalIntent;
  }
  if (card.field === "refinement_context" && parsed.refinementContext) {
    return matchSingleCardOption(card.options, parsed.refinementContext) ?? parsed.refinementContext;
  }
  return undefined;
}

function matchMultipleCardOptions(options: string[], values: string[], rawText: string) {
  if (!options.length) {
    return values;
  }
  const matched = options.filter((option) =>
    values.some((value) => optionMatchesValue(option, value) || optionMatchesValue(rawText, option))
  );
  const unique = Array.from(new Set(matched.length ? matched : values));
  if (unique.includes("随便") && unique.length > 1) {
    return unique.filter((value) => value !== "随便");
  }
  if (unique.includes("不吃任何东西")) {
    return ["不吃任何东西"];
  }
  return unique;
}

function matchSingleCardOption(options: string[], value: string) {
  return options.find((option) => optionMatchesValue(option, value)) ?? options.find((option) => optionMatchesValue(value, option));
}

function matchBudgetCardOption(options: string[], value: string) {
  if (!options.length) {
    return undefined;
  }
  const budgetNumber = extractFirstNumber(value);
  if (!budgetNumber) {
    return matchSingleCardOption(options, value);
  }
  return (
    options.find((option) => {
      const normalized = option.replace(/\s/g, "");
      const range = normalized.match(/(\d{2,4})\D+(\d{2,4})/);
      if (range) {
        const min = Number(range[1]);
        const max = Number(range[2]);
        return budgetNumber >= min && budgetNumber <= max;
      }
      const within = normalized.match(/(\d{2,4})(?:以内|以下)/);
      if (within) {
        return budgetNumber <= Number(within[1]);
      }
      const plus = normalized.match(/(\d{2,4})\+/);
      if (plus) {
        return budgetNumber >= Number(plus[1]);
      }
      return false;
    }) ?? matchSingleCardOption(options, value)
  );
}

function optionMatchesValue(option: string, value: string) {
  const normalizedOption = option.replace(/\s/g, "");
  const normalizedValue = value.replace(/\s/g, "");
  return normalizedOption === normalizedValue || normalizedOption.includes(normalizedValue) || normalizedValue.includes(normalizedOption);
}

function extractFirstNumber(value: string) {
  const match = value.match(/\d{1,4}/);
  return match ? Number(match[0]) : undefined;
}

function isPeopleClarificationCard(card: ClarificationCard) {
  return normalizeClarificationField(card.field) === "people";
}

function isTimeClarificationCard(card: ClarificationCard) {
  return normalizeClarificationField(card.field) === "time_window";
}

function timeShortcutMatches(value: string, option: string) {
  const normalizedValue = value.replace(/\s/g, "");
  const normalizedOption = option.replace(/\s/g, "");
  if (normalizedValue.includes(normalizedOption)) {
    return true;
  }
  if (normalizedOption.includes("下午")) {
    return /14:00|15:00|16:00|17:00|18:00/.test(normalizedValue);
  }
  if (normalizedOption.includes("晚上") || normalizedOption.includes("今晚")) {
    return /18:30|19:00|20:00|21:00|22:00/.test(normalizedValue);
  }
  if (normalizedOption.includes("上午")) {
    return /09:00|09:30|10:00|11:00|12:00/.test(normalizedValue);
  }
  return false;
}

function createTimeWindowPreview(value: string) {
  const range = value.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
  if (range) {
    return { start: range[1], end: range[2] };
  }
  if (value.includes("周末")) {
    return { start: "周末", end: "半天" };
  }
  if (value.includes("随便")) {
    return { start: "待定", end: "待定" };
  }
  return { start: "14:00", end: "18:00" };
}

function splitSummaryLine(line: string): [string, string] {
  const separatorIndex = line.search(/[：:]/);
  if (separatorIndex === -1) {
    return ["补充", line];
  }
  return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
}

function formatClarificationAnswer(answer: string | string[]) {
  return Array.isArray(answer) ? answer.join("、") : answer;
}

function createMockShareUrl(plan: DemoRoutePlan) {
  const params = new URLSearchParams({
    routeId: plan.id,
    title: plan.title,
    totalMinutes: String(plan.totalMinutes),
    pois: plan.stops.map((stop) => stop.poiName).join("|"),
    starts: plan.stops.map((stop) => stop.startTime).join("|")
  });
  return `https://awp.meituan.com/dzultra/share?${params.toString()}`;
}

function createMockActionReceipt(
  plan: DemoRoutePlan,
  stop: DemoPoiStop,
  action: DemoPoiStop["actions"][number]
): EcosystemActionReceipt {
  const params = new URLSearchParams({
    routeId: plan.id,
    poiId: stop.poiId,
    poiName: stop.poiName,
    action: action.kind,
    startTime: stop.startTime
  });
  const url = `https://awp.meituan.com/dzultra/${action.kind}?${params.toString()}`;

  if (action.disabled) {
    return {
      title: `${action.label}暂不可用`,
      detail: disabledActionReason(action.kind, stop),
      url,
      status: "disabled"
    };
  }

  return {
    title: `${action.label}入口已准备好`,
    detail: actionReceiptDetail(action.kind, stop),
    url,
    status: "ready"
  };
}

function actionForTodo(stop: DemoPoiStop | undefined, todo: DemoRoutePlan["todoItems"][number]) {
  if (!stop) {
    return undefined;
  }
  const label = `${todo.label} ${todo.actionLabel}`;
  const preferredKind = todo.actionKind ?? (
    label.includes("排号")
      ? "queue"
      : label.includes("购票")
        ? "ticket"
        : label.includes("团购")
          ? "deal"
          : label.includes("预订")
            ? "book"
            : label.includes("分享")
              ? "share"
              : undefined
  );
  return (
    stop.actions.find((action) => action.kind === preferredKind) ??
    (preferredKind === "share" ? { id: `${stop.poiId}-share`, label: "分享", kind: "share" as const } : undefined) ??
    stop.actions.find((action) => action.kind === "navigate")
  );
}

function actionReceiptDetail(kind: DemoPoiStop["actions"][number]["kind"], stop: DemoPoiStop) {
  const details: Record<DemoPoiStop["actions"][number]["kind"], string> = {
    navigate: `已生成传给地图应用的参数：${stop.poiName}，建议 ${stop.startTime} 到达。`,
    queue: `已模拟进入在线排号页，当前预估排队 ${stop.queueMinutes} 分钟。`,
    deal: `已模拟进入团购页，优先展示 ${stop.poiName} 可用优惠。`,
    ticket: `已模拟进入购票页，保留路线到达时间 ${stop.startTime}。`,
    book: `已模拟进入预订页，会带上人数、时间和当前路线来源。`,
    share: `已模拟生成 ${stop.poiName} 的同行确认卡，包含集合点、到达时间和路线来源。`
  };
  return details[kind];
}

function disabledActionReason(kind: DemoPoiStop["actions"][number]["kind"], stop: DemoPoiStop) {
  if (kind === "queue") {
    return stop.queueMinutes <= 5
      ? "当前排队很短，暂不需要提前在线排号。"
      : "当前商户排号能力暂未开放，先保留入口状态。";
  }
  return "当前 Mock POI 暂未开放该美大能力，真实接入后可替换为线上状态。";
}

function apiPlanToDemoPlan(plan: ApiRoutePlan, index = 0): DemoRoutePlan {
  const tones: DemoRoutePlan["mapTone"][] = ["orange", "blue", "green"];
  const stops = (plan.stops ?? []).map((stop, stopIndex): DemoPoiStop => {
    const poiId = stop.poi_id || `api-poi-${stopIndex + 1}`;
    return {
      poiId,
      poiName: stop.poi_name || `第 ${stopIndex + 1} 站`,
      category: stop.category ?? "entertainment",
      area: stop.area ?? "附近",
      address: stop.area ? `${stop.area} · 地址待补全` : "地址待补全",
      rating: stop.rating ?? 4.5,
      avgPrice: stop.avg_price,
      queueMinutes: stop.queue_minutes ?? 0,
      tags: stop.tags?.length ? stop.tags : ["可解释推荐"],
      startTime: stop.start_time || ["14:20", "15:45", "17:35"][stopIndex] || "待定",
      durationMinutes: stop.duration_minutes || 45,
      distanceFromPrevious: stop.distance_from_previous ?? (stopIndex === 0 ? "起点" : "短距离移动"),
      ugcSummary: stop.ugc_summary ?? "后端暂未返回 UGC 摘要，前端先展示推荐理由作为解释兜底。",
      tasteSummary: stop.taste_summary,
      envSummary: stop.env_summary,
      images: stop.images,
      reason: stop.reason || "命中本轮需求和用户偏好，作为路线中的稳定候选点。",
      actions: stop.actions?.length
        ? stop.actions
        : [
            { id: `${poiId}-nav`, label: "导航", kind: "navigate" },
            { id: `${poiId}-queue`, label: "在线排号", kind: "queue", disabled: true }
          ],
      transportOptions: stop.transport_options?.length
        ? stop.transport_options
        : undefined,
      platformBadge: stop.platform_badge,
      platformBadges: stop.platform_badges,
      tasteRating: stop.taste_rating,
      environmentRating: stop.environment_rating,
      serviceRating: stop.service_rating,
      recommendedDishes: stop.recommended_dishes,
      headPic: stop.head_pic,
      reviewCount: stop.review_count,
      positiveRate: stop.positive_rate
    };
  });

  return {
    id: plan.id,
    title: plan.title || "后端生成路线",
    subtitle: plan.subtitle ?? "由 API 返回的真实规划结果",
    description: plan.description,
    theme: plan.theme ?? "api-generated",
    badge: plan.badge ?? "API",
    score: plan.score ?? 0,
    totalMinutes: plan.total_minutes ?? stops.reduce((sum, stop) => sum + stop.durationMinutes, 0),
    mapTone: tones[index % tones.length],
    mapPoints: plan.map_points?.length ? plan.map_points.map(normalizeApiMapPoint) : fallbackMapPoints(stops),
    highlights: plan.highlights?.length ? plan.highlights : ["真实 API 方案", "包含 Debug Trace", "可继续微调"],
    transports: plan.transports?.length
      ? plan.transports
      : [
          { mode: "taxi", label: "打车", minutes: 25, cost: "待估算", detail: "后端未返回交通估算，先使用展示兜底" }
        ],
    stops,
    todoItems: plan.todo_items?.length
      ? plan.todo_items.map((todo, todoIndex) => ({
          id: todo.id,
          stopPoiId: todo.stop_poi_id ?? stops[todoIndex % Math.max(stops.length, 1)]?.poiId ?? `todo-stop-${todoIndex}`,
          label: todo.label,
          actionLabel: todo.action_label ?? inferTodoActionLabel(todo.label),
          actionKind: todo.action_kind ?? inferTodoActionKind(todo.label),
          actionReferences: todo.action_references?.length
            ? todo.action_references
            : fallbackTodoReferences(stops[todoIndex % Math.max(stops.length, 1)], todo.label),
          constraints: todo.constraints ?? []
        }))
      : stops.slice(0, 3).map((stop) => ({
          id: `todo-${stop.poiId}`,
          stopPoiId: stop.poiId,
          label: `${stop.poiName} · 出发前确认`,
          actionLabel: "查看",
          actionKind: "navigate",
          actionReferences: fallbackTodoReferences(stop, `${stop.poiName} · 出发前确认`),
          constraints: []
        }))
  };
}

function inferTodoActionLabel(label: string) {
  if (label.includes("购票")) {
    return "购票";
  }
  if (label.includes("团购") || label.includes("券")) {
    return "查看团购";
  }
  if (label.includes("预订") || label.includes("预约")) {
    return "预订";
  }
  if (label.includes("排号") || label.includes("排队")) {
    return "排号";
  }
  if (label.includes("分享")) {
    return "分享";
  }
  return "处理";
}

function inferTodoActionKind(label: string): NonNullable<DemoRoutePlan["todoItems"][number]["actionKind"]> {
  if (label.includes("购票")) {
    return "ticket";
  }
  if (label.includes("团购") || label.includes("券")) {
    return "deal";
  }
  if (label.includes("预订") || label.includes("预约")) {
    return "book";
  }
  if (label.includes("排号") || label.includes("排队")) {
    return "queue";
  }
  if (label.includes("分享")) {
    return "share";
  }
  return "navigate";
}

function fallbackTodoReferences(
  stop: DemoPoiStop | undefined,
  label: string
): DemoRoutePlan["todoItems"][number]["actionReferences"] {
  if (!stop) {
    return [];
  }
  const actionKind = inferTodoActionKind(label);
  const imageUrl =
    actionKind === "ticket"
      ? "/mock-reference-assets/todo-reference-art-ticket.png"
      : actionKind === "queue"
        ? "/mock-reference-assets/todo-reference-japanese-queue.png"
        : stop.category === "dessert"
          ? "/mock-reference-assets/todo-reference-dessert-deal.png"
          : stop.category === "shopping"
            ? "/mock-reference-assets/todo-reference-lakeside-walk.png"
            : "/mock-reference-assets/todo-reference-bistro-deal.png";

  return [
    {
      id: `ref-${stop.poiId}-${actionKind}`,
      type: actionKind === "ticket" ? "ticket" : actionKind === "book" ? "booking" : actionKind === "share" ? "share" : "deal",
      title: actionKind === "share" ? `${stop.poiName}集合点` : stop.poiName,
      subtitle: stop.ugcSummary,
      imageUrl,
      price: stop.avgPrice ? `人均 ¥${stop.avgPrice}` : undefined,
      distance: stop.distanceFromPrevious,
      badge: inferTodoActionLabel(label),
      actionLabel: inferTodoActionLabel(label),
      actionKind
    }
  ];
}

function normalizeApiMapPoint(point: { x: number; y: number; label: string }) {
  if (point.x <= 100 && point.y <= 100) {
    return {
      x: Math.round(40 + point.x * 3),
      y: Math.round(36 + point.y * 1.55),
      label: point.label
    };
  }
  return point;
}

function fallbackMapPoints(stops: DemoPoiStop[]) {
  const coordinates = [
    { x: 78, y: 142 },
    { x: 190, y: 74 },
    { x: 306, y: 156 }
  ];
  return stops.slice(0, 3).map((stop, index) => ({
    ...coordinates[index],
    label: stop.poiName.slice(0, 1)
  }));
}

function getChangedStopIdFromDiff(plan: DemoRoutePlan, diff?: RefinementDiff) {
  const replacedChange = diff?.changes.find((change) => change.type === "replaced" || change.type === "reordered");
  if (typeof replacedChange?.stop_index === "number") {
    return plan.stops[replacedChange.stop_index]?.poiId ?? plan.stops[0]?.poiId;
  }
  if (replacedChange?.after_poi_id) {
    return plan.stops.find((stop) => stop.poiId === replacedChange.after_poi_id)?.poiId ?? plan.stops[0]?.poiId;
  }
  return plan.stops[0]?.poiId;
}

function directAnswerFromChatResponse(question: string, response: ChatResponsePayload): DirectAnswer {
  const poiProvider = response.poi_provider;
  const answerProvider = response.answer_provider;
  const fallbackReason = response.fallback_reason;

  // 从 trace events 提取 Agent 摘要行
  const traceEvents = response.trace?.events ?? [];
  const agentSteps: AnsweringAgentStep[] = [];
  for (const event of traceEvents) {
    if (event.type === "agent_started" && event.agent === "InteractionRouterAgent") {
      agentSteps.push({ id: event.id + "-understand", label: "理解你的需求", status: "completed", detail: "已识别意图" });
    }
    if (event.type === "candidate_retrieved") {
      const count = (event.tool_output as Record<string, unknown>)?.search_results_count;
      agentSteps.push({
        id: event.id + "-search",
        label: count ? `搜索到 ${count} 家相关店铺` : "搜索附近 POI",
        status: "completed",
        detail: count ? `已筛选 Top ${Math.min(5, Number(count))}` : undefined,
      });
    }
    if (event.type === "chat_answered") {
      agentSteps.push({ id: event.id + "-answer", label: "生成回答", status: "completed" });
    }
  }

  return {
    question,
    answer: response.answer,
    agentSteps: agentSteps.length > 0 ? agentSteps : undefined,
    poiHints: response.related_pois.map((poi) => {
      const queueMinutes = poi.queue_minutes ?? poi.queueMinutes;
      const avgPrice = poi.avg_price ?? poi.avgPrice;
      const metaParts = [
        poi.area,
        typeof avgPrice === "number" ? `人均 ¥${avgPrice}` : undefined,
        typeof queueMinutes === "number" ? `排队 ${queueMinutes} 分钟` : undefined,
        `${poi.rating} 分`
      ].filter(Boolean);
      const reason =
        poi.ugc_summary ??
        poi.ugcSummary ??
        poi.decisionSignals?.selected_reason ??
        (poi.tags.length ? `命中 ${poi.tags.slice(0, 3).join("、")}。` : "后端返回的相关 POI，可作为普通问答引用。");

      const recommendedDishes = poi.recommendedDishes?.map((dish) =>
        typeof dish === "string" ? dish : dish.name
      );

      return {
        id: poi.id,
        name: poi.name,
        category: poi.category,
        address: poi.address ?? "",
        rating: poi.rating,
        meta: metaParts.join(" · "),
        reason,
        latitude: poi.latitude,
        longitude: poi.longitude,
        recommendedDishes: recommendedDishes?.length ? recommendedDishes : undefined,
        openHours: poi.openHours,
        source: typeof (poi as Record<string, unknown>).source === "string"
          ? ((poi as Record<string, unknown>).source as "amap" | "mock")
          : undefined,
        reliability: typeof (poi as Record<string, unknown>).reliability === "object"
          ? ((poi as Record<string, unknown>).reliability as Record<string, string>)
          : undefined
      };
    }),
    fallback_used: response.fallback_used,
    fallback_reason: fallbackReason,
    poi_provider: poiProvider,
    answer_provider: answerProvider
  };
}

/** Mock 历史回放：根据用户问题生成模拟回答文本 */
function getMockChatAnswer(goal: string): string {
  const normalized = goal.replace(/\s/g, "");
  if (/(日料|寿司|刺身|omakase)/.test(normalized)) {
    return "附近有几家口碑不错的日料店，我按距离和排队情况帮你筛了一下。想少排队的话优先看望京 SOHO 和悠乐汇内的店，饭点前到基本不用等。";
  }
  if (/(咖啡|茶饮|奶茶|坐坐)/.test(normalized)) {
    return "如果只是想找个地方坐坐，建议先看低排队、座位相对稳定的茶饮和咖啡店。望京 SOHO 内更方便，路边独立店更安静。";
  }
  if (/(餐厅|吃什么|吃饭|火锅|西餐|小吃)/.test(normalized)) {
    return "我先按「附近、排队少、口碑稳定」给你快速筛了一组。想要完整吃饭加逛街路线时，可以继续说「帮我规划一条路线」。";
  }
  return "我先按附近 POI、营业状态和大众点评口碑做了快速回答。如果你想要多站行程，可以直接说「帮我规划一条路线」。";
}

/** Mock 历史回放：根据用户问题生成模拟 POI 列表 */
function getMockChatPois(goal: string): PoiHint[] {
  const normalized = goal.replace(/\s/g, "");
  if (/(日料|寿司|刺身|omakase)/.test(normalized)) {
    return [
      { id: "mock-poi-sushi-1", name: "鮨场寿司 望京店", category: "food", address: "望京 SOHO T2 一层", rating: 4.7, meta: "约 430m · 人均 ¥168 · 排队约 12 分", reason: "口碑稳定，午市性价比高，推荐午间套餐。", recommendedDishes: ["三文鱼刺身", "鳗鱼饭", "午市套餐"], openHours: "11:00-22:00", source: "mock" as const },
      { id: "mock-poi-sushi-2", name: "隐鮨 Omakase", category: "food", address: "悠乐汇 B1", rating: 4.8, meta: "约 620m · 人均 ¥320 · 需预约", reason: "品质最高，适合纪念日或重要约会，需提前预约。", recommendedDishes: ["主厨 Omakase", "海胆", "和牛"], openHours: "17:30-22:00", source: "mock" as const },
      { id: "mock-poi-sushi-3", name: "鱼清居酒屋", category: "food", address: "大山子路口", rating: 4.5, meta: "约 1.1km · 人均 ¥95 · 排队约 5 分", reason: "居酒屋风格，适合小酌，不用等太久。", recommendedDishes: ["烤秋刀鱼", "味噌汤", "梅酒"], openHours: "11:30-23:30", source: "mock" as const },
      { id: "mock-poi-sushi-4", name: "松子日本料理 方恒店", category: "food", address: "方恒国际 2F", rating: 4.4, meta: "约 890m · 人均 ¥135", reason: "老牌日料，菜品稳定，适合家庭聚餐。", recommendedDishes: ["天妇罗", "寿司拼盘", "抹茶甜品"], openHours: "11:00-21:30", source: "mock" as const },
      { id: "mock-poi-sushi-5", name: "一风堂拉面 望京新世界店", category: "food", address: "望京新世界 B1", rating: 4.2, meta: "约 746m · 人均 ¥58 · 出餐快", reason: "快速解决，出餐 5 分钟，适合赶时间。", recommendedDishes: ["白丸元味", "赤丸新味", "煎饺"], openHours: "10:00-22:00", source: "mock" as const },
    ];
  }
  if (/(咖啡|茶饮|奶茶|坐坐)/.test(normalized)) {
    return [
      { id: "mock-poi-tea", name: "小山茶饮廊", category: "dessert", address: "望京 SOHO T2 一层", rating: 4.4, meta: "约 430m · 人均 ¥46", reason: "座位周转比热门咖啡店快，适合短暂停留。", source: "mock" as const },
      { id: "mock-poi-luckin", name: "Luckin Coffee 望京新世界店", category: "dessert", address: "望京新世界 B1", rating: 4.1, meta: "约 620m · 出杯快", reason: "适合拿了就走，排队风险低。", source: "mock" as const },
      { id: "mock-poi-bridge", name: "桥下咖啡小馆", category: "dessert", address: "大山子桥东巷", rating: 4.6, meta: "约 1.1km · 安静", reason: "更像休息点，适合聊天，不太适合赶时间。", source: "mock" as const },
    ];
  }
  if (/(餐厅|吃什么|吃饭|火锅|西餐|小吃)/.test(normalized)) {
    return [
      { id: "mock-poi-chuanchuan", name: "李串串老店", category: "food", address: "望京西路", rating: 4.5, meta: "1.0km · 热门榜第 1 名", reason: "口味辨识度高，但饭点要注意排队。", source: "mock" as const },
      { id: "mock-poi-japanese", name: "蓝港日料小食堂", category: "food", address: "蓝色港湾 B1", rating: 4.5, meta: "打车约 10 分钟 · 排队约 7 分", reason: "更适合低排队约会，环境稳定。", source: "mock" as const },
      { id: "mock-poi-hotpot", name: "半重山老火锅双人套", category: "food", address: "三元桥", rating: 4.3, meta: "994m · 今日免费试", reason: "如果想薅活动，可以优先查看名额。", source: "mock" as const },
    ];
  }
  return [
    { id: "mock-poi-xinshijie", name: "望京新世界", category: "shopping", address: "望京西路", rating: 4.3, meta: "约 746m · 商场综合体", reason: "吃喝、购物、休息点密集，适合作为默认落点。", source: "mock" as const },
    { id: "mock-poi-youlehui", name: "望京悠乐汇", category: "shopping", address: "望京街 9 号", rating: 4.2, meta: "约 994m · 生活服务集中", reason: "适合找便利店、咖啡、简餐等即时需求。", source: "mock" as const },
    { id: "mock-poi-dashanzi", name: "大山子口碑餐饮带", category: "food", address: "大山子路口", rating: 4.1, meta: "约 1.5km · 餐饮选择多", reason: "如果想顺便吃饭，这里比单点搜索更稳。", source: "mock" as const },
  ];
}

function createDirectAnswer(question: string): DirectAnswer {
  const normalized = question.replace(/\s/g, "");

  if (/(便利店|超市|买水|营业中)/.test(normalized)) {
    return {
      question,
      answer: "附近有几家还比较稳的便利店。优先看悠乐汇和望京 SOHO 周边，距离近、营业时间覆盖晚间，临时买水或补给不用专门绕路。",
      poiHints: [
        { id: "mock-poi-711", name: "7-Eleven 悠乐汇店", category: "shopping", address: "悠乐汇 B1", rating: 4.3, meta: "约 280m · 营业到 23:30", reason: "离当前商圈近，适合顺手买饮料、纸巾和简单零食。", source: "mock" },
        { id: "mock-poi-bianlifeng", name: "便利蜂 方恒国际店", category: "shopping", address: "方恒国际底商", rating: 4.5, meta: "约 520m · 评分 4.5", reason: "在办公楼底商，晚间人流稳定，找起来比较直接。", source: "mock" },
        { id: "mock-poi-xiaoxiang", name: "小象超市 望京站", category: "shopping", address: "望京 SOHO T3", rating: 4.2, meta: "约 900m · 支持外卖", reason: "如果不想走过去，可以直接下单，适合大件补给。", source: "mock" }
      ]
    };
  }

  if (/(咖啡|茶饮|奶茶|坐坐)/.test(normalized)) {
    return {
      question,
      answer: "如果只是想找个地方坐坐，建议先看低排队、座位相对稳定的茶饮和咖啡店。望京 SOHO 内更方便，路边独立店更安静。",
      poiHints: [
        { id: "mock-poi-tea", name: "小山茶饮廊", category: "dessert", address: "望京 SOHO T2 一层", rating: 4.4, meta: "约 430m · 人均 ¥46", reason: "座位周转比热门咖啡店快，适合短暂停留。", source: "mock" },
        { id: "mock-poi-luckin", name: "Luckin Coffee 望京新世界店", category: "dessert", address: "望京新世界 B1", rating: 4.1, meta: "约 620m · 出杯快", reason: "适合拿了就走，排队风险低。", source: "mock" },
        { id: "mock-poi-bridge", name: "桥下咖啡小馆", category: "dessert", address: "大山子桥东巷", rating: 4.6, meta: "约 1.1km · 安静", reason: "更像休息点，适合聊天，不太适合赶时间。", source: "mock" }
      ]
    };
  }

  if (/(餐厅|吃什么|吃饭|火锅|日料|西餐|小吃)/.test(normalized)) {
    return {
      question,
      answer: `我先按“附近、排队少、口碑稳定”给你快速筛了一组。想要完整吃饭加逛街路线时，可以继续说“帮我规划一条路线”。`,
      poiHints: [
        { id: "mock-poi-chuanchuan", name: "李串串老店", category: "food", address: "望京西路", rating: 4.5, meta: "1.0km · 热门榜第 1 名", reason: "口味辨识度高，但饭点要注意排队。", source: "mock" },
        { id: "mock-poi-japanese", name: "蓝港日料小食堂", category: "food", address: "蓝色港湾 B1", rating: 4.5, meta: "打车约 10 分钟 · 排队约 7 分", reason: "更适合低排队约会，环境稳定。", source: "mock" },
        { id: "mock-poi-hotpot", name: "半重山老火锅双人套", category: "food", address: "三元桥", rating: 4.3, meta: "994m · 今日免费试", reason: "如果想薅活动，可以优先查看名额。", source: "mock" }
      ]
    };
  }

  return {
    question,
    answer: `我先按附近 POI、营业状态和大众点评口碑做了快速回答。这个问题更像即时问答，所以不进入完整路线规划；如果你想要多站行程，可以直接说“帮我规划一条路线”。`,
    poiHints: [
      { id: "mock-poi-xinshijie", name: "望京新世界", category: "shopping", address: "望京西路", rating: 4.3, meta: "约 746m · 商场综合体", reason: "吃喝、购物、休息点密集，适合作为默认落点。", source: "mock" },
      { id: "mock-poi-youlehui", name: "望京悠乐汇", category: "shopping", address: "望京街 9 号", rating: 4.2, meta: "约 994m · 生活服务集中", reason: "适合找便利店、咖啡、简餐等即时需求。", source: "mock" },
      { id: "mock-poi-dashanzi", name: "大山子口碑餐饮带", category: "food", address: "大山子路口", rating: 4.1, meta: "约 1.5km · 餐饮选择多", reason: "如果想顺便吃饭，这里比单点搜索更稳。", source: "mock" }
    ]
  };
}

function applyMockRefinement(
  plans: DemoRoutePlan[],
  planId: string,
  instruction: string
): { nextPlans: DemoRoutePlan[]; changedStopId: string } {
  let changedStopId = "";
  const nextPlans = plans.map((plan) => {
    if (plan.id !== planId) {
      return plan;
    }

    const secondStop = plan.stops[1];
    changedStopId = secondStop.poiId;

    if (instruction.includes("少走") || instruction.includes("走路")) {
      changedStopId = plan.stops[0].poiId;
      return {
        ...plan,
        title: "更少走路的舒适版",
        subtitle: "保留当前体验，把移动距离压得更低",
        highlights: ["减少一段跨区移动", "步行段缩短", "保留吃饭和甜品"],
        stops: plan.stops.map((stop, index) =>
          index === 0
            ? {
                ...stop,
                poiName: "蓝港日料小食堂",
                reason: "替换为商场内低排队餐厅，后续两站步行可达。",
                distanceFromPrevious: "起点打车约 10 分钟",
                queueMinutes: 7,
                tags: ["日料", "少走路", "室内"]
              }
            : stop
        )
      };
    }

    if (instruction.includes("展览") || instruction.includes("提前")) {
      changedStopId = plan.stops[1].poiId;
      return {
        ...plan,
        title: "展览提前版",
        subtitle: "先看展避开人流，再慢慢吃饭收尾",
        stops: plan.stops.map((stop, index) =>
          index === 1
            ? {
                ...stop,
                startTime: "14:25",
                reason: "展览提前后人流更少，后面餐饮时间更从容。"
              }
            : index === 0
              ? { ...stop, startTime: "16:05" }
              : stop
        )
      };
    }

    return {
      ...plan,
      title: "咖啡替换后的低排队路线",
      subtitle: "保留整体节奏，替换被点名的休息点",
      stops: plan.stops.map((stop) =>
        stop.poiId === secondStop.poiId
          ? {
              ...stop,
              poiName: "小山茶饮廊",
              category: "dessert" as const,
              avgPrice: 46,
              queueMinutes: 4,
              tags: ["茶饮", "安静", "低排队"],
              ugcSummary: "茶饮比咖啡更稳妥，座位相对安静，适合中途休息。",
              reason: "已把当前方案里的咖啡/展后休息点替换成低排队茶饮。"
            }
          : stop
      )
    };
  });

  return { nextPlans, changedStopId };
}
