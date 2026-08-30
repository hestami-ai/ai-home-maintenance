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
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { describe, expect, it } from 'vitest';
import { createEngine, driveReferenceUndertaking, loadExpectedEvents } from './index.js';

// ── THE SESSION THE DRIVE MUST RUN IN, AND WHY IT IS NOT THE SHARED CREDENTIAL ────────────────────────────────
// `driveReferenceUndertaking` AUTHORS ITS ACTING PARTY into the payloads it sends, and `authority` on its two
// `ProposeDecision` commands is load-bearing: REG-F-014 requires the declared authority to EQUAL the issuing
// actor, and the engine now stamps the issuer from the authenticated session. So the session's principal must
// BE that party — `owner-1`, the Undertaking Owner. Under any other principal the drive is refused at
// ProposeDecision with RPH_AUTHORITY_INSUFFICIENT, its fail-loud `send` throws, and every PIN in this file
// would go red for a reason that has nothing to do with the §26 gap it exists to measure.
//
// ⚠ The literal is duplicated from `reference-undertaking.ts`'s module-private ACTOR, which is not exported.
// `executionInstanceId` is carried for the same reason it exists there: with it, the stamped `issuedBy` is the
// exact value the envelope carried before the trust boundary landed — which is what keeps the 332-event
// characterization below a statement about the DRIVE rather than about the fixture's choice of session.
const DIR = testDirectory([
	{
		actorId: 'owner-1',
		actorType: 'HUMAN',
		displayName: 'Undertaking Owner',
		executionInstanceId: 'exec-production',
		tenantId: 'tenant-test',
		organizationId: 'org-test'
	}
]);
const OWNER = DIR.credentialFor('owner-1');

