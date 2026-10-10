// ⛔ A BROKEN FIXTURE (`verif/phase7-seeded-faults.test.ts`): end-to-end tests that DO start the real tool, and are too weak
// to catch four of the seven seeded variants. Each gap is deliberate and named:
//   · the default N is tested on three distinct words, so a default of 20 prints the same three lines;
//   · no input holds a tie met out of ascending order, so ties left in first-seen order go unnoticed;
//   · an unknown option and a missing file are checked only for a non-zero exit, so a wrong non-zero code passes.
// What it does test — standard input, case folding and stop words — catches the other three variants.
// ⛔ AND IT IS THE SPAWN CHECK'S CONTROL FOR A WEAK TEST THAT STILL SPAWNS (`verif/phase7-spawn-check.test.ts`): the last two
// tests start the tool and pass against a stub that does nothing but exit 99, so they must be named STUB_UNDETECTED —
// tests that ran the entry — never tests that never ran it.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../../bin/wordfreq.js', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'wordfreq-weak-e2e-'));
after(() => rmSync(dir, { recursive: true, force: true }));

function wordfreq(args, input = '') {
	return spawnSync(process.execPath, [BIN, ...args], { cwd: dir, input, encoding: 'utf8', timeout: 30_000 });
}

test('a file, default N', () => {
	writeFileSync(join(dir, 'in.txt'), 'cat dog cat bird cat dog');
	assert.equal(wordfreq(['in.txt']).stdout, '3 cat\n2 dog\n1 bird\n');
});

test('standard input', () => {
	assert.equal(wordfreq([], 'red blue red').stdout, '2 red\n1 blue\n');
});

test('case folding', () => {
	assert.equal(wordfreq([], 'The the THE').stdout, '3 the\n');
});

test('stop words', () => {
	writeFileSync(join(dir, 'stop.txt'), 'the\n');
	assert.equal(wordfreq(['--stop-words', 'stop.txt'], 'the cat the cat dog').stdout, '2 cat\n1 dog\n');
});

test('an unknown option fails', () => {
	assert.notEqual(wordfreq(['--bogus']).status, 0);
});

test('a missing file fails', () => {
	assert.notEqual(wordfreq(['no-such-file.txt']).status, 0);
});
