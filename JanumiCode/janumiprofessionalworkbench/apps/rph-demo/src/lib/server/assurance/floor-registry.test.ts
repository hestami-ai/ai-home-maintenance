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
import { classifyFloorRemediation, type FloorView } from '../floor.js';
import { clearingJudgement } from './clearing-reviewer.testing.js';
import { createExchangeSink } from './exchange-capture.js';
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
	'JPWB_JUDGE_MODEL',
	// ⭑ SR-2 (D7) — read by the adapters when they LOAD, so they reach a case only through `loadedWith` below.
	'JPWB_AGY_BIN',
	'JPWB_DEVIN_BIN'
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

describe('⭐ SR-2 (D6) — devin reviews with the model configured, or the review fails closed naming both', () => {
	it('a reported ≠ configured model: exactly one exchange record carrying the reported id, no repair, the review failed with both ids named', async () => {
		// ⛔ WHAT WAS WRONG (`REG-F-457` G6): devin's report was recorded and the review ACCEPTED — so a devin serving
		// another model than the one selected (`REG-D-084`) produced a review counted as the selected reviewer's.
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-devin-model');
		const devin = devinProgram('substituted-model');
		const exchanges = createExchangeSink();

		const review = await recordedReview(
			createFloorRegistry({ testMode: false, devinExec: devin.exec, exchanges })
		);

		const records = exchanges.drain();
		expect(
			records.map((r) => r.disposition),
			'one try, recorded as refused before the review failed'
		).toEqual(['rejected']);
		expect(records[0]!.resolvedModelIdentity).toEqual({
			kind: 'resolved',
			modelId: 'substituted-model',
			providerId: 'devin',
			evidence: 'PROVIDER_REPORTED'
		});
		expect(devin.calls, 'a repair would be a second paid call to the substitute').toHaveLength(1);
		const failed = review.observations.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED');
		expect(failed, 'the substituted review was not failed').toHaveLength(1);
		const statement = failed[0]!.statement;
		expect(statement).toContain("'substituted-model'");
		expect(statement).toContain("'fixture-devin-model'");
		expect(statement).toContain('the remedy is to re-qualify');
		// ⛔ NOT DRESSED AS A FAILED INVOCATION of the backing tool (`sanitiseToolFailure`): devin ran and answered, and
		// the refusal is of WHO answered — which is why the check sits outside the validator's invocation `try`.
		expect(statement, 'the refusal reads as a failed tool invocation').not.toContain(
			'invocation failed'
		);
		expect(statement).toMatch(/^The reviewing tool 'devin' reported /);
	});
});

