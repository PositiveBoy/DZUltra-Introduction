# 并行工作窗口提示词

> 这些提示词用于开多个 Agent 并行推进。每个窗口先读 `README.md`、`docs/internal/TECH_AND_INTERACTION_PLAN.md`，再按任务读对应专项文档。不要默认把完整 `USER_JOURNEY_DESIGN.md` 全塞进上下文；只有需要细化交互时再读。

## 1. 用户端前端窗口

```text
你正在参与 DZUltra / 点仔 Ultra 项目。请先阅读 README.md、docs/internal/TECH_AND_INTERACTION_PLAN.md、docs/internal/FRONTEND_SPEC.md。

当前阶段是 V3：接入真实 Provider API，但保持 Mock Fallback 兜底。你的任务是推进 apps/web 里的 MobileShell 用户端。用户端需要跑通真实 API response 驱动的输入、Agent 执行流、结构化补全问题、需求总结、固定 3 个方案横滑、方案微调、选用方案后的时间线和 To-do 清单。

V3 前端关键变化：
- 地图展示从 SVG/Canvas/mock png 升级为高德地图 JS API 或高德静态地图。MapPreview 的 preview_type 支持 "amap_static"，coordinate_confidence 支持 "verified"（真实坐标）和 "mocked"（降级）。如果高德 API 不可用，自动 fallback 到 mock_vector。
- POI 详情卡片可展示推荐菜（recommended_dishes）、维度评分（taste_rating/environment_rating/service_rating）、POI 图片（images）。
- Debug Trace 展示真实 Provider 调用：高德地理编码/路线规划、彩云天气逐小时摘要等。排队、UGC、推荐菜只展示本地 Mock 数据来源。tool_output 中包含 provider 名称和 reliability 标记。

注意分流：用户端建议有默认打开的"路线规划"模式。它只影响模糊输入倾向，不替代自动分流。每次用户输入都要带当前页面和任务上下文，后端据此判断是新规划、普通问答、补全回答、确认需求、微调当前方案、选用方案还是切换任务。

技术约束：Next.js App Router + TypeScript + Tailwind CSS；Motion for React 做关键动效；Swiper 只用于横向方案/POI；Zustand 管 UI 状态；TanStack Query 管 API。V3 接入高德地图 JS API，但必须保留 mock fallback。完成后运行 npm run lint:web 或 npm run build:web，并说明结果。
```

## 2. Web 壳与 Debug 窗口

```text
你正在参与 DZUltra / 点仔 Ultra 项目。请先阅读 README.md、docs/internal/TECH_AND_INTERACTION_PLAN.md、docs/internal/FRONTEND_SPEC.md、docs/internal/AGENT_STRATEGY.md。

当前阶段是 V3：Debug Trace 需要展示真实 Provider 调用过程。你的任务是在用户端可用后，完善完整桌面 Web 演示页：左侧嵌入 MobileShell，右侧展示 Debug Trace / Provider 数据面板。

V3 Debug Trace 关键变化：
- Provider 调用展示：tool_output 中包含 provider 名称（amap/caiyun/mock_*）、调用参数、返回数据摘要、reliability（verified/mocked/predicted）。
- 天气约束展示：彩云天气逐小时摘要的降水、温度、风力，以及对应的约束影响（如"15:00 有降水风险，建议优先室内 POI"）。
- 交通方式对比展示：高德返回的驾车/公交/步行/骑行 ETA 和费用，Solver 据此选择最优方式。
- 营业时间校验展示：高德 POI 营业时间原文 + LLM 结构化解析结果 + 当前时间校验。
- 排队约束展示：本地 Mock 排队预测，含预测到达时等位时间。
- LLM span 展示：真实 LLM 调用的模型名、token 用量、耗时、成本。
- Mock 数据面板升级：展示当前 Provider 连接状态（已接入/降级为 Mock），以及各 Provider 的配额使用情况。

Debug Trace 需要展示 Agent 时间线、真实请求耗时、tool 调用、handoff、候选池、排除理由、约束检查、3 个方案的匹配度分/排序理由、地图与距离 provider、完整 JSON 和历史 run。用户端状态变化时，右侧对应 Trace 节点要同步高亮。

它是给开发者和评审看的过程回放面板。完成后运行前端 lint 或 build。
```

## 3. 后端与 Agent 窗口

