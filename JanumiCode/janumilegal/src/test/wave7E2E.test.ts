/**
 * Wave 7 gate: end-to-end attorney workflow.
 *
 *   matter open → bloom/prune → research/draft → review → approve →
 *   release blocked or approved per target.
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
import { AttorneyActionService } from '../lib/attorneyAction/service.js';
import { ReleaseGateEvaluator } from '../lib/releaseGate/evaluator.js';
import {
  familyLawProductionManifest,
  FAMILY_LAW_AGENTS,
} from '../layer2_lens_packs/familyLawProduction/manifest.js';
import { registerAllMvpAgents } from '../layer2_lens_packs/registrations.js';
import { ReplayAgent } from './fixtures/replayAgents.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';

const FIRM = 'firm_jclaw', CLIENT = 'c1', MATTER = 'm1';
const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

describe('Wave 7 — end-to-end attorney workflow', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let attorneyActionService: AttorneyActionService;
  let store: MatterTrackStore;
  let actionDal: AttorneyActionDal;

  const ARTIFACT_VERSION = 'v1_hash_abc';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-w7e2e-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));

    const firmDal = new FirmDal(db);
    const opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);

    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'Father');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'Custody Enforcement', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody_visitation_enforcement' });
    firmDal.insertUser({ firmId: FIRM, userId: 'att_md', displayName: 'Alex MD', role: 'attorney' });
    firmDal.insertUser({ firmId: FIRM, userId: 'att_va_only', displayName: 'Bree VA-only', role: 'attorney' });

    const admissionsDal = new AttorneyAdmissionsDal(db);
    admissionsDal.insert({ firmId: FIRM, attorneyId: 'att_md', jurisdiction: 'MD', barNumber: 'MD-1', admittedAt: '2010-01-01', status: 'active' });
    admissionsDal.insert({ firmId: FIRM, attorneyId: 'att_va_only', jurisdiction: 'VA', barNumber: 'VA-1', admittedAt: '2010-01-01', status: 'active' });

    const keys = keySvc.provision(scope);
    const frame: PrivilegeFrame = { matterId: MATTER, attorneyClientPairs: [{ attorneyId: 'att_md', clientId: CLIENT }] };
    const frameRef = frameDal.saveSnapshot(scope, frame);

    store = new MatterTrackStore(matterTrackPath(dir, scope));
    const writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);
    actionDal = new AttorneyActionDal(db);
    attorneyActionService = new AttorneyActionService(actionDal, admissionsDal, writer);

    // Set up orchestrator with replay agents (Wave 6 pattern) so we can drive
    // an activation through to completion for the E2E.
    const registry = new AgentRegistry();
    registerAllMvpAgents(registry);
    const runtime = new AgentRuntime({ registry, opStream });
    const stubOutputs: Record<string, unknown> = {
      [FAMILY_LAW_AGENTS.matterContextNormalize]: { matter_type: 'custody_visitation_enforcement' },
      [FAMILY_LAW_AGENTS.jurisdictionCapture]: { jurisdiction: 'Maryland' },
      [FAMILY_LAW_AGENTS.factExtraction]: { document_supported_facts: [{ fact: 'father access weekend', source: 'order' }] },
      [FAMILY_LAW_AGENTS.existingOrderExtract]: { potential_order_violation: true },
      [FAMILY_LAW_AGENTS.issueBloom]: { issue_candidates: [{ issue: 'enforcement', why_it_might_matter: 'order violation' }] },
      [FAMILY_LAW_AGENTS.issuePrune]: { pruning_decisions: [{ issue: 'enforcement', decision: 'retain', reason: 'matches client objective' }] },
      [FAMILY_LAW_AGENTS.authorityVerification]: { overall_authority_status: 'machine_assessed_support' },
      [FAMILY_LAW_AGENTS.directLegalConclusion]: { attorney_review_required: true, conclusion_text: 'enforcement viable' },
      [FAMILY_LAW_AGENTS.clientAdviceDraft]: { release_status: 'external_release_blocked' },
      [FAMILY_LAW_AGENTS.courtFilingDraft]: { release_status: 'external_release_blocked' },
      [FAMILY_LAW_AGENTS.releaseStatusDetermine]: { draft_court_filing: 'external_release_blocked' },
    };
    for (const [agentId, output] of Object.entries(stubOutputs)) runtime.bindAgent(new ReplayAgent(agentId, output));

    const manifestDal = new ManifestDal(db);
    manifestDal.insert(familyLawProductionManifest);
    const activationDal = new ActivationDal(db);
    const orchestrator = new Orchestrator({ manifestDal, activationDal, opStream, agentRuntime: runtime });

    // Drive the activation through every state to produce the artifact-relevant outputs.
    const activationId = orchestrator.startActivation({
      scope, lensId: familyLawProductionManifest.lensId, lensVersion: familyLawProductionManifest.lensVersion, activatedBy: 'att_md',
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
      privilegeFrame: frameRef,
      authorizedSources: [],
      authorizedPriorArtifacts: [],
      authorizedMMP: [],
      forbiddenScopes: [],
    };
    return (async () => {
      for (const state of familyLawProductionManifest.states) {
        await orchestrator.advanceNextState({
          scope, activationId, stateInput: {}, envelopeContext, agentId: stateAgentMap[state.stateId],
        });
      }
    })();
  });

  afterEach(() => {
    store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function privilegeFrameRef(): { snapshotHash: string; version: number } {
    return { snapshotHash: 'hash-test', version: 1 };
  }

  it('court filing BLOCKED before signature; APPROVED after signing attorney admitted in forum signs', () => {
    const ev = new ReleaseGateEvaluator();

    // Pre-signature: filing target ⇒ blocked
    const blocked = ev.evaluate({
      artifactId: 'art_filing',
      artifactType: 'court_filing_draft',
      artifactVersionHash: ARTIFACT_VERSION,
      target: 'court',
      forumJurisdiction: 'MD',
      attorneyActions: [],
      conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'attorney_confirmed',
      sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true,
      lnfrGateStatus: 'pass',
    });
    expect(blocked.status).toBe('external_release_blocked');

    // Sign as MD-admitted attorney → recorded
    const signed = attorneyActionService.record({
      scope, activeMatterContext: scope,
      artifactId: 'art_filing', artifactVersionHash: ARTIFACT_VERSION,
      attorneyId: 'att_md', attorneyRole: 'signing_attorney', action: 'signed_for_filing',
      forumJurisdiction: 'MD', signatureMode: 'ecf_compatible',
      privilegeFrameRef: privilegeFrameRef(),
    });
    expect(signed.jurisdictionRequirementsMet).toBe(true);

    // Re-evaluate with the action present
    const approved = ev.evaluate({
      artifactId: 'art_filing',
      artifactType: 'court_filing_draft',
      artifactVersionHash: ARTIFACT_VERSION,
      target: 'court',
      forumJurisdiction: 'MD',
      attorneyActions: [{ action: signed.action, attorneyId: signed.attorneyId, attorneyRole: signed.attorneyRole, jurisdictionRequirementsMet: signed.jurisdictionRequirementsMet, artifactVersionHash: signed.artifactVersionHash }],
      conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'attorney_confirmed',
      sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true,
      lnfrGateStatus: 'pass',
    });
    expect(approved.status).toBe('approved_for_filing');
  });

  it('FILING REFUSED at AttorneyAction layer when attorney is admitted only in non-forum jurisdiction', () => {
    expect(() =>
      attorneyActionService.record({
        scope, activeMatterContext: scope,
        artifactId: 'art_filing', artifactVersionHash: ARTIFACT_VERSION,
        attorneyId: 'att_va_only', attorneyRole: 'signing_attorney', action: 'signed_for_filing',
        forumJurisdiction: 'MD', signatureMode: 'ecf_compatible',
        privilegeFrameRef: privilegeFrameRef(),
      }),
    ).toThrow(/not admitted in forum jurisdiction/);
  });

  it('client advice BLOCKED until attorney_confirmed authority + approval; then APPROVED', () => {
    const ev = new ReleaseGateEvaluator();

    // Stage 1: machine-assessed only → blocked
    const blocked1 = ev.evaluate({
      artifactId: 'art_advice',
      artifactType: 'client_advice_draft',
      artifactVersionHash: ARTIFACT_VERSION,
      target: 'client',
      attorneyActions: [],
      conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'machine_assessed_support',
      sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true,
      lnfrGateStatus: 'pass',
    });
    expect(blocked1.status).toBe('client_release_blocked');

    // Stage 2: approval added but authority still machine-assessed → still blocked
    attorneyActionService.record({
      scope, activeMatterContext: scope,
      artifactId: 'art_advice', artifactVersionHash: ARTIFACT_VERSION,
      attorneyId: 'att_md', attorneyRole: 'attorney_of_record', action: 'approved_for_client_release',
      privilegeFrameRef: privilegeFrameRef(),
    });
    const actions = actionDal.listForArtifact(scope, 'art_advice').map((a) => ({
      action: a.action, attorneyId: a.attorneyId, attorneyRole: a.attorneyRole,
      jurisdictionRequirementsMet: a.jurisdictionRequirementsMet, artifactVersionHash: a.artifactVersionHash,
    }));
    const blocked2 = ev.evaluate({
      artifactId: 'art_advice', artifactType: 'client_advice_draft', artifactVersionHash: ARTIFACT_VERSION,
      target: 'client', attorneyActions: actions, conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'machine_assessed_support', sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true, lnfrGateStatus: 'pass',
    });
    expect(blocked2.status).toBe('client_release_blocked');

    // Stage 3: authority becomes attorney_confirmed → approved
    const approved = ev.evaluate({
      artifactId: 'art_advice', artifactType: 'client_advice_draft', artifactVersionHash: ARTIFACT_VERSION,
      target: 'client', attorneyActions: actions, conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'attorney_confirmed', sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true, lnfrGateStatus: 'pass',
    });
    expect(approved.status).toBe('approved_for_client_use');
  });

  it('approval is bound to the artifactVersionHash; revising the artifact invalidates the prior approval', () => {
    const ev = new ReleaseGateEvaluator();
    attorneyActionService.record({
      scope, activeMatterContext: scope,
      artifactId: 'art_advice', artifactVersionHash: 'v1_hash',
      attorneyId: 'att_md', attorneyRole: 'attorney_of_record', action: 'approved_for_client_release',
      privilegeFrameRef: privilegeFrameRef(),
    });
    const actions = actionDal.listForArtifact(scope, 'art_advice').map((a) => ({
      action: a.action, attorneyId: a.attorneyId, attorneyRole: a.attorneyRole,
      jurisdictionRequirementsMet: a.jurisdictionRequirementsMet, artifactVersionHash: a.artifactVersionHash,
    }));
    const r = ev.evaluate({
      artifactId: 'art_advice', artifactType: 'client_advice_draft', artifactVersionHash: 'v2_hash_after_edit',
      target: 'client', attorneyActions: actions, conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'attorney_confirmed', sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true, lnfrGateStatus: 'pass',
    });
    expect(r.status).toBe('client_release_blocked');
  });
});
