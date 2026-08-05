// The validation disposition is DERIVED from the machine, and this is what makes that true rather than claimed.
//
// ── WHY IT EXISTS (REG-F-026 group (b)) ──────────────────────────────────────────────────────────────────────
// `ValidateDecomposition.disposition` declared `enumRef: DecompositionValidationDispositionSchema`, an enum that
// does not exist, so the field shipped as an unvalidated `z.string()`. The obvious close was to quote the three
// values its own vocab note carried — `VALID|CONDITIONALLY_VALID|INVALID`.
//
// THAT WOULD HAVE RATIFIED A NOTE BY PROMOTING IT. The command's `sourceSection` says UNRATIFIED-AUTHORED in as
// many words: *"DOC-007 schematizes NO interface for this, so these fields were AUTHORED, not derived … Do NOT
// treat this sourceSection as proof the shape is ratified."* The three values were somebody's reading, and this
// week has been a series of findings about transcriptions nobody checked.
//
// So they are derived instead, from an artifact that IS ratified: the six `DecompositionContract.status` states
// are VERBATIM core-model §13.1, and the machine's only arrows out of UNDER_REVIEW — the state this command acts
// on — go to VALID, CONDITIONALLY_VALID and INVALID. **A validation disposition is exactly the set of outcomes
// the machine can reach from the state being validated.** The note turned out to be right; it just was not
// evidence, and the difference is the whole point.
//
// AND THE ENUM THAT LOOKED RIGHT WAS WRONG. `DecompositionContractStatus` exists, is ratified, and carries these
// three values — plus DRAFT, UNDER_REVIEW and SUPERSEDED. Binding the field to it would have constrained the
// field and corrupted its meaning, admitting three states that are not outcomes of validating anything. That is
// the group (a) trap in a different costume: the nearest ratified name is not the right constraint.
import { ValidateDecompositionPayloadSchema } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { getMachine } from './stateMachine.js';

const MACHINE = 'DecompositionContract.status';
const VALIDATED_FROM = 'UNDER_REVIEW';

/** The states the ratified machine can reach from the state `ValidateDecomposition` acts on. */
function outcomesOfValidating(): string[] {
	return [
		...new Set(
			getMachine(MACHINE)
				.transitions.filter((t) => t.from === VALIDATED_FROM)
				.map((t) => t.to)
		)
	].sort();
}

/** The values the emitted contract admits for the disposition field. */
function admittedDispositions(): string[] {
	const shape = ValidateDecompositionPayloadSchema.shape as Record<string, unknown>;
	const node = shape.disposition as { _def?: { entries?: Record<string, string> } };
	return Object.keys(node._def?.entries ?? {}).sort();
}

describe('ValidateDecomposition.disposition is derived from the ratified machine (REG-F-026 group (b))', () => {
	it('admits exactly the outcomes reachable from UNDER_REVIEW — no more, no fewer', () => {
		expect(
			admittedDispositions(),
			'the contract and the machine disagree about what validating a decomposition can conclude. Whichever ' +
				'moved, they are no longer one fact stated twice'
		).toEqual(outcomesOfValidating());
	});

	it('CONTROL: the derivation reads a real machine and a real constraint', () => {
		// Both sides must be non-trivial. An empty machine query and an unconstrained schema would agree on `[]`,
		// and the assertion above would pass while measuring nothing — which is precisely the failure that let this
		// field ship as `z.string()` in the first place.
		expect(outcomesOfValidating().length).toBe(3);
		expect(admittedDispositions().length).toBe(3);
	});

	it('does NOT admit the three non-outcome states, which the nearest ratified enum would have', () => {
		// DecompositionContractStatus is ratified and contains the right three values — and three wrong ones. This
		// asserts the difference, because "constrained" was never the requirement.
		const all = getMachine(MACHINE).states;
		const nonOutcomes = all.filter((s) => !outcomesOfValidating().includes(s));
		expect(nonOutcomes.sort()).toEqual(['DRAFT', 'SUPERSEDED', 'UNDER_REVIEW']);
		for (const s of nonOutcomes)
			expect(
				ValidateDecompositionPayloadSchema.safeParse({ disposition: s, validatorRole: 'r' })
					.success,
				`${s} is a DecompositionContract state but not an outcome of validating one`
			).toBe(false);
	});

	it('every admitted value is accepted by the emitted schema — the union is not merely narrow but correct', () => {
		for (const d of admittedDispositions())
			expect(
				ValidateDecompositionPayloadSchema.safeParse({ disposition: d, validatorRole: 'r' })
					.success,
				`${d} is reachable from ${VALIDATED_FROM} and must be sayable`
			).toBe(true);
	});
});
