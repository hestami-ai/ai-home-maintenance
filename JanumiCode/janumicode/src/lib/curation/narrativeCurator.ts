/**
 * Narrative Curator
 * Produces structured memory artifacts at key workflow moments:
 * - Narrative Memory (causal, goal-structured story)
 * - Decision Trace (deliberation record)
 * - Open Loops (unresolved items, deferred decisions, known unknowns)
 *
 * Runs as a quick, non-blocking step (like the Evaluator) within existing phases.
 * Trigger points:
 *   1. After INTAKE plan approval  → CurationMode.INTENT
 *   2. After EXECUTE phase completes → CurationMode.OUTCOME
 *   3. On ESCALATE_* evaluator verdicts → CurationMode.FAILURE
 */

import {
	CurationMode,
	type NarrativeCuratorResponse,
	type OpenLoopCategory,
	type OpenLoopPriority,
} from '../types/narrativeCurator';
import type { Result } from '../types';
import { LLMProvider as LLMProviderEnum } from '../types';
import type { LLMProvider, ProviderConfig } from '../llm/provider';
import { MessageRole } from '../llm/provider';
import { createProvider } from '../llm/providerFactory';
import { getDatabase } from '../database';
import { getLogger, isLoggerInitialized } from '../logging';
import { getSecretKeyManager } from '../config/secretKeyManager';
import { emitWorkflowCommand } from '../integration/eventBus';
import { randomUUID } from 'node:crypto';
import { nanoid } from 'nanoid';
import * as vscode from 'vscode';
import { embedNarrativeArtifacts } from '../embedding/service';

// ==================== SYSTEM PROMPT ====================

const CURATOR_SYSTEM_PROMPT = `You are the NARRATIVE CURATOR in the JanumiCode governed workflow system.

Produce three distinct memory artifacts from the dialogue history below.

## Output Format (JSON)
{
  "narrative_memory": {
    "agent_frame": "Who was involved and their roles",
    "goal": "The objective being pursued",
    "causal_sequence": [
      { "order": 1, "description": "...", "causal_link": "because...", "state_change": "before → after" }
    ],
    "conflicts": ["Obstacles or friction points"],
    "resolution_status": "achieved | partial | blocked | failed",
    "lessons": ["What was learned"]
  },
  "decision_trace": {
    "decision_points": [
      {
        "order": 1,
        "context_snapshot": "What was known at decision time",
        "options_considered": ["Option A", "Option B"],
        "selected_option": "Option A",
        "rejected_options": ["Option B — because..."],
        "rationale": "Why this was chosen",
        "confidence": "high|medium|low",
        "counterfactual": "If Option B had been chosen..."
      }
    ]
  },
  "open_loops": [
    { "category": "blocker|deferred_decision|missing_info|risk|follow_up", "description": "...", "priority": "high|medium|low" }
  ]
}

## Rules
- Use "because" causal links, not just "then"
- Infer the option space from the conversation — what alternatives were considered or implied
- For decision confidence, assess based on evidence quality and deliberation depth
- Do NOT include trivial assumptions (physical constants, language conventions)
- Focus on decision-relevant observations only
- Keep causal_sequence to 3-8 events (compress, don't enumerate every turn)
- Keep decision_points to the 2-5 most significant decisions
- Respond with valid JSON only. No markdown, no code fences, no extra text.`;

const MODE_INSTRUCTIONS: Record<CurationMode, string> = {
	[CurationMode.INTENT]:
		'Curate the deliberation phase — human and technical expert planning. Focus on how the goal was refined, what options were considered, and what the final plan captures.',
	[CurationMode.OUTCOME]:
		'Curate the full lifecycle — from intent through execution results. Include what was planned vs. what actually happened, and what was learned.',
	[CurationMode.FAILURE]:
		'Curate a lightweight failure trace — what went wrong and why. Focus on the causal chain leading to failure and what open loops remain.',
	[CurationMode.FEEDBACK]:
		'Curate the human feedback at a workflow gate — what was decided, why, what corrections or clarifications the human provided, and how this changes the prior understanding. Pay special attention to human overrides of verification verdicts and any new context the human introduced.',
};

