// ⭐ `JAN-SELREV` SR-1 — A PATH THAT FINDS NO PROGRAM, for the tests that reach the reviewer adapters.
//
// ⛔ THE PROGRAMS ARE REAL. `agy` and `devin` on this machine's PATH are the paid reviewers, so a test that reaches
// `agyPrint` or `devinPrint` must not be one mutant away from starting them: it drives them through their exec seam
// AND runs with PATH pointed here, so even a seam a mutant bypassed would find nothing to start. The same construction
// as `verif/reviewer-qualification-hermetic.ts`'s `NO_PROGRAMS`, restated rather than imported: that module spawns
// `where bun` at load and imports the qualification harness, neither of which an app test should carry.
import { mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** An EMPTY directory. ⛔ Refused if anything is in it — a program placed there would be found. */
export function noProgramsDirectory(): string {
	const dir = join(tmpdir(), 'jpwb-no-programs');
	mkdirSync(dir, { recursive: true });
	if (readdirSync(dir).length > 0)
		throw new Error(`hermetic: ${dir} is not empty, so it cannot stand for "no program"`);
	return dir;
}
