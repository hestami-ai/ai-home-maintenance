"""
vLLM inference client.

Provides an interface to the local vLLM server for LLM inference,
using the OpenAI-compatible API.
"""

import structlog
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from historian.config import VLLMConfig, get_settings

logger = structlog.get_logger()


class VLLMClient:
    """
    Client for vLLM OpenAI-compatible inference API.

    Configured for deterministic outputs with temperature=0 by default.
    """

    def __init__(self, config: VLLMConfig | None = None):
        self.config = config or get_settings().vllm
        self._client = AsyncOpenAI(
            base_url=self.config.url,
            api_key=self.config.api_key,
            timeout=self.config.timeout,
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
    )
    async def complete(
        self,
        prompt: str,
        *,
        system_prompt: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """
        Generate a completion for the given prompt.

        Args:
            prompt: The user prompt
            system_prompt: Optional system prompt
            temperature: Override default temperature
            max_tokens: Override default max tokens

        Returns:
            The generated text response
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        logger.debug(
            "vllm_request",
            model=self.config.model,
            prompt_length=len(prompt),
            temperature=temperature or self.config.temperature,
        )

        response = await self._client.chat.completions.create(
            model=self.config.model,
            messages=messages,
            temperature=temperature if temperature is not None else self.config.temperature,
            max_tokens=max_tokens or self.config.max_tokens,
        )

        result = response.choices[0].message.content or ""
        logger.debug("vllm_response", response_length=len(result))
        return result

    async def health_check(self) -> bool:
        """Check if vLLM server is responsive."""
        try:
            # Simple models list call to verify connectivity
            await self._client.models.list()
            return True
        except Exception as e:
            logger.error("vllm_health_check_failed", error=str(e))
            return False
