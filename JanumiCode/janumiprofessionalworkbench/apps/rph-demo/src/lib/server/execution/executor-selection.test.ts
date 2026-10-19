// ⭐ `JAN-SELRES` RS-1 (D1, D3) — THE EXECUTOR SELECTOR'S FULL TABLE: mode × tool × model × program override.
//
// ⭑ THE ORACLE BELOW IS WRITTEN FROM THE DESIGN'S TABLE (D1, D3), NOT FROM THE SELECTOR, in the order the design asks:
// an unset tool is the stand-in in test mode and a refusal outside it; a tool the catalog refuses for EXECUTION is
// UNKNOWN; a catalogued EXECUTION tool with no executor adapter is UNWIRED; outside test mode the SELECTED tool's
// captured program override refuses, even `''`; and a missing `JPWB_EXECUTOR_MODEL` refuses Pi and agy alike. Every row
// is compared whole, so a selector that answered one limb from another limb's input reddens.
//
// ⭑ EVERY TOOL THAT DECLARES EXECUTION IS COVERED, read off the catalog rather than listed, and the oracle keys the
// override on the TOOL rather than on today's wiring: the day a devin executor is wired, the table demands that its
// `JPWB_DEVIN_BIN` refuse it — the rule is inherited, not remembered.
//
// ⭐ AND THE SUCCESSORS (design §4.5). `executorToolId()`, `executorModel()` and `model.ts`'s own `TEST_MODE` are gone;
// the assertions `model.test.ts` and `backing-tool.test.ts` made on them are restated below, each with equal or
// stronger content, and each says which one it succeeds.
//
// ⭐ `JAN-MHX` MH-3 (`DESIGN-multi-harness-executor.md` D31–D34; the sponsor's answers of 2026-10-18) — AND WHAT THE
// TABLE DOES NOT ASK, held below it: the executor's model against the reviewer's (`EXECUTOR_MODEL_IS_THE_REVIEWERS`,
// `EXECUTOR_MODEL_UNCLASSIFIED`), the effort (`EXECUTOR_EFFORT_NOT_TAKEN`, `EXECUTOR_EFFORT_UNSET`), the sponsor's
// defaults the guidance names and never applies, and `JPWB_CODEX_BIN`, captured. The table hands in no reviewer, so its
// rows compare nothing — the stand-in reviewer's case (roadmap MH-3, test 5).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectReviewer } from '../assurance/reviewer-selection.js';
import { BACKING_TOOLS } from '../tools/backing-tool.js';
import {
	EXECUTOR_GUIDANCE,
	executorEffortRefusal,
	executorRecordIdentity,
	executorRefusalMessage,
	selectExecutor,
	type ExecutorProgramOverrides,
	type ExecutorRefusalCode,
	type ExecutorSelection
} from './executor-selection.js';

const TOOLS: readonly (string | undefined)[] = [
	undefined,
	'',
	'   ',
	'agy',
	' agy ',
	'pi',
	'pi\n',
	'devin',
	'Agy',
	'nosuchtool',
	// ⭐ `JAN-MHX` MH-3 — a tool the sponsor named a default for, which the catalog does not know yet.
	'codex'
];
const MODELS: readonly {
	readonly name: string;
	readonly executor?: string;
	readonly judge?: string;
}[] = [
	{ name: 'no model' },
	{ name: 'the executor model', executor: 'fixture-executor' },
	{ name: 'the executor model, padded', executor: '  fixture-executor \n' },
	// ⛔ THE COLLISION ROW: only the REVIEWER's model set. The executor's model never falls back to it.
	{ name: 'the judge model only', judge: 'fixture-judge' },
	{ name: 'both models', executor: 'fixture-executor', judge: 'fixture-judge' },
	{ name: 'the executor model blank', executor: '  ', judge: 'fixture-judge' }
];
/** ⭑ `''` is a SET override — an empty program name, which the adapter would run — never an unset one. */
const OVERRIDES: readonly {
	readonly name: string;
	readonly overrides: ExecutorProgramOverrides;
}[] = [
	{ name: 'no override', overrides: { agy: undefined, devin: undefined, codex: undefined } },
	{
		name: 'JPWB_AGY_BIN set',
		overrides: { agy: 'C:/stand-in/agy.exe', devin: undefined, codex: undefined }
	},
	{
		name: 'JPWB_DEVIN_BIN set',
		overrides: { agy: undefined, devin: 'C:/stand-in/devin.exe', codex: undefined }
	},
	{ name: 'JPWB_AGY_BIN empty', overrides: { agy: '', devin: undefined, codex: undefined } },
	{ name: 'JPWB_DEVIN_BIN empty', overrides: { agy: undefined, devin: '', codex: undefined } },
	{
		name: 'both set',
		overrides: { agy: 'C:/stand-in/agy.exe', devin: 'C:/stand-in/devin.exe', codex: undefined }
	},
	// ⭐ `JAN-MHX` MH-3 (D34) — Codex's override: no Codex adapter is wired, so it refuses no row of this table.
	{
		name: 'JPWB_CODEX_BIN set',
		overrides: { agy: undefined, devin: undefined, codex: 'stand-in/codex.exe' }
	}
];

/** The tools the catalog admits for EXECUTION — read off it, so a tool added there is in the table here. */
const EXECUTION_TOOLS = BACKING_TOOLS.filter((t) => t.roles.includes('EXECUTION')).map(
	(t) => t.toolId
);
/** D1, RESTATED: the executor adapters this host has, and what each opens. */
const WIRED: Readonly<Record<string, 'AGY' | 'PI'>> = { agy: 'AGY', pi: 'PI' };
/** D3, RESTATED: the override each tool's adapter captures — per TOOL, whether or not it is wired today. */
const OVERRIDE_OF: Readonly<Record<string, keyof ExecutorProgramOverrides>> = {
	agy: 'agy',
	devin: 'devin',
	codex: 'codex'
};
/**
 * ⭐ `JAN-MHX` MH-3 (D31; the sponsor's answers of 2026-10-18, S1–S4), RESTATED: the model the guidance names for each
 * chosen tool that has a sponsor's default. Pi has none.
 */
