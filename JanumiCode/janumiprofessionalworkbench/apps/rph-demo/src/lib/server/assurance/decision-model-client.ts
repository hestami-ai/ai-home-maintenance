// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D51 (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.3, revision 9) —
// THE PRODUCT'S DECISION MODEL: pplx-decider over Ollama's `POST /v1/systemone`, one cold request per check and per statement,
// exactly as the screen of the sponsor's construct measured it (`step1_single.py`; `d46-facts-verbatim.md` V11, V12).
//
// For a review's requests (`IndicationsSource`), in step 1's order:
//   1. THE IDENTITY, before the first request — the model's digest from `/api/tags`, then the server's version from
//      `/api/version` — each held to the configured identity (in Z2b, D54's records'): another digest or another version
//      refuses the review (`REG-F-608`: Ollama's own update moved the cold scores). ⭐⭐ Package L8 (D63; `REG-D-152`): a version
//      the identity accepts beside its own (`alsoAccepted`) is asked, unmeasured, and recorded as the server answered it.
//   2. THE MODEL FOUND LOADED IS UNLOADED by step 1's own unload request (`unloadBody`; `step1_single.py` 104-105).
//   3. BEFORE EVERY REQUEST, `/api/ps` read until the model is absent — step 1's `wait_gone` — refusing past 120 s, and the
//      other models the server holds read once more, as step 1 recorded them; another model loaded refuses nothing (the sponsor
//      ruled on 2026-11-06 that the decision model is not to be measured against the graphics card, a ruling ~~still to be registered~~ registered as `REG-D-147`).
//   4. THE REQUEST: its exact bytes (`decisionModelBody`), `content-type: application/json`, `keep_alive` 0 — so the model is
//      unloaded after it, and the next request is answered by a fresh load — its score read as `answers[key].noul`.
// ⛔ Every refusal is a reason, never a throw: no server, no model, another digest, another server version, an HTTP error (a 413
// among them), a request past 120 s, the review's requests past 1,200 s together, a score missing, a score extra, a score that is
// no probability. The validator refuses the review with it, before any reviewer call (`indicationsRefusedStatement`).
// ⭑ Every request made is reported with the result, answered or not (`IndicationExchange`): the validator records each as a try
// of its own (D43's durable record, per request).
// ⚠ Where this is not step 1's, and why: step 1 cut a request at 300 s (`wide_local.py`'s `BOUND`) and stopped its run on any
// failure; the product cuts at D51's 120 s and refuses the review instead. Its slowest measured request took 21.2 s.
// ⛔ The model is the operator's, configured, never defaulted (`REG-D-052`; `decision-model.ts`).
import { DECISION_MODEL_TEXT, decisionModelBody, unloadBody, type DecisionModelText } from './decision-model-request.js';
import type { IndicationExchange, IndicationsResult, IndicationsSource } from './reasoning-review-validator.js';

/** D51's bounds, and step 1's poll and read: 120 s a request, 1,200 s a review's requests, 120 s for the model to leave. */
export interface DecisionModelBounds {
	readonly requestMs: number;
	readonly reviewMs: number;
	readonly unloadMs: number;
	/** How long step 1 slept between two reads of `/api/ps`. */
	readonly pollMs: number;
	/** Step 1's `get`: its timeout for every read of the server. */
	readonly readMs: number;
}
export const DECISION_MODEL_BOUNDS: DecisionModelBounds = Object.freeze({
	requestMs: 120_000,
	reviewMs: 1_200_000,
	unloadMs: 120_000,
	pollMs: 500,
	readMs: 60_000
});

/** The identity a review's requests are held to: the model's digest — 12 hexadecimal characters or more — and the version. */
export interface DecisionModelIdentity {
	readonly digest: string;
	readonly serverVersion: string;
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package L8 — D63 (`REG-D-152`) — THE SERVER VERSIONS ACCEPTED BESIDE `serverVersion`, the one measured,
	 * WITHOUT RE-MEASUREMENT. REQUIRED, so every caller says which: the product's review path lists the sponsor's
	 * (`decision-model.ts`, `DECISION_MODEL_ALSO_ACCEPTED`); D53's re-derivation and the qualification's own tools list none. Empty, a
	 * server of another version is refused in the words it always was; listed, the refusal names every version accepted and cites
	 * REG-D-152. The version a server answers is recorded as it answered (`served.serverVersion`).
	 */
	readonly alsoAccepted: readonly string[];
}

