/**
 * Wave 9 — GA demonstration test.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 9 gate:
 *   - Two firms (real or synthetic) onboarded through Layer 3 only.
 *   - Evaluation harness green on full gold set.
 *
 * This test instantiates the platform, onboards both synthetic Layer 3
 * firm configs (MD-primary and VA-primary), runs activations on each, and
 * verifies cross-matter / cross-firm isolation throughout.
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
  PrivilegeFrameDal,
  MatterKeysDal,
  AttorneyActionDal,
  AttorneyAdmissionsDal,
} from '../lib/database/index.js';
import { loadCLVv1 } from '../lib/clv/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { AgentRegistry } from '../lib/registry/agentRegistry.js';
import { AgentRuntime } from '../lib/agents/runtime.js';
import { Orchestrator } from '../lib/orchestrator/orchestrator.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter } from '../lib/governedStream/matterTrackWriter.js';
import { MatterTrackReader } from '../lib/governedStream/matterTrackReader.js';
import { AttorneyActionService } from '../lib/attorneyAction/service.js';
import { ReleaseGateEvaluator } from '../lib/releaseGate/evaluator.js';
import { TelemetryAuditor } from '../lib/telemetry/auditor.js';
import {
  familyLawProductionManifest,
  FAMILY_LAW_AGENTS,
} from '../layer2_lens_packs/familyLawProduction/manifest.js';
import { registerAllMvpAgents } from '../layer2_lens_packs/registrations.js';
import { ReplayAgent } from './fixtures/replayAgents.js';
import { loadFirmConfig, citatorFromConfig } from '../layer3_firm_config/loader.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';

describe('Wave 9 — GA demonstration', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-w9-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('two firms onboarded via Layer 3, each runs full lens activation, isolation holds across firms', async () => {
    const mdConfig = loadFirmConfig('firm_synth_md');
    const vaConfig = loadFirmConfig('firm_synth_va');
    expect(mdConfig).toBeDefined();
    expect(vaConfig).toBeDefined();

    // Each firm's citator is materialized from its config — Layer 1 stays firm-agnostic.
    const mdCitator = citatorFromConfig(mdConfig!);
    const vaCitator = citatorFromConfig(vaConfig!);
    expect(mdCitator.lookup({ authorityId: 'MD-FAM-CUSTODY-CASE-001', citation: 'X', authorityType: 'case_law', jurisdiction: 'MD' })?.treatment).toBe('good_law');
    expect(vaCitator.lookup({ authorityId: 'MD-FAM-CUSTODY-CASE-001', citation: 'X', authorityType: 'case_law', jurisdiction: 'MD' })).toBeUndefined();

    const firmDal = new FirmDal(db);
    const opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);
    const admissions = new AttorneyAdmissionsDal(db);

    // Onboard MD firm
    firmDal.insertFirm(mdConfig!.firmId, mdConfig!.displayName, mdConfig!.primaryJurisdiction);
    firmDal.insertClient(mdConfig!.firmId, 'md_c1', 'MD Client');
    firmDal.insertMatter({ firmId: mdConfig!.firmId, clientId: 'md_c1', matterId: 'md_m1', matterName: 'MD Matter', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertUser({ firmId: mdConfig!.firmId, userId: 'md_attorney', displayName: 'MD Attorney', role: 'attorney' });
    admissions.insert({ firmId: mdConfig!.firmId, attorneyId: 'md_attorney', jurisdiction: 'MD', barNumber: 'MD-1', admittedAt: '2010-01-01', status: 'active' });

    // Onboard VA firm
    firmDal.insertFirm(vaConfig!.firmId, vaConfig!.displayName, vaConfig!.primaryJurisdiction);
    firmDal.insertClient(vaConfig!.firmId, 'va_c1', 'VA Client');
    firmDal.insertMatter({ firmId: vaConfig!.firmId, clientId: 'va_c1', matterId: 'va_m1', matterName: 'VA Matter', practiceArea: 'business_civil', primaryJurisdiction: 'VA', matterType: 'contract_dispute' });
    firmDal.insertUser({ firmId: vaConfig!.firmId, userId: 'va_attorney', displayName: 'VA Attorney', role: 'attorney' });
    admissions.insert({ firmId: vaConfig!.firmId, attorneyId: 'va_attorney', jurisdiction: 'VA', barNumber: 'VA-1', admittedAt: '2012-01-01', status: 'active' });

    const mdScope = { firmId: mdConfig!.firmId, clientId: 'md_c1', matterId: 'md_m1' };
    const vaScope = { firmId: vaConfig!.firmId, clientId: 'va_c1', matterId: 'va_m1' };

    const mdKeys = keySvc.provision(mdScope);
    const vaKeys = keySvc.provision(vaScope);

    const mdFrameRef = frameDal.saveSnapshot(mdScope, { matterId: 'md_m1', attorneyClientPairs: [{ attorneyId: 'md_attorney', clientId: 'md_c1' }] } as PrivilegeFrame);
    const vaFrameRef = frameDal.saveSnapshot(vaScope, { matterId: 'va_m1', attorneyClientPairs: [{ attorneyId: 'va_attorney', clientId: 'va_c1' }] } as PrivilegeFrame);

    const mdStore = new MatterTrackStore(matterTrackPath(dir, mdScope));
    const vaStore = new MatterTrackStore(matterTrackPath(dir, vaScope));
    const mdWriter = new MatterTrackWriter(mdScope, mdStore, mdKeys.contentKey, mdKeys.mentalKey, opStream);
    const vaWriter = new MatterTrackWriter(vaScope, vaStore, vaKeys.contentKey, vaKeys.mentalKey, opStream);

    // Same lens manifest, same agent registry — both firms use the same Layer 1 + Layer 2.
    const registry = new AgentRegistry();
    registerAllMvpAgents(registry);
    const manifestDal = new ManifestDal(db);
    manifestDal.insert(familyLawProductionManifest);
    const activationDal = new ActivationDal(db);
    const runtime = new AgentRuntime({ registry, opStream });
    const replays: Record<string, unknown> = {
      [FAMILY_LAW_AGENTS.matterContextNormalize]: { matter_type: 'sample' },
      [FAMILY_LAW_AGENTS.jurisdictionCapture]: { jurisdiction: 'sample' },
      [FAMILY_LAW_AGENTS.factExtraction]: { document_supported_facts: [] },
      [FAMILY_LAW_AGENTS.existingOrderExtract]: {},
      [FAMILY_LAW_AGENTS.issueBloom]: { issue_candidates: [] },
      [FAMILY_LAW_AGENTS.issuePrune]: { pruning_decisions: [] },
      [FAMILY_LAW_AGENTS.authorityVerification]: { overall_authority_status: 'machine_assessed_support' },
      [FAMILY_LAW_AGENTS.directLegalConclusion]: { attorney_review_required: true },
      [FAMILY_LAW_AGENTS.clientAdviceDraft]: {},
      [FAMILY_LAW_AGENTS.courtFilingDraft]: {},
      [FAMILY_LAW_AGENTS.releaseStatusDetermine]: { draft_court_filing: 'external_release_blocked' },
    };
    for (const [agentId, output] of Object.entries(replays)) runtime.bindAgent(new ReplayAgent(agentId, output));
    const orchestrator = new Orchestrator({ manifestDal, activationDal, opStream, agentRuntime: runtime });

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

    // Run MD activation
    const mdAct = orchestrator.startActivation({ scope: mdScope, lensId: familyLawProductionManifest.lensId, lensVersion: 'v1', activatedBy: 'md_attorney' });
    for (const state of familyLawProductionManifest.states) {
      const r = await orchestrator.advanceNextState({
        scope: mdScope, activationId: mdAct, stateInput: {},
        envelopeContext: { privilegeFrame: mdFrameRef, authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [] },
        agentId: stateAgentMap[state.stateId],
      });
      expect(r.status).toBe('completed');
    }

    // Run VA activation in parallel (state-output isolation)
    const vaAct = orchestrator.startActivation({ scope: vaScope, lensId: familyLawProductionManifest.lensId, lensVersion: 'v1', activatedBy: 'va_attorney' });
    for (const state of familyLawProductionManifest.states) {
      const r = await orchestrator.advanceNextState({
        scope: vaScope, activationId: vaAct, stateInput: {},
        envelopeContext: { privilegeFrame: vaFrameRef, authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [] },
        agentId: stateAgentMap[state.stateId],
      });
      expect(r.status).toBe('completed');
    }

    expect(orchestrator.isActivationComplete(mdScope, mdAct)).toBe(true);
    expect(orchestrator.isActivationComplete(vaScope, vaAct)).toBe(true);

    // Cross-firm key isolation — VA reader cannot decrypt MD's stream
    mdWriter.write({ scope: mdScope, activeMatterContext: mdScope, eventType: 'fact_extracted', payload: { md_secret: 'X' }, clvScope: [], declaredClassification: 'work_product_factual', privilegeFrameRef: mdFrameRef });
    const adversaryReader = new MatterTrackReader(mdStore, vaKeys.contentKey, vaKeys.mentalKey);
    const adversaryEvents = adversaryReader.read({ authorizedClassifications: ['work_product_factual'] });
    expect(adversaryEvents.every((e) => e.redacted)).toBe(true);

    // Filing: each attorney files in their own forum; the other refuses
    const md_aa = new AttorneyActionService(new AttorneyActionDal(db), admissions, mdWriter);
    const va_aa = new AttorneyActionService(new AttorneyActionDal(db), admissions, vaWriter);
    const mdFile = md_aa.record({
      scope: mdScope, activeMatterContext: mdScope,
      artifactId: 'art_md', artifactVersionHash: 'h_md',
      attorneyId: 'md_attorney', attorneyRole: 'signing_attorney', action: 'signed_for_filing',
      forumJurisdiction: 'MD', signatureMode: 'ecf_compatible', privilegeFrameRef: mdFrameRef,
    });
    expect(mdFile.jurisdictionRequirementsMet).toBe(true);

    expect(() =>
      va_aa.record({
        scope: vaScope, activeMatterContext: vaScope,
        artifactId: 'art_va_in_md', artifactVersionHash: 'h_va_in_md',
        attorneyId: 'va_attorney', attorneyRole: 'signing_attorney', action: 'signed_for_filing',
        forumJurisdiction: 'MD', signatureMode: 'ecf_compatible', privilegeFrameRef: vaFrameRef,
      }),
    ).toThrow(/not admitted in forum jurisdiction/);

    // Release gate: MD filing approved given attorney_confirmed authority
    const ev = new ReleaseGateEvaluator();
    const r = ev.evaluate({
      artifactId: 'art_md', artifactType: 'court_filing_draft', artifactVersionHash: 'h_md',
      target: 'court', forumJurisdiction: 'MD',
      attorneyActions: [{ action: mdFile.action, attorneyId: mdFile.attorneyId, attorneyRole: mdFile.attorneyRole, jurisdictionRequirementsMet: mdFile.jurisdictionRequirementsMet, artifactVersionHash: 'h_md' }],
      conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'attorney_confirmed',
      sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true,
      lnfrGateStatus: 'pass',
    });
    expect(r.status).toBe('approved_for_filing');

    // Telemetry audit per firm
    const mdAudit = new TelemetryAuditor(opStream).audit(mdConfig!.firmId);
    const vaAudit = new TelemetryAuditor(opStream).audit(vaConfig!.firmId);
    expect(mdAudit.metrics.requiredStateCompletionRate).toBe(1);
    expect(vaAudit.metrics.requiredStateCompletionRate).toBe(1);
    expect(mdAudit.metrics.stateCompletedCount).toBe(11);
    expect(vaAudit.metrics.stateCompletedCount).toBe(11);

    mdStore.close();
    vaStore.close();
  });
});
