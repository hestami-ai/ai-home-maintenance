// ⭐ `JAN-CRITREAD` J2-2 — THE HARNESS OLLAMA TRANSPORT, rebuilt from `REG-F-427`'s scratch shim (`agy-shim.ts`, which
// stood in for agy through `JPWB_AGY_BIN` — the route `REG-F-441` closes). NOT DEPLOYABLE: the product has no
// local-model reviewer backend (§3.5), so a run through this transport measures a model the product cannot deploy.
//
// What the shim measured, kept (`REG-F-427` (3), (5); `REG-F-429`):
//   · UNLOAD BEFORE EVERY CALL. Warm, the same prompt got a different reply depending on what the server did before;
//     a fresh load pinned all four models byte for byte. The unload is CONFIRMED on `/api/ps`, and a model that will
//     not unload is a harness refusal — a warm call would measure the server's history, not the candidate.
//   · THE SERVED TEMPLATE'S HASH AND THE SERVER'S CLOCK, PER CALL. gpt-oss's template injects `Current date:
//     {{ currentDate }}`, and across a day boundary 0 of 4 replies held; the clock is the `Date` header of the show
//     request made immediately before the call.
//   · THE PRODUCT'S BOUNDS, RE-IMPOSED — an injected `print` bypasses them: the connection is cut at 240 s, as
//     `agyPrint`'s execFile kill cuts agy (9 of 9 looping replies re-run that way were killed with no answer), and a
//     prompt over agy's 28,000-character argv budget is refused before the server is touched.
//
// ⛔ THE THINKING NEVER LEAVES THIS FILE. Ollama returns a model's reasoning in its own field; only `response` is
// returned, and only its answer span reaches a tracked record (§5.3).
//
// ⚠ `keep_alive: 0` ON THE CALL ITSELF, where the shim kept the model for 20 minutes: the server is shared, and a run
// killed mid-call must still leave it unloaded — cleanup that needs a `finally` does not survive a kill.
import { createHash } from 'node:crypto';
import { MAX_AGY_PROMPT_CHARS } from '../../apps/rph-demo/src/lib/server/assurance/agy-cli.js';
import { HarnessRefusal } from './preflight.js';
import type { CandidateIdentity, ServedFacts } from './record.js';
import { TransportFailure, type Transport } from './transports.js';

/** The product's kill — `agyPrint`'s and `devinPrint`'s execFile timeout — re-imposed on every Ollama call. */
export const OLLAMA_BOUND_MS = 240_000;

export interface OllamaTransportOptions {
	readonly baseUrl: string;
	readonly model: string;
	/** Sampling options, recorded in the candidate identity: `REG-F-427` pinned with temperature 0, seed 42, num_ctx 131072. */
	readonly options: Readonly<Record<string, number>>;
	readonly think?: string | boolean;
	/** For tests only: the bound is the product's 240 s. */
	readonly boundMs?: number;
	readonly unloadPolls?: number;
	readonly unloadPollMs?: number;
	readonly now?: () => number;
}

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

