// ⭐ `JAN-SELREV` SR-1 (D2, D3) — THE SELECTOR'S FULL TABLE: mode × tool × model × program override.
//
// ⭑ THE ORACLE BELOW IS WRITTEN FROM THE DESIGN'S TABLE (D2), NOT FROM THE SELECTOR: an unset tool is the stand-in in
// test mode and a refusal outside it; a set tool is held to the same rules in both modes — agy needs
// `JPWB_JUDGE_MODEL`, devin `JPWB_ASSURANCE_MODEL`, `pi` is declared but unwired, anything else the catalog does not
// know. Every row is compared whole, so a selector that answered one limb from another limb's variable reddens.
//
// ⭐ SR-2 (D7) — AND THE OVERRIDE DIMENSION: outside test mode, the SELECTED tool's program override (`JPWB_AGY_BIN`
// for agy, `JPWB_DEVIN_BIN` for devin) refuses, even when it is `''`; the other tool's refuses nothing; in test mode
// both are honoured. The overrides are handed in, as the environment is — what the adapters captured when they
// LOADED is the default, held by the last block below.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	resolveReviewerToolId,
	SELECTED_REVIEWER_GUIDANCE,
	selectReviewer,
	type ReviewerProgramOverrides,
	type ReviewerRefusalCode,
	type ReviewerSelection
} from './reviewer-selection.js';

const TOOLS: readonly (string | undefined)[] = [
	undefined,
	'',
	'   ',
	'agy',
	'devin',
	' devin ',
	'pi',
	'Devin',
	'nope'
];
const MODELS: readonly {
	readonly name: string;
	readonly judge?: string;
	readonly assurance?: string;
}[] = [
	{ name: 'no model' },
	{ name: 'the judge model only', judge: 'fixture-judge' },
	{ name: 'the assurance model only', assurance: 'fixture-assurance' },
	{ name: 'both models', judge: 'fixture-judge', assurance: 'fixture-assurance' },
	{ name: 'both models blank', judge: '  ', assurance: '' }
];
/** ⭑ `''` is a SET override — an empty program name, which the adapter would run — never an unset one. */
const OVERRIDES: readonly {
	readonly name: string;
	readonly overrides: ReviewerProgramOverrides;
}[] = [
	{ name: 'no override', overrides: { agy: undefined, devin: undefined } },
	{ name: 'JPWB_AGY_BIN set', overrides: { agy: 'C:/stand-in/agy.exe', devin: undefined } },
	{ name: 'JPWB_DEVIN_BIN set', overrides: { agy: undefined, devin: 'C:/stand-in/devin.exe' } },
	{ name: 'JPWB_AGY_BIN empty', overrides: { agy: '', devin: undefined } },
	{ name: 'JPWB_DEVIN_BIN empty', overrides: { agy: undefined, devin: '' } },
	{ name: 'both set', overrides: { agy: 'C:/stand-in/agy.exe', devin: 'C:/stand-in/devin.exe' } }
];

type Expected =
	| { readonly kind: 'STAND_IN' | 'AGY' | 'DEVIN'; readonly modelId?: string }
	| {
			readonly kind: 'REFUSED';
			readonly code: ReviewerRefusalCode;
			readonly toolId: string | undefined;
	  };

/** D2 and D7, restated. ⚠ A refused override outranks a missing model: the program is refused whatever it would run. */
function oracle(
	testMode: boolean,
	tool: string | undefined,
	judge: string | undefined,
	assurance: string | undefined,
	overrides: ReviewerProgramOverrides
): Expected {
	const t = tool?.trim() ? tool.trim() : undefined;
	const j = judge?.trim() ? judge.trim() : undefined;
	const a = assurance?.trim() ? assurance.trim() : undefined;
	if (t === undefined)
		return testMode
			? { kind: 'STAND_IN' }
			: { kind: 'REFUSED', code: 'REVIEWER_TOOL_UNSET', toolId: undefined };
	if ((t === 'agy' || t === 'devin') && !testMode && overrides[t] !== undefined)
		return { kind: 'REFUSED', code: 'REVIEWER_PROGRAM_OVERRIDDEN', toolId: t };
	if (t === 'agy')
		return j
			? { kind: 'AGY', modelId: j }
			: { kind: 'REFUSED', code: 'REVIEWER_MODEL_UNSET', toolId: 'agy' };
	if (t === 'devin')
		return a
			? { kind: 'DEVIN', modelId: a }
			: { kind: 'REFUSED', code: 'REVIEWER_MODEL_UNSET', toolId: 'devin' };
	if (t === 'pi') return { kind: 'REFUSED', code: 'REVIEWER_TOOL_UNWIRED', toolId: 'pi' };
	return { kind: 'REFUSED', code: 'REVIEWER_TOOL_UNKNOWN', toolId: t };
}

