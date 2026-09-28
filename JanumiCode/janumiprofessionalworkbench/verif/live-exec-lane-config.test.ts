// ⭐ `JAN-SELREV` SR-3 (D9) — THE LIVE EXECUTION LANE ASKS FOR WHAT ITS REVIEWER READS, AND WAITS AS LONG AS IT MAY TAKE.
//
// The lane (`apps/rph-demo/playwright.live-exec.config.ts`, `e2e-live-exec/execution.live.ts`) is paid and never runs
// in the gate, so nothing ever ran what it decides before it starts. Two of those decisions were wrong at `3e88b0d1`:
//   · it demanded `JPWB_ASSURANCE_MODEL` of EVERY reviewing tool, and its spec compared the reviewer with it — but agy
//     reads its model from `JPWB_JUDGE_MODEL` (`reviewer-selection.ts`), so an agy lane was refused a key it does not
//     read, and its reviewer compared against a model nobody configured for it
//     (`docs/_working/DESIGN-the-selected-reviewer.md` §2 G9; `REG-F-461`);
//   · it waited 480 s for the one request that runs every try's executor call AND every try's review, when the
//     reviewer alone may take 3 tries × 2 calls × 240 s.
// Both now live in one PURE module, `e2e-live-exec/lane-config.ts`, which the config and the spec import and which
// this file holds — to the PRODUCT's own answers wherever the product can be asked: the reviewer selector for which
// variable each tool reads and which program override it refuses, the repair bound for the tries, the two reviewer
// adapters, driven through their exec seams, for the per-call bound and the grade their record carries, and the
// reasoning-review validator, driven through its `print` seam, for the calls one review may make. ⚠ Two figures are
// ALLOWANCES, not the product's: each try's executor call and the setup before the POST (`lane-config.ts` says why).
//
// ⛔ NO REVIEWER IS REACHABLE FROM HERE. The adapters and the validator are driven through their seams only, with PATH
// pointed at an EMPTY directory, so a seam a mutant bypassed would find no program to start.
//
// ⭑ AND THE WIRING IS HELD FROM SOURCE, as `lane-control-teardown.test.ts` holds its config entry: neither the config
// nor the spec may name a reviewer model variable itself, each takes its timeout from the helper, the config throws
// the helper's refusal, and the spec reads its tool from the environment and makes the hard assertions this increment
// wrote — read from the AST, never a substring grep. ⚠ The spec is paid and never runs in the gate, so these AST
// checks are the only gate test that sees a change to what it asserts: the gate otherwise only typechecks and lints
// it, and `reviewer-qualification-sequencing.test.ts` scans it for a registered stipulation.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	EXECUTE_TIMEOUT_MS,
	EXECUTOR_PROGRAM_VARIABLE,
	LANE_BUDGET,
	REVIEWER_IDENTITY_EVIDENCE,
	REVIEWER_MODEL_VARIABLE,
	REVIEWER_PROGRAM_VARIABLE,
	TEST_TIMEOUT_MS,
	WIRED_EXECUTORS,
	laneKeysRefusal,
	requiredLaneKeys,
	reviewerModelVariable,
	wiredExecutor,
	wiredReviewer
} from '../apps/rph-demo/e2e-live-exec/lane-config.js';
import { agyPrint } from '../apps/rph-demo/src/lib/server/assurance/agy-cli.js';
import { selectExecutor } from '../apps/rph-demo/src/lib/server/execution/executor-selection.js';
import { noProgramsDirectory } from '../apps/rph-demo/src/lib/server/assurance/no-programs.testing.js';
import { createAgyReasoningReviewValidator } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { selectReviewer } from '../apps/rph-demo/src/lib/server/assurance/reviewer-selection.js';
import { DEFAULT_REPAIR_BOUND } from '../apps/rph-demo/src/lib/server/execution/loop-detection.js';
import { devinPrint } from '../apps/rph-demo/src/lib/server/tools/devin-reviewer.js';
import { isToolInvocationResult } from '../apps/rph-demo/src/lib/server/tools/backing-tool.js';

const APP = fileURLToPath(new URL('../apps/rph-demo/', import.meta.url));
const CONFIG = 'playwright.live-exec.config.ts';
const SPEC = 'e2e-live-exec/execution.live.ts';
const MODEL_VARIABLES = ['JPWB_JUDGE_MODEL', 'JPWB_ASSURANCE_MODEL'] as const;
const NO_OVERRIDES = { agy: undefined, devin: undefined } as const;

