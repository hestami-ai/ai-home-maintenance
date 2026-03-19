/**
 * Reasoning Reviewer
 *
 * Automated critique of agent thinking processes. Runs after every CLI
 * agent invocation completes, examining intermediate reasoning and final
 * output for flawed assumptions, logical gaps, and reasoning risks.
 *
 * Uses a lightweight direct LLM call (not CLI-backed) with a configurable
 * provider/model (defaults to Gemini).
 */

import type { ReasoningReview, ReviewConcern, ReviewOptions, ReviewSeverity } from './reviewTypes';
import { LLMProvider as LLMProviderEnum } from '../types';
import type { LLMProvider, ProviderConfig } from '../llm/provider';
import { MessageRole } from '../llm/provider';
import { createProvider } from '../llm/providerFactory';
import { getLogger, isLoggerInitialized } from '../logging';
import { getSecretKeyManager } from '../config/secretKeyManager';
import * as vscode from 'vscode';

// ==================== SYSTEM PROMPT ====================

const REVIEWER_SYSTEM_PROMPT = `You are a REASONING REVIEWER in a governed software engineering workflow.

Your job is to critically examine an AI agent's thinking process and final output
for logical flaws, unsupported assumptions, and reasoning risks.

You will receive:
1. The agent's intermediate reasoning (tool calls, thinking steps, observations)
2. The agent's final response

Look for:
- Assumptions stated as facts without validation
- Index-based or order-dependent logic that could break with different data
- Missing edge cases (empty arrays, null values, concurrent access, race conditions)
- Contradictions between reasoning steps and conclusions
- Over-confident conclusions from insufficient evidence
- Solutions that work for the happy path but fail on edge cases
- Fragile coupling between components that aren't explicitly linked
- Data transformations that lose information or change semantics silently

For each concern, assess:
- Severity: HIGH (likely to cause failures), MEDIUM (fragile but may work), LOW (style/preference)
- What specifically is wrong
- What a better approach would be

Response format (JSON only, no markdown fences):
{
  "hasConcerns": true,
  "concerns": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "summary": "One-line description",
      "detail": "Detailed explanation of why this is problematic",
      "location": "Which part of the reasoning this relates to",
      "recommendation": "What should be done instead"
    }
  ],
  "overallAssessment": "Brief overall quality assessment"
}

If the reasoning is sound, return:
{ "hasConcerns": false, "concerns": [], "overallAssessment": "..." }

IMPORTANT:
- Do NOT flag style preferences or minor wording issues
- Do NOT flag things that are clearly intentional design decisions
- Only flag SUBSTANTIVE reasoning risks that could cause real problems
- Be concise — the human will read these during their workflow`;

// ==================== SEVERITY ORDERING ====================

const SEVERITY_ORDER: Record<ReviewSeverity, number> = {
	HIGH: 3,
	MEDIUM: 2,
	LOW: 1,
};

// ==================== MAIN ENTRY POINT ====================

/**
 * Review an agent's reasoning for flaws and concerns.
 *
 * @returns ReasoningReview with concerns (if any), or null if the reviewer
 *          is disabled or unavailable (no API key, provider error, etc.).
 */
