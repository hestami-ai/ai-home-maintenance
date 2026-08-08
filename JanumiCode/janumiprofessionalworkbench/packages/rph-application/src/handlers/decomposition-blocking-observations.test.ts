// `DecompositionRejected.blockingObservationIds` — the DERIVATION, exercised (REG-F-020 residue).
//
// The field is the BLOCKING SUBSET of the observations a validator cited. `decomposition.ts` derives it by
// loading each cited id and keeping only those whose ASSURANCE_OBSERVATION carries a blocking severity, so a
// caller cannot declare a non-blocking observation to be the thing that blocked.
//
// NOTHING EXERCISED IT. Repo-wide, exactly one test passed `observationIds` to `ValidateDecomposition`, and with
// disposition `CONDITIONALLY_VALID` — which never reaches the rejection path. So the severity filter, the
// unresolvable-id rule, and the "not every cited observation is a blocker" distinction were all unproven, and the
// field was `[]` on every path the suite ever drove. A derivation with a careful comment and no arrangement is
// the shape this programme keeps finding; the comment is not the evidence.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-04T00:00:00Z';
const POLICY = 'pol_01ARZ3NDEKTSV4RRFFQ69JC100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69JC200';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69JC300';
const ASSESS = 'asm_01ARZ3NDEKTSV4RRFFQ69JC400';
const DC = 'dcp_01ARZ3NDEKTSV4RRFFQ69JC500';
const OBS_BLOCKING = 'obs_01ARZ3NDEKTSV4RRFFQ69JC600';
const OBS_MATERIAL = 'obs_01ARZ3NDEKTSV4RRFFQ69JC700';
const OBS_GHOST = 'obs_01ARZ3NDEKTSV4RRFFQ69JC800';

