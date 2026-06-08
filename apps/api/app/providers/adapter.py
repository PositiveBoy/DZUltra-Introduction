from __future__ import annotations

from dataclasses import dataclass, field
import time
from typing import Any

import httpx

from app.agents.mock_tools import mock_poi_search
from app.core.config import settings
from app.data.mock_data import MOCK_POIS
from app.llm import longcat_client
from app.maps import current_map_provider, mock_map_provider
from app.models.schemas import (
    GeocodeRequest,
    GeocodeResponse,
    GeoCoordinate,
    MapLocation,
    MockPoi,
    RouteMatrixRequest,
    RouteMatrixResponse,
    RoutePlan,
    StaticPreviewRequest,
    StaticPreviewResponse,
)
from app.weather import current_weather_provider, mock_weather_provider


@dataclass
class ProviderCallResult:
    provider: str
    capability: str
    params: dict[str, Any]
    data: Any
    summary: dict[str, Any]
    reliability: str = "verified"
    fallback_used: bool = False
    fallback_provider: str | None = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def trace_output(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "capability": self.capability,
            "params": self.params,
            "summary": self.summary,
            "reliability": self.reliability,
            "fallback_used": self.fallback_used,
            "fallback_provider": self.fallback_provider,
            "error": self.error,
            "metadata": self.metadata,
        }


