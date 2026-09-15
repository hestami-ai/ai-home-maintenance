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
//
// ── ⭐⭐ JAN-EXEC PHASE 2b — CAPTURING OUTPUT IS A RETENTION ACT, SO THE OUTCOME DECLARES ITS DISPOSITION ─────
// `stdout` and `stderr` have been on this union since Phase 1 as plain strings, and for one phase nothing could
// produce them: the only runner was the refusing default, whose arm has no such field. The moment a REAL runner
// exists those two fields are BYTES A COMMAND EMITTED, and `REG-Q-066`'s stated bound — *"out-of-band logging
// (console/stderr from `agy-cli`) was not tested. It is outside canonical state and outside this census's
// definition of retention, but it is an unexamined escape hatch and an answer should say whether it counts"* —
// is about exactly this surface. `SPONSOR RULING R7`: **stdout and stderr are BOTH retained, and BOTH come
// under purge.**
//
// ⛔ SO `retention` IS A REQUIRED FIELD ON THE RAN ARM, NOT AN OPTIONAL ONE, AND THAT IS THE WHOLE OF ITS
// FORCE. `REG-F-336` C-2 forbids *"content on the content plane with no record on the record plane pointing at
// it"*. A runner that wrote a build's output somewhere and returned only the strings would create precisely
// that orphan — bytes on disk, nothing naming them, no purge able to reach them — and it would do so silently,
// because an outcome carrying the strings LOOKS complete. The field makes the disposition something every
// implementation must state and every reader can see, and its refusing arm makes "not retained" a declared fact
// rather than an absence.
//
// ⚠ AND THE INLINE STRINGS ARE THE TRANSIENT COPY, SAID HERE BECAUSE IT BOUNDS WHAT `retention` PROMISES. What
// `retention` names is the DURABLE copy and the only one a purge can reach; `stdout`/`stderr` are handed to the
// caller for this step and nothing in this seam persists them. ⛔ A later phase that PERSISTS the outcome must
// persist the REFERENCE and not the bytes, or it mints a second retention surface under no declared class —
// which is this same defect one plane over.
//
// ── ⚠ AND A TRUNCATED STREAM MUST SAY SO, BECAUSE A SILENT ONE IS A FABRICATED PASS ──────────────────────────
// Capture is bounded — an unbounded one is a step that exhausts the host by printing — and a bounded capture
// that does not declare its cut hands the caller a PREFIX which reads as the whole. A test result read off a
// silently truncated stdout is a pass nothing produced: `RULE 6` arriving through the output instead of through
// the exit code. `omittedRegions` is therefore required too, and it is DELIBERATELY the shape this repository
// already uses for a declared omission (`OmittedRegion` on the exchange record: what, why, how many UTF-8
// bytes, at what byte offset) rather than a `truncated: boolean` — `REG-D-057` requires the omission be
// declared *"with enough structure to undo it"*, and a flag has none.
import type { Purgeability } from './artifact-store.js';
import type { Workspace } from './workspace.js';

export interface ProcessRunRequest {
	/** Program plus arguments. ⛔ NOT A SHELL STRING — no shell is involved, so no quoting rules apply. */
	readonly argv: readonly string[];
	/** ⛔ ABSOLUTE, and derived from a `Workspace.directoryPath` by `planProcessRun`. Never assembled by hand. */
	readonly cwd: string;
	readonly timeoutMs: number;
}

/**
 * A span of a captured stream that was NOT retained, declared so the capture cannot read as complete.
 *
 * ⭑ FIELD FOR FIELD THE EXCHANGE RECORD'S `OmittedRegion`, deliberately: this repository already models a
 * declared omission, and re-deriving a narrower set unaided is `REG-F-314`'s recorded defect.
 *
 * ⚠ AND THE TYPE ITSELF IS NOT REUSED, FOR A REASON I FIRST GOT WRONG AND THEN MEASURED. The plausible reason —
 * "this package cannot depend on `rph-contracts`" — is FALSE: `rph-ports/package.json` declares that dependency
 * and `.dependency-cruiser.cjs` says outright *"rph-ports declares interfaces only; it depends solely on
 * rph-contracts."* The real reason is narrower and harder: `OmittedRegionSchema.role` is a CLOSED enum of
 * model-exchange roles (`SYSTEM_PREAMBLE` … `MODEL_ANSWER`, `OTHER`) with no member for a process stream, and
 * it is GENERATED from `vocab/m1-object-fields.json` — *"do not edit by hand"*. Reusing it would therefore mean
 * either recording every cut as `OTHER`, losing WHICH STREAM was truncated, or a vocab change plus a
 * regeneration plus a ratification, which is Phase 4 Part B's act and not this one's. So the SHAPE is adopted
 * and the type is not, and that debt is stated here rather than hidden behind an import.
 *
 * ⚠ BOTH NUMBERS ARE UTF-8 BYTES, NOT STRING LENGTHS, for the reason `OmittedRegion` states: *"They differ the
 * moment a reply is not ASCII, and a reconstruction that mixes the two units silently corrupts every
 * non-English reply."* A bound expressed in bytes and reported in characters is a fabricated measurement.
 */
