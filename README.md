# DZUltra

点仔 Ultra 是一个面向大众点评“点仔”的 AI 本地路线智能规划 Demo。用户用自然语言说出游玩目标，系统结合用户偏好、POI 数据和 UGC 摘要，生成“直接用、不踩雷”的本地路线。

当前阶段口径：

1. V1 已完成端到端 Demo 骨架：用户端能从输入走到方案、微调和选用。
2. V2 已完成主要体验壳和 Debug Trace 基础：Mock 数据，也就是假的样例数据，已经能支撑 3 个路线方案、普通 POI 问答和 Trace 展示。
3. 当前进入 V3 接入阶段：真实 provider 先接高德地图、彩云天气和 LongCat LLM；排队、UGC、推荐菜、用户历史行为等大众点评深度数据继续 Mock。V3 可扩展到 3-5 个动态方案。

V3 的关键原则：真实 provider 和 Mock fallback 要共存。地图、天气、LLM 尽量走真实接口；真实接口失败时可以回退 Mock，但 Debug Trace 必须说清楚回退原因。

已确认的 V3 重点：

- 默认提供“路线规划”模式开关；它只影响模糊输入倾向，不替代自动分流。
- 每次输入都会结合当前页面和任务上下文分流，例如补全回答、方案微调、普通问答、新规划或切换任务。
- 路线规划最多追问 2 轮；只有目标城市/区域、时间窗、人数、是否安排吃喝是阻塞字段。
- 选择题都要有“其他”入口，允许文字或语音补充。
- 内部保留匹配度分用于排序，用户端弱化数字，展示“推荐 / 更轻松 / 更省钱 / 更适合拍照”等标签。
- 每个 Agent 步骤都要有 `duration_ms`，用于用户端动效和右侧 Debug Trace。
- 地图距离、坐标和通勤时间必须来自地图 provider 或 mock provider，不能让 LLM 凭空估算。
- LLM 当前使用 LongCat 的 OpenAI-compatible 接口；模型只负责理解和表达，事实必须来自 provider 或规则工具。

主要技术栈：

- 前端：Next.js App Router、TypeScript、Tailwind CSS、Motion for React、Swiper、Zustand、TanStack Query。
- 后端：FastAPI、Python、Pydantic、LongCat/OpenAI-compatible LLM 接入、provider adapter。
- 数据：高德地图、彩云天气、LongCat LLM、Mock User、Mock POI、UGC 摘要、路线样例、本地 JSON 偏好档案。
- 展示：大众点评风格用户端 + Agent Debug Trace / Mock 数据面板。

开发文档入口：

- 总规划：[docs/internal/TECH_AND_INTERACTION_PLAN.md](docs/internal/TECH_AND_INTERACTION_PLAN.md)
- 前端规范：[docs/internal/FRONTEND_SPEC.md](docs/internal/FRONTEND_SPEC.md)
- 后端规范：[docs/internal/BACKEND_SPEC.md](docs/internal/BACKEND_SPEC.md)
- Agent 策略：[docs/internal/AGENT_STRATEGY.md](docs/internal/AGENT_STRATEGY.md)
- 本地环境：[docs/internal/SETUP.md](docs/internal/SETUP.md)
- 并行提示词：[docs/internal/PARALLEL_WORK_PROMPTS.md](docs/internal/PARALLEL_WORK_PROMPTS.md)

---

## 系统字段设计

以下为 DZUltra 核心数据模型的字段说明，所有 POI 坐标、距离、天气等事实数据来自真实 Provider（高德地图、彩云天气），LLM 只负责理解和表达，不凭空生成事实。

### POI 数据（MockPoi）

POI（Point of Interest，兴趣点）是系统推荐的基本单元，对应大众点评上的一个商户或场所。

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|---------|
| `id` | str | 唯一标识 | 高德 POI ID 或 Mock 生成 |
| `name` | str | 商户名称 | 高德 POI / Mock |
| `category` | PoiCategory | 类别（美食、甜品、咖啡、展览等） | 高德 POI / Mock |
| `city` / `district` / `area` | str | 城市/区/商圈 | 高德 POI |
| `latitude` / `longitude` | float | 地理坐标 | **高德地图 API（真实）** |
| `rating` | float | 评分（0-5） | 高德 POI / Mock |
| `review_count` | int | 评价数 | 高德 POI / Mock |
| `queue_minutes` | int | 预估排队时间（分钟） | Mock（大众点评深度字段） |
| `avg_price` | int | 人均消费（元） | 高德 POI / Mock |
| `open_hours` | str | 营业时间原文 | 高德 POI |
| `structured_open_hours` | StructuredOpenHours | 结构化营业时间 | 高德原文 + LLM 解析 |
| `visit_duration_minutes` | int | 建议停留时长 | Mock |
| `ugc_summary` | str | 用户评价摘要 | Mock（大众点评深度字段） |
| `recommended_dishes` | list[RecommendedDish] | 推荐菜/大家都在点 | Mock（大众点评深度字段） |
| `taste_rating` / `environment_rating` / `service_rating` | float | 口味/环境/服务分 | Mock（大众点评深度字段） |
| `booking_required` | bool | 是否需要预约 | Mock |
| `deal_summary` | str | 优惠信息 | Mock |
| `decision_signals` | dict | 决策信号（如"排队短"、"性价比高"） | Mock |
| `risk_notes` | list[str] | 风险提示 | Mock |
| `data_origin` | GeneratedDataOrigin | 数据来源标记 | 系统自动 |
| `data_reliability` | GeneratedDataReliability | 数据可靠性 | 系统自动 |

