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

	it('every authority decision carries a written rationale — an omission must be stated, not discovered', () => {
		for (const t of STEP_COMMAND_TYPES) {
			const s = stepCommandSpec(t);
			expect(s.activePlanRationale.length, `${t} plan-liveness rationale`).toBeGreaterThan(20);
			expect(s.pwuOpennessRationale.length, `${t} PWU-openness rationale`).toBeGreaterThan(20);
		}
	});

	// SETTLED by WP-12 (F-26). The four omissions WP-8 could only make VISIBLE are now DECIDED, and this is the
	// classification pinned as data. Note this test does not read the table to build its expectation — it states
	// the answer literally, so mutating a row turns it RED instead of moving the goalposts with it.
	it('CLASSIFICATION: exactly Fail, Cancel and EnterWait are CLEANUP_EXEMPT on plan liveness', () => {
		const exempt = STEP_COMMAND_TYPES.filter(
			(t) => stepCommandSpec(t).planLiveness === 'CLEANUP_EXEMPT'
		).sort();
		expect(exempt).toEqual([
			'CancelExecutionStep',
			'EnterExecutionStepWait',
			'FailExecutionStep'
		]);
		// Complete MOVED to the gated side — the behaviour change F-26 called for.
		expect(stepCommandSpec('CompleteExecutionStep').planLiveness).toBe('REQUIRES_ACTIVE_PLAN');
	});

	it('CLASSIFICATION: the same three are CLEANUP_EXEMPT on PWU openness', () => {
		const exempt = STEP_COMMAND_TYPES.filter(
			(t) => stepCommandSpec(t).pwuOpenness === 'CLEANUP_EXEMPT'
		).sort();
		expect(exempt).toEqual([
			'CancelExecutionStep',
			'EnterExecutionStepWait',
			'FailExecutionStep'
		]);
	});

	it('THE AXIS IS CREDIT, NOT WORK: every command whose target is terminal-SUCCESS requires an ACTIVE plan', () => {
		// The rule that settled F-26, expressed as a property rather than a list. Skip and Prune open no work
		// whatsoever, yet both were already gated — which is the evidence that the codebase believed the credit
		// axis while its docblocks said "opens new work".
		for (const t of STEP_COMMAND_TYPES) {
			const s = stepCommandSpec(t);
			if (s.target === 'SUCCEEDED' || s.target === 'SKIPPED')
				expect(s.planLiveness, `${t} mints terminal-success`).toBe('REQUIRES_ACTIVE_PLAN');
		}
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
