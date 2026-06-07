# DZUltra Agent 策略

> Agent 可以理解为“负责某个子任务的小助手”。本文档定义 DZUltra 的 Agent 为什么存在、怎么分工、怎么调用工具、怎么把过程展示给 Debug Trace。

## 1. 核心判断

DZUltra 的 Agent 不是为了闲聊，而是为了做本地出行 plan。

本地出行 plan 的本质是：在用户本轮目标下，持续发现、补全、校验和应用各种约束条件，最后求出几个最优可行解。

这里的“约束”包括用户直接说出来的要求，也包括系统通过 API、数据库、Mock provider 和用户历史行为推导出来的限制。例如：

- 用户目标：今天下午两个人在静安约会，想吃饭加看展。
- 显性约束：时间窗、人数、城市/商圈、是否吃喝、预算、不想排队。
- 隐性约束：约会需要环境稳定、动线不要太狼狈、不要太吵。
- 长期偏好：用户历史收藏、评分、去过的店、自己写过的 UGC 评论语料。
- 环境约束：未来天气、交通拥堵预测、地铁/步行/打车耗时。
- POI 约束：营业时间、预计到达时是否营业、当前排队人数、预测等位人数、价格、评分、标签、网友推荐菜。
- 系统约束：主链路尽量 10 秒内返回。

因此，Agent 的第一目标不是“生成答案”，而是建立准确的约束账本，再基于约束账本规划和排序。

## 2. 当前阶段目标

当前进入 V3 接入阶段。高德地图、彩云天气和 LongCat LLM 开始作为真实 provider 接入；排队、UGC、推荐菜、用户历史行为等大众点评深度数据继续用 Mock，也就是先用假的样例数据模拟真实数据。

V3 真实接入的重点是 Agent 能力和接口边界。真实 provider 与 Mock fallback 必须共存：真实接口失败时可以回退 Mock，但 Trace 要写清楚 fallback 原因。

V2/V3 的共同判断标准：

- 如果把真实 provider 和 Mock provider 来回切换，前端体验和 API response shape 不需要大改。
- 推荐结果必须能解释。
- Debug 端必须能看懂 Agent 全链路。
- 大模型不能凭空判断天气、距离、营业、排队和交通事实。

## 3. 已确认的 V2/V3 口径

| 主题        | 已确认决策                                                          |
| --------- | -------------------------------------------------------------- |
| 普通 LLM 对话 | 返回 `answer + related_pois + trace`，不生成完整路线时间线                  |
| 路线规划触发    | 只要包含出行目标、时间、地点或人群倾向，就进入路线规划；纯知识问答或简单 POI 咨询才走普通对话              |
| Plan 模式   | 用户端默认打开“路线规划”模式；它是意图倾向，不是硬规则，也不替代自动分流                          |
| 追问轮数      | 最多 2 轮；第二轮最多 3 个偏好问题                                           |
| 阻塞字段      | 目标城市/区域、时间窗、人数、是否安排吃喝会阻塞规划                                     |
| 非阻塞字段     | 预算、口味、体力、交通偏好、拍照偏好、少排队等可追问，也可用默认假设继续                           |
| 需求确认      | 可以在确认页展示 Agent 推荐的软约束，让用户一键选择同样在意的东西                           |
| 方案数量      | V2 固定 3 个方案；V3 可扩展到 3-5 个动态方案                                  |
| 排序与打分     | 必须保留内部评分和 `score_breakdown`，用户端展示“推荐 / 更轻松 / 更省钱 / 更适合拍照”等标签   |
| 模拟耗时      | 后端 Trace 写 `duration_ms`，前端按它播放 Agent 动效；API 本身不必真的慢很多         |
| 地图        | V3 优先接高德地图 API，失败时 fallback mock provider 或 mock png |
| 天气        | V3 当前接彩云天气，用于降水、温度、风和室内/室外约束判断 |
| LLM        | V3 当前接 LongCat OpenAI-compatible API，用于理解、提问、文案和 Mock 数据生成增强 |
| V3 数据     | 排队、UGC、推荐菜、用户历史行为继续 Mock，但字段、provider、trace 按真实数据设计   |

## 4. 约束账本 Constraint Ledger

