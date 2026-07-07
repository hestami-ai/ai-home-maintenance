/**
 * Unit tests for the packet builder.
 */
import { describe, it, expect } from 'vitest';
import {
  buildPackets,
  type BuilderAtomicTask,
  type BuilderComponent,
  type BuilderUserStory,
  type BuilderNfr,
  type BuilderTestSuite,
  type BuilderEvaluationCriterion,
  type BuilderTechnicalConstraint,
  type BuilderComplianceItem,
  type BuilderDataModel,
  type BuilderApiDef,
  type BuilderInput,
} from '../../../../lib/orchestrator/phases/packetSynthesis/packetBuilder';
import { buildRequirementLineage } from '../../../../lib/orchestrator/phases/packetSynthesis/idResolution';

function atomicTask(overrides: Partial<BuilderAtomicTask['content']['task']> = {}): BuilderAtomicTask {
  return {
    node_id: 'task-node-1',
    content: {
      node_id: 'task-node-1',
      task: {
        id: 'task-001',
        name: 'Implement foo',
        description: 'Implement foo on the bar service',
        component_id: 'comp-001',
        backing_tool: 'claude_code_cli',
        estimated_complexity: 'low',
        completion_criteria: [],
        write_directory_paths: ['src/server/foo'],
        read_directory_paths: [],
        dependency_task_ids: [],
        active_constraints: ['TECH-PG-16'],
        traces_to: [],
        ...overrides,
      },
      release_id: null,
      release_ordinal: null,
    },
  };
}

function emptyInput(): BuilderInput {
  return {
    atomicTasks: [],
    userStories: [],
    nfrs: [],
    componentsById: new Map(),
    dataModels: [],
    apiDefinitions: [],
    testSuites: [],
    evaluationCriteria: [],
    technicalConstraintsById: new Map(),
    complianceItemsById: new Map(),
    crossCuttingConstraints: [],
    lineage: buildRequirementLineage([]),
  };
}

describe('buildPackets — cross-cutting NFR constraint routing (Lever 1a)', () => {
  it('attaches a concern only to packets whose component is in applies_to_components', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [
        atomicTask({ id: 'task-a', component_id: 'comp-analytics' }),
        atomicTask({ id: 'task-b', component_id: 'comp-redirect' }),
      ],
      crossCuttingConstraints: [
        { id: 'CC-availability', name: 'Availability', responsibilities: ['retry on failure'], applies_to_components: ['comp-analytics'] },
        { id: 'CC-global', name: 'Logging', responsibilities: ['log all ops'], applies_to_components: [] },
      ],
    };
    const packets = buildPackets(input);
    const analytics = packets.find(p => p.task.id === 'task-a')!;
    const redirect = packets.find(p => p.task.id === 'task-b')!;
    const ids = (p: typeof analytics) => p.active_constraints.map(c => c.id);
    // comp-analytics gets its targeted concern + the applies-to-all concern.
    expect(ids(analytics)).toEqual(expect.arrayContaining(['CC-availability', 'CC-global']));
    // comp-redirect gets only the applies-to-all concern, NOT the analytics one.
    expect(ids(redirect)).toContain('CC-global');
    expect(ids(redirect)).not.toContain('CC-availability');
  });
});

