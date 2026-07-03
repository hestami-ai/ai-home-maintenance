/**
 * PA-1 completion — component leaf id-form binding.
 *
 * `buildComponentSummaryById` must key each component's scoped context by EVERY
 * id form a task may reference it by (component `id`, leaf `display_key`, leaf
 * `node_id`). Live on cal-31, ~50% of task_saturation calls fell back to the full
 * 53-component catalog because tasks carry the leaf `display_key` while the map
 * keyed only by `component.id` (a different id form under collision-suffixing).
 */
import { describe, it, expect } from 'vitest';
import { buildComponentSummaryById } from '../../../../lib/orchestrator/phases/phase6';

describe('PA-1 — buildComponentSummaryById multi-keys leaf id forms', () => {
  it('keys a leaf block by id, _leaf_display_key, AND _leaf_node_id (all → same block)', () => {
    const leaf = {
      id: 'comp-credential-blocking-rule-enforcement-2', // collision-suffixed component.id
      _leaf_display_key: 'comp-credential-blocking-rule-enforcement', // what tasks reference
      _leaf_node_id: 'node-uuid-123',
      _leaf_root_display_key: 'comp-credential-verification',
      name: 'Credential Blocking Rule Enforcement',
      responsibilities: [{ id: 'r1', description: 'Block expired-license providers' }],
    };
    const map = buildComponentSummaryById([leaf], 'Real-property OS');
    expect(map['comp-credential-blocking-rule-enforcement-2']).toBeDefined();
    expect(map['comp-credential-blocking-rule-enforcement']).toBeDefined();
    expect(map['node-uuid-123']).toBeDefined();
    // all three id forms map to the SAME scoped block
    expect(map['comp-credential-blocking-rule-enforcement'])
      .toBe(map['comp-credential-blocking-rule-enforcement-2']);
    expect(map['comp-credential-blocking-rule-enforcement']).toBe(map['node-uuid-123']);
    // which carries the component's own content
    expect(map['comp-credential-blocking-rule-enforcement']).toContain('PROJECT TYPE: Real-property OS');
    expect(map['comp-credential-blocking-rule-enforcement']).toContain('Block expired-license providers');
  });

  it('resolving by the leaf display_key returns ONLY that leaf (scoping restored, no cross-catalog bleed)', () => {
    const leafA = { id: 'comp-a-int', _leaf_display_key: 'comp-a', name: 'A', responsibilities: [{ id: 'ra', description: 'does A' }] };
    const leafB = { id: 'comp-b-int', _leaf_display_key: 'comp-b', name: 'B', responsibilities: [{ id: 'rb', description: 'does B' }] };
    const map = buildComponentSummaryById([leafA, leafB], 'T');
    const ctx = map['comp-a'];
    expect(ctx).toBeDefined();
    expect(ctx).toContain('does A');
    expect(ctx).not.toContain('does B');
  });

  it('root-source components (no _leaf_* fields) key by id only — unchanged behaviour', () => {
    const root = { id: 'comp-root', name: 'Root', responsibilities: [{ id: 'r', description: 'root work' }] };
    const map = buildComponentSummaryById([root], 'T');
    expect(Object.keys(map)).toEqual(['comp-root']);
    expect(map['comp-root']).toContain('root work');
  });
});
