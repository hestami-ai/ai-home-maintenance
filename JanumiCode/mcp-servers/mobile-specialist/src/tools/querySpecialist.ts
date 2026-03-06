/**
 * Core MCP tool: query_mobile_specialist
 * Routes prompts to a mobile-specialist LLM (e.g., Z.ai GLM) via OpenAI-compatible API.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MobileSpecialistConfig } from '../config.js';

const MOBILE_SYSTEM_PROMPT = `You are a mobile development specialist with deep expertise in:
- iOS development: Swift, SwiftUI, UIKit, ARKit, RealityKit, Core ML, Core Data, Combine
- Android development: Kotlin, Jetpack Compose, Android SDK, CameraX, ML Kit, Room
- Cross-platform: React Native, Flutter, Kotlin Multiplatform
- Mobile architecture: MVVM, MVI, Clean Architecture, dependency injection
- Platform constraints: App Store guidelines, Play Store policies, privacy APIs, background execution limits

Provide precise, production-quality code and architectural guidance. When generating code:
- Use the latest stable APIs and conventions
- Include proper error handling and lifecycle management
- Follow platform-specific design patterns and Human Interface / Material Design guidelines
- Note any minimum OS version requirements for APIs used`;

/**
 * Send a chat completion request to the specialist LLM.
 */
async function querySpecialistLLM(
	config: MobileSpecialistConfig,
	userPrompt: string,
	platform?: string,
	context?: string,
): Promise<string> {
	const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

	const messages: Array<{ role: string; content: string }> = [
		{ role: 'system', content: MOBILE_SYSTEM_PROMPT },
	];

	let fullPrompt = userPrompt;
	if (platform) {
		fullPrompt = `[Platform: ${platform}]\n\n${fullPrompt}`;
	}
	if (context) {
		fullPrompt = `${fullPrompt}\n\n--- Context ---\n${context}`;
	}

	messages.push({ role: 'user', content: fullPrompt });

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify({
			model: config.model,
			messages,
			temperature: 0.2,
			max_tokens: 8192,
		}),
		signal: AbortSignal.timeout(config.timeout),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => 'unknown error');
		throw new Error(
			`Specialist LLM request failed (${response.status}): ${errorText}`
		);
	}

	const data = await response.json() as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	const content = data.choices?.[0]?.message?.content;

	if (!content) {
		throw new Error('Specialist LLM returned empty response');
	}

	return content;
}

/**
 * Register the query_mobile_specialist tool with the MCP server.
 */
export function registerQuerySpecialistTool(
	server: McpServer,
	config: MobileSpecialistConfig,
): void {
	server.tool(
		'query_mobile_specialist',
		'Query a mobile development specialist LLM for iOS/Android code generation, debugging, or architecture guidance. Use when you need platform-specific expertise beyond your training.',
		{
			prompt: z.string().describe(
				'The specific mobile development question or code generation request'
			),
			platform: z.enum(['ios', 'android', 'cross-platform']).optional().describe(
				'Target platform'
			),
			context: z.string().optional().describe(
				'Relevant code context, error messages, or project structure'
			),
		},
		async ({ prompt, platform, context }) => {
			try {
				const result = await querySpecialistLLM(config, prompt, platform, context);
				return {
					content: [{ type: 'text' as const, text: result }],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				return {
					content: [{ type: 'text' as const, text: `Error querying specialist: ${message}` }],
					isError: true,
				};
			}
		},
	);
}
