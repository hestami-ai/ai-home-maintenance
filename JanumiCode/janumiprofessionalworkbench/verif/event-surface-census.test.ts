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
	'ArtifactRecorded', 'AssumptionDetected', 'AssumptionExpired', 'AssuranceAssessmentCompleted',
	'AssuranceAssessmentEscalated', 'AssuranceAssessmentStarted', 'AssuranceEvidenceReceived',
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
	it('events the engine EMITS that the vocab binding table does not bind', () => {
		const unbound = sorted([...EMITTED_2026_08_04].filter((e) => !BOUND.has(e)));
		expect(unbound).toEqual([
			'AssuranceAssessmentEscalated',
			'AssuranceAssessmentStarted',
			'AssuranceIndependenceViolated',
			'DecompositionRejected',
			'RecompositionConflictDetected',
			'RecompositionFailed'
		]);
	});

	// THE SHARP ONE. A command declares it emits an event and emits a different one, so a declared lifecycle
	// moment is never recorded. `RequestAssuranceAssessment` -> bound `AssuranceAssessmentRequested`, emits
	// `AssuranceAssessmentStarted`. The §26 corpus trace expects the REQUESTED event at seq 31.
	it('events the vocab BINDS that nothing emits', () => {
		const unemitted = sorted([...BOUND].filter((e) => !EMITTED_2026_08_04.has(e)));
		expect(
			unemitted,
			'a bound-but-unemitted event means a command produces something other than what it declares'
		).toEqual(['AssuranceAssessmentRequested']);
	});

	// THE REQUEST HALF, counted because two separate findings landed on it independently and a hypothesis about
	// it turned out too strong. `TacticalChangeApplied` cannot carry its command's REQUIRED `rationale` — the
	// declared home for that argument is `TacticalChangeRequested`, which nothing emits — and REG-F-021's own
	// subject, `AssuranceAssessmentRequested`, is the same shape. That invited the reading "the engine records
	// the act and not the asking", and it is NOT true as stated: of five declared `*Requested` events, TWO are
	// emitted. Three are not. The unevenness is the fact; the sweeping version was a guess.
	it('the REQUEST half of the lifecycle — three of five are unrecorded, and that may only improve', () => {
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
		).toEqual(['AssuranceAssessmentRequested', 'ClarificationRequested', 'TacticalChangeRequested']);
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
