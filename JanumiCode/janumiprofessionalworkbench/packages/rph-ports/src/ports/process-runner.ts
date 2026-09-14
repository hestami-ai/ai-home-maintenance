// ProcessRunner port — running a command on behalf of an execution step.
//
// ── ⭑ THE OUTCOME IS A UNION, NOT A RESULT WITH AN ERROR FIELD, AND THAT IS THE WHOLE POINT ──────────────────
// `exitCode: 0` from a runner that ran nothing is INDISTINGUISHABLE, downstream, from a command that ran and
// passed — and a step, a test, or an assurance policy reading it would record a passing result nothing
// produced. A runner that will not run says `ran: false` and gives a reason, and the type makes it impossible
// to read an exit code off that arm. Were the outcome one shape with an optional error, the refusing default
// would have to INVENT an exit code to fill the field, which is the fabrication stated as a design.
//
// ── ⚠ `timedOut` IS ITS OWN FIELD AND IS NEVER INFERRED FROM THE EXIT CODE ───────────────────────────────────
// §36.2 separates a `TIMEOUT` failure class from `TOOL_FAILURE`, so the two must stay distinguishable in the
// record. They cannot be told apart after the fact: a SIGKILLed process reports `null` on Windows rather than
// a distinguishable number, and a program that chose to exit non-zero is not a timeout. The runner OBSERVED
// the kill; the caller must never have to guess it back out.
//
// ── ⛔ AND THE TWO PORTS ARE NOT INDEPENDENT ─────────────────────────────────────────────────────────────────
// `cwd` must be a real directory, and an IN_MEMORY `Workspace` has none. `planProcessRun` below is the only
// sanctioned way to build a request, precisely so that "wire a REAL runner against an IN_MEMORY workspace" is
// refused BEFORE anything starts rather than silently executed somewhere else.
import type { Workspace } from './workspace.js';

export interface ProcessRunRequest {
	/** Program plus arguments. ⛔ NOT A SHELL STRING — no shell is involved, so no quoting rules apply. */
	readonly argv: readonly string[];
	/** ⛔ ABSOLUTE, and derived from a `Workspace.directoryPath` by `planProcessRun`. Never assembled by hand. */
	readonly cwd: string;
	readonly timeoutMs: number;
}

export type ProcessRunOutcome =
	| {
			readonly ran: true;
			/** `null` when the process was terminated by a signal rather than exiting on its own. */
			readonly exitCode: number | null;
			/** ⚠ OBSERVED, NEVER INFERRED — see the header. */
			readonly timedOut: boolean;
			readonly stdout: string;
			readonly stderr: string;
			readonly durationMs: number;
	  }
	| { readonly ran: false; readonly refusedBecause: string };

export interface ProcessRunner {
	/**
	 * Whether this runner can actually start a process.
	 *
	 * ⭑ DECLARED, MIRRORING `ArtifactStore.durability` and `Workspace.materialization`. A caller assembling a
	 * step's evidence is entitled to know it was talking to the refusing default BEFORE it writes "the command
	 * ran" anywhere.
	 */
	readonly kind: 'REAL' | 'REFUSING';
	run(request: ProcessRunRequest): Promise<ProcessRunOutcome>;
}

/**
 * A request that may lawfully be run, or a stated reason there is none.
 *
 * ⛔ A UNION FOR THE SAME REASON `ProcessRunOutcome` IS ONE: a plan-shaped object with an optional error would
 * let a caller read `request.cwd` off a plan that was refused, and the value it would read is the one field
 * nobody could supply — which is the failure this whole check exists to prevent.
 */
export type ProcessRunPlan =
	| { readonly planned: true; readonly request: ProcessRunRequest }
	| { readonly planned: false; readonly refusedBecause: string };

/** What a run needs to be planned: the two ports, plus what to run and for how long. */
export interface ProcessRunPlanInput {
	readonly runner: Pick<ProcessRunner, 'kind'>;
	readonly workspace: Pick<
		Workspace,
		'ownerId' | 'ownerKind' | 'materialization' | 'directoryPath'
	>;
	readonly argv: readonly string[];
	readonly timeoutMs: number;
}

