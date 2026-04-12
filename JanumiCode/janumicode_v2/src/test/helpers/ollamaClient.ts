/**
 * Minimal Ollama HTTP client for the prompt-regression test harness.
 * Ported from v1 with model-specific sampling profiles and JSON format deny-list.
 *
 * Test-only — calls POST /api/generate with stream:false and think:true.
 * Uses Node's built-in http module (not fetch) to avoid undici's 5-minute headers timeout.
 */

import * as http from 'node:http';

// ── Types ───────────────────────────────────────────────────────────

export interface OllamaCallOptions {
  model: string;
  system?: string;
  prompt: string;
  think?: boolean;
  format?: 'json';
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  numCtx?: number;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface OllamaResponse {
  response: string;
  responseRaw: string;
  thinking: string;
  parsed: Record<string, unknown> | null;
  model: string;
  totalDuration: number;
}

// ── Model-Specific Profiles ─────────────────────────────────────────

interface ModelSamplingProfile {
  pattern: RegExp;
  temperature: number;
  top_p: number;
  top_k: number;
  presence_penalty?: number;
}

const MODEL_SAMPLING_PROFILES: ModelSamplingProfile[] = [
  {
    // qwen3.5: requires presence_penalty=1.5 to avoid repetition loops
    pattern: /^qwen3\.5/i,
    temperature: 1.0,
    top_p: 0.95,
    top_k: 20,
    presence_penalty: 1.5,
  },
];

/** Models where format:"json" causes output to go into thinking field */
const JSON_FORMAT_DENY_PATTERNS: RegExp[] = [
  /^qwen/i,
];

export function resolveSamplingForModel(
  model: string,
  opts: OllamaCallOptions,
): { temperature: number; top_p: number; top_k: number; presence_penalty?: number } {
  const profile = MODEL_SAMPLING_PROFILES.find(p => p.pattern.test(model));
  if (profile) {
    return {
      temperature: profile.temperature,
      top_p: profile.top_p,
      top_k: profile.top_k,
      ...(profile.presence_penalty !== undefined
        ? { presence_penalty: profile.presence_penalty }
        : {}),
    };
  }
  return {
    temperature: opts.temperature ?? 1.0,
    top_p: opts.topP ?? 0.95,
    top_k: opts.topK ?? 64,
    ...(opts.presencePenalty !== undefined
      ? { presence_penalty: opts.presencePenalty }
      : {}),
  };
}

export function shouldUseJsonFormat(model: string): boolean {
  if (process.env.OLLAMA_FORCE_JSON_FORMAT === '1') return true;
  if (process.env.OLLAMA_DISABLE_JSON_FORMAT === '1') return false;
  return !JSON_FORMAT_DENY_PATTERNS.some(p => p.test(model));
}

// ── Main Call Function ──────────────────────────────────────────────

export async function callOllama(opts: OllamaCallOptions): Promise<OllamaResponse> {
  const baseUrl = opts.baseUrl ?? process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
  const timeoutMs = opts.timeoutMs ?? 1_800_000; // 30 minutes default
  const think = opts.think ?? true;

  const sampling = resolveSamplingForModel(opts.model, opts);
  const useJsonFormat = opts.format === 'json' && shouldUseJsonFormat(opts.model);

  const body: Record<string, unknown> = {
    model: opts.model,
    prompt: opts.prompt,
    stream: false,
    think,
    options: {
      ...sampling,
      ...(opts.numCtx ? { num_ctx: opts.numCtx } : {}),
    },
  };

  if (opts.system) body.system = opts.system;
  if (useJsonFormat) body.format = 'json';

  const url = new URL('/api/generate', baseUrl);

  return new Promise<OllamaResponse>((resolve, reject) => {
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf-8');
          const json = JSON.parse(raw);

          let response = json.response ?? '';
          const thinking = json.thinking ?? '';

          // Fallback: if response is empty but thinking has parseable JSON
          if (!response.trim() && thinking.trim()) {
            response = thinking;
          }

          // Strip markdown code fences
          response = stripCodeFences(response);

          // Try to parse as JSON
          let parsed: Record<string, unknown> | null = null;
          try {
            parsed = JSON.parse(response);
          } catch {
            // Try extracting largest JSON block
            const jsonBlock = extractLargestJsonBlock(response);
            if (jsonBlock) {
              try {
                parsed = JSON.parse(jsonBlock);
              } catch { /* give up */ }
            }
          }

          resolve({
            response,
            responseRaw: json.response ?? '',
            thinking,
            parsed,
            model: json.model ?? opts.model,
            totalDuration: json.total_duration ?? 0,
          });
        } catch (err) {
          reject(new Error(`Failed to parse Ollama response: ${err}`));
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Ollama call timed out after ${timeoutMs}ms`));
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Helpers ─────────────────────────────────────────────────────────

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();
}

function extractLargestJsonBlock(text: string): string | null {
  const matches: string[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        matches.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  if (matches.length === 0) return null;
  return matches.reduce((a, b) => a.length >= b.length ? a : b);
}

/**
 * Check if Ollama is available at the configured URL.
 */
export async function isOllamaAvailable(baseUrl?: string): Promise<boolean> {
  const url = baseUrl ?? process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
  return new Promise((resolve) => {
    const req = http.get(`${url}/api/tags`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}