export interface DecisionModelClientOptions {
	/** The server's address, as `http://localhost:11434`. */
	readonly server: string;
	/** The model, as the server names it: configured, never defaulted (`REG-D-052`). */
	readonly model: string;
	readonly identity: DecisionModelIdentity;
	/** For tests: the bounds shortened. Absent, D51's. */
	readonly bounds?: Partial<DecisionModelBounds>;
	/** PER-11 occurrence clock, for each request's record. */
	readonly clock?: () => string;
	/** For tests: the request's fixed text. Absent, the screen's (`DECISION_MODEL_TEXT`). */
	readonly text?: DecisionModelText;
	/**
	 * ⭐⭐ Package Z2b — D54 — the HTTP client the requests go through: absent, the platform's `fetch`. ⚠ Handed in only where no
	 * server is meant to be reached: the reviewer fingerprint's pointer component drives the cold path against a server held in
	 * memory, so a change to the path moves the fingerprint (`scripts/reviewer-qual/decision-model-pointer.ts`).
	 */
	readonly fetch?: typeof fetch;
}

/** A reason a review is refused with: thrown inside the client, returned from it. */
class Refused extends Error {}

const seconds = (ms: number): string => `${ms / 1000} s`;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const isCut = (e: unknown): boolean => {
	const name = (e as { readonly name?: unknown } | null)?.name;
	return name === 'TimeoutError' || name === 'AbortError';
};
/** What a failed fetch says of itself: its message, and its cause's code where it has one (`ECONNREFUSED`). */
const causeOf = (e: unknown): string => {
	const message = e instanceof Error ? e.message : String(e);
	const cause = (e as { readonly cause?: { readonly code?: unknown; readonly message?: unknown } } | null)?.cause;
	const detail = typeof cause?.code === 'string' ? cause.code : typeof cause?.message === 'string' ? cause.message : '';
	return detail ? `${message}: ${detail}` : message;
};

/** What a `POST /v1/systemone` came to: a response, a request cut at its bound, or no server reached. */
type Posted =
	| { readonly kind: 'ANSWERED'; readonly status: number; readonly text: string }
	| { readonly kind: 'CUT' }
	| { readonly kind: 'UNREACHED'; readonly cause: string };

