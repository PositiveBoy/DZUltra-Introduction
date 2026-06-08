from collections import defaultdict

from app.data.mock_data import MOCK_POIS, MOCK_USERS, SAMPLE_ROUTE
from app.models.schemas import (
    MapPoint,
    MockPoi,
    MockUser,
    PoiAction,
    RouteConstraint,
    RoutePlan,
    RouteStop,
    TodoItem,
    TransportOption,
)


DEFAULT_USER = MockUser(
    id="anonymous",
    name="匿名低排队用户",
    scenario="希望路线稳定、少排队、移动成本低",
    preferences=["低排队", "步行友好", "约会氛围"],
    avoidances=["热门长队", "跨城移动"],
)


def mock_intent_parser(goal: str, city: str, constraints: list[str]) -> dict:
    normalized = goal.lower()
    required_categories = []
    no_food = any(keyword in goal for keyword in ["不吃", "不安排吃", "不吃任何"])
    if not no_food and any(keyword in goal for keyword in ["吃", "饭", "餐", "bistro"]):
        required_categories.append("food")
    if any(keyword in goal for keyword in ["展", "艺术", "文化", "博物"]):
        required_categories.append("culture")
    if not no_food and any(keyword in goal for keyword in ["甜品", "咖啡", "喝"]):
        required_categories.append("dessert")
    if any(keyword in goal for keyword in ["商场", "购物", "逛街", "少走路", "带娃", "孩子"]):
        required_categories.append("shopping")
    if any(keyword in goal for keyword in ["公园", "玩", "亲子"]):
        required_categories.append("entertainment")

    fallback_categories = ["culture", "shopping", "entertainment"] if no_food else ["food", "culture", "dessert"]
    for fallback_category in fallback_categories:
        if len(required_categories) >= 3:
            break
        if fallback_category not in required_categories:
            required_categories.append(fallback_category)

    preferences = []
    if "不想排队" in goal or "低排队" in constraints:
        preferences.append("低排队")
    if "约会" in goal:
        preferences.append("约会氛围")
    if any(keyword in goal for keyword in ["带娃", "孩子", "亲子"]):
        preferences.append("亲子友好")
    if any(keyword in goal for keyword in ["拍照", "好拍"]):
        preferences.append("可拍照")
    if any(keyword in goal for keyword in ["少走", "别太累", "轻松"]):
        preferences.append("移动距离短")
    elif "步行" in goal or "少走" not in goal:
        preferences.append("步行友好")

    return {
        "city": city or "北京",
        "time_window": "14:00-18:30" if "下午" in goal or "pm" in normalized else "12:00-18:00",
        "is_today": "今天" in goal or "今日" in goal,
        "route_theme": "低排队约会路线" if "约会" in goal else "本地多 POI 路线",
        "required_categories": required_categories,
        "preferences": list(dict.fromkeys(preferences + constraints)),
        "hard_constraints": [
            *(["queue_minutes<=10"] if "不想排队" in goal or "低排队" in constraints else []),
            "same_day_booking_feasible" if "今天" in goal or "今日" in goal else "booking_feasible",
        ],
        "implicit_constraints": ["移动距离短", "餐饮与体验串联"],
    }


def mock_user_profile_lookup(user_id: str, intent: dict) -> dict:
    user = next((item for item in MOCK_USERS if item.id == user_id), DEFAULT_USER)
    preferences = list(dict.fromkeys(user.preferences + intent["preferences"]))
    priority_weights = user.priority_weights or {
        "queue": 0.34 if "低排队" in preferences else 0.24,
        "rating": 0.22,
        "category_coverage": 0.24,
        "experience_fit": 0.20,
    }
    return {
        "user_id": user.id,
        "name": user.name,
        "scenario": user.scenario,
        "city": user.city or intent["city"],
        "time_window": user.time_window or intent["time_window"],
        "budget_per_person": user.budget_per_person or 300,
        "transport_preference": user.transport_preference,
        "preferences": preferences,
        "avoidances": user.avoidances,
        "priority_weights": priority_weights,
        "explain_focus": user.explain_focus,
    }


def mock_poi_search(intent: dict, profile: dict, weather_constraints: dict | None = None) -> dict:
    candidates_by_category: dict[str, list[dict]] = defaultdict(list)
    rejected = []

    # Extract weather constraint flags
    high_precipitation = False
    extreme_temperature = False
    good_weather = False
    if weather_constraints:
        high_precipitation = weather_constraints.get("high_precipitation", False)
        extreme_temperature = weather_constraints.get("extreme_temperature", False)
        good_weather = weather_constraints.get("good_weather", False)

    outdoor_categories = {"entertainment"}  # outdoor/park-like categories
    indoor_categories = {"food", "culture", "shopping", "dessert"}

    for poi in MOCK_POIS:
        booking_violation = _advance_booking_violation(poi, intent)
        if booking_violation:
            rejected.append({"poi_id": poi.id, "reason": booking_violation, "score": 0})
            continue
        preference_hits = _preference_hits(poi, profile["preferences"])
        avoidance_hits = _avoidance_hits(poi, profile["avoidances"], queue_limit=10)
        budget_bonus = 4 if poi.avg_price is not None and poi.avg_price <= profile["budget_per_person"] else 0
        score = int(poi.rating * 10) + max(0, 12 - poi.queue_minutes) + len(preference_hits) * 5
        score += budget_bonus - len(avoidance_hits) * 8

        # Weather constraint: penalize outdoor POIs when precipitation is high
        weather_penalty_reason = None
        if high_precipitation and poi.category in outdoor_categories:
            score -= 8
            weather_penalty_reason = "降水概率较高，室外 POI 降权 -8 分"
        if high_precipitation and poi.category in indoor_categories:
            score += 2  # slight boost for indoor when rain expected
        if extreme_temperature and poi.category in outdoor_categories:
            score -= 4
            weather_penalty_reason = (weather_penalty_reason or "") + "；极端温度，室外 POI 降权 -4 分"
        if good_weather and poi.category in outdoor_categories:
            score += 2

        selected_reason = poi.decision_signals.get("selected_reason")
        reason = selected_reason or f"命中 {poi.category}，排队 {poi.queue_minutes} 分钟，标签：{', '.join(poi.tags)}。"
        if weather_penalty_reason:
            reason = f"{reason} {weather_penalty_reason}。"

        candidate = {
            "poi": poi.model_dump(),
            "score": score,
            "reason": reason,
            "preference_hits": preference_hits,
            "avoidance_hits": avoidance_hits,
            "weather_penalty": weather_penalty_reason,
        }
        candidates_by_category[poi.category].append(candidate)
        if poi.category not in intent["required_categories"]:
            rejected.append({"poi_id": poi.id, "reason": "类别不在本次核心路线需求中。", "score": score})

    selected = []
    for category in intent["required_categories"]:
        ranked = sorted(candidates_by_category[category], key=lambda item: item["score"], reverse=True)
        if ranked:
            selected.append(ranked[0])
            for lower_ranked in ranked[1:3]:
                poi = MockPoi(**lower_ranked["poi"])
                queue_reason = poi.decision_signals.get("queue_reason")
                rejected.append(
                    {
                        "poi_id": poi.id,
                        "reason": queue_reason
                        or f"同类候选得分较低，排队 {poi.queue_minutes} 分钟，未优先进入主路线。",
                        "score": lower_ranked["score"],
                    }
                )

    # If all candidates are outdoor and precipitation is high, add weather warning
    all_outdoor = all(
        MockPoi(**c["poi"]).category in outdoor_categories
        for c in selected
    )
    weather_warning = None
    if high_precipitation and all_outdoor and selected:
        weather_warning = "建议关注天气变化"

    fallback_used = len(selected) < len(intent["required_categories"])
    if len(selected) < 3:
        available_pois = [poi for poi in MOCK_POIS if not _advance_booking_violation(poi, intent)]
        selected = [
            {"poi": poi.model_dump(), "score": 90, "reason": "路线模板兜底 POI。", "preference_hits": poi.tags, "weather_penalty": None}
            for poi in available_pois
        ]

    return {
        "candidates": selected,
        "candidate_pool": {
            category: sorted(items, key=lambda item: item["score"], reverse=True)
            for category, items in candidates_by_category.items()
        },
        "rejected": rejected,
        "candidate_count": len(selected),
        "fallback_used": fallback_used,
        "weather_warning": weather_warning,
    }


