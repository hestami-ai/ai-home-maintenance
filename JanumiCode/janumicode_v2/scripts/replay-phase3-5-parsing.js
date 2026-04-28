#!/usr/bin/env node
/**
 * Replay Phase 3-5 artifact parsing against an existing run's
 * agent_output rows.
 *
 * Why this exists
 * ───────────────
 * cal-21 (and any pre-fix run) lost substantive output to the
 * envelope-key-vs-schema-key parser bug fixed in
 * `parsedResponseHelpers.ts`:
 *
 *   Phase 3.2 system_requirements:    16 SRs produced → 1 placeholder persisted
 *   Phase 4.3 architectural_decisions:  7 ADRs produced → 1 placeholder persisted
 *   Phase 5.1 data_models:              7 models produced → 1 placeholder persisted
 *   Phase 5.2 api_definitions:          7 defs produced → 1 placeholder persisted
 *   Phase 5.3 error_handling_strategies: 7 strategies → 1 placeholder persisted
 *   Phase 5.4 configuration_parameters: 24 params → 1 placeholder persisted
 *
 * The LLM responses are still in the DB on `agent_output` rows. This
 * script re-parses them with the corrected logic, supersedes the
 * placeholder `artifact_produced` rows, and writes corrected ones.
 * No re-run, no LLM calls.
 *
 * Usage
 * ─────
 *   node scripts/replay-phase3-5-parsing.js \
 *     --db <path-to-sqlite>                  # required
 *     [--run-id <workflow_run_id>]           # optional; default: latest
 *     [--dry-run]                            # optional; show what would change
 *
 * Safety
 * ──────
 *   - Always operates within a single SQLite transaction.
 *   - Marks the old placeholder records is_current_version=0 (soft
 *     supersession, matches the rest of the system); the new
 *     records take their place as is_current_version=1.
 *   - --dry-run prints the diff and rolls back.
 */

const Database = require('better-sqlite3');
const path = require('node:path');
const crypto = require('node:crypto');

// ── CLI parsing ──────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { db: null, runId: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') args.db = argv[++i];
    else if (a === '--run-id') args.runId = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error('Unknown arg:', a); process.exit(2); }
  }
  if (!args.db) { console.error('--db is required'); process.exit(2); }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/replay-phase3-5-parsing.js --db <path> [--run-id <id>] [--dry-run]`);
}

// ── Mirrors of pickItemsArray / pickEnvelope ────────────────────
function pickItemsArray(parsed, candidateKeys) {
  if (!parsed) return null;
  if (Array.isArray(parsed)) return parsed;
  for (const k of candidateKeys) {
    const v = parsed[k];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  return null;
}

// ── Per-sub-phase replay configurations ────────────────────────
/**
 * Each entry maps a sub_phase_id to:
 *  - kind: the artifact kind to look for in artifact_produced
 *  - candidates: envelope keys to try, in order
 *  - schemaKey: the property the persisted record uses for the items array
 */
const REPLAY_CONFIGS = [
  { sub: '3.2', kind: 'system_requirements',          candidates: ['system_requirements', 'items'],          schemaKey: 'items' },
  { sub: '3.3', kind: 'interface_contracts',          candidates: ['interface_contracts', 'contracts'],      schemaKey: 'contracts' },
  { sub: '4.1', kind: 'software_domains',             candidates: ['software_domains', 'domains'],           schemaKey: 'domains' },
  { sub: '4.2', kind: 'component_model',              candidates: ['component_model', 'components'],         schemaKey: 'components' },
  { sub: '4.3', kind: 'architectural_decisions',      candidates: ['architectural_decisions', 'adrs'],       schemaKey: 'adrs' },
  { sub: '5.1', kind: 'data_models',                  candidates: ['data_models', 'models'],                 schemaKey: 'models' },
  { sub: '5.2', kind: 'api_definitions',              candidates: ['api_definitions', 'definitions'],        schemaKey: 'definitions' },
  { sub: '5.3', kind: 'error_handling_strategies',    candidates: ['error_handling_strategies', 'strategies'], schemaKey: 'strategies' },
  { sub: '5.4', kind: 'configuration_parameters',     candidates: ['configuration_parameters', 'params'],    schemaKey: 'params' },
  { sub: '6.1', kind: 'implementation_plan',          candidates: ['implementation_plan', 'tasks'],          schemaKey: 'tasks' },
];

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Strip surrounding markdown fences and trailing whitespace before
 * JSON.parse. qwen-3.5:9b sometimes wraps JSON in ```...``` blocks.
 */
function safeJsonParse(text) {
  let t = (text ?? '').trim();
  t = t.replace(/^```(json)?\n?/, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { return null; }
}

function resolveRunId(db, override) {
  if (override) return override;
  const row = db.prepare(`SELECT id FROM workflow_runs ORDER BY rowid DESC LIMIT 1`).get();
  if (!row) throw new Error('no workflow_runs in DB');
  return row.id;
}

function persistedArtifact(db, runId, kind) {
  return db.prepare(
    `SELECT id, content FROM governed_stream
     WHERE record_type='artifact_produced'
       AND is_current_version=1
       AND workflow_run_id = ?
       AND json_extract(content, '$.kind') = ?
     ORDER BY produced_at DESC LIMIT 1`,
  ).get(runId, kind);
}

