/**
 * Regression delta — compare two regression reports.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 9 §9.1:
 *   "Regression delta reporting per lens version."
 */

import type { RegressionReport } from './types.js';

export interface RegressionDelta {
  readonly fromProducedAt: string;
  readonly toProducedAt: string;
  readonly newlyFailing: readonly string[];
  readonly newlyPassing: readonly string[];
  readonly unchanged: readonly string[];
  readonly netRegression: number; // newlyFailing - newlyPassing
}

export function diffRegression(prev: RegressionReport, curr: RegressionReport): RegressionDelta {
  const prevById = new Map(prev.perGoldMatter.map((g) => [g.testCaseId, g.status]));
  const currById = new Map(curr.perGoldMatter.map((g) => [g.testCaseId, g.status]));
  const newlyFailing: string[] = [];
  const newlyPassing: string[] = [];
  const unchanged: string[] = [];
  const ids = new Set<string>([...prevById.keys(), ...currById.keys()]);
  for (const id of ids) {
    const p = prevById.get(id);
    const c = currById.get(id);
    if (p === c) unchanged.push(id);
    else if (p === 'pass' && c === 'fail') newlyFailing.push(id);
    else if (p === 'fail' && c === 'pass') newlyPassing.push(id);
  }
  return {
    fromProducedAt: prev.producedAt,
    toProducedAt: curr.producedAt,
    newlyFailing,
    newlyPassing,
    unchanged,
    netRegression: newlyFailing.length - newlyPassing.length,
  };
}
