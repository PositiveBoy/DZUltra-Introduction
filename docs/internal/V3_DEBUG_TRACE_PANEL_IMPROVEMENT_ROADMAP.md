# DZUltra Debug Trace 面板改进规划

更新时间：2026-06-08

本文是 `docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md` 的补充。聚焦 Debug Trace 面板在 Agent Run 期间的用户体验问题，明确根因、改进目标和任务拆分。

## 1. 问题总览

用户在 Agent Run 期间观察到的 7 个核心问题：

| #  | 问题                                              | 严重度 | 根因分类 |
| -- | ----------------------------------------------- | --- | ---- |
| P1 | 前 6 个 Agent 在右边 Debug Trace 毫无反应                | 高   | 数据流  |
| P2 | Run LifeCycle 和 InteractionRouterAgent 应该亮起来但不亮 | 高   | 数据流  |
| P3 | 总耗时、候选池、排序、地图、provider 这些一直不变                   | 中   | 展示逻辑 |
| P4 | 默认子 Tab 总是候选池                                   | 中   | 展示逻辑 |
| P5 | 不同 Agent 不该展示不相关的块（排序、地图、JSON）                  | 高   | 展示逻辑 |
| P6 | 点击左边 Agent Flow 块没有对应跳转                         | 高   | 交互联动 |
| P7 | 顶端指示灯和底部 Agent Flow 关系不清楚                       | 中   | 交互联动 |

## 2. 根因分析

### 2.1 数据流问题（P1、P2）

**核心根因：SSE 已实现但未完全接入，RunningView 仍是假动画。**

这里有三层问题，必须拆开看：

#### 第一层：SSE 流式返回已经实现，但 submitSearchQuestion 没用 SSE

