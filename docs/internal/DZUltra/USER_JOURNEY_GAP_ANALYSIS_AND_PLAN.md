# DZUltra 用户旅程差距分析与执行计划

更新时间：2026-06-08

本文基于 `docs/internal/DZUltra/USER_JOURNEY_DESIGN.md` 与当前代码实现的逐项对比，整理出所有未完成项，并拆分为可执行的 Agent 提示词。

用途：让多个新窗口可以直接复制对应提示词开始推进。

建议不要一次性让所有 Agent 同时改同一批文件。先按"波次"推进，每个波次完成并跑通测试后，再进入下一波。

## 差距总览

与 `USER_JOURNEY_DESIGN.md` 对比，当前实现约完成 65-70%。核心差距集中在三个维度：

| 维度 | 完成度 | 说明 |
|------|--------|------|
| **Blur 体系与视觉动效** | ~20% | 5 个 Blur 场景、冻结胶囊、mask-image 渐隐全部缺失。这是设计文档的"灵魂"，缺失时产品更像功能原型 |
| **内容块导航系统** | ~30% | 仿苹果重力滑动、snap-to-top 吸附、指示器滑动跳转、内容块内部滚动仅有雏形。这是设计文档的"骨架" |
| **生态闭环** | ~40% | 导航/排号/购票/预订/分享/首页同步全部是 Mock 回执。这是设计文档的"终点" |

其余维度完成度较高：Agent 编排 ~80%、Debug Trace ~95%、信息补全 ~85%、方案展示 ~65%。

## 总体协作规则

所有 Agent 都必须先读：

- `AGENTS.md`
- `README.md`
- `docs/internal/DZUltra/USER_JOURNEY_DESIGN.md`
- `docs/internal/FRONTEND_SPEC.md`
- 本文档中自己负责的提示词

所有 Agent 都必须遵守：

- 不删除已有 Mock fallback 和真实 Provider 调用逻辑。
- 不回滚其他窗口或用户已有改动。
- 修改前先看相关代码，沿用现有 schema、组件和风格。
- `mobile-shell.tsx` 已超过 4400 行，新增子组件应拆分为独立文件，不要继续往单文件堆叠。
- 前端命令优先使用 `npm --workspace apps/web run ...`。
- 后端命令优先使用 `conda run -n agent ...`。
- 所有动效必须尊重 `prefers-reduced-motion`。
- Blur 效果的半径和时长参考本文档末尾的参数表，不要各自为政。

## 推荐波次

### 第一波：Blur 体系与过渡动效

可以并行：

1. Agent A：全局 Blur 效果与过渡动画实现。
2. Agent B：用户 Prompt 冻结胶囊。

第一波是视觉基础，后续波次的交互都依赖 Blur 和过渡效果。

### 第二波：内容块导航系统

建议按顺序：

1. Agent C：纵向内容块滚动与 snap 吸附。
2. Agent D：右侧节点指示器与快速跳转。

Agent C 和 D 强相关，C 先出滚动容器结构，D 再接指示器。

### 第三波：交互细节补全

可以并行：

1. Agent E：Agent 执行居中动画与错误态 UI。
2. Agent F：语音输入交互完善。
3. Agent G：方案卡片细节补全（sticky 标题、全屏导航、skeleton、POI 字段）。

### 第四波：后端智能化

建议按顺序：

1. Agent H：天气约束闭环。
2. Agent I：微调指令 LLM 理解。
3. Agent J：评分算法深化。

### 第五波：生态闭环与设置页

可以并行：

1. Agent K：生态操作真实化与倒计时。
2. Agent L：设置与偏好管理页完善。

---

## Agent A 提示词：全局 Blur 效果与过渡动画实现

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/FRONTEND_SPEC.md、本文档。

你的任务是实现 USER_JOURNEY_DESIGN.md 中定义的 5 个 Blur 场景和关键过渡动画。

背景：
- 当前 mobile-shell.tsx 的视图切换是直接替换，没有任何 Blur 效果。
- USER_JOURNEY_DESIGN.md 的"设计语言：Blur（模糊）体系"定义了 5 个场景，是整个产品"科技简约感"的核心。
- FRONTEND_SPEC.md 第 8 节也明确要求 Blur 用于启动页淡出、编辑态背景、顶部 prompt 胶囊、滚动边缘渐隐。

目标：
实现以下 5 个 Blur 场景：

1. Step 2 → Step 3 过渡：用户发送后，欢迎标题、荧光橙提示、preset 卡片整体模糊变淡并消失（filter: blur() + opacity → 0），过渡时长 300-400ms。
2. 用户点击已发送文字编辑：对话区除该文字外全部 backdrop-filter: blur()，文字字号增大，键盘弹出。
3. 上下边缘内容溢出：CSS mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)，对话滚动区上下边缘渐进模糊消失。
4. 用户输入胶囊冻结：向下滚动超过用户输入区域后，摘要以 backdrop-filter: blur() + 半透明背景的圆角胶囊锁定在屏幕顶部（此场景由 Agent B 负责，你只需预留胶囊的 blur 样式变量）。
5. 胶囊展开面板：点击胶囊展开后其余页面内容 backdrop-filter: blur()（此场景由 Agent B 负责，你只需预留展开面板的 blur 样式变量）。

重点文件：
- apps/web/components/mobile-shell.tsx
- apps/web/stores/use-demo-store.ts
- 可能需要新增 apps/web/components/transitions/ 目录存放过渡动画组件