/** Every variable the lane reads, set — the arrangement each refusal case removes one thing from. */
const COMPLETE = {
	JPWB_EXECUTOR: 'pi',
	JPWB_EXECUTOR_MODEL: 'openai-codex/gpt-5.4-mini',
	JPWB_ASSURANCE_MODEL: 'glm-5-3-flash-max',
	JPWB_JUDGE_MODEL: 'Gemini 3.1 Pro (High)'
} as const;

/** What the PRODUCT selects for `tool` outside test mode, when only `variable` carries a model. */
const productSelects = (tool: string, variable: string) =>
	selectReviewer({
		testMode: false,
		env: { JPWB_ASSURANCE_TOOL: tool, [variable]: 'fixture-model' },
		overrides: NO_OVERRIDES
	});

describe('⭐ the reviewer model variable is the one the SELECTED tool reads — the product selector’s own mapping', () => {
	it('agy reads JPWB_JUDGE_MODEL and devin JPWB_ASSURANCE_MODEL', () => {
		expect(reviewerModelVariable('agy')).toBe('JPWB_JUDGE_MODEL');
		expect(reviewerModelVariable('devin')).toBe('JPWB_ASSURANCE_MODEL');
	});

	it('⭑ and the product agrees: each tool is selected with its own variable, and refused with only the other', () => {
		for (const tool of ['agy', 'devin'] as const) {
			const own = REVIEWER_MODEL_VARIABLE[tool];
			const other = MODEL_VARIABLES.find((v) => v !== own)!;
			expect(productSelects(tool, own), `${tool} with ${own}`).toMatchObject({
				kind: tool === 'agy' ? 'AGY' : 'DEVIN',
				modelId: 'fixture-model'
			});
			expect(productSelects(tool, other), `${tool} with only ${other}`).toMatchObject({
				kind: 'REFUSED',
				code: 'REVIEWER_MODEL_UNSET'
			});
		}
	});

	it('⭑ reads the tool as the selector does — trimmed, blank unset, the id matched exactly', () => {
		const tools = [' devin ', 'devin\n', '\tagy', 'Devin', 'AGY', 'pi', 'devin-x', '', '   '];
		for (const tool of tools) {
			const product = selectReviewer({
				testMode: false,
				env: { JPWB_ASSURANCE_TOOL: tool, ...COMPLETE },
				overrides: NO_OVERRIDES
			});
			const productRuns = product.kind === 'AGY' || product.kind === 'DEVIN';
			expect(wiredReviewer(tool) !== undefined, JSON.stringify(tool)).toBe(productRuns);
		}
		expect(wiredReviewer(undefined)).toBeUndefined();
	});
});

