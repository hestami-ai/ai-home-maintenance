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

describe('⛔ R25 — what the reviewer’s report CANNOT say, and the rule that therefore cannot fire', () => {
	// ⛔ MY HYPOTHESIS WAS REFUTED BY THE EXISTING SUITE, AND THE REVERSAL IS THE POINT OF THIS BLOCK.
	//
	// I asserted that a criterion the reviewer never mentioned was being wrongly scored MET, and changed the
	// mapper to report it UNABLE_TO_DETERMINE. TWELVE EXISTING TESTS WENT RED — one named *"maps each failure
	// class to a mandatory criterion (MET iff absent)"* — and the contract states it at the type:
	// `ReasoningReviewFinding.failed` is documented *"True = the failure class IS present"*.
	//
	// ⭑ THE REVIEWER REPORTS FAILURE CLASSES. An absent finding is a POSITIVE STATEMENT that the failure did not
	// occur, not silence about the criterion. MET is correct, and my change would have made every clean review
	// INCONCLUSIVE — a refusal that looks like rigour and stops all work.
	it('⭑ a criterion with no finding against it is MET — because a finding IS a failure report', () => {
		const result = reasoningReviewResultFromJudgement(
			SUBJECT,
			EVALUATOR,
			'test.reviewer',
			judgement([{ criterionId: 'TA-01', failed: true, statement: 'not traced' }]),
			[criterion('TA-01', 'BLOCKING'), criterion('TA-02', 'BLOCKING')]
		);
		expect(outcomeOf(result, 'TA-01'), 'faulted').toBe('NOT_MET');
		expect(outcomeOf(result, 'TA-02'), 'not faulted, therefore met — this is the contract').toBe('MET');
	});

	// ⛔ THE RESIDUE, PINNED SO IT CANNOT CHANGE SILENTLY — AND THIS TEST ASSERTS A GAP, NOT A GUARANTEE.
	it('⛔ DISCLOSURE — a reviewer that engaged with NOTHING is indistinguishable from one that found nothing', () => {
		// ⚠ READ THIS AS A FILED DEFECT WITH A TEST, NOT AS A BLESSING. The judgement shape carries only FAULTS,
		// so `{ findings: [] }` is emitted both by a reviewer that evaluated every criterion and passed them all
		// and by one that never engaged. They are the same value and nothing downstream can tell them apart.
		//
		// ⛔ THE CONSEQUENCE IS THAT A RATIFIED RULE CANNOT FIRE. `dispositionFromFindings` returns INCONCLUSIVE
		// for a mandatory `UNABLE_TO_DETERMINE` and its docblock says *"never a pass"* — and no production path
		// emits that value, because this mapper has no input that means "not evaluated". `RPH-ASR-005` is
		// implemented and unreachable. Filed as `REG-F-407`.
		//
		// ⭐ WHEN THE CONTRACT GAINS A WAY TO SAY WHAT WAS EVALUATED, THIS TEST MUST GO RED AND BE REWRITTEN. Its
		// failure is the signal that the gap closed; leaving it green afterwards would be the fiction.
		const unengaged = reasoningReviewResultFromJudgement(
			SUBJECT,
			EVALUATOR,
			'test.reviewer',
			judgement([]),
			[criterion('TA-01', 'BLOCKING'), criterion('TA-08', 'BLOCKING')]
		);
		expect(unengaged.criteria.every((c) => c.outcome === 'MET'), 'every criterion reads as passed').toBe(
			true
		);
		expect(
			unengaged.criteria.some((c) => c.outcome === 'UNABLE_TO_DETERMINE'),
			'the ratified value for \u201ccould not determine\u201d is emitted by no production path'
		).toBe(false);
		expect(
			dispositionFromFindings({ findings: [], criteria: unengaged.criteria }),
			'so a review that judged nothing still composes to SATISFIED \u2014 the gap, stated'
		).toBe('SATISFIED');
	});

	it('⭑ CONTROL — an explicitly passed criterion is MET and composes to SATISFIED', () => {
		// Without this the disclosure above is satisfied by a mapper that answers MET unconditionally, which
		// would hide a genuine NOT_MET as easily as it hides a non-evaluation.
		const result = reasoningReviewResultFromJudgement(
			SUBJECT,
			EVALUATOR,
			'test.reviewer',
			judgement([{ criterionId: 'TA-01', failed: false, statement: 'traced' }]),
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
