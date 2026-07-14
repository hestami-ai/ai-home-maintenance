import { describe, expect, it } from 'vitest';
import { detectConvergence, toPercent } from './assessment.js';

describe('toPercent — 0..1 assessor score to integer percent (canonical-hash safe)', () => {
	it('rounds to an integer percent', () => {
		expect(toPercent(0.6)).toBe(60);
		expect(toPercent(0.525)).toBe(53);
		expect(toPercent(0)).toBe(0);
		expect(toPercent(1)).toBe(100);
	});
	it('clamps out-of-range and non-finite inputs', () => {
		expect(toPercent(-0.5)).toBe(0);
		expect(toPercent(1.4)).toBe(100);
		expect(toPercent(Number.NaN)).toBe(0);
	});
});

describe('detectConvergence — the assess/refine stop mechanism', () => {
	it('converges when the score improves beyond EPS with fresh gaps', () => {
		const s = detectConvergence(
			{ overallScore: 0.5, gaps: ['no per-level V&V pairing', 'JTBD not traced to acceptance'] },
			{ overallScore: 0.72, gaps: ['UCD feedback loop is implicit'] }
		);
		expect(s.converging).toBe(true);
		expect(s.scoreDelta).toBeCloseTo(0.22, 5);
		expect(s.recurringGaps).toHaveLength(0);
	});

	it('does NOT converge when the score is flat (stuck)', () => {
		const s = detectConvergence(
			{ overallScore: 0.6, gaps: ['a'] },
			{ overallScore: 0.62, gaps: ['something new entirely'] }
		);
		expect(s.converging).toBe(false); // +0.02 <= EPS 0.05
	});

	it('does NOT converge when the SAME gaps recur even if the score nudged up', () => {
		const gaps = ['no per-level V&V pairing across the left and right arms'];
		const s = detectConvergence(
			{ overallScore: 0.5, gaps },
			{ overallScore: 0.6, gaps: ['still no per-level V&V pairing across the arms'] }
		);
		expect(s.recurringGaps).toHaveLength(1); // recognized as the same gap
		expect(s.converging).toBe(false); // all current gaps are recurrences
	});

	it('regresses (negative delta) is not converging', () => {
		const s = detectConvergence(
			{ overallScore: 0.7, gaps: [] },
			{ overallScore: 0.55, gaps: ['new regression'] }
		);
		expect(s.scoreDelta).toBeCloseTo(-0.15, 5);
		expect(s.converging).toBe(false);
	});
});
