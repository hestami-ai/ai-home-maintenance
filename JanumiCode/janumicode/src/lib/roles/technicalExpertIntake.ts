/**
 * Technical Expert INTAKE Mode
 * Implements the conversational planning advisor role for the INTAKE phase.
 * The Technical Expert investigates the codebase to ground responses in reality,
 * bridges business requirements with technical capabilities, and produces
 * IntakeTurnResponse JSON (conversational response + updated plan) each turn.
 */

import type { Result } from '../types';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import type {
	IntakeTurnResponse,
	IntakePlanDocument,
	IntakeExtractedItemType,
} from '../types/intake';
import type { RoleCLIResult, CLIActivityEvent } from '../cli/types';
import { buildStdinContent } from '../cli/types';
import { getLogger, isLoggerInitialized } from '../logging';
import {
	buildIntakeTechnicalExpertContext,
	formatIntakeTechnicalExpertContext,
} from '../context';

/**
 * INTAKE Technical Expert invocation options
 */
export interface IntakeTechnicalExpertOptions {
	dialogueId: string;
	humanMessage: string;
	currentPlan: IntakePlanDocument;
	turnNumber: number;
	provider: RoleCLIProvider;
	tokenBudget: number;
	/** Optional streaming callback — when provided, uses invokeStreaming() for real-time tool activity */
	onEvent?: (event: CLIActivityEvent) => void;
}

/**
 * INTAKE plan synthesis invocation options
 */
export interface IntakePlanSynthesisOptions {
	dialogueId: string;
	currentPlan: IntakePlanDocument;
	provider: RoleCLIProvider;
	tokenBudget: number;
	/** Optional streaming callback — when provided, uses invokeStreaming() for real-time tool activity */
	onEvent?: (event: CLIActivityEvent) => void;
}

/**
 * System prompt for Technical Expert in INTAKE mode (conversation turns)
 */
const INTAKE_TECHNICAL_EXPERT_SYSTEM_PROMPT = `You are the TECHNICAL EXPERT role in the JanumiCode autonomous system, operating in INTAKE mode.

# Your Role

You are a **conversational planning advisor**. A Human is describing what they want to build or accomplish. Your job is to:

1. **Understand Requirements**: Listen carefully and ask clarifying questions
2. **Investigate the Codebase**: Use your knowledge of the workspace to ground responses in technical reality
3. **Bridge Business ↔ Technical**: Translate business requirements into technical implications
4. **Evolve the Plan**: Produce an updated draft plan alongside each conversational response
5. **Surface Constraints**: Identify technical limitations, dependencies, and considerations
6. **Suggest Next Steps**: Propose questions the Human should consider

# Critical Guardrails

## NEVER Make Feasibility Verdicts
- You provide EVIDENCE and OBSERVATIONS — not judgments about feasibility
- Do NOT say whether something "will work" or "won't work"
- Do NOT authorize execution or make final recommendations
- Focus on "what exists" and "what would be involved"

## NEVER Authorize Execution
- You have NO authority to approve or authorize implementation
- Planning and execution are separate phases — you are in PLANNING only
- Do NOT suggest "let's go ahead and implement this"

## ALWAYS Ground in Reality
- Reference actual files, patterns, and structures you find in the codebase
- If you cannot find evidence for a technical claim, say so explicitly
- When you discover relevant code patterns, mention them specifically

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "conversationalResponse": "Your natural language response to the Human...",
  "updatedPlan": {
    "version": <number>,
    "title": "Short plan title",
    "summary": "Executive summary of what is being built",
    "requirements": [
      { "id": "REQ-1", "type": "REQUIREMENT", "text": "...", "extractedFromTurnId": <turnNumber>, "timestamp": "<ISO-8601>" }
    ],
    "decisions": [
      { "id": "DEC-1", "type": "DECISION", "text": "...", "extractedFromTurnId": <turnNumber>, "timestamp": "<ISO-8601>" }
    ],
    "constraints": [
      { "id": "CON-1", "type": "CONSTRAINT", "text": "...", "extractedFromTurnId": <turnNumber>, "timestamp": "<ISO-8601>" }
    ],
    "openQuestions": [
      { "id": "Q-1", "type": "OPEN_QUESTION", "text": "...", "extractedFromTurnId": <turnNumber>, "timestamp": "<ISO-8601>" }
    ],
    "technicalNotes": ["Observation about the codebase..."],
    "proposedApproach": "High-level implementation approach based on discussion so far",
    "lastUpdatedAt": "<ISO-8601>"
  },
  "suggestedQuestions": ["Question the Human might want to consider..."],
  "codebaseFindings": ["path/to/relevant/file - description of what was found"]
}
\`\`\`

# Plan Evolution Rules

- **Carry forward** all items from the previous plan version — do NOT drop items
- **Increment version** by 1 each turn
- **Add new items** as you identify them from the Human's latest message
- **Move items** between sections if the conversation changes their nature (e.g., open question → decision)
- **Update summary and approach** as the picture becomes clearer
- **Use sequential IDs**: REQ-1, REQ-2, DEC-1, CON-1, Q-1, etc.

# Conversation Style

- Be conversational but focused — you're a technical partner in planning
- Ask clarifying questions when requirements are ambiguous
- Proactively surface things the Human may not have considered
- Keep responses concise but thorough
- When you find relevant codebase patterns, explain their implications`;

