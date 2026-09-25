// ⭐ `JAN-CRITREAD` J2-3 — NO TEST OF THE REVIEWER-QUALIFICATION HARNESS CAN REACH A REAL REVIEWER, BY CONSTRUCTION.
//
// The harness's programs are real: `agy` and `devin` on PATH are the paid frontier reviewers, and the machine these
// tests run on may BE the shared Ollama server (`REG-F-427`). Since the fingerprint was wired, a spawned runner that
// passes its refusals goes on to its transport — so a test that spawns the runner, the check or the fingerprint, or
// loads a product transport, must not be one mutant away from any of them:
//   · a SPAWNED child runs bun by absolute path, with a PATH of exactly two directories — bun's and git's — each checked
//     to hold no `agy`, `devin` or `ollama`, and with no program override, model variable or `OLLAMA_HOST` inherited
//     (`hermeticEnv`);
//   · IN PROCESS, a file that loads a product transport or computes a fingerprint runs with PATH pointed at an EMPTY
//     directory (`NO_PROGRAMS`), so even an exec seam a mutant bypassed would find no program to start;
//   · and the runner reaches only the Ollama server its command line names (`run.ts`: `--ollama-url` is required,
//     with no default and no environment fallback).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { PROGRAM_OVERRIDE_VARIABLES } from '../scripts/reviewer-qual/preflight.js';

/** The programs no test may reach. */
const REVIEWER_PROGRAMS = ['agy', 'devin', 'ollama'] as const;
/** Every spelling a Windows or POSIX PATH search would start. */
const EXTENSIONS = ['', '.exe', '.cmd', '.bat', '.com', '.ps1'] as const;
/** What a harness child never inherits: a program override (`REG-F-441`), a model variable, an Ollama server. */
const NEVER_INHERITED: ReadonlySet<string> = new Set([
	...PROGRAM_OVERRIDE_VARIABLES,
	'JPWB_JUDGE_MODEL',
	'JPWB_ASSURANCE_MODEL',
	'OLLAMA_HOST'
]);

/** Where a program resolves on the PATH this process STARTED with — read at load, before any test stubs PATH. */
function located(program: string): string {
	const probe =
		process.platform === 'win32'
			? spawnSync('where', [program], { encoding: 'utf8', windowsHide: true })
			: spawnSync('which', [program], { encoding: 'utf8' });
	const first = (probe.stdout ?? '').split(/\r?\n/).find((l) => l.trim() !== '');
	if (probe.status !== 0 || !first) throw new Error(`hermetic: ${program} is not on PATH — ${probe.stderr ?? ''}`);
	return first.trim();
}

/** bun and git, by absolute path — what a hermetic test spawns, never a name a PATH search resolves. */
export const BUN = located('bun');
export const GIT = located('git');
/** The only directories a spawned harness child may search for a program. */
const HERMETIC_PATH: readonly string[] = [...new Set([dirname(BUN), dirname(GIT)])];

/** Every reviewer program in `dirs`, by path. Empty, or the construction does not hold. */
export function reviewerProgramsIn(dirs: readonly string[]): string[] {
	return dirs
		.flatMap((d) => REVIEWER_PROGRAMS.flatMap((p) => EXTENSIONS.map((x) => join(d, `${p}${x}`))))
		.filter((f) => existsSync(f));
}

/**
 * An EMPTY directory, for PATH in a process that must find no program at all. ⛔ Refused if anything is in it — a
 * program placed there would be found.
 */
export const NO_PROGRAMS: string = (() => {
	const dir = join(tmpdir(), 'jpwb-no-programs');
	mkdirSync(dir, { recursive: true });
	if (readdirSync(dir).length > 0) throw new Error(`hermetic: ${dir} is not empty, so it cannot stand for "no program"`);
	return dir;
})();

/**
 * The environment a spawned harness child runs in: this process's, less every spelling of PATH, every `GIT_*` variable
 * and everything in `NEVER_INHERITED`, with PATH = bun's and git's directories, then `extra`. ⛔ Throws if either directory holds a
 * reviewer program: then the construction does not hold on this machine, and no harness child may be spawned.
 */
export function hermeticEnv(extra: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
	const found = reviewerProgramsIn(HERMETIC_PATH);
	if (found.length > 0)
		throw new Error(`hermetic: a reviewer program sits beside bun or git — ${found.join(', ')}; no harness child may be spawned`);
	const env: Record<string, string> = {};
	// Nor any `GIT_*` variable: a `GIT_DIR` or `GIT_INDEX_FILE` inherited from a hook would point a fixture's git at
	// THIS repository's index.
	for (const [k, v] of Object.entries(process.env))
		if (v !== undefined && !/^path$/i.test(k) && !/^GIT_/i.test(k) && !NEVER_INHERITED.has(k)) env[k] = v;
	return { ...env, PATH: HERMETIC_PATH.join(delimiter), ...extra };
}

/** The PATH a hermetic child searches — for a test to show what it is. */
export const HERMETIC_SEARCH_PATH: readonly string[] = HERMETIC_PATH;
