import { create } from "zustand";
import type {
  AgentTrace,
  AgentStrategy,
  DemoRoutePlan,
  FlowBlock,
  InputMode,
  MobileShellView,
  MockLocation,
  MockPoi,
  MockUserFull,
  TraceEvent,
  TransportMode,
  UserPreference
} from "@/types/dzultra";

// ── AI Mock 生成器数据同步到后端覆盖层 ──

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/** 将已应用的用户数据同步到后端覆盖层，Agent 流程优先使用这些数据。 */
function _syncAppliedUsersToBackend(users: MockUserFull[]) {
  try {
    fetch(`${API_BASE_URL}/mock/apply-users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(users),
    }).catch(() => { /* 静默失败，不影响前端流程 */ });
  } catch { /* 静默失败 */ }
}

/** 将已应用的 POI 数据同步到后端覆盖层，Agent 流程优先使用这些数据。 */
function _syncAppliedPoisToBackend(pois: MockPoi[]) {
  try {
    fetch(`${API_BASE_URL}/mock/apply-pois`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pois),
    }).catch(() => { /* 静默失败，不影响前端流程 */ });
  } catch { /* 静默失败 */ }
}

type DemoView = "home" | "planning" | "result" | "refine";

export type ProviderStatus = {
  name: string;
  label: string;
  shortLabel: string;
  status: "connected" | "mock" | "timeout";
  lastDegradedReason?: string;
};

type DebugSubTab = "summary" | "candidates" | "ranking" | "map" | "json";

export const SKELETON_AGENT_STRATEGIES: AgentStrategy[] = [
  {
    name: "InteractionRouterAgent",
    responsibility: "判断本次输入是新规划、补全、确认、微调、选方案还是普通问答。",
    inputs: ["用户输入", "页面上下文", "路线规划模式"],
    outputs: ["interaction_type", "routing_reason", "confidence"],
    tools: ["provider_adapter.llm_chat_completion"],
    handoff_conditions: ["分流结果确定后交给对应 Agent"],
    failure_fallback: "LongCat 不可用时使用 deterministic router 模板。",
    trace_events: ["run_started", "agent_started", "task_switched"],
    runtime_role: "main_planning",
    llm_call_budget: 1,
    react_step_budget: 0,
    parallelizable: false,
  },
  {
    name: "ConstraintDiscoveryAgent",
    responsibility: "把用户目标拆成时间、地点、人数、预算、口味、移动和天气等约束。",
    inputs: ["routing", "user_goal"],
    outputs: ["constraint_ledger", "clarification_cards"],
    tools: ["provider_adapter.llm_chat_completion"],
    handoff_conditions: ["约束账本完成或需要追问"],
    failure_fallback: "LLM 失败时使用规则模板抽取核心约束。",
    trace_events: ["constraint_discovered", "clarification_requested"],
    runtime_role: "main_planning",
    llm_call_budget: 1,
    react_step_budget: 0,
    parallelizable: false,
  },
  {
    name: "UserPreferenceAgent",
    responsibility: "读取 Mock 用户画像、长期偏好、历史收藏、评分和 UGC 行为。",
    inputs: ["user_id", "constraint_ledger"],
    outputs: ["preference_profile", "priority_weights"],
    tools: ["profiles.store", "mock_user_history"],
    handoff_conditions: ["偏好画像准备完成"],
    failure_fallback: "用户档案缺失时按匿名用户处理。",
    trace_events: ["preference_detected"],
    runtime_role: "main_planning",
    llm_call_budget: 0,
    react_step_budget: 0,
    parallelizable: true,
  },
  {
    name: "ContextGroundingAgent",
    responsibility: "检索 POI、UGC、排队、地图距离和天气，把 LLM 推断落到 provider 事实。",
    inputs: ["constraint_ledger", "preference_profile"],
    outputs: ["candidate_pool", "map_context", "weather_context"],
    tools: ["provider_adapter.poi_search", "provider_adapter.route_matrix", "provider_adapter.weather"],
    handoff_conditions: ["候选池和事实约束准备完成"],
    failure_fallback: "真实 provider 失败时使用 Mock provider，并写入 fallback 原因。",
    trace_events: ["candidate_retrieved", "map_context_resolved", "context_grounded"],
    runtime_role: "main_planning",
    llm_call_budget: 0,
    react_step_budget: 0,
    parallelizable: true,
  },
  {
    name: "PlanSolverAgent",
    responsibility: "基于候选 POI、时间窗和交通约束生成 3-5 套候选路线。",
    inputs: ["candidate_pool", "constraint_ledger"],
    outputs: ["route_candidates"],
    tools: ["mock_route_scheduler"],
    handoff_conditions: ["候选路线生成完成"],
    failure_fallback: "候选不足时使用稳定路线模板。",
    trace_events: ["route_candidate_generated"],
    runtime_role: "main_planning",
    llm_call_budget: 0,
    react_step_budget: 0,
    parallelizable: false,
  },
  {
    name: "PlanEvaluatorAgent",
    responsibility: "检查营业、排队、预算、天气、距离和偏好命中，并给路线排序。",
    inputs: ["route_candidates", "constraint_ledger"],
    outputs: ["ranked_plans", "score_breakdown"],
    tools: ["mock_constraint_checker"],
    handoff_conditions: ["排序完成后交给解释 Agent"],
    failure_fallback: "评分异常时保留保守默认排序。",
    trace_events: ["constraint_checked", "route_scored"],
    runtime_role: "main_planning",
    llm_call_budget: 0,
    react_step_budget: 0,
    parallelizable: false,
  },
  {
    name: "PlanExplanationAgent",
    responsibility: "把排序理由、风险提示、fallback 字段和每站推荐解释成用户能看懂的话。",
    inputs: ["ranked_plans", "trace_events"],
    outputs: ["user_facing_explanation"],
    tools: ["provider_adapter.llm_chat_completion"],
    handoff_conditions: ["解释完成后结束 run"],
    failure_fallback: "LLM 失败时用 deterministic explanation 模板。",
    trace_events: ["run_completed"],
    runtime_role: "main_planning",
    llm_call_budget: 1,
    react_step_budget: 0,
    parallelizable: false,
  },
];

function createTraceSkeleton(): AgentTrace {
  return {
    id: `trace-skeleton-${Date.now()}`,
    user_goal: "新演示：等待用户输入",
    status: "ready",
    total_duration_ms: 0,
    runner_mode: "real_agent_ai_generated_data",
    agent_strategy: SKELETON_AGENT_STRATEGIES,
    events: [],
    metadata: {
      skeleton: true,
      note: "新演示已创建 Agent 框架，用户交互后才会产生真实 run 数据。",
    },
  };
}

// 模块级定时器引用，用于渐进式 Trace 渲染
let _traceEventTimerId: ReturnType<typeof setInterval> | null = null;

function clearTraceEventTimer() {
  if (_traceEventTimerId !== null) {
    clearInterval(_traceEventTimerId);
    _traceEventTimerId = null;
  }
}

type DemoState = {
  activeUserId: string;
  activeView: DemoView;
  mobileView: MobileShellView;
  inputMode: InputMode;
  selectedPlanId?: string;
  selectedTransportMode: TransportMode;
  expandedStopId?: string;
  highlightedStopId?: string;
  completedTodoIds: string[];
  selectedTraceEventId?: string;
  activeTrace?: AgentTrace;
  currentRoutePlans: DemoRoutePlan[];
  requireRequirementConfirmation: boolean;
  preferenceDetectionEnabled: boolean;
  dataAuthorizationEnabled: boolean;
  userPreferences: UserPreference[];
  introCollapsed: boolean;
  activeAgentStep: string | null;
  selectedAgentStep: string | null;
  userManuallySelectedAgent: boolean;
  providerStatuses: ProviderStatus[];
  activeDebugTab: "trace" | "history" | "mock";
  activeDebugSubTab: DebugSubTab;
  // AI Mock 生成器最近一次结果
  generatedMockUsers: MockUserFull[];
  generatedMockPois: MockPoi[];
  generatedMockLocations: MockLocation[];
  // AI Mock 生成器“已应用”池：用户点击应用后会进入这里。
  appliedMockUsers: MockUserFull[];
  appliedMockPois: MockPoi[];
  activeMockLocation?: MockLocation;
  // 纵向内容块列表：按时间追加，不替换
  flowBlocks: FlowBlock[];
  // 连续微调次数计数
  refinementCount: number;
  // Mock 历史渐进式回放：跨组件触发信号
  pendingReplayTrace: AgentTrace | null;
  // Mock Board 面板状态（提升到 store 以便跨组件访问）
  mockBoardTab: "user" | "location" | "pois" | "history" | "json";
  mockBoardExpanded: boolean;
  // LLM 流式输出：按 purpose 累积 token 文本
  llmStreamingText: Record<string, string>;
  setActiveUserId: (userId: string) => void;
  setActiveView: (view: DemoView) => void;
  setMobileView: (view: MobileShellView) => void;
  setInputMode: (mode: InputMode) => void;
  setSelectedPlanId: (planId?: string) => void;
  setSelectedTransportMode: (mode: TransportMode) => void;
  setExpandedStopId: (stopId?: string) => void;
  setHighlightedStopId: (stopId?: string) => void;
  toggleTodo: (todoId: string) => void;
  resetMobileDemo: () => void;
  startNewTraceRun: () => void;
  setSelectedTraceEventId: (eventId?: string) => void;
  setActiveTrace: (trace?: AgentTrace) => void;
  /** SSE 模式：设置 trace 元信息（events 为空，status 为 running） */
  setActiveTraceMeta: (trace: AgentTrace) => void;
  /** SSE 模式：追加单个 trace event 并更新 activeAgentStep 和 selectedTraceEventId */
  appendTraceEvent: (event: TraceEvent) => void;
  /** SSE 模式：完成时设置最终 trace 状态 */
  finalizeActiveTrace: (trace: AgentTrace) => void;
  setCurrentRoutePlans: (plans: DemoRoutePlan[]) => void;
  setRequireRequirementConfirmation: (enabled: boolean) => void;
  setPreferenceDetectionEnabled: (enabled: boolean) => void;
  setDataAuthorizationEnabled: (enabled: boolean) => void;
  setUserPreferences: (preferences: UserPreference[]) => void;
  removeUserPreference: (preferenceId: string) => void;
  updateUserPreference: (preferenceId: string, label: string) => void;
  setIntroCollapsed: (collapsed: boolean) => void;
  setActiveAgentStep: (step: string | null) => void;
  setSelectedAgentStep: (step: string | null) => void;
  setUserManuallySelectedAgent: (value: boolean) => void;
  setProviderStatuses: (statuses: ProviderStatus[]) => void;
  setActiveDebugTab: (tab: "trace" | "history" | "mock") => void;
  setActiveDebugSubTab: (tab: DebugSubTab) => void;
  setGeneratedMockUsers: (users: MockUserFull[]) => void;
  setGeneratedMockPois: (pois: MockPoi[]) => void;
  setGeneratedMockLocations: (locations: MockLocation[]) => void;
  applyGeneratedUser: (user: MockUserFull) => void;
  updateAppliedUser: (userId: string, updates: Partial<MockUserFull>) => void;
  applyGeneratedPoi: (poi: MockPoi) => void;
  applyMockLocation: (location: MockLocation) => void;
  clearAppliedMock: () => void;
  appendFlowBlock: (block: FlowBlock) => void;
  clearFlowBlocks: () => void;
  incrementRefinementCount: () => void;
  resetRefinementCount: () => void;
  setMockBoardTab: (tab: "user" | "location" | "pois" | "history" | "json") => void;
  setMockBoardExpanded: (expanded: boolean) => void;
  /** 设置 pendingReplayTrace，触发 MobileShell 执行渐进式回放 */
  startMockHistoryReplay: (trace: AgentTrace) => void;
  /** 清除 pendingReplayTrace（MobileShell 消费后调用） */
  clearPendingReplayTrace: () => void;
  /** 追加 LLM 流式 token 到指定 purpose */
  appendLlmChunk: (purpose: string, content: string, finished: boolean) => void;
  /** 清空 LLM 流式文本 */
  clearLlmStreamingText: () => void;
};

export const useDemoStore = create<DemoState>((set) => ({
  activeUserId: "",
  activeView: "home",
  mobileView: "entry",
  inputMode: "text",
  selectedPlanId: undefined,
  selectedTransportMode: "taxi",
  expandedStopId: undefined,
  highlightedStopId: undefined,
  completedTodoIds: [],
  selectedTraceEventId: undefined,
  activeTrace: undefined,
  currentRoutePlans: [],
  requireRequirementConfirmation: true,
  preferenceDetectionEnabled: true,
  dataAuthorizationEnabled: true,
  userPreferences: [],
  introCollapsed: false,
  activeAgentStep: null,
  selectedAgentStep: null,
  userManuallySelectedAgent: false,
  providerStatuses: [
    { name: "amap", label: "高德地图", shortLabel: "地图", status: "connected" },
    { name: "caiyun", label: "彩云天气", shortLabel: "天气", status: "connected" },
    { name: "longcat", label: "LongCat LLM", shortLabel: "LLM", status: "connected" }
  ],
  activeDebugTab: "trace",
  activeDebugSubTab: "summary",
  generatedMockUsers: [],
  generatedMockPois: [],
  generatedMockLocations: [],
  appliedMockUsers: [],
  appliedMockPois: [],
  activeMockLocation: undefined,
  flowBlocks: [],
  refinementCount: 0,
  pendingReplayTrace: null,
  mockBoardTab: "user",
  mockBoardExpanded: false,
  llmStreamingText: {},
  setActiveUserId: (activeUserId) => set({ activeUserId }),
  setActiveView: (activeView) => set({ activeView }),
  setMobileView: (mobileView) => set({ mobileView }),
  setInputMode: (inputMode) => set({ inputMode }),
  setSelectedPlanId: (selectedPlanId) => set({ selectedPlanId }),
  setSelectedTransportMode: (selectedTransportMode) => set({ selectedTransportMode }),
  setExpandedStopId: (expandedStopId) => set({ expandedStopId }),
  setHighlightedStopId: (highlightedStopId) => set({ highlightedStopId }),
  toggleTodo: (todoId) =>
    set((state) => ({
      completedTodoIds: state.completedTodoIds.includes(todoId)
        ? state.completedTodoIds.filter((id) => id !== todoId)
        : [...state.completedTodoIds, todoId]
    })),
  resetMobileDemo: () =>
    set({
      activeView: "home",
      mobileView: "entry",
      inputMode: "text",
      selectedPlanId: undefined,
      selectedTransportMode: "taxi",
      expandedStopId: undefined,
      highlightedStopId: undefined,
      completedTodoIds: [],
      activeTrace: undefined,
      currentRoutePlans: [],
      selectedTraceEventId: undefined,
      activeAgentStep: null,
      selectedAgentStep: null,
      flowBlocks: [],
      refinementCount: 0,
      llmStreamingText: {}
    }),
  startNewTraceRun: () => {
    clearTraceEventTimer();
    const trace = createTraceSkeleton();
    set({
      activeView: "planning",
      activeTrace: trace,
      selectedTraceEventId: undefined,
      activeAgentStep: null,
      selectedAgentStep: trace.agent_strategy?.[0]?.name ?? null,
      userManuallySelectedAgent: false,
      currentRoutePlans: [],
      selectedPlanId: undefined,
      highlightedStopId: undefined,
      activeDebugTab: "trace",
      activeDebugSubTab: "summary",
      mobileView: "start",
      inputMode: "text",
      completedTodoIds: [],
      expandedStopId: undefined,
      flowBlocks: [],
      refinementCount: 0,
      llmStreamingText: {}
    });
  },
  setSelectedTraceEventId: (selectedTraceEventId) => set({ selectedTraceEventId }),
  setActiveTrace: (activeTrace) => {
    // 清除之前的渐进式渲染定时器
    clearTraceEventTimer();

    if (!activeTrace || !activeTrace.events.length) {
      // 空 trace 或 undefined，直接设置
      set(() => ({
        activeTrace,
        selectedTraceEventId: activeTrace?.events[0]?.id ?? undefined,
        activeAgentStep: null,
        selectedAgentStep: activeTrace?.agent_strategy?.[0]?.name ?? null,
      }));
      return;
    }

    const allEvents = activeTrace.events;

    // 立即设置 trace 元信息，但 events 先为空数组
    const traceShell: AgentTrace = {
      ...activeTrace,
      events: [],
      status: "running",
    };

    set(() => ({
      activeTrace: traceShell,
      selectedTraceEventId: undefined,
      activeAgentStep: null,
      selectedAgentStep: activeTrace.agent_strategy?.[0]?.name ?? null,
    }));

    // 渐进式添加 events（快速播放，保留视觉节奏但不阻塞结果展示）
    let addedCount = 0;
    const BATCH_INTERVAL_MS = 60;

    _traceEventTimerId = setInterval(() => {
      // 每次添加 2-4 个 events，快速走完
      const batchSize = Math.min(allEvents.length - addedCount, Math.random() < 0.5 ? 2 : 4);
      if (batchSize <= 0) {
        // 全部添加完成
        clearTraceEventTimer();
        // 确保最终状态与一次性设置一致
        set((state) => ({
          activeTrace: state.activeTrace
            ? { ...state.activeTrace, events: allEvents, status: activeTrace.status }
            : activeTrace,
        }));
        return;
      }

      addedCount += batchSize;
      const currentEvents = allEvents.slice(0, addedCount);

      // 找最后一个有 agent 字段的 event；若无则标记为 "system"（Run Lifecycle）
      let activeAgentStep: string | null = null;
      for (let i = currentEvents.length - 1; i >= 0; i--) {
        if (currentEvents[i].agent) {
          activeAgentStep = currentEvents[i].agent!;
          break;
        }
      }
      // 如果最后的事件是 run_started/run_completed 等无 agent 字段的生命周期事件，标记为 system
      if (!activeAgentStep && currentEvents.length > 0) {
        const lastEvent = currentEvents[currentEvents.length - 1];
        if (!lastEvent.agent) {
          activeAgentStep = "system";
        }
      }

      const latestEvent = currentEvents[currentEvents.length - 1];
      const isComplete = addedCount >= allEvents.length;

      set((state) => ({
        activeTrace: state.activeTrace
          ? {
              ...state.activeTrace,
              events: currentEvents,
              status: isComplete ? activeTrace.status : "running",
            }
          : activeTrace,
        selectedTraceEventId: latestEvent?.id,
        activeAgentStep,
      }));
    }, BATCH_INTERVAL_MS);
  },
  setActiveTraceMeta: (trace) => {
    // SSE 模式：清除渐进式定时器，设置 trace 元信息
    clearTraceEventTimer();
    set(() => ({
      activeTrace: { ...trace, events: [], status: "running" },
      selectedTraceEventId: undefined,
      activeAgentStep: null,
      selectedAgentStep: trace.agent_strategy?.[0]?.name ?? null,
      userManuallySelectedAgent: false,
    }));
  },
  appendTraceEvent: (event) => {
    // SSE 模式：追加单个 event
    set((state) => {
      const currentEvents = state.activeTrace?.events ?? [];
      const newEvents = [...currentEvents, event];

      // 找最后一个有 agent 字段的 event
      let activeAgentStep: string | null = null;
      for (let i = newEvents.length - 1; i >= 0; i--) {
        if (newEvents[i].agent) {
          activeAgentStep = newEvents[i].agent!;
          break;
        }
      }

      // 用户手动选中 Agent 后，不自动覆盖 selectedAgentStep 和 selectedTraceEventId
      const manual = state.userManuallySelectedAgent;

      return {
        activeTrace: state.activeTrace
          ? { ...state.activeTrace, events: newEvents }
          : undefined,
        selectedTraceEventId: manual ? state.selectedTraceEventId : event.id,
        activeAgentStep,
        selectedAgentStep: manual ? state.selectedAgentStep : (event.agent ?? state.selectedAgentStep),
      };
    });
  },
  finalizeActiveTrace: (trace) => {
    // SSE 模式：设置最终 trace 状态
    set((state) => ({
      activeTrace: state.activeTrace
        ? { ...state.activeTrace, events: trace.events, status: trace.status }
        : trace,
    }));
  },
  setCurrentRoutePlans: (currentRoutePlans) => set({ currentRoutePlans }),
  setRequireRequirementConfirmation: (requireRequirementConfirmation) => set({ requireRequirementConfirmation }),
  setPreferenceDetectionEnabled: (preferenceDetectionEnabled) => set({ preferenceDetectionEnabled }),
  setDataAuthorizationEnabled: (dataAuthorizationEnabled) => set({ dataAuthorizationEnabled }),
  setUserPreferences: (userPreferences) => set({ userPreferences }),
  removeUserPreference: (preferenceId) =>
    set((state) => ({
      userPreferences: state.userPreferences.filter((preference) => preference.id !== preferenceId)
    })),
  updateUserPreference: (preferenceId, label) =>
    set((state) => ({
      userPreferences: state.userPreferences.map((preference) =>
        preference.id === preferenceId ? { ...preference, label } : preference
      )
    })),
  setIntroCollapsed: (introCollapsed) => set({ introCollapsed }),
  setActiveAgentStep: (activeAgentStep) => set({ activeAgentStep }),
  setSelectedAgentStep: (selectedAgentStep) => set({ selectedAgentStep }),
  setUserManuallySelectedAgent: (userManuallySelectedAgent) => set({ userManuallySelectedAgent }),
  setProviderStatuses: (providerStatuses) => set({ providerStatuses }),
  setActiveDebugTab: (activeDebugTab) => set({ activeDebugTab }),
  setActiveDebugSubTab: (activeDebugSubTab) => set({ activeDebugSubTab }),
  setGeneratedMockUsers: (generatedMockUsers) => set({ generatedMockUsers }),
  setGeneratedMockPois: (generatedMockPois) => set({ generatedMockPois }),
  setGeneratedMockLocations: (generatedMockLocations) => set({ generatedMockLocations }),
  applyGeneratedUser: (user) =>
    set((state) => {
      if (state.appliedMockUsers.some((item) => item.id === user.id)) {
        return state;
      }
      const updated = [...state.appliedMockUsers, user];
      // 同步注入后端覆盖层
      _syncAppliedUsersToBackend(updated);
      return { appliedMockUsers: updated, activeUserId: user.id };
    }),
  updateAppliedUser: (userId, updates) =>
    set((state) => {
      const updated = state.appliedMockUsers.map((user) =>
        user.id === userId ? { ...user, ...updates } : user
      );
      _syncAppliedUsersToBackend(updated);
      return { appliedMockUsers: updated };
    }),
  applyGeneratedPoi: (poi) =>
    set((state) => {
      if (state.appliedMockPois.some((item) => item.id === poi.id)) {
        return state;
      }
      const updated = [...state.appliedMockPois, poi];
      _syncAppliedPoisToBackend(updated);
      return { appliedMockPois: updated };
    }),
  applyMockLocation: (activeMockLocation) => set({ activeMockLocation }),
  clearAppliedMock: () => {
    set({ appliedMockUsers: [], appliedMockPois: [], activeMockLocation: undefined, activeUserId: "" });
    _syncAppliedUsersToBackend([]);
    _syncAppliedPoisToBackend([]);
  },
  appendFlowBlock: (block) =>
    set((state) => {
      if (state.flowBlocks.some((b) => b.id === block.id)) {
        return state;
      }
      return { flowBlocks: [...state.flowBlocks, block] };
    }),
  clearFlowBlocks: () => set({ flowBlocks: [] }),
  incrementRefinementCount: () =>
    set((state) => ({ refinementCount: state.refinementCount + 1 })),
  resetRefinementCount: () => set({ refinementCount: 0 }),
  setMockBoardTab: (mockBoardTab) => set({ mockBoardTab }),
  setMockBoardExpanded: (mockBoardExpanded) => set({ mockBoardExpanded }),
  startMockHistoryReplay: (trace) => set({ pendingReplayTrace: trace }),
  clearPendingReplayTrace: () => set({ pendingReplayTrace: null }),
  appendLlmChunk: (purpose, content, finished) =>
    set((state) => {
      const current = state.llmStreamingText[purpose] ?? "";
      const updated = { ...state.llmStreamingText, [purpose]: current + content };
      if (finished) {
        // 完成时不需要额外操作，保留累积文本
      }
      return { llmStreamingText: updated };
    }),
  clearLlmStreamingText: () => set({ llmStreamingText: {} }),
}));
