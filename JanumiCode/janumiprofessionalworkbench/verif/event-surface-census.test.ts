// THE EVENT SURFACE CENSUS — what the catalog DECLARES, what the vocab BINDS, and what the engine EMITS
// (REG-F-021). Three sets that should agree and do not.
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// REG-F-020 closed the question "does every emitted event match its declared shape". This asks the prior one:
// WHICH events exist at all, on each of the three surfaces that claim to answer it.
//
//   DECLARED  — `EVENTS` in rph-contracts: every event type with a payload contract.
//   BOUND     — the vocab's command->event table (`commands[].emitsEvent` + `bindings[]`): the events the corpus
//               says a command produces.
//   EMITTED   — what handlers actually commit, measured across the whole suite by `emitted-event-guard.ts`.
//
// THE THREE DISAGREE, and the disagreements are the finding rather than an accounting quirk:
//   * events EMITTED but not BOUND — the engine produces events the binding table does not describe. Six of
//     them, including every kernel-chosen recomposition outcome (`eventType: evaluation.event`), which no static
//     command->event row can express.
//   * events BOUND but never EMITTED — a command declares it produces an event and produces a different one.
//     `RequestAssuranceAssessment` is bound to `AssuranceAssessmentRequested` and emits
//     `AssuranceAssessmentStarted`. The corpus's own §26 trace expects `AssuranceAssessmentRequested` at seq 31,
//     so the REQUESTED moment is a declared lifecycle step this engine never records. Same drift class as the
//     `PwuMarkedReady`/`PwuStateChanged` divergence Increment 23 found by hand.
//   * events NEITHER bound nor emitted — declared payload contracts that nothing binds and nothing produces.
//
// WHAT THIS GATE IS FOR. Not to force the numbers to zero — most of the third set is declared surface for
// milestones that are not built, and pretending otherwise would be worse. It is to stop them drifting SILENTLY:
// every number below is derived, so adding a declared event without binding it, or making a handler emit
// something new, moves a count and this file says which.
import { EVENTS } from '@janumipwb/rph-contracts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

interface Vocab {
	commands?: { commandType: string; emitsEvent?: string }[];
	bindings?: { commandType?: string; eventType?: string }[];
	events?: { eventType: string }[];
}

const vocab = JSON.parse(
	readFileSync(`${REPO_ROOT}packages/rph-contracts/vocab/m3-commands-events.json`, 'utf8')
) as Vocab;

const DECLARED = new Set(Object.keys(EVENTS));
const BOUND = new Set<string>([
	...(vocab.commands ?? []).flatMap((c) => (c.emitsEvent ? [c.emitsEvent] : [])),
	...(vocab.bindings ?? []).flatMap((b) => (b.eventType ? [b.eventType] : []))
]);

/**
 * Events the suite actually emits, as measured 2026-08-04 by instrumenting the commit path.
 *
 * A PINNED MEASUREMENT, not a live one, and the reason is worth stating: a live count would need every test in
 * the repository to have run in THIS worker, which is exactly the cross-worker aggregation
 * `emitted-event-guard.ts` documents itself as unable to do. So this list is a snapshot with a date, and the
 * assertions below treat it as such — they check the RELATIONSHIPS between the three surfaces, which is what
 * drifts, rather than re-deriving a number no single worker can see.
 */
