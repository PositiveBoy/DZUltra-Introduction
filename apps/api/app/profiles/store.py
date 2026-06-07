from __future__ import annotations

import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path

from app.models.schemas import PreferenceCategory, UserPreference, UserPreferenceProfile


PROFILE_STORE_ENV = "DZULTRA_PROFILE_STORE_PATH"
DEFAULT_PROFILE_STORE_PATH = Path(__file__).resolve().parents[4] / "data" / "mock" / "user_preferences.json"


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _preference_id(user_id: str, label: str) -> str:
    digest = hashlib.sha1(f"{user_id}:{label}".encode("utf-8")).hexdigest()[:10]
    return f"pref-{digest}"


def _preference(
    user_id: str,
    label: str,
    category: PreferenceCategory,
    source: str,
    source_prompt: str | None = None,
    confidence: float = 0.82,
) -> UserPreference:
    created_at = _now()
    return UserPreference(
        id=_preference_id(user_id, label),
        label=label,
        category=category,
        source=source,
        source_prompt=source_prompt,
        confidence=confidence,
        created_at=created_at,
        updated_at=created_at,
    )


def _seed_preferences() -> dict[str, list[UserPreference]]:
    return {
        "user-date-001": [
            _preference("user-date-001", "低排队", "avoidance", "历史路线与本轮对话", confidence=0.9),
            _preference("user-date-001", "约会氛围", "scenario", "默认 mock 用户画像", confidence=0.84),
            _preference("user-date-001", "步行友好", "mobility", "历史选择", confidence=0.78),
            _preference("user-date-001", "可拍照", "experience", "用户显式提到", confidence=0.8),
        ]
    }


def _store_path() -> Path:
    return Path(os.environ.get(PROFILE_STORE_ENV, DEFAULT_PROFILE_STORE_PATH)).expanduser()


def _load_preferences() -> dict[str, list[UserPreference]]:
    path = _store_path()
    if not path.exists():
        preferences = _seed_preferences()
        _persist_preferences(preferences)
        return preferences

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        profiles = payload.get("profiles", {})
        return {
            user_id: [UserPreference.model_validate(item) for item in items]
            for user_id, items in profiles.items()
            if isinstance(items, list)
        }
    except (OSError, json.JSONDecodeError, ValueError, TypeError):
        return _seed_preferences()


def _persist_preferences(preferences: dict[str, list[UserPreference]] | None = None) -> None:
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "profiles": {
            user_id: [preference.model_dump(mode="json") for preference in user_preferences]
            for user_id, user_preferences in (preferences or _PREFERENCES).items()
        }
    }
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(path)


_PREFERENCES: dict[str, list[UserPreference]] = _load_preferences()


def list_user_preferences(user_id: str) -> UserPreferenceProfile:
    return UserPreferenceProfile(user_id=user_id, preferences=list(_PREFERENCES.get(user_id, [])))


def preference_labels_for_user(user_id: str) -> list[str]:
    return [preference.label for preference in _PREFERENCES.get(user_id, [])]


def detect_and_store_preferences(
    user_id: str,
    utterance: str,
    source_trace_id: str | None = None,
) -> list[UserPreference]:
    if user_id == "anonymous" or not utterance.strip():
        return []

    detected = _detect_preferences(user_id, utterance, source_trace_id)
    if not detected:
        return []

    existing = {preference.label: preference for preference in _PREFERENCES.setdefault(user_id, [])}
    upserted: list[UserPreference] = []
    for preference in detected:
        current = existing.get(preference.label)
        if current:
            updated = current.model_copy(
                update={
                    "source": preference.source,
                    "source_prompt": preference.source_prompt,
                    "confidence": max(current.confidence, preference.confidence),
                    "updated_at": _now(),
                }
            )
            _replace_preference(user_id, updated)
            upserted.append(updated)
            continue

        _PREFERENCES[user_id].append(preference)
        existing[preference.label] = preference
        upserted.append(preference)
    _persist_preferences()
    return upserted


def update_user_preference(user_id: str, preference_id: str, label: str) -> UserPreference | None:
    normalized = label.strip()
    if not normalized:
        return None

    for preference in _PREFERENCES.get(user_id, []):
        if preference.id == preference_id:
            updated = preference.model_copy(
                update={
                    "label": normalized,
                    "source": "用户在设置页手动修正",
                    "confidence": 1.0,
                    "updated_at": _now(),
                }
            )
            _replace_preference(user_id, updated)
            _persist_preferences()
            return updated
    return None


def delete_user_preference(user_id: str, preference_id: str) -> UserPreferenceProfile:
    _PREFERENCES[user_id] = [
        preference for preference in _PREFERENCES.get(user_id, []) if preference.id != preference_id
    ]
    _persist_preferences()
    return list_user_preferences(user_id)


def _replace_preference(user_id: str, updated: UserPreference) -> None:
    _PREFERENCES[user_id] = [
        updated if preference.id == updated.id else preference for preference in _PREFERENCES.get(user_id, [])
    ]


def _detect_preferences(
    user_id: str,
    utterance: str,
    source_trace_id: str | None,
) -> list[UserPreference]:
    normalized = utterance.replace(" ", "")
    source = f"AI 从本轮输入检测{f' · {source_trace_id}' if source_trace_id else ''}"
    detected: list[UserPreference] = []

    rules: list[tuple[str, str, PreferenceCategory, float]] = [
        ("不想排队|低排队|少排队|别排队", "低排队", "avoidance", 0.92),
        ("少走路|别太累|不想走|轻松点", "少走路", "mobility", 0.9),
        ("步行|散步|citywalk|Citywalk", "步行友好", "mobility", 0.78),
        ("约会|情侣|聊天", "约会氛围", "scenario", 0.82),
        ("安静|别太吵|好聊天", "安静聊天", "experience", 0.84),
        ("拍照|出片|打卡", "可拍照", "experience", 0.82),
        ("咖啡|咖啡馆|坐坐", "咖啡馆", "taste", 0.78),
        ("甜品|奶茶|喝饮品", "甜品饮品", "taste", 0.76),
        ("川菜|火锅|重口|重辣|无辣不欢", "川菜重口味", "taste", 0.88),
        ("微辣|少辣", "微辣可以", "taste", 0.82),
        ("不吃辣|不要辣|清淡", "清淡不辣", "taste", 0.88),
        ("带娃|孩子|亲子", "亲子友好", "scenario", 0.9),
        ("便宜|性价比|别太贵|预算", "性价比", "budget", 0.78),
    ]

    for pattern, label, category, confidence in rules:
        if _contains_any(normalized, pattern):
            detected.append(
                _preference(
                    user_id=user_id,
                    label=label,
                    category=category,
                    source=source,
                    source_prompt=utterance,
                    confidence=confidence,
                )
            )

    return _dedupe_preferences(detected)


def _contains_any(text: str, pattern: str) -> bool:
    return any(keyword in text for keyword in pattern.split("|"))


def _dedupe_preferences(preferences: list[UserPreference]) -> list[UserPreference]:
    by_label: dict[str, UserPreference] = {}
    for preference in preferences:
        current = by_label.get(preference.label)
        if not current or preference.confidence > current.confidence:
            by_label[preference.label] = preference
    return list(by_label.values())
