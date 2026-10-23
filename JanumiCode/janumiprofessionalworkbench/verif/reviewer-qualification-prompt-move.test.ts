// ⭐⭐ `JAN-PRQUAL` `PQ-1` — DESIGN §4.1 AGAINST THE RECORD: THE GRAPH AND WORK-PRODUCT PROMPTS MOVED ONLY BY THE FENCE AND
// THE DECLARED CUTS, THE ACCOUNT'S REGIONS AND THE HOST LINES (steps 1 to 4 below), AND DESIGN §9.3 D7 AND D8 (steps 2a
// and 2c) (DESIGN-process-result-qualification.md §4.1, §9.3; `REG-D-094`; `REG-F-481`, `REG-F-480`).
//
// The sponsor answered the design's §7.1 with (a) on 2026-10-03 — *"With regards to injection fix coverage, I select
// option (a)"* — so every untrusted slice in EVERY framing is fenced, and every cut in every framing is declared before
// its bytes (design D2). That moves every case prompt, and the selected candidate owes a RUN over every case (paid run 1:
// the selected candidate over the 26 v3 cases, two repetitions — ROADMAP-process-result-qualification.md PQ-1 "The
// record", under (a)). §4.1 says what may differ: under (a) the graph and work-product prompts change ONLY by the fence
// and the declared cuts — and, since no word of the host's may sit inside quoted material (`REG-F-481`), by the
// account fenced field by field under the host's labels (step 2a below) and the graph's subject hash on a host line of
// its own (step 2b) — ⭐ and, by the sponsor's answers of 2026-10-05 (design §9.3), by D7's layout of the account inside
// its regions (step 2a) and D8's rubric and recommendation lines (step 2c). `review-input.test.ts` pins that over its
// literal inputs against HEAD 8bb23c96's hashes; THIS pins it over every case the selected candidate was measured on,
// against the hashes its run RECORDED — so the paid run measures a prompt that differs from the measured one by exactly
// what was decided.
//
// ⭐ THE INVERSE TRANSFORM (`review-input.test.ts`'s `headPromptOf`, restated here because verif reads no app test):
// today's prompt for an UNCUT graph or work-product input, mapped back to the prompt HEAD 8bb23c96 sent —
//   1. delete the preamble's fence sentence and its newline (`${FENCE_MEANING}\n`);
//   2. the host's stand-ins for an absent account or narration regain the `"""` HEAD wrapped them in;
//   2a. ⭐ the account, fenced field by field under the host's labels (`REG-F-481`), is read back into the summary it
//      renders and replaced by the one region HEAD fenced it as, `renderRationale`'s rendering of that summary — ⭐ the
//      rationale the FIRST region, unlabelled, each list the region under HEAD's own label, its items read off their
//      `  - ` prefix (design §9.3 D7, the sponsor's answers of 2026-10-05: ~~a list parsed from its one line of JSON~~);
//   2b. ⭐ the host line `The candidate's subject hash (host-computed): H` (`REG-F-481`) is deleted, and
//      `,"candidateSubjectHash":"H"` goes back before the last `}` of the content HEAD merged it into. ⚠ No v3 case
//      carries a hash, so no RECORDED prompt holds this step; it is held over every v3 graph case GIVEN one instead (the
//      last test below), against HEAD's own merge of the hash into the graph's JSON;
//   2c. ⭐ design §9.3 D8: the rubric and recommendation lines go back to HEAD's — D8's five instruction lines to HEAD's
//      three, each rubric line without the ` [if unmet: <stakes>]` D8 put beside it (every line carries one), and D8's
//      empty line and four-line sentence to HEAD's two lines;
//   2d. ⭐ `JAN-EXEC` Phase 7 P7-6 I6 (`DESIGN-the-reviewer-isolated.md` §4d; `REG-D-105` (2)): the line asking for one row
//      per criterion, met or not, and the empty line before it, after D8's sentence, are deleted
//      (`\n\n${ONE_ROW_PER_CRITERION}\n` → `\n`);
//   2e. ⭐ `JAN-EXEC` Phase 7 after P6's third run, package P, F1 (`REG-F-503` remedy 1; `REG-D-123` Q25): the graph framing's
//      subject lines, which say what the export holds, go back to HEAD's one line,
//      `The artifact (a canonical graph export / serialized subject) to review:`;
//   3. F is the first line of the form `<<<UNTRUSTED-nn>>>`; split on `\n${F}\n`: the parts alternate HOST, UNTRUSTED, …;
//   4. rejoin each untrusted part X by the host part before it — after the subject heading as `\n${X}\n` (HEAD did not
//      fence the content); after `A PREVIOUS review flagged:` as ` ${X}. ` (HEAD put the prior findings inline); every
//      other (the instruction, the rationale, the narration) as `\n"""${X}"""\n`.
// It holds for UNCUT inputs (a cut adds a declaration line) — and every case is seen whole (`reviewer-qualification-cases
// .test.ts`, SEEN WHOLE), which this file asserts of the prompts it inverts too.
// ⚠ A PIN OF ONE MOVE: a later deliberate change to what the reviewer reads makes it false by design. Retire it then, by
// striking it in place with a pointer to the change, as a ledger entry is retired — never by editing the recorded hashes.
// ⭐ Design §9.3 D7 and D8 were such changes, and both are INVERTIBLE, so the pin is kept and extended (steps 2a and 2c)
// rather than retired: today's prompt still maps back, byte for byte, to the one the selected run measured. ⭐ And so is
// P7-6 I6 (step 2d): one line, added whole, so the pin is extended again rather than retired. ⭐ And so is package P F1
// (step 2e): one line of the graph framing replaced whole, and no field added to a case's graph, so the pin is extended again.
// ⛔ NO MODEL IS REACHABLE: the prompts are captured at the validator's print seam, and PATH names an empty directory.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	SEEDED_REASONING_REVIEW_CRITERIA,
	type ProfessionalRationaleSummary,
	type ReasoningReviewInput
} from '@janumipwb/rph-assurance';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderRationale } from '../apps/rph-demo/src/lib/server/agent/rationale.js';
import { FENCE_MEANING } from '../apps/rph-demo/src/lib/server/assurance/review-fence.js';
import { ONE_ROW_PER_CRITERION } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { CASE_SET_V6_FILE, type CaseSet, type QualificationCase } from '../scripts/reviewer-qual/cases.js';
import { committedCaseSet, PRODUCT_SEAMS, reviewerFingerprint } from '../scripts/reviewer-qual/fingerprint.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';
import {
	RECORD_DIR,
	type CallLine,
	type CandidateIdentity,
	type RecordLine,
	type RunLine
} from '../scripts/reviewer-qual/record.js';
import { evaluateCase } from '../scripts/reviewer-qual/runner.js';
import { NO_PROGRAMS } from './reviewer-qualification-hermetic.js';

