/**
 * Anthropic LLM provider adapter.
 * Uses the @anthropic-ai/sdk package.
 */

import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
  ToolCall,
} from '../llmCaller';
import { LLMError } from '../llmCaller';

export class AnthropicProvider implements LLMProviderAdapter {
  readonly name = 'anthropic';

  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    // Dynamic import to avoid requiring the SDK at module load time
    const { default: Anthropic } = await import('@anthropic-ai/sdk');

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const tools = options.tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Record<string, unknown> & { type: 'object' },
    }));

    const toolChoice = options.toolChoice
      ? this.mapToolChoice(options.toolChoice)
      : tools && tools.length > 0
        ? { type: 'auto' as const }
        : undefined;

    try {
      const response = await client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        ...(options.system ? { system: options.system } : {}),
        messages: [{ role: 'user', content: options.prompt }],
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(tools ? { tools: tools as any } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(toolChoice ? { tool_choice: toolChoice as any } : {}),
      });

      const text = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as { type: 'text'; text: string }).text)
        .join('');

      const toolCalls: ToolCall[] = response.content
        .filter(block => block.type === 'tool_use')
        .map(block => {
          const tu = block as { type: 'tool_use'; id: string; name: string; input: unknown };
          return {
            name: tu.name,
            params: (tu.input ?? {}) as Record<string, unknown>,
            id: tu.id,
          };
        });

      let parsed: Record<string, unknown> | null = null;
      if (options.responseFormat === 'json') {
        try { parsed = JSON.parse(text); } catch { /* not valid JSON */ }
      }

      return {
        text,
        parsed,
        toolCalls,
        provider: 'anthropic',
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        usedFallback: false,
        retryAttempts: 0,
      };
    } catch (err: unknown) {
      throw this.mapError(err);
    }
  }

  private mapToolChoice(
    choice: NonNullable<LLMCallOptions['toolChoice']>,
  ): Record<string, unknown> {
    if (typeof choice === 'string') {
      // 'auto' | 'none' | 'required'
      if (choice === 'required') return { type: 'any' };
      return { type: choice };
    }
    return { type: 'tool', name: choice.name };
  }

  private mapError(err: unknown): LLMError {
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as { status: number }).status;
      const message = (err as { message?: string }).message ?? String(err);

      if (status === 429) return new LLMError(message, 'rate_limit', status, true);
      if (status === 503 || status === 504) return new LLMError(message, 'service_unavailable', status, true);
      if (status === 401 || status === 403) return new LLMError(message, 'auth_error', status);
      if (status === 500) return new LLMError(message, 'model_error', status, true);
      if (status === 400) {
        if (message.includes('context') || message.includes('too long')) {
          return new LLMError(message, 'context_exceeded', status);
        }
        return new LLMError(message, 'schema_error', status);
      }
    }
    return new LLMError(
      err instanceof Error ? err.message : String(err),
      'unknown',
    );
  }
}
