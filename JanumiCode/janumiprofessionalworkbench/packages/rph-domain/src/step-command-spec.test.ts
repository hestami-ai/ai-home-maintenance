// JAN-EXECREM WP-8 — the DECLARED step-command contract (SM-2). A structural enabler: no finding of its own, but
// it is what WP-9's kill-test battery and WP-16's conformance gates ITERATE, so a site with no kill test fails the
// build rather than waiting for the next adversarial review.
//
// WHY A TABLE. `advanceStep` had three OPTIONAL, per-call-site extension points declared nowhere enumerable.
// Nothing could answer "which rules does StartExecutionStep enforce, and which does CompleteExecutionStep not?"
// without reading nine docblocks and trusting them — the shape behind four unkilled source sets (F-11/12/13/14/
// 18/19), four unstated plan-ACTIVE omissions (F-26), and eight untested machine arrows (F-40).
//
// These tests check the table against the MACHINE, so a row that drifts from the arrows it claims fails here.
import { describe, expect, it } from 'vitest';
import { StepStateSchema } from '@janumipwb/rph-contracts';
import {
	STEP_COMMAND_SPECS,
	STEP_COMMAND_TYPES,
	stepCommandSpec
} from './step-command-spec.js';
import { STATE_MACHINES } from './transitions.data.js';

const machine = STATE_MACHINES['ExecutionStep.stepState']!;
const hasArrow = (from: string, to: string) =>
	machine.transitions.some((t) => t.from === from && t.to === to);

describe('WP-8 — the table is TOTAL and self-consistent', () => {
	it('declares exactly the nine step commands, and each row matches its key', () => {
		expect(STEP_COMMAND_TYPES).toHaveLength(9);
		for (const t of STEP_COMMAND_TYPES) expect(STEP_COMMAND_SPECS[t].commandType).toBe(t);
	});

	it('every declared state is a ratified StepState (target and every source)', () => {
		const valid = new Set<string>(StepStateSchema.options);
		for (const t of STEP_COMMAND_TYPES) {
			const s = stepCommandSpec(t);
			expect(valid.has(s.target), `${t} target`).toBe(true);
			expect(s.sourceStates.length, `${t} must declare at least one source`).toBeGreaterThan(0);
			for (const src of s.sourceStates) expect(valid.has(src), `${t} source ${src}`).toBe(true);
		}
	});

	it('no command declares its own TARGET as a source (that would be a self-edge re-issue)', () => {
		// The machine classifies from===to as a NOOP and would ADMIT it; the source set is the narrowing that
		// refuses. A row listing its own target would re-open every re-issue defect this program closed.
		for (const t of STEP_COMMAND_TYPES) {
			const s = stepCommandSpec(t);
			expect(s.sourceStates, `${t} lists its own target`).not.toContain(s.target);
		}
	});

	it('every source state has a REAL machine arrow to the target (no fictional transitions)', () => {
		for (const t of STEP_COMMAND_TYPES) {
			const s = stepCommandSpec(t);
			for (const src of s.sourceStates)
				expect(hasArrow(src, s.target), `${t}: the machine has no ${src} -> ${s.target} arrow`).toBe(true);
		}
	});

	it('every event type is distinct (one command, one fact)', () => {
		const events = STEP_COMMAND_TYPES.map((t) => stepCommandSpec(t).eventType);
		expect(new Set(events).size).toBe(events.length);
	});

	it('every plan-ACTIVE decision carries a written rationale — an omission must be stated, not discovered', () => {
		for (const t of STEP_COMMAND_TYPES) {
			const s = stepCommandSpec(t);
			expect(typeof s.requiresActivePlan, t).toBe('boolean');
			expect(s.activePlanRationale.length, `${t} rationale`).toBeGreaterThan(20);
		}
	});

	// F-26 is not fixed here — WP-12 settles it — but the four omissions are now VISIBLE as data instead of being
	// invisible across nine docblocks. This pins which four they are, so WP-12 argues about a table.
	it('records exactly which commands do NOT require an ACTIVE plan (F-26, settled by WP-12)', () => {
		const notRequiring = STEP_COMMAND_TYPES.filter((t) => !stepCommandSpec(t).requiresActivePlan).sort();
		expect(notRequiring).toEqual([
			'CancelExecutionStep',
			'CompleteExecutionStep',
			'EnterExecutionStepWait',
			'FailExecutionStep'
		]);
		// Two are INTENTIONAL and say so; two are still unsettled and say that too.
		expect(stepCommandSpec('CancelExecutionStep').activePlanRationale).toContain('INTENTIONAL');
		expect(stepCommandSpec('EnterExecutionStepWait').activePlanRationale).toContain('INTENTIONAL');
		expect(stepCommandSpec('CompleteExecutionStep').activePlanRationale).toContain('UNSETTLED');
		expect(stepCommandSpec('FailExecutionStep').activePlanRationale).toContain('UNSETTLED');
	});
});

describe('WP-8 — the table covers the machine (the F-40 denominator)', () => {
	it('every command-driven arrow the table claims is reachable, and the uncovered arrows are NAMED', () => {
		const claimed = new Set<string>();
		for (const t of STEP_COMMAND_TYPES) {
			const s = stepCommandSpec(t);
			for (const src of s.sourceStates) claimed.add(`${src}->${s.target}`);
		}
		const allArrows = machine.transitions.map((t) => `${t.from}->${t.to}`);
		const uncovered = [...new Set(allArrows)].filter((a) => !claimed.has(a)).sort();
		// These are the arrows NO step command drives. Naming them is the point: an arrow with no command is either
		// a plan-level effect (SUPERSEDED, driven by superseding the PLAN) or a genuine gap (NOT_READY -> READY,
		// which is F-27's deadlock — WP-6 now refuses to AUTHOR a NOT_READY step, so no new plan can reach it).
		expect(uncovered).toEqual([
			'NOT_READY->READY',
			'NOT_READY->SUPERSEDED',
			'QUEUED->SUPERSEDED',
			'READY->QUEUED',
			'READY->SUPERSEDED',
			'RUNNING->SUPERSEDED',
			'WAITING->SUPERSEDED'
		]);
	});
});
