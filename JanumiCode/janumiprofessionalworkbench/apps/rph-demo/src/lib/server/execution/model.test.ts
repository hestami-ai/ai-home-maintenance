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
//   · ~~agy → the argv's `--model` is the selection's, never the judge's (it succeeds "agy returns a function");~~
//     ⭐ `JAN-MHX` MH-5 — agy's text-only executor is retired: agy is a CLI selection, opened through `deps.openCli` with its
//     driver (`tools/agy-executor-driver.ts`, whose own test pins the `--model` it passes), and a repair re-sends the work;
//   · Pi → the opener receives the selection's model and is not called until the returned opener is (it succeeds
//     "selecting pi does not import Pi");
//   · the stand-in → a turn, AWAITED, returns the fixture's envelope with the echoed basis (it succeeds a
//     `retainsHistory` check that an agy default also passed, inside a helper that never awaited its assertion).
//
// ⛔ HERMETIC. ~~agy is reached only through an injected `AgyExec`~~ ⭐ agy's CLI session is reached only through an injected
// opener, or through the real opener with a `CliExec` seam that plays agy, and PATH is pointed at an empty directory (or at
// one holding an empty file named as agy's program, which nothing starts); Pi only through an injected opener. No case
// here is one mutant away from a real spawn or a real Pi session.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryWorkspace, createRefusingProcessRunner } from '@janumipwb/rph-ports';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { cliExecutorDriver } from '../tools/cli-executor-drivers.js';
import { openCliExecutionSession, type CliExec } from '../tools/cli-executor-session.js';
import { selectExecutor, type RunnableExecutorSelection } from './executor-selection.js';
import { createFilesystemWorkspace } from './filesystem-workspace.js';
import { deterministicExecutionPrint, getExecutionSession, type ExecutionSessionDeps } from './model.js';
import { oneShotSession, type ProducerSession, type ProducerSessionContext } from './producer-session.js';

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

// ~~`const EXECUTOR_MODEL = 'fixture-executor-model';`~~ ⭐ `JAN-MHX` MH-5 — gone with the text-only agy cases that used it.
const JUDGE_MODEL = 'fixture-judge-model';

beforeEach(() => {
	vi.stubEnv('PATH', noProgramsDirectory());
	// ⭑ SET, SO THE JUDGE MODEL IS AVAILABLE TO BE WRONGLY USED: an executor that asked for it would get it ~~, and the
	// argv would show it~~ — rather than failing on an unset judge model for a reason the case is not about.
	vi.stubEnv('JPWB_JUDGE_MODEL', JUDGE_MODEL);
});
afterEach(() => {
	vi.unstubAllEnvs();
});

/** An opener that must not be reached: a case that opens a CLI session says so by handing in its own. */
const refusingCli = () =>
	vi.fn(async (): Promise<ProducerSession> => {
		throw new Error('hermetic: no CLI executor session is opened here');
	});

// ~~describe('⭐ D2 — the agy executor runs the model its selection names (REG-F-458)')~~ ⭐ `JAN-MHX` MH-5 — STRUCK WITH THE
// TEXT-ONLY agy EXECUTOR IT TESTED (`oneShotSession(agyPrintWithModel(...))`, retired in `model.ts`). Its four cases, and
// where each property went:
//   · `--model` is the selection's, never the judge's → the agy driver's argv pin (`tools/agy-executor-driver.test.ts`),
//     whose `--model` is the turn's, which the opener takes from the selection (`openCliExecutionSession`);
//   · its bounds were `agyPrint`'s → the host's bound on a CLI turn and its tree kill (`cli-executor-session.test.ts`
//     C6, C7);
//   · it needs no judge model → the agy driver reads no judge model: its argv names only the turn's;
//   · a one-shot session, and it says so → ⭐ agy's CLI session declares `retainsHistory: true`, and re-sends (below).

describe('⛔ a selection nobody wired opens NOTHING', () => {
	it('a refusal that reached the opener past the type is refused when opened — no CLI session, no Pi session', async () => {
		// ⭑ UNREACHABLE BY TYPE (`RunnableExecutorSelection`), so it is reached here by a cast: the case a route that
		// forgot to act on a refusal would produce. It must open nothing, rather than fall through to whichever tool was
		// written last — which is how an unconfigured executor once became agy.
		const openCli = refusingCli();
		const openPi = vi.fn(async () => oneShotSession(async () => 'unused'));
		const leaked = {
			kind: 'REFUSED',
			code: 'EXECUTOR_TOOL_UNSET',
			toolId: undefined,
			reason: 'fixture reason',
			guidance: 'fixture guidance'
		} as unknown as Parameters<typeof getExecutionSession>[0];
		await expect(getExecutionSession(leaked, { openCli, openPi })(SANDBOX)).rejects.toThrow(
			/No executor is wired for the selection/
		);
		expect(openCli).not.toHaveBeenCalled();
		expect(openPi).not.toHaveBeenCalled();
	});
});

