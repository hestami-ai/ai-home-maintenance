import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  openDirect,
  FirmDal,
  OpStreamDal,
  PrivilegeFrameDal,
  MatterKeysDal,
  AttorneyActionDal,
  AttorneyAdmissionsDal,
} from '../lib/database/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter } from '../lib/governedStream/matterTrackWriter.js';
import { AttorneyActionService, AttorneyActionError } from '../lib/attorneyAction/service.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';

const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';
const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

describe('AttorneyAction service', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let actionService: AttorneyActionService;
  let admissionsDal: AttorneyAdmissionsDal;
  let actionDal: AttorneyActionDal;
  let store: MatterTrackStore;
  let frameRef: { snapshotHash: string; version: number };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-aa-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    const firmDal = new FirmDal(db);
    const opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);
    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertUser({ firmId: FIRM, userId: 'att_md', displayName: 'Alex MD', role: 'attorney' });
    firmDal.insertUser({ firmId: FIRM, userId: 'att_va', displayName: 'Bree VA', role: 'attorney' });

    const keys = keySvc.provision(scope);
    const frame: PrivilegeFrame = { matterId: MATTER, attorneyClientPairs: [{ attorneyId: 'att_md', clientId: CLIENT }] };
    frameRef = frameDal.saveSnapshot(scope, frame);
    store = new MatterTrackStore(matterTrackPath(dir, scope));
    const writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);

    admissionsDal = new AttorneyAdmissionsDal(db);
    actionDal = new AttorneyActionDal(db);
    admissionsDal.insert({ firmId: FIRM, attorneyId: 'att_md', jurisdiction: 'MD', barNumber: 'MD-1001', admittedAt: '2010-01-01', status: 'active' });
    admissionsDal.insert({ firmId: FIRM, attorneyId: 'att_va', jurisdiction: 'VA', barNumber: 'VA-2002', admittedAt: '2012-01-01', status: 'active' });

    actionService = new AttorneyActionService(actionDal, admissionsDal, writer);
  });

  afterEach(() => {
    store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('records a reviewed action with bar-numbers snapshot', () => {
    const a = actionService.record({
      scope, activeMatterContext: scope,
      artifactId: 'art1', artifactVersionHash: 'hash1',
      attorneyId: 'att_md', attorneyRole: 'reviewer', action: 'reviewed',
      privilegeFrameRef: frameRef,
    });
    expect(a.actionId).toBeDefined();
    expect(a.barNumbersAtAction.some((b) => b.jurisdiction === 'MD')).toBe(true);
    expect(actionDal.listForArtifact(scope, 'art1')).toHaveLength(1);
  });

  it('REFUSES signed_for_filing when attorney is not admitted in the forum', () => {
    expect(() =>
      actionService.record({
        scope, activeMatterContext: scope,
        artifactId: 'art1', artifactVersionHash: 'hash1',
        attorneyId: 'att_va', attorneyRole: 'signing_attorney', action: 'signed_for_filing',
        forumJurisdiction: 'MD',
        signatureMode: 'ecf_compatible',
        privilegeFrameRef: frameRef,
      }),
    ).toThrow(AttorneyActionError);
  });

  it('ACCEPTS signed_for_filing when attorney IS admitted in the forum', () => {
    const a = actionService.record({
      scope, activeMatterContext: scope,
      artifactId: 'art1', artifactVersionHash: 'hash1',
      attorneyId: 'att_md', attorneyRole: 'signing_attorney', action: 'signed_for_filing',
      forumJurisdiction: 'MD',
      signatureMode: 'ecf_compatible',
      privilegeFrameRef: frameRef,
    });
    expect(a.jurisdictionRequirementsMet).toBe(true);
  });

  it('REFUSES signed_for_filing when role is wrong', () => {
    expect(() =>
      actionService.record({
        scope, activeMatterContext: scope,
        artifactId: 'art1', artifactVersionHash: 'hash1',
        attorneyId: 'att_md', attorneyRole: 'reviewer', action: 'signed_for_filing',
        forumJurisdiction: 'MD',
        privilegeFrameRef: frameRef,
      }),
    ).toThrow(/signing_attorney/);
  });

  it('action is recorded as work_product_mental in matter track', () => {
    actionService.record({
      scope, activeMatterContext: scope,
      artifactId: 'art1', artifactVersionHash: 'hash1',
      attorneyId: 'att_md', attorneyRole: 'reviewer', action: 'reviewed',
      privilegeFrameRef: frameRef,
    });
    expect(store.countByClassification('work_product_mental')).toBe(1);
    expect(store.countByClassification('work_product_factual')).toBe(0);
  });
});
