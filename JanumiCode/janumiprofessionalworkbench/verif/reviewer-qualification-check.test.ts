// ⭐ `JAN-CRITREAD` J2-3 — `reviewer:qual:check`, THE STATIC CHECK THAT RUNS NO MODEL (DESIGN-what-the-tests-prove.md
// §5.6; ROADMAP J2-3 + J2-4; `REG-D-072` D11; `REG-D-074`).
//
// Every record not SUPERSEDED is in its population, whatever fingerprint it carries. Three limbs, each shown RED on its
// own fixture here and GREEN on a covered, reproduced, fully escalated one:
//   1. COVERAGE — every current case, by today's prompt hashes, MEASURED in a RUN or a RESCORED record carrying today's
//      fingerprint; a scoring-only move discharged by RESCORED with no model call; a move in the probe set owing an
//      ACKNOWLEDGED line besides; a run that crosses the server's day boundary counting for nothing (`REG-F-429`).
//   2. REPRODUCTION — records carrying today's fingerprint, and the sources of today's RESCORED lines, must recompute to
//      the prompts they recorded and re-score to the outcomes recorded at run time; a SUPERSEDED line is accepted only
//      for a record that really fails this, and never while that record has an un-cited failure.
//   3. ESCALATION — every material failure (§5.1) in every record, intermediate and superseded-by-fingerprint alike,
//      cited by an ESCALATION line naming a finding the register holds. It stays red across a fingerprint move.
//      ⭐ Since `JAN-CRITREAD` J2-6 (`REG-D-080`) the material classes are the VERDICT-level ones: which criterion a
//      planted case faults is ATTRIBUTION, reported and never escalated (the J2-6 limb below).
// And the cross-file references `REG-D-074` left to J2-3: run ids across files, a RESCORED line's source, an
// ESCALATION's run, case and finding, a SUPERSEDED line's record and finding, an ACKNOWLEDGED line's cases.
//
// ⚠ NO MODEL IS CALLED. Records are made by the real runner over a stub transport that answers each case as told, and
// are re-scored through the real path (`rescore.ts`). The committed record is NOT asserted here: `bun run test` must
// not redden on what the gate's tail reports — the check itself, run by `gate:tail`, is that limb.
// ⛔ AND NONE IS REACHABLE: in process PATH names an empty directory, and the CLI runs hermetic
// (`reviewer-qualification-hermetic.ts`); its record directories are git repositories of their own, in temp.
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
	CASE_SET_V1_FILE,
	CASE_SET_V2_FILE,
	CURRENT_CASE_SET_FILE,
	CURRENT_ORACLES_FILE,
	ORACLES_V1_FILE,
	ORACLES_V2_FILE,
	type CaseSet,
	type OracleSet,
	type QualificationCase
} from '../scripts/reviewer-qual/cases.js';
import {
	checkQualification,
	registerFindings,
	type CheckInputs,
	type CheckReport
} from '../scripts/reviewer-qual/check-core.js';
import { reviewerFingerprintOf, sha256 } from '../scripts/reviewer-qual/digest.js';
import { reviewerFingerprint, type ReviewerFingerprint } from '../scripts/reviewer-qual/fingerprint.js';
import {
	SCORED_DISPOSITIONS,
	serializeLine,
	type CallLine,
	type CandidateIdentity,
	type RecordLine,
	type RunLine,
	type ServedFacts
} from '../scripts/reviewer-qual/record.js';
import { rescoreEvaluation, rescoredLines } from '../scripts/reviewer-qual/rescore.js';
import { runQualification, type RunFingerprint } from '../scripts/reviewer-qual/runner.js';
import type { TransportReply } from '../scripts/reviewer-qual/transports.js';
import { BUN, GIT, hermeticEnv, NO_PROGRAMS } from './reviewer-qualification-hermetic.js';

const REPO = fileURLToPath(new URL('../', import.meta.url))
	.replace(/\\/g, '/')
	.replace(/\/$/, '');
// ⚠ `JAN-CRITREAD` J2-5 — THE LIMBS ARE DRIVEN OVER CASE SET VERSION ONE, A FIXED FIXTURE: the core is handed the set it
// calls current (`SUBSET` below), so these ids are the fixture's, and version one — history the committed record
// measured — never moves under them. The CLI reads the CURRENT set (`cases.ts`), and its tests at the end use it; so
// does the J2-7 limb, which checks a record of versions one and two against it.
// ⚠ `JAN-CRITREAD` J2-7 — VERSION TWO IS NOW A FIXED FIXTURE TOO: the J2-5 limb checks a record of version one against
// version two, the set that was current when it was written, and still is its subject; history never moves under it.
const CASES = (JSON.parse(readFileSync(`${REPO}/${CASE_SET_V1_FILE}`, 'utf8')) as CaseSet).cases;
const ORACLES = (JSON.parse(readFileSync(`${REPO}/${ORACLES_V1_FILE}`, 'utf8')) as OracleSet).oracles;
const V2_CASES = (JSON.parse(readFileSync(`${REPO}/${CASE_SET_V2_FILE}`, 'utf8')) as CaseSet).cases;
const V2_ORACLES = JSON.parse(readFileSync(`${REPO}/${ORACLES_V2_FILE}`, 'utf8')) as OracleSet;
const CURRENT_SET = JSON.parse(readFileSync(`${REPO}/${CURRENT_CASE_SET_FILE}`, 'utf8')) as CaseSet;
const CURRENT_ORACLES = JSON.parse(readFileSync(`${REPO}/${CURRENT_ORACLES_FILE}`, 'utf8')) as OracleSet;
const CURRENT_CASES = CURRENT_SET.cases;
/**
 * ⭐ `JAN-CRITREAD` J2-6 — every oracle version on file, as the CLI hands them to the check: a run's own version says
 * which of its cases outside today's set it planted, so the attribution counts those out aloud (`REG-D-080`).
 * ⭐ `JAN-CRITREAD` J2-7 — version two's among them, as the CLI reads it from disk beside version one's and today's.
 */
const ORACLE_SETS: readonly OracleSet[] = [
	JSON.parse(readFileSync(`${REPO}/${ORACLES_V1_FILE}`, 'utf8')) as OracleSet,
	V2_ORACLES,
	CURRENT_ORACLES
];
/** Every oracle any set holds: a case id two hold carries the same standing in each (the cases test holds that). */
const ORACLE = new Map([...ORACLES, ...V2_ORACLES.oracles, ...CURRENT_ORACLES.oracles].map((o) => [o.caseId, o]));
/** The current case set most limbs are driven over: a clean case, a renamed copy of it, a planted defect. */
const SUBSET: readonly QualificationCase[] = CASES.filter((c) => ['G-CLEAN', 'G-CLEAN-R1', 'G-RR-04'].includes(c.id));
/** Findings the register holds — each a real entry (`register-citations.test.ts` resolves every id named here). */
const FINDINGS: ReadonlySet<string> = new Set(['REG-F-427', 'REG-F-428', 'REG-F-429']);
/** A finding id no entry defines — the register-citations gate's own synthetic fixture id. */
const UNFILED = 'REG-F-998';
const HEX = (c: string) => c.repeat(64);

const AGY: CandidateIdentity = {
	transport: 'agy',
	agentId: 'agy',
	provider: 'google',
	modelLabel: 'fixture-model',
	servedModelDigest: null,
	servedTemplateSha256: null,
	servedModelfileSha256: null,
	templateInjectsDate: null,
	serverVersion: null,
	serverUtcOffset: null,
	options: {},
	bounds: { wallClockMs: 240_000, promptChars: 28_000, printTimeout: '3m' },
	argv: ['--print', '<prompt>', '--print-timeout', '3m', '--model', 'fixture-model']
};
const OLLAMA: CandidateIdentity = {
	...AGY,
	transport: 'ollama',
	agentId: 'ollama',
	provider: 'ollama',
	modelLabel: 'gpt-oss:20b',
	servedModelDigest: HEX('1'),
	servedTemplateSha256: HEX('2'),
	servedModelfileSha256: HEX('3'),
	templateInjectsDate: true,
	serverVersion: '0.34.2',
	serverUtcOffset: '-04:00',
	options: { temperature: 0, seed: 42, num_ctx: 131072 },
	bounds: { wallClockMs: 240_000, promptChars: 28_000, printTimeout: null },
	argv: null
};

let FP: ReviewerFingerprint;
let CURRENT: RunFingerprint;
/** Today's fingerprint over the CURRENT case set — the same reviewer; its case prompts and case-set digest differ. */
let FP_NOW: ReviewerFingerprint;
/** `JAN-CRITREAD` J2-7 — today's fingerprint over version two, the fixed fixture of the J2-5 limb. */
let FP_V2: ReviewerFingerprint;
/** Which case a prompt belongs to — by its hash, initial or repair — in version one, version two or the current set. */
let CASE_OF: Map<string, string>;
beforeAll(async () => {
	// ⛔ No program can be found from this process: the validator's default print is `agyPrint`.
	vi.stubEnv('PATH', NO_PROGRAMS);
	FP = await reviewerFingerprint(CASES);
	FP_NOW = await reviewerFingerprint(CURRENT_CASES);
	FP_V2 = await reviewerFingerprint(V2_CASES);
	CURRENT = { reviewer: FP.reviewer, scoring: FP.scoring, caseSet: FP.caseSet };
	CASE_OF = new Map(
		[...FP.casePrompts, ...FP_V2.casePrompts, ...FP_NOW.casePrompts].flatMap(([id, p]) => [
			[p.initial, id] as const,
			[p.repair, id] as const
		])
	);
}, 60_000);
afterAll(() => {
	vi.unstubAllEnvs();
});

