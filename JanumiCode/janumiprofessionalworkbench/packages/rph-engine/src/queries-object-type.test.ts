// `getObjectOfType` — the typed by-id read (REG-F-199 residue 1), pinned at the seam.
//
// ⚠ THIS SUITE IS DELIBERATELY NOT A DECLARED MUTANT'S VICTIM, and the reason is the point. Before the
// fix its "red" would have been a SYMBOL-ABSENCE failure — the export did not exist, so the file would
// not compile — which is a weaker claim than a behavioural one and would have made any mutant scored
// against it report NO_COMPILE rather than KILLED. The behavioural red that carries the finding lives
// in apps/rph-demo/src/lib/server/undertaking-loader-object-type.test.ts, where a wrong-typed id was
// measured RENDERING a PWA's name as an Undertaking's. This file exists to pin the seam's own three
// cases so a later edit cannot quietly widen it.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { describe, expect, it } from 'vitest';
import { createEngine, getObject, getObjectOfType, seedWorkbench, SEED_PWA } from './index.js';

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

describe('getObjectOfType asserts the discriminator the write side already maintains', () => {
	function seeded() {
		let s = 0;
		const handle = createEngine({
			authenticate: DIR.authenticate,
			ontology,
			now: () => '2026-07-12T00:00:00Z',
			newEventId: () => `e${++s}`
		}).as(OWNER);
		seedWorkbench(handle);
		return handle;
	}

	it('returns undefined when the id names an object of a DIFFERENT type', () => {
		expect(getObjectOfType(seeded(), 'UNDERTAKING', SEED_PWA)).toBeUndefined();
	});

	it('returns the state bag when the id names an object of THAT type', () => {
		const state = getObjectOfType(seeded(), 'PROFESSIONAL_WORK_ARCHITECTURE', SEED_PWA);
		expect(state?.objectType).toBe('PROFESSIONAL_WORK_ARCHITECTURE');
	});

	it('returns undefined for an id that names nothing', () => {
		expect(
			getObjectOfType(seeded(), 'UNDERTAKING', 'und_01ARZ3NDEKTSV4RRFFQ69NOPE00')
		).toBeUndefined();
	});

	it('CONTROL: the type-blind getObject still returns that same object, so the discrimination is the NEW behaviour', () => {
		// Without this the suite above could pass because the id is wrong rather than because the type
		// check fires — a true statement about an arrangement that never happened.
		expect(getObject(seeded(), SEED_PWA)?.objectType).toBe('PROFESSIONAL_WORK_ARCHITECTURE');
	});
});
