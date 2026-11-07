// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D54's RECORDS, MADE (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.6,
// revision 9; roadmap §9b.5b, Z2 records and control 7) — EVERY QUESTION OF CASE SET v13 AND OF THE FINGERPRINT'S PROBES, ASKED OF
// THE DECISION MODEL THROUGH THE PRODUCT'S OWN CLIENT, ON ONE SERVER VERSION. Run outside the gate: free, local, and long.
//
// ⭑ WHAT IT ASKS: each case's or probe's review, built as the product's validator builds it (`reviewPrompt`), its requests sent by
// the product's client (`createDecisionModelClient`) — one cold request per check and per statement (D51). A review refused
// before any request (a probe past a bound of the measured section's room, or past a material's) makes none, and is recorded so.
// ⭑ WHAT IT WRITES (`docs/tracking/reviewer-qualification/decision-model/`), one file a set — `v13.ndjson`, `probes.ndjson` —
// each line one JSON object:
//   · first, `IDENTITY`: the model, its served digest and the server's version, once a file;
//   · then one `CASE` or `PROBE` line an entry: its id, then per question its key, kind, the sha256 of its exact body and its
//     full score as returned (JSON round-trip exact) — the lookup the static source of package Z2b makes, by body;
//   · and, for step 1's two controls (`W12-CSV-RR-08`, `W12-CSV-CLEAN`), a `CONTROL` line: every question asked again, which
//     must equal the first exactly.
// ⛔ ITS STOPS — THE MEASURED CONDITION (`REG-F-608`): another model loaded, before the first request or by any request's record;
// the served digest or the server's version other than the file's, read before each entry and after the last; a review the
// client refuses; a control repeat that differs. A stopped entry writes nothing: the file holds only whole entries.
// ⭑ IT RESUMES: an entry the file holds is not asked again. And before the first request it prints how many it will make, and
// the time they take at 16.3 s a request (the later check's median on Ollama 0.40.15).
//
// usage: bun --conditions=source scripts/reviewer-qual/decision-model-records.ts --server <address> --model <name>
//          --digest <12 or more hexadecimal characters> [--set v13|probes|both]
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReasoningReviewInput } from '@janumipwb/rph-assurance';
import {
	createDecisionModelClient,
	type DecisionModelBounds
} from '../../apps/rph-demo/src/lib/server/assurance/decision-model-client.js';
import {
	reviewPrompt,
	type IndicationExchange,
	type IndicationRequest,
	type IndicationsResult
} from '../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';

/** One review whose questions are asked: a case of the set, or a probe of the fingerprint. */
export interface RecordsEntry {
	readonly kind: 'CASE' | 'PROBE';
	readonly id: string;
	readonly input: ReasoningReviewInput;
}

/** One question of a record line. */
export interface RecordedQuestion {
	readonly key: string;
	readonly kind: 'check' | 'statement';
	readonly bodySha256: string;
	readonly score: number;
}

/** The identity a file's records were made on. */
export interface RecordsIdentity {
	readonly model: string;
	readonly digest: string;
	readonly serverVersion: string;
}

export interface RecordsRun {
	readonly server: string;
	readonly model: string;
	/** The digest the model must be served with: 12 hexadecimal characters or more (`733585a9ebb6`). */
	readonly digest: string;
	/** The file the records go to, and the set it holds (`v13`, `probes`). */
	readonly file: string;
	readonly set: string;
	readonly entries: readonly RecordsEntry[];
	/** The entries asked twice, whose repeat must equal their first asking exactly. */
	readonly controls: readonly string[];
	readonly log: (line: string) => void;
	/** For tests: the client's bounds, shortened. */
	readonly bounds?: Partial<DecisionModelBounds>;
}

/** The later check's median on Ollama 0.40.15 (`d46-facts.md` §7): the time a request is planned at. */
export const SECONDS_A_REQUEST = 16.3;

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** Why a run stopped. */
class Stopped extends Error {}

