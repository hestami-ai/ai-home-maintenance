/**
 * Smart Text Command System for the GovernedStreamPanel.
 *
 * Two-tier intent detection:
 *   Tier 1 (instant):  Hardcoded alias map — "retry", "redo", "approve", etc.
 *   Tier 2 (LLM):      Lightweight intent classification when Tier 1 misses
 *                       and an open gate provides actionable context.
 *
 * Tier 2 uses the same fast-model pattern as clarificationExpert
 * (gemini-3-flash-lite by default, ~200-500ms latency).
 */

import { GateStatus } from '../../types';
import { getWorkflowState, type StateMetadata } from '../../workflow/stateMachine';
import { getGatesForDialogue } from '../../workflow/gates';
import { getDatabase } from '../../database';
import { getLogger, isLoggerInitialized } from '../../logging';
import { aggregateStreamState, type GovernedStreamState } from './dataAggregator';
import {
	getTaskGraphForDialogue, getTaskUnitsForGraph,
	getIntentRecordForDialogue, getAcceptanceContractForDialogue,
	getRepairPacketsForUnit, getLatestValidationForUnit,
	getOutcomeSnapshotsForDialogue,
} from '../../database/makerStore';
import { getDialogueEvents, getClaims, getVerdicts, getHumanDecisions } from '../../events/reader';
import { executeSafeQuery } from '../../database/sqlQueryExecutor';
import { buildSchemaPrompt } from '../../database/schemaPrompt';

// ==================== COMMAND PARSING ====================

export interface ParsedCommand {
	command: string;         // Normalized command name (lowercase)
	args: string;            // Everything after the command keyword
	raw: string;             // Original input text
}

/**
 * Known command keywords mapped to their canonical names.
 */
const COMMAND_ALIASES: Record<string, string> = {
	'retry': 'retry',
	'redo': 'retry',
	'rerun': 'retry',
	'approve': 'approve',
	'ok': 'approve',
	'accept': 'approve',
	'reframe': 'reframe',
	'replan': 'reframe',
	'override': 'override',
	'skip': 'override',
	'resume': 'resume',
	'continue': 'resume',
	'proceed': 'resume',
	'cancel': 'cancel',
	'stop': 'cancel',
	'abort': 'cancel',
	'save': 'save-output',
	'save-output': 'save-output',
	'write-output': 'save-output',
	'goto': 'navigate',
	'navigate': 'navigate',
	'jump': 'navigate',
	'restart': 'navigate',
	'adopt': 'adopt',
	'use output': 'adopt',
	'use-output': 'adopt',
	'accept output': 'adopt',
};

/**
 * Attempt to parse user input as a text command.
 * Returns null if the input is not a recognized command.
 *
 * Matching rules:
 * - Case-insensitive
 * - Matches first word (optionally preceded by "/" slash)
 * - Remaining text becomes args (trimmed)
 *
 * Examples:
 *   "retry"                -> { command: 'retry', args: '' }
 *   "/retry"               -> { command: 'retry', args: '' }
 *   "Approve looks good"   -> { command: 'approve', args: 'looks good' }
 *   "Hello world"          -> null (not a command)
 */
export function parseTextCommand(text: string): ParsedCommand | null {
	const trimmed = text.trim();
	if (!trimmed) { return null; }

	// Extract first word, optionally prefixed with "/"
	const match = trimmed.match(/^\/?\s*(\S+)(.*)$/);
	if (!match) { return null; }

	const firstWord = match[1].toLowerCase().replace(/[.!?,;:]+$/, '');
	const rest = (match[2] || '').trim();

	const canonicalCommand = COMMAND_ALIASES[firstWord];
	if (!canonicalCommand) { return null; }

	return {
		command: canonicalCommand,
		args: rest,
		raw: trimmed,
	};
}

// ==================== RETRYABLE ACTION ASSESSMENT ====================

export type RetryActionKind =
	| 'retry_verification'      // Re-run VERIFY phase (reset claims, re-verify)
	| 'retry_repair'            // Override repair escalation (reset unit to READY)
	| 'retry_phase'             // Re-run current failed phase
	;

export interface RetryableAction {
	kind: RetryActionKind;
	label: string;              // Human-readable label for option chips
	description: string;        // Short description of what this retry does
	gateId?: string;            // Associated gate ID (for gate-based retries)
	unitId?: string;            // Associated unit ID (for repair retries)
}

/**
 * Assess what retry actions are available for the current dialogue state.
 * Checks:
 *   1. Open verification gate → retry_verification
 *   2. Open repair escalation gate → retry_repair
 *   3. Failed workflow phase (lastFailedPhase in metadata) → retry_phase
 */
export function assessRetryableActions(dialogueId: string): RetryableAction[] {
	const actions: RetryableAction[] = [];

	// Get open gates for this dialogue
	const gatesResult = getGatesForDialogue(dialogueId, GateStatus.OPEN);
	const openGates = gatesResult.success ? gatesResult.value : [];

	for (const gate of openGates) {
		const action = classifyGateAsRetryAction(gate);
		if (action) { actions.push(action); }
	}

	// Check for failed workflow phase (no gate needed)
	const wsResult = getWorkflowState(dialogueId);
	if (wsResult.success) {
		const metadata = JSON.parse(wsResult.value.metadata) as StateMetadata;
		if (metadata.lastFailedPhase) {
			actions.push({
				kind: 'retry_phase',
				label: `Retry ${metadata.lastFailedPhase}`,
				description: `Re-run the failed ${metadata.lastFailedPhase} phase`,
			});
		}
	}

	return actions;
}