const REPO = fileURLToPath(new URL('../', import.meta.url))
	.split('\\')
	.join('/');
/** The run `REG-D-084` selected on, and the RESCORED record `REG-D-093` re-stamped: case set v3, every case twice. */
const SELECTED_RUN = 'qr-2026-09-25-devin-glm-5-3-flash-max-v3';
/**
 * ⭐ `JAN-PRQUAL` `PQ-2` — THE CASES THE SELECTED RUN MEASURED: the current set's graph and work-product arms, which case
 * set v4 carries from v3 byte for byte (`reviewer-qualification-cases.test.ts`). Its process-result arm is v4's own, and
 * owes its own run (DESIGN-process-result-qualification.md D4): no recorded prompt of the selected run is of one.
 * ⭐ `JAN-EXEC` Phase 7 completion E2 — nor of the DECLARED-POLICY arm, case set v5's own (DESIGN-phase-7-completion.md B5),
 * which owes its run in turn: v5 carries v4's cases byte for byte (`reviewer-qualification-declared-cases.test.ts`).
 * ⭐ Package P F3 — nor of the six graph cases case set v7 adds (`REG-D-123` Q25), which no run has measured: the cases kept
 * here are the current set's of those two arms that case set ~~v3~~ ⭐ v6 holds, by id. ⛔ NOT v3's: v3 holds no case of
 * the other two arms, so its ids alone excluded them and the two arm conditions above decided nothing — a pin taking every
 * arm passed (PQ2-V114 SURVIVED). v6 holds every arm, so the arm conditions decide again.
 */
