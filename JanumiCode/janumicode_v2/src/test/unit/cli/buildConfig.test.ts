/**
 * Characterization test for `buildConfig`, the pure options→PipelineRunnerConfig
 * mapper extracted from the `janumicode run` command action.
 *
 * Pins the CURRENT observable mapping so the S3776 decomposition of the
 * run action stays behavior-preserving:
 *   - scalar options are threaded through unchanged;
 *   - --fixture-dir / --capture-output-dir / --resume-from-db are resolved
 *     to absolute paths when present, undefined when absent;
 *   - already-parsed decision/inject overrides are passed through as-is;
 *   - --llm-gap-enhance shapes into { provider, model } with '' defaults,
 *     or undefined when the flag is off.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { buildConfig, type RunOptions } from '../../../cli/runConfig';
import type { PipelineRunnerConfig } from '../../harness/types';

function baseOptions(overrides: Partial<RunOptions> = {}): RunOptions {
  return {
    intent: 'Build a thing',
    workspace: '.',
    llmMode: 'mock',
    autoApprove: false,
    ...overrides,
  };
}

describe('buildConfig', () => {
  it('maps minimal options: scalars through, optionals undefined', () => {
    const cfg = buildConfig(baseOptions(), '/abs/ws', undefined, undefined);

    expect(cfg.workspacePath).toBe('/abs/ws');
    expect(cfg.llmMode).toBe('mock');
    expect(cfg.autoApprove).toBe(false);
    expect(cfg.simulateHumanDecisions).toBeUndefined();
    expect(cfg.overrideInjections).toBeUndefined();
    expect(cfg.dbPath).toBeUndefined();
    expect(cfg.phaseLimit).toBeUndefined();
    expect(cfg.fixtureDir).toBeUndefined();
    expect(cfg.decisionOverrides).toBeUndefined();
    expect(cfg.captureFixtures).toBeUndefined();
    expect(cfg.captureOutputDir).toBeUndefined();
    expect(cfg.resumeFromDb).toBeUndefined();
    expect(cfg.resumeAtPhase).toBeUndefined();
    expect(cfg.resumeAtSubPhase).toBeUndefined();
    expect(cfg.resumeResetCycles).toBeUndefined();
    expect(cfg.thinSlice).toBeUndefined();
    expect(cfg.fullSlice).toBeUndefined();
    expect(cfg.llmGapEnhance).toBeUndefined();
  });

  it('resolves relative dir/db options to absolute paths and threads scalars', () => {
    const options = baseOptions({
      llmMode: 'real',
      autoApprove: true,
      simulateHumanDecisions: true,
      captureFixtures: true,
      resumeResetCycles: true,
      thinSlice: true,
      fullSlice: true,
      phaseLimit: 'phase3',
      dbPath: '/tmp/explicit.db',
      resumeAtPhase: 'phase2',
      resumeAtSubPhase: 'task_skeleton',
      fixtureDir: 'fixtures/mock',
      captureOutputDir: 'captured/out',
      resumeFromDb: 'prior-run.db',
    });

    const cfg = buildConfig(options, '/abs/ws', undefined, undefined);

    expect(cfg.workspacePath).toBe('/abs/ws');
    expect(cfg.llmMode).toBe('real');
    expect(cfg.autoApprove).toBe(true);
    expect(cfg.simulateHumanDecisions).toBe(true);
    expect(cfg.captureFixtures).toBe(true);
    expect(cfg.resumeResetCycles).toBe(true);
    expect(cfg.thinSlice).toBe(true);
    expect(cfg.fullSlice).toBe(true);
    expect(cfg.phaseLimit).toBe('phase3');
    expect(cfg.dbPath).toBe('/tmp/explicit.db');
    expect(cfg.resumeAtPhase).toBe('phase2');
    expect(cfg.resumeAtSubPhase).toBe('task_skeleton');
    // Relative paths resolved against cwd (path.resolve on both sides =
    // platform-agnostic).
    expect(cfg.fixtureDir).toBe(path.resolve('fixtures/mock'));
    expect(cfg.captureOutputDir).toBe(path.resolve('captured/out'));
    expect(cfg.resumeFromDb).toBe(path.resolve('prior-run.db'));
  });

  it('passes already-parsed decision and inject overrides through unchanged', () => {
    const decision = { 'phase1.1': 'menu-a' } as unknown as Record<string, unknown>;
    const inject = [{ afterPhase: 'phase1' }] as unknown as PipelineRunnerConfig['overrideInjections'];

    const cfg = buildConfig(baseOptions(), '/abs/ws', decision, inject);

    expect(cfg.decisionOverrides).toEqual({ 'phase1.1': 'menu-a' });
    expect(cfg.overrideInjections).toBe(inject);
  });

  it('shapes --llm-gap-enhance with explicit provider/model', () => {
    const cfg = buildConfig(
      baseOptions({ llmGapEnhance: true, llmGapProvider: 'anthropic', llmGapModel: 'claude-opus' }),
      '/abs/ws',
      undefined,
      undefined,
    );
    expect(cfg.llmGapEnhance).toEqual({ provider: 'anthropic', model: 'claude-opus' });
  });

  it('defaults --llm-gap-enhance provider/model to empty strings when omitted', () => {
    const cfg = buildConfig(
      baseOptions({ llmGapEnhance: true }),
      '/abs/ws',
      undefined,
      undefined,
    );
    expect(cfg.llmGapEnhance).toEqual({ provider: '', model: '' });
  });

  it('omits llmGapEnhance entirely when the flag is off', () => {
    const cfg = buildConfig(
      baseOptions({ llmGapEnhance: false }),
      '/abs/ws',
      undefined,
      undefined,
    );
    expect(cfg.llmGapEnhance).toBeUndefined();
  });
});
