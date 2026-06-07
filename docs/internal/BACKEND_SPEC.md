# DZUltra 后端实现规范

> 范围：`apps/api`、`data/mock`，以及 Web 端需要调用的后端接口。本文档补足总规划里没有展开的 API、schema、Mock 数据、Trace、地图 provider 和 LLM 数据边界。

## 1. 后端职责

后端要服务五件事：

1. 给用户端返回可渲染的路线方案。
2. 给普通 POI 问答返回轻量 `answer + related_pois + trace`。
3. 给 Debug Trace 返回可解释的 Agent 执行过程。
4. 给 Web 端提供 Mock 用户、Mock POI、Mock UGC、Mock 地图和本地偏好档案。
5. 给 V3 接入 LongCat LLM、高德地图、彩云天气；用户档案、排队、UGC、推荐菜等深度字段继续使用本地 Mock 数据。

当前阶段是 V3。真实 provider 要逐步进入主链路；没有网络、真实 provider 配额不足或调用失败时，仍必须能用 deterministic mock runner 跑完整流程，并在 Trace 中标明 fallback。

V3 当前真实接入优先级：LongCat LLM、高德地图、彩云天气。排队、UGC、推荐菜、用户历史行为继续 Mock。

## 2. 技术边界

- FastAPI 提供 HTTP API。
- Pydantic 定义请求、响应、Agent tool 输入输出和 Trace event。
- `data/mock` 存放可读的 JSON 样例。
- `apps/api/app/agents` 负责 runner、Agent 策略、mock tools。
- `apps/api/app/traces` 负责 TraceStore。
- LongCat 通过 OpenAI-compatible 接口接入，后续可继续用 OpenAI Agents SDK / LangGraph 表达 Agent 流程。
- 地图能力需要 provider 边界：V3 当前优先接高德地图，失败时回退 mock。
- 天气能力需要 provider 边界：V3 当前优先接彩云天气，失败时回退 mock。
- 后端命令优先在 Conda `agent` 环境中运行，例如 `conda run -n agent pytest`。

## 3. API 规划

当前 API：

| Method | Path | 当前要求 |
| --- | --- | --- |
| `GET` | `/health` | 返回服务健康状态 |
| `GET` | `/mock/users` | 返回 Mock 用户列表 |
| `GET` | `/mock/pois` | 返回 Mock POI 列表 |
| `POST` | `/routes/plan` | 返回 `plan + plans + trace`，或返回补全问题 |
| `POST` | `/routes/refine` | 基于当前方案返回更新后的 `plan + trace + refinement_diff` |
| `GET` | `/traces` | 返回 run 摘要列表 |
| `GET` | `/traces/{trace_id}` | 返回单次完整 Trace |
| `GET` | `/profiles/{user_id}/preferences` | 读取本地 Mock 用户偏好 |
| `POST` | `/profiles/preferences/detect` | 从用户输入中检测并保存偏好 |
| `GET` | `/providers/status` | 返回高德、彩云、LongCat 是否已配置，不泄露完整 Key |

V3 增强 API：

| Method | Path | 阶段 | 用途 |
| --- | --- | --- | --- |
| `POST` | `/chat/respond` | V3 LongCat + fallback | 普通 POI 问答，不生成完整路线 |
| `POST` | `/mock/generate-user` | V3 LongCat + fallback | 根据场景描述生成 Mock 用户 |
| `POST` | `/mock/generate-pois` | V3 LongCat + fallback | 根据城市、商圈、主题生成 Mock POI 批次 |
| `POST` | `/mock/generate-ugc` | V3 LongCat + fallback | 根据 POI 和用户场景生成 Mock UGC 摘要 |
| `POST` | `/mock/commit-generated` | V3 本地写入 | 把生成结果保存为当前演示数据 |
| `POST` | `/maps/geocode` | V3 高德 + fallback | 地址转坐标 |
| `POST` | `/maps/route-matrix` | V3 高德 + fallback | 获取 POI 间距离和耗时 |
| `POST` | `/maps/static-preview` | V3 高德 + fallback | 获取地图预览 |
| `POST` | `/providers/llm/smoke-test` | V3 LongCat | 手动验证 LongCat Key、base URL 和模型配置 |
| `POST` | `/providers/weather/smoke-test` | V3 彩云 | 手动验证彩云天气 token 和经纬度天气查询 |

## 4. 数据模型原则

Pydantic schema 要优先稳定这些前端场景：

