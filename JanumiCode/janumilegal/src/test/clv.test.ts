import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, ClvDal } from '../lib/database/index.js';
import { CLV_V1_ENTRIES, DbBackedCLV, lintEntries, loadCLVv1 } from '../lib/clv/index.js';

describe('CLV v1 entries', () => {
  it('lint: every authored entry passes', () => {
    const findings = lintEntries(CLV_V1_ENTRIES);
    if (findings.length > 0) {
      const msg = findings.map((f) => `[${f.rule}] ${f.termId}: ${f.message}`).join('\n');
      throw new Error(`CLV v1 lint findings:\n${msg}`);
    }
    expect(findings).toEqual([]);
  });

  it('contains the required core terms', () => {
    const ids = new Set(CLV_V1_ENTRIES.map((e) => e.termId));
    const required = [
      'clv.core.issue.v1',
      'clv.core.claim.v1',
      'clv.core.assertion.v1',
      'clv.core.fact.v1',
      'clv.core.authority.v1',
      'clv.core.matter.v1',
      'clv.core.screen.v1',
      'clv.core.active_matter_context.v1',
      'clv.core.machine_assessed_support.v1',
      'clv.core.citator_status.v1',
      'clv.core.privilege_work_product_mental.v1',
      'clv.core.release_status_external_release_blocked.v1',
    ];
    for (const r of required) {
      expect(ids.has(r), `missing required CLV term ${r}`).toBe(true);
    }
  });

  it('no duplicate termIds', () => {
    const seen = new Set<string>();
    for (const e of CLV_V1_ENTRIES) {
      expect(seen.has(e.termId), `duplicate ${e.termId}`).toBe(false);
      seen.add(e.termId);
    }
  });
});

describe('CLV loader', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let dal: ClvDal;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-clv-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    dal = new ClvDal(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loads all v1 entries on first run', () => {
    expect(dal.count()).toBe(0);
    const result = loadCLVv1(dal);
    expect(result.lintFindings).toEqual([]);
    expect(result.inserted).toBe(CLV_V1_ENTRIES.length);
    expect(result.skipped).toBe(0);
    expect(dal.count()).toBe(CLV_V1_ENTRIES.length);
  });

  it('is idempotent on second run', () => {
    loadCLVv1(dal);
    const second = loadCLVv1(dal);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(CLV_V1_ENTRIES.length);
  });

  it('round-trips entry shape (synonyms, jurisdiction variants)', () => {
    loadCLVv1(dal);
    const factor = dal.get('clv.core.factor.v1');
    expect(factor).toBeDefined();
    expect(factor!.canonicalName).toBe('factor');
    expect(factor!.prohibitedSynonyms).toContain('element');
    expect(factor!.jurisdictionVariants).toBeDefined();
    expect(factor!.jurisdictionVariants!.MD).toMatch(/Sanders/);
  });
});

describe('DbBackedCLV', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-clv-db-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    const dal = new ClvDal(db);
    loadCLVv1(dal);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('serves get/has/all/search', () => {
    const dal = new ClvDal(db);
    const clv = new DbBackedCLV(dal);
    expect(clv.has('clv.core.issue.v1')).toBe(true);
    expect(clv.get('clv.core.issue.v1')!.canonicalName).toBe('issue');
    expect(clv.all().length).toBeGreaterThan(40);
    expect(clv.search('factor').some((e) => e.termId === 'clv.core.factor.v1')).toBe(true);
  });
});
