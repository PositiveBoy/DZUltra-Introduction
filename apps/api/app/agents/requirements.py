import re
from typing import Any

from app.models.schemas import ClarificationCard, RequirementSummary, RoutePlanRequest


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
    asks_nearby_poi = any(keyword in goal for keyword in ["附近", "周边"]) and any(
        keyword in goal for keyword in ["有什么", "有没有", "推荐", "哪家", "几个"]
    )
    asks_full_route = any(keyword in goal for keyword in ["路线", "规划", "安排", "半天", "一天", "先", "再"])
    if asks_nearby_poi and not asks_full_route:
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
