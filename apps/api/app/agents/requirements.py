import json
import re
from typing import Any

from pydantic import ValidationError

from app.models.schemas import (
    ClarificationCard,
    ConstraintDiscoveryLlmOutput,
    ConstraintEvidence,
    PlanningConstraint,
    RequirementSummary,
    RoutePlanRequest,
)


CITY_KEYWORDS = ["北京", "上海", "广州", "深圳", "成都", "杭州"]
PLANNING_KEYWORDS = [
    "路线",
    "规划",
    "安排",
    "怎么玩",
    "去哪",
    "逛",
    "吃",
    "看展",
    "咖啡",
    "约会",
    "聚餐",
    "带娃",
    "周末",
    "今天",
    "今晚",
    "下午",
    "上午",
]
PLANNING_CONTEXT_KEYWORDS = [
    "约会",
    "带娃",
    "亲子",
    "孩子",
    "今天",
    "今晚",
    "周末",
    "上午",
    "下午",
    "逛",
    "看展",
]

REFINEMENT_ONLY_KEYWORDS = ["换掉", "换成", "保留", "重新生成", "不想吃", "不想喝"]
NON_PLANNING_KEYWORDS = ["不想做计划", "先不规划", "取消规划", "不用规划", "只是聊聊", "没想好"]


def analyze_route_requirements(request: RoutePlanRequest) -> tuple[RequirementSummary, list[ClarificationCard]]:
    """Turn loose user input into a planning-ready requirement state.

    This is deliberately deterministic for the V2 mock runner. A future LLM or
    LangGraph node can replace the extractors while keeping this response shape.
    """

    goal = request.goal.strip()
    answers = request.clarification_answers
    intent_kind = _classify_intent(goal, request.plan_mode)
    collected = _collect_fields(request, answers)
    missing_required_fields = _missing_required_fields(intent_kind, collected)
    round_index = 2 if answers else 1
    cards = _build_cards(intent_kind, collected, missing_required_fields, round_index)
    assumptions: list[str] = []

    if request.skip_clarification and intent_kind == "planning":
        collected, assumptions = _apply_default_assumptions(collected, missing_required_fields)
        missing_required_fields = []
        cards = [card for card in cards if not card.blocks_planning]

    can_plan = intent_kind == "planning" and not any(card.blocks_planning for card in cards)
    status = _status_for(intent_kind, can_plan)

    summary = RequirementSummary(
        status=status,
        intent_kind=intent_kind,
        can_plan=can_plan,
        collected=collected,
        missing_required_fields=missing_required_fields,
        assumptions=assumptions,
        user_visible_summary=_visible_summary(collected, assumptions),
        next_action=_next_action(status, cards),
    )
    return summary, cards


def build_intent_overrides(summary: RequirementSummary) -> dict[str, Any]:
    collected = summary.collected
    overrides: dict[str, Any] = {}
    if collected.get("city"):
        overrides["city"] = collected["city"]
    if collected.get("time_window"):
        overrides["time_window"] = collected["time_window"]
    if collected.get("group_size"):
        overrides["group_size"] = collected["group_size"]
    if collected.get("food_preference"):
        overrides["food_preference"] = collected["food_preference"]
    if collected.get("budget_per_person"):
        overrides["budget_per_person"] = collected["budget_per_person"]
    if collected.get("mobility"):
        overrides.setdefault("preferences", []).append(collected["mobility"])
    if collected.get("taste"):
        overrides.setdefault("preferences", []).append(collected["taste"])
    return overrides