function lastAgentOutput(db, runId, sub) {
  // Latest agent_output for the sub-phase. Phase 3-5 typically run
  // three calls per sub-phase (DM Stage 1, DM Stage 7, Systems
  // Agent); the Systems Agent is last.
  return db.prepare(
    `SELECT content FROM governed_stream
     WHERE record_type='agent_output'
       AND is_current_version=1
       AND workflow_run_id = ?
       AND sub_phase_id = ?
     ORDER BY produced_at DESC LIMIT 1`,
  ).get(runId, sub);
}

function isPlaceholder(itemCount) {
  return itemCount <= 1;
}

/** Format a finding's persisted/agent/delta counts for log output. */
function formatCounts(f) {
  if (f.persisted === undefined) return '';
  const parts = [`persisted=${f.persisted}`];
  if (f.agent !== undefined) parts.push(`agent=${f.agent}`);
  if (f.delta !== undefined) parts.push(`+${f.delta}`);
  return ` (${parts.join(', ')})`;
}

/**
 * Decide what (if anything) to do for one (sub_phase, kind) config:
 * compare the persisted artifact's item count against the LLM's
 * actual output, return a finding describing the gap.
 */
function analyzeReplayCandidate(db, runId, cfg) {
  const persisted = persistedArtifact(db, runId, cfg.kind);
  if (!persisted) return { sub: cfg.sub, kind: cfg.kind, status: 'no-persisted-artifact' };
  const persistedJson = JSON.parse(persisted.content);
  const persistedItems = persistedJson[cfg.schemaKey];
  const persistedCount = Array.isArray(persistedItems) ? persistedItems.length : 0;

  const out = lastAgentOutput(db, runId, cfg.sub);
  if (!out) return { sub: cfg.sub, kind: cfg.kind, status: 'no-agent-output' };
  const outText = JSON.parse(out.content).text ?? '';
  const parsed = safeJsonParse(outText);
  if (!parsed) return { sub: cfg.sub, kind: cfg.kind, status: 'agent-output-unparseable' };

  const recovered = pickItemsArray(parsed, cfg.candidates);
  if (!recovered || recovered.length === 0) {
    return { sub: cfg.sub, kind: cfg.kind, status: 'agent-output-empty', persisted: persistedCount };
  }
  if (recovered.length <= persistedCount) {
    return { sub: cfg.sub, kind: cfg.kind, status: 'no-improvement', persisted: persistedCount, agent: recovered.length };
  }
  return {
    sub: cfg.sub, kind: cfg.kind,
    status: isPlaceholder(persistedCount) ? 'recover-from-placeholder' : 'recover-richer',
    persisted: persistedCount, agent: recovered.length,
    delta: recovered.length - persistedCount,
    record_id: persisted.id,
    new_content: { kind: cfg.kind, [cfg.schemaKey]: recovered },
  };
}

// ── Main replay ─────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);
  const dbPath = path.resolve(args.db);
  console.log(`replay-phase3-5: db=${dbPath}${args.dryRun ? ' (DRY RUN)' : ''}`);

  const db = new Database(dbPath, { readonly: false });
  const runId = resolveRunId(db, args.runId);
  console.log(`replay-phase3-5: workflow_run_id=${runId}`);

  const findings = REPLAY_CONFIGS.map(cfg => analyzeReplayCandidate(db, runId, cfg));

  // ── Print summary ───────────────────────────────────────────
  console.log('');
  console.log('Findings:');
  for (const f of findings) {
    console.log(`  ${f.sub} ${f.kind.padEnd(32)} ${f.status}${formatCounts(f)}`);
  }

  const recoverable = findings.filter(f => f.status.startsWith('recover-'));
  if (recoverable.length === 0) {
    console.log('');
    console.log('Nothing to replay.');
    db.close();
    return;
  }

  console.log('');
  console.log(`Will supersede ${recoverable.length} artifact_produced record(s) and recover:`);
  for (const f of recoverable) {
    const itemKey = Object.keys(f.new_content).find(k => k !== 'kind');
    const items = itemKey ? f.new_content[itemKey] : [];
    console.log(`  ${f.sub} ${f.kind}: ${items.length} item(s)`);
  }

  if (args.dryRun) {
    console.log('');
    console.log('--dry-run: not writing.');
    db.close();
    return;
  }

  // ── Write the recovered artifacts ──────────────────────────
  // Use SELECT * INTO * pattern: copy every column from the
  // superseded row, override id / produced_at / content / supersession
  // bookkeeping. This avoids enumerating every NOT-NULL column and
  // surviving schema additions.
  const tx = db.transaction(() => {
    const fetchRow = db.prepare(`SELECT * FROM governed_stream WHERE id = ?`);
    const supersede = db.prepare(
      `UPDATE governed_stream SET is_current_version = 0,
         superseded_by_id = ?, superseded_at = ?
       WHERE id = ?`,
    );
    for (const f of recoverable) {
      const row = fetchRow.get(f.record_id);
      if (!row) continue;
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const newRow = {
        ...row,
        id: newId,
        produced_at: now,
        effective_at: now,
        is_current_version: 1,
        superseded_by_id: null,
        superseded_at: null,
        superseded_by_record_id: null,
        content: JSON.stringify(f.new_content),
      };
      const cols = Object.keys(newRow);
      const placeholders = cols.map(() => '?').join(', ');
      const insertSql = `INSERT INTO governed_stream (${cols.join(', ')}) VALUES (${placeholders})`;
      db.prepare(insertSql).run(...cols.map(c => newRow[c]));
      supersede.run(newId, now, f.record_id);
      console.log(`  superseded ${f.record_id} → wrote ${newId} (${f.kind})`);
    }
  });
  tx();

  console.log('');
  console.log(`Replay complete. ${recoverable.length} artifact(s) recovered.`);
  db.close();
}

main();