export async function reviewAgentReasoning(
	options: ReviewOptions,
): Promise<ReasoningReview | null> {
	const startTime = Date.now();

	// Check if reviewer is enabled
	const config = vscode.workspace.getConfiguration('janumicode');
	if (!config.get<boolean>('reasoningReviewer.enabled', true)) {
		return null;
	}

	const log = isLoggerInitialized()
		? getLogger().child({ component: 'reasoningReviewer' })
		: null;

	try {
		// Create LLM provider
		const provider = await createReviewerProvider();
		if (!provider) {
			log?.debug('Reasoning reviewer skipped — no provider available');
			return null;
		}

		// Build input from streaming trace + final response
		const userMessage = buildReviewInput(options);

		// Invoke LLM
		const model = getReviewerModel();
		const response = await provider.complete({
			messages: [
				{ role: MessageRole.USER, content: userMessage },
			],
			systemPrompt: REVIEWER_SYSTEM_PROMPT,
			model,
			temperature: 0.1, // Low temperature for analytical consistency
		});

		if (!response.success) {
			log?.warn('Reasoning reviewer LLM call failed', {
				error: response.error.message,
			});
			return null;
		}

		// Parse response
		const review = parseReviewResponse(
			response.value.content,
			Date.now() - startTime,
			getReviewerModel(),
			options.minSeverity,
		);

		if (review.hasConcerns) {
			log?.info('Reasoning concerns found', {
				role: options.role,
				phase: options.phase,
				concerns: review.concerns.length,
				maxSeverity: review.concerns[0]?.severity,
				durationMs: review.reviewDurationMs,
			});
		} else {
			log?.debug('Reasoning review clean', {
				role: options.role,
				phase: options.phase,
				durationMs: review.reviewDurationMs,
			});
		}

		return review;
	} catch (error) {
		log?.warn('Reasoning reviewer failed', {
			error: error instanceof Error ? error.message : String(error),
		});
		return null; // Non-fatal — don't block the workflow
	}
}

// ==================== INPUT CONSTRUCTION ====================

/**
 * Build the review input from streaming trace and final response.
 * Condenses tool calls into summaries to keep token usage manageable.
 */
function buildReviewInput(options: ReviewOptions): string {
	const sections: string[] = [];

	if (options.role || options.phase) {
		sections.push(`# Context\nRole: ${options.role ?? 'unknown'}, Phase: ${options.phase ?? 'unknown'}`);
	}

	// Condense the raw streaming output
	if (options.rawStreamOutput) {
		const condensed = condenseStreamingTrace(options.rawStreamOutput);
		sections.push(`# Agent Reasoning Trace\n\n${condensed}`);
	}

	// Final response
	if (options.finalResponse) {
		// Truncate very long responses to keep review focused
		const maxLen = 8000;
		const response = options.finalResponse.length > maxLen
			? options.finalResponse.substring(0, maxLen) + '\n\n[... truncated for review]'
			: options.finalResponse;
		sections.push(`# Final Response\n\n${response}`);
	}

	return sections.join('\n\n---\n\n');
}

/**
 * Condense a raw JSONL streaming trace into a readable summary.
 * Keeps reasoning/message text in full, summarizes tool calls.
 */
function condenseStreamingTrace(raw: string): string {
	const lines = raw.split('\n').filter(l => l.trim());
	const parts: string[] = [];
	let totalToolCalls = 0;

	for (const line of lines) {
		try {
			const event = JSON.parse(line);

			// Agent reasoning/messages — keep in full
			if (event.type === 'message' || event.type === 'agent_message') {
				const content = event.content ?? event.text ?? '';
				if (content) {
					parts.push(`[Reasoning] ${content}`);
				}
			}
			// Tool calls — summarize
			else if (event.type === 'tool_use' || event.type === 'tool_call') {
				totalToolCalls++;
				const toolName = event.tool_name ?? event.name ?? 'unknown';
				const path = event.parameters?.path ?? event.parameters?.command ?? '';
				parts.push(`[Tool: ${toolName}${path ? '(' + String(path).substring(0, 80) + ')' : ''}]`);
			}
			// Tool results — brief summary only
			else if (event.type === 'tool_result') {
				const status = event.status ?? 'done';
				parts.push(`[Tool result: ${status}]`);
			}
			// Codex-specific reasoning
			else if (event.type === 'item.created' && event.item?.type === 'reasoning') {
				// Codex reasoning items
			}
			else if (event.type === 'content.delta' && event.delta?.text) {
				parts.push(event.delta.text);
			}
		} catch {
			// Non-JSON line — might be raw text output, include if short
			if (line.length < 500 && !line.startsWith('{')) {
				parts.push(line);
			}
		}
	}

	// Cap the output to prevent token explosion
	const maxChars = 12000;
	let result = parts.join('\n');
	if (result.length > maxChars) {
		result = result.substring(0, maxChars) + '\n\n[... trace truncated for review, ' + totalToolCalls + ' total tool calls]';
	}

	return result;
}

