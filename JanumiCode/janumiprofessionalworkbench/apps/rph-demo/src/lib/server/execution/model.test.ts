// JAN-TOOLSUITE TS-02/TS-03 — which tool executes a work unit. ⭐ `JAN-SELRES` RS-1 (D2, D4): and it runs the model its
// SELECTION names.
//
// ⚠ THIS FILE EXISTS BECAUSE ITS ABSENCE MADE A GREEN GATE MEANINGLESS. `getExecutionPrint` had NO test, so
// wiring the backing-tool suite into it left 235 tests passing while nothing exercised the new branch at all.
// A suite that cannot redden for a change is not evidence about that change.
//
// ⭐ `JAN-SELRES` RS-1 — WHAT CHANGED, AND WHERE THE OLD ASSERTIONS WENT (design §4.5). `getExecutionSession` no longer
// chooses: `selectExecutor` does, before dispatch (`executor-selection.ts`), and this opens what the selection names.
// So the refusals this file held (unset and unknown tool) and the test-mode cases (agy configured, `JPWB_ASSESSOR`
// alone) MOVED to `executor-selection.test.ts`, each named there as the successor of the case it replaces. What stays
// here is what OPENING does, and each case is stronger than the one it succeeds:
//   · agy → the argv's `--model` is the selection's, never the judge's (it succeeds "agy returns a function");
//   · Pi → the opener receives the selection's model and is not called until the returned opener is (it succeeds
//     "selecting pi does not import Pi");
//   · the stand-in → a turn, AWAITED, returns the fixture's envelope with the echoed basis (it succeeds a
//     `retainsHistory` check that an agy default also passed, inside a helper that never awaited its assertion).
//
// ⛔ HERMETIC. agy is reached only through an injected `AgyExec`, with PATH pointed at an empty directory; Pi only
// through an injected opener. No case here is one mutant away from a real spawn or a real Pi session.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryWorkspace, createRefusingProcessRunner } from '@janumipwb/rph-ports';
import { agyPrint, type AgyExec } from '../assurance/agy-cli.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { deterministicExecutionPrint, getExecutionSession } from './model.js';
import { oneShotSession, type ProducerSessionContext } from './producer-session.js';

/** The sandbox an opener is handed. ⚠ IN_MEMORY + REFUSING is the hermetic pairing every spec runs under:
 *  no spec gains a real filesystem or a real child process, which is why the defaults exist. */
const SANDBOX: ProducerSessionContext = {
	workspace: createInMemoryWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_model_test',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	}),
	runner: createRefusingProcessRunner(),
	// ⛔ JAN-EXEC PHASE 3 — AND THE GRANT IS EMPTY, WHICH IS THE HERMETIC DEFAULT FOR THE SAME REASON THE PORTS
	// ARE. An empty grant mints NO tools, so no spec in this suite hands a model a filesystem seam or a child
	// process by accident. A spec that means to exercise a minted surface says so by naming the capability.
	grantedCapabilities: [],
	// ⛔ JAN-EXEC `B-1` — AND THE STATUS IS SAID TOO. A capability list is not an authorization:
	// `RevokeRuntimeCapability` leaves the list intact, so a context carrying only the list cannot tell a live
	// binding from a revoked one. ⚠ AUTHORIZED here rather than `''`, so this fixture exercises the arm that
	// LETS minting proceed — a fixture that refused for the wrong reason would make every spec below green
	// without any of them meaning what they say.
	bindingAuthorizationStatus: 'AUTHORIZED'
};

const EXECUTOR_MODEL = 'fixture-executor-model';
const JUDGE_MODEL = 'fixture-judge-model';

beforeEach(() => {
	vi.stubEnv('PATH', noProgramsDirectory());
	// ⭑ SET, SO THE JUDGE MODEL IS AVAILABLE TO BE WRONGLY USED: an executor that asked for it would get it, and the
	// argv would show it — rather than failing on an unset judge model for a reason the case is not about.
	vi.stubEnv('JPWB_JUDGE_MODEL', JUDGE_MODEL);
});
afterEach(() => {
	vi.unstubAllEnvs();
});

/** An exec that records the argv (and, when handed a list, the exec options) and answers with the fixture's
 *  envelope — nothing is spawned. */
function capturingExec(
	argv: (readonly string[])[],
	options: Parameters<AgyExec>[2][] = []
): AgyExec {
	return async (_file, args, opts) => {
		argv.push(args);
		options.push(opts);
		return { stdout: await deterministicExecutionPrint(args[1] ?? '') };
	};
}

