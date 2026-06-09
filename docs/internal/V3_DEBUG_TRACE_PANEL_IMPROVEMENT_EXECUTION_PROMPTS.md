# DZUltra Debug Trace 面板改进执行提示词拆分

更新时间：2026-06-08

本文是 `docs/internal/V3_DEBUG_TRACE_PANEL_IMPROVEMENT_ROADMAP.md` 的执行提示词拆分版。用途是让多个新窗口可以直接复制对应提示词开始推进。

建议按波次推进，每个波次完成并验证后，再进入下一波。

## 总体协作规则

所有 Agent 都必须先读：

- `AGENTS.md`
- `README.md`
- `docs/internal/V3_DEBUG_TRACE_PANEL_IMPROVEMENT_ROADMAP.md`
- `docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md`
- 本文档中自己负责的提示词

所有 Agent 都必须遵守：

- 不删除 Mock fallback。
- 不让 LLM 猜距离、坐标、营业状态、排队、天气和通勤事实。
- 真实 provider 失败时允许 fallback，但必须写入 Trace。
- 不回滚其他窗口或用户已有改动。
- 修改前先看相关代码，沿用现有 schema 和风格。
- 后端命令优先使用 `conda run -n agent ...`。

## 关键背景：前端 Agent 动画是假跑

所有 Agent 在开始前必须理解这个事实：

**SSE 流式返回已经实现，但有两个断点：**

1. **`submitSearchQuestion` 没用 SSE**：搜索框提交用的是 `interactionMutation.mutate()`（普通 mutation），不走 SSE。只有 `submitPrompt`、`confirmClarification`、`confirmSummary`、`quickRefine` 走 SSE。

2. **RunningView 仍然是假动画**：即使 SSE 逐步推送了 trace events，RunningView 仍用 `setInterval(820ms)` 做假动画，不消费 `activeAgentStep` 和 `activeTrace.events`。

SSE 基础设施已完整：
- 后端 SSE 端点：`/interactions/respond/stream`（`apps/api/app/routers/interactions.py`）
- 前端 SSE client：`interactRespondStream()`（`apps/web/lib/api.ts`）
- Store SSE 方法：`setActiveTraceMeta`、`appendTraceEvent`、`finalizeActiveTrace`（`apps/web/stores/use-demo-store.ts`）
- `startInteractionRequest` 已用 SSE（`apps/web/components/mobile-shell.tsx`）

但后端 SSE 仍是"先跑完再推送"，不是真正的逐 Agent 流式。这是 P2-1 的内容。

**改进目标：让所有提交入口都走 SSE，让 RunningView 消费 SSE 数据，消除假动画。**

## 推荐波次

### 第一波：数据流修复

1. Agent A：submitSearchQuestion 改用 SSE。
2. Agent B：RunningView 消费 SSE 数据，不再做假动画。
3. Agent C：统一顶端指示灯与底部 Agent Flow。

Agent A 改动最小（一行代码），可以先完成。Agent B 和 C 强相关，最好 B 先出 RunningView 改动，C 再接。

### 第二波：展示逻辑修复

可以并行：

1. Agent D：右侧详情区按 Agent 过滤展示内容。
2. Agent E：修复默认子 Tab 跳转逻辑。

Agent E 改动较小，可以先完成。

### 第三波：交互联动

建议按顺序：

1. Agent F：点击 Agent Flow 块触发联动跳转。

### 第四波：体验深化

可以并行：

1. Agent G：摘要 Tab 按 Agent 差异化展示。
2. Agent H：指标卡片按 Agent 上下文更新。
3. Agent I：Agent Flow 块增加状态指示。

---

## Agent A 提示词：submitSearchQuestion 改用 SSE

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_DEBUG_TRACE_PANEL_IMPROVEMENT_ROADMAP.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md。

你的任务是完成 P0-1a：submitSearchQuestion 改用 SSE。

背景：
- SSE 流式返回已经实现。后端有 /interactions/respond/stream 端点，前端有 interactRespondStream() client，store 有 setActiveTraceMeta、appendTraceEvent、finalizeActiveTrace 方法。
- startInteractionRequest 已经用了 SSE，它调用 interactRespondStream，SSE 失败时 fallback 到 interactionMutation.mutate()。
- 但 submitSearchQuestion 仍然用 interactionMutation.mutate()，不走 SSE。
- 这导致搜索框提交时 trace 一次性返回，Debug Trace 不会逐步亮起。

目标：
让 submitSearchQuestion 也走 SSE，与 submitPrompt 等入口统一。

重点文件：
- apps/web/components/mobile-shell.tsx

