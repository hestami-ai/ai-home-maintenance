import { describe, expect, it } from 'vitest';
import { DEFAULT_JUDGE_MODEL } from './agy-cli.js';
import { assurancePreflight } from './preflight.js';

describe('assurancePreflight — live authoring cannot outrun its mandatory reviewer', () => {
	it('uses the application default for live authoring when JPWB_JUDGE_MODEL is absent', () => {
		const result = assurancePreflight({
			testMode: false,
			assessor: undefined,
			judgeModel: undefined
		});

		expect(result).toEqual({
			ready: true,
			code: 'READY',
			guidance: `JPWB_JUDGE_MODEL is not set; the independent Reasoning Review will use the application default ${DEFAULT_JUDGE_MODEL}.`,
			judgeModel: DEFAULT_JUDGE_MODEL,
			usingDefaultJudgeModel: true
		});
	});

	it('treats whitespace-only live configuration as an absent override and uses the default', () => {
		expect(
			assurancePreflight({ testMode: false, assessor: undefined, judgeModel: '  ' }).judgeModel
		).toBe(DEFAULT_JUDGE_MODEL);
	});

	it('allows a live turn when the reviewer model is pinned without invoking the reviewer', () => {
		expect(
			assurancePreflight({
				testMode: false,
				assessor: undefined,
				judgeModel: 'gemini-reviewer-v1'
			})
		).toEqual({
			ready: true,
			code: 'READY',
			guidance: '',
			judgeModel: 'gemini-reviewer-v1',
			usingDefaultJudgeModel: false
		});
	});

	it('allows test-mode mock assurance without live reviewer configuration', () => {
		expect(
			assurancePreflight({ testMode: true, assessor: undefined, judgeModel: undefined }).ready
		).toBe(true);
	});

	it('uses the default when test mode explicitly selects the real agy reviewer', () => {
		expect(
			assurancePreflight({ testMode: true, assessor: 'agy', judgeModel: undefined }).judgeModel
		).toBe(DEFAULT_JUDGE_MODEL);
	});

	it('ignores a production request for the mock assessor just as the registry does', () => {
		expect(
			assurancePreflight({ testMode: false, assessor: 'mock', judgeModel: undefined }).judgeModel
		).toBe(DEFAULT_JUDGE_MODEL);
	});
});
