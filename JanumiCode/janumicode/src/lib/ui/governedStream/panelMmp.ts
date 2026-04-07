/**
 * MMP (Mirror & Menu Protocol) handlers for GovernedStreamPanel.
 * Extracted to reduce main class LOC — handles partial saves, submissions, and review decisions.
 */

import type { PanelContext } from './panelContext';
import { randomUUID } from 'node:crypto';
import { getWorkflowState, updateWorkflowMetadata } from '../../workflow/stateMachine';
import { writeDialogueEvent } from '../../events/writer';
import { getLogger, getTraceContext, isLoggerInitialized } from '../../logging';
import {
	getActiveDatabaseConnectionMode,
	getActiveDatabaseInstanceId,
	getActiveDatabasePath,
} from '../../database';
import {
	savePendingMmpDecisions,
	deletePendingMmpDecisions,
} from '../../database/pendingMmpStore';
import {
	saveDraftsBatch,
	deleteAllDrafts,
	deleteDraftsByCategory,
} from '../../database/draftStore';

/**
 * Handle partial MMP save — persists in-progress decisions to SQLite.
 */
export function handleMmpPartialSave(
	activeDialogueId: string | null,
	message: { type: string; [key: string]: unknown }
): void {
	if (!activeDialogueId) {return;}
	const cardId = message.cardId as string;
	const mirrorDecisions = message.mirrorDecisions as Record<string, { status: string; editedText?: string }> || {};
	const menuSelections = message.menuSelections as Record<string, { selectedOptionId: string; customResponse?: string }> || {};
	const preMortemDecisions = message.preMortemDecisions as Record<string, { status: string; rationale?: string }> || {};

	const log = isLoggerInitialized() ? getLogger().child({ component: 'mmpSubmit' }) : undefined;
	log?.debug('partialSave', { dialogueId: activeDialogueId, cardId, mirrorKeys: Object.keys(mirrorDecisions), menuKeys: Object.keys(menuSelections), pmKeys: Object.keys(preMortemDecisions) });

	try {
		savePendingMmpDecisions(
			activeDialogueId,
			cardId,
			{
				mirrorDecisions,
				menuSelections,
				preMortemDecisions,
				productEdits: message.productEdits as Record<string, string> || {},
			}
		);
	} catch (err) {
		log?.error('partialSaveError', { error: err });
	}
}

/**
 * Handle draft save — persists user input drafts to SQLite.
 */
export function handleDraftSave(
	activeDialogueId: string | null,
	message: { type: string; drafts?: Array<{ category: string; itemKey: string; value: string }> }
): void {
	if (!activeDialogueId || !message.drafts?.length) {return;}
	try {
		saveDraftsBatch(activeDialogueId, message.drafts);
	} catch { /* non-critical */ }
}

/**
 * Handle draft clear — removes consumed drafts from SQLite.
 */
export function handleDraftClear(
	activeDialogueId: string | null,
	message: { type: string; category?: string }
): void {
	if (!activeDialogueId) {return;}
	try {
		if (message.category) {
			deleteDraftsByCategory(activeDialogueId, message.category);
		} else {
			deleteAllDrafts(activeDialogueId);
		}
	} catch { /* non-critical */ }
}

/**
 * Handle MMP submission — formats decisions as structured text and feeds into INTAKE cycle.
 */