具体要求：
1. 新增 CSS 变量或 Tailwind 工具类统一管理 Blur 参数（参考本文档末尾参数表），不要在每个组件里硬编码。
2. 场景 1（发送过渡）：在 StartView 消失时添加 blur+opacity 过渡动画。可以使用 Motion for React 的 AnimatePresence 或 CSS transition。过渡完成后才渲染 RunningView。
3. 场景 2（编辑态模糊）：在用户点击顶部 prompt 文字时，给对话区其余内容添加 backdrop-filter: blur(12px) + 半透明遮罩。点击遮罩区域或按 Escape 取消编辑时移除模糊。
4. 场景 3（边缘渐隐）：在 MobileShell 的主滚动容器上添加 mask-image。注意 mask 不应影响顶部 prompt 胶囊区域（胶囊在滚动容器外部，position: fixed/sticky）。
5. 所有 blur 效果必须尊重 prefers-reduced-motion：用户开启减少动效时，blur 过渡改为即时切换（duration: 0）。
6. 不要破坏现有的视图切换逻辑和 API 调用流程。
7. 如果 mobile-shell.tsx 过大，可以将过渡动画逻辑拆分为独立组件（如 ViewTransition、EditOverlay），但不要大规模重写现有组件。

验收：
- 用户发送 prompt 后，欢迎页内容有 blur+opacity 淡出动画，而非直接消失。
- 点击已发送文字进入编辑态时，背景内容模糊，取消编辑时恢复清晰。
- 对话区上下边缘内容有渐进模糊消失效果。
- prefers-reduced-motion 开启时，所有过渡改为即时切换。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent B 提示词：用户 Prompt 冻结胶囊

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/FRONTEND_SPEC.md、本文档。

你的任务是实现 USER_JOURNEY_DESIGN.md 中定义的"用户 Prompt 冻结胶囊"交互。

背景：
- 当前用户发送 prompt 后，输入文字固定在对话区顶部，但向下滚动后文字会滚出视口，没有冻结胶囊。
- 设计文档要求：向下滚动超过用户输入区域后，大模型总结的摘要以毛玻璃胶囊锁定在屏幕顶部；点击胶囊可展开面板查看本轮所有 prompt。

目标：
实现完整的 Prompt 冻结胶囊交互，包括：
1. 滚动检测：用户输入文字滚出视口时触发冻结。
2. 冻结胶囊：毛玻璃圆角胶囊水平居中锁定在屏幕顶部，显示大模型摘要，溢出用 ... 截断。
3. 展开面板：点击胶囊展开全屏面板，显示本轮所有用户 prompt（原始文字，按时间排序），每条可点击跳转到对应内容块。
4. 面板关闭：点击面板外区域收起，胶囊恢复。
5. 自动消失：用户向上滚动回顶部时，胶囊自动消失，文字恢复原位。

重点文件：
- apps/web/components/mobile-shell.tsx
- apps/web/stores/use-demo-store.ts
- apps/web/lib/api.ts（可能需要新增 prompt 摘要接口或本地摘要逻辑）

具体要求：
1. 新增 PromptCapsule 组件（建议独立文件），包含胶囊和展开面板两个子组件。
2. 胶囊样式：backdrop-filter: blur(10px) + 半透明背景，圆角胶囊，水平居中，单行显示，字号 13-14px，最大宽度 80%。
3. 摘要文本来源：
   - 优先使用后端返回的 prompt 摘要（如果 InteractionResponse 中包含）。
   - 后端未返回时，前端截取原始 prompt 前 15 字 + "..."。
   - 未来可由 LLM 生成更精准摘要，当前先用截取方案。
4. 滚动检测：使用 IntersectionObserver 监听用户输入文字元素是否在视口内。滚出视口时显示胶囊，滚回视口时隐藏胶囊。
5. 展开面板：
   - 全屏覆盖，其余页面内容 backdrop-filter: blur(12px)。
   - 面板内列出本轮所有用户 prompt（首次 prompt + 后续补充 + 修改重发等）。
   - 每条 prompt 可点击，点击后面板收起，滚动容器跳转到对应内容块位置。
6. 胶囊位置避开 MobileShell 顶栏的安全区域（返回按钮、标题等）。
7. 尊重 prefers-reduced-motion：胶囊出现/消失不做动画，直接切换。
8. 不破坏现有的 PromptSheet / PromptEditorOverlay 组件。如果功能重叠，说明如何整合。

验收：
- 用户发送 prompt 后向下滚动，输入文字滚出视口时顶部出现毛玻璃胶囊。
- 胶囊显示 prompt 摘要文本。
- 点击胶囊展开面板，显示本轮所有 prompt。
- 点击面板中某条 prompt，面板收起并滚动到对应位置。
- 向上滚回顶部时胶囊自动消失。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent C 提示词：纵向内容块滚动与 snap 吸附

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/FRONTEND_SPEC.md、本文档。

你的任务是实现 USER_JOURNEY_DESIGN.md 中定义的"内容块导航系统"的滚动与吸附部分。

背景：
- 当前 MobileShell 的视图切换通过 mobileView 状态驱动，切换时会替换内容，不是纵向追加。
- 设计文档要求：用户输入、Agent 执行、补全问题、总结、方案都按时间顺序追加到同一个滚动容器里，用户可以从头滑到尾回看任意阶段。
- FRONTEND_SPEC.md 第 8 节明确要求：一段对话必须保持为连续纵向流，不能因为 mobileView 状态切换而清空前面的内容。

目标：
将 MobileShell 从"视图替换"改为"内容块纵向追加"模式，实现仿苹果重力滑动和 snap-to-top 吸附。

重点文件：
- apps/web/components/mobile-shell.tsx
- apps/web/stores/use-demo-store.ts
- apps/web/types/dzultra.ts

具体要求：
1. 新增内容块（FlowBlock）数据结构和渲染逻辑：
   - 每个 FlowBlock 有 id、type（user_input / agent_chain / clarification / agent_reaction / summary / plans / selected / todo）、timestamp。
   - FlowBlock 按时间顺序追加到滚动容器中，不替换前面的块。
   - mobileView 变化时只决定"新增或激活哪些块"，不卸载已有块。

