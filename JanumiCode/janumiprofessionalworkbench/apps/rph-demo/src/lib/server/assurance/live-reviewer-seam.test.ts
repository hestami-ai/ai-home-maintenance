// ⭐ `JAN-SELREV` SR-1 — `withLiveReviewerSeam` SELECTS THE REAL REVIEWER, SO WHILE IT DOES, PATH FINDS NO PROGRAM.
//
// ⛔ THE SEAM NAMES agy, and agy on this machine's PATH is the paid reviewer. Its callers inject a `print`, and that
// injection is the only thing between them and the real program: a mutant that stopped it winning would start agy
// from any of them. So the helper points PATH at the empty directory for the body's duration. ⭑ OBSERVED WITHOUT
// SPAWNING ANYTHING: the body reads the environment it runs in, and nothing here looks a program up.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withLiveReviewerSeam } from './clearing-reviewer.testing.js';
import { noProgramsDirectory } from './no-programs.testing.js';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('withLiveReviewerSeam — the real reviewer selected, and nothing to start', () => {
	it('⛔ PATH is the empty directory for the body’s duration, beside the selection it makes', async () => {
		vi.stubEnv('PATH', 'the-path-before');
		const seen = await withLiveReviewerSeam(async () => ({
			path: process.env.PATH,
			tool: process.env.JPWB_ASSURANCE_TOOL,
			model: process.env.JPWB_JUDGE_MODEL
		}));
		expect(seen.path, 'the real reviewer was selected with the machine’s PATH').toBe(
			noProgramsDirectory()
		);
		expect(seen.tool).toBe('agy');
		expect(seen.model).toBe('test-judge-model');
	});

	it('⭑ and PATH is put back afterwards — even when the body fails', async () => {
		vi.stubEnv('PATH', 'the-path-before');
		await expect(
			withLiveReviewerSeam(async () => {
				throw new Error('the body failed');
			})
		).rejects.toThrow('the body failed');
		expect(process.env.PATH).toBe('the-path-before');
	});
});
