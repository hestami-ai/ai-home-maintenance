import { describe, expect, it } from 'vitest';
import type { Disposition, Identity } from './assurance-rules.js';
import {
	composeAssuranceOutcome,
	deMinimisFloorPlan,
	FLOOR_POLICY_IDS,
	identityProvenanceValidator,
	schemaInvariantValidator,
	type AssuranceSubject,
	type FloorCriterion,
	type FloorObservation,
	type ValidatorResult
} from './floor.js';

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
		semanticVersion: 1,
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

describe('deMinimisFloorPlan — the mandatory ordered floor (§8.4)', () => {
	it('a non-AI subject gets schema + identity/provenance only', () => {
		const plan = deMinimisFloorPlan(subject({ isAiProduced: false }));
		expect(plan.map((p) => p.policyId)).toEqual([
			FLOOR_POLICY_IDS.SCHEMA_INVARIANT,
			FLOOR_POLICY_IDS.IDENTITY_PROVENANCE
		]);
	});
	it('an AI-produced subject additionally requires Reasoning Review with model independence', () => {
		const plan = deMinimisFloorPlan(subject({ isAiProduced: true }));
		expect(plan.map((p) => p.policyId)).toContain(FLOOR_POLICY_IDS.REASONING_REVIEW);
		const rrRef = plan.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
		expect(rrRef.required).toBe(true);
		expect(rrRef.independence).toBe('DIFFERENT_MODEL');
	});
});

describe('deterministic floor validators', () => {
	it('schema/invariant: valid → SATISFIED; invalid → REJECTED with a CRITICAL observation', () => {
		expect(schemaInvariantValidator(subject(), goodSchema).dispositionRecommendation).toBe(
			'SATISFIED'
		);
		const bad = schemaInvariantValidator(subject(), {
			schemaValid: false,
			invariantViolations: []
		});
		expect(bad.dispositionRecommendation).toBe('REJECTED');
		expect(bad.observations[0]?.severity).toBe('CRITICAL');
	});
	it('identity/provenance: complete → SATISFIED; missing provenance → REJECTED (BLOCKING)', () => {
		expect(identityProvenanceValidator(subject(), goodIdentity).dispositionRecommendation).toBe(
			'SATISFIED'
		);
		const bad = identityProvenanceValidator(subject(), { ...goodIdentity, hasProvenance: false });
		expect(bad.dispositionRecommendation).toBe('REJECTED');
		expect(bad.observations.some((o) => o.code === 'IP-03-provenance')).toBe(true);
	});
});

describe('composeAssuranceOutcome — the Assurance Service floor composition', () => {
	it('all floor policies SATISFIED with an independent reviewer → aggregate SATISFIED, gate OPEN', () => {
		const s = subject();
		const plan = deMinimisFloorPlan(s);
		const out = composeAssuranceOutcome(s, plan, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
		]);
		expect(out.aggregate).toBe('SATISFIED');
		expect(out.gatePermitsTransition).toBe(true);
	});

	it('a schema failure makes the aggregate REJECTED and blocks the gate', () => {
		const s = subject();
		const plan = deMinimisFloorPlan(s);
		const out = composeAssuranceOutcome(s, plan, [
			schemaInvariantValidator(s, { schemaValid: false, invariantViolations: [] }),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: GEMINI, criteria: MET, recommendation: 'SATISFIED' })
		]);
		expect(out.aggregate).toBe('REJECTED');
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('a missing required Reasoning Review leaves the floor UNASSESSED and blocks (never assume satisfied)', () => {
		const s = subject();
		const plan = deMinimisFloorPlan(s);
		const out = composeAssuranceOutcome(s, plan, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity)
			// Reasoning Review result deliberately absent
		]);
		expect(out.aggregate).toBe('UNASSESSED');
		expect(out.gatePermitsTransition).toBe(false);
		expect(
			out.perPolicy.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)?.disposition
		).toBe('MISSING');
	});

	it('a Reasoning Review by the SAME model as the producer is boundary-rejected (independence violation) and blocks', () => {
		const s = subject();
		const plan = deMinimisFloorPlan(s);
		const out = composeAssuranceOutcome(s, plan, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, { evaluator: CODEX, criteria: MET, recommendation: 'SATISFIED' }) // same model as producer
		]);
		const rrOut = out.perPolicy.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
		expect(rrOut.independenceOk).toBe(false);
		expect(rrOut.resultClass).toBe('BOUNDARY_REJECTED');
		expect(out.gatePermitsTransition).toBe(false);
	});

	it('a Reasoning Review recommending SATISFIED with an unmet mandatory criterion is boundary-rejected', () => {
		const s = subject();
		const plan = deMinimisFloorPlan(s);
		const out = composeAssuranceOutcome(s, plan, [
			schemaInvariantValidator(s, goodSchema),
			identityProvenanceValidator(s, goodIdentity),
			rr(s, {
				evaluator: GEMINI,
				criteria: [{ criterionId: 'RR-01', mandatory: true, outcome: 'NOT_MET' }],
				recommendation: 'SATISFIED'
			})
		]);
		const rrOut = out.perPolicy.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
		expect(rrOut.resultClass).toBe('BOUNDARY_REJECTED');
		expect(out.gatePermitsTransition).toBe(false);
	});
});
