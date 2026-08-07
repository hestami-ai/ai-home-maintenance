// A ZERO_OR_MORE EVIDENCE REQUIREMENT MUST NOT BLOCK A VERDICT — REG-E-026.
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// DOC-004 §6.1 gives every requirement a `cardinality`, and `ZERO_OR_MORE` means zero instances SATISFY it. Every
// "outstanding evidence" computation in `assurance.ts` worked on ids alone — required MINUS received — which
// treats a ZERO_OR_MORE requirement as unmet until something arrives. That is the exact inverse of what the
// policy declared, and it would have made §15.5's "prior intent version WHERE APPLICABLE" permanently unmet for
// any intent that has no predecessor: a SATISFIED verdict withheld for want of a version that does not exist.
//
// IT WAS INVISIBLE UNTIL THE CONTENT LANDED. While every shipped policy carried `requiredEvidence: []`
// (REG-F-022), no cardinality was ever read, so no cardinality could ever be misread. The defect arrived with the
// fix — which is the generalisable half: delivering authored content is not the end of the work. Every FIELD of
// that content has to be read by something, or the delivery moves the vacuum somewhere less visible.
//
// WHAT MUST REDDEN (a green here means nothing unless these are true):
//   1. Revert any `.filter(demandsAnInstance)` -> the ZERO_OR_MORE arm reddens: SATISFIED is refused for a
//      requirement that zero instances satisfy.
//   2. Filter too eagerly (drop the AT_LEAST_ONE too) -> the CONTROL reddens: Gate A stops refusing anything,
//      which is REG-F-022 all over again with extra steps.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-08-05T00:00:00Z';
const human: ActorReference = { actorId: 'gov-1', actorType: 'HUMAN', displayName: 'Governor' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5Q10';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5Q11';
const ASM = 'asm_01ARZ3NDEKTSV4RRFFQ69G5Q12';
const EVD = 'evd_01ARZ3NDEKTSV4RRFFQ69G5Q13';
const POLICY = 'pol_cardinality_probe';

/** Two requirements that differ ONLY in cardinality. Both gate a SATISFIED verdict; only one demands an instance.
 *  Same `requiredForDispositions` on purpose — otherwise a pass could come from the disposition filter instead. */
const REQUIREMENTS = [
	{
		id: 'EV-MUST',
		evidenceType: 'ARTIFACT',
		description: 'An artifact that must exist.',
		purpose: 'To be the requirement that genuinely gates a positive verdict.',
		cardinality: 'AT_LEAST_ONE',
		admissibilityRules: [],
		requiredForDispositions: 'SATISFIED_ONLY',
		mayBeWaived: false
	},
	{
		id: 'EV-MAY',
		evidenceType: 'ARTIFACT',
		description: 'An artifact that may legitimately not exist.',
		purpose: 'To stand for §15.5’s "prior intent version where applicable" — zero instances satisfy it.',
		cardinality: 'ZERO_OR_MORE',
		admissibilityRules: [],
		requiredForDispositions: 'SATISFIED_ONLY',
		mayBeWaived: false
	}
];

describe('§6.1 cardinality is READ: ZERO_OR_MORE does not hold a verdict (REG-E-026)', () => {
	let engine: AuthedEngine;
	let seq = 0;

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
			issuedBy: human,
			correlationId: 'corr-card',
			idempotencyKey: `idem-${n}`,
			payload
		} as DomainCommand);
	};

	/** Dispatch and ASSERT acceptance — an arrangement whose command was refused is an arrangement that did not
	 *  happen (REG-F-015), and a test built on one proves nothing. */
	const dispatch = (commandType: string, type: string, id: string, payload: unknown) => {
		const r = dispatchRaw(commandType, type, id, payload);
		expect(r.status, `arrangement ${commandType} failed: ${JSON.stringify(r.error)}`).toBe(
			'ACCEPTED'
		);
		return r;
	};

	const complete = (disposition: string) =>
		dispatchRaw('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASM, {
			validatorResult: {
				validatorId: 'v',
				validatorVersion: '1',
				policyId: POLICY,
				policyVersion: '1.0.0',
				assessmentId: ASM,
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
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(),
			store: new SqliteStorageAdapter({ now: () => TS }),
			now: () => TS,
			newEventId: () => `evt_${++seq}`
		}).as(TEST_CRED.human);
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
		seedPolicy(engine, POLICY, { requiredEvidence: REQUIREMENTS });
		dispatch('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASM, {
			assessmentId: ASM,
			assurancePolicyId: POLICY,
			policyVersion: '1.0.0',
			subjectObjectIds: [PWU],
			subjectSemanticVersions: { [PWU]: 1 },
			claimIds: []
		});
	});

	it('the ZERO_OR_MORE requirement does not hold the assessment out of READY either', () => {
		// The EVIDENCE_PENDING -> READY arrow computes the same "outstanding" set. Neither requirement is 'ALL'
		// here, so the assessment lands READY regardless — asserted so the arrow's own reading is pinned, and so a
		// future change of these fixtures to 'ALL' has a stated baseline to move from.
		dispatch('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASM, {});
	});

	it('CONTROL: the AT_LEAST_ONE requirement DOES refuse SATISFIED — the gate still gates', () => {
		// Without this, filtering every requirement out would look like a pass. This is the assertion that makes
		// the test below mean "ZERO_OR_MORE is exempt" rather than "nothing is enforced".
		dispatch('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASM, {});
		const c = complete('SATISFIED');
		expect(c.status).not.toBe('ACCEPTED');
		expect(JSON.stringify(c.error)).toContain('EV-MUST');
	});

	it('and the refusal names ONLY the AT_LEAST_ONE one — EV-MAY is satisfied by zero instances', () => {
		dispatch('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASM, {});
		const c = complete('SATISFIED');
		expect(
			JSON.stringify(c.error),
			'a ZERO_OR_MORE requirement is satisfied by zero instances, so it can never be "unmet" — naming it ' +
				'here would withhold a verdict for want of evidence the policy says need not exist'
		).not.toContain('EV-MAY');
	});

	it('SATISFIED is ACCEPTED once the AT_LEAST_ONE one is met, with nothing submitted for EV-MAY', () => {
		// The whole finding, positively: one submission, two requirements, and the verdict stands.
		dispatch('SubmitEvidenceForAssessment', 'ASSURANCE_ASSESSMENT', ASM, {
			evidenceId: EVD,
			satisfiesRequirementId: 'EV-MUST'
		});
		dispatch('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASM, {});
		expect(complete('SATISFIED').status).toBe('ACCEPTED');
	});
});