// ==================== MAIN ENTRY POINT ====================

/**
 * Run Narrative Curation for a dialogue.
 * Non-blocking: errors are logged but never block the workflow.
 *
 * @param dialogueId Dialogue to curate
 * @param mode What kind of snapshot to produce
 * @returns Result containing the curator response, or error
 */
export async function runNarrativeCuration(
	dialogueId: string,
	mode: CurationMode
): Promise<Result<NarrativeCuratorResponse>> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'curator', dialogueId, mode })
		: undefined;

	const curatorCommandId = randomUUID();

	logger?.info('Starting narrative curation', { mode });

	try {
		// 1. Gather dialogue context
		const contextResult = gatherCurationContext(dialogueId, mode);
		if (!contextResult.success) {
			logger?.warn('Failed to gather curation context', {
				error: contextResult.error.message,
			});
			return contextResult;
		}

		const dialogueContext = contextResult.value;

		// 2. Create LLM provider
		const provider = await createCuratorProvider();
		if (!provider) {
			logger?.warn('Could not create curator provider — skipping curation');
			return {
				success: false,
				error: new Error('Curator provider unavailable — no API key or provider configured'),
			};
		}

		const model = getCuratorModel();

		// 3. Emit command block for Governed Stream visibility (collapsed)
		emitWorkflowCommand({
			dialogueId,
			commandId: curatorCommandId,
			action: 'start',
			commandType: 'llm_api_call',
			label: `Narrative Curator — ${mode} snapshot`,
			summary: 'Generating memory artifacts for dialogue',
			status: 'running',
			timestamp: new Date().toISOString(),
			collapsed: true,
		});

		// 4. Make LLM call
		const startMs = Date.now();
		const result = await provider.complete({
			systemPrompt: CURATOR_SYSTEM_PROMPT,
			messages: [
				{
					role: MessageRole.USER,
					content: `${MODE_INSTRUCTIONS[mode]}\n\n---\n\n${dialogueContext}`,
				},
			],
			model,
			maxTokens: 4000,
			temperature: 0.2,
		});

		const elapsedMs = Date.now() - startMs;

		if (!result.success) {
			logger?.warn('Curator LLM call failed', {
				error: result.error.message,
				elapsedMs,
			});
			emitWorkflowCommand({
				dialogueId,
				commandId: curatorCommandId,
				action: 'error',
				commandType: 'llm_api_call',
				label: 'Narrative Curator',
				summary: `Failed: ${result.error.message}`,
				status: 'error',
				timestamp: new Date().toISOString(),
			});
			return {
				success: false,
				error: result.error,
			};
		}

		// 5. Parse response
		const parseResult = parseNarrativeCuratorResponse(result.value.content);
		if (!parseResult.success) {
			logger?.warn('Failed to parse curator response', {
				error: parseResult.error.message,
				elapsedMs,
			});
			emitWorkflowCommand({
				dialogueId,
				commandId: curatorCommandId,
				action: 'error',
				commandType: 'llm_api_call',
				label: 'Narrative Curator',
				summary: `Parse failed: ${parseResult.error.message}`,
				status: 'error',
				timestamp: new Date().toISOString(),
			});
			return parseResult;
		}

		const response = parseResult.value;

		// 6. Store artifacts
		const storeResult = storeNarrativeArtifacts(dialogueId, mode, response);
		if (storeResult.success) {
			// Fire-and-forget: embed narrative artifacts for semantic search
			embedNarrativeArtifacts(dialogueId).catch(() => {});
		} else {
			logger?.warn('Failed to store curator artifacts', {
				error: storeResult.error.message,
			});
		}

		// 7. Emit completion
		const decisionCount = response.decision_trace.decision_points.length;
		const loopCount = response.open_loops.length;
		const causalCount = response.narrative_memory.causal_sequence.length;

		emitWorkflowCommand({
			dialogueId,
			commandId: curatorCommandId,
			action: 'output',
			commandType: 'llm_api_call',
			label: 'Narrative Curator',
			summary: `Produced: ${causalCount} causal events, ${decisionCount} decisions, ${loopCount} open loops`,
			detail: formatCuratorDetail(response),
			timestamp: new Date().toISOString(),
		});

		emitWorkflowCommand({
			dialogueId,
			commandId: curatorCommandId,
			action: 'complete',
			commandType: 'llm_api_call',
			label: 'Narrative Curator',
			summary: `${mode} snapshot complete (${elapsedMs}ms, ${result.value.usage.inputTokens}+${result.value.usage.outputTokens} tokens)`,
			status: 'success',
			timestamp: new Date().toISOString(),
		});

		logger?.info('Narrative curation complete', {
			mode,
			causalEvents: causalCount,
			decisions: decisionCount,
			openLoops: loopCount,
			elapsedMs,
			inputTokens: result.value.usage.inputTokens,
			outputTokens: result.value.usage.outputTokens,
		});

		return { success: true, value: response };
	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error);
		logger?.error('Curator threw unexpectedly', { error: errMsg });
		emitWorkflowCommand({
			dialogueId,
			commandId: curatorCommandId,
			action: 'error',
			commandType: 'llm_api_call',
			label: 'Narrative Curator',
			summary: `Error: ${errMsg}`,
			status: 'error',
			timestamp: new Date().toISOString(),
		});
		return {
			success: false,
			error: error instanceof Error ? error : new Error(errMsg),
		};
	}
}