2. 滚动容器改造：
   - MobileShell 内部使用一个统一的纵向滚动容器，所有 FlowBlock 都在这个容器内。
   - 使用 CSS scroll-snap-type: y proximity 实现松手后吸附到最近内容块顶部。
   - 滚动行为使用 -webkit-overflow-scrolling: touch + 自定义 momentum 曲线，接近 iOS 原生手感。

3. 自动滚动：
   - 新内容块出现时，自动滚动到该块的关键文字处（用户输入文字、问题标题、过渡思考标题、需求总结标题或"给你 3 套方案"）。
   - 自动滚动使用 smooth 行为，不要瞬间跳转。

4. 内容块内部滚动：
   - 单个内容块（如方案卡片、补全卡片）内部可以继续上下滑动。
   - 用户在内容块内部滑完内容后，继续向下滑，才吸附到下一个内容块顶部。

5. 内容块拆分口径（与设计文档对齐）：
   - 用户首次输入 → 1 个内容块
   - Agent 执行流 → 1 个内容块（7 个 Agent 节点在块内依次点亮，不单独算页）
   - 关键信息补全卡片 → 每轮 1 个内容块
   - 补全后的 Agent 反应页 → 每段 1 个内容块（"已吸收补全信息""正在重新检索""正在组合路线"）
   - 需求总结确认卡片 → 1 个内容块
   - 最终 3 套方案 → 1 个纵向内容块（块内横向 snap 切换方案）
   - 选用方案后的执行视图 → 1 个内容块
   - To-do 清单 → 1 个内容块

6. 渐进实现：不要一次性重写整个 MobileShell。先在现有结构上增加滚动容器和 FlowBlock 追加逻辑，逐步将各视图从"替换"改为"追加"。

7. 不破坏现有的 API 调用、状态管理和 Debug Trace 联动。

验收：
- 用户发送 prompt 后，输入文字作为内容块追加在滚动容器中，不替换欢迎页。
- Agent 执行完成后，Agent 链内容块追加在用户输入下方。
- 补全卡片、需求总结、方案页依次追加，前面的内容块仍然可见可回看。
- 松手后滚动位置吸附到最近内容块顶部。
- 新内容块出现时自动滚动到关键位置。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent D 提示词：右侧节点指示器与快速跳转

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/FRONTEND_SPEC.md、本文档。

你的任务是完善 USER_JOURNEY_DESIGN.md 中定义的"右侧节点指示器"交互。

背景：
- 当前 FlowPageIndicator 组件已存在，但功能简单：只显示点状节点，不支持滑动跳转、自动半透明淡化。
- 设计文档要求：指示器可按住上下滑动快速跳转，页面静止 2 秒后自动半透明淡化，触摸屏幕时恢复。

目标：
完善右侧节点指示器，实现：
1. 节点与内容块一一对应，当前块高亮，已浏览浅色，未到达灰色。
2. 按住并上下滑动指示器实现快速跳转。
3. 页面静止 2 秒后指示器自动半透明淡化，触摸屏幕时恢复。

前置条件：
Agent C 的内容块滚动容器完成后开始。如果 Agent C 尚未完成，你可以先完善 FlowPageIndicator 组件的交互逻辑，用现有的 data-flow-block 属性做锚点。

重点文件：
- apps/web/components/mobile-shell.tsx（FlowPageIndicator 组件在此文件内）
- 建议拆分为 apps/web/components/flow-page-indicator.tsx

具体要求：
1. 将 FlowPageIndicator 从 mobile-shell.tsx 拆分为独立组件文件。
2. 节点状态：
   - 当前内容块节点：实心 + 放大 + 主色（橙色）。
   - 已浏览内容块节点：浅色实心。
   - 未到达内容块节点：灰色空心。
3. 滑动跳转：
   - 用户按住指示器上下滑动时，根据手指位置计算目标节点。
   - 松手后滚动容器平滑滚动到对应内容块顶部。
   - 滑动过程中实时预览目标位置（可选：显示目标块的简短标题 tooltip）。
4. 自动淡化：
   - 页面静止 2 秒后，指示器 opacity 过渡到 0.3。
   - 用户触摸屏幕任意位置时，指示器 opacity 恢复到 1。
   - 过渡时长 300ms，ease-out。
5. 指示器位置：屏幕右侧垂直居中，避开 MobileShell 边缘。
6. 尊重 prefers-reduced-motion：淡化过渡改为即时切换。

验收：
- 指示器节点与内容块一一对应，当前块高亮。
- 按住指示器滑动可快速跳转到对应内容块。
- 页面静止 2 秒后指示器自动淡化，触摸恢复。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent E 提示词：Agent 执行居中动画与错误态 UI

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/FRONTEND_SPEC.md、本文档。

你的任务是实现 USER_JOURNEY_DESIGN.md Step 3 中定义的 Agent 执行居中动画和错误态 UI。

背景：
- 当前 RunningView 有打字机效果和 AgentStatusBar 步骤链，但没有设计文档要求的"居中大动画/插图"。
- 当前 MobileShellView 类型定义了 "error" 状态，但没有对应的 UI 渲染逻辑。
- 设计文档要求：每个 Agent 执行时，屏幕垂直居中位置显示一个较大的动画/插图，表示当前正在做的事；Agent 超时显示橙色警告，失败显示红色叉号。

目标：
1. 为每个 Agent 步骤设计并实现居中动画/插图。
2. 实现 Agent 超时和失败的错误态 UI。
3. 实现 error 视图的基础 UI。

重点文件：
- apps/web/components/mobile-shell.tsx（RunningView 组件）
- apps/web/components/agent-status-bar.tsx
- apps/web/stores/use-demo-store.ts
- 建议新增 apps/web/components/agent-center-animation.tsx

