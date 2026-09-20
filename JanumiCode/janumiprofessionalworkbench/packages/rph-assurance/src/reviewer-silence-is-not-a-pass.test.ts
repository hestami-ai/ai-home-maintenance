// ⭐⭐ A REVIEWER'S SILENCE IS NOT A PASS, AND A REVIEWER DOES NOT SET ITS OWN STAKES — `JAN-EXEC` `R25`.
//
// ── ⛔ THE RULING THIS RESTS ON, AND IT WAS OWED TO THE REGISTER BEFORE ANY CODE ───────────────────────────────
//
// `REG-Q-061` had been OPEN since 2026-08-23, naming `pol_test_adequacy`, asking whether adequacy is an
// engine-recorded determination or a validator-supplied judgment — and warning that *"each of the two obvious
// repairs would ratify a reading by accident"*. Ratified 2026-09-19: **the limb governs the VALIDATOR's
// judgment, not the engine's contracts.** So the engine mints no adequacy axis and adds no §20 field. It owes
// three things: that a competent reviewer was asked, that the report is carried FAITHFULLY, and that a
// satisfaction the report does not support is refused.
//
// ── ⛔ THE THIRD RULE IS BUILT AND CORRECT AND CANNOT FIRE — BUT NOT FOR THE REASON I FIRST WROTE ─────────
//
// `dispositionFromFindings` already returns INCONCLUSIVE for a mandatory `UNABLE_TO_DETERMINE`, with a docblock
// saying *"UNABLE_TO_DETERMINE on a mandatory criterion is INCONCLUSIVE (never a pass)"*. That IS `RPH-ASR-005`,
// and no production path emits the value it turns on.
//
// ⛔ MY FIRST DIAGNOSIS OF WHY WAS WRONG, AND TWELVE EXISTING TESTS REFUTED IT. I claimed the mapper wrongly
// scored an unmentioned criterion MET. It does not: `ReasoningReviewFinding.failed` is documented *"True = the
// failure class IS present"*, so the reviewer reports FAULTS and an absent finding is a positive statement that
// the fault did not occur. MET is correct. The change I made would have turned every clean review INCONCLUSIVE.
//
// ⭑ THE REAL REASON IS ONE LAYER UP AND IS A CONTRACT GAP, NOT A MAPPING BUG: the judgement shape carries only
// faults, so a reviewer that evaluated everything and a reviewer that engaged with nothing emit the same value.
// There is no input meaning "not evaluated", so there is no output meaning it either. Filed as `REG-F-407`; the
// DISCLOSURE test below pins it so it cannot change silently.
//
// ⚠ WHAT THIS FILE DOES CLOSE is the SECOND half: the reviewer no longer sets its own stakes.
import { describe, expect, it } from 'vitest';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { dispositionFromFindings } from './assurance-rules.js';
import type { AssuranceSubject } from './floor.js';
import { reasoningReviewResultFromJudgement } from './validators.js';
import type { ReasoningReviewJudgement } from './validators.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'pwu_01ARZ3NDEKTSV4RRFFQ69GR501',
	objectType: 'PROFESSIONAL_WORK_UNIT',
	semanticVersion: 1,
	isAiProduced: true,
	// ⚠ REQUIRED, AND `check-types` IS WHAT SAID SO — vitest ran this file green with the field missing, because
	// a structural mismatch is invisible at runtime. `producer` is the independence baseline the reviewer must
	// differ from, so a subject without one is not a subject this package can reason about.
	producer: { agentId: 'producer-1', actorType: 'AGENT' }
};

const EVALUATOR = { agentId: 'reviewer-1', actorType: 'HUMAN' as const };

/** A criterion in the ratified §9.1 shape. `severityIfNotMet` is the policy author's declaration of what an
 *  unmet criterion MEANS — the field the whole of fix (2) turns on. */
