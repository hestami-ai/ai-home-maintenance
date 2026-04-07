/**
 * INTAKE phase handler methods extracted from GovernedStreamPanel.
 * Each function takes a PanelContext instead of using `this`.
 */

import * as vscode from 'vscode';
import type { PanelContext } from './panelContext';
import { IntakeSubState, IntakeMode } from '../../types/intake';
import { updateIntakeConversation, writeDialogueEvent } from '../../events/writer';
import { getOrCreateIntakeConversation } from '../../events/reader';
import { getEventBus } from '../../integration/eventBus';
import { getCoverageGaps, getPartialDomains, DOMAIN_SEQUENCE } from '../../workflow/engineeringDomainCoverageTracker';
import { updateWorkflowMetadata } from '../../workflow/stateMachine';

/**
 * Sets subState to SYNTHESIZING and runs a workflow cycle to produce the final plan.
 */
export async function handleIntakeFinalize(ctx: PanelContext): Promise<void> {
	if (!ctx.activeDialogueId || ctx.isProcessing) {return;}
	ctx.isProcessing = true;
	ctx.postInputEnabled(false);
	ctx.postProcessing(true, 'Finalizing', 'Synthesizing plan from conversation');
	try {
		const convResult = updateIntakeConversation(ctx.activeDialogueId, { subState: IntakeSubState.SYNTHESIZING });
		if (!convResult.success) {
			vscode.window.showErrorMessage(`Failed to transition to SYNTHESIZING: ${convResult.error.message}`);
			return;
		}
		await ctx.runWorkflowCycle();
	} finally {
		ctx.isProcessing = false;
		ctx.postProcessing(false);
		ctx.postInputEnabled(true);
	}
}

/**
 * Approves the synthesized plan and advances the workflow to the Architecture phase.
 *
 * Sets `metadata.pendingIntakeInput` to a sentinel marker before invoking the
 * workflow cycle. This bypasses the AWAITING_APPROVAL guard in
 * `advanceWorkflow` (orchestrator.ts), which would otherwise treat the cycle
 * as "waiting for fresh user input" and short-circuit before
 * `executeIntakePlanApproval` can run. The sentinel is consumed and cleared
 * by the orchestrator after the phase runs; `executeIntakePlanApproval`
 * does not read its value — it only needs the guard to step aside.
 */
export async function handleIntakeApprove(ctx: PanelContext): Promise<void> {
	if (!ctx.activeDialogueId || ctx.isProcessing) {return;}

	// Signal "user has supplied fresh input" (the approval click) so the
	// orchestrator's AWAITING_APPROVAL guard lets the cycle proceed.
	const metaResult = updateWorkflowMetadata(ctx.activeDialogueId, {
		pendingIntakeInput: '[APPROVE_PLAN]',
	});
	if (!metaResult.success) {
		vscode.window.showErrorMessage(`Failed to signal plan approval: ${metaResult.error.message}`);
		return;
	}

	ctx.isProcessing = true;
	ctx.postInputEnabled(false);
	ctx.postProcessing(true, 'Approving', 'Advancing to Architecture phase');
	try {
		await ctx.runWorkflowCycle();
	} finally {
		ctx.isProcessing = false;
		ctx.postProcessing(false);
		ctx.postInputEnabled(true);
		ctx.update();
	}
}

/**
 * Reverts the INTAKE sub-state back to DISCUSSING so the user can continue
 * refining requirements with the Technical Expert.
 */
export function handleIntakeContinueDiscussing(ctx: PanelContext): void {
	if (!ctx.activeDialogueId) {return;}
	const result = updateIntakeConversation(ctx.activeDialogueId, { subState: IntakeSubState.DISCUSSING });
	if (!result.success) { vscode.window.showErrorMessage(`Failed to update intake state: ${result.error.message}`); return; }
	ctx.update();
}

/**
 * Skips the GATHERING sub-state and transitions directly to DISCUSSING.
 * Emits an intake:gathering_skipped event so other subsystems can react.
 */
export function handleIntakeSkipGathering(ctx: PanelContext): void {
	if (!ctx.activeDialogueId) {return;}
	const result = updateIntakeConversation(ctx.activeDialogueId, { subState: IntakeSubState.DISCUSSING });
	if (!result.success) { vscode.window.showErrorMessage(`Failed to update intake state: ${result.error.message}`); return; }
	getEventBus().emit('intake:gathering_skipped', { dialogueId: ctx.activeDialogueId });
	ctx.update();
}

/**
 * Handles user selection of an INTAKE mode (STATE_DRIVEN, DOCUMENT_BASED, or HYBRID).
 * For STATE_DRIVEN mode, also determines the first domain to target based on
 * coverage gaps.
 */
export function handleIntakeModeSelected(ctx: PanelContext, mode: string): void {
	if (!ctx.activeDialogueId) {return;}
	const validModes = Object.values(IntakeMode) as string[];
	if (!validModes.includes(mode)) {return;}
	const updates: Record<string, unknown> = { intakeMode: mode as IntakeMode };
	if (mode === IntakeMode.STATE_DRIVEN) {
		const convResult = getOrCreateIntakeConversation(ctx.activeDialogueId);
		if (convResult.success && convResult.value.engineeringDomainCoverage) {
			const gaps = getCoverageGaps(convResult.value.engineeringDomainCoverage);
			const partials = getPartialDomains(convResult.value.engineeringDomainCoverage);
			const firstTarget = gaps.length > 0 ? gaps[0] : partials.length > 0 ? partials[0] : DOMAIN_SEQUENCE[0];
			updates.currentEngineeringDomain = firstTarget;
		} else {
			updates.currentEngineeringDomain = DOMAIN_SEQUENCE[0];
		}
	}
	const modeResult = updateIntakeConversation(ctx.activeDialogueId, updates);
	if (!modeResult.success) { vscode.window.showErrorMessage(`Failed to set intake mode: ${modeResult.error.message}`); return; }
	const bus = getEventBus();
	bus.emit('intake:mode_selected', { dialogueId: ctx.activeDialogueId, mode: mode as IntakeMode, source: 'user' as const });
	ctx.update();
}
