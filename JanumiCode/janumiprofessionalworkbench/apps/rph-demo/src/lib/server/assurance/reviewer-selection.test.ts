// ⭐ `JAN-SELREV` SR-1 (D2, D3) — THE SELECTOR'S FULL TABLE: mode × tool × model.
//
// ⭑ THE ORACLE BELOW IS WRITTEN FROM THE DESIGN'S TABLE (D2), NOT FROM THE SELECTOR: an unset tool is the stand-in in
// test mode and a refusal outside it; a set tool is held to the same rules in both modes — agy needs
// `JPWB_JUDGE_MODEL`, devin `JPWB_ASSURANCE_MODEL`, `pi` is declared but unwired, anything else the catalog does not
// know. Every row is compared whole, so a selector that answered one limb from another limb's variable reddens.
//
// ⚠ THE OVERRIDE DIMENSION (`JPWB_DEVIN_BIN` / `JPWB_AGY_BIN`) IS D7's, built in SR-2; this table has none yet.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	resolveReviewerToolId,
	SELECTED_REVIEWER_GUIDANCE,
	selectReviewer,
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

type Expected =
	| { readonly kind: 'STAND_IN' | 'AGY' | 'DEVIN'; readonly modelId?: string }
	| {
			readonly kind: 'REFUSED';
			readonly code: ReviewerRefusalCode;
			readonly toolId: string | undefined;
	  };

/** D2, restated. */
function oracle(
	testMode: boolean,
	tool: string | undefined,
	judge?: string,
	assurance?: string
): Expected {
	const t = tool?.trim() ? tool.trim() : undefined;
	const j = judge?.trim() ? judge.trim() : undefined;
	const a = assurance?.trim() ? assurance.trim() : undefined;
	if (t === undefined)
		return testMode
			? { kind: 'STAND_IN' }
			: { kind: 'REFUSED', code: 'REVIEWER_TOOL_UNSET', toolId: undefined };
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
	return { kind: s.kind, modelId: s.modelId };
}

describe('⭐ the selector answers the design’s table — every mode, tool and model', () => {
	for (const testMode of [true, false])
		for (const tool of TOOLS)
			for (const m of MODELS)
				it(`${testMode ? 'test mode' : 'server mode'} · tool ${JSON.stringify(tool)} · ${m.name}`, () => {
					const env: Record<string, string | undefined> = {
						JPWB_ASSURANCE_TOOL: tool,
						JPWB_JUDGE_MODEL: m.judge,
						JPWB_ASSURANCE_MODEL: m.assurance
					};
					const got = selectReviewer({ testMode, env });
					expect(shape(got)).toEqual(oracle(testMode, tool, m.judge, m.assurance));
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
	});

	const REASONS: readonly { readonly tool: string | undefined; readonly says: string }[] = [
		{ tool: undefined, says: 'JPWB_ASSURANCE_TOOL is not set' },
		{ tool: 'agy', says: "'agy' has no model: JPWB_JUDGE_MODEL is not set" },
		{ tool: 'devin', says: "'devin' has no model: JPWB_ASSURANCE_MODEL is not set" },
		{
			tool: 'pi',
			says: "The reviewing tool 'pi' (JPWB_ASSURANCE_TOOL) declares the ASSURANCE role, but no reviewer adapter"
		},
		// ⭑ The catalog's own refusal, carried whole — it lists what this host CAN drive.
		{ tool: 'nope', says: "Unknown backing tool 'nope'. This host can drive: agy, pi, devin." }
	];
	for (const r of REASONS)
		it(`tool ${JSON.stringify(r.tool)}: "${r.says}"`, () => {
			const got = selectReviewer({ testMode: false, env: { JPWB_ASSURANCE_TOOL: r.tool } });
			expect(got.kind).toBe('REFUSED');
			expect(got.kind === 'REFUSED' && got.reason).toContain(r.says);
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
