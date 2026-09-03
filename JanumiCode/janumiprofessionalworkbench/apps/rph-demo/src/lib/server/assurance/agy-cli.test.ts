// §8.4 requires the Reasoning Review evaluator's "actual identities and lineage are recorded"; §14.6 requires the
// "allowed and resolved provider/model/version". Both the application default and an environment override are
// concrete selections passed to agy --model; neither permits agy's unnamed dynamic default.
import { afterEach, describe, expect, it } from 'vitest';
import { agyPrint, judgeModel, MAX_AGY_PROMPT_CHARS, resolveJudgeModel, extractJson, splitAnswerSpan } from './agy-cli.js';

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

const LOCATED: readonly (readonly [string, string])[] = [
	['reason-then-answer', REASONED],
	['fenced', FENCED],
	['bare object', PLAIN],
	['surrounded by whitespace', PADDED]
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
		// THE PIN. extractJson is deliberately left byte-identical because its THROW drives the repair path.
		// This is what stops the two drifting apart once callers start using the split.
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
		expect(extractJson(REASONED)).toBe('{"recommendation":"SATISFIED"}');
		expect(extractJson(FENCED)).toBe('{"a":1}');
		expect(extractJson(PADDED)).toBe('{"a":1}');
		expect(extractJson(NO_JSON)).toBe('I could not comply.');
		expect(extractJson(UNCLOSED)).toBe('prose { "a": 1 with no closing brace');
	});
});
