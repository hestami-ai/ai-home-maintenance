/**
 * Crash-resumable sweep state. An overnight sweep persists per-config
 * status to <outputDir>/sweep-state.json after every transition so a
 * crashed/killed sweep resumes with `run-bakeoff.ts --resume` (completed
 * configs are skipped; a config left `running` by a crash is re-run).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { CandidateSpec } from './bakeoffConfig';

export type ConfigStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface ConfigState {
  status: ConfigStatus;
  startedAt?: string;
  completedAt?: string;
  resultPath?: string;
  errorMessage?: string;
}

export interface SweepState {
  sweepId: string;
  startedAt: string;
  configs: Record<string, ConfigState>;
}

export class SweepStateManager {
  private readonly stateFilePath: string;
  private state: SweepState;

  constructor(outputDir: string, sweepId: string) {
    this.stateFilePath = join(outputDir, 'sweep-state.json');
    if (existsSync(this.stateFilePath)) {
      this.state = JSON.parse(readFileSync(this.stateFilePath, 'utf-8')) as SweepState;
    } else {
      this.state = { sweepId, startedAt: new Date().toISOString(), configs: {} };
      this.save();
    }
  }

  get current(): SweepState {
    return this.state;
  }

  getConfig(slug: string): ConfigState {
    return this.state.configs[slug] ?? { status: 'pending' };
  }

  markRunning(slug: string): void {
    this.state.configs[slug] = { status: 'running', startedAt: new Date().toISOString() };
    this.save();
  }

  markCompleted(slug: string, resultPath: string): void {
    this.state.configs[slug] = {
      ...this.state.configs[slug],
      status: 'completed',
      completedAt: new Date().toISOString(),
      resultPath,
    };
    this.save();
  }

  markFailed(slug: string, errorMessage: string): void {
    this.state.configs[slug] = {
      ...this.state.configs[slug],
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage,
    };
    this.save();
  }

  /**
   * Configs still needing a run. With `resume`, completed configs are
   * skipped and everything else (pending / failed / crashed-while-running)
   * re-runs. Without it, every candidate runs.
   */
  getPendingConfigs(candidates: CandidateSpec[], resume: boolean): CandidateSpec[] {
    if (!resume) return [...candidates];
    return candidates.filter((c) => this.getConfig(c.slug).status !== 'completed');
  }

  private save(): void {
    mkdirSync(dirname(this.stateFilePath), { recursive: true });
    // Write-then-rename so a crash mid-write can't truncate the state file.
    const tmp = `${this.stateFilePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf-8');
    renameSync(tmp, this.stateFilePath);
  }
}
