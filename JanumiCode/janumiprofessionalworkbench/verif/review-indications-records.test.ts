// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D50's ACCEPTANCE AND CONTROL 9 (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md`
// §12.2, revision 9: *"Given D54's records, it must render 97 of 97 v13 cases equal to the reference builder's output, hash for hash:
// the screen's block assembly applied to Run A's measured prompt. Include `P12-RR-07-CUT`. The same control edit must then show as
// 97 of 97 differences."*; `ROADMAP-undertaking-execution-sandbox.md` §9b.5b, Z2 "Acceptance and control 9").
//   · THE PRODUCT'S SIDE: each current case's first prompt, its potential indications from D54's committed records through the
//     static source the gate reads (`COMMITTED_INDICATIONS`) — no model.
//   · THE REFERENCE'S SIDE: the fixture's hashes, written by Python — `build_checkptr2.py`'s own `new_block`, `build_n` and `check`
//     applied to Run A's measured prompt with the records' scores in place of step 1's, each score taken only where its record's
//     body is step 1's own body for that question (`z2b-facts.md`). The fixture names the records it was built from by their
//     sha256: committed records that differ from them fail the arrangement, so the reference is rebuilt with them.
//   · ⭑ ITS CONTROL: one character of the block's fixed text removed moves all 97, through the function the validator sends by,
//     held equal to the validator's own prompt for every case first.
// ⚠ Run A's three scratch cases (`P14-CLEAN-CUT`, `P14-HONEST-FAIL`, `P14-HONEST-FAIL-CUT`) are checked the same way outside
// these tests (`z2b-facts.md`).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { committedCaseSet } from '../scripts/reviewer-qual/fingerprint.js';
import { COMMITTED_INDICATIONS, RECORDS_FOLDER } from '../scripts/reviewer-qual/recorded-indications.js';
import { acceptanceOf } from './review-indications-records.js';

const ROOT = new URL('../', import.meta.url);
const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
interface Fixture {
	readonly records: Readonly<Record<string, string>>;
	readonly builder: string;
	readonly prompts: Readonly<Record<string, string>>;
}
const FIXTURE_FILE = 'verif/fixtures/reviewer-qual/indications-records-v13.json';
const fixture = (): Fixture => JSON.parse(readFileSync(new URL(FIXTURE_FILE, ROOT), 'utf8')) as Fixture;
const CASES = committedCaseSet(ROOT).cases;

describe('⛔ ACCEPTANCE AND CONTROL 9 (Z2; D50, D54) — given D54’s committed records, the product renders 97 of 97 v13 prompts as the reference builder does, hash for hash', () => {
	it('⭐ arrangement: the reference was built from the committed records, byte for byte, over every current case — P12-RR-07-CUT among them', () => {
		const f = fixture();
		for (const [file, hash] of Object.entries(f.records))
			expect(sha256(readFileSync(new URL(`${RECORDS_FOLDER}${file}`, ROOT))), `${file}: the records the reference was built from`).toBe(hash);
		expect(Object.keys(f.prompts).sort(), 'a reference prompt for each current case').toEqual(CASES.map((c) => c.id).sort());
		expect(Object.keys(f.prompts)).toHaveLength(97);
		expect(f.prompts['P12-RR-07-CUT'], 'the one cut case').toMatch(/^[0-9a-f]{64}$/);
	});

	it('⭐ 97 of 97 equal to the reference; ⭑ CONTROL — one character of the block’s fixed text removed: 97 of 97 differ, rendered as the validator sends', async () => {
		const f = fixture();
		const equal: string[] = [];
		const differ: string[] = [];
		const unlike: string[] = [];
		for (const c of CASES) {
			const a = await acceptanceOf(c, COMMITTED_INDICATIONS);
			if (a.prompt === f.prompts[c.id]) equal.push(c.id);
			if (a.control !== f.prompts[c.id]) differ.push(c.id);
			if (!a.rendersAsSent) unlike.push(c.id);
		}
		expect(unlike, 'the cases whose control would not render as the validator sends').toEqual([]);
		expect(equal, 'the cases whose prompt hashes equal the reference’s').toEqual(CASES.map((c) => c.id));
		expect(differ, 'the cases whose prompt hashes differ from the reference’s under the control’s edit').toEqual(CASES.map((c) => c.id));
	}, 120_000);
});
