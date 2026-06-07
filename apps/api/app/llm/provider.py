from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings


class LongCatClient:
    provider_name = "longcat"

    def is_configured(self) -> bool:
        return settings.has_real_longcat()

    def chat_completion(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.2,
        max_tokens: int = 512,
    ) -> dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("LONGCAT_API_KEY is not configured.")

        last_error: Exception | None = None
        for api_key in self._api_keys():
            try:
                response = httpx.post(
                    f"{settings.longcat_base_url.rstrip('/')}/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.longcat_model,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    },
                    timeout=settings.llm_request_timeout_seconds,
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as exc:
                last_error = exc
        if last_error is not None:
            raise last_error
        raise RuntimeError("LONGCAT_API_KEY is not configured.")

    def _api_keys(self) -> list[str]:
        return list(
            dict.fromkeys(
                key
                for key in [settings.longcat_api_key, settings.longcat_backup_api_key]
                if key and key.strip() and not key.strip().lower().startswith("test-")
            )
        )


longcat_client = LongCatClient()
