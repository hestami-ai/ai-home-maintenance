#!/usr/bin/env node
/**
 * AODD trace CLI.
 *
 * Per design memo §8.3: read-side commands over `.janumicode/runs/<id>/aodd/`.
 *
 * Subcommands:
 *   aodd ls                                list runs in workspace
 *   aodd show <run_id> [--phase <id>] [--sub <id>]
 *   aodd events <run_id> [--type <type>] [--since <ts>] [--phase <id>] [--sub <id>]
 *   aodd trail <run_id> <event_id>         parent_event_id chain
 *   aodd caused-by <run_id> <event_id>     caused_by_event_id chain
 *   aodd payload <run_id> <payload_ref>    dump sidecar payload
 *   aodd grep <run_id> <pattern>           grep events + payloads
 *   aodd diff <run_a> <run_b>              structural diff of run summaries
 *   aodd keep <run_id>                     create .keep sentinel
 *   aodd prune [--dry-run]                 apply retention policy
 *   aodd capture <run_id> <scenario-name>  freeze run as regression fixture
 *
 * Status: all commands functional as of P9.
 *
 * Workspace detection: walks upward from cwd looking for a
 * `.janumicode/` directory; falls back to cwd. Override with
 * `--workspace <path>`.
 *
 * Exit codes:
 *   0 success
 *   2 CLI usage error
 *   3 no data (run not found, no runs in workspace, etc.)
 */
/* eslint-disable @typescript-eslint/no-require-imports, no-constant-condition */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ── Workspace detection ──────────────────────────────────────────────

function findWorkspaceRoot(start) {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, '.janumicode'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

// ── Arg parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return { command: 'help' };
  }
  const command = args[0];
  const positional = [];
  const flags = {};
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--workspace') flags.workspace = args[++i];
    else if (a === '--phase') flags.phase = args[++i];
    else if (a === '--sub') flags.sub = args[++i];
    else if (a === '--type') flags.type = args[++i];
    else if (a === '--since') flags.since = args[++i];
    else if (a === '--until') flags.until = args[++i];
    else if (a === '--invocation') flags.invocation = args[++i];
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--limit') flags.limit = Number.parseInt(args[++i], 10);
    else if (a === '--help' || a === '-h') flags.help = true;
    else if (a.startsWith('--')) {
      process.stderr.write(`error: unknown flag ${a}\n`);
      process.exit(2);
    } else {
      positional.push(a);
    }
  }
  return { command, positional, flags };
}

// ── Help ─────────────────────────────────────────────────────────────

function printHelp() {
  process.stdout.write(
    'usage: aodd <command> [args] [--workspace <path>]\n\n' +
      'commands:\n' +
      '  ls                            list runs in workspace, newest first\n' +
      '  show <run_id>                 print run summary markdown\n' +
      '    --phase <id>                  print summaries under that phase\n' +
      '    --sub <sub_phase_id>          print one sub-phase summary\n' +
      '  events <run_id>               stream events.ndjson lines\n' +
      '    --type <event_type>           filter by event type (repeatable)\n' +
      '    --since <ts>                  ISO8601 lower bound\n' +
      '    --until <ts>                  ISO8601 upper bound\n' +
      '    --phase <id>                  filter by phase_id\n' +
      '    --sub <id>                    filter by sub_phase_id\n' +
      '    --invocation <id>             filter by invocation_id\n' +
      '    --limit <N>                   stop after N matching events\n' +
      '  trail <run_id> <event_id>     parent_event_id chain (event → root)\n' +
      '  caused-by <run_id> <event_id> caused_by_event_id chain\n' +
      '  payload <run_id> <ulid>       dump sidecar payload (.json or .txt)\n' +
      '  grep <run_id> <pattern>       regex over events.ndjson + payload files\n' +
      '  diff <run_a> <run_b>          structural diff of run summaries\n' +
      '  keep <run_id>                 create .keep sentinel (never prune)\n' +
      '  prune [--dry-run]             apply retention policy\n' +
      '  capture <run_id> <scenario>   freeze a run as a regression fixture\n',
  );
}

