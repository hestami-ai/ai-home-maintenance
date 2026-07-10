/**
 * SD-3 — Phase 5.1 data_model_skeleton per-component chunking + coverage bloom.
 *
 * The monolithic call asked one response to cover every input component_id (~46
 * leaf components) → mid-response format drift. This replaces it with one bounded
 * call per component + an orchestrator-owned component-coverage reconciliation
 * loop (chunkedCoverageBloom). These tests pin:
 *   (a) the NEW coverage oracle (coveredBy reads component_id after
 *       normalizeComponentIdRef; uncovered = components with no model);
 *   (b) anti-monolith — each generation prompt is scoped to ONE component;
 *   (c) coverage closes — a SUBSET-covering generation + reconciliation reaches
 *       100%; mintEntityIds runs once on the merged tree (stable DM-*, no dups);
 *   (d) no-fabrication — a failing chunk returns [] and the empty {models:[]}
 *       never becomes a fake model;
 *   (e) seeding intact — the returned models[] shape still feeds the depth-0
 *       per-entity seeding (phase5.ts:238-259) unchanged.
 * Template guards assert the per-component + reconciliation prompt variants.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { ConfigManager } from '../../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';
import {
  Phase5Handler,
  dataModelComponentRef,
  computeUncoveredComponentIds,
  chunkComponentIds,
  consolidateEntitiesForComponent,
  renderUncoveredComponentsMenu,
} from '../../../../lib/orchestrator/phases/phase5';
import { normalizeIdsInTree, normalizeComponentIdRef } from '../../../../lib/orchestrator/idNormalization';
import { mintEntityIds } from '../../../../lib/orchestrator/phases/phase5/dataModelIdMinter';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-p5dm-ws-'));

// A minimal DMR packet result (no Deep Memory in unit scope).
const dmr = {
  packet: null,
  activeConstraintsText: '(none)',
  detailFilePath: '(not available)',
  detailFileContent: '(no DMR detail content available)',
  derivedFromRecordIds: [],
};

interface DMEntry {
  component_id: string;
  entities: Array<{ id?: string; name: string; fields: Array<{ name: string; type: string; constraints?: string }>; relationships?: string[] }>;
}
interface DMResult { models: DMEntry[]; }

function comp(id: string, name: string, respText: string): Record<string, unknown> {
  return { id, name, responsibilities: [{ id: `res-${id}`, description: respText }] };
}

function modelFixture(entityName: string): { models: DMEntry[] } {
  // component_id here is intentionally "wrong" — the per-component generator
  // forces attribution to the scoped component, so coverage must not depend on
  // what the model echoes.
  return { models: [{ component_id: 'ECHOED-WRONG', entities: [{ name: entityName, fields: [{ name: 'id', type: 'uuid' }] }] }] };
}

// ─────────────────────────────────────────────────────────────────────
// (a) New coverage oracle — pure, no LLM.
// ─────────────────────────────────────────────────────────────────────
describe('SD-3 oracle — component coverage (pure)', () => {
  it('dataModelComponentRef normalizes COMP-001 → comp-001 (case-drift robust)', () => {
    expect(dataModelComponentRef({ component_id: 'COMP-001' })).toBe('comp-001');
    expect(dataModelComponentRef({ component_id: 'comp-002' })).toBe('comp-002');
    expect(dataModelComponentRef({})).toBe('');
  });

  it('computeUncoveredComponentIds credits a COMP-001 model against comp-001; reports components with no model', () => {
    const target = new Set(['comp-001', 'comp-002', 'comp-003']);
    const models = [{ component_id: 'COMP-001' }, { component_id: 'comp-002' }];
    const uncovered = computeUncoveredComponentIds(models, target);
    expect([...uncovered]).toEqual(['comp-003']);
  });

  it('computeUncoveredComponentIds is empty at 100% coverage', () => {
    const target = new Set(['comp-001', 'comp-002']);
    expect(computeUncoveredComponentIds([{ component_id: 'Comp-001' }, { component_id: 'comp-002' }], target).size).toBe(0);
  });

  it('chunkComponentIds partitions into bounded batches, no loss/dup', () => {
    const batches = chunkComponentIds(['comp-a', 'comp-b', 'comp-c', 'comp-d', 'comp-e'], 2);
    expect(batches.map(b => [...b])).toEqual([['comp-a', 'comp-b'], ['comp-c', 'comp-d'], ['comp-e']]);
    expect(batches.flatMap(b => [...b]).sort()).toEqual(['comp-a', 'comp-b', 'comp-c', 'comp-d', 'comp-e']);
  });

  it('consolidateEntitiesForComponent forces the scoped component_id and dedups entities by name', () => {
    const merged = consolidateEntitiesForComponent(
      [
        { entities: [{ name: 'Link', fields: [] }, { name: 'link', fields: [] }] }, // dup by name (case)
        { entities: [{ name: 'Click', fields: [] }] },
      ],
      'comp-shortener',
    );
    expect(merged).not.toBeNull();
    expect(merged!.component_id).toBe('comp-shortener');
    expect(merged!.entities.map(e => e.name)).toEqual(['Link', 'Click']);
  });

  it('consolidateEntitiesForComponent returns null when no named entities (honest empty, never fabricated)', () => {
    expect(consolidateEntitiesForComponent([{ entities: [] }], 'comp-x')).toBeNull();
    expect(consolidateEntitiesForComponent([{}], 'comp-x')).toBeNull();
  });

  it('consolidateEntitiesForComponent PRESERVES the whole entity incl. traces_to (PD-7 linkage survives the chunk merge)', () => {
    const merged = consolidateEntitiesForComponent(
      [{ entities: [{ name: 'Decision', fields: [], traces_to: ['SR-003', 'AC-US001-002'] }] }],
      'comp-board',
    );
    expect(merged).not.toBeNull();
    // The entity object is pushed whole (not reconstructed field-by-field), so the
    // Phase-5-minted requirement linkage reaches the packet builder's task scoping.
    expect(merged!.entities[0].traces_to).toEqual(['SR-003', 'AC-US001-002']);
  });

  it('renderUncoveredComponentsMenu lists canonical id + responsibilities', () => {
    const byId = new Map<string, Record<string, unknown>>([
      ['comp-c', comp('comp-c', 'Charlie', 'store the charlie state')],
    ]);
    const menu = renderUncoveredComponentsMenu(new Set(['comp-c']), byId);
    expect(menu).toContain('comp-c: Charlie');
    expect(menu).toContain('store the charlie state');
  });
});

// ─────────────────────────────────────────────────────────────────────
// (b)-(e) Handler-driven — MockLLMProvider, real template loader.
// ─────────────────────────────────────────────────────────────────────
describe('SD-3 runDataModelSpecification — chunked coverage bloom', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  let handler: Phase5Handler;

  beforeEach(() => {
    db = createTestDatabase();
    engine = new OrchestratorEngine(db, new ConfigManager(), workspacePath, extensionPath);
    engine.setAutoApproveDecisions(true);
    handler = new Phase5Handler();
  });
  afterEach(() => { db.close(); });

  function configureMock(mock: MockLLMProvider): void {
    engine.llmCaller.registerProvider(mock.bindAsProvider('llamacpp'));
    engine.configManager.setRequirementsAgentRouting({
      primary: { backing_tool: 'direct_llm_api', provider: 'llamacpp', model: 'qwen3.5:9b' },
      temperature: 0.4,
    });
  }

  async function runGen(
    mock: MockLLMProvider,
    components: Array<Record<string, unknown>>,
    componentSummaryById: Record<string, string>,
  ): Promise<DMResult> {
    configureMock(mock);
    const { run } = engine.startWorkflowRun('ws', 'test');
    const ctx = { engine, workflowRun: { id: run.id, current_phase_id: '5' } };
    const componentIds = components.map(c => c.id as string);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (handler as any).runDataModelSpecification(
      ctx, { components, componentIds, componentSummaryById },
      'domains summary', 'SR-001: some requirement', 'TECH-1: postgres', dmr,
    ) as Promise<DMResult>;
  }

  function genPrompts(mock: MockLLMProvider): string[] {
    return mock.getCallLog()
      .filter(c => (c.options.traceContext?.label ?? '').includes('Data Model Specification'))
      .map(c => c.options.prompt ?? '');
  }
  function reconPrompts(mock: MockLLMProvider): string[] {
    return mock.getCallLog()
      .filter(c => (c.options.traceContext?.label ?? '').includes('Coverage Reconciliation'))
      .map(c => c.options.prompt ?? '');
  }

  it('(b) anti-monolith — each generation prompt scopes component_model_summary to ONE component', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('GENBLOCK-ALPHA', { parsedJson: modelFixture('AlphaEntity') });
    mock.setFixture('GENBLOCK-BRAVO', { parsedJson: modelFixture('BravoEntity') });
    mock.setFixture('GENBLOCK-CHARLIE', { parsedJson: modelFixture('CharlieEntity') });

    const components = [comp('comp-a', 'Alpha', 'ra'), comp('comp-b', 'Bravo', 'rb'), comp('comp-c', 'Charlie', 'rc')];
    const byId = { 'comp-a': 'GENBLOCK-ALPHA', 'comp-b': 'GENBLOCK-BRAVO', 'comp-c': 'GENBLOCK-CHARLIE' };
    const result = await runGen(mock, components, byId);

    const prompts = genPrompts(mock);
    expect(prompts).toHaveLength(3); // one call per component, never a single 3-component call

    const MARKERS = ['GENBLOCK-ALPHA', 'GENBLOCK-BRAVO', 'GENBLOCK-CHARLIE'];
    for (const p of prompts) {
      const present = MARKERS.filter(m => p.includes(m));
      expect(present).toHaveLength(1); // exactly one component's scoped block — no monolithic prompt
    }
    // No reconciliation needed — generation covered everything.
    expect(reconPrompts(mock)).toHaveLength(0);
    expect(result.models.map(m => m.component_id).sort()).toEqual(['comp-a', 'comp-b', 'comp-c']);
  });

  it('(c) coverage closes — subset-covering generation + reconciliation reaches 100%; mintEntityIds is stable/unique', async () => {
    const mock = new MockLLMProvider();
    // Generation covers a & b only; c has no matching fixture → empty → uncovered.
    mock.setFixture('GENBLOCK-ALPHA', { parsedJson: modelFixture('AlphaEntity') });
    mock.setFixture('GENBLOCK-BRAVO', { parsedJson: modelFixture('BravoEntity') });
    // Reconciliation for the orphan component c (menu carries its responsibility text).
    mock.setFixture('RECON-CHARLIE-RESP', {
      parsedJson: { models: [{ component_id: 'comp-c', entities: [{ name: 'CharlieEntity', fields: [{ name: 'id', type: 'uuid' }] }] }] },
    });

    const components = [
      comp('comp-a', 'Alpha', 'ra'),
      comp('comp-b', 'Bravo', 'rb'),
      comp('comp-c', 'Charlie', 'RECON-CHARLIE-RESP'),
    ];
    const byId = { 'comp-a': 'GENBLOCK-ALPHA', 'comp-b': 'GENBLOCK-BRAVO', 'comp-c': 'GENBLOCK-CHARLIE' };
    const result = await runGen(mock, components, byId);

    // Exactly one reconciliation batch fired (for the single orphan component).
    expect(reconPrompts(mock)).toHaveLength(1);
    expect(reconPrompts(mock)[0]).toContain('RECON-CHARLIE-RESP');
    // Merged models[] covers 100% of componentIds.
    expect(result.models.map(m => m.component_id).sort()).toEqual(['comp-a', 'comp-b', 'comp-c']);

    // mintEntityIds runs ONCE on the merged tree → stable DM-*, no collisions.
    const content = { kind: 'data_models', models: result.models } as unknown as Parameters<typeof mintEntityIds>[0];
    normalizeIdsInTree(content, new Set(['component_id']), normalizeComponentIdRef);
    const minted = mintEntityIds(content);
    expect(minted).toBe(3);
    const ids = result.models.flatMap(m => m.entities.map(e => e.id!));
    expect(ids.every(id => id.startsWith('DM-'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length); // no collisions
  });

  it('(d) no-fabrication — every chunk fails/empties → honest {models:[]}, never a fake model', async () => {
    const mock = new MockLLMProvider();
    // No fixtures at all: generation AND reconciliation return default-empty → [].
    const components = [comp('comp-a', 'Alpha', 'ra')];
    const byId = { 'comp-a': 'GENBLOCK-ALPHA' };
    const result = await runGen(mock, components, byId);

    expect(result.models).toEqual([]); // honest empty — NOT a fabricated placeholder model
    // Reconciliation was attempted (orphan comp-a) but produced nothing usable.
    expect(reconPrompts(mock).length).toBeGreaterThanOrEqual(1);
  });

  it('(e) seeding intact — returned models[] shape still feeds the depth-0 per-entity seeding', async () => {
    const mock = new MockLLMProvider();
    mock.setFixture('GENBLOCK-ALPHA', {
      parsedJson: { models: [{ component_id: 'x', entities: [{ name: 'Link', fields: [{ name: 'slug', type: 'string' }], relationships: ['Click'] }] }] },
    });
    mock.setFixture('GENBLOCK-BRAVO', { parsedJson: modelFixture('Click') });

    const components = [comp('comp-a', 'Alpha', 'ra'), comp('comp-b', 'Bravo', 'rb')];
    const byId = { 'comp-a': 'GENBLOCK-ALPHA', 'comp-b': 'GENBLOCK-BRAVO' };
    const result = await runGen(mock, components, byId);

    // Apply the same normalize + mint execute() does before seeding.
    const content = { kind: 'data_models', models: result.models } as unknown as Parameters<typeof mintEntityIds>[0];
    normalizeIdsInTree(content, new Set(['component_id']), normalizeComponentIdRef);
    mintEntityIds(content);

    // Replicate the depth-0 seeding transform (phase5.ts:238-259) and assert the
    // root shape the saturation loop consumes is intact.
    const rootEntities = result.models.flatMap(m =>
      m.entities.map(e => ({
        id: e.id ?? e.name,
        name: e.name,
        kind: 'aggregate' as const,
        component_id: m.component_id,
        fields: e.fields.map(f => ({ name: f.name, type: f.type, constraints: f.constraints })),
        relationships: (e.relationships ?? []).map(rel => ({ target_entity_id: rel, kind: 'references' as const })),
        active_constraints: [] as string[],
      })),
    );

    expect(rootEntities.length).toBe(2);
    for (const root of rootEntities) {
      expect(root.id.startsWith('DM-')).toBe(true);          // minted stable id used as seed display key
      expect(typeof root.name).toBe('string');
      expect(root.component_id).toMatch(/^comp-/);            // canonicalized
      expect(root.fields.length).toBeGreaterThan(0);
      expect(root.fields.every(f => typeof f.type === 'string' && f.type.length > 0)).toBe(true);
      expect(Array.isArray(root.relationships)).toBe(true);
    }
    const link = rootEntities.find(r => r.name === 'Link')!;
    expect(link.relationships).toEqual([{ target_entity_id: 'Click', kind: 'references' }]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Template guards (file-read) — mirror frNfrSaturationCategoryConsistency.
// ─────────────────────────────────────────────────────────────────────
describe('SD-3 template guards', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
  const skeleton = 'prompts/phases/phase_05_technical_specification/data_model_skeleton/data_models.system.md';
  const recon = 'prompts/phases/phase_05_technical_specification/data_model_reconciliation/data_model_reconciliation.system.md';

  it('data_model_skeleton is per-component scoped (no monolithic "cover every component" ask)', () => {
    const body = fs.readFileSync(path.join(repoRoot, skeleton), 'utf-8');
    expect(body).toMatch(/exactly ONE/i);
    expect(body.toLowerCase()).toContain('reference-only');
    expect(body.toLowerCase()).toContain('orchestrator');
    // The old monolithic enumeration rule must be gone.
    expect(body).not.toMatch(/Every input `component_id`[\s\S]*MUST be covered by at least one/);
  });

  it('data_model_reconciliation template exists with the uncovered-component menu variable', () => {
    const body = fs.readFileSync(path.join(repoRoot, recon), 'utf-8');
    expect(body).toContain('sub_phase: data_model_reconciliation');
    expect(body).toContain('{{uncovered_components}}');
    expect(body.toLowerCase()).toContain('reconciliation');
    expect(body).toContain('verbatim');
  });
});
