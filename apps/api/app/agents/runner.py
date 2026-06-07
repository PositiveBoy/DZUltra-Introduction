from hashlib import sha1
import json
from typing import Any

from app.agents.mock_tools import (
    mock_constraint_checker,
    mock_experience_copywriter,
    mock_intent_parser,
    mock_multi_plan_builder,
    mock_route_judge,
    mock_route_scheduler,
    mock_user_profile_lookup,
    poi_lookup,
)
from app.agents.requirements import analyze_route_requirements, build_intent_overrides
from app.agents.strategy import (
    AGENT_PROMPT_CONTRACTS,
    CHAT_AGENT_STRATEGY,
    LANGGRAPH_PLANNING_WORKFLOW,
    MAIN_PLANNING_AGENT_STRATEGY,
)
from app.providers import provider_adapter
from app.models.schemas import (
    AgentTrace,
    ChatRequest,
    ChatResponse,
    ClarificationCard,
    ConstraintEvidence,
    ConstraintLedger,
    GenerationMetadata,
    InteractionType,
    MapLocation,
    MockPoi,
    PlanningConstraint,
    RefinementChange,
    RefinementDiff,
    RequirementSummary,
    RouteMatrixRequest,
    RoutePlan,
    RoutePlanRequest,
    RoutePlanResponse,
    RouteRefineRequest,
    TraceEvent,
)
from app.traces.store import trace_store


def run_route_planning(request: RoutePlanRequest) -> RoutePlanResponse:
    """Run the stable mock pipeline used by the Hackathon demo.

    OpenAI Agents SDK integration should plug in at the same request/response
    boundary and keep emitting the local AgentTrace contract for the Debug page.
    """

    return DeterministicMockRunner().run(request)


def run_route_refinement(request: RouteRefineRequest) -> RoutePlanResponse:
    return DeterministicMockRunner().refine(request)


def run_chat_response(request: ChatRequest) -> ChatResponse:
    return DeterministicMockRunner().chat(request)


def run_openai_agents_sdk(request: RoutePlanRequest) -> RoutePlanResponse:
    """Reserved integration point for the OpenAI Agents SDK runner.

    The SDK implementation should preserve deterministic mock tools as guarded
    tools/fallbacks, then map SDK spans back into AgentTrace.events.
    """

    raise NotImplementedError("OpenAI Agents SDK runner is not wired for the first deterministic demo.")


