/**
 * CLV loader — populates the canonical_vocabulary table with v1 entries.
 *
 * Idempotent: running again skips entries that already exist. Lint is run
 * before load; if any finding exists, the load aborts.
 *
 * Per Wave 1 §1.1: "Initial migration loads all v1 entries."
 */

import type { ClvDal } from '../database/clvDal.js';
import { CLV_V1_ENTRIES } from './entries/index.js';
import { lintEntries, type LintFinding } from './lint.js';

export interface LoadResult {
  inserted: number;
  skipped: number;
  lintFindings: LintFinding[];
}

export function loadCLVv1(clvDal: ClvDal): LoadResult {
  const findings = lintEntries(CLV_V1_ENTRIES);
  if (findings.length > 0) {
    return { inserted: 0, skipped: 0, lintFindings: findings };
  }
  const { inserted, skipped } = clvDal.loadIfMissing(CLV_V1_ENTRIES);
  return { inserted, skipped, lintFindings: [] };
}
