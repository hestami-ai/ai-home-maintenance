/**
 * Provider Capability Profiles
 *
 * Hardcoded default capability profiles for each CLI provider, merged
 * with optional VS Code settings overrides. Used by the task router to
 * match task_unit categories to the best available provider.
 */

import type {
	ProviderCapabilityProfile,
	CostTier,
	TaskCategory,
} from '../types/maker';
import { ProviderCapability } from '../types/maker';

// ==================== DEFAULT PROFILES ====================

const DEFAULT_PROFILES: Record<string, ProviderCapabilityProfile> = {
	'claude-code': {
		provider_id: 'claude-code',
		name: 'Claude Code',
		capabilities: [
			ProviderCapability.CODE_GENERATION,
			ProviderCapability.CODE_REVIEW,
			ProviderCapability.REFACTORING,
			ProviderCapability.TEST_GENERATION,
			ProviderCapability.DOCUMENTATION,
			ProviderCapability.ARCHITECTURE,
			ProviderCapability.FILE_MANIPULATION,
			ProviderCapability.VERIFICATION,
			ProviderCapability.REASONING,
		],
		cost_tier: 'HIGH',
		max_context_tokens: 200000,
		supports_streaming: true,
		supports_tool_use: true,
		strengths: [
			'Deep code understanding and multi-file refactoring',
			'Agentic tool use with file manipulation',
			'Strong reasoning for architectural decisions',
			'Native streaming with detailed activity events',
		],
		weaknesses: [
			'Higher cost per invocation',
			'Slower for simple mechanical tasks',
		],
	},
	'codex-cli': {
		provider_id: 'codex-cli',
		name: 'Codex CLI',
		capabilities: [
			ProviderCapability.CODE_GENERATION,
			ProviderCapability.CODE_REVIEW,
			ProviderCapability.REFACTORING,
			ProviderCapability.TEST_GENERATION,
			ProviderCapability.FILE_MANIPULATION,
			ProviderCapability.VERIFICATION,
		],
		cost_tier: 'HIGH',
		max_context_tokens: 200000,
		supports_streaming: true,
		supports_tool_use: true,
		strengths: [
			'Fast code generation with sandbox isolation',
			'Strong at test generation and code review',
			'Structured output via --output-schema',
		],
		weaknesses: [
			'Less suited for architectural reasoning',
			'Limited documentation generation quality',
		],
	},
	'gemini-cli': {
		provider_id: 'gemini-cli',
		name: 'Gemini CLI',
		capabilities: [
			ProviderCapability.CODE_REVIEW,
			ProviderCapability.VERIFICATION,
			ProviderCapability.REASONING,
			ProviderCapability.DOCUMENTATION,
			ProviderCapability.CODE_GENERATION,
			ProviderCapability.FILE_MANIPULATION,
		],
		cost_tier: 'LOW',
		max_context_tokens: 1000000,
		supports_streaming: true,
		supports_tool_use: true,
		strengths: [
			'Very large context window for whole-codebase analysis',
			'Cost-effective for verification and review tasks',
			'Good at documentation and reasoning tasks',
		],
		weaknesses: [
			'Less precise at multi-file code generation',
			'Tool use less refined than Claude Code',
		],
	},
};

// ==================== CATEGORY → CAPABILITY MAPPING ====================

/**
 * Maps task categories to the capabilities required to execute them well.
 * Ordered by importance — first capability is the primary requirement.
 */
const CATEGORY_CAPABILITY_MAP: Record<TaskCategory, ProviderCapability[]> = {
	SCAFFOLD: [ProviderCapability.CODE_GENERATION, ProviderCapability.FILE_MANIPULATION],
	IMPLEMENTATION: [ProviderCapability.CODE_GENERATION, ProviderCapability.FILE_MANIPULATION, ProviderCapability.REASONING],
	REFACTOR: [ProviderCapability.REFACTORING, ProviderCapability.CODE_REVIEW],
	TEST: [ProviderCapability.TEST_GENERATION, ProviderCapability.CODE_GENERATION],
	DOCUMENTATION: [ProviderCapability.DOCUMENTATION, ProviderCapability.REASONING],
	CONFIGURATION: [ProviderCapability.FILE_MANIPULATION, ProviderCapability.CODE_GENERATION],
	MIGRATION: [ProviderCapability.CODE_GENERATION, ProviderCapability.REASONING, ProviderCapability.VERIFICATION],
};

// ==================== PUBLIC API ====================

/**
 * User-supplied overrides for a provider profile.
 * Partial — only the fields the user wants to override.
 */
export interface ProviderCapabilityOverrides {
	capabilities?: ProviderCapability[];
	costTier?: CostTier;
	strengths?: string[];
}

/**
 * Get the capability profile for a provider, merging hardcoded defaults
 * with any VS Code settings overrides.
 */
export function getProviderProfile(
	providerId: string,
	overrides?: ProviderCapabilityOverrides | null
): ProviderCapabilityProfile | null {
	const base = DEFAULT_PROFILES[providerId];
	if (!base) {
		return null;
	}

	if (!overrides) {
		return base;
	}

	return {
		...base,
		capabilities: overrides.capabilities ?? base.capabilities,
		cost_tier: overrides.costTier ?? base.cost_tier,
		strengths: overrides.strengths ?? base.strengths,
	};
}

/**
 * Get all registered provider profiles (defaults merged with overrides).
 * @param overridesMap Map of provider_id → user overrides from VS Code settings
 */
export function getAllProviderProfiles(
	overridesMap?: Record<string, ProviderCapabilityOverrides | null>
): ProviderCapabilityProfile[] {
	return Object.keys(DEFAULT_PROFILES).map((id) =>
		getProviderProfile(id, overridesMap?.[id]) ?? DEFAULT_PROFILES[id]
	);
}

/**
 * Get the set of capabilities required for a task category.
 */
export function getRequiredCapabilities(category: TaskCategory): ProviderCapability[] {
	return CATEGORY_CAPABILITY_MAP[category] ?? [ProviderCapability.CODE_GENERATION];
}

/**
 * Rank providers for a task unit based on capability match and cost.
 *
 * Scoring:
 *   +3  per required capability present (first/primary gets +5)
 *   +2  if provider matches preferred_provider
 *   -1  per cost tier step (FREE=0, LOW=1, MEDIUM=2, HIGH=3)
 *
 * Returns providers sorted best-first.
 */
export function rankProvidersForTask(
	category: TaskCategory,
	profiles: ProviderCapabilityProfile[],
	preferredProvider?: string | null
): ProviderCapabilityProfile[] {
	const required = getRequiredCapabilities(category);
	const costPenalty: Record<CostTier, number> = { FREE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

	const scored = profiles.map((profile) => {
		let score = 0;

		// Capability match (primary capability gets extra weight)
		for (let i = 0; i < required.length; i++) {
			if (profile.capabilities.includes(required[i])) {
				score += i === 0 ? 5 : 3;
			}
		}

		// Preferred provider bonus
		if (preferredProvider && profile.provider_id === preferredProvider) {
			score += 2;
		}

		// Cost penalty
		score -= costPenalty[profile.cost_tier];

		return { profile, score };
	});

	scored.sort((a, b) => b.score - a.score);
	return scored.map((s) => s.profile);
}
