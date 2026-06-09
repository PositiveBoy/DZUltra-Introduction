# V3 AI 生成真实结构数据源改造路线图

## 核心口径

AI Mock 生成器不是失败兜底，也不是给 Agent 降级使用的假数据。它是 `ai_generated_dataset` 数据生产器：用 LLM 生成符合真实大众点评接口和 schema 的演示数据源。

对 Agent 来说，经过 schema 校验的 POI、UGC、排队、推荐菜、用户历史、用户偏好等数据都是正式输入。只有 LongCat、API、schema 校验失败后使用确定性模板，才叫 fallback。

## 工程语义

- `data_origin=ai_generated_dataset`：AI 生成、结构校验通过、可被 Agent 正式判断的数据。
- `runner_mode=real_agent_ai_generated_data`：真实 Agent 流程 + AI 生成真实结构数据源。
- `source=ai_generated_dataset`：生成接口正常产出的数据源。
- `source=fallback_template`：生成失败后使用确定性模板兜底。
- `fallback_used=true`：只表示失败兜底，不表示 AI 生成数据。
- `reliability=generated_validated`：AI 生成并通过 schema 校验的数据。

## 需要完成的改动

- 后端 schema 支持 `real_agent_ai_generated_data` runner 和 `ai_generated_dataset` 数据来源。
- `/mock/generate-user`、`/mock/generate-pois` 返回 `source=ai_generated_dataset`；仅模板兜底返回 `fallback_template`。
- Trace 中的 UGC、排队、推荐菜、用户历史 API 数据作为正式 tool 输出展示。
- 前端 Debug Trace 顶部和生成器文案改成“AI 生成真实结构数据源”。
- 点击 Agent 卡片时展示该 Agent 的全部 ToolUse 列表，并可展开完整输入输出。
- 检查脚本覆盖生成接口、规划接口、问答接口、Trace tool 输出、前端 lint/build。

## 验收标准

- Mock User/POI 生成接口 200，正常返回 `ai_generated_dataset`。
- 主链路 trace 和 generation metadata 不再显示 `deterministic_mock`。
- Agent 看到的用户历史、UGC、排队、推荐菜数据具备 `data_origin` 和 `reliability`。
- Debug Trace 能说明“数据来自 AI 生成真实结构数据源”，也能单独说明 fallback 原因。
- `scripts/check_v3_ai_generated_real_data.sh` 一键通过。

