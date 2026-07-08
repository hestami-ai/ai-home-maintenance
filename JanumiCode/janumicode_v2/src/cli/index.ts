#!/usr/bin/env node
/**
 * JanumiCode CLI Entry Point
 *
 * Headless workflow execution via the canonical ClientLiaisonAgent path.
 * Supports:
 *   - Intent from command line string or @filepath reference
 *   - Mock or real LLM mode
 *   - Auto-approve or decision overrides
 *   - Gap report output
 *
 * Usage:
 *   janumicode run --intent "Build a CLI todo app" --workspace . --llm-mode mock --auto-approve
 *   janumicode run --intent @specs/feature.md --workspace . --llm-mode mock --auto-approve --gap-report gap.json
 */

import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { runPipeline } from './runner';
import { loadDotenv } from '../lib/config/dotenv';
import type { PipelineRunnerConfig } from '../test/harness/types';

/**
 * Ancestor-watcher: capture the full parent-PID chain at startup, then
 * poll all ancestors and self-exit when ANY of them dies.
 *
 * Motivation: on Windows the canonical launch path is a multi-level
 * bash chain (`bash -c "... bash run-harness.sh ..."` → `bash
 * init-thin-slice.sh` → `node ...`). When a TaskStop-style killer
 * uses TerminateProcess on a shell partway up the chain, intermediate
 * bashes do NOT die — they remain as orphans with `wait $!` blocking
 * on the node child. Watching only `process.ppid` misses this:
 * node's direct parent (the innermost bash) is still alive even
 * though everything above it died.
 *
 * The right invariant: if any ancestor died, the launch tree is
 * compromised and node should exit. node exiting wakes the
 * intermediate bashes (their `wait $!` returns), so they exit too,
 * and the chain collapses bottom-up.
 *
 * Walking the parent chain on Windows requires spawning wmic, which
 * is slow — so we do it once at startup and cache the chain. Polling
 * is then cheap `process.kill(pid, 0)` on each cached PID.
 *
 * Disable via `JANUMICODE_PARENT_WATCHER=off` for detached scenarios.
 */
function installParentWatcher(): void {
  if (process.env.JANUMICODE_PARENT_WATCHER === 'off') return;
  const ancestors = captureAncestorChain(process.ppid);
  if (ancestors.length === 0) return;

  const intervalMs = Number.parseInt(process.env.JANUMICODE_PARENT_WATCHER_INTERVAL_MS ?? '3000', 10);
  process.stderr.write(`[parent-watcher] watching ancestor chain: ${ancestors.join(', ')}\n`);
  const handle = setInterval(() => {
    for (const pid of ancestors) {
      try {
        process.kill(pid, 0);
      } catch {
        process.stderr.write(`[parent-watcher] ancestor pid=${pid} gone; exiting (143)\n`);
        process.exit(143);
      }
    }
  }, intervalMs);
  handle.unref();
}

/**
 * Walk the parent-PID chain from `startPpid` upward, returning the
 * list of ancestor PIDs (skipping PID 1/0 which represent the kernel).
 * Stops on first failure (parent already gone, query failed, etc.).
 * Capped at 8 levels to bound startup cost and avoid pathological
 * recursive cases.
 */
function captureAncestorChain(startPpid: number | undefined): number[] {
  if (!startPpid || startPpid <= 1) return [];
  const chain: number[] = [];
  let cur = startPpid;
  for (let i = 0; i < 8; i++) {
    try {
      process.kill(cur, 0);
    } catch {
      break;
    }
    chain.push(cur);
    const ppid = lookupParentPid(cur);
    if (!ppid || ppid <= 1 || chain.includes(ppid)) break;
    cur = ppid;
  }
  return chain;
}

/**
 * Look up the parent PID of `pid`. Cross-platform implementation that
 * uses /proc on Linux and wmic on Windows. Returns null on any failure
 * (which causes the caller to stop walking — the caught ancestors so
 * far are still watched).
 */