/**
 * System prompt for plan synthesis (finalization)
 */
const INTAKE_SYNTHESIS_SYSTEM_PROMPT = `You are the TECHNICAL EXPERT role in the JanumiCode autonomous system, performing PLAN SYNTHESIS.

# Your Task

You are synthesizing a conversation between a Human and yourself into a **final structured implementation plan**. You have the full conversation history and the current draft plan. Your job is to:

1. **Consolidate** all requirements, decisions, constraints, and notes into a clean final plan
2. **Resolve** any open questions that were answered during conversation (remove them, add as decisions)
3. **Flag** any truly unresolved open questions that remain
4. **Refine** the summary and proposed approach to be comprehensive and actionable
5. **Ensure completeness** — nothing discussed should be lost

# Response Format

Your response MUST be valid JSON with this exact structure:

\`\`\`json
{
  "conversationalResponse": "Summary of what was synthesized and any remaining concerns...",
  "updatedPlan": {
    "version": <number>,
    "title": "Final plan title",
    "summary": "Comprehensive summary of what will be built",
    "requirements": [
      { "id": "REQ-1", "type": "REQUIREMENT", "text": "Full requirement description...", "extractedFromTurnId": 1, "timestamp": "<ISO-8601>" }
    ],
    "decisions": [
      { "id": "DEC-1", "type": "DECISION", "text": "Decision description with rationale...", "extractedFromTurnId": 1, "timestamp": "<ISO-8601>" }
    ],
    "constraints": [
      { "id": "CON-1", "type": "CONSTRAINT", "text": "Constraint description...", "extractedFromTurnId": 1, "timestamp": "<ISO-8601>" }
    ],
    "openQuestions": [
      { "id": "Q-1", "type": "OPEN_QUESTION", "text": "Unresolved question...", "extractedFromTurnId": 1, "timestamp": "<ISO-8601>" }
    ],
    "technicalNotes": [...],
    "proposedApproach": "Detailed implementation approach",
    "lastUpdatedAt": "<ISO-8601>"
  },
  "suggestedQuestions": [],
  "codebaseFindings": []
}
\`\`\`

# Synthesis Rules

- The finalized plan should be **self-contained** — readable without the conversation
- **Every item MUST be an object** with id, type, text, extractedFromTurnId, and timestamp fields — NOT a plain string
- The "text" field MUST contain the **full human-readable description** — never omit it
- Preserve the REQ-/DEC-/CON-/Q- ID prefixes from the draft plan; do NOT renumber to R-/D-/C-
- Requirements should be specific and testable where possible
- Decisions should include the rationale (or reference the turn where it was discussed)
- Constraints should distinguish between technical and business constraints
- The proposed approach should be detailed enough to guide the PROPOSE phase
- Open questions should ONLY contain genuinely unresolved items`;

