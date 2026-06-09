# DZUltra 搜索分流修复与普通问答真实化

更新时间：2026-06-08

本文解决两个紧密关联的问题：

1. 从搜索框进去的输入，不管有没有高亮"点仔Ultra"路线规划，都会走普通问答（chat_answer），而不是路线规划。
2. 普通问答的前端展示仍然是硬编码 Mock 数据，没有展示后端真实返回的结果。

## 1. 问题根因分析

### 1.1 分流问题：为什么所有搜索输入都走 chat_answer

分流链路是：

```
用户输入 → submitSearchQuestion() → POST /interactions/respond
→ 后端 _route_interaction_from_interaction()
→ _classify_intent() 算出 intent_kind
→ _interaction_type() 根据 intent_kind 决定 interaction_type
→ 可能调 LLM 增强，但 LLM 失败时 fallback 回确定性结果
```

**根因在 `_classify_intent()`（`requirements.py` 第 98-119 行）的关键判断逻辑：**

```python
asks_nearby_poi = any(keyword in goal for keyword in ["附近", "周边"]) and \
    any(keyword in goal for keyword in ["有什么", "有没有", "推荐", "哪家", "几个"])
asks_full_route = any(keyword in goal for keyword in ["路线", "规划", "安排", "半天", "一天", "先", "再"])
if asks_nearby_poi and not asks_full_route:
    return "non_planning"
```

这段逻辑的问题：

- "附近有没有适合聊天的咖啡馆"命中了"附近"+"有没有"，但没有"路线/规划/安排"，所以 `intent_kind = "non_planning"` → `interaction_type = "chat_answer"`。
- "望京有什么好吃的"同样命中"有什么"，走 chat_answer。
- 即使输入"今天下午在望京约会，吃饭加看展"，虽然"约会"在 PLANNING_KEYWORDS 里，但"附近有什么"模式优先级更高，如果同时出现"推荐"等词也会被误判。

**更深层的问题：`plan_mode` 参数形同虚设。**

- 前端 `routePlanningEnabled` 开关只改变按钮外观，不传给后端。`plan_mode` 始终为 `true`。
- `_classify_intent` 中 `plan_mode` 只在**所有关键词都不命中**时才起作用：`plan_mode=True` 返回 `ambiguous`，`plan_mode=False` 返回 `non_planning`。
- 用户关闭路线规划开关后，输入仍然 `plan_mode=true`，后端完全不知道用户的选择。

### 1.2 展示问题：为什么普通问答仍显示 Mock 数据

有四个层面的问题：

**层面 1：初始状态是硬编码 Mock。**

```typescript
const [directAnswer, setDirectAnswer] = useState<DirectAnswer>(() =>
  createDirectAnswer("附近有营业中的便利店吗")
);
```

页面加载时 `directAnswer` 就有 Mock 数据，虽然首屏不展示 answering 视图，但一旦用户触发任何状态切换，这些 Mock 数据可能短暂可见。

**层面 2：API 失败时 fallback 到硬编码 Mock。**

```typescript
// onError 回调
if (page === "searching" || page === "answering") {
  setDirectAnswer(createDirectAnswer(variables.message));
  // ...
}
```

`createDirectAnswer()` 是一个纯本地关键词匹配函数，返回硬编码的 Mock POI（如"7-Eleven 悠乐汇店"、"小山茶饮廊"等）。用户看到的是假数据，且没有明确标记。

**层面 3：submitSearchQuestion 的乐观更新也是 Mock。**

```typescript
setDirectAnswer({
  question: goal,
  answer: "正在检索附近 POI，并交给 ChatAnswerAgent 生成直接回答。",
  poiHints: []
});
```

虽然 `poiHints` 为空，但 `answer` 是硬编码文案，不是后端返回的。

**层面 4：DirectAnswer 类型信息损失严重。**

```typescript
type DirectAnswer = {
  question: string;
  answer: string;
  poiHints: Array<{ name: string; meta: string; reason: string }>;
};
```

后端 `ChatResponsePayload.related_pois` 包含 `id`、`category`、`latitude`、`longitude`、`address`、`images`、`recommendedDishes`、`openHours` 等丰富字段，但 `directAnswerFromChatResponse()` 只提取了 `name/meta/reason` 三个字符串。真实数据到了前端也被大幅裁剪。

### 1.3 问题关联

这两个问题不是独立的。分流错误导致：