// ==================== HUMAN-READABLE FORMATTING ====================

/**
 * Format the Curator response as a human-readable string for the Governed Stream.
 */
function formatCuratorDetail(response: NarrativeCuratorResponse): string {
	const lines: string[] = [];
	const nm = response.narrative_memory;

	lines.push(`Agent: ${nm.agent_frame}`);
	lines.push(`Goal: ${nm.goal}`);
	lines.push(`Status: ${nm.resolution_status}`);

	if (nm.causal_sequence.length > 0) {
		lines.push('', 'Causal Sequence:');
		for (const e of nm.causal_sequence) {
			lines.push(`  ${e.order}. ${e.description}`);
			if (e.causal_link) {
				lines.push(`     ↳ ${e.causal_link}`);
			}
		}
	}

	if (nm.conflicts.length > 0) {
		lines.push('', 'Conflicts:');
		for (const c of nm.conflicts) {
			lines.push(`  - ${c}`);
		}
	}

	if (nm.lessons.length > 0) {
		lines.push('', 'Lessons:');
		for (const l of nm.lessons) {
			lines.push(`  - ${l}`);
		}
	}

	const dps = response.decision_trace.decision_points;
	if (dps.length > 0) {
		lines.push('', 'Key Decisions:');
		for (const dp of dps) {
			lines.push(`  ${dp.order}. ${dp.selected_option} [${dp.confidence}]`);
			lines.push(`     Rationale: ${dp.rationale}`);
		}
	}

	if (response.open_loops.length > 0) {
		lines.push('', 'Open Loops:');
		for (const ol of response.open_loops) {
			lines.push(`  - [${ol.priority}] ${ol.description}`);
		}
	}

	return lines.join('\n');
}

// ==================== CONTEXT GATHERING ====================

/**
 * Gather dialogue context for the Curator LLM call.
 * Assembles relevant dialogue history based on curation mode.
 */
