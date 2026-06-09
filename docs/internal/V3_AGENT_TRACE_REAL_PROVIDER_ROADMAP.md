# DZUltra V3 Agent Trace 与真实 Provider 推进文档

更新时间：2026-06-08

本文用于后续窗口直接继续推进。它总结当前检查结果、此次更新的最终目标、必须完成的任务清单、建议顺序和验收标准。

## 1. 此次更新最终目标

这次更新的目标不是继续把 Debug Trace 做得更花，而是让它真实反映 DZUltra 的 Agent 工作流。

最终应达到：

1. 用户每次输入后，系统先由后端 `InteractionRouterAgent` 统一分流，不能由前端正则提前决定“快速问答”或“路线规划”。
2. 主路线规划链路按 7 个 Agent 跑清楚：
   - `InteractionRouterAgent`
   - `ConstraintDiscoveryAgent`
   - `UserPreferenceAgent`
   - `ContextGroundingAgent`
   - `PlanSolverAgent`
   - `PlanEvaluatorAgent`
   - `PlanExplanationAgent`
3. 普通问答链路单独走：
   - `InteractionRouterAgent`
   - `UserPreferenceAgent`
   - `ContextGroundingAgent`
   - `ChatAnswerAgent`
4. V3 主链路优先调用真实 provider：
   - LongCat LLM：用于分流、约束发现、普通问答、方案解释、必要的结构化生成。
   - 高德地图 Web 服务：用于 POI 搜索、地理编码、距离矩阵、地图预览。
   - 彩云天气：用于天气约束。
5. 排队、UGC 摘要、推荐菜、用户历史行为等大众点评深度字段继续允许本地 Mock，但必须在 Trace 中明确标记 `mocked`。
6. 任何 fallback 都必须进入 Debug Trace，说明触发原因、fallback provider、哪些字段可靠性是 `mocked`。
7. Debug Trace 必须能让人看懂 Agent 的内部过程：输入是什么、调用了什么工具、观察到什么结果、产出了什么结构化内容、交给了哪个 Agent。
8. Web 首屏必须干净：没有预置 run、没有预置 Debug Trace、没有默认展示基础 Mock 数据。用户交互后才出现当前 run。

一句话版本：让 DZUltra 从“前端演示壳 + Mock Agent 日志”升级到“真实 provider 优先、Mock 可解释 fallback、Debug 能回放真实 Agent 全链路”的 V3 Demo。

## 2. 当前已确认状况

### 2.1 后端主链路仍是 Mock Runner

当前 `/routes/plan` 进入的是：

```text
run_route_planning()
  -> DeterministicMockRunner().run(request)
```

对应文件：

- `apps/api/app/agents/runner.py`

`run_openai_agents_sdk()` 仍是预留入口，直接 `NotImplementedError`。所以当前不是完整真实 Agents SDK / LangGraph / ReAct 主链路。

### 2.2 LongCat 已有 provider 能力，但没有驱动主链核心 Agent

已经存在：

- `apps/api/app/llm/provider.py`
- `apps/api/app/providers/adapter.py`
- `/providers/llm/smoke-test`

实际检查结论：

- 本机环境里 LongCat key 已配置。
- 允许网络后，LongCat 能真实返回。
- 但目前路线规划里 LongCat 主要只在 `PlanExplanationAgent` 最后一步生成“路线解释草稿”。
- 分流、需求摘要、补全问题、约束发现、候选求解、评分排序仍主要是规则或 Mock 工具。

### 2.3 高德真实 POI 已接入，但会打崩后续 Mock 工具

当前 `provider_adapter.poi_search()` 会优先调用高德。真实高德返回的候选 POI id 类似：

```text
amap-B000A9ONPA
```

但后续 `mock_experience_copywriter()` 等工具仍按本地 `MOCK_POIS` 查 ID。真实高德候选进入后会出现：

```text
KeyError: 'amap-...'
```

