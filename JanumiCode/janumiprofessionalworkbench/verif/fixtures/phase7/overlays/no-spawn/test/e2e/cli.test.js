// ⛔ A BROKEN FIXTURE (`verif/phase7-spawn-check.test.ts`): "end-to-end" tests that never start the tool. They import the
// product's own module and call it in process, so they pass whatever bin/wordfreq.js holds — the shape the spawn check
// exists to catch. They are otherwise sound: every assertion is true of a correct product.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../../src/cli.js';

function fakeIo(stdin) {
	const io = {
		stdout: '',
		readFile: async () => {
			throw Object.assign(new Error('missing'), { code: 'ENOENT' });
		},
		readStdin: async () => stdin,
		out: (text) => {
			io.stdout += text;
		},
		err: () => {}
	};
	return io;
}

test('counts standard input', async () => {
	const io = fakeIo('b a b');
	assert.equal(await run([], io), 0);
	assert.equal(io.stdout, '2 b\n1 a\n');
});

test('an unknown option exits 2', async () => {
	assert.equal(await run(['--bogus'], fakeIo('')), 2);
});

test('a missing file exits 1', async () => {
	assert.equal(await run(['missing.txt'], fakeIo('')), 1);
});
