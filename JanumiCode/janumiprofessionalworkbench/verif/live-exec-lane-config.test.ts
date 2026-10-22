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
// ⭐ `JAN-EXEC` Phase 7 `P7-2b` (`REG-D-102` (2)) — AND NOW 3 tries × 4 calls × 240 s: a reviewer call that throws short of
// its tool's bound is run once more (`reasoning-review-validator.ts`, `timed`), so each of a review's two calls may be
// two. Measured below through the product's devin branch, with a program that throws before each answer.
// ⭐ `JAN-EXEC` Phase 7 `P7-2` (D3, D4, D10) — AND THE PHASE 7 LANE'S OWN: the two variables the server reads at call time,
// refused at boot by a rule of the lane and held to the product's readers of them; the Phase 7 allowance, held to the
// product's command limit and deadline and derived from the budget by reference; and the one-unit spec's reviewer, read
// from the first call that answered. ⭐ (D1, D8) — and a Phase 7 variable set with no run folder, refused at boot where
// the config would collect the paid one-unit spec instead; and the reviewer calls that spec spent, printed and annotated,
// which the Phase 7 run is given as the calls spent before it.
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
	FLOOR_POLICY_IDS,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { ModelExchangeSchema } from '@janumipwb/rph-contracts';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	EXECUTE_TIMEOUT_MS,
	EXECUTOR_PROGRAM_VARIABLE,
	LANE_BUDGET,
	PHASE7_COMMAND_MS,
	PHASE7_DECLARED_POLICIES_PER_UNIT,
	PHASE7_DECLARED_REVIEWS_MS,
	PHASE7_INTROSPECT_MS,
	PHASE7_MODEL_UNITS,
	PHASE7_NEGATIVE_CONTROL_RESERVE,
	PHASE7_PAID_LIMIT,
	PHASE7_PRESSED_UNITS,
	PHASE7_RECORD_ASSURANCE_MS,
	PHASE7_RECOVERY_MS,
	PHASE7_REVIEWED_COMMANDS,
	PHASE7_RERUNS_PER_PHASE,
	PHASE7_SETUP_MS,
	PHASE7_SHOW_OVERVIEW_MS,
	PHASE7_SIGN_OFF_MS,
	PHASE7_SIGN_OFF_UNIT_MS,
	PHASE7_DECLARED_RERUN_MS,
	PHASE7_TEST_TIMEOUT_MS,
	PHASE7_UI_MS,
	PHASE7_UNIT_ALLOWANCE_MS,
	PHASE7_UNIT_RUN_MS,
	REVIEWER_IDENTITY_EVIDENCE,
	REVIEWER_MODEL_VARIABLE,
	REVIEWER_PROGRAM_VARIABLE,
	TEST_TIMEOUT_MS,
	WIRED_EXECUTORS,
	laneKeysRefusal,
	phase7DeclaredRerunMs,
	phase7DeclaredReviewsMs,
	phase7RecordAssuranceMs,
	phase7SignOffUnitMs,
	requiredLaneKeys,
	reviewerModelVariable,
	wiredExecutor,
	wiredReviewer
} from '../apps/rph-demo/e2e-live-exec/lane-config.js';
import {
	INTROSPECT_MS as OPERATOR_INTROSPECT_MS,
	PHASE7_SIGN_OFF_MS as OPERATOR_SIGN_OFF_MS,
	PHASE7_UI_MS as OPERATOR_UI_MS
} from '../apps/rph-demo/e2e-live-exec/phase7-operator.js';
import { agyPrint } from '../apps/rph-demo/src/lib/server/assurance/agy-cli.js';
import { createFloorRegistry } from '../apps/rph-demo/src/lib/server/assurance/index.js';
import { selectExecutor } from '../apps/rph-demo/src/lib/server/execution/executor-selection.js';
import { noProgramsDirectory } from '../apps/rph-demo/src/lib/server/assurance/no-programs.testing.js';
import { createAgyReasoningReviewValidator } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { selectReviewer } from '../apps/rph-demo/src/lib/server/assurance/reviewer-selection.js';
import {
	DEFAULT_REPAIR_BOUND,
	reviewSeesPriorFindings
} from '../apps/rph-demo/src/lib/server/execution/loop-detection.js';
import { devinPrint } from '../apps/rph-demo/src/lib/server/tools/devin-reviewer.js';
import { isToolInvocationResult } from '../apps/rph-demo/src/lib/server/tools/backing-tool.js';
import { OBSERVED_PROCESS_RUN_LIMIT } from '../apps/rph-demo/src/lib/server/tools/process-run-observer.js';
import { agentMode } from '../apps/rph-demo/src/lib/server/workbench.js';
import { liveExecTestMatch, ONE_UNIT_SPEC } from '../apps/rph-demo/e2e-live-exec/run-folder.js';
import { MAX_REVIEWER_CALLS } from '../scripts/phase7/negative-control.js';
import { PHASE7_PHASES, PHASE7_ROOT } from '../scripts/phase7/pwa-content.js';
import { EXECUTION_COMMAND_TIMEOUT_MS } from '../scripts/phase7/runner-environment.js';

