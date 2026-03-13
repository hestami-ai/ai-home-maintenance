/**
 * Stream Exporter - Exports Governed Stream state to Markdown
 * for debugging and AI-assisted troubleshooting.
 */

import type { GovernedStreamState, StreamItem, ReviewItem } from '../ui/governedStream/dataAggregator';
import { Phase } from '../types/index';
import { GateStatus, ClaimStatus } from '../types/index';
import type { DialogueTurn, Claim, Verdict, Gate } from '../types/index';
import type { WorkflowCommandRecord, WorkflowCommandOutput } from '../workflow/commandStore';
import type { IntakeConversationTurn, IntakePlanDocument } from '../types/intake';

/**
 * Export options for chunking
 */
export interface ExportOptions {
	scope: 'current_dialogue' | 'all_dialogues' | 'date_range';
	fromDate?: Date;
	toDate?: Date;
	includeStdin?: boolean;
	includeCommandOutput?: boolean;
}

/**
 * Export a single dialogue to markdown
 */
export function exportDialogueMarkdown(
	dialogueId: string,
	state: GovernedStreamState,
	options: ExportOptions = { scope: 'current_dialogue' }
): string {
	const lines: string[] = [];

	// YAML frontmatter
	const now = new Date().toISOString();
	lines.push('---');
	lines.push(`dialogue_id: ${dialogueId}`);
	lines.push(`exported_at: ${now}`);
	lines.push(`scope: ${options.scope}`);
	if (options.fromDate) {
		lines.push(`from_date: ${options.fromDate.toISOString()}`);
	}
	if (options.toDate) {
		lines.push(`to_date: ${options.toDate.toISOString()}`);
	}
	lines.push('---');
	lines.push('');

	// Title and metadata
	lines.push(`# Governed Stream Export`);
	lines.push('');
	lines.push(`**Dialogue:** \`${dialogueId}\``);
	lines.push(`**Current Phase:** ${state.currentPhase}`);
	lines.push(`**Exported:** ${now}`);
	lines.push('');

	// Dialogue list (if multi-dialogue)
	if (state.dialogueList.length > 1) {
		lines.push(`## Dialogues (${state.dialogueList.length})`);
		lines.push('');
		lines.push('| ID | Title | Status | Phase | Created |');
		lines.push('|----|-------|--------|-------|---------|');
		for (const d of state.dialogueList) {
			const title = d.title ?? d.goal.substring(0, 40);
			lines.push(`| ${d.dialogueId.substring(0, 8)}... | ${escapeMd(title)} | ${d.status} | ${d.currentPhase} | ${d.createdAt} |`);
		}
		lines.push('');
	}

	// Claim health summary
	if (state.claimHealth.total > 0) {
		lines.push(`## Claim Health`);
		lines.push('');
		lines.push(`| Status | Count |`);
		lines.push(`|--------|-------|`);
		lines.push(`| Verified | ${state.claimHealth.verified} |`);
		lines.push(`| Disproved | ${state.claimHealth.disproved} |`);
		lines.push(`| Unknown | ${state.claimHealth.unknown} |`);
		lines.push(`| Conditional | ${state.claimHealth.conditional} |`);
		lines.push(`| Open | ${state.claimHealth.open} |`);
		lines.push(`| **Total** | ${state.claimHealth.total} |`);
		lines.push('');
	}

	// Stream items (the main content)
	lines.push(`## Stream History`);
	lines.push('');

	for (const item of state.streamItems) {
		lines.push(...exportStreamItem(item, options));
		lines.push('');
	}

	// Claims table
	if (state.claims.length > 0) {
		lines.push(`## All Claims (${state.claims.length})`);
		lines.push('');
		lines.push('| ID | Statement | Status | Criticality |');
		lines.push('|----|-----------|--------|-------------|');
		for (const claim of state.claims) {
			const stmt = claim.statement.replaceAll('\n', ' ');
			lines.push(`| ${claim.claim_id.substring(0, 8)}... | ${escapeMd(stmt)} | ${claim.status} | ${claim.criticality} |`);
		}
		lines.push('');
	}

	return lines.join('\n');
}

/**
 * Export a single stream item to markdown lines
 */
