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
	DECLARED_NO_SINGLE_ACCOUNT,
	DECLARED_NO_SINGLE_ACCOUNT_LIMITATION,
	DECLARED_PRODUCING_PROMPT_INTENT,
	DECLARED_UNIT_PURPOSE_INTENT,
	declaredPolicyLine,
	DECLARED_WORK_CUT_OVER_BUDGET,
	NO_DECLARED_INSTRUCTION_STATEMENT,
	NO_DECLARED_POLICY_STATEMENT,
	ONE_ROW_PER_CRITERION,
	REASONING_REVIEW_BUDGET
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
	instructionIs: 'PRODUCING_PROMPT',
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

	// ── ⛔ `E12F` F4 (`R14`) — the reviewer is told only what is true of the instruction ─────────────────────────────────────
	it('⭐ E12F F4 — a unit’s own work: the reviewer is told its producer was given exactly this instruction, and nothing of children', async () => {
		const { prompts, validator } = capturing('{}');
		await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, INPUT);
		expect(prompts[0]).toContain(`${DECLARED_PRODUCING_PROMPT_INTENT}\n`);
		expect(prompts[0]).not.toContain('children');
	});

	it('⛔ E12F F4 — a unit composed of others: its PURPOSE is the standard, no agent is said to have been given it, and no producer’s omission is invented', async () => {
		// ⛔ PREDICTED RED, read from the code: the one intent line — "… (for a unit composed of others, by the agents that did its
		// children’s work), which was given exactly this instruction:" — and the absent account rendered as the producer's
		// omission, "treat the omission itself as a completeness shortcut", with a limitation saying the producer returned none.
		const root = declaredPolicyReviewInput({
			policy: POLICY,
			criteria: CRITERIA,
			instruction: 'Realize wordfreq from its requirements through end-to-end verification.',
			instructionIs: 'UNIT_PURPOSE',
			workProducts: [
				{ unit: 'Requirements', answer: '{"requirements":["R1"]}' },
				{ unit: 'Design', answer: '{"modules":["cli"]}' }
			],
			commands: []
		});
		const { prompts, validator } = capturing(
			JSON.stringify({
				findings: CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'met' })),
				recommendation: 'SATISFIED',
				residualUncertainty: []
			})
		);
		const a = await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, root);
		const prompt = prompts[0]!;
		expect(prompt, 'an agent is said to have been given the root’s instruction').not.toContain('which was given exactly this instruction');
		expect(prompt).toContain(`${DECLARED_UNIT_PURPOSE_INTENT}\n`);
		expect(prompt, 'the absence of one producer’s account is called an omission').not.toContain('treat the omission itself');
		expect(prompt).toContain(DECLARED_NO_SINGLE_ACCOUNT);
		expect(a.limitations).toContain(DECLARED_NO_SINGLE_ACCOUNT_LIMITATION);
		expect(a.limitations.join(' ')).not.toContain('The producer returned no professional rationale summary');
	});

	it('⛔ E12F F4 — a DECLARED_POLICY input that does not say what its instruction is is REFUSED before any call', async () => {
		const { prompts, validator } = capturing('{}');
		const { declaredInstruction: _dropped, ...unsaid } = INPUT;
		const a = await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, unsaid);
		expect(prompts, 'no model was called').toEqual([]);
		expect(a.failure).toBe(NO_DECLARED_INSTRUCTION_STATEMENT);
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
		const empty = declaredPolicyReviewInput({
			policy: POLICY,
			criteria: CRITERIA,
			instruction: 'p',
			instructionIs: 'UNIT_PURPOSE',
			workProducts: [],
			commands: []
		});
		expect(empty.content).toBe('{"workProducts":[],"commands":[]}');
		const timed = declaredPolicyReviewInput({
			policy: POLICY,
			criteria: CRITERIA,
			instruction: 'p',
			instructionIs: 'PRODUCING_PROMPT',
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

// ── ⭐⭐ `JAN-EXEC` Phase 7 P5, package B — WHAT A DECLARED REVIEW OF A UNIT COMPOSED OF OTHERS IS SHOWN ───────────────────────
//
// P5's root was judged over three of its four phases: its abandoned end-to-end phase was simply absent from the work, and
// the head-only cut that bounded the prompt kept the first 21684 of 50586 code points — Requirements whole, Design to its
// §5, and nothing of Implementation or of any command. Its two reviews answered SATISFIED over what was left.

/** A root's declared review over `units`, each its own work product of `size` code points and its own one command. */
const rootOver = (units: readonly string[], size: number, extra: Partial<Parameters<typeof declaredPolicyReviewInput>[0]> = {}) =>
	declaredPolicyReviewInput({
		policy: POLICY,
		criteria: CRITERIA,
		instruction: 'Realize wordfreq from its requirements through end-to-end verification.',
		instructionIs: 'UNIT_PURPOSE',
		workProducts: units.map((unit) => ({ unit, answer: `${unit}: ${'w'.repeat(size)}` })),
		commands: units.map((unit) => ({ unit, argv: ['node', '--test', `test/${unit.toLowerCase()}.test.js`], exitCode: 0, timedOut: false })),
		...extra
	});
/** The line of the prompt that shows the work: the one opening as the work's JSON does. */
const workLineOf = (prompt: string): string => {
	const lines = prompt.split('\n').filter((l) => l.startsWith('{"workProducts":'));
	expect(lines, 'arrangement: the prompt shows its work on one line').toHaveLength(1);
	return lines[0]!;
};
/** The units whose work product entry the shown line holds, in order — read without parsing, so a cut line reads too. */
const productUnitsShown = (line: string): string[] =>
	[...line.matchAll(/\{"workUnit":"([^"]+)","workProduct":/g)].map((m) => m[1]!);
/** The units whose command entry the shown line holds, in order. */
const commandUnitsShown = (line: string): string[] =>
	[...line.matchAll(/\{"workUnit":"([^"]+)","command":/g)].map((m) => m[1]!);
const SATISFYING = JSON.stringify({
	findings: CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'met' })),
	recommendation: 'SATISFIED',
	residualUncertainty: []
});
const PHASES = ['Requirements', 'Design', 'Implementation and unit tests'] as const;

describe('⭐⭐ P5 package B (F2) — the work of many units, longer than its budget, is cut UNIT BY UNIT', () => {
	it('⛔ three units whose work is twice the budget: each keeps a share of its work product and its command, each cut declared — no unit cut out whole', async () => {
		// ⛔ RED BEFORE F2, driven: the head-only cut of the one line of JSON kept the first two units' work products and
		// nothing of the third's, nor any command (P5's root review, in miniature).
		const input = rootOver(PHASES, 16_000);
		const { prompts, validator } = capturing(SATISFYING);
		await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, input);
		const prompt = prompts[0]!;
		const line = workLineOf(prompt);
		expect(productUnitsShown(line), 'a unit’s work product was cut out whole').toEqual([...PHASES]);
		expect(commandUnitsShown(line), 'a unit’s command was cut out whole').toEqual([...PHASES]);
		// ⭐ Still ONE line of JSON in the same shape, each work product its own head, and every unit given its share.
		const shown = JSON.parse(line) as { workProducts: { workUnit: string; workProduct: string }[] };
		for (const [i, w] of shown.workProducts.entries()) {
			const answer = `${PHASES[i]}: ${'w'.repeat(16_000)}`;
			expect(answer.startsWith(w.workProduct), `${w.workUnit}'s work product is not its head`).toBe(true);
			expect(w.workProduct.length, `${w.workUnit} kept too little of its work product`).toBeGreaterThan(5_000);
			// ⭐ DECLARED, on a host line before the work, with what was shown and what was removed.
			expect(prompt).toContain(
				`[CUT FOR THIS REVIEW: the work product of ${JSON.stringify(w.workUnit)} — the first ${w.workProduct.length} of its ` +
					`${answer.length} code points are shown; the last ${answer.length - w.workProduct.length} are removed.]`
			);
		}
		expect(prompt, 'the head-only cut still declared itself').not.toContain('[CUT FOR THIS REVIEW: the work — ');
		expect(prompt.length, 'the prompt passed its budget').toBeLessThanOrEqual(REASONING_REVIEW_BUDGET.PROMPT_BUDGET);
	});

	it('⛔ a unit whose commands alone pass its share keeps its first commands, the rest declared removed', async () => {
		const longCommand = (unit: string, i: number) => ({
			unit,
			argv: ['node', '-e', `${'x'.repeat(900)}${i}`],
			exitCode: 0,
			timedOut: false
		});
		const input = declaredPolicyReviewInput({
			policy: POLICY,
			criteria: CRITERIA,
			instruction: 'Realize wordfreq.',
			instructionIs: 'UNIT_PURPOSE',
			workProducts: [{ unit: 'Requirements', answer: 'r'.repeat(20_000) }],
			commands: Array.from({ length: 40 }, (_, i) => longCommand('End-to-end verification', i))
		});
		const { prompts, validator } = capturing(SATISFYING);
		await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, input);
		const prompt = prompts[0]!;
		const shown = JSON.parse(workLineOf(prompt)) as { commands: { command: string[] }[] };
		const kept = shown.commands.length;
		expect(kept, 'arrangement: some commands were kept and some removed').toBeGreaterThan(0);
		expect(kept).toBeLessThan(40);
		expect(shown.commands.map((c) => c.command[2]), 'the commands kept are not the first ones').toEqual(
			Array.from({ length: kept }, (_, i) => `${'x'.repeat(900)}${i}`)
		);
		expect(prompt).toContain(
			`[CUT FOR THIS REVIEW: the commands of "End-to-end verification" — the first ${kept} of its 40 are shown; the last ${40 - kept} are removed.]`
		);
	});

	it('⭑ CONTROL — one unit’s work over its budget is still cut head-only, and work that fits is built as before', async () => {
		const one = declaredPolicyReviewInput({
			policy: POLICY,
			criteria: CRITERIA,
			instruction: 'Write the requirements of wordfreq.',
			instructionIs: 'PRODUCING_PROMPT',
			workProducts: [{ unit: 'Requirements', answer: 'r'.repeat(40_000) }],
			commands: [{ unit: 'Requirements', argv: ['node', '--test'], exitCode: 0, timedOut: false }]
		});
		expect(one.declaredWorkCut).toBeUndefined();
		const { prompts, validator } = capturing(SATISFYING);
		await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, one);
		expect(prompts[0]).toContain('[CUT FOR THIS REVIEW: the work — the first ');
		const fits = rootOver(PHASES, 100);
		expect([fits.declaredWorkCut, fits.content]).toEqual([
			undefined,
			JSON.stringify({
				workProducts: PHASES.map((unit) => ({ workUnit: unit, workProduct: `${unit}: ${'w'.repeat(100)}` })),
				commands: PHASES.map((unit) => ({
					workUnit: unit,
					command: ['node', '--test', `test/${unit.toLowerCase()}.test.js`],
					exitCode: 0,
					timedOut: false
				}))
			})
		]);
	});

	it('⛔ work its builder cut that does not fit the budget the prompt leaves it is REFUSED, no model called', async () => {
		const input = rootOver(PHASES, 16_000);
		expect(input.declaredWorkCut, 'arrangement: the builder cut the work').toBeDefined();
		const { prompts, validator } = capturing(SATISFYING);
		const a = await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, {
			...input,
			content: `${input.content}${' '.repeat(REASONING_REVIEW_BUDGET.CONTENT_MAX)}`
		});
		expect(prompts, 'a model was called').toEqual([]);
		expect(a.failure).toBe(DECLARED_WORK_CUT_OVER_BUDGET);
	});

	it('⛔ a title the builder’s cut declares, on its host line before the work, is the PWA’s too: one holding the first candidate moves the fence', async () => {
		// ⛔ The unit has a command and no work product, and its one command is longer than its share, so all of it is cut:
		// its title then stands only in the declaration of that cut, outside the fence (P5 package B's check, finding 3).
		const unit = 'E2E <<<UNTRUSTED-00>>>';
		const input = declaredPolicyReviewInput({
			policy: POLICY,
			criteria: CRITERIA,
			instruction: 'Realize wordfreq.',
			instructionIs: 'UNIT_PURPOSE',
			workProducts: [{ unit: 'Requirements', answer: 'r'.repeat(40_000) }],
			commands: [{ unit, argv: ['node', '-e', 'x'.repeat(30_000)], exitCode: 0, timedOut: false }]
		});
		expect(input.declaredWorkCut, 'arrangement: all of the unit’s commands were cut').toContain(
			`[CUT FOR THIS REVIEW: the commands of ${JSON.stringify(unit)} — the first 0 of its 1 are shown; the last 1 are removed.]`
		);
		expect(input.content, 'arrangement: the title is in no other slice').not.toContain('UNTRUSTED');
		const { prompts, validator } = capturing(SATISFYING);
		await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, input);
		const lines = prompts[0]!.split('\n');
		const fence = lines.find((l) => /^<<<UNTRUSTED-\d\d>>>$/.test(l));
		expect(
			lines.filter((l) => l !== fence && fence !== undefined && l.includes(fence)),
			'the fence chosen occurs on the host’s line that declares the cut'
		).toEqual([]);
		expect(fence).toBe('<<<UNTRUSTED-01>>>');
	});
});

