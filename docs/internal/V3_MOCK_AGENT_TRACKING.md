# V3 MockDataAgent 跟踪表

## 当前目标

让 Mock User、Mock POI、定位、History 快捷演示、Debug Trace skeleton 和 Agent 灯联动全部可跑通。

## 检查项

- [ ] 新演示：左侧进入点仔 Ultra，右侧出现空 Trace 框架
- [ ] Agent 灯：只反映真实 trace/skeleton 状态，不乱亮
- [ ] History：有 3 个过往 Mock 历史快捷演示
- [x] Mock User：一键生成新/老用户，老用户含历史行为和 UGC
- [x] Mock POI：默认 20 个，城市/区域可控
- [x] Mock 看板：用户、位置、POI、历史/UGC、JSON 可切 tab 查看
- [x] Vercel：/api/health、/api/mock/generate-user、/api/mock/generate-pois 可访问
- [x] Trace：所有 fallback 写明原因；AI 生成数据标记为 `ai_generated_dataset`，不是 fallback

## 2026-06-09 修复记录

- Mock User / Mock POI 生成接口加入演示级快速超时：真实 LongCat 快速返回就使用真实结果；慢、失败、缺 Key 或 schema 不合法时立即返回可校验模板，并在 `metadata.provider_call` 写明 fallback 原因。
- Mock POI fallback 保证按请求数量返回，默认 20 个，城市和区域按请求覆盖。
- 地理位置“随机中国位置”扩大城市/商圈池，并给经纬度加入小范围随机偏移，避免每次落在同一批固定坐标。
- 默认 CORS 增加 `localhost:3001` / `127.0.0.1:3001`，本地 3000 被占用时备用端口也能访问 API。
- 已验证：`/mock/generate-user` 返回 200 且 1 个用户；`/mock/generate-pois` 返回 200 且 20 个 POI；API contract 测试 43 条通过；Web 生产构建通过。

## Agent 能力检查顺序

1. MockDataAgent
2. InteractionRouterAgent
3. ConstraintDiscoveryAgent
4. UserPreferenceAgent
5. ContextGroundingAgent
6. PlanSolverAgent
7. PlanEvaluatorAgent
8. PlanExplanationAgent