describe('buildPackets — happy path', () => {
  it('builds one packet per atomic task and bundles matching user story', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['US-001'] })],
      userStories: [{
        id: 'US-001',
        role: 'Sharer',
        action: 'shorten URL',
        outcome: 'short URL returned',
        priority: 'critical',
        acceptance_criteria: [
          { id: 'AC-001', description: 'returns 201', measurable_condition: 'HTTP 201' },
        ],
      }],
      componentsById: new Map([['comp-001', {
        id: 'comp-001', name: 'URL Generator',
        responsibilities: [{ id: 'resp-1', description: 'Generate slug' }],
      } as BuilderComponent]]),
    };
    const packets = buildPackets(input);
    expect(packets).toHaveLength(1);
    expect(packets[0].user_stories).toHaveLength(1);
    expect(packets[0].user_stories[0].id).toBe('US-001');
    expect(packets[0].user_stories[0].acceptance_criteria).toHaveLength(1);
    expect(packets[0].component.id).toBe('comp-001');
    expect(packets[0].task.id).toBe('task-001');
  });

  it('resolves user stories via component when task.traces_to does not cite a US directly', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['Generate slug'] })],   // free-text, not a US id
      userStories: [{
        id: 'US-001',
        action: 'shorten URL',
        traces_to: ['comp-001'],   // story traces to component
        acceptance_criteria: [{ id: 'AC-001', description: 'returns 201' }],
      }],
      componentsById: new Map([['comp-001', {
        id: 'comp-001',
        responsibilities: [{ id: 'resp-1', description: 'Generate slug' }],
      } as BuilderComponent]]),
    };
    const packets = buildPackets(input);
    expect(packets[0].user_stories[0].id).toBe('US-001');
  });

  it('bundles test cases matching the packet ACs', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['US-001'] })],
      userStories: [{
        id: 'US-001',
        action: 'shorten URL',
        acceptance_criteria: [{ id: 'AC-001', description: 'returns 201' }],
      }],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
      testSuites: [{
        suite_id: 'suite-001',
        test_cases: [
          { test_case_id: 'TC-001', acceptance_criterion_ids: ['AC-001'], preconditions: [], expected_outcome: 'returns 201' },
          { test_case_id: 'TC-002', acceptance_criterion_ids: ['AC-OTHER'], preconditions: [], expected_outcome: 'unrelated' },
        ],
      }],
    };
    const packets = buildPackets(input);
    expect(packets[0].test_cases).toHaveLength(1);
    expect(packets[0].test_cases[0].test_case_id).toBe('TC-001');
  });

  // ── PD-7: task-scoped API / DM binding ────────────────────────────
  describe('PD-7 — task-scoped API/DM binding', () => {
    const base = (extra: Partial<BuilderInput>): BuilderInput => ({
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['US-001', 'SR-A'], component_id: 'comp-001' })],
      userStories: [{ id: 'US-001', action: 'a', acceptance_criteria: [{ id: 'AC-001', description: 'd' }] }],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] } as BuilderComponent]]),
      ...extra,
    });

    it('binds ONLY the endpoint whose traces_to intersects the task (not every component endpoint)', () => {
      const packets = buildPackets(base({
        apiDefinitions: [
          { id: 'API-create', component_id: 'comp-001', method: 'POST', path: '/board-decisions', traces_to: ['SR-B'] },
          { id: 'API-approve', component_id: 'comp-001', method: 'POST', path: '/decisions/{id}/approve', traces_to: ['SR-A'] },
        ] as BuilderApiDef[],
      }));
      expect(packets[0].api_definitions.map((a) => a.id)).toEqual(['API-approve']);
    });

    it('falls back to ALL component endpoints when NONE are linked (pre-linkage run — no regression)', () => {
      const packets = buildPackets(base({
        apiDefinitions: [
          { id: 'API-1', component_id: 'comp-001', method: 'GET', path: '/a' },
          { id: 'API-2', component_id: 'comp-001', method: 'GET', path: '/b' },
        ] as BuilderApiDef[],
      }));
      expect(packets[0].api_definitions.map((a) => a.id).sort()).toEqual(['API-1', 'API-2']);
    });

    it('own-component floor: linked endpoints exist but NONE match the task → returns ALL component endpoints (no zero-contract regression)', () => {
      // Review finding #1: with anyLinked=true but no endpoint intersecting the task
      // footprint (the AC/US join collapsed to just the task's SR trace), the naive
      // scope returned [] — stripping the executor's own-component contract.
      const packets = buildPackets(base({
        apiDefinitions: [
          { id: 'API-a', component_id: 'comp-001', method: 'POST', path: '/a', traces_to: ['SR-99'] },
          { id: 'API-b', component_id: 'comp-001', method: 'GET', path: '/b', traces_to: ['SR-98'] },
        ] as BuilderApiDef[],
      }));
      expect(packets[0].api_definitions.map((a) => a.id).sort()).toEqual(['API-a', 'API-b']);
    });

    it('keeps an UNLINKED endpoint alongside the linked-relevant one (coverage-safe)', () => {
      const packets = buildPackets(base({
        apiDefinitions: [
          { id: 'API-approve', component_id: 'comp-001', method: 'POST', path: '/approve', traces_to: ['SR-A'] },
          { id: 'API-legacy', component_id: 'comp-001', method: 'GET', path: '/legacy' }, // unlinked
          { id: 'API-other', component_id: 'comp-001', method: 'POST', path: '/other', traces_to: ['SR-Z'] },
        ] as BuilderApiDef[],
      }));
      expect(packets[0].api_definitions.map((a) => a.id).sort()).toEqual(['API-approve', 'API-legacy']);
    });

    it('includes the task-relevant CROSS-COMPONENT data model (the missing write-target), plus own', () => {
      const packets = buildPackets(base({
        dataModels: [
          { id: 'DM-own', component_id: 'comp-001', name: 'Own' },
          { id: 'DM-cross-rel', component_id: 'comp-002', name: 'CrossRel', traces_to: ['SR-A'] },
          { id: 'DM-cross-irrel', component_id: 'comp-002', name: 'CrossIrrel', traces_to: ['SR-Z'] },
        ] as BuilderDataModel[],
      }));
      expect(packets[0].data_models.map((d) => d.id).sort()).toEqual(['DM-cross-rel', 'DM-own']);
    });

    it('carries traces_to onto the packet endpoint for downstream use', () => {
      const packets = buildPackets(base({
        apiDefinitions: [{ id: 'API-approve', component_id: 'comp-001', method: 'POST', path: '/approve', traces_to: ['SR-A'] }] as BuilderApiDef[],
      }));
      expect(packets[0].api_definitions[0].traces_to).toEqual(['SR-A']);
    });
  });

  it('Pass 4: resolves user_stories via composite AC parent extraction from component-matched test cases (ts-109 fix)', () => {
    // ts-109 audit: tasks bind to components only (traces_to: [comp-X]),
    // components have empty traces_to, NFRs don't link this task → the
    // three earlier US-matching passes all miss. But the Phase 7 test
    // suite IS keyed by component_id, and its test cases reference
    // composite ACs whose parent encodes the story id. Pass 4 closes
    // the loop without requiring any new prompt-level changes.
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: [], component_id: 'comp-001' })],
      userStories: [
        // Saturation leaf — the matcher should resolve to THIS one
        // (not US-001), because the test case references its AC.
        {
          id: 'FR-CAM-1.1',
          action: 'Create campaign link via POST /campaigns',
          acceptance_criteria: [{ id: 'AC-FR-CAM-1.1-001', description: 'POST /campaigns returns slug' }],
        },
        // Sibling that should NOT match — different AC parent.
        {
          id: 'US-001',
          action: 'shorten URL',
          acceptance_criteria: [{ id: 'AC-US001-001', description: 'returns 201' }],
        },
      ],
      componentsById: new Map([['comp-001', {
        id: 'comp-001',
        responsibilities: [],   // empty — guarantees Pass 2 misses
        traces_to: [],          // empty — Pass 2 (Phase 1 trace path) misses
      } as BuilderComponent]]),
      testSuites: [{
        suite_id: 'suite-cam',
        component_id: 'comp-001',
        test_cases: [
          {
            test_case_id: 'TC-001',
            acceptance_criterion_ids: ['AC-FR-CAM-1.1-001'],
            preconditions: [],
            expected_outcome: 'campaign link created',
          },
        ],
      }],
    };
    const packets = buildPackets(input);
    expect(packets[0].user_stories).toHaveLength(1);
    expect(packets[0].user_stories[0].id).toBe('FR-CAM-1.1');
  });

  it('Pass 4 handles compact canonical US-{nnn} composite ACs', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: [], component_id: 'comp-001' })],
      userStories: [
        { id: 'US-001', action: 'a', acceptance_criteria: [{ id: 'AC-US001-001', description: 'd' }] },
      ],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [] }]]),
      testSuites: [{
        suite_id: 'suite-x',
        component_id: 'comp-001',
        test_cases: [{ test_case_id: 'TC-1', acceptance_criterion_ids: ['AC-US001-001'], preconditions: [], expected_outcome: '...' }],
      }],
    };
    const packets = buildPackets(input);
    expect(packets[0].user_stories.map(u => u.id)).toEqual(['US-001']);
  });

  it('REGRESSION: matcher is strict on AC ids (no fuzzy bridging in the consumer)', () => {
    // Removed 2026-05-27 along with the `r.startsWith(${us}-) /
    // includes(-${us}-) / endsWith(-${us})` band-aid. Phase 7 now
    // canonicalizes AC refs at exit (see phase7/acRefResolver.ts), so
    // by the time data reaches packet_synthesis every test case
    // already references the FR-canonical id. If a drifted ref ever
    // slips through to here (e.g. `US-001-A1`), the matcher should
    // NOT silently rescue it — coverage / audit metrics will surface
    // the gap and operators fix the prompt or the resolver upstream.
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['US-001'] })],
      userStories: [{
        id: 'US-001',
        action: 'shorten URL',
        acceptance_criteria: [{ id: 'AC-001', description: 'returns 201' }],
      }],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
      testSuites: [{
        suite_id: 'suite-001',
        // Note: component_id intentionally absent so the legitimate
        // component_id Pass 2 fallback can't mask the regression.
        test_cases: [
          { test_case_id: 'TC-001', acceptance_criterion_ids: ['US-001-A1'], preconditions: [], expected_outcome: 'returns 201' },
        ],
      }],
    };
    const packets = buildPackets(input);
    expect(packets[0].test_cases).toHaveLength(0);
  });

  it('bundles evaluation criteria matching the packet user stories', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['US-001'] })],
      userStories: [{
        id: 'US-001',
        action: 'shorten URL',
        acceptance_criteria: [{ id: 'AC-001', description: 'returns 201' }],
      }],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
      evaluationCriteria: [
        { kind: 'functional', target_id: 'US-001', evaluation_method: 'API test', success_condition: 'POST returns 201' },
        { kind: 'functional', target_id: 'US-OTHER', evaluation_method: 'foo', success_condition: 'unrelated' },
      ],
    };
    const packets = buildPackets(input);
    expect(packets[0].evaluation_criteria).toHaveLength(1);
    expect(packets[0].evaluation_criteria[0].target_id).toBe('US-001');
  });

  it('resolves active_constraints via the technicalConstraintsById map', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ active_constraints: ['TECH-PG-16'] })],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
      technicalConstraintsById: new Map([['TECH-PG-16', {
        id: 'TECH-PG-16', category: 'database', text: 'Postgres 16+',
      } as BuilderTechnicalConstraint]]),
    };
    const packets = buildPackets(input);
    expect(packets[0].active_constraints).toHaveLength(1);
    expect(packets[0].active_constraints[0].text).toBe('Postgres 16+');
  });

  it('emits placeholder active_constraint when id is referenced but not found (for verifier to flag)', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ active_constraints: ['TECH-UNKNOWN'] })],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
    };
    const packets = buildPackets(input);
    expect(packets[0].active_constraints).toHaveLength(1);
    expect(packets[0].active_constraints[0].id).toBe('TECH-UNKNOWN');
    expect(packets[0].active_constraints[0].text).toBe('');
  });

  it('resolves depends_on_packets from task.dependency_task_ids', () => {
    const taskA: BuilderAtomicTask = atomicTask({ id: 'task-A', dependency_task_ids: [] });
    const taskB: BuilderAtomicTask = atomicTask({ id: 'task-B', dependency_task_ids: ['task-A'] });
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [taskA, taskB],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
    };
    const packets = buildPackets(input);
    const a = packets.find((p) => p.task.id === 'task-A')!;
    const b = packets.find((p) => p.task.id === 'task-B')!;
    expect(a.depends_on_packets).toHaveLength(0);
    expect(b.depends_on_packets).toEqual([a.packet_id]);
  });

  it('emits a packet with empty user_stories when no upstream story matches', () => {
    // Verifier will fail P1 on this — builder just produces the packet.
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['NOTHING'] })],
      userStories: [{ id: 'US-001', action: 'unrelated', acceptance_criteria: [{ id: 'AC-001', description: 'd' }] }],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
    };
    const packets = buildPackets(input);
    expect(packets[0].user_stories).toHaveLength(0);
  });

  it('emits a packet with empty component fields when component_id does not resolve', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ component_id: 'comp-unknown' })],
    };
    const packets = buildPackets(input);
    expect(packets[0].component.id).toBe('comp-unknown');
    expect(packets[0].component.responsibilities).toHaveLength(0);
  });

  it('all packet_ids are unique', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [
        atomicTask({ id: 'task-A' }),
        atomicTask({ id: 'task-B' }),
        atomicTask({ id: 'task-C' }),
      ],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
    };
    const packets = buildPackets(input);
    const ids = new Set(packets.map((p) => p.packet_id));
    expect(ids.size).toBe(3);
  });
});

