import json
from pathlib import Path

from app.models.schemas import MockPoi, MockUser, RoutePlan


MOCK_DIR = Path(__file__).resolve().parents[4] / "data" / "mock"


def _load_json(filename: str) -> list[dict]:
    return json.loads((MOCK_DIR / filename).read_text(encoding="utf-8"))


MOCK_USERS = [MockUser(**item) for item in _load_json("users.json")]
MOCK_POIS = [MockPoi(**item) for item in _load_json("pois.json")]
SAMPLE_ROUTES = [RoutePlan(**item) for item in _load_json("routes.json")]
SAMPLE_ROUTE = SAMPLE_ROUTES[0]
