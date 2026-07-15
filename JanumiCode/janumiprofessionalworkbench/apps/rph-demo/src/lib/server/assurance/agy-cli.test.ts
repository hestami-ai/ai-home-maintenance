// §8.4 requires the Reasoning Review evaluator's "actual identities and lineage are recorded"; §14.6 requires the
// "allowed and resolved provider/model/version". Unpinned, agy picks its own model and never reports it — so the
// only honest options are to pin it or to refuse. §13.3: "Fail closed on missing identity, tenant, policy, schema,
// or authority context."
import { afterEach, describe, expect, it } from 'vitest';
import { judgeModel } from './agy-cli.js';

const KEY = 'JPWB_JUDGE_MODEL';
const original = process.env[KEY];
afterEach(() => {
	if (original === undefined) delete process.env[KEY];
	else process.env[KEY] = original;
});

describe('judgeModel — the evaluator identity may not be a fiction (§8.4 / §14.6 / §13.3)', () => {
	it('fails closed when the judge model is not pinned', () => {
		delete process.env[KEY];
		// THE LOCK. Previously this resolved to the literal 'agy:default' and the floor recorded that as the
		// evaluator's modelId — a value no real model can equal, which made the independence check unable to
		// detect producer and evaluator running the SAME model.
		expect(() => judgeModel()).toThrow(/JPWB_JUDGE_MODEL is required/);
	});

	it('returns the pinned model, which is also the model passed to agy', () => {
		process.env[KEY] = 'gemini-judge-3';
		expect(judgeModel()).toBe('gemini-judge-3');
	});

	it('treats an empty pin as unpinned — an empty string is not an identity', () => {
		process.env[KEY] = '';
		expect(() => judgeModel()).toThrow(/JPWB_JUDGE_MODEL is required/);
	});
});