这说明真实 POI 搜索不是完全没接，而是接入后没有完成统一 POI fact pack 和后续工具兼容。

涉及文件：

- `apps/api/app/providers/adapter.py`
- `apps/api/app/agents/runner.py`
- `apps/api/app/agents/mock_tools.py`
- `apps/api/app/maps/provider.py`

### 2.4 快速问答分流有前端抢跑问题

当前前端 `submitSearchQuestion()` 会先调用本地 `isRoutePlanningGoal()`。如果正则判断不是路线规划，就直接调用 `/chat/respond`。

涉及文件：

- `apps/web/components/mobile-shell.tsx`

这会绕过后端统一分流，导致用户感觉“被判成快速问答”，但这个判断可能不是 Agent 做的。

### 2.5 普通问答大量依赖 Mock

当前 `/chat/respond`：

- 用 `mock_intent_parser()` 分析。
- 用 `mock_user_profile_lookup()` 读取用户画像。
- 用本地 Mock POI 做 `related_pois`。
- 最后才调用 LongCat 或模板生成回答。

这条链路还没有真实 POI grounding，也没有完整显示 tool use。

### 2.6 前端仍有静态演示数据混入

当前 store 初始值仍包含：

- 默认方案 `demoRoutePlans`
- 默认选中的 `route-date-low-queue`
- 默认偏好
- 默认 provider 状态 connected

涉及文件：

- `apps/web/stores/use-demo-store.ts`
- `apps/web/lib/api.ts`
- `apps/web/components/debug-trace-panel.tsx`

这会让 Debug 和 Mock 面板看起来像已经有当前 run，实际很多是预置样例。

### 2.7 当前测试能通过，但主要保护的是 Mock 合同

已验证：

```bash
conda run -n agent pytest apps/api/tests/test_api_contracts.py -q
```

结果：

```text
15 passed
```

注意：这说明当前 API contract 稳定，不代表真实 provider 主链已经完成。

## 3. 推进原则

后续窗口推进时遵守这些原则：

1. 不要让 LLM 猜距离、坐标、营业状态、通勤时间、排队人数。这些事实必须来自 provider 或确定性工具。
2. 不要在 Debug Trace 里展示“假的 Agent 内心独白”。可以展示结构化的 `reasoning_summary`、`tool_input`、`tool_output`、`observation`、`decision`，不要暴露或伪造模型隐藏思维链。
3. 不要删除 Mock。V3 仍需要 Mock fallback 和深度本地生活字段 Mock。
4. 不要把前端写死数据当成当前 run。首屏要干净，用户交互后才生成 run。
5. 先保 Demo 稳定，再逐步提高真实 provider 覆盖率。真实 provider 失败时允许 fallback，但 Trace 必须说明。
6. 所有新增能力都要有测试，至少覆盖成功、fallback、结构不合法三类情况。

## 4. P0 必须完成任务

P0 是马上要补的断点。不完成这些，V3 演示仍会显得混乱。

### P0-1 统一后端分流入口

问题：

前端现在会先用本地正则判断是否路线规划，导致快速问答绕过真实 `InteractionRouterAgent`。

目标：

所有用户输入先进入后端统一分流。前端只负责传入：

- 用户输入
- `plan_mode`
- 当前页面上下文 `interaction_context`
- 当前 trace / plan / pending clarification 信息

推荐实现：

新增统一入口：

```text
POST /interactions/respond
```

输入：

```json
{
  "user_id": "user-date-001",
  "message": "附近有没有适合聊天的咖啡馆？",
  "city": "北京",
  "plan_mode": true,
  "interaction_context": {
    "page": "searching",
    "trace_id": null,
    "selected_plan_id": null
  }
}
```

输出用 discriminated union，也就是按 `interaction_type` 区分返回结构：

```json
{
  "interaction_type": "chat_answer",
  "trace_id": "...",
  "chat": {
    "answer": "...",
    "related_pois": []
  },
  "trace": {}
}
```

