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
	ORACLES_V1_FILE,
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
const CASES = (JSON.parse(readFileSync(`${REPO}/${CASE_SET_V1_FILE}`, 'utf8')) as CaseSet).cases;
const ORACLES = (JSON.parse(readFileSync(`${REPO}/${ORACLES_V1_FILE}`, 'utf8')) as OracleSet).oracles;
const ORACLE = new Map(ORACLES.map((o) => [o.caseId, o]));
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
/** Which case a prompt belongs to — by its hash, initial or repair. */
let CASE_OF: Map<string, string>;
beforeAll(async () => {
	// ⛔ No program can be found from this process: the validator's default print is `agyPrint`.
	vi.stubEnv('PATH', NO_PROGRAMS);
	FP = await reviewerFingerprint(CASES);
	CURRENT = { reviewer: FP.reviewer, scoring: FP.scoring, caseSet: FP.caseSet };
	CASE_OF = new Map([...FP.casePrompts].flatMap(([id, p]) => [[p.initial, id] as const, [p.repair, id] as const]));
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
}): Promise<RecordLine[]> {
	let n = 0;
	const { TransportFailure } = await import('../scripts/reviewer-qual/transports.js');
	return runQualification({
		runId: o.runId,
		date: o.date ?? '2026-09-24T12:00:00.000Z',
		commit: 'e5f9358b'.repeat(5),
		fingerprint: o.fingerprint ?? CURRENT,
		cases: o.cases ?? SUBSET,
		caseSetVersion: 1,
		oracleVersion: 1,
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
	const plantedMissed = (runId: string, fingerprint?: RunFingerprint) =>
		recorded({ runId, ...(fingerprint ? { fingerprint } : {}), reply: (id) => (id === 'G-RR-04' ? judgement([]) : asOracle(id)) });

	it('⛔ a planted defect not faulted is red until an ESCALATION line cites a finding the register holds', async () => {
		const lines = await plantedMissed('qr-esc-1');
		const r = await check([file(lines)]);
		expect(limb(r, 'ESCALATION')).toContain('run qr-esc-1: G-RR-04 — PLANTED_DEFECT_NOT_FAULTED');
		const another = await check([file([...lines, escalate('qr-esc-1', ['G-CLEAN'])])]);
		expect(limb(another, 'ESCALATION'), 'an escalation of ANOTHER case of the run cites nothing here').toContain(
			'run qr-esc-1: G-RR-04 — PLANTED_DEFECT_NOT_FAULTED'
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
		expect(limb(r, 'ESCALATION')).toContain('run qr-move-1: G-RR-04 — PLANTED_DEFECT_NOT_FAULTED');
	});

	it('⛔ a STRUCK finding escalates nothing — `### ~~REG-F-NNN~~` is a closed entry, and citing it clears no failure', async () => {
		const lines = await plantedMissed('qr-esc-3');
		const citing = file([...lines, escalate('qr-esc-3', ['G-RR-04'], 'REG-F-105')]);
		const findings = new Set([...FINDINGS, 'REG-F-105']);
		const struck = await check([citing], { findings, struck: new Set(['REG-F-105']) });
		expect(limb(struck, 'RECORD')).toContain('ESCALATION cites REG-F-105, whose register heading is struck');
		expect(limb(struck, 'ESCALATION'), 'the failure stays un-cited').toContain('run qr-esc-3: G-RR-04 — PLANTED_DEFECT_NOT_FAULTED');
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
	});

	it('⭐ GREEN on a TRACKED record that covers the committed set, reproduces, and holds no material failure', async () => {
		const dir = gitRepo();
		writeFileSync(join(dir, 'runs.ndjson'), text(await recorded({ runId: 'qr-cli-1', cases: CASES })));
		git(dir, 'add', 'runs.ndjson');
		const r = cli(['--conditions=source'], ['--records', dir]);
		expect(r.out).toContain('GREEN');
		expect(r.status, r.out).toBe(0);
	}, 120_000);

	it('⛔ a record file git does not track, or one changed since it was staged, is NOT READ — green here is green on the commit', async () => {
		const lines = await recorded({ runId: 'qr-cli-2', cases: CASES });
		const untracked = gitRepo();
		writeFileSync(join(untracked, 'runs.ndjson'), text(lines));
		const r = cli(['--conditions=source'], ['--records', untracked]);
		expect(r.status, r.out).toBe(1);
		expect(r.out).toContain('runs.ndjson: not read — git does not track it');
		expect(r.out, 'and so it covers nothing').toContain('26 of 26 current case(s) are not MEASURED');

		const changed = gitRepo();
		writeFileSync(join(changed, 'runs.ndjson'), text(lines));
		git(changed, 'add', 'runs.ndjson');
		appendFileSync(join(changed, 'runs.ndjson'), serializeLine(escalate('qr-cli-2', ['G-CLEAN'])));
		const c = cli(['--conditions=source'], ['--records', changed]);
		expect(c.status, c.out).toBe(1);
		expect(c.out).toContain('runs.ndjson: not read — it differs from what git has staged');
	}, 120_000);

	it('⛔ an ESCALATION citing a finding the register STRIKES clears nothing, end to end — and one it holds open does', async () => {
		const dir = gitRepo();
		const missed = await recorded({
			runId: 'qr-cli-3',
			cases: CASES,
			reply: (id) => (id === 'G-RR-04' ? judgement([]) : asOracle(id))
		});
		writeFileSync(join(dir, 'runs.ndjson'), text([...missed, escalate('qr-cli-3', ['G-RR-04'], 'REG-F-105')]));
		git(dir, 'add', 'runs.ndjson');
		const register = join(tmp(), 'register.md');
		writeFileSync(register, '### ~~REG-F-105~~ — RULED\n');
		const r = cli(['--conditions=source'], ['--records', dir, '--register', register]);
		expect(r.status, r.out).toBe(1);
		expect(r.out).toContain('ESCALATION cites REG-F-105, whose register heading is struck');
		expect(r.out).toContain('run qr-cli-3: G-RR-04 — PLANTED_DEFECT_NOT_FAULTED');
		writeFileSync(register, '### REG-F-105 — open, for the control\n');
		const open = cli(['--conditions=source'], ['--records', dir, '--register', register]);
		expect(open.out, 'CONTROL: the same finding, open').toContain('GREEN');
		expect(open.status, open.out).toBe(0);
	}, 120_000);
});
