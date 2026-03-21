/**
 * File picker and @-mention suggestion handlers for GovernedStreamPanel.
 * Extracted to reduce main class LOC.
 */

import * as vscode from 'vscode';

export async function handlePickFile(webview: vscode.Webview): Promise<void> {
	const uris = await vscode.window.showOpenDialog({
		canSelectMany: false,
		openLabel: 'Attach File',
		filters: {
			'Documents': ['md', 'txt', 'json', 'yaml', 'yml', 'rst'],
			'Code': ['ts', 'js', 'py', 'rs', 'go', 'java', 'tsx', 'jsx'],
			'All Files': ['*'],
		},
	});

	if (!uris || uris.length === 0) {
		return;
	}

	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	const filePath = uris[0].fsPath;
	const relativePath = workspaceRoot
		? filePath.replace(workspaceRoot, '').replace(/^[\\/]/, '')
		: filePath;

	webview.postMessage({
		type: 'fileAttached',
		filePath: relativePath,
	});
}

export async function handleMentionSuggestions(webview: vscode.Webview): Promise<void> {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceRoot) {
		return;
	}

	const excludePattern = '{**/node_modules/**,**/dist/**,**/.git/**,**/out/**,**/.vscode/**}';

	try {
		const files = await vscode.workspace.findFiles('**/*', excludePattern, 200);
		const relativePaths = files
			.map((f) => f.fsPath.replace(workspaceRoot, '').replace(/^[\\/]/, ''))
			.sort((a, b) => a.localeCompare(b));

		webview.postMessage({
			type: 'mentionSuggestions',
			files: relativePaths,
		});
	} catch {
		// Silently fail — mention suggestions are best-effort
	}
}