export async function handleMMPSubmit(
	ctx: PanelContext,
	message: { type: string; [key: string]: unknown }
): Promise<void> {
	const log = isLoggerInitialized() ? getLogger().child({ component: 'mmpSubmit' }) : undefined;
	const cardId = (message.cardId as string) || '';
	const correlationId = getTraceContext()?.traceId ?? randomUUID().slice(0, 8);
	let phase = 'UNKNOWN';

	const baseLogData = (result: string): Record<string, unknown> => ({
		dialogueId: ctx.activeDialogueId ?? 'NONE',
		activeDialogueId: ctx.activeDialogueId ?? 'NONE',
		cardId: cardId || 'UNKNOWN',
		phase,
		subState: 'PRODUCT_REVIEW',
		dbPath: getActiveDatabasePath() ?? 'none',
		dbInstanceId: getActiveDatabaseInstanceId() ?? 'none',
		dbConnectionMode: getActiveDatabaseConnectionMode(),
		correlationId,
		result,
	});

	const logEvent = (
		level: 'debug' | 'info' | 'warn' | 'error',
		event: string,
		result: string,
		data: Record<string, unknown> = {}
	): void => {
		if (!log) { return; }
		const payload = { ...baseLogData(result), ...data };
		switch (level) {
			case 'debug': log.debug(event, payload); break;
			case 'info': log.info(event, payload); break;
			case 'warn': log.warn(event, payload); break;
			case 'error': log.error(event, payload); break;
		}
	};

	if (!ctx.activeDialogueId) {
		logEvent('error', 'submitInvariantViolation', 'rejected', {
			severity: 'HIGH',
			invariant: 'active_dialogue_present',
			reason: 'No active dialogue',
		});
		ctx.postToWebview({ type: 'mmpSubmitRejected', cardId, reason: 'No active dialogue' });
		return;
	}

	const workflowState = getWorkflowState(ctx.activeDialogueId);
	if (!workflowState.success) {
		logEvent('error', 'submitInvariantViolation', 'rejected', {
			severity: 'HIGH',
			invariant: 'workflow_state_exists',
			reason: workflowState.error.message,
		});
		ctx.postToWebview({
			type: 'mmpSubmitRejected',
			cardId,
			reason: `Cannot submit decisions: ${workflowState.error.message}`,
		});
		return;
	}
	phase = workflowState.value.current_phase;

	if (ctx.isProcessing) {
		logEvent('warn', 'submitRejected', 'rejected', { reason: 'Processing in progress' });
		ctx.postToWebview({ type: 'mmpSubmitRejected', cardId, reason: 'Processing in progress — please wait' });
		return;
	}

	const mirrorDecisions = message.mirrorDecisions as Record<string, { status: string; editedText?: string; text?: string }> || {};
	const menuSelections = message.menuSelections as Record<string, { selectedOptionId: string; customResponse?: string; question?: string; selectedLabel?: string }> || {};
	const preMortemDecisions = message.preMortemDecisions as Record<string, { status: string; rationale?: string; assumption?: string }> || {};

	const lines: string[] = ['[MMP Decisions]'];

	const mirrorEntries = Object.entries(mirrorDecisions);
	if (mirrorEntries.length > 0) {
		for (const [id, decision] of mirrorEntries) {
			const text = decision.text ? `"${decision.text}"` : id;
			if (decision.status === 'accepted') {
				lines.push(`ACCEPTED: ${text}`);
			} else if (decision.status === 'rejected') {
				lines.push(`REJECTED: ${text}`);
			} else if (decision.status === 'deferred') {
				lines.push(`DEFERRED: ${text}`);
			} else if (decision.status === 'edited' && decision.editedText) {
				lines.push(`EDITED: ${text} → "${decision.editedText}"`);
			}
		}
	}

	const menuEntries = Object.entries(menuSelections);
	if (menuEntries.length > 0) {
		for (const [id, selection] of menuEntries) {
			const question = selection.question ? `"${selection.question}"` : id;
			if (selection.selectedOptionId === 'OTHER' && selection.customResponse) {
				lines.push(`SELECTED: ${question} → OTHER: "${selection.customResponse}"`);
			} else {
				const label = selection.selectedLabel || selection.selectedOptionId;
				lines.push(`SELECTED: ${question} → "${label}"`);
			}
		}
	}

	const pmEntries = Object.entries(preMortemDecisions);
	if (pmEntries.length > 0) {
		for (const [id, decision] of pmEntries) {
			const text = decision.assumption ? `"${decision.assumption}"` : id;
			if (decision.status === 'accepted') {
				lines.push(`RISK_ACCEPTED: ${text}`);
			} else if (decision.status === 'rejected') {
				lines.push(`RISK_REJECTED: ${text}${decision.rationale ? ' — Reason: "' + decision.rationale + '"' : ''}`);
			}
		}
	}

	const productEdits = message.productEdits as Record<string, string> | undefined;
	if (productEdits) {
		for (const [field, value] of Object.entries(productEdits)) {
			if (value) {
				lines.push(`PRODUCT_EDIT (${field}): "${value}"`);
			}
		}
	}

	const formattedText = lines.join('\n');
	logEvent('info', 'submitBegin', 'started', {
		textLength: formattedText.length,
		startsWithMMP: formattedText.startsWith('[MMP Decisions]'),
		mirrorCount: mirrorEntries.length,
		menuCount: menuEntries.length,
		preMortemCount: pmEntries.length,
	});

	// Write metadata FIRST — fail fast if this doesn't work
	const metaResult = updateWorkflowMetadata(ctx.activeDialogueId, {
		pendingIntakeInput: formattedText,
	});

	if (!metaResult.success) {
		logEvent('error', 'submitInvariantViolation', 'rejected', {
			severity: 'HIGH',
			invariant: 'metadata_write_succeeds',
			error: metaResult.error.message,
		});
		ctx.postToWebview({ type: 'mmpSubmitRejected', cardId, reason: `Failed to save decisions: ${metaResult.error.message}` });
		return;
	}
	logEvent('info', 'submitMetadataWriteSucceeded', 'metadata_saved');

	writeDialogueEvent({
		dialogue_id: ctx.activeDialogueId,
		event_type: 'human_message',
		role: 'HUMAN',
		phase: 'INTAKE',
		speech_act: 'DECISION',
		summary: `MMP decisions: ${mirrorEntries.length} mirror, ${menuEntries.length} menu, ${pmEntries.length} risk`,
		content: formattedText,
	});

	ctx.isProcessing = true;
	ctx.postInputEnabled(false);
	ctx.postProcessing(true, 'Planning', 'Discussing with Technical Expert');

	try {
		await ctx.runWorkflowCycle();
		// Delete pending decisions only after workflow handoff completed.
		try {
			if (cardId) {
				const deleteResult = deletePendingMmpDecisions(ctx.activeDialogueId, cardId);
				if (!deleteResult.success) {
					logEvent('warn', 'submitPendingDeleteFailed', 'accepted_with_cleanup_warning', { error: deleteResult.error.message });
				}
			}
		} catch { /* non-critical */ }

		ctx.postToWebview({ type: 'mmpSubmitAccepted', cardId });
		logEvent('info', 'submitAccepted', 'accepted');
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		logEvent('error', 'submitCycleFailed', 'rejected', { error: reason });
		ctx.postToWebview({ type: 'mmpSubmitRejected', cardId, reason: `Failed to process decisions: ${reason}` });
	} finally {
		ctx.isProcessing = false;
		ctx.postProcessing(false);
		ctx.postInputEnabled(true);
	}
}