function lookupParentPid(pid: number): number | null {
  // Linux fast path.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    const statText = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    // /proc/<pid>/stat: pid (comm) state ppid ...
    // comm may contain spaces+parens; find the last ')' and split after it.
    const rparen = statText.lastIndexOf(')');
    if (rparen > 0) {
      const after = statText.slice(rparen + 2).split(' ');
      const ppid = Number.parseInt(after[1], 10);
      if (Number.isFinite(ppid)) return ppid;
    }
  } catch { /* not Linux, or pid gone */ }

  // Windows fallback via wmic. Synchronous spawnSync; only used at
  // startup so the overhead is bounded.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { spawnSync } = require('node:child_process') as typeof import('node:child_process');
    const res = spawnSync('wmic', ['process', 'where', `processid=${pid}`, 'get', 'parentprocessid', '/value'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    if (res.status === 0 && typeof res.stdout === 'string') {
      const m = /ParentProcessId=(\d+)/i.exec(res.stdout);
      if (m) return Number.parseInt(m[1], 10);
    }
  } catch { /* wmic missing or failed */ }
  return null;
}

// NOTE: installParentWatcher() is deliberately NOT called here at module
// scope. Its startup line writes to stderr, which would contaminate the
// bootstrap-error JSON envelope (also stderr) that machine consumers parse
// on exit 4. The watcher only matters during the long-running pipeline, so
// it is installed inside the `run` action AFTER bootstrap validation passes.

// Load .env BEFORE any subprocess could spawn. The Gemini CLI
// (Orchestrator backing), Claude Code (Phase 9 executor), and Ollama
// provider all read API keys from process.env — they see whatever is
// set when this Node process hands off to the child. The extension
// host does this in activate(); the CLI needs the same injection.
// `--workspace` points at the run's working dir; API keys live in the
// repo's own .env (alongside this entry point's compiled bundle).
loadDotenv(path.resolve(__dirname, '..', '..'));

const program = new Command();

program
  .name('janumicode')
  .description('JanumiCode v2 - AI agent-led software development')
  .version('2.0.0');