1. 本应走路线规划的输入被当成普通问答 → 用户看不到路线方案，只能看到简陋的 POI 列表。
2. 普通问答的展示层太弱 → 即使分流正确，chat_answer 的展示也不够好，无法体现真实 provider 的价值。
3. `routePlanningEnabled` 开关完全断开 → 用户以为自己在控制分流，实际上没有任何效果。

## 2. 修复目标

### 2.1 分流目标

1. 搜索框输入明确包含路线规划意图时（如"今天下午两个人在望京约会，吃饭加看展"），必须走 `new_planning_task`，不能被"附近有什么"模式误判。
2. 搜索框输入确实是简单 POI 咨询时（如"附近有没有便利店"），可以走 `chat_answer`，但回答必须来自真实 provider。
3. `routePlanningEnabled` 开关必须接入 `plan_mode` 参数，关闭时 `plan_mode=false`，后端据此调整分流倾向。
4. LLM router 可用时，应能修正确定性规则的误判；不可用时，确定性规则本身也要更合理。

### 2.2 展示目标

1. API 成功时，前端必须展示后端返回的真实 answer 和 related_pois，不覆盖不替换。
2. API 失败 fallback 时，必须明确标记 `fallback_reason`，让用户知道这是兜底数据。
3. 初始状态 `directAnswer` 应为空态，不应预填 Mock。
4. `DirectAnswer` 类型应保留足够信息，至少包含 POI id、category、坐标，方便后续"转为路线规划"功能。
5. answering 视图应展示更丰富的 POI 信息（地址、评分、推荐菜、图片占位），不能只有 name/meta/reason 三个字符串。

## 3. 任务拆分与波次

### 第一波：分流修复（后端 + 前端联动）

可以并行：

1. **Agent K**：后端分流逻辑修复——`_classify_intent` 规则优化 + `plan_mode` 真正生效。
2. **Agent L**：前端 `routePlanningEnabled` 接入 `plan_mode` + 初始状态清理。

### 第二波：普通问答展示真实化

建议按顺序：

1. **Agent M**：后端 chat 链路确保真实 provider 优先 + fallback 标记完善。
2. **Agent N**：前端 DirectAnswer 类型扩展 + answering 视图升级 + fallback 标记展示。

### 第三波：端到端验证

1. **Agent O**：端到端测试——分流准确率 + 展示真实性 + fallback 可追溯。

---

## Agent K 提示词：后端分流逻辑修复

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md、本文档。

你的任务是修复后端分流逻辑，解决"搜索框输入全部走 chat_answer"的问题。

背景：
- 当前 _classify_intent()（apps/api/app/agents/requirements.py 第 98-119 行）有一个"附近 POI 咨询"模式，只要输入包含"附近/周边"+"有什么/有没有/推荐/哪家/几个"但不包含"路线/规划/安排/半天/一天/先/再"，就返回 non_planning。
- 这导致"附近有没有适合约会的咖啡馆"、"望京有什么好吃的"这类同时包含规划意图的输入被误判为普通问答。
- plan_mode 参数在 _classify_intent 中几乎不起作用，只在所有关键词都不命中时影响兜底值。

目标：
1. 优化 _classify_intent 的判断逻辑，让"附近有什么"类输入在包含规划上下文时走 planning 而不是 non_planning。
2. 让 plan_mode 真正影响分流倾向：plan_mode=true 时，对模糊输入倾向 planning；plan_mode=false 时，对模糊输入倾向 non_planning。
3. 不破坏已有的确定性分流（answer_clarification、confirm_requirements、refine_current_plan、select_plan、switch_task）。

重点文件：
- apps/api/app/agents/requirements.py
- apps/api/app/agents/runner.py（_interaction_type 方法）
- apps/api/tests/test_api_contracts.py

具体要求：

1. 修改 _classify_intent：
   a. "附近有什么"模式不再直接返回 non_planning，而是检查是否同时包含规划上下文关键词（如"约会"、"带娃"、"今天下午"、"周末"、"逛"、"吃+看展"等组合）。
   b. 如果同时包含规划上下文，返回 "planning" 而不是 "non_planning"。
   c. 如果只包含"附近有什么"但不包含任何规划上下文，仍返回 "non_planning"。
   d. plan_mode=true 时，ambiguous 倾向 planning；plan_mode=false 时，ambiguous 倾向 non_planning。

2. 修改 _interaction_type：
   a. 当 intent_kind="ambiguous" 且 plan_mode=true 时，默认走 new_planning_task 而不是 chat_answer。
   b. 当 intent_kind="ambiguous" 且 plan_mode=false 时，默认走 chat_answer。

