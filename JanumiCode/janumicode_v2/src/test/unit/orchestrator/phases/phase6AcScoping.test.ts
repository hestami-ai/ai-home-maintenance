/**
 * PA-3 — task_skeleton AC-inventory + tech-specs per-component scoping.
 *
 * Verifies the root→leaf AC lineage binding: a per-component task_skeleton call
 * sees only THIS component's acceptance criteria in full (others id-only), via
 * the STRUCTURAL leaf→root tree-walk (buildRequirementLineage.canonicalize) —
 * never regex. Fallback to the full menu when nothing binds guarantees coverage
 * cannot regress. Also covers the secondary DM/API tech-specs slice.
 */
import { describe, it, expect } from 'vitest';
import {
  collectLeafAcceptanceCriteria,
  renderAcceptanceCriteriaMenu,
  componentRootStorySet,
  renderScopedAcceptanceCriteriaMenu,
  buildTechSpecsSummaryById,
} from '../../../../lib/orchestrator/phases/phase6';
import { buildRequirementLineage } from '../../../../lib/orchestrator/phases/packetSynthesis/idResolution';
import type { GovernedStreamRecord } from '../../../../lib/types/records';
import type { PriorPhaseContext } from '../../../../lib/orchestrator/phases/phaseContext';

/** Flexible requirement_decomposition_node builder (leaf and root). */
function node(opts: {
  nodeId: string;
  displayKey: string;
  parent: string | null;
  depth: number;
  status?: string;
  storyId?: string;
  acs?: Array<{ id: string; text?: string }>;
  role?: string;
  action?: string;
  outcome?: string;
}): GovernedStreamRecord {
  const content: Record<string, unknown> = {
    kind: 'requirement_decomposition_node',
    node_id: opts.nodeId,
    parent_node_id: opts.parent,
    display_key: opts.displayKey,
    depth: opts.depth,
    root_kind: 'fr',
    status: opts.status ?? 'atomic',
  };
  if (opts.storyId) {
    content.user_story = {
      id: opts.storyId,
      role: opts.role,
      action: opts.action,
      outcome: opts.outcome,
      acceptance_criteria: (opts.acs ?? []).map((a) => ({ id: a.id, description: a.text ?? `${a.id} text` })),
    };
  }
  return {
    id: `r-${opts.nodeId}`,
    record_type: 'requirement_decomposition_node',
    produced_at: '2026-01-01T00:00:00Z',
    content,
  } as unknown as GovernedStreamRecord;
}

describe('PA-3 — componentRootStorySet (dual-key, structural canonicalize)', () => {
  // root US-001 → leaf US-001-D; independent root/leaf US-002.
  const records: GovernedStreamRecord[] = [
    node({ nodeId: 'n1', displayKey: 'US-001', parent: null, depth: 0, status: 'decomposed' }),
    node({ nodeId: 'n2', displayKey: 'US-001-D', parent: 'n1', depth: 1, storyId: 'US-001-D', acs: [{ id: 'AC-A1', text: 'A1 desc' }, { id: 'AC-A2', text: 'A2 desc' }] }),
    node({ nodeId: 'n3', displayKey: 'US-002', parent: null, depth: 0, storyId: 'US-002', role: 'guest', action: 'shortenUrl', outcome: 'link', acs: [{ id: 'AC-B1', text: 'B1 desc' }] }),
  ];
  const { canonicalize } = buildRequirementLineage(records);

  it('maps a leaf US trace (traces_to) up to its root via the tree-walk', () => {
    expect([...componentRootStorySet({ traces_to: ['US-001-D'] }, canonicalize)]).toEqual(['US-001']);
  });

  it('tolerates the leaf-view alias satisfies_requirement_ids', () => {
    expect([...componentRootStorySet({ satisfies_requirement_ids: ['US-001'] }, canonicalize)]).toEqual(['US-001']);
  });

  it('returns an empty set when a component has no US traces', () => {
    expect(componentRootStorySet({}, canonicalize).size).toBe(0);
  });
});

