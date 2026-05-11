import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, validateSchema, SCOPED_DOMAIN_TABLES, FirmDal } from '../lib/database/index.js';

describe('SCHEMA_V1', () => {
  let dir: string;
  let dbPath: string;
  let db: ReturnType<typeof openDirect>;
  let firmDal: FirmDal;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-schema-'));
    dbPath = path.join(dir, 'platform.sqlite');
    db = openDirect(dbPath);
    firmDal = new FirmDal(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('opens, runs migrations, validates schema', () => {
    const v = validateSchema(db);
    expect(v.ok, v.errors.join('; ')).toBe(true);
  });

  it('every scoped domain table carries firm_id, client_id, matter_id', () => {
    for (const table of SCOPED_DOMAIN_TABLES) {
      const names = new Set(firmDal.tableColumns(table));
      expect(names.has('firm_id'), `${table} missing firm_id`).toBe(true);
      expect(names.has('client_id'), `${table} missing client_id`).toBe(true);
      expect(names.has('matter_id'), `${table} missing matter_id`).toBe(true);
    }
  });

  it('schema_version records the applied migration', () => {
    // schema_version is a registry-tier bookkeeping table; check via direct DAL surface
    const cols = firmDal.tableColumns('schema_version');
    expect(cols).toContain('version');
    expect(cols).toContain('applied_at');
  });
});