所有 Agent 都围绕 `Constraint Ledger` 工作。它可以理解为“本轮规划的约束清单和证据表”。

每个约束至少要记录：

| 字段            | 说明                                                                    |
| ------------- | --------------------------------------------------------------------- |
| `id`          | 稳定 ID，例如 `time.window`、`poi.business_hours`                           |
| `label`       | 给人看的名字，例如“晚饭前结束”“不想排队”                                                |
| `description` | 约束具体内容                                                                |
| `category`    | 时间、地点、人数、预算、天气、交通、POI、UGC、偏好、系统规则等                                    |
| `hardness`    | `hard` 硬约束或 `soft` 软约束                                                |
| `source`      | 用户显式输入、历史偏好、天气 provider、交通 provider、POI provider、UGC provider、LLM 推断等 |
| `reliability` | `verified`、`mocked`、`predicted`、`inferred`、`missing`                  |
| `evidence`    | 支撑该约束的原文、provider 输出或 Mock 数据字段                                       |
| `impact`      | 过滤、加分、扣分、风险提醒、触发追问、解释文案                                               |
| `status`      | 已发现、已落地、缺失、满足、违反、使用默认假设                                               |
| `weight`      | 软约束权重，供排序使用                                                           |

硬约束不能随便违反，例如：

- 到达时 POI 已经关门。
- 用户明确说不吃饭，但方案里安排餐厅。
- 时间窗不足以完成路线。

软约束尽量满足，例如：

- 不偏好排队。
- 更想坐地铁。
- 少走路。
- 下雨时尽量走室内路线。
- 更想要网友推荐菜明确的餐厅。

LLM 最终做规划判断时，不能只看到一个短标签。每个约束都要带足够上下文，说明这个约束意味着什么、可信度如何、违反它的后果是什么。

## 5. 真实运行的主规划 Agent

Debug Trace 只展示真实运行的 Agent。不要为了展示效果额外虚构很多 Agent 名称。

主规划链路保留 7 个 Agent。每个 Agent 不是只能调用一次 LLM；一个 Agent 是稳定职责边界，内部可以按 ReAct 思路多步执行：理解、调用工具、观察结果、继续调用工具、输出结构化 JSON。

| Agent                      | 核心职责                                              | 是否主规划必经        | LLM 使用建议               |
| -------------------------- | ------------------------------------------------- | -------------- | ---------------------- |
| `InteractionRouterAgent`   | 判断本轮是新规划、回答补全、确认需求、微调当前方案、切换任务还是普通问答              | 是              | 小模型或规则优先，必要时 1 次 LLM   |
| `ConstraintDiscoveryAgent` | 拆解本轮用户目标和全部语义约束，区分硬/软约束，决定是否追问                    | 是              | 关键 LLM；输出必须 schema 校验  |
| `UserPreferenceAgent`      | 读取和总结历史收藏、评分、去过的店、用户写过的 UGC 评价，形成长期偏好约束           | 主链读取，首次进入可异步预热 | 可异步 LLM，总结结果写入缓存       |
| `ContextGroundingAgent`    | 调用天气、交通、地图、POI、营业时间、排队预测、UGC、推荐菜 provider，把约束落到事实 | 是              | 主要是 tool 调用，不让 LLM 猜事实 |
| `PlanSolverAgent`          | 基于约束账本生成多个候选 plan，安排 POI 组合、顺序、到达时间、停留时长、交通方式     | 是              | 规则/算法为主，LLM 只做有限辅助     |
| `PlanEvaluatorAgent`       | 校验方案是否违反约束，计算分数、拆解得分、排序，必要时退回 Solver 重算           | 是              | 确定性检查为主，LLM 可辅助解释冲突    |
| `PlanExplanationAgent`     | 把最终 3 个方案解释给用户，生成标题、亮点、风险提醒、每个 POI 推荐理由和推荐菜展示     | 是              | 关键 LLM；只基于已落地事实写文案     |

辅助链路：

| Agent             | 用途                                                | 与主规划关系        |
| ----------------- | ------------------------------------------------- | ------------- |
| `ChatAnswerAgent` | 普通 POI 问答，返回 `answer + related_pois + trace`      | 非主规划路径        |
| `MockDataAgent`   | 开发者/评审面板中生成 Mock User、Mock POI、Mock UGC、Mock 环境数据 | 开发者路径，不阻塞用户规划 |