program
  .command('run')
  .description('Execute a workflow run in headless mode')
  .requiredOption('--intent <intent>', 'Intent string or @filepath reference')
  .requiredOption('--workspace <path>', 'Workspace root path')
  .option('--llm-mode <mode>', 'LLM mode: mock or real', 'mock')
  .option('--auto-approve', 'Auto-approve all decisions', false)
  .option('--phase-limit <phase>', 'Stop after completing this phase')
  .option('--fixture-dir <path>', 'Directory containing LLM fixtures for mock mode')
  .option('--gap-report <path>', 'Output gap report to file on failure')
  .option('--decision-overrides <json>', 'JSON object mapping sub-phase IDs to menu selections')
  .option('--capture-fixtures', 'Capture LLM calls as fixture JSON files (requires --llm-mode real)', false)
  .option('--capture-output-dir <path>', 'Directory to save captured fixtures')
  .option('--resume-from-db <path>', 'Resume from a prior run DB (skip bootstrapIntent)')
  .option('--resume-at-phase <phase>', 'Phase to resume at (requires --resume-from-db)')
  .option('--resume-at-sub-phase <sub-phase>', 'Sub-phase to resume at (requires --resume-from-db; takes precedence over --resume-at-phase). Triggers rollback of stale records at-or-after this sub-phase before re-execution.')
  .option('--resume-reset-cycles', 'On resume, zero the run\'s cycle counter so Phase 6/7/8 run their FULL execute() path (full regeneration + gatekeepers) instead of the incremental cycle-delta path. Use when a fix must be exercised through the main generator, not just failure-seed orphans (e.g. a Phase-7 gatekeeper change).', false)
  .option('--thin-slice', 'Constrain decomposition (depth=2, fanout=1, ~2 roots per kind, all reasoning_review on) so every prompt template fires end-to-end in hours, not days. Used for prompt-template validation.', false)
  .option('--full-slice', 'Implement the ENTIRE intent (no decomposition caps) but KEEP the headless operational rails the thin-slice mode uses: 60-min records-idle stall window, forced goose_cli executor, 30-min per-call cap. For a real end-to-end build rather than template iteration.', false)
  .option('--simulate-human-decisions', 'In headless auto-approve runs, certify each phase gate through the real approval path (phase_gate_approved + validates edges → Authority-6 elevation) so the Deep Memory Research agent\'s active_constraints accumulation is exercised instead of staying dormant.', false)
  .option('--inject-overrides <json>', 'JSON array of scripted prior_decision_override injections (semantic-supersession exerciser). Each: {afterPhase, superseded:{recordType,contentMatch?,scope?}, superseding?:{statement,kind}|selector}. For a cross-run chain, run twice against the same workspace DB.')
  .option('--db-path <path>', 'Explicit DB path (absolute, or relative to the workspace test-harness dir). Reuses the DB if it exists (appends a fresh workflow run) so a second run shares the first run\'s records for all_runs DMR scope. Mutually exclusive with --resume-from-db.')
  .option('--json', 'Emit the full HarnessResult as JSON on stdout instead of the human banner. Intended for virtuous-cycle coding agents that parse the result programmatically.', false)
  .option('--llm-gap-enhance', 'Call an LLM to produce a grounded suggested_fix on the gap report. Opt-in: adds one LLM call per failed run.', false)
  .option('--llm-gap-provider <provider>', 'Provider for --llm-gap-enhance. When omitted, the runner uses the workspace orchestrator routing.')
  .option('--llm-gap-model <model>', 'Model for --llm-gap-enhance. When omitted, the runner uses the workspace orchestrator routing.')
  .action(async (options: { intent: string; workspace: string; llmMode: string; autoApprove: boolean; phaseLimit?: string; fixtureDir?: string; gapReport?: string; decisionOverrides?: string; captureFixtures?: boolean; captureOutputDir?: string; resumeFromDb?: string; resumeAtPhase?: string; resumeAtSubPhase?: string; resumeResetCycles?: boolean; thinSlice?: boolean; fullSlice?: boolean; simulateHumanDecisions?: boolean; injectOverrides?: string; dbPath?: string; json?: boolean; llmGapEnhance?: boolean; llmGapProvider?: string; llmGapModel?: string }) => {
    // When JSON output is requested, redirect INFO/DEBUG logs to stderr
    // via the logging handler's env-controlled switch. Otherwise stdout
    // would carry both JSON and logger lines, and nothing downstream
    // could parse it. Must be set before any logger import resolves.
    if (options.json) process.env.JANUMICODE_LOG_TO_STDERR = '1';

    // Bootstrap validation (exit 4 = config/setup failure before we even
    // try to run the pipeline). Caught as early as possible so a bad
    // command line doesn't masquerade as a workflow exception.
    const workspacePath = path.resolve(options.workspace);
    if (!fs.existsSync(workspacePath)) {
      emitError(options.json, `Workspace path does not exist: ${workspacePath}`, 'bootstrap_error');
      process.exit(4);
    }
    if (options.resumeFromDb) {
      const dbPath = path.resolve(options.resumeFromDb);
      if (!fs.existsSync(dbPath)) {
        emitError(options.json, `Resume DB does not exist: ${dbPath}`, 'bootstrap_error');
        process.exit(4);
      }
      if (!options.resumeAtPhase && !options.resumeAtSubPhase) {
        emitError(options.json, '--resume-from-db requires --resume-at-phase or --resume-at-sub-phase', 'bootstrap_error');
        process.exit(4);
      }
    }
    let parsedOverrides: Record<string, unknown> | undefined;
    if (options.decisionOverrides) {
      try {
        parsedOverrides = JSON.parse(options.decisionOverrides);
      } catch (err) {
        emitError(options.json, `Invalid --decision-overrides JSON: ${(err as Error).message}`, 'bootstrap_error');
        process.exit(4);
      }
    }
    let parsedInjectOverrides: PipelineRunnerConfig['overrideInjections'] | undefined;
    if (options.injectOverrides) {
      try {
        parsedInjectOverrides = JSON.parse(options.injectOverrides);
      } catch (err) {
        emitError(options.json, `Invalid --inject-overrides JSON: ${(err as Error).message}`, 'bootstrap_error');
        process.exit(4);
      }
    }

    // Bootstrap validation passed — now install the ancestor watcher for
    // the long-running pipeline. Installed here (not at module scope) so
    // its stderr startup line can't contaminate the bootstrap-error JSON
    // envelope that exit-4 consumers parse from stderr.
    installParentWatcher();

    const config: PipelineRunnerConfig = {
      workspacePath,
      llmMode: options.llmMode as 'mock' | 'real',
      autoApprove: options.autoApprove,
      simulateHumanDecisions: options.simulateHumanDecisions,
      overrideInjections: parsedInjectOverrides,
      dbPath: options.dbPath,
      phaseLimit: options.phaseLimit,
      fixtureDir: options.fixtureDir ? path.resolve(options.fixtureDir) : undefined,
      decisionOverrides: parsedOverrides as PipelineRunnerConfig['decisionOverrides'],
      captureFixtures: options.captureFixtures,
      captureOutputDir: options.captureOutputDir ? path.resolve(options.captureOutputDir) : undefined,
      resumeFromDb: options.resumeFromDb ? path.resolve(options.resumeFromDb) : undefined,
      resumeAtPhase: options.resumeAtPhase,
      resumeAtSubPhase: options.resumeAtSubPhase,
      resumeResetCycles: options.resumeResetCycles,
      thinSlice: options.thinSlice,
      fullSlice: options.fullSlice,
      llmGapEnhance: options.llmGapEnhance
        ? {
            // Empty strings here signal "let the runner resolve from
            // workspace orchestrator routing." The runner fills these in
            // before invoking the gap-enhance LLM call.
            provider: options.llmGapProvider ?? '',
            model: options.llmGapModel ?? '',
          }
        : undefined,
    };

    try {
      const result = await runPipeline(options.intent, config);

      // Gap report is always written to file when requested, regardless
      // of --json mode. The --json flag controls stdout format only.
      if (options.gapReport && result.gapReport) {
        fs.writeFileSync(options.gapReport, JSON.stringify(result.gapReport, null, 2));
      }

      if (options.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      } else {
        printHumanResult(result, options.gapReport);
      }

      // Exit code mapping for the virtuous cycle:
      //   0 = success OR paused (paused is operator-initiated, not a failure)
      //   1 = partial OR failed (the normal "gap found, fix, rerun" signal)
      //   2 = runtime exception thrown by the pipeline (bug or infra)
      //   4 = bootstrap/config error caught above (never reaches here)
      if (result.status === 'success' || result.paused) process.exit(0);
      process.exit(1);
    } catch (err) {
      emitError(options.json, (err as Error).message ?? String(err), 'workflow_exception', err);
      process.exit(2);
    }
  });

