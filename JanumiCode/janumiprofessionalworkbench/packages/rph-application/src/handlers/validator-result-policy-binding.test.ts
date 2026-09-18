// ⭐ A §20 VERDICT MUST NAME THE POLICY ITS ASSESSMENT IS UNDER — `JAN-EXEC` Phase 6b, design §4.15.5.
//
// ── ⛔ THE CONTROL EXISTED ONE MODULE OVER AND NOT HERE ───────────────────────────────────────────────────────
//
// `completeAssuranceAssessment` reads nine fields off the supplied `ValidatorResult` — the disposition, the
// subjects and their versions, the evidence considered, the residual uncertainty, the recommended control
// actions, the validator's own id and version, and the evaluator — and it read `policyId` NOWHERE. So a verdict
// could arrive stamped with one policy and be recorded as the conclusion of an assessment held under another.
//
// ⚠ `floor.ts:319` ALREADY REFUSES EXACTLY THIS on the floor path — `policyVersionMatches: r.policyVersion ===
// p.policyVersion`, consumed by `classifyValidatorResult`. The general command path, which every other caller
// in the product goes through, had no equivalent. `reference-undertaking.ts` passes `policyId: pid` per
// assessment and states why:
//
//   *"a ValidatorResult whose `policyId` did not match the assessment's would be a verdict attributed to
//    criteria it was not measured against"*
//
// — the ratified drive honouring a rule nothing enforced.
//
// ── ⭑ WHY IT IS CLOSED IN THIS PHASE AND NOT FILED ───────────────────────────────────────────────────────────
//
// Until Phase 6b every caller assessed ONE policy per act and hardcoded its id on both sides, so the invariant
// held by construction and a guard would have had an empty population — *"a control whose population is empty is
// a control that cannot fail"*. Phase 6b makes one operator act open N assessments under N different policies,
// which is the commit that fills it. The guard lands beside the code that first makes it falsifiable.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-09-18T00:00:00Z';
const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5VRB';
/** TWO policies, because one cannot disagree with itself — the whole point is a verdict naming the other one. */
const POLICY_A = 'pol_01ARZ3NDEKTSV4RRFFQ69G5VRA';
const POLICY_B = 'pol_01ARZ3NDEKTSV4RRFFQ69G5VRB';

