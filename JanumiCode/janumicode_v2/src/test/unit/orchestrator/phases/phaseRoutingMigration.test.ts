/**
 * Regression tests pinning the migration of Phase 3-9 LLM call sites
 * away from hardcoded `provider: 'ollama'` / `model: 'qwen3.5:9b'`
 * toward `engine.callForRole(...)`.
 *
 * Background:
 *   The cal-22 calibration loop migrated from Ollama to a llama-swap
 *   proxy fronting llama.cpp. Per-role LLM routing lives in
 *   `llm_routing.<role>.primary` so the same code can be retargeted
 *   without edits. We discovered Phase 3, 4, 5, 6, 7, and 8 each had
 *   call sites that bypassed routing with a hardcoded
 *   `provider: 'ollama', model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b'`
 *   payload — every one of which silently spun up an ollama process
 *   on the user's machine even when the rest of the workflow had
 *   moved off Ollama. The fix routes them all through
 *   `engine.callForRole('requirements_agent', ...)`.
 *
 * The bug class is structural ("forgot to delete a hardcoded provider
 * fallback") so the most direct guard is a static scan of each phase's
 * source file. If a future change reintroduces a hardcoded provider in
 * any of these files, the test fires immediately — well before the
 * mistake escapes to a live calibration run.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const PHASES_DIR = path.resolve(PROJECT_ROOT, 'src', 'lib', 'orchestrator', 'phases');

// Phases whose LLM calls should go via callForRole, not direct
// llmCaller.call with a hardcoded provider. Phase 1 + 2 are excluded
// because they have legitimate non-routing call sites for
// product-intake and decomposition lenses respectively.
const ROUTED_PHASES = ['phase3.ts', 'phase4.ts', 'phase5.ts', 'phase6.ts', 'phase7.ts', 'phase8.ts'];

describe('phase 3-8 LLM call sites — no hardcoded provider fallbacks', () => {
  for (const phaseFile of ROUTED_PHASES) {
    const filePath = path.resolve(PHASES_DIR, phaseFile);

    it(`${phaseFile} contains no hardcoded provider: 'ollama' fallback`, () => {
      const src = fs.readFileSync(filePath, 'utf8');
      // Match `provider: 'ollama'` and `provider: "ollama"` (any
      // whitespace). This is the exact pattern the bug took before
      // migration; flagging any reintroduction is intentional.
      expect(src, `${phaseFile} reintroduced hardcoded ollama provider`).not.toMatch(
        /provider\s*:\s*['"]ollama['"]/,
      );
    });

    it(`${phaseFile} contains no JANUMICODE_DEV_MODEL fallback in LLM payloads`, () => {
      // The bug shipped as `model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b'`.
      // No phase code should be reading this env var — model selection
      // belongs to llm_routing config + callForRole.
      const src = fs.readFileSync(filePath, 'utf8');
      expect(src, `${phaseFile} reintroduced JANUMICODE_DEV_MODEL fallback`).not.toMatch(
        /JANUMICODE_DEV_MODEL/,
      );
    });

    it(`${phaseFile} routes its LLM calls through engine.callForRole(...)`, () => {
      // Pass-to-pass: every routed phase must invoke callForRole at
      // least once. Catches the inverse regression where someone
      // replaces a routed call with a direct llmCaller.call but forgets
      // to wire it up to a role.
      const src = fs.readFileSync(filePath, 'utf8');
      expect(src, `${phaseFile} no longer uses callForRole`).toMatch(
        /\bengine\.callForRole\s*\(/,
      );
    });
  }
});

describe('NarrativeMemoryGenerator — provider/model from llm_routing', () => {
  const enginePath = path.resolve(PROJECT_ROOT, 'src', 'lib', 'orchestrator', 'orchestratorEngine.ts');
  const src = fs.readFileSync(enginePath, 'utf8');

  it('NarrativeMemoryGenerator construction does not hardcode provider: ollama', () => {
    // The construction site spans roughly 8 lines. Match the
    // statement, then assert the literal hardcoded provider/model
    // strings are not present. A future regression that reintroduces
    // them fires here.
    const ctorPattern = /new\s+NarrativeMemoryGenerator\([\s\S]*?\)\s*;/m;
    const match = src.match(ctorPattern);
    expect(match, 'NarrativeMemoryGenerator construction not found').not.toBeNull();
    const block = match![0];
    expect(block, 'NarrativeMemoryGenerator hardcoded ollama provider regressed').not.toMatch(
      /provider\s*:\s*['"]ollama['"]/,
    );
    expect(block, 'NarrativeMemoryGenerator hardcoded qwen3.5:9b model regressed').not.toMatch(
      /model\s*:\s*['"]qwen3\.5:9b['"]/,
    );
  });

  it('NarrativeMemoryGenerator pulls provider/model/baseUrl from llm_routing', () => {
    // The config object passed to the constructor must reference
    // values from configManager.getLLMRouting() (the requirements_agent
    // primary, since narrative-memory generation is requirements-flavoured
    // summarization). Matches the value field, not the property name,
    // so renames of the config field still pass.
    const ctorPattern = /new\s+NarrativeMemoryGenerator\([\s\S]*?\)\s*;/m;
    const block = src.match(ctorPattern)![0];
    // Should reference the routing object — most direct fingerprint is
    // `getLLMRouting()` somewhere in the surrounding statement, OR a
    // local variable that came from it.
    const surroundingPattern = /(const\s+\w+\s*=\s*this\.configManager\.getLLMRouting\(\)[\s\S]*?new\s+NarrativeMemoryGenerator\([\s\S]*?\)\s*;)/m;
    expect(src, 'NarrativeMemoryGenerator does not derive config from getLLMRouting()').toMatch(
      surroundingPattern,
    );
    // And the baseUrl must be threaded in (the llama-swap pivot needed
    // base_url passthrough; if a refactor drops it, the run silently
    // falls back to localhost:11434 — the original ollama default).
    expect(block, 'NarrativeMemoryGenerator dropped baseUrl threading').toMatch(
      /baseUrl\s*:/,
    );
  });
});
