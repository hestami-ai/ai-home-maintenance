import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, FirmDal, OpStreamDal, PrivilegeFrameDal, MatterKeysDal } from '../lib/database/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter } from '../lib/governedStream/matterTrackWriter.js';
import { IssuePruneService, SilentPruningError } from '../lib/issuePrune/service.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';
import type { IssueCandidate } from '../lib/issueBloom/types.js';

const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';
const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

function cand(id: string, domain: string): IssueCandidate {
  return {
    issueId: id, issueDomain: domain, whyItMightMatter: 'test',
    requiredFacts: [], requiredSources: [], reviewRequirement: 'none',
    introducedAtPass: 1, lastModifiedAtPass: 1,
  };
}

describe('Issue Prune — no silent pruning', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let store: MatterTrackStore;
  let prune: IssuePruneService;
  let frameRef: { snapshotHash: string; version: number };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-prune-'));
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
    const frame: PrivilegeFrame = { matterId: MATTER, attorneyClientPairs: [{ attorneyId: 'a1', clientId: CLIENT }] };
    frameRef = frameDal.saveSnapshot(scope, frame);
    store = new MatterTrackStore(matterTrackPath(dir, scope));
    const writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);
    prune = new IssuePruneService(writer);
  });

  afterEach(() => {
    store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects a decision with empty reason', () => {
    const candidates = [cand('i1', 'enforcement')];
    expect(() =>
      prune.prune({
        scope, activeMatterContext: scope, candidates,
        decisions: [{ issueId: 'i1', issueDomain: 'enforcement', decision: 'remove', reason: '' }],
        privilegeFrameRef: frameRef,
      }),
    ).toThrow(SilentPruningError);
  });

  it('rejects when a candidate has no decision', () => {
    const candidates = [cand('i1', 'enforcement'), cand('i2', 'contempt')];
    expect(() =>
      prune.prune({
        scope, activeMatterContext: scope, candidates,
        decisions: [{ issueId: 'i1', issueDomain: 'enforcement', decision: 'retain', reason: 'matches client objective' }],
        privilegeFrameRef: frameRef,
      }),
    ).toThrow(/uncovered candidates/);
  });

  it('rejects duplicate decisions for the same issue', () => {
    const candidates = [cand('i1', 'enforcement')];
    expect(() =>
      prune.prune({
        scope, activeMatterContext: scope, candidates,
        decisions: [
          { issueId: 'i1', issueDomain: 'enforcement', decision: 'retain', reason: 'r1' },
          { issueId: 'i1', issueDomain: 'enforcement', decision: 'remove', reason: 'r2' },
        ],
        privilegeFrameRef: frameRef,
      }),
    ).toThrow(/duplicate/);
  });

  it('partitions retained / removed / deferred / escalated and writes mental events', () => {
    const candidates = [
      cand('i1', 'enforcement'),
      cand('i2', 'emergency_relief'),
      cand('i3', 'modification_of_custody'),
      cand('i4', 'best_interests'),
    ];
    const r = prune.prune({
      scope, activeMatterContext: scope, candidates,
      decisions: [
        { issueId: 'i1', issueDomain: 'enforcement', decision: 'retain', reason: 'matches client objective' },
        { issueId: 'i2', issueDomain: 'emergency_relief', decision: 'remove', reason: 'no safety concern reported' },
        { issueId: 'i3', issueDomain: 'modification_of_custody', decision: 'defer', reason: 'client asks enforcement; later if pattern continues' },
        { issueId: 'i4', issueDomain: 'best_interests', decision: 'escalate', reason: 'attorney must weigh child refusal' },
      ],
      privilegeFrameRef: frameRef,
    });
    expect(r.retained.map((c) => c.issueId)).toEqual(['i1']);
    expect(r.removed.map((d) => d.issueId)).toEqual(['i2']);
    expect(r.deferred.map((d) => d.issueId)).toEqual(['i3']);
    expect(r.escalated.map((d) => d.issueId)).toEqual(['i4']);
    expect(r.silentPruningCount).toBe(0);
    expect(r.pruneReasonCompleteness).toBe(1);

    // 4 pruning_decision_recorded events written as work_product_mental
    expect(store.countByClassification('work_product_mental')).toBe(4);
    expect(store.countByClassification('work_product_factual')).toBe(0);
  });
});
