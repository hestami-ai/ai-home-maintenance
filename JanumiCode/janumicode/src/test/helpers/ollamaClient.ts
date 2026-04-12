/**
 * Minimal Ollama HTTP client for the prompt-regression test harness.
 *
 * Test-only — does NOT register a production LLMProvider. Calls
 * POST /api/generate with stream:false and (optionally) think:true so we
 * capture the model's reasoning trace alongside the final response.
 *
 * Defaults follow Gemma 4 best practices (temperature=1.0, top_p=0.95,
 * top_k=64). See docs/Gemm4 on Ollama Information.md.
 */

// We use Node's built-in http module directly instead of fetch because
// undici (which backs fetch) enforces a 5-minute headers timeout that we
// cannot disable without an external Agent dependency. gemma4:26b with
// thinking enabled and a large prompt routinely exceeds 5 minutes before
// the first byte arrives, so we drop to http.request and let our own
// AbortController govern the deadline.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import * as http from 'node:http';

export interface OllamaCallOptions {
	model: string;
	system?: string;
	prompt: string;
	/** Enable thinking mode. Default: true. */
	think?: boolean;
	/** Force JSON output mode. */
	format?: 'json';
	temperature?: number;
	topP?: number;
	topK?: number;
	presencePenalty?: number;
	/** Ollama context window size (num_ctx). When unset, the server uses the
	 *  model's default. Use a larger value when the prompt is long. */
	numCtx?: number;
	/** Override base URL. Default: process.env.OLLAMA_URL ?? http://127.0.0.1:11434. */
	baseUrl?: string;
	/** Per-call timeout in ms. Default: 600_000 (10min — gemma4:26b can be slow). */
	timeoutMs?: number;
}

/**
 * Per-model recommended sampling parameters. When a model matches one of
 * these patterns, the caller's temperature/top_p/top_k/presence_penalty
 * values are IGNORED in favor of these defaults. This prevents callers from
 * accidentally pinning a model into a degenerate sampling regime — most
 * notably qwen3.5, which requires presence_penalty=1.5 to avoid repetition
 * loops during long-thinking generation, and which loops indefinitely at
 * low temperature on large prompts.
 */
interface ModelSamplingDefaults {
	pattern: RegExp;
	temperature: number;
	top_p: number;
	top_k: number;
	presence_penalty?: number;
}
const MODEL_SAMPLING_PROFILES: ModelSamplingDefaults[] = [
	{
		// qwen3.5 official recommended settings — DO NOT lower temperature
		// or omit presence_penalty; long-context generation hangs without them.
		pattern: /^qwen3\.5/i,
		temperature: 1.0,
		top_p: 0.95,
		top_k: 20,
		presence_penalty: 1.5,
	},
];

export function resolveSamplingForModel(
	model: string,
	opts: OllamaCallOptions
): { temperature: number; top_p: number; top_k: number; presence_penalty?: number } {
	const profile = MODEL_SAMPLING_PROFILES.find((p) => p.pattern.test(model));
	if (profile) {
		return {
			temperature: profile.temperature,
			top_p: profile.top_p,
			top_k: profile.top_k,
			...(profile.presence_penalty !== undefined ? { presence_penalty: profile.presence_penalty } : {}),
		};
	}
	return {
		temperature: opts.temperature ?? 1.0,
		top_p: opts.topP ?? 0.95,
		top_k: opts.topK ?? 64,
		...(opts.presencePenalty !== undefined ? { presence_penalty: opts.presencePenalty } : {}),
	};
}

export interface OllamaResponse {
	/** Final answer (Ollama "response" field), with any inline thought
	 *  channel markers stripped. Named to match Ollama's API field. */
	response: string;
	/** The raw, unmodified Ollama "response" field before thought-marker
	 *  stripping. Useful when debugging discrepancies vs Postman/curl. */
	responseRaw: string;
	/** Captured reasoning trace (Ollama "thinking" field, when think=true). */
	thinking?: string;
	/** JSON-parsed `response` if format='json' and parse succeeds. */
	parsed?: unknown;
	rawDurationMs: number;
	promptEvalCount?: number;
	evalCount?: number;
	model: string;
}

/**
 * Strip Gemma-4 inline thought-channel markers from a response string. The
 * model normally separates thinking via the dedicated `thinking` field when
 * `think:true`, but on some calls fragments leak into the `response` field.
 */
function stripThoughtChannelMarkers(text: string): { clean: string; extracted?: string } {
	// Match `<|channel>thought\n…<channel|>` (and a few minor variants).
	const re = /<\|channel\|?>\s*thought\s*\n([\s\S]*?)<\s*channel\|?>/gi;
	let extracted: string | undefined;
	const clean = text.replace(re, (_match, body) => {
		extracted = (extracted ? `${extracted}\n` : '') + String(body).trim();
		return '';
	}).trim();
	return { clean, extracted };
}

