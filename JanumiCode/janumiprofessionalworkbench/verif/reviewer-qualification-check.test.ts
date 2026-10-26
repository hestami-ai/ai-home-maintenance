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
// ⭐ `JAN-SELREV` SR-4 (`REG-D-086`): with a SELECTION in force, limb 1 asks its question again of the SELECTED
// candidate's runs alone, and a SELECTION's ruling is held as an ESCALATION's finding is (the SR-4 limb below).
//
// ⚠ NO MODEL IS CALLED. Records are made by the real runner over a stub transport that answers each case as told, and
// are re-scored through the real path (`rescore.ts`). The committed record is NOT asserted here: `bun run test` must
// not redden on what the gate's tail reports — the check itself, run by `gate:tail`, is that limb.
// ⛔ AND NONE IS REACHABLE: in process PATH names an empty directory, and the CLI runs hermetic
// (`reviewer-qualification-hermetic.ts`); its record directories are git repositories of their own, in temp.
import { spawnSync } from 'node:child_process';
import {
	appendFileSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
	CASE_SET_V1_FILE,
	CASE_SET_V2_FILE,
	CASE_SET_V3_FILE,
	CASE_SET_V4_FILE,
	CASE_SET_V5_FILE,
	CASE_SET_V6_FILE,
	CASE_SET_V7_FILE,
	CASE_SET_V8_FILE,
	CASE_SET_V9_FILE,
	CASE_SET_V10_FILE,
	CASE_SET_V11_FILE,
	CURRENT_CASE_SET_FILE,
	CURRENT_ORACLES_FILE,
	ORACLES_PROPOSED,
	ORACLES_RESTATEMENT_UNCONFIRMED,
	ORACLES_V1_FILE,
	ORACLES_V2_FILE,
	ORACLES_V3_FILE,
	ORACLES_V4_FILE,
	ORACLES_V5_FILE,
	ORACLES_V6_FILE,
	ORACLES_V7_FILE,
	ORACLES_V8_FILE,
	ORACLES_V9_FILE,
	ORACLES_V10_FILE,
	ORACLES_V11_FILE,
	type CaseSet,
	type OracleSet,
	type QualificationCase
} from '../scripts/reviewer-qual/cases.js';
import {
	checkQualification,
	ORACLES_NOT_CONFERRED,
	registerFindings,
	RESTATEMENT_NOT_CONFIRMED,
	registerRulings,
	type CheckInputs,
	type CheckReport
} from '../scripts/reviewer-qual/check-core.js';
import { OutputLimitReached } from '../apps/rph-demo/src/lib/server/tools/output-limit.js';
import {
	CRITERION_REPAIR_INSTRUCTION,
	MISSING_CRITERION_REPAIR_OPENING
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { main, REGISTER_FILE } from '../scripts/reviewer-qual/check.js';
import { DECLARED_ORACLES_PROPOSED } from '../scripts/reviewer-qual/oracles-v5.js';
import { reviewerFingerprintOf, sha256 } from '../scripts/reviewer-qual/digest.js';
import { reviewerFingerprint, type ReviewerFingerprint } from '../scripts/reviewer-qual/fingerprint.js';
import {
	RECORD_DIR,
	SCORED_DISPOSITIONS,
	serializeLine,
	type CallLine,
	type CandidateIdentity,
	type RecordLine,
	type RescoredLine,
	type RunLine,
	type ScoredOutcome,
	type SelectedCandidate,
	type SelectionLine,
	type ServedFacts
} from '../scripts/reviewer-qual/record.js';
import { rescoreEvaluation, rescoredLines } from '../scripts/reviewer-qual/rescore.js';
import { runQualification, type RunFingerprint } from '../scripts/reviewer-qual/runner.js';
import { scoringCorpus } from '../scripts/reviewer-qual/scoring-corpus.js';
import type { TransportReply } from '../scripts/reviewer-qual/transports.js';
import { BUN, GIT, hermeticEnv, NO_PROGRAMS } from './reviewer-qualification-hermetic.js';

const REPO = fileURLToPath(new URL('../', import.meta.url))
	.replace(/\\/g, '/')
	.replace(/\/$/, '');
// ⚠ `JAN-CRITREAD` J2-5 — THE LIMBS ARE DRIVEN OVER CASE SET VERSION ONE, A FIXED FIXTURE: the core is handed the set it
// calls current (`SUBSET` below), so these ids are the fixture's, and version one — history the committed record
// measured — never moves under them. The CLI reads the CURRENT set (`cases.ts`), and its tests at the end use it; so
// ~~does the J2-7 limb, which checks a record of versions one and two against it~~ does the `PQ-2` limb, which checks a
// record of version three against it (version four).
// ⚠ `JAN-CRITREAD` J2-7 — VERSION TWO IS NOW A FIXED FIXTURE TOO: the J2-5 limb checks a record of version one against
// version two, the set that was current when it was written, and still is its subject; history never moves under it.
// ⚠ `JAN-PRQUAL` `PQ-2` — AND VERSION THREE: the J2-7 limb checks records of versions one and two against version three,
// the set that was current when it was written (DESIGN-process-result-qualification.md D4 makes version four current).
const CASES = (JSON.parse(readFileSync(`${REPO}/${CASE_SET_V1_FILE}`, 'utf8')) as CaseSet).cases;
const ORACLES = (JSON.parse(readFileSync(`${REPO}/${ORACLES_V1_FILE}`, 'utf8')) as OracleSet).oracles;
/** ⭐ `E12F` F5 — version one's conferral statement: conferred (`REG-D-073`). */
const V1_CONFERRAL = (JSON.parse(readFileSync(`${REPO}/${ORACLES_V1_FILE}`, 'utf8')) as OracleSet).conferral;
const V2_CASES = (JSON.parse(readFileSync(`${REPO}/${CASE_SET_V2_FILE}`, 'utf8')) as CaseSet).cases;
const V2_ORACLES = JSON.parse(readFileSync(`${REPO}/${ORACLES_V2_FILE}`, 'utf8')) as OracleSet;
const V3_SET = JSON.parse(readFileSync(`${REPO}/${CASE_SET_V3_FILE}`, 'utf8')) as CaseSet;
const V3_CASES = V3_SET.cases;
const V3_ORACLES = JSON.parse(readFileSync(`${REPO}/${ORACLES_V3_FILE}`, 'utf8')) as OracleSet;
/** ⭐ `JAN-EXEC` Phase 7 completion E2 — version four, current from `JAN-PRQUAL` `PQ-2` to E2, a fixed fixture since: the
 *  limbs about records of version three are checked against it, the set that was current when they were written. */
const V4_SET = JSON.parse(readFileSync(`${REPO}/${CASE_SET_V4_FILE}`, 'utf8')) as CaseSet;
const V4_CASES = V4_SET.cases;
const V4_ORACLES = JSON.parse(readFileSync(`${REPO}/${ORACLES_V4_FILE}`, 'utf8')) as OracleSet;
/** ⭐ `JAN-EXEC` Phase 7 completion, round 5 — version five, current from E2 to round 5, a fixed fixture since: the limbs
 *  about records of version four are checked against it, and version six's limb checks P4's record of it. */
const V5_SET = JSON.parse(readFileSync(`${REPO}/${CASE_SET_V5_FILE}`, 'utf8')) as CaseSet;
const V5_CASES = V5_SET.cases;
const V5_ORACLES = JSON.parse(readFileSync(`${REPO}/${ORACLES_V5_FILE}`, 'utf8')) as OracleSet;
/** ⭐ Package P F3 — version six, current from round 5 to package P, a fixed fixture since: version six's limb checks P4's
 *  record against it, and version seven's limb checks a record of it under the fingerprint before F1. */
const V6_SET = JSON.parse(readFileSync(`${REPO}/${CASE_SET_V6_FILE}`, 'utf8')) as CaseSet;
const V6_CASES = V6_SET.cases;
const V6_ORACLES = JSON.parse(readFileSync(`${REPO}/${ORACLES_V6_FILE}`, 'utf8')) as OracleSet;
/** ⭐ The review in parts, B7 — version seven, current from package P to B7, a fixed fixture since: its limb checks package
 *  P's record shape (F4), and version eight's checks a run of it. */
const V7_SET = JSON.parse(readFileSync(`${REPO}/${CASE_SET_V7_FILE}`, 'utf8')) as CaseSet;
const V7_CASES = V7_SET.cases;
const V7_ORACLES = JSON.parse(readFileSync(`${REPO}/${ORACLES_V7_FILE}`, 'utf8')) as OracleSet;
/** ⭐ B8a — version eight, current from B7 to B8a, a fixed fixture since: its limb checks a run of version seven, and version
 *  nine's checks a run of it. */
const V8_SET = JSON.parse(readFileSync(`${REPO}/${CASE_SET_V8_FILE}`, 'utf8')) as CaseSet;
const V8_CASES = V8_SET.cases;
const V8_ORACLES = JSON.parse(readFileSync(`${REPO}/${ORACLES_V8_FILE}`, 'utf8')) as OracleSet;
/** ⭐ B8b — version nine, current from B8a to B8b, a fixed fixture since: its limb checks a run of version eight. */
const V9_SET = JSON.parse(readFileSync(`${REPO}/${CASE_SET_V9_FILE}`, 'utf8')) as CaseSet;
const V9_CASES = V9_SET.cases;
const V9_ORACLES = JSON.parse(readFileSync(`${REPO}/${ORACLES_V9_FILE}`, 'utf8')) as OracleSet;
/** ⭐ Package K — version ten, current from B8b to package K, a fixed fixture since: its limb checks a run of version nine, and
 *  version eleven's checks a run of it. */
const V10_SET = JSON.parse(readFileSync(`${REPO}/${CASE_SET_V10_FILE}`, 'utf8')) as CaseSet;
const V10_CASES = V10_SET.cases;
const V10_ORACLES = JSON.parse(readFileSync(`${REPO}/${ORACLES_V10_FILE}`, 'utf8')) as OracleSet;
/** ⭐ Package V — version eleven, current from package K to package V, a fixed fixture since: its limb checks a run of version
 *  ten, and version twelve's checks a record of it. */
const V11_SET = JSON.parse(readFileSync(`${REPO}/${CASE_SET_V11_FILE}`, 'utf8')) as CaseSet;
const V11_CASES = V11_SET.cases;
const V11_ORACLES = JSON.parse(readFileSync(`${REPO}/${ORACLES_V11_FILE}`, 'utf8')) as OracleSet;
const CURRENT_SET = JSON.parse(readFileSync(`${REPO}/${CURRENT_CASE_SET_FILE}`, 'utf8')) as CaseSet;
const CURRENT_ORACLES = JSON.parse(readFileSync(`${REPO}/${CURRENT_ORACLES_FILE}`, 'utf8')) as OracleSet;
const CURRENT_CASES = CURRENT_SET.cases;
/**
 * ⭐ `JAN-CRITREAD` J2-6 — every oracle version on file, as the CLI hands them to the check: a run's own version says
 * which of its cases outside today's set it planted, so the attribution counts those out aloud (`REG-D-080`).
 * ⭐ `JAN-CRITREAD` J2-7 — version two's among them, as the CLI reads it from disk beside version one's and today's.
 * ⭐ `JAN-PRQUAL` `PQ-2` — and version three's, as the CLI reads it beside the others now version four is today's.
 * ⭐ `JAN-EXEC` Phase 7 completion E2 — and version four's, now version five is today's.
 * ⭐ Round 5 — and version five's, now version six is today's.
 * ⭐ Package P F3 — and version six's, now version seven is today's.
 * ⭐ B8a — and version eight's, now version nine is today's (version seven's since B7).
 * ⭐ B8b — and version nine's, now version ten is today's.
 * ⭐ Package K — and version ten's, now version eleven is today's.
 * ⭐ Package V — and version eleven's, now version twelve is today's.
 */
const ORACLE_SETS: readonly OracleSet[] = [
	JSON.parse(readFileSync(`${REPO}/${ORACLES_V1_FILE}`, 'utf8')) as OracleSet,
	V2_ORACLES,
	V3_ORACLES,
	V4_ORACLES,
	V5_ORACLES,
	V6_ORACLES,
	V7_ORACLES,
	V8_ORACLES,
	V9_ORACLES,
	V10_ORACLES,
	V11_ORACLES,
	CURRENT_ORACLES
];
/**
 * ⭐⭐ D3c (`REG-D-132`; `REG-F-576`) — EVERY CASE SET VERSION ON FILE, today's among them, as the CLI hands them to the check:
 * each one's version and its cases' ids. An ACKNOWLEDGED line's `addedCaseIds` must all be held by one of them.
 */
const CASE_SETS: CheckInputs['caseSets'] = [
	{ caseSetVersion: 1, cases: CASES },
	{ caseSetVersion: 2, cases: V2_CASES },
	V3_SET,
	V4_SET,
	V5_SET,
	V6_SET,
	V7_SET,
	V8_SET,
	V9_SET,
	V10_SET,
	V11_SET,
	CURRENT_SET
].map((s) => ({ caseSetVersion: s.caseSetVersion, caseIds: s.cases.map((c) => c.id) }));
/** Every oracle any set holds: a case id two hold carries the same standing in each (the cases test holds that). */
const ORACLE = new Map(
	[
		...ORACLES,
		...V2_ORACLES.oracles,
		...V3_ORACLES.oracles,
		...V4_ORACLES.oracles,
		...V5_ORACLES.oracles,
		...V6_ORACLES.oracles,
		...V7_ORACLES.oracles,
		...V8_ORACLES.oracles,
		...V9_ORACLES.oracles,
		...V10_ORACLES.oracles,
		...V11_ORACLES.oracles,
		...CURRENT_ORACLES.oracles
	].map((o) => [o.caseId, o])
);
/** The current case set most limbs are driven over: a clean case, a renamed copy of it, a planted defect. */
const SUBSET: readonly QualificationCase[] = CASES.filter((c) => ['G-CLEAN', 'G-CLEAN-R1', 'G-RR-04'].includes(c.id));
/** Findings the register holds — each a real entry (`register-citations.test.ts` resolves every id named here). */
const FINDINGS: ReadonlySet<string> = new Set(['REG-F-427', 'REG-F-428', 'REG-F-429']);
/** A finding id no entry defines — the register-citations gate's own synthetic fixture id. */
const UNFILED = 'REG-F-998';
/** ⭐ `JAN-SELREV` SR-4 — rulings the register holds, each a real entry, as `FINDINGS` are. */
const RULINGS: ReadonlySet<string> = new Set(['REG-D-084', 'REG-D-085', 'REG-D-086']);
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
/** ⭐ `JAN-SELREV` SR-4 — the candidate `REG-D-084` selects, as its runs record it: devin's own agent and provider, and
 *  nothing served that a run can see. */
const DEVIN: CandidateIdentity = {
	...AGY,
	transport: 'devin',
	agentId: 'devin',
	provider: 'devin',
	modelLabel: 'glm-5-3-flash-max',
	bounds: { wallClockMs: 240_000, promptChars: null, printTimeout: null },
	argv: null
};
/** A SELECTION line — the selected candidate, on a ruling. */
const select = (candidate: SelectedCandidate, ruling = 'REG-D-084'): SelectionLine => ({
	kind: 'SELECTION',
	date: '2026-09-26T09:00:00.000Z',
	candidate,
	ruling,
	note: 'Selected for the fixture.'
});

let FP: ReviewerFingerprint;
let CURRENT: RunFingerprint;
/** Today's fingerprint over the CURRENT case set — the same reviewer; its case prompts and case-set digest differ. */
let FP_NOW: ReviewerFingerprint;
/** ⭐ E2 — version four's, a fixed fixture now (`V4_SET`). */
let FP_V4: ReviewerFingerprint;
/** ⭐ Round 5 — version five's, a fixed fixture now (`V5_SET`). */
let FP_V5: ReviewerFingerprint;
/** ⭐ Package P F3 — version six's, a fixed fixture now (`V6_SET`). */
let FP_V6: ReviewerFingerprint;
/** ⭐ The review in parts, B7 — version seven's, a fixed fixture now (`V7_SET`). */
let FP_V7: ReviewerFingerprint;
/** ⭐ B8a — version eight's, a fixed fixture now (`V8_SET`). */
let FP_V8: ReviewerFingerprint;
/** ⭐ B8b — version nine's, a fixed fixture now (`V9_SET`). */
let FP_V9: ReviewerFingerprint;
/** ⭐ Package K — version ten's, a fixed fixture now (`V10_SET`). */
let FP_V10: ReviewerFingerprint;
/** ⭐ Package V — version eleven's, a fixed fixture now (`V11_SET`). */
let FP_V11: ReviewerFingerprint;
/** `JAN-CRITREAD` J2-7 — today's fingerprint over version two, the fixed fixture of the J2-5 limb. */
let FP_V2: ReviewerFingerprint;
/** `JAN-PRQUAL` `PQ-2` — today's fingerprint over version three, the fixed fixture of the J2-7 limb. */
let FP_V3: ReviewerFingerprint;
/** Which case a prompt belongs to — by its hash, initial or repair — in versions one to three or the current set. */
let CASE_OF: Map<string, string>;
beforeAll(async () => {
	// ⛔ No program can be found from this process: the validator's default print is `agyPrint`.
	vi.stubEnv('PATH', NO_PROGRAMS);
	FP = await reviewerFingerprint(CASES);
	FP_NOW = await reviewerFingerprint(CURRENT_CASES);
	FP_V4 = await reviewerFingerprint(V4_CASES);
	FP_V5 = await reviewerFingerprint(V5_CASES);
	FP_V6 = await reviewerFingerprint(V6_CASES);
	FP_V7 = await reviewerFingerprint(V7_CASES);
	FP_V8 = await reviewerFingerprint(V8_CASES);
	FP_V9 = await reviewerFingerprint(V9_CASES);
	FP_V10 = await reviewerFingerprint(V10_CASES);
	FP_V11 = await reviewerFingerprint(V11_CASES);
	FP_V2 = await reviewerFingerprint(V2_CASES);
	FP_V3 = await reviewerFingerprint(V3_CASES);
	CURRENT = { reviewer: FP.reviewer, scoring: FP.scoring, caseSet: FP.caseSet };
	CASE_OF = new Map(
		[...FP.casePrompts, ...FP_V2.casePrompts, ...FP_V3.casePrompts, ...FP_V5.casePrompts, ...FP_V6.casePrompts, ...FP_V7.casePrompts, ...FP_V8.casePrompts, ...FP_V9.casePrompts, ...FP_V10.casePrompts, ...FP_V11.casePrompts, ...FP_NOW.casePrompts].flatMap(
			([id, p]) => [[p.initial, id] as const, [p.repair, id] as const]
		)
	);
}, 60_000);
afterAll(() => {
	vi.unstubAllEnvs();
});

/**
 * ⭐ Package L — D13 (`REG-D-135` (3)) — the case a prompt belongs to: by its hash, initial or repair, or — a criterion
 * repair, which ends with I5's line or D13's — by the review prompt it extends. ⛔ D13's line names the declared criteria the
 * reply before it left without a row, so its prompt is no case's one hash, and a stand-in that knew cases by hash alone
 * refused it as "a prompt no case sends".
 */
const caseOfPrompt = (prompt: string): string | undefined => {
	const byHash = CASE_OF.get(sha256(prompt));
	if (byHash !== undefined) return byHash;
	const at = prompt.lastIndexOf('\n\n');
	const line = prompt.slice(at + 2);
	if (at < 0 || (line !== CRITERION_REPAIR_INSTRUCTION && !line.startsWith(MISSING_CRITERION_REPAIR_OPENING))) return undefined;
	return CASE_OF.get(sha256(prompt.slice(0, at)));
};

/** A reply faulting exactly `faulted`, as a reviewer would write it. */
const judgement = (
	faulted: readonly string[],
	criteria: readonly { readonly id: string }[] = SEEDED_REASONING_REVIEW_CRITERIA
): string =>
	JSON.stringify({
		findings: criteria.map((k) => ({
			criterionId: k.id,
			failed: faulted.includes(k.id),
			statement: faulted.includes(k.id) ? 'present' : 'absent',
			severity: faulted.includes(k.id) ? 'BLOCKING' : 'INFORMATIONAL'
		})),
		recommendation: faulted.length ? 'REJECTED' : 'SATISFIED'
	});
/**
 * ⭐ `JAN-EXEC` Phase 7 completion E2 — a DECLARED case's rubric: its own policy's criteria, which its reviewer answers
 * (`materialize.ts`), never the floor's.
 */
const DECLARED_RUBRIC = new Map(
	// ⭐ Round 5 — version five's among them: its D-FP-CLEAN is no case of today's set.
	[...V5_CASES, ...V7_CASES, ...V8_CASES, ...CURRENT_CASES].flatMap((c) => (c.arm === 'DECLARED_POLICY' ? [[c.id, c.input.policy.criteria] as const] : []))
);
/** What each case's oracle expects — a reviewer that gets every case right, answering the case's own rubric. */
const asOracle = (caseId: string): string => judgement(ORACLE.get(caseId)!.faulted, DECLARED_RUBRIC.get(caseId));

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
				const caseId = caseOfPrompt(prompt);
				if (!caseId) throw new Error('a prompt no case sends');
				const k = n++;
				const answer = (o.reply ?? asOracle)(caseId, k);
				// ⭐ P5 package A (F2) — the product's class for a reply its tool cut, passed on as the devin transport passes it.
				if (answer instanceof OutputLimitReached) throw answer;
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
		// ⭐⭐ D3c — every committed case set, as the CLI reads them, unless said.
		caseSets: CASE_SETS,
		// ⭐ `E12F` F5 — the conferral of the oracles the check holds the record to: version one's, conferred, unless said.
		conferral: V1_CONFERRAL,
		findings: FINDINGS,
		struck: new Set(),
		rulings: RULINGS,
		struckRulings: new Set(),
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

// ⭐⭐ `JAN-EXEC` Phase 7, package L — D13 (`REG-D-135` (3); design D13): a reply that faults nothing and leaves a declared
// criterion without a row draws ONE criterion repair whose line names that criterion — so its prompt depends on the reply before
// it, and no one per-case hash is today's. ⛔ Held to I5's hash alone, such an evaluation under today's fingerprint read as a
// prompt that moved though the fingerprint did not (limb 2), and its case as unmeasured (limb 1): the paid re-qualification would
// be refused for the reviewer's own repair.
describe('⭐⭐ package L — D13: a run whose evaluation drew the missing-criterion repair is reproduced, its repair held to the prompt today’s reviewer sends after the reply it followed', () => {
	/** `caseId`'s oracle reply with its LAST criterion's row filed under an id the policy does not declare (run-12's shape). */
	const slipped = (caseId: string): string => {
		const j = JSON.parse(asOracle(caseId)) as { findings: { criterionId: string }[] };
		j.findings.at(-1)!.criterionId = `${j.findings.at(-1)!.criterionId}-scope`;
		return JSON.stringify(j);
	};
	const sliceOf = async (runId: string) => {
		let cleanCalls = 0;
		const lines = await recorded({ runId, reply: (id) => (id === 'G-CLEAN' && cleanCalls++ === 0 ? slipped(id) : asOracle(id)) });
		const calls = lines.filter((l): l is CallLine => l.kind === 'CALL' && l.caseId === 'G-CLEAN');
		expect(calls.map((c) => c.role), 'the arrangement: G-CLEAN drew the missing-criterion repair').toEqual(['initial', 'criterion-repair']);
		return lines;
	};

	it('⭐ GREEN — covered and reproduced: the repair’s recorded prompt is the one today’s reviewer sends after the recorded first reply', async () => {
		expect((await check([file(await sliceOf('qr-d13-1'))])).problems).toEqual([]);
	});

	it('⛔ its hash tampered, the run is a non-reproduction — the rule holds the prompt, it does not wave a criterion repair through', async () => {
		const lines = tamper(await sliceOf('qr-d13-2'), 'G-CLEAN', (c) => (c.role === 'criterion-repair' ? { ...c, promptSha256: HEX('d') } : c));
		expect(limb(await check([file(lines)]), 'REPRODUCTION')).toContain(
			'G-CLEAN#1 criterion-repair — the prompt it recorded is not the one today’s reviewer sends'
		);
	});

	it('⭑ CONTROL — without today’s rule (a spread copy of the fingerprint carries none), the same run reads as a prompt that moved: the rule is what admits it', async () => {
		const lines = await sliceOf('qr-d13-3');
		expect(limb(await check([file(lines)], { current: { ...FP } }), 'REPRODUCTION')).toContain(
			'G-CLEAN#1 criterion-repair — the prompt it recorded is not the one today’s reviewer sends'
		);
	});
});

// ⭐⭐ B8a (`REG-D-127`) — A RESTATEMENT AWAITING THE SPONSOR'S CONFIRMATION IS A CONFERRAL PROBLEM OF ITS OWN: the verdicts are
// recorded conferred, and the confirmation of the restated cases is owed. ⛔ `ORACLES_NOT_CONFERRED`'s words would say the
// sponsor never conferred them.
describe('⭐⭐ B8a (REG-D-127) — the CONFERRAL limb: a restatement awaiting the sponsor’s confirmation', () => {
	const RESTATED = `${V1_CONFERRAL} The fixture’s planted case is ${ORACLES_RESTATEMENT_UNCONFIRMED}.`;

	it('⛔ RED FIRST — a covered, reproduced record whose oracle file records a restatement awaiting confirmation is RED on that alone, its message the confirmation owed, never that the verdicts were not conferred', async () => {
		const r = await check([file(await recorded({ runId: 'qr-good-restated' }))], { conferral: RESTATED });
		expect(r.problems).toEqual([{ limb: 'CONFERRAL', message: RESTATEMENT_NOT_CONFIRMED }]);
		expect(RESTATEMENT_NOT_CONFIRMED, 'the confirmation owed').toContain('owed: the sponsor’s confirmation of the restated cases');
		expect(RESTATEMENT_NOT_CONFIRMED, 'the verdicts recorded conferred').toContain('records verdicts the sponsor conferred');
		expect(RESTATEMENT_NOT_CONFIRMED, 'never a missing conferral').not.toContain('records no conferral');
	});

	it('⭑ CONTROLS — a statement carrying both markers owes both; one carrying neither owes nothing', async () => {
		const lines = await recorded({ runId: 'qr-good-both' });
		expect((await check([file(lines)], { conferral: `${RESTATED} Another is ${ORACLES_PROPOSED}.` })).problems).toEqual([
			{ limb: 'CONFERRAL', message: ORACLES_NOT_CONFERRED },
			{ limb: 'CONFERRAL', message: RESTATEMENT_NOT_CONFIRMED }
		]);
		expect((await check([file(lines)])).problems).toEqual([]);
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

	// ⭐⭐ `JAN-EXEC` Phase 7 P5, package A (F2) — a reply the tool cut at the model's output-token limit is read as a transport
	// failure is: MEASURED, never re-scored, a Boundedness failure — its line its own class (`OUTPUT_LIMIT`).
	it('⭐ P5 A — a reply cut at the output-token limit counts as MEASURED, is never re-scored, and is escalated as a Boundedness failure', async () => {
		const cut = new OutputLimitReached('devin invocation failed: (fixture)', {
			facts: { outputTokens: 25_000 },
			partialReply: '',
			observedToolCalls: { canObserve: false, reason: 'The devin adapter cannot observe tool calls (fixture).' }
		});
		const lines = await recorded({ runId: 'qr-cut-1', reply: (id) => (id === 'G-CLEAN-R1' ? cut : asOracle(id)) });
		expect(
			lines.flatMap((l) => (l.kind === 'CALL' && l.caseId === 'G-CLEAN-R1' ? [l.reply.status] : [])),
			'arrangement: the cut call is recorded as its own class'
		).toEqual(['OUTPUT_LIMIT']);
		const r = await check([file(lines)]);
		expect(limb(r, 'COVERAGE')).toBe('');
		// ⛔ THE MUTANT: the cut read as an answered evaluation — re-scored (it cannot be), and its verdict charged as wrong.
		expect(limb(r, 'REPRODUCTION'), 'the check tried to re-score a cut reply').toBe('');
		expect(limb(r, 'ESCALATION')).toContain('G-CLEAN-R1 — BOUNDEDNESS');
		expect(limb(r, 'ESCALATION')).not.toContain('CLEAN_NOT_SATISFIED');
	});

	// ⭐ `JAN-EXEC` Phase 7 P5, package C (F4; package A's check, finding 5) — and `rescoreEvaluation`, asked to re-score one,
	// refuses it by its own class, before any replay: ⛔ it named only a transport failure, so a cut evaluation failed later,
	// inside the replay, in its words ("the replay failed — …"), not as the call that left nothing to replay.
	it('⛔ P5 C — rescoreEvaluation refuses a cut evaluation at once, as a call that left nothing to replay, naming the cut', async () => {
		const cut = new OutputLimitReached('devin invocation failed: (fixture)', {
			facts: { outputTokens: 25_000 },
			partialReply: '',
			observedToolCalls: { canObserve: false, reason: 'The devin adapter cannot observe tool calls (fixture).' }
		});
		const lines = await recorded({ runId: 'qr-cut-2', reply: (id) => (id === 'G-CLEAN-R1' ? cut : asOracle(id)) });
		const calls = lines.filter((l): l is CallLine => l.kind === 'CALL' && l.caseId === 'G-CLEAN-R1');
		expect(calls.map((c) => [c.role, c.reply.status]), 'arrangement: one call, cut').toEqual([['initial', 'OUTPUT_LIMIT']]);
		const refused = await rescoreEvaluation(
			lines.find((l): l is RunLine => l.kind === 'RUN')!,
			SUBSET.find((c) => c.id === 'G-CLEAN-R1')!,
			calls,
			FP.scoring
		).catch((e: unknown) => e);
		expect(String(refused), 'a cut evaluation was refused by another rule').toBe(
			'NotRescorable: its initial call returned nothing to replay (cut at the model’s output-token limit)'
		);
		// ⭑ CONTROL — a transport failure is still refused as one: the cut's words are the cut's alone.
		const timedOut = await recorded({ runId: 'qr-timeout-2', reply: (id) => (id === 'G-CLEAN-R1' ? new Error('the bound') : asOracle(id)) });
		const failed = await rescoreEvaluation(
			timedOut.find((l): l is RunLine => l.kind === 'RUN')!,
			SUBSET.find((c) => c.id === 'G-CLEAN-R1')!,
			timedOut.filter((l): l is CallLine => l.kind === 'CALL' && l.caseId === 'G-CLEAN-R1'),
			FP.scoring
		).catch((e: unknown) => e);
		expect(String(failed), 'a transport failure was named a cut').toBe(
			'NotRescorable: its initial call returned nothing to replay (a transport failure)'
		);
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
			FP.casePrompts,
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
		// ⚠ `JAN-ESCREC` ER-2 (the ER-2 fix round's re-verifier's finding [0]) — `rescoredLines` no longer writes such a line:
		// it asks limb 2's first question too (`promptsAreToday`). So the lines are written while G-RR-04's recorded prompt
		// was still today's, and its prompt changes after.
		const ran = await recorded({ runId: 'qr-sc-3', fingerprint: moved('scoring') });
		const rescored = await restamp(ran, 'rs-sc-3');
		const old = tamper(ran, 'G-RR-04', (c) => ({
			...c,
			promptSha256: HEX('d')
		}));
		const lines = [...old, ...rescored];
		const r = await check([file(lines)]);
		expect(limb(r, 'REPRODUCTION')).toContain(
			'RESCORED rs-sc-3: G-RR-04#1 — re-stamps an evaluation whose prompt has changed since run qr-sc-3'
		);
		expect(limb(r, 'COVERAGE')).toContain('1 of 3 current case(s) are not MEASURED');
		// ⭐ `JAN-PRQUAL` `PQ-1` (design D6; `REG-D-093`'s owed pin `ER2-V102`, the ER-2 fix round 2's re-verifier's finding
		// [1]) — AND THE RECORD LIMB SAYS SO TOO, NAMING THE CAUSE. The writer never yields such a line, so it is one too many
		// — a RECORD problem whatever a SUPERSEDED line later does to limb 2's refusal. Its text said ~~"today’s path cannot
		// re-score it"~~, false here: today's path re-scores it (driven, `REJECTED`); limb 2 refuses it for its prompt first.
		const line = rescored.find((l) => l.caseId === 'G-RR-04')!;
		expect(limb(r, 'RECORD')).toBe(
			`runs.ndjson:${lines.indexOf(line) + 1}: RESCORED rs-sc-3 re-stamps G-RR-04#1 of run qr-sc-3, which a re-scoring of that run does not (\`rescoredLines\`) — its recorded prompt is not the one today’s reviewer sends: a model call is owed, not a re-scoring`
		);
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

// ── ⭐ `JAN-ESCREC` ER-2 — a RESCORED record re-stamps the WHOLE of its source run (the ER-2 verifier's finding [1]) ──────
// Unlike a run, a re-scoring is derivable from what its source recorded, so the check demands it whole: every evaluation
// `rescoredLines` yields — `restampable` (`record.ts`, the ONE predicate the writer and the check both read) and
// re-scorable today, as limb 2 decides it — and no other of a current case. Before, coverage asked per case, limb 2
// re-scored the lines present and limb 3 read the outcomes present, so a record that left out one repetition — the one
// carrying its material failure among them — was GREEN.
describe('JAN-ESCREC ER-2 — a RESCORED record re-stamps the WHOLE of its source run: an evaluation left out, or one too many, is a RECORD problem naming it', () => {
	const restamp = (lines: readonly RecordLine[], rescoreId: string, at: RunFingerprint = CURRENT, cases = SUBSET) =>
		rescoredLines(
			lines.find((l): l is RunLine => l.kind === 'RUN')!,
			lines.filter((l): l is CallLine => l.kind === 'CALL'),
			cases,
			FP.casePrompts,
			{ rescoreId, date: '2026-10-02T09:00:00.000Z', commit: 'a'.repeat(40), reviewer: at.reviewer, scoring: at.scoring, caseSet: at.caseSet }
		);
	/** A run under an earlier fingerprint — only the scoring moved — in two repetitions, whose renamed copy G-CLEAN-R1 is
	 *  rejected in its first alone: one material failure, as on the committed record's source run (`REG-F-456`). */
	const twice = (runId: string) => {
		const asked = new Map<string, number>();
		return recorded({
			runId,
			fingerprint: moved('scoring'),
			repetitions: 2,
			reply: (id) => {
				const k = asked.get(id) ?? 0;
				asked.set(id, k + 1);
				return id === 'G-CLEAN-R1' && k === 0 ? judgement([SEEDED_REASONING_REVIEW_CRITERIA[5]!.id]) : asOracle(id);
			}
		});
	};
	const label = (l: RescoredLine) => `${l.caseId}#${l.repetition}`;
	const ALL_SIX = ['G-CLEAN#1', 'G-CLEAN#2', 'G-CLEAN-R1#1', 'G-CLEAN-R1#2', 'G-RR-04#1', 'G-RR-04#2'];
	/** Where the check places a line of a one-file record. */
	const at = (lines: readonly RecordLine[], line: RecordLine) => `runs.ndjson:${lines.indexOf(line) + 1}`;
	/**
	 * The RECORD problem for an evaluation a RESCORED record leaves out, verbatim — placed at the record's first line.
	 * ⭐ P5 package C (F4) — ~~"not cut at the transport"~~: nor cut by the tool at the model's output-token limit, the class
	 * the check reads alike (`noReplyToScore`).
	 */
	const leftOut = (lines: readonly RecordLine[], rescoreId: string, evaluation: string, runId: string) =>
		`${at(lines, lines.find((l) => l.kind === 'RESCORED' && l.rescoreId === rescoreId)!)}: RESCORED ${rescoreId} leaves out ${evaluation} of run ${runId}, which a re-scoring of that run re-stamps (\`rescoredLines\`) — complete, cut neither at the transport nor at the model’s output-token limit, of a current case and re-scorable today: a RESCORED record re-stamps the whole of its source run, or what it covers and escalates rests on the repetitions it kept`;
	/** The RECORD problem for a line re-stamping an evaluation a re-scoring does not yield, verbatim. */
	const tooMany = (lines: readonly RecordLine[], line: RescoredLine) =>
		`${at(lines, line)}: RESCORED ${line.rescoreId} re-stamps ${label(line)} of run ${line.sourceRunId}, which a re-scoring of that run does not (\`rescoredLines\`) — today’s path cannot re-score it`;

	it('⭐ CONTROL — the whole re-scoring, its material failure escalated, is GREEN; the arrangement: one repetition carries the re-scored record’s own material failure', async () => {
		const old = await twice('qr-whole-1');
		const rescored = await restamp(old, 'rs-whole-1');
		expect(rescored.map(label).sort(), 'every evaluation of the source run is re-stamped').toEqual(ALL_SIX);
		expect(
			['G-CLEAN-R1#1', 'G-CLEAN-R1#2'].map((k) => rescored.find((l) => label(l) === k)!.scored.disposition),
			'the arrangement: G-CLEAN-R1 rejected in its first repetition alone'
		).toEqual(['REJECTED', 'SATISFIED']);
		const source = escalate('qr-whole-1', ['G-CLEAN-R1']);
		expect(limb(await check([file([...old, source, ...rescored])]), 'ESCALATION'), 'the arrangement: the re-scored record owes its own ESCALATION').toBe(
			'RESCORED rs-whole-1: G-CLEAN-R1 — CLEAN_NOT_SATISFIED, VERDICT_CHANGES_WITH_NAME — no ESCALATION line cites a register finding for it (§5.6 limb 3)'
		);
		expect((await check([file([...old, source, ...rescored, escalate('rs-whole-1', ['G-CLEAN-R1'])])])).problems).toEqual([]);
	});

	it('⛔ a RESCORED record that leaves out ONE evaluation of its source run is refused, naming it — whichever one it is, though the case is still covered by its other repetition', async () => {
		const old = await twice('qr-whole-2');
		const rescored = await restamp(old, 'rs-whole-2');
		const cited = [escalate('qr-whole-2', ['G-CLEAN-R1']), escalate('rs-whole-2', ['G-CLEAN-R1'])];
		expect(rescored.map(label).sort(), 'the arrangement: six evaluations, three cases in two repetitions').toEqual(ALL_SIX);
		for (const gone of rescored) {
			const lines = [...old, ...rescored.filter((l) => l !== gone), ...cited];
			expect((await check([file(lines)])).problems, `${label(gone)} left out`).toEqual([
				{ limb: 'RECORD', message: leftOut(lines, 'rs-whole-2', label(gone), 'qr-whole-2') }
			]);
		}
	});

	it('⛔ THE CHERRY-PICK (the ER-2 verifier’s `cherry.ts`) — the repetition carrying the re-scored record’s material failure left out, WITH the ESCALATION line that cited it, is refused: it was GREEN', async () => {
		const old = await twice('qr-whole-3');
		const rescored = await restamp(old, 'rs-whole-3');
		const failing = rescored.find((l) => label(l) === 'G-CLEAN-R1#1')!;
		expect(failing.scored.disposition, 'the arrangement: the repetition left out is the one rejected').toBe('REJECTED');
		const lines = [...old, escalate('qr-whole-3', ['G-CLEAN-R1']), ...rescored.filter((l) => l !== failing)];
		expect((await check([file(lines)])).problems).toEqual([
			{ limb: 'RECORD', message: leftOut(lines, 'rs-whole-3', 'G-CLEAN-R1#1', 'qr-whole-3') }
		]);
	});

	it('⛔ ONE RESCORE ID OVER TWO SOURCE RUNS (the ER-2 fix round’s re-verifier’s finding [1], `ER2-V51`) — another run’s line for the repetition left out does not stand in for it: each source run is asked whole', async () => {
		const first = await twice('qr-whole-10');
		const second = await recorded({ runId: 'qr-whole-10b', fingerprint: moved('scoring'), repetitions: 2 });
		const own = await restamp(first, 'rs-whole-10');
		const failing = own.find((l) => label(l) === 'G-CLEAN-R1#1')!;
		const standIn = (await restamp(second, 'rs-whole-10')).find((l) => label(l) === 'G-CLEAN-R1#1')!;
		expect(
			[failing.scored.disposition, standIn.scored.disposition],
			'the arrangement: the first run’s repetition is the one rejected, the other run’s is not'
		).toEqual(['REJECTED', 'SATISFIED']);
		const lines = [...first, escalate('qr-whole-10', ['G-CLEAN-R1']), ...second, ...own.filter((l) => l !== failing), standIn];
		const r = await check([file(lines)]);
		expect(r.problems, 'the first run’s left-out repetition is named').toContainEqual({
			limb: 'RECORD',
			message: leftOut(lines, 'rs-whole-10', 'G-CLEAN-R1#1', 'qr-whole-10')
		});
		expect(
			r.problems.filter((p) => p.message.includes(' of run qr-whole-10,')).map((p) => p.message),
			'and nothing else of the first run'
		).toEqual([leftOut(lines, 'rs-whole-10', 'G-CLEAN-R1#1', 'qr-whole-10')]);
		expect(
			r.problems
				.filter((p) => p.message.includes(' of run qr-whole-10b,'))
				.map((p) => /leaves out (\S+) of run/.exec(p.message)?.[1])
				.sort(),
			'and the other run, asked whole too, is owed the five evaluations it was not re-stamped for'
		).toEqual(ALL_SIX.filter((k) => k !== 'G-CLEAN-R1#1'));
		expect([...new Set(r.problems.map((p) => p.limb))], 'RECORD problems alone').toEqual(['RECORD']);
	});

	it('⭐ re-scorability is decided as limb 2 decides it — an evaluation today’s path cannot re-score is owed no line, and a line re-stamping one is one too many', async () => {
		const old = await twice('qr-whole-4');
		const rescored = await restamp(old, 'rs-whole-4');
		const cited = [escalate('qr-whole-4', ['G-CLEAN-R1']), escalate('rs-whole-4', ['G-CLEAN-R1'])];
		// A re-scorer that refuses G-RR-04's second repetition, as `rescoreEvaluation` refuses one whose first parse today's
		// path decides otherwise than the run did.
		const refusing: CheckInputs['rescore'] = (run, c, calls, digest) =>
			c.id === 'G-RR-04' && calls[0]!.repetition === 2
				? Promise.reject(new Error('today’s path makes 2 call(s) where the run made 1'))
				: rescoreEvaluation(run, c, calls, digest);
		const unrescorable = rescored.find((l) => label(l) === 'G-RR-04#2')!;
		const without = [...old, ...rescored.filter((l) => l !== unrescorable), ...cited];
		expect((await check([file(without)], { rescore: refusing })).problems, 'left out, it is owed nothing').toEqual([]);
		const whole = [...old, ...rescored, ...cited];
		const r = await check([file(whole)], { rescore: refusing });
		expect(limb(r, 'RECORD')).toBe(tooMany(whole, unrescorable));
		expect(limb(r, 'REPRODUCTION'), 'and limb 2 says why').toContain(
			'RESCORED rs-whole-4: G-RR-04#2 — cannot be re-scored: today’s path makes 2 call(s) where the run made 1'
		);
	});

	// ⭐ `JAN-PRQUAL` `PQ-1` (design D6; `REG-D-093`'s owed pin `ER2-V104`, the ER-2 fix round 2's re-verifier's finding [2])
	// — COMPLETED BY APPENDING, PINNED. Ruled on the ER-2 fix round's re-verifier's finding [6]: the record is append-only,
	// so a RESCORED record that left an owed evaluation out is completed by APPENDING that line under the same rescore id —
	// later in the record, on a later date — and the lines are grouped by rescore id and source run wherever they stand.
	// The ruling built no refusal; the path it permits had no pin (a grouping that took the date too survived all of verif).
	it('⭐ COMPLETED BY APPENDING — a RESCORED record that left one evaluation out is RED, and GREEN once the owed line is appended LAST, on a later date, under the same rescore id', async () => {
		const old = await twice('qr-whole-12');
		const rescored = await restamp(old, 'rs-whole-12');
		const cited = [escalate('qr-whole-12', ['G-CLEAN-R1']), escalate('rs-whole-12', ['G-CLEAN-R1'])];
		const gone = rescored.find((l) => label(l) === 'G-RR-04#2')!;
		const first = [...old, ...rescored.filter((l) => l !== gone), ...cited];
		expect((await check([file(first)])).problems, 'left out, it is owed').toEqual([
			{ limb: 'RECORD', message: leftOut(first, 'rs-whole-12', 'G-RR-04#2', 'qr-whole-12') }
		]);
		const appended: RescoredLine = { ...gone, date: '2026-10-09T09:00:00.000Z' };
		expect(appended.date > gone.date, 'the arrangement: the owed line is written later').toBe(true);
		expect((await check([file([...first, appended])])).problems, 'appended last, it completes the record').toEqual([]);
	});

	// ⭐ `JAN-PRQUAL` `PQ-1` (design D6; `REG-D-093`'s owed pins `ER2-V100` and `ER2-V101`, the ER-2 fix round 2's
	// re-verifier's finding [0]) — A REPAIRED, TWO-CALL EVALUATION UNDER THE PROMPT PREDICATE. `promptsAreToday` asks EVERY
	// call of an evaluation, each against today's prompt for ITS role (initial or repair) — the one predicate limb 2's first
	// question, limb 1's coverage and the writer read. No arrangement held a repaired evaluation, so neither the quantifier
	// nor the role was pinned: both mutants survived all of verif. The committed record holds two (the ollama run's
	// W-CLEAN-R3), so a reading of either that went wrong would mis-stamp a real record.
	/** A run under an earlier fingerprint (only the scoring moved) whose G-CLEAN reply fails the first parse: the validator
	 *  sends its repair prompt, and the evaluation records two calls. */
	const repaired = (runId: string) => {
		const asked = new Map<string, number>();
		return recorded({
			runId,
			fingerprint: moved('scoring'),
			reply: (id) => {
				const k = asked.get(id) ?? 0;
				asked.set(id, k + 1);
				return id === 'G-CLEAN' && k === 0 ? 'I could not decide whether the draft discharges its obligation.' : asOracle(id);
			}
		});
	};

	it('⭐ a REPAIRED evaluation, its initial AND its repair prompt today’s, is re-stamped by the writer and covers its case — GREEN', async () => {
		const old = await repaired('qr-repaired-1');
		const calls = old.filter((l): l is CallLine => l.kind === 'CALL' && l.caseId === 'G-CLEAN');
		expect(calls.map((c) => c.role), 'the arrangement: G-CLEAN drew a repair').toEqual(['initial', 'repair']);
		expect(
			calls.map((c) => c.promptSha256),
			'the arrangement: each call recorded today’s prompt for ITS role'
		).toEqual([FP.casePrompts.get('G-CLEAN')!.initial, FP.casePrompts.get('G-CLEAN')!.repair]);
		const rescored = await restamp(old, 'rs-repaired-1');
		expect(rescored.map(label).sort(), 'the writer re-stamps the repaired evaluation').toEqual([
			'G-CLEAN#1',
			'G-CLEAN-R1#1',
			'G-RR-04#1'
		]);
		expect((await check([file([...old, ...rescored])])).problems).toEqual([]);
	});

	it('⛔ a REPAIRED evaluation whose REPAIR prompt ALONE changed is owed a model call — the writer leaves it out, the check owes it no line, and its case is not covered', async () => {
		const old = (await repaired('qr-repaired-2')).map((l) =>
			l.kind === 'CALL' && l.caseId === 'G-CLEAN' && l.role === 'repair' ? { ...l, promptSha256: HEX('d') } : l
		);
		expect(
			old.filter((l): l is CallLine => l.kind === 'CALL' && l.caseId === 'G-CLEAN').map((c) => c.promptSha256),
			'the arrangement: the initial prompt still today’s, the repair prompt not'
		).toEqual([FP.casePrompts.get('G-CLEAN')!.initial, HEX('d')]);
		const rescored = await restamp(old, 'rs-repaired-2');
		expect(rescored.map(label).sort(), 'the writer leaves it out').toEqual(['G-CLEAN-R1#1', 'G-RR-04#1']);
		const r = await check([file([...old, ...rescored])]);
		expect(limb(r, 'RECORD'), 'the check owes it no line').toBe('');
		expect(limb(r, 'COVERAGE'), 'its case is owed a RUN, and named').toBe(
			`1 of 3 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: G-CLEAN — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
		);
		expect([...new Set(r.problems.map((p) => p.limb))], 'and nothing else').toEqual(['COVERAGE']);
	});

	// ⭐ LIMB 2'S FIRST QUESTION, ON BOTH SIDES (the ER-2 fix round's re-verifier's finding [0]): limb 2 refuses to re-score
	// an evaluation whose recorded prompt is not today's — "a model call is owed, not a re-scoring" — so neither the writer
	// nor the check owes it a line, and the rest of its source run can still be re-stamped (`promptsAreToday`, a leg of
	// `restampable`). Before, the check owed it, and the only GREEN path was a paid re-run of every case.
	/** `twice`, with G-RR-04's recorded prompts no longer today's (the fingerprint unmoved but for the scoring). */
	const promptMoved = async (runId: string) =>
		tamper(await twice(runId), 'G-RR-04', (c) => ({ ...c, promptSha256: HEX('d') }));

	it('⭐ THE WRITER — `rescoredLines` over a source run one of whose cases’ prompt changed yields exactly the owed lines: every other evaluation, none of that case', async () => {
		const old = await promptMoved('qr-whole-9');
		expect(
			old.filter((l): l is CallLine => l.kind === 'CALL' && l.caseId === 'G-RR-04').map((c) => c.promptSha256),
			'the arrangement: both of G-RR-04’s evaluations recorded a prompt today’s reviewer does not send'
		).toEqual([HEX('d'), HEX('d')]);
		const rescored = await restamp(old, 'rs-whole-9');
		expect(rescored.map(label).sort()).toEqual(ALL_SIX.filter((k) => !k.startsWith('G-RR-04#')));
	});

	it('⭐ THE CHECK — the record re-stamping every OTHER evaluation of that run, plus the one-case RUN the changed case owes under today’s fingerprint, is GREEN; without that run the case is owed a RUN, and no line', async () => {
		const old = await promptMoved('qr-whole-9');
		// G-RR-04 is filtered out here too, so this half asks the check alone, whatever the writer yields.
		const rescored = (await restamp(old, 'rs-whole-9')).filter((l) => l.caseId !== 'G-RR-04');
		const cited = [escalate('qr-whole-9', ['G-CLEAN-R1']), escalate('rs-whole-9', ['G-CLEAN-R1'])];
		const owed = await check([file([...old, ...rescored, ...cited])]);
		expect(limb(owed, 'RECORD'), 'G-RR-04 is owed no line').toBe('');
		expect(limb(owed, 'COVERAGE'), 'its case is owed a RUN').toContain(
			'1 of 3 current case(s) are not MEASURED under today’s reviewer fingerprint'
		);
		expect(limb(owed, 'COVERAGE')).toContain('G-RR-04');
		const oneCase = await recorded({ runId: 'qr-whole-9-today', cases: SUBSET.filter((c) => c.id === 'G-RR-04') });
		expect((await check([file([...old, ...rescored, ...cited, ...oneCase])])).problems).toEqual([]);
	});

	it('⭐ by its OWN rule (`restampable`), whatever a re-scorer admits — an evaluation cut at the transport is owed no line (a line re-stamping one is refused), nor one of a case gone from today’s set (limb 2 never re-scores one)', async () => {
		// A re-scorer that admits whatever it is handed, at the outcome its last call recorded — so what the core owes by its
		// own rule shows apart from what a re-scorer refuses (`rescoreEvaluation` refuses both).
		const admitting: CheckInputs['rescore'] = async (_run, _c, calls, digest) => ({ ...calls.at(-1)!.scored!, scoringDigest: digest });
		const gone = CASES.find((c) => c.id === 'G-CLEAN-R2')!;
		const asked = new Map<string, number>();
		const old = await recorded({
			runId: 'qr-whole-5',
			fingerprint: moved('scoring'),
			cases: [...SUBSET, gone],
			repetitions: 2,
			reply: (id) => {
				const k = asked.get(id) ?? 0;
				asked.set(id, k + 1);
				return id === 'G-CLEAN' && k === 1 ? new Error('the bound') : asOracle(id);
			}
		});
		const rescored = await restamp(old, 'rs-whole-5');
		expect(rescored.map(label).sort(), 'the arrangement: neither G-CLEAN#2, cut, nor G-CLEAN-R2, gone, is re-stamped').toEqual(
			ALL_SIX.filter((k) => k !== 'G-CLEAN#2')
		);
		const lines = [...old, escalate('qr-whole-5', ['G-CLEAN']), ...rescored];
		expect((await check([file(lines)], { rescore: admitting })).problems).toEqual([]);
		// ⭐ (the ER-2 fix round's re-verifier's finding [2], `ER2-V50`) — NOR IS A LINE OF THE GONE CASE ONE TOO MANY, written
		// with the set that still held it: limb 2 never re-scores it, so no SUPERSEDED line could ever strike the record.
		const held = (await restamp(old, 'rs-whole-5', CURRENT, [...SUBSET, gone])).filter((l) => l.caseId === gone.id);
		expect(held.map(label).sort(), 'the arrangement: G-CLEAN-R2 re-stamped with the set that held it').toEqual([
			'G-CLEAN-R2#1',
			'G-CLEAN-R2#2'
		]);
		expect((await check([file([...lines, ...held])], { rescore: admitting })).problems).toEqual([]);
	});

	it('⭐ CONTROL — the writer and the check AGREE where the REAL path refuses (the ER-2 fix round’s re-verifier’s finding [3], `ER2-V52`): an evaluation `rescoreEvaluation` cannot re-score is left out by `rescoredLines`, every one after it is still re-stamped, and the check owes it nothing', async () => {
		const ran = await recorded({ runId: 'qr-whole-11', fingerprint: moved('scoring'), repetitions: 2 });
		// G-CLEAN#1's initial reply recorded as a span the parse rejects: today's path asks for a repair the run never made.
		const refused = ran.map((l) =>
			l.kind === 'CALL' && l.caseId === 'G-CLEAN' && l.repetition === 1
				? { ...l, reply: { status: 'NOT_RETAINED' as const, spanSha256: HEX('c') } }
				: l
		);
		const calls = refused.filter((l): l is CallLine => l.kind === 'CALL');
		expect(`${calls[0]!.caseId}#${calls[0]!.repetition}`, 'the arrangement: the refused evaluation is the run’s first').toBe(
			'G-CLEAN#1'
		);
		await expect(
			rescoreEvaluation(
				refused.find((l): l is RunLine => l.kind === 'RUN')!,
				SUBSET.find((c) => c.id === 'G-CLEAN')!,
				calls.filter((c) => c.caseId === 'G-CLEAN' && c.repetition === 1),
				FP.scoring
			),
			'the arrangement: the REAL path refuses it'
		).rejects.toThrow("today's path asks for a repair the run never made");
		const rescored = await restamp(refused, 'rs-whole-11');
		expect(rescored.map(label).sort(), 'the writer: the evaluations, less the one refused').toEqual(
			ALL_SIX.filter((k) => k !== 'G-CLEAN#1')
		);
		const r = await check([file([...refused, ...rescored])]);
		expect(limb(r, 'RECORD'), 'the check, through the same real path, owes it nothing').toBe('');
		expect(r.problems).toEqual([]);
	});

	// ⭐ ONLY A RECORD LIMB 2 READS IS ASKED, AND ONLY WHILE IT COUNTS. Each fixture leaves out G-RR-04#2 beside a run under
	// today's fingerprint that covers every case, so the left-out line would be the only problem if it were asked.
	it('⭐ a RESCORED record under an EARLIER fingerprint is not asked — whether its evaluations were re-scorable was its own day’s path’s question, which today’s cannot replay', async () => {
		const old = await twice('qr-whole-6');
		const earlier = reviewerFingerprintOf({ ...FP.components, scoring: HEX('d') });
		const then = (await restamp(old, 'rs-whole-6', { reviewer: earlier, scoring: HEX('d'), caseSet: FP.caseSet })).filter(
			(l) => label(l) !== 'G-RR-04#2'
		);
		const lines = [...old, escalate('qr-whole-6', ['G-CLEAN-R1']), ...then, escalate('rs-whole-6', ['G-CLEAN-R1']), ...(await recorded({ runId: 'qr-whole-6-today' }))];
		expect((await check([file(lines)])).problems).toEqual([]);
	});

	it('⭐ a RESCORED record REFUSED for its stamp is not asked — refused, it counts for nothing, and its one RECORD problem is the stamp', async () => {
		const old = await twice('qr-whole-7');
		const forged = (await restamp(old, 'rs-whole-7', { reviewer: FP.reviewer, scoring: HEX('d'), caseSet: FP.caseSet })).filter(
			(l) => label(l) !== 'G-RR-04#2'
		);
		const lines = [...old, escalate('qr-whole-7', ['G-CLEAN-R1']), ...forged, escalate('rs-whole-7', ['G-CLEAN-R1']), ...(await recorded({ runId: 'qr-whole-7-today' }))];
		expect(limb(await check([file(lines)]), 'RECORD')).toBe(
			`${at(lines, forged[0]!)}: RESCORED rs-whole-7 carries today’s reviewer fingerprint ${FP.reviewer} but scoring digest ${HEX('d')}, not today’s ${FP.scoring} — the fingerprint hashes the scoring digest, so nothing this tree records can carry both; it counts for nothing`
		);
	});

	it('⭐ a RESCORED record STRUCK by a SUPERSEDED line is not asked — struck, it counts for nothing', async () => {
		const old = await twice('qr-whole-8');
		// Under today's fingerprint, G-CLEAN#1 recorded with RR-01 unjudged — an outcome today's path does not re-score to —
		// so the SUPERSEDED line naming the record strikes it.
		const bad = (await restamp(old, 'rs-whole-8'))
			.filter((l) => label(l) !== 'G-RR-04#2')
			.map((l) =>
				label(l) === 'G-CLEAN#1'
					? { ...l, scored: { ...l.scored, criteria: l.scored.criteria.map(([k, o]) => [k, k.startsWith('RR-01') ? 'UNABLE_TO_DETERMINE' : o] as const) } }
					: l
			);
		const today = await recorded({ runId: 'qr-whole-8-today' });
		const lines = [...old, escalate('qr-whole-8', ['G-CLEAN-R1']), ...bad, escalate('rs-whole-8', ['G-CLEAN-R1']), supersede('rs-whole-8'), ...today];
		expect((await check([file(lines)])).problems).toEqual([]);
		const unstruck = lines.filter((l) => l.kind !== 'SUPERSEDED');
		expect(limb(await check([file(unstruck)]), 'REPRODUCTION'), 'CONTROL: not struck, it fails limb 2').toContain(
			'RESCORED rs-whole-8: G-CLEAN#1 — re-scored through today’s path it is'
		);
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
				// ⭐⭐ D3c (`REG-D-132`) — ~~'ACKNOWLEDGED adds G-NEW, which today’s case set does not hold'~~: held to every
				// committed case set, today's included, and refused still, as no committed version holds it.
				'ACKNOWLEDGED adds G-NEW, which no committed case set holds — today’s or any earlier version’s'
			],
			['a record file that is not a record', [file(run), { name: 'broken.ndjson', text: '{"kind":"NOTE"}\n' }], 'broken.ndjson: line 1: kind "NOTE" is not one of']
		];
		for (const [label, files, message] of cases) expect(limb(await check(files), 'RECORD'), label).toContain(message);
	});
});

// ── ⭐⭐ D3c, an ACKNOWLEDGED line judged against its own case set (`REG-D-132`; `REG-F-576`; DESIGN-authoring-review-in-parts.md
// D3c) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// An ACKNOWLEDGED line carries a date, a reviewer fingerprint and `addedCaseIds` or a reason, and no case set (`record.ts`). The
// check held its ids to TODAY's case set, whatever set it was written under — so renaming or retiring a case once acknowledged
// became a RECORD problem for ever: D3b (8)'s renaming of the 19 bridge part cases reads the record's lines 1013 and 1182, which
// acknowledge version eight's and nine's 35 part cases, as 38 of them. D3c: ONE committed case set — some version's committed
// JSON, today's included — must hold the line's whole list; an id no committed version holds is refused still; and ids collected
// across versions, none holding them all, are no one case set.
const D3C_UNHELD = (at: string, id: string) =>
	`${at}: ACKNOWLEDGED adds ${id}, which no committed case set holds — today’s or any earlier version’s`;
/** The 19 bridge part cases under version nine's ids, which D3b (8) renamed: in version nine's order, no case of today's set. */
const D3C_RENAMED = (): string[] =>
	V9_CASES.filter((c) => c.arm === 'PWA_TYPE' && !CURRENT_CASES.some((now) => now.id === c.id)).map((c) => c.id);
describe('⭐⭐ D3c (REG-D-132; REG-F-576) — an ACKNOWLEDGED line is judged against its own case set: one committed case set, today’s included, must hold all its addedCaseIds; an id none holds is refused still', () => {
	const RENAMED = D3C_RENAMED;
	/** The committed record's first 1182 lines — history, which an append-only record never moves (§5.4). */
	const HISTORY_TO = 1182;
	const history = () => {
		const rows = readFileSync(`${REPO}/${RECORD_DIR}/runs.ndjson`, 'utf8').split('\n');
		return { name: 'runs.ndjson', text: `${rows.slice(0, HISTORY_TO).join('\n')}\n` };
	};
	/** An ACKNOWLEDGED line adding `ids`. */
	const ack = (ids: readonly string[]): RecordLine => ({
		kind: 'ACKNOWLEDGED',
		date: '2026-10-25T09:00:00.000Z',
		reviewerFingerprint: FP.reviewer,
		addedCaseIds: [...ids]
	});
	/** The versions whose committed case set holds `id`. */
	const holders = (id: string): number[] => CASE_SETS.filter((s) => s.caseIds.includes(id)).map((s) => s.caseSetVersion);

	it('⛔ RED FIRST — the committed history to line 1182, under ~~version ten~~ ⭐ today’s set (~~version eleven since package K~~ ⭐ version twelve since package V), the 19 renamed: lines 1013 and 1182 acknowledge version eight’s and version nine’s 35 part cases, 19 of each no case of today’s set, and each list is held whole by one committed case set, so the check finds NO RECORD problem in the history, where it found 38. CONTROL: handed today’s set alone, it reads each of the 38 as an id no committed case set holds', async () => {
		const h = history();
		const rows = h.text
			.slice(0, -1)
			.split('\n')
			.map((r) => JSON.parse(r) as RecordLine);
		expect(rows, 'arrangement: the history’s lines').toHaveLength(HISTORY_TO);
		const acks = rows.flatMap((l, n) => (l.kind === 'ACKNOWLEDGED' && l.addedCaseIds !== undefined ? [[n + 1, l.addedCaseIds] as const] : []));
		expect(acks.map(([n]) => n), 'arrangement: the ACKNOWLEDGED lines that name cases (REG-F-576)').toEqual([1013, 1182]);
		const parts = (set: readonly QualificationCase[]) => set.filter((c) => c.arm === 'PWA_TYPE').map((c) => c.id);
		expect(acks.map(([, ids]) => ids), 'arrangement: version eight’s 35 part cases, then version nine’s').toEqual([parts(V8_CASES), parts(V9_CASES)]);
		expect(RENAMED(), 'arrangement: the 19 renamed, as G3-CLEAN.T01 to G3-RR-09.T01').toHaveLength(19);
		expect(
			acks.map(([, ids]) => ids.filter((id) => !CURRENT_CASES.some((c) => c.id === id))),
			'arrangement: of each, the 19 today’s set no longer holds'
		).toEqual([RENAMED(), RENAMED()]);
		// Version nine carried version eight's 35 part cases under their ids (`REG-D-127`), so each of the two committed sets holds
		// each line's list whole — and version ten neither ⭐ (package K) nor version eleven, today's.
		// ⭐ Package V — ~~[8, 9, 10, 11]~~: and version twelve, today's.
		expect(acks.map(([, ids]) => [8, 9, 10, 11, 12].map((v) => ids.every((id) => holders(id).includes(v)))), 'arrangement: versions eight and nine each hold both lines’ lists whole; version ten neither, nor version eleven, nor version twelve').toEqual([
			[true, true, false, false, false],
			[true, true, false, false, false]
		]);
		const register = readFileSync(`${REPO}/${REGISTER_FILE}`, 'utf8');
		const { findings, struck } = registerFindings(register);
		const { rulings, struck: struckRulings } = registerRulings(register);
		const onHistory = (caseSets: CheckInputs['caseSets']) =>
			check([h], {
				current: FP_NOW,
				cases: CURRENT_CASES,
				oracles: CURRENT_ORACLES.oracles,
				conferral: CURRENT_ORACLES.conferral,
				caseSets,
				findings,
				struck,
				rulings,
				struckRulings
			});
		expect(limb(await onHistory(CASE_SETS), 'RECORD'), 'no RECORD problem in the history: each line’s ids are one committed case set’s').toBe('');
		// ⭑ CONTROL — handed today's set alone (no other committed set), the 38 are read as before D3c, each now saying no
		// committed case set holds it: it is the committed sets the CLI hands in that clear them.
		expect(limb(await onHistory([]), 'RECORD'), 'CONTROL: today’s set alone').toBe(
			[1013, 1182].flatMap((n) => RENAMED().map((id) => D3C_UNHELD(`runs.ndjson:${n}`, id))).join('\n')
		);
	}, 120_000);

	it('⭑ CONTROL — a line naming an id no committed version holds is refused still, the message saying so; an id today’s set holds beside it is not', async () => {
		const run = await recorded({ runId: 'qr-d3c-unheld' });
		expect(holders('G-NEW'), 'arrangement: no committed version holds G-NEW').toEqual([]);
		expect(holders('G-CLEAN'), 'arrangement: today’s set — the fixture’s — holds G-CLEAN').toContain(1);
		expect(limb(await check([file([...run, ack(['G-CLEAN', 'G-NEW'])])]), 'RECORD')).toBe(D3C_UNHELD(`runs.ndjson:${run.length + 1}`, 'G-NEW'));
	});

	it('⭑ CONTROL — a line whose ids are split across two versions, no one version holding them all, is refused: ids collected across versions are no one case set; each alone is accepted', async () => {
		const run = await recorded({ runId: 'qr-d3c-split' });
		expect([holders('G3-CLEAN.T01'), holders('G10-CLEAN.T01')], 'arrangement: versions eight and nine hold the one, version ten alone the other').toEqual([[8, 9], [10]]);
		expect(limb(await check([file([...run, ack(['G3-CLEAN.T01', 'G10-CLEAN.T01'])])]), 'RECORD')).toBe(
			`runs.ndjson:${run.length + 1}: ACKNOWLEDGED adds G3-CLEAN.T01, G10-CLEAN.T01, which no one committed case set holds together — each is held by some version, none by one alone, and an acknowledgement names one case set’s cases (design D3c)`
		);
		for (const id of ['G3-CLEAN.T01', 'G10-CLEAN.T01'])
			expect(limb(await check([file([...run, ack([id])])]), 'RECORD'), `${id} alone: one version holds it`).toBe('');
	});
});

// ── ⭐ `JAN-CRITREAD` J2-5 — version two became current (`REG-F-449`; `REG-D-078`) ───────────────────────────────────
// ⚠ `JAN-CRITREAD` J2-7: version two is no longer the current set, so this limb is driven over version two AS A FIXED
// FIXTURE — the set it was written about — exactly as the J2-3 limbs are driven over version one. Its assertions are
// unchanged; only the set it hands the core is named for what it is. The same claim for version three is the J2-7 limb
// below, over the current set.
// ⭐ `JAN-PRQUAL` `PQ-1` (design §3; roadmap PQ-1's guards) — THE MESSAGES THAT TELL HOW TO CLEAR A MOVE NOW SAY WHAT THE
// CODE DOES: ~~"or RESCORED lines where only the scoring moved"~~, ~~"RESCORED lines discharge those if only the scoring
// moved"~~ → "…where no case prompt changed (§5.6 limb 1)". A RESCORED line re-stamps an evaluation whose recorded prompts
// are today's (`restampable`, `promptsAreToday`) whatever else moved — the scoring, or the probe set alone, where the
// ACKNOWLEDGED line is owed besides (§5.6 limb 1). Each reworded message is pinned whole below, the selected candidate's
// with it (the SR-4 block's `owedBy`), and the hint in the SR-4 rows that print it.
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
			`12 of 26 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${CORRECTED.join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
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

// ── ⭐ `JAN-CRITREAD` J2-7 — case set version three (`REG-F-453`; `REG-D-081`), current from J2-7 to `JAN-PRQUAL` `PQ-2` ─
// ⚠ Since `PQ-2` a fixed fixture, as version two is: these limbs check records of versions one and two against version
// three, the set that was current when they were written; the current set's own limb follows (version four).
describe('JAN-CRITREAD J2-7 — under case set v3, the committed record’s shape — runs of v1 and of v2 — owes a run over exactly the twelve changed cases', () => {
	/** The changed cases — in version three under an id neither version one nor version two holds. Written here. */
	const CHANGED = [
		'G3-CLEAN',
		'G3-CLEAN-R1',
		'G3-CLEAN-R2',
		'G3-CLEAN-R3',
		...SEEDED_REASONING_REVIEW_CRITERIA.slice(1).map((k) => `G3-${k.id.slice(0, 5)}`)
	];
	const onVersionThree = (files: CheckInputs['files'], over: Partial<Omit<CheckInputs, 'files'>> = {}) =>
		check(files, { current: FP_V3, cases: V3_CASES, oracles: V3_ORACLES.oracles, ...over });

	it('⛔ runs of version one and of version two under today’s fingerprint owe a run over exactly the changed cases, and nothing else: no reproduction failure, no escalation; a run over them turns it green', async () => {
		expect([V3_SET.caseSetVersion, V3_ORACLES.oracleVersion], 'version three').toEqual([3, 3]);
		const older = new Set([...CASES, ...V2_CASES].map((c) => c.id));
		const changed = V3_CASES.filter((c) => !older.has(c.id));
		expect(changed.map((c) => c.id)).toEqual(CHANGED);
		const v1Record = await recorded({ runId: 'qr-v1-then', cases: CASES });
		const v2Record = await recorded({
			runId: 'qr-v2-then',
			date: '2026-09-25T12:00:00.000Z',
			cases: V2_CASES,
			fingerprint: { ...CURRENT, caseSet: FP_V2.caseSet },
			versions: { caseSet: 2, oracles: 2 }
		});
		const owed = await onVersionThree([file([...v1Record, ...v2Record])]);
		expect(owed.problems.map((p) => p.limb), 'coverage alone').toEqual(['COVERAGE']);
		expect(limb(owed, 'COVERAGE')).toBe(
			`12 of 26 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${CHANGED.join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
		);
		// The fourteen unchanged cases stay covered by version two's run — the same ids, the same prompts.
		const remeasured = await recorded({
			runId: 'qr-v3-changed',
			date: '2026-09-26T12:00:00.000Z',
			cases: changed,
			fingerprint: { ...CURRENT, caseSet: FP_V3.caseSet },
			versions: { caseSet: 3, oracles: 3 }
		});
		expect((await onVersionThree([file([...v1Record, ...v2Record, ...remeasured])])).problems).toEqual([]);
	});

	it('⭐ CONTROL — why a changed case carries a new id: kept under its version-two id, it reads as a prompt that moved while the fingerprint did not — a non-reproduction a re-run does not discharge', async () => {
		const v2IdOf = (id: string) => (id.startsWith('G3-') ? `G2-${id.slice(3)}` : id);
		const sameIds = V3_CASES.map((c) => ({ ...c, id: v2IdOf(c.id) }));
		const current = { ...FP_V3, casePrompts: new Map([...FP_V3.casePrompts].map(([id, p]) => [v2IdOf(id), p])) };
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
			fingerprint: { ...CURRENT, caseSet: FP_V3.caseSet }
		});
		const r = await onVersionThree([file([...v2Record, ...rerun])], { current, cases: sameIds, oracles: V2_ORACLES.oracles });
		expect(limb(r, 'REPRODUCTION')).toContain(
			'run qr-v2-same-ids: G2-CLEAN#1 initial — the prompt it recorded is not the one today’s reviewer sends, though the fingerprint did not move'
		);
		expect(limb(r, 'COVERAGE'), 'the re-run covers every case — only the old record fails').toBe('');
	});
});