/** A reply faulting exactly `faulted`, as a reviewer would write it. */
const judgement = (faulted: readonly string[]): string =>
	JSON.stringify({
		findings: SEEDED_REASONING_REVIEW_CRITERIA.map((k) => ({
			criterionId: k.id,
			failed: faulted.includes(k.id),
			statement: faulted.includes(k.id) ? 'present' : 'absent',
			severity: faulted.includes(k.id) ? 'BLOCKING' : 'INFORMATIONAL'
		})),
		recommendation: faulted.length ? 'REJECTED' : 'SATISFIED'
	});
/** What each case's oracle expects — a reviewer that gets every case right. */
const asOracle = (caseId: string): string => judgement(ORACLE.get(caseId)!.faulted);

/** A record made by the REAL runner over a stub transport that answers as `reply` says. */
async function recorded(o: {
	readonly runId: string;
	readonly date?: string;
	readonly cases?: readonly QualificationCase[];
	readonly fingerprint?: RunFingerprint;
	readonly candidate?: CandidateIdentity;
	readonly repetitions?: number;
	readonly reply?: (caseId: string, n: number) => string | TransportReply['returned'] | Error;
	readonly served?: (n: number) => ServedFacts | null;
	/** The versions a RUN line records — version one's unless the run is over the current set. */
	readonly versions?: { readonly caseSet: number; readonly oracles: number };
}): Promise<RecordLine[]> {
	let n = 0;
	const { TransportFailure } = await import('../scripts/reviewer-qual/transports.js');
	return runQualification({
		runId: o.runId,
		date: o.date ?? '2026-09-24T12:00:00.000Z',
		commit: 'e5f9358b'.repeat(5),
		fingerprint: o.fingerprint ?? CURRENT,
		cases: o.cases ?? SUBSET,
		caseSetVersion: o.versions?.caseSet ?? 1,
		oracleVersion: o.versions?.oracles ?? 1,
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		transport: {
			name: o.candidate?.transport ?? 'agy',
			identify: async () => o.candidate ?? AGY,
			call: async (prompt) => {
				const caseId = CASE_OF.get(sha256(prompt));
				if (!caseId) throw new Error('a prompt no case sends');
				const k = n++;
				const answer = (o.reply ?? asOracle)(caseId, k);
				if (answer instanceof Error) throw new TransportFailure('TIMEOUT', `cut at 240000 ms (${answer.message})`);
				return { returned: answer, served: o.served?.(k) ?? null };
			}
		},
		repetitions: o.repetitions ?? 1,
		env: {}
	});
}
const text = (lines: readonly RecordLine[]): string => lines.map(serializeLine).join('');
const file = (lines: readonly RecordLine[], name = 'runs.ndjson') => ({ name, text: text(lines) });
const check = (
	files: CheckInputs['files'],
	over: Partial<Omit<CheckInputs, 'files'>> = {}
): Promise<CheckReport> =>
	checkQualification({
		files,
		current: FP,
		cases: SUBSET,
		oracles: ORACLES,
		oracleSets: ORACLE_SETS,
		findings: FINDINGS,
		struck: new Set(),
		rescore: (run, c, calls, digest) => rescoreEvaluation(run, c, calls, digest),
		...over
	});
const limb = (r: CheckReport, which: string): string =>
	r.problems
		.filter((p) => p.limb === which)
		.map((p) => p.message)
		.join('\n');
const escalate = (runId: string, caseIds: string[], finding = 'REG-F-427'): RecordLine => ({
	kind: 'ESCALATION',
	runId,
	caseIds,
	finding,
	note: 'Filed for the fixture.'
});
const supersede = (record: string, finding = 'REG-F-429'): RecordLine => ({
	kind: 'SUPERSEDED',
	date: '2026-09-25T09:00:00.000Z',
	record,
	finding,
	note: 'Does not reproduce.'
});
/** Rewrite the CALL lines of one case. */
const tamper = (lines: readonly RecordLine[], caseId: string, f: (c: CallLine) => CallLine): RecordLine[] =>
	lines.map((l) => (l.kind === 'CALL' && l.caseId === caseId ? f(l) : l));
/** A fingerprint moved in one component, with today's in the others. */
const moved = (component: 'probes' | 'scoring'): RunFingerprint => {
	const components = { ...FP.components, [component]: HEX(component === 'probes' ? 'f' : 'e') };
	return { reviewer: reviewerFingerprintOf(components), scoring: components.scoring, caseSet: FP.caseSet };
};

describe('JAN-CRITREAD J2-3 — the check, GREEN on a covered, reproduced, fully escalated record', () => {
	it('⭐ CONTROL — a run under today’s fingerprint, answering every case as its oracle expects, is green', async () => {
		const r = await check([file(await recorded({ runId: 'qr-good-1' }))]);
		expect(r.problems).toEqual([]);
	});
});

describe('JAN-CRITREAD J2-3 — limb 1, COVERAGE', () => {
	it('⛔ an empty record covers nothing — every current case is named', async () => {
		const r = await check([]);
		expect(limb(r, 'COVERAGE')).toContain('3 of 3 current case(s) are not MEASURED under today’s reviewer fingerprint');
		for (const id of ['G-CLEAN', 'G-CLEAN-R1', 'G-RR-04']) expect(limb(r, 'COVERAGE')).toContain(id);
	});

	it('⛔ a run under an EARLIER fingerprint covers nothing today — and says a RESCORED record would discharge a scoring-only move', async () => {
		const r = await check([file(await recorded({ runId: 'qr-old-1', fingerprint: moved('scoring') }))]);
		expect(limb(r, 'COVERAGE')).toContain('3 of 3 current case(s) are not MEASURED');
		expect(limb(r, 'COVERAGE')).toContain('same prompts under an earlier fingerprint in qr-old-1');
	});

	it('⛔ a case whose prompt today differs from the one recorded is not covered by that run', async () => {
		const lines = tamper(await recorded({ runId: 'qr-prompt-1' }), 'G-RR-04', (c) => ({ ...c, promptSha256: HEX('d') }));
		const r = await check([file(lines)]);
		expect(limb(r, 'COVERAGE')).toContain('1 of 3 current case(s) are not MEASURED');
		expect(limb(r, 'COVERAGE')).toContain('G-RR-04');
	});

	it('⭐ a transport failure counts as MEASURED — it is covered, and escalated as a Boundedness failure', async () => {
		const lines = await recorded({
			runId: 'qr-timeout-1',
			reply: (id) => (id === 'G-CLEAN-R1' ? new Error('the bound') : asOracle(id))
		});
		const r = await check([file(lines)]);
		expect(limb(r, 'COVERAGE')).toBe('');
		expect(limb(r, 'ESCALATION')).toContain('G-CLEAN-R1 — BOUNDEDNESS');
	});

	it('⛔ ONE SERVER-CLOCK DAY (REG-F-429) — an ollama run whose calls straddle the server’s midnight counts for nothing; within one day it covers', async () => {
		const clocks = ['Thu, 24 Sep 2026 03:58:00 GMT', 'Thu, 24 Sep 2026 03:59:30 GMT', 'Thu, 24 Sep 2026 03:59:50 GMT'];
		const served = (list: readonly string[]) => (n: number) => ({ templateSha256: HEX('2'), serverClock: list[n]! });
		// ⚠ Since J2-3 the RUNNER stops such a run itself, before recording the call that crosses (the runner test's
		// limb). The check still discards one written otherwise — an older runner's, or a hand-made one: so the record is
		// made within one day, and its last call is then moved past the server's midnight.
		const crossing = tamper(await recorded({ runId: 'qr-ollama-1', candidate: OLLAMA, served: served(clocks) }), 'G-RR-04', (c) => ({
			...c,
			served: c.served && { ...c.served, serverClock: 'Thu, 24 Sep 2026 04:01:00 GMT' }
		}));
		const r = await check([file(crossing)]);
		expect(limb(r, 'COVERAGE')).toContain('3 of 3 current case(s) are not MEASURED');
		expect(limb(r, 'COVERAGE')).toContain(
			'run qr-ollama-1 counts for nothing: its calls fall on server-clock days 2026-09-23 and 2026-09-24'
		);
		// The control: the same run two hours later, all on 2026-09-24 at UTC−4.
		const sameDay = ['Thu, 24 Sep 2026 06:00:00 GMT', 'Thu, 24 Sep 2026 06:01:00 GMT', 'Thu, 24 Sep 2026 06:02:00 GMT'];
		const within = await recorded({ runId: 'qr-ollama-2', candidate: OLLAMA, served: served(sameDay) });
		expect((await check([file(within)])).problems).toEqual([]);
	});
});