describe('⭐⭐ P5 package B (F1) — a unit below that holds no completion is NAMED to the reviewer', () => {
	const ABANDONED = { unit: 'End-to-end verification', lifecycleState: 'ABANDONED', assuranceState: 'UNASSESSED' };

	it('⛔ the root’s review names the abandoned phase on a host line of its own, after the work: its states, and that it contributed no work', async () => {
		// ⛔ RED BEFORE F1, driven: the prompt said nothing of the unit — P5's two root prompts held "abandon" 0 times.
		const input = rootOver(PHASES, 100, { unitsWithoutWork: [ABANDONED] });
		const { prompts, validator } = capturing(SATISFYING);
		await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, input);
		const prompt = prompts[0]!;
		const named =
			'The work unit "End-to-end verification" below this one holds no completed step — its lifecycle ABANDONED, its ' +
			'assurance UNASSESSED — so it contributed no work: nothing of it is in the WORK above.';
		const lines = prompt.split('\n');
		expect(lines, 'the reviewer is not told of the unit that contributed no work').toContain(named);
		// ⭑ The host's line, after the work and outside its fence: the fence's closing line, an empty line, then it.
		const at = lines.indexOf(named);
		expect([lines[at - 3], lines[at - 2], lines[at - 1]], 'the line does not follow the fenced work').toEqual([
			workLineOf(prompt),
			'<<<UNTRUSTED-00>>>',
			''
		]);
	});

	it('⛔ a title on that line is the PWA’s, so the fence is chosen around it too: one holding the first candidate moves the fence', async () => {
		const input = rootOver(PHASES, 100, { unitsWithoutWork: [{ ...ABANDONED, unit: '<<<UNTRUSTED-00>>>' }] });
		const { prompts, validator } = capturing(SATISFYING);
		await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, input);
		expect(prompts[0]!.split('\n'), 'the fence chosen occurs on the host’s line').toContain('<<<UNTRUSTED-01>>>');
		expect(prompts[0]!.split('\n')).not.toContain('<<<UNTRUSTED-00>>>');
	});

	it('⭑ CONTROL — with every unit completed, no such line, and the input carries no such field', async () => {
		const input = rootOver(PHASES, 100);
		expect('declaredUnitsWithoutWork' in input).toBe(false);
		const { prompts, validator } = capturing(SATISFYING);
		await createModelDeclaredPolicyReviewer(validator, CONFIGURED).review(SUBJECT, input);
		expect(prompts[0]).not.toContain('holds no completed step');
	});
});