describe('⭐ D2 — the agy executor runs the model its selection names (REG-F-458)', () => {
	it('⛔ --model is the SELECTION’s model, never the judge model', async () => {
		// ⭑ RED FIRST (roadmap RS-1 step 1): with the seam in and D2 not, this read the judge model —
		// `expected 'fixture-judge-model' to be 'fixture-executor-model'`. It SUCCEEDS `model.test.ts`'s "agy returns a
		// function", which a function returning the judge's call also passed.
		const argv: (readonly string[])[] = [];
		const session = await getExecutionSession(
			{ kind: 'AGY', modelId: EXECUTOR_MODEL },
			{ agyExec: capturingExec(argv) }
		)(SANDBOX);
		await session.turn('Assess the northern route.');
		expect(argv).toHaveLength(1);
		const args = argv[0]!;
		expect(args[args.indexOf('--model') + 1]).toBe(EXECUTOR_MODEL);
		expect(args).not.toContain(JUDGE_MODEL);
		// ⭑ AND IT IS `agyPrint`'s ARGV IN EVERY OTHER RESPECT — one implementation, so the two cannot drift.
		expect(args).toEqual([
			'--print',
			'Assess the northern route.',
			'--print-timeout',
			'3m',
			'--model',
			EXECUTOR_MODEL
		]);
	});

	it('⛔ and its BOUNDS are `agyPrint`’s — the same kill, buffer and hidden window, handed to the same exec', async () => {
		// ⭑ ONE IMPLEMENTATION IS THE CLAIM (`agy-cli.ts`: "the argv, the bounds and the sanitising catch cannot drift
		// apart"), and only the JUDGE's kill was pinned (`scripts/reviewer-qual/transports.ts`). A drift keyed on the
		// role inside that one implementation — the executor's call with no timeout — was seen by nothing
		// (`JAN-SELRES` RS-1's verification, ADV-M3). So the executor's options are compared with what `agyPrint` hands
		// the same exec, and both with the values themselves.
		const judgeOptions: Parameters<AgyExec>[2][] = [];
		await agyPrint('Assess the northern route.', capturingExec([], judgeOptions));
		const executorOptions: Parameters<AgyExec>[2][] = [];
		const session = await getExecutionSession(
			{ kind: 'AGY', modelId: EXECUTOR_MODEL },
			{ agyExec: capturingExec([], executorOptions) }
		)(SANDBOX);
		await session.turn('Assess the northern route.');
		expect(judgeOptions).toHaveLength(1);
		expect(executorOptions).toHaveLength(1);
		expect(
			executorOptions[0],
			'the executor’s agy call is bounded differently from the judge’s'
		).toEqual(judgeOptions[0]);
		expect(executorOptions[0]).toEqual({
			timeout: 240_000,
			maxBuffer: 16 * 1024 * 1024,
			windowsHide: true
		});
	});

	it('⭑ the executor needs no judge model — with JPWB_JUDGE_MODEL unset the agy executor still runs', async () => {
		vi.stubEnv('JPWB_JUDGE_MODEL', undefined);
		const argv: (readonly string[])[] = [];
		const session = await getExecutionSession(
			{ kind: 'AGY', modelId: EXECUTOR_MODEL },
			{ agyExec: capturingExec(argv) }
		)(SANDBOX);
		await expect(session.turn('Assess the northern route.')).resolves.toBeTypeOf('string');
		expect(argv).toHaveLength(1);
	});

	it('⭑ a one-shot session, and it says so', async () => {
		const session = await getExecutionSession(
			{ kind: 'AGY', modelId: EXECUTOR_MODEL },
			{ agyExec: capturingExec([]) }
		)(SANDBOX);
		expect(session.retainsHistory).toBe(false);
	});
});

describe('⛔ a selection nobody wired opens NOTHING', () => {
	it('a refusal that reached the opener past the type is refused when opened — no agy call, no Pi session', async () => {
		// ⭑ UNREACHABLE BY TYPE (`RunnableExecutorSelection`), so it is reached here by a cast: the case a route that
		// forgot to act on a refusal would produce. It must open nothing, rather than fall through to whichever tool was
		// written last — which is how an unconfigured executor once became agy.
		const agyExec = vi.fn(capturingExec([]));
		const openPi = vi.fn(async () => oneShotSession(async () => 'unused'));
		const leaked = {
			kind: 'REFUSED',
			code: 'EXECUTOR_TOOL_UNSET',
			toolId: undefined,
			reason: 'fixture reason',
			guidance: 'fixture guidance'
		} as unknown as Parameters<typeof getExecutionSession>[0];
		await expect(getExecutionSession(leaked, { agyExec, openPi })(SANDBOX)).rejects.toThrow(
			/No executor is wired for the selection/
		);
		expect(agyExec).not.toHaveBeenCalled();
		expect(openPi).not.toHaveBeenCalled();
	});
});

