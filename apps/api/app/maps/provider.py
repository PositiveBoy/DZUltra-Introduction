from __future__ import annotations

from hashlib import sha1
from math import asin, cos, radians, sin, sqrt

import httpx

from app.core.config import settings
from app.data.mock_data import MOCK_POIS
from app.models.schemas import (
    CoordinateConfidence,
    GeoCoordinate,
    GeocodeRequest,
    GeocodeResponse,
    MapLocation,
    MapPoint,
    MapPreview,
    MapPreviewPoint,
    RouteMatrixLeg,
    RouteMatrixRequest,
    RouteMatrixResponse,
    RoutePlan,
    StaticPreviewRequest,
    StaticPreviewResponse,
    TransportMode,
)


CITY_CENTERS = {
    "北京": GeoCoordinate(latitude=39.9042, longitude=116.4074),
    "上海": GeoCoordinate(latitude=31.2304, longitude=121.4737),
    "广州": GeoCoordinate(latitude=23.1291, longitude=113.2644),
    "深圳": GeoCoordinate(latitude=22.5431, longitude=114.0579),
    "成都": GeoCoordinate(latitude=30.5728, longitude=104.0668),
    "杭州": GeoCoordinate(latitude=30.2741, longitude=120.1551),
}
MODE_SPEED_METERS_PER_MINUTE = {
    "walk": 78,
    "bike": 180,
    "taxi": 420,
    "metro": 520,
}
MODE_BASE_MINUTES = {
    "walk": 0,
    "bike": 2,
    "taxi": 4,
    "metro": 8,
}


