/**
 * `bun run sonar:census` — writes `scripts/sonar/scope-census.json`, the Sonar scope's census, from
 * `sonar-project.properties` and the tracked files (JAN-SONARCM D-1, V-3(a); roadmap S1).
 *
 * Run it after adding, removing or renaming a file in the scope's four roots, and commit the result:
 * `verif/sonar-runner.test.ts` fails, naming the file, while the census differs from what the properties select.
 *
 * usage: bun run sonar:census [--check]
 * exit:  0 written (or, with --check, already fresh); 1 with --check, the census is stale (each difference printed).
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CENSUS_FILE, censusDrift, censusOf, PROPERTIES_FILE, renderCensus, type Census } from './scope.js';

export const JPWB_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** The tracked files under `root`, relative to it, `/`-separated (git's own form). */
export function trackedFiles(root: string): string[] {
	// S4036: kept - repository tooling asks the operator's own git, found on PATH, for the tracked files; a fixed path would tie the census to one machine (V-2).
	const r = spawnSync('git', ['-C', root, '--no-optional-locks', 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
	if (r.error !== undefined || r.status !== 0) throw new Error(`git ls-files failed in ${root}: ${r.error?.message ?? r.stderr}`);
	return r.stdout.split('\0').filter((p) => p !== '');
}

export function freshCensus(root: string): Census {
	return censusOf(readFileSync(join(root, PROPERTIES_FILE), 'utf8'), trackedFiles(root));
}

function main(): number {
	const fresh = freshCensus(JPWB_ROOT);
	const path = join(JPWB_ROOT, CENSUS_FILE);
	if (process.argv.includes('--check')) {
		const committed = JSON.parse(readFileSync(path, 'utf8')) as Census;
		const drift = censusDrift(committed, fresh);
		for (const d of drift) console.error(d);
		if (drift.length === 0) console.log(`${CENSUS_FILE}: fresh (${fresh.counts.files} files, ${fresh.tsconfigs.length} tsconfigs)`);
		return drift.length === 0 ? 0 : 1;
	}
	writeFileSync(path, renderCensus(fresh));
	console.log(`${CENSUS_FILE}: ${fresh.counts.files} files, ${fresh.tsconfigs.length} tsconfigs, by root ${JSON.stringify(fresh.counts.byRoot)}`);
	return 0;
}

if (import.meta.main) process.exit(main());
