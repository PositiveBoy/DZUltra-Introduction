#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== V3 API contract tests =="
conda run -n agent pytest apps/api/tests/test_api_contracts.py

echo "== V3 ai_generated_dataset smoke checks =="
conda run -n agent python - <<'PY'
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path.cwd()
sys.path.insert(0, str(ROOT / "apps" / "api"))

profile_store = Path(tempfile.mkdtemp(prefix="dzultra-v3-smoke-")) / "user_preferences.json"
os.environ.setdefault("DZULTRA_PROFILE_STORE_PATH", str(profile_store))
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


def post(path: str, payload: dict) -> dict:
    response = client.post(path, json=payload)
    assert response.status_code == 200, f"{path} returned {response.status_code}: {response.text[:800]}"
    return response.json()


def assert_generation_source(payload: dict) -> None:
    if payload.get("fallback_used"):
        assert payload.get("source") == "fallback_template", payload
        assert payload.get("data_origin") == "fallback_template", payload
        assert payload.get("reliability") == "fallback_template", payload
    else:
        assert payload.get("source") == "ai_generated_dataset", payload
        assert payload.get("data_origin") == "ai_generated_dataset", payload
        assert payload.get("reliability") == "generated_validated", payload


new_user = post(
    "/mock/generate-user",
    {"user_type": "new", "city": "北京", "area": "三里屯", "customization": "不喜欢排队"},
)
assert_generation_source(new_user)
assert new_user["fallback_used"] is False, new_user
assert new_user["users"], new_user
assert new_user["users"][0]["user_type"] == "new", new_user
assert new_user["users"][0]["ugc_reviews"] == [], new_user

regular_user = post(
    "/mock/generate-user",
    {"user_type": "regular", "city": "北京", "area": "三里屯", "customization": "老用户，不喜欢排队，常写 UGC"},
)
assert_generation_source(regular_user)
assert regular_user["users"], regular_user

pois = post(
    "/mock/generate-pois",
    {"city": "北京", "area": "三里屯", "count": 20, "customization": "覆盖吃饭、看展、甜品、购物"},
)
assert_generation_source(pois)
assert len(pois["pois"]) == 20, len(pois["pois"])

route = post(
    "/routes/plan",
    {
        "user_id": "user-date-001",
        "goal": "今天下午在北京三里屯附近约会，不喜欢排队，想吃饭加看展",
        "city": "北京",
        "constraints": ["低排队", "少走路"],
    },
)
trace = route["trace"]
assert trace["runner_mode"] == "real_agent_ai_generated_data", trace["runner_mode"]
assert route["generation_metadata"]["runner_mode"] == "real_agent_ai_generated_data", route["generation_metadata"]
tool_events = [event for event in trace["events"] if event.get("tool_name")]
assert tool_events, "route trace has no tool events"
assert all("tool_input" in event and "tool_output" in event for event in tool_events), tool_events
assert any(event["tool_name"] == "provider_adapter.poi_search" for event in tool_events), tool_events

chat = post(
    "/chat/respond",
    {"user_id": "anonymous", "message": "附近有没有适合聊天、不太排队的咖啡馆？", "city": "北京"},
)
chat_trace = chat["trace"]
assert chat_trace["runner_mode"] == "real_agent_ai_generated_data", chat_trace["runner_mode"]
chat_tool_events = [event for event in chat_trace["events"] if event.get("tool_name")]
assert chat_tool_events, "chat trace has no tool events"
assert all("tool_input" in event and "tool_output" in event for event in chat_tool_events), chat_tool_events

print("smoke ok: ai_generated_dataset source, runner_mode, and ToolUse trace are valid")
PY

echo "== Web lint =="
npm run lint --workspace apps/web

echo "== Web build =="
npm run build --workspace apps/web

if [[ -n "${DZULTRA_VERCEL_URL:-}" ]]; then
  BASE_URL="${DZULTRA_VERCEL_URL%/}"
  echo "== Optional Vercel smoke checks: $BASE_URL =="
  health_status="$(curl -sS -o /tmp/dzultra-vercel-health.json -w "%{http_code}" "$BASE_URL/api/health" || true)"
  echo "GET /api/health -> $health_status"
  cat /tmp/dzultra-vercel-health.json || true
  echo

  user_status="$(curl -sS -o /tmp/dzultra-vercel-user.json -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -d '{"user_type":"new","city":"北京","area":"三里屯","customization":"不喜欢排队"}' \
    "$BASE_URL/api/mock/generate-user" || true)"
  echo "POST /api/mock/generate-user -> $user_status"
  cat /tmp/dzultra-vercel-user.json || true
  echo

  poi_status="$(curl -sS -o /tmp/dzultra-vercel-pois.json -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -d '{"city":"北京","area":"三里屯","count":20}' \
    "$BASE_URL/api/mock/generate-pois" || true)"
  echo "POST /api/mock/generate-pois -> $poi_status"
  cat /tmp/dzultra-vercel-pois.json || true
  echo

  if [[ "$health_status" != "200" || "$user_status" != "200" || "$poi_status" != "200" ]]; then
    echo "Vercel smoke failed. Check rewrite/API base URL for the printed paths." >&2
    exit 1
  fi
else
  echo "== Optional Vercel smoke checks skipped =="
  echo "Set DZULTRA_VERCEL_URL=https://your-deployment.vercel.app to verify online /api paths."
fi

echo "V3 ai_generated_dataset checks passed."