const DEFAULT_NAMED: Readonly<Record<string, string>> = {
	agy: 'gemini-4-argon-high',
	devin: 'deepseek-v4-1-flash-max',
	codex: 'gpt-5.6-sol, at high effort',
	claude: 'claude-opus-5-5, at max effort',
	muse: 'muse-wonder-1.0, at high effort'
};
/** What a refusal of `tool` (trimmed) must carry as guidance: the shared guidance, then the chosen tool's default. */
function expectGuidanceFor(guidance: string, tool: string | undefined): void {
	const named = tool === undefined ? undefined : DEFAULT_NAMED[tool];
	if (named === undefined) {
		expect(guidance).toBe(EXECUTOR_GUIDANCE);
		return;
	}
	expect(guidance.startsWith(`${EXECUTOR_GUIDANCE} `), 'the shared guidance comes first').toBe(
		true
	);
	const sentence = guidance.slice(EXECUTOR_GUIDANCE.length);
	expect(sentence).toContain(`The sponsor’s choice of model for ${tool} is ${named}`);
	expect(sentence).toContain('named here and never applied');
}

type Expected =
	| { readonly kind: 'STAND_IN' }
	| { readonly kind: 'AGY' | 'PI'; readonly modelId: string }
	| {
			readonly kind: 'REFUSED';
			readonly code: ExecutorRefusalCode;
			readonly toolId: string | undefined;
	  };

/** D1 and D3, restated, in the design's order. ⚠ A refused override outranks a missing model. */
function oracle(
	testMode: boolean,
	tool: string | undefined,
	executorModel: string | undefined,
	overrides: ExecutorProgramOverrides
): Expected {
	const t = tool?.trim() ? tool.trim() : undefined;
	const m = executorModel?.trim() ? executorModel.trim() : undefined;
	if (t === undefined)
		return testMode
			? { kind: 'STAND_IN' }
			: { kind: 'REFUSED', code: 'EXECUTOR_TOOL_UNSET', toolId: undefined };
	if (!EXECUTION_TOOLS.includes(t))
		return { kind: 'REFUSED', code: 'EXECUTOR_TOOL_UNKNOWN', toolId: t };
	const opens = WIRED[t];
	if (opens === undefined) return { kind: 'REFUSED', code: 'EXECUTOR_TOOL_UNWIRED', toolId: t };
	const own = OVERRIDE_OF[t];
	if (!testMode && own !== undefined && overrides[own] !== undefined)
		return { kind: 'REFUSED', code: 'EXECUTOR_PROGRAM_OVERRIDDEN', toolId: t };
	if (m === undefined) return { kind: 'REFUSED', code: 'EXECUTOR_MODEL_UNSET', toolId: t };
	return { kind: opens, modelId: m };
}

/** The selection, minus the prose — the shape the oracle predicts. */
function shape(s: ExecutorSelection): Expected {
	if (s.kind === 'REFUSED') return { kind: 'REFUSED', code: s.code, toolId: s.toolId };
	if (s.kind === 'STAND_IN') return { kind: 'STAND_IN' };
	// ⭐ `JAN-EXEC` Phase 8 — the table sets no JPWB_REPLAY, so a REPLAY answer here is the selector reading the switch from
	// somewhere it was not handed (`replay/replay-selection.test.ts` holds the switch's own table).
	if (s.kind === 'REPLAY') throw new Error('the table sets no JPWB_REPLAY, and the selector answered REPLAY');
	// ⭐ `JAN-MHX` MH-1 — nothing selects the `CLI` kind until a driver's package wires its tool, so it is an answer no row
	// of this table may get.
	if (s.kind === 'CLI') throw new Error('no tool is wired to the CLI kind yet, and the selector answered CLI');
	return { kind: s.kind, modelId: s.modelId };
}

const NO_OVERRIDES: ExecutorProgramOverrides = {
	agy: undefined,
	devin: undefined,
	codex: undefined
};

describe('⭐ the selector answers the design’s table — every mode, tool, model and program override', () => {
	it('⭑ arrangement — the catalog’s EXECUTION tools are agy, pi and devin, and the table names every one', () => {
		// ⚠ WITHOUT THIS the table below could pass over a catalog that lost a tool, and its rows for that tool would be
		// testing the UNKNOWN limb while their names said otherwise.
		expect([...EXECUTION_TOOLS].sort()).toEqual(['agy', 'devin', 'pi']);
		for (const t of EXECUTION_TOOLS) expect(TOOLS, `the table names ${t}`).toContain(t);
	});

	for (const testMode of [true, false])
		for (const tool of TOOLS)
			for (const m of MODELS)
				for (const o of OVERRIDES)
					it(`${testMode ? 'test mode' : 'server mode'} · tool ${JSON.stringify(tool)} · ${m.name} · ${o.name}`, () => {
						const env: Record<string, string | undefined> = {
							JPWB_EXECUTOR: tool,
							JPWB_EXECUTOR_MODEL: m.executor,
							JPWB_JUDGE_MODEL: m.judge
						};
						const got = selectExecutor({ testMode, env, overrides: o.overrides });
						expect(shape(got)).toEqual(oracle(testMode, tool, m.executor, o.overrides));
						if (got.kind === 'REFUSED') expectGuidanceFor(got.guidance, tool?.trim() || undefined);
					});
});

