/**
 * Assertion runner.
 *
 * Runs the assertion set of one gold matter against an "activation snapshot"
 * — a structured representation of the matter's expected outcomes. Wave 5
 * runs assertions against the gold matter's expected data itself (sanity
 * check). Wave 6+ feeds in real activation data from a live lens run.
 *
 * The runner emits per-assertion pass/fail and a regression report.
 */

import type { AssertionEntry, GoldMatter, HardGateMetrics, RegressionReport } from './types.js';

export interface AssertionResult {
  readonly assertionId: string;
  readonly status: 'pass' | 'fail';
  readonly reason?: string;
}

export interface SnapshotShape {
  /** Mirrors gold matter expected_lens_classification, completed_states, state_outputs, etc. */
  readonly [key: string]: unknown;
}

export class AssertionRunner {
  /** Build a default snapshot from a gold matter (Wave 5 pass-through). */
  static snapshotFromGoldMatter(g: GoldMatter): SnapshotShape {
    return {
      lens: g.expectedLensClassification,
      completed_states: g.requiredStates,
      required_states: g.requiredStates,
      state_outputs: g.stateOutputs,
      artifacts: g.artifacts,
      release_status: g.releaseStatuses ?? {},
      failure_traps: g.failureTraps,
      issue_prune: deriveIssuePruneSummary(g.stateOutputs),
      authority_verification: deriveAuthorityVerificationSummary(g.stateOutputs),
      direct_legal_conclusion: deriveDirectLegalConclusionSummary(g.stateOutputs),
      court_filing_draft: deriveFilingSummary(g.stateOutputs, g.releaseStatuses),
      client_advice_draft: deriveClientAdviceSummary(g.stateOutputs, g.releaseStatuses),
    };
  }

  run(snapshot: SnapshotShape, assertions: readonly AssertionEntry[]): AssertionResult[] {
    return assertions.map((a) => evaluate(a, snapshot));
  }
}

function evaluate(a: AssertionEntry, snapshot: SnapshotShape): AssertionResult {
  const actual = readPath(snapshot, a.target);
  switch (a.comparator) {
    case 'equals':
      return deepEqual(actual, a.expected)
        ? { assertionId: a.id, status: 'pass' }
        : { assertionId: a.id, status: 'fail', reason: `expected ${JSON.stringify(a.expected)} got ${JSON.stringify(actual)}` };
    case 'not_equals':
      return !deepEqual(actual, a.expected)
        ? { assertionId: a.id, status: 'pass' }
        : { assertionId: a.id, status: 'fail', reason: `expected NOT ${JSON.stringify(a.expected)}` };
    case 'contains': {
      if (Array.isArray(actual)) {
        return actual.some((v) => deepEqual(v, a.expected))
          ? { assertionId: a.id, status: 'pass' }
          : { assertionId: a.id, status: 'fail', reason: `array does not contain ${JSON.stringify(a.expected)}` };
      }
      if (typeof actual === 'string' && typeof a.expected === 'string') {
        return actual.includes(a.expected)
          ? { assertionId: a.id, status: 'pass' }
          : { assertionId: a.id, status: 'fail', reason: `string does not contain ${a.expected}` };
      }
      return { assertionId: a.id, status: 'fail', reason: `target is not array/string` };
    }
    case 'in': {
      if (Array.isArray(a.expected)) {
        return a.expected.some((v) => deepEqual(v, actual))
          ? { assertionId: a.id, status: 'pass' }
          : { assertionId: a.id, status: 'fail', reason: `value ${JSON.stringify(actual)} not in ${JSON.stringify(a.expected)}` };
      }
      return { assertionId: a.id, status: 'fail', reason: `expected must be an array for "in"` };
    }
    case 'gte':
      return typeof actual === 'number' && typeof a.expected === 'number' && actual >= a.expected
        ? { assertionId: a.id, status: 'pass' }
        : { assertionId: a.id, status: 'fail', reason: `expected >= ${a.expected as number} got ${String(actual)}` };
    case 'matches': {
      const pattern = String(a.expected);
      const re = new RegExp(pattern);
      return typeof actual === 'string' && re.test(actual)
        ? { assertionId: a.id, status: 'pass' }
        : { assertionId: a.id, status: 'fail', reason: `value ${String(actual)} does not match /${pattern}/` };
    }
    default:
      return { assertionId: a.id, status: 'fail', reason: `unknown comparator ${(a as { comparator: string }).comparator}` };
  }
}

