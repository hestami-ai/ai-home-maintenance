// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50's ACCEPTANCE, AND D52's ROOM OVER THE WHOLE CASE SET (`REG-D-146`;
// `DESIGN-data-flow-order-and-deliverable-review.md` §12.2 and §12.4, revision 9; `ROADMAP-undertaking-execution-sandbox.md`
// §9b.5b, Z1 predicted reds 3 and 4).
//
// ⛔ PREDICTED RED 3 — THE SCREEN'S PROMPTS. The screen of the sponsor's construct (`REG-F-605`) built its new arm's prompts
// from step 1's recorded scores — every check and every statement asked alone, cold, of `pplx-decider:27b-q4_K_M` (digest
// `733585a9ebb6`) on Ollama 0.40.11. Given those scores, the product must render the 11 screened case-set-v13 cases equal to
// arm N's prompts, hash for hash: 11 of 11. ⭑ Step 1's scores cannot be re-made on the server since updated (`REG-F-608`), so
// the reproduction reads the recorded ones (`indications-screen-step1.json`), each asked only of the question its record
// asked: a request whose subject is not the one recorded under its key is refused, so the cut is held too.
// ⭑ ITS CONTROL — one character of the block's fixed text, changed, must move all 11 hashes: the comparison sees the block.
// The control's prompts are rendered by the same function the validator sends (`reviewPrompt`), held equal to the
// validator's own here first, so a difference there is a difference in what the validator would send.
// ⛔ PREDICTED RED 4 (in part) — TODAY'S CUT POINTS STAND. The material's room is computed against today's review section, so
// the prompt before the measured section is today's prompt before its section, byte for byte, in 97 of 97 v13 cases —
// `P12-RR-07-CUT`'s cut among them — its sha256 taken from the code before package Z1 (`headsBeforeZ1`).
// ⚠ The six screened `W14-` cases are scratch and checked outside these tests (`z1-facts.md`).
// ⛔ No model and no network: both of the validator's seams are functions here.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TEST_INDICATIONS } from '../apps/rph-demo/src/lib/server/assurance/indications.testing.js';
import {
	createAgyReasoningReviewValidator,
	reviewPrompt,
	type IndicationRequest,
	type IndicationsSource
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { committedCaseSet, PRODUCT_SEAMS } from '../scripts/reviewer-qual/fingerprint.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';
import type { QualificationCase } from '../scripts/reviewer-qual/cases.js';

const ROOT = new URL('../', import.meta.url);
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

interface Recorded {
	readonly score: number;
	/** The sha256 of what the question asked about: a check's `id: label`, or the statement. */
	readonly asked: string;
}
interface Fixture {
	readonly cases: Readonly<
		Record<string, { readonly armN: string; readonly checks: Readonly<Record<string, Recorded>>; readonly statements: Readonly<Record<string, Recorded>> }>
	>;
	readonly headsBeforeZ1: Readonly<Record<string, string>>;
}
const FIXTURE = JSON.parse(
	readFileSync(new URL('verif/fixtures/reviewer-qual/indications-screen-step1.json', ROOT), 'utf8')
) as Fixture;
const CASES = committedCaseSet(ROOT).cases;
const SCREENED = Object.keys(FIXTURE.cases);

/** What a request asked about, as step 1's record hashes it. */
const subjectOf = (r: IndicationRequest): string => (r.kind === 'check' ? `${r.id}: ${r.label}` : r.statement);

/**
 * ⭐ STEP 1'S RECORD AS A SOURCE: each request answered by the score recorded under its kind and key — refused when no score is
 * recorded there, when the record asked about something else, or when a recorded question goes unasked.
 */
function recorded(caseId: string): IndicationsSource {
	const c = FIXTURE.cases[caseId]!;
	return async (requests) => {
		const scores: Record<string, number> = {};
		for (const r of requests) {
			const row = (r.kind === 'check' ? c.checks : c.statements)[r.key];
			if (row === undefined) return { refusal: `${caseId}: ${r.kind} ${r.key} has no recorded score` };
			if (row.asked !== sha256(subjectOf(r))) return { refusal: `${caseId}: ${r.kind} ${r.key}: its record asked another question` };
			scores[r.key] = row.score;
		}
		const unasked = Object.keys(c.checks).length + Object.keys(c.statements).length - requests.length;
		if (unasked !== 0) return { refusal: `${caseId}: ${unasked} recorded question(s) not asked` };
		return { scores };
	};
}

const caseOf = (id: string): QualificationCase => CASES.find((c) => c.id === id)!;
const inputOf = (c: QualificationCase) => caseReviewInput(c, PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult);

/** The first prompt the product's validator sends for `c`, its reviewer a capture, its indications `source`. */
async function firstPrompt(c: QualificationCase, source: IndicationsSource): Promise<string> {
	const sent: string[] = [];
	await createAgyReasoningReviewValidator({
		agentId: 'jpwb-acceptance',
		modelId: 'jpwb-acceptance-reviewer',
		providerId: 'jpwb-acceptance',
		clock: () => '1970-01-01T00:00:00.000Z',
		indications: source,
		print: async (p) => {
			sent.push(p);
			return JSON.stringify({ findings: [], recommendation: 'SATISFIED' });
		}
	}).evaluate(c.subject, { reasoningReview: inputOf(c) });
	if (sent[0] === undefined) throw new Error(`${c.id}: no prompt was sent`);
	return sent[0];
}

describe('⛔ PREDICTED RED 3 (Z1; D50) — given step 1’s recorded scores, the product renders the screen’s 11 v13 prompts hash for hash', () => {
	it('⭐ arrangement: the fixture holds the 11 screened v13 cases and their 232 questions, each case in the current set', () => {
		expect(SCREENED).toHaveLength(11);
		expect(SCREENED.reduce((n, id) => n + Object.keys(FIXTURE.cases[id]!.checks).length + Object.keys(FIXTURE.cases[id]!.statements).length, 0)).toBe(232);
		for (const id of SCREENED) expect(caseOf(id), id).toBeDefined();
	});

	it('⭐ 11 of 11 equal to arm N', async () => {
		const equal: string[] = [];
		for (const id of SCREENED) if (sha256(await firstPrompt(caseOf(id), recorded(id))) === FIXTURE.cases[id]!.armN) equal.push(id);
		expect(equal, 'the cases whose prompt hashes equal to arm N').toEqual(SCREENED);
	});

	it('⭑ CONTROL — one character of the block’s fixed text changed: 11 of 11 differ from arm N; and the function it renders through is the validator’s, byte for byte', async () => {
		// ⭑ Loaded here, not at collection, so the file is read before the module exists.
		const { REVIEW_SECTION_TEXT } = await import('../apps/rph-demo/src/lib/server/assurance/review-section.js');
		const edited = { ...REVIEW_SECTION_TEXT, INDICATIONS_SAYS: REVIEW_SECTION_TEXT.INDICATIONS_SAYS.replace('one question at a time', 'one question at a tim') };
		expect(edited.INDICATIONS_SAYS.length, 'arrangement: one character removed').toBe(REVIEW_SECTION_TEXT.INDICATIONS_SAYS.length - 1);
		const differ: string[] = [];
		for (const id of SCREENED) {
			const c = caseOf(id);
			expect(await reviewPrompt(inputOf(c), recorded(id)), `${id}: the control renders as the validator sends`).toBe(await firstPrompt(c, recorded(id)));
			if (sha256(await reviewPrompt(inputOf(c), recorded(id), edited)) !== FIXTURE.cases[id]!.armN) differ.push(id);
		}
		expect(differ, 'the cases whose prompt hashes differ from arm N under the edit').toEqual(SCREENED);
	});
});

describe('⛔ PREDICTED RED 4, IN PART (Z1; D52) — the prompt before the measured section is today’s, byte for byte, in 97 of 97 v13 cases', () => {
	it('⭐ every head as the code before Z1 rendered it: its cuts where they were, P12-RR-07-CUT’s among them', async () => {
		expect(Object.keys(FIXTURE.headsBeforeZ1).sort(), 'arrangement: a head for each current case').toEqual(CASES.map((c) => c.id).sort());
		const moved: string[] = [];
		for (const c of CASES) {
			const prompt = await firstPrompt(c, TEST_INDICATIONS);
			const at = prompt.indexOf('\nTHE REVIEW\n');
			if (at < 0 || sha256(prompt.slice(0, at + 1)) !== FIXTURE.headsBeforeZ1[c.id]) moved.push(c.id);
		}
		expect(moved, 'the cases whose head moved, or whose prompt has no measured section').toEqual([]);
		const cut = await firstPrompt(caseOf('P12-RR-07-CUT'), TEST_INDICATIONS);
		expect(cut, 'arrangement: P12-RR-07-CUT’s view is the one cut').toContain('[CUT FOR THIS REVIEW:');
	});
});
