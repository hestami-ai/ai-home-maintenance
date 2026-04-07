/**
 * Configuration Manager
 * Implements Phase 1.5: Configuration System
 * Manages VS Code settings and provides typed configuration access.
 * API keys are resolved via SecretKeyManager (env vars → SecretStorage).
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import * as os from 'node:os';
import type { JanumiCodeConfig, LLMModelConfig, RoleLLMConfig, Result } from '../types';
import { LLMProvider } from '../types';
import { getSecretKeyManager } from './secretKeyManager';

/**
 * Configuration keys
 */
const CONFIG_SECTION = 'janumicode';

/**
 * Get workspace-specific configuration
 * @returns VS Code configuration object
 */
function getWorkspaceConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

/**
 * Get token budget configuration
 * @returns Token budget (default: 10,000)
 */
export function getTokenBudget(): number {
	const config = getWorkspaceConfig();
	return config.get<number>('tokenBudget', 10000);
}

/**
 * Get database path configuration
 * @returns Database path (defaults to workspace-specific location)
 */
export function getDatabasePath(): string {
	const config = getWorkspaceConfig();
	const customPath = config.get<string>('databasePath', '');

	if (customPath) {
		return customPath;
	}

	// Default: Use workspace folder or global storage
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders && workspaceFolders.length > 0) {
		// Workspace-specific database
		return path.join(workspaceFolders[0].uri.fsPath, '.janumicode', 'database.db');
	}

	// Global database in user home directory
	return path.join(os.homedir(), '.janumicode', 'database.db');
}

/**
 * Get the configured LLM provider enum for a role (sync — reads from VS Code settings only).
 */
export function getProviderForRole(role: string): LLMProvider {
	const config = getWorkspaceConfig();
	return config.get<LLMProvider>(`llm.${role}.provider`, LLMProvider.CLAUDE);
}

// ==================== CLI PROVIDER CONFIGURATION ====================

/**
 * Default CLI provider assignments per role.
 * These map each role to its preferred CLI tool ID.
 */
const DEFAULT_CLI_PROVIDERS: Record<string, string> = {
	executor: 'claude-code',
	technicalExpert: 'codex-cli',
	verifier: 'gemini-cli',
	historianInterpreter: 'gemini-cli',
};

/**
 * Get the configured CLI provider ID for a role.
 * Reads from VS Code settings, falls back to default assignment.
 *
 * @param role Role name (e.g., 'executor', 'verifier')
 * @returns CLI provider ID (e.g., 'claude-code', 'gemini-cli', 'codex-cli')
 */
export function getCLIProviderIdForRole(role: string): string {
	const config = getWorkspaceConfig();
	return config.get<string>(`cli.roles.${role}`, DEFAULT_CLI_PROVIDERS[role] || 'claude-code');
}

/**
 * CLI provider-specific settings
 */
export interface CLIProviderSettings {
	path?: string;
	defaultModel?: string;
	timeout?: number;
}

/**
 * Get CLI provider settings for a specific provider.
 *
 * @param providerId Provider ID (e.g., 'claudeCode', 'geminiCli', 'codexCli')
 * @returns Provider-specific settings
 */
export function getCLIProviderSettings(providerId: string): CLIProviderSettings {
	const config = getWorkspaceConfig();
	return {
		path: config.get<string>(`cli.providers.${providerId}.path`, ''),
		defaultModel: config.get<string>(`cli.providers.${providerId}.defaultModel`, ''),
		timeout: config.get<number>(`cli.providers.${providerId}.timeout`, 300000),
	};
}

// ==================== PROVIDER CAPABILITY OVERRIDES ====================

/**
 * Get user-supplied capability overrides for a CLI provider from VS Code settings.
 * Returns null for any field that the user hasn't set (keeping the hardcoded default).
 */