const criterion = (id: string, severityIfNotMet: string): AssessmentCriterion =>
	({
		id,
		name: id,
		description: `${id} description`,
		criterionType: 'BOOLEAN',
		evaluationMethod: 'MODEL_JUDGMENT',
		requiredEvidenceIds: [],
		severityIfNotMet,
		mayBeNotApplicable: false
	}) as AssessmentCriterion;

const judgement = (findings: ReasoningReviewJudgement['findings']): ReasoningReviewJudgement =>
	({ findings, recommendation: 'SATISFIED' }) as ReasoningReviewJudgement;

const outcomeOf = (result: { criteria: readonly { criterionId: string; outcome: string }[] }, id: string) =>
	result.criteria.find((c) => c.criterionId === id)?.outcome;

describe('⭐ R26 — absence means the reviewer did not judge it; a pass must be SAID', () => {
	// ⭐⭐ THIS BLOCK REPLACES A DISCLOSURE THAT WAS WRITTEN TO GO RED ON EXACTLY THIS CHANGE, AND DID.
	//
	// Yesterday it asserted the gap and said so in terms: *"when the contract gains a way to say what was
	// evaluated, this test must go red and be rewritten. Its failure is the signal that the gap closed."* It
	// failed on the first run after `R26`. ⭑ A disclosure test that reddens on its own remedy is the only kind
	// worth writing — the alternative is prose that silently stops being true.
	//
	// ⚠ AND THE ROUTE TO GETTING HERE WAS NOT STRAIGHT. I first claimed the contract COULD NOT express
	// non-evaluation and was refuted by twelve tests; the truth is that `failed` is a boolean, a `failed: false`
	// row is an explicit clean verdict, the live prompt already asks for one per criterion, and THIS MAPPER threw
	// the distinction away. The remedy was two lines; finding out which two took a day and a reversal.
	it('⛔ a criterion the reviewer did not mention is UNABLE_TO_DETERMINE, not MET', () => {
		const result = reasoningReviewResultFromJudgement(
			SUBJECT,
			EVALUATOR,
			'test.reviewer',
			judgement([{ criterionId: 'TA-01', failed: true, statement: 'not traced' }]),
			[criterion('TA-01', 'BLOCKING'), criterion('TA-02', 'BLOCKING')]
		);
		expect(outcomeOf(result, 'TA-01'), 'faulted').toBe('NOT_MET');
		expect(outcomeOf(result, 'TA-02'), 'never mentioned — so never judged').toBe('UNABLE_TO_DETERMINE');
	});

	it('⭐ a reviewer that judged NOTHING can no longer compose to SATISFIED', () => {
		// ⛔ THIS IS THE DEFECT `REG-F-409` MEASURED, CLOSED AT THE MAPPER. A review that addressed no criterion
		// used to produce a record in which every criterion read PASSED, and the floor opened the publish gate on
		// it. `dispositionFromFindings`'s mandatory-undetermined rule — built, correct, and unreachable until now
		// — finally fires.
		const unengaged = reasoningReviewResultFromJudgement(
			SUBJECT,
			EVALUATOR,
			'test.reviewer',
			judgement([]),
			[criterion('TA-01', 'BLOCKING'), criterion('TA-08', 'BLOCKING')]
		);
		expect(unengaged.criteria.every((c) => c.outcome === 'UNABLE_TO_DETERMINE')).toBe(true);
		expect(
			dispositionFromFindings({ findings: [], criteria: unengaged.criteria }),
			'never a pass'
		).toBe('INCONCLUSIVE');
	});

	it('⭑ CONTROL — a reviewer that SAYS a criterion is clean still reaches SATISFIED', () => {
		// ⚠ WITHOUT THIS, THE TWO ABOVE ARE SATISFIED BY A MAPPER THAT ANSWERS UNDETERMINED UNCONDITIONALLY —
		// which would make every review inconclusive forever, the exact trap I fell into and reverted a day ago.
		const result = reasoningReviewResultFromJudgement(
			SUBJECT,
			EVALUATOR,
			'test.reviewer',
			judgement([{ criterionId: 'TA-01', failed: false, statement: 'evaluated, clean' }]),
			[criterion('TA-01', 'BLOCKING')]
		);
		expect(outcomeOf(result, 'TA-01')).toBe('MET');
		expect(dispositionFromFindings({ findings: [], criteria: result.criteria })).toBe('SATISFIED');
	});
});

