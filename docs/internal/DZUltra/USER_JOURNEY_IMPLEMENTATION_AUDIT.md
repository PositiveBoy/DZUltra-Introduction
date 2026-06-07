# DZUltra 用户旅程实现审计

更新时间：2026-06-05

本文用于对照 `docs/internal/DZUltra/USER_JOURNEY_DESIGN.md` 检查当前 Demo 实现状态。结论先说：V1 已经具备从入口、启动、需求输入、Agent 执行、补全确认、方案浏览、局部微调到选用方案的端到端演示闭环；但它仍未完全达到愿景文档里的最终形态。因此已经启动 V2，实现方向是让用户端和 Debug 端逐步吃真实 API 返回的数据，而不是只依赖前端写死 Mock。

## 当前实现概览

| 旅程步骤 | 当前状态 | 证据 | 说明 |
| --- | --- | --- | --- |
| Step 1 入口触发 | 部分满足 | `apps/web/components/mobile-shell.tsx` 的 `EntryView`、`SearchTransitionView` | 已有类大众点评首页、搜索入口、点仔 Ultra 入口；搜索关键词进入 AI 路径。真实主站嵌入和线上搜索识别仍是 Mock。 |
| Step 2 全屏启动 | 部分满足，V2 已推进 | `StartView`、`MobileComposer` | 已有顶栏、欢迎标题、提示卡、preset prompt、文字/语音切换。V2 已支持语音按住、蓝色辉光、上滑取消和松手 Mock 识别提交。真实录音、权限引导、键盘系统级行为仍未接入。 |
| Step 3 Agent 执行流 | 部分满足，V2 已推进 | `RunningView`、`PromptEditorOverlay`、`DebugTracePanel`、后端 `trace.agent_strategy` | 已有非气泡式输入、Agent 链、当前执行节点动画、顶部需求摘要胶囊。V2 已支持前端优先读取后端 `trace.agent_strategy` 渲染 Agent 顺序和职责，也支持点击已发送需求进入编辑态并重新规划。真实 LLM 流式执行和更细的请求暂停/恢复语义还未完整实现。 |
| Step 4 多轮确认 | 部分满足，V2 已推进 | `ClarifyingView`、`SummaryView`、`SettingsView`、后端 `requirements.py` | 已有关键字段补全、Agent 自主偏好提问、需求总结确认。V2 已支持渲染后端动态 `clarification_cards`，并用 `requirement_summary.user_visible_summary` 驱动需求确认卡；动态卡片已支持单选、多选和自由文本答案回填；设置页的“需求确认”开关会决定是否跳过总结页。新一轮 V2 已支持底部文字/语音补充的规则解析回填，并把人数/时间做成更接近移动端滚轮的控件。真正的语音 NLU 和更完整的 iOS 惯性滚轮仍需继续完善。 |
| Step 5 多方案浏览 | 部分满足，V2 已推进 | `PlansView`、`ExpandedPlanSheet`、`apiPlanToDemoPlan` | 已有三套方案横滑、伪地图、交通摘要、POI 列表、点击全屏展开和 UGC 摘要。V2 已支持把后端 `plans` 映射进手机 UI。真实地图跳转和 shared element 动效未完成。 |
| Step 6 灵活微调 | 部分满足，V2 已推进 | `refineCurrentPlan`、`getChangedStopIdFromDiff`、后端 `/routes/refine` | 已有“换掉咖啡馆/更少走路/展览提前”等微调，API 成功时使用真实 `refinement_diff` 高亮被修改站点；API 失败时前端 Mock 兜底。复杂指令和连续 5 次引导还未完整。 |
| Step 7 生态落地 | 部分满足，V2 已推进 | `SelectedPlanView`、`EntryView` 同步计划卡 | 已有选用后时间线、交通切换、POI 操作入口、分享生成状态、To-do 清单、首页同步计划卡。V2 已支持 Mock AWP 分享链接、POI 操作 mock URL 和操作回执；真实系统分享面板、地图/团购/排号线上跳转未完成。 |
| 全局内容块导航 | 部分满足，V2 已推进 | `FlowPageIndicator`、`data-flow-block` | 已有右侧节点指示器和内容块滚动。V2 已支持点按跳转、按住拖拽跳转和静止 2 秒后半透明淡化；更细的苹果式惯性调参仍未完成。 |
| Debug Trace | V2 已推进 | `DebugTracePanel`、`use-demo-store.ts` 的 `activeTrace`、后端 `/traces` | 已有静态 Trace 兜底，也能展示后端真实 Trace 的事件、工具、输入/处理/输出摘要、Agent Strategy、完整 JSON、历史 run、模型调用和成本估算。真实 LLM 的实际计费还未接入。 |

