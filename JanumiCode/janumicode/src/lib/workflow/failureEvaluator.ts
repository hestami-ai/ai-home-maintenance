/**
 * Failure Evaluator
 * Lightweight LLM call to analyze executor output when a task unit fails.
 * Extracts actionable context (deliverables, issues, recommendations) for
 * the "Human Decision Required" gate card.
 *
 * Follows the clarificationExpert.ts direct-API pattern —
 * fast model, graceful fallback, timing metadata.
 */

import type { Result } from '../types';
import { LLMProvider as LLMProviderEnum } from '../types';
import type { LLMProvider, ProviderConfig } from '../llm/provider';
import { MessageRole } from '../llm/provider';
import { createProvider } from '../llm/providerFactory';
import { getSecretKeyManager } from '../config/secretKeyManager';
import * as vscode from 'vscode';

// ==================== TYPES ====================

export type CompletionStatus =
	| 'completed_with_errors'
	| 'partially_completed'
	| 'blocked'
	| 'failed';

export interface FailureEvaluation {
	completionStatus: CompletionStatus;
	summary: string;
	deliverables: string[];
	issues: string[];
	recommendations: string[];
	contentRecoverable?: boolean;
	intendedFilePath?: string;
	elapsedMs: number;
	model: string;
}

// ==================== SYSTEM PROMPT ====================

const FAILURE_EVALUATOR_SYSTEM_PROMPT = `You are a failure analyst for a governed software development workflow. A task unit executed by an AI agent has exited with an error. Analyze the agent's output and classify the outcome.

You will receive:
- The unit's label and goal
- The agent's raw output (may be long — focus on key signals)
- The failure reason and failure type

Respond with valid JSON only. No markdown, no code fences, no extra text.

{
  "completionStatus": "completed_with_errors" | "partially_completed" | "blocked" | "failed",
  "summary": "1-2 sentence human-readable summary of what happened",
  "deliverables": ["List of files/artifacts actually created or modified"],
  "issues": ["List of specific problems that caused the failure"],
  "recommendations": ["List of actionable next steps for the human"],
  "contentRecoverable": true/false,
  "intendedFilePath": "path/to/intended/file" or null
}

Status definitions:
- completed_with_errors: The agent completed most/all of its intended work, but the process exited with an error (e.g., tool permission denied, non-critical validation failure). Deliverables exist.
- partially_completed: The agent completed some work but could not finish. Some deliverables exist but the goal is not fully met.
- blocked: The agent could not proceed due to missing information, permissions, or external dependencies. Little to no deliverables.
- failed: The agent produced no useful output or the output is incoherent/irrelevant.

Content recovery detection:
- If the agent appears to have produced the full intended file content in its output but failed to write it to disk (e.g., permission denied, tool timeout), set "contentRecoverable" to true and include the intended file path in "intendedFilePath" if detectable.
- Otherwise set "contentRecoverable" to false and "intendedFilePath" to null.

Keep arrays concise (3-5 items max each). Focus on actionable information.`;

// ==================== MAIN FUNCTION ====================

/**
 * Analyze a failed task unit's executor output and extract actionable context.
 *
 * @param unitLabel   Human-readable unit name
 * @param unitGoal    The unit's objective
 * @param executorOutput  Raw output from the executor (may be empty on hard failures)
 * @param failureReason   Why the failure was reported (e.g., "Exit code 1")
 * @param failureType     Classified failure type (e.g., "runtime_error", "lint_error")
 * @returns Structured evaluation with timing metadata
 */
