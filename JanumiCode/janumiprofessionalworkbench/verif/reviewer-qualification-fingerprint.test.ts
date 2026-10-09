// ⭐ `JAN-CRITREAD` J2-3 — THE REVIEWER FINGERPRINT (DESIGN-what-the-tests-prove.md §5.5; ROADMAP J2-3 + J2-4).
//
// One exported function, shared by the check and the runner, says WHICH reviewer a qualification record measured:
// the probe set's materialized prompts, the budget constants, the seed criteria whole, and a scoring digest over a
// fixed raw-reply corpus. It must MOVE on every component that decides a verdict — one row per component below, each
// driven by swapping that one seam and nothing else — and must NOT move on an edit that decides nothing: a comment.
//
//   · THE ROWS each show the component moves the fingerprint, and name what does NOT move with it — so a move confined
//     to the probe set or the scoring can be told from one that reached a case prompt (§5.6 limb 1).
//   · THE COMMENT-ONLY GUARD is measured on a DISPOSABLE COPY of the tree, never on this one: a comment is added to the
//     copied validator and the fingerprint recomputed there, with a behaviour edit to the same copy as its control.
//     The packages are reached through real directories of re-exports, never a link, so removing the copy cannot
//     reach the repository.
//   · THE PROBE SET is pinned to reach what its needles name (each framing, observation kind, account and narration
//     shape), the two content caps a probe can reach through the oversize-together probes — which is why the third,
//     `CONTENT_MAX`, is hashed as a constant — and, since `PQ-1`, each rule a row below names: among them the refusal of
//     a review no fence can enclose, in EVERY framing (`G-NO-FENCE`, `W-NO-FENCE`, `P-NO-FENCE`), and the chooser at its
//     LAST candidate (`P-FENCE-AT-THE-LAST`), so a validator that fails closed in one framing alone, or a chooser that
//     tries any number of candidates but a hundred, moves `probes`. And the skeleton's table, which no probe can plant
//     whole, is hashed whole, as it reads (the skeleton's digest, beside the probes, held to the literal its determinism
//     test pins); and the reader its chooser models, as it reads a SLICE (the token the product's chooser takes over each
//     witness of the reader corpus, beside them, held to the token each witness states). What no probe reaches, and why,
//     is said in `probes.ts`.
//   · THE RUNNER AGREES: the case prompts the fingerprint derives are the hashes a run records.
//   · ⭐ AND THE ATTACKS THE ADVERSARIAL REVIEW FOUND INVISIBLE EACH MOVE IT: the plan's independence (E4) and the
//     seeded policy's (E14), a model-supplied `stipulated` honoured (E5), a malformation class no longer detected (E6).
//   · THE BUDGET OBJECT IS THE ONLY PLACE A LIMIT IS WRITTEN — held structurally, over the validator's syntax tree,
//     and behaviourally for every limit a probe can reach.
//   · ⭐⭐ `JAN-PRQUAL` `PQ-1` (design D3; `REG-F-476`, `REG-D-094`) — THE FINGERPRINT REACHES THE PROCESS-RESULT RENDERER.
//     Its P- probes are run literals built through the `processResult` seam, whose default IS the product's builder:
//     a renderer change moves `probes` and ~~no case prompt~~ — since `PQ-2` (design D4) — the process-result cases'
//     prompts alone, and so does a change confined to ONE branch of the
//     renderer — each branch the per-branch rows name (`BRANCH_CHANGES`), held to the probes that take it (design §2
//     G2: hashed over one clean run, the renderer's other branches were unseen). ⭐ And so does a change to what either
//     FENCE CHOOSER reads (`REG-F-481`) — a row per slice the view's chooser reads and one per slice the VALIDATOR's
//     reads (but a call name the host did not mint, which no probe can plant: `probes.ts` NOT TAKEN), each held to move
//     a probe in every framing that carries the slice, so a chooser that skips it in one framing alone moves one too,
//     every planted token pinned; a row for what NO chooser may read (each chooser's token in the bytes a cut a probe
//     takes removes — every cut but those standing on a cut's own arithmetic, which `probes.ts` names — astride two
//     slices and astride a cut's two parts, split by a line feed, laid out on a line with no bidi control), so a
//     chooser that reads more than the prompt carries in any of those ways is seen as one that reads less is; a row per
//     family of the skeleton's generated table, one per rule of the reader its chooser models — of how a code point is
//     read and of how a slice is — the reader corpus held to the token each witness states and to its composition,
//     witness by witness, each witness that stands on a rule parted from its token by that rule dropped, and one row
//     each for the table and the reader changed where no probe plants — and to each encoder of JSON on a line, at each
//     of its call sites and for each break it escapes (every break planted at every site), the capture line's count, a
//     head-only cut's two edges, a cut layout's widest declaration, a refusal in every framing and the edges of one,
//     the account's host lines and its tie, each held by a row of its own. ⭐ And design §9.3 D7 and D8 (the sponsor's
//     answers of 2026-10-05): how each list is written and labelled and the rationale left unlabelled, each stakes
//     value beside its criterion, and each phrase of D8's instruction and glosses — each a row that moves exactly the
//     probes, and the case prompts, that carry it. ⭐ And how each FIELD of the account is read (design §9.3 D7): a row
//     per field and per way of reading it otherwise than the prompt carries it — as one line of JSON, the terminators a
//     reader may not break at read as line feeds, its line feeds read away, a list's items joined, ⭐ its bidi controls
//     read away — for each chooser, each moving exactly the account-breaks probes, which plant in every field both ways
//     (and, by their arrangement row, each terminator alone, each family of bidi controls alone and the field's last
//     line, read so, leave a candidate of their own free); and a list item holding a line feed, written otherwise,
//     moving exactly the probes that show one.
//     The pins that leaned on the validator's old ` …(truncated)` marker and the `"""` fence are re-expressed against
//     the declared cut (`[CUT FOR THIS REVIEW: …]`, its numbers checked against the bytes) and the fence lines. ⭐ And
//     "no case prompt moves" is MEASURED: the case prompts are materialized through the validator seam
//     (`casePromptsOf`), and a CONTROL row shows that limb sees one move. ⭐ `JAN-PRQUAL` `PQ-2` (design D4): and every
//     row's claim about the case prompts is asked of the CURRENT set too (`movedNow`) — case set v1 holds no process
//     result, so a claim asked of it alone could not fail where case set v4's fourteen are built; asked of v4, the
//     validator chooser that stops reading a process result's view was found to move all fourteen, and says so.
//     ⚠ Where no seam a row changes reaches `casePromptsOf` — the SCORING, MALFORMATION and INDEPENDENCE rows — that
//     ask holds by construction and could not fail, and the row says so: it is no measured claim.
//   · ⭐ `PQ-2` — EVERY WITNESS OF THE READER CORPUS HOLDS THE CODE POINTS ITS LABEL NAMES, with its own control: a
//     witness kept by its label with its code point taken out is named.
//   · ⭐ `JAN-SELREV` SR-2 (D6) — THE FINGERPRINT MEASURES THE VALIDATOR WITHOUT `requireReportedModel`. What it hashes
//     is the runner's SCORING seam: the corpus replies that report another model are scored there, never refused, and on
//     a copy the option set in the runner moves the scoring digest — which is why only the product's devin branch sets
//     it. ⚠ The PROBE seam's gate CANNOT move the fingerprint: every probe reply is a bare string that reports no model,
//     so the option set there refuses nothing the fingerprint hashes. That seam's only guard is the test that hands it
//     the corpus replies directly: 'a corpus reply reporting ANOTHER model is scored, never refused', below.
// ⛔ NO MODEL IS REACHABLE: in process PATH names an empty directory, and every child is hermetic
// (`reviewer-qualification-hermetic.ts`).
import { spawnSync } from 'node:child_process';
import {
	copyFileSync,
	cpSync,
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
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
	OBSERVATION_HEADING,
	processResultContentBudget,
	processResultUntrustedSlices,
	REASONING_REVIEW_BUDGET
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { renderProcessResultReview } from '../apps/rph-demo/src/lib/server/assurance/process-result-render.js';
import { DELETED, MAPPED } from '../apps/rph-demo/src/lib/server/assurance/fence-skeleton-table.js';
import {
	processResultReviewInput,
	type ProcessResultReviewSource
} from '../apps/rph-demo/src/lib/server/assurance/review-input.js';
import {
	chooseFence,
	codePoints,
	FENCE_LENGTH,
	headAndTailCutDeclaration,
	headCutDeclaration,
	jsonLine,
	NO_FENCE_STATEMENT,
	tailOf
} from '../apps/rph-demo/src/lib/server/assurance/review-fence.js';
import type { ObservedProcessRun } from '../apps/rph-demo/src/lib/server/tools/process-run-observer.js';
import type { ReasoningReviewInput } from '@janumipwb/rph-assurance';
import {
	AssuranceSeveritySchema,
	OBSERVED_TOOL_CALL_LIMIT,
	RecordPlaneNameSchema,
	type AssessmentCriterion,
	type ObservedToolCallReport
} from '@janumipwb/rph-contracts';
import {
	CASE_SET_V1_FILE,
	CURRENT_CASE_SET_FILE,
	type CaseSet,
	type QualificationCase
} from '../scripts/reviewer-qual/cases.js';
import {
	committedCaseSet,
	PRODUCT_SEAMS,
	reviewerFingerprint,
	type FingerprintSeams,
	type ReviewerFingerprint
} from '../scripts/reviewer-qual/fingerprint.js';
import { sha256 } from '../scripts/reviewer-qual/digest.js';
import { detectMalformations } from '../scripts/reviewer-qual/malformations.js';
import type { ToolInvocationResult } from '../apps/rph-demo/src/lib/server/tools/backing-tool.js';
import { FINGERPRINT_PROBES, PROBE_SUBJECT, READER_CORPUS } from '../scripts/reviewer-qual/probes.js';
import type { CallLine, CandidateIdentity } from '../scripts/reviewer-qual/record.js';
import { evaluateCase, runQualification } from '../scripts/reviewer-qual/runner.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';
import { CORPUS_CASE, scoringCorpus } from '../scripts/reviewer-qual/scoring-corpus.js';
import {
	fenceSkeletonTable,
	parseUnicode,
	readExtract,
	SOURCES,
	UNICODE_VERSION,
	type FenceSkeletonTable,
	type InputKey
} from '../scripts/fence-skeleton/core.js';
import { committedExtracts } from '../scripts/fence-skeleton/generate.js';
import { BUN, hermeticEnv, NO_PROGRAMS } from './reviewer-qualification-hermetic.js';

const REPO = fileURLToPath(new URL('../', import.meta.url))
	.replace(/\\/g, '/')
	.replace(/\/$/, '');
/** ⚠ `JAN-CRITREAD` J2-5 — case set version one, a fixed fixture: no reviewer component depends on the cases. */
const CASES = (JSON.parse(readFileSync(`${REPO}/${CASE_SET_V1_FILE}`, 'utf8')) as CaseSet).cases;
/** ⭐ `PQ-1` — the CURRENT case set ~~(case set v3: no process-result case), whose case prompts no renderer change may move~~ —
 *  since `JAN-PRQUAL` `PQ-2` case set v4, whose fourteen process-result cases a renderer change DOES reach (design D4). */
const CURRENT_CASES = committedCaseSet(new URL('../', import.meta.url)).cases;
/** ⭐ `PQ-2` — the current set's process-result cases: the case prompts a change to what a process result's reviewer reads
 *  may move, and the only ones. */
const CURRENT_PROCESS_RESULTS = CURRENT_CASES.filter((c) => c.arm === 'PROCESS_RESULT').map((c) => c.id);
/** ⭐ `PQ-2` — the cases of `base` whose prompts moved in `fp`, the initial or the repair. */
const movedCasePrompts = (fp: ReviewerFingerprint, base: ReviewerFingerprint): string[] =>
	[...base.casePrompts].filter(([id, p]) => {
		const now = fp.casePrompts.get(id);
		return now?.initial !== p.initial || now.repair !== p.repair;
	}).map(([id]) => id);
/**
 * ⭐ `PQ-2` (design D4) — the CURRENT set's case prompts a change at `seams` moves. ⛔ A row that asked only whether a
 * change moved a case prompt of case set v1 asked it of a set that holds no process result, so its "no case prompt"
 * could not fail where case set v4's fourteen are built (a validator chooser that stops reading a process result's view
 * moves all fourteen, measured): every row's claim about the case prompts is asked of the current set too.
 */
const movedNow = async (seams: FingerprintSeams): Promise<string[]> =>
	movedCasePrompts(await reviewerFingerprint(CURRENT_CASES, seams), BASE_NOW);
const REPAIR_INSTRUCTION = 'IMPORTANT: reply with ONLY the minified JSON object.';
// ~~const TRUNCATED = ' …(truncated)';~~ — the validator's marker, appended AFTER the bytes and naming nothing; gone with
// `JAN-PRQUAL` `PQ-1` (design D2, the sponsor's answer (a) of 2026-10-03: every cut in every framing is declared BEFORE its
// bytes, naming the slice). Every pin that counted or measured it is re-expressed against the declaration.
/** ⭐ `PQ-1` — how every declared cut begins, in every framing and in a process result's review view (`review-fence.ts`). */
const CUT_DECLARED = '[CUT FOR THIS REVIEW: ';
/** ⭐ `PQ-1` — a line of the fence's form, `<<<UNTRUSTED-nn>>>` with two digits: a fence line, or a line quoting one. */
const FENCE_LINE = /^<<<UNTRUSTED-\d\d>>>$/;
// ~~const count = (text, needle) => text.split(needle).length - 1;~~ — it counted the marker; `PQ-1` names each cut instead
// (`cutSlices`, below), which a count of declarations could not tell apart.

let BASE: ReviewerFingerprint;
/** ⭐ `PQ-1` — today's fingerprint over the CURRENT case set: the same reviewer, ~~v3's~~ v4's case prompts (`PQ-2`). */
let BASE_NOW: ReviewerFingerprint;
beforeAll(async () => {
	// ⛔ No program can be found from this process: the validator's default print is `agyPrint`.
	vi.stubEnv('PATH', NO_PROGRAMS);
	BASE = await reviewerFingerprint(CASES);
	BASE_NOW = await reviewerFingerprint(CURRENT_CASES);
}, 120_000);
afterAll(() => {
	vi.unstubAllEnvs();
});

/** Everything but the named components is where it was. */
function onlyMoved(fp: ReviewerFingerprint, moved: readonly (keyof ReviewerFingerprint['components'])[]): void {
	expect(fp.reviewer, 'the reviewer fingerprint moves').not.toBe(BASE.reviewer);
	for (const k of ['probes', 'budget', 'criteria', 'scoring'] as const)
		if (moved.includes(k)) expect(fp.components[k], `${k} moves`).not.toBe(BASE.components[k]);
		else expect(fp.components[k], `${k} does not move`).toBe(BASE.components[k]);
	expect(fp.scoring, 'the RUN line’s scoring digest is the scoring component').toBe(fp.components.scoring);
}

describe('JAN-CRITREAD J2-3 — the reviewer fingerprint MOVES on each component', () => {
	it('⭐ a PROMPT BRANCH — the process-result framing: the probes move, and of the case prompts exactly the process-result cases’ — none of v1’s, and the current set’s fourteen (PQ-2)', async () => {
		const seams: FingerprintSeams = {
			...PRODUCT_SEAMS,
			validator: (print) =>
				PRODUCT_SEAMS.validator((p) =>
					print(p.replace('The COMMAND RESULT to review', 'The COMMAND OUTPUT to review'))
				)
		};
		const fp = await reviewerFingerprint(CASES, seams);
		onlyMoved(fp, ['probes']);
		// ⭐ `PQ-1` — MEASURED: the case prompts are materialized through this same validator seam (`casePromptsOf`), so
		// this half says the change reached no case prompt — not, as it did when they were read off the runner's own
		// validator, that it could not have (the CONTROL below is the change that does reach them).
		expect(fp.casePrompts, 'no case of v1 is a process result').toEqual(BASE.casePrompts);
		// ~~⭐ `PQ-1` — and still true of the CURRENT set (case set v3): no case of it is a process result either.~~
		// ⭐ `JAN-PRQUAL` `PQ-2` (design D4) — the CURRENT set, case set v4, holds fourteen: exactly their prompts move, each
		// its initial and its repair, and no other case's does.
		expect(CURRENT_PROCESS_RESULTS, 'the arrangement: the current set holds the fourteen').toHaveLength(14);
		const now = await reviewerFingerprint(CURRENT_CASES, seams);
		expect(movedCasePrompts(now, BASE_NOW), 'the case prompts of the current set that move').toEqual(CURRENT_PROCESS_RESULTS);
		for (const id of CURRENT_PROCESS_RESULTS)
			for (const role of ['initial', 'repair'] as const)
				expect(now.casePrompts.get(id)![role], `${id}: its ${role} prompt moves`).not.toBe(BASE_NOW.casePrompts.get(id)![role]);
	});

	it('⭐ CONTROL — the "no case prompt moves" limb MEASURES: a validator change EVERY prompt carries moves every case prompt, of both sets', async () => {
		// ⛔ WHY THIS ROW (`PQ-1`; `REG-F-476`): the rows around it say a change confined to the process-result framing, to
		// a cut, or to the renderer moves the probes and NO case prompt. While the case prompts were read off the runner's
		// own evaluation, which builds a validator of its own, that half could not fail under a validator seam: the
		// preamble sentence every prompt of every framing carries, changed at the seam, moved the probes and left every
		// case prompt where it was. They are materialized through the seam now (`casePromptsOf`); this row is the change
		// that must reach them, so the limb is shown to see a case prompt move before it is trusted to report that none did.
		const seams: FingerprintSeams = {
			...PRODUCT_SEAMS,
			validator: (print) =>
				PRODUCT_SEAMS.validator((p) =>
					print(p.replace('You are an independent assurance reviewer', 'You are an INDEPENDENT assurance reviewer'))
				)
		};
		for (const [label, cases, base] of [
			['case set v1', CASES, BASE],
			['the current set', CURRENT_CASES, BASE_NOW]
		] as const) {
			const fp = await reviewerFingerprint(cases, seams);
			onlyMoved(fp, ['probes']);
			for (const c of cases)
				for (const role of ['initial', 'repair'] as const)
					expect(fp.casePrompts.get(c.id)![role], `${label} ${c.id}: its ${role} prompt moves`).not.toBe(
						base.casePrompts.get(c.id)![role]
					);
		}
	});

	it('⭐ an OVERSIZE PROBE — a change only an input over its budget reaches (how a cut is declared): the probes move', async () => {
		// ~~`p.replaceAll(TRUNCATED, ' …(cut)')`~~ — `PQ-1`: a cut is declared BEFORE its bytes now, by `[CUT FOR THIS REVIEW: `.
		const seams: FingerprintSeams = {
			...PRODUCT_SEAMS,
			validator: (print) =>
				PRODUCT_SEAMS.validator((p) => print(p.replaceAll(CUT_DECLARED, '[CUT FOR THIS REVIEW (declared): ')))
		};
		const fp = await reviewerFingerprint(CASES, seams);
		onlyMoved(fp, ['probes']);
		expect(fp.casePrompts, 'every case is seen whole, so no case prompt carries a cut').toEqual(BASE.casePrompts);
		// ⭐ `JAN-PRQUAL` `PQ-2` (design D4) — nor any of the current set but P-RR-07-CUT, the one case cut by design: its review
		// keeps a HEAD and a TAIL under a declaration (`reviewer-qualification-cases.test.ts` pins it by id).
		expect(movedCasePrompts(await reviewerFingerprint(CURRENT_CASES, seams), BASE_NOW), 'nor any of the current set but the one cut by design').toEqual(
			['P-RR-07-CUT']
		);
		// ⭐ `PQ-1` — AND THE NAME IS HELD TO THE BYTES BOTH WAYS: the probes a cut declaration reaches are exactly the ones
		// named OVERSIZE — the validator's cuts and the process-result builder's alike — so a probe that carries a cut
		// cannot hide among the probes an oversize change is said not to reach, nor an OVERSIZE probe carry none.
		const moved = FINGERPRINT_PROBES.map((p) => p.id).filter((id) => fp.probePrompts.get(id) !== BASE.probePrompts.get(id));
		expect(moved).toEqual(FINGERPRINT_PROBES.map((p) => p.id).filter((id) => id.includes('OVERSIZE')));
	});

	it('⭐ a BUDGET CONSTANT — hashed as itself, so CONTENT_MAX moves the fingerprint though no probe can reach it', async () => {
		const fp = await reviewerFingerprint(CASES, {
			...PRODUCT_SEAMS,
			budget: { ...REASONING_REVIEW_BUDGET, CONTENT_MAX: REASONING_REVIEW_BUDGET.CONTENT_MAX + 1 }
		});
		onlyMoved(fp, ['budget']);
	});

	it('⭐ a CRITERION FIELD — every field of a seed criterion, whole, the ones no prompt or score reads included', async () => {
		const target = 4;
		for (const field of Object.keys(SEEDED_REASONING_REVIEW_CRITERIA[target]!)) {
			const criteria = SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => {
				if (i !== target) return c;
				const v = (c as unknown as Record<string, unknown>)[field];
				const altered =
					typeof v === 'boolean' ? !v : Array.isArray(v) ? [...v, 'EV-ALTERED'] : `${String(v)}-ALTERED`;
				return { ...c, [field]: altered };
			});
			const fp = await reviewerFingerprint(CASES, { ...PRODUCT_SEAMS, criteria });
			expect(fp.reviewer, `${field}: the reviewer fingerprint moves`).not.toBe(BASE.reviewer);
			expect(fp.components.criteria, `${field}: the criteria component moves`).not.toBe(BASE.components.criteria);
		}
	});

	it('⭐ a SCORING RULE — a fault now scored PARTIALLY_MET: the scoring digest moves, no prompt does — of v1, nor of the current set (PQ-2)', async () => {
		const seams: FingerprintSeams = {
			...PRODUCT_SEAMS,
			evaluate: async (a) => {
				const e = await evaluateCase(a);
				return {
					...e,
					scored: {
						...e.scored,
						criteria: e.scored.criteria.map(([k, o]) => [k, o === 'NOT_MET' ? 'PARTIALLY_MET' : o] as const)
					}
				};
			}
		};
		const fp = await reviewerFingerprint(CASES, seams);
		onlyMoved(fp, ['scoring']);
		expect(fp.casePrompts).toEqual(BASE.casePrompts);
		// ⚠ BY CONSTRUCTION, NOT MEASURED (`JAN-PRQUAL` `PQ-2`, design D4): this row changes the `evaluate` seam alone, and
		// no seam it changes reaches `casePromptsOf`, which builds each case prompt through the `validator`, `criteria` and
		// `processResult` seams and never `evaluate` (`fingerprint.ts`) — so this half, as the v1 half above it, holds
		// whatever a case holds and could not fail. It is kept, and it is no measured claim about the current set.
		expect(await movedNow(seams), 'nor any case prompt of the current set').toEqual([]);
	}, 60_000);

	it('⭐ the REPAIR PROMPT — the instruction a failed first parse draws: the scoring digest moves', async () => {
		const fp = await reviewerFingerprint(CASES, {
			...PRODUCT_SEAMS,
			evaluate: (a) =>
				evaluateCase({
					...a,
					call: (p) => a.call(p.replace(REPAIR_INSTRUCTION, `${REPAIR_INSTRUCTION} Nothing else.`))
				})
		});
		onlyMoved(fp, ['scoring']);
	});

	it('⭐ an INDEPENDENCE RULE — the plan’s DIFFERENT_MODEL read as DIFFERENT_PROVIDER (the review’s E4): the scoring digest moves', async () => {
		// The rule lives in the package the runner scores through (`floor.ts` `deMinimisFloorPlan`), not behind a seam:
		// so the package itself is replaced for a FRESH load of the fingerprint, and the fresh load is first shown to
		// measure exactly what the tree measures — the CONTROL — so the move is the rule's and not the reload's.
		const fresh = async (cases: readonly QualificationCase[] = CASES) => {
			vi.resetModules();
			return (await import('../scripts/reviewer-qual/fingerprint.js')).reviewerFingerprint(cases);
		};
		try {
			expect((await fresh()).reviewer, 'CONTROL: a fresh load measures the tree').toBe(BASE.reviewer);
			vi.doMock('@janumipwb/rph-assurance', async (importOriginal) => {
				const real = await importOriginal<typeof import('@janumipwb/rph-assurance')>();
				return {
					...real,
					deMinimisFloorPlan: (subject: Parameters<typeof real.deMinimisFloorPlan>[0]) =>
						real
							.deMinimisFloorPlan(subject)
							.map((p) => (p.independence === 'DIFFERENT_MODEL' ? { ...p, independence: 'DIFFERENT_PROVIDER' as const } : p))
				};
			});
			const fp = await fresh();
			onlyMoved(fp, ['scoring']);
			expect(fp.casePrompts, 'independence reaches no prompt').toEqual(BASE.casePrompts);
			// ⭐ `PQ-2` (design D4) — nor any prompt of the current set's cases. ⚠ BY CONSTRUCTION, NOT MEASURED: the rule
			// replaced is the plan's (`deMinimisFloorPlan`), which the runner's scoring reads and no case-prompt path does —
			// `casePromptsOf` builds each case prompt through the `validator`, `criteria` and `processResult` seams, none of
			// which reads the plan — so this half, as the v1 half above it, holds whatever a case holds and could not fail.
			// It is kept, and it is no measured claim about the current set.
			expect(movedCasePrompts(await fresh(CURRENT_CASES), BASE_NOW), 'nor any case prompt of the current set').toEqual([]);
		} finally {
			vi.doUnmock('@janumipwb/rph-assurance');
			vi.resetModules();
		}
	}, 120_000);

	it('⭐ the SEEDED POLICY’S INDEPENDENCE — what the recording gate reads (the review’s E14): the criteria component moves', async () => {
		const fp = await reviewerFingerprint(CASES, { ...PRODUCT_SEAMS, independence: 'DIFFERENT_PROVIDER' });
		onlyMoved(fp, ['criteria']);
		expect(PRODUCT_SEAMS.independence, 'the product’s own is the seeded Reasoning Review policy’s').toBe('DIFFERENT_MODEL');
	});

	it('⭐ a MALFORMATION RULE — a class the harness no longer detects (the review’s E6): the scoring digest moves, and no case prompt of v1 or of the current set (PQ-2)', async () => {
		const seams: FingerprintSeams = {
			...PRODUCT_SEAMS,
			evaluate: async (a) => {
				const e = await evaluateCase(a);
				return { ...e, calls: e.calls.map((c) => ({ ...c, malformations: c.malformations.filter((k) => k !== 'DUPLICATE_KEY') })) };
			}
		};
		const fp = await reviewerFingerprint(CASES, seams);
		onlyMoved(fp, ['scoring']);
		expect(fp.casePrompts).toEqual(BASE.casePrompts);
		// ⚠ BY CONSTRUCTION, NOT MEASURED (`JAN-PRQUAL` `PQ-2`, design D4): this row changes the `evaluate` seam alone, and
		// no seam it changes reaches `casePromptsOf`, which builds each case prompt through the `validator`, `criteria` and
		// `processResult` seams and never `evaluate` (`fingerprint.ts`) — so this half, as the v1 half above it, holds
		// whatever a case holds and could not fail. It is kept, and it is no measured claim about the current set.
		expect(await movedNow(seams), 'nor any case prompt of the current set').toEqual([]);
	}, 60_000);
});

describe('JAN-CRITREAD J2-3 — the reviewer fingerprint does NOT move on what decides no verdict', () => {
	const dirs: string[] = [];
	afterAll(() => {
		for (const d of dirs) rmSync(d, { recursive: true, force: true });
	});

	it('⭐ it is a function of the tree: computed twice, identical in every part — over v1, and over the current set (PQ-2)', async () => {
		const again = await reviewerFingerprint(CASES);
		expect(again).toEqual(BASE);
		expect(BASE.reviewer).toMatch(/^[0-9a-f]{64}$/);
		expect(BASE.casePrompts.size, 'one entry per case').toBe(CASES.length);
		// ⭐ `PQ-2` (design D4) — and over case set v4, its process results' run literals rendered at materialize time.
		expect(await reviewerFingerprint(CURRENT_CASES), 'the current set, computed again').toEqual(BASE_NOW);
		expect(BASE_NOW.casePrompts.size, 'one entry per case of the current set').toBe(CURRENT_CASES.length);
	}, 60_000);

	/** A disposable copy of what the fingerprint loads, with the packages reached through real re-export directories. */
	function disposableTree(): string {
		const root = mkdtempSync(join(tmpdir(), 'jpwb-fpcopy-')).replace(/\\/g, '/');
		dirs.push(root);
		cpSync(`${REPO}/scripts/reviewer-qual`, `${root}/scripts/reviewer-qual`, { recursive: true });
		// ⭐ `PQ-1` (`REG-F-481`) — and the skeleton's digest, which the fingerprint hashes beside the probes.
		cpSync(`${REPO}/scripts/fence-skeleton`, `${root}/scripts/fence-skeleton`, { recursive: true });
		cpSync(`${REPO}/apps/rph-demo/src/lib/server`, `${root}/apps/rph-demo/src/lib/server`, { recursive: true });
		// The case set the copied `fingerprint.ts` reads when run as a program — the CURRENT one (`cases.ts`, J2-5).
		mkdirSync(dirname(`${root}/${CURRENT_CASE_SET_FILE}`), { recursive: true });
		copyFileSync(`${REPO}/${CURRENT_CASE_SET_FILE}`, `${root}/${CURRENT_CASE_SET_FILE}`);
		writeFileSync(`${root}/package.json`, JSON.stringify({ name: 'jpwb-fingerprint-copy', type: 'module' }));
		for (const pkg of readdirSync(`${REPO}/packages`)) {
			const manifest = `${REPO}/packages/${pkg}/package.json`;
			if (!existsSync(manifest)) continue;
			const { name, exports } = JSON.parse(readFileSync(manifest, 'utf8')) as {
				name?: string;
				exports?: Record<string, { source?: string }>;
			};
			if (!name?.startsWith('@janumipwb/') || !exports) continue;
			const dir = `${root}/node_modules/${name}`;
			mkdirSync(dir, { recursive: true });
			const shim: Record<string, string> = {};
			for (const [sub, target] of Object.entries(exports)) {
				if (!target.source) continue;
				const file = sub === '.' ? 'index.ts' : `${sub.slice(2)}.ts`;
				const real = pathToFileURL(`${REPO}/packages/${pkg}/${target.source.slice(2)}`).href;
				writeFileSync(`${dir}/${file}`, `export * from ${JSON.stringify(real)};\n`);
				shim[sub] = `./${file}`;
			}
			writeFileSync(`${dir}/package.json`, JSON.stringify({ name, type: 'module', exports: shim }));
		}
		return root;
	}
	const fingerprintIn = (root: string): { reviewer: string; components: Record<string, string> } => {
		const r = spawnSync(BUN, ['--conditions=source', `${root}/scripts/reviewer-qual/fingerprint.ts`], {
			cwd: root,
			encoding: 'utf8',
			env: hermeticEnv(),
			windowsHide: true
		});
		expect(r.status, `${root}: ${r.stderr}`).toBe(0);
		return JSON.parse(r.stdout) as { reviewer: string; components: Record<string, string> };
	};
	const VALIDATOR = 'apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts';

	it('⛔ a COMMENT-ONLY edit moves nothing — on a disposable copy, with a behaviour edit to the same copy as its control', () => {
		const here = fingerprintIn(REPO);
		expect(here.reviewer, 'the CLI computes what the function computes').toBe(BASE.reviewer);
		const copy = disposableTree();
		expect(fingerprintIn(copy), 'the copy, unedited, measures what the tree measures').toEqual(here);

		const file = `${copy}/${VALIDATOR}`;
		const original = readFileSync(file, 'utf8');
		const commented = original
			.replace('export const REASONING_REVIEW_BUDGET', '// A comment that decides no verdict.\nexport const REASONING_REVIEW_BUDGET')
			.replace('function judgePrompt(', '/** Nor does this one. */\nfunction judgePrompt(');
		expect(commented.split('\n').length, 'the arrangement added both comments').toBe(original.split('\n').length + 2);
		writeFileSync(file, commented);
		expect(fingerprintIn(copy), 'a comment-only edit').toEqual(here);

		// ⭐ THE CONTROL: the same copy, one budget constant changed — so the copy is what was measured.
		const changed = commented.replace('\tRUBRIC_MAX: 6_000,\n', '\tRUBRIC_MAX: 5_999,\n');
		expect(changed, 'the control edited the copy').not.toBe(commented);
		writeFileSync(file, changed);
		const behaviour = fingerprintIn(copy);
		expect(behaviour.reviewer, 'a behaviour edit moves it').not.toBe(here.reviewer);
		expect(behaviour.components.budget, 'through the budget component').not.toBe(here.components.budget);
	}, 120_000);

	it('⭐ the review’s attacks move it, on a copy — E5, the model’s own `stipulated` honoured; E6, a duplicate key no longer detected', () => {
		const copy = disposableTree();
		/** One edit to one copied file, measured, then undone — each a single literal replacement, shown to apply. */
		const attacked = (rel: string, find: string, replace: string) => {
			const file = `${copy}/${rel}`;
			const original = readFileSync(file, 'utf8');
			expect(original.split(find).length - 1, `${rel}: the attack anchors once`).toBe(1);
			writeFileSync(file, original.replace(find, () => replace));
			try {
				return fingerprintIn(copy);
			} finally {
				writeFileSync(file, original);
			}
		};
		const e5 = attacked(
			VALIDATOR,
			'\t\t\t\t\tfailed: Boolean(f.failed),\n',
			'\t\t\t\t\tfailed: Boolean(f.failed),\n\t\t\t\t\t...(f.stipulated === true ? { stipulated: true as const } : {}),\n'
		);
		const e6 = attacked('scripts/reviewer-qual/malformations.ts', 'if (keys.has(key)) duplicate = true;', 'if (keys.has(key)) duplicate = false;');
		for (const [label, fp] of [
			['E5', e5],
			['E6', e6]
		] as const) {
			expect(fp.components.scoring, `${label}: the scoring digest moves`).not.toBe(BASE.components.scoring);
			// THE CONTROL: the copy measured the tree in everything else, so the move is the attack's.
			for (const k of ['probes', 'budget', 'criteria'] as const) expect(fp.components[k], `${label}: ${k}`).toBe(BASE.components[k]);
		}
	}, 120_000);

	it('⭐ SR-2 (D6) — why the reported-model check is GATED: set in the runner’s validator, on a copy, it moves the scoring digest', () => {
		// ⛔ The scoring corpus holds replies that report OTHER models (`scoring-corpus.ts`), and their outcomes are hashed.
		// A check the fingerprint's validators made would refuse those replies, so an UNGATED check would move the
		// fingerprint of a reviewer whose prompt and scoring did not change. Only the product's devin branch sets it.
		const copy = disposableTree();
		const file = `${copy}/scripts/reviewer-qual/runner.ts`;
		const original = readFileSync(file, 'utf8');
		const find = '\t\tclock: EXCHANGE_CLOCK,\n';
		expect(original.split(find).length - 1, 'the edit anchors once').toBe(1);
		writeFileSync(file, original.replace(find, () => `${find}\t\trequireReportedModel: true,\n`));
		const gated = fingerprintIn(copy);
		expect(gated.components.scoring, 'the scoring digest moves').not.toBe(BASE.components.scoring);
		for (const k of ['probes', 'budget', 'criteria'] as const) expect(gated.components[k], k).toBe(BASE.components[k]);
	}, 120_000);
});

