// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D54 (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.6, revision 9) —
// THE STATIC SOURCE: the potential indications the gate and the qualification read, from D54's committed records and never from a
// model (`docs/tracking/reviewer-qualification/decision-model/v13.ndjson`, `probes.ndjson`; the records script's format,
// `decision-model-records.ts`).
//   · Each request's body is the product's own (`decisionModelBody`, with the records' model and the review's material); its score
//     is the record whose `bodySha256` is that body's sha256 — the same bytes the product's client sent when the record was made.
//   · ⛔ A request with no record refuses the review: never a fallback score, never 0.00 (D54: the gate runs no model).
//   · ⛔ A body two records score differently is refused too: the records contradict themselves.
//   · ⭐⭐ Z2b phase 1b — D54 restated (`REG-D-146`; ~~to be filed in d48 as~~ filed in d48 as `REG-F-611`) — A BODY RECORDED REFUSED (HTTP 413, a request
//     the server refused as too large, recorded as returned) answers the review with the client's own refusal words, made by the
//     client's own formatter from the recorded status and answer (`refusedRequestReason`), never a copy of them. ⛔ A body recorded
//     both scored and refused, or refused twice with two answers, is a contradiction; a refused request is admitted only with
//     status 413 and its body hash (`refusedRequestOf`, which the records script reads its own file by too).
//   · ⛔ Each file's `IDENTITY` line is read first; the files must agree on model, digest and server version, and that identity must
//     be the one the product is held to (`DECISION_MODEL_RECORDS_IDENTITY`) — records of any other identity are refused, never read.
// ⭐ The source reports that identity (`DecisionModelRecords.identity`), which the RUN line records beside the candidate.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	DECISION_MODEL_RECORDS_IDENTITY,
	identityWords,
	type DecisionModelRecordsIdentity
} from '../../apps/rph-demo/src/lib/server/assurance/decision-model-identity.js';
import { refusedRequestReason } from '../../apps/rph-demo/src/lib/server/assurance/decision-model-client.js';
import { decisionModelBody } from '../../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import type { IndicationsSource } from '../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';

/** Where D54's records are committed, and the files the gate reads, in their order. */
export const RECORDS_FOLDER = 'docs/tracking/reviewer-qualification/decision-model/';
export const RECORDS_FILES = ['v13.ndjson', 'probes.ndjson'] as const;

/** The records, read: their one identity, each body's score, and the bodies two records score differently. */
export interface DecisionModelRecords {
	readonly identity: DecisionModelRecordsIdentity;
	readonly scores: ReadonlyMap<string, number>;
	readonly contradicted: ReadonlySet<string>;
	/** ⭐ Z2b phase 1b — each body recorded refused by the server (HTTP 413), with the server's answer as it arrived. */
	readonly refused: ReadonlyMap<string, RecordedRefusal>;
	/** ⭐ Z2b phase 1b — the bodies a refusal contradicts: recorded scored too, or refused again with another answer. */
	readonly refusalContradicted: ReadonlySet<string>;
	/** ⭐ Z3 — D53 — the entries the records hold, by their kind and id (`CASE W12-CLEAN`, `PROBE T-NO-FENCE`). */
	readonly entries: ReadonlySet<string>;
	/**
	 * ⭐⭐ Z3 phase 2 — D53 (the lead's reading, for d49) — THE ENTRIES WHOSE LINE RECORDS THEIR REVIEW REFUSED, each with its
	 * words: the server's refusal of a request (`refusedRequest`, in the client's own words, `refusedRequestReason`), or a refusal
	 * before any request (`refused`). Such an entry is held, but holds no review: the validator refuses it before any reviewer call.
	 */
	readonly refusedEntries: ReadonlyMap<string, string>;
}
export type RecordsRead = DecisionModelRecords | { readonly refusal: string };

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const SHA = /^[0-9a-f]{64}$/;

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package Z2b phase 1b — D54 restated (`REG-D-146`; ~~to be filed in d48 as~~ filed in d48 as `REG-F-611`) — A REQUEST THE SERVER
 * REFUSED, AS A RECORD LINE HOLDS IT (`decision-model-records.ts`): its key, kind and body sha256, the status — 413, the one refusal
 * recorded — and the server's answer as it arrived, from which the client's formatter makes the refusal's words. ⭑ A line holds at
 * most one: the client stops a review at its first refusal, and the questions answered before it stand beside it.
 */