/**
 * Models for which Ollama's `format:"json"` mode misbehaves when combined
 * with `think:true`. With both flags set, qwen3.5 emits the entire JSON
 * answer inside the thinking channel and leaves `response` empty. We
 * therefore drop `format:"json"` for these models — the client's fallback
 * parser still extracts JSON from prose responses, so we lose nothing.
 *
 * Override with OLLAMA_FORCE_JSON_FORMAT=1 (force on) or
 * OLLAMA_DISABLE_JSON_FORMAT=1 (force off) for ad-hoc experiments.
 */
const JSON_FORMAT_DENY_PATTERNS: RegExp[] = [
	/^qwen/i,
];

export function shouldUseJsonFormat(model: string, requested: 'json' | undefined): boolean {
	if (requested !== 'json') return false;
	if (process.env.OLLAMA_FORCE_JSON_FORMAT === '1') return true;
	if (process.env.OLLAMA_DISABLE_JSON_FORMAT === '1') return false;
	return !JSON_FORMAT_DENY_PATTERNS.some((re) => re.test(model));
}

export async function callOllama(opts: OllamaCallOptions): Promise<OllamaResponse> {
	const baseUrl = opts.baseUrl ?? process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
	const url = `${baseUrl.replace(/\/+$/, '')}/api/generate`;
	const think = opts.think ?? true;
	const useJsonFormat = shouldUseJsonFormat(opts.model, opts.format);

	const sampling = resolveSamplingForModel(opts.model, opts);
	const body: Record<string, unknown> = {
		model: opts.model,
		prompt: opts.prompt,
		stream: false,
		think,
		options: {
			...sampling,
			...(opts.numCtx !== undefined ? { num_ctx: opts.numCtx } : {}),
		},
	};
	if (opts.system !== undefined) body.system = opts.system;
	if (useJsonFormat) body.format = 'json';

	const timeoutMs = opts.timeoutMs ?? 1_800_000; // 30 min default
	const startedAt = Date.now();

	const responseBody = await new Promise<string>((resolve, reject) => {
		const parsed = new URL(url);
		const payload = JSON.stringify(body);
		const req = http.request(
			{
				hostname: parsed.hostname,
				port: parsed.port || 80,
				path: parsed.pathname + parsed.search,
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'content-length': Buffer.byteLength(payload),
				},
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (c: Buffer) => chunks.push(c));
				res.on('end', () => {
					const text = Buffer.concat(chunks).toString('utf8');
					if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
						resolve(text);
					} else {
						reject(new Error(`Ollama /api/generate failed: ${res.statusCode} — ${text.slice(0, 500)}`));
					}
				});
				res.on('error', reject);
			}
		);
		req.setTimeout(timeoutMs, () => {
			req.destroy(new Error(`Ollama /api/generate timed out after ${timeoutMs}ms`));
		});
		req.on('error', reject);
		req.write(payload);
		req.end();
	});

	const rawDurationMs = Date.now() - startedAt;
	const json = JSON.parse(responseBody) as {
		response?: string;
		thinking?: string;
		prompt_eval_count?: number;
		eval_count?: number;
		model?: string;
	};

	const responseRaw = String(json.response ?? '');
	const { clean: cleanedResponse, extracted: leakedThought } = stripThoughtChannelMarkers(responseRaw);
	const thinking = json.thinking || leakedThought;

	// Try to extract JSON from `response`, then fall back to `thinking`. Some
	// models (notably qwen3.5) emit the entire answer inside the thinking
	// channel and produce an empty response field even with format:'json'.
	let parsed: unknown;
	let response = cleanedResponse;
	const tryParse = (s: string): unknown => {
		if (!s) return undefined;
		try { return JSON.parse(s); } catch { /* fall through */ }
		// Strip markdown code fences if present.
		const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
		if (fenced) {
			try { return JSON.parse(fenced[1]); } catch { /* fall through */ }
		}
		// Greedy match the largest {...} block.
		const m = s.match(/\{[\s\S]*\}/);
		if (m) {
			try { return JSON.parse(m[0]); } catch { /* fall through */ }
		}
		return undefined;
	};

	if (opts.format === 'json') {
		parsed = tryParse(response);
		if (parsed === undefined && thinking) {
			const fromThinking = tryParse(thinking);
			if (fromThinking !== undefined) {
				parsed = fromThinking;
				// Promote the recovered JSON into `response` so downstream code
				// (artifact saving, judge prompt) sees the actual answer.
				response = typeof fromThinking === 'string'
					? fromThinking
					: JSON.stringify(fromThinking, null, 2);
			}
		}
	}

	return {
		response,
		responseRaw,
		thinking,
		parsed,
		rawDurationMs,
		promptEvalCount: json.prompt_eval_count,
		evalCount: json.eval_count,
		model: json.model ?? opts.model,
	};
}
