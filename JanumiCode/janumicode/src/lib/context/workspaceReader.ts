/**
 * Workspace File Reader
 * Provides functions to scan and read workspace files (specs, code, docs)
 * for inclusion in context packs sent to LLM roles.
 */

import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Result } from '../types';
import { CodedError } from '../types';

/**
 * A workspace file with its content and metadata
 */
export interface WorkspaceFile {
	/** Absolute path */
	absolutePath: string;
	/** Path relative to workspace root */
	relativePath: string;
	/** File content (may be truncated) */
	content: string;
	/** Original size in bytes */
	sizeBytes: number;
	/** Whether content was truncated to fit budget */
	truncated: boolean;
	/** File extension (e.g. '.md', '.ts') */
	extension: string;
}

/**
 * Options for scanning workspace files
 */
export interface WorkspaceScanOptions {
	/** Glob patterns to include (e.g. '**\/*.md') */
	includePatterns?: string[];
	/** Glob patterns to exclude */
	excludePatterns?: string[];
	/** Maximum number of files to return */
	maxFiles?: number;
	/** Maximum size per file in bytes (files larger are skipped or truncated) */
	maxFileSizeBytes?: number;
	/** Whether to truncate large files instead of skipping them */
	truncateLargeFiles?: boolean;
	/** Specific folder paths (relative to workspace root) to scan */
	folderPaths?: string[];
}

/**
 * Result of a workspace scan
 */
export interface WorkspaceScanResult {
	files: WorkspaceFile[];
	totalFilesFound: number;
	totalSizeBytes: number;
	truncatedCount: number;
	skippedCount: number;
}

/**
 * Default scan options
 */
