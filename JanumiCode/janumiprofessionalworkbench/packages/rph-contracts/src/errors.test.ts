import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	ERROR_CODE_CATEGORY,
	makeRphError,
	RphErrorCodeSchema,
	RphErrorException,
	RphErrorSchema
} from './errors.js';
import { RphErrorCategorySchema } from './enums.js';

const vocab = JSON.parse(
	readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), '..', 'vocab', 'canonical-vocabulary.json'),
		'utf8'
	)
) as { errorCodes: { code: string }[] };

describe('errors', () => {
	it('exposes exactly the RPH_* error codes the vocabulary declares — no more, no fewer', () => {
		const canonical = vocab.errorCodes.map((e) => e.code).filter((c) => c.startsWith('RPH_'));
		expect([...RphErrorCodeSchema.options].sort()).toEqual([...canonical].sort());
	});

	it('maps every code to a valid category', () => {
		for (const code of RphErrorCodeSchema.options) {
			expect(RphErrorCategorySchema.options).toContain(ERROR_CODE_CATEGORY[code]);
		}
	});

	it('makeRphError fills category from the mapping + safe defaults', () => {
		const e = makeRphError('RPH_REVISION_CONFLICT', { message: 'stale', correlationId: 'c1' });
		expect(e.category).toBe('CONCURRENCY');
		expect(e.retryable).toBe(false);
		expect(e.targetObjectIds).toEqual([]);
		expect(RphErrorSchema.safeParse(e).success).toBe(true);
	});

	it('RphErrorException carries the structured error payload', () => {
		const e = makeRphError('RPH_INVARIANT_VIOLATION', { message: 'boom', correlationId: 'c1' });
		const ex = new RphErrorException(e);
		expect(ex.error).toBe(e);
		expect(ex.message).toContain('RPH_INVARIANT_VIOLATION');
		expect(ex).toBeInstanceOf(Error);
	});

	// ── JAN-PFA S0.3 — THE SHAPE IS CLOSED, AND NOTHING ASSERTED IT UNTIL 2026-09-12 ──────────────────────
	//
	// WHY THIS EXISTS. The pilot widened `z.strictObject` to `z.object` and the mutation survived the ENTIRE
	// suite — 358 files, 3,614 tests, zero failures — in a file at 100% BRANCH COVERAGE. Every existing
	// assertion above checks what the schema ACCEPTS; strictness is only observable in what it REFUSES, and
	// nothing asked. ⭑ A cleaner demonstration that coverage counts execution rather than assertion is hard to
	// construct: the line was fully covered and its guarantee was entirely untested.
	//
	// WHAT IT PROTECTS. `RphError` is the serialized error carried in `CommandResult.error` and in event and
	// observation payloads, and it is PUBLISHED to clients as `schemas/objects/RphError.json`. Closed-to-unknown
	// -keys is the contract; widening it silently accepts untrusted extra fields at a boundary declared shut.
	//
	// ⚠ IT IS A DIFFERENTIAL — the SAME object, parsed twice, with one unknown key added. Asserting only the
	// rejection would also pass if the schema had become incapable of accepting anything at all.
	it('JAN-PFA S0.3: the error shape is CLOSED — an unknown key is refused, the same object without it is not', () => {
		const valid = makeRphError('RPH_REVISION_CONFLICT', { message: 'stale', correlationId: 'c1' });

		// ⭑ THE ADMITTING HALF. Without it, a schema that rejected everything would satisfy the refusal below.
		expect(
			RphErrorSchema.safeParse(valid).success,
			'the declared shape no longer parses an error this package itself constructed'
		).toBe(true);

		const withUnknownKey = { ...valid, attackerControlledField: 'smuggled' };
		expect(
			RphErrorSchema.safeParse(withUnknownKey).success,
			'RphErrorSchema accepted an unknown key — the published contract declares additionalProperties:false, so a boundary stated as closed is open'
		).toBe(false);
	});
});
