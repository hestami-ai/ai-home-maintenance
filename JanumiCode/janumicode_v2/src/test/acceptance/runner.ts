/**
 * Acceptance harness runner.
 *
 * For each LLM-bearing phase boundary:
 *   1. Load a regression fixture (synthetic, contract-correct input)
 *   2. Render the CURRENT prompt template with that input
 *   3. Issue a live Ollama call
 *   4. Parse the response as JSON
 *   5. Run the boundary's ContractSuite against the parsed output
 *
 * Pass/fail criterion is the contract — NOT a captured baseline.
 *
 * Distinct from existing layers:
 *   - Contract forward tests: fixture → contract (no LLM).
 *   - Regression deterministic: replayed baseline (no LLM).
 *   - Live regression: response ≈ captured baseline (drifts when prompt is edited).
 *   - Acceptance: response → contract (structural standard; no baseline).
 *
 * See docs/design/contract-harness-stage1b-design-positions.md for the
 * structural rules each contract enforces.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { renderFromFixture, invokeFromFixture } from '../regression/runner';
import { loadFixture } from '../regression/loadFixtures';
import { runContractSuite, summarize } from '../contracts/runner';
import type { ContractContext, ContractResult, ContractSuite } from '../contracts/types';
import { findSuite } from '../contracts/registry';
import type { Fixture } from '../regression/fixtureSchema';
import { emit as aoddEmit } from '../../lib/aodd';

export interface AcceptanceTestSpec {
  /** Path to the regression fixture (synthetic input). Relative to project root. */
  fixturePath: string;
  /** Boundary id in the contract registry (e.g. "4.2_component_skeleton"). */
  contractBoundaryId: string;
  /**
   * Other regression fixtures whose `baseline.parsed_json` should be
   * loaded into the contract's `relatedArtifacts` map. The contract
   * uses these for cross-artifact reference resolution (e.g. validating
   * that every US-* in component.traces_to resolves in
   * functional_requirements).
   */
  relatedArtifactFixtures?: string[];
  /**
   * Optional override for the artifact kind to register a related
   * fixture under. By default the kind is read from
   * `baseline.parsed_json.kind`.
   */
  relatedArtifactKindOverride?: Record<string, string>;
  /**
   * Optional key to extract from the parsed LLM response before
   * validating against the contract. Used when one LLM call produces
   * a wrapper object containing multiple sibling artifacts. For
   * example, Phase 8.1's prompt emits a single response with three
   * child plans (functional / quality / reasoning); the 8.1 contract
   * validates only the functional plan, so we extract
   * `functional_evaluation_plan` here.
   *
   * When set, the value at parsed[extractInnerKey] is passed to the
   * contract instead of the full parsed response.
   */
  extractInnerKey?: string;
}

export interface AcceptanceResult {
  boundaryId: string;
  fixturePath: string;
  templateFound: boolean;
  missingVariables: string[];
  llmInvoked: boolean;
  llmError?: string;
  parsedOk: boolean;
  responseSnippet: string;
  /**
   * Top-level keys of the parsed response, captured for failure
   * triage. When the contract fails because the LLM emitted a
   * different root structure than expected, this is the fastest
   * signal of what shape it actually produced.
   */
  parsedTopLevelKeys?: string[];
  contractResults: ContractResult[];
  blockingFailures: number;
  advisoryFailures: number;
  durationMs: number;
}

/**
 * Aggregated result from a retry-aware acceptance run. Carries the
 * final outcome plus the per-attempt history so the failure report
 * can distinguish "transient — passed on retry" from "structural —
 * failed every attempt".
 */
export interface AcceptanceRunOutcome {
  /** Final result from the last attempt (used to decide test pass/fail). */
  final: AcceptanceResult;
  /** All attempt results in order (length 1 if no retry was needed). */
  attempts: AcceptanceResult[];
  /** Convenience: was the first attempt a failure that retry rescued? */
  recoveredOnRetry: boolean;
}

/** Determines whether a single attempt result counts as a failure. */
export function isAttemptFailure(r: AcceptanceResult): boolean {
  if (!r.templateFound) return true;
  if (r.llmError) return true;
  if (!r.parsedOk) return true;
  if (r.blockingFailures > 0) return true;
  return false;
}

function readRelatedArtifacts(
  spec: AcceptanceTestSpec,
  projectRoot: string,
): Map<string, ReadonlyArray<unknown>> {
  const out = new Map<string, unknown[]>();
  for (const relFixturePath of spec.relatedArtifactFixtures ?? []) {
    const absPath = path.resolve(projectRoot, relFixturePath);
    if (!fs.existsSync(absPath)) continue;
    let parsed: { kind?: string } & Record<string, unknown>;
    try {
      const raw = JSON.parse(fs.readFileSync(absPath, 'utf8')) as { baseline?: { parsed_json?: unknown } };
      const candidate = raw.baseline?.parsed_json;
      if (!candidate || typeof candidate !== 'object') continue;
      parsed = candidate as typeof parsed;
    } catch {
      continue;
    }
    const kind = spec.relatedArtifactKindOverride?.[relFixturePath]
      ?? (typeof parsed.kind === 'string' ? parsed.kind : undefined);
    if (!kind) continue;
    const arr = out.get(kind) ?? [];
    arr.push(parsed);
    out.set(kind, arr);
  }
  return new Map([...out.entries()].map(([k, v]) => [k, v as ReadonlyArray<unknown>]));
}