function gatherCurationContext(
	dialogueId: string,
	mode: CurationMode
): Result<string> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const sections: string[] = [];

		// 1. Dialogue goal
		const dialogue = db
			.prepare('SELECT goal, title FROM dialogues WHERE dialogue_id = ?')
			.get(dialogueId) as { goal: string; title: string | null } | undefined;

		if (dialogue) {
			sections.push(`# Goal\n\n${dialogue.goal}`);
			if (dialogue.title) {
				sections.push(`Title: ${dialogue.title}`);
			}
		}

		// 2. INTAKE plan (if finalized)
		const intakeConv = db
			.prepare(
				'SELECT finalized_plan, draft_plan FROM intake_conversations WHERE dialogue_id = ?'
			)
			.get(dialogueId) as
			| { finalized_plan: string | null; draft_plan: string }
			| undefined;

		if (intakeConv?.finalized_plan) {
			sections.push(`# Finalized Plan\n\n${intakeConv.finalized_plan}`);
		} else if (intakeConv?.draft_plan && intakeConv.draft_plan !== '{}') {
			sections.push(`# Draft Plan\n\n${intakeConv.draft_plan}`);
		}

		// 3. Dialogue turns — scope depends on mode
		const turnLimit = mode === CurationMode.FAILURE ? 10 : 30;
		const turns = db
			.prepare(
				`
				SELECT role, phase, speech_act, summary, content, timestamp
				FROM dialogue_events
				WHERE dialogue_id = ?
				ORDER BY event_id ASC
				LIMIT ?
			`
			)
			.all(dialogueId, turnLimit) as {
			role: string;
			phase: string;
			speech_act: string;
			summary: string;
			content: string | null;
			timestamp: string;
		}[];

		if (turns.length > 0) {
			let turnsSection = '# Dialogue Events\n\n';
			for (const turn of turns) {
				let content = turn.content ?? turn.summary;
				// Truncate very long content
				if (content.length > 500) {
					content = content.substring(0, 500) + '…';
				}
				turnsSection += `[${turn.phase}] ${turn.role} (${turn.speech_act}): ${content}\n\n`;
			}
			sections.push(turnsSection);
		}

		// 4. Claims and verdicts
		const claims = db
			.prepare(
				`
				SELECT statement, introduced_by, criticality, status
				FROM claims
				WHERE dialogue_id = ?
				ORDER BY created_at ASC
			`
			)
			.all(dialogueId) as {
			statement: string;
			introduced_by: string;
			criticality: string;
			status: string;
		}[];

		if (claims.length > 0) {
			let claimsSection = '# Claims\n\n';
			for (const c of claims) {
				claimsSection += `- [${c.status}] [${c.criticality}] ${c.statement} (by ${c.introduced_by})\n`;
			}
			sections.push(claimsSection);
		}

		// 5. Verdicts
		const verdicts = db
			.prepare(
				`
				SELECT v.verdict, v.rationale, c.statement
				FROM verdicts v
				JOIN claims c ON v.claim_id = c.claim_id
				WHERE c.dialogue_id = ?
				ORDER BY v.timestamp ASC
			`
			)
			.all(dialogueId) as {
			verdict: string;
			rationale: string;
			statement: string;
		}[];

		if (verdicts.length > 0) {
			let verdictsSection = '# Verdicts\n\n';
			for (const v of verdicts) {
				const preview =
					v.rationale.length > 200
						? v.rationale.substring(0, 200) + '…'
						: v.rationale;
				verdictsSection += `- [${v.verdict}] "${v.statement}": ${preview}\n`;
			}
			sections.push(verdictsSection);
		}

		// 6. Human decisions
		const decisions = db
			.prepare(
				`
				SELECT hd.action, hd.rationale, g.reason
				FROM human_decisions hd
				JOIN gates g ON hd.gate_id = g.gate_id
				WHERE g.dialogue_id = ?
				ORDER BY hd.timestamp ASC
			`
			)
			.all(dialogueId) as {
			action: string;
			rationale: string;
			reason: string;
		}[];

		if (decisions.length > 0) {
			let decisionsSection = '# Human Decisions\n\n';
			for (const d of decisions) {
				decisionsSection += `- [${d.action}] Gate: "${d.reason}" → Rationale: ${d.rationale}\n`;
			}
			sections.push(decisionsSection);
		}

		// 7. INTAKE conversation turns (for INTENT and FEEDBACK modes — rich deliberation detail)
		if (mode === CurationMode.INTENT || mode === CurationMode.FEEDBACK) {
			const intakeTurns = db
				.prepare(
					`
					SELECT event_id, summary, content, detail
					FROM dialogue_events
					WHERE dialogue_id = ?
					  AND event_type IN ('intake_turn', 'intake_analysis', 'intake_clarification', 'intake_gathering')
					ORDER BY event_id ASC
					LIMIT 10
				`
				)
				.all(dialogueId) as {
				event_id: number;
				summary: string;
				content: string | null;
				detail: string | null;
			}[];

			if (intakeTurns.length > 0) {
				let intakeSection = '# INTAKE Conversation Detail\n\n';
				for (const t of intakeTurns) {
					const detail = t.detail ? JSON.parse(t.detail) : {};
					const humanMsg = detail.humanMessage ?? '';
					const humanPreview =
						humanMsg.length > 300
							? humanMsg.substring(0, 300) + '…'
							: humanMsg;
					const expertText = t.content ?? t.summary;
					const expertPreview =
						expertText.length > 500
							? expertText.substring(0, 500) + '…'
							: expertText;
					intakeSection += `## Event ${t.event_id}\n\nHuman: ${humanPreview}\n\nExpert: ${expertPreview}\n\n`;
				}
				sections.push(intakeSection);
			}
		}

		return { success: true, value: sections.join('\n\n') };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to gather curation context'),
		};
	}
}