export function getProviderCapabilityOverrides(providerId: string): {
	capabilities?: string[];
	costTier?: string;
	strengths?: string[];
} | null {
	const config = getWorkspaceConfig();
	const capabilities = config.get<string[] | null>(`providers.${providerId}.capabilities`, null);
	const costTier = config.get<string | null>(`providers.${providerId}.costTier`, null);
	const strengths = config.get<string[] | null>(`providers.${providerId}.strengths`, null);

	// If nothing is overridden, return null so the caller uses pure defaults
	if (!capabilities && !costTier && !strengths) {
		return null;
	}

	const overrides: Record<string, unknown> = {};
	if (capabilities) { overrides.capabilities = capabilities; }
	if (costTier) { overrides.costTier = costTier; }
	if (strengths) { overrides.strengths = strengths; }
	return overrides as { capabilities?: string[]; costTier?: string; strengths?: string[] };
}

// ==================== MOBILE SPECIALIST MCP CONFIGURATION ====================

/**
 * Whether the Deep Validation Review hypothesizer agents run in parallel.
 * Default is false (sequential) to avoid saturating the CLI provider with concurrent calls.
 */
export function isValidationParallelAgentsEnabled(): boolean {
	return getWorkspaceConfig().get<boolean>('validation.parallelAgents', false);
}

/**
 * Whether the mobile-specialist MCP server is enabled for Executor invocations.
 */
export function isMobileSpecialistEnabled(): boolean {
	return getWorkspaceConfig().get<boolean>('mcp.mobileSpecialist.enabled', false);
}

/**
 * Get mobile-specialist MCP server configuration.
 */
export function getMobileSpecialistConfig(): {
	serverPath: string;
	baseUrl: string;
	apiKey: string;
	model: string;
} {
	const config = getWorkspaceConfig();
	return {
		serverPath: config.get<string>('mcp.mobileSpecialist.serverPath', ''),
		baseUrl: config.get<string>('mcp.mobileSpecialist.baseUrl', ''),
		apiKey: config.get<string>('mcp.mobileSpecialist.apiKey', ''),
		model: config.get<string>('mcp.mobileSpecialist.model', 'glm-4.6'),
	};
}

/**
 * Get CLI configuration for all roles.
 * Returns mapping of role → CLI provider ID.
 */
export function getCLIRoleAssignments(): Record<string, string> {
	return {
		executor: getCLIProviderIdForRole('executor'),
		technicalExpert: getCLIProviderIdForRole('technicalExpert'),
		verifier: getCLIProviderIdForRole('verifier'),
		historianInterpreter: getCLIProviderIdForRole('historianInterpreter'),
	};
}

/**
 * Get LLM configuration for a specific role.
 * API key is resolved async via SecretKeyManager (env → SecretStorage).
 */
async function getLLMConfigForRole(role: string): Promise<LLMModelConfig> {
	const config = getWorkspaceConfig();

	const provider = config.get<LLMProvider>(`llm.${role}.provider`, LLMProvider.CLAUDE);
	const model = config.get<string>(`llm.${role}.model`, 'claude-sonnet-4-5-20250929');
	const rawKey = await getSecretKeyManager().getApiKey(role, provider);
	const apiKey = rawKey.trim();

	return {
		provider,
		model,
		apiKey,
	};
}

/**
 * Get LLM configuration for all roles
 * @returns Role-specific LLM configuration
 */
export async function getLLMConfig(): Promise<RoleLLMConfig> {
	return {
		executor: await getLLMConfigForRole('executor'),
		technicalExpert: await getLLMConfigForRole('technicalExpert'),
		verifier: await getLLMConfigForRole('verifier'),
		historianInterpreter: await getLLMConfigForRole('historianInterpreter'),
	};
}

/**
 * Get complete JanumiCode configuration
 * @returns Complete extension configuration
 */
export async function getConfig(): Promise<JanumiCodeConfig> {
	return {
		tokenBudget: getTokenBudget(),
		databasePath: getDatabasePath(),
		llmConfig: await getLLMConfig(),
	};
}

