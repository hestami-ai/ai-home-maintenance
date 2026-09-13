// REG-F-021 residual R-1, CLOSED — an assessment that will never reach a verdict can be closed.
//
// ── THE RESIDUAL ─────────────────────────────────────────────────────────────────────────────────────────────
// Restoring the §30 lifecycle created a state an assessment could enter and never leave: EVIDENCE_PENDING, when
// the evidence it requires never arrives. `completeAssuranceAssessment` demands ASSESSING, and the only ratified
// exit from EVIDENCE_PENDING was getting the evidence. So the assessment sat open forever, and every governance
// act that waits on it waited forever.
//
// ── THE ARROW WAS RATIFIED ALL ALONG ─────────────────────────────────────────────────────────────────────────
// DOC-004 §30's "Alternate transitions" block declares SIX arrows, and the sixth — `ANY ACTIVE → CANCELLED` —
// did not reach the machine. CANCELLED sat declared, TERMINAL, and reachable by nothing: an ending nothing could
// end at. The COMMAND and EVENT names were authored when this was written and are RATIFIED as of 2026-08-05
// (DOC-004 §31/§32, §0.3 authored clarification — the corpus had declared the arrow and named no trigger); the
// TRANSITION is delivered. One of each, which is why both are said separately wherever this is described.
//
// ── WHERE IT WAS LOST — CORRECTED 2026-08-05 (REG-F-025) ─────────────────────────────────────────────────────
// This file first said the arrow was dropped IN TRANSCRIPTION, because a quantifier is not a row. That was wrong,
// and the correction matters more than the original claim. The row WAS transcribed, at the right spot in
// `m2-transitions.json`, spelled `ANY_ACTIVE`, with a note stating its own intended expansion — and it had been
// there since the workbench arrived in the repository. It was lost one layer lower, in `gen-transitions.ts`,
// which recognises the quantifier spelled `Any active` with a SPACE and silently filtered the row out. Corpus,
// vocab and machine were each defensible read alone; the arrow died in the gap between them, which is why the
// gate that found it (`transition-row-landing.test.ts`) is the only thing here that reads two artifacts at once.
//
// The four literal rows below are still the right fix, and NOT because the quantifier was unspelled: teaching the
// matcher to accept `ANY_ACTIVE` would have expanded it to every NON-TERMINAL state, which here includes the
// SATISFIED / CONDITIONALLY_SATISFIED / WAIVED verdicts — minting the very transition the last test forbids.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { classifyTransition } from '@janumipwb/rph-domain';
import { seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-08-05T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5N00';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5N01';
const ASSESS = 'assess_01ARZ3NDEKTSV4RRFFQ69G5N02';
const POLICY = 'pol_evidence_hungry';

const ev = (id: string) => ({
	id,
	evidenceType: 'TEST_RESULT',
	description: 'evidence this assessment will never receive',
	purpose: 'to strand the assessment in EVIDENCE_PENDING',
	cardinality: 'AT_LEAST_ONE',
	admissibilityRules: [],
	requiredForDispositions: 'ALL',
	mayBeWaived: false
});

describe('CancelAssuranceAssessment (REG-F-021 residual R-1)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, over: Partial<DomainCommand> = {}) => {
		const n = ++seq;
		return engine.dispatch({
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_ASSESSMENT',
			targetAggregateId: ASSESS,
			issuedAt: TS,
			correlationId: 'corr-cancel',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		});
	};
	const stateOf = () => store.loadObject(ASSESS)?.state as Record<string, unknown>;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `evt_${++seq}` }).as(TEST_CRED.human);
		// A policy that REQUIRES evidence, so the assessment lands in EVIDENCE_PENDING and stays there.
		seedPolicy(engine, POLICY, { requiredEvidence: [ev('EV-01')] });
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			{ targetAggregateId: INTENT, targetAggregateType: 'INTENT' }
		);
		dispatch(
			'ProposePwu',
			{
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
			},
			{ targetAggregateId: PWU, targetAggregateType: 'PROFESSIONAL_WORK_UNIT' }
		);
		dispatch('RequestAssuranceAssessment', {
			assessmentId: ASSESS,
			assurancePolicyId: POLICY,
			policyVersion: '1.0.0',
			subjectObjectIds: [PWU],
			subjectSemanticVersions: { [PWU]: 1 },
			claimIds: []
		});
	});

	it('CONTROL: the assessment really is STALLED — evidence outstanding, and no other exit', () => {
		expect(stateOf().assessmentState).toBe('EVIDENCE_PENDING');
		// Both other closures are refused, which is what made this a residual rather than an inconvenience.
		expect(dispatch('BeginAssuranceAssessment', {}).status).not.toBe('ACCEPTED');
		expect(
			dispatch('CompleteAssuranceAssessment', {
				validatorResult: { dispositionRecommendation: 'INCONCLUSIVE' }
			}).status
		).not.toBe('ACCEPTED');
	});

	it('cancels a stalled assessment, recording WHY and FROM WHERE', () => {
		const r = dispatch('CancelAssuranceAssessment', {
			reason: 'the required trace matrix does not exist and will not be produced'
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(stateOf().assessmentState).toBe('CANCELLED');
		const evt = store
			.readAggregateEvents('ASSURANCE_ASSESSMENT', ASSESS)
			.find((e) => e.eventType === 'AssuranceAssessmentCancelled');
		expect(evt).toBeDefined();
		const p = evt?.payload as { cancelledFromState?: string; reason?: string };
		expect(
			p.cancelledFromState,
			'an assessment abandoned in EVIDENCE_PENDING (evidence never arrived) and one abandoned in ASSESSING ' +
				'(the assessor withdrew) are different facts, and the terminal state records neither'
		).toBe('EVIDENCE_PENDING');
		expect(
			p.reason,
			'cancellation is the one closure with NO verdict, so the reason is the only account of it that will ' +
				'ever exist'
		).toContain('trace matrix');
	});

	it('is available from EVERY active state — §30 says ANY ACTIVE, not "the ones before assessing"', () => {
		// The design proposed cancelling only from the three PRE-ASSESSING states, reasoning that an assessment
		// being judged should reach a disposition. The corpus is broader and it wins; this asserts the ratified
		// breadth so the narrower authored rule cannot creep back.
		for (const from of ['REQUESTED', 'EVIDENCE_PENDING', 'READY', 'ASSESSING'])
			expect(
				classifyTransition('AssuranceAssessment.state', from, 'CANCELLED').klass,
				`${from} -> CANCELLED must be legal`
			).toBe('LEGAL');
		// CONTROL: the classifier can say NO, so four LEGALs mean the arrows exist rather than that everything
		// passes. A concluded assessment has no cancel arrow — which the last test proves through the engine.
		expect(classifyTransition('AssuranceAssessment.state', 'SATISFIED', 'CANCELLED').klass).not.toBe(
			'LEGAL'
		);
	});

	// ── THE PRECISION OF `cancelledFromState` (JAN-PFA S3.3) ─────────────────────────────────────────────────────
	// THIS CLOSES THE MUTANT `const cancelledFromState = String(loaded.state.assessmentState);` ->
	// `const cancelledFromState = 'EVIDENCE_PENDING';`, which SURVIVED this entire suite. Nothing above could see
	// it. The one engine-driven cancel in the repository abandons the stalled EVIDENCE_PENDING assessment — the
	// single from-state where a hardcoded literal and an honest read AGREE — and the test that establishes the
	// ratified BREADTH establishes it against `classifyTransition`, which reads the transition DATA and never runs
	// the handler at all. So the claim two tests up ("only the event will ever hold the difference") was asserted
	// for ONE value, and the DIFFERENCE itself had never once been observed.
	//
	// WHY THE ASSERTION IS A SET AND NOT A SECOND LITERAL. The promise is discriminating, not arithmetic: the event
	// has to tell an assessment abandoned because its evidence never arrived (EVIDENCE_PENDING) from one abandoned
	// before anybody began it (READY) from one the assessor withdrew from (ASSESSING). A single extra
	// `toBe('ASSESSING')` would kill this particular mutant and leave the NEXT constant alive; three abandonments
	// in one store, compared as a set, cannot be satisfied by any constant at all.
	//
	// ⛔ REQUESTED IS DELIBERATELY ABSENT, AND THAT IS NOT AN OVERSIGHT. The precondition admits four states, but
	// nothing in the system ever writes `assessmentState: 'REQUESTED'` — `requestAssuranceAssessment` declares
	// `births: ['EVIDENCE_PENDING', 'READY']` and says so in its own words ("Neither value is the machine's
	// declared initialState (REQUESTED), which nothing writes"). A cancel FROM REQUESTED is unreachable by any
	// command sequence, so forcing one by writing the state into the store would assert over an arm no
	// professional can reach. Three reachable active states, three drives.
	it('records the from-state it ACTUALLY left, so the three reachable active states are told apart', () => {
		// Each cancel needs its OWN aggregate: CANCELLED is terminal, so an assessment can only be abandoned once.
		const FROM_READY = 'assess_01ARZ3NDEKTSV4RRFFQ69G5N03';
		const FROM_ASSESSING = 'assess_01ARZ3NDEKTSV4RRFFQ69G5N04';
		const assessmentStateOf = (id: string) =>
			(store.loadObject(id)?.state as Record<string, unknown> | undefined)?.assessmentState;
		const send = (commandType: string, payload: unknown, id: string) => {
			const r = dispatch(commandType, payload, { targetAggregateId: id });
			expect(r.status, `${commandType} on ${id}: ${JSON.stringify(r.error)}`).toBe('ACCEPTED');
		};
		const requestOver = (id: string) => ({
			assessmentId: id,
			assurancePolicyId: POLICY,
			policyVersion: '1.0.0',
			subjectObjectIds: [PWU],
			subjectSemanticVersions: { [PWU]: 1 },
			claimIds: []
		});
		// READY — the required evidence arrived and nobody ever began the assessment.
		send('RequestAssuranceAssessment', requestOver(FROM_READY), FROM_READY);
		send(
			'SubmitEvidenceForAssessment',
			{ evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69G5N10', satisfiesRequirementId: 'EV-01' },
			FROM_READY
		);
		// ASSESSING — the evidence arrived, the assessor began, and then withdrew.
		send('RequestAssuranceAssessment', requestOver(FROM_ASSESSING), FROM_ASSESSING);
		send(
			'SubmitEvidenceForAssessment',
			{ evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69G5N11', satisfiesRequirementId: 'EV-01' },
			FROM_ASSESSING
		);
		send('BeginAssuranceAssessment', {}, FROM_ASSESSING);

		const recorded: Record<string, unknown> = {};
		for (const [from, id] of [
			['EVIDENCE_PENDING', ASSESS],
			['READY', FROM_READY],
			['ASSESSING', FROM_ASSESSING]
		] as const) {
			// The arrangement is what it claims to be BEFORE the handler reads it, so a drive that silently landed
			// somewhere else cannot be mistaken for the handler reporting the wrong state.
			expect(assessmentStateOf(id), `${id} was supposed to be sitting in ${from}`).toBe(from);
			// ⭐ CONTROL — the one this gap was missing. `send` asserts ACCEPTED, so the cancel is proven ADMITTED
			// from every active state THROUGH THE ENGINE rather than through the transition table. A guard that
			// refused two of the three fails here instead of quietly leaving the comparison below with nothing to
			// disagree about; and the refusing side has its own control in the next test, which proves this same
			// command is REFUSED from a concluded state. Neither an admit-everything nor a refuse-everything
			// handler can satisfy both.
			send('CancelAssuranceAssessment', { reason: `abandoned in ${from}` }, id);
			expect(assessmentStateOf(id)).toBe('CANCELLED');
			const evt = store
				.readAggregateEvents('ASSURANCE_ASSESSMENT', id)
				.find((e) => e.eventType === 'AssuranceAssessmentCancelled');
			recorded[from] = (evt?.payload as { cancelledFromState?: string } | undefined)
				?.cancelledFromState;
		}
		// THE PROMISE: each event reports the state ITS OWN assessment was abandoned in — not a constant, and not
		// the terminal CANCELLED that all three of them now read.
		expect(recorded).toEqual({
			EVIDENCE_PENDING: 'EVIDENCE_PENDING',
			READY: 'READY',
			ASSESSING: 'ASSESSING'
		});
		// The same thing said as the property that actually matters: the three abandonments are DISTINGUISHABLE
		// from the event log alone. Any constant — including the 'EVIDENCE_PENDING' the real code legitimately
		// produces for the first of them — collapses this to a single value.
		expect(
			new Set(Object.values(recorded)).size,
			'a constant from-state cannot tell three abandonments apart'
		).toBe(3);
	});

	it('is REFUSED once the assessment has concluded — a verdict is invalidated, never cancelled', () => {
		// Drive to a real disposition first, then try to cancel it.
		expect(
			dispatch('SubmitEvidenceForAssessment', {
				evidenceId: 'evd_01ARZ3NDEKTSV4RRFFQ69G5N09',
				satisfiesRequirementId: 'EV-01'
			}).status
		).toBe('ACCEPTED');
		expect(stateOf().assessmentState).toBe('READY');
		expect(dispatch('BeginAssuranceAssessment', {}).status).toBe('ACCEPTED');
		expect(
			dispatch('CompleteAssuranceAssessment', {
				validatorResult: {
					validatorId: 'v',
					validatorVersion: '1',
					policyId: POLICY,
					policyVersion: '1.0.0',
					assessmentId: ASSESS,
					subjectObjectIds: [PWU],
					subjectSemanticVersions: { [PWU]: 1 },
					claimResults: [],
					evidenceConsideredIds: [],
					evidenceRejected: [],
					observations: [],
					dispositionRecommendation: 'INCONCLUSIVE',
					recommendedControlActions: [],
					residualUncertainty: [],
					limitations: [],
					executionProvenance: {}
				}
			}).status
		).toBe('ACCEPTED');
		expect(stateOf().assessmentState).toBe('INCONCLUSIVE');

		const r = dispatch('CancelAssuranceAssessment', { reason: 'changed my mind' });
		expect(
			r.status,
			'INCONCLUSIVE means "we assessed and could not conclude"; CANCELLED means "we never assessed". ' +
				'Cancelling a concluded assessment would overwrite a real judgment with a claim that none happened'
		).not.toBe('ACCEPTED');
		expect(stateOf().assessmentState).toBe('INCONCLUSIVE');
	});
});