export interface RecordedRefusal {
	readonly key: string;
	readonly kind: 'check' | 'statement';
	readonly bodySha256: string;
	readonly status: 413;
	readonly response: string;
}
/** What a malformed refused request is refused with, after the file's name and line. */
export const MALFORMED_REFUSED_REQUEST = 'holds a refused request that is no 413 with its key, kind, body hash and the server’s answer (D54)';

/**
 * ⭐ Z2b phase 1b — A RECORD LINE'S REFUSED REQUEST, READ: none (`undefined`), the request, or `null` where it is malformed — a status
 * other than 413, no body hash, no key, another kind, an answer that is no text; or beside a refusal before any request, or a key the
 * line also scores. ⛔ Both readers of the format refuse a malformed one: the static source, and the records script reading its own
 * file to resume.
 */
export function refusedRequestOf(entry: { readonly refusedRequest?: unknown; readonly refused?: unknown; readonly questions?: unknown }): RecordedRefusal | null | undefined {
	if (!('refusedRequest' in entry)) return undefined;
	const r = entry.refusedRequest as Partial<Record<keyof RecordedRefusal, unknown>> | null;
	if (typeof r !== 'object' || r === null || Array.isArray(r) || 'refused' in entry) return null;
	if (typeof r.key !== 'string' || r.key === '' || (r.kind !== 'check' && r.kind !== 'statement')) return null;
	if (typeof r.bodySha256 !== 'string' || !SHA.test(r.bodySha256) || r.status !== 413 || typeof r.response !== 'string') return null;
	const answered = Array.isArray(entry.questions) ? (entry.questions as { key?: unknown }[]).map((q) => q.key) : [];
	if (answered.includes(r.key)) return null;
	return { key: r.key, kind: r.kind, bodySha256: r.bodySha256, status: 413, response: r.response };
}

/** One file's lines, parsed: its identity and every question of its entries — or why it cannot be read. */
function parsed(
	name: string,
	text: string
): { identity: DecisionModelRecordsIdentity; questions: { sha: string; score: number }[]; refused: RecordedRefusal[]; entries: string[]; refusedEntries: [string, string][] } | string {
	const lines = text.split('\n').filter((l) => l.trim() !== '');
	let head: Record<string, unknown>;
	try {
		head = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
	} catch {
		return `${name} does not begin with its IDENTITY line (D54)`;
	}
	if (head.kind !== 'IDENTITY' || typeof head.model !== 'string' || typeof head.digest !== 'string' || typeof head.serverVersion !== 'string')
		return `${name} does not begin with its IDENTITY line (D54)`;
	const questions: { sha: string; score: number }[] = [];
	const refused: RecordedRefusal[] = [];
	const entries: string[] = [];
	const refusedEntries: [string, string][] = [];
	for (const [n, line] of lines.slice(1).entries()) {
		let entry: { kind?: unknown; id?: unknown; questions?: unknown; refusedRequest?: unknown; refused?: unknown };
		try {
			entry = JSON.parse(line) as typeof entry;
		} catch {
			return `${name} line ${n + 2} is no JSON`;
		}
		if (!Array.isArray(entry.questions)) return `${name} line ${n + 2} holds no questions`;
		if ((entry.kind === 'CASE' || entry.kind === 'PROBE') && typeof entry.id === 'string') entries.push(`${entry.kind} ${entry.id}`);
		for (const q of entry.questions as { bodySha256?: unknown; score?: unknown }[]) {
			if (typeof q.bodySha256 !== 'string' || !SHA.test(q.bodySha256) || typeof q.score !== 'number' || !Number.isFinite(q.score) || q.score < 0 || q.score > 1)
				return `${name} line ${n + 2} holds a question that is no body hash and probability`;
			questions.push({ sha: q.bodySha256, score: q.score });
		}
		// ⭐ Z2b phase 1b — and the request the server refused, where the line holds one.
		const refusal = refusedRequestOf(entry);
		if (refusal === null) return `${name} line ${n + 2} ${MALFORMED_REFUSED_REQUEST}`;
		if (refusal !== undefined) refused.push(refusal);
		// ⭐ Z3 phase 2 — and the entry's review refused, where its line records it so, in the refusal's own words.
		const why = refusal !== undefined ? refusedRequestReason(refusal.key, refusal.status, refusal.response) : typeof entry.refused === 'string' ? entry.refused : undefined;
		if (why !== undefined && (entry.kind === 'CASE' || entry.kind === 'PROBE') && typeof entry.id === 'string') refusedEntries.push([`${entry.kind} ${entry.id}`, why]);
	}
	return { identity: { model: head.model, digest: head.digest, serverVersion: head.serverVersion }, questions, refused, entries, refusedEntries };
}