`UserPreferenceAgent` 比较特殊：它可以在用户第一次进入时后台预热，不阻塞首次规划。主规划时只读取已经可用的偏好缓存；如果缓存没完成，就用默认偏好继续，并在 Trace 中标记 `preference_warmup_pending=true`。

## 6. ConstraintDiscovery 与 ContextGrounding 的区别

`ConstraintDiscoveryAgent` 负责“看懂用户和任务”：

- 用户想做什么。
- 当前有哪些显性约束和隐性约束。
- 哪些是硬约束，哪些是软约束。
- 哪些缺失信息会阻塞规划。
- 是否需要追问。

它处理的是语义层面的约束。例如：

- “约会”意味着环境、动线、噪音、排队稳定性都重要。
- “不想排队”是软约束还是硬约束，取决于用户表达强度。
- “下午”需要转成可规划时间窗，如果太模糊可以追问。

`ContextGroundingAgent` 负责“把约束落到真实世界事实”：

- 18:00-20:00 是否下雨。
- 晚高峰打车是否拥堵，地铁是否更稳。
- 某家店到达时是否营业。
- 当前排队多少人，计划到达时预计等位多少人。
- 从 A 到 B 不同交通方式要多久。
- 评论里是否集中提到“吵”“服务慢”“排队久”。
- 餐厅的网友推荐菜、大家都在点是什么。

一开始不应该盲目调用所有天气、交通和 POI 工具。正确顺序是：

1. `InteractionRouterAgent` 判断是不是规划、微调、切换任务或普通问答。
2. `ConstraintDiscoveryAgent` 做最小约束发现，判断是否具备基本规划范围。
3. 如果缺城市/区域、时间窗、人数、是否安排吃喝等阻塞字段，先追问。
4. 一旦具备基本范围，`ContextGroundingAgent` 并行调用天气、交通、地图、POI、营业、排队、UGC 等 provider。
5. 用户后续新增约束时，只补相关 provider 数据，并局部重跑 Solver/Evaluator。

## 7. PlanSolverAgent 的规则/算法

`PlanSolverAgent` 不应该让 LLM 直接“想三个方案”。更稳的方式是先枚举候选解，再过滤、重排和打分。

建议流程：

1. 读取 `Constraint Ledger`，确认目标、时间窗、地点、人数、饮食/体验目标。
2. 把目标拆成 stop slots，例如“咖啡/餐厅 -> 看展 -> 甜品/夜景”。
3. 从 `ContextGroundingAgent` 给出的候选 POI 中按类别、区域、评分、标签、营业状态、排队风险筛选候选池。
4. 生成多组候选组合，例如：
   - 少排队方案。
   - 地铁友好方案。
   - 少走路/更轻松方案。
   - 拍照/体验优先方案。
   - 预算友好方案。
5. 对每组候选安排顺序、到达时间、停留时长和交通方式。
6. 丢弃明显不可行方案，例如到店关门、总时长超窗、跨区移动过大。
7. 至少给 `PlanEvaluatorAgent` 5-10 个候选，最终筛成 3 个可解释方案。

可用的确定性算法不需要复杂到旅行商问题完整求解。V2/V3 初期可以用：

- 类别 slot 填充：每个体验阶段选一类 POI。
- Beam search：每个 slot 保留前 N 个候选，组合时剪枝。
- 硬约束过滤：营业、时间窗、是否吃喝、距离上限。
- 软约束加权：排队、天气适配、交通稳定、预算、偏好匹配、UGC 质量。
- 局部重跑：用户锁定某个 POI 时，只替换未锁定 slots。

LLM 可以辅助做两件事：

- 当用户目标比较抽象时，把目标拆成合理的 stop slots。
- 在多个可行候选之间，判断哪种路线风格更符合用户表达。

LLM 不能负责：

- 猜距离。
- 猜交通耗时。
- 猜营业状态。
- 猜真实排队人数。
- 凭空编造推荐菜。

## 8. PlanEvaluatorAgent 的打分与排序

`PlanEvaluatorAgent` 负责校验、打分、排序。校验和排序必须放在同一个真实 Agent 边界里，否则 Debug 会看起来像两套系统在分别判断。

