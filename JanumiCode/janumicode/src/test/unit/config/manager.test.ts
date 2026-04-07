import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	getDatabasePath,
	getProviderForRole,
	getCLIProviderIdForRole,
	getCLIProviderSettings,
	getProviderCapabilityOverrides,
	isMobileSpecialistEnabled,
	isValidationParallelAgentsEnabled,
	getMobileSpecialistConfig,
	getCLIRoleAssignments,
	validateConfig,
	setDatabasePath,
	setLLMConfigForRole,
	areAPIKeysConfigured,
	getMissingAPIKeyRoles,
} from '../../../lib/config/manager';
import { LLMProvider } from '../../../lib/types';

vi.mock('vscode');
vi.mock('../../../lib/config/secretKeyManager');

describe('Configuration Manager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getDatabasePath', () => {
		it('returns custom path when configured', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === 'databasePath') {return '/custom/path/db.sqlite';}
					return '';
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const dbPath = getDatabasePath();

			expect(dbPath).toBe('/custom/path/db.sqlite');
		});

		it('returns workspace path when available', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn(() => ''),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);
			vi.mocked(vscode.workspace).workspaceFolders = [
				{ uri: { fsPath: '/workspace' } } as any,
			];

			const dbPath = getDatabasePath();

			expect(dbPath).toContain('.janumicode');
			expect(dbPath).toContain('database.db');
		});

		it('returns home directory path when no workspace', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn(() => ''),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);
			vi.mocked(vscode.workspace).workspaceFolders = undefined;

			const dbPath = getDatabasePath();

			expect(dbPath).toContain('.janumicode');
			expect(dbPath).toContain('database.db');
		});
	});

	describe('getProviderForRole', () => {
		it('returns configured provider for role', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: any) => {
					if (key === 'llm.executor.provider') {return LLMProvider.CLAUDE;}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const provider = getProviderForRole('executor');

			expect(provider).toBe(LLMProvider.CLAUDE);
		});

		it('returns default provider when not configured', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: any) => defaultValue),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const provider = getProviderForRole('verifier');

			expect(provider).toBe(LLMProvider.CLAUDE);
		});
	});

	describe('getCLIProviderIdForRole', () => {
		it('returns configured CLI provider for role', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: string) => {
					if (key === 'cli.roles.executor') {return 'custom-cli';}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const providerId = getCLIProviderIdForRole('executor');

			expect(providerId).toBe('custom-cli');
		});

		it('returns default CLI provider for executor', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: string) => defaultValue),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const providerId = getCLIProviderIdForRole('executor');

			expect(providerId).toBe('claude-code');
		});

		it('returns default CLI provider for verifier', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: string) => defaultValue),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const providerId = getCLIProviderIdForRole('verifier');

			expect(providerId).toBe('gemini-cli');
		});
	});

	describe('getCLIProviderSettings', () => {
		it('returns configured settings for provider', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: any) => {
					if (key === 'cli.providers.claude-code.path') {return '/custom/claude';}
					if (key === 'cli.providers.claude-code.defaultModel') {return 'claude-4';}
					if (key === 'cli.providers.claude-code.timeout') {return 60000;}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const settings = getCLIProviderSettings('claude-code');

			expect(settings.path).toBe('/custom/claude');
			expect(settings.defaultModel).toBe('claude-4');
			expect(settings.timeout).toBe(60000);
		});

		it('returns defaults when not configured', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: any) => defaultValue),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const settings = getCLIProviderSettings('gemini-cli');

			expect(settings.path).toBe('');
			expect(settings.defaultModel).toBe('');
			expect(settings.timeout).toBe(300000);
		});
	});

	describe('getProviderCapabilityOverrides', () => {
		it('returns overrides when configured', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: any) => {
					if (key === 'providers.claude-code.capabilities') {return ['reasoning', 'code'];}
					if (key === 'providers.claude-code.costTier') {return 'premium';}
					if (key === 'providers.claude-code.strengths') {return ['long-context'];}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const overrides = getProviderCapabilityOverrides('claude-code');

			expect(overrides).toEqual({
				capabilities: ['reasoning', 'code'],
				costTier: 'premium',
				strengths: ['long-context'],
			});
		});

		it('returns null when nothing configured', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: any) => defaultValue),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const overrides = getProviderCapabilityOverrides('gemini-cli');

			expect(overrides).toBeNull();
		});

		it('returns partial overrides', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: any) => {
					if (key === 'providers.test.costTier') {return 'budget';}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const overrides = getProviderCapabilityOverrides('test');

			expect(overrides).toEqual({ costTier: 'budget' });
		});
	});

	describe('feature flags', () => {
		it('isMobileSpecialistEnabled returns configured value', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: boolean) => {
					if (key === 'mcp.mobileSpecialist.enabled') {return true;}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const enabled = isMobileSpecialistEnabled();

			expect(enabled).toBe(true);
		});

		it('isValidationParallelAgentsEnabled returns configured value', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: boolean) => {
					if (key === 'validation.parallelAgents') {return true;}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const enabled = isValidationParallelAgentsEnabled();

			expect(enabled).toBe(true);
		});
	});

	describe('getMobileSpecialistConfig', () => {
		it('returns configured mobile specialist settings', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: string) => {
					if (key === 'mcp.mobileSpecialist.serverPath') {return '/path/to/server';}
					if (key === 'mcp.mobileSpecialist.baseUrl') {return 'https://api.example.com';}
					if (key === 'mcp.mobileSpecialist.apiKey') {return 'test-key';}
					if (key === 'mcp.mobileSpecialist.model') {return 'custom-model';}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const config = getMobileSpecialistConfig();

			expect(config.serverPath).toBe('/path/to/server');
			expect(config.baseUrl).toBe('https://api.example.com');
			expect(config.apiKey).toBe('test-key');
			expect(config.model).toBe('custom-model');
		});
	});

	describe('getCLIRoleAssignments', () => {
		it('returns all role assignments', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: string) => defaultValue),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const assignments = getCLIRoleAssignments();

			expect(assignments).toHaveProperty('executor');
			expect(assignments).toHaveProperty('technicalExpert');
			expect(assignments).toHaveProperty('verifier');
			expect(assignments).toHaveProperty('historianInterpreter');
		});
	});

	describe('validateConfig', () => {
		it('validates successful configuration', async () => {
			const vscode = await import('vscode');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager');

			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: any) => {
					if (key === 'tokenBudget') {return 10000;}
					if (key === 'databasePath') {return '/path/to/db';}
					if (key.includes('.provider')) {return LLMProvider.CLAUDE;}
					if (key.includes('.model')) {return 'claude-model';}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);
			vi.mocked(vscode.workspace).workspaceFolders = undefined;

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue('test-api-key'),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const result = await validateConfig();

			expect(result.success).toBe(true);
		});

		it('fails validation for missing API keys', async () => {
			const vscode = await import('vscode');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager');

			const mockConfig = {
				get: vi.fn((key: string, defaultValue?: any) => {
					if (key === 'tokenBudget') {return 10000;}
					if (key === 'databasePath') {return '/path/to/db';}
					if (key.includes('.provider')) {return LLMProvider.CLAUDE;}
					if (key.includes('.model')) {return 'model';}
					return defaultValue;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				getApiKey: vi.fn().mockResolvedValue(''),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const result = await validateConfig();

			expect(result.success).toBe(false);
		});
	});

	describe('setDatabasePath', () => {
		it('updates database path successfully', async () => {
			const vscode = await import('vscode');
			const updateSpy = vi.fn().mockResolvedValue(undefined);
			const mockConfig = {
				get: vi.fn(),
				update: updateSpy,
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const result = await setDatabasePath('/new/path');

			expect(result.success).toBe(true);
			expect(updateSpy).toHaveBeenCalledWith('databasePath', '/new/path', false);
		});
	});

	describe('setLLMConfigForRole', () => {
		it('updates LLM config for role', async () => {
			const vscode = await import('vscode');
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager');

			const updateSpy = vi.fn().mockResolvedValue(undefined);
			const mockConfig = {
				get: vi.fn(),
				update: updateSpy,
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const mockSecretManager = {
				setApiKey: vi.fn().mockResolvedValue(undefined),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const result = await setLLMConfigForRole('executor', {
				provider: LLMProvider.CLAUDE,
				model: 'claude-4',
				apiKey: 'new-key',
			});

			expect(result.success).toBe(true);
			expect(mockSecretManager.setApiKey).toHaveBeenCalledWith('executor', 'new-key');
		});
	});

	describe('areAPIKeysConfigured', () => {
		it('returns true when all keys configured', async () => {
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager');

			const mockSecretManager = {
				getMissingRoles: vi.fn().mockResolvedValue([]),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const result = await areAPIKeysConfigured();

			expect(result).toBe(true);
		});

		it('returns false when keys missing', async () => {
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager');

			const mockSecretManager = {
				getMissingRoles: vi.fn().mockResolvedValue(['executor']),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const result = await areAPIKeysConfigured();

			expect(result).toBe(false);
		});
	});

	describe('getMissingAPIKeyRoles', () => {
		it('returns display names for missing roles', async () => {
			const { getSecretKeyManager } = await import('../../../lib/config/secretKeyManager');

			const mockSecretManager = {
				getMissingRoles: vi.fn().mockResolvedValue(['executor', 'verifier']),
			};
			vi.mocked(getSecretKeyManager).mockReturnValue(mockSecretManager as any);

			const missing = await getMissingAPIKeyRoles();

			expect(missing).toContain('Executor');
			expect(missing).toContain('Verifier');
		});
	});
});