function exportStreamItem(item: StreamItem, options: ExportOptions): string[] {
	const lines: string[] = [];

	switch (item.type) {
		case 'dialogue_start':
			lines.push(`### Dialogue Start: \`${item.dialogueId}\``);
			lines.push('');
			lines.push(`**Goal:** ${escapeMd(item.goal)}`);
			if (item.title) {
				lines.push(`**Title:** ${escapeMd(item.title)}`);
			}
			lines.push(`**Started:** ${item.timestamp}`);
			lines.push('');
			lines.push('---');
			break;

		case 'dialogue_end':
			lines.push(`### Dialogue End: \`${item.dialogueId}\``);
			lines.push('');
			lines.push(`**Status:** ${item.status}`);
			lines.push(`**Ended:** ${item.timestamp}`);
			lines.push('');
			lines.push('---');
			break;

		case 'milestone':
			lines.push(`### Phase: ${item.phase}`);
			lines.push('');
			lines.push(`**Started:** ${item.timestamp}`);
			lines.push('');
			lines.push('---');
			break;

		case 'turn':
			lines.push(...exportTurn(item.turn, item.claims, item.verdict));
			break;

		case 'gate':
			lines.push(...exportGate(item.gate, item.blockingClaims, item.resolvedAction));
			break;

		case 'verification_gate':
			lines.push(...exportVerificationGate(item.gate, item.allClaims, item.verdicts, item.blockingClaims, item.resolvedAction));
			break;

		case 'review_gate':
			lines.push(...exportReviewGate(item.gate, item.reviewItems, item.summary, item.historianFindings, item.verdicts, item.resolvedAction, item.resolvedRationale));
			break;

		case 'command_block':
			lines.push(...exportCommandBlock(item.command, item.outputs, options));
			break;

		case 'intake_turn':
			lines.push(...exportIntakeTurn(item.turn, item.commandBlocks, options));
			break;

		case 'intake_plan_preview':
			lines.push(...exportIntakePlanPreview(item.plan, item.isFinal, item.timestamp));
			break;

		case 'intake_approval_gate':
			lines.push(...exportIntakeApprovalGate(item.plan, item.dialogueId, item.timestamp, item.resolved, item.resolvedAction));
			break;

		case 'qa_exchange':
			lines.push(
				`> **Q:** ${escapeMd(item.question)}`,
				`> **A:** ${escapeMd(item.answer)}`,
				'',
			);
			break;
	}

	return lines;
}

/**
 * Export a dialogue turn
 */
function exportTurn(turn: DialogueTurn, claims: Claim[], verdict?: Verdict): string[] {
	const lines: string[] = [];
	const roleIcon = turn.role === 'HUMAN' ? '👤' : turn.role === 'EXECUTOR' ? '🤖' : '⚙️';

	lines.push(`#### Turn ${turn.turn_id} (${turn.role})`);
	lines.push('');
	lines.push(`**Phase:** ${turn.phase} | **Speech Act:** ${turn.speech_act}`);
	lines.push(`**Timestamp:** ${turn.timestamp}`);
	lines.push('');

	// Content
	lines.push('> ' + escapeMd(turn.content_ref).split('\n').join('\n> '));
	lines.push('');

	// Claims introduced
	if (claims.length > 0) {
		lines.push(`**Claims Introduced:** ${claims.length}`);
		for (const c of claims) {
			lines.push(`- [${c.claim_id.substring(0, 8)}] ${escapeMd(c.statement.substring(0, 80))}... (${c.status})`);
		}
		lines.push('');
	}

	// Verdict
	if (verdict) {
		lines.push(`**Verdict:** ${verdict.verdict} — ${escapeMd(verdict.rationale ?? 'No rationale')}`);
		lines.push('');
	}

	return lines;
}

/**
 * Export a basic gate
 */
function exportGate(gate: Gate, blockingClaims: Claim[], resolvedAction?: string): string[] {
	const lines: string[] = [];

	lines.push(`#### Gate: ${gate.gate_id.substring(0, 8)}...`);
	lines.push('');
	lines.push(`**Status:** ${gate.status}`);
	lines.push(`**Created:** ${gate.created_at}`);

	if (resolvedAction) {
		lines.push(`**Resolved Action:** ${resolvedAction}`);
	}

	if (blockingClaims.length > 0) {
		lines.push('');
		lines.push(`**Blocking Claims:** ${blockingClaims.length}`);
		for (const c of blockingClaims) {
			lines.push(`- [${c.claim_id.substring(0, 8)}] ${c.status} — ${escapeMd(c.statement.substring(0, 60))}...`);
		}
	}
	lines.push('');

	return lines;
}

/**
 * Export a verification gate
 */
