// Drives the REAL command pipeline (engine.dispatch) to ask the question no other test asks: does the ValidatePwa
// CALL SITE enforce, or is VALIDATED just a status label? Every other PWA test proves the kernel is correct;
// this one proves the handler consults it. The graph below is structurally invalid by the guide's own terms, so
// ValidatePwa must REJECT it — a PWA that reaches VALIDATED unexamined can walk on to PUBLISHED and bind a
// production Undertaking on no proof at all.
//
// Guide §11.6 L1639, byte-exact:
//   "A Draft cannot become `VALIDATED` or `PUBLISHED` unless recursive-composition and assurance-assignment
//    validation proves: explicit leaf/non-leaf treatment; coherent decomposition/recomposition; no
//    missing/disallowed/cyclic child rules; the non-removable floor and all applicable policy
//    references/triggers/Evidence/independence/protected transitions; and fixtures demonstrating activation and
//    enforcement."
// and, on the same line:
//   "A missing policy assignment blocks PWA validation/publication"
//
// Guide §16 item 9 L2506, byte-exact:
//   "Preserve roots, recursively reachable PWU Types, named child rules, explicit leaves,
//    decomposition/recomposition, assurance assignments, and instantiation expectations; never reduce a PWA to a
//    flat node list."
//
// DEAD KERNEL: `analyzePwaGraph` (packages/rph-projections/src/pwa-graph.ts:213) already computes exactly this
// verdict — its HARD invariants are "exactly one root, permits acyclic, every node reachable from the root" and it
// returns `valid: false` for each graph below. apps/rph-demo's floor.ts and the PWA route both call it; the
// ValidatePwa handler (pwa-authoring.ts:412) does not. It is a bare advanceStatus with no `guard`, unlike its
// neighbour publishPwa which does pass one (pwaFloorGate). The structural verdict is computed and then ignored at
// the one call site that gates the transition. (It is not imported here: rph-application does not depend on
// rph-projections, and wiring that dependency is the production fix, not this test's job.)
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'des-1', actorType: 'HUMAN' as const, displayName: 'Designer' };
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P40';
const ROOT_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P41';
const CHILD_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P42';
const SECOND_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P43';
const ORPHAN_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P44';

describe('ValidatePwa gate (live pipeline)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	function d(commandType: string, payload: unknown, id: string, type: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	const pubStatus = () =>
		(store.loadObject(PWA)?.state as { publicationStatus: string }).publicationStatus;

	function createDraftPwa() {
		const r = d(
			'CreatePwa',
			{
				pwaId: PWA,
				name: 'Product Realization',
				description: 'd',
				domain: 'software',
				version: '1.0.0'
			},
			PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}

	// Fixtures are asserted ACCEPTED so a later red can only mean the gate is absent — never a malformed payload.
	function defineType(
		id: string,
		opts: { isRoot: boolean; children?: string[]; policies?: string[] }
	) {
		const r = d(
			'DefinePwuType',
			{
				pwuTypeId: id,
				pwaId: PWA,
				pwuKind: 'PRODUCT_REALIZATION',
				name: `Type ${id.slice(-2)}`,
				purpose: 'p',
				isRoot: opts.isRoot,
				permittedChildTypeIds: opts.children ?? [],
				requiredAssurancePolicyIds: opts.policies ?? []
			},
			id,
			'PWU_TYPE'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}

	function submit() {
		const r = d('SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(pubStatus()).toBe('UNDER_REVIEW');
	}

	// "no missing/disallowed/cyclic child rules" (§11.6 L1639). ROOT permits CHILD and CHILD permits ROOT: the
	// composition hierarchy is not a hierarchy, so no leaf is reachable and recomposition can never terminate.
	it('rejects a Draft whose child rules are cyclic', () => {
		createDraftPwa();
		defineType(ROOT_TYPE, { isRoot: true, children: [CHILD_TYPE] });
		defineType(CHILD_TYPE, { isRoot: false, children: [ROOT_TYPE] });
		submit();

		const r = d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');

		expect(r.status).toBe('REJECTED');
		expect(pubStatus()).toBe('UNDER_REVIEW');
	});

	// "never reduce a PWA to a flat node list" (§16 item 9 L2506). Two disconnected roots plus an unreachable
	// orphan: analyzePwaGraph fails single-root AND connectivity here.
	it('rejects a Draft with two roots and an unreachable orphan type', () => {
		createDraftPwa();
		defineType(ROOT_TYPE, { isRoot: true });
		defineType(SECOND_ROOT, { isRoot: true });
		defineType(ORPHAN_TYPE, { isRoot: false });
		submit();

		const r = d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');

		expect(r.status).toBe('REJECTED');
		expect(pubStatus()).toBe('UNDER_REVIEW');
	});

	// "A missing policy assignment blocks PWA validation/publication" (§11.6 L1639). requiredAssurancePolicyIds is
	// authorable but no gate reads it (finding [62]), so a PWA carrying zero assurance assignments validates.
	//
	// SUSPENDED, NOT DELETED — blocked on a ratified contract gap (§16 item 9). The expectation is LEGITIMATE and
	// the defect is real; what is missing is the contract that would let the gate decide it without inventing a rule:
	//
	//   • §11.7.4, byte-exact, keeps on EVERY PWU Type an assurance rail reading "🔒 de minimis floor · non-removable"
	//     — the floor is non-removable, therefore never an *assignment* that can go MISSING — and shows the additive
	//     policies ("+ Requirement Coverage", "+ Intent Preservation", "+ UCD/JTBD coverage") varying per type. So
	//     L1639's "A missing policy assignment" is relative to APPLICABILITY: an applicable policy left unassigned.
	//   • §11.7.4 rail 1 requires definition time to declare "the applicable Assurance Policy/version, trigger/
	//     materiality rule, subject and Claim, required Evidence, independence, protected boundary/transition, and
	//     required Validator capability contract". `requiredAssurancePolicyIds: string[]` is a BARE ID LIST carrying
	//     none of the trigger/materiality/subject terms applicability is decided from, and this fixture seeds no
	//     ASSURANCE_POLICY objects at all — so nothing is applicable and nothing is missing.
	//   • The rules that WOULD close it — "every type must name >=1 policy", or "the PWA must name >=1 somewhere" —
	//     are stated nowhere in the corpus, and the first is contradicted by §11.7.4's own exemplar (and by the
	//     seeded Product Realization PWA, 5 of whose 9 types carry only the locked floor). Encoding either is §0.3's
	//     "must not choose a convenient interpretation and encode it as architecture".
	//
	// UN-SKIP WHEN: the PWU Type's assurance declaration is contracted with its trigger/materiality rule (§16 item 9,
	// "The exact wire shape is unresolved—not the recursive composition requirement"), then route the gate through
	// the already-dead kernel `evaluateApplicability` and assert on an APPLICABLE-but-unassigned policy. The fixture
	// will then need to seed a policy that is applicable to these types.
	it.skip('rejects a Draft whose PWU Types carry no assurance assignment', () => {
		createDraftPwa();
		defineType(ROOT_TYPE, { isRoot: true, children: [CHILD_TYPE], policies: [] });
		defineType(CHILD_TYPE, { isRoot: false, policies: [] });
		submit();

		const r = d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');

		expect(r.status).toBe('REJECTED');
		expect(pubStatus()).toBe('UNDER_REVIEW');
	});
});