/**
 * Invoke Technical Expert in INTAKE conversation mode
 * Produces a conversational response + updated plan for a single turn.
 *
 * @param options Invocation options
 * @returns Result containing the parsed IntakeTurnResponse
 */
export async function invokeIntakeTechnicalExpert(
	options: IntakeTechnicalExpertOptions
): Promise<Result<IntakeTurnResponse>> {
	try {
		// Build INTAKE-specific context
		const contextResult = await buildIntakeTechnicalExpertContext({
			dialogueId: options.dialogueId,
			humanMessage: options.humanMessage,
			currentPlan: options.currentPlan,
			turnNumber: options.turnNumber,
			tokenBudget: options.tokenBudget,
		});

		if (!contextResult.success) {
			return contextResult;
		}

		// Format context for CLI consumption
		const formattedContext = formatIntakeTechnicalExpertContext(contextResult.value);

		// Build stdin: system prompt + formatted context
		const stdinContent = buildStdinContent(
			INTAKE_TECHNICAL_EXPERT_SYSTEM_PROMPT,
			formattedContext
		);

		// CLI invocation — streaming when onEvent callback provided, one-shot otherwise
		// autoApprove: true enables --full-auto so the model can execute read operations
		// without interactive approval prompts (safe because --sandbox read-only prevents writes)
		let cliResult: Result<RoleCLIResult>;
		if (options.onEvent) {
			cliResult = await options.provider.invokeStreaming(
				{ stdinContent, outputFormat: 'stream-json', autoApprove: true },
				options.onEvent
			);
			// Extract final model response from JSONL stream output
			if (cliResult.success) {
				cliResult.value.response = extractFinalResponseFromStream(cliResult.value.rawOutput);
			}
		} else {
			cliResult = await options.provider.invoke({
				stdinContent,
				outputFormat: 'json',
				autoApprove: true,
			});
		}

		if (!cliResult.success) {
			return cliResult;
		}

		// Parse response
		const parseResult = parseIntakeTurnResponse(
			cliResult.value.response,
			options.currentPlan,
			options.turnNumber
		);

		if (!parseResult.success) {
			return parseResult;
		}

		// Validate response
		const validationResult = validateIntakeTurnResponse(parseResult.value);
		if (!validationResult.success) {
			// Log warnings but don't fail — validation is advisory
			if (isLoggerInitialized()) {
				getLogger()
					.child({ component: 'role:technicalExpertIntake' })
					.warn('INTAKE response validation warnings', {
						error: validationResult.error?.message,
					});
			}
		}

		return { success: true, value: parseResult.value };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to invoke INTAKE Technical Expert'),
		};
	}
}

/**
 * Invoke Technical Expert for plan synthesis (finalization).
 * Uses the synthesis-specific system prompt.
 *
 * @param options Synthesis options
 * @returns Result containing the finalized IntakeTurnResponse
 */
export async function invokeIntakePlanSynthesis(
	options: IntakePlanSynthesisOptions
): Promise<Result<IntakeTurnResponse>> {
	try {
		// Build context with full conversation history for synthesis
		const contextResult = await buildIntakeTechnicalExpertContext({
			dialogueId: options.dialogueId,
			humanMessage: '[SYSTEM] Synthesize the conversation into a final structured plan.',
			currentPlan: options.currentPlan,
			turnNumber: -1, // Sentinel: synthesis mode
			tokenBudget: options.tokenBudget,
			synthesisMode: true,
		});

		if (!contextResult.success) {
			return contextResult;
		}

		const formattedContext = formatIntakeTechnicalExpertContext(contextResult.value);

		const stdinContent = buildStdinContent(
			INTAKE_SYNTHESIS_SYSTEM_PROMPT,
			formattedContext
		);

		// CLI invocation — streaming when onEvent callback provided, one-shot otherwise
		// autoApprove for synthesis too (same read-only sandbox safety)
		let cliResult: Result<RoleCLIResult>;
		if (options.onEvent) {
			cliResult = await options.provider.invokeStreaming(
				{ stdinContent, outputFormat: 'stream-json', autoApprove: true },
				options.onEvent
			);
			if (cliResult.success) {
				cliResult.value.response = extractFinalResponseFromStream(cliResult.value.rawOutput);
			}
		} else {
			cliResult = await options.provider.invoke({
				stdinContent,
				outputFormat: 'json',
				autoApprove: true,
			});
		}

		if (!cliResult.success) {
			return cliResult;
		}

		const parseResult = parseIntakeTurnResponse(
			cliResult.value.response,
			options.currentPlan,
			options.currentPlan.version + 1
		);

		if (!parseResult.success) {
			return parseResult;
		}

		return { success: true, value: parseResult.value };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to invoke INTAKE plan synthesis'),
		};
	}
}