class MockMapProvider:
    provider_name = "mock_map_provider"

    def geocode(self, request: GeocodeRequest) -> GeocodeResponse:
        poi = self._find_poi(request)
        if poi is not None and poi.latitude is not None and poi.longitude is not None:
            return GeocodeResponse(
                fallback_used=False,
                coordinate_confidence="verified",
                location=MapLocation(
                    id=poi.id,
                    name=poi.name,
                    city=poi.city,
                    area=poi.area,
                    address=poi.address,
                    latitude=poi.latitude,
                    longitude=poi.longitude,
                ),
            )

        coordinate = self._mock_coordinate(request.city, request.address or request.name or request.poi_id or "unknown")
        return GeocodeResponse(
            fallback_used=True,
            coordinate_confidence="mocked",
            location=MapLocation(
                id=request.poi_id,
                name=request.name,
                city=request.city,
                address=request.address,
                latitude=coordinate.latitude,
                longitude=coordinate.longitude,
            ),
        )

    def route_matrix(self, request: RouteMatrixRequest) -> RouteMatrixResponse:
        locations = [self._resolve_location(location) for location in request.locations]
        legs = self._sequential_legs(locations, request.mode)
        return RouteMatrixResponse(
            fallback_used=any(location.latitude is None or location.longitude is None for location in request.locations),
            mode=request.mode,
            legs=legs,
            total_distance_meters=sum(leg.distance_meters for leg in legs),
            total_duration_minutes=sum(leg.duration_minutes for leg in legs),
        )

    def static_preview(self, request: StaticPreviewRequest) -> StaticPreviewResponse:
        locations = [self._resolve_location(location) for location in request.locations]
        return StaticPreviewResponse(preview=self.preview_for_locations(locations, request.mode))

    def preview_for_plan(self, plan: RoutePlan, mode: TransportMode = "taxi") -> MapPreview:
        poi_by_id = {poi.id: poi for poi in MOCK_POIS}
        locations: list[MapLocation] = []
        points: list[MapPreviewPoint] = []
        for index, stop in enumerate(plan.stops):
            poi = poi_by_id.get(stop.poi_id)
            if poi is None:
                coordinate = self._mock_coordinate("北京", stop.poi_name)
                location = MapLocation(
                    id=stop.poi_id,
                    name=stop.poi_name,
                    latitude=coordinate.latitude,
                    longitude=coordinate.longitude,
                )
                confidence: CoordinateConfidence = "mocked"
                area = stop.area
                address = None
            else:
                location = MapLocation(
                    id=poi.id,
                    name=poi.name,
                    city=poi.city,
                    area=poi.area,
                    address=poi.address,
                    latitude=poi.latitude,
                    longitude=poi.longitude,
                )
                confidence = "verified" if poi.latitude is not None and poi.longitude is not None else "mocked"
                area = poi.area
                address = poi.address
            resolved = self._resolve_location(location)
            locations.append(resolved)
            coordinate = self._coordinate_for_location(resolved)
            points.append(
                MapPreviewPoint(
                    id=resolved.id or stop.poi_id,
                    name=resolved.name or stop.poi_name,
                    label=str(index + 1),
                    sequence_index=index,
                    coordinate=coordinate,
                    coordinate_confidence=confidence,
                    area=area,
                    address=address,
                )
            )

        legs = self._sequential_legs(locations, mode)
        return MapPreview(
            fallback_used=any(point.coordinate_confidence != "verified" for point in points),
            coordinate_confidence="verified" if all(point.coordinate_confidence == "verified" for point in points) else "mocked",
            center=self._center(locations),
            points=points,
            visual_points=self._visual_points(locations, labels=[point.label for point in points]),
            route_segments=legs,
            total_distance_meters=sum(leg.distance_meters for leg in legs),
            total_duration_minutes=sum(leg.duration_minutes for leg in legs),
            note="V2 使用 Mock POI 坐标计算距离和通勤，V3 可替换为高德地图 provider。",
        )

    def preview_for_locations(self, locations: list[MapLocation], mode: TransportMode = "taxi") -> MapPreview:
        resolved_locations = [self._resolve_location(location) for location in locations]
        points = [
            MapPreviewPoint(
                id=location.id or f"location-{index + 1}",
                name=location.name or location.address or f"位置 {index + 1}",
                label=str(index + 1),
                sequence_index=index,
                coordinate=self._coordinate_for_location(location),
                coordinate_confidence="verified" if location.latitude is not None and location.longitude is not None else "mocked",
                area=location.area,
                address=location.address,
            )
            for index, location in enumerate(resolved_locations)
        ]
        legs = self._sequential_legs(resolved_locations, mode)
        return MapPreview(
            fallback_used=any(point.coordinate_confidence != "verified" for point in points),
            coordinate_confidence="verified" if all(point.coordinate_confidence == "verified" for point in points) else "mocked",
            center=self._center(resolved_locations),
            points=points,
            visual_points=self._visual_points(resolved_locations, labels=[point.label for point in points]),
            route_segments=legs,
            total_distance_meters=sum(leg.distance_meters for leg in legs),
            total_duration_minutes=sum(leg.duration_minutes for leg in legs),
            note="Mock 静态预览返回矢量点位，前端可直接画伪地图。",
        )

    def _find_poi(self, request: GeocodeRequest):
        if request.poi_id:
            match = next((poi for poi in MOCK_POIS if poi.id == request.poi_id), None)
            if match is not None:
                return match
        search_text = " ".join(value for value in [request.name, request.address] if value)
        if not search_text:
            return None
        return next(
            (
                poi
                for poi in MOCK_POIS
                if poi.name in search_text
                or search_text in poi.name
                or (poi.address and (poi.address in search_text or search_text in poi.address))
            ),
            None,
        )

    def _resolve_location(self, location: MapLocation) -> MapLocation:
        if location.latitude is not None and location.longitude is not None:
            return location
        response = self.geocode(
            GeocodeRequest(
                address=location.address,
                city=location.city or "北京",
                poi_id=location.id,
                name=location.name,
            )
        )
        return response.location

    def _sequential_legs(self, locations: list[MapLocation], mode: TransportMode) -> list[RouteMatrixLeg]:
        legs: list[RouteMatrixLeg] = []
        for index in range(len(locations) - 1):
            origin = locations[index]
            destination = locations[index + 1]
            origin_coordinate = self._coordinate_for_location(origin)
            destination_coordinate = self._coordinate_for_location(destination)
            distance = self._distance_meters(origin_coordinate, destination_coordinate)
            duration = self._duration_minutes(distance, mode)
            legs.append(
                RouteMatrixLeg(
                    origin_id=origin.id or f"location-{index + 1}",
                    destination_id=destination.id or f"location-{index + 2}",
                    mode=mode,
                    distance_meters=distance,
                    duration_minutes=duration,
                    polyline=[origin_coordinate, destination_coordinate],
                )
            )
        return legs

    def _coordinate_for_location(self, location: MapLocation) -> GeoCoordinate:
        if location.latitude is not None and location.longitude is not None:
            return GeoCoordinate(latitude=location.latitude, longitude=location.longitude)
        return self._mock_coordinate(location.city or "北京", location.address or location.name or location.id or "unknown")

    def _center(self, locations: list[MapLocation]) -> GeoCoordinate | None:
        if not locations:
            return None
        coordinates = [self._coordinate_for_location(location) for location in locations]
        return GeoCoordinate(
            latitude=sum(coordinate.latitude for coordinate in coordinates) / len(coordinates),
            longitude=sum(coordinate.longitude for coordinate in coordinates) / len(coordinates),
        )

    def _mock_coordinate(self, city: str, seed: str) -> GeoCoordinate:
        center = CITY_CENTERS.get(city, CITY_CENTERS["北京"])
        digest = sha1(f"{city}|{seed}".encode("utf-8")).hexdigest()
        lat_offset = (int(digest[:4], 16) % 700 - 350) / 10000
        lng_offset = (int(digest[4:8], 16) % 700 - 350) / 10000
        return GeoCoordinate(
            latitude=round(center.latitude + lat_offset, 6),
            longitude=round(center.longitude + lng_offset, 6),
        )

    def _distance_meters(self, origin: GeoCoordinate, destination: GeoCoordinate) -> int:
        earth_radius_meters = 6_371_000
        lat1 = radians(origin.latitude)
        lat2 = radians(destination.latitude)
        delta_lat = radians(destination.latitude - origin.latitude)
        delta_lng = radians(destination.longitude - origin.longitude)
        haversine = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lng / 2) ** 2
        return max(80, int(2 * earth_radius_meters * asin(sqrt(haversine))))

    def _duration_minutes(self, distance_meters: int, mode: TransportMode) -> int:
        speed = MODE_SPEED_METERS_PER_MINUTE[mode]
        base = MODE_BASE_MINUTES[mode]
        return max(2, round(distance_meters / speed + base))

    def _visual_points(self, locations: list[MapLocation], labels: list[str]) -> list[MapPoint]:
        if not locations:
            return []
        coordinates = [self._coordinate_for_location(location) for location in locations]
        min_lat = min(coordinate.latitude for coordinate in coordinates)
        max_lat = max(coordinate.latitude for coordinate in coordinates)
        min_lng = min(coordinate.longitude for coordinate in coordinates)
        max_lng = max(coordinate.longitude for coordinate in coordinates)
        lat_span = max(max_lat - min_lat, 0.0001)
        lng_span = max(max_lng - min_lng, 0.0001)
        points = []
        for coordinate, label in zip(coordinates, labels, strict=False):
            x = int(12 + ((coordinate.longitude - min_lng) / lng_span) * 76)
            y = int(88 - ((coordinate.latitude - min_lat) / lat_span) * 76)
            points.append(MapPoint(x=x, y=y, label=label))
        return points