/**
 * Classify an open gate as a retryable action, or return null if not retryable.
 */
function classifyGateAsRetryAction(gate: import('../../types').Gate): RetryableAction | null {
	const metadata = readGateMetadata(gate.gate_id);

	// Verification gate detection:
	// 1. Has blocking claims (standard verification gates)
	// 2. Has VERIFICATION_FAILURE condition in metadata (all-claims-failed gate)
	// 3. Fallback: MANUAL_GATE with "Verification failed" in reason text (legacy)
	const isVerificationGate =
		gate.blocking_claims.length > 0 ||
		metadata?.condition === 'VERIFICATION_FAILURE' ||
		(metadata?.condition === 'MANUAL_GATE' && gate.reason.startsWith('Verification failed'));

	if (isVerificationGate) {
		const claimCount = gate.blocking_claims.length
			|| (metadata?.failedClaimCount as number | undefined)
			|| 0;
		return {
			kind: 'retry_verification',
			label: 'Retry Verification',
			description: claimCount > 0
				? `Re-verify ${claimCount} claim(s) with updated context`
				: 'Re-run verification phase',
			gateId: gate.gate_id,
		};
	}

	// Repair escalation gate (via gate_metadata)
	if (metadata?.condition === 'REPAIR_ESCALATION') {
		const unitLabel = metadata.unit_label as string | undefined;
		const unitId = metadata.unit_id as string | undefined;
		return {
			kind: 'retry_repair',
			label: 'Retry Repair',
			description: unitLabel
				? `Allow one more repair attempt for "${unitLabel}"`
				: 'Allow one more repair attempt for the failed unit',
			gateId: gate.gate_id,
			unitId,
		};
	}

	return null;
}

/**
 * Read gate metadata from the gate_metadata table.
 */
function readGateMetadata(gateId: string): Record<string, unknown> | null {
	try {
		const db = getDatabase();
		if (!db) { return null; }

		const row = db.prepare(
			'SELECT metadata FROM gate_metadata WHERE gate_id = ?'
		).get(gateId) as { metadata: string } | undefined;

		if (!row) { return null; }
		return JSON.parse(row.metadata) as Record<string, unknown>;
	} catch {
		return null;
	}
}

// ==================== TIER 2: LLM INPUT INTERPRETER ====================

/**
 * Structured action returned by the LLM input interpreter.
 * Maps to existing command handlers plus new "answer" and "cancel" actions.
 */
export type InterpreterAction =
	| { action: 'retry'; rationale?: string }
	| { action: 'approve'; rationale?: string }
	| { action: 'resume'; rationale?: string }
	| { action: 'reframe'; rationale?: string }
	| { action: 'override'; rationale?: string }
	| { action: 'save_output'; filePath: string }
	| { action: 'answer'; response: string; needsEscalation?: boolean }
	| { action: 'navigate'; target: string; direction?: 'forward' | 'backward' | 'restart' }
	| { action: 'freetext' }
	| { action: 'cancel' };

/**
 * Callback for reporting progress steps during Q&A processing.
 * Called by interpretInput() and escalateQuery() at each processing stage.
 */
export type QaProgressCallback = (step: string) => void;

const INTERPRETER_SYSTEM_PROMPT = `You are an input interpreter for a software development workflow UI. The user is interacting with a governed workflow that has phases, gates (checkpoints requiring human decisions), and task units.

Given the current workflow state and the user's message, determine the appropriate action.

Return a JSON object with one of these shapes:
- {"action":"retry","rationale":"..."} — User wants to retry, redo, rerun, or try again.
- {"action":"resume","rationale":"..."} — User wants to resume, continue, or proceed from where the workflow stopped.
- {"action":"approve","rationale":"..."} — User wants to approve, accept, or confirm.
- {"action":"reframe","rationale":"..."} — User wants to reframe, rethink, replan, or take a different approach.
- {"action":"override","rationale":"..."} — User wants to override, skip, bypass, or force past the current checkpoint.
- {"action":"save_output","filePath":"..."} — User wants to save/write executor output to a specific file path. Extract the path from their message.
- {"action":"answer","response":"...","needsEscalation":false} — User is asking an informational question or requesting data. Match the user's requested format: if they ask for a list, enumerate items; if they ask for a summary, summarize. Set "needsEscalation" to true if you cannot fully answer from the provided context. Use markdown: **bold** for emphasis, bullet lists (- item), numbered lists (1. item).
- {"action":"cancel"} — User wants to cancel, stop, or abort the workflow.
- {"action":"freetext"} — User is providing new instructions, goals, or feedback (NOT a question).

Rules:
- If the user asks a question about the workflow (e.g. "What went wrong?", "How many units are left?", "What phase are we in?", "What are the tasks?"), ALWAYS use "answer". Compose a response from the state context. If the context is insufficient, give the best partial answer and set "needsEscalation" to true.
- NEVER return "freetext" for a question. Questions ALWAYS get "answer". "freetext" is ONLY for new instructions, goals, or feedback — not questions.
- Short affirmatives like "yes", "sure", "go ahead", "do it" → approve.
- "try again", "one more time", "run it again" → retry.
- "skip this", "move on", "force it", "just do it anyway" → override.
- "rethink", "different approach", "change the plan" → reframe.
- If the message mentions a file path with "save", "write", or "export" → save_output with the extracted path.
- If ambiguous between a command action and freetext, prefer freetext — don't misclassify regular input as a command.
- Phase navigation requests like "go back to verify", "re-run from architecture", "skip to review", "jump to execute", "restart intake", "goto decompose" → {"action":"navigate","target":"<phase or sub-phase name as the user expressed it>","direction":"backward|forward|restart"}. Use "backward" for going back, "forward" for skipping ahead, "restart" for starting a phase from scratch. Do NOT normalize the target — pass the user's words directly.
- The "rationale" field should capture the user's reasoning if present, or be omitted.
- Respond ONLY with valid JSON. No markdown, no explanation.`;

