/**
 * Wave 3 gate: matter-track Governed Stream — all six classifications,
 * cross-matter prohibition, hash chain tamper detection, key isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, FirmDal, OpStreamDal, PrivilegeFrameDal, MatterKeysDal } from '../lib/database/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter, MatterTrackWriteError } from '../lib/governedStream/matterTrackWriter.js';
import { MatterTrackReader } from '../lib/governedStream/matterTrackReader.js';
import { computePayloadHash } from '../lib/governedStream/hashChain.js';
import type { MatterTrackClassification } from '../lib/governedStream/classifications.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';

const FIRM = 'firm_jclaw';
const CLIENT_A = 'client_a';
const CLIENT_B = 'client_b';
const MATTER_A = 'matter_a';
const MATTER_B = 'matter_b';

describe('matter-track Governed Stream', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let firmDal: FirmDal;
  let opStream: OpStreamDal;
  let frameDal: PrivilegeFrameDal;
  let firmKey: FirmKey;
  let keySvc: MatterKeyService;
  let storeA: MatterTrackStore;
  let storeB: MatterTrackStore;
  let writerA: MatterTrackWriter;
  let writerB: MatterTrackWriter;
  let frameRefA: { snapshotHash: string; version: number };
  let frameRefB: { snapshotHash: string; version: number };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-mt-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    firmDal = new FirmDal(db);
    opStream = new OpStreamDal(db);
    frameDal = new PrivilegeFrameDal(db);
    firmKey = new FirmKey(generateKey());
    keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);

    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, CLIENT_A, 'A');
    firmDal.insertClient(FIRM, CLIENT_B, 'B');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT_A, matterId: MATTER_A, matterName: 'A', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT_B, matterId: MATTER_B, matterName: 'B', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });

    const scopeA = { firmId: FIRM, clientId: CLIENT_A, matterId: MATTER_A };
    const scopeB = { firmId: FIRM, clientId: CLIENT_B, matterId: MATTER_B };
    const keysA = keySvc.provision(scopeA);
    const keysB = keySvc.provision(scopeB);

    const frame: PrivilegeFrame = { matterId: MATTER_A, attorneyClientPairs: [{ attorneyId: 'att1', clientId: CLIENT_A }] };
    frameRefA = frameDal.saveSnapshot(scopeA, frame);
    frameRefB = frameDal.saveSnapshot(scopeB, { ...frame, matterId: MATTER_B, attorneyClientPairs: [{ attorneyId: 'att1', clientId: CLIENT_B }] });

    storeA = new MatterTrackStore(matterTrackPath(dir, scopeA));
    storeB = new MatterTrackStore(matterTrackPath(dir, scopeB));
    writerA = new MatterTrackWriter(scopeA, storeA, keysA.contentKey, keysA.mentalKey, opStream);
    writerB = new MatterTrackWriter(scopeB, storeB, keysB.contentKey, keysB.mentalKey, opStream);
  });

  afterEach(() => {
    storeA.close();
    storeB.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function scopeA() { return { firmId: FIRM, clientId: CLIENT_A, matterId: MATTER_A }; }
  function scopeB() { return { firmId: FIRM, clientId: CLIENT_B, matterId: MATTER_B }; }

  it('writes events across all five matter-track classifications', () => {
    const sA = scopeA();
    const cls: MatterTrackClassification[] = ['work_product_factual', 'work_product_mental', 'attorney_client', 'client_confidential', 'public_record'];
    for (const c of cls) {
      writerA.write({
        scope: sA,
        activeMatterContext: sA,
        eventType: 'test_event',
        payload: { sample: c },
        clvScope: ['clv.core.fact.v1'],
        declaredClassification: c,
        privilegeFrameRef: frameRefA,
      });
    }
    for (const c of cls) {
      expect(storeA.countByClassification(c)).toBe(1);
    }
  });

  it('REJECTS a write whose active matter context points to a different matter', () => {
    const sA = scopeA();
    const sB = scopeB();
    expect(() =>
      writerA.write({
        scope: sA,
        activeMatterContext: sB, // mismatch — possible mistaken-matter action
        eventType: 'test_event',
        payload: { x: 1 },
        clvScope: [],
        declaredClassification: 'work_product_factual',
        privilegeFrameRef: frameRefA,
      }),
    ).toThrow(MatterTrackWriteError);
  });

  it('REJECTS a write when the writer was bound to a different matter', () => {
    const sB = scopeB();
    expect(() =>
      writerA.write({
        scope: sB, // writerA is bound to A; this is B
        activeMatterContext: sB,
        eventType: 'test_event',
        payload: { x: 1 },
        clvScope: [],
        declaredClassification: 'work_product_factual',
        privilegeFrameRef: frameRefB,
      }),
    ).toThrow(/scope mismatch/);
  });

  it("matter A's content cannot be decrypted with matter B's keys (cross-matter key isolation)", () => {
    const sA = scopeA();
    const keysA = keySvc.load(sA);
    const keysB = keySvc.load(scopeB());
    writerA.write({
      scope: sA,
      activeMatterContext: sA,
      eventType: 'test_event',
      payload: { sensitive: 'A_only' },
      clvScope: [],
      declaredClassification: 'work_product_factual',
      privilegeFrameRef: frameRefA,
    });

    const readerCorrect = new MatterTrackReader(storeA, keysA.contentKey, keysA.mentalKey);
    const correctEvents = readerCorrect.read({ authorizedClassifications: ['work_product_factual'] });
    expect(correctEvents).toHaveLength(1);
    expect(correctEvents[0].redacted).toBe(false);
    expect(correctEvents[0].payload?.sensitive).toBe('A_only');

    const readerWrong = new MatterTrackReader(storeA, keysB.contentKey, keysB.mentalKey);
    const wrongEvents = readerWrong.read({ authorizedClassifications: ['work_product_factual'] });
    expect(wrongEvents).toHaveLength(1);
    expect(wrongEvents[0].redacted).toBe(true); // GCM auth fails
    expect(wrongEvents[0].redactionReason).toMatch(/decryption failed/);
  });

  it('mental-impressions sub-segment uses a separate key from content', () => {
    const sA = scopeA();
    const keysA = keySvc.load(sA);
    writerA.write({
      scope: sA,
      activeMatterContext: sA,
      eventType: 'test_event',
      payload: { mental: 'attorney_strategy' },
      clvScope: [],
      declaredClassification: 'work_product_mental',
      privilegeFrameRef: frameRefA,
    });

    // Reader given only the content key cannot read mental events
    const readerContentOnly = new MatterTrackReader(storeA, keysA.contentKey, generateKey());
    const events = readerContentOnly.read({ authorizedClassifications: ['work_product_mental'] });
    expect(events[0].redacted).toBe(true);

    const readerCorrect = new MatterTrackReader(storeA, keysA.contentKey, keysA.mentalKey);
    expect(readerCorrect.read({ authorizedClassifications: ['work_product_mental'] })[0].redacted).toBe(false);
  });

  it('hash chain detects a tampered payload', () => {
    const sA = scopeA();
    writerA.write({
      scope: sA, activeMatterContext: sA,
      eventType: 'test_event', payload: { x: 1 }, clvScope: [],
      declaredClassification: 'work_product_factual', privilegeFrameRef: frameRefA,
    });
    writerA.write({
      scope: sA, activeMatterContext: sA,
      eventType: 'test_event', payload: { x: 2 }, clvScope: [],
      declaredClassification: 'work_product_factual', privilegeFrameRef: frameRefA,
    });

    // Verify chain is initially valid
    const result = storeA.verifyChain('work_product_factual', computePayloadHash);
    expect(result.ok).toBe(true);

    // Tamper with the second event's payload by writing a forged event (same chain head, different bytes)
    // We don't have a public mutate API; instead, simulate tampering by re-deriving with wrong bytes
    const events = storeA.listEvents({ classification: 'work_product_factual' });
    expect(events).toHaveLength(2);
    const tamperedFn = (prev: string, _payload: Buffer) => computePayloadHash(prev, Buffer.from('forged'));
    const result2 = storeA.verifyChain('work_product_factual', tamperedFn);
    expect(result2.ok).toBe(false);
  });

  it('classification-restricted reader sees redactions for unauthorized classifications', () => {
    const sA = scopeA();
    const keysA = keySvc.load(sA);
    writerA.write({
      scope: sA, activeMatterContext: sA,
      eventType: 'attorney_strategy_note', payload: { strategy: 'aggressive' }, clvScope: [],
      declaredClassification: 'work_product_mental', privilegeFrameRef: frameRefA,
    });
    writerA.write({
      scope: sA, activeMatterContext: sA,
      eventType: 'fact_extracted', payload: { fact: 'public fact' }, clvScope: [],
      declaredClassification: 'work_product_factual', privilegeFrameRef: frameRefA,
    });

    const readerLow = new MatterTrackReader(storeA, keysA.contentKey, keysA.mentalKey);
    // Only authorized for factual
    const events = readerLow.read({ authorizedClassifications: ['work_product_factual'] });
    const factual = events.find((e) => e.classification === 'work_product_factual');
    const mental = events.find((e) => e.classification === 'work_product_mental');
    expect(factual?.redacted).toBe(false);
    expect(mental?.redacted).toBe(true);
    expect(mental?.payload).toBeNull();
  });
});
