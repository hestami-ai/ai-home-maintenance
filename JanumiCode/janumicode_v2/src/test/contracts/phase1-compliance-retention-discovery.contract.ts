/**
 * Contract for Phase 1.0d — compliance_retention_discovery
 * (artifact kind: `compliance_retention_discovery`).
 *
 * COMP-* compliance items are surfaced into Phase 9 packets as
 * `compliance_items[]`. Retention rules are referenced by Phase 5
 * data models when entities have time-based attributes.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface ComplianceItem {
  id: string;
  /** "CONSTRAINT" | "DECISION" | "REQUIREMENT" | "OPEN_QUESTION" (per Phase 1.0d ExtractedItem schema). */
  type?: string;
  /** Per Phase 1.0d schema, the prose lives in `text` (not `description`). */
  text: string;
  timestamp?: string;
  source_ref?: { document_path?: string; section_heading?: string; excerpt?: string };
}

export interface RetentionRule {
  id: string;
  entity?: string;
  duration?: string;
  rationale?: string;
}

export interface ComplianceRetentionArtifact {
  kind: 'compliance_retention_discovery';
  compliance_extracted_items?: ComplianceItem[];
  retention_rules?: RetentionRule[];
}

// ── Contract suite ───────────────────────────────────────────────

const COMP_ID_PATTERN = /^COMP-/;
const RETENTION_ID_PATTERN = /^RETENTION-/;

/**
 * Phase 1.0d assigns COMP-* ids. Downstream consumers: NFRs cite them
 * (NFR.traces_to), product_description_handoff lists compliance_regimes,
 * functional_requirements may cite via US.traces_to, and packets carry
 * compliance_items.
 */
const COMP_DOWNSTREAM_CONSUMER_KINDS: ReadonlySet<string> = new Set([
  'non_functional_requirements',
  'functional_requirements',
  'product_description_handoff',
  'implementation_packet',
]);

function collectExternalCompRefs(context: { relatedArtifacts: ReadonlyMap<string, ReadonlyArray<unknown>> }): Set<string> {
  const out = new Set<string>();
  for (const [kind, arr] of context.relatedArtifacts) {
    if (!COMP_DOWNSTREAM_CONSUMER_KINDS.has(kind)) continue;
    for (const a of arr) {
      const blob = JSON.stringify(a);
      for (const m of blob.matchAll(/COMP-[A-Z0-9_-]+/g)) out.add(m[0]);
    }
  }
  return out;
}

export const phase1ComplianceRetentionContract: ContractSuite<ComplianceRetentionArtifact> = {
  boundaryId: '1.0d_compliance_retention_discovery',
  phaseId: '1',
  subPhaseId: 'compliance_retention_discovery',
  producerArtifactKind: 'compliance_retention_discovery',
  description:
    'Phase 1 compliance + retention — every COMP-* id cited downstream resolves; each item has description + regime.',
  clauses: [
    {
      id: 'C-1.0d.1',
      description: 'compliance + retention arrays present (non-empty when COMP refs exist downstream).',
      severity: 'blocking',
      check: (artifact, context) => {
        const items = artifact.compliance_extracted_items ?? [];
        const external = collectExternalCompRefs(context);
        if (items.length === 0 && external.size > 0) {
          return {
            message: `no compliance items emitted but ${external.size} COMP ref(s) cited downstream`,
            details: { sample: [...external].slice(0, 10) },
          };
        }
        return true;
      },
    },
    {
      id: 'C-1.0d.2',
      description: 'Every compliance item has a COMP-* id, unique within the artifact.',
      severity: 'blocking',
      check: (artifact) => {
        const items = artifact.compliance_extracted_items ?? [];
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const c of items) {
          if (!c.id || !COMP_ID_PATTERN.test(c.id)) { bad.push(c.id || '(missing)'); continue; }
          counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
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
      id: 'C-1.0d.3',
      description: 'Every compliance item has a non-empty text field (verbatim transcription per Phase 1.0d schema).',
      severity: 'blocking',
      check: (artifact) => {
        const bad = (artifact.compliance_extracted_items ?? [])
          .filter((c) => !c.text || c.text.trim().length === 0)
          .map((c) => c.id);
        if (bad.length === 0) return true;
        return { message: `${bad.length} compliance item(s) have empty text`, details: { ids: bad } };
      },
    },
    {
      id: 'C-1.0d.4',
      description: 'Every COMP-* id cited downstream resolves in this artifact.',
      severity: 'blocking',
      check: (artifact, context) => {
        const external = collectExternalCompRefs(context);
        if (external.size === 0) return true;
        const known = new Set((artifact.compliance_extracted_items ?? []).map((c) => c.id));
        const unresolved = [...external].filter((id) => !known.has(id));
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} COMP ref(s) downstream do not resolve`,
          details: { unresolved: unresolved.slice(0, 10) },
        };
      },
    },
    {
      id: 'C-1.0d.5',
      description: 'Retention rules (when declared) have RETENTION-* ids and a duration.',
      severity: 'advisory',
      check: (artifact) => {
        const rules = artifact.retention_rules ?? [];
        const bad = rules
          .filter((r) => !r.id || !RETENTION_ID_PATTERN.test(r.id) || !r.duration)
          .map((r) => r.id || '(missing)');
        if (bad.length === 0) return true;
        return { message: `${bad.length} retention rule(s) malformed`, details: { ids: bad } };
      },
    },
  ],
};
