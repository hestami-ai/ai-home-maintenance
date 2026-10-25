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
	CASE_SET_V6_FILE,
	CASE_SET_V7_FILE,
	CASE_SET_V8_FILE,
	CASE_SET_V9_FILE,
	CASE_SET_V10_FILE,
	CASE_SET_V11_FILE,
	ORACLES_V1_FILE,
	ORACLES_V2_FILE,
	ORACLES_V3_FILE,
	ORACLES_V4_FILE,
	ORACLES_V5_FILE,
	ORACLES_V6_FILE,
	ORACLES_V7_FILE,
	ORACLES_V8_FILE,
	ORACLES_V9_FILE,
	ORACLES_V10_FILE,
	ORACLES_V11_FILE,
	serializeGenerated,
	type CaseSet
} from '../scripts/reviewer-qual/cases.js';
import { CASE_SET_V1 } from '../scripts/reviewer-qual/case-set-v1.js';
import { CASE_SET_V2 } from '../scripts/reviewer-qual/case-set-v2.js';
import { CASE_SET_V3 } from '../scripts/reviewer-qual/case-set-v3.js';
import { CASE_SET_V4 } from '../scripts/reviewer-qual/case-set-v4.js';
import { CASE_SET_V5 } from '../scripts/reviewer-qual/case-set-v5.js';
import { CASE_SET_V6 } from '../scripts/reviewer-qual/case-set-v6.js';
import { CASE_SET_V7 } from '../scripts/reviewer-qual/case-set-v7.js';
import { CASE_SET_V8 } from '../scripts/reviewer-qual/case-set-v8.js';
import { CASE_SET_V9 } from '../scripts/reviewer-qual/case-set-v9.js';
import { CASE_SET_V10 } from '../scripts/reviewer-qual/case-set-v10.js';
import { CASE_SET_V11 } from '../scripts/reviewer-qual/case-set-v11.js';
import { ORACLES_V1 } from '../scripts/reviewer-qual/oracles-v1.js';
import { ORACLES_V2 } from '../scripts/reviewer-qual/oracles-v2.js';
import { ORACLES_V3 } from '../scripts/reviewer-qual/oracles-v3.js';
import { ORACLES_V4 } from '../scripts/reviewer-qual/oracles-v4.js';
import { ORACLES_V5 } from '../scripts/reviewer-qual/oracles-v5.js';
import { ORACLES_V6 } from '../scripts/reviewer-qual/oracles-v6.js';
import { ORACLES_V7 } from '../scripts/reviewer-qual/oracles-v7.js';
import { ORACLES_V8 } from '../scripts/reviewer-qual/oracles-v8.js';
import { ORACLES_V9 } from '../scripts/reviewer-qual/oracles-v9.js';
import { ORACLES_V10 } from '../scripts/reviewer-qual/oracles-v10.js';
import { ORACLES_V11 } from '../scripts/reviewer-qual/oracles-v11.js';

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