describe('JAN-CRITREAD J2-3 — the probe set reaches every branch of prompt assembly', () => {
	const prompt = (id: string): string => {
		const p = BASE.probePrompts.get(id);
		expect(p, `probe ${id} was materialized`).toBeDefined();
		return p!;
	};
	const any = (needle: string) => FINGERPRINT_PROBES.some((p) => prompt(p.id).includes(needle));

	it('⭐ every framing, every observation kind and its absent report, the rationale both ways, narration, prior gaps, the subject hash', () => {
		expect(BASE.probePrompts.size).toBe(FINGERPRINT_PROBES.length);
		for (const needle of [
			'a canonical graph export',
			'The WORK PRODUCT to review',
			'The COMMAND RESULT to review',
			// ~~'The host reported nothing about tool calls'~~, ~~'… OBSERVE tool calls: '~~, ~~'… OBSERVE tool calls.'~~ —
			// `PQ-1` (`REG-F-484`): every arm now speaks of the calls of THAT turn, the last one, which is all the host knows.
			'The host reported nothing about the tool calls of that turn',
			'The host was NOT IN A POSITION TO OBSERVE the tool calls of that turn: ',
			'The host was NOT IN A POSITION TO OBSERVE the tool calls of that turn.',
			'The host WATCHED and observed NO tool calls',
			'The host OBSERVED these tool calls',
			OBSERVATION_HEADING,
			'[NOT MINTED BY THE HOST]',
			'(a tool this host did not mint)',
			'calls were observed; only the first',
			'(NOT DECLARED',
			'(none declared)',
			'(none recorded)',
			'A PREVIOUS review flagged',
			// ~~'candidateSubjectHash'~~ — `PQ-1` (`REG-F-481`): the host-computed hash is no longer merged into the fenced
			// graph JSON; it stands on a host line of its own.
			"The candidate's subject hash (host-computed): ",
			'"criterionId":"CRITERION-ID"',
			// ⭐ `PQ-1` (design D3) — and every branch of the process-result renderer, as its REVIEW view renders it.
			'the command line, as a JSON array of its arguments:',
			'exit null (terminated by a signal) in ',
			' TIMED OUT in ',
			'[OUTPUT INCOMPLETE: ',
			'[STDOUT TRUNCATED: ',
			'[STDERR TRUNCATED: ',
			`${CUT_DECLARED}stdout — `,
			`${CUT_DECLARED}the command line — `,
			// ⭐ …and where its branches MEET (`P-OVERSIZE-STREAMS`): this host's own timeout, a review cut of stderr, and the
			// capture's declaration of a cut stream, under its heading, in both of its forms.
			'exit null (terminated by a signal) TIMED OUT in ',
			`${CUT_DECLARED}stderr — `,
			'[CUT BY THE CAPTURE: stdout — ',
			'[CUT BY THE CAPTURE: stderr — ',
			'so the TAIL below is the end of what was CAPTURED, not the end of the output.]',
			'so the end shown below is the end of what was CAPTURED, not the end of the output.]'
		])
			expect(any(needle), needle).toBe(true);
		expect(prompt('G-DECLARED').includes('(NOT DECLARED'), 'a declared account renders as itself').toBe(false);
	});

	// ~~`contentBudget` — how much of the content the prompt carries, measured up to ` …(truncated)`~~ — `PQ-1`: a cut is
	// declared BEFORE its bytes, and the declaration counts inside the slice's limit. So the limit a cut obeyed is read
	// back from the declaration itself: the bytes, plus the reserve `excerptHead` made for a declaration at its widest.
	/**
	 * ⭐ A HEAD-ONLY CUT, READ FROM A PROMPT, ITS DECLARATION CHECKED AGAINST ITS BYTES. `[CUT FOR THIS REVIEW: <slice> — the
	 * first K of its T code points are shown; the last R are removed.]` stands directly before the bytes: between fence
	 * lines, or — the rubric, host-authored and never fenced — bare, up to `until`. K + R = T, and the bytes hold K code
	 * points. ⚠ The limit is exact for these probes' slices, which hold no astral character (a pair given back at the cut
	 * would shorten the bytes by one unit).
	 */
	const headCut = (p: string, slice: string, until?: string) => {
		const at = p.indexOf(`${CUT_DECLARED}${slice} — the first `);
		expect(at, `${slice}: a cut is declared`).toBeGreaterThanOrEqual(0);
		expect(p.indexOf(`${CUT_DECLARED}${slice} — `, at + 1), `${slice}: declared once`).toBe(-1);
		const lineEnd = p.indexOf('\n', at);
		const declaration = p.slice(at, lineEnd);
		const m = /^\[CUT FOR THIS REVIEW: .+ — the first (\d+) of its (\d+) code points are shown; the last (\d+) are removed\.\]$/.exec(
			declaration
		);
		expect(m, `${slice}: the declaration's form`).not.toBeNull();
		const [kept, total, removed] = [Number(m![1]), Number(m![2]), Number(m![3])];
		const next = p.slice(lineEnd + 1, p.indexOf('\n', lineEnd + 1));
		let bytes: string;
		if (/^<<<UNTRUSTED-\d\d>>>$/.test(next)) {
			const from = lineEnd + 1 + next.length + 1;
			bytes = p.slice(from, p.indexOf(`\n${next}`, from));
		} else {
			expect(until, `${slice}: a bare slice names where it ends`).toBeDefined();
			const end = p.indexOf(until!, lineEnd + 1);
			expect(end, `${slice}: ended by ${JSON.stringify(until)}`).toBeGreaterThan(lineEnd);
			bytes = p.slice(lineEnd + 1, end);
		}
		expect([codePoints(bytes), kept + removed], `${slice}: the declaration is true of the bytes`).toEqual([kept, total]);
		return { declaration, bytes, limit: bytes.length + headCutDeclaration(slice, total, total, total).length + 1 };
	};
	/** Which slices a prompt declares cut, in the order it declares them. */
	const cutSlices = (p: string): string[] => [...p.matchAll(/\[CUT FOR THIS REVIEW: (.+?) — /g)].map((m) => m[1]!);

	it('⭐ each framing has an OVERSIZE-TOGETHER probe that cuts every slice at once, reaching the content caps a probe can reach', () => {
		const B = REASONING_REVIEW_BUDGET;
		// ~~`count(…, TRUNCATED)` 6, 5, 6, and 1 for each content-only probe~~ — `PQ-1`: the same counts, and now WHICH slice
		// each declaration names, in prompt order. The process result's content is cut by its BUILDER (stdout, HEAD and
		// TAIL), never by the validator (design D2).
		// ⭐ `PQ-1` (`REG-F-481`): the account is fenced field by field, so its cut names the FIELD it cut — the rationale.
		expect(cutSlices(prompt('G-OVERSIZE-ALL')), 'graph: intent, rubric, prior, rationale, narration, content').toEqual([
			'the intent',
			'the artifact',
			"the account's rationale",
			'the narration',
			'the prior findings',
			'the rubric'
		]);
		expect(cutSlices(prompt('W-OVERSIZE-ALL')), 'work product: instruction, rubric, prior, rationale, content').toEqual([
			'the instruction',
			'the work product',
			"the account's rationale",
			'the prior findings',
			'the rubric'
		]);
		expect(cutSlices(prompt('P-OVERSIZE-ALL')), 'process result: all six').toEqual([
			'the instruction',
			'stdout',
			"the account's rationale",
			'the narration',
			'the prior findings',
			'the rubric'
		]);
		for (const [id, slice] of [
			['G-OVERSIZE-CONTENT', 'the artifact'],
			['W-OVERSIZE-CONTENT', 'the work product'],
			['P-OVERSIZE-CONTENT', 'stdout'],
			['P-OVERSIZE-COMMAND', 'the command line'],
			['P-OVERSIZE-SURROGATE', 'stdout']
		] as const)
			expect(cutSlices(prompt(id)), `${id}: the content alone is cut`).toEqual([slice]);
		// ⭐ `PQ-1` — and the two probes whose content is two cut streams: both are declared, stdout first.
		for (const id of ['P-OVERSIZE-ROOM-EDGES', 'P-OVERSIZE-STREAMS'])
			expect(cutSlices(prompt(id)), `${id}: both streams are cut, and nothing else`).toEqual(['stdout', 'stderr']);
		// The budget left after the scaffolding binds for the graph and work product; the call list pushes the
		// process result below it, to CONTENT_MIN. No probe reaches CONTENT_MAX — which is why it is hashed as a constant.
		for (const [id, slice] of [
			['G-OVERSIZE-ALL', 'the artifact'],
			['W-OVERSIZE-ALL', 'the work product'],
			['G-OVERSIZE-CONTENT', 'the artifact'],
			['W-OVERSIZE-CONTENT', 'the work product']
		] as const) {
			const b = headCut(prompt(id), slice).limit;
			expect(b, `${id}: above CONTENT_MIN`).toBeGreaterThan(B.CONTENT_MIN);
			expect(b, `${id}: below CONTENT_MAX`).toBeLessThan(B.CONTENT_MAX);
		}
		// ⭐ A PROCESS RESULT'S CONTENT IS ITS BUILDER'S VIEW, FITTED TO THE BUDGET THE VALIDATOR LEAVES IT — sent whole, and
		// FILLING that budget but for the digits its stdout declaration did not need (the builder reserved the widest).
		for (const [id, min] of [
			['P-OVERSIZE-CONTENT', false],
			['P-OVERSIZE-ALL', true]
		] as const) {
			const input = inputOf(id);
			const b = viewBudget(input);
			if (min) expect(b, `${id}: CONTENT_MIN`).toBe(B.CONTENT_MIN);
			else {
				expect(b, `${id}: above CONTENT_MIN`).toBeGreaterThan(B.CONTENT_MIN);
				expect(b, `${id}: below CONTENT_MAX`).toBeLessThan(B.CONTENT_MAX);
			}
			const c = headAndTailCut(input.content, 'stdout')!;
			const [, , total] = c.numbers;
			const widest = headAndTailCutDeclaration('stdout', total!, total!, total!, total!);
			expect(input.content.length + widest.length - c.declaration.length, `${id}: the view fills its budget`).toBe(b);
			expect(prompt(id).includes(`\n${input.content}\n`), `${id}: the prompt carries the view whole`).toBe(true);
		}
		// ~~`/from this intent:\n"""([\s\S]*?)"""/` at USER_INTENT_MAX + TRUNCATED.length~~ — `PQ-1`: read off its declaration.
		expect(headCut(prompt('G-OVERSIZE-ALL'), 'the intent').limit, 'the instruction is cut at USER_INTENT_MAX').toBe(
			B.USER_INTENT_MAX
		);
	});

	it('⭐ the probes held at CONTENT_MIN are IMPOSSIBLE INPUTS, ON PURPOSE — more calls than production records, a prompt over PROMPT_BUDGET — and no input in production’s shape reaches CONTENT_MIN', () => {
		// ⛔ WHAT THESE PROBES ARE (`PQ-1`; `REG-F-476`): `CONTENT_MIN` binds only when the scaffolding alone passes
		// `PROMPT_BUDGET`, and production's scaffolding never does — so the branch, and the cuts it fixes, are hashed through a
		// call list production cannot record. That is chosen, not overlooked (there the room is a constant of the budget
		// object, never moved by the scaffolding), and it is held here so that no comment or `covers` text can drift from it.
		const B = REASONING_REVIEW_BUDGET;
		const callsOf = (input: ReasoningReviewInput): number => input.observedToolCalls?.calls?.length ?? 0;
		const atMin = P_PROBES().filter((id) => viewBudget(inputOf(id)) === B.CONTENT_MIN);
		expect(atMin, 'the three probes held at CONTENT_MIN').toEqual(['P-OVERSIZE-SURROGATE', 'P-OVERSIZE-ROOM-EDGES', 'P-OVERSIZE-ALL']);
		for (const id of atMin) {
			expect(callsOf(inputOf(id)), `${id}: more calls than production records`).toBeGreaterThan(OBSERVED_TOOL_CALL_LIMIT);
			expect(prompt(id).length, `${id}: a prompt over PROMPT_BUDGET`).toBeGreaterThan(B.PROMPT_BUDGET);
			expect(FINGERPRINT_PROBES.find((p) => p.id === id)!.covers, `${id}: its covers text says so`).toContain(
				'an impossible input'
			);
		}
		for (const id of P_PROBES().filter((x) => !atMin.includes(x)))
			expect(callsOf(inputOf(id)), `${id}: within production's bound`).toBeLessThanOrEqual(OBSERVED_TOOL_CALL_LIMIT);
		// ⭐ THE WORST INPUT IN PRODUCTION'S SHAPE still leaves the content more than CONTENT_MIN: 32 calls, each a name at the
		// record plane's bound and NOT minted by the host (the longest line a call can render), the instruction, the account
		// and the rubric past their limits — and no narration and no prior, which production never sends.
		const name = 'n'.repeat(64);
		expect(
			[RecordPlaneNameSchema.safeParse(name).success, RecordPlaneNameSchema.safeParse(`${name}n`).success],
			'the arrangement: a name at the record plane’s bound'
		).toEqual([true, false]);
		const calls: ObservedToolCallReport = {
			observation: 'OBSERVED',
			calls: Array.from({ length: OBSERVED_TOOL_CALL_LIMIT }, (_, i) => ({
				ordinal: i + 1,
				nameProvenance: 'NOT_MINTED' as const,
				toolName: name,
				outcome: 'COMPLETED' as const
			})),
			observedCount: 10 * OBSERVED_TOOL_CALL_LIMIT,
			recordedLimit: OBSERVED_TOOL_CALL_LIMIT
		};
		const long = (limit: number, word: string): string => word.repeat(Math.ceil((limit + 500) / word.length));
		const criteria: AssessmentCriterion[] = PRODUCT_SEAMS.criteria.map((c) => ({
			...c,
			description: `${c.description} ${long(B.RUBRIC_MAX, 'In full. ')}`
		}));
		const worst = processResultContentBudget({
			criteria,
			framing: 'PROCESS_RESULT',
			prompt: long(B.USER_INTENT_MAX, 'Run the checks. '),
			rationale: {
				rationale: long(B.RATIONALE_MAX, 'The checks were run. '),
				assumptions: [long(500, 'a ')],
				limitations: [long(500, 'l ')],
				residualUncertainty: [long(500, 'u ')]
			},
			observedToolCalls: calls,
			narration: undefined
		});
		expect(worst, 'the worst production-shaped process result leaves the content above CONTENT_MIN').toBeGreaterThan(B.CONTENT_MIN);
	});

	it('⭐ the budget object is frozen, and it is the one the fingerprint hashes by default', () => {
		expect(Object.isFrozen(REASONING_REVIEW_BUDGET)).toBe(true);
		expect(PRODUCT_SEAMS.budget).toBe(REASONING_REVIEW_BUDGET);
		expect(Object.keys(REASONING_REVIEW_BUDGET).sort()).toEqual(
			[
				'PROMPT_BUDGET',
				'USER_INTENT_MAX',
				'RUBRIC_MAX',
				'PRIOR_MAX',
				'RATIONALE_MAX',
				'NARRATION_MAX',
				'CONTENT_MAX',
				'CONTENT_MIN'
			].sort()
		);
	});

	it('⛔ the budget object is the ONLY place a limit is written — the validator binds each once, by destructuring the object, and reads every one', () => {
		// Over the syntax tree, so a comment moves nothing and a restatement cannot hide in one. A second binding of a
		// limit — `const CONTENT_MAX = 24_000`, or a renamed or defaulted destructuring — is a limit the prompt could obey
		// while the object the fingerprint hashes says another; and `CONTENT_MAX` is the one no probe can reach.
		const source = readFileSync(`${REPO}/apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts`, 'utf8');
		const tree = ts.createSourceFile('reasoning-review-validator.ts', source, ts.ScriptTarget.Latest, true);
		const members = new Set(Object.keys(REASONING_REVIEW_BUDGET));
		const bindings = new Map<string, string[]>();
		const reads = new Map<string, number>();
		const bind = (name: string, how: string) => bindings.set(name, [...(bindings.get(name) ?? []), how]);
		let written: string[] = [];
		const visit = (n: ts.Node): void => {
			if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
				if (members.has(n.name.text)) bind(n.name.text, 'a const of its own');
				const init = n.initializer;
				if (n.name.text === 'REASONING_REVIEW_BUDGET' && init && ts.isCallExpression(init) && ts.isObjectLiteralExpression(init.arguments[0]!))
					written = init.arguments[0].properties.map((p) =>
						ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) ? p.name.text : `NOT WRITTEN THERE: ${p.getText()}`
					);
			}
			if (ts.isBindingElement(n) && ts.isIdentifier(n.name) && members.has(n.name.text)) {
				const declaration = n.parent.parent;
				const fromTheObject =
					ts.isVariableDeclaration(declaration) &&
					declaration.initializer !== undefined &&
					ts.isIdentifier(declaration.initializer) &&
					declaration.initializer.text === 'REASONING_REVIEW_BUDGET' &&
					n.propertyName === undefined &&
					n.initializer === undefined &&
					n.dotDotDotToken === undefined;
				bind(n.name.text, fromTheObject ? 'destructured from REASONING_REVIEW_BUDGET' : 'bound some other way');
			}
			if (ts.isParameter(n) && ts.isIdentifier(n.name) && members.has(n.name.text)) bind(n.name.text, 'a parameter');
			if (ts.isIdentifier(n) && members.has(n.text)) {
				const p = n.parent;
				const declares = (ts.isVariableDeclaration(p) || ts.isBindingElement(p) || ts.isParameter(p)) && p.name === n;
				const names =
					((ts.isPropertyAssignment(p) || ts.isPropertyAccessExpression(p)) && p.name === n) ||
					(ts.isBindingElement(p) && p.propertyName === n);
				if (!declares && !names) reads.set(n.text, (reads.get(n.text) ?? 0) + 1);
			}
			ts.forEachChild(n, visit);
		};
		visit(tree);
		expect(written.sort(), 'every limit is WRITTEN in the frozen object, as a value').toEqual([...members].sort());
		for (const m of members) {
			expect(bindings.get(m), `${m}: bound exactly once, from the object`).toEqual(['destructured from REASONING_REVIEW_BUDGET']);
			expect(reads.get(m) ?? 0, `${m}: read by the prompt`).toBeGreaterThan(0);
		}
	});

	it('⭐ every limit a probe can reach cuts exactly where the budget object says — intent, rubric, prior gaps, rationale, narration, the whole prompt', () => {
		const B = REASONING_REVIEW_BUDGET;
		// ~~`cut(limit) = limit + TRUNCATED.length`, the intent `between(p, '"""', '"""')`, the prior `between(p, 'A PREVIOUS
		// review flagged: ', '. Judge whether')`, the rationale `between(p, 'is itself a finding:\n"""', '"""')`~~ — `PQ-1`:
		// the 13-character marker is gone, the declaration counts INSIDE the limit, and the bytes stand between the fence
		// lines the declaration precedes. So each limit is read off its declaration, checked against its bytes (`headCut`):
		// as strong as before at every slice, and the narration is now held in the process-result framing too.
		const intentOf: Readonly<Record<string, string>> = {
			'G-OVERSIZE-ALL': 'the intent',
			'W-OVERSIZE-ALL': 'the instruction',
			'P-OVERSIZE-ALL': 'the instruction'
		};
		for (const id of ['G-OVERSIZE-ALL', 'W-OVERSIZE-ALL', 'P-OVERSIZE-ALL']) {
			const p = prompt(id);
			expect(headCut(p, intentOf[id]!).limit, `${id}: the intent, at USER_INTENT_MAX`).toBe(B.USER_INTENT_MAX);
			// ⭐ Design §9.3 D8: an empty line stands between the rubric and the recommendation sentence, no byte of the rubric.
			expect(headCut(p, 'the rubric', '\n\nThen give an overall').limit, `${id}: the rubric, at RUBRIC_MAX`).toBe(B.RUBRIC_MAX);
			expect(headCut(p, 'the prior findings').limit, `${id}: the prior gaps, at PRIOR_MAX`).toBe(B.PRIOR_MAX);
			// ~~`headCut(p, 'the rationale summary').limit` at RATIONALE_MAX~~ — `PQ-1` (`REG-F-481`): the account is fenced
			// field by field under the host's labels, and RATIONALE_MAX bounds the account's every line: its lines, from the
			// section heading to the narration's, are RATIONALE_MAX but for the digits its rationale's declaration did not need.
			const r = headCut(p, "the account's rationale");
			const lines = p.split('\n');
			const heading = lines.findIndex((l) => l.startsWith("The producing agent's PROFESSIONAL RATIONALE SUMMARY"));
			const narration = lines.findIndex((l) => l.startsWith("The producing agent's observable narration"));
			const account = lines.slice(heading + 1, narration - 1).join('\n');
			expect(
				account.length - r.declaration.length - 1 - r.bytes.length + r.limit,
				`${id}: the account, at RATIONALE_MAX`
			).toBe(B.RATIONALE_MAX);
		}
		for (const id of ['G-OVERSIZE-ALL', 'P-OVERSIZE-ALL'])
			expect(headCut(prompt(id), 'the narration').limit, `${id}: the narration, at NARRATION_MAX`).toBe(B.NARRATION_MAX);
		// The content takes what the scaffolding leaves of PROMPT_BUDGET, ~~so the whole prompt is the budget and its cut~~ so
		// the scaffolding and the content's limit are PROMPT_BUDGET exactly, and the prompt is never longer: it is short of it
		// by the digits the content's declaration did not need (the reserve was made at the widest numbers).
		for (const [id, slice] of [
			['G-OVERSIZE-ALL', 'the artifact'],
			['W-OVERSIZE-ALL', 'the work product']
		] as const) {
			const p = prompt(id);
			const c = headCut(p, slice);
			expect(
				p.length - c.declaration.length - 1 - c.bytes.length + c.limit,
				`${id}: the scaffolding and the content’s limit, at PROMPT_BUDGET`
			).toBe(B.PROMPT_BUDGET);
			expect(p.length, `${id}: the whole prompt, within PROMPT_BUDGET`).toBeLessThanOrEqual(B.PROMPT_BUDGET);
		}
	});

	it('⭐ W-OVERSIZE-EDGES stands on a head-only cut’s two edges — an instruction EXACTLY at USER_INTENT_MAX, shown whole and undeclared; an astral answer, its kept HEAD declared in CODE POINTS', () => {
		// ⛔ WHY (`PQ-1`; `REG-F-480`, `REG-F-483`; `REG-F-476`): every other probe's slices are ASCII, and each is well under
		// its limit or well over it, so a cut that took a slice AT its limit, or counted UTF-16 units as code points, moved
		// no probe and reddened nothing here. This probe stands on both edges, and both are held.
		const B = REASONING_REVIEW_BUDGET;
		const input = FINGERPRINT_PROBES.find((x) => x.id === 'W-OVERSIZE-EDGES')!.input(
			PRODUCT_SEAMS.criteria,
			PRODUCT_SEAMS.processResult
		);
		const p = prompt('W-OVERSIZE-EDGES');
		expect(input.prompt.length, 'the arrangement: an instruction of EXACTLY USER_INTENT_MAX units').toBe(B.USER_INTENT_MAX);
		expect(cutSlices(p), 'the answer alone is cut').toEqual(['the work product']);
		const fence = p.split('\n').find((l) => FENCE_LINE.test(l))!;
		expect(
			p.includes(`\n${fence}\n${input.prompt}\n${fence}\n`),
			'the instruction, whole and undeclared, between its fence lines'
		).toBe(true);
		const c = headCut(p, 'the work product');
		const kept = Number(/ — the first (\d+) of its /.exec(c.declaration)![1]);
		expect([...c.bytes].length, 'its declared kept count is the code points it keeps').toBe(kept);
		expect(c.bytes.length, 'the arrangement: astral — two UTF-16 units to each code point kept').toBe(2 * kept);
	});
});

/** A process-result probe's input, built through the product's own builder. */
const inputOf = (id: string): ReasoningReviewInput =>
	FINGERPRINT_PROBES.find((p) => p.id === id)!.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult);
/** The content budget the validator's own assembler leaves a process result's view (`processResultContentBudget`). */
const viewBudget = (input: ReasoningReviewInput): number => {
	expect(input.framing).toBe('PROCESS_RESULT');
	const { content: _view, ...rest } = input;
	return processResultContentBudget({ ...rest, framing: 'PROCESS_RESULT' });
};
/**
 * ⭐ `PQ-1` — A HEAD-AND-TAIL CUT OF ONE SLICE OF A PROCESS RESULT'S REVIEW VIEW (`process-result-render.ts`): the
 * declaration, the `HEAD:` and `TAIL:` host labels, each part between two lines of the view's fence. Its numbers are
 * checked against the bytes. `undefined` when the slice is shown whole.
 */
function headAndTailCut(view: string, slice: string) {
	const at = view.indexOf(`${CUT_DECLARED}${slice} — the first `);
	if (at < 0) return undefined;
	const lineEnd = view.indexOf('\n', at);
	const declaration = view.slice(at, lineEnd);
	const m =
		/^\[CUT FOR THIS REVIEW: .+ — the first (\d+) \(HEAD\) and the last (\d+) \(TAIL\) of its (\d+) code points are shown, in that order; the (\d+) between them are removed\.\]$/.exec(
			declaration
		);
	expect(m, `${slice}: the declaration's form`).not.toBeNull();
	const numbers = m!.slice(1).map(Number);
	expect(view.slice(lineEnd + 1, lineEnd + 7), `${slice}: the HEAD label follows the declaration`).toBe('HEAD:\n');
	const fenceAt = lineEnd + 7;
	const fence = view.slice(fenceAt, view.indexOf('\n', fenceAt));
	expect(fence, `${slice}: a fence line`).toMatch(/^<<<UNTRUSTED-\d\d>>>$/);
	const between = `\n${fence}\nTAIL:\n${fence}\n`;
	const headFrom = fenceAt + fence.length + 1;
	const headTo = view.indexOf(between, headFrom);
	const head = view.slice(headFrom, headTo);
	const tailFrom = headTo + between.length;
	const tailTo = view.indexOf(`\n${fence}`, tailFrom);
	const tail = view.slice(tailFrom, tailTo);
	const [h, t, total, removed] = numbers;
	expect([codePoints(head), codePoints(tail), h! + t! + removed!], `${slice}: the declaration is true of the bytes`).toEqual([h, t, total]);
	return { at, end: tailTo + 1 + fence.length, declaration, fence, head, tail, numbers };
}

// ── ⭐⭐ `JAN-PRQUAL` `PQ-1` (design D3; `REG-F-476`, `REG-D-094`) — THE FINGERPRINT REACHES THE RENDERER ──────────────────
//
// Through the `processResult` seam, IN PROCESS. Hashed over one clean run, the renderer's other branches were unseen
// (design §2 G2): a change in the TIMED OUT branch alone, or in the declared-cut branch alone, moved nothing. Each row
// below swaps the seam for the product's builder CHANGED IN ONE BRANCH ALONE: the view it renders differs from the
// product's exactly for a run that takes that branch, and only in the bytes that branch writes. ⚠ Each change keeps the
// view within its budget: a view is fitted to its budget, and the validator refuses (never cuts) one that is not
// (design D2). Before `PQ-1`'s probes, REAL edits to each branch on a disposable copy of the tree moved no probe.
// ⭐ EACH ROW NAMES THE PROBES THAT TAKE ITS BRANCH, AND THOSE EXACTLY MOVE — save the two branches every view of a kind
// shares by design (the clean layout; a review cut's declaration form), where the named probe must be among them. An
// exact set is what makes a probe that drifts into a second branch, or out of its own, visible: a branch is then taken
// by more probes, or fewer, than the row names.
interface BranchChange {
	/** The probes that take the branch, in the probe set's order — `P-OVERSIZE-STREAMS` stands where several meet. */
	readonly moves: readonly string[];
	/** Shared by every view of a kind, by design: the row asks only that `moves` are among the probes that move. */
	readonly shared?: true;
	/** Whether the run takes the branch — read off the run, or, for a review-layer cut, off the view's own declaration. */
	readonly takes: (run: ObservedProcessRun, view: string) => boolean;
	/** The view as a renderer changed in that branch alone renders it. */
	readonly change: (source: ProcessResultReviewSource, view: string) => string;
}
/** A same-length change to the bytes a branch writes: `from` (which must be there) to `to`. */
const rewrite = (from: string, to: string) => (_source: ProcessResultReviewSource, view: string) => {
	expect(view, `the branch writes ${JSON.stringify(from)}`).toContain(from);
	expect(to.length).toBe(from.length);
	return view.replace(from, to);
};
/** `slice`'s cut in `view` re-rendered with `head` and `tail`, under a declaration recounted as the product counts. */
function recut(view: string, slice: string, text: string, head: string, tail: string): string {
	const c = headAndTailCut(view, slice)!;
	const total = codePoints(text);
	const declaration = headAndTailCutDeclaration(
		slice,
		codePoints(head),
		codePoints(tail),
		total,
		total - codePoints(head) - codePoints(tail)
	);
	return `${view.slice(0, c.at)}${[declaration, 'HEAD:', c.fence, head, c.fence, 'TAIL:', c.fence, tail, c.fence].join('\n')}${view.slice(c.end)}`;
}
/**
 * ⭐ THE ROOM THE RENDERER GAVE A CUT STREAM, read back from its view: the stream's block as rendered (its heading to its
 * TAIL's closing fence), plus the digits its declaration did not need — the layout reserves the WIDEST declaration the
 * cut could state (`cutOverhead`), and keeps what the room leaves after it. ⚠ For a stream whose kept bytes hold no
 * astral character, so nothing was given back at the HEAD or stepped past at the TAIL.
 */
function roomOf(view: string, stream: 'stdout' | 'stderr', text: string): { room: number; start: number; end: number } {
	const c = headAndTailCut(view, stream)!;
	expect([codePoints(c.head), codePoints(c.tail)], `${stream}: kept bytes with no astral character`).toEqual([
		c.head.length,
		c.tail.length
	]);
	const start = view.lastIndexOf(`\n${stream}:\n`, c.at) + 1;
	const total = codePoints(text);
	const widest = headAndTailCutDeclaration(stream, total, total, total, total);
	return { room: c.end - start + widest.length - c.declaration.length, start, end: c.end };
}
/**
 * A stream's block shown whole between two `fence` lines — and, with `''`, as a whole-fit test that forgot the fence
 * lines measures it. ⚠ For a stream the capture did not cut, whose block carries no capture declaration.
 */
const wholeBlock = (stream: string, text: string, fence: string): string => [`${stream}:`, fence, text, fence].join('\n');
const BRANCH_CHANGES: Readonly<Record<string, BranchChange>> = {
	clean: {
		moves: ['P-CLEAN'],
		shared: true,
		takes: (r, view) =>
			r.exitCode !== null && !r.timedOut && r.outputComplete && r.omittedRegions.length === 0 && !view.includes(CUT_DECLARED),
		change: rewrite('exit ', 'EXIT ')
	},
	signal: {
		moves: ['P-SIGNAL', 'P-OVERSIZE-STREAMS'],
		takes: (r) => r.exitCode === null,
		change: rewrite('(terminated by a signal)', '(TERMINATED BY A SIGNAL)')
	},
	'timed out': {
		moves: ['P-TIMED-OUT', 'P-OVERSIZE-STREAMS'],
		takes: (r) => r.timedOut,
		change: rewrite(' TIMED OUT in ', ' timed out in ')
	},
	// ⭐ THIS HOST'S OWN TIMEOUT SHAPE — exit null AND TIMED OUT: the runner's own SIGKILL reports exit null
	// (`child-process-runner.ts`), so production's timeout takes the signal and the timeout branches TOGETHER, and a
	// change confined to how the two read together (`P-TIMED-OUT` exits with a code) is seen by this probe alone.
	"this host's own timeout shape (exit null, TIMED OUT)": {
		moves: ['P-OVERSIZE-STREAMS'],
		takes: (r) => r.exitCode === null && r.timedOut,
		change: rewrite('(terminated by a signal) TIMED OUT in ', '(terminated by a signal) timed out in ')
	},
	'incomplete capture': {
		moves: ['P-INCOMPLETE-CAPTURE', 'P-OVERSIZE-STREAMS'],
		takes: (r) => !r.outputComplete,
		change: rewrite('[OUTPUT INCOMPLETE: ', '[output incomplete: ')
	},
	'an incomplete capture together with a capture cut': {
		moves: ['P-OVERSIZE-STREAMS'],
		takes: (r) => !r.outputComplete && r.omittedRegions.length > 0,
		change: rewrite('[OUTPUT INCOMPLETE: ', '[output incomplete: ')
	},
	'a STDOUT capture cut': {
		moves: ['P-STDOUT-CAPTURE-CUT', 'P-OVERSIZE-STREAMS'],
		takes: (r) => r.omittedRegions.some((o) => o.stream === 'STDOUT'),
		change: rewrite('[STDOUT TRUNCATED: ', '[STDOUT truncated: ')
	},
	'a STDERR capture cut': {
		moves: ['P-STDERR-CAPTURE-CUT', 'P-OVERSIZE-STREAMS'],
		takes: (r) => r.omittedRegions.some((o) => o.stream === 'STDERR'),
		change: rewrite('[STDERR TRUNCATED: ', '[STDERR truncated: ')
	},
	// ⭐ THE CAPTURE'S DECLARATION OF A CUT STREAM, under its own heading, in its two forms (`captureCutDeclaration`): the
	// end shown is the end of what was CAPTURED — of the stream shown whole, or of its TAIL when the review cut it too.
	'the capture-cut declaration of a stream shown whole (its end)': {
		moves: ['P-STDOUT-CAPTURE-CUT', 'P-STDERR-CAPTURE-CUT'],
		takes: (_r, view) => view.includes('so the end shown below is the end of what was CAPTURED'),
		change: rewrite('so the end shown below is', 'so the END shown below is')
	},
	'the capture-cut declaration of a stream the review cut too (its TAIL)': {
		moves: ['P-OVERSIZE-STREAMS'],
		takes: (_r, view) => view.includes('so the TAIL below is the end of what was CAPTURED'),
		change: rewrite('so the TAIL below is', 'so the tail below is')
	},
	'a review-layer head-and-tail cut': {
		moves: ['P-OVERSIZE-CONTENT'],
		shared: true,
		takes: (_r, view) => view.includes(`${CUT_DECLARED}stdout — `),
		change: rewrite(`${CUT_DECLARED}stdout — `, `${CUT_DECLARED}STDOUT — `)
	},
	'a review-layer cut of stderr': {
		moves: ['P-OVERSIZE-ROOM-EDGES', 'P-OVERSIZE-STREAMS', 'P-OVERSIZE-AT-ITS-BUDGET'],
		takes: (_r, view) => view.includes(`${CUT_DECLARED}stderr — `),
		change: rewrite(`${CUT_DECLARED}stderr — `, `${CUT_DECLARED}STDERR — `)
	},
	// ⭐ TWO LARGE STREAMS SHARE THE ROOM — max-min, so each over its share is given an equal one (`allocate`). The change
	// is a split one unit uneven: stdout's TAIL keeps one more unit, stderr's one fewer, each declaration recounted.
	'two large streams share the room': {
		moves: ['P-OVERSIZE-ROOM-EDGES', 'P-OVERSIZE-STREAMS', 'P-OVERSIZE-AT-ITS-BUDGET'],
		takes: (_r, view) => view.includes(`${CUT_DECLARED}stdout — `) && view.includes(`${CUT_DECLARED}stderr — `),
		change: (source, view) => {
			const out = headAndTailCut(view, 'stdout')!;
			const once = recut(view, 'stdout', source.run.stdout, out.head, tailOf(source.run.stdout, out.tail.length + 1));
			const err = headAndTailCut(once, 'stderr')!;
			return recut(once, 'stderr', source.run.stderr, err.head, tailOf(source.run.stderr, err.tail.length - 1));
		}
	},
	'a long command line': {
		moves: ['P-OVERSIZE-COMMAND', 'P-OVERSIZE-AT-ITS-BUDGET'],
		takes: (_r, view) => view.includes(`${CUT_DECLARED}the command line — `),
		change: rewrite(`${CUT_DECLARED}the command line — `, `${CUT_DECLARED}THE COMMAND LINE — `)
	},
	// ⭐ THE PAIR ASTRIDE A CUT — the change is the one `review-fence.ts` exists to refuse: a cut that HALVES the pair at
	// either end instead of giving it back (the HEAD) or stepping past it (the TAIL). Rendered exactly: what is kept, k
	// UTF-16 units, is read off the same view with the stdout replaced by as many ASCII characters as it has code points —
	// the same room and the same widest declaration, so the same k, with nothing to give back — and the HEAD is then the
	// first ⌈k/2⌉ units and the TAIL the rest, half pairs and all, under a declaration recounted as the product counts.
	'a surrogate pair astride a cut': {
		moves: ['P-OVERSIZE-SURROGATE', 'P-OVERSIZE-ROOM-EDGES'],
		takes: (r, view) => /[\uD800-\uDFFF]/.test(r.stdout) && view.includes(`${CUT_DECLARED}stdout — `),
		change: (source, view) => {
			const s = source.run.stdout;
			const k = keptUnits(source);
			const head = s.slice(0, Math.ceil(k / 2));
			const tail = s.slice(s.length - (k - head.length));
			return recut(view, 'stdout', s, head, tail);
		}
	},
	// ⭐ THE UNIT THE HEAD GIVES BACK GOES TO THE TAIL (`shownWithin`: the TAIL is asked for what the HEAD left). The change
	// asks the TAIL for half of what is kept instead — which differs only where the HEAD gave a unit back and the TAIL
	// did not step past one: `P-OVERSIZE-SURROGATE`'s TAIL steps past a unit either way, so it is the same view there.
	'the unit the HEAD gives back goes to the TAIL': {
		moves: ['P-OVERSIZE-ROOM-EDGES'],
		takes: (r, view) => codePoints(r.stdout) !== r.stdout.length && view.includes(`${CUT_DECLARED}stdout — `),
		change: (source, view) => {
			const s = source.run.stdout;
			const c = headAndTailCut(view, 'stdout')!;
			return recut(view, 'stdout', s, c.head, tailOf(s, Math.floor(keptUnits(source) / 2)));
		}
	},
	// ⭐ A STREAM WITHIN ITS TWO FENCE LINES OF FITTING (`shownWithin`'s whole-fit test counts the fence lines in the
	// room). The change is the test that forgot them: a stream whose whole block, fence lines aside, fits its room is
	// shown whole — its fence lines then overrun the room, and the view stays within the budget only by the digits other
	// declarations did not need.
	'a stream within its two fence lines of fitting': {
		moves: ['P-OVERSIZE-ROOM-EDGES'],
		takes: (r, view) =>
			view.includes(`${CUT_DECLARED}stderr — `) &&
			!r.omittedRegions.some((o) => o.stream === 'STDERR') &&
			codePoints(r.stderr) === r.stderr.length &&
			wholeBlock('stderr', r.stderr, '').length <= roomOf(view, 'stderr', r.stderr).room,
		change: (source, view) => {
			const { start, end } = roomOf(view, 'stderr', source.run.stderr);
			const fence = headAndTailCut(view, 'stderr')!.fence;
			return `${view.slice(0, start)}${wholeBlock('stderr', source.run.stderr, fence)}${view.slice(end)}`;
		}
	}
};
/** How many UTF-16 units the review view keeps of `source`'s stdout when no pair is astride its cut (see above). */
function keptUnits(source: ProcessResultReviewSource): number {
	const twin = PRODUCT_SEAMS.processResult({ ...source, run: { ...source.run, stdout: 'a'.repeat(codePoints(source.run.stdout)) } });
	const t = headAndTailCut(twin.content, 'stdout')!;
	return t.head.length + t.tail.length;
}
/** The product's builder, changed in ONE branch alone. */
const changedIn =
	(b: BranchChange): FingerprintSeams['processResult'] =>
	(source) => {
		const input = PRODUCT_SEAMS.processResult(source);
		return b.takes(source.run, input.content) ? { ...input, content: b.change(source, input.content) } : input;
	};
