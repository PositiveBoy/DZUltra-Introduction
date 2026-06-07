from fastapi import APIRouter, BackgroundTasks

from app.agents import run_chat_response
from app.models.schemas import ChatRequest, ChatResponse
from app.profiles.store import detect_and_store_preferences, preference_labels_for_user

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/respond", response_model=ChatResponse)
def respond_to_chat(request: ChatRequest, background_tasks: BackgroundTasks) -> ChatResponse:
    enriched_request = _enrich_chat_with_profile_preferences(request)
    response = run_chat_response(enriched_request)
    if request.user_id != "anonymous" and request.message.strip():
        background_tasks.add_task(
            detect_and_store_preferences,
            request.user_id,
            request.message,
            response.trace_id,
        )
    return response


def _enrich_chat_with_profile_preferences(request: ChatRequest) -> ChatRequest:
    if request.user_id == "anonymous":
        return request

    profile_preferences = preference_labels_for_user(request.user_id)
    if not profile_preferences:
        return request

    constraints = list(dict.fromkeys([*request.constraints, *profile_preferences]))
    return request.model_copy(update={"constraints": constraints})