// ── Path helpers ─────────────────────────────────────────────────────

function aoddDir(workspaceRoot, runId) {
  return path.join(workspaceRoot, '.janumicode', 'runs', runId, 'aodd');
}

function runDir(workspaceRoot, runId) {
  return path.join(workspaceRoot, '.janumicode', 'runs', runId);
}

function eventsPath(workspaceRoot, runId) {
  return path.join(aoddDir(workspaceRoot, runId), 'events.ndjson');
}

function phaseFilenameSegment(phaseId) {
  // Mirror phaseIdToFilenameSegment(id, { padded: false }) from
  // src/lib/aodd/idCanonicalize.ts. Replace '.' with '_'.
  return `phase${String(phaseId).split('.').join('_')}`;
}

function subPhaseFilenameSegment(subPhaseId) {
  return String(subPhaseId).replace(/\W/g, '_');
}

// ── Event reader (line-by-line) ──────────────────────────────────────

function* readEventLines(workspaceRoot, runId) {
  const filepath = eventsPath(workspaceRoot, runId);
  if (!fs.existsSync(filepath)) return;
  const raw = fs.readFileSync(filepath, 'utf8');
  for (const line of raw.split('\n')) {
    if (!line) continue;
    yield line;
  }
}

function eventPasses(event, flags) {
  if (flags.type && event.event_type !== flags.type) return false;
  if (flags.since && event.ts < flags.since) return false;
  if (flags.until && event.ts > flags.until) return false;
  if (flags.phase !== undefined && String(event.phase_id) !== String(flags.phase)) {
    return false;
  }
  if (flags.sub !== undefined && event.sub_phase_id !== flags.sub) return false;
  if (flags.invocation !== undefined && event.invocation_id !== flags.invocation) {
    return false;
  }
  return true;
}

// ── Commands ─────────────────────────────────────────────────────────

function cmdLs({ workspaceRoot }) {
  const runsRoot = path.join(workspaceRoot, '.janumicode', 'runs');
  if (!fs.existsSync(runsRoot)) {
    process.stderr.write(`no runs directory at ${runsRoot}\n`);
    return 3;
  }
  const rows = [];
  for (const entry of fs.readdirSync(runsRoot)) {
    const aodd = aoddDir(workspaceRoot, entry);
    if (!fs.existsSync(aodd)) continue;
    let started_at = '';
    let completed_at = '';
    let status = 'in_progress';
    let duration_ms = '';
    const idxFile = path.join(aodd, 'index.json');
    if (fs.existsSync(idxFile)) {
      try {
        const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
        started_at = idx.started_at || '';
        completed_at = idx.completed_at || '';
        status = idx.status || 'in_progress';
        if (started_at && completed_at) {
          const dur = Date.parse(completed_at) - Date.parse(started_at);
          if (Number.isFinite(dur)) duration_ms = String(dur);
        }
      } catch {
        // fall through
      }
    }
    const has_keep = fs.existsSync(path.join(aodd, '.keep'));
    rows.push({ entry, started_at, completed_at, status, duration_ms, has_keep });
  }
  if (rows.length === 0) {
    process.stderr.write('no AODD-traced runs found\n');
    return 3;
  }
  rows.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  process.stdout.write(
    'RUN_ID                               STATUS        STARTED                       DURATION  KEEP\n',
  );
  for (const r of rows) {
    process.stdout.write(
      `${r.entry.padEnd(36)} ${r.status.padEnd(13)} ${(r.started_at || '-').padEnd(29)} ${r.duration_ms.padStart(8)}  ${r.has_keep ? 'yes' : ''}\n`,
    );
  }
  return 0;
}