具体要求：
1. 把 submitSearchQuestion 中的 interactionMutation.mutate({...}) 改为 startInteractionRequest(goal, { plan_mode: routePlanningEnabled })。
2. startInteractionRequest 已经包含了 setMobileView("running")、setActiveTrace(undefined)、setSelectedTraceEventId(undefined) 等初始化逻辑，所以 submitSearchQuestion 中重复的初始化代码可以移除。
3. 注意保留 submitSearchQuestion 中 startInteractionRequest 不包含的逻辑，例如 setDirectAnswer、setApiNotice。
4. 确保 SSE 失败时自动 fallback 到普通 mutation（startInteractionRequest 已内置此逻辑）。

验收：
- 搜索框提交后，Debug Trace 右侧 Agent Flow 逐步亮起（SSE 逐个推送 trace events）。
- 搜索框提交后，AgentStatusBar 指示灯逐步亮起。
- SSE 失败时自动 fallback 到普通 mutation，不中断用户流程。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent B 提示词：RunningView 消费 SSE 数据，不再做假动画

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_DEBUG_TRACE_PANEL_IMPROVEMENT_ROADMAP.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md。

你的任务是完成 P0-1b：RunningView 消费 SSE 数据，不再做假动画。

背景：
- SSE 流式返回已经实现。store 的 appendTraceEvent 会更新 activeAgentStep。
- 但 RunningView 仍然用 setInterval(820ms) 做假动画（mobile-shell.tsx 第 2862 行），不读取 activeAgentStep 和 activeTrace.events。
- SSE 已经把真实 Agent 进度推到前端了，但 RunningView 不消费。

目标：
RunningView 响应 activeAgentStep，展示真实 Agent 进度，不再做假动画。

重点文件：
- apps/web/components/mobile-shell.tsx（RunningView 组件）
- apps/web/stores/use-demo-store.ts（确保 activeAgentStep 正确更新）

具体要求：
1. RunningView 接收 activeAgentStep 作为 prop（从 store 读取）。
2. activeStep 不再用 setInterval 递增，而是根据 activeAgentStep 在 steps 数组中的位置计算。
3. 当 activeAgentStep 为 null 且 status === "running" 时，展示 loading 态（"正在调用后端..."）。
4. 当 activeAgentStep 有值时，高亮对应的 Agent 步骤。
5. 当 status === "completed" 时，所有步骤标记为 completed。
6. 保留打字机效果（typedPrompt），这是纯展示层面的，与 Agent 进度无关。
7. 移除 setInterval(820ms) 假动画逻辑。

验收：
- SSE 逐步推送时，RunningView 跟随 activeAgentStep 高亮当前 Agent。
- API 请求期间（activeAgentStep 为 null），展示 loading 态。
- 不再有 setInterval(820ms) 假动画。
- SSE 失败 fallback 到普通 mutation 时，RunningView 仍能正确展示（mutation 返回后 activeTrace 一次性设置，activeStep 应跳到最后一步）。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent C 提示词：统一顶端指示灯与底部 Agent Flow

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_DEBUG_TRACE_PANEL_IMPROVEMENT_ROADMAP.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md。

你的任务是完成 P0-5：统一顶端指示灯与底部 Agent Flow。

背景：
- 顶端 AgentStatusBar 展示 7 个 Agent 步骤，基于 activeTrace.events 判断状态。
- 底部 mobile-shell 的 RunningView 也展示 7 个 Agent 步骤，但之前用 setInterval(820ms) 做假动画。
- P0-1b 已将 RunningView 改为消费 activeAgentStep，消除了假动画。
- 但顶端和底部的数据源仍不完全一致：顶端从 activeTrace.events 推导，底部从 activeAgentStep 推导。
- 两者没有联动：点击顶端的 Agent 不影响底部，反之亦然。

目标：
让顶端和底部共享同一个数据源，状态一致，消除歧义。

重点文件：
- apps/web/components/agent-status-bar.tsx
- apps/web/components/mobile-shell.tsx（RunningView 组件）
- apps/web/stores/use-demo-store.ts

具体要求：
1. 顶端 AgentStatusBar 和底部 RunningView 都从同一个 store 字段（activeAgentStep + activeTrace.events）推导 Agent 状态。
2. 顶端点击某个 Agent 时，底部 RunningView 也高亮该 Agent（通过 setActiveAgentStep）。
3. 底部 RunningView 点击某个 Agent 时，顶端 AgentStatusBar 也高亮该 Agent。
4. API 请求期间（activeTrace 为 undefined），顶端和底部都展示 loading 态，不展示 Agent 步骤。
5. trace 逐步返回时，顶端和底部同步展示当前 Agent。
6. 保留 RunningView 的打字机效果（typedPrompt）。

