// The floor's DECLARED scope must cover everything its ENFORCED scope reaches (REG-F-024).
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// The de minimis floor had two scopes that disagreed, and the disagreement was invisible from either side alone.
//
//   DECLARED: `seedFloorPolicies` gave all three floor policies `applicableObjectTypes:
//             ['PROFESSIONAL_WORK_ARCHITECTURE']`, citing a "single-value limitation" that does not exist — the
//             field is and always was `z.array(ProfessionalWorkObjectTypeSchema)`.
//   ENFORCED: `floor-gate.ts` — the §8.4 step-4 protected-transition gate, reused by the authoring plane's
//             PublishPwa and the execution plane's completeExecutionStep — never reads that field at all. It
//             requires FLOOR_POLICY_IDS outright, for whatever subject it is handed.
//
// So the floor was ALREADY universal where it bites and narrow where it is described, and reading either file
// on its own showed something coherent. It surfaced only when the ratified §5.1 applicability determination was
// wired as a precondition and REFUSED 54 DRIVES — the reference undertaking failing at step #47 on an EVIDENCE
// subject under `floor.schema-invariant`, which the declaration said the floor did not govern.
//
// ── WHY THE ASSERTION RUNS THIS DIRECTION ────────────────────────────────────────────────────────────────────
// Declared ⊇ enforced, not equality. §16 item 23's instruction is one-sided and verbatim: **"Never interpret the
// missing wire shape as permission to omit or hide the floor."** Declaring a type the gate never asks about
// costs nothing — `applicabilityPermitsAssessment` refuses only on NOT_APPLICABLE, so a broad declaration
// permits more and requires nothing. Declaring one type too FEW silently exempts real professional work from the
// floor, which is the reading item 23 forbids. The two errors are not symmetric, and neither is this test.
import {
	AssurancePolicyStatusSchema,
	ProfessionalWorkObjectTypeSchema
} from '@janumipwb/rph-contracts';
import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEngine, getObject, type AuthedEngineHandle } from './index.js';
import { driveReferenceUndertaking } from './reference-undertaking.js';
import { seedFloorPolicies } from './seed-workbench.js';

const FLOOR_IDS = Object.values(FLOOR_POLICY_IDS);

/**
 * EVERY PATH THAT CREATES THE FLOOR POLICIES — and there are two, which is the correction this file needed.
 *
 * The first version of this gate drove only `seedFloorPolicies`. `driveReferenceUndertaking` creates the same
 * three policies itself on its standalone path (it must: `satisfyFloor` cites them, and nothing else has seeded
 * them there), and that copy kept `['PROFESSIONAL_WORK_ARCHITECTURE']` for a commit after the other was fixed.
 * So the gate written to stop the floor being scoped away from the work it governs asserted over ONE of the two
 * places that scope is set — and on the path it could not see, `satisfyFloor`'s subjects are EVIDENCE objects,
 * exactly the case that produced the original step-#47 refusal.
 *
 * A gate that covers one of two writers is not a gate; it is the first writer's own test wearing the word
 * "declared". Parameterised so that adding a third writer without adding it here is itself the visible omission.
 */
const CREATION_PATHS: ReadonlyArray<{ name: string; run: (e: AuthedEngineHandle) => void }> = [
	{ name: 'seedFloorPolicies (workbench seed)', run: (e) => seedFloorPolicies(e) },
	{
		name: 'driveReferenceUndertaking (standalone path)',
		run: (e) => driveReferenceUndertaking(e)
	}
];

