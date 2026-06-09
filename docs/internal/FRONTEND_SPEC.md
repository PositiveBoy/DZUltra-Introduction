# DZUltra 前端实现规范

> 范围：`apps/web`。当前阶段是 V3：真实 LLM、地图和天气 provider 优先；排队、UGC、推荐菜、用户历史等深度字段继续 Mock，并且只在当前 run 用到、fallback 或 Mock 生成器场景中展示。

## 1. 总原则

用户端是 Web 网站里嵌入的手机尺寸体验，不是营销落地页。第一屏应该直接进入可用产品：用户能说需求，系统能给方案。

V3 前端目标：

1. 用户端继续保持大众点评移动端直觉。
2. 首次进入 Web 端时，Debug Trace、History、Mock 数据面板都为空，不预置静态 Agent run 或基础 Mock 数据。
3. 所有路线、补全问题、需求总结、微调 diff 优先吃后端真实 API response。
4. 右侧 Debug Trace 展示真实模型耗时、token、成本、tool 调用和 fallback，不再用静态日志假装已有 run。
5. 普通 POI 问答能返回 `answer + related_pois + trace`，不会误进入完整路线页。
6. 前端不关心数据来自真实 provider 还是 Mock fallback，只消费稳定 schema；但 Debug 必须讲清楚来源。

## 2. 技术选择

- Next.js App Router + TypeScript。
- Tailwind CSS 做样式。
- shadcn/ui 只用于基础控件和桌面 Debug，`MobileShell` 需要自定义大众点评风格视觉。
- lucide-react 优先提供图标。
- Motion for React 做页面过渡、Agent 进度、卡片替换、方案展开。
- Swiper 只用于横向方案/POI 浏览。
- Zustand 管 UI 状态。
- TanStack Query 管 API 请求、缓存和轮询。
- V3 优先消费后端 `map_preview`。后端可以来自高德地图或 mock_map_provider，前端不要把业务逻辑绑死在地图 SDK 上。

### 2.1 依赖与安全检查

- 前端依赖通过根目录 npm workspace 安装：`npm install` 或 `npm install --workspace apps/web <package>`。
- 首次安装会生成 `package-lock.json`，后续不要手动改锁文件；需要升级依赖时用 npm 命令更新。
- `eslint.config.mjs` 使用 ESLint 9 flat config。Next 的旧式 preset 需要通过 `FlatCompat` 兼容，不要直接展开 `eslint-config-next/core-web-vitals`。
- `npm audit fix --force` 不能直接执行；它可能强行降级/升级 Next、React 等核心框架，导致 Demo 破坏。

## 3. MobileShell 页面状态

`MobileShell` 至少支持这些状态：

| 状态 | 用户看到什么 |
| --- | --- |
| `entry` | 类大众点评首页/搜索入口，可点击进入点仔 Ultra |
| `start` | 全屏对话首页，preset prompt、文字/语音输入外观 |
| `running` | 用户 prompt 顶部展示，Agent 执行流线性展开 |
| `chat_answer` | 普通 POI 问答结果，不展示完整路线方案 |
| `clarifying` | 信息补全卡片或 Agent 自主提问卡片 |
| `summary` | 需求总结确认卡片 |
| `plans` | V2 固定 3 套横向方案卡片 |
| `refining` | 当前方案局部替换或重新生成 |
| `selected` | 选用方案后的时间线和 To-do |
| `settings` | 设置与偏好管理页 |
| `error` | 网络/模型/定位等错误态 |

## 4. 核心交互

入口与启动：

- 大众点评首页或搜索框只做仿真入口。
- 点仔 Ultra 打开后是全屏对话页。
- 底部输入栏支持文字模式和语音模式外观；真实录音可后置。
- 输入栏附近建议提供一个克制的模式开关：`路线规划` 默认打开。它只表达用户意图倾向，不替代后端自动分流。

需求输入：

