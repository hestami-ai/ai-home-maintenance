import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EXIT, run } from '../../src/cli.js';
import { USAGE } from '../../src/options.js';

/** An io whose files are `files` and whose standard input is `stdin`; it records what was written. */
function fakeIo({ files = {}, stdin = '' } = {}) {
	const io = {
		stdout: '',
		stderr: '',
		stdinReads: 0,
		readFile: async (path) => {
			if (path in files) return files[path];
			throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
		},
		readStdin: async () => {
			io.stdinReads += 1;
			return stdin;
		},
		out: (text) => {
			io.stdout += text;
		},
		err: (text) => {
			io.stderr += text;
		}
	};
	return io;
}

describe('run', () => {
	test('the exit codes are the brief’s', () => {
		assert.deepEqual({ ...EXIT }, { OK: 0, UNREADABLE: 1, USAGE: 2 });
	});

	test('reads the named file, not standard input', async () => {
		const io = fakeIo({ files: { 'in.txt': 'b a b' }, stdin: 'z z z' });
		assert.equal(await run(['in.txt'], io), 0);
		assert.equal(io.stdout, '2 b\n1 a\n');
		assert.equal(io.stdinReads, 0);
		assert.equal(io.stderr, '');
	});

	test('reads standard input when no file is given, and when the file is "-"', async () => {
		for (const argv of [[], ['-']]) {
			const io = fakeIo({ stdin: 'x y x' });
			assert.equal(await run(argv, io), 0);
			assert.equal(io.stdout, '2 x\n1 y\n');
			assert.equal(io.stdinReads, 1);
		}
	});

	test('prints the top N', async () => {
		const io = fakeIo({ stdin: 'a a a b b c' });
		assert.equal(await run(['-n', '2'], io), 0);
		assert.equal(io.stdout, '3 a\n2 b\n');
	});

	test('folds case unless --case-sensitive', async () => {
		const folded = fakeIo({ stdin: 'The the THE' });
		await run([], folded);
		assert.equal(folded.stdout, '3 the\n');
		const sensitive = fakeIo({ stdin: 'The the the' });
		await run(['--case-sensitive'], sensitive);
		assert.equal(sensitive.stdout, '2 the\n1 The\n');
	});

	test('leaves out the stop words, folded unless --case-sensitive', async () => {
		const files = { 'stop.txt': 'THE\nand\n' };
		const folded = fakeIo({ files, stdin: 'the cat and The dog' });
		assert.equal(await run(['--stop-words', 'stop.txt'], folded), 0);
		assert.equal(folded.stdout, '1 cat\n1 dog\n');
		const sensitive = fakeIo({ files, stdin: 'the THE cat' });
		assert.equal(await run(['--case-sensitive', '--stop-words', 'stop.txt'], sensitive), 0);
		assert.equal(sensitive.stdout, '1 cat\n1 the\n');
	});

	test('a usage error exits 2 with one line on standard error', async () => {
		const io = fakeIo();
		assert.equal(await run(['--bogus'], io), 2);
		assert.equal(io.stderr, "wordfreq: unknown option '--bogus'\n");
		assert.equal(io.stdout, '');
		const badN = fakeIo();
		assert.equal(await run(['-n', '0'], badN), 2);
		assert.equal(badN.stderr, "wordfreq: -n must be a positive integer, not '0'\n");
	});

	test('a missing file exits 1 with one line on standard error', async () => {
		const io = fakeIo();
		assert.equal(await run(['missing.txt'], io), 1);
		assert.equal(io.stderr, "wordfreq: cannot read 'missing.txt': no such file\n");
		assert.equal(io.stdout, '');
	});

	test('a missing stop-word file exits 1 with one line on standard error', async () => {
		const io = fakeIo({ stdin: 'a' });
		assert.equal(await run(['--stop-words', 'none.txt'], io), 1);
		assert.equal(io.stderr, "wordfreq: cannot read stop-word file 'none.txt': no such file\n");
	});

	test('unreadable standard input is named as standard input', async () => {
		const io = fakeIo();
		io.readStdin = async () => {
			throw Object.assign(new Error('closed'), { code: 'EPIPE' });
		};
		assert.equal(await run([], io), 1);
		assert.equal(io.stderr, 'wordfreq: cannot read standard input: EPIPE\n');
	});

	test('a directory and a denied file say why', async () => {
		const io = fakeIo();
		io.readFile = async () => {
			throw Object.assign(new Error('dir'), { code: 'EISDIR' });
		};
		assert.equal(await run(['docs'], io), 1);
		assert.equal(io.stderr, "wordfreq: cannot read 'docs': is a directory\n");
		const denied = fakeIo();
		denied.readFile = async () => {
			throw Object.assign(new Error('denied'), { code: 'EACCES' });
		};
		assert.equal(await run(['secret.txt'], denied), 1);
		assert.equal(denied.stderr, "wordfreq: cannot read 'secret.txt': permission denied\n");
	});

	test('help prints usage to standard output and exits 0', async () => {
		const io = fakeIo();
		assert.equal(await run(['--help'], io), 0);
		assert.equal(io.stdout, `${USAGE}\n`);
		assert.equal(io.stderr, '');
	});

	test('an error that is not a usage error is not swallowed', async () => {
		const io = fakeIo();
		io.readFile = async () => 'x';
		io.out = () => {
			throw new TypeError('broken stream');
		};
		await assert.rejects(run(['in.txt'], io), TypeError);
	});
});
