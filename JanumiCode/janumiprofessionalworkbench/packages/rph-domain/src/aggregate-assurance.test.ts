// DOC-004 §28.2's aggregate disposition, gated — including §28.1's invariant as a PROPERTY, not just cases.
//
// A decision table is easy to write and easy to write decoratively: get the rungs right individually and the
// ORDER wrong, and every single-case test still passes while a rejection loses to an inconclusive. So the
// precedence between rungs is tested explicitly, and §28.1's "preserve the strictest unresolved disposition" is
// tested as monotonicity over every pair of dispositions rather than by example.
import { AggregateAssuranceDispositionSchema } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import {
	AGGREGATE_STRICTNESS,
	aggregateAssuranceDisposition,
	type AggregateInput
} from './aggregate-assurance.js';

/** A concluded assessment for `policyId` with `disposition`. */
const done = (policyId: string, disposition: string): AggregateInput => ({
	policyId,
	disposition,
	assessed: true
});
/** An assessment that EXISTS but has not concluded. */
const underway = (policyId: string): AggregateInput => ({ policyId, assessed: true });
/** An applicable policy with no assessment at all. */
const none = (policyId: string): AggregateInput => ({ policyId, assessed: false });

describe('§28.2 aggregate assurance disposition', () => {
	it('the strictness order covers the ratified enum exactly — no value unranked, none invented', () => {
		// Derived from the contract enum rather than eyeballed, so a seventh aggregate value cannot be added
		// without ranking it. An unranked value would silently break the monotonicity property below.
		expect([...AGGREGATE_STRICTNESS].sort()).toEqual(
			[...AggregateAssuranceDispositionSchema.options].sort()
		);
	});

	it('EVERY ratified value is reachable — which is the answer REG-F-023 wanted for this enum', () => {
		// REG-F-023 counted declared-but-unreachable states. This enum was excluded from that census because it is
		// a reduction, not a machine — so its reachability was never established either way. Here it is: six
		// values, six witnesses.
		const witnesses: Record<string, readonly AggregateInput[]> = {
			REJECTED: [done('p', 'REJECTED')],
			UNASSESSED: [none('p')],
			EVIDENCE_REQUIRED: [underway('p')],
			INCONCLUSIVE: [done('p', 'INCONCLUSIVE')],
			CONDITIONALLY_SATISFIED: [done('p', 'CONDITIONALLY_SATISFIED')],
			SATISFIED: [done('p', 'SATISFIED')]
		};
		for (const v of AggregateAssuranceDispositionSchema.options)
			expect(aggregateAssuranceDisposition(witnesses[v] ?? []), `${v} is unreachable`).toBe(v);
	});

	// ── PRECEDENCE: the half a per-rung test cannot see ────────────────────────────────────────────────────────
	it('a REJECTION beats everything, however many satisfied policies outvote it', () => {
		// §28.1: "a satisfied advisory policy does not override a rejected blocking policy." This is also the
		// "must not be reduced to a numerical average" prohibition made concrete: five of six inputs are
		// SATISFIED and the aggregate is REJECTED. Any averaging implementation fails here.
		const inputs = [
			done('a', 'SATISFIED'),
			done('b', 'SATISFIED'),
			done('c', 'SATISFIED'),
			done('d', 'SATISFIED'),
			done('e', 'SATISFIED'),
			done('f', 'REJECTED')
		];
		expect(aggregateAssuranceDisposition(inputs)).toBe('REJECTED');
	});

	it('a MISSING assessment beats INCONCLUSIVE, which beats CONDITIONALLY_SATISFIED', () => {
		// The two adjacent precedences a per-rung test cannot distinguish from a wrongly-ordered table.
		expect(aggregateAssuranceDisposition([none('a'), done('b', 'INCONCLUSIVE')])).toBe('UNASSESSED');
		expect(
			aggregateAssuranceDisposition([done('a', 'INCONCLUSIVE'), done('b', 'CONDITIONALLY_SATISFIED')])
		).toBe('INCONCLUSIVE');
		expect(
			aggregateAssuranceDisposition([done('a', 'CONDITIONALLY_SATISFIED'), done('b', 'SATISFIED')])
		).toBe('CONDITIONALLY_SATISFIED');
	});

	it('§28.1 AS A PROPERTY: a pair folds to the STRICTER of the two, for every pair', () => {
		// ── THIS TEST WAS WEAKER THAN ITS NAME, AND A MUTANT PROVED IT ─────────────────────────────────────────
		// The first version varied ONE input against a SATISFIED baseline and asserted the result never weakened.
		// It therefore never put two non-satisfied verdicts in the same set — so when a mutant moved the
		// INCONCLUSIVE rung ABOVE the REJECTED rung (each rung individually correct, the table collectively
		// mis-ordered) this property stayed GREEN. The precedence case caught it; the "property" that was
		// supposed to be the strong general check did not.
		//
		// The real §28.1 invariant is stated over the SET: "preserve the strictest unresolved disposition". So it
		// is tested that way — every ordered pair, folding to the stricter of the two. That is the mutant's exact
		// failure mode, and it is now the general case rather than one example of it.
		const rank = (d: string) => AGGREGATE_STRICTNESS.indexOf(d as never);
		const DISPOSITIONS = ['SATISFIED', 'CONDITIONALLY_SATISFIED', 'INCONCLUSIVE', 'REJECTED'];
		for (const x of DISPOSITIONS)
			for (const y of DISPOSITIONS) {
				const stricter = rank(x) < rank(y) ? x : y;
				expect(
					aggregateAssuranceDisposition([done('a', x), done('b', y)]),
					`{${x}, ${y}} must preserve the stricter (${stricter}) — §28.1`
				).toBe(stricter);
			}
	});

	it('§28.1 over a set of THREE, so the property is not an artefact of pairs', () => {
		// A fold that returned "the stricter of the first two" would satisfy every pair above. Order-independence
		// is part of the claim: the aggregate is a property of the SET, not of the array order.
		const inputs = [done('a', 'SATISFIED'), done('b', 'CONDITIONALLY_SATISFIED'), done('c', 'REJECTED')];
		expect(aggregateAssuranceDisposition(inputs)).toBe('REJECTED');
		expect(aggregateAssuranceDisposition([...inputs].reverse())).toBe('REJECTED');
		expect(
			aggregateAssuranceDisposition([inputs[2]!, inputs[0]!, inputs[1]!]),
			'the aggregate is a property of the set, not of the order it was folded in'
		).toBe('REJECTED');
	});

	// ── THE DISCLOSED DERIVATIONS ─────────────────────────────────────────────────────────────────────────────
	it('the EVIDENCE_REQUIRED / UNASSESSED disjunction resolves by whether an assessment EXISTS', () => {
		// §28.2 offers two values for one rung and does not say which. Underway-but-unconcluded is
		// EVIDENCE_REQUIRED; nothing at all is UNASSESSED — the only reading under which both are reachable.
		expect(aggregateAssuranceDisposition([underway('a')])).toBe('EVIDENCE_REQUIRED');
		expect(aggregateAssuranceDisposition([none('a')])).toBe('UNASSESSED');
		// And nothing-at-all is the stricter of the two when both are present.
		expect(aggregateAssuranceDisposition([underway('a'), none('b')])).toBe('UNASSESSED');
	});

	it('ESCALATED has no §28.2 rung and maps to INCONCLUSIVE — a disclosed gap, not a silent one', () => {
		expect(aggregateAssuranceDisposition([done('a', 'ESCALATED')])).toBe('INCONCLUSIVE');
		// It must not reach a positive verdict, which is the property that actually matters about the mapping.
		expect(aggregateAssuranceDisposition([done('a', 'ESCALATED'), done('b', 'SATISFIED')])).not.toBe(
			'SATISFIED'
		);
	});

	it('an INAPPLICABLE policy does not vote, and does not make the subject unassessed either', () => {
		// §28.2 says "required assessment"; a §5.1 NOT_APPLICABLE determination requires nothing. The row stays in
		// the VIEW (guide §8.4: inapplicable coverage stays explainable) — it just stops voting here.
		const inputs: AggregateInput[] = [
			done('a', 'SATISFIED'),
			{ policyId: 'b', assessed: false, applicable: false }
		];
		expect(aggregateAssuranceDisposition(inputs)).toBe('SATISFIED');
		// CONTROL: the same un-assessed policy DOES vote when nobody determined it inapplicable — so the line
		// above is about applicability and not about `assessed: false` being ignored.
		expect(aggregateAssuranceDisposition([done('a', 'SATISFIED'), none('b')])).toBe('UNASSESSED');
	});

	it('no applicable policy at all is UNASSESSED, not vacuously SATISFIED', () => {
		// "All required assessments satisfied" is vacuously true over an empty set. Returning SATISFIED there is
		// the exact vacuous-green this repository exists to prevent, and §28.1's "strictest unresolved" forbids it.
		expect(aggregateAssuranceDisposition([])).toBe('UNASSESSED');
		expect(aggregateAssuranceDisposition([{ policyId: 'a', assessed: false, applicable: false }])).toBe(
			'UNASSESSED'
		);
	});

	it('FAIL CLOSED: an unrecognised disposition does not fall through into SATISFIED', () => {
		// The rung-6 check is positive ("every input is SATISFIED") rather than reached by elimination, so a newly
		// ratified disposition cannot acquire a passing aggregate by being unhandled.
		expect(aggregateAssuranceDisposition([done('a', 'SOMETHING_NEW')])).toBe('INCONCLUSIVE');
		expect(aggregateAssuranceDisposition([done('a', 'SOMETHING_NEW'), done('b', 'SATISFIED')])).toBe(
			'INCONCLUSIVE'
		);
	});
});

