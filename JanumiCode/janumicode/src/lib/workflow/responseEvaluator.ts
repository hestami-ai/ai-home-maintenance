/**
 * Response Evaluator
 * Classifies executor responses to determine workflow routing.
 * Uses a lightweight LLM API call (default: Gemini) to assess whether
 * the executor's response is cogent enough to proceed, or needs human escalation.
 *
 * Verdicts:
 * - PROCEED: Response is a coherent, actionable proposal → continue to ASSUMPTION_SURFACING
 * - ESCALATE_CONFUSED: Response indicates confusion/inability → human gate
 * - ESCALATE_QUESTIONS: Response contains questions needing answers → human gate with questions
 * - ESCALATE_OPTIONS: Response presents multiple approaches → branch analysis per option
 */

import { LLMProvider as LLMProviderEnum } from '../types';
import type { Assumption } from '../roles/executor';
import type { LLMProvider, ProviderConfig } from '../llm/provider';
import { MessageRole } from '../llm/provider';
import { createProvider } from '../llm/providerFactory';
import { getLogger, isLoggerInitialized } from '../logging';
import { getSecretKeyManager } from '../config/secretKeyManager';
import { emitWorkflowCommand } from '../integration/eventBus';
import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';

// ==================== TYPES ====================

/**
 * Evaluation verdict — determines workflow routing after PROPOSE
 */
export enum EvaluationVerdict {
	/** Response is cogent — proceed to ASSUMPTION_SURFACING */
	PROCEED = 'PROCEED',
	/** Response indicates confusion — escalate to human gate */
	ESCALATE_CONFUSED = 'ESCALATE_CONFUSED',
	/** Response contains questions needing answers — escalate to human gate */
	ESCALATE_QUESTIONS = 'ESCALATE_QUESTIONS',
	/** Response presents multiple options — branch analysis per option */
	ESCALATE_OPTIONS = 'ESCALATE_OPTIONS',
	/** Decomposition quality: task graph needs further breakdown */
	DECOMPOSE_REQUIRED = 'DECOMPOSE_REQUIRED',
	/** Decomposition quality: units are too coarse-grained */
	TOO_COARSE = 'TOO_COARSE',
	/** Decomposition quality: units lack verifiable observables */
	NOT_VERIFIABLE = 'NOT_VERIFIABLE',
	/** Decomposition quality: units missing required observables */
	MISSING_OBSERVABLES = 'MISSING_OBSERVABLES',
	/** Workflow: no acceptance contract defined for validation */
	MISSING_ACCEPTANCE_CONTRACT = 'MISSING_ACCEPTANCE_CONTRACT',
}

/**
 * A discrete proposal option extracted from an ESCALATE_OPTIONS response
 */
export interface ProposalOption {
	label: string;
	summary: string;
	proposal: string;
}

/**
 * A proposal branch in workflow metadata — tracks per-option analysis state
 */
export interface ProposalBranch {
	branch_id: string;
	label: string;
	proposal: string;
	summary: string;
	status: 'pending' | 'analyzing' | 'analyzed';
	assumptions?: Assumption[];
	claim_ids?: string[];
	historical_findings?: string[];
}

/**
 * Evaluation result from the LLM-as-judge call
 */
export interface EvaluationResult {
	verdict: EvaluationVerdict;
	reasoning: string;
	/** Human-readable summary of the problem (for ESCALATE_CONFUSED) */
	summary?: string;
	/** Extracted questions (for ESCALATE_QUESTIONS) */
	questions?: string[];
	/** Extracted options (for ESCALATE_OPTIONS) */
	options?: ProposalOption[];
	/** Token usage for the evaluation call */
	tokenUsage?: { input: number; output: number };
}

// ==================== SYSTEM PROMPT ====================

