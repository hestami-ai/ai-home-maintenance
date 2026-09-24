/**
 * `bun run scripts/reviewer-qual/generate.ts` — write the reviewer-qualification case set and its oracles
 * (`JAN-CRITREAD` J2-1; DESIGN-what-the-tests-prove.md §5.2).
 *
 * The JSON under `docs/tracking/reviewer-qualification/` is DERIVED from `case-set-v1.ts` and `oracles-v1.ts` and is
 * never hand-edited: `verif/reviewer-qualification-cases.test.ts` reddens when a committed file differs from what
 * this writes. Regenerate in the same commit as the change to its source.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASE_SET_V1_FILE, ORACLES_V1_FILE, serializeGenerated } from './cases.js';
import { CASE_SET_V1 } from './case-set-v1.js';
import { ORACLES_V1 } from './oracles-v1.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

for (const [file, value] of [
	[CASE_SET_V1_FILE, CASE_SET_V1],
	[ORACLES_V1_FILE, ORACLES_V1]
] as const) {
	const path = `${ROOT}${file}`;
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, serializeGenerated(value));
	process.stdout.write(`reviewer-qual — wrote ${file}\n`);
}
process.stdout.write(
	`reviewer-qual — ${CASE_SET_V1.cases.length} cases (set v${CASE_SET_V1.caseSetVersion}), ` +
		`${ORACLES_V1.oracles.length} oracles (v${ORACLES_V1.oracleVersion})\n`
);