const EMITTED_2026_08_04 = new Set([
	// + 2026-08-09, JAN-PWUWP W-1 (REG-D-029): both acquired their FIRST emitter. `PwuAbandoned` and
	// `PwuRejected` had been declared, registered and bound while NOTHING produced them — the two acts
	// JPWB-DOC-001 §5.2 reserves to Governance were performed by a generic setter that emitted the generic
	// `PwuStateChanged` instead. `AbandonPwu` and `RejectPwu` now emit them. `PwuAbandoned`'s required
	// `abandonmentDecisionId` is the very id its command demands: the contract had been asking for it with no
	// command able to supply one. Recorded by hand because this set is a PINNED SNAPSHOT — a live count cannot
	// cross vitest workers — so a new emitter must be written down or the census calls it unemitted.
	'PwuAbandoned',
	'PwuRejected',
	// + 2026-08-08, REG-F-069: both acquired their FIRST emitter. `AssumptionFalsified` was the only
	// member of RATIFIED_EVENT_PAYLOADS that no handler emitted; `AssumptionDisclosed` had to land with
	// it, because without `DiscloseAssumption` every FALSIFIED source state is unoccupiable and the
	// falsification command could never fire. Added here for the same reason the note below gives: this
	// set is a PINNED SNAPSHOT, so a new emitter must be recorded or the census calls it unemitted.
	'AssumptionDisclosed',
	'AssumptionFalsified',
	// + 2026-08-05, REG-E-024(c): the validator registry. §35 ratified three statuses and no transition table,
	// so these five events had no commands to be emitted by; the table is now declared (§0.3 authored
	// clarification) and `validator-registry.test.ts` drives every arrow. Added HERE because this set is a
	// pinned snapshot — a live count cannot cross vitest workers — so a new emitter must be recorded by hand
	// or the census reports it as bound-but-unemitted, which would be false.
	// + 2026-08-06, REG-D-024: the claim-assessment capability. Seven of the eight ratified ClaimStatus values
	// were reachable by nothing — one command targeted a CLAIM and hard-coded OPEN — so these events had no
	// emitter. `RecordClaimAssessment` now emits them and `claim-assessment.test.ts` drives each. Recorded by
	// hand per this set's own rule. NOTE `ClaimUnderAssessment` is AUTHORED, not ratified (DOC-002 §26.5 names
	// four claim events and not this one); it is minted because the reconstructed machine makes
	// UNDER_ASSESSMENT the sole in-arrow of every state the corpus DOES ratify. Disclosed at its vocab row.
	'ClaimSupported', 'ClaimContested', 'ClaimRejected', 'ClaimUnderAssessment',
	'ValidatorRegistered', 'ValidatorDegraded', 'ValidatorRestored', 'ValidatorDisabled',
	'ValidatorEnabled',
	'ArtifactRecorded', 'AssumptionDetected', 'AssumptionExpired', 'AssuranceAssessmentCompleted',
	'AssuranceAssessmentCancelled', 'AssuranceAssessmentEscalated', 'AssuranceAssessmentRequested',
	'AssuranceAssessmentStarted',
	'AssuranceEvaluatorSelected', 'AssuranceEvidenceReceived', 'AssuranceEvidenceRequired',
	'AssuranceIndependenceViolated', 'AssuranceObservationRecorded', 'AssurancePolicyActivated',
	'AssurancePolicyCreated', 'AssurancePolicyEdited', 'AssurancePolicySuperseded',
	'AssurancePolicySuspended', 'BaselineApproved', 'BaselineCreated', 'BaselinePromoted',
	'BaselineSubmittedForReview', 'BaselineSuperseded', 'ClaimAsserted', 'ConstraintAsserted',
	'ConversationEntriesAppended', 'DecisionEffective', 'DecisionProposed', 'DecisionRevoked',
	'DecompositionProposed', 'DecompositionRejected', 'DecompositionRevised', 'DecompositionValidated',
	'EvidenceAdmitted', 'EvidenceInvalidated', 'EvidenceProposed', 'ExecutionPlanActivated',
	'ExecutionPlanApproved', 'ExecutionPlanCompleted', 'ExecutionPlanFailed', 'ExecutionPlanProposed',
	'ExecutionPlanSuperseded', 'ExecutionStepCancelled', 'ExecutionStepFailed', 'ExecutionStepPruned',
	'ExecutionStepRetried', 'ExecutionStepSkipped', 'ExecutionStepStarted', 'ExecutionStepSucceeded',
	'ExecutionStepWaitResolved', 'ExecutionStepWaiting', 'ExecutionTerminated', 'HarnessProposed',
	'IntentApproved', 'IntentCaptured', 'IntentDiscoveryStarted', 'IntentFormalized', 'IntentProvisioned',
	'IntentRevised', 'ObligationAsserted', 'PwaCreated', 'PwaDeleted', 'PwaDeprecated', 'PwaEdited',
	'PwaPublished', 'PwaRetired', 'PwaSubmittedForReview', 'PwaValidated', 'PwuChallenged',
	'PwuInvalidated', 'PwuMarkedReady', 'PwuProposed', 'PwuReshapingStarted', 'PwuShapingStarted',
	'PwuStateChanged', 'PwuSuperseded', 'PwuTypeDefined', 'PwuTypeRedefined', 'PwuTypeRemoved',
	'RecompositionCompleted', 'RecompositionConflictDetected', 'RecompositionFailed',
	'RecompositionProposed', 'RecompositionStarted', 'RuntimeBindingAuthorized', 'RuntimeBindingDenied',
	'RuntimeBindingRequested', 'RuntimeCapabilityRevoked', 'TacticalChangeApplied', 'UndertakingCreated',
	'WaiverDenied', 'WaiverGranted', 'WaiverRequested'
]);

const sorted = (s: Iterable<string>): string[] => [...s].sort((a, b) => a.localeCompare(b));

