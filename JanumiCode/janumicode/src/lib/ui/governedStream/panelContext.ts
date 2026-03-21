/**
 * Shared context interface for extracted GovernedStreamPanel handlers.
 * Provides access to panel state and core methods without coupling to the class.
 */

import * as vscode from 'vscode';

export interface PanelContext {
	/** Active dialogue ID (read/write) */
	activeDialogueId: string | null;
	/** Whether a workflow is currently executing (read/write) */
	isProcessing: boolean;
	/** The webview instance */
	readonly view: vscode.WebviewView | undefined;

	// Core methods
	postProcessing(active: boolean, phase?: string, detail?: string): void;
	postInputEnabled(enabled: boolean): void;
	update(): void;
	runWorkflowCycle(): Promise<void>;
	resumeAfterGate(): Promise<void>;
}