const P_PROBES = (): string[] => FINGERPRINT_PROBES.map((p) => p.id).filter((id) => id.startsWith('P-'));
const movedProbes = (fp: ReviewerFingerprint): string[] =>
	FINGERPRINT_PROBES.map((p) => p.id).filter((id) => fp.probePrompts.get(id) !== BASE.probePrompts.get(id));
/**
 * ⭐ WHAT A PER-BRANCH ROW ASKS OF THE PROBES THAT MOVED — each discrepancy named, `[]` when there is none: every probe
 * the row names moved, and, unless the branch is shared by design, no probe it does not name moved.
 */
function branchDiscrepancies(moved: readonly string[], b: BranchChange): string[] {
	const missing = b.moves.filter((id) => !moved.includes(id)).map((id) => `${id} takes the branch, and did not move`);
	if (b.shared) return missing;
	return [...missing, ...moved.filter((id) => !b.moves.includes(id)).map((id) => `${id} moved, and the row does not name it`)];
}
/** ⭐ `PQ-1` — the two branches every view of a kind shares by design: the clean layout, and a review cut's declaration. */
const SHARED_BY_DESIGN: readonly string[] = ['clean', 'a review-layer head-and-tail cut'];
/** The rows marked `shared`, against `SHARED_BY_DESIGN` — each discrepancy named, `[]` when the two are one set. */
function sharedDiscrepancies(changes: Readonly<Record<string, BranchChange>>): string[] {
	const marked = Object.keys(changes).filter((k) => changes[k]!.shared);
	return [
		...marked.filter((k) => !SHARED_BY_DESIGN.includes(k)).map((k) => `${k} is marked shared, and is not shared by design`),
		...SHARED_BY_DESIGN.filter((k) => !marked.includes(k)).map((k) => `${k} is shared by design, and is not marked so`)
	];
}
/** The probes that send one and the same prompt, grouped — `[]` when every probe sends a prompt of its own. */
function samePrompt(prompts: ReadonlyMap<string, string>): string[][] {
	const byPrompt = new Map<string, string[]>();
	for (const [id, sent] of prompts) byPrompt.set(sent, [...(byPrompt.get(sent) ?? []), id]);
	return [...byPrompt.values()].filter((ids) => ids.length > 1);
}

// ── ⭐⭐ `PQ-1` (`REG-F-481`; design D2 under the sponsor's answer (a)) — WHAT THE VIEW'S FENCE CHOOSER READS ──────────────
//
// The view's token is chosen over every part it shows and every other untrusted slice of the prompt
// (`renderProcessResultReview`, `processResultReviewInput`). A chooser that stopped reading one of them would fence the
// prompt with a token that slice holds — and while no probe planted a candidate anywhere, that moved no probe. Each row
// below swaps the seam for the product's builder with its chooser changed in ONE rule alone: what it renders differs
// from the product's view only in the token, and only where the slice it stops reading decides the token.
type ViewPart = { readonly slice: string; readonly part: 'whole' | 'HEAD' | 'TAIL'; readonly text: string };
/** The slice each heading of the review view opens (`process-result-render.ts` `layoutOf`). */
const VIEW_HEADINGS: ReadonlyMap<string, string> = new Map([
	['the command line, as a JSON array of its arguments:', 'the command line'],
	['stdout:', 'stdout'],
	['stderr:', 'stderr']
]);
/**
 * ⭐ THE PARTS A VIEW'S CHOOSER READ, read back from the view by its own token — which stands on no line but its own
 * fence lines: each region's text, the slice it shows, and which part of that slice it is.
 */
function viewParts(view: string): { readonly token: string; readonly parts: readonly ViewPart[] } {
	const lines = view.split('\n');
	const token = lines.find((l) => FENCE_LINE.test(l))!;
	const parts: ViewPart[] = [];
	let slice = '';
	let part: ViewPart['part'] = 'whole';
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i]!;
		if (VIEW_HEADINGS.has(line)) [slice, part] = [VIEW_HEADINGS.get(line)!, 'whole'];
		else if (line === 'HEAD:' || line === 'TAIL:') part = line === 'HEAD:' ? 'HEAD' : 'TAIL';
		else if (line === token) {
			const close = lines.indexOf(token, i + 1);
			// ⭐ `PQ-1` — a view's region is closed by its own token: one that never closes is no fenced view (`P-NO-FENCE`).
			expect(close, 'a region of the view is closed by its token').toBeGreaterThan(i);
			parts.push({ slice, part, text: lines.slice(i + 1, close).join('\n') });
			i = close;
		}
	}
	return { token, parts };
}
/** The prompt's other untrusted slices, as `processResultReviewInput` hands them to the view's chooser. */
const otherUntrustedOf = (input: ReasoningReviewInput): readonly string[] => {
	const { content: _view, ...rest } = input;
	return processResultUntrustedSlices({ ...rest, framing: 'PROCESS_RESULT' });
};
/** `view` re-fenced with the token a chooser would choose that read only the parts `kept` keeps, and `other`. */
function rechosen(view: string, other: readonly string[], kept: (p: ViewPart) => boolean): string {
	const { token, parts } = viewParts(view);
	const chosen = chooseFence([...parts.filter(kept).map((p) => p.text), ...other]);
	expect(chosen, 'a token is chosen').toBeDefined();
	return view.split(token).join(chosen!);
}
/** The host line a view rendered UNFENCED opens its slices with (`renderProcessResultReview`): every candidate occurs. */
const NO_FENCE_LINE = '[NO FENCE: every fence candidate occurs in the bytes below, so they are shown unfenced — and this review is not sent.]';
/**
 * ⭐ `PQ-1` — WHETHER `view` WAS RENDERED UNFENCED, with nothing to re-choose — asserted, for each rule below, from the run:
 * every rule reads a part of what the product's chooser read, and each keeps a WHOLE stdout, so a stdout that alone
 * holds every candidate leaves every rule's chooser without one too (`P-NO-FENCE`).
 */
const unfenced = (source: ProcessResultReviewSource, view: string): boolean => {
	if (!view.split('\n').includes(NO_FENCE_LINE)) return false;
	expect(chooseFence([source.run.stdout]), 'an unfenced view: its whole stdout alone holds every candidate').toBeUndefined();
	return true;
};
/** The product's builder, its view's chooser reading only the parts `kept` keeps, and the other slices `other` lists. */
const choosing =
	(
		kept: (p: ViewPart) => boolean,
		other: (input: ReasoningReviewInput) => readonly string[] = otherUntrustedOf
	): FingerprintSeams['processResult'] =>
	(source) => {
		const input = PRODUCT_SEAMS.processResult(source);
		if (unfenced(source, input.content)) return input;
		return { ...input, content: rechosen(input.content, other(input), kept) };
	};
/** One rule of what the view's chooser reads, broken: the probes whose token it moves, exactly, and the builder. */
interface ChooserRule {
	readonly moves: readonly string[];
	readonly builder: FingerprintSeams['processResult'];
}
/**
 * ⭐ THE NAME OF EACH OF THE PROMPT'S OTHER UNTRUSTED SLICES, in the order `processResultUntrustedSlices` lists them
 * (the validator's own plan): the instruction, the account's rationale and each list it shows as a region, the
 * narration, the prior findings, each call name the host did not mint. ⚠ Held to the plan's own count, so a slice the
 * plan adds is never left unnamed here.
 */
function otherUntrustedNames(input: ReasoningReviewInput): string[] {
	const names = [
		'the instruction',
		...(input.rationale
			? [
					"the account's rationale",
					...ACCOUNT_LISTS.filter((k) => input.rationale![k].length > 0).map(
						(k) => `the account's ${k === 'residualUncertainty' ? 'residual uncertainty' : k}`
					)
				]
			: []),
		...(input.narration ? ['the narration'] : []),
		...(input.prior?.gaps.length ? ['the prior findings'] : []),
		...unmintedNamesOf(input).map(() => 'a call name the host did not mint')
	];
	expect(names.length, 'every other untrusted slice of the plan, named').toBe(otherUntrustedOf(input).length);
	return names;
}
/** The prompt's other untrusted slices, but the one named `slice`. */
const otherUntrustedBut =
	(slice: string) =>
	(input: ReasoningReviewInput): readonly string[] => {
		const names = otherUntrustedNames(input);
		return otherUntrustedOf(input).filter((_, i) => names[i] !== slice);
	};
const CHOOSER_RULES: Readonly<Record<string, ChooserRule>> = {
	// ⭐ AS THE RENDERER ITSELF IS CALLED: `renderProcessResultReview` handed no other untrusted slice at all.
	'the prompt’s other untrusted slices — the instruction, the account, the narration, the prior findings, every unminted name': {
		moves: ['P-OVERSIZE-FENCES', 'P-OVERSIZE-ALL', 'P-FENCES-OTHER-SLICES', 'P-ACCOUNT-BREAKS'],
		builder: (source) => {
			const input = PRODUCT_SEAMS.processResult(source);
			return { ...input, content: renderProcessResultReview(source.run, viewBudget(input), []) };
		}
	},
	// ⭐ Design §9.3 D7: `P-ACCOUNT-BREAKS` plants in every field of the account (`probes.ts` `BREAKS_ACCOUNT`), so each
	// row that stops reading one moves it too.
	'each field of the account': {
		moves: ['P-OVERSIZE-FENCES', 'P-FENCES-OTHER-SLICES', 'P-ACCOUNT-BREAKS'],
		builder: choosing(
			() => true,
			(input) => otherUntrustedOf({ ...input, rationale: undefined })
		)
	},
	// ⭐ …AND EACH OF THEM ALONE. ⛔ Only the account's fields all at once, and the other slices all at once, had rows, and
	// no probe's view token stood above a plant in the limitations, the narration or the prior findings: a view chooser
	// that skipped any one of the three moved no probe (driven on a disposable copy).
	// `P-FENCES-OTHER-SLICES` plants in each.
	'the instruction': {
		moves: ['P-OVERSIZE-FENCES', 'P-OVERSIZE-ALL', 'P-FENCES-OTHER-SLICES'],
		builder: choosing(() => true, otherUntrustedBut('the instruction'))
	},
	"the account's rationale": {
		moves: ['P-OVERSIZE-FENCES', 'P-ACCOUNT-BREAKS'],
		builder: choosing(() => true, otherUntrustedBut("the account's rationale"))
	},
	"the account's assumptions": {
		moves: ['P-OVERSIZE-FENCES', 'P-ACCOUNT-BREAKS'],
		builder: choosing(() => true, otherUntrustedBut("the account's assumptions"))
	},
	"the account's limitations": {
		moves: ['P-FENCES-OTHER-SLICES', 'P-ACCOUNT-BREAKS'],
		builder: choosing(() => true, otherUntrustedBut("the account's limitations"))
	},
	"the account's residual uncertainty": {
		moves: ['P-OVERSIZE-FENCES', 'P-ACCOUNT-BREAKS'],
		builder: choosing(() => true, otherUntrustedBut("the account's residual uncertainty"))
	},
	'the narration': { moves: ['P-FENCES-OTHER-SLICES'], builder: choosing(() => true, otherUntrustedBut('the narration')) },
	'the prior findings': { moves: ['P-FENCES-OTHER-SLICES'], builder: choosing(() => true, otherUntrustedBut('the prior findings')) },
	'the command line': { moves: ['P-OVERSIZE-FENCES'], builder: choosing((p) => p.slice !== 'the command line') },
	// ⭐ stdout WHOLE AND CUT: `P-FENCE-AT-THE-LAST`'s whole stdout prints every candidate but the last two, and
	// `P-OVERSIZE-FENCES`'s cut one plants in its HEAD and its TAIL.
	stdout: { moves: ['P-OVERSIZE-FENCES', 'P-FENCE-AT-THE-LAST'], builder: choosing((p) => p.slice !== 'stdout') },
	'a cut slice’s HEAD': { moves: ['P-OVERSIZE-FENCES'], builder: choosing((p) => p.part !== 'HEAD') },
	'a cut slice’s TAIL': { moves: ['P-OVERSIZE-FENCES'], builder: choosing((p) => p.part !== 'TAIL') },
	stderr: { moves: ['P-OVERSIZE-FENCES'], builder: choosing((p) => p.slice !== 'stderr') }
};

// ── ⭐⭐ `PQ-1` (`REG-F-481`) — THE ACCOUNT'S HOST LINES, AND THE SUBJECT HASH'S, ARE HASHED IN EVERY FRAMING THAT HAS THEM ──
//
// The review renders the account field by field, each field's label and an empty list's "(none declared)" a line of
// the HOST's, outside every region, and the candidate's subject hash on a host line of its own. A validator that put any
// of them back inside quoted material changes only the lines it moves — so each row below is that change, made at the
// validator's print seam, and must move exactly the probes whose INPUT carries what it moves.
// ⭐ Design §9.3 D7 (the sponsor's answers of 2026-10-05): the rationale is unlabelled again, the section heading the line
// above its region, and each list stands under HEAD's own label — `<label>:` — its items after `  - ` (`LIST_ITEM`).
/** The account's list labels, as the review renders them (`reasoning-review-validator.ts` `ACCOUNT_LISTS`). */
const ACCOUNT_LIST_LABELS = {
	assumptions: 'Assumptions relied on',
	limitations: 'Limitations the producer declares',
	residualUncertainty: 'Residual uncertainty'
} as const;
const ACCOUNT_LISTS = Object.keys(ACCOUNT_LIST_LABELS) as (keyof typeof ACCOUNT_LIST_LABELS)[];
/** The heading the account's lines follow, and the host line the subject hash stands on. */
const ACCOUNT_HEADING = "The producing agent's PROFESSIONAL RATIONALE SUMMARY";
const SUBJECT_HASH_LINE = "The candidate's subject hash (host-computed): ";
/** D7 — the prefix `renderRationale` writes before each item of a list: ~~the one host byte sequence a region holds~~
 *  one of the two host byte sequences a region holds — the other is the line feed that ends every item but the last
 *  (`bulleted`). */
const LIST_ITEM = '  - ';
/** A list's region as D7 renders it: each item after `LIST_ITEM`, one to a line. */
const bulleted = (items: readonly string[]): string => items.map((item) => `${LIST_ITEM}${item}`).join('\n');
/** The account's section heading — the line above the rationale's region, which has no label of its own (D7). */
const headingOf = (prompt: string): string | undefined => prompt.split('\n').find((l) => l.startsWith(ACCOUNT_HEADING));
/** `prompt` with every host line `label` moved INSIDE the region it labels — after that region's opening fence line. */
const labelInside =
	(label: string) =>
	(prompt: string): string => {
		const lines = prompt.split('\n');
		for (let at = lines.indexOf(label); at >= 0; ) {
			const declared = lines[at + 1]!.startsWith(CUT_DECLARED) ? 1 : 0;
			expect(lines[at + 1 + declared], `${label}: a region follows it`).toMatch(FENCE_LINE);
			lines.splice(at, 1);
			const inside = at + declared + 1;
			lines.splice(inside, 0, label);
			at = lines.indexOf(label, inside + 1);
		}
		return lines.join('\n');
	};
/** `prompt` with every "(none declared)" host line of the account fenced, by the account's own token. */
const noneDeclaredQuoted = (prompt: string): string => {
	const lines = prompt.split('\n');
	const fence = lines.slice(lines.findIndex((l) => l.startsWith(ACCOUNT_HEADING))).find((l) => FENCE_LINE.test(l));
	return lines
		.flatMap((l) => (ACCOUNT_LISTS.some((k) => l === `${ACCOUNT_LIST_LABELS[k]}: (none declared)`) ? [fence!, l, fence!] : [l]))
		.join('\n');
};
/** `prompt` with the subject hash's host line merged back into the content's JSON, inside the content's region. */
const hashInContent = (prompt: string): string => {
	const lines = prompt.split('\n');
	const at = lines.findIndex((l) => l.startsWith(SUBJECT_HASH_LINE));
	if (at < 0) return prompt;
	expect(lines[at - 1], 'the hash line follows the content’s closing fence').toMatch(FENCE_LINE);
	const json = lines[at - 2]!;
	lines[at - 2] = `${json.slice(0, -1)},"candidateSubjectHash":${JSON.stringify(lines[at]!.slice(SUBJECT_HASH_LINE.length))}}`;
	lines.splice(at, 1);
	return lines.join('\n');
};
/** One host line put back inside quoted material: which inputs carry it, the framings that can, and the change. */
interface HostLineChange {
	readonly carries: (input: ReasoningReviewInput) => boolean;
	readonly framings: readonly string[];
	readonly change: (prompt: string) => string;
}
const HOST_LINE_CHANGES: Readonly<Record<string, HostLineChange>> = {
	// ~~'the rationale’s label, inside its region'~~ — design §9.3 D7 gave the rationale no label (as in HEAD): the host
	// line above its region is the account's section heading, and that is the line a validator could put inside it.
	'the account’s section heading, inside the rationale’s region': {
		carries: (i) => i.rationale !== undefined,
		framings: ['G', 'W', 'P'],
		change: (prompt) => {
			const heading = headingOf(prompt);
			const lines = prompt.split('\n');
			const next = heading === undefined ? undefined : lines[lines.indexOf(heading) + 1];
			// ⚠ With no account the heading stands above the host's "(NOT DECLARED — …)" line, and there is no region.
			return next !== undefined && (FENCE_LINE.test(next) || next.startsWith(CUT_DECLARED)) ? labelInside(heading!)(prompt) : prompt;
		}
	},
	...Object.fromEntries(
		ACCOUNT_LISTS.map((k) => [
			`the label of ${k}, inside its region`,
			{
				carries: (i: ReasoningReviewInput) => (i.rationale?.[k].length ?? 0) > 0,
				framings: ['G', 'W', 'P'],
				// ~~`${label}, as a JSON array of strings:`~~ — D7: HEAD's label.
				change: labelInside(`${ACCOUNT_LIST_LABELS[k]}:`)
			}
		])
	),
	'an empty list’s "(none declared)" line, quoted': {
		carries: (i) => ACCOUNT_LISTS.some((k) => i.rationale?.[k].length === 0),
		framings: ['G', 'W', 'P'],
		change: noneDeclaredQuoted
	},
	'the candidate’s subject hash, merged back into the content': {
		carries: (i) => Boolean(i.candidateSubjectHash),
		framings: ['G'],
		change: hashInContent
	}
};

// ── ⭐⭐ `PQ-1` (`REG-F-481`; design D2 under the sponsor's answer (a)) — WHAT THE VALIDATOR'S FENCE CHOOSER READS, AND HOW
// EACH SLICE IT QUOTES IS ENCODED ──────────────────────────────────────────────────────────────────────────────────────
//
// The prompt's token is chosen over every untrusted slice it quotes — the instruction, the content of a graph or a work
// product, each field of the account, the narration, the prior findings — and, for a process result, over the builder's
// view read whole and each call name the host did not mint (`reasoning-review-validator.ts` `judgePrompt`). While no
// probe planted a candidate in the narration, the prior findings, a graph or a work product, a chooser that skipped one
// moved no fingerprint, and reddened nothing here (driven on a disposable copy). Each row below swaps the validator
// seam for the product's validator with ONE rule changed — the token re-chosen without one slice, or one slice encoded
// as a call site that was not `jsonLine` would print it — and must move exactly the probes that plant there.
/** The host line before a region of the prompt, and the slice that region quotes — ⭐ D7: the rationale's is the account's
 *  section heading (`promptRegions` reads it by its start), each list's HEAD's own label. */
const PROMPT_LABELS: ReadonlyMap<string, string> = new Map([
	...ACCOUNT_LISTS.map((k) => [`${ACCOUNT_LIST_LABELS[k]}:`, `the account's ${k === 'residualUncertainty' ? 'residual uncertainty' : k}`] as const),
	["The producing agent's observable narration during the turn (trace data, not its private chain-of-thought):", 'the narration'],
	['A PREVIOUS review flagged:', 'the prior findings']
]);
interface PromptRegion {
	readonly slice: string;
	readonly cut: boolean;
	/** The lines of its text, `[from, to)` in the prompt's lines. */
	readonly from: number;
	readonly to: number;
}
/**
 * ⭐ THE REGIONS OF A PROMPT, read back by its own token — which stands on no line but its own fence lines, and opens the
 * instruction's region, the first of every framing — each named by the host line before it, a cut's declaration aside:
 * the first is the instruction, and the one no label names is the content of a graph or a work product. A process
 * result's view is fenced by a token of its own, so it is no region here.
 */
function promptRegions(prompt: string): { readonly lines: string[]; readonly token: string; readonly regions: readonly PromptRegion[] } {
	const lines = prompt.split('\n');
	const token = lines.find((l) => FENCE_LINE.test(l))!;
	const regions: PromptRegion[] = [];
	for (let i = 0; i < lines.length; i += 1) {
		if (lines[i] !== token) continue;
		const close = lines.indexOf(token, i + 1);
		expect(close, 'a region of the prompt is closed by its token').toBeGreaterThan(i);
		const cut = lines[i - 1]!.startsWith(CUT_DECLARED);
		const label = lines[cut ? i - 2 : i - 1]!;
		const slice = label.startsWith(ACCOUNT_HEADING) ? "the account's rationale" : (PROMPT_LABELS.get(label) ?? 'the content');
		regions.push({ slice: regions.length === 0 ? 'the instruction' : slice, cut, from: i + 1, to: close });
		i = close;
	}
	return { lines, token, regions };
}
/** The text of a region. */
const regionText = (lines: readonly string[], r: PromptRegion): string => lines.slice(r.from, r.to).join('\n');
/** Each call name the host did not mint, JSON-encoded — the validator's chooser reads them where they sit, on host lines. */
const unmintedNamesOf = (input: ReasoningReviewInput): string[] =>
	(input.observedToolCalls?.calls ?? []).flatMap((c) =>
		c.toolName !== undefined && c.nameProvenance !== 'MINTED_BY_HOST' ? [jsonLine(c.toolName)] : []
	);
/**
 * `prompt` re-fenced with the token a validator chooser would choose that read only the regions `kept` keeps — and,
 * for a process result, the view whole and each unminted call name, as the product's reads them.
 */
function revalidated(prompt: string, input: ReasoningReviewInput, kept: (slice: string, cut: boolean) => boolean): string {
	const { lines, token, regions } = promptRegions(prompt);
	const chosen = chooseFence([
		...regions.filter((r) => kept(r.slice, r.cut)).map((r) => regionText(lines, r)),
		// ⭐ The view of a process result, read whole, is a slice of its own here (`'the view'`), as the product's reads it.
		...(input.framing === 'PROCESS_RESULT' ? [...(kept('the view', false) ? [input.content] : []), ...unmintedNamesOf(input)] : [])
	]);
	expect(chosen, 'a token is chosen').toBeDefined();
	return prompt.split(token).join(chosen!);
}
/** The product's validator, every prompt it sends changed by `change` — which is handed the input it was built for. */
const validatorPrinting =
	(change: (prompt: string, input: ReasoningReviewInput) => string): FingerprintSeams['validator'] =>
	(print) => ({
		...PRODUCT_SEAMS.validator(print),
		evaluate: (subject, ctx) =>
			PRODUCT_SEAMS.validator((p) => print(change(p, ctx.reasoningReview!))).evaluate(subject, ctx)
	});
/**
 * One rule of what the validator's chooser reads, broken: the probes whose token it moves, exactly, what it keeps, and
 * ⭐ the framings whose prompt can carry the slice it skips — the moved probes must stand in EACH of them (`REG-F-481`),
 * so a chooser that skipped that slice in any one framing alone would move a probe too.
 */
interface ValidatorChooserRule {
	readonly moves: readonly string[];
	readonly kept: (slice: string, framing: ReasoningReviewInput['framing'], cut: boolean) => boolean;
	readonly framings: readonly string[];
	/**
	 * ⭐ `PQ-2` (design D4) — the case prompts of the CURRENT set the rule moves, as `BRANCH_CHANGES` names the ones a
	 * renderer branch moves: none, but where what the rule stops reading decides the token of a current case's prompt —
	 * the view of a process result, fenced by a token of its own, which the prompt's token avoids in each of the fourteen.
	 */
	readonly casesNow?: readonly string[];
}
/** The account's four fields, as the prompt's regions name them. */
const ACCOUNT_SLICES: readonly string[] = [
	"the account's rationale",
	"the account's assumptions",
	"the account's limitations",
	"the account's residual uncertainty"
];
const VALIDATOR_CHOOSER_RULES: Readonly<Record<string, ValidatorChooserRule>> = {
	'the instruction': {
		moves: ['G-OVERSIZE-ALL', 'G-OVERSIZE-FENCES', 'W-OVERSIZE-ALL', 'W-FENCES', 'P-OVERSIZE-FENCES', 'P-OVERSIZE-ALL', 'P-FENCES-OTHER-SLICES'],
		kept: (s) => s !== 'the instruction',
		framings: ['G', 'W', 'P']
	},
	'the content of a graph': {
		moves: ['G-OVERSIZE-CONTENT', 'G-OVERSIZE-FENCES'],
		kept: (s, f) => !(s === 'the content' && f === 'PWA_GRAPH'),
		framings: ['G']
	},
	'the content of a work product': {
		moves: ['W-OVERSIZE-CONTENT', 'W-FENCES'],
		kept: (s, f) => !(s === 'the content' && f === 'WORK_PRODUCT'),
		framings: ['W']
	},
	// ⭐ `PQ-1` (`REG-F-481`) — AND ONLY WHEN IT IS CUT: the content of a graph or a work product skipped when the budget cut
	// it, read when whole. ⛔ No probe held a candidate in a cut content, so this rule moved no probe (driven on a disposable
	// copy); `G-OVERSIZE-CONTENT` and `W-OVERSIZE-CONTENT` hold one in the kept HEAD now.
	'the content of a graph or a work product, when it is cut': {
		moves: ['G-OVERSIZE-CONTENT', 'W-OVERSIZE-CONTENT'],
		kept: (s, _f, cut) => !(s === 'the content' && cut),
		framings: ['G', 'W']
	},
	// ⭐ `PQ-1` (`REG-F-481`) — EACH FIELD OF THE ACCOUNT, THE NARRATION AND THE PRIOR FINDINGS, IN EVERY FRAMING THAT CARRIES
	// THEM. ⛔ They moved a graph's probe and a process result's, never a work product's, and no process-result probe
	// planted in the limitations, the narration or the prior findings: a chooser that skipped them in a work product's
	// review alone, or a process result's, moved no probe (driven on a disposable copy). `W-FENCES` plants in each field
	// and the prior now, and `P-OVERSIZE-ALL` and `P-FENCES-OTHER-SLICES` in the three `P-OVERSIZE-FENCES` leaves empty.
	// ⭐ Design §9.3 D7: the account-breaks probes plant in every field of the account, in every framing (`probes.ts`
	// `BREAKS_ACCOUNT`), so each row that stops reading a field of it moves them too.
	"the account's rationale": {
		moves: [
			'G-OVERSIZE-FENCES',
			'G-ACCOUNT-BREAKS',
			'W-FENCES',
			'W-ACCOUNT-BREAKS',
			'P-OVERSIZE-FENCES',
			'P-ACCOUNT-BREAKS'
		],
		kept: (s) => s !== "the account's rationale",
		framings: ['G', 'W', 'P']
	},
	"the account's assumptions": {
		moves: [
			'G-OVERSIZE-FENCES',
			'G-ACCOUNT-BREAKS',
			'W-FENCES',
			'W-ACCOUNT-BREAKS',
			'P-OVERSIZE-FENCES',
			'P-ACCOUNT-BREAKS'
		],
		kept: (s) => s !== "the account's assumptions",
		framings: ['G', 'W', 'P']
	},
	// ~~"the account's limitations — cut", moving G-OVERSIZE-FENCES alone~~ — its limitations alone are cut; a work
	// product's and a process result's are whole.
	"the account's limitations": {
		moves: [
			'G-OVERSIZE-FENCES',
			'G-ACCOUNT-BREAKS',
			'W-FENCES',
			'W-ACCOUNT-BREAKS',
			'P-OVERSIZE-ALL',
			'P-FENCES-OTHER-SLICES',
			'P-ACCOUNT-BREAKS'
		],
		kept: (s) => s !== "the account's limitations",
		framings: ['G', 'W', 'P']
	},
	"the account's residual uncertainty": {
		moves: [
			'G-OVERSIZE-FENCES',
			'G-ACCOUNT-BREAKS',
			'W-FENCES',
			'W-ACCOUNT-BREAKS',
			'P-OVERSIZE-FENCES',
			'P-ACCOUNT-BREAKS'
		],
		kept: (s) => s !== "the account's residual uncertainty",
		framings: ['G', 'W', 'P']
	},
	// ⚠ A work product's prompt carries no narration: `workProductReviewInput` sends none.
	'the narration': {
		moves: ['G-OVERSIZE-FENCES', 'P-OVERSIZE-ALL', 'P-FENCES-OTHER-SLICES'],
		kept: (s) => s !== 'the narration',
		framings: ['G', 'P']
	},
	'the prior findings': {
		moves: ['G-OVERSIZE-FENCES', 'W-FENCES', 'P-OVERSIZE-ALL', 'P-FENCES-OTHER-SLICES'],
		kept: (s) => s !== 'the prior findings',
		framings: ['G', 'W', 'P']
	},
	// ⭐ …AND EACH IN ONE FRAMING ALONE, as the review drove them: the account and the prior findings of a work product, and
	// the limitations of a process result.
	'the account, in a work product’s review alone': {
		moves: ['W-FENCES', 'W-ACCOUNT-BREAKS'],
		kept: (s, f) => !(ACCOUNT_SLICES.includes(s) && f === 'WORK_PRODUCT'),
		framings: ['W']
	},
	'the prior findings, in a work product’s review alone': {
		moves: ['W-FENCES'],
		kept: (s, f) => !(s === 'the prior findings' && f === 'WORK_PRODUCT'),
		framings: ['W']
	},
	"the account's limitations, in a process result’s review alone": {
		moves: ['P-OVERSIZE-ALL', 'P-FENCES-OTHER-SLICES', 'P-ACCOUNT-BREAKS'],
		kept: (s, f) => !(s === "the account's limitations" && f === 'PROCESS_RESULT'),
		framings: ['P']
	},
	// ⭐ …AND THE VIEW OF A PROCESS RESULT, WHICH IT READS WHOLE (design D2: the view's token is its own, so the prompt's
	// avoids it): every process-result probe the validator sends a prompt for. ⚠ `P-NO-FENCE` is refused before any
	// prompt exists, so there is no prompt of it to re-fence.
	'the view of a process result, read whole': {
		moves: P_PROBES().filter((id) => id !== 'P-NO-FENCE'),
		kept: (s) => s !== 'the view',
		framings: ['P'],
		// ⭐ `PQ-2` — each process-result case's view is fenced by `<<<UNTRUSTED-00>>>`, and those fence lines are the view's:
		// read whole, they make the prompt take the next token, so a chooser that stops reading the view moves all fourteen.
		casesNow: CURRENT_PROCESS_RESULTS
	}
};
/**
 * `prompt` with each region `which` names, shown whole, as `JSON.stringify` prints its value — the three breaks raw — as a
 * call site that encoded it so, and not with `jsonLine`, would print it. ⚠ The region's text alone: the room the shorter
 * raw break then frees in a budget the region shares is not modelled, and a CUT region is left as it is — no probe plants
 * a break in one. The question is whether the probes see the encoder, which the text alone answers.
 */
