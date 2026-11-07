// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D51 (`REG-D-146`; design §12.3) — A LOCAL STUB OF THE DECISION MODEL'S SERVER, AND NO MODEL:
// the four routes the product's client reads, on 127.0.0.1 at a port the system picks, answering as Ollama 0.40.15 answers them
// (`docs.ollama.com/api/systemone.md`, `d46-facts-verbatim.md` V14, V15, V19).
//   · `GET /api/version` — `{"version"}`; `GET /api/tags` — the served models, each with its `digest`;
//   · `GET /api/ps` — the loaded models: this one while it is loaded, and any `others`;
//   · `POST /v1/systemone` — every question it was asked scored, by default as a function of the body's bytes (`stubScore`), so a
//     score names the exact request it answers; `keep_alive` 0 unloads the model after the request, as Ollama does, and the
//     unload is seen by `/api/ps` only after `lingerPolls` more reads of it, the window step 1's poll waits through.
// Every request is kept, its bytes as they arrived (`requests`), so a test can say what was sent, in what order, how often.
// ⭑ FOR Z2b TOO: the static source, the materializer and the fingerprint read D54's records by the sha256 of each body; a record
// made through the product's client against this stub is a record of exactly the bytes the product sends.
// ⛔ A TEST DOUBLE, NAMED SO (`.testing.ts`): nothing in production imports it, and it reaches no host but the loopback.
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** The model the screen measured, and the digest its `/api/tags` entry began with (`733585a9ebb6`), extended to a full 64. */
export const STUB_MODEL = 'pplx-decider:27b-q4_K_M';
export const STUB_DIGEST = `733585a9ebb6${'0123456789abcdef'.repeat(3)}0123`;
export const STUB_VERSION = '0.40.15';

/** One request the stub received, as it arrived. */
export interface StubRequest {
	readonly method: string;
	readonly path: string;
	readonly contentType: string | undefined;
	/** The body's bytes, read as UTF-8. */
	readonly body: string;
	/** For `GET /api/ps`: whether the answer listed this model. */
	readonly listed?: boolean;
}

/** How the stub answers one `POST /v1/systemone`: a JSON body (status 200 unless given), a raw body, or no answer at all. */
export type StubAnswer =
	| { readonly status?: number; readonly json: unknown; readonly delayMs?: number }
	| { readonly status: number; readonly raw: string; readonly delayMs?: number }
	| { readonly hang: true };

export interface StubOptions {
	readonly model?: string;
	readonly digest?: string;
	/** The server's version — or a function of the reads made so far, so a test can update the server mid-run. */
	readonly version?: string | (() => string);
	/** Whether `/api/tags` lists the model at all (default true). */
	readonly serves?: boolean;
	/** Whether the model is loaded before any request — until an unload request (`"state": "unload"`) is answered. */
	readonly loadedAtStart?: boolean;
	/** How many more `/api/ps` reads list the model after each `keep_alive` 0 request (default 0). */
	readonly lingerPolls?: number;
	/** The model never leaves `/api/ps`. */
	readonly neverUnloads?: boolean;
	/** Other models `/api/ps` lists, every read. */
	readonly others?: readonly string[];
	/** How a question request is answered; absent, every question asked is scored (`scoredAnswer`). */
	readonly answer?: (r: { readonly body: string; readonly parsed: Record<string, unknown>; readonly n: number }) => StubAnswer;
}

export interface DecisionModelStub {
	readonly url: string;
	readonly requests: StubRequest[];
	close(): Promise<void>;
}

/** The stub's default score of a question: a function of the request's exact bytes, in [0, 1). */
export function stubScore(body: string): number {
	return createHash('sha256').update(body, 'utf8').digest().readUInt32BE(0) / 2 ** 32;
}

