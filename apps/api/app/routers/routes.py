from fastapi import APIRouter, BackgroundTasks

from app.agents import run_route_planning, run_route_refinement
from app.models.schemas import RoutePlanRequest, RoutePlanResponse, RouteRefineRequest
from app.profiles.store import detect_and_store_preferences, preference_labels_for_user

router = APIRouter(prefix="/routes", tags=["routes"])


@router.post("/plan", response_model=RoutePlanResponse)
def plan_route(request: RoutePlanRequest, background_tasks: BackgroundTasks) -> RoutePlanResponse:
    enriched_request = _enrich_request_with_profile_preferences(request)
    response = run_route_planning(enriched_request)
    if request.preference_detection_enabled and request.user_id != "anonymous":
        background_tasks.add_task(
            detect_and_store_preferences,
            request.user_id,
            request.goal,
            response.trace_id,
        )
    return response


@router.post("/refine", response_model=RoutePlanResponse)
def refine_route(request: RouteRefineRequest) -> RoutePlanResponse:
    return run_route_refinement(request)


def _enrich_request_with_profile_preferences(request: RoutePlanRequest) -> RoutePlanRequest:
    if request.user_id == "anonymous":
        return request

    profile_preferences = preference_labels_for_user(request.user_id)
    if not profile_preferences:
        return request

    constraints = list(dict.fromkeys([*request.constraints, *profile_preferences]))
    return request.model_copy(update={"constraints": constraints})
