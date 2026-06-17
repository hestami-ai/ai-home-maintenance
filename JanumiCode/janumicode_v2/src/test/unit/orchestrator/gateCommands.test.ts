/**
 * Stage 0.5a — the stack-agnostic GateCommand seam: manifest-detection
 * resolver (single detectable stack, any language; defer on ambiguity) and
 * the GateRunner.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { detectWorkspaceStack, resolveGateCommands } from '../../../lib/orchestrator/gateCommands';
import { runGateCommands } from '../../../lib/orchestrator/gateRunner';

let ws: string;
beforeEach(() => { ws = fs.mkdtempSync(path.join(os.tmpdir(), 'gatecmd-')); });
afterEach(() => { fs.rmSync(ws, { recursive: true, force: true }); });
const write = (rel: string, content = '') => fs.writeFileSync(path.join(ws, rel), content);

describe('detectWorkspaceStack — single detectable stack', () => {
  it('detects each homogeneous stack from its root manifest', () => {
    write('Cargo.toml'); expect(detectWorkspaceStack(ws)?.id).toBe('rust');
    fs.rmSync(path.join(ws, 'Cargo.toml'));
    write('go.mod'); expect(detectWorkspaceStack(ws)?.id).toBe('go');
    fs.rmSync(path.join(ws, 'go.mod'));
    write('pyproject.toml'); expect(detectWorkspaceStack(ws)?.id).toBe('python');
    fs.rmSync(path.join(ws, 'pyproject.toml'));
    write('package.json', '{}'); expect(detectWorkspaceStack(ws)?.id).toBe('node');
  });

  it('returns null (defer to recon) on NO stack or MULTIPLE distinct stacks', () => {
    expect(detectWorkspaceStack(ws)).toBeNull(); // empty
    write('package.json', '{}');
    write('Cargo.toml'); // node + rust ⇒ ambiguous polyglot ⇒ defer
    expect(detectWorkspaceStack(ws)).toBeNull();
  });

  it('two python manifests are ONE stack (not ambiguous)', () => {
    write('pyproject.toml'); write('requirements.txt');
    expect(detectWorkspaceStack(ws)?.id).toBe('python');
  });
});

describe('resolveGateCommands — generic per-stack defaults', () => {
  it('rust → cargo test + check', () => {
    write('Cargo.toml');
    const g = resolveGateCommands(ws);
    expect(g.map(c => c.name)).toEqual(['rust:test', 'rust:check']);
    expect(g[0]).toMatchObject({ command: 'cargo', args: ['test'], kind: 'test' });
  });

  it('go → go test + vet', () => {
    write('go.mod');
    expect(resolveGateCommands(ws).map(c => `${c.command} ${c.args.join(' ')}`))
      .toEqual(['go test ./...', 'go vet ./...']);
  });

  it('node → test + tsc (when tsconfig + typescript dep) + build', () => {
    write('package.json', JSON.stringify({
      scripts: { test: 'vitest run', build: 'tsc' },
      devDependencies: { typescript: '^5' },
    }));
    write('tsconfig.json', '{}');
    const kinds = resolveGateCommands(ws).map(c => c.kind);
    expect(kinds).toContain('test');
    expect(kinds).toContain('typecheck');
    expect(kinds).toContain('build');
  });

  it('node without a test script yields no test gate; malformed pkg yields none', () => {
    write('package.json', JSON.stringify({ scripts: {} }));
    expect(resolveGateCommands(ws).some(c => c.kind === 'test')).toBe(false);
    fs.writeFileSync(path.join(ws, 'package.json'), '{ not json');
    expect(resolveGateCommands(ws)).toEqual([]);
  });

  it('returns [] for ambiguous/undetectable workspaces (defer to recon)', () => {
    expect(resolveGateCommands(ws)).toEqual([]); // empty
    write('package.json', '{}'); write('Cargo.toml');
    expect(resolveGateCommands(ws)).toEqual([]); // polyglot → defer
  });
});

describe('runGateCommands', () => {
  const echo = (msg: string) => process.platform === 'win32'
    ? { command: 'cmd', args: ['/c', `echo ${msg}`] }
    : { command: 'sh', args: ['-c', `echo ${msg}`] };
  const fail = () => process.platform === 'win32'
    ? { command: 'cmd', args: ['/c', 'exit 1'] }
    : { command: 'sh', args: ['-c', 'exit 1'] };

  it('passes when every gate exits 0', () => {
    const e = echo('ok');
    const s = runGateCommands(ws, [{ name: 'g1', kind: 'build', timeoutMs: 10_000, ...e }]);
    expect(s.allPassed).toBe(true);
    expect(s.failureEvidence).toBe('');
  });

  it('fails and builds evidence when a gate exits non-zero', () => {
    const s = runGateCommands(ws, [
      { name: 'ok', kind: 'build', timeoutMs: 10_000, ...echo('fine') },
      { name: 'bad', kind: 'typecheck', timeoutMs: 10_000, ...fail() },
    ]);
    expect(s.allPassed).toBe(false);
    expect(s.failureEvidence).toContain('Gate FAILED: bad');
    expect(s.failureEvidence).not.toContain('Gate FAILED: ok');
  });
});