/** The selection, minus the prose — the shape the oracle predicts. */
function shape(s: ReviewerSelection): Expected {
	if (s.kind === 'REFUSED') return { kind: 'REFUSED', code: s.code, toolId: s.toolId };
	if (s.kind === 'STAND_IN') return { kind: 'STAND_IN' };
	// ⭐ `JAN-EXEC` Phase 8 — the table sets no JPWB_REPLAY, so a REPLAY answer here is the selector reading the switch from
	// somewhere it was not handed (`replay/replay-selection.test.ts` holds the switch's own table).
	if (s.kind === 'REPLAY') throw new Error('the table sets no JPWB_REPLAY, and the selector answered REPLAY');
	return { kind: s.kind, modelId: s.modelId };
}

describe('⭐ the selector answers the design’s table — every mode, tool, model and program override', () => {
	for (const testMode of [true, false])
		for (const tool of TOOLS)
			for (const m of MODELS)
				for (const o of OVERRIDES)
					it(`${testMode ? 'test mode' : 'server mode'} · tool ${JSON.stringify(tool)} · ${m.name} · ${o.name}`, () => {
						const env: Record<string, string | undefined> = {
							JPWB_ASSURANCE_TOOL: tool,
							JPWB_JUDGE_MODEL: m.judge,
							JPWB_ASSURANCE_MODEL: m.assurance
						};
						const got = selectReviewer({ testMode, env, overrides: o.overrides });
						expect(shape(got)).toEqual(oracle(testMode, tool, m.judge, m.assurance, o.overrides));
						if (got.kind === 'REFUSED') expect(got.guidance).toBe(SELECTED_REVIEWER_GUIDANCE);
					});
});

