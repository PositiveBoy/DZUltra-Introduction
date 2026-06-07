# DZUltra Provider 选型与字段映射

> 当前 V3 真实 API 口径：只接入高德地图 Web 服务 API、彩云天气 API 和 LongCat LLM。除此之外不再规划外部备用 Provider。真实调用超时、失败、无 Key 或测试 Key 时，统一回退本地 Mock 数据，并在 Debug Trace 中标记 `fallback_used` 和 `reliability=mocked`。

## 1. 当前 Provider 总表

| Provider 类型 | 当前 Provider | Mock fallback | 说明 |
| --- | --- | --- | --- |
| 地图/交通/POI | 高德地图 Web 服务 API | `mock_map_provider` / `mock_poi_search` | 地理编码、逆地理编码、POI 搜索、距离矩阵、路线规划、静态预览边界都放在后端 Provider Adapter Layer。 |
| 天气 | 彩云天气 API | `mock_weather_provider` | 用于实时天气和逐小时天气摘要，重点服务降水、温度、风和室内/室外约束。 |
| LLM | LongCat OpenAI-compatible API | deterministic mock runner / template | 用于意图理解、追问、普通问答、文案和结构化解析。支持 `LONGCAT_BACKUP_API_KEY` 备用 Key。 |
| 深度本地生活字段 | 本地 Mock 数据 | 本地 Mock 数据 | 排队、UGC、推荐菜、用户历史行为当前都不是外部 API，全部从 `data/mock` 读取或由 MockDataAgent 生成。 |

## 2. 当前环境变量

```bash
DZULTRA_STAGE=v3
DZULTRA_MAP_PROVIDER=amap
DZULTRA_WEATHER_PROVIDER=caiyun
DZULTRA_LLM_PROVIDER=longcat
DZULTRA_ALLOW_MOCK_RUNNER=true
DZULTRA_PROVIDER_TIMEOUT_SECONDS=8

AMAP_WEB_SERVICE_KEY=
CAIYUN_WEATHER_TOKEN=

LONGCAT_API_KEY=
LONGCAT_BACKUP_API_KEY=
LONGCAT_BASE_URL=https://api.longcat.chat/openai
LONGCAT_MODEL=LongCat-2.0-Preview
DZULTRA_LLM_TIMEOUT_SECONDS=20
```

不要再新增其他外部备用配置。当前真实外部 API 只保留高德地图 Web 服务 API、彩云天气 API 和 LongCat。

## 3. 高德地图字段映射

| 高德字段 | DZUltra 字段 | 用途 |
| --- | --- | --- |
| `location` | `latitude` / `longitude` | POI 坐标、地图预览、距离矩阵。 |
| `formatted_address` / `address` | `address` | 地址展示和地理编码兜底。 |
| `cityname` / `adname` | `city` / `district` | 城市、区县筛选。 |
| `business` | `area` | 商圈展示与路线聚合。 |
| `name` | `name` | POI 名称。 |
| `id` | `id` / `poi_id` | POI 稳定标识。 |
| `type` | `category` | 类别匹配。 |
| `biz_ext.rating` | `rating` | 基础评分。 |
| `biz_ext.cost` | `avg_price` | 人均预算判断。 |
| `tel` | `telephone` | 商户电话。 |
| `tag` | `tags` | 标签匹配。 |
| `biz_ext.open_time` | `open_hours` | 营业时间原文；结构化解析由 LongCat 或规则工具兜底。 |
| `photos` | `images` | POI 图片。 |
| 距离/路线返回的 `distance` | `distance_meters` | 站间距离。 |
| 距离/路线返回的 `duration` | `duration_minutes` | 站间耗时。 |
| 路线返回的 `polyline` | `polyline` | 地图路线段。 |

高德无法提供的排队、UGC、推荐菜、用户历史行为，当前都使用本地 Mock，不再声明外部 Provider。

## 4. 彩云天气字段映射

| 彩云字段 | 进入 DZUltra 的方式 | 约束影响 |
| --- | --- | --- |
| `result.realtime.skycon` | 天气摘要 | 判断晴雨、室内/室外优先级。 |
| `result.realtime.temperature` | 天气摘要 | 判断步行舒适度。 |
| `result.realtime.apparent_temperature` | 天气摘要 | 判断体感风险。 |
| `result.realtime.wind.speed` | 天气摘要 | 判断骑行和露台体验。 |
| `result.realtime.precipitation.local.intensity` | 天气摘要 | 判断短时降水风险。 |
| `result.hourly.skycon[]` | 逐小时摘要 | 判断计划时段是否适合室外 POI。 |
| `result.hourly.temperature[]` | 逐小时摘要 | 判断时段舒适度。 |
| `result.hourly.precipitation[]` | 逐小时摘要 | 雨天优先室内、减少露天排队。 |

## 5. Provider Adapter Layer

```text
Agent
  -> Provider Adapter Layer
      -> Amap provider
      -> Caiyun provider
      -> LongCat client
      -> Local Mock fallback
```

原则：

- Agent 只调用统一接口，例如 `poi_search`、`route_matrix`、`weather`。
- 高德和彩云超时或失败时自动回退 Mock。
- TraceEvent 的 `tool_output.provider_call` 必须包含 provider、调用参数摘要、返回摘要、`reliability`、`fallback_used` 和错误原因。
- 地图距离、坐标、通勤耗时不能由 LLM 编造，只能来自高德或 Mock map provider。
- 天气事实不能由 LLM 编造，只能来自彩云或 Mock weather provider。

## 6. 对 Agent 的影响

PlanSolverAgent：

- 用高德或 Mock 距离矩阵安排站点顺序和通勤时间。
- 用彩云或 Mock 天气摘要判断是否优先室内 POI。
- 用本地 Mock 排队和 UGC 字段补齐当前无法从真实 API 获取的体验判断。

PlanEvaluatorAgent：

- 校验营业时间、路线时长、距离、天气、排队、预算和偏好匹配。
- 打分结果仍要拆成 `score_breakdown`，并在 Trace 中展示每个约束的来源和可信度。
- 高德/彩云 fallback 后不能让方案失败，必须继续返回可演示的 3 个方案。

Debug Trace：

- 必须展示高德地图调用或 Mock 回退。
- 必须展示彩云天气调用或 Mock 回退。
- 本地 Mock 深度字段要明确标记为 `mock_local_poi_enrichment`，不要写成外部 API。

## 7. Schema 变更记录

`MockPoi` 已扩展这些字段，当前数据来源如下：

| 字段 | 当前来源 |
| --- | --- |
| `structured_open_hours` | 高德 `open_hours` 原文 + LongCat/规则解析，失败时为空。 |
| `telephone` | 高德 POI `tel`，Mock 可为空。 |
| `images` | 高德 POI `photos` 或 Mock。 |
| `recommended_dishes` | 本地 Mock。 |
| `taste_rating` / `environment_rating` / `service_rating` | 本地 Mock。 |

所有新增字段都有默认值，旧 Mock JSON 可以继续加载。