def mock_route_scheduler(
    candidates: list[dict],
    route_theme: str,
    time_window: str = "14:00-18:30",
    group_size: int = 1,
) -> RoutePlan:
    stops, total_minutes = _scheduled_stops_for_candidates(candidates[:3], time_window, group_size)

    if len(stops) < 3:
        sample_route = SAMPLE_ROUTE.model_copy(deep=True)
        return sample_route.model_copy(update={"todo_items": _todo_items_for_stops(sample_route.stops)}, deep=True)

    return RoutePlan(
        id="route-deterministic-001",
        title=route_theme,
        subtitle="适合下午半日的稳定路线",
        theme="date-low-queue",
        badge="低排队",
        score=0,
        total_minutes=total_minutes,
        highlights=[],
        map_points=_map_points_for(stops),
        transport_summary="步行 + 短程打车，整体移动压力低",
        transports=_default_transports(),
        stops=stops,
        constraints=[],
        todo_items=_todo_items_for_stops(stops),
    )


def mock_constraint_checker(route: RoutePlan, intent: dict, profile: dict, retrieval: dict | None = None) -> dict:
    poi_by_id = poi_lookup(retrieval)
    route_pois = [poi_by_id[stop.poi_id] for stop in route.stops if stop.poi_id in poi_by_id]
    avg_queue = sum(poi.queue_minutes for poi in route_pois) / max(len(route_pois), 1)
    total_avg_price = sum(poi.avg_price or 0 for poi in route_pois)
    categories = {poi.category for poi in route_pois}
    category_labels = {
        "food": "餐饮",
        "culture": "文化",
        "dessert": "甜品/饮品",
        "shopping": "购物/商场",
        "entertainment": "休闲娱乐",
    }
    required_category_labels = [
        category_labels.get(category, category)
        for category in intent["required_categories"]
    ]
    queue_limit = 10 if "queue_minutes<=10" in intent["hard_constraints"] else 15
    business_issues = []
    closed_statuses = {"已关停", "暂停营业", "已歇业", "永久关闭"}
    for stop in route.stops:
        poi = poi_by_id.get(stop.poi_id)
        if poi is None:
            continue
        if poi.business_status and poi.business_status in closed_statuses:
            business_issues.append(f"{poi.name} 当前状态为 {poi.business_status}")
        elif not _is_open_for_stop(poi, stop):
            business_issues.append(
                f"{poi.name} 到达 {stop.start_time}、停留 {stop.duration_minutes} 分钟可能超出营业时间 {poi.open_hours}"
            )
    avoidance_hits = sorted(
        {
            avoidance
            for poi in route_pois
            for avoidance in profile["avoidances"]
            if avoidance in poi.tags or (avoidance == "热门长队" and poi.queue_minutes > queue_limit)
        }
    )
    booking_issues = [
        issue
        for poi in route_pois
        if (issue := _advance_booking_violation(poi, intent))
    ]

    constraints = [
        RouteConstraint(
            key="queue",
            label="平均排队",
            satisfied=avg_queue <= queue_limit,
            detail=f"三处 POI 平均排队 {avg_queue:.1f} 分钟，低于 {queue_limit} 分钟阈值。",
        ),
        RouteConstraint(
            key="poi_category",
            label="POI 类型覆盖",
            satisfied=set(intent["required_categories"]).issubset(categories),
            detail=f"覆盖{'、'.join(required_category_labels)}，满足本次核心 POI 类型需求。",
        ),
        RouteConstraint(
            key="business_hours",
            label="营业时间",
            satisfied=not business_issues,
            detail="所有站点在计划到达时均处于营业状态。"
            if not business_issues
                else f"这些站点需要注意：{'；'.join(business_issues)}。",
        ),
        RouteConstraint(
            key="booking_readiness",
            label="预约/购票可执行",
            satisfied=not booking_issues,
            detail="站点都能满足本次计划的预约或购票提前量。"
            if not booking_issues
            else f"这些站点今天来不及安排：{'；'.join(booking_issues)}。",
        ),
        RouteConstraint(
            key="budget",
            label="人均预算",
            satisfied=total_avg_price <= profile["budget_per_person"],
            detail=f"三站原价总人均约 {total_avg_price} 元，用户路线预算 {profile['budget_per_person']} 元。",
        ),
        RouteConstraint(
            key="route_size",
            label="路线规模",
            satisfied=len(route.stops) >= 3,
            detail=f"路线包含 {len(route.stops)} 个 POI。",
        ),
        RouteConstraint(
            key="avoidance",
            label="避雷偏好",
            satisfied=not avoidance_hits,
            detail="未命中用户避雷点。" if not avoidance_hits else f"命中避雷点：{', '.join(avoidance_hits)}。",
        ),
    ]
    return {
        "constraints": constraints,
        "blocking_issues": [item.detail for item in constraints if not item.satisfied],
        "soft_warnings": [],
    }