// ==================== RESPONSE PARSING ====================

/**
 * Parse the Curator LLM response into a structured NarrativeCuratorResponse.
 * Handles JSON extraction from potentially wrapped responses.
 */
function parseNarrativeCuratorResponse(
	rawResponse: string
): Result<NarrativeCuratorResponse> {
	try {
		// Strip markdown code fences if present
		let jsonStr = rawResponse.trim();
		const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		if (jsonMatch) {
			jsonStr = jsonMatch[1];
		} else {
			// Try to find JSON object
			const objMatch = jsonStr.match(/\{[\s\S]*\}/);
			if (objMatch) {
				jsonStr = objMatch[0];
			}
		}

		const parsed = JSON.parse(jsonStr);

		// Validate required structure
		if (!parsed.narrative_memory || typeof parsed.narrative_memory !== 'object') {
			return {
				success: false,
				error: new Error('Curator response missing narrative_memory'),
			};
		}

		if (!parsed.decision_trace || typeof parsed.decision_trace !== 'object') {
			return {
				success: false,
				error: new Error('Curator response missing decision_trace'),
			};
		}

		if (!Array.isArray(parsed.open_loops)) {
			return {
				success: false,
				error: new Error('Curator response missing open_loops array'),
			};
		}

		const nm = parsed.narrative_memory;

		const response: NarrativeCuratorResponse = {
			narrative_memory: {
				agent_frame: nm.agent_frame ?? '',
				goal: nm.goal ?? '',
				causal_sequence: Array.isArray(nm.causal_sequence)
					? nm.causal_sequence.map((e: Record<string, unknown>, i: number) => ({
							order: (e.order as number) ?? i + 1,
							description: (e.description as string) ?? '',
							causal_link: (e.causal_link as string) ?? '',
							state_change: (e.state_change as string) ?? '',
						}))
					: [],
				conflicts: Array.isArray(nm.conflicts) ? nm.conflicts : [],
				resolution_status: nm.resolution_status ?? 'unknown',
				lessons: Array.isArray(nm.lessons) ? nm.lessons : [],
			},
			decision_trace: {
				decision_points: Array.isArray(parsed.decision_trace.decision_points)
					? parsed.decision_trace.decision_points.map(
							(dp: Record<string, unknown>, i: number) => ({
								order: (dp.order as number) ?? i + 1,
								context_snapshot: (dp.context_snapshot as string) ?? '',
								options_considered: Array.isArray(dp.options_considered)
									? dp.options_considered
									: [],
								selected_option: (dp.selected_option as string) ?? '',
								rejected_options: Array.isArray(dp.rejected_options)
									? dp.rejected_options
									: [],
								rationale: (dp.rationale as string) ?? '',
								confidence: (dp.confidence as string) ?? 'medium',
								counterfactual: (dp.counterfactual as string) ?? '',
							})
						)
					: [],
			},
			open_loops: parsed.open_loops.map(
				(ol: Record<string, unknown>) => ({
					category: (ol.category as string) ?? 'follow_up',
					description: (ol.description as string) ?? '',
					priority: (ol.priority as string) ?? 'medium',
				})
			),
			raw_response: rawResponse,
		};

		return { success: true, value: response };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to parse curator response'),
		};
	}
}

// ==================== ARTIFACT STORAGE ====================