打分必须可拆解，至少包含：

| 维度                 | 含义                   |
| ------------------ | -------------------- |
| `hard_constraint`  | 硬约束是否全部满足；有严重违反时直接淘汰 |
| `queue`            | 当前排队和预测等位是否符合用户偏好    |
| `business_hours`   | 每个 POI 到达和离开时是否营业    |
| `traffic`          | 交通时间、拥堵风险、交通方式稳定性    |
| `weather_fit`      | 天气对步行、室外、排队、拍照的影响    |
| `preference_fit`   | 长期偏好和本轮偏好匹配度         |
| `ugc_quality`      | 评论、评分、标签、风险语料、推荐菜支撑  |
| `route_efficiency` | 路线是否顺路、是否少折返、总时长是否合理 |
| `budget`           | 人均预算是否合适             |
| `diversity`        | 3 个方案之间是否真的有差异       |

用户端不强调精确数学分数，可以展示“推荐指数”和排序理由。Debug Trace 必须展示完整 `score_breakdown`。

## 9. ReAct 与 LLM 调用预算

每个 Agent 可以用 ReAct，但主链路不能无限循环。为了 V3 真实大模型接入后总时间尽量控制在 10 秒内，需要设置预算。

建议主链路预算：

| Agent                      | LLM 调用预算           | 说明                         |
| -------------------------- | ------------------ | -------------------------- |
| `InteractionRouterAgent`   | 0-1 次              | 规则优先，小模型兜底                 |
| `ConstraintDiscoveryAgent` | 1 次关键调用，可最多 1 次自修复 | 输出约束账本草稿和追问判断              |
| `UserPreferenceAgent`      | 0-1 次，优先异步         | 首次进入预热，不阻塞主链               |
| `ContextGroundingAgent`    | 0 次主判断             | 并行调用 provider，LLM 不猜事实     |
| `PlanSolverAgent`          | 0-1 次              | 规则生成候选，LLM 辅助 slot 拆解或风格选择 |
| `PlanEvaluatorAgent`       | 0-1 次              | 确定性打分为主，LLM 可辅助冲突解释        |
| `PlanExplanationAgent`     | 1 次关键调用            | 生成用户端解释文案                  |

推荐主链路控制为：2-3 次关键 LLM 调用 + 并行工具调用 + 确定性 Solver/Evaluator。

如果超过预算：

- 先返回稳定的 3 个可行方案。
- 把未完成的偏好更新、长 UGC 总结、Mock 数据生成放到后台。
- 在 Trace 中标记哪些步骤使用 fallback。

## 10. LangGraph 状态图目标

V3 应该用 LangGraph 或等价状态机表达流程，因为用户会中途补充约束、换方向、锁定 POI、追加新要求。

建议状态图：

```text
START
  -> InteractionRouterAgent
  -> ConstraintDiscoveryAgent
      -> needs_clarification ? WAIT_USER_INPUT
      -> chat_answer ? ChatAnswerAgent
      -> switch_task ? ConstraintDiscoveryAgent(new run)
  -> UserPreferenceAgent
  -> ContextGroundingAgent
  -> PlanSolverAgent
  -> PlanEvaluatorAgent
      -> failed_hard_constraints ? PlanSolverAgent(retry)
      -> passed ? PlanExplanationAgent
  -> END

用户后续输入：
  - 补充约束 -> ConstraintDiscoveryAgent -> ContextGroundingAgent(局部) -> PlanSolverAgent/Evaluator
  - 锁定 POI / 换一个点 -> InteractionRouterAgent -> PlanSolverAgent(局部) -> PlanEvaluatorAgent
  - 换方向 / 换城市 / 换时间 -> InteractionRouterAgent -> new run
  - 普通问答 -> ChatAnswerAgent
```

LangGraph state 至少要保存：

- `request`
- `interaction_type`
- `constraint_ledger`
- `preference_profile`
- `grounded_context`
- `candidate_pois`
- `candidate_plans`
- `evaluated_plans`
- `selected_plan_id`
- `trace_events`
- `retry_count`
- `fallback_flags`

## 11. Provider 与数据需求

V2/V3 需要的 provider 先按真实结构设计。没有官方 API 时，用 LLM Mock Data Provider 或 deterministic mock provider 仿真。