describe('⭐ PER-12 — a failed agy executor call carries no prompt content into its failure (finding #60)', () => {
	// ⛔ THE EXECUTION PLANE HAS NO SANITISER OF ITS OWN: `runModelInvocationStep` writes the failure message into the
	// EXECUTION exchange record and the step's failure reason. So the executor's call must be sanitised where the
	// judge's is — `agy-failure-sanitisation.test.ts`'s cases, reached through the executor's own seam.
	const PROMPT = 'EXECUTE-THIS-INSTRUCTION-SECRET-CONTENT';
	const STDERR =
		'Error: invalid model selection (--model "X"): not recognized\nAvailable models:\n  A\n  B';

	/** A stand-in for Node's execFile rejection, shaped exactly as Node shapes it. */
	const rejectingExec: AgyExec = async (_file, args) => {
		const e = new Error(`Command failed: agy ${args.join(' ')}\n${STDERR}`) as Error & {
			stderr?: string;
			code?: number;
		};
		e.stderr = STDERR;
		e.code = 1;
		throw e;
	};

	async function failureOfOneTurn(): Promise<string> {
		const session = await getExecutionSession(
			{ kind: 'AGY', modelId: EXECUTOR_MODEL },
			{ agyExec: rejectingExec }
		)(SANDBOX);
		let msg = '';
		await Promise.resolve(session.turn(PROMPT)).catch((e: Error) => (msg = e.message));
		return msg;
	}

	it('the failure detail does NOT contain the prompt, nor raw stderr — and it DID fail', async () => {
		const msg = await failureOfOneTurn();
		expect(
			msg.length,
			'it did not throw — an empty message would pass the lines below vacuously'
		).toBeGreaterThan(0);
		expect(msg).not.toContain(PROMPT);
		// ⭑ NOT A FRAGMENT EITHER — either half of the instruction would be content the record may not carry.
		expect(msg).not.toMatch(/EXECUTE-THIS|SECRET-CONTENT/);
		expect(msg).not.toContain('Available models');
		expect(msg).not.toContain(STDERR);
	});

	it('but it stays CLASSIFIABLE, and names the EXECUTOR’s record — not the judge’s', async () => {
		const msg = await failureOfOneTurn();
		expect(msg).toMatch(/^agy invocation failed \(exit 1\)\./);
		expect(msg).toMatch(/WITHHELD from the record plane/);
		// ⭑ THE ROLE IS LOAD-BEARING: the executor's text names the prompt it carried and the record it would reach.
		expect(msg).toContain('entire work-unit instruction');
		expect(msg).toContain('the EXECUTION exchange record');
		expect(msg).not.toContain('judge prompt');
		expect(msg).not.toContain('VALIDATOR_EXECUTION_FAILED');
	});
});

describe('⭐ D4 — Pi is opened with the selection’s model, and only when the opener is called', () => {
	it('⛔ deps.openPi receives the SELECTION’s model and the sandbox, and is not called until the returned opener is', async () => {
		// ⭑ SUCCEEDS "selecting pi does NOT spawn or import Pi until the call is actually made": that case could only
		// show a function came back. This shows the seam is untouched by selecting, and what it is handed when opened.
		// ⚠ The process names ANOTHER model, so an opener that read the environment would be seen doing it.
		vi.stubEnv('JPWB_EXECUTOR_MODEL', 'from-the-environment');
		const opened = oneShotSession(async () => 'unused');
		const openPi = vi.fn(async () => opened);
		const agyExec = vi.fn(capturingExec([]));

		const opener = getExecutionSession(
			{ kind: 'PI', modelId: 'fixture-pi-model' },
			{ openPi, agyExec }
		);
		expect(
			openPi,
			'Pi was opened on selection, before the opener was called'
		).not.toHaveBeenCalled();

		const session = await opener(SANDBOX);
		expect(openPi).toHaveBeenCalledTimes(1);
		expect(openPi).toHaveBeenCalledWith(SANDBOX, 'fixture-pi-model');
		expect(session).toBe(opened);
		expect(agyExec, 'a Pi selection reached agy').not.toHaveBeenCalled();
	});

	it('⛔ pi-executor.ts reads the model it is HANDED — neither `executorModel` nor `JPWB_EXECUTOR_MODEL`', () => {
		// ⭑ A SOURCE ASSERTION, BECAUSE THE ADAPTER CANNOT BE LOADED HERE: it imports Pi's SDK at module scope, which ~~the
		// gate never loads~~ ⭐ this file does not load (`server-directory-containment.test.ts` gives the same reason for
		// its own). A structural walk, never a grep, so its prose may still explain what it no longer does.
		const reads = environmentModelReads(readSource('../tools/pi-executor.ts'));
		expect(reads, 'pi-executor.ts reads the executor model itself').toEqual([]);
		// …and it hands the label it was given to the resolver.
		expect(readSource('../tools/pi-executor.ts')).toContain(
			'const model = resolveExecutingModel(modelRegistry, modelId);'
		);
	});

	it('⭑ CONTROL — the walk sees each read it forbids, and ignores a mention', () => {
		expect(
			environmentModelReads(
				[
					"import { executorModel } from './backing-tool.js';",
					'const a = executorModel();',
					'const b = process.env.JPWB_EXECUTOR_MODEL;',
					"const c = process.env['JPWB_EXECUTOR_MODEL'];",
					'const d = resolveExecutorModel();',
					'// executorModel and JPWB_EXECUTOR_MODEL, mentioned only',
					"const e = 'JPWB_EXECUTOR_MODEL is set to x';"
				].join('\n')
			)
		).toEqual([
			'identifier executorModel',
			'identifier executorModel',
			'property JPWB_EXECUTOR_MODEL',
			'element JPWB_EXECUTOR_MODEL',
			'identifier resolveExecutorModel'
		]);
	});
});