describe('JAN-CRITREAD J2-3 — limb 2, REPRODUCTION, and the SUPERSEDED line', () => {
	/** A run under today's fingerprint whose G-RR-04 outcome is not what today's path scores — RR-01 recorded unjudged. */
	const nonReproducing = async (runId: string) =>
		tamper(await recorded({ runId }), 'G-RR-04', (c) => ({
			...c,
			scored: c.scored && {
				...c.scored,
				criteria: c.scored.criteria.map(([k, o]) => [k, k.startsWith('RR-01') ? 'UNABLE_TO_DETERMINE' : o] as const)
			}
		}));

	it('⛔ a record under today’s fingerprint that does not re-score to its run-time outcome is red, naming the case', async () => {
		const r = await check([file(await nonReproducing('qr-repro-1'))]);
		expect(limb(r, 'REPRODUCTION')).toContain('run qr-repro-1: G-RR-04#1 — re-scored through today’s path it is');
		expect(limb(r, 'ESCALATION'), 'still REJECTED with RR-04 faulted: no material failure').toBe('');
	});

	it('⛔ a record under today’s fingerprint whose recorded prompt no longer recomputes is red — a change the fingerprint missed', async () => {
		const lines = tamper(await recorded({ runId: 'qr-repro-2' }), 'G-CLEAN', (c) => ({ ...c, promptSha256: HEX('d') }));
		const r = await check([file(lines)]);
		expect(limb(r, 'REPRODUCTION')).toContain(
			'run qr-repro-2: G-CLEAN#1 initial — the prompt it recorded is not the one today’s reviewer sends'
		);
	});

	it('⭐ a SUPERSEDED line naming a record that really fails reproduction strikes it — and the struck record stops counting for coverage', async () => {
		const bad = await nonReproducing('qr-repro-3');
		const struck = await check([file([...bad, supersede('qr-repro-3')])]);
		expect(limb(struck, 'REPRODUCTION')).toBe('');
		expect(limb(struck, 'COVERAGE'), 'struck, it covers nothing').toContain('3 of 3 current case(s) are not MEASURED');
		const good = await recorded({ runId: 'qr-repro-4' });
		expect((await check([file([...bad, supersede('qr-repro-3'), ...good])])).problems).toEqual([]);
	});

	it('⛔ a SUPERSEDED line naming a record that REPRODUCES is refused', async () => {
		const r = await check([file([...(await recorded({ runId: 'qr-fine-1' })), supersede('qr-fine-1')])]);
		expect(limb(r, 'REPRODUCTION')).toContain(
			'SUPERSEDED names qr-fine-1, which reproduces — refused: a record is struck only when it really fails reproduction'
		);
	});

	it('⛔ a SUPERSEDED line is refused while the record it names has an un-cited material failure', async () => {
		const lines = tamper(await nonReproducing('qr-repro-5'), 'G-CLEAN', (c) => ({
			...c,
			scored: c.scored && { ...c.scored, disposition: 'REJECTED' }
		}));
		const r = await check([file([...lines, supersede('qr-repro-5')])]);
		expect(limb(r, 'REPRODUCTION')).toContain(
			'SUPERSEDED names qr-repro-5, which still has an un-cited material failure — refused until it is escalated'
		);
		// G-CLEAN recorded REJECTED is two failures: its own, and its renamed copy's verdict now differing from it.
		const half = await check([file([...lines, escalate('qr-repro-5', ['G-CLEAN']), supersede('qr-repro-5')])]);
		expect(limb(half, 'REPRODUCTION'), 'one of two cited: still refused').toContain('which still has an un-cited');
		const cited = await check([
			file([...lines, escalate('qr-repro-5', ['G-CLEAN', 'G-CLEAN-R1']), supersede('qr-repro-5')])
		]);
		expect(limb(cited, 'REPRODUCTION'), 'escalated, the strike is accepted').toBe('');
	});
});

describe('JAN-CRITREAD J2-3 — RESCORED and ACKNOWLEDGED: a move owes a model call only for what changed', () => {
	const stamp = (rescoreId: string) => ({
		rescoreId,
		date: '2026-09-25T09:00:00.000Z',
		commit: 'a'.repeat(40),
		reviewer: FP.reviewer,
		scoring: FP.scoring,
		caseSet: FP.caseSet
	});
	const restamp = async (lines: readonly RecordLine[], rescoreId: string) =>
		rescoredLines(
			lines.find((l): l is RunLine => l.kind === 'RUN')!,
			lines.filter((l): l is CallLine => l.kind === 'CALL'),
			SUBSET,
			stamp(rescoreId)
		);

	it('⭐ a SCORING-ONLY move is discharged by RESCORED lines — re-derived from the recorded spans, with no model call', async () => {
		const old = await recorded({ runId: 'qr-sc-1', fingerprint: moved('scoring') });
		expect(limb(await check([file(old)]), 'COVERAGE')).toContain('3 of 3');
		const rescored = await restamp(old, 'rs-sc-1');
		expect(rescored).toHaveLength(3);
		expect((await check([file([...old, ...rescored])])).problems).toEqual([]);
	});

	it('⛔ a RESCORED line that does not re-score to what it records is red', async () => {
		const old = await recorded({ runId: 'qr-sc-2', fingerprint: moved('scoring') });
		const rescored = (await restamp(old, 'rs-sc-2')).map((l) =>
			l.caseId === 'G-CLEAN' ? { ...l, scored: { ...l.scored, disposition: 'INCONCLUSIVE' as const } } : l
		);
		const r = await check([file([...old, ...rescored])]);
		expect(limb(r, 'REPRODUCTION')).toContain('RESCORED rs-sc-2: G-CLEAN#1 — re-scored through today’s path it is');
	});

	it('⛔ a RESCORED line re-stamping an evaluation whose prompt has changed is refused — that case owes a model call', async () => {
		const old = tamper(await recorded({ runId: 'qr-sc-3', fingerprint: moved('scoring') }), 'G-RR-04', (c) => ({
			...c,
			promptSha256: HEX('d')
		}));
		const r = await check([file([...old, ...(await restamp(old, 'rs-sc-3'))])]);
		expect(limb(r, 'REPRODUCTION')).toContain(
			'RESCORED rs-sc-3: G-RR-04#1 — re-stamps an evaluation whose prompt has changed since run qr-sc-3'
		);
		expect(limb(r, 'COVERAGE')).toContain('1 of 3 current case(s) are not MEASURED');
	});

	it('⛔ a move in the PROBE SET owes an ACKNOWLEDGED line naming the new fingerprint, besides the re-stamp', async () => {
		const old = await recorded({ runId: 'qr-pr-1', fingerprint: moved('probes') });
		const rescored = await restamp(old, 'rs-pr-1');
		const owed = await check([file([...old, ...rescored])]);
		expect(limb(owed, 'COVERAGE')).toContain(`an ACKNOWLEDGED line naming ${FP.reviewer} is owed`);
		const acknowledged: RecordLine = {
			kind: 'ACKNOWLEDGED',
			date: '2026-09-25T09:00:00.000Z',
			reviewerFingerprint: FP.reviewer,
			reason: 'The move is confined to the process-result arm, which no case in version one exercises.'
		};
		expect((await check([file([...old, ...rescored, acknowledged])])).problems).toEqual([]);
	});

	const acknowledging = (): RecordLine => ({
		kind: 'ACKNOWLEDGED',
		date: '2026-09-25T09:00:00.000Z',
		reviewerFingerprint: FP.reviewer,
		reason: 'The move is confined to the process-result arm, which no case in version one exercises.'
	});

	it('⛔ the ACKNOWLEDGED line is owed WHATEVER RUNS EXIST under the new fingerprint — a one-case run does not waive it, nor a full re-run (§5.6 limb 1)', async () => {
		// Re-running cases that never exercised the change says nothing about it; the line is what makes someone say so.
		const old = await recorded({ runId: 'qr-pr-2', fingerprint: moved('probes') });
		const rescored = await restamp(old, 'rs-pr-2');
		const oneCase = await recorded({ runId: 'qr-pr-3', cases: SUBSET.filter((c) => c.id === 'G-CLEAN') });
		const owed = `an ACKNOWLEDGED line naming ${FP.reviewer} is owed`;
		expect(limb(await check([file([...old, ...rescored, ...oneCase])]), 'COVERAGE'), 're-stamped, and one case re-run').toContain(owed);
		const full = await recorded({ runId: 'qr-pr-4' });
		const rerun = await check([file([...old, ...full])]);
		expect(limb(rerun, 'COVERAGE'), 'every case re-run, nothing re-stamped').toContain(owed);
		expect(limb(rerun, 'COVERAGE'), 'every case is measured — only the line is owed').not.toContain('not MEASURED');
		expect((await check([file([...old, ...full, acknowledging()])])).problems, 'discharged by the line').toEqual([]);
	});

	it('⭐ CONTROLS — a move that DID reach a case prompt, re-run under the new fingerprint, owes no line; nor does a scoring-only move', async () => {
		// The earlier run recorded G-RR-04's prompt as it was before the move: the move shows in a case prompt, and the
		// re-run under today's fingerprint measured it.
		const reached = tamper(await recorded({ runId: 'qr-pr-5', fingerprint: moved('probes') }), 'G-RR-04', (c) => ({
			...c,
			promptSha256: HEX('d')
		}));
		const full = await recorded({ runId: 'qr-pr-6' });
		expect((await check([file([...reached, ...full])])).problems).toEqual([]);
		const scoringOnly = await recorded({ runId: 'qr-sc-4', fingerprint: moved('scoring') });
		expect((await check([file([...scoringOnly, ...(await recorded({ runId: 'qr-sc-5' }))])])).problems).toEqual([]);
	});

	it('⛔ a record stamped with today’s fingerprint under ANOTHER scoring digest is refused and counts for nothing — a forgery under it is not waved through', async () => {
		// The review's attack: a planted miss rewritten as caught, stamped (F, X). F hashes S, so nothing this tree
		// records carries F with any digest but S — and under (F, X) limb 2 would never re-score it.
		const forged = tamper(
			await recorded({
				runId: 'qr-forged-1',
				fingerprint: { reviewer: FP.reviewer, scoring: HEX('e'), caseSet: FP.caseSet },
				reply: (id) => (id === 'G-RR-04' ? judgement([]) : asOracle(id))
			}),
			'G-RR-04',
			(c) => ({ ...c, scored: c.scored && { ...c.scored, disposition: 'REJECTED' as const, criteria: c.scored.criteria.map(([k, o]) => [k, k.startsWith('RR-04') ? 'NOT_MET' : o] as const) } })
		);
		const r = await check([file(forged)]);
		expect(limb(r, 'RECORD')).toContain(
			`RUN qr-forged-1 carries today’s reviewer fingerprint ${FP.reviewer} but scoring digest ${HEX('e')}, not today’s ${FP.scoring}`
		);
		expect(limb(r, 'COVERAGE'), 'it covers nothing').toContain('3 of 3 current case(s) are not MEASURED');
	});
});

