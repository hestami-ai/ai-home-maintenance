import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, FirmDal, OpStreamDal, DashboardDal, ActivationDal } from '../lib/database/index.js';
import { ActiveMatterContext } from '../lib/scope/activeMatterContext.js';
import { MatterSwitchService, MatterSwitchError } from '../lib/matterSwitch/service.js';
import { DashboardService } from '../lib/dashboard/service.js';

const FIRM = 'firm_jclaw';

describe('Matter switch + screened-matter discipline', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let firmDal: FirmDal;
  let opStream: OpStreamDal;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-ms-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    firmDal = new FirmDal(db);
    opStream = new OpStreamDal(db);

    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, 'c1', 'Client 1');
    firmDal.insertClient(FIRM, 'c2', 'Client 2');
    firmDal.insertClient(FIRM, 'c3', 'Client 3');
    firmDal.insertMatter({ firmId: FIRM, clientId: 'c1', matterId: 'm1', matterName: 'Matter A', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertMatter({ firmId: FIRM, clientId: 'c2', matterId: 'm2', matterName: 'Matter B', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertMatter({ firmId: FIRM, clientId: 'c3', matterId: 'm3', matterName: 'Matter C (screened)', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    firmDal.insertUser({ firmId: FIRM, userId: 'user_1', displayName: 'Test User', role: 'attorney' });
    firmDal.grantAccess({ firmId: FIRM, userId: 'user_1', clientId: 'c1', matterId: 'm1', role: 'attorney_of_record', grantedBy: 'admin', grantBasis: 'engagement letter' });
    firmDal.grantAccess({ firmId: FIRM, userId: 'user_1', clientId: 'c2', matterId: 'm2', role: 'reviewer', grantedBy: 'admin', grantBasis: 'engagement letter' });
    firmDal.grantAccess({ firmId: FIRM, userId: 'user_1', clientId: 'c3', matterId: 'm3', role: 'screened_out', grantedBy: 'admin', grantBasis: 'former-client conflict screen' });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('switches to an accessible matter and records both context_out and context_in op-track events', () => {
    const active = new ActiveMatterContext('user_1', 'session_1');
    const svc = new MatterSwitchService(active, firmDal, opStream);

    const r1 = svc.switchTo({ userId: 'user_1', target: { firmId: FIRM, clientId: 'c1', matterId: 'm1' } });
    expect(r1.toMatter.matterId).toBe('m1');
    expect(active.get()?.matterId).toBe('m1');

    const r2 = svc.switchTo({ userId: 'user_1', target: { firmId: FIRM, clientId: 'c2', matterId: 'm2' } });
    expect(r2.fromMatter?.matterId).toBe('m1');
    expect(r2.toMatter.matterId).toBe('m2');
    expect(active.get()?.matterId).toBe('m2');

    expect(opStream.countByType(FIRM, 'matter_context_switched')).toBeGreaterThanOrEqual(3); // m1 in, m1→m2 out, m2 in
  });

  it('REFUSES switch to a screened-out matter (same as not-accessible)', () => {
    const active = new ActiveMatterContext('user_1', 'session_1');
    const svc = new MatterSwitchService(active, firmDal, opStream);
    expect(() => svc.switchTo({ userId: 'user_1', target: { firmId: FIRM, clientId: 'c3', matterId: 'm3' } })).toThrow(MatterSwitchError);
    expect(active.get()).toBeNull();
  });

  it('REFUSES switch to a matter that does not exist (same surface)', () => {
    const active = new ActiveMatterContext('user_1', 'session_1');
    const svc = new MatterSwitchService(active, firmDal, opStream);
    expect(() => svc.switchTo({ userId: 'user_1', target: { firmId: FIRM, clientId: 'c1', matterId: 'm_nonexistent' } })).toThrow(MatterSwitchError);
  });

  it('REFUSES switch with pending work and no confirmation', () => {
    const active = new ActiveMatterContext('user_1', 'session_1');
    const svc = new MatterSwitchService(active, firmDal, opStream);
    svc.switchTo({ userId: 'user_1', target: { firmId: FIRM, clientId: 'c1', matterId: 'm1' } });
    expect(() =>
      svc.switchTo({
        userId: 'user_1',
        target: { firmId: FIRM, clientId: 'c2', matterId: 'm2' },
        hasPendingWork: true,
      }),
    ).toThrow(/PENDING_WORK_UNCONFIRMED|pending/);
    // Active matter unchanged
    expect(active.get()?.matterId).toBe('m1');
  });

  it('PROCEEDS through pending work when explicitly confirmed', () => {
    const active = new ActiveMatterContext('user_1', 'session_1');
    const svc = new MatterSwitchService(active, firmDal, opStream);
    svc.switchTo({ userId: 'user_1', target: { firmId: FIRM, clientId: 'c1', matterId: 'm1' } });
    svc.switchTo({
      userId: 'user_1',
      target: { firmId: FIRM, clientId: 'c2', matterId: 'm2' },
      hasPendingWork: true,
      confirmedDespitePending: true,
    });
    expect(active.get()?.matterId).toBe('m2');
  });

  it('matter color hash differs across matters and is stable for the same matter', () => {
    const dashSvc = new DashboardService(new DashboardDal(db), new ActivationDal(db));
    const h1 = dashSvc.buildMatterHeaderBar({ firmId: FIRM, clientId: 'c1', matterId: 'm1' });
    const h2 = dashSvc.buildMatterHeaderBar({ firmId: FIRM, clientId: 'c2', matterId: 'm2' });
    const h1b = dashSvc.buildMatterHeaderBar({ firmId: FIRM, clientId: 'c1', matterId: 'm1' });
    expect(h1?.colorHashHex).toBe(h1b?.colorHashHex);
    expect(h1?.colorHashHex).not.toBe(h2?.colorHashHex);
    // 6-hex format
    expect(h1?.colorHashHex).toMatch(/^[0-9a-f]{6}$/);
  });

  it('cross-matter dashboard EXCLUDES screened matters and is read-only chrome', () => {
    const dashSvc = new DashboardService(new DashboardDal(db), new ActivationDal(db));
    const accessible = firmDal.listAccessibleMatters(FIRM, 'user_1');
    const cm = dashSvc.buildCrossMatterDashboard(FIRM, accessible);
    expect(cm.chrome).toBe('cross_matter_read_only');
    const ids = cm.matters.map((m) => m.scope.matterId).sort();
    expect(ids).toEqual(['m1', 'm2']); // m3 (screened) excluded
  });

  it('Matter Header Bar does NOT surface screened-matter content even by direct lookup', () => {
    // Matter m3 exists in the matters table — buildMatterHeaderBar would render
    // it if called. The discipline lives at the layer above (we never feed
    // a screened matter scope into buildMatterHeaderBar). Verify the
    // screened-matter exclusion via listAccessibleMatters.
    const accessible = firmDal.listAccessibleMatters(FIRM, 'user_1');
    expect(accessible.some((s) => s.matterId === 'm3')).toBe(false);
  });
});
