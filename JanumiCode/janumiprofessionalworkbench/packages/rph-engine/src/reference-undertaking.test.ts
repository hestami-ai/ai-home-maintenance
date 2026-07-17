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
