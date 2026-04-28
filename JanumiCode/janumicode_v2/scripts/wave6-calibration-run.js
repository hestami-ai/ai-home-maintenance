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
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawnSync, spawn } = require('node:child_process');

// `/tmp` doesn't reliably exist on Windows — Node's fs APIs accept
// the literal path but writes silently land somewhere unhelpful.
// Use the OS-portable temp dir for log files so operators can find
// them via `%TEMP%` / `$TMPDIR` regardless of platform.
const TMP_DIR = os.tmpdir();

// ── llama-swap proxy lifecycle ────────────────────────────────────
//
// llama-swap is an OpenAI-compatible proxy. It listens on ONE port and
// lazy-loads/evicts llama-server child processes based on the `model`
// field in each request. Concurrent VRAM-resident models share SMs
// anyway (no compute parallelism), so swap-on-demand is the right
// architecture even when two models would technically fit at once.
//
// Config lives next to this script (scripts/llama-swap-config.yaml)
// and declares every model key that JanumiCode might reference. To
// add a new model: add to the yaml + reference it in workspace
// llm_routing.<role>.primary.model. The proxy port stays constant.
//
// llama-swap binary path can be overridden via JANUMICODE_LLAMA_SWAP_BIN.
// Default is the typical winget install location on Windows.
const LLAMA_SWAP_BIN = process.env.JANUMICODE_LLAMA_SWAP_BIN
  ?? 'C:/Users/mchen/AppData/Local/Microsoft/WinGet/Packages/mostlygeek.llama-swap_Microsoft.Winget.Source_8wekyb3d8bbwe/llama-swap.exe';
const LLAMA_SWAP_CONFIG = path.join(__dirname, 'llama-swap-config.yaml');

/**
 * Start the llama-swap proxy. Returns a handle the caller awaits via
 * waitForLlamaSwap() and tears down via stopLlamaSwap(). Stdout/stderr
 * are captured to /tmp so a misconfigured proxy is debuggable without
 * losing the calibration script's own output.
 *
 * The proxy itself starts in milliseconds — heavy lifting (model load
 * into VRAM) only happens on the first request that names a given
 * model, and is bounded by healthCheckTimeout in the yaml.
 */
function startLlamaSwap(port) {
  if (!fs.existsSync(LLAMA_SWAP_BIN)) {
    throw new Error(`llama-swap binary not found at ${LLAMA_SWAP_BIN}; set JANUMICODE_LLAMA_SWAP_BIN`);
  }
  if (!fs.existsSync(LLAMA_SWAP_CONFIG)) {
    throw new Error(`llama-swap config not found at ${LLAMA_SWAP_CONFIG}`);
  }
  const logPath = path.join(TMP_DIR, `llama-swap-${port}.log`);
  const logFd = fs.openSync(logPath, 'w');
  const argv = [
    '-config', LLAMA_SWAP_CONFIG,
    '-listen', `127.0.0.1:${port}`,
  ];
  console.error(`[calibration] starting llama-swap  port=${port}  config=${LLAMA_SWAP_CONFIG}`);
  console.error(`[calibration]   log=${logPath}`);
  const child = spawn(LLAMA_SWAP_BIN, argv, {
    stdio: ['ignore', logFd, logFd],
    detached: false,
  });
  child.on('error', (err) => {
    console.error(`[calibration] llama-swap spawn error: ${err.message}`);
  });
  return {
    child,
    baseUrl: `http://127.0.0.1:${port}`,
    logPath,
  };
}

/**
 * Poll /health until ready. llama-swap responds fast once it boots —
 * the slow part is the per-model child process spawning, which only
 * happens on first request to that model.
 */
async function waitForLlamaSwap(baseUrl, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await healthProbe(baseUrl).catch(() => false);
    if (ok) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`llama-swap at ${baseUrl} never became ready within ${timeoutMs}ms`);
}

