# DZUltra Provider Contract Handoff

> 这份文档用于新窗口继续讨论。它总结本轮 Agent 设计已确认内容，并给出下一步需要外部检索官方文档的字段清单和提示词。

## 1. 本轮已确认结论

DZUltra 的 Agent 不是为了闲聊，而是为了做本地出行 plan。

本地出行 plan 的本质是：围绕用户本轮目标，持续发现、补全、校验和应用各种约束条件，最后求出几个最优可行解。

所有偏好、要求、天气、交通、营业时间、排队、推荐菜、历史行为，本质上都要进入同一个约束体系。这个体系已经命名为 `Constraint Ledger`，也就是约束账本。

V3 真实接入的重点是 Agent 能力和接口边界。数据层可以先用 LLM Mock Data Provider 模拟真实大众点评数据，但 schema、provider、trace 都必须按未来真实 API 设计。等官方 API 或内部数据源确定后，优先替换 provider，不推倒 Agent 架构。

## 2. 当前真实 Agent 架构

主规划链路只保留 7 个真实运行 Agent。Debug Trace 也只展示这 7 个 Agent，不再额外虚构细分 Agent。

```text
InteractionRouterAgent
  -> ConstraintDiscoveryAgent
  -> UserPreferenceAgent
  -> ContextGroundingAgent
  -> PlanSolverAgent
  -> PlanEvaluatorAgent
  -> PlanExplanationAgent
```

各 Agent 职责：

| Agent | 职责 |
| --- | --- |
| `InteractionRouterAgent` | 判断本轮是新规划、补全回答、确认需求、微调当前方案、切换任务还是普通问答 |
| `ConstraintDiscoveryAgent` | 拆解本轮目标和全部语义约束，区分硬约束/软约束，决定是否追问 |
| `UserPreferenceAgent` | 读取历史收藏、评分、去过的店、用户写过的 UGC 评价，形成长期偏好约束 |
| `ContextGroundingAgent` | 调用天气、交通、地图、POI、营业时间、排队预测、UGC、推荐菜 provider，把约束落到事实 |
| `PlanSolverAgent` | 基于约束账本生成多个候选 plan，安排 POI 组合、顺序、到达时间、停留时长、交通方式 |
| `PlanEvaluatorAgent` | 校验方案是否违反约束，计算分数、拆解得分、排序，必要时退回 Solver 重算 |
| `PlanExplanationAgent` | 把最终 3 个方案解释给用户，生成标题、亮点、风险提醒、每个 POI 推荐理由和推荐菜展示 |

辅助链路：

| Agent | 用途 |
| --- | --- |
| `ChatAnswerAgent` | 普通 POI 问答，返回 `answer + related_pois + trace` |
| `MockDataAgent` | 开发者/评审面板中生成 Mock User、Mock POI、Mock UGC、Mock 环境数据 |

## 3. 已落地代码与文档

核心文档：

- `docs/internal/AGENT_STRATEGY.md`
- `docs/internal/BACKEND_SPEC.md`
- `docs/internal/TECH_AND_INTERACTION_PLAN.md`
- `docs/internal/DZUltra/USER_JOURNEY_DESIGN.md`

核心代码：

- `apps/api/app/models/schemas.py`
- `apps/api/app/agents/strategy.py`
- `apps/api/app/agents/runner.py`
- `apps/api/tests/test_api_contracts.py`
- `apps/web/lib/api.ts`
- `apps/web/types/dzultra.ts`
- `apps/web/components/mobile-shell.tsx`
- `apps/web/components/debug-trace-panel.tsx`

已经新增/扩展的后端结构：

- `ConstraintLedger`
- `PlanningConstraint`
- `ConstraintEvidence`
- `AgentPromptContract`
- `LangGraphWorkflowContract`
- `MAIN_PLANNING_AGENT_STRATEGY`
- `CHAT_AGENT_STRATEGY`
- `MOCK_DATA_AGENT_STRATEGY`
- `AGENT_PROMPT_CONTRACTS`
- `LANGGRAPH_PLANNING_WORKFLOW`

