/**
 * Fake CLI Providers for testing.
 * Creates RoleCLIProvider implementations that return canned responses.
 */

import type { Result } from '../../lib/types';
import type { RoleCLIProvider } from '../../lib/cli/roleCLIProvider';
import {
	registerRoleCLIProvider,
	clearRoleCLIRegistry,
} from '../../lib/cli/roleCLIProvider';
import type {
	CLIProviderInfo,
	RoleCLIInvocationOptions,
	RoleCLIResult,
	CLIActivityEvent,
} from '../../lib/cli/types';

/**
 * Canned response for a fake provider invocation.
 */
export interface FakeResponse {
	response: string;
	exitCode?: number;
	executionTime?: number;
	filesModified?: string[];
}

/**
 * Configuration for a single fake provider.
 */
export interface FakeProviderConfig {
	id: string;
	name: string;
	responses: FakeResponse[];
}

/**
 * Create a fake RoleCLIProvider that returns canned responses in order.
 */
export function createFakeProvider(config: FakeProviderConfig): RoleCLIProvider {
	let responseIndex = 0;

	function getNextResponse(): RoleCLIResult {
		const resp = config.responses[responseIndex] ?? {
			response: `[No more canned responses for ${config.id}]`,
			exitCode: 1,
		};
		if (responseIndex < config.responses.length) {
			responseIndex++;
		}
		return {
			response: resp.response,
			exitCode: resp.exitCode ?? 0,
			executionTime: resp.executionTime ?? 100,
			rawOutput: resp.response,
			filesModified: resp.filesModified,
		};
	}

	return {
		id: config.id,
		name: config.name,

		async detect(): Promise<Result<CLIProviderInfo>> {
			return {
				success: true,
				value: {
					id: config.id,
					name: config.name,
					available: true,
					version: '1.0.0-fake',
					requiresApiKey: false,
					apiKeyConfigured: true,
				},
			};
		},

		async invoke(_options: RoleCLIInvocationOptions): Promise<Result<RoleCLIResult>> {
			return { success: true, value: getNextResponse() };
		},

		async invokeStreaming(
			_options: RoleCLIInvocationOptions,
			onEvent: (event: CLIActivityEvent) => void
		): Promise<Result<RoleCLIResult>> {
			const result = getNextResponse();

			// Emit init → message → complete events
			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'init',
				summary: `${config.name} started`,
			});
			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'message',
				summary: result.response.slice(0, 100),
				detail: result.response,
			});
			onEvent({
				timestamp: new Date().toISOString(),
				eventType: 'complete',
				summary: `${config.name} completed`,
				status: result.exitCode === 0 ? 'success' : 'error',
			});

			return { success: true, value: result };
		},

		getCommandPreview(_options: RoleCLIInvocationOptions): Result<string> {
			return { success: true, value: `${config.id} --fake` };
		},
	};
}

/**
 * Register fake providers for all roles, clearing the registry first.
 * Uses the default provider IDs that the config manager resolves to:
 * - executor → 'claude-code'
 * - technicalExpert → 'codex-cli'
 * - verifier → 'gemini-cli'
 * - historianInterpreter → 'gemini-cli' (shared with verifier)
 */
export function registerFakeProviders(options?: {
	executorResponses?: FakeResponse[];
	expertResponses?: FakeResponse[];
	verifierResponses?: FakeResponse[];
}): void {
	clearRoleCLIRegistry();

	const executorProvider = createFakeProvider({
		id: 'claude-code',
		name: 'Claude Code (Fake)',
		responses: options?.executorResponses ?? [
			{ response: '{"proposal": "Default fake proposal"}' },
		],
	});

	const expertProvider = createFakeProvider({
		id: 'codex-cli',
		name: 'Codex CLI (Fake)',
		responses: options?.expertResponses ?? [
			{ response: '{"analysis": "Default fake expert analysis"}' },
		],
	});

	const verifierProvider = createFakeProvider({
		id: 'gemini-cli',
		name: 'Gemini CLI (Fake)',
		responses: options?.verifierResponses ?? [
			{ response: '{"verdict": "VERIFIED", "confidence": 0.9}' },
		],
	});

	registerRoleCLIProvider(executorProvider);
	registerRoleCLIProvider(expertProvider);
	registerRoleCLIProvider(verifierProvider);
}

/**
 * Clean up fake providers.
 */
export function teardownFakeProviders(): void {
	clearRoleCLIRegistry();
}
