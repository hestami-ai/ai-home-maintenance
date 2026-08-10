// A BLOCKING FINDING MUST FORECLOSE THE SIGN-OFF — and on this surface it could not (S-1b, B-1).
//
// ── THE DEFECT ────────────────────────────────────────────────────────────────────────────────────────────────
// DOC-004 §10.3's precedence ladder IS implemented and IS reachable: GATE C, `rejectForeclosedDisposition` in
// `completeAssuranceAssessment`. But it reads the POLICY's own rule and returns `null` the moment the policy has
// nothing to say:
//
//     const forbidden = new Set(dispositionRule?.forbiddenOpenSeverities ?? []);
//     if (forbidden.size === 0) return null;
//
// `dispositionRules` is `.optional()` on `CreateAssurancePolicyPayload`, and the Workbench Demo Sign-off policy
// declared none. So on the ONLY assurance surface the workbench has, an operator could record a BLOCKING finding
// and sign the work off SATISFIED in the same breath. **An optional policy field defaulting to "no constraint" is
// a gate switched off by silence.**
//
// ── PREDICTED RED ─────────────────────────────────────────────────────────────────────────────────────────────
// Delete `dispositionRules` from `DEMO_POLICY_PAYLOAD` and the first test here goes green-to-red the honest way:
// the SATISFIED completion is ACCEPTED while a BLOCKING observation stands. That is the state this repository
// shipped until 2026-08-10, and it is why S-1b could not simply add a "reject" button.
import { vi } from 'vitest';