describe('what a refusal SAYS — it names the fault, and every one carries the selection and the independence rule', () => {
	it('⭑ the guidance names REG-D-084’s selection as configuration, and ASR-13’s independence rule', () => {
		expect(SELECTED_REVIEWER_GUIDANCE).toContain(
			'The selected reviewer (REG-D-084) is devin with glm-5-3-flash-max: set JPWB_ASSURANCE_TOOL=devin and ' +
				'JPWB_ASSURANCE_MODEL=glm-5-3-flash-max.'
		);
		expect(SELECTED_REVIEWER_GUIDANCE).toContain(
			'not a default this host falls back to (REG-D-052)'
		);
		expect(SELECTED_REVIEWER_GUIDANCE).toContain('stay configurable');
		expect(SELECTED_REVIEWER_GUIDANCE).toContain('Independence (ASR-13)');
		expect(SELECTED_REVIEWER_GUIDANCE).toContain(
			'may run a GLM-5.3 Flash model under any provider or spelling'
		);
		// ~~⭑ `JAN-SELREV` SR-3: the executor's model is NOT always `JPWB_EXECUTOR_MODEL` — the agy executor runs the judge
		// model (`REG-F-458`), and guidance naming only the executor variable would send an agy host to the wrong one.~~
		// ⭐ `JAN-SELRES` RS-1 (D2, D9) — THE PIN NOW HOLDS THE NEW TRUTH, AND THE ABSENCE OF THE OLD ONE. The agy executor
		// runs `JPWB_EXECUTOR_MODEL` now (`REG-F-458` remedy (a)), so guidance still naming the JUDGE model for the executor
		// would send an agy host to the wrong variable — the same harm SR-3 pinned against, from the other side.
		expect(SELECTED_REVIEWER_GUIDANCE).toContain(
			'neither the executor (JPWB_EXECUTOR_MODEL, for agy and Pi alike) nor the authoring agent'
		);
		expect(SELECTED_REVIEWER_GUIDANCE).not.toMatch(/executor runs JPWB_JUDGE_MODEL|REG-F-458/);
		expect(SELECTED_REVIEWER_GUIDANCE).toContain('else the first model Pi has credentials for');
	});

	const REASONS: readonly { readonly tool: string | undefined; readonly says: string }[] = [
		{ tool: undefined, says: 'JPWB_ASSURANCE_TOOL is not set' },
		{ tool: 'agy', says: "'agy' has no model: JPWB_JUDGE_MODEL is not set" },
		{ tool: 'devin', says: "'devin' has no model: JPWB_ASSURANCE_MODEL is not set" },
		{
			tool: 'pi',
			says: "The reviewing tool 'pi' (JPWB_ASSURANCE_TOOL) declares the ASSURANCE role, but no reviewer adapter"
		},
		// ⭑ The catalog's own refusal, carried whole — it lists what this host CAN drive, ⭐ Muse among it since `JAN-MHX`
		// MH-10, though Muse declares no ASSURANCE role (the next case).
		{ tool: 'nope', says: "Unknown backing tool 'nope'. This host can drive: agy, pi, devin, muse." },
		{
			tool: 'muse',
			says: "The reviewing tool 'muse' (JPWB_ASSURANCE_TOOL) is refused: Backing tool 'muse' does not declare the ASSURANCE role (it declares: EXECUTION)."
		}
	];
	for (const r of REASONS)
		it(`tool ${JSON.stringify(r.tool)}: "${r.says}"`, () => {
			const got = selectReviewer({ testMode: false, env: { JPWB_ASSURANCE_TOOL: r.tool } });
			expect(got.kind).toBe('REFUSED');
			expect(got.kind === 'REFUSED' && got.reason).toContain(r.says);
		});

	// ⭐ SR-2 (D7) — an override's refusal names the VARIABLE and the PROGRAM, and says why it cannot be allowed.
	for (const [tool, variable] of [
		['agy', 'JPWB_AGY_BIN'],
		['devin', 'JPWB_DEVIN_BIN']
	] as const)
		for (const program of ['C:/stand-in/reviewer.exe', ''])
			it(`tool '${tool}', ${variable}=${JSON.stringify(program)}: names the variable, the program and REG-F-441`, () => {
				const got = selectReviewer({
					testMode: false,
					env: {
						JPWB_ASSURANCE_TOOL: tool,
						JPWB_JUDGE_MODEL: 'fixture-judge',
						JPWB_ASSURANCE_MODEL: 'fixture-assurance'
					},
					overrides: { agy: undefined, devin: undefined, [tool]: program }
				});
				expect(got.kind === 'REFUSED' && got.code).toBe('REVIEWER_PROGRAM_OVERRIDDEN');
				const reason = got.kind === 'REFUSED' ? got.reason : '';
				expect(reason).toContain(`${variable}=${JSON.stringify(program)}`);
				expect(reason).toContain(`the product’s own '${tool}' program`);
				expect(reason).toContain('REG-F-441');
				expect(reason).toContain('even when it is empty');
			});
});

describe('the selector reads the environment it is handed', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('⭑ an explicit environment is the whole input — the process’s is not consulted', () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'agy');
		vi.stubEnv('JPWB_JUDGE_MODEL', 'from-the-process');
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'from-the-process-too');
		expect(selectReviewer({ testMode: true, env: {} })).toEqual({ kind: 'STAND_IN' });
		// ⛔ THE MODELS AS WELL AS THE TOOL. `resolveJudgeModel` and `resolveAssuranceModel` default their parameter to
		// the process's variable when handed `undefined`, so an explicit environment that names a tool and no model once
		// took its model from the process: this row answered AGY `from-the-process`, and DEVIN `from-the-process-too`.
		// The table above could not see it, because the gate's setup file removes both variables before it runs.
		expect(
			shape(selectReviewer({ testMode: false, env: { JPWB_ASSURANCE_TOOL: 'agy' } })),
			'agy’s model was read from the process, not from the environment handed in'
		).toEqual({ kind: 'REFUSED', code: 'REVIEWER_MODEL_UNSET', toolId: 'agy' });
		expect(
			shape(selectReviewer({ testMode: false, env: { JPWB_ASSURANCE_TOOL: 'devin' } })),
			'devin’s model was read from the process, not from the environment handed in'
		).toEqual({ kind: 'REFUSED', code: 'REVIEWER_MODEL_UNSET', toolId: 'devin' });
	});

	it('⭑ and the process’s environment when none is handed — what the registry and both preflights read', () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'agy');
		vi.stubEnv('JPWB_JUDGE_MODEL', 'from-the-process');
		expect(selectReviewer({ testMode: true })).toEqual({
			kind: 'AGY',
			modelId: 'from-the-process'
		});
	});

	it('⭑ blank and whitespace are UNSET (D2), exactly as the executor reads its own tool', () => {
		expect(resolveReviewerToolId(undefined)).toBeUndefined();
		expect(resolveReviewerToolId('')).toBeUndefined();
		expect(resolveReviewerToolId(' \t ')).toBeUndefined();
		expect(resolveReviewerToolId(' devin ')).toBe('devin');
	});
});