```text
你正在参与 DZUltra / 点仔 Ultra 项目。请先阅读 README.md、docs/internal/TECH_AND_INTERACTION_PLAN.md、docs/internal/BACKEND_SPEC.md、docs/internal/AGENT_STRATEGY.md、docs/internal/PROVIDER_SELECTION.md。

当前阶段是 V3：接入真实 Provider API，替换地图、POI、天气和 LLM 的部分 Mock 数据来源。你的任务是推进 apps/api：实现 Provider Adapter Layer，接入高德地图 Web 服务 API、彩云天气 API 和 LongCat，保持 Mock Fallback 兜底。

V3 Provider 接入优先级（参见 PROVIDER_SELECTION.md）：
- P0：高德地图 — 地理编码、逆地理编码、距离矩阵、路线规划（驾车/公交/步行/骑行）
- P1：高德 POI — POI 搜索、POI 详情（含营业时间、评分、人均、标签、图片、电话）
- P2：高德 POI + LLM — 营业时间结构化解析（open_hours 原文 → StructuredOpenHours）
- P3：彩云天气 — 实时天气、逐小时天气摘要、降水/温度/风约束
- P4：高德交通 — 实时路况、指定出发时间预测
- P5：本地 Mock 深度字段 — 排队数据、UGC 评论、推荐菜
- P6：Mock 用户行为 — 用户偏好 profile（全部 mock）

Provider Adapter Layer 架构：
- Agent 只调用统一接口（geocode/route_matrix/poi_search/weather 等），不关心底层是真实 API 还是 Mock
- 每个 Provider 实现统一接口，调用失败时自动降级到 Mock Fallback
- TraceEvent.tool_output 中记录 provider 名称、调用参数、返回摘要、reliability 标记
- MapProviderName 已支持 "amap"，CoordinateConfidence 已支持 "verified"/"mocked"

V3 路线规划流程（与 V2 相同，但数据来源升级）：
用户 prompt + 页面上下文 -> 判断交互类型 -> 收集位置、时间、用户档案、本轮偏好和目标 -> 对缺失阻塞字段返回结构化 clarification_cards -> 用户回答 -> 异步分析长期偏好 -> 高德 POI 搜索候选 -> 高德距离矩阵/路线规划 -> 彩云天气摘要 -> 按营业时间（LLM 结构化）、距离、本地 Mock 排队、天气、预算排程 -> 固定生成 3 个方案 -> 排序并返回用户端 JSON + Debug Trace。

Schema 已扩展：MockPoi 新增 structured_open_hours、telephone、images、recommended_dishes、taste_rating/environment_rating/service_rating。新增子模型 RecommendedDish 和 StructuredOpenHours。

完成后运行 conda run -n agent pytest apps/api/tests/test_api_contracts.py，并说明结果。
```

## 4. Provider 适配与数据窗口

```text
你正在参与 DZUltra / 点仔 Ultra 项目。请先阅读 README.md、docs/internal/TECH_AND_INTERACTION_PLAN.md、docs/internal/PROVIDER_SELECTION.md。

当前阶段是 V3：实现 Provider Adapter Layer，接入真实 API，保持 Mock Fallback。你的任务是：

1. 实现 apps/api/app/providers/ 目录下的 Provider 适配器：
   - AmapProvider：封装高德地图 Web 服务 API（地理编码、逆地理编码、POI 搜索、POI 详情、路线规划、距离矩阵、静态地图）
   - CaiyunProvider：封装彩云天气 API（实时天气、逐小时天气摘要、降水/温度/风）
   - MockProvider：保留现有 mock 数据逻辑作为 fallback；排队、UGC、推荐菜都属于本地 Mock，不接外部 API

2. 每个 Provider 适配器必须：
   - 实现统一接口，与 Agent 解耦
   - 调用失败时返回 Mock 数据，并在 TraceEvent 中标记 fallback_used=True
   - 在 tool_output 中记录 provider 名称、调用参数、返回摘要、reliability
   - 处理 API Key 配置（从环境变量读取，不硬编码）
   - 处理超时、失败和配额异常，高德/彩云失败时回退 Mock

3. 更新 data/mock 数据，对齐 V3 Schema：
   - pois.json 中每个 POI 可补充 telephone、images、recommended_dishes、taste_rating/environment_rating/service_rating、structured_open_hours
   - 新增字段均有默认值，现有数据无需修改即可加载
   - 推荐菜数据参考真实本地生活场景（如火锅店 → "手切羊肉"、"番茄锅底"；咖啡馆 → "拿铁"、"手冲"）

4. 不要新增其他外部备用 Provider。当前真实 API 只保留高德地图 Web 服务 API、彩云天气 API 和 LongCat。

完成后运行 conda run -n agent pytest apps/api/tests/test_api_contracts.py，并说明结果。
```
