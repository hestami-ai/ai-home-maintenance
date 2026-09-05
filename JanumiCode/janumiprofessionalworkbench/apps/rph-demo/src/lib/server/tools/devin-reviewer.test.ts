// JAN-TOOLSUITE TS-07 — the Devin assurance adapter.
//
// ⭑ THE SUBJECT OF MOST OF THIS FILE IS `diagnosticCarriesPrompt`, because it is what turns a DECLARATION into
// a CONTROL. The suite records Devin as `diagnostics: PROMPT_FREE`, measured by driving it — but a declaration
// that is merely trusted is exactly the "control that cannot fail" this repository keeps finding. Checking each
// diagnostic against the prompt actually sent means a wrong declaration fails SAFE.
import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assuranceModel, readReportedModel, resolveAssuranceModel } from './devin-reviewer.js';
// ⭑ THE LEAK CHECK MOVED TO A PURE MODULE so the ASSURANCE SEAM can use it without dragging
// `node:child_process` into the Validator. Adapter-level sanitising is a discipline; seam-level is a
// property, and TS-06 made it the seam's.
import { diagnosticCarriesPrompt } from './diagnostic-safety.js';

const LONG = 'Assess the northern delivery route against the safety rubric. '.repeat(8);

describe('JAN-TOOLSUITE — the diagnostic is MEASURED for the prompt, not assumed clean', () => {
	it('⛔ catches a diagnostic that echoes the whole prompt', () => {
		// THE MUTANT: `return false` — i.e. trust the PROMPT_FREE declaration. The whole prompt then reaches a
		// projected VALIDATOR_EXECUTION_FAILED observation, which is finding #60, on a tool we merely believed.
		expect(diagnosticCarriesPrompt(`Command failed: ${LONG}`, LONG)).toBe(true);
	});

	it('⛔ catches a TRUNCATED echo from the middle and from the end', () => {
		// ⚠ A WHOLE-STRING COMPARISON MISSES THIS, and it is the case that matters: a tool that echoes part of
		// the prompt has still leaked it. THE MUTANT: compare only `diagnostic.includes(prompt)`.
		const middle = LONG.slice(Math.floor(LONG.length / 2), Math.floor(LONG.length / 2) + 120);
		const tail = LONG.slice(-120);
		expect(diagnosticCarriesPrompt(`error near: ${middle}`, LONG)).toBe(true);
		expect(diagnosticCarriesPrompt(`error near: ${tail}`, LONG)).toBe(true);
	});

	it('⭑ CONTROL — a genuinely clean diagnostic is NOT flagged, so the check is not "always withhold"', () => {
		// Without this, the fix destroys every diagnostic it was meant to save — repeating agy's disclosed loss
		// for no reason. This is the real message Devin returns for an unknown model, measured.
		const real =
			'Warning: Model "no-such-model" not found for provider "openai-codex".\n' +
			"Codex error: The 'no-such-model' model is not supported when using Codex with a ChatGPT account.";
		expect(diagnosticCarriesPrompt(real, LONG)).toBe(false);
	});

	it('⚠ a SHORT prompt is compared whole, so ordinary English does not false-positive', () => {
		// A 120-char probe taken from a 20-char prompt would match almost any sentence. THE MUTANT: use the
		// probe path for every length — the check then withholds diagnostics that leaked nothing.
		expect(diagnosticCarriesPrompt('the route is fine', 'the route is fine')).toBe(true);
		expect(diagnosticCarriesPrompt('some unrelated failure', 'the route is fine')).toBe(false);
	});

	it('an empty prompt cannot be leaked', () => {
		expect(diagnosticCarriesPrompt('anything at all', '   ')).toBe(false);
	});
});

describe('JAN-TOOLSUITE — Devin reports the model it actually ran', () => {
	it('⭑ reads generation_model back from an ATIF export', async () => {
		// ⚠ THE FIXTURE SHAPE IS DERIVED FROM A REAL EXPORT, not invented: `devin --export` emits ATIF-v1.7 with
		// `steps[].extra.generation_model`, and the LAST agent step carries the model that produced the answer.
		const dir = await mkdtemp(join(tmpdir(), 'jpwb-atif-'));
		const p = join(dir, 'export.json');
		await writeFile(
			p,
			JSON.stringify({
				schema_version: 'ATIF-v1.7',
				agent: { name: 'devin', version: '3000.6.14', model_name: 'GLM-5.2 High' },
				steps: [
					{ step_id: 1, source: 'system', extra: {} },
					{ step_id: 2, source: 'agent', extra: { generation_model: 'glm-5-2' } }
				]
			}),
			'utf8'
		);
		expect(await readReportedModel(p)).toBe('glm-5-2');
	});

	it('⭑ an unreadable export yields UNDEFINED — absence of evidence, not evidence of another model', async () => {
		// THE MUTANT: return the configured model on failure. The record would then claim the tool CONFIRMED an
		// identity it never reported, which is the fabricated-measurement defect the grade exists to prevent.
		expect(await readReportedModel(join(tmpdir(), 'jpwb-no-such-export.json'))).toBeUndefined();
	});
});

describe('JAN-TOOLSUITE — the reviewing model is configured, never pinned', () => {
	it('⛔ REFUSES when JPWB_ASSURANCE_MODEL is unset', () => {
		const saved = process.env.JPWB_ASSURANCE_MODEL;
		delete process.env.JPWB_ASSURANCE_MODEL;
		try {
			expect(() => assuranceModel()).toThrow(/JPWB_ASSURANCE_MODEL is not set/);
			// ⭑ And it must warn about the collision, or an operator sets it equal to the executor model and
			// meets an INDEPENDENCE_VIOLATION with no idea why.
			expect(() => assuranceModel()).toThrow(/must differ from JPWB_EXECUTOR_MODEL/);
		} finally {
			if (saved !== undefined) process.env.JPWB_ASSURANCE_MODEL = saved;
		}
	});

	it('⭑ CONTROL — a configured value is returned and trimmed', () => {
		expect(resolveAssuranceModel('glm-5-2')).toBe('glm-5-2');
		expect(resolveAssuranceModel('  glm-5-2 \n')).toBe('glm-5-2');
		expect(resolveAssuranceModel('  ')).toBeUndefined();
	});
});
