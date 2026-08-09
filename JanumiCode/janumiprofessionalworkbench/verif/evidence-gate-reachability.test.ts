// REG-F-096 — `EVIDENCE_PENDING` is unreachable in production, and one field decides it.
//
// ── WHAT THIS PINS, AND WHY IT IS NOT A DUPLICATE OF THE DELIVERY CENSUS ──────────────────────────────────────
// `policy-evidence-requirement-census.test.ts` proves the 89 ratified evidence items ARRIVE on the policy
// objects, and `doc004-conformance.test.ts:512` proves every one of them is `SATISFIED_ONLY`. Both are correct
// and both are about the CONTENT. Neither states the LIFECYCLE CONSEQUENCE, which is what this file measures:
//
//   `requestAssuranceAssessment` births an assessment in `EVIDENCE_PENDING` iff the cited policy declares at
//   least one requirement with `requiredForDispositions: 'ALL'` (assurance.ts — `blockingEvidenceIds`), and
//   NO production policy declares one. So every production assessment is born `READY`.
//
// ⚠ THE POINT IS THAT THIS IS PERMANENT, NOT PENDING. REG-F-022's closure predicted the `EVIDENCE_PENDING ->
// READY` guard *"passes vacuously today, and starts biting the day this lands"*. It landed — REG-E-026, the same
// week — and the landing act chose `SATISFIED_ONLY` for all 89 items on §15.9's own words (*"SATISFIED only
// when … required evidence is admissible"*). The prediction was therefore falsified BY the act that discharged
// it, and `doc004-conformance.test.ts:512` now asserts the choice, so the predicted future is not merely absent —
// it is FORECLOSED by a shipped test. Neither entry cites the other; that gap is the finding.
//
// ⚠ WHAT IS NOT CLAIMED. This is NOT a claim that `SATISFIED_ONLY` is wrong. §15.9 is the corpus's only statement
// on the matter, it says what the closure says it says, and REG-E-026 is a ratified sponsor act. The defect is in
// the RECORD, not the choice — and in the fact that three ratified surfaces are consequently dead in production
// while the arrow census, which measures the whole SUITE, reports them live.
//
// WHAT MUST REDDEN, NAMED IN ADVANCE (mutation-checked, each on its own test):
//   1. Any production requirement flipped to `ALL`  -> the CENSUS reddens. The discriminating pair stays green,
//      because it builds its own policies and does not read the catalog.
//   2. `blockingEvidenceIds` widened to every requirement (drop the `=== 'ALL'` filter)
//                                                   -> the SATISFIED_ONLY arm of the PAIR reddens (it would be
//      born EVIDENCE_PENDING). The census stays green, because the catalog did not move.
//   3. The `ALL` dropped from the pair's second policy -> only the pair's CONTROL arm reddens, which is what
//      makes the first arm's `READY` mean "this field decided it" rather than "nothing ever lands elsewhere".
import { Engine } from '@janumipwb/rph-application';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { FLOOR_POLICY_DEFINITIONS } from '@janumipwb/rph-assurance';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';

const TS = '2026-08-09T00:00:00Z';

type Requirement = { readonly id?: string; readonly requiredForDispositions?: string };
type EvidenceBearing = {
	readonly requiredEvidence?: readonly Requirement[];
	readonly optionalEvidence?: readonly Requirement[];
};

/**
 * Tally `requiredForDispositions` across BOTH ratified tiers of BOTH production policy sources.
 *
 * DERIVED, not enumerated: it walks whatever the two seeders iterate, so a policy or a requirement added to
 * either one is measured without anybody remembering to extend a list. The tier is kept in the key because the
 * two tiers reach different gates — `requiredEvidence` reaches Gate A, `optionalEvidence` reaches nothing — and
 * collapsing them would let a migration between tiers pass unseen.
 */
function dispositionCensus(): Record<string, number> {
	const tally: Record<string, number> = {};
	const sources: readonly EvidenceBearing[] = [
		...(FLOOR_POLICY_DEFINITIONS as readonly EvidenceBearing[]),
		...(ontology.seedPolicies as readonly EvidenceBearing[])
	];
	for (const p of sources)
		for (const [tier, list] of [
			['requiredEvidence', p.requiredEvidence],
			['optionalEvidence', p.optionalEvidence]
		] as const)
			for (const r of list ?? []) {
				const key = `${tier}:${r.requiredForDispositions ?? 'ABSENT'}`;
				tally[key] = (tally[key] ?? 0) + 1;
			}
	return tally;
}

/** A live engine plus a dispatcher, so the consequence is OBSERVED through the real command path rather than
 *  reasoned from the handler's source. */
function liveEngine() {
	let seq = 0;
	const store = new SqliteStorageAdapter({ now: () => TS });
	const engine = new Engine({
		authenticate: testAuthenticator(),
		store,
		now: () => TS,
		newEventId: () => `evt_${++seq}`
	}).as(TEST_CRED.human);
	const send = (
		commandType: string,
		aggregateType: string,
		aggregateId: string,
		payload: unknown
	) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggregateType,
			targetAggregateId: aggregateId,
			issuedAt: TS,
			correlationId: 'evidence-gate-reachability',
			idempotencyKey: `idem-${n}`,
			payload
		};
		const r = engine.dispatch(command);
		// FAIL LOUD. An arrangement that is silently refused produces the same "no EVIDENCE_PENDING" this file is
		// about — the exact shape REG-F-015 records, where a null arrangement and a guarded one look identical.
		if (r.status !== 'ACCEPTED')
			throw new Error(`${commandType} ${aggregateId}: ${JSON.stringify(r.error)}`);
		return r;
	};
	return { store, send };
}

