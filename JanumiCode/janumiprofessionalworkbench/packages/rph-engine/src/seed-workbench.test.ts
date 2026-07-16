// Proves seedWorkbench stands up the full RPH-DOC-010 picture LIVE in one call: one PUBLISHED Product Realization
// PWA with its PWU Types, one Undertaking bound to it, and that Undertaking's 9-node Professional Work Graph —
// all via real commands. The query surface returns the read-model the UI renders.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import {
	createEngine,
	listByType,
	listPwas,
	listPwuTypes,
	listPwus,
	listUndertakings,
	professionalWorkGraph,
	seedWorkbench,
	SEED_PWA,
	SEED_UNDERTAKING
} from './index.js';

describe('seedWorkbench (live PWA + Undertaking + graph)', () => {
	function build() {
		let s = 0;
		const engine = createEngine({
			ontology,
			now: () => '2026-07-12T00:00:00Z',
			newEventId: () => `e${++s}`
		});
		seedWorkbench(engine);
		return engine;
	}

	it('publishes one Product Realization PWA with its PWU Types', () => {
		const engine = build();
		const pwas = listPwas(engine);
		expect(pwas).toHaveLength(1);
		expect(pwas[0]!.state.publicationStatus).toBe('PUBLISHED');
		expect(pwas[0]!.id).toBe(SEED_PWA);
		const types = listPwuTypes(engine, SEED_PWA);
		expect(types.length).toBeGreaterThanOrEqual(8);
		expect(types.filter((t) => t.state.isRoot)).toHaveLength(1);
	});

	it('instantiates one Undertaking bound to the published PWA and owns its PWUs (CON-009)', () => {
		const engine = build();
		const unds = listUndertakings(engine);
		expect(
			unds,
			`types=${[...new Set(engine.readAllEvents().map((e) => e.aggregateType))].join(',')}`
		).toHaveLength(1);
		expect(unds[0]!.state.pwaId).toBe(SEED_PWA);
		const pwus = listPwus(engine, SEED_UNDERTAKING);
		expect(pwus).toHaveLength(13);
		expect(pwus.every((p) => p.state.undertakingId === SEED_UNDERTAKING)).toBe(true);
	});

	it('seeds the policy library: 3 locked de minimis floor policies + ALL 12 catalog policies as ASSURANCE_POLICY objects', () => {
		const engine = build();
		const policies = listByType(engine, 'ASSURANCE_POLICY');
		// 3 floor (locked) + 12 additive = the full workbench policy library.
		//
		// This asserted 9 — 3 floor + SIX additive — because seeding read a hand-maintained copy of the catalog in
		// seed-workbench.ts while the ontology (and validateOntology, and the conformance profiles) read all 12.
		// So half of DOC-004's ratified catalog existed as ontology data and as NO object: not in the policy
		// manager, not in the picker, and not in what `list_assurance_policies` shows the authoring agent. The
		// agent is told to reuse an existing policy and to create one only for a treatment "not already offered" —
		// so the six invisible policies were an instruction to fabricate duplicates of ratified ones.
		expect(policies).toHaveLength(15);
		const ids = policies.map((p) => p.id).sort();
		expect(ids).toEqual([
			'floor.identity-provenance',
			'floor.reasoning-review',
			'floor.schema-invariant',
			'pol_architecture_coverage',
			'pol_assumption_disclosure',
			'pol_baseline_promotion',
			'pol_constraint_propagation',
			'pol_decomposition_coverage',
			'pol_fitness_for_purpose',
			'pol_historical_consistency',
			'pol_intent_completeness',
			'pol_intent_fidelity',
			'pol_intent_preservation',
			'pol_requirement_coverage',
			'pol_test_adequacy'
		]);
		const rr = policies.find((p) => p.id === 'floor.reasoning-review')!;
		expect(rr.state.status).toBe('ACTIVE');
		expect(rr.state.independenceRequirement).toBe('DIFFERENT_MODEL');
		expect(rr.state.criteria as unknown[]).toHaveLength(9);
		// Additive policies are also ACTIVE, versioned objects (engine-backed, not a static UI catalog).
		const intentPreservation = policies.find((p) => p.id === 'pol_intent_preservation')!;
		expect(intentPreservation.state.status).toBe('ACTIVE');
		expect(intentPreservation.state.version).toBe('1.0.0');
	});

	it('drives the Undertaking to a graph that upholds INV-5', () => {
		const engine = build();
		const graph = professionalWorkGraph(engine);
		expect(graph.nodes).toHaveLength(13);
		const mobile = graph.nodes.find((n) => n.label === 'Mobile & Offline Architecture');
		expect(mobile?.qualifiedSuccess).toBe(false);
		const arch = graph.nodes.find((n) => n.label === 'Architecture Definition');
		expect(arch?.baselined).toBe(true);
	});
});
