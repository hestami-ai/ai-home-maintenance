/**
 * Contract for Phase 1.0a — intent_quality_check
 * (artifact kind: `intent_quality_check`).
 *
 * Pre-discovery gate: scores the raw intent across completeness,
 * consistency, and coherence dimensions, and assigns an overall_status
 * that downstream phases honor.
 *
 * IMPORTANT: each of the three findings arrays has a DIFFERENT shape
 * per the Phase 1.0a prompt schema (verified via the acceptance
 * harness). Earlier drafts of this contract treated them uniformly,
 * which produced false positives when consistency or coherence
 * arrays were populated.
 */

import type { ContractSuite } from './types';

export type IntentQualityFindingStatus = 'present' | 'absent' | 'partial' | 'unclear';
export type IntentQualityFindingSeverity = 'high' | 'medium' | 'low' | 'blocking' | 'warning';
export type IntentQualityOverallStatus =
  | 'pass' | 'block' | 'blocking' | 'requires_input' | 'needs_clarification' | (string & {});

export interface CompletenessFinding {
  field: string;
  status: IntentQualityFindingStatus | (string & {});
  severity: IntentQualityFindingSeverity | (string & {});
  explanation: string;
}

export interface ConsistencyFinding {
  elements_in_conflict: string[];
  explanation: string;
  severity: IntentQualityFindingSeverity | (string & {});
}

export interface CoherenceFinding {
  concern: string;
  explanation: string;
  severity: IntentQualityFindingSeverity | (string & {});
}

export interface IntentQualityCheckArtifact {
  kind?: 'intent_quality_check';
  completeness_findings?: CompletenessFinding[];
  consistency_findings?: ConsistencyFinding[];
  coherence_findings?: CoherenceFinding[];
  overall_status?: IntentQualityOverallStatus;
  system_proposal_offered_for?: string[];
}

const VALID_OVERALL_STATUSES = new Set<string>([
  'pass', 'block', 'blocking', 'requires_input', 'needs_clarification', 'warn',
]);
const VALID_COMPLETENESS_STATUSES = new Set<string>(['present', 'absent', 'partial', 'unclear']);

export const phase1IntentQualityCheckContract: ContractSuite<IntentQualityCheckArtifact> = {
  boundaryId: '1.0a_intent_quality_check',
  phaseId: '1',
  subPhaseId: 'intent_quality_check',
  producerArtifactKind: 'intent_quality_check',
  description:
    'Phase 1 intent quality check — per-dimension findings recorded; overall_status declared.',
  clauses: [
    {
      id: 'C-1.0a.1',
      description: 'overall_status is one of the recognized values.',
      severity: 'blocking',
      check: (a) => {
        if (!a.overall_status) return { message: 'overall_status is missing' };
        if (!VALID_OVERALL_STATUSES.has(a.overall_status)) {
          return {
            message: `unknown overall_status: "${a.overall_status}"`,
            details: { valid: [...VALID_OVERALL_STATUSES] },
          };
        }
        return true;
      },
    },
    {
      id: 'C-1.0a.2',
      description: 'completeness_findings covers all three required fields (what_is_being_built, who_it_serves, what_problem_it_solves).',
      severity: 'blocking',
      check: (a) => {
        const cf = a.completeness_findings ?? [];
        const required = ['what_is_being_built', 'who_it_serves', 'what_problem_it_solves'];
        const present = new Set(cf.map((f) => f.field));
        const missing = required.filter((r) => !present.has(r));
        if (missing.length === 0) return true;
        return { message: `completeness_findings missing required fields: ${missing.join(', ')}`, details: { missing } };
      },
    },
    {
      id: 'C-1.0a.3',
      description: 'Every completeness finding has field, status, severity, and explanation.',
      severity: 'blocking',
      check: (a) => {
        const bad: Array<{ field: string; missing: string[] }> = [];
        for (const f of a.completeness_findings ?? []) {
          const missing: string[] = [];
          if (!f.field) missing.push('field');
          if (!f.status) missing.push('status');
          if (!f.severity) missing.push('severity');
          if (!f.explanation || f.explanation.trim().length === 0) missing.push('explanation');
          if (missing.length) bad.push({ field: f.field || '(missing)', missing });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} completeness finding(s) have shape issues`, details: { bad } };
      },
    },
    {
      id: 'C-1.0a.4',
      description: 'Every consistency finding has elements_in_conflict[], explanation, and severity.',
      severity: 'blocking',
      check: (a) => {
        const bad: Array<{ idx: number; missing: string[] }> = [];
        (a.consistency_findings ?? []).forEach((f, idx) => {
          const missing: string[] = [];
          if (!Array.isArray(f.elements_in_conflict) || f.elements_in_conflict.length < 2) missing.push('elements_in_conflict');
          if (!f.explanation || f.explanation.trim().length === 0) missing.push('explanation');
          if (!f.severity) missing.push('severity');
          if (missing.length) bad.push({ idx, missing });
        });
        if (bad.length === 0) return true;
        return { message: `${bad.length} consistency finding(s) have shape issues`, details: { bad } };
      },
    },
    {
      id: 'C-1.0a.5',
      description: 'Every coherence finding has concern, explanation, and severity.',
      severity: 'blocking',
      check: (a) => {
        const bad: Array<{ idx: number; missing: string[] }> = [];
        (a.coherence_findings ?? []).forEach((f, idx) => {
          const missing: string[] = [];
          if (!f.concern || f.concern.trim().length === 0) missing.push('concern');
          if (!f.explanation || f.explanation.trim().length === 0) missing.push('explanation');
          if (!f.severity) missing.push('severity');
          if (missing.length) bad.push({ idx, missing });
        });
        if (bad.length === 0) return true;
        return { message: `${bad.length} coherence finding(s) have shape issues`, details: { bad } };
      },
    },
    {
      id: 'C-1.0a.6',
      description: 'Completeness finding statuses are one of present/absent/partial/unclear.',
      severity: 'advisory',
      check: (a) => {
        const bad = (a.completeness_findings ?? [])
          .filter((f) => f.status && !VALID_COMPLETENESS_STATUSES.has(f.status))
          .map((f) => ({ field: f.field, status: f.status }));
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} completeness finding(s) use unrecognized status`,
          details: { bad: bad.slice(0, 5) },
        };
      },
    },
    {
      id: 'C-1.0a.7',
      description: 'When overall_status=block/blocking, at least one finding has severity=blocking or high.',
      severity: 'blocking',
      check: (a) => {
        if (a.overall_status !== 'block' && a.overall_status !== 'blocking') return true;
        const all = [
          ...((a.completeness_findings ?? []) as Array<{ severity?: string }>),
          ...((a.consistency_findings ?? []) as Array<{ severity?: string }>),
          ...((a.coherence_findings ?? []) as Array<{ severity?: string }>),
        ];
        const hasSerious = all.some((f) => f.severity === 'blocking' || f.severity === 'high');
        if (hasSerious) return true;
        return { message: `overall_status=${a.overall_status} but no blocking/high-severity finding present` };
      },
    },
  ],
};