/**
 * Build a compact workflow state summary for LLM context injection.
 * Targets ~500-800 tokens of flat text. Reuses aggregateStreamState() for efficiency.
 */
export function buildWorkflowContextSummary(dialogueId: string): string {
	const state = aggregateStreamState(dialogueId);
	const lines: string[] = [];

	// Phase + human-facing state
	lines.push(`**Phase:** ${state.currentPhase}`);
	if (state.humanFacingState) {
		lines.push(`**Status:** ${state.humanFacingState.state} — ${state.humanFacingState.detail}`);
	}

	// Open gates with evaluation context
	if (state.openGates.length > 0) {
		lines.push(`\n**Open gates (${state.openGates.length}):**`);
		for (const gate of state.openGates.slice(0, 3)) {
			let gateDesc = gate.reason;
			const meta = readGateMetadata(gate.gate_id);
			if (meta?.evaluation) {
				const eval_ = meta.evaluation as { summary?: string; completionStatus?: string };
				if (eval_.summary) {
					gateDesc += ` — ${eval_.completionStatus}: ${eval_.summary}`;
				}
			}
			lines.push(`- ${gateDesc}`);
		}
	} else {
		lines.push('No open gates.');
	}

	// Task progress + individual unit listing
	if (state.taskGraphProgress) {
		const p = state.taskGraphProgress;
		lines.push(`\n**Task progress:** ${p.completed}/${p.total} units done, ${p.failed} failed, ${p.in_progress} in progress`);
		if (p.currentUnitLabel) {
			lines.push(`**Current unit:** ${p.currentUnitLabel}`);
		}

		// List individual units with statuses
		const graphResult = getTaskGraphForDialogue(dialogueId);
		if (graphResult.success && graphResult.value) {
			const unitsResult = getTaskUnitsForGraph(graphResult.value.graph_id);
			if (unitsResult.success && unitsResult.value.length > 0) {
				lines.push('');
				for (const unit of unitsResult.value) {
					lines.push(`${unit.sort_order + 1}. **[${unit.status}]** ${unit.label}`);
				}
			}
		}
	}

	// Claim health
	if (state.claimHealth.total > 0) {
		const h = state.claimHealth;
		lines.push(`\n**Claims:** ${h.verified} verified, ${h.disproved} disproved, ${h.unknown} unknown, ${h.open} open (${h.total} total)`);
	}

	// Decision history (resolved gates)
	try {
		const resolvedGates = getGatesForDialogue(dialogueId, GateStatus.RESOLVED);
		if (resolvedGates.success && resolvedGates.value.length > 0) {
			lines.push(`\n**Decisions made (${resolvedGates.value.length}):**`);
			for (const gate of resolvedGates.value) {
				const decResult = getHumanDecisions({ gate_id: gate.gate_id, limit: 1 });
				if (decResult.success && decResult.value.length > 0) {
					const d = decResult.value[0];
					const reason = gate.reason.length > 80 ? gate.reason.substring(0, 77) + '...' : gate.reason;
					lines.push(`- **${d.action}** — ${reason}`);
				}
			}
		}
	} catch { /* optional */ }

	// INTAKE state
	if (state.intakeState) {
		lines.push(`\n**Intake:** ${state.intakeState.subState}, ${state.intakeState.turnCount} turns`);
		if (state.intakeState.currentPlan) {
			lines.push('Plan available for review');
		}
	}

	// Available actions
	const available = computeAvailableActions(dialogueId, state);
	lines.push(`\n**Available actions:** ${available.join(', ')}`);

	return lines.join('\n');
}

/**
 * Derive the list of actions available in the current workflow state.
 */
function computeAvailableActions(dialogueId: string, state: GovernedStreamState): string[] {
	const actions: string[] = [];

	if (state.openGates.length > 0) {
		actions.push('approve', 'override', 'reframe');
	}

	const retryActions = assessRetryableActions(dialogueId);
	if (retryActions.length > 0) {
		actions.push('retry');
	}

	// save_output available when there's gate metadata with executor_output
	for (const gate of state.openGates) {
		const meta = readGateMetadata(gate.gate_id);
		if (meta?.executor_output) {
			actions.push('save_output');
			break;
		}
	}

	actions.push('cancel', 'answer', 'freetext');
	return actions;
}

