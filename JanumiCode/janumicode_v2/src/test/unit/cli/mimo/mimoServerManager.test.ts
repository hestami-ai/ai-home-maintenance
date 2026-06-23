import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildPermissionPolicy,
  parseListeningUrl,
  addTrustedPath,
  resolveMimoConfig,
} from '../../../../lib/cli/mimo/mimoServerManager';

describe('buildPermissionPolicy', () => {
  it('static mode: valid JSON, deny-by-default, NO ask, tilde external_directory', () => {
    const policy = buildPermissionPolicy('static');
    const json = JSON.stringify(policy);
    expect(() => JSON.parse(json)).not.toThrow();
    // No `ask` anywhere in static mode (would hang headless).
    expect(json).not.toContain('"ask"');
    const perm = (policy as { permission: Record<string, unknown> }).permission;
    expect(perm.edit).toBe('allow');
    expect(perm.webfetch).toBe('deny');
    // bash scoped: deny-* but allow ls/go (compose leads with ls, verifies with go test).
    expect((perm.bash as Record<string, string>)['*']).toBe('deny');
    expect((perm.bash as Record<string, string>)['ls*']).toBe('allow');
    // mimo's own dir allowed via a tilde path (NOT a backslash Windows path).
    const ext = perm.external_directory as Record<string, string>;
    expect(ext['*']).toBe('deny');
    expect(ext['~/.local/share/mimocode/**']).toBe('allow');
    expect(json).not.toMatch(/\\\\/); // no backslash escapes that would break mimo's JSON parse
  });

  it('relay mode: sensitive tools become ask; edit/read stay allow', () => {
    const perm = (buildPermissionPolicy('relay') as { permission: Record<string, unknown> }).permission;
    expect(perm.webfetch).toBe('ask');
    expect((perm.bash as Record<string, string>)['*']).toBe('ask');
    expect((perm.external_directory as Record<string, string>)['*']).toBe('ask');
    expect(perm.edit).toBe('allow');
    expect(perm.question).toBe('deny'); // never ask the (non-conversational) executor's user
  });
});

describe('parseListeningUrl', () => {
  it('extracts the base URL from the serve log line', () => {
    expect(parseListeningUrl('Warning: ...\nmimocode server listening on http://127.0.0.1:4096\n'))
      .toBe('http://127.0.0.1:4096');
  });
  it('returns null before the line appears', () => {
    expect(parseListeningUrl('booting...')).toBeNull();
  });
});

describe('resolveMimoConfig', () => {
  it('defaults: mimo binary, mimo/mimo-auto, compose, static', () => {
    expect(resolveMimoConfig({})).toEqual({ binary: 'mimo', model: 'mimo/mimo-auto', agent: 'compose', permissionMode: 'static' });
  });
  it('honors env overrides', () => {
    const cfg = resolveMimoConfig({ JANUMICODE_MIMO_MODEL: 'mimo/mimo-pro', JANUMICODE_MIMO_AGENT: 'build', JANUMICODE_MIMO_PERMISSION_MODE: 'relay' });
    expect(cfg).toMatchObject({ model: 'mimo/mimo-pro', agent: 'build', permissionMode: 'relay' });
  });
});

describe('addTrustedPath', () => {
  let dir: string;
  let trustFile: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-mimo-trust-'));
    trustFile = path.join(dir, 'trusted-workspaces.json');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('creates the file and adds the native project path', () => {
    addTrustedPath(trustFile, path.join(dir, 'proj'));
    const j = JSON.parse(fs.readFileSync(trustFile, 'utf8'));
    expect(j.version).toBe(1);
    expect(j.trustedPaths).toContain(path.resolve(dir, 'proj'));
  });

  it('is idempotent and preserves existing entries', () => {
    fs.writeFileSync(trustFile, JSON.stringify({ version: 1, trustedPaths: ['/existing'] }));
    addTrustedPath(trustFile, path.join(dir, 'proj'));
    addTrustedPath(trustFile, path.join(dir, 'proj'));
    const j = JSON.parse(fs.readFileSync(trustFile, 'utf8'));
    expect(j.trustedPaths).toContain('/existing');
    expect(j.trustedPaths.filter((p: string) => p === path.resolve(dir, 'proj'))).toHaveLength(1);
  });
});