或：

```json
{
  "interaction_type": "new_planning_task",
  "trace_id": "...",
  "route_plan": {
    "plans": []
  },
  "trace": {}
}
```

涉及文件：

- `apps/api/app/models/schemas.py`
- `apps/api/app/routers/__init__.py`
- 新增 `apps/api/app/routers/interactions.py`
- `apps/api/app/agents/runner.py`
- `apps/web/components/mobile-shell.tsx`
- `apps/web/lib/api.ts`
- `apps/web/types/dzultra.ts`

验收标准：

- 前端搜索入口不再用 `isRoutePlanningGoal()` 决定接口。
- Debug Trace 第一步总是 `InteractionRouterAgent`。
- 输入“附近有没有适合聊天的咖啡馆？”可以走 `chat_answer`。
- 输入“今天下午两个人在望京约会，少排队，吃饭加看展”可以走 `new_planning_task`。
- 输入“第二个换成不辣的”在方案页可以走 `refine_current_plan`。
- Trace 里能看到分流原因和页面上下文。

### P0-2 把 InteractionRouterAgent 接上 LongCat

问题：

当前分流主要是规则判断，不能理解复杂上下文。

目标：

`InteractionRouterAgent` 使用规则优先、LongCat 兜底或增强。输出必须结构化校验。

建议输出 schema：

```json
{
  "interaction_type": "new_planning_task | chat_answer | answer_clarification | confirm_requirements | refine_current_plan | select_plan | switch_task",
  "intent_kind": "planning | non_planning | refinement_without_context | ambiguous",
  "confidence": 0.86,
  "routing_reason": "用户在搜索页询问附近咖啡馆，没有时间窗和路线动词，先作为普通问答。",
  "needs_followup": false
}
```

Trace 要记录：

- LLM model
- prompt contract
- request purpose
- token usage
- parse result
- schema validation result
- fallback reason

涉及文件：

- `apps/api/app/agents/strategy.py`
- `apps/api/app/agents/runner.py`
- `apps/api/app/providers/adapter.py`
- `apps/api/app/models/schemas.py`

验收标准：

- LongCat 可用时，Trace 能看到 `provider=longcat`。
- LongCat 超时或 JSON 不合法时，回退 deterministic router，并标记 fallback。
- 页面上下文能影响分流，但不是硬规则。

### P0-3 把 ConstraintDiscoveryAgent 接上 LongCat

问题：

当前需求摘要、补全信息、偏好确认基本来自规则和默认值，显得像 Mock。

目标：

用 LongCat 生成结构化的需求理解结果，包括：

- 目标
- 城市/区域
- 时间窗
- 人数
- 是否安排吃喝
- 硬约束
- 软约束
- 缺失字段
- 需要追问的卡片
- 约束账本草稿 `ConstraintLedger`

LLM 不能生成天气、距离、营业、排队事实，只能标记这些字段需要 grounding。

建议输出 schema：

```json
{
  "requirement_summary": {},
  "constraint_ledger_patch": {},
  "clarification_cards": [],
  "assumptions": [],
  "grounding_requests": ["weather", "poi_search", "route_matrix"]
}
```

涉及文件：

- `apps/api/app/agents/requirements.py`
- `apps/api/app/agents/runner.py`
- `apps/api/app/models/schemas.py`
- `apps/api/app/providers/adapter.py`

验收标准：

- 输入信息不足时，补全卡片来自 LLM schema 或 LLM + deterministic validator。
- 最多追问 2 轮。
- 阻塞字段仍只有城市/区域、时间窗、人数、是否安排吃喝。
- Trace 中能看到 `ConstraintDiscoveryAgent` 的 LLM 输入摘要、输出结构、校验结果。

### P0-4 修复真实高德 POI 命中后崩溃

问题：

真实高德 POI id 不存在于 `MOCK_POIS`，后续 Mock 工具查本地 ID 会崩。

目标：

