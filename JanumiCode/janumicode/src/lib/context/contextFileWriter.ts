/**
 * Context File Writer
 *
 * When context exceeds the inline threshold, writes context sections to
 * workspace files so CLI agents can read them piecemeal using their tool access.
 *
 * File location: .janumicode/context/{dialogueId}/{section}.md
 *
 * The CLI agent's system prompt includes instructions to read these files,
 * leveraging the agent's native file-reading capabilities for large context.
 */

import * as vscode from 'vscode';
import * as path from 'path';

/** Threshold in characters above which context sections are written to files */
const FILE_CONTEXT_THRESHOLD = 100_000; // ~25K tokens at 4 chars/token

/**
 * A context section to potentially write to a file.
 */
export interface ContextSection {
	/** Filename (without path), e.g., "plan.md", "conversation-history.md" */
	name: string;
	/** The content of this section */
	content: string;
}

/**
 * Write context sections to workspace files if total size exceeds threshold.
 * Returns file paths if written, or null if content was small enough to inline.
 *
 * @param dialogueId Dialogue ID for scoping the files
 * @param sections Context sections to write
 * @returns Array of workspace-relative file paths, or null if below threshold
 */
export async function writeContextToFiles(
	dialogueId: string,
	sections: ContextSection[],
): Promise<string[] | null> {
	const totalChars = sections.reduce((sum, s) => sum + s.content.length, 0);

	if (totalChars < FILE_CONTEXT_THRESHOLD) {
		return null; // Small enough to inline
	}

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return null; // No workspace — can't write files
	}

	const workspaceRoot = workspaceFolders[0].uri.fsPath;
	const contextDir = path.join(workspaceRoot, '.janumicode', 'context', dialogueId.substring(0, 8));

	// Ensure directory exists
	const contextDirUri = vscode.Uri.file(contextDir);
	await vscode.workspace.fs.createDirectory(contextDirUri);

	const filePaths: string[] = [];

	for (const section of sections) {
		const filePath = path.join(contextDir, section.name);
		const fileUri = vscode.Uri.file(filePath);
		await vscode.workspace.fs.writeFile(fileUri, Buffer.from(section.content, 'utf-8'));

		// Return workspace-relative path for the CLI agent
		const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
		filePaths.push(relativePath);
	}

	return filePaths;
}

/**
 * Build a prompt instruction telling the CLI agent to read context from files.
 *
 * @param filePaths Workspace-relative file paths
 * @returns Prompt text with file-reading instructions
 */
export function buildFileBasedPrompt(filePaths: string[]): string {
	const fileList = filePaths.map(fp => `- \`${fp}\``).join('\n');

	return [
		'# Context Files',
		'',
		'The full context for this task has been written to workspace files because it exceeds',
		'the inline threshold. Read the following files to get the complete context:',
		'',
		fileList,
		'',
		'IMPORTANT: Read ALL listed files before proceeding. They contain the complete plan,',
		'conversation history, and proposer artifacts that you need to produce a comprehensive output.',
	].join('\n');
}

/**
 * Clean up context files for a completed or abandoned dialogue.
 *
 * @param dialogueId Dialogue ID whose context files should be removed
 */
export async function cleanupContextFiles(dialogueId: string): Promise<void> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return;
	}

	const workspaceRoot = workspaceFolders[0].uri.fsPath;
	const contextDir = path.join(workspaceRoot, '.janumicode', 'context', dialogueId.substring(0, 8));
	const contextDirUri = vscode.Uri.file(contextDir);

	try {
		await vscode.workspace.fs.delete(contextDirUri, { recursive: true });
	} catch {
		// Directory may not exist — that's fine
	}
}

/**
 * Clean up ALL context files (e.g., on extension shutdown).
 */
export async function cleanupAllContextFiles(): Promise<void> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return;
	}

	const workspaceRoot = workspaceFolders[0].uri.fsPath;
	const contextBaseDir = path.join(workspaceRoot, '.janumicode', 'context');
	const contextBaseDirUri = vscode.Uri.file(contextBaseDir);

	try {
		await vscode.workspace.fs.delete(contextBaseDirUri, { recursive: true });
	} catch {
		// Directory may not exist — that's fine
	}
}