def mock_experience_copywriter(route: RoutePlan, retrieval: dict, constraints: list[RouteConstraint]) -> RoutePlan:
    poi_by_id = poi_lookup(retrieval)
    reason_items = list(retrieval.get("candidates", []))
    for pool_items in retrieval.get("candidate_pool", {}).values():
        reason_items.extend(pool_items)
    reason_by_id = {item["poi"]["id"]: item for item in reason_items}
    rewritten_stops = []
    for stop in route.stops:
        poi = poi_by_id.get(stop.poi_id)
        if poi is None:
            rewritten_stops.append(
                stop.model_copy(
                    update={
                        "reason": stop.reason or "该站来自当前候选事实包，但缺少可展开的深度字段。"
                    },
                    deep=True,
                )
            )
            continue
        hits = reason_by_id.get(stop.poi_id, {}).get("preference_hits", [])
        hit_text = f"，命中{','.join(hits)}" if hits else ""
        signal = poi.decision_signals.get("user_fit") or poi.ugc_summary
        rewritten_stops.append(
            stop.model_copy(
                update={
                    "reason": f"{signal}{hit_text}，当前预估排队 {poi.queue_minutes} 分钟。"
                }
            )
        )

    satisfied_labels = [item.label for item in constraints if item.satisfied]
    # Preserve original badge and title from the variant definition
    original_badge = route.badge or "推荐"
    original_title = route.title or "低排队约会路线"
    return route.model_copy(
        update={
            "title": original_title,
            "subtitle": "吃饭、看展、甜品顺路串联",
            "badge": original_badge,
            "highlights": ["平均排队小于 10 分钟", "餐饮 + 文化 + 甜品", "移动距离短", *satisfied_labels[:2]],
            "stops": rewritten_stops,
            "constraints": constraints,
        },
        deep=True,
    )


def mock_plan_evaluator(
    candidate_plans: list[RoutePlan],
    retrieval: dict,
    intent: dict,
    profile: dict,
    primary_score: int,
    candidate_summaries: list[dict] | None = None,
    weather_constraints: dict | None = None,
) -> dict:
    """Evaluate candidate routes, score them, and select top 3 diverse plans.

    Returns:
        dict with keys:
        - final_plans: list[RoutePlan] – top 3 scored and explained plans
        - rejected_routes: list[dict] – eliminated candidates with reasons
        - evaluation_notes: dict – evaluator metadata for Trace
    """
    scored_plans: list[RoutePlan] = []
    rejected_routes: list[dict] = []

    for plan in candidate_plans:
        constraint_result = mock_constraint_checker(plan, intent, profile, retrieval)
        constraints = constraint_result["constraints"]
        blocking_issues = constraint_result["blocking_issues"]

        # Hard constraint violation check
        hard_violations = [
            c for c in constraints
            if not c.satisfied and c.key in {"business_hours", "booking_readiness"}
        ]
        if hard_violations:
            violation_reason = f"硬约束违反：{'；'.join(c.detail for c in hard_violations)}"
            rejected_routes.append({
                "route_id": plan.id,
                "reason": violation_reason,
                "rejected_route_reason": violation_reason,
                "score": plan.score,
            })
            continue

        # No-food constraint: reject plans with food/dessert when user doesn't want them
        no_food = "food" not in intent.get("required_categories", []) and "dessert" not in intent.get("required_categories", [])
        if no_food:
            plan_categories = {stop.category for stop in plan.stops if stop.category}
            if "food" in plan_categories or "dessert" in plan_categories:
                no_food_reason = "用户不需要餐饮，但方案包含 food/dessert 类 POI。"
                rejected_routes.append({
                    "route_id": plan.id,
                    "reason": no_food_reason,
                    "rejected_route_reason": no_food_reason,
                    "score": plan.score,
                })
                continue

        explained_plan = mock_experience_copywriter(plan, retrieval, constraints)
        judgement = mock_route_judge(explained_plan, constraints, profile, weather_constraints)
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

    # Sort by score descending
    scored_plans.sort(key=lambda p: (p.score, -p.total_minutes), reverse=True)

    # Diversity selection: pick top 3 with different style_tags
    style_map: dict[str, RoutePlan] = {}
    for summary in (candidate_summaries or []):
        style_map[summary["id"]] = summary.get("style_tag", "balanced")

    final_plans: list[RoutePlan] = []
    used_styles: set[str] = set()

    # First pass: pick highest-scored plan per unique style
    for plan in scored_plans:
        style = style_map.get(plan.id, "balanced")
        if style not in used_styles:
            final_plans.append(plan)
            used_styles.add(style)
        if len(final_plans) >= 3:
            break

    # Second pass: fill remaining slots if not enough unique styles
    if len(final_plans) < 3:
        for plan in scored_plans:
            if plan not in final_plans:
                final_plans.append(plan)
            if len(final_plans) >= 3:
                break

    # Safety net: if all candidates were rejected by hard constraints,
    # fall back to the highest-scored plan so the user always gets a result.
    if not final_plans and scored_plans:
        final_plans.append(scored_plans[0])

    # Reject remaining scored plans that didn't make top 3
    final_ids = {p.id for p in final_plans}
    for plan in scored_plans:
        if plan.id not in final_ids:
            reject_reason = f"评分 {plan.score} 低于已选方案，且风格与已选方案重叠。"
            rejected_routes.append({
                "route_id": plan.id,
                "reason": reject_reason,
                "rejected_route_reason": reject_reason,
                "score": plan.score,
            })

    evaluation_notes = {
        "candidates_evaluated": len(candidate_plans),
        "final_plan_count": len(final_plans),
        "rejected_count": len(rejected_routes),
        "selected_styles": list(used_styles),
        "diversity_enforced": len(used_styles) >= 2,
    }

    return {
        "final_plans": final_plans,
        "rejected_routes": rejected_routes,
        "evaluation_notes": evaluation_notes,
    }


