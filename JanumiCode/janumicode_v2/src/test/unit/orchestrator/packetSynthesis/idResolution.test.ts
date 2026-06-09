/**
 * Pillar C — cross-phase SR↔US/NFR resolution bridge. A Phase-6 task tracing
 * system-requirement / NFR ids must resolve to the canonical user-story + NFR
 * ids it serves, via system_requirements.source_requirement_ids +
 * NFR.applies_to_requirements + the requirement decomposition tree (leaf→root).
 */
import { describe, it, expect } from 'vitest';
import { buildRequirementLineage } from '../../../../lib/orchestrator/phases/packetSynthesis/idResolution';
import type { GovernedStreamRecord } from '../../../../lib/types/records';

function rec(record_type: string, content: Record<string, unknown>): GovernedStreamRecord {
  return { record_type, content } as unknown as GovernedStreamRecord;
}

const records: GovernedStreamRecord[] = [
  rec('artifact_produced', {
    kind: 'system_requirements',
    items: [
      { id: 'SR-007', source_requirement_ids: ['US-003', 'NFR-011'] },
      { id: 'SR-001', source_requirement_ids: ['US-001'] },
    ],
  }),
  rec('artifact_produced', {
    kind: 'non_functional_requirements',
    requirements: [{ id: 'NFR-011', applies_to_requirements: ['US-009'] }],
  }),
  // A decomposition leaf US-003-D1 whose root is US-003, carrying its leaf ACs.
  rec('requirement_decomposition_node', { node_id: 'n-root', display_key: 'US-003', depth: 0 }),
  rec('requirement_decomposition_node', {
    node_id: 'n-leaf', display_key: 'US-003-D1', depth: 1, parent_node_id: 'n-root', status: 'atomic',
    user_story: { id: 'US-003-D1', acceptance_criteria: [{ id: 'AC-US-003-D1-001' }, { id: 'AC-US-003-D1-002' }] },
  }),
];

describe('buildRequirementLineage — SR→US/NFR resolution', () => {
  const lineage = buildRequirementLineage(records);

  it('resolves an SR trace to its source US + NFR ids', () => {
    const { usIds, nfrIds } = lineage.resolveTraces(['SR-007']);
    expect([...usIds].sort()).toEqual(['US-003', 'US-009']); // US-003 direct + US-009 via NFR-011.applies_to
    expect([...nfrIds]).toEqual(['NFR-011']);
  });

  it('resolves a direct US trace and an NFR trace', () => {
    expect([...lineage.resolveTraces(['US-001']).usIds]).toEqual(['US-001']);
    const r = lineage.resolveTraces(['NFR-011']);
    expect([...r.nfrIds]).toEqual(['NFR-011']);
    expect([...r.usIds]).toEqual(['US-009']);
  });

  it('canonicalizes a decomposition leaf to its root', () => {
    expect(lineage.canonicalize('US-003-D1')).toBe('US-003');
    // A task tracing the SR whose source includes the (canonical) US still resolves.
    expect([...lineage.resolveTraces(['SR-001']).usIds]).toEqual(['US-001']);
  });

  it('returns empty sets for an unknown trace', () => {
    const { usIds, nfrIds } = lineage.resolveTraces(['SR-999']);
    expect(usIds.size).toBe(0);
    expect(nfrIds.size).toBe(0);
  });

  it('resolveAcs maps leaf AC ids to their owning leaf story (structural, no id parsing)', () => {
    const { storyIds } = lineage.resolveAcs(['AC-US-003-D1-001', 'AC-US-003-D1-002']);
    expect([...storyIds]).toEqual(['US-003-D1']);
  });

  it('resolveAcs ignores unknown / invented AC ids', () => {
    expect(lineage.resolveAcs(['AC-US-999-X-001']).storyIds.size).toBe(0);
    // Mixed: only the known one resolves.
    expect([...lineage.resolveAcs(['AC-US-003-D1-001', 'AC-BOGUS']).storyIds]).toEqual(['US-003-D1']);
  });
});