## V2 已开始的实际功能

1. 真实 Trace 接入前端状态。
   - `useDemoStore.activeTrace` 保存 `/routes/plan` 和 `/routes/refine` 返回的 `trace`。
   - Debug 面板优先展示真实 Trace，没有 API 时回退静态示例。

2. 后端真实方案接入手机端。
   - `ApiRoutePlan` 描述后端 snake_case 响应。
   - `apiPlanToDemoPlan` 把后端 `plans` 转换为前端 `DemoRoutePlan`。
   - 规划成功后，左侧方案卡不再只能使用 `demoRoutePlans`。

3. 真实微调 diff 驱动 UI 高亮。
   - `/routes/refine` 返回 `refinement_diff` 时，前端使用 `stop_index` 或 `after_poi_id` 找到被替换站点。
   - API 不可用时才使用本地 Mock 微调兜底，避免真实响应被前端定时器覆盖。

4. 后端动态补全与需求确认驱动前端。
   - `/routes/plan` 返回 `needs_clarification` 时，前端进入 Step 4 并按 `clarification_cards` 渲染问题、选项和提问原因。
   - 用户确认补全信息后，前端带 `clarification_answers` 再次请求后端。
   - `/routes/plan` 返回 `needs_confirmation` 时，前端进入 Step 4.3，并优先展示 `requirement_summary.user_visible_summary`。
   - 用户点击“确定，开始规划”后，前端带 `confirmed_requirements=true` 进入真实方案生成。
   - `ClarifyingView` 已按 `selection_mode` 区分单选、多选和自由文本；多选答案会合并后按字段名提交给后端。

5. 后端 Agent Strategy 驱动前端执行链和 Debug。
   - `AgentTrace.agent_strategy` 已补齐前端类型。
   - `RunningView` 优先用后端策略生成 Agent 节点，前端静态 `agentSteps` 只作为离线 fallback。
   - `DebugTracePanel` 新增 Agent Strategy 区块，展示每个 Agent 的职责、工具、交接条件和失败兜底。

6. Debug Trace 多视图面板。
   - `DebugTracePanel` 新增“过程摘要 / 完整 JSON / 历史 Run”三段视图。
   - “完整 JSON”直接展示当前 `AgentTrace` 原始结构，方便检查 input/output/tool/handoff/metadata。
   - “历史 Run”调用 `/traces` 列表和 `/traces/{trace_id}` 详情，点击历史记录可载入对应 Trace。
   - 后端关键 TraceEvent 已在 `metadata` 中补充 `model_name`、`token_usage`、`estimated_cost_cny` 和 `model_duration_ms`。
   - Debug 摘要页新增“模型调用与成本”区块，并在单个事件详情中展示当前事件的模型、token、耗时和估算成本。
   - 前端静态 `traceEvents` 也已补齐 mock billing metadata；API 不可用时会创建本地 fallback trace，Debug 成本区不再显示空计量。

7. 已发送需求编辑重跑。
   - `RunningView` 中的“你的需求”可点击进入编辑态。
   - 顶部需求胶囊展开后也可进入“编辑需求并重新规划”。
   - 编辑态使用毛玻璃覆盖层突出原 prompt；重新提交会清空当前流程并重新请求后端。
   - 前端为规划请求增加 `client_request_id`，旧请求晚返回时不会覆盖新流程；编辑面板打开时也会暂不处理旧结果。

8. 语音输入 Mock 状态机。
   - `MobileComposer` 语音模式已支持按住录制态、蓝色辉光反馈、上滑/移出取消态、松手取消。
   - 松手发送时会根据当前页面生成 Mock 识别文本，并进入现有规划/补全/微调流程。
   - 该能力仍是前端 Mock，不调用真实麦克风和语音识别服务。