// ~~describe('⭐ PER-12 — a failed agy executor call carries no prompt content into its failure (finding #60)')~~ ⭐ `JAN-MHX`
// MH-5 — STRUCK WITH THE TEXT-ONLY agy EXECUTOR: its failure was `agyCall`'s sanitised throw, and agy's CLI executor has no
// such throw. A CLI turn's failure is a code and a fixed sentence, with at most a checked excerpt of a known error shape,
// withheld when it carries the prompt or anything the host served (D19a; `cli-executor-session.test.ts` C20); and agy's
// known shape, its `AGY_ERROR` line, is read in `tools/agy-executor-driver.test.ts`.

describe('⭐ `JAN-MHX` MH-1 (D30) — a CLI selection opens through `deps.openCli`, and through nothing else', () => {
	it('⛔ M1 — deps.openCli receives the sandbox and the selection, and Pi is not reached', async () => {
		// ⭑ RED FIRST: before the `CLI` branch, the kind fell to the exhaustive refusal, "No executor is wired for the
		// selection", and opened nothing.
		const opened = oneShotSession(async () => 'unused');
		const openCli = vi.fn(async () => opened);
		const openPi = vi.fn(async () => oneShotSession(async () => 'unused'));
		const selection = { kind: 'CLI', toolId: 'agy', modelId: 'fixture-cli-model' } as const;
		const opener = getExecutionSession(selection, { openCli, openPi });
		expect(openCli, 'the CLI was opened on selection, before the opener was called').not.toHaveBeenCalled();
		const session = await opener(SANDBOX);
		expect(openCli).toHaveBeenCalledTimes(1);
		expect(openCli).toHaveBeenCalledWith(SANDBOX, selection);
		expect(session).toBe(opened);
		await session.turn('fixture turn');
		expect(openPi, 'a CLI selection reached Pi').not.toHaveBeenCalled();
	});

	it('⛔ with no driver wired for its tool, the default opener refuses, naming the tool', async () => {
		// ⭑ ~~The driver table is empty until a driver's package fills it~~ ⭐ MH-5: the table holds agy's driver alone
		// (`cli-executor-drivers.ts`), so a tool it does not hold, reached here anyway, opens nothing.
		await expect(
			getExecutionSession({ kind: 'CLI', toolId: 'fixture-unwired-cli', modelId: 'fixture-cli-model' })(SANDBOX)
		).rejects.toThrow("No CLI executor driver is wired for the tool 'fixture-unwired-cli'");
	});
});