具体要求：
1. 居中动画：
   - 当前执行的 Agent 步骤在屏幕垂直居中位置显示一个动画区域。
   - 每个 Agent 有对应的文案和简单动画效果：
     - InteractionRouterAgent："正在理解你的需求…"（脉冲圆点动画）
     - ConstraintDiscoveryAgent："正在解析你的偏好…"（拆解动画）
     - UserPreferenceAgent："正在读取你的偏好…"（此 Agent 后台异步，用户端不展示居中动画，仅在 Debug 显示）
     - ContextGroundingAgent："正在搜索附近的地点…"（雷达扫描动画）
     - PlanSolverAgent："正在组合路线方案…"（拼图动画）
     - PlanEvaluatorAgent："正在评估方案…"（评分动画）
     - PlanExplanationAgent："正在生成推荐理由…"（书写动画）
   - 动画完成后收起，链节点变为绿色勾。
   - 动画应简洁克制，不要喧宾夺主。可以使用 CSS 动画或 Motion for React。

2. 超时状态：
   - Agent 执行超过 NEXT_PUBLIC_DZULTRA_AGENT_TIMEOUT_MS（默认 30 秒）时，链节点显示橙色警告图标。
   - 居中动画区域文案变为"这一步花了比较久，正在重试…"。
   - 超时不中断请求，只是视觉提示。

3. 失败状态：
   - API 返回错误或结构不合法时，链节点显示红色叉号。
   - 下方提示失败原因（简短文案），用户可点击"重试此步骤"。
   - 重试触发重新调用当前 API。

4. error 视图：
   - 新增 ErrorView 组件，处理网络错误、模型错误、定位错误等场景。
   - 显示错误图标 + 错误文案 + "重试"按钮。
   - 重试按钮触发重新调用上一次的 API 请求。

5. 绿色勾动效：Agent 完成时链节点从灰色圆点过渡为绿色勾，使用简单的 scale+opacity 动画（200ms），不要弹跳。

6. 尊重 prefers-reduced-motion：动画改为静态图标切换。

验收：
- Agent 执行时屏幕垂直居中显示对应动画和文案。
- 每个步骤完成后链节点变为绿色勾。
- 超时时链节点显示橙色警告，文案提示重试。
- 失败时链节点显示红色叉号，有重试按钮。
- error 视图有错误图标、文案和重试按钮。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent F 提示词：语音输入交互完善

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/FRONTEND_SPEC.md、本文档。

你的任务是完善 USER_JOURNEY_DESIGN.md Step 2 中定义的语音输入交互。

背景：
- 当前 MobileComposer 支持文字/语音模式切换，语音模式有按压态动画，但没有真实的语音识别逻辑。
- 设计文档要求：按住输入栏说话时框四周出现蓝色辉光/描边反馈，随语音输入波动外扩；松手后发送；上滑取消；语音无权限时弹出系统权限引导。

目标：
完善语音输入交互，实现：
1. 按住说话的蓝色辉光反馈。
2. 上滑取消语音录制。
3. 语音识别集成（Web Speech API 或占位逻辑）。
4. 语音权限引导。

重点文件：
- apps/web/components/mobile-shell.tsx（MobileComposer 组件）
- 建议拆分为 apps/web/components/mobile-composer.tsx

具体要求：
1. 将 MobileComposer 从 mobile-shell.tsx 拆分为独立组件文件。
2. 蓝色辉光反馈：
   - 按住输入栏区域时，框四周出现蓝色辉光/描边（box-shadow: 0 0 12px rgba(0, 122, 255, 0.5)）。
   - 辉光随语音输入音量波动外扩（如果使用 Web Speech API，可以根据 amplitude 事件调整辉光大小；如果无法获取音量，使用脉冲动画模拟）。
   - 松手后辉光消失。
3. 上滑取消：
   - 录制过程中手指上滑超过阈值（50px）时，操作区域颜色变化提示"取消"。
   - 松手后语音不发送，恢复待命态。
   - 上滑未达阈值松手，正常发送。
4. 语音识别：
   - 优先使用浏览器原生 Web Speech API（SpeechRecognition）。
   - 不支持 Web Speech API 的浏览器：语音按钮点击后 toast 提示"当前浏览器不支持语音输入"。
   - 识别结果填入输入框，用户确认后发送（不自动发送）。
   - 识别失败时 toast 提示"没听清，请再试一次"。
5. 语音权限引导：
   - 点击语音 icon 时，如果浏览器未授权麦克风权限，弹出系统权限引导提示。
   - 权限被拒绝时，toast 提示"请在浏览器设置中允许麦克风权限"。
6. 文字/语音模式切换逻辑保持不变。

验收：
- 按住输入栏说话时出现蓝色辉光反馈。
- 上滑超过阈值可取消语音录制。
- 语音识别结果填入输入框。
- 不支持语音的浏览器有友好提示。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent G 提示词：方案卡片细节补全

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/FRONTEND_SPEC.md、本文档。

你的任务是补全 USER_JOURNEY_DESIGN.md Step 5 中定义的方案卡片细节。

背景：
- 当前 PlanCard 已实现基本布局（标题、SVG 地图、交通摘要、站点列表），但缺少多个设计文档要求的细节。
- 全屏展开后没有左右箭头切换方案。
- 没有 skeleton 加载态。
- POI 字段展示不完整（缺上榜标签徽章、星级拆分、headPic 缩略图）。
- 方案标题没有 sticky 吸顶。

目标：
补全方案卡片的以下细节：
1. 方案标题 sticky 吸顶。
2. 全屏展开后左右箭头切换方案。
3. 方案生成中 skeleton 占位。
4. POI 字段补全（上榜标签、星级拆分、缩略图）。
5. 荧光橙记号笔风格标注（Step 2 欢迎页的重点信息提示）。