9. Step 7 生态动作 Mock 化。
   - `SelectedPlanView` 的分享按钮会生成 Mock AWP H5 链接，链接带路线、POI 和时间信息。
   - POI 时间线中的导航、排号、团购、购票、预订入口已改为独立可点击动作，并展示操作回执。
   - To-do 清单支持“勾选完成”和“执行对应美大动作”分离，避免用户只能打勾但看不到跳转目标。
   - API 不可用时，前端会在 Running 后自动进入本地 Mock 方案页，保证离线演示不卡在 Agent 执行中。
   - 方案列表和展开方案页的“选用此方案”已抬到输入栏上方，避免被底部输入栏遮挡而误触发卡片展开。

10. 前端 API 请求契约修复。
   - `planRoute` 已完整透传 `clarification_answers`、`skip_clarification`、`require_confirmation`、`confirmed_requirements` 和 `previous_trace_id`。
   - 这保证 Step 4 的动态补全、需求确认和后续重跑语义能真正进入后端，而不是只停留在前端状态。

11. 设置与偏好管理页可交互。
   - `useDemoStore` 新增需求确认、AI 偏好检测、数据授权三个开关。
   - `SettingsView` 支持切换开关、修正偏好、删除偏好。
   - 关闭“需求确认”后，下一次规划请求会带 `require_confirmation=false`，后端信息足够时直接返回方案。
   - 关闭“数据授权”后，下一次规划使用匿名用户，并且不把本地偏好列表带入请求约束。
   - 后端新增 `/profiles/{user_id}/preferences`、`/profiles/preferences/detect`、偏好修正和删除接口。
   - V2 已把偏好档案从内存字典升级为本地 JSON Mock 存储：默认读写 `data/mock/user_preferences.json`，测试环境可用 `DZULTRA_PROFILE_STORE_PATH` 指向临时文件。

12. 内容块导航 V2。
   - `FlowPageIndicator` 保留点按跳转，并新增按住/拖拽跳转。
   - 指示器在交互或滚动变化时恢复清晰，静止 2 秒后自动半透明淡化。
   - 拖拽过程中指示器会放大并增强背景，方便用户知道正在进行章节选择。

13. Step 4 自然语言补全回填。
   - `ClarifyingView` 的动态人数卡改成 1-20 人的滚轮感选择器，时间卡展示快捷时段和开始/结束预览。
   - 底部输入栏在补全阶段会解析“三个人，下午，吃小吃，微辣可以，人均150以内”这类文本或 Mock 语音结果。
   - 解析结果会回填 `clarificationCardAnswers` 和 `ClarificationState`，再通过 `buildClarificationAnswers` 进入后端 `/routes/plan`。
   - 总结页如果继续输入补充条件，会更新本轮 prompt 和本地字段；点击确认后继续走后端规划请求，而不是退回纯前端本地方案。

14. 本地真实浏览器链路修复。
   - 浏览器 QA 发现用 `http://127.0.0.1:3000` 打开前端时，API CORS 只允许 `http://localhost:3000`，导致 `/routes/plan` 预检 400。
   - `apps/api/app/main.py` 已补充 `127.0.0.1` 和 `[::1]` 本地前端来源。
   - `apps/api/tests/test_api_contracts.py` 新增 CORS 回归测试，避免本地 QA 入口不同导致真实前后端链路失效。

## Agent 编排判断

V2 已确认继续保持 `DeterministicMockRunner`，不在 V2 接入真实 LLM 或 LangGraph。原因：

- 现阶段 Demo 的最高优先级是稳定演示、推荐可解释、Debug 链路可读。
- 当前后端已有明确的 `DeterministicMockRunner`、`MAIN_PLANNING_AGENT_STRATEGY` 和 `AgentTrace` contract，适合作为 V2/V3 的稳定边界。
- LangGraph 更适合 V3 处理真实多 Agent 状态图、可恢复执行、长任务中断和条件分支。接入时应保持 `RoutePlanResponse.trace` 结构不变，让前端无需重写。

建议的后续顺序：

1. V2 继续完善动态 `clarification_cards`、总结确认、方案微调、设置与偏好管理、生态动作 Mock 和完整视觉 QA。
2. V2 继续使用 deterministic mock 数据和本地 JSON Mock 偏好档案，先把设计文档中的用户体验闭环跑顺。
3. V3 再新增真实 LLM runner 和 LangGraph runner，与 `DeterministicMockRunner` 并列，通过环境变量切换。
4. V3 再接真实地图/分享/美大动作入口、真实计费和线上用户档案。