### 用户画像（MockUser）

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|---------|
| `id` / `name` | str | 用户标识 | Mock |
| `scenario` | str | 使用场景（约会/亲子/朋友聚餐等） | Mock |
| `preferences` / `avoidances` | list[str] | 偏好/避雷标签 | Mock |
| `priority_weights` | dict | 偏好权重（如距离 0.3、排队 0.2） | Mock |
| `budget_per_person` | int | 人均预算 | Mock |
| `group_size` | int | 出行人数 | 用户输入 |
| `time_window` | str | 期望时间段 | 用户输入 |
| `saved_pois` / `viewed_pois` / `rated_pois` | list | 历史 POI 交互 | Mock |
| `history_summary` | str | 历史行为摘要 | Mock |

### 路线方案（RoutePlan）

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|---------|
| `id` / `title` / `subtitle` | str | 方案标识和标题 | LLM 生成 / Mock |
| `score` | int | 综合评分（0-100） | 确定性评分规则 |
| `score_breakdown` | dict | 分维度评分（交通/排队/预算等） | 确定性评分规则 |
| `stops` | list[RouteStop] | 路线站点列表 | 排程 Agent |
| `transports` | list[TransportOption] | 交通方式选项 | **高德 route_matrix（真实）** |
| `transport_summary` | str | 交通概述 | LLM 生成 / Mock |
| `highlights` | list[str] | 方案亮点 | LLM 生成 / Mock |
| `map_points` | list[MapPoint] | 地图展示坐标 | **POI 真实坐标归一化** |
| `constraints` | list[RouteConstraint] | 约束满足情况 | 确定性规则检查 |
| `todo_items` | list[TodoItem] | 待办事项 | Mock |

### 路线站点（RouteStop）

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|---------|
| `poi_id` / `poi_name` | str | 关联 POI | POI 数据 |
| `start_time` | str | 到达时间 | 排程计算 |
| `duration_minutes` | int | 停留时长 | POI visit_duration |
| `distance_from_previous` | str | 距上一站距离 | **高德 route_matrix（真实）** |
| `reason` | str | 推荐理由 | LLM 生成 |
| `actions` | list[PoiAction] | 可执行操作（导航/排队/团购等） | Mock |

### 交通选项（TransportOption）

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|---------|
| `mode` | TransportMode | 交通方式（步行/打车/地铁） | — |
| `minutes` | int | 预计耗时 | **高德 route_matrix（真实）** |
| `cost` | str | 预计费用 | **基于真实距离估算** |
| `detail` | str | 补充说明 | 系统生成 |

### 地图距离矩阵（RouteMatrixLeg）

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|---------|
| `origin_id` / `destination_id` | str | 起终点 POI ID | POI 数据 |
| `mode` | TransportMode | 交通方式 | 请求参数 |
| `distance_meters` | int | 距离（米） | **高德地图 API（真实）** |
| `duration_minutes` | int | 耗时（分钟） | **高德地图 API（真实）** |
| `polyline` | list[GeoCoordinate] | 路线折线坐标 | 高德地图 API |

### 天气数据

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|---------|
| `temperature` | float | 当前温度 | **彩云天气 API（真实）** |
| `humidity` | float | 湿度 | **彩云天气 API（真实）** |
| `precipitation_probability` | float | 降水概率 | **彩云天气 API（真实）** |
| `hourly_forecast` | list | 逐小时预报 | **彩云天气 API（真实）** |
| `air_quality` | dict | 空气质量 | **彩云天气 API（真实）** |

### Debug Trace（TraceEvent）

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | TraceEventType | 事件类型（agent_step / provider_call / llm_chunk / constraint_check 等） |
| `label` | str | 步骤标签（如"约束发现"、"POI 检索"、"路线评分"） |
| `tool_name` | str | 使用的工具名称 |
| `duration_ms` | int | 步骤耗时 |
| `fallback_used` | bool | 是否触发了 fallback |
| `output` | dict | 步骤输出摘要 |
| `metadata` | dict | 包含 provider 调用详情、LLM 请求/响应、fallback 原因等 |

### 数据可靠性标记

每个数据字段都带有可靠性标记，用于 Debug Trace 区分真实数据和 Mock 数据：

| 标记 | 含义 |
|------|------|
| `verified` | 来自真实 Provider，已验证 |
| `generated_validated` | AI 生成但经过校验 |
| `mocked` | Mock 数据，仅供参考 |
| `unverified` | 未验证的数据 |

### Provider 调用链路

用户输入到方案输出的完整 Provider 调用链路：

```
用户输入
  → InteractionRouterAgent（LLM 分流）
  → ConstraintDiscoveryAgent（LLM 意图解析）
  → UserPreferenceAgent（Mock 用户画像）
  → ContextGroundingAgent
      → 高德 POI 搜索（真实）
      → 高德 route_matrix（真实距离/耗时）
      → 彩云天气（真实）
  → PlanSolverAgent（确定性排程 + 真实距离）
  → PlanEvaluatorAgent（确定性评分 + 真实交通评分）
  → PlanExplanationAgent（LLM 方案解释 + LLM 动态文案）
  → 输出 3 个可解释方案
```
