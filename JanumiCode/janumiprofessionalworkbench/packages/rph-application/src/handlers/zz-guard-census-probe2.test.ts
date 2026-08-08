// TEMPORARY PROBE 2 — arrow-guard census. Deleted after measurement.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';
import { appendFileSync, writeFileSync } from 'node:fs';

const OUT = 'e:/Projects/hestami-ai/JanumiCode/janumiprofessionalworkbench/probe-out2.txt';
writeFileSync(OUT, '');

const TS = '2026-07-12T00:00:00Z';
const INTENT_ID = 'int_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5FB0';
const BASE_ID = 'bsl_01ARZ3NDEKTSV4RRFFQ69G5B00';
const DEC_ID = 'dec_01ARZ3NDEKTSV4RRFFQ69G5D00';
const HUMAN_ACTOR = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'Operator' };

describe('PROBE2', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let agentEngine: AuthedEngine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		const base = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		});
		engine = base.as(TEST_CRED.human);
		agentEngine = base.as(TEST_CRED.agent);
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

	const say = (label: string, r: { status: string; error?: { code?: string; message?: string } }) =>
		appendFileSync(
			OUT,
			`PROBE ${label}: ${r.status} ${r.error?.code ?? ''} ${(r.error?.message ?? '').slice(0, 300)}\n`
		);

	function seedIntent(): void {
		const i = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: INTENT_ID, targetAggregateType: 'INTENT' });
		engine.dispatch(
			i('CaptureIntent', {
				intentId: INTENT_ID,
				originatingExpression: 'x',
				ontologyId: 'product-realization-pwa',
				ontologyVersion: '1.3.0'
			})
		);
		engine.dispatch(i('BeginIntentDiscovery', {}));
		engine.dispatch(i('ProvisionIntent', { ambiguityIds: [] }));
	}

	function readyPwu(): void {
		seedIntent();
		engine.dispatch(
			cmd('ProposePwu', {
				pwuId: PWU_ID,
				pwuKind: 'ARCHITECTURE',
				title: 'Arch',
				description: 'd',
				intentId: INTENT_ID,
				boundaries: { inScope: ['a'], outOfScope: ['b'], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: 'out_x', kind: 'DOCUMENT' }],
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
			cmd('MarkPwuReady', { shapeReadinessAssessmentId: 'a', expectedSemanticVersion: 1 })
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

	/** A SATISFIED assessment that identified NO evidence and NO criteria. */
	function emptySatisfiedAssessment(subject: string, id: string): void {
		const a = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: id, targetAggregateType: 'ASSURANCE_ASSESSMENT' });
		say(
			'  (setup) RequestAssuranceAssessment',
			engine.dispatch(
				a('RequestAssuranceAssessment', {
					assessmentId: id,
					assurancePolicyId: 'pol_fitness_for_purpose',
					policyVersion: '1.0.0',
					subjectObjectIds: [subject],
					subjectSemanticVersions: { [subject]: 1 },
					claimIds: []
				})
			)
		);
		say('  (setup) BeginAssuranceAssessment', engine.dispatch(a('BeginAssuranceAssessment', {})));
		say(
			'  (setup) CompleteAssuranceAssessment evidenceConsideredIds=[] claimResults=[]',
			engine.dispatch(
				a('CompleteAssuranceAssessment', {
					validatorResult: {
						validatorId: 'test.reviewer',
						validatorVersion: '1',
						policyId: 'pol_fitness_for_purpose',
						policyVersion: '1.0.0',
						assessmentId: id,
						subjectObjectIds: [subject],
						subjectSemanticVersions: { [subject]: 1 },
						claimResults: [],
						evidenceConsideredIds: [],
						evidenceRejected: [],
						observations: [],
						dispositionRecommendation: 'SATISFIED',
						recommendedControlActions: [],
						residualUncertainty: [],
						limitations: [],
						executionProvenance: {}
					}
				})
			)
		);
	}

	it('P7 PWU ASSESSING -> SATISFIED, backed by an assessment that identified NO evidence and NO criteria', () => {
		readyPwu();
		for (const s of ['EVIDENCE_REQUIRED', 'READY_FOR_ASSESSMENT', 'ASSESSING'])
			engine.dispatch(change({ assuranceState: s }));
		const AID = 'asr_01ARZ3NDEKTSV4RRFFQ69G5A00';
		emptySatisfiedAssessment(PWU_ID, AID);
		say(
			'P7 ASSESSING->SATISFIED citing an empty-evidence assessment',
			engine.dispatch(change({ assuranceState: 'SATISFIED', supportingObjectIds: [AID] }))
		);
		say('P7 final', {
			status: String((store.loadObject(PWU_ID)?.state as { assuranceState: string }).assuranceState)
		});
	});

	it('P8 CONTROL PWU ASSESSING -> SATISFIED with NOTHING cited must REFUSE', () => {
		readyPwu();
		for (const s of ['EVIDENCE_REQUIRED', 'READY_FOR_ASSESSMENT', 'ASSESSING'])
			engine.dispatch(change({ assuranceState: s }));
		say('P8 ASSESSING->SATISFIED citing nothing', engine.dispatch(change({ assuranceState: 'SATISFIED' })));
	});

	// ── Baseline ────────────────────────────────────────────────────────────────
	function baselineToUnderReview(): void {
		const b = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: BASE_ID, targetAggregateType: 'BASELINE' });
		say(
			'  (setup) CreateBaseline',
			engine.dispatch(
				b('CreateBaseline', {
					baselineType: 'ARCHITECTURE',
					itemObjectIds: [PWU_ID],
					assuranceAssessmentIds: []
				})
			)
		);
		say('  (setup) SubmitBaselineForReview', engine.dispatch(b('SubmitBaselineForReview', {})));
	}

	it('P9 Baseline UNDER_REVIEW -> APPROVED with an OPEN BLOCKING observation against a baseline item', () => {
		readyPwu();
		const AID = 'asr_01ARZ3NDEKTSV4RRFFQ69G5A01';
		const a = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: AID, targetAggregateType: 'ASSURANCE_ASSESSMENT' });
		engine.dispatch(
			a('RequestAssuranceAssessment', {
				assessmentId: AID,
				assurancePolicyId: 'pol_fitness_for_purpose',
				policyVersion: '1.0.0',
				subjectObjectIds: [PWU_ID],
				subjectSemanticVersions: { [PWU_ID]: 1 },
				claimIds: []
			})
		);
		engine.dispatch(a('BeginAssuranceAssessment', {}));
		const OBS = 'obs_01ARZ3NDEKTSV4RRFFQ69G5O00';
		say(
			'  (setup) RecordAssuranceObservation BLOCKING against the PWU',
			engine.dispatch(
				cmd(
					'RecordAssuranceObservation',
					{
						assessmentId: AID,
						observationType: 'FINDING',
						findingCode: 'PROBE_BLOCKER',
						severity: 'BLOCKING',
						statement: 'a blocking finding against the baselined item'
					},
					{ targetAggregateId: OBS, targetAggregateType: 'ASSURANCE_OBSERVATION' }
				)
			)
		);
		baselineToUnderReview();
		say(
			'P9 UNDER_REVIEW->APPROVED with an open BLOCKING observation',
			engine.dispatch(
				cmd('ApproveBaseline', {}, { targetAggregateId: BASE_ID, targetAggregateType: 'BASELINE' })
			)
		);
		say('P9 final', {
			status: String((store.loadObject(BASE_ID)?.state as { status?: string })?.status)
		});
	});

	it('P10 Baseline AUTHORITATIVE -> SUPERSEDED naming a superseding baseline that DOES NOT EXIST', () => {
		readyPwu();
		const b = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: BASE_ID, targetAggregateType: 'BASELINE' });
		baselineToUnderReview();
		say('  (setup) ApproveBaseline', engine.dispatch(b('ApproveBaseline', {})));
		// an EFFECTIVE promotion decision
		const d = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: DEC_ID, targetAggregateType: 'DECISION' });
		say(
			'  (setup) ProposeDecision',
			engine.dispatch(
				d('ProposeDecision', {
					decisionType: 'PROMOTE_BASELINE',
					subjectObjectIds: [BASE_ID, PWU_ID],
					selectedOption: 'promote',
					rationale: 'r',
					authority: HUMAN_ACTOR
				})
			)
		);
		say(
			'  (setup) ApproveDecision',
			engine.dispatch(
				d('ApproveDecision', {
					selectedOption: 'promote',
					rationale: 'r',
					consideredEvidenceIds: [],
					consideredObservationIds: [],
					subjectSemanticVersions: {}
				})
			)
		);
		say(
			'  (setup) PromoteBaseline',
			engine.dispatch(
				b('PromoteBaseline', {
					promotionDecisionId: DEC_ID,
					expectedItemObjectVersions: [{ objectId: PWU_ID, semanticVersion: 1 }],
					requiredAssessmentIds: []
				})
			)
		);
		say('  (setup) baseline status', {
			status: String((store.loadObject(BASE_ID)?.state as { status?: string })?.status)
		});
		say(
			'P10 AUTHORITATIVE->SUPERSEDED naming a nonexistent successor',
			engine.dispatch(b('SupersedeBaseline', { supersedingBaselineId: 'bsl_DOES_NOT_EXIST' }))
		);
		say('P10 final', {
			status: String((store.loadObject(BASE_ID)?.state as { status?: string })?.status)
		});
	});

	it('P11 Decision EFFECTIVE -> REVOKED: does anything cascade to the baseline standing on it?', () => {
		readyPwu();
		const b = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: BASE_ID, targetAggregateType: 'BASELINE' });
		const d = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: DEC_ID, targetAggregateType: 'DECISION' });
		baselineToUnderReview();
		engine.dispatch(b('ApproveBaseline', {}));
		engine.dispatch(
			d('ProposeDecision', {
				decisionType: 'PROMOTE_BASELINE',
				subjectObjectIds: [BASE_ID, PWU_ID],
				selectedOption: 'promote',
				rationale: 'r',
				authority: HUMAN_ACTOR
			})
		);
		engine.dispatch(
			d('ApproveDecision', {
				selectedOption: 'promote',
				rationale: 'r',
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: {}
			})
		);
		engine.dispatch(
			b('PromoteBaseline', {
				promotionDecisionId: DEC_ID,
				expectedItemObjectVersions: [{ objectId: PWU_ID, semanticVersion: 1 }],
				requiredAssessmentIds: []
			})
		);
		say('  (setup) baseline before revoke', {
			status: String((store.loadObject(BASE_ID)?.state as { status?: string })?.status)
		});
		say(
			'P11 RevokeDecision on the promotion decision',
			engine.dispatch(d('RevokeDecision', { revocationRationale: 'the assumption was falsified' }))
		);
		say('P11 baseline AFTER revoke (RPH-GOV-007 says review-required or revoked)', {
			status: String((store.loadObject(BASE_ID)?.state as { status?: string })?.status)
		});
		const evs = store
			.readAllEvents()
			.filter((e) => e.aggregateId === BASE_ID)
			.map((e) => e.eventType);
		say('P11 baseline events after revoke', { status: evs.join(',') });
	});

	it('P12 CONTROL Decision PROPOSED -> EFFECTIVE by an AGENT must REFUSE', () => {
		const d = (t: string, p: unknown): DomainCommand =>
			cmd(t, p, { targetAggregateId: DEC_ID, targetAggregateType: 'DECISION' });
		say(
			'  (setup) ProposeDecision',
			engine.dispatch(
				d('ProposeDecision', {
					decisionType: 'APPROVAL',
					subjectObjectIds: [],
					selectedOption: 'x',
					rationale: 'r',
					authority: HUMAN_ACTOR
				})
			)
		);
		say(
			'P12 ApproveDecision issued by AGENT',
			agentEngine.dispatch(
				d('ApproveDecision', {
					selectedOption: 'promote',
					rationale: 'r',
					consideredEvidenceIds: [],
					consideredObservationIds: [],
					subjectSemanticVersions: {}
				})
			)
		);
	});
});