def _classify_intent(goal: str, plan_mode: bool = True) -> str:
    if not goal:
        return "ambiguous"
    if any(keyword in goal for keyword in NON_PLANNING_KEYWORDS):
        return "non_planning"
    # "有什么/有没有/推荐/哪家/几个"推荐查询模式
    asks_recommendation = any(
        keyword in goal for keyword in ["有什么", "有没有", "推荐", "哪家", "几个"]
    )
    # "附近/周边"位置限定
    has_nearby = any(keyword in goal for keyword in ["附近", "周边"])
    # "附近有X吗"简单存在性查询（如"附近有便利店吗"）
    asks_nearby_existence = (
        has_nearby and "有" in goal and "吗" in goal and not asks_recommendation
    )
    asks_full_route = any(keyword in goal for keyword in ["路线", "规划", "安排", "半天", "一天", "先", "再"])
    # 简单存在性查询：不含规划上下文时始终 non_planning
    if asks_nearby_existence and not asks_full_route:
        has_planning_context = any(keyword in goal for keyword in PLANNING_CONTEXT_KEYWORDS)
        if not has_planning_context and "吃" in goal and "看展" in goal:
            has_planning_context = True
        if has_planning_context:
            # 有规划上下文但用户关闭路线规划模式时，倾向普通问答
            return "planning" if plan_mode else "ambiguous"
        return "non_planning"
    # 推荐查询模式：检查是否同时包含规划上下文
    if asks_recommendation and not asks_full_route:
        has_planning_context = any(keyword in goal for keyword in PLANNING_CONTEXT_KEYWORDS)
        if not has_planning_context and "吃" in goal and "看展" in goal:
            has_planning_context = True
        if has_planning_context:
            # 有规划上下文但用户关闭路线规划模式时，倾向普通问答
            return "planning" if plan_mode else "ambiguous"
        # 纯推荐查询，无规划上下文：plan_mode 决定倾向
        if plan_mode:
            return "ambiguous"
        return "non_planning"
    has_planning_context = any(
        keyword in goal
        for keyword in ["路线", "规划", "去哪", "玩", "逛", "约会", "带娃", "孩子", "今天", "今晚", "周末", "上午", "下午"]
    )
    if any(keyword in goal for keyword in REFINEMENT_ONLY_KEYWORDS) and not has_planning_context:
        return "refinement_without_context"
    if any(keyword in goal for keyword in PLANNING_KEYWORDS):
        return "planning"
    if not plan_mode:
        return "non_planning"
    return "ambiguous"


def _collect_fields(request: RoutePlanRequest, answers: dict[str, Any]) -> dict[str, Any]:
    goal = request.goal
    return {
        "city": _answer_or(answers, "city") or _parse_city(goal, request.city),
        "area": _answer_or(answers, "area") or _parse_area(goal),
        "group_size": _parse_group_size(_answer_or(answers, "people") or goal),
        "time_window": _parse_time_window(
            _answer_or(answers, "time") or _answer_or(answers, "time_window") or goal
        ),
        "food_preference": _parse_food_preference(_answer_or(answers, "food") or goal),
        "budget_per_person": _parse_budget(_answer_or(answers, "budget") or goal),
        "taste": _parse_taste(_answer_or(answers, "taste") or goal),
        "mobility": _parse_mobility(goal),
        "route_purpose": _parse_route_purpose(goal),
    }


def _missing_required_fields(intent_kind: str, collected: dict[str, Any]) -> list[str]:
    if intent_kind != "planning":
        return ["goal"]
    required = {
        "group_size": collected.get("group_size"),
        "time_window": collected.get("time_window"),
        "food_preference": collected.get("food_preference"),
    }
    return [field for field, value in required.items() if value in (None, "", [])]


