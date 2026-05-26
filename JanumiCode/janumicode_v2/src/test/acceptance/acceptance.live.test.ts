/**
 * Acceptance live tests — one per LLM-bearing phase boundary.
 *
 * Each test:
 *   1. Loads a regression fixture as synthetic input
 *   2. Renders the CURRENT prompt template
 *   3. Issues a live Ollama call (same provider/model the orchestrator uses)
 *   4. Parses the response as JSON
 *   5. Validates the output against the corresponding ContractSuite
 *
 * Retry policy: each boundary gets up to 2 attempts. If the first
 * attempt fails (LLM error, JSON parse failure, or blocking contract
 * violation) the harness retries once. Standard CI flake-suppression
 * pattern — large thinking models (gpt-oss:20b and similar) exhibit
 * transient output variance that doesn't reflect structural bugs.
 * Failures that persist across BOTH attempts are the structural ones
 * we actually want to surface.
 *
 * Pass: any attempt's blocking failures = 0, parsed JSON, no LLM error.
 * Fail: all attempts failed.
 *
 * Distinct from live regression in two ways:
 *   - No baseline comparison; the contract is the standard.
 *   - Prompt edits that correctly improve output PASS immediately
 *     (live regression fails until rebaselined).
 *
 * Ollama-gated: the suite no-ops with a clear skip message when
 * Ollama is unreachable, so a missing local model doesn't break
 * `pnpm test` for contributors who haven't started the daemon.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ACCEPTANCE_SPECS } from './registry';
import {
  runAcceptanceTestWithRetry,
  formatAcceptanceOutcome,
} from './runner';
import { ensureOllamaReachable } from '../regression/ollamaPrecheck';

const projectRoot = process.cwd();

let ollamaAvailable = true;
let ollamaProbeError: string | undefined;

beforeAll(async () => {
  try {
    await ensureOllamaReachable();
  } catch (err) {
    ollamaAvailable = false;
    ollamaProbeError = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `\n[acceptance] Ollama unreachable — all acceptance tests will be skipped.\n` +
      `[acceptance] Reason: ${ollamaProbeError}\n` +
      `[acceptance] To run acceptance tests, start Ollama and ensure JANUMICODE_OLLAMA_BASE_URL (or OLLAMA_BASE_URL) points at it.\n\n`,
    );
  }
});

describe('Acceptance — prompt + live LLM → contract conformance', () => {
  for (const spec of ACCEPTANCE_SPECS) {
    it(`${spec.contractBoundaryId} produces a contract-conformant output`, async () => {
      if (!ollamaAvailable) {
        // Skip cleanly without failing the suite when Ollama isn't running.
        return;
      }

      const outcome = await runAcceptanceTestWithRetry(spec, projectRoot);
      const { final, attempts, recoveredOnRetry } = outcome;

      // Surface retry recovery as a visible signal — it's important
      // diagnostic info (some boundaries flake more than others) even
      // when the test technically passes.
      if (recoveredOnRetry) {
        process.stderr.write(
          `\n[acceptance · ${spec.contractBoundaryId}] PASSED on attempt ${attempts.length} (first attempt failed transiently)\n`,
        );
      }

      const stillFailing = final.blockingFailures > 0
        || !final.parsedOk
        || !final.templateFound
        || final.llmError !== undefined;

      if (stillFailing) {
        // Both attempts failed — emit a multi-attempt report.
        const report = formatAcceptanceOutcome(outcome);
        expect.fail(report);
      }

      // Advisories from the successful (final) attempt: surface in
      // stderr but don't fail the test.
      if (final.advisoryFailures > 0) {
        const advisories = final.contractResults
          .filter((r) => !r.passed && r.severity === 'advisory')
          .map((r) => `  [${r.clauseId}] ${r.message ?? r.clauseDescription}`)
          .join('\n');
        process.stderr.write(
          `\n[acceptance · ${spec.contractBoundaryId}] ${final.advisoryFailures} advisory finding(s):\n${advisories}\n`,
        );
      }

      expect(final.blockingFailures).toBe(0);
    });
  }
});
