import { create } from "zustand";
import type { AgentTrace, DemoRoutePlan, InputMode, MobileShellView, TransportMode, UserPreference } from "@/types/dzultra";

type DemoView = "home" | "planning" | "result" | "refine";

export type ProviderStatus = {
  name: string;
  label: string;
  status: "connected" | "mock" | "timeout";
  lastDegradedReason?: string;
};

type DemoState = {
  activeUserId: string;
  activeView: DemoView;
  mobileView: MobileShellView;
  inputMode: InputMode;
  selectedPlanId: string;
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
  setActiveUserId: (userId: string) => void;
  setActiveView: (view: DemoView) => void;
  setMobileView: (view: MobileShellView) => void;
  setInputMode: (mode: InputMode) => void;
  setSelectedPlanId: (planId: string) => void;
  setSelectedTransportMode: (mode: TransportMode) => void;
  setExpandedStopId: (stopId?: string) => void;
  setHighlightedStopId: (stopId?: string) => void;
  toggleTodo: (todoId: string) => void;
  resetMobileDemo: () => void;
  setSelectedTraceEventId: (eventId?: string) => void;
  setActiveTrace: (trace?: AgentTrace) => void;
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
};

export const useDemoStore = create<DemoState>((set) => ({
  activeUserId: "user-date-001",
  activeView: "home",
  mobileView: "entry",
  inputMode: "text",
  selectedPlanId: "",
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
  userPreferences: [
    { id: "pref-low-queue", label: "低排队", source: "历史路线与本轮对话" },
    { id: "pref-date-vibe", label: "约会氛围", source: "默认 mock 用户画像" },
    { id: "pref-walkable", label: "步行友好", source: "历史选择" },
    { id: "pref-photo", label: "可拍照", source: "用户显式提到" }
  ],
  introCollapsed: false,
  activeAgentStep: null,
  providerStatuses: [],
  activeDebugTab: "trace",
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
      mobileView: "entry",
      inputMode: "text",
      selectedPlanId: "",
      selectedTransportMode: "taxi",
      expandedStopId: undefined,
      highlightedStopId: undefined,
      completedTodoIds: [],
      activeTrace: undefined,
      currentRoutePlans: [],
      selectedTraceEventId: undefined,
      activeAgentStep: null,
      providerStatuses: []
    }),
  setSelectedTraceEventId: (selectedTraceEventId) => set({ selectedTraceEventId }),
  setActiveTrace: (activeTrace) => {
    // 从 trace events 推导当前活跃的 Agent 步骤
    let activeAgentStep: string | null = null;
    if (activeTrace?.events.length) {
      const events = activeTrace.events;
      // 找最后一个有 agent 字段的事件
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].agent) {
          activeAgentStep = events[i].agent!;
          break;
        }
      }
    }
    set((state) => ({
      activeTrace,
      selectedTraceEventId: activeTrace?.events[0]?.id ?? state.selectedTraceEventId,
      activeAgentStep,
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
}));
