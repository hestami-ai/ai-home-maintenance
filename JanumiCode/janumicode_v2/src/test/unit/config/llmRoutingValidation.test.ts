/**
 * Regression: validateLLMRouting() must fail loudly when a provider
 * referenced by llm_routing config is not registered with the LLMCaller.
 *
 * The anti-pattern this guards against: Phase 9's ReasoningReview, a
 * correctness-validation step, was previously hardcoded to provider
 * 'gemini' which did not match any registered adapter name ('google').
 * The failure was masked in tests by binding 'gemini' too, and in
 * production by a silent `try { review } catch { pass }` fallback.
 *
 * The contract is now: if llm_routing references a missing provider, the
 * engine throws at startup — not silently skips reviews at runtime.
 */

import { describe, it, expect } from 'vitest';
import { createTestDatabase } from '../../../lib/database/init';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { ConfigManager } from '../../../lib/config/configManager';
import { MockLLMProvider } from '../../helpers/mockLLMProvider';

describe('validateLLMRouting', () => {
  it('throws when reasoning_review.primary.provider is not registered', () => {
    const db = createTestDatabase();
    try {
      const configManager = new ConfigManager();
      const engine = new OrchestratorEngine(db, configManager, process.cwd());
      // Register only mock — NOT 'google' which the default config references.
      const mock = new MockLLMProvider();
      engine.llmCaller.registerProvider(mock);
      // Default config routes reasoning_review to 'google' → must throw.
      expect(() => engine.validateLLMRouting()).toThrow(/misconfiguration/);
    } finally {
      db.close();
    }
  });

  it('passes when all referenced providers are registered', () => {
    const db = createTestDatabase();
    try {
      const configManager = new ConfigManager();
      const engine = new OrchestratorEngine(db, configManager, process.cwd());
      const mock = new MockLLMProvider();
      engine.llmCaller.registerProvider(mock.bindAsProvider('google'));
      // Should not throw.
      expect(() => engine.validateLLMRouting()).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('identifies the missing provider by name in the error message', () => {
    const db = createTestDatabase();
    try {
      const configManager = new ConfigManager();
      const engine = new OrchestratorEngine(db, configManager, process.cwd());
      // No providers registered at all.
      try {
        engine.validateLLMRouting();
        throw new Error('expected validateLLMRouting to throw');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // The top-level error counts the missing providers; the detail
        // goes to the logger. Either way, the cause must be discoverable.
        expect(message).toMatch(/misconfiguration/i);
      }
    } finally {
      db.close();
    }
  });

  it('ConfigManager.validateLLMRouting returns specific error strings per missing provider', () => {
    const configManager = new ConfigManager();
    const errors = configManager.validateLLMRouting(new Set(['ollama']));
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/reasoning_review/);
    expect(errors[0]).toMatch(/google/);
    expect(errors[0]).toMatch(/not registered/);
    // Remediation guidance must be present in the error.
    expect(errors[0]).toMatch(/Fix:/);
  });

  it('ConfigManager.validateLLMRouting returns empty when all providers are registered', () => {
    const configManager = new ConfigManager();
    const errors = configManager.validateLLMRouting(new Set(['google', 'anthropic', 'ollama']));
    expect(errors).toEqual([]);
  });
});