3. 新增或更新测试，覆盖以下场景：
   a. "附近有没有适合约会的咖啡馆" → intent_kind 不是 non_planning（应为 planning 或 ambiguous）。
   b. "望京有什么好吃的" → plan_mode=true 时走 new_planning_task，plan_mode=false 时走 chat_answer。
   c. "附近有便利店吗" → 无论 plan_mode 如何都走 chat_answer。
   d. "今天下午两个人在望京约会，吃饭加看展" → 走 new_planning_task。
   e. "附近有什么咖啡馆" + plan_mode=true → 走 new_planning_task。
   f. "附近有什么咖啡馆" + plan_mode=false → 走 chat_answer。

4. LLM router 的 guardrails prompt 也需要同步更新，确保 LLM 理解 plan_mode 的语义。

验收：
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。
- "附近有没有适合约会的咖啡馆"不再被误判为 chat_answer。
- "附近有便利店吗"仍然走 chat_answer。
- plan_mode=false 时，模糊输入走 chat_answer。
- plan_mode=true 时，模糊输入走 new_planning_task。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent L 提示词：前端 routePlanningEnabled 接入 plan_mode + 初始状态清理

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/FRONTEND_SPEC.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md、本文档。

你的任务是修复前端两个问题：routePlanningEnabled 开关断开、初始状态预填 Mock。

背景：
- 当前 routePlanningEnabled 是纯 UI 状态，只改变按钮外观，不影响 plan_mode 参数。
- submitSearchQuestion() 和 startInteractionRequest() 始终传 plan_mode: true。
- directAnswer 初始值是 createDirectAnswer("附近有营业中的便利店吗")，这是硬编码 Mock。

目标：
1. routePlanningEnabled 开关真正控制 plan_mode 参数。
2. 初始状态不预填 Mock 数据。

重点文件：
- apps/web/components/mobile-shell.tsx
- apps/web/lib/api.ts
- apps/web/types/dzultra.ts

具体要求：

1. routePlanningEnabled 接入 plan_mode：
   a. submitSearchQuestion() 中，plan_mode 改为 routePlanningEnabled 而不是硬编码 true。
   b. startInteractionRequest() 中，plan_mode 默认值改为 routePlanningEnabled 而不是 true。
   c. 其他调用 interactionMutation.mutate() 的地方也要检查 plan_mode 是否应受 routePlanningEnabled 影响。
   d. routePlanningEnabled 关闭时，搜索框 UI 可以给出提示"路线规划已关闭，将按普通问答回复"。

2. 初始状态清理：
   a. directAnswer 初始值改为 undefined 或空态，不再调用 createDirectAnswer()。
   b. 如果 TypeScript 类型不允许 undefined，可以改为 null 或空对象，但 answering 视图要能处理空态。
   c. submitSearchQuestion() 中的乐观更新 setDirectAnswer 不应包含硬编码文案，可以只设 question 和 loading 态。

3. 保留 fallback 逻辑但加标记：
   a. onError 回调中 createDirectAnswer() 仍然可用，但必须在 apiNotice 中明确标记"API 不可用，展示的是本地 Mock 数据"。
   b. DirectAnswer 类型新增 fallback_reason?: string 字段，fallback 时填入 "api_unavailable"。
   c. answering 视图在 fallback_reason 存在时，用视觉标记（如黄色边框或提示条）告知用户这是兜底数据。

4. 不删除 createDirectAnswer 函数，它作为 fallback 仍然需要。

验收：
- routePlanningEnabled 关闭时，plan_mode=false 传给后端。
- routePlanningEnabled 开启时，plan_mode=true 传给后端。
- 页面初始加载时 directAnswer 不包含硬编码 Mock 数据。
- API 失败时 answering 视图有明确的 fallback 标记。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent M 提示词：后端 chat 链路确保真实 provider 优先

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/BACKEND_SPEC.md、docs/internal/AGENT_STRATEGY.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md、本文档。

你的任务是确保后端 chat 链路优先使用真实 provider，并完善 fallback 标记。

背景：
- 当前 DeterministicMockRunner.chat() 已经优先调用 provider_adapter.poi_search（高德优先）和 provider_adapter.llm_chat_completion（LongCat 优先）。
- 但如果 provider 不可用，fallback 到本地 Mock POI 和模板回答时，前端可能无法区分真实数据和 Mock 数据。
- chat 链路的 fallback 标记在 Trace 中有记录，但 ChatResponse schema 本身没有 fallback 标记字段。

