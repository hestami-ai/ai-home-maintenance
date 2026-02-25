/**
 * Role Manager
 * Implements Phase 4.5: Role-to-Provider Mapping
 * Manages LLM provider assignments for each role
 */

import type { Result, Role } from '../types';
import type { LLMProvider, LLMRequest, LLMResponse, RateLimitInfo } from './provider';
import { createProviderForRole } from './providerFactory';

/**
 * Role provider cache
 * Caches provider instances for each role to avoid recreation
 */
const roleProviderCache = new Map<string, LLMProvider>();

/**
 * Get provider for role
 * @param role Role identifier
 * @returns Result containing provider instance
 */
export async function getProviderForRole(
	role: Role | string
): Promise<Result<LLMProvider>> {
	try {
		// Convert Role enum to string
		const roleKey = typeof role === 'string' ? role : String(role);

		// Check cache first
		const cached = roleProviderCache.get(roleKey);
		if (cached) {
			return { success: true, value: cached };
		}

		// Create provider for role (async — resolves API key)
		const providerResult = await createProviderForRole(roleKey);
		if (!providerResult.success) {
			return providerResult;
		}

		// Cache provider
		roleProviderCache.set(roleKey, providerResult.value);

		return providerResult;
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get provider for role'),
		};
	}
}

/**
 * Invoke LLM for role
 * @param role Role identifier
 * @param request LLM request
 * @returns Result containing LLM response
 */
export async function invokeRole(
	role: Role | string,
	request: LLMRequest
): Promise<Result<LLMResponse>> {
	try {
		// Get provider for role
		const providerResult = await getProviderForRole(role);
		if (!providerResult.success) {
			return {
				success: false,
				error: providerResult.error,
			};
		}

		const provider = providerResult.value;

		// Invoke provider
		return await provider.complete(request);
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to invoke role'),
		};
	}
}

/**
 * Clear role provider cache
 * Useful for configuration changes or testing
 */
export function clearRoleProviderCache(): void {
	roleProviderCache.clear();
}

/**
 * Preload provider for role
 * Initializes and caches provider without making a request
 * @param role Role identifier
 * @returns Result indicating success
 */
export async function preloadProvider(
	role: Role | string
): Promise<Result<void>> {
	try {
		const providerResult = await getProviderForRole(role);
		if (!providerResult.success) {
			return {
				success: false,
				error: providerResult.error,
			};
		}

		// Validate API key
		const provider = providerResult.value;
		const validationResult = await provider.validateApiKey();

		if (!validationResult.success) {
			return {
				success: false,
				error: validationResult.error,
			};
		}

		if (!validationResult.value) {
			return {
				success: false,
				error: new Error(`Invalid API key for role: ${role}`),
			};
		}

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to preload provider'),
		};
	}
}

/**
 * Preload all role providers
 * @returns Result with success status for each role
 */
export async function preloadAllProviders(): Promise<
	Result<Record<string, boolean>>
> {
	try {
		const roles = ['executor', 'technicalExpert', 'verifier', 'historianInterpreter'];
		const results: Record<string, boolean> = {};

		for (const role of roles) {
			const result = await preloadProvider(role);
			results[role] = result.success;
		}

		return { success: true, value: results };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to preload all providers'),
		};
	}
}

/**
 * Get role provider capabilities
 * @param role Role identifier
 * @returns Result containing provider capabilities
 */
export async function getRoleCapabilities(
	role: Role | string
): Promise<Result<LLMProvider['capabilities']>> {
	const providerResult = await getProviderForRole(role);
	if (!providerResult.success) {
		return {
			success: false,
			error: providerResult.error,
		};
	}

	return {
		success: true,
		value: providerResult.value.capabilities,
	};
}

/**
 * Count tokens for role
 * Uses role-specific provider for accurate token counting
 * @param role Role identifier
 * @param text Text to count
 * @param model Model to use for counting
 * @returns Result containing token count
 */
export async function countTokensForRole(
	role: Role | string,
	text: string,
	model: string
): Promise<Result<number>> {
	const providerResult = await getProviderForRole(role);
	if (!providerResult.success) {
		return {
			success: false,
			error: providerResult.error,
		};
	}

	return await providerResult.value.countTokens(text, model);
}

/**
 * Get rate limit info for role
 * @param role Role identifier
 * @returns Result containing rate limit information
 */
export async function getRateLimitForRole(
	role: Role | string
): Promise<Result<RateLimitInfo | null>> {
	const providerResult = await getProviderForRole(role);
	if (!providerResult.success) {
		return {
			success: false,
			error: providerResult.error,
		};
	}

	return await providerResult.value.getRateLimitInfo();
}
