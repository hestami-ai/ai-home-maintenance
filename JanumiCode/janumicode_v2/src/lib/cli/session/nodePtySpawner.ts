/**
 * Production {@link PtySpawner} backed by `node-pty` (ConPTY on Windows).
 *
 * `node-pty` is a NATIVE module and an optional runtime dependency: it is
 * lazily `require`d here (not statically imported) and marked `external` in
 * esbuild, so the bundle, `tsc`, and the unit tests build WITHOUT it installed.
 * Interactive sessions need it at runtime: `npm install node-pty`. Until then,
 * `spawn()` throws a clear, actionable error and the caller falls back to the
 * Tier-1 structured (one-shot) adapter.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../../logging';
import type { PtyProcess, PtySpawner, PtySpawnOptions } from './types';

interface NodePtyModule {
  spawn(
    file: string,
    args: string[],
    options: { name?: string; cols?: number; rows?: number; cwd: string; env: NodeJS.ProcessEnv },
  ): NodePtyChild;
}

interface NodePtyChild {
  pid: number;
  onData(cb: (data: string) => void): void;
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}

let cached: NodePtyModule | null | undefined;

function loadNodePty(): NodePtyModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('node-pty') as NodePtyModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** True when `node-pty` is installed and loadable. */
export function isNodePtyAvailable(): boolean {
  return loadNodePty() !== null;
}

/**
 * Resolve a bare command name to an absolute executable path on Windows.
 *
 * node-pty's ConPTY backend does NOT perform the PATH + PATHEXT search a cmd
 * shell does — `pty.spawn('goose', …)` throws `File not found:` even when
 * `goose.exe` is on PATH (slice-141, first live interactive run). The
 * structured CLIInvoker path never hit this because it spawns through a shell.
 * Deterministic resolution: if the command already has a separator or exists
 * as-is, use it; otherwise scan PATH × PATHEXT for the first existing file.
 * Returns the input unchanged when nothing resolves (pty.spawn then surfaces
 * its own error).
 */
export function resolveCommandForPty(command: string, env: NodeJS.ProcessEnv = process.env): string {
  if (process.platform !== 'win32') return command; // posix node-pty uses execvp (PATH-aware)
  if (command.includes('/') || command.includes('\\')) return command;
  if (fs.existsSync(command)) return command;
  const pathDirs = (env.PATH ?? env.Path ?? '').split(';').filter(Boolean);
  const exts = (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  const hasExt = path.extname(command) !== '';
  for (const dir of pathDirs) {
    if (hasExt) {
      const p = path.join(dir, command);
      if (fs.existsSync(p)) return p;
      continue;
    }
    for (const ext of exts) {
      const p = path.join(dir, command + ext.toLowerCase());
      if (fs.existsSync(p)) return p;
      const pUpper = path.join(dir, command + ext);
      if (fs.existsSync(pUpper)) return pUpper;
    }
  }
  return command;
}

export class NodePtySpawner implements PtySpawner {
  spawn(opts: PtySpawnOptions): PtyProcess {
    const pty = loadNodePty();
    if (!pty) {
      throw new Error(
        'node-pty is not installed — interactive (TUI) sessions are unavailable. '
        + 'Run `npm install node-pty`, or fall back to the structured one-shot adapter.',
      );
    }
    const mergedEnv = { ...process.env, ...(opts.env ?? {}) };
    let command = resolveCommandForPty(opts.command, mergedEnv);
    let args = opts.args;
    // ConPTY cannot execute .cmd/.bat shims directly — run them via cmd.exe.
    if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)) {
      args = ['/c', command, ...args];
      command = process.env.ComSpec ?? 'cmd.exe';
    }
    const child = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: opts.cols ?? 120,
      rows: opts.rows ?? 40,
      cwd: opts.cwd,
      env: mergedEnv,
    });
    return new NodePtyProcess(child);
  }
}

class NodePtyProcess implements PtyProcess {
  constructor(private readonly child: NodePtyChild) {}
  get pid(): number { return this.child.pid; }
  onData(listener: (chunk: string) => void): void { this.child.onData(listener); }
  onExit(listener: (info: { exitCode: number; signal?: number }) => void): void {
    this.child.onExit(listener);
  }
  write(data: string): void { this.child.write(data); }
  resize(cols: number, rows: number): void {
    try { this.child.resize(cols, rows); } catch (err) {
      getLogger().debug('cli', 'pty resize failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }
  kill(): void {
    try { this.child.kill(); } catch { /* best effort */ }
  }
}
