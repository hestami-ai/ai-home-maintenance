/**
 * Gate decision handlers for GovernedStreamPanel.
 * Extracted to reduce main class LOC — handles generic gates, verification gates, and review gates.
 */

import * as vscode from 'vscode';
import type { PanelContext } from './panelContext';
import { HumanAction, Role, ClaimEventType, Phase, ClaimStatus, GateStatus } from '../../types';
import { processHumanGateDecision, type HumanGateDecisionInput } from '../../workflow/humanGateHandling';
import { resolveGate, getGate } from '../../workflow/gates';
import { transitionWorkflow, updateWorkflowMetadata, TransitionTrigger } from '../../workflow/stateMachine';
import { writeClaimEvent } from '../../events/writer';
import { runNarrativeCuration } from '../../curation/narrativeCurator';
import { CurationMode } from '../../types/narrativeCurator';
import { getDatabase } from '../../database';

/**
 * Handle a generic gate decision (approve/reject/override/reframe).
 */
export function handleGateDecision(
	ctx: PanelContext,
	gateId: string,
	action: string,
	rationale: string
): void {
	if (rationale.length < 10) {
		vscode.window.showWarningMessage('Rationale must be at least 10 characters.');
		return;
	}

	const humanAction = action as HumanAction;
	if (!Object.values(HumanAction).includes(humanAction)) {
		vscode.window.showErrorMessage(`Invalid action: ${action}`);
		return;
	}

	const input: HumanGateDecisionInput = {
		gateId,
		action: humanAction,
		rationale,
		decisionMaker: 'human-user',
	};

	const result = processHumanGateDecision(input);

	if (result.success) {
		vscode.window.showInformationMessage(`Gate ${action.toLowerCase()}d successfully.`);
		ctx.update();
		if (ctx.activeDialogueId) {
			runNarrativeCuration(ctx.activeDialogueId, CurationMode.FEEDBACK).catch(() => {});
		}
	} else {
		vscode.window.showErrorMessage(`Gate decision failed: ${result.error.message}`);
	}
}

/**
 * Handle a gate decision with repair-escalation awareness.
 * If the gate is a repair escalation, reset the failed unit to READY and resume.
 */
export async function handleGateDecisionAndResume(
	ctx: PanelContext,
	gateId: string,
	action: string,
	rationale: string
): Promise<void> {
	let isRepairEscalation = false;
	let repairUnitId: string | undefined;
	try {
		const db = getDatabase();
		if (db) {
			const row = db.prepare(
				'SELECT metadata FROM gate_metadata WHERE gate_id = ?'
			).get(gateId) as { metadata: string } | undefined;
			if (row) {
				const meta = JSON.parse(row.metadata) as Record<string, unknown>;
				if (meta.condition === 'REPAIR_ESCALATION') {
					isRepairEscalation = true;
					repairUnitId = meta.unit_id as string | undefined;
				}
			}
		}
	} catch { /* metadata read failed */ }

	if (isRepairEscalation && repairUnitId) {
		const { updateTaskUnitStatus } = await import('../../database/makerStore.js');
		const { TaskUnitStatus } = await import('../../types/maker.js');
		updateTaskUnitStatus(repairUnitId, TaskUnitStatus.READY);
	}

	handleGateDecision(ctx, gateId, action, rationale);

	if (isRepairEscalation) {
		await ctx.resumeAfterGate();
	}
}

/**
 * Handle a verification gate decision (OVERRIDE, RETRY_VERIFY, REFRAME).
 */
export async function handleVerificationGateDecision(
	ctx: PanelContext,
	gateId: string,
	action: string,
	claimRationales?: Record<string, string>
): Promise<void> {
	if (!ctx.activeDialogueId) {return;}

	switch (action) {
		case 'OVERRIDE': {
			if (claimRationales) {
				for (const [claimId, rationale] of Object.entries(claimRationales)) {
					if (rationale && rationale.trim().length > 0) {
						writeClaimEvent({
							claim_id: claimId,
							event_type: ClaimEventType.OVERRIDDEN,
							source: Role.HUMAN,
							evidence_ref: rationale.trim(),
						});
					}
				}
			}

			const combinedRationale = Object.entries(claimRationales ?? {})
				.filter(([, r]) => r.trim().length > 0)
				.map(([id, r]) => `[${id}]: ${r.trim()}`)
				.join('\n');

			const input: HumanGateDecisionInput = {
				gateId,
				action: HumanAction.OVERRIDE,
				rationale: combinedRationale || 'Risk accepted by human',
				decisionMaker: 'human-user',
			};
			const result = processHumanGateDecision(input);

			if (result.success) {
				vscode.window.showInformationMessage('Verification risks accepted. Continuing workflow.');
				await ctx.resumeAfterGate();
			} else {
				vscode.window.showErrorMessage(`Gate decision failed: ${result.error.message}`);
			}
			break;
		}

		case 'RETRY_VERIFY': {
			const gateResult = getGate(gateId);
			if (!gateResult.success) {
				vscode.window.showErrorMessage(`Failed to get gate: ${gateResult.error.message}`);
				return;
			}

			const retryInput: HumanGateDecisionInput = {
				gateId,
				action: HumanAction.REJECT,
				rationale: 'Retrying verification — claims reset to OPEN',
				decisionMaker: 'human-user',
			};
			const decisionResult = processHumanGateDecision(retryInput);

			if (decisionResult.success) {
				resolveGate({
					gateId,
					decisionId: decisionResult.value.decision_id,
					resolution: 'Retrying verification',
				});
			}

			const db = getDatabase();
			if (db) {
				for (const claimId of gateResult.value.blocking_claims) {
					db.prepare('UPDATE claims SET status = ? WHERE claim_id = ?')
						.run(ClaimStatus.OPEN, claimId);
					db.prepare('DELETE FROM verdicts WHERE claim_id = ?')
						.run(claimId);
				}
			}

			ctx.isProcessing = true;
			ctx.postInputEnabled(false);
			ctx.postProcessing(true, 'Retrying verification', 'Re-verifying claims');
			try {
				await ctx.runWorkflowCycle();
			} finally {
				ctx.isProcessing = false;
				ctx.postProcessing(false);
				ctx.postInputEnabled(true);
			}
			break;
		}

		case 'REFRAME': {
			const reframeInput: HumanGateDecisionInput = {
				gateId,
				action: HumanAction.REFRAME,
				rationale: 'User requested replanning after verification',
				decisionMaker: 'human-user',
			};
			const reframeResult = processHumanGateDecision(reframeInput);

			if (reframeResult.success) {
				resolveGate({
					gateId,
					decisionId: reframeResult.value.decision_id,
					resolution: 'Replanning after verification failure',
				});
			}

			transitionWorkflow(
				ctx.activeDialogueId,
				Phase.REPLAN,
				TransitionTrigger.REPLAN_REQUIRED,
				{ reason: 'Verification gate reframe' }
			);

			ctx.update();
			vscode.window.showInformationMessage('Workflow returned to replanning.');
			break;
		}
	}

	runNarrativeCuration(ctx.activeDialogueId, CurationMode.FEEDBACK).catch(() => {});
}

