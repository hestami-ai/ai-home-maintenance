// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 — THE DECLARED-POLICY CASES OF CASE SET VERSION FIVE, AND THEIR PROPOSED ORACLES
// (`DESIGN-phase-7-completion.md` B5; `REG-F-523`; `REG-D-110` (3)).
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
//     is BLOCKING in the catalog; every standing the author's claim; ⛔ and every one PROPOSED, AWAITING SPONSOR CONFERRAL;
//   · MEASURABLE WITH NO MODEL (design B5): the runner's own `evaluateCase`, its transport a stub, scores each case as its
//     oracle expects when answered so, and a planted case answered all-clean as SATISFIED — the plant is the verdict's.
// No model is called.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BLOCKING_SEVERITIES, SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { declaredPolicyReviewInput } from '../apps/rph-demo/src/lib/server/assurance/review-input.js';
import {
	CASE_PRODUCER_MODEL_ID,
	CASE_PRODUCER_PROVIDER_ID,
	CASE_SET_V4_FILE,
	CURRENT_CASE_SET_FILE,
	CURRENT_ORACLES_FILE,
	type CaseSet,
	type DeclaredPolicyCase,
	type OracleSet
} from '../scripts/reviewer-qual/cases.js';
import { DECLARED_CASE_POLICIES } from '../scripts/reviewer-qual/case-set-v5.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';
import { DECLARED_ORACLES_PROPOSED } from '../scripts/reviewer-qual/oracles-v5.js';
import type { CandidateIdentity } from '../scripts/reviewer-qual/record.js';
import { evaluateCase } from '../scripts/reviewer-qual/runner.js';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const read = <T>(file: string): T => JSON.parse(readFileSync(`${REPO}${file}`, 'utf8')) as T;
const CURRENT = read<CaseSet>(CURRENT_CASE_SET_FILE);
const ORACLES = read<OracleSet>(CURRENT_ORACLES_FILE);
const V4 = read<CaseSet>(CASE_SET_V4_FILE);
const DECLARED = CURRENT.cases.filter((c): c is DeclaredPolicyCase => c.arm === 'DECLARED_POLICY');
const ORACLE = new Map(ORACLES.oracles.map((o) => [o.caseId, o]));
/** The ids, in design B's order: each policy's clean case, then its planted one. Written here. */
const IDS = [
	'D-RC-CLEAN',
	'D-RC-04',
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
	'D-FP-CLEAN',
	'D-FP-03'
];

describe('⭐⭐ E2 — case set v5: version four, then the fourteen declared-policy cases (design B5)', () => {
	it('⭐ THE SHAPE — version four’s forty cases first, byte for byte; then the fourteen, in design B’s order, the last arm', () => {
		expect([CURRENT.caseSetVersion, ORACLES.oracleVersion, ORACLES.caseSetVersion]).toEqual([5, 5, 5]);
		expect(CURRENT.cases.slice(0, V4.cases.length).map((c) => JSON.stringify(c))).toEqual(V4.cases.map((c) => JSON.stringify(c)));
		expect(CURRENT.cases.slice(V4.cases.length).map((c) => c.id)).toEqual(IDS);
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
			const clean = DECLARED.find((c) => c.id === `D-${short}-CLEAN`)!;
			const planted = DECLARED.find((c) => c.id.startsWith(`D-${short}-`) && c !== clean)!;
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
				...work
			});
			expect(caseReviewInput(c, SEEDED_REASONING_REVIEW_CRITERIA), c.id).toEqual(expected);
			expect(expected.criteria.map((k) => k.id), `${c.id}: the floor’s rubric`).not.toContain(SEEDED_REASONING_REVIEW_CRITERIA[0]!.id);
		}
	});
});

describe('⭐⭐ E2 — the declared oracles: PROPOSED, AWAITING SPONSOR CONFERRAL (design B5, §6 step 2)', () => {
	it('⭐ a clean case SATISFIED faulting nothing; a planted case REJECTED faulting its plant’s criterion — BLOCKING in the catalog; every standing the author’s claim', () => {
		for (const c of DECLARED) {
			const o = ORACLE.get(c.id)!;
			expect(o, c.id).toBeDefined();
			expect(o.expectation, c.id).toBe("the author's claim");
			if (c.id.endsWith('-CLEAN')) {
				expect([o.faulted, o.disposition], c.id).toEqual([[], 'SATISFIED']);
				continue;
			}
			const criterionId = c.id.slice(2);
			expect([o.faulted, o.disposition], c.id).toEqual([[criterionId], 'REJECTED']);
			const k = c.input.policy.criteria.find((x) => x.id === criterionId);
			expect(k, `${c.id}: its plant’s criterion is its policy’s`).toBeDefined();
			expect(BLOCKING_SEVERITIES.has(k!.severityIfNotMet), `${c.id}: its plant’s criterion is BLOCKING`).toBe(true);
			expect(o.note, `${c.id}: its note names the criterion`).toContain(`(${criterionId})`);
		}
	});

	it('⛔ PROPOSED, NOT CONFERRED — the record says so, and version four’s conferred oracles are carried unchanged', () => {
		expect(DECLARED_ORACLES_PROPOSED).toBe('PROPOSED, AWAITING SPONSOR CONFERRAL');
		expect(ORACLES.conferral).toContain(DECLARED_ORACLES_PROPOSED);
		const v4 = read<OracleSet>('docs/tracking/reviewer-qualification/oracles/oracles-v4.json');
		expect(ORACLES.oracles.slice(0, v4.oracles.length)).toEqual(v4.oracles);
		expect(ORACLES.oracles.slice(v4.oracles.length).map((o) => o.caseId)).toEqual(IDS);
	});
});

describe('⭐⭐ E2 — measurable by the existing runner, NO MODEL CALLED (design B5)', () => {
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
});
