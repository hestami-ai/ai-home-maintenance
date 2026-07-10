/**
 * Contract for Phase 10.1 — pre_commit_consistency_check
 * (artifact kind: `consistency_report`).
 *
 * Last-gate check before commit. Records any unresolved findings the
 * run produced and whether they're blocking commit.
 */

import type { ContractSuite } from './types';

export interface ConsistencyFinding {
  id?: string;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW' | (string & {});
  description: string;
  source_record_id?: string;
}

export interface ConsistencyReportArtifact {
  kind: 'consistency_report';
  status?: 'pass' | 'block' | 'warn';
  findings?: ConsistencyFinding[];
  high_count?: number;
  medium_count?: number;
  low_count?: number;
}

const VALID_STATUSES = new Set<string>(['pass', 'block', 'warn']);

export const phase10PreCommitConsistencyCheckContract: ContractSuite<ConsistencyReportArtifact> = {
  boundaryId: '10.1_pre_commit_consistency_check',
  phaseId: '10',
  subPhaseId: 'pre_commit_consistency_check',
  producerArtifactKind: 'consistency_report',
  description:
    'Phase 10 pre-commit check — status declared; HIGH findings block commit.',
  clauses: [
    {
      id: 'C-10.1.1',
      description: 'status is one of pass/block/warn.',
      severity: 'blocking',
      check: (a) => {
        if (!a.status) return { message: 'status is missing' };
        if (!VALID_STATUSES.has(a.status)) {
          return { message: `unknown status: "${a.status}"`, details: { valid: [...VALID_STATUSES] } };
        }
        return true;
      },
    },
    {
      id: 'C-10.1.2',
      description: 'When any finding has severity=HIGH, status must be block.',
      severity: 'blocking',
      check: (a) => {
        const hasHigh = (a.findings ?? []).some((f) => f.severity === 'HIGH') || (a.high_count ?? 0) > 0;
        if (!hasHigh) return true;
        if (a.status === 'block') return true;
        return { message: `HIGH finding(s) present but status="${a.status}" (should be "block")` };
      },
    },
    {
      id: 'C-10.1.3',
      description: 'Every finding has a non-empty description.',
      severity: 'blocking',
      check: (a) => {
        const bad = (a.findings ?? []).filter((f) => !f.description || f.description.trim().length === 0).length;
        if (bad === 0) return true;
        return { message: `${bad} finding(s) have empty description` };
      },
    },
    {
      id: 'C-10.1.4',
      description: 'When findings array is populated, severity counts (when present) reconcile.',
      severity: 'advisory',
      check: (a) => {
        const findings = a.findings ?? [];
        if (findings.length === 0) return true;
        if (a.high_count === undefined && a.medium_count === undefined && a.low_count === undefined) return true;
        const actual = { H: 0, M: 0, L: 0 };
        for (const f of findings) {
          if (f.severity === 'HIGH') actual.H++;
          else if (f.severity === 'MEDIUM') actual.M++;
          else if (f.severity === 'LOW') actual.L++;
        }
        const mismatches: string[] = [];
        if (a.high_count !== undefined && a.high_count !== actual.H) mismatches.push(`high_count=${a.high_count} vs actual=${actual.H}`);
        if (a.medium_count !== undefined && a.medium_count !== actual.M) mismatches.push(`medium_count=${a.medium_count} vs actual=${actual.M}`);
        if (a.low_count !== undefined && a.low_count !== actual.L) mismatches.push(`low_count=${a.low_count} vs actual=${actual.L}`);
        if (mismatches.length === 0) return true;
        return { message: `count mismatch: ${mismatches.join('; ')}` };
      },
    },
  ],
};
