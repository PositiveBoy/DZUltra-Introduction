# DZUltra 技术与交互总规划

> 本文档是后续 Agent 开发的总入口。它只保留方向、边界和执行顺序；完整用户体验愿景见 `docs/internal/DZUltra/USER_JOURNEY_DESIGN.md`。

## 1. 文档使用规则

默认只读这些核心文档：

| 文档 | 什么时候读 | 用途 |
| --- | --- | --- |
| `TECH_AND_INTERACTION_PLAN.md` | 每个任务开始 | 理解 V3 目标、provider 接入和 Mock fallback 边界 |
| `FRONTEND_SPEC.md` | 做 `apps/web` 时 | 用户端页面、Debug Trace、地图展示规范 |
| `BACKEND_SPEC.md` | 做 `apps/api`、Mock 数据或接口时 | API、schema、Mock 数据、Trace、地图 provider 规范 |
| `AGENT_STRATEGY.md` | 做 `apps/api/app/agents` 或 Trace 时 | Agent 职责、数据流、调试链路 |

按需再读：

| 文档 | 什么时候读 | 注意 |
| --- | --- | --- |
| `DZUltra/USER_JOURNEY_DESIGN.md` | 需要补全交互细节时 | 这是最终愿景，不要求一次做完 |
| `DZUltra/USER_JOURNEY_IMPLEMENTATION_AUDIT.md` | 查当前实现差距或验收记录时 | 这是审计记录，不是最新阶段指令 |
| `SETUP.md` | 启动、安装、测试时 | 本地命令入口 |
| `PARALLEL_WORK_PROMPTS.md` | 开多个 Agent 并行干活时 | 分工提示词 |

## 2. 项目目标

DZUltra，也就是“点仔 Ultra”，是一个嵌入 Web 网站里的大众点评风格本地路线规划 Demo。用户用自然语言说出目标，系统结合用户位置、时间、已知偏好、POI 和 UGC 摘要，生成可解释、可调整、可落地的多 POI 路线。

当前开发已进入 V3。V3 的目标不是推翻 V2 的体验壳，而是在保留稳定 Mock fallback 的同时接入真实 provider：

1. 用户端能用真实 API response 渲染补全问题、需求总结、3 个方案、微调 diff 和选用方案。
2. Agent 流程完整可解释：识别意图、收集上下文、提问补全、偏好分析、检索候选、地图距离、排程、约束检查、生成文案、排序。
3. Debug Trace 能让开发者看懂 Agent 链路：输入、候选、筛选、排序、失败兜底、模拟耗时。
4. 高德地图、彩云天气和 LongCat LLM 进入真实接入；真实接口失败时 fallback 到 Mock，并在 Trace 中说明。
5. 排队、UGC、推荐菜、用户历史行为等深度数据继续 Mock，但 schema、provider、trace 要按未来真实数据设计。

## 3. 阶段定义

### V1：已完成的 Demo 骨架

V1 的价值是证明端到端链路能跑通。它已经具备：

- 用户端从入口到规划、补全、方案、微调、选用的基本闭环。
- 后端 deterministic mock runner，也就是确定性假数据执行器。
- 初版 AgentTrace 和 Debug Trace。
- 本地 Mock 用户、Mock POI、Mock 偏好档案。

后续文档不要再把“先做用户端，再做 Debug”当成当前主阶段目标；这属于 V1/V1.5 的历史顺序。

### V2：全 Mock 的最终体验壳

目标：体验接近 V3，差别只在数据来源仍然是 Mock。

必须覆盖：

- 意图分流：判断用户输入是“路线规划”还是“普通 LLM 对话”。
- Plan 模式：用户端提供默认打开的“路线规划”模式开关；它是意图倾向，不替代自动分流。
- 上下文收集：用户位置、当前时间、已知用户信息、本轮 prompt 偏好、本轮目标。
- 结构化提问：缺少会影响决策的重要信息时，返回 JSON 问题卡片，由前端渲染选择器、选择题、自由输入或语音入口。
- 追问上限：最多 2 轮；第二轮最多 3 个偏好问题。
- 阻塞字段：目标城市/区域、时间窗、人数、是否安排吃喝。预算、口味、体力、交通偏好等不阻塞。
- 偏好分析：根据用户输入、补全选择和微调行为，异步更新本地 Mock 偏好档案。
- 候选检索：按目标城市/商圈匹配 Mock POI、Mock UGC、Mock 用户偏好。
- 地图上下文：用 mock provider 生成坐标、距离、通勤时间和地图预览，不能让 LLM 自己猜距离。
- 路线排程：结合营业时间、距离、排队、预算、时长，把候选点排成有时间安排的路线。
- 多方案排序：V2 固定输出 3 个方案，越优的方案越靠前。
- 可解释输出：最终返回用户端约定 JSON，包含推荐理由、避雷理由、匹配度拆解或排序依据。
- 模拟请求时间：每个 Agent 步骤都要有 `duration_ms` 或类似字段，前端据此显示“正在做什么”的动效。
- Debug Trace：右侧面板展示 Agent 节点、tool 调用、handoff、候选池、排除理由、约束检查、完整 JSON。
- Mock 数据面板：可展示当前 Mock User、Mock POI、Mock UGC、偏好档案和地图 provider；后段加入 MockDataAgent 生成能力。

