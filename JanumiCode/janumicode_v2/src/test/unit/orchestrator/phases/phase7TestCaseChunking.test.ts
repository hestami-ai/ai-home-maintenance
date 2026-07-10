/**
 * SD-4 / PA-15 — Phase 7.1 test_case_skeleton per-component chunking +
 * orchestrator-owned AC-coverage reconciliation.
 *
 * Pure-helper tests (buildComponentAcMap, computeUncoveredTestAcIds,
 * parseTestSuites, renderScopedAcMenu, caseCoversAny, dedupeTestSuiteIds) plus
 * MockLLMProvider integration exercising the real chunkedCoverageBloom +
 * reconciliation through Phase7Handler.runTestCaseGeneration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { ConfigManager } from '../../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import {
  Phase7Handler,
  buildComponentAcMap,
  computeUncoveredTestAcIds,
  parseTestSuites,
  caseCoversAny,
  renderScopedAcMenu,
  dedupeTestSuiteIds,
  retainAcCoverageOnPrune,
  buildComponentSummaryById,
  collectAllAcIds,
  extractStringIds,
  collectDmr71Seeds,
  buildRootTestCasesFromPlan,
} from '../../../../lib/orchestrator/phases/phase7';
import { renderComponentBlockForTask } from '../../../../lib/orchestrator/phases/phase6';
import type { LeafAcceptanceCriteria } from '../../../../lib/orchestrator/phases/phase6';
import type { PhaseContextPacketResult } from '../../../../lib/orchestrator/phases/dmrContext';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));

// ── Shared fixtures ────────────────────────────────────────────────

function leaves(): LeafAcceptanceCriteria[] {
  return [
    { leafStoryId: 'US-1', storyText: 'story one', acs: [
      { id: 'AC-1', text: 'behaviour one' },
      { id: 'AC-2', text: 'behaviour two' },
    ] },
    { leafStoryId: 'US-2', storyText: 'story two', acs: [
      { id: 'AC-3', text: 'behaviour three' },
    ] },
    { leafStoryId: 'US-3', storyText: 'story three', acs: [
      { id: 'AC-4', text: 'behaviour four' },
    ] },
  ];
}

function components(): Array<Record<string, unknown>> {
  return [
    { id: 'comp-a', name: 'Component A', responsibilities: [{ id: 'res-a', description: 'RESP-COMP-A-MARKER' }] },
    { id: 'comp-b', name: 'Component B', responsibilities: [{ id: 'res-b', description: 'RESP-COMP-B-MARKER' }] },
    { id: 'comp-c', name: 'Component C', responsibilities: [{ id: 'res-c', description: 'RESP-COMP-C-MARKER' }] },
  ];
}

// ── Pure helper tests ──────────────────────────────────────────────

// Characterization tests pinning the behaviour of the execute() decomposition
// helpers extracted from Phase7Handler.execute (S3776 cognitive-complexity
// reduction). Assertions mirror the pre-refactor inline logic.
describe('extractStringIds', () => {
  it('maps { id } records to string ids, dropping absent/non-string ids, preserving order', () => {
    expect(extractStringIds([
      { id: 'US-1' },
      { id: 'US-2' },
      { name: 'no id' },
      { id: 5 as unknown as string },
      { id: '' },
    ])).toEqual(['US-1', 'US-2']);
  });

  it('returns [] for an empty input', () => {
    expect(extractStringIds([])).toEqual([]);
  });
});

describe('collectAllAcIds', () => {
  it('collects truthy AC ids in story-then-AC order, skipping missing/empty', () => {
    const stories = [
      { acceptance_criteria: [{ id: 'AC-1' }, { id: 'AC-2' }] },
      { acceptance_criteria: [{ id: 'AC-3' }] },
      { name: 'story with no acceptance_criteria' },
      { acceptance_criteria: [{ id: '' }, { note: 'x' }, { id: 'AC-4' }] },
    ];
    expect(collectAllAcIds(stories)).toEqual(['AC-1', 'AC-2', 'AC-3', 'AC-4']);
  });
});

describe('buildComponentSummaryById', () => {
  it('keys only string-id components (in input order) to renderComponentBlockForTask output', () => {
    const comps = components();
    const map = buildComponentSummaryById([...comps, { name: 'no id' }]);
    expect(Object.keys(map)).toEqual(['comp-a', 'comp-b', 'comp-c']);
    expect(map['comp-a']).toBe(renderComponentBlockForTask(comps[0]));
    expect(map['comp-c']).toBe(renderComponentBlockForTask(comps[2]));
  });
});

describe('collectDmr71Seeds', () => {
  type Prior = Parameters<typeof collectDmr71Seeds>[0];
  it('emits present artifact record ids in fixed FR/NFR/CM/IP order, skipping absent', () => {
    const prior = {
      functionalRequirements: { recordId: 'fr-1' },
      nonFunctionalRequirements: null,
      componentModel: { recordId: 'cm-1' },
      implementationPlan: { recordId: 'ip-1' },
    } as unknown as Prior;
    expect(collectDmr71Seeds(prior)).toEqual(['fr-1', 'cm-1', 'ip-1']);
  });

  it('emits all four when present, in order', () => {
    const prior = {
      functionalRequirements: { recordId: 'fr' },
      nonFunctionalRequirements: { recordId: 'nfr' },
      componentModel: { recordId: 'cm' },
      implementationPlan: { recordId: 'ip' },
    } as unknown as Prior;
    expect(collectDmr71Seeds(prior)).toEqual(['fr', 'nfr', 'cm', 'ip']);
  });

  it('returns [] when none are present', () => {
    const prior = {
      functionalRequirements: null,
      nonFunctionalRequirements: null,
      componentModel: null,
      implementationPlan: null,
    } as unknown as Prior;
    expect(collectDmr71Seeds(prior)).toEqual([]);
  });
});

describe('buildRootTestCasesFromPlan', () => {
  type Plan = Parameters<typeof buildRootTestCasesFromPlan>[0];
  const plan = {
    test_suites: [
      {
        suite_id: 'TS-1', component_id: 'comp-a', test_type: 'unit',
        test_cases: [
          {
            test_case_id: 'TC-1', type: 'unit', acceptance_criterion_ids: ['AC-1'],
            preconditions: ['p1'], execution_steps: ['do x', 'do y'],
            expected_outcome: 'works', edge_cases: ['edge'],
            property_spec: { invariant: 'i' },
          },
          {
            test_case_id: 'TC-2', type: 'integration', acceptance_criterion_ids: ['AC-2'],
            preconditions: [], component_ids: ['comp-z'],
          },
        ],
      },
      {
        suite_id: 'TS-2', component_id: '', test_type: 'unit',
        test_cases: [
          { test_case_id: 'TC-3', type: 'unit', acceptance_criterion_ids: ['AC-3'], preconditions: [] },
        ],
      },
    ],
  } as unknown as Plan;

  it('produces one root per test case, in suite-then-case order', () => {
    const roots = buildRootTestCasesFromPlan(plan, ['TECH-1']);
    expect(roots.map(r => r.id)).toEqual(['TC-1', 'TC-2', 'TC-3']);
  });

  it('TC-1: carries fields, inherits suite component_id, maps execution_steps, passes constraints', () => {
    const [tc1] = buildRootTestCasesFromPlan(plan, ['TECH-1']);
    expect(tc1).toMatchObject({
      id: 'TC-1',
      name: 'works',
      test_type: 'unit',
      component_ids: ['comp-a'],
      acceptance_criterion_ids: ['AC-1'],
      preconditions: ['p1'],
      expected_outcome: 'works',
      edge_cases: ['edge'],
      active_constraints: ['TECH-1'],
    });
    expect(tc1.steps).toEqual([
      { id: 'step-01', description: 'do x' },
      { id: 'step-02', description: 'do y' },
    ]);
    expect(tc1.property_spec).toEqual({ invariant: 'i' });
  });

  it('TC-2: own component_ids win; no steps/outcome → single synthetic step from test_case_id', () => {
    const roots = buildRootTestCasesFromPlan(plan, []);
    const tc2 = roots[1];
    expect(tc2.component_ids).toEqual(['comp-z']);
    expect(tc2.name).toBe('TC-2'); // no expected_outcome → falls back to test_case_id
    expect(tc2.steps).toEqual([{ id: 'step-01', description: 'TC-2' }]);
    expect(tc2.active_constraints).toEqual([]);
  });

  it('TC-3: falsy suite component_id → empty component_ids; synthetic step from test_case_id', () => {
    const roots = buildRootTestCasesFromPlan(plan, ['TECH-1']);
    const tc3 = roots[2];
    expect(tc3.component_ids).toEqual([]);
    expect(tc3.steps).toEqual([{ id: 'step-01', description: 'TC-3' }]);
  });
});

describe('retainAcCoverageOnPrune — root-vs-leaf coverage guard', () => {
  type Suite = Parameters<typeof retainAcCoverageOnPrune>[0][number];
  const suite = (suite_id: string, acsByCase: string[][]): Suite => ({
    suite_id,
    component_id: 'c',
    test_type: 'unit',
    test_cases: acsByCase.map((acs, i) => ({
      test_case_id: `${suite_id}-tc${i}`,
      acceptance_criterion_ids: acs,
    })),
  }) as unknown as Suite;

  it('re-keeps a dropped suite that holds the SOLE test for a leaf AC', () => {
    // cal-41 shape: kept suites cover AC-02..AC-05; the dropped tenant suite is
    // the ONLY cover for the deep-leaf AC-01a/AC-01b.
    const suites = [
      suite('kept-persist', [['AC-02'], ['AC-03']]),
      suite('dropped-tenant', [['AC-01a', 'AC-01b']]),
    ];
    const kept = retainAcCoverageOnPrune(suites, new Set(['kept-persist']));
    expect(kept.has('dropped-tenant')).toBe(true);
  });

  it('leaves a dropped suite dropped when all its ACs are already covered by kept suites', () => {
    const suites = [
      suite('kept', [['AC-01'], ['AC-02']]),
      suite('dropped-dup', [['AC-01'], ['AC-02']]), // fully duplicated
    ];
    const kept = retainAcCoverageOnPrune(suites, new Set(['kept']));
    expect(kept.has('dropped-dup')).toBe(false);
  });

  it('never shrinks the kept set and is idempotent', () => {
    const suites = [suite('a', [['AC-1']]), suite('b', [['AC-2']])];
    const once = retainAcCoverageOnPrune(suites, new Set(['a']));
    const twice = retainAcCoverageOnPrune(suites, once);
    expect([...twice].sort()).toEqual(['a', 'b']); // b rescued for unique AC-2
    expect(once.has('a')).toBe(true);
  });

  it('ignores empty/blank AC ids when deciding uniqueness', () => {
    const suites = [
      suite('kept', [['AC-1']]),
      suite('dropped-blank', [['', undefined as unknown as string]]),
    ];
    const kept = retainAcCoverageOnPrune(suites, new Set(['kept']));
    expect(kept.has('dropped-blank')).toBe(false); // no real AC → not rescued
  });
});

describe('buildComponentAcMap', () => {
  it('maps component_id → AC ids from tasks (AC-prefixed only)', () => {
    const map = buildComponentAcMap([
      { component_id: 'comp-a', traces_to: ['AC-1', 'AC-2', 'US-1', 'TECH-X'] },
      { component_id: 'comp-b', traces_to: ['AC-3'] },
    ]);
    expect([...(map.get('comp-a') ?? [])].sort()).toEqual(['AC-1', 'AC-2']);
    expect([...(map.get('comp-b') ?? [])]).toEqual(['AC-3']);
  });

  it('merges multiple tasks on the same component', () => {
    const map = buildComponentAcMap([
      { component_id: 'comp-a', traces_to: ['AC-1'] },
      { component_id: 'comp-a', traces_to: ['AC-2'] },
    ]);
    expect([...(map.get('comp-a') ?? [])].sort()).toEqual(['AC-1', 'AC-2']);
  });

  it('is array-safe: missing / boolean traces_to → no entry, never throws', () => {
    const map = buildComponentAcMap([
      { component_id: 'comp-a' },
      { component_id: 'comp-b', traces_to: true as unknown as string[] },
      { component_id: 'comp-c', traces_to: ['US-9'] }, // no AC-prefixed ids
    ]);
    expect(map.has('comp-a')).toBe(false);
    expect(map.has('comp-b')).toBe(false);
    expect(map.has('comp-c')).toBe(false);
  });
});

describe('computeUncoveredTestAcIds', () => {
  const leafAcIdSet = new Set(['AC-1', 'AC-2', 'AC-3', 'AC-4']);

  it('returns exactly the uncovered remainder', () => {
    const suites = [
      { suite_id: 'TS-1', component_id: 'comp-a', test_type: 'unit' as const, test_cases: [
        { test_case_id: 'TC-1', type: 'unit' as const, acceptance_criterion_ids: ['AC-1', 'AC-3'], preconditions: [], expected_outcome: 'ok' },
      ] },
    ];
    expect([...computeUncoveredTestAcIds(suites, leafAcIdSet)].sort()).toEqual(['AC-2', 'AC-4']);
  });

  it('is array-safe on a non-array acceptance_criterion_ids and ignores unknown ids', () => {
    const suites = [
      { suite_id: 'TS-1', component_id: 'comp-a', test_type: 'unit' as const, test_cases: [
        { test_case_id: 'TC-1', type: 'unit' as const, acceptance_criterion_ids: true as unknown as string[], preconditions: [], expected_outcome: 'ok' },
        { test_case_id: 'TC-2', type: 'unit' as const, acceptance_criterion_ids: ['AC-2', 'AC-UNKNOWN'], preconditions: [], expected_outcome: 'ok' },
      ] },
    ];
    expect([...computeUncoveredTestAcIds(suites, leafAcIdSet)].sort()).toEqual(['AC-1', 'AC-3', 'AC-4']);
  });
});

describe('parseTestSuites — envelope tolerance', () => {
  const suite = { suite_id: 'TS-1', component_id: 'comp-a', test_type: 'unit', test_cases: [] };

  it('accepts { test_suites: [...] }', () => {
    expect(parseTestSuites({ test_suites: [suite] })).toHaveLength(1);
  });
  it('accepts { test_plan: { test_suites: [...] } }', () => {
    expect(parseTestSuites({ test_plan: { test_suites: [suite] } })).toHaveLength(1);
  });
  it('accepts { test_plan: [ { test_suites: [...] } ] }', () => {
    expect(parseTestSuites({ test_plan: [{ test_suites: [suite] }] })).toHaveLength(1);
  });
  it('returns [] for null / unrecognised', () => {
    expect(parseTestSuites(null)).toEqual([]);
    expect(parseTestSuites({})).toEqual([]);
    expect(parseTestSuites({ nonsense: 1 })).toEqual([]);
  });
});

describe('renderScopedAcMenu', () => {
  it('renders ONLY the mapped component\'s ACs, not other components\' ACs', () => {
    const map = new Map([['comp-a', new Set(['AC-1', 'AC-2'])]]);
    const out = renderScopedAcMenu('comp-a', map, leaves());
    expect(out).toContain('AC-1');
    expect(out).toContain('AC-2');
    expect(out).not.toContain('AC-3');
    expect(out).not.toContain('AC-4');
    expect(out).not.toContain('US-2');
    expect(out).not.toContain('US-3');
  });

  it('falls back to the FULL menu for an unmapped component (never starve)', () => {
    const map = new Map([['comp-a', new Set(['AC-1'])]]);
    const out = renderScopedAcMenu('comp-c', map, leaves());
    expect(out).toContain('AC-1');
    expect(out).toContain('AC-2');
    expect(out).toContain('AC-3');
    expect(out).toContain('AC-4');
  });

  it('falls back to the FULL menu when none of the mapped ids resolve', () => {
    const map = new Map([['comp-a', new Set(['AC-NOPE'])]]);
    const out = renderScopedAcMenu('comp-a', map, leaves());
    expect(out).toContain('AC-1');
    expect(out).toContain('AC-4');
  });
});

describe('caseCoversAny', () => {
  const set = new Set(['AC-2', 'AC-4']);
  it('true iff acceptance_criterion_ids ∩ idSet', () => {
    expect(caseCoversAny({ acceptance_criterion_ids: ['AC-1', 'AC-4'] }, set)).toBe(true);
    expect(caseCoversAny({ acceptance_criterion_ids: ['AC-1', 'AC-3'] }, set)).toBe(false);
  });
  it('array-safe on a non-array field', () => {
    expect(caseCoversAny({ acceptance_criterion_ids: true as unknown as string[] }, set)).toBe(false);
  });
});

describe('dedupeTestSuiteIds', () => {
  it('renumbers colliding suite/case ids, preserves verbatim uniques', () => {
    const merged = dedupeTestSuiteIds([
      { suite_id: 'TS-001', component_id: 'comp-a', test_type: 'unit', test_cases: [
        { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-1'], preconditions: [], expected_outcome: 'x' },
      ] },
      { suite_id: 'TS-001', component_id: 'comp-b', test_type: 'unit', test_cases: [
        { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-3'], preconditions: [], expected_outcome: 'x' },
      ] },
    ]);
    const suiteIds = merged.map(s => s.suite_id);
    const caseIds = merged.flatMap(s => s.test_cases.map(t => t.test_case_id));
    expect(new Set(suiteIds).size).toBe(2); // no data loss / collision
    expect(new Set(caseIds).size).toBe(2);
    expect(suiteIds[0]).toBe('TS-001'); // first occurrence preserved verbatim
    expect(caseIds[0]).toBe('TC-001');
  });
});

// ── Integration: chunkedCoverageBloom + reconciliation ─────────────

describe('Phase7Handler.runTestCaseGeneration — per-component chunking + reconciliation', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const cm = new ConfigManager();
    engine = new OrchestratorEngine(db, cm, workspacePath, extensionPath);
    engine.setAutoApproveDecisions(true);
  });
  afterEach(() => { db.close(); });

  function configureMock(mock: MockLLMProvider): void {
    engine.llmCaller.registerProvider(mock.bindAsProvider('llamacpp'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'qwen3.5:9b' },
      temperature: 0.4,
    });
  }

  const dmr: PhaseContextPacketResult = {
    packet: null,
    activeConstraintsText: '(none)',
    detailFilePath: '(n/a)',
    detailFileContent: '(none)',
    derivedFromRecordIds: [],
  };

  interface RunPlan {
    test_suites: Array<{
      suite_id: string; component_id: string; test_type?: string;
      test_cases: Array<{ test_case_id: string; type?: string; acceptance_criterion_ids: string[] }>;
    }>;
  }
  type GenFn = (
    ctx: { engine: OrchestratorEngine; workflowRun: { id: string } },
    leafComponents: Array<Record<string, unknown>>,
    leafAcs: LeafAcceptanceCriteria[],
    componentAcMap: Map<string, Set<string>>,
    dmr: PhaseContextPacketResult,
  ) => Promise<RunPlan>;

  function genFn(): GenFn {
    const handler = new Phase7Handler();
    return (handler as unknown as { runTestCaseGeneration: GenFn })
      .runTestCaseGeneration.bind(handler);
  }

  const fullMap = () => new Map<string, Set<string>>([
    ['comp-a', new Set(['AC-1', 'AC-2'])],
    ['comp-b', new Set(['AC-3'])],
    ['comp-c', new Set(['AC-4'])],
  ]);

  it('(a) one generation call PER component, each scoped to only its own ACs (anti-monolith)', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('RESP-COMP-A-MARKER', { parsedJson: { test_suites: [
      { suite_id: 'TS-001', component_id: 'comp-a', test_type: 'unit', test_cases: [
        { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-1', 'AC-2'], preconditions: ['p'], expected_outcome: 'a' },
      ] },
    ] } });
    mock.setFixture('RESP-COMP-B-MARKER', { parsedJson: { test_suites: [
      { suite_id: 'TS-001', component_id: 'comp-b', test_type: 'unit', test_cases: [
        { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-3'], preconditions: ['p'], expected_outcome: 'b' },
      ] },
    ] } });
    mock.setFixture('RESP-COMP-C-MARKER', { parsedJson: { test_suites: [
      { suite_id: 'TS-001', component_id: 'comp-c', test_type: 'unit', test_cases: [
        { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-4'], preconditions: ['p'], expected_outcome: 'c' },
      ] },
    ] } });
    configureMock(mock);
    const { run } = engine.startWorkflowRun('ws', 'test');

    await genFn()({ engine, workflowRun: { id: run.id } }, components(), leaves(), fullMap(), dmr);

    const genCalls = mock.getCallLog().filter(c => c.options.traceContext?.subPhaseId === 'test_case_skeleton');
    expect(genCalls).toHaveLength(3); // exactly one per component

    const promptA = genCalls.map(c => c.options.prompt ?? '').find(p => p.includes('RESP-COMP-A-MARKER'))!;
    expect(promptA).toBeDefined();
    // comp-a's prompt carries ONLY its own ACs.
    expect(promptA).toContain('AC-1');
    expect(promptA).toContain('AC-2');
    expect(promptA).not.toContain('AC-3');
    expect(promptA).not.toContain('AC-4');

    // Anti-monolith regression: NO generation prompt ever carries all ACs at once.
    for (const c of genCalls) {
      const p = c.options.prompt ?? '';
      const carriesAll = p.includes('AC-1') && p.includes('AC-2') && p.includes('AC-3') && p.includes('AC-4');
      expect(carriesAll).toBe(false);
    }
  });

  it('(b) reconciliation fires for orphan ACs → merged plan reaches 100% coverage', async () => {
    const mock = new MockLLMProvider();
    // comp-a covers only AC-1 (leaves AC-2 orphan); comp-b→AC-3; comp-c→AC-4.
    mock.setFixture('RESP-COMP-A-MARKER', { parsedJson: { test_suites: [
      { suite_id: 'TS-001', component_id: 'comp-a', test_type: 'unit', test_cases: [
        { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-1'], preconditions: ['p'], expected_outcome: 'a' },
      ] },
    ] } });
    mock.setFixture('RESP-COMP-B-MARKER', { parsedJson: { test_suites: [
      { suite_id: 'TS-001', component_id: 'comp-b', test_type: 'unit', test_cases: [
        { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-3'], preconditions: ['p'], expected_outcome: 'b' },
      ] },
    ] } });
    mock.setFixture('RESP-COMP-C-MARKER', { parsedJson: { test_suites: [
      { suite_id: 'TS-001', component_id: 'comp-c', test_type: 'unit', test_cases: [
        { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-4'], preconditions: ['p'], expected_outcome: 'c' },
      ] },
    ] } });
    // Reconciliation fixture (checked first — distinctive marker) covers AC-2.
    mock.setFixture('COVERAGE RECONCILIATION', { parsedJson: { test_suites: [
      { suite_id: 'TS-RECON', component_id: 'comp-a', test_type: 'unit', test_cases: [
        { test_case_id: 'TC-RECON', type: 'unit', acceptance_criterion_ids: ['AC-2'], preconditions: ['p'], expected_outcome: 'recon' },
      ] },
    ] } });
    configureMock(mock);
    const { run } = engine.startWorkflowRun('ws', 'test');

    const plan = await genFn()({ engine, workflowRun: { id: run.id } }, components(), leaves(), fullMap(), dmr);

    const leafAcIdSet = new Set(['AC-1', 'AC-2', 'AC-3', 'AC-4']);
    expect([...computeUncoveredTestAcIds(plan.test_suites, leafAcIdSet)]).toEqual([]);
    // A reconciliation call actually fired.
    const reconCalls = mock.getCallLog().filter(c => c.options.traceContext?.subPhaseId === 'test_case_reconciliation');
    expect(reconCalls.length).toBeGreaterThan(0);
  });

  it('(c) suite/case ids are deduped across chunks (no collision / data loss)', async () => {
    const mock = new MockLLMProvider();
    // Every component restarts numbering at TS-001 / TC-001.
    for (const [marker, comp, ac] of [['RESP-COMP-A-MARKER', 'comp-a', 'AC-1'], ['RESP-COMP-B-MARKER', 'comp-b', 'AC-3'], ['RESP-COMP-C-MARKER', 'comp-c', 'AC-4']] as const) {
      mock.setFixture(marker, { parsedJson: { test_suites: [
        { suite_id: 'TS-001', component_id: comp, test_type: 'unit', test_cases: [
          { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: [ac], preconditions: ['p'], expected_outcome: comp },
        ] },
      ] } });
    }
    // comp-a covers both AC-1 + AC-2 (all ACs covered → no recon); the merge
    // still must not collapse the 3 distinct TS-001 suites into one.
    mock.setFixture('RESP-COMP-A-MARKER', { parsedJson: { test_suites: [
      { suite_id: 'TS-001', component_id: 'comp-a', test_type: 'unit', test_cases: [
        { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-1', 'AC-2'], preconditions: ['p'], expected_outcome: 'a' },
      ] },
    ] } });
    configureMock(mock);
    const { run } = engine.startWorkflowRun('ws', 'test');

    const plan = await genFn()({ engine, workflowRun: { id: run.id } }, components(), leaves(), fullMap(), dmr);

    expect(plan.test_suites).toHaveLength(3); // all three distinct suites survived
    const suiteIds = plan.test_suites.map(s => s.suite_id);
    const caseIds = plan.test_suites.flatMap(s => s.test_cases.map(t => t.test_case_id));
    expect(new Set(suiteIds).size).toBe(suiteIds.length); // globally unique
    expect(new Set(caseIds).size).toBe(caseIds.length);
  });

  it('(d) budget exhausted → honest residual, NO fabricated case', async () => {
    const prev = process.env.JANUMICODE_P7_RECON_PASSES;
    process.env.JANUMICODE_P7_RECON_PASSES = '0'; // no reconciliation
    try {
      const mock = new MockLLMProvider();
      // comp-a covers only AC-1 → AC-2 orphan and never reconciled.
      mock.setFixture('RESP-COMP-A-MARKER', { parsedJson: { test_suites: [
        { suite_id: 'TS-001', component_id: 'comp-a', test_type: 'unit', test_cases: [
          { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-1'], preconditions: ['p'], expected_outcome: 'a' },
        ] },
      ] } });
      mock.setFixture('RESP-COMP-B-MARKER', { parsedJson: { test_suites: [
        { suite_id: 'TS-001', component_id: 'comp-b', test_type: 'unit', test_cases: [
          { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-3'], preconditions: ['p'], expected_outcome: 'b' },
        ] },
      ] } });
      mock.setFixture('RESP-COMP-C-MARKER', { parsedJson: { test_suites: [
        { suite_id: 'TS-001', component_id: 'comp-c', test_type: 'unit', test_cases: [
          { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-4'], preconditions: ['p'], expected_outcome: 'c' },
        ] },
      ] } });
      configureMock(mock);
      const { run } = engine.startWorkflowRun('ws', 'test');

      const plan = await genFn()({ engine, workflowRun: { id: run.id } }, components(), leaves(), fullMap(), dmr);

      // No reconciliation call fired.
      expect(mock.getCallLog().filter(c => c.options.traceContext?.subPhaseId === 'test_case_reconciliation')).toHaveLength(0);
      // AC-2 is honestly uncovered; nothing fabricated to cover it.
      const leafAcIdSet = new Set(['AC-1', 'AC-2', 'AC-3', 'AC-4']);
      expect([...computeUncoveredTestAcIds(plan.test_suites, leafAcIdSet)]).toEqual(['AC-2']);
      const allCitedAcs = plan.test_suites.flatMap(s => s.test_cases.flatMap(t => t.acceptance_criterion_ids));
      // Only the 3 genuinely-generated cases; every cited AC is real (never invented).
      expect(allCitedAcs.sort()).toEqual(['AC-1', 'AC-3', 'AC-4']);
    } finally {
      if (prev === undefined) delete process.env.JANUMICODE_P7_RECON_PASSES;
      else process.env.JANUMICODE_P7_RECON_PASSES = prev;
    }
  });

  it('(e) component absent from componentAcMap → full AC menu (no starvation)', async () => {
    const mock = new MockLLMProvider();
    for (const [marker, comp] of [['RESP-COMP-A-MARKER', 'comp-a'], ['RESP-COMP-B-MARKER', 'comp-b'], ['RESP-COMP-C-MARKER', 'comp-c']] as const) {
      mock.setFixture(marker, { parsedJson: { test_suites: [
        { suite_id: 'TS-001', component_id: comp, test_type: 'unit', test_cases: [
          { test_case_id: 'TC-001', type: 'unit', acceptance_criterion_ids: ['AC-1'], preconditions: ['p'], expected_outcome: comp },
        ] },
      ] } });
    }
    configureMock(mock);
    const { run } = engine.startWorkflowRun('ws', 'test');

    // comp-c intentionally absent from the map → full-menu fallback.
    const partialMap = new Map<string, Set<string>>([
      ['comp-a', new Set(['AC-1', 'AC-2'])],
      ['comp-b', new Set(['AC-3'])],
    ]);
    await genFn()({ engine, workflowRun: { id: run.id } }, components(), leaves(), partialMap, dmr);

    const promptC = mock.getCallLog()
      .filter(c => c.options.traceContext?.subPhaseId === 'test_case_skeleton')
      .map(c => c.options.prompt ?? '')
      .find(p => p.includes('RESP-COMP-C-MARKER'))!;
    expect(promptC).toBeDefined();
    // Fallback shows the FULL menu (all ACs) so comp-c is never starved of citable ids.
    expect(promptC).toContain('AC-1');
    expect(promptC).toContain('AC-2');
    expect(promptC).toContain('AC-3');
    expect(promptC).toContain('AC-4');
  });
});
