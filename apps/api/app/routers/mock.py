import json
from itertools import count, islice, cycle
from typing import Any
from uuid import uuid4

from fastapi import APIRouter

from app.core.config import settings
from app.data.mock_data import MOCK_POIS, MOCK_USERS, apply_generated_users, apply_generated_pois

_user_counter = count(1)
from app.models.schemas import (
    GeocodeRequest,
    GeneratePoisRequest,
    GenerateUserRequest,
    GeneratedMockResponse,
    MockPoi,
    MockUser,
)
from app.providers import provider_adapter

router = APIRouter(prefix="/mock", tags=["mock"])
MOCK_GENERATION_LLM_TIMEOUT_SECONDS = 1.0


@router.get("/users", response_model=list[MockUser])
def list_mock_users() -> list[MockUser]:
    return MOCK_USERS


@router.get("/pois", response_model=list[MockPoi])
def list_mock_pois() -> list[MockPoi]:
    return MOCK_POIS


@router.post("/generate-user", response_model=GeneratedMockResponse)
def generate_mock_user(request: GenerateUserRequest) -> GeneratedMockResponse:
    location = _location_from_request(request.city, request.area, request.current_location)
    customization = (request.customization or "").strip()
    scenario = request.scenario or "一键生成点仔 Ultra 演示用户"

    # new 用户：生成基础身份和当前位置，不生成历史行为，不调用 LLM
    if request.user_type == "new":
        new_user = MockUser(
            id=f"user-{next(_user_counter)}",
            name="新用户",
            user_type="new",
            city=request.city,
            scenario=customization or scenario,
            age=24,
            gender="未设置",
            occupation="首次体验用户",
            lifestyle_tags=["冷启动", "待学习偏好"],
            current_location=location,
            preferences=[customization] if customization else [],
            avoidances=[],
            priority_weights={},
            explain_focus=[],
        )
        return GeneratedMockResponse(
            fallback_used=False,
            source="ai_generated_dataset",
            data_origin="ai_generated_dataset",
            provider_name="ai_generated_dataset",
            reliability="generated_validated",
            users=[new_user],
            locations=[location],
            metadata={
                "city": request.city,
                "area": request.area,
                "scenario": scenario,
                "customization": customization,
                "user_type": "new",
                "data_origin": "ai_generated_dataset",
                "provider_name": "ai_generated_dataset",
                "reliability": "generated_validated",
                "note": "新用户：只有基础身份和当前位置，不生成收藏、评分、浏览和 UGC 历史。",
            },
        )

    # regular 用户：走 LLM 或模板 fallback
    template_user = _template_user(request)
    llm_result = provider_adapter.llm_chat_completion(
        [
            {
                "role": "system",
                "content": (
                    "你是 DZUltra 的 MockDataAgent。只输出 JSON，不要 Markdown。"
                    "生成的大众点评本地路线规划用户必须真实、克制、方便 Pydantic 校验。"
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "task": "generate_mock_user",
                        "city": request.city,
                        "area": request.area,
                        "scenario": scenario,
                        "customization": customization or "无",
                        "current_location": location,
                        "rules": [
                            "只输出 JSON，不要 Markdown。",
                            "regular 用户必须包含历史行为、UGC 评价、长期偏好和避雷点。",
                            "如果 customization 包含偏好或避雷点，必须写进 preferences 或 avoidances。",
                            "数据要真实克制，不要写成完美用户。",
                            "不要编造距离和通勤时间，距离交给地图 provider。",
                        ],
                        "schema": {
                            "users": [
                                {
                                    "id": "string",
                                    "name": "string",
                                    "user_type": "regular",
                                    "city": "string",
                                    "scenario": "string",
                                    "age": 28,
                                    "gender": "string",
                                    "occupation": "string",
                                    "lifestyle_tags": ["string"],
                                    "home_area": "string",
                                    "work_area": "string",
                                    "frequent_areas": ["string"],
                                    "current_location": location,
                                    "default_goal": "string",
                                    "group_size": 2,
                                    "time_window": "string",
                                    "budget_per_person": 180,
                                    "transport_preference": "string",
                                    "preferences": ["string"],
                                    "avoidances": ["string"],
                                    "priority_weights": {"queue": 0.3},
                                    "explain_focus": ["string"],
                                    "saved_pois": [{"poi_id": "string", "name": "string", "reason": "string"}],
                                    "viewed_pois": [{"poi_id": "string", "name": "string", "category": "food"}],
                                    "rated_pois": [{"poi_id": "string", "name": "string", "rating": 4.5, "comment": "string"}],
                                    "ugc_reviews": [{"poi_id": "string", "name": "string", "rating": 4.5, "content": "string", "tags": ["string"]}],
                                    "history_summary": "string",
                                }
                            ]
                        },
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        purpose="mock_user_generation",
        fallback_content=json.dumps({"users": [template_user.model_dump(mode="json")]}, ensure_ascii=False),
        temperature=0.4,
        max_tokens=700,
        timeout_seconds=_mock_generation_timeout_seconds(),
    )
    users, validation_error = _users_from_llm_payload(llm_result.data)
    if not llm_result.fallback_used and users:
        return GeneratedMockResponse(
            fallback_used=False,
            source="ai_generated_dataset",
            data_origin="ai_generated_dataset",
            provider_name="ai_generated_dataset",
            reliability="generated_validated",
            users=users,
            locations=[location],
            metadata={
                "city": request.city,
                "area": request.area,
                "scenario": scenario,
                "customization": customization,
                "agent": "MockDataAgent",
                "data_origin": "ai_generated_dataset",
                "provider_name": "longcat",
                "reliability": "generated_validated",
                "provider_call": llm_result.trace_output(),
                "validation": "pydantic_passed",
            },
        )

    return GeneratedMockResponse(
        fallback_used=True,
        source="fallback_template",
        data_origin="fallback_template",
        provider_name="fallback_template",
        reliability="fallback_template",
        users=[template_user],
        locations=[location],
        metadata={
            "city": request.city,
            "area": request.area,
            "scenario": scenario,
            "customization": customization,
            "agent": "MockDataAgent",
            "data_origin": "fallback_template",
            "provider_name": "fallback_template",
            "reliability": "fallback_template",
            "provider_call": llm_result.trace_output(),
            "validation_error": validation_error,
            "note": "LongCat 缺失、失败或输出未通过 schema 校验时，回退确定性模板，保证 Demo 可演示。",
        },
    )


@router.post("/generate-pois", response_model=GeneratedMockResponse)
def generate_mock_pois(request: GeneratePoisRequest) -> GeneratedMockResponse:
    location = _location_from_request(request.city, request.area, None)
    template_pois = [
        poi.model_copy(
            update={
                "id": f"{poi.id}-generated-{index + 1}",
                "city": request.city,
                "area": request.area,
                "district": poi.district or request.area,
                "field_reliability": {**poi.field_reliability, "source": "generated_validated"},
                "data_origin": "fallback_template",
                "provider_name": "fallback_template",
                "generated_by": "fallback_template",
                "data_reliability": "fallback_template",
            }
        )
        for index, poi in enumerate(islice(cycle(MOCK_POIS), request.count))
    ]
    llm_result = provider_adapter.llm_chat_completion(
        [
            {
                "role": "system",
                "content": (
                    "你是 DZUltra 的 MockDataAgent。只输出 JSON，不要 Markdown。"
                    "生成 POI 要贴近大众点评真实门店；坐标可以留空，后端会用地图 provider 校验。"
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "task": "generate_mock_pois",
                        "city": request.city,
                        "area": request.area,
                        "theme": request.theme or "大众点评本地生活混合候选池",
                        "customization": request.customization or "无",
                        "count": request.count,
                        "rules": [
                            "默认生成本区域可用于路线规划的 POI 候选池，不要围绕单一主题。",
                            "类别覆盖 food/culture/entertainment/dessert/shopping。",
                            "排队、UGC、推荐菜属于 ai_generated_dataset 深度字段，经过 schema 校验后作为 Agent 正式输入。",
                            "不要编造距离和通勤时间，坐标可留空交给地图 provider。",
                        ],
                        "schema": {
                            "pois": [
                                {
                                    "id": "string",
                                    "name": "string",
                                    "category": "food|culture|entertainment|dessert|shopping",
                                    "city": "string",
                                    "district": "string",
                                    "area": "string",
                                    "address": "string",
                                    "rating": 4.6,
                                    "queue_minutes": 8,
                                    "tags": ["string"],
                                    "avg_price": 120,
                                    "open_hours": "10:00-22:00",
                                    "visit_duration_minutes": 60,
                                    "ugc_summary": "string",
                                    "recommended_dishes": [],
                                    "decision_signals": {"selected_reason": "string"},
                                    "risk_notes": ["string"],
                                }
                            ]
                        },
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        purpose="mock_poi_generation",
        fallback_content=json.dumps({"pois": [poi.model_dump(mode="json") for poi in template_pois]}, ensure_ascii=False),
        temperature=0.5,
        max_tokens=1800,
        timeout_seconds=_mock_generation_timeout_seconds(),
    )
    pois, validation_error = _pois_from_llm_payload(llm_result.data, request)
    if not llm_result.fallback_used and pois:
        geocode_reports = [_geocode_generated_poi(poi) for poi in pois]
        return GeneratedMockResponse(
            fallback_used=False,
            source="ai_generated_dataset",
            data_origin="ai_generated_dataset",
            provider_name="ai_generated_dataset",
            reliability="generated_validated",
            pois=pois,
            metadata={
                "city": request.city,
                "area": request.area,
                "theme": request.theme,
                "requested_count": request.count,
                "agent": "MockDataAgent",
                "data_origin": "ai_generated_dataset",
                "provider_name": "longcat",
                "reliability": "generated_validated",
                "provider_call": llm_result.trace_output(),
                "geocode_reports": geocode_reports,
                "validation": "pydantic_passed",
            },
        )

    return GeneratedMockResponse(
        fallback_used=True,
        source="fallback_template",
        data_origin="fallback_template",
        provider_name="fallback_template",
        reliability="fallback_template",
        pois=template_pois,
        locations=[location],
        metadata={
            "city": request.city,
            "area": request.area,
            "theme": request.theme,
            "customization": request.customization,
            "requested_count": request.count,
            "agent": "MockDataAgent",
            "data_origin": "fallback_template",
            "provider_name": "fallback_template",
            "reliability": "fallback_template",
            "provider_call": llm_result.trace_output(),
            "validation_error": validation_error,
            "note": "LongCat 缺失、失败或输出未通过 schema 校验时，回退内置 POI 模板。",
        },
    )


def _template_user(request: GenerateUserRequest) -> MockUser:
    location = _location_from_request(request.city, request.area, request.current_location)
    customization = (request.customization or "").strip()
    preferences = ["低排队", "路线顺路", "推荐理由清楚", "环境不要太吵"]
    avoidances = ["热门长队", "临时闭店", "移动跨度太大"]
    if customization:
        if any(keyword in customization for keyword in ["不喜欢", "不要", "避免", "讨厌"]):
            avoidances.append(customization)
        else:
            preferences.append(customization)
    return MockUser(
        id=f"user-{next(_user_counter)}",
        name=f"{request.city}演示用户",
        user_type="regular",
        city=request.city,
        scenario=customization or request.scenario,
        age=29,
        gender="女",
        occupation="互联网产品经理",
        lifestyle_tags=["周末探索", "轻社交", "拍照记录", "低排队敏感"],
        home_area=request.area or "望京",
        work_area="国贸",
        frequent_areas=list(dict.fromkeys([request.area or "三里屯", "望京", "亮马桥", "朝阳公园"])),
        current_location=location,
        default_goal=f"在{request.area or request.city}附近找一条少排队、好解释的半日路线",
        group_size=2,
        time_window="14:00-18:30",
        budget_per_person=180,
        transport_preference="步行 + 短程打车",
        preferences=list(dict.fromkeys(preferences)),
        avoidances=list(dict.fromkeys(avoidances)),
        priority_weights={"queue": 0.34, "distance": 0.24, "ugc": 0.18, "rating": 0.14, "budget": 0.10},
        explain_focus=["为什么少排队", "为什么顺路", "哪些字段来自 ai_generated_dataset 或 fallback_template"],
        saved_pois=[
            {"poi_id": "mock-saved-cafe", "name": "小山茶饮廊", "reason": "安静、出杯快、适合聊天"},
            {"poi_id": "mock-saved-gallery", "name": "红砖当代艺术空间", "reason": "展陈清楚，拍照稳定"},
        ],
        viewed_pois=[
            {"poi_id": "mock-viewed-bistro", "name": "三里屯轻食 Bistro", "category": "food", "view_count": 4},
            {"poi_id": "mock-viewed-dessert", "name": "亮马河甜品露台", "category": "dessert", "view_count": 3},
        ],
        rated_pois=[
            {"poi_id": "mock-rated-hotpot", "name": "半重山老火锅", "rating": 3.8, "comment": "味道可以，但饭点排队久"},
            {"poi_id": "mock-rated-japanese", "name": "蓝港日料小食堂", "rating": 4.7, "comment": "环境稳定，等位短"},
        ],
        ugc_reviews=[
            {
                "poi_id": "mock-ugc-bistro",
                "name": "三里屯轻食 Bistro",
                "rating": 4.6,
                "content": "下午去不用怎么等，靠窗位置适合聊天，套餐分量对两个人刚好。",
                "tags": ["低排队", "约会", "轻食"],
            },
            {
                "poi_id": "mock-ugc-gallery",
                "name": "红砖当代艺术空间",
                "rating": 4.8,
                "content": "路线动线清楚，拍照点多，但闭馆前一小时要控制时间。",
                "tags": ["看展", "拍照", "时间约束"],
            },
        ],
        history_summary="偏好少排队、短距离移动和可解释推荐；对临时闭店、热门长队和过度跨区较敏感。",
        data_origin="fallback_template",
        provider_name="fallback_template",
        generated_by="fallback_template",
        data_reliability="fallback_template",
    )


def _mock_generation_timeout_seconds() -> float | None:
    if not settings.has_real_longcat():
        return None
    configured_fast_timeout = getattr(settings, "llm_fast_timeout_seconds", MOCK_GENERATION_LLM_TIMEOUT_SECONDS)
    return min(configured_fast_timeout, MOCK_GENERATION_LLM_TIMEOUT_SECONDS)


def _location_from_request(city: str, area: str | None, current_location: dict[str, Any] | None) -> dict[str, Any]:
    if current_location:
        return {
            "id": current_location.get("id") or f"mock-location-{uuid4().hex[:8]}",
            "city": current_location.get("city") or city,
            "area": current_location.get("area") or area,
            "address": current_location.get("address"),
            "latitude": current_location.get("latitude"),
            "longitude": current_location.get("longitude"),
            "source": current_location.get("source") or "ai_generated_dataset",
            "data_origin": current_location.get("data_origin") or "ai_generated_dataset",
            "reliability": current_location.get("reliability") or "generated_validated",
            "label": current_location.get("label") or f"{city} · {area or '随机位置'}",
        }
    preset_coordinates = {
        "北京": (39.9348, 116.4542),
        "上海": (31.2239, 121.4452),
        "成都": (30.6570, 104.0810),
        "杭州": (30.2589, 120.1649),
        "广州": (23.1322, 113.3270),
        "深圳": (22.5178, 113.9360),
    }
    latitude, longitude = preset_coordinates.get(city, (39.9348, 116.4542))
    return {
        "id": f"mock-location-{uuid4().hex[:8]}",
        "city": city,
        "area": area,
        "address": area,
        "latitude": latitude,
        "longitude": longitude,
        "source": "ai_generated_dataset",
        "data_origin": "ai_generated_dataset",
        "reliability": "generated_validated",
        "label": f"{city} · {area}" if area else city,
    }


def _content_from_payload(payload: dict[str, Any]) -> str:
    return payload.get("choices", [{}])[0].get("message", {}).get("content", "")


def _json_from_llm_payload(payload: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    content = _content_from_payload(payload).strip()
    try:
        return json.loads(content), None
    except json.JSONDecodeError as exc:
        return {}, str(exc)


def _users_from_llm_payload(payload: dict[str, Any]) -> tuple[list[MockUser], str | None]:
    raw, error = _json_from_llm_payload(payload)
    if error:
        return [], error
    try:
        users = [
            MockUser(
                **{
                    **item,
                    "data_origin": item.get("data_origin") or "ai_generated_dataset",
                    "provider_name": item.get("provider_name") or "ai_generated_dataset",
                    "generated_by": item.get("generated_by") or "MockDataAgent",
                    "schema_version": item.get("schema_version") or "v3-ai-generated-user-001",
                    "data_reliability": item.get("data_reliability") or "generated_validated",
                }
            )
            for item in raw.get("users", [])
        ]
    except (TypeError, ValueError) as exc:
        return [], str(exc)
    return users, None


def _pois_from_llm_payload(payload: dict[str, Any], request: GeneratePoisRequest) -> tuple[list[MockPoi], str | None]:
    raw, error = _json_from_llm_payload(payload)
    if error:
        return [], error
    pois: list[MockPoi] = []
    try:
        for index, item in enumerate(raw.get("pois", [])[: request.count]):
            item = {
                **item,
                "id": item.get("id") or f"generated-poi-{index + 1}",
                "city": item.get("city") or request.city,
                "area": item.get("area") or request.area,
                "rating": item.get("rating") or 4.4,
                "queue_minutes": item.get("queue_minutes") if item.get("queue_minutes") is not None else 8,
                "data_origin": item.get("data_origin") or "ai_generated_dataset",
                "provider_name": item.get("provider_name") or "ai_generated_dataset",
                "generated_by": item.get("generated_by") or "MockDataAgent",
                "schema_version": item.get("schema_version") or "v3-ai-generated-poi-001",
                "data_reliability": item.get("data_reliability") or "generated_validated",
            }
            pois.append(MockPoi(**item))
    except (TypeError, ValueError) as exc:
        return [], str(exc)
    return pois, None


def _geocode_generated_poi(poi: MockPoi) -> dict[str, Any]:
    result = provider_adapter.geocode(
        GeocodeRequest(
            address=poi.address,
            city=poi.city or "北京",
            poi_id=poi.id,
            name=poi.name,
        )
    )
    location = result.data.location
    if poi.latitude is None and location.latitude is not None:
        poi.latitude = location.latitude
    if poi.longitude is None and location.longitude is not None:
        poi.longitude = location.longitude
    return result.trace_output()


# ── AI Mock 生成器数据注入 API ──
# 前端"应用"生成器数据时调用，将数据注入后端内存覆盖层，
# Agent 流程优先使用注入数据而非静态 JSON。


@router.post("/apply-users")
def apply_users(users: list[dict]) -> dict[str, Any]:
    """将 AI Mock 生成器产生的用户数据注入后端覆盖层。"""
    parsed = [MockUser(**u) for u in users]
    apply_generated_users(parsed)
    return {"status": "ok", "count": len(parsed), "source": "ai_generated_dataset"}


@router.post("/apply-pois")
def apply_pois(pois: list[dict]) -> dict[str, Any]:
    """将 AI Mock 生成器产生的 POI 数据注入后端覆盖层。"""
    parsed = [MockPoi(**p) for p in pois]
    apply_generated_pois(parsed)
    return {"status": "ok", "count": len(parsed), "source": "ai_generated_dataset"}