function healthProbe(baseUrl) {
  return new Promise((resolve) => {
    const req = http.get(`${baseUrl}/health`, (res) => {
      // llama-swap returns 200 once its config has loaded. Body shape
      // doesn't match llama-server's `{status:"ok"}` exactly, so
      // accept any 2xx as "proxy ready" — the per-model health is
      // re-probed by llama-swap itself before each request anyway.
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(res.statusCode !== undefined && res.statusCode < 400));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

/**
 * Stop llama-swap and any child llama-server processes it spawned.
 *
 * Windows is the operative concern: `child.kill('SIGTERM')` only
 * signals the direct child (llama-swap), and Windows doesn't
 * automatically cascade to grandchildren the way Unix process groups
 * do. Result: orphaned llama-server processes survive past run end,
 * holding ~18 GB of VRAM each. We hit this on cal-22b resume — an
 * orphaned llama-server from a prior run was stealing GPU bandwidth
 * from the active one, dropping utilization from ~92% to 16%.
 *
 * Fix: use `taskkill /F /T /PID <pid>` on Windows. The /T flag
 * cascades to descendants, /F forces termination. On non-Windows we
 * keep the SIGTERM/SIGKILL pattern since Unix child-of-shell already
 * handles that cleanly.
 */
async function stopLlamaSwap(handle) {
  if (!handle?.child || handle.child.exitCode !== null) return;
  const port = handle.baseUrl.split(':').pop();
  console.error(`[calibration] stopping llama-swap  port=${port}  pid=${handle.child.pid}`);
  if (process.platform === 'win32') {
    // Cascade-kill llama-swap + every llama-server it spawned.
    spawnSync('taskkill', ['/F', '/T', '/PID', String(handle.child.pid)], { stdio: 'ignore' });
  } else {
    handle.child.kill('SIGTERM');
    const killTimer = setTimeout(() => {
      if (handle.child.exitCode === null) handle.child.kill('SIGKILL');
    }, 5000);
    await new Promise((resolve) => {
      if (handle.child.exitCode !== null) return resolve();
      handle.child.once('exit', resolve);
    });
    clearTimeout(killTimer);
  }
}

function printHelpAndExit() {
  console.log(fs.readFileSync(__filename, 'utf-8').split('\n').slice(1, 30).join('\n'));
  process.exit(0);
}

// Dispatch table for parseArgs. `consumesValue` says whether the flag
// is followed by a positional value; the parse function reads that
// value (or just sets a boolean) and writes into `out`. Lifted out of
// parseArgs's loop so SonarLint's cognitive-complexity counter stays
// in budget — the previous if/else cascade hit 18 (limit 15).
const ARG_HANDLERS = {
  '--intent':                    { consumesValue: true,  apply: (out, v) => { out.intent = v; } },
  '--workspace':                 { consumesValue: true,  apply: (out, v) => { out.workspace = v; } },
  '--out-dir':                   { consumesValue: true,  apply: (out, v) => { out.outDir = v; } },
  '--tag':                       { consumesValue: true,  apply: (out, v) => { out.tag = v; } },
  '--skip-run':                  { consumesValue: false, apply: (out)    => { out.skipRun = true; } },
  '--budget-cap':                { consumesValue: true,  apply: (out, v) => { out.budgetCap = Number.parseInt(v, 10); } },
  '--llama-swap':                { consumesValue: false, apply: (out)    => { out.llamaSwap = true; } },
  '--llama-swap-port':           { consumesValue: true,  apply: (out, v) => { out.llamaSwapPort = Number.parseInt(v, 10); } },
  '--llamacpp-decomposer-model': { consumesValue: true,  apply: (out, v) => { out.decomposerModel = v; } },
  '--llamacpp-reviewer-model':   { consumesValue: true,  apply: (out, v) => { out.reviewerModel = v; } },
  '--help':                      { consumesValue: false, apply: ()       => { printHelpAndExit(); } },
  '-h':                          { consumesValue: false, apply: ()       => { printHelpAndExit(); } },
};

function parseArgs(argv) {
  const out = { skipRun: false };
  let i = 2;
  while (i < argv.length) {
    const h = ARG_HANDLERS[argv[i]];
    if (h?.consumesValue) { h.apply(out, argv[i + 1]); i += 2; }
    else if (h) { h.apply(out); i += 1; }
    else { i += 1; }
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

  cfg.llm_routing = cfg.llm_routing ?? {};

  if (args.llamaSwap) {
    // Fully-local calibration mode: every planning role routes through
    // llama-swap on a single port. The proxy is one OpenAI-compatible
    // endpoint that lazy-loads child llama-server processes per
    // requested `model` field. JanumiCode call sites only differ in
    // the model name; base_url stays the same across all roles.
    //
    // Role → model assignment:
    //   orchestrator (Phase 1.0 intent quality)        → reviewer (gemma)
    //   domain_interpreter (Phase 1 blooms + DMR)      → decomposer (qwen)
    //   requirements_agent (Phase 2.1a/2.2a recursion) → decomposer (qwen)
    //   reasoning_review (Phase 2.1a step 4c audits)   → reviewer (gemma)
    //
    // The qwen MoE has the capacity for the long-context decomposer
    // prompts; gemma's smaller footprint and Google sampling profile
    // suit the audit/quality-check work. Both keys must exist in
    // scripts/llama-swap-config.yaml.
    const port = args.llamaSwapPort ?? 11435;
    const baseUrl = `http://127.0.0.1:${port}`;
    const decomposerModel = args.decomposerModel ?? 'qwen3.5-35b-a3b';
    const reviewerModel = args.reviewerModel ?? 'gemma-4-e4b-it';
    const decomposerRouting = {
      backing_tool: 'direct_llm_api', provider: 'llamacpp',
      model: decomposerModel, base_url: baseUrl,
    };
    const reviewerRouting = {
      provider: 'llamacpp', model: reviewerModel, base_url: baseUrl,
    };
    cfg.llm_routing.orchestrator = {
      primary: { backing_tool: 'direct_llm_api', ...reviewerRouting },
      temperature: 0.3,
    };
    cfg.llm_routing.domain_interpreter = { primary: decomposerRouting, temperature: 1 };
    cfg.llm_routing.requirements_agent = { primary: decomposerRouting, temperature: 1 };
    cfg.llm_routing.reasoning_review = {
      primary: reviewerRouting,
      temperature: 1,
      trace_max_tokens: 8000,
    };
  } else {
    // Legacy default for non-llama-swap calibration: reasoning_review
    // pinned to ollama gemma4:e4b. Production defaults in defaults.ts
    // stay on google/gemini-2.5-flash; this override is workspace-local.
    cfg.llm_routing.reasoning_review = {
      primary: { provider: 'ollama', model: 'gemma4:e4b' },
      temperature: 1,
      trace_max_tokens: 8000,
    };
  }

  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  console.error(`[calibration] enabled decomposition.reasoning_review_on_tier_c in ${cfgPath}`);
  if (args.llamaSwap) {
    const port = args.llamaSwapPort ?? 11435;
    const dm = args.decomposerModel ?? 'qwen3.5-35b-a3b';
    const rm = args.reviewerModel ?? 'gemma-4-e4b-it';
    console.error(`[calibration] llama-swap @ :${port}  decomposer=${dm}  reviewer=${rm}`);
  } else {
    console.error(`[calibration] routed reasoning_review → ollama/gemma4:e4b (local calibration override)`);
  }
  if (args.budgetCap != null) {
    console.error(`[calibration] decomposition.budget_cap override = ${args.budgetCap}`);
  }
}

// ── Step 2: invoke the CLI ────────────────────────────────────────

function invokeCli(intent, workspace, llamacppBaseUrl) {
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
  // Thread LLAMACPP_URL into the spawned env so the LlamaCppProvider's
  // constructor default points at our llama-server. Per-role base_url
  // in llm_routing wins per call (already wired above), but the env
  // var keeps any call sites that don't yet forward base_url
  // working — they hit the same endpoint via the constructor default.
  const childEnv = { ...process.env };
  if (llamacppBaseUrl) {
    childEnv.LLAMACPP_URL = llamacppBaseUrl;
    // Also route the EmbeddingService through llama-swap so we have
    // ONE backend for chat + embeddings. Otherwise the embedding
    // service silently keeps using Ollama (its default), running
    // qwen3-embedding:8b in parallel and stealing 5-8 GB of VRAM
    // from the active chat model — exactly the bug cal-22b hit
    // (Ollama qwen3-embedding eating ~7.8 GB while llama-swap qwen
    // tried to fit too).
    childEnv.JANUMICODE_EMBED_PROVIDER = 'llamacpp';
    childEnv.JANUMICODE_EMBED_MODEL = 'qwen3-embedding-8b';
    childEnv.JANUMICODE_EMBED_BASE_URL = llamacppBaseUrl;
  }
  // Calibration runs are unattended by definition — the orchestrator
  // is the human surrogate, reasoning_review is the audit. Flip the
  // executor into fully-skip-permissions mode so the agent can run
  // Bash to verify its own work (`node --test`, `python -m pytest`,
  // etc.) without sandbox-blocking every command. Production CLI / VS
  // Code use cases leave this unset so permission requests still
  // surface to the human as designed.
  //
  // cal-22b symptom: the executor wrote 4 files, then was blocked
  // trying to verify with `node --test`, claimed success without
  // proof, and reasoning_review (correctly) flagged it as
  // `completeness_shortcut`.
  childEnv.JANUMICODE_EXECUTOR_UNATTENDED = '1';
  console.error(`[calibration] invoking CLI  workspace=${workspace}  intent=${intentArg.slice(0, 80).replace(/\n/g, ' ')}…`);
  const result = spawnSync(
    process.execPath,
    [cliPath, 'run', '--intent', intentArg, '--workspace', workspace, '--llm-mode', 'real', '--auto-approve'],
    { stdio: 'inherit', env: childEnv },
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

/**
 * Run the calibration end-to-end with optional llama-server lifecycle.
 * The async wrapper exists because waitForLlamaServer / stopLlamaServer
 * are async; the rest of the pipeline (config patch + spawnSync CLI +
 * extract + summary) is synchronous and unchanged.
 *
 * Cleanup invariant: when --llamacpp-model is set, llama-server is
 * always shut down before exit, even on an exception path. SIGINT
 * (Ctrl+C) is also wired so a manual abort doesn't leak the GPU
 * memory of a running server.
 */
async function main() {
  let swapHandle = null;
  const cleanup = async () => {
    if (swapHandle) {
      const h = swapHandle;
      swapHandle = null;
      await stopLlamaSwap(h);
    }
  };
  process.on('SIGINT', () => { cleanup().finally(() => process.exit(130)); });
  process.on('SIGTERM', () => { cleanup().finally(() => process.exit(143)); });

  try {
    let llamacppBaseUrl = null;
    if (!args.skipRun && args.llamaSwap) {
      const port = args.llamaSwapPort ?? 11435;
      swapHandle = startLlamaSwap(port);
      llamacppBaseUrl = swapHandle.baseUrl;
      console.error(`[calibration] waiting for llama-swap /health at ${llamacppBaseUrl}`);
      await waitForLlamaSwap(llamacppBaseUrl);
      console.error(`[calibration] llama-swap ready`);
    }

    if (!args.skipRun) {
      patchConfigFlag(args.workspace);
      invokeCli(args.intent, args.workspace, llamacppBaseUrl);
    }
    const { outFr, outNfr } = extractGold(args.workspace, args.outDir, args.tag);
    printSummary(outFr, outNfr);
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error(`[calibration] fatal: ${err.message}`);
  process.exit(1);
});
