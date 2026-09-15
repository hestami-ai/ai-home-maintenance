/**
 * gen:check — THE GENERATED-ARTIFACT FRESHNESS GATE. `bun run scripts/gen-freshness.ts`
 *
 * ── WHY THIS EXISTS, AND WHAT WAS ACTUALLY UNGATED ──────────────────────────────────────────────────────────
 * `REG-005` carries this as an open finding in one line: *"No `gen` freshness gate exists. `bun run gen` is
 * outside `gate:fast`, so every generated contract under `packages/rph-contracts/schemas/` can diverge from its
 * source unnoticed. Surfaced by `S0.3`; scoped, not built."*
 *
 * ⚠ **THE FINDING NAMES THE WRONG ARTIFACT, AND CORRECTING IT IS WHAT MADE THIS SCRIPT WORTH WRITING.**
 * `schemas/` is ALREADY gated: `packages/rph-contracts/src/json-schema.test.ts` compares **every** committed
 * artifact against `emittedSchemas()`, and `N-14` is the increment that made that total. What was gated NOWHERE
 * is the link one step upstream —
 *
 *      vocab/*.json ──(THIS SCRIPT)──▶ enums.ts · objects.ts · messages.ts ──(json-schema.test.ts)──▶ schemas/
 *                     ⛔ ungated until R11                                    ⭑ already total
 *
 * ── ⭐ THE THREE DRIVES THAT ESTABLISHED IT, EACH WITH ITS CONTROL (R11, 2026-09-15) ────────────────────────
 *   · a field added BY HAND to `RecordModelExchangePayloadSchema` in the generated `messages.ts`
 *         → this gate RED · the contracts suite **324/324 GREEN**
 *   · `m3-commands-events.json` edited and the generators NOT re-run
 *         → this gate RED · the contracts suite **324/324 GREEN**
 *   · `m1-object-fields.json` edited and the generators NOT re-run
 *         → this gate RED · the contracts suite RED too — **one** test, `objects.test.ts`'s MODEL_EXCHANGE pin
 * ⭑ THE THIRD IS RECORDED BECAUSE IT QUALIFIES THE CLAIM RATHER THAN SUPPORTING IT: the m1 direction had
 * PARTIAL existing coverage, for whichever objects somebody had pinned by hand. `messages.ts` had none at all —
 * no command or event payload is emitted as JSON Schema, so a hand-edited payload was compared against nothing.
 *
 * ── HOW IT CHECKS: A DISPOSABLE COPY, NEVER THE TREE IT MEASURES ────────────────────────────────────────────
 * ⛔ THE OBVIOUS IMPLEMENTATION IS THE FORBIDDEN ONE. *"Snapshot the generated files, run `bun run gen`, diff,
 * restore"* edits the very thing it measures, and a `finally` does not run on a KILL — an interrupted run would
 * leave regenerated files in the working tree and the next commit would carry them as though authored. This
 * copies each package into a fresh `mkdtemp` directory and runs the generators THERE; a kill leaks one scratch
 * directory and touches nothing the gate reads.
 *
 * ⚠ THE COPY LIVES UNDER `node_modules/`, AND THAT IS A DELIBERATE CHOICE WITH A COST. `os.tmpdir()` was the
 * first attempt and it FAILED, observed: `emit.ts` reaches `zod` through `schema-manifest.ts`, and a copy
 * outside the repository resolves no dependency at all — `ENOENT while resolving package 'zod'`. The two repairs
 * available were a `node_modules` JUNCTION inside the copy — which puts a link into the path a recursive
 * `rmSync` later walks, one filesystem-semantics mistake away from deleting the repository's own dependencies —
 * and this one, where the copy sits inside `node_modules` so resolution walks up to it naturally and the removal
 * is confined to a directory this script created and that contains no links. ⛔ Its one cost is paid explicitly:
 * prettier IGNORES `node_modules` by default, so the format step passes `--with-node-modules`. That flag changes
 * only WHICH FILES prettier will touch, never how it formats them.
 *
 * ⭑ AND IT RUNS THE REAL GENERATORS, NOT A REIMPLEMENTATION. The steps are PARSED OUT OF each package's own
 * `gen` script, so a generator added there is picked up with no edit here, and a step the parser does not
 * recognise is a HARD FAILURE rather than a skip.
 *
 * ⚠ PRETTIER IS GIVEN AN EXPLICIT `--config`, NOT LEFT TO RESOLVE ONE. Prettier resolves configuration by
 * walking up from each FILE, and what it would find from inside a scratch copy is not guaranteed to be the
 * config the real `gen:format` used — a silent fall back to library defaults would make EVERY generated file
 * report drift, which reads as a catastrophic finding and is an instrument fault. `verif/gen-freshness.test.ts`
 * pins that the config named here is the repository's own.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareTrees, genPackages, NOT_SOURCE } from './gen-freshness-core.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url)).split('\\').join('/');
const PRETTIER_CONFIG = `${ROOT}.prettierrc.json`;
const PRETTIER_CLI = `${ROOT}node_modules/prettier/bin/prettier.cjs`;

function fail(message: string): never {
	process.stderr.write(`gen:check — ${message}\n`);
	process.exit(1);
}

function run(command: string, args: string[], cwd: string): void {
	const r = spawnSync(command, args, { cwd, encoding: 'utf8' });
	if (r.status !== 0)
		fail(
			`a generator step failed in the disposable copy: ${command} ${args.join(' ')}\n${r.stdout ?? ''}${r.stderr ?? ''}`
		);
}

let packages;
try {
	packages = genPackages(ROOT);
} catch (e) {
	fail(e instanceof Error ? e.message : String(e));
}
if (packages.length === 0)
	fail(
		'no workspace package declares a `gen` script, so this gate would pass vacuously. Three did when it was written (rph-contracts, rph-domain, rph-product-realization-pwa).'
	);

const scratch = mkdtempSync(join(ROOT, 'node_modules', '.jpwb-gen-freshness-'));
const drifted: string[] = [];
try {
	for (const pkg of packages) {
		const source = join(ROOT, pkg.dir);
		const copy = join(scratch, pkg.dir.split('/').join('__'));
		cpSync(source, copy, {
			recursive: true,
			filter: (from) => !NOT_SOURCE.has(from.split(/[\\/]/).pop() ?? '')
		});
		for (const generator of pkg.generators) run(process.execPath, [generator], copy);
		if (pkg.formatted.length > 0)
			run(
				process.execPath,
				[
					PRETTIER_CLI,
					'--write',
					'--log-level',
					'warn',
					'--with-node-modules',
					'--config',
					PRETTIER_CONFIG,
					...pkg.formatted
				],
				copy
			);
		drifted.push(...compareTrees(pkg.dir, source, copy));
	}
} finally {
	// ⚠ NOTHING IN HERE MAY THROW. A cleanup failure must not replace the verdict this run computed.
	try {
		rmSync(scratch, { recursive: true, force: true });
	} catch {
		/* a leaked scratch directory is a smaller harm than a lost verdict */
	}
}

if (drifted.length > 0) {
	process.stderr.write(
		`gen:check — ${drifted.length} GENERATED ARTIFACT(S) DO NOT MATCH THEIR SOURCE:\n` +
			drifted.map((d) => `  · ${d}\n`).join('') +
			'\n⛔ NO DERIVED ARTIFACT IS HAND-EDITED. Change the vocabulary (or the generator), run `bun run gen`,\n' +
			'and commit the regenerated files in the SAME commit — a generated file edited by hand is a contract\n' +
			'whose source no longer describes it, and nothing downstream can tell.\n'
	);
	process.exit(1);
}

const generators = packages.reduce((n, p) => n + p.generators.length, 0);
process.stdout.write(
	`gen:check — ${packages.length} package(s), ${generators} generator(s): every generated artifact matches its source.\n`
);
