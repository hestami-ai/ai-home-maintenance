import { describe, expect, it } from 'vitest';
import { assurancePreflight } from './preflight.js';

describe('assurancePreflight — live authoring cannot outrun its mandatory reviewer', () => {
	it('blocks live authoring before mutation when JPWB_JUDGE_MODEL is absent', () => {
		const result = assurancePreflight({
			testMode: false,
			assessor: undefined,
			judgeModel: undefined
		});

		expect(result.ready).toBe(false);
		expect(result.code).toBe('REASONING_REVIEW_MODEL_UNCONFIGURED');
		expect(result.guidance).toMatch(/no PWA changes were made/i);
		expect(result.guidance).toMatch(/set JPWB_JUDGE_MODEL/i);
	});

	it('treats whitespace-only live configuration as absent', () => {
		expect(
			assurancePreflight({ testMode: false, assessor: undefined, judgeModel: '  ' }).ready
		).toBe(false);
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
			guidance: ''
		});
	});

	it('allows test-mode mock assurance without live reviewer configuration', () => {
		expect(
			assurancePreflight({ testMode: true, assessor: undefined, judgeModel: undefined }).ready
		).toBe(true);
	});

	it('requires the model when test mode explicitly selects the real agy reviewer', () => {
		expect(
			assurancePreflight({ testMode: true, assessor: 'agy', judgeModel: undefined }).ready
		).toBe(false);
	});

	it('ignores a production request for the mock assessor just as the registry does', () => {
		expect(
			assurancePreflight({ testMode: false, assessor: 'mock', judgeModel: undefined }).ready
		).toBe(false);
	});
});