function cmdShow({ positional, flags, workspaceRoot }) {
  const runId = positional[0];
  if (!runId) {
    process.stderr.write('error: aodd show <run_id> required\n');
    return 2;
  }
  const summariesDir = path.join(aoddDir(workspaceRoot, runId), 'summaries');
  if (!fs.existsSync(summariesDir)) {
    process.stderr.write(`no summaries for run ${runId}\n`);
    return 3;
  }
  // --sub: print one sub-phase summary (md). Find the phase directory
  // automatically when --phase isn't supplied.
  if (flags.sub) {
    const subSeg = subPhaseFilenameSegment(flags.sub);
    const phaseDirs = flags.phase
      ? [phaseFilenameSegment(flags.phase)]
      : fs.readdirSync(summariesDir).filter((e) => e.startsWith('phase'));
    for (const ph of phaseDirs) {
      const candidate = path.join(summariesDir, ph, `${subSeg}.summary.md`);
      if (fs.existsSync(candidate)) {
        process.stdout.write(fs.readFileSync(candidate, 'utf8'));
        return 0;
      }
    }
    process.stderr.write(`no sub-phase summary "${flags.sub}" in run ${runId}\n`);
    return 3;
  }
  // --phase: print all sub-phase summaries under that phase, then the
  // phase row from run.summary.md if present.
  if (flags.phase) {
    const phaseSeg = phaseFilenameSegment(flags.phase);
    const phaseDir = path.join(summariesDir, phaseSeg);
    if (!fs.existsSync(phaseDir)) {
      process.stderr.write(
        `no summaries under phase ${flags.phase} in run ${runId}\n`,
      );
      return 3;
    }
    const files = fs.readdirSync(phaseDir).filter((f) => f.endsWith('.summary.md'));
    if (files.length === 0) {
      process.stderr.write(`no sub-phase summaries in phase ${flags.phase}\n`);
      return 3;
    }
    for (const f of files) {
      process.stdout.write(fs.readFileSync(path.join(phaseDir, f), 'utf8'));
      process.stdout.write('\n---\n\n');
    }
    return 0;
  }
  // No filter: print run.summary.md.
  const runMd = path.join(summariesDir, 'run.summary.md');
  if (!fs.existsSync(runMd)) {
    process.stderr.write(`no run.summary.md for ${runId}\n`);
    return 3;
  }
  process.stdout.write(fs.readFileSync(runMd, 'utf8'));
  return 0;
}

function cmdEvents({ positional, flags, workspaceRoot }) {
  const runId = positional[0];
  if (!runId) {
    process.stderr.write('error: aodd events <run_id> required\n');
    return 2;
  }
  let printed = 0;
  for (const line of readEventLines(workspaceRoot, runId)) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (!eventPasses(event, flags)) continue;
    process.stdout.write(line + '\n');
    printed += 1;
    if (flags.limit && printed >= flags.limit) break;
  }
  if (printed === 0) {
    process.stderr.write('no events matched\n');
    return 3;
  }
  return 0;
}

function loadAllEvents(workspaceRoot, runId) {
  const events = [];
  for (const line of readEventLines(workspaceRoot, runId)) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // skip
    }
  }
  return events;
}

function cmdChain({ positional, workspaceRoot }, edgeField) {
  const runId = positional[0];
  const eventId = positional[1];
  if (!runId || !eventId) {
    process.stderr.write(
      `error: aodd ${edgeField === 'parent_event_id' ? 'trail' : 'caused-by'} <run_id> <event_id> required\n`,
    );
    return 2;
  }
  const events = loadAllEvents(workspaceRoot, runId);
  const byId = new Map(events.map((e) => [e.event_id, e]));
  let current = byId.get(eventId);
  if (!current) {
    process.stderr.write(`event ${eventId} not found\n`);
    return 3;
  }
  let hops = 0;
  while (current && hops < 1000) {
    process.stdout.write(
      `${current.event_id}  ${current.event_type.padEnd(28)}  ${current.ts}` +
        (current.phase_id ? `  phase=${current.phase_id}` : '') +
        (current.sub_phase_id ? `  sub=${current.sub_phase_id}` : '') +
        '\n',
    );
    const next = current[edgeField];
    if (!next) break;
    current = byId.get(next);
    hops += 1;
  }
  return 0;
}

