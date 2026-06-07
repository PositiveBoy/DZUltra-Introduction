from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    PreferenceDetectionRequest,
    PreferenceDetectionResponse,
    PreferenceUpdateRequest,
    UserPreference,
    UserPreferenceProfile,
)
from app.profiles.store import (
    delete_user_preference,
    detect_and_store_preferences,
    list_user_preferences,
    update_user_preference,
)

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/{user_id}/preferences", response_model=UserPreferenceProfile)
def get_user_preferences(user_id: str) -> UserPreferenceProfile:
    return list_user_preferences(user_id)


@router.post("/preferences/detect", response_model=PreferenceDetectionResponse)
def detect_preferences(request: PreferenceDetectionRequest) -> PreferenceDetectionResponse:
    detected = detect_and_store_preferences(
        user_id=request.user_id,
        utterance=request.utterance,
        source_trace_id=request.source_trace_id,
    )
    skipped_reason = None
    if request.user_id == "anonymous":
        skipped_reason = "匿名用户未授权写入偏好档案。"
    elif not request.utterance.strip():
        skipped_reason = "输入为空，未进行偏好检测。"
    elif not detected:
        skipped_reason = "未检测到可长期记录的偏好。"

    return PreferenceDetectionResponse(
        user_id=request.user_id,
        detected_preferences=detected,
        profile=list_user_preferences(request.user_id),
        skipped_reason=skipped_reason,
    )


@router.patch("/{user_id}/preferences/{preference_id}", response_model=UserPreference)
def patch_user_preference(
    user_id: str,
    preference_id: str,
    request: PreferenceUpdateRequest,
) -> UserPreference:
    preference = update_user_preference(user_id, preference_id, request.label)
    if not preference:
        raise HTTPException(status_code=404, detail="Preference not found")
    return preference


@router.delete("/{user_id}/preferences/{preference_id}", response_model=UserPreferenceProfile)
def remove_user_preference(user_id: str, preference_id: str) -> UserPreferenceProfile:
    return delete_user_preference(user_id, preference_id)