- 用户发送后，欢迎内容模糊淡出。
- 用户输入文字先作为本轮对话的第 1 个纵向内容块显示，块内可以有打字动效和加载副标题。
- Agent 链作为第 2 个纵向内容块追加在用户输入块下方，不替换用户输入块；后续补全、总结、方案也继续向下追加。
- `mobileView` 是当前流程阶段标记，不是路由页。切换 `running`、`clarifying`、`summary`、`plans` 时，只能决定“新增或激活哪些内容块”，不能清空前面已经出现的块。
- 右侧节点指示器只对应纵向内容块。新内容块出现时，MobileShell 内部滚动容器自动滚到新块关键位置；不能调用会带动整个 Web 页面滚动的外层滚动。
- Agent 链在同一个内容块内线性展开，不用传统聊天气泡；每个 Agent 节点不单独增加右侧节点。
- 点击已发送文字进入编辑态，重新提交会重启当前流程。
- 顶部 prompt 胶囊或 top bar 只能有一个实现来源，不能同时在 Header 和内容区叠两套。它应避开左右按钮安全区，点击后展开本轮 prompt 面板。

Plan 模式：

- 默认打开，因为点仔 Ultra 的主任务是路线规划。
- 打开时，包含出行目标、时间、地点或人群倾向的输入都偏向完整路线规划。
- 关闭时，前端传 `plan_mode=false`，模糊输入更偏向普通 POI 问答。
- 它不是硬规则。关闭后如果用户输入明显是路线需求，后端仍可识别为规划，并由前端展示“这更像路线规划，要切换吗？”或“转成路线规划”入口。
- 打开后如果用户只是问“附近有什么咖啡馆”，后端仍可识别为普通问答，并由前端展示“帮我排成路线”入口。
- UI 文案建议用“路线规划”，不要只写英文 `Plan`，避免新用户不理解。

意图分流：

- 每次用户输入都要带上当前页面和任务上下文，让后端知道用户是在启动页、补全页、需求确认页、方案页还是普通问答页。
- 如果后端判断为路线规划，进入完整 Agent 执行流。
- 如果后端判断为普通 LLM 对话，展示 answer + related POI + “转成路线规划”入口。
- 如果输入模糊，展示意图确认卡片；Plan 模式打开时默认选“继续规划路线”。
- 如果用户在方案页输入“第二个换成川菜”，前端应允许后端识别为 `refine_current_plan`。
- 如果用户在方案页输入“算了，明天去上海”，前端应允许后端识别为 `switch_task` 或 `new_planning_task`，不要强行套用当前方案微调。

信息补全：

- 只有目标城市/区域、时间窗、人数、是否安排吃喝是阻塞字段。
- 预算、口味、体力、交通偏好、拍照偏好等可以作为第二轮偏好问题，不阻塞。
- Agent 最多追问 2 轮；第二轮最多 3 个问题。
- 每张卡片都是页面内容块，不是弹窗遮罩。
- 选择题必须有“其他”入口，允许用户直接输入或语音补充。
- 前端根据 `ClarificationCard.ui_component` 渲染不同控件；schema 未补齐前可按 `field` 和 `selection_mode` 兜底。

问题模块：

| 模块 | 用途 |
| --- | --- |
| 单选 | 是否吃喝、路线风格、交通偏好 |
| 多选 | 想吃什么、想避开什么、体验偏好 |
| 人数选择 | 1 人、2 人、3-4 人、5 人以上、其他 |
| 时间选择 | 上午、下午、晚上、自定义时间段 |
| 预算选择 | 人均预算、总预算、其他 |
| 自由输入 | 具体商圈、特殊要求、选择题其他答案 |

方案展示：

- V2 固定生成 3 套方案，横向 snap 切换。
- V3 可扩展到 3-5 套，但前端组件不要写死只能 3 套。
- 每套方案包含标题、小地图、交通摘要、POI 列表和推荐理由。
- 越优的方案越靠前。
- 用户端弱化数字分数，优先展示推荐标签和排序理由，例如“推荐”“更轻松”“更省钱”“更适合拍照”。
- 点击方案卡片可全屏展开，展示 UGC 摘要和跳转入口。

