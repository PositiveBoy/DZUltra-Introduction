from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.llm import longcat_client
from app.models.schemas import (
    WeatherSmokeTestRequest,
    WeatherSmokeTestResponse,
    LlmSmokeTestRequest,
    LlmSmokeTestResponse,
    ProviderRuntimeStatus,
    ProviderStatusResponse,
)
from app.weather import caiyun_weather_provider

router = APIRouter(prefix="/providers", tags=["providers"])


def _masked(value: str) -> str | None:
    if not value:
        return None
    if len(value) <= 8:
        return f"{value[:2]}***"
    return f"{value[:4]}***{value[-4:]}"


@router.get("/status", response_model=ProviderStatusResponse)
def provider_status() -> ProviderStatusResponse:
    providers = [
        ProviderRuntimeStatus(
            category="map",
            provider="amap",
            configured=settings.has_amap(),
            active=settings.map_provider == "amap" and settings.has_real_amap(),
            fallback_provider="mock_map_provider",
            required_env=["AMAP_WEB_SERVICE_KEY"],
            masked_key=_masked(settings.amap_web_service_key),
            notes="高德负责地理编码、距离、路线规划、静态地图和基础 POI。Key 缺失或调用失败时回退到 mock provider。",
        ),
        ProviderRuntimeStatus(
            category="weather",
            provider="caiyun",
            configured=settings.has_caiyun(),
            active=settings.weather_provider == "caiyun" and settings.has_real_caiyun(),
            fallback_provider="mock_weather_provider",
            required_env=["CAIYUN_WEATHER_TOKEN"],
            masked_key=_masked(settings.caiyun_weather_token),
            notes="彩云负责天气约束，尤其是降水和逐小时/分钟级天气判断。其他深度数据仍保持 Mock。",
        ),
        ProviderRuntimeStatus(
            category="llm",
            provider="longcat",
            configured=settings.has_longcat(),
            active=settings.llm_provider == "longcat" and settings.has_real_longcat(),
            fallback_provider="deterministic_mock_runner",
            required_env=["LONGCAT_API_KEY", "LONGCAT_BACKUP_API_KEY", "LONGCAT_BASE_URL", "LONGCAT_MODEL"],
            masked_key=_masked(settings.longcat_api_key or settings.longcat_backup_api_key),
            notes="LongCat 通过 OpenAI 兼容接口接入；主 Key 失败或超时时会尝试 LONGCAT_BACKUP_API_KEY。",
        ),
    ]
    return ProviderStatusResponse(
        stage=settings.stage,
        allow_mock_runner=settings.allow_mock_runner,
        providers=providers,
        llm_base_url=settings.longcat_base_url,
        llm_model=settings.longcat_model,
    )


@router.post("/llm/smoke-test", response_model=LlmSmokeTestResponse)
def llm_smoke_test(request: LlmSmokeTestRequest) -> LlmSmokeTestResponse:
    if not longcat_client.is_configured():
        raise HTTPException(status_code=503, detail="LONGCAT_API_KEY is not configured.")

    payload = longcat_client.chat_completion(
        [
            {
                "role": "system",
                "content": "你是 DZUltra 的 V3 接入测试助手。用一句中文回答，不要输出敏感信息。",
            },
            {"role": "user", "content": request.message},
        ],
        temperature=0,
        max_tokens=request.max_tokens,
    )
    content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    usage = payload.get("usage", {})
    return LlmSmokeTestResponse(
        provider="longcat",
        model=settings.longcat_model,
        answer=content,
        usage=usage,
    )


@router.post("/weather/smoke-test", response_model=WeatherSmokeTestResponse)
def weather_smoke_test(request: WeatherSmokeTestRequest) -> WeatherSmokeTestResponse:
    if not caiyun_weather_provider.is_configured():
        raise HTTPException(status_code=503, detail="CAIYUN_WEATHER_TOKEN is not configured.")

    payload = caiyun_weather_provider.weather(request.longitude, request.latitude)
    result = payload.get("result", {})
    realtime = result.get("realtime", {})
    hourly = result.get("hourly", {})
    return WeatherSmokeTestResponse(
        provider="caiyun",
        location={"longitude": request.longitude, "latitude": request.latitude},
        realtime={
            "skycon": realtime.get("skycon"),
            "temperature": realtime.get("temperature"),
            "apparent_temperature": realtime.get("apparent_temperature"),
            "humidity": realtime.get("humidity"),
            "wind": realtime.get("wind"),
            "precipitation": realtime.get("precipitation"),
        },
        hourly_preview={
            "temperature": (hourly.get("temperature") or [])[:3],
            "skycon": (hourly.get("skycon") or [])[:3],
            "precipitation": (hourly.get("precipitation") or [])[:3],
        },
    )