function encodedRaw(prompt: string, input: ReasoningReviewInput, which: (slice: string, framing: ReasoningReviewInput['framing']) => boolean): string {
	const { lines, regions } = promptRegions(prompt);
	for (const r of regions)
		if (!r.cut && which(r.slice, input.framing)) {
			const raw = JSON.stringify(JSON.parse(regionText(lines, r)) as unknown);
			lines.splice(r.from, r.to - r.from, ...raw.split('\n'));
		}
	return lines.join('\n');
}
const ENCODER_CALL_SITES: Readonly<Record<string, { readonly moves: readonly string[]; readonly which: (slice: string, framing: ReasoningReviewInput['framing']) => boolean }>> = {
	// ~~'an account list (every break in G-OVERSIZE-FENCES’s assumptions)': moves G-OVERSIZE-FENCES~~ — design §9.3 D7
	// RETIRED THAT CALL SITE: "the one-line JSON encoder no longer applies to the lists", so a list's breaks reach its
	// region raw, by design, and there is no encoder there to hold. What a list's region holds now is held by
	// `LIST_SERIALIZATION_CHANGES` below (its items after `  - `), and where its raw breaks stand by the G-OVERSIZE-FENCES
	// arrangement row.
	'the prior findings (every break in G-OVERSIZE-FENCES’s)': { moves: ['G-OVERSIZE-FENCES'], which: (s) => s === 'the prior findings' },
	'the content of a graph (every break in a node’s name of G-OVERSIZE-FENCES)': {
		moves: ['G-OVERSIZE-FENCES'],
		which: (s, f) => s === 'the content' && f === 'PWA_GRAPH'
	}
};
/** The account's three lists, as the prompt's regions name them. */
const LIST_SLICES: readonly string[] = ["the account's assumptions", "the account's limitations", "the account's residual uncertainty"];
/**
 * ⭐ DESIGN §9.3 D7 — HOW A LIST IS SERIALIZED IS HASHED, IN EVERY FRAMING: `prompt` with each list region the prompt shows
 * whole — its items read back off their `  - ` prefix, a line without one continuing the item before it — printed as
 * `jsonLine` prints them (the layout paid run 1 measured), or with another prefix. Each must move exactly the probes whose
 * prompt shows a list whole. ⚠ A CUT list is left as it is: its HEAD may end inside an item.
 */
function listsReserialized(prompt: string, as: (items: readonly string[]) => string): string {
	const { lines, regions } = promptRegions(prompt);
	for (const r of [...regions].reverse())
		if (!r.cut && LIST_SLICES.includes(r.slice)) {
			const items: string[] = [];
			for (const line of lines.slice(r.from, r.to))
				if (line.startsWith(LIST_ITEM)) items.push(line.slice(LIST_ITEM.length));
				else items[items.length - 1] += `\n${line}`;
			lines.splice(r.from, r.to - r.from, ...as(items).split('\n'));
		}
	return lines.join('\n');
}
const LIST_SERIALIZATION_CHANGES: Readonly<Record<string, (items: readonly string[]) => string>> = {
	'a list as one line of JSON again (`jsonLine`), not D7’s items': (items) => jsonLine(items),
	'a list’s items after another prefix (`- `)': (items) => items.map((item) => `- ${item}`).join('\n')
};
/** The probes whose prompt shows a list of the account whole — the ones a change to how a list is serialized moves. */
const showingAListWhole = (): string[] =>
	FINGERPRINT_PROBES.flatMap((x) => {
		const sent = BASE.probePrompts.get(x.id);
		if (sent === undefined || sent.startsWith(REFUSED)) return [];
		return promptRegions(sent).regions.some((r) => !r.cut && LIST_SLICES.includes(r.slice)) ? [x.id] : [];
	});
// ── ⭐⭐ DESIGN §9.3 D7 (`REG-F-481`) — HOW EACH FIELD OF THE ACCOUNT IS READ: AS THE PROMPT CARRIES IT, NO OTHER WAY ──
//
// A chooser reads each field of the account as the prompt carries it: the prose raw, each list its items after `  - `,
// one to a line. ⛔ Every plant in an account slice was read by every reading of it, and none was split by a break, so a
// chooser that read a field OTHERWISE — a list as one line of JSON again (the encoder D7 retired), U+2028, U+0085 or
// U+2029 read as a line feed, in a list or in the prose — moved no probe and reddened nothing here (driven on a
// disposable copy). The account-breaks probes (`probes.ts` `BREAKS_ACCOUNT`) plant in each field both ways: candidates
// read only as the prompt carries the field, and each chooser's token read only otherwise. Each row below has ONE
// chooser read ONE field ONE way otherwise, and must move exactly those probes, in every framing that carries it.
// ⭐ AND EACH FIELD AS A READER WHO LAYS A LINE OUT READS IT (`review-fence.ts`, LAYOUT): ⛔ the one line of each field a
// bidi control laid out held no candidate, so a chooser that read a field with every bidi control read away — in a
// work product's review alone, or the prose in a graph's alone — moved no probe and reddened nothing here (driven).
// Each field holds a candidate on a line of each layout the reader states (`probes.ts` `LAID_OUT_LINES`: an override,
// an embedding, an isolate), read only laid out: the row reading a field with its bidi controls read away moves the
// account-breaks probes, and the arrangement row holds that reading any ONE family away leaves exactly its line's
// candidate free.
/** The account's four fields, as the prompt's regions name them, in the order the prompt shows them. */
const ACCOUNT_FIELDS: readonly string[] = ["the account's rationale", ...LIST_SLICES];
/**
 * The terminators a reader may not break a line at, by code point, in the order `probes.ts` splits each field's six
 * candidates by them (`review-fence.ts` states them; written so, this file holds no escape of one).
 */
const UNBROKEN_BREAKS: readonly number[] = [0x0d, 0x0b, 0x0c, 0x85, 0x2028, 0x2029];
/** The two tokens `BREAKS_ACCOUNT` plants where only a field read otherwise holds them (`probes.ts`
 *  `BREAKS_TOKENS`) — past the nine candidates each field holds; ~~`24` and `25`~~ before each held a line of each
 *  layout. */
const BREAKS_TOKENS: readonly number[] = [36, 37];
/** How many candidates each field of `BREAKS_ACCOUNT` holds below the tokens: six split by a terminator, then three
 *  laid out. */
const PER_FIELD = 9;
/**
 * The bidi controls the reader names (`review-fence.ts` `BIDI_CONTROLS`), by code point — written so, this file holds
 * no escape of one — and the three families `BREAKS_ACCOUNT` lays a line of each field out by, in the order its
 * laid-out candidates stand (`probes.ts` `LAID_OUT_LINES`).
 */
const READER_BIDI_CONTROLS: readonly number[] = [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069];
const LAYOUT_FAMILIES: readonly (readonly [family: string, controls: readonly number[]])[] = [
	['the override (U+202E)', [0x202e]],
	['the embedding and its pop (U+202B, U+202C)', [0x202b, 0x202c]],
	['the isolate and its pop (U+2067, U+2069)', [0x2067, 0x2069]]
];
/** `text` with each code point `which` names read away. */
const readingAway =
	(which: readonly number[]) =>
	(text: string): string =>
		[...text].filter((c) => !which.includes(c.codePointAt(0)!)).join('');
/** `text` with each terminator `which` names read as a line feed. */
const breakingAt =
	(which: readonly number[]) =>
	(text: string): string =>
		[...text].map((c) => (which.includes(c.codePointAt(0)!) ? '\n' : c)).join('');
/**
 * One way of reading a field otherwise than the prompt carries it — `lists` when it reads a list's items, so it applies
 * to a list alone — and what it does to each field's plants: whether it leaves the field's six candidates unread
 * (`under`), ⭐ whether it leaves its three laid-out candidates unread — each of the three, or none (`unlaid`) — and
 * whether it reads both tokens (`over`). The arrangement row below holds all three, field by field.
 */
interface FieldReading {
	readonly lists?: true;
	readonly read: (text: string) => string;
	readonly under: boolean;
	readonly unlaid: boolean;
	readonly over: boolean;
}
const FIELD_READINGS: Readonly<Record<string, FieldReading>> = {
	'as one line of JSON (`jsonLine`, the encoder design §9.3 D7 retired from the lists)': {
		read: (t) => jsonLine(t),
		under: true,
		unlaid: false,
		over: true
	},
	'with each terminator a reader may not break at read as a line feed': {
		read: breakingAt(UNBROKEN_BREAKS),
		under: true,
		unlaid: false,
		over: false
	},
	'with its line feeds read away': { read: (t) => t.split('\n').join(''), under: false, unlaid: false, over: true },
	'with its items read joined, without the host’s prefix or line feed': {
		lists: true,
		read: (t) => t.split(`\n${LIST_ITEM}`).join('').slice(LIST_ITEM.length),
		under: false,
		unlaid: false,
		over: true
	},
	// ⭐ Design §9.3 D7 (`REG-F-481`): every line read in logical order alone — no line laid out.
	'with its bidi controls read away': { read: readingAway(READER_BIDI_CONTROLS), under: false, unlaid: true, over: false }
};
/** Each field with each way of reading it that applies to it — the rows below. */
const FIELD_READING_ROWS: readonly (readonly [field: string, reading: string])[] = ACCOUNT_FIELDS.flatMap((field) =>
	Object.keys(FIELD_READINGS)
		.filter((r) => !FIELD_READINGS[r]!.lists || LIST_SLICES.includes(field))
		.map((r) => [field, r] as const)
);
/** The probes that plant in each field of the account both ways (`probes.ts` `BREAKS_ACCOUNT`), in the probe set's
 *  order. */
const ACCOUNT_BREAKS_PROBES: readonly string[] = ['G-ACCOUNT-BREAKS', 'W-ACCOUNT-BREAKS', 'P-ACCOUNT-BREAKS'];
/**
 * `prompt` re-fenced with the token a validator chooser would choose that read `field` by `read` — every other region,
 * and a process result's view whole and each unminted call name, as the product's reads them.
 */
function reread(prompt: string, input: ReasoningReviewInput, field: string, read: (text: string) => string): string {
	const { lines, token, regions } = promptRegions(prompt);
	const besides = input.framing === 'PROCESS_RESULT' ? [input.content, ...unmintedNamesOf(input)] : [];
	const chosen = chooseFence([...regions.map((r) => (r.slice === field ? read(regionText(lines, r)) : regionText(lines, r))), ...besides]);
	expect(chosen, 'a token is chosen').toBeDefined();
	return prompt.split(token).join(chosen!);
}
/** The prompt's other untrusted slices, as the view's chooser is handed them, but `field` read by `read`. */
const otherRead =
	(field: string, read: (text: string) => string) =>
	(input: ReasoningReviewInput): readonly string[] => {
		const names = otherUntrustedNames(input);
		return otherUntrustedOf(input).map((s, i) => (names[i] === field ? read(s) : s));
	};
/** U+202E RIGHT-TO-LEFT OVERRIDE, the control `BREAKS_ACCOUNT` lays ~~a line of each field~~ the line above the
 *  tokens' backwards plants in each field out with — that field's FIRST line holding it, since the field's laid-out
 *  lines (`LAID_OUT_LINES`, one under U+202E among them) stand last — by code point. */
const RIGHT_TO_LEFT_OVERRIDE = String.fromCodePoint(0x202e);
/** The `n`th candidate, as the fence spells it. */
const fenceCandidateOf = (n: number): string => `<<<UNTRUSTED-${String(n).padStart(2, '0')}>>>`;
/** Whether some reading of `text` holds candidate `n`: a chooser handed every candidate below `n`, and `text`, takes
 *  another. */
const holds = (text: string, n: number): boolean =>
	chooseFence([Array.from({ length: n }, (_, i) => fenceCandidateOf(i)).join('\n'), text]) !== fenceCandidateOf(n);
// ── ⭐⭐ DESIGN §9.3 D7 AND D8 (the sponsor's answers of 2026-10-05) — THE ACCOUNT'S LAYOUT, THE RUBRIC'S STAKES AND THE
// RECOMMENDATION'S GLOSSES ARE HASHED ──────────────────────────────────────────────────────────────────────────────
//
// D7 labels each list as HEAD did and leaves the rationale unlabelled; D8 shows each criterion's `severityIfNotMet`
// beside it, read from the policy, and glosses three recommendation values by those stakes. Each row below is one such
// thing changed at the validator's print seam, and must move exactly the probes — and the case prompts — that carry it.
// ⛔ Every floor criterion declares BLOCKING, so a rubric that showed a constant, or wrote one stakes value otherwise,
// moved no probe handed the fingerprint's own criteria: `G-STAKES`, `W-STAKES` and `P-STAKES` are handed criteria
// declaring each of the five (`probes.ts` `withEveryStakes`).
/** How the rubric writes a criterion's stakes beside it (`reasoning-review-validator.ts`; design §9.3 D8). */
const stakesMark = (stakes: string): string => `[if unmet: ${stakes}]`;
/** The probes whose prompt shows `stakes` beside a criterion. */
const showingStakes = (stakes: string): string[] =>
	FINGERPRINT_PROBES.map((x) => x.id).filter((id) => BASE.probePrompts.get(id)!.includes(stakesMark(stakes)));
/** The probes the validator sends a prompt for: every one but those it refuses. */
const sendingAPrompt = (): string[] =>
	FINGERPRINT_PROBES.map((x) => x.id).filter((id) => !BASE.probePrompts.get(id)!.startsWith(REFUSED));
/**
 * Each phrase of D8 that says what a failure is, what it costs, where a concern that leaves a criterion met goes, and
 * what each glossed recommendation means — changed as a reader would read it otherwise (a word's case). ⚠ The validator
 * test pins D8's bytes whole and holds each gloss to `dispositionFromFindings`; these rows say that `probes`, and every
 * case prompt, sees each phrase.
 */