describe('⭐ SR-2 (D7) — the overrides the selector acts on are the ones the ADAPTERS captured when they loaded', () => {
	// ⛔ THE ADAPTERS READ THEIR OVERRIDE ONCE, AT LOAD (`agy-cli.ts`, `devin-reviewer.ts`), and run whatever it named for
	// the life of the process. So the selector must refuse what was CAPTURED — a check of the environment at the review
	// would pass a server whose override was unset after it started, and whose adapter still runs the replacement.
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	/** The two adapters and the selector, loaded afresh with these variables set, then the variables removed again. */
	async function loadedWith(vars: {
		readonly JPWB_AGY_BIN?: string;
		readonly JPWB_DEVIN_BIN?: string;
	}) {
		vi.resetModules();
		vi.stubEnv('JPWB_AGY_BIN', undefined);
		vi.stubEnv('JPWB_DEVIN_BIN', undefined);
		for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
		const loaded = {
			agy: await import('./agy-cli.js'),
			devin: await import('../tools/devin-reviewer.js'),
			selection: await import('./reviewer-selection.js')
		};
		vi.stubEnv('JPWB_AGY_BIN', undefined);
		vi.stubEnv('JPWB_DEVIN_BIN', undefined);
		return loaded;
	}
	const DEVIN_HOST = {
		JPWB_ASSURANCE_TOOL: 'devin',
		JPWB_ASSURANCE_MODEL: 'fixture-assurance'
	};

	it('⭑ each adapter exports what it captured — undefined when unset, and the empty string when set empty', async () => {
		const unset = await loadedWith({});
		expect(unset.agy.AGY_BIN_OVERRIDE).toBeUndefined();
		expect(unset.devin.DEVIN_BIN_OVERRIDE).toBeUndefined();
		const set = await loadedWith({ JPWB_AGY_BIN: 'C:/stand-in/agy.exe', JPWB_DEVIN_BIN: '' });
		expect(set.agy.AGY_BIN_OVERRIDE).toBe('C:/stand-in/agy.exe');
		expect(set.devin.DEVIN_BIN_OVERRIDE, 'an empty override is SET, to an empty program name').toBe(
			''
		);
	});

	it('⛔ with no overrides handed in, a captured JPWB_DEVIN_BIN refuses a devin review — though the variable is gone now', async () => {
		const { selection } = await loadedWith({ JPWB_DEVIN_BIN: 'C:/stand-in/devin.exe' });
		expect(
			process.env.JPWB_DEVIN_BIN,
			'the arrangement removed the variable after the load'
		).toBeUndefined();
		const got = selection.selectReviewer({ testMode: false, env: DEVIN_HOST });
		expect(got.kind === 'REFUSED' && got.code).toBe('REVIEWER_PROGRAM_OVERRIDDEN');
		expect(got.kind === 'REFUSED' && got.reason).toContain(
			'JPWB_DEVIN_BIN="C:/stand-in/devin.exe"'
		);
	});

	it('⭑ CONTROL — a captured JPWB_AGY_BIN does not refuse a devin review, and nothing captured refuses nothing', async () => {
		const agyOnly = await loadedWith({ JPWB_AGY_BIN: 'C:/stand-in/agy.exe' });
		expect(agyOnly.selection.selectReviewer({ testMode: false, env: DEVIN_HOST })).toEqual({
			kind: 'DEVIN',
			modelId: 'fixture-assurance'
		});
		const none = await loadedWith({});
		expect(none.selection.selectReviewer({ testMode: false, env: DEVIN_HOST })).toEqual({
			kind: 'DEVIN',
			modelId: 'fixture-assurance'
		});
	});
});
