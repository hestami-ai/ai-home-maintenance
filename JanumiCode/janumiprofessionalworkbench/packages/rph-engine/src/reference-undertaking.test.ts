// Proves the Reference Undertaking is driven LIVE (command → event → projection), not replayed from a hand-
// authored event log, and that the resulting Professional Work Graph upholds INV-5: the assured concerns are
// qualified-green (SATISFIED), while Mobile & Offline is CONDITIONALLY_SATISFIED and therefore NOT qualified —
// "no green without assurance". The Architecture PWU is frozen into a baseline.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import {
	createEngine,
	driveReferenceUndertaking,
	professionalWorkGraph,
	REFERENCE_OPEN_RESIDUALS,
	REFERENCE_UNDERTAKING
} from './index.js';

describe('Reference Undertaking driven live', () => {
	function build() {
		const engine = createEngine({
			ontology,
			now: () => '2026-07-12T00:00:00Z',
			newEventId: (() => {
				let s = 0;
				return () => `evt_${++s}`;
			})()
		});
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
	// claimed the ratified property RPH-PER-006 (aggregate-replay-equivalence) was covered when nothing covers it.
	// A real one drops the state tables, replays domain_events from seq 0, and asserts the rebuilt graph equals
	// this one. Nothing in the repo does that today.
	it('the projection is deterministic (NOT rebuild equivalence — see comment; RPH-PER-006 is untested)', () => {
		const { engine, graph } = build();
		const again = professionalWorkGraph(engine, { openResiduals: REFERENCE_OPEN_RESIDUALS });
		expect(again).toEqual(graph);
	});
});