/**
 * Derive a runnable request from a workspace, or refuse and say why — BEFORE anything starts.
 *
 * ⭑⭑ THIS EXISTS SO THE CHECK CANNOT BE SKIPPED BY OMISSION. `cwd` is a required field on `ProcessRunRequest`,
 * so a caller that assembled one by hand would have to put SOMETHING there, and the obvious something is
 * `process.cwd()` — the server's own source tree. That is not a hypothetical: `openPiExecutionSession`
 * hardcodes `process.cwd()` twice today. Making the only sanctioned constructor of a request read the
 * workspace's OWN `directoryPath` is what turns "the host should wire this correctly" into something the host
 * cannot get wrong quietly.
 *
 * ⚠ IT REFUSES AN IN_MEMORY WORKSPACE FOR EITHER RUNNER KIND, AND THE MESSAGES DIFFER ON PURPOSE. With a
 * REFUSING runner the combination is the library's own hermetic default and the refusal is expected; with a
 * REAL one it is a WIRING ERROR whose unguarded consequence is a command executing in some other directory.
 * Collapsing the two into one message would make a misconfiguration read exactly like the default.
 */
export function planProcessRun(input: ProcessRunPlanInput): ProcessRunPlan {
	const named = `${input.workspace.ownerKind} '${input.workspace.ownerId}'`;
	// ⛔ NOTHING TO START IS NOT AN EMPTY COMMAND. An empty argv would reach `spawn` as a missing program and
	// surface as a thrown ENOENT, which is a stack trace where a refusal belongs.
	if (input.argv.length === 0 || input.argv[0] === '')
		return {
			planned: false,
			refusedBecause: `No program was named, so nothing can be run in the workspace of ${named}. argv[0] is the program; an empty argv is a run with nothing to start, not a run of an empty command.`
		};
	// ⛔ A NON-POSITIVE OR NON-FINITE TIMEOUT WOULD MAKE `timedOut` A FABRICATION. Zero kills the process before
	// it can do anything and reports a TIMEOUT for a command that never ran; Infinity means §36.2's TIMEOUT
	// class can never be reached at all. Both turn an OBSERVED fact into an artifact of configuration.
	if (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0)
		return {
			planned: false,
			refusedBecause: `A timeout of ${String(input.timeoutMs)}ms cannot be honoured. §36.2 separates TIMEOUT from TOOL_FAILURE, and a non-positive or non-finite bound makes 'timedOut' an artifact of configuration rather than something the runner observed.`
		};
	if (input.workspace.materialization !== 'FILESYSTEM')
		return {
			planned: false,
			refusedBecause:
				input.runner.kind === 'REAL'
					? `The workspace of ${named} is ${input.workspace.materialization} and has no directory on disk, but the wired ProcessRunner is REAL. This is a HOST WIRING ERROR and it is refused before anything starts: a real runner needs a real cwd, and the alternative to refusing is that '${input.argv.join(' ')}' executes in some other directory — the server's own source tree — while the record says it ran in the workspace.`
					: `The workspace of ${named} is ${input.workspace.materialization} and has no directory on disk, and the wired ProcessRunner is REFUSING. This is the library's hermetic default rather than a misconfiguration: nothing is executable here, so '${input.argv.join(' ')}' was not run. Supply a FILESYSTEM workspace and a REAL runner to execute commands.`
		};
	// A FILESYSTEM workspace with no directory contradicts its own declaration. Trusting the enum and reading
	// `directoryPath!` would hand `undefined` to `spawn`, which resolves to the parent process's cwd — the
	// exact escape this function exists to close, arriving through the arm that was supposed to be safe.
	const cwd = input.workspace.directoryPath;
	if (cwd === undefined || cwd === '')
		return {
			planned: false,
			refusedBecause: `The workspace of ${named} declares materialization FILESYSTEM but carries no directoryPath, so there is no cwd to run in. The declaration and the field disagree, and a runner handed no cwd inherits the parent process's — which is the containment failure this check exists to prevent.`
		};
	return { planned: true, request: { argv: input.argv, cwd, timeoutMs: input.timeoutMs } };
}
