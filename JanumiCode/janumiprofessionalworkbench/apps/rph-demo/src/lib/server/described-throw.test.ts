// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — the lead's ruling (k) on the review's fifth re-check — THE ONE DESCRIBER OF A THROWN VALUE, AND THE ONE READER
// OF ITS CODE: neither can throw, whatever value is thrown.
//
// ⭑ WHAT MUST HOLD (the lead's ruling (k)): an `Error` is described by its message, any other value as a string; a value that cannot be described — the
// five the ruling names: an `Error`, a string, `Object.create(null)`, a revoked `Proxy`, an `Error` whose `message` getter throws — is said to be one,
// never a throw; and a code is read where a value carries one, none where it cannot be read.
import { describe, expect, it } from 'vitest';
import { describedThrow, thrownCode } from './described-throw.js';

/** The ruling's five values, in its order: an Error, a string, a value `String` cannot convert, a revoked Proxy, an Error whose message cannot be read. */
function theFiveValues(): readonly unknown[] {
	const revoked = Proxy.revocable(new Error('behind a proxy'), {});
	revoked.revoke();
	const unreadable = new Error('never read');
	Object.defineProperty(unreadable, 'message', {
		get: () => {
			throw new Error('the message cannot be read');
		}
	});
	return [new Error('the content store is read-only'), 'a string thrown', Object.create(null), revoked.proxy, unreadable];
}

describe('⭐⭐ L17b1 (the lead’s ruling (k)) — one describer of a thrown value, and one reader of its code; neither can throw', () => {
	it('⛔ RED FIRST — an Error is its message, a string itself; a value String cannot convert, a revoked Proxy and an Error whose message cannot be read are each said to be a thrown value that cannot be described', () => {
		expect(
			theFiveValues().map((v) => describedThrow(v)),
			'a thrown value was described wrongly, or describing it threw'
		).toEqual([
			'the content store is read-only',
			'a string thrown',
			'a thrown value that cannot be described',
			'a thrown value that cannot be described',
			'a thrown value that cannot be described'
		]);
	});

	it('⛔ RED FIRST — a code is read where a value carries one, as a string; none where it carries none, cannot be inspected, or carries one that cannot be described', () => {
		const coded = Object.assign(new Error('EISDIR: illegal operation on a directory, read'), { code: 'EISDIR' });
		expect(
			[coded, ...theFiveValues(), { code: Object.create(null) }].map((v) => thrownCode(v)),
			'a thrown value’s code was misread, or reading it threw'
		).toEqual(['EISDIR', undefined, undefined, undefined, undefined, undefined, undefined]);
	});
});
