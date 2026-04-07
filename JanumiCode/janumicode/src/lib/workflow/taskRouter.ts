/**
 * Task Router
 *
 * Routes task units to the best available CLI provider based on
 * capability matching, cost optimization, and user preferences.
 */

import type { Result } from '../types';
import { Role } from '../types';
import type { TaskUnit, ProviderCapabilityProfile } from '../types/maker';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import { getRoleCLIProvider } from '../cli/roleCLIProvider';
import { rankProvidersForTask } from '../cli/providerCapabilities';
import { resolveProviderForRole } from '../cli/providerResolver';

// ==================== TASK ROUTING ====================

/**
 * Route a task unit to the best available CLI provider.
 *
 * Resolution order:
 * 1. If unit has preferred_provider and it's available → use it
 * 2. Rank all profiles by capability match for unit.category → pick top
 * 3. Fall back to the default Executor provider
 */
export async function routeTaskToProvider(
	unit: TaskUnit,
	profiles: ProviderCapabilityProfile[]
): Promise<Result<RoleCLIProvider>> {
	// 1. Try preferred provider
	if (unit.preferred_provider) {
		const preferred = getRoleCLIProvider(unit.preferred_provider);
		if (preferred) {
			const detection = await preferred.detect();
			if (detection.success && detection.value.available) {
				return { success: true, value: preferred };
			}
		}
	}

	// 2. Rank by capability match
	const ranked = rankProvidersForTask(
		unit.category,
		profiles,
		unit.preferred_provider
	);

	for (const profile of ranked) {
		const provider = getRoleCLIProvider(profile.provider_id);
		if (!provider) { continue; }

		const detection = await provider.detect();
		if (detection.success && detection.value.available) {
			return { success: true, value: provider };
		}
	}

	// 3. Fall back to default Executor provider
	return resolveProviderForRole(Role.EXECUTOR);
}

/**
 * Route a repair task to a provider.
 * For repairs, we may want a different provider than the one that failed.
 * Falls back to the original provider if no better option is available.
 */
export async function routeRepairToProvider(
	unit: TaskUnit,
	originalProviderId: string,
	profiles: ProviderCapabilityProfile[]
): Promise<Result<RoleCLIProvider>> {
	// For Phase 1: use the same provider as the original execution.
	// Multi-provider repair handoff is deferred per the Bounded Repair guidance
	// ("max 1 provider handoff during repair, and only later if you add multi-provider repair")

	const original = getRoleCLIProvider(originalProviderId);
	if (original) {
		const detection = await original.detect();
		if (detection.success && detection.value.available) {
			return { success: true, value: original };
		}
	}

	// If original provider is unavailable, fall back to capability routing
	return routeTaskToProvider(unit, profiles);
}