describe('⭐ the lane requires exactly what its tool reads', () => {
	it('agy: the executor pair, the tool and JPWB_JUDGE_MODEL — never JPWB_ASSURANCE_MODEL', () => {
		expect([...requiredLaneKeys('agy')].sort()).toEqual(
			['JPWB_ASSURANCE_TOOL', 'JPWB_EXECUTOR', 'JPWB_EXECUTOR_MODEL', 'JPWB_JUDGE_MODEL'].sort()
		);
	});

	it('devin: the executor pair, the tool and JPWB_ASSURANCE_MODEL — never JPWB_JUDGE_MODEL', () => {
		expect([...requiredLaneKeys(' devin ')].sort()).toEqual(
			['JPWB_ASSURANCE_MODEL', 'JPWB_ASSURANCE_TOOL', 'JPWB_EXECUTOR', 'JPWB_EXECUTOR_MODEL'].sort()
		);
	});

	it('⛔ an agy lane with no JPWB_ASSURANCE_MODEL starts — it is not a key agy reads', () => {
		const { JPWB_ASSURANCE_MODEL: _unread, ...agy } = { ...COMPLETE, JPWB_ASSURANCE_TOOL: 'agy' };
		expect(laneKeysRefusal(agy)).toBeUndefined();
	});

	it('a devin lane with no JPWB_JUDGE_MODEL starts', () => {
		const { JPWB_JUDGE_MODEL: _unread, ...devin } = { ...COMPLETE, JPWB_ASSURANCE_TOOL: 'devin' };
		expect(laneKeysRefusal(devin)).toBeUndefined();
	});

	it('⛔ each tool is refused without its own model variable — blank counts as unset — and the refusal names it', () => {
		for (const tool of ['agy', 'devin'] as const) {
			const own = REVIEWER_MODEL_VARIABLE[tool];
			for (const value of [undefined, '', '   ']) {
				const refusal = laneKeysRefusal({ ...COMPLETE, JPWB_ASSURANCE_TOOL: tool, [own]: value });
				expect(refusal ?? 'NO REFUSAL', `${tool} with ${own}=${JSON.stringify(value)}`).toContain(
					own
				);
			}
		}
	});

	it('⛔ an unset tool is refused, named', () => {
		expect(laneKeysRefusal({ ...COMPLETE }) ?? 'NO REFUSAL').toMatch(
			/missing[^\n]*JPWB_ASSURANCE_TOOL/
		);
	});

	it('⛔ a tool the product would refuse is refused before the lane boots, naming it and the tools it may be', () => {
		for (const tool of ['pi', 'Devin', 'devin-x']) {
			const refusal = laneKeysRefusal({ ...COMPLETE, JPWB_ASSURANCE_TOOL: tool }) ?? 'NO REFUSAL';
			expect(refusal, tool).toContain(`JPWB_ASSURANCE_TOOL='${tool}'`);
			expect(refusal, tool).toMatch(/agy[^\n]*JPWB_JUDGE_MODEL/);
			expect(refusal, tool).toMatch(/devin[^\n]*JPWB_ASSURANCE_MODEL/);
		}
	});

	it('the refusal names the selected reviewer (REG-D-084) as configuration, never as a default', () => {
		const refusal = laneKeysRefusal({}) ?? 'NO REFUSAL';
		expect(refusal).toContain('JPWB_ASSURANCE_TOOL=devin');
		expect(refusal).toContain('JPWB_ASSURANCE_MODEL=glm-5-3-flash-max');
		expect(refusal).toContain('REG-D-084');
		expect(refusal).toMatch(/not a default/);
	});
});

describe('⛔ the lane refuses a program override where the product does — the SELECTED tool’s, set, outside test mode', () => {
	const OTHER = { agy: 'devin', devin: 'agy' } as const;

	it('each tool’s own override refuses its lane, even set empty, naming it — and the product refuses the same', () => {
		for (const tool of ['agy', 'devin'] as const) {
			const program = REVIEWER_PROGRAM_VARIABLE[tool];
			for (const value of ['C:/fixture/reviewer.exe', '']) {
				const env = { ...COMPLETE, JPWB_ASSURANCE_TOOL: tool, [program]: value };
				const arrangement = `${tool} with ${program}=${JSON.stringify(value)}`;
				expect(laneKeysRefusal(env) ?? 'NO REFUSAL', arrangement).toContain(
					`${program}=${JSON.stringify(value)}`
				);
				// ⭑ The lane runs outside test mode, so the product is asked outside it, with the override captured.
				expect(
					selectReviewer({ testMode: false, env, overrides: { ...NO_OVERRIDES, [tool]: value } }),
					`the product, ${arrangement}`
				).toMatchObject({ kind: 'REFUSED', code: 'REVIEWER_PROGRAM_OVERRIDDEN' });
			}
		}
	});

	it('the OTHER tool’s override refuses nothing — and the product runs the selected tool with it set', () => {
		for (const tool of ['agy', 'devin'] as const) {
			const other = OTHER[tool];
			const program = REVIEWER_PROGRAM_VARIABLE[other];
			const env = { ...COMPLETE, JPWB_ASSURANCE_TOOL: tool, [program]: 'C:/fixture/other.exe' };
			expect(laneKeysRefusal(env), `${tool} with ${program} set`).toBeUndefined();
			expect(
				selectReviewer({
					testMode: false,
					env,
					overrides: { ...NO_OVERRIDES, [other]: 'C:/fixture/other.exe' }
				}),
				`the product, ${tool} with ${program} set`
			).toMatchObject({ kind: tool === 'agy' ? 'AGY' : 'DEVIN' });
		}
	});

	describe('each variable is the one the product’s adapter captures when it loads', () => {
		afterEach(() => {
			vi.unstubAllEnvs();
			vi.resetModules();
		});

		it('agy: the module that runs agy captures JPWB_AGY_BIN', async () => {
			vi.stubEnv(REVIEWER_PROGRAM_VARIABLE.agy, 'fixture-agy-program');
			vi.resetModules();
			const { AGY_BIN_OVERRIDE } =
				await import('../apps/rph-demo/src/lib/server/assurance/agy-cli.js');
			expect(AGY_BIN_OVERRIDE).toBe('fixture-agy-program');
		});

		it('devin: the module that runs devin captures JPWB_DEVIN_BIN', async () => {
			vi.stubEnv(REVIEWER_PROGRAM_VARIABLE.devin, 'fixture-devin-program');
			vi.resetModules();
			const { DEVIN_BIN_OVERRIDE } =
				await import('../apps/rph-demo/src/lib/server/tools/devin-reviewer.js');
			expect(DEVIN_BIN_OVERRIDE).toBe('fixture-devin-program');
		});
	});
});

