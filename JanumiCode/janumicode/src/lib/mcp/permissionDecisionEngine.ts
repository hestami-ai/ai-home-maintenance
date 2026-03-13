/**
 * Permission Decision Engine
 * Pure-function logic for evaluating tool permission requests.
 * Separated from the bridge for testability.
 *
 * Three-tier decision:
 *   Tier 1 — Pre-approved: tool is in the explicit allow-list
 *   Tier 2 — Scope check: read-only tools always safe, writes checked against scope
 *   Tier 3 — Human decision: everything else requires human approval
 */

import * as path from 'path';

// ==================== TYPES ====================

export interface PermissionRequest {
	tool: string;
	input: Record<string, unknown>;
}

export interface PermissionEvaluation {
	decision: 'approve' | 'deny' | 'ask_human';
	reason: string;
}

// ==================== DECISION ENGINE ====================

/**
 * Evaluate a permission request against the allow-list, scope constraints,
 * and session approvals.
 */
export function evaluatePermission(
	request: PermissionRequest,
	allowedTools: string[],
	maxChangeScope: string | undefined,
	sessionApprovals: Set<string>,
): PermissionEvaluation {
	const toolName = request.tool;

	// Tier 1: Explicit allow-list
	if (allowedTools.includes(toolName)) {
		return { decision: 'approve', reason: `Tool "${toolName}" is in the pre-approved list` };
	}

	// Tier 1b: Session-level "Approve All" memory
	if (sessionApprovals.has(toolName)) {
		return { decision: 'approve', reason: `Tool "${toolName}" was approved for this session` };
	}

	// Tier 2: Read-only tools — always safe
	if (isReadOnlyTool(toolName)) {
		return { decision: 'approve', reason: `Tool "${toolName}" is read-only` };
	}

	// Tier 2: Bash with read-only command
	if (isBashLike(toolName) && isReadOnlyCommand(request.input)) {
		return { decision: 'approve', reason: 'Bash command is read-only' };
	}

	// Tier 2: Write/Edit within scope
	if (isWriteTool(toolName) && maxChangeScope) {
		const filePath = extractFilePath(request.input);
		if (filePath && isWithinScope(filePath, maxChangeScope)) {
			return { decision: 'approve', reason: `Write to "${filePath}" is within scope "${maxChangeScope}"` };
		}
	}

	// Tier 2: Bash write command within scope
	if (isBashLike(toolName) && maxChangeScope) {
		const command = extractBashCommand(request.input);
		if (command && !isReadOnlyCommandStr(command)) {
			// Non-read-only bash — ask human
			return {
				decision: 'ask_human',
				reason: `Bash command requires human approval: ${command.substring(0, 80)}`,
			};
		}
	}

	// Tier 3: Human decision required
	return {
		decision: 'ask_human',
		reason: `Tool "${toolName}" requires human approval`,
	};
}

// ==================== CLASSIFICATION HELPERS ====================

const READ_ONLY_TOOLS = new Set(['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch']);

function isReadOnlyTool(toolName: string): boolean {
	return READ_ONLY_TOOLS.has(toolName);
}

function isBashLike(toolName: string): boolean {
	return /^(Bash|shell|command)$/i.test(toolName);
}

function isWriteTool(toolName: string): boolean {
	return /^(Write|Edit|NotebookEdit)$/i.test(toolName);
}

/**
 * Detect read-only Bash commands by pattern matching the command string.
 */
const READ_ONLY_SIMPLE_COMMANDS = new Set([
	'ls', 'dir', 'cat', 'head', 'tail', 'wc', 'echo', 'pwd', 'which',
	'type', 'file', 'stat', 'find', 'tree', 'du', 'df', 'env', 'printenv',
	'uname', 'whoami', 'hostname', 'date', 'where',
]);

const READ_ONLY_GIT_SUBCOMMANDS = new Set([
	'status', 'log', 'diff', 'show', 'branch', 'remote',
	'rev-parse', 'describe', 'tag',
]);

function isReadOnlyCommand(input: Record<string, unknown>): boolean {
	const command = extractBashCommand(input);
	if (!command) { return false; }
	return isReadOnlyCommandStr(command);
}

function isReadOnlyCommandStr(command: string): boolean {
	const firstWord = command.trimStart().split(/\s+/)[0];
	if (READ_ONLY_SIMPLE_COMMANDS.has(firstWord)) { return true; }
	if (firstWord === 'git') {
		const secondWord = command.trimStart().split(/\s+/)[1];
		if (secondWord && READ_ONLY_GIT_SUBCOMMANDS.has(secondWord)) { return true; }
		if (secondWord === 'stash' && command.trimStart().split(/\s+/)[2] === 'list') { return true; }
	}
	return false;
}

function extractBashCommand(input: Record<string, unknown>): string | undefined {
	if (typeof input.command === 'string') { return input.command; }
	if (typeof input.cmd === 'string') { return input.cmd; }
	return undefined;
}

function extractFilePath(input: Record<string, unknown>): string | undefined {
	if (typeof input.file_path === 'string') { return input.file_path; }
	if (typeof input.path === 'string') { return input.path; }
	return undefined;
}

/**
 * Check if a file path is within the allowed scope directory.
 */
function isWithinScope(filePath: string, scope: string): boolean {
	const resolved = path.resolve(filePath);
	const scopeResolved = path.resolve(scope);
	return resolved.startsWith(scopeResolved + path.sep) || resolved === scopeResolved;
}
