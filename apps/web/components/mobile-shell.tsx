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
  Keyboard,
  Mic,
  MessageSquarePlus,
  Navigation,
  Plus,
  ShoppingBag,
  Sparkles,
  Star,
  Share2,
  Ticket,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, UIEvent } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper";
import "swiper/css";
import {
  agentSteps,
  apiErrorReason,
  createLocalChatTrace,
  createLocalFallbackTrace,
  createLocalRefinementTrace,
  deleteUserPreferenceOnApi,
  demoRoutePlans,
  listUserPreferences,
  planRoute,
  presetPrompts,
  refineRoute,
  updateUserPreferenceOnApi
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDemoStore } from "@/stores/use-demo-store";
import type { ProviderStatus } from "@/stores/use-demo-store";
import type {
  AgentTrace,
  AgentStrategy,
  ApiRoutePlan,
  ClarificationCard,
  ClarificationState,
  DemoPoiStop,
  DemoRoutePlan,
  MobileShellView,
  RefinementDiff,
  RoutePlanRequestPayload,
  RequirementSummary,
  TransportMode
} from "@/types/dzultra";
import { SvgRouteMap } from "./svg-route-map";

type DirectAnswer = {
  question: string;
  answer: string;
  poiHints: Array<{
    name: string;
    meta: string;
    reason: string;
  }>;
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

const FLOW_BLOCK_CLASS = "min-h-[620px] scroll-mt-4";

const defaultClarification: ClarificationState = {
  people: 2,
  timeRange: "今天下午 14:00-18:00",
  food: "吃正餐 + 甜品",
  budget: "人均 ¥100-200",
  taste: "微辣可以"
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
    requireRequirementConfirmation,
    preferenceDetectionEnabled,
    dataAuthorizationEnabled,
    userPreferences,
    setMobileView,
    setInputMode,
    setSelectedPlanId,
    setSelectedTransportMode,
    setExpandedStopId,
    setHighlightedStopId,
    toggleTodo,
    resetMobileDemo,
    setSelectedTraceEventId,
    setActiveTrace,
    setCurrentRoutePlans,
    setUserPreferences,
    setActiveView,
    setProviderStatuses
  } = useDemoStore();
  const [draft, setDraft] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState(presetPrompts[0]);
  const [clarification, setClarification] = useState(defaultClarification);
  const [dynamicClarificationCards, setDynamicClarificationCards] = useState<ClarificationCard[]>([]);
  const [clarificationCardAnswers, setClarificationCardAnswers] = useState<ClarificationCardAnswers>({});
  const [clarificationInputNotice, setClarificationInputNotice] = useState("");
  const [requirementSummary, setRequirementSummary] = useState<RequirementSummary | undefined>();
  const [plans, setPlans] = useState(demoRoutePlans);
  const [apiNotice, setApiNotice] = useState("本地 Mock 已就绪");
  const [directAnswer, setDirectAnswer] = useState<DirectAnswer>(() => createDirectAnswer("附近有营业中的便利店吗"));
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
  const [promptEditDraft, setPromptEditDraft] = useState("");
  const [expandedPlanId, setExpandedPlanId] = useState<string | undefined>();
  const [homeSyncedPlanId, setHomeSyncedPlanId] = useState<string | undefined>();
  const flowMainRef = useRef<HTMLElement | null>(null);
  const activePlanRequestIdRef = useRef(0);
  const continuationDelayRef = useRef(0);
  const planningRequestStartedAtRef = useRef(0);
  const planningMinimumDurationRef = useRef(6400);
  const promptEditorOpenRef = useRef(false);
  const flowIndexFrameRef = useRef<number | undefined>(undefined);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const promptSummary = createPromptSummary(submittedPrompt);
  const runningAgentSteps = useMemo(
    () => (activeTrace?.agent_strategy?.length ? activeTrace.agent_strategy.map(agentStrategyToRunningStep) : agentSteps),
    [activeTrace?.agent_strategy]
  );
  const shouldShowPromptSummary =
    !!submittedPrompt.trim() && !["entry", "searching", "start", "settings"].includes(mobileView);

  const planMutation = useMutation({
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
        setProviderStatuses(providerStatusesFromTrace(response.trace));
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
      const minimumDelay = Math.max(0, planningMinimumDurationRef.current - elapsed);
      const delay = Math.max(continuationDelayRef.current, minimumDelay);
      continuationDelayRef.current = 0;
      if (delay > 0) {
        window.setTimeout(applyResponse, delay);
        return;
      }
      applyResponse();
    },
    onError: (error, variables) => {
      if (variables.client_request_id !== activePlanRequestIdRef.current || promptEditorOpenRef.current) {
        return;
      }
      const reason = apiErrorReason(error);
      const errorDetail = error instanceof Error ? error.message : String(error);
      setApiNotice(reason === "timeout" ? "真实接口超时，已使用本地 Mock fallback" : "真实接口异常，已使用本地 Mock fallback");
      const elapsed = Date.now() - planningRequestStartedAtRef.current;
      const fallbackDelay = Math.max(1200, planningMinimumDurationRef.current - elapsed);
      window.setTimeout(() => {
        if (variables.client_request_id !== activePlanRequestIdRef.current || promptEditorOpenRef.current) {
          return;
        }
        const fallbackPlans = demoRoutePlans;
        const fallbackTrace = createLocalFallbackTrace(variables.goal, fallbackPlans[0].id, reason, errorDetail);
        setPlans(fallbackPlans);
        setCurrentRoutePlans(fallbackPlans);
        setSelectedPlanId(fallbackPlans[0].id);
        setExpandedStopId(fallbackPlans[0].stops[0]?.poiId);
        setActiveTrace(fallbackTrace);
        setProviderStatuses(providerStatusesFromTrace(fallbackTrace));
        setActiveView("result");
        setMobileView("plans");
        setSelectedTraceEventId(fallbackTrace.events.find((event) => event.type === "route_scored")?.id ?? fallbackTrace.events.at(-1)?.id);
      }, fallbackDelay);
    }
  });

  const refineMutation = useMutation({
    mutationFn: refineRoute,
    onSuccess: (response) => {
      const apiPlans = response.plans?.length ? response.plans : response.plan ? [response.plan] : [];
      const nextPlans = apiPlans.length ? apiPlans.map(apiPlanToDemoPlan) : [];
      setApiNotice("微调接口已返回，当前方案已更新");
      setActiveTrace(response.trace);
      setProviderStatuses(providerStatusesFromTrace(response.trace));
      if (nextPlans.length) {
        const selectedPlanIdFromApi = response.selected_plan_id ?? response.plan.id;
        const selectedPlanFromApi = nextPlans.find((plan) => plan.id === selectedPlanIdFromApi) ?? nextPlans[0];
        const changedStopId = getChangedStopIdFromDiff(selectedPlanFromApi, response.refinement_diff);
        setPlans(nextPlans);
        setCurrentRoutePlans(nextPlans);
        setSelectedPlanId(selectedPlanIdFromApi);
        setHighlightedStopId(changedStopId);
        window.setTimeout(() => setHighlightedStopId(undefined), 1200);
      }
      setMobileView("plans");
      setSelectedTraceEventId(
        response.trace.events.find((event) => event.type === "user_refinement_received")?.id ?? response.trace.events.at(-1)?.id
      );
    },
    onError: () => {
      setApiNotice("微调接口未连接，已用本地 Mock 更新方案");
    }
  });

  const activeTransport = useMemo(
    () => selectedPlan.transports.find((item) => item.mode === selectedTransportMode) ?? selectedPlan.transports[0],
    [selectedPlan, selectedTransportMode]
  );

  useEffect(() => {
    promptEditorOpenRef.current = promptEditorOpen;
  }, [promptEditorOpen]);

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
    startPlanningRequest(goal, {
      require_confirmation: requireRequirementConfirmation
    });
  }

  function startPlanningRequest(
    goal: string,
    overrides: Partial<RoutePlanRequestPayload> = {},
    flowOptions: { preserveCurrentFlow?: boolean } = {}
  ) {
    const requestId = activePlanRequestIdRef.current + 1;
    activePlanRequestIdRef.current = requestId;
    planningRequestStartedAtRef.current = Date.now();
    planningMinimumDurationRef.current = flowOptions.preserveCurrentFlow ? 2600 : 6400;
    setActiveView("planning");
    setDraft("");
    setKeyboardOpen(false);
    setMobileView("running");
    setApiNotice(flowOptions.preserveCurrentFlow ? "确认信息后继续规划中" : "正在获取基本信息");
    if (!flowOptions.preserveCurrentFlow) {
      setFlowIndex(0);
      setConfirmedClarification(defaultClarification);
      setConfirmedClarificationCards([]);
      setConfirmedClarificationCardAnswers({});
      setHasConfirmedClarification(false);
      setHasConfirmedSummary(false);
      setPostClarificationStep(0);
    }
    setActiveTrace(undefined);
    if (!flowOptions.preserveCurrentFlow) {
      setCurrentRoutePlans([]);
      setSelectedPlanId("");
      setExpandedStopId(undefined);
      setProviderStatuses([]);
    }
    setDynamicClarificationCards([]);
    setClarificationCardAnswers({});
    setClarificationInputNotice("");
    if (!flowOptions.preserveCurrentFlow) {
      setRequirementSummary(undefined);
    }
    setSelectedTraceEventId(undefined);
    planMutation.mutate({
      client_request_id: requestId,
      user_id: dataAuthorizationEnabled ? "user-date-001" : "anonymous",
      goal,
      city: "北京",
      constraints: dataAuthorizationEnabled
        ? Array.from(new Set(["约会", "看展", ...userPreferences.map((preference) => preference.label)]))
        : ["约会", "看展"],
      preference_detection_enabled: preferenceDetectionEnabled,
      ...overrides
    });
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
    if (isRoutePlanningGoal(goal)) {
      submitPrompt(goal);
      return;
    }

    setActiveView("result");
    setSubmittedPrompt(goal);
    setDraft("");
    setKeyboardOpen(false);
    setDirectAnswer(createDirectAnswer(goal));
    setMobileView("answering");
    setFlowIndex(0);
    setApiNotice("已走快速问答链路：检索附近 POI 后由大模型总结回答");
    const chatTrace = createLocalChatTrace(goal);
    setActiveTrace(chatTrace);
    setProviderStatuses(providerStatusesFromTrace(chatTrace));
    setSelectedTraceEventId(chatTrace.events.find((event) => event.type === "chat_answered")?.id ?? chatTrace.events.at(-1)?.id);
  }

  function confirmClarification() {
    if (dynamicClarificationCards.length) {
      setConfirmedClarification(clarification);
      setConfirmedClarificationCards(dynamicClarificationCards);
      setConfirmedClarificationCardAnswers(clarificationCardAnswers);
      setHasConfirmedClarification(true);
      setPostClarificationStep(0);
      continuationDelayRef.current = 1900;
      startPlanningRequest(submittedPrompt, {
        clarification_answers: buildClarificationAnswers(clarification, dynamicClarificationCards, clarificationCardAnswers),
        require_confirmation: requireRequirementConfirmation
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
    startPlanningRequest(submittedPrompt, {
      clarification_answers: buildClarificationAnswers(clarification, dynamicClarificationCards, clarificationCardAnswers),
      require_confirmation: requireRequirementConfirmation,
      confirmed_requirements: true
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
    startPlanningRequest(nextPrompt, {
      require_confirmation: requireRequirementConfirmation
    });
  }

  function selectPlan(planId: string) {
    setSelectedPlanId(planId);
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
    if (!text) {
      return;
    }

    setDraft("");
    setKeyboardOpen(false);
    setMobileView("refining");
    setSelectedTraceEventId(activeTrace?.events.find((event) => event.type === "user_refinement_received")?.id ?? "trace-event-012");
    const traceForRefine = useDemoStore.getState().activeTrace;
    refineMutation.mutate({
      trace_id: traceForRefine?.id ?? "trace-demo-local",
      route_id: selectedPlan.id,
      instruction: text
    }, {
      onError: () => {
        const { nextPlans, changedStopId } = applyMockRefinement(plans, selectedPlan.id, text);
        window.setTimeout(() => {
          const refinementTrace = createLocalRefinementTrace(traceForRefine, text, selectedPlan.id, changedStopId);
          setPlans(nextPlans);
          setCurrentRoutePlans(nextPlans);
          setHighlightedStopId(changedStopId);
          setActiveTrace(refinementTrace);
          setProviderStatuses(providerStatusesFromTrace(refinementTrace));
          setSelectedTraceEventId(
            refinementTrace.events.find((event) => event.type === "user_refinement_received")?.id ?? refinementTrace.events.at(-1)?.id
          );
          setMobileView("plans");
          setApiNotice(`已按“${text}”更新当前方案`);
          window.setTimeout(() => setHighlightedStopId(undefined), 1200);
        }, 900);
      }
    });
  }

  function choosePlan() {
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
          />
        ) : (
          <>
            {mobileView === "start" && <DzAiBackground />}
            <ShellEdgeGlass />
            <MobileHeader
              title={mobileView === "selected" ? selectedPlan.title : "点仔 Ultra"}
              hideLogo={shouldShowPromptSummary}
              promptSummary={shouldShowPromptSummary ? promptSummary : undefined}
              onPromptClick={shouldShowPromptSummary ? () => setPromptSheetOpen(true) : undefined}
              onBack={() => {
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
                "relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-28 [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,transparent_0,#000_18px,#000_calc(100%_-_28px),transparent_100%)] [&::-webkit-scrollbar]:hidden",
                mobileView === "start" && "px-[42px] py-0 [mask-image:none]"
              )}
            >
              <AnimatePresence mode="wait">
                {mobileView === "start" && (
                  <StartView
                    keyboardOpen={keyboardOpen}
                    onSubmit={submitPrompt}
                  />
                )}
                {mobileView === "answering" && (
                  <DirectAnswerView answer={directAnswer} apiNotice={apiNotice} />
                )}
                {["running", "clarifying", "summary", "plans", "refining", "selected"].includes(mobileView) && (
                  <PlanningConversationView
                    view={mobileView}
                    prompt={submittedPrompt}
                    apiNotice={apiNotice}
                    steps={runningAgentSteps}
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
              </AnimatePresence>
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
                />
              )}
            </AnimatePresence>
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
              hidden={mobileView === "settings"}
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

  const targetRect = target.getBoundingClientRect();
  const blockRect = block.getBoundingClientRect();
  const top = Math.max(0, target.scrollTop + blockRect.top - targetRect.top - 10);
  target.scrollTop = top;
  target.scrollTo({ top, behavior: "smooth" });
  window.setTimeout(() => {
    if (Math.abs(target.scrollTop - top) > 24) {
      target.scrollTop = top;
    }
  }, 280);
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
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-[#ffe1d5] bg-[#fff8f4] px-3 py-3 text-left shadow-sm"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f26b43] text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-black text-[#20283a]">点仔 Ultra · 本地路线智能规划</span>
            <span className="mt-0.5 block truncate text-[12px] font-semibold text-[#8a6470]">吃饭、看展、少排队，一次生成多套路线</span>
          </span>
          <ChevronRight className="h-5 w-5 text-[#f26b43]" />
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
  onOpenUltraHome
}: {
  draft: string;
  setDraft: (value: string) => void;
  onBack: () => void;
  onUltraEnter: () => void;
  onOpenUltraHome: () => void;
}) {
  const [isAskMode, setIsAskMode] = useState(false);
  const [askTab, setAskTab] = useState<"try" | "recent">("try");
  const [routePlanningEnabled, setRoutePlanningEnabled] = useState(true);
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
                  onClick={() => setRoutePlanningEnabled((enabled) => !enabled)}
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
      <div className="absolute inset-x-0 top-0 h-[172px] bg-gradient-to-b from-white/70 via-white/32 to-transparent backdrop-blur-[12px] [mask-image:linear-gradient(to_bottom,#000_0%,rgba(0,0,0,0.76)_48%,transparent_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[164px] bg-gradient-to-t from-white/76 via-white/34 to-transparent backdrop-blur-[14px] [mask-image:linear-gradient(to_top,#000_0%,rgba(0,0,0,0.74)_48%,transparent_100%)]" />
    </div>
  );
}

function MobileHeader({
  title,
  hideLogo = false,
  promptSummary,
  onPromptClick,
  onBack,
  onSettings
}: {
  title: string;
  hideLogo?: boolean;
  promptSummary?: string;
  onPromptClick?: () => void;
  onBack: () => void;
  onSettings?: () => void;
}) {
  const showDzLogo = title === "点仔 Ultra";
  const showPromptSummary = !!promptSummary && !!onPromptClick;

  return (
    <header className="relative z-20 bg-transparent pb-[10px]">
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
          {showPromptSummary ? (
            <button
              type="button"
              onClick={onPromptClick}
              className="mt-[5px] max-w-full truncate rounded-full border border-white/70 bg-white/62 px-4 py-2 text-center text-xs font-black text-[#20283a] shadow-[0_8px_26px_rgba(32,40,58,0.12)] backdrop-blur-xl"
            >
              {promptSummary}
            </button>
          ) : showDzLogo ? (
            <motion.span
              aria-label="问点仔 AI"
              className="mt-[2px] block h-[38px] w-[112px] bg-contain bg-center bg-no-repeat"
              animate={{
                opacity: hideLogo ? 0 : 1,
                filter: hideLogo ? "blur(8px)" : "blur(0px)",
                scale: hideLogo ? 0.96 : 1
              }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
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
      className="absolute inset-0 z-30 bg-white/42 p-6 backdrop-blur-md"
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
  return (
    <motion.div
      className="absolute inset-0 z-40 overflow-hidden bg-white/48 p-5 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.section
        initial={{ y: 18, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 12, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        onClick={(event) => event.stopPropagation()}
        className="mt-[142px] rounded-[28px] bg-white/94 p-5 shadow-[0_24px_80px_rgba(32,40,58,0.18)] backdrop-blur"
      >
        <p className="text-xs font-black text-[#4f68ff]">编辑已发送需求</p>
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
          className="mt-3 min-h-[132px] w-full resize-none rounded-2xl border border-[#dfe4ef] bg-[#fbfcff] px-4 py-3 text-lg font-black leading-8 text-[#20283a] outline-none focus:border-[#4f68ff]"
        />
        <p className="mt-3 text-xs font-semibold leading-5 text-neutral-500">
          重新提交后会清空当前 Agent 链并重新规划；旧请求若稍后返回，前端会忽略它。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="rounded-2xl bg-[#f1f2f5] px-4 py-3 text-sm font-black text-[#687083]">
            取消
          </button>
          <button onClick={onSubmit} className="rounded-2xl bg-[#20283a] px-4 py-3 text-sm font-black text-white">
            重新提交
          </button>
        </div>
      </motion.section>
      <div className="absolute bottom-0 left-0 right-0" onClick={(event) => event.stopPropagation()}>
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
  const promptSamples = [
    "今天下午想在北京约会，不想排队，想吃饭加看展",
    "周末想找一条轻松拍照路线，最好少走路",
    "今晚临时约朋友吃饭，想顺路喝点甜的"
  ];

  return (
    <motion.section
      key="start"
      initial={{ opacity: 0, filter: "blur(8px)", y: 16 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      exit={{ opacity: 0, filter: "blur(10px)", y: -10 }}
      transition={{ duration: 0.35 }}
      className="h-full"
    >
      <section data-flow-block className="relative min-h-[628px] overflow-visible">
        <motion.div
          className="absolute left-0 overflow-visible py-1"
          animate={{ top: keyboardOpen ? 34 : 118 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-[24px] font-semibold leading-[34px] tracking-normal text-black">给你安排去哪玩</h1>
          <p className="relative mt-1 min-h-[26px] w-[321px] overflow-visible whitespace-nowrap py-[3px] text-[14px] font-normal leading-5 text-[#999999]">
            <span>说说</span>
            <HighlightedWord delay={0.7}>想去哪儿</HighlightedWord>
            <span>、</span>
            <HighlightedWord delay={0.9}>几个人</HighlightedWord>
            <span>、</span>
            <HighlightedWord delay={1.1}>想怎么玩</HighlightedWord>
            <span>，我来规划</span>
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

function HighlightedWord({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <span className="relative inline-block overflow-hidden rounded-[5px] px-[1px] text-[#202020]">
      <motion.span
        aria-hidden="true"
        className="absolute inset-y-[-3px] -left-[70%] z-0 w-[70%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-[#dfe6ff] to-transparent"
        initial={{ x: 0, opacity: 0 }}
        animate={{ x: ["0%", "245%"], opacity: [0, 0.9, 0] }}
        transition={{ delay, duration: 0.78, ease: "easeInOut" }}
      />
      <motion.span
        className="relative z-10"
        initial={{ color: "#202020" }}
        animate={{ color: ["#202020", "#6473c8", "#202020"] }}
        transition={{ delay: delay + 0.05, duration: 0.72, ease: "easeInOut" }}
      >
        {children}
      </motion.span>
    </span>
  );
}

function HighlightableText({
  active,
  children,
  className,
  as: Tag = "span"
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
  as?: "span" | "p";
}) {
  return (
    <Tag className={cn("relative block overflow-hidden rounded-[5px]", className)}>
      {active && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-[-4px] -left-[55%] z-0 w-[55%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-[#dfe6ff] to-transparent"
          animate={{ x: ["0%", "260%"], opacity: [0, 0.9, 0] }}
          transition={{ duration: 0.85, ease: "easeInOut" }}
        />
      )}
      <motion.span
        className="relative z-10"
        animate={active ? { color: ["#20283a", "#6678d8", "#20283a"] } : {}}
        transition={{ duration: 0.85, ease: "easeInOut" }}
      >
        {children}
      </motion.span>
    </Tag>
  );
}

function PlanningConversationView({
  view,
  prompt,
  apiNotice,
  steps,
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
  selectedPlan: DemoRoutePlan;
  highlightedStopId?: string;
  isRefining: boolean;
  expandedPlanId?: string;
  activeTransport: DemoRoutePlan["transports"][number];
  selectedTransportMode: TransportMode;
  expandedStopId?: string;
  completedTodoIds: string[];
  onEditPrompt: () => void;
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
  const showPlans = view === "plans" || view === "refining" || view === "selected";
  const showSelected = view === "selected";
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
        status={agentIsRunning ? "running" : "completed"}
        showAgentChain={agentIsRunning ? runningAgentChainVisible : true}
        autoFocus={view === "running" && !hasConfirmedClarification && !hasConfirmedSummary}
        onEditPrompt={onEditPrompt}
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
          confirmed={hasConfirmedSummary || view === "plans" || view === "refining" || view === "selected"}
          onConfirm={onConfirmSummary}
        />
      )}

      {showPlanGeneration && <PlanGenerationThinkingView autoFocus />}

      {showPlans && (
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

      {showSelected && (
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
  steps,
  status = "running",
  showAgentChain,
  autoFocus = false,
  onEditPrompt
}: {
  prompt: string;
  apiNotice: string;
  steps: RunningAgentStep[];
  status?: "running" | "completed";
  showAgentChain: boolean;
  autoFocus?: boolean;
  onEditPrompt: () => void;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [typedPrompt, setTypedPrompt] = useState("");
  const agentBlockRef = useRef<HTMLElement | null>(null);
  const currentStep = steps[Math.min(activeStep, steps.length - 1)] ?? steps[0];

  useEffect(() => {
    if (status === "completed") {
      setActiveStep(Math.max(steps.length - 1, 0));
      setTypedPrompt(prompt);
      return;
    }

    setActiveStep(0);
    setTypedPrompt("");

    const stepTimer = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, steps.length - 1));
    }, 820);

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
      window.clearInterval(stepTimer);
      window.clearInterval(typingTimer);
    };
  }, [prompt, status, steps.length]);

  useEffect(() => {
    if (!showAgentChain || !autoFocus) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const block = agentBlockRef.current;
      const target = block?.closest<HTMLElement>("[data-mobile-flow='true']");
      if (target && block) {
        scrollFlowBlockIntoView(target, block);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, showAgentChain]);

  const visibleSteps = status === "completed" ? steps : steps.slice(0, Math.min(activeStep + 1, steps.length));

  return (
    <motion.section
      key="running"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="space-y-4 pb-8"
    >
      <section
        data-flow-block
        data-flow-autofocus={autoFocus && !showAgentChain ? "true" : undefined}
        className={cn(FLOW_BLOCK_CLASS, "relative flex flex-col justify-center overflow-hidden px-[26px]")}
      >
        <motion.div
          key="prompt-typing"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            type="button"
            onClick={onEditPrompt}
            className="block w-full text-left text-[28px] font-black leading-[43px] tracking-normal text-black"
          >
            {typedPrompt || prompt.slice(0, 1)}
            {status === "running" && !showAgentChain && (
              <motion.span
                aria-hidden="true"
                className="ml-0.5 inline-block h-8 w-[2px] translate-y-1 bg-black"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 0.85 }}
              />
            )}
          </button>
          <div className="mt-5 inline-flex h-8 items-center overflow-hidden text-[24px] font-normal leading-8 text-[#999999]">
            <span className="relative">
              {showAgentChain ? "已获取基本信息" : apiNotice || "正在获取基本信息"}
              {!showAgentChain && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-y-0 -left-12 w-12 skew-x-[-18deg] bg-gradient-to-r from-transparent via-[#fbfb19]/80 to-transparent"
                  animate={{ x: [0, 260] }}
                  transition={{ repeat: Infinity, duration: 1.25, ease: "easeInOut" }}
                />
              )}
            </span>
          </div>
        </motion.div>
      </section>

      <AnimatePresence initial={false}>
        {showAgentChain && (
          <section
            ref={agentBlockRef}
            data-flow-block
            data-flow-autofocus={autoFocus ? "true" : undefined}
            className={cn(FLOW_BLOCK_CLASS, "relative overflow-hidden px-[26px] pt-[84px]")}
          >
            <motion.div
              key="agent-chain"
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              <div>
                <h2 className="text-[24px] font-semibold leading-[34px] text-black">正在规划中</h2>
                <div className="mt-1 inline-flex h-5 items-center overflow-hidden text-[14px] leading-5 text-[#999999]">
                  <span className="relative">
                    稍等一下，我正在思考哦
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-y-0 -left-10 w-10 skew-x-[-18deg] bg-gradient-to-r from-transparent via-[#fbfb19]/75 to-transparent"
                      animate={{ x: [0, 190] }}
                      transition={{ repeat: Infinity, duration: 1.35, ease: "easeInOut" }}
                    />
                  </span>
                </div>
              </div>

              <div className="mt-[42px] space-y-4">
                <AnimatePresence initial={false}>
                  {visibleSteps.map((step, index) => {
                    const completed = status === "completed" || index < activeStep;
                    const current = status !== "completed" && index === activeStep;

                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, y: 12, filter: "blur(5px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="grid grid-cols-[22px_1fr] gap-3"
                      >
                        <div className="flex flex-col items-center pt-1">
                          <span
                            className={cn(
                              "flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[10px] font-black",
                              completed && "border-[#4f68ff] bg-[#4f68ff] text-white",
                              current && "border-[#4f68ff] bg-white text-[#4f68ff] shadow-[0_0_0_6px_rgba(79,104,255,0.1)]",
                              !completed && !current && "border-[#e5e7ee] bg-white text-[#a1a7b2]"
                            )}
                          >
                            {completed ? <Check className="h-3 w-3" /> : index + 1}
                          </span>
                          {index < visibleSteps.length - 1 && <span className="mt-1 h-8 w-px bg-[#e8ebf2]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[18px] font-semibold leading-[25px] text-black">{step.label}</span>
                            {current && (
                              <motion.span
                                className="h-1.5 w-1.5 rounded-full bg-[#4f68ff]"
                                animate={{ scale: [1, 1.65, 1], opacity: [0.45, 1, 0.45] }}
                                transition={{ repeat: Infinity, duration: 0.9 }}
                              />
                            )}
                          </div>
                          <p className="mt-1 text-[14px] font-normal leading-5 text-[#999999]">{agentUserFacingDetail(step, index)}</p>
                          {current && (
                            <p className="mt-0.5 text-[13px] leading-5 text-[#a7a7a7]">{currentStep.detail}</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <p className="mt-8 text-[12px] leading-5 text-[#a0a0a0]">{apiNotice}</p>
            </motion.div>
          </section>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function DirectAnswerView({ answer, apiNotice }: { answer: DirectAnswer; apiNotice: string }) {
  return (
    <motion.section
      key="answering"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <section data-flow-block className={cn(FLOW_BLOCK_CLASS, "flex flex-col justify-center")}>
        <p className="text-xs font-semibold text-neutral-500">你的问题</p>
        <h2 className="mt-3 text-2xl font-black leading-9 text-[#20283a]">{answer.question}</h2>
        <p className="mt-4 text-xs leading-6 text-neutral-500">已识别为快速问答，不进入完整路线规划。</p>
      </section>

      <section data-flow-block className={cn(FLOW_BLOCK_CLASS, "flex flex-col justify-center")}>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-black">
            <Sparkles className="h-4 w-4 text-[#4f68ff]" />
            点仔回答
          </div>
          <p className="text-sm font-semibold leading-7 text-[#20283a]">{answer.answer}</p>
          <p className="mt-4 rounded-2xl bg-[#eef1ff] px-3 py-3 text-xs leading-5 text-[#5260c8]">{apiNotice}</p>
        </div>
      </section>

      <section data-flow-block className={cn(FLOW_BLOCK_CLASS, "py-4")}>
        <BlockTitle title="附近可参考 POI" subtitle="快速问答也会检索附近地点，帮助答案落地。" />
        <div className="space-y-3">
          {answer.poiHints.map((poi) => (
            <div key={poi.name} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black">{poi.name}</h3>
                  <p className="mt-1 text-xs font-semibold text-dz-orange">{poi.meta}</p>
                </div>
                <span className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">附近</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-600">{poi.reason}</p>
            </div>
          ))}
        </div>
      </section>
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
    <section data-flow-block className={cn(FLOW_BLOCK_CLASS, "py-2")}>
      <BlockTitle title="已补全的信息" subtitle="这些回答会继续影响后面的候选 POI、距离和排序。" />
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-[#f7f8fa] px-3 py-3">
              <div className="text-xs font-black leading-5 text-[#7a8190]">{label}</div>
              <div className="mt-1 text-sm font-semibold leading-6 text-[#20283a]">{value}</div>
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

  return (
    <>
      {blocks.map((block, index) => (
        <section
          key={block.title}
          data-flow-block
          data-flow-autofocus={autoFocus && activeStep === index ? "true" : undefined}
          className={cn(FLOW_BLOCK_CLASS, "flex flex-col justify-center")}
        >
          <motion.div
            animate={
              activeStep === index
                ? {
                    scale: [1, 1.035, 1],
                    boxShadow: [
                      "0 0 0 0 rgba(242,107,67,0.16)",
                      "0 0 0 14px rgba(242,107,67,0)",
                      "0 0 0 0 rgba(242,107,67,0.16)"
                    ]
                  }
                : { scale: 1 }
            }
            transition={{ repeat: activeStep === index ? Infinity : 0, duration: 1.35 }}
            className={cn(
              "rounded-[28px] border px-5 py-6",
              index <= activeStep ? "border-[#ffe0d4] bg-[#fff8f4]" : "border-[#edf0f6] bg-white"
            )}
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-black text-dz-orange">
              {index < activeStep ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              Agent 继续思考
            </div>
            <h3 className="text-xl font-black leading-7 text-[#20283a]">{block.title}</h3>
            <p className="mt-3 text-sm font-semibold leading-7 text-[#66708a]">{block.detail}</p>
          </motion.div>
        </section>
      ))}
    </>
  );
}

function PlanGenerationThinkingView({ autoFocus = false }: { autoFocus?: boolean }) {
  return (
    <section
      data-flow-block
      data-flow-autofocus={autoFocus ? "true" : undefined}
      className={cn(FLOW_BLOCK_CLASS, "flex flex-col justify-center")}
    >
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        className="rounded-[28px] border border-[#dbe3ff] bg-[#f3f6ff] px-5 py-6 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-[#4f68ff] shadow-sm">
          <Sparkles className="h-7 w-7" />
        </div>
        <div className="text-base font-black text-[#20283a]">正在生成 3 套方案</div>
        <p className="mt-2 text-xs font-semibold leading-5 text-[#66708a]">
          每套方案会保留不同取舍：主推、轻松、拍照或预算友好，并给出可解释排序理由。
        </p>
      </motion.div>
    </section>
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

  if (cards.length) {
    return (
      <motion.section
        key="clarifying"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="space-y-4"
      >
        {cards.map((card, index) => (
          <section
            key={card.id}
            data-flow-block
            data-flow-autofocus={autoFocus && index === 0 ? "true" : undefined}
            className={cn(FLOW_BLOCK_CLASS, "py-2")}
          >
            <BlockTitle
              title={index === 0 ? "补全几个关键信息" : "再确认一个偏好"}
              subtitle={`${card.field} · ${card.blocks_planning ? "继续规划前必须确认" : "可跳过的偏好优化"}`}
            />
            {index === 0 && inputNotice && (
              <div className="mb-3 rounded-2xl border border-[#dce8ff] bg-[#eef6ff] px-3 py-3 text-xs font-semibold leading-5 text-[#1f3b63]">
                {inputNotice}
              </div>
            )}
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="rounded-2xl bg-[#f3f6ff] px-3 py-3">
                <h3 className="text-base font-black text-[#20283a]">{card.question}</h3>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#5260c8]">{card.reason}</p>
              </div>
              {isPeopleClarificationCard(card) ? (
                <PeopleWheelControl value={clarification.people} onChange={(people) => updateCardAnswer(card, `${people} 人`)} />
              ) : isTimeClarificationCard(card) ? (
                <TimeWindowControl
                  value={clarification.timeRange}
                  options={card.options}
                  onChange={(timeRange) => updateCardAnswer(card, timeRange)}
                />
              ) : card.selection_mode === "free_text" || !card.options.length ? (
                <textarea
                  value={String(cardAnswers[card.id] ?? "")}
                  onChange={(event) => {
                    updateCardAnswer(card, event.target.value);
                  }}
                  rows={3}
                  placeholder={card.default_value ?? "直接写你的偏好，比如：想少走路、不要太吵"}
                  className="mt-4 w-full resize-none rounded-2xl border border-dz-line bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-dz-orange"
                />
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {card.options.map((option) => {
                    const selected = isClarificationOptionSelected(clarification, cardAnswers, card, option);
                    return (
                      <button
                        key={option}
                        onClick={() => {
                          const nextAnswers = updateClarificationCardAnswers(cardAnswers, card, option);
                          setCardAnswers(nextAnswers);
                          setClarification(applyClarificationCardAnswer(clarification, card, nextAnswers[card.id]));
                        }}
                        className={cn(
                          "rounded-full border px-3 py-2 text-xs font-semibold",
                          selected ? "border-dz-orange bg-dz-soft text-dz-orange" : "border-dz-line bg-white text-neutral-600"
                        )}
                      >
                        {card.selection_mode === "multiple" && selected ? "✓ " : ""}
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}
              {card.allow_skip && (
                <p className="mt-3 text-[11px] font-semibold text-neutral-400">也可以先用默认值继续，后面还能在方案页微调。</p>
              )}
            </section>
            {index === cards.length - 1 && (
              <button onClick={onConfirm} className="mt-4 w-full rounded-2xl bg-dz-ink px-4 py-4 text-sm font-bold text-white">
                确定，看看总结
              </button>
            )}
          </section>
        ))}
      </motion.section>
    );
  }

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
        className={cn(FLOW_BLOCK_CLASS, "py-2")}
      >
        <BlockTitle title="补全几个关键信息" subtitle="这些会影响路线节奏和 POI 筛选。" />
        {inputNotice && (
          <div className="mb-3 rounded-2xl border border-[#dce8ff] bg-[#eef6ff] px-3 py-3 text-xs font-semibold leading-5 text-[#1f3b63]">
            {inputNotice}
          </div>
        )}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <PeopleWheelControl
            value={clarification.people}
            onChange={(people) => setClarification({ ...clarification, people })}
          />
          <TimeWindowControl
            value={clarification.timeRange}
            options={["今天下午 14:00-18:00", "今晚 18:00-21:30", "周末半天", "随便"]}
            onChange={(timeRange) => setClarification({ ...clarification, timeRange })}
          />
          <ChoiceGroup
            label="饮食"
            value={clarification.food}
            options={["吃正餐 + 甜品", "只喝饮品", "吃当地特色小吃", "不吃任何东西"]}
            onChange={(food) => setClarification({ ...clarification, food })}
          />
        </section>
      </section>

      <section data-flow-block className={cn(FLOW_BLOCK_CLASS, "py-2")}>
        <BlockTitle title="再确认一个偏好" subtitle="ContextGroundingAgent 在候选餐厅里发现川菜和火锅，所以先问清楚口味和预算。" />
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 rounded-2xl bg-[#f3f6ff] px-3 py-3 text-xs font-semibold leading-5 text-[#5260c8]">
            你能接受辣味吗？我会用这个答案调整餐厅排序，避免推荐看起来好但实际不适合的店。
          </div>
          <ChoiceGroup
            label="预算"
            value={clarification.budget}
            options={["人均 ¥50-100", "人均 ¥100-200", "人均 ¥200-300", "不计预算"]}
            onChange={(budget) => setClarification({ ...clarification, budget })}
          />
          <ChoiceGroup
            label="口味"
            value={clarification.taste}
            options={["一点辣都不行", "微辣可以", "无辣不欢", "随便"]}
            onChange={(taste) => setClarification({ ...clarification, taste })}
          />
        </section>
        <button onClick={onConfirm} className="w-full rounded-2xl bg-dz-ink px-4 py-4 text-sm font-bold text-white">
          确定，看看总结
        </button>
      </section>
    </motion.section>
  );
}

function PeopleWheelControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const peopleOptions = Array.from({ length: 20 }, (_, index) => index + 1);
  const boundedValue = Math.min(20, Math.max(1, value || 1));

  return (
    <div className="border-t border-dz-line py-3 first:border-t-0">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold">人数</span>
        <span className="rounded-full bg-dz-soft px-3 py-1 text-xs font-black text-dz-orange">{boundedValue} 人</span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7f8fa] p-3">
        <button
          onClick={() => onChange(Math.max(1, boundedValue - 1))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-[#20283a] shadow-sm disabled:text-neutral-300"
          disabled={boundedValue <= 1}
        >
          -
        </button>
        <div className="grid h-24 min-w-[120px] flex-1 place-items-center overflow-hidden rounded-2xl bg-white shadow-inner">
          <span className="text-xs font-semibold text-neutral-300">{boundedValue > 1 ? `${boundedValue - 1} 人` : " "}</span>
          <div className="flex min-w-[92px] items-baseline justify-center rounded-2xl bg-dz-yellow px-4 py-2 text-dz-ink">
            <span className="text-3xl font-black">{boundedValue}</span>
            <span className="ml-1 text-sm font-black">人</span>
          </div>
          <span className="text-xs font-semibold text-neutral-300">{boundedValue < 20 ? `${boundedValue + 1} 人` : " "}</span>
        </div>
        <button
          onClick={() => onChange(Math.min(20, boundedValue + 1))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-[#20283a] shadow-sm disabled:text-neutral-300"
          disabled={boundedValue >= 20}
        >
          +
        </button>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {peopleOptions.map((people) => (
          <button
            key={people}
            onClick={() => onChange(people)}
            className={cn(
              "h-8 min-w-8 shrink-0 rounded-full px-2 text-xs font-black",
              boundedValue === people ? "bg-dz-ink text-white" : "bg-dz-soft text-neutral-500"
            )}
          >
            {people}
          </button>
        ))}
      </div>
    </div>
  );
}

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

  return (
    <div className="border-t border-dz-line py-3 first:border-t-0">
      <div className="mb-2 text-sm font-bold">时间</div>
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((option) => {
          const optionValue = normalizeTimeOption(option);
          const selected = value === option || value === optionValue || timeShortcutMatches(value, option);
          return (
            <button
              key={option}
              onClick={() => onChange(optionValue)}
              className={cn(
                "rounded-full border px-3 py-2 text-xs font-semibold",
                selected ? "border-dz-orange bg-dz-soft text-dz-orange" : "border-dz-line bg-white text-neutral-600"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_28px_1fr] items-center rounded-2xl bg-[#f7f8fa] px-3 py-3">
        <div className="rounded-2xl bg-white px-3 py-3 text-center shadow-inner">
          <div className="text-[11px] font-bold text-neutral-400">开始</div>
          <div className="mt-1 text-lg font-black text-[#20283a]">{preview.start}</div>
        </div>
        <ChevronRight className="mx-auto h-4 w-4 text-neutral-300" />
        <div className="rounded-2xl bg-white px-3 py-3 text-center shadow-inner">
          <div className="text-[11px] font-bold text-neutral-400">结束</div>
          <div className="mt-1 text-lg font-black text-[#20283a]">{preview.end}</div>
        </div>
      </div>
      <p className="mt-2 text-[11px] font-semibold leading-5 text-neutral-400">也可以直接输入“15 点到 19 点”，点仔会自动回填。</p>
    </div>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="border-t border-dz-line py-3 first:border-t-0">
      <div className="mb-2 text-sm font-bold">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-full border px-3 py-2 text-xs font-semibold",
              value === option ? "border-dz-orange bg-dz-soft text-dz-orange" : "border-dz-line bg-white text-neutral-600"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
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
      className={cn(FLOW_BLOCK_CLASS, "py-2")}
    >
      <BlockTitle title="确认你的需求" subtitle={requirementSummary?.next_action ?? "确认后开始生成 3 套路线。"} />
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {items.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[58px_1fr] gap-3 text-sm">
              <span className="text-neutral-500">{label}</span>
              <span className="font-semibold leading-6">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-dz-soft px-3 py-3 text-xs leading-5 text-neutral-600">
          若后续想改，比如“第二站换成川菜”，可以在方案页直接输入。
        </div>
      </div>
      {confirmed ? (
        <div className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm font-black text-green-700">
          已确认，继续生成路线方案
        </div>
      ) : (
        <button onClick={onConfirm} className="mt-4 w-full rounded-2xl bg-dz-orange px-4 py-4 text-sm font-black text-white">
          确定，开始规划
        </button>
      )}
    </motion.section>
  );
}

function PlansView({
  plans,
  selectedPlan,
  highlightedStopId,
  isRefining,
  apiNotice,
  expandedPlanId,
  autoFocus = false,
  onExpandPlan,
  onCloseExpandedPlan,
  onSlideChange,
  onSelectPlan,
  onQuickRefine,
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
      <div className="mb-3 flex items-start justify-between gap-3">
        <BlockTitle title="给你 3 套方案" subtitle="左右滑动，底部输入会默认微调当前方案。" compact />
        <span className="mt-1 rounded-full bg-green-50 px-2 py-1 text-[11px] font-bold text-green-700">completed</span>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {["换掉咖啡馆", "更少走路", "把展览提前"].map((label) => (
          <button
            key={label}
            onClick={() => onQuickRefine(label)}
            className="shrink-0 rounded-full border border-dz-line bg-white px-3 py-2 text-xs font-semibold"
          >
            {label}
          </button>
        ))}
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

      <div className="sticky bottom-[92px] z-20 mt-4 rounded-[22px] border border-blue-200 bg-blue-50/90 p-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-xs text-blue-700">
          <span>{apiNotice}</span>
          {isRefining && <span className="font-bold">更新中...</span>}
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onChoose();
          }}
          className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
        >
          选用此方案
        </button>
      </div>

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

function PlanCard({
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
  const avgQueue = Math.round(plan.stops.reduce((sum, stop) => sum + stop.queueMinutes, 0) / plan.stops.length);

  return (
    <article
      onClick={onExpand}
      className={cn(
        "min-h-[570px] cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition active:scale-[0.995]",
        active ? "border-dz-orange" : "border-dz-line"
      )}
    >
      <div className="sticky top-0 z-10 bg-white/95 pb-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-dz-soft px-2 py-1 text-[11px] font-bold text-dz-orange">{plan.badge}</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold">
            <Star className="h-3.5 w-3.5 fill-dz-yellow text-dz-orange" />
            {plan.score}
          </span>
        </div>
        <h2 className="text-xl font-black tracking-normal">{plan.title}</h2>
        <p className="mt-1 text-xs text-neutral-500">{plan.subtitle}</p>
      </div>

      <SvgRouteMap points={plan.mapPoints} tone={plan.mapTone} summary={`平均排队 ${avgQueue} 分钟`} />

      <div className="mt-3 grid grid-cols-3 gap-2">
        {plan.transports.map((transport) => (
          <div key={transport.mode} className="rounded-xl bg-dz-soft px-2 py-2">
            <div className="text-[11px] font-bold">{transport.label}</div>
            <div className="mt-1 text-xs text-neutral-600">{transport.minutes} 分钟</div>
            <div className="mt-1 truncate text-[11px] text-neutral-500">{transport.cost}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {plan.stops.map((stop, index) => {
          const isHighlighted = highlightedStopId === stop.poiId;

          return (
          <motion.div
            key={stop.poiId}
            animate={
              isHighlighted
                ? {
                    backgroundColor: ["#ffffff", "#f5f7ff", "#ffffff"],
                    borderColor: ["#ece7dc", "#cfd8ff", "#ece7dc"],
                    boxShadow: [
                      "0 0 0 rgba(79,104,255,0)",
                      "0 10px 24px rgba(79,104,255,0.12)",
                      "0 0 0 rgba(79,104,255,0)"
                    ]
                  }
                : {}
            }
            transition={{ duration: 1.05, ease: "easeInOut" }}
            className="rounded-2xl border border-dz-line bg-white p-3"
          >
            <div className="flex items-start gap-3">
              <span className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black transition-colors",
                isHighlighted ? "bg-[#eef1ff] text-[#4f68ff]" : "bg-dz-yellow text-[#20283a]"
              )}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <HighlightableText active={isHighlighted} className="text-sm font-black leading-5">
                    {stop.poiName}
                  </HighlightableText>
                  <span className="shrink-0 text-[11px] text-neutral-500">{stop.startTime}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {stop.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-semibold transition-colors",
                        isHighlighted ? "bg-[#eef1ff] text-[#4f68ff]" : "bg-dz-soft text-dz-orange"
                      )}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <HighlightableText active={isHighlighted} as="p" className="mt-2 text-xs leading-5 text-neutral-600">
                  {stop.reason}
                </HighlightableText>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-500">
                  <span>★ {stop.rating}</span>
                  {stop.avgPrice && <span>人均 ¥{stop.avgPrice}</span>}
                  <span>排队 {stop.queueMinutes} 分</span>
                </div>
                <div className="mt-2 text-[11px] font-semibold text-[#4f68ff]">点击展开看 UGC 摘要和行动入口</div>
              </div>
            </div>
          </motion.div>
          );
        })}
      </div>
    </article>
  );
}

function ExpandedPlanSheet({
  plan,
  onClose,
  onChoose,
  onNavigate,
  hasPrevious,
  hasNext
}: {
  plan: DemoRoutePlan;
  onClose: () => void;
  onChoose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  hasPrevious: boolean;
  hasNext: boolean;
}) {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col bg-white"
      initial={{ opacity: 0, scale: 0.96, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 18 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="shrink-0 border-b border-[#f1f1f1] bg-white px-4 pb-3 pt-[62px]">
        <div className="grid grid-cols-[38px_1fr_38px] items-center gap-2">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f4f7] text-[#20283a]">
            ×
          </button>
          <div className="min-w-0 text-center">
            <h2 className="truncate text-base font-black">{plan.title}</h2>
            <p className="mt-0.5 text-xs font-semibold text-neutral-500">全程约 {plan.totalMinutes} 分钟</p>
          </div>
          <span aria-hidden className="h-9 w-9" />
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {hasPrevious && (
          <button
            onClick={() => onNavigate(-1)}
            className="absolute left-2 top-1/2 z-10 flex h-10 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur"
          >
            ‹
          </button>
        )}
        {hasNext && (
          <button
            onClick={() => onNavigate(1)}
            className="absolute right-2 top-1/2 z-10 flex h-10 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur"
          >
            ›
          </button>
        )}
        <SvgRouteMap points={plan.mapPoints} tone={plan.mapTone} summary={`${plan.badge} · ${plan.score} 分`} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {plan.transports.map((transport) => (
            <div key={transport.mode} className="rounded-xl bg-dz-soft px-2 py-2">
              <div className="text-[11px] font-bold">{transport.label}</div>
              <div className="mt-1 text-xs text-neutral-600">{transport.minutes} 分钟</div>
              <div className="mt-1 truncate text-[11px] text-neutral-500">{transport.cost}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-3 pb-28">
          {plan.stops.map((stop, index) => (
            <section key={stop.poiId} className="rounded-2xl border border-dz-line bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dz-yellow text-xs font-black">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black">{stop.poiName}</h3>
                  <p className="mt-1 text-xs font-semibold text-neutral-500">{stop.address}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {stop.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-dz-soft px-2 py-1 text-[10px] font-semibold text-dz-orange">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-neutral-600">{stop.ugcSummary}</p>
                  <p className="mt-2 rounded-xl bg-[#f3f6ff] px-3 py-2 text-xs leading-5 text-[#5260c8]">{stop.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stop.actions.map((action) => {
                      const Icon = actionIcon[action.kind];
                      return (
                        <span
                          key={action.id}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold",
                            action.disabled ? "bg-neutral-100 text-neutral-400" : "bg-dz-soft text-dz-orange"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {action.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
      <footer className="absolute bottom-[92px] left-0 right-0 border-t border-[#edf0f4] bg-white/88 px-4 pb-3 pt-3 backdrop-blur">
        <button
          onClick={(event) => {
            event.stopPropagation();
            onChoose();
          }}
          className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
        >
          选用此方案
        </button>
      </footer>
    </motion.div>
  );
}

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

const recentConversationRecords = [
  {
    title: "今天下午约会路线",
    meta: "今天 14:05 · 已生成 3 套方案",
    summary: "低排队、吃饭、看展、甜品收尾"
  },
  {
    title: "周末轻松拍照路线",
    meta: "昨天 20:18 · 已微调少走路",
    summary: "咖啡馆、街区、晚餐不赶时间"
  },
  {
    title: "临时朋友聚餐",
    meta: "6 月 5 日 · 快速问答转规划",
    summary: "顺路甜品、打车友好、预算 ¥100-200"
  },
  {
    title: "附近营业便利店",
    meta: "6 月 4 日 · 普通 POI 问答",
    summary: "只返回 answer + related_pois + trace"
  },
  {
    title: "五个人明天下午安排",
    meta: "6 月 2 日 · 追问 2 轮",
    summary: "人数、时间、餐饮偏好已补全"
  }
];

function SettingsDrawer({
  onClose,
  onNewChat,
  onOpenHistory
}: {
  onClose: () => void;
  onNewChat: () => void;
  onOpenHistory: () => void;
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
              {recentConversationRecords.slice(0, 3).map((record) => (
                <button
                  key={record.title}
                  type="button"
                  className="grid w-full grid-cols-[26px_1fr] items-start gap-2 rounded-2xl bg-[#f7f8fb] px-2.5 py-2 text-left"
                >
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 text-[#7f8eff]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-black text-[#20283a]">{record.title}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#8a91a0]">{record.meta}</span>
                  </span>
                </button>
              ))}
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

function ConversationHistoryPage({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
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
        <div className="mb-3 rounded-2xl bg-white px-3 py-2 text-[12px] font-semibold text-[#8a91a0] shadow-sm">
          V2 使用 Mock 历史，也就是本地样例数据模拟真实对话记录。
        </div>
        <div className="space-y-3">
          {recentConversationRecords.map((record) => (
            <button key={record.title} type="button" className="w-full rounded-[20px] bg-white p-4 text-left shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black">{record.title}</h3>
                  <p className="mt-1 text-[11px] font-semibold text-[#8a91a0]">{record.meta}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#b4bac5]" />
              </div>
              <p className="mt-3 text-xs leading-5 text-[#66708a]">{record.summary}</p>
            </button>
          ))}
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
  const setRequireRequirementConfirmation = useDemoStore((state) => state.setRequireRequirementConfirmation);
  const setPreferenceDetectionEnabled = useDemoStore((state) => state.setPreferenceDetectionEnabled);
  const setDataAuthorizationEnabled = useDemoStore((state) => state.setDataAuthorizationEnabled);
  const setUserPreferences = useDemoStore((state) => state.setUserPreferences);
  const removeUserPreference = useDemoStore((state) => state.removeUserPreference);
  const updateUserPreference = useDemoStore((state) => state.updateUserPreference);
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
  const profileRows = [
    ["性别", "不透露"],
    ["年龄", "青年人"]
  ];
  const fixedPreferences = [
    ["常用出行区域", ["望京", "大山子", "徐汇区"]],
    ["餐饮口味", ["川菜", "日料", "甜品"]],
    ["消费水平", ["¥100-200"]],
    ["出行方式", ["步行", "打车"]],
    ["兴趣标签", ["小众去处", "看展", "安静聊天"]],
    ["特殊需求", ["少排队"]]
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
            <button key={label} type="button" className="flex w-full items-center justify-between rounded-2xl bg-[#f7f8fb] px-3 py-2.5 text-left">
              <span className="text-xs font-black text-[#66708a]">{label}</span>
              <span className="flex items-center gap-1 text-xs font-semibold text-[#20283a]">
                {value}
                <ChevronRight className="h-3.5 w-3.5 text-[#b4bac5]" />
              </span>
            </button>
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

function MobileComposer({
  view,
  draft,
  setDraft,
  inputMode,
  setInputMode,
  keyboardOpen,
  setKeyboardOpen,
  voicePressed,
  setVoicePressed,
  onSubmit
}: {
  view: string;
  draft: string;
  setDraft: (value: string) => void;
  inputMode: "text" | "voice";
  setInputMode: (mode: "text" | "voice") => void;
  keyboardOpen: boolean;
  setKeyboardOpen: (open: boolean) => void;
  voicePressed: boolean;
  setVoicePressed: (pressed: boolean) => void;
  onSubmit: (text?: string) => void;
}) {
  const [voiceCancelArmed, setVoiceCancelArmed] = useState(false);
  const [voiceStatusText, setVoiceStatusText] = useState("按住说话");
  const [routePlanningEnabled, setRoutePlanningEnabled] = useState(true);
  const voiceStartYRef = useRef<number | null>(null);
  const voiceCancelArmedRef = useRef(false);
  const textLongPressTimerRef = useRef<number | undefined>(undefined);
  const textLongPressActiveRef = useRef(false);
  const isStartView = view === "start";

  useEffect(() => {
    return () => {
      if (textLongPressTimerRef.current) {
        window.clearTimeout(textLongPressTimerRef.current);
      }
    };
  }, []);

  if (view === "settings") {
    return null;
  }

  const placeholder =
    view === "plans" || view === "refining" || view === "selected"
      ? "试试说“换掉咖啡馆”或“不想走太多”"
      : inputMode === "voice"
        ? "按住说话"
        : "发消息或按住说话";
  const voiceFieldStateClass = voiceCancelArmed
    ? "bg-[rgba(255,165,178,0.95)] text-[#f70000]"
    : voicePressed
      ? "bg-[rgba(15,111,255,0.95)] text-white"
      : "bg-[rgba(243,243,243,0.9)] text-[#727272]";
  const showVoiceControl = inputMode === "voice" || voicePressed;

  function toggleInputMode() {
    if (inputMode === "text") {
      setInputMode("voice");
      setKeyboardOpen(false);
      return;
    }
    setInputMode("text");
    setKeyboardOpen(true);
  }

  function beginVoice(pointerY: number) {
    voiceStartYRef.current = pointerY;
    voiceCancelArmedRef.current = false;
    setVoiceCancelArmed(false);
    setVoiceStatusText("松手发送，上滑取消");
    setVoicePressed(true);
  }

  function moveVoice(pointerY: number) {
    if (voiceStartYRef.current === null) {
      return;
    }
    const shouldCancel = voiceStartYRef.current - pointerY > 54;
    voiceCancelArmedRef.current = shouldCancel;
    setVoiceCancelArmed(shouldCancel);
    setVoiceStatusText(shouldCancel ? "松手取消" : "松手发送，上滑取消");
  }

  function finishVoice() {
    const shouldCancel = voiceCancelArmedRef.current;
    voiceStartYRef.current = null;
    voiceCancelArmedRef.current = false;
    setVoicePressed(false);
    setVoiceCancelArmed(false);

    if (shouldCancel) {
      setVoiceStatusText("按住说话");
      if (inputMode === "text") {
        setInputMode("text");
      }
      return;
    }

    const mockSpeech = voiceMockTextForView(view);
    setDraft(mockSpeech);
    setVoiceStatusText(`识别到：${mockSpeech}`);
    window.setTimeout(() => {
      setVoiceStatusText("按住说话");
      onSubmit(mockSpeech);
    }, 180);
  }

  function clearTextLongPressTimer() {
    if (textLongPressTimerRef.current) {
      window.clearTimeout(textLongPressTimerRef.current);
      textLongPressTimerRef.current = undefined;
    }
  }

  function beginTextLongPress(event: ReactPointerEvent<HTMLDivElement>) {
    if (inputMode !== "text") {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    textLongPressActiveRef.current = false;
    voiceStartYRef.current = event.clientY;
    clearTextLongPressTimer();
    textLongPressTimerRef.current = window.setTimeout(() => {
      textLongPressActiveRef.current = true;
      setKeyboardOpen(false);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      beginVoice(event.clientY);
    }, 260);
  }

  function moveTextLongPress(pointerY: number) {
    if (!textLongPressActiveRef.current) {
      return;
    }
    moveVoice(pointerY);
  }

  function finishTextLongPress() {
    clearTextLongPressTimer();
    if (!textLongPressActiveRef.current) {
      voiceStartYRef.current = null;
      return;
    }
    textLongPressActiveRef.current = false;
    finishVoice();
  }

  return (
    <footer
      data-mobile-composer="true"
      className={cn(
        "relative z-20 shrink-0 bg-transparent px-[25px] pt-0 transition-[padding] duration-300",
        keyboardOpen && inputMode === "text" ? "pb-[354px]" : isStartView ? "pb-[27px]" : "pb-10"
      )}
    >
      {isStartView && (
        <button
          type="button"
          aria-label={routePlanningEnabled ? "路线规划已开启" : "路线规划已关闭"}
          aria-pressed={routePlanningEnabled}
          onClick={() => setRoutePlanningEnabled((enabled) => !enabled)}
          className="relative z-20 mb-2 block h-[25px] w-[113px] bg-contain bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/dianping-assets/${routePlanningEnabled ? "路线规划按钮开启态.png" : "路线规划按钮关闭态.png"}')`
          }}
        />
      )}
      <div
        className={cn(
          "relative z-20 flex h-11 items-center gap-2 rounded-full border border-white transition-colors",
          "overflow-visible py-[11px] pl-4 pr-[4px] shadow-[0_10px_24px_rgba(0,0,0,0.055),0_0_22px_rgba(255,102,43,0.08)]",
          showVoiceControl ? voiceFieldStateClass : "bg-[rgba(243,243,243,0.9)] text-[#727272]"
        )}
        onPointerDown={beginTextLongPress}
        onPointerMove={(event) => moveTextLongPress(event.clientY)}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          finishTextLongPress();
        }}
        onPointerCancel={finishTextLongPress}
      >
        {showVoiceControl && voicePressed && !voiceCancelArmed && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 rounded-full border border-[#1b76ff]/45 shadow-[0_0_24px_rgba(27,118,255,0.42)]"
            animate={{
              scale: [1, 1.035, 1],
              opacity: [0.7, 0.25, 0.7],
              boxShadow: [
                "0 0 16px rgba(27,118,255,0.35)",
                "0 0 34px rgba(27,118,255,0.6)",
                "0 0 16px rgba(27,118,255,0.35)"
              ]
            }}
            transition={{ repeat: Infinity, duration: 0.9, ease: "easeInOut" }}
          />
        )}
        <button
          onClick={toggleInputMode}
          className={cn(
            "flex shrink-0 items-center justify-center",
            "h-[22px] w-[22px]"
          )}
          aria-label={inputMode === "text" ? "切换到语音输入" : "切换到文字输入"}
        >
          {inputMode === "text" ? (
            <span
              aria-hidden="true"
              className="block h-[22px] w-[22px] bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/dianping-assets/ugc_review_add_voice_new_icon_Normal@3x.png')" }}
            />
          ) : (
            <Keyboard className="h-4 w-4 text-current" />
          )}
        </button>
        {showVoiceControl ? (
          <button
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              beginVoice(event.clientY);
            }}
            onPointerMove={(event) => moveVoice(event.clientY)}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              finishVoice();
            }}
            onPointerCancel={() => {
              setVoicePressed(false);
              setVoiceCancelArmed(false);
              voiceCancelArmedRef.current = false;
              setVoiceStatusText("按住说话");
              voiceStartYRef.current = null;
            }}
            onPointerLeave={() => {
              if (voicePressed) {
                voiceCancelArmedRef.current = true;
                setVoiceCancelArmed(true);
                setVoiceStatusText("松手取消");
              }
            }}
            className={cn(
              "relative flex min-w-0 flex-1 items-center justify-center rounded-full text-[14px] transition",
              "h-[22px] font-normal"
            )}
          >
            {voicePressed || voiceStatusText !== "按住说话" ? voiceStatusText : placeholder}
          </button>
        ) : (
          <>
            <input
              value={draft}
              onFocus={() => setKeyboardOpen(true)}
              onClick={() => setKeyboardOpen(true)}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSubmit();
                }
              }}
              placeholder={placeholder}
              className={cn(
                "min-w-0 flex-1 bg-transparent text-[14px] outline-none",
                "font-normal leading-[22px] tracking-[-0.08px] placeholder:text-[#727272]"
              )}
            />
            <button
              onClick={() => onSubmit()}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full bg-[#f26b43] bg-contain bg-center bg-no-repeat text-white",
                "h-[35px] w-[35px]"
              )}
              style={{ backgroundImage: "url('/dianping-assets/submit.png')" }}
              aria-label="发送"
            />
          </>
        )}
      </div>
      {keyboardOpen && inputMode === "text" && <MockKeyboard onAction={onSubmit} />}
    </footer>
  );
}

function BlockTitle({ title, subtitle, compact = false }: { title: string; subtitle: string; compact?: boolean }) {
  return (
    <div className={cn(compact ? "mb-0" : "mb-4")}>
      <h2 className="text-xl font-black tracking-normal">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-neutral-500">{subtitle}</p>
    </div>
  );
}

function isRoutePlanningGoal(goal: string) {
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

function providerStatusesFromTrace(trace: AgentTrace): ProviderStatus[] {
  const statuses = new Map<string, ProviderStatus>();

  for (const event of trace.events) {
    collectProviderStatus(event.tool_output, statuses);
    collectProviderStatus(event.output, statuses);
    if (event.fallback_used && event.tool_name) {
      const providerName = event.tool_name.includes("llm") ? "longcat" : event.tool_name.includes("route") ? "amap" : event.tool_name;
      statuses.set(providerName, {
        name: providerName,
        label: providerLabel(providerName),
        status: "mock",
        lastDegradedReason: event.summary
      });
    }
  }

  if (!statuses.size && trace.runner_mode === "deterministic_mock") {
    statuses.set("deterministic_mock", {
      name: "deterministic_mock",
      label: "本地 Mock Runner",
      status: "mock",
      lastDegradedReason: "本轮使用本地可复现 fallback。"
    });
  }

  return Array.from(statuses.values());
}

function collectProviderStatus(value: unknown, statuses: Map<string, ProviderStatus>) {
  if (!isRecord(value)) {
    return;
  }

  const providerCall = isRecord(value.provider_call) ? value.provider_call : value;
  const provider = typeof providerCall.provider === "string" ? providerCall.provider : undefined;
  if (provider) {
    const fallbackUsed = providerCall.fallback_used === true;
    const reliability = typeof providerCall.reliability === "string" ? providerCall.reliability : undefined;
    const error = typeof providerCall.error === "string" ? providerCall.error : undefined;
    const status: ProviderStatus["status"] = error?.toLowerCase().includes("timeout")
      ? "timeout"
      : fallbackUsed || reliability === "mocked" || provider.includes("mock") || provider === "deterministic_template"
        ? "mock"
        : "connected";
    statuses.set(provider, {
      name: provider,
      label: providerLabel(provider),
      status,
      lastDegradedReason: error
    });
  }

  for (const item of Object.values(value)) {
    if (isRecord(item)) {
      collectProviderStatus(item, statuses);
    }
  }
}

function providerLabel(provider: string) {
  const labels: Record<string, string> = {
    amap: "高德地图",
    caiyun: "彩云天气",
    longcat: "LongCat LLM",
    deterministic_template: "LLM 模板兜底",
    mock_map_provider: "Mock 地图",
    mock_weather_provider: "Mock 天气",
    mock_poi_search: "Mock POI",
    mock_local_poi_enrichment: "本地深度字段",
    deterministic_mock: "本地 Mock Runner"
  };
  return labels[provider] ?? provider;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function agentUserFacingDetail(step: RunningAgentStep, index: number) {
  const labels: Record<string, string> = {
    InteractionRouterAgent: "先判断这是新规划、补全回答、微调、换方向还是普通问答。",
    ConstraintDiscoveryAgent: "把目标、硬约束、软约束和缺失信息写进约束账本。",
    UserPreferenceAgent: "读取你已授权的历史收藏、评分、去过的店和长期偏好。",
    ContextGroundingAgent: "调用 Mock POI、UGC、地图、排队、天气和交通 provider 补齐事实。",
    PlanSolverAgent: "按时间窗、POI 类型和交通方式生成多套候选路线。",
    PlanEvaluatorAgent: "检查营业、排队、天气、交通、预算和偏好约束，并排序 3 个方案。",
    PlanExplanationAgent: "把路线理由、风险提醒和每站推荐点整理成用户能看懂的话。"
  };

  return labels[step.agent] ?? [
    "正在读取本轮请求里的关键信息。",
    "正在调用本地 Mock 工具补齐上下文。",
    "正在把候选结果整理成可执行方案。"
  ][index % 3];
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

function voiceMockTextForView(view: string) {
  if (view === "plans" || view === "refining") {
    return "换掉咖啡馆，少走一点路";
  }
  if (view === "clarifying") {
    return "三个人，今天下午，微辣可以";
  }
  if (view === "summary") {
    return "预算控制在人均一百五以内";
  }
  return "今天下午想在北京约会，不想排队，想吃饭加看展";
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
      reason: stop.reason || "命中本轮需求和用户偏好，作为路线中的稳定候选点。",
      actions: stop.actions?.length
        ? stop.actions
        : [
            { id: `${poiId}-nav`, label: "导航", kind: "navigate" },
            { id: `${poiId}-queue`, label: "在线排号", kind: "queue", disabled: true }
          ]
    };
  });

  return {
    id: plan.id,
    title: plan.title || "后端生成路线",
    subtitle: plan.subtitle ?? "由 API 返回的真实规划结果",
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

function createDirectAnswer(question: string): DirectAnswer {
  const normalized = question.replace(/\s/g, "");

  if (/(便利店|超市|买水|营业中)/.test(normalized)) {
    return {
      question,
      answer: "附近有几家还比较稳的便利店。优先看悠乐汇和望京 SOHO 周边，距离近、营业时间覆盖晚间，临时买水或补给不用专门绕路。",
      poiHints: [
        { name: "7-Eleven 悠乐汇店", meta: "约 280m · 营业到 23:30", reason: "离当前商圈近，适合顺手买饮料、纸巾和简单零食。" },
        { name: "便利蜂 方恒国际店", meta: "约 520m · 评分 4.5", reason: "在办公楼底商，晚间人流稳定，找起来比较直接。" },
        { name: "小象超市 望京站", meta: "约 900m · 支持外卖", reason: "如果不想走过去，可以直接下单，适合大件补给。" }
      ]
    };
  }

  if (/(咖啡|茶饮|奶茶|坐坐)/.test(normalized)) {
    return {
      question,
      answer: "如果只是想找个地方坐坐，建议先看低排队、座位相对稳定的茶饮和咖啡店。望京 SOHO 内更方便，路边独立店更安静。",
      poiHints: [
        { name: "小山茶饮廊", meta: "约 430m · 人均 ¥46", reason: "座位周转比热门咖啡店快，适合短暂停留。" },
        { name: "Luckin Coffee 望京新世界店", meta: "约 620m · 出杯快", reason: "适合拿了就走，排队风险低。" },
        { name: "桥下咖啡小馆", meta: "约 1.1km · 安静", reason: "更像休息点，适合聊天，不太适合赶时间。" }
      ]
    };
  }

  if (/(餐厅|吃什么|吃饭|火锅|日料|西餐|小吃)/.test(normalized)) {
    return {
      question,
      answer: "我先按“附近、排队少、口碑稳定”给你快速筛了一组。想要完整吃饭加逛街路线时，可以继续说“帮我规划一条路线”。",
      poiHints: [
        { name: "李串串老店", meta: "1.0km · 热门榜第 1 名", reason: "口味辨识度高，但饭点要注意排队。" },
        { name: "蓝港日料小食堂", meta: "打车约 10 分钟 · 排队约 7 分", reason: "更适合低排队约会，环境稳定。" },
        { name: "半重山老火锅双人套", meta: "994m · 今日免费试", reason: "如果想薅活动，可以优先查看名额。" }
      ]
    };
  }

  return {
    question,
    answer: "我先按附近 POI、营业状态和大众点评口碑做了快速回答。这个问题更像即时问答，所以不进入完整路线规划；如果你想要多站行程，可以直接说“帮我规划一条路线”。",
    poiHints: [
      { name: "望京新世界", meta: "约 746m · 商场综合体", reason: "吃喝、购物、休息点密集，适合作为默认落点。" },
      { name: "望京悠乐汇", meta: "约 994m · 生活服务集中", reason: "适合找便利店、咖啡、简餐等即时需求。" },
      { name: "大山子口碑餐饮带", meta: "约 1.5km · 餐饮选择多", reason: "如果想顺便吃饭，这里比单点搜索更稳。" }
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