const EVALUATOR_SYSTEM_PROMPT = `You are a response quality evaluator for a governed software development workflow.

Your task is to analyze an executor's response to a user's goal and classify it into exactly one category.

Categories:

1. PROCEED — The response is a coherent, actionable technical proposal that addresses the user's goal. It contains specific implementation steps, code changes, or architectural decisions. It can proceed to verification.

2. ESCALATE_CONFUSED — The response indicates the executor is confused, doesn't understand the goal, or cannot provide a meaningful proposal. Signs include: meta-commentary about the task instead of doing it, asking what the user means, stating inability to proceed, or producing irrelevant content.

3. ESCALATE_QUESTIONS — The response contains specific technical questions that need human answers before a proposal can be formed. The executor understands the goal but needs clarification on specific points.

4. ESCALATE_OPTIONS — The response presents multiple distinct implementation approaches or options. Each option is a viable but different technical path forward. The human needs to see all options fully analyzed before choosing.

Respond with valid JSON only. No markdown, no code fences, no extra text.

For PROCEED:
{"verdict": "PROCEED", "reasoning": "Brief explanation of why the response is actionable"}

For ESCALATE_CONFUSED:
{"verdict": "ESCALATE_CONFUSED", "reasoning": "What indicates confusion", "summary": "Brief description of the problem for the human"}

For ESCALATE_QUESTIONS:
{"verdict": "ESCALATE_QUESTIONS", "reasoning": "Why questions block progress", "questions": ["Question 1", "Question 2"]}

For ESCALATE_OPTIONS:
{"verdict": "ESCALATE_OPTIONS", "reasoning": "Why these are distinct options requiring separate analysis", "options": [{"label": "Short label", "summary": "Brief description", "proposal": "Full proposal text for this option"}]}

When evaluating a task graph decomposition (if present in the response), also consider:

5. DECOMPOSE_REQUIRED — The response contains a task graph but individual units need further breakdown to be executable.

6. TOO_COARSE — Task units are too large and bundle multiple objectives. Each unit should have a single primary objective.

7. NOT_VERIFIABLE — Task units lack falsifiers or verification methods. Each unit must be verifiable.

8. MISSING_OBSERVABLES — Task units are missing concrete observables that prove success.

For decomposition verdicts:
{"verdict": "DECOMPOSE_REQUIRED", "reasoning": "Why further decomposition is needed"}
{"verdict": "TOO_COARSE", "reasoning": "Which units are too large and why"}
{"verdict": "NOT_VERIFIABLE", "reasoning": "Which units lack verification criteria"}
{"verdict": "MISSING_OBSERVABLES", "reasoning": "Which units are missing observables"}`;

// ==================== EVALUATOR ====================

/**
 * Evaluate an executor response to determine workflow routing.
 * Uses a lightweight LLM API call to classify the response.
 * On evaluator failure, defaults to PROCEED to avoid blocking the workflow.
 */
export async function evaluateExecutorResponse(
	goal: string,
	executorResponse: string,
	dialogueId?: string,
): Promise<EvaluationResult> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'evaluator' })
		: undefined;

	const evalCommandId = randomUUID();

	logger?.info('Evaluating executor response', {
		goalLength: goal.length,
		responseLength: executorResponse.length,
	});

	try {
		const provider = await createEvaluatorProvider();
		if (!provider) {
			logger?.warn('Could not create evaluator provider — defaulting to PROCEED');
			return {
				verdict: EvaluationVerdict.PROCEED,
				reasoning: 'Evaluator provider unavailable — no API key or provider configured',
			};
		}

		const model = getEvaluatorModel();
		const startMs = Date.now();

		// Emit command block for evaluator (collapsed by default)
		emitWorkflowCommand({
			dialogueId: dialogueId ?? 'evaluator',
			commandId: evalCommandId,
			action: 'start',
			commandType: 'llm_api_call',
			label: `Evaluator (${model})`,
			summary: 'Classifying executor response…',
			status: 'running',
			timestamp: new Date().toISOString(),
			collapsed: true,
		});

		const result = await provider.complete({
			systemPrompt: EVALUATOR_SYSTEM_PROMPT,
			messages: [
				{
					role: MessageRole.USER,
					content: `Goal: ${goal}\n\n---\n\nExecutor Response:\n${executorResponse}`,
				},
			],
			model,
			temperature: 0.1,
		});

		const elapsedMs = Date.now() - startMs;

		if (!result.success) {
			const err = result.error;
			const isLLMError = err && 'type' in err && 'statusCode' in err;
			logger?.warn('Evaluator LLM call failed — defaulting to PROCEED', {
				error: err.message,
				errorType: isLLMError ? (err as any).type : undefined,
				statusCode: isLLMError ? (err as any).statusCode : undefined,
				metadata: isLLMError ? (err as any).metadata : undefined,
				elapsedMs,
			});
			emitWorkflowCommand({
				dialogueId: dialogueId ?? 'evaluator',
				commandId: evalCommandId,
				action: 'error',
				commandType: 'llm_api_call',
				label: 'Evaluator',
				summary: `Failed: ${err.message}`,
				detail: isLLMError ? `Type: ${(err as any).type}, Status: ${(err as any).statusCode}` : undefined,
				status: 'error',
				timestamp: new Date().toISOString(),
			});
			return {
				verdict: EvaluationVerdict.PROCEED,
				reasoning: `Evaluator call failed: ${err.message}`,
			};
		}

		const parsed = parseEvaluatorResponse(result.value.content);

		logger?.info('Evaluation complete', {
			verdict: parsed.verdict,
			reasoning: parsed.reasoning,
			optionCount: parsed.options?.length,
			questionCount: parsed.questions?.length,
			inputTokens: result.value.usage.inputTokens,
			outputTokens: result.value.usage.outputTokens,
			elapsedMs,
		});

		emitWorkflowCommand({
			dialogueId: dialogueId ?? 'evaluator',
			commandId: evalCommandId,
			action: 'complete',
			commandType: 'llm_api_call',
			label: 'Evaluator',
			summary: `Verdict: ${parsed.verdict} (${elapsedMs}ms, ${result.value.usage.inputTokens}+${result.value.usage.outputTokens} tokens)`,
			detail: parsed.reasoning,
			status: 'success',
			timestamp: new Date().toISOString(),
		});

		return {
			...parsed,
			tokenUsage: {
				input: result.value.usage.inputTokens,
				output: result.value.usage.outputTokens,
			},
		};
	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error);
		const errStack = error instanceof Error ? error.stack : undefined;
		logger?.error('Evaluator threw unexpectedly — defaulting to PROCEED', {
			error: errMsg,
			stack: errStack,
			errorName: error instanceof Error ? error.name : typeof error,
		});
		emitWorkflowCommand({
			dialogueId: dialogueId ?? 'evaluator',
			commandId: evalCommandId,
			action: 'error',
			commandType: 'llm_api_call',
			label: 'Evaluator',
			summary: `Error: ${errMsg}`,
			status: 'error',
			timestamp: new Date().toISOString(),
		});
		return {
			verdict: EvaluationVerdict.PROCEED,
			reasoning: `Evaluator error: ${errMsg}`,
		};
	}
}

