// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — D47 AND D53'S REFUSALS BEFORE A PAID CALL (`REG-D-145`, `REG-D-146`; design §11.7 D47 and
// §12.5 D53's Prechecks; roadmap §9b.5b, Z3 predicted red 3, and "D53 — the re-measurement", Step 1).
//   · D47 — the runner writes each call's devin session export to a configured folder outside the repository, named by run id,
//     case, repetition and role, its sha256 in the log; the driver refuses to start without the folder. The committed record's
//     shape is unchanged.
//   · D53 — before a devin run: the SELECTION in force names the run's candidate (devin / `swe-2-max`); D54's records hold every
//     current case, 97 of 97 (and the static source holds them to the product's identity); the decision model is configured, for
//     the LIVE RE-DERIVATION: before a case's first paid call its requests are asked live through the product's client, and every
//     score must equal the records' exactly — a difference, or the client's refusal, stops the run before that call. A case is
//     re-derived once in D53, not before every repetition: its evidence is kept beside the exports, outside the repository, with
//     its sha256 in the log.
// ⭑ PREDICTED REDS, WRITTEN FIRST, each against doubles: a devin run starts with none of these, and its calls keep no export.
// ⛔ No devin and no model: devin is its exec seam; the decision model is Z2a's stub server; the records are made here, each
//   score the stub's own for its body (`stubScore`), as the product's client would have read it.
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DECISION_MODEL_RECORDS_IDENTITY } from '../apps/rph-demo/src/lib/server/assurance/decision-model-identity.js';
import { decisionModelBody } from '../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import { startDecisionModelStub, stubScore, type DecisionModelStub } from '../apps/rph-demo/src/lib/server/assurance/decision-model-stub.testing.js';
import { reviewPrompt } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import type { DevinExec } from '../apps/rph-demo/src/lib/server/tools/devin-reviewer.js';
import { clearingJudgement } from '../apps/rph-demo/src/lib/server/assurance/clearing-reviewer.testing.js';
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { committedCaseSet, PRODUCT_SEAMS } from '../scripts/reviewer-qual/fingerprint.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';
import {
	committedRecordsOnFile,
	readDecisionModelRecords,
	RECORDS_FOLDER,
	type RecordsOnFile
} from '../scripts/reviewer-qual/recorded-indications.js';
import { recordProblems, type CallLine } from '../scripts/reviewer-qual/record.js';
import { main, type CliDeps } from '../scripts/reviewer-qual/run.js';
import { NO_PROGRAMS } from './reviewer-qualification-hermetic.js';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const CASES = committedCaseSet(new URL('../', import.meta.url)).cases;
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const CASE = 'W12-CLEAN';

/** ⭐ D54's records for the current set as the stub would score them: each question its body's own `stubScore`. */
async function stubScoredRecords(nudge?: { caseId: string; key: string }): Promise<string> {
	const lines = [JSON.stringify({ kind: 'IDENTITY', set: 'v13', ...DECISION_MODEL_RECORDS_IDENTITY, cold: 'test' })];
	for (const c of CASES) {
		const questions: { key: string; kind: string; bodySha256: string; score: number }[] = [];
		await reviewPrompt(caseReviewInput(c, PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult), async (requests, material) => {
			for (const r of requests) {
				const body = decisionModelBody(DECISION_MODEL_RECORDS_IDENTITY.model, material, r);
				const score = stubScore(body);
				const moved = nudge !== undefined && nudge.caseId === c.id && nudge.key === r.key;
				questions.push({ key: r.key, kind: r.kind, bodySha256: sha256(body), score: moved ? (score + 0.25) % 1 : score });
			}
			return { scores: Object.fromEntries(requests.map((r) => [r.key, 0])) };
		});
		lines.push(JSON.stringify({ kind: 'CASE', id: c.id, questions }));
	}
	return `${lines.join('\n')}\n`;
}
const onFile = (text: string, omit?: string): RecordsOnFile => {
	const kept = omit === undefined ? text : text.split('\n').filter((l) => !l.includes(`"id":"${omit}"`)).join('\n');
	return { read: readDecisionModelRecords([{ name: 'v13.ndjson', text: kept }]), files: [{ name: 'v13.ndjson', sha256: sha256(kept) }] };
};

