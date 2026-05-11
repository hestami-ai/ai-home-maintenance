import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, FirmDal, TraceDal } from '../lib/database/index.js';
import { SourceToClaimTraceValidator } from '../lib/sourceToClaimTrace/validator.js';
import type { SourceToClaimTrace } from '../lib/sourceToClaimTrace/types.js';

const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';
const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

describe('Source-to-claim trace', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let dal: TraceDal;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-trace-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    const firmDal = new FirmDal(db);
    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    dal = new TraceDal(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('persists and retrieves a trace', () => {
    const t: SourceToClaimTrace = {
      traceId: 'trace1',
      artifactId: 'art1',
      assertionText: 'Father has access every other weekend.',
      assertionKind: 'fact',
      sourceId: 'custody_order.pdf',
      supportingSpan: 'every other weekend from Friday at 6:00 p.m.',
      stateId: 'FactExtraction',
      verificationLabel: 'quote_matched',
    };
    dal.insert(scope, t);
    expect(dal.countForMatter(scope)).toBe(1);
    const got = dal.listForArtifact(scope, 'art1');
    expect(got).toHaveLength(1);
    expect(got[0].verificationLabel).toBe('quote_matched');
  });
});

describe('SourceToClaimTraceValidator', () => {
  const v = new SourceToClaimTraceValidator();

  it('FLAGS untraced assertions', () => {
    const r = v.validate({
      artifactId: 'art1',
      assertionsRequiringTrace: [{ assertionText: 'X' }, { assertionText: 'Y' }],
      traces: [{
        traceId: 't1', artifactId: 'art1', assertionText: 'X', assertionKind: 'fact',
        sourceId: 'src1', verificationLabel: 'source_located',
      }],
      authorizedSourceIds: ['src1'],
    });
    expect(r.findings.some((f) => f.category === 'untraced_assertion')).toBe(true);
  });

  it('FLAGS traces referencing unauthorized sources', () => {
    const r = v.validate({
      artifactId: 'art1',
      assertionsRequiringTrace: [{ assertionText: 'X' }],
      traces: [{ traceId: 't1', artifactId: 'art1', assertionText: 'X', assertionKind: 'fact', sourceId: 'other_matter_src', verificationLabel: 'source_located' }],
      authorizedSourceIds: ['src1'],
    });
    expect(r.findings.some((f) => f.category === 'unauthorized_source')).toBe(true);
  });

  it('FLAGS attorney_confirmed without action id', () => {
    const r = v.validate({
      artifactId: 'art1',
      assertionsRequiringTrace: [{ assertionText: 'X' }],
      traces: [{ traceId: 't1', artifactId: 'art1', assertionText: 'X', assertionKind: 'fact', sourceId: 'src1', verificationLabel: 'attorney_confirmed' }],
      authorizedSourceIds: ['src1'],
    });
    expect(r.findings.some((f) => f.category === 'attorney_confirmed_without_action')).toBe(true);
  });

  it('clean trace passes', () => {
    const r = v.validate({
      artifactId: 'art1',
      assertionsRequiringTrace: [{ assertionText: 'X' }],
      traces: [{ traceId: 't1', artifactId: 'art1', assertionText: 'X', assertionKind: 'fact', sourceId: 'src1', verificationLabel: 'quote_matched' }],
      authorizedSourceIds: ['src1'],
    });
    expect(r.findings).toHaveLength(0);
  });
});
