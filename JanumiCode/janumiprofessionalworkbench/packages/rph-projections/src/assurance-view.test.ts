// Unit tests for the Assurance View fold (pure, synthetic events). The end-to-end proof over the live log lives
// in rph-engine/src/assurance-view.test.ts; this file exercises the fold's DECISIONS in isolation — in
// particular the ones the live log cannot exercise because its data does not vary the way these tests need.
//
// WHY THIS FILE EXISTS: mutation testing caught the live-log test proving LESS than it claimed. Disabling the
// "open conditions only while CONDITIONALLY_SATISFIED" guard changed nothing over the reference undertaking,
// because that undertaking's SATISFIED assessments happen to carry an EMPTY residualUncertainty — so the guard
// was never distinguished from "just copy residualUncertainty". The guard is a real §38 correctness point (a
// satisfied node must not display phantom open conditions), and it needs a case the live log does not produce: a
// SATISFIED disposition WITH residuals present.
import type { DomainEvent } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { applyAssuranceEvent, buildAssuranceView, type AssuranceView } from './assurance-view.js';

const actor = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };

function evt(seq: number, eventType: string, payload: unknown): DomainEvent {
	return {
		eventId: `evt_${seq}`,
		eventType,
		eventSchemaVersion: 1,
		aggregateType: 'ASSURANCE_ASSESSMENT',
		aggregateId: `asm_${seq}`,
		aggregateRevision: 0,
		occurredAt: '2026-07-11T00:00:00Z',
		recordedAt: '2026-07-11T00:00:00Z',
		actor,
		correlationId: 'c1',
		payload
	};
}

const started = (assessmentId: string, subject: string) =>
	evt(1, 'AssuranceAssessmentStarted', {
		assessmentId,
		assurancePolicyId: 'pol_x',
		policyVersion: '1.0.0',
		subjectObjectIds: [subject],
		subjectSemanticVersions: { [subject]: 1 },
		claimIds: []
	});

const completed = (
	assessmentId: string,
	disposition: string,
	residuals: string[],
	independenceResult?: string
) =>
	evt(2, 'AssuranceAssessmentCompleted', {
		assessmentId,
		assurancePolicyId: 'pol_x',
		policyVersion: '1.0.0',
		subjectObjectIds: ['pwu_1'],
		subjectSemanticVersions: { pwu_1: 1 },
		disposition,
		evidenceConsideredIds: ['evd_1'],
		observationIds: [],
		residualUncertainty: residuals,
		recommendedControlActions: [],
		validatorId: 'acme.fitness-reviewer',
		validatorVersion: '2.1.0',
		...(independenceResult ? { independenceResult } : {})
	});

const violated = (assessmentId: string) =>
	evt(4, 'AssuranceIndependenceViolated', {
		assessmentId,
		assurancePolicyId: 'pol_x',
		policyVersion: '1.0.0',
		subjectObjectIds: ['pwu_1'],
		subjectSemanticVersions: { pwu_1: 1 },
		independenceRequirement: 'DIFFERENT_AGENT',
		reason: 'same agent identity'
	});

