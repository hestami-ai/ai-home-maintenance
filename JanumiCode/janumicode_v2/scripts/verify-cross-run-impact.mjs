#!/usr/bin/env node
/**
 * Verify the two-run driver exercised Phase 0.5 Cross-Run Impact Analysis and
 * its downstream chain (0.5 → 6 → 9.1 → 10.1) against the shared DB:
 *
 *   1. run 2 has cross_run_impact_triggered = 1
 *   2. a cross_run_impact_report was produced (with a changed_interface_id)
 *   3. a refactoring_scope was produced (Proceed path) with ≥1 refactoring task
 *   4. ≥1 cross_run_modification was emitted by Phase 9.1 (if run 2 reached 9)
 *   5. Phase 10.1 recorded no `missing_cross_run_modification` (if run 2 reached 10)
 *
 * Usage: node scripts/verify-cross-run-impact.mjs <shared-db-path>
 */
import Database from 'better-sqlite3';

const dbPath = process.argv[2];
if (!dbPath) {
  console.error('[verify-xrun] usage: verify-cross-run-impact.mjs <db>');
  process.exit(2);
}

const db = new Database(dbPath, { readonly: true });
const short = (id) => (id ? String(id).slice(0, 8) : '?');
const parse = (s) => { try { return JSON.parse(s); } catch { return {}; } };

const runs = db.prepare('SELECT id FROM workflow_runs ORDER BY initiated_at').all();
console.log(`[verify-xrun] workflow runs in shared DB: ${runs.length}` +
  (runs.length >= 2 ? '' : ' (WARNING: expected 2 — runs did not share the DB)'));

// (1) cross_run_impact_triggered on any run.
const triggeredRuns = db.prepare(
  'SELECT id FROM workflow_runs WHERE cross_run_impact_triggered = 1',
).all();
console.log(`[verify-xrun] runs with cross_run_impact_triggered=1: ${triggeredRuns.length}` +
  (triggeredRuns.length ? ` (${triggeredRuns.map(r => short(r.id)).join(', ')})` : ''));

const countCurrent = (recordType) => db.prepare(
  `SELECT id, workflow_run_id, content FROM governed_stream
   WHERE record_type = ? AND is_current_version = 1`,
).all(recordType);

// (2) cross_run_impact_report.
const impactReports = countCurrent('cross_run_impact_report');
for (const r of impactReports) {
  const c = parse(r.content);
  console.log(`[verify-xrun] cross_run_impact_report ${short(r.id)} (run ${short(r.workflow_run_id)}): ` +
    `changed=${short(c.changed_interface_id)} kind=${c.interface_kind} mod=${c.modification_type} ` +
    `tasks=${c.estimated_refactoring_task_count ?? 0} files=${c.estimated_file_count ?? 0}`);
}
console.log(`[verify-xrun] cross_run_impact_report records: ${impactReports.length}`);

// (3) refactoring_scope.
const scopes = countCurrent('refactoring_scope');
let scopeTaskCount = 0;
for (const r of scopes) {
  const c = parse(r.content);
  const n = Array.isArray(c.refactoring_tasks) ? c.refactoring_tasks.length : 0;
  scopeTaskCount += n;
  console.log(`[verify-xrun] refactoring_scope ${short(r.id)} (run ${short(r.workflow_run_id)}): ${n} refactoring task(s)`);
}
console.log(`[verify-xrun] refactoring_scope records: ${scopes.length} (${scopeTaskCount} task(s) total)`);

// Also report whether the chosen path was Accept-Divergence (technical_debt).
const debt = countCurrent('technical_debt_record');
if (debt.length) console.log(`[verify-xrun] technical_debt_record records: ${debt.length} (Accept-Divergence path taken)`);

// (4) cross_run_modification from Phase 9.1.
const mods = countCurrent('cross_run_modification');
for (const r of mods) {
  const c = parse(r.content);
  console.log(`[verify-xrun] cross_run_modification ${short(r.id)} (run ${short(r.workflow_run_id)}): ` +
    `task=${c.refactoring_task_id} status=${c.applied_status} mod=${c.modification_type}`);
}
console.log(`[verify-xrun] cross_run_modification records: ${mods.length}`);

// (5) Phase 10.1 missing-modification blocking failures.
let missingFlagged = 0;
for (const r of countCurrent('artifact_produced')) {
  const c = parse(r.content);
  if (c.kind !== 'consistency_report') continue;
  const bf = Array.isArray(c.blocking_failures) ? c.blocking_failures : [];
  for (const f of bf) {
    if (f && f.kind === 'missing_cross_run_modification') {
      missingFlagged += (f.missing_refactoring_task_ids?.length ?? 1);
      console.log(`[verify-xrun] Phase 10.1 BLOCKING: missing cross_run_modification for ${JSON.stringify(f.missing_refactoring_task_ids)}`);
    }
  }
}

// ── Verdict ─────────────────────────────────────────────────────────
const triggered = triggeredRuns.length > 0 && impactReports.length > 0;
if (!triggered) {
  console.log('[verify-xrun] RESULT: ✗ Phase 0.5 did NOT trigger. Confirm run 1 produced + CERTIFIED an interface_contracts (needs --simulate-human-decisions and a phase-limit ≥ 3), and the override targeted it cross-run.');
} else if (scopes.length === 0 && debt.length === 0) {
  console.log('[verify-xrun] RESULT: ◐ Phase 0.5 ran (impact report present) but neither a refactoring_scope nor a technical_debt_record was produced — the 0.5.2 decision did not resolve as expected.');
} else if (mods.length === 0) {
  console.log('[verify-xrun] RESULT: ◐ Phase 0.5 produced a refactoring_scope, but no cross_run_modification was emitted — run 2 likely did not reach Phase 9 (raise its phase-limit / leave it unbounded), or the refactoring tasks did not complete.');
} else if (missingFlagged > 0) {
  console.log('[verify-xrun] RESULT: ✗ Phase 10.1 flagged missing cross_run_modification records — the chain is incomplete.');
} else {
  console.log(`[verify-xrun] RESULT: ✓ Full chain live: Phase 0.5 triggered → refactoring_scope (${scopeTaskCount} task(s)) → ${mods.length} cross_run_modification → Phase 10.1 clean.`);
}
db.close();