/** The server's own word on the model: its served digest and the server's version — or why it cannot be had. */
async function identityOf(server: string, model: string): Promise<RecordsIdentity> {
	const get = async (path: string): Promise<Record<string, unknown>> => {
		const res = await fetch(`${server}${path}`, { signal: AbortSignal.timeout(60_000) });
		if (!res.ok) throw new Stopped(`STOPPED: the server answered ${path} with HTTP ${res.status}`);
		return (await res.json()) as Record<string, unknown>;
	};
	const models = (await get('/api/tags')).models;
	const entry = (Array.isArray(models) ? models : []).find((m) => (m as { name?: unknown } | null)?.name === model) as
		| { readonly digest?: unknown }
		| undefined;
	if (entry === undefined || typeof entry.digest !== 'string') throw new Stopped(`STOPPED: the server serves no model named ${model}`);
	return { model, digest: entry.digest, serverVersion: String((await get('/api/version')).version) };
}

/** The models the server holds other than `model` (`/api/ps`, each by its `name`, or else its `model`). */
async function othersLoaded(server: string, model: string): Promise<string[]> {
	const res = await fetch(`${server}/api/ps`, { signal: AbortSignal.timeout(60_000) });
	const models = ((await res.json()) as { models?: unknown }).models;
	return (Array.isArray(models) ? models : [])
		.map((m) => {
			const r = (m ?? {}) as { readonly name?: unknown; readonly model?: unknown };
			return String(r.name || r.model);
		})
		.filter((m) => m !== model);
}

/** The requests a review makes, asked of no model: none where it is refused before any request. */
export async function plannedRequests(input: ReasoningReviewInput): Promise<readonly IndicationRequest[]> {
	let asked: readonly IndicationRequest[] = [];
	try {
		await reviewPrompt(input, async (requests) => {
			asked = requests;
			return { scores: Object.fromEntries(requests.map((r) => [r.key, 0])) };
		});
	} catch {
		return [];
	}
	return asked;
}

/** One review's questions asked through the product's client: its record line's questions, its refusal, or why it stopped. */
async function ask(
	run: RecordsRun,
	identity: RecordsIdentity,
	entry: RecordsEntry
): Promise<{ readonly questions: readonly RecordedQuestion[] } | { readonly refused: string }> {
	const client = createDecisionModelClient({
		server: run.server,
		model: run.model,
		identity: { digest: identity.digest, serverVersion: identity.serverVersion },
		...(run.bounds ? { bounds: run.bounds } : {})
	});
	let kinds = new Map<string, 'check' | 'statement'>();
	let result: IndicationsResult | undefined;
	try {
		await reviewPrompt(entry.input, async (requests, material) => {
			kinds = new Map(requests.map((r) => [r.key, r.kind]));
			result = await client(requests, material);
			return result;
		});
	} catch (e) {
		// ⭑ Refused before any request — the room, the material, the fence: the review the product would refuse, recorded so.
		if (result === undefined) return { refused: e instanceof Error ? e.message : String(e) };
		if ('refusal' in result) throw new Stopped(`STOPPED: ${entry.id}: the client refused its review: ${result.refusal}`);
		throw e;
	}
	const made = (result?.exchanges ?? []) as readonly IndicationExchange[];
	const crowded = made.find((x) => x.otherModels.length > 0);
	if (crowded) throw new Stopped(`STOPPED: ${entry.id}: another model was loaded when ${crowded.key} was sent (${crowded.otherModels.join(', ')})`);
	return {
		questions: made.flatMap((x): RecordedQuestion[] =>
			x.outcome.kind === 'SCORED' ? [{ key: x.key, kind: kinds.get(x.key)!, bodySha256: sha256(x.body), score: x.outcome.score }] : []
		)
	};
}

/** Whether two askings of one review are exactly equal: the same questions, the same bodies, the same scores. */
const sameAsking = (a: readonly RecordedQuestion[], b: readonly RecordedQuestion[]): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * ⭐⭐ MAKE THE RECORDS: every entry the file does not hold asked, each written whole, the controls asked twice. Stops — writing
 * nothing for the entry it stopped at — on another model loaded, an identity other than the file's, a refusal, a repeat that differs.
 */
