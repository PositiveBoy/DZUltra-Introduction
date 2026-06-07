from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings


class CaiyunWeatherProvider:
    provider_name = "caiyun"
    _base_url = "https://api.caiyunapp.com/v2.6"

    def is_configured(self) -> bool:
        return settings.has_real_caiyun()

    def weather(self, longitude: float, latitude: float) -> dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("CAIYUN_WEATHER_TOKEN is not configured.")
        response = httpx.get(
            f"{self._base_url}/{settings.caiyun_weather_token}/{longitude},{latitude}/weather",
            params={
                "alert": "true",
                "dailysteps": "1",
                "hourlysteps": "24",
            },
            timeout=settings.provider_request_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("status") != "ok":
            raise ValueError(payload.get("error") or "Caiyun weather request failed.")
        return payload


caiyun_weather_provider = CaiyunWeatherProvider()


class MockWeatherProvider:
    provider_name = "mock_weather_provider"

    def weather(self, longitude: float, latitude: float) -> dict[str, Any]:
        return {
            "provider": self.provider_name,
            "location": {"longitude": longitude, "latitude": latitude},
            "realtime": {
                "text": "多云",
                "temperature": 27,
                "wind": "2级",
                "precipitation_probability": 20,
            },
            "hourly": [
                {"time": "14:00", "text": "多云", "temperature": 27, "pop": 20, "wind": "2级"},
                {"time": "15:00", "text": "小雨", "temperature": 26, "pop": 65, "wind": "2级"},
                {"time": "16:00", "text": "阴", "temperature": 25, "pop": 35, "wind": "2级"},
            ],
            "daily": [
                {"date": "today", "text": "多云转小雨", "temp_min": 23, "temp_max": 29},
            ],
            "air": {"category": "良", "aqi": 65},
        }


mock_weather_provider = MockWeatherProvider()


def current_weather_provider() -> CaiyunWeatherProvider | MockWeatherProvider:
    if settings.weather_provider == "caiyun" and settings.has_real_caiyun():
        return caiyun_weather_provider
    return mock_weather_provider
