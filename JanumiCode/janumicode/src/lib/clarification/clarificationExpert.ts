/**
 * Clarification Expert
 * Lightweight LLM call for inline "Ask More" threads.
 * Uses the Narrative Curator's direct-API pattern —
 * fast, non-blocking. Timing info is returned to the caller
 * for inline display rather than emitting standalone command blocks.
 */

import type { Result } from '../types';
import { LLMProvider as LLMProviderEnum } from '../types';
import type { LLMProvider, ProviderConfig } from '../llm/provider';
import { MessageRole } from '../llm/provider';
import { createProvider } from '../llm/providerFactory';
import { getSecretKeyManager } from '../config/secretKeyManager';
import * as vscode from 'vscode';

// ==================== SYSTEM PROMPT ====================

const CLARIFICATION_SYSTEM_PROMPT = `You are a concise technical advisor helping a human understand a specific item in a software development workflow.

The human is looking at a question, claim, or finding and wants clarification. Answer their question directly and concisely. Stay focused on the specific item — do not expand scope or offer unsolicited advice.

If the item is a question from a Technical Expert: help the human understand WHY this question matters and what kind of answer would be most useful.
If the item is a verification claim: explain the significance of the verdict, what evidence supports it, and what the practical implications are.
If the item is a historian finding: explain the pattern or precedent being highlighted and why it's relevant.

Keep responses under 200 words unless the human explicitly asks for more detail.`;

// ==================== MAIN FUNCTION ====================

export interface ClarificationResult {
	content: string;
	elapsedMs: number;
	model: string;
}

/**
 * Ask a clarification question about a specific workflow item.
 *
 * @param itemContext  The original question / claim / finding text
 * @param history     Conversation turns so far (user ↔ assistant)
 * @returns The assistant's response text with timing metadata
 */
export async function askClarification(
	itemContext: string,
	history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<Result<ClarificationResult>> {
	const provider = await createClarificationProvider();
	if (!provider) {
		return {
			success: false,
			error: new Error('Clarification provider unavailable — no API key configured'),
		};
	}

	const model = getClarificationModel();
	const startMs = Date.now();

	// Build messages: first message is the item context, then conversation history
	const messages = [
		{ role: MessageRole.USER, content: `I have a question about the following item:\n\n"${itemContext}"` },
		{ role: MessageRole.ASSISTANT, content: 'Sure — what would you like to know about this item?' },
		...history.map((turn) => ({
			role: turn.role === 'user' ? MessageRole.USER : MessageRole.ASSISTANT,
			content: turn.content,
		})),
	];

	const result = await provider.complete({
		systemPrompt: CLARIFICATION_SYSTEM_PROMPT,
		messages,
		model,
		temperature: 0.3,
	});

	const elapsedMs = Date.now() - startMs;

	if (!result.success) {
		return { success: false, error: result.error };
	}

	return { success: true, value: { content: result.value.content, elapsedMs, model } };
}

// ==================== PROVIDER CREATION ====================

async function createClarificationProvider(): Promise<LLMProvider | null> {
	const config = vscode.workspace.getConfiguration('janumicode');

	// Reuse curator/evaluator provider config
	const providerName = config.get<string>(
		'curator.provider',
		config.get<string>('evaluator.provider', 'GEMINI')
	);

	const providerEnum =
		LLMProviderEnum[providerName as keyof typeof LLMProviderEnum] ??
		LLMProviderEnum.GEMINI;

	const apiKey = await resolveClarificationApiKey(providerEnum);
	if (!apiKey) {
		return null;
	}

	const providerConfig: ProviderConfig = {
		apiKey,
		defaultModel: getClarificationModel(),
	};

	const result = createProvider(providerEnum, providerConfig);
	return result.success ? result.value : null;
}

async function resolveClarificationApiKey(
	provider: LLMProviderEnum
): Promise<string | null> {
	try {
		// Reuse curator key slot (same lightweight utility tier)
		const key = await getSecretKeyManager().getApiKey('curator', provider);
		if (key?.trim()) {
			return key.trim();
		}
	} catch {
		// SecretStorage may not be initialized
	}
	return null;
}

function getClarificationModel(): string {
	const config = vscode.workspace.getConfiguration('janumicode');
	return config.get<string>(
		'curator.model',
		config.get<string>('evaluator.model', 'gemini-3-flash-lite')
	);
}