def mock_route_judge(route: RoutePlan, constraints: list[RouteConstraint], profile: dict, weather_constraints: dict | None = None) -> dict:
    """Score a route across 10 explainable dimensions.

    Dimensions and max points:
        hard_constraint  15  – business_hours & booking_readiness satisfied
        queue            15  – average queue vs user limit
        business_hours   10  – all stops open during planned arrival
        traffic           8  – time-of-day traffic suitability
        weather_fit      10  – weather compatibility (based on actual weather data)
        preference_fit   12  – user preference tag hits
        ugc_quality       8  – UGC summary richness
        route_efficiency 10  – time-window utilization
        budget            8  – total price vs budget
        diversity         6  – category coverage
    """
    constraint_by_key = {c.key: c for c in constraints}

    # --- hard_constraint (0-15) ---
    hard_keys = {"business_hours", "booking_readiness"}
    hard_satisfied = all(
        constraint_by_key[k].satisfied for k in hard_keys if k in constraint_by_key
    )
    hard_constraint_score = 15 if hard_satisfied else 0

    # --- queue (0-15) ---
    avg_queue = sum(s.queue_minutes or 0 for s in route.stops) / max(len(route.stops), 1)
    queue_limit = 10 if "低排队" in profile.get("preferences", []) else 15
    if avg_queue <= 5:
        queue_score = 15
    elif avg_queue <= queue_limit:
        queue_score = 12
    elif avg_queue <= queue_limit + 5:
        queue_score = 8
    else:
        queue_score = 4

    # --- business_hours (0-10) ---
    bh_constraint = constraint_by_key.get("business_hours")
    business_hours_score = 10 if (bh_constraint and bh_constraint.satisfied) else 0

    # --- traffic (0-8) ---
    traffic_score = 6  # default moderate
    time_window = profile.get("time_window", "14:00-18:30")
    if "17:00" in time_window or "18:00" in time_window:
        traffic_score = 4  # rush hour penalty

    # --- weather_fit (0-10) ---
    outdoor_categories = {"entertainment"}
    indoor_categories = {"food", "culture", "shopping", "dessert"}
    high_precipitation = weather_constraints.get("high_precipitation", False) if weather_constraints else False
    extreme_temperature = weather_constraints.get("extreme_temperature", False) if weather_constraints else False
    good_weather = weather_constraints.get("good_weather", False) if weather_constraints else False

    has_outdoor_stop = any(s.category in outdoor_categories for s in route.stops)
    all_indoor = all(s.category in indoor_categories for s in route.stops if s.category)

    if high_precipitation and has_outdoor_stop:
        weather_fit_score = 2 if not all_indoor else 4
    elif high_precipitation and all_indoor:
        weather_fit_score = 8
    elif extreme_temperature and has_outdoor_stop:
        weather_fit_score = 4
    elif good_weather:
        weather_fit_score = 9 if has_outdoor_stop else 7
    else:
        weather_fit_score = 7

    # --- preference_fit (0-12) ---
    preference_hits = set()
    for stop in route.stops:
        for tag in (stop.tags or []):
            for pref in profile.get("preferences", []):
                if pref in tag or tag in pref:
                    preference_hits.add(pref)
    hit_count = len(preference_hits)
    if hit_count >= 3:
        preference_fit_score = 12
    elif hit_count == 2:
        preference_fit_score = 9
    elif hit_count == 1:
        preference_fit_score = 6
    else:
        preference_fit_score = 3

    # --- ugc_quality (0-8) ---
    ugc_present = sum(1 for s in route.stops if s.ugc_summary)
    ugc_ratio = ugc_present / max(len(route.stops), 1)
    if ugc_ratio >= 0.9:
        ugc_quality_score = 8
    elif ugc_ratio >= 0.6:
        ugc_quality_score = 6
    else:
        ugc_quality_score = 4

    # --- route_efficiency (0-10) ---
    total_minutes = route.total_minutes
    try:
        parts = time_window.split("-")
        start_h, start_m = parts[0].strip().split(":")
        end_h, end_m = parts[1].strip().split(":")
        available = (int(end_h) * 60 + int(end_m)) - (int(start_h) * 60 + int(start_m))
    except (ValueError, IndexError):
        available = 270
    utilization = total_minutes / max(available, 1)
    if 0.55 <= utilization <= 0.85:
        route_efficiency_score = 10
    elif 0.4 <= utilization <= 0.95:
        route_efficiency_score = 7
    else:
        route_efficiency_score = 4

    # --- budget (0-8) ---
    total_price = sum(s.avg_price or 0 for s in route.stops)
    budget_limit = profile.get("budget_per_person", 300)
    if total_price <= budget_limit:
        budget_score = 8
    elif total_price <= budget_limit * 1.2:
        budget_score = 5
    else:
        budget_score = 2

    # --- diversity (0-6) ---
    categories = {s.category for s in route.stops if s.category}
    if len(categories) >= 3:
        diversity_score = 6
    elif len(categories) == 2:
        diversity_score = 4
    else:
        diversity_score = 2

    score_breakdown = {
        "hard_constraint": hard_constraint_score,
        "queue": queue_score,
        "business_hours": business_hours_score,
        "traffic": traffic_score,
        "weather_fit": weather_fit_score,
        "preference_fit": preference_fit_score,
        "ugc_quality": ugc_quality_score,
        "route_efficiency": route_efficiency_score,
        "budget": budget_score,
        "diversity": diversity_score,
    }
    score = min(100, sum(score_breakdown.values()))

    # Build decision summary from top-scoring dimensions
    top_dims = sorted(score_breakdown.items(), key=lambda x: x[1], reverse=True)[:3]
    dim_labels = {
        "hard_constraint": "硬约束",
        "queue": "排队",
        "business_hours": "营业时间",
        "traffic": "交通",
        "weather_fit": "天气适配",
        "preference_fit": "偏好匹配",
        "ugc_quality": "UGC 质量",
        "route_efficiency": "路线效率",
        "budget": "预算",
        "diversity": "多样性",
    }
    top_summary = "、".join(f"{dim_labels.get(k, k)}{v}" for k, v in top_dims)
    decision_summary = f"主要加分项：{top_summary}。低排队和类别覆盖是核心优势，适合从一句话到路线的全过程。"

    return {
        "score": score,
        "score_breakdown": score_breakdown,
        "decision_summary": decision_summary,
        "priority_weights": profile["priority_weights"],
    }


