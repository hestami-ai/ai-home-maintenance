// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D76 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.30; `REG-D-166` (4); `REG-D-016`) — A CHAPTER OF THE
// LOOP'S NARRATIVE MEMORY: the writer's prompt, the reader of its answer, and the deterministic check it must pass, with no repair.
//
// ⭑ WHAT MUST HOLD (D76; the lead's rulings on readings 1, 13 and 14): the writer is given the records since the last chapter, each with its id, and
// the previous chapter; it answers one JSON object in the chapter's form; the check is that it parses, that each statement cites at least one id,
// and that every cited id is among the records it was given — each failed limb named. The stand-in writer, test mode's alone, restates each record
// and passes the check. The chapter's place in the stage — first, recorded, a failing one recorded as failing — is `assurance-stage.route.test.ts`'s.
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { describe, expect, it } from 'vitest';
import {
	CHAPTER_FORM,
	checkNarrativeChapter,
	narrativeChapterPrompt,
	readNarrativeChapter,
	standInChapter,
	triedAnswerLine,
	type ChapterRecord
} from './narrative-chapter.js';

const RECORDS: readonly ChapterRecord[] = [
	{ id: 'pwu_src', text: 'work unit "Source": lifecycle SATISFIED, execution SUCCEEDED, assurance SATISFIED' },
	{ id: 'asm_cov', text: 'assessment under pol_requirement_coverage of "Verification" (pwu_ver): REJECTED; criteria not met: RC-01 NOT_MET — a pipe is not read' }
];
const GIVEN = new Set(RECORDS.map((r) => r.id));
const UNDERTAKING = { objective: 'Count the words of a text.', intendedOutputProduct: 'A word-frequency tool.' };

describe('⭐⭐ L17b1 (D76) — the writer’s prompt', () => {
	it('⛔ RED FIRST — it holds the discipline, the Undertaking’s statement, the previous chapter, each record with its id, and the form', () => {
		const prompt = narrativeChapterPrompt({
			number: 2,
			undertaking: UNDERTAKING,
			previous: { id: 'art_ch1', failing: false, statements: [{ text: 'Source was accepted.', cites: ['pwu_src'] }] },
			records: RECORDS
		});

		for (const part of [
			'You are writing chapter 2 of the narrative memory',
			'You are not the worker and not the judge of the work.',
			"The Undertaking's objective: Count the words of a text.",
			'keep qualifiers; keep competing viewpoints apart; never imply a position was stable if it changed; cite every',
			'The previous chapter (art_ch1):\n- Source was accepted. [pwu_src]',
			'The records since the previous chapter, each with its id:\n- [pwu_src] work unit "Source"',
			'- [asm_cov] assessment under pol_requirement_coverage',
			CHAPTER_FORM,
			'Every statement must cite at least one id, and only ids from the records above.'
		])
			expect(prompt, `the writer’s prompt does not hold: ${part}`).toContain(part);
	});

	it('⛔ RED FIRST — the first chapter covers the Undertaking from its creation; a previous chapter that failed its check is not given', () => {
		const first = narrativeChapterPrompt({ number: 1, undertaking: UNDERTAKING, previous: undefined, records: RECORDS });
		const afterFailing = narrativeChapterPrompt({ number: 2, undertaking: UNDERTAKING, previous: { id: 'art_ch1', failing: true, statements: [] }, records: [] });

		expect(first, 'the first chapter is not said to cover the Undertaking from its creation').toContain(
			'There is no previous chapter: this one covers the Undertaking from its creation.'
		);
		expect(afterFailing, 'a failing previous chapter was given').toContain(
			'The previous chapter (art_ch1) failed its check, so it is not given here: write from the records.'
		);
		expect(afterFailing, 'no records is not said').toContain('- (none)');
	});
});

