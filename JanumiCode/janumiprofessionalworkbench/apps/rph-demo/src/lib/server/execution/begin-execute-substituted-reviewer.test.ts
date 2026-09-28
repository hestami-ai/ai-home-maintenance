// ⭐ `JAN-SELRES` RS-2 (D6, D7; G8) — BESIDE A SUBSTITUTED REVIEWER, THE EXECUTION PLANE NAMES THE SUBSTITUTION'S OWN ACTION.
//
// ⛔ WHAT WAS WRONG (`DESIGN-the-selection-residuals.md` §2 G8). The execution plane never shows the classifier's
// guidance — that is written for a PWA (*"PublishPwa remains blocked…"*). It shows the recorded observations as
// `code: statement` and the remediation's ACTION NAME (`routes/undertakings/[id]/+page.server.ts`, `loopEnded`). So
// beside a review refused because devin reported a model nobody selected, the name it printed was
// `RETRY_OR_CONFIGURE_REVIEWER` — the remedy the refusal forbids, in the one word the operator is shown.
//
// ⭑ WHAT MUST HOLD. The message names `VALIDATOR_MODEL_SUBSTITUTED` beside `VALIDATOR_EXECUTION_FAILED`, and the action
// `REQUALIFY_OR_RESELECT_REVIEWER` — never the retry action — and the PWA-worded guidance is NOT shown there.
//
// ⭑ THE PRODUCTION COMPOSITION, IN TEST MODE. The executor is unconfigured, so the selector answers the declared
// STAND-IN (the fixture); the reviewer is devin, NAMED with a model (test mode admits a named tool). Only devin's
// PROGRAM is replaced: `devinPrint` is the real adapter handed an exec seam that writes the ATIF export devin writes,
// naming `substituted-model` as the model it ran.
//
// ⛔ HERMETIC. devin's exec seam starts nothing; the executor's seams are replaced as `begin-execute-executor-selection
// .test.ts` replaces them (agy captured, Pi refused), though the stand-in opens neither; PATH finds no program.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What the seams saw. Hoisted: the mock factories below run before this file's body. */
const seam = vi.hoisted(() => ({
	agy: [] as { readonly file: string; readonly args: readonly string[] }[],
	pi: [] as string[],
	devin: [] as { readonly file: string; readonly args: readonly string[] }[]
}));

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	return {
		...actual,
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) =>
			actual.getExecutionSession(selection, {
				agyExec: async (file, args) => {
					seam.agy.push({ file, args });
					return { stdout: await actual.deterministicExecutionPrint(args[1] ?? '') };
				},
				openPi: async (_context, modelId) => {
					seam.pi.push(modelId);
					throw new Error('hermetic: no route test opens a real Pi session');
				}
			})
		)
	};
});

// ⭑ THE REAL devin ADAPTER, ITS PROGRAM REPLACED AT THE SEAM — so the reported model is read back from the export
// exactly as `readReportedModel` reads a real one, and `execFile` is never reached.
vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (file, args) => {
				seam.devin.push({ file, args: [...args] });
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: 'substituted-model' } }] }),
						'utf8'
					);
				// The answer is never read: the review is refused for WHO answered, before any parse.
				return { stdout: '{"findings":[],"recommendation":"SATISFIED"}' };
			})
		)
	};
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { resetEngine } from '../workbench.js';
import { beginExecute, modelWorkUnit } from './begin-execute.testing.js';

/** The eight live-backend variables — each case sets only what it names. */
const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_AGENT',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN'
] as const;

beforeEach(() => {
	resetEngine('reference');
	seam.agy.length = 0;
	seam.pi.length = 0;
	seam.devin.length = 0;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⭐ G8 — the execution plane names REQUALIFY_OR_RESELECT_REVIEWER beside a substituted reviewer', () => {
	it('⛔ devin reports another model: the message lists VALIDATOR_MODEL_SUBSTITUTED and the action REQUALIFY_OR_RESELECT_REVIEWER, never the retry action', async () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(message, 'the model step did not run to its review').toMatch(/^The model ran/);
		// ⭑ ONE CALL: the refusal draws no repair, and `autoRefine` false sends nothing back to the producer for a second
		// turn. ⚠ The message's own count says "2 tries" here — `openPerTry.length + 1` after the refused try was pushed —
		// which is not this increment's to change, and is reported rather than pinned.
		expect(seam.devin.length, 'a refused substitute was called again').toBe(1);
		for (const { args } of seam.devin)
			expect(args.slice(0, 3), 'the model devin was asked to run').toEqual([
				'--print',
				'--model',
				'fixture-assurance-model'
			]);
		expect(message).toContain("VALIDATOR_EXECUTION_FAILED: The reviewing tool 'devin' reported ");
		expect(message, 'the substitution was not recorded under its own code').toContain(
			'VALIDATOR_MODEL_SUBSTITUTED: '
		);
		expect(message, 'the operator was not shown the substitution’s own action').toContain(
			'(REQUALIFY_OR_RESELECT_REVIEWER)'
		);
		expect(message, 'the operator was told to retry the reviewer').not.toContain(
			'RETRY_OR_CONFIGURE_REVIEWER'
		);
		// ⛔ NOT THE PWA'S GUIDANCE: this plane has no PWA, and D7's text is written for one.
		expect(message).not.toContain('PublishPwa remains blocked');
		expect(seam.pi, 'arrangement: the stand-in executor opened no Pi').toEqual([]);
	});
});