function cmdPayload({ positional, workspaceRoot }) {
  const runId = positional[0];
  const ulid = positional[1];
  if (!runId || !ulid) {
    process.stderr.write('error: aodd payload <run_id> <ulid> required\n');
    return 2;
  }
  const base = path.join(aoddDir(workspaceRoot, runId), 'payloads');
  for (const ext of ['json', 'txt']) {
    const p = path.join(base, `${ulid}.${ext}`);
    if (fs.existsSync(p)) {
      process.stdout.write(fs.readFileSync(p, 'utf8'));
      if (ext === 'text' || ext === 'txt') process.stdout.write('\n');
      return 0;
    }
  }
  process.stderr.write(`payload ${ulid} not found in run ${runId}\n`);
  return 3;
}

function cmdGrep({ positional, workspaceRoot }) {
  const runId = positional[0];
  const pattern = positional[1];
  if (!runId || !pattern) {
    process.stderr.write('error: aodd grep <run_id> <pattern> required\n');
    return 2;
  }
  let re;
  try {
    re = new RegExp(pattern);
  } catch (err) {
    process.stderr.write(`invalid regex: ${err.message}\n`);
    return 2;
  }
  let hits = 0;
  // 1. events.ndjson lines.
  for (const line of readEventLines(workspaceRoot, runId)) {
    if (re.test(line)) {
      process.stdout.write(`events.ndjson: ${line}\n`);
      hits += 1;
    }
  }
  // 2. payload files.
  const payloadsDir = path.join(aoddDir(workspaceRoot, runId), 'payloads');
  if (fs.existsSync(payloadsDir)) {
    for (const f of fs.readdirSync(payloadsDir)) {
      const p = path.join(payloadsDir, f);
      let content;
      try {
        content = fs.readFileSync(p, 'utf8');
      } catch {
        continue;
      }
      if (re.test(content)) {
        process.stdout.write(`payloads/${f}: matches\n`);
        hits += 1;
      }
    }
  }
  if (hits === 0) {
    process.stderr.write('no matches\n');
    return 3;
  }
  return 0;
}

function cmdKeep({ positional, workspaceRoot }) {
  const runId = positional[0];
  if (!runId) {
    process.stderr.write('error: aodd keep <run_id> required\n');
    return 2;
  }
  const aodd = aoddDir(workspaceRoot, runId);
  if (!fs.existsSync(aodd)) {
    process.stderr.write(`run ${runId} has no AODD directory\n`);
    return 3;
  }
  const sentinel = path.join(aodd, '.keep');
  fs.writeFileSync(sentinel, '', { encoding: 'utf8' });
  process.stdout.write(`marked ${runId} as keep-forever (created ${sentinel})\n`);
  return 0;
}

function notImplemented(name, phase) {
  process.stdout.write(
    `aodd ${name}: not implemented (lands in ${phase})\n`,
  );
  return 0;
}

function copyDirRecursive(src, dst) {
  if (!fs.existsSync(src)) {
    throw new Error(`source not found: ${src}`);
  }
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const sp = path.join(src, entry);
    const dp = path.join(dst, entry);
    const stat = fs.statSync(sp);
    if (stat.isDirectory()) {
      copyDirRecursive(sp, dp);
    } else {
      fs.copyFileSync(sp, dp);
    }
  }
}