def mock_multi_plan_builder(
    primary_plan: RoutePlan,
    retrieval: dict,
    constraints: list[RouteConstraint],
    time_window: str = "14:00-18:30",
    group_size: int = 1,
    required_categories: list[str] | None = None,
    route_matrix: dict | None = None,
) -> dict:
    """Generate 5-10 candidate routes, filter by time/route_matrix, and return
    both the surviving RoutePlan objects and solver metadata.

    Returns:
        dict with keys:
        - plans: list[RoutePlan] – surviving candidate plans (5-10 before evaluator)
        - candidate_plans: list[dict] – lightweight summaries of all candidates
        - solver_notes: dict – solver metadata for Trace
        - filtered_out: int – number of candidates removed by feasibility filter
    """
    pool = retrieval.get("candidate_pool", {})
    categories = required_categories or [stop.category for stop in primary_plan.stops if stop.category]
    all_variants = _generate_candidate_variants(categories)

    candidate_plans: list[dict] = []
    plans: list[RoutePlan] = []
    filtered_out = 0

    for variant in all_variants:
        selected_candidates = []
        fallback_stops = []
        candidate_rank = variant.get("candidate_rank", 0)
        candidate_ranks = variant.get("candidate_ranks", {})

        for index, category in enumerate(variant["category_order"]):
            candidates = pool.get(category) or []
            category_rank = candidate_ranks.get(category, candidate_rank)
            candidate = candidates[min(category_rank, len(candidates) - 1)] if candidates else None
            if candidate is None:
                fallback_stop = primary_plan.stops[min(index, len(primary_plan.stops) - 1)]
                fallback_stops.append(fallback_stop.model_copy(deep=True))
                continue
            selected_candidates.append(candidate)

        if len(selected_candidates) == 3:
            stops, total_minutes = _scheduled_stops_for_candidates(selected_candidates, time_window, group_size)
        else:
            stops, total_minutes = _reschedule_existing_stops(
                [*fallback_stops, *primary_plan.stops[len(fallback_stops) : 3]],
                time_window,
            )

        # --- Feasibility filter ---
        feasible, filter_reason = _check_route_feasibility(
            stops, total_minutes, time_window, route_matrix, categories,
        )

        candidate_summary = {
            "id": variant["id"],
            "style_tag": variant.get("style_tag", "balanced"),
            "category_order": variant["category_order"],
            "candidate_ranks": candidate_ranks,
            "total_minutes": total_minutes,
            "feasible": feasible,
            "filter_reason": filter_reason,
        }
        candidate_plans.append(candidate_summary)

        if not feasible:
            filtered_out += 1
            continue

        plans.append(
            primary_plan.model_copy(
                update={
                    "id": variant["id"],
                    "title": variant["title"],
                    "subtitle": variant["subtitle"],
                    "theme": variant["theme"],
                    "badge": variant["badge"],
                    "score": max(0, primary_plan.score + variant["score_delta"]),
                    "total_minutes": total_minutes,
                    "stops": stops,
                    "map_points": _map_points_for(stops),
                    "transport_summary": "步行 + 短程打车，站点之间不做大跨度移动",
                    "transports": _default_transports(),
                    "constraints": constraints,
                    "todo_items": _todo_items_for_stops(stops),
                },
                deep=True,
            )
        )

    # Ensure at least 3 plans survive for the evaluator
    if len(plans) < 3:
        for variant in all_variants:
            if any(p.id == variant["id"] for p in plans):
                continue
            selected_candidates = []
            candidate_rank = variant.get("candidate_rank", 0)
            candidate_ranks = variant.get("candidate_ranks", {})
            for index, category in enumerate(variant["category_order"]):
                candidates = pool.get(category) or []
                category_rank = candidate_ranks.get(category, candidate_rank)
                candidate = candidates[min(category_rank, len(candidates) - 1)] if candidates else None
                if candidate:
                    selected_candidates.append(candidate)
            if len(selected_candidates) == 3:
                stops, total_minutes = _scheduled_stops_for_candidates(selected_candidates, time_window, group_size)
                plans.append(
                    primary_plan.model_copy(
                        update={
                            "id": variant["id"],
                            "title": variant["title"],
                            "subtitle": variant["subtitle"],
                            "theme": variant["theme"],
                            "badge": variant["badge"],
                            "score": max(0, primary_plan.score + variant["score_delta"]),
                            "total_minutes": total_minutes,
                            "stops": stops,
                            "map_points": _map_points_for(stops),
                            "transport_summary": "步行 + 短程打车，站点之间不做大跨度移动",
                            "transports": _default_transports(),
                            "constraints": constraints,
                            "todo_items": _todo_items_for_stops(stops),
                        },
                        deep=True,
                    )
                )
            if len(plans) >= 3:
                break

    no_food = "food" not in categories and "dessert" not in categories
    solver_notes = {
        "total_candidates_generated": len(all_variants),
        "candidates_after_filtering": len(plans),
        "filtered_out": filtered_out,
        "stop_slots": categories,
        "no_food_route": no_food,
        "style_distribution": {},
    }
    for cp in candidate_plans:
        style = cp.get("style_tag", "balanced")
        solver_notes["style_distribution"][style] = solver_notes["style_distribution"].get(style, 0) + 1

    return {
        "plans": plans,
        "candidate_plans": candidate_plans,
        "solver_notes": solver_notes,
        "filtered_out": filtered_out,
    }