const D8_PHRASES: Readonly<Record<string, readonly [from: string, to: string]>> = {
	'what a failure is (the artifact does NOT MEET the criterion)': [
		'present means the artifact does NOT MEET that criterion',
		'present means the artifact does not meet that criterion'
	],
	'what an unmet criterion costs (the policy’s, beside it)': ['What an unmet criterion costs is the', 'What an unmet criterion COSTS is the'],
	'where a concern that leaves the criterion met goes': ['a concern that leaves the criterion met', 'a CONCERN that leaves the criterion met'],
	'SATISFIED’s gloss': ['SATISFIED (no criterion is unmet, except ones the policy', 'SATISFIED (NO criterion is unmet, except ones the policy'],
	'CONDITIONALLY_SATISFIED’s gloss': [
		'CONDITIONALLY_SATISFIED (an unmet criterion the policy marks MATERIAL, and',
		'CONDITIONALLY_SATISFIED (AN unmet criterion the policy marks MATERIAL, and'
	],
	'REJECTED’s gloss': [
		'REJECTED (an unmet criterion the policy marks BLOCKING or CRITICAL)',
		'REJECTED (AN unmet criterion the policy marks BLOCKING or CRITICAL)'
	]
};
/** One change to D7's layout of the account: which inputs carry what it changes, and the change. */
interface LayoutChange {
	readonly carries: (input: ReasoningReviewInput) => boolean;
	readonly change: (prompt: string) => string;
}
const D7_LAYOUT_CHANGES: Readonly<Record<string, LayoutChange>> = {
	'the rationale under a label of its own again (paid run 1’s "Its rationale:")': {
		carries: (i) => i.rationale !== undefined,
		change: (prompt) => {
			const lines = prompt.split('\n');
			const at = lines.findIndex((l) => l.startsWith(ACCOUNT_HEADING));
			const next = at < 0 ? undefined : lines[at + 1];
			// ⚠ With no account the heading stands above the host's "(NOT DECLARED — …)" line, and there is no region to label.
			if (next === undefined || !(FENCE_LINE.test(next) || next.startsWith(CUT_DECLARED))) return prompt;
			lines.splice(at + 1, 0, 'Its rationale:');
			return lines.join('\n');
		}
	},
	...Object.fromEntries(
		ACCOUNT_LISTS.map((k) => [
			`the label of ${k} as paid run 1 wrote it (", as a JSON array of strings:")`,
			{
				carries: (i: ReasoningReviewInput) => (i.rationale?.[k].length ?? 0) > 0,
				change: (prompt: string) =>
					prompt
						.split('\n')
						.map((l) => (l === `${ACCOUNT_LIST_LABELS[k]}:` ? `${ACCOUNT_LIST_LABELS[k]}, as a JSON array of strings:` : l))
						.join('\n')
			}
		])
	)
};
/** The three line breaks `JSON.stringify` leaves raw, by code point — written so, this file holds no escape of one. */
const JSON_LINE_BREAKS: readonly number[] = [0x85, 0x2028, 0x2029];
/** `jsonLine` as it would be did it leave `left` raw: `JSON.stringify`, then the other two breaks escaped. */
const jsonLineLeaving =
	(left: number) =>
	(value: unknown): string =>
		JSON.stringify(value).replace(
			new RegExp(`[${JSON_LINE_BREAKS.filter((c) => c !== left).map((c) => String.fromCharCode(c)).join('')}]`, 'g'),
			(c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
		);
/** The fence module, as the fingerprint's modules import it — mocked whole for a fresh load. */
const FENCE_MODULE_ID = '../apps/rph-demo/src/lib/server/assurance/review-fence.js';
/** The fingerprint, loaded afresh over the fence module with `override` laid over its exports — over `cases`, case set v1
 *  unless a row asks for the current set (`PQ-2`). */
async function freshOverFence(
	override: (real: typeof import('../apps/rph-demo/src/lib/server/assurance/review-fence.js')) => Record<string, unknown>,
	cases: readonly QualificationCase[] = CASES
) {
	vi.resetModules();
	vi.doMock(FENCE_MODULE_ID, async (importOriginal) => {
		const real = await importOriginal<typeof import('../apps/rph-demo/src/lib/server/assurance/review-fence.js')>();
		return { ...real, ...override(real) };
	});
	try {
		return await (await import('../scripts/reviewer-qual/fingerprint.js')).reviewerFingerprint(cases);
	} finally {
		vi.doUnmock(FENCE_MODULE_ID);
		vi.resetModules();
	}
}
/** How a refusal is hashed (`fingerprint.ts` `probePrompt`): this line, the statement, and the content refused. */
const REFUSED = 'REFUSED — the validator sent no prompt:';

describe('⭐⭐ JAN-PRQUAL PQ-1 (D3) — the fingerprint reaches the process-result renderer, through the `processResult` seam, branch by branch', () => {
	it('⛔ the seam’s default IS the product’s builder — the very function `runProcessResultFloor` builds through, never a copy or a wrapper', () => {
		// ⭐ WHY THE PRODUCTION FINGERPRINT CANNOT HASH A PROCESS RESULT OTHER THAN AS THE PRODUCT SENDS IT: the floor's input
		// IS this function's output for the floor's source (`review-input.test.ts`, input and prompt, byte for byte); a P-
		// probe reaches the renderer only through the seam (`probes.ts` imports the builder's type alone); and the check and
		// the runner compute the fingerprint with these seams. A wrapper that renders the same today would be a second
		// definition tomorrow, so the identity is what is held.
		expect(PRODUCT_SEAMS.processResult).toBe(processResultReviewInput);
	});

	it('⭐ a RENDERER change moves `probes` — every P- probe with it, no other probe: each is built through the seam — and, of the case prompts, exactly the process-result cases’ (none of v1’s; the current set’s fourteen, PQ-2)', async () => {
		const seams: FingerprintSeams = {
			...PRODUCT_SEAMS,
			processResult: (source) => {
				const input = PRODUCT_SEAMS.processResult(source);
				return { ...input, content: rewrite('\nstdout:\n', '\nSTDOUT:\n')(source, input.content) };
			}
		};
		const fp = await reviewerFingerprint(CASES, seams);
		onlyMoved(fp, ['probes']);
		expect(movedProbes(fp), 'every process-result probe moves, and only those').toEqual(P_PROBES());
		// ~~⚠ TRUE BY CONSTRUCTION TODAY, AND SAID SO: no case of v1 or v3 is a process result, and the case prompts are built
		// through `materialize.ts`, which no process-result builder reaches. `PQ-2` (design D4) must hand it the seams'
		// `processResult` (`casePromptsOf` says so) — from then on these halves measure what its cases' prompts do.~~
		// ⭐ `JAN-PRQUAL` `PQ-2` (design D4) — HANDED: `casePromptsOf` builds a process-result case through the seams'
		// `processResult`, so these halves MEASURE what a renderer change does to a case prompt — none of v1's moves, and of
		// the current set, case set v4, exactly its fourteen process-result cases' do.
		expect(fp.casePrompts, 'no case of v1 is a process result: none moves').toEqual(BASE.casePrompts);
		expect(CURRENT_PROCESS_RESULTS, 'the arrangement: the current set holds the fourteen').toHaveLength(14);
		expect(movedCasePrompts(await reviewerFingerprint(CURRENT_CASES, seams), BASE_NOW), 'the current set’s process-result cases, and only those').toEqual(
			CURRENT_PROCESS_RESULTS
		);
	});

	it('⭐ THE ARRANGEMENT — P-OVERSIZE-SURROGATE puts a pair astride BOTH ends of its cut: its HEAD gave one half back, its TAIL stepped past one', () => {
		const input = FINGERPRINT_PROBES.find((p) => p.id === 'P-OVERSIZE-SURROGATE')!.input(PRODUCT_SEAMS.criteria, (source) => {
			const k = keptUnits(source);
			const c = headAndTailCut(PRODUCT_SEAMS.processResult(source).content, 'stdout')!;
			expect(
				[c.head.length, c.tail.length],
				`what is kept is ${k} units (it must be 1 mod 4 for both ends to straddle): re-tune the probe’s run (probes.ts — a stderr of n characters moves it by n)`
			).toEqual([Math.ceil(k / 2) - 1, k - (Math.ceil(k / 2) - 1) - 1]);
			return PRODUCT_SEAMS.processResult(source);
		});
		expect(input.content, 'and no half pair reaches the view').not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
	});

	it('⭐ THE ARRANGEMENT — P-OVERSIZE-ROOM-EDGES stands on both edges of a room: its stdout’s HEAD gives a unit back to an ASCII TAIL, and its stderr is cut two units past fitting whole between its fence lines', () => {
		let source: ProcessResultReviewSource | undefined;
		const input = FINGERPRINT_PROBES.find((p) => p.id === 'P-OVERSIZE-ROOM-EDGES')!.input(PRODUCT_SEAMS.criteria, (s) => {
			source = s;
			return PRODUCT_SEAMS.processResult(s);
		});
		const { stdout, stderr } = source!.run;
		const view = input.content;
		expect(viewBudget(input), 'held at CONTENT_MIN, so each room is the run’s and the renderer’s alone').toBe(
			REASONING_REVIEW_BUDGET.CONTENT_MIN
		);
		// STDOUT — the HEAD straddles a pair and gives its unit to the TAIL, which is ASCII and so steps past nothing.
		const k = keptUnits(source!);
		const out = headAndTailCut(view, 'stdout')!;
		expect(
			[out.head.length, out.tail.length],
			`what is kept is ${k} units (⌈k/2⌉ must be odd for the HEAD to straddle a pair): re-tune the probe’s stdout (probes.ts — a leading ASCII character flips it)`
		).toEqual([Math.ceil(k / 2) - 1, k - (Math.ceil(k / 2) - 1)]);
		expect([...out.head].every((ch) => ch.length === 2), 'the HEAD is whole pairs').toBe(true);
		expect(codePoints(out.tail), 'the TAIL is ASCII, past every pair').toBe(out.tail.length);
		expect(tailOf(stdout, Math.floor(k / 2)), 'a TAIL asked for half of what is kept is one unit shorter').toHaveLength(
			out.tail.length - 1
		);
		// STDERR — cut, though its whole block would fit were its two fence lines not counted; and shown whole it would
		// still fit the budget, so the view a whole-fit test that forgot them renders is SENT, and moves the fingerprint.
		const err = roomOf(view, 'stderr', stderr);
		const fence = headAndTailCut(view, 'stderr')!.fence;
		const whole = wholeBlock('stderr', stderr, fence).length;
		const edge = `its whole block is ${whole} units, its room ${err.room}: re-tune STDERR_AT_ITS_EDGE (probes.ts)`;
		expect(whole, `${edge} — cut, as its fence lines count`).toBeGreaterThan(err.room);
		expect(wholeBlock('stderr', stderr, '').length, `${edge} — but whole were they not counted`).toBeLessThanOrEqual(err.room);
		expect(view.length - (err.end - err.start) + whole, `${edge} — and shown whole, still within the budget`).toBeLessThanOrEqual(
			viewBudget(input)
		);
	});

	it('⭐ THE ARRANGEMENT — P-OVERSIZE-STREAMS is this host’s own timeout over two streams that filled the capture: each a capture cut whose TAIL is the end of what was captured, both cut for the review, the room split evenly', () => {
		const B = REASONING_REVIEW_BUDGET;
		let source: ProcessResultReviewSource | undefined;
		const input = FINGERPRINT_PROBES.find((p) => p.id === 'P-OVERSIZE-STREAMS')!.input(PRODUCT_SEAMS.criteria, (s) => {
			source = s;
			return PRODUCT_SEAMS.processResult(s);
		});
		const run = source!.run;
		const view = input.content;
		const b = viewBudget(input);
		expect(b, 'production’s shape: the content budget is the scaffolding’s, above CONTENT_MIN').toBeGreaterThan(B.CONTENT_MIN);
		expect(b, '…and below CONTENT_MAX').toBeLessThan(B.CONTENT_MAX);
		expect(view.split('\n')[0], 'this host’s own timeout: exit null AND TIMED OUT').toMatch(
			/^exit null \(terminated by a signal\) TIMED OUT in \d+ms$/
		);
		expect(view.split('\n')[1], 'an incomplete capture').toMatch(/^\[OUTPUT INCOMPLETE: /);
		const rooms: number[] = [];
		for (const [stream, text] of [
			['stdout', run.stdout],
			['stderr', run.stderr]
		] as const) {
			expect(Buffer.byteLength(text, 'utf8'), `${stream}: it filled the capture`).toBe(65_536);
			const c = headAndTailCut(view, stream)!;
			expect(view.slice(view.lastIndexOf(`\n${stream}:\n`, c.at) + 1, c.at), `${stream}: its capture cut, declared first`).toMatch(
				new RegExp(
					`^${stream}:\\n\\[CUT BY THE CAPTURE: ${stream} — the capture kept 65536 code points of it and removed the stream's last \\d+ UTF-8 bytes, so the TAIL below is the end of what was CAPTURED, not the end of the output\\.\\]\\n$`
				)
			);
			expect([text.startsWith(c.head), text.endsWith(c.tail)], `${stream}: a true HEAD and a true TAIL`).toEqual([true, true]);
			rooms.push(roomOf(view, stream, text).room);
		}
		// ⭐ TWO LARGE STREAMS SPLIT THE ROOM EVENLY (`allocate`, max-min; `REG-F-480`: a stream can no longer vanish
		// behind another): each is over its share, so each is given an equal share — one unit apart at most, the rounding.
		expect(Math.abs(rooms[0]! - rooms[1]!), `the rooms ${rooms.join(' and ')}: split evenly`).toBeLessThanOrEqual(1);
	});

	it('⭐ THE FENCE CHOOSERS ARE HASHED — P-OVERSIZE-FENCES’s view is fenced by `<<<UNTRUSTED-19>>>` and its prompt by `<<<UNTRUSTED-20>>>`, every OVERSIZE-ALL probe’s token steps past the candidate its cut instruction keeps, P-OVERSIZE-ALL’s prompt past the three it plants where P-OVERSIZE-FENCES plants none, and P-FENCES-OTHER-SLICES’s view by `<<<UNTRUSTED-04>>>`, past the same three below it, and its prompt by `<<<UNTRUSTED-05>>>`', () => {
		// ⛔ WHY (`PQ-1`; `REG-F-481`, `REG-F-476`): every probe's view was fenced by `00` and every prompt by `00` or `01`, so
		// the fence-choice branch reached no probe — a chooser that skipped a slice, or a skeleton that read no lookalike,
		// moved no fingerprint and reddened nothing here. `P-OVERSIZE-FENCES` plants `00` to `11`, each where a chooser
		// reads, each spelled through its own family of the skeleton's table or its own rule of the reader the chooser
		// models (`probes.ts` `FENCE_PLANTS`), and the OVERSIZE instruction opens with `00`; so each token below stands where
		// it does only while every plant before it is read. ~~`08` and `09`~~ — the view's own `08`, split by a raw U+2028,
		// was then a candidate no reader saw; a reader may not break a line there (`review-fence.ts` `UNBROKEN_TERMINATORS`),
		// so it is a link of the chain now, beside the class reading, the second reading and the reversed line (`REG-F-481`).
		// ~~`12` and `13`~~ — the view's own `12` stood past one plant per rule of how a code point is read, and ONE plant for
		// every rule of how a slice is read, a line under U+202E that opened the only line of stderr holding a control: a
		// reader that laid out a line under the override alone, or the first such line alone, or only a line a control
		// begins, or broke a laid-out line at every terminator, or began no candidate inside a reading, moved no probe
		// (driven on a disposable copy, each). `12` to `18` stand on a rule each now, `18` on the runs-reversed reading.
		// ⭐ AND P-OVERSIZE-ALL's prompt: no process-result probe planted in the limitations, the narration or the prior
		// findings, so a validator chooser that skipped any of them in a process result's review alone moved no probe
		// (driven). It plants `02` to `04` there, past the instruction's `00` and its view's own `01`.
		const tokensOf = (text: string): string[] => [...new Set(text.split('\n').filter((l) => FENCE_LINE.test(l)))];
		/** A prompt's own token: the line opening its first region — the instruction's, which every framing quotes first. */
		const promptToken = (id: string): string => BASE.probePrompts.get(id)!.split('\n').find((l) => FENCE_LINE.test(l))!;
		expect(tokensOf(inputOf('P-OVERSIZE-FENCES').content), 'the view’s token: past 00 to 18, each planted where it is read').toEqual([
			'<<<UNTRUSTED-19>>>'
		]);
		expect(promptToken('P-OVERSIZE-FENCES'), 'the prompt’s token: past the plants and the view’s own').toBe('<<<UNTRUSTED-20>>>');
		expect(tokensOf(inputOf('P-OVERSIZE-ALL').content), 'P-OVERSIZE-ALL’s view: past the 00 its cut instruction keeps').toEqual([
			'<<<UNTRUSTED-01>>>'
		]);
		for (const [id, token, why] of [
			['G-OVERSIZE-ALL', '<<<UNTRUSTED-01>>>', 'past the 00 its cut instruction keeps'],
			['W-OVERSIZE-ALL', '<<<UNTRUSTED-01>>>', 'past the 00 its cut instruction keeps'],
			['P-OVERSIZE-ALL', '<<<UNTRUSTED-05>>>', 'past the 00 its cut instruction keeps, its view’s own 01, and the 02 to 04 of its limitations, narration and prior findings']
		] as const)
			expect(promptToken(id), `${id}: ${why}`).toBe(token);
		// ⭐ THE ARRANGEMENT: P-OVERSIZE-ALL holds its three where P-OVERSIZE-FENCES holds none, in the order the chain needs.
		const all = promptRegions(BASE.probePrompts.get('P-OVERSIZE-ALL')!);
		expect(
			all.regions.flatMap((r) => {
				const n = /<<<UNTRUSTED-(\d\d)>>>/.exec(regionText(all.lines, r))?.[1];
				return n === undefined ? [] : [[r.slice, n]];
			}),
			'P-OVERSIZE-ALL: the candidates its slices hold, in order'
		).toEqual([
			['the instruction', '00'],
			["the account's limitations", '02'],
			['the narration', '03'],
			['the prior findings', '04']
		]);
		// ⭐ AND THE VIEW'S CHOOSER OVER THE SAME THREE SLICES (`P-FENCES-OTHER-SLICES`): its view is fenced past the
		// instruction's `00` and the `01` to `03` of its limitations, narration and prior findings — so a view chooser that
		// skipped any of the three takes its own — and its prompt past its view's own `04`. ⛔ `P-OVERSIZE-ALL`'s view is
		// fenced by `01`, below every such plant, so a view chooser that skipped them moved no probe (driven on a
		// disposable copy).
		expect(tokensOf(inputOf('P-FENCES-OTHER-SLICES').content), 'P-FENCES-OTHER-SLICES’s view: past the four its other slices hold').toEqual([
			'<<<UNTRUSTED-04>>>'
		]);
		expect(promptToken('P-FENCES-OTHER-SLICES'), 'P-FENCES-OTHER-SLICES’s prompt: past its view’s own 04').toBe('<<<UNTRUSTED-05>>>');
		const other = promptRegions(BASE.probePrompts.get('P-FENCES-OTHER-SLICES')!);
		expect(
			other.regions.flatMap((r) => {
				const n = /<<<UNTRUSTED-(\d\d)>>>/.exec(regionText(other.lines, r))?.[1];
				return n === undefined ? [] : [[r.slice, n]];
			}),
			'P-FENCES-OTHER-SLICES: the candidates its slices hold, in order'
		).toEqual([
			['the instruction', '00'],
			["the account's limitations", '01'],
			['the narration', '02'],
			['the prior findings', '03']
		]);
	});

	it('⭐ THE ARRANGEMENT — P-OVERSIZE-FENCES is in production’s shape; its command line escapes the line separator an argument carries; its account has every field and an empty one, and two of its fields TIE over their share', () => {
		let source: ProcessResultReviewSource | undefined;
		const input = FINGERPRINT_PROBES.find((x) => x.id === 'P-OVERSIZE-FENCES')!.input(PRODUCT_SEAMS.criteria, (s) => {
			source = s;
			return PRODUCT_SEAMS.processResult(s);
		});
		const p = BASE.probePrompts.get('P-OVERSIZE-FENCES')!;
		expect(
			[input.observedToolCalls?.calls?.map((c) => c.nameProvenance), input.narration, 'prior' in input],
			'production’s shape: one call the host minted, no narration, no prior'
		).toEqual([['MINTED_BY_HOST'], undefined, false]);
		expect(
			[...p.matchAll(/\[CUT FOR THIS REVIEW: (.+?) — /g)].map((m) => m[1]),
			'cut: stdout, at the review layer, and the two tied fields of the account'
		).toEqual(['stdout', "the account's assumptions", "the account's residual uncertainty"]);
		// ⭐ THE COMMAND LINE'S ENCODER (`REG-F-481`, `REG-F-482`): an argument carries EVERY break `jsonLine` escapes —
		// U+2028, U+0085 and U+2029, which `JSON.stringify` leaves raw, each a line break to some readers — and the view
		// shows each as its six-character escape, none raw: so an encoder that escaped any one of them alone moves this probe.
		const argv = source!.run.argv;
		expect(
			JSON_LINE_BREAKS.filter((c) => argv.some((a) => a.includes(String.fromCharCode(c)))),
			'the arrangement: an argument carries every break'
		).toEqual(JSON_LINE_BREAKS);
		const commandLine = viewParts(input.content).parts.filter((x) => x.slice === 'the command line');
		expect(commandLine.map((x) => x.text), 'the command line: JSON, every break escaped (this file’s own spelling)').toEqual([
			jsonLineLeaving(0)(argv)
		]);
		expect(
			JSON_LINE_BREAKS.filter((c) => commandLine[0]!.text.includes(String.fromCharCode(c))),
			'no break raw in the command line'
		).toEqual([]);
		// ⭐ EVERY FIELD AND AN EMPTY ONE: the empty list is the host's line, never a region.
		const account = input.rationale!;
		expect(
			[account.rationale !== '', account.assumptions.length > 0, account.limitations.length, account.residualUncertainty.length > 0],
			'the account: a rationale, two lists, and an empty one'
		).toEqual([true, true, 0, true]);
		expect(p.split('\n'), 'the empty list is a host line').toContain('Limitations the producer declares: (none declared)');
		// ⭐ THE TIE (`allocate`, which the account's fields and the view's slices are both shared by): the two lists NEED the
		// same room, both are cut, and what the rationale leaves them is odd — so the EARLIER field, by the fields' own
		// order, is given the one unit less. Each room is read back from the prompt: its label and its newline, the field's
		// two fence lines and the two newlines around its value, the declaration's reserve at the widest numbers, and the
		// bytes kept (ASCII here). ⭐ D7: each list's value is its items after `  - ` (~~`JSON.stringify(list)`~~), under
		// HEAD's label (~~"…, as a JSON array of strings:"~~).
		const lines = p.split('\n');
		const field = (label: string, name: string, list: readonly string[]) => {
			const at = lines.indexOf(label);
			expect(lines[at + 1]!.startsWith(`${CUT_DECLARED}${name} — `), `${name}: cut`).toBe(true);
			const fence = lines[at + 2]!;
			const bytes = lines.slice(at + 3, lines.indexOf(fence, at + 3)).join('\n');
			const value = bulleted(list);
			const total = codePoints(value);
			const fenced = 2 * FENCE_LENGTH + 3;
			return {
				need: label.length + value.length + fenced,
				room: label.length + fenced + headCutDeclaration(name, total, total, total).length + 1 + bytes.length
			};
		};
		const a = field('Assumptions relied on:', "the account's assumptions", account.assumptions);
		const r = field('Residual uncertainty:', "the account's residual uncertainty", account.residualUncertainty);
		const retune = `needs ${a.need} and ${r.need}, rooms ${a.room} and ${r.room}: re-tune TIED_ITEM, or the rationale's parity (probes.ts)`;
		expect(a.need, `${retune} — the two lists need the same room`).toBe(r.need);
		expect([a.room, r.room], `${retune} — the tie gives the earlier field the one unit less`).toEqual([a.room, a.room + 1]);
	});

	it('⭐ the capture line counts CODE POINTS — P-STDOUT-CAPTURE-CUT’s and P-STDERR-CAPTURE-CUT’s streams each hold an astral character, so a count in UTF-16 units of either moves one', () => {
		// ⛔ WHY (`PQ-1`; `REG-F-480`, `REG-F-476`): every capture-cut probe's stream was ASCII, so a capture line that counted
		// UTF-16 units moved no probe, and reddened nothing here; and while only stdout held one, a count in units of stderr
		// alone moved none (driven on a disposable copy).
		for (const [id, stream] of [
			['P-STDOUT-CAPTURE-CUT', 'stdout'],
			['P-STDERR-CAPTURE-CUT', 'stderr']
		] as const) {
			let text = '';
			const input = FINGERPRINT_PROBES.find((x) => x.id === id)!.input(PRODUCT_SEAMS.criteria, (s) => {
				text = s.run[stream];
				return PRODUCT_SEAMS.processResult(s);
			});
			const points = [...text].length;
			expect(points, `${id}: the arrangement — an astral character, so its code points are one fewer than its units`).toBe(text.length - 1);
			expect(input.content, `${id}: the capture line states the code points kept`).toContain(
				`[CUT BY THE CAPTURE: ${stream} — the capture kept ${points} code points of it and removed`
			);
		}
	});

	it.each(Object.keys(BRANCH_CHANGES))(
		'⭐ a change confined to ONE branch of the renderer — %s — moves `probes` through the probes that take it, and no case prompt of v1; of the current set, exactly the process-result cases that take it (PQ-2)',
		async (branch) => {
			const b = BRANCH_CHANGES[branch]!;
			const fp = await reviewerFingerprint(CASES, { ...PRODUCT_SEAMS, processResult: changedIn(b) });
			onlyMoved(fp, ['probes']);
			const moved = movedProbes(fp);
			// ⭐ `PQ-1` — EXACTLY the probes that take it, unless shared by design: a probe drifting into the branch, or out
			// of it, is a different set (`branchDiscrepancies`; its CONTROL is the row below).
			expect(branchDiscrepancies(moved, b), `the probes that moved: ${moved.join(', ')}`).toEqual([]);
			expect(moved.every((id) => id.startsWith('P-')), 'only process-result probes move').toBe(true);
			expect(fp.casePrompts, 'no case prompt of v1 moves').toEqual(BASE.casePrompts);
			// ⭐ `JAN-PRQUAL` `PQ-2` (design D4) — AND OF THE CURRENT SET, EXACTLY THE PROCESS-RESULT CASES WHOSE RUN TAKES THE
			// BRANCH: their run literals are rendered through the same seam (`casePromptsOf`), so the branch's own `takes`,
			// asked of each case's run and of the view the product renders for it, names the case prompts that must move —
			// P-RR-07-CUT for the cuts it carries, every other process-result case for the clean branch, none for the rest.
			const takers = CURRENT_CASES.filter(
				(c) => c.arm === 'PROCESS_RESULT' && b.takes(c.input.run, caseReviewInput(c, PRODUCT_SEAMS.criteria).content)
			).map((c) => c.id);
			expect(
				movedCasePrompts(await reviewerFingerprint(CURRENT_CASES, { ...PRODUCT_SEAMS, processResult: changedIn(b) }), BASE_NOW),
				'the current set’s case prompts that move: exactly the process-result cases that take the branch'
			).toEqual(takers);
		},
		60_000
	);

	it('⭐ CONTROL — the per-branch check is EXACT: a probe that drifted into a branch, or out of it, is named; a shared branch asks only for its own', () => {
		// The drift `P-TIMED-OUT` would make exiting null (it would then take the signal branch too), and the loss a
		// neutralised `P-SIGNAL` would make — each must be reported, or the rows above could not see either.
		const signal = BRANCH_CHANGES.signal!;
		expect(signal.shared, 'the arrangement: the signal branch is not shared by design').toBeUndefined();
		expect(branchDiscrepancies(['P-SIGNAL', 'P-TIMED-OUT', 'P-OVERSIZE-STREAMS'], signal)).toEqual([
			'P-TIMED-OUT moved, and the row does not name it'
		]);
		expect(branchDiscrepancies(['P-OVERSIZE-STREAMS'], signal)).toEqual(['P-SIGNAL takes the branch, and did not move']);
		expect(branchDiscrepancies(['P-SIGNAL', 'P-OVERSIZE-STREAMS'], signal), 'and the exact set passes').toEqual([]);
		const clean = BRANCH_CHANGES.clean!;
		expect(branchDiscrepancies(['P-CLEAN', 'P-PRODUCTION'], clean), 'a shared branch: other probes may move with it').toEqual([]);
		expect(branchDiscrepancies(['P-PRODUCTION'], clean), '…but not without the one named for it').toEqual([
			'P-CLEAN takes the branch, and did not move'
		]);
		// ⭐ AND WHICH BRANCHES ARE SHARED IS ITSELF PINNED, WHOLE: `shared` turns a row's exact check back into "among", so a
		// row marked shared that is not shared by design would let a probe drift into its branch unseen.
		expect(sharedDiscrepancies(BRANCH_CHANGES), 'only the branches every view of a kind shares').toEqual([]);
		// CONTROL: an exclusive row marked shared — the timed-out branch — is named, and so is a shared one left unmarked.
		const timedOut = BRANCH_CHANGES['timed out']!;
		expect(sharedDiscrepancies({ ...BRANCH_CHANGES, 'timed out': { ...timedOut, shared: true } })).toEqual([
			'timed out is marked shared, and is not shared by design'
		]);
		const { shared: _shared, ...unmarked } = clean;
		expect(sharedDiscrepancies({ ...BRANCH_CHANGES, clean: unmarked })).toEqual(['clean is shared by design, and is not marked so']);
	});

	it('⭐ P-PRODUCTION is in production’s EXACT shape — `runProcessResultFloor`’s: no narration, no prior, OBSERVED with one call — and no P- probe but P-OVERSIZE-ALL and P-FENCES-OTHER-SLICES carries a narration or a prior', () => {
		const input = FINGERPRINT_PROBES.find((p) => p.id === 'P-PRODUCTION')!.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult);
		// The keys and their order are the floor's (`review-input.test.ts`'s production-shape pin): the narration a KEY,
		// `undefined`, as the floor always passed it; no prior key at all.
		expect(Object.keys(input)).toEqual(['criteria', 'framing', 'prompt', 'content', 'rationale', 'observedToolCalls', 'narration']);
		expect(input.narration).toBeUndefined();
		expect(input.rationale, 'the account declared').toBeDefined();
		expect(input.observedToolCalls).toEqual({
			observation: 'OBSERVED',
			calls: [{ ordinal: 1, nameProvenance: 'MINTED_BY_HOST', toolName: 'run_command', outcome: 'COMPLETED' }],
			observedCount: 1,
			recordedLimit: 32
		});
		const p = BASE.probePrompts.get('P-PRODUCTION')!;
		expect(p).toContain('(trace data, not its private chain-of-thought):\n(none recorded)\n');
		expect(p).not.toContain('A PREVIOUS review flagged');
		// ⭐ `PQ-1` — AND OVER THE RUN THAT MAKES IT PRODUCTION'S: a FAILING suite, its warning on stderr. Built over the clean
		// run it is `P-CLEAN` byte for byte — the same builder input, key for key — and the set holds no failing run in
		// production's shape at all, while nothing else moves.
		expect(p, 'the prompt carries the view whole').toContain(`\n${input.content}\n`);
		expect(p, 'a failing run: exit 1').toContain('\nexit 1 in ');
		expect(input.content.split('\n')[0], 'a failing run: exit 1, first').toMatch(/^exit 1 in \d+ms$/);
		const stderrAt = input.content.indexOf('\nstderr:\n');
		const fence = input.content.slice(stderrAt + 9, input.content.indexOf('\n', stderrAt + 9));
		expect(fence, 'stderr is shown whole between fence lines').toMatch(/^<<<UNTRUSTED-\d\d>>>$/);
		const stderrShown = input.content.slice(stderrAt + 9 + fence.length + 1, input.content.indexOf(`\n${fence}`, stderrAt + 9 + fence.length));
		expect(stderrShown.trim(), 'and it is not empty: production’s failing run warns on stderr').not.toBe('');
		// ⭐ NO TWO PROBES SEND ONE PROMPT: a duplicate hashes nothing its twin does not, so a probe that collapsed into
		// another would leave a branch unprobed while every count above still held.
		expect(BASE.probePrompts.size, 'one prompt per probe').toBe(FINGERPRINT_PROBES.length);
		expect(samePrompt(BASE.probePrompts), 'probes sending one and the same prompt').toEqual([]);
		// CONTROL: the collapse this limb exists for — `P-PRODUCTION` sent over the clean run is `P-CLEAN`'s prompt — is found.
		const collapsed = new Map(
			[...BASE.probePrompts].map(([id, sent]) => [id, id === 'P-PRODUCTION' ? BASE.probePrompts.get('P-CLEAN')! : sent] as const)
		);
		expect(samePrompt(collapsed), 'CONTROL: a probe collapsed into another is found').toEqual([['P-CLEAN', 'P-PRODUCTION']]);
		// ⭐ The two that do, on purpose: the validator's chooser and the view's over the two slices production never fills.
		for (const id of P_PROBES().filter((x) => x !== 'P-OVERSIZE-ALL' && x !== 'P-FENCES-OTHER-SLICES')) {
			const i = FINGERPRINT_PROBES.find((x) => x.id === id)!.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult);
			expect([i.narration, 'prior' in i], `${id}: no narration, no prior — production sends neither`).toEqual([undefined, false]);
		}
	});

	it('⭑ CONTROL — the changed choosers are the product’s, but for the one rule each breaks: handed what it stopped reading, each renders the product’s view byte for byte', () => {
		const unfencedViews: string[] = [];
		for (const id of P_PROBES()) {
			let source: ProcessResultReviewSource | undefined;
			const input = FINGERPRINT_PROBES.find((x) => x.id === id)!.input(PRODUCT_SEAMS.criteria, (s) => {
				source = s;
				return PRODUCT_SEAMS.processResult(s);
			});
			expect(renderProcessResultReview(source!.run, viewBudget(input), otherUntrustedOf(input)), `${id}: the renderer, called as the builder calls it`).toBe(
				input.content
			);
			// ⭐ `PQ-1` — a view rendered unfenced has no token to read back (`P-NO-FENCE`), and the rules pass it through.
			if (unfenced(source!, input.content)) unfencedViews.push(id);
			else expect(rechosen(input.content, otherUntrustedOf(input), () => true), `${id}: every part read back, the same token`).toBe(input.content);
		}
		expect(unfencedViews, 'the one probe whose view is rendered unfenced').toEqual(['P-NO-FENCE']);
	});

	it.each(Object.keys(CHOOSER_RULES))(
		'⭐ a view chooser that stops reading %s moves `probes` through exactly the probes that plant a candidate there, and no case prompt — of v1, nor of the current set, whose process results a view chooser builds (PQ-2)',
		async (rule) => {
			const r = CHOOSER_RULES[rule]!;
			const seams: FingerprintSeams = { ...PRODUCT_SEAMS, processResult: r.builder };
			const fp = await reviewerFingerprint(CASES, seams);
			onlyMoved(fp, ['probes']);
			expect(movedProbes(fp), 'the probes whose token that slice decides').toEqual(r.moves);
			expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
			// ⭐ `PQ-2` (design D4) — and of the current set, measured: no process-result case holds a candidate a chooser
			// that skips this slice would then take.
			expect(await movedNow(seams), 'no case prompt of the current set moves').toEqual([]);
		},
		120_000
	);

	it('⭐ THE ARRANGEMENT — in every framing, a probe whose account has every field, and one whose account has an empty list', () => {
		for (const framing of ['G', 'W', 'P']) {
			const accounts = FINGERPRINT_PROBES.filter((x) => x.id.startsWith(`${framing}-`)).flatMap((x) => {
				const r = x.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult).rationale;
				return r ? [r] : [];
			});
			expect(accounts.some((r) => ACCOUNT_LISTS.every((k) => r[k].length > 0)), `${framing}: an account with every field`).toBe(true);
			expect(accounts.some((r) => ACCOUNT_LISTS.some((k) => r[k].length === 0)), `${framing}: an account with an empty list`).toBe(true);
		}
	});

	it.each(Object.keys(HOST_LINE_CHANGES))(
		'⭐ a validator that quotes one of its own lines — %s — moves `probes` through exactly the probes whose input carries it',
		async (name) => {
			const c = HOST_LINE_CHANGES[name]!;
			const fp = await reviewerFingerprint(CASES, {
				...PRODUCT_SEAMS,
				validator: (print) => PRODUCT_SEAMS.validator((p) => print(c.change(p)))
			});
			onlyMoved(fp, ['probes']);
			const carrying = FINGERPRINT_PROBES.filter((x) => c.carries(x.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult))).map(
				(x) => x.id
			);
			expect(movedProbes(fp), 'the probes whose input carries it').toEqual(carrying);
			expect([...new Set(carrying.map((id) => id[0]))], 'in every framing that renders it').toEqual(c.framings);
		},
		60_000
	);

	it('⭐ THE VALIDATOR’S CHOOSER IS HASHED IN EVERY FRAMING — G-OVERSIZE-FENCES’s prompt is fenced by `<<<UNTRUSTED-08>>>`, past a candidate in each of its eight slices; W-FENCES’s by `<<<UNTRUSTED-07>>>`, past a candidate in each of its seven; G-OVERSIZE-CONTENT’s and W-OVERSIZE-CONTENT’s by `<<<UNTRUSTED-01>>>`, past the candidate the HEAD of their cut content keeps; and P-FENCE-AT-THE-LAST’s view by `<<<UNTRUSTED-98>>>` and its prompt by `<<<UNTRUSTED-99>>>`, the LAST candidate', () => {
		// ⛔ WHY (`PQ-1`; `REG-F-481`, `REG-F-476`): `P-OVERSIZE-FENCES` plants in every slice a process result's prompt carries,
		// and no probe planted in the narration, the prior findings, a graph or a work product — so a validator chooser that
		// skipped one of them moved no fingerprint; and no token was past the tenth candidate, so a chooser that tried ten
		// refused nothing a probe sent (driven on a disposable copy). Each token below stands where it does only while every
		// plant before it is read. ~~`P-FENCE-PAST-TEN`, its view fenced by `10` and its prompt by `11`~~ — a chooser that
		// tried any number of candidates from twelve to ninety-nine refused nothing it sent (driven); at the LAST candidate,
		// a chooser that tries any number short of a hundred refuses it. ~~W-FENCES fenced by `02`, past its instruction's
		// and its answer's~~ — a chooser that skipped a work product's account or its prior findings, and no other
		// framing's, moved no probe (driven); it plants in each of its seven slices now.
		const promptToken = (id: string): string => BASE.probePrompts.get(id)!.split('\n').find((l) => FENCE_LINE.test(l))!;
		const viewToken = (id: string): string => inputOf(id).content.split('\n').find((l) => FENCE_LINE.test(l))!;
		for (const [id, token] of [
			['G-OVERSIZE-CONTENT', '<<<UNTRUSTED-01>>>'],
			['G-OVERSIZE-FENCES', '<<<UNTRUSTED-08>>>'],
			['W-OVERSIZE-CONTENT', '<<<UNTRUSTED-01>>>'],
			['W-FENCES', '<<<UNTRUSTED-07>>>'],
			['P-FENCE-AT-THE-LAST', '<<<UNTRUSTED-99>>>']
		] as const)
			expect(promptToken(id), `${id}: the prompt’s token`).toBe(token);
		// ⭐ THE ARRANGEMENT (`PQ-1`; `REG-F-481`): each content-only probe's content is CUT, and the HEAD its cut keeps holds
		// the first candidate — so a chooser that skipped a cut content, and read a whole one, would fence with `00`.
		for (const id of ['G-OVERSIZE-CONTENT', 'W-OVERSIZE-CONTENT']) {
			const r = promptRegions(BASE.probePrompts.get(id)!);
			const content = r.regions.filter((x) => x.slice === 'the content');
			expect(
				content.map((x) => [x.cut, regionText(r.lines, x).includes('<<<UNTRUSTED-00>>>')]),
				`${id}: one content region, cut, its kept HEAD holding 00`
			).toEqual([[true, true]]);
		}
		expect(viewToken('P-FENCE-AT-THE-LAST'), 'P-FENCE-AT-THE-LAST’s view: past the ninety-eight candidates its stdout prints').toBe(
			'<<<UNTRUSTED-98>>>'
		);
		// ⭐ THE ARRANGEMENT: each slice of the graph holds its candidate, in the order the chain needs.
		const { lines, regions } = promptRegions(BASE.probePrompts.get('G-OVERSIZE-FENCES')!);
		expect(
			regions.map((r) => [r.slice, /<<<UNTRUSTED-(\d\d)>>>/.exec(regionText(lines, r))?.[1]]),
			'G-OVERSIZE-FENCES: one candidate in each slice, 00 to 07'
		).toEqual([
			['the instruction', '00'],
			['the content', '01'],
			["the account's rationale", '02'],
			["the account's assumptions", '03'],
			["the account's limitations", '04'],
			["the account's residual uncertainty", '05'],
			['the narration', '06'],
			['the prior findings', '07']
		]);
		// ⭐ …and each slice of the work product, its narration none (`workProductReviewInput` sends none).
		const wp = promptRegions(BASE.probePrompts.get('W-FENCES')!);
		expect(
			wp.regions.map((r) => [r.slice, /<<<UNTRUSTED-(\d\d)>>>/.exec(regionText(wp.lines, r))?.[1]]),
			'W-FENCES: one candidate in each slice, 00 to 06'
		).toEqual([
			['the instruction', '00'],
			['the content', '01'],
			["the account's rationale", '02'],
			["the account's assumptions", '03'],
			["the account's limitations", '04'],
			["the account's residual uncertainty", '05'],
			['the prior findings', '06']
		]);
	});

	it('⭐ THE ARRANGEMENT — G-OVERSIZE-FENCES carries EVERY break `jsonLine` escapes at each call site that encodes it — U+2028, U+0085 and U+2029 in a node’s name and in a prior finding, each escaped in its region — and in an assumption, raw in its region alone since design §9.3 D7; and its limitations alone are cut', () => {
		// ⛔ WHY (`PQ-1`; `REG-F-481`, `REG-F-476`): each site carried ONE break, so a site that escaped that break alone, and
		// left the other two raw — a raw line break inside a line of JSON, the forging path `jsonLine` closed — moved no
		// probe (driven on a disposable copy, at each of the four sites). Every break is planted at every site now.
		// ⭐ DESIGN §9.3 D7 RETIRED ONE OF THOSE SITES: "the one-line JSON encoder no longer applies to the lists", so the
		// assumption's breaks reach the prompt RAW — the agent's own words, inside the assumptions' region, as the rationale's
		// prose always has. ~~each escaped in its region, none raw in the prompt~~: what holds now is that every raw break
		// stands inside that region, none on a host line, and the chooser reads the region as carried.
		const input = FINGERPRINT_PROBES.find((x) => x.id === 'G-OVERSIZE-FENCES')!.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult);
		const p = BASE.probePrompts.get('G-OVERSIZE-FENCES')!;
		const raw = (text: string) => JSON_LINE_BREAKS.filter((c) => text.includes(String.fromCharCode(c)));
		expect(
			[raw(JSON.stringify(JSON.parse(input.content))), raw(JSON.stringify(input.rationale!.assumptions)), raw(JSON.stringify(input.prior!.gaps))],
			'the arrangement: every break in each of the three call sites’ values'
		).toEqual([JSON_LINE_BREAKS, JSON_LINE_BREAKS, JSON_LINE_BREAKS]);
		const { lines, regions } = promptRegions(p);
		const text = (slice: string) => regionText(lines, regions.find((r) => r.slice === slice)!);
		expect(
			[text('the content'), text("the account's assumptions"), text('the prior findings')],
			'each region: its value as `jsonLine` encodes it — and the assumptions as D7 serializes them, their breaks raw'
		).toEqual([input.content, bulleted(input.rationale!.assumptions), jsonLine(input.prior!.gaps)]);
		const withoutTheAssumptions = [...lines.slice(0, regions.find((r) => r.slice === "the account's assumptions")!.from), ...lines.slice(regions.find((r) => r.slice === "the account's assumptions")!.to)].join('\n');
		expect([raw(p), raw(withoutTheAssumptions)], 'every raw break in the prompt, and none outside the assumptions’ region').toEqual([JSON_LINE_BREAKS, []]);
		expect(
			[...p.matchAll(/\[CUT FOR THIS REVIEW: (.+?) — /g)].map((m) => m[1]),
			'cut: the account’s limitations, alone'
		).toEqual(["the account's limitations"]);
	});

	it('⭑ CONTROL — the validator’s chooser read back: every region of every probe’s prompt, and every case’s, re-chosen over, is the product’s prompt byte for byte', async () => {
		const fp = await reviewerFingerprint(CASES, { ...PRODUCT_SEAMS, validator: validatorPrinting((p, input) => revalidated(p, input, () => true)) });
		expect(fp.components, 'nothing moves').toEqual(BASE.components);
		expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
		expect(
			(await reviewerFingerprint(CURRENT_CASES, { ...PRODUCT_SEAMS, validator: validatorPrinting((p, input) => revalidated(p, input, () => true)) })).casePrompts,
			'nor any of the current set'
		).toEqual(BASE_NOW.casePrompts);
	}, 60_000);

	it.each(Object.keys(VALIDATOR_CHOOSER_RULES))(
		'⭐ a validator chooser that stops reading %s moves `probes` through exactly the probes that plant a candidate there, ~~and no case prompt~~ and, of the case prompts, none of v1’s and of the current set exactly those the rule names — the fourteen process results’ where it stops reading their view (PQ-2)',
		async (rule) => {
			const r = VALIDATOR_CHOOSER_RULES[rule]!;
			const seams: FingerprintSeams = {
				...PRODUCT_SEAMS,
				validator: validatorPrinting((p, input) => revalidated(p, input, (s, cut) => r.kept(s, input.framing, cut)))
			};
			const fp = await reviewerFingerprint(CASES, seams);
			onlyMoved(fp, ['probes']);
			expect(movedProbes(fp), 'the probes whose token that slice decides').toEqual(r.moves);
			expect([...new Set(r.moves.map((id) => id[0]))], 'in every framing that carries the slice').toEqual(r.framings);
			expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
			// ⭐ `PQ-2` (design D4) — AND OF THE CURRENT SET, EXACTLY THE CASE PROMPTS THE RULE NAMES: measured over case set
			// v4, where "no case prompt" was false of the view's rule (all fourteen process results move).
			expect(await movedNow(seams), 'the case prompts of the current set the rule moves').toEqual(r.casesNow ?? []);
		},
		120_000
	);

	it.each(Object.keys(LIST_SERIALIZATION_CHANGES))(
		'⭐ design §9.3 D7 — %s moves `probes` through exactly the probes whose prompt shows a list whole, in every framing — and exactly the case prompts whose case carries a list, of v1 and of the current set (PQ-2)',
		async (change) => {
			const as = LIST_SERIALIZATION_CHANGES[change]!;
			const seams: FingerprintSeams = { ...PRODUCT_SEAMS, validator: validatorPrinting((p) => listsReserialized(p, as)) };
			const fp = await reviewerFingerprint(CASES, seams);
			onlyMoved(fp, ['probes']);
			const showing = showingAListWhole();
			expect(movedProbes(fp), 'the probes whose prompt shows a list whole').toEqual(showing);
			expect([...new Set(showing.map((id) => id[0]))], 'in every framing').toEqual(['G', 'W', 'P']);
			// ⭐ A CASE PROMPT MOVES TOO, unlike a renderer change: every prompt with an account carries its lists so (D7 moved
			// every case prompt). Exactly the cases whose account holds a list — every case is seen whole, so none is cut.
			const carrying = CASES.filter((c) => {
				const account = caseReviewInput(c, PRODUCT_SEAMS.criteria).rationale;
				return account !== undefined && ACCOUNT_LISTS.some((k) => account[k].length > 0);
			}).map((c) => c.id);
			expect(carrying.length, 'the arrangement: a case carries a list').toBeGreaterThan(0);
			expect(
				CASES.filter((c) => fp.casePrompts.get(c.id)?.initial !== BASE.casePrompts.get(c.id)?.initial).map((c) => c.id),
				'the case prompts that move: exactly those whose case carries a list'
			).toEqual(carrying);
			// ⭐ `PQ-2` (design D4) — and of the current set: exactly its cases whose account carries a list, the process
			// results among them (each shows its lists whole, the cut case's too).
			const carryingNow = CURRENT_CASES.filter((c) => {
				const account = caseReviewInput(c, PRODUCT_SEAMS.criteria).rationale;
				return account !== undefined && ACCOUNT_LISTS.some((k) => account[k].length > 0);
			}).map((c) => c.id);
			expect(carryingNow.filter((id) => CURRENT_PROCESS_RESULTS.includes(id)), 'the arrangement: every process result carries a list').toEqual(
				CURRENT_PROCESS_RESULTS
			);
			expect(await movedNow(seams), 'the case prompts of the current set that move: exactly those whose case carries a list').toEqual(
				carryingNow
			);
		},
		120_000
	);

	it.each(Object.keys(D7_LAYOUT_CHANGES))(
		'⭐ design §9.3 D7 — %s moves `probes` through exactly the probes whose account it touches, in every framing — and exactly the case prompts whose case carries it, of v1 and of the current set (PQ-2)',
		async (name) => {
			const layout = D7_LAYOUT_CHANGES[name]!;
			const seams: FingerprintSeams = { ...PRODUCT_SEAMS, validator: (print) => PRODUCT_SEAMS.validator((p) => print(layout.change(p))) };
			const fp = await reviewerFingerprint(CASES, seams);
			onlyMoved(fp, ['probes']);
			const carrying = FINGERPRINT_PROBES.filter((x) => layout.carries(x.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult)))
				.map((x) => x.id)
				.filter((id) => sendingAPrompt().includes(id));
			expect(movedProbes(fp), 'the probes whose account it touches').toEqual(carrying);
			expect([...new Set(carrying.map((id) => id[0]))], 'in every framing').toEqual(['G', 'W', 'P']);
			const cases = CASES.filter((k) => layout.carries(caseReviewInput(k, PRODUCT_SEAMS.criteria))).map((k) => k.id);
			expect(cases.length, 'the arrangement: a case carries it').toBeGreaterThan(0);
			expect(
				CASES.filter((k) => fp.casePrompts.get(k.id)?.initial !== BASE.casePrompts.get(k.id)?.initial).map((k) => k.id),
				'the case prompts that move: exactly those whose case carries it'
			).toEqual(cases);
			// ⭐ `PQ-2` (design D4) — and of the current set: exactly its cases that carry it.
			expect(await movedNow(seams), 'the case prompts of the current set that move: exactly those whose case carries it').toEqual(
				CURRENT_CASES.filter((k) => layout.carries(caseReviewInput(k, PRODUCT_SEAMS.criteria))).map((k) => k.id)
			);
		},
		120_000
	);

	it.each(AssuranceSeveritySchema.options)(
		'⭐ design §9.3 D8 — the stakes %s written otherwise beside its criterion moves `probes` through exactly the probes whose prompt shows it, in every framing — and every case prompt exactly when the floor policy declares it, of v1 and of the current set (PQ-2)',
		async (stakes) => {
			const showing = showingStakes(stakes);
			expect([...new Set(showing.map((id) => id[0]))], 'the arrangement: it is shown in every framing').toEqual(['G', 'W', 'P']);
			const seams: FingerprintSeams = {
				...PRODUCT_SEAMS,
				validator: (print) => PRODUCT_SEAMS.validator((p) => print(p.split(stakesMark(stakes)).join(stakesMark(stakes.toLowerCase()))))
			};
			const fp = await reviewerFingerprint(CASES, seams);
			onlyMoved(fp, ['probes']);
			expect(movedProbes(fp), 'the probes whose prompt shows it').toEqual(showing);
			const declared = PRODUCT_SEAMS.criteria.some((c) => c.severityIfNotMet === stakes);
			for (const c of CASES)
				expect(fp.casePrompts.get(c.id)!.initial !== BASE.casePrompts.get(c.id)!.initial, `${c.id}: moves exactly when the floor policy declares ${stakes}`).toBe(
					declared
				);
			// ⭐ `PQ-2` (design D4) — and every case prompt of the current set, exactly when the policy declares it. ⚠ The
			// substitution models the change over the WHOLE prompt, quoted slices included, so a case whose own text held a
			// stakes mark would move here too where the policy declares no such stakes — a false red, never a false green, in
			// this half as in the v1 half above it; no case of either set holds a stakes mark today.
			expect(await movedNow(seams), `the case prompts of the current set that move: every one exactly when the floor policy declares ${stakes}`).toEqual(
				declared ? CURRENT_CASES.map((c) => c.id) : []
			);
		},
		120_000
	);

	it('⭐ design §9.3 D8 — a rubric that writes EVERY stakes as BLOCKING, the policy’s unread, moves `probes` through G-STAKES, W-STAKES and P-STAKES alone, and no case prompt: every floor criterion declares BLOCKING', async () => {
		// ⛔ WHY (design §9.3 D8; `ASR-4`: the criteria are the policy's own): the probes and the cases are handed the floor
		// policy's criteria, every one BLOCKING, so a rubric that ignored the policy and wrote BLOCKING beside each moved no
		// probe and no case prompt (driven on a disposable copy). The three stakes probes are the only place it shows.
		expect(PRODUCT_SEAMS.criteria.every((c) => c.severityIfNotMet === 'BLOCKING'), 'the arrangement: every floor criterion declares BLOCKING').toBe(true);
		const seams: FingerprintSeams = {
			...PRODUCT_SEAMS,
			validator: (print) =>
				PRODUCT_SEAMS.validator((p) => print(AssuranceSeveritySchema.options.reduce((q, s) => q.split(stakesMark(s)).join(stakesMark('BLOCKING')), p)))
		};
		const fp = await reviewerFingerprint(CASES, seams);
		onlyMoved(fp, ['probes']);
		expect(movedProbes(fp), 'the probes handed every stakes').toEqual(['G-STAKES', 'W-STAKES', 'P-STAKES']);
		expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
		// ~~⭐ `PQ-2` (design D4) — nor any of the current set: its cases are handed the floor policy's criteria too.~~
		// ⭐ Restated (`PQ-2`, design D4; design §9.3 D8) — nor any of the current set, whose cases are handed the floor
		// policy's criteria too, every one BLOCKING, so no line of the rubric changes for them. ⚠ But a current case CAN
		// redden this half: the row models the rubric change as a substitution over the WHOLE prompt, quoted slices
		// included, so a case whose own text holds a stakes mark other than BLOCKING (`[if unmet: ADVISORY]` in an account,
		// say; a BLOCKING mark is rewritten to itself) moves under it, though a real rubric change, which rewrites only the
		// rubric's own lines, would not move it — a false red, never a false green. No case of the current set holds a stakes
		// mark today.
		expect(await movedNow(seams), 'no case prompt of the current set moves').toEqual([]);
	}, 120_000);

	it.each(Object.keys(D8_PHRASES))(
		'⭐ design §9.3 D8 — %s, changed, moves `probes` through every probe the validator sends a prompt for, and every case prompt — of v1, and of the current set (PQ-2)',
		async (name) => {
			const [from, to] = D8_PHRASES[name]!;
			for (const id of sendingAPrompt())
				expect(BASE.probePrompts.get(id)!.split(from).length - 1, `${id}: the arrangement — the phrase, once`).toBe(1);
			const seams: FingerprintSeams = { ...PRODUCT_SEAMS, validator: (print) => PRODUCT_SEAMS.validator((p) => print(p.replace(from, () => to))) };
			const fp = await reviewerFingerprint(CASES, seams);
			onlyMoved(fp, ['probes']);
			expect(movedProbes(fp), 'every probe the validator sends a prompt for').toEqual(sendingAPrompt());
			for (const c of CASES)
				for (const role of ['initial', 'repair'] as const)
					expect(fp.casePrompts.get(c.id)![role], `${c.id}: its ${role} prompt moves`).not.toBe(BASE.casePrompts.get(c.id)![role]);
			// ⭐ `PQ-2` (design D4) — and every case prompt of the current set, each its initial and its repair.
			const now = await reviewerFingerprint(CURRENT_CASES, seams);
			for (const c of CURRENT_CASES)
				for (const role of ['initial', 'repair'] as const)
					expect(now.casePrompts.get(c.id)![role], `the current set’s ${c.id}: its ${role} prompt moves`).not.toBe(BASE_NOW.casePrompts.get(c.id)![role]);
		},
		120_000
	);

	it('⭑ CONTROL — the list re-serializer read back: D7’s own serialization, re-applied, is the product’s prompt byte for byte, and a list holding a line break is read as ONE item', () => {
		for (const id of showingAListWhole()) {
			const p = BASE.probePrompts.get(id)!;
			expect(listsReserialized(p, bulleted), `${id}: D7’s items, read back and re-written`).toBe(p);
		}
		const F = '<<<UNTRUSTED-00>>>';
		const p = [`x`, F, 'the instruction', F, `${ACCOUNT_HEADING}:`, F, 'the prose', F, 'Assumptions relied on:', F, '  - one', 'two', '  - three', F].join('\n');
		expect(listsReserialized(p, jsonLine).split('\n')[10]).toBe(jsonLine(['one\ntwo', 'three']));
	});

	it('⭐ THE ARRANGEMENT — the account-breaks probes (design §9.3 D7): G-ACCOUNT-BREAKS’s and W-ACCOUNT-BREAKS’s prompts are fenced by `<<<UNTRUSTED-36>>>`, and P-ACCOUNT-BREAKS’s view by `36` and its prompt by `37`, past the nine candidates each field of the account holds, six each split by one terminator a reader may not break at and three each on a line of its own one layout lays out — under an override, inside an embedding, inside an isolate; each field is shown whole, as D7 writes it, each list holding an item with a line feed; and each way of reading a field otherwise reads its plants as stated', () => {
		// ⛔ WHY (design §9.3 D7; `REG-F-481`): every plant in an account slice was read by every reading of it, and none
		// was split by a break, so a chooser that read a field otherwise than the prompt carries it moved no probe (driven
		// on a disposable copy). So each field holds six candidates read only as carried — each split by one terminator a
		// reader may not break at — and both tokens read only otherwise: split by a line feed, written backwards below a
		// line a bidi control lays out, and, in a list, astride two items (`probes.ts` `BREAKS_ACCOUNT`). ⛔ AND THE ONE LINE
		// OF A FIELD A CONTROL LAID OUT HELD NO CANDIDATE, so a chooser that read a field with its bidi controls read away,
		// in one framing alone, moved no probe (driven): each field holds three candidates more, each on a line one family
		// of controls lays out and read only so (`probes.ts` `LAID_OUT_LINES`).
		for (const id of ACCOUNT_BREAKS_PROBES) {
			const input = inputOf(id);
			const account = input.rationale!;
			const { lines, token, regions } = promptRegions(BASE.probePrompts.get(id)!);
			const processResult = input.framing === 'PROCESS_RESULT';
			// THE TOKENS — past the ~~twenty-four~~ thirty-six candidates the fields hold, each where it is only while all
			// of them are read.
			expect(token, `${id}: the prompt’s token`).toBe(fenceCandidateOf(processResult ? 37 : 36));
			if (processResult) expect(viewParts(input.content).token, `${id}: the view’s token`).toBe(fenceCandidateOf(36));
			// EACH FIELD SHOWN WHOLE, AS D7 WRITES IT — the prose as written, each list its items after `  - `, one to a line,
			// an item holding a line feed as written (its later lines under no prefix) — and, for a process result, those
			// very bytes handed to the view's chooser.
			const texts = ACCOUNT_FIELDS.map((f) => {
				const shown = regions.filter((r) => r.slice === f);
				expect(shown.map((r) => r.cut), `${id}: ${f} — one region, whole`).toEqual([false]);
				return regionText(lines, shown[0]!);
			});
			expect(texts, `${id}: each field as D7 writes it`).toEqual([account.rationale, ...ACCOUNT_LISTS.map((k) => bulleted(account[k]))]);
			expect(
				ACCOUNT_LISTS.map((k) => account[k].some((item) => item.includes('\n'))),
				`${id}: each list holds an item with a line feed`
			).toEqual([true, true, true]);
			if (processResult) {
				const names = otherUntrustedNames(input);
				expect(
					otherUntrustedOf(input).filter((_, i) => ACCOUNT_FIELDS.includes(names[i]!)),
					`${id}: the view’s chooser is handed each field as the prompt carries it`
				).toEqual(texts);
			}
			// EACH FIELD, READ AS CARRIED AND READ OTHERWISE: as carried, its six candidates are read, ⭐ and its three laid
			// out, and neither token is; each way of reading it otherwise leaves its six unread (`under`), ⭐ its three laid
			// out unread (`unlaid`), or reads both tokens (`over`), as stated; and a reader that breaks a line at ONE
			// terminator leaves exactly the one candidate it splits unread, ⭐ and one that reads ONE family of bidi
			// controls away, exactly the one candidate that family lays out.
			ACCOUNT_FIELDS.forEach((f, k) => {
				const text = texts[k]!;
				const six = Array.from({ length: 6 }, (_, i) => PER_FIELD * k + i);
				const laid = LAYOUT_FAMILIES.map((_, i) => PER_FIELD * k + six.length + i);
				expect(
					[six.every((n) => holds(text, n)), laid.every((n) => holds(text, n)), BREAKS_TOKENS.some((n) => holds(text, n))],
					`${id}: ${f}, as carried — its six candidates read, its three laid out read, neither token`
				).toEqual([true, true, false]);
				// EACH TOKEN'S PLANTS, KIND BY KIND: split by a line feed; written backwards on a line of its own with no
				// bidi control, below one a control lays out; and, in a list, astride two items.
				const fieldLines = text.split('\n');
				const controlAt = fieldLines.findIndex((l) => l.includes(RIGHT_TO_LEFT_OVERRIDE));
				for (const n of BREAKS_TOKENS) {
					const t = fenceCandidateOf(n);
					const backwards = [...t]
						.reverse()
						.map((c) => (c === '<' ? '>' : c === '>' ? '<' : c))
						.join('');
					expect(
						[
							text.includes(`${t.slice(0, 14)}\n${t.slice(14)}`),
							controlAt >= 0 &&
								fieldLines.slice(controlAt + 1).some((l) => l.endsWith(backwards) && !l.includes(RIGHT_TO_LEFT_OVERRIDE)),
							!LIST_SLICES.includes(f) || text.includes(`${t.slice(0, 14)}\n${LIST_ITEM}${t.slice(14)}`)
						],
						`${id}: ${f} — ${t} split by a line feed, written backwards below a line a control lays out, astride two items`
					).toEqual([true, true, true]);
				}
				// ⭐ EACH LAID-OUT CANDIDATE, FAMILY BY FAMILY (`probes.ts` `LAID_OUT_LINES`): on one line of the field, its
				// place among the field's last three, which holds that family's controls and no other control, and which read
				// in logical order alone is no candidate.
				LAYOUT_FAMILIES.forEach(([, controls], i) => {
					const on = fieldLines.filter((l) => holds(l, laid[i]!));
					expect(on.length, `${id}: ${f} — ${fenceCandidateOf(laid[i]!)} on one line`).toBe(1);
					expect(fieldLines.indexOf(on[0]!), `${id}: ${f} — ${fenceCandidateOf(laid[i]!)}, among the field’s last lines`).toBe(
						fieldLines.length - LAYOUT_FAMILIES.length + i
					);
					expect(
						[
							[...new Set([...on[0]!].map((c) => c.codePointAt(0)!).filter((cp) => READER_BIDI_CONTROLS.includes(cp)))],
							holds(readingAway(READER_BIDI_CONTROLS)(on[0]!), laid[i]!)
						],
						`${id}: ${f} — ${fenceCandidateOf(laid[i]!)}: [its line’s controls, read in logical order alone]`
					).toEqual([controls, false]);
				});
				for (const [name, r] of Object.entries(FIELD_READINGS)) {
					if (r.lists && !LIST_SLICES.includes(f)) continue;
					const read = r.read(text);
					expect(
						[six.every((n) => !holds(read, n)), BREAKS_TOKENS.every((n) => holds(read, n))],
						`${id}: ${f}, read ${name} — [its six unread, both tokens read]`
					).toEqual([r.under, r.over]);
					expect(
						laid.filter((n) => !holds(read, n)),
						`${id}: ${f}, read ${name} — its laid-out candidates unread: all three, or none`
					).toEqual(r.unlaid ? laid : []);
				}
				UNBROKEN_BREAKS.forEach((cp, i) =>
					expect(
						six.filter((n) => !holds(breakingAt([cp])(text), n)),
						`${id}: ${f}, a line broken at U+${cp.toString(16).toUpperCase().padStart(4, '0')} alone`
					).toEqual([six[i]])
				);
				LAYOUT_FAMILIES.forEach(([family, controls], i) =>
					expect(
						[...six, ...laid].filter((n) => !holds(readingAway(controls)(text), n)),
						`${id}: ${f}, ${family} read away alone`
					).toEqual([laid[i]])
				);
				expect(
					[...six, ...laid].filter((n) => !holds(fieldLines.slice(0, -1).join('\n'), n)),
					`${id}: ${f}, read without its last line`
				).toEqual([laid[laid.length - 1]]);
			});
		}
	});

	it.each(FIELD_READING_ROWS)(
		'⭐ design §9.3 D7 — a validator chooser that reads %s %s moves `probes` through exactly the account-breaks probes, in every framing, and no case prompt — of v1, nor of the current set (PQ-2)',
		async (field, reading) => {
			const read = FIELD_READINGS[reading]!.read;
			const seams: FingerprintSeams = { ...PRODUCT_SEAMS, validator: validatorPrinting((p, input) => reread(p, input, field, read)) };
			const fp = await reviewerFingerprint(CASES, seams);
			onlyMoved(fp, ['probes']);
			expect(movedProbes(fp), 'the probes that plant in that field both ways').toEqual(ACCOUNT_BREAKS_PROBES);
			expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
			// ⭐ `PQ-2` (design D4) — nor any of the current set, measured: no case's account holds a plant read only otherwise.
			expect(await movedNow(seams), 'no case prompt of the current set moves').toEqual([]);
		},
		120_000
	);

	it.each(FIELD_READING_ROWS)(
		'⭐ design §9.3 D7 — a view chooser that reads %s %s moves `probes` through exactly P-ACCOUNT-BREAKS, and no case prompt — of v1, nor of the current set, whose process results a view chooser builds (PQ-2)',
		async (field, reading) => {
			const seams: FingerprintSeams = {
				...PRODUCT_SEAMS,
				processResult: choosing(() => true, otherRead(field, FIELD_READINGS[reading]!.read))
			};
			const fp = await reviewerFingerprint(CASES, seams);
			onlyMoved(fp, ['probes']);
			expect(movedProbes(fp), 'the process-result probe that plants in that field both ways').toEqual(['P-ACCOUNT-BREAKS']);
			expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
			// ⭐ `PQ-2` (design D4) — nor any of the current set, measured.
			expect(await movedNow(seams), 'no case prompt of the current set moves').toEqual([]);
		},
		120_000
	);

	it('⭑ CONTROL — the field re-reader read back: each field read as the prompt carries it, every prompt re-chosen over, is the product’s byte for byte; and the view’s chooser handed each field so renders the product’s view — over v1, and over the current set (PQ-2)', async () => {
		const same = (t: string): string => t;
		const seams: FingerprintSeams = {
			...PRODUCT_SEAMS,
			validator: validatorPrinting((p, input) => reread(p, input, "the account's assumptions", same)),
			processResult: choosing(() => true, otherRead("the account's assumptions", same))
		};
		const fp = await reviewerFingerprint(CASES, seams);
		expect(fp.components, 'nothing moves').toEqual(BASE.components);
		expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
		// ⭐ `PQ-2` (design D4) — nor any of the current set's, its fourteen process results built through the view's chooser.
		expect(await movedNow(seams), 'no case prompt of the current set moves').toEqual([]);
	}, 120_000);

	it('⭐ design §9.3 D7 — a list item holding a line feed, its later lines written otherwise (indented under the item, as a reader of bullets might expect), moves `probes` through exactly the probes whose prompt shows such an item whole, in every framing — and exactly the case prompts whose case holds one', async () => {
		// ⛔ WHY (design §9.3 D7; `REG-F-481`): D7 states the ambiguity of bullets — an item holding a newline and the prefix
		// reads as two items — and `fingerprint.ts` counts the way each list is written among what moves `probes`; but no
		// probe and no case carried an item holding a line feed, so a renderer that wrote one otherwise moved no fingerprint
		// (driven on a disposable copy). Each list of `BREAKS_ACCOUNT` holds two.
		const indented = (items: readonly string[]): string =>
			items.map((item) => `${LIST_ITEM}${item.split('\n').join('\n    ')}`).join('\n');
		const holdsOne = (account: ReasoningReviewInput['rationale']): boolean =>
			account !== undefined && ACCOUNT_LISTS.some((k) => account[k].some((item) => item.includes('\n')));
		const showing = FINGERPRINT_PROBES.flatMap((x) => {
			const sent = BASE.probePrompts.get(x.id)!;
			if (sent.startsWith(REFUSED)) return [];
			const account = x.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult).rationale;
			const whole = promptRegions(sent).regions.filter((r) => !r.cut && LIST_SLICES.includes(r.slice)).map((r) => r.slice);
			return ACCOUNT_LISTS.some(
				(k) => account?.[k].some((item) => item.includes('\n')) && whole.includes(LIST_SLICES[ACCOUNT_LISTS.indexOf(k)]!)
			)
				? [x.id]
				: [];
		});
		expect(showing, 'the arrangement: the probes that show such an item whole').toEqual(ACCOUNT_BREAKS_PROBES);
		const seams: FingerprintSeams = { ...PRODUCT_SEAMS, validator: validatorPrinting((p) => listsReserialized(p, indented)) };
		const fp = await reviewerFingerprint(CASES, seams);
		onlyMoved(fp, ['probes']);
		expect(movedProbes(fp), 'the probes whose prompt shows such an item whole').toEqual(showing);
		const cases = CASES.filter((c) => holdsOne(caseReviewInput(c, PRODUCT_SEAMS.criteria).rationale)).map((c) => c.id);
		expect(
			CASES.filter((c) => fp.casePrompts.get(c.id)?.initial !== BASE.casePrompts.get(c.id)?.initial).map((c) => c.id),
			'the case prompts that move: exactly those whose case holds such an item'
		).toEqual(cases);
		// ⭐ `PQ-2` (design D4) — and of the current set: exactly its cases that hold one.
		expect(await movedNow(seams), 'the case prompts of the current set that move: exactly those whose case holds such an item').toEqual(
			CURRENT_CASES.filter((c) => holdsOne(caseReviewInput(c, PRODUCT_SEAMS.criteria).rationale)).map((c) => c.id)
		);
	}, 120_000);

	it.each(Object.keys(ENCODER_CALL_SITES))(
		'⭐ %s encoded by `JSON.stringify`, not `jsonLine`, moves `probes` through the probe that plants a break there, and no case prompt — of v1, nor of the current set (PQ-2)',
		async (site) => {
			const e = ENCODER_CALL_SITES[site]!;
			const seams: FingerprintSeams = { ...PRODUCT_SEAMS, validator: validatorPrinting((p, input) => encodedRaw(p, input, e.which)) };
			const fp = await reviewerFingerprint(CASES, seams);
			onlyMoved(fp, ['probes']);
			expect(movedProbes(fp), 'the probe whose break that call site encodes').toEqual(e.moves);
			expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
			// ⭐ `PQ-2` (design D4) — nor any of the current set, measured: no case holds a break at that call site.
			expect(await movedNow(seams), 'no case prompt of the current set moves').toEqual([]);
		},
		120_000
	);

	// ~~U+0085 and U+2029 alone, through G-OVERSIZE-FENCES alone~~ — `PQ-1` (`REG-F-481`): every break is planted at every
	// call site a probe reaches now, the command line of `P-OVERSIZE-FENCES` among them, so each break left raw moves both.
	it.each([
		['U+0085', 0x85],
		['U+2028', 0x2028],
		['U+2029', 0x2029]
	] as const)(
		'⭐ `jsonLine` leaving %s raw — at every call site at once, the fence module loaded afresh — moves `probes` through the two probes that plant it, G-OVERSIZE-FENCES and P-OVERSIZE-FENCES, and no case prompt of v1 or of the current set (PQ-2)',
		async (_name, left) => {
			expect(jsonLineLeaving(0)({ a: 'x' }), 'CONTROL: leaving none raw, it is `jsonLine`').toBe(jsonLine({ a: 'x' }));
			const fp = await freshOverFence(() => ({ jsonLine: jsonLineLeaving(left) }));
			onlyMoved(fp, ['probes']);
			expect(movedProbes(fp), 'the probes that plant that break').toEqual(['G-OVERSIZE-FENCES', 'P-OVERSIZE-FENCES']);
			expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
			// ⭐ `PQ-2` (design D4) — nor any of the current set, measured: no case's command line or content holds the break.
			const now = await freshOverFence(() => ({ jsonLine: jsonLineLeaving(left) }), CURRENT_CASES);
			expect(movedCasePrompts(now, BASE_NOW), 'no case prompt of the current set moves').toEqual([]);
		},
		240_000
	);

	it('⭐ WHAT NO CHOOSER MAY READ IS PLANTED, AND WOULD DECIDE — each chooser’s token in the bytes a cut removes (every cut a probe takes but those standing on a cut’s own arithmetic; for both choosers of a process result, in each tied list and in each slice P-OVERSIZE-ALL’s prompt cuts), astride two slices (W-FENCES, G-OVERSIZE-FENCES, P-OVERSIZE-FENCES) and astride a cut’s two parts (P-OVERSIZE-FENCES’s stdout), split by a line feed, and written backwards and with its runs reversed on a line with no bidi control: in no slice as the prompt carries it, and a chooser that read it would choose another token', () => {
		// ⛔ WHY (`PQ-1`; `REG-F-481`, `REG-F-476`; design D2 under the sponsor's answer (a)): a chooser reads each slice AS THE
		// PROMPT CARRIES IT — the bytes a cut KEPT, each slice on its own. Every plant stood where a chooser must read, so a
		// chooser that read MORE — each slice whole, the bytes its cut removed included, or its slices joined — chose the
		// same token for every probe, moved no fingerprint and reddened nothing here (driven on a disposable copy, for each
		// chooser). Each plant below is today's token where no chooser may read it. ⛔ AND THE PLANTS STOOD IN THREE OF THE
		// CUTS A PROBE TAKES, AND ASTRIDE ONE PAIR OF SLICES: a chooser that read the narration, the prior findings, the
		// rationale, a cut content, or the view's command line or stderr uncut, or read the view's own slices or the
		// validator's other slices joined, moved no fingerprint (driven on a disposable copy, each). ~~Every cut a probe
		// takes removes a plant now~~ — not every: each cut below removes the token of the chooser the row names, and the
		// cuts that stand on a cut's own arithmetic remove none (`probes.ts` names them); ⛔ and a process result's
		// validator chooser found no token of its own in what its cuts removed (the ends held the view's), nor its view's
		// in the residual uncertainty, so either reading those uncut moved nothing (driven on a disposable copy). Three
		// pairs of slices and one cut's two parts stand astride a plant.
		/** `plant` is in none of `carried` and in `over`; read as carried the token is `token`, and read so, another. */
		const decides = (label: string, plant: string, token: string, carried: readonly string[], over: readonly string[]) => {
			expect(carried.some((s) => s.includes(plant)), `${label}: the plant is in no slice as the prompt carries it`).toBe(false);
			expect(over.some((s) => s.includes(plant)), `${label}: the arrangement — read so, a slice holds it`).toBe(true);
			expect(chooseFence(carried), `${label}: read as carried, today’s token`).toBe(token);
			expect(chooseFence(over), `${label}: read so, another token`).not.toBe(token);
		};
		// THE VIEW'S CHOOSER (`P-OVERSIZE-FENCES`): the middle its stdout's cut removes, and a line feed read away.
		let source: ProcessResultReviewSource | undefined;
		const fences = FINGERPRINT_PROBES.find((x) => x.id === 'P-OVERSIZE-FENCES')!.input(PRODUCT_SEAMS.criteria, (s) => {
			source = s;
			return PRODUCT_SEAMS.processResult(s);
		});
		const view = viewParts(fences.content);
		const others = otherUntrustedOf(fences);
		const parts = view.parts.map((x) => x.text);
		const T19 = '<<<UNTRUSTED-19>>>';
		expect(view.token, 'the arrangement: the view’s token').toBe(T19);
		decides('P-OVERSIZE-FENCES, the middle of stdout its cut removes', T19, T19, [...parts, ...others], [
			...view.parts.filter((x) => x.slice !== 'stdout').map((x) => x.text),
			source!.run.stdout,
			...others
		]);
		// …and the end of the assumptions their cut removes, read as a chooser that read the account uncut would read it
		// (⭐ D7: the list as the prompt serializes it, its items after `  - `; ~~`jsonLine` of its items~~).
		decides('P-OVERSIZE-FENCES, the end of the assumptions their cut removes', T19, T19, [...parts, ...others], [
			...parts,
			...others,
			bulleted(fences.rationale!.assumptions)
		]);
		// …and the end of the residual uncertainty, which ITS cut removes: the two tied lists each end with both tokens.
		decides('P-OVERSIZE-FENCES, the end of the residual uncertainty its cut removes (the view’s token)', T19, T19, [...parts, ...others], [
			...parts,
			...others,
			bulleted(fences.rationale!.residualUncertainty)
		]);
		// …astride the cut of stdout — its HEAD ends with the token's first half, its TAIL begins with the second, each beside
		// a run of code points a reader does not see (`probes.ts` `UNSEEN`) — read as a chooser that joined the two parts
		// would read them: the runs as nothing, so the halves meet (the join with the runs read away, shown to read alike).
		const cut = view.parts.filter((x) => x.slice === 'stdout');
		expect(cut.map((x) => x.part), 'the arrangement: stdout is cut, HEAD and TAIL').toEqual(['HEAD', 'TAIL']);
		const joined = cut.map((x) => x.text).join('');
		const seen = joined.split(String.fromCodePoint(0x200b)).join('');
		const below = Array.from({ length: 19 }, (_, n) => `<<<UNTRUSTED-${String(n).padStart(2, '0')}>>>`).join('\n');
		expect(
			[joined.length > seen.length, chooseFence([below, joined]), chooseFence([below, seen])],
			'the arrangement: the join reads as 19, its runs read as nothing'
		).toEqual([true, '<<<UNTRUSTED-20>>>', '<<<UNTRUSTED-20>>>']);
		decides('P-OVERSIZE-FENCES, astride the HEAD and the TAIL of stdout', T19, T19, [...parts, ...others], [
			...view.parts.filter((x) => x.slice !== 'stdout').map((x) => x.text),
			seen,
			...others
		]);
		// …astride stdout and stderr — stdout's TAIL ends with the first half, stderr begins with the second.
		const stderr = view.parts.filter((x) => x.slice === 'stderr');
		expect(stderr.length, 'the arrangement: stderr is shown whole').toBe(1);
		decides('P-OVERSIZE-FENCES, astride stdout and stderr', T19, T19, [...parts, ...others], [
			...view.parts.filter((x) => x.slice !== 'stderr' && x.part !== 'TAIL').map((x) => x.text),
			cut[1]!.text + stderr[0]!.text,
			...others
		]);
		decides('P-OVERSIZE-FENCES, split by a line feed in stderr', T19, T19, [...parts, ...others], [
			...view.parts.map((x) => (x.slice === 'stderr' ? x.text.replace('<<<UNTRUSTED-1\n9>>>', T19) : x.text)),
			...others
		]);
		// …and written backwards, and with its runs reversed, each on a line with no bidi control, read as a chooser that
		// laid the WHOLE slice, or every line of it, out would read that line: reversed, its brackets mirrored; its runs
		// reversed.
		decides('P-OVERSIZE-FENCES, backwards on a line of stderr with no bidi control', T19, T19, [...parts, ...others], [
			...view.parts.map((x) => (x.slice === 'stderr' ? x.text.replace('\n<<<91-DETSURTNU>>>\n', `\n${T19}\n`) : x.text)),
			...others
		]);
		decides('P-OVERSIZE-FENCES, its runs reversed on a line of stderr with no bidi control', T19, T19, [...parts, ...others], [
			...view.parts.map((x) => (x.slice === 'stderr' ? x.text.replace('\n<<<19-UNTRUSTED>>>\n', `\n${T19}\n`) : x.text)),
			...others
		]);
		// THE VALIDATOR'S CHOOSER OVER THE SAME PROMPT: its own token, `20`, at the end of the residual uncertainty, which
		// its cut removes — read over the prompt's regions and the view whole, as the product's chooser reads them.
		const pf = promptRegions(BASE.probePrompts.get('P-OVERSIZE-FENCES')!);
		const pfTexts = [...pf.regions.map((r) => regionText(pf.lines, r)), fences.content];
		expect(pf.token, 'the arrangement: the prompt’s token').toBe('<<<UNTRUSTED-20>>>');
		decides('P-OVERSIZE-FENCES, the end of the residual uncertainty its cut removes', '<<<UNTRUSTED-20>>>', '<<<UNTRUSTED-20>>>', pfTexts, [
			...pfTexts,
			bulleted(fences.rationale!.residualUncertainty)
		]);
		// …and at the end of the assumptions, which theirs removes.
		decides('P-OVERSIZE-FENCES, the end of the assumptions their cut removes (the prompt’s token)', '<<<UNTRUSTED-20>>>', '<<<UNTRUSTED-20>>>', pfTexts, [
			...pfTexts,
			bulleted(fences.rationale!.assumptions)
		]);
		// THE VALIDATOR'S CHOOSER, OVER A GRAPH (`G-OVERSIZE-FENCES`): the end its limitations' cut removes.
		const graph = FINGERPRINT_PROBES.find((x) => x.id === 'G-OVERSIZE-FENCES')!.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult);
		const g = promptRegions(BASE.probePrompts.get('G-OVERSIZE-FENCES')!);
		decides(
			'G-OVERSIZE-FENCES, the end of the limitations their cut removes',
			'<<<UNTRUSTED-08>>>',
			'<<<UNTRUSTED-08>>>',
			g.regions.map((r) => regionText(g.lines, r)),
			g.regions.map((r) => (r.slice === "the account's limitations" ? bulleted(graph.rationale!.limitations) : regionText(g.lines, r)))
		);
		// …and astride its instruction and its rationale: the one ends with the token's first half, the other begins with
		// the rest — read as a chooser that joined the slices it reads besides the content would read them.
		const gTexts = g.regions.map((r) => regionText(g.lines, r));
		expect(
			[gTexts[0]!.endsWith('\n<<<UNTRUSTED-0'), g.regions[2]!.slice, gTexts[2]!.startsWith('8>>>\n')],
			'G-OVERSIZE-FENCES: the token’s first half ends the instruction, the rest begins the rationale'
		).toEqual([true, "the account's rationale", true]);
		decides('G-OVERSIZE-FENCES, astride its instruction and its rationale', '<<<UNTRUSTED-08>>>', '<<<UNTRUSTED-08>>>', gTexts, [
			gTexts[0]! + gTexts[2]!,
			...gTexts
		]);
		// THE OVERSIZE SLICES' REMOVED ENDS — the instruction's tail, and the end of a graph's or a work product's content,
		// of the rationale, of the narration and of the prior findings: the validator's chooser in two framings, each slice
		// read whole as a chooser that read it uncut would read it.
		const UNCUT: Readonly<Record<string, (input: ReasoningReviewInput) => string>> = {
			'the instruction': (input) => input.prompt,
			'the content': (input) => input.content,
			"the account's rationale": (input) => input.rationale!.rationale,
			'the narration': (input) => input.narration!,
			'the prior findings': (input) => jsonLine(input.prior!.gaps)
		};
		for (const [id, slices] of [
			['G-OVERSIZE-ALL', ['the instruction', 'the content', "the account's rationale", 'the narration', 'the prior findings']],
			['W-OVERSIZE-ALL', ['the instruction', 'the content', "the account's rationale", 'the prior findings']],
			['G-OVERSIZE-CONTENT', ['the content']],
			['W-OVERSIZE-CONTENT', ['the content']]
		] as const) {
			const input = FINGERPRINT_PROBES.find((x) => x.id === id)!.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult);
			const r = promptRegions(BASE.probePrompts.get(id)!);
			for (const slice of slices) {
				expect(r.regions.find((x) => x.slice === slice)?.cut, `${id}: the arrangement — ${slice} is cut`).toBe(true);
				decides(
					`${id}, the end of ${slice} its cut removes`,
					'<<<UNTRUSTED-01>>>',
					'<<<UNTRUSTED-01>>>',
					r.regions.map((x) => regionText(r.lines, x)),
					r.regions.map((x) => (x.slice === slice ? UNCUT[slice]!(input) : regionText(r.lines, x)))
				);
			}
		}
		// THE VALIDATOR'S CHOOSER OVER A PROCESS RESULT'S CUT SLICES (`P-OVERSIZE-ALL`): its own token, `05`, at the end of
		// the instruction, the rationale, the narration and the prior findings, each read uncut beside the prompt's other
		// regions and the view whole, as the product's chooser reads them.
		const pa = promptRegions(BASE.probePrompts.get('P-OVERSIZE-ALL')!);
		const paInput = inputOf('P-OVERSIZE-ALL');
		expect(pa.token, 'the arrangement: P-OVERSIZE-ALL’s prompt token').toBe('<<<UNTRUSTED-05>>>');
		for (const slice of ['the instruction', "the account's rationale", 'the narration', 'the prior findings']) {
			expect(pa.regions.find((x) => x.slice === slice)?.cut, `P-OVERSIZE-ALL: the arrangement — ${slice} is cut`).toBe(true);
			decides(
				`P-OVERSIZE-ALL, the end of ${slice} its cut removes`,
				'<<<UNTRUSTED-05>>>',
				'<<<UNTRUSTED-05>>>',
				[...pa.regions.map((x) => regionText(pa.lines, x)), paInput.content],
				[...pa.regions.map((x) => (x.slice === slice ? UNCUT[slice]!(paInput) : regionText(pa.lines, x))), paInput.content]
			);
		}
		// THE ACCOUNT'S LISTS, EACH CUT, IN EVERY FRAMING (`probes.ts` `listsCut`): each chooser's token at the end of each
		// list its cut removes — the validator's over a graph and a work product, and both choosers' over a process result.
		// ⛔ No graph or work-product probe cut the assumptions or the residual uncertainty, and no work-product or
		// process-result probe the limitations, so a chooser that read one of them uncut there moved nothing (driven on a
		// disposable copy).
		for (const [id, promptsOwn, viewsOwn] of [
			['G-OVERSIZE-LISTS', '<<<UNTRUSTED-00>>>', undefined],
			['W-OVERSIZE-LISTS', '<<<UNTRUSTED-00>>>', undefined],
			['P-OVERSIZE-LISTS', '<<<UNTRUSTED-01>>>', '<<<UNTRUSTED-00>>>']
		] as const) {
			const input = FINGERPRINT_PROBES.find((x) => x.id === id)!.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult);
			const r = promptRegions(BASE.probePrompts.get(id)!);
			expect(r.token, `${id}: the arrangement — the prompt’s token`).toBe(promptsOwn);
			const viewed = viewsOwn === undefined ? [] : [input.content];
			for (const k of ACCOUNT_LISTS) {
				const slice = `the account's ${k === 'residualUncertainty' ? 'residual uncertainty' : k}`;
				expect(r.regions.find((x) => x.slice === slice)?.cut, `${id}: the arrangement — ${slice} is cut`).toBe(true);
				decides(
					`${id}, the end of ${slice} its cut removes`,
					promptsOwn,
					promptsOwn,
					[...r.regions.map((x) => regionText(r.lines, x)), ...viewed],
					[...r.regions.map((x) => (x.slice === slice ? bulleted(input.rationale![k]) : regionText(r.lines, x))), ...viewed]
				);
				if (viewsOwn !== undefined) {
					const v = viewParts(input.content);
					expect(v.token, `${id}: the arrangement — the view’s token`).toBe(viewsOwn);
					const o = otherUntrustedOf(input);
					decides(`${id}, the end of ${slice} its cut removes (the view’s token)`, viewsOwn, viewsOwn, [...v.parts.map((x) => x.text), ...o], [
						...v.parts.map((x) => x.text),
						...o,
						bulleted(input.rationale![k])
					]);
				}
			}
		}
		// THE VIEW'S CHOOSER OVER THE MIDDLE ITS CUT REMOVES, of the command line (`P-OVERSIZE-COMMAND`) and of stderr
		// (`P-OVERSIZE-STREAMS`): read whole, as a chooser that read the slice uncut would read it.
		for (const [id, slice, whole] of [
			['P-OVERSIZE-COMMAND', 'the command line', (run: ObservedProcessRun) => jsonLine(run.argv)],
			['P-OVERSIZE-STREAMS', 'stderr', (run: ObservedProcessRun) => run.stderr]
		] as const) {
			let built: ProcessResultReviewSource | undefined;
			const input = FINGERPRINT_PROBES.find((x) => x.id === id)!.input(PRODUCT_SEAMS.criteria, (s) => {
				built = s;
				return PRODUCT_SEAMS.processResult(s);
			});
			const v = viewParts(input.content);
			const o = otherUntrustedOf(input);
			expect(v.parts.filter((x) => x.slice === slice).map((x) => x.part), `${id}: the arrangement — ${slice} is cut`).toEqual([
				'HEAD',
				'TAIL'
			]);
			decides(
				`${id}, the middle of ${slice} its cut removes`,
				'<<<UNTRUSTED-00>>>',
				'<<<UNTRUSTED-00>>>',
				[...v.parts.map((x) => x.text), ...o],
				[...v.parts.filter((x) => x.slice !== slice).map((x) => x.text), whole(built!.run), ...o]
			);
		}
		const all = inputOf('P-OVERSIZE-ALL');
		const allView = viewParts(all.content);
		const allOthers = otherUntrustedOf(all);
		expect(
			[all.prompt.startsWith(allOthers[0]!), allOthers[0]!.length < all.prompt.length],
			'the arrangement: the first slice the view’s chooser is handed is the instruction’s kept HEAD'
		).toEqual([true, true]);
		decides(
			'P-OVERSIZE-ALL’s view, the tail of the instruction its cut removes',
			'<<<UNTRUSTED-01>>>',
			'<<<UNTRUSTED-01>>>',
			[...allView.parts.map((x) => x.text), ...allOthers],
			[...allView.parts.map((x) => x.text), all.prompt, ...allOthers.slice(1)]
		);
		// THE VALIDATOR'S CHOOSER, OVER A WORK PRODUCT (`W-FENCES`): its token astride the instruction and the answer.
		const w = promptRegions(BASE.probePrompts.get('W-FENCES')!);
		const wTexts = w.regions.map((r) => regionText(w.lines, r));
		expect(w.regions.slice(0, 2).map((r) => r.slice), 'W-FENCES: the instruction, then the answer').toEqual(['the instruction', 'the content']);
		expect(
			[wTexts[0]!.endsWith('\n<<<UNTRUSTED-0'), wTexts[1]!.startsWith('7>>>\n')],
			'W-FENCES: the token’s first half ends the instruction, the rest begins the answer'
		).toEqual([true, true]);
		decides('W-FENCES, astride its instruction and its answer', '<<<UNTRUSTED-07>>>', '<<<UNTRUSTED-07>>>', wTexts, [wTexts.join('')]);
	});

	it('⭐ THE CUTS THAT REMOVE NO PLANT are exactly the ones `probes.ts` names, each standing on a cut’s own arithmetic — W-OVERSIZE-EDGES’s answer (the validator’s), and the view’s cuts of the stdout of P-OVERSIZE-CONTENT, P-OVERSIZE-SURROGATE, P-OVERSIZE-STREAMS and P-OVERSIZE-ALL, both streams of P-OVERSIZE-ROOM-EDGES and all three slices of P-OVERSIZE-AT-ITS-BUDGET', () => {
		// ⭐ WHAT IS STATED IS HELD (`probes.ts`, `fingerprint.ts`): every cut a probe takes removes the token of each chooser
		// that reads the slice it cuts — the validator's, and for a process result the view's too, which reads the prompt's
		// other slices as cut — but these, whose bytes are chosen for a cut's arithmetic alone. ⛔ The statement said every
		// cut, and a process result's validator chooser found no token of its own in what its cuts removed (driven on a
		// disposable copy). A cut that comes to remove no plant, or one of these that comes to remove one, is named here.
		const whole: Readonly<Record<string, (i: ReasoningReviewInput) => string>> = {
			'the instruction': (i) => i.prompt,
			'the content': (i) => i.content,
			"the account's rationale": (i) => i.rationale!.rationale,
			"the account's assumptions": (i) => bulleted(i.rationale!.assumptions),
			"the account's limitations": (i) => bulleted(i.rationale!.limitations),
			"the account's residual uncertainty": (i) => bulleted(i.rationale!.residualUncertainty),
			'the narration': (i) => i.narration!,
			'the prior findings': (i) => jsonLine(i.prior!.gaps)
		};
		const plantless: string[] = [];
		let cuts = 0;
		for (const probe of FINGERPRINT_PROBES) {
			const sent = BASE.probePrompts.get(probe.id)!;
			if (sent.startsWith(REFUSED)) continue;
			let source: ProcessResultReviewSource | undefined;
			const input = probe.input(PRODUCT_SEAMS.criteria, (s) => {
				source = s;
				return PRODUCT_SEAMS.processResult(s);
			});
			const { lines, token, regions } = promptRegions(sent);
			const viewToken = input.framing === 'PROCESS_RESULT' ? viewParts(input.content).token : undefined;
			for (const r of regions.filter((x) => x.cut)) {
				cuts += 1;
				const value = whole[r.slice]!(input);
				const kept = regionText(lines, r);
				expect(value.startsWith(kept), `${probe.id}: ${r.slice} keeps its HEAD`).toBe(true);
				for (const [t, whose] of [[token, 'the validator’s'], ...(viewToken ? [[viewToken, 'the view’s'] as const] : [])] as const)
					if (!value.slice(kept.length).includes(t)) plantless.push(`${probe.id}: ${r.slice} (${whose})`);
			}
			if (source !== undefined)
				for (const slice of ['the command line', 'stdout', 'stderr'] as const) {
					const c = headAndTailCut(input.content, slice);
					if (c === undefined) continue;
					cuts += 1;
					const value = slice === 'stdout' ? source.run.stdout : slice === 'stderr' ? source.run.stderr : jsonLine(source.run.argv);
					expect([value.startsWith(c.head), value.endsWith(c.tail)], `${probe.id}: ${slice} keeps a HEAD and a TAIL`).toEqual([true, true]);
					if (!value.slice(c.head.length, value.length - c.tail.length).includes(viewToken!)) plantless.push(`${probe.id}: ${slice} (the view’s)`);
				}
		}
		expect(cuts, 'the arrangement: the cuts the probes take').toBeGreaterThan(plantless.length);
		expect(plantless, 'the cuts that remove no plant').toEqual([
			'W-OVERSIZE-EDGES: the content (the validator’s)',
			'P-OVERSIZE-CONTENT: stdout (the view’s)',
			'P-OVERSIZE-SURROGATE: stdout (the view’s)',
			'P-OVERSIZE-ROOM-EDGES: stdout (the view’s)',
			'P-OVERSIZE-ROOM-EDGES: stderr (the view’s)',
			'P-OVERSIZE-STREAMS: stdout (the view’s)',
			'P-OVERSIZE-AT-ITS-BUDGET: the command line (the view’s)',
			'P-OVERSIZE-AT-ITS-BUDGET: stdout (the view’s)',
			'P-OVERSIZE-AT-ITS-BUDGET: stderr (the view’s)',
			'P-OVERSIZE-ALL: stdout (the view’s)'
		]);
	});

	it('⭐ A REFUSAL IS HASHED, IN EVERY FRAMING — G-NO-FENCE’s instruction, W-NO-FENCE’s answer and P-NO-FENCE’s stdout each print every candidate, so the validator refuses each before any prompt exists, and `probes` hashes the refusal: the statement and the content refused; no other probe is refused', () => {
		// ⛔ WHY (`PQ-1`; `REG-F-481`, `REG-F-476`): only a process result was refused, so a validator that failed closed for a
		// process result alone — and SENT a graph or a work product whose slices hold every candidate, fenced by one that
		// occurs in it, the forged-block path `REG-F-481` closed — moved no fingerprint (driven on a disposable copy).
		const input = inputOf('P-NO-FENCE');
		expect(chooseFence([input.content]), 'the arrangement: every candidate occurs in the view').toBeUndefined();
		expect(input.content.split('\n'), 'the view is rendered unfenced, and says so').toContain(NO_FENCE_LINE);
		expect(BASE.probePrompts.get('P-NO-FENCE'), 'the refusal, hashed as a prompt is').toBe([REFUSED, NO_FENCE_STATEMENT, input.content].join('\n'));
		for (const [id, slice] of [
			['G-NO-FENCE', (i: ReasoningReviewInput) => i.prompt],
			['W-NO-FENCE', (i: ReasoningReviewInput) => i.content]
		] as const) {
			const i = FINGERPRINT_PROBES.find((x) => x.id === id)!.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult);
			expect(chooseFence([slice(i)]), `${id}: the arrangement — every candidate occurs in one slice`).toBeUndefined();
			expect(BASE.probePrompts.get(id), `${id}: the refusal, hashed as a prompt is`).toBe([REFUSED, NO_FENCE_STATEMENT, i.content].join('\n'));
		}
		expect(
			FINGERPRINT_PROBES.map((x) => x.id).filter((id) => BASE.probePrompts.get(id)!.startsWith(`${REFUSED}\n`)),
			'the probes the validator refuses'
		).toEqual(['G-NO-FENCE', 'W-NO-FENCE', 'P-NO-FENCE']);
	});

	it('⭐ a chooser that NEVER FAILS CLOSED — every candidate occurring, it fences with the last anyway — moves `probes` through the three refused probes, one in each framing, each refusal now a prompt, and no case prompt of v1 or of the current set (PQ-2)', async () => {
		const neverClosed = (real: typeof import('../apps/rph-demo/src/lib/server/assurance/review-fence.js')) => ({
			chooseFence: (slices: readonly string[]) => real.chooseFence(slices) ?? real.fenceCandidate(99)
		});
		const fp = await freshOverFence(neverClosed);
		onlyMoved(fp, ['probes']);
		expect(movedProbes(fp), 'the probes the validator refuses').toEqual(['G-NO-FENCE', 'W-NO-FENCE', 'P-NO-FENCE']);
		for (const id of ['G-NO-FENCE', 'W-NO-FENCE', 'P-NO-FENCE'])
			expect(fp.probePrompts.get(id)!.startsWith(`${REFUSED}\n`), `${id}: sent, where it was refused`).toBe(false);
		expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
		// ⭐ `PQ-2` (design D4) — nor any of the current set's: no case prints every candidate.
		expect(movedCasePrompts(await freshOverFence(neverClosed, CURRENT_CASES), BASE_NOW), 'no case prompt of the current set moves').toEqual([]);
	}, 240_000);

	it('⭐ THE ARRANGEMENT — P-OVERSIZE-AT-ITS-BUDGET’s view fills its budget EXACTLY, on the edge of the validator’s refusal of a view over it: its three slices cut alike, each declaration as wide as the widest the layout reserves; and it is sent, whole', () => {
		// ⛔ WHY (`PQ-1`; `REG-F-480`, `REG-F-476`): every probe's view fell short of its budget by the digits a declaration
		// did not need, so a refusal that fired AT the budget, not past it, refused nothing a probe sent (driven).
		let source: ProcessResultReviewSource | undefined;
		const input = FINGERPRINT_PROBES.find((x) => x.id === 'P-OVERSIZE-AT-ITS-BUDGET')!.input(PRODUCT_SEAMS.criteria, (s) => {
			source = s;
			return PRODUCT_SEAMS.processResult(s);
		});
		const b = viewBudget(input);
		const retune = `the view is ${input.content.length} units, its budget ${b}: re-tune SLICE_AT_FOUR_DIGITS (probes.ts)`;
		for (const [slice, text] of [
			['the command line', jsonLine(source!.run.argv)],
			['stdout', source!.run.stdout],
			['stderr', source!.run.stderr]
		] as const) {
			const c = headAndTailCut(input.content, slice);
			expect(c, `${slice}: ${retune} — cut`).toBeDefined();
			const total = codePoints(text);
			expect(c!.declaration.length, `${slice}: ${retune} — its declaration as wide as the widest`).toBe(
				headAndTailCutDeclaration(slice, total, total, total, total).length
			);
		}
		expect(input.content.length, `${retune} — the view fills its budget exactly`).toBe(b);
		expect(BASE.probePrompts.get('P-OVERSIZE-AT-ITS-BUDGET')!.includes(`\n${input.content}\n`), 'and it is sent, whole').toBe(true);
	});

	it('⭐ THE ARRANGEMENT — P-OVERSIZE-SURROGATE’s stdout states its code points in fewer digits than its UTF-16 units, so a cut layout that reserved its widest declaration in units keeps fewer', () => {
		// ⛔ WHY (`PQ-1`; `REG-F-480`, `REG-F-476`): every cut stream's code points and units had as many digits, so a
		// layout that reserved its declaration in units reserved the same width and moved no probe (driven).
		let stdout = '';
		FINGERPRINT_PROBES.find((x) => x.id === 'P-OVERSIZE-SURROGATE')!.input(PRODUCT_SEAMS.criteria, (s) => {
			stdout = s.run.stdout;
			return PRODUCT_SEAMS.processResult(s);
		});
		const [points, units] = [codePoints(stdout), stdout.length];
		expect(
			headAndTailCutDeclaration('stdout', units, units, units, units).length,
			`${points} code points in ${units} units: re-tune SURROGATE_POINTS (probes.ts)`
		).toBeGreaterThan(headAndTailCutDeclaration('stdout', points, points, points, points).length);
	});
});

