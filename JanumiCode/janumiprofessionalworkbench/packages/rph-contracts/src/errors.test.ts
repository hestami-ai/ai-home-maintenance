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
	it('exposes exactly the 15 canonical RPH_* error codes', () => {
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
});
