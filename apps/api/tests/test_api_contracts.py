import os
import tempfile
import json
from pathlib import Path
from types import SimpleNamespace

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
from app.providers import adapter as provider_adapter_module


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
    assert payload["trace"]["runner_mode"] == "real_agent_ai_generated_data"
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
    assert payload["generation_metadata"]["runner_mode"] == "real_agent_ai_generated_data"
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


def test_plan_route_handles_amap_poi_ids_without_mock_lookup_crash(monkeypatch) -> None:
    fake_settings = SimpleNamespace(
        map_provider="amap",
        amap_web_service_key="real-amap-key-for-unit-test",
        llm_provider="longcat",
        longcat_model="LongCat-Unit-Test",
        has_real_amap=lambda: True,
        has_amap=lambda: True,
        has_real_longcat=lambda: False,
    )
    monkeypatch.setattr(provider_adapter_module, "settings", fake_settings)

    def fake_amap_get(path: str, params: dict[str, str]) -> dict:
        keyword = params["keywords"]
        category_seed = {
            "餐厅": ("B000A9ONPA", "望京低排队餐厅", "116.481028,39.996726"),
            "美术馆 展览": ("B000A9ONPB", "望京小型展览馆", "116.487118,39.998112"),
            "咖啡 甜品": ("B000A9ONPC", "望京安静咖啡", "116.491230,39.995981"),
            "商场": ("B000A9ONPD", "望京周末商场", "116.475811,39.992310"),
            "公园 亲子": ("B000A9ONPE", "望京亲子公园", "116.470811,39.991310"),
        }[keyword]
        poi_id, name, location = category_seed
        return {
            "status": "1",
            "pois": [
                {
                    "id": poi_id,
                    "name": name,
                    "location": location,
                    "adname": "朝阳区",
                    "address": f"{name}测试地址",
                    "tel": "010-12345678",
                    "business": {"business_area": "望京"},
                    "biz_ext": {"rating": "4.7", "cost": "136", "open_time": "10:00-22:00"},
                    "photos": [{"url": f"https://img.example.test/{poi_id}.jpg"}],
                    "tag": "适合约会;低排队",
                },
                {
                    "id": f"{poi_id}2",
                    "name": f"{name}备选",
                    "location": location,
                    "adname": "朝阳区",
                    "address": f"{name}备选测试地址",
                    "business": {"business_area": "望京"},
                    "biz_ext": {"rating": "4.4", "cost": "118"},
                    "photos": [],
                    "tag": "备选",
                },
            ],
        }

    monkeypatch.setattr(provider_adapter_module.provider_adapter, "_amap_get", fake_amap_get)

    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午两个人在望京约会，少排队，吃饭加看展再喝咖啡",
            "city": "北京",
            "constraints": ["低排队"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["planning_status"] == "completed"
    assert all(stop["poi_id"].startswith("amap-") for stop in payload["plan"]["stops"])
    retrieval_events = [event for event in payload["trace"]["events"] if event["tool_name"] == "provider_adapter.poi_search"]
    provider_call = retrieval_events[0]["tool_output"]["provider_call"]
    assert provider_call["provider"] == "amap"
    assert provider_call["fallback_used"] is False
    first_candidate = retrieval_events[0]["tool_output"]["candidates"][0]
    assert first_candidate["poi"]["source"] == "amap"
    assert first_candidate["poi"]["field_reliability"]["name"] == "verified"
    assert first_candidate["poi"]["enrichment_reliability"]["queue_minutes"] == "generated_validated"
    deep_events = [
        event
        for event in payload["trace"]["events"]
        if event["tool_name"] == "provider_adapter.mock_deep_poi_enrichment"
    ]
    assert deep_events[0]["tool_output"]["provider_call"]["provider"] == "ai_generated_dataset"
    assert deep_events[0]["tool_output"]["provider_call"]["reliability"] == "generated_validated"
    assert deep_events[0]["fallback_used"] is False


def test_plan_route_records_mock_fallback_for_invalid_amap_response(monkeypatch) -> None:
    fake_settings = SimpleNamespace(
        map_provider="amap",
        amap_web_service_key="real-amap-key-for-unit-test",
        llm_provider="longcat",
        longcat_model="LongCat-Unit-Test",
        has_real_amap=lambda: True,
        has_amap=lambda: True,
        has_real_longcat=lambda: False,
    )
    monkeypatch.setattr(provider_adapter_module, "settings", fake_settings)
    monkeypatch.setattr(
        provider_adapter_module.provider_adapter,
        "_amap_get",
        lambda path, params: {"status": "1", "pois": {"bad": "shape"}},
    )

    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "city": "北京",
            "constraints": ["低排队"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    retrieval_events = [event for event in payload["trace"]["events"] if event["tool_name"] == "provider_adapter.poi_search"]
    provider_call = retrieval_events[0]["tool_output"]["provider_call"]
    assert provider_call["provider"] == "amap"
    assert provider_call["fallback_used"] is True
    assert provider_call["fallback_provider"] == "mock_poi_search"
    assert "pois" in provider_call["error"]


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


def test_ai_generated_dataset_endpoints_report_source_and_fallback_semantics() -> None:
    new_user_response = client.post(
        "/mock/generate-user",
        json={"city": "北京", "user_type": "new", "customization": "不喜欢排队"},
    )
    regular_user_response = client.post(
        "/mock/generate-user",
        json={"city": "北京", "user_type": "regular", "customization": "周六下午约会，不喜欢排队"},
    )
    pois_response = client.post(
        "/mock/generate-pois",
        json={"city": "北京", "area": "三里屯", "count": 3},
    )

    assert new_user_response.status_code == 200
    new_user_payload = new_user_response.json()
    assert new_user_payload["source"] == "ai_generated_dataset"
    assert new_user_payload["data_origin"] == "ai_generated_dataset"
    assert new_user_payload["fallback_used"] is False
    assert new_user_payload["reliability"] == "generated_validated"
    assert new_user_payload["users"][0]["user_type"] == "new"
    assert new_user_payload["users"][0]["ugc_reviews"] == []

    assert regular_user_response.status_code == 200
    regular_user_payload = regular_user_response.json()
    if regular_user_payload["fallback_used"]:
        assert regular_user_payload["source"] == "fallback_template"
        assert regular_user_payload["data_origin"] == "fallback_template"
        assert regular_user_payload["reliability"] == "fallback_template"
    else:
        assert regular_user_payload["source"] == "ai_generated_dataset"
        assert regular_user_payload["data_origin"] == "ai_generated_dataset"
        assert regular_user_payload["reliability"] == "generated_validated"
    assert regular_user_payload["users"][0]["scenario"]

    assert pois_response.status_code == 200
    pois_payload = pois_response.json()
    if pois_payload["fallback_used"]:
        assert pois_payload["source"] == "fallback_template"
        assert pois_payload["data_origin"] == "fallback_template"
        assert pois_payload["reliability"] == "fallback_template"
    else:
        assert pois_payload["source"] == "ai_generated_dataset"
        assert pois_payload["data_origin"] == "ai_generated_dataset"
        assert pois_payload["reliability"] == "generated_validated"
    assert len(pois_payload["pois"]) == 3


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
    # ChatResponse 包含 fallback 和 provider 标记
    assert isinstance(payload["fallback_used"], bool)
    assert isinstance(payload["poi_provider"], str)
    assert isinstance(payload["answer_provider"], str)
    # 每个 related_poi 包含 source 和 reliability
    for poi in payload["related_pois"]:
        assert "source" in poi
        assert "reliability" in poi
        assert isinstance(poi["reliability"], dict)
    assert [agent["name"] for agent in payload["trace"]["agent_strategy"]] == [
        "InteractionRouterAgent",
        "UserPreferenceAgent",
        "ContextGroundingAgent",
        "ChatAnswerAgent",
    ]
    event_types = [event["type"] for event in payload["trace"]["events"]]
    assert "chat_answered" in event_types
    assert "candidate_retrieved" in event_types
    assert "context_grounded" in event_types
    assert "preference_detected" in event_types
    # 普通问答不生成 plans，不展示 route_scored
    assert "route_scored" not in event_types
    # ContextGroundingAgent 使用 provider_adapter.poi_search
    retrieval_events = [event for event in payload["trace"]["events"] if event["tool_name"] == "provider_adapter.poi_search"]
    assert retrieval_events
    assert "provider_call" in retrieval_events[0]["tool_output"]
    # candidate_retrieved 事件包含 poi_sources
    assert "poi_sources" in retrieval_events[0]["tool_output"]
    for poi_source in retrieval_events[0]["tool_output"]["poi_sources"]:
        assert "poi_id" in poi_source
        assert "source" in poi_source
        assert "reliability" in poi_source
    # ChatAnswerAgent 使用 provider_adapter.llm_chat_completion
    answer_events = [event for event in payload["trace"]["events"] if event["tool_name"] == "provider_adapter.llm_chat_completion"]
    assert answer_events
    assert "provider_call" in answer_events[0]["tool_output"]
    # chat_answered 事件包含 answer_provider 和 fallback 信息
    assert "answer_provider" in answer_events[0]["tool_output"]
    assert "fallback_used" in answer_events[0]["tool_output"]
    assert "fallback_reason" in answer_events[0]["tool_output"]


def test_chat_respond_shows_amap_provider_when_available(monkeypatch) -> None:
    fake_settings = SimpleNamespace(
        map_provider="amap",
        amap_web_service_key="real-amap-key-for-chat-test",
        llm_provider="longcat",
        longcat_model="LongCat-Chat-Test",
        has_real_amap=lambda: True,
        has_amap=lambda: True,
        has_real_longcat=lambda: False,
    )
    monkeypatch.setattr(provider_adapter_module, "settings", fake_settings)

    def fake_amap_get(path: str, params: dict[str, str]) -> dict:
        keyword = params["keywords"]
        if "咖啡" in keyword or "甜品" in keyword:
            poi_id = "B000CHATCAFE"
            name = "望京安静咖啡"
            location = "116.491230,39.995981"
        else:
            poi_id = "B000CHATFOOD"
            name = "望京低排队餐厅"
            location = "116.481028,39.996726"
        return {
            "status": "1",
            "pois": [
                {
                    "id": poi_id,
                    "name": name,
                    "location": location,
                    "adname": "朝阳区",
                    "address": f"{name}测试地址",
                    "tel": "010-88886666",
                    "business": {"business_area": "望京"},
                    "biz_ext": {"rating": "4.6", "cost": "88", "open_time": "09:00-22:00"},
                    "photos": [],
                    "tag": "安静;适合聊天",
                },
            ],
        }

    monkeypatch.setattr(provider_adapter_module.provider_adapter, "_amap_get", fake_amap_get)

    response = client.post(
        "/chat/respond",
        json={
            "user_id": "anonymous",
            "message": "附近有没有适合聊天的咖啡馆？",
            "city": "北京",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"]
    assert payload["related_pois"]
    assert payload["interaction_type"] == "chat_answer"
    # 高德可用时 ChatResponse.poi_provider == "amap"
    assert payload["poi_provider"] == "amap"
    # 高德可用时 Trace 显示 provider=amap
    retrieval_events = [event for event in payload["trace"]["events"] if event["tool_name"] == "provider_adapter.poi_search"]
    provider_call = retrieval_events[0]["tool_output"]["provider_call"]
    assert provider_call["provider"] == "amap"
    assert provider_call["fallback_used"] is False
    # related_pois 来自高德
    assert any(poi["id"].startswith("amap-") for poi in payload["related_pois"])
    # 每个 related_poi 的 source 和 reliability 标记正确
    for poi in payload["related_pois"]:
        assert poi["source"] == "amap"
        assert poi["reliability"]["name"] == "amap"
        assert poi["reliability"]["queue_minutes"] == "generated_validated"
        assert poi["reliability"]["ugc_summary"] == "generated_validated"
        assert poi["reliability"]["recommended_dishes"] == "generated_validated"


def test_chat_respond_shows_mock_fallback_when_amap_unavailable(monkeypatch) -> None:
    fake_settings = SimpleNamespace(
        map_provider="amap",
        amap_web_service_key="real-amap-key-for-chat-fallback-test",
        llm_provider="longcat",
        longcat_model="LongCat-Chat-Test",
        has_real_amap=lambda: True,
        has_amap=lambda: True,
        has_real_longcat=lambda: False,
    )
    monkeypatch.setattr(provider_adapter_module, "settings", fake_settings)
    monkeypatch.setattr(
        provider_adapter_module.provider_adapter,
        "_amap_get",
        lambda path, params: {"status": "1", "pois": {"bad": "shape"}},
    )

    response = client.post(
        "/chat/respond",
        json={
            "user_id": "anonymous",
            "message": "附近有没有适合聊天的咖啡馆？",
            "city": "北京",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"]
    assert payload["related_pois"]
    # 高德不可用时 ChatResponse 标记 fallback
    assert payload["poi_provider"] == "mock_poi_search"
    assert payload["fallback_used"] is True
    assert payload["fallback_reason"] is not None
    assert len(payload["fallback_reason"]) > 0
    # 高德不可用时 Trace 显示 fallback_provider=mock_poi_search
    retrieval_events = [event for event in payload["trace"]["events"] if event["tool_name"] == "provider_adapter.poi_search"]
    provider_call = retrieval_events[0]["tool_output"]["provider_call"]
    assert provider_call["fallback_used"] is True
    assert provider_call["fallback_provider"] == "mock_poi_search"
    # 高德不可用时 POI 检索 fallback；深度字段仍保持 AI 生成真实结构数据口径
    for poi in payload["related_pois"]:
        assert poi["source"] == "ai_generated_dataset"
        assert poi["reliability"]["name"] == "generated_validated"
        assert poi["reliability"]["queue_minutes"] == "generated_validated"
        assert poi["reliability"]["ugc_summary"] == "generated_validated"
        assert poi["reliability"]["recommended_dishes"] == "generated_validated"


def test_interactions_respond_routes_nearby_cafe_question_to_chat_answer() -> None:
    response = client.post(
        "/interactions/respond",
        json={
            "user_id": "anonymous",
            "message": "附近有没有适合聊天的咖啡馆？",
            "city": "北京",
            "plan_mode": False,
            "interaction_context": {"page": "searching"},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["interaction_type"] == "chat_answer"
    assert payload["chat"]["answer"]
    assert payload["route_plan"] is None
    assert payload["trace"]["events"][0]["agent"] == "InteractionRouterAgent"
    assert payload["trace"]["events"][0]["output"]["interaction_type"] == "chat_answer"
    assert payload["trace"]["events"][0]["output"]["routing_reason"]
    assert payload["routing"]["routing_reason"]


def test_interactions_respond_routes_clear_trip_goal_to_new_planning_task() -> None:
    response = client.post(
        "/interactions/respond",
        json={
            "user_id": "user-date-001",
            "message": "今天下午两个人在望京约会，少排队，吃饭加看展",
            "city": "北京",
            "plan_mode": True,
            "interaction_context": {"page": "searching"},
            "constraints": ["低排队"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["interaction_type"] == "new_planning_task"
    assert payload["route_plan"]["planning_status"] == "completed"
    assert len(payload["route_plan"]["plans"]) >= 3
    assert payload["chat"] is None
    assert payload["trace"]["events"][0]["agent"] == "InteractionRouterAgent"
    assert payload["trace"]["events"][0]["output"]["interaction_type"] == "new_planning_task"
    assert payload["trace"]["events"][0]["output"]["routing_reason"]


def test_interactions_respond_routes_plan_page_instruction_to_refinement() -> None:
    plan_response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午两个人在望京约会，少排队，吃饭加看展",
            "city": "北京",
            "constraints": ["低排队"],
        },
    )
    plan_payload = plan_response.json()

    response = client.post(
        "/interactions/respond",
        json={
            "user_id": "user-date-001",
            "message": "第二个换成不辣的",
            "city": "北京",
            "plan_mode": True,
            "interaction_context": {
                "page": "plans",
                "trace_id": plan_payload["trace_id"],
                "route_id": plan_payload["selected_plan_id"],
                "selected_plan_id": plan_payload["selected_plan_id"],
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["interaction_type"] == "refine_current_plan"
    assert payload["refinement"]["interaction_type"] == "refine_current_plan"
    assert payload["refinement"]["refinement_diff"]
    assert payload["route_plan"] is None
    assert payload["trace"]["events"][0]["agent"] == "InteractionRouterAgent"
    assert payload["trace"]["events"][0]["output"]["interaction_type"] == "refine_current_plan"
    assert payload["trace"]["events"][0]["output"]["routing_reason"]


def test_interaction_router_records_longcat_success(monkeypatch) -> None:
    fake_settings = SimpleNamespace(
        map_provider="amap",
        llm_provider="longcat",
        longcat_model="LongCat-Router-Test",
        has_real_amap=lambda: False,
        has_amap=lambda: False,
        has_real_longcat=lambda: True,
    )
    monkeypatch.setattr(provider_adapter_module, "settings", fake_settings)

    def fake_chat_completion(messages: list[dict[str, str]], *, temperature: float, max_tokens: int) -> dict:
        is_router = "InteractionRouterAgent" in messages[0]["content"]
        content = (
            json.dumps(
                {
                    "interaction_type": "chat_answer",
                    "intent_kind": "non_planning",
                    "confidence": 0.91,
                    "routing_reason": "搜索页附近咖啡馆咨询，没有完整路线动词，先走普通问答。",
                    "needs_followup": False,
                },
                ensure_ascii=False,
            )
            if is_router
            else "可以，先推荐安静、低排队的咖啡馆。"
        )
        return {
            "id": "router-success",
            "model": "LongCat-Router-Test",
            "choices": [{"message": {"content": content}}],
            "usage": {"prompt_tokens": 20, "completion_tokens": 12, "total_tokens": 32},
        }

    monkeypatch.setattr(provider_adapter_module.longcat_client, "chat_completion", fake_chat_completion)

    response = client.post(
        "/interactions/respond",
        json={
            "user_id": "anonymous",
            "message": "附近有什么咖啡馆",
            "city": "北京",
            "interaction_context": {"page": "searching"},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    router_event = payload["trace"]["events"][0]
    assert payload["interaction_type"] == "chat_answer"
    assert router_event["output"]["provider_call"]["provider"] == "longcat"
    assert router_event["output"]["schema_validation"]["valid"] is True
    assert router_event["metadata"]["routing_source"] == "longcat"
    assert router_event["metadata"]["token_usage"]["total_tokens"] == 32


def test_interaction_router_falls_back_on_invalid_longcat_json(monkeypatch) -> None:
    fake_settings = SimpleNamespace(
        map_provider="amap",
        llm_provider="longcat",
        longcat_model="LongCat-Router-Test",
        has_real_amap=lambda: False,
        has_amap=lambda: False,
        has_real_longcat=lambda: True,
    )
    monkeypatch.setattr(provider_adapter_module, "settings", fake_settings)

    def fake_chat_completion(messages: list[dict[str, str]], *, temperature: float, max_tokens: int) -> dict:
        return {
            "id": "router-invalid-json",
            "model": "LongCat-Router-Test",
            "choices": [{"message": {"content": "这不是 JSON"}}],
            "usage": {"prompt_tokens": 18, "completion_tokens": 4, "total_tokens": 22},
        }

    monkeypatch.setattr(provider_adapter_module.longcat_client, "chat_completion", fake_chat_completion)

    response = client.post(
        "/interactions/respond",
        json={
            "user_id": "anonymous",
            "message": "今天下午两个人在望京约会，少排队，吃饭加看展",
            "city": "北京",
            "interaction_context": {"page": "searching"},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    router_event = payload["trace"]["events"][0]
    assert payload["interaction_type"] == "new_planning_task"
    assert router_event["fallback_used"] is True
    assert router_event["output"]["schema_validation"]["valid"] is False
    assert "JSON parse/schema validation failed" in router_event["output"]["fallback_reason"]
    assert router_event["metadata"]["routing_source"] == "deterministic_router"


def test_interaction_router_falls_back_on_low_confidence_or_provider_failure(monkeypatch) -> None:
    fake_settings = SimpleNamespace(
        map_provider="amap",
        llm_provider="longcat",
        longcat_model="LongCat-Router-Test",
        has_real_amap=lambda: False,
        has_amap=lambda: False,
        has_real_longcat=lambda: True,
    )
    monkeypatch.setattr(provider_adapter_module, "settings", fake_settings)

    def low_confidence_completion(messages: list[dict[str, str]], *, temperature: float, max_tokens: int) -> dict:
        return {
            "id": "router-low-confidence",
            "model": "LongCat-Router-Test",
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "interaction_type": "switch_task",
                                "intent_kind": "ambiguous",
                                "confidence": 0.31,
                                "routing_reason": "不确定。",
                                "needs_followup": True,
                            },
                            ensure_ascii=False,
                        )
                    }
                }
            ],
            "usage": {"prompt_tokens": 18, "completion_tokens": 8, "total_tokens": 26},
        }

    monkeypatch.setattr(provider_adapter_module.longcat_client, "chat_completion", low_confidence_completion)
    low_confidence_response = client.post(
        "/interactions/respond",
        json={
            "user_id": "anonymous",
            "message": "附近有什么咖啡馆",
            "city": "北京",
            "interaction_context": {"page": "searching"},
        },
    )
    low_payload = low_confidence_response.json()
    low_router_event = low_payload["trace"]["events"][0]
    assert low_payload["interaction_type"] == "new_planning_task"
    assert low_router_event["fallback_used"] is True
    assert "below threshold" in low_router_event["output"]["fallback_reason"]

    def failing_completion(messages: list[dict[str, str]], *, temperature: float, max_tokens: int) -> dict:
        raise RuntimeError("router timeout")

    monkeypatch.setattr(provider_adapter_module.longcat_client, "chat_completion", failing_completion)
    failure_response = client.post(
        "/interactions/respond",
        json={
            "user_id": "anonymous",
            "message": "附近有什么咖啡馆",
            "city": "北京",
            "interaction_context": {"page": "searching"},
        },
    )
    failure_payload = failure_response.json()
    failure_router_event = failure_payload["trace"]["events"][0]
    assert failure_payload["interaction_type"] == "new_planning_task"
    assert failure_router_event["fallback_used"] is True
    assert failure_router_event["output"]["provider_call"]["fallback_provider"] == "deterministic_template"
    assert "router timeout" in failure_router_event["output"]["fallback_reason"]


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


# ---------------------------------------------------------------------------
# P0-3: ConstraintDiscoveryAgent 接 LongCat
# ---------------------------------------------------------------------------


def test_constraint_discovery_asks_about_people_and_food_when_vague() -> None:
    """Vague input like '今天下午在北京逛逛' should trigger clarification cards
    for group_size and food_preference (both are blocking fields)."""

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
    card_fields = {card["field"] for card in payload["clarification_cards"]}
    # Must ask about people and food
    assert "people" in card_fields
    assert "food" in card_fields
    # Trace must show ConstraintDiscoveryAgent with constraint ledger
    discovery_events = [
        event for event in payload["trace"]["events"]
        if event["agent"] == "ConstraintDiscoveryAgent" and event["type"] == "constraint_discovered"
    ]
    assert discovery_events
    discovery_event = discovery_events[0]
    assert "constraint_ledger" in discovery_event["tool_output"]
    # Trace must include LLM call info (even if it fell back)
    assert "llm_trace_info" in discovery_event["tool_output"]
    assert "schema_validation" in discovery_event["metadata"]


def test_constraint_discovery_produces_plannable_summary_when_complete() -> None:
    """Complete input like '今天下午两个人在北京约会，不想排队，吃饭加看展'
    should produce a plannable requirement summary."""

    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午两个人在北京约会，不想排队，吃饭加看展",
            "constraints": ["低排队"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["planning_status"] == "completed"
    assert payload["requirement_summary"]["can_plan"] is True
    assert payload["requirement_summary"]["collected"]["group_size"] == 2
    assert payload["requirement_summary"]["collected"]["food_preference"] is not None
    # Trace must show constraint ledger
    discovery_events = [
        event for event in payload["trace"]["events"]
        if event["agent"] == "ConstraintDiscoveryAgent" and event["type"] == "constraint_discovered"
    ]
    assert discovery_events
    discovery_event = discovery_events[0]
    assert "constraint_ledger" in discovery_event["tool_output"]


def test_constraint_discovery_records_longcat_success(monkeypatch) -> None:
    """When LongCat returns valid JSON, Trace should show provider=longcat and schema valid."""

    fake_settings = SimpleNamespace(
        map_provider="amap",
        llm_provider="longcat",
        longcat_model="LongCat-Discovery-Test",
        has_real_amap=lambda: False,
        has_amap=lambda: False,
        has_real_longcat=lambda: True,
    )
    monkeypatch.setattr(provider_adapter_module, "settings", fake_settings)

    def fake_chat_completion(messages: list[dict[str, str]], *, temperature: float, max_tokens: int) -> dict:
        is_discovery = "ConstraintDiscoveryAgent" in messages[0]["content"]
        if is_discovery:
            content = json.dumps(
                {
                    "requirement_summary": {
                        "status": "needs_clarification",
                        "intent_kind": "planning",
                        "can_plan": False,
                        "collected": {
                            "city": "北京",
                            "area": None,
                            "group_size": None,
                            "time_window": "14:00-18:30",
                            "food_preference": None,
                            "budget_per_person": None,
                            "taste": None,
                            "mobility": None,
                            "route_purpose": "本地路线",
                        },
                        "missing_required_fields": ["group_size", "food_preference"],
                        "assumptions": [],
                        "user_visible_summary": [
                            "目的地：北京",
                            "时间：14:00-18:30",
                            "人数：待确认",
                            "饮食：待确认",
                        ],
                        "next_action": "先展示补全卡片，等用户回答后再继续规划。",
                    },
                    "clarification_cards": [
                        {
                            "id": "clarify-people",
                            "question": "这次几个人出行？",
                            "field": "people",
                            "ui_component": "number_picker",
                            "options": ["1 人", "2 人", "3-4 人", "5 人以上"],
                            "default_value": "2 人",
                            "allow_other": True,
                            "round_index": 1,
                            "blocks_planning": True,
                            "required": True,
                            "reason": "人数会影响餐厅订位、排队风险和每站停留时长。",
                        },
                        {
                            "id": "clarify-food",
                            "question": "这条路线里要不要安排吃喝？",
                            "field": "food",
                            "ui_component": "choice_buttons",
                            "options": ["随便", "吃主食", "吃小吃", "喝饮品", "不吃任何东西"],
                            "default_value": "随便",
                            "allow_other": True,
                            "round_index": 1,
                            "blocks_planning": True,
                            "required": True,
                            "reason": "是否包含饮食会决定 POI 类型和路线节奏。",
                        },
                    ],
                    "constraint_ledger_patch": [
                        {
                            "id": "location.city",
                            "label": "城市",
                            "description": "用户目标中包含北京。",
                            "category": "location",
                            "hardness": "hard",
                            "source": "user_explicit",
                            "reliability": "verified",
                            "status": "discovered",
                            "impact": ["filter", "explain"],
                            "weight": 1.0,
                            "requires_grounding": False,
                            "requires_clarification": False,
                        },
                    ],
                    "assumptions": [],
                    "grounding_requests": ["weather", "poi_search"],
                },
                ensure_ascii=False,
            )
        else:
            content = "可以，先推荐安静、低排队的咖啡馆。"
        return {
            "id": "discovery-success",
            "model": "LongCat-Discovery-Test",
            "choices": [{"message": {"content": content}}],
            "usage": {"prompt_tokens": 40, "completion_tokens": 80, "total_tokens": 120},
        }

    monkeypatch.setattr(provider_adapter_module.longcat_client, "chat_completion", fake_chat_completion)

    response = client.post(
        "/routes/plan",
        json={
            "user_id": "anonymous",
            "goal": "今天下午在北京逛逛",
            "city": "北京",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["planning_status"] == "needs_clarification"
    # Trace should show LongCat success
    discovery_events = [
        event for event in payload["trace"]["events"]
        if event["agent"] == "ConstraintDiscoveryAgent" and event["type"] == "constraint_discovered"
    ]
    assert discovery_events
    discovery_event = discovery_events[0]
    assert discovery_event["metadata"]["llm_provider"] == "longcat"
    assert discovery_event["metadata"]["schema_validation"]["valid"] is True
    assert discovery_event["metadata"]["schema_validation"]["source"] == "longcat"
    assert discovery_event["metadata"]["fallback_used"] is False
    assert discovery_event["metadata"]["grounding_requests"] == ["weather", "poi_search"]
    # LLM constraint_ledger_patch should be merged
    assert "constraint_ledger" in discovery_event["tool_output"]
    # Token usage should be recorded
    assert discovery_event["metadata"]["token_usage"]["total_tokens"] == 120


def test_constraint_discovery_falls_back_on_invalid_longcat_json(monkeypatch) -> None:
    """When LongCat returns invalid JSON, should fall back to deterministic analyzer."""

    fake_settings = SimpleNamespace(
        map_provider="amap",
        llm_provider="longcat",
        longcat_model="LongCat-Discovery-Test",
        has_real_amap=lambda: False,
        has_amap=lambda: False,
        has_real_longcat=lambda: True,
    )
    monkeypatch.setattr(provider_adapter_module, "settings", fake_settings)

    call_count = 0

    def fake_chat_completion(messages: list[dict[str, str]], *, temperature: float, max_tokens: int) -> dict:
        nonlocal call_count
        call_count += 1
        is_discovery = "ConstraintDiscoveryAgent" in messages[0]["content"]
        if is_discovery:
            return {
                "id": "discovery-bad-json",
                "model": "LongCat-Discovery-Test",
                "choices": [{"message": {"content": "这不是有效的 JSON"}}],
                "usage": {"prompt_tokens": 30, "completion_tokens": 6, "total_tokens": 36},
            }
        return {
            "id": "other",
            "model": "LongCat-Discovery-Test",
            "choices": [{"message": {"content": "好的"}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 4, "total_tokens": 14},
        }

    monkeypatch.setattr(provider_adapter_module.longcat_client, "chat_completion", fake_chat_completion)

    response = client.post(
        "/routes/plan",
        json={
            "user_id": "anonymous",
            "goal": "今天下午在北京逛逛",
            "city": "北京",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    # Should still work via deterministic fallback
    assert payload["planning_status"] == "needs_clarification"
    discovery_events = [
        event for event in payload["trace"]["events"]
        if event["agent"] == "ConstraintDiscoveryAgent" and event["type"] == "constraint_discovered"
    ]
    assert discovery_events
    discovery_event = discovery_events[0]
    assert discovery_event["fallback_used"] is True
    assert discovery_event["metadata"]["schema_validation"]["valid"] is False
    assert "JSON parse/schema validation failed" in (discovery_event["metadata"].get("fallback_reason") or "")


def test_constraint_discovery_trace_shows_constraint_ledger() -> None:
    """Trace constraint_discovered event must include constraint_ledger in output."""

    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["planning_status"] == "completed"
    discovery_events = [
        event for event in payload["trace"]["events"]
        if event["agent"] == "ConstraintDiscoveryAgent" and event["type"] == "constraint_discovered"
    ]
    assert discovery_events
    discovery_event = discovery_events[0]
    # Must include constraint_ledger in tool_output
    ledger = discovery_event["tool_output"]["constraint_ledger"]
    assert ledger["version"].startswith("v3-constraint-ledger")
    assert any(c["id"] == "goal.user_goal" for c in ledger["constraints"])
    # Must include llm_trace_info
    assert "llm_trace_info" in discovery_event["tool_output"]
    # Must include grounding_requests (even if empty on fallback)
    assert "grounding_requests" in discovery_event["tool_output"]


# ---------------------------------------------------------------------------
# P1-3: PlanSolverAgent multi-candidate route generation
# ---------------------------------------------------------------------------


def test_solver_generates_more_candidates_than_final_plans() -> None:
    """route_candidate_generated event must contain candidate_plans whose count
    exceeds the final plan count (3)."""
    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
        },
    )
    assert response.status_code == 200
    payload = response.json()

    # Find the route_candidate_generated event
    candidate_events = [
        e for e in payload["trace"]["events"]
        if e["type"] == "route_candidate_generated" and e["agent"] == "PlanSolverAgent"
    ]
    assert candidate_events
    event = candidate_events[0]

    # candidate_plans must exist and have more entries than final plans
    assert "candidate_plans" in event["output"]
    candidate_plans = event["output"]["candidate_plans"]
    assert len(candidate_plans) > len(payload["plans"])

    # solver_notes must exist
    assert "solver_notes" in event["output"]
    solver_notes = event["output"]["solver_notes"]
    assert solver_notes["total_candidates_generated"] >= 5
    assert solver_notes["candidates_after_filtering"] >= 3


def test_final_three_plans_have_visible_differences() -> None:
    """The 3 final plans must differ in title, theme, or category order."""
    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    plans = payload["plans"]
    assert len(plans) >= 3

    # At least 2 different themes among the 3 plans
    themes = {plan["theme"] for plan in plans[:3]}
    assert len(themes) >= 2, f"Expected >= 2 different themes, got {themes}"

    # At least 2 different badges
    badges = {plan["badge"] for plan in plans[:3]}
    assert len(badges) >= 2, f"Expected >= 2 different badges, got {badges}"


def test_no_food_route_excludes_food_and_dessert_categories() -> None:
    """When user says 不吃任何东西, no final plan should contain food or dessert stops."""
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

    for plan in payload["plans"]:
        categories = {stop["category"] for stop in plan["stops"]}
        assert "food" not in categories, f"Plan {plan['id']} contains food stop but user said no food"
        assert "dessert" not in categories, f"Plan {plan['id']} contains dessert stop but user said no food"

    # Also check solver_notes confirms no_food_route
    candidate_events = [
        e for e in payload["trace"]["events"]
        if e["type"] == "route_candidate_generated" and e["agent"] == "PlanSolverAgent"
    ]
    if candidate_events:
        solver_notes = candidate_events[0]["output"].get("solver_notes", {})
        assert solver_notes.get("no_food_route") is True


def test_evaluator_outputs_rejected_routes_in_trace() -> None:
    """route_scored event must include rejected_routes with reasons."""
    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
        },
    )
    assert response.status_code == 200
    payload = response.json()

    scored_events = [
        e for e in payload["trace"]["events"]
        if e["type"] == "route_scored" and e["agent"] == "PlanEvaluatorAgent"
    ]
    assert scored_events
    event = scored_events[0]

    # Must have rejected_routes
    assert "rejected_routes" in event["output"]
    rejected = event["output"]["rejected_routes"]
    assert isinstance(rejected, list)

    # Must have evaluation_notes
    assert "evaluation_notes" in event["output"]
    notes = event["output"]["evaluation_notes"]
    assert notes["candidates_evaluated"] >= 3
    assert notes["final_plan_count"] == 3


# ---------------------------------------------------------------------------
# P1-4: PlanEvaluatorAgent scoring explainability
# ---------------------------------------------------------------------------


def test_evaluator_10_dimension_score_breakdown() -> None:
    """Each final plan must have a score_breakdown with all 10 scoring dimensions."""
    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
        },
    )
    assert response.status_code == 200
    payload = response.json()

    required_dimensions = [
        "hard_constraint", "queue", "business_hours", "traffic",
        "weather_fit", "preference_fit", "ugc_quality",
        "route_efficiency", "budget", "diversity",
    ]

    for plan in payload["plans"]:
        assert "score_breakdown" in plan, f"Plan {plan['id']} missing score_breakdown"
        breakdown = plan["score_breakdown"]
        for dim in required_dimensions:
            assert dim in breakdown, f"Plan {plan['id']} score_breakdown missing dimension: {dim}"
            assert isinstance(breakdown[dim], (int, float)), f"Dimension {dim} is not numeric in plan {plan['id']}"

    # Also verify route_scored event has plan_scores with breakdowns
    scored_events = [
        e for e in payload["trace"]["events"]
        if e["type"] == "route_scored" and e["agent"] == "PlanEvaluatorAgent"
    ]
    assert scored_events
    plan_scores = scored_events[0]["output"].get("plan_scores", [])
    for score_item in plan_scores:
        assert "score_breakdown" in score_item, "plan_scores item missing score_breakdown"
        for dim in required_dimensions:
            assert dim in score_item["score_breakdown"], f"plan_scores item missing dimension: {dim}"


def test_evaluator_route_scored_includes_blocking_issues_and_rejected_reasons() -> None:
    """route_scored event must include blocking_issues and rejected_route_reasons."""
    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
        },
    )
    assert response.status_code == 200
    payload = response.json()

    scored_events = [
        e for e in payload["trace"]["events"]
        if e["type"] == "route_scored" and e["agent"] == "PlanEvaluatorAgent"
    ]
    assert scored_events
    event_output = scored_events[0]["output"]

    # Must have blocking_issues
    assert "blocking_issues" in event_output
    blocking_issues = event_output["blocking_issues"]
    assert isinstance(blocking_issues, list)

    # Must have rejected_route_reasons
    assert "rejected_route_reasons" in event_output
    rejected_reasons = event_output["rejected_route_reasons"]
    assert isinstance(rejected_reasons, list)

    # Each rejected route must have a reason string
    for reason in rejected_reasons:
        assert isinstance(reason, str) and len(reason) > 0, "rejected_route_reasons must be non-empty strings"

    # Each rejected route in rejected_routes must have rejected_route_reason
    for rejected in event_output.get("rejected_routes", []):
        assert "rejected_route_reason" in rejected, f"Rejected route {rejected.get('route_id', '?')} missing rejected_route_reason"
        assert isinstance(rejected["rejected_route_reason"], str) and len(rejected["rejected_route_reason"]) > 0


def test_hard_constraint_violations_do_not_enter_final_plans() -> None:
    """Plans with hard_constraint score of 0 must not appear in final plans."""
    response = client.post(
        "/routes/plan",
        json={
            "user_id": "user-date-001",
            "goal": "今天下午想在北京约会，不想排队，想吃饭加看展",
            "constraints": ["低排队"],
        },
    )
    assert response.status_code == 200
    payload = response.json()

    # No final plan should have hard_constraint = 0
    for plan in payload["plans"]:
        breakdown = plan["score_breakdown"]
        assert breakdown.get("hard_constraint", 0) > 0, (
            f"Plan {plan['id']} has hard_constraint=0 but is in final plans"
        )

    # If there are rejected routes, at least one should mention hard constraint
    scored_events = [
        e for e in payload["trace"]["events"]
        if e["type"] == "route_scored" and e["agent"] == "PlanEvaluatorAgent"
    ]
    if scored_events:
        rejected_routes = scored_events[0]["output"].get("rejected_routes", [])
        # Every rejected route should have a reason
        for rejected in rejected_routes:
            assert rejected.get("rejected_route_reason") or rejected.get("reason"), (
                f"Rejected route {rejected.get('route_id', '?')} has no reason"
            )


# ---------------------------------------------------------------------------
# Intent classification and plan_mode routing fixes
# ---------------------------------------------------------------------------


def test_nearby_date_cafe_routes_to_planning_not_chat_answer() -> None:
    """'附近有没有适合约会的咖啡馆' should NOT be classified as non_planning
    because '约会' is a planning context keyword."""
    from app.agents.requirements import _classify_intent

    intent_kind = _classify_intent("附近有没有适合约会的咖啡馆", plan_mode=True)
    assert intent_kind != "non_planning", (
        f"Expected planning or ambiguous, got {intent_kind}"
    )
    assert intent_kind == "planning", (
        f"'约会' + '附近有没有' should be planning, got {intent_kind}"
    )


def test_nearby_food_in_wangjing_routes_by_plan_mode() -> None:
    """'望京有什么好吃的' should route differently based on plan_mode:
    plan_mode=True → new_planning_task, plan_mode=False → chat_answer."""
    # plan_mode=True: ambiguous → new_planning_task
    response_plan_mode_on = client.post(
        "/interactions/respond",
        json={
            "user_id": "anonymous",
            "message": "望京有什么好吃的",
            "city": "北京",
            "plan_mode": True,
            "interaction_context": {"page": "searching"},
        },
    )
    assert response_plan_mode_on.status_code == 200
    payload_on = response_plan_mode_on.json()
    assert payload_on["interaction_type"] == "new_planning_task", (
        f"plan_mode=True should route to new_planning_task, got {payload_on['interaction_type']}"
    )

    # plan_mode=False: ambiguous → chat_answer
    response_plan_mode_off = client.post(
        "/interactions/respond",
        json={
            "user_id": "anonymous",
            "message": "望京有什么好吃的",
            "city": "北京",
            "plan_mode": False,
            "interaction_context": {"page": "searching"},
        },
    )
    assert response_plan_mode_off.status_code == 200
    payload_off = response_plan_mode_off.json()
    assert payload_off["interaction_type"] == "chat_answer", (
        f"plan_mode=False should route to chat_answer, got {payload_off['interaction_type']}"
    )


def test_nearby_convenience_store_always_routes_to_chat_answer() -> None:
    """'附近有便利店吗' should always route to chat_answer regardless of plan_mode,
    because it's a pure nearby POI query without planning context."""
    for plan_mode in [True, False]:
        response = client.post(
            "/interactions/respond",
            json={
                "user_id": "anonymous",
                "message": "附近有便利店吗",
                "city": "北京",
                "plan_mode": plan_mode,
                "interaction_context": {"page": "searching"},
            },
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["interaction_type"] == "chat_answer", (
            f"'附近有便利店吗' with plan_mode={plan_mode} should be chat_answer, "
            f"got {payload['interaction_type']}"
        )


def test_afternoon_date_wangjing_routes_to_new_planning_task() -> None:
    """'今天下午两个人在望京约会，吃饭加看展' should route to new_planning_task."""
    response = client.post(
        "/interactions/respond",
        json={
            "user_id": "user-date-001",
            "message": "今天下午两个人在望京约会，吃饭加看展",
            "city": "北京",
            "plan_mode": True,
            "interaction_context": {"page": "searching"},
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["interaction_type"] == "new_planning_task", (
        f"Expected new_planning_task, got {payload['interaction_type']}"
    )


def test_nearby_cafe_with_plan_mode_true_routes_to_planning() -> None:
    """'附近有什么咖啡馆' + plan_mode=True should route to new_planning_task."""
    response = client.post(
        "/interactions/respond",
        json={
            "user_id": "anonymous",
            "message": "附近有什么咖啡馆",
            "city": "北京",
            "plan_mode": True,
            "interaction_context": {"page": "searching"},
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["interaction_type"] == "new_planning_task", (
        f"plan_mode=True should route ambiguous to new_planning_task, got {payload['interaction_type']}"
    )


def test_nearby_cafe_with_plan_mode_false_routes_to_chat_answer() -> None:
    """'附近有什么咖啡馆' + plan_mode=False should route to chat_answer."""
    response = client.post(
        "/interactions/respond",
        json={
            "user_id": "anonymous",
            "message": "附近有什么咖啡馆",
            "city": "北京",
            "plan_mode": False,
            "interaction_context": {"page": "searching"},
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["interaction_type"] == "chat_answer", (
        f"plan_mode=False should route ambiguous to chat_answer, got {payload['interaction_type']}"
    )
