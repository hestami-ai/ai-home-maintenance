/**
 * Execution CLI Provider Abstraction
 * Defines a common interface for CLI-based execution engines (Claude Code, Codex, etc.)
 * Allows JanumiCode to support multiple CLI backends for cost competitiveness.
 */

import type { Result } from '../types';

/**
 * Common execution options accepted by all CLI providers
 */
export interface ExecutionCLIOptions {
	/** The task/proposal to execute */
	proposal: string;
	/** Additional context (verified claims, constraints, specs) */
	context?: string;
	/** Working directory for execution */
	workingDirectory?: string;
	/** Timeout in milliseconds */
	timeout?: number;
}

/**
 * Common execution result returned by all CLI providers
 */
export interface ExecutionCLIResult {
	/** Whether the execution completed successfully */
	success: boolean;
	/** Standard output */
	stdout: string;
	/** Standard error */
	stderr: string;
	/** Process exit code */
	exitCode: number;
	/** Execution time in milliseconds */
	executionTime: number;
	/** Files modified during execution (if available) */
	filesModified?: string[];
}

/**
 * CLI provider metadata
 */
export interface ExecutionCLIInfo {
	/** Provider identifier */
	id: string;
	/** Human-readable name */
	name: string;
	/** Whether the CLI is installed and available */
	available: boolean;
	/** Version string (if detected) */
	version?: string;
	/** Whether the provider requires an API key */
	requiresApiKey: boolean;
	/** Whether the API key is configured */
	apiKeyConfigured: boolean;
}

/**
 * Execution CLI Provider interface
 * All CLI execution backends must implement this interface.
 */
export interface ExecutionCLIProvider {
	/** Unique provider identifier */
	readonly id: string;

	/** Human-readable provider name */
	readonly name: string;

	/**
	 * Detect whether this CLI is installed and ready to use
	 */
	detect(): Promise<Result<ExecutionCLIInfo>>;

	/**
	 * Execute a proposal using this CLI
	 */
	execute(options: ExecutionCLIOptions): Promise<Result<ExecutionCLIResult>>;

	/**
	 * Execute with streaming output
	 */
	executeStreaming(
		options: ExecutionCLIOptions,
		onOutput: (chunk: string) => void
	): Promise<Result<ExecutionCLIResult>>;

	/**
	 * Get the command that would be executed (for display/logging)
	 */
	getCommandPreview(options: ExecutionCLIOptions): Promise<Result<string>>;
}

/**
 * Registry of available CLI providers
 */
const providerRegistry = new Map<string, ExecutionCLIProvider>();

/**
 * Register a CLI provider
 */
export function registerCLIProvider(provider: ExecutionCLIProvider): void {
	providerRegistry.set(provider.id, provider);
}

/**
 * Get a registered CLI provider by ID
 */
export function getCLIProvider(id: string): ExecutionCLIProvider | undefined {
	return providerRegistry.get(id);
}

/**
 * Get all registered CLI providers
 */
export function getAllCLIProviders(): ExecutionCLIProvider[] {
	return Array.from(providerRegistry.values());
}

/**
 * Detect all available CLI providers
 * Returns info about each registered provider's availability
 */
export async function detectAvailableCLIProviders(): Promise<ExecutionCLIInfo[]> {
	const results: ExecutionCLIInfo[] = [];

	for (const provider of providerRegistry.values()) {
		const detection = await provider.detect();
		if (detection.success) {
			results.push(detection.value);
		}
	}

	return results;
}

/**
 * Get the preferred CLI provider
 * Returns the first available provider, or a specific one by ID
 */
export async function getPreferredCLIProvider(
	preferredId?: string
): Promise<ExecutionCLIProvider | undefined> {
	// If a specific provider is requested, try that first
	if (preferredId) {
		const provider = providerRegistry.get(preferredId);
		if (provider) {
			const detection = await provider.detect();
			if (detection.success && detection.value.available) {
				return provider;
			}
		}
	}

	// Fall back to first available provider
	for (const provider of providerRegistry.values()) {
		const detection = await provider.detect();
		if (detection.success && detection.value.available) {
			return provider;
		}
	}

	return undefined;
}
