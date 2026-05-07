#!/usr/bin/env node
/**
 * Phase 2 (FR + NFR) recursive decomposition progress report.
 *
 * Read-only against a calibration workspace's governed-stream DB; safe to
 * run while the workflow is still writing (matches the live-DB contract
 * used by scripts/extract-phase2-decomposition.js and similar).
 *
 * Surfaces:
 *   - Workflow + active sub-phase (latest workflow_runs row)
 *   - Per-kind aggregates: total nodes, by status, by tier, by depth
 *   - Per-root one-liners: id, total descendants, max depth, status mix,
 *     last activity, recently-touched indicator
 *   - Roots untouched (no descendants written yet) — what the BFS frontier
 *     hasn't reached yet
 *   - Recently produced nodes (last 10) — what's freshly landed
 *   - Activity rate over the last 5 minutes (nodes/min) — proxy for "is
 *     the run actually progressing right now"
 *
 * Auto-detects the most recently modified DB under
 * `<repo>/test-and-evaluation/calibration-workspaces/.../test-harness/*.db`
 * unless --db / --workspace is provided.
 *
 * Usage:
 *   node scripts/decomposition-progress-report.js
 *   node scripts/decomposition-progress-report.js --workspace <path>
 *   node scripts/decomposition-progress-report.js --db <path-to-db>
 *   node scripts/decomposition-progress-report.js --kind nfr      # filter
 *   node scripts/decomposition-progress-report.js --top 15        # per-root rows
 *   node scripts/decomposition-progress-report.js --recent 20     # recent-nodes tail
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const out = { topRoots: 12, recentN: 10, kind: 'both' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.db = argv[++i];
    else if (a === '--workspace') out.workspace = argv[++i];
    else if (a === '--kind') out.kind = argv[++i];
    else if (a === '--top') out.topRoots = Number.parseInt(argv[++i], 10);
    else if (a === '--recent') out.recentN = Number.parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') {
      console.error(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 28).join('\n'));
      process.exit(0);
    }
  }
  return out;
}

const args = parseArgs(process.argv);

// ── Locate the DB ────────────────────────────────────────────────────
function findRepoRoot() {
  // Walk up from this script's directory looking for package.json with name 'janumicode'.
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const pj = path.join(dir, 'package.json');
    if (fs.existsSync(pj)) {
      try {
        const j = JSON.parse(fs.readFileSync(pj, 'utf8'));
        if (j.name === 'janumicode') return dir;
      } catch { /* keep walking */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(__dirname, '..');
}

