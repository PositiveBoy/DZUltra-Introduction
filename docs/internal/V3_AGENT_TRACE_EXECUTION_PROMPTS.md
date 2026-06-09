# DZUltra V3 Agent Trace 执行提示词拆分

更新时间：2026-06-08

本文是 `docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md` 的执行提示词拆分版。用途是让多个新窗口可以直接复制对应提示词开始推进。

建议不要一次性让所有 Agent 同时改同一批文件。先按“波次”推进，每个波次完成并跑通测试后，再进入下一波。

## 总体协作规则

所有 Agent 都必须先读：

- `AGENTS.md`
- `README.md`
- `docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md`
- 本文档中自己负责的提示词

所有 Agent 都必须遵守：

- 不删除 Mock fallback。
- 不让 LLM 猜距离、坐标、营业状态、排队、天气和通勤事实。
- 真实 provider 失败时允许 fallback，但必须写入 Trace。
- 不回滚其他窗口或用户已有改动。
- 修改前先看相关代码，沿用现有 schema 和风格。
- 后端命令优先使用 `conda run -n agent ...`。

## 推荐波次

### 第一波：止血与前端干净态

可以并行：

1. Agent A：后端真实高德 POI 稳定化。
2. Agent B：前端首屏干净态与 Mock 展示收敛。

第一波完成后再进入第二波。

### 第二波：统一分流与普通问答真实化

建议按顺序：

1. Agent C：后端统一分流入口。
2. Agent D：前端接统一分流入口。
3. Agent E：普通问答真实 grounding + LongCat。

Agent C 和 D 强相关，最好 C 先出基础 schema，D 再接。

### 第三波：LongCat 核心 Agent 与 Debug Trace

建议按顺序或小步并行：

1. Agent F：`InteractionRouterAgent` 接 LongCat。
2. Agent G：`ConstraintDiscoveryAgent` 接 LongCat。
3. Agent H：Debug Trace 按真实 Agent / tool use 展示。

Agent H 可以先做展示结构，但必须等 F/G 的 Trace 字段稳定后再收尾。

### 第四波：Solver / Evaluator 深化

可以在前三波稳定后推进：

1. Agent I：`PlanSolverAgent` 多候选路线生成。
2. Agent J：`PlanEvaluatorAgent` 评分拆解与淘汰理由。

## Agent A 提示词：后端真实高德 POI 稳定化

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md。

你的任务是完成 P0-4：修复真实高德 POI 命中后 /routes/plan 崩溃。

背景：
- 当前 provider_adapter.poi_search() 优先调用高德。
- 高德返回的 POI id 类似 amap-B000A9ONPA。
- 后续 mock_experience_copywriter() 等工具仍按本地 MOCK_POIS 查 ID，真实高德 POI 进入后会 KeyError。

目标：
无论 POI 来自高德还是本地 Mock，后续 Runner 和工具都只能消费统一 POI 数据，不再依赖全局 MOCK_POIS 查表。

重点文件：
- apps/api/app/providers/adapter.py
- apps/api/app/agents/runner.py
- apps/api/app/agents/mock_tools.py
- apps/api/app/maps/provider.py
- apps/api/app/models/schemas.py
- apps/api/tests/test_api_contracts.py

具体要求：
1. 在 provider_adapter.poi_search() 的返回结构中保留完整候选 POI fact，不要只返回 id。
2. 修改 mock_experience_copywriter、mock_constraint_checker、mock_multi_plan_builder 等会查 MOCK_POIS 的工具，让它们优先从当前 retrieval/candidate data 构建 poi_by_id。
3. 对高德 POI 缺失的排队、UGC、推荐菜字段，用本地 Mock enrichment 或确定性默认值补齐，并标记 reliability=mocked。
4. 高德 POI 的真实字段，例如名称、地址、坐标、评分、图片、电话，保留 source/reliability 信息。
5. 如果高德 API 返回结构不合法或请求失败，整体 fallback 到 mock_poi_search，并在 Trace 中记录 fallback reason。
6. 新增或更新测试，覆盖 amap-* POI 不导致 /routes/plan 崩溃。

