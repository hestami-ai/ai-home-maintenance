// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 — THE DECLARED-POLICY REVIEW SEAM, ARM BY ARM (`REG-F-523`; `REG-D-110` (3);
// `DESIGN-phase-7-completion.md` B1).
//
// The model reviewer is the product's own reasoning-review validator, its `print` seam a stand-in transport — the §14.3
// arrangement the validator's own tests use — run in the `DECLARED_POLICY` framing: these tests hold what the reviewer is
// SHOWN (the policy's purpose, its criteria as the rubric, the work) and what comes BACK (one row per criterion, the
// failed ones as findings at the POLICY's stakes, the declared policy named — never the floor's). The stand-in and a
// refused selection are held beside it. No model is called.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssuranceSubject } from '@janumipwb/rph-assurance';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { createDeclaredPolicyReviewer } from './index.js';
import {
	createModelDeclaredPolicyReviewer,
	createStandinDeclaredPolicyReviewer,
	DECLARED_REVIEW_VALIDATOR_ID,
	DECLARED_STIPULATION_STATEMENT,
	STANDIN_DECLARED_EVALUATOR,
	STANDIN_DECLARED_REVIEW_VALIDATOR_ID,
	UNCONFIGURED_DECLARED_REVIEWER_ID
} from './declared-policy-review.js';
import {
	createAgyReasoningReviewValidator,
	declaredPolicyLine,
	NO_DECLARED_POLICY_STATEMENT,
	ONE_ROW_PER_CRITERION
} from './reasoning-review-validator.js';
import { declaredPolicyReviewInput } from './review-input.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'pwu_01ARZ3NDEKTSV4RRFFQ69GSD01',
	objectType: 'PROFESSIONAL_WORK_UNIT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'model:producer', modelId: 'producer-model', providerId: 'p' }
};
const criterion = (id: string, severityIfNotMet: 'BLOCKING' | 'MATERIAL' | 'ADVISORY'): AssessmentCriterion =>
	({
		id,
		name: id,
		description: `Requirement ${id} is covered.`,
		criterionType: 'QUALITATIVE',
		evaluationMethod: 'MODEL_JUDGMENT',
		requiredEvidenceIds: [],
		severityIfNotMet,
		mayBeNotApplicable: false
	}) as AssessmentCriterion;
const CRITERIA = [criterion('RC-01', 'BLOCKING'), criterion('RC-02', 'MATERIAL'), criterion('RC-03', 'ADVISORY')];
const POLICY = {
	policyId: 'pol_requirement_coverage',
	name: 'Requirement Coverage',
	purpose: 'Determine whether approved outcomes are represented by requirements or explicitly excluded.'
};
const INPUT = declaredPolicyReviewInput({
	policy: POLICY,
	criteria: CRITERIA,
	instruction: 'Write the requirements of wordfreq.',
	workProducts: [{ unit: 'Requirements', answer: '{"requirements":["R1"]}' }],
	commands: [{ unit: 'Requirements', argv: ['node', '--test'], exitCode: 0, timedOut: false }],
	rationale: { rationale: 'All outcomes covered.', assumptions: [], limitations: [], residualUncertainty: [] }
});

/** The product's validator at its print seam: every prompt kept, `reply` returned. */
function capturing(reply: string) {
	const prompts: string[] = [];
	const validator = createAgyReasoningReviewValidator({
		modelId: 'qualified-reviewer-model',
		agentId: 'devin',
		providerId: 'devin',
		print: async (p) => {
			prompts.push(p);
			return reply;
		}
	});
	return { prompts, validator };
}
const CONFIGURED = () => ({ actorType: 'AGENT', agentId: 'devin', modelId: 'qualified-reviewer-model', providerId: 'devin' });

