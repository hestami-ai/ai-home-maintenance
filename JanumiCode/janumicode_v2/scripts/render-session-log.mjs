#!/usr/bin/env node
/**
 * Render an interactive-session stream log (raw PTY bytes) into a readable
 * transcript by replaying it through @xterm/headless — the SAME screen model
 * the perception layer uses live. This resolves cursor motion, line rewrites,
 * and spinner overdraws correctly; a regex control-character strip cannot
 * (every spinner redraw would survive as its own garbage line).
 *
 * Note: the raw capture ends the moment the adapter detects completion and
 * closes the PTY — the file's final bytes are whatever redraw was mid-flight
 * (often a spinner) plus the CLI's terminal-reset sequences. The rendered
 * transcript shows the true final screen; the authoritative outcome lives in
 * the sibling `.log` invocation trailer and the governed-stream agent_output.
 *
 * Usage:
 *   node scripts/render-session-log.mjs <path/to/x.stream.log> [--cols 210] [--rows 40]
 *   node scripts/render-session-log.mjs <x.stream.log> --squeeze   # collapse runs of blank lines
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Terminal } = require('@xterm/headless');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: render-session-log.mjs <stream.log> [--cols N] [--rows N] [--squeeze]');
  process.exit(2);
}
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
};
// Default 210: ConPTY sessions render for the resized width (slice-142 capture
// addressed col 209 on a 120-col request; the adapter resizes to 210).
const cols = flag('cols', 210);
const rows = flag('rows', 40);
const squeeze = args.includes('--squeeze');

const raw = readFileSync(file);
// Harness header (invocation id / role / label) sits above the stdout
// separator; PTY bytes follow it. Print the header verbatim.
const SEP = Buffer.from('──[stdout]──', 'utf-8');
const sepIdx = raw.indexOf(SEP);
let header = '';
let stream = raw;
if (sepIdx >= 0) {
  const nl = raw.indexOf(0x0a, sepIdx);
  header = raw.subarray(0, sepIdx).toString('utf-8');
  stream = raw.subarray(nl >= 0 ? nl + 1 : sepIdx + SEP.length);
}

const term = new Terminal({ cols, rows, scrollback: 100_000, allowProposedApi: true });
await new Promise((resolve) => term.write(stream, resolve));

const buf = term.buffer.active;
const lines = [];
for (let i = 0; i < buf.length; i++) {
  lines.push(buf.getLine(i)?.translateToString(true).trimEnd() ?? '');
}
// Trim trailing blank region (viewport below the last content).
while (lines.length && lines[lines.length - 1] === '') lines.pop();

let out = lines;
if (squeeze) {
  out = [];
  let blanks = 0;
  for (const l of lines) {
    if (l === '') { if (++blanks > 1) continue; } else blanks = 0;
    out.push(l);
  }
}

if (header) process.stdout.write(header.trimEnd() + '\n' + '═'.repeat(74) + '\n');
process.stdout.write(out.join('\n') + '\n');