重点文件：
- apps/web/components/mobile-shell.tsx（PlanCard、ExpandedPlanSheet 组件）
- apps/web/components/svg-route-map.tsx
- apps/web/types/dzultra.ts
- 建议拆分：apps/web/components/plan-card.tsx、apps/web/components/expanded-plan-sheet.tsx

具体要求：
1. 方案标题 sticky 吸顶：
   - PlanCard 内的方案标题使用 position: sticky; top: 0; z-index: 10。
   - 卡片未展开状态下向下滑动时，标题固定在屏幕顶部，直到该卡片完全滚出。
   - sticky 标题背景需要半透明毛玻璃效果（backdrop-filter: blur(8px) + 半透明白色背景），避免文字与下方内容重叠。

2. 全屏展开后左右箭头切换：
   - ExpandedPlanSheet 两侧边缘添加半透明箭头按钮（左箭头/右箭头）。
   - 点击箭头切换到相邻方案的全屏展开视图。
   - 第一个方案隐藏左箭头，最后一个方案隐藏右箭头。
   - 切换时使用滑动过渡动画（300ms）。

3. Skeleton 加载态：
   - 方案生成中显示 3 张灰色骨架卡片横向排列。
   - 骨架卡片包含：标题条（灰色条）、地图区域（灰色块）、交通信息（3 个灰色条）、3 个站点行（灰色圆 + 灰色条）。
   - 骨架元素使用 pulse 动画（Tailwind animate-pulse）。

4. POI 字段补全：
   - 上榜标签徽章：POI 名称旁显示小徽章（如"必吃榜""黑珍珠一钻"），橙色/金色底色，白色文字，字号 10px。
   - 星级评分拆分：显示 ★4.5 + 口味4.6 环境4.3 服务4.5（当前只显示总分，需要拆分显示）。
   - headPic 缩略图：POI 左侧显示小方图（40x40px，圆角 4px）。当前 MockPoi 有 headPic 字段但未渲染。图片加载失败时显示灰色占位。
   - 推荐菜展示：当前有 recommended_dishes 但未在卡片中展示。在 POI 行下方显示"招牌：毛肚、鹅肠、红糖糍粑"。

5. 荧光橙记号笔风格标注：
   - Step 2 欢迎页的重点信息提示（如"说说 想去哪儿 / 几个人 / 想怎么玩/玩多久 我来规划！"）使用荧光橙底色记号笔效果。
   - 实现：background: linear-gradient(transparent 60%, rgba(255, 165, 0, 0.3) 60%); 或使用 mark 标签 + 自定义样式。
   - 文字颜色保持黑色，不要用白色。

6. 将 PlanCard 和 ExpandedPlanSheet 从 mobile-shell.tsx 拆分为独立组件文件。

7. 不破坏现有的 Swiper 滑动、快捷微调按钮、选用此方案按钮等功能。

验收：
- 方案标题在卡片内向下滑动时 sticky 吸顶，有毛玻璃背景。
- 全屏展开后左右箭头可切换方案。
- 方案生成中显示 skeleton 骨架卡片。
- POI 显示上榜标签徽章、星级拆分、缩略图、推荐菜。
- 欢迎页重点信息有荧光橙记号笔效果。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent H 提示词：天气约束闭环

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/AGENT_STRATEGY.md、docs/internal/BACKEND_SPEC.md、本文档。

你的任务是完成天气约束从"获取"到"影响规划"的闭环。

背景：
- 当前 ContextGroundingAgent 已调用 provider_adapter.weather() 获取天气数据。
- 天气结果写入了 Trace，约束账本中也有天气相关的软约束建议。
- 但 POI 筛选和路线评分逻辑没有根据天气实际调整。天气数据"获取了但没用上"。
- Mock 天气数据设计意图明确：15:00 降水概率 65% → 应优先室内 POI。

目标：
让天气约束真正影响 POI 筛选和路线评分，形成闭环。

重点文件：
- apps/api/app/agents/runner.py
- apps/api/app/agents/mock_tools.py
- apps/api/app/providers/adapter.py
- apps/api/app/models/schemas.py

具体要求：
1. ContextGroundingAgent 获取天气后，将天气约束写入 ConstraintLedger：
   - 降水概率 > 50% → 新增硬约束：优先室内 POI（category != outdoor_park 等）。
   - 极端温度（>35°C 或 <-5°C）→ 新增软约束：减少室外步行时间。
   - 天气良好 → 新增软约束：可推荐室外 POI。

2. mock_poi_search() 接受天气约束参数：
   - 降水概率高时，outdoor/park 类 POI 评分降权（-8 分）。
   - 室内 POI（food/culture/shopping/entertainment）评分不变或微升。
   - 如果所有候选都是室外 POI 且降水概率高，在推荐理由中标注"建议关注天气变化"。

3. mock_route_judge() 评分加入天气维度：
   - 新增 weather_fit 评分项（满分 10 分）。
   - 降水概率高 + 路线含室外 POI → weather_fit = 2-4。
   - 降水概率高 + 路线全室内 → weather_fit = 8-10。
   - 天气良好 → weather_fit = 7-10。
   - 将 weather_fit 加入总分公式。

4. PlanExplanationAgent 生成解释时，如果天气影响了推荐，在方案解释中提及：
   - "考虑到下午可能下雨，优先推荐了室内活动"。
   - "今天天气不错，安排了一些室外景点"。

5. Trace 中 weather 相关事件必须包含：
   - provider（amap/caiyun/mock）
   - fallback_used
   - 对 POI 筛选的实际影响（哪些 POI 因天气降权/排除）

6. 不删除 Mock 天气 Provider。真实彩云天气失败时仍允许 fallback。