/**
 * Emit an error in a shape that matches the chosen output mode. JSON
 * mode produces an object the virtuous-cycle consumer can parse;
 * human mode prints the familiar banner + stack to stderr.
 */
function emitError(
  json: boolean | undefined,
  message: string,
  kind: 'bootstrap_error' | 'workflow_exception',
  err?: unknown,
): void {
  if (json) {
    const payload: Record<string, unknown> = { error_type: kind, message };
    if (err instanceof Error && err.stack) payload.stack = err.stack;
    process.stderr.write(JSON.stringify(payload, null, 2) + '\n');
    return;
  }
  const banner = kind === 'bootstrap_error' ? '=== Bootstrap Error ===' : '=== Workflow Error ===';
  console.error(`\n${banner}`);
  console.error(message);
  if (err instanceof Error && err.stack) console.error(err.stack);
}

function printHumanResult(
  result: import('../test/harness/types').HarnessResult,
  gapReportPath: string | undefined,
): void {
  if (result.paused) {
    console.log('\n=== Workflow Paused ===');
    console.log(`Workflow run id: ${result.paused.workflow_run_id}`);
    console.log(`Paused at:       ${result.paused.paused_at}`);
    console.log(`Phases completed so far: ${result.phasesCompleted.join(', ')}`);
    console.log(`Resume with: janumicode run --resume-from-db <db> --resume-at-phase <phase>`);
    console.log(`DB path: ${result.governedStreamPath}`);
    return;
  }
  if (result.status === 'success') {
    console.log('\n=== Workflow Completed Successfully ===');
    console.log(`Phases completed: ${result.phasesCompleted.join(', ')}`);
    console.log(`Duration: ${result.durationMs}ms`);
    return;
  }
  if (result.status === 'partial') {
    console.log('\n=== Workflow Completed Partially ===');
    console.log(`Phases completed: ${result.phasesCompleted.join(', ')}`);
    console.log(`Phases failed: ${result.phasesFailed.join(', ')}`);
  } else {
    console.log('\n=== Workflow Failed ===');
    console.log(`Phases failed: ${result.phasesFailed.join(', ')}`);
  }
  if (result.gapReport?.failed_at_phase) {
    const sp = result.gapReport.failed_at_sub_phase
      ? `.${result.gapReport.failed_at_sub_phase}`
      : '';
    console.log(`First broken phase: ${result.gapReport.failed_at_phase}${sp}`);
  }
  if (result.semanticWarnings.length > 0) {
    console.log(`\nSemantic warnings: ${result.semanticWarnings.length}`);
    for (const w of result.semanticWarnings) {
      console.log(`  [${w.phase}.${w.subPhase}] ${w.field}: ${w.assertion}`);
    }
  }
  if (gapReportPath && result.gapReport) {
    console.log(`\nGap report written to: ${gapReportPath}`);
  }
}

