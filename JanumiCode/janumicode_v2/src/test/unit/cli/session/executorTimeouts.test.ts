import { describe, it, expect, afterEach } from 'vitest';
import {
  resolveExecutorIdleTimeoutS,
  resolveExecutorWallclockTimeoutS,
  resolveExecutorIdleTimeoutMs,
  resolveExecutorWallclockTimeoutMs,
} from '../../../../lib/cli/session/executorTimeouts';

describe('executorTimeouts — shared executor backstop policy', () => {
  afterEach(() => {
    delete process.env.JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S;
    delete process.env.JANUMICODE_EXECUTOR_WALLCLOCK_TIMEOUT_S;
  });

  it('defaults: idle 24h, wall-clock = idle + 1h (25h)', () => {
    expect(resolveExecutorIdleTimeoutS()).toBe(24 * 60 * 60);
    expect(resolveExecutorWallclockTimeoutS()).toBe(25 * 60 * 60);
    expect(resolveExecutorIdleTimeoutMs()).toBe(24 * 60 * 60 * 1000);
    expect(resolveExecutorWallclockTimeoutMs()).toBe(25 * 60 * 60 * 1000);
  });

  it('env overrides the idle threshold; wall-clock tracks it (+1h) unless also set', () => {
    process.env.JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S = '600';
    expect(resolveExecutorIdleTimeoutS()).toBe(600);
    expect(resolveExecutorWallclockTimeoutS()).toBe(600 + 3600); // idle + 1h
  });

  it('wall-clock env override wins outright', () => {
    process.env.JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S = '600';
    process.env.JANUMICODE_EXECUTOR_WALLCLOCK_TIMEOUT_S = '900';
    expect(resolveExecutorWallclockTimeoutS()).toBe(900);
  });

  it('ignores non-positive / non-numeric env values (falls back to defaults)', () => {
    process.env.JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S = '0';
    expect(resolveExecutorIdleTimeoutS()).toBe(24 * 60 * 60);
    process.env.JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S = 'abc';
    expect(resolveExecutorIdleTimeoutS()).toBe(24 * 60 * 60);
  });

  it('the wall-clock backstop always sits above the idle threshold', () => {
    process.env.JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S = '7200';
    expect(resolveExecutorWallclockTimeoutS()).toBeGreaterThan(resolveExecutorIdleTimeoutS());
  });
});