export async function runAcceptanceTest(
  spec: AcceptanceTestSpec,
  projectRoot: string = process.cwd(),
): Promise<AcceptanceResult> {
  const started = Date.now();

  const suite: ContractSuite<unknown> | undefined = findSuite(spec.contractBoundaryId);
  if (!suite) {
    throw new Error(`No contract suite registered for boundaryId="${spec.contractBoundaryId}"`);
  }

  const fixture: Fixture = loadFixture(path.resolve(projectRoot, spec.fixturePath));

  // 1+2: render prompt with synthetic input.
  const renderResult = renderFromFixture(fixture);
  if (!renderResult.template_found) {
    return {
      boundaryId: spec.contractBoundaryId,
      fixturePath: spec.fixturePath,
      templateFound: false,
      missingVariables: [],
      llmInvoked: false,
      parsedOk: false,
      responseSnippet: '',
      contractResults: [],
      blockingFailures: 1,
      advisoryFailures: 0,
      durationMs: Date.now() - started,
    };
  }

  // 3: live LLM call.
  let parsed: unknown | null = null;
  let responseText = '';
  let llmError: string | undefined;
  try {
    const r = await invokeFromFixture(fixture, renderResult.rendered);
    parsed = r.fresh_parsed_json;
    responseText = r.fresh_response_text;
  } catch (err) {
    llmError = err instanceof Error ? err.message : String(err);
  }

  if (llmError) {
    return {
      boundaryId: spec.contractBoundaryId,
      fixturePath: spec.fixturePath,
      templateFound: true,
      missingVariables: renderResult.missingVariables,
      llmInvoked: false,
      llmError,
      parsedOk: false,
      responseSnippet: '',
      contractResults: [],
      blockingFailures: 1,
      advisoryFailures: 0,
      durationMs: Date.now() - started,
    };
  }

  // 4: parse check.
  if (parsed === null || typeof parsed !== 'object') {
    // Dump full raw response for triage. The 300-char snippet is
    // ambiguous between mid-string truncation and trailing prose
    // (e.g. thinking-mode leakage). Persisting the full response
    // makes the diagnostic re-readable after the test exits.
    try {
      const slug = spec.contractBoundaryId.replace(/[^a-z0-9-_]/gi, '_');
      const dumpPath = path.resolve(projectRoot, `.tmp/acceptance-raw-${slug}.txt`);
      fs.mkdirSync(path.dirname(dumpPath), { recursive: true });
      fs.writeFileSync(dumpPath, responseText);
      // AODD: link the raw dump to the current run (if one is active).
      // The acceptance suite usually runs inside a vitest process with
      // an AODD run set up by the test harness; emit is a no-op when
      // no run is active.
      aoddEmit('context.detail_file_written', {
        path: dumpPath,
        bytes: Buffer.byteLength(responseText, 'utf-8'),
      });
    } catch {
      // best-effort — don't let dump failure mask the original problem
    }
    return {
      boundaryId: spec.contractBoundaryId,
      fixturePath: spec.fixturePath,
      templateFound: true,
      missingVariables: renderResult.missingVariables,
      llmInvoked: true,
      parsedOk: false,
      responseSnippet: responseText.slice(0, 300),
      contractResults: [],
      blockingFailures: 1,
      advisoryFailures: 0,
      durationMs: Date.now() - started,
    };
  }

  // 5: contract validation.
  // When extractInnerKey is set, the parsed response is a wrapper
  // object containing multiple sibling artifacts. Pull the inner
  // artifact before passing to the contract.
  let toValidate: unknown = parsed;
  if (spec.extractInnerKey) {
    const wrapper = parsed as Record<string, unknown>;
    const inner = wrapper[spec.extractInnerKey];
    if (inner === undefined || inner === null) {
      return {
        boundaryId: spec.contractBoundaryId,
        fixturePath: spec.fixturePath,
        templateFound: true,
        missingVariables: renderResult.missingVariables,
        llmInvoked: true,
        parsedOk: true,
        responseSnippet: responseText.slice(0, 300),
        contractResults: [],
        blockingFailures: 1,
        advisoryFailures: 0,
        durationMs: Date.now() - started,
        llmError: `wrapper missing inner key "${spec.extractInnerKey}"`,
      };
    }
    toValidate = inner;
  }

  const relatedArtifacts = readRelatedArtifacts(spec, projectRoot);
  const context: ContractContext = {
    workflowRunId: 'acceptance-test',
    relatedArtifacts,
  };
  const contractResults = runContractSuite(suite, toValidate, context);
  const summary = summarize(contractResults);

  const parsedTopLevelKeys = parsed && typeof parsed === 'object'
    ? Object.keys(parsed as Record<string, unknown>)
    : undefined;

  return {
    boundaryId: spec.contractBoundaryId,
    fixturePath: spec.fixturePath,
    templateFound: true,
    missingVariables: renderResult.missingVariables,
    llmInvoked: true,
    parsedOk: true,
    responseSnippet: responseText.slice(0, 300),
    parsedTopLevelKeys,
    contractResults,
    blockingFailures: summary.blockingFailures,
    advisoryFailures: summary.advisoryFailures,
    durationMs: Date.now() - started,
  };
}

