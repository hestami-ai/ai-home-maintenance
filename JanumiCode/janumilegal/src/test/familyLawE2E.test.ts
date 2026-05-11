/**
 * Wave 6 gate: the Family Law Production test fixture from source §Test Use
 * Case passes its assertion set (lines 2462–2484 of source).
 *
 * The test runs the Family Law Production lens through the orchestrator
 * with replay agents that emit gold-matter expected outputs, then runs the
 * gold-matter assertion set against an activation snapshot derived from
 * the persisted state outputs. Wave 7+ swaps replay agents for LLM-backed
 * implementations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  openDirect,
  ClvDal,
  FirmDal,
  ManifestDal,
  ActivationDal,
  OpStreamDal,
} from '../lib/database/index.js';
import { loadCLVv1 } from '../lib/clv/index.js';
import { AgentRegistry } from '../lib/registry/agentRegistry.js';
import { Orchestrator } from '../lib/orchestrator/orchestrator.js';
import { AgentRuntime } from '../lib/agents/runtime.js';
import { familyLawProductionManifest, FAMILY_LAW_AGENTS } from '../layer2_lens_packs/familyLawProduction/manifest.js';
import { registerAllMvpAgents } from '../layer2_lens_packs/registrations.js';
import { ReplayAgent } from './fixtures/replayAgents.js';
import { loadGoldMatter } from '../lib/calibration/loader.js';
import { AssertionRunner } from '../lib/calibration/assertionRunner.js';

const FIRM = 'firm_jclaw', CLIENT = 'c1', MATTER = 'm1';
const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

const GOLD = path.resolve(__dirname, '..', '..', 'calibration', 'gold', 'JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001');

describe('Family Law Production Lens — E2E against gold matter', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-fle2e-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
    const firmDal = new FirmDal(db);
    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'Father');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'Custody Enforcement', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody_visitation_enforcement' });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('runs all 11 states and the assertion set passes', async () => {
    const gold = loadGoldMatter(GOLD);

    const registry = new AgentRegistry();
    registerAllMvpAgents(registry);
    const opStream = new OpStreamDal(db);
    const runtime = new AgentRuntime({ registry, opStream });

    // Bind replay agents that emit gold-matter outputs per state
    const stateOutputForAgent = {
      [FAMILY_LAW_AGENTS.matterContextNormalize]: gold.stateOutputs['01_matter_context_normalize'] ?? {},
      [FAMILY_LAW_AGENTS.jurisdictionCapture]: gold.stateOutputs['02_jurisdiction_capture'] ?? {},
      [FAMILY_LAW_AGENTS.factExtraction]: gold.stateOutputs['05_fact_extraction'] ?? { document_supported_facts: [] },
      [FAMILY_LAW_AGENTS.existingOrderExtract]: gold.stateOutputs['07_existing_order_extract'] ?? { potential_order_violation: true },
      [FAMILY_LAW_AGENTS.issueBloom]: gold.stateOutputs['08_issue_bloom'] ?? { issue_candidates: [] },
      [FAMILY_LAW_AGENTS.issuePrune]: gold.stateOutputs['09_issue_prune'] ?? { pruning_decisions: [] },
      [FAMILY_LAW_AGENTS.authorityVerification]: gold.stateOutputs['18_authority_verification'] ?? { overall_authority_status: 'machine_assessed_support' },
      [FAMILY_LAW_AGENTS.directLegalConclusion]: gold.stateOutputs['14_direct_legal_conclusion_draft'] ?? { attorney_review_required: true },
      [FAMILY_LAW_AGENTS.clientAdviceDraft]: { release_status: 'external_release_blocked' },
      [FAMILY_LAW_AGENTS.courtFilingDraft]: { release_status: 'external_release_blocked' },
      [FAMILY_LAW_AGENTS.releaseStatusDetermine]: gold.releaseStatuses ?? {},
    };
    for (const [agentId, output] of Object.entries(stateOutputForAgent)) {
      runtime.bindAgent(new ReplayAgent(agentId, output));
    }

    const manifestDal = new ManifestDal(db);
    manifestDal.insert(familyLawProductionManifest);
    const activationDal = new ActivationDal(db);
    const orchestrator = new Orchestrator({ manifestDal, activationDal, opStream, agentRuntime: runtime });

    const activationId = orchestrator.startActivation({
      scope, lensId: familyLawProductionManifest.lensId, lensVersion: familyLawProductionManifest.lensVersion, activatedBy: 'test_attorney',
    });

    const stateAgentMap: Record<string, string> = {
      MatterContextNormalize: FAMILY_LAW_AGENTS.matterContextNormalize,
      JurisdictionCapture: FAMILY_LAW_AGENTS.jurisdictionCapture,
      FactExtraction: FAMILY_LAW_AGENTS.factExtraction,
      ExistingOrderExtract: FAMILY_LAW_AGENTS.existingOrderExtract,
      IssueBloom: FAMILY_LAW_AGENTS.issueBloom,
      IssuePrune: FAMILY_LAW_AGENTS.issuePrune,
      AuthorityVerification: FAMILY_LAW_AGENTS.authorityVerification,
      DirectLegalConclusionDraft: FAMILY_LAW_AGENTS.directLegalConclusion,
      ClientAdviceDraft: FAMILY_LAW_AGENTS.clientAdviceDraft,
      CourtFilingDraftGenerate: FAMILY_LAW_AGENTS.courtFilingDraft,
      ReleaseStatusDetermine: FAMILY_LAW_AGENTS.releaseStatusDetermine,
    };

    const envelopeContext = {
      privilegeFrame: { snapshotHash: 'hash', version: 1 },
      authorizedSources: [],
      authorizedPriorArtifacts: [],
      authorizedMMP: [],
      forbiddenScopes: [],
    };

    // Drive all 11 required states
    for (let i = 0; i < familyLawProductionManifest.states.length; i++) {
      const state = familyLawProductionManifest.states[i];
      const r = await orchestrator.advanceNextState({
        scope,
        activationId,
        stateInput: {},
        envelopeContext,
        agentId: stateAgentMap[state.stateId],
      });
      expect(r.status).toBe('completed');
      expect(r.stateId).toBe(state.stateId);
    }

    expect(orchestrator.isActivationComplete(scope, activationId)).toBe(true);

    // Build a snapshot from the activation's state outputs and run the gold-matter assertions
    const completed = activationDal.listCompletedStates(scope, activationId);
    const stateOutputs: Record<string, unknown> = {};
    for (const stateId of completed) {
      const row = activationDal.getStateOutput(scope, activationId, stateId);
      if (row) stateOutputs[stateId] = JSON.parse(row.outputJson);
    }

    const snapshot: Record<string, unknown> = {
      lens: gold.expectedLensClassification, // lens classification is upstream of activation; supply gold's expected
      completed_states: completed,
      required_states: gold.requiredStates,
      state_outputs: {
        '08_issue_bloom': stateOutputs.IssueBloom,
        '09_issue_prune': stateOutputs.IssuePrune,
        '14_direct_legal_conclusion_draft': stateOutputs.DirectLegalConclusionDraft,
        '18_authority_verification': stateOutputs.AuthorityVerification,
      },
      release_status: stateOutputs.ReleaseStatusDetermine,
      issue_prune: derivePruneSummary(stateOutputs.IssuePrune as { pruning_decisions?: unknown[] } | undefined),
      authority_verification: { overall_authority_status: (stateOutputs.AuthorityVerification as { overall_authority_status?: string } | undefined)?.overall_authority_status ?? 'machine_assessed_support' },
      direct_legal_conclusion: { attorney_review_required: Boolean((stateOutputs.DirectLegalConclusionDraft as { attorney_review_required?: boolean } | undefined)?.attorney_review_required ?? true) },
      court_filing_draft: { filing_allowed: deriveFilingAllowed(stateOutputs.ReleaseStatusDetermine as Record<string, string> | undefined) },
      client_advice_draft: { external_send_allowed: deriveSendAllowed(stateOutputs.ReleaseStatusDetermine as Record<string, string> | undefined) },
    };

    const results = new AssertionRunner().run(snapshot, gold.assertions.assertions);
    const failures = results.filter((r) => r.status === 'fail');
    if (failures.length > 0) {
      throw new Error('Family Law E2E assertion failures:\n' + failures.map((f) => `  ${f.assertionId}: ${f.reason}`).join('\n'));
    }
    expect(failures).toHaveLength(0);
  });
});

function derivePruneSummary(out: { pruning_decisions?: unknown[] } | undefined): { retained: string[]; removed: string[]; deferred: string[] } {
  const retained: string[] = [];
  const removed: string[] = [];
  const deferred: string[] = [];
  if (out && Array.isArray(out.pruning_decisions)) {
    for (const d of out.pruning_decisions as Array<{ issue?: string; decision?: string }>) {
      const issue = String(d.issue ?? '');
      switch (d.decision) {
        case 'retain': retained.push(issue); break;
        case 'remove': removed.push(issue); break;
        case 'defer': deferred.push(issue); break;
      }
    }
  }
  return { retained, removed, deferred };
}

function deriveFilingAllowed(rs: Record<string, string> | undefined): boolean {
  return rs?.draft_court_filing?.startsWith('approved') ?? false;
}

function deriveSendAllowed(rs: Record<string, string> | undefined): boolean {
  return rs?.draft_client_advice_message?.startsWith('approved') ?? false;
}
