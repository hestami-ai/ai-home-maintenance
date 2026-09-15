// ⭐⭐ THE RECORD PLANE'S STRUCTURAL BOUNDS, DRIVEN WITH THE VECTORS THAT DEFEATED THE CLAIM THEY REPLACE.
//
// `R11` said of `ObservedToolCall.toolName`: *"a minted name is drawn from a closed set the HOST authored and
// cannot carry model-chosen content"*, and of `calls`: *"BOUNDED: capped at 32"*. ⛔ Neither was a property of
// the record. An independent review drove a host absolute path, a username-bearing path, a credentials-shaped
// string, a NUL byte and a 200KB blob straight into a PERMANENT record, and 64 calls declaring their own limit
// of 64 alongside them. Every vector below is one of THOSE, not one I invented afterwards — a repaired guard
// tested with a gentler input than the one that broke it proves nothing about the break.
//
// ⚠ THE FIELD-LEVEL DRIVES LIVE IN `rph-application/src/handlers/model-exchange.test.ts`, where the vectors go
// through `Engine.dispatch` and meet the real boundary. These are the UNIT drives of the predicate itself, so a
// change to the character class or the length is attributable HERE rather than only through a handler.
import { describe, expect, it } from 'vitest';

import { z } from 'zod';

import {
	boundedObservedToolCallList,
	OBSERVED_TOOL_CALL_LIMIT,
	RecordPlaneNameSchema,
	RecordPlaneProseSchema
} from './record-plane-bounds.js';

/** The reviewer's own vectors. ⛔ Verbatim, including the NUL, which is why this is a computed string. */
const HOST_PATH = 'C:\\Users\\mchen\\AppData\\Local\\Temp\\claude\\secret';
const USERNAME_PATH = '/home/mchen/.ssh/id_rsa';
const CREDENTIALS = 'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
const NUL_BEARING = `run${String.fromCharCode(0)}command`;
const BLOB_200KB = 'x'.repeat(200 * 1024);

describe('RecordPlaneNameSchema — a NAME, bounded by shape rather than by a caller’s honesty', () => {
	// ⭐ THE FIVE THAT WERE ACCEPTED. THE MUTANT: drop the `.regex(...)` and keep the `.max(...)`. Four of the
	// five still redden on length alone — and `HOST_PATH`, `USERNAME_PATH`, `CREDENTIALS` and `NUL_BEARING` all
	// fit inside 64 characters, so THEY are the four that would silently start passing again. The blob is the
	// one that cannot tell the two checks apart, which is why it is not the only case here.
	it.each([
		['a host absolute path', HOST_PATH],
		['a username-bearing path', USERNAME_PATH],
		['a credentials-shaped string', CREDENTIALS],
		['a NUL byte', NUL_BEARING],
		['a 200KB blob', BLOB_200KB]
	])('⛔ REFUSES %s', (_label, value) => {
		const parsed = RecordPlaneNameSchema.safeParse(value);
		expect(parsed.success, 'a permanent, unredactable record may not hold this').toBe(false);
	});

	it('⛔ and the refusal SAYS WHY, in terms a reader meets rather than a zod code', () => {
		// ⭐ THE MESSAGE IS THE ASSERTION, not the issue code. `too_big` and `invalid_format` are emitted by
		// every bounded string in this repository, so asserting a code would pass against a refusal that came
		// from somewhere else entirely — the `INVALID_VALUE` lesson (116 emitters, one code).
		const long = RecordPlaneNameSchema.safeParse(BLOB_200KB);
		expect(long.success).toBe(false);
		expect(long.error!.issues[0]!.message).toContain('bounded at 64 characters');

		const shaped = RecordPlaneNameSchema.safeParse(HOST_PATH);
		expect(shaped.success).toBe(false);
		expect(shaped.error!.issues[0]!.message).toContain('must be spelled as a name');
	});

	// ⭑ THE CONTROL NEEDS ITS OWN MUTANT, or "the schema refuses bad names" is satisfied by a schema that
	// refuses every name. THE MUTANT: tighten the class to `^[a-z]+$`. Every refusal above stays green and this
	// reddens on `workProduct` and `run_command` — the only two names this repository actually writes.
	it.each([
		['the one sourceField any producer emits', 'workProduct'],
		['a conventional tool name', 'run_command'],
		['a dotted name', 'fs.read'],
		['a hyphenated name', 'write-file'],
		['exactly the length bound', 'a'.repeat(64)]
	])('⭑ CONTROL — ACCEPTS %s', (_label, value) => {
		expect(RecordPlaneNameSchema.safeParse(value).success).toBe(true);
	});

	it('⛔ REFUSES the empty string and a leading separator — a name that starts with punctuation is a fragment', () => {
		expect(RecordPlaneNameSchema.safeParse('').success).toBe(false);
		expect(RecordPlaneNameSchema.safeParse('_hidden').success).toBe(false);
		expect(RecordPlaneNameSchema.safeParse('a'.repeat(65)).success, 'one over the bound').toBe(
			false
		);
	});
});