def _build_cards(
    intent_kind: str,
    collected: dict[str, Any],
    missing_required_fields: list[str],
    round_index: int,
) -> list[ClarificationCard]:
    if intent_kind in {"non_planning", "ambiguous"}:
        return [
            ClarificationCard(
                id="clarify-planning-goal",
                question="你是想让我继续帮你做路线规划，还是先把需求聊清楚？",
                field="goal",
                options=["继续规划路线", "先聊需求", "取消本次规划", "其他"],
                default_value="继续规划路线",
                allow_other=True,
                round_index=round_index,
                blocks_planning=True,
                required=True,
                allow_skip=False,
                reason="当前输入不像一个可直接规划的出行目标，需要先确认用户意图。",
            )
        ]
    if intent_kind == "refinement_without_context":
        return [
            ClarificationCard(
                id="clarify-refinement-context",
                question="这像是在改现有方案。你想基于哪个方案调整，还是重新生成一条新路线？",
                field="refinement_context",
                options=["基于当前方案调整", "重新生成新方案", "补充完整需求", "其他"],
                default_value="基于当前方案调整",
                allow_other=True,
                round_index=round_index,
                blocks_planning=True,
                required=True,
                allow_skip=False,
                reason="没有当前方案上下文时，局部替换容易改错对象。",
            )
        ]

    cards: list[ClarificationCard] = []
    if "group_size" in missing_required_fields:
        cards.append(
            ClarificationCard(
                id="clarify-people",
                question="这次几个人出行？",
                field="people",
                ui_component="number_picker",
                options=["1 人", "2 人", "3-4 人", "5 人以上", "其他"],
                default_value="1 人",
                allow_other=True,
                round_index=round_index,
                blocks_planning=True,
                required=True,
                reason="人数会影响餐厅订位、排队风险和每站停留时长。",
            )
        )
    if "time_window" in missing_required_fields:
        cards.append(
            ClarificationCard(
                id="clarify-time",
                question="你大概什么时候出发、什么时候结束？",
                field="time_window",
                ui_component="time_range_picker",
                options=["上午", "下午", "晚上", "随便", "其他"],
                default_value="随便",
                allow_other=True,
                round_index=round_index,
                blocks_planning=True,
                required=True,
                reason="路线必须知道可用时长，才能安排每个 POI 的停留时间。",
            )
        )
    if "food_preference" in missing_required_fields:
        cards.append(
            ClarificationCard(
                id="clarify-food",
                question="这条路线里要不要安排吃喝？",
                field="food",
                selection_mode="multiple",
                options=["随便", "吃主食", "吃小吃", "吃当地特色小吃", "喝饮品", "不吃任何东西", "其他"],
                default_value="随便",
                allow_other=True,
                round_index=round_index,
                blocks_planning=True,
                required=True,
                reason="是否包含饮食会决定 POI 类型和路线节奏。",
            )
        )

    if collected.get("food_preference") and not collected.get("taste") and _needs_taste_question(collected):
        cards.append(
            ClarificationCard(
                id="clarify-taste",
                question="口味上能接受辣吗？",
                field="taste",
                options=["无辣不欢", "微辣可以", "一点辣都不行", "随便", "其他"],
                default_value="随便",
                allow_other=True,
                round_index=round_index,
                blocks_planning=False,
                required=False,
                reason="候选餐厅可能包含川菜或重口味门店，先确认能降低踩雷概率。",
            )
        )
    return cards[: 3 if round_index >= 2 else 4]


def _apply_default_assumptions(
    collected: dict[str, Any],
    missing_required_fields: list[str],
) -> tuple[dict[str, Any], list[str]]:
    updated = dict(collected)
    assumptions = []
    if "group_size" in missing_required_fields:
        updated["group_size"] = 1
        assumptions.append("未提供人数，先按 1 人规划。")
    if "time_window" in missing_required_fields:
        updated["time_window"] = "14:00-18:00"
        assumptions.append("未提供时间，先按下午 14:00-18:00 规划。")
    if "food_preference" in missing_required_fields:
        updated["food_preference"] = "随便"
        assumptions.append("未说明是否吃喝，先按可吃可不吃处理。")
    return updated, assumptions


def _status_for(intent_kind: str, can_plan: bool) -> str:
    if intent_kind in {"non_planning", "ambiguous", "refinement_without_context"}:
        return "input_not_plannable"
    if not can_plan:
        return "needs_clarification"
    return "ready"


def _next_action(status: str, cards: list[ClarificationCard]) -> str:
    if status == "ready":
        return "信息足够，可以进入 POI 检索和路线生成。"
    if status == "input_not_plannable":
        return "先让用户确认是否要做路线规划，或补充完整出行目标。"
    if cards:
        return "先展示补全卡片，等用户回答后再继续规划。"
    return "等待用户补充信息。"


