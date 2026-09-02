// §8.4 requires the Reasoning Review evaluator's "actual identities and lineage are recorded"; §14.6 requires the
// "allowed and resolved provider/model/version". Both the application default and an environment override are
// concrete selections passed to agy --model; neither permits agy's unnamed dynamic default.
import { afterEach, describe, expect, it } from 'vitest';
import { agyPrint, judgeModel, MAX_AGY_PROMPT_CHARS, resolveJudgeModel } from './agy-cli.js';

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