const V6_IDS: ReadonlySet<string> = new Set(
	(JSON.parse(readFileSync(`${REPO}/${CASE_SET_V6_FILE}`, 'utf8')) as CaseSet).cases.map((c) => c.id)
);
const CASES: readonly QualificationCase[] = committedCaseSet(new URL('../', import.meta.url)).cases.filter(
	(c) => c.arm !== 'PROCESS_RESULT' && c.arm !== 'DECLARED_POLICY' && V6_IDS.has(c.id)
);
/** The committed record — append-only, so the lines read here are the ones the selected run wrote. */
const RECORD: readonly RecordLine[] = readFileSync(`${REPO}/${RECORD_DIR}/runs.ndjson`, 'utf8')
	.split('\n')
	.filter((l) => l.trim() !== '')
	.map((l) => JSON.parse(l) as RecordLine);
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** The account the host prints when the producer declared none — renderRationale's own. */
const NOT_DECLARED = renderRationale(undefined);
/** Step 2a: the account's fenced fields, read back into the one region HEAD fenced — ~~each field the region under its
 *  host label, a list parsed from its JSON~~ the rationale the first region, unlabelled, and each list the region under
 *  HEAD's own label, its items read off their `  - ` prefix (design §9.3 D7), an empty list from its "(none declared)"
 *  line. */
