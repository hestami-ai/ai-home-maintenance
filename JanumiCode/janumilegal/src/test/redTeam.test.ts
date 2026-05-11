/**
 * Wave 9 — red-team adversarial tests.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 9 §9.2:
 *   - Penetration test of matter-track encryption and key isolation.
 *   - Privilege-leakage red-team (export filters, classification bypass attempts,
 *     mental-impressions firewall).
 *   - Cross-matter leakage red-team specifically targeting: prompt cache,
 *     embedding stores, prompt assembler, UI side-channels (notifications,
 *     autocomplete, recently-viewed, telemetry), screened-matter enforcement.
 *
 * These tests deliberately try to break architectural controls. Every test
 * here is a "must fail" assertion: the platform must refuse the adversarial
 * action. If any of these tests passes (i.e., the platform allows the bad
 * thing), the build does not ship.
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
  AttorneyActionDal,
  AttorneyAdmissionsDal,
  ConflictsDal,
  ExportDal,
} from '../lib/database/index.js';
import { loadCLVv1, DbBackedCLV } from '../lib/clv/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter, MatterTrackWriteError } from '../lib/governedStream/matterTrackWriter.js';
import { MatterTrackReader } from '../lib/governedStream/matterTrackReader.js';
import { MatterExporter } from '../lib/export/exporter.js';
import { AttorneyActionService } from '../lib/attorneyAction/service.js';
import { ActiveMatterContext } from '../lib/scope/activeMatterContext.js';
import { MatterSwitchService, MatterSwitchError } from '../lib/matterSwitch/service.js';
import { ConflictsSurface, ConflictsSurfaceAccessError } from '../lib/conflicts/surface.js';
import { PromptAssembler, PromptAssemblyError } from '../lib/agents/promptAssembler.js';
import { AgentRegistry, validateRegistryEntry } from '../lib/registry/agentRegistry.js';
import { cacheKeyForScope } from '../lib/llm/provider.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';
import type { AgentInvocationScope } from '../lib/scope/agentInvocationScope.js';

const FIRM = 'firm_redteam';

describe('Red-team — privilege architecture', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let firmDal: FirmDal;
  let opStream: OpStreamDal;
  let frameDal: PrivilegeFrameDal;
  let firmKey: FirmKey;
  let keySvc: MatterKeyService;

  const scopeA = { firmId: FIRM, clientId: 'cA', matterId: 'mA' };
  const scopeB = { firmId: FIRM, clientId: 'cB', matterId: 'mB' };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-rt-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
    firmDal = new FirmDal(db);
    opStream = new OpStreamDal(db);
    frameDal = new PrivilegeFrameDal(db);
    firmKey = new FirmKey(generateKey());
    keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);
    firmDal.insertFirm(FIRM, 'X', 'MD');
    firmDal.insertClient(FIRM, 'cA', 'A');
    firmDal.insertClient(FIRM, 'cB', 'B');
    firmDal.insertMatter({ firmId: FIRM, clientId: 'cA', matterId: 'mA', matterName: 'A', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertMatter({ firmId: FIRM, clientId: 'cB', matterId: 'mB', matterName: 'B', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    keySvc.provision(scopeA);
    keySvc.provision(scopeB);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('RT-1 — matter-track read with WRONG matter\'s keys fails (key isolation)', () => {
    const keysA = keySvc.load(scopeA);
    const keysB = keySvc.load(scopeB);
    const frame: PrivilegeFrame = { matterId: 'mA', attorneyClientPairs: [] };
    const ref = frameDal.saveSnapshot(scopeA, frame);
    const storeA = new MatterTrackStore(matterTrackPath(dir, scopeA));
    const writer = new MatterTrackWriter(scopeA, storeA, keysA.contentKey, keysA.mentalKey, opStream);
    writer.write({
      scope: scopeA, activeMatterContext: scopeA,
      eventType: 'fact_extracted', payload: { secret: 'matter_A_only' }, clvScope: [],
      declaredClassification: 'work_product_factual', privilegeFrameRef: ref,
    });

    // Adversary: reader with matter B's keys against matter A's store.
    const adversaryReader = new MatterTrackReader(storeA, keysB.contentKey, keysB.mentalKey);
    const events = adversaryReader.read({ authorizedClassifications: ['work_product_factual'] });
    expect(events).toHaveLength(1);
    // GCM auth fails ⇒ event is redacted; payload is null.
    expect(events[0].redacted).toBe(true);
    expect(events[0].payload).toBeNull();
    storeA.close();
  });

  it('RT-2 — writer bound to matter A REFUSES write where activeMatterContext = matter B', () => {
    const keysA = keySvc.load(scopeA);
    const ref = frameDal.saveSnapshot(scopeA, { matterId: 'mA', attorneyClientPairs: [] });
    const storeA = new MatterTrackStore(matterTrackPath(dir, scopeA));
    const writer = new MatterTrackWriter(scopeA, storeA, keysA.contentKey, keysA.mentalKey, opStream);
    expect(() =>
      writer.write({
        scope: scopeA, activeMatterContext: scopeB, // mismatch — adversarial
        eventType: 'fact_extracted', payload: { x: 1 }, clvScope: [],
        declaredClassification: 'work_product_factual', privilegeFrameRef: ref,
      }),
    ).toThrow(MatterTrackWriteError);
    storeA.close();
  });

  it('RT-3 — discovery export filter cannot bypass classification by accident', () => {
    const keys = keySvc.load(scopeA);
    const ref = frameDal.saveSnapshot(scopeA, { matterId: 'mA', attorneyClientPairs: [] });
    const store = new MatterTrackStore(matterTrackPath(dir, scopeA));
    const writer = new MatterTrackWriter(scopeA, store, keys.contentKey, keys.mentalKey, opStream);
    writer.write({
      scope: scopeA, activeMatterContext: scopeA,
      eventType: 'pruning_decision_recorded', payload: { rationale: 'attorney mental impression A1' }, clvScope: [],
      declaredClassification: 'work_product_mental', privilegeFrameRef: ref,
    });
    writer.write({
      scope: scopeA, activeMatterContext: scopeA,
      eventType: 'client_message_received', payload: { msg: 'attorney_client_content' }, clvScope: [],
      declaredClassification: 'attorney_client', privilegeFrameRef: ref,
    });

    const exporter = new MatterExporter(new ExportDal(db), opStream, keys.contentKey, keys.mentalKey, store);
    const pkg = exporter.exportMatter({ scope: scopeA, purpose: 'discovery_production_party', requestedBy: 'attorney_of_record' });

    const allPayloadJson = JSON.stringify(pkg.events);
    expect(allPayloadJson).not.toContain('attorney mental impression');
    expect(allPayloadJson).not.toContain('attorney_client_content');
    expect(pkg.privilegeLog).toHaveLength(2);
    store.close();
  });

  it('RT-4 — classificationOverride without basis is REFUSED', () => {
    const keys = keySvc.load(scopeA);
    const store = new MatterTrackStore(matterTrackPath(dir, scopeA));
    const exporter = new MatterExporter(new ExportDal(db), opStream, keys.contentKey, keys.mentalKey, store);
    expect(() =>
      exporter.exportMatter({
        scope: scopeA, purpose: 'discovery_production_party', requestedBy: 'attorney_of_record',
        classificationOverride: ['work_product_factual', 'work_product_mental', 'attorney_client', 'client_confidential', 'public_record'],
      }),
    ).toThrow(/overrideBasis/);
    store.close();
  });

  it('RT-5 — switching to a screened matter is REFUSED with the same error as nonexistent (no leak)', () => {
    firmDal.insertClient(FIRM, 'cC', 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: 'cC', matterId: 'mC', matterName: 'C-screened', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertUser({ firmId: FIRM, userId: 'u1', displayName: 'U', role: 'attorney' });
    firmDal.grantAccess({ firmId: FIRM, userId: 'u1', clientId: 'cC', matterId: 'mC', role: 'screened_out', grantedBy: 'admin', grantBasis: 'screen' });
    const active = new ActiveMatterContext('u1', 's');
    const sw = new MatterSwitchService(active, firmDal, opStream);
    let screenedErr: Error | undefined;
    let nonexistentErr: Error | undefined;
    try { sw.switchTo({ userId: 'u1', target: { firmId: FIRM, clientId: 'cC', matterId: 'mC' } }); } catch (e) { screenedErr = e as Error; }
    try { sw.switchTo({ userId: 'u1', target: { firmId: FIRM, clientId: 'cZ', matterId: 'mZ' } }); } catch (e) { nonexistentErr = e as Error; }
    expect(screenedErr).toBeInstanceOf(MatterSwitchError);
    expect(nonexistentErr).toBeInstanceOf(MatterSwitchError);
    // Same error code — no leak about whether the matter exists.
    expect((screenedErr as MatterSwitchError).code).toBe((nonexistentErr as MatterSwitchError).code);
  });

  it('RT-6 — conflicts surface REFUSES random callers (no metadata leak)', () => {
    const surface = new ConflictsSurface(new ConflictsDal(db), opStream);
    expect(() => surface.partiesAcrossFirm({ firmId: FIRM, callerRole: 'random_user', auditPurpose: 'x' })).toThrow(ConflictsSurfaceAccessError);
    expect(() => surface.matterStatusAcrossFirm({ firmId: FIRM, callerRole: 'attorney', auditPurpose: 'x' })).toThrow(ConflictsSurfaceAccessError);
  });

  it('RT-7 — prompt assembler REFUSES references to unauthorized sources', () => {
    const clv = new DbBackedCLV(new ClvDal(db));
    const env: AgentInvocationScope = {
      firmId: FIRM, clientId: 'cA', matterId: 'mA', lensId: 'l1', lensVersion: 'v1', stateId: 'S',
      privilegeFrame: { snapshotHash: 'h', version: 1 },
      authorizedSources: [{ sourceId: 'src1', documentType: 'court_order', contentHash: 'h' }],
      authorizedPriorArtifacts: [], authorizedMMP: [], forbiddenScopes: [],
    };
    const a = new PromptAssembler({ clv });
    expect(() =>
      a.assemble(env, {
        templateBody: 'See {{source:other_matter_doc}}.', // not in envelope
      }),
    ).toThrow(PromptAssemblyError);
  });

  it('RT-8 — agent registration with mayApproveRelease=true is REFUSED', () => {
    const v = validateRegistryEntry({
      agentId: 'evil_agent.v1', displayName: 'Evil', tier: 'release_governance',
      permittedLenses: ['*'], permittedStates: ['*'], capabilityGroupC: 'gate',
      inputSchema: 'X.v1', outputSchema: 'X.v1',
      prohibitedActions: [], requiredValidators: [],
      confidencePolicy: { mayUseConfidenceLabels: false, mayBlockRelease: true, mayRequireAttorneyReview: true, mayApproveRelease: true },
      authorityPolicy: { mayRetrieveAuthority: false, mayAssessAuthoritySupport: false, mayMarkAttorneyConfirmed: false },
      privilegePolicy: { mayHandlePrivilegedMaterial: true, mayGenerateClientFacingText: false, mayExportExternalArtifact: false },
      version: 'v1',
    });
    expect(v.ok).toBe(false);
    expect(v.errors.join(';')).toMatch(/mayApproveRelease must be false/);
  });

  it('RT-9 — prompt cache namespace differs across matters and contains no client identity', () => {
    const nsA = cacheKeyForScope(scopeA);
    const nsB = cacheKeyForScope(scopeB);
    expect(nsA).not.toBe(nsB);
    // Namespace must NOT contain the literal client id or matter id (privilege design §5.4)
    expect(nsA).not.toContain('cA');
    expect(nsA).not.toContain('mA');
    expect(nsA).not.toContain(FIRM);
  });

  it('RT-10 — attorney filing without admission is REFUSED at the AttorneyAction layer', () => {
    firmDal.insertUser({ firmId: FIRM, userId: 'unadmitted', displayName: 'Unadmitted', role: 'attorney' });
    const admissions = new AttorneyAdmissionsDal(db);
    // No admission inserted for 'unadmitted' attorney.

    const keys = keySvc.load(scopeA);
    const ref = frameDal.saveSnapshot(scopeA, { matterId: 'mA', attorneyClientPairs: [] });
    const store = new MatterTrackStore(matterTrackPath(dir, scopeA));
    const writer = new MatterTrackWriter(scopeA, store, keys.contentKey, keys.mentalKey, opStream);
    const svc = new AttorneyActionService(new AttorneyActionDal(db), admissions, writer);

    expect(() =>
      svc.record({
        scope: scopeA, activeMatterContext: scopeA,
        artifactId: 'art1', artifactVersionHash: 'h',
        attorneyId: 'unadmitted', attorneyRole: 'signing_attorney', action: 'signed_for_filing',
        forumJurisdiction: 'MD', signatureMode: 'ecf_compatible',
        privilegeFrameRef: ref,
      }),
    ).toThrow(/not admitted in forum jurisdiction/);
    store.close();
  });
});
