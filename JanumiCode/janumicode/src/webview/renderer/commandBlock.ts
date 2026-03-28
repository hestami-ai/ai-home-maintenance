/**
 * Command block and tool call card renderers for the webview.
 */

import { esc, formatTimestamp } from './utils';
import type { WorkflowCommandRecord, WorkflowCommandOutput } from './streamTypes';

// ==================== Helpers ====================

function getCommandIcon(commandType: string): string {
	switch (commandType) {
		case 'cli_invocation': return '&#x1F4BB;';
		case 'llm_api_call': return '&#x2728;';
		case 'role_invocation': return '&#x1F916;';
		default: return '&#x2699;';
	}
}

function getCommandTypeLabel(commandType: string): string {
	switch (commandType) {
		case 'cli_invocation': return 'CLI';
		case 'llm_api_call': return 'API';
		case 'role_invocation': return 'Role';
		default: return 'CMD';
	}
}

function getStatusIcon(status: string): string {
	switch (status) {
		case 'running': return '<span class="command-block-spinner"></span>';
		case 'success': return '&#x2705;';
		case 'error': return '&#x274C;';
		default: return '';
	}
}

// ==================== Tool Card Body ====================

function buildToolCardBodyHtml(
	toolName: string,
	input: string,
	output: string,
	filePath: string | undefined,
	hasOutput: boolean,
): string {
	const lowerName = toolName.toLowerCase();

	// Bash/command_exec: IN + OUT code blocks
	if (/bash|shell|command/i.test(lowerName)) {
		let html = '';
		if (input) {
			html += `<div class="tool-card-section">` +
				`<span class="tool-card-label">IN</span>` +
				`<div class="tool-card-code">${esc(input)}</div>` +
				`</div>`;
		}
		if (hasOutput && output) {
			html += `<div class="tool-card-section">` +
				`<span class="tool-card-label">OUT</span>` +
				`<div class="tool-card-code tool-card-output">${esc(output)}</div>` +
				`</div>`;
		}
		return html;
	}

	// Read/file_read: file path inline, output as code block
	if (/read/i.test(lowerName)) {
		let html = '';
		const displayPath = filePath ?? input;
		if (displayPath) {
			html += `<div class="tool-card-inline">${esc(displayPath)}</div>`;
		}
		if (hasOutput && output) {
			html += `<div class="tool-card-section">` +
				`<span class="tool-card-label">OUT</span>` +
				`<div class="tool-card-code tool-card-output">${esc(output)}</div>` +
				`</div>`;
		}
		return html;
	}

	// Glob: pattern inline, results below
	if (/glob/i.test(lowerName)) {
		let html = '';
		if (input) {
			html += `<div class="tool-card-inline">${esc(input)}</div>`;
		}
		if (hasOutput && output) {
			html += `<div class="tool-card-results">${esc(output)}</div>`;
		}
		return html;
	}

	// Write/Edit/file_write: file path inline only
	if (/write|edit|create/i.test(lowerName)) {
		const displayPath = filePath ?? input;
		if (displayPath) {
			return `<div class="tool-card-inline">${esc(displayPath)}</div>`;
		}
		return '';
	}

	// Generic: IN and OUT code blocks
	let html = '';
	if (input) {
		html += `<div class="tool-card-section">` +
			`<span class="tool-card-label">IN</span>` +
			`<div class="tool-card-code">${esc(input)}</div>` +
			`</div>`;
	}
	if (hasOutput && output) {
		html += `<div class="tool-card-section">` +
			`<span class="tool-card-label">OUT</span>` +
			`<div class="tool-card-code tool-card-output">${esc(output)}</div>` +
			`</div>`;
	}
	return html;
}

// ==================== Tool Call Card ====================

