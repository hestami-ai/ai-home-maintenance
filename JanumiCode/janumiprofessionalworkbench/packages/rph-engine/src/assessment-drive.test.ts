// REG-F-021 increment 4 — the assessment drive helper issues the ratified §30 sequence, in order.
//
// WHY THE ORDER IS THE ASSERTION. The helper's only job is that three production call sites cannot disagree about
// a lifecycle. A test that merely checked "all four commands were sent" would pass on a helper that begins an
// assessment before requesting it — which is the exact class of defect (an engine running the arrows in an order
// the corpus does not declare) that REG-F-021 records. So every assertion here is about SEQUENCE.
//
// The helper is driven with a COLLECTING send rather than a live engine: that is how the demo route uses it, and
// it isolates what this file is about. That the sequence is ACCEPTED by a real engine is proven where it matters —
// `record-assurance.test.ts` and `reference-undertaking.test.ts` drive it against live stores.
import type { ActorReference } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { driveAssessmentToAssessing, type AssessmentDriveSend } from './assessment-drive.js';

const ASSESSMENT = 'asmt_01ARZ3NDEKTSV4RRFFQ69G5M00';
const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5M01';
const EVALUATOR: ActorReference = {
	actorId: 'reviewer-1',
	actorType: 'HUMAN',
	displayName: 'Reviewer'
};

interface Sent {
	commandType: string;
	aggregateType: string;
	aggregateId: string;
	payload: Record<string, unknown>;
}

function collect(): { send: AssessmentDriveSend; sent: Sent[] } {
	const sent: Sent[] = [];
	const send: AssessmentDriveSend = (commandType, aggregateType, aggregateId, payload) => {
		sent.push({ commandType, aggregateType, aggregateId, payload: payload as Record<string, unknown> });
	};
	return { send, sent };
}

const BASE = {
	assessmentId: ASSESSMENT,
	assurancePolicyId: 'pol_x',
	policyVersion: '1.0.0',
	subjectObjectIds: [SUBJECT],
	subjectSemanticVersions: { [SUBJECT]: 1 },
	claimIds: []
};

describe('driveAssessmentToAssessing (REG-F-021 increment 4)', () => {
	it('issues request then begin, in that order, when the policy needs no blocking evidence', () => {
		const { send, sent } = collect();
		driveAssessmentToAssessing(send, BASE);
		expect(sent.map((s) => s.commandType)).toEqual([
			'RequestAssuranceAssessment',
			'BeginAssuranceAssessment'
		]);
		// Every command targets the assessment aggregate — a drive that addressed the subject instead would look
		// identical in a command-name-only assertion.
		expect(sent.every((s) => s.aggregateId === ASSESSMENT)).toBe(true);
		expect(sent.every((s) => s.aggregateType === 'ASSURANCE_ASSESSMENT')).toBe(true);
	});

	it('submits evidence BETWEEN the request and the begin — the EVIDENCE_PENDING -> READY arrow', () => {
		const { send, sent } = collect();
		driveAssessmentToAssessing(send, {
			...BASE,
			evidence: [
				{ evidenceId: 'evd_1', satisfiesRequirementId: 'EV-01' },
				{ evidenceId: 'evd_2', satisfiesRequirementId: 'EV-02', evidenceType: 'TRACE' }
			]
		});
		expect(sent.map((s) => s.commandType)).toEqual([
			'RequestAssuranceAssessment',
			'SubmitEvidenceForAssessment',
			'SubmitEvidenceForAssessment',
			'BeginAssuranceAssessment'
		]);
		// ORDER IS THE POINT: evidence submitted AFTER the begin would be recorded against an assessment already
		// ASSESSING, which the engine permits — so this would not fail loudly, it would just stop being the arrow.
		expect(sent[1]!.payload.satisfiesRequirementId).toBe('EV-01');
		expect(sent[2]!.payload.evidenceType).toBe('TRACE');
		// An omitted optional field is ABSENT, not undefined — a strictObject payload rejects an explicit undefined.
		expect(Object.keys(sent[1]!.payload)).not.toContain('evidenceType');
	});

	it('selects the evaluator BEFORE beginning — §30 names the acts in that order', () => {
		const { send, sent } = collect();
		driveAssessmentToAssessing(send, { ...BASE, evaluator: EVALUATOR });
		expect(sent.map((s) => s.commandType)).toEqual([
			'RequestAssuranceAssessment',
			'SelectAssuranceEvaluator',
			'BeginAssuranceAssessment'
		]);
		expect(sent[1]!.payload.evaluator).toEqual(EVALUATOR);
	});

	it('does NOT fabricate an evaluator when none is given', () => {
		// The selection act is the governed record of WHO assessed. Inventing one to fill the field would be worse
		// than the gap: a governed fact nobody decided. Callers that can name their evaluator should.
		const { send, sent } = collect();
		driveAssessmentToAssessing(send, BASE);
		expect(sent.map((s) => s.commandType)).not.toContain('SelectAssuranceEvaluator');
	});

	it('the full sequence, all four acts, in §30 order', () => {
		const { send, sent } = collect();
		driveAssessmentToAssessing(send, {
			...BASE,
			evidence: [{ evidenceId: 'evd_1', satisfiesRequirementId: 'EV-01' }],
			evaluator: EVALUATOR,
			startedAt: '2026-08-05T09:00:00Z'
		});
		expect(sent.map((s) => s.commandType)).toEqual([
			'RequestAssuranceAssessment',
			'SubmitEvidenceForAssessment',
			'SelectAssuranceEvaluator',
			'BeginAssuranceAssessment'
		]);
		expect(sent[3]!.payload.startedAt).toBe('2026-08-05T09:00:00Z');
	});

	it('omits startedAt entirely when not supplied — the engine clock decides, not a fabricated moment', () => {
		const { send, sent } = collect();
		driveAssessmentToAssessing(send, BASE);
		const begin = sent.find((s) => s.commandType === 'BeginAssuranceAssessment')!;
		expect(Object.keys(begin.payload)).toEqual([]);
	});

	it('CONTROL: the collector observes what it is given — an empty run would pass every "not.toContain" above', () => {
		const { send, sent } = collect();
		expect(sent).toEqual([]);
		send('X', 'Y', 'Z', {});
		expect(sent).toHaveLength(1);
	});
});
