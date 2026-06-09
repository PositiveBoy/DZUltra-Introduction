import asyncio
from hashlib import sha1
import json

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse

from app.agents import run_interaction_response
from app.agents.runner import run_interaction_response_async
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
    """SSE 流式端点：先推送 running 元信息，再执行异步 runner 并实时推送事件。

    支持三种 SSE 事件类型：
    - trace_meta: 推送 running 状态的空 trace
    - trace_event: 推送 Agent 步骤事件
    - llm_chunk: 推送 LLM 流式 token
    - response_complete: 推送完整响应
    """
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
            runner_mode="real_agent_ai_generated_data",
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

        # 使用事件队列实现实时推送
        event_queue: asyncio.Queue = asyncio.Queue()

        async def on_event(event_data: dict):
            """Runner 回调：将事件推入队列。"""
            await event_queue.put(event_data)

        async def run_runner():
            """执行异步 Runner。"""
            try:
                response = await run_interaction_response_async(enriched_request, on_event=on_event)
                await event_queue.put({"type": "response_complete", "data": response})
            except Exception as exc:
                await event_queue.put({"type": "runner_error", "error": str(exc)})

        # 启动 runner 任务
        runner_task = asyncio.create_task(run_runner())

        # 实时推送事件
        while True:
            try:
                event_data = await asyncio.wait_for(event_queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                if runner_task.done():
                    break
                continue

            event_type = event_data.get("type")

            if event_type == "llm_chunk":
                # LLM 流式 token
                yield f"event: llm_chunk\ndata: {json.dumps(event_data, ensure_ascii=False)}\n\n"

            elif event_type == "trace_event":
                # Agent 步骤事件
                event_obj = event_data.get("event", event_data)
                yield f"event: trace_event\ndata: {json.dumps(event_obj, ensure_ascii=False) if isinstance(event_obj, dict) else json.dumps(event_obj, ensure_ascii=False)}\n\n"

            elif event_type == "response_complete":
                # 完整响应
                response = event_data["data"]
                if request.preference_detection_enabled and request.user_id != "anonymous" and request.message.strip():
                    background_tasks.add_task(
                        detect_and_store_preferences,
                        request.user_id,
                        request.message,
                        response.trace_id,
                    )
                response_data = response.model_dump(mode="json")
                yield f"event: response_complete\ndata: {json.dumps(response_data, ensure_ascii=False)}\n\n"
                break

            elif event_type == "runner_error":
                # Runner 错误
                yield f"event: runner_error\ndata: {json.dumps({'error': event_data['error']}, ensure_ascii=False)}\n\n"
                break

        # 确保 runner 任务完成
        if not runner_task.done():
            runner_task.cancel()
            try:
                await runner_task
            except asyncio.CancelledError:
                pass

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
