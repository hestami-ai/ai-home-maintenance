// JAN-REVREM RW-2, CORRECTED BY RW-4 — the incoherent-graph floor on `startableStepIds`.
//
// THIS FILE PREVIOUSLY ARGUED THAT REVIEW FINDING #7 COULD NOT HAPPEN. THAT ARGUMENT WAS WRONG, and the way it
// was wrong is the most instructive thing in this programme.
//
// RW-2 declined to add a `graphIsIncoherent` floor here, reasoning: no entry ⇒ empty live set ⇒ every
// real-source edge NEUTRALIZED ⇒ no step has a SATISFIED in-edge ⇒ no frontier. It then wrote: "a step whose
// ONLY in-edges are source-less would escape that, but `entryStepIds` counts such a step as an ENTRY,
// contradicting incoherence. There is no gap."
//
// THE ESCAPE WAS MIS-STATED BY ONE WORD. It does not require a step whose ONLY in-edges are source-less. It
// requires a step with ONE source-less in-edge and NO **PENDING** real-source in-edge — and a real-source edge
// off a CANCELLED or SUPERSEDED step is IRRECOVERABLE_TERMINAL, hence NEUTRALIZED, which is not PENDING and
// does not block the barrier. `localEdgeDisposition` returns SATISFIED for a source-less edge unconditionally;
// it never consults liveness.
//
//   steps [s1 QUEUED, s2 CANCELLED]; edges [(→s1), (s2→s1), (s1→s2)]
//   ⇒ entryStepIds [] (incoherent) · startableStepIds ['s1'] · startStepGate(s1) REFUSES.
//
// AND THE FIXTURES BELOW WERE CHOSEN SO THEY COULD NOT NOTICE. All four original shapes give s1 a PENDING
// in-edge from a QUEUED or live source, so `!anyPending` fails for a reason that has nothing to do with
// incoherence. A negative asserted over fixtures that cannot produce the thing is unfalsifiable by
// construction — the exact defect RW-2 corrected in the dormancy register, committed by the same author in the
// same work package, about ninety minutes apart. Four probes were run and every one used a PENDING source.
//
// The floor is now in `startableStepIds`, and it is demonstrably NOT dead code: the CANCELLED/SUPERSEDED shapes
// below fail without it. The lesson kept rather than tidied away: **"I could not construct a counterexample" is
// a claim about my search, not about the world** — and a test written to confirm that claim will confirm it.
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
		why: 'THE SHAPE RW-2 MISSED: a source-less entry edge + a CANCELLED real source (NEUTRALIZED, not PENDING)',
		plan: plan(
			[
				{ id: 's1', stepState: 'QUEUED' },
				{ id: 's2', stepState: 'CANCELLED' }
			],
			[
				{ id: 'tEntry', targetStepId: 's1', transitionType: 'SEQUENTIAL' },
				{ id: 't21', sourceStepId: 's2', targetStepId: 's1', transitionType: 'SEQUENTIAL' },
				{ id: 't12', sourceStepId: 's1', targetStepId: 's2', transitionType: 'SEQUENTIAL' }
			]
		)
	},
	{
		why: 'the same, with SUPERSEDED — the other irrecoverable terminal state',
		plan: plan(
			[
				{ id: 's1', stepState: 'QUEUED' },
				{ id: 's2', stepState: 'SUPERSEDED' }
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

	it('AT LEAST ONE fixture reaches the frontier WITHOUT the floor — so the floor is not dead code', () => {
		// The guard RW-2 declined to add on the ground that it "could never change the answer". This case exists to
		// make that claim falsifiable: remove the `graphIsIncoherent` line from `startableStepIds` and the
		// CANCELLED/SUPERSEDED shapes above go RED, because their s1 genuinely reaches the barrier.
		const exposing = INCOHERENT.filter((c) =>
			c.plan.steps.some((s) => s.stepState === 'CANCELLED' || s.stepState === 'SUPERSEDED')
		);
		expect(
			exposing.length,
			'the array must contain a shape that can expose the gap'
		).toBeGreaterThan(0);
		for (const c of exposing) {
			// Each such step HAS a source-less in-edge (SATISFIED) and no PENDING real-source in-edge — the
			// combination the original argument said was impossible.
			expect(
				(c.plan.transitions ?? []).some((t) => t.sourceStepId === undefined),
				c.why
			).toBe(true);
			expect(startableStepIds(c.plan), c.why).toEqual([]);
		}
	});

	it('THE MECHANISM: incoherence and the live-set seed share ONE entry definition', () => {
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
