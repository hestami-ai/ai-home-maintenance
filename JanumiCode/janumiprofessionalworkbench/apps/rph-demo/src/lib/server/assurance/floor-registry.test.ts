// ⭐ `JAN-SELREV` SR-1 (D3, D4) — THE FLOOR REGISTRY BUILDS FROM THE ONE SELECTOR, AND A REFUSED REVIEWER IS RECORDED.
//
// ⛔ WHAT WAS WRONG, READ FROM CODE (`REG-F-457`). `createFloorRegistry` chose its reviewer on its own: an unset tool
// meant agy, every value but exactly `devin` ran agy (`pi`, a typo), and devin's model was resolved while the registry
// was BUILT — so an unset `JPWB_ASSURANCE_MODEL` threw out of `createFloorRegistry`, after a paid authoring agent had
// run, or out of `beginExecute`'s try/finally, leaving the step RUNNING.
//
// ⭑ AND NO TEST HAD EVER REACHED THE DEVIN BRANCH: every real-path test injects `print`, which wins, and `devinPrint`
// had no exec seam. It has one now (`DevinExec`), so the branch is driven here with nothing injected but the program.
//
// ⛔ HERMETIC BY CONSTRUCTION. Every case runs with PATH pointed at an empty directory, and no case sets
// `JPWB_JUDGE_MODEL` unless its arrangement names agy — so no mutant of the selection can reach a real agy or devin.
import {
	FLOOR_POLICY_IDS,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearingJudgement } from './clearing-reviewer.testing.js';
import { createFloorRegistry } from './index.js';
import { noProgramsDirectory } from './no-programs.testing.js';
import { STANDIN_VALIDATOR_ID } from './standin-reasoning-review-validator.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'pwa_selection',
	objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	semanticVersion: 1,
	isAiProduced: true,
	producer: {
		actorType: 'AGENT',
		agentId: 'authoring-agent',
		modelId: 'executor-model',
		providerId: 'executor-provider'
	}
};

const CTX: ValidatorContext = {
	schemaInvariant: { schemaValid: true, invariantViolations: [] },
	reasoningReview: {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'PWA_GRAPH',
		prompt: 'Author a product realization PWA',
		content: '{"pwuTypes":[{"id":"t1"}]}',
		narration: ''
	}
};

/** Every variable the selection reads, cleared, so a case states its whole arrangement. */
const SELECTION_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL'
] as const;

/** One exec of the devin program, as its seam received it. */
interface DevinCall {
	readonly file: string;
	readonly args: readonly string[];
}

/**
 * A stand-in for the devin PROGRAM, behind `devinPrint`'s exec seam: it answers every criterion clean and, when told
 * to, writes the ATIF export devin writes, naming the model it reports having run.
 */
function devinProgram(reported: string | undefined) {
	const calls: DevinCall[] = [];
	const exec = async (file: string, args: readonly string[]) => {
		calls.push({ file, args: [...args] });
		const exportPath = args[args.indexOf('--export') + 1];
		if (reported !== undefined && exportPath !== undefined)
			await writeFile(
				exportPath,
				JSON.stringify({ steps: [{ extra: { generation_model: reported } }] }),
				'utf8'
			);
		return { stdout: clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA) };
	};
	return { calls, exec };
}

/** The reasoning-review assessment a floor run would RECORD. */
async function recordedReview(registry: ReturnType<typeof createFloorRegistry>) {
	const plan = await runFloorAndPlanRecording(SUBJECT, CTX, registry);
	const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
	if (!review) throw new Error('the floor recorded no reasoning-review assessment at all');
	return review;
}

beforeEach(() => {
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of SELECTION_VARIABLES) vi.stubEnv(v, undefined);
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('the devin branch is reached through its exec seam, with nothing injected but the program', () => {
	it('⭐ records the devin identity — the model devin REPORTS, graded by the tool', async () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-devin-model');
		const devin = devinProgram('fixture-devin-model');

		const review = await recordedReview(
			createFloorRegistry({ testMode: false, devinExec: devin.exec })
		);

		expect(devin.calls, 'the devin program was never started through the seam').toHaveLength(1);
		const call = devin.calls[0]!;
		// ⭑ The product's own program, and the configured model handed to it.
		expect(call.file).toBe('devin');
		expect(call.args.slice(0, 3)).toEqual(['--print', '--model', 'fixture-devin-model']);
		expect(review.observations.map((o) => o.code)).not.toContain('VALIDATOR_EXECUTION_FAILED');
		// ⚠ The validator id stays `agy.reasoning-review` (design, "Kept, and disclosed"): renaming it would change the
		// meaning of records already written. The EVALUATOR says who reviewed.
		expect(review.validatorId).toBe('agy.reasoning-review');
		expect(review.evaluator).toEqual({
			actorType: 'AGENT',
			agentId: 'devin',
			modelId: 'fixture-devin-model',
			providerId: 'devin'
		});
	});

	it('⭑ resolves devin’s model when the review RUNS, never when the registry is built (D4)', async () => {
		// ⛔ THE MUTANT: resolve the model at build. Then this records the model configured at build, while the program
		// is handed the model configured at the review — one model recorded, another run.
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'model-at-build');
		// No export is written, so the configured model is what the record carries, graded HOST_CONFIGURED.
		const devin = devinProgram(undefined);
		const registry = createFloorRegistry({ testMode: false, devinExec: devin.exec });
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'model-at-review');

		const review = await recordedReview(registry);

		expect(devin.calls.map((c) => c.args[2])).toEqual(['model-at-review']);
		// ⭑ With no export read back, the whole identity is the host's configuration — and it still names devin.
		expect(review.evaluator).toEqual({
			actorType: 'AGENT',
			agentId: 'devin',
			modelId: 'model-at-review',
			providerId: 'devin'
		});
	});
});

