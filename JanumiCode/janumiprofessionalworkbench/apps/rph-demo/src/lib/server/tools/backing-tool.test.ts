// JAN-TOOLSUITE TS-01/TS-02 — the suite, and the executor's own configuration.
//
// ⭑ THE TEST THAT MATTERS IS `does NOT fall back to JPWB_JUDGE_MODEL`. Everything else here is scaffolding
// around that one fact: while the execution producer read the ASSURANCE model, producer and reviewer were the
// same BY CONSTRUCTION and `checkIndependence('DIFFERENT_MODEL', …)` could only refuse. `REG-F-356` recorded
// that refusal happening and mis-attributed it to a field-placement mistake alone.
import { describe, expect, it } from 'vitest';
import {
	BACKING_TOOLS,
	KNOWN_TOOL_IDS,
	resolveExecutorModel,
	resolveExecutorToolId,
	selectBackingTool
} from './backing-tool.js';

describe('JAN-TOOLSUITE — the suite admits a tool by DECLARATION', () => {
	it('⭑ CONTROL — a known tool IS selectable for a role it declares', () => {
		// Without this, every refusal below is satisfiable by "refuse everything", which would make the suite
		// unusable rather than strict — the mirror of the rubber stamp.
		const pi = selectBackingTool('pi', 'EXECUTION');
		expect(pi.toolId).toBe('pi');
	});

	it('⛔ REFUSES an unknown tool, and NAMES what this host can drive', () => {
		// THE MUTANT: fall back to the first catalog entry. Work then runs on a tool nobody chose and is recorded
		// as though they had — the fiction REG-D-052 forbids.
		expect(() => selectBackingTool('nosuchtool', 'EXECUTION')).toThrow(/Unknown backing tool 'nosuchtool'/);
		// ⭑ The message must LIST the options, or a misconfiguration gives no way forward.
		expect(() => selectBackingTool('nosuchtool', 'EXECUTION')).toThrow(/agy, pi, devin/);
	});

	it('⛔ REFUSES a tool for a role it does not declare', () => {
		// ⚠ THIS NEEDED AN INJECTED CATALOG TO BE A REAL TEST. Every tool in the shipped catalog declared BOTH
		// roles, so against the real one this branch was unreachable and the test would have asserted nothing while
		// showing green — the "control that cannot fail" defect. ⭐ `JAN-MHX` MH-10: Muse declares EXECUTION alone, and
		// its own case below reaches the branch through the real catalog.
		//
		// THE MUTANT: ignore `roles`. The field becomes decoration and a tool can be selected for work it was
		// never measured against.
		const assuranceOnly = [
			{ ...BACKING_TOOLS.find((t) => t.toolId === 'devin')!, roles: ['ASSURANCE'] as const }
		];
		expect(() => selectBackingTool('devin', 'EXECUTION', assuranceOnly)).toThrow(
			/does not declare the EXECUTION role/
		);
		// ⭑ CONTROL — the SAME injected catalog accepts the role it DOES declare, so the refusal above is about
		// the role and not about the injected catalog being rejected wholesale.
		expect(() => selectBackingTool('devin', 'ASSURANCE', assuranceOnly)).not.toThrow();
	});

	it('⭑ the known-id list is DERIVED from the catalog, not hand-listed', () => {
		// THE MUTANT: a literal array. It then rots the moment a tool is added — the hand-listed-set defect this
		// repository has shipped before (the write-boundary omission map).
		expect(KNOWN_TOOL_IDS).toEqual(BACKING_TOOLS.map((t) => t.toolId));
	});
});

