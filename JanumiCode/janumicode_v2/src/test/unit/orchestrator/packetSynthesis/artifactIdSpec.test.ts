/**
 * Pillar B — single source of truth for artifact id-extraction. The index
 * derives its rules from ARTIFACT_ID_SPECS, and the collectors read array keys
 * from the same spec, so they cannot drift (the bug that produced the false-P7
 * flood: index read `nonfunctional_requirements`/`data_models` while the
 * producers emit `requirements`/`models`).
 *
 * This is the structural drift guard: for every spec, a fixture built from the
 * spec's OWN keys must be picked up by the index.
 */
import { describe, it, expect } from 'vitest';
import { ALL_ID_SPECS, ARTIFACT_ID_SPECS } from '../../../../lib/orchestrator/phases/packetSynthesis/artifactIdSpec';
import { indexArtifacts } from '../../../../lib/orchestrator/phases/packetSynthesis/upstreamIndex';

describe('ARTIFACT_ID_SPECS ↔ upstreamIndex parity', () => {
  it('the index extracts a planted id for EVERY spec, using the spec keys', () => {
    for (const spec of ALL_ID_SPECS) {
      // Build the smallest content that satisfies this spec's shape.
      const item: Record<string, unknown> = {};
      const expectedId = spec.idField ? `ID-${spec.arrayKey}` : undefined;
      if (spec.idField) item[spec.idField] = expectedId;
      let content: Record<string, unknown>;
      if (spec.nested) {
        item[spec.nested.arrayKey] = [{ [spec.nested.idField]: `NESTED-${spec.arrayKey}` }];
        content = { [spec.arrayKey]: [item] };
      } else if (spec.syntheticIdPrefix) {
        content = { [spec.arrayKey]: ['a', 'b'] };
      } else {
        content = { [spec.arrayKey]: [item] };
      }
      const idx = indexArtifacts({ artifacts: [{ sub_phase_id: spec.subPhaseId, content }] });
      if (spec.idField) expect(idx.allUpstreamIds.has(expectedId!)).toBe(true);
      if (spec.nested) expect(idx.allUpstreamIds.has(`NESTED-${spec.arrayKey}`)).toBe(true);
      if (spec.syntheticIdPrefix) expect(idx.allUpstreamIds.has(`${spec.syntheticIdPrefix}1`)).toBe(true);
    }
  });

  it('the 4 previously-drifted specs use the ACTUAL producer keys', () => {
    expect(ARTIFACT_ID_SPECS.nfrs.arrayKey).toBe('requirements');
    expect(ARTIFACT_ID_SPECS.complianceItems.arrayKey).toBe('complianceExtractedItems');
    expect(ARTIFACT_ID_SPECS.dataModels.arrayKey).toBe('models');
    expect(ARTIFACT_ID_SPECS.dataModels.nested?.arrayKey).toBe('entities');
    expect(ARTIFACT_ID_SPECS.apiDefinitions.arrayKey).toBe('definitions');
    expect(ARTIFACT_ID_SPECS.apiDefinitions.nested?.arrayKey).toBe('endpoints');
  });

  it('indexes cross-cutting concern ids (cc-*) so task traces to them resolve', () => {
    const idx = indexArtifacts({
      artifacts: [{
        sub_phase_id: 'component_skeleton',
        content: { kind: 'cross_cutting_constraints', concerns: [{ id: 'cc-observability-logging', name: 'Observability' }] },
      }],
    });
    expect(idx.allUpstreamIds.has('cc-observability-logging')).toBe(true);
  });

  it('a producer-minted DM-* entity id is indexed (was a synthetic dm-* false-P7)', () => {
    const idx = indexArtifacts({
      artifacts: [{
        sub_phase_id: 'data_model_skeleton',
        content: { models: [{ component_id: 'comp-analytics', entities: [{ id: 'DM-analytics-clickstat', name: 'ClickStat' }] }] },
      }],
    });
    expect(idx.allUpstreamIds.has('DM-analytics-clickstat')).toBe(true);
  });

  it('indexes FR-saturation leaf user-story + composite-AC ids (was the slice-131 8111-flood)', () => {
    const idx = indexArtifacts({
      artifacts: [],
      saturationNodes: [{
        recordType: 'requirement_decomposition_node',
        content: {
          node_id: 'node-uuid-1', status: 'atomic', root_kind: 'fr', display_key: 'US-002-D1',
          user_story: {
            id: 'US-002-D1',
            acceptance_criteria: [
              { id: 'AC-US-002-D1-001', description: 'a' },
              { id: 'AC-US-002-D1-002', description: 'b' },
            ],
          },
        },
      }],
    });
    // Leaf story id, both leaf composite-AC ids, and the node UUID are all indexed.
    expect(idx.allUpstreamIds.has('US-002-D1')).toBe(true);
    expect(idx.allUpstreamIds.has('AC-US-002-D1-001')).toBe(true);
    expect(idx.allUpstreamIds.has('AC-US-002-D1-002')).toBe(true);
    expect(idx.allUpstreamIds.has('node-uuid-1')).toBe(true);
  });
});