// ⭐⭐ `JAN-EXEC` Phase 7 completion, round 5 — version six (`REG-D-115`): version five, ~~D-FP-CLEAN repaired as D6-FP-CLEAN~~
// ⭐ four cases repaired, each under a new id: D-FP-CLEAN as D6-FP-CLEAN (the sponsor's ruling), and D-FP-03, D-RC-CLEAN and
// D-RC-04 as D6-FP-03, D6-RC-CLEAN and D6-RC-04 (its delegated extension).
describe('JAN-EXEC Phase 7 completion round 5 — reviewer-qualification case set v6: version five, ~~D-FP-CLEAN repaired as D6-FP-CLEAN~~ four cases repaired, D6-RC-CLEAN, D6-RC-04, D6-FP-CLEAN and D6-FP-03 (REG-D-115 and its delegated extension)', () => {
	it('⛔ the committed case set v6 and oracles v6 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V6_FILE);
		const oracles = read(ORACLES_V6_FILE);
		expect(cases, `${CASE_SET_V6_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V6)
		);
		expect(oracles, `${ORACLES_V6_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V6)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Versions one to five stay committed as history, each still exactly what its own source generates (the limbs above).
		expect((JSON.parse(cases) as CaseSet).caseSetVersion).toBe(6);
		expect((JSON.parse(read(CASE_SET_V5_FILE)) as CaseSet).caseSetVersion).toBe(5);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7 after P6's third run, package P, F3 — version seven (`REG-D-123` Q25): version six, and six graph cases
// whose types declare their work, their oracles proposed.
describe('JAN-EXEC Phase 7 after P6’s third run, package P — reviewer-qualification case set v7: version six, and six graph cases whose types declare their work (REG-D-123 Q25)', () => {
	it('⛔ the committed case set v7 and oracles v7 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V7_FILE);
		const oracles = read(ORACLES_V7_FILE);
		expect(cases, `${CASE_SET_V7_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V7)
		);
		expect(oracles, `${ORACLES_V7_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V7)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Versions one to six stay committed as history, each still exactly what its own source generates (the limbs above).
		expect((JSON.parse(cases) as CaseSet).caseSetVersion).toBe(7);
		expect((JSON.parse(read(CASE_SET_V6_FILE)) as CaseSet).caseSetVersion).toBe(6);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B7 — version eight (`REG-D-125`, `REG-D-126`): version seven's 41 non-graph cases
// and 35 part cases, their oracles conferred.
describe('JAN-EXEC Phase 7, the review in parts, B7 — reviewer-qualification case set v8: version seven’s 41 non-graph cases, and 35 part cases (REG-D-126)', () => {
	it('⛔ the committed case set v8 and oracles v8 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V8_FILE);
		const oracles = read(ORACLES_V8_FILE);
		expect(cases, `${CASE_SET_V8_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V8)
		);
		expect(oracles, `${ORACLES_V8_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V8)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Versions one to seven stay committed as history, each still exactly what its own source generates (the limbs above).
		expect((JSON.parse(cases) as CaseSet).caseSetVersion).toBe(8);
		expect((JSON.parse(read(CASE_SET_V7_FILE)) as CaseSet).caseSetVersion).toBe(7);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B8a — version nine (`REG-D-127`): version eight's 76 cases under their ids, each
// part cut with the seeded policy library and the bridge sources restated, their oracles version eight's.
describe('JAN-EXEC Phase 7, the review in parts, B8a — reviewer-qualification case set v9: version eight’s 76 cases, each part cut with the seeded policy library (REG-D-127)', () => {
	it('⛔ the committed case set v9 and oracles v9 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V9_FILE);
		const oracles = read(ORACLES_V9_FILE);
		expect(cases, `${CASE_SET_V9_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V9)
		);
		expect(oracles, `${ORACLES_V9_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V9)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Versions one to eight stay committed as history, each still exactly what its own source generates (the limbs above).
		expect((JSON.parse(cases) as CaseSet).caseSetVersion).toBe(9);
		expect((JSON.parse(read(CASE_SET_V8_FILE)) as CaseSet).caseSetVersion).toBe(8);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B8b — version ten (`REG-D-130`, `REG-D-131`, ⭐ `REG-D-132`): version nine's 76
// cases ~~under their ids~~, the 19 bridge part cases cut from their sources restated by D3b with the bridge library ⭐ and
// under new ids (D3b (8)), the 57 others under theirs, their oracles version nine's.
describe('JAN-EXEC Phase 7, the review in parts, B8b — reviewer-qualification case set v10: version nine’s 76 cases, the bridge part cases restated by D3b (REG-D-130, REG-D-131)', () => {
	it('⛔ the committed case set v10 and oracles v10 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V10_FILE);
		const oracles = read(ORACLES_V10_FILE);
		expect(cases, `${CASE_SET_V10_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V10)
		);
		expect(oracles, `${ORACLES_V10_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V10)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Versions one to nine stay committed as history, each still exactly what its own source generates (the limbs above).
		expect((JSON.parse(cases) as CaseSet).caseSetVersion).toBe(10);
		expect((JSON.parse(read(CASE_SET_V9_FILE)) as CaseSet).caseSetVersion).toBe(9);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B8b, package K — version eleven (`REG-D-133`): version ten's 76 cases, 69 under
// their ids, byte for byte, and the 7 whose prompts D3d moves under new ids, cut from their sources restated so that the options
// study's purpose states its comparison criteria, their oracles version ten's.
describe('JAN-EXEC Phase 7, the review in parts, B8b, package K — reviewer-qualification case set v11: version ten’s 76 cases, the 7 whose prompts D3d moves under new ids (REG-D-133)', () => {
	it('⛔ the committed case set v11 and oracles v11 are exactly what the generator writes — never hand-edited', () => {
		const cases = read(CASE_SET_V11_FILE);
		const oracles = read(ORACLES_V11_FILE);
		expect(cases, `${CASE_SET_V11_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(CASE_SET_V11)
		);
		expect(oracles, `${ORACLES_V11_FILE} is stale — run \`bun run scripts/reviewer-qual/generate.ts\``).toBe(
			serializeGenerated(ORACLES_V11)
		);
		for (const text of [cases, oracles]) {
			expect(text.includes('\r'), 'LF only').toBe(false);
			expect(text.charCodeAt(0), 'no BOM').not.toBe(0xfeff);
		}
		// Versions one to ten stay committed as history, each still exactly what its own source generates (the limbs above).
		expect((JSON.parse(cases) as CaseSet).caseSetVersion).toBe(11);
		expect((JSON.parse(read(CASE_SET_V10_FILE)) as CaseSet).caseSetVersion).toBe(10);
	});
});