/**
 * ⭐ Z3 phase 2 — the records with one case's line recording its review refused: by the server at its first request (HTTP
 * 413, as phase 1b's form records it: no questions, the refused request beside them), or before any request (`refused`).
 */
const withRefusal = (text: string, caseId: string, how: 'server' | 'before'): string =>
	text
		.split('\n')
		.map((l) => {
			if (!l.includes(`"id":"${caseId}"`)) return l;
			const line = JSON.parse(l) as { questions: { key: string; kind: string; bodySha256: string }[] };
			const first = line.questions[0]!;
			return how === 'server'
				? JSON.stringify({
						...line,
						questions: [],
						refusedRequest: { key: first.key, kind: first.kind, bodySha256: first.bodySha256, status: 413, response: JSON.stringify({ error: 'text and schema must not exceed 64 KiB' }) }
					})
				: JSON.stringify({ ...line, questions: [], refused: 'This review was not sent: its part is past the room the review allows.' });
		})
		.join('\n');
/** The committed records, as a D53 run reads them. */
const COMMITTED = (): RecordsOnFile => committedRecordsOnFile(new URL('../', import.meta.url));

const dirs: string[] = [];
const scratch = (label: string): string => {
	const d = mkdtempSync(join(tmpdir(), `jpwb-d53-${label}-`));
	dirs.push(d);
	return d;
};
let RECORDS = '';
let NUDGED = '';
let stub: DecisionModelStub;
let laterStub: DecisionModelStub;
beforeAll(async () => {
	vi.stubEnv('PATH', NO_PROGRAMS);
	RECORDS = await stubScoredRecords();
	NUDGED = await stubScoredRecords({ caseId: CASE, key: 'c00' });
	stub = await startDecisionModelStub({ digest: DECISION_MODEL_RECORDS_IDENTITY.digest, version: DECISION_MODEL_RECORDS_IDENTITY.serverVersion });
	laterStub = await startDecisionModelStub({ digest: DECISION_MODEL_RECORDS_IDENTITY.digest, version: '0.40.16' });
}, 120_000);
afterAll(async () => {
	await stub.close();
	await laterStub.close();
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
	vi.unstubAllEnvs();
});
afterEach(() => {
	stub.requests.length = 0;
	laterStub.requests.length = 0;
});

/** The record a D53 run appends to, holding the SELECTION in force. */
function recordWith(selected: string): string {
	const out = join(scratch('record'), 'runs.ndjson');
	writeFileSync(
		out,
		`${JSON.stringify({ kind: 'SELECTION', date: '2026-11-07T00:00:00.000Z', candidate: { transport: 'devin', modelLabel: selected }, ruling: 'REG-D-146', note: 'Selected for the fixture.' })}\n`
	);
	return out;
}

/** devin at its exec seam: the clearing judgement, its export naming swe-2-max — and every call it was asked. */
function devinAnswering() {
	const calls: string[][] = [];
	const exec: DevinExec = async (_file, args) => {
		calls.push([...args]);
		writeFileSync(args[args.indexOf('--export') + 1]!, JSON.stringify({ steps: [{ extra: { generation_model: 'swe-2-max' } }], call: calls.length }));
		return { stdout: clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA) };
	};
	return { calls, exec };
}