/**
 * Parse IntakeTurnResponse from raw CLI response.
 * Graceful degradation: if JSON parse fails, treat raw response as
 * conversationalResponse and carry forward previous plan version.
 */
function parseIntakeTurnResponse(
	rawResponse: string,
	previousPlan: IntakePlanDocument,
	turnNumber: number
): Result<IntakeTurnResponse> {
	try {
		// Extract JSON from response — multiple strategies for robustness
		const jsonStr = extractJsonFromIntakeResponse(rawResponse);

		const parsed = JSON.parse(jsonStr);

		// Validate required fields
		if (!parsed.conversationalResponse || typeof parsed.conversationalResponse !== 'string') {
			// Graceful degradation: use raw response as conversation
			return {
				success: true,
				value: {
					conversationalResponse: rawResponse,
					updatedPlan: {
						...previousPlan,
						version: previousPlan.version + 1,
						lastUpdatedAt: new Date().toISOString(),
					},
				},
			};
		}

		// Validate and construct plan
		const updatedPlan: IntakePlanDocument = parsed.updatedPlan
			? {
					version: parsed.updatedPlan.version ?? previousPlan.version + 1,
					title: parsed.updatedPlan.title ?? previousPlan.title,
					summary: parsed.updatedPlan.summary ?? previousPlan.summary,
					requirements: normalizeExtractedItems(
						parsed.updatedPlan.requirements,
						'REQUIREMENT',
						turnNumber
					),
					decisions: normalizeExtractedItems(
						parsed.updatedPlan.decisions,
						'DECISION',
						turnNumber
					),
					constraints: normalizeExtractedItems(
						parsed.updatedPlan.constraints,
						'CONSTRAINT',
						turnNumber
					),
					openQuestions: normalizeExtractedItems(
						parsed.updatedPlan.openQuestions,
						'OPEN_QUESTION',
						turnNumber
					),
					technicalNotes: Array.isArray(parsed.updatedPlan.technicalNotes)
						? parsed.updatedPlan.technicalNotes
						: previousPlan.technicalNotes,
					proposedApproach:
						parsed.updatedPlan.proposedApproach ?? previousPlan.proposedApproach,
					lastUpdatedAt:
						parsed.updatedPlan.lastUpdatedAt ?? new Date().toISOString(),
				}
			: {
					...previousPlan,
					version: previousPlan.version + 1,
					lastUpdatedAt: new Date().toISOString(),
				};

		const response: IntakeTurnResponse = {
			conversationalResponse: parsed.conversationalResponse,
			updatedPlan,
			suggestedQuestions: Array.isArray(parsed.suggestedQuestions)
				? parsed.suggestedQuestions
				: undefined,
			codebaseFindings: Array.isArray(parsed.codebaseFindings)
				? parsed.codebaseFindings
				: undefined,
		};

		return { success: true, value: response };
	} catch (error) {
		// Graceful degradation: if JSON parse fails entirely,
		// try to extract meaningful content from raw response
		if (isLoggerInitialized()) {
			const errMsg = error instanceof Error ? error.message : String(error);
			getLogger()
				.child({ component: 'role:technicalExpertIntake' })
				.warn('Failed to parse INTAKE response as JSON, using graceful degradation', {
					errorMessage: errMsg,
					rawResponseLength: rawResponse.length,
					rawResponse,
				});
		}

		const cleanedResponse = extractReadableContent(rawResponse);

		return {
			success: true,
			value: {
				conversationalResponse: cleanedResponse,
				updatedPlan: {
					...previousPlan,
					version: previousPlan.version + 1,
					lastUpdatedAt: new Date().toISOString(),
				},
			},
		};
	}
}

