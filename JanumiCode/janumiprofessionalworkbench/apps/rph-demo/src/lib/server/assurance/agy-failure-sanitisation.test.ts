// The agy failure path leaks the ENTIRE judge prompt into a permanent, projected record.
//
// ── THE LEAK, MEASURED ──────────────────────────────────────────────────────────────────────────────────────
// `agyPrint` calls `promisify(execFile)` and does not catch. Node's rejection message is:
//     Command failed: agy --print <THE ENTIRE PROMPT> --model <model>
//     <THE ENTIRE STDERR>
// Verified first-hand: the message contains the prompt verbatim, and carries 559 bytes of stderr besides.
//
// That error is caught at `packages/rph-assurance/src/validators.ts:307` and passed as `reason` into
// `failedResult`, which places it VERBATIM into a `VALIDATOR_EXECUTION_FAILED` observation `statement`. Those
// observations are dispatched through `RecordAssuranceObservation` and projected onto the assurance view.
//
// So on every agy failure the full materialized prompt — graph export, rubric, the producer's declared
// rationale, its narration — lands in a permanent projected record. PER-12: reasoning is "never logged, never
// projected". PER-9: retention is "subject to recorded redaction", and no redaction exists anywhere in this
// codebase (finding #60). And per REG-F-331 every agy call currently fails, so this is not theoretical.
//
// ── ⚠ IT ALSO REFUTES MY OWN ANSWER FROM THIS MORNING ───────────────────────────────────────────────────────
// REG-F-326 answered REG-Q-066's stated bound with "the stderr hatch does not count, because it is CLOSED BY
// NON-USE", and gated it with `verif/agy-stderr-unbound.test.ts` — a probe for the literal token `stderr`.
// But stderr reaches the record through `err.message`, and the demo never names `stderr` to do it. The gate is
// structurally blind to the leak it was written to prevent: it searched for the NAME while the leak travels by
// SHAPE. That is the defect class this repository records most often, committed inside an entry about it.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { agyPrint } from './agy-cli.js';

// ⚠ THE MODEL MUST BE CONFIGURED OR THESE TESTS PASS FOR THE WRONG REASON. Without it `judgeModel()` refuses
// BEFORE the exec is reached (REG-D-052), and the assertions below — which only check that the thrown message
// omits the prompt — are satisfied by that unrelated refusal. Caught when the CONTROL failed while the two
// leak assertions passed: the leak tests were green against a code path they never entered.
const KEY = 'JPWB_JUDGE_MODEL';
let original: string | undefined;
beforeEach(() => {
	original = process.env[KEY];
	process.env[KEY] = 'test-judge-model';
});
afterEach(() => {
	if (original === undefined) delete process.env[KEY];
	else process.env[KEY] = original;
});

const PROMPT = 'JUDGE-THIS-GRAPH-SECRET-CONTENT';
const STDERR = 'Error: invalid model selection (--model "X"): not recognized\nAvailable models:\n  A\n  B';

/** A stand-in for Node's execFile rejection, shaped exactly as Node shapes it. */
function rejectingExec() {
	return async () => {
		const e = new Error(`Command failed: agy --print ${PROMPT} --model X\n${STDERR}`) as Error & {
			stderr?: string;
			code?: number;
		};
		e.stderr = STDERR;
		e.code = 1;
		throw e;
	};
}

describe('agyPrint — a failure must not carry prompt content into the record plane', () => {
	it('the thrown message does NOT contain the prompt', async () => {
		// THE MUTANT: rethrow the original error, which is what shipped. Its message embeds the full argv, and
		// argv carries the whole prompt.
		let msg = '';
		await agyPrint(PROMPT, rejectingExec()).catch((e: Error) => (msg = e.message));
		expect(msg).not.toContain(PROMPT);
		expect(msg.length).toBeGreaterThan(0); // it DID throw — an empty message would pass the line above vacuously
	});

	it('the thrown message does NOT contain raw stderr', async () => {
		// stderr is provider output and may echo prompt content. It is diagnosable material for the LOG plane,
		// where PER-9 says redaction is legal — not for an observation statement, which is the record plane.
		let msg = '';
		await agyPrint(PROMPT, rejectingExec()).catch((e: Error) => (msg = e.message));
		expect(msg).not.toContain('Available models');
		expect(msg).not.toContain(STDERR);
	});

	it('but the failure stays CLASSIFIABLE — it says what failed and how', async () => {
		// THE MUTANT: throw a bare 'failed'. Sanitising must not become silencing: a caller has to be able to
		// tell an agy invocation failure from any other error, or the disclosure is worse than the leak.
		let msg = '';
		await agyPrint(PROMPT, rejectingExec()).catch((e: Error) => (msg = e.message));
		expect(msg).toMatch(/agy/i);
		expect(msg).toMatch(/withheld|redact|record plane/i);
	});

	it('CONTROL — a SUCCESSFUL call still returns stdout unchanged', async () => {
		// Without this the fix could not be told apart from "always throw".
		const ok = async () => ({ stdout: '{"recommendation":"SATISFIED"}', stderr: '' });
		expect(await agyPrint(PROMPT, ok)).toBe('{"recommendation":"SATISFIED"}');
	});
});