function rewriteRunIdInEvents(eventsPath, fromId, toId) {
  // events.ndjson stores `run_id` per line. The fixture treats the
  // scenario name as the synthetic run_id, so rewrite each line.
  if (!fs.existsSync(eventsPath)) return;
  const raw = fs.readFileSync(eventsPath, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      const e = JSON.parse(line);
      if (e.run_id === fromId) e.run_id = toId;
      out.push(JSON.stringify(e));
    } catch {
      out.push(line);
    }
  }
  fs.writeFileSync(eventsPath, out.join('\n') + '\n', { encoding: 'utf8' });
}

function rewriteRunIdInJson(jsonPath, fromId, toId) {
  if (!fs.existsSync(jsonPath)) return;
  try {
    const obj = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (obj && obj.run_id === fromId) obj.run_id = toId;
    fs.writeFileSync(jsonPath, JSON.stringify(obj, null, 2), { encoding: 'utf8' });
  } catch {
    // skip malformed
  }
}

function cmdCapture({ positional, workspaceRoot }) {
  const runId = positional[0];
  const scenario = positional[1];
  if (!runId || !scenario) {
    process.stderr.write('error: aodd capture <run_id> <scenario> required\n');
    return 2;
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(scenario)) {
    process.stderr.write(
      `error: scenario name must be [a-z0-9][a-z0-9_-]* (got "${scenario}")\n`,
    );
    return 2;
  }
  const srcAodd = aoddDir(workspaceRoot, runId);
  if (!fs.existsSync(srcAodd)) {
    process.stderr.write(`run ${runId} has no AODD directory\n`);
    return 3;
  }
  // The fixtures directory is the regression test's home. Resolve
  // relative to this script's location so capture works regardless of
  // cwd at invocation time.
  const fixturesRoot = path.resolve(
    __dirname,
    '..',
    'src',
    'test',
    'regression',
    'aodd-fixtures',
  );
  const fixtureDir = path.join(fixturesRoot, scenario);
  if (fs.existsSync(fixtureDir)) {
    process.stderr.write(
      `error: fixture "${scenario}" already exists at ${fixtureDir}\n` +
        `       delete it manually if you intend to overwrite\n`,
    );
    return 2;
  }
  // The fixture lays out as <scenario>/aodd/ so the regression runner
  // can treat <scenario> as a workspace and the scenario name as the
  // synthetic run_id. To make that work, the captured aodd/ goes inside
  // a <scenario>/.janumicode/runs/<scenario>/aodd/ path mirroring the
  // production layout.
  const fixtureRunDir = path.join(
    fixtureDir,
    '.janumicode',
    'runs',
    scenario,
    'aodd',
  );
  copyDirRecursive(srcAodd, fixtureRunDir);
  // Rewrite run_id in events.ndjson and all *.json summary/index files
  // so the fixture is self-consistent under its scenario name.
  rewriteRunIdInEvents(path.join(fixtureRunDir, 'events.ndjson'), runId, scenario);
  rewriteRunIdInJson(path.join(fixtureRunDir, 'index.json'), runId, scenario);
  const summariesDir = path.join(fixtureRunDir, 'summaries');
  if (fs.existsSync(summariesDir)) {
    const walk = (d) => {
      for (const e of fs.readdirSync(d)) {
        const p = path.join(d, e);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.json')) rewriteRunIdInJson(p, runId, scenario);
      }
    };
    walk(summariesDir);
  }
  // Stub a manifest.json. The engineer is expected to hand-edit
  // `expected_sub_phases` and add spot_checks. The default expectations
  // reflect what was observed at capture time; future-edit before
  // committing the fixture.
  const stubManifest = {
    scenario,
    description: 'TODO: describe what this fixture captures',
    schema_version: 1,
    expected_sub_phases: [
      {
        phase_id: '__TODO__',
        sub_phase_id: '__TODO__',
        expected_status: 'success',
        must_answer_5wh: true,
      },
    ],
  };
  fs.writeFileSync(
    path.join(fixtureDir, 'manifest.json'),
    JSON.stringify(stubManifest, null, 2) + '\n',
    { encoding: 'utf8' },
  );
  process.stdout.write(
    `captured ${runId} → ${path.relative(process.cwd(), fixtureDir)}\n` +
      `  - aodd/ copied under .janumicode/runs/${scenario}/aodd/\n` +
      `  - run_id rewritten to "${scenario}"\n` +
      `  - manifest.json stubbed — edit expected_sub_phases before committing\n`,
  );
  return 0;
}