无论 POI 来自高德还是 Mock，后续工具都只消费统一的 `poi_fact_pack`，不能直接依赖 `MOCK_POIS` 全局查表。

建议做法：

1. 在 `provider_adapter.poi_search()` 返回中明确输出：
   - `candidates`
   - `candidate_pool`
   - `rejected`
   - `poi_fact_pack`
   - 每个字段的 `source` 和 `reliability`
2. 修改后续工具，让它们从 retrieval 里的 POI 数据建 `poi_by_id`。
3. 对高德 POI 缺失的深度字段，用本地 Mock enrichment 补齐：
   - 排队：`mocked`
   - UGC：`mocked`
   - 推荐菜：`mocked`
   - 推荐理由：可由规则或 LLM 基于已有事实生成
4. 如果真实高德返回结构不合法，才整体 fallback 到 `mock_poi_search`。

涉及文件：

- `apps/api/app/providers/adapter.py`
- `apps/api/app/agents/mock_tools.py`
- `apps/api/app/agents/runner.py`
- `apps/api/app/maps/provider.py`
- `apps/api/tests/test_api_contracts.py`

验收标准：

- 使用真实高德 key 时，`/routes/plan` 不再因为 `amap-...` id 崩溃。
- Trace 能显示 `provider=amap`、`reliability=verified` 的 POI 搜索。
- 高德 POI 的排队、UGC、推荐菜字段标为 `mocked`。
- 地图距离仍来自高德或 mock_map_provider fallback。

### P0-5 普通问答改成真实 grounding + LongCat 回答

问题：

当前普通问答是 Mock POI + LongCat 文案，用户看到的 `related_pois` 很容易全是 Mock。

目标：

普通问答也要通过 `ContextGroundingAgent` 调 provider：

```text
InteractionRouterAgent
  -> UserPreferenceAgent
  -> ContextGroundingAgent
      -> provider_adapter.poi_search
      -> provider_adapter.mock_deep_poi_enrichment
  -> ChatAnswerAgent
      -> LongCat
```

涉及文件：

- `apps/api/app/agents/runner.py`
- `apps/api/app/routers/chat.py`
- `apps/api/app/providers/adapter.py`
- `apps/web/components/debug-trace-panel.tsx`

验收标准：

- `/chat/respond` 的候选 POI 优先来自高德。
- 如果高德失败，fallback 到 Mock，并写入 Trace。
- `ChatAnswerAgent` 的回答只引用 `related_pois` 中已有事实。
- Debug 排序页不展示路线评分，候选池页展示普通问答 POI。

### P0-6 Debug Trace 按真实 Agent 流程展示

问题：

当前 Debug 有 Agent 分组，但内容仍混入静态事件、Mock 数据和当前 run 数据。

目标：

Debug 面板按真实 Agent 展示：

一级：

- Run 摘要
- Agent Flow
- Provider / Tool use
- Constraint Ledger
- 候选池
- 方案排序
- 地图与距离
- Mock 使用情况
- 完整 JSON
- History

每个 Agent 展示：

- 输入
- 结构化决策摘要
- tool calls
- observations
- 输出
- handoff
- fallback
- duration
- token / cost

注意：不要展示或伪造隐藏思维链。可展示的是结构化摘要和决策依据。

涉及文件：

- `apps/api/app/models/schemas.py`
- `apps/api/app/agents/runner.py`
- `apps/web/components/debug-trace-panel.tsx`
- `apps/web/types/dzultra.ts`

验收标准：

- 每个 TraceEvent 都能归属到明确 Agent 或 system。
- Tool use 不再只是一行 label，而能展开参数、provider、摘要、fallback。
- 候选池只展示当前 run 用到的 POI。
- Mock 数据面板只展示当前 run 用到的 Mock 字段或生成器结果，不展示全量基础 Mock。

### P0-7 首屏清理静态 Run 和基础 Mock 展示

问题：

前端 store 初始状态仍有默认方案、默认偏好、默认选中 trace event。

