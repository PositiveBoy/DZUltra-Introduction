import json
from pathlib import Path

from app.models.schemas import MockPoi, MockUser, RoutePlan


MOCK_DIR = Path(__file__).resolve().parents[4] / "data" / "mock"
# Vercel 部署时 data 目录被复制到 api_backend/data/
_VERCEL_MOCK_DIR = Path(__file__).resolve().parents[2] / "data" / "mock"
if not MOCK_DIR.exists() and _VERCEL_MOCK_DIR.exists():
    MOCK_DIR = _VERCEL_MOCK_DIR


def _load_json(filename: str) -> list[dict]:
    return json.loads((MOCK_DIR / filename).read_text(encoding="utf-8"))


MOCK_USERS = [MockUser(**item) for item in _load_json("users.json")]
MOCK_POIS = [MockPoi(**item) for item in _load_json("pois.json")]
SAMPLE_ROUTES = [RoutePlan(**item) for item in _load_json("routes.json")]
SAMPLE_ROUTE = SAMPLE_ROUTES[0]

# ── AI Mock 生成器数据覆盖层 ──
# 前端通过 /mock/apply-users 和 /mock/apply-pois 注入生成器产生的数据，
# Agent 流程优先使用这些数据而非静态 JSON。

_applied_users: list[MockUser] = []
_applied_pois: list[MockPoi] = []


def apply_generated_users(users: list[MockUser]) -> None:
    """将 AI Mock 生成器产生的用户数据注入覆盖层。"""
    global _applied_users
    _applied_users = users


def apply_generated_pois(pois: list[MockPoi]) -> None:
    """将 AI Mock 生成器产生的 POI 数据注入覆盖层。"""
    global _applied_pois
    _applied_pois = pois


def get_active_users() -> list[MockUser]:
    """返回当前活跃的用户数据：优先使用注入数据，否则使用静态数据。"""
    return _applied_users if _applied_users else MOCK_USERS


def get_active_pois() -> list[MockPoi]:
    """返回当前活跃的 POI 数据：优先使用注入数据，否则使用静态数据。"""
    return _applied_pois if _applied_pois else MOCK_POIS