describe.each(CREATION_PATHS)(
	'the de minimis floor declares a scope covering everything it enforces — via $name (REG-F-024)',
	({ run }) => {
		let engine: AuthedEngineHandle;

		beforeEach(() => {
			let n = 0;
			engine = createEngine({ authenticate: testAuthenticator(),
				ontology,
				now: () => '2026-08-05T00:00:00Z',
				newEventId: () => `evt_${++n}`
			}).as(TEST_CRED.human);
			run(engine);
		});

		/**
		 * The scope each floor policy actually declares, read from the ENGINE rather than from the seeder's constant.
		 *
		 * `getObject` RETURNS THE STATE — it does not wrap it. A probe in this repository once read `getObject(...)
		 * ?.state` and got `undefined` for every policy, reporting a real number from an instrument that saw nothing
		 * (REG-F-022's blind reader). The CONTROL below is what would catch that here.
		 */
		const declaredScopes = (): Map<string, string[]> => {
			const out = new Map<string, string[]>();
			for (const id of FLOOR_IDS) {
				const state = getObject(engine, id) as { applicableObjectTypes?: string[] } | undefined;
				if (state?.applicableObjectTypes) out.set(id, [...state.applicableObjectTypes].sort());
			}
			return out;
		};

		it('CONTROL: all three floor policies exist and were read back with a real scope', () => {
			// Read from the store, not from FLOOR_POLICY_DEFINITIONS: a census that consults the same constant the
			// seeder does would agree with it whatever the engine actually persisted. This repository has shipped that
			// mistake — the blind reader in REG-F-022 — so the population is proven before it is judged.
			const scopes = declaredScopes();
			expect(scopes.size, `expected ${FLOOR_IDS.length} floor policies in the store`).toBe(
				FLOOR_IDS.length
			);
			for (const [id, types] of scopes)
				expect(types.length, `${id} declares an empty scope`).toBeGreaterThan(0);
		});

		it('covers EVERY governed object type — the floor is not scoped away from any of them', () => {
			const all = [...ProfessionalWorkObjectTypeSchema.options].sort();
			for (const [id, declared] of declaredScopes())
				expect(
					all.filter((t) => !declared.includes(t)),
					`${id} does not reach these object types, so professional work of that type is outside the floor ` +
						'that §8.4 says every material transformation must clear'
				).toEqual([]);
		});

		it('covers the three types the FIXTURE seeds, and the one it was already missing', () => {
			// `__tests__/floor-fixtures.ts` seeds PROFESSIONAL_WORK_ARCHITECTURE / PROFESSIONAL_WORK_UNIT / ARTIFACT.
			// That list was written by someone who needed the array and used it — while production shipped one type —
			// and it was ALREADY missing EVIDENCE, which is exactly what the reference undertaking tripped on. Named
			// here so a future narrowing has to explain itself against the concrete case that broke.
			const declared = declaredScopes().get(FLOOR_POLICY_IDS.SCHEMA_INVARIANT) ?? [];
			for (const t of [
				'PROFESSIONAL_WORK_ARCHITECTURE',
				'PROFESSIONAL_WORK_UNIT',
				'ARTIFACT',
				'EVIDENCE'
			])
				expect(declared, `${t} must be inside the floor's declared scope`).toContain(t);
		});

		it('CONTROL: the scope is DERIVED, so a new object type is covered without anyone remembering this file', () => {
			// The failure mode of a hand-written list is silent under-declaration on the day the enum grows — the
			// forbidden direction. This asserts the declaration tracks the enum exactly rather than happening to
			// contain today's members: same size, same contents.
			const all = [...ProfessionalWorkObjectTypeSchema.options].sort();
			for (const [id, declared] of declaredScopes())
				expect(declared, `${id}'s scope is not the enum — it is a list that will rot`).toEqual(all);
			// ...and the enum is non-trivial, so the equality above is a real claim.
			expect(all.length).toBeGreaterThan(20);
		});

		it('the floor policies are seeded in a status the floor gate can actually use', () => {
			// Scope is only half of "the floor reaches this work": a policy nothing can cite is scoped to everything
			// and governs nothing. This keeps the two facts in one place.
			for (const id of FLOOR_IDS) {
				const state = getObject(engine, id) as { status?: string } | undefined;
				expect(
					AssurancePolicyStatusSchema.options as readonly string[],
					`${id} has status ${state?.status}, which is not a ratified AssurancePolicyStatus`
				).toContain(state?.status);
			}
		});
	}
);