const APP = fileURLToPath(new URL('../apps/rph-demo/', import.meta.url));
const CONFIG = 'playwright.live-exec.config.ts';
const SPEC = 'e2e-live-exec/execution.live.ts';
const LANE = 'e2e-live-exec/lane-config.ts';
const REGISTER = fileURLToPath(
	new URL('../docs/canon/JPWB-REG-005 Decision and Divergence Register.md', import.meta.url)
);
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

	it('the refusal names the selected reviewer (~~REG-D-084~~ ⭐ REG-D-119) as configuration, never as a default', () => {
		const refusal = laneKeysRefusal({}) ?? 'NO REFUSAL';
		expect(refusal).toContain('JPWB_ASSURANCE_TOOL=devin');
		expect(refusal).toContain('JPWB_ASSURANCE_MODEL=glm-5-3-flash-high');
		expect(refusal).toContain('REG-D-119');
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

// ⭐ `JAN-EXEC` Phase 7 `P7-2` (D3) — TWO VARIABLES THE SERVER READS AT CALL TIME, REFUSED BEFORE IT STARTS. The config
// passes the operator's whole shell to the server (`REG-F-531`), so the refusal is the config's, at load, and asserted by
// its words: each variable named, with its value and why. ⭑ HELD TO THE PRODUCT'S OWN READERS: every value the server
// acts on is refused, and a blank one, which the server reads as unset, is not.
describe('⭐ P7-2 D3 — the lane boots with neither JPWB_REVIEW_SEES_PRIOR nor JPWB_AGENT set — a rule of its own, labelled', () => {
	/** The lane's whole environment, admitted, with `name` set to `value`. */
	const refusalWith = (name: string, value: string | undefined) =>
		laneKeysRefusal({ ...COMPLETE, JPWB_ASSURANCE_TOOL: 'devin', [name]: value });

	it('⛔ a set JPWB_REVIEW_SEES_PRIOR is refused, named with its value, and why: the server hands the reviewer its own earlier findings', () => {
		for (const value of ['1', 'true', '0', ' yes ']) {
			const refusal = refusalWith('JPWB_REVIEW_SEES_PRIOR', value) ?? 'NO REFUSAL';
			expect(refusal, JSON.stringify(value)).toContain(
				`JPWB_REVIEW_SEES_PRIOR=${JSON.stringify(value)} is refused by a rule of THIS LANE, not of the product`
			);
			expect(refusal).toContain(
				'the server reads it at every review it runs (`reviewSeesPriorFindings`'
			);
			expect(refusal).toContain("'1' or 'true' hands the reviewer its own earlier findings");
			expect(refusal).toContain('REG-F-531');
			expect(refusal).toContain('design §6 P7-2 D3');
		}
	});

	it('⛔ a set JPWB_AGENT is refused, named with its value, and why: the server chooses its authoring agent by it', () => {
		for (const value of ['pi', 'mock', 'Mock', ' x ']) {
			const refusal = refusalWith('JPWB_AGENT', value) ?? 'NO REFUSAL';
			expect(refusal, JSON.stringify(value)).toContain(
				`JPWB_AGENT=${JSON.stringify(value)} is refused by a rule of THIS LANE, not of the product`
			);
			expect(refusal).toContain(
				'the server reads it whenever the authoring agent is asked for a turn (`agentMode`'
			);
			expect(refusal).toContain("'pi' or 'mock' chooses that agent over the mode's default");
			expect(refusal).toContain('REG-F-531');
		}
	});

	it('⭑ blank is unset: an empty or spaced value refuses nothing, for either', () => {
		for (const name of ['JPWB_REVIEW_SEES_PRIOR', 'JPWB_AGENT'])
			for (const value of [undefined, '', '   ', '\t'])
				expect(refusalWith(name, value), `${name}=${JSON.stringify(value)}`).toBeUndefined();
	});

	it('⭑ held to the product: every value its readers ACT on is refused, and each reads a blank value as unset', () => {
		const acted: string[] = [];
		// `reviewSeesPriorFindings` takes the value; `agentMode` reads the environment when it is called.
		for (const value of ['1', 'true', 'TRUE', ' 1 ', ' True ', '0', 'false', 'yes', '', '   ']) {
			if (reviewSeesPriorFindings(value)) {
				acted.push(`JPWB_REVIEW_SEES_PRIOR=${JSON.stringify(value)}`);
				expect(refusalWith('JPWB_REVIEW_SEES_PRIOR', value), JSON.stringify(value)).toBeDefined();
			}
			if (!value.trim()) expect(reviewSeesPriorFindings(value), 'blank, read as unset').toBe(false);
		}
		try {
			vi.stubEnv('JPWB_AGENT', undefined);
			const byDefault = agentMode();
			for (const value of ['pi', 'mock', 'Mock', ' mock ', 'x', '', '   ']) {
				vi.stubEnv('JPWB_AGENT', value);
				if (agentMode() !== byDefault) {
					acted.push(`JPWB_AGENT=${JSON.stringify(value)}`);
					expect(refusalWith('JPWB_AGENT', value), JSON.stringify(value)).toBeDefined();
				}
				if (!value.trim()) expect(agentMode(), 'blank, read as unset').toBe(byDefault);
			}
		} finally {
			vi.unstubAllEnvs();
		}
		// ⛔ NOT VACUOUS: some value moved each reader, or the agreement above held of nothing.
		expect(acted.some((a) => a.startsWith('JPWB_REVIEW_SEES_PRIOR='))).toBe(true);
		expect(acted.some((a) => a.startsWith('JPWB_AGENT='))).toBe(true);
	});

	it('⛔ both set, beside a missing key: ONE refusal names all three', () => {
		const refusal =
			laneKeysRefusal({
				...COMPLETE,
				JPWB_ASSURANCE_TOOL: 'devin',
				JPWB_EXECUTOR_MODEL: undefined,
				JPWB_REVIEW_SEES_PRIOR: 'true',
				JPWB_AGENT: 'mock'
			}) ?? 'NO REFUSAL';
		expect(refusal).toMatch(/missing[^\n]*JPWB_EXECUTOR_MODEL/);
		expect(refusal).toContain('JPWB_REVIEW_SEES_PRIOR="true" is refused by a rule of THIS LANE');
		expect(refusal).toContain('JPWB_AGENT="mock" is refused by a rule of THIS LANE');
	});
});

// ⭐ `JAN-EXEC` Phase 7 `P7-2` (D1) — A REQUEST FOR THE PHASE 7 RUN THE CONFIG WOULD RUN AS THE ONE-UNIT SPEC. With
// `JPWB_LIVE_RUN_DIR` unset the config collects `execution.live.ts`, which calls its models whatever the Phase 7 variables
// say — so a run folder that never reached the process turned a request for Phase 7 into a paid run. ⭑ The variables are
// written here as the design and the operator spell them, never through the module's constants: a misspelt constant
// would otherwise be asked about by its own misspelling.
describe('⭐ P7-2 D1 — a Phase 7 variable set with no run folder is refused at boot: the config would run the paid one-unit spec', () => {
	const ADMITTED = { ...COMPLETE, JPWB_ASSURANCE_TOOL: 'devin' } as const;
	const RUN_ASKED_FOR = 'asks for the Phase 7 run, but JPWB_LIVE_RUN_DIR is unset';

	it('⛔ JPWB_PHASE7_PAID or JPWB_PHASE7_PRIOR_REVIEWER_CALLS, set with no JPWB_LIVE_RUN_DIR, is refused — named, with its value, the spec that would run instead, and whose rule it is', () => {
		for (const [name, value] of [
			['JPWB_PHASE7_PAID', '1'],
			['JPWB_PHASE7_PAID', '0'],
			['JPWB_PHASE7_PRIOR_REVIEWER_CALLS', '12'],
			['JPWB_PHASE7_PRIOR_REVIEWER_CALLS', ' 3 ']
		] as const) {
			const refusal = laneKeysRefusal({ ...ADMITTED, [name]: value }) ?? 'NO REFUSAL';
			expect(refusal, `${name}=${JSON.stringify(value)}`).toContain(
				`${name}=${JSON.stringify(value)} is refused by a rule of THIS LANE, not of the product: it ${RUN_ASKED_FOR}`
			);
			expect(refusal).toContain('the one-unit spec (e2e-live-exec/execution.live.ts)');
			expect(refusal).toContain('(design §6 P7-2 D1, D2)');
		}
	});

	it('⭑ with a run folder named — even empty, which the run-folder check refuses — neither refuses; and a blank one asks for nothing', () => {
		const PHASE7 = { JPWB_PHASE7_PAID: '1', JPWB_PHASE7_PRIOR_REVIEWER_CALLS: '12' };
		for (const runFolder of ['E:/runs/phase7-paid', '', '   '])
			expect(
				laneKeysRefusal({ ...ADMITTED, ...PHASE7, JPWB_LIVE_RUN_DIR: runFolder }),
				JSON.stringify(runFolder)
			).toBeUndefined();
		for (const blank of ['', '   '])
			expect(
				laneKeysRefusal({
					...ADMITTED,
					JPWB_PHASE7_PAID: blank,
					JPWB_PHASE7_PRIOR_REVIEWER_CALLS: blank
				}),
				JSON.stringify(blank)
			).toBeUndefined();
	});

	it('⭐ held to the config’s own rule: the lane refuses a Phase 7 variable exactly where the config would collect the one-unit spec', () => {
		let refused = 0;
		for (const runFolder of [undefined, '', 'E:/runs/phase7-paid'])
			for (const paid of [undefined, '', '1'])
				for (const prior of [undefined, '7']) {
					const env = {
						...ADMITTED,
						JPWB_LIVE_RUN_DIR: runFolder,
						JPWB_PHASE7_PAID: paid,
						JPWB_PHASE7_PRIOR_REVIEWER_CALLS: prior
					};
					const asked = Boolean(paid?.trim() || prior?.trim());
					const refuses = (laneKeysRefusal(env) ?? '').includes(RUN_ASKED_FOR);
					if (refuses) refused += 1;
					expect(refuses, JSON.stringify(env)).toBe(
						asked && liveExecTestMatch(env) === ONE_UNIT_SPEC
					);
				}
		// ⛔ NOT VACUOUS: four rows ask with no run folder — the agreement holds of refusals, not of nothing.
		expect(refused).toBe(4);
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

	it('~~a review is at most two calls~~ ⭐ a reviewer that answers but never in JSON makes two calls — the initial one and one repair — measured by driving the product’s validator with a reviewer that never answers in JSON', async () => {
		const prompts: string[] = [];
		const validator = createAgyReasoningReviewValidator({
			print: async (p) => {
				prompts.push(p);
				return 'not JSON, and never will be';
			},
			modelId: 'fixture-reviewer'
		});
		// The initial answer fails to parse, so a repair is asked for, and it fails too. ⭐ `P7-2b` — no call threw, so none
		// is run again: this arm is two calls, and the budget's four are the throwing arm's, measured below.
		await expect(validator.evaluate(REVIEW_SUBJECT, REVIEW_CONTEXT)).rejects.toThrow();
		expect(prompts, 'the calls one review made').toHaveLength(2);
		expect(prompts.length).toBeLessThanOrEqual(LANE_BUDGET.reviewerCallsPerTry);
	});

	it('⭐ P7-2b — a review is at most FOUR calls: each of its two calls, thrown short of devin’s bound, is run once more — measured by driving the product’s devin branch with a program that fails, answers in no JSON, fails, and answers in no JSON again', async () => {
		// ⭑ THE PRODUCT'S OWN BRANCH (`createFloorRegistry`), NOT A VALIDATOR BUILT HERE: whether a thrown call is run again
		// depends on the bound the validator knows for its tool, and the devin branch is where the product gives it one.
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance');
		const calls: number[] = [];
		const devin = async (_file: string, args: readonly string[]) => {
			calls.push(calls.length + 1);
			// Odd calls fail with no reply, short of the bound; even calls answer, never in JSON.
			if (calls.length % 2 === 1) throw new Error('devin exited with code 1: connection reset');
			const exportPath = args[args.indexOf('--export') + 1]!;
			writeFileSync(
				exportPath,
				JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance' } }] })
			);
			return { stdout: 'not JSON, and never will be' };
		};
		const registry = createFloorRegistry({ testMode: false, devinExec: devin });
		const plan = await runFloorAndPlanRecording(REVIEW_SUBJECT, REVIEW_CONTEXT, registry);
		const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
		expect(review?.disposition, 'a reply malformed after its repair still fails the review').toBe(
			'INCONCLUSIVE'
		);
		expect(calls, 'the calls one review made').toHaveLength(LANE_BUDGET.reviewerCallsPerTry);
		expect(LANE_BUDGET.reviewerCallsPerTry).toBe(4);
	});

	it('the Begin & Execute wait covers every try’s executor allowance and ~~both of its reviewer calls~~ ⭐ all four of its reviewer calls; the test adds its setup', () => {
		const { tries, executorCallMs, reviewerCallsPerTry, reviewerCallMs, setupMs } = LANE_BUDGET;
		expect(EXECUTE_TIMEOUT_MS).toBe(
			tries * (executorCallMs + reviewerCallsPerTry * reviewerCallMs)
		);
		// ⭐ `P7-2b` — 3 × (240 s + 4 × 240 s) = 3,600 s. It was 3 × (240 s + 2 × 240 s) = 2,160 s.
		expect(EXECUTE_TIMEOUT_MS).toBe(3_600_000);
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

// ⭐ `JAN-EXEC` Phase 7 `P7-2` (D4, D8) — THE PHASE 7 LANE'S ALLOWANCE AND LIMIT. Each figure the module restates is held to
// the product's own (the command limit, imported; the command deadline, through `scripts/phase7/runner-environment.ts`'s
// held mirror, since the product keeps it private), the derived ones to the budget above BY REFERENCE, read from the AST,
// and the limit and its reserve to the sponsor's ruling and the negative control's cap.
describe('⭐ P7-2 D4 — the Phase 7 lane waits an ALLOWANCE derived from the budget by reference, under its limit', () => {
	it('the reviewed commands are the product’s OBSERVED_PROCESS_RUN_LIMIT — the runs past it are no evidence (REG-F-517)', () => {
		expect(PHASE7_REVIEWED_COMMANDS).toBe(OBSERVED_PROCESS_RUN_LIMIT);
	});

	it('each command’s deadline is the one the product hands the runner, through the mirror held to its source', () => {
		expect(PHASE7_COMMAND_MS).toBe(EXECUTION_COMMAND_TIMEOUT_MS);
	});

	it('one phase’s allowance: the Begin & Execute wait, 32 reviews of four 240 s calls, 32 commands of 120 s — 38,160 s', () => {
		// 3,600 s + 32 × 4 × 240 s + 32 × 120 s = 3,600 s + 30,720 s + 3,840 s.
		expect(PHASE7_UNIT_ALLOWANCE_MS).toBe(38_160_000);
	});

	it('⛔ BY REFERENCE: the allowance and the test timeout read the budget’s own figures, and state no number', () => {
		const sf = parsed(LANE);
		expect(madeOf(sf, 'PHASE7_UNIT_ALLOWANCE_MS')).toEqual({
			reads: [
				'EXECUTE_TIMEOUT_MS',
				'PHASE7_REVIEWED_COMMANDS',
				'LANE_BUDGET.reviewerCallsPerTry',
				'LANE_BUDGET.reviewerCallMs',
				'PHASE7_REVIEWED_COMMANDS',
				'PHASE7_COMMAND_MS'
			],
			numbers: []
		});
		// ⭐ P7-6 B4 — and the run plan's rule's re-runs, each a phase's allowance again. ⭐⭐ `P76F-C` C8 — and every other act
		// the lane waits on, each by its own bound: the root's run and each phase's with what follows it, the limit's reads, the
		// rule's acts, the sign-offs, the final screenshot and read.
		expect(madeOf(sf, 'PHASE7_TEST_TIMEOUT_MS')).toEqual({
			reads: [
				'PHASE7_SETUP_MS',
				'PHASE7_PRESSED_UNITS',
				'PHASE7_UNIT_RUN_MS',
				'PHASE7_MODEL_UNITS',
				'PHASE7_INTROSPECT_MS',
				'PHASE7_MODEL_UNITS',
				'PHASE7_RERUNS_PER_PHASE',
				'PHASE7_RECOVERY_MS',
				'PHASE7_PRESSED_UNITS',
				'PHASE7_SIGN_OFF_UNIT_MS',
				'PHASE7_UI_MS',
				'PHASE7_INTROSPECT_MS'
			],
			numbers: []
		});
	});

	// ⭐⭐ `JAN-EXEC` P7-6 B4 (the fix round) — THE RUN PLAN'S RULE RE-RUNS A STOPPED PHASE AT MOST ONCE (`REG-D-105` (4): *"A
	// review that did not conclude is re-run once; refused work is re-run once"*), and each re-run is waited for up to one
	// phase's allowance (`phase7-operator.ts` `recover`). ⛔ The timeout counted each phase's Begin & Execute only, so a run
	// whose phases each took a re-run could reach the test's timeout with a phase still inside its allowance — and Playwright
	// kills the server mid-unit there (`REG-F-527`).
	it('⭐ B4 — the rule re-runs a stopped phase at most ONCE, as REG-D-105 (4) words it', () => {
		const register = readFileSync(REGISTER, 'utf8');
		const at = register.indexOf('### REG-D-105 ');
		const ruling = register.slice(at, register.indexOf('\n### ', at + 1));
		expect(ruling).toContain('A review that did not conclude is re-run once; refused work is re-run once');
		expect(PHASE7_RERUNS_PER_PHASE).toBe(1);
	});

	it('the model phases are §3.2’s four — each run by a model, the root by none', () => {
		expect(PHASE7_MODEL_UNITS).toBe(PHASE7_PHASES.length);
		expect(PHASE7_PHASES.map((t) => t.workDischarge)).toEqual(PHASE7_PHASES.map(() => 'MODEL'));
		expect(PHASE7_ROOT.workDischarge).toBe('HUMAN');
	});

	// ⭐ P7-6 B4 — WAS *"the setup and four phases’ allowance, 154,440 s"* (1,800 s + 4 × 38,160 s); each phase may now take a
	// re-run of its own (`REG-D-105` (4)), so the timeout covers four phases' Begin & Execute AND four re-runs.
	// ⛔⛔ `P76F-C` C8 — AND WAS *"307,080 s"* (1,800 s + 4 × 38,160 s + 4 × 1 × 38,160 s), which counted the five sign-offs (at
	// their bounds, 5 × 2 × 300 s = 3,000 s), the four abandonments (4 × 300 s) and the rule's fills, clicks and page loads
	// inside a 1,800 s setup allowance they alone exceed, and the root's Begin & Execute — bounded by a phase's allowance —
	// nowhere. ~~The timeout is now the worst case of the lane's own bounds, each act counted by the bound it waits.~~ ⛔ `P76F-D`
	// D4: overstated — the setup's acts are not counted by their bounds (their number is the PWA's, which `lane-config.ts`
	// cannot read; the archive's copying has no bound), and those bounds alone pass its 1,800 s allowance. The timeout is
	// every PHASE AND RECOVERY act at its bound, plus the setup's ALLOWANCE — which is not a worst case.
	// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (design B8) — AND WAS *"372,240 s"*: Record Assurance runs a declared review of each
	// of the unit's declared policies now (`REG-D-110` (3)), so each of the five sign-offs grows by the reviews of the most
	// policies one unit declares (`PHASE7_DECLARED_REVIEWS_MS`, 3,840 s): 372,240 s + 5 × 3,840 s = 391,440 s.
	// ⭐⭐ `E12F` F2, F3 — AND WAS *"391,440 s"*: each sign-off now reads the store for the limit before Record Assurance (300 s,
	// F2), and may take the rule's one re-run of the declared reviews that did not conclude (`PHASE7_DECLARED_RERUN_MS`,
	// 5,340 s, F3) — a paid act the timeout must count: 391,440 s + 5 × 5,640 s = 419,640 s.
	it('⛔ the spec’s test timeout — every phase and recovery act at its bound, plus the setup’s allowance, 419,640 s — stays under Node’s timer ceiling', () => {
		// ⚠ FIRST, so a figure pushed past the ceiling reddens here by this message, not by the arithmetic below it.
		expect(
			PHASE7_TEST_TIMEOUT_MS,
			'past 2,147,483,647 ms a Node timer fires at once, and Playwright would time the test out at its start'
		).toBeLessThanOrEqual(2_147_483_647);
		// 1,800 s + 5 × 38,940 s + 4 × 300 s + 4 × 1 × 41,280 s + 5 × 11,280 s + 120 s + 300 s
		// = 1,800 s + 194,700 s + 1,200 s + 165,120 s + 56,400 s + 420 s = 419,640 s (116.6 hours).
		// ~~5 × 5,640 s … = 391,440 s (108.7 hours)~~ — `E12F` F2, F3: each sign-off's limit read, and the rule's one declared re-run.
		// ~~5 × 1,800 s … = 372,240 s (103.4 hours)~~ — E2: each sign-off's Record Assurance now runs its unit's declared reviews.
		expect(
			PHASE7_TEST_TIMEOUT_MS,
			'the timeout is not every phase and recovery act at its bound plus the setup’s allowance: 1,800 s setup (an ' +
				'allowance, its own acts NOT counted by their bounds) + 5 × 38,940 s (the root’s run and each phase’s) + 4 × 300 s ' +
				'(the limit’s reads) + 4 × 1 × 41,280 s (a re-run, an abandonment and the rule’s UI acts for each phase) + ' +
				'5 × 11,280 s (the sign-offs, each Record Assurance its unit’s declared reviews, the limit’s read before it and ' +
				'the rule’s one re-run of the declared reviews) + 120 s + 300 s (the final screenshot and read)'
		).toBe(419_640_000);
	});

	// ⭐⭐ `P76F-C` C8 — EACH TERM, AT ITS BOUNDS: the arithmetic the timeout's comment states, held term by term, so a bound
	// that moves reddens the term it moved, not only the total.
	it('⭐ C8 — each counted term, every phase and recovery act at its bound', () => {
		// The overview shown afresh: the navigation, the hydration wait, the tab's click.
		expect(PHASE7_SHOW_OVERVIEW_MS).toBe(3 * PHASE7_UI_MS);
		// One Begin & Execute and what follows it: the press, the overview again, the store read, the screenshot.
		expect(PHASE7_UNIT_RUN_MS).toBe(PHASE7_UNIT_ALLOWANCE_MS + 360_000 + 300_000 + 120_000);
		expect(PHASE7_UNIT_RUN_MS).toBe(38_940_000);
		// The rule on one stopped phase: the re-run (39,720 s) and the abandonment that may follow it (1,560 s).
		expect(PHASE7_RECOVERY_MS).toBe(39_720_000 + 1_560_000);
		// One unit's sign-off: the overview, then two acts, each its row's wait, its press and the store read after —
		// ⭐ E2 (design B8): and Record Assurance's declared reviews, four policies' of four 240 s calls each.
		// ⭐⭐ `E12F` F2, F3 — and the store read for the limit before it, and the rule's one re-run of the declared reviews that
		// did not conclude: the overview again, the row's offer, the limit's read, the fill, the press (Record Assurance's
		// bound) and the store read after — 360 + 120 + 300 + 120 + 4,140 + 300 = 5,340 s.
		expect(PHASE7_DECLARED_RERUN_MS).toBe(360_000 + 120_000 + 300_000 + 120_000 + 4_140_000 + 300_000);
		expect(PHASE7_DECLARED_RERUN_MS).toBe(5_340_000);
		expect(PHASE7_SIGN_OFF_UNIT_MS).toBe(
			360_000 + 2 * (120_000 + 300_000 + 300_000) + 4 * 4 * 240_000 + 300_000 + PHASE7_DECLARED_RERUN_MS
		);
		expect(PHASE7_SIGN_OFF_UNIT_MS).toBe(11_280_000);
		// The units pressed and signed off: the root, and §3.2's four phases.
		expect(PHASE7_PRESSED_UNITS).toBe(PHASE7_PHASES.length + 1);
		// ⛔ The bounds the acts wait are these very figures: the operator names lane-config's, never a copy of its own.
		expect([PHASE7_UI_MS, PHASE7_SIGN_OFF_MS, PHASE7_INTROSPECT_MS]).toEqual([
			OPERATOR_UI_MS,
			OPERATOR_SIGN_OFF_MS,
			OPERATOR_INTROSPECT_MS
		]);
		// ⭑ The sign-offs' own bounds alone pass the setup allowance they were said to fit inside: the finding, restated.
		expect(PHASE7_PRESSED_UNITS * 2 * PHASE7_SIGN_OFF_MS).toBeGreaterThan(PHASE7_SETUP_MS);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`DESIGN-phase-7-completion.md` B8: *"The sign-off's time bound grows to cover the
	// reviews"*; B1, `REG-D-110` (3): one review per declared policy). ⛔ Record Assurance called no model before E2, and its
	// press was bounded as a sign-off act (300 s); it now runs a declared review of each of the unit's policies, one after
	// another, each up to `reviewerCallsPerTry` calls of `reviewerCallMs`, so a sign-off whose reviews each stayed inside
	// their bound would have been abandoned at 300 s — the paid run's first unit's sign-off ending as unanswered.
	it('⭐⭐ E2 — Record Assurance is waited for up to its own act and a declared review of each of the most policies one §3.2 unit declares: 300 s + 4 × 4 × 240 s = 4,140 s', () => {
		// The most declared policies one unit carries, restated (this module imports nothing) and held to §3.2's PWA.
		expect(PHASE7_DECLARED_POLICIES_PER_UNIT).toBe(
			Math.max(...[...PHASE7_PHASES, PHASE7_ROOT].map((t) => t.policyIds.length))
		);
		expect(PHASE7_DECLARED_POLICIES_PER_UNIT, 'the design’s four (§3.2)').toBe(4);
		expect(PHASE7_DECLARED_REVIEWS_MS).toBe(4 * 4 * 240_000);
		expect(PHASE7_RECORD_ASSURANCE_MS).toBe(PHASE7_SIGN_OFF_MS + PHASE7_DECLARED_REVIEWS_MS);
		expect(PHASE7_RECORD_ASSURANCE_MS).toBe(4_140_000);
		// ⛔ BY REFERENCE: the reviews read the budget's own figures, and the sign-off counts them; no number is stated.
		const sf = parsed(LANE);
		expect(madeOf(sf, 'PHASE7_DECLARED_REVIEWS_MS')).toEqual({
			reads: [
				'PHASE7_DECLARED_POLICIES_PER_UNIT',
				'LANE_BUDGET.reviewerCallsPerTry',
				'LANE_BUDGET.reviewerCallMs'
			],
			numbers: []
		});
		expect(madeOf(sf, 'PHASE7_RECORD_ASSURANCE_MS')).toEqual({
			reads: ['PHASE7_SIGN_OFF_MS', 'PHASE7_DECLARED_REVIEWS_MS'],
			numbers: []
		});
		expect(madeOf(sf, 'PHASE7_SIGN_OFF_UNIT_MS').reads, 'the sign-off counts its declared reviews').toContain(
			'PHASE7_DECLARED_REVIEWS_MS'
		);
		// ⭐ `E12F` F3 — and the rule's re-run of them, by reference, its press Record Assurance's own bound.
		expect(madeOf(sf, 'PHASE7_SIGN_OFF_UNIT_MS').reads, 'the sign-off counts the declared re-run').toContain(
			'PHASE7_DECLARED_RERUN_MS'
		);
		expect(madeOf(sf, 'PHASE7_DECLARED_RERUN_MS')).toEqual({
			reads: [
				'PHASE7_SHOW_OVERVIEW_MS',
				'PHASE7_UI_MS',
				'PHASE7_INTROSPECT_MS',
				'PHASE7_UI_MS',
				'PHASE7_RECORD_ASSURANCE_MS',
				'PHASE7_INTROSPECT_MS'
			],
			numbers: []
		});
	});

	// ⭐⭐ R3-B F2 (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (15)) — HALF B'S SIGN-OFF BOUNDS ARE THE
	// ARITHMETIC ABOVE FOR THE UNIT'S OWN DECLARED POLICIES, restated as functions of the count: at §3.2's four they are the
	// figures above, so the two cannot part, and each policy more adds one review's bound wherever a review is waited for.
	it('⭐ R3-B F2 — half B’s sign-off bounds are the figures above for the unit’s own policies: equal to them at four, one review’s bound apart for each policy more', () => {
		const review = LANE_BUDGET.reviewerCallsPerTry * LANE_BUDGET.reviewerCallMs;
		const at = (policies: number) => [
			phase7DeclaredReviewsMs(policies),
			phase7RecordAssuranceMs(policies),
			phase7DeclaredRerunMs(policies),
			phase7SignOffUnitMs(policies)
		];
		expect(at(PHASE7_DECLARED_POLICIES_PER_UNIT), 'half B’s bounds at four are not half A’s').toEqual([
			PHASE7_DECLARED_REVIEWS_MS,
			PHASE7_RECORD_ASSURANCE_MS,
			PHASE7_DECLARED_RERUN_MS,
			PHASE7_SIGN_OFF_UNIT_MS
		]);
		// ⭑ A sign-off waits on its reviews twice: Record Assurance's, and the rule's one re-run of them.
		expect(at(5).map((ms, i) => ms - at(4)[i]!)).toEqual([review, review, review, 2 * review]);
		expect([phase7RecordAssuranceMs(0), phase7RecordAssuranceMs(5)]).toEqual([PHASE7_SIGN_OFF_MS, 5_100_000]);
	});

	// ⭐ `JAN-EXEC` P7-6R — THE LIMIT IS NOW `REG-D-105` (1)'s, which amends `REG-D-102` (4): *"Raise limit to 200"*. The test
	// reads the ruling in force; `REG-D-102`'s own sentence still states the limit it set, which the amendment replaced.
	// ⭐ `JAN-EXEC` Phase 7 completion programme, E3 (2026-10-11) — THE RULING IN FORCE IS NOW `REG-D-110` (1): the sponsor
	// chose *"Raise to about 450 (Recommended)"*, and its pointer holds the number the lane enforces, *"**The limit is 450
	// reviewer calls**"*, amending `REG-D-102` (4) again. ~~REG-D-108, which amends REG-D-102 (4) again~~ — superseded: its
	// 230 was P3's. The promise is unchanged: the lane's limit is the sponsor's, read from the register, never a copy.
	// ⭐ `JAN-EXEC` Phase 7 P5, package C (F2; 2026-10-18) — THE RULING IN FORCE IS NOW `REG-D-117` Q10, which raises `REG-D-110`
	// (1)'s limit: the sponsor chose *"Qualify High, then P5 (Recommended)"*, whose text read *"Through P6 the total is about
	// 580, so the limit rises to about 600."*, and its meaning says *"`REG-D-110` (1)'s limit becomes about 600"*. The number
	// is read from the sponsor's own chosen text, and its meaning must name the same; ~~REG-D-110's pointer, "**The limit is
	// 450 reviewer calls**"~~ — superseded: its 450 was P4's to P5's. The promise is unchanged.
	// ⭐ `JAN-EXEC` Phase 7 P6, package L (F1; 2026-10-22) — THE RULING IN FORCE IS NOW `REG-D-120` Q15, which raises `REG-D-110`
	// (1)'s limit again: the sponsor chose *"Raise to about 650 (Recommended)"*, and its meaning says *"`REG-D-110` (1)'s limit
	// becomes about 650"*. The number is read from the label the sponsor chose, and its meaning must name the same; ~~REG-D-117
	// Q10's chosen text, "the limit rises to about 600."~~ — superseded: its 600 was the qualification's, P5's re-run's and the
	// negative control's. The promise is unchanged.
	it('⭐ D8 — the paid limit is the sponsor’s, read from the ruling in force, REG-D-120 Q15, which raises REG-D-110 (1)’s', () => {
		const register = readFileSync(REGISTER, 'utf8');
		const entry = (id: string) => {
			const at = register.indexOf(`### ${id} `);
			return register.slice(at, register.indexOf('\n### ', at + 1));
		};
		expect(entry('REG-D-110'), 'REG-D-110 does not amend REG-D-102 (4)').toContain('(`REG-D-102` (4) amended)');
		const q15 = entry('REG-D-120')
			.split('\n- ')
			.find((item) => item.startsWith('**Q15.**'));
		expect(q15, 'REG-D-120 records no Q15').toBeDefined();
		const chosen = /the sponsor chose \*"Raise to about (\d+) \(Recommended\)"\*/.exec(q15!)?.[1];
		expect(chosen, 'the label the sponsor chose in REG-D-120 Q15 states no limit').toBeDefined();
		expect(q15, 'REG-D-120 Q15’s meaning does not raise REG-D-110 (1)’s limit to the number chosen').toContain(
			`\`REG-D-110\` (1)'s limit becomes about ${chosen}.`
		);
		expect(PHASE7_PAID_LIMIT, 'the lane’s limit is not the one the sponsor chose (REG-D-120 Q15)').toBe(Number(chosen));
	});

	it('⭐ D8 — the reserve is the negative control’s own cap on reviewer calls (P7-4e)', () => {
		expect(PHASE7_NEGATIVE_CONTROL_RESERVE).toBe(MAX_REVIEWER_CALLS);
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

/**
 * What the initializer of the variable `name` in `sf` is made of: each name and property path it reads, in order, and
 * each number it states. ⭐ `P7-2` (D4) — so "derived by reference" is read from the source, not inferred from a value.
 */
function madeOf(sf: ts.SourceFile, name: string): { reads: string[]; numbers: string[] } {
	const reads: string[] = [];
	const numbers: string[] = [];
	const read = (n: ts.Node): void => {
		if (ts.isNumericLiteral(n)) numbers.push(n.getText(sf));
		else if (ts.isPropertyAccessExpression(n)) reads.push(n.getText(sf));
		else if (ts.isIdentifier(n)) reads.push(n.text);
		else ts.forEachChild(n, read);
	};
	const find = (n: ts.Node): void => {
		if (
			ts.isVariableDeclaration(n) &&
			ts.isIdentifier(n.name) &&
			n.name.text === name &&
			n.initializer
		)
			read(n.initializer);
		else ts.forEachChild(n, find);
	};
	find(sf);
	return { reads, numbers };
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
				'PHASE7_PRIOR_CALLS_VARIABLE',
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

	// ⭐ `JAN-EXEC` Phase 7 `P7-2` (D10). Since `P7-2b` a reviewer call that throws is recorded `NO_RESPONSE`, carrying the
	// configured model ungraded, before the call that answers — so the spec's grade assertion read from the FIRST record
	// would fail a run whose review stood.
	// ⭐ `JAN-EXEC` Phase 7 P5, package C (F3; `REG-F-563`) — NOR A CALL WHOSE REPLY THE TOOL CUT AT THE MODEL'S OUTPUT-TOKEN
	// LIMIT: recorded REJECTED since package A, it answered nothing, and it carries the configured model ungraded whenever
	// devin's export named none. ⛔ The spec's filter passed it as an answer. Read by the product's own reader of the class
	// (`outputLimitOf`, `tools/output-limit.ts`), imported, never restated. ⚠ This holds the spec's SOURCE: the lane is paid
	// and its behaviour is not run here.
	it('⭐ P7-2 D10 — the spec reads its reviewer’s identity from the first ASSURANCE call that ANSWERED, never a NO_RESPONSE record ⭐ nor one cut at the output-token limit', () => {
		const sf = parsed(SPEC);
		expect(initializersOf(sf, 'reviewer')).toEqual(['answered[0]!.resolvedModel as Identity']);
		expect(initializersOf(sf, 'answered'), 'the spec takes a cut reply for an answer').toEqual([
			"assurance.filter((e) => e.disposition !== 'NO_RESPONSE' && outputLimitOf(e) === undefined)"
		]);
		expect(importsFrom(sf, '../src/lib/server/tools/output-limit'), 'the class is not read by the product’s reader').toEqual([
			'outputLimitOf'
		]);
		expect(assertionsOn(sf, 'answered.length')).toEqual(['toBeGreaterThanOrEqual(1)']);
		// ⭑ The field and the member it names are the contract's (`rph-contracts` `ModelExchange`), so neither can rot apart.
		expect(ModelExchangeSchema.shape.disposition.options).toContain('NO_RESPONSE');
	});

	// ⭐ `JAN-EXEC` Phase 7 `P7-2` (D8). P7-3a is this spec's paid run, and the Phase 7 run counts its calls only as the
	// operator gives them — its store sits under the temporary folder (`REG-F-526`), so the spec must say the count itself.
	it('⭐ P7-2 D8 — the spec prints and annotates the reviewer calls it spent: EVERY ASSURANCE exchange, a call that threw included', () => {
		const sf = parsed(SPEC);
		expect(initializersOf(sf, 'assurance')).toEqual([
			"exchanges.filter((e) => e.plane === 'ASSURANCE')"
		]);
		expect(annotationsOf(sf)['reviewer-calls'], 'the annotation the JSON report keeps').toBe(
			'String(assurance.length)'
		);
		expect(templatesStarting(sf, 'reviewer calls: '), 'the line the operator reads').toEqual([
			'assurance.length'
		]);
	});
});

/** Each annotation `sf` pushes — `{ type: '<literal>', description: … }` — its description as source text, by type. */
function annotationsOf(sf: ts.SourceFile): Record<string, string> {
	const out: Record<string, string> = {};
	const visit = (n: ts.Node): void => {
		if (ts.isObjectLiteralExpression(n)) {
			const prop = (name: string) =>
				n.properties.find(
					(p): p is ts.PropertyAssignment =>
						ts.isPropertyAssignment(p) && p.name.getText(sf) === name
				)?.initializer;
			const type = prop('type');
			const description = prop('description');
			if (type !== undefined && ts.isStringLiteral(type) && description !== undefined)
				out[type.text] = description.getText(sf).replace(/\s+/g, ' ');
		}
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

/** The first expression of every template in `sf` whose text begins with `head`, as source text. */
function templatesStarting(sf: ts.SourceFile, head: string): string[] {
	const out: string[] = [];
	const visit = (n: ts.Node): void => {
		if (ts.isTemplateExpression(n) && n.head.text.startsWith(head))
			out.push(n.templateSpans[0]!.expression.getText(sf));
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}
