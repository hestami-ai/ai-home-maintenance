/**
 * Regression tests for the "Approve Plan" button bug.
 *
 * Symptom (observed in VS Code extension):
 *   User clicks "Approve Plan" in AWAITING_APPROVAL sub-state → button disables
 *   → nothing else happens. Workflow stays in INTAKE phase. No transition to
 *   ARCHITECTURE.
 *
 * Root cause:
 *   `advanceWorkflow` has a guard (orchestrator.ts lines ~2590-2614) that stops
 *   the cycle when the workflow is in INTAKE sub-states that "require fresh user
 *   input" (PRODUCT_REVIEW, CLARIFYING, AWAITING_APPROVAL) but no
 *   `metadata.pendingIntakeInput` is set. The guard exists to prevent replaying
 *   the original goal as fresh input.
 *
 *   For PRODUCT_REVIEW and CLARIFYING, the UI layer (`panelMmp`, `panelExport`)
 *   sets `pendingIntakeInput` before invoking the cycle, which bypasses the
 *   guard. For AWAITING_APPROVAL, `panelIntake.handleIntakeApprove` does NOT
 *   set any signal — it just calls `runWorkflowCycle()`. The guard matches
 *   AWAITING_APPROVAL and returns early with `awaitingInput: true`.
 *   `executeIntakePhase` is never called, so `executeIntakePlanApproval` never
 *   runs, so the plan is never stored as `approvedIntakePlan` in metadata and
 *   the phase never transitions to ARCHITECTURE.
 *
 * Fix:
 *   `panelIntake.handleIntakeApprove` must set `metadata.pendingIntakeInput`
 *   (to any non-empty sentinel value) BEFORE calling `ctx.runWorkflowCycle()`.
 *   This bypasses the guard. `executeIntakePlanApproval` ignores the
 *   `humanInput` parameter anyway — the sentinel is just a "user has supplied
 *   fresh input" marker.
 *
 * These tests are structured to fail before the fix and pass after:
 *
 *   Test 1 (UI layer, fail-to-pass):
 *     Call `handleIntakeApprove` with a mocked ctx, then verify that
 *     `metadata.pendingIntakeInput` was written BEFORE `runWorkflowCycle` was
 *     invoked. Without the fix, pendingIntakeInput is never written → fails.
 *     With the fix, it's written → passes.
 *
 *   Test 2 (integration, fail-to-pass):
 *     Drive `handleIntakeApprove` with a ctx whose `runWorkflowCycle` actually
 *     calls the production `advanceWorkflow` (with the narrative curator
 *     mocked to avoid the real LLM). Verify that after the call,
 *     `metadata.approvedIntakePlan` is set. Without the fix, the guard blocks
 *     the approval path → fails. With the fix, the plan is persisted → passes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';

// Mock the narrative curator: the post-approval path awaits
// runNarrativeCuration which would make a real LLM call. That side-effect is
// not the mechanism being tested here. The handoff document producer is
// fire-and-forget (.catch) in the intake router, so it's safe to leave alone.
vi.mock('../../../lib/curation/narrativeCurator', async () => {
	const actual = await vi.importActual<typeof import('../../../lib/curation/narrativeCurator')>(
		'../../../lib/curation/narrativeCurator'
	);
	return {
		...actual,
		runNarrativeCuration: vi.fn().mockResolvedValue({ success: true, value: undefined }),
	};
});

import { handleIntakeApprove } from '../../../lib/ui/governedStream/panelIntake';
import type { PanelContext } from '../../../lib/ui/governedStream/panelContext';
import { advanceWorkflow } from '../../../lib/workflow/orchestrator';
import {
	initializeWorkflowState,
	getWorkflowState,
} from '../../../lib/workflow/stateMachine';
import { updateIntakeConversation } from '../../../lib/events/writer';
import { getOrCreateIntakeConversation } from '../../../lib/events/reader';
import { IntakeSubState } from '../../../lib/types/intake';
import type { IntakePlanDocument } from '../../../lib/types/intake';
import { createDialogueRecord } from '../../../lib/dialogue/lifecycle';
import { randomUUID } from 'node:crypto';

// ─── Fixtures ────────────────────────────────────────────────────────

function makeMinimalFinalizedPlan(): IntakePlanDocument {
	return {
		version: 1,
		title: 'Test plan for regression',
		summary: 'A minimally-valid finalized plan used by the approval-bug regression test.',
		requirements: [],
		decisions: [],
		constraints: [],
		openQuestions: [],
		technicalNotes: [],
		proposedApproach: 'Implement the feature with minimal fuss.',
		lastUpdatedAt: new Date().toISOString(),
	};
}

/**
 * Construct a PanelContext suitable for driving panelIntake.handleIntakeApprove
 * without a real webview. `runWorkflowCycle` is supplied by the caller so each
 * test can decide whether it's a spy, a no-op, or a real cycle runner.
 */