describe('⭐⭐ E2 — the model reviewer: the validator, in the DECLARED_POLICY framing, its answer the declared policy’s', () => {
	it('⭐ the reviewer is SHOWN the policy’s purpose and its criteria as the rubric, the work, and D8’s lines and the one-row sentence', async () => {
		const { prompts, validator } = capturing(
			JSON.stringify({
				findings: CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'met' })),
				recommendation: 'SATISFIED',
				residualUncertainty: []
			})
		);
		await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, INPUT);
		expect(prompts).toHaveLength(1);
		const prompt = prompts[0]!;
		// ⭐ The policy, on host lines — its name, id and purpose, and how the rubric's "failure class" is read.
		expect(prompt).toContain(declaredPolicyLine(POLICY));
		// ⭐ The rubric is the POLICY's own criteria, each with its stakes (`ASR-4`; design §9.3 D8).
		expect(prompt).toContain(
			'- RC-01: Requirement RC-01 is covered. [if unmet: BLOCKING]\n- RC-02: Requirement RC-02 is covered. [if unmet: MATERIAL]\n- RC-03: Requirement RC-03 is covered. [if unmet: ADVISORY]'
		);
		// ⭐ The work: ONE line of JSON — the work product and the commands — quoted whole (`REG-F-481`).
		expect(prompt.split('\n')).toContain(
			JSON.stringify({
				workProducts: [{ workUnit: 'Requirements', workProduct: '{"requirements":["R1"]}' }],
				commands: [{ workUnit: 'Requirements', command: ['node', '--test'], exitCode: 0, timedOut: false }]
			})
		);
		expect(prompt).toContain('as one line of JSON: "workProducts" holds each work product');
		// ⭑ D8's lines and the one-row sentence are every framing's, unedited.
		expect(prompt).toContain('Evaluate EACH derivational-integrity failure class below.');
		expect(prompt.split('\n')).toContain(ONE_ROW_PER_CRITERION);
		// ⛔ No floor rubric reaches a declared review.
		expect(prompt).not.toContain('RR-01-no-problem-substitution');
	});

	it('⭐ the answer is one row per criterion, its failed rows findings at the POLICY’s stakes, named for the DECLARED policy', async () => {
		const { validator } = capturing(
			JSON.stringify({
				findings: [
					{ criterionId: 'RC-01', failed: true, statement: 'R2 is missing.', severity: 'ADVISORY' },
					{ criterionId: 'RC-02', failed: false, statement: 'met' }
				],
				recommendation: 'SATISFIED',
				residualUncertainty: ['a concern']
			})
		);
		const a = await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, INPUT);
		expect([a.policyId, a.validatorId, a.failure]).toEqual([POLICY.policyId, DECLARED_REVIEW_VALIDATOR_ID, undefined]);
		expect(a.criteria.map((c) => [c.criterionId, c.outcome, c.mandatory])).toEqual([
			['RC-01', 'NOT_MET', true],
			['RC-02', 'MET', false],
			['RC-03', 'UNABLE_TO_DETERMINE', false]
		]);
		// ⭐ `R25` — the POLICY's stakes, never the reviewer's own ADVISORY.
		expect(a.observations.map((o) => [o.code, o.severity, o.open])).toEqual([['RC-01', 'BLOCKING', true]]);
		expect([a.recommendation, a.residualUncertainty, a.evaluator.agentId]).toEqual(['SATISFIED', ['a concern'], 'devin']);
	});

	it('⛔ a call that THREW is ANSWERED, not thrown: no row, and the validator’s own statement as the failure', async () => {
		const validator = createAgyReasoningReviewValidator({
			modelId: 'qualified-reviewer-model',
			print: () => Promise.reject(new Error('transport down'))
		});
		const a = await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, INPUT);
		expect(a.criteria).toEqual([]);
		expect(a.failure).toContain('transport down');
		expect([a.recommendation, a.evaluator.agentId]).toEqual(['INCONCLUSIVE', 'devin']);
	});

	it('⛔ a DECLARED_POLICY input that names no policy is REFUSED by the validator before any call', async () => {
		const { prompts, validator } = capturing('{}');
		const { declaredPolicy: _dropped, ...unnamed } = INPUT;
		const a = await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, unnamed);
		expect(prompts, 'no model was called').toEqual([]);
		expect(a.failure).toBeDefined();
		// ⭑ and the validator itself refuses it, in its own words, before a prompt exists.
		await expect(validator.evaluate(SUBJECT, { reasoningReview: { ...unnamed } })).rejects.toThrow(NO_DECLARED_POLICY_STATEMENT);
	});
});