### 环境与交通

- 天气预测：未来不同时段天气、降雨概率、温度、体感、是否适合步行/室外。
- 交通预测：未来不同时段拥堵指数、打车耗时、地铁耗时、步行/骑行可行性。
- 地图距离：POI 坐标、路线距离、交通方式、路线线段、地图预览。

### POI 与大众点评数据

每个 POI 需要尽量支持：

- 营业时间。
- 当前营业状态。
- 计划到达时是否营业。
- 当前排队人数。
- 计划到达时预测等位人数。
- 价格、人均、评分、评论数。
- 评论语料、评分、标签、风险提示。
- 网友推荐菜、大家都在点。

未来大众点评侧需要埋点或数据支持：

- 历史等位数据：用于预测 plan 中每个到达时间的等位人数。
- 当前排队人数。
- 用户评价语料：着重看评论、评分、标签。
- 推荐菜/大家都在点数据。
- 用户历史收藏、评分、去过的店、用户自己写过的 UGC 评价。

## 12. Debug Trace 原则

Debug Trace 展示真实 Agent，不额外拆虚构 Agent。

每个 Agent 下可以展开：

- Agent 输入。
- ReAct 内部 step。
- 调用的 tool/provider。
- provider 输入输出。
- 约束账本变化。
- fallback。
- 耗时、模型名、token、成本估算。

建议事件类型：

- `run_started`
- `agent_started`
- `tool_called`
- `constraint_discovered`
- `clarification_requested`
- `requirements_summarized`
- `preference_detected`
- `context_grounded`
- `candidate_retrieved`
- `map_context_resolved`
- `route_candidate_generated`
- `constraint_checked`
- `route_scored`
- `user_refinement_received`
- `task_switched`
- `chat_answered`
- `run_completed`
- `run_failed`

## 13. Prompt Contract 原则

不要只写散文式 prompt。每个 Agent 都要有 prompt contract，也就是“输入、工具、输出、禁止行为、失败兜底”的契约。

每个 contract 至少包含：

- Agent 名称。
- 任务目标。
- 输入 schema。
- 输出 schema。
- 可调用工具。
- ReAct 最大步数。
- LLM 调用预算。
- 延迟预算。
- Guardrails，也就是禁止模型做什么。
- Fallback。

示例：

```json
{
  "agent_name": "ConstraintDiscoveryAgent",
  "input_schema": "RoutePlanRequest + InteractionContext + existing ConstraintLedger",
  "output_schema": "ConstraintLedger + RequirementSummary + ClarificationCard[]",
  "tools": ["schema_validator", "clarification_card_builder"],
  "max_llm_calls": 1,
  "guardrails": [
    "不能编造天气、交通、营业、排队事实",
    "缺阻塞字段时必须输出 clarification_cards",
    "每个约束必须标注 source 和 reliability"
  ]
}
```

## 14. 普通问答与 MockDataAgent

普通问答不是主规划链路。

```text
InteractionRouterAgent
  -> UserPreferenceAgent(读取缓存)
  -> ContextGroundingAgent(轻量 POI 检索)
  -> ChatAnswerAgent
```

它返回 `answer + related_pois + trace`，不返回完整 3 个 plan。

`MockDataAgent` 是开发者/评审面板能力：

```text
演示者输入生成要求
  -> MockDataAgent
  -> LLM Mock Data Provider
  -> Pydantic 校验
  -> 地图 provider 校验或补齐坐标
  -> 前端预览
```

MockDataAgent 不参与用户主规划链路，但它生成的数据必须符合真实 provider schema。

## 15. 实现顺序

1. 设计并落地 `Constraint Ledger` schema。
2. 设计 LangGraph state、nodes、edges 和条件回退。
3. 为 7 个主规划 Agent 写 prompt contract。
4. 收敛后端 `MAIN_PLANNING_AGENT_STRATEGY` 到真实运行 Agent。
5. 让 Trace 事件使用同一套 Agent 名称，并在 metadata 中暴露约束账本。
6. 下一步再确认 provider contract：天气、交通、地图、POI、排队、UGC、推荐菜、用户历史。
7. 在 provider contract 确认后，补强 PlanSolver/Evaluator 的规则和 Debug 面板展示。