interface Ran {
	readonly code: number;
	readonly said: string;
	readonly devinCalls: number;
	readonly out: string;
	readonly exports: string;
}
async function d53(o: {
	readonly selected?: string;
	readonly exports?: string | null;
	readonly records?: RecordsOnFile;
	readonly server?: string | null;
	readonly runId?: string;
	readonly out?: string;
	readonly repetitions?: number;
	/** ⭐ Z3 (the lead's ruling) — D53's re-derivation pass: `--mode rederive`, with neither of the flags only a run reads. */
	readonly mode?: 'rederive';
	/** The cases the run names (`--cases`); `CASE` alone unless given. */
	readonly cases?: readonly string[];
	/** The transport the run names; devin unless given. */
	readonly transport?: string;
	/** Flags appended as given, for a refusal at the usage. */
	readonly extra?: readonly string[];
}): Promise<Ran> {
	const out = o.out ?? recordWith(o.selected ?? 'swe-2-max');
	const exports = o.exports === undefined ? scratch('exports') : (o.exports ?? '');
	vi.stubEnv('JPWB_DEVIN_BIN', undefined);
	vi.stubEnv('JPWB_AGY_BIN', undefined);
	vi.stubEnv('JPWB_DECISION_MODEL_SERVER', o.server === null ? undefined : (o.server ?? stub.url));
	vi.stubEnv('JPWB_DECISION_MODEL', o.server === null ? undefined : DECISION_MODEL_RECORDS_IDENTITY.model);
	const devin = devinAnswering();
	const written: string[] = [];
	const deps: CliDeps = {
		env: process.env,
		resolve: () => 'file:///repo/packages/rph-assurance/src/index.ts',
		write: (s) => written.push(s),
		fingerprint: async () => ({ reviewer: 'a'.repeat(64), scoring: 'b'.repeat(64), caseSet: 'c'.repeat(64) }),
		commit: () => 'e5f9358b'.repeat(5),
		now: () => new Date('2026-11-07T12:00:00.000Z'),
		transportDeps: { devinExec: devin.exec, devinWait: async () => undefined },
		records: () => o.records ?? onFile(RECORDS)
	};
	const argv = [
		'--transport', o.transport ?? 'devin', '--model', 'swe-2-max', '--out', out, '--cases', (o.cases ?? [CASE]).join(','),
		...(o.mode === 'rederive'
			? ['--mode', 'rederive']
			: ['--repetitions', String(o.repetitions ?? 1), '--run-id', o.runId ?? 'qr-2026-11-07-devin-swe-2-max-v13-test']),
		...(o.exports === null ? [] : ['--exports', exports]),
		...(o.extra ?? [])
	];
	const code = await main(argv, deps);
	return { code, said: written.join(''), devinCalls: devin.calls.length, out, exports };
}
const questionsAsked = (s: DecisionModelStub) => s.requests.filter((r) => r.path === '/v1/systemone').length;

describe('⛔ PREDICTED RED 3 (Z3; D47) — each call’s devin session export kept outside the repository, its sha256 in the log', () => {
	it('⛔ the driver refuses to start without the folder: no call, no line', async () => {
		const r = await d53({ exports: null });
		expect(r.code).toBe(2);
		expect(r.said).toContain('REFUSED (D47): a devin run keeps each call’s session export in a folder outside the repository: --exports is required');
		expect([r.devinCalls, readFileSync(r.out, 'utf8').split('\n').filter(Boolean).length]).toEqual([0, 1]);
	});

	it('⛔ and refuses a folder inside the repository — and writes nothing there', async () => {
		// ⛔ MOVED 2026-11-07 (`JAN-EXEC` Phase 7, package Z3): ~~`join(REPO, 'docs', 'exports-here')`~~ — a folder git ignores,
		// removed after. P6X-Z3-M11's first measurement admitted the folder, and its run wrote exports into `docs/`: were the
		// refusal broken, nothing it wrote may be left in the tree.
		const inside = join(REPO, 'node_modules', '.jpwb-d47-inside');
		try {
			const r = await d53({ exports: inside });
			expect(r.code).toBe(2);
			expect(r.said).toContain('REFUSED (D47): --exports names a folder inside the repository');
			expect(r.devinCalls).toBe(0);
			expect(existsSync(inside), 'nothing written inside the repository').toBe(false);
		} finally {
			rmSync(inside, { recursive: true, force: true });
		}
	});

	it('⭐ a configured folder is admitted: each call’s export written there, named by run id, case, repetition, call and role, its sha256 in the log; the record’s shape unchanged', async () => {
		const r = await d53({ repetitions: 2 });
		expect(r.code, r.said).toBe(0);
		const runDir = join(r.exports, 'qr-2026-11-07-devin-swe-2-max-v13-test');
		const files = readdirSync(runDir).sort();
		expect(files).toEqual([`${CASE}.1.1.initial.json`, `${CASE}.2.1.initial.json`]);
		for (const f of files) {
			const text = readFileSync(join(runDir, f), 'utf8');
			expect(text, 'the export as devin wrote it').toContain('"generation_model":"swe-2-max"');
			expect(r.said).toContain(`export qr-2026-11-07-devin-swe-2-max-v13-test/${f} sha256 ${sha256(text)}`);
		}
		const record = readFileSync(r.out, 'utf8');
		expect(recordProblems(record, { tracked: true }), 'the record validates as before').toEqual([]);
		expect(record.split('\n').filter(Boolean).map((l) => (JSON.parse(l) as { kind: string }).kind)).toEqual(['SELECTION', 'RUN', 'CALL', 'CALL']);
		expect(record, 'no export in the record').not.toContain('generation_model');
	});
});