### V3：真实能力接入

目标：用户可以输入真实 prompt，系统返回真实体验。

必须覆盖：

- LLM 接入：当前使用 LongCat API 的 OpenAI-compatible 格式，做意图识别、问题生成、普通对话、路线文案、复杂偏好理解和 Mock 数据生成。
- 工具与规则兜底：POI 筛选、营业时间、预算、距离、排程、评分仍要有 deterministic tool，也就是可复现的规则工具，避免 LLM 幻觉。
- 地图 API：优先接高德地图 Web 服务 API；如果额度、网络或资质受限，fallback 是地图 mock png 或 mock provider。
- 天气 API：当前接彩云天气，优先用于降水、温度、风和室内/室外约束判断。
- 地图接口边界：V3 只替换 provider 实现，不改前端 RoutePlan 结构。
- 真实 Trace：把 LLM span、模型名、token、耗时、成本写回本地 `AgentTrace`，Debug 面板继续可读。
- 真实用户输入：允许用户随意输入真实需求，不再只靠 preset prompt。
- 真实数据模拟与处理：右侧面板支持用 LLM 生成 Mock User、Mock POI、Mock UGC，再经 Pydantic 校验和地图工具校验坐标。

## 4. 两类用户输入

| 类型 | 定义 | 走什么流程 |
| --- | --- | --- |
| 普通 LLM 对话 | 用户不是要完整路线，而是问一个附近 POI 相关问题，例如“附近有什么适合聊天的咖啡馆？” | 返回 `answer + related_pois + trace` |
| 路线规划 | 用户希望系统安排多个点、时间顺序、交通和方案，例如“今天下午两个人在望京约会，少排队” | 走完整 V2 Agent 流程，返回 3 个方案 |

普通 LLM 对话不是“闲聊机器人”。它仍然可以读取附近 POI、用户偏好和 UGC 摘要，但不生成 `plans` 和完整路线时间线。

Plan 模式建议：

- 默认打开，因为点仔 Ultra 的主任务是路线规划。
- 打开时，包含出行目标、时间、地点或人群倾向的输入都偏向路线规划。
- 关闭时，模糊输入更偏向普通 POI 问答。
- 它不是硬规则：如果用户输入明显是另一类任务，InteractionRouterAgent 仍要自动转向或让用户确认。
- 关闭后用户输入明显是路线规划时，前端可以给“这更像路线规划，要切换吗？”或“转成路线规划”的入口。
- 打开后用户输入只是简单 POI 咨询时，可以返回普通问答，并附“帮我排成路线”的入口。

## 5. 输入分流与页面上下文

每次用户输入都要先经过轻量分流，不一定每次都跑完整 Agent 链。这个分流由 `InteractionRouterAgent` 承担，也就是“交互路由器”。`ConstraintDiscoveryAgent` 在分流之后负责拆解目标和约束。

分流判断同时看三类信息：

1. 用户这句话本身，例如“换掉第二个”“重新规划”“附近有什么咖啡”。
2. 当前页面状态，例如方案页、补全页、需求确认页、普通问答页。
3. 当前任务上下文，例如当前 `trace_id`、`route_id`、选中方案、等待回答的 clarification card。

页面状态是强提示，不是硬限制。比如用户在方案页说“第二个换成川菜”，更可能是微调当前方案；但用户在方案页说“算了，明天带娃去上海迪士尼附近玩”，应该识别为新任务，而不是强行微调旧方案。

建议交互类型：

| `interaction_type` | 场景 | 后续流程 |
| --- | --- | --- |
| `new_planning_task` | 新路线规划 | 走完整路线规划链 |
| `chat_answer` | 普通 POI 问答 | 返回 `answer + related_pois + trace` |
| `answer_clarification` | 回答补全卡片 | 合并答案后继续规划 |
| `confirm_requirements` | 确认需求总结 | 进入候选检索和路线生成 |
| `refine_current_plan` | 微调当前方案 | 局部替换、重排或全链路重跑 |
| `select_plan` | 选用某个方案 | 进入选用方案页 |
| `switch_task` | 放弃当前任务，开始新任务 | 当前任务结束或归档，开启新 run |

V2 先不做新窗口。`switch_task` 可以直接替换当前任务，并在 Trace 中记录用户主动切换任务。V3 再考虑历史会话、新窗口或多任务并行。

## 6. V2 路线规划主流程