import { findNfrsByUserStories, preferLeafStories, findTestCasesForAcs, bindCompletionCriteriaToTests } from '../../../../lib/orchestrator/phases/packetSynthesis/packetBuilder';
import { parseTestCounts } from '../../../../lib/orchestrator/leafTestRunner';

describe('bindCompletionCriteriaToTests — CC→test coverage', () => {
  const tc = (id: string, acs: string[]) => ({
    test_case_id: id, type: 'unit', acceptance_criterion_ids: acs, preconditions: [], expected_outcome: 'ok',
  });

  it('binds a criterion to tests covering its declared verified AC', () => {
    const out = bindCompletionCriteriaToTests(
      [{ criterion_id: 'CC-1', description: 'delete rows', verification_method: 'test_execution', verifies_acceptance_criteria: ['AC-US-001-1-002'] }],
      [tc('TC-DEL', ['AC-US-001-1-002']), tc('TC-OTHER', ['AC-US-002-1-001'])],
      new Set(['AC-US-001-1-002']),
    );
    expect(out[0].covered_by_test_ids).toEqual(['TC-DEL']);
  });

  it('falls back to the task AC set when the criterion declares no AC', () => {
    const out = bindCompletionCriteriaToTests(
      [{ criterion_id: 'CC-1', description: 'x', verification_method: 'test_execution' }],
      [tc('TC-A', ['AC-US-001-1-001'])],
      new Set(['AC-US-001-1-001']),
    );
    expect(out[0].covered_by_test_ids).toEqual(['TC-A']);
  });

  it('leaves covered_by_test_ids empty when no test covers the criterion (honest gap)', () => {
    const out = bindCompletionCriteriaToTests(
      [{ criterion_id: 'CC-1', description: 'x', verification_method: 'test_execution', verifies_acceptance_criteria: ['AC-US-009-1-001'] }],
      [tc('TC-A', ['AC-US-001-1-001'])],
      new Set(['AC-US-009-1-001']),
    );
    expect(out[0].covered_by_test_ids).toEqual([]);
  });
});