// ⭐ `JAN-SELRES` RS-1 (D5) — THE EXECUTOR LIMB, HELD TO THE PRODUCT'S EXECUTOR SELECTOR THE WAY THE REVIEWER LIMB IS HELD
// TO ITS OWN (above): over a table, with the product asked outside test mode — where the lane runs — and handed the
// overrides the shell would have made the adapters capture. ⭑ ONE RULE IS THE LANE'S OWN, and the table holds it apart
// from the product's: no agy executor, because the spec asserts a provider-reported producer.
describe('⭐ the lane refuses the executor the product refuses — and one more, labelled as the lane’s own', () => {
	/** The line the lane's own rule writes — the one refusal the product does not make. */
	const LANE_RULE = 'is refused by a rule of THIS LANE, not of the product';
	/** Each reason the lane gives, one per line. */
	const faultsOf = (refusal: string | undefined) =>
		(refusal ?? '').split('\n').filter((l) => l.startsWith('  · '));

	it('⭑ reads the executing tool as the selector does — trimmed, blank unset, the id matched exactly', () => {
		const tools = [
			'pi',
			' pi ',
			'pi\n',
			'\tagy',
			'agy',
			'Agy',
			'PI',
			'devin',
			'nosuchtool',
			'',
			'   '
		];
		for (const tool of tools) {
			const product = selectExecutor({
				testMode: false,
				env: { JPWB_EXECUTOR: tool, JPWB_EXECUTOR_MODEL: 'fixture-model' },
				overrides: NO_OVERRIDES
			});
			expect(wiredExecutor(tool) !== undefined, JSON.stringify(tool)).toBe(
				product.kind !== 'REFUSED'
			);
		}
		expect(wiredExecutor(undefined)).toBeUndefined();
		expect([...WIRED_EXECUTORS].sort()).toEqual(['agy', 'pi']);
	});

	const EXECUTOR_TOOLS = [
		undefined,
		'',
		'   ',
		'pi',
		' pi ',
		'agy',
		' agy ',
		'Agy',
		'devin',
		'nosuchtool'
	];
	const EXECUTOR_MODELS = ['openai-codex/gpt-5.4-mini', undefined, '  '];
	/** ⭑ `''` is SET. A devin program override needs an agy reviewer, or the REVIEWER limb would refuse the row too. */
	const PROGRAM_ROWS: readonly {
		readonly name: string;
		readonly env: Readonly<Record<string, string>>;
		readonly reviewer: Readonly<Record<string, string>>;
	}[] = [
		{ name: 'no override', env: {}, reviewer: { JPWB_ASSURANCE_TOOL: 'devin' } },
		{
			name: 'JPWB_AGY_BIN set',
			env: { JPWB_AGY_BIN: 'C:/fixture/agy.exe' },
			reviewer: { JPWB_ASSURANCE_TOOL: 'devin' }
		},
		{
			name: 'JPWB_AGY_BIN empty',
			env: { JPWB_AGY_BIN: '' },
			reviewer: { JPWB_ASSURANCE_TOOL: 'devin' }
		},
		{
			name: 'JPWB_DEVIN_BIN set',
			env: { JPWB_DEVIN_BIN: 'C:/fixture/devin.exe' },
			reviewer: { JPWB_ASSURANCE_TOOL: 'agy' }
		}
	];
	for (const tool of EXECUTOR_TOOLS)
		for (const model of EXECUTOR_MODELS)
			for (const row of PROGRAM_ROWS)
				it(`JPWB_EXECUTOR=${JSON.stringify(tool)} · JPWB_EXECUTOR_MODEL=${JSON.stringify(model)} · ${row.name}: the lane refuses what the product refuses`, () => {
					const executor = { JPWB_EXECUTOR: tool, JPWB_EXECUTOR_MODEL: model, ...row.env };
					// The lane's full environment: the reviewer's keys all present and admitted, so any fault is the executor's.
					const env = { ...COMPLETE, ...row.reviewer, ...executor };
					const product = selectExecutor({
						testMode: false,
						env: executor,
						overrides: { agy: row.env.JPWB_AGY_BIN, devin: row.env.JPWB_DEVIN_BIN }
					});
					const faults = faultsOf(laneKeysRefusal(env));
					const productFaults = faults.filter((l) => !l.includes(LANE_RULE));
					expect(
						productFaults.length > 0,
						`the product answered ${product.kind === 'REFUSED' ? product.code : product.kind}; the lane said ` +
							JSON.stringify(productFaults)
					).toBe(product.kind === 'REFUSED');
					// ⭑ AND THE LANE'S OWN RULE FIRES FOR agy, AND ONLY FOR agy — whether or not the product would run it.
					expect(
						faults.some((l) => l.includes(LANE_RULE)),
						'the lane’s own agy rule'
					).toBe(wiredExecutor(tool) === 'agy');
				});

	it('⛔ a Pi executor the product runs boots the lane — the stray JPWB_AGY_BIN of SR2-M20’s host included', () => {
		const env = { ...COMPLETE, JPWB_ASSURANCE_TOOL: 'devin', JPWB_AGY_BIN: 'C:/fixture/agy.exe' };
		expect(laneKeysRefusal(env)).toBeUndefined();
		expect(
			selectExecutor({
				testMode: false,
				env,
				overrides: { agy: 'C:/fixture/agy.exe', devin: undefined }
			})
		).toEqual({ kind: 'PI', modelId: COMPLETE.JPWB_EXECUTOR_MODEL });
	});

	it('⛔ an executor the product does not run is refused, named, with the tools it may be', () => {
		for (const tool of ['devin', 'Agy', 'nosuchtool']) {
			const refusal = laneKeysRefusal({
				...COMPLETE,
				JPWB_ASSURANCE_TOOL: 'devin',
				JPWB_EXECUTOR: tool
			});
			expect(refusal ?? 'NO REFUSAL', tool).toContain(`JPWB_EXECUTOR='${tool}' names no executor`);
			expect(refusal ?? 'NO REFUSAL', tool).toContain('(agy, pi)');
		}
	});

	it('⛔ the agy executor’s program override is refused as the product refuses it, even empty, naming it', () => {
		for (const value of ['C:/fixture/agy.exe', '']) {
			const refusal = laneKeysRefusal({
				...COMPLETE,
				JPWB_ASSURANCE_TOOL: 'devin',
				JPWB_EXECUTOR: 'agy',
				JPWB_AGY_BIN: value
			});
			expect(refusal ?? 'NO REFUSAL').toContain(
				`${EXECUTOR_PROGRAM_VARIABLE.agy}=${JSON.stringify(value)} replaces the agy executor's program`
			);
			expect(refusal ?? 'NO REFUSAL').toContain('REG-F-459');
		}
		// ⭑ The variable is the agy adapter's one capture — the same the reviewer limb refuses for an agy reviewer.
		expect(EXECUTOR_PROGRAM_VARIABLE).toEqual({ agy: REVIEWER_PROGRAM_VARIABLE.agy });
	});

	it('⭑ the lane’s agy rule says it is the lane’s, not the product’s — and the spec still makes the assertion it rests on', () => {
		const refusal =
			laneKeysRefusal({ ...COMPLETE, JPWB_ASSURANCE_TOOL: 'devin', JPWB_EXECUTOR: 'agy' }) ??
			'NO REFUSAL';
		expect(refusal).toContain(LANE_RULE);
		expect(refusal).toContain('PROVIDER_REPORTED');
		expect(refusal).toContain('e2e-live-exec/execution.live.ts');
		expect(refusal).toContain('The product runs an agy executor');
		// ⛔ THE REASON, HELD FROM SOURCE: were the spec to stop asserting a provider-reported producer, this rule would
		// refuse a configuration for nothing — so the pin reddens and the rule is re-decided.
		expect(assertionsOn(parsed(SPEC), 'producer.evidence')).toEqual(["toBe('PROVIDER_REPORTED')"]);
	});
});