验证结果：

```bash
conda run -n agent pytest apps/api/tests/test_api_contracts.py
npm --prefix apps/web run lint
```

两项都已通过。

## 4. 下一步需要确认的 Provider Contract

下一步不是继续拆 Agent，而是确认每类 provider 能提供哪些字段。确认后再完善：

- `ContextGroundingAgent` 的 tool/provider contract。
- `PlanSolverAgent` 的候选路线生成规则。
- `PlanEvaluatorAgent` 的约束校验、评分和排序规则。
- Debug Trace 中的 provider 输入输出展示。
- MockDataAgent 的数据生成 schema。

需要确认的 provider 类型：

1. 天气预测 provider
2. 交通预测 provider
3. 地图 provider
4. POI 搜索与详情 provider
5. 营业时间 provider
6. 排队/等位 provider
7. UGC 评论与标签 provider
8. 推荐菜/大家都在点 provider
9. 用户历史行为 provider

## 5. 字段确认模板

让外部 AI 搜索每类 provider 文档时，统一按下面格式返回：

```text
Provider 名称：
官方文档链接：
是否官方 API：
是否需要账号/Key：
是否可商用/是否有调用限制：

可获取字段：
- 字段名：
- 含义：
- 类型：
- 示例：
- 是否实时：
- 是否预测：
- 是否适合进入 Constraint Ledger：
- 对 PlanSolver/PlanEvaluator 的作用：

不可获取但 DZUltra 需要的字段：
- 字段名：
- 建议 mock 方式：
- 未来可能的数据来源：

接口示例：
- 请求参数：
- 返回片段：

风险：
- 配额：
- 精度：
- 延迟：
- 合规/隐私：
- 地域覆盖：
```

## 6. 给外部 AI 的总提示词

可以把下面这段直接发给另一个 AI。

```text
你现在帮我为一个本地出行路线规划 Agent 项目调研 provider/API 文档。

项目叫 DZUltra，是一个大众点评“点仔 Ultra”路线规划 Demo。它不是普通聊天，而是围绕用户本轮目标收集约束条件，然后给出 3 个可解释的本地出行 plan。

我们当前 V2 使用全 Mock 数据，但 V3 要把 provider 边界设计得像真实 API。请优先搜索官方文档、官方开放平台、可信 API 文档，不要只给二手博客。请给出链接。

我需要你按以下模板返回每个 provider 的字段能力：

Provider 名称：
官方文档链接：
是否官方 API：
是否需要账号/Key：
是否可商用/是否有调用限制：

可获取字段：
- 字段名：
- 含义：
- 类型：
- 示例：
- 是否实时：
- 是否预测：
- 是否适合进入 Constraint Ledger：
- 对 PlanSolver/PlanEvaluator 的作用：

不可获取但 DZUltra 需要的字段：
- 字段名：
- 建议 mock 方式：
- 未来可能的数据来源：

接口示例：
- 请求参数：
- 返回片段：

风险：
- 配额：
- 精度：
- 延迟：
- 合规/隐私：
- 地域覆盖：

重点：不要只说“可以获取天气/交通/POI”，要列出具体字段。字段越接近真实 API 越好。
```

## 7. 分 provider 检索提示词

### 7.1 天气预测 Provider

```text
请调研中国大陆可用的天气预测 API，优先官方或主流服务商，例如高德天气、和风天气、彩云天气、中国天气等。

目标：为本地出行路线规划 Agent 获取未来不同时段天气，用于判断是否适合步行、室外排队、拍照、骑行，以及是否需要优先室内路线。

请重点确认这些字段是否能获取：
- 城市/区县
- 经纬度天气
- 未来逐小时天气
- 未来逐日天气
- 天气现象，例如雨、雪、晴、阴
- 降雨概率
- 降雨量
- 温度
- 体感温度
- 湿度
- 风力/风速
- 空气质量
- 更新时间
- 数据时效

请按统一 provider 字段模板返回，并给官方文档链接和接口示例。
```