// Structural canonicalizer stub: a Map lookup standing in for the real
// decomposition-tree walk (lineage.canonicalize). No regex — exactly the point.
const treeCanon = (map: Record<string, string>) => (id: string): string => map[id] ?? id;

describe('findNfrsByUserStories — bridge NFRs via applies_to_requirements (ts-118 fix)', () => {
  const nfrs: BuilderNfr[] = [
    { id: 'NFR-001', applies_to_requirements: ['US-004', 'US-006'], traces_to: ['VV-LAT'] },
    { id: 'NFR-002', applies_to_requirements: ['US-009'], traces_to: ['COMP-GDPR'] },
    { id: 'NFR-003', traces_to: ['QA-1'] }, // no applies_to → cross-cutting, not bridged here
  ];
  it('matches NFRs whose applies_to_requirements intersects the (expanded) US set', () => {
    const out = findNfrsByUserStories(new Set(['US-004-1', 'US-004']), nfrs);
    expect(out.map((n) => n.id)).toEqual(['NFR-001']);
  });
  it('matches multiple NFRs across the US set', () => {
    const out = findNfrsByUserStories(new Set(['US-004', 'US-009']), nfrs);
    expect(out.map((n) => n.id).sort()).toEqual(['NFR-001', 'NFR-002']);
  });
  it('returns nothing when no canonical US overlaps (leaf-only set, the ts-118 0% case)', () => {
    // Before the canonicalUsId expansion, only the leaf id would be in the
    // set and nothing matched. The CALLER must seed canonical ids.
    expect(findNfrsByUserStories(new Set(['US-004-1']), nfrs)).toEqual([]);
  });
  it('does not bridge NFRs lacking applies_to_requirements', () => {
    const out = findNfrsByUserStories(new Set(['US-004', 'US-009', 'US-006']), nfrs);
    expect(out.map((n) => n.id)).not.toContain('NFR-003');
  });
});