目标：

首次进入：

- `activeTrace = undefined`
- `currentRoutePlans = []`
- `selectedTraceEventId = undefined`
- Debug Trace 空态
- History 不预置当前 run
- Mock 数据面板不展示基础 Mock 池，只展示生成器入口和说明

涉及文件：

- `apps/web/stores/use-demo-store.ts`
- `apps/web/components/mobile-shell.tsx`
- `apps/web/components/debug-trace-panel.tsx`
- `apps/web/lib/api.ts`

验收标准：

- 刷新页面后，右侧 Debug Trace 显示等待首次 run。
- 用户未交互前，不出现 3 套默认路线。
- Mock 数据 Tab 不主动展示 `mockUsers`、`mockPois` 全量池。
- 用户发起一次 run 后，才展示本轮 Trace 和本轮用到的 Mock 数据。

## 5. P1 重要任务

P1 是让 V3 体验从“能跑”变成“可信”。

### P1-1 UserPreferenceAgent 真实化

目标：

`UserPreferenceAgent` 至少要做到：

- 读取本地 JSON 偏好档案。
- 结合本轮输入检测新增偏好。
- 可选调用 LongCat 总结长期偏好。
- 不阻塞主规划。
- 数据授权关闭时不读取用户偏好。

涉及文件：

- `apps/api/app/profiles/store.py`
- `apps/api/app/agents/runner.py`
- `apps/api/app/routers/profiles.py`
- `apps/web/components/mobile-shell.tsx`

验收标准：

- Trace 标记偏好来源：历史、用户显式、本轮推断、默认假设。
- 偏好未就绪时，标记 `preference_warmup_pending=true`。
- 用户关闭数据授权后，Trace 不展示用户历史偏好。

### P1-2 ContextGroundingAgent 写入约束账本

目标：

天气、地图、POI、UGC、排队等 facts 不只是散落在 tool output 中，而要更新 `ConstraintLedger`。

示例：

```json
{
  "id": "weather.rain_1500",
  "category": "weather",
  "source": "weather_provider",
  "reliability": "verified",
  "impact": ["warning", "boost"],
  "status": "grounded"
}
```

涉及文件：

- `apps/api/app/models/schemas.py`
- `apps/api/app/agents/runner.py`
- `apps/api/app/providers/adapter.py`

验收标准：

- Debug 里能看到约束从 discovered 到 grounded。
- 天气影响能进入方案排序，例如下雨时室内 POI 加分、露台风险提醒。

### P1-3 PlanSolverAgent 不再只套固定三站模板

目标：

Solver 要基于候选池生成 5-10 个候选路线，再交给 Evaluator 筛成 3 个方案。

最低实现：

- 按 slot 生成候选：餐饮 / 文化 / 甜品 / 商场 / 娱乐。
- 根据时间窗安排顺序和停留时长。
- 根据路线矩阵过滤移动过远组合。
- 支持无餐饮路线。
- 支持用户锁定某个 POI 后局部重算。

涉及文件：

- `apps/api/app/agents/mock_tools.py`
- `apps/api/app/agents/runner.py`
- `apps/api/tests/test_api_contracts.py`

验收标准：

- Trace 中出现 `candidate_plans`，数量大于最终展示方案数。
- 最终 3 个方案之间确实有差异。
- 方案顺序、时间、交通摘要来自 provider/tool，不是纯文案。

### P1-4 PlanEvaluatorAgent 评分更可解释

目标：

评分必须拆解，至少包含：

- hard_constraint
- queue
- business_hours
- traffic
- weather_fit
- preference_fit
- ugc_quality
- route_efficiency
- budget
- diversity

涉及文件：

- `apps/api/app/agents/mock_tools.py`
- `apps/api/app/models/schemas.py`
- `apps/web/components/debug-trace-panel.tsx`

验收标准：

