/**
 * Human Gate UI
 * Implements Phase 8.5: Human gate decision interface
 * Provides UI for approving/rejecting/overriding gates
 */

import * as vscode from 'vscode';
import type { Gate, HumanAction } from '../types';
import { getDatabase } from '../database';

/**
 * Show gate decision dialog
 * Displays a gate and captures human decision
 *
 * @param gate Gate to decide on
 * @returns Decision result
 */
export async function showGateDecisionDialog(gate: Gate): Promise<{
	action: HumanAction;
	rationale: string;
} | null> {
	// Show QuickPick for action selection
	const action = await vscode.window.showQuickPick(
		[
			{ label: 'Approve', value: 'APPROVE' as HumanAction },
			{ label: 'Reject', value: 'REJECT' as HumanAction },
			{ label: 'Override', value: 'OVERRIDE' as HumanAction },
			{ label: 'Reframe', value: 'REFRAME' as HumanAction },
			{ label: 'Delegate', value: 'DELEGATE' as HumanAction },
			{ label: 'Escalate', value: 'ESCALATE' as HumanAction },
		],
		{
			placeHolder: 'Select action for this gate',
			title: 'Gate Decision',
		}
	);

	if (!action) {
		return null;
	}

	// Get rationale
	const rationale = await vscode.window.showInputBox({
		prompt: 'Provide rationale for your decision (required)',
		placeHolder: 'Enter your reasoning...',
		validateInput: (value) => {
			if (!value || value.trim().length < 10) {
				return 'Rationale must be at least 10 characters';
			}
			return undefined;
		},
	});

	if (!rationale) {
		return null;
	}

	return {
		action: action.value,
		rationale,
	};
}

/**
 * Show gate notification
 * Displays a notification for an open gate
 *
 * @param gate Gate to notify about
 */
export function showGateNotification(gate: Gate): void {
	vscode.window
		.showWarningMessage(
			`Gate opened: ${gate.reason}`,
			'Resolve Gate',
			'View Details'
		)
		.then((selection) => {
			if (selection === 'Resolve Gate') {
				showGateDecisionDialog(gate);
			} else if (selection === 'View Details') {
				// Show gate details
				vscode.window.showInformationMessage(
					`Gate Details:\nReason: ${gate.reason}\nBlocking Claims: ${gate.blocking_claims.length}`
				);
			}
		});
}

/**
 * Get pending gates count
 * Returns count of open gates
 */
export function getPendingGatesCount(): number {
	const db = getDatabase();
	if (!db) {
		return 0;
	}

	const result = db
		.prepare(
			`
		SELECT COUNT(*) as count
		FROM gates
		WHERE status = 'OPEN'
	`
		)
		.get() as { count: number };

	return result.count;
}