describe('⭐ completeAssuranceAssessment — the verdict names the policy it was measured against', () => {
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
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${n}`,
			payload
		};
	};

	function ok(command: DomainCommand): void {
		const r = engine.dispatch(command);
		if (r.status !== 'ACCEPTED') throw new Error(`${command.commandType}: ${JSON.stringify(r.error)}`);
	}

	/** An ACTIVE, independence-NONE policy — independence is not what this file is about, and a requirement here
	 *  would make every refusal below ambiguous between two guards (the `an-arrangement-that-trips-two-guards`
	 *  shape this repository has recorded). */
	function createPolicy(policyId: string, name: string): void {
		ok(
			cmd('CreateAssurancePolicy', policyId, 'ASSURANCE_POLICY', {
				policyId,
				version: '1.0.0',
				name,
				purpose: 'Assess the subject.',
				rationale: 'A policy to hold an assessment under.',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['FITNESS'],
				criteria: [
					{
						id: 'C1',
						name: 'Fit',
						description: 'The subject is fit for its approved need.',
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
						description: 'Not fit.',
						defaultSeverity: 'MATERIAL',
						affectedClaimTypes: ['FITNESS'],
						defaultControlActions: ['CONTINUE']
					}
				],
				permittedControlActions: ['CONTINUE']
			})
		);
		ok(cmd('ActivateAssurancePolicy', policyId, 'ASSURANCE_POLICY', { policyId }));
	}

	/** Open an assessment under `policyId` and drive it to ASSESSING. */
	function assessing(assessmentId: string, policyId: string): void {
		ok(
			cmd('RequestAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {
				assessmentId,
				assurancePolicyId: policyId,
				policyVersion: '1.0.0',
				subjectObjectIds: [SUBJECT],
				subjectSemanticVersions: { [SUBJECT]: 1 },
				claimIds: []
			})
		);
		ok(cmd('BeginAssuranceAssessment', assessmentId, 'ASSURANCE_ASSESSMENT', {}));
	}

	/** A schema-valid §20 verdict. `policyId` / `policyVersion` are PARAMETERS — that is the whole instrument. */
	const verdict = (assessmentId: string, policyId: string, policyVersion = '1.0.0') => ({
		validatorId: 'reviewer',
		validatorVersion: '1',
		policyId,
		policyVersion,
		assessmentId,
		subjectObjectIds: [SUBJECT],
		subjectSemanticVersions: { [SUBJECT]: 1 },
		claimResults: [],
		evidenceConsideredIds: [],
		evidenceRejected: [],
		observations: [],
		dispositionRecommendation: 'SATISFIED',
		recommendedControlActions: [],
		residualUncertainty: [],
		limitations: [],
		executionProvenance: {
			evaluator: { actorId: 'reviewer-1', actorType: 'HUMAN', displayName: 'Reviewer' }
		}
	});

	const stateOf = (id: string) =>
		store.loadObject(id)?.state as { assessmentState?: string; assurancePolicyId?: string } | undefined;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(TEST_CRED.human);
		createPolicy(POLICY_A, 'Policy A');
		createPolicy(POLICY_B, 'Policy B');
	});

	it('⛔ REFUSES a verdict whose policyId names a DIFFERENT policy than the assessment is held under', () => {
		const asm = 'asm_01ARZ3NDEKTSV4RRFFQ69G5V01';
		assessing(asm, POLICY_A);
		const r = engine.dispatch(
			cmd('CompleteAssuranceAssessment', asm, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(asm, POLICY_B),
				producer: { actorId: 'producer-1', actorType: 'HUMAN', displayName: 'Producer' }
			})
		);
		expect(r.status, 'a verdict measured against another policy must not conclude this assessment').toBe(
			'REJECTED'
		);
		// ⚠ THE MESSAGE, NOT THE CODE. `RPH_VALIDATION_SEMANTIC_FAILED` is emitted by a large population of
		// guards in this handler, so asserting the code alone would pass for a refusal from any of them —
		// the `csaa` finding restated. BOTH policy ids must appear, or the reader cannot act on it.
		expect(r.error?.message).toContain(POLICY_A);
		expect(r.error?.message).toContain(POLICY_B);
		// AND THE ASSESSMENT IS UNTOUCHED — a refusal that half-completed would be worse than none.
		expect(stateOf(asm)?.assessmentState).toBe('ASSESSING');
	});

	it('⭑ CONTROL — the same verdict naming its OWN policy completes normally', () => {
		// ⚠ WITHOUT THIS THE TEST ABOVE PASSES FOR A GUARD THAT REFUSES EVERY COMPLETION. The mutation
		// `P6b-e` makes the comparison unconditional; only this control reddens for it.
		const asm = 'asm_01ARZ3NDEKTSV4RRFFQ69G5V02';
		assessing(asm, POLICY_A);
		const r = engine.dispatch(
			cmd('CompleteAssuranceAssessment', asm, 'ASSURANCE_ASSESSMENT', {
				validatorResult: verdict(asm, POLICY_A),
				producer: { actorId: 'producer-1', actorType: 'HUMAN', displayName: 'Producer' }
			})
		);
		expect(r.status, 'a verdict naming its own policy is exactly what this path is for').toBe('ACCEPTED');
		expect(stateOf(asm)?.assessmentState).toBe('SATISFIED');
	});

	it('⭑ CONTROL — the POLICY id is what is compared, not the version', () => {
		// ⛔ A SEPARATE RULE, DELIBERATELY NOT FOLDED IN. DOC-004 invariant 2 binds an assessment to its policy
		// VERSION as well, and `floor.ts` checks the version on its own path — but this guard is about the
		// verdict being attributed to the right POLICY. Refusing a version mismatch here would be a second rule
		// smuggled in under the first, and a reader could not tell which one had bitten.
		const asm = 'asm_01ARZ3NDEKTSV4RRFFQ69G5V03';
		assessing(asm, POLICY_A);
		expect(
			engine.dispatch(
				cmd('CompleteAssuranceAssessment', asm, 'ASSURANCE_ASSESSMENT', {
					validatorResult: verdict(asm, POLICY_A, '9.9.9'),
					producer: { actorId: 'producer-1', actorType: 'HUMAN', displayName: 'Producer' }
				})
			).status
		).toBe('ACCEPTED');
	});
});
