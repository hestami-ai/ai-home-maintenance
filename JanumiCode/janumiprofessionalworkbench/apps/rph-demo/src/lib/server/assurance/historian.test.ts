// ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D73 with D86 (`REG-D-166` (2), (3), (6); `REG-D-167` (3); the lead's rulings 2, 9, 10,
// 19 and 22 on L17b2's Stage 0) — THE HISTORIAN'S PROMPT AND THE READER OF ITS ANSWER.
//
// ⭑ ITS PROMPT (D73, D86): built by a builder of its own over the STORED rubric, outside the reasoning-review validator, so the validator's
// framings and probes are unchanged: its policy's criteria, HC-01 to HC-05, in the policy's words; this sign-off's failed criteria and each
// earlier round's; the narrative memory so far; the folder's layout (`records/INDEX.md` first), with the request to check each claim against
// the copies, citing the file; and the answer's form, the policy's permitted actions named from the policy itself. ⛔ Not the reviewer's
// NO-TOOLS preamble: the Historian has read-only tools (D86).
// ⭑ ITS READER (D73; ruling 19): the declared review's parse first, unchanged — `extractJson`, then `coerceJudgement` — and then the
// Historian's two fields: `recurrence` (`{ recurs, statement, earlierRecords }`, the earlier records held to the ids it was given; one outside
// them left out and named in a finding, ruling 10) and `recommendedControlAction` (`{ action, reason } | null`, passed through as given, a
// non-string action as its JSON, so Gate B — not the reader — refuses an action outside the policy's list, ruling 22).
import { describe, expect, it } from 'vitest';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { coerceJudgement } from './reasoning-review-validator.js';
import { DEVIN_REVIEWER_PREAMBLE } from '../tools/devin-reviewer.js';
import { HISTORIAN_ANSWER_FORM, HISTORIAN_VALIDATOR_ID, historianPrompt, readHistorianAnswer } from './historian.js';

const SEEDED = ontology.seedPolicies.find((p) => p.policyId === 'pol_historical_consistency')!;
const CRITERIA = SEEDED.criteria as unknown as readonly AssessmentCriterion[];
const POLICY = {
	policyId: SEEDED.policyId,
	name: SEEDED.name,
	purpose: SEEDED.purpose,
	criteria: CRITERIA,
	permittedControlActions: [...SEEDED.permittedControlActions] as readonly string[]
};

const PROMPT_INPUT = {
	rejectedUnit: { id: 'pwu_verification', title: 'End-to-End Verification' },
	policy: POLICY,
	failedCriteria: [{ code: 'FP-02', statement: 'The tool cannot read standard input on any supported Node.' }],
	earlierRounds: [{ roundId: 'asm_round_one', failedCriteria: [{ code: 'FP-02', statement: 'The stdin mode fails.' }] }],
	narrative: [
		{ id: 'art_chapter_one', failing: false, statements: [{ text: 'Source Construction wrote the reader.', cites: ['asm_round_one'] }] },
		{ id: 'art_chapter_two', failing: true, statements: [] }
	],
	records: [
		{ file: 'asm_round_one.json', what: 'the first round’s rejecting verdict, with its criteria results' },
		{ file: 'source-construction--pwu_source.md', what: 'the recorded conversation of “Source Construction” (pwu_source)' }
	]
} as const;

