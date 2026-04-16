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
import type { PipelineRunnerConfig } from '../test/harness/types';

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
  .option('--json', 'Emit the full HarnessResult as JSON on stdout instead of the human banner. Intended for virtuous-cycle coding agents that parse the result programmatically.', false)
  .option('--llm-gap-enhance', 'Call an LLM to produce a grounded suggested_fix on the gap report. Opt-in: adds one LLM call per failed run.', false)
  .option('--llm-gap-provider <provider>', 'Provider for --llm-gap-enhance (default: ollama).', 'ollama')
  .option('--llm-gap-model <model>', 'Model for --llm-gap-enhance (default: qwen3.5:9b).', 'qwen3.5:9b')
  .action(async (options: { intent: string; workspace: string; llmMode: string; autoApprove: boolean; phaseLimit?: string; fixtureDir?: string; gapReport?: string; decisionOverrides?: string; captureFixtures?: boolean; captureOutputDir?: string; resumeFromDb?: string; resumeAtPhase?: string; json?: boolean; llmGapEnhance?: boolean; llmGapProvider?: string; llmGapModel?: string }) => {
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
      if (!options.resumeAtPhase) {
        emitError(options.json, '--resume-from-db requires --resume-at-phase', 'bootstrap_error');
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

    const config: PipelineRunnerConfig = {
      workspacePath,
      llmMode: options.llmMode as 'mock' | 'real',
      autoApprove: options.autoApprove,
      phaseLimit: options.phaseLimit,
      fixtureDir: options.fixtureDir ? path.resolve(options.fixtureDir) : undefined,
      decisionOverrides: parsedOverrides as PipelineRunnerConfig['decisionOverrides'],
      captureFixtures: options.captureFixtures,
      captureOutputDir: options.captureOutputDir ? path.resolve(options.captureOutputDir) : undefined,
      resumeFromDb: options.resumeFromDb ? path.resolve(options.resumeFromDb) : undefined,
      resumeAtPhase: options.resumeAtPhase,
      llmGapEnhance: options.llmGapEnhance
        ? {
            provider: options.llmGapProvider ?? 'ollama',
            model: options.llmGapModel ?? 'qwen3.5:9b',
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
      //   0 = success
      //   1 = partial OR failed (the normal "gap found, fix, rerun" signal)
      //   2 = runtime exception thrown by the pipeline (bug or infra)
      //   4 = bootstrap/config error caught above (never reaches here)
      if (result.status === 'success') process.exit(0);
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
