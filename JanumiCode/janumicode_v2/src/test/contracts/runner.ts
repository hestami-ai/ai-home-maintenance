/**
 * Contract harness — runner.
 *
 * Executes a ContractSuite against an artifact and a ContractContext,
 * producing one ContractResult per clause. Pure and side-effect free.
 */

import type {
  ContractClause,
  ContractContext,
  ContractResult,
  ContractSuite,
  ContractSummary,
} from './types';

export function runContractSuite<TArtifact>(
  suite: ContractSuite<TArtifact>,
  artifact: TArtifact,
  context: ContractContext,
): ContractResult[] {
  return suite.clauses.map((clause) => evaluateClause(suite.boundaryId, clause, artifact, context));
}

export function summarize(results: ReadonlyArray<ContractResult>): ContractSummary {
  let passed = 0;
  let blockingFailures = 0;
  let advisoryFailures = 0;
  for (const r of results) {
    if (r.passed) {
      passed++;
    } else if (r.severity === 'blocking') {
      blockingFailures++;
    } else {
      advisoryFailures++;
    }
  }
  return { total: results.length, passed, blockingFailures, advisoryFailures };
}

/** Group results by boundary id for reporting. */
export function groupByBoundary(
  results: ReadonlyArray<ContractResult>,
): Map<string, ContractResult[]> {
  const out = new Map<string, ContractResult[]>();
  for (const r of results) {
    const existing = out.get(r.boundaryId);
    if (existing) existing.push(r);
    else out.set(r.boundaryId, [r]);
  }
  return out;
}

function evaluateClause<TArtifact>(
  boundaryId: string,
  clause: ContractClause<TArtifact>,
  artifact: TArtifact,
  context: ContractContext,
): ContractResult {
  try {
    const outcome = clause.check(artifact, context);
    if (outcome === true) {
      return {
        boundaryId,
        clauseId: clause.id,
        clauseDescription: clause.description,
        severity: clause.severity,
        passed: true,
      };
    }
    return {
      boundaryId,
      clauseId: clause.id,
      clauseDescription: clause.description,
      severity: clause.severity,
      passed: false,
      message: outcome.message,
      details: outcome.details,
    };
  } catch (err) {
    // A clause that throws is treated as a blocking failure. The
    // exception message is preserved so the diagnostic report can
    // surface "clause errored" distinctly from "clause asserted fail".
    return {
      boundaryId,
      clauseId: clause.id,
      clauseDescription: clause.description,
      severity: 'blocking',
      passed: false,
      message: `clause threw: ${err instanceof Error ? err.message : String(err)}`,
      details: err,
    };
  }
}