验收：
- Mock 天气场景（15:00 降水 65%）下，生成的方案优先包含室内 POI。
- Trace 中能看到天气约束对 POI 筛选的影响。
- 评分拆解中包含 weather_fit 维度。
- 方案解释中提及天气影响（如果适用）。
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent I 提示词：微调指令 LLM 理解

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/AGENT_STRATEGY.md、docs/internal/BACKEND_SPEC.md、本文档。

你的任务是让微调指令理解从"硬编码关键词匹配"升级为"LLM 增强 + 关键词 fallback"。

背景：
- 当前 _apply_refinement() 和 _is_full_rerun_instruction() 都是硬编码的关键词列表。
- 对自然语言的覆盖有限：用户说"这个咖啡店不太行"无法识别为替换咖啡类 POI。
- 设计文档 Step 6 定义了多种微调指令类型：替换、保留部分、完全重置、自由输入。
- 当前缺少连续微调保护（5 次以上提示）和 toast 反馈。

目标：
1. 微调指令理解升级为 LLM 增强 + 关键词 fallback。
2. 新增连续微调保护。
3. 新增前端 toast 反馈。

重点文件：
- apps/api/app/agents/runner.py
- apps/api/app/agents/mock_tools.py
- apps/api/app/providers/adapter.py
- apps/web/components/mobile-shell.tsx
- apps/web/stores/use-demo-store.ts

具体要求：
1. 新增 LLM 版微调指令解析器：
   - 输入：用户微调指令 + 当前方案 POI 列表。
   - 输出结构化 RefinementIntent：
     ```json
     {
       "type": "local_replace | local_reorder | partial_keep | full_rerun",
       "target_stop_indices": [1],
       "target_categories": ["food"],
       "keep_stop_indices": [0, 2],
       "reason": "用户想替换第2站的川菜",
       "confidence": 0.85
     }
     ```
   - 调用 provider_adapter.llm_chat_completion()，purpose="refinement_parser"。
   - LLM 返回必须 JSON parse + Pydantic 校验。
   - LLM 失败、JSON 不合法或 confidence < 0.6 时，fallback 到现有确定性关键词匹配。

2. 保留并增强确定性 fallback：
   - 现有关键词列表保留，作为 LLM 不可用时的兜底。
   - 新增更多关键词模式：如"不太行""换个""不想""太贵了""太远了"等。

3. 连续微调保护（前端）：
   - 在 Zustand store 中新增 refinementCount 字段，记录当前方案的连续微调次数。
   - 微调成功后 refinementCount++。
   - 切换方案或重新规划时 refinementCount 重置为 0。
   - refinementCount >= 5 时，输入栏上方显示轻提示"需要我重新帮你规划吗？"，点击后触发完整重规划。

4. Toast 反馈（前端）：
   - 微调成功：toast "已更新" 或 "已替换第 N 站"。
   - 微调失败：toast "修改失败，请重试"。
   - Toast 使用轻量级实现（固定在 MobileShell 底部输入栏上方，2 秒后自动消失），不要引入新依赖。

5. Trace 中记录微调解析过程：
   - LLM 调用（provider、model、token usage）。
   - 解析结果（type、target、confidence）。
   - fallback 原因（如果使用了确定性 fallback）。

验收：
- "这个咖啡店不太行"能被识别为 local_replace，target_categories 包含 dessert/coffee。
- "保留第一个和第三个，其他重新推荐"能被识别为 partial_keep。
- LLM 不可用时 fallback 到关键词匹配，Trace 标记 fallback。
- 连续微调 5 次后显示提示。
- 微调成功/失败有 toast 反馈。
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent J 提示词：评分算法深化

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/AGENT_STRATEGY.md、docs/internal/BACKEND_SPEC.md、本文档。

你的任务是让 PlanEvaluatorAgent 的评分更可解释、更动态。

背景：
- 当前 mock_route_judge() 的评分公式中 queue_score 和 rating_score 是固定值，不随实际数据变化。
- constraint_score 虽然基于约束满足率，但权重分配较粗糙。
- 设计文档要求：每个方案都要有 score_breakdown，被淘汰候选要有 rejected_route_reason。
- V3_AGENT_TRACE_EXECUTION_PROMPTS.md 的 Agent J 也定义了类似任务，但当前尚未实现。

目标：
1. 评分维度扩展到至少 10 个，每个维度动态计算。
2. 被淘汰候选有明确原因。
3. 硬约束违反不会悄悄进入最终方案。
4. Debug Trace 中 route_scored 事件包含完整评分拆解。

重点文件：
- apps/api/app/agents/mock_tools.py
- apps/api/app/agents/runner.py
- apps/api/app/models/schemas.py
- apps/web/components/debug-trace-panel.tsx

具体要求：
1. 评分维度扩展（每个维度满分 10 分）：
   - hard_constraint：硬约束满足率（排队、营业、预算、避雷）。
   - queue：平均排队时间（0min=10, >20min=2）。
   - business_hours：营业时间匹配度（全在营业时间内=10, 有1站不在=4）。
   - traffic：交通合理性（基于 route_matrix 的总移动时间）。
   - weather_fit：天气适配度（与 Agent H 的天气约束闭环对齐）。
   - preference_fit：偏好匹配度（用户偏好命中 POI 标签的比例）。
   - ugc_quality：UGC 质量分（基于评分和评论数，Mock 时固定 7）。
   - route_efficiency：路线效率（总移动时间 / 总可用时间，越低越好）。
   - budget：预算匹配度（人均消费 vs 预算约束）。
   - diversity：POI 类型多样性（3 站全同类别=2, 3 站 3 类别=10）。

2. 总分计算：
   - 加权求和，权重可配置（默认 hard_constraint 权重最高，queue 和 preference_fit 次之）。
   - 硬约束失败的候选直接标记为 blocked，不进入最终方案。

