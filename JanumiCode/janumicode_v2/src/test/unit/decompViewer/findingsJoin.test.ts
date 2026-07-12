/**
 * Validator-findings loader — item binding (gated on JANUMICODE_CAL40_DB).
 *
 * Verifies the viewer selects the substantive reasoning-review findings and
 * binds them to real items (AC/US/NFR/component) via cited ids, dropping the
 * auto-fix noise. Skips cleanly when no clone is present.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BetterSqlite3 = require('better-sqlite3');
import { loadFindings } from '../../../lib/decompViewer/findingsLoader';
import { DecompViewerDataProvider } from '../../../lib/decompViewer/decompViewerDataProvider';
import { AUTO_FIX_VALIDATORS } from '../../../lib/review/findingSurfacing';
import type { Database } from '../../../lib/database/init';

const CAL40 = process.env.JANUMICODE_CAL40_DB;
const run = CAL40 && fs.existsSync(CAL40) ? describe : describe.skip;

run('cal-40 validator findings (gated on JANUMICODE_CAL40_DB)', () => {
  // Setup runs in beforeAll, NOT at describe-collection time, so the default
  // skipped path (JANUMICODE_CAL40_DB unset → describe.skip) never opens a DB.
  // A collection-time `new BetterSqlite3(undefined, { readonly: true })` throws
  // "In-memory/temporary databases cannot be readonly" on better-sqlite3 12.8.0
  // and fails the whole file even though every test is meant to be skipped.
  let db: Database & { close(): void };
  let runId: string;
  let findings: ReturnType<typeof loadFindings>['findings'];
  let summary: ReturnType<typeof loadFindings>['summary'];
  beforeAll(() => {
    db = new BetterSqlite3(CAL40, { readonly: true }) as unknown as Database & { close(): void };
    runId = (db.prepare('SELECT id FROM workflow_runs ORDER BY rowid LIMIT 1').get() as { id: string }).id;
    ({ findings, summary } = loadFindings(db, runId));
  });

  it('surfaces + binds a substantial set of findings', () => {
    expect(summary.total).toBeGreaterThan(1000);       // many raw findings
    expect(summary.surfaced).toBeGreaterThan(summary.bound); // not all bind
    expect(summary.bound).toBeGreaterThan(100);        // measured ~454 on clone-p9
    expect(findings.length).toBe(summary.bound);
    expect(summary.surfaced).toBe(summary.bound + summary.unbound);
  });

  it('every shipped finding is substantive + bound to a real item', () => {
    for (const f of findings) {
      expect(f.severity === 'HIGH' || f.severity === 'MEDIUM').toBe(true);
      expect(AUTO_FIX_VALIDATORS.has(f.validator_id)).toBe(false);
      expect(f.ac_ids.length + f.display_keys.length).toBeGreaterThan(0);
    }
  });

  it('binds across item kinds (component/US/AC/NFR)', () => {
    const boundKeys = new Set(findings.flatMap((f) => f.display_keys));
    const boundAcs = new Set(findings.flatMap((f) => f.ac_ids));
    expect([...boundKeys].some((k) => k.startsWith('comp') || k.startsWith('COMP'))).toBe(true);
    expect([...boundKeys].some((k) => k.startsWith('US-'))).toBe(true);
    expect(boundAcs.size).toBeGreaterThan(0);
    // Categories: at least some artifact-level findings (not all process).
    expect(findings.some((f) => f.category === 'artifact')).toBe(true);
  });

  it('payload hashing is deterministic (delta idempotence)', () => {
    const provider = new DecompViewerDataProvider(db);
    const a = provider.getFindingsPayload(runId);
    const b = provider.getFindingsPayload(runId);
    expect(a.revision).toBe(b.revision);
    expect(a.hashes.size).toBe(a.findings.length);
    const upserts = b.findings.filter((f) => a.hashes.get(f.record_id) !== b.hashes.get(f.record_id));
    expect(upserts).toHaveLength(0);
  });
});