微调：

- 底部输入栏默认作用于当前方案。
- 支持“换掉咖啡馆”“第二个换成川菜”“保留第一个和第三个”等局部修改。
- 被替换的 POI 行需要短暂高亮，告诉用户哪里变了。
- 用户明确要求“重新生成”时进入整体重跑。
- 微调指令也会进入偏好检测，但这是后台能力，不打断用户。

选用方案：

- 展示倒计时、交通方式切换、POI 时间线。
- POI 操作入口先用 mock 链接/禁用态展示：导航、排队、团购、购票、预订。
- To-do 清单可勾选，已完成项变灰下沉。

## 5. Agent 执行动效

V3 每个 Agent 步骤需要显示“现在正在做什么”。用户提交前不展示任何预置 Agent 步骤；提交后才根据本轮 trace 或等待态展示。

前端使用这些数据：

- `trace.events[].agent`
- `trace.events[].type`
- `trace.events[].summary`
- `trace.events[].duration_ms`
- `trace.agent_strategy[]`

规则：

- 默认按后端 `duration_ms` 播放。
- 可以设置演示加速系数，避免真实等待太久。
- 当前 Agent 节点需要高亮，完成后显示简短产出。
- 如果 API 很快返回，也可以在前端按模拟时间补完动画，再进入方案页。
- 如果前端等待超过 `NEXT_PUBLIC_DZULTRA_AGENT_TIMEOUT_MS`，或 API 报错/返回结构不合法，可以使用本地 Mock fallback，但必须在本轮 Trace 和 Mock 面板写明原因。
- 后台异步 Agent，比如 `UserPreferenceAgent`，可以在 Debug 里显示，不一定在用户端播放完整等待。

## 6. Web 壳与 Debug Trace

桌面 Web 布局：

- 左侧：`MobileShell`，默认约 `390px x 844px`。
- 右侧：`DebugTracePanel`，展示当前 run 的 Agent Trace。
- 窄屏时右侧 Debug 可下移，但 V2 主要面向桌面演示。
- 首次进入时右侧 Debug Trace 显示空态，不读取静态 `traceEvents` 兜底。

同步规则：

- 用户端进入某个 Agent 步骤时，Debug 中对应 Trace 节点高亮。
- 用户端方案切换时，Debug 展示该方案的匹配度分、约束摘要和排序理由。
- 用户端微调时，Debug 追加 `user_refinement_received` 和受影响 Agent 事件。
- 普通 POI 问答时，Debug 展示 ChatAnswerAgent 和 related POI，不展示路线评分页。

建议 Debug 面板一级视图：

| 视图 | 内容 |
| --- | --- |
| 过程摘要 | Agent 时间线、当前节点、run 状态、总耗时 |
| 候选池 | Mock POI、UGC 命中、被排除 POI 和排除理由 |
| 方案排序 | 3 个方案的匹配度分、排序理由、约束满足情况 |
| 地图与距离 | 坐标、距离矩阵、通勤估算、provider、fallback |
| 完整 JSON | 当前 `AgentTrace` 和 response 原始结构 |
| 历史 Run | `/traces` 列表和详情回放 |
| Mock 数据 | 仅展示当前 run 用到的 Mock User、Mock POI、偏好档案、Mock 生成器结果或 fallback 数据；首次进入为空 |

Mock 数据生成面板属于 V3 开发者能力：

- 不在首屏展示写死的 Mock 用户和 Mock POI。
- 提供表单，让演示者输入城市、商圈、用户类型、游玩主题。
- 调用 `/mock/generate-user`、`/mock/generate-pois` 或 `/mock/generate-ugc` 生成结构化样例。
- 生成结果先预览，再决定是否用于当前演示 run。
- 面板要展示校验结果、地图坐标来源和 fallback 状态。

## 7. 地图展示