describe('⭐⭐ L17b1 (D76) — the answer read, and its deterministic check', () => {
	const ANSWER = JSON.stringify({
		chapter: 2,
		covers: ['pwu_src', 'asm_cov'],
		statements: [
			{ text: 'Source was accepted.', cites: ['pwu_src'] },
			{ text: 'Verification was rejected for a pipe the reader cannot read.', cites: ['asm_cov', 'pwu_src'] }
		],
		openItems: ['whether the reader or the harness holds the fault'],
		knownOmissions: ['the Lint unit, untouched'],
		previousChapter: 'art_ch1'
	});

	it('⛔ RED FIRST — the reader reads the answer into the chapter’s form, a code fence allowed', () => {
		const read = readNarrativeChapter(`\`\`\`json\n${ANSWER}\n\`\`\``);
		expect(read, 'the answer is not read into its form').toEqual({
			ok: true,
			chapter: {
				chapter: 2,
				covers: ['pwu_src', 'asm_cov'],
				statements: [
					{ text: 'Source was accepted.', cites: ['pwu_src'] },
					{ text: 'Verification was rejected for a pipe the reader cannot read.', cites: ['asm_cov', 'pwu_src'] }
				],
				openItems: ['whether the reader or the harness holds the fault'],
				knownOmissions: ['the Lint unit, untouched'],
				previousChapter: 'art_ch1'
			}
		});
		expect(readNarrativeChapter('Here is the chapter.'), 'prose was read as a chapter').toEqual({
			ok: false,
			why: 'the answer does not parse as one JSON object'
		});
		expect(readNarrativeChapter('{"chapter": 1}'), 'an object with no statements was read as a chapter').toEqual({
			ok: false,
			why: 'it holds no list of statements'
		});
	});

	it('⛔ RED FIRST — the check passes a chapter whose every statement cites only records it was given', () => {
		expect(checkNarrativeChapter(ANSWER, GIVEN).failures, 'a sound chapter failed its check').toEqual([]);
	});

	it('⛔ RED FIRST — each failed limb named: a statement that cites nothing, a cited id not among those given, an answer that does not parse', () => {
		const failing = JSON.stringify({
			chapter: 2,
			statements: [
				{ text: 'Something happened.', cites: [] },
				{ text: 'The harness is at fault.', cites: ['asm_cov', 'art_invented'] }
			]
		});
		expect(checkNarrativeChapter(failing, GIVEN).failures, 'the limbs are not each named').toEqual([
			'statement 1 cites no record',
			'statement 2 cites art_invented, which is not among the records it was given'
		]);
		expect(checkNarrativeChapter('not a chapter', GIVEN).failures, 'an answer that does not parse is not named').toEqual([
			'the answer does not parse as one JSON object'
		]);
	});

	it('⭑ CONTROL — the stand-in writer’s chapter, one statement per record citing it, passes the check', () => {
		const stood = checkNarrativeChapter(standInChapter(1, RECORDS, null), GIVEN);
		expect([stood.failures, stood.statements.length], 'the stand-in’s chapter fails its own check').toEqual([[], RECORDS.length]);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 7 (§16; the independent review's L17C-07) — THE WRITER'S ANSWER LINE OF AN EXECUTOR TRY
// (`triedAnswerLine`, what follows "its answer: " in the try's record): `none recorded` only where neither answer reference is `STORED`; where one is
// and nothing verifies, the line says the answer could not be read, and why; the verified answer span still stands in for a raw output that does not
// verify. Each over an in-memory content store and an exchange's state, as the record holds them.
describe('⭐⭐ L17b3 (D89; the lead’s ruling 7) — the writer’s answer line of an executor try', () => {
	const TENANT = 'tnt-test';
	async function storedRef(store: ReturnType<typeof createInMemoryArtifactStore>, bytes: string) {
		const ref = await store.put({ tenantPrefix: TENANT, bytes, mediaType: 'text/plain', purgeability: 'RETAINED_BY_PARTICIPATION' });
		return { status: 'STORED', storageKey: ref.storageKey, contentHash: ref.contentHash, byteSize: ref.byteSize };
	}
	const NOT_STORED = { status: 'NOT_CAPTURED', reason: 'no answer bytes arrived' };

	it('⛔ RED FIRST — a recorded answer that cannot be read is said to be unreadable, and why — its bytes missing, or not matching their hash — never “none recorded” (the lead’s ruling 7)', async () => {
		const store = createInMemoryArtifactStore();
		const raw = await storedRef(store, 'The raw output, whole.');
		const missing = { ...raw, storageKey: 'no-such-key' };
		const tampered = { ...raw, contentHash: `sha256:${'0'.repeat(64)}` };
		const lines = [
			await triedAnswerLine(store, { rawOutputBeforeCoercionRef: missing, answerSpanRef: NOT_STORED }),
			await triedAnswerLine(store, { rawOutputBeforeCoercionRef: tampered, answerSpanRef: NOT_STORED }),
			await triedAnswerLine(store, { rawOutputBeforeCoercionRef: NOT_STORED, answerSpanRef: tampered }),
			await triedAnswerLine(store, { rawOutputBeforeCoercionRef: missing, answerSpanRef: tampered })
		];
		expect(lines.map((l) => l.startsWith('it could not be read: ')), 'a recorded answer that cannot be read was not said to be unreadable').toEqual([true, true, true, true]);
		expect(
			[lines[0]!.includes('are not in the content store'), lines[1]!.includes('not the sha256:'), lines[2]!.includes('not the sha256:'), lines[3]!.includes('; ')],
			'the line does not say why the answer could not be read'
		).toEqual([true, true, true, true]);
	});

	it('⭑ CONTROL — neither answer reference stored is “none recorded”; a raw output that verifies is the answer; one that does not falls back to an answer span that does (the lead’s ruling 7)', async () => {
		const store = createInMemoryArtifactStore();
		const raw = await storedRef(store, 'The raw output, whole.');
		const span = await storedRef(store, 'The answer span.');
		const tampered = { ...raw, contentHash: `sha256:${'0'.repeat(64)}` };
		expect(
			[
				await triedAnswerLine(store, { rawOutputBeforeCoercionRef: NOT_STORED, answerSpanRef: NOT_STORED }),
				await triedAnswerLine(store, {}),
				await triedAnswerLine(store, { rawOutputBeforeCoercionRef: raw, answerSpanRef: span }),
				await triedAnswerLine(store, { rawOutputBeforeCoercionRef: tampered, answerSpanRef: span })
			],
			'an answer line moved'
		).toEqual(['none recorded', 'none recorded', 'The raw output, whole.', 'The answer span.']);
	});

	// ⭐ L17b3 — the lead's ruling 5 of §23 (the lead's O-2) — ~~a reference not STORED, or STORED without a key or a hash, passed over~~: only one not
	// STORED is passed over; a STORED one that names no storage key or content hash cannot be read, and the line says so.
	it('⛔ RED FIRST — a recorded answer whose reference is STORED but names no storage key or content hash cannot be read, and the line says so — never “none recorded” (the lead’s ruling 5 of §23)', async () => {
		const store = createInMemoryArtifactStore();
		const raw = await storedRef(store, 'The raw output, whole.');
		const lines = [
			await triedAnswerLine(store, { rawOutputBeforeCoercionRef: { status: 'STORED' }, answerSpanRef: NOT_STORED }),
			await triedAnswerLine(store, { rawOutputBeforeCoercionRef: { status: 'STORED', storageKey: raw.storageKey }, answerSpanRef: NOT_STORED })
		];
		expect(lines.map((l) => l.startsWith('it could not be read: ')), 'a STORED reference that names no key or hash was passed over').toEqual([true, true]);
		expect(
			[lines[0]!.includes('no storage key and no content hash'), lines[1]!.includes('names no content hash')],
			'the line does not say what the reference fails to name'
		).toEqual([true, true]);
	});
});