// ── ⭐ `JAN-SELRES` RS-2 (D6, D7; `REG-F-460`) — A SUBSTITUTED MODEL HAS ITS OWN CODE, AND ITS OWN REMEDY ────────────────
//
// ⛔ WHAT WAS WRONG (`DESIGN-the-selection-residuals.md` §2 G7). The refusal above says its remedy is re-qualification
// or re-selection, never reconfiguration — and the floor could not tell it from any other failed review. The validator
// threw a plain `Error`, the runner recorded one `VALIDATOR_EXECUTION_FAILED`, and the classifier, which reads codes and
// never prose, answered *"Configure or retry the reviewer"*: another billed call to the same substitute.
//
// ⭑ THE REAL SHAPE, NEVER A HAND-BUILT ONE. Both cases run the product's devin branch through its exec seam and the
// package's floor runner and recording plan, so what the classifier reads is what a throw actually produces:
// `VALIDATOR_EXECUTION_FAILED` first, the new code beside it, and the `INDEPENDENCE_VIOLATION` recording adds because
// no evaluator ran (`REG-F-463`) — `independenceOk` false. A view with `independenceOk: true` (`floor.test.ts`'s
// `reviewPolicy`) is not a shape a throw can produce.
describe('⭐ RS-2 (D6, D7) — a substituted model is recorded under its own code and answered with its own remedy', () => {
	const INTENT = CTX.reasoningReview!.prompt;
	const CONTENT = CTX.reasoningReview!.content;
	/** D7's guidance, verbatim — the agent's wording, flagged for the sponsor's confirmation (`REG-D-087`). */
	const REQUALIFY_OR_RESELECT_GUIDANCE =
		'PublishPwa remains blocked because the reviewing tool reported that a model other than the configured and selected one answered, so the review was refused. Retrying or reconfiguring the same selection does not fix this: another call is billed and may be served the same way. The remedy is a sponsor decision: re-qualify the model the tool actually serves and select it, or re-select the reviewer (REG-D-084, REG-D-086); then configure the host to the new selection. Do not revise the PWA or record a waiver in response to this refusal.';

	/** A floor run whose devin reviewer reports `substituted-model` while `fixture-devin-model` is configured. */
	async function substitutedFloor() {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-devin-model');
		const devin = devinProgram('substituted-model');
		const plan = await runFloorAndPlanRecording(
			SUBJECT,
			CTX,
			createFloorRegistry({ testMode: false, devinExec: devin.exec })
		);
		const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
		if (!review) throw new Error('the floor recorded no reasoning-review assessment at all');
		// ⭑ THE VIEW `runPwaFloor` BUILDS FROM A PLAN, in every field the classifier reads (`floor.ts`, its `return`). It
		// omits the criteria tally, which `classifyFloorRemediation` never reads.
		const view: FloorView = {
			subjectId: SUBJECT.subjectId,
			aggregate: plan.aggregate,
			satisfied: plan.gatePermitsTransition,
			waived: false,
			policies: plan.assessments.map((a) => ({
				policyId: a.policyId,
				disposition: a.disposition,
				independenceOk: a.independenceOk,
				observations: a.observations.map((o) => ({
					code: o.code,
					severity: o.severity,
					statement: o.statement
				}))
			})),
			reasoningGaps: review.observations.map((o) => o.statement)
		};
		return { devin, review, view };
	}

	it('⭐ D6 — VALIDATOR_MODEL_SUBSTITUTED is recorded SECOND, beside VALIDATOR_EXECUTION_FAILED, naming the tool and both models and nothing of the prompt', async () => {
		const { devin, review } = await substitutedFloor();

		expect(devin.calls, 'a repair would be a second paid call to the substitute').toHaveLength(1);
		expect(
			review.observations.map((o) => o.code),
			'the substitution was not recorded under its own code, after the execution failure'
		).toEqual([
			'VALIDATOR_EXECUTION_FAILED',
			'VALIDATOR_MODEL_SUBSTITUTED',
			'INDEPENDENCE_VIOLATION'
		]);
		// ⭑ THE FIRST OBSERVATION IS UNCHANGED — the refusal, with its remedy — so the waiver target and the order on screen
		// lead as before.
		expect(review.observations[0]!.statement).toMatch(/^The reviewing tool 'devin' reported /);
		expect(review.observations[0]!.statement).toContain('the remedy is to re-qualify');
		const substituted = review.observations[1]!;
		expect(substituted.severity).toBe('MATERIAL');
		expect(substituted.statement).toContain("'devin'");
		expect(substituted.statement).toContain("'substituted-model'");
		expect(substituted.statement).toContain("'fixture-devin-model'");
		// ⛔ WRITTEN BY THE VALIDATOR, NEVER BY A TOOL'S DIAGNOSTIC — so nothing of the prompt (`PER-12`). ⚠ These two ask
		// only whether the VALIDATOR writes the prompt: the reported id here is benign, and a tool-written id is carried
		// unbounded (`readReportedModel`), so they cannot catch a tool that writes it.
		expect(substituted.statement).not.toContain(INTENT);
		expect(substituted.statement).not.toContain(CONTENT);
		// ⭑ THE WHOLE SENTENCE — ids only, and NO REMEDY: the refusal at `observations[0]` carries the remedy, and the
		// floor's guidance answers the code (D7). A statement that repeated the refusal would pass every check above.
		expect(substituted.statement).toBe(
			"The reviewing tool 'devin' reported that the model 'substituted-model' answered; the model configured and selected for this review is 'fixture-devin-model'."
		);
		expect(
			review.independenceOk,
			'arrangement: a throw records no evaluator, so independence fails'
		).toBe(false);
	});

	it('⭐ D7 — the same floor is classified REQUALIFY_OR_RESELECT_REVIEWER: no auto-refinement, no findings, D7’s guidance — never "retry the reviewer"', async () => {
		const { view } = await substitutedFloor();

		const remediation = classifyFloorRemediation(view);

		expect(remediation.action, 'a substitution was answered as a failed or dependent review').toBe(
			'REQUALIFY_OR_RESELECT_REVIEWER'
		);
		expect(remediation.autoRefine, 'a refused review was sent back to the producer').toBe(false);
		expect(remediation.findings).toEqual([]);
		expect(remediation.guidance).toBe(REQUALIFY_OR_RESELECT_GUIDANCE);
		expect(remediation.guidance, 'the guidance offers the remedy the refusal forbids').not.toMatch(
			/retry the reviewer/i
		);
	});
});