/**
 * Tier 2 LLM-mediated natural language input interpretation.
 * Called when Tier 1 alias map misses and there's an active dialogue.
 *
 * Returns a structured InterpreterAction, or null if:
 *   - No API key configured
 *   - LLM call fails
 *   - Response can't be parsed
 */
export async function interpretInput(
	text: string,
	dialogueId: string,
	onProgress?: QaProgressCallback,
): Promise<InterpreterAction | null> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'interpreter' })
		: null;

	try {
		const vscode = await import('vscode');
		const config = vscode.workspace.getConfiguration('janumicode');

		const providerName = config.get<string>(
			'curator.provider',
			config.get<string>('evaluator.provider', 'GEMINI')
		);

		const { LLMProvider: LLMProviderEnum } = await import('../../types/index.js');
		const providerEnum =
			LLMProviderEnum[providerName as keyof typeof LLMProviderEnum] ??
			LLMProviderEnum.GEMINI;

		const { getSecretKeyManager } = await import('../../config/secretKeyManager.js');
		const apiKey = await getSecretKeyManager().getApiKey('curator', providerEnum);
		if (!apiKey?.trim()) {
			log?.warn('Tier 2: no API key for curator role');
			return null;
		}

		const model = config.get<string>(
			'curator.model',
			config.get<string>('evaluator.model', 'gemini-3-flash-lite')
		);

		const { createProvider } = await import('../../llm/providerFactory.js');
		const { MessageRole } = await import('../../llm/provider.js');

		const providerResult = createProvider(providerEnum, {
			apiKey: apiKey.trim(),
			defaultModel: model,
		});
		if (!providerResult.success) {
			log?.warn('Tier 2: provider creation failed', { provider: providerName });
			return null;
		}

		const contextSummary = buildWorkflowContextSummary(dialogueId);
		const userMessage = `Current workflow state:\n${contextSummary}\n\nUser message: "${text}"`;

		log?.debug('Tier 2: sending LLM request', { model, provider: providerName, inputLength: userMessage.length });
		onProgress?.('Classifying your question...');

		const result = await providerResult.value.complete({
			systemPrompt: INTERPRETER_SYSTEM_PROMPT,
			messages: [{ role: MessageRole.USER, content: userMessage }],
			model,
			temperature: 0,
		});

		if (!result.success) {
			log?.warn('Tier 2: LLM call failed', { error: String(result.error) });
			return null;
		}

		const raw = result.value.content.trim();
		log?.debug('Tier 2: LLM response', { raw: raw.substring(0, 200) });

		const parsed = parseInterpreterResponse(raw);
		if (!parsed) {
			log?.warn('Tier 2: failed to parse LLM response', { raw: raw.substring(0, 300) });
		}
		return parsed;
	} catch (err) {
		log?.error('Tier 2: unexpected error', { error: String(err) });
		return null;
	}
}

/**
 * Defensively parse the LLM's JSON response into an InterpreterAction.
 * Handles raw JSON, markdown-fenced JSON, JSON embedded in prose, and single-word fallback.
 */
function parseInterpreterResponse(raw: string): InterpreterAction | null {
	const parsed = extractJson(raw);
	if (parsed) { return parsed; }

	// Single-word intent fallback (backward compat)
	const word = raw.toLowerCase().trim();
	if (['retry', 'approve', 'reframe', 'override'].includes(word)) {
		return { action: word as 'retry' | 'approve' | 'reframe' | 'override' };
	}
	return null;
}

/** Try multiple strategies to extract a JSON action object from raw LLM output. */
function extractJson(raw: string): InterpreterAction | null {
	// Strategy 1: markdown-fenced JSON
	const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenceMatch) {
		const result = tryParseAction(fenceMatch[1].trim());
		if (result) { return result; }
	}

	// Strategy 2: raw string is valid JSON
	const direct = tryParseAction(raw);
	if (direct) { return direct; }

	// Strategy 3: extract first {...} block from surrounding prose
	const braceMatch = raw.match(/\{[\s\S]*\}/);
	if (braceMatch) {
		const result = tryParseAction(braceMatch[0]);
		if (result) { return result; }
	}

	return null;
}

/** Parse a JSON string into an InterpreterAction, or return null. */
function tryParseAction(json: string): InterpreterAction | null {
	try {
		const obj = JSON.parse(json);
		if (!obj || typeof obj.action !== 'string') { return null; }

		const action = obj.action.toLowerCase();

		switch (action) {
			case 'retry':
			case 'approve':
			case 'resume':
			case 'reframe':
			case 'override':
				return {
					action: action as 'retry' | 'approve' | 'resume' | 'reframe' | 'override',
					rationale: typeof obj.rationale === 'string' ? obj.rationale : undefined,
				};
			case 'save_output':
				if (!obj.filePath || typeof obj.filePath !== 'string') { return null; }
				return { action: 'save_output', filePath: obj.filePath };
			case 'answer':
				if (!obj.response || typeof obj.response !== 'string') { return null; }
				return { action: 'answer', response: obj.response, needsEscalation: obj.needsEscalation === true ? true : undefined };
			case 'cancel':
				return { action: 'cancel' };
			case 'navigate':
				if (!obj.target || typeof obj.target !== 'string') { return null; }
				return {
					action: 'navigate',
					target: obj.target,
					direction: typeof obj.direction === 'string' ? obj.direction as 'forward' | 'backward' | 'restart' : undefined,
				};
			case 'freetext':
				return { action: 'freetext' };
			default:
				return null;
		}
	} catch {
		return null;
	}
}