验收：
- API 请求期间，顶端和底部都展示 loading。
- trace 逐步返回时，顶端和底部同步展示当前 Agent。
- 顶端和底部的 Agent 名称、状态一致。
- 点击顶端的 Agent，底部也高亮。
- 点击底部的 Agent，顶端也高亮。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent D 提示词：右侧详情区按 Agent 过滤展示内容

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_DEBUG_TRACE_PANEL_IMPROVEMENT_ROADMAP.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md。

你的任务是完成 P0-2：右侧详情区按 Agent 过滤展示内容。

背景：
- 当前所有 Agent 都展示相同的 5 个子 Tab（摘要、候选池、排序、地图、JSON）。
- 内容与 Agent 无关，选中 InteractionRouterAgent 时也展示候选池和排序，但这些数据与分流无关。
- 用户最想看的是当前 Agent 在做什么、输入是什么、输出是什么。

目标：
根据当前选中的 Agent，只展示与该 Agent 相关的子 Tab 和内容块。

重点文件：
- apps/web/components/debug-trace-panel.tsx
- apps/web/types/dzultra.ts

Agent → 子 Tab 映射：
- Run Lifecycle: 摘要 + JSON
- InteractionRouterAgent: 摘要 + JSON
- ConstraintDiscoveryAgent: 摘要 + JSON
- UserPreferenceAgent: 摘要 + JSON
- ContextGroundingAgent: 摘要 + 候选池 + 地图 + JSON
- PlanSolverAgent: 摘要 + 候选池 + JSON
- PlanEvaluatorAgent: 摘要 + 候选池 + 排序 + JSON
- PlanExplanationAgent: 摘要 + 排序 + JSON

具体要求：
1. 新增 getRelevantSubTabs(agentName: string | undefined, isChatRun: boolean): SubTab[] 函数，返回当前 Agent 相关的子 Tab 列表。
2. 子 Tab 栏只渲染当前 Agent 相关的 Tab。摘要 Tab 始终展示。
3. 如果当前选中的 subTab 不在相关列表中，自动切到摘要。
4. 切换 Agent 时，重新计算相关子 Tab，必要时自动切到摘要。
5. 普通问答链路（isChatRun）时，排序和地图 Tab 始终不展示。
6. JSON Tab 始终展示，方便开发者查看完整数据。

验收：
- 选中 InteractionRouterAgent 时，不展示候选池、排序、地图 Tab。
- 选中 ContextGroundingAgent 时，展示候选池和地图 Tab。
- 选中 PlanEvaluatorAgent 时，展示候选池和排序 Tab。
- 切换 Agent 时，如果当前 subTab 不相关，自动切到摘要。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent E 提示词：修复默认子 Tab 跳转逻辑

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_DEBUG_TRACE_PANEL_IMPROVEMENT_ROADMAP.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md。

你的任务是完成 P0-3：修复默认子 Tab 跳转逻辑。

背景：
- 当前 pickSubTabForMobileView() 在 mobileView === "clarifying" 且非 chat run 时返回 "candidates"。
- Agent Run 期间 mobileView 会经过 running → clarifying → summary → plans，进入 clarifying 时 subTab 被自动切到 candidates。
- 用户感觉"每次都跳到候选池"，但实际上最想看的是 Agent 在做什么（摘要）。

目标：
默认子 Tab 始终是摘要，除非用户主动点击切换。自动联动只发生在明确的场景下。

重点文件：
- apps/web/components/debug-trace-panel.tsx

具体要求：
1. 修改 pickSubTabForMobileView()，只在 mobileView === "plans" 时自动切到排序，其他场景不自动切换。
2. 移除 clarifying → candidates 的自动切换。
3. 新增 userManuallySelectedSubTab 标记（可以用 useRef 或 useState），当用户手动点击 subTab 时设为 true。
4. 当 userManuallySelectedSubTab 为 true 时，pickSubTabForMobileView 不再自动切换，除非 mobileView 发生重大变化（如从 running 切到 plans）。
5. startNewTraceRun 时重置 userManuallySelectedSubTab 为 false。

验收：
- Agent Run 期间，subTab 始终停留在摘要，不自动跳到候选池。
- 进入方案页后，subTab 自动切到排序（除非用户已手动选择过其他 Tab）。
- 用户手动点击其他 subTab 后，不会被自动联动覆盖。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent F 提示词：点击 Agent Flow 块触发联动跳转

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_DEBUG_TRACE_PANEL_IMPROVEMENT_ROADMAP.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md。