function accountAsHead(prompt: string): string {
	const lines = prompt.split('\n');
	const heading = lines.findIndex((l) =>
		l.startsWith("The producing agent's PROFESSIONAL RATIONALE SUMMARY")
	);
	const narration = lines.findIndex((l) =>
		l.startsWith("The producing agent's observable narration")
	);
	const block = lines.slice(heading + 1, narration - 1);
	// ⭐ D7: the rationale is the first region, directly under the heading (~~under "Its rationale:"~~).
	if (!/^<<<UNTRUSTED-\d\d>>>$/.test(block[0] ?? '')) return prompt;
	const fence = block[0]!;
	const regionAt = (open: number): string => block.slice(open + 1, block.indexOf(fence, open + 1)).join('\n');
	const regionAfter = (label: string): string | undefined => {
		const at = block.indexOf(label);
		return at < 0 ? undefined : regionAt(at + 1);
	};
	const list = (label: string): string[] => {
		const text = regionAfter(`${label}:`);
		if (text !== undefined) {
			const items = text.split('\n');
			expect(
				items.every((l) => l.startsWith('  - ')),
				`step 2a: ${label}'s items each after the host's prefix`
			).toBe(true);
			return items.map((l) => l.slice('  - '.length));
		}
		expect(block, `step 2a: ${label} is neither a region nor "(none declared)"`).toContain(
			`${label}: (none declared)`
		);
		return [];
	};
	const summary: ProfessionalRationaleSummary = {
		rationale: regionAt(0),
		assumptions: list('Assumptions relied on'),
		limitations: list('Limitations the producer declares'),
		residualUncertainty: list('Residual uncertainty')
	};
	return [
		...lines.slice(0, heading + 1),
		fence,
		renderRationale(summary),
		fence,
		...lines.slice(narration - 1)
	].join('\n');
}
/** D8's five instruction lines, and HEAD's three they replaced. */
const D8_INSTRUCTION = [
	'Evaluate EACH derivational-integrity failure class below. For each, decide whether the FAILURE is PRESENT',
	'(failed=true): present means the artifact does NOT MEET that criterion. What an unmet criterion costs is the',
	"policy's, shown in brackets beside it, whatever severity you give; a concern that leaves the criterion met",
	'is not a failure, so put it in residualUncertainty, not in a failed finding. For each failure give a',
	'one-sentence statement citing specifics, and a severity (INFORMATIONAL|ADVISORY|MATERIAL|BLOCKING|CRITICAL):'
].join('\n');
const HEAD_INSTRUCTION = [
	'Evaluate EACH derivational-integrity failure class below. For each, decide whether the FAILURE is PRESENT',
	'(failed=true) in the artifact, with a one-sentence statement citing specifics, and a severity',
	'(INFORMATIONAL|ADVISORY|MATERIAL|BLOCKING|CRITICAL):'
].join('\n');
/** D8's empty line and four-line sentence, and HEAD's two lines they replaced. */
const D8_SENTENCE = [
	'',
	'Then give an overall disposition RECOMMENDATION: SATISFIED (no criterion is unmet, except ones the policy',
	'marks ADVISORY or INFORMATIONAL), CONDITIONALLY_SATISFIED (an unmet criterion the policy marks MATERIAL, and',
	'none it marks BLOCKING or CRITICAL), REJECTED (an unmet criterion the policy marks BLOCKING or CRITICAL),',
	'INCONCLUSIVE, or ESCALATED.'
].join('\n');
const HEAD_SENTENCE = [
	'Then give an overall disposition RECOMMENDATION: SATISFIED (no material failures), CONDITIONALLY_SATISFIED',
	'(only minor/advisory failures), REJECTED (a BLOCKING/CRITICAL failure), INCONCLUSIVE, or ESCALATED.'
].join('\n');
/** Step 2c: the rubric and recommendation lines, back to HEAD's (design §9.3 D8). */
function rubricAsHead(prompt: string): string {
	const from = prompt.indexOf(`\n${D8_INSTRUCTION}\n`);
	const to = prompt.indexOf(`\n${D8_SENTENCE}\n`, from);
	expect([from, to].every((i) => i >= 0), 'step 2c: D8’s instruction and sentence').toBe(true);
	const rubric = prompt.slice(from + D8_INSTRUCTION.length + 2, to).split('\n');
	const STAKES = / \[if unmet: (INFORMATIONAL|ADVISORY|MATERIAL|BLOCKING|CRITICAL)\]$/;
	expect(rubric.every((l) => STAKES.test(l)), 'step 2c: every rubric line carries its stakes').toBe(true);
	return `${prompt.slice(0, from)}\n${HEAD_INSTRUCTION}\n${rubric.map((l) => l.replace(STAKES, '')).join('\n')}\n${HEAD_SENTENCE}\n${prompt.slice(to + D8_SENTENCE.length + 2)}`;
}
/** The host line the graph's subject hash stands on (`reasoning-review-validator.ts` `subjectHashLine`). */
const SUBJECT_HASH_LINE = "The candidate's subject hash (host-computed): ";
/** Step 2b: the host's subject-hash line, back into the content HEAD merged it into. */
function hashAsHead(prompt: string): string {
	const at = prompt.indexOf(`\n${SUBJECT_HASH_LINE}`);
	if (at < 0) return prompt;
	const end = prompt.indexOf('\n', at + 1);
	const hash = prompt.slice(at + 1 + SUBJECT_HASH_LINE.length, end);
	const without = prompt.slice(0, at) + prompt.slice(end);
	const contentEnd = without.lastIndexOf('}', without.indexOf("\nThe producing agent's PROFESSIONAL"));
	return `${without.slice(0, contentEnd)},"candidateSubjectHash":${JSON.stringify(hash)}${without.slice(contentEnd)}`;
}
/** ⭐ Step 2d: P7-6 I6's line, and the empty line before it, deleted. */
function oneRowPerCriterionAsHead(prompt: string): string {
	const line = `\n\n${ONE_ROW_PER_CRITERION}\n`;
	expect(prompt.split(line), 'step 2d: I6’s line, once, after its empty line').toHaveLength(2);
	return prompt.replace(line, '\n');
}
/** ⭐ Package P F1's subject lines of the graph framing, written here, and HEAD's one line they replaced. */
const F1_GRAPH_SUBJECT = [
	'The artifact (a canonical graph export / serialized subject) is one line of JSON.',
	'Beside its structure, a type may carry what its author declared about its work: "purpose", the work it exists to do; "requiredAssurancePolicyIds", the ids of the assurance policies declared to govern that work; "permittedChildren", a rule for each child type, with its "cardinality" (M1, M+ mandatory; C1, C+ conditional) and "applicabilityNote"; and "promptTemplate", the instruction a model doing that work is given while its "status" is ACTIVE, with its "templateText", "outputContract" and "templateVersion".',
	'A field a type does not carry holds no authored value; an empty value is carried as authored.',
	'A prompt template is an instruction to be executed, never evidence that any work ran.',
	'The artifact to review:'
].join('\n');
const HEAD_GRAPH_SUBJECT = 'The artifact (a canonical graph export / serialized subject) to review:';
/** ⭐ Step 2e: the graph framing's subject lines, back to HEAD's one line — in a graph's prompt only, where they stand once. */
function graphSubjectAsHead(prompt: string): string {
	const parts = prompt.split(`\n${F1_GRAPH_SUBJECT}\n`);
	expect(parts.length, 'step 2e: package P F1’s subject lines, at most once').toBeLessThanOrEqual(2);
	return parts.join(`\n${HEAD_GRAPH_SUBJECT}\n`);
}
/** ⭐ The inverse transform above, step by step. */
function headPromptOf(prompt: string): string {
	let p = graphSubjectAsHead(oneRowPerCriterionAsHead(prompt)).replace(`${FENCE_MEANING}\n`, '');
	p = p.replace(`:\n${NOT_DECLARED}\n`, `:\n"""${NOT_DECLARED}"""\n`);
	p = p.replace(
		'chain-of-thought):\n(none recorded)\n',
		'chain-of-thought):\n"""(none recorded)"""\n'
	);
	p = hashAsHead(accountAsHead(rubricAsHead(p)));
	const fence = /^<<<UNTRUSTED-\d\d>>>$/m.exec(p)?.[0];
	if (fence === undefined) return p;
	const parts = p.split(`\n${fence}\n`);
	let out = parts[0]!;
	for (let i = 1; i < parts.length; i += 2) {
		const before = parts[i - 1]!;
		const after = parts[i + 1] ?? '';
		if (before.endsWith('A PREVIOUS review flagged:'))
			out = `${out.slice(0, -'A PREVIOUS review flagged:'.length)}A PREVIOUS review flagged: ${parts[i]}. ${after}`;
		else if (/(to review:|running the instruction above:)$/.test(before))
			out += `\n${parts[i]}\n${after}`;
		else out += `\n"""${parts[i]}"""\n${after}`;
	}
	return out;
}

