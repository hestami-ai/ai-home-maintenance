/**
 * Unit tests for the interactive-session substrate (M2): TerminalScreen +
 * SessionDriver driven against a scripted fake PTY.
 */
import { describe, it, expect } from 'vitest';
import { TerminalScreen } from '../../../../lib/cli/session/terminalScreen';
import { SessionDriver } from '../../../../lib/cli/session/sessionDriver';
import { FakePtySpawner } from '../../../../lib/cli/session/fakePtySpawner';

describe('TerminalScreen', () => {
  it('strips ANSI escapes and lays out CR/LF text', () => {
    const s = new TerminalScreen();
    s.write('\x1b[32mhello\x1b[0m\r\nworld\n');
    expect(s.snapshot().lines).toEqual(['hello', 'world']);
  });

  it('handles carriage-return repaint (progress-style overwrite)', () => {
    const s = new TerminalScreen();
    s.write('Loading... 10%\rLoading... 99%');
    expect(s.snapshot().text).toBe('Loading... 99%');
  });

  it('tracks the alternate-screen flag', () => {
    const s = new TerminalScreen();
    expect(s.snapshot().altScreen).toBe(false);
    s.write('\x1b[?1049h');
    expect(s.snapshot().altScreen).toBe(true);
    s.write('\x1b[?1049l');
    expect(s.snapshot().altScreen).toBe(false);
  });

  it('clears on erase-display', () => {
    const s = new TerminalScreen();
    s.write('old content\n');
    s.write('\x1b[2Jfresh');
    expect(s.snapshot().text).toBe('fresh');
  });
});

describe('SessionDriver', () => {
  it('spawns and waits for an initial prompt', async () => {
    const spawner = new FakePtySpawner({ initial: ['Goose session ready\n> '] });
    const d = new SessionDriver(spawner);
    d.start({ command: 'goose', args: ['session'], cwd: '/ws' });
    const r = await d.waitFor('Goose session ready', 1000);
    expect(r.matched).toBe(true);
    expect(r.reason).toBe('matched');
    expect(spawner.spawns[0].command).toBe('goose');
  });

  it('drives a prompt/response flow: send a slash command, await its reply', async () => {
    const spawner = new FakePtySpawner({
      initial: ['> '],
      rules: [{ onInput: '/plan', emit: ['Entering plan mode...\nPLAN READY\n> '] }],
    });
    const d = new SessionDriver(spawner);
    d.start({ command: 'goose', args: ['session'], cwd: '/ws' });
    await d.waitFor('> ', 1000);
    d.sendLine('/plan');
    const r = await d.waitFor('PLAN READY', 1000);
    expect(r.matched).toBe(true);
    // The driver actually wrote the slash command + Enter to the PTY.
    expect(spawner.lastProcess!.writes.join('')).toContain('/plan\r');
  });

  it('resolves with reason=exit when the process ends before matching', async () => {
    const spawner = new FakePtySpawner({
      initial: ['working\n'],
      rules: [{ onInput: 'go', emit: ['done\n'], exitAfter: 0 }],
    });
    const d = new SessionDriver(spawner);
    d.start({ command: 'goose', args: ['run'], cwd: '/ws' });
    d.sendLine('go');
    const r = await d.waitFor('NEVER APPEARS', 1000);
    expect(r.matched).toBe(false);
    expect(r.reason).toBe('exit');
    expect(d.exited).toBe(true);
  });

  it('times out via the injected clock without hanging', async () => {
    const spawner = new FakePtySpawner({ initial: ['idle prompt'] });
    // Injected timer fires immediately so the test is deterministic.
    const d = new SessionDriver(spawner, { setTimeoutFn: (cb) => { cb(); return 0; }, clearTimeoutFn: () => {} });
    d.start({ command: 'x', args: [], cwd: '/ws' });
    const r = await d.waitFor('will not match', 999999);
    expect(r.reason).toBe('timeout');
    expect(r.matched).toBe(false);
  });

  it('encodes special keys and resizes', async () => {
    const spawner = new FakePtySpawner({ initial: ['menu'] });
    const d = new SessionDriver(spawner, { cols: 100, rows: 30 });
    d.start({ command: 'x', args: [], cwd: '/ws' });
    d.sendKey('down');
    d.sendKey('enter');
    d.resize(80, 24);
    const writes = spawner.lastProcess!.writes.join('');
    expect(writes).toContain('\x1b[B'); // down arrow
    expect(writes).toContain('\r');     // enter
    expect(spawner.lastProcess!.resizes).toContainEqual({ cols: 80, rows: 24 });
    expect(spawner.spawns[0].cols).toBe(100);
  });

  it('emits log events for spawn / data / input', async () => {
    const events: string[] = [];
    const spawner = new FakePtySpawner({ initial: ['hi'] });
    const d = new SessionDriver(spawner, { onLog: (e) => events.push(e.kind) });
    d.start({ command: 'x', args: [], cwd: '/ws' });
    await d.waitFor('hi', 1000);
    d.sendLine('answer');
    expect(events).toContain('spawn');
    expect(events).toContain('data');
    expect(events).toContain('input');
  });
});
