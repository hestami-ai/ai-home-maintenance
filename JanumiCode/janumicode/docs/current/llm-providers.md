# LLM Provider Architecture

The JanumiCode system does not rely on a single, monolithic LLM provider. Instead, it features a flexible "LLM Provider Abstraction Layer" (`src/lib/llm/`) allowing different roles to be powered by different models (Anthropic Claude, OpenAI GPT, Google Gemini, etc.) seamlessly.

## The `LLMProvider` Interface

All LLM interaction is mediated through the generic `LLMProvider` TypeScript interface. New LLMs can be slotted into JanumiCode by implementing this standardized contract.

Key capabilities required by the interface:
*   **complete**: Core function for obtaining a generated completion from an `LLMRequest`.
*   **countTokens**: Tool for locally tracking context utilization against the system's token budget.
*   **getRateLimitInfo**: Allows the JanumiCode engine to responsibly pause or back off before exhausting API limits.
*   **validateApiKey**: A preliminary health check to ensure API credentials are valid before beginning a dialogue.

## Message Standardization

The provider abstraction receives a common `LLMRequest` containing `Message` arrays annotated with explicit roles (`system`, `user`, `assistant`). It translates this internal format to the specific JSON shapes expected by proprietary providers (e.g., mapping our `system` parameter to a specific API field, translating multi-modal elements correctly).

## Resilience and Error Handling

Network interactions with external LLM APIs are inherently unstable. JanumiCode wraps all provider interactions in a standardized retry mechanism (`executeWithRetry`). This handles specific `LLMErrorTypes` (like `RATE_LIMIT` or `NETWORK_ERROR`) using exponential backoff with jitter to ensure the workflow isn't arbitrarily interrupted by transient vendor outages.

## Provider Manufacturing

The `providerFactory` orchestrates the initialization of LLMs based on user configuration (`janumicode.llm.${role}.provider`). This enables the system's "cost competitiveness" by allowing users to select highly advanced reasoning models (e.g., `claude-sonnet-4`) for complex tasks like the `Executor` proposing architectural plans, while selecting fast, small models (e.g., `gemini-3.0-flash`) for the `Verifier` evaluating straightforward claims.