def _visible_summary(collected: dict[str, Any], assumptions: list[str]) -> list[str]:
    destination = collected.get("city") or "待确认"
    if collected.get("area"):
        destination = f"{destination} · {collected['area']}"
    lines = [
        f"目的地：{destination}",
        f"时间：{collected.get('time_window') or '待确认'}",
        f"人数：{collected.get('group_size') or '待确认'} 人",
        f"饮食：{collected.get('food_preference') or '待确认'}",
    ]
    if collected.get("budget_per_person"):
        lines.append(f"预算：人均约 {collected['budget_per_person']} 元")
    if collected.get("taste"):
        lines.append(f"口味：{collected['taste']}")
    if collected.get("mobility"):
        lines.append(f"体力/动线：{collected['mobility']}")
    return [*lines, *assumptions]


def _answer_or(answers: dict[str, Any], field: str) -> Any | None:
    value = answers.get(field)
    if value in (None, "", [], {}):
        return None
    return value


def _parse_city(goal: str, default_city: str) -> str:
    return next((city for city in CITY_KEYWORDS if city in goal), default_city or "北京")


def _parse_area(goal: str) -> str | None:
    match = re.search(r"在([^，,。.!！?？\s]{2,8}?)(?:附近|周边|逛|玩|吃|看|约会)", goal)
    if match:
        candidate = match.group(1).rstrip("逛玩吃看")
        if candidate not in CITY_KEYWORDS:
            return candidate
    return None


