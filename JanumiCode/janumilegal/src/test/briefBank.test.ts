import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, FirmDal, OpStreamDal, BriefBankDal } from '../lib/database/index.js';
import { BriefBank, BriefBankPromotionError, scrubContent } from '../lib/briefBank/promotion.js';

describe('Brief bank promotion', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let bb: BriefBank;
  let dal: BriefBankDal;
  const FIRM = 'f1';
  const fromScope = { firmId: FIRM, clientId: 'c1', matterId: 'm1' };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-bb-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    const firmDal = new FirmDal(db);
    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, 'c1', 'Client One');
    firmDal.insertMatter({ firmId: FIRM, clientId: 'c1', matterId: 'm1', matterName: 'M1', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    dal = new BriefBankDal(db);
    bb = new BriefBank(dal, new OpStreamDal(db));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('scrubContent redacts case-insensitively', () => {
    const r = scrubContent('John Father met with John FATHER and Mr. Father', ['John Father', 'Mr. Father']);
    expect(r.scrubbed).not.toMatch(/John Father|Mr\. Father/i);
    expect(r.redacted).toBeGreaterThanOrEqual(2);
  });

  it('REJECTS promotion without an attorney action', () => {
    expect(() =>
      bb.promote({
        fromScope,
        fromArtifactId: 'art1',
        fromArtifactType: 'research_memo_draft',
        fromContent: 'A brief about John Father.',
        title: 'MD enforcement template',
        attorneyAction: { attorneyId: 'a1', attorneyActionId: 'act1', action: 'approved_for_filing' as never, artifactVersionHash: 'h' },
        clientIdentifyingTokens: ['John Father'],
      }),
    ).toThrow(BriefBankPromotionError);
  });

  it('REJECTS promotion without scrubbing tokens', () => {
    expect(() =>
      bb.promote({
        fromScope,
        fromArtifactId: 'art1',
        fromArtifactType: 'research_memo_draft',
        fromContent: 'A brief.',
        title: 'X',
        attorneyAction: { attorneyId: 'a1', attorneyActionId: 'act1', action: 'approved_for_firm_knowledge_promotion', artifactVersionHash: 'h' },
        clientIdentifyingTokens: [],
      }),
    ).toThrow(/tokens/i);
  });

  it('PROMOTES a scrubbed artifact and persists firm-knowledge row', () => {
    const r = bb.promote({
      fromScope,
      fromArtifactId: 'art1',
      fromArtifactType: 'research_memo_draft',
      fromContent: 'Re John Father custody enforcement: under MD § 9-105, John Father has rights.',
      title: 'MD enforcement memo template',
      attorneyAction: { attorneyId: 'a1', attorneyActionId: 'act1', action: 'approved_for_firm_knowledge_promotion', artifactVersionHash: 'h' },
      clientIdentifyingTokens: ['John Father'],
    });
    expect(r.contentScrubbed).not.toContain('John Father');
    expect(r.tokensRedactedCount).toBeGreaterThanOrEqual(2);
    expect(dal.countForFirm(FIRM)).toBe(1);

    const stored = dal.get(FIRM, r.knowledgeId);
    expect(stored).toBeDefined();
    expect(stored!.contentScrubbed).not.toContain('John Father');
    expect(stored!.contentScrubbed).toContain('§ 9-105'); // statutory ref preserved
    expect(stored!.promotedFrom.matterId).toBe('m1');
  });
});
