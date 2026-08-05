// PWU KIND VOCABULARY — the catalog scopes policies by a kind vocabulary the seeded work does not use.
//
// ── WHY IT EXISTS (REG-F-028) ────────────────────────────────────────────────────────────────────────────────
// REG-F-022's second instance DELIVERED `appliesToPwuKinds` to the runtime: twelve catalog policies declare which
// PWU kinds they govern, the seeding used to drop the field, and now it reaches `applicability.pwuKindConditions`
// where the §5.1 kernel can read it. That closed the delivery question and opened a better one, which only became
// visible when the applicability precondition was wired and run:
//
//   **A field can reach the runtime and still match nothing, because it names a vocabulary the runtime does not
//   speak.**
//
// The catalog says `INTENT_AND_PRODUCT_DEFINITION`; `seed-workbench.ts` gives its PWU Type the kind
// `INTENT_DEFINITION`. Same concept, different string, and `pwuKind` is a free `z.string()` with no ratified enum
// to hold either side honest — so nothing failed, nothing warned, and a kind-scoped policy silently governs
// nothing. The precondition run is what found it: it got past the floor and refused at step #56, reporting
// NOT_APPLICABLE for a PWU whose objectType the policy explicitly names.
//
// ── WHICH SIDE IS THE DRIFT, AND HOW THAT WAS SETTLED ────────────────────────────────────────────────────────
// Not by preferring the ratified-looking artifact — by finding the vocabulary in the corpus. The Field Service
// Management Reference Undertaking writes `"pwuKind": "INTENT_AND_PRODUCT_DEFINITION"`. **The catalog agrees with
// the corpus; the seeder does not.** So the repository's seeded kinds are the divergence, and the fix is a
// vocabulary migration of the seeded PWU Types — not an edit to the catalog, and not a mapping table invented
// here to make two names meet in the middle.
//
// This census does not fix it. It pins the size of it so the number can only fall, and so the next author sees
// the mismatch as a measured fact rather than rediscovering it through a refusal three layers away.
import { MAPPED_PWU_KINDS } from '@janumipwb/rph-projections';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, getObject, type EngineHandle } from './index.js';
import { seedWorkbench } from './seed-workbench.js';

/** Every PWU kind the CATALOG scopes a policy to. */
function catalogKinds(): string[] {
	const out = new Set<string>();
	for (const p of ontology.seedPolicies as ReadonlyArray<{ appliesToPwuKinds?: readonly string[] }>)
		for (const k of p.appliesToPwuKinds ?? []) out.add(k);
	return [...out].sort();
}

/**
 * Every PWU kind the SEEDED PWU Types actually carry — read from the committed EVENT LOG and the materialized
 * objects, never from `seed-workbench.ts`'s source. A census that re-reads the seeder's own constant agrees with
 * it by construction and could not have seen this divergence, which is a mismatch between what the seeder writes
 * and what the catalog expects to find.
 */
function seededKinds(engine: EngineHandle): string[] {
	const ids = new Set<string>();
	for (const e of engine.readAllEvents())
		if ((e as { aggregateType?: string }).aggregateType === 'PWU_TYPE')
			ids.add((e as unknown as { aggregateId: string }).aggregateId);
	const out = new Set<string>();
	for (const id of ids) {
		const state = getObject(engine, id) as { pwuKind?: string } | undefined;
		if (typeof state?.pwuKind === 'string') out.add(state.pwuKind);
	}
	return [...out].sort();
}

