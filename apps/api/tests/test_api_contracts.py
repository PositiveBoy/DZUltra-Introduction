import os
import tempfile
from pathlib import Path

_PROFILE_STORE_PATH = Path(tempfile.mkdtemp(prefix="dzultra-profile-test-")) / "user_preferences.json"
os.environ.setdefault("DZULTRA_PROFILE_STORE_PATH", str(_PROFILE_STORE_PATH))
os.environ.setdefault("DZULTRA_STAGE", "v3")
os.environ.setdefault("DZULTRA_MAP_PROVIDER", "amap")
os.environ.setdefault("DZULTRA_WEATHER_PROVIDER", "caiyun")
os.environ.setdefault("DZULTRA_LLM_PROVIDER", "longcat")
os.environ.setdefault("AMAP_WEB_SERVICE_KEY", "test-amap-key")
os.environ.setdefault("CAIYUN_WEATHER_TOKEN", "test-caiyun-token")
os.environ.setdefault("LONGCAT_API_KEY", "test-longcat-key")
os.environ.setdefault("LONGCAT_BACKUP_API_KEY", "test-longcat-backup-key")
os.environ.setdefault("LONGCAT_BASE_URL", "https://api.longcat.chat/openai")
os.environ.setdefault("LONGCAT_MODEL", "LongCat-2.0-Preview")

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_provider_status_reports_v3_configuration_without_raw_keys() -> None:
    response = client.get("/providers/status")
    assert response.status_code == 200
    payload = response.json()
    assert payload["stage"] == "v3"
    providers = {provider["provider"]: provider for provider in payload["providers"]}
    assert providers["amap"]["configured"] is True
    assert providers["caiyun"]["configured"] is True
    assert providers["longcat"]["configured"] is True
    assert payload["llm_base_url"] == "https://api.longcat.chat/openai"
    assert payload["llm_model"] == "LongCat-2.0-Preview"
    assert "***" in providers["amap"]["masked_key"]
    assert "***" in providers["caiyun"]["masked_key"]
    assert "***" in providers["longcat"]["masked_key"]
    for env_name in ["AMAP_WEB_SERVICE_KEY", "CAIYUN_WEATHER_TOKEN", "LONGCAT_API_KEY", "LONGCAT_BACKUP_API_KEY"]:
        raw_value = os.environ.get(env_name)
        assert raw_value
        assert raw_value not in response.text


def test_cors_allows_common_local_frontend_origins() -> None:
    for origin in ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]:
        response = client.options(
            "/routes/plan",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
            },
        )

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin


def test_plan_route_returns_trace_and_three_stops() -> None:
    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队", "餐饮", "文化"],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["plan"]["score"] >= 90
    assert len(payload["plan"]["stops"]) >= 3
    assert payload["trace"]["status"] == "completed"
    assert payload["trace"]["runner_mode"] == "deterministic_mock"
    assert [agent["name"] for agent in payload["trace"]["agent_strategy"]] == [
        "InteractionRouterAgent",
        "ConstraintDiscoveryAgent",
        "UserPreferenceAgent",
        "ContextGroundingAgent",
        "PlanSolverAgent",
        "PlanEvaluatorAgent",
        "PlanExplanationAgent",
    ]
    assert payload["trace"]["metadata"]["constraint_ledger"]["version"].startswith("v3-constraint-ledger")
    assert payload["trace"]["metadata"]["agent_prompt_contracts"]
    assert payload["trace"]["metadata"]["langgraph_workflow"]["name"] == "dzultra_v3_planning_graph"
    event_types = [event["type"] for event in payload["trace"]["events"]]
    assert "constraint_discovered" in event_types
    assert "context_collected" in event_types
    assert "context_grounded" in event_types
    assert "preference_detected" in event_types
    assert "candidate_retrieved" in event_types
    assert "map_context_resolved" in event_types
    assert "route_candidate_generated" in event_types
    assert "constraint_checked" in event_types
    assert "route_scored" in event_types
    assert event_types[-1] == "run_completed"
    billable_events = [event for event in payload["trace"]["events"] if event["metadata"].get("token_usage")]
    assert billable_events
    assert all(event["metadata"]["model_name"] for event in billable_events)
    assert all(event["metadata"]["estimated_cost_cny"] >= 0 for event in billable_events)
    assert len(payload["plans"]) >= 3
    assert payload["selected_plan_id"] == payload["plan"]["id"]
    assert payload["generation_metadata"]["runner_mode"] == "deterministic_mock"
    assert payload["planning_status"] == "completed"
    assert payload["interaction_type"] == "new_planning_task"
    assert payload["requirement_summary"]["can_plan"] is True
    assert all(stop["duration_minutes"] > 0 for stop in payload["plan"]["stops"])
    assert payload["plan"]["rank_reason"]
    assert payload["plan"]["score_breakdown"]
    assert payload["plan"]["map_preview"]["provider"] == "mock_map_provider"
    assert payload["plan"]["map_preview"]["route_segments"]
    assert payload["generation_metadata"]["simulated_total_duration_ms"] == payload["trace"]["total_duration_ms"]
    selected_poi_ids = {stop["poi_id"] for plan in payload["plans"] for stop in plan["stops"]}
    assert "poi-004" not in selected_poi_ids
    assert "poi-011" not in selected_poi_ids
    assert any(constraint["key"] == "booking_readiness" and constraint["satisfied"] for constraint in payload["plan"]["constraints"])
    retrieval_events = [event for event in payload["trace"]["events"] if event["tool_name"] == "provider_adapter.poi_search"]
    rejected_reasons = [
        item["reason"]
        for event in retrieval_events
        for item in event["tool_output"]["rejected"]
    ]
    assert any("需提前 1 天预约/购票" in reason and "不加入最终 plan" in reason for reason in rejected_reasons)