/**
 * Handle MMP decisions from a review gate context.
 * Converts MMP decisions into itemRationales format for the review gate handler.
 */
export function buildReviewMmpDecision(
	activeDialogueId: string | null,
	message: { type: string; [key: string]: unknown }
): { gateId: string; action: string; itemRationales: Record<string, string>; overallFeedback: string } | null {
	const gateId = message.gateId as string;
	if (!gateId || !activeDialogueId) {return null;}

	try {
		const cardId = message.cardId as string;
		if (cardId) { deletePendingMmpDecisions(activeDialogueId, cardId); }
	} catch { /* non-critical */ }

	const preMortemDecisions = (message.preMortemDecisions ?? {}) as Record<
		string, { status: string; rationale?: string; assumption?: string }
	>;
	const menuSelections = (message.menuSelections ?? {}) as Record<
		string, { selectedOptionId: string; customResponse?: string; question?: string; selectedLabel?: string }
	>;

	const itemRationales: Record<string, string> = {};
	let hasRejectedRisks = false;

	for (const [id, decision] of Object.entries(preMortemDecisions)) {
		const claimId = id.startsWith('REV-RISK-') ? id.substring('REV-RISK-'.length) : null;
		if (!claimId || claimId.startsWith('FINDING-')) {continue;}

		if (decision.status === 'accepted') {
			itemRationales[claimId] = `[MMP] Risk accepted: ${decision.assumption ?? 'claim risk acknowledged'}`;
		} else {
			hasRejectedRisks = true;
			const reason = decision.rationale ? ` — ${decision.rationale}` : '';
			itemRationales[claimId] = `[MMP] Risk rejected: ${decision.assumption ?? 'claim risk blocked'}${reason}`;
		}
	}

	for (const [id, selection] of Object.entries(menuSelections)) {
		const claimId = id.startsWith('REV-MENU-') ? id.substring('REV-MENU-'.length) : null;
		if (!claimId) {continue;}

		const label = selection.selectedLabel || selection.selectedOptionId;
		if (label === 'Block on this') {hasRejectedRisks = true;}
		itemRationales[claimId] = `[MMP] Decision: ${label}`;
	}

	const overallParts = Object.entries(itemRationales).map(
		([key, rationale]) => `${key}: ${rationale}`
	);
	const overallFeedback = overallParts.length > 0
		? `[MMP Review Decisions]\n${overallParts.join('\n')}`
		: 'MMP review decisions submitted';

	const action = hasRejectedRisks ? 'REFRAME' : 'APPROVE';
	return { gateId, action, itemRationales, overallFeedback };
}
