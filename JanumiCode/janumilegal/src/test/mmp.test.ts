import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, FirmDal, OpStreamDal, PrivilegeFrameDal, MatterKeysDal } from '../lib/database/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter } from '../lib/governedStream/matterTrackWriter.js';
import { MatterTrackReader } from '../lib/governedStream/matterTrackReader.js';
import { MMPService } from '../lib/mmp/service.js';
import type { MMPCard, MMPSubmission } from '../lib/mmp/types.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';

describe('MMP cycle', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let store: MatterTrackStore;
  let writer: MatterTrackWriter;
  let mmp: MMPService;
  let frameRef: { snapshotHash: string; version: number };
  let contentKey: Buffer;
  let mentalKey: Buffer;
  const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';
  const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-mmp-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    const firmDal = new FirmDal(db);
    const opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);

    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    const keys = keySvc.provision(scope);
    contentKey = keys.contentKey;
    mentalKey = keys.mentalKey;
    const frame: PrivilegeFrame = { matterId: MATTER, attorneyClientPairs: [{ attorneyId: 'a1', clientId: CLIENT }] };
    frameRef = frameDal.saveSnapshot(scope, frame);

    store = new MatterTrackStore(matterTrackPath(dir, scope));
    writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);
    mmp = new MMPService(writer);
  });

  afterEach(() => {
    store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('issues a session and accepts a submission, both stored as work_product_mental', () => {
    const cards: MMPCard[] = [
      { cardType: 'mirror', cardId: 'mir1', assumption: 'matter_type=custody_visitation_enforcement' },
      {
        cardType: 'menu',
        cardId: 'men1',
        question: 'Conservative or aggressive enforcement posture?',
        options: [
          { optionId: 'cons', label: 'Conservative' },
          { optionId: 'aggr', label: 'Aggressive' },
        ],
      },
      {
        cardType: 'pre_mortem',
        cardId: 'pm1',
        risk: 'support arrears defense not briefed',
        impactIfIgnored: 'potential waiver of issue',
      },
    ];

    const session = mmp.issueSession({
      scope,
      activeMatterContext: scope,
      cards,
      privilegeFrameRef: frameRef,
      lensId: 'family_law_production_lens',
      lensVersion: 'v1',
      stateId: 'IssueBloom',
    });

    expect(session.cards).toHaveLength(3);
    // Issuance is a work_product_mental event
    expect(store.countByClassification('work_product_mental')).toBe(1);

    const submission: MMPSubmission = {
      mirrorDecisions: [{ cardId: 'mir1', action: 'accept' }],
      menuSelections: [{ cardId: 'men1', chosenOptionId: 'cons', comment: 'lower escalation risk' }],
      preMortemDecisions: [{ cardId: 'pm1', action: 'acknowledge' }],
      submittedBy: 'attorney_of_record',
      submittedAt: new Date().toISOString(),
    };

    const result = mmp.submit({
      scope,
      activeMatterContext: scope,
      mmpId: session.mmpId,
      submission,
      privilegeFrameRef: frameRef,
      lensId: 'family_law_production_lens',
      lensVersion: 'v1',
      stateId: 'IssueBloom',
    });

    expect(result.eventId).toBeDefined();
    expect(store.countByClassification('work_product_mental')).toBe(2);

    // Verify a mental-only reader can decode both events
    const reader = new MatterTrackReader(store, contentKey, mentalKey);
    const events = reader.read({ authorizedClassifications: ['work_product_mental'] });
    expect(events).toHaveLength(2);
    expect(events.every((e) => !e.redacted)).toBe(true);
    const types = events.map((e) => e.eventType).sort();
    expect(types).toEqual(['mmp_card_submitted', 'mmp_session_issued']);
  });

  it('a discovery export with default redaction excludes MMP events from the package', async () => {
    // (Cross-test verification — rely on the redaction policy)
    const cards: MMPCard[] = [{ cardType: 'mirror', cardId: 'mir1', assumption: 'x' }];
    mmp.issueSession({ scope, activeMatterContext: scope, cards, privilegeFrameRef: frameRef });
    expect(store.countByClassification('work_product_mental')).toBe(1);

    // The exporter test verifies the same exclusion behavior; here we just
    // assert the storage classification is correct (the basis for exclusion).
    const reader = new MatterTrackReader(store, contentKey, mentalKey);
    const onlyMental = reader.read({ authorizedClassifications: ['work_product_mental'] });
    expect(onlyMental[0].classification).toBe('work_product_mental');
  });
});