### 7.2 交通预测 Provider

```text
请调研中国大陆可用的交通预测/路况 API，优先官方或主流服务商，例如高德地图、百度地图、腾讯位置服务。

目标：为本地出行路线规划 Agent 获取未来或当前交通信息，用于判断打车/驾车是否拥堵、地铁是否更稳、路线是否需要避开高峰。

请重点确认这些字段是否能获取：
- 实时路况
- 路段拥堵等级
- 拥堵指数
- 预计通行时间
- 路线距离
- 驾车 ETA
- 公共交通 ETA
- 步行 ETA
- 骑行 ETA
- 多交通方式对比
- 是否支持未来时段预测
- 是否支持路径规划时指定出发时间
- 是否返回路线 polyline
- 是否返回费用估算，例如打车费、过路费

请按统一 provider 字段模板返回，并给官方文档链接和接口示例。
```

### 7.3 地图 Provider

```text
请调研中国大陆地图 API，优先高德地图、百度地图、腾讯位置服务。

目标：为本地出行路线规划 Agent 提供地理编码、逆地理编码、POI 坐标、距离矩阵、路线规划和地图预览。

请重点确认这些能力和字段：
- 地理编码 address -> lat/lng
- 逆地理编码 lat/lng -> 城市/区县/商圈/地址
- POI 搜索
- POI 坐标
- 距离矩阵
- 驾车路线
- 步行路线
- 骑行路线
- 公共交通路线
- 地铁路线
- 路线 polyline
- 路线耗时
- 路线距离
- 路线费用
- 静态地图图像
- 坐标系说明
- QPS/配额限制

请按统一 provider 字段模板返回，并给官方文档链接和接口示例。
```

### 7.4 POI 搜索与详情 Provider

```text
请调研可用于获取中国本地生活 POI 的 API 或数据源，优先大众点评/美团官方开放平台，如果没有开放 API，再调研高德 POI、百度地图 POI、腾讯位置服务 POI 等可替代来源。

目标：为 DZUltra 路线规划 Agent 获取候选店铺/地点，支持餐厅、咖啡、甜品、商场、景点、展览、亲子等 POI。

请重点确认这些字段是否能获取：
- POI id
- 名称
- 类目
- 城市
- 区县
- 商圈
- 地址
- 经纬度
- 电话
- 人均价格
- 评分
- 评论数
- 标签
- 营业时间
- 当前营业状态
- 图片
- 团购/套餐
- 预订入口
- 排队/取号入口
- 距离
- 品牌/连锁信息

请特别说明大众点评/美团是否有官方开放 API 能获取这些字段。如果没有，请说明哪些字段只能 mock 或未来内部埋点。
```

### 7.5 营业时间 Provider

```text
请调研 POI 营业时间字段的可获取来源，优先大众点评/美团官方数据，如果没有，再看高德、百度、腾讯地图 POI 是否提供。

目标：路线规划 Agent 需要判断每个 POI 在计划到达时间和离开时间是否营业。

请重点确认这些字段：
- 营业时间原文
- 结构化营业时间
- 周一至周日不同营业时间
- 节假日特殊营业时间
- 当前营业状态
- 暂停营业/临时闭店
- 最晚入店时间
- 厨房/点单截止时间
- 数据更新时间

请说明哪些字段能从公开 API 获取，哪些更可能需要大众点评内部数据或人工/LLM mock。
```

### 7.6 排队/等位 Provider