describe('PA-3 — renderScopedAcceptanceCriteriaMenu', () => {
  const records: GovernedStreamRecord[] = [
    node({ nodeId: 'n1', displayKey: 'US-001', parent: null, depth: 0, status: 'decomposed' }),
    node({ nodeId: 'n2', displayKey: 'US-001-D', parent: 'n1', depth: 1, storyId: 'US-001-D', role: 'sharer', action: 'createShortLink', outcome: 'ok', acs: [{ id: 'AC-A1', text: 'A1 desc' }, { id: 'AC-A2', text: 'A2 desc' }] }),
    node({ nodeId: 'n3', displayKey: 'US-002', parent: null, depth: 0, storyId: 'US-002', role: 'guest', action: 'shortenUrl', outcome: 'link', acs: [{ id: 'AC-B1', text: 'B1 desc' }] }),
  ];
  const { canonicalize } = buildRequirementLineage(records);
  const leaves = collectLeafAcceptanceCriteria(records);

  it('renders OWNED ACs in full and OTHER ACs as id-only tokens (foreign text bloat cut)', () => {
    const menu = renderScopedAcceptanceCriteriaMenu(leaves, new Set(['US-001']), canonicalize);
    // OWNED — full descriptive text present.
    expect(menu).toContain('US-001-D');
    expect(menu).toContain('AC-A1');
    expect(menu).toContain('A1 desc');
    expect(menu).toContain('AC-A2');
    expect(menu).toContain('A2 desc');
    // OTHER — id stays citable, but its description text + story text are gone.
    expect(menu).toContain('AC-B1');
    expect(menu).not.toContain('B1 desc');
    expect(menu).not.toContain('US-002');
    expect(menu).not.toContain('shortenUrl');
  });

  it('FALLBACK: empty componentRoots returns the FULL menu (no coverage regression)', () => {
    const scoped = renderScopedAcceptanceCriteriaMenu(leaves, new Set<string>(), canonicalize);
    expect(scoped).toBe(renderAcceptanceCriteriaMenu(leaves));
  });

  it('captures leafDisplayKey so a leaf whose display_key differs from user_story.id still binds', () => {
    // display_key 'US-003x' ≠ user_story.id 'US-003'; root display_key 'US-003R'.
    // Binding MUST go through leafDisplayKey (canonicalize('US-003x') → 'US-003R'),
    // because canonicalize('US-003') would not resolve to the root.
    const collisionRecords: GovernedStreamRecord[] = [
      node({ nodeId: 'm1', displayKey: 'US-003R', parent: null, depth: 0, status: 'decomposed' }),
      node({ nodeId: 'm2', displayKey: 'US-003x', parent: 'm1', depth: 1, storyId: 'US-003', acs: [{ id: 'AC-C1', text: 'C1 desc' }] }),
    ];
    const lin = buildRequirementLineage(collisionRecords);
    const collisionLeaves = collectLeafAcceptanceCriteria(collisionRecords);
    expect(collisionLeaves[0].leafDisplayKey).toBe('US-003x');
    const menu = renderScopedAcceptanceCriteriaMenu(collisionLeaves, new Set(['US-003R']), lin.canonicalize);
    // Bound as OWNED → full text present (would be id-only if leafStoryId were used).
    expect(menu).toContain('C1 desc');
  });
});

describe('PA-3 — buildTechSpecsSummaryById (DM/API by component_id)', () => {
  const prior = {
    systemRequirements: null,
    interfaceContracts: null,
    errorHandlingStrategies: null,
    configurationParameters: null,
    dataModels: {
      recordId: 'r-dm',
      summary: 'full-dm-summary',
      content: {
        models: [
          { component_id: 'comp-x', entities: [{ name: 'FooEntity', fields: [{ name: 'id', type: 'uuid' }] }] },
          { component_id: 'comp-y', entities: [{ name: 'BarEntity', fields: [{ name: 'id', type: 'uuid' }] }] },
        ],
      },
    },
    apiDefinitions: null,
  } as unknown as PriorPhaseContext;
  const fullTechSpecsSummary = 'FULL-TECH-SPECS-BLOB';

  it('scopes each component to its own data model (X present in [X], absent from [Y])', () => {
    const byId = buildTechSpecsSummaryById(['comp-x', 'comp-y', 'comp-z'], prior);
    expect(byId['comp-x']).toContain('FooEntity');
    expect(byId['comp-x']).not.toContain('BarEntity');
    expect(byId['comp-y']).toContain('BarEntity');
    expect(byId['comp-y']).not.toContain('FooEntity');
  });

  it('empty slice yields no entry → call site falls back to the full summary', () => {
    const byId = buildTechSpecsSummaryById(['comp-x', 'comp-y', 'comp-z'], prior);
    expect(byId['comp-z']).toBeUndefined();
    expect(byId['comp-z'] ?? fullTechSpecsSummary).toBe(fullTechSpecsSummary);
  });

  it('slices api_definitions by component_id too', () => {
    const withApi = {
      systemRequirements: null,
      interfaceContracts: null,
      errorHandlingStrategies: null,
      configurationParameters: null,
      dataModels: null,
      apiDefinitions: {
        recordId: 'r-api',
        summary: 'full-api-summary',
        content: {
          definitions: [
            { component_id: 'comp-x', endpoints: [{ method: 'GET', path: '/x', auth_requirement: 'none' }] },
            { component_id: 'comp-y', endpoints: [{ method: 'POST', path: '/y', auth_requirement: 'bearer' }] },
          ],
        },
      },
    } as unknown as PriorPhaseContext;
    const byId = buildTechSpecsSummaryById(['comp-x', 'comp-y'], withApi);
    expect(byId['comp-x']).toContain('/x');
    expect(byId['comp-x']).not.toContain('/y');
    expect(byId['comp-y']).toContain('/y');
    expect(byId['comp-y']).not.toContain('/x');
  });
});