describe('⭐⭐ L17b2 (D73, D86) — the Historian’s prompt, over the stored rubric', () => {
	it('⛔ RED FIRST — it holds its policy’s rubric, each criterion in the policy’s own words, and its validator id is its own', () => {
		const prompt = historianPrompt(PROMPT_INPUT);
		expect(CRITERIA.map((c) => c.id), 'arrangement: the seeded rubric').toEqual(['HC-01', 'HC-02', 'HC-03', 'HC-04', 'HC-05']);
		for (const c of CRITERIA) expect.soft(prompt, `${c.id} is not in the policy’s words`).toContain(`- ${c.id}: ${c.description}`);
		expect.soft(prompt, 'the policy’s purpose').toContain(SEEDED.purpose);
		expect.soft(HISTORIAN_VALIDATOR_ID).toBe('historian.historical-consistency');
	});

	it('⛔ RED FIRST — it holds this sign-off’s failed criteria and each earlier round’s, by code and statement', () => {
		const prompt = historianPrompt(PROMPT_INPUT);
		expect.soft(prompt).toContain('- FP-02: The tool cannot read standard input on any supported Node.');
		expect.soft(prompt, 'an earlier round is not named').toContain('asm_round_one');
		expect.soft(prompt).toContain('- FP-02: The stdin mode fails.');
	});

	it('⛔ RED FIRST — it holds the narrative memory so far: each chapter’s statements with the records they rest on, a failing chapter named', () => {
		const prompt = historianPrompt(PROMPT_INPUT);
		expect.soft(prompt).toContain('Chapter art_chapter_one:');
		expect.soft(prompt).toContain('- Source Construction wrote the reader. [asm_round_one]');
		expect.soft(prompt, 'a failing chapter is not named').toContain('Chapter art_chapter_two failed its check');
	});

	it('⛔ RED FIRST — it names its folder’s layout, the index of its records first, and asks it to check each claim against the copies, citing the file', () => {
		const prompt = historianPrompt(PROMPT_INPUT);
		expect.soft(prompt).toContain('records/INDEX.md');
		expect.soft(prompt).toContain('workspace/');
		for (const r of PROMPT_INPUT.records) expect.soft(prompt, `${r.file} is not named`).toContain(`records/${r.file}`);
		expect.soft(prompt).toContain('Check each claim you make against these copies, and cite the file it rests on.');
	});

	it('⛔ RED FIRST — it asks for the declared answer and the two fields of the Historian’s own, the permitted actions named from the policy, never another', () => {
		const prompt = historianPrompt(PROMPT_INPUT);
		expect.soft(prompt).toContain(HISTORIAN_ANSWER_FORM);
		for (const key of ['"findings"', '"criterionId"', '"failed"', '"recommendation"', '"residualUncertainty"', '"recurrence"', '"recurs"', '"earlierRecords"', '"recommendedControlAction"', '"action"', '"reason"'])
			expect.soft(HISTORIAN_ANSWER_FORM, `the form does not ask for ${key}`).toContain(key);
		for (const action of POLICY.permittedControlActions) expect.soft(prompt, `${action} is not named`).toContain(action);
		expect.soft(prompt, 'an action the policy does not permit is offered').not.toContain('CHANGE_MODEL');
	});

	it('⭑ CONTROL — it carries not the reviewer’s NO-TOOLS preamble: the Historian has read-only tools', () => {
		expect(historianPrompt(PROMPT_INPUT)).not.toContain(DEVIN_REVIEWER_PREAMBLE.split('\n')[0]!);
	});
});

const GIVEN = new Set(['asm_round_one', 'art_chapter_one']);
const answer = (extra: Record<string, unknown>): string =>
	JSON.stringify({
		findings: [
			{ criterionId: 'HC-02', failed: true, statement: 'The stdin defect of round one is back.' },
			{ criterionId: 'NOT-A-CRITERION', failed: true, statement: 'dropped by the declared parse' }
		],
		recommendation: 'CONDITIONALLY_SATISFIED',
		residualUncertainty: ['The second run’s logs were not read.'],
		...extra
	});

