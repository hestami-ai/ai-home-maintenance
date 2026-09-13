// Proves the Reference Undertaking is driven LIVE (command → event → projection), not replayed from a hand-
// authored event log, and that the resulting Professional Work Graph upholds INV-5: the assured concerns are
// qualified-green (SATISFIED), while Mobile & Offline is CONDITIONALLY_SATISFIED and therefore NOT qualified —
// "no green without assurance". The Architecture PWU is frozen into a baseline.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { describe, expect, it } from 'vitest';
import {
	createEngine,
	driveReferenceUndertaking,
	professionalWorkGraph,
	REFERENCE_OPEN_RESIDUALS,
	REFERENCE_UNDERTAKING
} from './index.js';

// ── THE SESSION THE DRIVE MUST RUN IN, AND WHY IT IS NOT THE SHARED CREDENTIAL ────────────────────────────────
// `driveReferenceUndertaking` AUTHORS ITS ACTING PARTY into the payloads it sends: `producedBy` on every piece
// of evidence, `producer` on every completed assessment, `introducedBy` on the residual, and — load-bearing —
// `authority` on the two `ProposeDecision` commands that baseline the Intent and the Architecture. REG-F-014
// requires that declared authority to EQUAL the issuing actor, and the engine now stamps the issuer from the
// authenticated session. So the session's principal must BE that party: `owner-1`, the Undertaking Owner.
// Under any other principal the drive is refused at ProposeDecision with RPH_AUTHORITY_INSUFFICIENT and its
// fail-loud `send` throws.
//
// THIS IS ALSO WHAT KEEPS THE INDEPENDENCE TEST BELOW HONEST. `Increment I1` asserts producer ≠ evaluator over
// `owner-1` vs `evaluator-1`/`reviewer-agent-1`. Dispatching as some third identity would leave that assertion
// true while the acting party had quietly become someone the fixture never names.
//
// ⚠ The literal is duplicated from `reference-undertaking.ts`'s module-private ACTOR, which is not exported.
// `executionInstanceId` is carried for the same reason it exists there: with it, the stamped `issuedBy` is the
// exact value the envelope carried before the trust boundary landed, so nothing downstream of the gate moves.
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