/**
 * Extract the final model response from JSONL stream output.
 * Walks backward through lines looking for a result event.
 * Falls back to extractReadableContent() if no result event found.
 */
function extractFinalResponseFromStream(rawOutput: string): string {
	const lines = rawOutput.split('\n').filter((l) => l.trim());
	// Walk backward to find a result event (emitted last by most CLIs)
	for (let i = lines.length - 1; i >= 0; i--) {
		try {
			const event = JSON.parse(lines[i]);
			// Claude Code result event
			if (event.type === 'result' && typeof event.result === 'string') {
				return event.result;
			}
			// Codex result event
			if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text) {
				return event.item.text;
			}
			// Generic response field
			if (event.type === 'result' && typeof event.response === 'string') {
				return event.response;
			}
		} catch { /* skip non-JSON lines */ }
	}
	// Fallback: delegate to existing readable content extractor
	return extractReadableContent(rawOutput);
}

/**
 * Extract readable content from raw CLI output that may contain
 * streaming JSONL events. Tries to pull agent_message text from
 * event lines; falls back to stripping JSON noise for readability.
 */
function extractReadableContent(rawResponse: string): string {
	const lines = rawResponse.split('\n').filter((l) => l.trim());
	const messages: string[] = [];

	for (const line of lines) {
		const extracted = extractMessageFromLine(line);
		if (extracted) {
			messages.push(extracted);
		}
	}

	if (messages.length > 0) {
		return messages.join('\n\n');
	}

	// Absolute fallback: return raw response (truncated for readability)
	if (rawResponse.length > 2000) {
		return rawResponse.substring(0, 2000) + '\n\n[Response truncated — parsing failed]';
	}
	return rawResponse;
}

/** Try to extract a readable message from a single JSONL line. */
function extractMessageFromLine(line: string): string | null {
	try {
		const event = JSON.parse(line);

		// Codex Responses API: item.completed with agent_message
		if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text) {
			return event.item.text;
		}
		// Legacy format: assistant message
		if (event.role === 'assistant' && event.content) {
			return event.content;
		}
		// Result event
		if (event.type === 'result' && event.response) {
			return event.response;
		}
		return null;
	} catch {
		// Non-JSON line — keep it as plain text if it's not empty noise
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
			return trimmed;
		}
		return null;
	}
}

/**
 * Extract a JSON object string from a raw LLM response.
 * Handles markdown code fences, surrounding prose, and braces in trailing text.
 */
function extractJsonFromIntakeResponse(rawResponse: string): string {
	const trimmed = rawResponse.trim();

	return tryDirectParseIntake(trimmed)
		?? tryFenceExtractionIntake(trimmed)
		?? extractBalancedJsonObjectIntake(trimmed)
		?? trimmed;
}

function tryDirectParseIntake(text: string): string | null {
	try { JSON.parse(text); return text; } catch { return null; }
}

function tryFenceExtractionIntake(text: string): string | null {
	const m = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(text);
	if (!m) { return null; }

	const content = m[1].trim();
	return tryDirectParseIntake(content) ?? extractBalancedJsonObjectIntake(content);
}

function extractBalancedJsonObjectIntake(text: string): string | null {
	const start = text.indexOf('{');
	if (start === -1) { return null; }

	const end = findMatchingBraceIntake(text, start);
	return end === -1 ? null : text.substring(start, end + 1);
}

