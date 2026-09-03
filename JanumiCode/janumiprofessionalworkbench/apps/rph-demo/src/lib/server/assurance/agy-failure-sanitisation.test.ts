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

const JUDGE_ID = 'test-judge-model';

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

// ── THE COMPANION GATE REG-F-333 OWED: PROBE THE SHAPE, NOT THE NAME ─────────────────────────────────────────
// `verif/agy-stderr-unbound.test.ts` searches the demo sources for the literal token `stderr`. The leak it was
// written to prevent travelled through `err.message` and never named `stderr` at all, so that gate was
// structurally blind to it. A token search cannot be repaired by adding more tokens — the next leak will use a
// route nobody thought to name either.
//
// So this gate asserts the PROPERTY at its DESTINATION: plant a sentinel in the judge prompt, fail the agy
// subprocess, run the REAL de minimis floor, and require that the sentinel appears NOWHERE in the resulting
// assurance outcome. It exercises the real `agyPrint` (only the child process is faked), the real validator,
// and the real floor runner — the whole chain REG-F-333 traced and never gated.
import {
	createValidatorRegistry,
	identityProvenanceValidatorInstance,
	runDeMinimisFloor,
	schemaInvariantValidatorInstance,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { createAgyReasoningReviewValidator } from './reasoning-review-validator.js';

const SENTINEL = 'SENTINEL-PROMPT-CONTENT-4417';

const FLOOR_SUBJECT: AssuranceSubject = {
	subjectId: 'pwa_conformance',
	objectType: 'PROFESSIONAL_WORK_ARCHITECTURE',
	semanticVersion: 1,
	isAiProduced: true,
	producer: {
		actorType: 'AGENT',
		agentId: 'authoring-agent',
		modelId: 'executor-model',
		providerId: 'executor-provider'
	}
};

const FLOOR_CTX: ValidatorContext = {
	reasoningReview: {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		prompt: 'Author a product realization PWA',
		// The sentinel rides in the CONTENT, so it reaches the model prompt the way real graph content does.
		content: `{"pwuTypes":[{"id":"${SENTINEL}"}]}`,
		narration: ''
	}
};

describe('the whole chain: a failed agy run leaks no prompt content into the assurance outcome', () => {
	it('the sentinel appears NOWHERE in the outcome, and the run really did fail', async () => {
		const seenArgv: string[] = [];
		// Only the CHILD PROCESS is faked. The real agyPrint, the real validator and the real floor runner all
		// execute, so removing the sanitisation at the boundary reddens this.
		const exec = async (_file: string, args: readonly string[]) => {
			seenArgv.push(args.join(' '));
			const e = new Error(`Command failed: agy ${args.join(' ')}\nprovider said no`) as Error & {
				code?: number;
			};
			e.code = 1;
			throw e;
		};

		const registry = createValidatorRegistry();
		registry.register(schemaInvariantValidatorInstance);
		registry.register(identityProvenanceValidatorInstance);
		registry.register(
			createAgyReasoningReviewValidator({ print: (prompt) => agyPrint(prompt, exec), modelId: JUDGE_ID })
		);

		const outcome = await runDeMinimisFloor(FLOOR_SUBJECT, FLOOR_CTX, registry);
		const serialized = JSON.stringify(outcome);

		// POSITIVE CONTROL 1 — the sentinel really did reach the model prompt. Without this the assertion below
		// is vacuous: a run where the content never made it into argv would pass while proving nothing. This is
		// the failure mode REG-F-326 shipped.
		expect(seenArgv.join(' ')).toContain(SENTINEL);
		// POSITIVE CONTROL 2 — the failure path really was taken. A run that quietly succeeded would also
		// contain no leaked prompt.
		expect(serialized).toMatch(/VALIDATOR_EXECUTION_FAILED/);

		// THE ASSERTION. Not "no field named stderr" — no prompt content anywhere in the record, by any route.
		expect(serialized).not.toContain(SENTINEL);
	});
});