// ── ⭐ `JAN-PRQUAL` `PQ-2` — the current case set is version four (DESIGN-process-result-qualification.md D4; `REG-D-095`) ─
// ⭐ `JAN-EXEC` Phase 7 completion E2 — since E2 a fixed fixture, as versions two and three are: these limbs check records
// of version three against version four, the set that was current when they were written; the current set's own limb
// follows (version five).
describe('JAN-PRQUAL PQ-2 — under case set v4, the committed record’s shape — runs of v3 — owes a run over exactly the fourteen process-result cases, of the selected candidate too', () => {
	/** The cases version four adds — design §5's fourteen, in its order. Written here. */
	const ADDED = [
		'P-CLEAN',
		'P-CLEAN-R1',
		'P-CLEAN-R2',
		'P-CLEAN-R3',
		'P-RR-01',
		'P-RR-02',
		'P-RR-03',
		'P-RR-04',
		'P-RR-05',
		'P-RR-06',
		'P-RR-07',
		'P-RR-07-CUT',
		'P-RR-08',
		'P-RR-09'
	];
	const GLM: SelectedCandidate = { transport: 'devin', modelLabel: 'glm-5-3-flash-max' };
	const onTheCurrentSet = (files: CheckInputs['files'], over: Partial<Omit<CheckInputs, 'files'>> = {}) =>
		check(files, { current: FP_V4, cases: V4_CASES, oracles: V4_ORACLES.oracles, ...over });
	/** A run of version three under today's fingerprint — the committed record's shape since `PQ-1`. */
	const ofVersionThree = (runId: string, candidate?: CandidateIdentity) =>
		recorded({
			runId,
			date: '2026-09-26T12:00:00.000Z',
			cases: V3_CASES,
			fingerprint: { ...CURRENT, caseSet: FP_V3.caseSet },
			versions: { caseSet: 3, oracles: 3 },
			...(candidate ? { candidate } : {})
		});
	/** A run of the fourteen under today's fingerprint, over the current set. */
	const ofTheAdded = (runId: string, candidate?: CandidateIdentity) =>
		recorded({
			runId,
			date: '2026-10-09T12:00:00.000Z',
			cases: V4_CASES.filter((c) => ADDED.includes(c.id)),
			fingerprint: { ...CURRENT, caseSet: FP_V4.caseSet },
			versions: { caseSet: 4, oracles: 4 },
			...(candidate ? { candidate } : {})
		});

	it('⛔ a run of version three under today’s fingerprint owes a run over exactly the fourteen process-result cases, and nothing else: no reproduction failure, no escalation; a run over them turns it green', async () => {
		expect([V4_SET.caseSetVersion, V4_ORACLES.oracleVersion], 'the set is version four').toEqual([4, 4]);
		const v3Ids = new Set(V3_CASES.map((c) => c.id));
		const added = V4_CASES.filter((c) => !v3Ids.has(c.id));
		expect(added.map((c) => c.id)).toEqual(ADDED);
		expect([...new Set(added.map((c) => c.arm))], 'each a process result').toEqual(['PROCESS_RESULT']);
		const v3Record = await ofVersionThree('qr-v3-then');
		const owed = await onTheCurrentSet([file(v3Record)]);
		expect(owed.problems.map((p) => p.limb), 'coverage alone').toEqual(['COVERAGE']);
		expect(limb(owed, 'COVERAGE')).toBe(
			`14 of 40 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${ADDED.join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
		);
		// The twenty-six cases version three carried stay covered by its run — the same ids, the same prompts.
		expect((await onTheCurrentSet([file([...v3Record, ...(await ofTheAdded('qr-v4-added'))])])).problems).toEqual([]);
	});

	it('⛔ …and with a SELECTION in force, the selected candidate’s run of version three owes ITS run over exactly the fourteen: another candidate’s covers nothing of the selection, and the selected one’s turns it green', async () => {
		const v3Selected = await ofVersionThree('qr-v3-selected', DEVIN);
		const selection = select(GLM);
		const lines = [...v3Selected, selection];
		const owed = await onTheCurrentSet([file(lines)]);
		expect(owed.problems.map((p) => p.limb), 'coverage, twice: any run, and the selected candidate’s').toEqual(['COVERAGE', 'COVERAGE']);
		expect(owed.problems[1]!.message).toBe(
			`14 of 40 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate devin / glm-5-3-flash-max (REG-D-084; the SELECTION in force, runs.ndjson:${lines.length}): ${ADDED.join(', ')} — owed: a run of the selected candidate over them, or RESCORED lines of its runs where no case prompt changed (§5.6 limb 1; REG-D-086)`
		);
		const another = [...v3Selected, ...(await ofTheAdded('qr-v4-another')), selection];
		expect(
			(await onTheCurrentSet([file(another)])).problems.map((p) => p.message.split(' — owed')[0]),
			'another candidate’s run covers the fourteen, and nothing of the selection'
		).toEqual([
			`14 of 40 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate devin / glm-5-3-flash-max (REG-D-084; the SELECTION in force, runs.ndjson:${another.length}): ${ADDED.join(', ')}`
		]);
		expect((await onTheCurrentSet([file([...v3Selected, ...(await ofTheAdded('qr-v4-selected', DEVIN)), selection])])).problems).toEqual(
			[]
		);
	});
});


// ── ⭐⭐ `JAN-EXEC` Phase 7 completion E2 — case set version five (`DESIGN-phase-7-completion.md` B5), current from E2 to round 5
// ⭐ Round 5 — since then a fixed fixture, as versions two to four are: these limbs check records of version four against
// version five, the set that was current when they were written; the current set's own limb follows (version six).
describe('JAN-EXEC Phase 7 completion E2 — under case set v5, a run of v4 owes a run over exactly the fourteen declared-policy cases; a run over them, answered as each oracle expects, turns it green', () => {
	/** The cases version five adds — the seven declared policies, each its clean case and its planted one. Written here. */
	const ADDED = [
		'D-RC-CLEAN',
		'D-RC-04',
		'D-IP-CLEAN',
		'D-IP-02',
		'D-AD-CLEAN',
		'D-AD-01',
		'D-DC-CLEAN',
		'D-DC-01',
		'D-AC-CLEAN',
		'D-AC-01',
		'D-TA-CLEAN',
		'D-TA-08',
		'D-FP-CLEAN',
		'D-FP-03'
	];
	/**
	 * ⭐ `E12F` F5 — today's oracles AS IF CONFERRED: what these cases hold is coverage and escalation over version five, so
	 * they hand the check a conferred statement. ~~⛔ Version five's own reads PROPOSED, and the check refuses it — the next
	 * test's subject.~~ ⭐ The merge of the completion programme — `REG-D-113` conferred version five's own; the next test
	 * hands the check a statement that reads PROPOSED, as version five's did before the sponsor's answer (`AS_IF_PROPOSED`).
	 */
	const AS_IF_CONFERRED = 'A fixture: every oracle of today’s set as the sponsor will have conferred it.';
	/** ⭐ The merge — version five's statement as it read while the sponsor's conferral was owed: its proposal's word. */
	const AS_IF_PROPOSED = `A fixture: the fourteen declared-policy oracles are ${DECLARED_ORACLES_PROPOSED}.`;
	const onVersionFive = (files: CheckInputs['files'], over: Partial<Omit<CheckInputs, 'files'>> = {}) =>
		check(files, {
			current: FP_V5,
			cases: V5_CASES,
			oracles: V5_ORACLES.oracles,
			conferral: AS_IF_CONFERRED,
			...over
		});

	it('⛔ E12F F5 — while today’s oracles are PROPOSED, a run over version five answered exactly as every oracle expects is NOT green: the conferral is owed, a named problem (REG-D-073)', async () => {
		// ⛔ PREDICTED RED, read from the code: [] — the check read no conferral, so a run over version five made before the
		// sponsor confers its oracles went green against oracles nobody but their author had judged.
		// ⭐ The merge — ~~version five's oracles are proposed~~: `REG-D-113` conferred them, so the record no longer carries the
		// proposal's word, and the PROPOSED statement this case needs is built here (`AS_IF_PROPOSED`).
		expect(V5_ORACLES.conferral, 'arrangement: REG-D-113 conferred version five’s oracles').not.toContain(
			DECLARED_ORACLES_PROPOSED
		);
		const v4Record = await recorded({
			runId: 'qr-v4-unconferred',
			date: '2026-10-10T12:00:00.000Z',
			cases: V4_CASES,
			fingerprint: { ...CURRENT, caseSet: FP_V4.caseSet },
			versions: { caseSet: 4, oracles: 4 }
		});
		const declared = await recorded({
			runId: 'qr-v5-unconferred',
			date: '2026-10-11T12:00:00.000Z',
			cases: V5_CASES.filter((c) => !V4_CASES.some((v) => v.id === c.id)),
			fingerprint: { ...CURRENT, caseSet: FP_V5.caseSet },
			versions: { caseSet: 5, oracles: 5 }
		});
		const files = [file([...v4Record, ...declared])];
		const r = await onVersionFive(files, { conferral: AS_IF_PROPOSED });
		expect(r.problems, 'a run over unconferred oracles went green').toEqual([
			{ limb: 'CONFERRAL', message: ORACLES_NOT_CONFERRED }
		]);
		// ⭑ CONTROL — the same record, its oracles conferred: green. The conferral is the only difference.
		expect((await onVersionFive(files)).problems).toEqual([]);
	});

	it('⛔ a run of version four under today’s fingerprint owes exactly the fourteen declared cases — coverage alone — and a run over them, each answered by its own rubric as its oracle expects, turns it green', async () => {
		expect([V5_SET.caseSetVersion, V5_ORACLES.oracleVersion], 'the set is version five').toEqual([5, 5]);
		const v4Ids = new Set(V4_CASES.map((c) => c.id));
		const added = V5_CASES.filter((c) => !v4Ids.has(c.id));
		expect(added.map((c) => c.id)).toEqual(ADDED);
		expect([...new Set(added.map((c) => c.arm))], 'each a declared-policy case').toEqual(['DECLARED_POLICY']);
		const v4Record = await recorded({
			runId: 'qr-v4-then',
			date: '2026-10-10T12:00:00.000Z',
			cases: V4_CASES,
			fingerprint: { ...CURRENT, caseSet: FP_V4.caseSet },
			versions: { caseSet: 4, oracles: 4 }
		});
		const owed = await onVersionFive([file(v4Record)]);
		expect(owed.problems.map((p) => p.limb), 'coverage alone').toEqual(['COVERAGE']);
		expect(limb(owed, 'COVERAGE')).toBe(
			`14 of 54 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${ADDED.join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
		);
		const declared = await recorded({
			runId: 'qr-v5-declared',
			date: '2026-10-11T12:00:00.000Z',
			cases: added,
			fingerprint: { ...CURRENT, caseSet: FP_V5.caseSet },
			versions: { caseSet: 5, oracles: 5 }
		});
		// ⭐ MEASURABLE BY THE EXISTING RUNNER, NO MODEL CALLED (design B5): each declared case scored as its oracle expects.
		expect((await onVersionFive([file([...v4Record, ...declared])])).problems).toEqual([]);
	});

	it('⛔ …and a planted declared case answered SATISFIED is a material failure: the reviewer missed the plant (PLANTED_DEFECT_NOT_REJECTED)', async () => {
		const added = V5_CASES.filter((c) => ADDED.includes(c.id));
		const missed = await recorded({
			runId: 'qr-v5-missed',
			cases: added,
			fingerprint: { ...CURRENT, caseSet: FP_V5.caseSet },
			versions: { caseSet: 5, oracles: 5 },
			reply: (id) => (id === 'D-TA-08' ? judgement([], DECLARED_RUBRIC.get(id)) : asOracle(id))
		});
		const v4Record = await recorded({
			runId: 'qr-v4-then-2',
			cases: V4_CASES,
			fingerprint: { ...CURRENT, caseSet: FP_V4.caseSet },
			versions: { caseSet: 4, oracles: 4 }
		});
		const r = await onVersionFive([file([...v4Record, ...missed])]);
		expect(r.problems.map((p) => p.limb)).toContain('ESCALATION');
		expect(limb(r, 'ESCALATION')).toContain('D-TA-08');
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7 completion, round 5 — case set version six (`REG-D-115`), current since round 5 ─────────────
// In P4 the selected reviewer rejected the clean case D-FP-CLEAN once, on a retry of a transport failure, for flaws the
// case's own record shows; the sponsor ruled the case be repaired and its oracle kept SATISFIED. Version six is version five
// with ~~that one case repaired, under a new id~~ ⭐ four cases repaired, each under a new id (the three below). These limbs
// hold the check over P4's record shape to it.
// ⭐ And under the ruling's delegated extension (`REG-D-115`), three more: D-FP-CLEAN's planted twin D-FP-03, and the
// requirements pair D-RC-CLEAN and D-RC-04 — four cases repaired, each under a new id, so the record owes a run of the four.
// ⭐ Package P F3 — version six is a fixed fixture since version seven became current (`REG-D-123` Q25): these limbs hold
// the check over P4's record shape to version six by name, as they held it while it was current.
describe('JAN-EXEC Phase 7 completion round 5 — under case set v6, P4’s record shape — a run of v5 and a retry that rejected D-FP-CLEAN, of the selected candidate — owes a run over exactly the four repaired cases, D6-RC-CLEAN, D6-RC-04, D6-FP-CLEAN and D6-FP-03 (REG-D-115)', () => {
	/** The cases version six repairs, in the current set's order, and the version-five id each replaces. Written here. */
	const REPAIRED_FROM: ReadonlyMap<string, string> = new Map([
		['D6-RC-CLEAN', 'D-RC-CLEAN'],
		['D6-RC-04', 'D-RC-04'],
		['D6-FP-CLEAN', 'D-FP-CLEAN'],
		['D6-FP-03', 'D-FP-03']
	]);
	const REPAIRED = [...REPAIRED_FROM.keys()];
	const GLM: SelectedCandidate = { transport: 'devin', modelLabel: 'glm-5-3-flash-max' };
	/** ~~The current set~~ ⭐ Version six — current from round 5 to package P — and its own oracles, conferred (`REG-D-113`,
	 *  `REG-D-115`). */
	const onVersionSix = (files: CheckInputs['files'], over: Partial<Omit<CheckInputs, 'files'>> = {}) =>
		check(files, {
			current: FP_V6,
			cases: V6_CASES,
			oracles: V6_ORACLES.oracles,
			conferral: V6_ORACLES.conferral,
			...over
		});
	const onVersionFive = (files: CheckInputs['files']) =>
		check(files, { current: FP_V5, cases: V5_CASES, oracles: V5_ORACLES.oracles, conferral: V5_ORACLES.conferral });
	/**
	 * P4's shape: the selected candidate's run of version five under today's fingerprint, every case answered as its oracle
	 * expects; then its retry of D-FP-CLEAN alone, REJECTED on FP-06 and FP-07; then the SELECTION.
	 */
	const p4 = async (): Promise<RecordLine[]> => [
		...(await recorded({
			runId: 'qr-v5-p4',
			date: '2026-10-16T12:00:00.000Z',
			candidate: DEVIN,
			cases: V5_CASES,
			fingerprint: { ...CURRENT, caseSet: FP_V5.caseSet },
			versions: { caseSet: 5, oracles: 5 }
		})),
		...(await recorded({
			runId: 'qr-v5-p4-retry',
			date: '2026-10-16T16:00:00.000Z',
			candidate: DEVIN,
			cases: V5_CASES.filter((c) => c.id === 'D-FP-CLEAN'),
			fingerprint: { ...CURRENT, caseSet: FP_V5.caseSet },
			versions: { caseSet: 5, oracles: 5 },
			reply: (id) => judgement(['FP-06', 'FP-07'], DECLARED_RUBRIC.get(id))
		})),
		select(GLM)
	];

	it('⛔ under version five the retry’s rejection of D-FP-CLEAN is an un-escalated CLEAN_NOT_SATISFIED; under version six the same record owes a run over the four repaired cases alone — coverage, of any run and of the selected candidate’s, and nothing else: no reproduction failure, no escalation; a run of the selected candidate over them turns it green', async () => {
		expect([V6_SET.caseSetVersion, V6_ORACLES.oracleVersion], 'version six').toEqual([6, 6]);
		const v5Ids = new Set(V5_CASES.map((c) => c.id));
		expect(V6_CASES.filter((c) => !v5Ids.has(c.id)).map((c) => c.id), 'the cases version six changes').toEqual(REPAIRED);
		// ⭐ Each repaired case's oracle is the one its version-five case carried, its verdict and faulted list unchanged.
		for (const [to, from] of REPAIRED_FROM) {
			const was = V5_ORACLES.oracles.find((o) => o.caseId === from)!;
			expect(V6_ORACLES.oracles.find((o) => o.caseId === to), `${to}: its oracle`).toMatchObject({
				faulted: was.faulted,
				disposition: was.disposition
			});
		}
		const lines = await p4();
		// ⭑ CONTROL — under version five, the record the retry wrote is red on that rejection, as the committed record was.
		expect((await onVersionFive([file(lines)])).problems).toEqual([
			{
				limb: 'ESCALATION',
				message:
					'run qr-v5-p4-retry: D-FP-CLEAN — CLEAN_NOT_SATISFIED, SATISFIED_LOST — no ESCALATION line cites a register finding for it (§5.6 limb 3)'
			}
		]);
		// ⭐ Under version six: D-FP-CLEAN is no case of today's set, so its evaluations are reproduced and covered for nothing,
		// and limb 3 judges them against today's oracles, which hold none for it; ⭐ so too the other three cases version six
		// repairs. The four repaired cases are owed their run.
		const owed = await onVersionSix([file(lines)]);
		expect(owed.problems).toEqual([
			{
				limb: 'COVERAGE',
				message: `4 of 54 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${REPAIRED.join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
			},
			{
				limb: 'COVERAGE',
				message: `4 of 54 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate devin / glm-5-3-flash-max (REG-D-084; the SELECTION in force, runs.ndjson:${lines.length}): ${REPAIRED.join(', ')} — owed: a run of the selected candidate over them, or RESCORED lines of its runs where no case prompt changed (§5.6 limb 1; REG-D-086)`
			}
		]);
		const remeasured = await recorded({
			runId: 'qr-v6-repaired',
			date: '2026-10-17T12:00:00.000Z',
			candidate: DEVIN,
			cases: V6_CASES.filter((c) => REPAIRED.includes(c.id)),
			fingerprint: { ...CURRENT, caseSet: FP_V6.caseSet },
			versions: { caseSet: 6, oracles: 6 }
		});
		expect((await onVersionSix([file([...lines, ...remeasured])])).problems).toEqual([]);
	});

	it('⭐ CONTROL — why a repaired case carries a new id: kept under its version-five id, P4’s run of it reads as a prompt that moved while the fingerprint did not — a non-reproduction a re-run does not discharge', async () => {
		const v5IdOf = (id: string) => REPAIRED_FROM.get(id) ?? id;
		const sameIds = V6_CASES.map((c) => ({ ...c, id: v5IdOf(c.id) }));
		const current = { ...FP_V6, casePrompts: new Map([...FP_V6.casePrompts].map(([id, p]) => [v5IdOf(id), p])) };
		const rerun = await recorded({
			runId: 'qr-v6-same-id-rerun',
			date: '2026-10-17T12:00:00.000Z',
			candidate: DEVIN,
			cases: sameIds.filter((c) => [...REPAIRED_FROM.values()].includes(c.id)),
			fingerprint: { ...CURRENT, caseSet: FP_V6.caseSet }
		});
		const r = await onVersionSix([file([...(await p4()), ...rerun])], { current, cases: sameIds, oracles: V5_ORACLES.oracles });
		// ⭐ Each of the four, kept under its version-five id, reads as a prompt that moved.
		for (const from of REPAIRED_FROM.values())
			expect(limb(r, 'REPRODUCTION')).toContain(
				`run qr-v5-p4: ${from}#1 initial — the prompt it recorded is not the one today’s reviewer sends, though the fingerprint did not move`
			);
		expect(limb(r, 'COVERAGE'), 'the re-run covers every case — only the old record fails').toBe('');
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7 after P6's third run, package P, F4's red (`REG-D-123` Q25; DESIGN-phase-7-completion.md §4c) ──
// ⭐ The review in parts, B7 — ~~Version seven is current~~ version seven, a fixed fixture since version eight (`V7_SET`), and
// its six new oracles conferred (`REG-D-124`, recorded in `oracles-v7.ts`): the record's shape below owes their conferral no
// more, and the limb is held by a statement that reads PROPOSED, as version seven's did before the record (`AS_IF_PROPOSED_V7`).
// Version seven was current, and package P F1 moved the reviewer fingerprint ON PURPOSE: its graph framing moves every graph
// case's prompt, and its probes reach the export's new fields. ⭐ A fingerprint move alone is no qualification (`REG-D-086`):
// the committed record's shape — the selected candidate's run of version six under the fingerprint before F1 — owes a run of
// the selected candidate over the nineteen graph cases (thirteen whose prompts moved, six new), RESCORED lines for the other
// forty-one, whose prompts did not move, no ACKNOWLEDGED line (the move reached case prompts), and the sponsor's conferral
// of the six new oracles.
describe('⭐⭐ package P F4 — under case set v7 and the fingerprint F1 moved, the selected candidate’s run of v6 owes a run over exactly the nineteen graph cases, RESCORED lines for the other forty-one, and the conferral of the six new oracles (REG-D-123 Q25, REG-D-086)', () => {
	const GLM: SelectedCandidate = { transport: 'devin', modelLabel: 'glm-5-3-flash-max' };
	const GRAPH = (): string[] => V7_CASES.filter((c) => c.arm === 'PWA_GRAPH').map((c) => c.id);
	const OTHERS = (): string[] => V7_CASES.filter((c) => c.arm !== 'PWA_GRAPH').map((c) => c.id);
	/** ~~Today's set~~ Version seven and its oracles, under `conferral` (its committed statement, unless said). */
	const onVersionSeven = (files: CheckInputs['files'], conferral = V7_ORACLES.conferral) =>
		check(files, { current: FP_V7, cases: V7_CASES, oracles: V7_ORACLES.oracles, conferral });
	/** ⭐ B7 — version seven's statement as it read before `REG-D-124`'s record: its six new oracles proposed. */
	const AS_IF_PROPOSED_V7 = `${V6_ORACLES.conferral} The six graph-case oracles version seven adds are ${DECLARED_ORACLES_PROPOSED}.`;
	/** The definition before F1: today's but for the probes, which F1 moved. */
	const BEFORE_F1 = (): RunFingerprint => ({ ...moved('probes'), caseSet: FP_V6.caseSet });
	/**
	 * The selected candidate's run of version six under the definition before F1, every case answered as its oracle expects:
	 * each graph case's prompts as F1 found them, not today's — so each of its calls records a hash today's reviewer does not
	 * send — and every other case's prompts today's.
	 */
	const v6Run = async (): Promise<RecordLine[]> => {
		const lines = await recorded({
			runId: 'qr-v6-before-f1',
			date: '2026-10-18T12:00:00.000Z',
			candidate: DEVIN,
			cases: V6_CASES,
			fingerprint: BEFORE_F1(),
			versions: { caseSet: 6, oracles: 6 }
		});
		return V6_CASES.filter((c) => c.arm === 'PWA_GRAPH').reduce(
			(acc, c) => tamper(acc, c.id, (call) => ({ ...call, promptSha256: sha256(`${call.promptSha256} — before package P F1`) })),
			lines
		);
	};
	/** The COVERAGE problem's first line, as the check words it, for `who` (the any-candidate limb, or the selected one's). */
	const owed = (who: 'any' | 'selected', lines: readonly RecordLine[]) =>
		who === 'any'
			? `60 of 60 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${V7_CASES.map((c) => c.id).join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
			: `60 of 60 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate devin / glm-5-3-flash-max (REG-D-084; the SELECTION in force, runs.ndjson:${lines.length}): ${V7_CASES.map((c) => c.id).join(', ')} — owed: a run of the selected candidate over them, or RESCORED lines of its runs where no case prompt changed (§5.6 limb 1; REG-D-086)`;
	/** The hint beside it: the cases whose prompts the run recorded are today's, which RESCORED lines discharge. */
	const hint = (ids: readonly string[]) =>
		`same prompts under an earlier fingerprint in qr-v6-before-f1: ${ids.join(', ')} — RESCORED lines discharge those where no case prompt changed (§5.6 limb 1)`;
	const restampToday = (lines: readonly RecordLine[]) =>
		rescoredLines(
			lines.find((l): l is RunLine => l.kind === 'RUN')!,
			lines.filter((l): l is CallLine => l.kind === 'CALL'),
			V7_CASES,
			FP_V7.casePrompts,
			{
				rescoreId: 'rs-v6-before-f1',
				date: '2026-10-23T12:00:00.000Z',
				commit: 'b'.repeat(40),
				reviewer: FP.reviewer,
				scoring: FP.scoring,
				caseSet: FP_V7.caseSet
			}
		);

	it('⛔ RED, AND EXACTLY SO — ~~the conferral of the six new oracles, and~~ coverage of all sixty, by any candidate and by the selected one, each naming the forty-one whose prompts did not move as RESCORED lines discharge them; no ACKNOWLEDGED line is owed, and nothing else — ⭐ the six conferred (REG-D-124); a statement that reads PROPOSED owes their conferral besides', async () => {
		expect([V7_SET.caseSetVersion, V7_ORACLES.oracleVersion], 'version seven').toEqual([7, 7]);
		expect([GRAPH().length, OTHERS().length], 'graph cases, the others').toEqual([19, 41]);
		expect(FP.reviewer, 'arrangement: the run’s fingerprint is not today’s').not.toBe(BEFORE_F1().reviewer);
		const lines = [...(await v6Run()), select(GLM)];
		const coverage = [
			{ limb: 'COVERAGE', message: [owed('any', lines), hint(OTHERS())].join('\n    ') },
			{ limb: 'COVERAGE', message: [owed('selected', lines), hint(OTHERS())].join('\n    ') }
		];
		// ⭐ B7 — ~~the CONFERRAL problem first~~: `REG-D-124` is recorded, so coverage alone is owed.
		expect((await onVersionSeven([file(lines)])).problems).toEqual(coverage);
		// ⭑ CONTROL — version seven's statement as it read before the record: the conferral owed, then the same coverage.
		expect((await onVersionSeven([file(lines)], AS_IF_PROPOSED_V7)).problems).toEqual([
			{ limb: 'CONFERRAL', message: ORACLES_NOT_CONFERRED },
			...coverage
		]);
	});

	it('⭐ RESCORED lines of that run for the forty-one and a run of the selected candidate over the nineteen graph cases under today’s fingerprint leave ~~the conferral alone — and with it recorded,~~ nothing owed: GREEN, the six conferred (REG-D-124); a statement that reads PROPOSED owes the conferral alone', async () => {
		const v6 = await v6Run();
		const rescored = await restampToday(v6);
		expect(rescored.map((l) => l.caseId), 'the forty-one, and no graph case: their prompts moved').toEqual(OTHERS());
		const graphRun = await recorded({
			runId: 'qr-v7-graph',
			date: '2026-10-23T14:00:00.000Z',
			candidate: DEVIN,
			cases: V7_CASES.filter((c) => c.arm === 'PWA_GRAPH'),
			fingerprint: { ...CURRENT, caseSet: FP_V7.caseSet },
			versions: { caseSet: 7, oracles: 7 }
		});
		const lines = [...v6, ...rescored, ...graphRun, select(GLM)];
		// ⭐ B7 — ~~the conferral alone~~: GREEN, its six conferred (`REG-D-124`).
		expect((await onVersionSeven([file(lines)])).problems, 'nothing owed').toEqual([]);
		// ⭑ CONTROL — the same record, its statement as it read before the record: the conferral alone. It is the only difference.
		expect((await onVersionSeven([file(lines)], AS_IF_PROPOSED_V7)).problems, 'the conferral alone').toEqual([
			{ limb: 'CONFERRAL', message: ORACLES_NOT_CONFERRED }
		]);
		// ⭑ CONTROL — without the graph run, the nineteen are owed: by any candidate, and by the selected one.
		const withoutRun = (await onVersionSeven([file([...v6, ...rescored, select(GLM)])])).problems.filter((p) => p.limb === 'COVERAGE');
		expect(withoutRun, 'by any candidate, and by the selected one').toHaveLength(2);
		for (const p of withoutRun) {
			const first = p.message.split('\n')[0]!;
			expect(first.startsWith('19 of 60 current case(s) are not MEASURED'), first).toBe(true);
			expect(first, 'the nineteen graph cases, and no other').toContain(`: ${GRAPH().join(', ')} — owed`);
		}
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B7 (`REG-D-125`, `REG-D-126`; DESIGN-authoring-review-in-parts.md §5) ──────
// ~~Version eight is current~~ ⭐ Version eight — current from B7 to B8a, a fixed fixture since — and B7 moved the reviewer
// fingerprint ON PURPOSE: the graph framing's probes left it, and the part
// framing's came. ⭐ A fingerprint move alone is no qualification (`REG-D-086`): the record's shape — the selected candidate's
// run of version seven under the fingerprint before B7, every case answered as its oracle expects — owes a run of the selected
// candidate over the 35 part cases, RESCORED lines for the 41 carried cases, whose prompts did not move, and no conferral: the
// 35 part oracles are the sponsor's (Q30, Q31). ⚠ AND AN ACKNOWLEDGED LINE (§5.6 limb 1): no case prompt the run recorded
// shows the move — its graph cases are no case of version eight, and the 41's prompts did not move — so the check asks for
// the line naming today's fingerprint, with the cases added to exercise the change: the 35.
describe('⭐⭐ the review in parts, B7 — under case set v8 and the fingerprint B7 moved, the selected candidate’s run of v7 owes a run over exactly the 35 part cases and RESCORED lines for the other 41, and no conferral (REG-D-126, REG-D-086)', () => {
	const GLM: SelectedCandidate = { transport: 'devin', modelLabel: 'glm-5-3-flash-max' };
	const PARTS = (): string[] => V8_CASES.filter((c) => c.arm === 'PWA_TYPE').map((c) => c.id);
	const CARRIED = (): string[] => V8_CASES.filter((c) => c.arm !== 'PWA_TYPE').map((c) => c.id);
	/** ~~Today's set~~ Version eight and its oracles, under their committed statement. */
	const onVersionEight = (files: CheckInputs['files']) =>
		check(files, { current: FP_V8, cases: V8_CASES, oracles: V8_ORACLES.oracles, conferral: V8_ORACLES.conferral });
	/** The definition before B7: today's but for the probes, which B7 moved. */
	const BEFORE_B7 = (): RunFingerprint => ({ ...moved('probes'), caseSet: FP_V7.caseSet });
	/** The selected candidate's run of version seven under the definition before B7, every case answered as its oracle expects. */
	const v7Run = (): Promise<RecordLine[]> =>
		recorded({
			runId: 'qr-v7-before-b7',
			date: '2026-10-23T18:00:00.000Z',
			candidate: DEVIN,
			cases: V7_CASES,
			fingerprint: BEFORE_B7(),
			versions: { caseSet: 7, oracles: 7 }
		});
	const owed = (who: 'any' | 'selected', lines: readonly RecordLine[]) =>
		who === 'any'
			? `76 of 76 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${V8_CASES.map((c) => c.id).join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
			: `76 of 76 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate devin / glm-5-3-flash-max (REG-D-084; the SELECTION in force, runs.ndjson:${lines.length}): ${V8_CASES.map((c) => c.id).join(', ')} — owed: a run of the selected candidate over them, or RESCORED lines of its runs where no case prompt changed (§5.6 limb 1; REG-D-086)`;
	const hint = (ids: readonly string[]) =>
		`same prompts under an earlier fingerprint in qr-v7-before-b7: ${ids.join(', ')} — RESCORED lines discharge those where no case prompt changed (§5.6 limb 1)`;
	/** The ACKNOWLEDGED line §5.6 limb 1 asks for, as the check words it. */
	const acknowledgementOwed = (): string =>
		`the reviewer fingerprint moved outside every case prompt since run qr-v7-before-b7 — the probe set, the budget or the ` +
		`criteria moved, and no case prompt recorded under it differs from today’s: an ACKNOWLEDGED line naming ${FP.reviewer} ` +
		'is owed, with the case added to exercise the change or the reason none is needed, whatever runs exist under it (§5.6 limb 1)';
	/** That line: today's fingerprint, the 35 part cases the cases added to exercise the move. */
	const acknowledged = (): RecordLine => ({
		kind: 'ACKNOWLEDGED',
		date: '2026-10-24T13:00:00.000Z',
		reviewerFingerprint: FP.reviewer,
		addedCaseIds: PARTS()
	});
	const restampToday = (lines: readonly RecordLine[]) =>
		rescoredLines(
			lines.find((l): l is RunLine => l.kind === 'RUN')!,
			lines.filter((l): l is CallLine => l.kind === 'CALL'),
			V8_CASES,
			FP_V8.casePrompts,
			{
				rescoreId: 'rs-v7-before-b7',
				date: '2026-10-24T12:00:00.000Z',
				commit: 'b'.repeat(40),
				reviewer: FP.reviewer,
				scoring: FP.scoring,
				caseSet: FP_V8.caseSet
			}
		);

	it('⛔ RED, AND EXACTLY SO — coverage of all 76, by any candidate and by the selected one, each naming the 41 carried cases, whose prompts did not move, as RESCORED lines discharge them; an ACKNOWLEDGED line owed, the move reaching no recorded case prompt; no CONFERRAL problem, nothing else', async () => {
		expect([V8_SET.caseSetVersion, V8_ORACLES.oracleVersion], 'version eight').toEqual([8, 8]);
		expect([PARTS().length, CARRIED().length], 'part cases, the others').toEqual([35, 41]);
		expect(FP.reviewer, 'arrangement: the run’s fingerprint is not today’s').not.toBe(BEFORE_B7().reviewer);
		const lines = [...(await v7Run()), select(GLM)];
		expect((await onVersionEight([file(lines)])).problems).toEqual([
			{ limb: 'COVERAGE', message: acknowledgementOwed() },
			{ limb: 'COVERAGE', message: [owed('any', lines), hint(CARRIED())].join('\n    ') },
			{ limb: 'COVERAGE', message: [owed('selected', lines), hint(CARRIED())].join('\n    ') }
		]);
	});

	it('⭐ RESCORED lines of that run for the 41, the ACKNOWLEDGED line naming the 35 added, and a run of the selected candidate over the 35 part cases under today’s fingerprint, each answered as its oracle expects: GREEN; without the line, it alone is owed; without the run, the 35 alone, by any candidate and by the selected one', async () => {
		const v7 = await v7Run();
		const rescored = await restampToday(v7);
		expect(rescored.map((l) => l.caseId), 'the 41, and no part case: no record holds a part’s prompt').toEqual(CARRIED());
		const partRun = await recorded({
			runId: 'qr-v8-parts',
			date: '2026-10-24T14:00:00.000Z',
			candidate: DEVIN,
			cases: V8_CASES.filter((c) => c.arm === 'PWA_TYPE'),
			fingerprint: { ...CURRENT, caseSet: FP_V8.caseSet },
			versions: { caseSet: 8, oracles: 8 }
		});
		expect((await onVersionEight([file([...v7, ...rescored, acknowledged(), ...partRun, select(GLM)])])).problems, 'nothing owed').toEqual([]);
		expect((await onVersionEight([file([...v7, ...rescored, ...partRun, select(GLM)])])).problems, 'without the line, it alone').toEqual([
			{ limb: 'COVERAGE', message: acknowledgementOwed() }
		]);
		const withoutRun = (await onVersionEight([file([...v7, ...rescored, acknowledged(), select(GLM)])])).problems;
		expect(withoutRun.map((p) => p.limb), 'coverage alone, by any candidate and by the selected one').toEqual(['COVERAGE', 'COVERAGE']);
		for (const p of withoutRun) {
			const first = p.message.split('\n')[0]!;
			expect(first.startsWith('35 of 76 current case(s) are not MEASURED'), first).toBe(true);
			expect(first, 'the 35 part cases, and no other').toContain(`: ${PARTS().join(', ')} — owed`);
		}
	});

	it('⛔ ANOTHER CANDIDATE’S RUN OVER THE 35 COVERS THEM FOR NO SELECTION: it discharges the any-candidate limb, and the selected candidate still owes the 35 (REG-D-086)', async () => {
		const v7 = await v7Run();
		const rescored = await restampToday(v7);
		const agyParts = await recorded({
			runId: 'qr-v8-parts-agy',
			date: '2026-10-24T14:00:00.000Z',
			cases: V8_CASES.filter((c) => c.arm === 'PWA_TYPE'),
			fingerprint: { ...CURRENT, caseSet: FP_V8.caseSet },
			versions: { caseSet: 8, oracles: 8 }
		});
		const r = await onVersionEight([file([...v7, ...rescored, acknowledged(), ...agyParts, select(GLM)])]);
		expect(r.problems.map((p) => p.message.split('\n')[0]!.slice(0, 160)), 'the selected candidate’s 35 alone').toEqual([
			`35 of 76 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate devin / glm-5-3-flash-max`.slice(0, 160)
		]);
	});

	it('⛔ A CARRIED CASE WHOSE RECORDED PROMPT IS NOT TODAY’S IS NO RESCORED SOURCE: it owes a run beside the 35, though its run’s other cases are re-stamped (§5.6 limb 1)', async () => {
		const v7 = tamper(await v7Run(), 'W-CLEAN', (call) => ({ ...call, promptSha256: sha256(`${call.promptSha256} — not today’s`) }));
		const rescored = await restampToday(v7);
		expect(rescored.map((l) => l.caseId), 'the 40 whose prompts are today’s').toEqual(CARRIED().filter((id) => id !== 'W-CLEAN'));
		const partRun = await recorded({
			runId: 'qr-v8-parts',
			date: '2026-10-24T14:00:00.000Z',
			candidate: DEVIN,
			cases: V8_CASES.filter((c) => c.arm === 'PWA_TYPE'),
			fingerprint: { ...CURRENT, caseSet: FP_V8.caseSet },
			versions: { caseSet: 8, oracles: 8 }
		});
		const r = await onVersionEight([file([...v7, ...rescored, acknowledged(), ...partRun, select(GLM)])]);
		const coverage = r.problems.filter((p) => p.limb === 'COVERAGE').map((p) => p.message.split('\n')[0]!);
		expect(coverage, 'by any candidate, and by the selected one').toHaveLength(2);
		for (const first of coverage) expect(first, 'W-CLEAN alone owed').toMatch(/^1 of 76 current case\(s\) are not MEASURED .*: W-CLEAN — owed/);
	});

	it('⭐ A PART CASE IS SCORED ON ITS OWN DISPOSITION, ITS ATTRIBUTION REPORTED (REG-D-080) — a catcher answered REJECTED on another criterion than its oracle’s is no material failure, and is reported; one answered SATISFIED is a material failure the check escalates', async () => {
		const catcher = 'G8-RR-02.T05';
		const RR04 = SEEDED_REASONING_REVIEW_CRITERIA[3]!.id;
		const v7 = await v7Run();
		const rescored = await restampToday(v7);
		const run = (reply: (id: string) => string) =>
			recorded({
				runId: 'qr-v8-attr',
				date: '2026-10-24T14:00:00.000Z',
				candidate: DEVIN,
				cases: V8_CASES.filter((c) => c.arm === 'PWA_TYPE'),
				fingerprint: { ...CURRENT, caseSet: FP_V8.caseSet },
				versions: { caseSet: 8, oracles: 8 },
				reply
			});
		const misattributed = await onVersionEight([
			file([...v7, ...rescored, acknowledged(), ...(await run((id) => (id === catcher ? judgement([RR04]) : asOracle(id)))), select(GLM)])
		]);
		expect(misattributed.problems, 'REJECTED on another criterion: no material failure').toEqual([]);
		expect(misattributed.attribution.join('\n'), 'reported').toContain(
			`${catcher}#1 — REJECTED, the right verdict; RR-02 not faulted (it faulted RR-04)`
		);
		const missed = await onVersionEight([
			file([...v7, ...rescored, acknowledged(), ...(await run((id) => (id === catcher ? judgement([]) : asOracle(id)))), select(GLM)])
		]);
		expect(limb(missed, 'ESCALATION')).toBe(
			`run qr-v8-attr: ${catcher} — PLANTED_DEFECT_NOT_REJECTED — no ESCALATION line cites a register finding for it (§5.6 limb 3)`
		);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B8a (`REG-D-127`; DESIGN-authoring-review-in-parts.md D3a and §5) ────────────
// Version nine ~~is current~~ (⭐ B8b: current from B8a to B8b, a fixed fixture since, `V9_SET`), and D3a moved the reviewer
// fingerprint ON PURPOSE: each part probe is cut with the seeded policy
// library, and three probes stand for the policy material. The record's shape — the selected candidate's run of version eight
// under the fingerprint before D3a, every case answered as its oracle expects — owes a run of the selected candidate over the
// 35 part cases, whose prompts moved, and RESCORED lines for the 41 carried cases, whose prompts did not; ~~and the sponsor's
// confirmation of the 19 restated bridge part cases, which the check names as owed — never a missing conferral.~~
// ⭐ The code record of `REG-D-129` — the sponsor confirmed the 19 restated bridge part cases, and the committed statement
// says so, so it owes no confirmation. A statement that still carries the marker (`AS_IF_UNCONFIRMED`, built here) owes it
// besides, the check naming it as owed — never a missing conferral.
describe('⭐⭐ the review in parts, B8a — under case set v9 and the fingerprint D3a moved, the selected candidate’s run of v8 owes a run over exactly the 35 part cases, RESCORED lines for the other 41, ~~and the sponsor’s confirmation of the restated bridge cases~~ and, the restatement confirmed, no confirmation (REG-D-127, REG-D-129, REG-D-086)', () => {
	const GLM: SelectedCandidate = { transport: 'devin', modelLabel: 'glm-5-3-flash-max' };
	const PARTS = (): string[] => V9_CASES.filter((c) => c.arm === 'PWA_TYPE').map((c) => c.id);
	const CARRIED = (): string[] => V9_CASES.filter((c) => c.arm !== 'PWA_TYPE').map((c) => c.id);
	/** ~~Today's set~~ Version nine and its oracles, under `conferral` (their committed statement, unless said). */
	const onVersionNine = (files: CheckInputs['files'], conferral = V9_ORACLES.conferral) =>
		check(files, { current: FP_V9, cases: V9_CASES, oracles: V9_ORACLES.oracles, conferral });
	/** ~~⭐ Today's statement as it will read once the sponsor confirms the restated cases: its marker gone. A fixture.~~ ⭐ The
	 *  code record of `REG-D-129` — today's statement as it read while the sponsor's confirmation was owed: its marker. A fixture. */
	const AS_IF_UNCONFIRMED = `A fixture: the 19 part cases cut from the restated bridge cases are ${ORACLES_RESTATEMENT_UNCONFIRMED}.`;
	/** The definition before D3a: today's but for the probes, which D3a moved. */
	const BEFORE_D3A = (): RunFingerprint => ({ ...moved('probes'), caseSet: FP_V8.caseSet });
	/** The selected candidate's run of version eight under the definition before D3a, every case answered as its oracle expects. */
	const v8Run = (): Promise<RecordLine[]> =>
		recorded({
			runId: 'qr-v8-before-d3a',
			date: '2026-10-24T10:00:00.000Z',
			candidate: DEVIN,
			cases: V8_CASES,
			fingerprint: BEFORE_D3A(),
			versions: { caseSet: 8, oracles: 8 }
		});
	const owed = (who: 'any' | 'selected', lines: readonly RecordLine[]) =>
		who === 'any'
			? `76 of 76 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${V9_CASES.map((c) => c.id).join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
			: `76 of 76 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate devin / glm-5-3-flash-max (REG-D-084; the SELECTION in force, runs.ndjson:${lines.length}): ${V9_CASES.map((c) => c.id).join(', ')} — owed: a run of the selected candidate over them, or RESCORED lines of its runs where no case prompt changed (§5.6 limb 1; REG-D-086)`;
	const hint = (ids: readonly string[]) =>
		`same prompts under an earlier fingerprint in qr-v8-before-d3a: ${ids.join(', ')} — RESCORED lines discharge those where no case prompt changed (§5.6 limb 1)`;
	const restampToday = (lines: readonly RecordLine[]) =>
		rescoredLines(
			lines.find((l): l is RunLine => l.kind === 'RUN')!,
			lines.filter((l): l is CallLine => l.kind === 'CALL'),
			V9_CASES,
			FP_V9.casePrompts,
			{
				rescoreId: 'rs-v8-before-d3a',
				date: '2026-10-24T12:00:00.000Z',
				commit: 'b'.repeat(40),
				reviewer: FP.reviewer,
				scoring: FP.scoring,
				caseSet: FP_V9.caseSet
			}
		);
	const partRun = () =>
		recorded({
			runId: 'qr-v9-parts',
			date: '2026-10-24T14:00:00.000Z',
			candidate: DEVIN,
			cases: V9_CASES.filter((c) => c.arm === 'PWA_TYPE'),
			fingerprint: { ...CURRENT, caseSet: FP_V9.caseSet },
			versions: { caseSet: 9, oracles: 9 }
		});

	it('⛔ RED, AND EXACTLY SO — ~~the sponsor’s confirmation of the restated cases owed, never a missing conferral; and~~ coverage of all 76, by any candidate and by the selected one, each naming the 41 carried cases, whose prompts did not move, as RESCORED lines discharge them; nothing else, the restatement confirmed (REG-D-129); a statement still carrying the marker owes the confirmation besides, never a missing conferral', async () => {
		// ⭐ B8b — ~~'the current set is version nine'~~: version nine's committed set, history since version ten.
		expect([V9_SET.caseSetVersion, V9_ORACLES.oracleVersion], 'version nine').toEqual([9, 9]);
		expect([PARTS().length, CARRIED().length], 'part cases, the others').toEqual([35, 41]);
		expect(FP.reviewer, 'arrangement: the run’s fingerprint is not today’s').not.toBe(BEFORE_D3A().reviewer);
		expect(V9_ORACLES.conferral, 'arrangement: REG-D-129 confirmed the restatement').not.toContain(
			ORACLES_RESTATEMENT_UNCONFIRMED
		);
		const lines = [...(await v8Run()), select(GLM)];
		const coverage = [
			{ limb: 'COVERAGE', message: [owed('any', lines), hint(CARRIED())].join('\n    ') },
			{ limb: 'COVERAGE', message: [owed('selected', lines), hint(CARRIED())].join('\n    ') }
		];
		// ⭐ `REG-D-129` — ~~the confirmation owed first~~: the committed statement owes no confirmation.
		expect((await onVersionNine([file(lines)])).problems).toEqual(coverage);
		expect((await onVersionNine([file(lines)], AS_IF_UNCONFIRMED)).problems, 'the marker: the confirmation owed besides').toEqual([
			{ limb: 'CONFERRAL', message: RESTATEMENT_NOT_CONFIRMED },
			...coverage
		]);
	});

	it('⭐ RESCORED lines of that run for the 41 and a run of the selected candidate over the 35 part cases under today’s fingerprint, each answered as its oracle expects, ~~leave the confirmation alone owed; with it recorded, GREEN~~ are GREEN, the confirmation recorded (REG-D-129); a statement still carrying the marker owes the confirmation alone; without the run, the 35 alone, by any candidate and by the selected one', async () => {
		const v8 = await v8Run();
		const rescored = await restampToday(v8);
		expect(rescored.map((l) => l.caseId), 'the 41, and no part case: their prompts moved').toEqual(CARRIED());
		const lines = [...v8, ...rescored, ...(await partRun()), select(GLM)];
		expect((await onVersionNine([file(lines)])).problems, 'confirmed: nothing owed').toEqual([]);
		expect((await onVersionNine([file(lines)], AS_IF_UNCONFIRMED)).problems, 'the marker: the confirmation alone').toEqual([
			{ limb: 'CONFERRAL', message: RESTATEMENT_NOT_CONFIRMED }
		]);
		const withoutRun = (await onVersionNine([file([...v8, ...rescored, select(GLM)])])).problems;
		expect(withoutRun.map((p) => p.limb), 'coverage alone, by any candidate and by the selected one').toEqual(['COVERAGE', 'COVERAGE']);
		for (const p of withoutRun) {
			const first = p.message.split('\n')[0]!;
			expect(first.startsWith('35 of 76 current case(s) are not MEASURED'), first).toBe(true);
			expect(first, 'the 35 part cases, and no other').toContain(`: ${PARTS().join(', ')} — owed`);
		}
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B8b (`REG-D-130`, `REG-D-131`; DESIGN-authoring-review-in-parts.md D3b and §5) ─
// Version ten ~~is current~~ (⭐ package K: current from B8b to package K, a fixed fixture since, `V10_SET`, `FP_V10`,
// `V10_ORACLES`, in this describe's place of ~~`CURRENT_CASES`, `FP_NOW`, `CURRENT_ORACLES`~~), and D3b moved NO fingerprint: the reviewer, its probes, budget, criteria and scoring are version
// nine's, and only the 19 bridge part cases' inputs moved — ~~under their ids (`cases.ts`)~~ ⭐ under NEW ids (D3b (8),
// `REG-D-132`; `REG-F-575`). So the record's shape — the selected candidate's run of version eight under the fingerprint before
// D3a, re-stamped for the 41 carried cases, and its run of version nine's 35 part cases under TODAY'S fingerprint, two
// repetitions, every case answered as its oracle expects (the committed record's shape since 14c141af) — owes coverage of
// exactly the 19 ⭐ under their new ids; ~~and limb 2, which compares every record carrying today's fingerprint with today's
// prompts, reads version nine's part run as a NON-REPRODUCTION of each of the 19 in each repetition: the prompt it recorded is
// not the one today's reviewer sends, though the fingerprint did not move.~~ ⭐ and limb 2, which compares every record carrying
// today's fingerprint with today's prompts for each case STILL IN THE SET, finds version nine's part run reproducing: its 16
// software part cases send today's prompts, and its 19 bridge ones are under ids today's set no longer holds.
// ~~⛔ A RUN OVER THE 19 DOES NOT DISCHARGE THAT: only a SUPERSEDED line citing a register finding does, and it strikes the
// WHOLE run, so the 16 software part cases it alone covered are owed again — a run over all 35, not the 19. Pinned as it stands
// (package I's check, finding 1): how limb 2 is discharged for version ten, and at what spend, is the lead's to settle; a
// change to the check or the record changes these cases with it.~~ ⭐ SETTLED BY `REG-D-132`: a run over the 19 under their new
// ids discharges what is owed, and no SUPERSEDED line is — one striking version nine's part run is refused, the run
// reproducing, under version ten as under version nine (its CONTROL). PREDICTED in the ruling ("V9's run records no current id
// whose prompt moved, so the REPRODUCTION problem clears"), and measured here over the record's shape.
describe('⭐⭐ the review in parts, B8b — under case set v10 and an UNMOVED fingerprint, v9’s record shape owes coverage of exactly the 19 bridge part cases ⭐ under their new ids (REG-D-132), ~~and limb 2 reads v9’s part run as a non-reproduction of each of them, which a run over the 19 does not discharge; a SUPERSEDED line strikes the whole run and owes the 16 software part cases again~~ ⭐ and limb 2 finds v9’s part run reproducing: a run over the 19 turns it GREEN, and a SUPERSEDED line striking v9’s run is refused (REG-D-130, REG-D-131, REG-D-086)', () => {
	const GLM: SelectedCandidate = { transport: 'devin', modelLabel: 'glm-5-3-flash-max' };
	/**
	 * The 19 D3b restated, as `reviewer:qual:check` names them on the committed record, in the set's order — ⭐ D3b (8): under
	 * their new ids, ~~'G3-CLEAN.T01' … 'G3-RR-09.T01'~~ (`BRIDGE_V9`) as G10-CLEAN.T01 … G10-RR-09.T01.
	 */
	const BRIDGE = [
		'G10-CLEAN.T01',
		'G10-CLEAN.T02',
		'G10-CLEAN.T03',
		'G10-CLEAN.T04',
		'G10-CLEAN.T05',
		'G10-CLEAN.T06',
		'G10-CLEAN.T07',
		'G10-CLEAN-R1.T01',
		'G10-CLEAN-R2.T01',
		'G10-CLEAN-R3.T01',
		'G10-RR-01.T01',
		'G10-RR-02.T01',
		'G10-RR-03.T04',
		'G10-RR-04.T05',
		'G10-RR-05.T01',
		'G10-RR-06.T05',
		'G10-RR-07.T06',
		'G10-RR-08.T05',
		'G10-RR-09.T01'
	];
	/** ⭐ D3b (8) — the 19 under version nine's ids, as version nine's part run records them, in its order. */
	const BRIDGE_V9 = [
		'G3-CLEAN.T01',
		'G3-CLEAN.T02',
		'G3-CLEAN.T03',
		'G3-CLEAN.T04',
		'G3-CLEAN.T05',
		'G3-CLEAN.T06',
		'G3-CLEAN.T07',
		'G3-CLEAN-R1.T01',
		'G3-CLEAN-R2.T01',
		'G3-CLEAN-R3.T01',
		'G-RR-01.T01',
		'G3-RR-02.T01',
		'G3-RR-03.T04',
		'G3-RR-04.T05',
		'G3-RR-05.T01',
		'G3-RR-06.T05',
		'G3-RR-07.T06',
		'G3-RR-08.T05',
		'G3-RR-09.T01'
	];
	const SOFTWARE = (): string[] => V10_CASES.filter((c) => c.arm === 'PWA_TYPE' && !BRIDGE.includes(c.id)).map((c) => c.id);
	/** ~~Today's set — version ten —~~ Version ten and its oracles, under their committed statement. */
	const onVersionTen = (files: CheckInputs['files']) =>
		check(files, { current: FP_V10, cases: V10_CASES, oracles: V10_ORACLES.oracles, conferral: V10_ORACLES.conferral });
	/** Version nine and its oracles, under their committed statement: the CONTROL, the same record under the set it was made for. */
	const onVersionNine = (files: CheckInputs['files']) =>
		check(files, { current: FP_V9, cases: V9_CASES, oracles: V9_ORACLES.oracles, conferral: V9_ORACLES.conferral });
	/** The definition before D3a: today's but for the probes, which D3a moved. */
	const BEFORE_D3A = (): RunFingerprint => ({ ...moved('probes'), caseSet: FP_V8.caseSet });
	const v8Run = (): Promise<RecordLine[]> =>
		recorded({
			runId: 'qr-v8-before-d3a',
			date: '2026-10-24T10:00:00.000Z',
			candidate: DEVIN,
			cases: V8_CASES,
			fingerprint: BEFORE_D3A(),
			versions: { caseSet: 8, oracles: 8 }
		});
	/** Its 41 carried cases re-stamped under today's fingerprint, as version nine's set stood. */
	const restamped = (lines: readonly RecordLine[]) =>
		rescoredLines(
			lines.find((l): l is RunLine => l.kind === 'RUN')!,
			lines.filter((l): l is CallLine => l.kind === 'CALL'),
			V9_CASES,
			FP_V9.casePrompts,
			{
				rescoreId: 'rs-v8-before-d3a',
				date: '2026-10-24T12:00:00.000Z',
				commit: 'b'.repeat(40),
				reviewer: FP.reviewer,
				scoring: FP.scoring,
				caseSet: FP_V9.caseSet
			}
		);
	/** The selected candidate's run of version nine's 35 part cases under today's fingerprint, two repetitions, as 14c141af's. */
	const v9Parts = () =>
		recorded({
			runId: 'qr-v9-parts',
			date: '2026-10-24T14:00:00.000Z',
			candidate: DEVIN,
			cases: V9_CASES.filter((c) => c.arm === 'PWA_TYPE'),
			fingerprint: { ...CURRENT, caseSet: FP_V9.caseSet },
			repetitions: 2,
			versions: { caseSet: 9, oracles: 9 }
		});
	/** A run of the selected candidate over some of version ten's cases under today's fingerprint, as their oracles expect. */
	const v10Run = (runId: string, ids: readonly string[], date: string) =>
		recorded({
			runId,
			date,
			candidate: DEVIN,
			cases: V10_CASES.filter((c) => ids.includes(c.id)),
			fingerprint: { ...CURRENT, caseSet: FP_V10.caseSet },
			repetitions: 2,
			versions: { caseSet: 10, oracles: 10 }
		});
	/** The SUPERSEDED line that strikes version nine's part run, citing a finding the register holds. */
	const strikeV9Parts: RecordLine = {
		kind: 'SUPERSEDED',
		date: '2026-10-25T12:00:00.000Z',
		record: 'qr-v9-parts',
		finding: 'REG-F-429',
		note: 'A fixture: version ten restated the 19 bridge part cases under their ids.'
	};
	const owed = (who: 'any' | 'selected', ids: readonly string[], lines: readonly RecordLine[]) =>
		who === 'any'
			? `${ids.length} of 76 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${ids.join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
			: `${ids.length} of 76 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate devin / glm-5-3-flash-max (REG-D-084; the SELECTION in force, runs.ndjson:${lines.length}): ${ids.join(', ')} — owed: a run of the selected candidate over them, or RESCORED lines of its runs where no case prompt changed (§5.6 limb 1; REG-D-086)`;
	// ~~Limb 2's one problem for version nine's part run: each of the 19 in each repetition, then what discharges it
	// (`V9_PARTS_DO_NOT_REPRODUCE`)~~ ⭐ D3b (8): none — version nine's part run reproduces, its 19 bridge part cases under ids
	// today's set does not hold.
	/** ⭐ D3b (8) — limb 2's refusal of a SUPERSEDED line at `at` naming version nine's part run, which reproduces. */
	const STRIKE_REFUSED = (at: number): string =>
		`runs.ndjson:${at}: SUPERSEDED names qr-v9-parts, which reproduces — refused: a record is struck only when it really fails reproduction (§5.6 limb 2)`;

	it('⛔ RED, AND EXACTLY SO — coverage of exactly the 19 ⭐ under their new ids, by any candidate and by the selected one, ~~and ONE reproduction problem, v9’s part run, naming each of the 19 in each repetition~~ ⭐ and no REPRODUCTION problem (REG-D-132); nothing else — no CONFERRAL (REG-D-131 Q36), and the 57 others covered as they stand. CONTROL: under version nine the same record is GREEN', async () => {
		// ⭐ Package K — ~~'the current set is version ten'~~: version ten's committed set, history since version eleven.
		expect([V10_SET.caseSetVersion, V10_ORACLES.oracleVersion], 'version ten').toEqual([10, 10]);
		expect(FP_V10.reviewer, 'arrangement: D3b moved no fingerprint').toBe(FP_V9.reviewer);
		expect(FP_V10.caseSet, 'arrangement: the case-set digest moved').not.toBe(FP_V9.caseSet);
		const restated = V10_CASES.filter((c) => FP_V9.casePrompts.get(c.id)?.initial !== FP_V10.casePrompts.get(c.id)?.initial).map(
			(c) => c.id
		);
		expect(restated, 'arrangement: the 19, and only they, send prompts version nine did not').toEqual(BRIDGE);
		// ⭐ D3b (8) — under an id version nine holds, today's set sends version nine's prompts, each of its three: nothing moved
		// under an unmoved fingerprint, and version nine's 19 ids are no case of today's.
		expect(
			V10_CASES.filter((c) => FP_V9.casePrompts.has(c.id) && JSON.stringify(FP_V9.casePrompts.get(c.id)) !== JSON.stringify(FP_V10.casePrompts.get(c.id))).map((c) => c.id),
			'arrangement: a case that moved under an id version nine holds'
		).toEqual([]);
		expect(V10_CASES.filter((c) => BRIDGE_V9.includes(c.id)), 'arrangement: version nine’s 19 ids, no case of ~~today’s set~~ version ten').toEqual([]);
		expect(V9_CASES.filter((c) => c.arm === 'PWA_TYPE').map((c) => c.id).slice(0, 19), 'arrangement: version nine’s 19, as its run records them').toEqual(BRIDGE_V9);
		expect(SOFTWARE().length, 'the software part cases').toBe(16);
		const v8 = await v8Run();
		const lines = [...v8, ...(await restamped(v8)), ...(await v9Parts()), select(GLM)];
		expect((await onVersionNine([file(lines)])).problems, 'CONTROL: the record as it stood under version nine').toEqual([]);
		expect((await onVersionTen([file(lines)])).problems).toEqual([
			{ limb: 'COVERAGE', message: owed('any', BRIDGE, lines) },
			{ limb: 'COVERAGE', message: owed('selected', BRIDGE, lines) }
			// ~~{ limb: 'REPRODUCTION', message: V9_PARTS_DO_NOT_REPRODUCE() }~~ ⭐ D3b (8): none.
		]);
	});

	it('⭐ ~~⛔ A RUN OVER THE 19 DOES NOT TURN IT GREEN~~ ⭐ A RUN OVER THE 19 TURNS IT GREEN (REG-D-132) — the selected candidate’s run of the 19 ⭐ under their new ids, under today’s fingerprint, each as its oracle expects, discharges their coverage, and v9’s part run ~~still does not reproduce: that problem alone, unchanged~~ ⭐ reproduces: nothing owed. CONTROL: without the run, the 19’s coverage alone', async () => {
		const v8 = await v8Run();
		const lines = [
			...v8,
			...(await restamped(v8)),
			...(await v9Parts()),
			...(await v10Run('qr-v10-bridge', BRIDGE, '2026-10-25T10:00:00.000Z')),
			select(GLM)
		];
		// ~~[{ limb: 'REPRODUCTION', message: V9_PARTS_DO_NOT_REPRODUCE() }]~~ ⭐ D3b (8): GREEN.
		expect((await onVersionTen([file(lines)])).problems, 'the 19 run under their new ids: nothing owed').toEqual([]);
		const v8Again = await v8Run();
		const without = [...v8Again, ...(await restamped(v8Again)), ...(await v9Parts()), select(GLM)];
		expect((await onVersionTen([file(without)])).problems.map((p) => p.limb), 'CONTROL: without the run, the 19’s coverage alone').toEqual(['COVERAGE', 'COVERAGE']);
	});

	it('⭐ ~~A SUPERSEDED LINE STRIKES THE WHOLE RUN — citing a register finding, it discharges the reproduction problem, and the 16 software part cases v9’s part run alone covered are owed again, by any candidate and by the selected one; a run over them too is GREEN.~~ ⭐ A SUPERSEDED LINE IS NOT OWED, AND REFUSED (REG-D-132) — v9’s part run reproduces under version ten, so a line striking it, citing a register finding, is refused, and the coverage it gives the 16 software part cases stands. CONTROL: under version nine the same line is refused, the run reproducing there', async () => {
		const v8 = await v8Run();
		const before = [
			...v8,
			...(await restamped(v8)),
			...(await v9Parts()),
			...(await v10Run('qr-v10-bridge', BRIDGE, '2026-10-25T10:00:00.000Z'))
		];
		const struck = [...before, strikeV9Parts, select(GLM)];
		// ~~the 16 software part cases owed again, by any candidate and by the selected one~~ ⭐ D3b (8): the line refused, the
		// run unstruck, the 16 covered by it still.
		expect((await onVersionTen([file(struck)])).problems).toEqual([{ limb: 'REPRODUCTION', message: STRIKE_REFUSED(struck.length - 1) }]);
		const all35 = [...before, strikeV9Parts, ...(await v10Run('qr-v10-software', SOFTWARE(), '2026-10-25T14:00:00.000Z')), select(GLM)];
		// ~~'the 35 run under version ten: nothing owed'~~ ⭐ D3b (8): a run over the 16 besides changes nothing — the line is
		// refused still, as the run it names reproduces.
		expect((await onVersionTen([file(all35)])).problems, 'the 35 run under version ten: the refusal alone').toEqual([
			{ limb: 'REPRODUCTION', message: STRIKE_REFUSED(before.length + 1) }
		]);
		const underNine = [...v8, ...(await restamped(v8)), ...(await v9Parts()), strikeV9Parts, select(GLM)];
		expect(limb(await onVersionNine([file(underNine)]), 'REPRODUCTION'), 'CONTROL: under version nine it reproduces').toBe(
			STRIKE_REFUSED(underNine.length - 1)
		);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B8b, package K (`REG-D-133`; DESIGN-authoring-review-in-parts.md D3d and §5) ──
// Version eleven is current, and D3d moved NO fingerprint: of version ten's 76 cases only the 7 whose prompts the options
// study's restated purpose reaches moved, and under NEW ids (`G11-…`). So the record's shape since `7ff7d21d` — version nine's
// part run and the carried cases' re-stamping, as the B8b describe builds them, then the selected candidate's run of version
// ten's 19 bridge part cases under today's fingerprint, two repetitions, the options study's second reading REJECTED on RR-01
// and escalated (`REG-F-572`) — owes coverage of exactly the 7 under their new ids, by any candidate and by the selected one;
// limb 2 finds every run reproducing, the 12 bridge part cases version eleven keeps sending version ten's prompts and the 7
// under ids version eleven no longer holds; and the escalation of a case version eleven no longer holds still answers for it.
// PREDICTED in the ruling ("the 7 cases at two repetitions ... and `reviewer:qual:check` GREEN"), and pinned here over the
// record's shape: until that measurement, the two COVERAGE problems alone.
describe('⭐⭐ the review in parts, B8b, package K — under case set v11 and an UNMOVED fingerprint, v10’s record shape owes coverage of exactly the 7 bridge part cases D3d moved, under their new ids, and nothing else: no REPRODUCTION problem, and the escalated options-study reading still answered; a run over the 7 turns it GREEN (REG-D-133, REG-D-086)', () => {
	const GLM: SelectedCandidate = { transport: 'devin', modelLabel: 'glm-5-3-flash-max' };
	/** The 7 D3d moved, as `reviewer:qual:check` names them, in the set's order — under their new ids. */
	const SEVEN = ['G11-CLEAN.T01', 'G11-CLEAN.T03', 'G11-CLEAN-R1.T01', 'G11-CLEAN-R2.T01', 'G11-CLEAN-R3.T01', 'G11-RR-02.T01', 'G11-RR-09.T01'];
	/** …and under version ten's, as its run records them. */
	const SEVEN_V10 = ['G10-CLEAN.T01', 'G10-CLEAN.T03', 'G10-CLEAN-R1.T01', 'G10-CLEAN-R2.T01', 'G10-CLEAN-R3.T01', 'G10-RR-02.T01', 'G10-RR-09.T01'];
	/** Version ten's 19 bridge part cases, as its run records them. */
	const BRIDGE_V10 = (): string[] => V10_CASES.filter((c) => c.arm === 'PWA_TYPE' && c.sourceCaseId.startsWith('G10-')).map((c) => c.id);
	const RR01 = SEEDED_REASONING_REVIEW_CRITERIA[0]!.id;
	/** ~~Today's set~~ ⭐ package V: version eleven — and its oracles, under their committed statement: a fixed fixture since version
	 *  twelve (`V11_SET`). */
	const onVersionEleven = (files: CheckInputs['files']) =>
		check(files, { current: FP_V11, cases: V11_CASES, oracles: V11_ORACLES.oracles, conferral: V11_ORACLES.conferral });
	/** Version ten and its oracles, under their committed statement: the CONTROL, the same record under the set it was made for. */
	const onVersionTen = (files: CheckInputs['files']) =>
		check(files, { current: FP_V10, cases: V10_CASES, oracles: V10_ORACLES.oracles, conferral: V10_ORACLES.conferral });
	/** The definition before D3a: today's but for the probes, which D3a moved. */
	const BEFORE_D3A = (): RunFingerprint => ({ ...moved('probes'), caseSet: FP_V8.caseSet });
	const v8Run = (): Promise<RecordLine[]> =>
		recorded({
			runId: 'qr-v8-before-d3a',
			date: '2026-10-24T10:00:00.000Z',
			candidate: DEVIN,
			cases: V8_CASES,
			fingerprint: BEFORE_D3A(),
			versions: { caseSet: 8, oracles: 8 }
		});
	/** Its 41 carried cases re-stamped under today's fingerprint, as version nine's set stood. */
	const restamped = (lines: readonly RecordLine[]) =>
		rescoredLines(
			lines.find((l): l is RunLine => l.kind === 'RUN')!,
			lines.filter((l): l is CallLine => l.kind === 'CALL'),
			V9_CASES,
			FP_V9.casePrompts,
			{
				rescoreId: 'rs-v8-before-d3a',
				date: '2026-10-24T12:00:00.000Z',
				commit: 'b'.repeat(40),
				reviewer: FP.reviewer,
				scoring: FP.scoring,
				caseSet: FP_V9.caseSet
			}
		);
	/** The selected candidate's run of version nine's 35 part cases under today's fingerprint, two repetitions, as 14c141af's. */
	const v9Parts = () =>
		recorded({
			runId: 'qr-v9-parts',
			date: '2026-10-24T14:00:00.000Z',
			candidate: DEVIN,
			cases: V9_CASES.filter((c) => c.arm === 'PWA_TYPE'),
			fingerprint: { ...CURRENT, caseSet: FP_V9.caseSet },
			repetitions: 2,
			versions: { caseSet: 9, oracles: 9 }
		});
	/**
	 * The selected candidate's run of version ten's 19 bridge part cases under today's fingerprint, two repetitions, as
	 * 7ff7d21d's: each as its oracle expects, but the options study's second reading, REJECTED on RR-01 alone.
	 */
	const v10Bridge = () => {
		let study = 0;
		return recorded({
			runId: 'qr-v10-bridge',
			date: '2026-10-25T10:00:00.000Z',
			candidate: DEVIN,
			cases: V10_CASES.filter((c) => BRIDGE_V10().includes(c.id)),
			fingerprint: { ...CURRENT, caseSet: FP_V10.caseSet },
			repetitions: 2,
			versions: { caseSet: 10, oracles: 10 },
			reply: (id) => (id === 'G10-CLEAN.T03' && ++study === 2 ? judgement([RR01]) : asOracle(id))
		});
	};
	/** Its one material failure, escalated, citing a finding the register holds — as `REG-F-572` is cited on the record. */
	const escalated = escalate('qr-v10-bridge', ['G10-CLEAN.T03']);
	/** A run of the selected candidate over some of version eleven's cases under today's fingerprint, as their oracles expect. */
	const v11Run = (runId: string, ids: readonly string[], date: string) =>
		recorded({
			runId,
			date,
			candidate: DEVIN,
			cases: V11_CASES.filter((c) => ids.includes(c.id)), // ⭐ package V — ~~CURRENT_CASES~~
			fingerprint: { ...CURRENT, caseSet: FP_V11.caseSet }, // ⭐ package V — ~~FP_NOW~~
			repetitions: 2,
			versions: { caseSet: 11, oracles: 11 }
		});
	const owed = (who: 'any' | 'selected', ids: readonly string[], lines: readonly RecordLine[]) =>
		who === 'any'
			? `${ids.length} of 76 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${ids.join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
			: `${ids.length} of 76 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate devin / glm-5-3-flash-max (REG-D-084; the SELECTION in force, runs.ndjson:${lines.length}): ${ids.join(', ')} — owed: a run of the selected candidate over them, or RESCORED lines of its runs where no case prompt changed (§5.6 limb 1; REG-D-086)`;
	/** The record's shape since 7ff7d21d. */
	const asRecorded = async (): Promise<RecordLine[]> => {
		const v8 = await v8Run();
		return [...v8, ...(await restamped(v8)), ...(await v9Parts()), ...(await v10Bridge()), escalated];
	};

	it('⛔ RED, AND EXACTLY SO — coverage of exactly the 7 under their new ids, by any candidate and by the selected one, and nothing else: no REPRODUCTION problem, no ESCALATION problem, no CONFERRAL problem, the 69 others covered as they stand. CONTROL: under version ten the same record is GREEN; and without its ESCALATION line the options study’s reading owes one under version ten, and under version eleven — limb 3 judging it against today’s oracles, which hold no G10-CLEAN.T03 — nothing more, the present behaviour pinned', async () => {
		// ⭐ Package V — ~~'the current set is version eleven'~~: version eleven's committed set, a fixed fixture since version twelve;
		// ~~`CURRENT_*`, `FP_NOW`~~ below, each `V11_*` and `FP_V11`.
		expect([V11_SET.caseSetVersion, V11_ORACLES.oracleVersion], 'version eleven').toEqual([11, 11]);
		expect(FP_V11.reviewer, 'arrangement: D3d moved no fingerprint').toBe(FP_V10.reviewer);
		expect(FP_V11.caseSet, 'arrangement: the case-set digest moved').not.toBe(FP_V10.caseSet);
		expect(
			V11_CASES.filter((c) => !FP_V10.casePrompts.has(c.id)).map((c) => c.id),
			'arrangement: the 7, and only they, under ids version ten does not hold'
		).toEqual(SEVEN);
		expect(
			V11_CASES.filter((c) => FP_V10.casePrompts.has(c.id) && JSON.stringify(FP_V10.casePrompts.get(c.id)) !== JSON.stringify(FP_V11.casePrompts.get(c.id))).map((c) => c.id),
			'arrangement: a case that moved under an id version ten holds'
		).toEqual([]);
		expect(V11_CASES.filter((c) => SEVEN_V10.includes(c.id)), 'arrangement: the 7’s version-ten ids, no case of ~~today’s set~~ version eleven').toEqual([]);
		expect(BRIDGE_V10().filter((id) => SEVEN_V10.includes(id)), 'arrangement: version ten’s run records the 7 under their old ids').toEqual(SEVEN_V10);
		const lines = [...(await asRecorded()), select(GLM)];
		expect((await onVersionEleven([file(lines)])).problems).toEqual([
			{ limb: 'COVERAGE', message: owed('any', SEVEN, lines) },
			{ limb: 'COVERAGE', message: owed('selected', SEVEN, lines) }
		]);
		expect((await onVersionTen([file(lines)])).problems, 'CONTROL: the record as it stood under version ten').toEqual([]);
		// ⭑ CONTROL — the ESCALATION line is what answers for the options study's reading under version ten: without it, version
		// ten owes one. ⚠ PRESENT BEHAVIOUR, PINNED AS IT STANDS: ~~(package K's report, for the lead)~~ ⭐ package K's check — a
		// residual the register already records and the sponsor confirmed, not one package K found: `REG-D-075`'s RESIDUALS,
		// *"An un-cited failure vanishes when its case leaves the set, because failures are judged against today's oracles."*,
		// ✅ CONFIRMED by `REG-D-078` (*"3 - Your delegated calls for REG-D-075, REG-D-076, and REG-D-077 are all approved."*).
		// Under version eleven the same reading is no material failure at all — limb 3 judges a record's evaluations against
		// TODAY'S oracles (`check-core.ts`, `absolute`), which hold none for G10-CLEAN.T03, renamed since — so without the line
		// version eleven owes nothing more. Whether limb 3 should judge a past evaluation against the oracle set of the version
		// its run measured, as D3c now holds an ACKNOWLEDGED line to every committed case set (`REG-F-576`), reopens that
		// confirmed residual: the lead's, not package K's. A fix that does so reddens the assertion below, under its label.
		const unescalated = lines.filter((l) => l !== escalated);
		expect(limb(await onVersionTen([file(unescalated)]), 'ESCALATION'), 'CONTROL: under version ten, unescalated, the reading owes its ESCALATION').toContain(
			'qr-v10-bridge: G10-CLEAN.T03 — CLEAN_NOT_SATISFIED'
		);
		expect((await onVersionEleven([file(unescalated)])).problems, 'present behaviour, REG-D-075’s residual (confirmed, REG-D-078: “An un-cited failure vanishes when its case leaves the set”): under version eleven the renamed case’s reading is judged against no oracle').toEqual([
			{ limb: 'COVERAGE', message: owed('any', SEVEN, unescalated) },
			{ limb: 'COVERAGE', message: owed('selected', SEVEN, unescalated) }
		]);
	});

	it('⭐ A RUN OVER THE 7 TURNS IT GREEN — the selected candidate’s run of the 7 under their new ids, under today’s fingerprint, each as its oracle expects, discharges their coverage: nothing owed. CONTROL: a run over the 7 by another candidate leaves the selected candidate’s coverage owed', async () => {
		const lines = [...(await asRecorded()), ...(await v11Run('qr-v11-bridge', SEVEN, '2026-10-26T10:00:00.000Z')), select(GLM)];
		expect((await onVersionEleven([file(lines)])).problems, 'the 7 run under their new ids: nothing owed').toEqual([]);
		const other = await recorded({
			runId: 'qr-v11-bridge-agy',
			date: '2026-10-26T10:00:00.000Z',
			cases: V11_CASES.filter((c) => SEVEN.includes(c.id)), // ⭐ package V — ~~CURRENT_CASES~~
			fingerprint: { ...CURRENT, caseSet: FP_V11.caseSet }, // ⭐ package V — ~~FP_NOW~~
			repetitions: 2,
			versions: { caseSet: 11, oracles: 11 }
		});
		const byAnother = [...(await asRecorded()), ...other, select(GLM)];
		expect((await onVersionEleven([file(byAnother)])).problems, 'CONTROL: run by another candidate, the selected one’s coverage owed').toEqual([
			{ limb: 'COVERAGE', message: owed('selected', SEVEN, byAnother) }
		]);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, before P6 again, package V (`REG-D-136`; DESIGN-data-flow-order-and-deliverable-review.md D14) ────
// Version twelve is current, and packages L and N moved the reviewer fingerprint after version eleven was measured. Of version
// twelve's 91 cases, the 35 part cases send version eleven's prompts under its ids, and the 56 — version eleven's 41 non-part
// cases re-cast under new ids, and 15 new — send prompts no run has measured. So the record's shape — the selected candidate's
// run of version eleven under the fingerprint before L and N, every case answered as its oracle expects — owes, under version
// twelve, coverage of all 91, by any candidate and by the selected one, naming the 35 as the same prompts under an earlier
// fingerprint, which RESCORED lines discharge. ⚠ AND AN ACKNOWLEDGED LINE (§5.6 limb 1), as version eight's shape did: no case
// prompt that run recorded shows the move — its 41 non-part cases are no case of version twelve, and the 35's prompts did not
// move — so the check asks for the line naming today's fingerprint, with the cases added to exercise the change: the 56. And
// nothing else: no REPRODUCTION, RECORD or CONFERRAL problem. ⭑ What turns it GREEN is what `REG-D-136` (4) plans — a run of the
// selected candidate over the 56, and RESCORED lines for the 35 — AND that line, which the ruling's plan does not name.
// ⚠ PRESENT BEHAVIOUR, PINNED FOR THE LEAD: on the committed record the run the check names is version one's first
// (`qr-2026-09-24-agy-gemini-3.1-pro-high`), none of whose cases version twelve holds: the move since a fingerprint none of
// whose recorded cases is still in the set is shown to reach no case prompt. The last limb holds that, beside its CONTROL.
describe('⭐⭐ package V — under case set v12 and the fingerprint L and N moved, the selected candidate’s run of v11 owes coverage of all 91 — RESCORED lines for the 35 part cases, a run over the 56 new or changed — and an ACKNOWLEDGED line; nothing else (REG-D-136, REG-D-086)', () => {
	const GLM: SelectedCandidate = { transport: 'devin', modelLabel: 'glm-5-3-flash-max' };
	const PARTS = (): string[] => CURRENT_CASES.filter((c) => c.arm === 'PWA_TYPE').map((c) => c.id);
	const FIFTY_SIX = (): string[] => CURRENT_CASES.filter((c) => c.arm !== 'PWA_TYPE').map((c) => c.id);
	/** Today's set — version twelve — and its oracles, under their committed statement. */
	const onVersionTwelve = (files: CheckInputs['files']) =>
		check(files, { current: FP_NOW, cases: CURRENT_CASES, oracles: CURRENT_ORACLES.oracles, conferral: CURRENT_ORACLES.conferral });
	/** The definition before packages L and N: today's but for the probes. */
	const BEFORE_L_AND_N = (): RunFingerprint => ({ ...moved('probes'), caseSet: FP_V11.caseSet });
	/** The selected candidate's run of version eleven under it, every case answered as its oracle expects. */
	const v11Run = (): Promise<RecordLine[]> =>
		recorded({
			runId: 'qr-v11-before-l-n',
			date: '2026-10-25T18:00:00.000Z',
			candidate: DEVIN,
			cases: V11_CASES,
			fingerprint: BEFORE_L_AND_N(),
			versions: { caseSet: 11, oracles: 11 }
		});
	const owed = (who: 'any' | 'selected', ids: readonly string[], lines: readonly RecordLine[]) =>
		who === 'any'
			? `${ids.length} of 91 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${ids.join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
			: `${ids.length} of 91 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate devin / glm-5-3-flash-max (REG-D-084; the SELECTION in force, runs.ndjson:${lines.length}): ${ids.join(', ')} — owed: a run of the selected candidate over them, or RESCORED lines of its runs where no case prompt changed (§5.6 limb 1; REG-D-086)`;
	const hint = (ids: readonly string[]) =>
		`same prompts under an earlier fingerprint in qr-v11-before-l-n: ${ids.join(', ')} — RESCORED lines discharge those where no case prompt changed (§5.6 limb 1)`;
	/** The ACKNOWLEDGED line §5.6 limb 1 asks for, as the check words it. */
	const acknowledgementOwed = (since: string): string =>
		`the reviewer fingerprint moved outside every case prompt since ${since} — the probe set, the budget or the ` +
		`criteria moved, and no case prompt recorded under it differs from today’s: an ACKNOWLEDGED line naming ${FP.reviewer} ` +
		'is owed, with the case added to exercise the change or the reason none is needed, whatever runs exist under it (§5.6 limb 1)';
	/** That line: today's fingerprint, the 56 the cases added to exercise the move. */
	const acknowledged = (): RecordLine => ({
		kind: 'ACKNOWLEDGED',
		date: '2026-10-26T13:00:00.000Z',
		reviewerFingerprint: FP.reviewer,
		addedCaseIds: FIFTY_SIX()
	});
	/** RESCORED lines of that run under today's fingerprint: each of its evaluations of a current case whose prompts are today's. */
	const restampToday = (lines: readonly RecordLine[]) =>
		rescoredLines(
			lines.find((l): l is RunLine => l.kind === 'RUN')!,
			lines.filter((l): l is CallLine => l.kind === 'CALL'),
			CURRENT_CASES,
			FP_NOW.casePrompts,
			{
				rescoreId: 'rs-v11-before-l-n',
				date: '2026-10-26T12:00:00.000Z',
				commit: 'b'.repeat(40),
				reviewer: FP.reviewer,
				scoring: FP.scoring,
				caseSet: FP_NOW.caseSet
			}
		);
	/** The selected candidate's run of the 56 under today's fingerprint, two repetitions, as their oracles expect. */
	const run56 = () =>
		recorded({
			runId: 'qr-v12-new',
			date: '2026-10-26T14:00:00.000Z',
			candidate: DEVIN,
			cases: CURRENT_CASES.filter((c) => c.arm !== 'PWA_TYPE'),
			fingerprint: { ...CURRENT, caseSet: FP_NOW.caseSet },
			repetitions: 2,
			versions: { caseSet: 12, oracles: 12 }
		});

	it('⛔ RED, AND EXACTLY SO — an ACKNOWLEDGED line owed, the move reaching no recorded case prompt; coverage of all 91, by any candidate and by the selected one, each naming the 35 part cases, whose prompts did not move, as RESCORED lines discharge them; no REPRODUCTION, RECORD or CONFERRAL problem, nothing else', async () => {
		expect([CURRENT_SET.caseSetVersion, CURRENT_ORACLES.oracleVersion], 'the current set is version twelve').toEqual([12, 12]);
		expect([PARTS().length, FIFTY_SIX().length], 'part cases, the others').toEqual([35, 56]);
		expect(FP.reviewer, 'arrangement: the run’s fingerprint is not today’s').not.toBe(BEFORE_L_AND_N().reviewer);
		expect(FIFTY_SIX().filter((id) => V11_CASES.some((c) => c.id === id)), 'arrangement: version eleven holds none of the 56').toEqual([]);
		const lines = [...(await v11Run()), select(GLM)];
		const all = CURRENT_CASES.map((c) => c.id);
		expect((await onVersionTwelve([file(lines)])).problems).toEqual([
			{ limb: 'COVERAGE', message: acknowledgementOwed('run qr-v11-before-l-n') },
			{ limb: 'COVERAGE', message: [owed('any', all, lines), hint(PARTS())].join('\n    ') },
			{ limb: 'COVERAGE', message: [owed('selected', all, lines), hint(PARTS())].join('\n    ') }
		]);
	});

	it('⭐ RESCORED lines of that run for the 35, the ACKNOWLEDGED line naming the 56 added, and a run of the selected candidate over the 56 under today’s fingerprint, each answered as its oracle expects: GREEN; without the line, it alone is owed; without the run, the 56 alone, by any candidate and by the selected one; without the RESCORED lines, the 35 alone', async () => {
		const v11 = await v11Run();
		const rescored = await restampToday(v11);
		expect(rescored.map((l) => l.caseId), 'the 35, and none of the 56: no record holds one of their prompts').toEqual(PARTS());
		const fiftySix = await run56();
		const whole = [...v11, ...rescored, acknowledged(), ...fiftySix, select(GLM)];
		expect((await onVersionTwelve([file(whole)])).problems, 'nothing owed').toEqual([]);
		const withoutLine = [...v11, ...rescored, ...fiftySix, select(GLM)];
		expect((await onVersionTwelve([file(withoutLine)])).problems, 'without the line, it alone').toEqual([
			{ limb: 'COVERAGE', message: acknowledgementOwed('run qr-v11-before-l-n') }
		]);
		const withoutRun = [...v11, ...rescored, acknowledged(), select(GLM)];
		expect((await onVersionTwelve([file(withoutRun)])).problems, 'without the run, the 56 alone, by any candidate and by the selected one').toEqual([
			{ limb: 'COVERAGE', message: owed('any', FIFTY_SIX(), withoutRun) },
			{ limb: 'COVERAGE', message: owed('selected', FIFTY_SIX(), withoutRun) }
		]);
		const withoutRescores = [...v11, acknowledged(), ...fiftySix, select(GLM)];
		expect((await onVersionTwelve([file(withoutRescores)])).problems, 'without the RESCORED lines, the 35 alone, the run naming them').toEqual([
			{ limb: 'COVERAGE', message: [owed('any', PARTS(), withoutRescores), hint(PARTS())].join('\n    ') },
			{ limb: 'COVERAGE', message: [owed('selected', PARTS(), withoutRescores), hint(PARTS())].join('\n    ') }
		]);
	});

	it('⚠ PRESENT BEHAVIOUR, PINNED FOR THE LEAD — a run under an earlier fingerprint none of whose cases version twelve holds owes the ACKNOWLEDGED line by itself: no case prompt recorded under it is a current case’s, so none shows the move, as on the committed record, whose first run is version one’s. CONTROL: under version eleven, which holds its work-product cases, one of them recorded with another prompt shows the move, and the line is not owed', async () => {
		const v1 = tamper(await recorded({ runId: 'qr-v1-before', cases: CASES, fingerprint: moved('probes') }), 'W-CLEAN', (c) => ({
			...c,
			promptSha256: sha256(`${c.promptSha256} — not today’s`)
		}));
		expect(CASES.filter((c) => CURRENT_CASES.some((x) => x.id === c.id)).map((c) => c.id), 'arrangement: version twelve holds none of version one’s cases').toEqual([]);
		expect(CASES.filter((c) => V11_CASES.some((x) => x.id === c.id)), 'arrangement: version eleven holds version one’s 13 work-product cases').toHaveLength(13);
		const acknowledgement = (r: CheckReport) =>
			r.problems.filter((p) => p.message.startsWith('the reviewer fingerprint moved outside every case prompt')).map((p) => p.message);
		expect(acknowledgement(await onVersionTwelve([file(v1)])), 'under version twelve: owed, no current case recorded under it').toEqual([
			acknowledgementOwed('run qr-v1-before')
		]);
		const onVersionEleven = await check([file(v1)], { current: FP_V11, cases: V11_CASES, oracles: V11_ORACLES.oracles, conferral: V11_ORACLES.conferral });
		expect(acknowledgement(onVersionEleven), 'CONTROL: under version eleven, W-CLEAN’s recorded prompt shows the move').toEqual([]);
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

	it('⛔ GUARD — a planted case whose verdict is not REJECTED stays MATERIAL: every disposition the floor gives short of REJECTED (SATISFIED, BOUNDARY_REJECTED with the planted criterion faulted, INCONCLUSIVE, VALIDATOR_FAILED, ESCALATED), and every other one a record can carry', async () => {
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
		// — REJECTED, INCONCLUSIVE or SATISFIED here — and then `REG-D-089`'s rule (a), a second pass in
		// `composeAssuranceOutcome` (`packages/rph-assurance/src/floor.ts`), which gives ESCALATED for a clean, fully
		// answered reply that recommends it. An INCONCLUSIVE faults nothing (a fault would reject), a VALIDATOR_FAILED
		// records no criterion, an ESCALATED faults nothing either (the rule reads a computed SATISFIED); none is the
		// oracle's REJECTED.
		// ⭑ `JAN-ESCREC` ER-2 (design D4): the ESCALATED arm is driven by a REAL reply — the scoring corpus's own
		// `escalated-clean`, the one the reviewer fingerprint pins to ESCALATED — through the real runner and validator, so
		// limb 3 is shown to read the disposition rule (a) actually gives; until ER-2 only a tampered line reached it.
		const escalatedClean = scoringCorpus(SEEDED_REASONING_REVIEW_CRITERIA).find((e) => e.id === 'escalated-clean')?.replies[0];
		expect(typeof escalatedClean, 'the corpus’s escalated-clean reply, a raw reply').toBe('string');
		const arms: readonly [runId: string, reply: string, disposition: string][] = [
			['qr-verdict-3', omitting(RR08, []), 'INCONCLUSIVE'],
			['qr-verdict-4', 'I think it is fine.', 'VALIDATOR_FAILED'],
			['qr-verdict-5', escalatedClean as string, 'ESCALATED']
		];
		for (const [runId, reply, disposition] of arms) {
			const lines = await recorded({ runId, reply: (id) => (id === 'G-RR-04' ? reply : asOracle(id)) });
			expect(scoredIn(lines, 'G-RR-04').map((x) => x.disposition), `the arrangement: ${disposition}`).toEqual([disposition]);
			expect(limb(await check([file(lines)]), 'ESCALATION'), disposition).toBe(unCited(runId, 'G-RR-04 — PLANTED_DEFECT_NOT_REJECTED'));
		}
		// ⭐ AND EVERY OTHER DISPOSITION A RECORD CAN CARRY, which this floor does not give today — CONDITIONALLY_SATISFIED
		// needs an open MATERIAL finding or a PARTIALLY_MET row, and every Reasoning Review criterion is BLOCKING and
		// emits neither; MISSING needs no result at all. A line can still hold one (an earlier runner's, or one written by
		// hand), and limb 3 reads the disposition as recorded: under an earlier fingerprint, so limb 2 does not re-score it.
		// ⭑ `JAN-ESCREC` ER-2 (D4): ESCALATED is in `driven` — the `arms` row above reaches it with a real reply — so the
		// hand-written set and the enumeration of the rest still cover every disposition between them.
		const driven = new Set(['REJECTED', 'SATISFIED', 'BOUNDARY_REJECTED', 'INCONCLUSIVE', 'VALIDATOR_FAILED', 'ESCALATED']);
		const rest = SCORED_DISPOSITIONS.filter((d) => !driven.has(d));
		expect(rest).toEqual(['CONDITIONALLY_SATISFIED', 'MISSING']);
		for (const d of rest) {
			const runId = `qr-verdict-${d.toLowerCase()}`;
			const lines = tamper(await recorded({ runId, fingerprint: moved('scoring') }), 'G-RR-04', (c) => ({
				...c,
				scored: c.scored && { ...c.scored, disposition: d }
			}));
			expect(limb(await check([file(lines)]), 'ESCALATION'), d).toBe(unCited(runId, 'G-RR-04 — PLANTED_DEFECT_NOT_REJECTED'));
		}
	});

	it('⛔ GUARD (the ER-2 verifier’s finding [0]) — a CLEAN case its reviewer ESCALATES is not the right verdict: CLEAN_NOT_SATISFIED, and VERDICT_CHANGES_WITH_NAME on a renamed copy it then differs from', async () => {
		// ⭑ `REG-D-089`'s rule (a) fires only where the ladder computed SATISFIED (`REG-D-090`), so in qualification it lands
		// on a CLEAN case — the place it matters, and the one the `arms` row above, a planted case, never reaches. The pass
		// bar there is SATISFIED (`REG-D-080`), and ESCALATED is not it: a reviewer that sends every clean work product to a
		// human has not given the right verdict. The reply is the scoring corpus's own `escalated-clean`, through the real
		// runner and validator.
		const escalatedClean = scoringCorpus(SEEDED_REASONING_REVIEW_CRITERIA).find((e) => e.id === 'escalated-clean')?.replies[0];
		expect(typeof escalatedClean, 'the corpus’s escalated-clean reply, a raw reply').toBe('string');
		const rows: readonly [runId: string, escalated: readonly string[], owed: readonly string[]][] = [
			// The base case alone: its renamed copy, SATISFIED, now differs from it.
			['qr-verdict-clean-1', ['G-CLEAN'], ['G-CLEAN — CLEAN_NOT_SATISFIED', 'G-CLEAN-R1 — VERDICT_CHANGES_WITH_NAME']],
			// Every clean case: the copies agree, and each misses the bar.
			['qr-verdict-clean-2', ['G-CLEAN', 'G-CLEAN-R1'], ['G-CLEAN — CLEAN_NOT_SATISFIED', 'G-CLEAN-R1 — CLEAN_NOT_SATISFIED']]
		];
		for (const [runId, escalated, owed] of rows) {
			const lines = await recorded({ runId, reply: (id) => (escalated.includes(id) ? (escalatedClean as string) : asOracle(id)) });
			for (const id of ['G-CLEAN', 'G-CLEAN-R1'])
				expect(scoredIn(lines, id).map((x) => x.disposition), `the arrangement: ${runId} ${id}`).toEqual([
					escalated.includes(id) ? 'ESCALATED' : 'SATISFIED'
				]);
			expect(limb(await check([file(lines)]), 'ESCALATION'), runId).toBe(owed.map((u) => unCited(runId, u)).join('\n'));
			expect((await check([file([...lines, escalate(runId, ['G-CLEAN', 'G-CLEAN-R1'])])])).problems, `CONTROL: ${runId} escalated, green`).toEqual([]);
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
			FP.casePrompts,
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
		// Version one's 26 cases against today's set: ~~10 planted cases are still in it; G-RR-02…09~~ ⭐ B7 — version eight holds
		// none of version one's graph cases: its 9 planted work-product cases are still in it; G-RR-01…09, planted in version
		// one, are not — and nor are its 4 clean graph cases, which were never in M.
		// ⭐ Package V (`REG-D-136`) — ~~today's set~~: so it stood through version eleven, a fixed fixture now (`V11_SET`), the mix
		// this limb asks of, counted in and counted out. Version twelve, today's, re-casts version one's 13 work-product cases
		// under new ids, so all 26 are outside it — counted out aloud below.
		const v1Record = await recorded({ runId: 'qr-attr-8', cases: CASES });
		const onVersionEleven = (over: Partial<Omit<CheckInputs, 'files'>> = {}) =>
			check([file(v1Record)], { current: FP_V11, cases: V11_CASES, oracles: V11_ORACLES.oracles, ...over });
		const head8 = head('qr-attr-8', 9, 9);
		expect((await onVersionEleven()).attribution).toEqual([
			`${head8} (9 answered planted evaluation(s) of cases not in the current set are not counted)`
		]);
		// Its own version is what says which were planted: not held, they are still counted out — as of unknown standing.
		expect((await onVersionEleven({ oracleSets: [V11_ORACLES] })).attribution).toEqual([
			`${head8} (13 answered evaluation(s) of cases not in the current set are not counted: oracles v1, which say which were planted, are not held)`
		]);
		// ⭐ Package V — and today's set, version twelve, which holds none of the 26: every planted evaluation counted out aloud, by
		// the record's own version; and, that version not held, every evaluation, as of unknown standing.
		const onTheCurrentSet = (over: Partial<Omit<CheckInputs, 'files'>> = {}) =>
			check([file(v1Record)], { current: FP_NOW, cases: CURRENT_CASES, oracles: CURRENT_ORACLES.oracles, ...over });
		const head0 = head('qr-attr-8', 0, 0);
		expect((await onTheCurrentSet()).attribution, 'today’s set, version twelve').toEqual([
			`${head0} (18 answered planted evaluation(s) of cases not in the current set are not counted)`
		]);
		expect((await onTheCurrentSet({ oracleSets: [CURRENT_ORACLES] })).attribution, 'today’s set, version twelve, version one not held').toEqual([
			`${head0} (26 answered evaluation(s) of cases not in the current set are not counted: oracles v1, which say which were planted, are not held)`
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

// ── ⭐ `JAN-SELREV` SR-4 — the gate holds the SELECTED reviewer to today's definition (`REG-D-086`) ──────────────────
// DESIGN-the-selected-reviewer.md §5 Q1, ruled yes. With a SELECTION in force, limb 1 asks its own question — covered,
// in exactly its sense — again of the SELECTED candidate's runs alone: a RUN of it under today's fingerprint, or a
// RESCORED record of one ~~where only the scoring moved~~ where no case prompt changed (`JAN-PRQUAL` `PQ-1`). With none
// in force the check is what it was: every limb above runs with no SELECTION, and each is that control.
describe('JAN-SELREV SR-4 — with a SELECTION in force, every current case is owed a measurement of the SELECTED candidate under today’s fingerprint (REG-D-086)', () => {
	const GLM: SelectedCandidate = { transport: 'devin', modelLabel: 'glm-5-3-flash-max' };
	const NEVER_RUN: SelectedCandidate = { transport: 'devin', modelLabel: 'a-model-never-run' };
	const ALL = SUBSET.map((c) => c.id);
	/** Where the check places a line of a one-file record: `runs.ndjson:<n>`. */
	const at = (lines: readonly RecordLine[], line: RecordLine) => `runs.ndjson:${lines.indexOf(line) + 1}`;
	/** The COVERAGE problem SR-4 adds, verbatim: the selected candidate, its ruling, where the line is, what is owed. */
	const owedBy = (c: SelectedCandidate, where: string, missing: readonly string[], ruling = 'REG-D-084') =>
		`${missing.length} of ${SUBSET.length} current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate ${c.transport} / ${c.modelLabel} (${ruling}; the SELECTION in force, ${where}): ${missing.join(', ')} — owed: a run of the selected candidate over them, or RESCORED lines of its runs where no case prompt changed (§5.6 limb 1; REG-D-086)`;
	const restamp = (lines: readonly RecordLine[], rescoreId: string) =>
		rescoredLines(
			lines.find((l): l is RunLine => l.kind === 'RUN')!,
			lines.filter((l): l is CallLine => l.kind === 'CALL'),
			SUBSET,
			FP.casePrompts,
			{ rescoreId, date: '2026-09-25T09:00:00.000Z', commit: 'a'.repeat(40), reviewer: FP.reviewer, scoring: FP.scoring, caseSet: FP.caseSet }
		);
	/** RR-01 recorded unjudged for one case: an outcome today's path does not re-score to (limb 2's fixture), so a
	 *  SUPERSEDED line may strike the record that holds it. */
	const unjudged = (s: ScoredOutcome): ScoredOutcome => ({
		...s,
		criteria: s.criteria.map(([k, o]) => [k, k.startsWith('RR-01') ? 'UNABLE_TO_DETERMINE' : o] as const)
	});

	it('⛔ a record whose current cases are covered only by ANOTHER candidate is RED with a SELECTION in force, naming the selected candidate, its ruling and every uncovered case — and, the CONTROL, GREEN with none, as before SR-4', async () => {
		const agy = await recorded({ runId: 'qr-sel-agy-1' });
		const without = await check([file(agy)]);
		expect(without.problems, 'CONTROL: no SELECTION — any candidate’s run covers, as before').toEqual([]);
		expect(without.selection, 'CONTROL: none is in force').toBeUndefined();
		const selection = select(GLM);
		const lines = [...agy, selection];
		const r = await check([file(lines)]);
		expect(r.problems.map((p) => p.limb), 'coverage alone').toEqual(['COVERAGE']);
		expect(limb(r, 'COVERAGE')).toBe(owedBy(GLM, at(lines, selection), ALL));
		expect(r.selection).toEqual({ candidate: GLM, ruling: 'REG-D-084', at: at(lines, selection), standing: 'IN_FORCE' });
	});

	it('⭐ the same record with the SELECTED candidate’s run is GREEN — and a run of it over one case owes exactly the others', async () => {
		const agy = await recorded({ runId: 'qr-sel-agy-2' });
		const glm = await recorded({ runId: 'qr-sel-glm-2', candidate: DEVIN });
		expect((await check([file([...agy, ...glm, select(GLM)])])).problems).toEqual([]);
		const one = await recorded({ runId: 'qr-sel-glm-3', candidate: DEVIN, cases: SUBSET.filter((c) => c.id === 'G-RR-04') });
		const selection = select(GLM);
		const lines = [...agy, ...one, selection];
		expect(limb(await check([file(lines)]), 'COVERAGE')).toBe(owedBy(GLM, at(lines, selection), ['G-CLEAN', 'G-CLEAN-R1']));
	});

	it('⛔ the candidate is its transport AND its model label — the same label through another transport, or another label through the same one, covers nothing of the selection', async () => {
		const sameLabel = await recorded({
			runId: 'qr-sel-agy-glm',
			candidate: { ...AGY, modelLabel: GLM.modelLabel, argv: [...AGY.argv!.slice(0, 5), GLM.modelLabel] }
		});
		const otherLabel = await recorded({ runId: 'qr-sel-devin-other', candidate: { ...DEVIN, modelLabel: 'another-model' } });
		for (const [label, run] of [
			['another transport, the same label', sameLabel],
			['the same transport, another label', otherLabel]
		] as const) {
			const selection = select(GLM);
			const lines = [...run, selection];
			const r = await check([file(lines)]);
			expect(r.problems.map((p) => p.limb), label).toEqual(['COVERAGE']);
			expect(limb(r, 'COVERAGE'), label).toBe(owedBy(GLM, at(lines, selection), ALL));
		}
	});

	it('⭐ only the scoring moved: a RESCORED record of the SELECTED candidate’s run suffices — GREEN; its run under the earlier fingerprint does not, nor does another candidate’s RESCORED record', async () => {
		const agy = await recorded({ runId: 'qr-sel-agy-4' });
		const old = await recorded({ runId: 'qr-sel-glm-4', candidate: DEVIN, fingerprint: moved('scoring') });
		const selection = select(GLM);
		const before = [...agy, ...old, selection];
		expect(limb(await check([file(before)]), 'COVERAGE'), 'RED first: its run is under an earlier fingerprint').toBe(
			[
				owedBy(GLM, at(before, selection), ALL),
				`same prompts under an earlier fingerprint in qr-sel-glm-4: ${ALL.join(', ')} — RESCORED lines discharge those where no case prompt changed (§5.6 limb 1)`
			].join('\n    ')
		);
		expect((await check([file([...before, ...(await restamp(old, 'rs-sel-glm-4'))])])).problems).toEqual([]);
		const agyOld = await recorded({ runId: 'qr-sel-agy-5', fingerprint: moved('scoring') });
		const other = select(GLM);
		const lines = [...agyOld, ...(await restamp(agyOld, 'rs-sel-agy-5')), other];
		const r = await check([file(lines)]);
		expect(r.problems.map((p) => p.limb), 'today is covered — by another candidate’s re-stamp').toEqual(['COVERAGE']);
		expect(limb(r, 'COVERAGE')).toBe(owedBy(GLM, at(lines, other), ALL));
	});

	it('⛔ the LAST SELECTION in the record is the one in force — an earlier one selects nothing; across files, by name, then line', async () => {
		const glm = await recorded({ runId: 'qr-sel-glm-6', candidate: DEVIN });
		const never = select(NEVER_RUN);
		const selected = select(GLM);
		const reselected = [...glm, never, selected];
		const green = await check([file(reselected)]);
		expect(green.problems, 'the selected candidate, selected last, is covered').toEqual([]);
		expect(green.selection).toEqual({ candidate: GLM, ruling: 'REG-D-084', at: at(reselected, selected), standing: 'IN_FORCE' });
		const later = select(NEVER_RUN);
		const lines = [...glm, selected, later];
		expect(limb(await check([file(lines)]), 'COVERAGE')).toBe(owedBy(NEVER_RUN, at(lines, later), ALL));
		const across = await check([file([...glm, select(GLM)], 'a.ndjson'), file([select(NEVER_RUN)], 'b.ndjson')]);
		expect(limb(across, 'COVERAGE')).toBe(owedBy(NEVER_RUN, 'b.ndjson:1', ALL));
	});

	it('⛔ a malformed SELECTION is refused by the record’s validation — in force nowhere, and its file read no further', async () => {
		const glm = await recorded({ runId: 'qr-sel-glm-7', candidate: DEVIN });
		const lines = [...glm, { ...select(GLM), candidate: { transport: 'ollama' as const, modelLabel: 'gpt-oss:20b' } }];
		const r = await check([file(lines)]);
		expect(limb(r, 'RECORD')).toBe(
			`runs.ndjson: line ${lines.length}: SELECTION.candidate.transport: "ollama" cannot be deployed as the product’s reviewer (§3.5) — a SELECTION names a candidate it can deploy: agy, devin`
		);
		expect(r.selection, 'a refused line is in force nowhere').toBeUndefined();
		expect(limb(r, 'COVERAGE'), 'nor is its file’s run read').toContain('3 of 3 current case(s) are not MEASURED');
	});

	it('⛔ a SELECTION’s ruling is held as an ESCALATION’s finding is — an entry the register holds, and, for the one in force, a heading not struck', async () => {
		const glm = await recorded({ runId: 'qr-sel-glm-8', candidate: DEVIN });
		const unheld = select(GLM, 'REG-D-999');
		const lines = [...glm, unheld];
		expect(limb(await check([file(lines)]), 'RECORD')).toBe(`${at(lines, unheld)}: SELECTION cites REG-D-999, which the register does not hold`);
		const selection = select(GLM);
		const cited = [...glm, selection];
		expect(limb(await check([file(cited)], { struckRulings: new Set(['REG-D-084']) }), 'RECORD')).toBe(
			`${at(cited, selection)}: the SELECTION in force cites REG-D-084, whose register heading is struck — a withdrawn ruling selects nothing; append a SELECTION citing a ruling in force`
		);
		expect((await check([file(cited)])).problems, 'CONTROL: the same ruling, in force').toEqual([]);
		// ⭐ AN EARLIER SELECTION SELECTS NOTHING: a ruling withdrawn since does not redden it — the append-only record could
		// never discharge that — but what it cites must still be an entry the register holds.
		const withdrawn = [...glm, select(GLM, 'REG-D-085'), select(GLM)];
		expect((await check([file(withdrawn)], { struckRulings: new Set(['REG-D-085']) })).problems).toEqual([]);
		const dangling = select(GLM, 'REG-D-999');
		const earlier = [...glm, dangling, select(GLM)];
		expect(limb(await check([file(earlier)]), 'RECORD')).toBe(`${at(earlier, dangling)}: SELECTION cites REG-D-999, which the register does not hold`);
	});

	// ⛔ A RECORD OF THE SELECTED CANDIDATE THAT COUNTS FOR NOTHING COVERS NOTHING OF THE SELECTION — `coveredBy`, the one
	// definition, asked of its COUNTED runs. Each fixture sits beside another candidate's run that covers today, so the
	// selection's problem is the only one, and each has its own control: the same record, counting, covers.
	it('⛔ its run STRUCK by a SUPERSEDED line covers nothing of the selection — beside another candidate’s run that covers today', async () => {
		const agy = await recorded({ runId: 'qr-sel-agy-11' });
		// A run of it under today's fingerprint that really fails reproduction, and the SUPERSEDED line naming it.
		const bad = tamper(await recorded({ runId: 'qr-sel-glm-11', candidate: DEVIN }), 'G-RR-04', (c) => ({
			...c,
			scored: c.scored && unjudged(c.scored)
		}));
		const selection = select(GLM);
		const lines = [...bad, supersede('qr-sel-glm-11'), ...agy, selection];
		const r = await check([file(lines)]);
		expect(r.problems.map((p) => p.limb), 'coverage alone').toEqual(['COVERAGE']);
		expect(limb(r, 'COVERAGE')).toBe(owedBy(GLM, at(lines, selection), ALL));
		expect(limb(await check([file([...bad, ...agy, selection])]), 'COVERAGE'), 'CONTROL: not struck, it covers').toBe('');
	});

	it('⛔ its run REFUSED for its stamp covers nothing of the selection — beside another candidate’s run that covers today', async () => {
		const agy = await recorded({ runId: 'qr-sel-agy-12' });
		// Today's reviewer fingerprint under another scoring digest: a stamp nothing this tree makes.
		const forged = await recorded({
			runId: 'qr-sel-glm-12',
			candidate: DEVIN,
			fingerprint: { reviewer: FP.reviewer, scoring: HEX('e'), caseSet: FP.caseSet }
		});
		const selection = select(GLM);
		const lines = [...forged, ...agy, selection];
		const r = await check([file(lines)]);
		expect(r.problems.map((p) => p.limb), 'the stamp, and coverage').toEqual(['RECORD', 'COVERAGE']);
		expect(limb(r, 'RECORD')).toContain(
			`RUN qr-sel-glm-12 carries today’s reviewer fingerprint ${FP.reviewer} but scoring digest ${HEX('e')}, not today’s ${FP.scoring}`
		);
		expect(limb(r, 'COVERAGE')).toBe(owedBy(GLM, at(lines, selection), ALL));
		const stamped = await recorded({ runId: 'qr-sel-glm-12', candidate: DEVIN });
		expect((await check([file([...stamped, ...agy, selection])])).problems, 'CONTROL: today’s stamp, it covers').toEqual([]);
	});

	it('⛔ its RESCORED record STRUCK by a SUPERSEDED line covers nothing of the selection — beside another candidate’s run that covers today', async () => {
		const agy = await recorded({ runId: 'qr-sel-agy-13' });
		// Its run under an earlier fingerprint (only the scoring moved), re-stamped by a RESCORED record that really fails
		// reproduction, and the SUPERSEDED line naming that record.
		const old = await recorded({ runId: 'qr-sel-glm-13', candidate: DEVIN, fingerprint: moved('scoring') });
		const rescored = (await restamp(old, 'rs-sel-glm-13')).map((l) =>
			l.caseId === 'G-RR-04' ? { ...l, scored: unjudged(l.scored) } : l
		);
		const selection = select(GLM);
		const lines = [...old, ...rescored, supersede('rs-sel-glm-13'), ...agy, selection];
		const r = await check([file(lines)]);
		expect(r.problems.map((p) => p.limb), 'coverage alone').toEqual(['COVERAGE']);
		expect(limb(r, 'COVERAGE')).toBe(
			[
				owedBy(GLM, at(lines, selection), ALL),
				`same prompts under an earlier fingerprint in qr-sel-glm-13: ${ALL.join(', ')} — RESCORED lines discharge those where no case prompt changed (§5.6 limb 1)`
			].join('\n    ')
		);
		expect(
			limb(await check([file([...old, ...rescored, ...agy, selection])]), 'COVERAGE'),
			'CONTROL: not struck, the RESCORED record covers'
		).toBe('');
	});

	// ⛔ THE MODEL LABEL IS MATCHED EXACTLY — a label that only BEGINS the other names another model.
	for (const [label, runLabel, selected] of [
		['a run labelled glm-5-3-flash-max-v2 covers nothing of a SELECTION of glm-5-3-flash-max', 'glm-5-3-flash-max-v2', 'glm-5-3-flash-max'],
		['a run labelled glm-5-3-flash-max covers nothing of a SELECTION of glm-5-3-flash', 'glm-5-3-flash-max', 'glm-5-3-flash']
	] as const)
		it(`⛔ the model label is matched EXACTLY — ${label}`, async () => {
			const run = await recorded({ runId: `qr-sel-${runLabel}`, candidate: { ...DEVIN, modelLabel: runLabel } });
			const candidate: SelectedCandidate = { transport: 'devin', modelLabel: selected };
			const selection = select(candidate);
			const lines = [...run, selection];
			const r = await check([file(lines)]);
			expect(r.problems.map((p) => p.limb)).toEqual(['COVERAGE']);
			expect(limb(r, 'COVERAGE')).toBe(owedBy(candidate, at(lines, selection), ALL));
		});

	it('⛔ the selected candidate’s coverage is asked WHETHER OR NOT every case is otherwise covered — an empty record with a SELECTION owes both, each naming what it owes', async () => {
		const r = await check([file([select(GLM)])]);
		expect(r.problems).toEqual([
			{
				limb: 'COVERAGE',
				message: `3 of 3 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer}: ${ALL.join(', ')} — owed: a RUN over them, or RESCORED lines where no case prompt changed (§5.6 limb 1)`
			},
			{ limb: 'COVERAGE', message: owedBy(GLM, 'runs.ndjson:1', ALL) }
		]);
	});

	it('⛔ the SELECTION in force on a ruling that is not in force is never reported in force unqualified — the report and its COVERAGE problem say the ruling is WITHDRAWN, or NOT HELD', async () => {
		const agy = await recorded({ runId: 'qr-sel-agy-15' });
		const selection = select(GLM);
		const lines = [...agy, selection];
		const withdrawn = await check([file(lines)], { struckRulings: new Set(['REG-D-084']) });
		expect(withdrawn.problems.map((p) => p.limb)).toEqual(['RECORD', 'COVERAGE']);
		expect(withdrawn.selection).toEqual({ candidate: GLM, ruling: 'REG-D-084', at: at(lines, selection), standing: 'STRUCK' });
		expect(limb(withdrawn, 'COVERAGE')).toBe(
			owedBy(GLM, at(lines, selection), ALL, 'REG-D-084, WITHDRAWN — its register heading is struck')
		);
		const unheld = select(GLM, 'REG-D-999');
		const dangling = [...agy, unheld];
		const notHeld = await check([file(dangling)]);
		expect(notHeld.problems.map((p) => p.limb)).toEqual(['RECORD', 'COVERAGE']);
		expect(notHeld.selection).toEqual({ candidate: GLM, ruling: 'REG-D-999', at: at(dangling, unheld), standing: 'NOT_HELD' });
		expect(limb(notHeld, 'COVERAGE')).toBe(
			owedBy(GLM, at(dangling, unheld), ALL, 'REG-D-999, NOT HELD — the register has no entry for it')
		);
		// CONTROL: the same record, its ruling in force — named bare.
		const inForce = await check([file(lines)]);
		expect(inForce.problems.map((p) => p.limb)).toEqual(['COVERAGE']);
		expect(inForce.selection).toEqual({ candidate: GLM, ruling: 'REG-D-084', at: at(lines, selection), standing: 'IN_FORCE' });
		expect(limb(inForce, 'COVERAGE')).toBe(owedBy(GLM, at(lines, selection), ALL));
	});

	it('⭐ the register’s RULINGS, read as its findings are — an entry struck in its heading is withdrawn; a finding is not a ruling, nor a ruling a finding', () => {
		const register = [
			'### REG-D-084 — SPONSOR RULING',
			'### ~~REG-D-085~~ — withdrawn, for the fixture',
			'### REG-F-427 — a finding',
			'A line that names REG-D-086 is not a heading.'
		].join('\n');
		const { rulings, struck } = registerRulings(register);
		expect([...rulings].sort()).toEqual(['REG-D-084', 'REG-D-085']);
		expect([...struck]).toEqual(['REG-D-085']);
		expect([...registerFindings(register).findings]).toEqual(['REG-F-427']);
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
	/**
	 * ~~⛔ `E12F` F5 (`REG-D-073`) — WHAT THE CLI SAYS OF A RECORD WITH NOTHING ELSE OWED, WHILE THE COMMITTED ORACLES ARE
	 * PROPOSED: RED, ONE problem, the conferral. ~~GREEN~~ — a run over version five before the sponsor confers its oracles
	 * must not turn the check green. So each case below that held the CLI GREEN now holds it red on the conferral alone —
	 * nothing else owed, which is what GREEN said — and the core's green path is driven with a conferred statement
	 * (`AS_IF_CONFERRED`). ⚠ When the sponsor confers, the committed oracles' statement changes, and these return to GREEN.~~
	 * ⭐ The merge of the completion programme — THEY RETURN TO GREEN: the sponsor conferred version five's oracles
	 * (`REG-D-113`), so a record with nothing owed is GREEN again, as before `E12F` F5. The conferral limb stays held: by the
	 * core's case on a statement that reads PROPOSED (`AS_IF_PROPOSED`), and, through the CLI's own reading of the oracle file,
	 * by the case below that runs `main` on a disposable root whose version five still reads PROPOSED.
	 */
	const GREEN =
		'reviewer:qual:check — GREEN — today’s reviewer is covered, the record reproduces, and every material failure is escalated\n';
	/**
	 * ~~⛔ Package P F3 (`REG-D-123` Q25; `REG-D-073`) — WHAT THE CLI SAYS OF A RECORD WITH NOTHING ELSE OWED WHILE TODAY'S
	 * ORACLES ARE PROPOSED, as it said under `E12F` F5: RED, ONE problem, the conferral. Version seven's six graph-case oracles
	 * await the sponsor, so each case below that held the CLI GREEN holds it red on the conferral alone — nothing else owed,
	 * which is what GREEN said — and GREEN is driven by a conferred fixture statement in the case that runs `main` on a
	 * disposable root. ~~`GREEN_HEAD`~~, which no case reads now. ⚠ When the sponsor confers the six, the committed statement
	 * changes: the CLI is GREEN again on these records, and each case below must expect GREEN again.~~
	 * ⭐ The review in parts, B7 — THEY RETURN TO GREEN: today's set is version eight, its 35 part oracles conferred by the
	 * sponsor (`REG-D-126` Q30, Q31) and its 41 carried with theirs, so a record with nothing owed is GREEN again. The conferral
	 * limb stays held, through the CLI's own reading of the oracle file, by the case that runs `main` on a disposable root whose
	 * current oracle file is made to read PROPOSED (`ONLY_THE_CONFERRAL`).
	 */
	const ONLY_THE_CONFERRAL = `reviewer:qual:check — RED — 1 problem(s):\n  [CONFERRAL] ${ORACLES_NOT_CONFERRED}\n`;
	/**
	 * ~~⭐⭐ B8a (`REG-D-127`) — WHAT THE CLI SAYS OF A RECORD WITH NOTHING ELSE OWED WHILE TODAY'S RESTATED CASES AWAIT THE SPONSOR'S
	 * CONFIRMATION: RED, ONE problem, the confirmation. Today's set is version nine, its 19 restated bridge part cases awaiting
	 * it, so each case below that held the CLI GREEN holds it red on the confirmation alone — nothing else owed, which is what
	 * GREEN said — and GREEN is driven, in the case that runs `main` on a disposable root, by a copy of the oracle file whose
	 * statement records the confirmation. ⚠ When the sponsor confirms, the committed statement changes, and these return to
	 * GREEN.~~
	 * ⭐ The code record of `REG-D-129` — THEY RETURN TO GREEN: the sponsor confirmed the restated cases, and the committed
	 * statement says so, so a record with nothing owed is GREEN again, as under B7. The confirmation limb stays held, through
	 * the CLI's own reading of the oracle file, by the case that runs `main` on a disposable root whose ~~version nine~~ ⭐ B8b:
	 * ~~version ten, confirmed as proposed (`REG-D-131` Q36),~~ ⭐ package K: version eleven, its restatement recorded (`REG-D-133`
	 * Q39), still carries the marker (`ONLY_THE_CONFIRMATION`).
	 */
	const ONLY_THE_CONFIRMATION = `reviewer:qual:check — RED — 1 problem(s):\n  [CONFERRAL] ${RESTATEMENT_NOT_CONFIRMED}\n`;
	// ⭐ B8a — ~~`GREEN_HEAD`~~: no case reads it while the confirmation is owed (`ONLY_THE_CONFIRMATION`). ⭐ `REG-D-129` — read
	// again, the confirmation recorded.
	const GREEN_HEAD = 'reviewer:qual:check — GREEN';

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

	it('⛔ RED on an empty record — all ~~76~~ ⭐ 91 cases of the committed set are owed', () => {
		const r = cli(['--conditions=source'], ['--records', gitRepo()]);
		expect(r.status, r.out).toBe(1);
		// ⭐ Package P F3 — ~~54 of 54~~: version seven's sixty. ⭐ B7 — ~~60 of 60~~: version eight's 76. ⭐ Package V — ~~76 of
		// 76~~: version twelve's 91.
		expect(r.out).toContain('91 of 91 current case(s) are not MEASURED under today’s reviewer fingerprint');
		expect(r.out).toContain(FP.reviewer);
		// ⭐ `JAN-CRITREAD` J2-5 — the committed set it holds coverage to is the CURRENT one, with its oracles: version three
		// from J2-7, version four since `JAN-PRQUAL` `PQ-2` (DESIGN-process-result-qualification.md D4).
		// ⭐ E2 — ~~version four since `JAN-PRQUAL` `PQ-2`~~ version five since `JAN-EXEC` Phase 7 completion E2 (design B5).
		// ⭐ Round 5 — ~~version five~~ version six, ~~D-FP-CLEAN repaired~~ ⭐ four cases repaired: D6-RC-CLEAN, D6-RC-04,
		// D6-FP-CLEAN and D6-FP-03 (`REG-D-115` and its delegated extension).
		// ⭐ Package P F3 — ~~version six~~ version seven: six graph cases added, their oracles proposed (`REG-D-123` Q25).
		// ⭐ B7 — ~~version seven~~ version eight: 35 part cases for the graph cases, their oracles conferred (`REG-D-126`).
		// ⭐ B8a — ~~version eight~~ version nine: each part cut with the seeded library, the bridge restated (`REG-D-127`).
		// ⭐ B8b — ~~version nine~~ version ten: the bridge part cases restated by D3b, confirmed (`REG-D-130`, `REG-D-131`).
		// ⭐ Package K — ~~version ten~~ version eleven: the 7 bridge part cases D3d moved, under new ids (`REG-D-133`).
		// ⭐ Package V — ~~version eleven~~ version twelve: 56 cases new or changed, shown what production now hands each review
		// (`REG-D-136`).
		expect(r.out).toContain('; case set v12, oracles v12\n');
		expect(r.out).toContain(`: ${CURRENT_CASES.map((c) => c.id).join(', ')} — owed`);
		// ⭐ `REG-D-129` — ~~the confirmation owed (B8a)~~: the restatement confirmed, no CONFERRAL problem. ⭐ B8b — and version
		// ten's, confirmed as proposed (`REG-D-131` Q36), none either.
		expect(r.out).not.toContain('[CONFERRAL]');
		expect(CURRENT_SET.caseSetVersion).toBe(12); // ⭐ package K — ~~10~~; ⭐ package V — ~~11~~
	});

	it('⭐ on a TRACKED record that covers the committed set, reproduces, and holds no material failure: ~~nothing owed but the conferral of version seven’s six new oracles (package P F3)~~ ~~⭐ GREEN, its oracles conferred (REG-D-126, B7)~~ ~~⭐ B8a: nothing owed but the sponsor’s confirmation of the restated bridge cases (REG-D-127)~~ ⭐ GREEN, the restatement confirmed (REG-D-129) ⭐ B8b: and version ten’s, confirmed as proposed (REG-D-131 Q36) ⭐ package K: and version eleven’s, its restatement recorded (REG-D-133 Q39)', async () => {
		const dir = gitRepo();
		writeFileSync(
			join(dir, 'runs.ndjson'),
			text(await recorded({ runId: 'qr-cli-1', cases: CURRENT_CASES, versions: { caseSet: 12, oracles: 12 } /* ⭐ package K — ~~10, 10~~; ⭐ package V — ~~11, 11~~ */ }))
		);
		git(dir, 'add', 'runs.ndjson');
		const r = cli(['--conditions=source'], ['--records', dir]);
		// ⭐ B8a — ~~GREEN~~: red on the confirmation alone (`ONLY_THE_CONFIRMATION`). ⭐ `REG-D-129` — GREEN again.
		expect(r.out).toContain(GREEN);
		expect(r.status, r.out).toBe(0);
	}, 120_000);

	// ⭐ The merge of the completion programme (`E12F` F5, after `REG-D-113`) — THE CLI HANDS THE CHECK ITS ORACLE FILE'S
	// CONFERRAL. ~~The committed oracles are conferred now, so no case above can tell a CLI that hands the check the file's
	// statement from one that hands it nothing:~~ This runs the CLI's own `main` on a disposable root — the committed case set,
	// oracle files and register copied — ~~whose version five is made to read PROPOSED again~~.
	// ⭐ Package P F3 (`REG-D-123` Q25) — AND NOW THE CASE RUNS THE OTHER WAY: the committed oracles read PROPOSED again (version
	// seven's six), so the copy is RED on the conferral alone, and the same copy given a conferred statement is GREEN.
	// ⭐ The review in parts, B7 — AND BACK AGAIN: the committed version eight is conferred (`REG-D-126`), so the copy is GREEN,
	// and the same copy made to read PROPOSED is RED on the conferral alone.
	// ⭐ B8a (`REG-D-127`) — AND NOW THE CONFIRMATION: the committed version nine awaits the sponsor's confirmation of its restated
	// cases, so the copy is RED on the confirmation alone; the same copy, its statement recording the confirmation, is GREEN; and
	// made to read PROPOSED instead, it is RED on the conferral alone.
	// ⭐ The code record of `REG-D-129` — AND BACK AGAIN: the committed version nine records the sponsor's confirmation, so the copy
	// is GREEN; the same copy, its statement still carrying the marker, is RED on the confirmation alone; and made to read
	// PROPOSED instead, it is RED on the conferral alone.
	// ⭐ B8b (`REG-D-130`, `REG-D-131`) — ~~the committed version nine~~: the committed version ten, whose statement records the
	// sponsor's confirmation of its restated bridge cases as proposed (`REG-D-131` Q36), so the copy is GREEN as before; the
	// marker and PROPOSED cases run as before, the fixture statement now version ten's.
	// ⭐ Package K (`REG-D-133`) — ~~the committed version ten~~: the committed version eleven, whose statement carries version ten's
	// whole and records the restatement of its 7 (Q39), so the copy is GREEN as before; the fixture statement now version eleven's.
	it('⛔ E12F F5 — the CLI reads the conferral off its oracle file: ~~the committed version seven, its six new oracles PROPOSED, nothing else owed, is RED on the conferral alone; the same file, its conferral recorded, is GREEN~~ ~~⭐ B7: the committed version eight, conferred, is GREEN; the same file made to read PROPOSED, nothing else owed, is RED on the conferral alone~~ ~~⭐ B8a: the committed version nine, its restatement unconfirmed, nothing else owed, is RED on the confirmation alone; the same file, the confirmation recorded, is GREEN; made to read PROPOSED, RED on the conferral alone~~ ⭐ REG-D-129: the committed ~~version nine~~ ⭐ B8b: ~~version ten, its restatement confirmed (REG-D-131 Q36)~~ ⭐ package K: version eleven, its restatement recorded (REG-D-133 Q39), is GREEN; the same file still carrying the marker, nothing else owed, is RED on the confirmation alone; made to read PROPOSED, RED on the conferral alone', async () => {
		const dir = gitRepo();
		writeFileSync(
			join(dir, 'runs.ndjson'),
			text(await recorded({ runId: 'qr-cli-proposed', cases: CURRENT_CASES, versions: { caseSet: 12, oracles: 12 } /* ⭐ package K — ~~10, 10~~; ⭐ package V — ~~11, 11~~ */ }))
		);
		git(dir, 'add', 'runs.ndjson');
		// ⭐ Package J's check, item 2 — ~~`tmp()`~~: a git repository of its own, its case set staged, since the CLI reads a case
		// set only as git tracks it, as it reads the record (`check.ts` `trackedFiles`).
		const root = gitRepo();
		const oracleDir = dirname(CURRENT_ORACLES_FILE);
		mkdirSync(join(root, dirname(CURRENT_CASE_SET_FILE)), { recursive: true });
		mkdirSync(join(root, oracleDir), { recursive: true });
		copyFileSync(join(REPO, CURRENT_CASE_SET_FILE), join(root, CURRENT_CASE_SET_FILE));
		git(root, 'add', '--', CURRENT_CASE_SET_FILE);
		for (const name of readdirSync(join(REPO, oracleDir)))
			copyFileSync(join(REPO, oracleDir, name), join(root, oracleDir, name));
		const register = join(tmp(), 'register.md');
		writeFileSync(register, readFileSync(join(REPO, REGISTER_FILE), 'utf8'));
		/** `main` as the CLI runs it: git found as a harness child finds it (`hermeticEnv`), no other program, then PATH as it was. */
		const run = async () => {
			let out = '';
			vi.stubEnv('PATH', hermeticEnv().PATH!);
			try {
				const code = await main(['--records', dir, '--register', register], {
					resolve: () => join(REPO, 'packages/rph-assurance/src/index.ts'),
					write: (s) => void (out += s),
					root: pathToFileURL(`${root}/`)
				});
				return { code, out };
			} finally {
				vi.stubEnv('PATH', NO_PROGRAMS);
			}
		};
		const committed = await run();
		// ⭐ B8a — ~~'arrangement: the committed oracles, copied, are GREEN'~~: red on the confirmation alone.
		// ⭐ `REG-D-129` — ~~'the committed oracles, copied: the confirmation owed'~~: GREEN, the confirmation recorded.
		expect(committed.out, 'arrangement: the committed oracles, copied, are GREEN').toContain(GREEN);
		expect(committed.code, committed.out).toBe(0);
		const current = join(root, CURRENT_ORACLES_FILE);
		const set = JSON.parse(readFileSync(current, 'utf8')) as OracleSet;
		expect(set.conferral, 'arrangement: the committed oracles, copied, are conferred').not.toContain(DECLARED_ORACLES_PROPOSED);
		// ⭐ `REG-D-129` — ~~'arrangement: and await the confirmation'~~: confirmed, so the marker this case needs is written here.
		expect(set.conferral, 'arrangement: and confirmed').not.toContain(ORACLES_RESTATEMENT_UNCONFIRMED);
		const unconfirmedStatement = `${set.conferral} A fixture: the 19 part cases cut from the restated bridge cases are ${ORACLES_RESTATEMENT_UNCONFIRMED}.`;
		writeFileSync(current, JSON.stringify({ ...set, conferral: unconfirmedStatement }));
		const unconfirmed = await run();
		expect(unconfirmed.out, 'the CLI read no marker off its oracle file').toContain(ONLY_THE_CONFIRMATION);
		expect(unconfirmed.code, unconfirmed.out).toBe(1);
		// ⭐ B8b — ~~version nine’s~~ version ten’s: the committed oracle file is version ten’s. ⭐ Package K — ~~version ten’s~~
		// version eleven’s.
		writeFileSync(current, JSON.stringify({ ...set, conferral: `A fixture: version eleven’s part oracles are ${DECLARED_ORACLES_PROPOSED}.` }));
		const proposed = await run();
		expect(proposed.out, 'the CLI handed the check no conferral').toContain(ONLY_THE_CONFERRAL);
		expect(proposed.code, proposed.out).toBe(1);
	}, 120_000);

	// ⭐⭐ D3c (`REG-D-132`; `REG-F-576`) — THE CLI HANDS THE CHECK EVERY COMMITTED CASE SET, read off the case directory as it reads
	// today's: so an ACKNOWLEDGED line naming version nine's part cases, 19 of which version ten renamed, is held whole by version
	// nine's committed set. Run on a disposable root, as the conferral case above runs `main`, its case directory holding version
	// ~~ten~~ eleven (⭐ package K: today's) and version nine; then the same root without version nine's file.
	it('⭐⭐ D3c — the CLI reads every committed case set off its case directory: on a root holding versions ~~ten~~ eleven (today’s, since package K) and nine, an ACKNOWLEDGED line naming version nine’s 35 part cases is held, GREEN; the same root without version nine’s file is RED on the 19 renamed alone, each an id no committed case set holds', async () => {
		const dir = gitRepo();
		const lines: RecordLine[] = [
			...(await recorded({ runId: 'qr-cli-d3c', cases: CURRENT_CASES, versions: { caseSet: 12, oracles: 12 } /* ⭐ package K — ~~10, 10~~; ⭐ package V — ~~11, 11~~ */ })),
			{
				kind: 'ACKNOWLEDGED',
				date: '2026-10-25T09:00:00.000Z',
				reviewerFingerprint: FP.reviewer,
				addedCaseIds: V9_CASES.filter((c) => c.arm === 'PWA_TYPE').map((c) => c.id)
			}
		];
		writeFileSync(join(dir, 'runs.ndjson'), text(lines));
		git(dir, 'add', 'runs.ndjson');
		// ⭐ Package J's check, item 2 — ~~`tmp()`~~: a git repository of its own, its two case sets staged — committed, as the CLI
		// now reads a case set only as git tracks it (`check.ts` `trackedFiles`).
		const root = gitRepo();
		const oracleDir = dirname(CURRENT_ORACLES_FILE);
		mkdirSync(join(root, dirname(CURRENT_CASE_SET_FILE)), { recursive: true });
		mkdirSync(join(root, oracleDir), { recursive: true });
		for (const f of [CURRENT_CASE_SET_FILE, CASE_SET_V9_FILE]) copyFileSync(join(REPO, f), join(root, f));
		git(root, 'add', '--', CURRENT_CASE_SET_FILE, CASE_SET_V9_FILE);
		for (const name of readdirSync(join(REPO, oracleDir))) copyFileSync(join(REPO, oracleDir, name), join(root, oracleDir, name));
		const register = join(tmp(), 'register.md');
		writeFileSync(register, readFileSync(join(REPO, REGISTER_FILE), 'utf8'));
		const run = async () => {
			let out = '';
			vi.stubEnv('PATH', hermeticEnv().PATH!);
			try {
				const code = await main(['--records', dir, '--register', register], {
					resolve: () => join(REPO, 'packages/rph-assurance/src/index.ts'),
					write: (s) => void (out += s),
					root: pathToFileURL(`${root}/`)
				});
				return { code, out };
			} finally {
				vi.stubEnv('PATH', NO_PROGRAMS);
			}
		};
		expect(D3C_RENAMED(), 'arrangement: 19 of version nine’s part cases are no case of ~~version ten~~ version eleven, today’s').toHaveLength(19);
		const both = await run();
		expect(both.out, 'versions ~~ten~~ eleven and nine on file: the line is held whole by version nine’s').toContain(GREEN);
		expect(both.code, both.out).toBe(0);
		// ⭐ Package J's check, item 2 — ~~`rmSync(join(root, CASE_SET_V9_FILE))`~~: version nine's file removed from the commit too,
		// as a file git tracks but the working tree has lost is a RECORD problem of its own (`-f`: staged, never committed).
		git(root, 'rm', '-q', '-f', '--', CASE_SET_V9_FILE);
		expect(existsSync(join(root, CASE_SET_V9_FILE)), 'arrangement: version nine’s file gone from the working tree too').toBe(false);
		const tenAlone = await run();
		expect(tenAlone.out, '~~version ten~~ version eleven alone on file: the 19 renamed, and nothing else').toContain(
			`reviewer:qual:check — RED — 19 problem(s):\n${D3C_RENAMED()
				.map((id) => `  [RECORD] ${D3C_UNHELD(`runs.ndjson:${lines.length}`, id)}\n`)
				.join('')}`
		);
		expect(tenAlone.code, tenAlone.out).toBe(1);
	}, 120_000);

	// ⭐ Package J's check, item 2 (the lead's ruling, 2026-10-25) — THE COMMITTED CASE SETS, AS GIT TRACKS THEM. D3c's reader took
	// every `*.json` in the case directory from the working tree, untracked files included, so an untracked or edited case-set
	// file could make an ACKNOWLEDGED line pass, while the record itself is read only as git stages it ("green here is green on
	// the commit"). The case sets are read as the record is — a file git tracks, exactly as staged — and a file the CLI will not
	// read is a RECORD problem naming it, as an untracked record file is.
	/** `main` as the CLI runs it, on `root`: git found as a harness child finds it (`hermeticEnv`), no other program, then PATH as it was. */
	const mainOn = (root: string, dir: string, register: string) => async () => {
		let out = '';
		vi.stubEnv('PATH', hermeticEnv().PATH!);
		try {
			const code = await main(['--records', dir, '--register', register], {
				resolve: () => join(REPO, 'packages/rph-assurance/src/index.ts'),
				write: (s) => void (out += s),
				root: pathToFileURL(`${root}/`)
			});
			return { code, out };
		} finally {
			vi.stubEnv('PATH', NO_PROGRAMS);
		}
	};
	/**
	 * A disposable root for `main`: its case directory holding ~~version ten~~ ⭐ today's, version eleven since package K — staged, when the root is a git repository — and its
	 * oracle directory every committed oracle file; a register copied; and a tracked record covering today's set, then an
	 * ACKNOWLEDGED line naming version nine's 35 part cases, 19 of which version ten renamed, so only version nine's committed set
	 * holds it whole.
	 */
	const d3cRoot = async (runId: string, root: string) => {
		const dir = gitRepo();
		const lines: RecordLine[] = [
			...(await recorded({ runId, cases: CURRENT_CASES, versions: { caseSet: 12, oracles: 12 } /* ⭐ package K — ~~10, 10~~; ⭐ package V — ~~11, 11~~ */ })),
			{
				kind: 'ACKNOWLEDGED',
				date: '2026-10-25T09:00:00.000Z',
				reviewerFingerprint: FP.reviewer,
				addedCaseIds: V9_CASES.filter((c) => c.arm === 'PWA_TYPE').map((c) => c.id)
			}
		];
		writeFileSync(join(dir, 'runs.ndjson'), text(lines));
		git(dir, 'add', 'runs.ndjson');
		const oracleDir = dirname(CURRENT_ORACLES_FILE);
		mkdirSync(join(root, dirname(CURRENT_CASE_SET_FILE)), { recursive: true });
		mkdirSync(join(root, oracleDir), { recursive: true });
		copyFileSync(join(REPO, CURRENT_CASE_SET_FILE), join(root, CURRENT_CASE_SET_FILE));
		if (existsSync(join(root, '.git'))) git(root, 'add', '--', CURRENT_CASE_SET_FILE);
		for (const name of readdirSync(join(REPO, oracleDir))) copyFileSync(join(REPO, oracleDir, name), join(root, oracleDir, name));
		const register = join(tmp(), 'register.md');
		writeFileSync(register, readFileSync(join(REPO, REGISTER_FILE), 'utf8'));
		/** RED on version nine's file, refused, and so on the 19 renamed, each an id no committed case set holds. */
		const refused = (why: string) =>
			`reviewer:qual:check — RED — 20 problem(s):\n  [RECORD] ${CASE_SET_V9_FILE}: not read — ${why}\n${D3C_RENAMED()
				.map((id) => `  [RECORD] ${D3C_UNHELD(`runs.ndjson:${lines.length}`, id)}\n`)
				.join('')}`;
		return { run: mainOn(root, dir, register), refused };
	};

	it('⛔ RED FIRST — a case-set file git does NOT TRACK is not read, and is a RECORD problem naming it: on a disposable git root whose version nine is untracked, the ACKNOWLEDGED line naming version nine’s 35 part cases is RED, the file named and the 19 renamed each held by no committed case set. ⭑ CONTROL: the same file tracked holds its line, GREEN', async () => {
		const root = gitRepo();
		const f = await d3cRoot('qr-cli-d3c-untracked', root);
		copyFileSync(join(REPO, CASE_SET_V9_FILE), join(root, CASE_SET_V9_FILE));
		expect(git(root, 'status', '--porcelain', '--', CASE_SET_V9_FILE), 'arrangement: version nine’s file, untracked').toBe(`?? ${CASE_SET_V9_FILE}\n`);
		const untracked = await f.run();
		expect(untracked.out, 'an untracked case set holds no line').toContain(
			f.refused(
				'git does not track it, so no commit holds this case set, and an ACKNOWLEDGED line is held only to a committed one (design D3c) — `git add` it, or remove it'
			)
		);
		expect(untracked.code, untracked.out).toBe(1);
		// ⭑ CONTROL — the same file, tracked: committed, it holds its line.
		git(root, 'add', '--', CASE_SET_V9_FILE);
		const tracked = await f.run();
		expect(tracked.out, 'CONTROL: version nine’s file tracked holds the line whole').toContain(GREEN);
		expect(tracked.code, tracked.out).toBe(0);
	}, 120_000);

	it('⛔ RED FIRST — a case-set file CHANGED SINCE IT WAS STAGED is not read, and is a RECORD problem naming it: version nine’s file staged without the 19 part cases version ten renamed, then written whole, holds no line — the check reads what a commit would carry', async () => {
		const root = gitRepo();
		const f = await d3cRoot('qr-cli-d3c-changed', root);
		const nine = join(root, CASE_SET_V9_FILE);
		writeFileSync(nine, JSON.stringify({ ...V9_SET, cases: V9_SET.cases.filter((c) => !D3C_RENAMED().includes(c.id)) }));
		git(root, 'add', '--', CASE_SET_V9_FILE);
		copyFileSync(join(REPO, CASE_SET_V9_FILE), nine);
		expect(git(root, 'status', '--porcelain', '--', CASE_SET_V9_FILE), 'arrangement: version nine’s file, changed since it was staged').toBe(`AM ${CASE_SET_V9_FILE}\n`);
		const changed = await f.run();
		expect(changed.out, 'a case set changed since it was staged holds no line').toContain(
			f.refused(
				'it differs from what git has staged, and the check holds an ACKNOWLEDGED line only to what a commit would carry (design D3c) — `git add` it'
			)
		);
		expect(changed.code, changed.out).toBe(1);
	}, 120_000);

	// ⭐ The independent check of package J's check, the MINOR finding — THE THIRD REFUSAL, HELD: a case-set file git tracks but
	// the working tree has lost had words of its own (`CASE_SET_FILES.gone`) and no case, so nothing told them from a record
	// file's, nor the file named from the file dropped in silence (`ARP-J-M20`, `ARP-J-M21`: each SURVIVED before this case).
	// The D3c case above drops version nine with `git rm -f`, from what a commit carries too; this one deletes it from the
	// working tree alone.
	it('⛔ RED FIRST — a case-set file git tracks but the working tree has LOST is not read, and is a RECORD problem naming it: version nine’s file staged, then deleted from the working tree alone, holds no line — the check reads what a commit would carry. ⭑ CONTROL: the same file restored from what git staged holds its line, GREEN', async () => {
		const root = gitRepo();
		const f = await d3cRoot('qr-cli-d3c-gone', root);
		copyFileSync(join(REPO, CASE_SET_V9_FILE), join(root, CASE_SET_V9_FILE));
		git(root, 'add', '--', CASE_SET_V9_FILE);
		rmSync(join(root, CASE_SET_V9_FILE));
		expect(git(root, 'status', '--porcelain', '--', CASE_SET_V9_FILE), 'arrangement: version nine’s file, staged and gone from the working tree').toBe(`AD ${CASE_SET_V9_FILE}\n`);
		const gone = await f.run();
		expect(gone.out, 'a case set gone from the working tree holds no line').toContain(
			f.refused(
				'git tracks it, but it is gone from the working tree, and the check reads what a commit would carry — restore it, or `git rm` it'
			)
		);
		expect(gone.code, gone.out).toBe(1);
		// ⭑ CONTROL — the same file, restored from what git staged: it holds its line.
		git(root, 'checkout', '--', CASE_SET_V9_FILE);
		expect(git(root, 'status', '--porcelain', '--', CASE_SET_V9_FILE), 'arrangement: version nine’s file, restored as staged').toBe(`A  ${CASE_SET_V9_FILE}\n`);
		const restored = await f.run();
		expect(restored.out, 'CONTROL: version nine’s file restored holds the line whole').toContain(GREEN);
		expect(restored.code, restored.out).toBe(0);
	}, 120_000);

	it('⛔ RED FIRST — a case directory outside any git work tree is refused, as a record directory is: there is no committed case set to speak for', async () => {
		const root = tmp();
		const f = await d3cRoot('qr-cli-d3c-outside', root);
		copyFileSync(join(REPO, CASE_SET_V9_FILE), join(root, CASE_SET_V9_FILE));
		const outside = await f.run();
		expect(outside.out, 'refused before anything is checked').toContain(
			`reviewer:qual:check — the case directory ${join(root, dirname(CURRENT_CASE_SET_FILE))} is not in a git work tree, and only a case set git tracks is committed: `
		);
		expect(outside.out, 'nothing checked').not.toContain('reviewer:qual:check — today’s reviewer fingerprint');
		expect(outside.code, outside.out).toBe(2);
	}, 120_000);

	it('⛔ a record file git does not track, or one changed since it was staged, is NOT READ — green here is green on the commit', async () => {
		const lines = await recorded({ runId: 'qr-cli-2', cases: CURRENT_CASES, versions: { caseSet: 12, oracles: 12 } /* ⭐ package K — ~~10, 10~~; ⭐ package V — ~~11, 11~~ */ });
		const untracked = gitRepo();
		writeFileSync(join(untracked, 'runs.ndjson'), text(lines));
		const r = cli(['--conditions=source'], ['--records', untracked]);
		expect(r.status, r.out).toBe(1);
		expect(r.out).toContain('runs.ndjson: not read — git does not track it');
		expect(r.out, 'and so it covers nothing').toContain('91 of 91 current case(s) are not MEASURED'); // ⭐ package V — ~~76 of 76~~

		const changed = gitRepo();
		writeFileSync(join(changed, 'runs.ndjson'), text(lines));
		git(changed, 'add', 'runs.ndjson');
		// ⭐ D3b (8) — ~~'G3-CLEAN.T01'~~: a case of version ten's, under its new id. ⭐ Package K — ~~'G10-CLEAN.T01'~~: version
		// eleven's, under its new id (D3d).
		appendFileSync(join(changed, 'runs.ndjson'), serializeLine(escalate('qr-cli-2', ['G11-CLEAN.T01'])));
		const c = cli(['--conditions=source'], ['--records', changed]);
		expect(c.status, c.out).toBe(1);
		expect(c.out).toContain('runs.ndjson: not read — it differs from what git has staged');
	}, 120_000);

	// ⭐ The independent check of package J's check, the MINOR finding — AND THE RECORD'S OWN: its words for a record file git
	// tracks but the working tree has lost — struck, never deleted (§5.4) — stood untested since J2-3, and the one reader's
	// branch with them (`ARP-J-M22`, `ARP-J-M21`: each SURVIVED before this case and the one above).
	it('⛔ a record file git tracks but the working tree has LOST is NOT READ, and is named: a record file is struck, never deleted (§5.4). ⭑ CONTROL: the same file restored from what git staged is read and covers today’s set, GREEN', async () => {
		const lines = await recorded({ runId: 'qr-cli-gone', cases: CURRENT_CASES, versions: { caseSet: 12, oracles: 12 } /* ⭐ package K — ~~10, 10~~; ⭐ package V — ~~11, 11~~ */ });
		const dir = gitRepo();
		writeFileSync(join(dir, 'runs.ndjson'), text(lines));
		git(dir, 'add', 'runs.ndjson');
		rmSync(join(dir, 'runs.ndjson'));
		expect(git(dir, 'status', '--porcelain'), 'arrangement: the record file, staged and gone from the working tree').toBe('AD runs.ndjson\n');
		const r = cli(['--conditions=source'], ['--records', dir]);
		expect(r.out).toContain(
			'  [RECORD] runs.ndjson: not read — git tracks it, but it is gone from the working tree — a record file is struck, never deleted (§5.4)\n'
		);
		expect(r.out, 'and so it covers nothing').toContain('91 of 91 current case(s) are not MEASURED'); // ⭐ package V — ~~76 of 76~~
		expect(r.status, r.out).toBe(1);
		// ⭑ CONTROL — the same file, restored from what git staged: read, it covers today's set.
		git(dir, 'checkout', '--', 'runs.ndjson');
		expect(git(dir, 'status', '--porcelain'), 'arrangement: the record file, restored as staged').toBe('A  runs.ndjson\n');
		const restored = cli(['--conditions=source'], ['--records', dir]);
		expect(restored.out, 'CONTROL: the record file restored is read').toContain(GREEN);
		expect(restored.status, restored.out).toBe(0);
	}, 120_000);

	it('⛔ an ESCALATION citing a finding the register STRIKES clears nothing, end to end — and one it holds open does', async () => {
		const dir = gitRepo();
		// ⭐ B7 — ~~G3-RR-04~~: its catcher part, G3-RR-04.T05, version eight's case for its plant. ⭐ D3b (8) — ~~G3-RR-04.T05~~:
		// version ten's, G10-RR-04.T05, under its new id ⭐ — and version eleven's, under the same, D3d not reaching it.
		const missed = await recorded({
			runId: 'qr-cli-3',
			cases: CURRENT_CASES,
			versions: { caseSet: 12, oracles: 12 } /* ⭐ package K — ~~10, 10~~; ⭐ package V — ~~11, 11~~ */,
			reply: (id) => (id === 'G10-RR-04.T05' ? judgement([]) : asOracle(id))
		});
		writeFileSync(join(dir, 'runs.ndjson'), text([...missed, escalate('qr-cli-3', ['G10-RR-04.T05'], 'REG-F-105')]));
		git(dir, 'add', 'runs.ndjson');
		const register = join(tmp(), 'register.md');
		writeFileSync(register, '### ~~REG-F-105~~ — RULED\n');
		const r = cli(['--conditions=source'], ['--records', dir, '--register', register]);
		expect(r.status, r.out).toBe(1);
		expect(r.out).toContain('ESCALATION cites REG-F-105, whose register heading is struck');
		expect(r.out).toContain('run qr-cli-3: G10-RR-04.T05 — PLANTED_DEFECT_NOT_REJECTED');
		writeFileSync(register, '### REG-F-105 — open, for the control\n');
		const open = cli(['--conditions=source'], ['--records', dir, '--register', register]);
		// ⭐ Package P F3 — ~~GREEN, its oracles conferred (REG-D-113)~~: nothing owed but the conferral of the six new oracles.
		// ⭐ B7 — GREEN again, version eight's oracles conferred (`REG-D-126`). ⭐ B8a — ~~GREEN~~: the confirmation alone owed.
		// ⭐ `REG-D-129` — GREEN again, the restatement confirmed.
		expect(open.out, 'CONTROL: the same finding, open — GREEN').toContain(GREEN);
		expect(open.status, open.out).toBe(0);
	}, 120_000);

	it('⭐ J2-6 — the CLI PRINTS the attribution report, and owes nothing for a record whose only miss is attribution (REG-D-080) — ~~nothing but the conferral (package P F3)~~ ⭐ GREEN (B7)', async () => {
		const dir = gitRepo();
		const lines = await recorded({
			runId: 'qr-cli-4',
			cases: CURRENT_CASES,
			versions: { caseSet: 12, oracles: 12 } /* ⭐ package K — ~~10, 10~~; ⭐ package V — ~~11, 11~~ */,
			// ⭐ Package V — ~~'W-RR-04'~~: the current set's, re-cast as W12-RR-04, its plant unchanged.
			reply: (id) => (id === 'W12-RR-04' ? judgement([RR02]) : asOracle(id))
		});
		writeFileSync(join(dir, 'runs.ndjson'), text(lines));
		git(dir, 'add', 'runs.ndjson');
		const r = cli(['--conditions=source'], ['--records', dir]);
		expect(r.out).toContain(
			[
				ATTRIBUTION_HEADER,
				// ⭐ `JAN-EXEC` Phase 7 completion E2 — ~~27 of 28~~: case set v5's seven planted declared cases are counted too
				// (design B5).
				// ⭐ Package P F3 — ~~34 of 35~~: and case set v7's five planted graph cases.
				// ⭐ B7 — ~~39 of 40~~: case set v8's 26 planted carried cases and its 15 catchers.
				// ⭐ Package V — ~~40 of 41~~: case set v12's 31 planted re-cast and new cases — P12-RR-03 SATISFIED now — and the 15
				// catchers; ~~W-RR-04#1~~ W12-RR-04#1.
				'  run qr-cli-4: the planted criterion named in 45 of 46 answered planted evaluation(s), against today’s oracles',
				'    W12-RR-04#1 — REJECTED, the right verdict; RR-04 not faulted (it faulted RR-02)',
				// ⭐ `REG-D-113` — GREEN again: ~~red on the conferral alone (`E12F` F5)~~.
				// ⭐ Package P F3 — ~~GREEN~~: red on the conferral alone again (`ONLY_THE_CONFERRAL`). ⭐ B7 — GREEN again.
				// ⭐ B8a — ~~GREEN~~: red on the confirmation alone (`ONLY_THE_CONFIRMATION`). ⭐ `REG-D-129` — GREEN again.
				GREEN_HEAD
			].join('\n')
		);
		expect(r.out).toContain(GREEN);
		expect(r.status, r.out).toBe(0);
	}, 120_000);

	it('⭐ J2-6 — the CLI counts a run’s planted evaluations outside today’s set OUT ALOUD, by every oracle version on file (REG-D-080)', async () => {
		// The committed record's shape: a run of version one under today's fingerprint, beside one over today's set.
		const dir = gitRepo();
		const v1 = await recorded({ runId: 'qr-cli-5', cases: CASES });
		const now = await recorded({ runId: 'qr-cli-6', cases: CURRENT_CASES, versions: { caseSet: 12, oracles: 12 } /* ⭐ package K — ~~10, 10~~; ⭐ package V — ~~11, 11~~ */ });
		writeFileSync(join(dir, 'runs.ndjson'), text([...v1, ...now]));
		git(dir, 'add', 'runs.ndjson');
		const r = cli(['--conditions=source'], ['--records', dir]);
		expect(r.out).toContain(
			[
				ATTRIBUTION_HEADER,
				// ⭐ B7 — ~~10 of 10 … (8 …)~~: version eight holds none of version one's graph cases, G-RR-01 among them.
				// ⭐ Package V — ~~9 of 9 … (9 …)~~: version twelve holds none of version one's cases, its work-product ones re-cast
				// under new ids, so all 18 planted are counted out aloud (the mix, counted in and out, is held on version eleven by
				// the unit limb NO SILENT SHRINK).
				'  run qr-cli-5: the planted criterion named in 0 of 0 answered planted evaluation(s), against today’s oracles (18 answered planted evaluation(s) of cases not in the current set are not counted)',
				// ⭐ E2 — ~~28 of 28~~: and case set v5's seven planted declared cases (design B5).
				// ⭐ Package P F3 — ~~35 of 35~~: and case set v7's five planted graph cases.
				// ⭐ B7 — ~~40 of 40~~: case set v8's 26 planted carried cases and its 15 catchers.
				// ⭐ Package V — ~~41 of 41~~: case set v12's 31 planted re-cast and new cases and the 15 catchers.
				'  run qr-cli-6: the planted criterion named in 46 of 46 answered planted evaluation(s), against today’s oracles',
				// ⭐ `REG-D-113` — GREEN again: ~~red on the conferral alone (`E12F` F5)~~.
				// ⭐ Package P F3 — ~~GREEN~~: red on the conferral alone again (`ONLY_THE_CONFERRAL`). ⭐ B7 — GREEN again.
				// ⭐ B8a — ~~GREEN~~: red on the confirmation alone (`ONLY_THE_CONFIRMATION`). ⭐ `REG-D-129` — GREEN again.
				GREEN_HEAD
			].join('\n')
		);
		expect(r.out).toContain(GREEN);
		expect(r.status, r.out).toBe(0);
	}, 120_000);

	it('⭐ SR-4 — the CLI names the SELECTION in force in its header and holds coverage to it: ~~nothing but the conferral owed (package P F3)~~ ⭐ GREEN (B7) on the selected candidate’s run, coverage owed for a candidate never run, naming all 76 cases (REG-D-086)', async () => {
		const dir = gitRepo();
		const glm = await recorded({ runId: 'qr-cli-7', candidate: DEVIN, cases: CURRENT_CASES, versions: { caseSet: 12, oracles: 12 } /* ⭐ package K — ~~10, 10~~; ⭐ package V — ~~11, 11~~ */ });
		writeFileSync(join(dir, 'runs.ndjson'), text([...glm, select({ transport: 'devin', modelLabel: 'glm-5-3-flash-max' })]));
		git(dir, 'add', 'runs.ndjson');
		const r = cli(['--conditions=source'], ['--records', dir]);
		expect(r.out).toContain(
			`reviewer:qual:check — the SELECTION in force: devin / glm-5-3-flash-max, on REG-D-084 (runs.ndjson:${glm.length + 1}) — every current case is owed its measurement under today’s fingerprint (REG-D-086)\n`
		);
		// ⭐ `REG-D-113` — GREEN again: ~~nothing owed but the conferral (`E12F` F5)~~.
		// ⭐ Package P F3 — ~~GREEN~~: nothing owed but the conferral of the six new oracles. ⭐ B7 — GREEN again.
		// ⭐ B8a — ~~GREEN~~: nothing owed but the confirmation. ⭐ `REG-D-129` — GREEN again.
		expect(r.out).toContain(GREEN);
		expect(r.status, r.out).toBe(0);
		appendFileSync(join(dir, 'runs.ndjson'), serializeLine(select({ transport: 'devin', modelLabel: 'a-model-never-run' })));
		git(dir, 'add', 'runs.ndjson');
		const red = cli(['--conditions=source'], ['--records', dir]);
		expect(red.status, red.out).toBe(1);
		expect(red.out).toContain(
			// ⭐ Package V — ~~76 of 76~~: version twelve's 91.
			`  [COVERAGE] 91 of 91 current case(s) are not MEASURED under today’s reviewer fingerprint ${FP.reviewer} by the SELECTED candidate devin / a-model-never-run (REG-D-084; the SELECTION in force, runs.ndjson:${glm.length + 2}): ${CURRENT_CASES.map((c) => c.id).join(', ')} — owed: a run of the selected candidate over them`
		);
	}, 120_000);

	it('⛔ SR-4 — a SELECTION whose ruling the register it reads STRIKES is RED end to end, and its header says the ruling is WITHDRAWN; the same register, the heading live, is ~~red on the conferral alone (package P F3)~~ ⭐ GREEN (REG-D-086; B7)', async () => {
		// The committed record's shape — a run of version one beside one over today's set, here the selected candidate's —
		// with the SELECTION appended.
		const dir = gitRepo();
		const v1 = await recorded({ runId: 'qr-cli-8', cases: CASES });
		const glm = await recorded({ runId: 'qr-cli-9', candidate: DEVIN, cases: CURRENT_CASES, versions: { caseSet: 12, oracles: 12 } /* ⭐ package K — ~~10, 10~~; ⭐ package V — ~~11, 11~~ */ });
		const lines = [...v1, ...glm, select({ transport: 'devin', modelLabel: 'glm-5-3-flash-max' })];
		writeFileSync(join(dir, 'runs.ndjson'), text(lines));
		git(dir, 'add', 'runs.ndjson');
		// A copy of the register the CLI reads by default, with the one heading of REG-D-084 struck.
		const live = readFileSync(`${REPO}/${REGISTER_FILE}`, 'utf8');
		const struck = live.replace('\n### REG-D-084 —', '\n### ~~REG-D-084~~ —');
		expect([...registerRulings(live).struck], 'the fixture: REG-D-084 is live in the register').not.toContain('REG-D-084');
		expect([...registerRulings(struck).struck], 'the fixture: exactly REG-D-084 struck in the copy').toEqual(['REG-D-084']);
		const register = join(tmp(), 'register.md');
		writeFileSync(register, struck);
		const r = cli(['--conditions=source'], ['--records', dir, '--register', register]);
		expect(r.status, r.out).toBe(1);
		expect(r.out).toContain(
			`reviewer:qual:check — the SELECTION in force: devin / glm-5-3-flash-max, on REG-D-084, WITHDRAWN — its register heading is struck (runs.ndjson:${lines.length}) — every current case is owed its measurement under today’s fingerprint (REG-D-086)\n`
		);
		expect(r.out).toContain(
			`  [RECORD] runs.ndjson:${lines.length}: the SELECTION in force cites REG-D-084, whose register heading is struck — a withdrawn ruling selects nothing; append a SELECTION citing a ruling in force\n`
		);
		writeFileSync(register, live);
		const control = cli(['--conditions=source'], ['--records', dir, '--register', register]);
		expect(control.out, 'CONTROL: the same register, the heading live').toContain(
			`reviewer:qual:check — the SELECTION in force: devin / glm-5-3-flash-max, on REG-D-084 (runs.ndjson:${lines.length}) — every current case`
		);
		// ⭐ `REG-D-113` — GREEN again: ~~nothing owed but the conferral (`E12F` F5)~~.
		// ⭐ Package P F3 — ~~GREEN~~: nothing owed but the conferral of the six new oracles. ⭐ B7 — GREEN again.
		// ⭐ B8a — ~~GREEN~~: nothing owed but the confirmation. ⭐ `REG-D-129` — GREEN again.
		expect(control.out).toContain(GREEN);
		expect(control.status, control.out).toBe(0);
	}, 120_000);
});
