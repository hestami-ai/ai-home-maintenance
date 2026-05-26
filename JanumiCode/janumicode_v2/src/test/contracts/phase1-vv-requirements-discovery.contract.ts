/**
 * Contract for Phase 1.0e — vv_requirements_discovery
 * (artifact kind: `vv_requirements_discovery`).
 *
 * VV-* requirements are surfaced into Phase 9 packets and NFR
 * traces_to lists. Every VV-* id used elsewhere must resolve.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface VvRequirement {
  id: string;
  category?: string;
  /** Per Phase 1.0e schema: the prose target is in `target` (not `description`). */
  target: string;
  /** How the target is measured. */
  measurement: string;
  /** The pass/fail threshold. */
  threshold: string;
  source_ref?: { document_path?: string; section_heading?: string; excerpt?: string };
}

export interface VvRequirementsArtifact {
  kind: 'vv_requirements_discovery';
  vvRequirements?: VvRequirement[];
}

// ── Contract suite ───────────────────────────────────────────────

const VV_ID_PATTERN = /^VV-/;

function getItems(a: VvRequirementsArtifact): VvRequirement[] {
  return a.vvRequirements ?? [];
}

/**
 * Phase 1.0e assigns VV-* ids. Downstream consumers: NFRs cite them
 * via traces_to; packets carry compliance_items including VV-*.
 */
const VV_DOWNSTREAM_CONSUMER_KINDS: ReadonlySet<string> = new Set([
  'non_functional_requirements',
  'implementation_packet',
]);

function collectExternalVvRefs(context: { relatedArtifacts: ReadonlyMap<string, ReadonlyArray<unknown>> }): Set<string> {
  const out = new Set<string>();
  for (const [kind, arr] of context.relatedArtifacts) {
    if (!VV_DOWNSTREAM_CONSUMER_KINDS.has(kind)) continue;
    for (const a of arr) {
      const blob = JSON.stringify(a);
      for (const m of blob.matchAll(/VV-[A-Z0-9_-]+/g)) out.add(m[0]);
    }
  }
  return out;
}

export const phase1VvRequirementsContract: ContractSuite<VvRequirementsArtifact> = {
  boundaryId: '1.0e_vv_requirements_discovery',
  phaseId: '1',
  subPhaseId: 'vv_requirements_discovery',
  producerArtifactKind: 'vv_requirements_discovery',
  description:
    'Phase 1 V&V requirements — every VV-* id cited downstream resolves; each has description.',
  clauses: [
    {
      id: 'C-1.0e.1',
      description: 'vv_requirements array is present (non-empty when VV refs exist downstream).',
      severity: 'blocking',
      check: (artifact, context) => {
        const items = getItems(artifact);
        const external = collectExternalVvRefs(context);
        if (items.length === 0 && external.size > 0) {
          return {
            message: `no VV items emitted but ${external.size} VV ref(s) cited downstream`,
            details: { sample: [...external].slice(0, 10) },
          };
        }
        return true;
      },
    },
    {
      id: 'C-1.0e.2',
      description: 'Every VV item has a VV-* id, unique within the artifact.',
      severity: 'blocking',
      check: (artifact) => {
        const items = getItems(artifact);
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const v of items) {
          if (!v.id || !VV_ID_PATTERN.test(v.id)) { bad.push(v.id || '(missing)'); continue; }
          counts.set(v.id, (counts.get(v.id) ?? 0) + 1);
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
      id: 'C-1.0e.3',
      description: 'Every VV item has non-empty target, measurement, and threshold (the V&V triplet).',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ id: string; missing: string[] }> = [];
        for (const v of getItems(artifact)) {
          const missing: string[] = [];
          if (!v.target || v.target.trim().length === 0) missing.push('target');
          if (!v.measurement || v.measurement.trim().length === 0) missing.push('measurement');
          if (!v.threshold || v.threshold.trim().length === 0) missing.push('threshold');
          if (missing.length) bad.push({ id: v.id, missing });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} VV item(s) missing target/measurement/threshold`, details: { bad } };
      },
    },
    {
      id: 'C-1.0e.4',
      description: 'Every VV-* id cited downstream resolves in this artifact.',
      severity: 'blocking',
      check: (artifact, context) => {
        const external = collectExternalVvRefs(context);
        if (external.size === 0) return true;
        const known = new Set(getItems(artifact).map((v) => v.id));
        const unresolved = [...external].filter((id) => !known.has(id));
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} VV ref(s) downstream do not resolve`,
          details: { unresolved: unresolved.slice(0, 10) },
        };
      },
    },
  ],
};