export function renderToolCallCard(
	toolInput: WorkflowCommandOutput,
	toolOutput: WorkflowCommandOutput | null,
): string {
	let toolName = toolInput.tool_name ?? 'Tool';
	let input = '';
	let filePath: string | undefined;

	try {
		const parsed = JSON.parse(toolInput.content);
		toolName = parsed.toolName ?? toolName;
		input = parsed.input ?? '';
		filePath = parsed.filePath;
	} catch {
		input = toolInput.content;
	}

	let output = '';
	let status: 'success' | 'error' | 'running' = toolOutput ? 'success' : 'running';

	if (toolOutput) {
		try {
			const parsed = JSON.parse(toolOutput.content);
			output = parsed.output ?? '';
			status = parsed.status === 'error' ? 'error' : 'success';
		} catch {
			output = toolOutput.content;
		}
	}

	const timestamp = formatTimestamp(toolInput.timestamp);
	const bodyHtml = buildToolCardBodyHtml(toolName, input, output, filePath, !!toolOutput);

	return `
		<div class="tool-call-card">
			<div class="tool-call-header">
				<span class="tool-call-dot ${status}"></span>
				<span class="tool-call-name">${esc(toolName)}</span>
				<span class="tool-call-time">${timestamp}</span>
			</div>
			${bodyHtml}
		</div>
	`;
}

// ==================== Standalone Tool Output ====================

export function renderStandaloneToolOutput(record: WorkflowCommandOutput): string {
	let toolName = record.tool_name ?? 'Tool';
	let output = '';
	let input = '';
	let status: 'success' | 'error' = 'success';

	try {
		const parsed = JSON.parse(record.content);
		toolName = parsed.toolName ?? toolName;
		output = parsed.output ?? '';
		status = parsed.status === 'error' ? 'error' : 'success';
	} catch {
		output = record.content;
	}

	const timestamp = formatTimestamp(record.timestamp);
	const bodyHtml = buildToolCardBodyHtml(toolName, input, output, undefined, true);

	return `
		<div class="tool-call-card">
			<div class="tool-call-header">
				<span class="tool-call-dot ${status}"></span>
				<span class="tool-call-name">${esc(toolName)}</span>
				<span class="tool-call-time">${timestamp}</span>
			</div>
			${bodyHtml}
		</div>
	`;
}

// ==================== Command Block ====================

