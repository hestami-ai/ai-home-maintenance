#!/usr/bin/env node
// wordfreq's entry: the process's own streams and files, handed to `run`. The exit code is set rather than forced,
// so a large output written to a pipe is flushed before the process ends.
import { readFile } from 'node:fs/promises';
import { run } from '../src/cli.js';

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString('utf8');
}

process.exitCode = await run(process.argv.slice(2), {
	readFile: (path) => readFile(path, 'utf8'),
	readStdin,
	out: (text) => process.stdout.write(text),
	err: (text) => process.stderr.write(text)
});
