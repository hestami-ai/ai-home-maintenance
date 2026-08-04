// RPH-FIX-004 over the ENGINE-DRIVEN graph (REG-F-019, 2026-08-04).
//
// The rule is "all architecture obligations in the fixture are allocated to child PWUs". It quantifies over
// OBJECTS, and the §26 fixture is an event trace of five fields carrying no obligations — so it is asserted here,
// against the graph `driveReferenceUndertaking` builds through the real command pipeline.
//
// THE INTERESTING PART IS THE VACUITY, and it is why the drive was changed before the check was written. Every
// PWU was proposed with `obligationIds: []` and every decomposition with no `obligationAllocations`. A
// universally quantified check would have ranged over an EMPTY set and passed — certifying a ratified rule on the
// strength of there being nothing to certify. The drive now authors three MANDATORY architecture obligations
// (corpus §25 Test 3's three traceability targets) and allocates them, and `runGraphConformance` treats an empty
// population as a FAILURE with the word VACUOUS in its detail.
import { describe, expect, it } from 'vitest';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { createEngine } from './engine.js';
import { driveReferenceUndertaking, REFERENCE_UNDERTAKING } from './reference-undertaking.js';
import { runGraphConformance, type GraphSource } from './graph-conformance.js';

function drivenStore(): { store: SqliteStorageAdapter; source: GraphSource } {
	const store = new SqliteStorageAdapter({ now: () => '2026-07-12T00:00:00Z' });
	const engine = createEngine({
		store,
		ontology,
		now: () => '2026-07-12T00:00:00Z',
		newEventId: (() => {
			let s = 0;
			return () => `evt_${++s}`;
		})()
	});
	driveReferenceUndertaking(engine);
	return { store, source: store };
}

const SUBJECTS = { architecturePwuId: REFERENCE_UNDERTAKING.architecture };

describe('RPH-FIX-004 — architecture decomposition coverage, over the driven graph', () => {
	it('every MANDATORY architecture obligation is allocated to a child PWU', () => {
		const { store, source } = drivenStore();
		const report = runGraphConformance(source, SUBJECTS);
		const check = report.checks.find((c) => c.id === 'RPH-FIX-004');
		expect(check, 'the check must exist to be evidence').toBeDefined();
		expect(check?.ok, check?.detail).toBe(true);
		store.close();
	});

	// NON-VACUITY, asserted as its own test rather than trusted. Without this the test above passes on an empty
	// world, which is exactly what it did before the drive authored obligations.
	it('the population is NON-EMPTY — three obligations, allocated to three distinct children', () => {
		const { store, source } = drivenStore();
		const detail = runGraphConformance(source, SUBJECTS).checks.find(
			(c) => c.id === 'RPH-FIX-004'
		)?.detail;
		expect(detail).not.toContain('VACUOUS');
		expect(detail).toContain('3 architecture obligations');
		expect(detail).toContain('unallocated: none');
		store.close();
	});

	// CONTROL for the vacuity guard itself, and it needs its own arrangement: an EMPTY graph must FAIL, not pass.
	// A check whose only test is a passing world cannot distinguish "all allocated" from "none to allocate".
	it('CONTROL: an empty graph FAILS as VACUOUS rather than passing', () => {
		const empty: GraphSource = { readAllEvents: () => [], loadObject: () => undefined };
		const check = runGraphConformance(empty, SUBJECTS).checks.find((c) => c.id === 'RPH-FIX-004');
		expect(check?.ok).toBe(false);
		expect(check?.detail).toContain('VACUOUS');
	});

	// CONTROL: allocation to something that is not a child of THIS decomposition is not allocation. Without this,
	// `allocatedTo: ['anything']` would satisfy the rule and the word "child" would carry no weight.
	it('CONTROL: an obligation allocated to a NON-child is reported unallocated', () => {
		const OBL = 'obl_X';
		const source: GraphSource = {
			readAllEvents: () =>
				[
					{ aggregateType: 'OBLIGATION', aggregateId: OBL },
					{ aggregateType: 'DECOMPOSITION_CONTRACT', aggregateId: 'dcp_X' }
				] as never,
			loadObject: (id: string) =>
				id === OBL
					? {
							objectType: 'OBLIGATION',
							revision: 0,
							semanticVersion: 1,
							state: {
								sourceObjectId: SUBJECTS.architecturePwuId,
								strength: 'MANDATORY',
								statement: 's'
							}
						}
					: {
							objectType: 'DECOMPOSITION_CONTRACT',
							revision: 0,
							semanticVersion: 1,
							state: {
								parentWorkUnitId: SUBJECTS.architecturePwuId,
								childWorkUnitIds: ['pwu_child'],
								obligationAllocations: [{ obligationId: OBL, allocatedTo: ['pwu_STRANGER'] }]
							}
						}
		};
		const check = runGraphConformance(source, SUBJECTS).checks.find((c) => c.id === 'RPH-FIX-004');
		expect(check?.ok, check?.detail).toBe(false);
		expect(check?.detail).toContain(OBL);
	});

	// CONTROL: a parent may RETAIN an obligation instead of allocating it — DOC-003 §6 DEC-3's conservation
	// equation says "allocated + retained + already satisfied", so a bare "all allocated" reading would wrongly
	// refuse a legitimate decomposition.
	it('CONTROL: a RETAINED obligation is not counted unallocated', () => {
		const OBL = 'obl_Y';
		const source: GraphSource = {
			readAllEvents: () =>
				[
					{ aggregateType: 'OBLIGATION', aggregateId: OBL },
					{ aggregateType: 'DECOMPOSITION_CONTRACT', aggregateId: 'dcp_Y' }
				] as never,
			loadObject: (id: string) =>
				id === OBL
					? {
							objectType: 'OBLIGATION',
							revision: 0,
							semanticVersion: 1,
							state: {
								sourceObjectId: SUBJECTS.architecturePwuId,
								strength: 'MANDATORY',
								statement: 's'
							}
						}
					: {
							objectType: 'DECOMPOSITION_CONTRACT',
							revision: 0,
							semanticVersion: 1,
							state: {
								parentWorkUnitId: SUBJECTS.architecturePwuId,
								childWorkUnitIds: ['pwu_child'],
								retainedParentObligationIds: [OBL]
							}
						}
		};
		const check = runGraphConformance(source, SUBJECTS).checks.find((c) => c.id === 'RPH-FIX-004');
		expect(check?.ok, check?.detail).toBe(true);
	});
});
