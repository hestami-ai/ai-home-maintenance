// A PEER ASSESSMENT'S GATES MUST SEE ITS OWN FINDINGS — REG-F-029 review finding (e).
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// REG-F-029 made the canonical drive assess a PWU under EVERY policy that governs it, rather than one. The
// observations were still recorded against the PRIMARY assessment only, while every assessment's ValidatorResult
// carried the same observations — so a peer's verdict asserted findings the peer had no observation objects for.
//
// That is not merely untidy. `completeAssuranceAssessment` loads observations by
// `assessmentId === command.targetAggregateId` for two gates: the §10.3 FORECLOSURE gate
// (`dispositionRules.forbiddenOpenSeverities`) and the ESCALATION rule. On every peer both ran over an EMPTY
// population — so a peer could reach SATISFIED while carrying a finding its own policy forbids that disposition
// for, because the gate could not see a finding nobody had attached to it.
//
// THE DRIVE CANNOT REACH THIS CASE. The only PWU it gives observations to is the one architecture concern, and
// that kind is governed by exactly ONE policy — so N = 1 and the primary IS the whole set. A green drive proves
// nothing here, which is precisely why this test exists rather than a drive assertion.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-08-05T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5P10';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5P11';
const PEER = 'asm_01ARZ3NDEKTSV4RRFFQ69G5P12';
const OBS = 'obs_01ARZ3NDEKTSV4RRFFQ69G5P13';
/** A policy that FORBIDS a SATISFIED disposition while a BLOCKING observation is open (§10.3). */
const FORECLOSING = 'pol_forecloses_on_blocking';

describe('a PEER assessment’s §10.3 foreclosure gate sees its own observations (review finding (e))', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	/** Dispatch and ASSERT acceptance. REG-F-015's guard is right: an arrangement whose command was refused is an
	 *  arrangement that did not happen, and a test built on one proves nothing. Deliberate refusals below use
	 *  `dispatchRaw` and assert the refusal explicitly. */
	const dispatch = (commandType: string, type: string, id: string, payload: unknown) => {
		const r = dispatchRaw(commandType, type, id, payload);
		expect(r.status, `arrangement ${commandType} failed: ${JSON.stringify(r.error)}`).toBe(
			'ACCEPTED'
		);
		return r;
	};

	const dispatchRaw = (
		commandType: string,
		type: string,
		id: string,
		payload: unknown
	): { status: string; error?: unknown } => {
		const n = ++seq;
		return engine.dispatch({
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'corr-peer',
			idempotencyKey: `idem-${n}`,
			payload
		} as DomainCommand);
	};

	const completeWith = (assessmentId: string, disposition: string) =>
		dispatchRaw('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			validatorResult: {
				validatorId: 'v',
				validatorVersion: '1',
				policyId: FORECLOSING,
				policyVersion: '1.0.0',
				assessmentId,
				subjectObjectIds: [PWU],
				subjectSemanticVersions: { [PWU]: 1 },
				claimResults: [],
				evidenceConsideredIds: [],
				evidenceRejected: [],
				observations: [],
				dispositionRecommendation: disposition,
				recommendedControlActions: [],
				residualUncertainty: [],
				limitations: [],
				executionProvenance: {}
			}
		});

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `evt_${++seq}` }).as(TEST_CRED.human);
		dispatch('CaptureIntent', 'INTENT', INTENT, {
			intentId: INTENT,
			originatingExpression: 'x',
			ontologyId: 'o',
			ontologyVersion: '1'
		});
		dispatch('ProposePwu', 'PROFESSIONAL_WORK_UNIT', PWU, {
			pwuId: PWU,
			pwuKind: 'ARCHITECTURE_DEFINITION',
			title: 'T',
			description: 'd',
			intentId: INTENT,
			boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
			obligationIds: [],
			constraintIds: [],
			assumptionIds: [],
			expectedOutputs: [],
			assurancePolicyIds: [],
			riskProfile: {
				consequence: 'LOW',
				uncertainty: 'LOW',
				irreversibility: 'LOW',
				securitySensitivity: 'NONE',
				regulatoryExposure: 'NONE'
			}
		});
		seedPolicy(engine, FORECLOSING, {
			dispositionRules: [
				{
					disposition: 'SATISFIED',
					// `condition` is z.unknown() and REQUIRED — nonoptional, so it must be present even when the rule
					// keys only on severities. An EXISTS on the subject is the weakest thing that is still a §18
					// expression rather than a placeholder.
					condition: { op: 'EXISTS', path: '$.pwuId' },
					forbiddenOpenSeverities: ['BLOCKING']
				}
			]
		});
		// The PEER: an assessment that is NOT the first one on this PWU.
		dispatch('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', PEER, {
			assessmentId: PEER,
			assurancePolicyId: FORECLOSING,
			policyVersion: '1.0.0',
			subjectObjectIds: [PWU],
			subjectSemanticVersions: { [PWU]: 1 },
			claimIds: []
		});
		dispatch('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', PEER, {});
	});

	it('CONTROL: with NO observation of its own, the peer may reach SATISFIED', () => {
		// The baseline. Without this the refusal below could be caused by anything about the peer.
		expect(completeWith(PEER, 'SATISFIED').status).toBe('ACCEPTED');
	});

	it('REFUSES SATISFIED when a BLOCKING observation is open ON THE PEER — the gate has a population', () => {
		dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', OBS, {
			assessmentId: PEER,
			observationType: 'FINDING',
			severity: 'BLOCKING',
			statement: 'the peer found something its policy forbids satisfying over',
			evidenceIds: []
		});
		const c = completeWith(PEER, 'SATISFIED');
		expect(
			c.status,
			'§10.3 forecloses a SATISFIED disposition while a BLOCKING finding is open — a peer assessment is a ' +
				'real assessment and its gate must run over its own findings, not over an empty set'
		).not.toBe('ACCEPTED');
		expect(JSON.stringify(c.error)).toContain('foreclosed');
	});

	it('and the SAME peer may still reach a non-satisfied disposition — the gate forecloses one verdict, not all', () => {
		dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', OBS, {
			assessmentId: PEER,
			observationType: 'FINDING',
			severity: 'BLOCKING',
			statement: 'blocking',
			evidenceIds: []
		});
		// The policy forbids SATISFIED over an open BLOCKING finding; REJECTED is exactly what it should reach.
		expect(completeWith(PEER, 'REJECTED').status).toBe('ACCEPTED');
	});

	it('CONTROL: an observation on a DIFFERENT assessment does not foreclose this one', () => {
		// The mirror of the finding. Observations are keyed by assessment on purpose — one assessment's finding is
		// not automatically another's, and a gate that pooled them would refuse verdicts nobody's evidence supports.
		const OTHER = 'asm_01ARZ3NDEKTSV4RRFFQ69G5P14';
		dispatch('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', OTHER, {
			assessmentId: OTHER,
			assurancePolicyId: FORECLOSING,
			policyVersion: '1.0.0',
			subjectObjectIds: [PWU],
			subjectSemanticVersions: { [PWU]: 1 },
			claimIds: []
		});
		dispatch('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', OTHER, {});
		dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', OBS, {
			assessmentId: OTHER,
			observationType: 'FINDING',
			severity: 'BLOCKING',
			statement: 'belongs to the other assessment',
			evidenceIds: []
		});
		expect(completeWith(PEER, 'SATISFIED').status).toBe('ACCEPTED');
	});
});
