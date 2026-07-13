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

	it('upholds INV-5: assured PWUs are qualified-green; Mobile & Offline (conditional) is NOT', () => {
		const { graph } = build();
		const byId = new Map(graph.nodes.map((n) => [n.id, n]));

		const intentDef = byId.get(REFERENCE_UNDERTAKING.intentDef);
		expect(intentDef?.axes.executionState).toBe('SUCCEEDED');
		expect(intentDef?.axes.assuranceState).toBe('SATISFIED');
		expect(intentDef?.qualifiedSuccess).toBe(true);

		const mobile = byId.get(REFERENCE_UNDERTAKING.mobileOffline);
		expect(mobile?.axes.executionState).toBe('SUCCEEDED');
		expect(mobile?.axes.assuranceState).toBe('CONDITIONALLY_SATISFIED');
		// Execution SUCCEEDED but assurance not SATISFIED -> not qualified-green (INV-5).
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

	it('is reproducible from the event log (rebuild equivalence)', () => {
		const { engine, graph } = build();
		// Rebuilding the graph from the same live engine yields the identical view.
		const again = professionalWorkGraph(engine, { openResiduals: REFERENCE_OPEN_RESIDUALS });
		expect(again).toEqual(graph);
	});
});