export async function makeRecords(run: RecordsRun): Promise<{ readonly made: number; readonly requests: number; readonly stopped?: string }> {
	let made = 0;
	let requests = 0;
	try {
		if (!/^[0-9a-f]{12,64}$/.test(run.digest)) throw new Stopped(`STOPPED: ${JSON.stringify(run.digest)} is no digest of 12 to 64 hexadecimal characters`);
		const identity = await identityOf(run.server, run.model);
		if (!identity.digest.startsWith(run.digest))
			throw new Stopped(`STOPPED: ${run.model} is served with digest ${identity.digest.slice(0, 12)}, not ${run.digest}`);
		const crowd = await othersLoaded(run.server, run.model);
		if (crowd.length > 0) throw new Stopped(`STOPPED: another model is loaded (${crowd.join(', ')}): the records are made with none`);
		// ⭑ What the file holds already: its identity, and the entries and controls it has.
		const held = new Map<string, readonly RecordedQuestion[]>();
		const controlled = new Set<string>();
		if (existsSync(run.file)) {
			const lines = readFileSync(run.file, 'utf8').split('\n').filter((l) => l.trim() !== '');
			const head = JSON.parse(lines[0] ?? '{}') as Partial<RecordsIdentity> & { kind?: string };
			if (head.kind !== 'IDENTITY' || head.model !== identity.model || head.digest !== identity.digest || head.serverVersion !== identity.serverVersion)
				throw new Stopped(
					`STOPPED: ${run.file} was made on ${head.model} ${String(head.digest).slice(0, 12)} on Ollama ${head.serverVersion}; the server serves ` +
						`${identity.model} ${identity.digest.slice(0, 12)} on Ollama ${identity.serverVersion} (REG-F-608)`
				);
			for (const line of lines.slice(1)) {
				const r = JSON.parse(line) as { kind: string; id: string; questions?: readonly RecordedQuestion[] };
				if (r.kind === 'CONTROL') controlled.add(r.id);
				else held.set(r.id, r.questions ?? []);
			}
		}
		// ⭑ The plan, before the first request.
		let planned = 0;
		for (const e of run.entries) {
			const n = (await plannedRequests(e.input)).length;
			if (!held.has(e.id)) planned += n;
			if (run.controls.includes(e.id) && !controlled.has(e.id)) planned += n;
		}
		const hours = (planned * SECONDS_A_REQUEST) / 3600;
		run.log(
			`${run.set}: ${run.model} ${identity.digest.slice(0, 12)} on Ollama ${identity.serverVersion}; ${run.entries.length} entries, ` +
				`${held.size} already recorded; ${planned} requests to make, about ${hours.toFixed(1)} h at ${SECONDS_A_REQUEST} s a request`
		);
		if (!existsSync(run.file)) {
			mkdirSync(dirname(run.file), { recursive: true });
			writeFileSync(
				run.file,
				`${JSON.stringify({ kind: 'IDENTITY', set: run.set, ...identity, cold: 'one question a request; before each, /api/ps read until the model is absent; keep_alive 0 (D51)' })}\n`,
				'utf8'
			);
		}
		const same = async (when: string) => {
			const now = await identityOf(run.server, run.model);
			if (now.digest !== identity.digest || now.serverVersion !== identity.serverVersion)
				throw new Stopped(
					`STOPPED: ${when}, the server serves ${now.model} ${now.digest.slice(0, 12)} on Ollama ${now.serverVersion}, not the file's ` +
						`${identity.digest.slice(0, 12)} on Ollama ${identity.serverVersion} (REG-F-608)`
				);
		};
		for (const e of run.entries) {
			const wanted = !held.has(e.id);
			const repeat = run.controls.includes(e.id) && !controlled.has(e.id);
			if (!wanted && !repeat) continue;
			await same(`before ${e.id}`);
			let first = held.get(e.id);
			if (wanted) {
				const asked = await ask(run, identity, e);
				const line = 'refused' in asked ? { kind: e.kind, id: e.id, questions: [], refused: asked.refused } : { kind: e.kind, id: e.id, questions: asked.questions };
				appendFileSync(run.file, `${JSON.stringify(line)}\n`, 'utf8');
				first = line.questions;
				made += 1;
				requests += line.questions.length;
				run.log(`${e.kind} ${e.id}: ${line.questions.length} question(s)${'refused' in line ? ' — refused before any request' : ''}`);
			}
			if (repeat) {
				const again = await ask(run, identity, e);
				const questions = 'refused' in again ? [] : again.questions;
				requests += questions.length;
				if (!sameAsking(first ?? [], questions)) throw new Stopped(`STOPPED: ${e.id}: the control's repeat differs from its first asking`);
				appendFileSync(run.file, `${JSON.stringify({ kind: 'CONTROL', id: e.id, questions })}\n`, 'utf8');
				run.log(`CONTROL ${e.id}: ${questions.length} question(s) asked again, exactly equal`);
			}
		}
		await same('after the last entry');
		run.log(`${run.set}: done — ${made} entries made, ${requests} requests`);
		return { made, requests };
	} catch (e) {
		if (!(e instanceof Stopped)) throw e;
		run.log(e.message);
		return { made, requests, stopped: e.message };
	}
}