describe('⛔ D3 — only the SELECTED tool’s captured override refuses, and only outside test mode', () => {
	it('⭐ a PI executor on a host with a stray JPWB_AGY_BIN is ADMITTED — and so is its devin reviewer (SR2-M20’s host)', () => {
		// ⭑ THE HOST `SR2-M20` NOW NAMES AS WHO RELIES: Pi executing, devin reviewing, and an `agy` program override left
		// set. agy runs neither role, so its override refuses nothing on either side. `JAN-SELREV` D7 pins the reviewer
		// half (`floor-registry.test.ts`); this pins the executor half, and asks the reviewer selector the same question
		// on the same host so the two halves are one arrangement.
		const stray: ExecutorProgramOverrides = {
			agy: 'C:/stand-in/agy.exe',
			devin: undefined,
			codex: undefined
		};
		const host = {
			JPWB_EXECUTOR: 'pi',
			JPWB_EXECUTOR_MODEL: 'fixture-pi-model',
			JPWB_ASSURANCE_TOOL: 'devin',
			JPWB_ASSURANCE_MODEL: 'fixture-assurance-model'
		};
		expect(selectExecutor({ testMode: false, env: host, overrides: stray })).toEqual({
			kind: 'PI',
			modelId: 'fixture-pi-model'
		});
		expect(selectReviewer({ testMode: false, env: host, overrides: stray })).toEqual({
			kind: 'DEVIN',
			modelId: 'fixture-assurance-model'
		});
		// …and an EMPTY stray override is still not agy's to refuse on a Pi host.
		expect(
			selectExecutor({
				testMode: false,
				env: host,
				overrides: { agy: '', devin: '', codex: undefined }
			})
		).toEqual({ kind: 'PI', modelId: 'fixture-pi-model' });
	});

	for (const program of ['C:/stand-in/agy.exe', ''])
		it(`agy, JPWB_AGY_BIN=${JSON.stringify(program)}: refused outside test mode, naming the variable, the program and REG-F-459 — honoured in test mode`, () => {
			const env = { JPWB_EXECUTOR: 'agy', JPWB_EXECUTOR_MODEL: 'fixture-executor' };
			const overrides = { agy: program, devin: undefined, codex: undefined };
			const got = selectExecutor({ testMode: false, env, overrides });
			expect(got.kind === 'REFUSED' && got.code).toBe('EXECUTOR_PROGRAM_OVERRIDDEN');
			const reason = got.kind === 'REFUSED' ? got.reason : '';
			expect(reason).toContain(`JPWB_AGY_BIN=${JSON.stringify(program)}`);
			expect(reason).toContain("the product’s own 'agy' program");
			expect(reason).toContain('REG-F-459');
			expect(reason).toContain('even when it is empty');
			// ⭑ In test mode an override is the tests' own, and it is run.
			expect(selectExecutor({ testMode: true, env, overrides })).toEqual({
				kind: 'AGY',
				modelId: 'fixture-executor'
			});
		});

	it('⭑ the program is refused BEFORE the model is asked about — an overridden agy with no model is refused for its program', () => {
		expect(
			shape(
				selectExecutor({
					testMode: false,
					env: { JPWB_EXECUTOR: 'agy' },
					overrides: { agy: 'C:/stand-in/agy.exe', devin: undefined, codex: undefined }
				})
			)
		).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_PROGRAM_OVERRIDDEN', toolId: 'agy' });
	});

	it('⭑ an UNWIRED tool is refused as unwired BEFORE its override is asked about — devin with JPWB_DEVIN_BIN set', () => {
		expect(
			shape(
				selectExecutor({
					testMode: false,
					env: { JPWB_EXECUTOR: 'devin', JPWB_EXECUTOR_MODEL: 'fixture-executor' },
					overrides: { agy: undefined, devin: 'C:/stand-in/devin.exe', codex: undefined }
				})
			)
		).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_TOOL_UNWIRED', toolId: 'devin' });
	});
});

