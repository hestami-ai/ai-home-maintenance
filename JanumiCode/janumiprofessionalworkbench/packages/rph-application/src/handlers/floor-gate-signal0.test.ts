// stepOutputIsAiProduced signal-0: the AUTHORITATIVE aiProduced read off the now-contracted ExecutionProvenance
// (§16 item 23 filled under §0.3). These assertions isolate the case the three heuristics CANNOT express — a step
// that is neither a MODEL_INVOCATION, nor completed by an AGENT/MODEL, nor bound to a runtime, yet whose recorded
// provenance says an AI/agent produced or materially shaped it (§8.4 L841). Before signal 0 that step was invisible
// to the gate and admitted itself; now provenance catches it. Signal 0 is positive-only (OR): it may RAISE
// aiProduced but never clear a heuristic that fired, so an absent/human provenance keeps the prior behavior.
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