const sameIdentity = (a: DecisionModelRecordsIdentity, b: DecisionModelRecordsIdentity): boolean =>
	a.model === b.model && a.digest === b.digest && a.serverVersion === b.serverVersion;

/**
 * ⭐ READ RECORDS FILES (their text, by name) — held to `expected`, the identity the product is held to. Every file's identity line
 * is read before any of its scores, and records of another identity are refused, never read.
 */
export function readDecisionModelRecords(
	files: readonly { readonly name: string; readonly text: string }[],
	expected: DecisionModelRecordsIdentity = DECISION_MODEL_RECORDS_IDENTITY
): RecordsRead {
	if (files.length === 0) return { refusal: 'no decision-model records were found (D54)' };
	const read = files.map((f) => ({ name: f.name, file: parsed(f.name, f.text) }));
	const bad = read.find((r) => typeof r.file === 'string');
	if (bad) return { refusal: bad.file as string };
	const ok = read as { name: string; file: Exclude<ReturnType<typeof parsed>, string> }[];
	const first = ok[0]!.file.identity;
	if (!ok.every((r) => sameIdentity(r.file.identity, first)))
		return { refusal: `the records disagree on their identity: ${ok.map((r) => `${r.name} ${identityWords(r.file.identity)}`).join('; ')}` };
	if (!sameIdentity(first, expected))
		return {
			refusal: `the records were made on ${identityWords(first)}, not the identity the product is held to: ${identityWords(expected)} (D51; REG-F-608)`
		};
	const scores = new Map<string, number>();
	const contradicted = new Set<string>();
	const entries = new Set(ok.flatMap((r) => r.file.entries));
	const refusedEntries = new Map(ok.flatMap((r) => r.file.refusedEntries));
	for (const r of ok)
		for (const q of r.file.questions) {
			const had = scores.get(q.sha);
			if (had !== undefined && had !== q.score) contradicted.add(q.sha);
			else scores.set(q.sha, q.score);
		}
	// ⭐ Z2b phase 1b — each body recorded refused; one also scored, or refused again with another answer, contradicts itself.
	const refused = new Map<string, RecordedRefusal>();
	const refusalContradicted = new Set<string>();
	for (const r of ok)
		for (const q of r.file.refused) {
			const had = refused.get(q.bodySha256);
			if (scores.has(q.bodySha256) || (had !== undefined && (had.status !== q.status || had.response !== q.response)))
				refusalContradicted.add(q.bodySha256);
			else refused.set(q.bodySha256, q);
		}
	return { identity: first, scores, contradicted, refused, refusalContradicted, entries, refusedEntries };
}

