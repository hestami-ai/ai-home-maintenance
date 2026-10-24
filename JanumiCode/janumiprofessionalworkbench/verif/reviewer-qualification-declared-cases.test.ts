// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 — THE DECLARED-POLICY CASES OF CASE SET VERSION FIVE, AND THEIR ~~PROPOSED~~ ORACLES,
// ⭐ CONFERRED AS PROPOSED (`REG-D-113`) (`DESIGN-phase-7-completion.md` B5; `REG-F-523`; `REG-D-110` (3)).
//
// For each of the seven declared policies the Phase 7 run assigns, ONE clean case and ONE planted case, one criterion's
// defect planted. What is held here:
//   · THE SHAPE — version four's forty cases first, byte for byte, then the fourteen in design B's order, each policy's
//     clean case before its planted one; every declared case a work unit whose producer no candidate is (`REG-D-072` D13);
//   · THE POLICY — each case carries its policy AS THE CATALOG SEEDS IT, whole, so the reviewer is asked the criteria a
//     live sign-off asks (`ASR-4`);
//   · THE PLANT — a planted case differs from its clean twin in the work and the account, never in the policy, the
//     instruction or the subject;
//   · THE ORACLES — a clean case SATISFIED faulting nothing, a planted case REJECTED faulting its plant's criterion, which
//     is BLOCKING in the catalog; every standing the author's claim; ~~⛔ and every one PROPOSED, AWAITING SPONSOR
//     CONFERRAL~~ ⭐ and every one CONFERRED by the sponsor as proposed (`REG-D-113`), its record saying so in their words;
//   · MEASURABLE WITH NO MODEL (design B5): the runner's own `evaluateCase`, its transport a stub, scores each case as its
//     oracle expects when answered so, and a planted case answered all-clean as SATISFIED — the plant is the verdict's.
// ⭐⭐ `JAN-EXEC` Phase 7 completion, round 5 — AND SINCE VERSION SIX, D-FP-CLEAN REPAIRED AS D6-FP-CLEAN (the sponsor's
// ruling, to be registered as `REG-D-115`): the limbs above hold the CURRENT set's fourteen, D6-FP-CLEAN among them; the
// block at the end holds version six as the generator writes it — ~~version five with that one case changed, its oracle
// carried~~ ⭐ version five with four cases changed, the three below under the ruling's delegated extension, each one's
// oracle carried — and the repaired record to its own evidence: every run the host recorded, every output what the stated
// fixtures give, each of R1–R7 shown by a run, standard error recorded, and an account that claims what the runs show.
// ⚠ THE EXPECTED TEXT THERE IS WRITTEN HERE, not imported, and the outputs are computed here from the product's stated
// behaviour, independently of the source.
// ⭐ AND UNDER THE RULING'S DELEGATED EXTENSION (`REG-D-115`), THREE MORE, each under a new id: D-FP-CLEAN's planted twin
// D-FP-03, its record the repaired one's but for its plant; and the requirements pair D-RC-CLEAN and D-RC-04, each
// requirement naming truthfully what the request states and what is derived (RC-05), the planted twin the clean list but
// for its plant. The block at the end holds each pair to differing by its plant alone.
// ⭐ AND THE CHECK OF THAT EXTENSION: the selected reviewer, passing version five's D-RC-CLEAN in P4, named as residual
// uncertainty that no requirement stated the request's Node.js tool or its UTF-8 file, and that R6's bad arguments were a
// closed list. D6-RC-CLEAN's R1 states the request's constraints (RC-03), and its R6 makes a bad argument any invocation the
// usage line does not allow (RC-04); D6-FP-CLEAN shows R1's UTF-8 reading with a run, and names the bad arguments it did
// not try.
// No model is called.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BLOCKING_SEVERITIES, SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { MAX_AGY_PROMPT_CHARS } from '../apps/rph-demo/src/lib/server/assurance/agy-cli.js';
import { declaredPolicyReviewInput } from '../apps/rph-demo/src/lib/server/assurance/review-input.js';
import {
	CASE_PRODUCER_MODEL_ID,
	CASE_PRODUCER_PROVIDER_ID,
	CASE_SET_V4_FILE,
	CASE_SET_V5_FILE,
	CURRENT_CASE_SET_FILE,
	CURRENT_ORACLES_FILE,
	ORACLES_V5_FILE,
	ORACLES_V6_FILE,
	serializeGenerated,
	type CaseSet,
	type DeclaredPolicyCase,
	type OracleSet
} from '../scripts/reviewer-qual/cases.js';
import { DECLARED_CASE_POLICIES } from '../scripts/reviewer-qual/case-set-v5.js';
import { CASE_SET_V6 } from '../scripts/reviewer-qual/case-set-v6.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';
import { DECLARED_ORACLES_PROPOSED } from '../scripts/reviewer-qual/oracles-v5.js';
import { ORACLES_V6 } from '../scripts/reviewer-qual/oracles-v6.js';
import type { CandidateIdentity } from '../scripts/reviewer-qual/record.js';
import { evaluateCase } from '../scripts/reviewer-qual/runner.js';
import { TransportFailure } from '../scripts/reviewer-qual/transports.js';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const read = <T>(file: string): T => JSON.parse(readFileSync(`${REPO}${file}`, 'utf8')) as T;
const CURRENT = read<CaseSet>(CURRENT_CASE_SET_FILE);
const ORACLES = read<OracleSet>(CURRENT_ORACLES_FILE);
const V4 = read<CaseSet>(CASE_SET_V4_FILE);
/**
 * ⭐ Round 5 — version five, current from E2 to round 5: version six is it with ~~D-FP-CLEAN repaired~~ ⭐ four cases
 * repaired, D-RC-CLEAN, D-RC-04, D-FP-CLEAN and D-FP-03.
 */
const V5 = read<CaseSet>(CASE_SET_V5_FILE);
const V5_ORACLES = read<OracleSet>(ORACLES_V5_FILE);
const DECLARED = CURRENT.cases.filter((c): c is DeclaredPolicyCase => c.arm === 'DECLARED_POLICY');
const ORACLE = new Map(ORACLES.oracles.map((o) => [o.caseId, o]));
/** The ids, in design B's order: each policy's clean case, then its planted one. Written here. */
const IDS = [
	// ⭐ Round 5 — ~~'D-RC-CLEAN', 'D-RC-04'~~: version six repairs both, under new ids (`REG-D-115`, its delegated extension).
	'D6-RC-CLEAN',
	'D6-RC-04',
	'D-IP-CLEAN',
	'D-IP-02',
	'D-AD-CLEAN',
	'D-AD-01',
	'D-DC-CLEAN',
	'D-DC-01',
	'D-AC-CLEAN',
	'D-AC-01',
	'D-TA-CLEAN',
	'D-TA-08',
	// ⭐ Round 5 — ~~'D-FP-CLEAN'~~: version six repairs it, under a new id (`REG-D-115`); ~~'D-FP-03'~~ and its planted twin
	// (the ruling's delegated extension).
	'D6-FP-CLEAN',
	'D6-FP-03'
];
/** Each declared policy's clean case, by the short prefix its case ids carry. */
const cleanOf = (short: string): string => IDS.find((id) => id.endsWith(`-${short}-CLEAN`))!;
/** ⭐ Round 5 — each declared policy's planted case: the other id carrying its short prefix, `D-` or, repaired, `D6-`. */
const plantedOf = (short: string): string => IDS.find((id) => new RegExp(`^D6?-${short}-`).test(id) && id !== cleanOf(short))!;
/** ⭐ Round 5 — the criterion a planted case's id names: `D-AC-01`'s and `D6-RC-04`'s alike. */
const criterionOf = (id: string): string => id.replace(/^D6?-/, '');

