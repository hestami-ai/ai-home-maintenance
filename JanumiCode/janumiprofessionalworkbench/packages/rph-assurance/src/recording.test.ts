import { describe, expect, it } from 'vitest';
import type { Disposition, Identity } from './assurance-rules.js';
import {
	deMinimisFloorPlan,
	FLOOR_POLICY_IDS,
	identityProvenanceValidator,
	schemaInvariantValidator,
	type AssuranceSubject,
	type FloorCriterion,
	type FloorObservation,
	type ValidatorResult
} from './floor.js';
import { assuranceRecordingPlan } from './recording.js';

const CODEX: Identity = {
	actorType: 'AGENT',
	agentId: 'executor',
	modelId: 'gpt-5.4-mini',
	providerId: 'openai'
};
const GEMINI: Identity = {
	actorType: 'AGENT',
	agentId: 'judge',
	modelId: 'gemini',
	providerId: 'google'
};

function subject(over: Partial<AssuranceSubject> = {}): AssuranceSubject {
	return {
		subjectId: 'pwa_1',
		objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		semanticVersion: 3,
		isAiProduced: true,
		producer: CODEX,
		...over
	};
}

function rr(
	s: AssuranceSubject,
	opts: {
		evaluator: Identity;
		criteria: FloorCriterion[];
		observations?: FloorObservation[];
		recommendation: Disposition;
	}
): ValidatorResult {
	return {
		policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
		policyVersion: '1',
		validatorId: 'agy.reasoning-review',
		validatorVersion: '1',
		subjectId: s.subjectId,
		subjectSemanticVersion: s.semanticVersion,
		evaluator: opts.evaluator,
		criteria: opts.criteria,
		observations: opts.observations ?? [],
		dispositionRecommendation: opts.recommendation,
		consideredEvidenceIds: [],
		rejectedEvidenceIds: [],
		residualUncertainty: [],
		executionFailed: false,
		limitations: []
	};
}
const MET: FloorCriterion[] = [{ criterionId: 'RR-01', mandatory: true, outcome: 'MET' }];
const goodSchema = { schemaValid: true, invariantViolations: [] };
const goodIdentity = {
	hasStableId: true,
	hasSemanticVersion: true,
	hasProvenance: true,
	hasProducer: true,
	traceComplete: true
};

function planFor(s: AssuranceSubject, results: ValidatorResult[]) {
	return assuranceRecordingPlan(s, deMinimisFloorPlan(s), results);
}

describe('assuranceRecordingPlan — floor run → canonical per-policy recording plan (§8.9)', () => {
	it('all floor policies SATISFIED (independent reviewer) → one assessment per policy, all SATISFIED, gate open', () => {
		const s = subject();
		const plan = planFor(s, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
		]);
		expect(plan.subjectId).toBe('pwa_1');
		expect(plan.subjectSemanticVersion).toBe(3);
		expect(plan.aggregate).toBe('SATISFIED');
		expect(plan.gatePermitsTransition).toBe(true);
		expect(plan.assessments.map((a) => a.policyId)).toEqual([
			FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			FLOOR_POLICY_IDS.IDENTITY_PROVENANCE,
			FLOOR_POLICY_IDS.REASONING_REVIEW
		]);
		expect(plan.assessments.every((a) => a.disposition === 'SATISFIED')).toBe(true);
		expect(plan.assessments.every((a) => a.observations.length === 0)).toBe(true);
		expect(plan.assessments.every((a) => a.independenceOk)).toBe(true);
	});

	it('a schema failure records a REJECTED schema assessment carrying the specific finding code + severity', () => {
		const s = subject();
		const plan = planFor(s, [
			schemaInvariantValidator(s, { schemaValid: false, invariantViolations: ['INV-DUP-ROOT'] }),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
		]);
		expect(plan.aggregate).toBe('REJECTED');
		expect(plan.gatePermitsTransition).toBe(false);
		const schema = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.SCHEMA_INVARIANT)!;
		expect(schema.disposition).toBe('REJECTED');
		expect(schema.observations.map((o) => o.code)).toEqual(['SCHEMA_INVALID', 'INV-DUP-ROOT']);
		expect(schema.observations[0]?.severity).toBe('CRITICAL');
		expect(schema.observations[1]?.severity).toBe('BLOCKING');
	});

	it('a MISSING required Reasoning Review records NO assessment for it (nothing ran) and the gate blocks', () => {
		const s = subject();
		const plan = planFor(s, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity)
			// Reasoning Review deliberately absent
		]);
		expect(plan.assessments.map((a) => a.policyId)).toEqual([
			FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			FLOOR_POLICY_IDS.IDENTITY_PROVENANCE
		]);
		expect(plan.aggregate).toBe('UNASSESSED');
		expect(plan.gatePermitsTransition).toBe(false);
	});

	it('a same-model Reasoning Review is boundary-rejected → recorded as INCONCLUSIVE with independenceOk false', () => {
		const s = subject();
		const plan = planFor(s, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: CODEX, criteria: MET, recommendation: 'SATISFIED' }) // same model as producer
		]);
		const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
		expect(review.disposition).toBe('INCONCLUSIVE');
		expect(review.independenceOk).toBe(false);
		expect(plan.gatePermitsTransition).toBe(false);
		// The violation must be a DURABLE OBSERVATION, not only the transient independenceOk flag: the recorder
		// persists observations, never the flag, so without this the violation vanishes at persistence and the
		// read-back fabricates independenceOk:true (§8.12 "record an independence violation"; finding 46 — an
		// Assessment can otherwise never reach a durable INDEPENDENCE_VIOLATION).
		expect(review.observations.map((o) => o.code)).toContain('INDEPENDENCE_VIOLATION');
		expect(review.observations.find((o) => o.code === 'INDEPENDENCE_VIOLATION')?.severity).toBe(
			'BLOCKING'
		);
	});

	it('a non-AI subject records only the two deterministic policies', () => {
		const s = subject({ isAiProduced: false });
		const plan = planFor(s, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity)
		]);
		expect(plan.assessments.map((a) => a.policyId)).toEqual([
			FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			FLOOR_POLICY_IDS.IDENTITY_PROVENANCE
		]);
		expect(plan.aggregate).toBe('SATISFIED');
	});
});