- 优先接高德地图 API。
- 如果高德额度或接入失败，fallback 是 mock png。
- 前端优先消费后端 `map_preview` 数据，避免直接把业务逻辑写进地图 SDK。
- 地图必须展示 RoutePlan 里的点位顺序、站点 label、移动摘要。
- 地图不要只是装饰图；用户要能理解路线大概怎么走。

## 8. 视觉规范

用户端：

- 风格接近大众点评移动端：暖白底、橙黄强调、高密度信息、短行动路径。
- 不直接使用 shadcn 默认后台视觉。
- 卡片圆角克制，普通信息卡 8-16px，手机外壳可更大。
- 不做装饰性渐变光球、营销 Hero、大块空泛介绍。
- 重要行动按钮固定在用户容易触达的位置。
- 模式开关要轻，不要抢输入栏和发送按钮的主视觉。

全局交互：

- Blur 用于启动页淡出、编辑态背景、顶部 prompt 胶囊、滚动边缘渐隐。
- 内容块使用纵向滚动组织，右侧节点指示器属于用户端内部能力。
- 一段对话必须保持为连续纵向流：用户输入、Agent 执行、补全问题、补全后的 Agent 反应页、需求总结、最终方案和选用后的执行页都要能从头到尾回看，不能因为 `mobileView` 状态切换而清空前面的内容。
- “每一页”指可吸附内容块，不是路由页。每个内容块内部可以继续上下滑动；滑完该块后继续下滑，才吸附到下一个内容块顶部。
- Agent 每个节点不单独算一页；Agent 链在同一个内容块内播放。最终 3 套方案也不拆成 3 个竖向节点，而是在同一个“方案页”内容块内横向 snap。
- 当新内容块出现时，自动滚动到该块关键文字处，例如用户输入、问题标题、补全后的思考标题、需求总结标题或“给你 3 套方案”。
- 动效以解释状态为主，不能拖慢演示。
- 主要动画建议 160-450ms，并尊重 reduced motion。

## 9. 状态与数据

Zustand 只放 UI 状态：

- 当前用户端状态。
- 当前选中方案/POI/Trace 节点。
- 当前页面上下文，用于请求里的 `interaction_context`。
- 输入栏模式。
- Plan 模式开关状态。
- 卡片展开、锁定 POI、右侧面板开合等瞬态状态。

TanStack Query 管服务端数据：

- `useMockUsersQuery`
- `useMockPoisQuery`
- `usePlanRouteMutation`
- `useRefineRouteMutation`
- `useTraceRunsQuery`
- `useTraceDetailQuery`
- 后续：`useChatRespondMutation`
- 后续：`useMapPreviewQuery`
- 后续：`useGenerateMockDataMutation`

原则：路线和 Trace 数据不要重复塞进 Zustand，除非是编辑草稿。

## 10. 前端验收

V3 用户端验收：

- 只看 `MobileShell`，能跑通输入、补全、生成 3 个方案、微调、选用方案。
- 首次进入不展示预置方案、预置 Trace 或基础 Mock 数据。
- 每个 POI 都有推荐理由。
- 方案切换、局部替换、错误态都有清晰反馈。
- 普通 POI 问答不会误进入完整路线页。
- Plan 模式开关能影响模糊输入倾向，但不会阻止明显任务被自动分流；文案新用户能看懂。
- 方案页、补全页、确认页里的输入能结合页面上下文判断交互类型。
- Agent 执行动效能说明当前正在做什么。

V3 Web / Debug 验收：

- 桌面页左用户端、右 Debug Trace 同屏。
- 首次进入时 Trace、History、Mock 数据都是空态。
- Agent 步骤和用户端状态能同步高亮。
- Debug 能展示过程摘要、候选池、方案排序、地图与距离、完整 JSON、历史 Run。
- Mock 数据面板只解释当前 run 用到的 Mock 用户、偏好、POI、UGC、地图来源和 fallback 原因。
- 前端变更后至少通过 `npm run lint:web` 或 `npm run build:web`。
