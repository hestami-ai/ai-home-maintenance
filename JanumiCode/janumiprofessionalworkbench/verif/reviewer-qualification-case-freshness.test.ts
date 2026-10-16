// ⭐ `JAN-PRQUAL` `PQ-2` — THE REVIEWER-QUALIFICATION CASE SETS AND THEIR ORACLES ARE GENERATED, NEVER HAND-EDITED:
// every version's committed JSON is exactly what `scripts/reviewer-qual/generate.ts` writes (DESIGN-what-the-tests-prove.md
// §5.2; DESIGN-process-result-qualification.md D4; ROADMAP-process-result-qualification.md PQ-2).
//
// ⭐ EACH VERSION'S FRESHNESS LIMB, MOVED HERE WHOLE from `reviewer-qualification-cases.test.ts` — version one's
// (`JAN-CRITREAD` J2-1), two's (J2-5), three's (J2-7) and four's (`PQ-2`), every assertion as it was. ⛔ WHY ITS OWN FILE:
// a freshness limb reddens on ANY change to a case's source, so in the file of the content limbs it answered every change
// to a case's data — a harmless one exactly as a plant removed — and a change aimed at a content limb read KILLED there
// whether or not that limb still stood. A mutation is judged by the file it names as its victim; with this limb here, a
// change to a case's data is answered in the cases file by the content limb it breaks, or by none, and HERE by staleness.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	CASE_SET_V1_FILE,
	CASE_SET_V2_FILE,
	CASE_SET_V3_FILE,
	CASE_SET_V4_FILE,
	CASE_SET_V5_FILE,
	ORACLES_V1_FILE,
	ORACLES_V2_FILE,
	ORACLES_V3_FILE,
	ORACLES_V4_FILE,
	ORACLES_V5_FILE,
	serializeGenerated,
	type CaseSet
} from '../scripts/reviewer-qual/cases.js';
import { CASE_SET_V1 } from '../scripts/reviewer-qual/case-set-v1.js';
import { CASE_SET_V2 } from '../scripts/reviewer-qual/case-set-v2.js';
import { CASE_SET_V3 } from '../scripts/reviewer-qual/case-set-v3.js';
import { CASE_SET_V4 } from '../scripts/reviewer-qual/case-set-v4.js';
import { CASE_SET_V5 } from '../scripts/reviewer-qual/case-set-v5.js';
import { ORACLES_V1 } from '../scripts/reviewer-qual/oracles-v1.js';
import { ORACLES_V2 } from '../scripts/reviewer-qual/oracles-v2.js';
import { ORACLES_V3 } from '../scripts/reviewer-qual/oracles-v3.js';
import { ORACLES_V4 } from '../scripts/reviewer-qual/oracles-v4.js';
import { ORACLES_V5 } from '../scripts/reviewer-qual/oracles-v5.js';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (file: string): string => readFileSync(`${REPO_ROOT}${file}`, 'utf8');

/** The committed files, as the runner will read them — never the generator's in-memory values. */
const committedCases = (): CaseSet => JSON.parse(read(CASE_SET_V1_FILE)) as CaseSet;
const committedV2 = (): CaseSet => JSON.parse(read(CASE_SET_V2_FILE)) as CaseSet;
const committedV3 = (): CaseSet => JSON.parse(read(CASE_SET_V3_FILE)) as CaseSet;
const committedV4 = (): CaseSet => JSON.parse(read(CASE_SET_V4_FILE)) as CaseSet;

describe('JAN-CRITREAD J2-1 — reviewer-qualification case set v1', () => {
	it('⛔ the committed case set and oracles are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V1_FILE);
		const oracles = read(ORACLES_V1_FILE);
		expect(cases, `${CASE_SET_V1_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V1)
		);
		expect(oracles, `${ORACLES_V1_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V1)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
	});
});

describe('JAN-CRITREAD J2-5 — reviewer-qualification case set v2: version one with REG-F-449’s correction, and nothing else', () => {
	it('⛔ the committed case set v2 and oracles v2 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V2_FILE);
		const oracles = read(ORACLES_V2_FILE);
		expect(cases, `${CASE_SET_V2_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V2)
		);
		expect(oracles, `${ORACLES_V2_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V2)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Version one stays committed as history, and still exactly what its own source generates (the limb above).
		expect(committedV2().caseSetVersion).toBe(2);
		expect(committedCases().caseSetVersion).toBe(1);
	});
});

describe('JAN-CRITREAD J2-7 — reviewer-qualification case set v3: version two with the foundations and the permit’s inputs (REG-D-081), and nothing else', () => {
	it('⛔ the committed case set v3 and oracles v3 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V3_FILE);
		const oracles = read(ORACLES_V3_FILE);
		expect(cases, `${CASE_SET_V3_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V3)
		);
		expect(oracles, `${ORACLES_V3_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V3)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Versions one and two stay committed as history, each still exactly what its own source generates (the limbs above).
		expect(committedV3().caseSetVersion).toBe(3);
		expect([committedCases().caseSetVersion, committedV2().caseSetVersion]).toEqual([1, 2]);
	});
});

describe('JAN-PRQUAL PQ-2 — reviewer-qualification case set v4: version three, and the fourteen process-result cases the sponsor conferred (REG-D-095)', () => {
	it('⛔ the committed case set v4 and oracles v4 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V4_FILE);
		const oracles = read(ORACLES_V4_FILE);
		expect(cases, `${CASE_SET_V4_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V4)
		);
		expect(oracles, `${ORACLES_V4_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V4)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Versions one to three stay committed as history, each still exactly what its own source generates (the limbs above).
		expect(committedV4().caseSetVersion).toBe(4);
		expect([committedCases().caseSetVersion, committedV2().caseSetVersion, committedV3().caseSetVersion]).toEqual([1, 2, 3]);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 — version five (`DESIGN-phase-7-completion.md` B5): version four, and the fourteen
// declared-policy cases, their oracles PROPOSED.
describe('JAN-EXEC Phase 7 completion E2 — reviewer-qualification case set v5: version four, and the fourteen declared-policy cases', () => {
	it('⛔ the committed case set v5 and oracles v5 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V5_FILE);
		const oracles = read(ORACLES_V5_FILE);
		expect(cases, `${CASE_SET_V5_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V5)
		);
		expect(oracles, `${ORACLES_V5_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V5)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Versions one to four stay committed as history, each still exactly what its own source generates (the limbs above).
		expect((JSON.parse(cases) as CaseSet).caseSetVersion).toBe(5);
		expect(committedV4().caseSetVersion).toBe(4);
	});
});
