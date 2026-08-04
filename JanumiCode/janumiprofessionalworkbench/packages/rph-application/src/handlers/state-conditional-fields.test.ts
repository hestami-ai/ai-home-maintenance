// REG-F-021 increment 0 — the compensating invariant, tested where it can actually be shown to REFUSE.
//
// WHY A DIRECT TEST AND NOT ONLY AN INTEGRATION ONE. `AssuranceAssessment.startedAt` became optional so the
// ratified §30 machine can create an assessment in `REQUESTED`. The guarantee it gave up was bought back at the
// write seam: an assessment that is ASSESSING or terminal MUST carry `startedAt`. But NO command can currently
// produce such an object — `requestAssuranceAssessment` always stamps the field — so an integration test can only
// ever observe the happy path and would leave the guard with no demonstrated failure mode. That is a guard whose
// green means nothing, which is the exact shape this repository keeps catching. So the predicate is exercised
// directly, and the integration side asserts the happy path separately.
import { AssuranceAssessmentStateSchema } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { stateConditionalViolation } from './kit.js';

const ASSESSMENT = 'ASSURANCE_ASSESSMENT';
const withState = (assessmentState: string, extra: Record<string, unknown> = {}) => ({
	assessmentState,
	...extra
});

/** The three states the ratified §30 machine occupies BEFORE the assessment begins. Named here from the enum's
 *  own order rather than retyped, so a rename cannot leave this file quietly testing a string nothing uses. */
const PRE_START = ['REQUESTED', 'EVIDENCE_PENDING', 'READY'] as const;

describe('state-conditional field invariants (REG-F-021 increment 0)', () => {
	it('REFUSES an ASSESSING assessment with no startedAt — the guarantee the schema relaxation handed over', () => {
		const violation = stateConditionalViolation(ASSESSMENT, withState('ASSESSING'));
		expect(violation).toBeTruthy();
		expect(violation).toContain('startedAt');
		expect(violation).toContain('ASSESSING');
	});

	it('REFUSES every TERMINAL disposition with no startedAt — an assessment cannot finish without having begun', () => {
		// Derived from the enum MINUS the pre-start states, so a new terminal state is covered the day it is added
		// and nobody has to remember this file. The exempt set is the only hand-written list, and it is the one the
		// production rule also names.
		const terminal = AssuranceAssessmentStateSchema.options.filter(
			(s) => !(PRE_START as readonly string[]).includes(s)
		);
		expect(terminal.length).toBeGreaterThanOrEqual(12); // CONTROL: the derivation found states to check
		const permitted = terminal.filter((s) => stateConditionalViolation(ASSESSMENT, withState(s)) === null);
		expect(
			permitted,
			'these states admitted an assessment with no startedAt — each one is a completed assessment with no ' +
				'record of when it began'
		).toEqual([]);
	});

	it('PERMITS the three pre-start states without startedAt — which is the entire point of the relaxation', () => {
		const refused = PRE_START.filter((s) => stateConditionalViolation(ASSESSMENT, withState(s)) !== null);
		expect(
			refused,
			'a pre-start state that still demands startedAt would leave the §30 machine exactly as unbuildable as ' +
				'it was before increment 0'
		).toEqual([]);
	});

	it('PERMITS an ASSESSING assessment that carries startedAt — the happy path is untouched', () => {
		expect(
			stateConditionalViolation(ASSESSMENT, withState('ASSESSING', { startedAt: '2026-08-04T00:00:00Z' }))
		).toBeNull();
	});

	// CONTROLS: the predicate must be inert where it has no rule, or it would refuse writes across the engine.
	it('CONTROL: an object type with no rule is never refused', () => {
		expect(stateConditionalViolation('PROFESSIONAL_WORK_UNIT', withState('ASSESSING'))).toBeNull();
		expect(stateConditionalViolation('ASSURANCE_POLICY', { status: 'ACTIVE' })).toBeNull();
	});

	it('CONTROL: a state field that is absent or not a string is not treated as a violation', () => {
		// A malformed state is the object schema's job to reject (kit.ts (d), which runs first). This predicate
		// must not double as a type checker, or its message would misattribute the defect.
		expect(stateConditionalViolation(ASSESSMENT, {})).toBeNull();
		expect(stateConditionalViolation(ASSESSMENT, { assessmentState: 42 })).toBeNull();
	});
});
