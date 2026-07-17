// DOES EVERY EMITTED EVENT MATCH ITS OWN DECLARED SHAPE?
//
// The (d2) event gate (kit.ts) enforces RATIFIED payloads at runtime — the 15 events DOC-007 actually
// schematizes. That scope is deliberate and correct: we do not enforce our own inventions as though the corpus
// had ratified them. But every event in this system has a DECLARED shape in the vocab, ratified or not, and
// nothing has ever checked the other ~107 against reality.
//
// The cost of that gap is not hypothetical. Two increments in a row found the same defect by accident:
//   - all five PWU lifecycle events DECLARED `workLifecycleState` and emitted `command.payload` (Increment 29) —
//     PwuShapingStarted's command payload is `{}`, so the event recording "began shaping" recorded nothing;
//   - AssuranceAssessmentStarted DECLARES `{ disposition }` and emits six entirely different fields, sharing
//     ZERO with its schema (found while trying to build the Assurance View on top of it).
//
// Both were found by hand, while looking for something else. This test looks on purpose, over the whole live
// log. It does not widen the (d2) gate — enforcement scope is a governance question and stays where it is. It
// MEASURES, which is what catches this class.
//
// The subject is the reference undertaking's real stream: every event this system emits in a full undertaking.
import { EVENTS } from '@janumipwb/rph-contracts';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { createEngine, driveReferenceUndertaking } from './index.js';

interface Violation {
	readonly eventType: string;
	readonly detail: string;
}

function driveAndCheck(): { violations: Violation[]; checked: number; types: number } {
	const engine = createEngine({
		ontology,
		now: () => '2026-07-12T00:00:00Z',
		newEventId: (() => {
			let s = 0;
			return () => `evt_${++s}`;
		})()
	});
	driveReferenceUndertaking(engine);

	const registry = EVENTS as Record<string, { payload?: { safeParse: (v: unknown) => unknown } }>;
	const seen = new Map<string, Violation>();
	let checked = 0;
	const types = new Set<string>();
	for (const event of engine.readAllEvents()) {
		types.add(event.eventType);
		const schema = registry[event.eventType]?.payload;
		if (!schema) continue;
		checked += 1;
		const r = schema.safeParse(event.payload) as
			| { success: true }
			| { success: false; error: { issues: { path: (string | number)[]; message: string }[] } };
		if (r.success || seen.has(event.eventType)) continue;
		seen.set(event.eventType, {
			eventType: event.eventType,
			detail: r.error.issues
				.slice(0, 3)
				.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
				.join('; ')
		});
	}
	return { violations: [...seen.values()], checked, types: types.size };
}

describe('emitted events vs their declared shapes', () => {
	it('PREMISE: the reference undertaking exercises a broad slice of the event catalog', () => {
		const { checked, types } = driveAndCheck();
		// If this drive stopped emitting most event types, the sweep below would pass vacuously.
		expect(types).toBeGreaterThanOrEqual(20);
		expect(checked).toBeGreaterThan(200);
	});

	it('DEFECT REGISTER: 10 event types emit a payload their own declared shape rejects', () => {
		const { violations } = driveAndCheck();
		// PIN — a defect register, not a specification. It must only ever SHRINK. An entry here means an event
		// and its declared contract disagree, and BOTH are ours: either the handler emits the wrong thing, or the
		// declared shape describes something the event was never for.
		//
		// THE SHAPE OF THE CLASS. Every one of these emits `command.payload` (or the created object's state)
		// while its vocab entry declares the RESULTING STATUS as a const — `status`, `stepState`, `intentStatus`,
		// `disposition`. So the event that records "this became APPROVED" does not contain the word APPROVED, and
		// several also carry keys the strict schema rejects outright. These are precisely the events a projection
		// must read to know what happened, which is how the Work view came to report every PWU as PROPOSED.
		//
		// AssuranceAssessmentStarted was the twelfth (fixed earlier — the SCHEMA was the wrong side there).
		// ExecutionStepStarted is the thirteenth, fixed now: the handler was the wrong side — it emitted
		// `{ stepId }` while the event exists to record the `stepState` (RUNNING) the step transitioned INTO, so it
		// now supplies the declared shape. The remaining ten each need the same judgement made deliberately, one at
		// a time, and several interact with the unresolved request-and-begin / five-outcome-events modeling drift.
		// Papering them over with a bulk edit would be the fabrication this effort exists to prevent.
		expect(violations.map((v) => v.eventType).sort()).toEqual([
			'BaselineApproved',
			'BaselineCreated',
			'BaselineSubmittedForReview',
			'DecisionProposed',
			'DecompositionProposed',
			'DecompositionValidated',
			'EvidenceProposed',
			'ExecutionPlanApproved',
			'ExecutionPlanProposed',
			'IntentDiscoveryStarted'
		]);
	});

	it('the events a projection most depends on DO conform (the ones already fixed stay fixed)', () => {
		const { violations } = driveAndCheck();
		const broken = new Set(violations.map((v) => v.eventType));
		// Increments 22-31 conformed these deliberately; they are the spine the Work view and RPH-PER-006 fold.
		for (const eventType of [
			'PwuProposed',
			'PwuShapingStarted',
			'PwuMarkedReady',
			'PwuStateChanged',
			'AssuranceAssessmentStarted',
			'AssuranceAssessmentCompleted',
			'AssuranceObservationRecorded',
			'ClaimAsserted',
			'DecisionEffective',
			'BaselinePromoted',
			'ExecutionStepStarted'
		]) {
			expect(broken.has(eventType), `${eventType} regressed`).toBe(false);
		}
	});
});
