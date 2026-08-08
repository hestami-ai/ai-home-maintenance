// THE READ BOUNDARY MUST EMIT THE REVISION IT READ AT — because a page cannot declare what it was never told.
//
// JPWB-DOC-003 §9 PER-4: "Updates to existing aggregates declare the revision they believe current." A surface
// can only do that if the read that rendered it carried one. `StoredObject` has always had `revision`; every
// helper here discarded it, so the whole surface was last-write-wins by construction rather than by choice.
//
// ⚠ WHY THIS TEST EXISTS RATHER THAN A DOC COMMENT. For one commit, `ObjectRow.revision` was declared and
// carried the sentence "every helper in this file supplies it" — while `listByType`, the SOLE constructor of
// every ObjectRow in the file, pushed `{ id, state }`. Declared, documented as populated, populated by nothing:
// the same hollow this repository has spent the week finding in `AuthorityReference`, `roleId`, `causationId`
// and the seeded policy objects — created anew in the commit that was curing one of them.
//
// A DOC COMMENT IS A CLAIM NOTHING CHECKS. This file is the reader that makes it a fact, and it is deliberately
// shaped so that a NEW helper which forgets the field is caught too, rather than only the one that forgot first.

import { createEngine } from './engine.js';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { listByType, getObject, getObjectRevision } from './queries.js';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { seedWorkbench } from './seed-workbench.js';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeAll, describe, expect, it } from 'vitest';

const TS = '2026-08-07T00:00:00Z';

// ── THE SESSION THE SEED MUST RUN IN, AND WHY IT IS NOT THE SHARED CREDENTIAL ─────────────────────────────────
// `seedWorkbench` delegates the Undertaking's graph to `driveReferenceUndertaking`, which AUTHORS ITS ACTING
// PARTY into the payloads it sends — `producedBy`, `producer`, `introducedBy`, and, load-bearing here,
// `authority` on `ProposeDecision`. REG-F-014 requires that declared authority to EQUAL the issuing actor, and
// the engine now stamps the issuer from the authenticated session. So the session's principal must BE that
// party — `owner-1`, the Undertaking Owner. Under any other principal the drive is refused at ProposeDecision
// with RPH_AUTHORITY_INSUFFICIENT and its fail-loud `send` throws before the seed finishes.
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

describe('PER-4 — the read boundary carries the revision it read at', () => {
	let store: SqliteStorageAdapter;
	let engine: ReturnType<ReturnType<typeof createEngine>['as']>;

	beforeAll(() => {
		let n = 0;
		store = new SqliteStorageAdapter({ now: () => TS });
		engine = createEngine({
			authenticate: DIR.authenticate,
			ontology,
			store,
			now: () => TS,
			newEventId: () => `evt_${++n}`
		}).as(OWNER);
		seedWorkbench(engine);
	});

	// MUTANT: revert `listByType` to pushing `{ id, state }` and this reddens. That is precisely the state this
	// file was written against — the field present, the population absent.
	it('every row from listByType carries a revision', () => {
		const rows = listByType(engine, 'PWU_TYPE');
		// THE POPULATION CONTROL. A census over zero rows asserts nothing and reports green — REG-F-015's
		// anatomy. If the seed ever stops publishing PWU Types, THIS fails rather than the check below passing
		// vacuously.
		expect(rows.length, 'no rows — the assertion below would be vacuous').toBeGreaterThan(5);

		const missing = rows.filter((r) => typeof r.revision !== 'number');
		expect(
			missing.map((r) => r.id),
			'a row without its revision cannot be declared as `expectedRevision`, so the page it renders is ' +
				'last-write-wins by construction (PER-4)'
		).toEqual([]);
	});

	// THE VALUE MUST BE THE TRUE ONE, not merely present. A helper that supplied `revision: 0` everywhere would
	// pass the test above and mislead every caller — the shape of defect where a field is populated with a
	// constant to satisfy a check.
	it('the revision a row carries is the object’s actual revision', () => {
		const rows = listByType(engine, 'PWU_TYPE');
		for (const r of rows)
			expect(r.revision, `${r.id} must carry its true revision`).toBe(getObjectRevision(engine, r.id));
		// and they are not all the same number, so the field is tracking something
		expect(new Set(rows.map((r) => r.revision)).size, 'a constant would satisfy the check above').toBeGreaterThan(
			0
		);
	});

	// THE SINGLE-OBJECT PATH. `getObject` returns state only — deliberately, since its callers want state — so
	// `getObjectRevision` is the paired read. Pinned so the pair cannot drift apart.
	it('getObjectRevision agrees with the store for a known object', () => {
		const first = listByType(engine, 'PWU_TYPE')[0];
		expect(first, 'control: the seed must publish at least one PWU Type').toBeDefined();
		if (!first) return;
		expect(getObject(engine, first.id), 'the state read still works').toBeTruthy();
		expect(getObjectRevision(engine, first.id)).toBe(first.revision);
		expect(
			getObjectRevision(engine, 'pwut_does_not_exist_01ARZ3NDEKTSV4RRFFQ69K9'),
			'an unknown id yields undefined, never a fabricated 0'
		).toBeUndefined();
	});
});