describe('preferLeafStories — collapse root+leaf to consistent leaf granularity (task→leaf binding)', () => {
  // Canonicalize via the structural tree stub — includes the `-D`/`-Leaf` forms
  // the deleted regex could never reduce.
  const canon = treeCanon({
    'US-001-01-1': 'US-001', 'US-001-01-2': 'US-001',
    'US-003-D1': 'US-003',
    'US-002-1-D': 'US-002', 'US-002-3-Leaf': 'US-002', 'US-007-2-1-D': 'US-007',
  });
  it('drops the root when its decomposed leaves are present', () => {
    const stories = [{ id: 'US-001' }, { id: 'US-001-01-1' }, { id: 'US-001-01-2' }];
    expect(preferLeafStories(stories, canon).map((s) => s.id).sort())
      .toEqual(['US-001-01-1', 'US-001-01-2']);
  });
  it('keeps a never-decomposed root (no leaves in its group)', () => {
    expect(preferLeafStories([{ id: 'US-002' }], canon).map((s) => s.id)).toEqual(['US-002']);
  });
  it('handles mixed sets — collapse decomposed roots, keep undecomposed ones', () => {
    const stories = [
      { id: 'US-001' }, { id: 'US-001-01-1' }, // US-001 decomposed → leaf only
      { id: 'US-002' },                        // US-002 undecomposed → kept
      { id: 'US-003-D1' },                     // leaf whose root isn't in the set → kept
    ];
    expect(preferLeafStories(stories, canon).map((s) => s.id).sort())
      .toEqual(['US-001-01-1', 'US-002', 'US-003-D1']);
  });
  it('collapses the `-D`/`-Leaf` forms the old regex missed (structural, not regex)', () => {
    const stories = [
      { id: 'US-002' }, { id: 'US-002-1-D' }, { id: 'US-002-3-Leaf' }, // US-002 decomposed → leaves only
      { id: 'US-007-2-1-D' },                                          // root US-007 not in set → kept
    ];
    expect(preferLeafStories(stories, canon).map((s) => s.id).sort())
      .toEqual(['US-002-1-D', 'US-002-3-Leaf', 'US-007-2-1-D']);
  });
});

