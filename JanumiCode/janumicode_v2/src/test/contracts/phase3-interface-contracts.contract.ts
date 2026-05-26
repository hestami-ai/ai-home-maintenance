/**
 * Contract for Phase 3.3 — interface_contracts (artifact kind: `interface_contracts`).
 *
 * Defines protocol-level contracts with external systems and internal
 * cross-boundary interfaces. Consumed by Phase 5.2 api_definitions
 * and Phase 9 packet cross-cutting context.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface InterfaceErrorResponse {
  code: string;
  message?: string;
  description?: string;
}

export interface InterfaceContract {
  id: string;
  systems_involved?: string[];
  protocol?: string;
  data_format?: string;
  auth_mechanism?: string;
  error_handling_strategy?: string;
  error_responses?: InterfaceErrorResponse[];
}

export interface InterfaceContractsArtifact {
  kind: 'interface_contracts';
  contracts: InterfaceContract[];
}

// ── Contract suite ───────────────────────────────────────────────

const CONTRACT_ID_PATTERN = /^C-/;

export const phase3InterfaceContractsContract: ContractSuite<InterfaceContractsArtifact> = {
  boundaryId: '3.3_interface_contracts',
  phaseId: '3',
  subPhaseId: 'interface_contracts',
  producerArtifactKind: 'interface_contracts',
  description:
    'Phase 3 interface contracts — each contract has id, systems_involved, protocol, and at least one error_response.',
  clauses: [
    {
      id: 'C-3.3.1',
      description: 'interface_contracts.contracts is an array (may be empty).',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.contracts)) return { message: 'contracts is missing or not an array' };
        return true;
      },
    },
    {
      id: 'C-3.3.2',
      description: 'Every contract has a non-empty C-* id, unique within the artifact.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const c of artifact.contracts ?? []) {
          if (!c.id || !CONTRACT_ID_PATTERN.test(c.id)) { bad.push(c.id || '(missing)'); continue; }
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
      id: 'C-3.3.3',
      description: 'Every contract declares at least one systems_involved entry and a protocol.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ id: string; missing: string[] }> = [];
        for (const c of artifact.contracts ?? []) {
          const missing: string[] = [];
          if (!Array.isArray(c.systems_involved) || c.systems_involved.length === 0) missing.push('systems_involved');
          if (!c.protocol) missing.push('protocol');
          if (missing.length) bad.push({ id: c.id, missing });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} contract(s) missing systems_involved/protocol`, details: { bad } };
      },
    },
    {
      id: 'C-3.3.4',
      description: 'Every contract has at least one error_response with a code.',
      severity: 'advisory',
      check: (artifact) => {
        const bad = (artifact.contracts ?? [])
          .filter((c) => !Array.isArray(c.error_responses) || c.error_responses.length === 0)
          .map((c) => c.id);
        if (bad.length === 0) return true;
        return { message: `${bad.length} contract(s) have no error_responses`, details: { ids: bad } };
      },
    },
  ],
};
