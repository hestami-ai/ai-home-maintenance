// JAN-EXECLOOP EL-01/EL-02 — the bound, and who may be sent back to work.
//
// ⭑ THIS IS THE INCREMENT `REG-D-059` LICENSED AND LEFT OPEN: *"three of the four parts exist … What is
// missing is the LOOP — a bound greater than one, and the classification that decides when to stop."*
import { describe, expect, it } from 'vitest';
import { classifyTrend, mayRetry, DEFAULT_REPAIR_BOUND } from './loop-detection.js';
import { classifyFloorRemediation, type FloorView } from '../floor.js';
import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';

describe('JAN-EXECLOOP — the trend classifier', () => {
	it('⭑ CONTROL — a FALLING finding count is CONVERGING, so the loop can ever proceed', () => {
		// Without this every assertion below is satisfiable by "never converge", which would make the bound
		// one — the authoring plane's existing behaviour, and exactly what this increment exists to raise.
		expect(classifyTrend([4, 2])).toBe('CONVERGING');
	});

	it('⛔ a FLAT count is STALLED — no progress is not progress', () => {
		// THE MUTANT: treat flat as CONVERGING. The loop then runs to its bound on a producer that is not
		// addressing anything, spending real model calls to arrive where it already was.
		expect(classifyTrend([3, 3])).toBe('STALLED');
	});

	it('⛔ a RISING count is DIVERGING — the work is getting worse', () => {
		// THE MUTANT: fold rising into STALLED. Both stop the loop today, so the behaviour is identical — but
		// the RECORD would then say "made no progress" about a producer that actively made things worse, and
		// the escalation a human reads would misdescribe what happened.
		expect(classifyTrend([2, 5])).toBe('DIVERGING');
	});

	it('⭑ ONE try is NO_TREND_YET — a single count is not a trend', () => {
		// The sibling monitor runs "from attempt 2 onward" for this reason. THE MUTANT: classify from one point.
		// The first try would then decide the loop's fate before any comparison exists.
		expect(classifyTrend([3])).toBe('NO_TREND_YET');
		expect(classifyTrend([])).toBe('NO_TREND_YET');
	});

	it('⛔ there is NO SCOPE_BLIND arm, and that is a measurement about THIS system', () => {
		// ⚠ THE SIBLING HAS FOUR STATES. `SCOPE_BLIND` keys on available-but-unused TOOLS and identical
		// tool-call sequences — and a JPWB execution step invokes NO TOOLS, `MODEL_INVOCATION` being the only
		// step type anything runs. Ported, it would read "no loop" forever: A CHECK THAT CANNOT FAIL.
		//
		// THE MUTANT: add the arm. It can never fire, so no other test would notice — which is why the absence
		// is asserted here rather than left to a comment.
		const reachable = new Set([
			classifyTrend([]),
			classifyTrend([1]),
			classifyTrend([2, 1]),
			classifyTrend([1, 1]),
			classifyTrend([1, 2])
		]);
		expect(reachable).toEqual(new Set(['NO_TREND_YET', 'CONVERGING', 'STALLED', 'DIVERGING']));
	});
});

describe('JAN-EXECLOOP — the bound', () => {
	it('⛔ refuses at the bound — a repair try is "not wrong, it is unbounded" (REG-Q-078)', () => {
		// THE MUTANT: an unbounded while-loop. That is the precise defect REG-Q-078 recorded of option (c), and
		// the sponsor's ruling supplied the bound it lacked.
		expect(mayRetry(DEFAULT_REPAIR_BOUND, 'CONVERGING').retry).toBe(false);
		expect(mayRetry(DEFAULT_REPAIR_BOUND, 'CONVERGING').reason).toMatch(/bound/i);
	});

	it('⭑ NO_TREND_YET permits a second try — else the bound collapses to one', () => {
		// ⚠ WITH ONE TRY THERE IS NO TREND. Refusing here would reproduce the authoring plane's bound of one,
		// which is the behaviour this increment exists to raise. THE MUTANT: require CONVERGING to retry.
		expect(mayRetry(1, 'NO_TREND_YET').retry).toBe(true);
	});

	it('⛔ stops on STALLED and on DIVERGING, with reasons that differ', () => {
		expect(mayRetry(1, 'STALLED').retry).toBe(false);
		expect(mayRetry(1, 'DIVERGING').retry).toBe(false);
		// ⭑ The reasons must be DISTINGUISHABLE, or an escalation cannot say which happened.
		expect(mayRetry(1, 'STALLED').reason).not.toBe(mayRetry(1, 'DIVERGING').reason);
	});

	it('⭑ CONTROL — converging under the bound retries', () => {
		expect(mayRetry(1, 'CONVERGING').retry).toBe(true);
	});
});

// ── EL-02 ───────────────────────────────────────────────────────────────────────────────────────────────────
const observation = (code: string) => ({ code, severity: 'BLOCKING', statement: 'x' });

function floorWith(disposition: string): FloorView {
	return {
		subjectId: 'art_1',
		satisfied: false,
		waived: false,
		policies: [
			{
				policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
				disposition,
				independenceOk: true,
				observations: [observation('RR-01-no-problem-substitution')]
			}
		]
	} as unknown as FloorView;
}

describe('JAN-EXECLOOP — only a disposition that JUDGED the subject may send work back', () => {
	it('⭑ CONTROL — REJECTED with findings DOES feed back, else the loop never runs at all', () => {
		const r = classifyFloorRemediation(floorWith('REJECTED'));
		expect(r.action).toBe('REFINE_SUBJECT');
		expect(r.autoRefine).toBe(true);
		expect(r.findings).toHaveLength(1);
	});

	it('⭑ and CONDITIONALLY_SATISFIED feeds back — minor findings are still findings', () => {
		expect(classifyFloorRemediation(floorWith('CONDITIONALLY_SATISFIED')).autoRefine).toBe(true);
	});

	it('⛔ INCONCLUSIVE does NOT feed back — it would MANUFACTURE WORK FROM SILENCE', () => {
		// ⭑⭑ `REG-D-059`, in terms: "INCONCLUSIVE — the reviewer could not tell — must not feed a finding back
		// to the agent, because there is no finding." `ASR-11` limb 1: a validator failure "neither rejects nor
		// satisfies the subject."
		//
		// THE MUTANT: restore `disposition !== 'SATISFIED'`. ⚠ AND NO OTHER TEST WOULD REDDEN — the offline
		// reviewer returns INCONCLUSIVE only with operational codes, which are filtered out before this point,
		// so the condition was UNREACHABLE until a live model started choosing its own disposition.
		const r = classifyFloorRemediation(floorWith('INCONCLUSIVE'));
		expect(r.autoRefine, 'a reviewer that could not tell has not found anything').toBe(false);
		expect(r.action).not.toBe('REFINE_SUBJECT');
	});

	it('⛔ nor do UNASSESSED or EVIDENCE_REQUIRED, and for their own reasons', () => {
		// Nothing assessed the subject in the first; the remedy is EVIDENCE rather than a subject edit in the
		// second. Neither is a critique of the work.
		expect(classifyFloorRemediation(floorWith('UNASSESSED')).autoRefine).toBe(false);
		expect(classifyFloorRemediation(floorWith('EVIDENCE_REQUIRED')).autoRefine).toBe(false);
	});
});
