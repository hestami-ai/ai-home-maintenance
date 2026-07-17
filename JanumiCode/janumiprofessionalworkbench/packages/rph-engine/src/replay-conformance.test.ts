// THE ORACLE, POINTED AT THE ENGINE — a characterization of the distance between what the corpus's own worked
// example says a professional undertaking emits, and what this engine actually emits when driven live.
//
// WHY THIS FILE EXISTS. `replay.test.ts` calls itself "the headline end-to-end proof". It loads
// fixtures/expected-events.jsonl — a HAND-AUTHORED transcription of the Reference Undertaking's "# 26. Expected
// Event Trace" — and runs the RPH-FIX conformance checks over THAT. The engine is never involved. It proves the
// fixture is self-consistent with itself. An oracle that cannot disagree with the system is not observing it.
//
// The proof that this mattered: expected-events.jsonl has said `PwuMarkedReady` at seq 20/33 since it was
// written. The engine emitted `PwuStateChanged` there instead, for as long as it has existed. The fixture agreed
// with the corpus, the engine disagreed with both, and NOTHING compared them — so the drift survived every green
// run until it was found by reading the corpus by hand (Increment 23).
//
// WHAT THIS FILE DOES NOT DO. It does not assert conformance, because there is none to assert: the engine cannot
// currently produce the §26 trace, and the gap is not a rounding error (see below). Asserting conformance would
// require weakening the oracle until it passed — which is how the previous oracle came to be decorative. Instead
// these tests PIN THE GAP as a number and a list. They are characterization tests: every expectation below is a
// statement of a DEFICIENCY, and each one must only ever shrink. When someone implements the assurance loop,
// these go red and the correct fix is to delete entries — never to add them.
//
// Note the §26 trace is "representative rather than exhaustive" (its own words), so exact sequence equality is
// NOT the right bar and is not attempted. The bar here is coverage of event TYPES: the engine should eventually
// be able to emit every kind of event the corpus's worked example says this undertaking produces.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { createEngine, driveReferenceUndertaking, loadExpectedEvents } from './index.js';

function driveLive(): string[] {
	const engine = createEngine({
		ontology,
		now: () => '2026-07-12T00:00:00Z',
		newEventId: (() => {
			let s = 0;
			return () => `evt_${++s}`;
		})()
	});
	driveReferenceUndertaking(engine);
	return engine.readAllEvents().map((e) => e.eventType);
}

// The whole assurance chain of custody: a claim is asserted, evidence is proposed and admitted, an assessment is
// requested/started/observed/dispositioned, a decision is proposed and made effective, a baseline is created and
// promoted. This is the machinery by which a professional result becomes TRUSTWORTHY rather than merely finished.
const ASSURANCE_CHAIN = [
	'AssumptionDetected',
	'ClaimAsserted',
	'EvidenceProposed',
	'EvidenceAdmitted',
	'AssuranceAssessmentRequested',
	'AssuranceAssessmentStarted',
	'AssuranceObservationRecorded',
	'AssuranceAssessmentSatisfied',
	'AssuranceAssessmentConditionallySatisfied',
	'DecisionProposed',
	'DecisionEffective',
	'BaselineCreated',
	'BaselineSubmittedForReview',
	'BaselineApproved',
	'BaselinePromoted',
	'PwuBaselined',
	'PwuSatisfied'
] as const;

describe('the §26 oracle pointed at the live engine', () => {
	it('PREMISE: the fixture and the engine describe the SAME undertaking, so they are comparable', () => {
		// Both are the Field Service Management SaaS Reference Undertaking. If this ever stops being true the
		// comparison below is meaningless rather than merely failing.
		const expected = loadExpectedEvents();
		expect(expected).toHaveLength(72);
		expect(expected[0]!.event).toBe('IntentCaptured');
		expect(driveLive()[0]).toBe('IntentCaptured');
	});

	it('DEFICIENCY: the engine emits none of the 28 §26 event types below — the professional loop is not implemented', () => {
		const actual = new Set(driveLive());
		const expected = [...new Set(loadExpectedEvents().map((e) => e.event))];
		const missing = expected.filter((n) => !actual.has(n)).sort();

		// PIN. This list is a defect register, not a specification. It must only ever SHRINK. If a change makes
		// this red by ADDING a name, the engine has REGRESSED — an event type it used to emit, the corpus's own
		// worked example expects, and it no longer produces.
		expect(missing).toEqual([
			'AssumptionDetected',
			'AssuranceAssessmentConditionallySatisfied',
			'AssuranceAssessmentRequested',
			'AssuranceAssessmentSatisfied',
			'AssuranceAssessmentStarted',
			'AssuranceObservationRecorded',
			'BaselineApproved',
			'BaselineCreated',
			'BaselinePromoted',
			'BaselineSubmittedForReview',
			'ClaimAsserted',
			'ClarificationRequested',
			'DecisionEffective',
			'DecisionProposed',
			'EvidenceAdmitted',
			'EvidenceProposed',
			'ExecutionPlanRevised',
			'ExecutionStepStarted',
			'ExecutionStepSucceeded',
			'IntentConstraintRefined',
			'PwuBaselined',
			'PwuChallenged',
			'PwuSatisfied',
			'RecompositionCompleted',
			'RecompositionStarted',
			'RuntimeBindingAuthorized',
			'RuntimeBindingRequested',
			'TacticalChangeRequested'
		]);
	});

	it('DEFICIENCY: the ENTIRE assurance chain of custody is absent from the live engine', () => {
		const actual = new Set(driveLive());
		const emitted = ASSURANCE_CHAIN.filter((n) => actual.has(n));
		// Not one link of claim -> evidence -> assessment -> decision -> baseline is exercised. Every assurance
		// FACT in the reference undertaking's terminal graph is therefore asserted, not earned. This is the
		// finding that matters most in this file: the seed demonstrates the SHAPE of a professional result
		// without the process that would make it trustworthy.
		expect(emitted, 'any link emitted here is progress — update the pin').toEqual([]);
	});

	it('DEFICIENCY: 67 generic PwuStateChanged stand in for the loop the trace expects zero of', () => {
		const actual = driveLive();
		const generic = actual.filter((n) => n === 'PwuStateChanged').length;
		const expectedGeneric = loadExpectedEvents().filter(
			(e) => e.event === 'PwuStateChanged'
		).length;

		// The corpus's worked example reaches its terminal state through NAMED events (PwuSatisfied, PwuBaselined,
		// AssuranceAssessmentSatisfied...). This engine reaches the same terminal AXES by having a controller
		// command write them directly. The axes match; the history does not. A governed stream that records
		// "the state became SATISFIED" without recording WHY cannot be reasoned over after the fact — which is
		// the entire purpose of having one.
		expect(expectedGeneric, 'the §26 trace never emits the generic event').toBe(0);
		expect(generic).toBe(67);
	});

	it("DEFICIENCY: the engine emits 110 events to the trace's 72, and is not a superset", () => {
		const actual = driveLive();
		expect(actual).toHaveLength(110);
		// More events, less loop: the count is inflated by the generic setter while 28 named types are missing.
		// Volume is not coverage.
		expect(actual.length).toBeGreaterThan(loadExpectedEvents().length);
	});
});