function cmdPrune({ flags, workspaceRoot }) {
  // Mirror the algorithm in src/lib/aodd/retention.ts. Plain JS so the
  // CLI doesn't take a TypeScript dependency. Defaults match
  // DEFAULT_RETENTION there.
  const config = {
    max_runs: 10,
    ttl_days: 30,
    min_runs: 3,
  };
  const runsRoot = path.join(workspaceRoot, '.janumicode', 'runs');
  if (!fs.existsSync(runsRoot)) {
    process.stderr.write(`no runs directory at ${runsRoot}\n`);
    return 3;
  }
  const runs = [];
  for (const entry of fs.readdirSync(runsRoot)) {
    const aoddPath = path.join(runsRoot, entry, 'aodd');
    if (!fs.existsSync(aoddPath)) continue;
    let startedMs = 0;
    let completedMs = null;
    const idxPath = path.join(aoddPath, 'index.json');
    if (fs.existsSync(idxPath)) {
      try {
        const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
        if (idx.started_at) {
          const v = Date.parse(idx.started_at);
          if (Number.isFinite(v)) startedMs = v;
        }
        if (idx.completed_at) {
          const v = Date.parse(idx.completed_at);
          if (Number.isFinite(v)) completedMs = v;
        }
      } catch {
        // fall through
      }
    }
    if (startedMs === 0) {
      try {
        startedMs = fs.statSync(aoddPath).mtime.getTime();
      } catch {
        // leave 0
      }
    }
    const hasKeep = fs.existsSync(path.join(aoddPath, '.keep'));
    runs.push({ runId: entry, aoddPath, sortKey: startedMs, completedAt: completedMs, hasKeep });
  }
  runs.sort((a, b) => b.sortKey - a.sortKey);

  const now = Date.now();
  const ttlMs = config.ttl_days * 24 * 60 * 60 * 1000;
  const candidates = [];
  const pruned = [];
  const keptBySentinel = [];

  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    if (i < config.min_runs) continue;
    const overCap = i >= config.max_runs;
    const completed = r.completedAt ?? r.sortKey;
    const overTtl = completed > 0 && now - completed > ttlMs;
    if (!overCap && !overTtl) continue;
    candidates.push(r.runId);
    if (r.hasKeep) {
      keptBySentinel.push(r.runId);
      continue;
    }
    if (flags.dryRun) continue;
    try {
      fs.rmSync(r.aoddPath, { recursive: true, force: true });
      pruned.push(r.runId);
    } catch (err) {
      process.stderr.write(`[aodd] WARN: failed to prune ${r.aoddPath}: ${err.message}\n`);
    }
  }

  if (flags.dryRun) {
    process.stdout.write(`dry-run: ${candidates.length} candidate(s)\n`);
    for (const id of candidates) {
      const sentinel = keptBySentinel.includes(id) ? ' [.keep — kept]' : '';
      process.stdout.write(`  ${id}${sentinel}\n`);
    }
  } else {
    process.stdout.write(
      `pruned ${pruned.length} of ${candidates.length} candidate(s); ${keptBySentinel.length} kept by .keep sentinel\n`,
    );
    for (const id of pruned) process.stdout.write(`  - ${id}\n`);
  }
  return 0;
}