/** An answer scoring every question the body asks, as `/v1/systemone` answers a `noul` question. */
export function scoredAnswer(
	body: string,
	parsed: Record<string, unknown>,
	score: (key: string) => number = () => stubScore(body)
): { readonly json: unknown } {
	const questions = (parsed.questions ?? {}) as Record<string, unknown>;
	return {
		json: {
			model: parsed.model,
			answers: Object.fromEntries(Object.keys(questions).map((k) => [k, { type: 'noul', noul: score(k) }])),
			usage: { input_tokens: 4096, output_tokens: 1 }
		}
	};
}

export async function startDecisionModelStub(o: StubOptions = {}): Promise<DecisionModelStub> {
	const model = o.model ?? STUB_MODEL;
	const requests: StubRequest[] = [];
	/** `/api/ps` reads that will still list the model; Infinity while it is loaded with no request to unload it. */
	let lingering = o.loadedAtStart ? Number.POSITIVE_INFINITY : 0;
	let n = 0;
	const send = (res: ServerResponse, status: number, body: string) => {
		res.statusCode = status;
		res.setHeader('content-type', 'application/json; charset=utf-8');
		res.end(body);
	};
	const server = createServer((req: IncomingMessage, res: ServerResponse) => {
		const chunks: Buffer[] = [];
		req.on('data', (c: Buffer) => chunks.push(c));
		req.on('end', () => {
			const body = Buffer.concat(chunks).toString('utf8');
			const path = req.url ?? '';
			const seen = { method: req.method ?? '', path, contentType: req.headers['content-type'], body };
			if (req.method === 'GET' && path === '/api/version') {
				requests.push(seen);
				return send(res, 200, JSON.stringify({ version: typeof o.version === 'function' ? o.version() : (o.version ?? STUB_VERSION) }));
			}
			if (req.method === 'GET' && path === '/api/tags') {
				requests.push(seen);
				const models = o.serves === false ? [] : [{ name: model, model, digest: o.digest ?? STUB_DIGEST, size: 1 }];
				return send(res, 200, JSON.stringify({ models: [...models, { name: 'other:1b', model: 'other:1b', digest: 'f'.repeat(64) }] }));
			}
			if (req.method === 'GET' && path === '/api/ps') {
				const listed = o.neverUnloads === true || lingering > 0;
				if (lingering > 0) lingering -= 1;
				requests.push({ ...seen, listed });
				const loaded = [...(listed ? [model] : []), ...(o.others ?? [])];
				return send(res, 200, JSON.stringify({ models: loaded.map((name) => ({ name, model: name, expires_at: '2026-11-06T12:00:00-05:00' })) }));
			}
			if (req.method === 'POST' && path === '/v1/systemone') {
				requests.push(seen);
				let parsed: Record<string, unknown>;
				try {
					parsed = JSON.parse(body) as Record<string, unknown>;
				} catch {
					return send(res, 400, JSON.stringify({ error: 'invalid JSON' }));
				}
				const done = () => {
					// keep_alive 0: unloaded after the request, seen by `/api/ps` after `lingerPolls` more reads.
					lingering = o.lingerPolls ?? 0;
				};
				if (parsed.state === 'unload') {
					done();
					return send(res, 200, JSON.stringify(scoredAnswer(body, parsed).json));
				}
				n += 1;
				const answer: StubAnswer = o.answer ? o.answer({ body, parsed, n }) : scoredAnswer(body, parsed);
				if ('hang' in answer) return; // never answers: the client must cut it
				const reply = () => {
					done();
					if ('raw' in answer) send(res, answer.status, answer.raw);
					else send(res, answer.status ?? 200, JSON.stringify(answer.json));
				};
				if (answer.delayMs) setTimeout(reply, answer.delayMs);
				else reply();
				return;
			}
			requests.push(seen);
			send(res, 404, JSON.stringify({ error: `no route ${req.method} ${path}` }));
		});
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	return {
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		requests,
		close: () =>
			new Promise<void>((r) => {
				server.closeAllConnections();
				server.close(() => r());
			})
	};
}