describe('what a refusal SAYS — the reason names the fault, and every one carries the same guidance', () => {
	// ⭐ SUCCESSOR of `model.test.ts:40-49` (unset tool throws `/JPWB_EXECUTOR is not set/`) and of
	// `backing-tool.test.ts:130-139` (`executorToolId` refuses when unset) — the same text, now an answer, not a throw.
	it('⛔ server mode, nothing configured → EXECUTOR_TOOL_UNSET: "JPWB_EXECUTOR is not set", no default', () => {
		const got = selectExecutor({ testMode: false, env: {}, overrides: NO_OVERRIDES });
		expect(shape(got)).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_TOOL_UNSET', toolId: undefined });
		const reason = got.kind === 'REFUSED' ? got.reason : '';
		expect(reason).toMatch(/JPWB_EXECUTOR is not set/);
		expect(reason).toContain('there is no application default');
	});

	// ⭐ SUCCESSOR of `model.test.ts:51-54` (an unknown tool is refused, not substituted).
	it('⛔ an unknown tool → EXECUTOR_TOOL_UNKNOWN, carrying the catalog’s own refusal', () => {
		const got = selectExecutor({
			testMode: false,
			env: { JPWB_EXECUTOR: 'nosuchtool', JPWB_EXECUTOR_MODEL: 'fixture-executor' },
			overrides: NO_OVERRIDES
		});
		expect(shape(got)).toEqual({
			kind: 'REFUSED',
			code: 'EXECUTOR_TOOL_UNKNOWN',
			toolId: 'nosuchtool'
		});
		expect(got.kind === 'REFUSED' && got.reason).toMatch(/Unknown backing tool 'nosuchtool'/);
	});

	it('⛔ and that reason offers only the WIRED tools — never devin, which the next refusal forbids (REG-F-460’s general form)', () => {
		// ⭑ THE CATALOG'S REFUSAL LISTS THE CATALOG — "This host can drive: agy, pi, devin" — and this reason is printed
		// beside the guidance. An operator who followed it to `devin` would be refused again, as UNWIRED: the steer D1
		// took out of the guidance, back in the reason (`JAN-SELRES` RS-1's verification). The catalog's verdict and its
		// REG-D-052 sentence stay; the list is the one the selector admits.
		const got = selectExecutor({
			testMode: false,
			env: { JPWB_EXECUTOR: 'nosuchtool', JPWB_EXECUTOR_MODEL: 'fixture-executor' },
			overrides: NO_OVERRIDES
		});
		const reason = got.kind === 'REFUSED' ? got.reason : '';
		expect(reason).toMatch(/Unknown backing tool 'nosuchtool'\./);
		expect(reason, 'the reason offers devin as a tool to set').not.toMatch(/devin/);
		expect(reason).not.toContain('This host can drive:');
		expect(reason).toContain('This host has an executor adapter for: agy, pi.');
		expect(reason).toContain('the fiction REG-D-052 forbids');
		// ⭑ AND THE TOOLS IT OFFERS ARE EXACTLY THE ONES ADMITTED — each one it names, set with a model, is selected.
		const offered = /executor adapter for: ([^.]*)\./.exec(reason)?.[1]?.split(', ') ?? [];
		expect(offered).toEqual(['agy', 'pi']);
		for (const tool of offered)
			expect(
				selectExecutor({
					testMode: false,
					env: { JPWB_EXECUTOR: tool, JPWB_EXECUTOR_MODEL: 'fixture-executor' },
					overrides: NO_OVERRIDES
				}).kind,
				`the reason offers '${tool}', which the selector refuses`
			).not.toBe('REFUSED');
	});

	it('⛔ devin → EXECUTOR_TOOL_UNWIRED: declared for EXECUTION, no executor adapter on this host', () => {
		const got = selectExecutor({
			testMode: true,
			env: { JPWB_EXECUTOR: 'devin', JPWB_EXECUTOR_MODEL: 'fixture-executor' }
		});
		expect(got.kind === 'REFUSED' && got.reason).toContain(
			"The executing tool 'devin' (JPWB_EXECUTOR) declares the EXECUTION role, but no executor adapter is wired"
		);
	});

	// ⭐ SUCCESSOR of `backing-tool.test.ts:116-128` (`executorModel` refuses when unset, and names the fallback it
	// refuses) — STRONGER: for agy AND Pi, in both modes, with the JUDGE model configured beside it.
	for (const testMode of [true, false])
		for (const tool of ['agy', 'pi'])
			it(`⛔ ${tool}, ${testMode ? 'test' : 'server'} mode, JPWB_JUDGE_MODEL set and no executor model → EXECUTOR_MODEL_UNSET, never the judge’s`, () => {
				const got = selectExecutor({
					testMode,
					env: { JPWB_EXECUTOR: tool, JPWB_JUDGE_MODEL: 'fixture-judge' },
					overrides: NO_OVERRIDES
				});
				expect(shape(got)).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_MODEL_UNSET', toolId: tool });
				const reason = got.kind === 'REFUSED' ? got.reason : '';
				expect(reason).toMatch(/JPWB_EXECUTOR_MODEL is not set/);
				// ⭑ The refusal must name the fallback it is refusing to make, or a future reader reinstates it.
				expect(reason).toMatch(/does NOT fall back to JPWB_JUDGE_MODEL/);
				expect(reason).not.toContain('fixture-judge');
			});

	it('⭑ the whole refusal is the reason, then the guidance', () => {
		const got = selectExecutor({ testMode: false, env: {}, overrides: NO_OVERRIDES });
		if (got.kind !== 'REFUSED')
			throw new Error('arrangement: an unset tool outside test mode is refused');
		expect(executorRefusalMessage(got)).toBe(`${got.reason} ${EXECUTOR_GUIDANCE}`);
	});
});

describe('⭐ D1 — the guidance names the WIRED tools, both variables, no default, and ASR-13 with the selected reviewer', () => {
	// ⭐ SUCCESSOR of `backing-tool.test.ts:130-139`'s `/agy, pi, devin/` — ⚠ A DELIBERATE CHANGE OF WHAT IS PINNED, made
	// stronger: that refusal listed the CATALOG, steering an operator to `devin`, which the next refusal forbids.
	it('⛔ it lists the wired tools — agy, pi — and NOT devin', () => {
		expect(EXECUTOR_GUIDANCE).toMatch(/agy, pi/);
		expect(EXECUTOR_GUIDANCE).not.toMatch(/devin, /);
		expect(EXECUTOR_GUIDANCE).not.toMatch(/\bpi, devin\b/);
		expect(EXECUTOR_GUIDANCE).not.toMatch(/'devin'|JPWB_EXECUTOR=devin/);
	});

	it('⭑ and the tools it lists are EXACTLY the ones the selector admits — the list is the table it dispatches on', () => {
		const admitted = EXECUTION_TOOLS.filter(
			(t) =>
				selectExecutor({
					testMode: false,
					env: { JPWB_EXECUTOR: t, JPWB_EXECUTOR_MODEL: 'fixture-executor' },
					overrides: NO_OVERRIDES
				}).kind !== 'REFUSED'
		);
		expect(admitted.sort()).toEqual(['agy', 'pi']);
		expect(EXECUTOR_GUIDANCE).toContain(`for: ${['agy', 'pi'].join(', ')} —`);
	});

	it('names both variables, and that neither has a default', () => {
		expect(EXECUTOR_GUIDANCE).toContain('Set JPWB_EXECUTOR to the tool that executes work units');
		expect(EXECUTOR_GUIDANCE).toContain('JPWB_EXECUTOR_MODEL to the model that tool runs');
		expect(EXECUTOR_GUIDANCE).toContain('Neither has a default');
		expect(EXECUTOR_GUIDANCE).toContain('REG-D-052');
	});

	it('names ASR-13: the executor’s model may not be the reviewer’s under any provider, spelling or effort variant', () => {
		expect(EXECUTOR_GUIDANCE).toContain('Independence (ASR-13)');
		expect(EXECUTOR_GUIDANCE).toContain(
			'may not be the reviewing model under any provider, spelling or effort variant'
		);
	});

	it('names the GLM-5.3 Flash rule the reviewer’s guidance states, with the selection it follows from', () => {
		expect(EXECUTOR_GUIDANCE).toContain(
			'The selected reviewer (REG-D-084) is devin with glm-5-3-flash-max'
		);
		expect(EXECUTOR_GUIDANCE).toContain(
			'may not run a GLM-5.3 Flash model under any provider or spelling'
		);
	});
});

