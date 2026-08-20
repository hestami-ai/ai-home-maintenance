// REG-F-199 residue (2), half A — the Professional Work Graph must read an observation's CURRENT
// disposition, not the one frozen into the event that recorded it.
//
// THE DEFECT. `professionalWorkGraph` decided "is this finding still open?" by testing
// `event.payload.disposition` on `AssuranceObservationRecorded`. That value is a hard-coded `'OPEN'`
// literal at the emitter (handlers/assurance.ts), so the test was a TAUTOLOGY over its own input: a
// finding later WAIVED or REMEDIATED would go on suppressing a green node forever (DOC-004 §38 limb
// 2). Every GATE already does this correctly by loading current state and says why in terms
// (handlers/assurance.ts:2076-2077, "so a resolved or WAIVED finding no longer counts").
//
// ⚠ WHY THIS TEST DECORATES A HANDLE INSTEAD OF DRIVING A COMMAND. `RecordAssuranceObservation` is
// the ONLY observation command and NOTHING transitions `disposition`, so at runtime today every
// observation IS open and the defect is UNOBSERVABLE end to end. A probe or an e2e would clear it
// wrongly. The honest red is therefore constructed at the seam where the decision is made: a real
// seeded workspace, with `loadObject` decorated to answer WAIVED for the one observation — exactly
// the state the system will hold the day a waiver command exists.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { describe, expect, it } from 'vitest';
import { createEngine, professionalWorkGraph, seedWorkbench } from './index.js';
import type { EngineHandle } from './engine.js';

const DIR = testDirectory([
	{
		actorId: 'owner-1',
		actorType: 'HUMAN',
		displayName: 'Owner',
		executionInstanceId: 'exec-production',
		tenantId: 'tenant-test',
		organizationId: 'org-test'
	}
]);
const OWNER = DIR.credentialFor('owner-1');

interface ObservationFacts {
	readonly observationId: string;
	readonly subjectId: string;
	readonly severity: string;
}

describe('the Professional Work Graph reads an observation CURRENT disposition', () => {
	function seeded(): { handle: EngineHandle; facts: ObservationFacts } {
		let s = 0;
		const handle = createEngine({
			authenticate: DIR.authenticate,
			ontology,
			now: () => '2026-07-12T00:00:00Z',
			newEventId: () => `e${++s}`
		}).as(OWNER);
		seedWorkbench(handle);
		// Ids are DERIVED from the log, never hard-coded: a fixture that names an id the seed stops
		// minting would go quietly vacuous instead of red.
		const recorded = handle
			.readAllEvents()
			.filter((e) => e.eventType === 'AssuranceObservationRecorded')
			.map(
				(e) =>
					e.payload as { observationId?: string; subjectObjectIds?: string[]; severity?: string }
			)
			.find((p) => (p.subjectObjectIds ?? []).length > 0 && p.severity !== undefined);
		expect(recorded, 'the seed no longer records any assurance observation').toBeDefined();
		return {
			handle,
			facts: {
				observationId: recorded!.observationId!,
				subjectId: recorded!.subjectObjectIds![0]!,
				severity: recorded!.severity!
			}
		};
	}

	/** The same handle, answering a chosen disposition for one observation id. */
	function withDisposition(
		handle: EngineHandle,
		observationId: string,
		disposition: string
	): EngineHandle {
		const loadObject: EngineHandle['loadObject'] = (id) => {
			const loaded = handle.loadObject(id);
			if (id !== observationId || !loaded) return loaded;
			return { ...loaded, state: { ...(loaded.state as object), disposition } };
		};
		return { ...handle, loadObject } as EngineHandle;
	}

	it('CONTROL: an OPEN observation is counted, so the filter is not simply emptying the map', () => {
		const { handle, facts } = seeded();
		const node = professionalWorkGraph(handle).nodes.find((n) => n.id === facts.subjectId);
		expect(node?.openObservationCounts).toEqual({ [facts.severity]: 1 });
	});

	it('a WAIVED observation is NOT counted (DOC-004 §38 limb 2)', () => {
		const { handle, facts } = seeded();
		const waived = withDisposition(handle, facts.observationId, 'WAIVED');
		const node = professionalWorkGraph(waived).nodes.find((n) => n.id === facts.subjectId);
		expect(
			node?.openObservationCounts,
			'a WAIVED finding must not go on suppressing a green node'
		).toEqual({});
	});

	it('an observation that cannot be loaded FAILS CLOSED — it still counts', () => {
		// ⚠ THIS DEFAULT DIVERGES FROM ALL THREE ASSURANCE GATES, deliberately, and the divergence is
		// recorded rather than smoothed: assurance.ts:2096, floor-gate.ts:255-257 and governance.ts all
		// DROP an observation they cannot load, i.e. they fail OPEN. This module cannot, because its
		// output is a GREEN NODE and a false green is the one thing it must never produce. The paired
		// read model work-projection.ts also fails open on the same fact, so the pair stays divergent in
		// polarity — recorded as REG-F-199 residue (2) half B, which is NOT fixable at that layer.
		const { handle, facts } = seeded();
		const missing: EngineHandle = {
			...handle,
			loadObject: (id) => (id === facts.observationId ? undefined : handle.loadObject(id))
		} as EngineHandle;
		const node = professionalWorkGraph(missing).nodes.find((n) => n.id === facts.subjectId);
		expect(node?.openObservationCounts).toEqual({ [facts.severity]: 1 });
	});
});
