/**
 * MMP (Mirror & Menu Protocol) handlers for GovernedStreamPanel.
 * Extracted to reduce main class LOC — handles partial saves, submissions, and review decisions.
 */

import type { PanelContext } from './panelContext';
import { updateWorkflowMetadata } from '../../workflow/stateMachine';
import { writeDialogueEvent } from '../../events/writer';

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

	console.log('[MMP:Host:PartialSave] dialogueId:', activeDialogueId, '| cardId:', cardId,
		'| mirror keys:', Object.keys(mirrorDecisions),
		'| menu keys:', Object.keys(menuSelections),
		'| pm keys:', Object.keys(preMortemDecisions));

	try {
		const { savePendingMmpDecisions } = require('../../database/pendingMmpStore');
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
		console.error('[MMP:Host:PartialSave] Error:', err);
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
		const { saveDraftsBatch } = require('../../database/draftStore');
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
			const { deleteDraftsByCategory } = require('../../database/draftStore');
			deleteDraftsByCategory(activeDialogueId, message.category);
		} else {
			const { deleteAllDrafts } = require('../../database/draftStore');
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
	if (!ctx.activeDialogueId || ctx.isProcessing) {return;}

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

	try {
		const { deletePendingMmpDecisions } = require('../../database/pendingMmpStore');
		const cardId = message.cardId as string;
		if (cardId) { deletePendingMmpDecisions(ctx.activeDialogueId, cardId); }
	} catch { /* non-critical */ }

	ctx.isProcessing = true;
	ctx.postInputEnabled(false);
	ctx.postProcessing(true, 'Planning', 'Processing your decisions');

	try {
		updateWorkflowMetadata(ctx.activeDialogueId, {
			pendingIntakeInput: formattedText,
		});

		writeDialogueEvent({
			dialogue_id: ctx.activeDialogueId,
			event_type: 'human_message',
			role: 'HUMAN',
			phase: 'INTAKE',
			speech_act: 'DECISION',
			summary: `MMP decisions: ${mirrorEntries.length} mirror, ${menuEntries.length} menu, ${pmEntries.length} risk`,
			content: formattedText,
		});

		ctx.postProcessing(true, 'Planning', 'Discussing with Technical Expert');
		await ctx.runWorkflowCycle();
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
		const { deletePendingMmpDecisions } = require('../../database/pendingMmpStore');
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