function driveLive(): string[] {
	const engine = createEngine({
		authenticate: DIR.authenticate,
		ontology,
		now: () => '2026-07-12T00:00:00Z',
		newEventId: (() => {
			let s = 0;
			return () => `evt_${++s}`;
		})()
	}).as(OWNER);
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

	// ── THE ORDER LIMB (REG-D-047, 2026-08-30) ───────────────────────────────────────────────────────────────
	//
	// ⚠ THE §26 TRACE HAS CARRIED `seq` SINCE IT WAS WRITTEN, AND UNTIL NOW NOTHING READ IT. Every limb of this
	// oracle asked WHETHER an event type appears, never WHEN. The word `seq` occurred in this file only inside
	// comments. So the engine could emit every expected event in an order the corpus never describes and the
	// whole suite stayed green — which is exactly what it does.
	//
	// `REG-D-047` ruled the flow is an ORDER, on the authority chain rather than on preference: `m12-conformance
	// .json` carries `RPH-E2E-001` with `sourceRef: "§24"`; `CON-000 B1` as amended by `REG-D-034` gives the
	// source corpora authority for WORKED SCENARIOS; and §24 states the flow as a numbered list 1..13. §26's
	// `seq` says the same thing a second way — assurance at 8-11 before `IntentApproved` at 14, the Intent
	// Baseline at 15-16 before the Architecture PWU at 29. Two ratified artifacts, one order.
	//
	// ⚠ THE PRECEDENCES ARE DERIVED FROM `seq`, NEVER HAND-LISTED. Hand-listing is the defect one level up: a
	// hand-check of fourteen pairs found TWO violations, and deriving all 458 found TWENTY-THREE. The rule used
	// is the unambiguous one — A precedes B only when EVERY occurrence of A precedes EVERY occurrence of B in
	// the trace — so nothing here rests on a judgement about which occurrence counts.
	//
	// ⚠ AND THE COMPARISON IS FIRST-OCCURRENCE, WHICH IS A CORRECTION. A first instrument compared LAST(A) to
	// FIRST(B) and reported thirty violations. `DecompositionProposed -> DecompositionValidated` was among them,
	// which is absurd: there are two decompositions and each pair is correctly ordered — last-proposed simply
	// fell after first-validated. Comparing across instances of a repeated act measures the fixture's shape, not
	// the journey's order.
	//
	// ⚠ AND THIS LIMB DOES NOT ASSERT SEQUENCE EQUALITY, WHICH THIS FILE'S OWN HEADER RULES OUT. The §26 trace
	// is "representative rather than exhaustive" in its own words, so demanding the live stream match it position
	// for position would be the wrong bar and would have to be weakened until it passed — the decorative-oracle
	// failure this file was written to end. PRECEDENCE is strictly weaker than equality and survives the trace
	// being representative: it claims only that where the corpus puts A wholly before B, the engine does not put
	// B first. A representative trace can omit acts; it cannot invert the ones it names.
	//
	// ⚠ CONTROL AGAINST THE OTHER CONFOUND: the same derivation run against `seedWorkbench` — a DIFFERENT drive,
	// 446 events across several undertakings rather than 332 across one — yields the SAME 23 of 198. The count
	// is structural to the drive logic, not an artifact of what else the seed happens to build.
	it('DEFICIENCY: 23 of 198 ratified §26 precedences are violated — the engine does the right acts in the wrong order', () => {
		const expected = loadExpectedEvents();
		const span = new Map<string, { min: number; max: number }>();
		for (const r of expected) {
			const s = span.get(r.event) ?? { min: Infinity, max: -Infinity };
			span.set(r.event, { min: Math.min(s.min, r.seq), max: Math.max(s.max, r.seq) });
		}
		const pairs: [string, string][] = [];
		for (const [a, sa] of span)
			for (const [b, sb] of span) if (a !== b && sa.max < sb.min) pairs.push([a, b]);

		const live = driveLive();
		const firstAt = new Map<string, number>();
		live.forEach((t, i) => {
			if (!firstAt.has(t)) firstAt.set(t, i + 1);
		});

		// Pairs where the engine emits neither or only one member are not order defects — they are the emission
		// deficiency the limb above already pins, and counting them here would double-report one fault as two.
		const applicable = pairs.filter(([a, b]) => firstAt.has(a) && firstAt.has(b));
		const violated = applicable
			.filter(([a, b]) => firstAt.get(a)! > firstAt.get(b)!)
			.map(([a, b]) => `${a} -> ${b}`)
			.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));

		// PIN. A defect register, not a specification. It must only ever SHRINK. A name ADDED here is a
		// REGRESSION: an ordering the corpus states, that the engine used to respect, and no longer does.
		expect(violated).toEqual([
			'AssumptionDetected -> BaselineApproved',
			'AssumptionDetected -> BaselineSubmittedForReview',
			'AssuranceAssessmentStarted -> ClaimAsserted',
			'AssuranceAssessmentStarted -> DecompositionProposed',
			'AssuranceAssessmentStarted -> DecompositionValidated',
			'AssuranceAssessmentStarted -> EvidenceProposed',
			'AssuranceAssessmentStarted -> ExecutionPlanActivated',
			'AssuranceAssessmentStarted -> ExecutionPlanApproved',
			'AssuranceAssessmentStarted -> ExecutionPlanProposed',
			'AssuranceAssessmentStarted -> ExecutionStepStarted',
			// ⚠ THE ONE THAT MATTERS MOST. The intent is APPROVED before the assurance §24 step 4 places ahead of
			// step 5 has even STARTED. Clause (a) of RPH-E2E-001 — "ends with intent approved" — is true at the
			// end of the run while the approval was not backed by that assessment when it was made. STA-2 forbids
			// this shape one level up for execution and satisfaction; here it is an approval and its assurance.
			'AssuranceAssessmentStarted -> IntentApproved',
			'AssuranceAssessmentStarted -> PwuMarkedReady',
			'AssuranceAssessmentStarted -> PwuShapingStarted',
			'AssuranceObservationRecorded -> BaselineApproved',
			'AssuranceObservationRecorded -> BaselineSubmittedForReview',
			'AssuranceObservationRecorded -> PwuBaselined',
			'ClaimAsserted -> DecompositionProposed',
			'ClaimAsserted -> DecompositionValidated',
			'ClaimAsserted -> PwuMarkedReady',
			'DecisionEffective -> BaselineSubmittedForReview',
			'DecisionProposed -> BaselineSubmittedForReview',
			'PwuShapingStarted -> DecompositionProposed',
			'PwuShapingStarted -> DecompositionValidated'
		]);
	});

	// CONTROL — THE DERIVATION READS A REAL TRACE AND A REAL POPULATION. Every assertion above is satisfied by a
	// derivation that produces no pairs at all: an empty `violated` would equal an empty pin and the limb would
	// be green having measured nothing.
	it('CONTROL — the precedence derivation has a real population', () => {
		const expected = loadExpectedEvents();
		const types = new Set(expected.map((e) => e.event));
		expect(types.size, 'distinct ratified event types').toBe(40);
		expect(expected.every((e) => typeof e.seq === 'number'), 'every step carries a seq').toBe(true);
	});

	// CONTROL — IT DETECTS AN INVERSION. Without this, a comparison that never fires would pass the pin above by
	// returning nothing. The fixture is synthetic so the control cannot be made green by changing the engine.
	it('CONTROL — a planted inversion is detected', () => {
		const order = ['B', 'A'];
		const firstAt = new Map<string, number>();
		order.forEach((t, i) => {
			if (!firstAt.has(t)) firstAt.set(t, i + 1);
		});
		// ratified: A (seq 1) strictly precedes B (seq 2); live emits B first.
		expect(firstAt.get('A')! > firstAt.get('B')!, 'the inversion must be visible').toBe(true);
	});

	it('DEFICIENCY: the engine emits none of these 12 §26 event types (28 -> 23 -> 16 -> 14 -> 13 -> 12 as the loops were wired)', () => {
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
		//   AssuranceAssessmentRequested — RESOLVED 2026-08-04 (REG-F-021 increment 3) and REMOVED from this list.
		//     It read "requestAssuranceAssessment emits AssuranceAssessmentStarted (it fuses request-and-begin;
		//     DOC-004 §32's separate `beginAssuranceAssessment` does not exist here)". Both halves are now false:
		//     the request emits AssuranceAssessmentRequested + AssuranceEvidenceRequired and lands the assessment in
		//     EVIDENCE_PENDING or READY, and `beginAssuranceAssessment` exists and is what emits Started. So this
		//     was never "modeling drift the vocab must resolve" — it was a lifecycle the engine skipped, and 14 -> 13
		//     is that being built rather than re-described.
		//   AssuranceAssessmentSatisfied / ...ConditionallySatisfied — completeAssuranceAssessment emits ONE
		//     AssuranceAssessmentCompleted carrying the disposition, per DOC-007; DOC-002 names five outcome
		//     events. The vocab's conflicts[] records the choice and says "pick one modeling" — it is unpicked.
		expect(missing).toEqual([
			'AssuranceAssessmentConditionallySatisfied',
			'AssuranceAssessmentSatisfied',
			'ClarificationRequested',
			'ExecutionPlanRevised',
			'IntentConstraintRefined',
			'PwuChallenged',
			'PwuSatisfied',
			'RecompositionCompleted',
			'RecompositionStarted',
			'RuntimeBindingAuthorized',
			'RuntimeBindingRequested',
			'TacticalChangeRequested'
		]);
	});

	it('PROGRESS: 14 of the 17 chain-of-custody links now fire — claim to evidence to assessment to decision to baseline', () => {
		const actual = new Set(driveLive());
		const emitted = ASSURANCE_CHAIN.filter((n) => actual.has(n));
		// Was []. Every assurance fact in the terminal graph used to be asserted; a claim is now asserted,
		// evidence proposed and ADMITTED, an assessment started against a real policy at a real subject version,
		// observations recorded, and a full §20 verdict returned (as AssuranceAssessmentCompleted, which is not
		// in this list because the list uses the §26 trace's five-outcome-event spelling — see the pin above).
		//
		// This must only ever GROW. THE GOVERNANCE HALF IS NO LONGER ABSENT. This read "no decision proposes or
		// takes effect, no baseline is created or promoted, and no assumption is ever detected", and the pin below
		// now carries AssumptionDetected, DecisionProposed, DecisionEffective, BaselineCreated,
		// BaselineSubmittedForReview, BaselineApproved and BaselinePromoted. The RPH-BAS-004 conclusion drawn from
		// it — the Architecture PWU reaching BASELINED with no Baseline object — is WITHDRAWN with it.
		//
		// STILL ABSENT, derived by subtracting the pin below from ASSURANCE_CHAIN rather than remembered: exactly
		// three — AssuranceAssessmentSatisfied and AssuranceAssessmentConditionallySatisfied (the unpicked
		// five-outcome-event vocab, see the pin above) and PwuSatisfied (the named-vs-generic question of the pin
		// below).
		// GREW 2026-08-04 (REG-F-021 increment 3): AssuranceAssessmentRequested now fires. The §26 trace expects it
		// at seq 31 and the engine had never once produced it — partly because it was UNWIRED and partly because its
		// authored payload REQUIRED `evaluator` and `disposition`, neither knowable at request time, so no conformant
		// emitter was possible until that shape was corrected.
		expect(emitted, 'this list must only grow — update the pin when it does').toEqual([
			'AssumptionDetected',
			'ClaimAsserted',
			'EvidenceProposed',
			'EvidenceAdmitted',
			'AssuranceAssessmentRequested',
			'AssuranceAssessmentStarted',
			'AssuranceObservationRecorded',
			'DecisionProposed',
			'DecisionEffective',
			'BaselineCreated',
			'BaselineSubmittedForReview',
			'BaselineApproved',
			'BaselinePromoted',
			'PwuBaselined'
		]);
	});

	it('DEFICIENCY: 66 generic PwuStateChanged still carry the axes the trace expects zero of', () => {
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
		expect(generic).toBe(66);
	});

	it("CHARACTERIZATION: the engine emits 260 events to the trace's 72, and is still not a superset", () => {
		const actual = driveLive();
		// 110 -> 153 -> 166 -> 251 -> 254 -> 257 -> 260. The count was never the point — at 110 it was inflated by
		// the generic setter while 28 named types were missing. Volume is not coverage; the pins above are. The jump
		// to 251 is mostly the de minimis FLOOR: three assessments over every AI-produced result, which is what the
		// workbench is for; +3 to 254 is Increment I5 creating the three floor policies the standalone drive had
		// only cited. +3 to 257 (REG-F-019, 2026-08-04) is the three ARCHITECTURE OBLIGATIONS the drive now
		// asserts and allocates — without them RPH-FIX-004 quantifies over an empty set and certifies a ratified
		// rule on the strength of there being nothing to certify. +3 to 260 is the corpus §25 constraint chain
		// (RPH-FIX-005): the Multi-Tenancy Constraint, the Tenant Isolation Model artifact, and the claim asserted
		// over it — and recording that FIRST EVER artifact is what exposed REG-F-020.
		// An assurance system's event log SHOULD be dominated by assurance.
		// +64 to 324 (REG-F-021 increment 3): every assessment now records the arrows it actually crosses instead of
		// one fused Started — AssuranceAssessmentRequested + AssuranceEvidenceRequired at the request, and
		// AssuranceAssessmentStarted at the begin. Three governed facts where there was one, across every assessment
		// the drive records. The count rising is the lifecycle being run, not noise.
		// +8 to 332 (REG-F-021 increment 4): the canonical drive now SELECTS its evaluator. That is the one place
		// this restoration buys a governance guarantee rather than ordering fidelity — WHO assessed becomes a
		// committed act with its own event, instead of arriving inside the verdict as
		// `validatorResult.executionProvenance.evaluator`, a field of the answer the assessor produced.
		expect(actual).toHaveLength(332);
	});
});