你的任务是完成 P0-4：点击 Agent Flow 块触发联动跳转。

背景：
- 当前点击左边 Agent Flow 块只调用 setSelectedTraceEventId()，不触发 mobile-shell 页面跳转和 Debug Trace subTab 切换。
- 用户期望点击某个 Agent 后，左侧 mobile-shell 能跳到对应页面，右侧 Debug Trace 能展示该 Agent 最相关的子 Tab。

目标：
点击 Agent Flow 块时，mobile-shell 页面和 Debug Trace subTab 联动跳转。

重点文件：
- apps/web/components/debug-trace-panel.tsx
- apps/web/stores/use-demo-store.ts

Agent → mobileView 映射：
- Run Lifecycle: 不切换
- InteractionRouterAgent: running
- ConstraintDiscoveryAgent: clarifying
- UserPreferenceAgent: running
- ContextGroundingAgent: running
- PlanSolverAgent: running
- PlanEvaluatorAgent: plans
- PlanExplanationAgent: plans

Agent → subTab 映射：
- Run Lifecycle: summary
- InteractionRouterAgent: summary
- ConstraintDiscoveryAgent: summary
- UserPreferenceAgent: summary
- ContextGroundingAgent: candidates
- PlanSolverAgent: candidates
- PlanEvaluatorAgent: ranking
- PlanExplanationAgent: summary

具体要求：
1. 在 AgentEventGroup 的点击事件中，除了 setSelectedTraceEventId，还调用 setMobileView 和 setActiveDebugSubTab。
2. 新增 getMobileViewForAgent(agentName: string, currentView: MobileShellView): MobileShellView | null 函数，返回 null 表示不切换。
3. 新增 getSubTabForAgent(agentName: string): SubTab 函数。
4. 只有当 trace 已完成（activeTrace.status === "completed"）时才触发 mobileView 跳转。trace 还在 running 时不跳转，避免打断当前流程。
5. subTab 跳转不受 trace 状态限制，任何时候点击都可以切换。
6. 注意：如果 P0-2（按 Agent 过滤展示内容）已完成，subTab 跳转要检查目标 subTab 是否在当前 Agent 的相关列表中。如果不在，降级到摘要。

验收：
- 点击 InteractionRouterAgent 块 → mobileView 切到 running，subTab 切到 summary。
- 点击 ContextGroundingAgent 块 → subTab 切到 candidates。
- 点击 PlanEvaluatorAgent 块 → mobileView 切到 plans，subTab 切到 ranking。
- 点击 Run Lifecycle 块 → 不切换 mobileView，subTab 切到 summary。
- trace 还在 running 时点击，不触发 mobileView 跳转，但 subTab 可以切换。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent G 提示词：摘要 Tab 按 Agent 差异化展示

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_DEBUG_TRACE_PANEL_IMPROVEMENT_ROADMAP.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md。

你的任务是完成 P1-1：摘要 Tab 按 Agent 差异化展示。

背景：
- 当前摘要 Tab 对所有 Agent 展示相同的通用模板（事件类型、Agent、摘要、Handoff、Token）。
- 用户最想看的是当前 Agent 的核心输入/输出/决策，而不是通用字段。

目标：
摘要 Tab 根据当前 Agent 展示该 Agent 最核心的信息。

重点文件：
- apps/web/components/debug-trace-panel.tsx

每个 Agent 的摘要模板：

InteractionRouterAgent：
- 分流结果：interaction_type + routing_reason
- 置信度：confidence
- 分流来源：deterministic_router / longcat
- Schema 校验结果
- Fallback 原因（如有）

ConstraintDiscoveryAgent：
- 需求摘要：城市、时间窗、人数、是否安排吃喝
- 约束账本草稿：硬约束、软约束
- 补全卡片：缺失字段和追问
- Grounding 请求列表

UserPreferenceAgent：
- 偏好来源列表
- preference_warmup_pending 状态
- 非阻塞说明

ContextGroundingAgent：
- POI 搜索结果摘要：accepted / rejected 数量
- 天气约束
- 地图距离 provider
- 深度字段 Mock 标记

PlanSolverAgent：
- 候选路线数量
- Slot 分配逻辑
- 过滤掉的不可行路线
- solver_notes

PlanEvaluatorAgent：
- 评分拆解
- 淘汰理由
- 硬约束违反

PlanExplanationAgent：
- LLM 解释草稿预览
- Guardrail 检查结果

