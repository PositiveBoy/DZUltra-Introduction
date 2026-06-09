# V3 确认流程 & Debug Trace 修复计划

> 创建时间：2026-06-09
> 状态：执行中

## 问题清单

| # | 问题 | 根因 | 优先级 |
|---|------|------|--------|
| 1 | 需求未确认就显示"已确认" | `defaultClarification` 预填值 + `confirmed` 属性过于宽松 + 前端未传 `confirmed_requirements` | 高 |
| 2 | 未确认就继续生成路线方案 | `InteractionRequest` 缺少 `require_confirmation` 字段 | 高 |
| 3 | 底部路线卡片为空 | 空壳 plan 被当正常方案展示 | 高 |
| 4 | Interaction Router Agent 点击后右侧面板不更新 | `group.events` 为空 → `selected=undefined` | 高 |
| 5 | Run Lifecycle 永远亮不起来 | `agentName=undefined` 无法匹配 `activeAgentStep` | 高 |
| 6 | Agent Flow 各节点点击后无反馈 | 与问题 4 同源 | 高 |
| 7 | Mock 数据过多 | Agent 主流程 8 个环节全部确定性 Mock | 中 |

---

## 批次 A：修复确认流程断裂（问题 1+2+3）

### A1 — 前端类型增加确认字段

- **文件**: `apps/web/types/dzultra.ts`
- **改动**: `InteractionRequestPayload` 增加 `require_confirmation?: boolean` 和 `confirmed_requirements?: boolean`

### A2 — 默认确认状态改为"待确认"

- **文件**: `apps/web/components/mobile-shell.tsx`
- **改动**: `defaultClarification` 的 `timeRange`、`food`、`budget`、`taste` 改为 `"待确认"`

### A3 — `confirmed` 属性逻辑修正

- **文件**: `apps/web/components/mobile-shell.tsx`
- **改动**: `confirmed` 不再因 `view === "plans"` 就为 true，只在 `hasConfirmedSummary` 为 true 时才为 true

### A4 — `confirmSummary()` 传递确认标记

- **文件**: `apps/web/components/mobile-shell.tsx`
- **改动**: 传递 `confirmed_requirements: true`，消息改为确认类文本（如"确认需求，开始规划"）

### A5 — `startInteractionRequest` 传递 `require_confirmation`

- **文件**: `apps/web/components/mobile-shell.tsx`
- **改动**: 从 store 取 `requireRequirementConfirmation`，传给后端

### A6 — 后端 schema 增加确认字段

- **文件**: `apps/api/app/models/schemas.py`
- **改动**: `InteractionRequest` 增加 `require_confirmation: bool = False` 和 `confirmed_requirements: bool = False`

### A7 — 后端 Runner 传递前端确认标志

- **文件**: `apps/api/app/agents/runner.py`
- **改动**: `_route_request_from_interaction` 中，当 `request.require_confirmation` 为 True 且非 `confirm_requirements` 路由时，设 `RoutePlanRequest.require_confirmation=True`

### A8 — 前端防御：空壳 plan 不切换到 plans 视图

- **文件**: `apps/web/components/mobile-shell.tsx`
- **改动**: `applyInteractionResponse` 中检查 `nextPlans` 的 stops 是否为空，若为空则走 clarification 逻辑

---

## 批次 B：修复 Debug Trace 面板交互（问题 4+5+6）

### B1 — `selected` 计算逻辑修正

- **文件**: `apps/web/components/debug-trace-panel.tsx`
- **改动**: `selectedAgentStep` 有值但 `selectedTraceEventId` 无值时，从 `selectedGroup` 找第一个 event

### B2 — Run Lifecycle 状态判断修正

- **文件**: `apps/web/components/debug-trace-panel.tsx`
- **改动**: `getAgentGroupStatus` 增加 Run Lifecycle 特殊判断：有 `run_started` → running，有 `run_completed` → completed

### B3 — `activeAgentStep` 计算修正

- **文件**: `apps/web/stores/use-demo-store.ts`
- **改动**: 当最后事件无 `agent` 字段时，设 `activeAgentStep` 为 `"system"`

### B4 — 空组点击处理

- **文件**: `apps/web/components/debug-trace-panel.tsx`
- **改动**: `group.events` 为空时，右侧面板显示该 Agent 的策略描述或"等待 Agent 执行"而非 Skeleton

---

## 批次 C：Mock 数据替换（问题 7）

### C1 — 静态数据源替换为 AI Mock 生成器输出

- **文件**: `apps/api/app/data/mock_data.py` + 相关加载逻辑
- **改动**: 生成器产生的数据标记为 `ai_generated_dataset`，作为"真实数据"处理

### C2 — 深度字段从 AI Mock 生成器获取

- **文件**: `apps/api/app/providers/adapter.py`
- **改动**: `mock_deep_poi_enrichment` 改为读取生成器数据

### C3 — `data_origin` 标记语义对齐

- **文件**: `apps/api/app/agents/mock_tools.py`
- **改动**: 区分"LLM 动态生成"和"静态文件加载"

---

## 验证方式

1. 输入需求后，时间/人数/饮食应显示"待确认"，而非预填值
2. 点击"确定，开始规划"后，状态才变为"已确认"
3. 未确认时不应生成路线方案
4. Agent Flow 各节点点击后，右侧面板显示对应内容
5. Run Lifecycle 在 run 开始后亮起，完成后变为 completed
6. 底部路线卡片有实际内容
7. Debug Trace 中 mock 数据标记清晰