def _check_route_feasibility(
    stops: list[RouteStop],
    total_minutes: int,
    time_window: str,
    route_matrix: dict | None,
    required_categories: list[str],
) -> tuple[bool, str | None]:
    """Check whether a candidate route is feasible given time and route_matrix constraints.

    Returns (feasible, filter_reason).  filter_reason is None when feasible.
    """
    route_start, route_end = _parse_window_minutes(time_window)
    available_minutes = route_end - route_start

    # Time window check
    if total_minutes > available_minutes:
        return False, f"总时长 {total_minutes} 分钟超出时间窗 {available_minutes} 分钟。"

    # Business hours check – reject if any stop clearly can't fit
    for stop in stops:
        if stop.duration_minutes < 15:
            return False, f"{stop.poi_name} 停留仅 {stop.duration_minutes} 分钟，不可行。"

    # Route matrix distance check – reject if any leg is excessively long
    if route_matrix and route_matrix.get("legs"):
        for leg in route_matrix["legs"]:
            distance = leg.get("distance_meters", 0)
            if distance > 30000:  # 30 km between consecutive stops is unreasonable
                return False, f"站点间距离 {distance}m 超过 30km，跨区移动过大。"

    # Category coverage check
    stop_categories = {stop.category for stop in stops if stop.category}
    missing = set(required_categories) - stop_categories
    # Only flag if missing hard categories (food/dessert when user wants food)
    if missing and not {"food", "dessert"}.issuperset(missing):
        return False, f"缺少必要类别：{', '.join(missing)}。"

    return True, None


def _variant_definitions(required_categories: list[str]) -> list[dict]:
    """Backward-compatible wrapper: delegates to _generate_candidate_variants
    and returns only the first 3 entries for callers that still expect 3 variants."""
    return _generate_candidate_variants(required_categories)[:3]


def _generate_candidate_variants(required_categories: list[str]) -> list[dict]:
    """Generate 5-10 candidate route variant definitions with style tags.

    Each variant specifies a category_order, candidate_ranks (which POI rank
    to pick from each category), a style_tag for diversity, and display metadata.
    """
    no_food = "food" not in required_categories and "dessert" not in required_categories
    base_order = list(dict.fromkeys(required_categories))
    fallback = ["culture", "shopping", "entertainment"] if no_food else ["food", "culture", "dessert", "shopping", "entertainment"]
    for cat in fallback:
        if len(base_order) >= 3:
            break
        if cat not in base_order:
            base_order.append(cat)
    base_order = base_order[:3]

    variants: list[dict] = []
    vid = 0

    def _add(style_tag: str, category_order: list[str], candidate_ranks: dict[str, int], score_delta: int) -> None:
        nonlocal vid
        title, subtitle, theme, badge = _style_display(style_tag, category_order, no_food)
        variants.append({
            "id": f"route-candidate-{vid:03d}",
            "title": title,
            "subtitle": subtitle,
            "theme": theme,
            "badge": badge,
            "score_delta": score_delta,
            "category_order": category_order,
            "candidate_rank": 0,
            "candidate_ranks": candidate_ranks,
            "style_tag": style_tag,
        })
        vid += 1

    # 1. Balanced / recommended – base order, top picks
    _add("balanced", base_order, {}, 0)

    # 2. Low-queue – same order, second-ranked POIs (often less crowded)
    _add("low_queue", base_order, {cat: 1 for cat in base_order}, -2)

    # 3. Photo / experience-first – culture slot first, prefer photo-friendly POIs
    photo_order = _reorder_first(base_order, "culture")
    _add("photo", photo_order, {"culture": 0}, -3)

    # 4. Budget-friendly – prefer cheaper POIs (higher rank = usually cheaper)
    _add("budget", base_order, {cat: min(2, len(_pool_hint(cat))) for cat in base_order}, -4)

    # 5. Easy-walk – reorder to minimise travel, second pick for shorter distances
    easy_order = _reorder_first(base_order, base_order[-1])
    _add("easy_walk", easy_order, {base_order[0]: 1}, -3)

    # 6. Reversed order – different pacing
    rev_order = list(reversed(base_order))
    if rev_order != base_order:
        _add("reversed", rev_order, {}, -5)

    # 7. Alternative picks – mix of first and second choices
    alt_ranks = {base_order[0]: 1, base_order[1]: 0, base_order[2]: 1} if len(base_order) == 3 else {cat: 1 for cat in base_order}
    _add("alternative", base_order, alt_ranks, -4)

    # 8. Culture-heavy – culture first, second culture pick if available
    culture_order = _reorder_first(base_order, "culture") if "culture" in base_order else base_order
    culture_ranks = {"culture": min(1, len(_pool_hint("culture")) - 1)} if "culture" in base_order else {}
    _add("culture_heavy", culture_order, culture_ranks, -6)

    return variants


def _style_display(style_tag: str, category_order: list[str], no_food: bool) -> tuple[str, str, str, str]:
    """Return (title, subtitle, theme, badge) for a given style tag."""
    category_labels = {"food": "餐饮", "culture": "文化", "dessert": "甜品", "shopping": "购物", "entertainment": "娱乐"}
    order_text = " + ".join(category_labels.get(c, c) for c in category_order)

    displays: dict[str, tuple[str, str, str, str]] = {
        "balanced": ("综合推荐路线", f"{order_text}顺路串联", "balanced", "推荐"),
        "low_queue": ("少排队路线", "优先选择等位短的门店", "low-queue", "少排队"),
        "photo": ("拍照体验路线", "小众文化点优先，留出更多拍照时间", "photo-culture", "好拍"),
        "budget": ("预算友好路线", "性价比高的选择，控制人均花费", "budget-friendly", "省钱"),
        "easy_walk": ("轻松少走路线", "站点紧凑，移动距离短", "easy-walk", "省心"),
        "reversed": ("倒序弹性路线", "从后往前安排，适合晚出发", "reversed", "弹性"),
        "alternative": ("备选组合路线", "同类候选搭配，方便临场替换", "alternative", "备选"),
        "culture_heavy": ("文化深度路线", "文化体验优先，沉浸式安排", "culture-heavy", "深度"),
    }
    return displays.get(style_tag, ("本地多 POI 路线", order_text, style_tag, "路线"))


def _reorder_first(order: list[str], category: str) -> list[str]:
    """Move *category* to the front of *order*, keeping relative order of others."""
    if category not in order:
        return order
    result = [category]
    for c in order:
        if c != category:
            result.append(c)
    return result


