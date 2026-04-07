import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecretKeyManager, getSecretKeyManager } from '../../../lib/config/secretKeyManager';
import { LLMProvider } from '../../../lib/types';

describe('SecretKeyManager', () => {
	let manager: SecretKeyManager;
	let mockSecrets: any;
	const originalEnv = process.env;

	beforeEach(() => {
		manager = new SecretKeyManager();
		mockSecrets = {
			get: vi.fn(),
			store: vi.fn(),
			delete: vi.fn(),
		};
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('initialize', () => {
		it('initializes with SecretStorage', () => {
			manager.initialize(mockSecrets);

			expect(() => manager.initialize(mockSecrets)).not.toThrow();
		});
	});

	describe('getApiKey', () => {
		it('returns role-specific env var first', async () => {
			process.env.JANUMICODE_EXECUTOR_API_KEY = 'role-specific-key';
			process.env.ANTHROPIC_API_KEY = 'provider-key';

			const key = await manager.getApiKey('executor', LLMProvider.CLAUDE);

			expect(key).toBe('role-specific-key');
		});

		it('falls back to provider-generic env var', async () => {
			delete process.env.JANUMICODE_EXECUTOR_API_KEY;
			process.env.ANTHROPIC_API_KEY = 'provider-key';

			const key = await manager.getApiKey('executor', LLMProvider.CLAUDE);

			expect(key).toBe('provider-key');
		});

		it('falls back to SecretStorage', async () => {
			delete process.env.JANUMICODE_EXECUTOR_API_KEY;
			delete process.env.ANTHROPIC_API_KEY;

			manager.initialize(mockSecrets);
			mockSecrets.get.mockResolvedValue('secret-storage-key');

			const key = await manager.getApiKey('executor', LLMProvider.CLAUDE);

			expect(key).toBe('secret-storage-key');
			expect(mockSecrets.get).toHaveBeenCalledWith('janumicode.apiKey.executor');
		});

		it('returns empty string when no key found', async () => {
			delete process.env.JANUMICODE_EXECUTOR_API_KEY;
			delete process.env.ANTHROPIC_API_KEY;

			manager.initialize(mockSecrets);
			mockSecrets.get.mockResolvedValue(undefined);

			const key = await manager.getApiKey('executor', LLMProvider.CLAUDE);

			expect(key).toBe('');
		});

		it('uses correct env var for technical expert', async () => {
			process.env.JANUMICODE_TECHNICAL_EXPERT_API_KEY = 'expert-key';

			const key = await manager.getApiKey('technicalExpert', LLMProvider.CLAUDE);

			expect(key).toBe('expert-key');
		});

		it('uses correct env var for verifier', async () => {
			process.env.JANUMICODE_VERIFIER_API_KEY = 'verifier-key';

			const key = await manager.getApiKey('verifier', LLMProvider.GEMINI);

			expect(key).toBe('verifier-key');
		});

		it('uses correct env var for historian interpreter', async () => {
			process.env.JANUMICODE_HISTORIAN_INTERPRETER_API_KEY = 'historian-key';

			const key = await manager.getApiKey('historianInterpreter', LLMProvider.GEMINI);

			expect(key).toBe('historian-key');
		});

		it('uses ANTHROPIC_API_KEY for Claude provider', async () => {
			process.env.ANTHROPIC_API_KEY = 'claude-key';

			const key = await manager.getApiKey('executor', LLMProvider.CLAUDE);

			expect(key).toBe('claude-key');
		});

		it('uses OPENAI_API_KEY for OpenAI provider', async () => {
			process.env.OPENAI_API_KEY = 'openai-key';

			const key = await manager.getApiKey('executor', LLMProvider.OPENAI);

			expect(key).toBe('openai-key');
		});

		it('uses GEMINI_API_KEY for Gemini provider', async () => {
			process.env.GEMINI_API_KEY = 'gemini-key';

			const key = await manager.getApiKey('verifier', LLMProvider.GEMINI);

			expect(key).toBe('gemini-key');
		});

		it('returns empty string when SecretStorage not initialized', async () => {
			delete process.env.JANUMICODE_EXECUTOR_API_KEY;
			delete process.env.ANTHROPIC_API_KEY;

			const key = await manager.getApiKey('executor', LLMProvider.CLAUDE);

			expect(key).toBe('');
		});
	});

	describe('setApiKey', () => {
		it('stores key in SecretStorage', async () => {
			manager.initialize(mockSecrets);

			await manager.setApiKey('executor', 'new-key');

			expect(mockSecrets.store).toHaveBeenCalledWith('janumicode.apiKey.executor', 'new-key');
		});

		it('throws when not initialized', async () => {
			await expect(manager.setApiKey('executor', 'key')).rejects.toThrow('not initialized');
		});
	});

	describe('deleteApiKey', () => {
		it('deletes key from SecretStorage', async () => {
			manager.initialize(mockSecrets);

			await manager.deleteApiKey('executor');

			expect(mockSecrets.delete).toHaveBeenCalledWith('janumicode.apiKey.executor');
		});

		it('throws when not initialized', async () => {
			await expect(manager.deleteApiKey('executor')).rejects.toThrow('not initialized');
		});
	});

	describe('getAvailableRoles', () => {
		it('returns roles with API keys', async () => {
			process.env.JANUMICODE_EXECUTOR_API_KEY = 'executor-key';
			process.env.JANUMICODE_VERIFIER_API_KEY = 'verifier-key';

			const getProvider = vi.fn().mockReturnValue(LLMProvider.CLAUDE);

			const available = await manager.getAvailableRoles(getProvider);

			expect(available).toContain('executor');
			expect(available).toContain('verifier');
		});

		it('excludes roles without API keys', async () => {
			process.env.JANUMICODE_EXECUTOR_API_KEY = 'executor-key';

			const getProvider = vi.fn().mockReturnValue(LLMProvider.CLAUDE);

			const available = await manager.getAvailableRoles(getProvider);

			expect(available).toContain('executor');
			expect(available).not.toContain('technicalExpert');
			expect(available).not.toContain('verifier');
			expect(available).not.toContain('historianInterpreter');
		});

		it('checks all roles', async () => {
			const getProvider = vi.fn().mockReturnValue(LLMProvider.CLAUDE);

			await manager.getAvailableRoles(getProvider);

			expect(getProvider).toHaveBeenCalledWith('executor');
			expect(getProvider).toHaveBeenCalledWith('technicalExpert');
			expect(getProvider).toHaveBeenCalledWith('verifier');
			expect(getProvider).toHaveBeenCalledWith('historianInterpreter');
		});

		it('returns empty array when no keys configured', async () => {
			const getProvider = vi.fn().mockReturnValue(LLMProvider.CLAUDE);

			const available = await manager.getAvailableRoles(getProvider);

			expect(available).toEqual([]);
		});
	});

	describe('getMissingRoles', () => {
		it('returns roles without API keys', async () => {
			const getProvider = vi.fn().mockReturnValue(LLMProvider.CLAUDE);

			const missing = await manager.getMissingRoles(getProvider);

			expect(missing).toContain('executor');
			expect(missing).toContain('technicalExpert');
			expect(missing).toContain('verifier');
			expect(missing).toContain('historianInterpreter');
		});

		it('excludes roles with API keys', async () => {
			process.env.JANUMICODE_EXECUTOR_API_KEY = 'executor-key';
			process.env.JANUMICODE_VERIFIER_API_KEY = 'verifier-key';

			const getProvider = vi.fn().mockReturnValue(LLMProvider.CLAUDE);

			const missing = await manager.getMissingRoles(getProvider);

			expect(missing).not.toContain('executor');
			expect(missing).not.toContain('verifier');
			expect(missing).toContain('technicalExpert');
			expect(missing).toContain('historianInterpreter');
		});

		it('returns empty array when all keys configured', async () => {
			process.env.JANUMICODE_EXECUTOR_API_KEY = 'executor-key';
			process.env.JANUMICODE_TECHNICAL_EXPERT_API_KEY = 'expert-key';
			process.env.JANUMICODE_VERIFIER_API_KEY = 'verifier-key';
			process.env.JANUMICODE_HISTORIAN_INTERPRETER_API_KEY = 'historian-key';

			const getProvider = vi.fn().mockReturnValue(LLMProvider.CLAUDE);

			const missing = await manager.getMissingRoles(getProvider);

			expect(missing).toEqual([]);
		});
	});

	describe('getSecretKeyManager singleton', () => {
		it('returns singleton instance', () => {
			const instance1 = getSecretKeyManager();
			const instance2 = getSecretKeyManager();

			expect(instance1).toBe(instance2);
		});

		it('returns initialized instance', () => {
			const instance = getSecretKeyManager();

			expect(instance).toBeInstanceOf(SecretKeyManager);
		});
	});

	describe('edge cases', () => {
		it('handles empty env var values', async () => {
			process.env.JANUMICODE_EXECUTOR_API_KEY = '';

			manager.initialize(mockSecrets);
			mockSecrets.get.mockResolvedValue('fallback-key');

			const key = await manager.getApiKey('executor', LLMProvider.CLAUDE);

			expect(key).toBe('fallback-key');
		});

		it('handles whitespace in env vars', async () => {
			process.env.JANUMICODE_EXECUTOR_API_KEY = '  key-with-spaces  ';

			const key = await manager.getApiKey('executor', LLMProvider.CLAUDE);

			expect(key).toBe('  key-with-spaces  ');
		});

		it('prioritizes role-specific over provider-generic', async () => {
			process.env.JANUMICODE_EXECUTOR_API_KEY = 'role-key';
			process.env.ANTHROPIC_API_KEY = 'provider-key';

			manager.initialize(mockSecrets);
			mockSecrets.get.mockResolvedValue('storage-key');

			const key = await manager.getApiKey('executor', LLMProvider.CLAUDE);

			expect(key).toBe('role-key');
		});

		it('prioritizes provider-generic over SecretStorage', async () => {
			delete process.env.JANUMICODE_EXECUTOR_API_KEY;
			process.env.ANTHROPIC_API_KEY = 'provider-key';

			manager.initialize(mockSecrets);
			mockSecrets.get.mockResolvedValue('storage-key');

			const key = await manager.getApiKey('executor', LLMProvider.CLAUDE);

			expect(key).toBe('provider-key');
		});

		it('handles unknown role gracefully', async () => {
			const key = await manager.getApiKey('unknownRole', LLMProvider.CLAUDE);

			expect(key).toBe('');
		});

		it('handles multiple roles with different providers', async () => {
			process.env.ANTHROPIC_API_KEY = 'claude-key';
			process.env.GEMINI_API_KEY = 'gemini-key';

			const executorKey = await manager.getApiKey('executor', LLMProvider.CLAUDE);
			const verifierKey = await manager.getApiKey('verifier', LLMProvider.GEMINI);

			expect(executorKey).toBe('claude-key');
			expect(verifierKey).toBe('gemini-key');
		});

		it('stores and retrieves keys correctly', async () => {
			manager.initialize(mockSecrets);
			mockSecrets.get.mockResolvedValue('stored-key');

			await manager.setApiKey('executor', 'new-key');
			const key = await manager.getApiKey('executor', LLMProvider.CLAUDE);

			expect(mockSecrets.store).toHaveBeenCalledWith('janumicode.apiKey.executor', 'new-key');
		});

		it('deletes keys correctly', async () => {
			manager.initialize(mockSecrets);

			await manager.setApiKey('executor', 'key');
			await manager.deleteApiKey('executor');

			expect(mockSecrets.delete).toHaveBeenCalledWith('janumicode.apiKey.executor');
		});
	});
});
