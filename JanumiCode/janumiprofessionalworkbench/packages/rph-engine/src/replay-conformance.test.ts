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
// AND THAT IS WHAT HAPPENED, one increment later. Increment 25 made the seed drive the real assurance loop and
// these pins went red by SHRINKING: 28 missing event types -> 23, and the assurance chain went from zero links to
// five. Recorded here because it is the only evidence that the pins work as intended rather than calcifying.
//
// It also corrected the sharper error in this file's first version, which said "the professional loop is not
// implemented". It WAS implemented — every one of those commands was registered in HANDLERS and emitting nothing
// because the seed never called them. The loop was built and bypassed, which is a different defect with a much
// cheaper fix, and I asserted the expensive one without checking the registry. Same error family as the rest of
// this effort: absence claimed from the outside of a thing I had not opened.
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
		// The engine's FIRST event is AssurancePolicyCreated, not IntentCaptured: as of Increment 25 the drive
		// stands up the policy its assessments are judged under before doing the work. The §26 trace omits that
		// setup, which is a fair thing for a "representative" trace to do. So the premise is co-reference, not
		// alignment at index 0.
		expect(driveLive()).toContain('IntentCaptured');
	});

	it('DEFICIENCY: the engine emits none of these 14 §26 event types (28 -> 23 -> 16 -> 14 as the loops were wired)', () => {
		const actual = new Set(driveLive());
		const expected = [...new Set(loadExpectedEvents().map((e) => e.event))];
		const missing = expected.filter((n) => !actual.has(n)).sort();

		// PIN. This list is a defect register, not a specification. It must only ever SHRINK. If a change makes
		// this red by ADDING a name, the engine has REGRESSED — an event type it used to emit, the corpus's own
		// worked example expects, and it no longer produces.
		//
		// 28 -> 23 in Increment 25 (claim/evidence/assessment/observation now fire for real). Three entries below
		// are MODELING DRIFT rather than absence, and will not go away by writing more seed code — they need the
		// vocab conflicts resolved:
		//   AssuranceAssessmentRequested — requestAssuranceAssessment emits AssuranceAssessmentStarted (it fuses
		//     request-and-begin; DOC-004 §32's separate `beginAssuranceAssessment` does not exist here).
		//   AssuranceAssessmentSatisfied / ...ConditionallySatisfied — completeAssuranceAssessment emits ONE
		//     AssuranceAssessmentCompleted carrying the disposition, per DOC-007; DOC-002 names five outcome
		//     events. The vocab's conflicts[] records the choice and says "pick one modeling" — it is unpicked.
		expect(missing).toEqual([
			'AssuranceAssessmentConditionallySatisfied',
			'AssuranceAssessmentRequested',
			'AssuranceAssessmentSatisfied',
			'ClarificationRequested',
			'ExecutionPlanRevised',
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

	it('PROGRESS: 12 of the 17 chain-of-custody links now fire — claim to evidence to assessment to decision to baseline', () => {
		const actual = new Set(driveLive());
		const emitted = ASSURANCE_CHAIN.filter((n) => actual.has(n));
		// Was []. Every assurance fact in the terminal graph used to be asserted; a claim is now asserted,
		// evidence proposed and ADMITTED, an assessment started against a real policy at a real subject version,
		// observations recorded, and a full §20 verdict returned (as AssuranceAssessmentCompleted, which is not
		// in this list because the list uses the §26 trace's five-outcome-event spelling — see the pin above).
		//
		// This must only ever GROW. Still absent: the governance half — no decision proposes or takes effect, no
		// baseline is created or promoted, and no assumption is ever detected. So the Architecture PWU still
		// reaches BASELINED with no Baseline object, which ratified RPH-BAS-004 forbids.
		expect(emitted, 'this list must only grow — update the pin when it does').toEqual([
			'AssumptionDetected',
			'ClaimAsserted',
			'EvidenceProposed',
			'EvidenceAdmitted',
			'AssuranceAssessmentStarted',
			'AssuranceObservationRecorded',
			'DecisionProposed',
			'DecisionEffective',
			'BaselineCreated',
			'BaselineSubmittedForReview',
			'BaselineApproved',
			'BaselinePromoted'
		]);
	});

	it('DEFICIENCY: 67 generic PwuStateChanged still carry the axes the trace expects zero of', () => {
		const actual = driveLive();
		const generic = actual.filter((n) => n === 'PwuStateChanged').length;
		const expectedGeneric = loadExpectedEvents().filter(
			(e) => e.event === 'PwuStateChanged'
		).length;

		// UNCHANGED at 67 by Increment 25, deliberately. The corpus's worked example reaches its terminal state
		// through NAMED events (PwuSatisfied, PwuBaselined...); this engine reaches the same terminal axes via the
		// controller lever. That lever is not itself wrong — ratified RPH-PWU-006's "When" IS "the controller
		// evaluates the PWU" — so the fix was never to delete these hops. It was to make them TRUE: each
		// assurance hop now follows its declared trigger and cites the object that caused it in
		// supportingObjectIds, instead of passing [] and asserting the outcome.
		//
		// What remains is the naming: the trace would spell the arrival at SATISFIED `PwuSatisfied`. That is the
		// same primary-vs-generic question Increment 23 settled for markPwuReady, unresolved for the rest.
		expect(expectedGeneric, 'the §26 trace never emits the generic event').toBe(0);
		expect(generic).toBe(67);
	});

	it("CHARACTERIZATION: the engine emits 254 events to the trace's 72, and is still not a superset", () => {
		const actual = driveLive();
		// 110 -> 153 -> 166 -> 251 -> 254. The count was never the point — at 110 it was inflated by the generic
		// setter while 28 named types were missing. Volume is not coverage; the pins above are. The jump to 251 is
		// mostly the de minimis FLOOR: three assessments over every AI-produced result, which is what the workbench
		// is for; +3 to 254 is Increment I5 creating the three floor policies the standalone drive had only cited.
		// An assurance system's event log SHOULD be dominated by assurance.
		expect(actual).toHaveLength(254);
	});
});