export function createOllamaTransport(
	o: OllamaTransportOptions
): Transport & { unload(): Promise<void> } {
	const base = o.baseUrl.replace(/\/+$/, '');
	const boundMs = o.boundMs ?? OLLAMA_BOUND_MS;
	const now = o.now ?? (() => performance.now());
	const post = (path: string, body: unknown, signal?: AbortSignal) =>
		fetch(`${base}${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
			...(signal ? { signal } : {})
		});
	const json = async (res: Response, what: string): Promise<Record<string, unknown>> => {
		if (!res.ok) throw new HarnessRefusal(`ollama ${what}: HTTP ${res.status}`);
		return (await res.json()) as Record<string, unknown>;
	};

	/** Unload the model and CONFIRM it is gone. */
	const unload = async (): Promise<void> => {
		await json(await post('/api/generate', { model: o.model, keep_alive: 0 }), 'unload');
		const polls = o.unloadPolls ?? 120;
		for (let i = 0; i < polls; i++) {
			const ps = await json(await fetch(`${base}/api/ps`), 'ps');
			const loaded = ((ps.models as { name?: string }[] | undefined) ?? []).some(
				(m) => m.name === o.model
			);
			if (!loaded) return;
			await new Promise((r) => setTimeout(r, o.unloadPollMs ?? 500));
		}
		throw new HarnessRefusal(
			`ollama: ${o.model} did not unload — refusing a warm call (REG-F-427 (2), (3))`
		);
	};

	/** The served template, and the server's clock as the show request found it. */
	const served = async (): Promise<
		ServedFacts & { readonly template: string; readonly modelfile: string }
	> => {
		const res = await post('/api/show', { model: o.model });
		const serverClock = res.headers.get('date');
		const show = await json(res, 'show');
		if (!serverClock)
			throw new HarnessRefusal(
				'ollama show: no Date header — the server’s clock cannot be recorded'
			);
		const template = typeof show.template === 'string' ? show.template : '';
		const modelfile = typeof show.modelfile === 'string' ? show.modelfile : '';
		return { templateSha256: sha256(template), serverClock, template, modelfile };
	};

	return {
		name: 'ollama',
		unload,
		close: unload,
		identify: async (): Promise<CandidateIdentity> => {
			const version = await json(await fetch(`${base}/api/version`), 'version');
			const tags = await json(await fetch(`${base}/api/tags`), 'tags');
			const listed = ((tags.models as { name?: string; digest?: string }[] | undefined) ?? []).find(
				(m) => m.name === o.model
			);
			if (!listed?.digest)
				throw new HarnessRefusal(`ollama: ${o.model} is not served, or has no digest`);
			const s = await served();
			return {
				transport: 'ollama',
				agentId: 'ollama',
				provider: 'ollama',
				modelLabel: o.model,
				servedModelDigest: listed.digest,
				servedTemplateSha256: s.templateSha256,
				servedModelfileSha256: sha256(s.modelfile),
				templateInjectsDate: s.template.includes('currentDate'),
				serverVersion: String(version.version),
				options: { ...o.options, ...(o.think === undefined ? {} : { think: o.think }) },
				bounds: { wallClockMs: boundMs, promptChars: MAX_AGY_PROMPT_CHARS, printTimeout: null },
				argv: null
			};
		},
		call: async (prompt) => {
			if (prompt.length > MAX_AGY_PROMPT_CHARS)
				// ⭐ BEFORE THE SERVER IS TOUCHED: nothing was served, so this is the one ollama CALL the record admits
				// without served facts — and it says so, rather than leaving an absence the record would refuse.
				throw new TransportFailure(
					'REFUSAL',
					`the prompt is ${prompt.length} characters, over the ${MAX_AGY_PROMPT_CHARS}-character limit agy imposes`,
					{ preContact: true }
				);
			await unload();
			const facts = await served();
			const fact: ServedFacts = {
				templateSha256: facts.templateSha256,
				serverClock: facts.serverClock
			};
			const cut = new AbortController();
			const timer = setTimeout(() => cut.abort(), boundMs);
			const started = now();
			try {
				const res = await post(
					'/api/generate',
					{
						model: o.model,
						prompt,
						stream: false,
						...(o.think === undefined ? {} : { think: o.think }),
						keep_alive: 0,
						options: o.options
					},
					cut.signal
				);
				if (!res.ok) throw new TransportFailure('REFUSAL', `HTTP ${res.status}`, { served: fact });
				const body = (await res.json()) as { response?: unknown };
				return { returned: typeof body.response === 'string' ? body.response : '', served: fact };
			} catch (e) {
				if (e instanceof TransportFailure) throw e;
				if (cut.signal.aborted)
					throw new TransportFailure(
						'TIMEOUT',
						`cut after ${Math.round(now() - started)} ms, at the ${boundMs} ms bound`,
						{ served: fact }
					);
				throw new TransportFailure('REFUSAL', 'the server did not answer the call', {
					served: fact
				});
			} finally {
				clearTimeout(timer);
			}
		}
	};
}