const DEFAULT_SCAN_OPTIONS: Required<WorkspaceScanOptions> = {
	includePatterns: ['**/*.md', '**/*.txt', '**/*.json', '**/*.yaml', '**/*.yml'],
	excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/out/**'],
	maxFiles: 100,
	maxFileSizeBytes: 50_000, // 50KB per file
	truncateLargeFiles: true,
	folderPaths: [],
};

/**
 * Get the workspace root path
 */
export function getWorkspaceRoot(): string | undefined {
	return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Find files in specific folders using VS Code workspace API
 */
async function findFilesInFolders(
	workspaceRoot: string,
	opts: Required<WorkspaceScanOptions>
): Promise<vscode.Uri[]> {
	const files: vscode.Uri[] = [];
	const excludeGlob = opts.excludePatterns.length > 0
		? `{${opts.excludePatterns.join(',')}}`
		: undefined;

	for (const folderPath of opts.folderPaths) {
		const absoluteFolder = path.isAbsolute(folderPath)
			? folderPath
			: path.join(workspaceRoot, folderPath);

		for (const pattern of opts.includePatterns) {
			const relPattern = new vscode.RelativePattern(absoluteFolder, pattern);
			const found = await vscode.workspace.findFiles(
				relPattern,
				excludeGlob,
				opts.maxFiles - files.length
			);
			files.push(...found);

			if (files.length >= opts.maxFiles) {
				return files;
			}
		}
	}

	return files;
}

/**
 * Find files across the entire workspace
 */
async function findFilesInWorkspace(
	opts: Required<WorkspaceScanOptions>
): Promise<vscode.Uri[]> {
	const includeGlob = opts.includePatterns.length === 1
		? opts.includePatterns[0]
		: `{${opts.includePatterns.join(',')}}`;
	const excludeGlob = opts.excludePatterns.length > 0
		? `{${opts.excludePatterns.join(',')}}`
		: undefined;

	return vscode.workspace.findFiles(includeGlob, excludeGlob, opts.maxFiles);
}

/**
 * Read a single file, optionally truncating it
 */
async function readFileContent(
	filePath: string,
	maxSizeBytes: number
): Promise<{ content: string; truncated: boolean }> {
	const stat = await fs.stat(filePath);

	if (stat.size <= maxSizeBytes) {
		return { content: await fs.readFile(filePath, 'utf-8'), truncated: false };
	}

	const buffer = Buffer.alloc(maxSizeBytes);
	const fd = await fs.open(filePath, 'r');
	try {
		await fd.read(buffer, 0, maxSizeBytes, 0);
	} finally {
		await fd.close();
	}
	const content = buffer.toString('utf-8').replace(/\0+$/, '') + '\n\n... [truncated]';
	return { content, truncated: true };
}

/**
 * Scan workspace for files matching the given options
 *
 * @param options Scan options
 * @returns Result containing scan results
 */
export async function scanWorkspaceFiles(
	options?: WorkspaceScanOptions
): Promise<Result<WorkspaceScanResult>> {
	try {
		const workspaceRoot = getWorkspaceRoot();
		if (!workspaceRoot) {
			return {
				success: false,
				error: new CodedError('NO_WORKSPACE', 'No workspace folder is open'),
			};
		}

		const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };

		const fileUris = opts.folderPaths.length > 0
			? await findFilesInFolders(workspaceRoot, opts)
			: await findFilesInWorkspace(opts);

		const result: WorkspaceScanResult = {
			files: [],
			totalFilesFound: fileUris.length,
			totalSizeBytes: 0,
			truncatedCount: 0,
			skippedCount: 0,
		};

		for (const fileUri of fileUris) {
			const filePath = fileUri.fsPath;
			const stat = await fs.stat(filePath);

			if (stat.size > opts.maxFileSizeBytes && !opts.truncateLargeFiles) {
				result.skippedCount++;
				continue;
			}

			const { content, truncated } = await readFileContent(filePath, opts.maxFileSizeBytes);
			if (truncated) {
				result.truncatedCount++;
			}

			result.files.push({
				absolutePath: filePath,
				relativePath: path.relative(workspaceRoot, filePath),
				content,
				sizeBytes: stat.size,
				truncated,
				extension: path.extname(filePath),
			});

			result.totalSizeBytes += content.length;
		}

		return { success: true, value: result };
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'WORKSPACE_SCAN_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Read a specific file from the workspace
 *
 * @param relativePath Path relative to workspace root
 * @param maxSizeBytes Maximum size to read
 * @returns Result containing the file
 */
export async function readWorkspaceFile(
	relativePath: string,
	maxSizeBytes: number = 50_000
): Promise<Result<WorkspaceFile>> {
	try {
		const workspaceRoot = getWorkspaceRoot();
		if (!workspaceRoot) {
			return {
				success: false,
				error: new CodedError(
					'NO_WORKSPACE',
					'No workspace folder is open'
				),
			};
		}

		const absolutePath = path.join(workspaceRoot, relativePath);
		const stat = await fs.stat(absolutePath);

		let content: string;
		let truncated = false;

		if (stat.size > maxSizeBytes) {
			const buffer = Buffer.alloc(maxSizeBytes);
			const fd = await fs.open(absolutePath, 'r');
			try {
				await fd.read(buffer, 0, maxSizeBytes, 0);
			} finally {
				await fd.close();
			}
			content = buffer.toString('utf-8').replace(/\0+$/, '');
			content += '\n\n... [truncated]';
			truncated = true;
		} else {
			content = await fs.readFile(absolutePath, 'utf-8');
		}

		return {
			success: true,
			value: {
				absolutePath,
				relativePath,
				content,
				sizeBytes: stat.size,
				truncated,
				extension: path.extname(absolutePath),
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'FILE_READ_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Scan specification files from a known specs folder
 * Convenience function for the common case of reading spec documents.
 *
 * @param specsFolderPath Relative path to specs folder (e.g. 'specs/hestami-ai-property-os-specs')
 * @param maxFiles Maximum number of spec files to include
 * @param maxFileSizeBytes Maximum size per file
 * @returns Result containing scan results
 */
export async function scanSpecFiles(
	specsFolderPath: string,
	maxFiles: number = 50,
	maxFileSizeBytes: number = 50_000
): Promise<Result<WorkspaceScanResult>> {
	return scanWorkspaceFiles({
		folderPaths: [specsFolderPath],
		includePatterns: ['**/*.md', '**/*.txt', '**/*.json', '**/*.yaml', '**/*.yml', '**/*.rst'],
		excludePatterns: ['**/node_modules/**', '**/.git/**'],
		maxFiles,
		maxFileSizeBytes,
		truncateLargeFiles: true,
	});
}

/**
 * Format workspace files into a string suitable for LLM context injection
 *
 * @param files Array of workspace files
 * @param tokenBudget Approximate token budget (1 token ≈ 4 chars)
 * @returns Formatted string with file contents
 */
export function formatWorkspaceFilesForContext(
	files: WorkspaceFile[],
	tokenBudget: number = 5000
): string {
	const charBudget = tokenBudget * 4; // rough approximation
	const parts: string[] = [];
	let totalChars = 0;

	// Header
	const header = `# Workspace Files (${files.length} files)\n\n`;
	parts.push(header);
	totalChars += header.length;

	for (const file of files) {
		const fileHeader = `## ${file.relativePath}\n`;
		const fileContent = `\`\`\`\n${file.content}\n\`\`\`\n\n`;
		const entryLength = fileHeader.length + fileContent.length;

		if (totalChars + entryLength > charBudget) {
			// Add a note about remaining files
			const remaining = files.length - parts.length + 1;
			if (remaining > 0) {
				parts.push(`\n... (${remaining} more files omitted due to token budget)\n`);
			}
			break;
		}

		parts.push(fileHeader, fileContent);
		totalChars += entryLength;
	}

	return parts.join('');
}
