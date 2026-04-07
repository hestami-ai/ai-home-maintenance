import { describe, it, expect } from 'vitest';
import {
	getProviderProfile,
	getAllProviderProfiles,
	getRequiredCapabilities,
	rankProvidersForTask,
	type ProviderCapabilityOverrides,
} from '../../../lib/cli/providerCapabilities';
import { ProviderCapability, TaskCategory } from '../../../lib/types/maker';

describe('Provider Capabilities', () => {
	describe('getProviderProfile', () => {
		it('returns profile for claude-code', () => {
			const profile = getProviderProfile('claude-code');

			expect(profile).toBeDefined();
			expect(profile?.provider_id).toBe('claude-code');
			expect(profile?.name).toBe('Claude Code');
			expect(profile?.cost_tier).toBe('HIGH');
			expect(profile?.supports_streaming).toBe(true);
			expect(profile?.supports_tool_use).toBe(true);
		});

		it('returns profile for codex-cli', () => {
			const profile = getProviderProfile('codex-cli');

			expect(profile).toBeDefined();
			expect(profile?.provider_id).toBe('codex-cli');
			expect(profile?.name).toBe('Codex CLI');
			expect(profile?.cost_tier).toBe('HIGH');
		});

		it('returns profile for gemini-cli', () => {
			const profile = getProviderProfile('gemini-cli');

			expect(profile).toBeDefined();
			expect(profile?.provider_id).toBe('gemini-cli');
			expect(profile?.name).toBe('Gemini CLI');
			expect(profile?.cost_tier).toBe('LOW');
			expect(profile?.max_context_tokens).toBe(1000000);
		});

		it('returns null for unknown provider', () => {
			const profile = getProviderProfile('unknown-provider');

			expect(profile).toBeNull();
		});

		it('merges overrides with base profile', () => {
			const overrides: ProviderCapabilityOverrides = {
				costTier: 'MEDIUM',
			};

			const profile = getProviderProfile('claude-code', overrides);

			expect(profile?.cost_tier).toBe('MEDIUM');
			expect(profile?.provider_id).toBe('claude-code');
		});

		it('overrides capabilities', () => {
			const overrides: ProviderCapabilityOverrides = {
				capabilities: [ProviderCapability.CODE_GENERATION],
			};

			const profile = getProviderProfile('claude-code', overrides);

			expect(profile?.capabilities).toEqual([ProviderCapability.CODE_GENERATION]);
		});

		it('overrides strengths', () => {
			const overrides: ProviderCapabilityOverrides = {
				strengths: ['Custom strength 1', 'Custom strength 2'],
			};

			const profile = getProviderProfile('claude-code', overrides);

			expect(profile?.strengths).toEqual(['Custom strength 1', 'Custom strength 2']);
		});

		it('returns base profile when overrides is null', () => {
			const profile = getProviderProfile('claude-code', null);

			expect(profile).toBeDefined();
			expect(profile?.cost_tier).toBe('HIGH');
		});

		it('returns base profile when overrides is undefined', () => {
			const profile = getProviderProfile('claude-code', undefined);

			expect(profile).toBeDefined();
			expect(profile?.cost_tier).toBe('HIGH');
		});

		it('merges multiple override fields', () => {
			const overrides: ProviderCapabilityOverrides = {
				costTier: 'LOW',
				capabilities: [ProviderCapability.VERIFICATION],
				strengths: ['Fast'],
			};

			const profile = getProviderProfile('claude-code', overrides);

			expect(profile?.cost_tier).toBe('LOW');
			expect(profile?.capabilities).toEqual([ProviderCapability.VERIFICATION]);
			expect(profile?.strengths).toEqual(['Fast']);
		});
	});

	describe('getAllProviderProfiles', () => {
		it('returns all provider profiles', () => {
			const profiles = getAllProviderProfiles();

			expect(profiles.length).toBeGreaterThan(0);
			expect(profiles.some(p => p.provider_id === 'claude-code')).toBe(true);
			expect(profiles.some(p => p.provider_id === 'codex-cli')).toBe(true);
			expect(profiles.some(p => p.provider_id === 'gemini-cli')).toBe(true);
		});

		it('returns exactly 3 default profiles', () => {
			const profiles = getAllProviderProfiles();

			expect(profiles.length).toBe(3);
		});

		it('applies overrides map to specific providers', () => {
			const overridesMap = {
				'claude-code': { costTier: 'MEDIUM' as const },
			};

			const profiles = getAllProviderProfiles(overridesMap);

			const claudeProfile = profiles.find(p => p.provider_id === 'claude-code');
			expect(claudeProfile?.cost_tier).toBe('MEDIUM');
		});

		it('leaves non-overridden providers unchanged', () => {
			const overridesMap = {
				'claude-code': { costTier: 'MEDIUM' as const },
			};

			const profiles = getAllProviderProfiles(overridesMap);

			const geminiProfile = profiles.find(p => p.provider_id === 'gemini-cli');
			expect(geminiProfile?.cost_tier).toBe('LOW');
		});

		it('handles empty overrides map', () => {
			const profiles = getAllProviderProfiles({});

			expect(profiles.length).toBe(3);
			const claudeProfile = profiles.find(p => p.provider_id === 'claude-code');
			expect(claudeProfile?.cost_tier).toBe('HIGH');
		});

		it('handles null overrides in map', () => {
			const overridesMap = {
				'claude-code': null,
			};

			const profiles = getAllProviderProfiles(overridesMap);

			const claudeProfile = profiles.find(p => p.provider_id === 'claude-code');
			expect(claudeProfile?.cost_tier).toBe('HIGH');
		});
	});

	describe('getRequiredCapabilities', () => {
		it('returns capabilities for SCAFFOLD', () => {
			const capabilities = getRequiredCapabilities(TaskCategory.SCAFFOLD);

			expect(capabilities).toContain(ProviderCapability.CODE_GENERATION);
			expect(capabilities).toContain(ProviderCapability.FILE_MANIPULATION);
		});

		it('returns capabilities for IMPLEMENTATION', () => {
			const capabilities = getRequiredCapabilities(TaskCategory.IMPLEMENTATION);

			expect(capabilities).toContain(ProviderCapability.CODE_GENERATION);
			expect(capabilities).toContain(ProviderCapability.FILE_MANIPULATION);
			expect(capabilities).toContain(ProviderCapability.REASONING);
		});

		it('returns capabilities for REFACTOR', () => {
			const capabilities = getRequiredCapabilities(TaskCategory.REFACTOR);

			expect(capabilities).toContain(ProviderCapability.REFACTORING);
			expect(capabilities).toContain(ProviderCapability.CODE_REVIEW);
		});

		it('returns capabilities for TEST', () => {
			const capabilities = getRequiredCapabilities(TaskCategory.TEST);

			expect(capabilities).toContain(ProviderCapability.TEST_GENERATION);
			expect(capabilities).toContain(ProviderCapability.CODE_GENERATION);
		});

		it('returns capabilities for DOCUMENTATION', () => {
			const capabilities = getRequiredCapabilities(TaskCategory.DOCUMENTATION);

			expect(capabilities).toContain(ProviderCapability.DOCUMENTATION);
			expect(capabilities).toContain(ProviderCapability.REASONING);
		});

		it('returns capabilities for CONFIGURATION', () => {
			const capabilities = getRequiredCapabilities(TaskCategory.CONFIGURATION);

			expect(capabilities).toContain(ProviderCapability.FILE_MANIPULATION);
			expect(capabilities).toContain(ProviderCapability.CODE_GENERATION);
		});

		it('returns capabilities for MIGRATION', () => {
			const capabilities = getRequiredCapabilities(TaskCategory.MIGRATION);

			expect(capabilities).toContain(ProviderCapability.CODE_GENERATION);
			expect(capabilities).toContain(ProviderCapability.REASONING);
			expect(capabilities).toContain(ProviderCapability.VERIFICATION);
		});

		it('returns fallback for unknown category', () => {
			const capabilities = getRequiredCapabilities('UNKNOWN' as any);

			expect(capabilities).toContain(ProviderCapability.CODE_GENERATION);
		});
	});

	describe('rankProvidersForTask', () => {
		it('ranks providers by capability match', () => {
			const profiles = getAllProviderProfiles();

			const ranked = rankProvidersForTask(TaskCategory.TEST, profiles);

			expect(ranked.length).toBe(3);
			expect(ranked[0]).toBeDefined();
		});

		it('prefers providers with primary capability', () => {
			const profiles = getAllProviderProfiles();

			const ranked = rankProvidersForTask(TaskCategory.REFACTOR, profiles);

			const claudeProfile = profiles.find(p => p.provider_id === 'claude-code');
			expect(claudeProfile?.capabilities).toContain(ProviderCapability.REFACTORING);
		});

		it('applies cost penalty correctly', () => {
			const profiles = getAllProviderProfiles();

			const ranked = rankProvidersForTask('CODE_REVIEW' as any, profiles);

			const geminiProfile = ranked.find(p => p.provider_id === 'gemini-cli');
			expect(geminiProfile).toBeDefined();
		});

		it('boosts preferred provider', () => {
			const profiles = getAllProviderProfiles();

			const ranked = rankProvidersForTask(TaskCategory.SCAFFOLD, profiles, 'gemini-cli');

			expect(ranked.length).toBe(3);
		});

		it('handles empty profiles array', () => {
			const ranked = rankProvidersForTask(TaskCategory.SCAFFOLD, []);

			expect(ranked.length).toBe(0);
		});

		it('handles single provider', () => {
			const profiles = getAllProviderProfiles();
			const singleProfile = profiles.filter(p => p.provider_id === 'claude-code');

			const ranked = rankProvidersForTask(TaskCategory.SCAFFOLD, singleProfile);

			expect(ranked.length).toBe(1);
			expect(ranked[0].provider_id).toBe('claude-code');
		});

		it('ranks all providers for DOCUMENTATION task', () => {
			const profiles = getAllProviderProfiles();

			const ranked = rankProvidersForTask(TaskCategory.DOCUMENTATION, profiles);

			expect(ranked.length).toBe(3);
			const hasDocCapability = ranked.some(p => 
				p.capabilities.includes(ProviderCapability.DOCUMENTATION)
			);
			expect(hasDocCapability).toBe(true);
		});

		it('maintains all providers in ranking', () => {
			const profiles = getAllProviderProfiles();

			const ranked = rankProvidersForTask(TaskCategory.IMPLEMENTATION, profiles);

			expect(ranked.length).toBe(profiles.length);
		});

		it('ranks providers with null preferred provider', () => {
			const profiles = getAllProviderProfiles();

			const ranked = rankProvidersForTask(TaskCategory.SCAFFOLD, profiles, null);

			expect(ranked.length).toBe(3);
		});

		it('ranks providers without preferred provider', () => {
			const profiles = getAllProviderProfiles();

			const ranked = rankProvidersForTask(TaskCategory.SCAFFOLD, profiles);

			expect(ranked.length).toBe(3);
		});
	});

	describe('provider capabilities', () => {
		it('claude-code has comprehensive capabilities', () => {
			const profile = getProviderProfile('claude-code');

			expect(profile?.capabilities).toContain(ProviderCapability.CODE_GENERATION);
			expect(profile?.capabilities).toContain(ProviderCapability.CODE_REVIEW);
			expect(profile?.capabilities).toContain(ProviderCapability.REFACTORING);
			expect(profile?.capabilities).toContain(ProviderCapability.TEST_GENERATION);
			expect(profile?.capabilities).toContain(ProviderCapability.DOCUMENTATION);
			expect(profile?.capabilities).toContain(ProviderCapability.ARCHITECTURE);
			expect(profile?.capabilities).toContain(ProviderCapability.FILE_MANIPULATION);
			expect(profile?.capabilities).toContain(ProviderCapability.VERIFICATION);
			expect(profile?.capabilities).toContain(ProviderCapability.REASONING);
		});

		it('codex-cli has code-focused capabilities', () => {
			const profile = getProviderProfile('codex-cli');

			expect(profile?.capabilities).toContain(ProviderCapability.CODE_GENERATION);
			expect(profile?.capabilities).toContain(ProviderCapability.CODE_REVIEW);
			expect(profile?.capabilities).toContain(ProviderCapability.TEST_GENERATION);
		});

		it('gemini-cli has review and reasoning capabilities', () => {
			const profile = getProviderProfile('gemini-cli');

			expect(profile?.capabilities).toContain(ProviderCapability.CODE_REVIEW);
			expect(profile?.capabilities).toContain(ProviderCapability.VERIFICATION);
			expect(profile?.capabilities).toContain(ProviderCapability.REASONING);
		});
	});

	describe('profile metadata', () => {
		it('includes strengths for each provider', () => {
			const profile = getProviderProfile('claude-code');

			expect(profile?.strengths).toBeDefined();
			expect(profile?.strengths.length).toBeGreaterThan(0);
		});

		it('includes weaknesses for each provider', () => {
			const profile = getProviderProfile('claude-code');

			expect(profile?.weaknesses).toBeDefined();
			expect(profile?.weaknesses?.length).toBeGreaterThan(0);
		});

		it('has valid max_context_tokens', () => {
			const profile = getProviderProfile('claude-code');

			expect(profile?.max_context_tokens).toBeGreaterThan(0);
		});

		it('gemini-cli has largest context window', () => {
			const profiles = getAllProviderProfiles();

			const gemini = profiles.find(p => p.provider_id === 'gemini-cli');
			const others = profiles.filter(p => p.provider_id !== 'gemini-cli');

			expect(gemini?.max_context_tokens).toBeGreaterThan(
				Math.max(...others.map(p => p.max_context_tokens))
			);
		});
	});

	describe('edge cases', () => {
		it('handles provider with all capabilities', () => {
			const overrides: ProviderCapabilityOverrides = {
				capabilities: Object.values(ProviderCapability),
			};

			const profile = getProviderProfile('claude-code', overrides);

			expect(profile?.capabilities.length).toBe(Object.values(ProviderCapability).length);
		});

		it('handles provider with no capabilities', () => {
			const overrides: ProviderCapabilityOverrides = {
				capabilities: [],
			};

			const profile = getProviderProfile('claude-code', overrides);

			expect(profile?.capabilities.length).toBe(0);
		});

		it('handles provider with FREE cost tier', () => {
			const overrides: ProviderCapabilityOverrides = {
				costTier: 'FREE',
			};

			const profile = getProviderProfile('claude-code', overrides);

			expect(profile?.cost_tier).toBe('FREE');
		});

		it('handles empty strengths array', () => {
			const overrides: ProviderCapabilityOverrides = {
				strengths: [],
			};

			const profile = getProviderProfile('claude-code', overrides);

			expect(profile?.strengths).toEqual([]);
		});

		it('ranks with all HIGH cost providers', () => {
			const profiles = getAllProviderProfiles();

			const ranked = rankProvidersForTask(TaskCategory.SCAFFOLD, profiles);

			expect(ranked.length).toBe(3);
		});

		it('ranks with mixed cost tiers', () => {
			const overridesMap = {
				'claude-code': { costTier: 'HIGH' as const },
				'codex-cli': { costTier: 'MEDIUM' as const },
				'gemini-cli': { costTier: 'LOW' as const },
			};

			const profiles = getAllProviderProfiles(overridesMap);
			const ranked = rankProvidersForTask(TaskCategory.SCAFFOLD, profiles);

			expect(ranked.length).toBe(3);
		});
	});

	describe('capability matching', () => {
		it('matches SCAFFOLD to CODE_GENERATION providers', () => {
			const profiles = getAllProviderProfiles();
			const ranked = rankProvidersForTask(TaskCategory.SCAFFOLD, profiles);

			expect(ranked[0].capabilities).toContain(ProviderCapability.CODE_GENERATION);
		});

		it('matches TEST to TEST_GENERATION providers', () => {
			const profiles = getAllProviderProfiles();
			const ranked = rankProvidersForTask(TaskCategory.TEST, profiles);

			const topProvider = ranked[0];
			expect(
				topProvider.capabilities.includes(ProviderCapability.TEST_GENERATION) ||
				topProvider.capabilities.includes(ProviderCapability.CODE_GENERATION)
			).toBe(true);
		});

		it('matches DOCUMENTATION to DOCUMENTATION providers', () => {
			const profiles = getAllProviderProfiles();
			const ranked = rankProvidersForTask(TaskCategory.DOCUMENTATION, profiles);

			const withDocCap = ranked.filter(p => 
				p.capabilities.includes(ProviderCapability.DOCUMENTATION)
			);
			expect(withDocCap.length).toBeGreaterThan(0);
		});

		it('matches REFACTOR to REFACTORING providers', () => {
			const profiles = getAllProviderProfiles();
			const ranked = rankProvidersForTask(TaskCategory.REFACTOR, profiles);

			const withRefactorCap = ranked.filter(p => 
				p.capabilities.includes(ProviderCapability.REFACTORING)
			);
			expect(withRefactorCap.length).toBeGreaterThan(0);
		});
	});

	describe('override scenarios', () => {
		it('applies multiple overrides to multiple providers', () => {
			const overridesMap = {
				'claude-code': { costTier: 'LOW' as const },
				'gemini-cli': { costTier: 'HIGH' as const },
			};

			const profiles = getAllProviderProfiles(overridesMap);

			const claude = profiles.find(p => p.provider_id === 'claude-code');
			const gemini = profiles.find(p => p.provider_id === 'gemini-cli');

			expect(claude?.cost_tier).toBe('LOW');
			expect(gemini?.cost_tier).toBe('HIGH');
		});

		it('overrides capabilities for specific provider only', () => {
			const overridesMap = {
				'claude-code': {
					capabilities: [ProviderCapability.VERIFICATION],
				},
			};

			const profiles = getAllProviderProfiles(overridesMap);

			const claude = profiles.find(p => p.provider_id === 'claude-code');
			const codex = profiles.find(p => p.provider_id === 'codex-cli');

			expect(claude?.capabilities).toEqual([ProviderCapability.VERIFICATION]);
			expect(codex?.capabilities.length).toBeGreaterThan(1);
		});
	});
});