describe('the selector reads the environment it is handed, and the mode it is told', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('⭑ an explicit environment is the whole input — the process’s is not consulted', () => {
		vi.stubEnv('JPWB_EXECUTOR', 'agy');
		vi.stubEnv('JPWB_EXECUTOR_MODEL', 'from-the-process');
		expect(selectExecutor({ testMode: true, env: {} })).toEqual({ kind: 'STAND_IN' });
		// ⛔ THE MODEL AS WELL AS THE TOOL. Both resolvers default their parameter to the process's variable when handed
		// `undefined`, so without `?? ''` an explicit environment naming a tool and no model would take its model from
		// the process. The table above cannot see it: the gate's setup file removes both variables before it runs.
		expect(
			shape(
				selectExecutor({ testMode: false, env: { JPWB_EXECUTOR: 'agy' }, overrides: NO_OVERRIDES })
			),
			'agy’s model was read from the process, not from the environment handed in'
		).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_MODEL_UNSET', toolId: 'agy' });
		expect(
			shape(selectExecutor({ testMode: false, env: {}, overrides: NO_OVERRIDES })),
			'the tool was read from the process, not from the environment handed in'
		).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_TOOL_UNSET', toolId: undefined });
	});

	it('⭑ and the process’s environment when none is handed — what beginExecute reads', () => {
		vi.stubEnv('JPWB_EXECUTOR', 'agy');
		vi.stubEnv('JPWB_EXECUTOR_MODEL', 'from-the-process');
		expect(selectExecutor({ testMode: true })).toEqual({
			kind: 'AGY',
			modelId: 'from-the-process'
		});
	});

	// ⭐ SUCCESSOR of `model.test.ts:134-142` (configuring the executor in test mode selects a real tool, not the fixture).
	it('⭑ in test mode, naming agy with a model selects AGY — not the stand-in — with the assurance switch unset', () => {
		expect(
			selectExecutor({
				testMode: true,
				env: { JPWB_EXECUTOR: 'agy', JPWB_EXECUTOR_MODEL: 'fixture-executor' },
				overrides: NO_OVERRIDES
			})
		).toEqual({ kind: 'AGY', modelId: 'fixture-executor' });
	});

	// ⭐ SUCCESSOR of `model.test.ts:144-152` (the ASSURANCE switch alone no longer makes the executor live).
	it('⛔ in test mode, JPWB_ASSESSOR alone is still the stand-in — the retired switch borrows nothing', () => {
		expect(selectExecutor({ testMode: true, env: { JPWB_ASSESSOR: 'agy' } })).toEqual({
			kind: 'STAND_IN'
		});
	});

	it('⛔ the stand-in is TEST mode’s alone — the same empty environment outside it is refused', () => {
		// ⭑ THE CONTROL `model.ts`'s own `TEST_MODE` made impossible to write: the mode is the caller's, handed in.
		expect(selectExecutor({ testMode: true, env: {} })).toEqual({ kind: 'STAND_IN' });
		expect(selectExecutor({ testMode: false, env: {}, overrides: NO_OVERRIDES }).kind).toBe(
			'REFUSED'
		);
	});
});

describe('⭐ D3 — the overrides the selector acts on are the ones the ADAPTERS captured when they loaded', () => {
	// ⛔ THE ADAPTERS READ THEIR OVERRIDE ONCE, AT LOAD, and run whatever it named for the life of the process — so the
	// selector must refuse what was CAPTURED. A check of the environment at dispatch would pass a server whose override
	// was unset after it started, and whose adapter still runs the replacement.
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	/** The agy adapter and the selector, loaded afresh with `JPWB_AGY_BIN` as given, then the variable removed again. */
	async function loadedWith(agyBin: string | undefined, codexBin?: string) {
		vi.resetModules();
		vi.stubEnv('JPWB_AGY_BIN', agyBin);
		vi.stubEnv('JPWB_DEVIN_BIN', undefined);
		vi.stubEnv('JPWB_CODEX_BIN', codexBin);
		const loaded = await import('./executor-selection.js');
		vi.stubEnv('JPWB_AGY_BIN', undefined);
		vi.stubEnv('JPWB_CODEX_BIN', undefined);
		return loaded;
	}
	const AGY_HOST = { JPWB_EXECUTOR: 'agy', JPWB_EXECUTOR_MODEL: 'fixture-executor' };

	it('⛔ with no overrides handed in, a captured JPWB_AGY_BIN refuses an agy executor — though the variable is gone now', async () => {
		const selection = await loadedWith('C:/stand-in/agy.exe');
		expect(
			process.env.JPWB_AGY_BIN,
			'the arrangement removed the variable after the load'
		).toBeUndefined();
		const got = selection.selectExecutor({ testMode: false, env: AGY_HOST });
		expect(got.kind === 'REFUSED' && got.code).toBe('EXECUTOR_PROGRAM_OVERRIDDEN');
		expect(got.kind === 'REFUSED' && got.reason).toContain('JPWB_AGY_BIN="C:/stand-in/agy.exe"');
	});

	it('⭑ CONTROL — a captured JPWB_AGY_BIN refuses no Pi executor, and nothing captured refuses no agy executor', async () => {
		const agyOnly = await loadedWith('C:/stand-in/agy.exe');
		expect(
			agyOnly.selectExecutor({
				testMode: false,
				env: { JPWB_EXECUTOR: 'pi', JPWB_EXECUTOR_MODEL: 'fixture-pi-model' }
			})
		).toEqual({ kind: 'PI', modelId: 'fixture-pi-model' });
		const none = await loadedWith(undefined);
		expect(none.selectExecutor({ testMode: false, env: AGY_HOST })).toEqual({
			kind: 'AGY',
			modelId: 'fixture-executor'
		});
	});

	it('⛔ `JAN-MHX` MH-3 (D34, D39) — JPWB_CODEX_BIN is CAPTURED when the selector loads: beside a replay it refuses, though the variable is gone now', async () => {
		// ⭑ RED FIRST: nothing captured `JPWB_CODEX_BIN`, so the replay answered REPLAY beside a Codex program override.
		// No Codex adapter is wired, so the replay is the one place the capture refuses today; the day one is, the table
		// above (`OVERRIDE_OF`) holds its tool to the same refusal as agy's.
		const replay = { JPWB_REPLAY: 'recordings/one-unit' };
		const captured = await loadedWith(undefined, 'stand-in/codex.exe');
		expect(
			process.env.JPWB_CODEX_BIN,
			'the arrangement removed the variable after the load'
		).toBeUndefined();
		const got = captured.selectExecutor({ testMode: true, env: replay });
		expect(got.kind === 'REFUSED' && got.code).toBe('EXECUTOR_REPLAY_BESIDE_A_LIVE_SELECTION');
		expect(got.kind === 'REFUSED' && got.reason).toContain(
			'JPWB_REPLAY is set and so is JPWB_CODEX_BIN'
		);
		// ⭑ CONTROL — with nothing captured, the same replay is admitted.
		const none = await loadedWith(undefined);
		expect(none.selectExecutor({ testMode: true, env: replay })).toEqual({
			kind: 'REPLAY',
			recordingDir: 'recordings/one-unit'
		});
	});
});