## 仍未满足的关键差距

| 差距 | 影响 | 推荐处理 |
| --- | --- | --- |
| 真实语音录入和权限引导未实现 | Step 2/3 已有 Mock 语音状态机，但还不是真实录音 | V2 后段接 Web Speech 或原生容器能力，并补麦克风权限失败 toast/系统引导。 |
| 真实流式请求暂停/恢复还不完整 | Step 3 已有编辑重发和旧请求忽略，但还不是完整 LLM 流式暂停 | 后续真实 LLM runner 接入后，为每个 run 增加前端消费游标和 pause/resume 状态，只暂停前端消费，不强制取消后端请求。 |
| 动态补全卡控件仍不够细 | Step 4 已接后端卡片，且支持多选、自由文本、底部自然语言解析回填、人数滚轮感选择器和时间预览，但还不是最终 iOS 原生滚轮手感 | 继续增强真实语音 NLU、字段置信度、解析失败 toast、时间范围编辑和苹果式惯性滚轮。 |
| 偏好管理仍是本地 Mock 档案 | 设置页已能通过 API 读取、修正、删除偏好，并写入 `data/mock/user_preferences.json`；但这仍不是线上数据库或真实账号体系 | V2 继续把本地 JSON 作为可演示档案；V3 再接真实用户档案数据库、权限和跨设备同步。 |
| 内容块滚动仍未做到完整手感 | 右侧指示器已支持拖拽和淡化，但滚动容器仍主要依赖浏览器原生行为 | 后续继续调 snap 阈值、惯性停止后的吸附逻辑和跨内容块快速滑动手感。 |
| 地图与外部跳转仍未接真实线上能力 | Step 5/7 已有 Mock AWP URL 和操作回执，但不会真正打开系统地图或美大页面 | 接真实地图/美大链接参数，并补未登录、售罄、排号关闭、地图未安装等边界状态。 |
| 真实 LLM 计费未接入 | Debug 已有 Mock 估算，但不代表真实线上成本 | 接入真实 LLM runner 后，把 `TraceEvent.metadata` 里的 `model_name`、`token_usage`、`estimated_cost_cny`、`model_duration_ms` 替换成真实 span 数据。 |
| 完整浏览器视觉 QA 尚未完成 | 已补设置页和部分流程的浏览器检查，但还不能证明全旅程所有布局都无遮挡 | 继续按 Step 1-7 做系统性截图和交互 QA，覆盖移动端、桌面 Debug、展开页、选用方案页和异常态。 |

## 当前会话复查

- `npm run lint:web`：通过。
- `npm run build:web`：通过。
- `conda run -n agent pytest tests/test_api_contracts.py`（在 `apps/api` 下执行）：11 passed，新增覆盖偏好检测、修正、删除和 JSON 落盘。
- `git diff --check`：通过。
- 浏览器 QA：本轮按用户确认暂不执行，避免额外消耗；完整 Step 1-7 截图级视觉 QA 仍是后续验收项。

## 既有验证记录

- `npm run lint:web`
- `npm run build:web`
- `conda activate agent && pytest apps/api/tests/test_api_contracts.py`（10 passed）
- `git diff --check`
- 局部浏览器 QA：启动 `127.0.0.1:3000` + API `127.0.0.1:8000` 后，从大众点评首页入口进入点仔 Ultra，提交“帮我规划今天在望京附近逛逛”，确认真实 API 返回补全卡；在补全阶段输入“三个人，下午，吃小吃，微辣可以，人均150以内”，页面展示“已从补充里识别”并回填人数、时间、饮食、预算、口味；点击“确定，看看总结”后进入需求确认页；点击“确定，开始规划”后生成 3 套方案，显示 `API Trace 已生成`，控制台无应用错误。
- 既有局部浏览器 QA：启动 `localhost:3000` 后进入设置页，确认三个开关、偏好修正/删除、Debug 成本摘要可见，并验证“需求确认”开关点击后状态变化。

以上验证只能证明类型、构建、API contract 和局部交互没破；不能替代完整 Step 1-7 截图级视觉 QA。
