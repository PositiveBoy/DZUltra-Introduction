import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import chat, interactions, maps, mock, profiles, providers, routes, traces

logger = logging.getLogger("dzultra")

app = FastAPI(
    title="DZUltra API",
    description="FastAPI backend for 点仔 Ultra local route planning.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mock.router)
app.include_router(profiles.router)
app.include_router(routes.router)
app.include_router(chat.router)
app.include_router(interactions.router)
app.include_router(maps.router)
app.include_router(providers.router)
app.include_router(traces.router)


@app.on_event("startup")
async def log_provider_status():
    """启动时报告各 Provider 的 Key 配置状态，方便排查 fallback 原因。"""
    longcat_status = "configured" if settings.has_real_longcat() else "MISSING (will fallback to deterministic_template)"
    amap_status = "configured" if settings.has_real_amap() else "MISSING (will fallback to mock_poi_search)"
    caiyun_status = "configured" if settings.has_real_caiyun() else "MISSING (will fallback to mock_weather_provider)"
    logger.info(f"Provider status on startup — LongCat: {longcat_status}, Amap: {amap_status}, Caiyun: {caiyun_status}")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