- 方案卡片：标题、匹配度分、排序理由、亮点、交通摘要、小地图点、POI 列表。
- POI 行：名称、类别、城市、商圈、地址、坐标、价格/人均、评分、营业时间、排队、标签、UGC 摘要、推荐理由。
- 信息补全卡片：字段、问题类型、默认值、选项、其他入口、是否阻塞规划。
- 普通 POI 问答：answer、related_pois、使用的偏好、是否可转为路线规划。
- 方案微调结果：被替换/保留/重排的 POI、变更理由。
- Debug Trace：事件类型、Agent 名称、输入输出摘要、tool 调用、handoff、fallback、模拟耗时。
- 地图预览：点位、路线线段、距离/耗时摘要、provider、mock png fallback。

不要为了真实平台字段一次性塞太多属性。字段要先服务展示、筛选、解释和调试。

## 5. Mock 数据策略

### V3：真实 provider + Mock fallback

继续维护这些 Mock 文件，因为排队、UGC、推荐菜、用户历史行为等深度数据当前仍 Mock：

```text
data/mock/users.json
data/mock/pois.json
data/mock/user_preferences.json
```

要求：

- 样例要贴近真实大众点评场景。
- 每个 POI 至少能解释“为什么被选中”。
- 每个被排除的候选也要尽量解释“为什么不选”。
- 固定样例必须支持默认演示 prompt 稳定通过。
- Mock POI 应尽量包含城市、商圈、地址、经纬度、营业时间和访问时长。
- Mock 地图数据要包含点位、估算距离、估算耗时，作为高德地图失败时的 fallback。

### V3：右侧面板实时生成 Mock

完整 Web 端可以加入 MockDataAgent，展示系统对于数据的可处理性：

```text
演示者输入生成要求
  -> POST /mock/generate-user 或 /mock/generate-pois
  -> LongCat 生成结构化 JSON
  -> Pydantic 校验
  -> 地图 provider 校验或补齐坐标
  -> 前端预览
  -> 可选保存到本地演示数据
```

生成器必须有 fallback：LongCat 失败时返回内置模板，并在 Trace 或返回 metadata 中标记 `fallback_used=true`。

Mock POI 生成要遵守地理一致性：

- LLM 可以生成城市、商圈、POI 类型、标签、UGC 风格和大致地址。
- 坐标优先由 `geocode` 工具校验生成；无法校验时使用商圈中心点加小范围偏移。
- 生成结果要标记 `coordinate_confidence`，例如 `verified`、`mocked`、`missing`。
- 距离和通勤时间统一由 `route_matrix` 计算，不允许写死在 LLM 文案里。

### V3：当前真实数据源

- LongCat 理解真实 prompt。
- 高德地图返回真实距离、耗时、静态图或路线点。
- 彩云天气返回天气约束。
- 用户档案、排队、UGC、推荐菜继续 Mock，后续再迁移到真实账号/数据库或合作数据源。

## 6. `/routes/plan` 要求

`/routes/plan` 必须返回：

- `trace_id`
- `plan`
- `trace`
- `plans`
- `selected_plan_id`
- `clarification_cards`
- `requirement_summary`
- `planning_status`
- `generation_metadata`

扩展时要兼容旧前端：保留 `plan` 指向默认主方案。若 `planning_status=needs_clarification` 或 `input_not_plannable`，`plan` 只是兼容旧页面的空草稿，前端应优先展示 `clarification_cards`。

关键状态：

| `planning_status` | 含义 | 前端动作 |
| --- | --- | --- |
| `needs_clarification` | 缺目标城市/区域、时间窗、人数、是否安排吃喝等阻塞字段 | 展示补全卡片，等用户回答后再次调用 `/routes/plan` |
| `needs_confirmation` | 需求已齐，但请求要求先确认总结 | 展示需求总结卡片，确认后带 `confirmed_requirements=true` 重发 |
| `input_not_plannable` | 用户输入不像路线规划，或像无上下文微调 | 询问用户是否继续规划/补充目标 |
| `completed` | 已完成路线生成 | V3 展示 3 个方案和 Debug Trace，后续可扩展到 3-5 个动态方案 |

V3 继续维护和补强字段：

| 字段 | 说明 |
| --- | --- |
| `RoutePlanRequest.plan_mode` | `true` 时模糊输入偏向路线规划；`false` 时模糊输入偏向普通 POI 问答；它不是硬规则 |
| `RoutePlanRequest.interaction_context` | 当前页面、当前方案、当前补全卡片、选中 POI 等页面上下文 |
| `RoutePlanResponse.interaction_type` | 本次输入被识别成新规划、普通问答、补全回答、微调、选用方案或切换任务 |
| `ClarificationCard.ui_component` | `choice_buttons`、`number_picker`、`time_range_picker`、`budget_picker`、`free_text` 等 |
| `ClarificationCard.allow_other` | 选择题是否允许其他输入；默认应该为 true |
| `ClarificationCard.round_index` | 当前是第几轮追问，用于限制最多 2 轮 |
| `RoutePlan.rank_reason` | 当前方案为什么排在这个位置 |
| `RoutePlan.score_breakdown` | 内部匹配度拆解 |
| `RoutePlan.map_preview` | 地图预览 provider 数据，V3 高德优先，失败时 mock |
| `TraceEvent.duration_ms` | 模拟或真实耗时，用于前端 Agent 动效 |