describe('buildPackets — task→leaf-AC binding scopes user_stories to the task slice', () => {
  // Lineage with a leaf node carrying US-001-01-1 + its leaf AC.
  const lineageRecords = [
    { id: 'r1', record_type: 'requirement_decomposition_node', produced_at: '2026-01-01T00:00:00Z',
      content: { kind: 'requirement_decomposition_node', node_id: 'n1', root_kind: 'fr', status: 'atomic', display_key: 'US-001-01-1',
        user_story: { id: 'US-001-01-1', acceptance_criteria: [{ id: 'AC-US-001-01-1-001' }] } } },
  ] as unknown as Parameters<typeof buildRequirementLineage>[0];

  const stories: BuilderUserStory[] = [
    { id: 'US-001-01-1', role: 'r', action: 'a', outcome: 'o', priority: 'high', acceptance_criteria: [{ id: 'AC-US-001-01-1-001', description: 'ac' }] },
    { id: 'US-001-02-1', role: 'r', action: 'a', outcome: 'o', priority: 'high', acceptance_criteria: [{ id: 'AC-US-001-02-1-001', description: 'other' }] },
  ] as unknown as BuilderUserStory[];

  it('a task citing a leaf AC gets ONLY that AC\'s owning leaf story, not sibling component stories', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['AC-US-001-01-1-001'] })],
      userStories: stories,
      componentsById: new Map([['comp-001', { id: 'comp-001', name: 'C', responsibilities: [], dependencies: [], active_constraints: [] } as unknown as BuilderComponent]]),
      lineage: buildRequirementLineage(lineageRecords),
    };
    const packets = buildPackets(input);
    expect(packets).toHaveLength(1);
    expect(packets[0].user_stories.map((u) => u.id)).toEqual(['US-001-01-1']);
  });

  it('trims the matched story to the ACs the task actually cites (not sibling-task ACs)', () => {
    // US-001-01-1 owns two ACs; the task cites only one → packet story carries only that one.
    const records2 = [
      { id: 'r1', record_type: 'requirement_decomposition_node', produced_at: '2026-01-01T00:00:00Z',
        content: { kind: 'requirement_decomposition_node', node_id: 'n1', root_kind: 'fr', status: 'atomic', display_key: 'US-001-01-1',
          user_story: { id: 'US-001-01-1', acceptance_criteria: [{ id: 'AC-US-001-01-1-001' }, { id: 'AC-US-001-01-1-002' }] } } },
    ] as unknown as Parameters<typeof buildRequirementLineage>[0];
    const stories2: BuilderUserStory[] = [
      { id: 'US-001-01-1', role: 'r', action: 'a', outcome: 'o', priority: 'high', acceptance_criteria: [{ id: 'AC-US-001-01-1-001', description: 'x' }, { id: 'AC-US-001-01-1-002', description: 'y' }] },
    ] as unknown as BuilderUserStory[];
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['AC-US-001-01-1-001'] })],
      userStories: stories2,
      componentsById: new Map([['comp-001', { id: 'comp-001', name: 'C', responsibilities: [], dependencies: [], active_constraints: [] } as unknown as BuilderComponent]]),
      lineage: buildRequirementLineage(records2),
    };
    const packets = buildPackets(input);
    expect(packets[0].user_stories).toHaveLength(1);
    expect(packets[0].user_stories[0].acceptance_criteria.map((a) => a.id)).toEqual(['AC-US-001-01-1-001']);
  });

  it('caps an AC-less task to one story per canonical root (Fix 4 containment)', () => {
    // US-007 decomposes into 3 leaves; an AC-less task tracing US-007 would
    // leaf-expand to all 3 → capped to 1 representative.
    const records3 = [
      ...['US-007-1', 'US-007-2', 'US-007-3'].map((lk, i) => ({
        id: `r${i}`, record_type: 'requirement_decomposition_node', produced_at: '2026-01-01T00:00:00Z',
        content: { kind: 'requirement_decomposition_node', node_id: `n${i}`, root_kind: 'fr', status: 'atomic', display_key: lk,
          parent_node_id: 'root7', user_story: { id: lk, acceptance_criteria: [{ id: `AC-${lk}-001` }] } },
      })),
      { id: 'rroot', record_type: 'requirement_decomposition_node', produced_at: '2026-01-01T00:00:00Z',
        content: { kind: 'requirement_decomposition_node', node_id: 'root7', depth: 0, display_key: 'US-007' } },
    ] as unknown as Parameters<typeof buildRequirementLineage>[0];
    const stories3 = ['US-007-1', 'US-007-2', 'US-007-3'].map((id) => ({ id, role: 'r', action: 'a', outcome: 'o', priority: 'low', acceptance_criteria: [{ id: `AC-${id}-001`, description: 'x' }] })) as unknown as BuilderUserStory[];
    // Task traces the component (no AC ids) → fallback via component match.
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['comp-007'], component_id: 'comp-007' })],
      userStories: stories3,
      componentsById: new Map([['comp-007', { id: 'comp-007', name: 'C', responsibilities: [], dependencies: [], active_constraints: [],
        // component traces to all three leaf stories → matchUsViaComponent returns all 3
      } as unknown as BuilderComponent]]),
      lineage: buildRequirementLineage(records3),
    };
    // Wire the component→story trace so the fallback matches all 3.
    (stories3 as Array<{ traces_to?: string[] }>).forEach((s) => { s.traces_to = ['comp-007']; });
    (input.componentsById.get('comp-007') as unknown as { responsibilities: unknown[] }).responsibilities = [];
    const packets = buildPackets(input);
    // AC-less task → capped to one story per canonical root (US-007) ⇒ 1 story.
    expect(packets[0].user_stories.length).toBeLessThanOrEqual(1);
  });

  it('a task with no leaf AC ids falls back to the existing passes (back-compat)', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: [], component_id: 'comp-001' })],
      userStories: stories,
      componentsById: new Map([['comp-001', { id: 'comp-001', name: 'C', responsibilities: [], dependencies: [], active_constraints: [] } as unknown as BuilderComponent]]),
      lineage: buildRequirementLineage(lineageRecords),
    };
    // No AC ids → AC pass is skipped; no SR/component match here → empty stories (the
    // fallback passes run, just don't match this minimal fixture). Asserts no throw + AC pass not over-reaching.
    expect(() => buildPackets(input)).not.toThrow();
  });
});