describe('JAN-CRITREAD J2-3 — limb 3, ESCALATION', () => {
	// ⚠ `JAN-CRITREAD` J2-6 — the miss planted here faults NOTHING, so the verdict is SATISFIED: the WRONG verdict, which
	// stays material under `REG-D-080`. Only its class's name moved, with the ruling: a planted defect NOT REJECTED.
	const plantedMissed = (runId: string, fingerprint?: RunFingerprint) =>
		recorded({ runId, ...(fingerprint ? { fingerprint } : {}), reply: (id) => (id === 'G-RR-04' ? judgement([]) : asOracle(id)) });

	it('⛔ a planted defect not faulted is red until an ESCALATION line cites a finding the register holds', async () => {
		const lines = await plantedMissed('qr-esc-1');
		const r = await check([file(lines)]);
		expect(limb(r, 'ESCALATION')).toContain('run qr-esc-1: G-RR-04 — PLANTED_DEFECT_NOT_REJECTED');
		const another = await check([file([...lines, escalate('qr-esc-1', ['G-CLEAN'])])]);
		expect(limb(another, 'ESCALATION'), 'an escalation of ANOTHER case of the run cites nothing here').toContain(
			'run qr-esc-1: G-RR-04 — PLANTED_DEFECT_NOT_REJECTED'
		);
		expect((await check([file([...lines, escalate('qr-esc-1', ['G-RR-04'])])])).problems).toEqual([]);
		const unfiled = await check([file([...lines, escalate('qr-esc-1', ['G-RR-04'], UNFILED)])]);
		expect(limb(unfiled, 'RECORD')).toContain(`ESCALATION cites ${UNFILED}, which the register does not hold`);
		expect(limb(unfiled, 'ESCALATION'), 'an escalation to nothing escalates nothing').toContain('G-RR-04');
	});

	it('⛔ a verdict that changes with the NAME is escalated on the renamed copy', async () => {
		const fault = SEEDED_REASONING_REVIEW_CRITERIA[4]!.id;
		const lines = await recorded({ runId: 'qr-esc-2', reply: (id) => (id === 'G-CLEAN-R1' ? judgement([fault]) : asOracle(id)) });
		const r = await check([file(lines)]);
		expect(limb(r, 'ESCALATION')).toContain('run qr-esc-2: G-CLEAN-R1 — CLEAN_NOT_SATISFIED, VERDICT_CHANGES_WITH_NAME');
	});

	it('⛔ a TRANSITION — the same candidate’s next run gains a malformation — is escalated; a different candidate is not compared', async () => {
		const fenced = (id: string) => `\`\`\`json\n${asOracle(id)}\n\`\`\``;
		const first = await recorded({ runId: 'qr-tr-1', date: '2026-09-24T12:00:00.000Z' });
		const next = await recorded({ runId: 'qr-tr-2', date: '2026-09-25T12:00:00.000Z', reply: fenced });
		const r = await check([file([...first, ...next])]);
		expect(limb(r, 'ESCALATION')).toContain('run qr-tr-2: G-CLEAN — MALFORMATION_GAINED');
		expect(limb(r, 'ESCALATION')).not.toContain('qr-tr-1');
		const other = await recorded({
			runId: 'qr-tr-3',
			date: '2026-09-25T12:00:00.000Z',
			candidate: { ...AGY, modelLabel: 'another-model', argv: [...AGY.argv!.slice(0, 5), 'another-model'] },
			reply: fenced
		});
		expect((await check([file([...first, ...other])])).problems).toEqual([]);
	});

	it('⛔ an UN-CITED failure stays red across a fingerprint move — every record is in the population, whatever it carries', async () => {
		const before = await plantedMissed('qr-move-1', moved('scoring'));
		const after = await recorded({ runId: 'qr-move-2' });
		const acknowledged: RecordLine = {
			kind: 'ACKNOWLEDGED',
			date: '2026-09-25T09:00:00.000Z',
			reviewerFingerprint: FP.reviewer,
			reason: 'Moved deliberately.'
		};
		const r = await check([file([...before, ...after, acknowledged])]);
		expect(limb(r, 'COVERAGE'), 'today is covered by the new run').toBe('');
		expect(limb(r, 'REPRODUCTION')).toBe('');
		expect(limb(r, 'ESCALATION')).toContain('run qr-move-1: G-RR-04 — PLANTED_DEFECT_NOT_REJECTED');
	});

	it('⛔ a STRUCK finding escalates nothing — `### ~~REG-F-NNN~~` is a closed entry, and citing it clears no failure', async () => {
		const lines = await plantedMissed('qr-esc-3');
		const citing = file([...lines, escalate('qr-esc-3', ['G-RR-04'], 'REG-F-105')]);
		const findings = new Set([...FINDINGS, 'REG-F-105']);
		const struck = await check([citing], { findings, struck: new Set(['REG-F-105']) });
		expect(limb(struck, 'RECORD')).toContain('ESCALATION cites REG-F-105, whose register heading is struck');
		expect(limb(struck, 'ESCALATION'), 'the failure stays un-cited').toContain('run qr-esc-3: G-RR-04 — PLANTED_DEFECT_NOT_REJECTED');
		expect((await check([citing], { findings, struck: new Set() })).problems, 'CONTROL: the same finding, open').toEqual([]);
	});

	it('⭐ the register’s headings, read — an entry struck in its heading is closed; one live heading keeps an id open', () => {
		const { findings, struck } = registerFindings(
			[
				'### REG-F-427 — live',
				'### ~~REG-F-105~~ — RULED (REG-D-041).',
				'### ~~REG-F-106 — struck, title and all~~',
				'A line that names REG-F-428 is not a heading.',
				'### ~~REG-F-429~~ — struck once',
				'### REG-F-429 — and live again'
			].join('\n')
		);
		expect([...findings].sort()).toEqual(['REG-F-105', 'REG-F-106', 'REG-F-427', 'REG-F-429']);
		expect([...struck].sort()).toEqual(['REG-F-105', 'REG-F-106']);
	});

	it('⛔ two runs of one candidate on ONE date are compared in record order — the later one’s transition is escalated', async () => {
		const fenced = (id: string) => `\`\`\`json\n${asOracle(id)}\n\`\`\``;
		const first = await recorded({ runId: 'qr-tr-4', date: '2026-09-24T12:00:00.000Z' });
		const next = await recorded({ runId: 'qr-tr-5', date: '2026-09-24T12:00:00.000Z', reply: fenced });
		const r = await check([file([...first, ...next])]);
		expect(limb(r, 'ESCALATION')).toContain('run qr-tr-5: G-CLEAN — MALFORMATION_GAINED');
		expect(limb(r, 'ESCALATION'), 'the earlier is not compared with the later').not.toContain('qr-tr-4');
	});
});

describe('JAN-CRITREAD J2-3 — the cross-file references REG-D-074 left to J2-3', () => {
	it('⛔ each dangling or doubled reference is refused by name', async () => {
		const run = await recorded({ runId: 'qr-ref-1' });
		const cases: readonly [string, readonly { name: string; text: string }[], string][] = [
			['a run id in two files', [file(run, 'a.ndjson'), file(run, 'b.ndjson')], 'b.ndjson:1: RUN qr-ref-1 is declared again'],
			[
				'an ESCALATION of a run nobody declared',
				[file([...run, escalate('qr-nobody', ['G-CLEAN'])])],
				'ESCALATION names qr-nobody, which no RUN, RESCORED or HELD_OUT line declares'
			],
			[
				'an ESCALATION of a case the run did not measure',
				[file([...run, escalate('qr-ref-1', ['W-CLEAN'])])],
				'ESCALATION names case W-CLEAN, which qr-ref-1 did not measure'
			],
			[
				'a RESCORED line of a run nobody declared',
				[
					file([
						...run,
						{
							kind: 'RESCORED',
							rescoreId: 'rs-ref-1',
							sourceRunId: 'qr-nobody',
							date: '2026-09-25T09:00:00.000Z',
							commit: 'a'.repeat(40),
							reviewerFingerprint: FP.reviewer,
							scoringDigest: FP.scoring,
							caseSetDigest: FP.caseSet,
							caseId: 'G-CLEAN',
							repetition: 1,
							scored: (run[1] as CallLine).scored!
						}
					])
				],
				'RESCORED names source run qr-nobody, which no RUN line declares'
			],
			['a SUPERSEDED line of nothing', [file([...run, supersede('qr-nobody')])], 'SUPERSEDED names qr-nobody, which no RUN or RESCORED line declares'],
			['a SUPERSEDED line citing no finding', [file([...run, supersede('qr-ref-1', UNFILED)])], `SUPERSEDED cites ${UNFILED}, which the register does not hold`],
			[
				'an ACKNOWLEDGED line adding a case the set does not hold',
				[
					file([
						...run,
						{ kind: 'ACKNOWLEDGED', date: '2026-09-25T09:00:00.000Z', reviewerFingerprint: FP.reviewer, addedCaseIds: ['G-NEW'] }
					])
				],
				'ACKNOWLEDGED adds G-NEW, which today’s case set does not hold'
			],
			['a record file that is not a record', [file(run), { name: 'broken.ndjson', text: '{"kind":"NOTE"}\n' }], 'broken.ndjson: line 1: kind "NOTE" is not one of']
		];
		for (const [label, files, message] of cases) expect(limb(await check(files), 'RECORD'), label).toContain(message);
	});
});

