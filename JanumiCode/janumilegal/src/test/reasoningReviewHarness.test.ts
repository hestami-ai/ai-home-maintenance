/**
 * Reasoning-review harness tests (Wave 11).
 *
 * Covers:
 *   - Foundation dispatch: deterministic + LLM validators selected by state.
 *   - Decorrelation invariant.
 *   - validator_unavailable surfacing when invoke missing or reviewer absent.
 *   - Severity counts + decision derivation.
 *   - Service writes per-finding + summary to matter track at correct
 *     classifications, and metadata-only event to op-track.
 *   - Release-gate honors openHighSeverityFindings / acknowledgements.
 *   - AttorneyAction acknowledgement invariants.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  openDirect,
  ClvDal,
  FirmDal,
  OpStreamDal,
  PrivilegeFrameDal,
  MatterKeysDal,
  PromptTemplateDal,
  AttorneyAdmissionsDal,
  AttorneyActionDal,
} from '../lib/database/index.js';
import { DbBackedCLV, loadCLVv1 } from '../lib/clv/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter } from '../lib/governedStream/matterTrackWriter.js';
import { MatterTrackReader } from '../lib/governedStream/matterTrackReader.js';
import { PromptTemplateRegistry } from '../lib/promptTemplates/registry.js';
import { MockLLMProvider } from '../lib/llm/mockProvider.js';
import { ReasoningReviewRegistry } from '../lib/reasoningReview/registry.js';
import { ReasoningReviewHarness } from '../lib/reasoningReview/harness.js';
import { ReasoningReviewService } from '../lib/reasoningReview/service.js';
import { registerReasoningReviewTemplates } from '../lib/reasoningReview/promptTemplates.js';
import { assertReviewerDecorrelated } from '../lib/agents/routing.js';
import { ReleaseGateEvaluator } from '../lib/releaseGate/evaluator.js';
import { AttorneyActionService } from '../lib/attorneyAction/service.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';
import type { ValidatorRuntimeParams } from '../lib/reasoningReview/types.js';
import type { AgentInvocationScope } from '../lib/scope/agentInvocationScope.js';

const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';
const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

function buildEnvelope(stateId: string, frameRef: { snapshotHash: string; version: number }): AgentInvocationScope {
  return {
    firmId: FIRM, clientId: CLIENT, matterId: MATTER,
    lensId: 'family_law_production_lens', lensVersion: 'v1', stateId,
    privilegeFrame: frameRef,
    authorizedSources: [], authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [],
  };
}

describe('Reasoning-review harness — Wave 11 foundation', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let clv: DbBackedCLV;
  let templateRegistry: PromptTemplateRegistry;
  let store: MatterTrackStore;
  let writer: MatterTrackWriter;
  let opStream: OpStreamDal;
  let frameRef: { snapshotHash: string; version: number };
  let contentKey: Buffer;
  let mentalKey: Buffer;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-rr-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
    clv = new DbBackedCLV(new ClvDal(db));
    const firmDal = new FirmDal(db);
    opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);
    firmDal.insertFirm(FIRM, 'X', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    const keys = keySvc.provision(scope);
    contentKey = keys.contentKey;
    mentalKey = keys.mentalKey;
    const frame: PrivilegeFrame = { matterId: MATTER, attorneyClientPairs: [] };
    frameRef = frameDal.saveSnapshot(scope, frame);
    store = new MatterTrackStore(matterTrackPath(dir, scope));
    writer = new MatterTrackWriter(scope, store, contentKey, mentalKey, opStream);
    templateRegistry = new PromptTemplateRegistry(new PromptTemplateDal(db), clv);
    registerReasoningReviewTemplates(templateRegistry);
  });

  afterEach(() => {
    store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('runs deterministic validators and surfaces banned certainty phrase as HIGH', async () => {
    const registry = new ReasoningReviewRegistry();
    const harness = new ReasoningReviewHarness({ registry });
    const params: ValidatorRuntimeParams = {
      stateId: 'DirectLegalConclusionDraft',
      agentId: 'family_law_direct_legal_conclusion_agent.v1',
      stateOutput: { conclusion_text: 'You are guaranteed to win this case.', attorney_review_required: true, verification_status: 'machine_assessed' },
      stateOutputText: JSON.stringify({ conclusion_text: 'You are guaranteed to win this case.', attorney_review_required: true, verification_status: 'machine_assessed' }),
      assembledPrompt: { system: '', user: '' },
      envelope: buildEnvelope('DirectLegalConclusionDraft', frameRef),
    };
    const summary = await harness.review(params);
    const real = summary.findings.filter((f) => !f.unavailable);
    const banned = real.find((f) => f.type === 'banned_certainty_phrase');
    expect(banned).toBeDefined();
    expect(banned!.severity).toBe('HIGH');
    expect(banned!.classification).toBe('work_product_factual');
    expect(summary.severityCounts.HIGH).toBeGreaterThan(0);
  });

  it('flags release-floor violation on ReleaseStatusDetermine', async () => {
    const registry = new ReasoningReviewRegistry();
    const harness = new ReasoningReviewHarness({ registry });
    const out = { draft_court_filing: 'approved_for_filing', draft_client_advice_message: 'external_release_blocked' };
    const params: ValidatorRuntimeParams = {
      stateId: 'ReleaseStatusDetermine',
      agentId: 'family_law_release_status_determine_agent.v1',
      stateOutput: out, stateOutputText: JSON.stringify(out),
      assembledPrompt: { system: '', user: '' },
      envelope: buildEnvelope('ReleaseStatusDetermine', frameRef),
    };
    const summary = await harness.review(params);
    const finding = summary.findings.find((f) => f.type === 'release_map_floor_violation');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('HIGH');
  });

  it('quote_provenance flags unprovenanced quote when sources do not contain it', async () => {
    const registry = new ReasoningReviewRegistry();
    const harness = new ReasoningReviewHarness({ registry });
    const longQuote = 'this exact long span of forty-plus chars is fabricated';
    const out = { conclusion_text: `the order says: "${longQuote}"`, attorney_review_required: true };
    const sourceMap = new Map<string, string>([['order', 'the order says: every other weekend access']]);
    const params: ValidatorRuntimeParams = {
      stateId: 'DirectLegalConclusionDraft',
      agentId: 'family_law_direct_legal_conclusion_agent.v1',
      stateOutput: out, stateOutputText: JSON.stringify(out),
      assembledPrompt: { system: '', user: '' },
      envelope: buildEnvelope('DirectLegalConclusionDraft', frameRef),
      authorizedSourceContent: sourceMap,
    };
    const summary = await harness.review(params);
    const finding = summary.findings.find((f) => f.type === 'unprovenanced_quote');
    expect(finding).toBeDefined();
  });

  it('LLM validators are surfaced as validator_unavailable when no reviewer provider configured', async () => {
    const registry = new ReasoningReviewRegistry();
    const harness = new ReasoningReviewHarness({ registry }); // no reviewer
    const out = { matter_type: 'custody_visitation_enforcement', client_role: 'father', child_involved: true };
    const params: ValidatorRuntimeParams = {
      stateId: 'MatterContextNormalize',
      agentId: 'family_law_matter_context_normalize_agent.v1',
      stateOutput: out, stateOutputText: JSON.stringify(out),
      assembledPrompt: { system: '', user: '' },
      envelope: buildEnvelope('MatterContextNormalize', frameRef),
    };
    const summary = await harness.review(params);
    expect(summary.decision).toBe('escalate'); // pinned to escalate when reviewer absent
    const unavail = summary.findings.filter((f) => f.unavailable);
    expect(unavail.length).toBeGreaterThan(0);
    // grounding_validator and final_synthesis should appear as unavailable
    const ids = new Set(unavail.map((f) => f.validatorId));
    expect(ids.has('grounding_validator')).toBe(true);
    expect(ids.has('final_synthesis')).toBe(true);
  });

  it('runs LLM validators against a mock reviewer provider; final_synthesis decides pass', async () => {
    const reviewer = new MockLLMProvider();
    // grounding_validator and friends return clean issues; final_synthesis returns decision pass
    reviewer.push({
      match: (r) => /final reviewer/.test(r.system ?? ''),
      response: { content: '{"decision":"pass","rationale":"clean"}' },
    });
    reviewer.push({
      match: () => true, // catch-all for other validators returns no issues
      response: { content: '{"issues":[]}' },
    });
    const registry = new ReasoningReviewRegistry();
    const harness = new ReasoningReviewHarness({ registry, reviewerProvider: reviewer, templateRegistry, clv, reviewerModel: 'gemma2:e4b' });
    const out = { matter_type: 'custody_visitation_enforcement', client_role: 'father', child_involved: true };
    const params: ValidatorRuntimeParams = {
      stateId: 'MatterContextNormalize',
      agentId: 'family_law_matter_context_normalize_agent.v1',
      stateOutput: out, stateOutputText: JSON.stringify(out),
      assembledPrompt: { system: '', user: '' },
      envelope: buildEnvelope('MatterContextNormalize', frameRef),
    };
    const summary = await harness.review(params);
    expect(summary.decision).toBe('pass');
    expect(summary.reviewerModel).toBe('gemma2:e4b');
    expect(reviewer.calls.length).toBeGreaterThan(0);
  });

  it('service persists per-finding events at correct classifications + summary + op-track metadata', async () => {
    const reviewer = new MockLLMProvider();
    reviewer.push({ match: () => true, response: { content: '{"issues":[]}' } });
    const registry = new ReasoningReviewRegistry();
    const harness = new ReasoningReviewHarness({ registry, reviewerProvider: reviewer, templateRegistry, clv });
    const service = new ReasoningReviewService(harness, writer, opStream);

    const out = { conclusion_text: 'reasonable basis exists', attorney_review_required: true, verification_status: 'machine_assessed' };
    const params: ValidatorRuntimeParams = {
      stateId: 'DirectLegalConclusionDraft',
      agentId: 'family_law_direct_legal_conclusion_agent.v1',
      stateOutput: out, stateOutputText: JSON.stringify(out),
      assembledPrompt: { system: '', user: '' },
      envelope: buildEnvelope('DirectLegalConclusionDraft', frameRef),
    };

    const summary = await service.reviewAndPersist(params);
    expect(summary.harnessRunId).toBeTruthy();

    const reader = new MatterTrackReader(store, contentKey, mentalKey);
    const events = reader.read({ authorizedClassifications: ['work_product_factual', 'work_product_mental'] });
    const findingEvents = events.filter((e) => e.eventType === 'reasoning_review_finding');
    const summaryEvents = events.filter((e) => e.eventType === 'reasoning_review_harness');
    expect(summaryEvents.length).toBe(1);
    expect(findingEvents.length).toBeGreaterThan(0);
    // deterministic findings encrypted under content key (work_product_factual)
    expect(findingEvents.every((e) => !e.redacted)).toBe(true);
    // summary classification is factual (counts only)
    expect(summaryEvents[0].classification).toBe('work_product_factual');

    // op-track metadata-only event present
    const opEvents = opStream.recent(FIRM, 100);
    const reviewEvent = opEvents.find((e) => e.eventType === 'reasoning_review_completed');
    expect(reviewEvent).toBeDefined();
  });
});

describe('Decorrelation invariant', () => {
  it('throws when reviewer (provider, model) tuple equals primary', () => {
    expect(() => assertReviewerDecorrelated({
      primaryProvider: 'ollama',
      primaryModel: 'qwen2.5:9b',
      reviewerProvider: 'ollama',
      reviewerModel: 'qwen2.5:9b',
    })).toThrow(/decorrelation invariant violated/);
  });

  it('passes when reviewer model differs', () => {
    expect(() => assertReviewerDecorrelated({
      primaryProvider: 'ollama',
      primaryModel: 'qwen2.5:9b',
      reviewerProvider: 'ollama',
      reviewerModel: 'gemma2:e4b',
    })).not.toThrow();
  });

  it('passes when reviewer provider differs', () => {
    expect(() => assertReviewerDecorrelated({
      primaryProvider: 'ollama',
      primaryModel: 'qwen2.5:9b',
      reviewerProvider: 'anthropic',
      reviewerModel: 'qwen2.5:9b',
    })).not.toThrow();
  });

  it('is a no-op when reviewer is absent', () => {
    expect(() => assertReviewerDecorrelated({
      primaryProvider: 'ollama',
      primaryModel: 'qwen2.5:9b',
      reviewerProvider: undefined,
      reviewerModel: undefined,
    })).not.toThrow();
  });
});

describe('Release-gate integration with reasoning-review findings', () => {
  it('blocks external release when openHighSeverityFindings has unresolved entries', () => {
    const evaluator = new ReleaseGateEvaluator();
    const decision = evaluator.evaluate({
      artifactId: 'art1',
      artifactType: 'court_filing_draft',
      artifactVersionHash: 'h1',
      target: 'court',
      forumJurisdiction: 'MD',
      attorneyActions: [
        { action: 'signed_for_filing', attorneyId: 'a1', attorneyRole: 'signing_attorney', jurisdictionRequirementsMet: true, artifactVersionHash: 'h1' },
      ],
      conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'machine_assessed_support',
      sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true,
      lnfrGateStatus: 'pass',
      openHighSeverityFindings: ['f1', 'f2'],
    });
    expect(decision.status).toBe('external_release_blocked');
    expect(decision.basis).toMatch(/reasoning findings unresolved/);
  });

  it('unblocks external release when ALL findings acknowledged on the current artifact version', () => {
    const evaluator = new ReleaseGateEvaluator();
    const decision = evaluator.evaluate({
      artifactId: 'art1',
      artifactType: 'court_filing_draft',
      artifactVersionHash: 'h1',
      target: 'court',
      forumJurisdiction: 'MD',
      attorneyActions: [
        { action: 'signed_for_filing', attorneyId: 'a1', attorneyRole: 'signing_attorney', jurisdictionRequirementsMet: true, artifactVersionHash: 'h1' },
        { action: 'acknowledged_finding', attorneyId: 'a1', attorneyRole: 'signing_attorney', jurisdictionRequirementsMet: true, artifactVersionHash: 'h1', acknowledgedFindings: ['f1', 'f2'] },
      ],
      conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'machine_assessed_support',
      sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true,
      lnfrGateStatus: 'pass',
      openHighSeverityFindings: ['f1', 'f2'],
    });
    expect(decision.status).toBe('approved_for_filing');
  });

  it('does NOT honor acknowledgements made on a stale artifact version', () => {
    const evaluator = new ReleaseGateEvaluator();
    const decision = evaluator.evaluate({
      artifactId: 'art1',
      artifactType: 'court_filing_draft',
      artifactVersionHash: 'h2', // current version
      target: 'court',
      forumJurisdiction: 'MD',
      attorneyActions: [
        { action: 'signed_for_filing', attorneyId: 'a1', attorneyRole: 'signing_attorney', jurisdictionRequirementsMet: true, artifactVersionHash: 'h2' },
        // acknowledgement bound to OLD version h1 — does not count
        { action: 'acknowledged_finding', attorneyId: 'a1', attorneyRole: 'signing_attorney', jurisdictionRequirementsMet: true, artifactVersionHash: 'h1', acknowledgedFindings: ['f1'] },
      ],
      conflictHighestSeverity: 'none',
      authorityVerificationStatus: 'machine_assessed_support',
      sourceTraceComplete: true,
      privilegeFrameSnapshotPresent: true,
      lnfrGateStatus: 'pass',
      openHighSeverityFindings: ['f1'],
    });
    expect(decision.status).toBe('external_release_blocked');
  });
});

describe('AttorneyAction acknowledgement invariants', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let svc: AttorneyActionService;
  let frameRef: { snapshotHash: string; version: number };
  let store: MatterTrackStore;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-aa-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
    const firmDal = new FirmDal(db);
    const opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);
    firmDal.insertFirm(FIRM, 'X', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertUser({ firmId: FIRM, userId: 'a1', displayName: 'Att', role: 'attorney' });
    const admissions = new AttorneyAdmissionsDal(db);
    admissions.insert({ firmId: FIRM, attorneyId: 'a1', jurisdiction: 'MD', barNumber: '0001', admittedAt: '2010-01-01', status: 'active' });
    const keys = keySvc.provision(scope);
    const frame: PrivilegeFrame = { matterId: MATTER, attorneyClientPairs: [{ attorneyId: 'a1', clientId: CLIENT }] };
    frameRef = frameDal.saveSnapshot(scope, frame);
    store = new MatterTrackStore(matterTrackPath(dir, scope));
    const writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);
    svc = new AttorneyActionService(new AttorneyActionDal(db), admissions, writer);
  });

  afterEach(() => {
    store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects acknowledged_finding with empty acknowledgedFindings', () => {
    expect(() =>
      svc.record({
        scope, activeMatterContext: scope,
        artifactId: 'art1', artifactVersionHash: 'h1',
        attorneyId: 'a1', attorneyRole: 'reviewer',
        action: 'acknowledged_finding',
        privilegeFrameRef: frameRef,
      }),
    ).toThrow(/NO_FINDINGS_ACKNOWLEDGED|non-empty acknowledgedFindings/);
  });

  it('rejects override_finding without overrideRationale', () => {
    expect(() =>
      svc.record({
        scope, activeMatterContext: scope,
        artifactId: 'art1', artifactVersionHash: 'h1',
        attorneyId: 'a1', attorneyRole: 'reviewer',
        action: 'override_finding',
        acknowledgedFindings: ['f1'],
        privilegeFrameRef: frameRef,
      }),
    ).toThrow(/OVERRIDE_RATIONALE_REQUIRED|overrideRationale/);
  });

  it('records acknowledged_finding successfully and persists acknowledgedFindings', () => {
    const r = svc.record({
      scope, activeMatterContext: scope,
      artifactId: 'art1', artifactVersionHash: 'h1',
      attorneyId: 'a1', attorneyRole: 'reviewer',
      action: 'acknowledged_finding',
      acknowledgedFindings: ['f1', 'f2'],
      privilegeFrameRef: frameRef,
    });
    expect(r.acknowledgedFindings).toEqual(['f1', 'f2']);
  });
});
