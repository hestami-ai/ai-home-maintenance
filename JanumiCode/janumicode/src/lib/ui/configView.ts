/**
 * Configuration View
 * Implements Phase 8.6: API configuration interface
 * Provides UI for configuring LLM providers and models
 */

import * as vscode from 'vscode';
import { getSecretKeyManager } from '../config';
import { getProviderForRole } from '../config/manager';

/**
 * Show configuration panel
 * Opens VS Code settings for JanumiCode configuration
 */
export function showConfigurationPanel(): void {
	vscode.commands.executeCommand('workbench.action.openSettings', 'janumicode');
}

/**
 * Validate API configuration
 * Checks if API keys are configured (via SecretStorage/env vars)
 */
export async function validateAPIConfiguration(): Promise<{
	valid: boolean;
	missingKeys: string[];
}> {
	const manager = getSecretKeyManager();
	const missingKeys = await manager.getMissingRoles(getProviderForRole);

	return {
		valid: missingKeys.length === 0,
		missingKeys,
	};
}

/**
 * Show API key configuration wizard
 * Guides user through API key setup
 */
export async function showAPIKeyWizard(): Promise<void> {
	const validation = await validateAPIConfiguration();

	if (validation.valid) {
		vscode.window.showInformationMessage('All API keys are configured!');
		return;
	}

	const configure = await vscode.window.showWarningMessage(
		`Missing API keys for: ${validation.missingKeys.join(', ')}`,
		'Set API Key',
		'Later'
	);

	if (configure === 'Set API Key') {
		vscode.commands.executeCommand('janumicode.setApiKey');
	}
}