describe('⭐⭐ JAN-PRQUAL PQ-1 (REG-F-481) — the skeleton’s table is hashed WHOLE, as it reads, and the reader as it reads a slice', () => {
	it('⭐ `probes` is every probe’s entry, in the probe set’s order, then the skeleton’s digest — the LITERAL its determinism test pins — then the reader corpus’s tokens AS EACH WITNESS STATES THEM, each under an id no probe has', () => {
		// ⭐ THE LITERAL, NOT THE FUNCTION: held to `verif/fence-skeleton-determinism.test.ts`'s `SKELETON_DIGEST`, the value
		// both runtimes must agree with, so a fingerprint can never hash a skeleton that test does not pin.
		const literal = /const SKELETON_DIGEST = '([0-9a-f]{64})';/.exec(
			readFileSync(`${REPO}/verif/fence-skeleton-determinism.test.ts`, 'utf8')
		)?.[1];
		expect(literal, 'the determinism test pins one literal').toMatch(/^[0-9a-f]{64}$/);
		const pairs = FINGERPRINT_PROBES.map((p) => [p.id, sha256(BASE.probePrompts.get(p.id)!)]);
		// ⭐ `PQ-1` (`REG-F-481`) — AND THE READER CORPUS, AS STATED: each witness's slices with the token it says the chooser
		// takes, so a fingerprint can never hash a reader whose tokens part from what the corpus states.
		const stated = JSON.stringify(READER_CORPUS.map((w) => [w.slices, w.token]));
		expect(BASE.components.probes).toBe(
			sha256(JSON.stringify([...pairs, ['FENCE-SKELETON', sha256(literal!)], ['FENCE-READER', sha256(stated)]]))
		);
		expect(
			FINGERPRINT_PROBES.filter((p) => ['FENCE-SKELETON', 'FENCE-READER'].includes(p.id)).map((p) => p.id),
			'no probe is named for the skeleton or the reader'
		).toEqual([]);
		expect(BASE.probePrompts.size, 'and the probes’ prompts are the probes’ alone').toBe(FINGERPRINT_PROBES.length);
	}, 60_000);

	it('⭐ THE READER CORPUS — every witness is chosen as it states, witnesses of both sides among them, and every plant of the chain read (its composition, witness by witness, and each witness’s rule are held below)', () => {
		// ⛔ WHY (`PQ-1`; `REG-F-481`, `REG-F-476`): the skeleton's digest hashes every code point's readings and flags, never
		// how a slice applies them, and a plant stood at one point of each rule of how a slice is read — so a reader changed
		// where no plant stood (a line laid out under the override alone, the first such line alone, a laid-out line broken
		// at every terminator, no candidate begun inside a reading) moved no fingerprint (driven on a disposable copy). The
		// corpus's tokens are hashed beside the probes for it (`fingerprint.ts` `FENCE_READER`).
		const parted = READER_CORPUS.flatMap((w) => {
			const chosen = chooseFence(w.slices) ?? null;
			return chosen === w.token ? [] : [`${w.rule}: chosen ${chosen}, stated ${w.token}`];
		});
		expect(parted, 'every witness, chosen as it states').toEqual([]);
		expect(
			[READER_CORPUS.some((w) => w.rule.startsWith('READ')), READER_CORPUS.some((w) => w.rule.startsWith('NOT READ'))],
			'the arrangement: witnesses of both sides'
		).toEqual([true, true]);
		// ⭐ AND EVERY PLANT OF THE CHAIN, READ: the plants of `P-OVERSIZE-FENCES` the corpus states, each the token it decides.
		const plants = READER_CORPUS.filter((w) => w.rule.includes('(FENCE_PLANTS)')).map((w) => w.token);
		expect(plants, 'the chain, 00 to 18, each plant read').toEqual(Array.from({ length: 19 }, (_, n) => `<<<UNTRUSTED-${String(n + 1).padStart(2, '0')}>>>`));
	});
});