def _parse_group_size(text: Any) -> int | None:
    normalized = str(text)
    if any(keyword in normalized for keyword in ["约会", "情侣", "两人", "俩人", "两个人", "2人", "2 人"]):
        return 2
    if any(keyword in normalized for keyword in ["一家三口", "三个人", "3人", "3 人"]):
        return 3
    number_match = re.search(r"(\d{1,2})\s*(?:个?人|位|人出行)", normalized)
    if number_match:
        return max(1, min(20, int(number_match.group(1))))
    chinese_numbers = {"一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6}
    for word, number in chinese_numbers.items():
        if f"{word}个人" in normalized or f"{word}人" in normalized:
            return number
    return None


def _parse_time_window(text: Any) -> str | None:
    normalized = str(text)
    explicit = re.search(r"(\d{1,2})[:：点](\d{0,2})\s*[-到~至]\s*(\d{1,2})[:：点](\d{0,2})", normalized)
    if explicit:
        start_hour = int(explicit.group(1))
        start_minute = int(explicit.group(2) or 0)
        end_hour = int(explicit.group(3))
        end_minute = int(explicit.group(4) or 0)
        return f"{start_hour:02d}:{start_minute:02d}-{end_hour:02d}:{end_minute:02d}"
    if any(keyword in normalized for keyword in ["上午", "早上"]):
        return "09:30-12:30"
    if "下午" in normalized or "午后" in normalized:
        return "14:00-18:30"
    if any(keyword in normalized for keyword in ["晚上", "今晚", "夜间"]):
        return "18:30-22:30"
    if "半天" in normalized:
        return "14:00-18:00"
    if "随便" in normalized:
        return "14:00-18:00"
    return None


def _parse_food_preference(text: Any) -> str | None:
    normalized = str(text)
    if any(keyword in normalized for keyword in ["不吃", "不安排吃", "不吃任何"]):
        return "不吃任何东西"
    if any(keyword in normalized for keyword in ["小吃", "扫街"]):
        return "吃小吃"
    if any(keyword in normalized for keyword in ["当地特色", "特色吃"]):
        return "吃当地特色小吃"
    if any(keyword in normalized for keyword in ["咖啡", "奶茶", "喝", "饮品", "甜品"]):
        return "喝饮品"
    if any(keyword in normalized for keyword in ["吃", "饭", "餐", "聚餐", "火锅", "川菜", "日料", "bistro"]):
        return "吃主食"
    if "随便" in normalized:
        return "随便"
    return None


def _parse_budget(text: Any) -> int | None:
    normalized = str(text)
    match = re.search(r"(?:人均|预算|每人)[^\d]{0,4}(\d{2,4})", normalized)
    if match:
        return int(match.group(1))
    if any(keyword in normalized for keyword in ["便宜", "别太贵", "性价比"]):
        return 150
    if any(keyword in normalized for keyword in ["高端", "不计预算", "贵一点"]):
        return 500
    return None


def _parse_taste(text: Any) -> str | None:
    normalized = str(text)
    if any(keyword in normalized for keyword in ["不吃辣", "一点辣都不行", "不要辣", "清淡"]):
        return "不吃辣"
    if any(keyword in normalized for keyword in ["微辣", "一点辣"]):
        return "微辣可以"
    if any(keyword in normalized for keyword in ["无辣不欢", "重辣", "重口", "川菜", "火锅"]):
        return "能吃辣"
    return None


def _parse_mobility(goal: str) -> str | None:
    if any(keyword in goal for keyword in ["少走路", "别太累", "不想走", "轻松"]):
        return "少走路"
    if any(keyword in goal for keyword in ["步行", "散步", "多走走"]):
        return "步行友好"
    return None


def _parse_route_purpose(goal: str) -> str:
    if "带娃" in goal or "孩子" in goal or "亲子" in goal:
        return "亲子出行"
    if "约会" in goal:
        return "约会"
    if "朋友" in goal or "聚餐" in goal:
        return "朋友聚会"
    if "拍照" in goal or "出片" in goal:
        return "拍照打卡"
    return "本地路线"


def _needs_taste_question(collected: dict[str, Any]) -> bool:
    food_preference = str(collected.get("food_preference") or "")
    return any(keyword in food_preference for keyword in ["主食", "小吃", "特色"])


# ---------------------------------------------------------------------------
# LLM-powered ConstraintDiscoveryAgent
# ---------------------------------------------------------------------------

# Fields that block planning when missing.
BLOCKING_FIELDS = {"group_size", "time_window", "food_preference"}

# Fact categories that LLM must NOT generate; it can only mark them for grounding.
FACT_CATEGORIES = {"weather", "distance", "business_hours", "queue", "traffic"}


def build_constraint_discovery_messages(request: RoutePlanRequest) -> list[dict[str, str]]:
    """Build the LongCat prompt for ConstraintDiscoveryAgent.

    The LLM must output a structured JSON matching ConstraintDiscoveryLlmOutput.
    It may NOT generate weather, distance, business hours, queue or traffic facts;
    it can only flag them as requires_grounding.
    """

    goal = request.goal.strip()
    answers = request.clarification_answers
    round_index = 2 if answers else 1
    max_cards = 3 if round_index >= 2 else 4

    return [
        {
            "role": "system",
            "content": (
                "你是 DZUltra 的 ConstraintDiscoveryAgent。你的任务是理解用户的出行目标，"
                "抽取结构化需求摘要、约束账本草稿和补全卡片。\n\n"
                "关键规则：\n"
                "1. 你不能生成天气、距离、通勤时间、营业状态、排队人数等事实。"
                "如果你判断某个约束需要这些事实来验证，在 grounding_requests 中标记，"
                "并在 constraint_ledger_patch 中将 requires_grounding 设为 true。\n"
                "2. 如果缺少阻塞字段（城市/区域、时间窗、人数、是否安排吃喝），"
                "你必须在 clarification_cards 中输出追问卡片。\n"
                f"3. 当前是第 {round_index} 轮追问。最多追问 2 轮；"
                f"第 2 轮最多 {max_cards} 个问题。\n"
                "4. 每个约束必须标注 source 和 reliability。\n"
                "5. 只输出一个 JSON 对象，不要 Markdown，不要解释正文。\n"
                "6. clarification_cards 的 round_index 必须与当前轮次一致。"
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "user_goal": goal,
                    "city": request.city,
                    "constraints": request.constraints,
                    "plan_mode": request.plan_mode,
                    "clarification_answers": answers if answers else None,
                    "round_index": round_index,
                    "max_clarification_cards": max_cards,
                    "blocking_fields": sorted(BLOCKING_FIELDS),
                    "output_schema": {
                        "requirement_summary": {
                            "status": "ready | needs_clarification | input_not_plannable",
                            "intent_kind": "planning | non_planning | refinement_without_context | ambiguous",
                            "can_plan": "布尔值",
                            "collected": {
                                "city": "字符串或 null",
                                "area": "字符串或 null",
                                "group_size": "整数或 null",
                                "time_window": "字符串如 14:00-18:30 或 null",
                                "food_preference": "字符串或 null",
                                "budget_per_person": "整数或 null",
                                "taste": "字符串或 null",
                                "mobility": "字符串或 null",
                                "route_purpose": "字符串如 约会/亲子出行/本地路线",
                            },
                            "missing_required_fields": "缺失的阻塞字段列表",
                            "assumptions": "对非阻塞字段使用的默认假设列表",
                            "user_visible_summary": "给用户看的需求总结行列表",
                            "next_action": "一句话说明下一步",
                        },
                        "clarification_cards": [
                            {
                                "id": "clarify-xxx",
                                "question": "追问问题",
                                "field": "people | time_window | food | taste | ...",
                                "ui_component": "number_picker | choice_buttons | time_range_picker | budget_picker | free_text",
                                "options": ["选项1", "选项2"],
                                "default_value": "默认选项",
                                "allow_other": True,
                                "round_index": round_index,
                                "blocks_planning": "布尔值，缺阻塞字段时为 true",
                                "required": "布尔值",
                                "reason": "为什么需要追问这个字段",
                            }
                        ],
                        "constraint_ledger_patch": [
                            {
                                "id": "location.city",
                                "label": "城市",
                                "description": "约束描述",
                                "category": "location | time | people | food | budget | mobility | weather | traffic | poi | preference",
                                "hardness": "hard | soft",
                                "source": "user_explicit | user_implicit | llm_inference | system_default",
                                "reliability": "verified | inferred | missing",
                                "status": "discovered | needs_clarification | assumed",
                                "impact": ["filter", "boost", "clarify", "explain"],
                                "weight": "0 到 1 的数字",
                                "requires_grounding": "布尔值，需要 provider 验证时为 true",
                                "requires_clarification": "布尔值，需要追问时为 true",
                            }
                        ],
                        "assumptions": ["对非阻塞字段使用的默认假设"],
                        "grounding_requests": [
                            "weather | poi_search | route_matrix | business_hours | queue | traffic"
                        ],
                    },
                    "required_json_only": True,
                },
                ensure_ascii=False,
            ),
        },
    ]