/** A subject and a review input for the validator — enough to reach its prompt, its call and its repair. */
const REVIEW_SUBJECT: AssuranceSubject = {
	subjectId: 'lane-budget-fixture',
	objectType: 'ARTIFACT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: {
		actorType: 'AGENT',
		agentId: 'fixture-executor',
		modelId: 'fixture-executor-model',
		providerId: 'fixture-provider'
	}
};
const REVIEW_CONTEXT: ValidatorContext = {
	reasoningReview: {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'WORK_PRODUCT',
		prompt: 'Assess a delivery route for operational risk.',
		content: '{"finding":"f","risks":["r"],"recommendation":"x"}',
		narration: ''
	}
};

describe('⭐ the lane waits for the reviewer’s bounded worst case — the reviewer’s figures the product’s own, the executor’s and the setup’s declared allowances', () => {
	beforeEach(() => {
		vi.stubEnv('PATH', noProgramsDirectory());
		for (const v of MODEL_VARIABLES) vi.stubEnv(v, undefined);
	});
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('the tries are the execution loop’s repair bound', () => {
		expect(LANE_BUDGET.tries).toBe(DEFAULT_REPAIR_BOUND);
	});

	it('each reviewer call is bounded by what BOTH reviewer adapters hand their program, measured at the exec seam', async () => {
		const bounds: number[] = [];
		vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge');
		await agyPrint('p', async (_file, _args, options) => {
			bounds.push(options.timeout);
			return { stdout: '{}' };
		});
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance');
		await devinPrint('p', async (_file, _args, options) => {
			bounds.push(options.timeout);
			return { stdout: '{}' };
		});
		expect(bounds).toEqual([LANE_BUDGET.reviewerCallMs, LANE_BUDGET.reviewerCallMs]);
	});

	it('a review is at most two calls — the initial one and one repair — measured by driving the product’s validator with a reviewer that never answers in JSON', async () => {
		const prompts: string[] = [];
		const validator = createAgyReasoningReviewValidator({
			print: async (p) => {
				prompts.push(p);
				return 'not JSON, and never will be';
			},
			modelId: 'fixture-reviewer'
		});
		// The worst case: the initial answer fails to parse, so a repair is asked for, and it fails too.
		await expect(validator.evaluate(REVIEW_SUBJECT, REVIEW_CONTEXT)).rejects.toThrow();
		expect(prompts, 'the calls one review made').toHaveLength(LANE_BUDGET.reviewerCallsPerTry);
		expect(LANE_BUDGET.reviewerCallsPerTry).toBe(2);
	});

	it('the Begin & Execute wait covers every try’s executor allowance and both of its reviewer calls; the test adds its setup', () => {
		const { tries, executorCallMs, reviewerCallsPerTry, reviewerCallMs, setupMs } = LANE_BUDGET;
		expect(EXECUTE_TIMEOUT_MS).toBe(
			tries * (executorCallMs + reviewerCallsPerTry * reviewerCallMs)
		);
		expect(EXECUTE_TIMEOUT_MS).toBe(2_160_000);
		expect(TEST_TIMEOUT_MS).toBe(EXECUTE_TIMEOUT_MS + setupMs);
	});

	it('⭑ the grade each reviewer’s record carries: devin’s is PROVIDER_REPORTED when its export names the model, agy reports none', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance');
		const devin = await devinPrint('p', async (_file, args) => {
			// The export devin writes, naming the model that answered — read back by `readReportedModel`.
			const exportPath = args[args.indexOf('--export') + 1]!;
			writeFileSync(
				exportPath,
				JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance' } }] })
			);
			return { stdout: '{}' };
		});
		expect(isToolInvocationResult(devin) ? devin.identityEvidence : 'a bare string').toBe(
			REVIEWER_IDENTITY_EVIDENCE.devin
		);
		vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge');
		const agy = await agyPrint('p', async () => ({ stdout: '{}' }));
		// A bare string reports no identity, so the record keeps the host's configuration, graded `HOST_CONFIGURED`
		// (`assurance/exchange-recorder.ts`, `identityFacts`).
		expect(typeof agy).toBe('string');
		expect(REVIEWER_IDENTITY_EVIDENCE.agy).toBe('HOST_CONFIGURED');
	});
});