- Debug 排序页能展开每个方案的 score breakdown。
- 被淘汰方案有淘汰理由。
- 有硬约束违反时，方案被淘汰或显著降分。

### P1-5 PlanExplanationAgent 只解释已有事实

目标：

LongCat 可以生成好懂文案，但不能编造：

- 推荐菜
- 距离
- 营业状态
- 排队
- 价格
- 天气

涉及文件：

- `apps/api/app/agents/runner.py`
- `apps/api/app/providers/adapter.py`

验收标准：

- LLM prompt 明确包含可引用 facts。
- Trace 记录 guardrail。
- LLM 输出不合法或引用不存在事实时，回退模板解释。

### P1-6 Provider 状态与 fallback 显示真实化

目标：

前端 provider 状态从后端 `/providers/status` 获取，而不是默认写 connected。

涉及文件：

- `apps/api/app/routers/providers.py`
- `apps/web/lib/api.ts`
- `apps/web/stores/use-demo-store.ts`
- `apps/web/components/agent-status-bar.tsx`

验收标准：

- key 缺失时显示 mock / not configured。
- key 为占位符时不显示 connected。
- 最近一次 run 的 provider/fallback 与状态条一致。

## 6. P2 后续增强任务

P2 不阻塞 V3 基础演示，但可以让系统更接近最终形态。

### P2-1 引入 LangGraph 或 OpenAI Agents SDK Runner

目标：

与 `DeterministicMockRunner` 并列新增真实 runner，通过环境变量切换。

建议：

```text
DZULTRA_RUNNER_MODE=deterministic_mock | openai_agents_sdk | langgraph
```

要求：

- 对外仍返回现有 `RoutePlanResponse`。
- SDK spans 要映射回 `AgentTrace.events`。
- Mock tools 作为 fallback tools 保留。

涉及文件：

- `apps/api/app/agents/runner.py`
- 新增 `apps/api/app/agents/sdk_runner.py` 或 `graph_runner.py`
- `apps/api/app/core/config.py`

### P2-2 支持流式 Trace 或轮询运行态

目标：

用户端等待时，Debug Trace 能逐步出现真实事件，而不是请求结束后一次性显示。

可选方案：

- Server-Sent Events
- WebSocket
- `/traces/{trace_id}` 轮询 running trace

### P2-3 MockDataAgent 完整接入

目标：

Mock 生成器不只是生成静态预览，而能：

- LongCat 生成用户/POI/UGC。
- Pydantic 校验。
- 地图 provider 校验坐标。
- 生成结果应用到当前演示 run。
- Trace 标记来源。

涉及文件：

- `apps/api/app/routers/mock.py`
- `apps/web/components/debug-trace-panel.tsx`

### P2-4 浏览器端完整验收

目标：

每次重大前端更新后，用浏览器实际验证：

- 首屏干净。
- 路线规划能完成。
- 普通问答不进入路线页。
- Debug Trace 与用户端状态联动。
- Mock 数据不预置。

## 7. 建议执行顺序

建议按下面顺序推进，避免越改越乱。

### 第一阶段：止血与统一入口

1. 修复高德真实 POI 命中后崩溃。
2. 去掉前端 `isRoutePlanningGoal()` 对接口的硬分流。
3. 新增统一后端分流入口，或者先用后端 router 结果决定调用 `/routes/plan` / `/chat/respond`。
4. 清理首屏静态 run 和基础 Mock 展示。

这一阶段完成后，至少能保证演示不会因为真实高德命中而 500，也不会让前端提前把任务判成快速问答。

### 第二阶段：LongCat 接入核心 Agent

1. `InteractionRouterAgent` 接 LongCat。
2. `ConstraintDiscoveryAgent` 接 LongCat。
3. `ChatAnswerAgent` 接真实 grounding + LongCat。
4. Trace 中展示 LLM 请求、schema 校验、fallback。

这一阶段完成后，用户会明显感觉不是纯规则 Mock。

### 第三阶段：Trace 与 Solver/Evaluator 对齐

