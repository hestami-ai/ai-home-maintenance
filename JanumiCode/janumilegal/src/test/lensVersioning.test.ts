import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  openDirect,
  FirmDal,
  ActivationDal,
  ManifestDal,
  OpStreamDal,
  LensMigrationsDal,
} from '../lib/database/index.js';
import { MigrationService, MigrationError } from '../lib/lensVersioning/service.js';
import { familyLawProductionManifest } from '../layer2_lens_packs/familyLawProduction/manifest.js';

const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';
const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

describe('Lens versioning + migration', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let migrationsDal: LensMigrationsDal;
  let activationDal: ActivationDal;
  let opStream: OpStreamDal;
  let svc: MigrationService;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-mig-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    const firmDal = new FirmDal(db);
    firmDal.insertFirm(FIRM, 'Test Firm', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });

    const manifestDal = new ManifestDal(db);
    manifestDal.insert(familyLawProductionManifest);
    activationDal = new ActivationDal(db);
    activationDal.insertActivation({ scope, activationId: 'a1', lensId: familyLawProductionManifest.lensId, lensVersion: 'v1', activatedBy: 'attorney_1' });

    opStream = new OpStreamDal(db);
    migrationsDal = new LensMigrationsDal(db);
    svc = new MigrationService(migrationsDal, activationDal, opStream);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('SAFE migration auto-advances; no states marked stale', () => {
    migrationsDal.declare({ lensId: familyLawProductionManifest.lensId, fromVersion: 'v1', toVersion: 'v1.1', kind: 'SAFE' });
    const r = svc.migrate({ scope, activationId: 'a1', toVersion: 'v1.1', authorizedBy: 'attorney_1' });
    expect(r.status).toBe('advanced');
    expect(r.staleStates).toHaveLength(0);
  });

  it('PARTIAL migration marks listed states stale', () => {
    migrationsDal.declare({
      lensId: familyLawProductionManifest.lensId,
      fromVersion: 'v1',
      toVersion: 'v2',
      kind: 'PARTIAL',
      staleStates: ['IssueBloom', 'IssuePrune'],
    });
    const r = svc.migrate({ scope, activationId: 'a1', toVersion: 'v2', authorizedBy: 'attorney_1' });
    expect(r.status).toBe('stale_marked');
    expect(r.staleStates).toEqual(['IssueBloom', 'IssuePrune']);
  });

  it('INCOMPATIBLE migration REFUSES without force', () => {
    migrationsDal.declare({
      lensId: familyLawProductionManifest.lensId,
      fromVersion: 'v1',
      toVersion: 'v3',
      kind: 'INCOMPATIBLE',
      incompatibilityReason: 'state machine restructured; outputs not transferrable',
    });
    const r = svc.migrate({ scope, activationId: 'a1', toVersion: 'v3', authorizedBy: 'attorney_1' });
    expect(r.status).toBe('refused');
    expect(r.notes.some((n) => /incompatible/i.test(n))).toBe(true);
  });

  it('INCOMPATIBLE migration ALLOWS with force + documented basis', () => {
    migrationsDal.declare({
      lensId: familyLawProductionManifest.lensId,
      fromVersion: 'v1',
      toVersion: 'v3',
      kind: 'INCOMPATIBLE',
      staleStates: ['IssueBloom', 'IssuePrune', 'AuthorityVerification'],
      incompatibilityReason: 'state machine restructured',
    });
    const r = svc.migrate({
      scope, activationId: 'a1', toVersion: 'v3',
      authorizedBy: 'attorney_1',
      force: true,
      forceBasis: 'attorney accepted re-run; documented memo Wave-8-test',
    });
    expect(r.status).toBe('force_migrated');
    expect(r.staleStates).toHaveLength(3);
  });

  it('INCOMPATIBLE force without basis ⇒ error', () => {
    migrationsDal.declare({
      lensId: familyLawProductionManifest.lensId,
      fromVersion: 'v1',
      toVersion: 'v3',
      kind: 'INCOMPATIBLE',
      incompatibilityReason: 'x',
    });
    expect(() => svc.migrate({ scope, activationId: 'a1', toVersion: 'v3', authorizedBy: 'a', force: true })).toThrow(MigrationError);
  });

  it('REFUSES migration when no transition is declared', () => {
    expect(() => svc.migrate({ scope, activationId: 'a1', toVersion: 'v9', authorizedBy: 'a' })).toThrow(/UNDECLARED_TRANSITION|no declared/);
  });
});