/** Who the capture says reviews — an identity no producer carries, and no transport: the print seam is a stub. */
const CAPTURE: CandidateIdentity = {
	transport: 'stub',
	agentId: 'jpwb-prompt-move',
	provider: 'jpwb-prompt-move',
	modelLabel: 'jpwb-prompt-move',
	servedModelDigest: null,
	servedTemplateSha256: null,
	servedModelfileSha256: null,
	templateInjectsDate: null,
	serverVersion: null,
	serverUtcOffset: null,
	options: {},
	bounds: { wallClockMs: 240_000, promptChars: null, printTimeout: null },
	argv: null
};
/** Today's initial and repair prompt for a case, captured exactly as the runner sends them (`evaluateCase`). */
async function promptsOf(
	c: QualificationCase
): Promise<{ readonly initial: string; readonly repair: string }> {
	const sent: string[] = [];
	await evaluateCase({
		case: c,
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		candidate: CAPTURE,
		scoringDigest: '0'.repeat(64),
		call: async (p) => {
			sent.push(p);
			return {
				returned:
					sent.length === 1
						? 'not a judgement'
						: JSON.stringify({
								findings: SEEDED_REASONING_REVIEW_CRITERIA.map((k) => ({
									criterionId: k.id,
									failed: false,
									statement: 'absent'
								})),
								recommendation: 'SATISFIED'
							}),
				served: null
			};
		}
	});
	expect(sent, `${c.id}: an initial prompt and a repair`).toHaveLength(2);
	return { initial: sent[0]!, repair: sent[1]! };
}

/** Today's initial prompt for `input`, captured at the fingerprint's validator print seam, as the case prompts are. */
async function initialPromptOf(c: QualificationCase, input: ReasoningReviewInput): Promise<string> {
	const sent: string[] = [];
	await PRODUCT_SEAMS.validator(async (p) => {
		sent.push(p);
		return JSON.stringify({
			findings: SEEDED_REASONING_REVIEW_CRITERIA.map((k) => ({ criterionId: k.id, failed: false, statement: 'absent' })),
			recommendation: 'SATISFIED'
		});
	}).evaluate(c.subject, { reasoningReview: input });
	expect(sent.length, `${c.id}: a prompt was materialized`).toBeGreaterThan(0);
	return sent[0]!;
}

let TODAY: Map<string, { readonly initial: string; readonly repair: string }>;
beforeAll(async () => {
	// ⛔ No program can be found from this process: the validator's default print is `agyPrint`.
	vi.stubEnv('PATH', NO_PROGRAMS);
	TODAY = new Map();
	for (const c of CASES) TODAY.set(c.id, await promptsOf(c));
}, 120_000);
afterAll(() => {
	vi.unstubAllEnvs();
});