describe('Assurance View fold — open-conditions guard (the case the live log cannot make)', () => {
	it('a SATISFIED assessment carrying residualUncertainty still exposes ZERO open conditions', () => {
		// THE MUTATION-EXPOSED CASE. If the fold copied residualUncertainty regardless of disposition, this
		// SATISFIED assessment would show a phantom open condition — a satisfied node with an unresolved caveat,
		// which is exactly the false-reassurance §38's "open conditions" field exists to prevent in reverse.
		const view = buildAssuranceView([
			started('asm_a', 'pwu_1'),
			completed('asm_a', 'SATISFIED', ['a caveat that a satisfied disposition has resolved'])
		]);
		const a = view.assessments['asm_a']!;
		expect(a.disposition).toBe('SATISFIED');
		expect(a.openConditions, 'a SATISFIED assessment has no open conditions').toEqual([]);
	});

	it('a CONDITIONALLY_SATISFIED assessment surfaces its residuals AS open conditions', () => {
		const view = buildAssuranceView([
			started('asm_b', 'pwu_1'),
			completed('asm_b', 'CONDITIONALLY_SATISFIED', ['offline sync deferred', 'perf unverified'])
		]);
		const a = view.assessments['asm_b']!;
		expect(a.openConditions).toEqual(['offline sync deferred', 'perf unverified']);
	});

	it('an observation with no started assessment is dropped, not attached to a fabricated node', () => {
		// Absence must stay absence: an orphan observation cannot conjure an assessment into existence.
		const view = buildAssuranceView([
			evt(3, 'AssuranceObservationRecorded', {
				observationId: 'obs_1',
				assessmentId: 'asm_missing',
				policyId: 'pol_x',
				subjectObjectIds: ['pwu_1'],
				findingCode: 'X',
				severity: 'MATERIAL',
				statement: 's',
				implication: 'i',
				evidenceIds: [],
				disposition: 'OPEN'
			})
		]);
		expect(view.assessments['asm_missing']).toBeUndefined();
	});

	it('the fold is pure: order-preserving and idempotent per event', () => {
		const events = [
			started('asm_c', 'pwu_1'),
			completed('asm_c', 'CONDITIONALLY_SATISFIED', ['r'])
		];
		expect(buildAssuranceView(events)).toEqual(buildAssuranceView(events));
		// applying the completed event twice is a no-op (last-write-wins on the same fields).
		const once = buildAssuranceView(events);
		const twice: AssuranceView = applyAssuranceEvent(once, events[1]!);
		expect(twice).toEqual(once);
	});

	it('§38 sources validator implementation identity (id + version) from the completion event', () => {
		// Increment 37: validatorId/validatorVersion are on the §20 ValidatorResult and now threaded onto the event,
		// so the view shows WHO/WHAT judged.
		const view = buildAssuranceView([
			started('asm_d', 'pwu_1'),
			completed('asm_d', 'SATISFIED', [])
		]);
		const a = view.assessments['asm_d']!;
		expect(a.validatorImplementationIdentity).toBe('acme.fitness-reviewer');
		expect(a.validatorImplementationVersion).toBe('2.1.0');
	});

	it('§38 "independence status" — VERIFIED from the completion, VIOLATED from the event, undefined when the check did not run', () => {
		// Increment I4: the tri-state. VERIFIED rides the completion event (the check ran and passed); a completion
		// with no independenceResult means the check did not run — unknown, never a fabricated pass; and the negative
		// branch is the distinct AssuranceIndependenceViolated event (Increment I2), which also lands the assessment
		// in the ratified INDEPENDENCE_VIOLATION state.
		const view = buildAssuranceView([
			started('asm_v', 'pwu_1'),
			completed('asm_v', 'SATISFIED', [], 'VERIFIED'),
			started('asm_u', 'pwu_1'),
			completed('asm_u', 'SATISFIED', []), // no independenceResult — check did not run
			started('asm_x', 'pwu_1'),
			violated('asm_x')
		]);
		expect(view.assessments['asm_v']!.independenceStatus).toBe('VERIFIED');
		expect(view.assessments['asm_u']!.independenceStatus).toBeUndefined();
		const x = view.assessments['asm_x']!;
		expect(x.independenceStatus).toBe('VIOLATED');
		// A violated assessment never reached a disposition — it is in the ratified terminal violation state.
		expect(x.assessmentState).toBe('INDEPENDENCE_VIOLATION');
	});

	it('unknown-vs-none: an event WITHOUT validatorId leaves the identity undefined, never a faked value', () => {
		// A completion event missing the field (a pre-Increment-37 or malformed record) must read as "unknown", not
		// as some stand-in identity. The fold uses str(), which yields undefined rather than '' or a placeholder.
		const bare = evt(2, 'AssuranceAssessmentCompleted', {
			assessmentId: 'asm_e',
			assurancePolicyId: 'pol_x',
			policyVersion: '1.0.0',
			subjectObjectIds: ['pwu_1'],
			subjectSemanticVersions: { pwu_1: 1 },
			disposition: 'SATISFIED',
			evidenceConsideredIds: [],
			observationIds: [],
			residualUncertainty: [],
			recommendedControlActions: []
			// validatorId / validatorVersion deliberately absent
		});
		const view = buildAssuranceView([started('asm_e', 'pwu_1'), bare]);
		const a = view.assessments['asm_e']!;
		expect(a.validatorImplementationIdentity).toBeUndefined();
		expect(a.validatorImplementationVersion).toBeUndefined();
	});
});