// ==================== TIER 3: QUERY ESCALATION ====================

/**
 * Build a rich context string (~2000-3000 tokens) by querying multiple DB tables.
 * Used by escalateQuery() as the 3a structured-context layer.
 */
export function buildDeepContext(dialogueId: string): string {
	const lines: string[] = [];

	// 1. Base: reuse the static snapshot from Tier 2
	lines.push(buildWorkflowContextSummary(dialogueId));
	lines.push('');

	// 2. Intent record — human goal, scope
	try {
		const intentResult = getIntentRecordForDialogue(dialogueId);
		if (intentResult.success && intentResult.value) {
			const ir = intentResult.value;
			lines.push(`Human goal: ${ir.human_goal}`);
			if (ir.scope_in.length > 0) { lines.push(`Scope in: ${ir.scope_in.join(', ')}`); }
			if (ir.scope_out.length > 0) { lines.push(`Scope out: ${ir.scope_out.join(', ')}`); }
		}
	} catch { /* DB may not have this record */ }

	// 3. Acceptance contract — success conditions
	try {
		const contractResult = getAcceptanceContractForDialogue(dialogueId);
		if (contractResult.success && contractResult.value) {
			const ac = contractResult.value;
			if (ac.success_conditions.length > 0) {
				lines.push(`Success conditions: ${ac.success_conditions.join('; ')}`);
			}
		}
	} catch { /* optional */ }

	// 4. Task units with goals, observables, validation, and repair history
	try {
		const graphResult = getTaskGraphForDialogue(dialogueId);
		if (graphResult.success && graphResult.value) {
			const unitsResult = getTaskUnitsForGraph(graphResult.value.graph_id);
			if (unitsResult.success && unitsResult.value.length > 0) {
				lines.push('');
				lines.push('Task unit details:');
				for (const unit of unitsResult.value) {
					lines.push(`  ${unit.sort_order + 1}. [${unit.status}] ${unit.label}`);
					lines.push(`     Goal: ${unit.goal}`);
					if (unit.observables.length > 0) {
						lines.push(`     Observables: ${unit.observables.join(', ')}`);
					}

					// Validation results for completed/failed units
					if (unit.status === 'COMPLETED' || unit.status === 'FAILED') {
						try {
							const valResult = getLatestValidationForUnit(unit.unit_id);
							if (valResult.success && valResult.value) {
								const v = valResult.value;
								const checkSummary = v.checks.map((c: { check_type: string; passed: boolean }) => `${c.check_type}:${c.passed ? 'PASS' : 'FAIL'}`).join(', ');
								lines.push(`     Validation: ${v.pass_fail} — ${checkSummary}`);
							}
						} catch { /* optional */ }
					}

					// Repair history for failed units
					if (unit.status === 'FAILED') {
						try {
							const repairResult = getRepairPacketsForUnit(unit.unit_id);
							if (repairResult.success && repairResult.value.length > 0) {
								for (const rp of repairResult.value.slice(-2)) { // last 2 repairs
									lines.push(`     Repair: cause="${rp.suspected_cause}" strategy="${rp.repair_strategy}" result=${rp.result}`);
								}
							}
						} catch { /* optional */ }
					}
				}
			}
		}
	} catch { /* optional */ }

	// 5. Claims with verdicts (limit 10)
	try {
		const claimsResult = getClaims({ dialogue_id: dialogueId, limit: 10 });
		if (claimsResult.success && claimsResult.value.length > 0) {
			lines.push('');
			lines.push('Claims:');
			for (const claim of claimsResult.value) {
				let claimLine = `  - [${claim.status}] ${claim.statement}`;
				try {
					const verdictResult = getVerdicts({ claim_id: claim.claim_id, limit: 1 });
					if (verdictResult.success && verdictResult.value.length > 0) {
						const v = verdictResult.value[0];
						claimLine += ` → ${v.verdict}: ${v.rationale?.substring(0, 100) || ''}`;
					}
				} catch { /* optional */ }
				lines.push(claimLine);
			}
		}
	} catch { /* optional */ }

	// 6. Gate evaluations (detailed metadata)
	try {
		const state = aggregateStreamState(dialogueId);
		if (state.openGates.length > 0) {
			lines.push('');
			lines.push('Gate evaluation details:');
			for (const gate of state.openGates.slice(0, 3)) {
				const meta = readGateMetadata(gate.gate_id);
				if (meta?.evaluation) {
					const eval_ = meta.evaluation as {
						summary?: string; completionStatus?: string;
						deliverables?: string[]; issues?: string[]; recommendations?: string[];
					};
					lines.push(`  Gate: ${gate.reason}`);
					if (eval_.summary) { lines.push(`    Summary: ${eval_.summary}`); }
					if (eval_.deliverables?.length) { lines.push(`    Deliverables: ${eval_.deliverables.join(', ')}`); }
					if (eval_.issues?.length) { lines.push(`    Issues: ${eval_.issues.join(', ')}`); }
					if (eval_.recommendations?.length) { lines.push(`    Recommendations: ${eval_.recommendations.join(', ')}`); }
				}
				if (meta?.executor_output) {
					const output = String(meta.executor_output);
					const excerpt = output.length > 500 ? output.substring(0, 250) + '\n...\n' + output.substring(output.length - 250) : output;
					lines.push(`    Executor output excerpt: ${excerpt}`);
				}
			}
		}
	} catch { /* optional */ }

	// 7. Decision history (resolved gates with human decisions)
	try {
		const resolvedGates = getGatesForDialogue(dialogueId, GateStatus.RESOLVED);
		if (resolvedGates.success && resolvedGates.value.length > 0) {
			lines.push('');
			lines.push('Decision history:');
			for (const gate of resolvedGates.value) {
				const decResult = getHumanDecisions({ gate_id: gate.gate_id, limit: 1 });
				if (decResult.success && decResult.value.length > 0) {
					const d = decResult.value[0];
					lines.push(`  - ${d.action} at ${d.timestamp}: ${gate.reason}`);
					if (d.rationale) {
						lines.push(`    Rationale: ${d.rationale.substring(0, 200)}`);
					}
				}
			}
		}
	} catch { /* optional */ }

	// 8. Recent dialogue turns (last 5)
	try {
		const turnsResult = getDialogueEvents({ dialogue_id: dialogueId, limit: 5 });
		if (turnsResult.success && turnsResult.value.length > 0) {
			lines.push('');
			lines.push('Recent dialogue turns:');
			for (const turn of turnsResult.value.slice(-5)) {
				const contentRef = turn.content ?? turn.summary;
				const contentExcerpt = contentRef
					? contentRef.substring(0, 120)
					: '(no content)';
				lines.push(`  [${turn.role}/${turn.phase}] ${contentExcerpt}`);
			}
		}
	} catch { /* optional */ }

	// 9. Outcome snapshots
	try {
		const outcomeResult = getOutcomeSnapshotsForDialogue(dialogueId);
		if (outcomeResult.success && outcomeResult.value.length > 0) {
			const latest = outcomeResult.value[outcomeResult.value.length - 1];
			lines.push('');
			lines.push(`Outcome: ${latest.success ? 'SUCCESS' : 'FAILURE'} — ${latest.units_completed}/${latest.units_total} units`);
			if (latest.failure_modes.length > 0) {
				lines.push(`  Failure modes: ${latest.failure_modes.join(', ')}`);
			}
		}
	} catch { /* optional */ }

	return lines.join('\n');
}