function readPath(snapshot: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = snapshot;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    if (ak.length !== bk.length || !ak.every((k, i) => k === bk[i])) return false;
    return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

function getRecord(stateOutputs: Readonly<Record<string, unknown>>, suffix: string): Record<string, unknown> | undefined {
  const key = Object.keys(stateOutputs).find((k) => k.endsWith(suffix));
  if (!key) return undefined;
  const v = stateOutputs[key];
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

function deriveIssuePruneSummary(stateOutputs: Readonly<Record<string, unknown>>): { retained: string[]; removed: string[]; deferred: string[] } {
  const retained: string[] = [];
  const removed: string[] = [];
  const deferred: string[] = [];
  const out = getRecord(stateOutputs, 'issue_prune');
  const decisions = out?.pruning_decisions;
  if (Array.isArray(decisions)) {
    for (const d of decisions) {
      if (!d || typeof d !== 'object') continue;
      const o = d as Record<string, unknown>;
      const issue = String(o.issue ?? o.issue_id ?? '');
      switch (o.decision) {
        case 'retain':
          retained.push(issue);
          break;
        case 'remove':
          removed.push(issue);
          break;
        case 'defer':
          deferred.push(issue);
          break;
      }
    }
  }
  return { retained, removed, deferred };
}

function deriveAuthorityVerificationSummary(stateOutputs: Readonly<Record<string, unknown>>): { overall_authority_status: string } {
  const out = getRecord(stateOutputs, 'authority_verification');
  return { overall_authority_status: String(out?.overall_authority_status ?? 'machine_assessed_support') };
}

function deriveDirectLegalConclusionSummary(stateOutputs: Readonly<Record<string, unknown>>): { attorney_review_required: boolean } {
  const out = getRecord(stateOutputs, 'direct_legal_conclusion_draft');
  return { attorney_review_required: Boolean(out?.attorney_review_required ?? true) };
}

function deriveFilingSummary(stateOutputs: Readonly<Record<string, unknown>>, releaseStatuses: { [k: string]: string } | undefined): { filing_allowed: boolean } {
  if (releaseStatuses && releaseStatuses['draft_court_filing']) {
    return { filing_allowed: releaseStatuses['draft_court_filing'].startsWith('approved') };
  }
  return { filing_allowed: false };
}

function deriveClientAdviceSummary(stateOutputs: Readonly<Record<string, unknown>>, releaseStatuses: { [k: string]: string } | undefined): { external_send_allowed: boolean } {
  if (releaseStatuses && releaseStatuses['draft_client_advice_message']) {
    return { external_send_allowed: releaseStatuses['draft_client_advice_message'].startsWith('approved') };
  }
  return { external_send_allowed: false };
}

export function buildRegressionReport(args: {
  perGoldMatter: ReadonlyArray<{ testCaseId: string; results: readonly AssertionResult[]; assertions: readonly AssertionEntry[] }>;
  hardGateMetrics: HardGateMetrics;
}): RegressionReport {
  const perGoldMatter = args.perGoldMatter.map((g) => {
    const failures = g.results
      .filter((r) => r.status === 'fail')
      .map((r) => ({ assertionId: r.assertionId, reason: r.reason ?? '' }));
    return {
      testCaseId: g.testCaseId,
      status: failures.length === 0 ? ('pass' as const) : ('fail' as const),
      assertionsPassed: g.results.filter((r) => r.status === 'pass').length,
      assertionsFailed: failures.length,
      failures,
    };
  });

  const breaches = computeHardGateBreaches(args.hardGateMetrics);

  return {
    producedAt: new Date().toISOString(),
    goldSetSize: args.perGoldMatter.length,
    passed: perGoldMatter.filter((g) => g.status === 'pass').length,
    failed: perGoldMatter.filter((g) => g.status === 'fail').length,
    perGoldMatter,
    hardGateMetrics: args.hardGateMetrics,
    hardGateBreaches: breaches,
  };
}

export function computeHardGateBreaches(m: HardGateMetrics): string[] {
  const b: string[] = [];
  if (m.requiredStateCompletionRate < 1) b.push(`requiredStateCompletionRate=${m.requiredStateCompletionRate} (must be 1.0)`);
  if (m.issueBloomLateAdditionRate > 0) b.push(`issueBloomLateAdditionRate=${m.issueBloomLateAdditionRate} (must be 0)`);
  if (m.silentPruningRate > 0) b.push(`silentPruningRate=${m.silentPruningRate} (must be 0)`);
  if (m.falseConfidenceRate > 0) b.push(`falseConfidenceRate=${m.falseConfidenceRate} (must be 0)`);
  if (m.crossMatterLeakageBytes > 0) b.push(`crossMatterLeakageBytes=${m.crossMatterLeakageBytes} (must be 0)`);
  if (m.releaseGateCorrectness < 1) b.push(`releaseGateCorrectness=${m.releaseGateCorrectness} (must be 1.0)`);
  return b;
}