describe('⭐⭐ E2 — the declared STAND-IN (test mode): it judges nothing, and stipulates only where a test registered', () => {
	it('⭐ registered CLEAN: EVERY criterion stipulated — recorded UNABLE_TO_DETERMINE with MET beside it, never as met', async () => {
		const a = await createStandinDeclaredPolicyReviewer({ stipulationFor: () => 'CLEAN' }).review(SUBJECT, INPUT);
		expect(a.criteria.map((c) => [c.criterionId, c.outcome, c.stipulated, c.rationale])).toEqual(
			CRITERIA.map((c) => [c.id, 'UNABLE_TO_DETERMINE', 'MET', DECLARED_STIPULATION_STATEMENT])
		);
		expect([a.validatorId, a.evaluator, a.recommendation, a.observations]).toEqual([
			STANDIN_DECLARED_REVIEW_VALIDATOR_ID,
			STANDIN_DECLARED_EVALUATOR,
			'SATISFIED',
			[]
		]);
		expect(a.limitations.join(' ')).toContain('no criterion of pol_requirement_coverage was judged');
	});

	it('⛔ nothing registered: nothing is answered, and it recommends INCONCLUSIVE — fail-closed', async () => {
		const a = await createStandinDeclaredPolicyReviewer({ stipulationFor: () => undefined }).review(SUBJECT, INPUT);
		expect(a.criteria.map((c) => [c.outcome, c.stipulated])).toEqual(CRITERIA.map(() => ['UNABLE_TO_DETERMINE', undefined]));
		expect(a.recommendation).toBe('INCONCLUSIVE');
	});
});

describe('⭐ E2 — the declared reviewer is SELECTED as the floor’s is (`selectReviewer`)', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('⭐ test mode, no tool named: the declared stand-in', () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', '');
		expect(createDeclaredPolicyReviewer({ testMode: true }).validatorId).toBe(STANDIN_DECLARED_REVIEW_VALIDATOR_ID);
	});

	it('⛔ outside test mode, no tool configured: a reviewer that runs nothing and answers every review with the refusal', async () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', '');
		const r = createDeclaredPolicyReviewer({ testMode: false });
		expect(r.validatorId).toBe(UNCONFIGURED_DECLARED_REVIEWER_ID);
		const a = await r.review(SUBJECT, INPUT);
		expect([a.criteria, a.recommendation]).toEqual([[], 'INCONCLUSIVE']);
		expect(a.failure).toContain('JPWB_ASSURANCE_TOOL');
	});

	it('⭐ a tool named, its program injected at `print`: the model reviewer, through the product’s validator', async () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'agy');
		vi.stubEnv('JPWB_JUDGE_MODEL', 'gemini-test');
		const sent: string[] = [];
		const r = createDeclaredPolicyReviewer({
			testMode: true,
			print: async (p) => {
				sent.push(p);
				return '{"findings":[],"recommendation":"SATISFIED"}';
			}
		});
		expect(r.validatorId).toBe(DECLARED_REVIEW_VALIDATOR_ID);
		await r.review(SUBJECT, INPUT);
		expect(sent[0]).toContain(declaredPolicyLine(POLICY));
	});
});

describe('⭐ E2 — the declared review’s input (`declaredPolicyReviewInput`)', () => {
	it('⭐ the framing, the policy, the instruction, and the work as ONE line of JSON — a unit with no work product an empty list', () => {
		expect([INPUT.framing, INPUT.declaredPolicy, INPUT.prompt, INPUT.criteria]).toEqual([
			'DECLARED_POLICY',
			POLICY,
			'Write the requirements of wordfreq.',
			CRITERIA
		]);
		const empty = declaredPolicyReviewInput({ policy: POLICY, criteria: CRITERIA, instruction: 'p', workProducts: [], commands: [] });
		expect(empty.content).toBe('{"workProducts":[],"commands":[]}');
		const timed = declaredPolicyReviewInput({
			policy: POLICY,
			criteria: CRITERIA,
			instruction: 'p',
			workProducts: [],
			commands: [
				{ unit: 'E2E', argv: ['npm', 'test'], exitCode: null, timedOut: true },
				{ unit: 'E2E', argv: ['npm', 'run', 'lint'], exitCode: null, timedOut: false }
			]
		});
		expect(JSON.parse(timed.content)).toEqual({
			workProducts: [],
			commands: [
				{ workUnit: 'E2E', command: ['npm', 'test'], exitCode: null, timedOut: true },
				{ workUnit: 'E2E', command: ['npm', 'run', 'lint'], exitCode: null, timedOut: false }
			]
		});
		// ⭐ ONE line: a work product carrying a line break stays on it (`jsonLine`).
		expect(timed.content.includes('\n')).toBe(false);
	});
});