describe('⛔ D53’s refusals before a paid call — each against doubles', () => {
	it('⛔ the SELECTION in force names another candidate: refused before any call', async () => {
		const r = await d53({ selected: 'glm-5-3-flash-high' });
		expect(r.code).toBe(2);
		expect(r.said).toContain('REFUSED (D53): the SELECTION in force names devin / glm-5-3-flash-high, not this run’s devin / swe-2-max');
		expect(r.devinCalls).toBe(0);
	});

	it('⛔ D54’s records absent, or not holding every current case: refused before any call', async () => {
		const absent = await d53({ records: { read: { refusal: 'the committed decision-model records are absent: v13.ndjson (D54)' }, files: [] } });
		expect(absent.code).toBe(2);
		expect(absent.said).toContain('REFUSED (D53): D54’s records cannot be read — the committed decision-model records are absent');
		const short = await d53({ records: onFile(RECORDS, 'P12-RR-07-CUT') });
		expect(short.code).toBe(2);
		expect(short.said).toContain(`REFUSED (D53): D54’s records hold 96 of the ${CASES.length} current cases; none for P12-RR-07-CUT`);
		expect([absent.devinCalls, short.devinCalls]).toEqual([0, 0]);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 phase 2 — D53 (the lead’s reading, for d49) — A CASE WHOSE RECORD HOLDS A REFUSAL IS
	// NOT PRESENT: the validator refuses its review before any reviewer call, so D53 cannot measure it. Phase 1b's form records the
	// server's 413 beside the questions answered before it (`refusedRequest`); a review refused before any request is recorded so too
	// (`refused`). The precheck refuses either, naming the case and its refusal. ⭑ PREDICTED RED, WRITTEN FIRST: Z3 counted every line held.
	it('⛔ PREDICTED RED — Z3 phase 2 — a case whose record holds a refused request is not present: refused before any call, naming the case and its refusal', async () => {
		const server = await d53({ records: onFile(withRefusal(RECORDS, CASE, 'server')) });
		expect(server.code, server.said).toBe(2);
		expect(server.said).toContain(
			`REFUSED (D53): D54’s records hold a refusal, not a review, for 1 of the ${CASES.length} current cases: ${CASE} — request c00 was refused: HTTP 413: text and schema must not exceed 64 KiB. Nothing was run.`
		);
		// ⭑ And a review recorded refused before any request: not present either.
		const before = await d53({ records: onFile(withRefusal(RECORDS, CASE, 'before')) });
		expect(before.code, before.said).toBe(2);
		expect(before.said).toContain(
			`REFUSED (D53): D54’s records hold a refusal, not a review, for 1 of the ${CASES.length} current cases: ${CASE} — This review was not sent: its part is past the room the review allows. Nothing was run.`
		);
		expect([server.devinCalls, before.devinCalls, questionsAsked(stub)]).toEqual([0, 0, 0]);
	});

	// ⭐⭐ Z3 phase 2 — WHAT ONLY THE RECORDS EXERCISE: D53’s precheck over the committed files (`docs/tracking/
	// reviewer-qualification/decision-model/`), stopped at the decision model, which comes after it (no server is set).
	it('⭐ CONTROL — Z3 phase 2 — the committed v13 records hold no refusal (0 of their 97 CASE lines) and every current case: the precheck passes, saying so; ⛔ one case’s line taken out, and it is refused, naming that case', async () => {
		const text = readFileSync(join(REPO, RECORDS_FOLDER, 'v13.ndjson'), 'utf8');
		const lines = text
			.split('\n')
			.filter(Boolean)
			.map((l) => JSON.parse(l) as Record<string, unknown>)
			.filter((l) => l.kind === 'CASE');
		expect([lines.length, lines.filter((l) => 'refusedRequest' in l || 'refused' in l).length], 'CASE lines, and those refused').toEqual([97, 0]);
		const committed = COMMITTED();
		const r = await d53({ records: committed, server: null });
		expect(r.said).toContain(
			`D53 — D54’s records hold ${CASES.length} of the ${CASES.length} current cases, none refused (${committed.files.map((f) => `${f.name} sha256 ${f.sha256}`).join(', ')})`
		);
		expect(r.said, 'past the records, at the decision model').toContain('REFUSED (D53): the live re-derivation asks the decision model, and it is not configured');
		expect(committed.files.map((f) => f.name)).toEqual(['v13.ndjson', 'probes.ndjson']);
		// ⛔ THE CONTROL: the committed v13 file without one case’s line.
		const short = await d53({ records: onFile(text, 'P12-RR-07-CUT') });
		expect(short.code).toBe(2);
		expect(short.said).toContain(`REFUSED (D53): D54’s records hold 96 of the ${CASES.length} current cases; none for P12-RR-07-CUT`);
		expect([r.devinCalls, short.devinCalls]).toEqual([0, 0]);
	});

	it('⛔ the decision model not configured: no live re-derivation is possible, so the run is refused', async () => {
		const r = await d53({ server: null });
		expect(r.code).toBe(2);
		expect(r.said).toContain('REFUSED (D53): the live re-derivation asks the decision model, and it is not configured');
		expect(r.devinCalls).toBe(0);
	});
});

describe('⛔ D53 — THE LIVE RE-DERIVATION before a case’s first paid call, through the product’s client (Z2a’s stub server)', () => {
	it('⭐ re-derived once: every question asked live, every score equal to the records’; the evidence kept outside the repository with its sha256 in the log — and not asked again for the second repetition', async () => {
		const r = await d53({ repetitions: 2 });
		expect(r.code, r.said).toBe(0);
		const asked = questionsAsked(stub);
		expect(asked, 'every question of the case, once').toBeGreaterThan(SEEDED_REASONING_REVIEW_CRITERIA.length);
		expect(r.devinCalls, 'both repetitions called').toBe(2);
		const evidence = join(r.exports, 'rederived', `${CASE}.json`);
		expect(existsSync(evidence)).toBe(true);
		const text = readFileSync(evidence, 'utf8');
		expect(r.said).toContain(`re-derived ${CASE}: ${asked} of ${asked} score(s) equal to the records’ — rederived/${CASE}.json sha256 ${sha256(text)}`);
		const again = await d53({ repetitions: 1, exports: r.exports, out: r.out, runId: 'qr-2026-11-07-devin-swe-2-max-v13-test-2' });
		expect(again.code, again.said).toBe(0);
		expect(questionsAsked(stub), 'a later run of D53 re-derives it no more').toBe(asked);
		expect(again.said).toContain(`re-derived ${CASE} before: rederived/${CASE}.json sha256 ${sha256(text)}`);
	});

	it('⛔ a score that differs from the records’ stops the run before the case’s first call', async () => {
		const r = await d53({ records: onFile(NUDGED) });
		expect(r.code).toBe(2);
		expect(r.said).toContain(`REFUSED (D53): ${CASE}: re-derived live, 1 of`);
		expect(r.said).toContain('differ from the records — c00: recorded');
		expect(r.devinCalls, 'no paid call').toBe(0);
		expect(readFileSync(r.out, 'utf8').split('\n').filter(Boolean)).toHaveLength(1);
	});

	it('⛔ the client’s refusal — a server of another version — stops the run before the case’s first call', async () => {
		const r = await d53({ server: laterStub.url });
		expect(r.code).toBe(2);
		expect(r.said).toContain(`REFUSED (D53): ${CASE}: the live re-derivation was refused — the server is Ollama 0.40.16, not 0.40.15`);
		expect(r.devinCalls).toBe(0);
	});
});

describe('⭑ the calls themselves — one CALL line per call that reached the model', () => {
	it('⭑ each repetition’s call is one CALL line, whatever the re-derivation asked', async () => {
		const r = await d53({ repetitions: 2 });
		const calls = readFileSync(r.out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as CallLine).filter((l) => l.kind === 'CALL');
		expect(calls.map((c) => [c.caseId, c.repetition, c.role])).toEqual([
			[CASE, 1, 'initial'],
			[CASE, 2, 'initial']
		]);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — THE LEAD'S RULING (`z3-p1-rulings.md`): THE RE-DERIVATION AS ITS OWN PASS, BEFORE ANY PAID
// CALL. `run.ts --mode rederive` runs D53's prechecks. It then asks each case's requests live through `rederiving` and writes the
// evidence a paid run reads, with its sha256 in the log. It calls no reviewer, loads no transport, and stops with exit 2 on any
// difference or refusal. The decision model is Z2a's stub server, as above.
// ⭑ PREDICTED RED, WRITTEN FIRST: `--mode` is no flag of the run's, so each pass below is refused at its usage.
describe('⛔ PREDICTED RED (Z3; the lead’s ruling) — D53’s re-derivation pass: every case re-derived, no reviewer called', () => {
	const SECOND = (): string => CASES.find((c) => c.id !== CASE)!.id;

	it('⛔ the pass, past D53’s prechecks: each case of the run re-derived live, its evidence written and its sha256 logged — and no reviewer called, no transport loaded, nothing appended', async () => {
		const r = await d53({ mode: 'rederive', cases: [CASE, SECOND()] });
		expect(r.code, r.said).toBe(0);
		expect(r.devinCalls, 'no reviewer call').toBe(0);
		expect(
			readFileSync(r.out, 'utf8').split('\n').filter(Boolean),
			'the SELECTION alone: no RUN line, which a run writes once its transport is loaded, and no CALL line'
		).toHaveLength(1);
		for (const id of [CASE, SECOND()]) {
			const text = readFileSync(join(r.exports, 'rederived', `${id}.json`), 'utf8');
			expect(r.said).toMatch(
				new RegExp(`re-derived ${id}: (\\d+) of \\1 score\\(s\\) equal to the records’ — rederived/${id}\\.json sha256 ${sha256(text)}`)
			);
		}
		expect(r.said).toContain(
			're-derivation pass: 2 of 2 case(s) re-derived, every score equal to the records’; no reviewer was called, and nothing was appended to the record'
		);
		expect(questionsAsked(stub), 'every question of both cases, asked live').toBeGreaterThan(2 * SEEDED_REASONING_REVIEW_CRITERIA.length);
	});

	it('⛔ a paid run after the pass reads its evidence and asks nothing live', async () => {
		const pass = await d53({ mode: 'rederive' });
		expect(pass.code, pass.said).toBe(0);
		const asked = questionsAsked(stub);
		expect(asked, 'the pass asked them').toBeGreaterThan(0);
		const text = readFileSync(join(pass.exports, 'rederived', `${CASE}.json`), 'utf8');
		const paid = await d53({ exports: pass.exports, out: pass.out });
		expect(paid.code, paid.said).toBe(0);
		expect(questionsAsked(stub), 'nothing asked live by the paid run').toBe(asked);
		expect(paid.said).toContain(`re-derived ${CASE} before: rederived/${CASE}.json sha256 ${sha256(text)}`);
		expect(paid.devinCalls, 'the paid run’s own call').toBe(1);
	});

	it('⛔ a difference stops the pass with exit 2, and no evidence is written for it', async () => {
		const r = await d53({ mode: 'rederive', records: onFile(NUDGED) });
		expect(r.code).toBe(2);
		expect(r.said).toContain(`REFUSED (D53): ${CASE}: re-derived live, 1 of`);
		expect(r.said).toContain(
			`the re-derivation pass stopped at ${CASE}, case 1 of 1: no reviewer was called, and no evidence was written for it`
		);
		expect(existsSync(join(r.exports, 'rederived', `${CASE}.json`)), 'no evidence for a difference').toBe(false);
		expect(r.devinCalls).toBe(0);
	});

	it('⛔ the client’s refusal — a server of another version — stops the pass with exit 2, no evidence written', async () => {
		const r = await d53({ mode: 'rederive', server: laterStub.url });
		expect(r.code).toBe(2);
		expect(r.said).toContain('the server is Ollama 0.40.16, not 0.40.15');
		expect(existsSync(join(r.exports, 'rederived', `${CASE}.json`))).toBe(false);
		expect(r.devinCalls).toBe(0);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — THE LEAD'S STRENGTHENING (`z3-p1-rulings.md`, "The follow-up hand-back"): THE EVIDENCE
	// NAMES THE BODIES IT RE-DERIVED. Each question carries its body's sha256 (the one the records key it by), and a paid run reuses
	// evidence only where the keys, the bodies and the scores are all equal.
	// ⭑ PREDICTED RED, WRITTEN FIRST: the evidence holds keys and scores alone.
	it('⛔ PREDICTED RED — Z3 (the strengthening) — the evidence names each question’s body, as the records do; another body is not reused, and the case is asked live', async () => {
		const pass = await d53({ mode: 'rederive' });
		expect(pass.code, pass.said).toBe(0);
		const file = join(pass.exports, 'rederived', `${CASE}.json`);
		const evidence = JSON.parse(readFileSync(file, 'utf8')) as { questions: { key: string; bodySha256?: string; score: number }[] };
		const recorded = (
			RECORDS.split('\n')
				.filter(Boolean)
				.map((l) => JSON.parse(l) as { kind: string; id?: string; questions?: { key: string; bodySha256: string }[] })
				.find((l) => l.kind === 'CASE' && l.id === CASE)!.questions ?? []
		).map((q) => [q.key, q.bodySha256]);
		expect(evidence.questions.map((q) => [q.key, q.bodySha256]), 'each question named by the body the records score').toEqual(recorded);
		// The same keys and the same scores, one question's body another.
		const moved = { ...evidence, questions: evidence.questions.map((q, i) => (i === 0 ? { ...q, bodySha256: 'f'.repeat(64) } : q)) };
		writeFileSync(file, `${JSON.stringify(moved, null, '\t')}\n`);
		const asked = questionsAsked(stub);
		const paid = await d53({ exports: pass.exports, out: pass.out });
		expect(paid.code, paid.said).toBe(0);
		expect(questionsAsked(stub) - asked, 'the case asked live again').toBeGreaterThan(0);
		expect(paid.said).not.toContain(`re-derived ${CASE} before: `);
	});

	it('⛔ the pass runs D53’s prechecks first, and its flags are closed', async () => {
		const other = await d53({ mode: 'rederive', selected: 'glm-5-3-flash-high' });
		expect([other.code, other.devinCalls, questionsAsked(stub)]).toEqual([2, 0, 0]);
		expect(other.said).toContain('REFUSED (D53): the SELECTION in force names devin / glm-5-3-flash-high');
		const said = async (o: Parameters<typeof d53>[0]) => (await d53(o)).said;
		expect(await said({ mode: 'rederive', extra: ['--repetitions', '2'] })).toContain(
			'usage: --repetitions is a run’s: --mode rederive calls no reviewer and appends nothing'
		);
		expect(await said({ mode: 'rederive', extra: ['--run-id', 'qr-x'] })).toContain('usage: --run-id is a run’s');
		expect(await said({ mode: 'rederive', transport: 'agy' })).toContain(
			'usage: --mode rederive is D53’s pass before its devin runs: --transport devin'
		);
		expect(await said({ extra: ['--mode', 'twice'] })).toContain('usage: --mode is run or rederive');
	});
});