class ProviderAdapterLayer:
    """Unified V3 provider boundary used by Agents.

    Agents should consume this adapter instead of calling Amap, Caiyun or mock
    helpers directly. The returned result always carries provider and reliability
    metadata so Debug Trace can explain real calls and fallback behavior.
    """

    def poi_search(self, intent: dict[str, Any], profile: dict[str, Any], weather_constraints: dict[str, Any] | None = None) -> ProviderCallResult:
        params = {
            "city": intent.get("city"),
            "keywords": intent.get("required_categories", []),
            "preferences": profile.get("preferences", []),
        }
        if settings.has_real_amap():
            try:
                amap_result = self._amap_poi_search(intent, profile)
                if amap_result["candidates"]:
                    return ProviderCallResult(
                        provider="amap",
                        capability="poi_search",
                        params=params,
                        data=amap_result,
                        summary=self._poi_summary(amap_result),
                        reliability="verified",
                        fallback_used=False,
                    )
                return self._mock_poi_fallback(
                    intent,
                    profile,
                    params,
                    provider="amap",
                    reason="Amap POI response was valid but returned no usable candidates.",
                    weather_constraints=weather_constraints,
                )
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                return self._mock_poi_fallback(intent, profile, params, provider="amap", reason=str(exc), weather_constraints=weather_constraints)

        fallback = mock_poi_search(intent, profile, weather_constraints)
        return ProviderCallResult(
            provider="mock_poi_search",
            capability="poi_search",
            params=params,
            data=fallback,
            summary=self._poi_summary(fallback),
            reliability="mocked",
            fallback_used=True,
            fallback_provider=None,
            metadata={"reason": "AMAP_WEB_SERVICE_KEY missing or test placeholder."},
        )

    def geocode(self, request: GeocodeRequest) -> ProviderCallResult:
        provider = current_map_provider()
        try:
            response = provider.geocode(request)
        except (httpx.HTTPError, ValueError, RuntimeError, KeyError, TypeError) as exc:
            response = mock_map_provider.geocode(request)
            return ProviderCallResult(
                provider=getattr(provider, "provider_name", "map_provider"),
                capability="geocode",
                params=request.model_dump(mode="json"),
                data=response,
                summary=self._geocode_summary(response),
                reliability="mocked",
                fallback_used=True,
                fallback_provider="mock_map_provider",
                error=str(exc),
            )

        fallback_used = response.fallback_used or response.provider == "mock_map_provider"
        return ProviderCallResult(
            provider=response.provider,
            capability="geocode",
            params=request.model_dump(mode="json"),
            data=response,
            summary=self._geocode_summary(response),
            reliability="verified" if response.coordinate_confidence == "verified" and not fallback_used else "mocked",
            fallback_used=fallback_used,
            fallback_provider="mock_map_provider" if fallback_used and response.provider != "mock_map_provider" else None,
            metadata=self._placeholder_metadata("amap") if response.provider == "mock_map_provider" else {},
        )

    def route_matrix(self, request: RouteMatrixRequest) -> ProviderCallResult:
        provider = current_map_provider()
        try:
            response = provider.route_matrix(request)
        except (httpx.HTTPError, ValueError, RuntimeError, KeyError, TypeError) as exc:
            response = mock_map_provider.route_matrix(request)
            return ProviderCallResult(
                provider=getattr(provider, "provider_name", "map_provider"),
                capability="route_matrix",
                params=request.model_dump(mode="json"),
                data=response,
                summary={
                    "leg_count": len(response.legs),
                    "total_distance_meters": response.total_distance_meters,
                    "total_duration_minutes": response.total_duration_minutes,
                    "mode": response.mode,
                },
                reliability="mocked",
                fallback_used=True,
                fallback_provider="mock_map_provider",
                error=str(exc),
            )
        fallback_used = response.fallback_used or response.provider == "mock_map_provider"
        return ProviderCallResult(
            provider=response.provider,
            capability="route_matrix",
            params=request.model_dump(mode="json"),
            data=response,
            summary={
                "leg_count": len(response.legs),
                "total_distance_meters": response.total_distance_meters,
                "total_duration_minutes": response.total_duration_minutes,
                "mode": response.mode,
            },
            reliability="mocked" if fallback_used else "verified",
            fallback_used=fallback_used,
            fallback_provider="mock_map_provider" if fallback_used and response.provider != "mock_map_provider" else None,
            metadata=self._placeholder_metadata("amap") if fallback_used else {},
        )

    def static_preview(self, request: StaticPreviewRequest) -> ProviderCallResult:
        provider = current_map_provider()
        try:
            response = provider.static_preview(request)
        except (httpx.HTTPError, ValueError, RuntimeError, KeyError, TypeError) as exc:
            response = mock_map_provider.static_preview(request)
            return ProviderCallResult(
                provider=getattr(provider, "provider_name", "map_provider"),
                capability="static_preview",
                params=request.model_dump(mode="json"),
                data=response,
                summary=self._static_preview_summary(response),
                reliability="mocked",
                fallback_used=True,
                fallback_provider="mock_map_provider",
                error=str(exc),
            )

        preview = response.preview
        fallback_used = preview.fallback_used or preview.provider == "mock_map_provider"
        return ProviderCallResult(
            provider=preview.provider,
            capability="static_preview",
            params=request.model_dump(mode="json"),
            data=response,
            summary=self._static_preview_summary(response),
            reliability="mocked" if fallback_used else "verified",
            fallback_used=fallback_used,
            fallback_provider="mock_map_provider" if fallback_used and preview.provider != "mock_map_provider" else None,
            metadata=self._placeholder_metadata("amap") if fallback_used else {},
        )

    def weather(self, location: MapLocation | None) -> ProviderCallResult:
        coordinate = self._coordinate_for_weather(location)
        params = {"longitude": coordinate.longitude, "latitude": coordinate.latitude}
        provider = current_weather_provider()
        try:
            payload = provider.weather(coordinate.longitude, coordinate.latitude)
            summary = self._weather_summary(provider.provider_name, payload)
            return ProviderCallResult(
                provider=provider.provider_name,
                capability="weather",
                params=params,
                data=payload,
                summary=summary,
                reliability="mocked" if provider.provider_name == "mock_weather_provider" else "verified",
                fallback_used=provider.provider_name == "mock_weather_provider",
            )
        except (httpx.HTTPError, ValueError, RuntimeError, KeyError, TypeError) as exc:
            payload = mock_weather_provider.weather(coordinate.longitude, coordinate.latitude)
            return ProviderCallResult(
                provider=getattr(provider, "provider_name", "weather_provider"),
                capability="weather",
                params=params,
                data=payload,
                summary=self._weather_summary("mock_weather_provider", payload),
                reliability="mocked",
                fallback_used=True,
                fallback_provider="mock_weather_provider",
                error=str(exc),
            )

    def llm_chat_completion(
        self,
        messages: list[dict[str, str]],
        *,
        purpose: str,
        fallback_content: str,
        temperature: float = 0.2,
        max_tokens: int = 512,
    ) -> ProviderCallResult:
        params = {
            "provider": settings.llm_provider,
            "model": settings.longcat_model,
            "purpose": purpose,
            "message_count": len(messages),
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if settings.llm_provider == "longcat" and settings.has_real_longcat():
            started_at = time.perf_counter()
            try:
                payload = longcat_client.chat_completion(
                    messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                elapsed_ms = self._elapsed_ms(started_at)
                return ProviderCallResult(
                    provider="longcat",
                    capability="llm_chat_completion",
                    params=params,
                    data=payload,
                    summary=self._llm_summary(payload),
                    reliability="verified",
                    fallback_used=False,
                    metadata={
                        "model": settings.longcat_model,
                        "elapsed_ms": elapsed_ms,
                        "timing": payload.get("_dzultra_provider_timing", {}),
                        "timeout_seconds": self._llm_timeout_seconds(),
                    },
                )
            except (httpx.HTTPError, ValueError, RuntimeError, KeyError, TypeError) as exc:
                elapsed_ms = self._elapsed_ms(started_at)
                payload = self._mock_llm_payload(fallback_content)
                return ProviderCallResult(
                    provider="longcat",
                    capability="llm_chat_completion",
                    params=params,
                    data=payload,
                    summary=self._llm_summary(payload),
                    reliability="mocked",
                    fallback_used=True,
                    fallback_provider="deterministic_template",
                    error=f"{exc} (elapsed_ms={elapsed_ms})",
                    metadata={
                        "model": settings.longcat_model,
                        "elapsed_ms": elapsed_ms,
                        "timeout_seconds": self._llm_timeout_seconds(),
                        "backup_retry_enabled": getattr(settings, "longcat_backup_retry_enabled", False),
                    },
                )

        payload = self._mock_llm_payload(fallback_content)
        return ProviderCallResult(
            provider="deterministic_template",
            capability="llm_chat_completion",
            params=params,
            data=payload,
            summary=self._llm_summary(payload),
            reliability="mocked",
            fallback_used=True,
            fallback_provider=None,
            metadata={"reason": "LONGCAT_API_KEY missing or placeholder; deterministic fallback used."},
        )

    def template_llm_completion(
        self,
        *,
        purpose: str,
        fallback_content: str,
        reason: str,
        temperature: float = 0.0,
        max_tokens: int = 0,
    ) -> ProviderCallResult:
        payload = self._mock_llm_payload(fallback_content)
        params = {
            "provider": "deterministic_template",
            "model": "deterministic_template",
            "purpose": purpose,
            "message_count": 0,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        return ProviderCallResult(
            provider="deterministic_template",
            capability="llm_chat_completion",
            params=params,
            data=payload,
            summary=self._llm_summary(payload),
            reliability="mocked",
            fallback_used=True,
            fallback_provider=None,
            metadata={"reason": reason, "llm_skipped": True},
        )

    def mock_deep_poi_enrichment(self, pois: list[MockPoi]) -> ProviderCallResult:
        data = {
            "queue": [
                {"poi_id": poi.id, "current_wait_minutes": poi.queue_minutes, "reliability": "mocked"}
                for poi in pois
            ],
            "recommended_dishes": [
                {
                    "poi_id": poi.id,
                    "dishes": [dish.model_dump(mode="json") for dish in poi.recommended_dishes],
                    "reliability": "mocked",
                }
                for poi in pois
            ],
            "ugc": [
                {"poi_id": poi.id, "summary": poi.ugc_summary, "risk_notes": poi.risk_notes, "reliability": "mocked"}
                for poi in pois
            ],
        }
        return ProviderCallResult(
            provider="mock_local_poi_enrichment",
            capability="mock_deep_poi_enrichment",
            params={"poi_ids": [poi.id for poi in pois]},
            data=data,
            summary={
                "poi_count": len(pois),
                "queue_source": "local_mock",
                "ugc_source": "local_mock",
                "recommended_dish_source": "local_mock",
            },
            reliability="mocked",
            fallback_used=True,
            metadata={
                "reason": "当前真实 API 只保留高德地图和彩云天气；排队、UGC、推荐菜使用本地 Mock 数据。",
            },
        )

    def preview_for_plan(self, plan: RoutePlan, poi_by_id: dict[str, MockPoi] | None = None):
        if settings.map_provider == "amap" and settings.has_real_amap():
            locations = self._locations_for_plan(plan, poi_by_id)
            return current_map_provider().static_preview(StaticPreviewRequest(locations=locations)).preview
        if poi_by_id:
            return mock_map_provider.preview_for_locations(self._locations_for_plan(plan, poi_by_id))
        return mock_map_provider.preview_for_plan(plan)

    def _amap_poi_search(self, intent: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
        candidates_by_category: dict[str, list[dict[str, Any]]] = {}
        rejected: list[dict[str, Any]] = []
        selected: list[dict[str, Any]] = []
        city = intent.get("city") or "北京"
        for category in intent.get("required_categories", []):
            keyword = self._keyword_for_category(category, intent)
            payload = self._amap_get(
                "/v5/place/text",
                {
                    "keywords": keyword,
                    "region": city,
                    "city_limit": "true",
                    "show_fields": "business,photos",
                    "page_size": "8",
                },
            )
            category_items = []
            raw_pois = payload.get("pois")
            if not isinstance(raw_pois, list):
                raise ValueError("Amap POI response field 'pois' is not a list.")
            for raw in raw_pois:
                if not isinstance(raw, dict):
                    raise ValueError("Amap POI response contains a non-object POI item.")
                poi = self._mock_poi_from_amap(raw, category, city, profile)
                score = int(poi.rating * 10) + max(0, 12 - poi.queue_minutes)
                candidate = {
                    "poi": poi.model_dump(mode="json"),
                    "poi_fact": self._poi_fact(poi),
                    "score": score,
                    "reason": f"高德 POI 命中 {keyword}，评分 {poi.rating}，人均 {poi.avg_price or '未知'} 元。",
                    "preference_hits": [],
                    "avoidance_hits": [],
                    "provider": "amap",
                    "reliability": "verified",
                }
                category_items.append(candidate)
            ranked = sorted(category_items, key=lambda item: item["score"], reverse=True)
            candidates_by_category[category] = ranked
            if ranked:
                selected.append(ranked[0])
                for lower_ranked in ranked[1:3]:
                    rejected.append(
                        {
                            "poi_id": lower_ranked["poi"]["id"],
                            "reason": "高德同类候选排序靠后，暂不进入主路线。",
                            "score": lower_ranked["score"],
                        }
                    )
        return {
            "candidates": selected,
            "candidate_pool": candidates_by_category,
            "rejected": rejected,
            "candidate_count": len(selected),
            "fallback_used": False,
            "provider": "amap",
        }

    def _amap_get(self, path: str, params: dict[str, str]) -> dict[str, Any]:
        response = httpx.get(
            f"https://restapi.amap.com{path}",
            params={"key": settings.amap_web_service_key, **params},
            timeout=self._provider_timeout_seconds(),
        )
        response.raise_for_status()
        payload = response.json()
        if str(payload.get("status")) != "1":
            raise ValueError(payload.get("info") or "Amap POI request failed.")
        return payload

    def _mock_poi_from_amap(self, raw: dict[str, Any], category: str, city: str, profile: dict[str, Any]) -> MockPoi:
        longitude, latitude = self._parse_amap_location(raw.get("location", ""))
        business = raw.get("business") or {}
        biz_ext = raw.get("biz_ext") or {}
        photos = raw.get("photos") or []
        rating = self._float_or_default(biz_ext.get("rating") or raw.get("rating"), 4.3)
        avg_price = int(self._float_or_default(biz_ext.get("cost") or raw.get("cost"), 120))
        local_enrichment = self._local_enrichment_for_category(category)
        fallback_tags = [self._label_for_category(category), city, "高德POI"]
        return MockPoi(
            id=f"amap-{raw.get('id') or raw.get('name')}",
            name=raw.get("name") or "高德候选 POI",
            category=category,  # type: ignore[arg-type]
            source="amap",
            reliability={
                "name": "amap",
                "address": "amap",
                "latitude": "amap",
                "longitude": "amap",
                "rating": "amap",
                "phone": "amap",
                "images": "amap",
                "queue_minutes": "mocked",
                "ugc_summary": "mocked",
                "recommended_dishes": "mocked",
            },
            field_reliability={
                "id": "verified" if raw.get("id") else "inferred",
                "name": "verified" if raw.get("name") else "mocked",
                "category": "inferred",
                "city": "verified",
                "district": "verified" if raw.get("adname") else "missing",
                "area": "verified" if business.get("business_area") or raw.get("adname") else "inferred",
                "address": "verified" if isinstance(raw.get("address"), str) and raw.get("address") else "missing",
                "latitude": "verified",
                "longitude": "verified",
                "rating": "verified" if biz_ext.get("rating") or raw.get("rating") else "mocked",
                "avg_price": "verified" if biz_ext.get("cost") or raw.get("cost") else "mocked",
                "open_hours": "verified" if biz_ext.get("open_time") else "missing",
                "business_status": "verified" if raw.get("business_status") else "missing",
                "telephone": "verified" if isinstance(raw.get("tel"), str) and raw.get("tel") else "missing",
                "images": "verified" if photos else "missing",
            },
            enrichment_reliability={
                "queue_minutes": "mocked",
                "visit_duration_minutes": "mocked",
                "ugc_summary": "mocked",
                "ugc_highlights": "mocked",
                "recommended_dishes": "mocked",
                "platform_badges": "mocked",
                "service_options": "mocked",
                "decision_signals": "mocked",
                "risk_notes": "mocked",
            },
            city=city,
            district=raw.get("adname"),
            area=business.get("business_area") or raw.get("adname") or city,
            address=raw.get("address") if isinstance(raw.get("address"), str) else None,
            latitude=latitude,
            longitude=longitude,
            rating=rating,
            review_count=None,
            queue_minutes=local_enrichment.queue_minutes,
            tags=list(dict.fromkeys([tag for tag in [*(str(raw.get("tag") or "").split(";")), *fallback_tags, *local_enrichment.tags[:3]] if tag])),
            avg_price=avg_price,
            open_hours=biz_ext.get("open_time"),
            structured_open_hours=None,
            business_status=raw.get("business_status") or "营业状态待校验",
            visit_duration_minutes=local_enrichment.visit_duration_minutes or 65,
            ugc_summary=local_enrichment.ugc_summary or "该 POI 来自高德搜索；排队、UGC、推荐菜由本地 Mock 数据兜底。",
            ugc_highlights=local_enrichment.ugc_highlights,
            platform_badges=list(dict.fromkeys(["高德候选", *local_enrichment.platform_badges[:2]])),
            service_options=list(dict.fromkeys(["导航", *local_enrichment.service_options[:2]])),
            recommended_dishes=local_enrichment.recommended_dishes,
            risk_notes=local_enrichment.risk_notes[:3],
            decision_signals={
                "selected_reason": "真实高德 POI 搜索命中本轮类别；深度体验字段由 Mock 兜底。",
                "user_fit": f"匹配用户偏好：{'、'.join(profile.get('preferences', [])[:3]) or '本轮目标'}。",
            },
            telephone=raw.get("tel") if isinstance(raw.get("tel"), str) else None,
            images=[
                photo.get("url")
                for photo in photos
                if isinstance(photo, dict) and isinstance(photo.get("url"), str)
            ],
        )

    def _mock_poi_fallback(
        self,
        intent: dict[str, Any],
        profile: dict[str, Any],
        params: dict[str, Any],
        *,
        provider: str,
        reason: str,
        weather_constraints: dict[str, Any] | None = None,
    ) -> ProviderCallResult:
        fallback = mock_poi_search(intent, profile, weather_constraints)
        return ProviderCallResult(
            provider=provider,
            capability="poi_search",
            params=params,
            data=fallback,
            summary=self._poi_summary(fallback),
            reliability="mocked",
            fallback_used=True,
            fallback_provider="mock_poi_search",
            error=reason,
            metadata={"fallback_reason": reason},
        )

    def _poi_fact(self, poi: MockPoi) -> dict[str, Any]:
        return {
            "id": poi.id,
            "source": poi.source,
            "name": poi.name,
            "category": poi.category,
            "city": poi.city,
            "area": poi.area,
            "address": poi.address,
            "latitude": poi.latitude,
            "longitude": poi.longitude,
            "rating": poi.rating,
            "avg_price": poi.avg_price,
            "telephone": poi.telephone,
            "images": poi.images,
            "field_reliability": poi.field_reliability,
            "enrichment_reliability": poi.enrichment_reliability,
        }

    def _local_enrichment_for_category(self, category: str) -> MockPoi:
        return next((poi for poi in MOCK_POIS if poi.category == category), MOCK_POIS[0])

    def _poi_summary(self, retrieval: dict[str, Any]) -> dict[str, Any]:
        return {
            "candidate_count": retrieval.get("candidate_count", 0),
            "selected_ids": [item["poi"]["id"] for item in retrieval.get("candidates", [])],
            "rejected_count": len(retrieval.get("rejected", [])),
            "fallback_used": retrieval.get("fallback_used", False),
        }

    def _geocode_summary(self, response: GeocodeResponse) -> dict[str, Any]:
        return {
            "provider": response.provider,
            "coordinate_confidence": response.coordinate_confidence,
            "fallback_used": response.fallback_used,
            "location": {
                "id": response.location.id,
                "name": response.location.name,
                "city": response.location.city,
                "latitude": response.location.latitude,
                "longitude": response.location.longitude,
            },
        }

    def _static_preview_summary(self, response: StaticPreviewResponse) -> dict[str, Any]:
        preview = response.preview
        return {
            "provider": preview.provider,
            "preview_type": preview.preview_type,
            "point_count": len(preview.points),
            "segment_count": len(preview.route_segments),
            "total_distance_meters": preview.total_distance_meters,
            "total_duration_minutes": preview.total_duration_minutes,
            "fallback_used": preview.fallback_used,
        }

    def _weather_summary(self, provider_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        if provider_name == "caiyun":
            result = payload.get("result", {})
            realtime = result.get("realtime", {})
            hourly = result.get("hourly", {})
            return {
                "realtime": {
                    "text": realtime.get("skycon"),
                    "temp": realtime.get("temperature"),
                    "wind": realtime.get("wind"),
                },
                "hourly_preview": {
                    "temperature": (hourly.get("temperature") or [])[:3],
                    "skycon": (hourly.get("skycon") or [])[:3],
                    "precipitation": (hourly.get("precipitation") or [])[:3],
                },
            }
        return {
            "realtime": payload.get("realtime", {}),
            "hourly_preview": payload.get("hourly", [])[:3],
            "daily_preview": payload.get("daily", [])[:2],
            "air": payload.get("air", {}),
            "constraint_impact": "15:00 有降水风险，优先室内 POI 或减少露台停留。",
        }

    def _llm_summary(self, payload: dict[str, Any]) -> dict[str, Any]:
        content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
        return {
            "model": payload.get("model"),
            "content_preview": content[:120],
            "usage": payload.get("usage", {}),
            "fallback_used": payload.get("fallback_used", False),
            "timing": payload.get("_dzultra_provider_timing", {}),
        }

    def _mock_llm_payload(self, fallback_content: str) -> dict[str, Any]:
        return {
            "id": "dzultra-mock-llm-fallback",
            "object": "chat.completion",
            "model": "deterministic_template",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": fallback_content},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "fallback_used": True,
        }

    def _placeholder_metadata(self, provider: str) -> dict[str, Any]:
        if provider == "amap" and settings.has_amap() and not settings.has_real_amap():
            return {"reason": "AMAP_WEB_SERVICE_KEY is configured but looks like a test placeholder."}
        return {}

    def _coordinate_for_weather(self, location: MapLocation | None) -> GeoCoordinate:
        if location and location.latitude is not None and location.longitude is not None:
            return GeoCoordinate(latitude=location.latitude, longitude=location.longitude)
        return GeoCoordinate(latitude=39.9042, longitude=116.4074)

    def _provider_timeout_seconds(self) -> float:
        request_timeout = getattr(settings, "provider_request_timeout_seconds", 8)
        fast_timeout = getattr(settings, "provider_fast_timeout_seconds", request_timeout)
        return min(request_timeout, fast_timeout)

    def _llm_timeout_seconds(self) -> float:
        request_timeout = getattr(settings, "llm_request_timeout_seconds", 20)
        fast_timeout = getattr(settings, "llm_fast_timeout_seconds", request_timeout)
        return min(request_timeout, fast_timeout)

    def _elapsed_ms(self, started_at: float) -> int:
        return round((time.perf_counter() - started_at) * 1000)

    def _locations_for_plan(self, plan: RoutePlan, poi_by_id: dict[str, MockPoi] | None = None) -> list[MapLocation]:
        poi_by_id = poi_by_id or {poi.id: poi for poi in MOCK_POIS}
        locations = []
        for stop in plan.stops:
            poi = poi_by_id.get(stop.poi_id)
            locations.append(
                MapLocation(
                    id=stop.poi_id,
                    name=stop.poi_name,
                    city=poi.city if poi else "北京",
                    area=poi.area if poi else stop.area,
                    address=poi.address if poi else None,
                    latitude=poi.latitude if poi else None,
                    longitude=poi.longitude if poi else None,
                )
            )
        return locations

    def _keyword_for_category(self, category: str, intent: dict[str, Any]) -> str:
        if category == "food":
            return "餐厅"
        if category == "culture":
            return "美术馆 展览"
        if category == "dessert":
            return "咖啡 甜品"
        if category == "shopping":
            return "商场"
        if category == "entertainment":
            return "公园 亲子"
        return intent.get("route_theme") or "本地生活"

    def _label_for_category(self, category: str) -> str:
        return {
            "food": "餐饮",
            "culture": "文化",
            "dessert": "甜品",
            "shopping": "购物",
            "entertainment": "休闲",
        }.get(category, category)

    def _parse_amap_location(self, value: str) -> tuple[float, float]:
        longitude, latitude = value.split(",", 1)
        return float(longitude), float(latitude)

    def _float_or_default(self, value: Any, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default


provider_adapter = ProviderAdapterLayer()