具体要求：
1. 新增 AgentSummaryView 组件，根据 selected.agent 渲染不同的摘要模板。
2. 保留通用的"输入/处理/输出"三栏作为 fallback（当 agent 为空或未知时）。
3. 每个 Agent 的摘要模板从 selected event 的 input/output/tool_input/tool_output/metadata 中提取数据。
4. 数据提取要健壮：字段缺失时展示"未提供"或跳过，不要崩溃。

验收：
- 选中 InteractionRouterAgent 时，摘要展示分流结果、置信度、分流来源。
- 选中 ConstraintDiscoveryAgent 时，摘要展示需求摘要、约束账本、补全卡片。
- 选中 ContextGroundingAgent 时，摘要展示 POI 搜索结果、天气、地图 provider。
- 选中 PlanEvaluatorAgent 时，摘要展示评分拆解、淘汰理由。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent H 提示词：指标卡片按 Agent 上下文更新

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_DEBUG_TRACE_PANEL_IMPROVEMENT_ROADMAP.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md。

你的任务是完成 P1-2：指标卡片按 Agent 上下文更新。

背景：
- 当前顶部 4 个指标卡片（总耗时、Tool 调用、方案数、地图 Provider）展示的是整个 Run 的汇总值。
- 这些值在 trace 返回后就不变了，与当前选中的 Agent 无关。
- 用户更想看到当前 Agent 的耗时、Tool 调用数、token 用量等。

目标：
指标卡片随当前选中的 Agent 更新，展示该 Agent 相关的指标。

重点文件：
- apps/web/components/debug-trace-panel.tsx

具体要求：
1. 选中 Run Lifecycle 或没有选中 Agent 时，展示 Run 级指标（与当前一致）。
2. 选中某个 Agent 时，4 个指标卡片改为展示：
   - 该 Agent 的耗时（从该 Agent 分组的 events 累计 durationMs）
   - 该 Agent 的 Tool 调用数
   - 该 Agent 的 Token 用量（如有）
   - 该 Agent 的 Fallback 次数
3. 方案数和地图 Provider 只在 Run 级展示，Agent 级不展示。

验收：
- 选中 Run Lifecycle 时，4 个指标卡片展示 Run 级汇总。
- 选中某个 Agent 时，4 个指标卡片展示该 Agent 的耗时、Tool 调用、Token、Fallback。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent I 提示词：Agent Flow 块增加状态指示

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_DEBUG_TRACE_PANEL_IMPROVEMENT_ROADMAP.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md。

你的任务是完成 P1-3：Agent Flow 块增加状态指示。

背景：
- 当前左边 Agent Flow 的每个块只有"选中/未选中"两种视觉状态。
- 用户无法直观看出哪个 Agent 已完成、哪个正在运行、哪个还没开始。

目标：
左边 Agent Flow 块展示该 Agent 的运行状态（pending / running / completed / failed）。

重点文件：
- apps/web/components/debug-trace-panel.tsx

具体要求：
1. 新增 getAgentGroupStatus(group: AgentEventGroup, activeAgentStep: string | null): "pending" | "running" | "completed" | "failed" 函数。
2. 判断逻辑：
   - 如果 group.events 中有 type === "run_failed" → failed
   - 如果 group.agentName === activeAgentStep → running
   - 如果 group.events 中有已完成事件（route_scored、constraint_checked、chat_answered 等）→ completed
   - 否则 → pending
3. 视觉样式：
   - pending：灰色边框，Agent 编号灰色背景
   - running：蓝色脉冲动画，蓝色边框
   - completed：绿色勾号，正常边框
   - failed：红色边框，错误标记
   - 有 fallback：黄色警告标记（已有，保留）
4. running 状态的脉冲动画用 CSS animation 实现，不要用 JS 定时器。

验收：
- Agent Run 期间，当前正在执行的 Agent 块有蓝色脉冲动画。
- 已完成的 Agent 块有绿色勾号。
- 还没开始的 Agent 块是灰色。
- 有 fallback 的 Agent 块有黄色警告标记。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## 如果只开一个窗口，推荐此窗口继续的任务

建议先做 Agent A（submitSearchQuestion 改用 SSE），因为改动最小且立即生效。

单窗口顺序建议：

```
Agent A → Agent B → Agent C → Agent E → Agent D → Agent F → Agent G → Agent H → Agent I
```

Agent A 改动最小（一行代码），可以立即验证 SSE 效果。Agent B 是关键改动（消除假动画）。Agent C 统一指示灯。Agent E 改动较小（修复默认 Tab）。Agent D 是展示逻辑。Agent F 是交互联动。Agent G-I 是体验深化。