// ── JAN-PFA R3 S3.3 — RUNG 1 BEATS RUNG 3: a pending assessment cannot hide a recorded rejection ──────────────
//
// ⛔ SURVIVING MUTANT CLOSED: rung 1 left in place but made to WAIT for every required assessment to conclude —
// `required.every((i) => dispositionOf(i) !== undefined) && required.some(... === 'REJECTED')`.
//
// ⭐ THIS FILE'S HEADER ALREADY NAMES THE EXACT DEFECT IT MISSED: "get the rungs right individually and the ORDER
// wrong, and every single-case test still passes while a rejection loses to an inconclusive." The order WAS tested
// between adjacent rungs — and not for this pair. The mutant does not remove rung 1; it makes rung 3 overtake it,
// so ONE applicable policy with no concluded assessment suppresses a REJECTION that has already been recorded and
// the aggregate reports UNASSESSED or EVIDENCE_REQUIRED instead.
//
// ⚠ THAT IS THE WORST DIRECTION AVAILABLE: §28.1 requires the STRICTEST unresolved disposition to be preserved,
// and this reports a LESS strict one — work with a recorded rejection reads as merely unfinished, which is the
// state a promotion gate treats as "not yet" rather than "no".
describe('JAN-PFA R3 — a REJECTION outranks an unconcluded assessment (§28.1 strictness order)', () => {
	const rejected = { policyId: 'pol_rejected', disposition: 'REJECTED', assessed: true } as const;

	it('a recorded REJECTED survives alongside a policy whose assessment has NOT concluded', () => {
		// The unconcluded companion is the whole arrangement: `disposition: undefined` with `assessed: true` is
		// the EVIDENCE_REQUIRED rung's own input, so rung 3 is genuinely live and losing to rung 1 on purpose.
		expect(
			aggregateAssuranceDisposition([rejected, { policyId: 'pol_pending', assessed: true }]),
			'an unconcluded assessment suppressed a recorded REJECTION — rung 3 overtook rung 1'
		).toBe('REJECTED');
	});

	it('and alongside a policy with NO assessment at all, which is the UNASSESSED rung', () => {
		expect(
			aggregateAssuranceDisposition([rejected, { policyId: 'pol_none', assessed: false }]),
			'a missing assessment suppressed a recorded REJECTION'
		).toBe('REJECTED');
	});

	it('CONTROL: without the rejection those same companions DO reach the lower rungs', () => {
		// ⛔ Without this the two assertions above would pass against a fold that simply always says REJECTED.
		expect(aggregateAssuranceDisposition([{ policyId: 'pol_pending', assessed: true }])).not.toBe(
			'REJECTED'
		);
		expect(aggregateAssuranceDisposition([{ policyId: 'pol_none', assessed: false }])).not.toBe('REJECTED');
	});
});
