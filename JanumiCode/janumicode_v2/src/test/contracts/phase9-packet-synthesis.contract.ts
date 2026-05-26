/**
 * Contract for Phase 9.0 — packet_synthesis (artifact kind: `implementation_packet`).
 *
 * The packet IS the bottom of the consumer chain: the executor reads
 * it verbatim. This contract is the *outcome* contract — given that
 * all upstream contracts hold, the packet should be healthy.
 *
 * Reuses ImplementationPacketContent from src/lib/types/records.ts
 * because the type is already declared canonically there.
 */

import type { ContractSuite } from './types';
import type { ImplementationPacketContent } from '../../lib/types/records';

// ── Contract suite ───────────────────────────────────────────────

export const phase9PacketSynthesisContract: ContractSuite<ImplementationPacketContent> = {
  boundaryId: '9.0_packet_synthesis',
  phaseId: '9',
  subPhaseId: 'packet_synthesis',
  producerArtifactKind: 'implementation_packet',
  description:
    'Phase 9 packet — coherent, populated with US/NFR/data/api/test/eval/constraint context for the executor.',
  clauses: [
    {
      id: 'C-9.0.1',
      description: 'Packet has a non-empty packet_id and references a task with non-empty id + component_id.',
      severity: 'blocking',
      check: (artifact) => {
        if (!artifact.packet_id) return { message: 'packet_id missing' };
        if (!artifact.task?.id) return { message: 'task.id missing' };
        return true;
      },
    },
    {
      id: 'C-9.0.2',
      description: 'Coherence result is present; if passed=false, blocking_failures is non-empty (telemetry integrity).',
      severity: 'blocking',
      check: (artifact) => {
        if (!artifact.coherence) return { message: 'coherence missing' };
        if (artifact.coherence.passed === false && (artifact.coherence.blocking_failures ?? []).length === 0) {
          return { message: 'coherence.passed=false but no blocking_failures recorded' };
        }
        return true;
      },
    },
    {
      id: 'C-9.0.3',
      description: 'Packet has at least one user_story OR is explicitly marked as an infrastructure task.',
      severity: 'advisory',
      check: (artifact) => {
        if ((artifact.user_stories ?? []).length > 0) return true;
        // Infrastructure-task marker is a separate design item (see
        // Path N #5); until that lands, empty user_stories is advisory.
        return {
          message: 'packet has zero user_stories (executor has no narrative context)',
          details: { taskId: artifact.task?.id, componentId: artifact.component?.id },
        };
      },
    },
    {
      id: 'C-9.0.4',
      description: 'Packet has a non-empty component with id + at least one responsibility.',
      severity: 'blocking',
      check: (artifact) => {
        const c = artifact.component;
        if (!c?.id) return { message: 'component.id missing' };
        if (!Array.isArray(c.responsibilities) || c.responsibilities.length === 0) {
          return { message: 'component has no responsibilities' };
        }
        return true;
      },
    },
    {
      id: 'C-9.0.5',
      description: 'Packet has at least one test_case (or marker indicating none expected).',
      severity: 'advisory',
      check: (artifact) => {
        if ((artifact.test_cases ?? []).length > 0) return true;
        return {
          message: 'packet has zero test_cases',
          details: { taskId: artifact.task?.id, componentId: artifact.component?.id },
        };
      },
    },
    {
      id: 'C-9.0.6',
      description: 'Packet has at least one evaluation_criterion (or marker indicating none expected).',
      severity: 'advisory',
      check: (artifact) => {
        if ((artifact.evaluation_criteria ?? []).length > 0) return true;
        return {
          message: 'packet has zero evaluation_criteria',
          details: { taskId: artifact.task?.id, componentId: artifact.component?.id },
        };
      },
    },
    {
      id: 'C-9.0.7',
      description: 'Packet active_constraints are all populated (no constraint id placeholders).',
      severity: 'blocking',
      check: (artifact) => {
        const bad = (artifact.active_constraints ?? []).filter((c) => !c.text || c.text.trim().length === 0).map((c) => c.id);
        if (bad.length === 0) return true;
        return { message: `${bad.length} constraint(s) referenced but not resolved`, details: { ids: bad } };
      },
    },
    {
      id: 'C-9.0.8',
      description: 'Every depends_on_packet id is non-empty and unique within the packet.',
      severity: 'blocking',
      check: (artifact) => {
        const arr = artifact.depends_on_packets ?? [];
        const bad = arr.some((p) => !p || p.trim().length === 0);
        if (bad) return { message: 'depends_on_packets contains an empty entry' };
        const counts = new Map<string, number>();
        for (const p of arr) counts.set(p, (counts.get(p) ?? 0) + 1);
        const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        if (dups.length > 0) return { message: `duplicate depends_on_packets: ${dups.join(', ')}` };
        return true;
      },
    },
  ],
};