def llm_analyze_route_requirements(
    request: RoutePlanRequest,
) -> tuple[
    RequirementSummary,
    list[ClarificationCard],
    list[PlanningConstraint],
    list[str],
    list[str],
    dict[str, Any],
]:
    """Use LongCat to generate structured requirement analysis.

    Returns (requirement_summary, clarification_cards, constraint_ledger_patch,
             assumptions, grounding_requests, trace_info).

    On any failure (provider error, JSON parse error, schema validation error),
    falls back to the deterministic ``analyze_route_requirements`` and returns
    the fallback results with trace_info indicating the fallback reason.
    """

    from app.providers import provider_adapter

    trace_info: dict[str, Any] = {
        "provider": None,
        "llm_called": False,
        "schema_validation": None,
        "fallback_used": False,
        "fallback_reason": None,
    }

    messages = build_constraint_discovery_messages(request)
    deterministic_summary, deterministic_cards = analyze_route_requirements(request)

    # Build fallback JSON from deterministic results for provider_adapter
    fallback_json = _build_fallback_json(deterministic_summary, deterministic_cards, request)

    trace_info["llm_called"] = True
    provider_result = provider_adapter.llm_chat_completion(
        messages,
        purpose="constraint_discovery",
        fallback_content=fallback_json,
        temperature=0,
        max_tokens=1200,
    )
    provider_call = provider_result.trace_output()
    trace_info["provider_call"] = provider_call
    trace_info["provider"] = provider_call.get("provider")

    if provider_result.fallback_used:
        # Provider itself fell back to deterministic template
        fallback_reason = provider_result.error or "LongCat provider failed for constraint_discovery."
        trace_info["fallback_used"] = True
        trace_info["fallback_reason"] = fallback_reason
        trace_info["schema_validation"] = {"valid": False, "source": "provider_fallback", "error": fallback_reason}
        return (
            deterministic_summary,
            deterministic_cards,
            [],
            deterministic_summary.assumptions,
            [],
            trace_info,
        )

    content = _extract_llm_content(provider_result.data)
    trace_info["raw_content_preview"] = content[:300]

    # Try to parse and validate LLM output
    try:
        parsed_payload = _parse_constraint_discovery_json(content)
        validated = ConstraintDiscoveryLlmOutput.model_validate(parsed_payload)
    except (json.JSONDecodeError, ValueError, TypeError, ValidationError) as exc:
        fallback_reason = f"LongCat constraint_discovery JSON parse/schema validation failed: {exc}"
        trace_info["fallback_used"] = True
        trace_info["fallback_reason"] = fallback_reason
        trace_info["schema_validation"] = {"valid": False, "source": "longcat", "error": str(exc)}
        return (
            deterministic_summary,
            deterministic_cards,
            [],
            deterministic_summary.assumptions,
            [],
            trace_info,
        )

    # Post-validation: enforce guardrails on LLM output
    summary = validated.requirement_summary
    cards = validated.clarification_cards
    ledger_patch = validated.constraint_ledger_patch
    assumptions = validated.assumptions
    grounding_requests = validated.grounding_requests

    # Enforce: missing blocking fields must produce clarification_cards
    if summary.intent_kind == "planning" and summary.missing_required_fields:
        card_fields = {card.field for card in cards if card.blocks_planning}
        missing_blocking = set(summary.missing_required_fields) & BLOCKING_FIELDS
        if not missing_blocking.issubset(card_fields):
            # LLM missed some blocking clarification cards; add them from deterministic
            det_by_field = {card.field: card for card in deterministic_cards if card.blocks_planning}
            for field in missing_blocking - card_fields:
                if field in det_by_field:
                    cards.append(det_by_field[field])

    # Enforce: round_index on cards
    round_index = 2 if request.clarification_answers else 1
    max_cards = 3 if round_index >= 2 else 4
    cards = cards[:max_cards]
    for card in cards:
        card.round_index = round_index

    # Enforce: LLM must not generate fact constraints, only mark requires_grounding
    for constraint in ledger_patch:
        if constraint.category in FACT_CATEGORIES:
            constraint.requires_grounding = True
            # Clear any fact-like evidence that LLM might have fabricated
            if constraint.reliability not in ("missing", "inferred"):
                constraint.reliability = "inferred"

    # Enforce: can_plan must be consistent with blocking cards
    has_blocking_cards = any(card.blocks_planning for card in cards)
    if has_blocking_cards and summary.can_plan:
        summary.can_plan = False
        if summary.status == "ready":
            summary.status = "needs_clarification"

    trace_info["schema_validation"] = {"valid": True, "source": "longcat"}
    trace_info["fallback_used"] = False

    return summary, cards, ledger_patch, assumptions, grounding_requests, trace_info


def _build_fallback_json(
    summary: RequirementSummary,
    cards: list[ClarificationCard],
    request: RoutePlanRequest,
) -> str:
    """Build a deterministic fallback JSON for the LLM provider."""
    return json.dumps(
        {
            "requirement_summary": summary.model_dump(mode="json"),
            "clarification_cards": [card.model_dump(mode="json") for card in cards],
            "constraint_ledger_patch": [],
            "assumptions": summary.assumptions,
            "grounding_requests": [],
        },
        ensure_ascii=False,
    )


def _extract_llm_content(payload: dict[str, Any]) -> str:
    """Extract the text content from an LLM chat completion payload."""
    return payload.get("choices", [{}])[0].get("message", {}).get("content", "").strip()


def _parse_constraint_discovery_json(content: str) -> dict[str, Any]:
    """Parse the LLM response content into a JSON dict, handling code fences."""
    text = content.strip()
    if text.startswith("```"):
        lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()
    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end < start:
            raise ValueError("LongCat constraint_discovery response did not contain a JSON object.")
        text = text[start : end + 1]
    payload = json.loads(text)
    if not isinstance(payload, dict):
        raise ValueError("LongCat constraint_discovery response JSON must be an object.")
    return payload