describe('⛔ outside test mode a misconfigured reviewer is RECORDED, never thrown, and never run as agy', () => {
	// Each arrangement leaves `JPWB_JUDGE_MODEL` unset, so agy could not run even if a mutant selected it — and every
	// statement must name what was wrong AND carry `REG-D-084`'s selection and the independence guidance.
	const CASES: readonly {
		readonly name: string;
		readonly env: Readonly<Record<string, string>>;
		readonly names: string;
	}[] = [
		{ name: 'an unset tool', env: {}, names: 'JPWB_ASSURANCE_TOOL is not set' },
		{ name: 'an unknown tool', env: { JPWB_ASSURANCE_TOOL: 'nope' }, names: "'nope'" },
		{ name: 'a wrongly-cased tool', env: { JPWB_ASSURANCE_TOOL: 'Devin' }, names: "'Devin'" },
		{
			name: 'pi, which no reviewer adapter serves',
			env: { JPWB_ASSURANCE_TOOL: 'pi' },
			names: "'pi'"
		},
		{
			name: 'devin with no model',
			env: { JPWB_ASSURANCE_TOOL: 'devin' },
			names: "'devin' has no model: JPWB_ASSURANCE_MODEL is not set"
		}
	];

	for (const c of CASES)
		it(`${c.name} records VALIDATOR_EXECUTION_FAILED naming it, with the selection’s guidance`, async () => {
			for (const [k, v] of Object.entries(c.env)) vi.stubEnv(k, v);
			const devin = devinProgram('fixture-devin-model');

			let registry: ReturnType<typeof createFloorRegistry> | undefined;
			expect(() => {
				registry = createFloorRegistry({ testMode: false, devinExec: devin.exec });
			}, 'a configuration fault threw out of the registry build').not.toThrow();
			const review = await recordedReview(registry!);

			const failed = review.observations.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED');
			expect(failed).toHaveLength(1);
			const statement = failed[0]!.statement;
			expect(statement).toContain(c.names);
			expect(statement).toContain('REG-D-084');
			expect(statement).toContain(
				'JPWB_ASSURANCE_TOOL=devin and JPWB_ASSURANCE_MODEL=glm-5-3-flash-max'
			);
			expect(statement).toContain('ASR-13');
			expect(
				review.validatorId,
				'a refusal is recorded under its own id, never as agy’s work'
			).toBe('reasoning-review.unconfigured');
			expect(devin.calls, 'nothing may be started for a refused reviewer').toHaveLength(0);
		});

	it('⭑ CONTROL — agy, configured, is still selected outside test mode (REG-D-052: agy stays configurable)', async () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'agy');
		vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge-model');
		const prompts: string[] = [];
		const review = await recordedReview(
			createFloorRegistry({
				testMode: false,
				print: async (p) => {
					prompts.push(p);
					return clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
				}
			})
		);
		expect(prompts).toHaveLength(1);
		expect(review.validatorId).toBe('agy.reasoning-review');
		expect(review.evaluator?.modelId).toBe('fixture-judge-model');
	});

	it('⛔ an injected print does not outrank a refusal — the configuration fault is still what is recorded', async () => {
		let called = false;
		const review = await recordedReview(
			createFloorRegistry({
				testMode: false,
				print: async () => {
					called = true;
					return clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
				}
			})
		);
		expect(called).toBe(false);
		expect(review.validatorId).toBe('reasoning-review.unconfigured');
	});
});

describe('in test mode the stand-in stays the default, and a named tool is held to the same rules', () => {
	it('⭑ nothing configured selects the declared stand-in', async () => {
		expect(
			createFloorRegistry({ testMode: true }).get(FLOOR_POLICY_IDS.REASONING_REVIEW)?.validatorId
		).toBe(STANDIN_VALIDATOR_ID);
	});

	it('⭑ a blank or whitespace tool is UNSET — the stand-in, never a real reviewer named by nothing', async () => {
		for (const blank of ['', '   ']) {
			vi.stubEnv('JPWB_ASSURANCE_TOOL', blank);
			expect(
				createFloorRegistry({ testMode: true }).get(FLOOR_POLICY_IDS.REASONING_REVIEW)?.validatorId
			).toBe(STANDIN_VALIDATOR_ID);
		}
	});

	it('⛔ a named tool with no model is refused in test mode too', async () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		expect(
			createFloorRegistry({ testMode: true }).get(FLOOR_POLICY_IDS.REASONING_REVIEW)?.validatorId
		).toBe('reasoning-review.unconfigured');
	});
});
