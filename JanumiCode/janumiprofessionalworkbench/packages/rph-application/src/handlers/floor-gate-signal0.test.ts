// stepOutputIsAiProduced signal-0: the AUTHORITATIVE aiProduced read off the now-contracted ExecutionProvenance
// (§16 item 23 filled under §0.3). These assertions isolate the case the three heuristics CANNOT express — a step
// that is neither a MODEL_INVOCATION, nor completed by an AGENT/MODEL, nor bound to a runtime, yet whose recorded
// provenance says an AI/agent produced or materially shaped it (§8.4 L841). Before signal 0 that step was invisible
// to the gate and admitted itself; now provenance catches it. Signal 0 is positive-only (OR): it may RAISE
// aiProduced but never clear a heuristic that fired, so an absent/human provenance keeps the prior behavior.
import type { ActorType } from '@janumipwb/rph-contracts';
import { ActorTypeSchema } from '@janumipwb/rph-contracts';
import type { HandlerContext } from './kit.js';
import { describe, expect, it } from 'vitest';
import { stepOutputIsAiProduced } from './floor-gate.js';

// Only ctx.store.loadObject is touched (the runtime-binding heuristic); return undefined so no binding is "found".
const ctx = { store: { loadObject: () => undefined } } as unknown as HandlerContext;
const human = { issuedBy: { actorType: 'HUMAN' } };
// A step invisible to all three heuristics: not a MODEL_INVOCATION, no runtimeBindingId.
const plainStep = { stepType: 'TRANSFORMATION' };
const agent = { actorId: 'a-1', actorType: 'AGENT' as const, displayName: 'Agent' };

describe('stepOutputIsAiProduced — signal 0 (contracted ExecutionProvenance)', () => {
	it('fires on originType MODEL_GENERATION/TOOL_OUTPUT even when no heuristic does', () => {
		expect(stepOutputIsAiProduced(ctx, plainStep, human, { originType: 'MODEL_GENERATION' })).toBe(
			true
		);
		expect(stepOutputIsAiProduced(ctx, plainStep, human, { originType: 'TOOL_OUTPUT' })).toBe(true);
	});

	it('fires on an AGENT/MODEL executedBy even when no heuristic does', () => {
		expect(stepOutputIsAiProduced(ctx, plainStep, human, { executedBy: agent })).toBe(true);
	});

	it('is positive-only: absent provenance falls through to the heuristics (here none fire => false)', () => {
		expect(stepOutputIsAiProduced(ctx, plainStep, human, undefined)).toBe(false);
		expect(stepOutputIsAiProduced(ctx, plainStep, human)).toBe(false);
	});

	it('a human/neither origin does NOT force AI-produced (provenance can raise, never lower)', () => {
		expect(stepOutputIsAiProduced(ctx, plainStep, human, { originType: 'HUMAN_DECISION' })).toBe(
			false
		);
		expect(stepOutputIsAiProduced(ctx, plainStep, human, { originType: 'USER_INPUT' })).toBe(false);
		// MIGRATION/DERIVED/IMPORTED are neither direct-human nor direct-AI — not treated as AI-produced.
		expect(stepOutputIsAiProduced(ctx, plainStep, human, { originType: 'DERIVED' })).toBe(false);
	});

	it('is monotonic: a heuristic that fired stays fired even under a human provenance', () => {
		// MODEL_INVOCATION (signal 1) fires; a USER_INPUT provenance must not clear it.
		expect(
			stepOutputIsAiProduced(ctx, { stepType: 'MODEL_INVOCATION' }, human, {
				originType: 'USER_INPUT'
			})
		).toBe(true);
	});
});

