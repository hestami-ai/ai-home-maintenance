/**
 * Regression tests for the shared .env loader.
 *
 * Motivation: the CLI entry point (`node dist/cli/janumicode.js`)
 * didn't load .env, so child processes spawned by the agent invoker
 * — Gemini CLI for the Orchestrator, Claude Code for Phase 9 —
 * inherited a process.env without `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`
 * and exited with:
 *   When using Gemini API, you must specify the GEMINI_API_KEY environment variable.
 *
 * The extension host path works (activate() calls loadDotenv), so
 * these tests pin the shared helper's behaviour rather than the CLI
 * integration directly (integration covered by the existing CLI
 * smoke tests + the next live harness run).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadDotenv } from '../../../lib/config/dotenv';

describe('loadDotenv', () => {
  let tmp: string;
  const preserved: Record<string, string | undefined> = {};
  const INJECTED_KEYS = [
    'JANUMICODE_TEST_DOTENV_A',
    'JANUMICODE_TEST_DOTENV_B',
    'JANUMICODE_TEST_DOTENV_COMMENTED',
    'JANUMICODE_TEST_DOTENV_EXPORT',
    'JANUMICODE_TEST_DOTENV_EXISTING',
    'JANUMICODE_TEST_DOTENV_EMPTYEQ',
  ];

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-dotenv-'));
    for (const k of INJECTED_KEYS) {
      preserved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
    for (const k of INJECTED_KEYS) {
      if (preserved[k] === undefined) delete process.env[k];
      else process.env[k] = preserved[k];
    }
  });

  it('loads KEY=value pairs from .env into process.env', () => {
    fs.writeFileSync(
      path.join(tmp, '.env'),
      'JANUMICODE_TEST_DOTENV_A=first-value\nJANUMICODE_TEST_DOTENV_B=second-value\n',
    );
    loadDotenv(tmp);
    expect(process.env.JANUMICODE_TEST_DOTENV_A).toBe('first-value');
    expect(process.env.JANUMICODE_TEST_DOTENV_B).toBe('second-value');
  });

  it('is a no-op when .env does not exist', () => {
    expect(() => loadDotenv(tmp)).not.toThrow();
    expect(process.env.JANUMICODE_TEST_DOTENV_A).toBeUndefined();
  });

  it('ignores comment and blank lines', () => {
    fs.writeFileSync(
      path.join(tmp, '.env'),
      '# this is a comment\n\n#JANUMICODE_TEST_DOTENV_COMMENTED=should-not-appear\nJANUMICODE_TEST_DOTENV_A=loaded\n',
    );
    loadDotenv(tmp);
    expect(process.env.JANUMICODE_TEST_DOTENV_A).toBe('loaded');
    expect(process.env.JANUMICODE_TEST_DOTENV_COMMENTED).toBeUndefined();
  });

  it('strips the optional `export ` prefix so POSIX shell files work', () => {
    fs.writeFileSync(
      path.join(tmp, '.env'),
      'export JANUMICODE_TEST_DOTENV_EXPORT=shell-compatible\n',
    );
    loadDotenv(tmp);
    expect(process.env.JANUMICODE_TEST_DOTENV_EXPORT).toBe('shell-compatible');
  });

  it('does NOT overwrite an env var the user already set in their shell', () => {
    process.env.JANUMICODE_TEST_DOTENV_EXISTING = 'from-shell';
    fs.writeFileSync(
      path.join(tmp, '.env'),
      'JANUMICODE_TEST_DOTENV_EXISTING=from-dotenv\n',
    );
    loadDotenv(tmp);
    expect(process.env.JANUMICODE_TEST_DOTENV_EXISTING).toBe('from-shell');
  });

  it('handles values that contain `=` characters (API keys with padding)', () => {
    // Real Google API keys can end in `==`; the loader must split on
    // the FIRST `=` only, not greedy-match to the last.
    fs.writeFileSync(
      path.join(tmp, '.env'),
      'JANUMICODE_TEST_DOTENV_A=AIza+opaque+base64==\n',
    );
    loadDotenv(tmp);
    expect(process.env.JANUMICODE_TEST_DOTENV_A).toBe('AIza+opaque+base64==');
  });

  it('silently skips malformed lines with no `=`', () => {
    fs.writeFileSync(
      path.join(tmp, '.env'),
      'NOT_A_VALID_LINE_ANYMORE\nJANUMICODE_TEST_DOTENV_A=still-works\n',
    );
    expect(() => loadDotenv(tmp)).not.toThrow();
    expect(process.env.JANUMICODE_TEST_DOTENV_A).toBe('still-works');
  });
});