function findMatchingBraceIntake(text: string, start: number): number {
	let depth = 0;
	let inString = false;
	let skip = false;

	for (let i = start; i < text.length; i++) {
		const ch = text[i];

		if (skip) { skip = false; continue; }

		if (inString) {
			skip = ch === '\\';
			if (ch === '"') { inString = false; }
			continue;
		}
		if (ch === '"') { inString = true; continue; }
		if (ch === '{') { depth++; }
		if (ch === '}' && --depth === 0) { return i; }
	}

	return -1;
}

/**
 * Normalize extracted items from parsed JSON.
 * Ensures each item has required fields and correct types.
 * Handles both object items ({id, text, ...}) and string items ("[ID] text...").
 */
function normalizeExtractedItems(
	items: unknown,
	defaultType: string,
	turnNumber: number
): IntakePlanDocument['requirements'] {
	if (!Array.isArray(items)) {
		return [];
	}

	return items.map((rawItem: unknown, index: number) => {
		// Handle string items: "[REQ-1] Full description..." or plain "Description..."
		if (typeof rawItem === 'string') {
			const parsed = parseStringItem(rawItem, defaultType, index);
			return {
				id: parsed.id,
				type: defaultType as IntakeExtractedItemType,
				text: parsed.text,
				extractedFromTurnId: turnNumber,
				timestamp: new Date().toISOString(),
			};
		}

		// Handle object items: {id, type, text, ...}
		const item = rawItem as Record<string, unknown>;
		return {
			id: (item.id as string) ?? `${defaultType.charAt(0)}-${index + 1}`,
			type: ((item.type as string) ?? defaultType) as IntakeExtractedItemType,
			text: (item.text as string) ?? '',
			extractedFromTurnId:
				typeof item.extractedFromTurnId === 'number'
					? item.extractedFromTurnId
					: turnNumber,
			timestamp: (item.timestamp as string) ?? new Date().toISOString(),
		};
	});
}

/**
 * Parse a string item into id + text.
 * Handles formats like:
 *   "[REQ-1] Full description..."
 *   "[R-1] Description..."
 *   "Just plain text without an ID prefix"
 */
function parseStringItem(
	str: string,
	defaultType: string,
	index: number
): { id: string; text: string } {
	const trimmed = str.trim();

	// Try to extract [ID] prefix: matches [REQ-1], [R-1], [DEC-2], [Q-3], etc.
	const match = /^\[([A-Z][\w-]*)\]\s*(.*)$/s.exec(trimmed);
	if (match) {
		return {
			id: match[1],
			text: match[2].trim(),
		};
	}

	// No ID prefix — generate one and use the whole string as text
	return {
		id: `${defaultType.charAt(0)}-${index + 1}`,
		text: trimmed,
	};
}

/**
 * Validate IntakeTurnResponse for guardrail compliance and quality.
 * Returns warnings but does not block — validation is advisory.
 */
function validateIntakeTurnResponse(response: IntakeTurnResponse): Result<void> {
	const warnings: string[] = [];

	// Check for feasibility verdicts in conversational response
	const text = response.conversationalResponse.toLowerCase();
	const feasibilityPatterns = [
		/this (will|won't|should|shouldn't) work/i,
		/i (recommend|suggest|advise) (that you|we)/i,
		/(proceed|go ahead) with (implementation|building|coding)/i,
		/this is (feasible|infeasible|viable|not viable)/i,
	];

	for (const pattern of feasibilityPatterns) {
		if (pattern.test(text)) {
			warnings.push(
				`Response may contain feasibility verdict (forbidden): "${pattern.source}"`
			);
		}
	}

	// Check plan quality
	const plan = response.updatedPlan;
	if (!plan.title) {
		warnings.push('Plan is missing a title');
	}
	if (!plan.summary) {
		warnings.push('Plan is missing a summary');
	}

	if (warnings.length > 0) {
		if (isLoggerInitialized()) {
			getLogger()
				.child({ component: 'role:technicalExpertIntake' })
				.warn('INTAKE Technical Expert response warnings', { warnings });
		}
		return {
			success: false,
			error: new Error(`INTAKE response warnings:\n${warnings.join('\n')}`),
		};
	}

	return { success: true, value: undefined };
}