/** The error a refused response names, where its body is `{"error": "…"}` as Ollama's are. */
function errorOf(text: string): string {
	try {
		const e = (JSON.parse(text) as { readonly error?: unknown }).error;
		return typeof e === 'string' ? `: ${e}` : '';
	} catch {
		return '';
	}
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package Z2b phase 1b — D54 restated (`REG-D-146`; ~~to be filed in d48 as~~ filed in d48 as `REG-F-611`) — THE CLIENT'S OWN WORDS
 * FOR A REQUEST THE SERVER REFUSED: its key, the status and the error the server's answer names (`errorOf`). ⭑ Exported so the
 * static source answers a body recorded refused in these words, made from the recorded status and answer, never a copy of them
 * (`scripts/reviewer-qual/recorded-indications.ts`): a change to the words moves the replay with the client.
 */
export function refusedRequestReason(key: string, status: number, response: string): string {
	return `request ${key} was refused: HTTP ${status}${errorOf(response)}`;
}

/** ⭐ A response read as step 1 read it — `answers[key].noul` — or why it holds no score for exactly what was asked. */
function scoreOf(key: string, posted: Extract<Posted, { kind: 'ANSWERED' }>): IndicationExchange['outcome'] {
	const fail = (parse: 'NOT_ATTEMPTED' | 'EMPTY_RESPONSE' | 'JSON_PARSE_FAILED' | 'SCHEMA_COERCION_FAILED', reason: string) =>
		({ kind: 'FAILED', parse, reason }) as const;
	// ~~`request ${key} was refused: HTTP ${posted.status}${errorOf(posted.text)}`~~ ⛔ MOVED 2026-11-07 (Z2b phase 1b): the same words,
	// from the formatter the static source shares (`refusedRequestReason`).
	if (posted.status < 200 || posted.status > 299) return fail('NOT_ATTEMPTED', refusedRequestReason(key, posted.status, posted.text));
	if (posted.text.trim() === '') return fail('EMPTY_RESPONSE', `request ${key}’s answer was empty`);
	let parsed: unknown;
	try {
		parsed = JSON.parse(posted.text);
	} catch {
		return fail('JSON_PARSE_FAILED', `request ${key}’s answer is no JSON`);
	}
	const answers = (parsed as { readonly answers?: unknown } | null)?.answers;
	if (typeof answers !== 'object' || answers === null || Array.isArray(answers))
		return fail('SCHEMA_COERCION_FAILED', `request ${key}’s answer holds no answers`);
	const extra = Object.keys(answers).filter((k) => k !== key);
	if (extra.length > 0)
		return fail('SCHEMA_COERCION_FAILED', `request ${key}’s answer holds a score for ${extra.length} question(s) it was not asked (${extra.slice(0, 8).join(', ')})`);
	if (!Object.hasOwn(answers, key)) return fail('SCHEMA_COERCION_FAILED', `request ${key}’s answer holds no score for ${key}`);
	const score = ((answers as Record<string, unknown>)[key] as { readonly noul?: unknown } | null)?.noul;
	if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1)
		return fail('SCHEMA_COERCION_FAILED', `request ${key}’s score is not a probability from 0 to 1`);
	return { kind: 'SCORED', score };
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L8 — D63 (`REG-D-152`) — THE CLIENT'S WORDS FOR A SERVER OF ANOTHER VERSION: with none accepted
 * beside the identity's, the words it always had, byte for byte (D51; `REG-F-608`); with some, every version accepted — the
 * identity's first, then the list in its order — and REG-D-152 cited.
 */
function versionRefusal(version: string, identity: DecisionModelIdentity): string {
	if (identity.alsoAccepted.length === 0) return `the server is Ollama ${version}, not ${identity.serverVersion} (D51; REG-F-608)`;
	const accepted = [identity.serverVersion, ...identity.alsoAccepted];
	return `the server is Ollama ${version}, not ${accepted.slice(0, -1).join(', ')} or ${accepted.at(-1)!} (D51; REG-F-608; REG-D-152)`;
}

/**
 * ⭐⭐ THE CLIENT: the product's source of a review's potential indications, against `server`, for `model`, held to `identity`.
 * ⚠ It keeps no state between reviews: each review's identity is read again, before its first request.
 */
export function createDecisionModelClient(o: DecisionModelClientOptions): IndicationsSource {
	const base = o.server.replace(/\/+$/, '');
	const bounds: DecisionModelBounds = { ...DECISION_MODEL_BOUNDS, ...o.bounds };
	const clock = o.clock ?? (() => new Date().toISOString());
	const text = o.text ?? DECISION_MODEL_TEXT;
	const fetch = o.fetch ?? globalThis.fetch;

	/** Step 1's `get`: one read of the server, its JSON. */
	const get = async (path: string): Promise<Record<string, unknown>> => {
		let res: Response;
		try {
			res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(bounds.readMs) });
		} catch (e) {
			throw new Refused(`the decision model’s server at ${base} did not answer ${path} (${isCut(e) ? `no answer within ${seconds(bounds.readMs)}` : causeOf(e)})`);
		}
		if (!res.ok) throw new Refused(`the decision model’s server at ${base} answered ${path} with HTTP ${res.status}`);
		try {
			return (await res.json()) as Record<string, unknown>;
		} catch {
			throw new Refused(`the decision model’s server at ${base} answered ${path} with no JSON`);
		}
	};

	/** Step 1's `loaded`: the models `/api/ps` lists, each by its `name`, or else its `model`. */
	const loaded = async (): Promise<string[]> => {
		const models = (await get('/api/ps')).models;
		return (Array.isArray(models) ? models : []).map((m) => {
			const r = (m ?? {}) as { readonly name?: unknown; readonly model?: unknown };
			return String(r.name || r.model);
		});
	};

	/** Step 1's `wait_gone`: `/api/ps` read until the model is absent, refused past the bound; then the other models it holds. */
	const waitGone = async (): Promise<string[]> => {
		const t0 = Date.now();
		while ((await loaded()).includes(o.model)) {
			if (Date.now() - t0 > bounds.unloadMs)
				throw new Refused(`the model ${o.model} was still loaded ${seconds(bounds.unloadMs)} after the request to unload it (/api/ps)`);
			await sleep(bounds.pollMs);
		}
		return (await loaded()).filter((m) => m !== o.model);
	};

	/** ⭐ The identity, in step 1's order — the digest, then the version — each held to the configured one. */
	const identify = async (): Promise<IndicationExchange['served']> => {
		if (!/^[0-9a-f]{12,64}$/.test(o.identity.digest))
			throw new Refused(`the configured digest ${JSON.stringify(o.identity.digest)} is no digest of 12 to 64 hexadecimal characters`);
		const models = (await get('/api/tags')).models;
		const entry = (Array.isArray(models) ? models : []).find((m) => (m as { readonly name?: unknown } | null)?.name === o.model) as
			| { readonly digest?: unknown }
			| undefined;
		const version = String((await get('/api/version')).version);
		if (entry === undefined) throw new Refused(`the server serves no model named ${o.model} (/api/tags)`);
		const digest = typeof entry.digest === 'string' ? entry.digest : '';
		if (!digest.startsWith(o.identity.digest))
			throw new Refused(`the server serves ${o.model} with digest ${digest.slice(0, 12)}, not ${o.identity.digest} (D51; REG-F-608)`);
		// ⭐⭐ Package L8 — D63 (`REG-D-152`): ~~`version !== o.identity.serverVersion`~~ — the identity's version, or one accepted
		// beside it without re-measurement; the words `versionRefusal`'s, today's where none is.
		if (version !== o.identity.serverVersion && !o.identity.alsoAccepted.includes(version))
			throw new Refused(versionRefusal(version, o.identity));
		return { model: o.model, digest, serverVersion: version };
	};

	/** `wide_local.py`'s `post`: the exact bytes, `content-type: application/json`, cut at `limitMs`. */
	const post = async (body: string, limitMs: number): Promise<Posted> => {
		try {
			const res = await fetch(`${base}/v1/systemone`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body,
				signal: AbortSignal.timeout(limitMs)
			});
			return { kind: 'ANSWERED', status: res.status, text: await res.text() };
		} catch (e) {
			return isCut(e) ? { kind: 'CUT' } : { kind: 'UNREACHED', cause: causeOf(e) };
		}
	};

	return async (requests, material): Promise<IndicationsResult> => {
		// ⭑ A review with no question — no check on its policy's list, no statement cut — has no indication to ask for: nothing is
		// sent, and the server is not read (the fingerprint's `NO-CRITERIA` probe is one).
		if (requests.length === 0) return { scores: {}, exchanges: [] };
		const exchanges: IndicationExchange[] = [];
		const started = Date.now();
		const left = (): number => bounds.reviewMs - (Date.now() - started);
		/** One request sent and kept: its exchange, and what it came to. */
		const send = async (
			key: string,
			body: string,
			served: IndicationExchange['served'],
			otherModels: readonly string[],
			read: (posted: Extract<Posted, { kind: 'ANSWERED' }>) => IndicationExchange['outcome']
		): Promise<IndicationExchange['outcome']> => {
			// ⚠ At least a millisecond: a timer cannot be set to a past moment (`AbortSignal.timeout` refuses a negative delay).
			const limit = Math.max(1, Math.min(bounds.requestMs, left()));
			const requestedAt = clock();
			const posted = await post(body, limit);
			const respondedAt = clock();
			const outcome: IndicationExchange['outcome'] =
				posted.kind === 'ANSWERED'
					? read(posted)
					: posted.kind === 'CUT'
						? {
								kind: 'FAILED',
								parse: 'NOT_ATTEMPTED',
								reason:
									limit < bounds.requestMs
										? `the review’s requests passed ${seconds(bounds.reviewMs)} together: request ${key} was cut ${seconds(limit)} after it was sent`
										: `request ${key} had no answer within ${seconds(bounds.requestMs)}`
							}
						: { kind: 'FAILED', parse: 'NOT_ATTEMPTED', reason: `request ${key} reached no server at ${base} (${posted.cause})` };
			exchanges.push({
				key,
				body,
				response: posted.kind === 'ANSWERED' ? posted.text : '',
				requestedAt,
				respondedAt,
				served,
				otherModels,
				outcome
			});
			return outcome;
		};
		try {
			const served = await identify();
			// ⭐ Step 1, before its first request: a model found loaded is unloaded by its own request.
			if ((await loaded()).includes(o.model)) {
				const unloaded = await send('unload', unloadBody(o.model, text), served, [], (posted) =>
					posted.status >= 200 && posted.status <= 299
						? { kind: 'UNLOAD' }
						: { kind: 'FAILED', parse: 'NOT_ATTEMPTED', reason: `the request to unload ${o.model} was refused: HTTP ${posted.status}${errorOf(posted.text)}` }
				);
				if (unloaded.kind === 'FAILED') throw new Refused(unloaded.reason);
			}
			const scores: Record<string, number> = {};
			for (const r of requests) {
				const others = await waitGone();
				if (left() <= 0) throw new Refused(`the review’s requests passed ${seconds(bounds.reviewMs)} together, before request ${r.key} was sent`);
				const outcome = await send(r.key, decisionModelBody(o.model, material, r, text), served, others, (posted) => scoreOf(r.key, posted));
				if (outcome.kind !== 'SCORED') throw new Refused(outcome.kind === 'FAILED' ? outcome.reason : `request ${r.key} holds no score`);
				scores[r.key] = outcome.score;
			}
			return { scores, exchanges };
		} catch (e) {
			if (e instanceof Refused) return { refusal: e.message, exchanges };
			throw e;
		}
	};
}