const VALID_CATEGORIES: Set<string> = new Set([
	'blocker',
	'deferred_decision',
	'missing_info',
	'risk',
	'follow_up',
]);

const VALID_PRIORITIES: Set<string> = new Set(['high', 'medium', 'low']);

/**
 * Store Narrative Curator artifacts in the database.
 * Writes to narrative_memories, decision_traces, and open_loops tables.
 */
function storeNarrativeArtifacts(
	dialogueId: string,
	mode: CurationMode,
	response: NarrativeCuratorResponse
): Result<void> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const now = new Date().toISOString();

		// Store in a transaction
		const txn = db.transaction(() => {
			// 1. Narrative Memory
			const nm = response.narrative_memory;
			db.prepare(
				`
				INSERT INTO narrative_memories (
					memory_id, dialogue_id, curation_mode,
					agent_frame, goal, causal_sequence,
					conflicts, resolution_status, lessons,
					created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`
			).run(
				nanoid(),
				dialogueId,
				mode,
				nm.agent_frame,
				nm.goal,
				JSON.stringify(nm.causal_sequence),
				JSON.stringify(nm.conflicts),
				nm.resolution_status,
				JSON.stringify(nm.lessons),
				now
			);

			// 2. Decision Trace
			db.prepare(
				`
				INSERT INTO decision_traces (
					trace_id, dialogue_id, curation_mode,
					decision_points, created_at
				) VALUES (?, ?, ?, ?, ?)
			`
			).run(
				nanoid(),
				dialogueId,
				mode,
				JSON.stringify(response.decision_trace.decision_points),
				now
			);

			// 3. Open Loops
			const insertLoop = db.prepare(
				`
				INSERT INTO open_loops (
					loop_id, dialogue_id, curation_mode,
					category, description, related_claim_ids,
					priority, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`
			);

			for (const ol of response.open_loops) {
				const category: OpenLoopCategory = VALID_CATEGORIES.has(ol.category)
					? (ol.category as OpenLoopCategory)
					: 'follow_up';
				const priority: OpenLoopPriority = VALID_PRIORITIES.has(ol.priority)
					? (ol.priority as OpenLoopPriority)
					: 'medium';

				insertLoop.run(
					nanoid(),
					dialogueId,
					mode,
					category,
					ol.description,
					'[]',
					priority,
					now
				);
			}
		});

		txn();

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to store curator artifacts'),
		};
	}
}

// ==================== PROVIDER CREATION ====================

/**
 * Create the LLM provider for the Curator.
 * Reads provider type and API key from VS Code settings.
 * Falls back to the evaluator's provider config.
 */
async function createCuratorProvider(): Promise<LLMProvider | null> {
	const config = vscode.workspace.getConfiguration('janumicode');

	// Use evaluator's provider config as fallback (both are lightweight utility calls)
	const providerName = config.get<string>(
		'curator.provider',
		config.get<string>('evaluator.provider', 'GEMINI')
	);

	const providerEnum =
		LLMProviderEnum[providerName as keyof typeof LLMProviderEnum] ??
		LLMProviderEnum.GEMINI;

	const apiKey = await resolveCuratorApiKey(providerEnum);
	if (!apiKey) {
		return null;
	}

	const providerConfig: ProviderConfig = {
		apiKey,
		defaultModel: getCuratorModel(),
	};

	const result = createProvider(providerEnum, providerConfig);
	return result.success ? result.value : null;
}

/**
 * Resolve API key for the Curator provider.
 */
async function resolveCuratorApiKey(
	provider: LLMProviderEnum
): Promise<string | null> {
	try {
		const key = await getSecretKeyManager().getApiKey('curator', provider);
		if (key?.trim()) {
			return key.trim();
		}
	} catch {
		// SecretStorage may not be initialized
	}
	return null;
}

/**
 * Get the configured curator model name.
 * Falls back to the evaluator model, then to gemini-3-flash-lite.
 */
function getCuratorModel(): string {
	const config = vscode.workspace.getConfiguration('janumicode');
	return config.get<string>(
		'curator.model',
		config.get<string>('evaluator.model', 'gemini-3-flash-lite')
	);
}