后端 SSE 端点已经实现（[interactions.py:28](file:///Users/mark/Documents/LocalDocument/DZUltra/apps/api/app/routers/interactions.py#L28)）：

```python
@router.post("/respond/stream")
async def stream_interaction_response(request: InteractionRequest, ...) -> StreamingResponse:
    """SSE 流式端点：先完整执行 runner，然后逐个推送 trace events，最后推送完整 response。"""
```

前端 SSE client 已经实现（[api.ts:1299](file:///Users/mark/Documents/LocalDocument/DZUltra/apps/web/lib/api.ts#L1299)）：

```typescript
export function interactRespondStream(payload, callbacks): () => void
```

Store SSE 方法已经实现（[use-demo-store.ts:264](file:///Users/mark/Documents/LocalDocument/DZUltra/apps/web/stores/use-demo-store.ts#L264)）：

```typescript
setActiveTraceMeta(trace)   // SSE 模式：设置 trace 元信息
appendTraceEvent(event)     // SSE 模式：追加单个 event
finalizeActiveTrace(trace)  // SSE 模式：设置最终 trace 状态
```

`startInteractionRequest` 已经用了 SSE（[mobile-shell.tsx:799](file:///Users/mark/Documents/LocalDocument/DZUltra/apps/web/components/mobile-shell.tsx#L799)）：

```typescript
const abort = interactRespondStream(payload, {
  onTraceMeta: (trace) => { setActiveTraceMeta(trace); },
  onTraceEvent: (event) => { appendTraceEvent(event); },
  onResponseComplete: (response) => { finalizeActiveTrace(response.trace); applyInteractionResponse(response, payload); },
  onError: () => { interactionMutation.mutate(payload); }  // SSE 失败 fallback
});
```

**但是 `submitSearchQuestion` 没用 SSE**（[mobile-shell.tsx:855](file:///Users/mark/Documents/LocalDocument/DZUltra/apps/web/components/mobile-shell.tsx#L855)）：

```typescript
function submitSearchQuestion(question: string) {
  // ...
  interactionMutation.mutate({...});  // ← 用的是普通 mutation，不是 SSE！
}
```

这意味着：用户从搜索框提交时，走的是普通 mutation（一次性返回），不会触发 SSE 逐步推送。只有通过 `submitPrompt`、`confirmClarification`、`confirmSummary`、`quickRefine` 提交时，才会走 SSE。

#### 第二层：RunningView 仍然是假动画，不响应 SSE 数据

即使 SSE 逐步推送了 trace events（通过 `appendTraceEvent`），RunningView 仍然用 `setInterval(820ms)` 做假动画（[mobile-shell.tsx:2862](file:///Users/mark/Documents/LocalDocument/DZUltra/apps/web/components/mobile-shell.tsx#L2862)）：

```typescript
const stepTimer = window.setInterval(() => {
  setActiveStep((current) => Math.min(current + 1, steps.length - 1));
}, 820);
```

这个动画：
- **不读取 `activeAgentStep`**。Store 中 `appendTraceEvent` 会更新 `activeAgentStep`，但 RunningView 完全忽略它。
- **不读取 `activeTrace.events`**。SSE 逐步推送的 events 已经在 store 中了，但 RunningView 不消费。
- **与后端真实进度无关**。它只是每 820ms 把 `activeStep + 1`，让 UI 看起来像"Agent 在跑"。

换句话说：SSE 已经把真实 Agent 进度推到前端了，但 RunningView 不消费这些数据，仍然做假动画。

#### 第三层：后端 SSE 仍然是"先跑完再推送"，不是真正的逐 Agent 流式

当前后端 SSE 实现（[interactions.py:44](file:///Users/mark/Documents/LocalDocument/DZUltra/apps/api/app/routers/interactions.py#L44)）：

```python
async def event_generator():
    # 1. 推送 trace 元信息（不含 events）
    yield f"event: trace_meta\ndata: ..."

    # 2. 逐个推送 events
    for event in response.trace.events:
        yield f"event: trace_event\ndata: ..."
        await asyncio.sleep(0.15)  # 模拟逐步推送间隔

    # 3. 推送完整 response
    yield f"event: response_complete\ndata: ..."
```

注意：`response = await asyncio.to_thread(run_interaction_response, enriched_request)` 在 `event_generator` 之前就执行完了。所以 SSE 推送的是"已经跑完的 trace events"，不是"正在跑的 Agent 实时进度"。

这意味着：
- 用户提交后，后端仍然需要先跑完整个 `DeterministicMockRunner.run()`（约 2-5 秒）。
- 跑完后才开始逐个推送 events（每个间隔 0.15 秒）。
- 前端收到第一个 event 的时间 = 后端跑完时间 + SSE 推送延迟。

**所以当前 SSE 的效果是：等待时间不变，但收到后能逐步展示 Agent，而不是一次性全部出现。**

要实现真正的逐 Agent 流式（Agent 跑完一个就推送一个），需要改造后端 runner，让它在每个 Agent 完成后 yield event，而不是跑完整个链路后再推送。这是 P2-1 的内容。

#### 三层叠加的效果

用户看到的完整时间线：

```
t=0s     用户提交（从搜索框 submitSearchQuestion）
t=0-2s   前端 RunningView 开始假动画（setInterval 820ms 逐步亮 Agent）
         右边 Debug Trace：空态（activeTrace = undefined）
         顶端 AgentStatusBar：全部 pending
t=2-5s   前端假动画可能已经跑完 7 个 Agent
         右边 Debug Trace：仍然空态
         顶端 AgentStatusBar：仍然全部 pending
t=5s     后端 API 返回完整 AgentTrace（普通 mutation）
         前端 setActiveTrace() 一次性设置
         右边 Debug Trace：突然出现所有 Agent 分组（全部 completed）
         顶端 AgentStatusBar：全部 completed

---

如果用户从 submitPrompt 提交（走 SSE）：

t=0s     用户提交
t=0-2s   前端 RunningView 开始假动画
         右边 Debug Trace：空态
t=2-5s   前端假动画可能已经跑完
         右边 Debug Trace：仍然空态（后端还在跑）
t=5s     后端跑完，SSE 开始推送 trace_meta
         前端 setActiveTraceMeta()，trace 元信息出现，status = running
         右边 Debug Trace：出现 trace 元信息，但 Agent 分组还没出现
t=5-7s   SSE 逐个推送 trace events（每 0.15 秒一个）
         前端 appendTraceEvent() 逐步添加
         右边 Debug Trace：Agent 分组逐步出现
         顶端 AgentStatusBar：Agent 逐步亮起
         RunningView：仍然在做假动画，与 SSE 数据无关
t=7s     SSE 推送 response_complete
         前端 finalizeActiveTrace()
         RunningView：假动画结束，status 变为 completed
```

**所以用户看到的"前 6 个 Agent 毫无反应"本质是：**
1. **搜索框提交没走 SSE**，走的是普通 mutation，trace 一次性返回。
2. **即使走了 SSE**，RunningView 也不消费 SSE 数据，仍然做假动画。
3. **即使 SSE 逐步推送了**，后端也是先跑完再推送，不是真正的逐 Agent 流式。

#### 解决方向

1. **P0-1a：submitSearchQuestion 改用 SSE**（最小改动，立即生效）：把 `interactionMutation.mutate()` 改为 `startInteractionRequest()`，让搜索框提交也走 SSE。
2. **P0-1b：RunningView 消费 SSE 数据**（关键改动）：让 RunningView 响应 `activeAgentStep`，不再做假动画。
3. **P2-1：后端真正逐 Agent 流式**（终极方案）：改造 runner，让它在每个 Agent 完成后 yield event。

### 2.2 展示逻辑问题（P3、P4、P5）

**P3：指标卡片和子 Tab 内容不变**

- 指标卡片（总耗时、Tool 调用、方案数、地图 Provider）是从完整 trace 的 `visibleEvents` 计算的。
- 子 Tab（候选池、排序、地图、JSON）的数据也是从完整 trace 一次性计算的。
- 在 trace 返回前，这些区域要么是空态，要么是上一次 run 的残留数据。
- trace 返回后，这些区域直接跳到最终状态，没有"随 Agent 推进逐步填充"的过程。

**P4：默认子 Tab 是候选池**

- store 初始值 `activeDebugSubTab: "summary"`，默认确实是摘要。
- 但 `pickSubTabForMobileView()` 在 `mobileView === "clarifying"` 且非 chat run 时返回 `"candidates"`。
- Agent Run 期间 mobileView 会经过 `running → clarifying → summary → plans`，当进入 clarifying 时子 Tab 被自动切到 candidates。
- 用户看到的就是"每次都跳到候选池"。

**P5：不同 Agent 展示不相关块**

- 当前右侧详情区的 5 个子 Tab（摘要、候选池、排序、地图、JSON）对所有 Agent 一视同仁。
- 无论选中哪个 Agent，子 Tab 都是这 5 个，内容也完全一样。
- 没有根据当前 Agent 的职责过滤展示内容的逻辑。

### 2.3 交互联动问题（P6、P7）

**P6：点击左边 Agent Flow 块没有跳转**

- 当前点击 Agent Flow 块只调用 `setSelectedTraceEventId(group.events[0]?.id)`。
- 这只更新了右侧详情区的事件选中态，不会：
  - 切换 mobileView（用户端页面）
  - 切换 debug sub tab
  - 滚动到对应位置

**P7：顶端指示灯和底部 Agent Flow 关系不清楚**

- 顶端 `AgentStatusBar`：7 个 Agent 步骤 + Provider 状态灯 + 耗时进度条。
- 底部 `RunningView`（在 mobile-shell 内）：7 个 Agent 步骤的前端动画。
- 两者数据源不同：
  - 顶端基于 `activeTrace.events`（后端真实数据，但 API 返回前为空）。
  - 底部基于前端 `setInterval` 动画（纯展示，与后端无关）。
- 两者没有联动：点击顶端的 Agent 不会影响底部的动画，反之亦然。
- 用户无法理解"这两个东西为什么同时存在、各自代表什么"。

## 3. 改进目标

### 3.1 总目标

让 Debug Trace 面板在 Agent Run 期间成为"可实时观察 Agent 内部过程"的工具，而不是"等 API 返回后一次性展示最终结果"的静态面板。

### 3.2 具体目标

1. **Agent Run 期间，Debug Trace 右侧能逐步展示每个 Agent 的输入、处理和输出。**
2. **Agent 状态灯在对应时机亮起，而不是全部 pending 或全部 completed。**
3. **右侧详情区根据当前选中的 Agent 展示相关内容，不展示无关块。**
4. **默认子 Tab 是摘要，不自动跳到候选池。**
5. **点击左边 Agent Flow 块时，mobile-shell 页面和 Debug Trace 子 Tab 联动跳转。**
6. **顶端指示灯和底部 Agent Flow 合并为一个统一的进度指示，消除歧义。**

## 4. P0 必须完成任务

### P0-1a submitSearchQuestion 改用 SSE

问题：

`submitSearchQuestion` 用的是 `interactionMutation.mutate()`（普通 mutation），不走 SSE。搜索框提交时 trace 一次性返回，Debug Trace 不会逐步亮起。

而 `startInteractionRequest` 已经用了 SSE（`interactRespondStream`），store 也已经有 `setActiveTraceMeta`、`appendTraceEvent`、`finalizeActiveTrace` 方法。

目标：

让 `submitSearchQuestion` 也走 SSE，与 `submitPrompt` 等入口统一。

建议实现：

把 `submitSearchQuestion` 中的 `interactionMutation.mutate({...})` 改为 `startInteractionRequest(goal, { plan_mode: routePlanningEnabled })`。

注意：`startInteractionRequest` 已经包含了 `setMobileView("running")`、`setActiveTrace(undefined)` 等初始化逻辑，所以 `submitSearchQuestion` 中重复的初始化代码可以移除。

涉及文件：

- `apps/web/components/mobile-shell.tsx`

验收标准：

- 搜索框提交后，Debug Trace 右侧 Agent Flow 逐步亮起（SSE 逐个推送 trace events）。
- 搜索框提交后，AgentStatusBar 指示灯逐步亮起。
- SSE 失败时自动 fallback 到普通 mutation，不中断用户流程。

### P0-1b RunningView 消费 SSE 数据，不再做假动画

问题：

RunningView 用 `setInterval(820ms)` 做假动画，不读取 `activeAgentStep` 和 `activeTrace.events`。SSE 已经把真实 Agent 进度推到前端了，但 RunningView 不消费。

目标：

RunningView 响应 `activeAgentStep`，展示真实 Agent 进度，不再做假动画。

建议实现：

1. RunningView 接收 `activeAgentStep` 作为 prop（从 store 读取）。
2. `activeStep` 不再用 `setInterval` 递增，而是根据 `activeAgentStep` 在 `steps` 数组中的位置计算。
3. 当 `activeAgentStep` 为 null 且 `status === "running"` 时，展示 loading 态（"正在调用后端..."）。
4. 当 `activeAgentStep` 有值时，高亮对应的 Agent 步骤。
5. 当 `status === "completed"` 时，所有步骤标记为 completed。
6. 保留打字机效果（`typedPrompt`），这是纯展示层面的，与 Agent 进度无关。

涉及文件：

- `apps/web/components/mobile-shell.tsx`（RunningView 组件）
- `apps/web/stores/use-demo-store.ts`（确保 activeAgentStep 正确更新）

验收标准：

- SSE 逐步推送时，RunningView 跟随 `activeAgentStep` 高亮当前 Agent。
- API 请求期间（activeAgentStep 为 null），展示 loading 态。
- 不再有 `setInterval(820ms)` 假动画。
- SSE 失败 fallback 到普通 mutation 时，RunningView 仍能正确展示。

### P0-2 右侧详情区按 Agent 过滤展示内容

问题：

当前所有 Agent 都展示相同的 5 个子 Tab，内容与 Agent 无关。

目标：

根据当前选中的 Agent，只展示与该 Agent 相关的子 Tab 和内容块。

建议的 Agent → 子 Tab 映射：

| Agent                    | 摘要 | 候选池 | 排序 | 地图 | JSON |
| ------------------------ | -- | --- | -- | -- | ---- |
| Run Lifecycle            | ✅  | -   | -  | -  | ✅    |
| InteractionRouterAgent   | ✅  | -   | -  | -  | ✅    |
| ConstraintDiscoveryAgent | ✅  | -   | -  | -  | ✅    |
| UserPreferenceAgent      | ✅  | -   | -  | -  | ✅    |
| ContextGroundingAgent    | ✅  | ✅   | -  | ✅  | ✅    |
| PlanSolverAgent          | ✅  | ✅   | -  | -  | ✅    |
| PlanEvaluatorAgent       | ✅  | ✅   | ✅  | -  | ✅    |
| PlanExplanationAgent     | ✅  | -   | ✅  | -  | ✅    |

实现方式：

1. 新增 `getRelevantSubTabs(agentName: string | undefined, isChatRun: boolean): SubTab[]` 函数。
2. 子 Tab 栏只渲染当前 Agent 相关的 Tab。
3. 如果当前选中的 subTab 不在相关列表中，自动切到第一个相关的 Tab。
4. 摘要 Tab 始终展示，但内容根据 Agent 不同而不同。

摘要 Tab 的内容也应按 Agent 差异化：

- **Run Lifecycle**：Run 级元信息（trace\_id、runner\_mode、status、总耗时）。
- **InteractionRouterAgent**：分流结果、routing\_reason、confidence、schema validation。
- **ConstraintDiscoveryAgent**：需求摘要、约束账本草稿、补全卡片、grounding\_requests。
- **UserPreferenceAgent**：偏好来源、偏好列表、preference\_warmup\_pending。
- **ContextGroundingAgent**：POI 搜索结果、天气约束、地图距离、provider 调用详情。
- **PlanSolverAgent**：候选路线生成过程、solver\_notes、slot 分配。
- **PlanEvaluatorAgent**：评分拆解、淘汰理由、硬约束违反。
- **PlanExplanationAgent**：LLM 解释草稿、guardrail、引用事实检查。

涉及文件：

- `apps/web/components/debug-trace-panel.tsx`
- `apps/web/types/dzultra.ts`

验收标准：

- 选中 InteractionRouterAgent 时，不展示候选池、排序、地图 Tab。
- 选中 ContextGroundingAgent 时，展示候选池和地图 Tab。
- 选中 PlanEvaluatorAgent 时，展示候选池和排序 Tab。
- 切换 Agent 时，如果当前 subTab 不相关，自动切到摘要。
- 摘要内容根据 Agent 展示不同字段。

### P0-3 修复默认子 Tab 跳转逻辑

问题：

`pickSubTabForMobileView()` 在 clarifying 时自动切到 candidates，导致用户感觉"每次都跳到候选池"。

目标：

默认子 Tab 始终是摘要，除非用户主动点击切换。自动联动只发生在明确的场景下。

建议修改：

1. `pickSubTabForMobileView()` 只在以下场景自动切换：
   - `mobileView === "plans"` → 切到排序（因为用户此时最关心方案对比）
   - 其他场景 → 不自动切换，保持用户当前选中的 subTab
2. 移除 `clarifying → candidates` 的自动切换。
3. 新增"用户手动选择 subTab"的标记，避免后续自动联动覆盖用户选择。

涉及文件：

- `apps/web/components/debug-trace-panel.tsx`

验收标准：

- Agent Run 期间，subTab 始终停留在摘要，不自动跳到候选池。
- 进入方案页后，subTab 自动切到排序。
- 用户手动点击其他 subTab 后，不会被自动联动覆盖。

### P0-4 点击 Agent Flow 块触发联动跳转

问题：

点击左边 Agent Flow 块只更新 `selectedTraceEventId`，不触发 mobile-shell 页面跳转和 Debug Trace subTab 切换。

目标：

点击 Agent Flow 块时：

1. mobile-shell 切换到与该 Agent 最相关的页面。
2. Debug Trace subTab 切换到与该 Agent 最相关的 Tab。
3. 如果该 Agent 有对应的 trace event，右侧详情区展示该 Agent 的输入/输出。

建议的 Agent → mobileView 映射：

| Agent                    | mobileView |
| ------------------------ | ---------- |
| Run Lifecycle            | 当前 view 不变 |
| InteractionRouterAgent   | running    |
| ConstraintDiscoveryAgent | clarifying |
| UserPreferenceAgent      | running    |
| ContextGroundingAgent    | running    |
| PlanSolverAgent          | running    |
| PlanEvaluatorAgent       | plans      |
| PlanExplanationAgent     | plans      |

建议的 Agent → subTab 映射（与 P0-2 对齐）：

| Agent                    | 默认 subTab  |
| ------------------------ | ---------- |
| Run Lifecycle            | summary    |
| InteractionRouterAgent   | summary    |
| ConstraintDiscoveryAgent | summary    |
| UserPreferenceAgent      | summary    |
| ContextGroundingAgent    | candidates |
| PlanSolverAgent          | candidates |
| PlanEvaluatorAgent       | ranking    |
| PlanExplanationAgent     | summary    |

实现方式：

1. 在 `AgentEventGroup` 的点击事件中，除了 `setSelectedTraceEventId`，还调用 `setMobileView` 和 `setActiveDebugSubTab`。
2. 新增 `getMobileViewForAgent(agentName: string, currentView: MobileShellView): MobileShellView | null` 函数，返回 null 表示不切换。
3. 新增 `getSubTabForAgent(agentName: string): SubTab` 函数。

涉及文件：

- `apps/web/components/debug-trace-panel.tsx`
- `apps/web/stores/use-demo-store.ts`

验收标准：

- 点击 InteractionRouterAgent 块 → mobileView 切到 running，subTab 切到 summary。
- 点击 ContextGroundingAgent 块 → subTab 切到 candidates。
- 点击 PlanEvaluatorAgent 块 → mobileView 切到 plans，subTab 切到 ranking。
- 点击 Run Lifecycle 块 → 不切换 mobileView，subTab 切到 summary。

### P0-5 统一顶端指示灯与底部 Agent Flow

问题：

顶端 `AgentStatusBar` 和底部 mobile-shell 的 `RunningView` 同时展示 Agent 步骤，但数据源不同、状态不同步、关系不清楚。

目标：

合并为统一的进度指示，消除歧义。

建议方案：

1. **保留顶端 AgentStatusBar**，作为全局 Agent 进度指示器。它是 Debug Trace 面板的一部分，与 Debug Trace 数据源一致。
2. **改造底部 RunningView 的 Agent 链动画**：不再用前端 `setInterval` 做假动画，而是读取 `activeTrace.events` 的真实进度。
3. **当 trace 还没返回时**（API 请求中），底部 RunningView 展示"正在调用后端..."的 loading 态，不展示假的 Agent 步骤动画。
4. **当 trace 逐步返回时**（P0-1 的渐进式渲染），底部 RunningView 跟随 `activeAgentStep` 展示当前正在执行的 Agent。
5. **顶端和底部共享同一个** **`activeAgentStep`** **状态**，确保一致。

具体改动：

- `RunningView` 的 `steps` 从前端 `agentSteps` 常量改为从 `activeTrace.agent_strategy` 或 `activeTrace.events` 推导。
- `RunningView` 的动画逻辑从 `setInterval` 改为响应 `activeAgentStep` 变化。
- API 请求期间展示 loading spinner，不展示 Agent 步骤。

涉及文件：

- `apps/web/components/mobile-shell.tsx`（RunningView 组件）
- `apps/web/components/agent-status-bar.tsx`
- `apps/web/stores/use-demo-store.ts`
- `apps/web/lib/api.ts`

验收标准：

- API 请求期间，底部展示"正在调用后端..."，不展示假的 Agent 步骤。
- trace 逐步返回时，底部和顶端同步展示当前 Agent。
- 顶端和底部的 Agent 名称、状态一致。
- 不再有两个独立的 Agent 进度指示器。

## 5. P1 重要任务

### P1-1 摘要 Tab 按 Agent 差异化展示

目标：

摘要 Tab 不再是通用模板，而是根据当前 Agent 展示该 Agent 最核心的输入/输出/决策。

建议每个 Agent 的摘要模板：

**InteractionRouterAgent 摘要：**

- 分流结果：interaction\_type + routing\_reason
- 置信度：confidence
- 分流来源：deterministic\_router / longcat
- Schema 校验结果
- Fallback 原因（如有）

**ConstraintDiscoveryAgent 摘要：**

- 需求摘要：城市、时间窗、人数、是否安排吃喝
- 约束账本草稿：硬约束、软约束
- 补全卡片：缺失字段和追问
- Grounding 请求列表
- LLM 调用详情（如有）

**UserPreferenceAgent 摘要：**

- 偏好来源列表
- preference\_warmup\_pending 状态
- 非阻塞说明

**ContextGroundingAgent 摘要：**

- POI 搜索结果摘要：accepted / rejected 数量
- 天气约束
- 地图距离 provider
- 深度字段 Mock 标记

**PlanSolverAgent 摘要：**

- 候选路线数量
- Slot 分配逻辑
- 过滤掉的不可行路线
- solver\_notes

**PlanEvaluatorAgent 摘要：**

- 评分拆解
- 淘汰理由
- 硬约束违反
- 最终方案选择理由

**PlanExplanationAgent 摘要：**

- LLM 解释草稿预览
- Guardrail 检查结果
- 引用事实列表

涉及文件：

- `apps/web/components/debug-trace-panel.tsx`

验收标准：

- 每个 Agent 的摘要 Tab 展示不同的核心字段。
- 不再是"输入/处理/输出"的通用三栏，而是有针对性的信息展示。

### P1-2 指标卡片按 Agent 上下文更新

目标：

顶部 4 个指标卡片（总耗时、Tool 调用、方案数、地图 Provider）不再一直是最终值，而是随当前选中的 Agent 更新。

建议：

- 选中 Run Lifecycle 时：展示 Run 级指标。
- 选中某个 Agent 时：展示该 Agent 的耗时、Tool 调用数、token 用量。
- 方案数和地图 Provider 只在相关 Agent 选中时展示，否则替换为该 Agent 更有意义的指标。

涉及文件：

- `apps/web/components/debug-trace-panel.tsx`

### P1-3 Agent Flow 块增加状态指示

目标：

左边 Agent Flow 的每个块不只是"选中/未选中"，还要展示该 Agent 的运行状态（pending / running / completed / failed）。

建议：

- pending：灰色边框，Agent 编号灰色
- running：蓝色脉冲动画，蓝色边框
- completed：绿色勾号，正常边框
- failed：红色边框，错误标记
- 有 fallback：黄色警告标记

涉及文件：

- `apps/web/components/debug-trace-panel.tsx`

## 6. P2 后续增强任务

### P2-1 后端真正逐 Agent 流式推送

当前状态：

SSE 端点已实现（`/interactions/respond/stream`），前端 SSE client 已实现（`interactRespondStream`），store SSE 方法已实现（`setActiveTraceMeta`、`appendTraceEvent`、`finalizeActiveTrace`）。

但当前 SSE 是"先跑完再推送"：后端先执行完整个 `DeterministicMockRunner.run()`，然后逐个推送已完成的 trace events。前端等待时间不变，只是收到后能逐步展示。

目标：

改造后端 runner，让它在每个 Agent 完成后立即 yield event，前端实时渲染。实现后，用户提交后约 0.5-1 秒就能看到第一个 Agent（InteractionRouterAgent）的结果。

建议实现：

1. 改造 `DeterministicMockRunner.run()`，让它接受一个 `on_event` 回调。每个 Agent 完成后，调用 `on_event(event)`。
2. 改造 `/interactions/respond/stream`，让 `event_generator` 在 runner 执行期间就能 yield event，而不是等 runner 跑完。
3. 使用 `asyncio.Queue` 或类似机制，让 runner 在线程池中执行时，主线程能实时读取并推送 events。

涉及文件：

- `apps/api/app/agents/runner.py`（新增 `on_event` 回调）
- `apps/api/app/routers/interactions.py`（改造 `event_generator`，实时推送）
- 前端不需要改动（SSE client 和 store 已经支持实时接收）

### P2-2 Agent Flow 块支持拖拽排序和折叠

目标：

当 Agent 数量多时，左边 Agent Flow 列表可以折叠次要 Agent，只展示核心 Agent。

### P2-3 Debug Trace 面板支持深色模式

目标：

Debug Trace 面板在深色模式下也能清晰展示。

## 7. 建议执行顺序

### 第一阶段：数据流修复（P0-1a + P0-1b + P0-5）

1. submitSearchQuestion 改用 SSE（P0-1a）。
2. RunningView 消费 SSE 数据，不再做假动画（P0-1b）。
3. 统一顶端指示灯与底部 Agent Flow（P0-5）。

这一阶段完成后，Agent Run 期间 Debug Trace 不再是"空白等待"，而是能看到 Agent 逐步亮起。SSE 已经实现了大部分基础设施，只需要接通。

### 第二阶段：展示逻辑修复（P0-2 + P0-3）

1. 右侧详情区按 Agent 过滤展示内容（P0-2）。
2. 修复默认子 Tab 跳转逻辑（P0-3）。

这一阶段完成后，右侧详情区不再展示无关内容，默认停留在摘要。

### 第三阶段：交互联动（P0-4）

1. 点击 Agent Flow 块触发联动跳转（P0-4）。

这一阶段完成后，左右联动、mobile-shell 与 Debug Trace 联动。

### 第四阶段：体验深化（P1）

1. 摘要 Tab 按 Agent 差异化展示（P1-1）。
2. 指标卡片按 Agent 上下文更新（P1-2）。
3. Agent Flow 块增加状态指示（P1-3）。

## 8. 验收总清单

- [ ] 搜索框提交走 SSE，Debug Trace 左侧 Agent Flow 逐步亮起。
- [ ] RunningView 消费 SSE 数据，不再做假动画（无 setInterval 820ms）。
- [ ] AgentStatusBar 的指示灯与 Debug Trace 左侧同步。
- [ ] SSE 失败时自动 fallback 到普通 mutation，不中断用户流程。
- [ ] 右侧详情区只展示当前 Agent 相关的子 Tab。
- [ ] 默认子 Tab 是摘要，不自动跳到候选池。
- [ ] 选中 ContextGroundingAgent 时展示候选池和地图 Tab。
- [ ] 选中 PlanEvaluatorAgent 时展示候选池和排序 Tab。
- [ ] 选中 InteractionRouterAgent 时不展示候选池、排序、地图 Tab。
- [ ] 点击 Agent Flow 块时 mobileView 和 subTab 联动跳转。
- [ ] 顶端指示灯和底部 Agent Flow 共享同一数据源，状态一致。
- [ ] API 请求期间底部展示 loading，不展示假的 Agent 步骤动画。
- [ ] 摘要 Tab 按 Agent 展示不同核心字段。
- [ ] npm --workspace apps/web run lint 通过。

## 9. 推荐验证命令

前端检查：

```bash
npm --workspace apps/web run lint
```

本地联调：

```bash
conda run -n agent uvicorn app.main:app --reload --port 8000
npm --workspace apps/web run dev
```

验证步骤：

1. 刷新页面，确认首屏干净。
2. 输入"今天下午两个人在望京约会，少排队，吃饭加看展"。
3. 观察 Debug Trace 左侧 Agent Flow 是否逐步亮起。
4. 观察顶端 AgentStatusBar 是否同步。
5. 观察右侧详情区是否只展示当前 Agent 相关的 Tab。
6. 点击不同 Agent Flow 块，观察 mobileView 和 subTab 是否联动。
7. 输入"附近有没有适合聊天的咖啡馆"，观察普通问答链路的 Debug Trace。