describe('DecompositionRejected.blockingObservationIds is derived from severity, not asserted', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const cmd = (
		commandType: string,
		targetAggregateId: string,
		targetAggregateType: string,
		payload: unknown
	): DomainCommand => {
		const n = ++seq;
		return {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			correlationId: 'blocking-obs',
			idempotencyKey: `k-${n}`,
			payload
		};
	};
	const ok = (c: DomainCommand): void => {
		const r = engine.dispatch(c);
		if (r.status !== 'ACCEPTED') throw new Error(`${c.commandType}: ${JSON.stringify(r.error)}`);
	};

	const observe = (id: string, severity: string): void =>
		ok(
			cmd('RecordAssuranceObservation', id, 'ASSURANCE_OBSERVATION', {
				assessmentId: ASSESS,
				observationType: 'FINDING',
				severity,
				statement: `a ${severity} observation`,
				evidenceIds: []
			})
		);

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `evt_${++seq}` }).as(TEST_CRED.human);

		ok(
			cmd('CreateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', {
				policyId: POLICY,
				version: '1.0.0',
				name: 'P',
				purpose: 'p',
				rationale: 'r',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['FITNESS'],
				criteria: [
					{
						id: 'C1',
						name: 'Fit',
						description: 'd',
						criterionType: 'QUALITATIVE',
						evaluationMethod: 'HUMAN_JUDGMENT',
						requiredEvidenceIds: [],
						severityIfNotMet: 'MATERIAL',
						mayBeNotApplicable: false
					}
				],
				evaluatorRole: 'REVIEWER',
				independenceRequirement: 'NONE',
				findingDefinitions: [
					{
						code: 'UNFIT',
						name: 'Unfit',
						description: 'd',
						defaultSeverity: 'MATERIAL',
						affectedClaimTypes: ['FITNESS'],
						defaultControlActions: ['CONTINUE']
					}
				],
				permittedControlActions: ['CONTINUE', 'REQUEST_HUMAN_DECISION', 'RESHAPE_PWU'],
				waiverRules: []
			})
		);
		ok(cmd('ActivateAssurancePolicy', POLICY, 'ASSURANCE_POLICY', { policyId: POLICY }));
		ok(
			cmd('CaptureIntent', INTENT, 'INTENT', {
				intentId: INTENT,
				originatingExpression: 'ship it',
				ontologyId: 'o',
				ontologyVersion: '1'
			})
		);
		ok(
			cmd('ProposePwu', PWU, 'PROFESSIONAL_WORK_UNIT', {
				pwuId: PWU,
				pwuKind: 'PRODUCT_REALIZATION',
				title: 'T',
				description: 'd',
				intentId: INTENT,
				boundaries: {
					inScope: ['the work'],
					outOfScope: ['not yet known'],
					permittedChanges: [],
					prohibitedChanges: []
				},
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: 'out_1', kind: 'DOCUMENT' }],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'HIGH',
					uncertainty: 'MEDIUM',
					irreversibility: 'MEDIUM',
					securitySensitivity: 'HIGH',
					regulatoryExposure: 'MEDIUM'
				}
			})
		);
		ok(
			cmd('RequestAssuranceAssessment', ASSESS, 'ASSURANCE_ASSESSMENT', {
				assessmentId: ASSESS,
				assurancePolicyId: POLICY,
				policyVersion: '1.0.0',
				subjectObjectIds: [PWU],
				subjectSemanticVersions: { [PWU]: 1 },
				claimIds: []
			})
		);
		observe(OBS_BLOCKING, 'BLOCKING');
		observe(OBS_MATERIAL, 'MATERIAL');
		ok(
			cmd('ProposeDecomposition', DC, 'DECOMPOSITION_CONTRACT', {
				parentWorkUnitId: PWU,
				childWorkUnitIds: [],
				rationale: 'split by concern'
			})
		);
	});

	/** Reject the decomposition citing `observationIds`, and return the emitted payload. */
	const rejectCiting = (observationIds: string[]): Record<string, unknown> => {
		ok(cmd('ValidateDecomposition', DC, 'DECOMPOSITION_CONTRACT', { disposition: 'INVALID', observationIds }));
		const e = store.readAllEvents().find((x) => x.eventType === 'DecompositionRejected');
		expect(e, 'the rejection must have been emitted for any of this to mean anything').toBeDefined();
		return e?.payload as Record<string, unknown>;
	};

	it('keeps only the BLOCKING-severity observation, not every one the validator cited', () => {
		const payload = rejectCiting([OBS_BLOCKING, OBS_MATERIAL]);
		expect(
			payload.blockingObservationIds,
			'MATERIAL is a real severity and is NOT blocking — copying observationIds wholesale would assert ' +
				'that every considered observation was the thing that blocked'
		).toEqual([OBS_BLOCKING]);
	});

	// CONTROL for non-vacuity: the field was `[]` on every path the suite drove before this file existed, so an
	// assertion that it EQUALS something non-empty is the whole point.
	it('CONTROL: the derived set is non-empty, so the filter is doing work', () => {
		const payload = rejectCiting([OBS_BLOCKING, OBS_MATERIAL]);
		expect((payload.blockingObservationIds as string[]).length).toBeGreaterThan(0);
	});

	// An unknown severity is not evidence of blocking — an id naming no live observation is dropped rather than
	// trusted. Without this, a caller could cite any string and have it recorded as the blocker.
	it('drops an id that resolves to no ASSURANCE_OBSERVATION', () => {
		const payload = rejectCiting([OBS_BLOCKING, OBS_GHOST]);
		expect(payload.blockingObservationIds).toEqual([OBS_BLOCKING]);
	});

	// And the full citation is still recorded — the derivation NARROWS the blocking set without discarding what
	// the validator actually considered.
	it('records the full cited set alongside the derived blocking subset', () => {
		const payload = rejectCiting([OBS_BLOCKING, OBS_MATERIAL]);
		expect(payload.observationIds).toEqual([OBS_BLOCKING, OBS_MATERIAL]);
	});
});