function cmdDiff({ positional, workspaceRoot }) {
  const runA = positional[0];
  const runB = positional[1];
  if (!runA || !runB) {
    process.stderr.write('error: aodd diff <run_a> <run_b> required\n');
    return 2;
  }
  const summA = path.join(aoddDir(workspaceRoot, runA), 'summaries', 'run.summary.json');
  const summB = path.join(aoddDir(workspaceRoot, runB), 'summaries', 'run.summary.json');
  if (!fs.existsSync(summA)) {
    process.stderr.write(`no run summary for ${runA}\n`);
    return 3;
  }
  if (!fs.existsSync(summB)) {
    process.stderr.write(`no run summary for ${runB}\n`);
    return 3;
  }
  const a = JSON.parse(fs.readFileSync(summA, 'utf8'));
  const b = JSON.parse(fs.readFileSync(summB, 'utf8'));
  process.stdout.write(`# AODD run diff: ${runA} vs ${runB}\n\n`);
  process.stdout.write(`status:        ${a.status} → ${b.status}${a.status === b.status ? '' : '   *'}\n`);
  process.stdout.write(`duration_ms:   ${a.duration_ms} → ${b.duration_ms}\n`);
  process.stdout.write(`phases:        ${a.phases.length} → ${b.phases.length}\n`);
  process.stdout.write(`sub_phases:    ${a.totals.sub_phases} → ${b.totals.sub_phases}\n`);
  process.stdout.write(`llm_invocations: ${a.totals.llm_invocations} → ${b.totals.llm_invocations}\n`);
  process.stdout.write(`retries:       ${a.totals.retries} → ${b.totals.retries}\n`);
  process.stdout.write(`repairs:       ${a.totals.repairs} → ${b.totals.repairs}\n`);
  process.stdout.write(`escalations:   ${a.totals.escalations} → ${b.totals.escalations}\n`);
  process.stdout.write(`events:        ${a.totals.events} → ${b.totals.events}\n\n`);
  // Per-phase diff. Match on phase_id.
  const phaseIds = Array.from(
    new Set([...a.phases.map((p) => p.phase_id), ...b.phases.map((p) => p.phase_id)]),
  );
  process.stdout.write('## phase deltas\n');
  for (const pid of phaseIds) {
    const pa = a.phases.find((p) => p.phase_id === pid);
    const pb = b.phases.find((p) => p.phase_id === pid);
    if (!pa) {
      process.stdout.write(`  phase ${pid}: + (new in ${runB})\n`);
      continue;
    }
    if (!pb) {
      process.stdout.write(`  phase ${pid}: - (gone in ${runB})\n`);
      continue;
    }
    if (pa.status !== pb.status || pa.sub_phase_count !== pb.sub_phase_count) {
      process.stdout.write(
        `  phase ${pid}: status ${pa.status}→${pb.status}, subs ${pa.sub_phase_count}→${pb.sub_phase_count}\n`,
      );
    }
  }
  return 0;
}

const COMMANDS = {
  help: () => {
    printHelp();
    return 0;
  },
  ls: cmdLs,
  show: cmdShow,
  events: cmdEvents,
  trail: (ctx) => cmdChain(ctx, 'parent_event_id'),
  'caused-by': (ctx) => cmdChain(ctx, 'caused_by_event_id'),
  payload: cmdPayload,
  grep: cmdGrep,
  keep: cmdKeep,
  capture: cmdCapture,
  diff: cmdDiff,
  prune: cmdPrune,
};

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const parsed = parseArgs(process.argv);
  const handler = COMMANDS[parsed.command];
  if (!handler) {
    process.stderr.write(`error: unknown command "${parsed.command}"\n\n`);
    printHelp();
    process.exit(2);
  }
  // Explicit --workspace wins as-is. Only walk-up-to-find-.janumicode
  // when the user didn't tell us where to look (e.g. invoking from
  // somewhere inside a workspace tree).
  const workspaceRoot = parsed.flags?.workspace
    ? path.resolve(parsed.flags.workspace)
    : findWorkspaceRoot(process.cwd());
  const exitCode = handler({ ...parsed, workspaceRoot });
  process.exit(exitCode ?? 0);
}

main();
