// ⭐⭐ A STIPULATED ROW IS NOT A PASS — `JAN-CRITREAD` J1-1a, `REG-D-071` Q4 (form D). Sibling of
// `reviewer-silence-is-not-a-pass.test.ts`, which pins `R26` at the mapper.
//
// ── WHAT A STIPULATION IS ─────────────────────────────────────────────────────────────────────────────────────
// In test engines only, a declared stand-in answers the reasoning review: the structural checker's real
// judgements, plus a CLEAN answer the test itself states for the criteria the checker cannot judge
// (`DESIGN-what-the-tests-prove.md` §4.1). Nobody judged those criteria, and the record must say so.
//
// ── ⛔ THE SHAPE THIS FILE EXISTS TO KEEP OUT ─────────────────────────────────────────────────────────────────
// Revision 1 of the design recorded a stipulated answer as `result: MET` plus a mark beside it. That is
// `REG-F-409`'s shape — an unjudged criterion recorded as passed — and every reader that did not know about the
// mark saw a pass. Form D records the TRUE value, `UNABLE_TO_DETERMINE`, and carries the claim beside it, so every
// reader that knows nothing of stipulations fails the row closed with no change. Only an engine built to admit
// stipulations counts one as met (`J1-1c`), and nothing in this file builds one.
import { describe, expect, it } from 'vitest';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { dispositionFromFindings } from './assurance-rules.js';
import type { AssuranceSubject } from './floor.js';
import { reasoningReviewResultFromJudgement } from './validators.js';
import type { ReasoningReviewJudgement } from './validators.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'pwa_01ARZ3NDEKTSV4RRFFQ69GS701',
	objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { agentId: 'producer-1', actorType: 'AGENT' }
};

const EVALUATOR = { agentId: 'standin-reviewer', actorType: 'AGENT' as const, modelId: 'standin' };

const criterion = (id: string): AssessmentCriterion =>
	({
		id,
		name: id,
		description: `${id} description`,
		criterionType: 'BOOLEAN',
		evaluationMethod: 'MODEL_JUDGMENT',
		requiredEvidenceIds: [],
		severityIfNotMet: 'BLOCKING',
		mayBeNotApplicable: false
	}) as AssessmentCriterion;

const POLICY = [criterion('RR-A'), criterion('RR-B'), criterion('RR-C')];

const map = (findings: ReasoningReviewJudgement['findings']) =>
	reasoningReviewResultFromJudgement(
		SUBJECT,
		EVALUATOR,
		'standin.reasoning-review',
		{ findings, recommendation: 'SATISFIED' } as ReasoningReviewJudgement,
		POLICY
	);

const row = (r: ReturnType<typeof map>, id: string) => r.criteria.find((c) => c.criterionId === id);

describe('⭐ REG-D-071 Q4 (form D) — a stipulated answer is recorded as NOT JUDGED, with the claim beside it', () => {
	it('⛔ a stipulated clean finding maps to UNABLE_TO_DETERMINE + stipulated MET — never to MET', () => {
		// THE MUTANT THAT KILLS THIS: record the stipulation AS the result — `REG-F-409`'s shape, and the one
		// revision 1 of the design was replaced for.
		const r = map([
			{ criterionId: 'RR-A', failed: false, statement: 'evaluated; clean' },
			{ criterionId: 'RR-B', failed: false, statement: 'stipulated clean by the test', stipulated: true }
		]);

		expect(row(r, 'RR-A'), 'a judged clean row is untouched').toMatchObject({ outcome: 'MET' });
		expect(row(r, 'RR-A')).not.toHaveProperty('stipulated');
		expect(row(r, 'RR-B'), 'nobody judged RR-B, and the record says so').toMatchObject({
			outcome: 'UNABLE_TO_DETERMINE',
			stipulated: 'MET'
		});
		expect(row(r, 'RR-C'), 'silence is still R26’s UNABLE_TO_DETERMINE, and carries no claim').toMatchObject({
			outcome: 'UNABLE_TO_DETERMINE'
		});
		expect(row(r, 'RR-C')).not.toHaveProperty('stipulated');
	});

	it('⭐ a stipulated row carries a rationale only when one was given — none is synthesized', () => {
		// As for every row (`record-criterion-result.test.ts`): an absent statement stays absent. A synthesized
		// rationale on a stipulated row would read as someone's reasoning about a criterion nobody judged.
		const r = map([{ criterionId: 'RR-B', failed: false, statement: '', stipulated: true }]);
		expect(row(r, 'RR-B')).toMatchObject({ outcome: 'UNABLE_TO_DETERMINE', stipulated: 'MET' });
		expect(row(r, 'RR-B')).not.toHaveProperty('rationale');
	});

	it('⛔ a stipulation never softens a FAULT: failed + stipulated is NOT_MET, with an open observation (REG-D-072 D4)', () => {
		// THE MUTANT: honour `stipulated` whatever `failed` says. A stipulated remainder is CLEAN by grammar, so a
		// row that is both could only come from a defect in the stand-in — and a defect must never turn a found
		// fault into an unjudged row, which an admitting engine would then count as met.
		const r = map([
			{ criterionId: 'RR-A', failed: true, statement: 'dead end', stipulated: true }
		]);

		expect(row(r, 'RR-A')).toMatchObject({ outcome: 'NOT_MET' });
		expect(row(r, 'RR-A')).not.toHaveProperty('stipulated');
		expect(r.observations.map((o) => o.code)).toEqual(['RR-A']);
	});

	it('⭐ the ladder, which knows nothing of stipulations, reads a stipulated remainder as INCONCLUSIVE', () => {
		// The point of recording the true value: `dispositionFromFindings` is unchanged and needs no branch — a
		// mandatory UNABLE_TO_DETERMINE is "never a pass", stipulated or not. Only `J1-1c`'s admitting branch,
		// in an engine built for tests, reads the claim.
		const r = map([
			{ criterionId: 'RR-A', failed: false, statement: 'evaluated; clean' },
			{ criterionId: 'RR-B', failed: false, statement: 'stipulated', stipulated: true },
			{ criterionId: 'RR-C', failed: false, statement: 'stipulated', stipulated: true }
		]);

		expect(
			dispositionFromFindings({
				findings: r.observations.map((o) => ({ severity: o.severity, open: o.open })),
				criteria: r.criteria
			})
		).toBe('INCONCLUSIVE');
	});
});