const runLine = (runId: string): RunLine => {
	const r = RECORD.find((l): l is RunLine => l.kind === 'RUN' && l.runId === runId);
	expect(r, `${runId}: a RUN line in the record`).toBeDefined();
	return r!;
};
const callsOf = (runId: string): CallLine[] =>
	RECORD.filter((l): l is CallLine => l.kind === 'CALL' && l.runId === runId);

describe('⭐⭐ JAN-PRQUAL PQ-1 — design §4.1 against the RECORD: every case the selected candidate was measured on moved only by the fence and the declared cuts, the account’s regions and the host lines (§4.1 steps 1 to 4), and design §9.3 D7 and D8 (steps 2a and 2c)', () => {
	it('⭐ the arrangement — the selected run measured every current case of the graph and work-product arms, twice, under case set v3; the prompts captured here are the ones the fingerprint hashes, and none carries a cut', async () => {
		expect(runLine(SELECTED_RUN).caseSetVersion, 'case set v3').toBe(3);
		const initial = callsOf(SELECTED_RUN).filter((c) => c.role === 'initial');
		expect(initial).toHaveLength(2 * CASES.length);
		expect([...new Set(initial.map((c) => c.caseId))].sort()).toEqual(
			CASES.map((c) => c.id).sort()
		);
		expect(new Set(CASES.map((c) => c.arm)), 'the two arms of v3').toEqual(
			new Set(['PWA_GRAPH', 'WORK_PRODUCT'])
		);
		const fp = await reviewerFingerprint(CASES);
		for (const c of CASES) {
			const today = TODAY.get(c.id)!;
			expect(
				[sha256(today.initial), sha256(today.repair)],
				`${c.id}: the fingerprint's case prompts`
			).toEqual([fp.casePrompts.get(c.id)!.initial, fp.casePrompts.get(c.id)!.repair]);
			expect(
				today.initial.includes('[CUT FOR THIS REVIEW: '),
				`${c.id}: seen whole — the inverse holds for an uncut prompt`
			).toBe(false);
			expect(
				today.initial.includes(`\n${SUBJECT_HASH_LINE}`),
				`${c.id}: carries no subject hash — so step 2b is held by the last test below, not by the record`
			).toBe(false);
		}
	});

	it('⭐ today’s INITIAL prompt of every v3 case, inverted, hashes to the initial prompt the selected run recorded — and today’s own does not: the move is real', () => {
		const lines = callsOf(SELECTED_RUN).filter((c) => c.role === 'initial');
		for (const line of lines) {
			const today = TODAY.get(line.caseId)!.initial;
			expect(
				sha256(headPromptOf(today)),
				`${line.caseId}#${line.repetition}: today’s, inverted, is the one measured`
			).toBe(line.promptSha256);
			expect(
				sha256(today),
				`${line.caseId}#${line.repetition}: today’s is not — the fence moved it`
			).not.toBe(line.promptSha256);
		}
	});

	it('⭐ …and its REPAIR prompt likewise, where one was recorded: the selected run recorded none, so every repair the record holds of a current case under the same reviewer definition', () => {
		// ⚠ The selected run drew no repair (`REG-D-093`: 52 evaluations, no repairs), so its repair half would be vacuous.
		// The record's repairs of a CURRENT case under the SAME reviewer fingerprint — the same prompt side, so the same
		// prompts were sent — stand in: the ollama run's two of W-CLEAN-R3, a case v3 carries byte-identical from v1.
		expect(
			callsOf(SELECTED_RUN).filter((c) => c.role === 'repair'),
			'the selected run recorded no repair'
		).toEqual([]);
		const definition = runLine(SELECTED_RUN).reviewerFingerprint;
		const sameDefinition = new Set(
			RECORD.filter(
				(l): l is RunLine => l.kind === 'RUN' && l.reviewerFingerprint === definition
			).map((r) => r.runId)
		);
		const repairs = RECORD.filter(
			(l): l is CallLine =>
				l.kind === 'CALL' &&
				l.role === 'repair' &&
				sameDefinition.has(l.runId) &&
				TODAY.has(l.caseId)
		);
		expect(
			repairs.length,
			'the arrangement: the record holds a repair of a current case under that definition'
		).toBeGreaterThan(0);
		for (const line of repairs) {
			const today = TODAY.get(line.caseId)!.repair;
			expect(
				sha256(headPromptOf(today)),
				`${line.runId} ${line.caseId}#${line.repetition}: the repair, inverted`
			).toBe(line.promptSha256);
			expect(
				sha256(today),
				`${line.runId} ${line.caseId}#${line.repetition}: today’s repair is not the one measured`
			).not.toBe(line.promptSha256);
		}
	});

	it('⭐ …and EVERY v3 case’s REPAIR prompt is its initial prompt and the repair instruction, today as at HEAD: inverted, it is HEAD’s initial prompt of the case and that instruction — the hash each repair the record holds under the selected run’s definition carries', () => {
		// ⚠ A DERIVED PIN, AND WHY: the selected run drew no repair, so the record holds HEAD's repair of one current case
		// alone (W-CLEAN-R3, the row above). The validator draws a repair by appending ONE instruction to the initial prompt
		// (`reasoning-review-validator.ts`, today as at HEAD 8bb23c96), so a case's repair inverts to HEAD's repair as its
		// initial prompt inverts to HEAD's — held here for every case, initial and repair, and the instruction held to the
		// record by the repairs it does hold. ⭐ Design §9.3 D7 and D8 moved both prompts of every case; this is what keeps
		// the move, for the repairs too, exactly what was decided.
		const SUFFIX = '\n\nIMPORTANT: reply with ONLY the minified JSON object.';
		for (const c of CASES) {
			const today = TODAY.get(c.id)!;
			expect(today.repair, `${c.id}: the repair is the initial prompt and the instruction`).toBe(`${today.initial}${SUFFIX}`);
			expect(headPromptOf(today.repair), `${c.id}: inverted, HEAD’s initial prompt and the instruction`).toBe(
				`${headPromptOf(today.initial)}${SUFFIX}`
			);
		}
		const definition = runLine(SELECTED_RUN).reviewerFingerprint;
		const sameDefinition = new Set(
			RECORD.filter((l): l is RunLine => l.kind === 'RUN' && l.reviewerFingerprint === definition).map((r) => r.runId)
		);
		const repairs = RECORD.filter(
			(l): l is CallLine => l.kind === 'CALL' && l.role === 'repair' && sameDefinition.has(l.runId) && TODAY.has(l.caseId)
		);
		expect(repairs.length, 'the arrangement: the record holds a repair under that definition').toBeGreaterThan(0);
		for (const line of repairs)
			expect(
				sha256(`${headPromptOf(TODAY.get(line.caseId)!.initial)}${SUFFIX}`),
				`${line.runId} ${line.caseId}#${line.repetition}: HEAD’s initial prompt and the instruction, as recorded`
			).toBe(line.promptSha256);
	});

	it('⭐ step 2b over every v3 graph case GIVEN a subject hash: today’s prompt, inverted, is HEAD’s for that input — the hash merged back into the graph’s JSON, where HEAD put it', async () => {
		// ⚠ A DERIVED PIN, AND WHY (`REG-F-481`): no v3 case carries a hash, so no recorded prompt holds step 2b. HEAD
		// rendered a graph given one as `JSON.stringify({ ...graph, candidateSubjectHash })`, in the content's place, and
		// changed nothing else of the prompt for it; so HEAD's prompt for a case given a hash is HEAD's prompt for the case —
		// the one the record holds, matched above — with its content so rendered.
		const hash = 'sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';
		const graphs = CASES.filter((c) => c.arm === 'PWA_GRAPH');
		expect(graphs.length, 'the arrangement: v3 holds graph cases').toBeGreaterThan(0);
		for (const c of graphs) {
			const input = caseReviewInput(c, SEEDED_REASONING_REVIEW_CRITERIA);
			const bare = await initialPromptOf(c, input);
			const given = await initialPromptOf(c, { ...input, candidateSubjectHash: hash });
			expect(given, `${c.id}: the arrangement — the hash stands on its host line`).toContain(
				`\n${SUBJECT_HASH_LINE}${hash}\n`
			);
			const merged = JSON.stringify({ ...(JSON.parse(input.content) as object), candidateSubjectHash: hash });
			expect(headPromptOf(given), `${c.id}: inverted, HEAD's prompt for the case given a hash`).toBe(
				headPromptOf(bare).replace(`\n${input.content}\n`, `\n${merged}\n`)
			);
		}
	});
});