/**
 * ⭐⭐ THE STATIC SOURCE over records read: each request answered by the record of its body — or the review refused, naming why.
 */
export function recordedIndications(records: RecordsRead): IndicationsSource {
	return async (requests, material) => {
		if ('refusal' in records) return { refusal: records.refusal };
		const scores: Record<string, number> = {};
		for (const r of requests) {
			const sha = sha256(decisionModelBody(records.identity.model, material, r));
			if (records.contradicted.has(sha))
				return { refusal: `the records hold two scores for request ${r.key}’s body ${sha.slice(0, 12)}…: they contradict themselves` };
			// ⭐⭐ Z2b phase 1b — D54 restated — A BODY RECORDED REFUSED: the review refused as the client refused it, in the client's own
			// words from the recorded status and answer, at the request it refused — the questions after it never asked, as by the client.
			if (records.refusalContradicted.has(sha))
				return { refusal: `the records hold a refusal and another answer for request ${r.key}’s body ${sha.slice(0, 12)}…: they contradict themselves` };
			const refusal = records.refused.get(sha);
			if (refusal !== undefined) return { refusal: refusedRequestReason(r.key, refusal.status, refusal.response) };
			const score = records.scores.get(sha);
			if (score === undefined) return { refusal: `the records hold no score for request ${r.key} (its body ${sha.slice(0, 12)}…)` };
			scores[r.key] = score;
		}
		return { scores };
	};
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — D53 — THE RECORDS AND THE FILES THEY WERE READ FROM: what a D53 run reads, and the sha256 of
 * each file, which the live re-derivation's evidence names (a record changed since, and the case is re-derived again).
 */
export interface RecordsOnFile {
	readonly read: RecordsRead;
	readonly files: readonly { readonly name: string; readonly sha256: string }[];
}

/** ⭐ Z3 — D53 — the committed records under `root`, with their files' sha256 (`RecordsOnFile`). */
export function committedRecordsOnFile(root: URL): RecordsOnFile {
	const files = RECORDS_FILES.flatMap((f) => {
		const path = fileURLToPath(new URL(`${RECORDS_FOLDER}${f}`, root));
		return existsSync(path) ? [{ name: f, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }] : [];
	});
	return { read: committedRecords(root), files };
}

/** ⭐ The committed records under `root` (a `file:` URL ending in `/`): both files, read and held to the product's identity. */
export function committedRecords(root: URL): RecordsRead {
	const files: { name: string; text: string }[] = [];
	for (const f of RECORDS_FILES) {
		const path = fileURLToPath(new URL(`${RECORDS_FOLDER}${f}`, root));
		if (!existsSync(path)) return { refusal: `the committed decision-model records are absent: ${RECORDS_FOLDER}${f} (D54)` };
		files.push({ name: `${RECORDS_FOLDER}${f}`, text: readFileSync(path, 'utf8') });
	}
	return readDecisionModelRecords(files);
}

/** The repository the scripts run in: two folders up from this file. */
const REPO_ROOT = new URL('../../', import.meta.url);
let committed: RecordsRead | undefined;

/**
 * ⭐⭐ THE COMMITTED RECORDS' SOURCE — what the fingerprint's probes and case prompts, the re-scoring and the qualification CLI read in
 * place of the placeholder (Z1's departure 8). ⚠ Not the negative control's dry run, whose crafted case is in no record
 * (`../phase7/negative-control.ts`). Read once a process, on its first question, so loading a script reads nothing.
 */
export const COMMITTED_INDICATIONS: IndicationsSource = async (requests, material) =>
	recordedIndications((committed ??= committedRecords(REPO_ROOT)))(requests, material);

/** The committed records' identity, for the RUN line — or why the records cannot be read. */
export function committedRecordsIdentity(): DecisionModelRecordsIdentity | { readonly refusal: string } {
	const r = (committed ??= committedRecords(REPO_ROOT));
	return 'refusal' in r ? { refusal: r.refusal } : r.identity;
}