describe('⭐ D4 — the record’s fallback identity is the selection’s', () => {
	it('agy and Pi name their model and their TOOL; the stand-in names neither', () => {
		expect(executorRecordIdentity({ kind: 'AGY', modelId: 'fixture-x' })).toEqual({
			modelId: 'fixture-x',
			providerId: 'agy'
		});
		expect(executorRecordIdentity({ kind: 'PI', modelId: 'fixture-y' })).toEqual({
			modelId: 'fixture-y',
			providerId: 'pi'
		});
		expect(executorRecordIdentity({ kind: 'STAND_IN' })).toEqual({
			modelId: 'unresolved',
			providerId: 'unresolved'
		});
	});

	it('⛔ `JAN-MHX` MH-1 (M2; D30, D35) — a CLI selection names its TOOL as the provider, never pi', () => {
		// ⭑ RED FIRST: before the `CLI` arm, the provider was `selection.kind === 'AGY' ? 'agy' : 'pi'`, so every tool a CLI
		// executor ran would have been recorded as Pi's. Two tools, so a constant `'agy'` cannot pass either.
		expect(executorRecordIdentity({ kind: 'CLI', toolId: 'agy', modelId: 'fixture-z' })).toEqual({
			modelId: 'fixture-z',
			providerId: 'agy'
		});
		expect(executorRecordIdentity({ kind: 'CLI', toolId: 'devin', modelId: 'fixture-w' })).toEqual({
			modelId: 'fixture-w',
			providerId: 'devin'
		});
	});
});

/** ⭐ `JAN-MHX` MH-3 — the selected reviewer (`REG-D-084`), as the preflight hands it on. */
const GLM_REVIEWER = { toolId: 'devin', modelId: 'glm-5-3-flash-max' } as const;
/** An executor `tool` on `model`, outside test mode, with no program override, beside `reviewer`. */
const executing = (
	tool: string,
	model: string,
	reviewer?: { readonly toolId: string; readonly modelId: string },
	extra: Readonly<Record<string, string>> = {}
) =>
	selectExecutor({
		testMode: false,
		env: { JPWB_EXECUTOR: tool, JPWB_EXECUTOR_MODEL: model, ...extra },
		overrides: NO_OVERRIDES,
		reviewer
	});
const reasonOf = (s: ExecutorSelection): string => (s.kind === 'REFUSED' ? s.reason : '');

