/**
 * PA-4 regression — data_model_saturation prompt scoping.
 *
 * Asserts a single-entity saturation call sees only its OWN component's context
 * and same-component root siblings, not the whole component backlog / every root
 * entity across all components (the audit's A1/A5 bloat that fed wrong-node drift).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { ConfigManager } from '../../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';
import { runDataModelSaturationLoop } from '../../../../lib/orchestrator/phases/phase5_1a';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import type { DecompositionEntity, DataModelDecompositionNodeContent } from '../../../../lib/types/records';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-p5-ws-'));

function tinyEntity(id: string, componentId: string): DecompositionEntity {
  return {
    id, name: `Entity ${id}`, kind: 'entity', component_id: componentId,
    fields: [{ name: 'id', type: 'uuid', is_identity: true }],
    relationships: [], active_constraints: [], traces_to: [],
  } as unknown as DecompositionEntity;
}

function seedRootNode(
  engine: OrchestratorEngine, runId: string, entity: DecompositionEntity,
): { recordId: string; logicalNodeId: string } {
  const logicalNodeId = `root-${entity.id}-uuid`;
  const rec = engine.writer.writeRecord({
    record_type: 'data_model_decomposition_node',
    schema_version: '1.0',
    workflow_run_id: runId,
    phase_id: '5',
    sub_phase_id: '5.1a',
    produced_by_agent_role: 'technical_spec_agent',
    janumicode_version_sha: 'dev',
    derived_from_record_ids: [],
    content: {
      kind: 'data_model_decomposition_node',
      node_id: logicalNodeId,
      parent_node_id: null,
      display_key: entity.id,
      root_entity_id: logicalNodeId,
      depth: 0,
      pass_number: 0,
      status: 'pending',
      entity,
      surfaced_assumption_ids: [],
      release_id: null,
      release_ordinal: null,
    } as unknown as DataModelDecompositionNodeContent,
  });
  return { recordId: rec.id, logicalNodeId };
}

describe('runDataModelSaturationLoop — PA-4 scoping', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    engine = new OrchestratorEngine(db, new ConfigManager(), workspacePath, extensionPath);
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

  it('PA-4 — data_model_saturation prompt is scoped: own-component context, same-component root siblings', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('atomic', {
      match: 'Entity ',
      parsedJson: {
        parent_branch_classification: 'atomic_value',
        parent_tier_assessment: { tier: 'D', agrees_with_hint: true, rationale: 'atomic' },
        children: [],
        surfaced_assumptions: [],
      },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const entA = tinyEntity('dm-a-root', 'comp-a');
    const entB = tinyEntity('dm-b-root', 'comp-b');
    const sa = seedRootNode(engine, run.id, entA);
    const sb = seedRootNode(engine, run.id, entB);

    await runDataModelSaturationLoop(
      { engine, workflowRun: { id: run.id } as Parameters<typeof runDataModelSaturationLoop>[0]['workflowRun'] },
      {
        technicalConstraints: [],
        componentSummary: 'FULL-MODEL-SUMMARY (comp-a and comp-b)',
        componentSummaryById: { 'comp-a': 'SCOPED-COMPONENT-A-ONLY', 'comp-b': 'SCOPED-COMPONENT-B-ONLY' },
        rootEntities: [entA, entB],
        rootNodeRecordIds: [sa.recordId, sb.recordId],
        rootLogicalIds: [sa.logicalNodeId, sb.logicalNodeId],
        systemRequirementsSummary: 'SR-001: some requirement',
      },
    );

    const prompts = mock.getCallLog().map(c => c.options.prompt ?? '');
    const promptA = prompts.find(p => p.includes('SCOPED-COMPONENT-A-ONLY'));
    expect(promptA, 'a data_model_saturation prompt scoped to comp-a should exist').toBeDefined();

    // (1) component_context scoped to the entity's OWN component — not the other, not the full model.
    expect(promptA!).not.toContain('SCOPED-COMPONENT-B-ONLY');
    expect(promptA!).not.toContain('FULL-MODEL-SUMMARY');

    // (2) root sibling_context scoped to the same component → comp-a root has no same-component
    //     siblings (comp-b root excluded), so the block reads '(none …)' rather than listing it.
    expect(promptA!).toContain('(none — sole child under this parent)');
  });
});
