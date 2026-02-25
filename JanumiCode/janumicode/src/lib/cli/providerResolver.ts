/**
 * CLI Provider Resolver
 * Resolves the configured RoleCLIProvider for a given role.
 * Reads from VS Code settings, falls back to LLMProviderAdapter.
 *
 * See: docs/Multi-CLI Integration Spec.md — Section 3 (Provider Registry)
 */

import type { Result } from '../types';
import { CodedError, Role } from '../types';
import { getCLIProviderIdForRole } from '../config/manager';
import { createProviderForRole } from '../llm/providerFactory';
import type { RoleCLIProvider } from './roleCLIProvider';
import { getRoleCLIProvider } from './roleCLIProvider';
import { LLMProviderAdapter } from './llmProviderAdapter';
import { cliObserver } from '../logging';

/**
 * Role name mapping from Role enum to config key.
 */
const ROLE_CONFIG_KEYS: Record<string, string> = {
	[Role.EXECUTOR]: 'executor',
	[Role.TECHNICAL_EXPERT]: 'technicalExpert',
	[Role.VERIFIER]: 'verifier',
	[Role.HISTORIAN]: 'historianInterpreter',
};

/**
 * Get the configured RoleCLIProvider for a specific role.
 *
 * Resolution order:
 * 1. Read CLI provider ID from VS Code settings for this role
 * 2. Look up provider in the RoleCLI registry
 * 3. If found and available → return it
 * 4. If configured but not available → explicit failure (no silent fallback)
 * 5. If no CLI configured → fall back to LLMProviderAdapter wrapping the API provider
 *
 * @param role Role enum value
 * @returns Result containing the resolved RoleCLIProvider
 */
export async function resolveProviderForRole(role: Role): Promise<Result<RoleCLIProvider>> {
	const configKey = ROLE_CONFIG_KEYS[role];
	if (!configKey) {
		return {
			success: false,
			error: new CodedError(
				'UNKNOWN_ROLE',
				`No configuration key for role: ${role}`
			),
		};
	}

	const providerId = getCLIProviderIdForRole(configKey);
	const provider = getRoleCLIProvider(providerId);

	if (provider) {
		// CLI provider is registered — check availability
		const detectStart = Date.now();
		const detection = await provider.detect();
		cliObserver.onDetect(providerId, detection, Date.now() - detectStart);

		if (detection.success && detection.value.available) {
			cliObserver.onResolve(configKey, providerId, 'configured-cli');
			return { success: true, value: provider };
		}

		// CLI configured but not available — explicit failure
		const reason = detection.success
			? buildUnavailableReason(detection.value)
			: 'Detection failed';

		cliObserver.onResolve(configKey, providerId, 'not-available', reason);

		return {
			success: false,
			error: new CodedError(
				'CLI_NOT_AVAILABLE',
				`${provider.name} is configured for ${configKey} but is not available: ${reason}. ` +
				`Install it or reassign this role to a different provider in settings ` +
				`(janumicode.cli.roles.${configKey}).`
			),
		};
	}

	// No CLI provider registered with this ID — try API fallback
	if (providerId.startsWith('api-') || !getRoleCLIProvider(providerId)) {
		const llmResult = await createProviderForRole(configKey);
		if (!llmResult.success) {
			cliObserver.onResolve(configKey, providerId, 'error', llmResult.error.message);
			return {
				success: false,
				error: new CodedError(
					'NO_PROVIDER_AVAILABLE',
					`No CLI or API provider available for ${configKey}: ${llmResult.error.message}`
				),
			};
		}
		cliObserver.onResolve(configKey, providerId, 'api-fallback');
		return {
			success: true,
			value: new LLMProviderAdapter(llmResult.value, configKey),
		};
	}

	cliObserver.onResolve(configKey, providerId, 'not-found');
	return {
		success: false,
		error: new CodedError(
			'PROVIDER_NOT_FOUND',
			`CLI provider '${providerId}' is not registered. ` +
			`Available providers can be listed with the JanumiCode: Detect CLI Providers command.`
		),
	};
}

/**
 * Build a human-readable reason for CLI unavailability.
 */
function buildUnavailableReason(info: import('./types').CLIProviderInfo): string {
	const reasons: string[] = [];
	if (!info.available) {
		reasons.push('not installed or not in PATH');
	}
	if (info.requiresApiKey && !info.apiKeyConfigured) {
		reasons.push('API key not configured');
	}
	return reasons.join('; ') || 'unknown reason';
}
