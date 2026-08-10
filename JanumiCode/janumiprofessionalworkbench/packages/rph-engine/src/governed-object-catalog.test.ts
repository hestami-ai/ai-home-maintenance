// THE SUBJECT CATALOG — what a governance Decision can be ABOUT (REG-F-106, ruled REG-D-041).
//
// ── WHY IT EXISTS ─────────────────────────────────────────────────────────────────────────────────────────────
// `/decisions` proposed every Decision with `subjectObjectIds: []`. `subjectObjectIds` is a REQUIRED field of
// `DecisionObject` in BOTH ratified contracts (CDM §23.1 L1373; Contract Package §22 L1632), for all nine decision
// types — and OBJ-1 (JPWB-DOC-003 L105) forbids reading meaning into the empty case: *"No semantic state may be
// inferred from null values, empty arrays, missing rows…"*. Per ASR-15 a decision that cannot name its subject and
// version *"is not authority — it is provenance at best"*. The surface could not do better because nothing could
// LIST what a decision might be about. This is that list.
//
// ⚠ THE TYPE SET IS DERIVED, AND THE DERIVATION IS THE POINT. I originally told the sponsor that three decision
// types were "exempt" because no gate of OURS read them — a fact about our gates, not about the corpus, and the
// same enumeration error as REG-F-102. So the catalog walks `ProfessionalWorkObjectTypeSchema.options`, and a new
// object type reaches it by EXISTING. The last test below is what holds that: it derives the expectation from the
// same registry, so a hand-maintained list here would fail rather than quietly drift.
import { createEngine } from './engine.js';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { listGovernedObjects, listPwus, listUndertakings } from './queries.js';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { ProfessionalWorkObjectTypeSchema } from '@janumipwb/rph-contracts';
import { seedWorkbench } from './seed-workbench.js';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeAll, describe, expect, it } from 'vitest';

const TS = '2026-08-10T00:00:00Z';

// The seed authors its acting party into its payloads (REG-F-014), so the session principal must BE `owner-1`.
// See queries-revision.test.ts for the full reasoning; the literal is duplicated for the same reason it is there.
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

describe('listGovernedObjects — the subjects a Decision can name', () => {
	let engine: ReturnType<ReturnType<typeof createEngine>['as']>;

	beforeAll(() => {
		let n = 0;
		engine = createEngine({
			authenticate: DIR.authenticate,
			ontology,
			store: new SqliteStorageAdapter({ now: () => TS }),
			now: () => TS,
			newEventId: () => `evt_${++n}`
		}).as(OWNER);
		seedWorkbench(engine);
	});

	it('offers the seeded PWUs, with the semantic version a decision must bind (ASR-15)', () => {
		// `listPwus` takes an undertakingId, NOT a QueryScope — PWUs carry `undertakingId` directly, so they are not
		// one of the four subject-bindable types whose scope moved into the signature. Omitting it is the whole
		// workspace. (The population control below caught me passing a scope object here.)
		const pwus = listPwus(engine);
		expect(pwus.length, 'the seed must produce PWUs for this to assert anything').toBeGreaterThan(0);
		const catalog = listGovernedObjects(engine, { kind: 'WORKSPACE' });
		for (const pwu of pwus) {
			const row = catalog.find((r) => r.id === pwu.id);
			expect(row, `PWU ${pwu.id} must be offerable as a decision subject`).toBeDefined();
			expect(row!.objectType).toBe('PROFESSIONAL_WORK_UNIT');
			// The version is the whole reason the catalog carries more than ids: ASR-15 binds subject VERSIONS,
			// and "a decision approving version n never authorizes version n+1".
			expect(row!.semanticVersion, 'the pin the approver will state').toBe(pwu.state.semanticVersion);
		}
	});

	it('labels a row with something a human can choose, and never with an empty string', () => {
		const catalog = listGovernedObjects(engine, { kind: 'WORKSPACE' });
		expect(catalog.length).toBeGreaterThan(10);
		for (const row of catalog) expect(row.label.length, `${row.id} has no label`).toBeGreaterThan(0);
		// Objects disagree on their name field, so the fallback is the id — which is still selectable. What must
		// NOT happen is a blank option, which is unclickable and indistinguishable from a bug.
		expect(catalog.some((r) => r.label !== r.id), 'at least some rows resolve a real name').toBe(true);
	});

	// ── CONTROL 1: SCOPE IS HONOURED, AND IS A STRICT SUBSET ──────────────────────────────────────────────────
	// Without this, `listGovernedObjects` could ignore its scope argument entirely and both tests above would
	// still pass — the SPEC-001 INV-02 defect that four query helpers shipped with (see QueryScope in queries.ts).
	it('CONTROL — UNDERTAKING scope is a NON-EMPTY, STRICT subset of WORKSPACE', () => {
		const undertakings = listUndertakings(engine);
		expect(undertakings.length, 'the seed must produce an undertaking').toBeGreaterThan(0);
		const workspace = listGovernedObjects(engine, { kind: 'WORKSPACE' });
		const scoped = listGovernedObjects(engine, {
			kind: 'UNDERTAKING',
			undertakingId: undertakings[0]!.id
		});
		expect(scoped.length, 'the undertaking owns something').toBeGreaterThan(0);
		expect(scoped.length, 'and not everything — else the filter is not running').toBeLessThan(
			workspace.length
		);
		const workspaceIds = new Set(workspace.map((r) => r.id));
		for (const row of scoped) expect(workspaceIds.has(row.id)).toBe(true);
	});

	// ── CONTROL 2: THE WALK IS THE REGISTRY, NOT A LIST I TYPED ───────────────────────────────────────────────
	// The catalog must be capable of surfacing EVERY governed type. It cannot assert that every type is populated
	// (the seed does not create all 23), so it asserts the reachable half: every type the catalog DOES return is a
	// registry member, and every type the STORE holds is offered. A hand-written type list would fail the second
	// limb the day a type was added — which is exactly the drift this control exists to catch.
	it('CONTROL — the catalog is derived from the object-type registry, not from a hand-written list', () => {
		const registry = new Set<string>(ProfessionalWorkObjectTypeSchema.options);
		const catalog = listGovernedObjects(engine, { kind: 'WORKSPACE' });
		const offered = new Set(catalog.map((r) => r.objectType));
		expect(offered.size, 'more than one type must be present or this proves nothing').toBeGreaterThan(3);
		for (const t of offered) expect(registry.has(t), `${t} is not a registry type`).toBe(true);

		// The second limb: every registry type the STORE actually holds must be offered. Derived from the log, so
		// it cannot be satisfied by my agreeing with myself.
		const held = new Set<string>();
		for (const e of engine.readAllEvents()) if (registry.has(e.aggregateType)) held.add(e.aggregateType);
		expect(held.size).toBeGreaterThan(3);
		expect([...held].filter((t) => !offered.has(t)), 'types held but not offered').toEqual([]);
	});
});
