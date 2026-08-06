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
function pwuTypeIds(engine: EngineHandle): string[] {
	const ids = new Set<string>();
	for (const e of engine.readAllEvents())
		if ((e as { aggregateType?: string }).aggregateType === 'PWU_TYPE')
			ids.add((e as unknown as { aggregateId: string }).aggregateId);
	return [...ids];
}

/** The kinds those types carry. */
function seededKinds(engine: EngineHandle): string[] {
	const out = new Set<string>();
	for (const id of pwuTypeIds(engine)) {
		const state = getObject(engine, id) as { pwuKind?: string } | undefined;
		if (typeof state?.pwuKind === 'string') out.add(state.pwuKind);
	}
	return [...out].sort();
}

describe('PWU kind vocabulary: catalog vs seeded work (REG-F-028)', () => {
	let engine: EngineHandle;
	let seeded: string[];
	let typeIds: string[];

	beforeAll(() => {
		let n = 0;
		engine = createEngine({
			ontology,
			now: () => '2026-08-05T00:00:00Z',
			newEventId: () => `evt_${++n}`
		});
		seedWorkbench(engine);
		seeded = seededKinds(engine);
		typeIds = pwuTypeIds(engine);
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

	it('NO seeded kind is outside the catalog vocabulary — every kind the workbench seeds can be governed', () => {
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
		// WHAT WAS GENUINELY ABSENT was a POLICY scoped to this kind — absent from the dataset AND the corpus. That
		// was REG-F-029's blocking question, and it is now AUTHORED and CLOSED: `pol_architecture_coverage` names
		// ARCHITECTURE_CONCERN, derived from DOC-006 §32.2's ratified trace — *"Scheduling and Dispatch Architecture
		// Concern → PRODUCES → Architecture Artifact → SUPPORTS → Architecture Coverage Claim → VERIFIED_BY →
		// Architecture Assurance Assessment"* — where that policy is named "Architecture Coverage" and evaluates
		// COVERAGE claims. The MEMBERSHIP is authored; the routing is read off the trace. Disclosed in full in the
		// policy's own `sourceSection`, and 6 -> 1 -> 0 is the ratchet this file exists to hold.
		const cat = catalogKinds();
		expect(
			seeded.filter((k) => !cat.includes(k)),
			'a seeded kind no catalog policy names is work the workbench creates and no policy can govern'
		).toEqual([]);
	});

	it('every catalog kind that binds to nothing seeded is a type the workbench simply does not seed', () => {
		// Not a defect on its own: the catalog scopes policies for PWU Types beyond the seven the reference
		// workbench stands up (Intent Discovery, Product Boundary, Requirement Definition, User Journey
		// Definition, Work Decomposition, Architecture Decision). Counted so that an accidental narrowing of the
		// seeded set, or a stray catalog kind, shows up as a change rather than as silence.
		const unbindable = catalogKinds().filter((k) => !seeded.includes(k));
		expect(unbindable.sort()).toEqual([
			// ONE, since the 2026-08-06 deepening. This list held SIX: the five sub-kinds the PWA now publishes
			// left it by being published, which is the deepening working rather than the pin being relaxed.
			// ARCHITECTURE_DECISION remains because the ontology describes it and names it in NO candidateChildren
			// list — `ValidatePwa` refuses an orphan type (§11.6), and parenting it by guess would author
			// composition structure the ontology declined to state.
			'ARCHITECTURE_DECISION'
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

	it('every seeded PWU Type DECLARES at least one policy, and every declared policy APPLIES to it', () => {
		// THE PRECONDITION'S PRECONDITION (REG-F-029). Once §5.1 is enforced at RequestAssuranceAssessment, a PWU
		// whose type declares no applicable policy cannot be assessed at all — and the failure would surface as a
		// refused dispatch deep in a drive, three layers from the empty list that caused it. This asserts the two
		// halves at the source: DECLARED is non-empty, and DECLARED ⊆ APPLICABLE.
		//
		// Both sides are read from the ENGINE — the type objects the seeder actually wrote, and the policy objects
		// actually in the store — never from PWU_TYPES or the ontology constants. Until today the declaration was a
		// hand-written third copy on PWU_TYPES that was a strict subset of the ontology for three kinds and absent
		// for five; a census reading that copy would have called it healthy.
		// READ THE DELIVERED FORM, AND REFUSE TO SKIP. The first draft of this check read `pol.appliesToPwuKinds`
		// off the stored object — an ONTOLOGY field name. The seeding delivers it as
		// `applicability.pwuKindConditions`, so the lookup was `undefined` for every policy and the guard
		// `if (kinds && ...)` made the whole second half silently inert. It PASSED, and it was measuring nothing:
		// the blind reader again, inside a gate written to catch exactly this class, twenty minutes after writing
		// it. An absent applicability is now a REPORTED problem rather than a skipped one.
		const problems: string[] = [];
		const inapplicable: string[] = [];
		for (const id of typeIds) {
			const t = getObject(engine, id) as
				{ pwuKind?: string; name?: string; requiredAssurancePolicyIds?: string[] } | undefined;
			if (!t?.pwuKind) continue;
			const declared = t.requiredAssurancePolicyIds ?? [];
			if (declared.length === 0) {
				problems.push(`${t.name} (${t.pwuKind}) declares NO policy — nothing could assess it`);
				continue;
			}
			let applicableToThisType = 0;
			for (const pid of declared) {
				const pol = getObject(engine, pid) as
					{ applicability?: { pwuKindConditions?: string[] } } | undefined;
				if (!pol) {
					problems.push(`${t.name} declares ${pid}, which is not an object in the store`);
					continue;
				}
				if (!pol.applicability) {
					problems.push(
						`${t.name} declares ${pid}, whose delivered object carries NO applicability — the §5.1 ` +
							'determination would have nothing to read'
					);
					continue;
				}
				const kinds = pol.applicability.pwuKindConditions;
				// Absent pwuKindConditions means UNRESTRICTED by kind (governance.ts), which IS applicable.
				if (!kinds || kinds.includes(t.pwuKind)) applicableToThisType++;
				else inapplicable.push(`${t.pwuKind} declares ${pid}, scoped to [${kinds.join(', ')}]`);
			}
			if (applicableToThisType === 0)
				problems.push(
					`${t.name} (${t.pwuKind}) declares ${declared.length} policy/policies and NONE applies to its ` +
						'own kind — the intersection is empty, so once §5.1 is enforced nothing can assess it'
				);
		}
		expect(
			problems,
			'each is a PWU Type the workbench seeds that no policy could assess once §5.1 is enforced'
		).toEqual([]);

		// DECLARED-BUT-INAPPLICABLE IS NOT A DEFECT OF THE SELECTOR — it is precisely what DECLARED n DETERMINED
		// exists to drop, and the ontology carries four such pairs across its fourteen templates (one of them on a
		// SEEDED kind). Pinned rather than asserted to zero: removing them edits the catalog's own authored scope
		// lists, which is an authoring act on top of another, and the intersection makes them harmless meanwhile.
		expect(
			inapplicable.sort(),
			'a declaration the policy itself refuses — visible, not fatal'
		).toEqual([
			'PRODUCT_REALIZATION declares pol_baseline_promotion, scoped to [PRODUCT_BASELINE_PROMOTION]'
		]);
	});

	it('CONTROL: the check above reads real types with real declarations', () => {
		// Zero types and zero declarations would also produce an empty problem list. This proves the population.
		expect(typeIds.length, 'no PWU Types were read from the engine').toBeGreaterThan(5);
		const declaredCounts = typeIds.map(
			(id) =>
				(
					(getObject(engine, id) as { requiredAssurancePolicyIds?: string[] } | undefined)
						?.requiredAssurancePolicyIds ?? []
				).length
		);
		expect(Math.min(...declaredCounts), 'some type declares nothing').toBeGreaterThan(0);
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