describe('⭐⭐ E2 — the current case set (v5, and v6 since round 5): version four, then the fourteen declared-policy cases (design B5)', () => {
	it('⭐ THE SHAPE — version four’s ~~forty~~ non-graph cases first, byte for byte; then the fourteen, in design B’s order — the last arm through version six, ~~version seven’s six graph cases~~ ⭐ version eight’s 35 part cases after them', () => {
		// ⭐ Round 5 — ~~[5, 5, 5]~~: the current set and its oracles are version six (`REG-D-115`).
		// ⭐ Package P F3 — ~~[6, 6, 6]~~: version seven, which carries version six's cases byte for byte and adds six graph
		// cases after them (`REG-D-123` Q25; `reviewer-qualification-cases.test.ts`), so the fourteen are the last arm no more.
		// ⭐ The review in parts, B7 — ~~[7, 7, 7]~~: version eight, which carries version seven's 41 non-graph cases byte for
		// byte — version four's work-product and process-result cases, then the fourteen — and 35 part cases after them
		// (`REG-D-126`); version four's graph cases are no case of it.
		// ⭐ B8a — ~~[8, 8, 8]~~: version nine, which carries version eight's 76 cases under their ids, its 41 non-part cases byte
		// for byte (`REG-D-127`).
		expect([CURRENT.caseSetVersion, ORACLES.oracleVersion, ORACLES.caseSetVersion]).toEqual([9, 9, 9]);
		const v4NonGraph = V4.cases.filter((c) => c.arm !== 'PWA_GRAPH');
		expect(v4NonGraph, 'the arrangement: version four’s 27 non-graph cases').toHaveLength(27);
		expect(CURRENT.cases.slice(0, v4NonGraph.length).map((c) => JSON.stringify(c))).toEqual(v4NonGraph.map((c) => JSON.stringify(c)));
		expect(CURRENT.cases.slice(v4NonGraph.length, v4NonGraph.length + IDS.length).map((c) => c.id)).toEqual(IDS);
		expect(
			CURRENT.cases.slice(v4NonGraph.length + IDS.length).map((c) => c.arm),
			'⭐ B7: only part cases after them'
		).toEqual(Array(35).fill('PWA_TYPE'));
		expect(DECLARED.map((c) => c.id)).toEqual(IDS);
		expect(DECLARED_CASE_POLICIES.map(([policyId]) => policyId)).toEqual([
			'pol_requirement_coverage',
			'pol_intent_preservation',
			'pol_assumption_disclosure',
			'pol_decomposition_coverage',
			'pol_architecture_coverage',
			'pol_test_adequacy',
			'pol_fitness_for_purpose'
		]);
	});

	it('⭐ THE SUBJECT, BY ARM (REG-D-072 D13) — a work unit, its producer the one no candidate is; ⛔ no id reads as a word', () => {
		for (const c of DECLARED) {
			expect(
				[c.subject.objectType, c.subject.producer?.modelId, c.subject.producer?.providerId, c.subject.isAiProduced],
				c.id
			).toEqual(['PROFESSIONAL_WORK_UNIT', CASE_PRODUCER_MODEL_ID, CASE_PRODUCER_PROVIDER_ID, true]);
			expect(c.subject.subjectId, `${c.id}: production’s shape`).toMatch(/^pwu_[0-9A-HJKMNP-TV-Z]{26}$/);
			expect(/[A-Z]{3}/.test(c.subject.subjectId.slice(4)), `${c.id}: its id reads as a word`).toBe(false);
		}
	});

	it('⭐ THE POLICY — each case carries its policy as the catalog seeds it, whole: id, name, purpose, every criterion', () => {
		for (const c of DECLARED) {
			const seeded = ontology.seedPolicies.find((p) => p.policyId === c.input.policy.policyId)!;
			expect(c.input.policy, c.id).toEqual({
				policyId: seeded.policyId,
				name: seeded.name,
				purpose: seeded.purpose,
				criteria: JSON.parse(JSON.stringify(seeded.criteria))
			});
		}
	});

	it('⭐ THE PLANT — a planted case differs from its clean twin in the work and the account alone: never the policy, the instruction or the subject', () => {
		for (const [, short] of DECLARED_CASE_POLICIES) {
			const clean = DECLARED.find((c) => c.id === cleanOf(short))!;
			// ⭐ Round 5 — ~~`c.id.startsWith(`D-${short}-`)`~~: a repaired planted case carries `D6-`.
			const planted = DECLARED.find((c) => c.id === plantedOf(short))!;
			expect([planted.input.policy, planted.input.instruction, planted.subject], planted.id).toEqual([
				clean.input.policy,
				clean.input.instruction,
				clean.subject
			]);
			expect(
				JSON.stringify([planted.input.workProducts, planted.input.commands, planted.input.rationale]),
				`${planted.id}: it plants nothing`
			).not.toBe(JSON.stringify([clean.input.workProducts, clean.input.commands, clean.input.rationale]));
		}
	});

	it('⭐ MATERIALIZE — through the builder Record Assurance builds with, its OWN policy’s criteria: the floor’s rubric never reaches a declared case', () => {
		for (const c of DECLARED) {
			const { policy, ...work } = c.input;
			const expected = declaredPolicyReviewInput({
				policy: { policyId: policy.policyId, name: policy.name, purpose: policy.purpose },
				criteria: policy.criteria,
				instructionIs: 'PRODUCING_PROMPT',
				...work
			});
			expect(caseReviewInput(c, SEEDED_REASONING_REVIEW_CRITERIA), c.id).toEqual(expected);
			expect(expected.criteria.map((k) => k.id), `${c.id}: the floor’s rubric`).not.toContain(SEEDED_REASONING_REVIEW_CRITERIA[0]!.id);
		}
	});
});

describe('⭐⭐ E2 — the declared oracles: ~~PROPOSED, AWAITING SPONSOR CONFERRAL~~ CONFERRED AS PROPOSED (design B5, §6 step 2; REG-D-113)', () => {
	it('⭐ a clean case SATISFIED faulting nothing; a planted case REJECTED faulting its plant’s criterion — BLOCKING in the catalog; every standing the author’s claim', () => {
		for (const c of DECLARED) {
			const o = ORACLE.get(c.id)!;
			expect(o, c.id).toBeDefined();
			expect(o.expectation, c.id).toBe("the author's claim");
			if (c.id.endsWith('-CLEAN')) {
				expect([o.faulted, o.disposition], c.id).toEqual([[], 'SATISFIED']);
				continue;
			}
			// ⭐ Round 5 — ~~`c.id.slice(2)`~~: a repaired planted case's id carries `D6-`.
			const criterionId = criterionOf(c.id);
			expect([o.faulted, o.disposition], c.id).toEqual([[criterionId], 'REJECTED']);
			const k = c.input.policy.criteria.find((x) => x.id === criterionId);
			expect(k, `${c.id}: its plant’s criterion is its policy’s`).toBeDefined();
			expect(BLOCKING_SEVERITIES.has(k!.severityIfNotMet), `${c.id}: its plant’s criterion is BLOCKING`).toBe(true);
			expect(o.note, `${c.id}: its note names the criterion`).toContain(`(${criterionId})`);
		}
	});

	// ⭐ The merge of the completion programme — THE SPONSOR CONFERRED THEM (`REG-D-113`): ~~PROPOSED, NOT CONFERRED —
	// the record says so~~. The record now says they are conferred, in the sponsor's words, and carries the proposal's word no
	// more, so the check holds a run to them (`ORACLES_NOT_CONFERRED` never fires on today's set).
	// ⭐ Package P F3 (`REG-D-123` Q25) — ~~never fires on today's set~~: version seven's statement is version six's, whole, and
	// then a sentence saying its six NEW graph-case oracles are PROPOSED, so the check refuses today's set until the sponsor
	// confers those six (`reviewer-qualification-cases.test.ts`). The declared oracles' own statement is version six's, and
	// still carries no proposal's word.
	it('⭐ CONFERRED AS PROPOSED (REG-D-113) — the record says so, in the sponsor’s words, and version four’s conferred oracles are carried unchanged', () => {
		expect(DECLARED_ORACLES_PROPOSED).toBe('PROPOSED, AWAITING SPONSOR CONFERRAL');
		const declaredStatement = read<OracleSet>(ORACLES_V6_FILE).conferral;
		expect(declaredStatement, 'the record still carries the proposal’s word').not.toContain(DECLARED_ORACLES_PROPOSED);
		// ⭐ The review in parts, B7 — ~~version seven's statement opens with it, whole, and the proposal's word after it, once,
		// of the six graph cases~~: version eight's carries it whole, as the 41's conferral, and the proposal's word nowhere —
		// the six graph cases are conferred (`REG-D-124`) and no case of version eight, and its part oracles are conferred too
		// (`REG-D-126`).
		expect(ORACLES.conferral, 'B7: version eight’s statement carries it, whole').toContain(` carried with every standing unchanged: ${declaredStatement} `);
		expect(ORACLES.conferral, 'B7: and the proposal’s word nowhere').not.toContain(DECLARED_ORACLES_PROPOSED);
		// ⭐ Round 5 — ~~"The fourteen declared-policy oracles were conferred by the sponsor as proposed (REG-D-113: …)"~~:
		// ~~thirteen are version five's, conferred so, and the fourteenth is carried to the repaired case by `REG-D-115`~~ ⭐ ten
		// are version five's, conferred so; D6-FP-CLEAN's is carried to it by `REG-D-115`, and the other three repaired cases'
		// by its delegated extension, flagged for the sponsor's confirmation — never said to be the sponsor's.
		expect(ORACLES.conferral).toContain(
			'Ten of the fourteen declared-policy oracles are version five’s, carried unchanged, conferred by the sponsor as proposed (REG-D-113: asked “Do you confer the 14 declared-policy answers as proposed: each clean case SATISFIED, each planted case REJECTED on the criterion named in the table?”, the sponsor chose “Confer all 14 (Recommended)”)'
		);
		expect(ORACLES.conferral).toContain(
			'D6-FP-CLEAN’s — SATISFIED, faulting nothing, the author’s claim — is D-FP-CLEAN’s for the case repaired, conferred by REG-D-115'
		);
		expect(ORACLES.conferral).toContain('the sponsor chose “Repair the case (Recommended)”');
		expect(ORACLES.conferral).toContain(
			'D6-FP-03’s (REJECTED, faulting FP-03), D6-RC-CLEAN’s (SATISFIED, faulting nothing) and D6-RC-04’s (REJECTED, faulting RC-04), each the author’s claim, are D-FP-03’s, D-RC-CLEAN’s and D-RC-04’s, carried unchanged to their repaired cases under REG-D-115’s delegated extension — the lead’s, flagged for sponsor confirmation.'
		);
		// ⭐ The figures the statement names are the record's: ten declared oracles version five's whole, four carried.
		const v5Declared = new Map(V5_ORACLES.oracles.slice(V4.cases.length).map((o) => [o.caseId, JSON.stringify(o)]));
		// ⭐ Package P F3 — ~~`slice(V4.cases.length)`~~: the declared oracles, before version seven's six graph-case ones.
		// ⭐ The review in parts, B7 — ~~`slice(V4.cases.length, …)`~~: by their ids, version eight holding none of version four's
		// graph cases before them.
		const declaredNow = ORACLES.oracles.filter((o) => IDS.includes(o.caseId));
		expect(declaredNow.map((o) => o.caseId), 'the arrangement: the fourteen, in order').toEqual(IDS);
		expect(declaredNow.filter((o) => v5Declared.get(o.caseId) === JSON.stringify(o)).length, 'version five’s, whole').toBe(10);
		expect(declaredNow.filter((o) => !v5Declared.has(o.caseId)).map((o) => o.caseId), 'carried to a repaired case').toEqual([
			'D6-RC-CLEAN',
			'D6-RC-04',
			'D6-FP-CLEAN',
			'D6-FP-03'
		]);
		const v4 = read<OracleSet>('docs/tracking/reviewer-qualification/oracles/oracles-v4.json');
		// ⭐ The review in parts, B7 — ~~version four's oracles first, whole~~: version four's for its non-graph cases, whole,
		// version eight holding none of its graph cases.
		const v4NonGraph = v4.oracles.filter((o) => !o.caseId.startsWith('G'));
		expect(v4NonGraph, 'the arrangement: version four’s 27 non-graph oracles').toHaveLength(27);
		expect(ORACLES.oracles.slice(0, v4NonGraph.length)).toEqual(v4NonGraph);
		expect(ORACLES.oracles.slice(v4NonGraph.length, v4NonGraph.length + IDS.length).map((o) => o.caseId)).toEqual(IDS);
	});
});