```text
用户提交 prompt
  -> InteractionRouterAgent 判断 interaction_type
  -> 如果是普通 LLM 对话：
      读取附近 POI、用户偏好和 UGC 摘要
      返回 answer + related_pois + trace
  -> 如果是路线规划：
      ConstraintDiscoveryAgent 拆解目标、硬约束、软约束和缺失字段
      -> 缺信息时返回结构化 clarification_cards
      -> 用户回答，最多追问 2 轮
      -> UserPreferenceAgent 读取或异步预热长期偏好
      -> ContextGroundingAgent 调用 Mock POI / Mock UGC / 地图 / 排队 / 天气 / 交通 provider
      -> PlanSolverAgent 生成多条候选路线，安排 POI 顺序、到达时间、停留时长和交通方式
      -> PlanEvaluatorAgent 检查营业、距离、排队、预算、天气、交通和偏好约束，并完成评分排序
      -> PlanExplanationAgent 生成用户可读解释、风险提醒和推荐菜展示
      -> 返回固定 3 个方案 + 前端约定 JSON + Debug Trace
```

## 7. LLM 与工具边界

V3 不是让 LLM 凭空做所有决定。推荐方式是“LLM 负责理解和表达，工具负责事实和约束”：

| 能力 | LLM 负责 | 工具/规则负责 |
| --- | --- | --- |
| 意图识别 | 理解真实 prompt、生成追问 | schema 校验、阻塞字段判断 |
| 偏好分析 | 从用户输入和选择中提取长期偏好 | 去重、置信度、写入档案 |
| POI 决策 | 解释为什么适合用户 | POI 检索、营业、价格、排队、标签匹配 |
| 地图 | 解释路线为什么顺 | 坐标、距离、通勤时间、路线线段 |
| 排程 | 可辅助判断节奏 | 时间窗、停留时长、营业冲突 |
| 评分 | 可解释排序理由 | 匹配度分和约束满足率 |
| Mock 数据 | 生成看起来真实的用户/POI/UGC | Pydantic 校验、地理编码、fallback 模板 |

LLM 看到的数据应是整理后的 `planning_context_pack`，包含用户输入、Plan 模式状态、当前页面状态、当前任务上下文、已解析需求、相关用户偏好、候选 POI 摘要、地图工具结果、约束检查和评分拆解。不要把完整数据库、全部原始 UGC 或不相关隐私档案直接塞给 LLM。

## 8. API 与数据流

前端先面向这些接口设计：

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/mock/users` | 读取 Mock 用户 |
| `GET` | `/mock/pois` | 读取 Mock POI |
| `POST` | `/routes/plan` | 提交自然语言需求，生成路线或补全问题 |
| `POST` | `/routes/refine` | 基于当前方案做自然语言微调 |
| `POST` | `/chat/respond` | 普通 POI 问答，返回 `answer + related_pois + trace` |
| `GET` | `/traces` | 获取 Agent run 列表 |
| `GET` | `/traces/{trace_id}` | 获取单次完整 Trace |
| `GET` | `/profiles/{user_id}/preferences` | 读取本地 Mock 用户偏好 |
| `POST` | `/profiles/preferences/detect` | 从输入中检测并保存 Mock 偏好 |
| `POST` | `/mock/generate-user` | 用 LLM 或模板生成 Mock 用户 |
| `POST` | `/mock/generate-pois` | 用 LLM 或模板生成 Mock POI 批次 |
| `POST` | `/mock/commit-generated` | 可选，把生成结果保存为当前演示数据 |
| `POST` | `/maps/route-matrix` | 地图距离/耗时矩阵，V2 返回 mock |
| `POST` | `/maps/static-preview` | 地图静态预览，V2 返回 mock png 或伪地图数据 |

## 9. 技术栈边界

前端：

- Next.js App Router + TypeScript。
- Tailwind CSS 做样式。
- shadcn/ui 只作为基础 primitive，用户端视觉需要自定义，不能直接套后台风格。
- Motion for React 做关键动效。
- Swiper 只用于横向方案/POI 浏览。
- Zustand 管 UI 瞬态状态，比如当前页面、选中方案、展开卡片。
- TanStack Query 管 API 请求、缓存和轮询。
- V2 使用 SVG/Canvas/mock png 地图；V3 接地图 API。

后端：

- FastAPI + Python。
- Pydantic 定义请求/响应和 Agent tool 数据结构。
- V2 默认 deterministic mock runner，保证演示稳定。
- OpenAI Agents SDK / LangGraph 作为 V3 增强路径，不能破坏本地 Trace 输出。
- Mock 生成可以读写本地 JSON；V3 再替换为真实数据库或外部服务。
- 地图 provider 必须抽象在后端，前端优先消费 `map_preview` 和 route matrix 结果。

## 10. 当前落地优先级

1. 先让文档、schema、Trace 统一到 V2/V3 口径。
2. 补齐普通 POI 问答分支：V2 mock `answer + related_pois + trace`。
3. 增加页面上下文参与分流：当前页面、当前 route、当前 clarification card 都要进入 `interaction_context`。
4. 补齐 clarification card 的 UI 类型、其他入口和追问轮数限制。
5. 固定 V2 生成 3 个方案，并补 `rank_reason`、`score_breakdown`、`map_preview`。
6. 在 Trace 中补 Context、Preference、Map、UGC 的可解释事件。
7. 完善右侧 Debug Trace / Mock 数据面板。
8. 预留地图 provider 和 MockDataAgent，准备 V3 高德 API 与 LLM Mock 数据生成。