function exportVerificationGate(
	gate: Gate,
	allClaims: Claim[],
	verdicts: Verdict[],
	blockingClaims: Claim[],
	resolvedAction?: string
): string[] {
	const lines: string[] = [];

	lines.push(`#### Verification Gate: ${gate.gate_id.substring(0, 8)}...`);
	lines.push('');
	lines.push(`**Status:** ${gate.status}`);
	lines.push(`**Created:** ${gate.created_at}`);

	if (resolvedAction) {
		lines.push(`**Resolved Action:** ${resolvedAction}`);
	}
	lines.push('');

	// Blocking claims table
	if (blockingClaims.length > 0) {
		lines.push(`**Blocking Claims:**`);
		lines.push('');
		lines.push('| ID | Statement | Status | Criticality |');
		lines.push('|----|-----------|--------|-------------|');
		for (const c of blockingClaims) {
			const stmt = c.statement.substring(0, 50).replace(/\n/g, ' ');
			lines.push(`| ${c.claim_id.substring(0, 8)}... | ${escapeMd(stmt)}... | ${c.status} | ${c.criticality} |`);
		}
		lines.push('');
	}

	return lines;
}

/**
 * Export a review gate with full detail: all review items, historian findings,
 * per-item verdicts, and human feedback/rationale.
 */
function exportReviewGate(
	gate: Gate,
	reviewItems: ReviewItem[],
	summary: { verified: number; disproved: number; unknown: number; conditional: number; open: number; needsDecisionCount: number; awarenessCount: number; allClearCount: number },
	historianFindings: string[],
	verdicts: Verdict[],
	resolvedAction?: string,
	resolvedRationale?: string
): string[] {
	const lines: string[] = [];

	lines.push(`#### Review Gate: ${gate.gate_id.substring(0, 8)}...`);
	lines.push('');
	lines.push(`**Status:** ${gate.status}`);
	lines.push(`**Created:** ${gate.created_at}`);

	if (resolvedAction) {
		lines.push(`**Resolved Action:** ${resolvedAction}`);
	}
	lines.push('');

	// Summary
	lines.push(`**Summary:**`);
	lines.push(`- Verified: ${summary.verified}`);
	lines.push(`- Disproved: ${summary.disproved}`);
	lines.push(`- Unknown: ${summary.unknown}`);
	lines.push(`- Conditional: ${summary.conditional}`);
	lines.push(`- Open: ${summary.open}`);
	lines.push(`- Needs Decision: ${summary.needsDecisionCount}`);
	lines.push(`- Awareness: ${summary.awarenessCount}`);
	lines.push(`- All Clear: ${summary.allClearCount}`);
	lines.push('');

	// Human feedback (resolved rationale)
	if (resolvedRationale) {
		lines.push(`**Human Feedback:**`);
		lines.push('');
		for (const ratLine of resolvedRationale.split('\n')) {
			const trimmed = ratLine.trim();
			if (trimmed) {
				lines.push(`> ${escapeMd(trimmed)}`);
			}
		}
		lines.push('');
	}

	// Historian findings (full text, no truncation)
	if (historianFindings.length > 0) {
		lines.push(`**Historian Findings (${historianFindings.length}):**`);
		lines.push('');
		for (let i = 0; i < historianFindings.length; i++) {
			lines.push(`${i + 1}. ${escapeMd(historianFindings[i])}`);
			lines.push('');
		}
	}

	// Build verdict lookup for rationale display
	const verdictByClaim = new Map<string, Verdict>();
	for (const v of verdicts) {
		verdictByClaim.set(v.claim_id, v);
	}

	// Review items — all items, grouped by category
	const needsDecision = reviewItems.filter((i) => i.category === 'needs_decision');
	const awareness = reviewItems.filter((i) => i.category === 'awareness');
	const allClear = reviewItems.filter((i) => i.category === 'all_clear');

	if (needsDecision.length > 0) {
		lines.push(`**Needs Decision (${needsDecision.length}):**`);
		lines.push('');
		for (const item of needsDecision) {
			lines.push(...exportReviewItem(item, verdictByClaim));
		}
	}

	if (awareness.length > 0) {
		lines.push(`**For Awareness (${awareness.length}):**`);
		lines.push('');
		for (const item of awareness) {
			lines.push(...exportReviewItem(item, verdictByClaim));
		}
	}

	if (allClear.length > 0) {
		lines.push(`**All Clear (${allClear.length}):**`);
		lines.push('');
		for (const item of allClear) {
			lines.push(...exportReviewItem(item, verdictByClaim));
		}
	}

	return lines;
}

/**
 * Export a single review item (claim or finding) with full detail.
 */