describe('⛔ R25 — the reviewer judges WHETHER a criterion is met; the policy declares what that MEANS', () => {
	// ── `PR-3` ───────────────────────────────────────────────────────────────────────────────────────────────
	it("⭐ a failed criterion's observation carries the POLICY's severityIfNotMet, not the model's opinion", () => {
		// ⛔ RED AT HEAD: the observation takes `f.severity ?? 'MATERIAL'`. The policy's declared severity governs
		// `mandatory`, which is package-private and never crosses the ratified command boundary — while the
		// observation, which IS what the kernel gate reads, carries whatever the reviewer felt like saying.
		const result = reasoningReviewResultFromJudgement(
			SUBJECT,
			EVALUATOR,
			'test.reviewer',
			judgement([
				{ criterionId: 'TA-08', failed: true, statement: 'overclaimed', severity: 'ADVISORY' }
			]),
			[criterion('TA-08', 'BLOCKING')]
		);
		const obs = result.observations.find((o) => o.code === 'TA-08');
		expect(obs?.severity, 'the judged party does not get to set its own stakes').toBe('BLOCKING');
	});

	// ── `PR-4` — the same defect in its most likely form ─────────────────────────────────────────────────────
	it('⭐ a failure reported with NO severity still carries the policy’s BLOCKING', () => {
		// ⚠ THIS IS THE LIKELIER SHAPE THAN AN ADVERSARIAL DOWNGRADE: `severity` is optional on the model's
		// finding, so an ordinary reviewer that simply omits it silently produced MATERIAL — and Gate C
		// (`rejectForeclosedDisposition`) forecloses on BLOCKING/CRITICAL only. The policy said BLOCKING and the
		// engine never heard it.
		const result = reasoningReviewResultFromJudgement(
			SUBJECT,
			EVALUATOR,
			'test.reviewer',
			judgement([{ criterionId: 'TA-08', failed: true, statement: 'overclaimed' }]),
			[criterion('TA-08', 'BLOCKING')]
		);
		expect(result.observations.find((o) => o.code === 'TA-08')?.severity).toBe('BLOCKING');
	});

	// ── `C-2` ────────────────────────────────────────────────────────────────────────────────────────────────
	it('⭑ CONTROL — an ADVISORY criterion keeps its advisory severity; the fix raises nothing it should not', () => {
		// ⛔ WITHOUT THIS, `PR-3` AND `PR-4` ARE SATISFIED BY HARDCODING 'BLOCKING', which would promote every
		// advisory criterion into a blocker — the mirror of the defect, and the one that would look like rigour.
		// The floor's own mapper docblock names this trap: hardcoding `mandatory: true` "would have silently
		// promoted any ADVISORY criterion the moment one was added".
		const result = reasoningReviewResultFromJudgement(
			SUBJECT,
			EVALUATOR,
			'test.reviewer',
			judgement([{ criterionId: 'ADV-01', failed: true, statement: 'a nit', severity: 'CRITICAL' }]),
			[criterion('ADV-01', 'ADVISORY')]
		);
		const obs = result.observations.find((o) => o.code === 'ADV-01');
		expect(obs?.severity, "the policy said ADVISORY and the reviewer may not escalate it either").toBe(
			'ADVISORY'
		);
		expect(
			result.criteria.find((c) => c.criterionId === 'ADV-01')?.mandatory,
			'an advisory criterion is not mandatory'
		).toBe(false);
	});
});