验收：
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。
- 使用真实 AMAP_WEB_SERVICE_KEY 时，/routes/plan 不再因 amap-* id 崩溃。
- Trace 中能看到 provider=amap 或 fallback_provider=mock_poi_search。
- 深度字段仍能明确标记 mocked。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent B 提示词：前端首屏干净态与 Mock 展示收敛

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/FRONTEND_SPEC.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md。

你的任务是完成 P0-7：首屏清理静态 Run 和基础 Mock 展示。

背景：
- 当前 use-demo-store.ts 初始状态仍有 demoRoutePlans、selectedPlanId、selectedTraceEventId、默认偏好和 provider connected 状态。
- Debug 面板虽然 activeTrace 为空，但 Mock Tab 和 JSON fallback 仍容易把静态数据看成当前 run。

目标：
Web 首次进入必须干净。用户没有交互前，不展示预置 run、预置 3 套路线、预置 Debug Trace 或基础 Mock 数据池。

重点文件：
- apps/web/stores/use-demo-store.ts
- apps/web/components/mobile-shell.tsx
- apps/web/components/debug-trace-panel.tsx
- apps/web/lib/api.ts
- apps/web/types/dzultra.ts

具体要求：
1. 初始 activeTrace 为 undefined。
2. 初始 currentRoutePlans 为空数组，不再默认 demoRoutePlans。
3. 初始 selectedPlanId、selectedTraceEventId、expandedStopId 不应指向静态 demo 数据。
4. MobileShell 在没有 current run 时仍能显示入口和开始页，但不能显示默认 3 套路线结果。
5. Debug Trace 空态只提示“等待首次 Run”，不要在 JSON 中塞 trace-static-fallback。
6. Mock 数据 Tab 首屏只展示 MockDataAgent 生成器入口和说明，不展示全量 mockUsers/mockPois；当前 run 用到 Mock 后再展示。
7. API 失败时仍允许前端 local fallback，但必须明显标记 fallback_reason=api_unavailable。

验收：
- 刷新页面后，右侧 Debug Trace 是空态。
- 刷新页面后，没有默认路线方案卡。
- Mock Tab 不展示基础 Mock 池。
- 用户发起一次规划后，才展示当前 run 的 Trace、plans、Mock 使用情况。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent C 提示词：后端统一分流入口

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/BACKEND_SPEC.md、docs/internal/AGENT_STRATEGY.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md。

你的任务是完成 P0-1 的后端部分：新增统一用户输入分流入口。

背景：
- 当前前端可能直接调用 /routes/plan 或 /chat/respond。
- 搜索入口还会用前端正则提前判断是否路线规划。
- V3 要求每次输入先经过后端 InteractionRouterAgent。

目标：
新增一个统一后端入口，让前端只提交 message + plan_mode + interaction_context，由后端决定本轮是 chat_answer、new_planning_task、answer_clarification、confirm_requirements、refine_current_plan、select_plan 还是 switch_task。

建议接口：
POST /interactions/respond

重点文件：
- apps/api/app/models/schemas.py
- apps/api/app/routers/__init__.py
- 新增 apps/api/app/routers/interactions.py
- apps/api/app/main.py
- apps/api/app/agents/runner.py
- apps/api/tests/test_api_contracts.py

具体要求：
1. 新增 InteractionRequest schema，字段至少包含 user_id、message、city、plan_mode、interaction_context、constraints、clarification_answers、preference_detection_enabled。
2. 新增 InteractionResponse schema，字段至少包含 interaction_type、trace_id、trace，以及 chat 或 route_plan/refinement 的 payload。
3. 后端统一入口先调用 InteractionRouterAgent 当前可用的 deterministic router，后续可由 LongCat 替换。
4. 如果 interaction_type=chat_answer，复用 run_chat_response。
5. 如果 interaction_type=new_planning_task 或 answer_clarification 或 confirm_requirements，复用 run_route_planning。
6. 如果 interaction_type=refine_current_plan 且上下文里有 trace_id/route_id，复用 run_route_refinement。
7. Trace 第一步必须包含 InteractionRouterAgent 的分流事件和 routing_reason。
8. 保持旧 /routes/plan 和 /chat/respond 可用，避免破坏现有前端。