describe('⭐⭐ L17b2 (D73; rulings 10, 19, 22) — the Historian’s reader extends the declared parse', () => {
	it('⛔ RED FIRST — the declared parse first, unchanged: its rows as `coerceJudgement` reads them', () => {
		const text = answer({ recurrence: null, recommendedControlAction: null });
		const read = readHistorianAnswer(text, { criteria: CRITERIA, givenRecordIds: GIVEN });
		expect(read.ok, read.ok ? '' : read.why).toBe(true);
		if (!read.ok) return;
		expect(read.answer.judgement).toEqual(coerceJudgement(JSON.parse(text), { criteria: CRITERIA } as never));
	});

	it('⛔ RED FIRST — a recurrence is read where `recurs` is true, its earlier records held to those given; one outside them is left out and named', () => {
		const read = readHistorianAnswer(
			answer({ recurrence: { recurs: true, statement: 'Round one’s stdin failure is back.', earlierRecords: ['asm_round_one', 'asm_never_given'] } }),
			{ criteria: CRITERIA, givenRecordIds: GIVEN }
		);
		expect(read.ok).toBe(true);
		if (!read.ok) return;
		expect.soft(read.answer.recurrence).toEqual({ recurs: true, statement: 'Round one’s stdin failure is back.', earlierRecords: ['asm_round_one'] });
		expect.soft(read.answer.findings).toEqual([
			'the recurrence cites asm_never_given, which is not among the records the Historian was given, so it is left out (design D73)'
		]);
	});

	it('⛔ RED FIRST — no recurrence where `recurs` is false or the field is absent', () => {
		for (const extra of [{ recurrence: { recurs: false, statement: 'new', earlierRecords: [] } }, {}]) {
			const read = readHistorianAnswer(answer(extra), { criteria: CRITERIA, givenRecordIds: GIVEN });
			expect.soft(read.ok && read.answer.recurrence, JSON.stringify(extra)).toBeNull();
		}
	});

	it('⛔ RED FIRST — the recommended action passed through as given, each `{ action: <string>, reason }`: a permitted one, one outside the list, and a non-string as its JSON; none as null', () => {
		const actionOf = (rca: unknown) => {
			const read = readHistorianAnswer(answer({ recommendedControlAction: rca }), { criteria: CRITERIA, givenRecordIds: GIVEN });
			return read.ok ? read.answer.recommendedControlAction : 'NOT READ';
		};
		expect.soft(actionOf({ action: 'RESHAPE_PWU', reason: 'Build the reader and its test in parts.' })).toEqual({
			action: 'RESHAPE_PWU',
			reason: 'Build the reader and its test in parts.'
		});
		expect.soft(actionOf({ action: 'CHANGE_MODEL', reason: 'Try another model.' }), 'Gate B, not the reader, refuses it').toEqual({
			action: 'CHANGE_MODEL',
			reason: 'Try another model.'
		});
		expect.soft(actionOf({ action: 42 })).toEqual({ action: '42', reason: '' });
		expect.soft(actionOf(null)).toBeNull();
		expect.soft(actionOf(undefined)).toBeNull();
	});

	it('⛔ RED FIRST — an answer that does not parse is not read, and says why', () => {
		const read = readHistorianAnswer('I could not decide.', { criteria: CRITERIA, givenRecordIds: GIVEN });
		expect(read.ok).toBe(false);
		expect(read.ok ? '' : read.why).not.toBe('');
	});

	// ⭐⭐ L17b2, Stage 3b (the lead's §33, item 4; brief-3b item 2) — TESTS THE MUTANTS OWED: three limbs of the reader, each driven as a mutant first and
	// each SURVIVING every test — every answer above is bare JSON, cites each record once, and recommends an object, null or nothing.
	it('⛔ RED FIRST — an answer inside a Markdown code fence, or with words around its one object, is read as the bare answer is (the declared parse’s `extractJson`)', () => {
		const bare = answer({
			recurrence: { recurs: true, statement: 'Round one’s stdin failure is back.', earlierRecords: ['asm_round_one'] },
			recommendedControlAction: { action: 'RESHAPE_PWU', reason: 'Build the reader and its test in parts.' }
		});
		const want = readHistorianAnswer(bare, { criteria: CRITERIA, givenRecordIds: GIVEN });
		expect(want.ok && want.answer.recurrence?.earlierRecords, 'arrangement: the bare answer is read, its recurrence with it').toEqual(['asm_round_one']);
		for (const [how, text] of [
			['a json fence', `\`\`\`json\n${bare}\n\`\`\``],
			['a bare fence', `\`\`\`\n${bare}\n\`\`\``],
			['words around it', `Here is my answer:\n${bare}\nThat is all.`]
		] as const)
			expect.soft(readHistorianAnswer(text, { criteria: CRITERIA, givenRecordIds: GIVEN }), `${how}: not read as the bare answer is`).toEqual(want);
	});

	it('⛔ RED FIRST — a record the recurrence cites twice is kept once, in the order first given', () => {
		const read = readHistorianAnswer(
			answer({ recurrence: { recurs: true, statement: 'Round one’s stdin failure is back.', earlierRecords: ['asm_round_one', 'art_chapter_one', 'asm_round_one', 'art_chapter_one'] } }),
			{ criteria: CRITERIA, givenRecordIds: GIVEN }
		);
		expect(read.ok, read.ok ? '' : read.why).toBe(true);
		if (!read.ok) return;
		expect.soft(read.answer.recurrence?.earlierRecords, 'a record cited twice was kept twice').toEqual(['asm_round_one', 'art_chapter_one']);
		expect.soft(read.answer.findings, '⭑ CONTROL — a record it was given, cited twice, is named in a finding').toEqual([]);
	});

	it('⛔ RED FIRST — a recommendation that is not an object is carried as it was given, for Gate B to name: a word as itself; a number, a truth value and a list each as its JSON', () => {
		const actionOf = (rca: unknown) => {
			const read = readHistorianAnswer(answer({ recommendedControlAction: rca }), { criteria: CRITERIA, givenRecordIds: GIVEN });
			return read.ok ? read.answer.recommendedControlAction : 'NOT READ';
		};
		expect.soft(actionOf('RESHAPE_PWU'), 'a word recommended is not carried as itself').toEqual({ action: 'RESHAPE_PWU', reason: '' });
		expect.soft(actionOf(42), 'a number recommended is not carried as its JSON').toEqual({ action: '42', reason: '' });
		expect.soft(actionOf(true), 'a truth value recommended is not carried as its JSON').toEqual({ action: 'true', reason: '' });
		expect.soft(actionOf(['RESHAPE_PWU', 'CHANGE_MODEL']), 'a list recommended is not carried as its JSON').toEqual({
			action: '["RESHAPE_PWU","CHANGE_MODEL"]',
			reason: ''
		});
	});
});
