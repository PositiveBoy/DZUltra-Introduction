from fastapi import APIRouter

from app.providers import provider_adapter
from app.models.schemas import (
    GeocodeRequest,
    GeocodeResponse,
    RouteMatrixRequest,
    RouteMatrixResponse,
    StaticPreviewRequest,
    StaticPreviewResponse,
)

router = APIRouter(prefix="/maps", tags=["maps"])


@router.post("/geocode", response_model=GeocodeResponse)
def geocode(request: GeocodeRequest) -> GeocodeResponse:
    return provider_adapter.geocode(request).data


@router.post("/route-matrix", response_model=RouteMatrixResponse)
def route_matrix(request: RouteMatrixRequest) -> RouteMatrixResponse:
    return provider_adapter.route_matrix(request).data


@router.post("/static-preview", response_model=StaticPreviewResponse)
def static_preview(request: StaticPreviewRequest) -> StaticPreviewResponse:
    return provider_adapter.static_preview(request).data