// `workbench.ts` freezes RPH_DEMO_MODE into a module const at load; `vi.hoisted` is what runs early enough.
vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { createEngine, driveAssessmentToAssessing } from '@janumipwb/rph-engine';
import type { AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { beforeEach, describe, expect, it } from 'vitest';
import { SESSION_CREDENTIAL, standaloneAuthenticator } from '../identity.js';
import {
	DEMO_FINDING_CODE,
	DEMO_POLICY_ID,
	DEMO_POLICY_PAYLOAD,
	DEMO_POLICY_VERSION
} from './demo-policy.js';

const TS = '2026-08-10T12:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GB100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69GB110';
const OBS_A = 'obs_01ARZ3NDEKTSV4RRFFQ69GB1A0';
const OBS_B = 'obs_01ARZ3NDEKTSV4RRFFQ69GB1B0';
const OBS_C = 'obs_01ARZ3NDEKTSV4RRFFQ69GB1C0';
/** The operator IS the reviewer here (the policy declares independence NONE), so the evaluator must be real. */
const EVALUATOR = { actorId: 'demo-operator', actorType: 'HUMAN' as const, displayName: 'Operator' };

describe('§10.3 — a BLOCKING finding forecloses a SATISFIED sign-off on the demo policy', () => {
	let engine: AuthedEngineHandle;
	let seq = 0;

	function send(commandType: string, aggType: string, aggId: string, payload: unknown) {
		seq += 1;
		const command: DomainCommand = {
			commandId: `c-${seq}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: aggId,
			issuedAt: TS,
			correlationId: 's1b',
			idempotencyKey: `k-${seq}`,
			payload
		};
		return engine.dispatch(command);
	}
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};

	/** Stand up the PWU and the policy, then open an assessment and drive it to ASSESSING. */
	function openAssessment(assessmentId: string): void {
		ok(
			send('CreateAssurancePolicy', 'ASSURANCE_POLICY', DEMO_POLICY_ID, DEMO_POLICY_PAYLOAD),
			'CreateAssurancePolicy'
		);
		ok(
			send('ActivateAssurancePolicy', 'ASSURANCE_POLICY', DEMO_POLICY_ID, {
				policyId: DEMO_POLICY_ID
			}),
			'ActivateAssurancePolicy'
		);
		// THE RATIFIED §30 SEQUENCE, from the ONE helper that knows it — the same call the route makes. Writing the
		// commands out by hand here is how a test comes to assert against a lifecycle the product does not use; my
		// first attempt did exactly that and invented `OpenAssuranceAssessment`, which is not a command.
		driveAssessmentToAssessing(
			(commandType, aggType, aggId, payload) => {
				ok(send(commandType, aggType, aggId, payload), commandType);
			},
			{
				assessmentId,
				assurancePolicyId: DEMO_POLICY_ID,
				policyVersion: DEMO_POLICY_VERSION,
				subjectObjectIds: [PWU],
				subjectSemanticVersions: { [PWU]: 1 },
				claimIds: []
			}
		);
	}

	/**
	 * An observation is its OWN aggregate, not a write to the assessment.
	 *
	 * ⚠ I TARGETED THE ASSESSMENT FIRST and got "Revision conflict on asm_… (actual revision 2)", which reads like
	 * a concurrency problem and is really a category error: `RecordAssuranceObservation` mints an
	 * ASSURANCE_OBSERVATION carrying `assessmentId` as a REFERENCE. `recordAssuranceRecordingPlan` — the helper
	 * that already does this correctly — was the thing to read first.
	 */
	function recordObservation(assessmentId: string, severity: string, observationId: string) {
		return send('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', observationId, {
			assessmentId,
			observationType: 'FINDING',
			findingCode: DEMO_FINDING_CODE,
			severity,
			statement: `A ${severity} finding about the demo PWU.`
		});
	}

	function complete(assessmentId: string, dispositionRecommendation: string) {
		return send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			// The ratified DOC-007 §20 shape — SIXTEEN fields, `strictObject`. My first attempt invented
			// `criterionResults` and omitted six, and the refusal was a bare "Schema validation failed".
			validatorResult: {
				validatorId: 'workbench.demo-signoff',
				validatorVersion: '1',
				policyId: DEMO_POLICY_ID,
				policyVersion: DEMO_POLICY_VERSION,
				assessmentId,
				subjectObjectIds: [PWU],
				subjectSemanticVersions: { [PWU]: 1 },
				claimResults: [],
				evidenceConsideredIds: [],
				evidenceRejected: [],
				observations: [],
				dispositionRecommendation,
				recommendedControlActions: [],
				residualUncertainty: [],
				limitations: [],
				executionProvenance: { evaluator: EVALUATOR }
			},
			producer: EVALUATOR
		});
	}

	beforeEach(() => {
		seq = 0;
		engine = createEngine({
			authenticate: standaloneAuthenticator(),
			ontology,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(SESSION_CREDENTIAL);
		ok(
			send('CaptureIntent', 'INTENT', INTENT, {
				intentId: INTENT,
				originatingExpression: 'x',
				ontologyId: 'o',
				ontologyVersion: '1'
			}),
			'CaptureIntent'
		);
		ok(
			send('ProposePwu', 'PROFESSIONAL_WORK_UNIT', PWU, {
				pwuId: PWU,
				pwuKind: 'PWU',
				title: 'Demo PWU',
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: ['x'], outOfScope: ['y'], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: `out_${PWU}`, kind: 'DOCUMENT' }],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'MEDIUM',
					uncertainty: 'MEDIUM',
					irreversibility: 'LOW',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'NONE'
				}
			}),
			'ProposePwu'
		);
	});

	it('REFUSES a SATISFIED sign-off while a BLOCKING observation is open', () => {
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69GB120';
		openAssessment(assessmentId);
		ok(recordObservation(assessmentId, 'BLOCKING', OBS_A), 'RecordAssuranceObservation');

		const r = complete(assessmentId, 'SATISFIED');
		expect(r.status, 'a blocking finding must foreclose the sign-off').toBe('REJECTED');
		expect(r.error?.message, 'the refusal must cite §10.3').toContain('§10.3');
		expect(r.error?.message).toContain('BLOCKING');
	});

	it('ACCEPTS a REJECTED disposition for the same finding — the ladder chooses, the operator does not', () => {
		// The operator supplies the JUDGEMENT (a blocking statement); §10.3 supplies the disposition, by refusing
		// every other one. This is the arm S-1b's adverse act completes with.
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69GB130';
		openAssessment(assessmentId);
		ok(recordObservation(assessmentId, 'BLOCKING', OBS_B), 'RecordAssuranceObservation');
		ok(complete(assessmentId, 'REJECTED'), 'CompleteAssuranceAssessment(REJECTED)');
	});

	// CONTROL — the sign-off path STILL WORKS with no finding. Without this, the refusal above is equally
	// consistent with a policy that forbids SATISFIED outright, or an assurance surface that has stopped working.
	it('CONTROL — with NO observation, the SATISFIED sign-off is accepted', () => {
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69GB140';
		openAssessment(assessmentId);
		ok(complete(assessmentId, 'SATISFIED'), 'CompleteAssuranceAssessment(SATISFIED)');
	});

	// CONTROL — the foreclosure is SEVERITY-SENSITIVE, not "any observation blocks". An ADVISORY finding is a
	// professional remark, not a bar; a gate that treated it as one would make the surface unusable and would
	// pass the first test for the wrong reason.
	it('CONTROL — an ADVISORY observation does NOT foreclose the sign-off', () => {
		const assessmentId = 'asm_01ARZ3NDEKTSV4RRFFQ69GB150';
		openAssessment(assessmentId);
		ok(recordObservation(assessmentId, 'ADVISORY', OBS_C), 'RecordAssuranceObservation(ADVISORY)');
		ok(complete(assessmentId, 'SATISFIED'), 'CompleteAssuranceAssessment(SATISFIED)');
	});
});