/**
 * Detect whether a question is about workspace files or filesystem.
 */
function isFilesystemQuestion(text: string): boolean {
	const fsKeywords = /\b(file|directory|folder|exists|path|workspace|created|modified|written|disk|src|test|config)\b/i;
	return fsKeywords.test(text);
}

/**
 * Tier 3c: Delegate a question to a CLI agent (read-only workspace query).
 * Returns the agent's answer or null if unavailable/failed.
 */
async function queryWorkspace(question: string, _dialogueId: string): Promise<string | null> {
	try {
		const vscode = await import('vscode');
		const { resolveProviderForRole } = await import('../../cli/providerResolver.js');
		const { Role } = await import('../../types/index.js');
		const { buildStdinContent } = await import('../../cli/types.js');

		const config = vscode.workspace.getConfiguration('janumicode');
		const preferredProvider = config.get<string>('interpreter.workspaceQuery.provider', 'auto');

		// Resolve CLI provider — use configured preference or auto-detect
		let providerResult;
		if (preferredProvider === 'auto') {
			providerResult = await resolveProviderForRole(Role.EXECUTOR);
		} else {
			// Try to resolve the specific provider via the same mechanism
			providerResult = await resolveProviderForRole(Role.EXECUTOR);
		}
		if (!providerResult.success) { return null; }
		const provider = providerResult.value;

		const systemPrompt = `You are a workspace assistant. Answer the question by examining the filesystem. Be concise (2-4 sentences). Report what you find factually.`;

		const workspaceFolders = vscode.workspace.workspaceFolders;
		const cwd = workspaceFolders?.[0]?.uri.fsPath;
		if (!cwd) { return null; }

		const { invokeRoleStreaming } = await import('../../cli/roleInvoker.js');
		const result = await invokeRoleStreaming({
			provider,
			stdinContent: buildStdinContent(systemPrompt, question),
			workingDirectory: cwd,
			timeout: 30000,
			allowedTools: ['Read', 'Glob', 'Grep'],
			sandboxMode: 'read-only',
		});

		if (!result.success) { return null; }
		return result.value.response || null;
	} catch {
		return null;
	}
}

const ESCALATION_SYSTEM_PROMPT = `You are a workflow assistant answering a question about a software development workflow.
You have detailed context including task units, claims, verdicts, repair history,
gate evaluations, stream content search results, and optionally workspace file information.

Answer directly and concisely from the provided context. Reference specific units, claims,
or files by name when relevant. If the context doesn't contain the answer, say so honestly.

Format the response with markdown: use **bold** for emphasis, numbered lists (1. item) for
task enumerations, and bullet lists (- item) for other lists. Each list item on its own line.

Respond ONLY with valid JSON: {"action":"answer","response":"..."}`;

