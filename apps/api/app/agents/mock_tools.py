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


def mock_poi_search(intent: dict, profile: dict) -> dict:
    candidates_by_category: dict[str, list[dict]] = defaultdict(list)
    rejected = []

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
        selected_reason = poi.decision_signals.get("selected_reason")
        candidate = {
            "poi": poi.model_dump(),
            "score": score,
            "reason": selected_reason
            or f"命中 {poi.category}，排队 {poi.queue_minutes} 分钟，标签：{', '.join(poi.tags)}。",
            "preference_hits": preference_hits,
            "avoidance_hits": avoidance_hits,
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

    fallback_used = len(selected) < len(intent["required_categories"])
    if len(selected) < 3:
        available_pois = [poi for poi in MOCK_POIS if not _advance_booking_violation(poi, intent)]
        selected = [
            {"poi": poi.model_dump(), "score": 90, "reason": "路线模板兜底 POI。", "preference_hits": poi.tags}
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


def mock_constraint_checker(route: RoutePlan, intent: dict, profile: dict) -> dict:
    poi_by_id = {poi.id: poi for poi in MOCK_POIS}
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
    for stop in route.stops:
        poi = poi_by_id.get(stop.poi_id)
        if poi is None:
            continue
        if poi.business_status and poi.business_status != "营业中":
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
    poi_by_id = {poi.id: poi for poi in MOCK_POIS}
    reason_items = list(retrieval.get("candidates", []))
    for pool_items in retrieval.get("candidate_pool", {}).values():
        reason_items.extend(pool_items)
    reason_by_id = {item["poi"]["id"]: item for item in reason_items}
    rewritten_stops = []
    for stop in route.stops:
        poi = poi_by_id[stop.poi_id]
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
    return route.model_copy(
        update={
            "title": "低排队约会路线",
            "subtitle": "吃饭、看展、甜品顺路串联",
            "badge": "推荐",
            "highlights": ["平均排队小于 10 分钟", "餐饮 + 文化 + 甜品", "移动距离短", *satisfied_labels[:2]],
            "stops": rewritten_stops,
            "constraints": constraints,
        },
        deep=True,
    )


def mock_route_judge(route: RoutePlan, constraints: list[RouteConstraint], profile: dict) -> dict:
    satisfied_count = sum(1 for item in constraints if item.satisfied)
    constraint_score = int(satisfied_count / max(len(constraints), 1) * 36)
    queue_score = 30
    experience_score = 22 if all(stop.reason for stop in route.stops) else 14
    rating_score = 4
    score = min(100, constraint_score + queue_score + experience_score + rating_score)
    return {
        "score": score,
        "score_breakdown": {
            "constraint": constraint_score,
            "queue": queue_score,
            "experience": experience_score,
            "rating": rating_score,
        },
        "decision_summary": "低排队约束稳定满足，三类 POI 串联完整，适合 Hackathon Demo 展示从一句话到路线的全过程。",
        "priority_weights": profile["priority_weights"],
    }


def mock_multi_plan_builder(
    primary_plan: RoutePlan,
    retrieval: dict,
    constraints: list[RouteConstraint],
    time_window: str = "14:00-18:30",
    group_size: int = 1,
    required_categories: list[str] | None = None,
) -> list[RoutePlan]:
    pool = retrieval.get("candidate_pool", {})
    variants = _variant_definitions(required_categories or [stop.category for stop in primary_plan.stops if stop.category])
    plans = []
    for variant in variants:
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
    return plans


def _variant_definitions(required_categories: list[str]) -> list[dict]:
    base_order = list(dict.fromkeys(required_categories))
    for fallback_category in ["food", "culture", "dessert", "shopping", "entertainment"]:
        if len(base_order) >= 3:
            break
        if fallback_category not in base_order:
            base_order.append(fallback_category)
    base_order = base_order[:3]

    if base_order == ["food", "culture", "dessert"]:
        return [
            {
                "id": "route-deterministic-001",
                "title": "低排队约会路线",
                "subtitle": "吃饭、看展、甜品顺路串联",
                "theme": "date-low-queue",
                "badge": "推荐",
                "score_delta": 0,
                "category_order": ["food", "culture", "dessert"],
                "candidate_rank": 0,
            },
            {
                "id": "route-deterministic-002",
                "title": "拍照更稳路线",
                "subtitle": "小众文化点优先，留出更多拍照时间",
                "theme": "photo-culture",
                "badge": "好拍",
                "score_delta": -3,
                "category_order": ["culture", "dessert", "food"],
                "candidate_rank": 1,
                "candidate_ranks": {"food": 2},
            },
            {
                "id": "route-deterministic-003",
                "title": "松弛甜品收尾路线",
                "subtitle": "晚一点结束，适合不赶时间",
                "theme": "dessert-slow",
                "badge": "松弛",
                "score_delta": -5,
                "category_order": ["food", "dessert", "entertainment"],
                "candidate_rank": 0,
            },
        ]

    second_order = [base_order[1], base_order[0], base_order[2]]
    third_order = [base_order[0], base_order[2], base_order[1]]
    return [
        {
            "id": "route-deterministic-001",
            "title": "低排队顺路路线",
            "subtitle": "按你的限制串联三站，避免多余类型",
            "theme": "constraint-fit",
            "badge": "推荐",
            "score_delta": 0,
            "category_order": base_order,
            "candidate_rank": 0,
        },
        {
            "id": "route-deterministic-002",
            "title": "轻松少走路线",
            "subtitle": "优先把核心体验放在前半段",
            "theme": "low-effort",
            "badge": "省心",
            "score_delta": -3,
            "category_order": second_order,
            "candidate_rank": 1,
        },
        {
            "id": "route-deterministic-003",
            "title": "备选弹性路线",
            "subtitle": "保留同类候选，方便临场替换",
            "theme": "fallback-ready",
            "badge": "备选",
            "score_delta": -5,
            "category_order": third_order,
            "candidate_rank": 0,
        },
    ]


def poi_lookup() -> dict[str, MockPoi]:
    return {poi.id: poi for poi in MOCK_POIS}


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