// ==================== RESPONSE PARSING ====================

function parseReviewResponse(
	response: string,
	durationMs: number,
	model: string,
	minSeverity?: ReviewSeverity,
): ReasoningReview {
	const emptyReview: ReasoningReview = {
		hasConcerns: false,
		concerns: [],
		overallAssessment: 'Review completed — no parse result',
		reviewDurationMs: durationMs,
		reviewerModel: model,
	};

	try {
		// Try direct JSON parse
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(response.trim());
		} catch {
			// Try extracting JSON from fences or braces
			const braceStart = response.indexOf('{');
			const braceEnd = response.lastIndexOf('}');
			if (braceStart !== -1 && braceEnd > braceStart) {
				parsed = JSON.parse(response.substring(braceStart, braceEnd + 1));
			} else {
				return emptyReview;
			}
		}

		const hasConcerns = parsed.hasConcerns === true;
		const rawConcerns = Array.isArray(parsed.concerns) ? parsed.concerns : [];
		const overallAssessment = typeof parsed.overallAssessment === 'string'
			? parsed.overallAssessment
			: 'No assessment provided';

		// Parse and filter concerns
		let concerns: ReviewConcern[] = rawConcerns
			.filter((c: unknown): c is Record<string, unknown> => typeof c === 'object' && c !== null)
			.map((c) => ({
				severity: (['HIGH', 'MEDIUM', 'LOW'].includes(c.severity as string)
					? c.severity as ReviewSeverity
					: 'MEDIUM'),
				summary: String(c.summary ?? ''),
				detail: String(c.detail ?? ''),
				location: String(c.location ?? ''),
				recommendation: String(c.recommendation ?? ''),
			}));

		// Filter by minimum severity
		if (minSeverity) {
			const minOrder = SEVERITY_ORDER[minSeverity];
			concerns = concerns.filter(c => SEVERITY_ORDER[c.severity] >= minOrder);
		}

		// Sort by severity (HIGH first)
		concerns.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);

		return {
			hasConcerns: concerns.length > 0,
			concerns,
			overallAssessment,
			reviewDurationMs: durationMs,
			reviewerModel: model,
		};
	} catch {
		return emptyReview;
	}
}

// ==================== PROVIDER CREATION ====================

async function createReviewerProvider(): Promise<LLMProvider | null> {
	const config = vscode.workspace.getConfiguration('janumicode');

	const providerName = config.get<string>('reasoningReviewer.provider', 'GEMINI');
	const providerEnum =
		LLMProviderEnum[providerName as keyof typeof LLMProviderEnum] ??
		LLMProviderEnum.GEMINI;

	const apiKey = await resolveReviewerApiKey(providerEnum);
	if (!apiKey) {
		return null;
	}

	const providerConfig: ProviderConfig = {
		apiKey,
		defaultModel: getReviewerModel(),
	};

	const result = createProvider(providerEnum, providerConfig);
	return result.success ? result.value : null;
}

async function resolveReviewerApiKey(provider: LLMProviderEnum): Promise<string | null> {
	try {
		// Try reviewer-specific key first, then fall back to evaluator key
		const key = await getSecretKeyManager().getApiKey('reasoningReviewer', provider);
		if (key?.trim()) { return key.trim(); }

		// Fall back to evaluator's key (same lightweight utility pattern)
		const evalKey = await getSecretKeyManager().getApiKey('evaluator', provider);
		if (evalKey?.trim()) { return evalKey.trim(); }
	} catch { /* SecretStorage may not be initialized */ }
	return null;
}

function getReviewerModel(): string {
	const config = vscode.workspace.getConfiguration('janumicode');
	return config.get<string>('reasoningReviewer.model', 'gemini-2.5-pro');
}