目标：
1. ChatResponse schema 增加 fallback 标记，让前端能区分真实数据和 Mock 数据。
2. 每个 related_poi 标记其字段级别的可靠性（哪些字段来自真实 provider，哪些是 Mock 补充）。
3. chat 链路的 Trace 事件更完整，包含 provider 调用详情和 fallback 原因。

重点文件：
- apps/api/app/models/schemas.py（ChatResponse、MockPoi schema）
- apps/api/app/agents/runner.py（chat 方法）
- apps/api/app/providers/adapter.py
- apps/api/tests/test_api_contracts.py

具体要求：

1. ChatResponse schema 新增字段：
   a. fallback_used: bool — 整体是否使用了 fallback。
   b. fallback_reason: str | None — fallback 原因。
   c. poi_provider: str — POI 数据来源，"amap" 或 "mock_poi_search"。
   d. answer_provider: str — 回答来源，"longcat" 或 "template"。

2. MockPoi schema 新增字段：
   a. source: str — "amap" 或 "mock"。
   b. reliability: dict[str, str] — 字段级可靠性标记，例如 {"name": "amap", "queue_minutes": "mocked", "ugc_summary": "mocked"}。
   c. 已有这些字段的保持不变，只补充缺失的。

3. chat 方法更新：
   a. 每个 related_poi 根据 provider_adapter 的返回结果标记 source 和 reliability。
   b. 高德返回的真实字段（name、address、latitude、longitude、rating、phone、images）标记 source="amap"。
   c. Mock 补充的深度字段（queue_minutes、ugc_summary、recommended_dishes）标记 reliability 中对应 key 为 "mocked"。
   d. ChatResponse 的 fallback_used、fallback_reason、poi_provider、answer_provider 根据实际调用结果填写。

4. Trace 事件更新：
   a. candidate_retrieved 事件的 tool_output 中增加每个 POI 的 source 和 reliability。
   b. chat_answered 事件的 tool_output 中增加 answer_provider 和 fallback 信息。

5. 新增或更新测试：
   a. 高德可用时，ChatResponse.poi_provider == "amap"。
   b. 高德不可用时，ChatResponse.poi_provider == "mock_poi_search"，fallback_used == True。
   c. 每个 related_poi 的 reliability 中，高德字段标记 "amap"，Mock 字段标记 "mocked"。

验收：
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。
- ChatResponse 包含 fallback_used、poi_provider、answer_provider 字段。
- 每个 related_poi 包含 source 和 reliability 字段。
- 高德可用时 POI 来源标记为 amap。
- 高德不可用时 fallback_used=True 且 fallback_reason 非空。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent N 提示词：前端 DirectAnswer 类型扩展与 answering 视图升级

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/FRONTEND_SPEC.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md、本文档。

你的任务是升级前端 answering 视图，让它展示真实 POI 数据并标记 fallback。

背景：
- 当前 DirectAnswer 类型只有 question/answer/poiHints，poiHints 只有 name/meta/reason 三个字符串。
- 后端 ChatResponsePayload.related_pois 包含 id、category、latitude、longitude、address、images、recommendedDishes 等丰富字段，但 directAnswerFromChatResponse() 只提取了 name/meta/reason。
- answering 视图（DirectAnswerView）只展示 POI 名称、元信息文本和推荐理由，无法展示地址、评分、推荐菜等。
- 没有任何 fallback 标记展示。

目标：
1. DirectAnswer 类型扩展，保留足够 POI 信息。
2. answering 视图展示更丰富的 POI 信息。
3. fallback 数据有明显视觉标记。
4. "转为路线规划"入口可用。

前置条件：
最好等 Agent M 完成后再做。如果 Agent M 尚未完成，你可以先准备类型和适配层，但不要删除旧字段。

重点文件：
- apps/web/components/mobile-shell.tsx（DirectAnswer 类型、directAnswerFromChatResponse、DirectAnswerView）
- apps/web/types/dzultra.ts（ChatResponsePayload、ChatRelatedPoi 类型）
- apps/web/lib/api.ts

具体要求：

1. DirectAnswer 类型扩展：
   a. poiHints 数组的元素类型从 {name, meta, reason} 扩展为更丰富的 PoiHint 类型，至少包含：
      - id: string
      - name: string
      - category: string
      - address: string
      - rating: number
      - meta: string（保留兼容）
      - reason: string
      - latitude?: number
      - longitude?: number
      - recommendedDishes?: string[]
      - openHours?: string
      - source?: "amap" | "mock"
      - reliability?: Record<string, string>
   b. 新增 fallback_reason?: string（与 Agent L 的修改合并）。
   c. 新增 poi_provider?: string。
   d. 新增 answer_provider?: string。