V2 固定返回 3 个方案。V3 可以在 `generation_metadata.plan_count` 中返回 3-5 个动态方案。

## 7. 普通 LLM 对话

普通 LLM 对话指“用户不是要完整路线，只想基于附近 POI 信息得到一个直接回答”。例如：

- “附近有没有适合聊天的咖啡馆？”
- “这附近有什么不太排队的甜品？”
- “我不想规划，先推荐几个方向。”

V2 新增 `/chat/respond` 的 mock 版本：

```text
ChatRequest
  -> InteractionRouterAgent 判断为 chat_answer
  -> UserPreferenceAgent 读取可用偏好缓存
  -> ContextGroundingAgent 轻量检索相关 POI / UGC 摘要
  -> ChatAnswerAgent 生成 answer + related_pois
  -> 返回 trace
```

建议响应结构：

```json
{
  "trace_id": "trace-chat-001",
  "answer": "附近更适合聊天的是 A 和 B，排队都不长。",
  "related_pois": [],
  "can_convert_to_plan": true,
  "trace": {}
}
```

它不返回完整 `plans`，但要返回可展示的引用 POI 和 Trace。

## 8. 输入分流与页面上下文

后端每次收到用户输入时，都要先进行轻量分流。这个能力属于 `InteractionRouterAgent`。`ConstraintDiscoveryAgent` 只在确定进入规划、补全或微调路径后，负责拆解目标和约束。

分流输入建议包含：

```json
{
  "goal": "第二个换成不辣的",
  "plan_mode": true,
  "interaction_context": {
    "page": "plans",
    "trace_id": "trace-001",
    "route_id": "route-relaxed-001",
    "selected_plan_id": "route-relaxed-001",
    "selected_stop_index": 1,
    "pending_clarification_card_id": null
  }
}
```

建议输出：

```json
{
  "interaction_type": "refine_current_plan",
  "intent_kind": "planning",
  "confidence": 0.88,
  "reason": "用户位于方案页，且输入提到第二个站点，优先理解为当前方案微调。"
}
```

`interaction_type` 建议枚举：

| 类型 | 场景 | 后续行为 |
| --- | --- | --- |
| `new_planning_task` | 新路线规划 | 跑完整规划链 |
| `chat_answer` | 普通 POI 问答 | 返回 `answer + related_pois + trace` |
| `answer_clarification` | 回答补全卡片 | 合并答案后继续规划 |
| `confirm_requirements` | 确认需求总结 | 进入候选检索和路线生成 |
| `refine_current_plan` | 微调当前方案 | 调用 `/routes/refine` 或局部重跑 |
| `select_plan` | 选用方案 | 进入选用方案状态 |
| `switch_task` | 当前任务中途换目标 | 记录旧 run，开启新 run |

页面状态是强提示，不是硬规则。用户在方案页输入“第二个换成川菜”应走微调；但输入“算了，明天带娃去上海迪士尼附近玩”应走 `switch_task` 或 `new_planning_task`。

V2 先不做新窗口按钮。`switch_task` 可以直接替换当前任务，并在 Trace 里记录 `switch_task=true`、`previous_trace_id` 和切换原因。

## 9. `/routes/refine` 要求

微调不是简单重新生成。优先顺序：

1. 能局部替换就局部替换，比如“第二个换成川菜”。
2. 用户明确说“重新生成”时再全链路重跑。
3. 用户说“保留第一个和第三个”时，锁定对应 POI。
4. 每次微调都追加 `user_refinement_received` Trace event。
5. 微调输入也要交给 `UserPreferenceAgent` 异步分析，例如用户连续说“不想吃辣”“别太累”，应成为长期偏好候选。

返回结果要告诉前端哪些地方变了，方便做行级高亮动画。

当用户输入“不要这个、重新生成、换个思路、从头来”等整体改向指令时，`refinement_diff.strategy` 必须是 `full_rerun`，并追加 `user_refinement_received` Trace event。

## 10. UserPreferenceAgent

V3 需要一个 Agent 根据用户输入、做出的选择和微调行为实时分析用户偏好。V2 先用本地 JSON Mock 档案模拟。

输入来源：