def test_plan_route_pauses_for_missing_required_information() -> None:
    response = client.post(
        "/routes/plan",
        json={
            "user_id": "anonymous",
            "goal": "今天下午在北京逛逛",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["planning_status"] == "needs_clarification"
    assert payload["trace"]["status"] == "running"
    assert payload["plans"] == []
    assert payload["requirement_summary"]["missing_required_fields"] == ["group_size", "food_preference"]
    assert {card["field"] for card in payload["clarification_cards"]} == {"people", "food"}
    assert all(card["blocks_planning"] for card in payload["clarification_cards"])
    assert all(card["allow_other"] for card in payload["clarification_cards"])
    assert {card["ui_component"] for card in payload["clarification_cards"]} == {"number_picker", "choice_buttons"}


def test_plan_route_uses_clarification_answers_and_respects_no_food() -> None:
    response = client.post(
        "/routes/plan",
        json={
            "user_id": "anonymous",
            "goal": "今天下午在北京逛逛",
            "clarification_answers": {
                "people": "2 人",
                "food": "不吃任何东西",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["planning_status"] == "completed"
    assert payload["requirement_summary"]["collected"]["group_size"] == 2
    assert payload["requirement_summary"]["collected"]["food_preference"] == "不吃任何东西"
    categories = {stop["category"] for plan in payload["plans"] for stop in plan["stops"]}
    assert "food" not in categories
    assert "dessert" not in categories
    assert all(stop["duration_minutes"] > 0 for stop in payload["plan"]["stops"])


def test_plan_route_can_wait_for_requirement_confirmation() -> None:
    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
            "require_confirmation": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["planning_status"] == "needs_confirmation"
    assert payload["requirement_summary"]["can_plan"] is True
    assert payload["plans"] == []
    assert payload["trace"]["status"] == "running"

    confirmed_response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
            "require_confirmation": True,
            "confirmed_requirements": True,
        },
    )
    assert confirmed_response.status_code == 200
    assert confirmed_response.json()["planning_status"] == "completed"


def test_refine_route_returns_diff_and_refinement_trace_event() -> None:
    plan_response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
        },
    )
    plan_payload = plan_response.json()

    response = client.post(
        "/routes/refine",
        json={
            "trace_id": plan_payload["trace_id"],
            "route_id": plan_payload["selected_plan_id"],
            "instruction": "第一站换成川菜，保留第二个",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["refinement_diff"]["strategy"] == "local_replace"
    assert any(change["type"] == "replaced" for change in payload["refinement_diff"]["changes"])
    assert payload["interaction_type"] == "refine_current_plan"
    event_types = [event["type"] for event in payload["trace"]["events"]]
    assert "user_refinement_received" in event_types
    assert payload["plan"]["stops"][0]["category"] == "food"
    assert payload["plan"]["stops"][0]["poi_id"] != plan_payload["plan"]["stops"][0]["poi_id"]


def test_refine_route_can_full_rerun_when_user_changes_direction() -> None:
    plan_response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
        },
    )
    plan_payload = plan_response.json()

    response = client.post(
        "/routes/refine",
        json={
            "trace_id": plan_payload["trace_id"],
            "route_id": plan_payload["selected_plan_id"],
            "instruction": "不要这个，重新生成一个室内带娃的新方案",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["refinement_diff"]["strategy"] == "full_rerun"
    assert payload["planning_status"] == "completed"
    event_types = [event["type"] for event in payload["trace"]["events"]]
    assert "user_refinement_received" in event_types
    assert len(payload["plans"]) >= 3


def test_plan_route_records_switch_task_from_plan_context() -> None:
    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "算了，明天带娃去上海迪士尼附近玩，下午吃饭",
            "city": "上海",
            "skip_clarification": True,
            "interaction_context": {
                "page": "plans",
                "trace_id": "trace-old",
                "route_id": "route-old",
                "selected_plan_id": "route-old",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["interaction_type"] == "switch_task"
    event_types = [event["type"] for event in payload["trace"]["events"]]
    assert "task_switched" in event_types


def test_traces_list_returns_summaries() -> None:
    client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
        },
    )

    response = client.get("/traces")

    assert response.status_code == 200
    payload = response.json()
    assert payload
    assert "event_count" in payload[0]
    assert "events" not in payload[0]


def test_profile_preferences_are_detected_updated_deleted_and_persisted() -> None:
    detect_response = client.post(
        "/profiles/preferences/detect",
        json={
            "user_id": "user-profile-test",
            "utterance": "我喜欢咖啡馆，少走路，别太吵，预算别太贵",
            "source_trace_id": "trace-profile-test",
        },
    )

    assert detect_response.status_code == 200
    detected_payload = detect_response.json()
    detected_labels = {preference["label"] for preference in detected_payload["detected_preferences"]}
    assert {"咖啡馆", "少走路", "安静聊天", "性价比"}.issubset(detected_labels)
    assert _PROFILE_STORE_PATH.exists()
    persisted_after_detect = _PROFILE_STORE_PATH.read_text(encoding="utf-8")
    assert "user-profile-test" in persisted_after_detect
    assert "咖啡馆" in persisted_after_detect

    preference_id = detected_payload["profile"]["preferences"][0]["id"]
    update_response = client.patch(
        f"/profiles/user-profile-test/preferences/{preference_id}",
        json={"label": "少走路优先"},
    )

    assert update_response.status_code == 200
    assert update_response.json()["label"] == "少走路优先"
    assert "少走路优先" in _PROFILE_STORE_PATH.read_text(encoding="utf-8")

    delete_response = client.delete(f"/profiles/user-profile-test/preferences/{preference_id}")

    assert delete_response.status_code == 200
    remaining_ids = {preference["id"] for preference in delete_response.json()["preferences"]}
    assert preference_id not in remaining_ids
    assert preference_id not in _PROFILE_STORE_PATH.read_text(encoding="utf-8")


def test_reserved_mock_generation_endpoints_return_fallback_templates() -> None:
    user_response = client.post(
        "/mock/generate-user",
        json={"city": "北京", "scenario": "周六下午约会"},
    )
    pois_response = client.post(
        "/mock/generate-pois",
        json={"city": "北京", "area": "三里屯", "theme": "低排队约会路线", "count": 3},
    )

    assert user_response.status_code == 200
    assert user_response.json()["fallback_used"] is True
    assert user_response.json()["users"][0]["scenario"] == "周六下午约会"
    assert pois_response.status_code == 200
    assert len(pois_response.json()["pois"]) == 3


def test_chat_respond_returns_answer_related_pois_and_trace() -> None:
    response = client.post(
        "/chat/respond",
        json={
            "user_id": "anonymous",
            "message": "附近有没有适合聊天、不太排队的咖啡馆？",
            "city": "北京",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"]
    assert payload["related_pois"]
    assert payload["can_convert_to_plan"] is True
    assert payload["interaction_type"] == "chat_answer"
    assert payload["trace"]["status"] == "completed"
    assert [agent["name"] for agent in payload["trace"]["agent_strategy"]] == [
        "InteractionRouterAgent",
        "UserPreferenceAgent",
        "ContextGroundingAgent",
        "ChatAnswerAgent",
    ]
    event_types = [event["type"] for event in payload["trace"]["events"]]
    assert "chat_answered" in event_types
    assert "candidate_retrieved" in event_types


def test_mock_map_provider_endpoints_return_route_facts() -> None:
    geocode_response = client.post("/maps/geocode", json={"poi_id": "poi-001", "city": "北京"})
    assert geocode_response.status_code == 200
    geocode_payload = geocode_response.json()
    assert geocode_payload["provider"] == "mock_map_provider"
    assert geocode_payload["coordinate_confidence"] == "verified"
    assert geocode_payload["location"]["latitude"]

    matrix_response = client.post(
        "/maps/route-matrix",
        json={
            "mode": "taxi",
            "locations": [
                {"id": "poi-001", "name": "三里屯北区小馆", "city": "北京"},
                {"id": "poi-002", "name": "红砖当代艺术空间", "city": "北京"},
            ],
        },
    )

    assert matrix_response.status_code == 200
    matrix_payload = matrix_response.json()
    assert matrix_payload["provider"] == "mock_map_provider"
    assert matrix_payload["legs"][0]["distance_meters"] > 0
    assert matrix_payload["legs"][0]["duration_minutes"] > 0

    preview_response = client.post(
        "/maps/static-preview",
        json={
            "locations": [
                {"id": "poi-001", "name": "三里屯北区小馆", "city": "北京"},
                {"id": "poi-003", "name": "亮马河露台甜品", "city": "北京"},
            ]
        },
    )

    assert preview_response.status_code == 200
    preview_payload = preview_response.json()["preview"]
    assert preview_payload["provider"] == "amap"
    assert preview_payload["preview_type"] == "mock_vector"
    assert preview_payload["static_image_url"] is None
    assert len(preview_payload["visual_points"]) == 2