describe('RecordPlaneProseSchema — host-authored prose, BOUNDED, and honest about what it does not check', () => {
	it.each([
		['a NUL byte', NUL_BEARING],
		['a 200KB blob', BLOB_200KB]
	])('⛔ REFUSES %s', (_label, value) => {
		expect(RecordPlaneProseSchema.safeParse(value).success).toBe(false);
	});

	it('⚠ DISCLOSED — a host path and a credentials string ARE accepted, and that is the bound’s stated limit', () => {
		// ⛔ THIS TEST PINS A WEAKNESS ON PURPOSE, the way `P2B-ar` pinned `W1`'s. The alternative — a predicate
		// that decides whether prose "looks like a path" — is a normaliser over an arbitrary string, which is
		// exactly the shape this programme refused in Phase 2b, and it would refuse legitimate prose: the live
		// `pi-executor` reason quotes `noTools:'builtin'` and `customTools:[]`.
		//
		// ⭑ WHAT WARRANTS THE CONTENT IS THAT ITS AUTHOR IS THE HOST — every producer of a `reason` in this
		// repository writes a string literal authored here and none interpolates model output — and that is a
		// PRODUCER property the boundary does not verify. Written down as a passing assertion so that a future
		// change which strengthens it must come here and say so, rather than quietly making the disclosure stale.
		expect(RecordPlaneProseSchema.safeParse(HOST_PATH).success).toBe(true);
		expect(RecordPlaneProseSchema.safeParse(CREDENTIALS).success).toBe(true);
	});

	it('⭑ CONTROL — real prose is accepted, line breaks and all', () => {
		// THE MUTANT: drop the `[\t\n\r]` alternative, so every Unicode control character is refused. This
		// reddens; every refusal above stays green, which is what separates "no controls" from "no prose".
		expect(
			RecordPlaneProseSchema.safeParse(
				'The model call failed.\n\tNothing was in a position to observe.'
			).success
		).toBe(true);
		expect(
			RecordPlaneProseSchema.safeParse('x'.repeat(4096).concat('')).success,
			'at the bound'
		).toBe(true);
		expect(RecordPlaneProseSchema.safeParse('x'.repeat(4097)).success, 'one over it').toBe(false);
	});
});

describe('the observed-tool-call list — the bound the CONTRACT enforces, not the one a caller declares', () => {
	const list = boundedObservedToolCallList(z.string());

	it('⛔ REFUSES a list longer than the bound, and the refusal says whose bound it is', () => {
		// ⭐⭐ W1's WHOLE FINDING IS IN THE MESSAGE. R11 announced the cap and the handler compared the list against
		// `recordedLimit` — a number the CALLER writes — so 64 calls declaring 64 were ACCEPTED. A refusal that said
		// only "too big" would leave the next reader to rediscover which of the two numbers actually bound them.
		const parsed = list.safeParse(Array.from({ length: OBSERVED_TOOL_CALL_LIMIT + 1 }, () => 'x'));
		expect(parsed.success).toBe(false);
		expect(parsed.error!.issues[0]!.message).toContain('bounded at 32 entries by the CONTRACT');
		expect(
			parsed.error!.issues[0]!.message,
			'and it must say that a self-declared recordedLimit cannot raise it'
		).toContain('self-declared recordedLimit cannot raise it');
	});

	it('⭑ CONTROL — exactly the bound is ACCEPTED, so this is a cap and not a refusal of lists', () => {
		// THE MUTANT: `.max(OBSERVED_TOOL_CALL_LIMIT - 1, …)`. The refusal above stays green and this reddens.
		expect(
			list.safeParse(Array.from({ length: OBSERVED_TOOL_CALL_LIMIT }, () => 'x')).success
		).toBe(true);
	});

	it('the number is PINNED, because a permanent record’s declared bound is measured against it', () => {
		// ⭑ `recordedLimit` is written into records nothing can ever rewrite, so moving this number changes what
		// every already-stored exchange's declared bound means. It may not move without someone coming here.
		expect(OBSERVED_TOOL_CALL_LIMIT).toBe(32);
	});
});