describe('Reference Undertaking driven live', () => {
	function build() {
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
		return {
			engine,
			graph: professionalWorkGraph(engine, { openResiduals: REFERENCE_OPEN_RESIDUALS })
		};
	}

	it('produces the full 13-node Professional Work Graph with the decomposition edges', () => {
		const { graph } = build();
		expect(graph.nodes).toHaveLength(13);
		expect(graph.edges).toHaveLength(12); // root -> 7 areas, architecture -> 5 concerns
		const byId = new Map(graph.nodes.map((n) => [n.id, n]));
		expect(byId.get(REFERENCE_UNDERTAKING.root)?.label).toBe('Product Realization');
		expect(byId.get(REFERENCE_UNDERTAKING.mobileOffline)?.label).toBe(
			'Mobile & Offline Architecture'
		);
	});

	// RENAMED 2026-07-17. This was titled "upholds INV-5: assured PWUs are qualified-green; Mobile & Offline
	// (conditional) is NOT". Two faults. (1) It overstated: nothing in this fixture is ASSURED — the seed assigns
	// assuranceState via ChangePwuState with no assessment, evidence, or claim (see reference-undertaking.ts's
	// header). A PWU whose assuranceState was ASSIGNED CONDITIONALLY_SATISFIED being reported not-qualified shows
	// only that the projection reads the field it was handed. (2) "INV-5" is not a ratified identifier — it
	// appears ZERO times in the corpus, which carries no numbered invariant ids at all. The ratified name is
	// "Property P1 — Execution never implies assurance".
	//
	// What it DOES prove is worth keeping: qualifiedSuccess is a function of BOTH axes, so execution success alone
	// never reads as green — the projection half, and it is real. The ENFORCEMENT half is proved end-to-end
	// against the guard in rph-application's pwu.test.ts ("Property P1 (call site)"), added the same day, because
	// nothing proved it before: the test that claimed to exercised an illegal arrow, which fails for a different
	// reason and stays green with the guard deleted.
	it('projection half of Property P1: qualifiedSuccess needs BOTH axes — execution success alone is never green', () => {
		const { graph } = build();
		const byId = new Map(graph.nodes.map((n) => [n.id, n]));

		const intentDef = byId.get(REFERENCE_UNDERTAKING.intentDef);
		expect(intentDef?.axes.executionState).toBe('SUCCEEDED');
		expect(intentDef?.axes.assuranceState).toBe('SATISFIED');
		expect(intentDef?.qualifiedSuccess).toBe(true);

		const mobile = byId.get(REFERENCE_UNDERTAKING.mobileOffline);
		// Same executionState as the node above; only the assurance axis differs — which is the whole point.
		expect(mobile?.axes.executionState).toBe('SUCCEEDED');
		expect(mobile?.axes.assuranceState).toBe('CONDITIONALLY_SATISFIED');
		expect(mobile?.qualifiedSuccess).toBe(false);
	});

	// THE POINT OF INCREMENT 25. Above, the graph's axes are asserted; here, that they were EARNED. Without this
	// the seed could go back to assigning assuranceState and every other test in this file would stay green —
	// which is exactly what happened for the whole life of the file before it.
	//
	// Ratified RPH-PWU-006: "Given execution succeeded; required evidence is admitted; all mandatory assurance
	// assessments are satisfied. When the controller evaluates the PWU. Then the PWU may transition to SATISFIED."
	// This test asserts the GIVEN exists for the PWU the graph reports as assured, and that the controller's hop
	// CITES it. The engine does not yet enforce the Given (classifyTransition ignores declared triggers/guards),
	// so this test is the only thing standing between the demo and a fabricated verdict.
	it("Increment 25: an assured PWU's assurance is EARNED and CITED, not assigned", () => {
		const { engine } = build();
		const events = engine.readAllEvents();
		const subject = REFERENCE_UNDERTAKING.mobileOffline;

		// 1. A claim was asserted ABOUT this PWU.
		const claim = events.find(
			(e) =>
				e.eventType === 'ClaimAsserted' &&
				(e.payload as { subjectObjectIds?: string[] }).subjectObjectIds?.includes(subject)
		);
		expect(claim, 'no claim was asserted about the subject').toBeDefined();

		// 2. Evidence was ADMITTED (not merely proposed) for that claim — the ratified trigger for the assurance
		//    axis leaving EVIDENCE_REQUIRED.
		const admitted = events.find(
			(e) =>
				e.eventType === 'EvidenceAdmitted' &&
				(e.payload as { admittedClaimIds?: string[] }).admittedClaimIds?.includes(
					claim!.aggregateId
				)
		);
		expect(admitted, 'no evidence was admitted for the claim').toBeDefined();

		// 3. An assessment ran against a policy that EXISTS, bound to the subject's semantic version.
		const started = events.find(
			(e) =>
				e.eventType === 'AssuranceAssessmentStarted' &&
				(e.payload as { subjectObjectIds?: string[] }).subjectObjectIds?.includes(subject)
		);
		expect(started, 'no assessment was started for the subject').toBeDefined();
		const policyId = (started!.payload as { assurancePolicyId?: string }).assurancePolicyId;
		expect(
			engine.loadObject(policyId!),
			'the assessment cites a policy that does not exist — a governance fact pointing at nothing'
		).toBeDefined();
		expect(
			(started!.payload as { subjectSemanticVersions?: Record<string, number> })
				.subjectSemanticVersions?.[subject],
			'DOC-004 invariant 2: the assessment must name its subject semantic version'
		).toBe(1);

		// 4. A verdict was returned, and it considered the admitted evidence.
		const completed = events.find(
			(e) =>
				e.eventType === 'AssuranceAssessmentCompleted' && e.aggregateId === started!.aggregateId
		);
		expect(completed, 'the assessment never completed').toBeDefined();
		const verdict = completed!.payload as {
			disposition?: string;
			evidenceConsideredIds?: string[];
		};
		expect(verdict.disposition).toBe('CONDITIONALLY_SATISFIED');
		expect(
			verdict.evidenceConsideredIds,
			'the verdict must name the evidence it considered (§18.1)'
		).toContain(admitted!.aggregateId);

		// 5. THE HOP CITES THE ASSESSMENT. This is the field that was [] on all 67 previous hops: the controller
		//    now records what its decision rests on, so the governed stream says WHY the state moved.
		const hop = events.find(
			(e) =>
				e.eventType === 'PwuStateChanged' &&
				e.aggregateId === subject &&
				(e.payload as { newState?: string }).newState === 'CONDITIONALLY_SATISFIED'
		);
		expect(hop, 'the subject never reached CONDITIONALLY_SATISFIED').toBeDefined();
		expect(
			(hop!.payload as { supportingObjectIds?: string[] }).supportingObjectIds,
			'the controller hop must cite the assessment that permits it (RPH-PWU-006 / DOC-007 §11.5)'
		).toEqual([started!.aggregateId]);
	});

	// ── JAN-PFA S3.3 — THE PINNED POLICY VERSION: WHAT THIS CLOSES, AND WHY NOTHING CLOSED IT ────────────
	// It closes the surviving mutant on `beginAssuranceAssessment` (rph-application/src/handlers/assurance.ts):
	//     policyVersion: next.policyVersion   ->   policyVersion: String(next.semanticVersion as Stringifiable)
	// one of forty authored against that layer, ALL FORTY of which SURVIVED. This one survived because not one
	// test in the repo read this field's VALUE — step 3 of the Increment 25 block above reads `assurancePolicyId`
	// off this very payload and stops there.
	//
	// THE PROMISE. `AssuranceAssessmentStarted` names the POLICY VERSION the assessment is judged under — DOC-004
	// §18's pin ("assessments pin policySemanticVersion") — so a reader of the governed stream can say WHICH
	// edition of the policy produced the verdict. That pin is recorded TWICE, independently: onto the assessment
	// object at the REQUEST, and onto this event at the START. This test joins the two, which is why it is not a
	// restatement of the handler's own expression: a start that reports a version other than the one its own
	// aggregate committed leaves two governed records of a single fact disagreeing, and §18's pin unreadable.
	//
	// WHY THE MUTANT IS INVISIBLE TO EVERYTHING ELSE. It substitutes the ASSESSMENT's OWN envelope
	// `semanticVersion`: adjacent, always present, and stringifying to a schema-valid `z.string()`. So the (d2)
	// event gate, replay-conformance's event-TYPE compare and every existing assessment assertion stay green
	// while the event reports a policy version the policy never had. assessment-ready-arrow.test.ts could not
	// catch it at ANY strength: its fixture pins policyVersion '1', which is ALSO the assessment's
	// semanticVersion, so there the true value and the substitute COINCIDE.
	//
	// TWO CONTROLS, because every gap in this inventory sits where something was proved to HAPPEN and never
	// proved PRECISE — and an assertion with no control repeats exactly that mistake:
	//   (C1) THE POPULATION IS PLURAL AND NON-EMPTY. A per-event join over zero events passes while measuring
	//        nothing, which is the one way the assertion below could look like coverage without being exercised.
	//   (C2) THE SUBSTITUTE IS A REAL, SAME-SHAPED, DISTINCT VALUE. The control asserts the field the mutant
	//        reaches for is actually PRESENT and a number (so the mutant emits plausible output, not a blank
	//        anything would catch) AND that its stringification DIFFERS from the pin. If (C2) ever reddens, the
	//        fixture has drifted into assessment-ready-arrow's coincidence and the join has silently stopped
	//        discriminating — an instrument failure, which must not be read as a defect in the handler.
	// The join runs over EVERY assessment the canonical drive begins, so the legitimate case is ADMITTED right
	// across the population and an assertion satisfied by one lucky payload cannot pass.
	it('JAN-PFA S3.3: the started event pins the POLICY version, not the envelope version', () => {
		const { engine } = build();
		const startedEvents = engine
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceAssessmentStarted');

		// (C1) CONTROL.
		expect(
			startedEvents.length,
			'no assessment was begun, so the per-event join below would pass over an empty population'
		).toBeGreaterThan(10);

		for (const e of startedEvents) {
			const state = engine.loadObject(e.aggregateId)?.state as
				{ policyVersion?: unknown; semanticVersion?: unknown } | undefined;
			const pinned = state?.policyVersion;

			// (C2) CONTROL, first half: the substitute exists and is the same-shaped number the mutant relies on.
			expect(
				typeof state?.semanticVersion,
				`${e.aggregateId}: the envelope version is absent, so the substitute is not a plausible value`
			).toBe('number');
			const substitute = String(state?.semanticVersion);

			// (C2) CONTROL, second half: the two candidate values are DISTINCT, so the join can discriminate.
			expect(typeof pinned, `${e.aggregateId}: the assessment committed no policy version`).toBe(
				'string'
			);
			expect(
				pinned,
				`${e.aggregateId}: pin and envelope version coincide — this test no longer discriminates`
			).not.toBe(substitute);

			// THE KILL: the event reports the POLICY edition this assessment pinned, not its own envelope version.
			expect(
				(e.payload as { policyVersion?: unknown }).policyVersion,
				`${e.aggregateId}: the start reports a policy version its own aggregate never pinned`
			).toBe(pinned);
		}

		// AND A THIRD, INDEPENDENT RECORD of the same pin: reference-undertaking.ts supplies '1.0.0' at every
		// request. The join above compares two fields a single edit could in principle make agree on the wrong
		// value; this states the pinned edition outright, for the subject the Increment 25 block names.
		const subject = REFERENCE_UNDERTAKING.mobileOffline;
		const forSubject = startedEvents.find((e) =>
			(e.payload as { subjectObjectIds?: string[] }).subjectObjectIds?.includes(subject)
		);
		expect(forSubject, 'no assessment was started for the subject').toBeDefined();
		expect(
			(forSubject!.payload as { policyVersion?: unknown }).policyVersion,
			"the subject's assessment is judged under policy edition 1.0.0, the version the request pinned"
		).toBe('1.0.0');
	});

	it('freezes the Architecture PWU into an authoritative baseline', () => {
		const { graph } = build();
		const arch = graph.nodes.find((n) => n.id === REFERENCE_UNDERTAKING.architecture);
		expect(arch?.axes.workLifecycleState).toBe('BASELINED');
		expect(arch?.baselined).toBe(true);
	});

	it('surfaces the open offline residual and keeps the root in progress', () => {
		const { graph } = build();
		expect(graph.openResiduals).toContain(REFERENCE_OPEN_RESIDUALS[0]);
		const root = graph.nodes.find((n) => n.id === REFERENCE_UNDERTAKING.root);
		expect(root?.axes.workLifecycleState).toBe('EXECUTING');
		expect(root?.qualifiedSuccess).toBe(false);
	});

	// RENAMED 2026-07-17. This was titled "is reproducible from the event log (rebuild equivalence)". It does not
	// touch the event log: it calls the projection twice against the SAME live engine. That is determinism, which
	// is worth having and is what the test actually checks — but it is not rebuild equivalence, and the old title
	// claimed the ratified property RPH-PER-006 (aggregate-replay-equivalence) was covered when nothing did.
	//
	// RPH-PER-006 IS NOW COVERED, in replay-equivalence.test.ts: every PWU's four axes are folded back out of its
	// own event stream and compared to the materialized state (52/52). This test keeps its narrower, honest job.
	it('the projection is deterministic (NOT rebuild equivalence — that is replay-equivalence.test.ts)', () => {
		const { engine, graph } = build();
		const again = professionalWorkGraph(engine, { openResiduals: REFERENCE_OPEN_RESIDUALS });
		expect(again).toEqual(graph);
	});

	// INCREMENT I1 — the prerequisite for enforcing independence (DOC-004 §39 invariant 8, §8.4). An assurance
	// assessment records WHO evaluated it; evidence records WHO produced the work. Independence is only real if
	// those are DIFFERENT parties. Until now the seed stamped `owner-1` as both, so a real DIFFERENT_AGENT /
	// evaluator≠producer check would have had to reject the canonical drive or be defeated to pass. This test locks
	// the two identities apart, over the live store, so the later enforcement increment has honest operands to check.
	it('Increment I1: the assurance evaluator is a DISTINCT identity from the work producer', () => {
		const { engine } = build();
		const events = engine.readAllEvents();
		const stateOf = (id: string) =>
			engine.loadObject(id)?.state as Record<string, unknown> | undefined;
		const actorId = (v: unknown): string | undefined =>
			(v as { actorId?: string } | undefined)?.actorId;

		// Every completed assessment's recorded evaluator is an INDEPENDENT reviewer — the human reviewer, or the
		// distinct MODEL reviewer for the Reasoning Review floor (Increment I5, DIFFERENT_MODEL) — and never the owner.
		const assessmentIds = [
			...new Set(
				events
					.filter((e) => e.eventType === 'AssuranceAssessmentCompleted')
					.map((e) => e.aggregateId)
			)
		];
		const evaluatorIds = assessmentIds
			.map((id) => actorId(stateOf(id)?.evaluator))
			.filter((x): x is string => x !== undefined);
		expect(evaluatorIds.length).toBeGreaterThan(10);
		expect(evaluatorIds.every((id) => id === 'evaluator-1' || id === 'reviewer-agent-1')).toBe(
			true
		);

		// Every piece of evidence was produced by the owner (the work producer).
		const evidenceIds = [
			...new Set(events.filter((e) => e.eventType === 'EvidenceProposed').map((e) => e.aggregateId))
		];
		const producerIds = evidenceIds
			.map((id) => actorId(stateOf(id)?.producedBy))
			.filter((x): x is string => x !== undefined);
		expect(producerIds.length).toBeGreaterThan(0);
		expect(producerIds.every((id) => id === 'owner-1')).toBe(true);

		// THE LOAD-BEARING ASSERTION: no assessment is evaluated by the identity that produced the work.
		const producers = new Set(producerIds);
		expect(evaluatorIds.every((id) => !producers.has(id))).toBe(true);
	});
});
