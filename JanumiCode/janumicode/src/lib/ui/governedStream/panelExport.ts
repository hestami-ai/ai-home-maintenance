/**
 * panelExport.ts — Extracted export/document handler functions from GovernedStreamPanel.
 *
 * These were originally private methods on GovernedStreamPanel; refactored into
 * standalone async functions so the panel file stays focused on lifecycle concerns.
 */

import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// handleExportStream
// ---------------------------------------------------------------------------

/**
 * Export the current (or all) dialogue(s) to a Markdown file in docs/exports.
 */
export async function handleExportStream(
	activeDialogueId: string | null,
): Promise<void> {
	const { exportDialogueMarkdown } = await import('../../export/streamExporter.js');
	const { aggregateStreamState } = await import('./dataAggregator.js');

	const state = aggregateStreamState(activeDialogueId ?? undefined);
	const dialogueId = activeDialogueId ?? 'all';

	const markdown = exportDialogueMarkdown(dialogueId, state, {
		scope: activeDialogueId ? 'current_dialogue' : 'all_dialogues',
		includeStdin: true,
		includeCommandOutput: true,
	});

	const timestamp = new Date()
		.toISOString()
		.replaceAll(/[:.]/g, '-')
		.substring(0, 19);
	const filename = `governed-stream-${dialogueId.substring(0, 8)}-${timestamp}.md`;

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('No workspace folder open. Cannot export stream.');
		return;
	}

	const exportDir = vscode.Uri.joinPath(workspaceFolders[0].uri, 'docs', 'exports');
	await vscode.workspace.fs.createDirectory(exportDir);

	const filePath = vscode.Uri.joinPath(exportDir, filename);
	await vscode.workspace.fs.writeFile(filePath, Buffer.from(markdown, 'utf-8'));

	const doc = await vscode.workspace.openTextDocument(filePath);
	await vscode.window.showTextDocument(doc);
	vscode.window.showInformationMessage(`Exported governed stream to ${filename}`);
}

// ---------------------------------------------------------------------------
// handleGenerateDocument
// ---------------------------------------------------------------------------

/**
 * Show a QuickPick of available document types, generate them via LLM with
 * progress, persist to SQLite, open in editor, and optionally batch-export.
 */