// ==================== PROVIDER CREATION ====================

/**
 * Create the LLM provider instance for evaluation.
 * Reads provider type and API key from VS Code settings / env vars.
 */
async function createEvaluatorProvider(): Promise<LLMProvider | null> {
	const config = vscode.workspace.getConfiguration('janumicode');
	const providerName = config.get<string>('evaluator.provider', 'GEMINI');

	const providerEnum = LLMProviderEnum[providerName as keyof typeof LLMProviderEnum]
		?? LLMProviderEnum.GEMINI;

	const apiKey = await resolveEvaluatorApiKey(providerEnum);
	if (!apiKey) {
		return null;
	}

	const providerConfig: ProviderConfig = {
		apiKey,
		defaultModel: getEvaluatorModel(),
	};

	const result = createProvider(providerEnum, providerConfig);
	return result.success ? result.value : null;
}

/**
 * Resolve the API key for the evaluator provider.
 * Falls back through: provider env var → SecretStorage → null.
 */
async function resolveEvaluatorApiKey(provider: LLMProviderEnum): Promise<string | null> {
	// The SecretKeyManager handles env var → SecretStorage fallback.
	// Pass 'evaluator' as the role — it won't match a role-specific env var,
	// but will fall through to the provider-generic env var (e.g. GEMINI_API_KEY).
	try {
		const key = await getSecretKeyManager().getApiKey('evaluator', provider);
		if (key?.trim()) {
			return key.trim();
		}
	} catch {
		// SecretStorage may not be initialized
	}

	return null;
}

/**
 * Get the configured evaluator model name.
 */
function getEvaluatorModel(): string {
	const config = vscode.workspace.getConfiguration('janumicode');
	return config.get<string>('evaluator.model', 'gemini-3-flash-lite');
}

// ==================== RESPONSE PARSING ====================

/**
 * Parse the evaluator LLM response into a structured EvaluationResult.
 * Handles JSON extraction from potentially wrapped responses.
 */
function parseEvaluatorResponse(content: string): EvaluationResult {
	const fallback: EvaluationResult = {
		verdict: EvaluationVerdict.PROCEED,
		reasoning: 'Could not parse evaluator response — defaulting to PROCEED',
	};

	try {
		// Strip markdown code fences if present
		let jsonStr = content.trim();
		if (jsonStr.startsWith('```')) {
			jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
		}

		const parsed = JSON.parse(jsonStr);

		if (!parsed.verdict || !Object.values(EvaluationVerdict).includes(parsed.verdict)) {
			return fallback;
		}

		const result: EvaluationResult = {
			verdict: parsed.verdict as EvaluationVerdict,
			reasoning: parsed.reasoning ?? '',
		};

		if (parsed.verdict === EvaluationVerdict.ESCALATE_CONFUSED) {
			result.summary = parsed.summary ?? parsed.reasoning;
		}

		if (parsed.verdict === EvaluationVerdict.ESCALATE_QUESTIONS) {
			result.questions = Array.isArray(parsed.questions) ? parsed.questions : [];
		}

		if (parsed.verdict === EvaluationVerdict.ESCALATE_OPTIONS) {
			result.options = Array.isArray(parsed.options)
				? parsed.options.map((opt: Record<string, unknown>) => ({
						label: (opt.label as string) ?? 'Unnamed option',
						summary: (opt.summary as string) ?? '',
						proposal: (opt.proposal as string) ?? '',
				  }))
				: [];
		}

		// Decomposition quality verdicts use the same base structure (verdict + reasoning)
		// No additional fields needed — the reasoning contains the specifics.

		return result;
	} catch {
		return fallback;
	}
}

// ==================== BRANCH HELPERS ====================

/**
 * Create proposal branches from evaluation options.
 * Used when the evaluator returns ESCALATE_OPTIONS.
 */
export function createProposalBranches(options: ProposalOption[]): ProposalBranch[] {
	return options.map((opt, i) => ({
		branch_id: `branch-${i + 1}`,
		label: opt.label,
		proposal: opt.proposal,
		summary: opt.summary,
		status: 'pending' as const,
	}));
}