```text
请调研大众点评/美团或其他本地生活平台是否有排队/等位相关 API 或字段。若没有公开 API，请调研可用的替代设计和需要埋点的数据。

目标：路线规划 Agent 需要知道当前排队人数，以及预测用户计划到达时的等位人数/等位时间。

请重点确认这些字段是否存在公开来源：
- 当前排队人数
- 当前等位时间
- 当前排号状态
- 桌型/人数维度排队
- 历史等位数据
- 分时段历史平均等位
- 预测到达时等位人数
- 预测到达时等位分钟数
- 是否支持取号/排队入口
- 数据更新时间

如果公开 API 不存在，请给出 V2/V3 mock schema 建议，以及未来大众点评需要埋点记录哪些数据。
```

### 7.7 UGC 评论与标签 Provider

```text
请调研大众点评/美团或替代 POI 数据源是否能获取 UGC 评论、评分、标签、摘要等字段。

目标：路线规划 Agent 需要从评论语料中判断 POI 是否适合用户，例如安静、适合约会、排队久、服务慢、拍照好看、带娃友好等。

请重点确认这些字段：
- 评论列表
- 评论文本
- 评论评分
- 评论时间
- 用户打分维度
- 商户标签
- 用户标签
- 平台摘要
- 好评关键词
- 差评关键词
- 风险提示
- 图片评论
- 评论数量
- 是否能按时间筛选
- 是否能按关键词或标签聚合

请说明公开 API 是否允许获取原始评论全文。若不允许，请建议 MockDataAgent 如何生成 UGC 摘要和标签。
```

### 7.8 推荐菜/大家都在点 Provider

```text
请调研大众点评/美团是否有“网友推荐菜”“大家都在点”“招牌菜”“菜品销量/热度”相关公开字段或 API。

目标：路线规划 Agent 最终展示餐厅 POI 时，需要展示网友推荐菜，并可用于判断是否符合用户口味偏好。

请重点确认这些字段：
- 推荐菜名称
- 推荐菜图片
- 推荐次数
- 点单热度
- 销量
- 菜品价格
- 菜品标签，例如辣、甜、清淡、招牌
- 用户评价中提到菜品的语料
- 套餐/团购菜品
- 是否可点外卖/到店点单

如果没有公开 API，请说明如何通过 UGC 摘要或 MockDataAgent 仿真这些字段。
```

### 7.9 用户历史行为 Provider

```text
请调研大众点评/美团类本地生活产品内部可能存在的用户历史行为字段，以及如果没有公开 API，如何设计 mock schema。

目标：UserPreferenceAgent 在用户第一次进入时，就读取历史收藏、评分、去过的店、用户自己写过的 UGC 评价，形成长期偏好约束。

请重点设计/确认这些字段：
- 用户收藏 POI
- 用户浏览 POI
- 用户评分
- 用户写过的评论
- 用户评论文本
- 用户去过的店
- 用户下单/团购记录
- 用户排队/取号记录
- 用户常去商圈
- 用户常选类目
- 用户预算偏好
- 用户口味偏好
- 用户避雷点
- 用户交通偏好
- 用户隐私授权状态
- 数据更新时间

请重点说明哪些字段涉及隐私授权，哪些只能在内部 mock，哪些可以作为推荐系统特征。
```

## 8. 返回给本项目时的整理要求

外部 AI 调研完后，请把结果整理成：

```text
1. Provider 能力总表
2. 每个 provider 的官方文档链接
3. 字段映射表：官方字段 -> DZUltra schema 字段
4. 不能获取的字段和 mock 建议
5. 对 PlanSolverAgent 的影响
6. 对 PlanEvaluatorAgent 的影响
7. 对 Debug Trace 展示的影响
8. 推荐优先接入顺序
```

推荐优先级：

1. 地图 provider：坐标、距离、路线耗时最基础。
2. POI provider：候选点和基础详情。
3. 营业时间 provider：硬约束。
4. 排队/等位 provider：核心差异化约束。
5. 天气/交通 provider：提升真实感和方案稳定性。
6. UGC/推荐菜 provider：提升解释质量。
7. 用户历史行为 provider：提升个性化。
