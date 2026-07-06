#!/usr/bin/env node
/**
 * prep-replay-db.mjs — prepare a GPU-free replay fixture from a calibration DB.
 *
 * Runs as plain Node (NOT inside Electron) so better-sqlite3 loads directly —
 * this is deliberately the ONE place that opens the source DB with a native
 * driver, so the extension-host replay code never has to.
 *
 * NEVER mutates the source. The live cal-40 DB is being written by the
 * calibration run; we open it read-only and take a writer-safe, WAL-correct
 * snapshot via SQLite's online backup API (a single standalone .db, no
 * -wal/-shm sidecars). Mutations (--pending-gate / --trim / --phase-limit) and
 * --export-json operate only on the clone.
 *
 * Usage:
 *   node scripts/replay/prep-replay-db.mjs --src <cal-40.db> --dest <clone.db> [flags]
 *
 * Flags:
 *   --src <path>            Source DB (read-only). Required.
 *   --dest <path>          Clone destination. Required for cloning + mutations.
 *                          Omit to --export-json / --emit-manifest from --src directly.
 *   --pending-gate <phase>  On the clone, drop that phase's phase_gate_approved
 *                          and every record after its phase_gate_evaluation, so
 *                          the webview reconstructs a clickable pending gate.
 *   --trim <N>             Keep only the first N records (by produced_at).
 *   --phase-limit <p>      Keep only records with phase_id <= p (numeric compare).
 *   --export-json <dir>    Dump the run's governed_stream + workflow_runs rows
 *                          as NDJSON (Tier-2 fixture-map source).
 *   --emit-manifest        Write <dest>.manifest.json (run id, counts, sha256).
 *   --run-id <id>          Target a specific run (default: the run with the most rows).
 *   --help
 *
 * Output is gitignored (under test-and-evaluation/ or a path you choose) — we
 * commit no replay fixtures.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';

// ── arg parsing ──────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true; // boolean flag
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.src) {
  process.stdout.write(
    'prep-replay-db.mjs — prepare a GPU-free replay fixture.\n\n'
    + '  --src <path>          source DB (read-only, required)\n'
    + '  --dest <path>        clone destination (required to clone/mutate)\n'
    + '  --pending-gate <p>    craft a pending gate at phase p\n'
    + '  --trim <N>           keep first N records\n'
    + '  --phase-limit <p>     keep records with phase_id <= p\n'
    + '  --export-json <dir>   dump governed_stream + workflow_runs as NDJSON\n'
    + '  --emit-manifest       write <dest>.manifest.json\n'
    + '  --run-id <id>         target run (default: largest run)\n',
  );
  process.exit(args.src ? 0 : 1);
}

const srcPath = path.resolve(String(args.src));
if (!fs.existsSync(srcPath)) {
  console.error(`[prep-replay] source not found: ${srcPath}`);
  process.exit(1);
}

const wantsMutation = args['pending-gate'] || args.trim || args['phase-limit'];
const destPath = args.dest ? path.resolve(String(args.dest)) : null;

if (wantsMutation && !destPath) {
  console.error('[prep-replay] --pending-gate/--trim/--phase-limit require --dest (never mutate the source).');
  process.exit(1);
}

// ── clone ────────────────────────────────────────────────────────────
// Two mechanisms:
//   default: SQLite online backup (.backup) — internally consistent, but holds
//            a read transaction on the source and restarts if the source is
//            written mid-copy. Best for a quiescent source.
//   --copy-files: OS-copy the 3 files (db/-wal/-shm) then checkpoint the copy.
//            A plain read of the source with no long-held transaction — safer
//            when the source is a LIVE, actively-written calibration DB.
if (destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(destPath + suffix)) fs.rmSync(destPath + suffix);
  }
  if (args['copy-files']) {
    console.log(`[prep-replay] cloning (copy-files) ${srcPath} -> ${destPath}`);
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(srcPath + suffix)) fs.copyFileSync(srcPath + suffix, destPath + suffix);
    }
    // Fold the copied WAL into the main file and drop the sidecars so the
    // clone is standalone. Recovery ignores any torn trailing WAL frame.
    const copy = new Database(destPath);
    copy.pragma('busy_timeout = 10000');
    copy.pragma('wal_checkpoint(TRUNCATE)');
    copy.close();
    for (const suffix of ['-wal', '-shm']) {
      if (fs.existsSync(destPath + suffix)) fs.rmSync(destPath + suffix);
    }
  } else {
    console.log(`[prep-replay] cloning (online backup) ${srcPath} -> ${destPath}`);
    const src = new Database(srcPath, { readonly: true });
    src.pragma('busy_timeout = 10000');
    await src.backup(destPath);
    src.close();
  }
  console.log('[prep-replay] clone complete (standalone .db, no WAL sidecar).');
}

const targetPath = destPath ?? srcPath;

// ── resolve target run ──────────────────────────────────────────────
const db = new Database(targetPath, { readonly: !destPath });
db.pragma('busy_timeout = 10000');
// Craft-a-fixture mode: don't let FK cascades delete extra rows during trims.
if (destPath) db.pragma('foreign_keys = OFF');

function resolveRunId() {
  if (args['run-id']) return String(args['run-id']);
  const row = db
    .prepare(
      `SELECT workflow_run_id AS id, COUNT(*) AS n
         FROM governed_stream
        GROUP BY workflow_run_id
        ORDER BY n DESC
        LIMIT 1`,
    )
    .get();
  return row?.id ?? null;
}

const runId = resolveRunId();
if (!runId) {
  console.error('[prep-replay] no workflow run found in DB.');
  process.exit(1);
}
console.log(`[prep-replay] target run: ${runId}`);

// ── mutations ───────────────────────────────────────────────────────
if (args['phase-limit']) {
  const limit = Number(args['phase-limit']);
  const res = db
    .prepare(
      `DELETE FROM governed_stream
        WHERE workflow_run_id = ?
          AND phase_id IS NOT NULL AND phase_id != ''
          AND CAST(phase_id AS REAL) > ?`,
    )
    .run(runId, limit);
  console.log(`[prep-replay] --phase-limit ${limit}: removed ${res.changes} rows after phase ${limit}.`);
}

if (args.trim) {
  const n = Number(args.trim);
  const res = db
    .prepare(
      `DELETE FROM governed_stream
        WHERE workflow_run_id = ?
          AND id NOT IN (
            SELECT id FROM governed_stream
             WHERE workflow_run_id = ?
             ORDER BY produced_at ASC, id ASC
             LIMIT ?
          )`,
    )
    .run(runId, runId, n);
  console.log(`[prep-replay] --trim ${n}: removed ${res.changes} rows beyond the first ${n}.`);
}

if (args['pending-gate']) {
  const phase = String(args['pending-gate']);
  const evalRow = db
    .prepare(
      `SELECT produced_at FROM governed_stream
        WHERE workflow_run_id = ? AND record_type = 'phase_gate_evaluation' AND phase_id = ?
        ORDER BY produced_at DESC LIMIT 1`,
    )
    .get(runId, phase);
  if (!evalRow) {
    console.warn(`[prep-replay] --pending-gate ${phase}: no phase_gate_evaluation found for that phase; skipping.`);
  } else {
    const afterRes = db
      .prepare(
        `DELETE FROM governed_stream
          WHERE workflow_run_id = ? AND produced_at > ?`,
      )
      .run(runId, evalRow.produced_at);
    const apprRes = db
      .prepare(
        `DELETE FROM governed_stream
          WHERE workflow_run_id = ? AND record_type = 'phase_gate_approved' AND phase_id = ?`,
      )
      .run(runId, phase);
    // The gate is no longer "completed" — drop its phase_gates row too.
    db.prepare(`DELETE FROM phase_gates WHERE workflow_run_id = ? AND phase_id = ?`).run(runId, phase);
    console.log(
      `[prep-replay] --pending-gate ${phase}: removed ${afterRes.changes} trailing rows + `
      + `${apprRes.changes} approval(s); the evaluation is now the frontier (pending gate).`,
    );
  }
}

// ── export NDJSON ────────────────────────────────────────────────────
if (args['export-json']) {
  const dir = path.resolve(String(args['export-json']));
  fs.mkdirSync(dir, { recursive: true });
  const gsPath = path.join(dir, 'governed_stream.ndjson');
  const wrPath = path.join(dir, 'workflow_runs.ndjson');

  const gsStream = fs.createWriteStream(gsPath, 'utf-8');
  let gsCount = 0;
  const gsStmt = db.prepare(
    `SELECT * FROM governed_stream
      WHERE workflow_run_id = ?
      ORDER BY produced_at ASC, id ASC`,
  );
  for (const row of gsStmt.iterate(runId)) {
    gsStream.write(JSON.stringify(row) + '\n');
    gsCount++;
  }
  gsStream.end();

  const wr = db.prepare(`SELECT * FROM workflow_runs WHERE id = ?`).get(runId);
  fs.writeFileSync(wrPath, wr ? JSON.stringify(wr) + '\n' : '', 'utf-8');
  console.log(`[prep-replay] --export-json: wrote ${gsCount} governed_stream rows -> ${gsPath}`);
}

// ── manifest ─────────────────────────────────────────────────────────
if (args['emit-manifest']) {
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM governed_stream WHERE workflow_run_id = ?`)
    .get(runId).n;
  const current = db
    .prepare(`SELECT COUNT(*) AS n FROM governed_stream WHERE workflow_run_id = ? AND is_current_version = 1`)
    .get(runId).n;
  const phases = db
    .prepare(
      `SELECT DISTINCT phase_id FROM governed_stream
        WHERE workflow_run_id = ? AND phase_id IS NOT NULL AND phase_id != ''
        ORDER BY CAST(phase_id AS REAL) ASC`,
    )
    .all(runId)
    .map((r) => r.phase_id);
  const sha256 = createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');
  const manifest = {
    run_id: runId,
    source: srcPath,
    target: targetPath,
    total_rows: total,
    current_version_rows: current,
    phases,
    sha256,
    generated_from: 'prep-replay-db.mjs',
  };
  const manifestPath = (destPath ?? srcPath) + '.manifest.json';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`[prep-replay] --emit-manifest: ${manifestPath} (total=${total}, current=${current}, phases=${phases.join(',')})`);
}

// Checkpoint + close so the clone is fully self-contained.
if (destPath) db.pragma('wal_checkpoint(TRUNCATE)');
db.close();
console.log('[prep-replay] done.');