/**
 * `createFloorRegistry` as a server that STARTED with these program overrides. The adapters capture them when they LOAD
 * (`agy-cli.ts`, `devin-reviewer.ts`), so each is set before a fresh import and removed straight after: what the
 * registry then acts on is what the adapters captured, never the environment at the review.
 */
async function loadedWith(overrides: {
	readonly JPWB_AGY_BIN?: string;
	readonly JPWB_DEVIN_BIN?: string;
}): Promise<typeof createFloorRegistry> {
	vi.resetModules();
	for (const [k, v] of Object.entries(overrides)) vi.stubEnv(k, v);
	const fresh = await import('./index.js');
	for (const k of Object.keys(overrides)) vi.stubEnv(k, undefined);
	vi.resetModules();
	return fresh.createFloorRegistry;
}

describe('⛔ SR-2 (D7) — a program override: refused outside test mode for the SELECTED tool only, honoured inside it', () => {
	// ⛔ EACH CASE FAILS AT THE SEAM, NEVER AT A PROGRAM. devin is reached only through `devinExec`, agy only through an
	// injected `print`, and PATH names an empty directory — so a mutant that admits an override, or ignores one, is
	// seen as a call the seam should not have had, or a program it should have been handed.
	const STAND_IN = 'C:/no-such-directory/reviewer-stand-in.exe';

	for (const program of [STAND_IN, ''])
		it(`devin, JPWB_DEVIN_BIN=${JSON.stringify(program)}: refused and recorded, nothing started — an empty override is still set`, async () => {
			vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
			vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-devin-model');
			const build = await loadedWith({ JPWB_DEVIN_BIN: program });
			const devin = devinProgram('fixture-devin-model');

			const review = await recordedReview(build({ testMode: false, devinExec: devin.exec }));

			expect(devin.calls, 'a replaced program was started for a review').toHaveLength(0);
			expect(review.validatorId).toBe('reasoning-review.unconfigured');
			const failed = review.observations.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED');
			expect(failed).toHaveLength(1);
			expect(failed[0]!.statement).toContain(`JPWB_DEVIN_BIN=${JSON.stringify(program)}`);
			expect(failed[0]!.statement).toContain('REG-D-084');
		});

	it('agy, JPWB_AGY_BIN set: refused and recorded, the injected print never called', async () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'agy');
		vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge-model');
		const build = await loadedWith({ JPWB_AGY_BIN: STAND_IN });
		let called = false;

		const review = await recordedReview(
			build({
				testMode: false,
				print: async () => {
					called = true;
					return clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
				}
			})
		);

		expect(called, 'a review ran with agy’s program replaced').toBe(false);
		expect(review.validatorId).toBe('reasoning-review.unconfigured');
		expect(
			review.observations.find((o) => o.code === 'VALIDATOR_EXECUTION_FAILED')?.statement
		).toContain(`JPWB_AGY_BIN=${JSON.stringify(STAND_IN)}`);
	});

	it('⭑ the OTHER tool’s override refuses nothing — a set JPWB_AGY_BIN does not stop a devin review', async () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-devin-model');
		const build = await loadedWith({ JPWB_AGY_BIN: STAND_IN });
		const devin = devinProgram('fixture-devin-model');

		const review = await recordedReview(build({ testMode: false, devinExec: devin.exec }));

		expect(review.validatorId).toBe('agy.reasoning-review');
		expect(
			devin.calls.map((c) => c.file),
			'devin’s own program, run once'
		).toEqual(['devin']);
	});

	it('⭑ in test mode the override is HONOURED — the program it names is the one handed to the seam', async () => {
		// THE NEVER-HONOUR MUTANT: the adapter ignores what it captured, so the seam is handed `devin` — which on this
		// machine is the paid reviewer. Here it is a string the seam records, and PATH could not find it anyway.
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-devin-model');
		const build = await loadedWith({ JPWB_DEVIN_BIN: STAND_IN });
		const devin = devinProgram('fixture-devin-model');

		const review = await recordedReview(build({ testMode: true, devinExec: devin.exec }));

		expect(devin.calls.map((c) => c.file)).toEqual([STAND_IN]);
		expect(review.observations.map((o) => o.code)).not.toContain('VALIDATOR_EXECUTION_FAILED');
	});
});