export async function handleGenerateDocument(
	activeDialogueId: string | null,
): Promise<void> {
	const dialogueId = activeDialogueId;
	if (!dialogueId) {
		vscode.window.showWarningMessage('No active dialogue. Start a dialogue first.');
		return;
	}

	// Lazy imports to avoid loading document modules at startup
	const { getAvailableDocuments } = await import('../../documents/registry.js');
	const { generateDocument } = await import('../../documents/generator.js');
	const { upsertGeneratedDocument } = await import('../../documents/documentStore.js');

	// Get available document types for this dialogue
	const available = getAvailableDocuments(dialogueId);
	if (available.length === 0) {
		vscode.window.showInformationMessage(
			'No document types are available for this dialogue yet. ' +
			'The dialogue needs to progress past INTAKE before documents can be generated.',
		);
		return;
	}

	// Show multi-select QuickPick
	const picked = await vscode.window.showQuickPick(
		available.map(def => ({
			label: def.label,
			description: def.type,
			detail: def.description,
			definition: def,
		})),
		{
			placeHolder: 'Select one or more document types to generate',
			title: 'Generate Documents',
			canPickMany: true,
		},
	);

	if (!picked || picked.length === 0) {
		return; // user cancelled
	}

	// Generate all selected documents with progress
	const results = await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Generating ${picked.length} document(s)...`,
			cancellable: false,
		},
		async (progress) => {
			const generated: Array<{ title: string; content: string; label: string }> = [];
			for (let i = 0; i < picked.length; i++) {
				const item = picked[i];
				progress.report({
					message: `(${i + 1}/${picked.length}) ${item.label}`,
					increment: (100 / picked.length),
				});

				try {
					const result = await generateDocument(dialogueId, item.definition);

					// Store in SQLite (upsert)
					const storeResult = upsertGeneratedDocument(
						dialogueId,
						result.documentType,
						result.title,
						result.content,
					);
					if (storeResult && !storeResult.success) {
						vscode.window.showWarningMessage(`Document generated but failed to persist: ${item.label}`);
					}

					generated.push({ title: result.title, content: result.content, label: item.label });
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					vscode.window.showErrorMessage(`Failed to generate ${item.label}: ${msg}`);
				}
			}
			return generated;
		},
	);

	if (results.length === 0) {
		return;
	}

	// Open each generated document in an editor tab
	for (const result of results) {
		const doc = await vscode.workspace.openTextDocument({
			content: result.content,
			language: 'markdown',
		});
		await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
	}

	// Offer batch export
	const labels = results.map(r => r.label).join(', ');
	const exportChoice = await vscode.window.showInformationMessage(
		`Generated: ${labels}`,
		'Export All to Files',
		'Dismiss',
	);

	if (exportChoice === 'Export All to Files') {
		for (const result of results) {
			await exportDocumentContent(result.title, result.content);
		}
	}
}

// ---------------------------------------------------------------------------
// exportDocumentContent
// ---------------------------------------------------------------------------

/**
 * Save markdown content to a user-chosen file via a Save dialog.
 */
export async function exportDocumentContent(
	title: string,
	content: string,
): Promise<void> {
	const suggestedName = title.toLowerCase().replaceAll(/\s+/g, '-') + '.md';
	const uri = await vscode.window.showSaveDialog({
		defaultUri: vscode.Uri.file(suggestedName),
		filters: { 'Markdown': ['md'] },
		title: 'Export Document',
	});
	if (!uri) { return; }

	await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
	vscode.window.showInformationMessage(`Document exported to ${uri.fsPath}`);
}

// ---------------------------------------------------------------------------
// handleReviewRerun
// ---------------------------------------------------------------------------

/** Helper — post a typed message to the webview. */
function postMessage(view: vscode.WebviewView | undefined, type: string, data: Record<string, unknown>): void {
	view?.webview.postMessage({ type, data });
}

/**
 * Re-run the current workflow cycle using corrections from the most recent
 * reasoning review event, optionally augmented with human guidance.
 *
 * The caller must supply a `runWorkflowCycle` callback that triggers the
 * panel's internal workflow loop — this avoids coupling to GovernedStreamPanel.
 */
export async function handleReviewRerun(
	activeDialogueId: string | null,
	view: vscode.WebviewView | undefined,
	guidance?: string,
	runWorkflowCycle?: () => Promise<void>,
): Promise<void> {
	if (!activeDialogueId) { return; }

	const { getDatabase } = await import('../../database/index.js');
	const { updateWorkflowMetadata } = await import('../../workflow/stateMachine.js');

	const db = getDatabase();
	if (!db) { return; }

	const reviewEvent = db.prepare(`
		SELECT content, detail FROM dialogue_events
		WHERE dialogue_id = ? AND event_type = 'reasoning_review'
		ORDER BY event_id DESC LIMIT 1
	`).get(activeDialogueId) as { content: string; detail: string } | undefined;

	if (!reviewEvent) {
		postMessage(view, 'systemMessage', { message: 'No reasoning review found to re-run with.' });
		return;
	}

	const detail = JSON.parse(reviewEvent.detail ?? '{}');
	const concerns = (detail.concerns ?? []) as Array<{ summary: string; recommendation: string }>;
	const corrections = concerns
		.map((c: { summary: string; recommendation: string }) => `- ${c.summary}: ${c.recommendation}`)
		.join('\n');

	const correctionText = [
		'[Reasoning Review Corrections]',
		corrections,
		...(guidance ? [`\n[Human Guidance]\n${guidance}`] : []),
	].join('\n');

	// Feed the corrections as input and re-run the workflow cycle
	const metaResult = updateWorkflowMetadata(activeDialogueId, {
		pendingIntakeInput: correctionText,
	});
	if (!metaResult.success) {
		postMessage(view, 'systemMessage', { message: `Failed to save corrections: ${metaResult.error.message}` });
		return;
	}

	postMessage(view, 'systemMessage', { message: 'Re-running with reasoning review corrections...' });
	postMessage(view, 'setInputEnabled', { enabled: false });
	postMessage(view, 'setProcessing', { active: true, phase: 'Re-running', detail: 'Applying reasoning corrections' });

	try {
		if (runWorkflowCycle) {
			await runWorkflowCycle();
		}
	} finally {
		postMessage(view, 'setProcessing', { active: false, phase: '', detail: '' });
		postMessage(view, 'setInputEnabled', { enabled: true });
	}
}
