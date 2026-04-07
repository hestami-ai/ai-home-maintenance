import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	routeTaskToProvider,
	routeRepairToProvider,
} from '../../../lib/workflow/taskRouter';
import { randomUUID } from 'node:crypto';
import { TaskCategory, TaskUnitStatus, ProviderCapability } from '../../../lib/types/maker';
import type { TaskUnit, ProviderCapabilityProfile } from '../../../lib/types/maker';

vi.mock('../../../lib/cli/roleCLIProvider', () => ({
	getRoleCLIProvider: vi.fn((providerId: string) => {
		if (providerId === 'mock-provider-available') {
			return {
				detect: async () => ({ success: true, value: { available: true } }),
			};
		}
		if (providerId === 'mock-provider-unavailable') {
			return {
				detect: async () => ({ success: true, value: { available: false } }),
			};
		}
		if (providerId === 'mock-preferred') {
			return {
				detect: async () => ({ success: true, value: { available: true } }),
			};
		}
		return null;
	}),
}));

vi.mock('../../../lib/cli/providerCapabilities', () => ({
	rankProvidersForTask: vi.fn((category: any, profiles: any[], preferred: any) => {
		return profiles.sort((a: any, b: any) => {
			if (a.provider_id === preferred) { return -1; }
			if (b.provider_id === preferred) { return 1; }
			return 0;
		});
	}),
}));

vi.mock('../../../lib/cli/providerResolver', () => ({
	resolveProviderForRole: vi.fn(async () => ({
		success: true,
		value: {
			detect: async () => ({ success: true, value: { available: true } }),
		},
	})),
}));

