// ⭐ `JAN-MHX` MH-4 (`DESIGN-multi-harness-executor.md` D30) — THE UNWIRED LIMB AND THE WIRED LIST, HELD OVER A CATALOG
// THAT DECLARES A TOOL NOBODY WIRED.
//
// ⭑ WHY A FILE OF ITS OWN. MH-4 wired devin, the last catalogued EXECUTION tool without an executor adapter, so over the
// real catalog no input reaches `EXECUTOR_TOOL_UNWIRED`~~, and the list of wired tools the guidance and the unknown tool's
// reason offer holds the same three tools as the catalog's~~ ⭐ in test mode (MH-4, the check's fix: devin is wired in
// test mode only, D30, so outside it devin's rows reach the limb, in `executor-selection.test.ts`, and the guidance lists
// agy and Pi). Both guards stay for the day the catalog declares a tool before its driver lands — and a guard no input
// reaches is one no test could fail. So this file loads the selector against the real catalog with one more EXECUTION
// tool, `fixture-unwired`, for which no executor adapter is wired in any mode.
import { describe, expect, it, vi } from 'vitest';
import { EXECUTOR_GUIDANCE, selectExecutor, type ExecutorProgramOverrides } from './executor-selection.js';
import { selectBackingTool } from '../tools/backing-tool.js';

vi.mock('../tools/backing-tool.js', async (importOriginal) => {
	const real = await importOriginal<typeof import('../tools/backing-tool.js')>();
	const catalog = [
		...real.BACKING_TOOLS,
		{
			toolId: 'fixture-unwired',
			roles: ['EXECUTION'],
			reports: { identity: 'HOST_CONFIGURED', version: false, reasoning: 'NONE', diagnostics: 'PROMPT_FREE' }
		} as const
	];
	return {
		...real,
		BACKING_TOOLS: catalog,
		KNOWN_TOOL_IDS: catalog.map((t) => t.toolId),
		selectBackingTool: (toolId: string, role: Parameters<typeof real.selectBackingTool>[1]) =>
			real.selectBackingTool(toolId, role, catalog)
	};
});

const NO_OVERRIDES: ExecutorProgramOverrides = { agy: undefined, devin: undefined, codex: undefined };

describe('⭐ MH-4 — over a catalog that declares a tool nobody wired', () => {
	it('⭑ arrangement — the catalog declares fixture-unwired for EXECUTION, and the wired tools are still selected', () => {
		// ⚠ WITHOUT THIS a catalog the mock failed to extend would send fixture-unwired to the UNKNOWN limb, and the case
		// below would be testing that limb while its name said otherwise.
		expect(selectBackingTool('fixture-unwired', 'EXECUTION').toolId).toBe('fixture-unwired');
		// ⭐ MH-4, the check's fix — devin in test mode, the one mode it is wired in (D30).
		for (const [tool, testMode] of [
			['agy', false],
			['pi', false],
			['devin', true]
		] as const)
			expect(
				selectExecutor({
					testMode,
					env: { JPWB_EXECUTOR: tool, JPWB_EXECUTOR_MODEL: 'fixture-executor' },
					overrides: NO_OVERRIDES
				}).kind,
				tool
			).not.toBe('REFUSED');
	});

	for (const testMode of [true, false])
		it(`⛔ ${testMode ? 'test' : 'server'} mode — a catalogued EXECUTION tool with no executor adapter → EXECUTOR_TOOL_UNWIRED, not UNKNOWN`, () => {
			// ⛔ THE SUCCESSOR of `executor-selection.test.ts`'s devin case, which devin's wiring (D30) struck: the code is the
			// caller's to act on without parsing prose, and an unwired tool is not one the catalog does not know.
			const got = selectExecutor({
				testMode,
				env: { JPWB_EXECUTOR: 'fixture-unwired', JPWB_EXECUTOR_MODEL: 'fixture-executor' },
				overrides: NO_OVERRIDES
			});
			expect(got.kind === 'REFUSED' && [got.code, got.toolId]).toEqual(['EXECUTOR_TOOL_UNWIRED', 'fixture-unwired']);
			expect(got.kind === 'REFUSED' && got.reason).toContain(
				"The executing tool 'fixture-unwired' (JPWB_EXECUTOR) declares the EXECUTION role, but no executor adapter is wired"
			);
		});

	it('⛔ the guidance offers the wired tools — agy, pi — and never the catalog’s tool nobody wired', () => {
		// ⛔ THE MUTANT: the guidance lists the catalog. An operator following it to fixture-unwired would be refused again,
		// as UNWIRED (`REG-F-460`'s general form). ⭐ MH-4, the check's fix — ~~agy, pi, devin~~ agy and Pi: devin is wired in
		// test mode only (D30), and the guidance is the operator's.
		expect(EXECUTOR_GUIDANCE).toContain('executor adapter for: agy, pi —');
		expect(EXECUTOR_GUIDANCE).not.toContain('fixture-unwired');
	});

	it('⛔ and an unknown tool’s reason offers the wired tools, never the catalog’s list, which names the tool nobody wired', () => {
		// ⛔ THE MUTANT: the catalog's sentence, "This host can drive: …", stays in the reason printed beside the guidance.
		const got = selectExecutor({
			testMode: false,
			env: { JPWB_EXECUTOR: 'nosuchtool', JPWB_EXECUTOR_MODEL: 'fixture-executor' },
			overrides: NO_OVERRIDES
		});
		const reason = got.kind === 'REFUSED' ? got.reason : '';
		expect(reason).toMatch(/Unknown backing tool 'nosuchtool'\./);
		expect(reason).toContain('This host has an executor adapter for: agy, pi.');
		expect(reason).not.toContain('fixture-unwired');
	});
});
