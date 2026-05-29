#!/usr/bin/env node
/**
 * Walk-back CLI for the transformation trace layer.
 *
 * Given a target record_id (typically the artifact whose state you're
 * questioning), reconstruct the chain of transformation_step records
 * that produced (or failed to produce) it. The chain combines two
 * link types:
 *
 *   - parent_step_id: tree edges within a single LLM call's sub-chain
 *     (prompt_materialized → llm_returned → json_parsed → normalized)
 *   - input_record_ids → other records' persisted/normalized steps:
 *     lateral edges that connect across separate calls (the upstream
 *     records consumed when this artifact was assembled)
 *
 * Output (ASCII tree, most-recent step at the top):
 *
 *   $ node scripts/trace.js \
 *       --db <path-to-governed-stream.db> \
 *       --record-id <target-record-uuid> \
 *       [--field <field-name>]   # highlight only steps where this field changed
 *       [--depth <N>]            # cap traversal depth (default 6)
 *       [--show-payload]         # print payload_path next to each step
 *
 * Read-only: safe against a DB the sidecar is actively writing to.
 *
 * Exit codes: 0 success, 2 CLI usage error, 3 no record / no data.
 */
/* eslint-disable */

const Database = require('better-sqlite3');

// ── CLI parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { depth: 6 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.db = argv[++i];
    else if (a === '--record-id') out.recordId = argv[++i];
    else if (a === '--field') out.field = argv[++i];
    else if (a === '--depth') out.depth = parseInt(argv[++i], 10);
    else if (a === '--show-payload') out.showPayload = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'usage: --db <path> --record-id <id> [--field <name>] ' +
        '[--depth <N>] [--show-payload]\n',
      );
      process.exit(0);
    }
  }
  if (!out.db) {
    process.stderr.write('error: --db <path> is required\n');
    process.exit(2);
  }
  if (!out.recordId) {
    process.stderr.write('error: --record-id <id> is required\n');
    process.exit(2);
  }
  return out;
}

// ── Queries ──────────────────────────────────────────────────────────

function fetchRecord(db, id) {
  return db.prepare(
    `SELECT id, record_type, sub_phase_id, produced_at, content
       FROM governed_stream WHERE id = ?`,
  ).get(id);
}

function fetchAllTransformationSteps(db) {
  // Pull the full set once into memory. For a typical thin-slice run
  // this is hundreds to low-thousands of rows — well under any size
  // we need to worry about. Building in-memory indices makes the
  // walk-back below straightforward.
  const rows = db.prepare(
    `SELECT id, content, produced_at
       FROM governed_stream
       WHERE record_type='transformation_step' AND is_current_version=1
       ORDER BY produced_at`,
  ).all();
  return rows.map((r) => {
    const c = JSON.parse(r.content);
    return {
      record_id: r.id,
      produced_at: r.produced_at,
      step_id: c.step_id,
      parent_step_id: c.parent_step_id,
      step_type: c.step_type,
      sub_phase_id: c.sub_phase_id,
      input_record_ids: c.input_record_ids || [],
      output_record_id: c.output_record_id,
      payload_path: c.payload_path,
      field_diff: c.field_diff,
      duration_ms: c.duration_ms,
      error: c.error,
      metadata: c.metadata || {},
    };
  });
}

// ── Walk ─────────────────────────────────────────────────────────────

function buildIndices(steps) {
  const byStepId = new Map();
  const byOutputRecordId = new Map();
  const childrenByParent = new Map();
  for (const s of steps) {
    byStepId.set(s.step_id, s);
    if (s.output_record_id) {
      if (!byOutputRecordId.has(s.output_record_id)) {
        byOutputRecordId.set(s.output_record_id, []);
      }
      byOutputRecordId.get(s.output_record_id).push(s);
    }
    if (s.parent_step_id) {
      if (!childrenByParent.has(s.parent_step_id)) {
        childrenByParent.set(s.parent_step_id, []);
      }
      childrenByParent.get(s.parent_step_id).push(s);
    }
  }
  return { byStepId, byOutputRecordId, childrenByParent };
}

