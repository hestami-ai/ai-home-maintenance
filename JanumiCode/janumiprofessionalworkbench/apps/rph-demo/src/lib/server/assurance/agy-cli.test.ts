// §8.4 requires the Reasoning Review evaluator's "actual identities and lineage are recorded"; §14.6 requires the
// "allowed and resolved provider/model/version". Both the application default and an environment override are
// concrete selections passed to agy --model; neither permits agy's unnamed dynamic default.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	agyPrint,
	agyPrintWithModel,
	judgeModel,
	MAX_AGY_PROMPT_CHARS,
	resolveJudgeModel,
	extractJson,
	splitAnswerSpan
} from './agy-cli.js';
import { noProgramsDirectory } from './no-programs.testing.js';

const KEY = 'JPWB_JUDGE_MODEL';
const original = process.env[KEY];
afterEach(() => {
	if (original === undefined) delete process.env[KEY];
	else process.env[KEY] = original;
});

describe('judgeModel — the evaluator identity may not be a fiction (§8.4 / §14.6 / §13.3)', () => {
	it('REFUSES when no model is configured — there is no application default', () => {
		delete process.env[KEY];

		// SPONSOR DIRECTION 2026-09-02: the judge model "will be selected based on performance parameters that
		// have yet to be determined … it will need to be configurable." So there is no pin to fall back to.
		// THE MUTANT: reintroduce a default. The previous one — 'Gemini 3.5 Flash (High)' — had ROTTED: the
		// installed agy rejects it outright (REG-F-331), so every Reasoning Review failed while the code looked
		// configured. A default that no longer resolves is the fictional identity 'agy:default' in disguise.
		expect(() => judgeModel()).toThrow(/JPWB_JUDGE_MODEL/);
		expect(resolveJudgeModel(undefined)).toBeUndefined();
	});

	it('returns the pinned model, which is also the model passed to agy', () => {
		process.env[KEY] = '  gemini-judge-3  ';
		expect(judgeModel()).toBe('gemini-judge-3');
	});

	it('treats an empty override as absent instead of recording an empty identity', () => {
		process.env[KEY] = '';
		// Whitespace-only configuration must not become an empty evaluator identity; with no default it refuses.
		expect(() => judgeModel()).toThrow(/JPWB_JUDGE_MODEL/);
	});
});

describe('agyPrint — fails closed above the command-line budget instead of crashing as spawn ENAMETOOLONG', () => {
	// agy takes the prompt only as an argv value, so an over-long prompt would fail deep in the OS as an opaque
	// `spawn ENAMETOOLONG`. The guard throws a clear, classifiable error BEFORE spawning (so this never touches agy),
	// which the floor classifies as an operational validator failure the user can retry — never a graph rejection.
	it('rejects an over-budget prompt with a clear message and never spawns', async () => {
		await expect(agyPrint('x'.repeat(MAX_AGY_PROMPT_CHARS + 1))).rejects.toThrow(
			/command-line budget/
		);
	});

	it('⭐ `JAN-SELRES` D2 — the EXECUTOR’s call (agyPrintWithModel) is held to the same budget, before its exec is reached', async () => {
		// ⭑ The two share one implementation, and each checks the budget on its way in: the executor's instruction rides
		// in argv exactly as the judge's prompt does, and would fail the same way, opaquely, as spawn ENAMETOOLONG.
		// ⛔ HERMETIC: through the exec seam, with PATH finding no program.
		vi.stubEnv('PATH', noProgramsDirectory());
		try {
			const exec = vi.fn(async () => ({ stdout: '{}' }));
			await expect(
				agyPrintWithModel('x'.repeat(MAX_AGY_PROMPT_CHARS + 1), 'fixture-executor-model', exec)
			).rejects.toThrow(/command-line budget/);
			expect(exec, 'the over-budget prompt reached the exec seam').not.toHaveBeenCalled();
		} finally {
			vi.unstubAllEnvs();
		}
	});
});

// -- splitAnswerSpan: the boundary extractJson computes and used to discard ----------------------------------
// Guide 9.7:1340 mandates "separate it at retention so that only the answer span binds under Section 8.4".
// REG-D-053 makes that split the forward path. extractJson had NO tests at all before this block.

