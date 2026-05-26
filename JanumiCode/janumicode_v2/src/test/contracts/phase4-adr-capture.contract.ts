/**
 * Contract for Phase 4.3 — adr_capture (artifact kind: `architectural_decisions`).
 *
 * ADRs are surfaced verbatim in Phase 6's task context and Phase 9's
 * stdin directive. Each ADR must have id + title + decision text.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface Adr {
  id: string;
  title: string;
  decision: string;
  rationale?: string;
  status?: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
}

export interface ArchitecturalDecisionsArtifact {
  kind: 'architectural_decisions';
  adrs: Adr[];
}

// ── Contract suite ───────────────────────────────────────────────

const ADR_ID_PATTERN = /^ADR-/;

export const phase4AdrCaptureContract: ContractSuite<ArchitecturalDecisionsArtifact> = {
  boundaryId: '4.3_adr_capture',
  phaseId: '4',
  subPhaseId: 'adr_capture',
  producerArtifactKind: 'architectural_decisions',
  description: 'Phase 4 ADRs — each ADR has ADR-* id, title, and decision text.',
  clauses: [
    {
      id: 'C-4.3.1',
      description: 'architectural_decisions.adrs is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.adrs) || artifact.adrs.length === 0) {
          return { message: 'adrs is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-4.3.2',
      description: 'Every ADR has an ADR-* id, unique within the artifact.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const a of artifact.adrs) {
          if (!a.id || !ADR_ID_PATTERN.test(a.id)) { bad.push(a.id || '(missing)'); continue; }
          counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
        }
        const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        if (bad.length === 0 && dups.length === 0) return true;
        const parts: string[] = [];
        if (bad.length) parts.push(`${bad.length} malformed id(s)`);
        if (dups.length) parts.push(`duplicates: ${dups.join(', ')}`);
        return { message: parts.join('; '), details: { bad, dups } };
      },
    },
    {
      id: 'C-4.3.3',
      description: 'Every ADR has non-empty title and decision text.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ id: string; missing: string[] }> = [];
        for (const a of artifact.adrs) {
          const missing: string[] = [];
          if (!a.title || a.title.trim().length === 0) missing.push('title');
          if (!a.decision || a.decision.trim().length === 0) missing.push('decision');
          if (missing.length) bad.push({ id: a.id, missing });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} ADR(s) missing title/decision`, details: { bad } };
      },
    },
    {
      id: 'C-4.3.4',
      description: 'No ADR has status="superseded" without a corresponding successor (advisory hygiene check).',
      severity: 'advisory',
      check: (artifact) => {
        const lonely = artifact.adrs
          .filter((a) => a.status === 'superseded')
          .filter((a) => !a.rationale || !/superseded by|replaced by/i.test(a.rationale))
          .map((a) => a.id);
        if (lonely.length === 0) return true;
        return {
          message: `${lonely.length} superseded ADR(s) lack a successor reference in rationale`,
          details: { ids: lonely },
        };
      },
    },
  ],
};