/**
 * Retry-aware wrapper around `runAcceptanceTest`.
 *
 * Background: gpt-oss:20b (and any sufficiently large thinking model)
 * exhibits transient output variance — occasional degenerate output
 * loops, mid-stream JSON parse failures, latency spikes. These are not
 * structural bugs; they're inherent properties of probabilistic
 * generation. A single retry catches the bulk of them; failures that
 * persist across both attempts are the structural ones we actually
 * want to fix.
 *
 * Standard CI flake-suppression pattern; cost is one extra LLM call
 * per transient failure.
 *
 * @param maxAttempts total attempts including the first (default 2 — try
 *                    once, retry once on failure).
 */
export async function runAcceptanceTestWithRetry(
  spec: AcceptanceTestSpec,
  projectRoot: string = process.cwd(),
  maxAttempts: number = 2,
): Promise<AcceptanceRunOutcome> {
  const attempts: AcceptanceResult[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await runAcceptanceTest(spec, projectRoot);
    attempts.push(result);
    if (!isAttemptFailure(result)) {
      return {
        final: result,
        attempts,
        recoveredOnRetry: attempts.length > 1,
      };
    }
    // Failed attempt; loop to retry if budget remains.
  }
  // All attempts failed.
  return {
    final: attempts[attempts.length - 1],
    attempts,
    recoveredOnRetry: false,
  };
}

export function formatAcceptanceFailure(result: AcceptanceResult): string {
  const lines: string[] = [];
  lines.push(`Acceptance failure for ${result.boundaryId} (${result.fixturePath})`);
  if (!result.templateFound) {
    lines.push('  ✖ Template not found');
    return lines.join('\n');
  }
  if (result.llmError) {
    lines.push(`  ✖ LLM error: ${result.llmError}`);
    return lines.join('\n');
  }
  if (!result.parsedOk) {
    lines.push('  ✖ Response did not parse as JSON');
    lines.push(`  Response snippet: ${result.responseSnippet}`);
    return lines.join('\n');
  }
  const blocking = result.contractResults.filter((r) => !r.passed && r.severity === 'blocking');
  const advisory = result.contractResults.filter((r) => !r.passed && r.severity === 'advisory');
  if (blocking.length > 0) {
    if (result.parsedTopLevelKeys) {
      lines.push(`  (parsed response top-level keys: ${result.parsedTopLevelKeys.join(', ')})`);
    }
    lines.push(`  ✖ ${blocking.length} blocking contract failure(s):`);
    for (const f of blocking) {
      lines.push(`    [${f.clauseId}] ${f.clauseDescription}`);
      if (f.message) lines.push(`      ${f.message}`);
    }
  }
  if (advisory.length > 0) {
    lines.push(`  ○ ${advisory.length} advisory finding(s) (test passes; surfaced for visibility):`);
    for (const f of advisory) {
      lines.push(`    [${f.clauseId}] ${f.message ?? f.clauseDescription}`);
    }
  }
  return lines.join('\n');
}

/**
 * Format the outcome of a retry-aware run. When every attempt failed,
 * surfaces each attempt's failure separately so the reader can see
 * whether the same structural problem repeated or whether each
 * attempt failed differently (which usually means the model is
 * unstable for this prompt rather than the prompt being wrong).
 */
export function formatAcceptanceOutcome(outcome: AcceptanceRunOutcome): string {
  if (!isAttemptFailure(outcome.final)) {
    // Successful — either first try or recovered. Caller normally
    // wouldn't call the formatter for a success case, but be useful.
    if (outcome.recoveredOnRetry) {
      return `Passed on attempt ${outcome.attempts.length} (first attempt failed transiently)`;
    }
    return `Passed on first attempt`;
  }
  const lines: string[] = [];
  lines.push(`Acceptance failure after ${outcome.attempts.length} attempt(s):`);
  outcome.attempts.forEach((r, idx) => {
    lines.push(``);
    lines.push(`── Attempt ${idx + 1}:`);
    const body = formatAcceptanceFailure(r).split('\n').slice(1).join('\n'); // drop header
    lines.push(body);
  });
  return lines.join('\n');
}
