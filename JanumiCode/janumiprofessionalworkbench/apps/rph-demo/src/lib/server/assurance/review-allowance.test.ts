// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L2 — D20 (`REG-F-580`; `REG-D-135` (4)) — THE AUTHORING REVIEW'S ALLOWANCE: the setting as the
// server reads it, the reservation each round makes against it, and the one allowance a server process holds.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	AUTHORING_REVIEW_ALLOWANCE_VARIABLE,
	allowanceStoppedStatement,
	authoringReviewAllowanceSetting,
	createAuthoringReviewAllowance
} from './review-allowance.js';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe('⭐ L2 — the setting, read through the server’s configuration path', () => {
	it('is named in the JPWB_ family', () => {
		expect(AUTHORING_REVIEW_ALLOWANCE_VARIABLE).toBe('JPWB_AUTHORING_REVIEW_ALLOWANCE');
	});

	it('⭑ unset, blank or white space is NO allowance — the product’s default', () => {
		for (const configured of [undefined, '', '   ', '\t\n'])
			expect(authoringReviewAllowanceSetting(configured), JSON.stringify(configured)).toEqual({ kind: 'NONE' });
	});

	it('⛔ RED — a whole number of reviewer calls, trimmed, is the allowance; 0 among them', () => {
		for (const [configured, calls] of [
			['0', 0],
			['18', 18],
			[' 1279 ', 1279]
		] as const)
			expect(authoringReviewAllowanceSetting(configured), configured).toEqual({ kind: 'SET', calls });
	});

	it('⛔ RED — anything else is UNREADABLE, kept as configured — never read as no allowance', () => {
		for (const configured of ['-1', '1.5', '012', 'twelve', '18 calls', '1e3', '9007199254740993'])
			expect(authoringReviewAllowanceSetting(configured), configured).toEqual({ kind: 'UNREADABLE', configured });
	});

	it('⛔ RED — the server reads it from its environment when no value is handed in', () => {
		vi.stubEnv(AUTHORING_REVIEW_ALLOWANCE_VARIABLE, ' 42 ');
		expect(authoringReviewAllowanceSetting()).toEqual({ kind: 'SET', calls: 42 });
	});
});

describe('⭐ L2 — each round reserves its worst case; a round that would pass what is left is stopped, and reserves nothing', () => {
	it('⭑ no allowance admits every round, whatever its worst case', () => {
		const none = createAuthoringReviewAllowance({ kind: 'NONE' });
		expect([none.reserve(0), none.reserve(6), none.reserve(Number.MAX_SAFE_INTEGER)]).toEqual([
			{ admitted: true },
			{ admitted: true },
			{ admitted: true }
		]);
	});

	it('⛔ RED — a round reaching the allowance exactly is admitted, the next round past what is left stopped, naming what is left', () => {
		const allowance = createAuthoringReviewAllowance({ kind: 'SET', calls: 18 });
		expect(allowance.reserve(12)).toEqual({ admitted: true });
		expect(allowance.reserve(7)).toEqual({ admitted: false, worstCase: 7, allowance: 18, reserved: 12, left: 6 });
		// The stopped round reserved nothing: a round of what is left still fits, and then nothing does.
		expect(allowance.reserve(6)).toEqual({ admitted: true });
		expect(allowance.reserve(1)).toEqual({ admitted: false, worstCase: 1, allowance: 18, reserved: 18, left: 0 });
		expect(allowance.reserve(0), 'a round with no part reserves nothing and is admitted').toEqual({ admitted: true });
	});

	it('⛔ RED — a first round past the allowance is stopped before anything is reserved', () => {
		const allowance = createAuthoringReviewAllowance({ kind: 'SET', calls: 17 });
		expect(allowance.reserve(18)).toEqual({ admitted: false, worstCase: 18, allowance: 17, reserved: 0, left: 17 });
		expect(allowance.reserve(17)).toEqual({ admitted: true });
	});

	it('⛔ RED — an UNREADABLE allowance stops every round that has a call to reserve, and admits one that has none', () => {
		const allowance = createAuthoringReviewAllowance({ kind: 'UNREADABLE', configured: 'twelve' });
		expect(allowance.reserve(6)).toEqual({
			admitted: false,
			worstCase: 6,
			allowance: { unreadable: 'twelve' },
			reserved: 0,
			left: 0
		});
		expect(allowance.reserve(0)).toEqual({ admitted: true });
	});
});

describe('⭐ L2 — the server process holds ONE allowance, read once', () => {
	it('⛔ RED — the process’s allowance is read from the variable, and every round of the process reserves against the same one', async () => {
		vi.stubEnv(AUTHORING_REVIEW_ALLOWANCE_VARIABLE, '12');
		const { processAuthoringReviewAllowance } = await import('./review-allowance.js');
		const first = processAuthoringReviewAllowance();
		expect(first.reserve(12)).toEqual({ admitted: true });
		// ⛔ Read once: a value the environment says later is not a second allowance, and nothing reserved is forgotten.
		vi.stubEnv(AUTHORING_REVIEW_ALLOWANCE_VARIABLE, '100');
		const again = processAuthoringReviewAllowance();
		expect(again, 'a second allowance was made for the same process').toBe(first);
		expect(again.reserve(1)).toEqual({ admitted: false, worstCase: 1, allowance: 12, reserved: 12, left: 0 });
	});

	it('⭑ CONTROL — unset, the process’s allowance admits every round', async () => {
		vi.stubEnv(AUTHORING_REVIEW_ALLOWANCE_VARIABLE, undefined);
		const { processAuthoringReviewAllowance } = await import('./review-allowance.js');
		expect(processAuthoringReviewAllowance().reserve(Number.MAX_SAFE_INTEGER)).toEqual({ admitted: true });
	});
});

describe('⭐ L2 — the stated reason a stopped round records for each of its parts', () => {
	const part = { typeId: 'pwut_build', typeName: 'Build' };

	it('⛔ RED — names the part, the round’s parts and worst case, the allowance, what is left and what earlier rounds reserved', () => {
		expect(
			allowanceStoppedStatement(
				{ admitted: false, worstCase: 18, allowance: 30, reserved: 18, left: 12 },
				{ parts: 3, callsPerReview: 6 },
				part
			)
		).toBe(
			'No reviewer call was made for this type: the authoring review’s allowance stopped its round before the round’s first ' +
				'call (JPWB_AUTHORING_REVIEW_ALLOWANCE; REG-F-580; design D20). The round reviews 3 type(s), "Build" (pwut_build) ' +
				'among them; its worst case is 3 × 6 = 18 reviewer calls, and the allowance of 30 has 12 left, 18 reserved by ' +
				'earlier rounds. A round runs only while its worst case fits what is left, so this type is not reviewed and the ' +
				'candidate is not accepted.'
		);
	});

	it('⛔ RED — an unreadable allowance’s reason names the value as configured', () => {
		expect(
			allowanceStoppedStatement(
				{ admitted: false, worstCase: 6, allowance: { unreadable: 'twelve' }, reserved: 0, left: 0 },
				{ parts: 1, callsPerReview: 6 },
				part
			)
		).toBe(
			'No reviewer call was made for this type: the authoring review’s allowance, JPWB_AUTHORING_REVIEW_ALLOWANCE="twelve", ' +
				'is not a whole number of reviewer calls, so no round’s worst case can be reserved against it and no round with a ' +
				'type in it runs (REG-F-580; design D20). The round reviews 1 type(s), "Build" (pwut_build) among them; its worst ' +
				'case is 1 × 6 = 6 reviewer calls. This type is not reviewed and the candidate is not accepted.'
		);
	});
});