describe('⭐ `JAN-MHX` MH-3 (D33) — the executor’s model may not be the reviewer’s, by spelling or by family, and a model the table does not list is refused', () => {
	it('⛔ test 1 — agy on glm-5-3-flash-max, beside devin reviewing on glm-5-3-flash-max → EXECUTOR_MODEL_IS_THE_REVIEWERS', () => {
		// ⭑ RED FIRST: the selector asked nothing about the reviewer, and answered `{ kind: 'AGY', modelId }`.
		const got = executing('agy', 'glm-5-3-flash-max', GLM_REVIEWER);
		expect(shape(got)).toEqual({
			kind: 'REFUSED',
			code: 'EXECUTOR_MODEL_IS_THE_REVIEWERS',
			toolId: 'agy'
		});
		expect(reasonOf(got)).toContain(
			"The executing tool 'agy' would run glm-5-3-flash-max, the model the reviewer (devin) runs"
		);
		expect(reasonOf(got)).toContain('DIFFERENT_MODEL');
		// ⭑ The model is read as the selector reads it everywhere: trimmed.
		expect(shape(executing('agy', '  glm-5-3-flash-max\n', GLM_REVIEWER))).toEqual({
			kind: 'REFUSED',
			code: 'EXECUTOR_MODEL_IS_THE_REVIEWERS',
			toolId: 'agy'
		});
	});

	it('⛔ test 2 — glm-5-3-flash-high, another effort of the reviewer’s model, is refused by FAMILY: the exact compare would pass it', () => {
		const got = executing('agy', 'glm-5-3-flash-high', GLM_REVIEWER);
		expect(shape(got)).toEqual({
			kind: 'REFUSED',
			code: 'EXECUTOR_MODEL_IS_THE_REVIEWERS',
			toolId: 'agy'
		});
		expect(reasonOf(got)).toContain(
			"The executing tool 'agy' would run glm-5-3-flash-high, and the reviewer (devin) runs glm-5-3-flash-max: both are GLM-5.3 Flash models"
		);
		// ⭑ AND A LABEL: agy's own listing spells its models with the effort in brackets, and the reviewer may be agy.
		expect(
			shape(
				executing('pi', 'gemini-4-argon-high', { toolId: 'agy', modelId: 'Gemini 4 Argon (High)' })
			)
		).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_MODEL_IS_THE_REVIEWERS', toolId: 'pi' });
	});

	it('⛔ test 3 — a slug the table does not list, beside a real reviewer → EXECUTOR_MODEL_UNCLASSIFIED, naming it', () => {
		const got = executing('agy', 'fixture-unlisted-model', GLM_REVIEWER);
		expect(shape(got)).toEqual({
			kind: 'REFUSED',
			code: 'EXECUTOR_MODEL_UNCLASSIFIED',
			toolId: 'agy'
		});
		expect(reasonOf(got)).toContain("does not list 'fixture-unlisted-model'");
		expect(reasonOf(got)).toContain('from a measured listing');
		// ⭑ THE REVIEWER'S SLUG TOO: an unlisted reviewer's model cannot be compared either, so a listed executor is refused
		// beside it — and the reason names the reviewer's slug, not the executor's.
		const besideUnlisted = executing('agy', 'gemini-4-argon-high', {
			toolId: 'devin',
			modelId: 'fixture-assurance-model'
		});
		expect(shape(besideUnlisted)).toEqual({
			kind: 'REFUSED',
			code: 'EXECUTOR_MODEL_UNCLASSIFIED',
			toolId: 'agy'
		});
		expect(reasonOf(besideUnlisted)).toContain("does not list 'fixture-assurance-model'");
		expect(reasonOf(besideUnlisted)).not.toContain("'gemini-4-argon-high'");
		// ⭑ A GLM-5.3 model devin lists under ANOTHER family is not in the table, so it is refused, never compared as safe.
		expect(shape(executing('agy', 'glm-5-3-max', GLM_REVIEWER))).toMatchObject({
			code: 'EXECUTOR_MODEL_UNCLASSIFIED'
		});
	});

	it('⛔ an unlisted slug EQUAL to the reviewer’s is the reviewer’s model, not merely unclassified', () => {
		expect(
			shape(executing('agy', 'fixture-same', { toolId: 'devin', modelId: 'fixture-same' }))
		).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_MODEL_IS_THE_REVIEWERS', toolId: 'agy' });
	});

	it('⭑ test 4, CONTROL — another family is admitted: agy on gemini-4-argon-high, and Pi on gpt-5.6-sol in both its spellings', () => {
		expect(executing('agy', 'gemini-4-argon-high', GLM_REVIEWER)).toEqual({
			kind: 'AGY',
			modelId: 'gemini-4-argon-high'
		});
		expect(executing('pi', 'gpt-5.6-sol', GLM_REVIEWER)).toEqual({
			kind: 'PI',
			modelId: 'gpt-5.6-sol'
		});
		// ⭑ Pi's own spelling, as P3 configured it (`JPWB_EXECUTOR_MODEL`).
		expect(executing('pi', 'openai-codex/gpt-5.6-sol', GLM_REVIEWER)).toEqual({
			kind: 'PI',
			modelId: 'openai-codex/gpt-5.6-sol'
		});
		// ⭑ And beside S2's other devin model, which a devin executor runs: GLM is then the executor's to run.
		expect(
			executing('agy', 'glm-5-3-flash-max', { toolId: 'devin', modelId: 'deepseek-v4-1-flash-max' })
		).toEqual({ kind: 'AGY', modelId: 'glm-5-3-flash-max' });
	});

	it('⭑ test 5 — with no reviewer handed in (the stand-in, or a replay), nothing is compared', () => {
		expect(executing('agy', 'glm-5-3-flash-max')).toEqual({
			kind: 'AGY',
			modelId: 'glm-5-3-flash-max'
		});
		expect(executing('agy', 'fixture-unlisted-model')).toEqual({
			kind: 'AGY',
			modelId: 'fixture-unlisted-model'
		});
	});

	it('⛔ the rule keys on the reviewer handed in, not on the mode: in test mode, beside a real reviewer, it refuses the same', () => {
		expect(
			shape(
				selectExecutor({
					testMode: true,
					env: { JPWB_EXECUTOR: 'agy', JPWB_EXECUTOR_MODEL: 'glm-5-3-flash-max' },
					overrides: NO_OVERRIDES,
					reviewer: GLM_REVIEWER
				})
			)
		).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_MODEL_IS_THE_REVIEWERS', toolId: 'agy' });
	});

	it('⭑ asked AFTER the executor’s own configuration: a replaced program and a missing model are refused first', () => {
		expect(
			shape(
				selectExecutor({
					testMode: false,
					env: { JPWB_EXECUTOR: 'agy', JPWB_EXECUTOR_MODEL: 'glm-5-3-flash-max' },
					overrides: { agy: 'C:/stand-in/agy.exe', devin: undefined, codex: undefined },
					reviewer: GLM_REVIEWER
				})
			)
		).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_PROGRAM_OVERRIDDEN', toolId: 'agy' });
		expect(
			shape(
				selectExecutor({
					testMode: false,
					env: { JPWB_EXECUTOR: 'agy' },
					overrides: NO_OVERRIDES,
					reviewer: GLM_REVIEWER
				})
			)
		).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_MODEL_UNSET', toolId: 'agy' });
	});

	it('⭑ every refusal of the two carries the guidance, naming the GLM-5.3 Flash rule', () => {
		for (const got of [
			executing('agy', 'glm-5-3-flash-max', GLM_REVIEWER),
			executing('agy', 'fixture-unlisted-model', GLM_REVIEWER)
		]) {
			expect(got.kind === 'REFUSED' && got.guidance.startsWith(EXECUTOR_GUIDANCE)).toBe(true);
			expect(got.kind === 'REFUSED' && got.guidance).toContain(
				'may not run a GLM-5.3 Flash model under any provider or spelling'
			);
		}
	});
});

