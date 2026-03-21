import * as vscode from 'vscode';
import type { PanelContext } from './panelContext';
import { HumanAction, GateStatus } from '../../types';
import { resolveGate, getGatesForDialogue } from '../../workflow/gates';
import { transitionWorkflow, TransitionTrigger } from '../../workflow/stateMachine';

/**
 * Handles Approve/Revise/Skip decisions on architecture gates.
 */
export async function handleArchitectureGateDecision(
    ctx: PanelContext,
    message: { type: string; [key: string]: unknown }
): Promise<void> {
    if (!ctx.activeDialogueId || ctx.isProcessing) {return;}
    const action = message.action as string;
    const dialogueId = message.dialogueId as string;
    const docId = message.docId as string;
    const feedback = message.feedback as string | undefined;
    if (!action || !dialogueId) {return;}

    const gates = getGatesForDialogue(dialogueId);
    if (!gates.success) { vscode.window.showErrorMessage('Failed to find architecture gate'); return; }
    const pendingGate = gates.value.find(g => g.status === GateStatus.OPEN);
    if (!pendingGate) { vscode.window.showErrorMessage('No pending architecture gate found'); return; }

    const { captureHumanDecision } = await import('../../roles/human.js');
    const humanAction = action === 'APPROVE' ? HumanAction.APPROVE : action === 'SKIP' ? HumanAction.OVERRIDE : HumanAction.REFRAME;
    const rationale = action === 'REVISE' ? (feedback || 'Requested architecture changes') : `Architecture ${action.toLowerCase()}`;
    const decisionResult = captureHumanDecision({ gateId: pendingGate.gate_id, action: humanAction, rationale, decisionMaker: 'human-user' });

    const decisionId = decisionResult.success ? decisionResult.value.decision_id : `arch-${action.toLowerCase()}-${Date.now()}`;
    resolveGate({ gateId: pendingGate.gate_id, decisionId, resolution: action === 'APPROVE' ? 'approved' : action === 'SKIP' ? 'skipped' : `revision requested: ${feedback?.substring(0, 100) ?? ''}` });

    const { handleArchitectureGateResolution } = await import('../../workflow/architecturePhase.js');
    const result = handleArchitectureGateResolution(dialogueId, action as 'APPROVE' | 'REVISE' | 'SKIP', feedback);
    if (!result.success) { vscode.window.showErrorMessage(`Architecture gate decision failed: ${result.error.message}`); return; }

    const { nextPhase } = result.value;
    ctx.update();

    if (nextPhase) {
        transitionWorkflow(dialogueId, nextPhase, TransitionTrigger.GATE_RESOLVED);
        await ctx.resumeAfterGate();
    } else {
        await ctx.resumeAfterGate();
    }
}

/**
 * Handles deeper decomposition requests for architecture.
 */
export async function handleArchitectureDecomposeDeeper(
    ctx: PanelContext,
    message: { type: string; [key: string]: unknown }
): Promise<void> {
    if (!ctx.activeDialogueId || ctx.isProcessing) {return;}
    const dialogueId = message.dialogueId as string;
    if (!dialogueId) {return;}

    const gates = getGatesForDialogue(dialogueId);
    if (!gates.success) { vscode.window.showErrorMessage('Failed to find architecture gate'); return; }
    const pendingGate = gates.value.find(g => g.status === GateStatus.OPEN);
    if (!pendingGate) { vscode.window.showErrorMessage('No pending architecture gate found'); return; }

    const { captureHumanDecision } = await import('../../roles/human.js');
    const decisionResult = captureHumanDecision({ gateId: pendingGate.gate_id, action: HumanAction.REFRAME, rationale: 'Requested deeper decomposition', decisionMaker: 'human-user' });

    const decisionId = decisionResult.success ? decisionResult.value.decision_id : `arch-deepen-${Date.now()}`;
    resolveGate({ gateId: pendingGate.gate_id, decisionId, resolution: 'decompose deeper requested' });

    const { handleArchitectureDecomposeDeeper } = await import('../../workflow/architecturePhase.js');
    const result = handleArchitectureDecomposeDeeper(dialogueId);
    if (!result.success) { vscode.window.showErrorMessage(`Decompose deeper failed: ${result.error.message}`); return; }

    ctx.update();
    await ctx.resumeAfterGate();
}