const REASONED = 'Let me think. The graph has one root.\n{"recommendation":"SATISFIED"}\nHope that helps.';
const FENCED = 'Preamble.\n```json\n{"a":1}\n```\nTrailer.';
const PLAIN = '{"a":1}';
const PADDED = '   \n{"a":1}\n  ';
const NO_JSON = 'I could not comply.';
const UNCLOSED = 'prose { "a": 1 with no closing brace';

// ⭐ `REG-F-557` (P2, the measured run again) — ONE JSON OBJECT WHOSE STRINGS HOLD A MARKDOWN CODE BLOCK. Six of P2's
// seven work products were this shape, and the reader took the first fence ANYWHERE in the text as the answer. Built
// with JSON.stringify, as a model's JSON is written: the fence sits INSIDE a string, its line breaks escaped.
// P2_SHAPED's fence holds no brace pair, so at HEAD no span was located (a false refusal); DESIGN_SHAPED's holds a
// TypeScript type, so at HEAD the span was that type (a false pass, the first measured run); JUDGEMENT_QUOTING_CODE is
// a reviewer's reply whose statement quotes code, which passes through the same `extractJson`.
const P2_SHAPED = JSON.stringify({
	documents: [{ path: 'docs/requirements.md', text: '# Req\n\n```text\nnode bin/x.js [options]\n```\n' }]
});
const DESIGN_SHAPED = JSON.stringify({
	documents: [{ path: 'docs/design.md', text: '# Design\n\n```ts\ntype Options = { help: boolean };\n```\n' }]
});
const PADDED_DESIGN = `\n  ${DESIGN_SHAPED}\n\t`;
const JUDGEMENT_QUOTING_CODE = JSON.stringify({
	findings: [
		{
			criterionId: 'RR-01-no-problem-substitution',
			failed: true,
			statement: 'The parser reads\n```ts\nconst o = { help: boolean };\n```\nand drops every other flag.',
			severity: 'MATERIAL'
		}
	],
	recommendation: 'REJECTED'
});

const LOCATED: readonly (readonly [string, string])[] = [
	['reason-then-answer', REASONED],
	['fenced', FENCED],
	['bare object', PLAIN],
	['surrounded by whitespace', PADDED],
	['one JSON object whose document holds a fenced block (REG-F-557, P2)', P2_SHAPED],
	['one JSON object whose document holds a fenced type, padded (REG-F-557)', PADDED_DESIGN],
	['a judgement whose statement quotes fenced code (REG-F-557)', JUDGEMENT_QUOTING_CODE]
];

describe('splitAnswerSpan - the complement is recoverable, and losslessly', () => {
	it.each(LOCATED)('reconstructs the original EXACTLY - %s', (_name, raw) => {
		const s = splitAnswerSpan(raw);

		// THE MUTANT: compute offsets against the TRIMMED string, as the legacy path does. Every case carrying
		// leading or trailing whitespace then loses those bytes, and the split is lossy in precisely the way
		// PER-9 forbids ("record-plane omission is not legal").
		expect(s.located).toBe(true);
		expect(s.prefix + s.answer + s.suffix).toBe(raw);
	});

	it('recovers the volunteered reasoning that used to be dropped on the floor', () => {
		const s = splitAnswerSpan(REASONED);

		// This prefix is the PER-12 material. Before this function existed the boundary was computed and the
		// complement discarded on every call - finding #25 restated.
		expect(s.prefix).toBe('Let me think. The graph has one root.\n');
		expect(s.answer).toBe('{"recommendation":"SATISFIED"}');
		expect(s.suffix).toBe('\nHope that helps.');
		expect(JSON.parse(s.answer)).toEqual({ recommendation: 'SATISFIED' });
	});

	it.each(LOCATED)('agrees with extractJson wherever a span is located - %s', (_name, raw) => {
		// THE PIN. extractJson ~~is deliberately left byte-identical~~ changes only where the whole text is one JSON
		// object (`REG-F-557` AS1), because its THROW drives the repair path. This is what stops the two drifting
		// apart once callers start using the split - and it now holds on the REG-F-557 shapes too.
		const s = splitAnswerSpan(raw);
		expect(s.located).toBe(true);
		expect(s.answer).toBe(extractJson(raw));
	});

	it.each([
		['no JSON at all', NO_JSON],
		['an unclosed object', UNCLOSED]
	] as const)('reports located=false rather than inventing a span - %s', (_name, raw) => {
		const s = splitAnswerSpan(raw);

		// THE MUTANT: return located:true with answer=raw. A caller would then retain an "answer span" that is
		// really the whole mixed blob, under the answer's retention class - the REG-F-337 mistake one layer up.
		// An unlocated result must be unusable for retention, and must say so.
		expect(s.located).toBe(false);
		expect(s.answer).toBe(extractJson(raw));
	});

	it('CONTROL - extractJson still behaves exactly as it did, including on the unlocated shapes', () => {
		// Without this the "deliberately unchanged" claim at the site is unenforced, and a future edit to
		// extractJson would be invisible here.
		// ⭐ `REG-F-557` AS1: the claim is now "unchanged unless the whole text is one JSON object" — and none of these
		// is one but PADDED, whose old answer was already that whole object, trimmed. So every line here still holds.
		expect(extractJson(REASONED)).toBe('{"recommendation":"SATISFIED"}');
		expect(extractJson(FENCED)).toBe('{"a":1}');
		expect(extractJson(PADDED)).toBe('{"a":1}');
		expect(extractJson(NO_JSON)).toBe('I could not comply.');
		expect(extractJson(UNCLOSED)).toBe('prose { "a": 1 with no closing brace');
	});
});

