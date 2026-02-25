/**
 * Secret Key Manager
 * Provides layered API key resolution:
 * 1. Environment variables (role-specific, then provider-generic)
 * 2. VS Code SecretStorage (OS-level encryption)
 *
 * Env var names:
 *   Role-specific: JANUMICODE_EXECUTOR_API_KEY, JANUMICODE_TECHNICAL_EXPERT_API_KEY, etc.
 *   Provider-generic: ANTHROPIC_API_KEY, OPENAI_API_KEY
 */

import * as vscode from 'vscode';
import { LLMProvider } from '../types';

const ROLE_ENV_VAR_MAP: Record<string, string> = {
	executor: 'JANUMICODE_EXECUTOR_API_KEY',
	technicalExpert: 'JANUMICODE_TECHNICAL_EXPERT_API_KEY',
	verifier: 'JANUMICODE_VERIFIER_API_KEY',
	historianInterpreter: 'JANUMICODE_HISTORIAN_INTERPRETER_API_KEY',
};

const PROVIDER_ENV_VAR_MAP: Record<string, string> = {
	[LLMProvider.CLAUDE]: 'ANTHROPIC_API_KEY',
	[LLMProvider.OPENAI]: 'OPENAI_API_KEY',
	[LLMProvider.GEMINI]: 'GEMINI_API_KEY',
};

const SECRET_KEY_PREFIX = 'janumicode.apiKey.';

const ALL_ROLES = ['executor', 'technicalExpert', 'verifier', 'historianInterpreter'] as const;

export class SecretKeyManager {
	private _secrets: vscode.SecretStorage | undefined;

	/**
	 * Initialize with VS Code's SecretStorage.
	 * Must be called during extension activation before any key lookups.
	 */
	initialize(secrets: vscode.SecretStorage): void {
		this._secrets = secrets;
	}

	/**
	 * Resolve an API key for a role using layered fallback:
	 * 1. Role-specific env var (e.g. JANUMICODE_EXECUTOR_API_KEY)
	 * 2. Provider-generic env var (e.g. ANTHROPIC_API_KEY for CLAUDE roles)
	 * 3. VS Code SecretStorage
	 */
	async getApiKey(role: string, provider: LLMProvider): Promise<string> {
		// 1. Role-specific env var
		const roleEnvVar = ROLE_ENV_VAR_MAP[role];
		if (roleEnvVar) {
			const envValue = process.env[roleEnvVar];
			if (envValue) {
				return envValue;
			}
		}

		// 2. Provider-generic env var
		const providerEnvVar = PROVIDER_ENV_VAR_MAP[provider];
		if (providerEnvVar) {
			const envValue = process.env[providerEnvVar];
			if (envValue) {
				return envValue;
			}
		}

		// 3. SecretStorage
		if (this._secrets) {
			const stored = await this._secrets.get(`${SECRET_KEY_PREFIX}${role}`);
			if (stored) {
				return stored;
			}
		}

		return '';
	}

	/**
	 * Store an API key in SecretStorage.
	 */
	async setApiKey(role: string, key: string): Promise<void> {
		if (!this._secrets) {
			throw new Error('SecretKeyManager not initialized');
		}
		await this._secrets.store(`${SECRET_KEY_PREFIX}${role}`, key);
	}

	/**
	 * Delete an API key from SecretStorage.
	 */
	async deleteApiKey(role: string): Promise<void> {
		if (!this._secrets) {
			throw new Error('SecretKeyManager not initialized');
		}
		await this._secrets.delete(`${SECRET_KEY_PREFIX}${role}`);
	}

	/**
	 * Get role names that have an API key available from any source.
	 */
	async getAvailableRoles(getProviderForRole: (role: string) => LLMProvider): Promise<string[]> {
		const available: string[] = [];
		for (const role of ALL_ROLES) {
			const key = await this.getApiKey(role, getProviderForRole(role));
			if (key) {
				available.push(role);
			}
		}
		return available;
	}

	/**
	 * Get role names that are missing an API key from all sources.
	 */
	async getMissingRoles(getProviderForRole: (role: string) => LLMProvider): Promise<string[]> {
		const missing: string[] = [];
		for (const role of ALL_ROLES) {
			const key = await this.getApiKey(role, getProviderForRole(role));
			if (!key) {
				missing.push(role);
			}
		}
		return missing;
	}
}

// Module-level singleton
let _instance: SecretKeyManager | undefined;

export function getSecretKeyManager(): SecretKeyManager {
	if (!_instance) {
		_instance = new SecretKeyManager();
	}
	return _instance;
}
