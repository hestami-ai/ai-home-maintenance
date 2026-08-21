import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-structural-module-reachability.ts', import.meta.url)
);

function run(args: readonly string[], input?: string) {
	return spawnSync('bun', [SCRIPT, ...args], {
		cwd: REPOSITORY_ROOT,
		encoding: 'utf8',
		input,
		windowsHide: true
	});
}

describe('structural module reachability command adapter', () => {
	it.each([
		{ args: [] },
		{ args: ['--unknown'] },
		{ args: ['--request'] },
		{ args: ['--stdin', '--stdin'] },
		{ args: ['--request', 'one.json', '--stdin'] }
	] as const)('rejects invalid request-source arguments: $args', ({ args }) => {
		const result = run(args);
		expect(result.status, args.join(' ')).toBe(2);
		expect(result.stdout).toBe('');
		expect(JSON.parse(result.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Use exactly one of --stdin or --request <json-file>.'
		});
	});

	it('keeps malformed stdin off stdout and returns one structured diagnostic', () => {
		const result = run(['--stdin'], '{not json');
		expect(result.status).toBe(2);
		expect(result.stdout).toBe('');
		expect(result.stderr.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(result.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input is not valid JSON.'
		});
	});

	it('bounds request-file reads before parsing', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-command-request-'));
		const requestPath = join(root, 'oversized.json');
		try {
			writeFileSync(requestPath, Buffer.alloc(1024 * 1024 + 1, 0x20));
			const result = run(['--request', requestPath]);
			expect(result.status).toBe(2);
			expect(result.stdout).toBe('');
			expect(JSON.parse(result.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'Request input exceeds 1 MiB.'
			});
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});
});