3. 淘汰理由：
   - 被淘汰候选生成 rejected_route_reason，包含：
     - 哪个维度不达标。
     - 具体数值（如"平均排队 22 分钟，超过 15 分钟限制"）。
     - 建议调整方向。

4. score_breakdown 写入 RoutePlan：
   - 每个 RoutePlan 的 score_breakdown 字段包含所有 10 个维度的分数和权重。
   - 前端 Debug 排序页展示完整评分拆解。

5. mock_multi_plan_builder() 生成候选时，确保 3 个最终方案之间有明显差异（至少 2 个维度差 > 2 分）。

6. 不破坏现有的 Trace 结构和前端 Debug 面板展示。

验收：
- Debug 排序页能看到每个方案的 10 维评分拆解。
- 被淘汰候选有明确原因。
- 硬约束违反的候选不会出现在最终 3 个方案中。
- 3 个方案之间有明显差异。
- conda run -n agent pytest apps/api/tests/test_api_contracts.py -q 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent K 提示词：生态操作真实化与倒计时

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/FRONTEND_SPEC.md、本文档。

你的任务是补全 USER_JOURNEY_DESIGN.md Step 7 中定义的生态操作和倒计时。

背景：
- 当前 SelectedPlanView 有时间线站点、交通切换、To-do 清单，但所有生态操作（导航/排号/购票/预订/团购/分享）都是 Mock 回执。
- 没有距出发倒计时。
- 没有方案分享的真实化处理。
- 设计文档要求：一键导航唤起地图应用、在线排号/购票/团购跳转美大页面、分享生成 H5 链接。

目标：
1. 实现距出发倒计时。
2. 生态操作从纯 Mock 升级为"有真实跳转意图的 Mock"。
3. 分享功能真实化。

重点文件：
- apps/web/components/mobile-shell.tsx（SelectedPlanView、TimelineStop、TodoPreparationItem 组件）
- apps/web/stores/use-demo-store.ts
- apps/web/lib/api.ts
- 建议拆分：apps/web/components/selected-plan-view.tsx、apps/web/components/timeline-stop.tsx

具体要求：
1. 距出发倒计时：
   - 在 SelectedPlanView 顶部显示"距出发还有 X 小时 X 分"。
   - 倒计时基于当前时间和方案第一站的预计到达时间计算。
   - 如果方案时间已过，显示"该方案已过期，是否重新规划？"。
   - 文字颜色：距出发 > 2 小时为黑色，1-2 小时为橙色，< 1 小时为红色。
   - 每分钟更新一次。

2. 生态操作升级：
   - 一键导航：点击后尝试唤起地图应用。使用通用地图 URL Scheme：
     - iOS：`http://maps.apple.com/?daddr={lat},{lng}&dirflg=d`
     - Android：`geo:{lat},{lng}?q={name}`
     - Web：打开高德/百度地图网页版
     - 如果无法唤起，显示 toast "请安装地图应用"。
   - 在线排号/购票/团购/预订：当前是纯 Mock。升级为：
     - 按钮点击后显示 toast "Demo 模式：此功能需在大众点评 App 中使用"。
     - 不再生成 Mock 回执弹窗。
     - 按钮样式保持可用态（不置灰），但加一个小标签"Demo"。
   - 团购已售罄/排队已关闭：按钮置灰 + 标注"已售罄""已关闭"（基于 Mock 数据中的状态字段）。

3. 分享功能：
   - 点击分享按钮后，调用后端 /routes/share（新增 Mock 接口）生成分享链接。
   - 后端返回一个 Mock URL（如 https://dianping.com/ultra/share/{plan_id}）。
   - 前端尝试调用 navigator.share()（如果浏览器支持）。
   - 不支持时显示 toast "分享链接已复制" + 将 URL 复制到剪贴板。
   - 生成中分享按钮显示 loading spinner。

4. 将 SelectedPlanView 和 TimelineStop 从 mobile-shell.tsx 拆分为独立组件文件。

5. 不破坏现有的 To-do 清单勾选、交通切换等功能。

验收：
- 选用方案后顶部显示距出发倒计时。
- 一键导航点击后尝试唤起地图应用。
- 排号/购票/团购/预订按钮点击后显示 Demo 模式提示。
- 分享按钮点击后尝试调用系统分享或复制链接。
- 已售罄/已关闭的按钮正确置灰。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

## Agent L 提示词：设置与偏好管理页完善

