/**
 * LLM Integration Module
 * Exports all LLM-related functionality
 * Phase 4: LLM Integration & Provider Abstraction
 */

// Provider interface and types
export * from './provider';

// Token counting
export * from './tokenCounter';

// Provider implementations
export { ClaudeProvider } from './providers/claude';
export { OpenAIProvider } from './providers/openai';

// Provider factory and registry
export * from './providerFactory';

// Role manager
export * from './roleManager';