describe('PWU kind vocabulary: catalog vs seeded work (REG-F-028)', () => {
	let engine: EngineHandle;
	let seeded: string[];

	beforeAll(() => {
		let n = 0;
		engine = createEngine({
			ontology,
			now: () => '2026-08-05T00:00:00Z',
			newEventId: () => `evt_${++n}`
		});
		seedWorkbench(engine);
		seeded = seededKinds(engine);
	});

	it('CONTROL: both vocabularies are non-empty and read from their real sources', () => {
		// Two empty sets agree perfectly. This repository has shipped a census that measured nothing (REG-F-022's
		// blind reader), so the population is proven before any claim is made about it.
		expect(
			catalogKinds().length,
			'the catalog scopes no policy by kind — nothing to compare'
		).toBeGreaterThan(5);
		expect(
			seeded.length,
			'no seeded PWU Type carries a pwuKind — the census is reading nothing'
		).toBeGreaterThan(5);
	});

	it('exactly ONE seeded kind is outside the catalog vocabulary, and it is the repository’s own invention', () => {
		// SIX on 2026-08-05, then ONE the same day. The five that closed were ABBREVIATIONS of names the seeder
		// already carried in full: every PWU Type's `name` was already the corpus's prose ('Architecture
		// Definition', 'Integrated Product Validation'), and only the UPPER_SNAKE `kind` had been shortened. So the
		// migration was snake-casing the name each type already had — derived, with no judgement in it.
		//
		// ARCHITECTURE_CONCERN is the one left, and what it is was CORRECTED 2026-08-05 after this comment claimed
		// the opposite. It said: *"'Architecture Concern' appears ZERO times in the ontology specification. The
		// repository invented a generic child of Architecture Definition"* — and proposed the corpus's §15
		// 'Architecture Decision' as the real counterpart.
		//
		// THE MEASUREMENT WAS TRUE AND THE INFERENCE WAS FALSE. Zero hits in the ontology SPECIFICATION is a fact
		// about one file. The CORPUS names this type repeatedly: the PWA Designer Reference Demonstration lists
		// 'Custom Architecture Concern' among Architecture Definition's permitted children and defines the type
		// with the inherited purpose *"Define a coherent architecture concern contributing to Architecture
		// Definition."* — which `seed-workbench.ts` carries almost verbatim. The Field Service Management
		// Reference Undertaking puts 'Architecture Concern' in its §32 trace. So the seeded type is TRANSCRIBED,
		// and renaming it to 'Architecture Decision' would have replaced one corpus concept with a different one.
		// Searching one document and concluding about the corpus is the absence-of-evidence error, committed here.
		//
		// WHAT IS GENUINELY ABSENT is a POLICY scoped to this kind — absent from the dataset AND the corpus. That
		// is REG-F-029's blocking question, and it is an authoring decision, not a spelling one.
		const cat = catalogKinds();
		expect(seeded.filter((k) => !cat.includes(k))).toEqual(['ARCHITECTURE_CONCERN']);
	});

	it('every catalog kind that binds to nothing seeded is a type the workbench simply does not seed', () => {
		// Not a defect on its own: the catalog scopes policies for PWU Types beyond the seven the reference
		// workbench stands up (Intent Discovery, Product Boundary, Requirement Definition, User Journey
		// Definition, Work Decomposition, Architecture Decision). Counted so that an accidental narrowing of the
		// seeded set, or a stray catalog kind, shows up as a change rather than as silence.
		const unbindable = catalogKinds().filter((k) => !seeded.includes(k));
		expect(unbindable.sort()).toEqual([
			'ARCHITECTURE_DECISION',
			'INTENT_DISCOVERY',
			'PRODUCT_BOUNDARY',
			'REQUIREMENT_DEFINITION',
			'USER_JOURNEY_DEFINITION',
			'WORK_DECOMPOSITION'
		]);
	});

	it('every seeded kind has an EXPLICIT compatibility milestone — none relies on the silent default', () => {
		// Found the hard way during this migration. `milestoneForKind` ends `?? 'INTAKE'`, which is the right
		// reading for a kind from an arbitrary PWA — but it cannot distinguish "a kind we never knew" from "a kind
		// we knew, renamed underneath us". Renaming five seeded kinds left five stale keys, and FOUR of the five
		// degraded to INTAKE with nothing failing; one test asserting one specific milestone is the only reason it
		// surfaced at all. This closes that: the default now covers only the case it was written for.
		const unmapped = seeded.filter((k) => !MAPPED_PWU_KINDS.includes(k));
		expect(
			unmapped,
			'these seeded kinds fall through to the INTAKE default, so their milestone is a fallback wearing the ' +
				'appearance of a derivation'
		).toEqual([]);
		// CONTROL: the map is a real lookup that can miss, so the empty list above is a judgement not a constant.
		expect(MAPPED_PWU_KINDS).not.toContain('A_KIND_NOBODY_DEFINED');
	});

	it('the seeded root tree now speaks the corpus vocabulary, name for name', () => {
		// The ontology specification draws the tree in prose: Product Realization over Intent and Product
		// Definition / Product Behavior Definition / Architecture Definition / Implementation Planning / Product
		// Implementation / Integrated Product Validation / Product Baseline Promotion. UPPER_SNAKE of those eight
		// IS the catalog's vocabulary, which is what settles the direction of the migration — the catalog is
		// grounded in the corpus and the seeder's abbreviations were not.
		for (const k of [
			'PRODUCT_REALIZATION',
			'INTENT_AND_PRODUCT_DEFINITION',
			'PRODUCT_BEHAVIOR_DEFINITION',
			'ARCHITECTURE_DEFINITION',
			'IMPLEMENTATION_PLANNING',
			'PRODUCT_IMPLEMENTATION',
			'INTEGRATED_PRODUCT_VALIDATION',
			'PRODUCT_BASELINE_PROMOTION'
		])
			expect(seeded, `${k} is named by the ontology specification's own PWU Type tree`).toContain(
				k
			);
	});
});