/** `--name value` arguments, by name. */
function argsOf(argv: readonly string[]): Map<string, string> {
	const out = new Map<string, string>();
	for (let i = 0; i < argv.length; i += 1) if (argv[i]!.startsWith('--')) out.set(argv[i]!.slice(2), argv[i + 1] ?? '');
	return out;
}

/** The CLI: v13's cases and the fingerprint's probes, into the committed record folder. */
export async function main(argv: readonly string[]): Promise<number> {
	const a = argsOf(argv);
	const server = a.get('server')?.replace(/\/+$/, '');
	const model = a.get('model');
	const digest = a.get('digest');
	const set = a.get('set') ?? 'both';
	if (!server || !model || !digest || !['v13', 'probes', 'both'].includes(set)) {
		console.error('usage: decision-model-records.ts --server <address> --model <name> --digest <hex> [--set v13|probes|both] (no default model: REG-D-052)');
		return 2;
	}
	const root = new URL('../../', import.meta.url);
	const { committedCaseSet, PRODUCT_SEAMS } = await import('./fingerprint.js');
	const { caseReviewInput } = await import('./materialize.js');
	const { FINGERPRINT_PROBES } = await import('./probes.js');
	const folder = new URL('docs/tracking/reviewer-qualification/decision-model/', root);
	const caseSet = committedCaseSet(root);
	const sets: RecordsRun[] = [];
	if (set !== 'probes')
		sets.push({
			server,
			model,
			digest,
			set: `v${caseSet.caseSetVersion}`,
			file: fileURLToPath(new URL(`v${caseSet.caseSetVersion}.ndjson`, folder)),
			entries: caseSet.cases.map((c) => ({ kind: 'CASE' as const, id: c.id, input: caseReviewInput(c, PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult) })),
			controls: ['W12-CSV-RR-08', 'W12-CSV-CLEAN'],
			log: (line) => console.log(line)
		});
	if (set !== 'v13')
		sets.push({
			server,
			model,
			digest,
			set: 'probes',
			file: fileURLToPath(new URL('probes.ndjson', folder)),
			entries: FINGERPRINT_PROBES.map((p) => ({
				kind: 'PROBE' as const,
				id: p.id,
				input: p.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult, PRODUCT_SEAMS.declaredPolicies)
			})),
			controls: [],
			log: (line) => console.log(line)
		});
	for (const s of sets) {
		const out = await makeRecords(s);
		if (out.stopped) return 1;
	}
	return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
