/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — `REG-F-584`'s buffer (its marker of 2026-11-18; the lead's ruling 1 on L17b2's Stage 0) —
 * `mutants:changed` READS THE WHOLE CHANGE SET, and a read that fails says why.
 *
 * ⛔ WHAT WAS WRONG. `scope.ts` read `git diff` through `spawnSync`'s default buffer, 1 MiB. A larger change set ended the tool with
 * *"mutants:changed — git diff failed: "* and nothing after: the call itself returned status null, signal SIGTERM, error ENOBUFS and
 * 1,077,248 characters of a partial diff (L17b2 Stage 0, measured on a copy of the tool), and the tool named none of it. L17b3's re-check
 * round met it at 1,285,386 bytes; the package's whole tree as one diff is 91,574,677 bytes, past a 64 MiB bound too.
 * ⭑ WHY THE CLI IS DRIVEN HERE, where `mutants-scope.test.ts` drives the pure core: the defect is in how the tool READS, which no fixture of
 * the parser reaches. So the REAL `scope.ts` and `scope-core.ts` are copied into a mkdtemp tree beside a stand-in ledger — one entry,
 * anchored in a file whose change the diff shows after its first 1,048,576 bytes, so only a whole read selects it — the tree is
 * git-initialised, and the tool is spawned by bun's absolute path in the hermetic environment (`gate-tail.test.ts`'s form). Nothing it
 * runs can reach this repository: its root is the copy's.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
// ⭐ Read through the module, so that before the code lands only the test that calls it is red, never the file's load.
import * as scopeCore from '../scripts/mutants/scope-core.js';
import { BUN, GIT, hermeticEnv } from './reviewer-qualification-hermetic.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MIB = 1024 * 1024;
/** The stand-in entry's id, and the line it anchors on, in the file whose hunk comes after the big one. */
const GUARD_ID = 'STANDIN-SCOPE-M1-anchored-after-the-first-mib';
const ANCHOR = 'export const GUARDED_LINE_AFTER_THE_FIRST_MIB = true;';

