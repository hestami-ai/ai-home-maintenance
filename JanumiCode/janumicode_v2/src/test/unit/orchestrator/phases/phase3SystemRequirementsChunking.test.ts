/**
 * SD-1 — Phase 3.2 System Requirements chunked derivation.
 *
 * The monolithic system_requirements call asked one gpt-oss:20b response to
 * cover the full FR∪NFR id set in a single shot (cal-32: a 13-id coverage miss
 * incl NFR-005). This suite pins the replacement — per-release-cohort generation
 * (+ a dedicated cross-cutting NFR cohort) closed by the shared
 * chunkedCoverageBloom reconciliation loop:
 *   (a) anti-monolith — no single generation prompt enumerates the whole FR set;
 *   (b) coverage closes — a per-cohort SUBSET is completed by reconciliation
 *       (incl the orphan NFR), and merged SR ids are globally unique;
 *   (c) the generalized FR∪NFR coverage oracle flags an uncovered NFR;
 *   (d) residual honesty — an unfillable gap is reported, never fabricated;
 *   (e) template guards — per-cohort scope + reconciliation template on disk.
 *
 * Harness pattern mirrors phase7_1aSaturation.test.ts (real OrchestratorEngine +
 * MockLLMProvider, loop-driven prompt capture) and
 * frNfrSaturationCategoryConsistency.test.ts (file-reading template guards).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { ConfigManager } from '../../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../../lib/orchestrator/orchestratorEngine';
import {
  deriveSystemRequirementsChunked,
  computeUncoveredRequirements,
  buildSrFrStories,
  buildSrNfrs,
  type SrFrStory,
  type SrNfr,
} from '../../../../lib/orchestrator/phases/phase3';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-p3-ws-'));

// Two release ordinals + a cross-cutting NFR pair (NFR-2 = the live cal-32 miss).
const FR_STORIES: SrFrStory[] = [
  { id: 'US-A1', release_ordinal: 1, label: 'US-A1 [high]: As a user, I want to shorten a URL, so that I can share it.' },
  { id: 'US-A2', release_ordinal: 1, label: 'US-A2 [high]: As a user, I want to see click stats, so that I can track usage.' },
  { id: 'US-B1', release_ordinal: 2, label: 'US-B1 [medium]: As an admin, I want to disable a link, so that abuse stops.' },
];
const NFRS: SrNfr[] = [
  { id: 'NFR-1', label: 'NFR-1: redirect p95 latency < 50ms' },
  { id: 'NFR-2', label: 'NFR-2: 99.9% redirect availability' },
];

function baseInput(): Parameters<typeof deriveSystemRequirementsChunked>[1] {
  return {
    boundarySummary: 'BOUNDARY-SUMMARY',
    activeConstraintsText: 'CONSTRAINTS',
    janumicodeVersionSha: 'dev',
    frStories: FR_STORIES,
    nfrs: NFRS,
  };
}

describe('SD-1 — deriveSystemRequirementsChunked (Phase 3.2)', () => {
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

  function ctxFor(runId: string): Parameters<typeof deriveSystemRequirementsChunked>[0] {
    return { engine, workflowRun: { id: runId } as Parameters<typeof deriveSystemRequirementsChunked>[0]['workflowRun'] };
  }

  it('(a) anti-monolith — each generation prompt carries only its cohort ids; no prompt enumerates the whole FR set', async () => {
    const mock = new MockLLMProvider();
    // Full coverage from generation alone → no reconciliation → exactly 3 cohort prompts.
    mock.setFixture('Release 1', { parsedJson: { items: [
      { id: 'X', statement: 'The system shall persist shortened URLs to durable storage', source_requirement_ids: ['US-A1', 'US-A2', 'NFR-1', 'NFR-2'], priority: 'high' },
    ] } });
    mock.setFixture('Release 2', { parsedJson: { items: [
      { id: 'X', statement: 'The system shall let admins disable a link within one request', source_requirement_ids: ['US-B1'], priority: 'high' },
    ] } });
    mock.setFixture('Cross-cutting NFRs', { parsedJson: { items: [
      { id: 'X', statement: 'The system shall serve redirects at 99.9% availability under 50ms p95', source_requirement_ids: ['NFR-1', 'NFR-2'], priority: 'high' },
    ] } });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const result = await deriveSystemRequirementsChunked(ctxFor(run.id), baseInput());

    const prompts = mock.getCallLog().map(c => c.options.prompt ?? '');
    // 2 release cohorts + 1 NFR cohort, all fully covered → no reconciliation calls.
    expect(prompts).toHaveLength(3);
    expect(result.coveragePct).toBe(100);

    const r1 = prompts.find(p => p.includes('Release 1'));
    const r2 = prompts.find(p => p.includes('Release 2'));
    const nfr = prompts.find(p => p.includes('Cross-cutting NFRs'));
    expect(r1, 'a Release 1 cohort prompt').toBeDefined();
    expect(r2, 'a Release 2 cohort prompt').toBeDefined();
    expect(nfr, 'a cross-cutting NFR cohort prompt').toBeDefined();

    // Each release cohort carries ONLY its own functional ids.
    expect(r1!).toContain('US-A1');
    expect(r1!).toContain('US-A2');
    expect(r1!).not.toContain('US-B1');
    expect(r2!).toContain('US-B1');
    expect(r2!).not.toContain('US-A1');
    expect(r2!).not.toContain('US-A2');

    // The NFR cohort carries NO functional (US-*) ids — it is the quality-bound cohort.
    expect(nfr!).not.toContain('US-A1');
    expect(nfr!).not.toContain('US-B1');

    // The core anti-monolith invariant: no single generation prompt enumerates
    // the whole FR set (the full roster is never injected as one blob).
    for (const p of prompts) {
      const hasAllFr = p.includes('US-A1') && p.includes('US-A2') && p.includes('US-B1');
      expect(hasAllFr).toBe(false);
    }
  });

  it('(b) coverage closes — reconciliation covers the orphan NFR and merged SR ids are globally unique', async () => {
    const mock = new MockLLMProvider();
    // Cohorts cover a SUBSET: NFR-2 is dropped by the NFR cohort (the live miss).
    mock.setFixture('Release 1', { parsedJson: { items: [
      { id: 'X', statement: 'The system shall persist shortened URLs', source_requirement_ids: ['US-A1', 'US-A2'], priority: 'high' },
    ] } });
    mock.setFixture('Release 2', { parsedJson: { items: [
      { id: 'X', statement: 'The system shall disable a link on admin request', source_requirement_ids: ['US-B1'], priority: 'high' },
    ] } });
    mock.setFixture('Cross-cutting NFRs', { parsedJson: { items: [
      { id: 'X', statement: 'The system shall bound redirect p95 latency to 50ms', source_requirement_ids: ['NFR-1'], priority: 'high' },
    ] } });
    // Reconciliation closes the NFR-2 gap.
    mock.setFixture('left uncovered by the per-cohort pass', { parsedJson: { items: [
      { id: 'X', statement: 'The system shall serve redirects at 99.9% availability', source_requirement_ids: ['NFR-2'], priority: 'high' },
    ] } });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const result = await deriveSystemRequirementsChunked(ctxFor(run.id), baseInput());

    expect(result.coveragePct).toBe(100);
    expect(result.residual).toEqual([]);

    const items = result.requirements.items;
    const ids = items.map(i => i.id);
    // Globally unique — two cohorts must not both surface SR-001.
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter(i => i === 'SR-001')).toHaveLength(1);

    // The merged set covers the full FR∪NFR id space, incl the reconciled NFR.
    const covered = new Set(items.flatMap(i => i.source_requirement_ids));
    for (const id of ['US-A1', 'US-A2', 'US-B1', 'NFR-1', 'NFR-2']) {
      expect(covered.has(id), `covers ${id}`).toBe(true);
    }

    // Reconciliation actually fired, scoped to the orphan NFR (not a full re-run).
    const reconPrompt = mock.getCallLog().map(c => c.options.prompt ?? '')
      .find(p => p.includes('left uncovered by the per-cohort pass'));
    expect(reconPrompt, 'a reconciliation prompt fired').toBeDefined();
    expect(reconPrompt!).toContain('NFR-2');
    expect(reconPrompt!).not.toContain('US-A1'); // scoped to the orphan, not the whole set
  });

  it('(c) the generalized FR∪NFR coverage oracle flags an uncovered NFR (the old FR-only check did not)', () => {
    // An SR covering only the FR leaves NFR-2 uncovered — the pre-SD-1 check
    // only iterated FR stories and would have missed this entirely.
    const uncovered = computeUncoveredRequirements(
      [{ source_requirement_ids: ['US-A1'] }],
      ['US-A1', 'NFR-2'],
    );
    expect(uncovered).toContain('NFR-2');
    expect(uncovered).not.toContain('US-A1');

    // Array-safe: a non-array source_requirement_ids (cal-29 class) never throws.
    expect(() => computeUncoveredRequirements([{ source_requirement_ids: true }], ['NFR-2'])).not.toThrow();
    expect(computeUncoveredRequirements([{ source_requirement_ids: true }], ['NFR-2'])).toEqual(['NFR-2']);
  });

  it('(d) residual honesty — an unfillable gap is reported, never fabricated', async () => {
    const mock = new MockLLMProvider();
    // Same subset as (b) but NO reconciliation fixture → recon returns empty →
    // NFR-2 stays an honest residual (no fabricated SR closes it).
    mock.setFixture('Release 1', { parsedJson: { items: [
      { id: 'X', statement: 'The system shall persist shortened URLs', source_requirement_ids: ['US-A1', 'US-A2'], priority: 'high' },
    ] } });
    mock.setFixture('Release 2', { parsedJson: { items: [
      { id: 'X', statement: 'The system shall disable a link on admin request', source_requirement_ids: ['US-B1'], priority: 'high' },
    ] } });
    mock.setFixture('Cross-cutting NFRs', { parsedJson: { items: [
      { id: 'X', statement: 'The system shall bound redirect p95 latency to 50ms', source_requirement_ids: ['NFR-1'], priority: 'high' },
    ] } });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const result = await deriveSystemRequirementsChunked(ctxFor(run.id), baseInput());

    // Honest gap: NFR-2 reported as residual, coverage below 100.
    expect(result.residual).toContain('NFR-2');
    expect(result.coveragePct).toBeLessThan(100);

    const items = result.requirements.items;
    expect(items.length).toBeGreaterThan(0);
    // No fabricated SR for NFR-2.
    const covered = new Set(items.flatMap(i => i.source_requirement_ids));
    expect(covered.has('NFR-2')).toBe(false);
    // The SR-001 boilerplate fallback never appears (real cohort SRs were produced).
    expect(items.some(i => i.statement.includes('System shall implement core functionality'))).toBe(false);
    // Ids still globally unique.
    const ids = items.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('SD-1 — cohort input builders', () => {
  it('buildSrFrStories attaches each leaf release_ordinal (leaf path) and falls back to roots', () => {
    const leaves = [
      { release_ordinal: 1, display_key: 'US-001-1', user_story: { id: 'US-001-1', role: 'u', action: 'shorten', outcome: 'share', priority: 'high' } },
      { release_ordinal: 2, display_key: 'US-002-1', user_story: { id: 'US-002-1', role: 'u', action: 'track', outcome: 'measure', priority: 'low' } },
    ];
    const out = buildSrFrStories(leaves, []);
    expect(out.map(s => s.id)).toEqual(['US-001-1', 'US-002-1']);
    expect(out.map(s => s.release_ordinal)).toEqual([1, 2]);
    expect(out[0].label).toContain('US-001-1');

    // Root fallback (no leaves): single Backlog cohort (release_ordinal null).
    const rootOut = buildSrFrStories([], [{ id: 'US-1', role: 'u', action: 'a', outcome: 'o', priority: 'high' }]);
    expect(rootOut[0].id).toBe('US-1');
    expect(rootOut[0].release_ordinal).toBe(null);
  });

  it('buildSrNfrs preserves id + one-line label and tolerates missing input', () => {
    const nfrs = buildSrNfrs([
      { id: 'NFR-1', statement: 'p95 < 200ms' },
      { id: 'NFR-2', description: '99.9% availability' },
    ]);
    expect(nfrs.map(n => n.id)).toEqual(['NFR-1', 'NFR-2']);
    expect(nfrs[0].label).toContain('NFR-1');
    expect(nfrs[0].label).toContain('p95 < 200ms');
    expect(buildSrNfrs(undefined)).toEqual([]);
  });
});

describe('SD-1 — template guards (file-read)', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
  const genRel = 'prompts/phases/phase_03_system_specification/system_requirements/system_requirements.system.md';
  const reconRel = 'prompts/phases/phase_03_system_specification/system_requirements/system_requirements_reconciliation.system.md';

  it('system_requirements is a per-cohort variant that defers global coverage to the orchestrator', () => {
    const body = fs.readFileSync(path.join(repoRoot, genRel), 'utf-8');
    expect(body).toContain('{{cohort_label}}');
    expect(body).toContain('{{cohort_requirements}}');
    expect(body).toContain('{{cross_cutting_reference}}');
    expect(body.toLowerCase()).toContain('cohort');
    expect(body).toContain('closed by the orchestrator');
    // The per-cohort variant must NOT re-inject the full FR roster as one blob.
    expect(body).not.toContain('{{functional_requirements_summary}}');
  });

  it('system_requirements_reconciliation exists with the uncovered-menu variable', () => {
    const body = fs.readFileSync(path.join(repoRoot, reconRel), 'utf-8');
    expect(body).toContain('sub_phase: system_requirements_reconciliation');
    expect(body).toContain('{{uncovered_requirements}}');
    expect(body).toContain('left uncovered by the per-cohort pass');
  });
});
