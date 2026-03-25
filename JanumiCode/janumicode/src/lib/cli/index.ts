/**
 * CLI Integration Module
 * Multi-CLI provider abstraction for role-based execution.
 * See: docs/Multi-CLI Integration Spec.md
 */

// Core types
export type {
	CLIProviderInfo,
	RoleCLIInvocationOptions,
	RoleCLIResult,
	CLIActivityEvent,
	CLIActivityEventType,
} from './types';
export { STDIN_SEPARATOR, splitStdinContent, buildStdinContent } from './types';

// Provider interface & registry
export type { RoleCLIProvider } from './roleCLIProvider';
export {
	registerRoleCLIProvider,
	getRoleCLIProvider,
	getAllRoleCLIProviders,
	detectAllCLIProviders,
	clearRoleCLIRegistry,
} from './roleCLIProvider';

// Provider implementations
export { ClaudeCodeRoleCLIProvider } from './providers/claudeCode';
export { GeminiCLIProvider } from './providers/geminiCli';
export { CodexCLIProvider } from './providers/codexCli';


// Fallback adapter
export { LLMProviderAdapter } from './llmProviderAdapter';

// Provider resolver
export { resolveProviderForRole } from './providerResolver';
