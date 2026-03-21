/**
 * API Key management handlers for GovernedStreamPanel.
 * Extracted to reduce main class LOC — handles set/clear/status for role-specific API keys.
 */

import * as vscode from 'vscode';
import { getSecretKeyManager } from '../../config/secretKeyManager';
import { getProviderForRole } from '../../config/manager';
import { clearRoleProviderCache } from '../../llm/roleManager';

const ALL_ROLES = ['executor', 'technicalExpert', 'verifier', 'historianInterpreter'];

const ROLE_DISPLAY_NAMES: Record<string, string> = {
	executor: 'Executor',
	technicalExpert: 'Technical Expert',
	verifier: 'Verifier',
	historianInterpreter: 'Historian–Interpreter',
};

export async function getKeyStatus(): Promise<Array<{
	role: string;
	displayName: string;
	provider: string;
	hasKey: boolean;
}>> {
	const manager = getSecretKeyManager();
	const results = [];

	for (const role of ALL_ROLES) {
		const provider = getProviderForRole(role);
		const key = await manager.getApiKey(role, provider);
		results.push({
			role,
			displayName: ROLE_DISPLAY_NAMES[role] ?? role,
			provider,
			hasKey: !!key,
		});
	}

	return results;
}

export async function sendKeyStatus(webview: vscode.Webview): Promise<void> {
	const keyStatus = await getKeyStatus();
	webview.postMessage({
		type: 'keyStatusUpdate',
		data: { roles: keyStatus },
	});
}

export async function handleSetApiKey(role: string, webview: vscode.Webview): Promise<void> {
	const displayName = ROLE_DISPLAY_NAMES[role] ?? role;
	const provider = getProviderForRole(role);

	const key = await vscode.window.showInputBox({
		password: true,
		prompt: `Enter ${provider} API key for ${displayName}`,
		placeHolder: 'sk-...',
		ignoreFocusOut: true,
	});

	if (!key) {
		return;
	}

	const trimmedKey = key.trim();
	if (!trimmedKey) {
		vscode.window.showWarningMessage('API key cannot be empty.');
		return;
	}

	const manager = getSecretKeyManager();
	await manager.setApiKey(role, trimmedKey);
	clearRoleProviderCache();

	await sendKeyStatus(webview);
	vscode.window.showInformationMessage(`API key set for ${displayName}`);
}

export async function handleClearApiKey(role: string, webview: vscode.Webview): Promise<void> {
	const displayName = ROLE_DISPLAY_NAMES[role] ?? role;
	const manager = getSecretKeyManager();
	await manager.deleteApiKey(role);
	clearRoleProviderCache();

	await sendKeyStatus(webview);
	vscode.window.showInformationMessage(`API key cleared for ${displayName}`);
}