describe('findTestCasesForAcs — root-suite → leaf-packet binding by AC intersection', () => {
  // Phase 7 keys suites to the COARSE ROOT component (comp-url-shortening);
  // Phase-9 packets are scoped to the SATURATED LEAF components that root was
  // decomposed into (comp-creation-api, comp-slug-generator). Binding is by
  // the exact leaf-AC namespace, NOT by suite.component_id — otherwise every
  // root suite is discarded from its own descendant leaf packets (the
  // P3_AC_NO_TEST flood). Bleed is prevented structurally: leaf-AC sets are
  // disjoint across leaf tasks, so a case only binds to the one packet whose
  // task implements its AC.
  const suites = [
    // One root suite holding cases for TWO different leaf stories.
    { suite_id: 'TS-URL', component_id: 'comp-url-shortening', test_cases: [
      { test_case_id: 'TC-CREATE-001', acceptance_criterion_ids: ['AC-US-001-1-001'], preconditions: [], expected_outcome: '201' },
      { test_case_id: 'TC-SLUG-001', acceptance_criterion_ids: ['AC-US-002-1-001'], preconditions: [], expected_outcome: 'slug minted' },
    ] },
    // A persistence suite whose case references a disjoint leaf AC.
    { suite_id: 'TS-DATA', component_id: 'comp-mapping-persistence', test_cases: [
      { test_case_id: 'TC-DATA-001', acceptance_criterion_ids: ['AC-US-008-1-001'], preconditions: [], expected_outcome: 'encrypted' },
    ] },
  ];

  it('binds a ROOT suite case to its descendant LEAF packet via exact AC match', () => {
    // Leaf packet comp-creation-api implements only AC-US-001-1-001.
    const out = findTestCasesForAcs(new Set(['AC-US-001-1-001']), new Set(), suites, 'comp-creation-api');
    const ids = out.map((t) => t.test_case_id).sort();
    expect(ids).toContain('TC-CREATE-001');       // root-suite case reaches its leaf packet
    expect(ids).not.toContain('TC-SLUG-001');     // sibling leaf's case (disjoint AC) NOT pulled
    expect(ids).not.toContain('TC-DATA-001');     // unrelated leaf's case NOT pulled
  });

  it('routes each sibling leaf its OWN cases from the shared root suite (no bleed)', () => {
    const slug = findTestCasesForAcs(new Set(['AC-US-002-1-001']), new Set(), suites, 'comp-slug-generator');
    const ids = slug.map((t) => t.test_case_id).sort();
    expect(ids).toContain('TC-SLUG-001');
    expect(ids).not.toContain('TC-CREATE-001');   // disjoint leaf-AC namespace prevents bleed
  });

  it('still pulls the whole suite when component_id matches exactly', () => {
    const out = findTestCasesForAcs(new Set(), new Set(), suites, 'comp-mapping-persistence');
    expect(out.map((t) => t.test_case_id)).toContain('TC-DATA-001');
  });

  it('carries property_spec from a property test case into the packet test case', () => {
    const propSuites = [
      { suite_id: 'TS-SLUG', component_id: 'comp-slug-generator', test_cases: [
        {
          test_case_id: 'TC-RT-001', type: 'property',
          acceptance_criterion_ids: ['AC-US-002-1-001'], preconditions: [],
          expected_outcome: 'no counterexample',
          property_spec: {
            invariant: 'resolve(shorten(u)) === u',
            property_kind: 'round_trip' as const,
            input_domain: 'valid URLs',
            oracle: 'identity',
          },
        },
      ] },
    ];
    const out = findTestCasesForAcs(new Set(['AC-US-002-1-001']), new Set(), propSuites, 'comp-slug-generator');
    const rt = out.find((t) => t.test_case_id === 'TC-RT-001')!;
    expect(rt.property_spec?.invariant).toBe('resolve(shorten(u)) === u');
    expect(rt.property_spec?.property_kind).toBe('round_trip');
    expect(rt.type).toBe('property');
  });
});

describe('parseTestCounts — cargo test (Rust / proptest)', () => {
  it('sums passed/failed/ignored across multiple cargo result lines', () => {
    const stdout = [
      'running 3 tests',
      'test result: ok. 2 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out',
      'running 1 test',
      'test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out',
    ].join('\n');
    const counts = parseTestCounts(stdout, '');
    expect(counts.passed).toBe(2);
    expect(counts.failed).toBe(1);   // proptest counterexample surfaces as a failed count
    expect(counts.skipped).toBe(1);
  });

  it('returns zeros when no recognized runner output is present', () => {
    expect(parseTestCounts('some unrelated log line', '')).toEqual({ passed: 0, failed: 0, skipped: 0 });
  });
});
