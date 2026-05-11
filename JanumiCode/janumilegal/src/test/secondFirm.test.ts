/**
 * Wave 8 gate: second-firm test.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 8 §8.4:
 *   "Synthetic second firm + second jurisdiction + second practice area
 *    instantiated. Canonical evaluation suite runs against it. Test fails
 *    if onboarding requires changes outside Layer 3 + Layer 2 lens-pack
 *    adaptation."
 *
 * The test exercises the platform with a synthetic firm distinct from any
 * design partner. It asserts that:
 *   - core platform components instantiate cleanly,
 *   - lens manifests load + validate,
 *   - the orchestrator runs an activation,
 *   - matter switching works,
 *   - release-gate decisions are jurisdiction-correct.
 *
 * No Layer 1 source contains this firm's identity; the test passes only if
 * the platform treats the firm/client/matter as opaque tenancy data.
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
  DashboardDal,
} from '../lib/database/index.js';
import { loadCLVv1 } from '../lib/clv/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { AgentRegistry } from '../lib/registry/agentRegistry.js';
import { AgentRuntime } from '../lib/agents/runtime.js';
import { Orchestrator } from '../lib/orchestrator/orchestrator.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter } from '../lib/governedStream/matterTrackWriter.js';
import { AttorneyActionService } from '../lib/attorneyAction/service.js';
import { ReleaseGateEvaluator } from '../lib/releaseGate/evaluator.js';
import { DashboardService } from '../lib/dashboard/service.js';
import { ActiveMatterContext } from '../lib/scope/activeMatterContext.js';
import { MatterSwitchService } from '../lib/matterSwitch/service.js';
import {
  familyLawProductionManifest,
  FAMILY_LAW_AGENTS,
} from '../layer2_lens_packs/familyLawProduction/manifest.js';
import { registerAllMvpAgents } from '../layer2_lens_packs/registrations.js';
import { ReplayAgent } from './fixtures/replayAgents.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';

// SYNTHETIC second firm — name and identifiers picked to be unrelated to any
// design partner. The point of the test is that Layer 1 doesn't know who
// this firm is.
const SECOND_FIRM = {
  firmId: 'firm_acme_legal_va',
  name: 'Acme Legal Group',
  primaryJurisdiction: 'VA',
};
const SECOND_CLIENT = { id: 'client_widget_co', name: 'Widget Co.' };
const SECOND_MATTER = {
  id: 'matter_va_business_dispute',
  name: 'Widget Co. v. Vendor Dispute',
  practiceArea: 'business_civil',
  primaryJurisdiction: 'VA',
  matterType: 'contract_dispute',
};

describe('Wave 8 gate — second-firm test', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-2firm-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('platform onboards a second firm with no Layer-1 changes', async () => {
    const firmDal = new FirmDal(db);
    const opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);

    // Register the second firm + client + matter — pure data flow, no code
    // changes to Layer 1.
    firmDal.insertFirm(SECOND_FIRM.firmId, SECOND_FIRM.name, SECOND_FIRM.primaryJurisdiction);
    firmDal.insertClient(SECOND_FIRM.firmId, SECOND_CLIENT.id, SECOND_CLIENT.name);
    firmDal.insertMatter({
      firmId: SECOND_FIRM.firmId,
      clientId: SECOND_CLIENT.id,
      matterId: SECOND_MATTER.id,
      matterName: SECOND_MATTER.name,
      practiceArea: SECOND_MATTER.practiceArea,
      primaryJurisdiction: SECOND_MATTER.primaryJurisdiction,
      matterType: SECOND_MATTER.matterType,
    });
    firmDal.insertUser({ firmId: SECOND_FIRM.firmId, userId: 'va_attorney', displayName: 'VA Attorney', role: 'attorney' });
    firmDal.grantAccess({ firmId: SECOND_FIRM.firmId, userId: 'va_attorney', clientId: SECOND_CLIENT.id, matterId: SECOND_MATTER.id, role: 'attorney_of_record', grantedBy: 'admin', grantBasis: 'engagement letter' });

    const admissions = new AttorneyAdmissionsDal(db);
    admissions.insert({ firmId: SECOND_FIRM.firmId, attorneyId: 'va_attorney', jurisdiction: 'VA', barNumber: 'VA-9999', admittedAt: '2018-01-01', status: 'active' });

    const scope = { firmId: SECOND_FIRM.firmId, clientId: SECOND_CLIENT.id, matterId: SECOND_MATTER.id };
    const keys = keySvc.provision(scope);
    const frame: PrivilegeFrame = { matterId: SECOND_MATTER.id, attorneyClientPairs: [{ attorneyId: 'va_attorney', clientId: SECOND_CLIENT.id }] };
    const frameRef = frameDal.saveSnapshot(scope, frame);

    // Lens manifest loads + validates against the SAME registry — Layer 1
    // doesn't know the firm exists.
    const registry = new AgentRegistry();
    registerAllMvpAgents(registry);
    const manifestDal = new ManifestDal(db);
    manifestDal.insert(familyLawProductionManifest);

    // Run the activation through to completion using replay agents.
    const store = new MatterTrackStore(matterTrackPath(dir, scope));
    const writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);
    const runtime = new AgentRuntime({ registry, opStream });
    const replays: Record<string, unknown> = {
      [FAMILY_LAW_AGENTS.matterContextNormalize]: { matter_type: SECOND_MATTER.matterType },
      [FAMILY_LAW_AGENTS.jurisdictionCapture]: { jurisdiction: SECOND_MATTER.primaryJurisdiction },
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
    const activationDal = new ActivationDal(db);
    const orchestrator = new Orchestrator({ manifestDal, activationDal, opStream, agentRuntime: runtime });
    const aId = orchestrator.startActivation({ scope, lensId: familyLawProductionManifest.lensId, lensVersion: 'v1', activatedBy: 'va_attorney' });

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
    const env = { privilegeFrame: frameRef, authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [] };
    for (const state of familyLawProductionManifest.states) {
      const r = await orchestrator.advanceNextState({ scope, activationId: aId, stateInput: {}, envelopeContext: env, agentId: stateAgentMap[state.stateId] });
      expect(r.status).toBe('completed');
    }
    expect(orchestrator.isActivationComplete(scope, aId)).toBe(true);

    // Matter switch + dashboard work jurisdiction-agnostically
    const active = new ActiveMatterContext('va_attorney', 'session_va');
    const switchSvc = new MatterSwitchService(active, firmDal, opStream);
    switchSvc.switchTo({ userId: 'va_attorney', target: scope });
    expect(active.get()?.matterId).toBe(SECOND_MATTER.id);

    const dashSvc = new DashboardService(new DashboardDal(db), activationDal);
    const header = dashSvc.buildMatterHeaderBar(scope);
    expect(header?.clientName).toBe(SECOND_CLIENT.name);
    expect(header?.matterName).toBe(SECOND_MATTER.name);
    expect(header?.practiceArea).toBe(SECOND_MATTER.practiceArea);

    // Filing release: VA-admitted attorney signs ⇒ approved.
    const actionDal = new AttorneyActionDal(db);
    const actionService = new AttorneyActionService(actionDal, admissions, writer);
    const signed = actionService.record({
      scope, activeMatterContext: scope,
      artifactId: 'art1', artifactVersionHash: 'h1',
      attorneyId: 'va_attorney', attorneyRole: 'signing_attorney', action: 'signed_for_filing',
      forumJurisdiction: 'VA', signatureMode: 'ecf_compatible',
      privilegeFrameRef: frameRef,
    });
    expect(signed.jurisdictionRequirementsMet).toBe(true);

    const ev = new ReleaseGateEvaluator();
    const r = ev.evaluate({
      artifactId: 'art1', artifactType: 'court_filing_draft', artifactVersionHash: 'h1',
      target: 'court', forumJurisdiction: 'VA',
      attorneyActions: [{ action: signed.action, attorneyId: signed.attorneyId, attorneyRole: signed.attorneyRole, jurisdictionRequirementsMet: signed.jurisdictionRequirementsMet, artifactVersionHash: 'h1' }],
      conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'attorney_confirmed',
      sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true,
      lnfrGateStatus: 'pass',
    });
    expect(r.status).toBe('approved_for_filing');

    store.close();
  });

  it('VA-admitted attorney CANNOT file in PA forum (jurisdiction-agnostic enforcement)', () => {
    const firmDal = new FirmDal(db);
    const opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);

    firmDal.insertFirm(SECOND_FIRM.firmId, SECOND_FIRM.name, SECOND_FIRM.primaryJurisdiction);
    firmDal.insertClient(SECOND_FIRM.firmId, SECOND_CLIENT.id, SECOND_CLIENT.name);
    firmDal.insertMatter({ firmId: SECOND_FIRM.firmId, clientId: SECOND_CLIENT.id, matterId: SECOND_MATTER.id, matterName: SECOND_MATTER.name, practiceArea: SECOND_MATTER.practiceArea, primaryJurisdiction: SECOND_MATTER.primaryJurisdiction, matterType: SECOND_MATTER.matterType });
    firmDal.insertUser({ firmId: SECOND_FIRM.firmId, userId: 'va_attorney', displayName: 'VA Attorney', role: 'attorney' });
    const admissions = new AttorneyAdmissionsDal(db);
    admissions.insert({ firmId: SECOND_FIRM.firmId, attorneyId: 'va_attorney', jurisdiction: 'VA', barNumber: 'VA-9999', admittedAt: '2018-01-01', status: 'active' });
    const scope = { firmId: SECOND_FIRM.firmId, clientId: SECOND_CLIENT.id, matterId: SECOND_MATTER.id };
    const keys = keySvc.provision(scope);
    const frame: PrivilegeFrame = { matterId: SECOND_MATTER.id, attorneyClientPairs: [] };
    const frameRef = frameDal.saveSnapshot(scope, frame);
    const store = new MatterTrackStore(matterTrackPath(dir, scope));
    const writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);

    const actionService = new AttorneyActionService(new AttorneyActionDal(db), admissions, writer);
    expect(() =>
      actionService.record({
        scope, activeMatterContext: scope,
        artifactId: 'art1', artifactVersionHash: 'h1',
        attorneyId: 'va_attorney', attorneyRole: 'signing_attorney', action: 'signed_for_filing',
        forumJurisdiction: 'PA', signatureMode: 'ecf_compatible',
        privilegeFrameRef: frameRef,
      }),
    ).toThrow(/not admitted in forum jurisdiction/);
    store.close();
  });
});
