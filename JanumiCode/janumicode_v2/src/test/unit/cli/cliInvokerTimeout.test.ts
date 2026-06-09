import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CLIInvoker } from '../../../lib/cli/cliInvoker';
import type { OutputParser, ParsedEvent } from '../../../lib/cli/outputParser';

// Parser that emits NO agent_reasoning_step events — so the no-content timer
// is never reset by the child's output (mirrors a goose call stuck after a
// failed tool call, still emitting envelopes but no assistant reasoning).
const emptyParser: OutputParser = { parseLine: (): ParsedEvent[] => [] };

let tmpDir: string;
let hangScript: string;   // writes periodic stdout, NEVER exits on its own
let exitScript: string;   // writes once, exits 0

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cliinvoker-'));
  hangScript = path.join(tmpDir, 'hang.js');
  exitScript = path.join(tmpDir, 'exit.js');
  // Periodic bytes keep the byte-idle timer alive; the process never exits.
  // Ignore termination signals on POSIX so we also exercise the force-settle
  // path (resolve even when the child won't 'close' promptly). On Windows the
  // tree-kill (taskkill /F) is unconditional, so the grace-settle covers it.
  fs.writeFileSync(hangScript,
    "process.on('SIGTERM', () => {}); process.on('SIGINT', () => {});\n" +
    "setInterval(() => process.stdout.write('tick\\n'), 50);\n");
  fs.writeFileSync(exitScript, "process.stdout.write('done\\n');\n");
});

afterAll(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

describe('CLIInvoker — invoke() must never hang when a timer fires', () => {
  it('resolves via the no-content timeout for a child that streams bytes but no reasoning', async () => {
    const start = Date.now();
    const result = await new CLIInvoker().invoke({
      command: 'node', args: [hangScript], stdinContent: '',
      timeoutSeconds: 30,          // wall-clock far away — the no-content timer must win
      idleTimeoutSeconds: 30,      // bytes flow every 50ms, so idle never fires
      noContentTimeoutSeconds: 1,  // no agent_reasoning_step ever → fires at ~1s
      outputParser: emptyParser,
    });
    const elapsed = Date.now() - start;
    expect(result.noContentTimedOut).toBe(true);
    // ~1s timeout + 5s kill grace, well under the 30s wall-clock.
    expect(elapsed).toBeLessThan(12_000);
  }, 20_000);

  it('resolves via the wall-clock process timeout for a never-exiting child', async () => {
    const start = Date.now();
    const result = await new CLIInvoker().invoke({
      command: 'node', args: [hangScript], stdinContent: '',
      timeoutSeconds: 1,
      idleTimeoutSeconds: 30,
      noContentTimeoutSeconds: 0,  // disabled — the wall-clock must settle it
      outputParser: emptyParser,
    });
    const elapsed = Date.now() - start;
    expect(result.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(12_000);
  }, 20_000);

  it('resolves normally (no timeout flags) for a child that exits on its own', async () => {
    const result = await new CLIInvoker().invoke({
      command: 'node', args: [exitScript], stdinContent: '',
      timeoutSeconds: 30, idleTimeoutSeconds: 30, noContentTimeoutSeconds: 30,
      outputParser: emptyParser,
    });
    expect(result.timedOut).toBe(false);
    expect(result.noContentTimedOut).toBe(false);
    expect(result.exitCode).toBe(0);
  }, 20_000);
});
