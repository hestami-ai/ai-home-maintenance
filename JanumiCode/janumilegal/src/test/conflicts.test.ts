import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, FirmDal, OpStreamDal, ConflictsDal } from '../lib/database/index.js';
import { ConflictsSurface, ConflictsSurfaceAccessError, type PartyRecord } from '../lib/conflicts/surface.js';
import { ConflictDetectionAgent } from '../lib/conflicts/agent.js';
import { isHardReleaseBlock } from '../lib/conflicts/types.js';

const FIRM = 'firm_jclaw';

describe('Conflicts surface + detection agent', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let surface: ConflictsSurface;
  let opStream: OpStreamDal;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-conf-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    const firmDal = new FirmDal(db);
    opStream = new OpStreamDal(db);
    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, 'c1', 'Client One');
    firmDal.insertClient(FIRM, 'c2', 'Client Two');
    firmDal.insertMatter({ firmId: FIRM, clientId: 'c1', matterId: 'm1', matterName: 'Custody A', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertMatter({ firmId: FIRM, clientId: 'c2', matterId: 'm2', matterName: 'Contract Dispute', practiceArea: 'business_civil', primaryJurisdiction: 'MD', matterType: 'contract' });
    surface = new ConflictsSurface(new ConflictsDal(db), opStream);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('REJECTS callers outside the conflicts allow-list', () => {
    expect(() => surface.partiesAcrossFirm({ firmId: FIRM, callerRole: 'random_user', auditPurpose: 'x' })).toThrow(ConflictsSurfaceAccessError);
    expect(() => surface.matterStatusAcrossFirm({ firmId: FIRM, callerRole: 'admin', auditPurpose: 'x' })).toThrow(ConflictsSurfaceAccessError);
  });

  it('returns matter status for authorized caller (metadata only)', () => {
    const r = surface.matterStatusAcrossFirm({ firmId: FIRM, callerRole: 'conflicts_officer', auditPurpose: 'audit' });
    expect(r).toHaveLength(2);
    const m1 = r.find((x) => x.matterId === 'm1');
    expect(m1?.status).toBe('open');
  });

  it('hard release block: NON-WAIVABLE when current client appears as opposing party', () => {
    // Acme Corp is a client in matter m2 AND opposing party in matter m1.
    surface.setPartiesForTesting([
      { firmId: FIRM, clientId: 'c2', matterId: 'm2', partyId: 'p_acme_client', displayName: 'Acme Corp', role: 'client' },
      { firmId: FIRM, clientId: 'c1', matterId: 'm1', partyId: 'p_acme_opposing', displayName: 'Acme Corp', role: 'opposing_party' },
    ]);

    const matterParties: PartyRecord[] = [
      { firmId: FIRM, clientId: 'c1', matterId: 'm1', partyId: 'p_acme_opposing', displayName: 'Acme Corp', role: 'opposing_party' },
      { firmId: FIRM, clientId: 'c1', matterId: 'm1', partyId: 'p_father', displayName: 'John Father', role: 'client' },
    ];

    const report = new ConflictDetectionAgent(surface).detect({
      trigger: 'matter_open',
      firmId: FIRM,
      matterId: 'm1',
      matterClientId: 'c1',
      matterParties,
      callerRole: 'conflicts_agent',
    });

    expect(report.findings.length).toBeGreaterThanOrEqual(1);
    expect(report.highestSeverity).toBe('non_waivable');
    expect(isHardReleaseBlock(report.highestSeverity)).toBe(true);
    expect(ConflictDetectionAgent.reportBlocksRelease(report)).toBe(true);
  });

  it('NO finding when no entity overlap', () => {
    surface.setPartiesForTesting([
      { firmId: FIRM, clientId: 'c2', matterId: 'm2', partyId: 'p_x', displayName: 'X Corp', role: 'client' },
    ]);
    const matterParties: PartyRecord[] = [
      { firmId: FIRM, clientId: 'c1', matterId: 'm1', partyId: 'p_y', displayName: 'Y Corp', role: 'opposing_party' },
      { firmId: FIRM, clientId: 'c1', matterId: 'm1', partyId: 'p_father', displayName: 'John Father', role: 'client' },
    ];
    const report = new ConflictDetectionAgent(surface).detect({
      trigger: 'matter_open',
      firmId: FIRM,
      matterId: 'm1',
      matterClientId: 'c1',
      matterParties,
      callerRole: 'conflicts_agent',
    });
    expect(report.findings).toHaveLength(0);
    expect(report.highestSeverity).toBe('none');
    expect(ConflictDetectionAgent.reportBlocksRelease(report)).toBe(false);
  });
});
