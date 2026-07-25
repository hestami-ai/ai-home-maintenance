// JAN-REVREM RW-2 — pinning the incoherent-graph safety of `startableStepIds`, and the disposition of a review
// finding I could not reproduce.
//
// THE FINDING (#7, MAJOR, confirmed by two refuters): "`startableStepIds` has no graph-incoherence floor, and the
// test asserting it does is a vacuous negative." It cited an executed probe: *an entry-less plan yields
// `startableStepIds = ['s1']` while `startStepGate` refuses it as incoherent* — a read-model/authority divergence.
//
// TWO OF ITS THREE CLAIMS ARE TRUE.
//   1. `startableStepIds` genuinely does not call `graphIsIncoherent`. Its siblings both do (`prunableStepIds`
//      and `startStepGate`), so the asymmetry is real and was invisible.
//   2. The existing coverage IS a vacuous negative: `transition-gate-entry.test.ts`'s 2-cycle is refused by
//      `stepAtFrontier` on its own, so no floor is under test there.
//
// THE THIRD — THE FAILURE SCENARIO — DID NOT REPRODUCE, in four shapes, and the reason is structural rather than
// lucky: `live()` seeds its walk from `entryStepIds(...)`, the SAME function `graphIsIncoherent` calls. So
// incoherent ⟺ no entry ⟹ the live set is EMPTY ⟹ `effectiveDisposition` overrides every real-source edge to
// NEUTRALIZED ⟹ no step has a SATISFIED in-edge ⟹ `stepAtFrontier` is false everywhere ⟹ the set is `[]`.
// A step whose ONLY in-edges are source-less would escape that, but `entryStepIds` counts such a step as an
// ENTRY, which contradicts incoherence. There is no gap between the two.
//
// SO NO FLOOR IS ADDED, AND THAT IS THE DISCIPLINED ANSWER, NOT THE LAZY ONE. A `graphIsIncoherent` call here
// could never change the answer — a guard whose inputs cannot disagree, which is F-01's shape exactly and the
// single defect this whole lineage exists to eliminate. Adding it would look like diligence and be dead code,
// and the next reviewer would have to re-derive that it is unreachable.
//
// WHAT WAS ACTUALLY MISSING IS THIS FILE. The safety is EMERGENT — a consequence of two functions sharing one
// entry definition — and nothing asserted it. Change the seeding of `live()` and the divergence the finding
// described becomes real, silently. These cases pin the property at the level it actually holds.
import { describe, expect, it } from 'vitest';
import {
	entryStepIds,
	prunableStepIds,
	startStepGate,
	startableStepIds
} from './transition-gate.js';

type Plan = Parameters<typeof startableStepIds>[0];

const plan = (
	steps: readonly { id: string; stepState: string }[],
	transitions: readonly Record<string, unknown>[]
): Plan => ({ id: 'p', status: 'ACTIVE', steps, transitions }) as unknown as Plan;