describe('⭐ `JAN-MHX` MH-3 (D32) — JPWB_EXECUTOR_EFFORT is refused where nothing would read it, and required where the tool takes it', () => {
	for (const [tool, model, because] of [
		['pi', 'openai-codex/gpt-5.6-sol', 'Pi runs with thinking off'],
		['agy', 'gemini-4-argon-high', 'its model ids name their effort']
	] as const)
		it(`⛔ test 6 — ${tool} with JPWB_EXECUTOR_EFFORT=high → EXECUTOR_EFFORT_NOT_TAKEN, saying why`, () => {
			// ⭑ RED FIRST: the selector read no effort, and answered the tool's selection.
			const got = executing(tool, model, undefined, { JPWB_EXECUTOR_EFFORT: 'high' });
			expect(shape(got)).toEqual({
				kind: 'REFUSED',
				code: 'EXECUTOR_EFFORT_NOT_TAKEN',
				toolId: tool
			});
			expect(reasonOf(got)).toContain('JPWB_EXECUTOR_EFFORT="high" is set');
			expect(reasonOf(got)).toContain(because);
		});

	it('⭑ blank or whitespace is UNSET, the selectors’ rule for every variable — and refuses nothing', () => {
		for (const blank of ['', '   '])
			expect(executing('pi', 'gpt-5.6-sol', undefined, { JPWB_EXECUTOR_EFFORT: blank })).toEqual({
				kind: 'PI',
				modelId: 'gpt-5.6-sol'
			});
	});

	it('⭑ asked BEFORE the reviewer’s model: an effort beside the reviewer’s own model is refused for its effort', () => {
		expect(
			shape(executing('agy', 'glm-5-3-flash-max', GLM_REVIEWER, { JPWB_EXECUTOR_EFFORT: 'high' }))
		).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_EFFORT_NOT_TAKEN', toolId: 'agy' });
	});

	it('⛔ the rule, per tool: Codex, Claude Code and Muse REQUIRE it (EXECUTOR_EFFORT_UNSET), and take it once set', () => {
		// ⭑ No tool that requires an effort is wired yet, so this half of the rule is asked of the rule itself.
		for (const tool of ['codex', 'claude', 'muse'] as const) {
			const unset = executorEffortRefusal(tool, undefined);
			expect(unset && shape(unset), tool).toEqual({
				kind: 'REFUSED',
				code: 'EXECUTOR_EFFORT_UNSET',
				toolId: tool
			});
			expect(unset && reasonOf(unset), tool).toContain('JPWB_EXECUTOR_EFFORT is not set');
			expect(executorEffortRefusal(tool, 'high'), tool).toBeUndefined();
		}
		for (const tool of ['agy', 'devin', 'pi'] as const) {
			expect(executorEffortRefusal(tool, undefined), tool).toBeUndefined();
			expect(executorEffortRefusal(tool, 'high')?.kind, tool).toBe('REFUSED');
		}
	});
});

describe('⭐ `JAN-MHX` MH-3 (D31; the sponsor’s answers of 2026-10-18, S1) — the guidance names the chosen tool’s default, never applies it, and lists the wired tools only', () => {
	it('⛔ test 7 — agy with no model: refused MODEL_UNSET, and the guidance names gemini-4-argon-high, unapplied', () => {
		const got = selectExecutor({
			testMode: false,
			env: { JPWB_EXECUTOR: 'agy' },
			overrides: NO_OVERRIDES
		});
		// ⛔ THE DEFAULT IS NEVER APPLIED: the model stays required (REG-D-052).
		expect(shape(got)).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_MODEL_UNSET', toolId: 'agy' });
		expectGuidanceFor(got.kind === 'REFUSED' ? got.guidance : '', 'agy');
		expect(got.kind === 'REFUSED' && got.guidance).not.toContain('deepseek-v4-1-flash-max');
		expect(got.kind === 'REFUSED' && got.guidance).toContain(
			'JPWB_EXECUTOR_MODEL must still be set'
		);
		// ⭑ AND THE WIRED TOOLS ONLY, as every refusal lists them.
		expect(got.kind === 'REFUSED' && got.guidance).toContain('executor adapter for: agy, pi —');
	});

	it('⛔ S2 — devin’s guidance names BOTH devin models, and the one a devin executor runs beside the GLM reviewer', () => {
		const got = selectExecutor({
			testMode: false,
			env: { JPWB_EXECUTOR: 'devin', JPWB_EXECUTOR_MODEL: 'deepseek-v4-1-flash-max' },
			overrides: NO_OVERRIDES
		});
		expect(shape(got)).toEqual({ kind: 'REFUSED', code: 'EXECUTOR_TOOL_UNWIRED', toolId: 'devin' });
		const guidance = got.kind === 'REFUSED' ? got.guidance : '';
		expectGuidanceFor(guidance, 'devin');
		expect(guidance).toContain(
			'the one of glm-5-3-flash-max and deepseek-v4-1-flash-max that the reviewer does not run'
		);
	});

	it('⭑ Codex, Claude Code and Muse: each default with its effort; Pi has none, and the shared guidance alone', () => {
		for (const tool of ['codex', 'claude', 'muse']) {
			const got = selectExecutor({
				testMode: false,
				env: { JPWB_EXECUTOR: tool, JPWB_EXECUTOR_MODEL: 'fixture-executor' },
				overrides: NO_OVERRIDES
			});
			expectGuidanceFor(got.kind === 'REFUSED' ? got.guidance : '', tool);
			expect(got.kind === 'REFUSED' && got.guidance, tool).toContain(
				'and JPWB_EXECUTOR_EFFORT with it'
			);
		}
		const pi = selectExecutor({
			testMode: false,
			env: { JPWB_EXECUTOR: 'pi' },
			overrides: NO_OVERRIDES
		});
		expect(pi.kind === 'REFUSED' && pi.guidance).toBe(EXECUTOR_GUIDANCE);
		const unset = selectExecutor({ testMode: false, env: {}, overrides: NO_OVERRIDES });
		expect(unset.kind === 'REFUSED' && unset.guidance).toBe(EXECUTOR_GUIDANCE);
	});
});
