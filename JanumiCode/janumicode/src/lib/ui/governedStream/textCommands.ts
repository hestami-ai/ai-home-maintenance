/**
 * Smart Text Command System for the GovernedStreamPanel.
 * Parses user text input for commands like "retry", "approve", "reframe"
 * and determines available actions based on current workflow state.
 */

import { GateStatus } from '../../types';
import { getWorkflowState, type StateMetadata } from '../../workflow/stateMachine';
import { getGatesForDialogue } from '../../workflow/gates';
import { getDatabase } from '../../database';

// ==================== COMMAND PARSING ====================

export interface ParsedCommand {
	command: string;         // Normalized command name (lowercase)
	args: string;            // Everything after the command keyword
	raw: string;             // Original input text
}

/**
 * Known command keywords mapped to their canonical names.
 */
const COMMAND_ALIASES: Record<string, string> = {
	'retry': 'retry',
	'redo': 'retry',
	'rerun': 'retry',
	'approve': 'approve',
	'ok': 'approve',
	'accept': 'approve',
	'reframe': 'reframe',
	'replan': 'reframe',
	'override': 'override',
	'skip': 'override',
};

/**
 * Attempt to parse user input as a text command.
 * Returns null if the input is not a recognized command.
 *
 * Matching rules:
 * - Case-insensitive
 * - Matches first word (optionally preceded by "/" slash)
 * - Remaining text becomes args (trimmed)
 *
 * Examples:
 *   "retry"                -> { command: 'retry', args: '' }
 *   "/retry"               -> { command: 'retry', args: '' }
 *   "Approve looks good"   -> { command: 'approve', args: 'looks good' }
 *   "Hello world"          -> null (not a command)
 */
export function parseTextCommand(text: string): ParsedCommand | null {
	const trimmed = text.trim();
	if (!trimmed) { return null; }

	// Extract first word, optionally prefixed with "/"
	const match = trimmed.match(/^\/?\s*(\S+)(.*)$/);
	if (!match) { return null; }

	const firstWord = match[1].toLowerCase();
	const rest = (match[2] || '').trim();

	const canonicalCommand = COMMAND_ALIASES[firstWord];
	if (!canonicalCommand) { return null; }

	return {
		command: canonicalCommand,
		args: rest,
		raw: trimmed,
	};
}

// ==================== RETRYABLE ACTION ASSESSMENT ====================

export type RetryActionKind =
	| 'retry_verification'      // Re-run VERIFY phase (reset claims, re-verify)
	| 'retry_repair'            // Override repair escalation (reset unit to READY)
	| 'retry_phase'             // Re-run current failed phase
	;

export interface RetryableAction {
	kind: RetryActionKind;
	label: string;              // Human-readable label for option chips
	description: string;        // Short description of what this retry does
	gateId?: string;            // Associated gate ID (for gate-based retries)
}

/**
 * Assess what retry actions are available for the current dialogue state.
 * Checks:
 *   1. Open verification gate → retry_verification
 *   2. Open repair escalation gate → retry_repair
 *   3. Failed workflow phase (lastFailedPhase in metadata) → retry_phase
 */
export function assessRetryableActions(dialogueId: string): RetryableAction[] {
	const actions: RetryableAction[] = [];

	// Get open gates for this dialogue
	const gatesResult = getGatesForDialogue(dialogueId, GateStatus.OPEN);
	const openGates = gatesResult.success ? gatesResult.value : [];

	for (const gate of openGates) {
		const action = classifyGateAsRetryAction(gate);
		if (action) { actions.push(action); }
	}

	// Check for failed workflow phase (no gate needed)
	const wsResult = getWorkflowState(dialogueId);
	if (wsResult.success) {
		const metadata = JSON.parse(wsResult.value.metadata) as StateMetadata;
		if (metadata.lastFailedPhase) {
			actions.push({
				kind: 'retry_phase',
				label: `Retry ${metadata.lastFailedPhase}`,
				description: `Re-run the failed ${metadata.lastFailedPhase} phase`,
			});
		}
	}

	return actions;
}

/**
 * Classify an open gate as a retryable action, or return null if not retryable.
 */
function classifyGateAsRetryAction(gate: import('../../types').Gate): RetryableAction | null {
	const metadata = readGateMetadata(gate.gate_id);

	// Verification gate detection:
	// 1. Has blocking claims (standard verification gates)
	// 2. Has VERIFICATION_FAILURE condition in metadata (all-claims-failed gate)
	// 3. Fallback: MANUAL_GATE with "Verification failed" in reason text (legacy)
	const isVerificationGate =
		gate.blocking_claims.length > 0 ||
		metadata?.condition === 'VERIFICATION_FAILURE' ||
		(metadata?.condition === 'MANUAL_GATE' && gate.reason.startsWith('Verification failed'));

	if (isVerificationGate) {
		const claimCount = gate.blocking_claims.length
			|| (metadata?.failedClaimCount as number | undefined)
			|| 0;
		return {
			kind: 'retry_verification',
			label: 'Retry Verification',
			description: claimCount > 0
				? `Re-verify ${claimCount} claim(s) with updated context`
				: 'Re-run verification phase',
			gateId: gate.gate_id,
		};
	}

	// Repair escalation gate (via gate_metadata)
	if (metadata?.condition === 'REPAIR_ESCALATION') {
		const unitLabel = metadata.unit_label as string | undefined;
		return {
			kind: 'retry_repair',
			label: 'Retry Repair',
			description: unitLabel
				? `Allow one more repair attempt for "${unitLabel}"`
				: 'Allow one more repair attempt for the failed unit',
			gateId: gate.gate_id,
		};
	}

	return null;
}

/**
 * Read gate metadata from the gate_metadata table.
 */
function readGateMetadata(gateId: string): Record<string, unknown> | null {
	try {
		const db = getDatabase();
		if (!db) { return null; }

		const row = db.prepare(
			'SELECT metadata FROM gate_metadata WHERE gate_id = ?'
		).get(gateId) as { metadata: string } | undefined;

		if (!row) { return null; }
		return JSON.parse(row.metadata) as Record<string, unknown>;
	} catch {
		return null;
	}
}