function diffMentionsField(diff, field) {
  if (!diff || !field) return false;
  if ((diff.added || []).includes(field)) return true;
  if ((diff.removed || []).includes(field)) return true;
  if ((diff.type_changed || []).includes(field)) return true;
  for (const r of diff.renamed || []) {
    if (r.from === field || r.to === field) return true;
  }
  for (const s of diff.size_changed || []) {
    if (s.field === field) return true;
  }
  return false;
}

function summarizeDiff(diff) {
  if (!diff) return '';
  const parts = [];
  if (diff.added && diff.added.length) parts.push(`+${diff.added.join(',')}`);
  if (diff.removed && diff.removed.length) parts.push(`-${diff.removed.join(',')}`);
  if (diff.renamed && diff.renamed.length) {
    parts.push(diff.renamed.map((r) => `~${r.from}→${r.to}`).join(','));
  }
  if (diff.type_changed && diff.type_changed.length) {
    parts.push(`type:${diff.type_changed.join(',')}`);
  }
  if (diff.size_changed && diff.size_changed.length) {
    parts.push(
      diff.size_changed
        .map((s) => `size:${s.field}[${s.from}→${s.to}]`)
        .join(','),
    );
  }
  return parts.length ? ` [${parts.join(' ')}]` : '';
}

function renderStep(step, opts, prefix, isHighlighted) {
  const marker = isHighlighted ? '⚠ ' : '  ';
  const diffSummary = summarizeDiff(step.field_diff);
  const dur = step.duration_ms !== undefined ? ` (${step.duration_ms}ms)` : '';
  const errMark = step.error ? ' ✗' : '';
  const normalizer = step.metadata?.normalizer ? ` "${step.metadata.normalizer}"` : '';
  const invId = step.metadata?.invocation_id ? ` inv=${shortId(step.metadata.invocation_id)}` : '';
  process.stdout.write(
    `${prefix}${marker}[${step.step_type}]${normalizer}${diffSummary}${dur}${errMark}` +
    ` @${step.sub_phase_id}${invId}  step=${shortId(step.step_id)}\n`,
  );
  if (opts.showPayload && opts.payloadIndex) {
    const payload = opts.payloadIndex.get(step.step_id);
    if (payload === undefined) {
      process.stdout.write(`${prefix}    (no payload — step had no payload OR jsonl line not loaded)\n`);
    } else {
      const summary = payloadSummary(payload);
      process.stdout.write(`${prefix}    payload: ${summary}\n`);
    }
  }
}

function payloadSummary(payload) {
  if (payload === null || payload === undefined) return 'null';
  if (typeof payload === 'string') return `string (${payload.length} chars)`;
  if (Array.isArray(payload)) return `array (${payload.length} items)`;
  if (typeof payload === 'object') {
    const keys = Object.keys(payload);
    const head = keys.slice(0, 8);
    return `object: { ${head.join(', ')}${keys.length > head.length ? ', ...' : ''} }`;
  }
  return String(payload);
}

function shortId(id) {
  return typeof id === 'string' && id.length >= 8 ? id.slice(0, 8) : String(id);
}

/**
 * Walks backward from a target record_id by:
 *  1. Finding the step that produced it (output_record_id match).
 *  2. Following parent_step_id chain inside the same invocation.
 *  3. Following input_record_ids → recurse into upstream record's chain.
 */
function walkBack(targetRecordId, depth, indices, opts, visited = new Set()) {
  if (depth <= 0 || visited.has(targetRecordId)) return;
  visited.add(targetRecordId);

  const producingSteps = indices.byOutputRecordId.get(targetRecordId) || [];
  if (producingSteps.length === 0) {
    process.stdout.write(`  (no transformation_step records reference ${shortId(targetRecordId)})\n`);
    return;
  }

  for (const startStep of producingSteps) {
    process.stdout.write(`\nrecord ${shortId(targetRecordId)}:\n`);
    renderChain(startStep, depth, indices, opts, '  ', visited);
  }
}

