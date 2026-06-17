/**
 * resolveCommandForPty — Windows PATH/PATHEXT resolution for ConPTY spawn
 * (slice-141: `pty.spawn('goose', …)` threw `File not found:` because ConPTY
 * does not do shell-style command resolution).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveCommandForPty } from '../../../../lib/cli/session/nodePtySpawner';

const winOnly = process.platform === 'win32' ? it : it.skip;

describe('resolveCommandForPty', () => {
  winOnly('resolves a bare command to its absolute .exe via PATH', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pty-resolve-'));
    const exe = path.join(dir, 'fakegoose.exe');
    fs.writeFileSync(exe, 'MZ');
    const resolved = resolveCommandForPty('fakegoose', { PATH: dir, PATHEXT: '.COM;.EXE;.BAT;.CMD' });
    expect(resolved.toLowerCase()).toBe(exe.toLowerCase());
  });

  winOnly('returns the input unchanged when nothing resolves', () => {
    expect(resolveCommandForPty('definitely-not-a-real-cmd-xyz', { PATH: 'C:\\nonexistent' }))
      .toBe('definitely-not-a-real-cmd-xyz');
  });

  winOnly('leaves explicit paths untouched', () => {
    expect(resolveCommandForPty('C:\\tools\\goose.exe', { PATH: '' })).toBe('C:\\tools\\goose.exe');
  });

  it('is a no-op on non-Windows platforms', () => {
    if (process.platform !== 'win32') {
      expect(resolveCommandForPty('goose')).toBe('goose');
    }
  });
});
