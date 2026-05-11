/**
 * Wave 4 gate: LBH at handoff boundaries, missing-LBH fail-closed,
 * cross-lens CLV scope check.
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
  ManifestDal,
  ActivationDal,
} from '../lib/database/index.js';
import { loadCLVv1 } from '../lib/clv/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter } from '../lib/governedStream/matterTrackWriter.js';
import { MatterTrackReader } from '../lib/governedStream/matterTrackReader.js';
import { LbhService, LbhScopeError } from '../lib/lbh/service.js';
import { ContextEngineer, ContextAssemblyError } from '../lib/contextEngineer/assembler.js';
import { NarrativeCurator } from '../lib/agents/governance/narrativeCurator.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';
import type { LensPhaseManifest } from '../lib/orchestrator/types.js';

const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';
const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

describe('LBH service + cross-lens CLV scope', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let store: MatterTrackStore;
  let writer: MatterTrackWriter;
  let reader: MatterTrackReader;
  let lbh: LbhService;
  let frameRef: { snapshotHash: string; version: number };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-lbh-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
    const firmDal = new FirmDal(db);
    const opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);
    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    const keys = keySvc.provision(scope);
    const frame: PrivilegeFrame = { matterId: MATTER, attorneyClientPairs: [{ attorneyId: 'a1', clientId: CLIENT }] };
    frameRef = frameDal.saveSnapshot(scope, frame);
    store = new MatterTrackStore(matterTrackPath(dir, scope));
    writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);
    reader = new MatterTrackReader(store, keys.contentKey, keys.mentalKey);
    lbh = new LbhService(writer, reader);
  });

  afterEach(() => {
    store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function makeLbhArgs(overrides: Partial<Parameters<LbhService['produce']>[0]> = {}) {
    return {
      scope,
      activeMatterContext: scope,
      fromLensId: 'lensA',
      fromLensVersion: 'v1',
      toLensId: 'lensA',
      toLensVersion: 'v1',
      fromState: 'StateOne',
      toState: 'StateTwo',
      governingObjective: 'enforce existing custody order',
      retainedFacts: [],
      retainedIssues: [],
      prunedIssuesWithReasons: [],
      authorityStatus: { retrievedCount: 0, machineAssessedSupportCount: 0, attorneyConfirmedCount: 0, citatorStatusCount: 0 },
      openQuestions: [],
      assumptionsCarried: [],
      releaseFrame: { artifactReleaseStatuses: [] },
      clvContext: ['clv.core.matter.v1', 'clv.core.fact.v1'],
      curatorNotes: 'handoff',
      privilegeFrameRef: frameRef,
      ...overrides,
    };
  }

  it('produces and retrieves an LBH targeting a downstream state', () => {
    const ref = lbh.produce(makeLbhArgs());
    expect(ref.lbhId).toBeDefined();
    const retrieved = lbh.retrieveLatestForToState('StateTwo');
    expect(retrieved).toBeDefined();
    expect(retrieved!.toState).toBe('StateTwo');
    expect(retrieved!.governingObjective).toBe('enforce existing custody order');
    expect(retrieved!.clvContext).toEqual(['clv.core.matter.v1', 'clv.core.fact.v1']);
  });

  it('LBH is stored as work_product_mental in the matter track', () => {
    lbh.produce(makeLbhArgs());
    expect(store.countByClassification('work_product_mental')).toBe(1);
    expect(store.countByClassification('work_product_factual')).toBe(0);
  });

  it('consume() PASSES when the receiving manifest declares all CLV bindings', () => {
    lbh.produce(makeLbhArgs({ toLensId: 'lensB', toLensVersion: 'v1', clvContext: ['clv.core.matter.v1', 'clv.core.fact.v1'] }));
    const found = lbh.retrieveLatestForToState('StateTwo')!;
    const manifest: LensPhaseManifest = baseManifest('lensB', ['clv.core.matter.v1', 'clv.core.fact.v1']);
    expect(() => lbh.consume(found, manifest)).not.toThrow();
  });

  it('consume() BLOCKS when the receiving manifest is missing a CLV binding', () => {
    lbh.produce(makeLbhArgs({ toLensId: 'lensB', toLensVersion: 'v1', clvContext: ['clv.core.matter.v1', 'clv.core.authority.v1'] }));
    const found = lbh.retrieveLatestForToState('StateTwo')!;
    const manifest: LensPhaseManifest = baseManifest('lensB', ['clv.core.matter.v1']); // missing clv.core.authority.v1
    expect(() => lbh.consume(found, manifest)).toThrow(LbhScopeError);
  });

  it('consume() BLOCKS when the receiving manifest is the wrong lens', () => {
    lbh.produce(makeLbhArgs({ toLensId: 'lensB', toLensVersion: 'v1' }));
    const found = lbh.retrieveLatestForToState('StateTwo')!;
    const wrongLens = baseManifest('lensC', ['clv.core.matter.v1', 'clv.core.fact.v1']);
    expect(() => lbh.consume(found, wrongLens)).toThrow(/receiving manifest is/);
  });
});

describe('Context Engineer', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let store: MatterTrackStore;
  let lbhSvc: LbhService;
  let activationDal: ActivationDal;
  let manifestDal: ManifestDal;
  let frameRef: { snapshotHash: string; version: number };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-ctx-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
    const firmDal = new FirmDal(db);
    const opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);
    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    const keys = keySvc.provision(scope);
    const frame: PrivilegeFrame = { matterId: MATTER, attorneyClientPairs: [{ attorneyId: 'a1', clientId: CLIENT }] };
    frameRef = frameDal.saveSnapshot(scope, frame);
    store = new MatterTrackStore(matterTrackPath(dir, scope));
    const writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);
    const reader = new MatterTrackReader(store, keys.contentKey, keys.mentalKey);
    lbhSvc = new LbhService(writer, reader);
    activationDal = new ActivationDal(db);
    manifestDal = new ManifestDal(db);
  });

  afterEach(() => {
    store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('FAILS CLOSED when target state requires LBH at entry but none exists', () => {
    const ce = new ContextEngineer(activationDal, lbhSvc);
    const manifest: LensPhaseManifest = baseManifest('lensA', ['clv.core.matter.v1']);
    // mark StateTwo as requiresLbhAtEntry
    const m: LensPhaseManifest = {
      ...manifest,
      states: manifest.states.map((s) => (s.stateId === 'StateTwo' ? { ...s, requiresLbhAtEntry: true } : s)),
    };
    manifestDal.insert(m);
    activationDal.insertActivation({ scope, activationId: 'act1', lensId: 'lensA', lensVersion: 'v1', activatedBy: 'u' });
    expect(() => ce.assemble({ scope, activationId: 'act1', receivingManifest: m, targetStateId: 'StateTwo' })).toThrow(ContextAssemblyError);
  });

  it('PASSES when LBH at entry is present and receiving manifest covers CLV scope', () => {
    const ce = new ContextEngineer(activationDal, lbhSvc);
    const manifest: LensPhaseManifest = baseManifest('lensA', ['clv.core.matter.v1', 'clv.core.fact.v1']);
    const m: LensPhaseManifest = {
      ...manifest,
      states: manifest.states.map((s) => (s.stateId === 'StateTwo' ? { ...s, requiresLbhAtEntry: true } : s)),
    };
    manifestDal.insert(m);
    activationDal.insertActivation({ scope, activationId: 'act1', lensId: 'lensA', lensVersion: 'v1', activatedBy: 'u' });
    activationDal.insertStateOutput({ scope, activationId: 'act1', stateId: 'StateOne', outputJson: '{"foo":"bar"}', outputHash: 'h1' });

    lbhSvc.produce({
      scope, activeMatterContext: scope,
      fromLensId: 'lensA', fromLensVersion: 'v1', toLensId: 'lensA', toLensVersion: 'v1',
      fromState: 'StateOne', toState: 'StateTwo',
      governingObjective: 'enforce',
      retainedFacts: [], retainedIssues: [], prunedIssuesWithReasons: [],
      authorityStatus: { retrievedCount: 0, machineAssessedSupportCount: 0, attorneyConfirmedCount: 0, citatorStatusCount: 0 },
      openQuestions: [], assumptionsCarried: [], releaseFrame: { artifactReleaseStatuses: [] },
      clvContext: ['clv.core.matter.v1', 'clv.core.fact.v1'],
      curatorNotes: '', privilegeFrameRef: frameRef,
    });

    const ctx = ce.assemble({ scope, activationId: 'act1', receivingManifest: m, targetStateId: 'StateTwo' });
    expect(ctx.lbh).toBeDefined();
    expect(ctx.priorStateOutputs.StateOne).toEqual({ foo: 'bar' });
  });
});

describe('Narrative Curator', () => {
  it('produces a deterministic summary mentioning the from/to states + counts', () => {
    const c = new NarrativeCurator();
    const out = c.curate({
      scope,
      fromLensId: 'lensA', fromLensVersion: 'v1', toLensId: 'lensB', toLensVersion: 'v1',
      fromState: 'IssuePrune', toState: 'LegalResearchPlan',
      governingObjective: 'enforce custody order',
      retainedFacts: [{ factId: 'f1', summary: 'father has access', sourceRefs: ['custody_order'], confidence: 'document_supported' }],
      retainedIssues: [{ issueId: 'i1', issueDomain: 'enforcement', disposition: 'retained' }],
      prunedIssuesWithReasons: [{ issueId: 'i2', issueDomain: 'emergency_relief', decision: 'remove', reason: 'no safety concern reported' }],
      authorityStatus: { retrievedCount: 0, machineAssessedSupportCount: 0, attorneyConfirmedCount: 0, citatorStatusCount: 0 },
      openQuestions: ['support arrears confirmed?'],
      assumptionsCarried: [{ assumptionId: 'a1', text: 'no protective order in place', couldChangeIf: 'one is filed' }],
      releaseFrame: { artifactReleaseStatuses: [] },
      clvContext: ['clv.core.matter.v1'],
    });
    expect(out).toMatch(/Handoff lensA\/IssuePrune → lensB\/LegalResearchPlan/);
    expect(out).toMatch(/Retained: 1 fact/);
    expect(out).toMatch(/emergency_relief/);
    expect(out).toMatch(/no protective order/);
  });
});

function baseManifest(lensId: string, clvBindings: string[]): LensPhaseManifest {
  return {
    lensId,
    lensVersion: 'v1',
    practiceArea: 'family_law',
    applicableJurisdictions: ['MD'],
    states: [
      {
        stateId: 'StateOne',
        required: true,
        predecessors: [],
        permittedAgents: [],
        inputSchema: 'X',
        outputSchema: 'Y',
        validators: [],
        escalationConditions: [],
        clvScope: [],
        artifactsProduced: [],
      },
      {
        stateId: 'StateTwo',
        required: true,
        predecessors: ['StateOne'],
        permittedAgents: [],
        inputSchema: 'X',
        outputSchema: 'Y',
        validators: [],
        escalationConditions: [],
        clvScope: [],
        artifactsProduced: [],
      },
    ],
    requiredArtifacts: [],
    validators: [],
    escalationTriggers: [],
    releasePolicies: [],
    clvBindings,
    dependencies: [],
  };
}