// ── ⭐ `JAN-CRITREAD` J2-5 — version two became current (`REG-F-449`; `REG-D-078`) ───────────────────────────────────
// ⚠ `JAN-CRITREAD` J2-7: version two is no longer the current set, so this limb is driven over version two AS A FIXED
// FIXTURE — the set it was written about — exactly as the J2-3 limbs are driven over version one. Its assertions are
// unchanged; only the set it hands the core is named for what it is. The same claim for version three is the J2-7 limb
// below, over the current set.
describe('JAN-CRITREAD J2-5 — under case set v2, a record of v1 owes a run over exactly the corrected cases', () => {
	/** The corrected cases — in version two under an id version one does not hold. */
	const CORRECTED = [
		'G2-CLEAN',
		'G2-CLEAN-R1',
		'G2-CLEAN-R2',
		'G2-CLEAN-R3',
		...SEEDED_REASONING_REVIEW_CRITERIA.slice(1).map((k) => `G2-${k.id.slice(0, 5)}`)
	];
	const onVersionTwo = (files: CheckInputs['files'], over: Partial<Omit<CheckInputs, 'files'>> = {}) =>
		check(files, { current: FP_V2, cases: V2_CASES, oracles: V2_ORACLES.oracles, ...over });

	it('⛔ a record of version one under today’s fingerprint — the committed record’s shape — owes a run over exactly the corrected cases, and nothing else: no reproduction failure, no acknowledgement; a run over them turns it green', async () => {
		const v1Ids = new Set(CASES.map((c) => c.id));
		const corrected = V2_CASES.filter((c) => !v1Ids.has(c.id));
		expect(corrected.map((c) => c.id)).toEqual(CORRECTED);
		const v1Record = await recorded({ runId: 'qr-v1-all', cases: CASES });
		const owed = await onVersionTwo([file(v1Record)]);
		expect(owed.problems.map((p) => p.limb), 'coverage alone').toEqual(['COVERAGE']);
		expect(limb(owed, 'COVERAGE')).toBe(
			`12 of 26 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${CORRECTED.join(', ')} — owed: a RUN over them, or RESCORED lines where only the scoring moved (§5.6 limb 1)`
		);
		const remeasured = await recorded({
			runId: 'qr-v2-corrected',
			cases: corrected,
			fingerprint: { ...CURRENT, caseSet: FP_V2.caseSet },
			versions: { caseSet: 2, oracles: 2 }
		});
		expect((await onVersionTwo([file([...v1Record, ...remeasured])])).problems).toEqual([]);
	});

	it('⭐ CONTROL — why a corrected case carries a new id: kept under its version-one id, it reads as a prompt that moved while the fingerprint did not — a non-reproduction a re-run does not discharge', async () => {
		const v1IdOf = (id: string) => (id.startsWith('G2-') ? `G-${id.slice(3)}` : id);
		const sameIds = V2_CASES.map((c) => ({ ...c, id: v1IdOf(c.id) }));
		const current = { ...FP_V2, casePrompts: new Map([...FP_V2.casePrompts].map(([id, p]) => [v1IdOf(id), p])) };
		const v1Record = await recorded({ runId: 'qr-v1-same-ids', cases: CASES });
		const rerun = await recorded({
			runId: 'qr-same-ids-rerun',
			cases: sameIds.filter((c) => c.id.startsWith('G-') && CORRECTED.includes(`G2-${c.id.slice(2)}`)),
			fingerprint: { ...CURRENT, caseSet: FP_V2.caseSet }
		});
		const r = await onVersionTwo([file([...v1Record, ...rerun])], { current, cases: sameIds, oracles: ORACLES });
		expect(limb(r, 'REPRODUCTION')).toContain(
			'run qr-v1-same-ids: G-CLEAN#1 initial — the prompt it recorded is not the one today’s reviewer sends, though the fingerprint did not move'
		);
		expect(limb(r, 'COVERAGE'), 'the re-run covers every case — only the old record fails').toBe('');
	});
});

// ── ⭐ `JAN-CRITREAD` J2-7 — the current case set is version three (`REG-F-453`; `REG-D-081`) ────────────────────────
describe('JAN-CRITREAD J2-7 — under case set v3, the committed record’s shape — runs of v1 and of v2 — owes a run over exactly the twelve changed cases', () => {
	/** The changed cases — in the current set under an id neither version one nor version two holds. Written here. */
	const CHANGED = [
		'G3-CLEAN',
		'G3-CLEAN-R1',
		'G3-CLEAN-R2',
		'G3-CLEAN-R3',
		...SEEDED_REASONING_REVIEW_CRITERIA.slice(1).map((k) => `G3-${k.id.slice(0, 5)}`)
	];
	const onTheCurrentSet = (files: CheckInputs['files'], over: Partial<Omit<CheckInputs, 'files'>> = {}) =>
		check(files, { current: FP_NOW, cases: CURRENT_CASES, oracles: CURRENT_ORACLES.oracles, ...over });

	it('⛔ runs of version one and of version two under today’s fingerprint owe a run over exactly the changed cases, and nothing else: no reproduction failure, no escalation; a run over them turns it green', async () => {
		expect([CURRENT_SET.caseSetVersion, CURRENT_ORACLES.oracleVersion], 'the current set is version three').toEqual([3, 3]);
		const older = new Set([...CASES, ...V2_CASES].map((c) => c.id));
		const changed = CURRENT_CASES.filter((c) => !older.has(c.id));
		expect(changed.map((c) => c.id)).toEqual(CHANGED);
		const v1Record = await recorded({ runId: 'qr-v1-then', cases: CASES });
		const v2Record = await recorded({
			runId: 'qr-v2-then',
			date: '2026-09-25T12:00:00.000Z',
			cases: V2_CASES,
			fingerprint: { ...CURRENT, caseSet: FP_V2.caseSet },
			versions: { caseSet: 2, oracles: 2 }
		});
		const owed = await onTheCurrentSet([file([...v1Record, ...v2Record])]);
		expect(owed.problems.map((p) => p.limb), 'coverage alone').toEqual(['COVERAGE']);
		expect(limb(owed, 'COVERAGE')).toBe(
			`12 of 26 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${CHANGED.join(', ')} — owed: a RUN over them, or RESCORED lines where only the scoring moved (§5.6 limb 1)`
		);
		// The fourteen unchanged cases stay covered by version two's run — the same ids, the same prompts.
		const remeasured = await recorded({
			runId: 'qr-v3-changed',
			date: '2026-09-26T12:00:00.000Z',
			cases: changed,
			fingerprint: { ...CURRENT, caseSet: FP_NOW.caseSet },
			versions: { caseSet: 3, oracles: 3 }
		});
		expect((await onTheCurrentSet([file([...v1Record, ...v2Record, ...remeasured])])).problems).toEqual([]);
	});

	it('⭐ CONTROL — why a changed case carries a new id: kept under its version-two id, it reads as a prompt that moved while the fingerprint did not — a non-reproduction a re-run does not discharge', async () => {
		const v2IdOf = (id: string) => (id.startsWith('G3-') ? `G2-${id.slice(3)}` : id);
		const sameIds = CURRENT_CASES.map((c) => ({ ...c, id: v2IdOf(c.id) }));
		const current = { ...FP_NOW, casePrompts: new Map([...FP_NOW.casePrompts].map(([id, p]) => [v2IdOf(id), p])) };
		const v2Record = await recorded({
			runId: 'qr-v2-same-ids',
			cases: V2_CASES,
			fingerprint: { ...CURRENT, caseSet: FP_V2.caseSet },
			versions: { caseSet: 2, oracles: 2 }
		});
		const rerun = await recorded({
			runId: 'qr-v3-same-ids-rerun',
			date: '2026-09-26T12:00:00.000Z',
			cases: sameIds.filter((c) => CHANGED.includes(`G3-${c.id.slice(3)}`) && c.id.startsWith('G2-')),
			fingerprint: { ...CURRENT, caseSet: FP_NOW.caseSet }
		});
		const r = await onTheCurrentSet([file([...v2Record, ...rerun])], { current, cases: sameIds, oracles: V2_ORACLES.oracles });
		expect(limb(r, 'REPRODUCTION')).toContain(
			'run qr-v2-same-ids: G2-CLEAN#1 initial — the prompt it recorded is not the one today’s reviewer sends, though the fingerprint did not move'
		);
		expect(limb(r, 'COVERAGE'), 'the re-run covers every case — only the old record fails').toBe('');
	});
});

// ── ⭐ `JAN-CRITREAD` J2-6 — the pass bar is the RIGHT VERDICT (`REG-D-080`; DESIGN §5.1 as amended) ────────────────────
/** The Reasoning Review criterion ids the J2-6 limb plants, names and leaves out: RR-02, RR-04 (G-RR-04's planted one),
 *  RR-07, RR-08. */
const RR02 = SEEDED_REASONING_REVIEW_CRITERIA[1]!.id;
const RR04 = SEEDED_REASONING_REVIEW_CRITERIA[3]!.id;
const RR07 = SEEDED_REASONING_REVIEW_CRITERIA[6]!.id;
const RR08 = SEEDED_REASONING_REVIEW_CRITERIA[7]!.id;