2. directAnswerFromChatResponse 更新：
   a. 映射后端 ChatRelatedPoi 的完整字段到 PoiHint。
   b. 传递 source、reliability、poi_provider、answer_provider、fallback_reason。

3. DirectAnswerView 升级：
   a. POI 卡片展示更多信息：地址、评分、推荐菜、营业时间。
   b. source="amap" 的 POI 可以加一个小标记（如"高德数据"）。
   c. source="mock" 或 reliability 中有 "mocked" 字段的 POI，用视觉标记提示（如浅黄色背景或"部分数据为模拟"提示）。
   d. 整体 fallback_reason 存在时，在回答顶部展示提示条："当前 API 不可用，展示的是本地模拟数据"。
   e. 保留"转为路线规划"入口，点击后用当前 related_pois 的 id 发起路线规划请求。

4. answering 视图空态处理：
   a. directAnswer 为 undefined/null 时，不展示 answering 视图。
   b. poiHints 为空数组时，展示"正在检索相关地点"的 loading 态。

5. 不破坏现有功能，旧字段 meta/reason 保持兼容。

验收：
- API 成功返回 chat_answer 时，answering 视图展示真实 POI 的地址、评分、推荐菜。
- 高德 POI 有"高德数据"标记。
- Mock 补充字段有"模拟数据"标记。
- API 失败 fallback 时，有明确的提示条。
- "转为路线规划"入口可点击。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent O 提示词：端到端验证

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/V3_AGENT_TRACE_REAL_PROVIDER_ROADMAP.md、docs/internal/V3_AGENT_TRACE_EXECUTION_PROMPTS.md、本文档。

你的任务是对搜索分流和普通问答展示做端到端验证。

前置条件：
Agent K、L、M、N 都已完成。

背景：
- 之前存在两个核心问题：搜索框输入全部走 chat_answer、普通问答展示 Mock 数据。
- 经过前四个 Agent 的修复，分流逻辑和展示层应该已经改善。

目标：
验证以下场景全部通过，如有问题直接修复。

验证场景：

1. 分流准确性：
   a. 搜索框输入"今天下午两个人在望京约会，吃饭加看展" → 走 new_planning_task，展示路线方案。
   b. 搜索框输入"附近有没有适合约会的咖啡馆" + 路线规划开启 → 走 new_planning_task。
   c. 搜索框输入"附近有没有适合约会的咖啡馆" + 路线规划关闭 → 走 chat_answer。
   d. 搜索框输入"附近有便利店吗" → 无论开关状态都走 chat_answer。
   e. 搜索框输入"望京有什么好吃的" + 路线规划开启 → 走 new_planning_task。
   f. 方案页输入"第二个换成不辣的" → 走 refine_current_plan。

2. 展示真实性：
   a. chat_answer 的 answering 视图展示后端返回的真实 answer 和 related_pois。
   b. 高德 POI 有来源标记。
   c. Mock 补充字段有"模拟数据"标记。
   d. API 失败时有 fallback 提示。
   e. 初始页面没有预填 Mock 数据。

3. Trace 可追溯：
   a. chat_answer 的 Trace 包含 InteractionRouterAgent 分流事件。
   b. Trace 中能看到 provider=amap 或 fallback_provider=mock_poi_search。
   c. 每个 POI 的 source 和 reliability 在 Trace 中可见。

4. 后端测试：
   a. conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。

5. 前端 lint：
   a. npm --workspace apps/web run lint 通过。

如果某个场景不通过，直接修复相关代码，然后重新验证。修复时遵守 AGENTS.md 和本文档的协作规则。

完成后报告每个场景的验证结果、修复了什么、最终状态。
```

## 如果只开一个窗口，推荐此窗口继续的任务

建议先做 Agent K（后端分流逻辑修复），因为：

- 它是当前体验最差的根因——所有搜索输入都走 chat_answer。
- 不修它，后续展示优化没有意义——用户根本看不到路线方案。
- 修完后，前端 routePlanningEnabled 接入才有后端支撑。

单窗口顺序建议：

```text
Agent K -> Agent L -> Agent M -> Agent N -> Agent O
```

如果要并行，建议先开两个窗口：

```text
窗口 1：Agent K（后端分流）
窗口 2：Agent L（前端 plan_mode 接入 + 初始状态清理）
```

Agent M 和 N 最好等 K 和 L 完成后再开始，因为 M 依赖 K 的分流结果稳定，N 依赖 M 的 schema 变更。