/** A requirement identical in every field but the one under test. Typed as the full §6.1 shape rather than the
 *  census's two-field reader — the reader deliberately sees only what it censuses, and reusing it here would let
 *  a misspelled field reach the engine unremarked. */
const requirement = (requiredForDispositions: string): Record<string, unknown> => ({
	id: 'EV-01',
	evidenceType: 'TEST_RESULT',
	description: 'the evidence whose disposition-gating is the whole question',
	purpose: 'to decide whether the assessment is born waiting or ready',
	cardinality: 'AT_LEAST_ONE',
	admissibilityRules: [],
	requiredForDispositions,
	mayBeWaived: false
});

const policyPayload = (policyId: string, requiredForDispositions: string) => ({
	policyId,
	version: '1.0.0',
	name: `Policy ${policyId}`,
	purpose: 'Assess the subject against its approved need.',
	rationale: 'Built inside the test so the catalog is not the variable.',
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
	requiredEvidence: [requirement(requiredForDispositions)],
	independenceRequirement: 'NONE',
	findingDefinitions: [
		{
			code: 'UNFIT',
			name: 'Unfit',
			description: 'Not fit for the approved need.',
			defaultSeverity: 'MATERIAL',
			affectedClaimTypes: ['FITNESS'],
			defaultControlActions: ['CONTINUE']
		}
	],
	permittedControlActions: ['CONTINUE']
});

/** Request one assessment against a policy differing ONLY in `requiredForDispositions`, and report where it is
 *  born. Everything else — subject, criteria, evidence shape — is held identical between the two calls. */
function birthStateFor(requiredForDispositions: string): string {
	const { store, send } = liveEngine();
	const POLICY = `pol_gate_${requiredForDispositions.toLowerCase()}`;
	const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5N00';
	const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5N01';
	const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5N02';

	send('CreateAssurancePolicy', 'ASSURANCE_POLICY', POLICY, policyPayload(POLICY, requiredForDispositions));
	send('ActivateAssurancePolicy', 'ASSURANCE_POLICY', POLICY, { policyId: POLICY });
	send('CaptureIntent', 'INTENT', INTENT, {
		intentId: INTENT,
		originatingExpression: 'x',
		ontologyId: 'o',
		ontologyVersion: '1'
	});
	send('ProposePwu', 'PROFESSIONAL_WORK_UNIT', PWU, {
		pwuId: PWU,
		pwuKind: 'ARCHITECTURE',
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
	send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', ASSESS, {
		assessmentId: ASSESS,
		assurancePolicyId: POLICY,
		policyVersion: '1.0.0',
		subjectObjectIds: [PWU],
		subjectSemanticVersions: { [PWU]: 1 },
		claimIds: []
	});
	return String((store.loadObject(ASSESS)?.state as { assessmentState?: string })?.assessmentState);
}

describe('REG-F-096 — the evidence gate is vacuous by construction, not by omission', () => {
	// THE CENSUS. Zero `ALL` anywhere in production is the whole mechanism; the other numbers are here so that a
	// reader that silently returns nothing cannot report the zero this file is about.
	it('no production evidence requirement gates ASSESSING — 89 declared, none `ALL`', () => {
		expect(
			dispositionCensus(),
			'REG-E-026 authored all 89 items as SATISFIED_ONLY on §15.9; the floor policies declare no ' +
				'policy-level evidence at all, so they contribute nothing to either tier'
		).toEqual({
			'requiredEvidence:SATISFIED_ONLY': 13,
			'optionalEvidence:SATISFIED_ONLY': 76
		});
	});

	// THE CONSEQUENCE, OBSERVED — two dispatches differing in one field, through the real engine.
	//
	// ⚠ THE PAIR IS TWO `it`s AND NOT ONE, DELIBERATELY. Written as a single test, the control and the claim
	// redden together on every mutant, and a control that cannot fail alone is not a control — the defect class
	// this repository has shipped three times. Split, M2 kills only the claim and M3 only the control.
	it('the production shape is born READY: SATISFIED_ONLY does not gate ASSESSING', () => {
		// Because the census above says every production requirement is SATISFIED_ONLY, THIS is the birth every
		// production assessment gets.
		expect(
			birthStateFor('SATISFIED_ONLY'),
			'if this is EVIDENCE_PENDING, `blockingEvidenceIds` has stopped filtering on `ALL`'
		).toBe('READY');
	});

	it('CONTROL: the probe can observe the OTHER outcome — an `ALL` requirement is born EVIDENCE_PENDING', () => {
		// The shape production never produces. Without this, `READY` above would be equally consistent with an
		// engine that can only ever birth READY, and the census would be measuring a field nothing reads.
		expect(birthStateFor('ALL')).toBe('EVIDENCE_PENDING');
	});

	// WHAT THE TWO FACTS COMPOSE INTO, stated as an assertion rather than left in a comment: with no `ALL` in the
	// catalog, nothing production ever writes reaches these surfaces. They are LIVE in the suite — tests build
	// `ALL` policies deliberately — which is exactly why the arrow census cannot see this and a separate
	// statement is needed.
	it('records the three ratified surfaces this makes production-unreachable', () => {
		const productionCanReachEvidencePending = Object.entries(dispositionCensus()).some(
			([k, n]) => k.endsWith(':ALL') && n > 0
		);
		expect(productionCanReachEvidencePending).toBe(false);
		// Named, not merely implied — the day the line above flips, these become reachable and this list is the
		// record of what changed:
		//   * `AssuranceAssessment.state EVIDENCE_PENDING -> READY`      (§30, trigger submitEvidenceForAssessment)
		//   * `AssuranceAssessment.state EVIDENCE_PENDING -> CANCELLED`  (§30, one of four `ANY ACTIVE` arms)
		//   * `submitEvidenceForAssessment`'s advancing branch           (assurance.ts `advancesToReady`)
	});
});
