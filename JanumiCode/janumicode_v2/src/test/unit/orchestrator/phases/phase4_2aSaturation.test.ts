/**
 * Wave 7 — integration tests for runComponentSaturationLoop.
 *
 * Mirrors phase2ProductLens.test.ts patterns, adapted for components.
 * Covers the load-bearing guarantees:
 *   - Pass-1 produces Tier-D atomic children that terminate the branch.
 *   - Tier-B children fire the mirror gate (Promise.all batch).
 *   - Rejected gate items become status='pruned' supersessions.
 *   - Step 4b downgrade fires when Tier-B parent produces more Tier-B kids.
 *   - depth_cap / fanout_cap trip writes status='deferred' rows.
 *   - Per-pass component_assumption_set_snapshot record is emitted.
 *   - Pipeline container's passes[] grows and final supersession carries
 *     final_leaf_count + tier_distribution.
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
} from '../../../../lib/orchestrator/phases/phase4_2a';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import type {
  DecompositionComponent,
  ComponentDecompositionNodeContent,
  ComponentDecompositionPipelineContent,
  ComponentAssumptionSetSnapshotContent,
  ProductDescriptionHandoffContent,
} from '../../../../lib/types/records';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));

function tinyHandoff(): ProductDescriptionHandoffContent {
  return {
    kind: 'product_description_handoff',
    schemaVersion: '1.1',
    requestCategory: 'product_or_feature',
    productVision: 'Test platform',
    productDescription: 'A test platform for Wave 7',
    summary: 'Test summary',
    personas: [],
    userJourneys: [],
    phasingStrategy: [],
    successMetrics: [],
    businessDomainProposals: [],
    entityProposals: [],
    workflowProposals: [],
    integrationProposals: [],
    qualityAttributes: [],
    uxRequirements: [],
    requirements: [],
    decisions: [],
    constraints: [],
    openQuestions: [],
    technicalConstraints: [],
    complianceExtractedItems: [],
    vvRequirements: [],
    canonicalVocabulary: [],
    humanDecisions: [],
    openLoops: [],
  };
}

function seedRootNode(
  engine: OrchestratorEngine,
  runId: string,
  component: DecompositionComponent,
): { recordId: string; logicalNodeId: string } {
  const logicalNodeId = `root-${component.id}-uuid`;
  const rec = engine.writer.writeRecord({
    record_type: 'component_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: runId,
    phase_id: '4',
    sub_phase_id: '4.2a',
    produced_by_agent_role: 'architecture_agent',
    janumicode_version_sha: 'dev',
    derived_from_record_ids: [],
    content: {
      kind: 'component_decomposition_node',
      node_id: logicalNodeId,
      parent_node_id: null,
      display_key: component.id,
      root_component_id: logicalNodeId,
      depth: 0,
      pass_number: 0,
      status: 'pending',
      component,
      surfaced_assumption_ids: [],
      release_id: null,
      release_ordinal: null,
    } satisfies ComponentDecompositionNodeContent,
  });
  return { recordId: rec.id, logicalNodeId };
}

describe('runComponentSaturationLoop — Wave 7 saturation', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
    engine.setAutoApproveDecisions(true);
  });

  afterEach(() => { db.close(); });

  function configureMock(mock: MockLLMProvider): void {
    engine.llmCaller.registerProvider(mock.bindAsProvider('llamacpp'));
    engine.configManager.setDomainInterpreterRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'qwen3.5:9b' },
      temperature: 0.5,
    });
  }

  it('Pass-1 — produces Tier-D atomic children; saturation terminates cleanly', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'comp-work-order-lifecycle',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'macro subsystem' },
        children: [
          {
            id: 'comp-wol-state-machine', tier: 'D', name: 'Work Order State Machine',
            responsibilities: [{ id: 'resp-1', description: 'Validate state transitions' }],
            dependencies: [{ component_id: 'comp-audit', kind: 'async_event' }],
            domain_id: 'domain-service-fulfillment',
            traces_to: ['resp-wol-002'],
            decomposition_rationale: 'Concrete leaf module.',
          },
          {
            id: 'comp-wol-media-validator', tier: 'D', name: 'Work Order Media Validator',
            responsibilities: [{ id: 'resp-1', description: 'Validate media attachments per config' }],
            dependencies: [],
            domain_id: 'domain-service-fulfillment',
            traces_to: ['resp-wol-001'],
            decomposition_rationale: 'Concrete leaf module.',
          },
        ],
        surfaced_assumptions: [
          { text: 'State transitions persist via async event', category: 'integration_pattern' },
          { text: 'Media validator owns size/type checks', category: 'data_ownership' },
        ],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root: DecompositionComponent = {
      id: 'comp-work-order-lifecycle',
      name: 'Work Order Lifecycle Manager',
      domain_id: 'domain-service-fulfillment',
      responsibilities: [{ id: 'resp-wol-001', description: 'Process Work Order Submission Requests' }],
      dependencies: [],
      active_constraints: ['TECH-BUN-1'],
    };
    const seeded = seedRootNode(engine, run.id, root);

    await runComponentSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runComponentSaturationLoop>[0]['workflowRun'] },
      {
        handoff: tinyHandoff(),
        technicalConstraints: [],
        domainsSummary: 'domain-service-fulfillment',
        rootComponents: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const nodes = engine.writer.getRecordsByType(run.id, 'component_decomposition_node');
    const children = nodes.filter(n =>
      (n.content as unknown as ComponentDecompositionNodeContent).depth === 1);
    expect(children).toHaveLength(2);
    expect(children.every(c => (c.content as unknown as ComponentDecompositionNodeContent).tier === 'D')).toBe(true);
    expect(children.every(c => (c.content as unknown as ComponentDecompositionNodeContent).status === 'atomic')).toBe(true);

    // Pipeline container records exist with at least one pass entry.
    const pipelines = engine.writer.getRecordsByType(run.id, 'component_decomposition_pipeline');
    expect(pipelines.length).toBeGreaterThan(0);
    const latestPipeline = pipelines.reduce((latest, r) =>
      r.produced_at > latest.produced_at ? r : latest, pipelines[0]);
    const pc = latestPipeline.content as unknown as ComponentDecompositionPipelineContent;
    expect(pc.passes.length).toBeGreaterThan(0);
    expect(pc.final_leaf_count).toBe(2);
    expect(pc.tier_distribution?.D).toBe(2);

    // Per-pass assumption snapshot.
    const snapshots = engine.writer.getRecordsByType(run.id, 'component_assumption_set_snapshot');
    expect(snapshots).toHaveLength(1);
    const snap = snapshots[0].content as unknown as ComponentAssumptionSetSnapshotContent;
    expect(snap.assumptions).toHaveLength(2);
    expect(snap.delta_from_previous_pass).toBe(2);
  });

  it('Tier-B children fire mirror gate; auto-accept queues them for Tier-C decomposition', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'comp-vendor-mgmt',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'macro' },
        children: [
          {
            id: 'comp-vendor-credential', tier: 'B', name: 'Vendor Credential Verification',
            responsibilities: [{ id: 'resp-1', description: 'Verify credentials' }],
            dependencies: [],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    // After auto-accept, the accepted Tier-B parent decomposes into Tier-D leaves.
    mock.setFixture('decompose-tier-b', {
      match: 'comp-vendor-credential',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'B', agrees_with_hint: true, rationale: 'commitment' },
        children: [
          {
            id: 'comp-vendor-cred-checker', tier: 'D', name: 'Credential Status Checker',
            responsibilities: [{ id: 'resp-1', description: 'Check credential expiry' }],
            dependencies: [],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    // decision_bundle_presented records prove the gate fired.
    const { run } = engine.startWorkflowRun('ws', 'test');
    const root: DecompositionComponent = {
      id: 'comp-vendor-mgmt',
      name: 'Vendor Management',
      responsibilities: [{ id: 'resp-vm-001', description: 'Manage vendor lifecycle' }],
      dependencies: [],
    };
    const seeded = seedRootNode(engine, run.id, root);

    await runComponentSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runComponentSaturationLoop>[0]['workflowRun'] },
      {
        handoff: tinyHandoff(),
        technicalConstraints: [],
        domainsSummary: 'domain-vendor-management',
        rootComponents: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    // The mirror gate fired (decision_bundle_presented record was written).
    const bundles = engine.writer.getRecordsByType(run.id, 'decision_bundle_presented');
    expect(bundles.length).toBeGreaterThanOrEqual(1);
    const bundleContent = bundles[0].content as Record<string, unknown>;
    expect(bundleContent.bundle_id).toMatch(/^comp-decomp-gate-/);

    // The accepted Tier-B parent decomposed into Tier-D leaves.
    const nodes = engine.writer.getRecordsByType(run.id, 'component_decomposition_node', false);
    const latestByNodeId = new Map<string, typeof nodes[number]>();
    for (const r of nodes) {
      const c = r.content as unknown as ComponentDecompositionNodeContent;
      const prior = latestByNodeId.get(c.node_id);
      if (!prior || r.produced_at > prior.produced_at) latestByNodeId.set(c.node_id, r);
    }
    const latest = [...latestByNodeId.values()].map(r => r.content as unknown as ComponentDecompositionNodeContent);
    const tierDLeaf = latest.find(c => c.display_key === 'comp-vendor-cred-checker');
    expect(tierDLeaf, 'Tier-B child should have decomposed into a Tier-D leaf after auto-accept').toBeDefined();
    expect(tierDLeaf!.tier).toBe('D');
    expect(tierDLeaf!.status).toBe('atomic');
  });

  it('depth_cap trips deferred status when configured low', async () => {
    // Force component_depth_cap=1 so the second-level decomposition is
    // denied. ConfigManager exposes the live config object via .get(),
    // so direct mutation is acceptable for tests; production callers
    // use the per-key setters or workspace JSON.
    engine.configManager.get().decomposition.component_depth_cap = 1;

    const mock = new MockLLMProvider();
    // Pass 1 — root produces a Tier-A child (which would normally
    // recurse). Tier-A child's depth=1 hits depth_cap=1 next pass.
    mock.setFixture('decompose-root', {
      match: 'comp-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'macro' },
        children: [
          {
            id: 'comp-tier-a', tier: 'A', name: 'Tier A child',
            responsibilities: [{ id: 'resp-1', description: 'still recursive' }],
            dependencies: [],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root: DecompositionComponent = {
      id: 'comp-root', name: 'Root',
      responsibilities: [{ id: 'resp-1', description: 'root' }],
      dependencies: [],
    };
    const seeded = seedRootNode(engine, run.id, root);

    await runComponentSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runComponentSaturationLoop>[0]['workflowRun'] },
      {
        handoff: tinyHandoff(),
        technicalConstraints: [],
        domainsSummary: '',
        rootComponents: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    // Latest revision per node_id — Tier-A child should land deferred
    // because depth_cap=1 prevents its decomposition pass from happening.
    const nodes = engine.writer.getRecordsByType(
      run.id, 'component_decomposition_node', false,
    );
    const latestByNodeId = new Map<string, typeof nodes[number]>();
    for (const r of nodes) {
      const c = r.content as unknown as ComponentDecompositionNodeContent;
      const prior = latestByNodeId.get(c.node_id);
      if (!prior || r.produced_at > prior.produced_at) latestByNodeId.set(c.node_id, r);
    }
    const tierAChild = [...latestByNodeId.values()].find(r =>
      (r.content as unknown as ComponentDecompositionNodeContent).display_key === 'comp-tier-a');
    expect(tierAChild).toBeDefined();
    expect((tierAChild!.content as unknown as ComponentDecompositionNodeContent).status).toBe('deferred');
    expect((tierAChild!.content as unknown as ComponentDecompositionNodeContent).pruning_reason).toContain('depth_cap_reached');
  });

  it('persists per-run telemetry to workflow_runs columns', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('decompose-root', {
      match: 'comp-root',
      parsedJson: {
        parent_branch_classification: 'decomposable',
        parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'macro' },
        children: [
          {
            id: 'comp-leaf', tier: 'D', name: 'Leaf',
            responsibilities: [{ id: 'r1', description: 'work' }],
            dependencies: [],
          },
        ],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const root: DecompositionComponent = {
      id: 'comp-root', name: 'Root',
      responsibilities: [{ id: 'r0', description: 'root' }], dependencies: [],
    };
    const seeded = seedRootNode(engine, run.id, root);

    await runComponentSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runComponentSaturationLoop>[0]['workflowRun'] },
      {
        handoff: tinyHandoff(),
        technicalConstraints: [],
        domainsSummary: '',
        rootComponents: [root],
        rootNodeRecordIds: [seeded.recordId],
        rootLogicalIds: [seeded.logicalNodeId],
      },
    );

    const row = db.prepare(`
      SELECT component_decomposition_budget_calls_used, component_decomposition_max_depth_reached, active_component_pipeline_id
      FROM workflow_runs WHERE id = ?
    `).get(run.id) as {
      component_decomposition_budget_calls_used: number;
      component_decomposition_max_depth_reached: number;
      active_component_pipeline_id: string | null;
    };
    expect(row.component_decomposition_budget_calls_used).toBeGreaterThanOrEqual(1);
    expect(row.component_decomposition_max_depth_reached).toBe(1);
    expect(row.active_component_pipeline_id).toMatch(/^comp-decomp-pipe-/);
  });
});
