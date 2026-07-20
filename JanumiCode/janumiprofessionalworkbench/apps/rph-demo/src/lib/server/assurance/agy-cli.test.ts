// §8.4 requires the Reasoning Review evaluator's "actual identities and lineage are recorded"; §14.6 requires the
// "allowed and resolved provider/model/version". Both the application default and an environment override are
// concrete selections passed to agy --model; neither permits agy's unnamed dynamic default.
import { afterEach, describe, expect, it } from 'vitest';
import { agyPrint, DEFAULT_JUDGE_MODEL, judgeModel, MAX_AGY_PROMPT_CHARS } from './agy-cli.js';

const KEY = 'JPWB_JUDGE_MODEL';
const original = process.env[KEY];
afterEach(() => {
	if (original === undefined) delete process.env[KEY];
	else process.env[KEY] = original;
});

describe('judgeModel — the evaluator identity may not be a fiction (§8.4 / §14.6 / §13.3)', () => {
	it('uses the application-owned Gemini 3.5 Flash (High) default when no override is set', () => {
		delete process.env[KEY];
		expect(DEFAULT_JUDGE_MODEL).toBe('Gemini 3.5 Flash (High)');
		expect(judgeModel()).toBe(DEFAULT_JUDGE_MODEL);
		expect(judgeModel()).not.toBe('agy:default');
	});

	it('returns the pinned model, which is also the model passed to agy', () => {
		process.env[KEY] = '  gemini-judge-3  ';
		expect(judgeModel()).toBe('gemini-judge-3');
	});

	it('treats an empty override as absent instead of recording an empty identity', () => {
		process.env[KEY] = '';
		expect(judgeModel()).toBe(DEFAULT_JUDGE_MODEL);
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
