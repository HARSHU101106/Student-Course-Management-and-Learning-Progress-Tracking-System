"""LLM access behind one tiny interface. 'offline' means no model is used (deterministic fallbacks run)."""
from typing import Protocol

import httpx

from ..config import Settings


class LLMError(RuntimeError):
    pass


class LLM(Protocol):
    name: str
    available: bool

    async def complete(self, system: str, user: str, *, json_mode: bool = False, max_tokens: int = 600) -> str: ...


class OfflineLLM:
    name = "offline"
    available = False

    async def complete(self, system, user, *, json_mode=False, max_tokens=600):  # pragma: no cover
        raise LLMError("No LLM provider is configured.")


class ChatCompletionsLLM:
    """OpenAI-compatible /chat/completions (OpenAI, Azure OpenAI, vLLM, Ollama, ...)."""

    available = True

    def __init__(self, *, name: str, url: str, headers: dict[str, str], model: str | None, timeout: float,
                 transport: httpx.AsyncBaseTransport | None = None):
        self.name = name
        self._url = url
        self._headers = headers
        self._model = model
        self._timeout = timeout
        self._transport = transport

    async def complete(self, system, user, *, json_mode=False, max_tokens=600):
        body: dict = {
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": 0.2,
            "max_tokens": max_tokens,
        }
        if self._model:
            body["model"] = self._model
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        try:
            async with httpx.AsyncClient(timeout=self._timeout, transport=self._transport) as client:
                response = await client.post(self._url, headers=self._headers, json=body)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"] or ""
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as error:
            raise LLMError(f"LLM request failed: {type(error).__name__}") from error


def build_llm(settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> LLM:
    if settings.llm_provider == "openai":
        return ChatCompletionsLLM(
            name=f"openai:{settings.llm_model}",
            url=f"{settings.llm_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
            model=settings.llm_model,
            timeout=settings.llm_timeout_seconds,
            transport=transport,
        )
    if settings.llm_provider == "azure":
        endpoint = settings.azure_openai_endpoint.rstrip("/")
        url = (
            f"{endpoint}/openai/deployments/{settings.azure_openai_deployment}/chat/completions"
            f"?api-version={settings.azure_openai_api_version}"
        )
        return ChatCompletionsLLM(
            name=f"azure:{settings.azure_openai_deployment}",
            url=url,
            headers={"api-key": settings.llm_api_key},
            model=None,
            timeout=settings.llm_timeout_seconds,
            transport=transport,
        )
    return OfflineLLM()