describe('JAN-TOOLSUITE — the declarations record what was MEASURED', () => {
	const byId = (id: string) => BACKING_TOOLS.find((t) => t.toolId === id)!;

	it('⭑ agy confirms nothing about itself; pi and devin report their own model', () => {
		// THE MUTANT: mark every tool PROVIDER_REPORTED. agy's provider/model are ASSERTED by the host and never
		// echoed back, so grading that assertion as confirmation is the fabricated-measurement defect.
		expect(byId('agy').reports.identity).toBe('HOST_CONFIGURED');
		expect(byId('pi').reports.identity).toBe('PROVIDER_REPORTED');
		expect(byId('devin').reports.identity).toBe('PROVIDER_REPORTED');
	});

	it('⚠ NO tool claims to report a model VERSION — a label is not a version', () => {
		// THE MUTANT: set `version: true` for pi or devin because they echo a model back. They echo a LABEL
		// (`gpt-5.4-mini`, `glm-5-2`); writing one into `resolvedModelVersion` is the substitution PER-9 forbids.
		expect(BACKING_TOOLS.every((t) => t.reports.version === false)).toBe(true);
	});

	it('⭑ the three reasoning modes are distinct, and devin volunteers NONE', () => {
		// Measured: `thinking`/`reasoning`/`thought` appear nowhere in a full devin ATIF export, while pi returns
		// `thinking` and `text` as separate typed blocks and agy must be scanned.
		// THE MUTANT: collapse to one mode. The §9.7 split would then be performed the same way for a tool whose
		// output has no structure to split, and an observed absence would read as a blocked split.
		expect(byId('devin').reports.reasoning).toBe('NONE');
		expect(byId('pi').reports.reasoning).toBe('STRUCTURAL');
		expect(byId('agy').reports.reasoning).toBe('INLINE');
	});

	it('⛔ only agy carries the prompt in its diagnostics', () => {
		// agy takes the prompt in argv and execFile embeds argv in its rejection. pi reads stdin; devin takes
		// `--prompt-file`. THE MUTANT: mark agy PROMPT_FREE — its whole prompt would then reach a projected
		// VALIDATOR_EXECUTION_FAILED observation, which is finding #60.
		expect(byId('agy').reports.diagnostics).toBe('PROMPT_BEARING');
		expect(byId('pi').reports.diagnostics).toBe('PROMPT_FREE');
		expect(byId('devin').reports.diagnostics).toBe('PROMPT_FREE');
	});

	it('⭐ `JAN-MHX` MH-10 (design D35, §4.4) — Muse declares what its probes MEASURED: it executes, reports its model, and returns its reasoning apart', () => {
		// ⭑ MEASURED (MH-10's probes, Muse 1.4.10): `muse exec` executed through the host's tools (P2, P3); every model step's
		// `model_completed` named the model; the reasoning summary is its own event; the prompt is a `--prompt-file`.
		// ⛔ THE MUTANT: Muse declares the ASSURANCE role too, which nothing measured — no reviewer drives it.
		const muse = byId('muse');
		expect(muse.roles).toEqual(['EXECUTION']);
		expect(muse.reports).toEqual({
			identity: 'PROVIDER_REPORTED',
			version: false,
			reasoning: 'STRUCTURAL',
			diagnostics: 'PROMPT_FREE'
		});
		expect(() => selectBackingTool('muse', 'ASSURANCE')).toThrow(
			"Backing tool 'muse' does not declare the ASSURANCE role (it declares: EXECUTION)."
		);
	});
});

describe('JAN-TOOLSUITE — the executor has its OWN configuration', () => {
	it('⭑⭑ resolveExecutorModel does NOT fall back to the JUDGE model — THE COLLISION TEST', () => {
		// ⭑ THIS IS THE DEFECT, IN ONE ASSERTION. `execution/model.ts` read JPWB_JUDGE_MODEL, so the producing
		// model WAS the reviewing model and DIFFERENT_MODEL could only ever refuse.
		//
		// THE MUTANT: `?? process.env.JPWB_JUDGE_MODEL`. Every other test in this file still passes, and the
		// collision silently returns.
		expect(resolveExecutorModel(undefined)).toBeUndefined();
		// ⚠ Explicitly: supplying only a judge model must NOT produce an executor model.
		expect(resolveExecutorModel('')).toBeUndefined();
		expect(resolveExecutorModel('   ')).toBeUndefined();
	});

	it('⭑ CONTROL — a configured value IS returned, so the above is not "always undefined"', () => {
		expect(resolveExecutorModel('glm-5-2')).toBe('glm-5-2');
		expect(resolveExecutorToolId('pi')).toBe('pi');
		// ⚠ And it is trimmed, because a stray newline from a .env file must not become part of a model id.
		expect(resolveExecutorModel('  gpt-5.4-mini \n')).toBe('gpt-5.4-mini');
	});

	// ⭐ `JAN-SELRES` RS-1 (D4) — `executorModel()` AND `executorToolId()` ARE GONE, and their two cases here MOVED with
	// them, each to a successor with equal or stronger content (design §4.5), in `execution/executor-selection.test.ts`:
	//   · `executorModel` REFUSES when unset → `EXECUTOR_MODEL_UNSET` says `JPWB_EXECUTOR_MODEL is not set` and
	//     `does NOT fall back to JPWB_JUDGE_MODEL`, for agy and Pi alike, even with a judge model configured;
	//   · `executorToolId` REFUSES when unset → `EXECUTOR_TOOL_UNSET` says `JPWB_EXECUTOR is not set`, and its guidance
	//     lists the WIRED tools, `agy, pi`, and NOT devin. ⚠ A deliberate change of what is pinned, made stronger: the
	//     old refusal listed the catalog (`agy, pi, devin`), steering an operator to a tool the next refusal forbids.
});
