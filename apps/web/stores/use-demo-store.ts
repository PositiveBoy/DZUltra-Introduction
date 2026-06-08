import { create } from "zustand";
import type {
  AgentTrace,
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

type DemoView = "home" | "planning" | "result" | "refine";

export type ProviderStatus = {
  name: string;
  label: string;
  shortLabel: string;
  status: "connected" | "mock" | "timeout";
  lastDegradedReason?: string;
};

type DebugSubTab = "summary" | "candidates" | "ranking" | "map" | "json";

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
  setProviderStatuses: (statuses: ProviderStatus[]) => void;
  setActiveDebugTab: (tab: "trace" | "history" | "mock") => void;
  setActiveDebugSubTab: (tab: DebugSubTab) => void;
  setGeneratedMockUsers: (users: MockUserFull[]) => void;
  setGeneratedMockPois: (pois: MockPoi[]) => void;
  setGeneratedMockLocations: (locations: MockLocation[]) => void;
  applyGeneratedUser: (user: MockUserFull) => void;
  applyGeneratedPoi: (poi: MockPoi) => void;
  applyMockLocation: (location: MockLocation) => void;
  clearAppliedMock: () => void;
  appendFlowBlock: (block: FlowBlock) => void;
  clearFlowBlocks: () => void;
  incrementRefinementCount: () => void;
  resetRefinementCount: () => void;
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
      flowBlocks: [],
      refinementCount: 0
    }),
  startNewTraceRun: () => {
    clearTraceEventTimer();
    set({
      activeView: "home",
      activeTrace: undefined,
      selectedTraceEventId: undefined,
      activeAgentStep: null,
      currentRoutePlans: [],
      selectedPlanId: undefined,
      highlightedStopId: undefined,
      activeDebugTab: "trace",
      activeDebugSubTab: "summary",
      mobileView: "entry",
      inputMode: "text",
      completedTodoIds: [],
      expandedStopId: undefined,
      flowBlocks: [],
      refinementCount: 0
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

      // 找最后一个有 agent 字段的 event
      let activeAgentStep: string | null = null;
      for (let i = currentEvents.length - 1; i >= 0; i--) {
        if (currentEvents[i].agent) {
          activeAgentStep = currentEvents[i].agent!;
          break;
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

      return {
        activeTrace: state.activeTrace
          ? { ...state.activeTrace, events: newEvents }
          : undefined,
        selectedTraceEventId: event.id,
        activeAgentStep,
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
      return { appliedMockUsers: [...state.appliedMockUsers, user], activeUserId: user.id };
    }),
  applyGeneratedPoi: (poi) =>
    set((state) => {
      if (state.appliedMockPois.some((item) => item.id === poi.id)) {
        return state;
      }
      return { appliedMockPois: [...state.appliedMockPois, poi] };
    }),
  applyMockLocation: (activeMockLocation) => set({ activeMockLocation }),
  clearAppliedMock: () => set({ appliedMockUsers: [], appliedMockPois: [], activeMockLocation: undefined, activeUserId: "" }),
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
}));