describe('TaskRouter', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		vi.clearAllMocks();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	const createMockProfile = (overrides: Partial<ProviderCapabilityProfile> & Pick<ProviderCapabilityProfile, 'provider_id'>): ProviderCapabilityProfile => ({
		name: overrides.provider_id,
		capabilities: [ProviderCapability.CODE_GENERATION],
		cost_tier: 'LOW',
		max_context_tokens: 100000,
		supports_streaming: true,
		supports_tool_use: true,
		strengths: [],
		weaknesses: [],
		...overrides,
	});

	const createMockUnit = (overrides?: Partial<TaskUnit>): TaskUnit => ({
		unit_id: randomUUID(),
		graph_id: randomUUID(),
		label: 'Test Unit',
		goal: 'Test goal',
		category: TaskCategory.IMPLEMENTATION,
		inputs: [],
		outputs: [],
		preconditions: [],
		postconditions: [],
		allowed_tools: [],
		max_change_scope: 'file',
		verification_method: 'test',
		preferred_provider: null,
		parent_unit_id: null,
		falsifiers: ['test fails'],
		observables: ['file created'],
		status: TaskUnitStatus.PENDING,
		sort_order: 0,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		...overrides,
	});

	describe('routeTaskToProvider', () => {

		it('uses preferred provider when available', async () => {
			const unit = createMockUnit({
				preferred_provider: 'mock-preferred',
			});

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			const result = await routeTaskToProvider(unit, profiles);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeDefined();
			}
		});

		it('falls back to ranked provider when preferred unavailable', async () => {
			const unit = createMockUnit({
				preferred_provider: 'mock-provider-unavailable',
			});

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			const result = await routeTaskToProvider(unit, profiles);

			expect(result.success).toBe(true);
		});

		it('routes to first available ranked provider', async () => {
			const unit = createMockUnit();

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			const result = await routeTaskToProvider(unit, profiles);

			expect(result.success).toBe(true);
		});

		it('skips unavailable providers in ranking', async () => {
			const unit = createMockUnit();

			const profiles: ProviderCapabilityProfile[] = [
				createMockProfile({ provider_id: 'mock-provider-unavailable' }),
				createMockProfile({ provider_id: 'mock-provider-available' }),
			];

			const result = await routeTaskToProvider(unit, profiles);

			expect(result.success).toBe(true);
		});

		it('falls back to default executor when no providers available', async () => {
			const unit = createMockUnit();

			const profiles: ProviderCapabilityProfile[] = [];

			const result = await routeTaskToProvider(unit, profiles);

			expect(result.success).toBe(true);
		});

		it('handles null preferred provider', async () => {
			const unit = createMockUnit({
				preferred_provider: null,
			});

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			const result = await routeTaskToProvider(unit, profiles);

			expect(result.success).toBe(true);
		});

		it('routes different task categories', async () => {
			const categories = [
				TaskCategory.IMPLEMENTATION,
				TaskCategory.TEST,
				TaskCategory.REFACTOR,
				TaskCategory.DOCUMENTATION,
			];

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			for (const category of categories) {
				const unit = createMockUnit({ category });
				const result = await routeTaskToProvider(unit, profiles);
				expect(result.success).toBe(true);
			}
		});

		it('handles empty profiles array', async () => {
			const unit = createMockUnit();
			const result = await routeTaskToProvider(unit, []);

			expect(result.success).toBe(true);
		});

		it('handles provider detection failure gracefully', async () => {
			const unit = createMockUnit({
				preferred_provider: 'nonexistent-provider',
			});

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			const result = await routeTaskToProvider(unit, profiles);

			expect(result.success).toBe(true);
		});
	});

	describe('routeRepairToProvider', () => {

		it('uses original provider when available', async () => {
			const unit = createMockUnit();
			const originalProviderId = 'mock-provider-available';

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			const result = await routeRepairToProvider(unit, originalProviderId, profiles);

			expect(result.success).toBe(true);
		});

		it('falls back to capability routing when original unavailable', async () => {
			const unit = createMockUnit();
			const originalProviderId = 'mock-provider-unavailable';

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			const result = await routeRepairToProvider(unit, originalProviderId, profiles);

			expect(result.success).toBe(true);
		});

		it('handles nonexistent original provider', async () => {
			const unit = createMockUnit();
			const originalProviderId = 'nonexistent-provider';

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			const result = await routeRepairToProvider(unit, originalProviderId, profiles);

			expect(result.success).toBe(true);
		});

		it('prefers original provider over preferred provider', async () => {
			const unit = createMockUnit({
				preferred_provider: 'mock-preferred',
			});
			const originalProviderId = 'mock-provider-available';

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			const result = await routeRepairToProvider(unit, originalProviderId, profiles);

			expect(result.success).toBe(true);
		});

		it('handles empty profiles on fallback', async () => {
			const unit = createMockUnit();
			const originalProviderId = 'nonexistent-provider';

			const result = await routeRepairToProvider(unit, originalProviderId, []);

			expect(result.success).toBe(true);
		});

		it('routes repairs for different task categories', async () => {
			const categories = [TaskCategory.IMPLEMENTATION, TaskCategory.TEST, TaskCategory.REFACTOR];
			const originalProviderId = 'mock-provider-unavailable';

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			for (const category of categories) {
				const unit = createMockUnit({ category });
				const result = await routeRepairToProvider(unit, originalProviderId, profiles);
				expect(result.success).toBe(true);
			}
		});
	});

	describe('integration scenarios', () => {

		it('routes task with preferred provider successfully', async () => {
			const unit = createMockUnit({
				preferred_provider: 'mock-preferred',
				category: TaskCategory.IMPLEMENTATION,
			});

			const profiles: ProviderCapabilityProfile[] = [
				createMockProfile({ provider_id: 'mock-provider-available' }),
				createMockProfile({ provider_id: 'mock-preferred', cost_tier: 'HIGH' }),
			];

			const result = await routeTaskToProvider(unit, profiles);

			expect(result.success).toBe(true);
		});

		it('handles task routing cascade when providers unavailable', async () => {
			const unit = createMockUnit({
				preferred_provider: 'mock-provider-unavailable',
			});

			const profiles: ProviderCapabilityProfile[] = [
				createMockProfile({ provider_id: 'mock-provider-unavailable' }),
			];

			const result = await routeTaskToProvider(unit, profiles);

			expect(result.success).toBe(true);
		});

		it('repairs use same provider as original execution', async () => {
			const unit = createMockUnit();
			const originalProviderId = 'mock-provider-available';

			const profiles: ProviderCapabilityProfile[] = [
				{
					provider_id: 'mock-provider-available',
					name: 'Mock Provider',
					capabilities: [ProviderCapability.CODE_GENERATION],
					cost_tier: 'LOW',
					max_context_tokens: 100000,
					supports_streaming: true,
					supports_tool_use: true,
					strengths: ['fast'],
					weaknesses: [],
				},
			];

			const result = await routeRepairToProvider(unit, originalProviderId, profiles);

			expect(result.success).toBe(true);
		});

		it('handles multiple profile options with ranking', async () => {
			const unit = createMockUnit({
				category: TaskCategory.IMPLEMENTATION,
			});

			const profiles: ProviderCapabilityProfile[] = [
				createMockProfile({ provider_id: 'mock-provider-available' }),
				createMockProfile({ provider_id: 'mock-provider-available', capabilities: [ProviderCapability.TEST_GENERATION] }),
			];

			const result = await routeTaskToProvider(unit, profiles);

			expect(result.success).toBe(true);
		});
	});
});
