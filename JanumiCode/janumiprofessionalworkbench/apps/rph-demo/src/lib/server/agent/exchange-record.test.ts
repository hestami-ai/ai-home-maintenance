// ICP-02 — the PER-9 exchange record, adopted from `ModelExchangeRecord` rather than derived.
//
// Every test here corresponds to a limb the adoption decision took DELIBERATELY, and each names the mutant it
// exists to catch. The three the roadmap owes are the first three; the rest guard adoption choices that would
// otherwise be dropped silently (an absent union arm and an absent enum member look exactly like a simpler
// design until the day they are needed).
import { describe, expect, it } from 'vitest';
import {
	beginExchange,
	unsatisfiedElements,
	type ExchangeRecord
} from './exchange-record.js';

const MODEL = { modelId: 'gemini-2.5-pro', providerId: 'google' };

function initial(): ExchangeRecord {
	return beginExchange({ exchangeId: 'exch-1', role: 'initial', model: MODEL, ...TRY_FACTS });
}

// The per-try facts PER-9 requires and only the caller can know: where this try sits in its run, and the
// occurrence times bracketing the model call. They are REQUIRED rather than optional because an absent
// ordinal or an absent time is not "unknown" — it is a record that cannot be ordered or reconciled, which is
// the record-plane omission PER-9 forbids. Fixed values here so the gate is not wall-clock dependent.
const TRY_FACTS = {
	attemptOrdinal: 1,
	requestedAt: '2026-09-03T10:00:00Z',
	respondedAt: '2026-09-03T10:00:01Z'
};

describe('ICP-02 · exchange record — PER-9-a: the TRY is the unit', () => {
	it('a repair produces a SECOND record that names its predecessor', () => {
		const first = initial();
		const repair = beginExchange({
			exchangeId: 'exch-2',
			role: 'repair',
			predecessor: first,
			model: MODEL, ...TRY_FACTS
		});

		// THE MUTANT: emit one record per turn. PER-9 counts TRIES — "each retry, reformat, and repair request
		// included" — and reasoning-review-validator.ts runs two print() calls on every repair path today.
		expect(repair.exchangeRole).toBe('repair');
		expect(repair.predecessorExchangeId).toBe('exch-1');
		expect(repair.exchangeId).not.toBe(first.exchangeId);
	});

	it('building a repair does NOT mutate its predecessor', () => {
		const first = initial();
		const before = JSON.stringify(first);

		beginExchange({
			exchangeId: 'exch-2',
			role: 'repair',
			predecessor: first,
			model: MODEL, ...TRY_FACTS
		});

		// THE MUTANT: reassign the predecessor's output the way `raw = await print(...)` does at
		// reasoning-review-validator.ts:180. CSAA-007 states the rule this asserts: "Repair never rewrites
		// predecessor raw output."
		expect(JSON.stringify(first)).toBe(before);
	});

	it('a FINGERPRINT does not satisfy the record — E-1 stays unsatisfied', () => {
		const rec = beginExchange({
			exchangeId: 'exch-1',
			role: 'initial',
			model: MODEL, ...TRY_FACTS,
			promptTemplateFingerprint: 'sha256:deadbeef'
		});

		// THE MUTANT: treat a present fingerprint as satisfying the materialized input. PER-9 forecloses it by
		// name — "A prompt or template fingerprint identifies that record; it never substitutes for it" — and
		// this is the exact substitution REG-F-314's byte-count manifest proposed.
		expect(rec.promptTemplateFingerprint).toBe('sha256:deadbeef');
		expect(unsatisfiedElements(rec)).toContain('E-1');
	});

	it('a non-initial role REQUIRES a predecessor, and initial forbids one', () => {
		expect(() =>
			beginExchange({ exchangeId: 'x', role: 'retry', model: MODEL, ...TRY_FACTS })
		).toThrow(/predecessor/i);
		expect(() =>
			beginExchange({ exchangeId: 'x', role: 'initial', predecessor: initial(), model: MODEL, ...TRY_FACTS })
		).toThrow(/initial/i);
	});

	it('an UNREPORTED model identity is STATABLE with a rationale, not merely absent', () => {
		const rec = beginExchange({
			exchangeId: 'exch-1',
			role: 'initial',
			model: { unavailable: 'unreported', rationale: 'provider returned no model header' },
			...TRY_FACTS
		});

		// THE MUTANT: drop the union's second arm and let identity be optional. PER-12: availability is
		// "provider- and configuration-dependent". An absent field cannot distinguish "not reported" from
		// "nobody looked" — which is this repository's most-recorded defect, in a field.
		expect(rec.resolvedModelIdentity).toEqual({
			kind: 'unreported',
			rationale: 'provider returned no model header'
		});
		expect(unsatisfiedElements(rec)).not.toContain('E-3');
	});

	it('truncation defaults to UNKNOWN, never to none-declared', () => {
		// THE MUTANT: default `truncationState` to 'none-declared'. That asserts a fact nobody established —
		// exactly finding #61, where truncation is declared only inside a prompt string that is thrown away.
		// "Unknown" is how an unobtained answer is stated rather than guessed.
		expect(initial().truncationState).toBe('unknown');
	});

	it('reports every PER-9 element the record cannot yet satisfy, so the gap is DISCLOSED', () => {
		const un = unsatisfiedElements(initial());
		// E-1/E-2/E-6 are content, blocked behind ICP-03's purgeable plane; E-4/E-5 are unset until the try
		// completes. E-3 is satisfied because the model resolved.
		expect(un).toEqual(expect.arrayContaining(['E-1', 'E-2', 'E-6']));
		expect(un).not.toContain('E-3');
	});
});