function findMostRecentDb() {
  const repo = findRepoRoot();
  const calRoot = path.join(repo, 'test-and-evaluation', 'calibration-workspaces');
  if (!fs.existsSync(calRoot)) return null;
  const candidates = [];
  for (const ws of fs.readdirSync(calRoot, { withFileTypes: true })) {
    if (!ws.isDirectory()) continue;
    const harness = path.join(calRoot, ws.name, '.janumicode', 'test-harness');
    if (!fs.existsSync(harness)) continue;
    for (const f of fs.readdirSync(harness)) {
      if (!f.endsWith('.db')) continue;
      const p = path.join(harness, f);
      candidates.push({ p, mtime: fs.statSync(p).mtimeMs, ws: ws.name });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0];
}

let dbPath;
let workspaceLabel;
if (args.db) {
  dbPath = args.db;
  workspaceLabel = path.relative(process.cwd(), path.dirname(path.dirname(path.dirname(dbPath))));
} else if (args.workspace) {
  const harness = path.join(args.workspace, '.janumicode', 'test-harness');
  const dbs = fs.readdirSync(harness).filter((f) => f.endsWith('.db'))
    .map((f) => ({ p: path.join(harness, f), mtime: fs.statSync(path.join(harness, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (dbs.length === 0) { console.error(`No .db found under ${harness}`); process.exit(2); }
  dbPath = dbs[0].p;
  workspaceLabel = path.basename(args.workspace);
} else {
  const auto = findMostRecentDb();
  if (!auto) { console.error('No calibration DB found. Pass --db or --workspace.'); process.exit(2); }
  dbPath = auto.p;
  workspaceLabel = auto.ws;
}

const db = new Database(dbPath, { readonly: true, fileMustExist: true });

// ── Pull data ────────────────────────────────────────────────────────

const wfRun = db.prepare(`
  SELECT id, status, current_phase_id, current_sub_phase_id,
         decomposition_budget_calls_used,
         decomposition_fr_calls_used,
         decomposition_nfr_calls_used,
         decomposition_max_depth_reached
  FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1
`).get();

if (!wfRun) {
  console.error('No workflow_runs row in DB.');
  process.exit(3);
}

const decompRows = db.prepare(`
  SELECT id, produced_at, content
  FROM governed_stream
  WHERE record_type = 'requirement_decomposition_node'
    AND is_current_version = 1
    AND workflow_run_id = ?
`).all(wfRun.id);

const nodes = decompRows.map((r) => {
  const c = JSON.parse(r.content);
  return {
    record_id: r.id,
    produced_at: r.produced_at,
    node_id: c.node_id,
    parent_node_id: c.parent_node_id ?? null,
    display_key: c.display_key ?? c.user_story?.id ?? c.node_id?.slice(0, 8),
    root_fr_id: c.root_fr_id ?? null,
    root_kind: c.root_kind ?? 'fr',
    depth: c.depth ?? 0,
    pass_number: c.pass_number ?? 0,
    status: c.status ?? 'unknown',
    tier: c.tier ?? null,
    pruning_reason: c.pruning_reason ?? null,
  };
});

// ── Compute structures ───────────────────────────────────────────────

function tally(items, key) {
  const m = new Map();
  for (const it of items) {
    const k = key(it) ?? '(none)';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function tallyNum(items, key) {
  return tally(items, key).sort((a, b) => Number(a[0]) - Number(b[0]));
}

function summarizeKind(kindNodes, kind) {
  if (kindNodes.length === 0) {
    return { kind, total: 0, lines: ['_(no decomposition nodes for this kind yet)_'] };
  }
  const byStatus = tally(kindNodes, (n) => n.status);
  const byTier = tally(kindNodes, (n) => n.tier ?? 'depth-0');
  const byDepth = tallyNum(kindNodes, (n) => n.depth);
  const maxDepth = Math.max(...kindNodes.map((n) => n.depth));
  const maxPass = Math.max(...kindNodes.map((n) => n.pass_number));

  // Per-root summary. root_fr_id on descendants is the depth-0 root's
  // node_id (UUID); resolve to the root's display_key (e.g., "US-001",
  // "NFR-009") for human readability. Depth-0 nodes have no root_fr_id;
  // they group under their own display_key.
  const nodeIdToDisplayKey = new Map();
  for (const n of kindNodes) nodeIdToDisplayKey.set(n.node_id, n.display_key);

  const byRoot = new Map();
  for (const n of kindNodes) {
    const rootId = n.root_fr_id ?? n.node_id;
    const rootLabel = nodeIdToDisplayKey.get(rootId) ?? rootId.slice(0, 8);
    if (!byRoot.has(rootLabel)) byRoot.set(rootLabel, []);
    byRoot.get(rootLabel).push(n);
  }

  const rootRows = Array.from(byRoot.entries()).map(([rootId, group]) => {
    const total = group.length;
    const maxDepthInRoot = Math.max(...group.map((n) => n.depth));
    const lastActivity = group.reduce((acc, n) => n.produced_at > acc ? n.produced_at : acc, '');
    const statusMix = tally(group, (n) => n.status)
      .map(([s, c]) => `${s}:${c}`)
      .join(' ');
    return { rootId, total, maxDepth: maxDepthInRoot, lastActivity, statusMix };
  }).sort((a, b) => {
    // most-recently-active roots first
    if (b.lastActivity !== a.lastActivity) return b.lastActivity.localeCompare(a.lastActivity);
    return b.total - a.total;
  });

  const lines = [];
  lines.push(`**Total nodes:** ${kindNodes.length}  ·  **Max depth reached:** ${maxDepth}  ·  **BFS pass:** ${maxPass}`);
  lines.push('');
  lines.push(`**By status:** ${byStatus.map(([k, v]) => `\`${k}\` ${v}`).join(' · ')}`);
  lines.push(`**By tier:** ${byTier.map(([k, v]) => `\`${k}\` ${v}`).join(' · ')}`);
  lines.push(`**By depth:** ${byDepth.map(([k, v]) => `\`d${k}\` ${v}`).join(' · ')}`);
  lines.push('');

  lines.push(`**Per-root activity** (most-recently active first, top ${args.topRoots} of ${rootRows.length}):`);
  lines.push('');
  lines.push('| Root | Nodes | Max depth | Status mix | Last activity |');
  lines.push('|---|---:|---:|---|---|');
  for (const r of rootRows.slice(0, args.topRoots)) {
    const isoShort = r.lastActivity.slice(11, 19);   // HH:MM:SS
    lines.push(`| \`${r.rootId}\` | ${r.total} | ${r.maxDepth} | ${r.statusMix} | ${isoShort} |`);
  }
  if (rootRows.length > args.topRoots) {
    lines.push(`| _… ${rootRows.length - args.topRoots} more roots not shown_ | | | | |`);
  }

  return { kind, total: kindNodes.length, lines, byRoot, rootRows };
}

const frNodes = nodes.filter((n) => n.root_kind === 'fr');
const nfrNodes = nodes.filter((n) => n.root_kind === 'nfr');

// "Roots untouched" — depth-0 nodes whose node_id is not referenced as
// the root_fr_id by any descendant. Returns display_keys for readability.
function untouchedRoots(kindNodes) {
  const roots = kindNodes.filter((n) => n.depth === 0);
  const rootsWithChildren = new Set();
  for (const n of kindNodes) {
    if (n.depth > 0 && n.root_fr_id) rootsWithChildren.add(n.root_fr_id);
  }
  return roots
    .filter((r) => !rootsWithChildren.has(r.node_id))
    .map((r) => r.display_key);
}

// Recent activity: last N nodes by produced_at (across both kinds).
const recent = [...nodes]
  .sort((a, b) => b.produced_at.localeCompare(a.produced_at))
  .slice(0, args.recentN);

// Activity rate: nodes/minute over last 5 min.
const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
const recentWindow = nodes.filter((n) => n.produced_at >= cutoff);
const ratePerMin = (recentWindow.length / 5).toFixed(1);

// ── Render ───────────────────────────────────────────────────────────

const out = [];
out.push(`# Phase 2 Decomposition Progress — ${workspaceLabel}`);
out.push('');
out.push(`_Generated ${new Date().toISOString()} · DB: \`${dbPath}\`_`);
out.push(`_Workflow run: \`${wfRun.id}\` · Status: \`${wfRun.status}\` · Current phase: \`${wfRun.current_phase_id}/${wfRun.current_sub_phase_id ?? '-'}\`_`);
out.push('');
out.push(`**Telemetry from workflow_runs**`);
out.push(`- decomposition_budget_calls_used: ${wfRun.decomposition_budget_calls_used ?? 0}`);
out.push(`- decomposition_fr_calls_used: ${wfRun.decomposition_fr_calls_used ?? 0}`);
out.push(`- decomposition_nfr_calls_used: ${wfRun.decomposition_nfr_calls_used ?? 0}`);
out.push(`- decomposition_max_depth_reached: ${wfRun.decomposition_max_depth_reached ?? 0}`);
out.push('');
out.push(`**Activity over last 5 min:** ${recentWindow.length} nodes  (~${ratePerMin}/min)`);
out.push('');

if (args.kind !== 'nfr') {
  out.push('## Functional Requirements (FR)');
  out.push('');
  const fr = summarizeKind(frNodes, 'fr');
  out.push(...fr.lines);
  out.push('');
  const fruntouched = untouchedRoots(frNodes);
  if (fruntouched.length > 0) {
    out.push(`**Roots untouched (no descendants written):** ${fruntouched.length} — ${fruntouched.slice(0, 8).map(s => `\`${s}\``).join(', ')}${fruntouched.length > 8 ? ', …' : ''}`);
    out.push('');
  }
}

if (args.kind !== 'fr') {
  out.push('## Non-Functional Requirements (NFR)');
  out.push('');
  const nfr = summarizeKind(nfrNodes, 'nfr');
  out.push(...nfr.lines);
  out.push('');
  const nfruntouched = untouchedRoots(nfrNodes);
  if (nfruntouched.length > 0) {
    out.push(`**Roots untouched (no descendants written):** ${nfruntouched.length} — ${nfruntouched.slice(0, 8).map(s => `\`${s}\``).join(', ')}${nfruntouched.length > 8 ? ', …' : ''}`);
    out.push('');
  }
}

out.push(`## Recent activity (last ${recent.length} nodes produced)`);
out.push('');
out.push('| Time | Kind | Display key | Depth | Tier | Pass | Status |');
out.push('|---|---|---|---:|---|---:|---|');
for (const n of recent) {
  const t = n.produced_at.slice(11, 19);
  out.push(`| ${t} | ${n.root_kind} | \`${n.display_key}\` | ${n.depth} | ${n.tier ?? '-'} | ${n.pass_number} | ${n.status} |`);
}

console.log(out.join('\n'));