export interface ProcessOutputOmission {
	readonly stream: 'STDOUT' | 'STDERR';
	readonly reason: string;
	/** UTF-8 bytes removed. */
	readonly byteSize: number;
	/** Where the removal began, as a UTF-8 byte offset into the stream the process actually emitted. */
	readonly byteOffset: number;
}

/**
 * Where a run's captured output was retained, or a stated reason it was not.
 *
 * ⛔ A UNION FOR THE THIRD TIME IN THIS FILE, AND FOR THE SAME REASON: a shape with optional paths would let a
 * caller read `stdoutPath` off a capture that was never written, and the value it would read is the one field
 * nobody could supply. ⚠ `purgeability` is carried rather than assumed because it is the fact `R7` turns on —
 * a reader must be able to see that these bytes CAN be destroyed without going and finding the workspace.
 */
export type ProcessOutputRetention =
	| {
			readonly retained: true;
			/** The `Workspace.ownerId` holding the bytes — half of what a purge needs to reach them. */
			readonly workspaceOwnerId: string;
			/** ⚠ `R7` REQUIRES THIS TO BE PURGEABLE. A workspace whose `purge` refuses cannot satisfy the ruling. */
			readonly purgeability: Purgeability;
			/** Workspace-relative, and the other half of what a purge needs. */
			readonly stdoutPath: string;
			readonly stderrPath: string;
	  }
	| { readonly retained: false; readonly notRetainedBecause: string };

export type ProcessRunOutcome =
	| {
			readonly ran: true;
			/** `null` when the process was terminated by a signal rather than exiting on its own. */
			readonly exitCode: number | null;
			/** ⚠ OBSERVED, NEVER INFERRED — see the header. */
			readonly timedOut: boolean;
			/** ⚠ THE TRANSIENT COPY. The durable one is `retention`'s, and only that one can be purged. */
			readonly stdout: string;
			readonly stderr: string;
			/** ⛔ REQUIRED, AND EMPTY MEANS "NOTHING WAS CUT" — never "nobody looked". See the header. */
			readonly omittedRegions: readonly ProcessOutputOmission[];
			/** ⛔ REQUIRED — `R7`, and `REG-F-336` C-2's orphan. See the header. */
			readonly retention: ProcessOutputRetention;
			readonly durationMs: number;
	  }
	| { readonly ran: false; readonly refusedBecause: string };

/**
 * The workspace's own directory NAME, which is what a refusal may say about WHERE.
 *
 * ⭑ EXPORTED FROM THE PORT FOR THE REASON `containedWorkspacePath` IS: *"the invariant that makes a seam lawful
 * belongs WITH the interface, so a second adapter cannot quietly implement a weaker one."* `refusedBecause` is
 * defined here as a fact a step RECORDS — so it travels into a governed record and into a model's context — and
 * the host's filesystem layout belongs in neither. That rule was stated in the refusing default and applied in
 * exactly one place; Phase 2b adds the second implementation of this port, which is precisely when a
 * one-adapter rule becomes a one-adapter rule that the other adapter does not follow.
 *
 * ⚠ THE LAST SEGMENT, NOT A TRUNCATION: it is the directory the host DERIVED from the owner id, so it names the
 * workspace to anyone who has to act on the refusal. A path with no segments at all (a filesystem root) has no
 * name, so the fallback is the path itself — which, being a root, discloses nothing about the layout above it.
 */
export function workspaceDirectoryName(cwd: string): string {
	return cwd.split(/[\\/]+/).filter((segment) => segment !== '').at(-1) ?? cwd;
}

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
