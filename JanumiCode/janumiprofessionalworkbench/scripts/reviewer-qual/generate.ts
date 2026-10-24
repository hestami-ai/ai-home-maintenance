/**
 * `bun run scripts/reviewer-qual/generate.ts` — write the reviewer-qualification case sets and their oracles, every
 * version (`JAN-CRITREAD` J2-1, J2-5, J2-7; DESIGN-what-the-tests-prove.md §5.2; and `JAN-PRQUAL` `PQ-2`'s version four,
 * DESIGN-process-result-qualification.md D4).
 *
 * The JSON under `docs/tracking/reviewer-qualification/` is DERIVED from `case-set-v<n>.ts` and `oracles-v<n>.ts` and
 * is never hand-edited: ~~`verif/reviewer-qualification-cases.test.ts`~~ `verif/reviewer-qualification-case-freshness.test.ts`
 * (since `JAN-PRQUAL` `PQ-2`, which moved every version's freshness limb there from the cases test) reddens when a
 * committed file differs from what this writes. Regenerate in the same commit as the change to its source.
 * ⭐ `JAN-CRITREAD` J2-5 — EVERY VERSION IS WRITTEN, the superseded ones included: version one is history the committed
 * record measured, and its data stays exactly what its own, unchanged source generates. Which version is CURRENT is
 * named once, in `cases.ts`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	CASE_SET_V1_FILE,
	CASE_SET_V2_FILE,
	CASE_SET_V3_FILE,
	CASE_SET_V4_FILE,
	CASE_SET_V5_FILE,
	CASE_SET_V6_FILE,
	CASE_SET_V7_FILE,
	CASE_SET_V8_FILE,
	ORACLES_V1_FILE,
	ORACLES_V2_FILE,
	ORACLES_V3_FILE,
	ORACLES_V4_FILE,
	ORACLES_V5_FILE,
	ORACLES_V6_FILE,
	ORACLES_V7_FILE,
	ORACLES_V8_FILE,
	serializeGenerated,
	type CaseSet,
	type OracleSet
} from './cases.js';
import { CASE_SET_V1 } from './case-set-v1.js';
import { CASE_SET_V2 } from './case-set-v2.js';
import { CASE_SET_V3 } from './case-set-v3.js';
import { CASE_SET_V4 } from './case-set-v4.js';
import { CASE_SET_V5 } from './case-set-v5.js';
import { CASE_SET_V6 } from './case-set-v6.js';
import { CASE_SET_V7 } from './case-set-v7.js';
import { CASE_SET_V8 } from './case-set-v8.js';
import { ORACLES_V1 } from './oracles-v1.js';
import { ORACLES_V2 } from './oracles-v2.js';
import { ORACLES_V3 } from './oracles-v3.js';
import { ORACLES_V4 } from './oracles-v4.js';
import { ORACLES_V5 } from './oracles-v5.js';
import { ORACLES_V6 } from './oracles-v6.js';
import { ORACLES_V7 } from './oracles-v7.js';
import { ORACLES_V8 } from './oracles-v8.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const VERSIONS: readonly (readonly [string, CaseSet, string, OracleSet])[] = [
	[CASE_SET_V1_FILE, CASE_SET_V1, ORACLES_V1_FILE, ORACLES_V1],
	[CASE_SET_V2_FILE, CASE_SET_V2, ORACLES_V2_FILE, ORACLES_V2],
	[CASE_SET_V3_FILE, CASE_SET_V3, ORACLES_V3_FILE, ORACLES_V3],
	[CASE_SET_V4_FILE, CASE_SET_V4, ORACLES_V4_FILE, ORACLES_V4],
	// ⭐ `JAN-EXEC` Phase 7 completion E2 — version five: the declared-policy arm (design B5).
	[CASE_SET_V5_FILE, CASE_SET_V5, ORACLES_V5_FILE, ORACLES_V5],
	// ⭐ `JAN-EXEC` Phase 7 completion, round 5 — version six: D-FP-CLEAN repaired as D6-FP-CLEAN (`REG-D-115`), and under its
	// delegated extension D-FP-03, D-RC-CLEAN and D-RC-04 as D6-FP-03, D6-RC-CLEAN and D6-RC-04.
	[CASE_SET_V6_FILE, CASE_SET_V6, ORACLES_V6_FILE, ORACLES_V6],
	// ⭐ `JAN-EXEC` Phase 7 after P6's third run, package P, F3 — version seven: six graph cases whose types declare their work
	// (`REG-D-123` Q25), their oracles proposed.
	[CASE_SET_V7_FILE, CASE_SET_V7, ORACLES_V7_FILE, ORACLES_V7],
	// ⭐ `JAN-EXEC` Phase 7, the review in parts, B7 — version eight: version seven's 41 non-graph cases and 35 part cases
	// (`REG-D-125`, `REG-D-126`), their oracles conferred.
	[CASE_SET_V8_FILE, CASE_SET_V8, ORACLES_V8_FILE, ORACLES_V8]
];

for (const [casesFile, cases, oraclesFile, oracles] of VERSIONS) {
	for (const [file, value] of [
		[casesFile, cases],
		[oraclesFile, oracles]
	] as const) {
		const path = `${ROOT}${file}`;
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, serializeGenerated(value));
		process.stdout.write(`reviewer-qual — wrote ${file}\n`);
	}
	process.stdout.write(
		`reviewer-qual — ${cases.cases.length} cases (set v${cases.caseSetVersion}), ` +
			`${oracles.oracles.length} oracles (v${oracles.oracleVersion})\n`
	);
}