mock_map_provider = MockMapProvider()


class AmapMapProvider:
    provider_name = "amap"
    _base_url = "https://restapi.amap.com"

    def __init__(self, fallback: MockMapProvider) -> None:
        self._fallback = fallback

    def geocode(self, request: GeocodeRequest) -> GeocodeResponse:
        if not settings.has_real_amap():
            return self._fallback.geocode(request)
        query = request.address or request.name
        if not query:
            return self._fallback.geocode(request)
        try:
            payload = self._get(
                "/v3/geocode/geo",
                {
                    "address": query,
                    "city": request.city,
                },
            )
            geocodes = payload.get("geocodes") or []
            if not geocodes:
                return self._fallback.geocode(request)
            first = geocodes[0]
            longitude, latitude = self._parse_location(first.get("location", ""))
            return GeocodeResponse(
                provider="amap",
                fallback_used=False,
                coordinate_confidence="verified",
                location=MapLocation(
                    id=request.poi_id or first.get("adcode"),
                    name=request.name or first.get("formatted_address"),
                    city=first.get("city") or request.city,
                    area=first.get("district"),
                    address=first.get("formatted_address") or request.address,
                    latitude=latitude,
                    longitude=longitude,
                ),
            )
        except (httpx.HTTPError, ValueError, KeyError):
            return self._fallback.geocode(request)

    def route_matrix(self, request: RouteMatrixRequest) -> RouteMatrixResponse:
        if not settings.has_real_amap():
            return self._fallback.route_matrix(request)
        try:
            locations = [self._resolve_location(location) for location in request.locations]
            legs: list[RouteMatrixLeg] = []
            for index in range(len(locations) - 1):
                origin = locations[index]
                destination = locations[index + 1]
                origin_coordinate = self._coordinate_for_location(origin)
                destination_coordinate = self._coordinate_for_location(destination)
                payload = self._get(
                    "/v3/distance",
                    {
                        "origins": self._format_coordinate(origin_coordinate),
                        "destination": self._format_coordinate(destination_coordinate),
                        "type": self._distance_type(request.mode),
                    },
                )
                result = (payload.get("results") or [{}])[0]
                distance = int(float(result.get("distance") or 0))
                duration_seconds = int(float(result.get("duration") or 0))
                if distance <= 0:
                    raise ValueError("Amap distance API returned empty distance.")
                legs.append(
                    RouteMatrixLeg(
                        provider="amap",
                        origin_id=origin.id or f"location-{index + 1}",
                        destination_id=destination.id or f"location-{index + 2}",
                        mode=request.mode,
                        distance_meters=distance,
                        duration_minutes=max(1, round(duration_seconds / 60)),
                        polyline=[origin_coordinate, destination_coordinate],
                    )
                )
            return RouteMatrixResponse(
                provider="amap",
                fallback_used=False,
                mode=request.mode,
                legs=legs,
                total_distance_meters=sum(leg.distance_meters for leg in legs),
                total_duration_minutes=sum(leg.duration_minutes for leg in legs),
            )
        except (httpx.HTTPError, ValueError, KeyError):
            return self._fallback.route_matrix(request)

    def static_preview(self, request: StaticPreviewRequest) -> StaticPreviewResponse:
        if not settings.has_amap():
            return self._fallback.static_preview(request)
        if not settings.has_real_amap():
            locations = [self._fallback._resolve_location(location) for location in request.locations]
            preview = self._fallback.preview_for_locations(locations, request.mode)
            preview.provider = "amap"
            preview.preview_type = "mock_vector"
            preview.fallback_used = True
            preview.static_image_url = None
            preview.note = "本地测试 key 不调用高德网络接口；预览保留高德 provider 边界并回退矢量点位。"
            return StaticPreviewResponse(preview=preview)
        try:
            locations = [self._resolve_location(location) for location in request.locations]
            preview = self._fallback.preview_for_locations(locations, request.mode)
            markers = "|".join(
                f"mid,{index + 1},{self._format_coordinate(self._coordinate_for_location(location))}"
                for index, location in enumerate(locations)
            )
            preview.provider = "amap"
            preview.preview_type = "amap_static" if settings.expose_amap_static_url else "mock_vector"
            preview.fallback_used = False
            preview.static_image_url = self._static_map_url(markers) if settings.expose_amap_static_url else None
            preview.note = (
                "V3 使用高德静态地图 URL；前端可在图片失败时回退矢量点位。"
                if settings.expose_amap_static_url
                else "V3 已接入高德坐标和距离；为避免 Web 服务 Key 暴露，静态图暂用矢量点位，后续可加后端图片代理。"
            )
            return StaticPreviewResponse(preview=preview)
        except (httpx.HTTPError, ValueError, KeyError):
            return self._fallback.static_preview(request)

    def _get(self, path: str, params: dict[str, str]) -> dict:
        response = httpx.get(
            f"{self._base_url}{path}",
            params={"key": settings.amap_web_service_key, **params},
            timeout=self._timeout_seconds(),
        )
        response.raise_for_status()
        payload = response.json()
        if str(payload.get("status")) != "1":
            raise ValueError(payload.get("info") or "Amap request failed.")
        return payload

    def _resolve_location(self, location: MapLocation) -> MapLocation:
        if location.latitude is not None and location.longitude is not None:
            return location
        return self.geocode(
            GeocodeRequest(
                address=location.address,
                city=location.city or "北京",
                poi_id=location.id,
                name=location.name,
            )
        ).location

    def _coordinate_for_location(self, location: MapLocation) -> GeoCoordinate:
        if location.latitude is None or location.longitude is None:
            raise ValueError("Location has no coordinate.")
        return GeoCoordinate(latitude=location.latitude, longitude=location.longitude)

    def _static_map_url(self, markers: str) -> str:
        return str(
            httpx.URL(
                f"{self._base_url}/v3/staticmap",
                params={
                    "key": settings.amap_web_service_key,
                    "size": "560*320",
                    "scale": "2",
                    "markers": markers,
                },
            )
        )

    def _parse_location(self, value: str) -> tuple[float, float]:
        longitude, latitude = value.split(",", 1)
        return float(longitude), float(latitude)

    def _format_coordinate(self, coordinate: GeoCoordinate) -> str:
        return f"{coordinate.longitude},{coordinate.latitude}"

    def _distance_type(self, mode: TransportMode) -> str:
        if mode == "walk":
            return "3"
        return "1"

    def _timeout_seconds(self) -> float:
        request_timeout = getattr(settings, "provider_request_timeout_seconds", 8)
        fast_timeout = getattr(settings, "provider_fast_timeout_seconds", request_timeout)
        return min(request_timeout, fast_timeout)


amap_map_provider = AmapMapProvider(mock_map_provider)


def current_map_provider() -> MockMapProvider | AmapMapProvider:
    if settings.map_provider == "amap" and settings.has_amap():
        return amap_map_provider
    return mock_map_provider
