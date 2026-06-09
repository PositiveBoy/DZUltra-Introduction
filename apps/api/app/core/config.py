from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_local_env() -> None:
    api_root = Path(__file__).resolve().parents[2]
    repo_root = api_root.parents[1]
    _load_env_file(repo_root / ".env")
    _load_env_file(api_root / ".env")


load_local_env()


def _is_placeholder_secret(value: str) -> bool:
    normalized = value.strip().lower()
    if not normalized:
        return True
    placeholder_prefixes = ("test-", "mock-", "demo-", "your-", "replace-")
    placeholder_values = {
        "test",
        "placeholder",
        "changeme",
        "xxx",
        "xxxx",
        "amap_web_service_key",
        "caiyun_weather_token",
        "longcat_api_key",
    }
    return normalized in placeholder_values or normalized.startswith(placeholder_prefixes)


@dataclass(frozen=True)
class ProviderSettings:
    stage: str = os.environ.get("DZULTRA_STAGE", "v3")
    map_provider: str = os.environ.get("DZULTRA_MAP_PROVIDER", "amap")
    weather_provider: str = os.environ.get("DZULTRA_WEATHER_PROVIDER", "caiyun")
    llm_provider: str = os.environ.get("DZULTRA_LLM_PROVIDER", "longcat")
    allow_mock_runner: bool = os.environ.get("DZULTRA_ALLOW_MOCK_RUNNER", "true").lower() == "true"
    expose_amap_static_url: bool = os.environ.get("DZULTRA_EXPOSE_AMAP_STATIC_URL", "false").lower() == "true"

    amap_web_service_key: str = os.environ.get("AMAP_WEB_SERVICE_KEY", "")
    amap_security_key: str = os.environ.get("AMAP_SECURITY_KEY", "")
    caiyun_weather_token: str = os.environ.get("CAIYUN_WEATHER_TOKEN", "")

    longcat_api_key: str = os.environ.get("LONGCAT_API_KEY", "")
    longcat_backup_api_key: str = os.environ.get("LONGCAT_BACKUP_API_KEY", "")
    longcat_base_url: str = os.environ.get("LONGCAT_BASE_URL", "https://api.longcat.chat/openai")
    longcat_model: str = os.environ.get("LONGCAT_MODEL", "LongCat-2.0-Preview")
    llm_request_timeout_seconds: float = float(os.environ.get("DZULTRA_LLM_TIMEOUT_SECONDS", "20"))
    llm_fast_timeout_seconds: float = float(os.environ.get("DZULTRA_LLM_FAST_TIMEOUT_SECONDS", "8"))
    longcat_backup_retry_enabled: bool = os.environ.get("DZULTRA_LONGCAT_BACKUP_RETRY_ENABLED", "true").lower() == "true"
    router_skip_llm_confidence: float = float(os.environ.get("DZULTRA_ROUTER_SKIP_LLM_CONFIDENCE", "0.9"))
    plan_explanation_llm_enabled: bool = os.environ.get("DZULTRA_PLAN_EXPLANATION_LLM_ENABLED", "true").lower() == "true"
    provider_request_timeout_seconds: float = float(os.environ.get("DZULTRA_PROVIDER_TIMEOUT_SECONDS", "8"))
    provider_fast_timeout_seconds: float = float(os.environ.get("DZULTRA_PROVIDER_FAST_TIMEOUT_SECONDS", "8"))
    allowed_origins: str = os.environ.get(
        "DZULTRA_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://[::1]:3000,http://localhost:3001,http://127.0.0.1:3001,http://[::1]:3001,https://dz-ultra-n3ou9x3ik-positiveboy-projects.vercel.app",
    )

    def allowed_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    def has_amap(self) -> bool:
        return bool(self.amap_web_service_key)

    def has_real_amap(self) -> bool:
        return self.has_amap() and not _is_placeholder_secret(self.amap_web_service_key)

    def has_caiyun(self) -> bool:
        return bool(self.caiyun_weather_token)

    def has_real_caiyun(self) -> bool:
        return self.has_caiyun() and not _is_placeholder_secret(self.caiyun_weather_token)

    def has_longcat(self) -> bool:
        return bool(self.longcat_api_key or self.longcat_backup_api_key)

    def has_real_longcat(self) -> bool:
        return any(
            key and not _is_placeholder_secret(key)
            for key in [self.longcat_api_key, self.longcat_backup_api_key]
        )


settings = ProviderSettings()
