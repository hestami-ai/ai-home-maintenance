/**
 * Scripted fake {@link PtySpawner} for testing the SessionDriver and adapters
 * without a real PTY / native node-pty. The script reacts to the driver's
 * writes (e.g. "when the driver sends `/plan\r`, emit these frames") so tests
 * can model a TUI's prompt/response flow deterministically.
 */

import type { PtyProcess, PtySpawner, PtySpawnOptions } from './types';

export interface ScriptedRule {
  /** Match against data the driver writes to the PTY. */
  onInput: string | RegExp;
  /** Frames to emit in response (each pushed as one onData chunk). */
  emit: string[];
  /** Exit the process with this code after emitting (optional). */
  exitAfter?: number;
}

export interface FakePtyScript {
  /** Frames emitted immediately on spawn (the initial banner / prompt). */
  initial?: string[];
  rules?: ScriptedRule[];
}

export class FakePtyProcess implements PtyProcess {
  private dataListeners: Array<(c: string) => void> = [];
  private exitListeners: Array<(e: { exitCode: number; signal?: number }) => void> = [];
  readonly writes: string[] = [];
  readonly resizes: Array<{ cols: number; rows: number }> = [];
  killed = false;
  readonly pid = 4242;

  constructor(private readonly script: FakePtyScript) {
    // Emit the initial frames on the next microtask so listeners are attached.
    queueMicrotask(() => { for (const f of script.initial ?? []) this.emit(f); });
  }

  onData(listener: (chunk: string) => void): void { this.dataListeners.push(listener); }
  onExit(listener: (info: { exitCode: number; signal?: number }) => void): void { this.exitListeners.push(listener); }

  write(data: string): void {
    this.writes.push(data);
    for (const rule of this.script.rules ?? []) {
      const hit = typeof rule.onInput === 'string' ? data.includes(rule.onInput) : rule.onInput.test(data);
      if (!hit) continue;
      queueMicrotask(() => {
        for (const f of rule.emit) this.emit(f);
        if (rule.exitAfter !== undefined) this.exit(rule.exitAfter);
      });
    }
  }

  resize(cols: number, rows: number): void { this.resizes.push({ cols, rows }); }
  kill(): void { this.killed = true; this.exit(0); }

  /** Test helper: push a raw frame. */
  emit(chunk: string): void { for (const l of [...this.dataListeners]) l(chunk); }
  /** Test helper: end the process. */
  exit(exitCode: number): void { for (const l of [...this.exitListeners]) l({ exitCode }); }
}

export class FakePtySpawner implements PtySpawner {
  lastProcess: FakePtyProcess | null = null;
  readonly spawns: PtySpawnOptions[] = [];
  constructor(private readonly script: FakePtyScript = {}) {}
  spawn(opts: PtySpawnOptions): FakePtyProcess {
    this.spawns.push(opts);
    this.lastProcess = new FakePtyProcess(this.script);
    return this.lastProcess;
  }
}
