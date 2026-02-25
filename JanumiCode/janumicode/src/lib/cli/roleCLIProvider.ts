/**
 * RoleCLIProvider Interface & Registry
 * Primary abstraction for CLI-based role execution.
 * All CLI tool backends (Claude Code, Gemini, Codex) implement this interface.
 * The orchestrator dispatches to roles through this interface.
 *
 * See: docs/Multi-CLI Integration Spec.md — Section 3
 */

import type { Result, Role } from '../types';
import { CodedError } from '../types';
import type {
	CLIProviderInfo,
	RoleCLIInvocationOptions,
	RoleCLIResult,
	CLIActivityEvent,
} from './types';

/**
 * RoleCLIProvider — Primary interface for CLI-based role execution.
 * All CLI tool backends (Claude Code, Gemini, Codex) implement this interface.
 * The LLMProviderAdapter also implements it for API-based fallback.
 */
export interface RoleCLIProvider {
	/** Unique provider identifier (e.g., 'claude-code', 'gemini-cli', 'codex-cli') */
	readonly id: string;

	/** Human-readable provider name */
	readonly name: string;

	/**
	 * Detect whether this CLI tool is installed and ready to use.
	 * Returns availability, version, and API key status.
	 */
	detect(): Promise<Result<CLIProviderInfo>>;

	/**
	 * Invoke the CLI tool for a role task.
	 * Spawns the CLI process, pipes prompt via stdin, collects JSON output.
	 * Returns the parsed response.
	 */
	invoke(options: RoleCLIInvocationOptions): Promise<Result<RoleCLIResult>>;

	/**
	 * Invoke with streaming output.
	 * Spawns the CLI process and emits normalized events as they arrive.
	 * Returns the final result after the process completes.
	 */
	invokeStreaming(
		options: RoleCLIInvocationOptions,
		onEvent: (event: CLIActivityEvent) => void
	): Promise<Result<RoleCLIResult>>;

	/**
	 * Get the command that would be executed (for display/logging).
	 * Does NOT include the stdin content — only the CLI flags.
	 */
	getCommandPreview(options: RoleCLIInvocationOptions): Result<string>;
}

/**
 * Registry of available RoleCLIProviders
 */
const roleCLIRegistry = new Map<string, RoleCLIProvider>();

/**
 * Register a RoleCLIProvider
 */
export function registerRoleCLIProvider(provider: RoleCLIProvider): void {
	roleCLIRegistry.set(provider.id, provider);
}

/**
 * Get a registered RoleCLIProvider by ID
 */
export function getRoleCLIProvider(id: string): RoleCLIProvider | undefined {
	return roleCLIRegistry.get(id);
}

/**
 * Get all registered RoleCLIProviders
 */
export function getAllRoleCLIProviders(): RoleCLIProvider[] {
	return Array.from(roleCLIRegistry.values());
}

/**
 * Detect all available CLI providers.
 * Returns info about each registered provider's availability.
 */
export async function detectAllCLIProviders(): Promise<CLIProviderInfo[]> {
	const results: CLIProviderInfo[] = [];

	for (const provider of roleCLIRegistry.values()) {
		const detection = await provider.detect();
		if (detection.success) {
			results.push(detection.value);
		}
	}

	return results;
}

/**
 * Clear registry (for testing)
 */
export function clearRoleCLIRegistry(): void {
	roleCLIRegistry.clear();
}
