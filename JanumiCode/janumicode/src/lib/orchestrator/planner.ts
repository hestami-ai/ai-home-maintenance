/**
 * LLM Plan Generator (Tier 2.5)
 *
 * Takes user text + workflow context + primitive catalog and asks an LLM
 * to compose a plan — an ordered sequence of primitive calls that achieves
 * the user's intent. Returns null if no plan can be composed.
 */

import type { Plan } from './types';
import { getPrimitiveRegistry } from '../primitives/registry';
import { buildWorkflowContextSummary } from '../ui/governedStream/textCommands';
import { getLogger, isLoggerInitialized } from '../logging';

const PLANNER_SYSTEM_PROMPT = `You are a workflow action planner for a software development orchestration system.

Given the user's message and the current workflow state, compose a PLAN — an ordered sequence of primitive operations that achieves the user's intent.

# Available Primitives

{CATALOG}

# Plan Format

Return a JSON object:
{
  "intent": "Brief description of what the user wants",
  "steps": [
    {
      "id": "s1",
      "primitiveId": "state.getWorkflowState",
      "params": { "dialogueId": "$context.dialogueId" },
      "reason": "Check current phase"
    },
    {
      "id": "s2",
      "primitiveId": "mutation.updateMetadata",
      "params": {
        "dialogueId": "$context.dialogueId",
        "updates": { "lastFailedPhase": null, "lastError": null }
      },
      "reason": "Clear failure flags before resuming",
      "condition": "$s1.value.metadata.lastFailedPhase != null"
    }
  ],
  "expectedOutcome": "Workflow will resume from where it stopped"
}

# Bind Expressions

Reference previous step outputs using "$sN.value.fieldName" (e.g., "$s1.value.0.gate_id" for first element of an array).
Reference execution context using "$context.dialogueId".
Conditions are simple checks like "$s1.value.length > 0" or "$s1.value.metadata.lastFailedPhase != null".

# Rules

1. ALWAYS read state before mutating it
2. NEVER compose plans that skip safety checks
3. Keep plans SHORT — 2-5 steps is typical, max 8
4. If you cannot compose a safe plan, return {"intent":"...","steps":[],"expectedOutcome":"Cannot safely perform this: <reason>"}
5. For dialogueId params, always use "$context.dialogueId"
6. Only use primitives listed above — do not invent new ones

Respond ONLY with valid JSON. No markdown fences, no explanation.`;

/**
 * Generate a plan from user text using an LLM.
 *
 * @returns Plan if the LLM composed one, null if it couldn't or if
 *          the LLM provider isn't configured.
 */
export async function generatePlan(
	userText: string,
	dialogueId: string,
	onProgress?: (msg: string) => void,
): Promise<Plan | null> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'orchestrator:planner' })
		: null;

	try {
		// Dynamic imports to avoid pulling in VS Code API at module load time
		const vscode = await import('vscode');
		const config = vscode.workspace.getConfiguration('janumicode');

		const providerName = config.get<string>(
			'curator.provider',
			config.get<string>('evaluator.provider', 'GEMINI')
		);

		const { LLMProvider: LLMProviderEnum } = await import('../types/index.js');
		const providerEnum =
			LLMProviderEnum[providerName as keyof typeof LLMProviderEnum] ??
			LLMProviderEnum.GEMINI;

		const { getSecretKeyManager } = await import('../config/secretKeyManager.js');
		const apiKey = await getSecretKeyManager().getApiKey('curator', providerEnum);
		if (!apiKey?.trim()) {
			log?.debug('Orchestrator: no API key for curator role');
			return null;
		}

		const model = config.get<string>(
			'curator.model',
			config.get<string>('evaluator.model', 'gemini-3-flash-lite')
		);

		const { createProvider } = await import('../llm/providerFactory.js');
		const { MessageRole } = await import('../llm/provider.js');

		const providerResult = createProvider(providerEnum, {
			apiKey: apiKey.trim(),
			defaultModel: model,
		});
		if (!providerResult.success) {
			log?.warn('Orchestrator: provider creation failed');
			return null;
		}

		// Build the catalog from the live registry
		const registry = getPrimitiveRegistry();
		const catalog = registry.generateCatalog({ includeRestricted: false });

		// Build the system prompt with catalog injected
		const systemPrompt = PLANNER_SYSTEM_PROMPT.replace('{CATALOG}', catalog);

		// Build user message with workflow context
		const contextSummary = buildWorkflowContextSummary(dialogueId);
		const userMessage = `Current workflow state:\n${contextSummary}\n\nUser request: "${userText}"`;

		log?.debug('Orchestrator: generating plan', {
			model,
			provider: providerName,
			catalogSize: catalog.length,
		});
		onProgress?.('Composing action plan...');

		const result = await providerResult.value.complete({
			systemPrompt,
			messages: [{ role: MessageRole.USER, content: userMessage }],
			model,
			temperature: 0,
		});

		if (!result.success) {
			log?.warn('Orchestrator: LLM call failed', { error: String(result.error) });
			return null;
		}

		const raw = result.value.content.trim();
		log?.debug('Orchestrator: LLM response', { raw: raw.substring(0, 300) });

		// Parse the plan
		const plan = parsePlanResponse(raw);
		if (!plan) {
			log?.debug('Orchestrator: failed to parse plan from LLM response');
			return null;
		}

		// Empty steps = LLM couldn't compose a plan
		if (plan.steps.length === 0) {
			log?.debug('Orchestrator: LLM returned empty plan', { intent: plan.intent });
			return null;
		}

		return plan;
	} catch (err) {
		log?.error('Orchestrator: unexpected error', { error: String(err) });
		return null;
	}
}

/**
 * Parse a Plan from raw LLM output.
 * Handles raw JSON, markdown-fenced JSON, and JSON embedded in prose.
 */
function parsePlanResponse(raw: string): Plan | null {
	let jsonStr = raw.trim();

	// Remove markdown fences if present
	const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenceMatch) {
		jsonStr = fenceMatch[1].trim();
	} else {
		// Try to extract JSON object
		const objMatch = jsonStr.match(/\{[\s\S]*\}/);
		if (objMatch) {
			jsonStr = objMatch[0];
		}
	}

	try {
		const parsed = JSON.parse(jsonStr);

		// Validate structure
		if (typeof parsed.intent !== 'string') {return null;}
		if (!Array.isArray(parsed.steps)) {return null;}
		if (typeof parsed.expectedOutcome !== 'string') {return null;}

		// Validate each step
		for (const step of parsed.steps) {
			if (typeof step.id !== 'string') {return null;}
			if (typeof step.primitiveId !== 'string') {return null;}
			if (typeof step.reason !== 'string') {return null;}
			if (!step.params || typeof step.params !== 'object') {
				step.params = {};
			}
		}

		return parsed as Plan;
	} catch {
		return null;
	}
}