const dirs: string[] = [];
afterAll(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function git(cwd: string, args: readonly string[]): string {
	const r = spawnSync(GIT, [...args], { cwd, encoding: 'utf8', maxBuffer: 256 * MIB, windowsHide: true, env: hermeticEnv() });
	if (r.error !== undefined) throw r.error;
	if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
	return r.stdout;
}

/**
 * A copy of the tool over a change set of two files: `a-big.ts`, `bigLines` lines changed, and `b-guarded.ts`, its one changed line
 * the stand-in entry's anchor — git orders `a-` before `b-`, so the guarded file's hunk follows the big one's in the diff.
 */
function toolOver(bigLines: number): { readonly root: string; readonly diffBytes: number } {
	const root = mkdtempSync(join(tmpdir(), 'jpwb-scope-change-set-'));
	dirs.push(root);
	mkdirSync(join(root, 'scripts', 'mutants'), { recursive: true });
	mkdirSync(join(root, 'packages', 'p', 'src'), { recursive: true });
	for (const f of ['scope.ts', 'scope-core.ts'])
		copyFileSync(join(ROOT, 'scripts', 'mutants', f), join(root, 'scripts', 'mutants', f));
	writeFileSync(
		join(root, 'scripts', 'mutants', 'ledger.ts'),
		[
			'export interface DeclaredMutant { readonly id: string; readonly file: string; readonly find: string }',
			`export const DECLARED_MUTANTS: readonly DeclaredMutant[] = [{ id: ${JSON.stringify(GUARD_ID)}, file: 'packages/p/src/b-guarded.ts', find: ${JSON.stringify(ANCHOR)} }];`,
			'export function isHistory(_m: DeclaredMutant): boolean { return false; }',
			''
		].join('\n')
	);
	writeFileSync(join(root, 'packages', 'p', 'src', 'a-big.ts'), 'export const FIRST = 1;\n');
	writeFileSync(join(root, 'packages', 'p', 'src', 'b-guarded.ts'), 'export const BEFORE = 1;\n');
	git(root, ['init', '--quiet']);
	git(root, ['config', 'user.name', 'Scope Change Set Test']);
	git(root, ['config', 'user.email', 'scope-change-set@example.invalid']);
	git(root, ['config', 'core.autocrlf', 'false']);
	git(root, ['add', '-A']);
	git(root, ['commit', '--quiet', '-m', 'base']);
	const body: string[] = [];
	for (let i = 0; i < bigLines; i++) body.push(`export const LINE_${String(i).padStart(7, '0')} = '${'x'.repeat(40)}';`);
	writeFileSync(join(root, 'packages', 'p', 'src', 'a-big.ts'), `${body.join('\n')}\n`);
	writeFileSync(join(root, 'packages', 'p', 'src', 'b-guarded.ts'), `${ANCHOR}\n`);
	const diffBytes = Buffer.byteLength(git(root, ['diff', '--unified=0', '--no-color', '--relative', 'HEAD']), 'utf8');
	return { root, diffBytes };
}

/** The tool, spawned in the copy as `bun run mutants:changed` spawns it, with what it printed; `extra` set in its environment (§20). */
function scope(
	root: string,
	args: readonly string[] = [],
	extra: Readonly<Record<string, string>> = {}
): { readonly status: number | null; readonly stdout: string; readonly stderr: string } {
	const r = spawnSync(BUN, ['run', join(root, 'scripts', 'mutants', 'scope.ts'), ...args], {
		cwd: root,
		encoding: 'utf8',
		maxBuffer: 256 * MIB,
		env: hermeticEnv(extra),
		windowsHide: true
	});
	return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('⭐⭐ L17b2 — REG-F-584’s buffer: mutants:changed reads the whole change set, and a read that fails says why (ruling 1)', () => {
	it('⛔ RED FIRST — a change set past 1 MiB is read whole: the banner counts both files’ hunks, and the guard anchored in the hunk after the first MiB is selected', () => {
		const { root, diffBytes } = toolOver(25_000);
		expect(diffBytes, 'arrangement: the change set is past 1 MiB').toBeGreaterThan(MIB);
		const r = scope(root);
		expect.soft(r.stderr, 'the read of the change set failed').not.toContain('mutants:changed — git diff failed:');
		expect.soft(r.status, `the tool's own words: ${r.stderr}`).toBe(0);
		expect.soft(r.stdout, 'both files’ hunks are not counted').toContain('mutants:changed — 2 changed hunk(s), 2 in production source.');
		expect.soft(r.stdout, 'the guard past the first MiB is not selected').toContain(`    GUARD  packages/p/src/b-guarded.ts:1-1  ${GUARD_ID}`);
	}, 120_000);

	it('⛔ RED FIRST — a read that fails is named by its cause: the status, the signal, the error’s code and message, and stderr; and no change set is read from a partial stdout', () => {
		const enobufs = Object.assign(new Error('spawnSync git ENOBUFS (stdout or stderr buffer reached maxBuffer size limit)'), { code: 'ENOBUFS' });
		const failed = scopeCore.changeSetReadFailure({ status: null, signal: 'SIGTERM', error: enobufs, stderr: '' });
		expect.soft(failed, 'a failed read is not named').toBeTypeOf('string');
		for (const part of ['status null', 'signal SIGTERM', 'ENOBUFS', 'spawnSync git ENOBUFS (stdout or stderr buffer reached maxBuffer size limit)'])
			expect.soft(failed, `the failure does not name ${part}`).toContain(part);
		const refused = scopeCore.changeSetReadFailure({ status: 128, signal: null, stderr: "fatal: ambiguous argument 'nosuch..alsonot'" });
		expect.soft(refused, 'git’s own failure is not named').toContain('status 128');
		expect.soft(refused, 'git’s own words are not named').toContain("fatal: ambiguous argument 'nosuch..alsonot'");
		expect.soft(scopeCore.changeSetReadFailure({ status: 0, signal: null, stderr: '' }), 'a completed read is named a failure').toBeUndefined();
	});

	it('⭑ CONTROL — a change set under 1 MiB is read and its guard selected, as before', () => {
		const { root, diffBytes } = toolOver(2_000);
		expect(diffBytes, 'arrangement: the change set is under 1 MiB').toBeLessThan(MIB);
		const r = scope(root);
		expect.soft(r.status, `the tool's own words: ${r.stderr}`).toBe(0);
		expect.soft(r.stdout).toContain('mutants:changed — 2 changed hunk(s), 2 in production source.');
		expect.soft(r.stdout).toContain(`    GUARD  packages/p/src/b-guarded.ts:1-1  ${GUARD_ID}`);
	}, 120_000);

	it('⭑ CONTROL — git’s own failure still ends the tool, exit 2, in git’s words', () => {
		const { root } = toolOver(10);
		const r = scope(root, ['--range=nosuch..alsonot']);
		expect.soft(r.status, r.stdout).toBe(2);
		expect.soft(r.stderr).toContain('mutants:changed — git diff failed:');
		expect.soft(r.stderr).toContain("ambiguous argument 'nosuch..alsonot'");
	}, 120_000);

	// ⭐⭐ §20 — the lead's ruling 1 on §19.13: THE CHANGE SET'S FOLDER IS REMOVED, AND THE READ'S OWN FAILURE IS NAMED. Ruling 1 reads the
	// change set from a file in a fresh temporary folder and removes the folder after; the four tests above hold the read and git's
	// failure but look at no folder, so a mutant dropping the removal survived them. Here the tool runs with its temporary folder — TMP,
	// TEMP and TMPDIR — pointed at one of the test's own, empty before: after a read git completes, and after one git refuses, it holds no
	// change-set folder. ⭑ And with that folder absent the tool's own read fails before git is asked — `readChangeSet`'s catch — named
	// with its cause and the folder it was given, exit 2: which also shows the tool takes its folder from these variables, so the empty
	// folder above is no vacuous pass.
	const ownTemp = (): string => {
		const d = mkdtempSync(join(tmpdir(), 'jpwb-scope-own-temp-'));
		dirs.push(d);
		return d;
	};
	const changeSetFolders = (d: string): string[] => readdirSync(d).filter((f) => f.startsWith('jpwb-mutants-change-set-'));

	it('⭐ the change set’s folder is removed after the read — after one git completes and after one git refuses', () => {
		const { root } = toolOver(10);
		const temp = ownTemp();
		const env = { TMP: temp, TEMP: temp, TMPDIR: temp };
		expect(readdirSync(temp), 'arrangement: the folder is empty').toEqual([]);
		const read = scope(root, [], env);
		expect.soft(read.status, `the read: ${read.stderr}`).toBe(0);
		expect.soft(changeSetFolders(temp), 'a folder left after a read git completed').toEqual([]);
		const refused = scope(root, ['--range=nosuch..alsonot'], env);
		expect.soft(refused.status, refused.stdout).toBe(2);
		expect.soft(changeSetFolders(temp), 'a folder left after a read git refused').toEqual([]);
	}, 120_000);

	it('⭐ the read’s own failure — its temporary folder cannot be made — is named with its cause, and ends the tool as git’s does, exit 2', () => {
		const { root } = toolOver(10);
		const missing = join(ownTemp(), 'missing');
		const r = scope(root, [], { TMP: missing, TEMP: missing, TMPDIR: missing });
		expect.soft(r.status, r.stdout).toBe(2);
		expect.soft(r.stderr).toContain('mutants:changed — git diff failed: the change set could not be read: ');
		expect.soft(r.stderr, 'the cause, named').toContain('ENOENT');
		expect.soft(r.stderr, 'the folder the tool was given').toContain(missing);
		expect.soft(r.stdout, 'a change set read').not.toContain('changed hunk(s)');
	}, 120_000);
});