describe('⭐⭐ JAN-PRQUAL PQ-1 (REG-F-481) — the fingerprint reaches the skeleton’s GENERATED TABLE and the READER its chooser models: a family or a rule dropped moves the fences probe, and it alone', () => {
	// ⛔ WHY (`PQ-1`; `REG-F-481`, `REG-F-476`): the table reads a lookalike through one of six families — what a reader does
	// not see (deleted), TR39's lookalikes, the case of a TR39 prototype's characters (the ASCII fold, or the case
	// mappings rule 2 reads them through), either case of the code point, a compatibility decomposition, and a TR39 class
	// read through a member's decomposition (rule 4) — and the stated supplement, which no plant reaches and the
	// skeleton's digest hashes (`fingerprint.ts`); and the reader its chooser models reads by four rules of how a code
	// point is read besides (a line terminator a reader may not break at, read as nothing too; every reading of a code
	// point; a line with a bidi control, laid out reversed; a code point outside the Basic Multilingual Plane, read
	// whole) and seven of how a slice is (an isolate or an embedding lays a line out as the override does; every line
	// that holds a control is laid out; a control anywhere in a line lays it out; a line laid out runs across the
	// terminators a reader may not break at; a candidate may begin while another is open, and inside a reading; and a
	// line is laid out with its runs reversed too). While no probe planted a lookalike, a table that read none moved no
	// fingerprint; while one plant stood at one point of each slice rule, a reader without the rule moved none either.
	// `P-OVERSIZE-FENCES` plants one spelling per family and per rule, each read by that family or rule alone
	// (`probes.ts` `FENCE_PLANTS`). Each row regenerates the table from the committed inputs with one family dropped, or
	// loads the chooser with one rule dropped, loads the fingerprint afresh over it, and asks which probes moved, and
	// where the view's token went. ~~one of four families~~ — the ASCII fold, the class reading and the reader's rules
	// were added after it was written.
	const EXTRACTS = committedExtracts(REPO);
	const DATA = parseUnicode(
		Object.fromEntries(SOURCES.map((s) => [s.key, readExtract(s, EXTRACTS[s.key])])) as Record<InputKey, string[]>
	);
	const TABLE_MODULE_ID = '../apps/rph-demo/src/lib/server/assurance/fence-skeleton-table.js';
	/** The fingerprint, loaded afresh over `table` in place of the committed one, and the fences probe's view token — over
	 *  `cases`, case set v1 unless a row asks for the current set (`PQ-2`). */
	const freshOver = async (table: FenceSkeletonTable, cases: readonly QualificationCase[] = CASES) => {
		vi.resetModules();
		vi.doMock(TABLE_MODULE_ID, () => ({ FENCE_SKELETON_UNICODE_VERSION: UNICODE_VERSION, DELETED: table.deleted, MAPPED: table.mapped }));
		try {
			const fingerprint = await import('../scripts/reviewer-qual/fingerprint.js');
			const probes = await import('../scripts/reviewer-qual/probes.js');
			const fp = await fingerprint.reviewerFingerprint(cases);
			const fences = probes.FINGERPRINT_PROBES.find((x) => x.id === 'P-OVERSIZE-FENCES')!.input(
				fingerprint.PRODUCT_SEAMS.criteria,
				fingerprint.PRODUCT_SEAMS.processResult
			);
			return { fp, viewToken: fences.content.split('\n').find((l) => FENCE_LINE.test(l)) };
		} finally {
			vi.doUnmock(TABLE_MODULE_ID);
			vi.resetModules();
		}
	};
	/** The fingerprint, loaded afresh over the fence module with `override` laid over its exports, and the fences probe's
	 *  view token — as `freshOver`, for a rule of the reader rather than a family of the table; over `cases`, as it is. */
	const freshOverReader = async (
		override: (real: typeof import('../apps/rph-demo/src/lib/server/assurance/review-fence.js')) => Record<string, unknown>,
		cases: readonly QualificationCase[] = CASES
	) => {
		vi.resetModules();
		vi.doMock(FENCE_MODULE_ID, async (importOriginal) => {
			const real = await importOriginal<typeof import('../apps/rph-demo/src/lib/server/assurance/review-fence.js')>();
			return { ...real, ...override(real) };
		});
		try {
			const fingerprint = await import('../scripts/reviewer-qual/fingerprint.js');
			const probes = await import('../scripts/reviewer-qual/probes.js');
			const fp = await fingerprint.reviewerFingerprint(cases);
			const fences = probes.FINGERPRINT_PROBES.find((x) => x.id === 'P-OVERSIZE-FENCES')!.input(
				fingerprint.PRODUCT_SEAMS.criteria,
				fingerprint.PRODUCT_SEAMS.processResult
			);
			return { fp, viewToken: fences.content.split('\n').find((l) => FENCE_LINE.test(l)) };
		} finally {
			vi.doUnmock(FENCE_MODULE_ID);
			vi.resetModules();
		}
	};
	const FAMILIES: readonly (readonly [name: string, table: () => FenceSkeletonTable, token: string])[] = [
		[
			'the DELETED family — what a reader does not see (a zero-width space inside 01, in the rationale)',
			() => fenceSkeletonTable({ ...DATA, deleted: new Set() }),
			'<<<UNTRUSTED-01>>>'
		],
		[
			'TR39’s lookalikes (the Cyrillic ZE for the digit of 03, in stdout’s HEAD, after exact 00 and 02)',
			() => fenceSkeletonTable({ ...DATA, confusables: new Map() }),
			'<<<UNTRUSTED-03>>>'
		],
		[
			// ~~`fenceSkeletonTable(DATA, (c) => c)`, the fold alone~~ — rule 2 reads a prototype's characters in either case
			// besides (`REG-F-481`), so the fold alone reads nothing the case mappings do not (the row below holds that), and
			// the two are dropped together: dropped alone, either reads the small o as the other did.
			'the case of a TR39 prototype’s characters — the ASCII fold, an input of the generator, and the case mappings rule 2 reads them through, dropped together (the Devanagari zero of 04, in stdout’s TAIL, whose prototype is a small o)',
			() => fenceSkeletonTable({ ...DATA, upper: new Map(), lower: new Map() }, (c) => c),
			'<<<UNTRUSTED-04>>>'
		],
		[
			'the either-case family (the Cyrillic small te of 05, in stderr, read through its capital)',
			() => fenceSkeletonTable({ ...DATA, upper: new Map(), lower: new Map() }),
			'<<<UNTRUSTED-05>>>'
		],
		[
			'the compatibility decompositions (the superscript six of 06, in the account’s assumptions)',
			() => fenceSkeletonTable({ ...DATA, decompositions: new Map([...DATA.decompositions].filter(([, d]) => !d.compat)) }),
			'<<<UNTRUSTED-06>>>'
		],
		[
			// ⭐ RULE 4 ALONE: every compatibility decomposition read as `<compat>`, which rule 4 excludes — rule 3 reads a
			// decomposition by its parts and never by its tag, so nothing else changes.
			'a TR39 class read through a member’s decomposition — rule 4 (the DEGREE SIGN for the 0 of 09, in the instruction, read through the class the masculine ordinal indicator’s `<super>` o reads)',
			() =>
				fenceSkeletonTable({
					...DATA,
					decompositions: new Map([...DATA.decompositions].map(([cp, d]) => [cp, d.compat ? { ...d, tag: '<compat>' } : d] as const))
				}),
			'<<<UNTRUSTED-09>>>'
		]
		// ~~'a line separator read away — a table the generator refuses to write (the view’s own 08, split by one in
		// stderr)', `<<<UNTRUSTED-09>>>`~~ — `PQ-1` (`REG-F-481`): the chooser reads U+2028 as nothing already, so a table
		// that deletes it changes nothing; the rule is the READER's (`UNBROKEN_TERMINATORS`), and its row is below.
	];
	/**
	 * ⭐ THE READER'S RULES OF HOW A SLICE IS READ (`review-fence.ts` `readSlice`) — written again here a rule at a time, over
	 * the product's own reading of each code point (`fenceReadings`, `reversedReadings`, `reordersLine`), so that ONE
	 * such rule can be dropped alone: no chooser laid over the real one can drop it by handing the real one other
	 * slices. `dropped` names the rule, and the reader then reads as one without it would — a line laid out under the
	 * override alone; the first line of a slice that holds a control alone; a line laid out only when a control begins
	 * it; a laid-out line broken at every terminator a reader may not break at; a candidate begun only where none is
	 * open; a candidate begun only where a reading begins; no line laid out with its runs reversed. ⭑ A CONTROL below loads
	 * the fingerprint over it with NO rule dropped and finds the tree — every probe and every witness of the reader
	 * corpus chosen as the product chooses it — so a row's move is its rule's alone.
	 */
	type SliceRule =
		| 'an isolate or an embedding'
		| 'every line'
		| 'anywhere in a line'
		| 'across a terminator'
		| 'while another is open'
		| 'inside a reading'
		| 'runs reversed'
		// ⭐ AND THREE RULES NO PLANT STANDS ON, WITNESSED BY THE READER CORPUS ALONE (`probes.ts` `READER_CORPUS`): a
		// candidate may END inside a reading; a reading that holds a bracket breaks a run whatever its length; and every
		// reading of a code point is read (dropped: its first alone — the rule the table row below drops for the probes).
		| 'ending inside a reading'
		| 'a reading of several brackets'
		| 'every reading';
	const statedReader = (real: typeof import('../apps/rph-demo/src/lib/server/assurance/review-fence.js'), dropped?: SliceRule) => {
		const candidates = Array.from({ length: real.FENCE_CANDIDATE_COUNT }, (_, n) => real.fenceCandidate(n));
		const whole = new Set(candidates);
		const begun = new Set(candidates.flatMap((c) => Array.from({ length: c.length - 1 }, (_, i) => c.slice(0, i + 1))));
		const laysOut = (cp: number): boolean => (dropped === 'an isolate or an embedding' ? cp === 0x202e : real.reordersLine(cp));
		/** A code point's readings in a line read in order — and, `every reading` dropped, its first alone. */
		const readingsOf = (cp: number): readonly string[] => (dropped === 'every reading' ? real.fenceReadings(cp).slice(0, 1) : real.fenceReadings(cp));
		/** …and in a line laid out reversed: each as written, and mirrored where it holds a bracket. */
		const reversedOf = (cp: number): readonly string[] => {
			if (dropped !== 'every reading') return real.reversedReadings(cp);
			const forward = readingsOf(cp);
			const mirrored = forward.map((r) => [...r].map((c) => (c === '<' ? '>' : c === '>' ? '<' : c)).join(''));
			return [...new Set([...forward, ...mirrored])];
		};
		/** Every candidate some choice of readings spells, position by position, into `held`. */
		const spell = (positions: readonly (readonly string[])[], held: Set<string>): void => {
			let open: string[] = [];
			for (const readings of positions) {
				const next: string[] = [];
				const carry = (text: string): void => {
					if (text.length >= real.FENCE_LENGTH) {
						const ends = dropped !== 'ending inside a reading' || text.length === real.FENCE_LENGTH;
						if (ends && whole.has(text.slice(0, real.FENCE_LENGTH))) held.add(text.slice(0, real.FENCE_LENGTH));
					} else if (begun.has(text) && !next.includes(text)) next.push(text);
				};
				for (const reading of readings) {
					for (const prefix of open) carry(prefix + reading);
					const starts =
						dropped === 'while another is open' && open.length > 0
							? 0
							: dropped === 'inside a reading'
								? Math.min(1, reading.length)
								: reading.length;
					for (let at = 0; at < starts; at += 1) carry(reading.slice(at));
				}
				open = next;
			}
		};
		/** A line's code points with its runs reversed: a run of code points no reading of which holds `<`, `>` or `-`
		 *  keeps its order; every other code point is a position of its own, read as written and mirrored. */
		const withRunsReversed = (line: readonly number[]): (readonly string[])[] => {
			const groups: (readonly string[])[][] = [];
			let run: (readonly string[])[] = [];
			for (const cp of line) {
				const breaks = (r: string): boolean =>
					(dropped !== 'a reading of several brackets' || r.length === 1) && (r.includes('<') || r.includes('>') || r.includes('-'));
				if (readingsOf(cp).some(breaks)) {
					if (run.length > 0) groups.push(run);
					groups.push([reversedOf(cp)]);
					run = [];
				} else run.push(readingsOf(cp));
			}
			if (run.length > 0) groups.push(run);
			return groups.reverse().flat();
		};
		/** A slice's lines, broken at each line feed — and, the rule `across a terminator` dropped, at every terminator. */
		const linesOf = (slice: string): number[][] => {
			const lines: number[][] = [[]];
			for (const c of slice) {
				const cp = c.codePointAt(0)!;
				if (cp === 0x0a || (dropped === 'across a terminator' && real.UNBROKEN_TERMINATORS.includes(cp))) lines.push([]);
				else lines[lines.length - 1]!.push(cp);
			}
			return lines;
		};
		return (slices: readonly string[]): string | undefined => {
			const held = new Set<string>();
			for (const slice of slices) {
				spell([...slice].map((c) => readingsOf(c.codePointAt(0)!)), held);
				let laidOut = 0;
				for (const line of linesOf(slice)) {
					const lays = dropped === 'anywhere in a line' ? line.length > 0 && laysOut(line[0]!) : line.some(laysOut);
					if (!lays || (dropped === 'every line' && laidOut > 0)) continue;
					laidOut += 1;
					if (dropped !== 'runs reversed') spell(withRunsReversed(line), held);
					spell([...line].reverse().map((cp) => reversedOf(cp)), held);
				}
			}
			return candidates.find((c) => !held.has(c));
		};
	};
	/**
	 * ⭐ THE READER'S FOUR RULES OF HOW A CODE POINT IS READ (`review-fence.ts`), each dropped: a chooser laid over the real
	 * one that hands it each slice as a reader WITHOUT the rule would see it — every terminator a break alone, no bidi
	 * control to lay a line out reversed, or each code point outside the Basic Multilingual Plane as its first UTF-16
	 * unit — or, for the reading set, a table that keeps each code point's first reading alone. ⭐ AND ITS SEVEN OF HOW A
	 * SLICE IS READ, each dropped from the reader re-stated above (`statedReader`).
	 */
	const READER_RULES: readonly (readonly [name: string, load: (cases?: readonly QualificationCase[]) => ReturnType<typeof freshOver>, token: string])[] = [
		[
			'a line terminator a reader may not break at, read as nothing too — each read as a break alone (the view’s own 08, split by a raw U+2028 in stderr)',
			(cases) =>
				freshOverReader((real) => ({
					chooseFence: (slices: readonly string[]) =>
						real.chooseFence(
							slices.map((s) => [...s].map((c) => (real.UNBROKEN_TERMINATORS.includes(c.codePointAt(0)!) ? '\n' : c)).join(''))
						)
				}), cases),
			'<<<UNTRUSTED-08>>>'
		],
		[
			'every reading of a code point — the first alone (the tall te of 10, in stderr, which TR39 reads as 7 and its capital as T)',
			(cases) => freshOver({ deleted: DELETED, mapped: MAPPED.filter(([cp], i) => i === 0 || MAPPED[i - 1]![0] !== cp) }, cases),
			'<<<UNTRUSTED-10>>>'
		],
		[
			'a line holding a bidi control, read laid out reversed — no line reversed (11, written backwards after a RIGHT-TO-LEFT OVERRIDE, in stderr)',
			(cases) =>
				freshOverReader((real) => ({
					chooseFence: (slices: readonly string[]) =>
						real.chooseFence(slices.map((s) => [...s].filter((c) => !real.reordersLine(c.codePointAt(0)!)).join('')))
				}), cases),
			'<<<UNTRUSTED-11>>>'
		],
		[
			// ⭐ A code point outside the Basic Multilingual Plane is two UTF-16 units: a reader that looked it up by its first
			// unit alone reads a lone surrogate, never the lookalike (driven on a disposable copy: no probe moved).
			'a code point outside the Basic Multilingual Plane, read whole — its first UTF-16 unit alone (the MATHEMATICAL BOLD DIGIT ZERO of 02, in argv)',
			(cases) =>
				freshOverReader((real) => ({
					chooseFence: (slices: readonly string[]) =>
						real.chooseFence(slices.map((s) => [...s].map((c) => (c.length === 2 ? c[0]! : c)).join('')))
				}), cases),
			'<<<UNTRUSTED-02>>>'
		],
		[
			'an isolate or an embedding lays a line out, as the override does — the override alone (12, written backwards between a RIGHT-TO-LEFT ISOLATE and its pop, in the instruction)',
			(cases) => freshOverReader((real) => ({ chooseFence: statedReader(real, 'an isolate or an embedding') }), cases),
			'<<<UNTRUSTED-12>>>'
		],
		[
			'every line of a slice that holds a control is laid out — the first alone (13, after an override on the second line of stderr that holds one)',
			(cases) => freshOverReader((real) => ({ chooseFence: statedReader(real, 'every line') }), cases),
			'<<<UNTRUSTED-13>>>'
		],
		[
			'a control anywhere in a line lays it out — only a control that begins it (14, after an override mid-line, in stderr)',
			(cases) => freshOverReader((real) => ({ chooseFence: statedReader(real, 'anywhere in a line') }), cases),
			'<<<UNTRUSTED-14>>>'
		],
		[
			'a line laid out runs across the terminators a reader may not break at — broken at each (15, after an override, split by a U+2028, in stderr)',
			(cases) => freshOverReader((real) => ({ chooseFence: statedReader(real, 'across a terminator') }), cases),
			'<<<UNTRUSTED-15>>>'
		],
		[
			'a candidate may begin while another is open — only where none is (16, after a fourth bracket, in stderr)',
			(cases) => freshOverReader((real) => ({ chooseFence: statedReader(real, 'while another is open') }), cases),
			'<<<UNTRUSTED-16>>>'
		],
		[
			'a candidate may begin inside a reading — only where a reading begins (17, its first two brackets U+226A, which reads as <<, in stderr)',
			(cases) => freshOverReader((real) => ({ chooseFence: statedReader(real, 'inside a reading') }), cases),
			'<<<UNTRUSTED-17>>>'
		],
		[
			'a line is laid out with its runs reversed too — code point by code point alone (18, its digits before its name inside a RIGHT-TO-LEFT EMBEDDING, in stderr)',
			(cases) => freshOverReader((real) => ({ chooseFence: statedReader(real, 'runs reversed') }), cases),
			'<<<UNTRUSTED-18>>>'
		]
	];

	it('⭑ CONTROL — the committed inputs, generated afresh, ARE the committed table, and a fresh load over them measures the tree', async () => {
		const table = fenceSkeletonTable(DATA);
		// ⭐ `PQ-1` — the fingerprint asked first: a table edited by hand moves the skeleton's digest, which `probes` hashes.
		const { fp, viewToken } = await freshOver(table);
		expect(fp.reviewer, 'a fresh load over the committed table measures the tree').toBe(BASE.reviewer);
		expect([table.deleted, table.mapped], 'the generator over the committed inputs').toEqual([DELETED, MAPPED]);
		expect(viewToken).toBe('<<<UNTRUSTED-19>>>');
	}, 120_000);

	it('⭑ CONTROL — a chooser laid over the real one, handed every slice unchanged, measures the tree: a reader row’s move is its rule’s, never the reload’s', async () => {
		const { fp, viewToken } = await freshOverReader((real) => ({
			chooseFence: (slices: readonly string[]) => real.chooseFence([...slices])
		}));
		expect(fp.reviewer, 'a fresh load over the laid chooser measures the tree').toBe(BASE.reviewer);
		expect(viewToken).toBe('<<<UNTRUSTED-19>>>');
	}, 120_000);

	it('⭑ CONTROL — the reader re-stated here, NO rule dropped, measures the tree: every probe and every witness of the reader corpus is chosen as the product chooses it, so a slice rule’s row moves by its rule alone', async () => {
		const { fp, viewToken } = await freshOverReader((real) => ({ chooseFence: statedReader(real) }));
		expect(fp.reviewer, 'a fresh load over the re-stated reader measures the tree').toBe(BASE.reviewer);
		expect(viewToken).toBe('<<<UNTRUSTED-19>>>');
	}, 120_000);

	/**
	 * ⭐ THE READER'S RULES NO PLANT STANDS ON, each dropped from the reader re-stated above: the reader corpus alone
	 * witnesses them (`probes.ts` `READER_CORPUS`), so each moves `probes` through the corpus and no probe's prompt.
	 * ⛔ No witness stood on either, so a reader that held a candidate only where a reading ended at its end, or broke a
	 * run only at a reading that IS one bracket, moved no fingerprint (driven on a disposable copy).
	 */
	const CORPUS_ONLY_RULES: readonly (readonly [name: string, rule: SliceRule])[] = [
		['a candidate may END inside a reading — only where a reading ends with it (U+226B, which reads as >>)', 'ending inside a reading'],
		['a reading that holds a bracket breaks a run, however many characters it has — only one that IS a bracket (U+226B)', 'a reading of several brackets']
	];
	it.each(CORPUS_ONLY_RULES)(
		'⭐ the reader’s rule: %s — dropped, it moves `probes` through the reader corpus alone, and no probe’s prompt, nor any case prompt of v1 or of the current set (PQ-2)',
		async (_name, rule) => {
			const { fp, viewToken } = await freshOverReader((real) => ({ chooseFence: statedReader(real, rule) }));
			onlyMoved(fp, ['probes']);
			expect(movedProbes(fp), 'no probe’s prompt moves: the reader corpus alone').toEqual([]);
			expect(viewToken).toBe('<<<UNTRUSTED-19>>>');
			expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
			// ⭐ `PQ-2` (design D4) — nor any of the current set's.
			const now = (await freshOverReader((real) => ({ chooseFence: statedReader(real, rule) }), CURRENT_CASES)).fp;
			expect(movedCasePrompts(now, BASE_NOW), 'no case prompt of the current set moves').toEqual([]);
		},
		240_000
	);

	/** A rule a witness of the reader corpus stands on: a rule of how a slice is read, or one of how a code point is. */
	type WitnessRule =
		| SliceRule
		| 'a line terminator a reader may not break at, read as nothing too'
		| 'a line holding a bidi control, laid out'
		| 'a code point outside the Basic Multilingual Plane, read whole';
	/** The reader without `rule`: the product's chooser over each slice as a reader without it would see it, or the reader
	 *  re-stated above with the rule dropped. */
	const readerWithout = (real: typeof import('../apps/rph-demo/src/lib/server/assurance/review-fence.js'), rule: WitnessRule) => {
		if (rule === 'a line terminator a reader may not break at, read as nothing too')
			return (slices: readonly string[]) =>
				real.chooseFence(slices.map((s) => [...s].map((ch) => (real.UNBROKEN_TERMINATORS.includes(ch.codePointAt(0)!) ? '\n' : ch)).join('')));
		if (rule === 'a line holding a bidi control, laid out')
			return (slices: readonly string[]) => real.chooseFence(slices.map((s) => [...s].filter((ch) => !real.reordersLine(ch.codePointAt(0)!)).join('')));
		if (rule === 'a code point outside the Basic Multilingual Plane, read whole')
			return (slices: readonly string[]) => real.chooseFence(slices.map((s) => [...s].map((ch) => (ch.length === 2 ? ch[0]! : ch)).join('')));
		return statedReader(real, rule);
	};
	const two = (n: number): string => String(n).padStart(2, '0');
	/** The terminators a reader may not break a line at, and the reader's bidi controls, as the corpus names them. */
	const TERMINATOR_NAMES = ['U+000D', 'U+000B', 'U+000C', 'U+0085', 'U+2028', 'U+2029'] as const;
	const CONTROL_NAMES = ['U+202A', 'U+202B', 'U+202C', 'U+202D', 'U+202E', 'U+2066', 'U+2067', 'U+2068', 'U+2069'] as const;
	/**
	 * ⭐⭐ THE READER CORPUS'S COMPOSITION, WITNESS BY WITNESS, BY LABEL — and, for each witness that stands on a rule of
	 * the reader, that rule. ⛔ The corpus was pinned by its hash alone, so a witness removed, or kept by its label with
	 * the code point it witnesses taken out, kept every test green (driven on a disposable copy): a moved hash owed an
	 * acknowledged line, and nothing told its writer that a rule had lost its witness.
	 */
	const CORPUS: readonly (readonly [label: string, rule?: WitnessRule])[] = [
		...Array.from({ length: 19 }, (_, n) => [`READ — the plant of <<<UNTRUSTED-${two(n)}>>> (FENCE_PLANTS), after every candidate below it`] as const),
		['NOT READ — LINES: a line feed breaks every line, so a candidate split by one is no line a reader sees'],
		['NOT READ — LAYOUT: a line that holds no bidi control is not laid out reversed'],
		['NOT READ — LAYOUT: a line that holds no bidi control is not laid out with its runs reversed'],
		['NOT READ — EACH SLICE ON ITS OWN: a candidate begun at the end of one slice and ended at the start of the next'],
		['READ — LOGICAL ORDER: a slice that holds a candidate’s bytes holds the candidate'],
		['NOT READ — EACH SLICE ON ITS OWN: a candidate astride two slices is in neither'],
		['NOT READ — LINES: a candidate split by a line feed'],
		...TERMINATOR_NAMES.map(
			(t) => [`READ — LINES: ${t} may not break a line, so it reads as nothing too`, 'a line terminator a reader may not break at, read as nothing too'] as const
		),
		['READ — LOOKALIKES: a code point a reader does not see reads as nothing (U+200B ZERO WIDTH SPACE)'],
		['READ — LOOKALIKES: a code point read its FIRST way (U+1C84, which TR39 reads as 7)'],
		['READ — LOOKALIKES: and its SECOND (U+1C84, whose capital reads as T)', 'every reading'],
		[
			'READ — LOOKALIKES: a code point outside the Basic Multilingual Plane is read whole (U+1D7CE MATHEMATICAL BOLD DIGIT ZERO)',
			'a code point outside the Basic Multilingual Plane, read whole'
		],
		['NOT READ — LOOKALIKES: a code point the table does not read as another reads as itself alone (U+0023 NUMBER SIGN, no digit)'],
		['READ — POSITION BY POSITION: a candidate may begin while another is open (a fourth bracket)', 'while another is open'],
		['READ — POSITION BY POSITION: a candidate may begin inside a reading (U+226A, which reads as <<)', 'inside a reading'],
		['READ — POSITION BY POSITION: a reading may be a candidate’s whole first part (U+22D8, which reads as <<<)'],
		...CONTROL_NAMES.map(
			(c) => [`READ — LAYOUT: a line that holds ${c} is laid out reversed, code point by code point`, 'a line holding a bidi control, laid out'] as const
		),
		...CONTROL_NAMES.map((c) => [`READ — LAYOUT: a line that holds ${c} is laid out with its runs reversed`, 'runs reversed'] as const),
		['NOT READ — LAYOUT: a line that holds no control, reversed code point by code point'],
		['NOT READ — LAYOUT: a line that holds no control, with its runs reversed'],
		['NOT READ — LAYOUT, NOT MODELLED: U+200F RIGHT-TO-LEFT MARK is no control the reader names'],
		['NOT READ — LAYOUT, NOT MODELLED: nor is U+061C ARABIC LETTER MARK'],
		['READ — LAYOUT: a line laid out is read with its brackets as written, too'],
		['READ — LAYOUT: and with its runs reversed, its brackets as written', 'runs reversed'],
		['READ — LAYOUT: a control MID-LINE lays the line out', 'anywhere in a line'],
		['READ — LAYOUT: so does a control at the line’s END', 'anywhere in a line'],
		['READ — LAYOUT: EVERY line that holds a control is laid out, not the first alone', 'every line'],
		['READ — LAYOUT: a line laid out runs across a terminator a reader may not break at (U+2028)', 'across a terminator'],
		['NOT READ — LAYOUT: a control lays out its own line alone, not the line after it'],
		['NOT READ — LAYOUT: nor the line before it'],
		[
			'NOT READ — CANONICAL ORDER, NOT MODELLED: combining marks are read in the order written — U+0345 then U+1BF3, which in canonical order, U+1BF3 first, read as the -1 of -10'
		],
		...TERMINATOR_NAMES.filter((t) => t !== 'U+2028').map(
			(t) => [`READ — LAYOUT: a line laid out reversed runs across ${t} too`, 'across a terminator'] as const
		),
		...TERMINATOR_NAMES.map(
			(t) => [`READ — LAYOUT: a line laid out with its runs reversed runs across ${t}, inside a run`, 'across a terminator'] as const
		),
		[
			'READ — LAYOUT: a reading that holds a bracket breaks a run, however many characters it has (U+226B, which reads as >>)',
			'a reading of several brackets'
		],
		['READ — LAYOUT: a line its control ENDS is laid out with its runs reversed too', 'anywhere in a line'],
		['READ — POSITION BY POSITION: a candidate may END inside a reading (U+226B, which reads as >>)', 'ending inside a reading'],
		['NOT READ — LAYOUT, NOT MODELLED: U+200F reorders a line that holds no control the reader names — its runs, as UAX #9 displays it'],
		['NOT READ — LAYOUT, NOT MODELLED: and so does U+061C — its runs, as UAX #9 displays it'],
		['NOT READ — LAYOUT, NOT MODELLED: a right-to-left letter is no control the reader names (U+05D0 HEBREW LETTER ALEF)'],
		[
			'NOT READ — LAYOUT, NOT MODELLED: a paragraph laid out right to left because its first strong character is (U+05D0, a space, then the candidate its runs reversed)'
		],
		[
			'NOT READ — LAYOUT, NOT MODELLED: right-to-left letters laid out right to left (U+05E1 SAMEKH, read as 0, then U+05D5 VAV, read as 1: displayed as 10)'
		],
		['NOT READ — LAYOUT, NOT MODELLED: a line laid out in PARTS (U+202E mid-line, only the part after it reversed)'],
		['NOT READ — LAYOUT, NOT MODELLED: embeddings nested in one another (U+202D LEFT-TO-RIGHT OVERRIDE inside U+202E)'],
		[
			'NOT READ — LAYOUT, NOT MODELLED: runs drawn by Bidi_Class — digits before the line’s first letter, split by a space a reader does not see, inside U+202B (displayed 0 1)'
		],
		['NOT READ — LAYOUT, NOT MODELLED: runs drawn by Bidi_Class — a neutral read as a fence character (U+222A UNION, read as U), inside U+202B'],
		[
			'NOT READ — LAYOUT, NOT MODELLED: runs drawn by Bidi_Class — a letter read as a bracket keeps its place in its letter run (U+304F HIRAGANA LETTER KU, read as <), inside U+202B'
		],
		[
			'NOT READ — LAYOUT, NOT MODELLED: digits reordered with NO control — Arabic-Indic digits split by a space (U+0661 read as 1, U+0665 as 0: displayed 01)'
		],
		[
			'NOT READ — LAYOUT, NOT MODELLED: digits reordered with NO control — a digit after a right-to-left letter (U+05D5 VAV, read as 1, a space, then 0: displayed 01)'
		],
		['READ — THE CANDIDATES: every one but the last occurring, the last is chosen'],
		['NOT READ — THE CANDIDATES: every one occurring, none is chosen — the chooser fails closed']
	];

	it('⭐ THE READER CORPUS’S COMPOSITION — every witness, by label and in order, each with a slice that is not empty; and each witness that stands on a rule of the reader parts from its stated token when that rule is dropped', async () => {
		expect(READER_CORPUS.map((w) => w.rule), 'the corpus, witness by witness').toEqual(CORPUS.map(([label]) => label));
		expect(
			READER_CORPUS.filter((w) => !w.slices.some((s) => s !== '')).map((w) => w.rule),
			'every witness holds a slice that is not empty'
		).toEqual([]);
		const real = await import('../apps/rph-demo/src/lib/server/assurance/review-fence.js');
		const unparted = READER_CORPUS.flatMap((w, i) => {
			const rule = CORPUS[i]?.[1];
			if (rule === undefined) return [];
			const chosen = readerWithout(real, rule)(w.slices) ?? null;
			return chosen === w.token ? [`${w.rule}: with “${rule}” dropped it is still ${String(w.token)}`] : [];
		});
		expect(unparted, 'each witness of a rule parts from its token without the rule').toEqual([]);
		// ⭑ CONTROL: the reader re-stated with NO rule dropped chooses every witness as the corpus states — so a witness that
		// parts above parts by its rule alone.
		const stated = statedReader(real);
		expect(
			READER_CORPUS.filter((w) => (stated(w.slices) ?? null) !== w.token).map((w) => w.rule),
			'CONTROL: no rule dropped, every witness chosen as stated'
		).toEqual([]);
		expect(CORPUS.filter(([, rule]) => rule !== undefined).length, 'the arrangement: the witnesses that stand on a rule').toBe(47);
	}, 60_000);

	/** Each code point a witness's label names, `U+` and its hex digits, in the label's order. */
	const namedIn = (label: string): number[] => [...label.matchAll(/U\+([0-9A-F]{4,6})\b/g)].map((m) => parseInt(m[1]!, 16));
	/** The code points a witness's label names that none of its slices holds — one line each. */
	const unheld = (corpus: readonly (typeof READER_CORPUS)[number][]): string[] =>
		corpus.flatMap((w) =>
			namedIn(w.rule)
				.filter((cp) => !w.slices.some((s) => [...s].some((c) => c.codePointAt(0) === cp)))
				.map((cp) => `${w.rule}: U+${cp.toString(16).toUpperCase().padStart(4, '0')} is in none of its slices`)
		);
	it('⛔ EVERY WITNESS HOLDS THE CODE POINTS ITS LABEL NAMES — each U+XXXX a witness’s rule names occurs in its slices, so a witness kept by its label with its code point taken out is named; ⭑ CONTROL: the right-to-left mark’s witness, its slice the mark’s alone taken out, is found', () => {
		// ⛔ WHY (`PQ-1`; `REG-F-481`): the composition row holds each witness by its label and its slice as not empty, and the
		// reader row that reads U+200F as a control is carried by the corpus's SECOND U+200F witness — so the first, its
		// slice replaced by one with no U+200F, kept every test green (driven at `PQ-1`'s landing): its label went on naming
		// a witness the corpus no longer held.
		expect(unheld(READER_CORPUS), 'the code points each label names, held by its slices').toEqual([]);
		// The arrangement: the labels that name a code point, and every one of them is read.
		expect(READER_CORPUS.filter((w) => namedIn(w.rule).length > 0).length, 'the arrangement: witnesses that name a code point').toBeGreaterThan(40);
		expect(namedIn('U+1D7CE and U+0023, not U+12'), 'the arrangement: four to six hex digits, astral ones too').toEqual([0x1d7ce, 0x23]);
		// ⭑ CONTROL — the witness of U+200F RIGHT-TO-LEFT MARK as no control the reader names, its slice replaced by one with
		// no mark: the row names exactly it.
		const label = 'NOT READ — LAYOUT, NOT MODELLED: U+200F RIGHT-TO-LEFT MARK is no control the reader names';
		expect(READER_CORPUS.filter((w) => w.rule === label), 'the arrangement: one such witness').toHaveLength(1);
		const stripped = READER_CORPUS.map((w) => (w.rule === label ? { ...w, slices: ['<<<UNTRUSTED-0x>>>'] } : w));
		expect(unheld(stripped), 'CONTROL: the witness whose slice lost its mark, named').toEqual([`${label}: U+200F is in none of its slices`]);
	});

	it('⭐ the reader changed where NO probe plants — U+200F RIGHT-TO-LEFT MARK read as a control it names — moves `probes` through the reader corpus, and no probe’s prompt, nor any case prompt of v1 or of the current set (PQ-2)', async () => {
		// ⛔ WHY (`PQ-1`; `REG-F-481`, `REG-F-476`): a reader changed where no plant stood moved no fingerprint (driven on a
		// disposable copy), and plants will always lag the reader. The reader corpus is hashed beside the probes for it, as
		// the skeleton's digest is for a table changed where no plant stands (the row above).
		const RLM = String.fromCodePoint(0x200f);
		expect(
			FINGERPRINT_PROBES.filter((p) => BASE.probePrompts.get(p.id)!.includes(RLM)).map((p) => p.id),
			'the arrangement: no probe’s prompt holds it'
		).toEqual([]);
		const rlmAsAControl = (real: typeof import('../apps/rph-demo/src/lib/server/assurance/review-fence.js')) => ({
			chooseFence: (slices: readonly string[]) => real.chooseFence(slices.map((s) => s.split(RLM).join(String.fromCodePoint(0x202e))))
		});
		const { fp, viewToken } = await freshOverReader(rlmAsAControl);
		onlyMoved(fp, ['probes']);
		expect(movedProbes(fp), 'no probe’s prompt moves: the reader corpus alone').toEqual([]);
		expect(viewToken).toBe('<<<UNTRUSTED-19>>>');
		expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
		// ⭐ `PQ-2` (design D4) — nor any case prompt of the current set: no case holds the mark.
		expect(movedCasePrompts((await freshOverReader(rlmAsAControl, CURRENT_CASES)).fp, BASE_NOW), 'no case prompt of the current set moves').toEqual(
			[]
		);
	}, 240_000);

	it('⭑ THE ARRANGEMENT — the ASCII fold ALONE is no family: rule 2 reads a prototype’s characters in either case besides, so the table is the same without it (which is why its row drops the case mappings with it)', () => {
		const t = fenceSkeletonTable(DATA, (c) => c);
		expect([t.deleted, t.mapped], 'the generator without the fold').toEqual([DELETED, MAPPED]);
	}, 120_000);

	it('⭐ the table changed where NO probe plants — one entry read otherwise, its code point in no probe’s prompt — moves `probes` through the skeleton’s digest, and no probe’s prompt, nor any case prompt of v1 or of the current set (PQ-2)', async () => {
		// ⛔ WHY (`PQ-1`; `REG-F-481`, `REG-F-476`): the plants reach six families and the reader's rules, and the table holds
		// thousands of entries;
		// a change to one no plant holds — a lookalike read no more, a reading changed — decided the fence for an input that
		// holds it, and moved no fingerprint (driven on a disposable copy: a table reading 253 more lookalikes moved
		// nothing, nor did one whose deleted ranges each stopped one code point short). The skeleton's digest is hashed
		// beside the probes for it.
		const cp = 0x2474; // PARENTHESIZED DIGIT ONE, read as `(1)` through its compatibility decomposition
		expect(MAPPED.find(([c]) => c === cp)?.[1], 'the arrangement: an entry of the committed table').toBe('(1)');
		expect(
			FINGERPRINT_PROBES.filter((p) => [...BASE.probePrompts.get(p.id)!].some((c) => c.codePointAt(0) === cp)).map((p) => p.id),
			'the arrangement: no probe’s prompt holds it'
		).toEqual([]);
		const table: FenceSkeletonTable = { deleted: DELETED, mapped: MAPPED.map(([c, r]) => [c, c === cp ? '(2)' : r] as const) };
		const { fp, viewToken } = await freshOver(table);
		onlyMoved(fp, ['probes']);
		expect(movedProbes(fp), 'no probe’s prompt moves: the digest alone').toEqual([]);
		expect(viewToken).toBe('<<<UNTRUSTED-19>>>');
		expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
		// ⭐ `PQ-2` (design D4) — nor any case prompt of the current set: no case holds the code point.
		expect(movedCasePrompts((await freshOver(table, CURRENT_CASES)).fp, BASE_NOW), 'no case prompt of the current set moves').toEqual([]);
	}, 240_000);

	it.each(FAMILIES)(
		'⭐ %s — dropped, it moves `probes` through P-OVERSIZE-FENCES alone, its view’s token falling to the plant it no longer reads',
		async (_name, table, token) => {
			const { fp, viewToken } = await freshOver(table());
			onlyMoved(fp, ['probes']);
			expect(movedProbes(fp), 'the one probe that plants a lookalike').toEqual(['P-OVERSIZE-FENCES']);
			expect(viewToken, 'the view’s token: the first plant the table no longer reads').toBe(token);
		},
		120_000
	);

	/**
	 * ⭐ DESIGN §9.3 D7 — THE PROBES BESIDE P-OVERSIZE-FENCES A RULE OF THE READER, DROPPED, MOVES: the account-breaks
	 * probes split each field's six candidates by the terminators a reader may not break at (`probes.ts`
	 * `BREAKS_ACCOUNT`), so that rule moves them too; ~~every other rule moves P-OVERSIZE-FENCES alone~~ ⭐ and lay three
	 * lines of each field out, one by each family of controls (`probes.ts` `LAID_OUT_LINES`), two of them with their runs
	 * reversed, each after a list's `  - ` and, in the prose, after the field's first such line — so each rule those
	 * lines stand on moves them too: a line holding a control laid out at all, an isolate or an embedding laying a line
	 * out, every line holding one laid out, a control anywhere in a line laying it out, and a line laid out with its runs
	 * reversed. Every other rule moves P-OVERSIZE-FENCES alone.
	 */
	const ACCOUNT_BREAKS_RULES: readonly string[] = [
		'a line terminator a reader may not break at',
		'a line holding a bidi control',
		'an isolate or an embedding lays a line out',
		'every line of a slice that holds a control',
		'a control anywhere in a line',
		'a line is laid out with its runs reversed'
	];
	const movedByRule = (name: string): string[] =>
		ACCOUNT_BREAKS_RULES.some((rule) => name.startsWith(rule))
			? ['G-ACCOUNT-BREAKS', 'W-ACCOUNT-BREAKS', 'P-OVERSIZE-FENCES', 'P-ACCOUNT-BREAKS']
			: ['P-OVERSIZE-FENCES'];
	it.each(READER_RULES)(
		'⭐ the reader’s rule: %s — dropped, it moves `probes` through P-OVERSIZE-FENCES and the probes that plant by that rule alone (the account-breaks probes, by a terminator and by each layout rule their laid-out lines stand on), its view’s token falling to the plant it no longer reads',
		async (name, load, token) => {
			const { fp, viewToken } = await load();
			onlyMoved(fp, ['probes']);
			expect(movedProbes(fp), 'the probes that plant by that rule of the reader').toEqual(movedByRule(name));
			expect(viewToken, 'the view’s token: the first plant the reader no longer reads').toBe(token);
			expect(fp.casePrompts, 'no case prompt moves').toEqual(BASE.casePrompts);
			// ⭐ `PQ-2` (design D4) — nor any case prompt of the current set, measured: no case holds a plant by that rule.
			expect(movedCasePrompts((await load(CURRENT_CASES)).fp, BASE_NOW), 'no case prompt of the current set moves').toEqual([]);
		},
		240_000
	);
});

