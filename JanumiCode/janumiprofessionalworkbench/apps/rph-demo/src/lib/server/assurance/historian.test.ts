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
	// ⭐ RESTATED (L17b6, design D94; `REG-D-204`; the lead's §39, Q1): ~~'⛔ RED FIRST — the declared parse first, unchanged: its rows as
	// `coerceJudgement` reads them'~~ — the declared parse's `extractJson` no longer finds the Historian's answer: REG-D-204's one object does
	// (`theOneJsonObjectIn`), and then the declared parse's `coerceJudgement`, unchanged.
	it('⛔ RED FIRST — the one JSON object read, then the declared parse’s `coerceJudgement`, unchanged: its rows as `coerceJudgement` reads them', () => {
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
	// ⭐ RESTATED (L17b6, design D94; `REG-D-204`; the lead's §39, Q1, Q3): ~~'⛔ RED FIRST — an answer inside a Markdown code fence, or with words
	// around its one object, is read as the bare answer is (the declared parse’s `extractJson`)'~~ — read by REG-D-204's one object now, and the words
	// around it recorded beside it: ~~`.toEqual(want)`~~, each case's words now stated beside the bare answer's read. Stronger, never weaker.
	it('⛔ RED FIRST — an answer inside a Markdown code fence, or with words around its one object, is read as the bare answer is, the words around it recorded beside it (REG-D-204’s one object)', () => {
		const bare = answer({
			recurrence: { recurs: true, statement: 'Round one’s stdin failure is back.', earlierRecords: ['asm_round_one'] },
			recommendedControlAction: { action: 'RESHAPE_PWU', reason: 'Build the reader and its test in parts.' }
		});
		const want = readHistorianAnswer(bare, { criteria: CRITERIA, givenRecordIds: GIVEN });
		expect(want.ok && want.answer.recurrence?.earlierRecords, 'arrangement: the bare answer is read, its recurrence with it').toEqual(['asm_round_one']);
		for (const [how, text, before, after] of [
			['a json fence', `\`\`\`json\n${bare}\n\`\`\``, '```json\n', '\n```'],
			['a bare fence', `\`\`\`\n${bare}\n\`\`\``, '```\n', '\n```'],
			['words around it', `Here is my answer:\n${bare}\nThat is all.`, 'Here is my answer:\n', '\nThat is all.']
		] as const)
			expect
				.soft(readHistorianAnswer(text, { criteria: CRITERIA, givenRecordIds: GIVEN }), `${how}: not read as the bare answer is`)
				.toEqual({ ...want, aroundAnswer: { before, after } });
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

// ⭐⭐ `JAN-EXEC` Phase 7, package L17b6 — design D94 (`REG-D-204`, the sponsor's *"Last message's one JSON"*, kept after the lead's correction of
// `REG-F-690`; the lead's rulings on L17b6's Stage 0, `l17b4/l17b4-facts.md` §39, Q1) — THE ANSWER IS THE ONE JSON OBJECT IN THE LAST MESSAGE, the words
// around it recorded beside it. Each red below was measured at HEAD with the stage's own reader (`l17b4/build/l17b6/reader-on-cases.ts`): today's reader
// takes the span from the first `{` to the last `}`, and gets 4 of 9 forms wrong.
describe('⭐⭐ L17b6 (D94; REG-D-204) — the Historian’s answer: the one JSON object in its last message', () => {
	const readOf = (text: string) => readHistorianAnswer(text, { criteria: CRITERIA, givenRecordIds: GIVEN });

	it('⛔ RED FIRST — L17b6 (REG-D-204): the one JSON object is read with the words before and after it recorded beside it', () => {
		const bare = answer({ recurrence: null, recommendedControlAction: null });
		const read = readOf(`I have read the records.\n${bare}\nThat is all.`);
		expect(read.ok ? read.aroundAnswer : read.why, 'the words around the answer are not recorded beside it').toEqual({ before: 'I have read the records.\n', after: '\nThat is all.' });
		expect.soft(read.ok ? read.answerText : read.why, 'the answer’s text is not its one object').toBe(bare);
		expect.soft(read.ok ? read.answer.judgement : read.why, 'its judgement is not the bare answer’s').toEqual(coerceJudgement(JSON.parse(bare), { criteria: CRITERIA } as never));
	});

	it('⛔ RED FIRST — L17b6 (REG-D-204): a last message with no JSON object, or with more than one, is not read, saying which — a list alone, and one object in a fence with another outside it, among them; ⭑ CONTROL: words alone, and two outside any fence, already not read', () => {
		const bare = answer({});
		const listAlone = readOf('["HC-01"]');
		expect(listAlone.ok, 'a list alone was read').toBe(false);
		expect.soft(listAlone.ok ? '' : listAlone.why, 'a list alone is not said to hold no JSON object').toContain('no JSON object');
		const fenceBeside = readOf(`\`\`\`json\n${bare}\n\`\`\`\n{"note":"extra"}`);
		expect.soft(fenceBeside.ok, 'one object in a fence and another outside it was read').toBe(false);
		expect.soft(fenceBeside.ok ? '' : fenceBeside.why, 'two objects are not said to be two').toContain('2 JSON objects');
		// ⭑ CONTROL — not read at HEAD either: words alone, and two objects outside any fence.
		expect.soft([readOf('I could not decide.').ok, readOf(`${bare}\nand also\n{"recommendation":"SATISFIED"}`).ok], '⭑ CONTROL — words alone, or two objects, were read').toEqual([false, false]);
		const wordsAlone = readOf('I could not decide.');
		expect.soft(wordsAlone.ok ? '' : wordsAlone.why, '⭑ CONTROL — words alone are not said to hold no JSON object').toContain('no JSON object');
	});

	it('⛔ RED FIRST — L17b6 (REG-D-204): an object inside another text is not read — inside a list, and inside a brace text that does not parse; no fragment is picked', () => {
		const bare = answer({});
		expect(readOf(`[${bare}]`).ok, 'an object inside a list was read').toBe(false);
		expect.soft(readOf(`{note: ${bare}}`).ok, '⭑ CONTROL — an object inside a brace text that does not parse was read').toBe(false);
		// ⭑ THE LONE `{`'S COST, NAMED (the lead's §39, Q1): ~~a `{` in the words before the answer that never closes opens a span that swallows the
		// answer, and the answer is not read~~. ⭐ RESTATED (L17b6 round 3; the lead's §43.3, rule H; the sponsor's answer, §43.11): a `{` in the words
		// that never closes there gets the answer refused — the scan finds the answer past it, and the words' own rule refuses the text. A stray bracket of
		// any of the four kinds, before the answer or after it, does the same (held below, rule H's cost). Held here, so that a reader that recovers from it
		// says so by reddening this.
		expect.soft(readOf(`The map uses { as a key.\n${bare}`).ok, 'the lone {’s cost is not as named: the answer after it was read').toBe(false);
	});

	it('⛔ RED FIRST — L17b6 (REG-D-204): words around the answer that hold a brace pair, or quotes, do not hide its one object', () => {
		const bare = answer({});
		const braces = readOf(`I read {records} first.\n${bare}`);
		expect(braces.ok, 'an answer whose lead-in holds {records} was not read').toBe(true);
		expect.soft(braces.ok ? braces.answerText : braces.why, 'the answer read is not its one object').toBe(bare);
		expect.soft(readOf(`I read "records/INDEX.md" first.\n${bare}`).ok, 'an answer whose lead-in holds quotes was not read').toBe(true);
		const inString = answer({ residualUncertainty: ['a } and a { and a " in it'] });
		const whole = readOf(inString);
		expect.soft(whole.ok ? whole.answerText : whole.why, 'an answer whose own string holds braces was not read whole').toBe(inString);
	});

	// ⭐⭐ L17b6 round 3 — the lead's §43.3 (finding 1; `REG-D-204`; rule H, the sponsor's answer, §43.11) — THREE FORMS ROUND 2'S READER READ WRONG, each
	// measured by the lead at round 2's staged code (`build/l17b6/lead-rule_h.ts`): its span opened at a `{` or `[` that did not parse ran to that span's
	// end — the text's end, for a `[` that never closes — and the scan went on there, so an object was hidden, or a fragment read. ⭑ RULE H: at each `{`
	// or `[` outside a value found, one strict JSON value is tried (what `JSON.parse` accepts), the scan going on at the next character where none
	// parses; the words, the text outside the values, have their brackets counted by type, quotes not read there, and a bracket of theirs that does not
	// close gets the text refused; an object inside brackets of the words is not read; and the answer is the one object value.
	it('⛔ RED FIRST — L17b6 round 3 (REG-D-204; the lead’s §43.3, form 1): an example object, then a [ that never closes, then the answer — nothing is read: neither the example, nor the answer past the [', () => {
		const read = readOf(`For example {"a":1} is a shape. [My answer follows:\n${answer({})}`);
		expect(read.ok ? read.answerText : 'not read', 'an object was read: the example, or the answer past a [ that never closes').toBe('not read');
		expect.soft(read.ok ? '' : read.why, 'the [ that never closes is not named as why').toContain('[ that never closes');
	});

	it('⛔ RED FIRST — L17b6 round 3 (REG-D-204; the lead’s §43.3, form 2): the answer, then a [ that never closes hiding a second object — nothing is read: the text holds two', () => {
		const read = readOf(`${answer({})}\nAlso [see {"a":1}`);
		expect(read.ok ? read.answerText : 'not read', 'the answer was read, though a second object stands after it past a [ that never closes').toBe('not read');
		expect.soft(read.ok ? '' : read.why, 'the [ that never closes is not named as why').toContain('[ that never closes');
	});

	it('⛔ RED FIRST — L17b6 round 3 (REG-D-204; the lead’s §43.3, form 3): a quoted { in the words, and a } inside one of the answer’s own strings — no fragment of the answer is read; under rule H the quoted { is a bracket of the words that never closes, so the answer is refused, its cost named', () => {
		const withBrace = answer({
			findings: [
				{ criterionId: 'HC-01', failed: true, statement: 'the } brace' },
				{ criterionId: 'HC-02', failed: false, statement: 'ok' }
			]
		});
		const read = readOf(`I quote "{" here.\n${withBrace}`);
		expect(read.ok ? read.answerText : withBrace, 'a fragment of the answer was read as the answer').toBe(withBrace);
		expect.soft(read.ok ? 'read' : read.why, 'rule H’s cost is not as named: the quoted { is a bracket of the words that never closes').toContain('{ that never closes');
	});

	// ⭑ Probe 3's measured last message (`build/l17b6/lead-probe3-last-message.txt`, 5,087 characters; §36): its words — an apostrophe, a quoted path —
	// then a blank line, then its one object on one line, spaced after each `{`, `[` and `:`, parentheses in its strings, and nothing after it.
	it('⭑ CONTROL — L17b6 round 3 (REG-D-204; the lead’s §43.3): an answer in probe 3’s measured form is read whole — words with an apostrophe and a quoted path, a blank line, the object spaced on one line with parentheses and quotes in its strings, and nothing after it', () => {
		const words =
			"I've reviewed the full record: both sign-off rejections, the RERUN decision, the re-run's recorded conversation, and the workspace's final `docs/verification.md`. Here is my judgment.\n\n";
		const object =
			'{ "findings": [{ "criterionId": "HC-01", "failed": false, "statement": "The re-run was handed the first sign-off\'s rejecting findings verbatim (FP-01/02/05, AD-01/02/04) in its instructions." }, { "criterionId": "HC-02", "failed": true, "statement": "Three of this round\'s four NOT_METs (FP-01, FP-02, FP-05) are the identical stdin defect, already rejected at the first sign-off." }], "recommendation": "REJECTED", "residualUncertainty": [ "Whether a Node 20 runtime would pass FP-07 (not in this environment)." ], "recurrence": { "recurs": true, "statement": "The stdin defect recurs (exit 1 with \'wordfreq: cannot read input\').", "earlierRecords": [ "asm_round_one" ] }, "recommendedControlAction": { "action": "REQUEST_HUMAN_DECISION", "reason": "The one authorized re-run is consumed (a further identical iteration would fail the same way)." } }';
		const read = readOf(words + object);
		expect(read.ok ? [read.answerText, read.aroundAnswer] : read.why, '⭑ CONTROL — an answer in probe 3’s form was not read whole').toEqual([object, { before: words, after: '' }]);
		expect.soft(read.ok ? [read.answer.recurrence?.earlierRecords, read.answer.recommendedControlAction?.action] : read.why, '⭑ CONTROL — its two fields were not read').toEqual([
			['asm_round_one'],
			'REQUEST_HUMAN_DECISION'
		]);
	});

	// ⭐ L17b6 round 3 — RULE H'S COST, NAMED (the lead's §43.3; told to the sponsor, §43.11: *"a stray bracket ({ [ } or ]) anywhere in that last message,
	// not only a stray { before the answer, gets the answer refused"*): wider than round 2's, which refused a lone `{` before the answer alone. Held here,
	// so that a reader that recovers from any of them says so by reddening this.
	it('⛔ RED FIRST — L17b6 round 3 (REG-D-204; the lead’s §43.3; the sponsor’s answer, §43.11): rule H’s cost, named — a stray bracket in the words, after the answer or before it, gets the answer refused: a [ after it that never closes, a } before it and a ] after it that close nothing, and a ] that closes a { of the words', () => {
		const bare = answer({});
		for (const [how, text, why] of [
			['a [ after it that never closes', `${bare}\n[draft`, '[ that never closes'],
			['a } before it that closes nothing', `Done } here.\n${bare}`, '} that closes nothing'],
			['a ] after it that closes nothing', `${bare}\nitem 2]`, '] that closes nothing'],
			['a ] that closes a { of the words', `Notes {draft] follow.\n${bare}`, '] that closes nothing']
		] as const) {
			const read = readOf(text);
			expect.soft(read.ok ? 'read' : read.why, `${how}: the answer was read, or refused for another reason`).toContain(why);
		}
	});

	// ⭐ L17b6 round 3 — RULE H'S STRICT SCAN (the lead's §43.3, steps 1 and 2): a try that fails goes on at the next character, never at its span's end, and
	// the words' quotes are not read. So a quote inside a bracket pair of the words — which a span reads as a string that runs into the answer — hides
	// nothing (round 2's reader refused this answer: its span ran to the text's end). And a list is one value: an object inside it is no object of the text.
	it('⛔ RED FIRST — L17b6 round 3 (REG-D-204; the lead’s §43.3, steps 1 and 2): a try that does not parse goes on at the next character, and the words’ quotes are not read — an answer after words holding [12" wide] is read whole; ⭑ CONTROL: a list holding the answer is one value, and holds no object of the text', () => {
		const bare = answer({});
		const inches = readOf(`The panel [12" wide] is shown.\n${bare}`);
		expect(inches.ok ? [inches.answerText, inches.aroundAnswer] : inches.why, 'an answer after words holding [12" wide] was not read whole').toEqual([
			bare,
			{ before: 'The panel [12" wide] is shown.\n', after: '' }
		]);
		const listed = readOf(`[${bare}]`);
		expect.soft(listed.ok ? 'read' : listed.why, '⭑ CONTROL — a list holding the answer is not one value holding no object of the text').toContain('no JSON object');
	});
});
