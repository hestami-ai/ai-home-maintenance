/**
 * Review fix #2 — PD-7 traces_to must not be lost to first-wins dedup. The same
 * entity/endpoint id can be emitted across multiple artifact records (chunked P5
 * skeleton + reconciliation; superseded re-emission — the collectors do NOT filter
 * is_current_version). If the FIRST occurrence lacked traces_to and a LATER one
 * carries it, the collector must MERGE the linkage onto the kept item, not discard
 * the later occurrence outright.
 */
import { describe, it, expect } from 'vitest';
import { collectDataModels, collectApiDefs } from '../../../../lib/orchestrator/phases/packetSynthesis';
import type { GovernedStreamRecord } from '../../../../lib/types/records';

const rec = (id: string, subPhase: string, content: Record<string, unknown>): GovernedStreamRecord => ({
  id, record_type: 'artifact_produced', is_current_version: true,
  sub_phase_id: subPhase, derived_from_record_ids: [], content,
} as unknown as GovernedStreamRecord);

const dmRec = (id: string, entity: Record<string, unknown>) =>
  rec(id, 'data_model_skeleton', { models: [{ component_id: 'comp-a', entities: [entity] }] });
const apiRec = (id: string, ep: Record<string, unknown>) =>
  rec(id, 'api_definitions', { definitions: [{ component_id: 'comp-a', endpoints: [ep] }] });

describe('collectDataModels — traces_to merge (review fix #2)', () => {
  it('merges a LATER occurrence traces_to onto a first-wins entity that lacked it', () => {
    const out = collectDataModels([
      dmRec('r1', { id: 'DM-a-user', name: 'User', fields: [{ name: 'id', type: 'uuid' }] }),          // no traces (first)
      dmRec('r2', { id: 'DM-a-user', name: 'User', fields: [{ name: 'id', type: 'uuid' }], traces_to: ['SR-5'] }), // traces (later)
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].traces_to).toEqual(['SR-5']);
  });

  it('does NOT overwrite an already-present linkage with a later empty occurrence', () => {
    const out = collectDataModels([
      dmRec('r1', { id: 'DM-a-user', name: 'User', fields: [], traces_to: ['SR-1'] }),
      dmRec('r2', { id: 'DM-a-user', name: 'User', fields: [] }),
    ]);
    expect(out[0].traces_to).toEqual(['SR-1']);
  });
});

describe('collectApiDefs — traces_to merge (review fix #2)', () => {
  it('merges a LATER endpoint traces_to onto a first-wins endpoint that lacked it', () => {
    const out = collectApiDefs([
      apiRec('r1', { id: 'API-x', method: 'POST', path: '/x' }),                       // no traces (first)
      apiRec('r2', { id: 'API-x', method: 'POST', path: '/x', traces_to: ['SR-9'] }),  // traces (later)
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].traces_to).toEqual(['SR-9']);
  });
});