function renderChain(step, depth, indices, opts, prefix, visited) {
  if (depth <= 0) return;
  const isHighlighted = opts.field && diffMentionsField(step.field_diff, opts.field);
  renderStep(step, opts, prefix, isHighlighted);

  // Follow parent chain inside the same LLM-call sub-tree.
  if (step.parent_step_id) {
    const parent = indices.byStepId.get(step.parent_step_id);
    if (parent) {
      renderChain(parent, depth - 1, indices, opts, prefix + '  ↑ ', visited);
    }
  }

  // Follow input_record_ids → upstream records' chains.
  for (const upstreamId of step.input_record_ids) {
    if (visited.has(upstreamId)) continue;
    visited.add(upstreamId);
    process.stdout.write(`${prefix}  ← upstream record ${shortId(upstreamId)}:\n`);
    walkBack(upstreamId, depth - 1, indices, opts, visited);
  }
}

// ── Entry ────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  const db = new Database(args.db, { readonly: true, fileMustExist: true });
  try {
    const target = fetchRecord(db, args.recordId);
    if (!target) {
      process.stderr.write(`error: record ${args.recordId} not found\n`);
      process.exit(3);
    }
    process.stdout.write(
      `Target: ${target.record_type}  sub_phase=${target.sub_phase_id || '?'}  ` +
      `produced=${target.produced_at}\n`,
    );
    if (args.field) {
      process.stdout.write(`Tracing field: ${args.field}\n`);
    }
    process.stdout.write(`\n`);

    const steps = fetchAllTransformationSteps(db);
    if (steps.length === 0) {
      process.stderr.write('warn: this DB contains no transformation_step records\n');
      process.stderr.write('      (was the run instrumented? JANUMICODE_TRACE=off?)\n');
      process.exit(3);
    }
    const indices = buildIndices(steps);

    // Optionally load the per-run transforms.jsonl into a step_id →
    // payload index. Only needed when --show-payload is set; loading
    // ~MB of jsonl on every invocation otherwise is wasted work.
    if (args.showPayload) {
      args.payloadIndex = loadTransformsJsonl(args.db, steps);
      process.stdout.write(`(loaded ${args.payloadIndex.size} step payloads from transforms.jsonl)\n\n`);
    }

    walkBack(args.recordId, args.depth, indices, args);
  } finally {
    db.close();
  }
}

/**
 * Best-effort load of transforms.jsonl from the workflow run's runs
 * directory next to the DB. Returns a Map<step_id, payload>. Used by
 * --show-payload to inline payload summaries during walk-back.
 */
function loadTransformsJsonl(dbPath, steps) {
  const fs = require('node:fs');
  const path = require('node:path');
  // DB path is usually <workspace>/.janumicode/test-harness/<file>.db OR
  // <workspace>/.janumicode/runs/<run_id>/<file>.db — scan all runs/
  // subdirs for their AODD events.ndjson, project the step_id → payload
  // map from event_id → payload. transforms.jsonl is gone (P11 retirement).
  const dbDir = path.dirname(dbPath);
  const workspaceJC = path.resolve(dbDir, '..');
  const runsDir = path.join(workspaceJC, 'runs');
  const index = new Map();
  if (!fs.existsSync(runsDir)) return index;
  // Mirrors TRANSFORM_STEP_TYPE_BY_AODD in deep-audit.ts — only events
  // that carry payloads the walk-back UI knows how to render.
  const projectable = new Set([
    'prompt.template_rendered', 'prompt.materialized',
    'llm.invoked', 'llm.returned', 'llm.failed', 'llm.cache_hit',
    'repair.json_succeeded', 'repair.json_failed',
    'context.assembled', 'record.added',
    'agent.invocation_started', 'agent.invocation_completed',
  ]);
  for (const dirent of fs.readdirSync(runsDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const aoddPath = path.join(runsDir, dirent.name, 'aodd', 'events.ndjson');
    if (!fs.existsSync(aoddPath)) continue;
    try {
      const content = fs.readFileSync(aoddPath, 'utf8');
      for (const line of content.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try {
          const rec = JSON.parse(t);
          if (rec.event_id && projectable.has(rec.event_type)) {
            index.set(rec.event_id, rec.payload);
          }
        } catch { /* skip malformed line */ }
      }
    } catch (err) {
      process.stderr.write(`warn: failed to read ${aoddPath}: ${err.message}\n`);
    }
  }
  return index;
}

main();