/**
 * Handle review gate decisions: APPROVE or REFRAME.
 */
export async function handleReviewGateDecision(
	ctx: PanelContext,
	gateId: string,
	action: string,
	itemRationales?: Record<string, string>,
	overallFeedback?: string
): Promise<void> {
	if (!ctx.activeDialogueId) {return;}

	switch (action) {
		case 'APPROVE': {
			const parts: string[] = [];
			if (itemRationales) {
				for (const [key, rationale] of Object.entries(itemRationales)) {
					if (rationale && rationale.trim().length > 0) {
						parts.push(`[${key}]: ${rationale.trim()}`);
						if (!key.startsWith('finding-')) {
							writeClaimEvent({
								claim_id: key,
								event_type: ClaimEventType.OVERRIDDEN,
								source: Role.HUMAN,
								evidence_ref: rationale.trim(),
							});
						}
					}
				}
			}
			if (overallFeedback && overallFeedback.trim()) {
				parts.push(`[Overall]: ${overallFeedback.trim()}`);
			}

			const combinedRationale = parts.join('\n') || 'Approved after review';

			const input: HumanGateDecisionInput = {
				gateId,
				action: HumanAction.APPROVE,
				rationale: combinedRationale,
				decisionMaker: 'human-user',
			};
			const result = processHumanGateDecision(input);

			if (result.success) {
				transitionWorkflow(
					ctx.activeDialogueId!,
					Phase.EXECUTE,
					TransitionTrigger.PHASE_COMPLETE
				);
				vscode.window.showInformationMessage('Review approved. Continuing to execution.');
				await ctx.resumeAfterGate();
			} else {
				vscode.window.showErrorMessage(`Review decision failed: ${result.error.message}`);
			}
			break;
		}

		case 'REFRAME': {
			const reframeParts: string[] = [];
			if (itemRationales) {
				for (const [key, rat] of Object.entries(itemRationales)) {
					if (rat && rat.trim().length > 0) {
						reframeParts.push(`[${key}]: ${rat.trim()}`);
						if (!key.startsWith('finding-')) {
							writeClaimEvent({
								claim_id: key,
								event_type: ClaimEventType.OVERRIDDEN,
								source: Role.HUMAN,
								evidence_ref: `Review feedback (reframe): ${rat.trim()}`,
							});
						}
					}
				}
			}
			if (overallFeedback && overallFeedback.trim()) {
				reframeParts.push(overallFeedback.trim());
			}
			const rationale = reframeParts.length > 0
				? reframeParts.join('\n')
				: 'Changes requested after review';

			const reframeInput: HumanGateDecisionInput = {
				gateId,
				action: HumanAction.REFRAME,
				rationale,
				decisionMaker: 'human-user',
			};
			const reframeResult = processHumanGateDecision(reframeInput);

			if (reframeResult.success) {
				resolveGate({
					gateId,
					decisionId: reframeResult.value.decision_id,
					resolution: 'Changes requested after review',
				});
			}

			const reframeDb = getDatabase();
			if (reframeDb) {
				const blockingClaims = reframeDb.prepare(
					`SELECT claim_id FROM claims
					 WHERE dialogue_id = ?
					   AND criticality = 'CRITICAL'
					   AND (status = 'DISPROVED' OR status = 'UNKNOWN')`
				).all(ctx.activeDialogueId) as Array<{ claim_id: string }>;

				for (const { claim_id } of blockingClaims) {
					reframeDb.prepare('UPDATE claims SET status = ? WHERE claim_id = ?')
						.run(ClaimStatus.OPEN, claim_id);
					reframeDb.prepare('DELETE FROM verdicts WHERE claim_id = ?')
						.run(claim_id);
				}
			}

			updateWorkflowMetadata(ctx.activeDialogueId, {
				replanRationale: rationale,
			});

			transitionWorkflow(
				ctx.activeDialogueId,
				Phase.REPLAN,
				TransitionTrigger.REPLAN_REQUIRED,
				{ reason: 'Review gate: changes requested' }
			);

			vscode.window.showInformationMessage('Changes requested — replanning proposal.');
			await ctx.resumeAfterGate();
			break;
		}
	}

	if (ctx.activeDialogueId) {
		runNarrativeCuration(ctx.activeDialogueId, CurationMode.FEEDBACK).catch(() => {});
	}
}