export async function evaluateUnitFailure(
	unitLabel: string,
	unitGoal: string,
	executorOutput: string,
	failureReason: string,
	failureType: string,
): Promise<Result<FailureEvaluation>> {
	const provider = await createFailureEvaluatorProvider();
	if (!provider) {
		// No API key — return minimal fallback
		return {
			success: true,
			value: buildFallbackEvaluation(failureReason, failureType),
		};
	}

	const model = getFailureEvaluatorModel();
	const startMs = Date.now();

	// Truncate executor output to avoid exceeding context limits
	const truncatedOutput = executorOutput.length > 8000
		? executorOutput.substring(0, 4000) + '\n\n[... truncated ...]\n\n' + executorOutput.substring(executorOutput.length - 4000)
		: executorOutput;

	const userMessage = [
		`## Unit: ${unitLabel}`,
		`## Goal: ${unitGoal}`,
		`## Failure Reason: ${failureReason}`,
		`## Failure Type: ${failureType}`,
		'',
		'## Agent Output:',
		truncatedOutput || '(no output captured)',
	].join('\n');

	const result = await provider.complete({
		systemPrompt: FAILURE_EVALUATOR_SYSTEM_PROMPT,
		messages: [{ role: MessageRole.USER, content: userMessage }],
		model,
		temperature: 0.1,
	});

	const elapsedMs = Date.now() - startMs;

	if (!result.success) {
		// LLM call failed — return fallback
		return {
			success: true,
			value: buildFallbackEvaluation(failureReason, failureType),
		};
	}

	// Parse the JSON response
	try {
		const parsed = JSON.parse(result.value.content);
		return {
			success: true,
			value: {
				completionStatus: validateStatus(parsed.completionStatus),
				summary: typeof parsed.summary === 'string' ? parsed.summary : failureReason,
				deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables.filter((d: unknown) => typeof d === 'string') : [],
				issues: Array.isArray(parsed.issues) ? parsed.issues.filter((i: unknown) => typeof i === 'string') : [],
				recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.filter((r: unknown) => typeof r === 'string') : [],
				contentRecoverable: parsed.contentRecoverable === true,
				intendedFilePath: typeof parsed.intendedFilePath === 'string' ? parsed.intendedFilePath : undefined,
				elapsedMs,
				model,
			},
		};
	} catch {
		// JSON parse failed — return fallback with the raw response as summary
		return {
			success: true,
			value: {
				...buildFallbackEvaluation(failureReason, failureType),
				summary: result.value.content.substring(0, 200),
				elapsedMs,
				model,
			},
		};
	}
}

// ==================== HELPERS ====================

function validateStatus(status: unknown): CompletionStatus {
	const valid: CompletionStatus[] = ['completed_with_errors', 'partially_completed', 'blocked', 'failed'];
	if (typeof status === 'string' && valid.includes(status as CompletionStatus)) {
		return status as CompletionStatus;
	}
	return 'failed';
}

function buildFallbackEvaluation(reason: string, failureType: string): FailureEvaluation {
	return {
		completionStatus: 'failed',
		summary: reason,
		deliverables: [],
		issues: [reason],
		recommendations: failureType === 'runtime_error'
			? ['Review the executor output for permission denials or missing tools', 'Consider retrying with adjusted tool permissions']
			: ['Review the validation output and fix the identified issues'],
		elapsedMs: 0,
		model: 'fallback',
	};
}

// ==================== PROVIDER CREATION ====================

async function createFailureEvaluatorProvider(): Promise<LLMProvider | null> {
	const config = vscode.workspace.getConfiguration('janumicode');

	const providerName = config.get<string>(
		'curator.provider',
		config.get<string>('evaluator.provider', 'GEMINI')
	);

	const providerEnum =
		LLMProviderEnum[providerName as keyof typeof LLMProviderEnum] ??
		LLMProviderEnum.GEMINI;

	const apiKey = await resolveFailureEvaluatorApiKey(providerEnum);
	if (!apiKey) {
		return null;
	}

	const providerConfig: ProviderConfig = {
		apiKey,
		defaultModel: getFailureEvaluatorModel(),
	};

	const result = createProvider(providerEnum, providerConfig);
	return result.success ? result.value : null;
}

async function resolveFailureEvaluatorApiKey(
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

function getFailureEvaluatorModel(): string {
	const config = vscode.workspace.getConfiguration('janumicode');
	return config.get<string>(
		'curator.model',
		config.get<string>('evaluator.model', 'gemini-3-flash-lite')
	);
}