/** Four incoherent shapes — every step carries a real-source in-edge, so the graph has no entry at all. */
const INCOHERENT: readonly { readonly why: string; readonly plan: Plan }[] = [
	{
		why: 'a 2-cycle (the shape the existing vacuous test uses)',
		plan: plan(
			[
				{ id: 's1', stepState: 'QUEUED' },
				{ id: 's2', stepState: 'QUEUED' }
			],
			[
				{ id: 't12', sourceStepId: 's1', targetStepId: 's2', transitionType: 'SEQUENTIAL' },
				{ id: 't21', sourceStepId: 's2', targetStepId: 's1', transitionType: 'SEQUENTIAL' }
			]
		)
	},
	{
		why: 'a 2-cycle with one arm already SUCCEEDED — so its out-edge would be SATISFIED but for liveness',
		plan: plan(
			[
				{ id: 's1', stepState: 'QUEUED' },
				{ id: 's2', stepState: 'SUCCEEDED' }
			],
			[
				{ id: 't21', sourceStepId: 's2', targetStepId: 's1', transitionType: 'SEQUENTIAL' },
				{ id: 't12', sourceStepId: 's1', targetStepId: 's2', transitionType: 'SEQUENTIAL' }
			]
		)
	},
	{
		why: 'a cycle PLUS a source-less edge into s1 — the only shape that could produce a SATISFIED in-edge',
		plan: plan(
			[
				{ id: 's1', stepState: 'QUEUED' },
				{ id: 's2', stepState: 'QUEUED' }
			],
			[
				{ id: 'tEntry', targetStepId: 's1', transitionType: 'SEQUENTIAL' },
				{ id: 't21', sourceStepId: 's2', targetStepId: 's1', transitionType: 'SEQUENTIAL' },
				{ id: 't12', sourceStepId: 's1', targetStepId: 's2', transitionType: 'SEQUENTIAL' }
			]
		)
	},
	{
		why: 'a 3-cycle, so the walk has no fixpoint to start from at any length',
		plan: plan(
			[
				{ id: 's1', stepState: 'QUEUED' },
				{ id: 's2', stepState: 'SUCCEEDED' },
				{ id: 's3', stepState: 'SUCCEEDED' }
			],
			[
				{ id: 't12', sourceStepId: 's1', targetStepId: 's2', transitionType: 'SEQUENTIAL' },
				{ id: 't23', sourceStepId: 's2', targetStepId: 's3', transitionType: 'SEQUENTIAL' },
				{ id: 't31', sourceStepId: 's3', targetStepId: 's1', transitionType: 'SEQUENTIAL' }
			]
		)
	}
];

describe('RW-2 / #7 — an incoherent graph offers nothing, and the two planes AGREE', () => {
	it.each(INCOHERENT.map((c) => [c.why, c] as const))(
		'%s: startableStepIds is empty AND startStepGate refuses',
		(_why, c) => {
			// The fixture must actually BE incoherent, or the case proves nothing about incoherence.
			expect(
				entryStepIds(c.plan.steps, c.plan.transitions ?? []),
				'the fixture is not incoherent — it has an entry'
			).toEqual([]);

			// THE AGREEMENT, which is the property the finding says is missing. It holds; it just holds
			// emergently, via the shared entry definition, and nothing asserted it until now.
			expect(startableStepIds(c.plan), 'the read-model must offer no start').toEqual([]);
			for (const s of c.plan.steps)
				expect(startStepGate(c.plan, s.id).ok, `the authority must refuse ${s.id}`).toBe(false);

			// …and prune stays closed too (WP-3's explicit floor), so an incoherent plan cannot be quietly
			// dismantled step by step. Its remedy is supersession.
			expect(prunableStepIds(c.plan)).toEqual([]);
		}
	);

	it('the pin is NOT vacuous: a COHERENT graph of the same size does offer a start', () => {
		// Without this, "startableStepIds is empty" would be satisfied by a function that returns [] always — which
		// is precisely the over-refusal blindness the incoherence cases cannot see on their own.
		const coherent = plan(
			[
				{ id: 's1', stepState: 'QUEUED' },
				{ id: 's2', stepState: 'QUEUED' }
			],
			[{ id: 't12', sourceStepId: 's1', targetStepId: 's2', transitionType: 'SEQUENTIAL' }]
		);
		expect(entryStepIds(coherent.steps, coherent.transitions ?? [])).toEqual(['s1']);
		expect(startableStepIds(coherent)).toEqual(['s1']);
		expect(startStepGate(coherent, 's1').ok).toBe(true);
	});

	it('THE MECHANISM, pinned directly: incoherence and the live-set seed share ONE entry definition', () => {
		// This is what makes the agreement above structural rather than lucky, and it is the thing to protect. If
		// `live()` is ever seeded from a different notion of "entry" than `graphIsIncoherent` tests, the divergence
		// the finding described becomes real — and the cases above would start failing, which is the point.
		for (const c of INCOHERENT) {
			const entries = entryStepIds(c.plan.steps, c.plan.transitions ?? []);
			expect(entries, c.why).toEqual([]);
			// No entry ⇒ nothing is live ⇒ nothing is at the frontier. Asserted as the implication, not as a
			// restatement of the answer.
			expect(startableStepIds(c.plan).length, c.why).toBe(0);
		}
	});
});