describe('JAN-CRITREAD J2-6 — the pass bar is the right verdict (REG-D-080): attribution is reported, never escalated', () => {
	/** A reply that faults `faulted` and still recommends SATISFIED — the floor refuses the contradiction. */
	const contradicting = (faulted: readonly string[]) =>
		JSON.stringify({ ...(JSON.parse(judgement(faulted)) as object), recommendation: 'SATISFIED' });
	/** A reply faulting `faulted` with `gone`'s row left out: the product records `gone` UNABLE_TO_DETERMINE — the only
	 *  way a model's reply leaves a criterion undetermined — and the harness a MISSING_CRITERION malformation. */
	const omitting = (gone: string, faulted: readonly string[]) => {
		const j = JSON.parse(judgement(faulted)) as { findings: { criterionId: string }[] };
		return JSON.stringify({ ...j, findings: j.findings.filter((f) => f.criterionId !== gone) });
	};
	/** Every reply in a fence — a malformation that leaves every criterion answered. */
	const fenced = (id: string) => `\`\`\`json\n${asOracle(id)}\n\`\`\``;
	const unCited = (runId: string, entry: string) =>
		`run ${runId}: ${entry} — no ESCALATION line cites a register finding for it (§5.6 limb 3)`;
	/** Each evaluation's outcome — on its last call, the one that carries it (a repaired evaluation's first carries none). */
	const scoredIn = (lines: readonly RecordLine[], caseId: string) =>
		lines
			.filter((l): l is CallLine => l.kind === 'CALL' && l.caseId === caseId && l.scored !== null)
			.map((c) => c.scored!);
	const outcome = (s: CallLine['scored'] | undefined, k: string) => s!.criteria.find(([c]) => c === k)?.[1];
	const head = (id: string, named: number, of: number) =>
		`run ${id}: the planted criterion named in ${named} of ${of} answered planted evaluation(s), against today’s oracles`;

	it('⛔ a planted case REJECTED without its planted criterion faulted is REPORTED as attribution — never a material failure', async () => {
		const lines = await recorded({ runId: 'qr-attr-1', reply: (id) => (id === 'G-RR-04' ? judgement([RR02]) : asOracle(id)) });
		const [s] = scoredIn(lines, 'G-RR-04');
		expect([s!.disposition, outcome(s, RR04), outcome(s, RR02)], 'the arrangement: the right verdict, on another criterion').toEqual([
			'REJECTED',
			'MET',
			'NOT_MET'
		]);
		const r = await check([file(lines)]);
		expect(limb(r, 'ESCALATION'), 'no ESCALATION is owed for it').toBe('');
		expect(r.problems).toEqual([]);
		expect(r.attribution).toEqual([
			[head('qr-attr-1', 0, 1), 'G-RR-04#1 — REJECTED, the right verdict; RR-04 not faulted (it faulted RR-02)'].join('\n    ')
		]);
	});

	it('⛔ GUARD — a planted case whose verdict is not REJECTED stays MATERIAL: every disposition the floor gives short of REJECTED (SATISFIED, BOUNDARY_REJECTED with the planted criterion faulted, INCONCLUSIVE, VALIDATOR_FAILED), and every other one a record can carry', async () => {
		const passed = await recorded({ runId: 'qr-verdict-1', reply: (id) => (id === 'G-RR-04' ? judgement([]) : asOracle(id)) });
		expect(limb(await check([file(passed)]), 'ESCALATION')).toContain('run qr-verdict-1: G-RR-04 — PLANTED_DEFECT_NOT_REJECTED');
		// Naming the planted criterion does not make the verdict right: here RR-04 is faulted, and the floor refuses a
		// reply that faults it and recommends SATISFIED — BOUNDARY_REJECTED, not the oracle's REJECTED.
		const refused = await recorded({ runId: 'qr-verdict-2', reply: (id) => (id === 'G-RR-04' ? contradicting([RR04]) : asOracle(id)) });
		const [s] = scoredIn(refused, 'G-RR-04');
		expect([s!.disposition, outcome(s, RR04)], 'the arrangement: the planted criterion faulted, the verdict not REJECTED').toEqual([
			'BOUNDARY_REJECTED',
			'NOT_MET'
		]);
		const r = await check([file(refused)]);
		expect(limb(r, 'ESCALATION')).toBe(
			'run qr-verdict-2: G-RR-04 — PLANTED_DEFECT_NOT_REJECTED — no ESCALATION line cites a register finding for it (§5.6 limb 3)'
		);
		expect(r.attribution, 'named, and still material').toEqual([head('qr-verdict-2', 1, 1)]);
		expect((await check([file([...refused, escalate('qr-verdict-2', ['G-RR-04'])])])).problems, 'CONTROL: escalated, green').toEqual([]);
		// ⭐ THE REST OF WHAT THE FLOOR GIVES, enumerated from the product: the Reasoning Review row's disposition is
		// VALIDATOR_FAILED or BOUNDARY_REJECTED at the boundary (`classifyValidatorResult`), else `dispositionFromFindings`
		// — REJECTED, INCONCLUSIVE or SATISFIED here. An INCONCLUSIVE faults nothing (a fault would reject), a
		// VALIDATOR_FAILED records no criterion; neither is the oracle's REJECTED.
		const arms: readonly [runId: string, reply: string, disposition: string][] = [
			['qr-verdict-3', omitting(RR08, []), 'INCONCLUSIVE'],
			['qr-verdict-4', 'I think it is fine.', 'VALIDATOR_FAILED']
		];
		for (const [runId, reply, disposition] of arms) {
			const lines = await recorded({ runId, reply: (id) => (id === 'G-RR-04' ? reply : asOracle(id)) });
			expect(scoredIn(lines, 'G-RR-04').map((x) => x.disposition), `the arrangement: ${disposition}`).toEqual([disposition]);
			expect(limb(await check([file(lines)]), 'ESCALATION'), disposition).toBe(unCited(runId, 'G-RR-04 — PLANTED_DEFECT_NOT_REJECTED'));
		}
		// ⭐ AND EVERY OTHER DISPOSITION A RECORD CAN CARRY, which this floor does not give today — CONDITIONALLY_SATISFIED
		// needs an open MATERIAL finding or a PARTIALLY_MET row, and every Reasoning Review criterion is BLOCKING and
		// emits neither; no rule returns ESCALATED; MISSING needs no result at all. A line can still hold one (an earlier
		// runner's, or one written by hand), and limb 3 reads the disposition as recorded: under an earlier fingerprint,
		// so limb 2 does not re-score it.
		const driven = new Set(['REJECTED', 'SATISFIED', 'BOUNDARY_REJECTED', 'INCONCLUSIVE', 'VALIDATOR_FAILED']);
		const rest = SCORED_DISPOSITIONS.filter((d) => !driven.has(d));
		expect(rest).toEqual(['CONDITIONALLY_SATISFIED', 'ESCALATED', 'MISSING']);
		for (const d of rest) {
			const runId = `qr-verdict-${d.toLowerCase()}`;
			const lines = tamper(await recorded({ runId, fingerprint: moved('scoring') }), 'G-RR-04', (c) => ({
				...c,
				scored: c.scored && { ...c.scored, disposition: d }
			}));
			expect(limb(await check([file(lines)]), 'ESCALATION'), d).toBe(unCited(runId, 'G-RR-04 — PLANTED_DEFECT_NOT_REJECTED'));
		}
	});

	it('⛔ a planted criterion left UNDETERMINED is not named — only NOT_MET names it', async () => {
		const lines = await recorded({ runId: 'qr-attr-4', reply: (id) => (id === 'G-RR-04' ? omitting(RR04, [RR02]) : asOracle(id)) });
		const [s] = scoredIn(lines, 'G-RR-04');
		expect([s!.disposition, outcome(s, RR04), outcome(s, RR02)], 'the arrangement: the right verdict, the planted criterion unjudged').toEqual([
			'REJECTED',
			'UNABLE_TO_DETERMINE',
			'NOT_MET'
		]);
		const r = await check([file(lines)]);
		expect(r.problems).toEqual([]);
		expect(r.attribution).toEqual([
			[head('qr-attr-4', 0, 1), 'G-RR-04#1 — REJECTED, the right verdict; RR-04 not faulted (it faulted RR-02)'].join('\n    ')
		]);
	});

	it('⭐ a RESCORED record’s attribution is REPORTED — it is a record limb 3 reads', async () => {
		const old = await recorded({
			runId: 'qr-attr-5',
			fingerprint: moved('scoring'),
			reply: (id) => (id === 'G-RR-04' ? judgement([RR02]) : asOracle(id))
		});
		const rescored = await rescoredLines(
			old.find((l): l is RunLine => l.kind === 'RUN')!,
			old.filter((l): l is CallLine => l.kind === 'CALL'),
			SUBSET,
			{ rescoreId: 'rs-attr-5', date: '2026-09-25T09:00:00.000Z', commit: 'a'.repeat(40), reviewer: FP.reviewer, scoring: FP.scoring, caseSet: FP.caseSet }
		);
		const r = await check([file([...old, ...rescored])]);
		expect(r.problems).toEqual([]);
		const miss = 'G-RR-04#1 — REJECTED, the right verdict; RR-04 not faulted (it faulted RR-02)';
		expect(r.attribution).toEqual([
			[head('qr-attr-5', 0, 1), miss].join('\n    '),
			['RESCORED rs-attr-5: the planted criterion named in 0 of 1 answered planted evaluation(s), against today’s oracles', miss].join('\n    ')
		]);
	});

	it('⛔ a STRUCK record’s attribution is NOT reported — struck, it counts for nothing, as in limb 3', async () => {
		// A run whose G-RR-04 does not re-score to what it recorded (RR-01 recorded unjudged), with an attribution miss.
		const bad = tamper(
			await recorded({ runId: 'qr-attr-6', reply: (id) => (id === 'G-RR-04' ? judgement([RR02]) : asOracle(id)) }),
			'G-RR-04',
			(c) => ({
				...c,
				scored: c.scored && {
					...c.scored,
					criteria: c.scored.criteria.map(([k, o]) => [k, k.startsWith('RR-01') ? 'UNABLE_TO_DETERMINE' : o] as const)
				}
			})
		);
		const good = await recorded({ runId: 'qr-attr-7' });
		const miss = 'G-RR-04#1 — REJECTED, the right verdict; RR-04 not faulted (it faulted RR-02)';
		const standing = await check([file([...bad, ...good])]);
		expect(limb(standing, 'REPRODUCTION'), 'the arrangement: it does not reproduce').toContain(
			'run qr-attr-6: G-RR-04#1 — re-scored through today’s path it is'
		);
		expect(standing.attribution, 'CONTROL: not struck, it is reported').toEqual([
			[head('qr-attr-6', 0, 1), miss].join('\n    '),
			head('qr-attr-7', 1, 1)
		]);
		const struck = await check([file([...bad, supersede('qr-attr-6'), ...good])]);
		expect(struck.problems).toEqual([]);
		expect(struck.attribution).toEqual([head('qr-attr-7', 1, 1)]);
	});

	it('⛔ an answered criterion now UNDETERMINED, the verdict holding, is REPORTED, not escalated — REG-D-080: “criterion-level classes that do not change the verdict become informational”', async () => {
		// The earlier run is FENCED — malformed already, every criterion answered — so the later run's missing row gains
		// no malformation: the criterion now undetermined is the only thing that moved.
		const first = await recorded({ runId: 'qr-und-1', date: '2026-09-24T12:00:00.000Z', reply: fenced });
		const next = await recorded({
			runId: 'qr-und-2',
			date: '2026-09-25T12:00:00.000Z',
			reply: (id) => (id === 'G-RR-04' ? omitting(RR08, [RR04]) : asOracle(id))
		});
		const [s] = scoredIn(next, 'G-RR-04');
		expect([s!.disposition, outcome(s, RR04), outcome(s, RR08)], 'the arrangement: RR-08 undetermined, the verdict REJECTED as before').toEqual([
			'REJECTED',
			'NOT_MET',
			'UNABLE_TO_DETERMINE'
		]);
		const r = await check([file([...first, ...next])]);
		expect(limb(r, 'ESCALATION'), 'no ESCALATION is owed for it').toBe('');
		expect(r.problems).toEqual([]);
		expect(r.attribution).toEqual([
			head('qr-und-1', 1, 1),
			[
				head('qr-und-2', 1, 1),
				'G-RR-04 — ANSWERED_NOW_UNDETERMINED against run qr-und-1: RR-08 answered in every repetition there, UNABLE_TO_DETERMINE in a repetition here'
			].join('\n    ')
		]);
	});

	it('⛔ …and where the criterion now UNDETERMINED MOVES THE VERDICT, the verdict-level class escalates it: a planted case left INCONCLUSIVE, a clean case no longer SATISFIED', async () => {
		const first = await recorded({ runId: 'qr-und-3', date: '2026-09-24T12:00:00.000Z', reply: fenced });
		// Every Reasoning Review criterion is mandatory: the planted criterion's own row left out, nothing else faulted,
		// is INCONCLUSIVE — not the oracle's REJECTED.
		const planted = await recorded({
			runId: 'qr-und-4',
			date: '2026-09-25T12:00:00.000Z',
			reply: (id) => (id === 'G-RR-04' ? omitting(RR04, []) : asOracle(id))
		});
		expect(scoredIn(planted, 'G-RR-04').map((x) => x.disposition), 'the arrangement: the planted verdict moved').toEqual(['INCONCLUSIVE']);
		const p = await check([file([...first, ...planted])]);
		expect(limb(p, 'ESCALATION')).toBe(unCited('qr-und-4', 'G-RR-04 — PLANTED_DEFECT_NOT_REJECTED'));
		expect(p.attribution).toEqual([
			head('qr-und-3', 1, 1),
			[
				head('qr-und-4', 0, 1),
				'G-RR-04#1 — INCONCLUSIVE, not the oracle’s REJECTED: material (limb 3); RR-04 not faulted (it faulted nothing)',
				'G-RR-04 — FAULT_LOST against run qr-und-3: RR-04 faulted in every repetition there, not in every repetition here',
				'G-RR-04 — ANSWERED_NOW_UNDETERMINED against run qr-und-3: RR-04 answered in every repetition there, UNABLE_TO_DETERMINE in a repetition here'
			].join('\n    ')
		]);
		// A clean case: one row left out is INCONCLUSIVE, and its renamed copy's verdict now differs from it.
		const clean = await recorded({
			runId: 'qr-und-5',
			date: '2026-09-25T12:00:00.000Z',
			reply: (id) => (id === 'G-CLEAN' ? omitting(RR08, []) : asOracle(id))
		});
		expect(scoredIn(clean, 'G-CLEAN').map((x) => x.disposition), 'the arrangement: the clean verdict moved').toEqual(['INCONCLUSIVE']);
		const c = await check([file([...first, ...clean])]);
		expect(limb(c, 'ESCALATION')).toBe(
			[
				unCited('qr-und-5', 'G-CLEAN — CLEAN_NOT_SATISFIED, SATISFIED_LOST'),
				unCited('qr-und-5', 'G-CLEAN-R1 — VERDICT_CHANGES_WITH_NAME')
			].join('\n')
		);
		expect(c.attribution.join('\n')).toContain(
			'G-CLEAN — ANSWERED_NOW_UNDETERMINED against run qr-und-3: RR-08 answered in every repetition there, UNABLE_TO_DETERMINE in a repetition here'
		);
	});

	it('⛔ NO SILENT SHRINK — a run’s planted evaluations of cases outside today’s set are counted out ALOUD, by the oracle version the run recorded', async () => {
		// Version one's 26 cases against today's set: 10 planted cases are still in it; G-RR-02…09, planted in version
		// one, are not — and nor are its 4 clean graph cases, which were never in M.
		const v1Record = await recorded({ runId: 'qr-attr-8', cases: CASES });
		const onTheCurrentSet = (over: Partial<Omit<CheckInputs, 'files'>> = {}) =>
			check([file(v1Record)], { current: FP_NOW, cases: CURRENT_CASES, oracles: CURRENT_ORACLES.oracles, ...over });
		const head8 = head('qr-attr-8', 10, 10);
		expect((await onTheCurrentSet()).attribution).toEqual([
			`${head8} (8 answered planted evaluation(s) of cases not in the current set are not counted)`
		]);
		// Its own version is what says which were planted: not held, they are still counted out — as of unknown standing.
		expect((await onTheCurrentSet({ oracleSets: [CURRENT_ORACLES] })).attribution).toEqual([
			`${head8} (12 answered evaluation(s) of cases not in the current set are not counted: oracles v1, which say which were planted, are not held)`
		]);
	});

	it('⛔ the criterion-level TRANSITION — a planted criterion faulted last run and not now, the verdict holding — is REPORTED, not escalated', async () => {
		const first = await recorded({ runId: 'qr-lost-1', date: '2026-09-24T12:00:00.000Z' });
		const next = await recorded({
			runId: 'qr-lost-2',
			date: '2026-09-25T12:00:00.000Z',
			reply: (id) => (id === 'G-RR-04' ? judgement([RR02]) : asOracle(id))
		});
		const r = await check([file([...first, ...next])]);
		expect(limb(r, 'ESCALATION'), 'no ESCALATION is owed for it').toBe('');
		expect(r.problems).toEqual([]);
		expect(r.attribution).toEqual([
			head('qr-lost-1', 1, 1),
			[
				head('qr-lost-2', 0, 1),
				'G-RR-04#1 — REJECTED, the right verdict; RR-04 not faulted (it faulted RR-02)',
				'G-RR-04 — FAULT_LOST against run qr-lost-1: RR-04 faulted in every repetition there, not in every repetition here'
			].join('\n    ')
		]);
		// Where the verdict moves too, the VERDICT is escalated — the absolute class, as any wrong verdict is.
		const flipped = await recorded({
			runId: 'qr-lost-3',
			date: '2026-09-25T12:00:00.000Z',
			reply: (id) => (id === 'G-RR-04' ? judgement([]) : asOracle(id))
		});
		const moved = await check([file([...first, ...flipped])]);
		expect(limb(moved, 'ESCALATION')).toBe(
			'run qr-lost-3: G-RR-04 — PLANTED_DEFECT_NOT_REJECTED — no ESCALATION line cites a register finding for it (§5.6 limb 3)'
		);
		expect(moved.attribution.join('\n')).toContain(
			'G-RR-04#1 — SATISFIED, not the oracle’s REJECTED: material (limb 3); RR-04 not faulted (it faulted nothing)'
		);
	});

	it('⭐ THE REPORT — per record, the planted criterion named in N of M ANSWERED planted evaluations, each miss with its verdict and what it faulted', async () => {
		let k = 0;
		const lines = await recorded({
			runId: 'qr-attr-2',
			repetitions: 2,
			reply: (id) => (id === 'G-RR-04' && k++ === 1 ? judgement([RR02, RR07]) : asOracle(id))
		});
		const r = await check([file(lines)]);
		expect(r.problems).toEqual([]);
		expect(r.attribution).toEqual([
			[head('qr-attr-2', 1, 2), 'G-RR-04#2 — REJECTED, the right verdict; RR-04 not faulted (it faulted RR-02, RR-07)'].join('\n    ')
		]);
		// A planted evaluation cut at the bound answered nothing: it is a Boundedness failure, and not in M.
		let j = 0;
		const cut = await recorded({
			runId: 'qr-attr-3',
			repetitions: 2,
			reply: (id) => (id === 'G-RR-04' && j++ === 0 ? new Error('the bound') : asOracle(id))
		});
		const c = await check([file([...cut, escalate('qr-attr-3', ['G-RR-04'])])]);
		expect(c.problems).toEqual([]);
		expect(c.attribution).toEqual([head('qr-attr-3', 1, 1)]);
	});
});