```text
你现在在 DZUltra 项目中工作。请先阅读 AGENTS.md、README.md、docs/internal/DZUltra/USER_JOURNEY_DESIGN.md、docs/internal/FRONTEND_SPEC.md、本文档。

你的任务是完善 USER_JOURNEY_DESIGN.md 补充页面 1 中定义的设置与偏好管理页。

背景：
- 当前 SettingsDrawer 有偏好开关、AI 检测偏好查看/删除、需求确认开关、数据授权开关。
- 但缺少：个人基础信息（性别/年龄）、固定偏好设置的详细编辑 UI、对话历史的真实化、关于/反馈入口。
- 设计文档要求：设置页包含个人基础信息、固定偏好设置（出行区域/口味/消费/出行方式/兴趣/特殊需求）、个性化、对话与隐私、关于。

目标：
完善设置页，实现设计文档中定义的 5 个功能模块。

重点文件：
- apps/web/components/mobile-shell.tsx（SettingsDrawer、SettingsView 组件）
- apps/web/stores/use-demo-store.ts
- apps/web/lib/api.ts
- 建议拆分：apps/web/components/settings-drawer.tsx、apps/web/components/settings-view.tsx

具体要求：
1. 将 SettingsDrawer 和 SettingsView 从 mobile-shell.tsx 拆分为独立组件文件。

2. 个人基础信息模块：
   - 性别选择：男 / 女 / 不透露（单选标签）。
   - 年龄选择：青少年（<18）/ 青年人（18-35）/ 中年（36-55）/ 退休中（55+）/ 不透露（单选标签）。
   - 数据存入 Zustand store 的 userPreferences 或新增 userProfile 字段。

3. 固定偏好设置模块：
   - 常用出行区域：多选标签 + 自由输入（如"徐汇区""静安区"）。
   - 餐饮口味：多选标签（川菜/日料/粤菜/西餐/烧烤/火锅/甜品/其他）。
   - 消费水平：单选（人均 ¥50-100 / ¥100-200 / ¥200-500 / ¥500+ / 不限）。
   - 出行方式：多选（步行/地铁/打车/自驾）。
   - 兴趣标签：多选标签（网红打卡/小众去处/历史文化/亲子友好/宠物友好/夜生活/其他）。
   - 特殊需求：多选（无障碍通道/素食/清真/其他）。
   - 修改后即时保存（toast "已保存"）。
   - AI 检测偏好自动同步到此列表。

4. 对话历史模块：
   - 当前 ConversationHistoryPage 使用硬编码 Mock 数据。
   - 改为调用 /traces API 获取真实历史列表。
   - 列表展示：对话标题（取 user_goal 前 20 字）+ 时间 + 状态。
   - 支持左滑删除（调用 trace_store 删除，当前是内存存储，删除即清空）。
   - 空态显示"暂无对话记录"。

5. 关于模块：
   - 功能介绍：版本号（从 package.json 读取）+ 简介文案。
   - 反馈与帮助：显示反馈邮箱或 GitHub Issue 链接（当前用占位文案即可）。

6. 首次进入时，所有偏好为空，选项区显示引导文案"设置偏好，帮你更精准推荐"。

7. 不破坏现有的 AI 检测偏好查看/删除、需求确认开关、数据授权开关功能。

验收：
- 设置页包含 5 个功能模块（个人基础信息、固定偏好、个性化、对话与隐私、关于）。
- 偏好修改后即时保存，有 toast 反馈。
- 对话历史从 API 获取，空态有提示。
- 首次进入时偏好为空，有引导文案。
- npm --workspace apps/web run lint 通过。

请直接实现，不要只给方案。完成后报告改了哪些文件、怎么验证。
```

---

## 如果只开一个窗口，推荐此窗口继续的任务

如果你只想让一个 Agent 稳稳推进，建议先做 Agent A。

原因：

- Blur 体系是整个产品"体感"的基础。没有 Blur，后续的冻结胶囊、编辑态模糊、边缘渐隐都无法实现。
- Agent A 的改动范围相对集中（主要是 mobile-shell.tsx 的过渡动画），风险可控。
- 完成后，产品从"功能原型"到"设计文档愿景"的体感差距会明显缩小。

单窗口顺序建议：

```text
Agent A -> Agent B -> Agent C -> Agent D -> Agent E -> Agent G -> Agent F -> Agent H -> Agent I -> Agent J -> Agent K -> Agent L
```

如果要并行，建议先开两个窗口：

```text
窗口 1：Agent A（Blur 体系）
窗口 2：Agent H（天气约束闭环，纯后端，不冲突）
```

等这两个合并或确认完成后，再开：

```text
窗口 3：Agent B（冻结胶囊，依赖 Agent A 的 blur 样式变量）
窗口 4：Agent C（内容块滚动，独立于 blur 体系）
```

Agent D 最好等 Agent C 的滚动容器结构稳定后再开始。

---

## 附录：Blur 参数统一参考表

所有 Agent 在实现 Blur 效果时，应参考以下参数，保持全局一致性：

| 场景 | CSS 属性 | 值 | 过渡时长 |
|------|---------|---|---------|
| 发送过渡（欢迎页淡出） | filter: blur() + opacity | blur(8px), opacity 1→0 | 350ms ease-out |
| 编辑态背景模糊 | backdrop-filter: blur() | blur(12px) | 200ms ease-out |
| 上下边缘渐隐 | mask-image | linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%) | 无过渡 |
| 冻结胶囊 | backdrop-filter: blur() + background | blur(10px), rgba(255,255,255,0.7) | 200ms ease-out |
| 胶囊展开面板背景 | backdrop-filter: blur() | blur(12px) | 200ms ease-out |
| 方案标题 sticky 吸顶 | backdrop-filter: blur() + background | blur(8px), rgba(255,255,255,0.85) | 无过渡 |
| 选用此方案按钮 | background + backdrop-filter | rgba(0,122,255,0.15), blur(10px) | 无过渡 |

**prefers-reduced-motion 降级**：所有过渡时长改为 0ms，blur 效果改为即时切换。

---

## 附录：内容块拆分口径

与 `USER_JOURNEY_DESIGN.md` 附录"页面清单与状态流转"对齐：

| 内容块 | 锚点位置 | 右侧指示器节点 |
|--------|---------|--------------|
| 用户首次输入 | 用户需求文字 | 1 个节点 |
| Agent 执行流 | Agent 链起始 | 1 个节点 |
| 信息补全卡片（每轮） | 问题标题 | 每轮 1 个节点 |
| 补全后 Agent 反应页 1 | "已吸收补全信息" | 1 个节点 |
| 补全后 Agent 反应页 2 | "正在重新检索候选地点" | 1 个节点 |
| 补全后 Agent 反应页 3 | "正在组合可解释路线" | 1 个节点 |
| 需求总结确认卡片 | "确认你的需求" | 1 个节点 |
| 全局动态方案页 | "给你 3 套方案" | 1 个节点（3 套方案不分别增加节点） |
| 方案确认与执行视图 | 方案标题 | 1 个节点 |
| To-do 清单 | "出行准备" | 1 个节点 |