/** The lane file, parsed. */
const parsed = (rel: string) =>
	ts.createSourceFile(rel, readFileSync(`${APP}${rel}`, 'utf8'), ts.ScriptTarget.Latest, true);

/** Every place `sf` NAMES a reviewer model variable itself: a string, a template, or `process.env` read by name. */
function modelVariablesNamed(sf: ts.SourceFile): string[] {
	const out: string[] = [];
	const at = (n: ts.Node, what: string) =>
		out.push(`${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${what}`);
	const visit = (n: ts.Node): void => {
		if (
			ts.isStringLiteralLike(n) ||
			ts.isTemplateHead(n) ||
			ts.isTemplateMiddle(n) ||
			ts.isTemplateTail(n)
		)
			for (const v of MODEL_VARIABLES) if (n.text.includes(v)) at(n, `the text names ${v}`);
		if (
			ts.isPropertyAccessExpression(n) &&
			(MODEL_VARIABLES as readonly string[]).includes(n.name.text)
		)
			at(n, `reads ${n.getText(sf)}`);
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

/** The arguments of every call to `name` in `sf`, each as source text. */
function callsTo(sf: ts.SourceFile, name: string): string[][] {
	const out: string[][] = [];
	const visit = (n: ts.Node): void => {
		if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name)
			out.push(n.arguments.map((a) => a.getText(sf)));
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

/** The `timeout` the config's `defineConfig({...})` sets at its top level — the per-test timeout — as source text. */
function configTestTimeout(sf: ts.SourceFile): string | undefined {
	let found: string | undefined;
	const visit = (n: ts.Node): void => {
		if (
			ts.isCallExpression(n) &&
			ts.isIdentifier(n.expression) &&
			n.expression.text === 'defineConfig' &&
			n.arguments[0] !== undefined &&
			ts.isObjectLiteralExpression(n.arguments[0])
		)
			for (const p of n.arguments[0].properties)
				if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'timeout')
					found = p.initializer.getText(sf);
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return found;
}

/** The initializer of every `timeout:` property in `sf`, as source text. */
function timeoutInitializers(sf: ts.SourceFile): string[] {
	const out: string[] = [];
	const visit = (n: ts.Node): void => {
		if (ts.isPropertyAssignment(n) && n.name.getText(sf) === 'timeout')
			out.push(n.initializer.getText(sf));
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

/** The initializer of every `name:` property in `sf`, as source text. */
function propertyInitializers(sf: ts.SourceFile, name: string): string[] {
	const out: string[] = [];
	const visit = (n: ts.Node): void => {
		if (ts.isPropertyAssignment(n) && n.name.getText(sf) === name)
			out.push(n.initializer.getText(sf));
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

/** The initializer of every variable `name` declared in `sf`, as source text. */
function initializersOf(sf: ts.SourceFile, name: string): string[] {
	const out: string[] = [];
	const visit = (n: ts.Node): void => {
		if (
			ts.isVariableDeclaration(n) &&
			ts.isIdentifier(n.name) &&
			n.name.text === name &&
			n.initializer
		)
			out.push(n.initializer.getText(sf));
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

/**
 * What each `if (name) …` at the TOP LEVEL of `sf` runs, as source text — top level because a guard there runs when
 * the file loads, which is when Playwright reads a config.
 */
function topLevelGuardsOn(sf: ts.SourceFile, name: string): string[] {
	return sf.statements.flatMap((st) =>
		ts.isIfStatement(st) &&
		ts.isIdentifier(st.expression) &&
		st.expression.text === name &&
		st.elseStatement === undefined
			? [st.thenStatement.getText(sf)]
			: []
	);
}

/**
 * Every assertion `sf` makes on `subject` — `expect(subject, …)` and its matcher chain — as `chain(arguments)` with
 * whitespace collapsed: `expect(a, 'm').not.toBe(b)` on `a` is `not.toBe(b)`.
 */
function assertionsOn(sf: ts.SourceFile, subject: string): string[] {
	const flat = (n: ts.Node) => n.getText(sf).replace(/\s+/g, ' ');
	const out: string[] = [];
	const visit = (n: ts.Node): void => {
		if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
			const chain = [n.expression.name.text];
			let base: ts.Expression = n.expression.expression;
			while (ts.isPropertyAccessExpression(base)) {
				chain.unshift(base.name.text);
				base = base.expression;
			}
			if (
				ts.isCallExpression(base) &&
				ts.isIdentifier(base.expression) &&
				base.expression.text === 'expect' &&
				base.arguments[0] !== undefined &&
				flat(base.arguments[0]) === subject
			)
				out.push(`${chain.join('.')}(${n.arguments.map(flat).join(', ')})`);
		}
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

/** The names `sf` imports from the helper, by the specifier it must use. */
function importsFrom(sf: ts.SourceFile, specifier: string): string[] {
	return sf.statements.flatMap((st) =>
		ts.isImportDeclaration(st) &&
		ts.isStringLiteral(st.moduleSpecifier) &&
		st.moduleSpecifier.text === specifier &&
		st.importClause?.namedBindings &&
		ts.isNamedImports(st.importClause.namedBindings)
			? st.importClause.namedBindings.elements.map((e) => (e.propertyName ?? e.name).text)
			: []
	);
}

describe('⛔ the config and the spec take every one of these from the helper', () => {
	it('neither names a reviewer model variable itself — the mapping has one home', () => {
		expect(modelVariablesNamed(parsed(CONFIG)), CONFIG).toEqual([]);
		expect(modelVariablesNamed(parsed(SPEC)), SPEC).toEqual([]);
	});

	it('the config refuses and passes keys through by the helper, and its test timeout is the helper’s', () => {
		const sf = parsed(CONFIG);
		expect(importsFrom(sf, './e2e-live-exec/lane-config').sort()).toEqual(
			['TEST_TIMEOUT_MS', 'laneKeysRefusal', 'requiredLaneKeys'].sort()
		);
		expect(callsTo(sf, 'laneKeysRefusal'), 'the refusal is asked of the whole environment').toEqual(
			[['process.env']]
		);
		expect(
			callsTo(sf, 'requiredLaneKeys'),
			'the keys passed through are the ones required'
		).toEqual([['process.env.JPWB_ASSURANCE_TOOL']]);
		expect(configTestTimeout(sf)).toBe('TEST_TIMEOUT_MS');
	});

	it('the spec takes its reviewer’s model variable and grade from the helper, and waits the helper’s Begin & Execute bound', () => {
		const sf = parsed(SPEC);
		expect(importsFrom(sf, './lane-config').sort()).toEqual(
			[
				'EXECUTE_TIMEOUT_MS',
				'REVIEWER_IDENTITY_EVIDENCE',
				'REVIEWER_MODEL_VARIABLE',
				'wiredReviewer'
			].sort()
		);
		expect(timeoutInitializers(sf)).toEqual(['EXECUTE_TIMEOUT_MS']);
	});

	it('⛔ the config THROWS the helper’s refusal when it loads — a refusal only printed would boot the lane anyway', () => {
		const sf = parsed(CONFIG);
		expect(initializersOf(sf, 'refusal')).toEqual(['laneKeysRefusal(process.env)']);
		expect(topLevelGuardsOn(sf, 'refusal')).toEqual(['throw new Error(refusal);']);
	});

	it('the config boots its server OUTSIDE test mode — the mode whose refusals the helper restates', () => {
		expect(propertyInitializers(parsed(CONFIG), 'RPH_DEMO_MODE')).toEqual(["'server'"]);
	});

	it('⛔ the spec reads its reviewing tool from the environment, and the reviewer model from that tool’s variable, trimmed', () => {
		const sf = parsed(SPEC);
		// A literal tool here would hold an agy lane to devin's variable again, without naming it.
		expect(callsTo(sf, 'wiredReviewer')).toEqual([['process.env.JPWB_ASSURANCE_TOOL']]);
		expect(initializersOf(sf, 'reviewerModel')).toEqual([
			'process.env[REVIEWER_MODEL_VARIABLE[reviewerTool!]]!.trim()'
		]);
	});

	it('⛔ the spec’s hard assertions on the reviewer and on the assessments are the ones this increment made', () => {
		const sf = parsed(SPEC);
		// The recorded reviewer is EXACTLY the configured model: `toContain` would pass a longer id.
		expect(assertionsOn(sf, 'reviewer.value')).toEqual(['toBe(reviewerModel)']);
		expect(assertionsOn(sf, 'reviewer.evidence')).toEqual([
			'toBe(REVIEWER_IDENTITY_EVIDENCE[reviewerTool!])'
		]);
		// `REG-F-445`: at least one assessment, the Reasoning Review's among them, and every one naming a floor policy.
		expect(assertionsOn(sf, 'assessments.length')).toEqual(['toBeGreaterThanOrEqual(1)']);
		expect(assertionsOn(sf, 'assessments.map(policyOf)')).toEqual([
			"toContain('floor.reasoning-review')"
		]);
		expect(
			assertionsOn(sf, "assessments.map(policyOf).filter((id) => !id.startsWith('floor.'))")
		).toEqual(['toEqual([])']);
	});
});