// ── JAN-PFA S3.3 — `AI_ACTOR_TYPES` PARTITIONS THE RATIFIED `ActorType` ENUM; IT IS NOT ONE MEMBER OF IT ─────
//
// THE PROMISE, in floor-gate.ts's own words at the declaration: *"A subject is AI-produced (floor-relevant) when
// its producing actor is an AGENT or MODEL."* That quantifies over EVERY `actorType` the contract admits — two
// raise the §8.4 de minimis floor and the rest do not — and the battery above pins exactly ONE of the six.
//
// ⚠ MEASURED, NOT ARGUED. With every assertion above green, `new Set(['AGENT'])` SURVIVED: MODEL — the actor
// type that names a model invocation, the single population §8.4 exists to catch — was asserted NOWHERE in this
// repository to raise the floor. The two tests that do hand a MODEL actor to this path
// (`execution-floor-gate-ai.test.ts`, `execution-floor-zero-subject.test.ts`) also set
// `originType: 'MODEL_GENERATION'` and `stepType: 'MODEL_INVOCATION'`, so signals 0-origin and 1 fire on their
// own and the arrangement is blind to the actor limb.
//
// ⛔ THE SWEEP IS DERIVED FROM `ActorTypeSchema.options` — the ratified enum, owned by rph-contracts — AND NOT
// FROM `AI_ACTOR_TYPES`. Deriving it from the constant under test would shrink the sweep along with the mutant
// and pass every narrowing of it, which is the exact vacuity this file is being strengthened to remove. The AI
// pair is written out below because it IS the promise under assertion; a new `actorType` joins both arms
// automatically and has to be classified deliberately rather than silently omitted.
describe('AI_ACTOR_TYPES — the promise stated over the whole ratified ActorType enum', () => {
	/** Quoted from the declaration's docblock: "its producing actor is an AGENT or MODEL". */
	const AI_PRODUCING: ReadonlySet<string> = new Set(['AGENT', 'MODEL']);
	const producedBy = (actorType: ActorType): boolean =>
		stepOutputIsAiProduced(ctx, plainStep, human, {
			executedBy: { actorId: 'p-1', actorType, displayName: 'Producer' }
		});

	it('RAISES the floor for EVERY AI-producing actorType — each of them, not one of them', () => {
		const ai = ActorTypeSchema.options.filter((t) => AI_PRODUCING.has(t));
		expect(
			ai,
			'the promise names two AI-producing actor types; the ratified enum must still carry both'
		).toEqual(['AGENT', 'MODEL']);
		for (const actorType of ai)
			expect(
				producedBy(actorType),
				`executedBy.actorType ${actorType}: floor-gate.ts promises a subject is AI-produced when its ` +
					`producing actor is an AGENT or MODEL, so a step ${actorType} produced must raise the §8.4 floor — ` +
					`this member of the set is not required by any other assertion`
			).toBe(true);
	});

	// ── CONTROL: THE SET STILL ADMITS THE ACTORS THAT ARE NOT AI ──────────────────────────────────────────────
	// Without this the row above is satisfied by a predicate that answers TRUE for everything — which would refuse
	// every human-authored publish and every human-completed step at the floor gate, and would read as precision.
	// ⭑ ITS OWN MUTANT IS SITED AND MEASURED, because a control that cannot fail proves nothing. Widening signal
	// 0's actor read — `if (prov.executedBy && AI_ACTOR_TYPES.has(prov.executedBy.actorType)) return true;` ->
	// `if (prov.executedBy) return true;` — reddens THIS test on all four non-AI members and NOTHING ELSE in
	// this file: 1 failed | 6 passed, the row above included. (Widening the SET instead, to
	// `new Set(['AGENT', 'MODEL', 'HUMAN'])`, also reddens it but takes two heuristic-2 rows with it, so it
	// does not tell this control apart from its neighbours.)
	it('CONTROL — does NOT raise the floor for any other actorType the contract admits', () => {
		const notAi = ActorTypeSchema.options.filter((t) => !AI_PRODUCING.has(t));
		expect(
			notAi.length,
			'the control is vacuous unless the ratified enum carries actor types that are NOT AI-producing'
		).toBeGreaterThan(0);
		for (const actorType of notAi)
			expect(
				producedBy(actorType),
				`executedBy.actorType ${actorType}: it is neither an AGENT nor a MODEL, so signal 0 must stay silent ` +
					`and the caller must fall through to the heuristics — a floor that fires on ${actorType} refuses ` +
					`legitimate human work`
			).toBe(false);
	});
});
