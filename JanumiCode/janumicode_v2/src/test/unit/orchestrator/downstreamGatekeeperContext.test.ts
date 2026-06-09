/**
 * Regression: the downstream scope gatekeeper's `acceptedComponents` must
 * reflect the EFFECTIVE component set the producer targets. When Phase 4.2a
 * saturated the root component_model into a leaf tree, Phase 5/6 plan against
 * the leaf components — so the gatekeeper has to accept the LEAF ids, not just
 * the coarse component_model roots. slice-128 regressed here: a 2-root
 * component_model with 20 leaf components caused all 25 leaf-targeted Phase-6
 * tasks to be pruned ("not in Accepted Components") → 0 packets → 0 code.
 */
import { describe, it, expect } from 'vitest';
import { collectDownstreamGatekeeperUpstreamContext } from '../../../lib/orchestrator/phases/downstreamGatekeeper';
import type { PhaseContext } from '../../../lib/orchestrator/orchestratorEngine';
import type { GovernedStreamRecord } from '../../../lib/types/records';

function rec(record_type: string, content: Record<string, unknown>, produced_at = '2026-01-01T00:00:00Z'): GovernedStreamRecord {
  return { id: `r-${Math.abs(hash(JSON.stringify(content)))}`, record_type, content, produced_at, is_current_version: true } as unknown as GovernedStreamRecord;
}
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

function leafNode(id: string, name: string): GovernedStreamRecord {
  return rec('component_decomposition_node', {
    kind: 'component_decomposition_node',
    node_id: `node-${id}`,
    root_component_id: 'node-root',
    display_key: id,
    depth: 1,
    status: 'atomic',
    component: {
      id, name,
      domain_id: 'domain-shortening',
      responsibilities: [{ id: `${id}-r1`, description: `do ${name}` }],
      dependencies: [],
      traces_to: ['SR-001'],
      active_constraints: [],
    },
  });
}

function mockCtx(records: GovernedStreamRecord[]): PhaseContext {
  return {
    engine: {
      writer: {
        getRecordsByType: (_runId: string, type: string) => records.filter(r => r.record_type === type),
      },
    },
    workflowRun: { id: 'run-1' },
  } as unknown as PhaseContext;
}

describe('collectDownstreamGatekeeperUpstreamContext — acceptedComponents', () => {
  it('uses the saturated LEAF components, not just the coarse component_model roots', () => {
    const records: GovernedStreamRecord[] = [
      // Coarse 2-root component_model (the slice-128 shape).
      rec('artifact_produced', {
        kind: 'component_model',
        components: [
          { id: 'comp-url-management-service', name: 'URL Management' },
          { id: 'comp-redirection-service', name: 'Redirection' },
        ],
      }),
      // 20-ish saturated leaves — the level Phase 6 plans tasks against.
      leafNode('comp-click-tracking', 'Click Tracking'),
      leafNode('comp-latency-monitoring', 'Latency Monitoring'),
      leafNode('comp-slug-generator', 'Slug Generator'),
    ];
    const ctx = collectDownstreamGatekeeperUpstreamContext(mockCtx(records), 'task_skeleton');
    const ids = (ctx.acceptedComponents ?? []).map(c => c.id);
    expect(ids).toContain('comp-click-tracking');
    expect(ids).toContain('comp-latency-monitoring');
    expect(ids).toContain('comp-slug-generator');
  });

  it('falls back to component_model roots when no saturation leaves exist', () => {
    const records: GovernedStreamRecord[] = [
      rec('artifact_produced', {
        kind: 'component_model',
        components: [{ id: 'comp-root-a', name: 'A' }, { id: 'comp-root-b', name: 'B' }],
      }),
    ];
    const ctx = collectDownstreamGatekeeperUpstreamContext(mockCtx(records), 'task_skeleton');
    const ids = (ctx.acceptedComponents ?? []).map(c => c.id).sort();
    expect(ids).toEqual(['comp-root-a', 'comp-root-b']);
  });
});