function exportReviewItem(item: ReviewItem, verdictByClaim: Map<string, Verdict>): string[] {
	const lines: string[] = [];

	if (item.kind === 'claim' && item.claim) {
		const claim = item.claim;
		const verdict = item.verdict ?? verdictByClaim.get(claim.claim_id);
		lines.push(`- **[${claim.status}] [${claim.criticality}]** ${escapeMd(claim.statement)}`);
		if (verdict?.rationale) {
			lines.push(`  - *Verifier:* ${escapeMd(verdict.rationale)}`);
		}
	} else if (item.kind === 'finding' && item.findingText) {
		lines.push(`- **[FINDING]** ${escapeMd(item.findingText)}`);
	}
	lines.push('');

	return lines;
}

/**
 * Export a command block
 */
function exportCommandBlock(
	command: WorkflowCommandRecord,
	outputs: WorkflowCommandOutput[],
	options: ExportOptions
): string[] {
	const lines: string[] = [];

	lines.push(`#### Command: ${command.label || command.command_type}`);
	lines.push('');
	lines.push(`**ID:** ${command.command_id.substring(0, 8)}...`);
	lines.push(`**Type:** ${command.command_type}`);
	lines.push(`**Status:** ${command.status}`);
	lines.push(`**Started:** ${command.started_at}`);
	if (command.completed_at) {
		lines.push(`**Completed:** ${command.completed_at}`);
	}
	lines.push('');

	// Stdin (if requested and available)
	if (options.includeStdin) {
		const stdinOutput = outputs.find(o => o.line_type === 'stdin');
		if (stdinOutput) {
			lines.push(`<details>`);
			lines.push(`<summary>Stdin (${stdinOutput.content.length} chars)</summary>`);
			lines.push('');
			lines.push('```');
			lines.push(stdinOutput.content);
			lines.push('```');
			lines.push(`</details>`);
			lines.push('');
		}
	}

	// Output (if requested and available)
	if (options.includeCommandOutput) {
		const textLines = outputs.filter(o =>
			o.line_type !== 'stdin' && o.line_type !== 'tool_input' && o.line_type !== 'tool_output'
		);
		const toolInputs = outputs.filter(o => o.line_type === 'tool_input');
		const toolOutputs = outputs.filter(o => o.line_type === 'tool_output');

		// Text output (summary/detail/error) — same as before
		if (textLines.length > 0) {
			lines.push(`<details>`);
			lines.push(`<summary>Output (${textLines.length} entries)</summary>`);
			lines.push('');
			lines.push('```');
			for (const o of textLines) {
				lines.push(o.content);
			}
			lines.push('```');
			lines.push(`</details>`);
			lines.push('');
		}

		// Tool calls — formatted with tool name, input, result
		if (toolInputs.length > 0) {
			lines.push(`<details>`);
			lines.push(`<summary>Tool Calls (${toolInputs.length})</summary>`);
			lines.push('');
			for (const ti of toolInputs) {
				lines.push(formatToolCallForExport(ti, toolOutputs));
			}
			lines.push(`</details>`);
			lines.push('');
		}
	}

	return lines;
}

/**
 * Format a tool_input record as readable markdown with its matching result.
 */
function formatToolCallForExport(
	toolInput: WorkflowCommandOutput,
	toolOutputs: WorkflowCommandOutput[],
): string {
	const parsed = safeParseJSON(toolInput.content);
	if (!parsed) {
		return `- **Tool call**: \`${toolInput.content.substring(0, 100)}\`\n`;
	}

	const toolName = String(parsed.toolName || parsed.tool || parsed.name || 'Unknown');
	const input = (parsed.input as Record<string, unknown>) || {};
	const inputSummary = String(
		input.command
		|| input.file_path || input.path
		|| input.pattern
		|| JSON.stringify(input).substring(0, 120)
	);

	// Find matching tool_output by toolUseId or timestamp proximity
	const toolUseId = parsed.id || parsed.toolUseId;
	let matchingOutput: WorkflowCommandOutput | undefined;
	if (toolUseId) {
		matchingOutput = toolOutputs.find(to => {
			const toParsed = safeParseJSON(to.content);
			return toParsed && (toParsed.tool_use_id === toolUseId || toParsed.toolUseId === toolUseId);
		});
	}

	let result = '';
	if (matchingOutput) {
		const outParsed = safeParseJSON(matchingOutput.content);
		const status = outParsed?.status || 'completed';
		const output = outParsed?.output || outParsed?.content || '';
		const outputPreview = typeof output === 'string'
			? output.substring(0, 300) + (output.length > 300 ? '...' : '')
			: '';
		result = `  Result: ${status}${outputPreview ? '\n  ```\n  ' + outputPreview + '\n  ```' : ''}`;
	}

	return `- **${toolName}** — \`${inputSummary}\`\n${result}\n`;
}

