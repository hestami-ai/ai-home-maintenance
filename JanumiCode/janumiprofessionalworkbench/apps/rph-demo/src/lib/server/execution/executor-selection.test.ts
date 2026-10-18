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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectReviewer } from '../assurance/reviewer-selection.js';
import { BACKING_TOOLS } from '../tools/backing-tool.js';
import {
	EXECUTOR_GUIDANCE,
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
	'nosuchtool'
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
	{ name: 'no override', overrides: { agy: undefined, devin: undefined } },
	{ name: 'JPWB_AGY_BIN set', overrides: { agy: 'C:/stand-in/agy.exe', devin: undefined } },
	{ name: 'JPWB_DEVIN_BIN set', overrides: { agy: undefined, devin: 'C:/stand-in/devin.exe' } },
	{ name: 'JPWB_AGY_BIN empty', overrides: { agy: '', devin: undefined } },
	{ name: 'JPWB_DEVIN_BIN empty', overrides: { agy: undefined, devin: '' } },
	{ name: 'both set', overrides: { agy: 'C:/stand-in/agy.exe', devin: 'C:/stand-in/devin.exe' } }
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
	devin: 'devin'
};

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

const NO_OVERRIDES: ExecutorProgramOverrides = { agy: undefined, devin: undefined };

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
						if (got.kind === 'REFUSED') expect(got.guidance).toBe(EXECUTOR_GUIDANCE);
					});
});

describe('⛔ D3 — only the SELECTED tool’s captured override refuses, and only outside test mode', () => {
	it('⭐ a PI executor on a host with a stray JPWB_AGY_BIN is ADMITTED — and so is its devin reviewer (SR2-M20’s host)', () => {
		// ⭑ THE HOST `SR2-M20` NOW NAMES AS WHO RELIES: Pi executing, devin reviewing, and an `agy` program override left
		// set. agy runs neither role, so its override refuses nothing on either side. `JAN-SELREV` D7 pins the reviewer
		// half (`floor-registry.test.ts`); this pins the executor half, and asks the reviewer selector the same question
		// on the same host so the two halves are one arrangement.
		const stray: ExecutorProgramOverrides = { agy: 'C:/stand-in/agy.exe', devin: undefined };
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
			selectExecutor({ testMode: false, env: host, overrides: { agy: '', devin: '' } })
		).toEqual({ kind: 'PI', modelId: 'fixture-pi-model' });
	});

	for (const program of ['C:/stand-in/agy.exe', ''])
		it(`agy, JPWB_AGY_BIN=${JSON.stringify(program)}: refused outside test mode, naming the variable, the program and REG-F-459 — honoured in test mode`, () => {
			const env = { JPWB_EXECUTOR: 'agy', JPWB_EXECUTOR_MODEL: 'fixture-executor' };
			const overrides = { agy: program, devin: undefined };
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
					overrides: { agy: 'C:/stand-in/agy.exe', devin: undefined }
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
					overrides: { agy: undefined, devin: 'C:/stand-in/devin.exe' }
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
	async function loadedWith(agyBin: string | undefined) {
		vi.resetModules();
		vi.stubEnv('JPWB_AGY_BIN', agyBin);
		vi.stubEnv('JPWB_DEVIN_BIN', undefined);
		const loaded = await import('./executor-selection.js');
		vi.stubEnv('JPWB_AGY_BIN', undefined);
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