/**
 * Validate configuration
 * @returns Result indicating if configuration is valid
 */
export async function validateConfig(): Promise<Result<boolean>> {
	const config = await getConfig();
	const errors: string[] = [];

	// Check token budget
	if (config.tokenBudget < 1000 || config.tokenBudget > 100000) {
		errors.push('Token budget must be between 1,000 and 100,000');
	}

	// Check database path
	if (!config.databasePath) {
		errors.push('Database path not configured');
	}

	// Check LLM configurations
	const roles: (keyof RoleLLMConfig)[] = [
		'executor',
		'technicalExpert',
		'verifier',
		'historianInterpreter',
	];

	for (const role of roles) {
		const llmConfig = config.llmConfig[role];

		if (!llmConfig.apiKey) {
			errors.push(`API key not configured for ${role}`);
		}

		if (!llmConfig.model) {
			errors.push(`Model not configured for ${role}`);
		}

		if (!Object.values(LLMProvider).includes(llmConfig.provider)) {
			errors.push(`Invalid provider for ${role}: ${llmConfig.provider}`);
		}
	}

	if (errors.length > 0) {
		return {
			success: false,
			error: new Error(`Configuration validation failed:\n${errors.join('\n')}`),
		};
	}

	return { success: true, value: true };
}

/**
 * Update token budget
 * @param tokenBudget New token budget
 * @param global Whether to update global or workspace setting
 */
export async function setTokenBudget(
	tokenBudget: number,
	global = false
): Promise<Result<void>> {
	try {
		const config = getWorkspaceConfig();
		await config.update('tokenBudget', tokenBudget, global);
		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to update token budget'),
		};
	}
}

/**
 * Update database path
 * @param databasePath New database path
 * @param global Whether to update global or workspace setting
 */
export async function setDatabasePath(
	databasePath: string,
	global = false
): Promise<Result<void>> {
	try {
		const config = getWorkspaceConfig();
		await config.update('databasePath', databasePath, global);
		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to update database path'),
		};
	}
}

/**
 * Update LLM configuration for a role.
 * Provider and model go to VS Code settings; API key goes to SecretStorage.
 */
export async function setLLMConfigForRole(
	role: 'executor' | 'technicalExpert' | 'verifier' | 'historianInterpreter',
	llmConfig: LLMModelConfig,
	global = false
): Promise<Result<void>> {
	try {
		const config = getWorkspaceConfig();

		await config.update(`llm.${role}.provider`, llmConfig.provider, global);
		await config.update(`llm.${role}.model`, llmConfig.model, global);

		// Store API key in SecretStorage instead of plain-text settings
		if (llmConfig.apiKey) {
			await getSecretKeyManager().setApiKey(role, llmConfig.apiKey);
		}

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to update LLM configuration'),
		};
	}
}

/**
 * Watch for configuration changes
 * @param callback Callback function to invoke on configuration change
 * @returns Disposable to stop watching
 */
export function watchConfig(
	callback: (config: JanumiCodeConfig) => void
): vscode.Disposable {
	return vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration(CONFIG_SECTION)) {
			getConfig().then(callback);
		}
	});
}

/**
 * Check if API keys are configured for all roles
 * @returns True if all API keys are configured
 */
export async function areAPIKeysConfigured(): Promise<boolean> {
	const manager = getSecretKeyManager();
	const missing = await manager.getMissingRoles(getProviderForRole);
	return missing.length === 0;
}

/**
 * Get missing API key roles
 * @returns Array of display names for roles missing API keys
 */
export async function getMissingAPIKeyRoles(): Promise<string[]> {
	const manager = getSecretKeyManager();
	const missing = await manager.getMissingRoles(getProviderForRole);

	const displayNames: Record<string, string> = {
		executor: 'Executor',
		technicalExpert: 'Technical Expert',
		verifier: 'Verifier',
		historianInterpreter: 'Historian-Interpreter',
	};

	return missing.map((role) => displayNames[role] || role);
}