program
  .command('pause')
  .description(
    'Request the running `janumicode run` process to pause at the next quiescence tick. ' +
    'Creates `<workspace>/.janumicode/PAUSE_REQUESTED`. ' +
    'Cancel a pending pause by deleting that file before the runner observes it.',
  )
  .argument('<workspace>', 'Workspace root path (same one passed to `run --workspace`)')
  .action((workspace: string) => {
    const workspacePath = path.resolve(workspace);
    if (!fs.existsSync(workspacePath)) {
      console.error(`Workspace path does not exist: ${workspacePath}`);
      process.exit(4);
    }
    const flagDir = path.join(workspacePath, '.janumicode');
    fs.mkdirSync(flagDir, { recursive: true });
    const flagPath = path.join(flagDir, 'PAUSE_REQUESTED');
    fs.writeFileSync(flagPath, new Date().toISOString() + '\n');
    console.log(`Pause requested. The runner will stop at its next quiescence tick.`);
    console.log(`Flag: ${flagPath}`);
    console.log(`Cancel before observation by deleting that file.`);
  });

program
  .command('verify')
  .description('Run test strategy harness against a corpus')
  .requiredOption('--corpus <path>', 'Path to corpus document')
  .requiredOption('--workspace <path>', 'Workspace root path')
  .option('--llm-mode <mode>', 'LLM mode: mock or real', 'mock')
  .option('--auto-approve', 'Auto-approve all decisions', true)
  .option('--fixture-dir <path>', 'Directory containing LLM fixtures')
  .option('--gap-report <path>', 'Output gap report to file on failure')
  .action(async (options: { corpus: string; workspace: string; llmMode: string; autoApprove: boolean; fixtureDir?: string; gapReport?: string }) => {
    const corpusPath = path.resolve(options.corpus);
    const config: PipelineRunnerConfig = {
      workspacePath: path.resolve(options.workspace),
      llmMode: options.llmMode as 'mock' | 'real',
      autoApprove: options.autoApprove,
      fixtureDir: options.fixtureDir ? path.resolve(options.fixtureDir) : undefined,
    };

    try {
      const result = await runPipeline(`@${corpusPath}`, config);

      if (result.status === 'success') {
        console.log('\n=== Harness Verification Passed ===');
        console.log(`Phases completed: ${result.phasesCompleted.join(', ')}`);
        process.exit(0);
      } else {
        console.log('\n=== Harness Verification Failed ===');
        if (options.gapReport && result.gapReport) {
          fs.writeFileSync(options.gapReport, JSON.stringify(result.gapReport, null, 2));
          console.log(`Gap report written to: ${options.gapReport}`);
        }
        process.exit(1);
      }
    } catch (err) {
      console.error('\n=== Harness Error ===');
      console.error(err);
      process.exit(2);
    }
  });

program.parse();