export function renderCommandBlock(
	command: WorkflowCommandRecord,
	outputs: WorkflowCommandOutput[],
	hasReview?: boolean,
): string {
	const blockId = `cmd-${esc(command.command_id)}`;
	const expandedClass = command.collapsed ? '' : ' expanded';
	const statusClass = `status-${command.status}`;
	const icon = getCommandIcon(command.command_type);
	const typeLabel = getCommandTypeLabel(command.command_type);
	const statusIcon = getStatusIcon(command.status);
	const time = formatTimestamp(command.started_at);

	// Build output lines with tool card support for tool_input/tool_output pairs
	let outputLines = '';
	let i = 0;
	while (i < outputs.length) {
		const o = outputs[i];

		if (o.line_type === 'tool_input') {
			let toolOutput: WorkflowCommandOutput | null = null;
			if (i + 1 < outputs.length && outputs[i + 1].line_type === 'tool_output') {
				toolOutput = outputs[i + 1];
				i += 2;
			} else {
				i += 1;
			}
			outputLines += renderToolCallCard(o, toolOutput);
			continue;
		}

		if (o.line_type === 'tool_output') {
			outputLines += renderStandaloneToolOutput(o);
			i += 1;
			continue;
		}

		if (o.line_type === 'stdin') {
			const sizeLabel = o.content.length < 1024
				? `${o.content.length} chars`
				: `${(o.content.length / 1024).toFixed(1)} KB`;
			outputLines += `<div class="cmd-stdin-block">` +
				`<div class="cmd-stdin-header" data-action="toggle-stdin">` +
					`<span class="cmd-stdin-chevron">&#x25B6;</span>` +
					`<span class="cmd-stdin-label">── stdin ──</span>` +
					`<span class="cmd-stdin-size">${sizeLabel}</span>` +
				`</div>` +
				`<div class="cmd-stdin-content"><pre>${esc(o.content)}</pre></div>` +
			`</div>`;
			i += 1;
			continue;
		}

		// Reasoning reviews are rendered as standalone stream items
		if (o.line_type === 'reasoning_review') {
			i += 1;
			continue;
		}

		// Flat line rendering (summary, detail, error)
		const lineClass = o.line_type === 'error' ? 'error' : o.line_type;
		outputLines += `<span class="cmd-line ${lineClass}">${esc(o.content)}</span>`;
		i += 1;
	}

	// Split output into visible/hidden sections for large outputs
	const OUTPUT_COLLAPSE_THRESHOLD = 20;
	const OUTPUT_VISIBLE_LINES = 10;

	const lineMatches = outputLines.match(/<span class="cmd-line|<div class="cmd-stdin-block|<div class="tool-call-card/g);
	const outputLineCount = lineMatches ? lineMatches.length : 0;

	let outputHtml: string;
	if (outputLineCount > OUTPUT_COLLAPSE_THRESHOLD) {
		const lineRegex = /(<span class="cmd-line[^>]*>.*?<\/span>|<div class="cmd-stdin-block[\s\S]*?<\/div>\s*<\/div>|<div class="tool-call-card[\s\S]*?<\/div>\s*<\/div>\s*<\/div>)/g;
		const allLines: string[] = [];
		let match: RegExpExecArray | null;
		let lastIndex = 0;
		while ((match = lineRegex.exec(outputLines)) !== null) {
			if (match.index > lastIndex) {
				const between = outputLines.slice(lastIndex, match.index);
				if (allLines.length > 0) { allLines[allLines.length - 1] += between; }
			}
			allLines.push(match[0]);
			lastIndex = match.index + match[0].length;
		}

		const visibleLines = allLines.slice(0, OUTPUT_VISIBLE_LINES).join('');
		const hiddenLines = allLines.slice(OUTPUT_VISIBLE_LINES).join('');
		const hiddenCount = allLines.length - OUTPUT_VISIBLE_LINES;
		const totalChars = outputLines.length;
		const sizeLabel = totalChars < 1024
			? `${totalChars} chars`
			: totalChars < 1048576
				? `${(totalChars / 1024).toFixed(1)} KB`
				: `${(totalChars / 1048576).toFixed(1)} MB`;

		outputHtml = `<div class="cmd-output-collapsed">`
			+ `<div class="cmd-output-visible">${visibleLines}</div>`
			+ `<div class="cmd-output-hidden" style="display:none;">${hiddenLines}</div>`
			+ `<button class="cmd-output-expand-btn" data-action="toggle-cmd-output" data-expand-label="Show ${hiddenCount} more lines (${sizeLabel})">`
			+ `Show ${hiddenCount} more lines (${sizeLabel})`
			+ `</button>`
			+ `</div>`;
	} else {
		outputHtml = outputLines;
	}

	const retryBar = command.status === 'error'
		? `<div class="command-block-actions">
				<button class="command-block-retry-btn" data-action="retry-phase">Retry</button>
			</div>`
		: '';

	return `
		<div id="${blockId}" class="command-block ${statusClass}${expandedClass}" data-command-id="${esc(command.command_id)}">
			<div class="command-block-header" data-action="toggle-command">
				<span class="command-block-chevron">&#x25B6;</span>
				<span class="command-block-icon">${icon}</span>
				<span class="command-block-label">${esc(command.label)}</span>
				<span class="command-block-type">${typeLabel}</span>
				<span class="command-block-status ${command.status}">${statusIcon}</span>
				${hasReview ? '<span class="command-block-review-badge">&#x1F50D; Review</span>' : ''}
				<span class="command-block-time">${time}</span>
			</div>
			<div class="command-block-body">
				<div class="command-block-output">${outputHtml}</div>
				${retryBar}
			</div>
		</div>
	`;
}