/** A source file beside this one, as text. */
function readSource(relative: string): string {
	return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

/**
 * Every place `source` READS the executor model itself: the retired accessor or the resolver named as an identifier, or
 * the variable read by property or by element. ⚠ A string that merely MENTIONS the variable — the refusal text naming
 * it — is not a read, and is not reported.
 */
function environmentModelReads(source: string): string[] {
	const sf = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
	const out: string[] = [];
	const visit = (n: ts.Node): void => {
		if (ts.isIdentifier(n) && (n.text === 'executorModel' || n.text === 'resolveExecutorModel'))
			out.push(`identifier ${n.text}`);
		if (ts.isPropertyAccessExpression(n) && n.name.text === 'JPWB_EXECUTOR_MODEL')
			out.push('property JPWB_EXECUTOR_MODEL');
		if (
			ts.isElementAccessExpression(n) &&
			ts.isStringLiteralLike(n.argumentExpression) &&
			n.argumentExpression.text === 'JPWB_EXECUTOR_MODEL'
		)
			out.push('element JPWB_EXECUTOR_MODEL');
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

describe('⭐ the STAND-IN — the gate’s fixture executor survives, and is proven to (design §4.2)', () => {
	it('⭑⭑ opened and turned with the call AWAITED, it returns the fixture’s envelope with the echoed basis', async () => {
		// ⛔ THE MOST IMPORTANT ASSERTION IN THIS FILE. If this regresses, every gate run starts spawning real model calls:
		// slow, billed, non-deterministic, and network-dependent. ⭑ It SUCCEEDS a case whose `retainsHistory` check an
		// agy session also passed, inside a helper that never awaited its assertion — so it could not fail.
		const agyExec = vi.fn(capturingExec([]));
		const openPi = vi.fn(async () => oneShotSession(async () => 'unused'));
		const session = await getExecutionSession({ kind: 'STAND_IN' }, { agyExec, openPi })(SANDBOX);
		const answer = await session.turn('Assess the northern route against the safety rubric.');
		expect(typeof answer, 'the fixture answers with a bare string').toBe('string');
		const parsed = JSON.parse(answer as string) as {
			workProduct?: { finding?: string; basis?: string };
			rationale?: { rationale?: string };
		};
		expect(parsed.workProduct?.finding).toBe('Assessment complete.');
		expect(parsed.workProduct?.basis).toBe('Assess the northern route against the safety rubric.');
		expect(
			parsed.rationale?.rationale,
			'the fixture must honour the execution contract'
		).toBeTruthy();
		expect(session.retainsHistory).toBe(false);
		// ⭑ AND IT TOUCHED NEITHER RUNNABLE SEAM: the stand-in is the fixture, not a real tool that happened to answer.
		expect(agyExec).not.toHaveBeenCalled();
		expect(openPi).not.toHaveBeenCalled();
	});

	it('⭑ CONTROL — the deterministic fixture answers in the DELIMITED shape retention requires', async () => {
		// Without this control the cases above are satisfiable by "everything throws". And the shape matters:
		// `REG-F-351` records that the §9.7 split locates a JSON object, so an UNDELIMITED prose answer is
		// blocked from retention and a step's work product is never kept.
		const answer = await deterministicExecutionPrint(
			'Assess the northern route against the safety rubric.'
		);
		const parsed = JSON.parse(answer) as {
			workProduct?: { finding?: string; basis?: string };
			rationale?: { rationale?: string };
		};
		expect(parsed.workProduct?.finding).toBeTruthy();
		// It echoes a fragment of the prompt, so a test can prove the model SAW the rendered template.
		expect(parsed.workProduct?.basis).toContain('Assess the northern route');
		// ⭑ AND IT MODELS A COMPLIANT ANSWER (`JAN-EXECRAT`). A fixture that omitted the rationale would take the
		// shortfall branch on every gate run, so the compliant path would be exercised by nothing.
		expect(
			parsed.rationale?.rationale,
			'the fixture must honour the execution contract'
		).toBeTruthy();
	});
});