const SQL_GENERATION_SYSTEM_PROMPT = `You are a SQL query generator for a SQLite database tracking a software development workflow.
Given the user's question, write a single SELECT statement that retrieves the data needed to answer it.

Rules:
- Only SELECT statements. No INSERT, UPDATE, DELETE, DROP, ALTER, or ATTACH.
- Always filter by dialogue_id = '{DIALOGUE_ID}' to scope to the current dialogue.
- For tables without dialogue_id, join through a table that has it (e.g., task_units → task_graphs → dialogue_id).
- Use LIMIT 50 to prevent excessive results.
- For long text columns (content_ref, rationale, detail, goal, expert_response), use substr(column, 1, 300) to truncate.
- Timestamps are ISO 8601 TEXT. Use ORDER BY timestamp for chronological ordering.
- JSON array columns (blocking_claims, scope_in, scope_out, lessons, etc.) are stored as TEXT strings.
- Return ONLY the raw SQL query. No explanation, no markdown fencing, no comments.`;

const SQL_ANSWER_SYSTEM_PROMPT = `You are a workflow assistant answering a question about a software development workflow.
You have database query results and a workflow status summary to work with.

Answer directly from the data. Reference specific names, statuses, timestamps, and values
from the query results. If the data is empty or insufficient, say so honestly — do not fabricate.

Match the user's requested format: if they ask for a list, enumerate items; if they ask for
a summary, summarize; if they ask for a count, give the number.

Format with markdown: **bold** for emphasis, numbered lists (1. item) for enumerations,
bullet lists (- item) for other items. Each list item on its own line.

Respond ONLY with valid JSON: {"action":"answer","response":"..."}`;

/**
 * Extract SQL from an LLM response, stripping markdown fences if present.
 */
function extractSqlFromResponse(raw: string): string {
	const trimmed = raw.trim();
	// Strip markdown code fences
	const fenceMatch = /```(?:sql)?\s*([\s\S]*?)```/.exec(trimmed);
	if (fenceMatch) {
		return fenceMatch[1].trim();
	}
	return trimmed;
}

/**
 * Tier 3: Escalated query handler.
 * Two-pass text-to-SQL flow:
 *   Pass 1: LLM generates a SELECT query from the database schema
 *   Execute: Run the query safely against the dialogue database
 *   Pass 2: LLM synthesizes a human-readable answer from query results
 * Falls back to static buildDeepContext() if text-to-SQL fails at any step.
 * Also gathers FTS search (3b) and optional workspace query (3c).
 */