/** Safely parse JSON, returning null on failure. */
function safeParseJSON(text: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(text);
		return typeof parsed === 'object' && parsed !== null ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * Export an intake turn
 */
function exportIntakeTurn(
	turn: IntakeConversationTurn,
	commandBlocks?: Array<{ command: WorkflowCommandRecord; outputs: WorkflowCommandOutput[] }>,
	options?: ExportOptions
): string[] {
	const lines: string[] = [];

	lines.push(`#### Intake Turn ${turn.turnNumber}`);
	lines.push('');
	lines.push(`**Timestamp:** ${turn.createdAt}`);
	lines.push('');

	// Human message
	lines.push(`**Human:**`);
	lines.push('> ' + escapeMd(turn.humanMessage).split('\n').join('\n> '));
	lines.push('');

	// Expert response
	if (turn.expertResponse?.conversationalResponse) {
		lines.push(`**Technical Expert:**`);
		lines.push('> ' + escapeMd(turn.expertResponse.conversationalResponse).split('\n').join('\n> '));
		lines.push('');
	}

	// Command blocks
	if (commandBlocks && commandBlocks.length > 0) {
		lines.push(`**Commands:** ${commandBlocks.length}`);
		for (const cb of commandBlocks) {
			lines.push(`- ${cb.command.command_type} (${cb.command.status})`);
		}
		lines.push('');
	}

	return lines;
}

/**
 * Export an intake plan preview
 */
function exportIntakePlanPreview(plan: IntakePlanDocument, isFinal: boolean, timestamp: string): string[] {
	const lines: string[] = [];

	lines.push(`#### Intake Plan Preview (${isFinal ? 'Final' : 'Draft'})`);
	lines.push('');
	lines.push(`**Timestamp:** ${timestamp}`);
	lines.push('');

	// Title and summary
	if (plan.title) {
		lines.push(`**Title:** ${escapeMd(plan.title)}`);
		lines.push('');
	}
	if (plan.summary) {
		lines.push(`**Summary:** ${escapeMd(plan.summary)}`);
		lines.push('');
	}

	// Requirements
	if (plan.requirements && plan.requirements.length > 0) {
		lines.push(`**Requirements:**`);
		for (const r of plan.requirements) {
			lines.push(`- [${r.id}] ${escapeMd(r.text)}`);
		}
		lines.push('');
	}

	// Decisions
	if (plan.decisions && plan.decisions.length > 0) {
		lines.push(`**Decisions:**`);
		for (const d of plan.decisions) {
			lines.push(`- [${d.id}] ${escapeMd(d.text)}`);
		}
		lines.push('');
	}

	// Open questions
	if (plan.openQuestions && plan.openQuestions.length > 0) {
		lines.push(`**Open Questions:**`);
		for (const q of plan.openQuestions) {
			lines.push(`- [${q.id}] ${escapeMd(q.text)}`);
		}
		lines.push('');
	}

	return lines;
}

/**
 * Export an intake approval gate
 */
function exportIntakeApprovalGate(
	plan: IntakePlanDocument,
	dialogueId: string,
	timestamp: string,
	resolved?: boolean,
	resolvedAction?: string
): string[] {
	const lines: string[] = [];

	lines.push(`#### Intake Approval Gate`);
	lines.push('');
	lines.push(`**Dialogue:** ${dialogueId}`);
	lines.push(`**Timestamp:** ${timestamp}`);
	lines.push(`**Resolved:** ${resolved ?? false}`);
	if (resolvedAction) {
		lines.push(`**Action:** ${resolvedAction}`);
	}
	lines.push('');

	// Plan summary
	if (plan.title) {
		lines.push(`**Title:** ${escapeMd(plan.title)}`);
	}
	if (plan.summary) {
		lines.push(`**Summary:** ${escapeMd(plan.summary)}`);
	}
	if (plan.requirements?.length) {
		lines.push(`**Requirements:** ${plan.requirements.length}`);
	}
	if (plan.openQuestions?.length) {
		lines.push(`**Open Questions:** ${plan.openQuestions.length}`);
	}
	lines.push('');

	return lines;
}

/**
 * Escape special markdown characters
 */
function escapeMd(text: string): string {
	if (!text) { return ''; }
	return text
		.replace(/\\/g, '\\\\')
		.replace(/\|/g, '\\|')
		.replace(/\*/g, '\\*')
		.replace(/_/g, '\\_')
		.replace(/`/g, '\\`');
}