验收：
- 新增 API contract 测试。
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。
- 输入“附近有没有适合聊天的咖啡馆？”返回 chat_answer。
- 输入“今天下午两个人在望京约会，少排队，吃饭加看展”返回 new_planning_task 或规划响应。
- 方案页上下文 + “第二个换成不辣的”返回 refine_current_plan。

请直接实现，不要只给方案。完成后报告接口结构、改了哪些文件、怎么验证。
```

## Agent D 提示词：前端接统一分流入口

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/FRONTEND_SPEC.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md。

你的任务是完成 P0-1 的前端部分：移除前端本地硬分流，接后端统一 /interactions/respond。

前置条件：
最好等 Agent C 完成后再做。如果 Agent C 尚未完成，你可以先准备类型和适配层，但不要删除旧接口 fallback。

背景：
- 当前 mobile-shell.tsx 的 submitSearchQuestion() 会用 isRoutePlanningGoal() 本地正则判断，然后直接调用 /chat/respond 或 /routes/plan。
- 这绕过了后端 InteractionRouterAgent。

目标：
前端所有用户输入都调用统一接口，由后端 interaction_type 决定 UI 进入 answering、clarifying、summary、plans、refining 或 selected。

重点文件：
- apps/web/lib/api.ts
- apps/web/types/dzultra.ts
- apps/web/components/mobile-shell.tsx
- apps/web/stores/use-demo-store.ts

具体要求：
1. 新增 interactRespond() API client。
2. 新增 InteractionRequestPayload、InteractionResponsePayload 类型。
3. submitPrompt()、submitSearchQuestion()、补全确认、总结确认、微调输入，尽量统一走 interactRespond()。
4. 移除或降级 isRoutePlanningGoal()，它只能作为 UI 提示，不再决定接口。
5. 根据 response.interaction_type 切换 UI：
   - chat_answer -> answering
   - needs_clarification -> clarifying
   - needs_confirmation -> summary
   - completed planning -> plans
   - refine_current_plan -> plans/refining
6. 保留旧 /routes/plan、/chat/respond 作为临时 fallback，避免后端统一入口未启动时 Demo 完全不可用。
7. Debug Trace 始终使用 response.trace。

验收：
- 搜索入口输入普通问题时，Trace 第一步仍是 InteractionRouterAgent。
- 搜索入口输入路线需求时，不再被前端正则误判。
- 方案页输入“第二个换成不辣的”能带上 interaction_context。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent E 提示词：普通问答真实 grounding + LongCat

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/BACKEND_SPEC.md、docs/internal/AGENT_STRATEGY.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md。

你的任务是完成 P0-5：普通问答改成真实 grounding + LongCat 回答。

背景：
- 当前 /chat/respond 用 mock_chat_poi_search 找 related_pois。
- LongCat 只基于 Mock POI 生成回答。

目标：
普通问答也要走清晰 Agent 链：
InteractionRouterAgent -> UserPreferenceAgent -> ContextGroundingAgent -> ChatAnswerAgent。

重点文件：
- apps/api/app/agents/runner.py
- apps/api/app/routers/chat.py
- apps/api/app/providers/adapter.py
- apps/api/app/models/schemas.py
- apps/api/tests/test_api_contracts.py

具体要求：
1. Chat 链路中 ContextGroundingAgent 优先调用 provider_adapter.poi_search。
2. 高德失败或 key 缺失时 fallback 到 Mock，并写入 Trace。
3. related_pois 必须来自本轮 provider grounding 的候选，不要直接从静态 mockPois 取。
4. ChatAnswerAgent 调 LongCat 生成 answer，prompt 必须要求只引用 related_pois 中已有事实。
5. LongCat 失败时 fallback 到模板回答，并写入 Trace。
6. Trace 中展示 provider_call、tool_input、tool_output、fallback_used、token usage。

验收：
- /chat/respond 返回 answer + related_pois + trace。
- 普通问答不生成 plans，不展示 route_scored。
- 高德可用时 Trace 显示 provider=amap。
- 高德不可用时 Trace 显示 fallback_provider=mock_poi_search。
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent F 提示词：InteractionRouterAgent 接 LongCat

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/AGENT_STRATEGY.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md。

你的任务是完成 P0-2：InteractionRouterAgent 接 LongCat。

目标：
用规则优先、LongCat 兜底或增强的方式完成输入分流。输出必须结构化并通过 Pydantic 校验。

重点文件：
- apps/api/app/agents/runner.py
- apps/api/app/agents/strategy.py
- apps/api/app/providers/adapter.py
- apps/api/app/models/schemas.py
- apps/api/tests/test_api_contracts.py

建议输出 schema：
{
  "interaction_type": "...",
  "intent_kind": "...",
  "confidence": 0.86,
  "routing_reason": "...",
  "needs_followup": false
}

具体要求：
1. 新增 router LLM prompt builder，明确页面上下文是强提示不是硬规则。
2. LongCat 返回必须 JSON parse + schema validate。
3. JSON 不合法、confidence 太低、超时或 provider 失败时，fallback 到 deterministic router。
4. Trace 记录 LLM provider、model、token usage、schema validation、fallback reason。
5. 不要让 LLM 直接决定事实问题，只做交互类型判断。

验收：
- LongCat 可用时 Trace 有 provider=longcat。
- LongCat 失败时 Trace 标记 fallback。
- 方案页“第二个换成不辣的”优先识别为 refine_current_plan。
- 搜索页“附近有什么咖啡馆”识别为 chat_answer。
- 明确路线需求识别为 new_planning_task。
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent G 提示词：ConstraintDiscoveryAgent 接 LongCat

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/AGENT_STRATEGY.md、docs/internal/BACKEND_SPEC.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md。

你的任务是完成 P0-3：ConstraintDiscoveryAgent 接 LongCat。

目标：
用 LongCat 生成结构化需求摘要、补全卡片和 Constraint Ledger 草稿。规则函数保留为 fallback 和 validator。

重点文件：
- apps/api/app/agents/requirements.py
- apps/api/app/agents/runner.py
- apps/api/app/models/schemas.py
- apps/api/app/providers/adapter.py
- apps/api/tests/test_api_contracts.py

具体要求：
1. 新增 LLM 版 requirement analyzer。
2. 输出 requirement_summary、clarification_cards、constraint_ledger_patch、grounding_requests。
3. 缺阻塞字段时必须输出 clarification_cards。
4. 最多追问 2 轮；第二轮最多 3 个问题。
5. LLM 不能生成天气、距离、营业、排队事实，只能标记 requires_grounding。
6. 输出必须 Pydantic 校验；失败时 fallback 到现有 analyze_route_requirements。
7. Trace 中显示 LLM 调用、schema 校验、fallback。

验收：
- “今天下午在北京逛逛”能追问人数和是否吃喝。
- “今天下午两个人在北京约会，不想排队，吃饭加看展”能生成可规划需求摘要。
- Trace 中 ConstraintDiscoveryAgent 展示 constraint ledger。
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent H 提示词：Debug Trace 按真实 Agent / tool use 展示

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/FRONTEND_SPEC.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md。

你的任务是完成 P0-6：Debug Trace 按真实 Agent 流程展示。

目标：
Debug 不是日志堆叠，而是按 Agent 展示输入、tool use、观察结果、输出、handoff、fallback、耗时和 token。

重点文件：
- apps/web/components/debug-trace-panel.tsx
- apps/web/types/dzultra.ts
- apps/web/lib/api.ts
- 必要时配合 apps/api/app/models/schemas.py

具体要求：
1. Agent Flow 左侧按真实 Agent 聚合，不为展示效果虚构 Agent。
2. 右侧详情至少包含：
   - 输入
   - 处理摘要
   - tool calls
   - observations
   - 输出
   - fallback
   - token/cost
3. 候选池只展示当前 run 的 accepted/rejected POI。
4. 普通问答时不展示路线评分页，只展示 related_pois 和 ChatAnswerAgent。
5. 地图页展示 provider、distance matrix、fallback、coordinate_confidence。
6. Mock 数据页只展示当前 run 用到的 Mock 字段，不展示全量基础 Mock 池。
7. 完整 JSON 展示当前 activeTrace，不再使用 trace-static-fallback 伪装当前 run。

验收：
- 首屏无 activeTrace 时 Debug 是空态。
- 路线规划后能按 7 个 Agent 看完整链路。
- 普通问答后能按 chat 链路看完整过程。
- fallback 用黄色/警告态明显标出。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent I 提示词：PlanSolverAgent 多候选路线生成

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/AGENT_STRATEGY.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md。

你的任务是完成 P1-3：PlanSolverAgent 不再只套固定三站模板。

目标：
基于候选 POI、约束账本和 route_matrix 生成 5-10 个候选路线，再交给 Evaluator 筛成最终 3 个方案。

重点文件：
- apps/api/app/agents/mock_tools.py
- apps/api/app/agents/runner.py
- apps/api/app/models/schemas.py
- apps/api/tests/test_api_contracts.py

具体要求：
1. 按用户需求构建 stop slots，例如 food/culture/dessert/shopping/entertainment。
2. 从候选池中组合多条路线。
3. 结合时间窗、停留时长、route_matrix 过滤明显不可行路线。
4. 支持不吃饭路线，不能强行塞 food/dessert。
5. 生成不同风格候选，例如低排队、少走路、拍照、预算友好。
6. Trace 中输出 candidate_plans 和 solver_notes。

验收：
- route_candidate_generated 中候选数量大于最终 plans 数量。
- 最终 3 个方案之间有明显差异。
- 无餐饮需求时最终方案不包含 food/dessert。
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent J 提示词：PlanEvaluatorAgent 评分拆解与淘汰理由

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/AGENT_STRATEGY.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md。

你的任务是完成 P1-4：PlanEvaluatorAgent 评分更可解释。

目标：
对候选路线进行硬约束校验、软约束评分、排序和淘汰，输出完整 score_breakdown。

重点文件：
- apps/api/app/agents/mock_tools.py
- apps/api/app/agents/runner.py
- apps/api/app/models/schemas.py
- apps/web/components/debug-trace-panel.tsx
- apps/api/tests/test_api_contracts.py

评分维度至少包含：
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

具体要求：
1. 硬约束失败的候选路线要淘汰或要求 Solver 重算。
2. 每个最终方案都要有 score_breakdown。
3. 每个被淘汰候选要有 rejected_route_reason。
4. Debug Trace 中 route_scored 事件要包含 plan_scores、blocking_issues、rejected_route_reasons。
5. 用户端仍弱化数字，Debug 端展示完整分数。

验收：
- Debug 排序页能看到每个方案的评分拆解。
- 被淘汰候选有明确原因。
- 硬约束违反不会悄悄进入最终方案。
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## 如果只开一个窗口，推荐此窗口继续的任务

如果你只想让一个 Agent 稳稳推进，建议先做 Agent A。

原因：

- 它是当前真实 provider 接入的硬断点。
- 不修它，高德真实 POI 一命中就可能让 `/routes/plan` 500。
- 修完后，后续 LongCat、Debug Trace、统一分流都有更稳定的数据基础。

单窗口顺序建议：

```text
Agent A -> Agent B -> Agent C -> Agent D -> Agent F -> Agent G -> Agent E -> Agent H -> Agent I -> Agent J
```

如果要并行，建议先开两个窗口：

```text
窗口 1：Agent A
窗口 2：Agent B
```

等这两个合并或确认完成后，再开：

```text
窗口 3：Agent C
窗口 4：Agent F
```

但 Agent D 最好等 Agent C 的接口结构稳定后再开始。