// -- ⭐ REG-F-557 AS1: the whole text first ------------------------------------------------------------------
// `DESIGN-the-answer-span.md` §2 AS1: when the whole trimmed text parses as one JSON object, that object IS the answer;
// only otherwise the old path (the first fence, then the outermost braces). §3's predicted reds 2 and 4 are here; 1
// and 3 are the schema floor's (`work-product-floor.test.ts`).

describe('REG-F-557 AS1 - a reply that IS one JSON object is read whole, whatever its strings hold', () => {
	it('⭐ a design-shaped work product is read WHOLE, not as the fenced type inside one of its strings', () => {
		// THE DEFECT, as the first measured run drove it: the span was the 126-character TypeScript type inside the
		// first fence, and the floor passed that fragment. THE MUTANT: drop the whole-text arm - the fragment is back.
		const s = splitAnswerSpan(DESIGN_SHAPED);
		expect(s.located).toBe(true);
		expect(s.answer, 'the answer is the whole object, not the fragment inside a string').toBe(DESIGN_SHAPED);
	});

	it('⭐ and a padded one keeps its whitespace as the prefix and suffix, so the split stays lossless (REG-F-339)', () => {
		// THE MUTANT: offsets of the TRIMMED text, as the legacy path computes them - the prefix is lost, PER-9's
		// "record-plane omission is not legal" one layer down.
		expect(splitAnswerSpan(PADDED_DESIGN)).toEqual({
			prefix: '\n  ',
			answer: DESIGN_SHAPED,
			suffix: '\n\t',
			located: true
		});
	});

	it('⭐ a reviewer reply whose statement quotes fenced code is extracted whole by extractJson', () => {
		// Not seen in P1 or P2 (`REG-F-557` "WHY IT MATTERS"), and the repair path's parse reads through this.
		// THE MUTANT: drop extractJson's whole-text arm - it returns the `{ help: boolean }` inside the statement.
		expect(extractJson(JUDGEMENT_QUOTING_CODE)).toBe(JUDGEMENT_QUOTING_CODE);
		expect(JSON.parse(extractJson(JUDGEMENT_QUOTING_CODE))).toMatchObject({
			recommendation: 'REJECTED'
		});
	});

	// ⛔ "ONE JSON OBJECT" - NOT ANY JSON VALUE. A reply that parses as an array, a string or null is read as before. Each
	// row is its own arrangement, so each conjunct of the test has a row only it reddens.
	it.each([
		[
			'a JSON array',
			'[{"a":1},{"b":2}]',
			{ prefix: '[', answer: '{"a":1},{"b":2}', suffix: ']', located: true }
		],
		[
			'a JSON string',
			'"{\\"a\\":1}"',
			{ prefix: '"', answer: '{\\"a\\":1}', suffix: '"', located: true }
		],
		['JSON null', 'null', { prefix: '', answer: 'null', suffix: '', located: false }]
	] as const)('CONTROL - %s is not an object, so it reads as it did', (_name, raw, before) => {
		expect(splitAnswerSpan(raw)).toEqual(before);
		expect(extractJson(raw)).toBe(before.answer);
	});
});