1. Context grounding 写入 Constraint Ledger。
2. Solver 生成多个候选方案。
3. Evaluator 输出完整评分拆解和淘汰理由。
4. Debug Trace 面板按 Agent 和 tool use 展示。

这一阶段完成后，Debug 能说服评审：推荐结果确实可解释。

### 第四阶段：真实 runner 和流式执行

1. 引入 LangGraph 或 Agents SDK Runner。
2. 保持旧 response schema 不变。
3. 增加运行中 Trace 或流式事件。

这一阶段是更完整的 V3+，不建议在 P0 未完成前贸然开始。

## 8. 后续窗口可直接使用的推进 Prompt

可以把下面这段发给新窗口：

```text
请阅读 AGENTS.md、README.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md。

当前任务：优先完成 P0。

请先检查 apps/api/app/agents/runner.py、apps/api/app/providers/adapter.py、apps/api/app/agents/mock_tools.py、apps/web/components/mobile-shell.tsx、apps/web/stores/use-demo-store.ts、apps/web/components/debug-trace-panel.tsx。

第一步先修复真实高德 POI 命中后 /routes/plan 崩溃，并新增测试覆盖 amap-* POI。
第二步移除前端本地正则硬分流，让用户输入先进入后端 InteractionRouterAgent。
第三步把 Debug Trace 和首屏静态 Mock 展示收干净。

要求：
- 不删除 Mock fallback。
- 真实 provider 失败时必须写入 Trace。
- 不让 LLM 猜距离、营业、排队和天气事实。
- 完成后运行 conda run -n agent pytest apps/api/tests/test_api_contracts.py -q。
```

## 9. 验收总清单

最终验收时逐项检查：

- [ ] 首屏没有预置 Trace。
- [ ] 首屏没有预置 3 套路线方案。
- [ ] Mock 数据面板不展示全量基础 Mock 池。
- [ ] 任意用户输入先经过后端 `InteractionRouterAgent`。
- [ ] 普通问答返回 `answer + related_pois + trace`，不展示路线评分。
- [ ] 路线规划返回 3 个可解释方案，后续可扩展 3-5 个。
- [ ] `ConstraintDiscoveryAgent` 输出真实结构化需求摘要和补全卡。
- [ ] LongCat 成功时 Trace 显示 `provider=longcat`。
- [ ] LongCat 失败时 fallback 到 deterministic template，并说明原因。
- [ ] 高德 POI 命中时路线不崩溃。
- [ ] 高德 POI 的深度字段 fallback 标记为 `mocked`。
- [ ] 彩云天气成功时天气约束进入 Trace。
- [ ] 彩云失败时 fallback 到 mock weather，并说明原因。
- [ ] 地图距离来自高德或 mock map provider，不由 LLM 编造。
- [ ] 候选池有 accepted 和 rejected，并有理由。
- [ ] 方案排序有完整 score breakdown。
- [ ] Debug Trace 每个 Agent 都能看到输入、tool use、输出和 handoff。
- [ ] History 只展示真实产生过的 run。
- [ ] API 测试通过。
- [ ] 前端 lint 通过。

## 10. 推荐验证命令

后端测试：

```bash
conda run -n agent pytest apps/api/tests/test_api_contracts.py -q
```

Provider 状态：

```bash
conda run -n agent python -c "from app.core.config import settings; print({'has_real_amap': settings.has_real_amap(), 'has_real_caiyun': settings.has_real_caiyun(), 'has_real_longcat': settings.has_real_longcat(), 'longcat_model': settings.longcat_model})"
```

前端检查：

```bash
npm --workspace apps/web run lint
```

本地联调建议：

```bash
conda run -n agent uvicorn app.main:app --reload --port 8000
npm --workspace apps/web run dev
```

如果网络沙箱导致 LongCat、高德、彩云失败，Trace 中应显示 fallback；允许网络后应能看到真实 provider 调用结果。