- 用户原始 prompt。
- clarification card 的回答。
- 方案选择行为，例如选择“更轻松”的方案。
- 微调指令，例如“不想吃辣”“少走路”“换个便宜点的”。

输出：

- `detected_preferences`
- `preference_updates`
- `confidence`
- `source_trace_id`
- `source_prompt`

规则：

- 区分长期偏好和本轮临时意图。比如“今天下午去望京”不是长期偏好，“少走路”可能是长期出行风格。
- 低置信度偏好可以先进入候选，不一定自动影响推荐。
- 用户在设置页删除或修正偏好后，后续推荐必须尊重。

## 11. LLM Context Pack

V3 接 LLM 时，后端需要整理一个 `planning_context_pack`，不要把所有原始数据直接塞给模型。

建议包含：

- 用户原始输入、Plan 模式状态、语言。
- 当前页面状态和任务上下文：页面名、`trace_id`、`route_id`、选中方案、等待回答的 clarification card。
- `requirement_summary`：已解析目标、缺失字段、默认假设。
- 当前城市/区域、定位精度、当前时间。
- 与本次规划相关的用户偏好、避雷点、预算、出行风格。
- 本轮临时偏好和补全答案。
- 候选 POI 摘要：id、名称、类别、城市、商圈、地址、坐标、价格、评分、排队、营业、标签、短 UGC 摘要。
- 地图工具结果：距离矩阵、通勤时间、路线线段、provider、fallback。
- 约束检查结果：营业冲突、预算冲突、距离过远、避雷命中。
- 评分拆解和排序理由。

LLM 不应该看到：

- 与本次规划无关的完整用户隐私档案。
- 大量原始 UGC 全文。
- 未经过 Pydantic 校验的 Mock 数据。
- 未经地图工具校验却被当作真实事实的坐标/距离。

## 12. Trace 要求

Trace 是 Debug 端的核心数据，不是普通日志。

每次 run 至少包含：

- `run_started`
- 每个 Agent 的 `agent_started`
- 关键 tool 的 `tool_called`
- Agent 交接的 `handoff`
- 缺信息时的 `clarification_requested`
- 信息齐全时的 `requirements_summarized`
- `constraint_checked`
- `route_candidate_generated`
- `route_scored`
- `run_completed` 或 `run_failed`

建议新增：

- `intent_classified`
- `interaction_routed`
- `task_switched`
- `context_collected`
- `preference_detected`
- `map_context_resolved`
- `chat_answer_generated`
- `mock_data_generated`

事件内容尽量结构化，不只写自然语言摘要。

V2 每个 Agent 步骤都要包含模拟请求时间：

- `duration_ms` 写在 `TraceEvent`。
- `metadata.model_duration_ms` 可用于未来真实 LLM。
- 前端 Debug 可以汇总总耗时、Agent 耗时、tool 耗时。

## 13. 地图接口边界

V2 不接真实地图 SDK，但要把接口留好。

建议 provider 抽象：

```text
MapProvider
  -> geocode(address, city)
  -> reverse_geocode(lat, lng)
  -> poi_search(city, area, keywords, categories)
  -> get_route_matrix(points, mode)
  -> get_static_preview(points, route_lines)
```

V2 实现：

- 返回 Mock 坐标、距离和耗时。
- 如果 POI 有经纬度，用 haversine 近似距离；如果没有，用商圈中心点或 mock map point。
- 返回伪地图点位或 mock png。
- 在 metadata 标记 `provider=mock`。

V3 实现：

- 优先接高德地图 API。
- 如果 API 额度或接入失败，继续 fallback 到 mock png。
- 前端仍使用同一 `map_preview` 字段，不直接依赖高德 SDK。
- 距离、通勤时间和路线线段由地图 provider 返回，不由 LLM 生成。

## 14. 测试要求

后端改动后至少运行：

```bash
npm run test:api
```

或者在 `apps/api` 下运行：

```bash
conda run -n agent pytest
```

重点测试：

- `/health` 正常。
- `/routes/plan` 返回固定 3 个方案和完整 trace。
- `/routes/plan` 缺阻塞字段时返回 clarification cards。
- `plan_mode` 只影响模糊输入倾向；明显规划/问答/微调输入仍可被自动分流。
- 方案页输入新目标时能返回 `switch_task` 或开启新 run。
- `/routes/refine` 返回更新后的 plan，并包含微调 Trace event。
- 普通 LLM 对话接口加入后，需要测试不返回完整路线但返回 `answer + related_pois + trace`。
- Mock 生成接口加入后，需要测试 schema 校验、坐标校验和 fallback。
- 地图 provider 加入后，需要测试 mock provider 和 fallback。
