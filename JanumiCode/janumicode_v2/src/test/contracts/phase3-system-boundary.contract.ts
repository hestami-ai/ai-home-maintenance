/**
 * Contract for Phase 3.1 — system_boundary (artifact kind: `system_boundary`).
 *
 * Defines in-scope vs out-of-scope and external systems. Consumed by
 * Phase 4 component_skeleton (which must not introduce out-of-scope
 * components) and Phase 5.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface ExternalSystem {
  id: string;
  name?: string;
  description?: string;
  protocol?: string;
}

export interface SystemBoundaryArtifact {
  kind: 'system_boundary';
  in_scope?: string[];
  out_of_scope?: string[];
  external_systems?: ExternalSystem[];
}

// ── Contract suite ───────────────────────────────────────────────

const EXT_ID_PATTERN = /^EXT-/;

export const phase3SystemBoundaryContract: ContractSuite<SystemBoundaryArtifact> = {
  boundaryId: '3.1_system_boundary',
  phaseId: '3',
  subPhaseId: 'system_boundary',
  producerArtifactKind: 'system_boundary',
  description:
    'Phase 3 system boundary — in-scope and out-of-scope sets declared; external systems carry EXT-* ids.',
  clauses: [
    {
      id: 'C-3.1.1',
      description: 'in_scope and out_of_scope are arrays (possibly empty).',
      severity: 'blocking',
      check: (artifact) => {
        if (artifact.in_scope !== undefined && !Array.isArray(artifact.in_scope)) {
          return { message: 'in_scope is not an array' };
        }
        if (artifact.out_of_scope !== undefined && !Array.isArray(artifact.out_of_scope)) {
          return { message: 'out_of_scope is not an array' };
        }
        return true;
      },
    },
    {
      id: 'C-3.1.2',
      description: 'in_scope and out_of_scope sets are disjoint (no entry in both).',
      severity: 'blocking',
      check: (artifact) => {
        const inSet = new Set(artifact.in_scope ?? []);
        const collisions = (artifact.out_of_scope ?? []).filter((x) => inSet.has(x));
        if (collisions.length === 0) return true;
        return { message: `${collisions.length} item(s) appear in both in_scope and out_of_scope`, details: { collisions } };
      },
    },
    {
      id: 'C-3.1.3',
      description: 'External systems (when declared) have EXT-* ids, unique within the artifact.',
      severity: 'blocking',
      check: (artifact) => {
        const ext = artifact.external_systems ?? [];
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const e of ext) {
          if (!e.id || !EXT_ID_PATTERN.test(e.id)) { bad.push(e.id || '(missing)'); continue; }
          counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
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
      id: 'C-3.1.4',
      description: 'Every EXT-* id referenced elsewhere (interface_contracts, etc.) resolves here.',
      severity: 'advisory',
      check: (artifact, context) => {
        const external = new Set<string>();
        for (const [kind, arr] of context.relatedArtifacts) {
          if (kind === 'system_boundary') continue;
          for (const a of arr) {
            const blob = JSON.stringify(a);
            for (const m of blob.matchAll(/EXT-[A-Z0-9_-]+/g)) external.add(m[0]);
          }
        }
        if (external.size === 0) return true;
        const known = new Set((artifact.external_systems ?? []).map((e) => e.id));
        const unresolved = [...external].filter((id) => !known.has(id));
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} EXT-* ref(s) elsewhere do not resolve in system_boundary`,
          details: { unresolved },
        };
      },
    },
  ],
};