// ── the CLI, on mkdtemp fixtures (D11: it runs from source) ─────────────────────────────────────────────────────────
describe('JAN-CRITREAD J2-3 — the CLI reads SOURCE (REG-D-072 D11), reads only what git tracks, and exits with what it found', () => {
	const dirs: string[] = [];
	afterAll(() => {
		for (const d of dirs) rmSync(d, { recursive: true, force: true });
	});
	const tmp = () => {
		const d = mkdtempSync(join(tmpdir(), 'jpwb-qualcheck-'));
		dirs.push(d);
		return d;
	};
	const git = (dir: string, ...args: string[]): string => {
		const r = spawnSync(GIT, ['-C', dir, ...args], { encoding: 'utf8', env: hermeticEnv(), windowsHide: true });
		if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
		return r.stdout;
	};
	/** A record directory that is a git repository of its own, in temp — shown not to be this one before it is used. */
	const gitRepo = (): string => {
		const d = tmp();
		git(d, 'init', '-q');
		git(d, 'config', 'core.autocrlf', 'false');
		const same = (a: string) => a.trim().replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
		expect(same(git(d, 'rev-parse', '--show-toplevel')), 'the fixture is its own repository').toBe(same(d));
		return d;
	};
	const cli = (bunArgs: readonly string[], args: readonly string[]) => {
		const r = spawnSync(BUN, [...bunArgs, 'scripts/reviewer-qual/check.ts', ...args], {
			cwd: REPO,
			encoding: 'utf8',
			env: hermeticEnv(),
			windowsHide: true
		});
		return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
	};
	/** ⭐ `JAN-CRITREAD` J2-6 — the report block's header: attribution, and the criterion-level transitions beside it
	 *  (`FAULT_LOST`, `ANSWERED_NOW_UNDETERMINED`), none of them material (`REG-D-080`). */
	const ATTRIBUTION_HEADER =
		'reviewer:qual:check — attribution against the oracles’ `faulted` lists, and the criterion-level transitions — reported, never a material failure (REG-D-080):';

	it('⛔ under bare bun the packages resolve to built dist, and the check refuses to run', () => {
		const r = cli([], ['--records', gitRepo()]);
		expect(r.status, r.out).toBe(2);
		expect(r.out).toContain('REG-D-072 D11');
	});

	it('⛔ a flag it does not know is refused', () => {
		const r = cli(['--conditions=source'], ['--record', gitRepo()]);
		expect(r.status, r.out).toBe(2);
		expect(r.out).toContain('unknown flag --record');
	});

	it('⛔ a record directory outside any git work tree is refused — only what git tracks is the record', () => {
		const r = cli(['--conditions=source'], ['--records', tmp()]);
		expect(r.status, r.out).toBe(2);
		expect(r.out).toContain('is not in a git work tree');
	});

	it('⛔ RED on an empty record — all 26 cases of the committed set are owed', () => {
		const r = cli(['--conditions=source'], ['--records', gitRepo()]);
		expect(r.status, r.out).toBe(1);
		expect(r.out).toContain('26 of 26 current case(s) are not MEASURED under today’s reviewer fingerprint');
		expect(r.out).toContain(FP.reviewer);
		// ⭐ `JAN-CRITREAD` J2-5 — the committed set it holds coverage to is the CURRENT one, version three since J2-7, with its oracles.
		expect(r.out).toContain('; case set v3, oracles v3\n');
		expect(r.out).toContain(`: ${CURRENT_CASES.map((c) => c.id).join(', ')} — owed`);
		expect(CURRENT_SET.caseSetVersion).toBe(3);
	});

	it('⭐ GREEN on a TRACKED record that covers the committed set, reproduces, and holds no material failure', async () => {
		const dir = gitRepo();
		writeFileSync(
			join(dir, 'runs.ndjson'),
			text(await recorded({ runId: 'qr-cli-1', cases: CURRENT_CASES, versions: { caseSet: 3, oracles: 3 } }))
		);
		git(dir, 'add', 'runs.ndjson');
		const r = cli(['--conditions=source'], ['--records', dir]);
		expect(r.out).toContain('GREEN');
		expect(r.status, r.out).toBe(0);
	}, 120_000);

	it('⛔ a record file git does not track, or one changed since it was staged, is NOT READ — green here is green on the commit', async () => {
		const lines = await recorded({ runId: 'qr-cli-2', cases: CURRENT_CASES, versions: { caseSet: 3, oracles: 3 } });
		const untracked = gitRepo();
		writeFileSync(join(untracked, 'runs.ndjson'), text(lines));
		const r = cli(['--conditions=source'], ['--records', untracked]);
		expect(r.status, r.out).toBe(1);
		expect(r.out).toContain('runs.ndjson: not read — git does not track it');
		expect(r.out, 'and so it covers nothing').toContain('26 of 26 current case(s) are not MEASURED');

		const changed = gitRepo();
		writeFileSync(join(changed, 'runs.ndjson'), text(lines));
		git(changed, 'add', 'runs.ndjson');
		appendFileSync(join(changed, 'runs.ndjson'), serializeLine(escalate('qr-cli-2', ['G3-CLEAN'])));
		const c = cli(['--conditions=source'], ['--records', changed]);
		expect(c.status, c.out).toBe(1);
		expect(c.out).toContain('runs.ndjson: not read — it differs from what git has staged');
	}, 120_000);

	it('⛔ an ESCALATION citing a finding the register STRIKES clears nothing, end to end — and one it holds open does', async () => {
		const dir = gitRepo();
		const missed = await recorded({
			runId: 'qr-cli-3',
			cases: CURRENT_CASES,
			versions: { caseSet: 3, oracles: 3 },
			reply: (id) => (id === 'G3-RR-04' ? judgement([]) : asOracle(id))
		});
		writeFileSync(join(dir, 'runs.ndjson'), text([...missed, escalate('qr-cli-3', ['G3-RR-04'], 'REG-F-105')]));
		git(dir, 'add', 'runs.ndjson');
		const register = join(tmp(), 'register.md');
		writeFileSync(register, '### ~~REG-F-105~~ — RULED\n');
		const r = cli(['--conditions=source'], ['--records', dir, '--register', register]);
		expect(r.status, r.out).toBe(1);
		expect(r.out).toContain('ESCALATION cites REG-F-105, whose register heading is struck');
		expect(r.out).toContain('run qr-cli-3: G3-RR-04 — PLANTED_DEFECT_NOT_REJECTED');
		writeFileSync(register, '### REG-F-105 — open, for the control\n');
		const open = cli(['--conditions=source'], ['--records', dir, '--register', register]);
		expect(open.out, 'CONTROL: the same finding, open').toContain('GREEN');
		expect(open.status, open.out).toBe(0);
	}, 120_000);

	it('⭐ J2-6 — the CLI PRINTS the attribution report, and is GREEN on a record whose only miss is attribution (REG-D-080)', async () => {
		const dir = gitRepo();
		const lines = await recorded({
			runId: 'qr-cli-4',
			cases: CURRENT_CASES,
			versions: { caseSet: 3, oracles: 3 },
			reply: (id) => (id === 'W-RR-04' ? judgement([RR02]) : asOracle(id))
		});
		writeFileSync(join(dir, 'runs.ndjson'), text(lines));
		git(dir, 'add', 'runs.ndjson');
		const r = cli(['--conditions=source'], ['--records', dir]);
		expect(r.out).toContain(
			[
				ATTRIBUTION_HEADER,
				'  run qr-cli-4: the planted criterion named in 17 of 18 answered planted evaluation(s), against today’s oracles',
				'    W-RR-04#1 — REJECTED, the right verdict; RR-04 not faulted (it faulted RR-02)',
				'reviewer:qual:check — GREEN'
			].join('\n')
		);
		expect(r.status, r.out).toBe(0);
	}, 120_000);

	it('⭐ J2-6 — the CLI counts a run’s planted evaluations outside today’s set OUT ALOUD, by every oracle version on file (REG-D-080)', async () => {
		// The committed record's shape: a run of version one under today's fingerprint, beside one over today's set.
		const dir = gitRepo();
		const v1 = await recorded({ runId: 'qr-cli-5', cases: CASES });
		const now = await recorded({ runId: 'qr-cli-6', cases: CURRENT_CASES, versions: { caseSet: 3, oracles: 3 } });
		writeFileSync(join(dir, 'runs.ndjson'), text([...v1, ...now]));
		git(dir, 'add', 'runs.ndjson');
		const r = cli(['--conditions=source'], ['--records', dir]);
		expect(r.out).toContain(
			[
				ATTRIBUTION_HEADER,
				'  run qr-cli-5: the planted criterion named in 10 of 10 answered planted evaluation(s), against today’s oracles (8 answered planted evaluation(s) of cases not in the current set are not counted)',
				'  run qr-cli-6: the planted criterion named in 18 of 18 answered planted evaluation(s), against today’s oracles',
				'reviewer:qual:check — GREEN'
			].join('\n')
		);
		expect(r.status, r.out).toBe(0);
	}, 120_000);
});