class DeterministicMockRunner:
    def run(self, request: RoutePlanRequest) -> RoutePlanResponse:
        trace_id = self._trace_id(request)
        events: list[TraceEvent] = []

        events.append(
            self._event(
                trace_id,
                1,
                "run_started",
                "用户目标进入规划",
                f"收到用户目标：{request.goal}",
                duration_ms=42,
                output={
                    "user_id": request.user_id,
                    "city": request.city,
                    "constraints": request.constraints,
                    "plan_mode": request.plan_mode,
                    "interaction_context": request.interaction_context.model_dump(mode="json")
                    if request.interaction_context
                    else None,
                    "runner_mode": "deterministic_mock",
                },
            )
        )

        requirement_summary, clarification_cards = analyze_route_requirements(request)
        intent = mock_intent_parser(request.goal, request.city, request.constraints)
        self._merge_intent_overrides(intent, requirement_summary)
        interaction_type = self._interaction_type(request, requirement_summary)
        routing_reason = self._routing_reason(request, interaction_type, requirement_summary)
        constraint_ledger = self._constraint_ledger(trace_id, request, requirement_summary, intent)
        events.append(
            self._event(
                trace_id,
                2,
                "agent_started",
                "交互分流",
                "InteractionRouterAgent 结合页面上下文、Plan 模式和用户输入判断本轮交互类型。",
                agent="InteractionRouterAgent",
                duration_ms=26,
                input={
                    "goal": request.goal,
                    "plan_mode": request.plan_mode,
                    "interaction_context": request.interaction_context.model_dump(mode="json")
                    if request.interaction_context
                    else None,
                },
                output={
                    "interaction_type": interaction_type,
                    "intent_kind": requirement_summary.intent_kind,
                    "reason": routing_reason,
                },
            )
        )
        if interaction_type == "switch_task":
            events.append(
                self._event(
                    trace_id,
                    3,
                    "task_switched",
                    "用户切换任务",
                    "用户在已有方案上下文中提出了新的地点、时间或人群目标，本轮开启新 run。",
                    agent="InteractionRouterAgent",
                    duration_ms=24,
                    input={
                        "previous_trace_id": request.interaction_context.trace_id if request.interaction_context else None,
                        "previous_route_id": request.interaction_context.route_id if request.interaction_context else None,
                    },
                    output={"switch_task": True, "reason": routing_reason},
                )
            )
        events.append(
            self._event(
                trace_id,
                10,
                "agent_started",
                "意图理解",
                "ConstraintDiscoveryAgent 开始判断用户输入是否足够规划，并抽取关键需求字段。",
                agent="ConstraintDiscoveryAgent",
                duration_ms=30,
                input={"goal": request.goal, "city": request.city, "constraints": request.constraints},
            )
        )
        events.append(
            self._event(
                trace_id,
                11,
                "constraint_discovered",
                "目标与约束发现",
                "抽取城市、时间、人数、饮食诉求和路线主题，生成第一版 Constraint Ledger。",
                agent="ConstraintDiscoveryAgent",
                duration_ms=216,
                tool_name="mock_intent_parser",
                tool_input={
                    "goal": request.goal,
                    "city": request.city,
                    "constraints": request.constraints,
                    "clarification_answers": request.clarification_answers,
                },
                tool_output={
                    "intent": intent,
                    "requirement_summary": requirement_summary.model_dump(mode="json"),
                    "clarification_cards": [card.model_dump(mode="json") for card in clarification_cards],
                    "constraint_ledger": constraint_ledger.model_dump(mode="json"),
                },
            )
        )
        if not requirement_summary.can_plan:
            events.append(
                self._event(
                    trace_id,
                    12,
                    "clarification_requested",
                    "需要补全信息",
                    requirement_summary.next_action,
                    agent="ConstraintDiscoveryAgent",
                    duration_ms=48,
                    output={
                        "missing_required_fields": requirement_summary.missing_required_fields,
                        "clarification_cards": [card.model_dump(mode="json") for card in clarification_cards],
                        "constraint_ledger": constraint_ledger.model_dump(mode="json"),
                    },
                    metadata={"planning_status": requirement_summary.status},
                )
            )
            return self._pending_response(
                trace_id,
                request,
                events,
                requirement_summary,
                clarification_cards,
                interaction_type,
            )

        if request.require_confirmation and not request.confirmed_requirements:
            confirmation_summary = requirement_summary.model_copy(
                update={
                    "status": "needs_confirmation",
                    "next_action": "先展示需求总结卡片，用户确认后再开始规划。",
                }
            )
            events.append(
                self._event(
                    trace_id,
                    12,
                    "requirements_summarized",
                    "等待需求确认",
                    "关键信息已齐全，但前端要求先展示需求总结确认卡片。",
                    agent="ConstraintDiscoveryAgent",
                    duration_ms=52,
                    output={
                        "requirement_summary": confirmation_summary.model_dump(mode="json"),
                        "constraint_ledger": constraint_ledger.model_dump(mode="json"),
                    },
                    metadata={"planning_status": "needs_confirmation"},
                )
            )
            return self._pending_response(trace_id, request, events, confirmation_summary, [], interaction_type)

        events.append(
            self._event(
                trace_id,
                12,
                "requirements_summarized",
                "需求已整理",
                "关键信息已足够，生成需求总结和约束账本，并继续进入长期偏好读取。",
                agent="ConstraintDiscoveryAgent",
                duration_ms=52,
                output={
                    "requirement_summary": requirement_summary.model_dump(mode="json"),
                    "constraint_ledger": constraint_ledger.model_dump(mode="json"),
                },
            )
        )
        events.append(
            self._handoff(
                trace_id,
                13,
                "ConstraintDiscoveryAgent",
                "UserPreferenceAgent",
                "需求字段已齐全，交给 UserPreferenceAgent 读取长期偏好约束。",
            )
        )
        context_bundle = self._context_bundle(request, requirement_summary, interaction_type)
        events.append(
            self._event(
                trace_id,
                14,
                "context_collected",
                "规划上下文打包",
                "ConstraintDiscoveryAgent 将页面上下文、补全回答和本轮约束整理成 planning_context_pack。",
                agent="ConstraintDiscoveryAgent",
                duration_ms=74,
                output=context_bundle,
            )
        )
        events.append(
            self._event(
                trace_id,
                15,
                "preference_detected",
                "偏好分析已排队",
                "UserPreferenceAgent 会在后台从本轮输入和补全回答中检测可长期保存的偏好。",
                agent="UserPreferenceAgent",
                duration_ms=64,
                input={
                    "user_id": request.user_id,
                    "utterance": request.goal,
                    "clarification_answers": request.clarification_answers,
                },
                output={
                    "queued": request.preference_detection_enabled and request.user_id != "anonymous",
                    "write_target": "data/mock/user_preferences.json",
                    "non_blocking": True,
                },
            )
        )
        events.append(
            self._handoff(
                trace_id,
                16,
                "UserPreferenceAgent",
                "ContextGroundingAgent",
                "偏好分析不阻塞主规划链，缓存可用时合并进约束账本，然后进入事实落地。",
            )
        )

        profile = mock_user_profile_lookup(request.user_id, intent)
        if intent.get("budget_per_person"):
            profile["budget_per_person"] = intent["budget_per_person"]
        profile["group_size"] = intent.get("group_size", profile.get("group_size", 1))
        self._append_agent_tool_handoff(
            events,
            trace_id,
            agent="UserPreferenceAgent",
            start_index=20,
            tool_name="mock_user_profile_lookup",
            tool_input={"user_id": request.user_id, "intent_preferences": intent["preferences"]},
            tool_output=profile,
            handoff_to="ContextGroundingAgent",
            summary="合并 Mock User 历史偏好、本次约束和避雷点，形成评分权重。",
            duration_ms=184,
            fallback_used=profile["user_id"] == "anonymous",
        )

        retrieval_result = provider_adapter.poi_search(intent, profile)
        retrieval = retrieval_result.data
        self._append_agent_tool_handoff(
            events,
            trace_id,
            agent="ContextGroundingAgent",
            start_index=30,
            tool_name="provider_adapter.poi_search",
            tool_input={
                "required_categories": intent["required_categories"],
                "preferences": profile["preferences"],
            },
            tool_output={
                **retrieval,
                "provider_call": retrieval_result.trace_output(),
            },
            handoff_to="ContextGroundingAgent",
            summary="通过 Provider Adapter 优先调用高德 POI，失败时回退本地 Mock 候选池。",
            duration_ms=332,
            fallback_used=retrieval_result.fallback_used,
            event_type="candidate_retrieved",
        )

        ugc_summary = self._ugc_rank_summary(retrieval)
        deep_poi_result = provider_adapter.mock_deep_poi_enrichment(
            [MockPoi(**item["poi"]) for item in retrieval.get("candidates", [])]
        )
        events.append(
            self._event(
                trace_id,
                33,
                "agent_started",
                "UGC 摘要排序",
                "ContextGroundingAgent 开始读取 Mock UGC 摘要、平台信号和风险提示。",
                agent="ContextGroundingAgent",
                duration_ms=28,
                input={"candidate_ids": self._candidate_ids(retrieval), "preferences": profile["preferences"]},
            )
        )
        events.append(
            self._event(
                trace_id,
                34,
                "tool_called",
                "本地深度 POI 数据",
                "用本地 Mock 排队、UGC 摘要和推荐菜补充每个候选 POI 的亮点、风险和入选解释。",
                agent="ContextGroundingAgent",
                duration_ms=142,
                tool_name="provider_adapter.mock_deep_poi_enrichment",
                tool_input={"candidate_ids": self._candidate_ids(retrieval)},
                tool_output={
                    **ugc_summary,
                    "provider_call": deep_poi_result.trace_output(),
                },
                fallback_used=True,
            )
        )
        weather_result = provider_adapter.weather(self._locations_for_candidates(retrieval["candidates"])[0] if retrieval.get("candidates") else None)
        events.append(
            self._event(
                trace_id,
                35,
                "context_grounded",
                "POI 与天气事实已落地",
                "候选 POI 已补充本地深度字段；天气优先来自彩云，超时或失败时回退 Mock。",
                agent="ContextGroundingAgent",
                duration_ms=36,
                output={
                    "grounded_sections": ["poi", "ugc", "queue", "recommended_dishes", "weather"],
                    "weather_provider_call": weather_result.trace_output(),
                },
                fallback_used=weather_result.fallback_used,
            )
        )

        route_matrix_result = provider_adapter.route_matrix(
            RouteMatrixRequest(locations=self._locations_for_candidates(retrieval["candidates"]), mode="taxi")
        )
        route_matrix = route_matrix_result.data
        events.append(
            self._event(
                trace_id,
                36,
                "agent_started",
                "地图上下文",
                "ContextGroundingAgent 开始通过 Provider Adapter 计算站点坐标、距离和通勤耗时。",
                agent="ContextGroundingAgent",
                duration_ms=24,
                input={"candidate_ids": self._candidate_ids(retrieval), "provider": route_matrix_result.provider},
            )
        )
        events.append(
            self._event(
                trace_id,
                37,
                "map_context_resolved",
                "地图距离已生成",
                "地图距离优先由高德 Web 服务生成；不可用时由本地 Mock provider 根据 POI 经纬度兜底。",
                agent="ContextGroundingAgent",
                duration_ms=128,
                tool_name="provider_adapter.route_matrix",
                tool_input={"locations": [location.model_dump(mode="json") for location in self._locations_for_candidates(retrieval["candidates"])]},
                tool_output={
                    **route_matrix.model_dump(mode="json"),
                    "provider_call": route_matrix_result.trace_output(),
                },
                fallback_used=route_matrix_result.fallback_used,
            )
        )
        events.append(
            self._handoff(
                trace_id,
                38,
                "ContextGroundingAgent",
                "PlanSolverAgent",
                "地图事实已就绪，交给 PlanSolverAgent 生成可执行时间线。",
            )
        )

        route_candidate = mock_route_scheduler(
            retrieval["candidates"],
            intent["route_theme"],
            time_window=intent["time_window"],
            group_size=intent.get("group_size", 1),
        )
        events.append(
            self._event(
                trace_id,
                40,
                "agent_started",
                "路线编排",
                "PlanSolverAgent 开始把候选 POI 串成可执行时间线。",
                agent="PlanSolverAgent",
                duration_ms=34,
                input={
                    "candidate_count": retrieval["candidate_count"],
                    "time_window": intent["time_window"],
                    "group_size": intent.get("group_size", 1),
                },
            )
        )
        events.append(
            self._event(
                trace_id,
                41,
                "tool_called",
                "时间线生成",
                "调用 mock_route_scheduler 生成 3 站路线、每站开始时间和停留时长。",
                agent="PlanSolverAgent",
                duration_ms=248,
                tool_name="mock_route_scheduler",
                tool_input={
                    "route_theme": intent["route_theme"],
                    "candidate_ids": self._candidate_ids(retrieval),
                    "time_window": intent["time_window"],
                    "group_size": intent.get("group_size", 1),
                    "route_matrix": route_matrix.model_dump(mode="json"),
                },
                tool_output=route_candidate.model_dump(),
            )
        )
        events.append(
            self._event(
                trace_id,
                42,
                "route_candidate_generated",
                "候选路线生成",
                "生成餐饮、看展、甜品三段式路线，准备进入约束校验。",
                agent="PlanSolverAgent",
                duration_ms=66,
                output=route_candidate.model_dump(),
            )
        )
        events.append(
            self._handoff(
                trace_id,
                43,
                "PlanSolverAgent",
                "PlanEvaluatorAgent",
                "路线至少 3 站且落在下午时间窗内，交给 PlanEvaluatorAgent 校验。",
            )
        )

        constraint_result = mock_constraint_checker(route_candidate, intent, profile)
        constraints = constraint_result["constraints"]
        self._append_agent_tool_handoff(
            events,
            trace_id,
            agent="PlanEvaluatorAgent",
            start_index=50,
            tool_name="mock_constraint_checker",
            tool_input={
                "route_id": route_candidate.id,
                "hard_constraints": intent["hard_constraints"],
                "avoidances": profile["avoidances"],
            },
            tool_output={
                "constraints": [item.model_dump() for item in constraints],
                "blocking_issues": constraint_result["blocking_issues"],
                "soft_warnings": constraint_result["soft_warnings"],
            },
            handoff_to="PlanExplanationAgent",
            summary="校验平均排队、POI 类型覆盖、路线规模和用户避雷点。",
            duration_ms=274,
            event_type="constraint_checked",
        )

        experienced_route = mock_experience_copywriter(route_candidate, retrieval, constraints)
        self._append_agent_tool_handoff(
            events,
            trace_id,
            agent="PlanExplanationAgent",
            start_index=60,
            tool_name="mock_experience_copywriter",
            tool_input={"route_id": route_candidate.id, "stop_count": len(route_candidate.stops)},
            tool_output={
                "title": experienced_route.title,
                "highlights": experienced_route.highlights,
                "stop_reasons": [stop.reason for stop in experienced_route.stops],
            },
            handoff_to="PlanEvaluatorAgent",
            summary="把检索原因、UGC 摘要和约束结果改写成用户能直接理解的推荐理由。",
            duration_ms=226,
        )

        judgement = mock_route_judge(experienced_route, constraints, profile)
        primary_plan = experienced_route.model_copy(
            update={
                "score": judgement["score"],
                "score_breakdown": judgement["score_breakdown"],
                "rank_reason": judgement["decision_summary"],
            },
            deep=True,
        )
        raw_plans = mock_multi_plan_builder(
            primary_plan,
            retrieval,
            constraints,
            time_window=intent["time_window"],
            group_size=intent.get("group_size", 1),
            required_categories=intent["required_categories"],
        )
        plans = self._enrich_plans_with_map_previews(
            self._score_plan_variants(raw_plans, retrieval, intent, profile, primary_plan.score)
        )
        final_plan = plans[0]
        plan_score_summary = [
            {
                "route_id": plan.id,
                "title": plan.title,
                "score": plan.score,
                "rank_reason": plan.rank_reason,
                "score_breakdown": plan.score_breakdown,
                "map_preview": {
                    "provider": plan.map_preview.provider if plan.map_preview else None,
                    "total_distance_meters": plan.map_preview.total_distance_meters if plan.map_preview else None,
                    "total_duration_minutes": plan.map_preview.total_duration_minutes if plan.map_preview else None,
                },
                "total_minutes": plan.total_minutes,
                "stop_durations": [
                    {"poi_id": stop.poi_id, "start_time": stop.start_time, "duration_minutes": stop.duration_minutes}
                    for stop in plan.stops
                ],
            }
            for plan in plans
        ]
        events.append(
            self._event(
                trace_id,
                70,
                "agent_started",
                "方案评分",
                "PlanEvaluatorAgent 开始计算最终方案分和评分拆解。",
                agent="PlanEvaluatorAgent",
                duration_ms=28,
                input={"route_id": final_plan.id, "constraint_count": len(constraints)},
            )
        )
        events.append(
            self._event(
                trace_id,
                71,
                "tool_called",
                "路线评分工具",
                "调用 mock_route_judge 输出可解释评分。",
                agent="PlanEvaluatorAgent",
                duration_ms=156,
                tool_name="mock_route_judge",
                tool_input={"route_id": final_plan.id, "priority_weights": profile["priority_weights"]},
                tool_output={"primary_judgement": judgement, "plan_scores": plan_score_summary},
            )
        )
        events.append(
            self._event(
                trace_id,
                72,
                "route_scored",
                "方案评分完成",
                f"最终路线得分 {final_plan.score}，低排队和类别覆盖是主要加分项。",
                agent="PlanEvaluatorAgent",
                duration_ms=82,
                output={"selected_plan_id": final_plan.id, "plan_scores": plan_score_summary},
            )
        )
        llm_plan_explanation_result = provider_adapter.llm_chat_completion(
            self._plan_explanation_messages(plans, constraint_ledger, plan_score_summary),
            purpose="plan_explanation",
            fallback_content=self._plan_explanation_fallback(plans),
            temperature=0.25,
            max_tokens=900,
        )
        events.append(
            self._event(
                trace_id,
                73,
                "tool_called",
                "路线解释大模型草稿",
                "PlanExplanationAgent 将最终方案事实包交给 LongCat 生成解释草稿；失败时使用模板解释。",
                agent="PlanExplanationAgent",
                duration_ms=184,
                tool_name="provider_adapter.llm_chat_completion",
                tool_input={
                    "purpose": "plan_explanation",
                    "plan_ids": [plan.id for plan in plans],
                    "guardrail": "只解释已有事实，不能编造 POI、距离、天气、推荐菜。",
                },
                tool_output={
                    "explanation_preview": self._llm_content(llm_plan_explanation_result.data)[:300],
                    "provider_call": llm_plan_explanation_result.trace_output(),
                },
                fallback_used=llm_plan_explanation_result.fallback_used,
            )
        )
        events.append(
            self._event(
                trace_id,
                80,
                "run_completed",
                "规划完成",
                "完整 Agent 链路已完成，返回路线和 Debug Trace。",
                duration_ms=38,
                output={
                    "trace_id": trace_id,
                    "route_id": final_plan.id,
                    "score": final_plan.score,
                    "plan_count": len(plans),
                    "selected_plan_id": final_plan.id,
                    "map_provider": final_plan.map_preview.provider if final_plan.map_preview else None,
                },
            )
        )

        trace = AgentTrace(
            id=trace_id,
            user_goal=request.goal,
            status="completed",
            total_duration_ms=sum(event.duration_ms or 0 for event in events),
            route_score=final_plan.score,
            events=events,
            runner_mode="deterministic_mock",
            sdk_trace_id=None,
            agent_strategy=MAIN_PLANNING_AGENT_STRATEGY,
            metadata={
                "plans": [plan.model_dump(mode="json") for plan in plans],
                "selected_plan_id": final_plan.id,
                "requirement_summary": requirement_summary.model_dump(mode="json"),
                "constraint_ledger": constraint_ledger.model_dump(mode="json"),
                "clarification_card_count": len(clarification_cards),
                "interaction_type": interaction_type,
                "routing_reason": routing_reason,
                "context_bundle": context_bundle,
                "map_provider": final_plan.map_preview.provider if final_plan.map_preview else "mock_map_provider",
                "agent_prompt_contracts": [contract.model_dump(mode="json") for contract in AGENT_PROMPT_CONTRACTS],
                "langgraph_workflow": LANGGRAPH_PLANNING_WORKFLOW.model_dump(mode="json"),
                "llm_plan_explanation": llm_plan_explanation_result.trace_output(),
            },
        )
        trace_store.save(trace)
        return RoutePlanResponse(
            trace_id=trace.id,
            plan=final_plan,
            plans=plans,
            selected_plan_id=final_plan.id,
            interaction_type=interaction_type,
            clarification_cards=clarification_cards,
            requirement_summary=requirement_summary,
            planning_status="completed",
            trace=trace,
            generation_metadata=GenerationMetadata(
                runner_mode="deterministic_mock",
                fallback_used=any(event.fallback_used for event in events),
                selected_plan_id=final_plan.id,
                plan_count=len(plans),
                mock_generation_ready=True,
                planning_status="completed",
                intent_kind=requirement_summary.intent_kind,
                interaction_type=interaction_type,
                clarification_card_count=len(clarification_cards),
                simulated_total_duration_ms=trace.total_duration_ms,
            ),
        )

    def chat(self, request: ChatRequest) -> ChatResponse:
        trace_id = self._chat_trace_id(request)
        intent = mock_intent_parser(request.message, request.city, request.constraints)
        profile = mock_user_profile_lookup(request.user_id, intent)
        related_pois = self._related_pois_for_chat(request, profile)
        fallback_answer = self._chat_answer(request, related_pois, profile)
        llm_answer_result = provider_adapter.llm_chat_completion(
            self._chat_answer_messages(request, related_pois, profile),
            purpose="chat_answer",
            fallback_content=fallback_answer,
            temperature=0.2,
            max_tokens=420,
        )
        answer = self._llm_content(llm_answer_result.data) or fallback_answer
        events = [
            self._event(
                trace_id,
                1,
                "run_started",
                "普通问答开始",
                f"收到普通 POI 问答：{request.message}",
                duration_ms=22,
                output={
                    "user_id": request.user_id,
                    "city": request.city,
                    "plan_mode": request.plan_mode,
                    "runner_mode": "deterministic_mock",
                },
            ),
            self._event(
                trace_id,
                2,
                "agent_started",
                "交互分流",
                "InteractionRouterAgent 判断本轮是普通 POI 问答，不进入完整路线排程。",
                agent="InteractionRouterAgent",
                duration_ms=24,
                input={
                    "message": request.message,
                    "plan_mode": request.plan_mode,
                    "interaction_context": request.interaction_context.model_dump(mode="json")
                    if request.interaction_context
                    else None,
                },
                output={"interaction_type": "chat_answer", "intent_kind": "non_planning"},
            ),
            self._event(
                trace_id,
                3,
                "context_collected",
                "问答上下文收集",
                "ContextGroundingAgent 读取城市、用户偏好和页面上下文，作为 POI 问答依据。",
                agent="ContextGroundingAgent",
                duration_ms=58,
                output={
                    "city": request.city,
                    "preferences": profile["preferences"],
                    "avoidances": profile["avoidances"],
                    "interaction_context": request.interaction_context.model_dump(mode="json")
                    if request.interaction_context
                    else None,
                },
            ),
            self._event(
                trace_id,
                4,
                "candidate_retrieved",
                "相关 POI 检索",
                "ContextGroundingAgent 从 Mock POI 中选出少量能回答问题的门店。",
                agent="ContextGroundingAgent",
                duration_ms=118,
                tool_name="mock_chat_poi_search",
                tool_input={
                    "message": request.message,
                    "limit": request.related_poi_limit,
                    "preferences": profile["preferences"],
                },
                tool_output={"related_pois": [poi.model_dump(mode="json") for poi in related_pois]},
            ),
            self._event(
                trace_id,
                5,
                "chat_answered",
                "普通问答完成",
                "ChatAnswerAgent 用相关 POI、排队和 UGC 摘要生成轻量回答；LongCat 不可用时回退模板。",
                agent="ChatAnswerAgent",
                duration_ms=136,
                tool_name="provider_adapter.llm_chat_completion",
                tool_input={"message": request.message, "related_poi_ids": [poi.id for poi in related_pois]},
                tool_output={
                    "answer": answer,
                    "can_convert_to_plan": True,
                    "provider_call": llm_answer_result.trace_output(),
                },
                fallback_used=llm_answer_result.fallback_used,
            ),
            self._event(
                trace_id,
                6,
                "run_completed",
                "问答返回",
                "普通 POI 问答已返回 answer + related_pois + trace。",
                duration_ms=18,
                output={"trace_id": trace_id, "related_poi_count": len(related_pois)},
            ),
        ]
        trace = AgentTrace(
            id=trace_id,
            user_goal=request.message,
            status="completed",
            total_duration_ms=sum(event.duration_ms or 0 for event in events),
            route_score=None,
            events=events,
            runner_mode="deterministic_mock",
            sdk_trace_id=None,
            agent_strategy=CHAT_AGENT_STRATEGY,
            metadata={
                "interaction_type": "chat_answer",
                "related_pois": [poi.model_dump(mode="json") for poi in related_pois],
                "can_convert_to_plan": True,
                "llm_provider_call": llm_answer_result.trace_output(),
                "agent_prompt_contracts": [
                    contract.model_dump(mode="json")
                    for contract in AGENT_PROMPT_CONTRACTS
                    if contract.agent_name in {strategy.name for strategy in CHAT_AGENT_STRATEGY}
                ],
            },
        )
        trace_store.save(trace)
        return ChatResponse(
            trace_id=trace.id,
            answer=answer,
            related_pois=related_pois,
            can_convert_to_plan=True,
            used_preferences=self._used_preferences_for_chat(profile, related_pois),
            interaction_type="chat_answer",
            trace=trace,
        )

    def refine(self, request: RouteRefineRequest) -> RoutePlanResponse:
        previous_trace = trace_store.get(request.trace_id)
        if previous_trace is None:
            fallback_request = RoutePlanRequest(
                user_id="user-date-001",
                goal=f"基于路线 {request.route_id} 调整：{request.instruction}",
                constraints=["reuse_previous_route"],
            )
            return self.run(fallback_request)

        previous_plans = [
            RoutePlan(**item)
            for item in previous_trace.metadata.get("plans", [])
            if isinstance(item, dict)
        ]
        if not previous_plans:
            fallback_request = RoutePlanRequest(
                user_id="user-date-001",
                goal=f"{previous_trace.user_goal}。微调：{request.instruction}",
                constraints=["reuse_previous_route"],
            )
            return self.run(fallback_request)

        if self._is_full_rerun_instruction(request.instruction):
            return self._run_full_refinement(previous_trace, request)

        base_plan = next((plan for plan in previous_plans if plan.id == request.route_id), previous_plans[0])
        refined_plan, diff = self._apply_refinement(base_plan, request)
        refined_plan = self._enrich_plans_with_map_previews([refined_plan])[0]
        plans = [refined_plan if plan.id == base_plan.id else plan for plan in previous_plans]
        trace_id = f"{previous_trace.id}-refine-{sha1(request.instruction.encode('utf-8')).hexdigest()[:6]}"
        events = [event.model_copy(deep=True) for event in previous_trace.events]
        event_start = len(events) + 1
        events.append(
            self._event(
                trace_id,
                event_start,
                "user_refinement_received",
                "收到用户微调",
                f"用户希望调整当前方案：{request.instruction}",
                duration_ms=24,
                input={
                    "base_trace_id": request.trace_id,
                    "route_id": request.route_id,
                    "instruction": request.instruction,
                },
                output=diff.model_dump(mode="json"),
                metadata={"strategy": diff.strategy, "change_count": len(diff.changes)},
            )
        )
        events.append(
            self._event(
                trace_id,
                event_start + 1,
                "agent_started",
                "局部微调规划",
                "PlanSolverAgent 只重排或替换受影响的 POI，保留未被点名的站点。",
                agent="PlanSolverAgent",
                duration_ms=32,
                input={"locked_poi_ids": self._locked_poi_ids(base_plan, request.instruction)},
            )
        )
        events.append(
            self._event(
                trace_id,
                event_start + 2,
                "tool_called",
                "局部替换工具",
                "使用 deterministic mock 规则完成局部替换，并生成可供前端高亮的 refinement_diff。",
                agent="PlanSolverAgent",
                duration_ms=144,
                tool_name="mock_refinement_applier",
                tool_input={"instruction": request.instruction, "base_route_id": base_plan.id},
                tool_output=diff.model_dump(mode="json"),
            )
        )
        events.append(
            self._event(
                trace_id,
                event_start + 3,
                "constraint_checked",
                "微调后约束复查",
                "复查排队、路线规模和避雷偏好，微调后仍可演示。",
                agent="PlanEvaluatorAgent",
                duration_ms=96,
                output={
                    "route_id": refined_plan.id,
                    "constraints": [item.model_dump(mode="json") for item in refined_plan.constraints],
                },
            )
        )
        events.append(
            self._event(
                trace_id,
                event_start + 4,
                "run_completed",
                "微调完成",
                "已返回更新后的方案、变更 diff 和完整 Debug Trace。",
                duration_ms=28,
                output={"trace_id": trace_id, "route_id": refined_plan.id, "score": refined_plan.score},
            )
        )
        trace = AgentTrace(
            id=trace_id,
            user_goal=f"{previous_trace.user_goal} / 微调：{request.instruction}",
            status="completed",
            total_duration_ms=sum(event.duration_ms or 0 for event in events),
            route_score=refined_plan.score,
            events=events,
            runner_mode="deterministic_mock",
            sdk_trace_id=None,
            agent_strategy=MAIN_PLANNING_AGENT_STRATEGY,
            metadata={
                "plans": [plan.model_dump(mode="json") for plan in plans],
                "selected_plan_id": refined_plan.id,
                "refinement_diff": diff.model_dump(mode="json"),
                "interaction_type": "refine_current_plan",
                "langgraph_workflow": LANGGRAPH_PLANNING_WORKFLOW.model_dump(mode="json"),
            },
        )
        trace_store.save(trace)
        return RoutePlanResponse(
            trace_id=trace.id,
            plan=refined_plan,
            plans=plans,
            selected_plan_id=refined_plan.id,
            interaction_type="refine_current_plan",
            clarification_cards=[],
            refinement_diff=diff,
            trace=trace,
            generation_metadata=GenerationMetadata(
                runner_mode="deterministic_mock",
                fallback_used=False,
                selected_plan_id=refined_plan.id,
                plan_count=len(plans),
                mock_generation_ready=True,
                planning_status="completed",
                intent_kind="planning",
                interaction_type="refine_current_plan",
                simulated_total_duration_ms=trace.total_duration_ms,
            ),
        )

    def _is_full_rerun_instruction(self, instruction: str) -> bool:
        return any(
            keyword in instruction
            for keyword in [
                "重新生成",
                "重新规划",
                "新的方案",
                "新方案",
                "不要这个",
                "不想按这个",
                "换个思路",
                "从头来",
                "全换",
            ]
        )

    def _run_full_refinement(self, previous_trace: AgentTrace, request: RouteRefineRequest) -> RoutePlanResponse:
        diff = RefinementDiff(
            instruction=request.instruction,
            base_trace_id=request.trace_id,
            base_route_id=request.route_id,
            strategy="full_rerun",
            changes=[
                RefinementChange(
                    type="updated_copy",
                    reason="用户要求换一个整体思路，放弃当前方案并重新运行完整规划链路。",
                )
            ],
        )
        rerun_request = RoutePlanRequest(
            user_id="user-date-001",
            goal=f"{previous_trace.user_goal}。新的要求：{request.instruction}",
            city="北京",
            constraints=["refinement_full_rerun"],
            skip_clarification=True,
            confirmed_requirements=True,
            previous_trace_id=request.trace_id,
        )
        response = self.run(rerun_request)
        refinement_event = self._event(
            response.trace.id,
            2,
            "user_refinement_received",
            "收到整体重规划",
            f"用户不想沿用当前方案，改为重新规划：{request.instruction}",
            duration_ms=24,
            input={
                "base_trace_id": request.trace_id,
                "route_id": request.route_id,
                "instruction": request.instruction,
            },
            output=diff.model_dump(mode="json"),
            metadata={"strategy": "full_rerun", "change_count": len(diff.changes)},
        )
        response.trace.events.insert(1, refinement_event)
        response.trace.total_duration_ms += refinement_event.duration_ms or 0
        response.trace.metadata["refinement_diff"] = diff.model_dump(mode="json")
        response.trace.metadata["base_trace_id"] = request.trace_id
        response.trace.metadata["interaction_type"] = "refine_current_plan"
        response.interaction_type = "refine_current_plan"
        response.generation_metadata.interaction_type = "refine_current_plan"
        response.generation_metadata.simulated_total_duration_ms = response.trace.total_duration_ms
        response.refinement_diff = diff
        trace_store.save(response.trace)
        return response

    def _merge_intent_overrides(self, intent: dict[str, Any], requirement_summary: RequirementSummary) -> None:
        overrides = build_intent_overrides(requirement_summary)
        extra_preferences = overrides.pop("preferences", [])
        for key, value in overrides.items():
            intent[key] = value
        if extra_preferences:
            intent["preferences"] = list(dict.fromkeys([*intent.get("preferences", []), *extra_preferences]))

        food_preference = requirement_summary.collected.get("food_preference")
        if food_preference == "不吃任何东西":
            replacement_order = ["culture", "shopping", "entertainment"]
            intent["required_categories"] = [
                category
                for category in intent.get("required_categories", [])
                if category not in {"food", "dessert"}
            ]
            for category in replacement_order:
                if len(intent["required_categories"]) >= 3:
                    break
                if category not in intent["required_categories"]:
                    intent["required_categories"].append(category)
        elif food_preference == "喝饮品" and "dessert" not in intent["required_categories"]:
            intent["required_categories"].append("dessert")

    def _constraint_ledger(
        self,
        trace_id: str,
        request: RoutePlanRequest,
        requirement_summary: RequirementSummary,
        intent: dict[str, Any],
    ) -> ConstraintLedger:
        collected = requirement_summary.collected
        constraints: list[PlanningConstraint] = [
            PlanningConstraint(
                id="goal.user_goal",
                label="本轮用户目标",
                description=request.goal,
                category="goal",
                hardness="hard",
                source="user_explicit",
                reliability="verified",
                status="discovered",
                impact=["clarify", "explain"],
                evidence=[
                    ConstraintEvidence(
                        source="user_explicit",
                        summary="用户原始输入",
                        payload={"goal": request.goal},
                    )
                ],
            ),
            PlanningConstraint(
                id="system.plan_count",
                label="固定返回 3 个方案",
                description="V2 固定返回 3 个可解释方案，V3 可扩展为 3-5 个。",
                category="system",
                hardness="hard",
                source="system_default",
                reliability="verified",
                status="grounded",
                impact=["filter", "explain"],
                evidence=[ConstraintEvidence(source="system_default", summary="AGENTS.md 已确认 V2 固定 3 个方案。")],
            ),
        ]

        field_specs = [
            ("location.city", "城市", "city", "location", "hard", "城市会决定 POI、天气、交通和地图 provider 查询范围。"),
            ("location.area", "区域/商圈", "area", "location", "hard", "区域会决定候选 POI 和路线移动跨度。"),
            ("people.group_size", "出行人数", "group_size", "people", "hard", "人数会影响排队、订位、停留时长和预算估算。"),
            ("time.window", "时间窗", "time_window", "time", "hard", "时间窗决定 POI 到达时间、营业检查和交通预测时段。"),
            ("food.required", "是否安排吃喝", "food_preference", "food", "hard", "是否吃喝会决定是否检索餐厅、甜品和饮品类 POI。"),
            ("budget.per_person", "人均预算", "budget_per_person", "budget", "soft", "预算用于软约束排序；缺失时使用默认假设。"),
            ("mobility.preference", "交通/体力偏好", "mobility", "mobility", "soft", "交通偏好会影响步行、地铁、打车和少走路排序。"),
            ("taste.preference", "口味偏好", "taste", "preference", "soft", "口味偏好会影响餐厅候选和踩雷风险。"),
        ]
        for constraint_id, label, field_name, category, hardness, description in field_specs:
            value = collected.get(field_name)
            missing = field_name in requirement_summary.missing_required_fields or value in (None, "", [])
            constraints.append(
                PlanningConstraint(
                    id=constraint_id,
                    label=label,
                    description=f"{description} 当前值：{value if value not in (None, '', []) else '缺失'}。",
                    category=category,  # type: ignore[arg-type]
                    hardness=hardness,  # type: ignore[arg-type]
                    source="user_explicit" if value not in (None, "", []) else "system_default",
                    reliability="verified" if value not in (None, "", []) else "missing",
                    status="needs_clarification" if missing else "discovered",
                    impact=["clarify"] if missing else ["filter" if hardness == "hard" else "boost", "explain"],
                    weight=1.0 if hardness == "hard" else 0.55,
                    evidence=[
                        ConstraintEvidence(
                            source="user_explicit" if value not in (None, "", []) else "system_default",
                            summary=f"字段 {field_name} 来自用户输入、补全答案或默认假设。",
                            payload={"field": field_name, "value": value},
                        )
                    ],
                    requires_clarification=missing,
                )
            )

        for index, label in enumerate(request.constraints):
            constraints.append(
                PlanningConstraint(
                    id=f"user.soft_constraint.{index + 1}",
                    label=label,
                    description=f"用户显式传入的软约束：{label}。",
                    category="preference",
                    hardness="soft",
                    source="user_explicit",
                    reliability="verified",
                    status="discovered",
                    impact=["boost", "penalty", "explain"],
                    weight=0.72,
                    evidence=[ConstraintEvidence(source="user_explicit", summary="RoutePlanRequest.constraints", payload={"value": label})],
                    requires_grounding=label in {"低排队", "少走路", "更想坐地铁", "避开拥堵"},
                )
            )

        for category in intent.get("required_categories", []):
            constraints.append(
                PlanningConstraint(
                    id=f"poi.category.{category}",
                    label=f"需要覆盖 {category} 类 POI",
                    description="由目标和吃喝诉求推导出的 POI 类型 slot。",
                    category="poi",
                    hardness="hard",
                    source="llm_inference",
                    reliability="inferred",
                    status="discovered",
                    impact=["filter", "explain"],
                    weight=1.0,
                    evidence=[
                        ConstraintEvidence(
                            source="llm_inference",
                            summary="mock_intent_parser 输出 required_categories。",
                            payload={"category": category},
                        )
                    ],
                    requires_grounding=True,
                )
            )

        soft_suggestions = [
            PlanningConstraint(
                id="suggestion.queue_low",
                label="不偏好排队",
                description="如果用户同样在意，可在确认页一键选择，排序时降低热门长队 POI。",
                category="poi",
                hardness="soft",
                source="system_default",
                reliability="mocked",
                status="discovered",
                impact=["boost", "penalty", "explain"],
                weight=0.62,
                requires_grounding=True,
            ),
            PlanningConstraint(
                id="suggestion.metro_first",
                label="更想坐地铁",
                description="如果用户同样在意，可优先选择地铁更稳的路线，减少晚高峰打车不确定性。",
                category="traffic",
                hardness="soft",
                source="system_default",
                reliability="mocked",
                status="discovered",
                impact=["boost", "penalty", "explain"],
                weight=0.48,
                requires_grounding=True,
            ),
            PlanningConstraint(
                id="suggestion.weather_safe",
                label="天气不好时少走室外",
                description="如果未来天气不稳定，优先选择室内或短步行动线。",
                category="weather",
                hardness="soft",
                source="system_default",
                reliability="mocked",
                status="discovered",
                impact=["boost", "warning", "explain"],
                weight=0.46,
                requires_grounding=True,
            ),
        ]

        return ConstraintLedger(
            run_id=trace_id,
            user_goal=request.goal,
            constraints=constraints,
            missing_required_fields=requirement_summary.missing_required_fields,
            assumptions=requirement_summary.assumptions,
            soft_constraint_suggestions=soft_suggestions,
            notes=[
                "V2 使用 deterministic mock runner 生成约束账本。",
                "天气、交通、排队和推荐菜 provider contract 确认后，会把 grounding 结果写回对应约束。",
            ],
        )

    def _pending_response(
        self,
        trace_id: str,
        request: RoutePlanRequest,
        events: list[TraceEvent],
        requirement_summary: RequirementSummary,
        clarification_cards: list[ClarificationCard],
        interaction_type: InteractionType,
    ) -> RoutePlanResponse:
        draft_plan = self._draft_plan(requirement_summary)
        trace = AgentTrace(
            id=trace_id,
            user_goal=request.goal,
            status="running",
            total_duration_ms=sum(event.duration_ms or 0 for event in events),
            route_score=None,
            events=events,
            runner_mode="deterministic_mock",
            sdk_trace_id=None,
            agent_strategy=MAIN_PLANNING_AGENT_STRATEGY,
            metadata={
                "requirement_summary": requirement_summary.model_dump(mode="json"),
                "clarification_cards": [card.model_dump(mode="json") for card in clarification_cards],
                "constraint_ledger": self._constraint_ledger(trace_id, request, requirement_summary, {}).model_dump(mode="json"),
                "selected_plan_id": None,
                "clarification_card_count": len(clarification_cards),
                "interaction_type": interaction_type,
                "agent_prompt_contracts": [contract.model_dump(mode="json") for contract in AGENT_PROMPT_CONTRACTS],
                "langgraph_workflow": LANGGRAPH_PLANNING_WORKFLOW.model_dump(mode="json"),
            },
        )
        trace_store.save(trace)
        return RoutePlanResponse(
            trace_id=trace.id,
            plan=draft_plan,
            plans=[],
            selected_plan_id=None,
            interaction_type=interaction_type,
            clarification_cards=clarification_cards,
            requirement_summary=requirement_summary,
            planning_status=requirement_summary.status,
            trace=trace,
            generation_metadata=GenerationMetadata(
                runner_mode="deterministic_mock",
                fallback_used=False,
                selected_plan_id=None,
                plan_count=0,
                mock_generation_ready=True,
                planning_status=requirement_summary.status,
                intent_kind=requirement_summary.intent_kind,
                interaction_type=interaction_type,
                clarification_card_count=len(clarification_cards),
                simulated_total_duration_ms=trace.total_duration_ms,
            ),
        )

    def _draft_plan(self, requirement_summary: RequirementSummary) -> RoutePlan:
        return RoutePlan(
            id=f"route-{requirement_summary.status}",
            title="还需要补充一点信息",
            subtitle=requirement_summary.next_action,
            theme="requirement-gate",
            badge="待确认",
            score=0,
            total_minutes=0,
            highlights=requirement_summary.user_visible_summary,
            map_points=[],
            transport_summary=None,
            transports=[],
            stops=[],
            constraints=[],
            todo_items=[],
        )

    def _interaction_type(
        self,
        request: RoutePlanRequest,
        requirement_summary: RequirementSummary,
    ) -> InteractionType:
        context = request.interaction_context
        page = context.page if context else None
        goal = request.goal
        if context and context.pending_clarification_card_id:
            return "answer_clarification"
        if request.clarification_answers:
            return "answer_clarification"
        if request.confirmed_requirements:
            return "confirm_requirements"
        if page in {"plans", "selected"} and self._looks_like_task_switch(goal):
            return "switch_task"
        if page in {"plans", "selected"} and self._looks_like_refinement(goal):
            return "refine_current_plan"
        if requirement_summary.intent_kind == "non_planning":
            return "chat_answer"
        return "new_planning_task"

    def _routing_reason(
        self,
        request: RoutePlanRequest,
        interaction_type: InteractionType,
        requirement_summary: RequirementSummary,
    ) -> str:
        page = request.interaction_context.page if request.interaction_context else "unknown"
        reasons = {
            "answer_clarification": "请求包含补全卡片上下文或 clarification_answers，本轮合并答案后继续规划。",
            "confirm_requirements": "用户已确认需求总结，继续进入候选检索和路线生成。",
            "switch_task": "用户在方案上下文中提出新地点、时间或人群目标，记录为任务切换。",
            "refine_current_plan": "用户位于方案页且输入像局部替换或重排，优先视为当前方案微调。",
            "chat_answer": "输入更像附近 POI 咨询，不生成完整路线。",
            "new_planning_task": "输入包含路线规划所需目标或 Plan 模式倾向，开启新规划 run。",
            "select_plan": "用户选择已有方案。",
        }
        return f"{reasons[interaction_type]} page={page}，intent_kind={requirement_summary.intent_kind}。"

    def _context_bundle(
        self,
        request: RoutePlanRequest,
        requirement_summary: RequirementSummary,
        interaction_type: InteractionType,
    ) -> dict[str, Any]:
        return {
            "interaction_type": interaction_type,
            "plan_mode": request.plan_mode,
            "city": request.city,
            "user_id": request.user_id,
            "previous_trace_id": request.previous_trace_id,
            "interaction_context": request.interaction_context.model_dump(mode="json")
            if request.interaction_context
            else None,
            "requirement_summary": requirement_summary.model_dump(mode="json"),
            "planning_context_pack_ready": requirement_summary.can_plan,
        }

    def _looks_like_refinement(self, text: str) -> bool:
        return any(keyword in text for keyword in ["换", "保留", "不要", "重新", "第二个", "第一站", "第三站", "改成"])

    def _looks_like_task_switch(self, text: str) -> bool:
        has_new_time_or_place = any(keyword in text for keyword in ["明天", "后天", "周末", "上海", "成都", "杭州", "迪士尼"])
        has_new_people_or_goal = any(keyword in text for keyword in ["带娃", "亲子", "朋友", "重新来", "算了"])
        return has_new_time_or_place and has_new_people_or_goal

    def _ugc_rank_summary(self, retrieval: dict[str, Any]) -> dict[str, Any]:
        ranked = []
        for item in retrieval.get("candidates", []):
            poi = MockPoi(**item["poi"])
            ranked.append(
                {
                    "poi_id": poi.id,
                    "name": poi.name,
                    "ugc_summary": poi.ugc_summary,
                    "ugc_highlights": poi.ugc_highlights[:2],
                    "risk_notes": poi.risk_notes,
                    "rank_signal": item.get("reason"),
                }
            )
        return {
            "ranked_candidates": ranked,
            "rejected_pois": retrieval.get("rejected", [])[:6],
            "explainable": True,
        }

    def _locations_for_candidates(self, candidates: list[dict[str, Any]]) -> list[MapLocation]:
        locations = []
        for item in candidates:
            poi = MockPoi(**item["poi"])
            locations.append(
                MapLocation(
                    id=poi.id,
                    name=poi.name,
                    city=poi.city,
                    area=poi.area,
                    address=poi.address,
                    latitude=poi.latitude,
                    longitude=poi.longitude,
                )
            )
        return locations

    def _enrich_plans_with_map_previews(self, plans: list[RoutePlan]) -> list[RoutePlan]:
        enriched = []
        for plan in plans:
            map_preview = provider_adapter.preview_for_plan(plan)
            transport_summary = {
                "provider": map_preview.provider,
                "recommended": "taxi_short_hops",
                "total_travel_minutes": map_preview.total_duration_minutes,
                "total_distance_meters": map_preview.total_distance_meters,
                "detail": "V3 优先使用高德地图 Web 服务；超时、失败或测试 key 时回退本地 Mock 路线事实。",
            }
            enriched.append(
                plan.model_copy(
                    update={
                        "map_preview": map_preview,
                        "map_points": map_preview.visual_points or plan.map_points,
                        "stops": self._stops_with_provider_distances(plan, map_preview),
                        "transport_summary": transport_summary,
                    },
                    deep=True,
                )
            )
        return enriched

    def _stops_with_provider_distances(self, plan: RoutePlan, map_preview) -> list:
        provider_label = {
            "mock_map_provider": "mock map provider",
            "amap": "高德 provider",
        }.get(map_preview.provider, map_preview.provider)
        mode_label = {
            "walk": "步行",
            "bike": "骑行",
            "taxi": "打车",
            "metro": "地铁",
        }
        stops = []
        for index, stop in enumerate(plan.stops):
            if index == 0:
                distance_from_previous = "起点"
            else:
                leg = map_preview.route_segments[index - 1] if index - 1 < len(map_preview.route_segments) else None
                if leg is None:
                    distance_from_previous = "等待地图 provider 回填"
                else:
                    distance = self._format_distance(leg.distance_meters)
                    mode = mode_label.get(leg.mode, leg.mode)
                    distance_from_previous = f"{mode} {distance} · {leg.duration_minutes} 分钟（{provider_label}）"
            stops.append(stop.model_copy(update={"distance_from_previous": distance_from_previous}, deep=True))
        return stops

    def _format_distance(self, distance_meters: int) -> str:
        if distance_meters >= 1000:
            return f"{distance_meters / 1000:.1f} km"
        return f"{distance_meters} m"

    def _plan_explanation_messages(
        self,
        plans: list[RoutePlan],
        constraint_ledger: ConstraintLedger,
        plan_score_summary: list[dict[str, Any]],
    ) -> list[dict[str, str]]:
        plan_facts = [
            {
                "id": plan.id,
                "title": plan.title,
                "score": plan.score,
                "rank_reason": plan.rank_reason,
                "highlights": plan.highlights,
                "transport_summary": plan.transport_summary,
                "stops": [
                    {
                        "poi_id": stop.poi_id,
                        "poi_name": stop.poi_name,
                        "category": stop.category,
                        "start_time": stop.start_time,
                        "duration_minutes": stop.duration_minutes,
                        "reason": stop.reason,
                        "queue_minutes": stop.queue_minutes,
                        "distance_from_previous": stop.distance_from_previous,
                    }
                    for stop in plan.stops
                ],
                "score_breakdown": plan.score_breakdown,
            }
            for plan in plans
        ]
        return [
            {
                "role": "system",
                "content": (
                    "你是 DZUltra 的 PlanExplanationAgent。只能基于输入 facts 写中文解释，"
                    "不能编造 POI、距离、天气、营业、排队或推荐菜。输出 JSON，包含 summary 和 plan_copy。"
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "constraint_ledger": constraint_ledger.model_dump(mode="json"),
                        "plans": plan_facts,
                        "plan_score_summary": plan_score_summary,
                        "output_schema": {
                            "summary": "一句话说明整体推荐逻辑",
                            "plan_copy": [
                                {
                                    "plan_id": "string",
                                    "title": "string",
                                    "rank_reason": "string",
                                    "risk_reminder": "string",
                                    "stop_reason_updates": [{"poi_id": "string", "reason": "string"}],
                                }
                            ],
                        },
                    },
                    ensure_ascii=False,
                ),
            },
        ]

    def _plan_explanation_fallback(self, plans: list[RoutePlan]) -> str:
        return json.dumps(
            {
                "summary": "已按低排队、路线顺路、类别覆盖和可解释理由筛出 3 个方案。",
                "plan_copy": [
                    {
                        "plan_id": plan.id,
                        "title": plan.title,
                        "rank_reason": plan.rank_reason or "该方案综合满足本轮约束。",
                        "risk_reminder": "真实 provider 不可用时，地图和天气会回退 Mock，需要在 Debug Trace 查看 reliability。",
                        "stop_reason_updates": [
                            {"poi_id": stop.poi_id, "reason": stop.reason}
                            for stop in plan.stops
                        ],
                    }
                    for plan in plans
                ],
            },
            ensure_ascii=False,
        )

    def _score_plan_variants(
        self,
        raw_plans: list[RoutePlan],
        retrieval: dict[str, Any],
        intent: dict[str, Any],
        profile: dict[str, Any],
        primary_score: int,
    ) -> list[RoutePlan]:
        scored_plans = []
        for plan in raw_plans:
            constraint_result = mock_constraint_checker(plan, intent, profile)
            constraints = constraint_result["constraints"]
            explained_plan = mock_experience_copywriter(plan, retrieval, constraints)
            judgement = mock_route_judge(explained_plan, constraints, profile)
            variant_delta = plan.score - primary_score
            score = max(0, min(100, judgement["score"] + variant_delta))
            rank_reason = judgement["decision_summary"]
            if variant_delta < 0:
                rank_reason = f"{rank_reason} 该方案为了保留不同风格，较主推方案降低 {abs(variant_delta)} 分。"
            scored_plans.append(
                explained_plan.model_copy(
                    update={
                        "score": score,
                        "score_breakdown": {
                            **judgement["score_breakdown"],
                            "variant_delta": variant_delta,
                        },
                        "rank_reason": rank_reason,
                    },
                    deep=True,
                )
            )
        return sorted(scored_plans, key=lambda plan: (plan.score, -plan.total_minutes), reverse=True)

    def _append_agent_tool_handoff(
        self,
        events: list[TraceEvent],
        trace_id: str,
        agent: str,
        start_index: int,
        tool_name: str,
        tool_input: dict[str, Any],
        tool_output: dict[str, Any],
        handoff_to: str,
        summary: str,
        duration_ms: int,
        fallback_used: bool = False,
        event_type: str = "tool_called",
    ) -> None:
        events.append(
            self._event(
                trace_id,
                start_index,
                "agent_started",
                self._agent_label(agent),
                f"{agent} 开始执行：{summary}",
                agent=agent,
                duration_ms=30,
                input=tool_input,
                fallback_used=fallback_used,
            )
        )
        events.append(
            self._event(
                trace_id,
                start_index + 1,
                event_type,
                self._tool_label(tool_name),
                summary,
                agent=agent,
                duration_ms=duration_ms,
                tool_name=tool_name,
                tool_input=tool_input,
                tool_output=tool_output,
                fallback_used=fallback_used,
            )
        )
        if handoff_to != agent:
            events.append(
                self._handoff(
                    trace_id,
                    start_index + 2,
                    agent,
                    handoff_to,
                    f"{agent} 输出满足 handoff 条件，交给 {handoff_to}。",
                )
            )

    def _event(
        self,
        trace_id: str,
        index: int,
        type: str,
        label: str,
        summary: str,
        agent: str | None = None,
        duration_ms: int | None = None,
        input: dict[str, Any] | None = None,
        output: dict[str, Any] | None = None,
        tool_name: str | None = None,
        tool_input: dict[str, Any] | None = None,
        tool_output: dict[str, Any] | None = None,
        fallback_used: bool = False,
        metadata: dict[str, Any] | None = None,
    ) -> TraceEvent:
        debug_metadata = self._model_call_metadata(
            event_type=type,
            agent=agent,
            tool_name=tool_name,
            duration_ms=duration_ms,
            input_payload=input or tool_input or {},
            output_payload=output or tool_output or {},
        )
        return TraceEvent(
            id=f"{trace_id}-event-{index:03d}",
            type=type,  # type: ignore[arg-type]
            label=label,
            summary=summary,
            agent=agent,
            duration_ms=duration_ms,
            input=input or {},
            output=output or {},
            tool_name=tool_name,
            tool_input=tool_input or {},
            tool_output=tool_output or {},
            fallback_used=fallback_used,
            metadata={**debug_metadata, **(metadata or {})},
        )

    def _handoff(
        self,
        trace_id: str,
        index: int,
        handoff_from: str,
        handoff_to: str,
        summary: str,
    ) -> TraceEvent:
        return TraceEvent(
            id=f"{trace_id}-event-{index:03d}",
            type="handoff",
            label=f"{handoff_from} -> {handoff_to}",
            summary=summary,
            agent=handoff_from,
            duration_ms=18,
            handoff_from=handoff_from,
            handoff_to=handoff_to,
            metadata={
                "billing_mode": "mock_estimate",
                "model_name": "handoff-router",
                "model_duration_ms": 6,
                "token_usage": {"input_tokens": 18, "output_tokens": 8, "total_tokens": 26},
                "estimated_cost_cny": 0.0001,
            },
        )

    def _model_call_metadata(
        self,
        event_type: str,
        agent: str | None,
        tool_name: str | None,
        duration_ms: int | None,
        input_payload: dict[str, Any],
        output_payload: dict[str, Any],
    ) -> dict[str, Any]:
        billable_event_types = {
            "agent_started",
            "constraint_discovered",
            "context_collected",
            "context_grounded",
            "tool_called",
            "clarification_requested",
            "requirements_summarized",
            "preference_detected",
            "candidate_retrieved",
            "map_context_resolved",
            "constraint_checked",
            "route_candidate_generated",
            "route_scored",
            "chat_answered",
            "user_refinement_received",
            "task_switched",
        }
        if event_type not in billable_event_types:
            return {}

        model_name = self._model_name_for_agent(agent, event_type)
        input_tokens = self._estimate_tokens(input_payload, minimum=32 if agent else 18)
        output_tokens = self._estimate_tokens(output_payload, minimum=18)
        total_tokens = input_tokens + output_tokens
        model_duration_ms = max(8, int((duration_ms or 24) * (0.74 if tool_name else 0.62)))
        tool_duration_ms = duration_ms if tool_name else None
        estimated_cost_cny = round((input_tokens * 0.002 + output_tokens * 0.006) / 1000, 6)

        metadata: dict[str, Any] = {
            "billing_mode": "mock_estimate",
            "model_name": model_name,
            "model_duration_ms": model_duration_ms,
            "token_usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
            },
            "estimated_cost_cny": estimated_cost_cny,
        }
        if tool_name:
            metadata["tool_duration_ms"] = tool_duration_ms
        return metadata

    def _model_name_for_agent(self, agent: str | None, event_type: str) -> str:
        if agent == "PlanExplanationAgent":
            return "mock-copywriter-small"
        if agent == "PlanEvaluatorAgent":
            return "mock-judge-small"
        if agent == "ChatAnswerAgent":
            return "mock-chat-answer-small"
        if agent == "ContextGroundingAgent":
            return "mock-grounding-tools"
        if agent:
            return "mock-reasoner-small"
        if event_type == "user_refinement_received":
            return "mock-refinement-router"
        return "mock-orchestrator"

    def _estimate_tokens(self, payload: dict[str, Any], minimum: int) -> int:
        if not payload:
            return minimum
        return max(minimum, min(1800, len(repr(payload)) // 6))

    def _trace_id(self, request: RoutePlanRequest) -> str:
        context_key = request.interaction_context.trace_id if request.interaction_context else ""
        raw = "|".join(
            [
                request.user_id,
                request.city,
                request.goal,
                ",".join(request.constraints),
                str(request.plan_mode),
                context_key or "",
            ]
        )
        return f"trace-{sha1(raw.encode('utf-8')).hexdigest()[:10]}"

    def _chat_trace_id(self, request: ChatRequest) -> str:
        raw = "|".join([request.user_id, request.city, request.message, ",".join(request.constraints)])
        return f"trace-chat-{sha1(raw.encode('utf-8')).hexdigest()[:10]}"

    def _candidate_ids(self, retrieval: dict) -> list[str]:
        return [item["poi"]["id"] for item in retrieval["candidates"]]

    def _related_pois_for_chat(self, request: ChatRequest, profile: dict[str, Any]) -> list[MockPoi]:
        message = request.message
        pois = list(poi_lookup().values())
        scored = []
        for poi in pois:
            if poi.city and poi.city != request.city:
                continue
            score = int(poi.rating * 10) - poi.queue_minutes
            searchable = " ".join([poi.name, poi.category, poi.area, *(poi.tags or []), poi.ugc_summary or ""])
            if any(keyword in message for keyword in ["咖啡", "饮品", "聊天", "坐坐"]) and poi.category == "dessert":
                score += 20
            if any(keyword in message for keyword in ["吃", "餐厅", "饭", "聚餐"]) and poi.category == "food":
                score += 18
            if any(keyword in message for keyword in ["展", "拍照", "艺术"]) and poi.category == "culture":
                score += 18
            if any(keyword in message for keyword in ["逛", "亲子", "带娃"]) and poi.category in {"shopping", "entertainment"}:
                score += 18
            if any(keyword in message for keyword in ["少排队", "不排队", "不太排队"]) and poi.queue_minutes <= 8:
                score += 12
            if any(keyword in message for keyword in ["安静", "聊天", "不吵"]) and any(tag in searchable for tag in ["安静", "可坐久", "桌距舒服"]):
                score += 12
            for preference in profile["preferences"]:
                if preference in searchable or any(tag in preference for tag in poi.tags):
                    score += 4
            scored.append((score, poi))
        ranked = [poi for _, poi in sorted(scored, key=lambda item: item[0], reverse=True)]
        return ranked[: request.related_poi_limit]

    def _chat_answer(self, request: ChatRequest, related_pois: list[MockPoi], profile: dict[str, Any]) -> str:
        if not related_pois:
            return "附近暂时没有特别匹配的 Mock POI。我可以先按低排队、步行友好和评分稳定帮你排一条路线。"
        lead = related_pois[0]
        other_names = "、".join(poi.name for poi in related_pois[1:3])
        preference_hint = "、".join(self._used_preferences_for_chat(profile, related_pois)[:3])
        answer = (
            f"更推荐先看 {lead.name}：它在 {lead.area}，当前预估排队 {lead.queue_minutes} 分钟，"
            f"UGC 里比较突出的是「{lead.ugc_summary or '体验稳定'}」。"
        )
        if other_names:
            answer += f" 备选可以看 {other_names}。"
        if preference_hint:
            answer += f" 这次主要命中你的偏好：{preference_hint}。"
        answer += " 这只是普通 POI 问答，如果你想，我也可以把这些点排成完整路线。"
        return answer

    def _chat_answer_messages(
        self,
        request: ChatRequest,
        related_pois: list[MockPoi],
        profile: dict[str, Any],
    ) -> list[dict[str, str]]:
        poi_facts = [
            {
                "id": poi.id,
                "name": poi.name,
                "category": poi.category,
                "area": poi.area,
                "rating": poi.rating,
                "queue_minutes": poi.queue_minutes,
                "tags": poi.tags[:6],
                "avg_price": poi.avg_price,
                "ugc_summary": poi.ugc_summary,
                "risk_notes": poi.risk_notes[:3],
            }
            for poi in related_pois
        ]
        return [
            {
                "role": "system",
                "content": (
                    "你是 DZUltra 的 ChatAnswerAgent。只基于给定 POI facts 和用户偏好回答，"
                    "不能编造距离、营业、天气、推荐菜或不存在的门店。回答用中文，直接、短、适合移动端。"
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "message": request.message,
                        "city": request.city,
                        "preferences": profile.get("preferences", []),
                        "avoidances": profile.get("avoidances", []),
                        "poi_facts": poi_facts,
                        "response_contract": {
                            "must_include": ["首选 POI", "1-2 个备选", "为什么匹配", "可转路线规划提示"],
                            "max_sentences": 4,
                        },
                    },
                    ensure_ascii=False,
                ),
            },
        ]

    def _llm_content(self, payload: dict[str, Any]) -> str:
        return payload.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

    def _used_preferences_for_chat(self, profile: dict[str, Any], related_pois: list[MockPoi]) -> list[str]:
        searchable = " ".join(
            tag
            for poi in related_pois
            for tag in [*poi.tags, *poi.platform_badges, *poi.service_options]
        )
        return [
            preference
            for preference in profile["preferences"]
            if preference in searchable or any(tag in preference for poi in related_pois for tag in poi.tags)
        ]

    def _agent_label(self, agent: str) -> str:
        return {
            "ConstraintDiscoveryAgent": "意图理解",
            "UserPreferenceAgent": "用户画像",
            "ContextGroundingAgent": "事实落地",
            "PlanEvaluatorAgent": "约束校验",
            "PlanExplanationAgent": "体验解释",
            "ChatAnswerAgent": "普通问答",
        }.get(agent, agent)

    def _tool_label(self, tool_name: str) -> str:
        return {
            "mock_intent_parser": "意图解析工具",
            "mock_user_profile_lookup": "画像读取工具",
            "mock_poi_search": "POI/UGC 检索工具",
            "provider_adapter.poi_search": "Provider POI 检索",
            "mock_ugc_ranker": "点评摘要排序工具",
            "provider_adapter.mock_deep_poi_enrichment": "本地深度 POI 数据",
            "mock_map_provider.route_matrix": "地图距离工具",
            "provider_adapter.route_matrix": "Provider 地图距离",
            "mock_constraint_checker": "约束检查工具",
            "mock_experience_copywriter": "体验文案工具",
            "mock_chat_answer": "普通问答工具",
            "mock_chat_poi_search": "问答 POI 检索工具",
        }.get(tool_name, tool_name)

    def _clarification_cards(self, request: RoutePlanRequest) -> list[ClarificationCard]:
        cards: list[ClarificationCard] = []
        goal = request.goal
        if not any(keyword in goal for keyword in ["1人", "2人", "3人", "四人", "两人", "约会"]):
            cards.append(
                ClarificationCard(
                    id="clarify-people",
                    question="这次几个人出行？",
                    field="people",
                    options=["2 人", "1 人", "3-4 人"],
                    default_value="2 人",
                    blocks_planning=False,
                    reason="人数会影响餐厅预订、座位和排队风险。",
                )
            )
        if "辣" not in goal and "川菜" not in goal:
            cards.append(
                ClarificationCard(
                    id="clarify-taste",
                    question="口味上有什么需要避开的？",
                    field="taste",
                    options=["不吃辣", "微辣可以", "都可以"],
                    default_value="都可以",
                    blocks_planning=False,
                    reason="口味偏好会影响餐饮 POI 的替换规则。",
                )
            )
        return cards[:2]

    def _apply_refinement(self, base_plan: RoutePlan, request: RouteRefineRequest) -> tuple[RoutePlan, RefinementDiff]:
        instruction = request.instruction
        poi_by_id = poi_lookup()
        stops = [stop.model_copy(deep=True) for stop in base_plan.stops]
        changes: list[RefinementChange] = []
        strategy = "copy_update"

        target_category = None
        tag_preferences: list[str] = []
        if "川菜" in instruction or "辣" in instruction:
            target_category = "food"
            tag_preferences = ["川菜", "重口味", "火锅", "云南菜"]
        elif "咖啡" in instruction:
            target_category = "dessert"
            tag_preferences = ["咖啡", "甜品"]
        elif "书店" in instruction or "安静" in instruction:
            target_category = "culture"
            tag_preferences = ["安静", "小众展", "拍照"]

        locked_ids = set(self._locked_poi_ids(base_plan, instruction))
        if target_category is not None:
            for index, stop in enumerate(stops):
                if stop.poi_id in locked_ids:
                    changes.append(
                        RefinementChange(
                            type="kept",
                            stop_index=index,
                            before_poi_id=stop.poi_id,
                            after_poi_id=stop.poi_id,
                            reason="用户要求保留这一站。",
                        )
                    )
                    continue
                replacement = self._replacement_poi(
                    poi_by_id=poi_by_id,
                    target_category=target_category,
                    current_poi_id=stop.poi_id,
                    tag_preferences=tag_preferences,
                )
                if stop.category == target_category and replacement is not None:
                    stops[index] = stop.model_copy(
                        update={
                            "poi_id": replacement.id,
                            "poi_name": replacement.name,
                            "duration_minutes": replacement.visit_duration_minutes or stop.duration_minutes,
                            "reason": f"按用户微调改为 {replacement.name}：{replacement.ugc_summary} 当前预估排队 {replacement.queue_minutes} 分钟。",
                            "category": replacement.category,
                            "area": replacement.area,
                            "rating": replacement.rating,
                            "avg_price": replacement.avg_price,
                            "queue_minutes": replacement.queue_minutes,
                            "tags": replacement.tags,
                            "ugc_summary": replacement.ugc_summary,
                            "actions": [],
                        },
                        deep=True,
                    )
                    changes.append(
                        RefinementChange(
                            type="replaced",
                            stop_index=index,
                            before_poi_id=stop.poi_id,
                            after_poi_id=replacement.id,
                            reason=f"用户提到“{instruction}”，局部替换同类 POI。",
                        )
                    )
                    strategy = "local_replace"
                    break

        if "先" in instruction and "甜品" in instruction:
            dessert_index = next((index for index, stop in enumerate(stops) if stop.category == "dessert"), None)
            if dessert_index is not None and dessert_index != 0:
                moved = stops.pop(dessert_index)
                stops.insert(0, moved)
                for index, stop in enumerate(stops):
                    stops[index] = stop.model_copy(update={"start_time": ["14:20", "15:45", "17:35"][index]}, deep=True)
                changes.append(RefinementChange(type="reordered", reason="用户希望甜品提前，已重排站点顺序。"))
                strategy = "local_reorder"

        if not changes:
            changes.append(
                RefinementChange(
                    type="updated_copy",
                    reason="未命中明确 POI 替换规则，先保留路线并更新推荐理由说明。",
                )
            )

        refined_plan = base_plan.model_copy(
            update={
                "title": f"{base_plan.title}（已微调）",
                "score": min(100, base_plan.score + (1 if strategy != "copy_update" else 0)),
                "stops": stops,
                "highlights": list(dict.fromkeys([*base_plan.highlights, "已按你的要求局部调整"])),
            },
            deep=True,
        )
        diff = RefinementDiff(
            instruction=instruction,
            base_trace_id=request.trace_id,
            base_route_id=request.route_id,
            strategy=strategy,  # type: ignore[arg-type]
            changes=changes,
        )
        return refined_plan, diff

    def _locked_poi_ids(self, base_plan: RoutePlan, instruction: str) -> list[str]:
        locked = []
        if "保留第一个" in instruction or "保留第一" in instruction:
            locked.append(base_plan.stops[0].poi_id)
        if "保留第二个" in instruction or "保留第二" in instruction:
            locked.append(base_plan.stops[1].poi_id)
        if "保留第三个" in instruction or "保留第三" in instruction:
            locked.append(base_plan.stops[2].poi_id)
        return locked

    def _replacement_poi(
        self,
        poi_by_id: dict[str, Any],
        target_category: str,
        current_poi_id: str,
        tag_preferences: list[str],
    ) -> Any | None:
        candidates = [
            poi
            for poi in poi_by_id.values()
            if poi.category == target_category and poi.id != current_poi_id
        ]
        if not candidates:
            return None

        def score(poi: Any) -> tuple[int, float, int]:
            tag_hit_count = sum(1 for tag in tag_preferences if tag in poi.tags)
            return (tag_hit_count, poi.rating, -poi.queue_minutes)

        return sorted(candidates, key=score, reverse=True)[0]