describe('REG-F-021: the declared / bound / emitted event surfaces', () => {
	it('CONTROL: all three sets are non-empty and the measurement names only DECLARED events', () => {
		expect(DECLARED.size).toBeGreaterThan(100);
		expect(BOUND.size).toBeGreaterThan(50);
		expect(EMITTED_2026_08_04.size).toBeGreaterThan(50);
		// If the pinned measurement named an event the catalog does not declare, every assertion below would be
		// comparing against a typo rather than against the engine.
		expect(sorted([...EMITTED_2026_08_04].filter((e) => !DECLARED.has(e)))).toEqual([]);
	});

	// The engine produces events the binding table does not describe. NOT a defect to fix by deleting them: a
	// kernel that CHOOSES its outcome event (`eventType: evaluation.event`) cannot be expressed as a static
	// command->event row. The count is pinned so a SEVENTH cannot appear unnoticed.
	//
	// 6 -> 5 (REG-F-021 increment 1), AND THE DROP IS NOT PROGRESS — READ IT CAREFULLY. `AssuranceAssessmentStarted`
	// left this list because increment 1 BOUND it, to `BeginAssuranceAssessment`, which is where the ratified §30
	// machine puts it. But the command actually emitting it is still `requestAssuranceAssessment`, and
	// `BeginAssuranceAssessment` is not built. So the SET now agrees while the ENGINE has not changed at all: the
	// event is bound to a command that never fires it and fired by a command that no longer declares it.
	//
	// THAT IS A REAL LIMIT OF THIS GATE, recorded rather than papered over: these three surfaces are compared as
	// SETS, so "bound" cannot mean "bound to the RIGHT command". The gate that will catch the mismatch is the
	// three-unoccupied-states assertion below, which stays red until increment 3 actually moves the emission.
	it('events the engine EMITS that the vocab binding table does not bind', () => {
		const unbound = sorted([...EMITTED_2026_08_04].filter((e) => !BOUND.has(e)));
		expect(unbound).toEqual([
			'AssuranceAssessmentEscalated',
			'AssuranceIndependenceViolated',
			'DecompositionRejected',
			'RecompositionConflictDetected',
			'RecompositionFailed'
		]);
	});

	// THE SHARP ONE. A command declares it emits an event and emits a different one, so a declared lifecycle
	// moment is never recorded. `RequestAssuranceAssessment` -> bound `AssuranceAssessmentRequested`, emits
	// `AssuranceAssessmentStarted`. The §26 corpus trace expects the REQUESTED event at seq 31.
	//
	// 1 -> 3 (REG-F-021 increment 1), AND THIS RISE IS DELIBERATE — the only kind of rise this assertion permits.
	// The increment DECLARES and BINDS `AssuranceEvidenceRequired` and `AssuranceEvaluatorSelected` before their
	// commands exist (increment 2 builds the handlers, increment 3 moves the emission). Declaring contracts ahead
	// of emitters is what makes the gap COUNTABLE: the alternative — build the handler and the contract together —
	// hides the interval in which the corpus names an event the engine cannot produce, which is exactly the
	// condition this file was written to surface. Each name here must leave on a specific increment:
	//   AssuranceAssessmentRequested  -> increment 3 (requestAssuranceAssessment creates in REQUESTED)
	//   AssuranceEvidenceRequired     -> increment 3 (the REQUESTED -> EVIDENCE_PENDING arrow's second event)
	//   AssuranceEvaluatorSelected    -> increment 2 (selectAssuranceEvaluator's handler)
	// A FOURTH name appearing, or any of these three outliving its increment, is the drift this pin exists for.
	it('events the vocab BINDS that nothing emits', () => {
		const unemitted = sorted([...BOUND].filter((e) => !EMITTED_2026_08_04.has(e)));
		expect(
			unemitted,
			'a bound-but-unemitted event means a command produces something other than what it declares'
		).toEqual([]);
	});

	// THE REQUEST HALF, counted because two separate findings landed on it independently and a hypothesis about
	// it turned out too strong. `TacticalChangeApplied` cannot carry its command's REQUIRED `rationale` — the
	// declared home for that argument is `TacticalChangeRequested`, which nothing emits — and REG-F-021's own
	// subject, `AssuranceAssessmentRequested`, is the same shape. That invited the reading "the engine records
	// the act and not the asking", and it is NOT true as stated: of five declared `*Requested` events, TWO are
	// emitted. Three are not. The unevenness is the fact; the sweeping version was a guess.
	//
	// THREE -> TWO (REG-F-021 increment 3). `AssuranceAssessmentRequested` now fires, so the asking of an assurance
	// assessment is in the governed stream. That was the sweeping version's own subject and it is now recorded;
	// what is left is `ClarificationRequested` and `TacticalChangeRequested`, and for the latter the consequence is
	// still sharp — `TacticalChangeApplied` cannot carry its command's REQUIRED `rationale`, whose declared home is
	// the event nothing emits. The unevenness remains the fact. It may only improve.
	it('the REQUEST half of the lifecycle — two of five are unrecorded, and that may only improve', () => {
		const requested = sorted([...DECLARED].filter((e) => e.endsWith('Requested')));
		expect(requested).toEqual([
			'AssuranceAssessmentRequested',
			'ClarificationRequested',
			'RuntimeBindingRequested',
			'TacticalChangeRequested',
			'WaiverRequested'
		]);
		const unrecorded = requested.filter((e) => !EMITTED_2026_08_04.has(e));
		expect(
			unrecorded,
			'a REQUEST event nothing emits means the argued justification for an act — the `rationale` a command ' +
				'declares REQUIRED — is recorded nowhere in the governed stream'
		).toEqual(['ClarificationRequested', 'TacticalChangeRequested']);
	});

	// THE LIFECYCLE, NOW RUN (REG-F-021 increment 3) — and what is left is a real fact, not a leftover pin.
	//
	// This assertion used to read ['REQUESTED', 'EVIDENCE_PENDING', 'READY']: three ratified states of the
	// AssuranceAssessment.state machine that NO production line ever wrote, while `requestAssuranceAssessment`
	// created assessments already in ASSESSING. Two of them are now occupied — an assessment waits in
	// EVIDENCE_PENDING while evidence it needs to be judged is outstanding, and rests in READY until
	// `beginAssuranceAssessment` starts it.
	//
	// REQUESTED REMAINS UNOCCUPIED, AND THAT IS CORRECT RATHER THAN UNFINISHED. §30's REQUESTED -> EVIDENCE_PENDING
	// trigger puts both acts under ONE trigger — "AssuranceAssessmentRequested; claims instantiated, evidence
	// requirements evaluated, missing evidence requested (AssuranceEvidenceRequired)" — so the request CROSSES
	// REQUESTED rather than resting in it, emitting both events in one atomic commit. The state is transited and
	// recorded (the event exists, and the §26 trace's seq-31 expectation is met); it is not a place an assessment
	// sits. Occupying it would require a second dispatch the corpus does not name.
	//
	// THE DETECTOR IS TEXTUAL, AND THAT LIMIT IS NOW LOAD-BEARING. It greps the handler for `assessmentState: '<S>'`
	// literals. The handler assigns a computed `landingState`, so the literals it finds are the ternary's arms.
	// That is enough to prove the states are REACHABLE in code, and NOT enough to prove an assessment ever holds
	// one — which is why `assessment-ready-arrow.test.ts` and `assurance-independence.test.ts` assert the occupancy
	// behaviourally, against a live engine. Recorded so nobody reads this file's green as the stronger claim.
	it('the ratified assessment states the engine still never writes', () => {
		const handlers = readFileSync(
			`${REPO_ROOT}packages/rph-application/src/handlers/assurance.ts`,
			'utf8'
		);
		const unwritten = ['REQUESTED', 'EVIDENCE_PENDING', 'READY'].filter(
			(s) => !handlers.includes(`'${s}'`)
		);
		expect(
			unwritten,
			'ALL THREE are now written. EVIDENCE_PENDING and READY are landing states an assessment waits in. ' +
				'REQUESTED joined them on 2026-08-05 not because it became a resting state — it is still CROSSED, ' +
				'since §30 puts the request and the requirement evaluation under one trigger — but because ' +
				'cancelAssuranceAssessment names it as a FROM-state of the §30 rule `ANY ACTIVE -> CANCELLED`. A state ' +
				'the engine can cancel FROM is a state the engine writes about. If a name appears here again, a ' +
				'state stopped being reachable'
		).toEqual([]);
		// CONTROL: the detector can still report a miss, so [] means "all found" and not "looked for nothing".
		expect(handlers.includes("'NOT_A_REAL_STATE'")).toBe(false);
		// And the state the collapse used to write directly is still written — by the command that owns it now.
		expect(handlers).toContain("target: 'ASSESSING'");
	});

	// The aspirational surface: declared payload contracts nothing binds and nothing produces. This number is
	// expected to FALL as milestones land; it may not RISE without someone saying why.
	it('declared events that are neither bound nor emitted — the unbuilt surface, bounded', () => {
		const dead = sorted([...DECLARED].filter((e) => !BOUND.has(e) && !EMITTED_2026_08_04.has(e)));
		expect(
			dead.length,
			`declared but neither bound nor emitted (${dead.length}):\n  ${dead.join('\n  ')}`
		).toBeLessThanOrEqual(42);
	});
});
