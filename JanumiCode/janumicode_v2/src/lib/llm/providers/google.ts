/**
 * Google/Gemini LLM provider adapter.
 * Uses the Google Generative AI API directly.
 */

import * as https from 'node:https';
import type {
  LLMCallOptions,
  LLMCallResult,
  LLMProviderAdapter,
  ToolCall,
} from '../llmCaller';
import { LLMError } from '../llmCaller';

export class GoogleProvider implements LLMProviderAdapter {
  readonly name = 'google';

  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new LLMError('GEMINI_API_KEY not set', 'auth_error');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${apiKey}`;

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: options.prompt }] }],
      ...(options.system ? {
        systemInstruction: { parts: [{ text: options.system }] },
      } : {}),
      generationConfig: {
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
        ...(options.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
      },
    };

    // Native function calling for Gemini.
    if (options.tools && options.tools.length > 0) {
      body.tools = [{
        functionDeclarations: options.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        })),
      }];
      if (options.toolChoice) {
        body.toolConfig = {
          functionCallingConfig: this.mapToolChoice(options.toolChoice),
        };
      }
    }

    return new Promise<LLMCallResult>((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf-8');

            if (res.statusCode && res.statusCode >= 400) {
              reject(this.mapHttpError(res.statusCode, raw));
              return;
            }

            const json = JSON.parse(raw);
            const candidate = json.candidates?.[0];
            const parts: Array<Record<string, unknown>> = candidate?.content?.parts ?? [];

            const text = parts
              .filter(p => typeof p.text === 'string')
              .map(p => p.text as string)
              .join('');

            const toolCalls: ToolCall[] = parts
              .filter(p => p.functionCall)
              .map(p => {
                const fc = p.functionCall as { name: string; args?: Record<string, unknown> };
                return { name: fc.name, params: fc.args ?? {} };
              });

            let parsed: Record<string, unknown> | null = null;
            if (options.responseFormat === 'json') {
              try { parsed = JSON.parse(text); } catch { /* not valid JSON */ }
            }

            resolve({
              text,
              parsed,
              toolCalls,
              provider: 'google',
              model: options.model,
              inputTokens: json.usageMetadata?.promptTokenCount ?? null,
              outputTokens: json.usageMetadata?.candidatesTokenCount ?? null,
              usedFallback: false,
              retryAttempts: 0,
            });
          } catch (err) {
            reject(new LLMError(`Failed to parse Google response: ${err}`, 'unknown'));
          }
        });
      });

      req.setTimeout(600_000, () => {
        req.destroy();
        reject(new LLMError('Google API request timed out', 'network_timeout', undefined, true));
      });

      req.on('error', (err) => {
        reject(new LLMError(`Google API connection error: ${err.message}`, 'network_timeout', undefined, true));
      });

      req.write(JSON.stringify(body));
      req.end();
    });
  }

  private mapToolChoice(
    choice: NonNullable<LLMCallOptions['toolChoice']>,
  ): Record<string, unknown> {
    if (typeof choice === 'string') {
      switch (choice) {
        case 'auto': return { mode: 'AUTO' };
        case 'none': return { mode: 'NONE' };
        case 'required': return { mode: 'ANY' };
      }
    }
    return { mode: 'ANY', allowedFunctionNames: [choice.name] };
  }

  private mapHttpError(status: number, body: string): LLMError {
    if (status === 429) return new LLMError(body, 'rate_limit', status, true);
    if (status === 503 || status === 504) return new LLMError(body, 'service_unavailable', status, true);
    if (status === 401 || status === 403) return new LLMError(body, 'auth_error', status);
    if (status === 500) return new LLMError(body, 'model_error', status, true);
    if (status === 400) {
      if (body.includes('context') || body.includes('too long')) {
        return new LLMError(body, 'context_exceeded', status);
      }
      return new LLMError(body, 'schema_error', status);
    }
    return new LLMError(body, 'unknown', status);
  }
}
