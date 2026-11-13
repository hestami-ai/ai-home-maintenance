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
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P40';
const ROOT_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P41';
const CHILD_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P42';
const SECOND_ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P43';
const ORPHAN_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P44';

describe('ValidatePwa gate (live pipeline)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
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

	// ── ⭐⭐ RESTATED BY PACKAGE L11 — design D66 (`REG-D-155`; `l11-facts.md` §3 (e)) ─────────────────────────────────────────────────────
	// SubmitPwaForReview now asks the structure ValidatePwa asks (`pwaCompositionFailures`, the one decision both call), so it refuses each
	// invalid arrangement below while the PWA is DRAFT. Each such test asserts Submit's refusal of the same arrangement, naming exactly the
	// failed invariants Validate then names, and THEN reaches ValidatePwa's own check — the second guard (`REG-D-155` (2)) — as a store written
	// before L11 holds the PWA, UNDER_REVIEW (Submit then had no guard), every assertion on Validate as before.

	/** The failed invariants a structure refusal names — Submit's and Validate's spell them alike. */
	const invariantsOf = (message: string | undefined): string | undefined =>
		/is not a valid recursive decomposition \((.*)\)\. Fix the child rules/.exec(message ?? '')?.[1];

	/** ⭐⭐ L11 (D66) — Submit refuses the arrangement for its structure, the PWA left DRAFT and no event appended: its message. */
	function refusedAtSubmit(): string {
		const before = store.readAllEvents().length;
		const r = d('SubmitPwaForReview', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
		expect(r.status, 'Submit admitted a PWA whose structure ValidatePwa refuses (D66)').toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain(
			"The structure, ValidatePwa's check: the PWU-Type composition is not a valid recursive decomposition ("
		);
		expect([pubStatus(), store.readAllEvents().length - before], 'a refused Submit moved the PWA').toEqual(['DRAFT', 0]);
		return r.error!.message;
	}

	/**
	 * ⭐⭐ L11 (D66; `REG-D-155` (2)) — THE PWA UNDER_REVIEW, AS A STORE WRITTEN BEFORE PACKAGE L11 HOLDS IT. Until L11, SubmitPwaForReview had no
	 * guard and took such a PWA to UNDER_REVIEW, where ValidatePwa's own check is the second guard; since L11 no command takes it past DRAFT
	 * (`refusedAtSubmit`, asserted first). Written as the transition left it — the status and its `lifecycleStatus` mirror, the revision moved
	 * and the semantic version not — with no event, the repository's way of arranging a state no command reaches
	 * (`sta6-superseded-intent.test.ts`).
	 */
	function asAStoreBeforeL11Holds(): void {
		const stored = store.loadObject(PWA);
		expect(stored?.objectType, 'arrangement: the PWA').toBe('PROFESSIONAL_WORK_ARCHITECTURE');
		const tag = `fixture-l11-${PWA}-UNDER_REVIEW`;
		const written = store.commit({
			aggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			aggregateId: PWA,
			objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			expectedRevision: stored!.revision,
			newRevision: stored!.revision + 1,
			newSemanticVersion: stored!.semanticVersion,
			currentState: { ...(stored!.state as Record<string, unknown>), publicationStatus: 'UNDER_REVIEW', lifecycleStatus: 'UNDER_REVIEW' },
			events: [],
			receipt: { commandId: tag, idempotencyKey: tag, commandType: 'FixtureSeedPublicationStatus', targetAggregateId: PWA, status: 'ACCEPTED', producedEventIds: [] }
		});
		expect(written.ok, 'arrangement: the status was not written').toBe(true);
	}

	// "no missing/disallowed/cyclic child rules" (§11.6 L1639). ROOT permits CHILD and CHILD permits ROOT: the
	// composition hierarchy is not a hierarchy, so no leaf is reachable and recomposition can never terminate.
	it('rejects a Draft whose child rules are cyclic', () => {
		createDraftPwa();
		defineType(ROOT_TYPE, { isRoot: true, children: [CHILD_TYPE] });
		defineType(CHILD_TYPE, { isRoot: false, children: [ROOT_TYPE] });
		const atSubmit = refusedAtSubmit();
		asAStoreBeforeL11Holds();

		const r = d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');

		expect(r.status).toBe('REJECTED');
		expect(pubStatus()).toBe('UNDER_REVIEW');
		expect(invariantsOf(atSubmit), 'Submit and Validate named other invariants').toBe(invariantsOf(r.error?.message));
	});

	// "never reduce a PWA to a flat node list" (§16 item 9 L2506). Two disconnected roots plus an unreachable
	// orphan: analyzePwaGraph fails single-root AND connectivity here.
	it('rejects a Draft with two roots and an unreachable orphan type', () => {
		createDraftPwa();
		defineType(ROOT_TYPE, { isRoot: true });
		defineType(SECOND_ROOT, { isRoot: true });
		defineType(ORPHAN_TYPE, { isRoot: false });
		const atSubmit = refusedAtSubmit();
		asAStoreBeforeL11Holds();

		const r = d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');

		expect(r.status).toBe('REJECTED');
		expect(pubStatus()).toBe('UNDER_REVIEW');
		expect(invariantsOf(atSubmit), 'Submit and Validate named other invariants').toBe(invariantsOf(r.error?.message));
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

	// ── The gate must be PRECISE: each HARD limb refuses on its OWN ───────────────────────────────────────────────
	// The two cases above prove a refusal HAPPENS. Neither proves WHICH limb produced it, and the composition
	// verdict has THREE (`analyzePwaGraph`, pwa-graph.ts:382 — "exactly one root, permits acyclic, every node
	// reachable from the root"), all three demanded by §11.6 L1639 ("no missing/disallowed/cyclic child rules …
	// every type reachable from that root") and by §16 item 9's "never reduce a PWA to a flat node list". A gate
	// wired to two of the three is INDISTINGUISHABLE from one wired to all three for as long as every arrangement
	// trips more than one limb: the cycle case trips acyclic-permits alone, but the two-roots-plus-orphan case
	// trips single-root AND connected together (as its own comment says), so `connected` has never been the SOLE
	// reason a ValidatePwa was refused here — drop that limb and both cases above stay green.
	//
	// Each arrangement below fails EXACTLY ONE limb, and the row asserts that: the refusal must NAME its limb and
	// must NOT name either other. That is what makes the set drivable one member at a time — pinning one member
	// (which is how this gap arose) proves nothing about the rest, so the promise is asserted over the whole set
	// and the failure message names the offending member.
	const HARD_LIMBS = ['single-root', 'acyclic-permits', 'connected'] as const;
	type HardLimb = (typeof HARD_LIMBS)[number];

	const ISOLATING: ReadonlyArray<{ limb: HardLimb; shape: string; arrange: () => void }> = [
		{
			limb: 'single-root',
			shape: 'two lone roots, nothing cyclic and nothing unreachable',
			arrange: () => {
				defineType(ROOT_TYPE, { isRoot: true });
				defineType(SECOND_ROOT, { isRoot: true });
			}
		},
		{
			limb: 'acyclic-permits',
			shape: 'one root whose only child permits the root back, so every type is still reachable',
			arrange: () => {
				defineType(ROOT_TYPE, { isRoot: true, children: [CHILD_TYPE] });
				defineType(CHILD_TYPE, { isRoot: false, children: [ROOT_TYPE] });
			}
		},
		{
			limb: 'connected',
			shape: 'one root over one leaf, plus a non-root type no type permits',
			arrange: () => {
				defineType(ROOT_TYPE, { isRoot: true, children: [CHILD_TYPE] });
				defineType(CHILD_TYPE, { isRoot: false });
				defineType(ORPHAN_TYPE, { isRoot: false });
			}
		}
	];

	it.each(ISOLATING)(
		'refuses a Draft that fails ONLY the $limb limb — $shape',
		({ limb, arrange }) => {
			createDraftPwa();
			arrange();
			const atSubmit = refusedAtSubmit();
			asAStoreBeforeL11Holds();

			const r = d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');
			const message = r.error?.message ?? '';

			// The arrangement is an isolating probe only if this limb is the sole failure reported, so check that
			// FIRST: otherwise a green row could be another limb's refusal wearing this row's name.
			expect(
				message,
				`the refusal does not name the ${limb} limb, so nothing here is evidence that ${limb} was consulted`
			).toContain(`${limb}:`);
			for (const other of HARD_LIMBS.filter((l) => l !== limb))
				expect(
					message,
					`this arrangement must fail ${limb} ALONE, but the refusal also names ${other} — it cannot tell a gate that consults ${limb} from one that ignores it`
				).not.toContain(`${other}:`);

			expect(
				r.status,
				`a PWA failing the ${limb} limb was not refused (${limb} is unenforced): ${message}`
			).toBe('REJECTED');
			expect(r.error?.code, `the ${limb} refusal is not a structural-invariant refusal`).toBe(
				'RPH_INVARIANT_VIOLATION'
			);
			expect(
				pubStatus(),
				`a PWA failing the ${limb} limb reached VALIDATED and can walk on to PUBLISHED`
			).toBe('UNDER_REVIEW');
			expect(r.producedEventIds, `the ${limb} refusal still appended events`).toEqual([]);
			// ⭐⭐ L11 — Submit isolated the limb exactly as Validate does: the same failed invariants, so each row above holds at Submit too.
			expect(invariantsOf(atSubmit), `Submit and Validate named other invariants for the ${limb} limb`).toBe(invariantsOf(message));
		}
	);

	// ── CONTROL: the gate ADMITS composition that holds ───────────────────────────────────────────────────────────
	// Without this, a gate that refused EVERY ValidatePwa — including the legitimate one — would satisfy every
	// assertion above, and "VALIDATED is unreachable" would read as "the gate is precise". Two legitimate shapes,
	// not one: a gate narrowed to "must have a child" and a gate narrowed to "must be a lone root" are each a real
	// over-refusal, and a single-shape control would admit one of them.
	const LEGITIMATE: ReadonlyArray<{ shape: string; arrange: () => void }> = [
		{
			shape: 'a lone root',
			arrange: () => {
				defineType(ROOT_TYPE, { isRoot: true });
			}
		},
		{
			shape: 'a root over one reachable leaf',
			arrange: () => {
				defineType(ROOT_TYPE, { isRoot: true, children: [CHILD_TYPE] });
				defineType(CHILD_TYPE, { isRoot: false });
			}
		}
	];

	it.each(LEGITIMATE)(
		'CONTROL: admits a Draft whose composition holds — $shape',
		({ shape, arrange }) => {
			createDraftPwa();
			arrange();
			submit();

			const r = d('ValidatePwa', {}, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE');

			expect(
				r.status,
				`${shape} satisfies all three HARD invariants and was still refused: ${r.error?.message ?? ''}`
			).toBe('ACCEPTED');
			expect(pubStatus(), `${shape} was accepted but the PWA did not reach VALIDATED`).toBe(
				'VALIDATED'
			);
		}
	);
});
