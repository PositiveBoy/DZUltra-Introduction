import asyncio
from hashlib import sha1
import json

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse

from app.agents import run_interaction_response
from app.models.schemas import AgentTrace, InteractionRequest, InteractionResponse, TraceEvent
from app.profiles.store import detect_and_store_preferences, preference_labels_for_user

router = APIRouter(prefix="/interactions", tags=["interactions"])


@router.post("/respond", response_model=InteractionResponse)
def respond_to_interaction(request: InteractionRequest, background_tasks: BackgroundTasks) -> InteractionResponse:
    enriched_request = _enrich_interaction_with_profile_preferences(request)
    response = run_interaction_response(enriched_request)
    if request.preference_detection_enabled and request.user_id != "anonymous" and request.message.strip():
        background_tasks.add_task(
            detect_and_store_preferences,
            request.user_id,
            request.message,
            response.trace_id,
        )
    return response


@router.post("/respond/stream")
async def stream_interaction_response(request: InteractionRequest, background_tasks: BackgroundTasks) -> StreamingResponse:
    """SSE 流式端点：先推送 running 元信息，再执行 runner 并推送最终 events/response。"""
    enriched_request = _enrich_interaction_with_profile_preferences(request)

    async def event_generator():
        pending_trace_id = _pending_trace_id(enriched_request)
        pending_trace = AgentTrace(
            id=pending_trace_id,
            user_goal=enriched_request.message,
            status="running",
            total_duration_ms=0,
            route_score=None,
            events=[],
            runner_mode="deterministic_mock",
            metadata={
                "interaction_entrypoint": "/interactions/respond/stream",
                "streaming_phase": "runner_pending",
            },
        )
        pending_event = TraceEvent(
            id=f"{pending_trace_id}-event-000",
            type="run_started",
            label="后端已接收",
            summary="SSE 已建立连接，后端开始执行 InteractionRouterAgent 和后续规划链路。",
            agent="InteractionRouterAgent",
            duration_ms=0,
            output={"streaming_phase": "runner_started"},
        )
        yield f"event: trace_meta\ndata: {json.dumps(pending_trace.model_dump(mode='json'), ensure_ascii=False)}\n\n"
        yield f"event: trace_event\ndata: {json.dumps(pending_event.model_dump(mode='json'), ensure_ascii=False)}\n\n"

        response = await asyncio.to_thread(run_interaction_response, enriched_request)
        if request.preference_detection_enabled and request.user_id != "anonymous" and request.message.strip():
            background_tasks.add_task(
                detect_and_store_preferences,
                request.user_id,
                request.message,
                response.trace_id,
            )

        for event in response.trace.events:
            event_data = event.model_dump(mode="json") if hasattr(event, "model_dump") else event
            yield f"event: trace_event\ndata: {json.dumps(event_data, ensure_ascii=False)}\n\n"

        response_data = response.model_dump(mode="json")
        yield f"event: response_complete\ndata: {json.dumps(response_data, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _enrich_interaction_with_profile_preferences(request: InteractionRequest) -> InteractionRequest:
    if request.user_id == "anonymous":
        return request

    profile_preferences = preference_labels_for_user(request.user_id)
    if not profile_preferences:
        return request

    constraints = list(dict.fromkeys([*request.constraints, *profile_preferences]))
    return request.model_copy(update={"constraints": constraints})


def _pending_trace_id(request: InteractionRequest) -> str:
    digest = sha1(
        "|".join([request.user_id, request.city, request.message]).encode("utf-8")
    ).hexdigest()[:10]
    return f"pending-{digest}"
