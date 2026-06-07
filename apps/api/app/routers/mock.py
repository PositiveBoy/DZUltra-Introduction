import json
from typing import Any

from fastapi import APIRouter

from app.data.mock_data import MOCK_POIS, MOCK_USERS
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


@router.get("/users", response_model=list[MockUser])
def list_mock_users() -> list[MockUser]:
    return MOCK_USERS


@router.get("/pois", response_model=list[MockPoi])
def list_mock_pois() -> list[MockPoi]:
    return MOCK_POIS


@router.post("/generate-user", response_model=GeneratedMockResponse)
def generate_mock_user(request: GenerateUserRequest) -> GeneratedMockResponse:
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
                        "scenario": request.scenario,
                        "schema": {
                            "users": [
                                {
                                    "id": "string",
                                    "name": "string",
                                    "city": "string",
                                    "scenario": "string",
                                    "preferences": ["string"],
                                    "avoidances": ["string"],
                                    "priority_weights": {"queue": 0.3},
                                    "explain_focus": ["string"],
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
    )
    users, validation_error = _users_from_llm_payload(llm_result.data)
    if not llm_result.fallback_used and users:
        return GeneratedMockResponse(
            fallback_used=False,
            source="longcat",
            users=users,
            metadata={
                "city": request.city,
                "scenario": request.scenario,
                "agent": "MockDataAgent",
                "provider_call": llm_result.trace_output(),
                "validation": "pydantic_passed",
            },
        )

    return GeneratedMockResponse(
        fallback_used=True,
        users=[template_user],
        metadata={
            "city": request.city,
            "scenario": request.scenario,
            "agent": "MockDataAgent",
            "provider_call": llm_result.trace_output(),
            "validation_error": validation_error,
            "note": "LongCat 缺失、失败或输出未通过 schema 校验时，回退确定性模板，保证 Demo 可演示。",
        },
    )


@router.post("/generate-pois", response_model=GeneratedMockResponse)
def generate_mock_pois(request: GeneratePoisRequest) -> GeneratedMockResponse:
    template_pois = [
        poi.model_copy(update={"area": request.area})
        for poi in MOCK_POIS[: request.count]
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
                        "theme": request.theme,
                        "count": request.count,
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
    )
    pois, validation_error = _pois_from_llm_payload(llm_result.data, request)
    if not llm_result.fallback_used and pois:
        geocode_reports = [_geocode_generated_poi(poi) for poi in pois]
        return GeneratedMockResponse(
            fallback_used=False,
            source="longcat",
            pois=pois,
            metadata={
                "city": request.city,
                "area": request.area,
                "theme": request.theme,
                "requested_count": request.count,
                "agent": "MockDataAgent",
                "provider_call": llm_result.trace_output(),
                "geocode_reports": geocode_reports,
                "validation": "pydantic_passed",
            },
        )

    return GeneratedMockResponse(
        fallback_used=True,
        pois=template_pois,
        metadata={
            "city": request.city,
            "area": request.area,
            "theme": request.theme,
            "requested_count": request.count,
            "agent": "MockDataAgent",
            "provider_call": llm_result.trace_output(),
            "validation_error": validation_error,
            "note": "LongCat 缺失、失败或输出未通过 schema 校验时，回退内置 POI 模板。",
        },
    )


def _template_user(request: GenerateUserRequest) -> MockUser:
    return MockUser(
        id="generated-user-template",
        name=f"{request.city}演示用户",
        city=request.city,
        scenario=request.scenario,
        preferences=["低排队", "路线顺路", "推荐理由清楚"],
        avoidances=["热门长队", "临时闭店", "移动跨度太大"],
    )


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
        users = [MockUser(**item) for item in raw.get("users", [])]
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
