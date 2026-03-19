/**
 * Document Generator
 *
 * LLM-backed generator that takes a dialogue's structured data + a document
 * type definition and produces a prose markdown document. Uses a dedicated
 * provider config (janumicode.documentGenerator.provider / .model).
 */

import * as vscode from 'vscode';
import { LLMProvider as LLMProviderEnum } from '../types/index.js';
import type { LLMProvider, ProviderConfig } from '../llm/provider.js';
import { MessageRole } from '../llm/provider.js';
import { createProvider } from '../llm/providerFactory.js';
import { getSecretKeyManager } from '../config/secretKeyManager.js';
import { getLogger, isLoggerInitialized } from '../logging/index.js';
import { assembleDocumentContext } from './contextAssembler.js';
import type { DocumentDefinition, DocumentGenerationResult } from './types.js';

// ==================== GENERATOR ====================

/**
 * Generate a prose document for the given dialogue using the LLM.
 *
 * @param dialogueId The dialogue to generate from
 * @param definition The document type definition (from registry)
 * @returns The generated markdown content, or throws on failure
 */
export async function generateDocument(
	dialogueId: string,
	definition: DocumentDefinition,
): Promise<DocumentGenerationResult> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'documentGenerator' })
		: undefined;

	// 1. Assemble context from dialogue data
	const context = assembleDocumentContext(dialogueId);
	if (!context.trim()) {
		throw new Error('No data available for this dialogue to generate a document.');
	}

	// 2. Create LLM provider
	const provider = await createDocumentProvider();
	if (!provider) {
		throw new Error(
			'Document generator LLM provider not available. ' +
			'Please configure janumicode.documentGenerator.provider and ensure the API key is set.'
		);
	}

	// 3. Build the user message with all context
	const userMessage = [
		'Below is the structured data gathered during a governed software development dialogue.',
		'Use ALL of this data to generate the document. Propose expansively for any gaps.',
		'',
		context,
	].join('\n');

	// 4. Call the LLM
	const model = getDocumentModel();
	logger?.info('Generating document', {
		dialogueId,
		documentType: definition.type,
		model,
		contextLength: context.length,
	});

	const startMs = Date.now();

	const result = await provider.complete({
		systemPrompt: definition.systemPrompt,
		messages: [{ role: MessageRole.USER, content: userMessage }],
		model,
		temperature: 0.4,
	});

	const elapsedMs = Date.now() - startMs;

	if (!result.success) {
		logger?.error('Document generation failed', {
			error: result.error.message,
			elapsedMs,
		});
		throw new Error(`LLM call failed: ${result.error.message}`);
	}

	logger?.info('Document generated', {
		documentType: definition.type,
		elapsedMs,
		inputTokens: result.value.usage.inputTokens,
		outputTokens: result.value.usage.outputTokens,
	});

	return {
		documentType: definition.type,
		title: definition.label,
		content: result.value.content,
	};
}

// ==================== PROVIDER CREATION ====================

/**
 * Create the LLM provider using the dedicated document generator config.
 */
async function createDocumentProvider(): Promise<LLMProvider | null> {
	const config = vscode.workspace.getConfiguration('janumicode');
	const providerName = config.get<string>('documentGenerator.provider', 'GEMINI');

	const providerEnum = LLMProviderEnum[providerName as keyof typeof LLMProviderEnum]
		?? LLMProviderEnum.GEMINI;

	const apiKey = await resolveDocumentApiKey(providerEnum);
	if (!apiKey) {
		return null;
	}

	const providerConfig: ProviderConfig = {
		apiKey,
		defaultModel: getDocumentModel(),
	};

	const result = createProvider(providerEnum, providerConfig);
	return result.success ? result.value : null;
}

async function resolveDocumentApiKey(provider: LLMProviderEnum): Promise<string | null> {
	try {
		const key = await getSecretKeyManager().getApiKey('documentGenerator', provider);
		if (key?.trim()) {
			return key.trim();
		}
	} catch {
		// SecretStorage may not be initialized
	}
	return null;
}

function getDocumentModel(): string {
	const config = vscode.workspace.getConfiguration('janumicode');
	return config.get<string>('documentGenerator.model', 'gemini-2.5-flash');
}