/** The candidate a stub transport answers as — no model. ⭐ Round 5: at module level, so version six's block reads it too. */
const STUB: CandidateIdentity = {
	transport: 'stub',
	agentId: 'stub-reviewer',
	provider: 'jpwb-test',
	modelLabel: 'stub-model',
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

describe('⭐⭐ E2 — measurable by the existing runner, NO MODEL CALLED (design B5)', () => {
	/** A reply answering every criterion of `c`'s own rubric, failing `faulted`. */
	const reply = (c: DeclaredPolicyCase, faulted: readonly string[]) =>
		JSON.stringify({
			findings: c.input.policy.criteria.map((k) => ({
				criterionId: k.id,
				failed: faulted.includes(k.id),
				statement: faulted.includes(k.id) ? 'not met' : 'met'
			})),
			recommendation: faulted.length ? 'REJECTED' : 'SATISFIED'
		});
	const score = async (c: DeclaredPolicyCase, answer: string) => {
		const sent: string[] = [];
		const e = await evaluateCase({
			case: c,
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			candidate: STUB,
			scoringDigest: '0'.repeat(64),
			call: async (prompt) => {
				sent.push(prompt);
				return { returned: answer, served: null };
			}
		});
		return { scored: e.scored, sent, calls: e.calls };
	};

	it('⭐ each case, answered as its oracle expects, is scored with its oracle’s verdict, its reply read against its own rubric — and its prompt names its policy', async () => {
		for (const c of DECLARED) {
			const o = ORACLE.get(c.id)!;
			const { scored, sent, calls } = await score(c, reply(c, o.faulted));
			expect([scored.disposition, scored.resultClass], c.id).toEqual([o.disposition, 'VALID']);
			// ⛔ Its reply's rows read against ITS policy's criteria: a well-formed declared reply records no malformation.
			expect(calls.map((k) => k.malformations), `${c.id}: malformations the reviewer never made`).toEqual([[]]);
			expect(scored.criteria.map(([k]) => k), `${c.id}: one row per criterion of its policy`).toEqual(
				c.input.policy.criteria.map((k) => k.id)
			);
			expect(sent[0], c.id).toContain(`(${c.input.policy.policyId})`);
		}
	});

	it('⛔ a planted case answered ALL CLEAN is scored SATISFIED — the plant is the verdict’s, never the scorer’s', async () => {
		for (const c of DECLARED.filter((x) => !x.id.endsWith('-CLEAN')))
			expect((await score(c, reply(c, []))).scored.disposition, c.id).toBe('SATISFIED');
	});

	// ── ⛔⛔ E12’s polish (the confirm’s runner.ts finding) — A DECLARED CASE IS SCORED AS THE DECLARED SIGN-OFF RECORDS ITS VERDICT ──
	// The scorer read a declared case by the floor composition's ladder, while the sign-off computes the verdict it records
	// by its own rule (`declared-policy-signoff.ts` `declaredVerdict`): no boundary class and no `REG-D-089` rule (a), its own
	// limbs, its policy's evidence ceiling. Each case below is one where the two part; the qualification must measure what the
	// product will record.
	/** A reply answering every criterion of `c`'s rubric, failing `faulted`, recommending `recommendation`. */
	const recommending = (c: DeclaredPolicyCase, faulted: readonly string[], recommendation: string) =>
		JSON.stringify({ ...(JSON.parse(reply(c, faulted)) as object), recommendation });
	/** `c` judged against another of the catalog's policies, as the catalog seeds it — a case past v5's seven. */
	const under = (c: DeclaredPolicyCase, policyId: string): DeclaredPolicyCase => {
		const p = ontology.seedPolicies.find((x) => x.policyId === policyId)!;
		return {
			...c,
			id: `${c.id}-UNDER-${policyId}`,
			input: { ...c.input, policy: { policyId, name: p.name, purpose: p.purpose, criteria: p.criteria.map((k) => ({ ...k, requiredEvidenceIds: [...k.requiredEvidenceIds] })) } }
		};
	};

	it('⛔ E12’s polish — a reply that faults a planted case’s criterion and RECOMMENDS SATISFIED is scored REJECTED, as the sign-off records it — never the floor’s BOUNDARY_REJECTED', async () => {
		// ⛔ PREDICTED RED, read from the code: BOUNDARY_REJECTED — `classifyValidatorResult` refuses a SATISFIED beside an unmet
		// mandatory criterion, while `verdictOf` never reads the recommendation and records REJECTED, which meets the bar.
		for (const c of DECLARED.filter((x) => !x.id.endsWith('-CLEAN')))
			expect((await score(c, recommending(c, ORACLE.get(c.id)!.faulted, 'SATISFIED'))).scored.disposition, c.id).toBe('REJECTED');
	});

	it('⛔ E12’s polish — a clean reply RECOMMENDING ESCALATED is scored SATISFIED, as the sign-off records it — REG-D-089’s rule (a) is the floor’s, never the declared verdict’s', async () => {
		// ⛔ PREDICTED RED, read from the code: ESCALATED — `composeAssuranceOutcome`'s second pass escalates a clean review its
		// reviewer recommends ESCALATED, and the sign-off records SATISFIED, the recommendation noted beside it.
		for (const c of DECLARED.filter((x) => x.id.endsWith('-CLEAN')))
			expect((await score(c, recommending(c, [], 'ESCALATED'))).scored.disposition, c.id).toBe('SATISFIED');
	});

	it('⛔ E12’s polish — a review that THREW is scored INCONCLUSIVE, its class VALIDATOR_FAILED, as the sign-off records a review that produced no answer', async () => {
		// ⛔ PREDICTED RED, read from the code: VALIDATOR_FAILED as the disposition — the floor runner's for a throwing validator;
		// the sign-off reads the throw as the review's failure and records INCONCLUSIVE.
		const c = DECLARED[0]!;
		const e = await evaluateCase({
			case: c,
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			candidate: STUB,
			scoringDigest: '0'.repeat(64),
			call: () => {
				throw new TransportFailure('TIMEOUT', 'cut at 240000 ms');
			}
		});
		expect([e.scored.disposition, e.scored.resultClass]).toEqual(['INCONCLUSIVE', 'VALIDATOR_FAILED']);
		expect(new Set(e.scored.criteria.map(([, outcome]) => outcome)), 'every criterion recorded undetermined').toEqual(new Set(['UNABLE_TO_DETERMINE']));
	});

	it('⛔ E12’s polish — past v5’s seven: a policy with no mandatory criterion, answered NONE, is INCONCLUSIVE; a policy whose own evidence caps a verdict is scored at its ceiling', async () => {
		// ⛔ PREDICTED RED, read from the code: SATISFIED for each — the ladder reads mandatory criteria only, and no ceiling.
		const historical = under(DECLARED[0]!, 'pol_historical_consistency');
		expect(historical.input.policy.criteria.every((k) => !BLOCKING_SEVERITIES.has(k.severityIfNotMet as never)), 'arrangement: no mandatory criterion').toBe(true);
		expect((await score(historical, JSON.stringify({ findings: [], recommendation: 'SATISFIED' }))).scored.disposition, 'none answered').toBe('INCONCLUSIVE');
		const fidelity = under(DECLARED[0]!, 'pol_intent_fidelity');
		expect((await score(fidelity, reply(fidelity, []))).scored.disposition, 'its evidence ceiling').toBe('CONDITIONALLY_SATISFIED');
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7 completion, round 5 — case set version six: D-FP-CLEAN repaired as D6-FP-CLEAN (`REG-D-115`) ──
// ⭐ (and, below, the three more its delegated extension repairs: four cases changed in all)
// In P4 the selected reviewer rejected D-FP-CLEAN on FP-06 and FP-07, and its record bore that out: its runs showed three of
// R1–R7, and the missing file's message on standard error was not recorded, while its verdict claimed every run matched.
// The sponsor ruled the case be repaired, its oracle kept SATISFIED. These limbs read version six AS THE GENERATOR WRITES IT
// (the freshness limb holds the committed files to those bytes), and hold the repaired record to its own evidence.
// ⭐ Under the ruling's delegated extension (`REG-D-115`), three more cases are repaired, each under a new id: D-FP-03, whose
// record carried the old one's flaws beside its plant, so a reviewer could reject it without detecting the plant; and
// D-RC-CLEAN and D-RC-04, whose sources gave the request words it does not state (RC-05), and whose R2 read as if
// `--top 0` meant 10. Each planted case is its clean twin's record but for its plant.
/** Version six and its oracles, as `generate.ts` writes them. */
const V6 = JSON.parse(serializeGenerated(CASE_SET_V6)) as CaseSet;
const V6_ORACLES = JSON.parse(serializeGenerated(ORACLES_V6)) as OracleSet;
const REPAIRED = 'D6-FP-CLEAN';
/** ⭐ The fixture whose run shows R1's UTF-8 reading: an accented word, in three case forms. */
const ACCENTED = 'test/e2e/fixtures/accented.txt';
/** ⭐ The cases version six repairs, in version five's order, and the version-five id each replaces. Written here. */
const REPAIRED_FROM: ReadonlyMap<string, string> = new Map([
	['D6-RC-CLEAN', 'D-RC-CLEAN'],
	['D6-RC-04', 'D-RC-04'],
	['D6-FP-CLEAN', 'D-FP-CLEAN'],
	['D6-FP-03', 'D-FP-03']
]);
const V5_ID_OF = new Map([...REPAIRED_FROM].map(([to, from]) => [from, to]));
const declaredIn = (set: CaseSet, id: string): DeclaredPolicyCase => {
	const c = set.cases.find((x) => x.id === id);
	if (c?.arm !== 'DECLARED_POLICY') throw new Error(`${id}: version ${set.caseSetVersion} holds no declared case of that id`);
	return c;
};

/** An end-to-end unit's work product, as its answer carries it — every field optional that version five's lacks. */
interface EndToEnd {
	readonly fixtures?: readonly { readonly path: string; readonly contents: string; readonly words: string }[];
	readonly runs: readonly {
		readonly run?: number;
		readonly command: string;
		readonly stdout: string;
		readonly stderr?: string;
		readonly exit: number;
		readonly expected: string;
	}[];
	readonly requirements?: readonly { readonly id: string; readonly text: string; readonly runs: readonly number[] }[];
	readonly verdict: string;
}
const endToEnd = (c: DeclaredPolicyCase): EndToEnd => JSON.parse(c.input.workProducts[0]!.answer) as EndToEnd;
/** A requirements unit's work product, as its answer carries it. */
interface RequirementList {
	readonly requirements: readonly { readonly id: string; readonly text: string; readonly source: string }[];
	readonly exclusions: readonly string[];
}
const requirementsOf = (c: DeclaredPolicyCase): RequirementList => JSON.parse(c.input.workProducts[0]!.answer) as RequirementList;
/**
 * R1–R7 as the requirements case states them (~~D-RC-CLEAN's~~ ⭐ D6-RC-CLEAN's work product, since its repair) — read when a
 * limb asks, so a version six without it reddens the limbs that read it, never the file.
 */
const rcRequirements = (): { id: string; text: string }[] =>
	requirementsOf(declaredIn(V6, 'D6-RC-CLEAN')).requirements.map(({ id, text }) => ({ id, text }));

/** A word, as the requirements case assumes one: a maximal run of letters, digits and apostrophes. */
const WORD = /[\p{L}\p{N}']+/gu;
const wordsOf = (text: string): string[] => text.match(WORD) ?? [];
/** The top `top` of `tokens` as the product prints words: counted case-insensitively, in lower case, ties alphabetical. */
function ranked(tokens: readonly string[], top: number): string {
	const counts = new Map<string, number>();
	for (const w of tokens) counts.set(w.toLowerCase(), (counts.get(w.toLowerCase()) ?? 0) + 1);
	const lines = [...counts].sort(([a, x], [b, y]) => y - x || (a < b ? -1 : Number(a > b))).slice(0, top);
	return lines.map(([w, n]) => `${n} ${w}\n`).join('');
}
/** What standard error must carry: nothing, a message naming the file, or a usage message. */
type StatedStderr = 'NOTHING' | 'A MESSAGE NAMING THE FILE' | 'A USAGE MESSAGE';
interface Stated {
	readonly stdout: string;
	readonly exit: number;
	readonly stderr: StatedStderr;
	readonly file: string | undefined;
}
/**
 * ⭐ WHAT THE PRODUCT'S STATED BEHAVIOUR GIVES FOR ONE COMMAND — the instruction's own sentence, computed here: the N most
 * frequent words (10 with no `--top`, else the positive integer it names) as `<count> <word>`, compared case-insensitively
 * and printed in lower case, ties in alphabetical order; a file no stated fixture holds cannot be read, and exits 2 with a
 * message on standard error; a bad argument exits 1. The messages are the product's own words, so of standard error this asks only
 * whether it is empty, names the file, or carries a usage message.
 */
function stated(command: string, fixtures: ReadonlyMap<string, string>): Stated {
	const [, ...args] = command.split(' ');
	let file: string | undefined;
	let top = 10;
	const bad: Stated = { stdout: '', exit: 1, stderr: 'A USAGE MESSAGE', file: undefined };
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--top') {
			const n = args[++i];
			if (n === undefined || !/^[1-9]\d*$/.test(n)) return bad;
			top = Number(n);
		} else if (file === undefined) file = args[i];
		else return bad;
	}
	if (file === undefined) return bad;
	const text = fixtures.get(file);
	if (text === undefined) return { stdout: '', exit: 2, stderr: 'A MESSAGE NAMING THE FILE', file };
	return { stdout: ranked(wordsOf(text), top), exit: 0, stderr: 'NOTHING', file };
}
const stderrIs = (stderr: string, s: Stated): boolean =>
	s.stderr === 'NOTHING' ? stderr === '' : s.stderr === 'A USAGE MESSAGE' ? /\busage\b/.test(stderr) : stderr.includes(s.file!);
type Run = EndToEnd['runs'][number];
/** Whether a run did what the stated behaviour gives — on standard output, standard error and its exit code. */
const holds = (r: Run, s: Stated): boolean =>
	r.stdout === s.stdout && r.exit === s.exit && r.stderr !== undefined && stderrIs(r.stderr, s);

/**
 * ⭐ WHICH OF R1–R7 THE RUNS SHOW — read HERE, from the runs and the stated fixtures, never from the producer's own mapping;
 * a run shows only what it was seen to do as stated (`holds`).
 *   R1 a ranked `<count> <word>` list ⭐ AND, since R1 states the request's UTF-8 file, a printed word outside ASCII,
 *   read from its file whole; R2 both a `--top k` run printing k of more than k words AND a run with no `--top`
 *   printing 10 of more than 10; R3 a printed word its file holds in more than one case form; R4 two adjacent lines of
 *   equal count; R5 a file no fixture holds, exiting 2; R6 both no file AND a `--top` that is not a positive integer,
 *   exiting 1; R7 a file holding no word, printing nothing.
 */
function shownRequirements(w: EndToEnd, fixtures: ReadonlyMap<string, string>): Set<string> {
	const seen = new Set<string>();
	for (const r of w.runs) {
		const s = stated(r.command, fixtures);
		if (!holds(r, s)) continue;
		const args = r.command.split(' ').slice(1);
		const text = s.file === undefined ? undefined : fixtures.get(s.file);
		const lines = r.stdout === '' ? [] : r.stdout.slice(0, -1).split('\n');
		const distinct = new Set(wordsOf(text ?? '').map((x) => x.toLowerCase())).size;
		if (text !== undefined && lines.length > 0) {
			seen.add('R1 list');
			if (lines.some((l) => /\P{ASCII}/u.test(l))) seen.add('R1 UTF-8');
			const n = args.includes('--top') ? Number(args[args.indexOf('--top') + 1]) : 10;
			if (lines.length === n && distinct > n) seen.add(args.includes('--top') ? 'R2 --top' : 'R2 default');
			const forms = (word: string) => new Set(wordsOf(text).filter((x) => x.toLowerCase() === word)).size;
			if (lines.some((l) => forms(l.split(' ')[1]!) > 1)) seen.add('R3');
			if (lines.some((l, i) => i > 0 && l.split(' ')[0] === lines[i - 1]!.split(' ')[0])) seen.add('R4');
		}
		if (text !== undefined && distinct === 0) seen.add('R7');
		if (s.exit === 2) seen.add('R5');
		if (s.exit === 1) seen.add(args.includes('--top') ? 'R6 --top' : 'R6 no file');
	}
	if (seen.has('R1 list') && seen.has('R1 UTF-8')) seen.add('R1');
	if (seen.has('R2 --top') && seen.has('R2 default')) seen.add('R2');
	if (seen.has('R6 --top') && seen.has('R6 no file')) seen.add('R6');
	return seen;
}

/** ⭐ What keeps an end-to-end record from being clean on its own evidence, in order — empty when nothing does. */
function recordProblems(c: DeclaredPolicyCase): string[] {
	const p: string[] = [];
	const w = endToEnd(c);
	const requirements = rcRequirements();
	const fixtures = new Map((w.fixtures ?? []).map((f) => [f.path, f.contents]));
	if (w.fixtures === undefined) p.push('the work product states no fixture’s contents');
	if (w.requirements === undefined) p.push('the work product maps no requirement to the runs that show it');
	else {
		if (JSON.stringify(w.requirements.map(({ id, text }) => ({ id, text }))) !== JSON.stringify(requirements))
			p.push('its requirements are not R1–R7 as the requirements case states them');
		for (const q of w.requirements) {
			if (q.runs.length === 0) p.push(`${q.id} names no run`);
			for (const n of q.runs)
				if (!w.runs[n - 1]?.expected.includes(q.id)) p.push(`${q.id} names run ${n}, whose expected outcome does not name it`);
		}
	}
	// ⭐ THE HOST'S RECORDS ARE THE RUNS — one command each, in order, the built CLI with the run's arguments and exit code.
	if (c.input.commands.length !== w.runs.length)
		p.push(`the host recorded ${c.input.commands.length} command(s) for ${w.runs.length} run(s)`);
	w.runs.forEach((r, i) => {
		const label = `run ${i + 1} (${r.command})`;
		if (r.run !== undefined && r.run !== i + 1) p.push(`${label}: numbered ${r.run}`);
		const k = c.input.commands[i];
		const argv = ['node', 'bin/wordfreq.js', ...r.command.split(' ').slice(1)];
		if (k && (JSON.stringify(k.argv) !== JSON.stringify(argv) || k.exitCode !== r.exit || k.timedOut || k.unit !== 'End-to-end'))
			p.push(`${label}: the host recorded ${k.argv.join(' ')}, exit ${k.exitCode}${k.timedOut ? ', timed out' : ''}`);
		// ⭐ EVERY STREAM RECORDED — standard error beside standard output, on every run.
		if (r.stderr === undefined) return void p.push(`${label}: no standard error recorded`);
		if (w.fixtures === undefined) return;
		// ⭐ EVERY OUTPUT IS WHAT THE STATED FIXTURES GIVE.
		const s = stated(r.command, fixtures);
		if (r.stdout !== s.stdout)
			p.push(`${label}: printed ${JSON.stringify(r.stdout)}, where the stated fixtures give ${JSON.stringify(s.stdout)}`);
		if (r.exit !== s.exit) p.push(`${label}: exited ${r.exit}, where the stated behaviour gives ${s.exit}`);
		if (!stderrIs(r.stderr, s))
			p.push(`${label}: wrote ${JSON.stringify(r.stderr)} to standard error, where it gives ${s.stderr.toLowerCase()}`);
	});
	// ⭐ EACH OF R1–R7 SHOWN BY A RUN — the reading above, never the producer's.
	const shown = shownRequirements(w, fixtures);
	for (const { id } of requirements) if (!shown.has(id)) p.push(`${id} is shown by no run`);
	// ⭐ AND THE PRODUCER'S MAPPING IS TRUE — the runs a requirement names show it, read alone.
	for (const q of w.requirements ?? []) {
		const named = shownRequirements({ ...w, runs: w.runs.filter((_, i) => q.runs.includes(i + 1)) }, fixtures);
		if (!named.has(q.id)) p.push(`${q.id}: the runs it names (${q.runs.join(', ')}) do not show it`);
	}
	return p;
}

describe('⭐⭐ Round 5 — case set v6: version five with D-FP-CLEAN repaired as D6-FP-CLEAN, its oracle kept SATISFIED (REG-D-115) — and, under its delegated extension, D-FP-03, D-RC-CLEAN and D-RC-04', () => {
	it('⭐ VERSION SIX IS VERSION FIVE WITH FOUR CASES CHANGED — D-RC-CLEAN, D-RC-04, D-FP-CLEAN and D-FP-03, each in its place, under a new id; each one’s subject, policy and instruction kept; every other case version five’s byte for byte', () => {
		expect(V6.caseSetVersion).toBe(6);
		// ⭐ Round 5's extension — ~~`c.id === 'D-FP-CLEAN' ? REPAIRED : c.id`~~: four cases, each under its new id.
		expect(V6.cases.map((c) => c.id)).toEqual(V5.cases.map((c) => V5_ID_OF.get(c.id) ?? c.id));
		const changed = V6.cases.filter((c, i) => JSON.stringify(c) !== JSON.stringify(V5.cases[i]));
		expect(changed.map((c) => c.id), 'the cases version six changes').toEqual([...REPAIRED_FROM.keys()]);
		for (const [to, from] of REPAIRED_FROM) {
			const [was, is] = [declaredIn(V5, from), declaredIn(V6, to)];
			expect([is.subject, is.input.policy, is.input.instruction], `${to}: its subject, policy and instruction are ${from}’s`).toEqual([
				was.subject,
				was.input.policy,
				was.input.instruction
			]);
			// ⭐ What each repair rewrites: D6-FP-CLEAN's and D6-FP-03's work, commands and account; D6-RC-CLEAN's and
			// D6-RC-04's work and account — a requirements unit runs no command.
			for (const k of ['workProducts', 'commands', 'rationale'] as const)
				if (to.startsWith('D6-FP-') || k !== 'commands') expect(is.input[k], `${to}: its ${k}, rewritten`).not.toEqual(was.input[k]);
		}
	});

	it('⭐ ORACLES v6 — version five’s, each repaired case’s carried to it: D6-FP-CLEAN’s by REG-D-115, the other three by its delegated extension — each its verdict, faulted list and standing unchanged, only its id and its note moved', () => {
		expect([V6_ORACLES.oracleVersion, V6_ORACLES.caseSetVersion]).toEqual([6, 6]);
		expect(V6_ORACLES.oracles.map((o) => o.caseId)).toEqual(V6.cases.map((c) => c.id));
		V6_ORACLES.oracles.forEach((o, i) => {
			const was = V5_ORACLES.oracles[i]!;
			const from = REPAIRED_FROM.get(o.caseId);
			if (from === undefined) return void expect(o, o.caseId).toEqual(was);
			expect({ ...o, caseId: was.caseId, note: was.note }, `${from}’s oracle, its id and note aside`).toEqual(was);
			expect(was.caseId).toBe(from);
			expect(o.note, `${o.caseId}: its note says why version six repairs it`).toContain(`Version six repairs ${from} (REG-D-115`);
		});
		expect(
			[...REPAIRED_FROM.keys()].map((id) => {
				const o = V6_ORACLES.oracles.find((x) => x.caseId === id)!;
				return [id, o.faulted, o.disposition, o.expectation];
			})
		).toEqual([
			['D6-RC-CLEAN', [], 'SATISFIED', "the author's claim"],
			['D6-RC-04', ['RC-04'], 'REJECTED', "the author's claim"],
			['D6-FP-CLEAN', [], 'SATISFIED', "the author's claim"],
			['D6-FP-03', ['FP-03'], 'REJECTED', "the author's claim"]
		]);
		expect(V6_ORACLES.conferral).toContain(
			'Ten of the fourteen declared-policy oracles are version five’s, carried unchanged, conferred by the sponsor as proposed (REG-D-113'
		);
		expect(V6_ORACLES.conferral).toContain('is D-FP-CLEAN’s for the case repaired, conferred by REG-D-115');
		expect(V6_ORACLES.conferral).toContain('the sponsor chose “Repair the case (Recommended)”');
		expect(V6_ORACLES.conferral).toContain('under REG-D-115’s delegated extension — the lead’s, flagged for sponsor confirmation');
	});

	it('⭐ D6-FP-CLEAN’S RECORD IS CLEAN ON ITS OWN EVIDENCE — the host recorded every run, every output is what its stated fixtures give, standard error is recorded, and each of R1–R7 is shown by a run, R1’s UTF-8 reading by the accented file’s; ⛔ CONTROL: version five’s D-FP-CLEAN fails these limbs, R3, R4, R6 and R7 and its missing file’s standard error among them (the reviewer’s FP-06 and FP-07); and the sample’s ASCII alone does not show R1', () => {
		// ⛔ THE CONTROL — the record the reviewer rejected. With no fixture's text stated, no output it reports can be held to
		// its fixture, so this reading counts no run of it as showing anything: stricter than the reviewer, who read R1 and R2
		// off the instruction's census of the sample.
		expect(recordProblems(declaredIn(V5, 'D-FP-CLEAN'))).toEqual([
			'the work product states no fixture’s contents',
			'the work product maps no requirement to the runs that show it',
			'run 1 (wordfreq test/e2e/fixtures/sample.txt --top 2): no standard error recorded',
			'run 2 (wordfreq test/e2e/fixtures/missing.txt): no standard error recorded',
			'R1 is shown by no run',
			'R2 is shown by no run',
			'R3 is shown by no run',
			'R4 is shown by no run',
			'R5 is shown by no run',
			'R6 is shown by no run',
			'R7 is shown by no run'
		]);
		expect(recordProblems(declaredIn(V6, REPAIRED))).toEqual([]);
		// ⛔ CONTROL — R1 states the request's UTF-8 file: read with the accented file's text unstated, its run shows nothing,
		// and the sample's runs show R1's list but not its UTF-8 reading.
		const w = endToEnd(declaredIn(V6, REPAIRED));
		const ascii = new Map((w.fixtures ?? []).filter((f) => f.path !== ACCENTED).map((f) => [f.path, f.contents]));
		const seen = shownRequirements(w, ascii);
		expect([seen.has('R1 list'), seen.has('R1 UTF-8'), seen.has('R1')], 'R1, from the sample alone').toEqual([true, false, false]);
	});

	it('⭐ ITS FIXTURES, STATED WHOLE — the sample as the instruction describes it (12 distinct words, "the" ×7, "a" ×5), its census true of its text, ⭐ the accented file, its census true of its text, and the empty file', () => {
		const c = declaredIn(V6, REPAIRED);
		expect(c.input.instruction).toContain('test/e2e/fixtures/sample.txt (12 distinct words, "the" ×7, "a" ×5)');
		expect(endToEnd(c).fixtures).toEqual([
			{
				path: 'test/e2e/fixtures/sample.txt',
				contents:
					'A cat sat on the mat. The Dog sat on a rug.\nThe CAT ran to the dog. A dog ran to the cat.\nA rug, a mat, the sun, the end.\n',
				words:
					'32 words, 12 distinct: the ×7 (The ×2, the ×5), a ×5 (A ×3, a ×2), cat ×3 (cat ×2, CAT ×1), dog ×3 (Dog ×1, dog ×2), mat ×2, on ×2, ran ×2, rug ×2, sat ×2, to ×2, end ×1, sun ×1'
			},
			{ path: ACCENTED, contents: 'Été, été, ÉTÉ.\n', words: '3 words, 1 distinct: été ×3 (Été ×1, été ×1, ÉTÉ ×1)' },
			{ path: 'test/e2e/fixtures/empty.txt', contents: '', words: 'none' }
		]);
		const sample = wordsOf(endToEnd(c).fixtures![0]!.contents);
		const count = (w: string) => sample.filter((x) => x.toLowerCase() === w).length;
		expect([sample.length, new Set(sample.map((x) => x.toLowerCase())).size, count('the'), count('a')]).toEqual([32, 12, 7, 5]);
		// ⭐ The accented file: three words, one word in three case forms, each outside ASCII.
		const accented = wordsOf(endToEnd(c).fixtures![1]!.contents);
		expect([accented, accented.map((x) => x.toLowerCase()), accented.every((x) => /\P{ASCII}/u.test(x))]).toEqual([
			['Été', 'été', 'ÉTÉ'],
			['été', 'été', 'été'],
			true
		]);
	});

	it('⭐ ITS VERDICT AND ITS ACCOUNT CLAIM WHAT THE RUNS SHOW — written here whole: the limitations name what was not run, the residual uncertainty what was not tried', () => {
		const c = declaredIn(V6, REPAIRED);
		expect(endToEnd(c).verdict).toBe(
			'Each of the seven runs matches what its requirements state, on standard output, standard error and its exit code, and each of R1–R7 is shown by at least one run — R5 for a missing file only, and R6 for no file and `--top 0` only.'
		);
		expect(c.input.rationale).toEqual({
			rationale:
				'Seven runs of the built CLI show each of R1–R7 end to end: on the sample, the top two and the default top ten as `<count> <word>`, mixed-case words counted together and printed in lower case, and equal counts in alphabetical order; on a UTF-8 file, an accented word in three case forms read whole, counted as one and printed in lower case; the empty file printed nothing and exited 0; the missing file exited 2 with its message on standard error and printed nothing; and `--top 0` and no file named each exited 1 with a usage message on standard error. On this evidence wordfreq serves its user — the most frequent words of a text file, and a plain message on standard error when it cannot give them — within the limitations below.',
			assumptions: [],
			limitations: [
				'Very large files were not run; the largest file run is the 32-word sample.',
				'R5 was shown with a missing file only; a file that exists but cannot be read was not tried.',
				'R6 was shown with no file and with `--top 0` only; other bad arguments — a second file, an option other than `--top`, `--top` with no number — were not tried.'
			],
			residualUncertainty: ['Non-Latin text was not tried end to end.']
		});
	});

	// ── ⭐ The delegated extension (`REG-D-115`) — D6-FP-03: D6-FP-CLEAN's record but for its plant (FP-03) ─────────────────
	it('⭐ D6-FP-03’S RECORD FAILS ON ITS PLANT ALONE — the ~~sample’s two runs print the stated text’s~~ ⭐ three runs over text, the sample’s two and the accented file’s, print the stated texts’ LETTER counts, which the stated fixtures do not give as words, so no run shows R1–R4; every other output, every stream and every exit is what they give; ⛔ CONTROL: version five’s D-FP-03 failed every limb besides its plant, so a reviewer could reject it without detecting the plant', () => {
		const planted = declaredIn(V6, 'D6-FP-03');
		const w = endToEnd(planted);
		// ⭐ THE PLANT IS TRUE OF THE STATED TEXT — the sample's letters, counted as the product counts words, the top two and ten;
		// ⭐ and the accented file's, the top ten.
		const letters = w.fixtures![0]!.contents.match(/\p{L}/gu) ?? [];
		const [two, ten] = ['16 t\n14 a\n', '16 t\n14 a\n8 e\n7 h\n7 o\n6 n\n5 g\n4 d\n4 r\n3 c\n'];
		expect([ranked(letters, 2), ranked(letters, 10)], 'arrangement: the stated sample’s letters, counted').toEqual([two, ten]);
		const accentedLetters = w.fixtures![1]!.contents.match(/\p{L}/gu) ?? [];
		const accented = '6 é\n3 t\n';
		expect(ranked(accentedLetters, 10), 'arrangement: the stated accented file’s letters, counted').toBe(accented);
		expect(w.runs.slice(0, 3).map((r) => r.stdout), 'the three runs over text').toEqual([two, ten, accented]);
		const sample = 'test/e2e/fixtures/sample.txt';
		expect(recordProblems(planted), 'D6-FP-03’s problems: its plant alone').toEqual([
			`run 1 (wordfreq ${sample} --top 2): printed ${JSON.stringify(two)}, where the stated fixtures give ${JSON.stringify('7 the\n5 a\n')}`,
			`run 2 (wordfreq ${sample}): printed ${JSON.stringify(ten)}, where the stated fixtures give ${JSON.stringify('7 the\n5 a\n3 cat\n3 dog\n2 mat\n2 on\n2 ran\n2 rug\n2 sat\n2 to\n')}`,
			`run 3 (wordfreq ${ACCENTED}): printed ${JSON.stringify(accented)}, where the stated fixtures give ${JSON.stringify('3 été\n')}`,
			'R1 is shown by no run',
			'R2 is shown by no run',
			'R3 is shown by no run',
			'R4 is shown by no run',
			'R1: the runs it names (1, 2, 3) do not show it',
			'R2: the runs it names (1, 2) do not show it',
			'R3: the runs it names (1, 2, 3) do not show it',
			'R4: the runs it names (2) do not show it'
		]);
		// ⛔ THE CONTROL — version five's planted twin: no fixture stated, no requirement mapped, no standard error, two runs.
		expect(recordProblems(declaredIn(V5, 'D-FP-03'))).toEqual([
			'the work product states no fixture’s contents',
			'the work product maps no requirement to the runs that show it',
			`run 1 (wordfreq ${sample} --top 2): no standard error recorded`,
			'run 2 (wordfreq test/e2e/fixtures/missing.txt): no standard error recorded',
			'R1 is shown by no run',
			'R2 is shown by no run',
			'R3 is shown by no run',
			'R4 is shown by no run',
			'R5 is shown by no run',
			'R6 is shown by no run',
			'R7 is shown by no run'
		]);
	});

	it('⭐ THE FITNESS PAIR DIFFERS BY THE PLANT ALONE — D6-FP-03 is D6-FP-CLEAN but for the ~~sample’s two runs~~ ⭐ three runs over text, the sample’s two and the accented file’s (what they printed, and what the producer said each showed), its verdict and its account’s rationale, which read exit statuses and the shape of the lines as the product serving its user: the plant written here whole', () => {
		const [clean, planted] = [declaredIn(V6, REPAIRED), declaredIn(V6, 'D6-FP-03')];
		const [c, p] = [endToEnd(clean), endToEnd(planted)];
		expect(Object.keys(p), 'the work product’s parts').toEqual(Object.keys(c));
		expect(planted.input.commands, 'the host’s records').toEqual(clean.input.commands);
		expect([p.fixtures, p.requirements], 'the fixtures, and the runs that show each requirement').toEqual([c.fixtures, c.requirements]);
		expect(p.runs.slice(3), 'every run but the three over text').toEqual(c.runs.slice(3));
		p.runs.slice(0, 3).forEach((r, i) =>
			expect({ ...r, stdout: c.runs[i]!.stdout, expected: c.runs[i]!.expected }, `run ${i + 1}, its output and expectation aside`).toEqual(c.runs[i])
		);
		expect(
			{ ...planted.input.rationale, rationale: clean.input.rationale!.rationale },
			'the account’s assumptions, limitations and residual uncertainty'
		).toEqual(clean.input.rationale);
		// ⭐ THE PLANT, WRITTEN HERE WHOLE.
		expect(p.runs.slice(0, 3).map((r) => r.expected)).toEqual([
			'R1, R2: `--top 2` names a positive integer, so two lines, one per line as `<count> <word>`; R3: each printed in lower case',
			'R1, R2: no `--top`, so ten lines, one per line as `<count> <word>`; R3: each printed in lower case; R4: the lines of equal count, 7 and 4, each in alphabetical order',
			'R1: the file read as UTF-8 text, `é` printed whole, one per line as `<count> <word>`; R3: each printed in lower case'
		]);
		expect(p.verdict).toBe(
			'Each of the seven runs exited as its requirements state, the sample’s two printing as many `<count> <word>` lines as asked for, and each of R1–R7 is shown by at least one run — R5 for a missing file only, and R6 for no file and `--top 0` only.'
		);
		expect(planted.input.rationale!.rationale).toBe(
			'Seven runs of the built CLI show each of R1–R7 end to end: on the sample, `--top 2` and the default exited 0 with as many `<count> <word>` lines as asked for, two and ten, printed in lower case, and equal counts in alphabetical order; on a UTF-8 file, it exited 0 with its lines in lower case, the accented character printed whole; the empty file printed nothing and exited 0; the missing file exited 2 with its message on standard error and printed nothing; and `--top 0` and no file named each exited 1 with a usage message on standard error. On this evidence wordfreq serves its user — the most frequent words of a text file, and a plain message on standard error when it cannot give them — within the limitations below.'
		);
	});

	// ── ⭐ The delegated extension (`REG-D-115`) — D6-RC-CLEAN and D6-RC-04: each requirement's source named truthfully ──────
	/** ⭐ The phrases a requirement of wordfreq states that the request may not — each read against the instruction. Written here. */
	// ⭐ The check of the extension adds "does not allow": R6 makes a bad argument any invocation the usage line does not
	// allow, which the request does not state either.
	const BEYOND_THE_REQUEST = ['positive integer', 'printed in lower case', 'prints nothing', 'a usage message', 'does not allow'];
	/**
	 * ⭐ RC-05 READ HERE — "Requirements without an authoritative source are identified": a requirement whose source is the
	 * request quotes, as a derived decision, each such phrase it states that the instruction does not; a requirement derived
	 * whole says so in its source.
	 */
	const unidentified = (c: DeclaredPolicyCase): string[] =>
		requirementsOf(c).requirements.flatMap((q) =>
			q.source.startsWith('derived')
				? []
				: BEYOND_THE_REQUEST.filter((phrase) => q.text.includes(phrase) && !c.input.instruction.includes(phrase))
						.filter((phrase) => !(q.source.includes(`${phrase}"`) && q.source.includes('derived decision')))
						.map((phrase) => `${q.id}: "${phrase}" is given to the request, which does not state it`)
		);
	/**
	 * ⭐ AND WHAT A SOURCE QUOTES AS THE REQUEST'S IS ITS OWN WORDS — each quotation in a source's `the request (…)` is a
	 * phrase of the instruction, verbatim.
	 */
	const misquoted = (c: DeclaredPolicyCase): string[] =>
		requirementsOf(c).requirements.flatMap((q) =>
			[...(/^the request \(([^)]*)\)/.exec(q.source)?.[1] ?? '').matchAll(/"([^"]*)"/g)]
				.map(([, quoted]) => quoted!)
				.filter((quoted) => !c.input.instruction.includes(quoted))
				.map((quoted) => `${q.id}: "${quoted}" is quoted as the request's, which does not say it`)
		);
	/** ⭐ The constraints the request states, each a phrase of the instruction. Written here. */
	const CONSTRAINTS = ['a Node.js command-line tool', '`wordfreq <file> [--top N]`', 'UTF-8'];
	/**
	 * ⭐ RC-03 READ HERE — "Each mandatory constraint creates enforceable obligations": each constraint the request states is
	 * stated by a requirement, never by an exclusion alone.
	 */
	const unstated = (c: DeclaredPolicyCase): string[] =>
		CONSTRAINTS.filter((k) => !requirementsOf(c).requirements.some((q) => q.text.includes(k))).map(
			(k) => `${k}: the request states it, and no requirement does`
		);
	/** ⭐ What R6 names a bad argument: any invocation the usage line does not allow, and the kinds of it. Written here. */
	const BAD_ARGUMENTS = ['does not allow', 'no file', 'a second file', 'an option other than `--top`', '`--top` without a positive integer'];
	const r6Of = (c: DeclaredPolicyCase): string => requirementsOf(c).requirements.find((q) => q.id === 'R6')!.text;
	const EXCLUSIONS = ['Input other than UTF-8 text is out of scope.', 'Reading from standard input is out of scope.'];
	const ASSUMED = {
		assumptions: ['A word is a maximal run of letters, digits and apostrophes.'],
		limitations: [],
		residualUncertainty: ['The word definition is an assumption the request leaves open.']
	};

	it('⭐ D6-RC-CLEAN — EACH REQUIREMENT NAMES ITS SOURCE TRUTHFULLY (RC-05): what the request does not state is named a derived decision, with its basis, ⭐ what it quotes as the request’s is the request’s own words, and R2 and R6 agree on a `--top` that is not a positive integer — written here whole; ⛔ CONTROL: version five’s D-RC-CLEAN gave the request R3’s “printed in lower case” and R6’s “a usage message”, and R2’s and R6’s “positive integer” and R5’s “prints nothing”, and its R2 read as if `--top 0` meant 10', () => {
		const c = declaredIn(V6, 'D6-RC-CLEAN');
		for (const phrase of BEYOND_THE_REQUEST)
			expect(c.input.instruction, `arrangement: the request does not state "${phrase}"`).not.toContain(phrase);
		// ⛔ THE CONTROL — version five's clean requirements case.
		const was = declaredIn(V5, 'D-RC-CLEAN');
		expect(unidentified(was)).toEqual([
			'R2: "positive integer" is given to the request, which does not state it',
			'R3: "printed in lower case" is given to the request, which does not state it',
			'R5: "prints nothing" is given to the request, which does not state it',
			'R6: "positive integer" is given to the request, which does not state it',
			'R6: "a usage message" is given to the request, which does not state it'
		]);
		expect(requirementsOf(was).requirements[1]!.text, 'version five’s R2').toBe('N is 10 unless `--top N` names a positive integer.');
		expect(unidentified(c), 'RC-05, D6-RC-CLEAN').toEqual([]);
		expect(misquoted(c), 'RC-05, D6-RC-CLEAN: its quotations of the request').toEqual([]);
		expect(requirementsOf(c), 'D6-RC-CLEAN’s requirements, written whole').toEqual({
			requirements: [
				// ⭐ The check of the extension: R1 states the request's constraints too (RC-03), its source quoting the request.
				{
					id: 'R1',
					text: 'wordfreq, a Node.js command-line tool run as `wordfreq <file> [--top N]`, reads the named file as UTF-8 text and prints its N most frequent words, one per line as `<count> <word>`.',
					source:
						'the request ("a Node.js command-line tool: `wordfreq <file> [--top N]` prints the N most frequent words of a UTF-8 text file", "one per line as `<count> <word>`")'
				},
				{
					id: 'R2',
					text: 'N is 10 when no `--top` is given, and otherwise the number `--top N` names, which must be a positive integer.',
					source:
						'the request (`[--top N]`, default 10); "a positive integer" is a derived decision: the request gives N no range, and a list of the N most frequent words is taken to list at least one'
				},
				{
					id: 'R3',
					text: 'Words are compared case-insensitively and printed in lower case.',
					source:
						'the request ("words compared case-insensitively"); "printed in lower case" is a derived decision: the request does not say in which form a word met in several forms is printed, so one form is fixed'
				},
				{ id: 'R4', text: 'Words with equal counts are printed in alphabetical order.', source: 'the request' },
				{
					id: 'R5',
					text: 'An unreadable or missing file exits 2 with a message on standard error, and prints nothing.',
					source:
						'the request ("exits 2 with a message on standard error when the file cannot be read"); "prints nothing" is a derived decision: the request does not say what standard output carries then, and a file not read has no word to print'
				},
				// ⭐ The check of the extension: a bad argument is any invocation the usage line does not allow (RC-04), its message
				// on R5's stream, and nothing printed.
				{
					id: 'R6',
					text: 'A bad argument — any invocation that `wordfreq <file> [--top N]` does not allow: no file, a second file, an option other than `--top`, or `--top` without a positive integer — exits 1 with a usage message on standard error, and prints nothing.',
					source:
						'the request ("1 on a bad argument"); "any invocation that `wordfreq <file> [--top N]` does not allow" is a derived decision: the request lists no bad argument, and its usage line is what the command accepts; "positive integer" follows R2; and "a usage message" on standard error, with "prints nothing", is a derived decision: the request names no message for a bad argument, a usage message shows the form the command takes, standard error is where R5 puts its message, and a bad argument leaves no word to print'
				},
				{ id: 'R7', text: 'An empty file prints nothing and exits 0.', source: 'derived from R1: no word, no line' }
			],
			exclusions: EXCLUSIONS
		});
		expect(c.input.commands).toEqual([]);
		expect(c.input.rationale).toEqual({
			rationale:
				'The seven requirements cover each outcome the request names and its two failure paths; R7 is derived and says from what, and R2, R3, R5 and R6 each name what in them is derived, and why; R1 states the request’s constraints: a Node.js command-line tool, its usage line and a UTF-8 text file. Two exclusions are recorded.',
			...ASSUMED
		});
	});

	it('⭐ D6-RC-CLEAN — THE REQUEST’S CONSTRAINTS ARE REQUIREMENTS (RC-03), AND A BAD ARGUMENT IS ANY INVOCATION ITS USAGE LINE DOES NOT ALLOW (RC-04): R1 states the Node.js tool, its usage line and its UTF-8 file, and R6 makes every invocation the usage line does not allow exit 1, naming its kinds; ⛔ CONTROL: version five’s D-RC-CLEAN, which the selected reviewer passed in P4 while naming as residual uncertainty that no requirement stated the Node.js tool or the UTF-8 file, and that R6’s bad arguments were a closed list', () => {
		const [c, was] = [declaredIn(V6, 'D6-RC-CLEAN'), declaredIn(V5, 'D-RC-CLEAN')];
		for (const k of CONSTRAINTS) expect(c.input.instruction, `arrangement: the request states "${k}"`).toContain(k);
		// ⛔ THE CONTROL — version five's: UTF-8 in an exclusion alone, the tool and its usage line in no requirement, and R6 a
		// closed list of two.
		expect(unstated(was)).toEqual([
			'a Node.js command-line tool: the request states it, and no requirement does',
			'`wordfreq <file> [--top N]`: the request states it, and no requirement does',
			'UTF-8: the request states it, and no requirement does'
		]);
		expect(requirementsOf(was).exclusions, 'version five’s UTF-8, in an exclusion').toContain('Input other than UTF-8 text is out of scope.');
		expect(
			BAD_ARGUMENTS.filter((k) => !r6Of(was).includes(k)),
			'version five’s R6, a closed list'
		).toEqual(['does not allow', 'a second file', 'an option other than `--top`', '`--top` without a positive integer']);
		expect(unstated(c), 'RC-03, D6-RC-CLEAN').toEqual([]);
		expect(BAD_ARGUMENTS.filter((k) => !r6Of(c).includes(k)), 'RC-04, D6-RC-CLEAN’s R6').toEqual([]);
	});

	it('⭐ THE REQUIREMENTS PAIR DIFFERS BY THE PLANT ALONE — D6-RC-04 is D6-RC-CLEAN’s list without its two failure paths, the empty-file requirement renumbered R5, the requirements it keeps repaired as its clean twin’s; its account still says the failure paths are covered (RC-04); ⛔ CONTROL: version five’s D-RC-04 carried its clean twin’s unnamed derivations beside its plant', () => {
		const [clean, planted] = [declaredIn(V6, 'D6-RC-CLEAN'), declaredIn(V6, 'D6-RC-04')];
		const kept = requirementsOf(clean)
			.requirements.filter((q) => q.id !== 'R5' && q.id !== 'R6')
			.map((q) => (q.id === 'R7' ? { ...q, id: 'R5' } : q));
		expect(requirementsOf(planted), 'D6-RC-04’s requirements: the clean list without R5 and R6').toEqual({
			requirements: kept,
			exclusions: requirementsOf(clean).exclusions
		});
		expect(planted.input.commands).toEqual([]);
		expect(unidentified(planted), 'RC-05, D6-RC-04').toEqual([]);
		expect(misquoted(planted), 'RC-05, D6-RC-04: its quotations of the request').toEqual([]);
		expect(unstated(planted), 'RC-03, D6-RC-04').toEqual([]);
		expect(planted.input.rationale, 'D6-RC-04’s account, written whole').toEqual({
			rationale:
				'The five requirements cover each outcome the request names, and its failure paths; R5 is derived and says from what, and R2 and R3 each name what in them is derived, and why; R1 states the request’s constraints: a Node.js command-line tool, its usage line and a UTF-8 text file. Two exclusions are recorded.',
			...ASSUMED
		});
		// ⛔ THE CONTROL — version five's planted twin.
		expect(unidentified(declaredIn(V5, 'D-RC-04'))).toEqual([
			'R2: "positive integer" is given to the request, which does not state it',
			'R3: "printed in lower case" is given to the request, which does not state it'
		]);
	});

	it('⭐ SEEN WHOLE — each repaired case’s prompt carries its work and its instruction uncut, within agy’s 28,000 characters', async () => {
		for (const id of REPAIRED_FROM.keys()) {
			const c = declaredIn(V6, id);
			const input = caseReviewInput(c, SEEDED_REASONING_REVIEW_CRITERIA);
			const sent: string[] = [];
			await evaluateCase({
				case: c,
				criteria: SEEDED_REASONING_REVIEW_CRITERIA,
				candidate: STUB,
				scoringDigest: '0'.repeat(64),
				call: async (prompt) => {
					sent.push(prompt);
					return {
						returned: JSON.stringify({
							findings: c.input.policy.criteria.map((k) => ({ criterionId: k.id, failed: false, statement: 'met' })),
							recommendation: 'SATISFIED'
						}),
						served: null
					};
				}
			});
			const [prompt] = sent;
			expect(prompt!.includes('[CUT FOR THIS REVIEW: '), `${id}: a slice is cut`).toBe(false);
			expect(prompt!.includes(input.content), `${id}: its work, whole`).toBe(true);
			expect(prompt!.includes(input.prompt), `${id}: its instruction, whole`).toBe(true);
			expect(prompt!.length, id).toBeLessThanOrEqual(MAX_AGY_PROMPT_CHARS);
		}
	});
});
