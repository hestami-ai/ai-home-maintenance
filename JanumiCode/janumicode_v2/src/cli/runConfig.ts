/**
 * Pure helpers for the `janumicode run` command.
 *
 * These live in their own module (rather than inline in the CLI entry
 * point) so they can be unit-tested without importing `cli/index.ts`,
 * which has top-level side effects (`loadDotenv` + `program.parse()`).
 * The same split is why the pause-flag detector lives in `cli/runner.ts`.
 */

import * as path from 'node:path';
import type { PipelineRunnerConfig } from '../test/harness/types';

/**
 * Parsed shape of the `run` command's options as commander delivers them.
 * Kept as a named type so the CLI action and its helpers share one
 * declaration.
 */
export interface RunOptions {
  intent: string;
  workspace: string;
  llmMode: string;
  autoApprove: boolean;
  phaseLimit?: string;
  fixtureDir?: string;
  gapReport?: string;
  decisionOverrides?: string;
  captureFixtures?: boolean;
  captureOutputDir?: string;
  resumeFromDb?: string;
  resumeAtPhase?: string;
  resumeAtSubPhase?: string;
  resumeResetCycles?: boolean;
  thinSlice?: boolean;
  fullSlice?: boolean;
  simulateHumanDecisions?: boolean;
  injectOverrides?: string;
  dbPath?: string;
  json?: boolean;
  llmGapEnhance?: boolean;
  llmGapProvider?: string;
  llmGapModel?: string;
}

/**
 * Translate parsed CLI `run` options into the PipelineRunnerConfig the
 * runner consumes. Pure: resolves relative --fixture-dir /
 * --capture-output-dir / --resume-from-db to absolute paths, threads
 * through the already-parsed decision/inject overrides, and shapes
 * --llm-gap-enhance into its provider/model record (empty strings signal
 * "resolve from workspace orchestrator routing").
 */
export function buildConfig(
  options: RunOptions,
  workspacePath: string,
  parsedOverrides: Record<string, unknown> | undefined,
  parsedInjectOverrides: PipelineRunnerConfig['overrideInjections'] | undefined,
): PipelineRunnerConfig {
  return {
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
}
