/**
 * PA-6 — component_saturation domain-context scoping.
 * Before: every per-component saturation call injected ALL ~18 software domains
 * (each transitively carrying every SR id) into the domain_context slot. After:
 * each call sees only its PARENT's own domain block + a thin id:name index of
 * the others; falls back to the full catalog when the domain can't be resolved.
 * Mirrors the DONE PA-4 componentSummaryById pattern.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { ConfigManager } from '../../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';
import {
  runComponentSaturationLoop,
  formatScopedDomainContext,
} from '../../../../lib/orchestrator/phases/phase4_2a';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import type {
  DecompositionComponent,
  ComponentDecompositionNodeContent,
  ProductDescriptionHandoffContent,
} from '../../../../lib/types/records';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-pa6-'));

function tinyHandoff(): ProductDescriptionHandoffContent {
  return {
    kind: 'product_description_handoff', schemaVersion: '1.1', requestCategory: 'product_or_feature',
    productVision: 'Test', productDescription: 'Test', summary: 'Test',
    personas: [], userJourneys: [], phasingStrategy: [], successMetrics: [], businessDomainProposals: [],
    entityProposals: [], workflowProposals: [], integrationProposals: [], qualityAttributes: [],
    uxRequirements: [], requirements: [], decisions: [], constraints: [], openQuestions: [],
    technicalConstraints: [], complianceExtractedItems: [], vvRequirements: [], canonicalVocabulary: [],
    humanDecisions: [], openLoops: [],
  };
}

function seedRootNode(engine: OrchestratorEngine, runId: string, component: DecompositionComponent) {
  const logicalNodeId = `root-${component.id}-uuid`;
  const rec = engine.writer.writeRecord({
    record_type: 'component_decomposition_node', schema_version: '1.0', workflow_run_id: runId,
    phase_id: '4', sub_phase_id: 'component_saturation', produced_by_agent_role: 'architecture_agent',
    janumicode_version_sha: 'dev', derived_from_record_ids: [],
    content: {
      kind: 'component_decomposition_node', node_id: logicalNodeId, parent_node_id: null,
      display_key: component.id, root_component_id: logicalNodeId, depth: 0, pass_number: 0,
      status: 'pending', component, surfaced_assumption_ids: [], release_id: null, release_ordinal: null,
    } satisfies ComponentDecompositionNodeContent,
  });
  return { recordId: rec.id, logicalNodeId };
}

// ── Pure helper ────────────────────────────────────────────────────
describe('formatScopedDomainContext (PA-6 pure)', () => {
  const input = {
    domainContextById: { 'domain-a': 'BLOCK_A', 'domain-b': 'BLOCK_B' },
    domainIndex: 'domain-a: Alpha\ndomain-b: Beta',
    domainsSummary: 'FULL_CATALOG',
  };

  it('(a) resolvable id + index → own block + index header, NOT the full catalog or a sibling block', () => {
    const out = formatScopedDomainContext('domain-a', input);
    expect(out).toContain('BLOCK_A');
    expect(out).toContain('Other software domains (index only):');
    expect(out).toContain('domain-b: Beta');
    expect(out).not.toContain('BLOCK_B');
    expect(out).not.toContain('FULL_CATALOG');
  });

  it('(b) null/undefined id → full catalog fallback', () => {
    expect(formatScopedDomainContext(null, input)).toBe('FULL_CATALOG');
    expect(formatScopedDomainContext(undefined, input)).toBe('FULL_CATALOG');
  });

  it('(c) id absent from map → full catalog fallback', () => {
    expect(formatScopedDomainContext('domain-zzz', input)).toBe('FULL_CATALOG');
  });

  it('(d) index absent → own block only (no index header)', () => {
    const out = formatScopedDomainContext('domain-a', { domainContextById: { 'domain-a': 'BLOCK_A' }, domainsSummary: 'FULL_CATALOG' });
    expect(out).toBe('BLOCK_A');
  });

  it('(e) map absent (back-compat: only domainsSummary passed) → full catalog', () => {
    expect(formatScopedDomainContext('domain-a', { domainsSummary: 'FULL_CATALOG' })).toBe('FULL_CATALOG');
  });
});

// ── Loop-level anti-monolith regression ────────────────────────────
describe('runComponentSaturationLoop — PA-6 domain scoping', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  beforeEach(() => {
    db = createTestDatabase();
    engine = new OrchestratorEngine(db, new ConfigManager(), workspacePath, extensionPath);
    engine.setAutoApproveDecisions(true);
  });
  afterEach(() => { db.close(); });

  // Proven pattern (mirrors the green atomic-outcome case): a decomposable root
  // whose single child is Tier-D (terminal) → exactly one decompose call for the
  // root (whose prompt we inspect), and the branch terminates in one pass.
  function decomposeMock(rootId: string, respId: string): MockLLMProvider {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: rootId,
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'macro subsystem' },
        children: [{
          id: `${rootId}-leaf`, tier: 'D', name: `${rootId} leaf`,
          responsibilities: [{ id: 'resp-leaf-1', description: 'Concrete leaf work' }],
          dependencies: [], domain_id: 'domain-a', traces_to: [respId],
          decomposition_rationale: 'Concrete leaf module.',
        }],
        surfaced_assumptions: [],
      },
    });
    engine.llmCaller.registerProvider(mock.bindAsProvider('llamacpp'));
    engine.configManager.setDomainInterpreterRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'qwen3.5:9b' }, temperature: 0.5,
    });
    return mock;
  }

  const loopInputBase = {
    handoff: tinyHandoff(),
    technicalConstraints: [],
    domainsSummary: 'FULL_CATALOG_MARKER',
    domainContextById: { 'domain-a': 'DOMAIN_A_FULL_BLOCK', 'domain-b': 'DOMAIN_B_FULL_BLOCK' },
    domainIndex: 'domain-a: Alpha\ndomain-b: Beta',
  };

  it('scopes the domain_context to the parent domain (excludes sibling block + full catalog)', async () => {
    const mock = decomposeMock("comp-a", "resp-a1");
    const { run } = engine.startWorkflowRun('ws', 'test');
    const root: DecompositionComponent = {
      id: 'comp-a', name: 'Alpha Component', domain_id: 'domain-a',
      responsibilities: [{ id: 'resp-a1', description: 'Do alpha things' }], dependencies: [], active_constraints: [],
    };
    const seeded = seedRootNode(engine, run.id, root);
    await runComponentSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runComponentSaturationLoop>[0]['workflowRun'] },
      { ...loopInputBase, rootComponents: [root], rootNodeRecordIds: [seeded.recordId], rootLogicalIds: [seeded.logicalNodeId] },
    );
    const prompt = mock.getCallLog().map(c => c.options.prompt).find(p => p.includes('DOMAIN_A_FULL_BLOCK'));
    expect(prompt).toBeDefined();
    expect(prompt!).toContain('DOMAIN_A_FULL_BLOCK');
    expect(prompt!).toContain('domain-b: Beta');            // thin index line is allowed
    expect(prompt!).not.toContain('DOMAIN_B_FULL_BLOCK');   // sibling's full block excluded
    expect(prompt!).not.toContain('FULL_CATALOG_MARKER');   // no full-catalog fallback fired
  });

  it('falls back to the full catalog when the parent has no domain_id', async () => {
    const mock = decomposeMock("comp-x", "resp-x1");
    const { run } = engine.startWorkflowRun('ws', 'test');
    const root: DecompositionComponent = {
      id: 'comp-x', name: 'Domainless Component', domain_id: null,
      responsibilities: [{ id: 'resp-x1', description: 'Do things' }], dependencies: [], active_constraints: [],
    };
    const seeded = seedRootNode(engine, run.id, root);
    await runComponentSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runComponentSaturationLoop>[0]['workflowRun'] },
      { ...loopInputBase, rootComponents: [root], rootNodeRecordIds: [seeded.recordId], rootLogicalIds: [seeded.logicalNodeId] },
    );
    const prompt = mock.getCallLog().map(c => c.options.prompt).find(p => p.includes('comp-x'));
    expect(prompt).toBeDefined();
    expect(prompt!).toContain('FULL_CATALOG_MARKER');
  });

  // PA-7 (verify-and-lock): the parent block and the call label are BOTH derived
  // from the same queued `entry` (parent_component = formatRootComponentForPrompt(
  // entry.component); label uses entry.displayKey). This locks that they never
  // diverge — the audit's "label ≠ injected parent" is refuted by single-sourcing.
  it('PA-7: parent-block id == label id == queued node id (single-sourced)', async () => {
    const mock = decomposeMock('comp-pa7-target', 'resp-1');
    const { run } = engine.startWorkflowRun('ws', 'test');
    const root: DecompositionComponent = {
      id: 'comp-pa7-target', name: 'Target', domain_id: 'domain-a',
      responsibilities: [{ id: 'resp-1', description: 'Do target things' }], dependencies: [], active_constraints: [],
    };
    const seeded = seedRootNode(engine, run.id, root);
    await runComponentSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runComponentSaturationLoop>[0]['workflowRun'] },
      { ...loopInputBase, rootComponents: [root], rootNodeRecordIds: [seeded.recordId], rootLogicalIds: [seeded.logicalNodeId] },
    );
    const call = mock.getCallLog().find(c => c.options.prompt.includes('Component id: comp-pa7-target'));
    expect(call).toBeDefined();
    // Parent block reflects the queued node...
    expect(call!.options.prompt).toContain('Component id: comp-pa7-target');
    // ...and the call label reflects the SAME node id (never a different one).
    expect(call!.options.traceContext?.label).toContain('comp-pa7-target');
  });
});
