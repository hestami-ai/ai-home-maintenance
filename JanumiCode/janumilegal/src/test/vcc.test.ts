/**
 * Wave 1 gate: VCC seeded collisions.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 1 gate:
 *   "VCC catches a deliberate seeded collision in test (synthetic Layer 2
 *    redefining a Layer 1 term ⇒ BLOCK)."
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CanonicalVocabularyEntry } from '../lib/clv/types.js';
import { CLV_V1_ENTRIES } from '../lib/clv/entries/index.js';
import { runVCC } from '../lib/vcc/engine.js';
import { openDirect, VccDal } from '../lib/database/index.js';

describe('VCC engine', () => {
  it('allows a clean candidate batch', () => {
    const candidate: CanonicalVocabularyEntry = {
      termId: 'clv.family_law.custody_factors.v1',
      canonicalName: 'custody factors',
      oneLineDefinition: "Best-interests factors specific to the family-law lens.",
      longDefinition: 'Family Law Production Lens uses a curated factor set per the lens-pack manifest.',
      scope: 'practice_area',
      scopeQualifier: 'family_law',
      allowedSynonyms: [],
      prohibitedSynonyms: [],
      exampleUsage: [],
      exampleMisuse: [],
      version: 'v1',
    };

    const report = runVCC(
      { existing: CLV_V1_ENTRIES, candidates: [candidate], trigger: 'lens_pack_load' },
      { candidateLayer: 'practice_area' },
    );
    expect(report.verdict).toBe('allow');
    expect(report.blockingCount).toBe(0);
  });

  it("BLOCKs a Layer 2 attempt to redefine a core term (canonical seeded collision)", () => {
    const seeded: CanonicalVocabularyEntry = {
      termId: 'clv.core.issue.v1', // collides with the existing core entry
      canonicalName: 'issue',
      oneLineDefinition: "Layer-2 redefinition that should be BLOCKed.",
      longDefinition: 'Synthetic Layer 2 attempt to redefine the core issue term.',
      scope: 'core',
      allowedSynonyms: [],
      prohibitedSynonyms: [],
      exampleUsage: [],
      exampleMisuse: [],
      version: 'v1',
    };

    const report = runVCC(
      { existing: CLV_V1_ENTRIES, candidates: [seeded], trigger: 'lens_pack_load' },
      { candidateLayer: 'practice_area' },
    );
    expect(report.verdict).toBe('block');
    expect(report.blockingCount).toBeGreaterThanOrEqual(1);
    expect(report.collisions.some((c) => c.rule === 'CORE_REDEFINITION')).toBe(true);
  });

  it('BLOCKs SYNONYM_PROHIBITED_OVERLAP — candidate allows a synonym another core term forbids', () => {
    // Core 'authority' prohibits 'source' as synonym. Candidate claims 'source' as its allowed synonym.
    const seeded: CanonicalVocabularyEntry = {
      termId: 'clv.family_law.legal_basis.v1',
      canonicalName: 'legal basis',
      oneLineDefinition: 'A statute or rule grounding a position.',
      longDefinition: 'Family-law-scoped term to test prohibited-synonym collision.',
      scope: 'practice_area',
      scopeQualifier: 'family_law',
      allowedSynonyms: ['source'], // collides with clv.core.authority.v1's prohibition
      prohibitedSynonyms: [],
      exampleUsage: [],
      exampleMisuse: [],
      version: 'v1',
    };
    const report = runVCC({ existing: CLV_V1_ENTRIES, candidates: [seeded], trigger: 'lens_pack_load' });
    expect(report.verdict).toBe('block');
    expect(report.collisions.some((c) => c.rule === 'SYNONYM_PROHIBITED_OVERLAP')).toBe(true);
  });

  it('WARN_ACK on jurisdiction variance gap', () => {
    const candidate: CanonicalVocabularyEntry = {
      termId: 'clv.family_law.access_schedule.v1',
      canonicalName: 'access schedule',
      oneLineDefinition: 'Court-ordered visitation schedule.',
      longDefinition: 'A court-ordered schedule for parenting time / visitation.',
      scope: 'practice_area',
      scopeQualifier: 'family_law',
      allowedSynonyms: [],
      prohibitedSynonyms: [],
      jurisdictionVariants: { MD: 'Maryland-specific access schedule mechanics.' },
      exampleUsage: [],
      exampleMisuse: [],
      version: 'v1',
    };
    const report = runVCC({
      existing: CLV_V1_ENTRIES,
      candidates: [candidate],
      trigger: 'matter_open',
      activeJurisdictions: ['MD', 'VA'], // VA has no variant entry
    });
    expect(report.verdict).toBe('allow_with_ack');
    expect(report.collisions.some((c) => c.rule === 'JURISDICTION_VARIANCE')).toBe(true);
  });
});

describe('VccDal persistence', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let dal: VccDal;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-vcc-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    dal = new VccDal(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('stores and acknowledges a WARN_ACK report', () => {
    const report = runVCC({
      existing: CLV_V1_ENTRIES,
      candidates: [
        {
          termId: 'clv.family_law.x.v1',
          canonicalName: 'x',
          oneLineDefinition: 'x.',
          longDefinition: 'x.',
          scope: 'practice_area',
          scopeQualifier: 'family_law',
          allowedSynonyms: [],
          prohibitedSynonyms: [],
          jurisdictionVariants: { MD: 'MD form.' },
          exampleUsage: [],
          exampleMisuse: [],
          version: 'v1',
        },
      ],
      trigger: 'lens_pack_load',
      activeJurisdictions: ['MD', 'VA'],
    });
    dal.insertReport(report, 'firm_jclaw');
    expect(dal.countByVerdict('allow_with_ack')).toBe(1);

    const ack = dal.acknowledge(report.reportId, 'admin_user');
    expect(ack).toBe(1);

    // Re-acknowledging the same report does nothing
    expect(dal.acknowledge(report.reportId, 'admin_user')).toBe(0);
  });
});