function makePanelContext(
	dialogueId: string,
	runWorkflowCycle: () => Promise<void>,
): PanelContext & { _recordedCalls: string[] } {
	const recordedCalls: string[] = [];
	return {
		activeDialogueId: dialogueId,
		isProcessing: false,
		view: undefined,
		postProcessing: () => { recordedCalls.push('postProcessing'); },
		postInputEnabled: () => { recordedCalls.push('postInputEnabled'); },
		postToWebview: () => { recordedCalls.push('postToWebview'); },
		update: () => { recordedCalls.push('update'); },
		runWorkflowCycle,
		resumeAfterGate: async () => { recordedCalls.push('resumeAfterGate'); },
		_recordedCalls: recordedCalls,
	};
}

// ─── Shared test setup ───────────────────────────────────────────────

function seedAwaitingApprovalState(dialogueId: string): void {
	createDialogueRecord(dialogueId, 'Test goal for approval regression');
	initializeWorkflowState(dialogueId, { goal: 'Test goal for approval regression' });

	// Create the intake_conversations row (UPDATE is otherwise a no-op).
	const convResult = getOrCreateIntakeConversation(dialogueId);
	if (!convResult.success) {
		throw new Error(`Failed to create intake conversation: ${convResult.error.message}`);
	}

	// Seed AWAITING_APPROVAL with a finalized plan, simulating the state after
	// INTAKE_PLAN_FINALIZED has run and before the user clicks "Approve Plan".
	// turnCount > 0 prevents the DISCUSSING-first-turn adaptive initialization
	// branch in intakeRouter from accidentally firing.
	updateIntakeConversation(dialogueId, {
		subState: IntakeSubState.AWAITING_APPROVAL,
		turnCount: 3,
		finalizedPlan: makeMinimalFinalizedPlan(),
	});
}

describe('INTAKE approval — Approve Plan button regression', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();
		seedAwaitingApprovalState(dialogueId);
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('(fail-to-pass) handleIntakeApprove writes pendingIntakeInput BEFORE running the workflow cycle', async () => {
		// Capture the metadata state AT THE MOMENT runWorkflowCycle is called.
		// This proves that the approval handler set the sentinel first — which
		// is what bypasses the orchestrator's AWAITING_APPROVAL guard.
		const metadataSnapshots: Record<string, unknown>[] = [];

		const runWorkflowCycle = vi.fn(async () => {
			const stateResult = getWorkflowState(dialogueId);
			if (stateResult.success) {
				metadataSnapshots.push(JSON.parse(stateResult.value.metadata) as Record<string, unknown>);
			}
		});

		const ctx = makePanelContext(dialogueId, runWorkflowCycle);

		await handleIntakeApprove(ctx);

		// runWorkflowCycle must have been called exactly once
		expect(runWorkflowCycle).toHaveBeenCalledTimes(1);

		// And pendingIntakeInput must have been set BEFORE that call.
		// This is the fix: without it, the orchestrator's guard fires and
		// silently skips the approval path.
		expect(metadataSnapshots.length).toBe(1);
		const snapshot = metadataSnapshots[0];
		expect(snapshot).toHaveProperty('pendingIntakeInput');
		const pendingInput = snapshot.pendingIntakeInput;
		expect(typeof pendingInput).toBe('string');
		if (typeof pendingInput === 'string') {
			expect(pendingInput.length).toBeGreaterThan(0);
		}
	});

	it('(fail-to-pass, end-to-end) handleIntakeApprove + real advanceWorkflow transitions the plan to approved state', async () => {
		// Drive the actual production advanceWorkflow inside the mocked ctx.
		// Without the fix, the guard blocks the call and metadata.approvedIntakePlan
		// stays undefined. With the fix, advanceWorkflow routes to
		// executeIntakePlanApproval, which persists the approved plan.
		const runWorkflowCycle = async () => {
			// We don't assert inside the ctx hook — the outer test reads state.
			// advanceWorkflow errors would surface via the metadata assertions below.
			await advanceWorkflow(dialogueId);
		};

		const ctx = makePanelContext(dialogueId, runWorkflowCycle);

		await handleIntakeApprove(ctx);

		// After the cycle, workflow metadata should contain the approved plan.
		// This is the failing assertion before the fix: approvedIntakePlan is
		// never written because the guard blocks executeIntakePlanApproval.
		const stateResult = getWorkflowState(dialogueId);
		expect(stateResult.success).toBe(true);
		if (!stateResult.success) { return; }

		const metadata = JSON.parse(stateResult.value.metadata) as Record<string, unknown>;
		expect(metadata.approvedIntakePlan).toBeDefined();

		const approvedPlan = metadata.approvedIntakePlan as IntakePlanDocument;
		expect(approvedPlan.version).toBe(1);
		expect(approvedPlan.title).toBe('Test plan for regression');

		// pendingIntakeInput should be cleared after consumption by the orchestrator
		expect(metadata.pendingIntakeInput).toBeUndefined();
	});
});
