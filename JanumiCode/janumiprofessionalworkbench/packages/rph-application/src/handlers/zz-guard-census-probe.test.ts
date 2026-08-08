// TEMPORARY PROBE — arrow-guard census (REG-F-070 generalised). Deleted after measurement.
// Each case drives the arrow with its DECLARED GUARD CONDITION FALSE and records what production does.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';
import { appendFileSync, writeFileSync } from 'node:fs';

const OUT = 'e:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench/probe-out.txt';
writeFileSync(OUT, '');

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'user-1', actorType: 'HUMAN' as const, displayName: 'Alice' };
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5FB0';

describe('PROBE: declared arrow guards', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(TEST_CRED.human);
		seedPolicy(engine, 'pol_fitness_for_purpose');
	});

	function cmd(t: string, payload: unknown, over: Partial<DomainCommand> = {}): DomainCommand {
		const n = ++seq;
		return {
			commandId: `cmd-${n}`,
			commandType: t,
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
			targetAggregateId: PWU_ID,
			issuedAt: TS,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
	}

	function seedIntent(): void {
		const intent = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: INTENT_ID, targetAggregateType: 'INTENT' });
		engine.dispatch(
			intent('CaptureIntent', {
				intentId: INTENT_ID,
				originatingExpression: 'Build a field service management SaaS',
				ontologyId: 'product-realization-pwa',
				ontologyVersion: '1.3.0'
			})
		);
		engine.dispatch(intent('BeginIntentDiscovery', {}));
		engine.dispatch(intent('ProvisionIntent', { ambiguityIds: [] }));
	}

	function readyPwu(): void {
		seedIntent();
		engine.dispatch(
			cmd('ProposePwu', {
				pwuId: PWU_ID,
				pwuKind: 'ARCHITECTURE',
				title: 'Architecture Definition',
				description: 'Define a coherent technical structure',
				intentId: INTENT_ID,
				boundaries: {
					inScope: ['service architecture'],
					outOfScope: ['vendor selection'],
					permittedChanges: [],
					prohibitedChanges: []
				},
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: 'out_architecture_definition', kind: 'DOCUMENT' }],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'MEDIUM',
					uncertainty: 'MEDIUM',
					irreversibility: 'LOW',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'NONE'
				}
			})
		);
		engine.dispatch(cmd('BeginPwuShaping', {}));
		engine.dispatch(
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'assess_x', expectedSemanticVersion: 1 })
		);
	}

	const change = (over: Record<string, unknown>): DomainCommand =>
		cmd('ChangePwuState', {
			previousState: 'READY',
			newState: 'READY',
			executionState: 'NOT_PLANNED',
			assuranceState: 'UNASSESSED',
			shapeIntegrityState: 'UNKNOWN',
			reasonCode: 'probe',
			supportingObjectIds: [],
			...over
		});

	const say = (label: string, r: { status: string; error?: { code?: string; message?: string } }) => {
		appendFileSync(
			OUT,
			`PROBE ${label}: ${r.status} ${r.error?.code ?? ''} ${(r.error?.message ?? '').slice(0, 260)}\n`
		);
	};

	it('P1 PWU.assuranceState READY_FOR_ASSESSMENT -> ASSESSING with no independence anything', () => {
		readyPwu();
		for (const s of ['EVIDENCE_REQUIRED', 'READY_FOR_ASSESSMENT', 'ASSESSING']) {
			const r = engine.dispatch(change({ assuranceState: s }));
			say(`P1 ->${s}`, r);
		}
		say('P1 final', { status: String((store.loadObject(PWU_ID)?.state as { assuranceState: string }).assuranceState) });
	});

	it('P2 PWU.assuranceState -> WAIVED with NO waiver decision cited', () => {
		readyPwu();
		engine.dispatch(change({ assuranceState: 'EVIDENCE_REQUIRED' }));
		const r = engine.dispatch(change({ assuranceState: 'WAIVED', reasonCode: 'fixture' }));
		say('P2 EVIDENCE_REQUIRED->WAIVED (no waiver)', r);
		say('P2 final', {
			status: String((store.loadObject(PWU_ID)?.state as { assuranceState: string }).assuranceState)
		});
	});

	it('P3 PWU.assuranceState UNASSESSED -> NOT_REQUIRED with no applicability determination', () => {
		readyPwu();
		const r = engine.dispatch(change({ assuranceState: 'NOT_REQUIRED', reasonCode: 'fixture' }));
		say('P3 UNASSESSED->NOT_REQUIRED (no applicability)', r);
		say('P3 final', {
			status: String((store.loadObject(PWU_ID)?.state as { assuranceState: string }).assuranceState)
		});
	});

	it('P4 Claim OPEN -> UNDER_ASSESSMENT on a claim with NO subject', () => {
		const CLAIM_ID = 'clm_01ARZ3NDEKTSV4RRFFQ69G5C00';
		const c = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: CLAIM_ID, targetAggregateType: 'CLAIM' });
		const a = engine.dispatch(
			c('AssertClaim', {
				statement: 'a claim about nothing',
				claimType: 'CORRECTNESS',
				subjectObjectIds: [], // ← the guard's condition, false
				supportingEvidenceIds: [],
				contradictingEvidenceIds: []
			})
		);
		say('P4 AssertClaim subjectObjectIds=[]', a);
		const r = engine.dispatch(c('RecordClaimAssessment', { targetStatus: 'UNDER_ASSESSMENT' }));
		say('P4 OPEN->UNDER_ASSESSMENT (no subject)', r);
		say('P4 final', {
			status: String((store.loadObject(CLAIM_ID)?.state as { status?: string })?.status)
		});
	});

	it('P5 Claim -> CONTESTED naming NO contradicting evidence', () => {
		const CLAIM_ID = 'clm_01ARZ3NDEKTSV4RRFFQ69G5C01';
		const c = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: CLAIM_ID, targetAggregateType: 'CLAIM' });
		engine.dispatch(
			c('AssertClaim', {
				statement: 'the architecture is coherent',
				claimType: 'CORRECTNESS',
				subjectObjectIds: [PWU_ID],
				supportingEvidenceIds: [],
				contradictingEvidenceIds: []
			})
		);
		engine.dispatch(c('RecordClaimAssessment', { targetStatus: 'UNDER_ASSESSMENT' }));
		const r = engine.dispatch(c('RecordClaimAssessment', { targetStatus: 'CONTESTED' }));
		say('P5 UNDER_ASSESSMENT->CONTESTED (no contradicting evidence)', r);
		const st = store.loadObject(CLAIM_ID)?.state as {
			status?: string;
			contradictingEvidenceIds?: string[];
		};
		say('P5 final', {
			status: `${st?.status} contradicting=[${(st?.contradictingEvidenceIds ?? []).join(',')}]`
		});
	});

	it('P6 CONTROL: Evidence PROPOSED -> ADMISSIBLE with no scope/limitations must REFUSE', () => {
		const E = 'evd_01ARZ3NDEKTSV4RRFFQ69G5E00';
		const e = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: E, targetAggregateType: 'EVIDENCE' });
		const p = engine.dispatch(
			e('ProposeEvidence', {
				evidenceId: E,
				evidenceType: 'ARTIFACT',
				contentReference: { kind: 'INLINE', note: 'x' },
				producedBy: actor,
				supportsClaimIds: [],
				contradictsClaimIds: [],
				scope: '', // ← SCOPE_STATED false
				limitations: [],
				capturedAt: TS
			})
		);
		say('P6 ProposeEvidence scope=""', p);
		const r = engine.dispatch(
			e('AdmitEvidence', { admissibilityAssessmentId: 'x', admittedScope: 'y', admittedClaimIds: [] })
		);
		say('P6 PROPOSED->ADMISSIBLE (no scope)', r);
	});
});