describe('JAN-CRITREAD J2-3 — the scoring corpus', () => {
	it('⭐ it carries every REG-F-428 class and one repair, and reaches the ladder’s outcomes', async () => {
		const corpus = scoringCorpus(SEEDED_REASONING_REVIEW_CRITERIA);
		const ids = new Set(SEEDED_REASONING_REVIEW_CRITERIA.map((c) => c.id));
		const firstReply = (r: (typeof corpus)[number]) => {
			const x = r.replies[0]!;
			return typeof x === 'string' ? x : x.answer.arrived ? x.answer.text : '';
		};
		const classes = corpus.map((r) => detectMalformations(firstReply(r), ids));
		for (const k of ['DUPLICATE_KEY', 'UNDECLARED_CRITERION_ID', 'NON_BOOLEAN_FAILED', 'FENCED', 'PROSE_WRAPPED'])
			expect(classes.some((c) => c.includes(k as never)), k).toBe(true);
		expect(
			classes.filter((c) => c.includes('UNDECLARED_CRITERION_ID')).length,
			'an unknown id and a corrupted one'
		).toBeGreaterThanOrEqual(2);
		const dispositions = new Set<string>();
		let repaired = 0;
		for (const entry of corpus) {
			let n = 0;
			const e = await evaluateCase({
				case: CORPUS_CASE,
				criteria: SEEDED_REASONING_REVIEW_CRITERIA,
				candidate: FIXTURE,
				scoringDigest: '0'.repeat(64),
				call: async () => ({ returned: entry.replies[Math.min(n++, entry.replies.length - 1)]!, served: null })
			});
			dispositions.add(e.scored.disposition);
			if (e.calls.length === 2) repaired += 1;
		}
		expect(repaired, 'a reply that fails the first parse draws the repair prompt').toBeGreaterThanOrEqual(1);
		// ⭑ `JAN-ESCREC` ER-2 (design D4) — ESCALATED is an outcome of the ladder since `REG-D-089`'s rule (a) (`REG-D-090`,
		// `composeAssuranceOutcome`'s second pass), and the corpus reaches it: a set pin says only that SOME entry does —
		// which entry gives which disposition is the per-entry pin below.
		expect([...dispositions].sort()).toEqual(
			['BOUNDARY_REJECTED', 'ESCALATED', 'INCONCLUSIVE', 'REJECTED', 'SATISFIED', 'VALIDATOR_FAILED'].sort()
		);
	});

	it('⭐ `JAN-ESCREC` ER-2 (D4) — REG-D-089’s rule (a) from each side: each escalated entry PINNED BY ID to the disposition it scores', async () => {
		// ⛔ PER ENTRY, NOT AS A SET: the set pin above is kept green by any one entry reaching ESCALATED, so a mutant of
		// one entry — its fault dropped, its row restored, its producer report dropped — moves nothing it asks. Each row
		// here is one entry: the clean reply the rule escalates (`REG-D-089`); the same recommendation beside a BLOCKING
		// fault, which stays REJECTED, "more actionable" (the ruling's own reason); beside a row never answered, which stays
		// INCONCLUSIVE — rule (a) is keyed on the ladder's SATISFIED, never on "no criterion failed" (revision 2's
		// narrowing, `REG-D-090`; ASR-2's "invalid output"); and reported as the producer, which stays BOUNDARY_REJECTED —
		// the rule reads the VALID arm only (ASR-11). The result class says which arm each was scored in.
		// ⭑ THE ARRANGEMENT FIRST: each entry's one reply recommends ESCALATED, so no row can pass on an entry that no longer
		// asks for the rule — `one-fault`, `skipped-row` and `reported-as-producer` already score the last three dispositions.
		const pinned: readonly [id: string, disposition: string, resultClass: string][] = [
			['escalated-clean', 'ESCALATED', 'VALID'],
			['escalated-beside-a-fault', 'REJECTED', 'VALID'],
			['escalated-skipped-row', 'INCONCLUSIVE', 'VALID'],
			['escalated-reported-as-producer', 'BOUNDARY_REJECTED', 'BOUNDARY_REJECTED']
		];
		const corpus = scoringCorpus(SEEDED_REASONING_REVIEW_CRITERIA);
		for (const [id, disposition, resultClass] of pinned) {
			const entry = corpus.find((e) => e.id === id);
			expect(entry, `${id}: a corpus entry`).toBeDefined();
			expect(entry!.replies, `${id}: one reply, and no repair`).toHaveLength(1);
			const reply = entry!.replies[0]!;
			const text = typeof reply === 'string' ? reply : reply.answer.arrived ? reply.answer.text : '';
			expect((JSON.parse(text) as { recommendation?: unknown }).recommendation, `${id}: the reply recommends ESCALATED`).toBe(
				'ESCALATED'
			);
			const e = await evaluateCase({
				case: CORPUS_CASE,
				criteria: SEEDED_REASONING_REVIEW_CRITERIA,
				candidate: FIXTURE,
				scoringDigest: '0'.repeat(64),
				call: async () => ({ returned: reply, served: null })
			});
			expect([e.scored.disposition, e.scored.resultClass], id).toEqual([disposition, resultClass]);
		}
	});

	it('⭐ `JAN-ESCREC` ER-2 — REG-D-089’s rule (a) reads the LITERAL ESCALATED: a clean reply recommending CONDITIONALLY_SATISFIED, REJECTED or INCONCLUSIVE stays SATISFIED, each PINNED BY ID', async () => {
		// ⛔ THE RULE'S CONDITION (ii) FROM ITS OTHER SIDE (the ER-2 verifier's finding [3]): a clean review escalates when its
		// reviewer recommends ESCALATED and on no other value (`REG-D-090`) — the recommendation is otherwise never the
		// verdict (`REG-D-074`). Until these entries no corpus reply was clean with CONDITIONALLY_SATISFIED or REJECTED, so
		// the rule widened to either moved no corpus outcome and no fingerprint (`ER2-V7`). An INCONCLUSIVE widening already
		// moved `unknown-recommendation` — clean, recommending PASS, which the validator reads as INCONCLUSIVE — and the
		// fingerprint with it, but no pin named it (the ER-2 fix round's re-verifier's finding [5]); `floor.test.ts` alone
		// held the literal. The selected reviewer's commonest recommendation on clean work short of SATISFIED is
		// CONDITIONALLY_SATISFIED (`REG-F-456`), so a widening there would re-score its paid runs under an unmoved fingerprint.
		// ⭑ THE ARRANGEMENT FIRST: each entry's one reply recommends its value and answers every criterion clean, so no row
		// can pass on an entry that no longer stands where the rule must not reach.
		const pinned: readonly [id: string, recommendation: string][] = [
			['clean-recommends-conditionally-satisfied', 'CONDITIONALLY_SATISFIED'],
			['clean-recommends-rejected', 'REJECTED'],
			['clean-recommends-inconclusive', 'INCONCLUSIVE']
		];
		const corpus = scoringCorpus(SEEDED_REASONING_REVIEW_CRITERIA);
		const ids = SEEDED_REASONING_REVIEW_CRITERIA.map((c) => c.id);
		for (const [id, recommendation] of pinned) {
			const entry = corpus.find((e) => e.id === id);
			expect(entry, `${id}: a corpus entry`).toBeDefined();
			expect(entry!.replies, `${id}: one reply, and no repair`).toHaveLength(1);
			const reply = entry!.replies[0]!;
			expect(typeof reply, `${id}: a raw reply`).toBe('string');
			const judged = JSON.parse(reply as string) as {
				findings: readonly { criterionId: unknown; failed: unknown }[];
				recommendation: unknown;
			};
			expect(judged.recommendation, `${id}: the reply recommends ${recommendation}`).toBe(recommendation);
			expect(
				judged.findings.map((f) => [f.criterionId, f.failed]),
				`${id}: every criterion answered, none failed`
			).toEqual(ids.map((k) => [k, false]));
			const e = await evaluateCase({
				case: CORPUS_CASE,
				criteria: SEEDED_REASONING_REVIEW_CRITERIA,
				candidate: FIXTURE,
				scoringDigest: '0'.repeat(64),
				call: async () => ({ returned: reply, served: null })
			});
			expect([e.scored.disposition, e.scored.resultClass], id).toEqual(['SATISFIED', 'VALID']);
		}
	});
});

describe('JAN-SELREV SR-2 (D6) — the fingerprint measures the validator WITHOUT `requireReportedModel`', () => {
	it('⛔ a corpus reply reporting ANOTHER model is scored, never refused — by both of the fingerprint’s validators', async () => {
		// ⚠ THE TWO SEAMS ARE NOT GUARDED ALIKE. The fingerprint hashes the SCORING seam's outcomes, so the option set there
		// moves the fingerprint too (the copy test above). The PROBE seam never receives a corpus reply in the fingerprint —
		// its replies are bare strings that report no model — so the option set there moves no fingerprint component: THIS
		// test, handing it the corpus replies directly, is that seam's only guard.
		// ⭑ THE PREMISE, HELD: the corpus reaches the check. Three of its replies report a model other than the candidate's —
		// since `JAN-ESCREC` ER-2 (D4) the third is `escalated-reported-as-producer`, which the loop below holds alike.
		const reporting = scoringCorpus(SEEDED_REASONING_REVIEW_CRITERIA).filter(
			(e) => typeof e.replies[0] !== 'string'
		);
		expect(reporting.map((e) => e.id)).toEqual([
			'reported-as-producer',
			'reported-by-the-producers-provider',
			'escalated-reported-as-producer'
		]);
		for (const entry of reporting) {
			const reply = entry.replies[0] as ToolInvocationResult;
			expect(reply.producer.modelId, `${entry.id}: another model`).not.toBe(FIXTURE.modelLabel);
			// The SCORING seam — the runner's validator, which every corpus outcome is scored through.
			const e = await PRODUCT_SEAMS.evaluate({
				case: CORPUS_CASE,
				criteria: SEEDED_REASONING_REVIEW_CRITERIA,
				candidate: FIXTURE,
				scoringDigest: '0'.repeat(64),
				call: async () => ({ returned: reply, served: null })
			});
			expect(e.calls, `${entry.id}: one call, and no repair`).toHaveLength(1);
			expect(
				e.scored.criteria.length,
				`${entry.id}: scored as a THROW — the runner's validator refused the reported model`
			).toBeGreaterThan(0);
			expect(e.evaluator.modelId).toBe(reply.producer.modelId);
			// The PROBE seam — the product's validator as the fingerprint builds it, handed a reply it never meets there.
			const result = await PRODUCT_SEAMS.validator(async () => reply).evaluate(PROBE_SUBJECT, {
				reasoningReview: FINGERPRINT_PROBES[0]!.input(SEEDED_REASONING_REVIEW_CRITERIA, PRODUCT_SEAMS.processResult)
			});
			expect(result.executionFailed, `${entry.id}: the probe validator refused the reported model`).toBe(false);
			expect(result.evaluator.modelId).toBe(reply.producer.modelId);
		}
	});
});

const FIXTURE: CandidateIdentity = {
	transport: 'stub',
	agentId: 'stub',
	provider: 'jpwb-stub',
	modelLabel: 'stub-reviewer',
	servedModelDigest: null,
	servedTemplateSha256: null,
	servedModelfileSha256: null,
	templateInjectsDate: null,
	serverVersion: null,
	serverUtcOffset: null,
	options: {},
	bounds: { wallClockMs: 240_000, promptChars: null, printTimeout: null },
	argv: null
};

describe('JAN-CRITREAD J2-3 — the fingerprint and the runner agree', () => {
	it('⭐ the case prompts are the hashes a run records — the initial prompt and the repair', async () => {
		const two: QualificationCase[] = CASES.filter((c) => c.id === 'G-RR-04' || c.id === 'W-CLEAN');
		let n = 0;
		const lines = await runQualification({
			runId: 'qr-agree-1',
			date: '2026-09-24T12:00:00.000Z',
			commit: 'e5f9358b'.repeat(5),
			fingerprint: { reviewer: BASE.reviewer, scoring: BASE.scoring, caseSet: BASE.caseSet },
			cases: two,
			caseSetVersion: 1,
			oracleVersion: 1,
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			transport: {
				name: 'stub',
				identify: async () => FIXTURE,
				call: async () => ({
					returned:
						(n += 1) % 2 === 1
							? 'not a judgement'
							: JSON.stringify({
									findings: SEEDED_REASONING_REVIEW_CRITERIA.map((k) => ({
										criterionId: k.id,
										failed: false,
										statement: 'absent'
									})),
									recommendation: 'SATISFIED'
								}),
					served: null
				})
			},
			repetitions: 1,
			env: {}
		});
		const calls = lines.filter((l): l is CallLine => l.kind === 'CALL');
		expect(calls).toHaveLength(4);
		for (const call of calls)
			expect(call.promptSha256, `${call.caseId} ${call.role}`).toBe(BASE.casePrompts.get(call.caseId)![call.role]);
	});

	it('⭐ …and on the process-result arm (PQ-2, design D4): a process-result case’s prompts are the hashes a run records — its run literal rendered by the one builder on both sides', async () => {
		const two: QualificationCase[] = CURRENT_CASES.filter((c) => c.id === 'P-CLEAN' || c.id === 'P-RR-07-CUT');
		expect(two.map((c) => c.arm), 'the arrangement: two process results, one of them cut by design').toEqual([
			'PROCESS_RESULT',
			'PROCESS_RESULT'
		]);
		let n = 0;
		const lines = await runQualification({
			runId: 'qr-agree-2',
			date: '2026-10-09T12:00:00.000Z',
			commit: 'e5f9358b'.repeat(5),
			fingerprint: { reviewer: BASE_NOW.reviewer, scoring: BASE_NOW.scoring, caseSet: BASE_NOW.caseSet },
			cases: two,
			caseSetVersion: 4,
			oracleVersion: 4,
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			transport: {
				name: 'stub',
				identify: async () => FIXTURE,
				call: async () => ({
					returned:
						(n += 1) % 2 === 1
							? 'not a judgement'
							: JSON.stringify({
									findings: SEEDED_REASONING_REVIEW_CRITERIA.map((k) => ({
										criterionId: k.id,
										failed: false,
										statement: 'absent'
									})),
									recommendation: 'SATISFIED'
								}),
					served: null
				})
			},
			repetitions: 1,
			env: {}
		});
		const calls = lines.filter((l): l is CallLine => l.kind === 'CALL');
		expect(calls).toHaveLength(4);
		for (const call of calls)
			expect(call.promptSha256, `${call.caseId} ${call.role}`).toBe(BASE_NOW.casePrompts.get(call.caseId)![call.role]);
	});

	it('⭐ the case-set digest is over the cases’ inputs: an input edit moves it and moves no reviewer component', async () => {
		const edited = CASES.map((c) =>
			c.id === 'W-CLEAN' && c.arm === 'WORK_PRODUCT' ? { ...c, input: { ...c.input, answer: `${c.input.answer} ` } } : c
		);
		const fp = await reviewerFingerprint(edited);
		expect(fp.caseSet).not.toBe(BASE.caseSet);
		expect(fp.components).toEqual(BASE.components);
		expect(fp.casePrompts.get('W-CLEAN')).not.toEqual(BASE.casePrompts.get('W-CLEAN'));
		expect(fp.casePrompts.get('G-CLEAN')).toEqual(BASE.casePrompts.get('G-CLEAN'));
	});
});