describe('⭐ `JAN-MHX` MH-5 (D16, D30) — agy executes as a CLI: selected as one, opened through `deps.openCli` with its driver, and its repairs re-send', () => {
	const AGY_HOST = { JPWB_EXECUTOR: 'agy', JPWB_EXECUTOR_MODEL: 'gemini-4-argon-high' };
	let container = '';
	const opened: ProducerSession[] = [];
	beforeEach(() => {
		container = mkdtempSync(join(tmpdir(), 'jpwb-model-agy-'));
		// ⭑ agy's program, where the driver looks for it, on PATH: an empty file, which nothing starts — the seam plays agy.
		const programs = join(container, 'programs');
		mkdirSync(programs);
		writeFileSync(join(programs, process.platform === 'win32' ? 'agy.exe' : 'agy'), '');
		vi.stubEnv('PATH', programs);
	});
	afterEach(async () => {
		for (const session of opened.splice(0)) session.dispose();
		await new Promise((r) => setTimeout(r, 300));
		rmSync(container, { recursive: true, force: true, maxRetries: 5 });
	});

	/** The sandbox with a workspace that has a directory, which a CLI session runs beside (D13). */
	const workspaceContext = (): ProducerSessionContext => {
		const directoryPath = join(container, 'workspace');
		mkdirSync(directoryPath, { recursive: true });
		return {
			...SANDBOX,
			workspace: createFilesystemWorkspace({
				ownerKind: 'UNDERTAKING',
				ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
				purgeability: 'RETAINED_BY_PARTICIPATION',
				directoryPath
			})
		};
	};

	/** agy, as the seam plays it: `/hooks` lists none, and each turn keeps the text its stdin line carries. */
	const playedAgy =
		(sent: string[]): CliExec =>
		(request) => {
			const listing = request.args.includes('/hooks');
			if (!listing)
				sent.push((JSON.parse(request.stdin ?? '') as { message: { content: string } }).message.content);
			const stdout = listing
				? JSON.stringify({ status: 'SUCCESS', num_turns: 0, command: { name: 'hooks', data: { hooks: [] } } })
				: JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'fixture answer' } });
			return {
				done: Promise.resolve({ exitCode: 0, stdout, stdoutComplete: true, errorLines: [], errorLinesComplete: true }),
				kill: async () => undefined
			};
		};

	/** `deps.openCli`, opening the REAL CLI session with the tool's own driver from the table, on the seam above. */
	const openAgy =
		(sent: string[]): NonNullable<ExecutionSessionDeps['openCli']> =>
		async (context, selection) => {
			const driver = cliExecutorDriver(selection.toolId);
			if (driver === undefined) throw new Error(`arrangement: no driver is wired for '${selection.toolId}'`);
			const session = await openCliExecutionSession(context, selection, driver, {
				exec: playedAgy(sent),
				root: join(container, 'root')
			});
			opened.push(session);
			return session;
		};

	it('⛔ test 11 — JPWB_EXECUTOR=agy selects the CLI kind, which opens through deps.openCli with that selection', async () => {
		// ⭑ RED FIRST: the selector answered `{ kind: 'AGY', modelId }`, which opened `oneShotSession(agyPrintWithModel(...))`
		// (`model.ts`): a text-only agy, with no workspace and no tools.
		const selection = selectExecutor({ testMode: true, env: AGY_HOST });
		expect(selection).toEqual({ kind: 'CLI', toolId: 'agy', modelId: 'gemini-4-argon-high' });
		const openCli = vi.fn(async () => oneShotSession(async () => 'unused'));
		await getExecutionSession(selection as RunnableExecutorSelection, { openCli })(SANDBOX);
		expect(openCli).toHaveBeenCalledWith(SANDBOX, selection);
	});

	it('⛔ test 12 — a repair turn through agy’s session carries the instruction as it was first given, then the findings', async () => {
		// ⭑ RED FIRST: the text-only agy session sent the findings ALONE to a fresh process, a turn with no task
		// (`oneShotSession`'s `turn: (text) => call(text)`).
		const sent: string[] = [];
		const selection = selectExecutor({ testMode: true, env: AGY_HOST }) as RunnableExecutorSelection;
		const session = await getExecutionSession(selection, { openCli: openAgy(sent) })(workspaceContext());
		await session.turn('MH5-INSTRUCTION: assess the northern route.');
		await session.turn('MH5-FINDINGS: RR-01 the route was not assessed.');
		expect(sent, 'agy was not sent both tries').toHaveLength(2);
		const repair = sent[1]!;
		expect(repair, 'the repair carries the instruction as it was first given').toContain(
			'MH5-INSTRUCTION: assess the northern route.'
		);
		expect(repair, 'and the findings').toContain('MH5-FINDINGS: RR-01 the route was not assessed.');
		expect(repair.indexOf('MH5-INSTRUCTION'), 'the instruction comes before the findings').toBeLessThan(
			repair.indexOf('MH5-FINDINGS')
		);
		// ⚠ NO EARLIER ANSWER IS CARRIED, because none can arrive yet: agy's record proves no tool surface, so every agy turn
		// is CLI_SURFACE_UNPROVEN (`tools/agy-executor-driver.ts`) — and the prompt says so rather than inventing one.
		expect(repair).toContain('On try 1 no answer arrived.');
	});

	it('⛔ test 13 — agy’s session declares retainsHistory: true', async () => {
		// ⭑ RED FIRST: the text-only agy session was one-shot (`oneShotSession`: `retainsHistory: false`).
		const selection = selectExecutor({ testMode: true, env: AGY_HOST }) as RunnableExecutorSelection;
		const session = await getExecutionSession(selection, { openCli: openAgy([]) })(workspaceContext());
		expect(session.retainsHistory).toBe(true);
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
		const openCli = refusingCli();

		const opener = getExecutionSession(
			{ kind: 'PI', modelId: 'fixture-pi-model' },
			{ openPi, openCli }
		);
		expect(
			openPi,
			'Pi was opened on selection, before the opener was called'
		).not.toHaveBeenCalled();

		const session = await opener(SANDBOX);
		expect(openPi).toHaveBeenCalledTimes(1);
		expect(openPi).toHaveBeenCalledWith(SANDBOX, 'fixture-pi-model');
		expect(session).toBe(opened);
		expect(openCli, 'a Pi selection reached a CLI').not.toHaveBeenCalled();
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
		const openCli = refusingCli();
		const openPi = vi.fn(async () => oneShotSession(async () => 'unused'));
		const session = await getExecutionSession({ kind: 'STAND_IN' }, { openCli, openPi })(SANDBOX);
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
		expect(openCli).not.toHaveBeenCalled();
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