export async function escalateQuery(
	text: string,
	dialogueId: string,
	onProgress?: QaProgressCallback,
): Promise<InterpreterAction | null> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'interpreter' })
		: null;

	const vscode = await import('vscode');
	const config = vscode.workspace.getConfiguration('janumicode');
	const diagnostics: string[] = [];

	// 3a: Lightweight workflow summary (always, cheap)
	onProgress?.('Building context summary...');
	const contextSummary = buildWorkflowContextSummary(dialogueId);

	// 3a-sql: Text-to-SQL pass
	let sqlResultContext: string | null = null;
	const textToSqlEnabled = config.get<boolean>('interpreter.textToSql.enabled', true);

	// 3b: FTS5 search
	let ftsContext = '';
	const ftsEnabled = config.get<boolean>('interpreter.ftsSearch.enabled', true);
	if (ftsEnabled) {
		onProgress?.('Searching dialogue history...');
		try {
			const { searchStreamContent } = await import('../../database/ftsSync.js');
			const results = searchStreamContent(text, dialogueId, 5);
			if (results.length > 0) {
				ftsContext = '\n\nRelevant content from stream history:\n' +
					results.map((r: { sourceTable: string; snippet: string }) => `[${r.sourceTable}] ${r.snippet}`).join('\n');
			}
		} catch {
			diagnostics.push('Full-text search unavailable — run database migration to enable FTS5 indexing.');
		}
	} else {
		diagnostics.push('Full-text search disabled — enable in Settings > JanumiCode > Interpreter > FTS Search.');
	}

	// 3c: CLI workspace query (conditional — filesystem questions only)
	let workspaceContext = '';
	const wsEnabled = config.get<boolean>('interpreter.workspaceQuery.enabled', true);
	if (isFilesystemQuestion(text)) {
		if (wsEnabled) {
			onProgress?.('Examining workspace files...');
			const wsResult = await queryWorkspace(text, dialogueId);
			if (wsResult) {
				workspaceContext = '\n\nWorkspace query result:\n' + wsResult;
			} else {
				diagnostics.push('Workspace query failed — ensure a CLI provider (Claude Code, Codex, or Gemini CLI) is installed and configured.');
			}
		} else {
			diagnostics.push('Workspace queries disabled — enable in Settings > JanumiCode > Interpreter > Workspace Query.');
		}
	}

	try {
		const providerName = config.get<string>(
			'curator.provider',
			config.get<string>('evaluator.provider', 'GEMINI')
		);

		const { LLMProvider: LLMProviderEnum } = await import('../../types/index.js');
		const providerEnum =
			LLMProviderEnum[providerName as keyof typeof LLMProviderEnum] ??
			LLMProviderEnum.GEMINI;

		const { getSecretKeyManager } = await import('../../config/secretKeyManager.js');
		const apiKey = await getSecretKeyManager().getApiKey('curator', providerEnum);
		if (!apiKey?.trim()) {
			log?.warn('Tier 3: no API key for curator role');
			return null;
		}

		const model = config.get<string>(
			'curator.model',
			config.get<string>('evaluator.model', 'gemini-3-flash-lite')
		);

		const { createProvider } = await import('../../llm/providerFactory.js');
		const { MessageRole } = await import('../../llm/provider.js');

		const providerResult = createProvider(providerEnum, {
			apiKey: apiKey.trim(),
			defaultModel: model,
		});
		if (!providerResult.success) {
			log?.warn('Tier 3: provider creation failed', { provider: providerName });
			return null;
		}

		const provider = providerResult.value;

		// ── Text-to-SQL: Pass 1 — generate SQL ──
		if (textToSqlEnabled) {
			onProgress?.('Generating database query...');
			try {
				const schemaPrompt = buildSchemaPrompt(text, dialogueId);
				const sqlSystemPrompt = SQL_GENERATION_SYSTEM_PROMPT.replace('{DIALOGUE_ID}', dialogueId);

				log?.debug('Text-to-SQL: Pass 1 starting', { model, questionLength: text.length });

				const sqlGenResult = await provider.complete({
					systemPrompt: sqlSystemPrompt,
					messages: [{ role: MessageRole.USER, content: schemaPrompt + '\n\nQuestion: "' + text + '"' }],
					model,
					temperature: 0,
				});

				if (sqlGenResult.success) {
					const generatedSql = extractSqlFromResponse(sqlGenResult.value.content);
					log?.debug('Text-to-SQL: generated SQL', { sql: generatedSql.substring(0, 300) });

					const queryResult = executeSafeQuery(generatedSql, dialogueId);
					if (queryResult.success) {
						sqlResultContext = queryResult.formattedResult;
						onProgress?.(`Querying database... (${queryResult.rowCount} rows found)`);
						log?.debug('Text-to-SQL: query success', {
							rowCount: queryResult.rowCount,
							truncated: queryResult.truncated,
						});
					} else {
						log?.debug('Text-to-SQL: query rejected/failed', { error: queryResult.error });
					}
				} else {
					log?.debug('Text-to-SQL: Pass 1 LLM call failed', { error: String(sqlGenResult.error) });
				}
			} catch (err) {
				log?.debug('Text-to-SQL: Pass 1 error', { error: String(err) });
			}
		}

		// ── Context assembly ──
		let combinedContext: string;
		let answerSystemPrompt: string;

		if (sqlResultContext) {
			// Happy path: SQL results + lightweight summary
			combinedContext = `Workflow status:\n${contextSummary}\n\nDatabase query results:\n${sqlResultContext}`;
			answerSystemPrompt = SQL_ANSWER_SYSTEM_PROMPT;
		} else {
			// Fallback: static deep context (existing behavior)
			combinedContext = buildDeepContext(dialogueId);
			answerSystemPrompt = ESCALATION_SYSTEM_PROMPT;
		}
		combinedContext += ftsContext + workspaceContext;

		// ── Pass 2 — synthesize answer ──
		onProgress?.('Synthesizing answer...');
		const userMessage = `Context:\n${combinedContext}\n\nQuestion: "${text}"`;
		log?.debug('Tier 3: sending answer LLM request', {
			model,
			provider: providerName,
			contextLength: combinedContext.length,
			usedSql: sqlResultContext !== null,
		});

		const result = await provider.complete({
			systemPrompt: answerSystemPrompt,
			messages: [{ role: MessageRole.USER, content: userMessage }],
			model,
			temperature: 0,
		});

		if (!result.success) {
			log?.warn('Tier 3: LLM call failed', { error: String(result.error) });
			return null;
		}

		const raw = result.value.content.trim();
		log?.debug('Tier 3: LLM response', { raw: raw.substring(0, 200) });

		const parsed = parseInterpreterResponse(raw);
		if (parsed && parsed.action === 'answer') {
			// Append diagnostics if any layers were unavailable
			if (diagnostics.length > 0) {
				parsed.response += '\n\n(Note: ' + diagnostics.join(' ') + ')';
			}
			return parsed;
		}

		log?.warn('Tier 3: response not an answer action', { raw: raw.substring(0, 300) });
		return null;
	} catch (err) {
		log?.error('Tier 3: unexpected error', { error: String(err) });
		return null;
	}
}

// ==================== LEGACY (kept for backward compatibility) ====================

/** @deprecated Use interpretInput() instead */
export type CommandIntent = 'retry' | 'approve' | 'reframe' | 'override' | 'freetext';

/** @deprecated Use interpretInput() instead */
export async function classifyIntent(text: string): Promise<ParsedCommand | null> {
	// Delegate to the new interpreter for backward compatibility
	const result = await interpretInput(text, '').catch(() => null);
	if (!result || result.action === 'freetext' || result.action === 'answer' || result.action === 'cancel' || result.action === 'save_output') {
		return null;
	}
	return { command: result.action, args: text, raw: text };
}

/** @deprecated Tier 2 no longer gates on actionable context */
export function hasActionableContext(dialogueId: string): boolean {
	const gatesResult = getGatesForDialogue(dialogueId, GateStatus.OPEN);
	if (gatesResult.success && gatesResult.value.length > 0) { return true; }

	const wsResult = getWorkflowState(dialogueId);
	if (wsResult.success) {
		const metadata = JSON.parse(wsResult.value.metadata) as StateMetadata;
		if (metadata.lastFailedPhase) { return true; }
	}

	return false;
}
