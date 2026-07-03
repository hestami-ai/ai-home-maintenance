/**
 * SD-2 — Phase 4.3 ADR capture: per-software-domain chunked fan-out.
 *
 * The monolithic `adr_capture` call fed an ALL-components roll-up ("every
 * significant choice across all ~53 components") to one gpt-oss:20b response and
 * under-covered component-model thresholds. SD-2 replaces it with the shared
 * `chunkedCoverageBloom` helper in PURE FAN-OUT mode (empty coverage set, zero
 * reconciliation passes) — one focused ADR call per software domain.
 *
 * These tests pin:
 *   (a) anti-monolith — each ADR prompt carries ONLY its own domain's
 *       components (never the whole component set).
 *   (b) fan-out merge — per-domain ADRs merge with globally-unique ids even when
 *       every domain independently emits ADR-001/ADR-002; the caller's
 *       `governs_components` oracle resolution runs ONCE post-merge over the FULL
 *       component set, so a valid cross-domain id survives.
 *   (c) no-fabrication — a domain chunk that yields nothing contributes []; the
 *       single ADR-001 fallback appears ONLY when the WHOLE bloom is empty.
 *   (d) template guard — the `adr_capture` template is per-domain scoped.
 *
 * Mirrors phase7_1aSaturation.test.ts (MockLLMProvider loop-driven prompt
 * capture) and frNfrSaturationCategoryConsistency.test.ts (template file-read).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../../lib/database/init';
import { ConfigManager } from '../../../../lib/config/configManager';
import { OrchestratorEngine, type PhaseContext } from '../../../../lib/orchestrator/orchestratorEngine';
import { runAdrCaptureBloom, type AdrCaptureBloomArgs } from '../../../../lib/orchestrator/phases/phase4';
import { resolveAgainstOracle } from '../../../../lib/orchestrator/idResolver';
import { MockLLMProvider } from '../../../helpers/mockLLMProvider';
import type { PhaseContextPacketResult } from '../../../../lib/orchestrator/phases/dmrContext';

const extensionPath = path.resolve(__dirname, '..', '..', '..', '..', '..');
const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-p4-adr-ws-'));

// A minimal DMR stub — the adr_capture template only reads `active_constraints`.
const dmrStub: PhaseContextPacketResult = {
  packet: null,
  activeConstraintsText: '(none)',
  detailFilePath: '(not available)',
  detailFileContent: '',
  derivedFromRecordIds: [],
};

// Two software domains, distinct components each. Domain-alpha has TWO
// components (proving the block carries the whole domain slice), domain-beta one.
const adrComponents: AdrCaptureBloomArgs['adrComponents'] = [
  {
    id: 'comp-a1', name: 'Alpha Ingest', domain_id: 'domain-alpha',
    responsibilities: [{ id: 'RESP-A1', statement: 'accept alpha requests' }],
    dependencies: [{ target_component_id: 'comp-a2', dependency_type: 'sync_call' }],
  },
  {
    id: 'comp-a2', name: 'Alpha Store', domain_id: 'domain-alpha',
    responsibilities: [{ id: 'RESP-A2', statement: 'persist alpha data' }],
  },
  {
    id: 'comp-b1', name: 'Beta View', domain_id: 'domain-beta',
    responsibilities: [{ id: 'RESP-B1', statement: 'render beta view' }],
  },
];

// Component-id-free domain roster (so component ids only appear in the per-domain
// component block, keeping the anti-monolith assertions unambiguous).
const domainsSummary = 'domain-alpha: Alpha Domain\ndomain-beta: Beta Domain';
const technicalConstraintsSummary = 'TECH-1 — Postgres — database — single managed instance';

function adr(id: string, governs: string[]): Record<string, unknown> {
  return {
    id, title: `Decision ${id}`, status: 'proposed',
    context: 'ctx', decision: `do ${id}`,
    alternatives: ['other'], rationale: `because ${id}`,
    consequences: ['tradeoff'], governs_components: governs,
  };
}

interface MergedAdr {
  id: string;
  governs_components?: string[];
}

describe('runAdrCaptureBloom — SD-2 per-domain chunked fan-out', () => {
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

  function ctxFor(runId: string): PhaseContext {
    return { engine, workflowRun: { id: runId } as PhaseContext['workflowRun'] };
  }

  it('(a) anti-monolith — each ADR prompt carries ONLY its own domain\'s components', async () => {
    const mock = new MockLLMProvider();
    // Match each fixture on a component id unique to its domain.
    mock.setFixture('comp-b1', { match: 'comp-b1', parsedJson: { adrs: [adr('ADR-001', ['comp-b1'])] } });
    mock.setFixture('comp-a1', { match: 'comp-a1', parsedJson: { adrs: [adr('ADR-001', ['comp-a1'])] } });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    await runAdrCaptureBloom(ctxFor(run.id), {
      adrComponents, domainsSummary, technicalConstraintsSummary, dmr: dmrStub,
    });

    const prompts = mock.getCallLog().map(c => c.options.prompt ?? '');
    // Exactly one generation call per software domain (two domains → two calls).
    expect(prompts).toHaveLength(2);

    // Discriminate by a domain-unique component id (the full domain ROSTER is in
    // every prompt as reference, so the 'domain-alpha'/'domain-beta' labels are
    // not unique — but the scoped component block is).
    const promptA = prompts.find(p => p.includes('comp-a1'));
    const promptB = prompts.find(p => p.includes('comp-b1'));
    expect(promptA, 'a prompt scoped to domain-alpha should exist').toBeDefined();
    expect(promptB, 'a prompt scoped to domain-beta should exist').toBeDefined();

    // domain-alpha's prompt carries BOTH of its components, and NONE of beta's.
    expect(promptA!).toContain('comp-a1');
    expect(promptA!).toContain('comp-a2');
    expect(promptA!).not.toContain('comp-b1');

    // domain-beta's prompt carries only its component, and NONE of alpha's.
    expect(promptB!).toContain('comp-b1');
    expect(promptB!).not.toContain('comp-a1');
    expect(promptB!).not.toContain('comp-a2');

    // No single prompt is the all-components monolith.
    for (const p of prompts) {
      const carriesAll = p.includes('comp-a1') && p.includes('comp-a2') && p.includes('comp-b1');
      expect(carriesAll, 'no prompt should carry every component (monolith)').toBe(false);
    }
  });

  it('(b) fan-out merge — colliding per-domain ADR ids re-id to globally-unique; cross-domain governs id resolves post-merge over the FULL oracle', async () => {
    const mock = new MockLLMProvider();
    // BOTH domains independently emit ADR-001 AND ADR-002 (the realistic case).
    // A domain-alpha ADR governs a domain-BETA component id (valid cross-domain).
    mock.setFixture('comp-b1', {
      match: 'comp-b1',
      parsedJson: { adrs: [adr('ADR-001', ['comp-b1']), adr('ADR-002', ['comp-b1'])] },
    });
    mock.setFixture('comp-a1', {
      match: 'comp-a1',
      parsedJson: { adrs: [adr('ADR-001', ['comp-b1']), adr('ADR-002', ['comp-a2'])] },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const result = await runAdrCaptureBloom(ctxFor(run.id), {
      adrComponents, domainsSummary, technicalConstraintsSummary, dmr: dmrStub,
    });

    const adrs = result.adrs as unknown as MergedAdr[];
    // 2 domains × 2 ADRs each = 4 merged (none dropped as a cross-domain "dup").
    expect(adrs).toHaveLength(4);
    const ids = adrs.map(a => a.id);
    expect(new Set(ids).size, 'ADR ids are globally unique post-merge').toBe(4);
    expect(ids).toEqual(['ADR-001', 'ADR-002', 'ADR-003', 'ADR-004']);
    // No per-chunk namespace leaked into the final ids.
    expect(ids.every(id => /^ADR-\d{3}$/.test(id))).toBe(true);

    // Post-merge oracle resolution (exactly what execute() runs) over the FULL
    // component set — NOT per-chunk. A domain-alpha ADR governing 'comp-b1'
    // (a domain-beta component) must still resolve, because the oracle is whole.
    const componentOracle = new Set(adrComponents.map(c => c.id));
    for (const a of adrs) {
      if (!Array.isArray(a.governs_components)) continue;
      a.governs_components = a.governs_components
        .map(id => resolveAgainstOracle(id, componentOracle))
        .filter((id): id is string => id !== null);
    }
    const crossDomain = adrs.find(a => (a.governs_components ?? []).includes('comp-b1'));
    expect(crossDomain, 'the cross-domain governs id survives the full-oracle resolution').toBeDefined();
    // Every governs id that survived is a real component (no invented id kept).
    for (const a of adrs) {
      for (const g of a.governs_components ?? []) expect(componentOracle.has(g)).toBe(true);
    }
  });

  it('(c) no-fabrication — a domain chunk that yields nothing contributes []; no fake ADR', async () => {
    const mock = new MockLLMProvider();
    // Only domain-alpha has a fixture; domain-beta's call falls through to the
    // mock's empty-success response → parse yields [] for that chunk.
    mock.setFixture('comp-a1', {
      match: 'comp-a1',
      parsedJson: { adrs: [adr('ADR-001', ['comp-a1']), adr('ADR-002', ['comp-a2'])] },
    });
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const result = await runAdrCaptureBloom(ctxFor(run.id), {
      adrComponents, domainsSummary, technicalConstraintsSummary, dmr: dmrStub,
    });

    const adrs = result.adrs as unknown as MergedAdr[];
    // Only domain-alpha's two ADRs — nothing fabricated for the empty beta chunk.
    expect(adrs).toHaveLength(2);
    expect(adrs.map(a => a.id)).toEqual(['ADR-001', 'ADR-002']);
    // The single 'Primary technology stack' fallback must NOT appear when a real
    // chunk produced ADRs.
    expect(result.adrs.some(a => a.title === 'Primary technology stack')).toBe(false);
  });

  it('(c2) single final fallback — ONLY when the WHOLE bloom yields zero ADRs', async () => {
    const mock = new MockLLMProvider();
    // No fixtures → every domain chunk parses to [] → the whole bloom is empty.
    configureMock(mock);

    const { run } = engine.startWorkflowRun('ws', 'test');
    const result = await runAdrCaptureBloom(ctxFor(run.id), {
      adrComponents, domainsSummary, technicalConstraintsSummary, dmr: dmrStub,
    });

    // Exactly ONE fallback ADR, not one-per-domain.
    expect(result.adrs).toHaveLength(1);
    expect(result.adrs[0].id).toBe('ADR-001');
    expect(result.adrs[0].title).toBe('Primary technology stack');
  });
});

describe('SD-2 template guard — adr_capture is per-domain scoped', () => {
  const templatePath = path.join(
    extensionPath,
    'prompts/phases/phase_04_architecture/adr_capture/adr_capture.system.md',
  );

  it('the adr_capture template scopes ADR authoring to THIS software domain', () => {
    const body = fs.readFileSync(templatePath, 'utf-8');
    // Per-domain scoping language.
    expect(body).toContain('THIS software domain');
    expect(body).toContain('reference-only');
    // The per-domain variable is declared and referenced.
    expect(body).toContain('{{active_software_domain}}');
    expect(body).toMatch(/required_variables:[\s\S]*- active_software_domain/);
    // The orchestrator-owns-global-coverage reframe is present (not a monolith).
    expect(body.toLowerCase()).toContain('once per software domain');
  });
});
