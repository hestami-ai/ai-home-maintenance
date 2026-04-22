#!/usr/bin/env node
/**
 * Wave 6 calibration run orchestrator. One-command driver for:
 *
 *   1. Enabling decomposition.reasoning_review_on_tier_c at run time.
 *   2. Invoking the JanumiCode CLI against a provided intent (e.g.
 *      the Hestami spec) with product-lens routing.
 *   3. Extracting the FR and NFR decomposition trees into gold files.
 *   4. Printing a calibration summary: per-kind node counts, tier
 *      distribution, audit findings, termination reasons, and a
 *      verdict-tally of the Step 4c AC-shape audits.
 *
 * Usage:
 *   node scripts/wave6-calibration-run.js \
 *     --intent <path-to-intent.md> \
 *     [--workspace <path>]   # defaults to
 *                            # test-and-evaluation/calibration-workspaces/calibration-workspace-<tag>
 *     [--out-dir <path>]     # defaults to <workspace>/calibration-gold
 *     [--tag <tag>]          # suffix for gold file names, defaults to timestamp
 *     [--skip-run]           # skip the CLI run, extract from existing DB only
 *     [--budget-cap <N>]     # override decomposition.budget_cap for this run;
 *                            # pass a large number (e.g. 5000) to let
 *                            # saturation run to natural fixed-point instead
 *                            # of tripping the conservative 500 default.
 *
 * Environment variables the operator should set before running:
 *   OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY
 *     — the reasoning_review role's primary provider must have a live key.
 *   JANUMICODE_REQUIREMENTS_AGENT_BACKING=codex_cli (or claude_code_cli / gemini_cli)
 *     — which strong CLI backs Phase 2.1a / 2.2a.
 *
 * Exit codes:
 *   0 — run + extract + summary all succeeded; verdict printed
 *   1 — CLI run failed
 *   2 — extraction failed
 *   3 — no decomposition records found in the DB (unexpected for a
 *       product-lens run)
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function parseArgs(argv) {
  const out = { skipRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--intent') out.intent = argv[++i];
    else if (a === '--workspace') out.workspace = argv[++i];
    else if (a === '--out-dir') out.outDir = argv[++i];
    else if (a === '--tag') out.tag = argv[++i];
    else if (a === '--skip-run') out.skipRun = true;
    else if (a === '--budget-cap') out.budgetCap = Number.parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf-8').split('\n').slice(1, 30).join('\n'));
      process.exit(0);
    }
  }
  if (out.budgetCap != null && (!Number.isFinite(out.budgetCap) || out.budgetCap < 1)) {
    console.error('--budget-cap must be a positive integer');
    process.exit(2);
  }
  if (!out.skipRun && !out.intent) {
    console.error('--intent <path> is required unless --skip-run is set');
    process.exit(2);
  }
  out.tag = out.tag ?? new Date().toISOString().replace(/[:.]/g, '-');
  // When --workspace is omitted, auto-place the calibration workspace
  // under the repo's test-and-evaluation/ convention directory, keyed by
  // tag. Explicit --workspace still wins. Resolution is relative to the
  // repo root (two dirs up from scripts/).
  if (!out.workspace) {
    const repoRoot = path.resolve(__dirname, '..');
    out.workspace = path.join(
      repoRoot, 'test-and-evaluation', 'calibration-workspaces',
      `calibration-workspace-${out.tag}`,
    );
    console.error(`[calibration] --workspace not provided; defaulting to ${out.workspace}`);
  }
  out.outDir = out.outDir ?? path.join(out.workspace, 'calibration-gold');
  return out;
}

const args = parseArgs(process.argv);

// ── Step 1: enable the 4c flag in config ──────────────────────────

function patchConfigFlag(workspace) {
  const cfgPath = path.join(workspace, '.janumicode', 'config.json');
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
  let cfg = {};
  if (fs.existsSync(cfgPath)) {
    try {
      cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    } catch {
      console.error(`[calibration] existing config at ${cfgPath} is not valid JSON — aborting`);
      process.exit(2);
    }
  }
  cfg.decomposition = cfg.decomposition ?? {};
  cfg.decomposition.reasoning_review_on_tier_c = true;
  // Optional per-run override of the decomposer LLM-call budget. The
  // default in src/lib/config/defaults.ts (500) is a safety rail tuned
  // conservatively; calibration runs often want headroom to let
  // saturation reach natural fixed-point before auto-deferring the tail.
  // Pass e.g. `--budget-cap 5000` on large specs.
  if (args.budgetCap != null) {
    cfg.decomposition.budget_cap = args.budgetCap;
  }

  // Local-calibration LLM routing: reasoning_review runs on ollama with
  // gemma4:e4b (128K context, gemma sampling profile applied by the
  // ollama provider based on model name prefix). Production defaults in
  // src/lib/config/defaults.ts stay on google/gemini-2.5-flash so this
  // override does NOT leak beyond calibration workspaces. Deep-merge
  // behaviour in ConfigManager.loadConfig replaces only reasoning_review
  // while preserving the other role routes.
  cfg.llm_routing = cfg.llm_routing ?? {};
  cfg.llm_routing.reasoning_review = {
    primary: { provider: 'ollama', model: 'gemma4:e4b' },
    temperature: 1,
    trace_max_tokens: 8000,
  };

  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  console.error(`[calibration] enabled decomposition.reasoning_review_on_tier_c in ${cfgPath}`);
  console.error(`[calibration] routed reasoning_review → ollama/gemma4:e4b (local calibration override)`);
  if (args.budgetCap != null) {
    console.error(`[calibration] decomposition.budget_cap override = ${args.budgetCap}`);
  }
}

// ── Step 2: invoke the CLI ────────────────────────────────────────

function invokeCli(intent, workspace) {
  const cliPath = path.join(__dirname, '..', 'dist', 'cli', 'janumicode.js');
  if (!fs.existsSync(cliPath)) {
    console.error(`[calibration] CLI not built at ${cliPath}; run 'node esbuild.js' first`);
    process.exit(1);
  }
  // Intent is a string. If the operator passes a file path we expand it
  // to its contents; otherwise we pass through. Matches the CLI's own
  // @filepath convention documented in --help.
  let intentArg = intent;
  if (fs.existsSync(intent) && fs.statSync(intent).isFile()) {
    intentArg = fs.readFileSync(intent, 'utf-8');
  }
  console.error(`[calibration] invoking CLI  workspace=${workspace}  intent=${intentArg.slice(0, 80).replace(/\n/g, ' ')}…`);
  const result = spawnSync(
    process.execPath,
    [cliPath, 'run', '--intent', intentArg, '--workspace', workspace, '--llm-mode', 'real', '--auto-approve'],
    { stdio: 'inherit', env: process.env },
  );
  if (result.status !== 0) {
    console.error(`[calibration] CLI exited with status ${result.status}`);
    process.exit(1);
  }
}

// ── Step 3: extract gold ──────────────────────────────────────────

function extractGold(workspace, outDir, tag) {
  const db = path.join(workspace, '.janumicode', 'governed_stream.db');
  if (!fs.existsSync(db)) {
    console.error(`[calibration] no governed stream DB at ${db}`);
    process.exit(3);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const outFr = path.join(outDir, `product_fr_decomposition.${tag}.gold.json`);
  const outNfr = path.join(outDir, `product_nfr_decomposition.${tag}.gold.json`);
  const extractPath = path.join(__dirname, 'extract-phase2-decomposition.js');
  const result = spawnSync(
    process.execPath,
    [extractPath, '--db', db, '--out-fr', outFr, '--out-nfr', outNfr],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error(`[calibration] extraction exited with status ${result.status}`);
    process.exit(2);
  }
  return { outFr, outNfr };
}

// ── Step 4: calibration summary ────────────────────────────────────

function printSummary(outFr, outNfr) {
  const summaries = [];
  for (const p of [outFr, outNfr]) {
    if (!fs.existsSync(p)) continue;
    const gold = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const s = {
      root_kind: gold.root_kind,
      telemetry: gold.telemetry,
      passes: (gold.nodes ?? []).length > 0 ? inferPassCount(gold) : 0,
      audit_records: (gold.audit_records ?? []).length,
      audit_verdicts: tallyAuditVerdicts(gold.audit_records ?? []),
    };
    summaries.push(s);
  }

  console.log('\n==== Wave 6 calibration-run summary ====');
  for (const s of summaries) {
    console.log(`\n[${s.root_kind.toUpperCase()} tree]`);
    console.log(`  total_nodes: ${s.telemetry.total_nodes}`);
    console.log(`  atomic_leaves: ${s.telemetry.atomic_leaves}`);
    console.log(`  pruned/downgraded/deferred: ${s.telemetry.pruned}/${s.telemetry.downgraded}/${s.telemetry.deferred}`);
    console.log(`  tier distribution: A=${s.telemetry.by_tier.A}  B=${s.telemetry.by_tier.B}  C=${s.telemetry.by_tier.C}  D=${s.telemetry.by_tier.D}  root=${s.telemetry.by_tier.root}`);
    console.log(`  passes: ${s.passes}`);
    console.log(`  audit records: ${s.audit_records}  (verification=${s.audit_verdicts.verification} / policy=${s.audit_verdicts.policy} / ambiguous=${s.audit_verdicts.ambiguous})`);
  }
  console.log('\nNext steps:');
  console.log('  1. Review audit records with verdict=policy → are they real mislabels? (precision check)');
  console.log('  2. Sample ~10 verdict=verification findings → did the audit miss any? (recall check)');
  console.log('  3. See docs/wave6_reasoning_review_calibration.md for the full decision matrix.');
}

function inferPassCount(gold) {
  return (gold.assumption_snapshots ?? []).length;
}

function tallyAuditVerdicts(audits) {
  const tally = { verification: 0, policy: 0, ambiguous: 0 };
  for (const a of audits) {
    for (const f of a.findings ?? []) {
      if (tally[f.verdict] !== undefined) tally[f.verdict]++;
    }
  }
  return tally;
}

// ── Driver ─────────────────────────────────────────────────────────

if (!args.skipRun) {
  patchConfigFlag(args.workspace);
  invokeCli(args.intent, args.workspace);
}
const { outFr, outNfr } = extractGold(args.workspace, args.outDir, args.tag);
printSummary(outFr, outNfr);
