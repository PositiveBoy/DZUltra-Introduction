from __future__ import annotations

import json
import time
from typing import Any, AsyncGenerator

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
        timeout_seconds: float | None = None,
    ) -> dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("LONGCAT_API_KEY is not configured.")

        last_error: Exception | None = None
        errors: list[str] = []
        for key_index, api_key in enumerate(self._api_keys()):
            started_at = time.perf_counter()
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
                    timeout=self._timeout_seconds(timeout_seconds),
                )
                response.raise_for_status()
                payload = response.json()
                payload.setdefault("_dzultra_provider_timing", {})
                payload["_dzultra_provider_timing"].update(
                    {
                        "elapsed_ms": round((time.perf_counter() - started_at) * 1000),
                        "key_index": key_index,
                        "backup_retry_enabled": getattr(settings, "longcat_backup_retry_enabled", False),
                        "timeout_seconds": self._timeout_seconds(timeout_seconds),
                    }
                )
                return payload
            except httpx.HTTPError as exc:
                last_error = exc
                errors.append(f"key_index={key_index}: {exc}")
        if last_error is not None:
            if errors:
                raise RuntimeError("; ".join(errors)) from last_error
            raise last_error
        raise RuntimeError("LONGCAT_API_KEY is not configured.")

    async def chat_completion_stream(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.2,
        max_tokens: int = 512,
        timeout_seconds: float | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """流式调用 LongCat，逐 token yield OpenAI SSE chunk。"""
        if not self.is_configured():
            raise RuntimeError("LONGCAT_API_KEY is not configured.")

        errors: list[str] = []
        for key_index, api_key in enumerate(self._api_keys()):
            started_at = time.perf_counter()
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(self._timeout_seconds(timeout_seconds), connect=10.0)
                ) as client:
                    async with client.stream(
                        "POST",
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
                            "stream": True,
                        },
                    ) as response:
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if not line.startswith("data: "):
                                continue
                            data = line[6:]
                            if data.strip() == "[DONE]":
                                return
                            try:
                                chunk = json.loads(data)
                            except json.JSONDecodeError:
                                continue
                            chunk.setdefault("_dzultra_provider_timing", {})
                            chunk["_dzultra_provider_timing"].update({
                                "elapsed_ms": round((time.perf_counter() - started_at) * 1000),
                                "key_index": key_index,
                                "streaming": True,
                            })
                            yield chunk
                    return  # 成功完成，不重试
            except (httpx.HTTPError, ValueError, KeyError) as exc:
                errors.append(f"key_index={key_index}: {exc}")
                continue
        raise RuntimeError("; ".join(errors))

    def _api_keys(self) -> list[str]:
        keys = list(
            dict.fromkeys(
                key
                for key in [settings.longcat_api_key]
                if key and key.strip() and not key.strip().lower().startswith("test-")
            )
        )
        if getattr(settings, "longcat_backup_retry_enabled", False):
            keys.extend(
                key
                for key in [settings.longcat_backup_api_key]
                if key and key.strip() and not key.strip().lower().startswith("test-") and key not in keys
            )
        return keys

    def _timeout_seconds(self, override_seconds: float | None = None) -> float:
        if override_seconds is not None:
            return max(0.5, override_seconds)
        request_timeout = getattr(settings, "llm_request_timeout_seconds", 20)
        fast_timeout = getattr(settings, "llm_fast_timeout_seconds", request_timeout)
        return min(request_timeout, fast_timeout)


longcat_client = LongCatClient()