def _pool_hint(category: str) -> list[str]:
    """Return a placeholder list whose length hints at pool depth for ranking."""
    # Real pool sizes are only known at runtime; return a list of 3 to allow
    # candidate_ranks up to index 2 without IndexError.
    return [""] * 3


def poi_lookup(retrieval: dict | None = None) -> dict[str, MockPoi]:
    poi_by_id = {poi.id: poi for poi in MOCK_POIS}
    if not retrieval:
        return poi_by_id

    candidate_items = list(retrieval.get("candidates", []))
    for pool_items in retrieval.get("candidate_pool", {}).values():
        if isinstance(pool_items, list):
            candidate_items.extend(pool_items)

    for item in candidate_items:
        if not isinstance(item, dict) or not isinstance(item.get("poi"), dict):
            continue
        try:
            poi = MockPoi(**item["poi"])
        except (TypeError, ValueError):
            continue
        poi_by_id[poi.id] = poi
    return poi_by_id


def _scheduled_stops_for_candidates(
    candidates: list[dict],
    time_window: str,
    group_size: int,
) -> tuple[list[RouteStop], int]:
    if not candidates:
        return [], 0

    pois = [MockPoi(**candidate["poi"]) for candidate in candidates]
    durations = [_duration_for_poi(poi, group_size) for poi in pois]
    route_start, route_end = _parse_window_minutes(time_window)
    first_arrival = route_start + (20 if route_end - route_start >= 180 else 0)
    travel_gaps = [0, 20, 18, 15]
    travel_total = sum(travel_gaps[1 : len(pois)])
    available_minutes = max(90, route_end - first_arrival)
    required_minutes = sum(durations) + travel_total

    if required_minutes > available_minutes:
        reduce_each = max(0, (required_minutes - available_minutes + len(durations) - 1) // len(durations))
        durations = [max(35, duration - reduce_each) for duration in durations]

    current = first_arrival
    stops = []
    for index, (candidate, poi, duration) in enumerate(zip(candidates, pois, durations, strict=False)):
        if index > 0:
            current += travel_gaps[index]
        stops.append(_route_stop_from_poi(poi, _format_minutes(current), candidate["reason"], index, duration))
        current += duration

    return stops, current - first_arrival


def _reschedule_existing_stops(stops: list[RouteStop], time_window: str) -> tuple[list[RouteStop], int]:
    route_start, route_end = _parse_window_minutes(time_window)
    first_arrival = route_start + (20 if route_end - route_start >= 180 else 0)
    travel_gaps = [0, 20, 18, 15]
    current = first_arrival
    rescheduled = []
    for index, stop in enumerate(stops[:3]):
        if index > 0:
            current += travel_gaps[index]
        rescheduled.append(stop.model_copy(update={"start_time": _format_minutes(current)}, deep=True))
        current += stop.duration_minutes
    return rescheduled, current - first_arrival


def _duration_for_poi(poi: MockPoi, group_size: int) -> int:
    duration = poi.visit_duration_minutes or 60
    if poi.category == "food" and group_size >= 4:
        duration += 10
    if poi.category == "culture" and "拍照" in poi.tags:
        duration += 5
    return duration


def _parse_window_minutes(time_window: str) -> tuple[int, int]:
    try:
        start_raw, end_raw = time_window.split("-", maxsplit=1)
        start = _parse_clock_minutes(start_raw)
        end = _parse_clock_minutes(end_raw)
        if end <= start:
            return 14 * 60, 18 * 60
        return start, end
    except ValueError:
        return 14 * 60, 18 * 60


def _parse_clock_minutes(value: str) -> int:
    hour_raw, minute_raw = value.strip().split(":", maxsplit=1)
    return int(hour_raw) * 60 + int(minute_raw)


def _format_minutes(total_minutes: int) -> str:
    hour = total_minutes // 60
    minute = total_minutes % 60
    return f"{hour:02d}:{minute:02d}"


def _is_open_for_stop(poi: MockPoi, stop: RouteStop) -> bool:
    if not poi.open_hours:
        return True
    try:
        open_raw, close_raw = poi.open_hours.split("-", maxsplit=1)
        open_minutes = _parse_clock_minutes(open_raw)
        close_minutes = _parse_clock_minutes(close_raw)
        arrive_minutes = _parse_clock_minutes(stop.start_time)
        leave_minutes = arrive_minutes + stop.duration_minutes
        return open_minutes <= arrive_minutes and leave_minutes <= close_minutes
    except ValueError:
        return True


def _starts() -> list[str]:
    return ["14:20", "15:45", "17:35"]


def _preference_hits(poi: MockPoi, preferences: list[str]) -> list[str]:
    hits = []
    searchable_tags = [*poi.tags, *poi.platform_badges, *poi.service_options]
    for preference in preferences:
        if any(preference in tag or tag in preference for tag in searchable_tags):
            hits.append(preference)
    return sorted(set(hits))


def _avoidance_hits(poi: MockPoi, avoidances: list[str], queue_limit: int) -> list[str]:
    hits = []
    searchable_tags = [*poi.tags, *poi.risk_notes]
    for avoidance in avoidances:
        if avoidance == "热门长队" and poi.queue_minutes > queue_limit:
            hits.append(avoidance)
        elif any(avoidance in tag or tag in avoidance for tag in searchable_tags):
            hits.append(avoidance)
    return sorted(set(hits))


def _route_stop_from_poi(
    poi: MockPoi,
    start_time: str,
    reason: str,
    index: int,
    duration_minutes: int | None = None,
) -> RouteStop:
    return RouteStop(
        poi_id=poi.id,
        poi_name=poi.name,
        start_time=start_time,
        duration_minutes=duration_minutes or poi.visit_duration_minutes or 60,
        reason=reason,
        category=poi.category,
        area=poi.area,
        rating=poi.rating,
        avg_price=poi.avg_price,
        queue_minutes=poi.queue_minutes,
        tags=poi.tags,
        ugc_summary=poi.ugc_summary,
        distance_from_previous=["起点", "约 1.8 km", "约 2.4 km"][index],
        actions=_actions_for_poi(poi),
    )


def _actions_for_poi(poi: MockPoi) -> list[PoiAction]:
    actions = [
        PoiAction(id=f"{poi.id}-nav", label="导航", kind="navigate"),
        PoiAction(id=f"{poi.id}-queue", label="排队", kind="queue", disabled=poi.queue_minutes <= 5),
    ]
    if poi.category == "food":
        actions.append(PoiAction(id=f"{poi.id}-deal", label="团购", kind="deal"))
        actions.append(PoiAction(id=f"{poi.id}-book", label="预订", kind="book"))
    if poi.category == "culture":
        actions.append(PoiAction(id=f"{poi.id}-ticket", label="购票", kind="ticket"))
    return actions


def _advance_booking_violation(poi: MockPoi, intent: dict) -> str | None:
    if not intent.get("is_today"):
        return None
    if poi.advance_booking_hours < 24:
        return None
    requirement = f"需提前 {poi.advance_booking_hours // 24} 天预约/购票" if poi.advance_booking_hours % 24 == 0 else f"需提前 {poi.advance_booking_hours} 小时预约/购票"
    return f"{poi.name} {requirement}，但本次计划是今天进行，点仔应取消该 POI，不加入最终 plan。"


def _todo_items_for_stops(stops: list[RouteStop]) -> list[TodoItem]:
    return [_todo_item_for_stop(stop) for stop in stops[:3]]


def _todo_item_for_stop(stop: RouteStop) -> TodoItem:
    action_kind = _primary_action_kind_for_stop(stop)
    action_label = {
        "deal": "查看团购",
        "ticket": "购票",
        "book": "预订",
        "queue": "排号",
        "share": "分享",
        "navigate": "查看",
    }[action_kind]
    return TodoItem(
        id=f"todo-{action_kind}-{stop.poi_id}",
        stop_poi_id=stop.poi_id,
        label=f"{stop.poi_name} · {_todo_copy_for_stop(stop, action_kind)}",
        action_label=action_label,
        action_kind=action_kind,
        action_references=[_action_reference_for_stop(stop, action_kind)],
        constraints=_todo_constraints_for_stop(stop),
    )


def _primary_action_kind_for_stop(stop: RouteStop) -> str:
    if stop.category == "culture":
        return "ticket"
    if stop.category == "food":
        return "book"
    if stop.category == "shopping":
        return "share"
    if stop.category == "dessert":
        return "deal"
    return "navigate"


def _todo_copy_for_stop(stop: RouteStop, action_kind: str) -> str:
    copy_by_kind = {
        "ticket": "出发前确认当天可购票并完成买票",
        "book": "提前预约或备注座位，避免到店等待",
        "deal": "先看团购券，控制预算并减少现场决策",
        "share": "分享给同行人确认集合点",
        "queue": "到店前查看在线排号",
        "navigate": "出发前确认地址和营业状态",
    }
    return copy_by_kind[action_kind]


def _action_reference_for_stop(stop: RouteStop, action_kind: str) -> dict:
    image_url_by_kind = {
        "ticket": "/mock-reference-assets/todo-reference-art-ticket.png",
        "book": "/mock-reference-assets/todo-reference-bistro-deal.png",
        "deal": "/mock-reference-assets/todo-reference-dessert-deal.png",
        "queue": "/mock-reference-assets/todo-reference-japanese-queue.png",
        "share": "/mock-reference-assets/todo-reference-lakeside-walk.png",
        "navigate": "/mock-reference-assets/todo-reference-lakeside-walk.png",
    }
    type_by_kind = {
        "ticket": "ticket",
        "book": "booking",
        "deal": "deal",
        "queue": "booking",
        "share": "share",
        "navigate": "poi",
    }
    return {
        "id": f"ref-{stop.poi_id}-{action_kind}",
        "type": type_by_kind[action_kind],
        "title": stop.poi_name,
        "subtitle": stop.ugc_summary or stop.reason,
        "imageUrl": image_url_by_kind[action_kind],
        "price": f"人均 ¥{stop.avg_price}" if stop.avg_price else "免费",
        "distance": stop.distance_from_previous,
        "badge": {"ticket": "景点", "book": "预约", "deal": "团购", "queue": "排号", "share": "分享", "navigate": "POI"}[action_kind],
        "actionLabel": {"ticket": "买票", "book": "预订", "deal": "领券", "queue": "排号", "share": "分享", "navigate": "查看"}[action_kind],
        "actionKind": action_kind,
    }


def _todo_constraints_for_stop(stop: RouteStop) -> list[dict]:
    constraints = [
        {
            "id": f"{stop.poi_id}-arrival",
            "label": "到达时间",
            "detail": f"计划 {stop.start_time} 到达，停留 {stop.duration_minutes} 分钟。",
            "severity": "info",
            "satisfied": True,
        }
    ]
    if stop.category == "culture":
        constraints.append(
            {
                "id": f"{stop.poi_id}-ticket",
                "label": "购票约束",
                "detail": "已过滤需提前 1 天预约的展览；该站保留为当天可购票/可核销。",
                "severity": "required",
                "satisfied": True,
            }
        )
    if stop.category == "food":
        constraints.append(
            {
                "id": f"{stop.poi_id}-booking",
                "label": "预约提醒",
                "detail": "建议点仔在出发前提醒用户确认订位，降低到店等待。",
                "severity": "warning",
                "satisfied": True,
            }
        )
    return constraints


def _map_points_for(stops: list[RouteStop]) -> list[MapPoint]:
    coordinates = [(18, 68), (48, 38), (78, 58)]
    return [
        MapPoint(x=coordinates[index][0], y=coordinates[index][1], label=stop.poi_name[:2])
        for index, stop in enumerate(stops[:3])
    ]


def _default_transports() -> list[TransportOption]:
    return [
        TransportOption(mode="walk", label="步行优先", minutes=32, cost="0 元", detail="站点之间尽量短距离移动"),
        TransportOption(mode="taxi", label="短程打车", minutes=18, cost="约 38 元", detail="雨天或赶时间时更稳"),
        TransportOption(mode="metro", label="地铁备选", minutes=29, cost="约 8 元", detail="高峰期避免路面拥堵"),
    ]


def _default_todo_items() -> list[TodoItem]:
    return [
        TodoItem(id="todo-book-food", label="提前收藏第一站餐厅"),
        TodoItem(id="todo-ticket-culture", label="确认展览购票时间"),
        TodoItem(id="todo-share", label="把路线发给同行人确认"),
    ]
