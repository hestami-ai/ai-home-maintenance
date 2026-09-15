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
// a distinguishable number, and a program that chose to exit non-zero is not a timeout.
//
// ⛔ AND WHAT "OBSERVED" MEANS HERE WAS ITSELF A FABRICATION, CORRECTED BY MEASUREMENT. This paragraph used to
// read *"The runner OBSERVED the kill"*, and an adversary drove `timedOut: true` for a child that had written
// its whole output and exited 0 in about ten milliseconds. Two facts explain it and both are measured rather
// than assumed:
//   1. `child.kill()` ON AN ALREADY-EXITED CHILD IS A NO-OP THAT DOES NOT SAY SO CONSISTENTLY. Driven on this
//      host against a child that exited at 151ms and a kill issued at 2000ms: **bun returned `true`** and
//      **node returned `false`**. So the kill's own return value cannot carry this field on a repository that
//      runs both runtimes.
//   2. A RUNNER THAT SETTLES ON THE STDIO STREAMS RATHER THAN ON THE CHILD REACHES ITS DEADLINE ROUTINELY —
//      see the next section — so the timer fires for processes that finished long before it.
// ⭐ THE OBSERVATION THAT IS SOUND IS **WHETHER THE CHILD WAS STILL RUNNING WHEN THE DEADLINE PASSED**, taken
// from the `exit` event and nothing else. A deadline that passes over a child which has already exited is not
// a timeout, whatever the kill returns.

// ── ⛔ AND THE OUTCOME IS DERIVED FROM THE CHILD, NEVER FROM THE STDIO STREAMS ───────────────────────────────
// `close` fires when the last pipe is released, and a pipe survives its child: a grandchild that inherited the
// descriptors keeps it open for as long as it lives. Driven — a child that spawns a DETACHED grandchild with
// `stdio: 'inherit'` and exits immediately — `exit` arrived at 151ms with code 0 and `close` **NEVER ARRIVED**;
// a runner whose only settle path was `close` was still pending 9 seconds after a 2-second timeout. ⛔ THAT IS
// THE WORST OUTCOME THIS PORT CAN HAVE, because the whole premise below is *"a refusal is a fact a step can
// record"* — and there is no fact at all. **`run` MUST ALWAYS SETTLE.** An implementation settles on the CHILD,
// drains what has arrived under its own bound, and says whether the streams were still open when it did —
// which is what `outputComplete` is for.
//
// ── ⛔ AND THE TWO PORTS ARE NOT INDEPENDENT ─────────────────────────────────────────────────────────────────
// `cwd` must be a real directory, and an IN_MEMORY `Workspace` has none. `planProcessRun` below refuses "wire a
// REAL runner against an IN_MEMORY workspace" BEFORE anything starts rather than letting it be silently
// executed somewhere else.
//
// ⛔ BUT IT IS A CONVENIENCE AND NOT A CONTROL, AND THAT IS SAID HERE BECAUSE IT USED TO READ AS ONE. This
// paragraph called it *"the only sanctioned way to build a request"*; `ProcessRunRequest` is a plain interface
// any caller can fill in, the function had ZERO production call sites, and an adversary drove
// `run({ argv: [...], cwd: <this repository's root> })` straight past it — the command executed in the server's
// own tree, which is the single outcome this seam exists to prevent. **A CONVENTION WITH NO CALL SITES IS NOT A
// CONTROL.** The check that binds is in the ADAPTER: a runner is constructed against the workspace it may run
// in, so it can compare the `cwd` it was handed against the only directory that is lawful and REFUSE. Planning
// stays useful — it refuses the combination early, and it is where a `cwd` a caller never chose comes from —
// but nothing downstream may rely on it having been called.

// ── ⛔ THE NO-SHELL GUARANTEE HAS A PRECONDITION ON WINDOWS, AND IT IS A REFUSAL RATHER THAN A CAVEAT ────────
// `ProcessRunRequest.argv` promises that no quoting rule applies. ⚠ THAT PROMISE CANNOT BE KEPT FOR A `.bat` OR
// `.cmd` TARGET, because Win32 cannot load one as a program image: the runtime hands it to `cmd.exe`, which
// re-parses the whole command line and interprets `&`, `|`, `>` and `"` inside ARGUMENTS. Node closed this as
// CVE-2024-27980 by raising `EINVAL` for such a target unless `shell: true` is stated; **bun has no equivalent
// guard**, and bun is this repository's declared package manager and the runtime of all 29 `bun run`
// scripts in `package.json`, this gate included. ⚠ VITEST'S OWN WORKERS ARE NODE — measured, not assumed —
// so a suite cannot demonstrate the ARTEFACT on this gate and asserts the REFUSAL instead; a control that
// fails the same way as its subject reads as agreement. Driven under bun with `shell: false`
// and an absolute path to a `.cmd`: `argv[1] = 'x" & echo INJECTED & echo PWNED > pwned.txt & rem '` returned
// exit 0 and left `pwned.txt` on disk. The same vector through a BARE `npm` — resolved by PATH and PATHEXT to
// `npm.cmd` — did the same.
// ⭐ SO THE GUARANTEE IS KEPT BY REFUSING THE TARGET, NOT BY QUOTING THE ARGUMENT. `namesABatchTarget` below is
// the predicate, it lives in the port for the reason `containedWorkspacePath` does, and an adapter applies it
// to the program AS SPELLED and to whatever the program RESOLVES to. Every escaping scheme for `cmd.exe` is a
// normaliser, and this seam has already spent three rounds learning that each new normaliser is itself
// attackable; a class of target that cannot be made safe on this runtime is refused instead.
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
 *
 * ⛔⛔ AND THE CUT TRAVELS WITH THE DURABLE COPY, WHICH IT DID NOT — the hazard sentence in this file's own
 * header named the consequence before anyone drove it. `omittedRegions` sat on the TRANSIENT outcome ONLY:
 * an adversary printed 200 KiB, the outcome declared `{ STDOUT, byteSize: 139264, byteOffset: 65536 }`, and
 * `stdout.txt` on disk was exactly 65536 bytes with NOTHING beside it saying so. This type is documented as
 * naming *"the DURABLE copy and the only one a purge can reach"*, so anything reading the retained bytes
 * read A PREFIX AS THE WHOLE — `RULE 6` arriving through the output rather than through the exit code. Two
 * fields therefore land on this arm and BOTH are required, because they close different halves: the RECORD
 * that names the bytes carries the cut, and the DIRECTORY that holds them declares it too.
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
			/**
			 * ⛔ WHAT THE RETAINED BYTES ARE MISSING, CARRIED BY THE RECORD THAT NAMES THEM. Empty means nothing
			 * was cut — never "nobody looked", exactly as on the outcome.
			 */
			readonly omittedRegions: readonly ProcessOutputOmission[];
			/**
			 * ⛔ WHERE THE SAME DECLARATION SITS BESIDE THE BYTES, workspace-relative. A capture directory whose
			 * `stdout.txt` is a prefix and whose neighbours say nothing is a fabricated completeness ON DISK, which
			 * is the half of the hazard a record-plane field cannot reach.
			 */
			readonly omissionsPath: string;
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
			/**
			 * Whether BOTH captured streams reached end-of-file before this outcome was produced.
			 *
			 * ⛔ REQUIRED, BECAUSE THE ALTERNATIVE TO STATING IT IS SILENCE. An implementation settles on the CHILD
			 * rather than on the pipes — see the header — so a descendant holding the inherited descriptors no
			 * longer costs the caller its outcome. What it costs INSTEAD is the guarantee that nothing more was
			 * coming, and `false` is where that is said. ⚠ A reader treating a `false` capture as the command's
			 * complete output is making the mistake `omittedRegions` exists to prevent, one cause over.
			 */
			readonly outputComplete: boolean;
			/** ⛔ REQUIRED — `R7`, and `REG-F-336` C-2's orphan. See the header. */
			readonly retention: ProcessOutputRetention;
			readonly durationMs: number;
	  }
	/**
	 * ⚠ THE REFUSING ARM IS "NO OUTCOME COULD BE RECORDED", WHICH IS WIDER THAN "NOTHING STARTED", AND IT IS
	 * WIDENED HERE RATHER THAN LEFT TO DRIVE AN IMPLEMENTATION INTO A FABRICATION. Almost every instance is a
	 * process that never ran — ENOENT, a refused target, a `cwd` outside the workspace — and those say so. The
	 * remaining one is a process that WAS started, outlived its deadline AND outlived the kill that followed:
	 * there is no exit code to report, and `exitCode: null` would assert a termination nobody observed.
	 * `refusedBecause` says which of the two it is; what the TYPE guarantees is that no exit code can be read
	 * off either.
	 */
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
	return finalPathSegment(cwd);
}

/**
 * The last segment of a path, or the path itself when it has none.
 *
 * ⭑ NOT EXPORTED, AND THAT IS THE POINT — it is the shared BODY of two rules that must not drift apart,
 * not a third rule. `workspaceDirectoryName` says what a refusal may disclose about WHERE and
 * `programFileName` says what it may disclose about WHAT; both answers are "the final segment and nothing
 * above it". Two copies of one expression is how the second one quietly grows a different fallback.
 */
function finalPathSegment(path: string): string {
	return (
		path
			.split(/[\\/]+/)
			.filter((segment) => segment !== '')
			.at(-1) ?? path
	);
}

/**
 * The program's own FILE NAME, which is what a refusal may say about WHAT was to be run.
 *
 * ⛔⛔ `refusedBecause` USED TO CARRY `argv.join(' ')`, AND AN ADVERSARY READ THE HOST OUT OF IT. Driven: a
 * refusal for an ABSOLUTE program path produced *"'C:\Program Files\nodejs\nope-missing.exe --flag' could not be
 * started"*, and under bun the same field carried a path containing the OPERATING USER'S NAME. This port
 * defines `refusedBecause` as a fact a step RECORDS — so it travels into a governed record AND into a
 * model's context — and `workspaceDirectoryName` already applies exactly this rule to the `cwd` printed
 * beside it. ⚠ THE TEST THAT CERTIFIED THE OLD MESSAGE ARRANGED A RELATIVE ARGV, so it could not see this.
 *
 * ⚠ AND THE ARGUMENTS ARE DROPPED ENTIRELY RATHER THAN FILTERED, WHICH IS A REAL LOSS AND IS STATED RATHER
 * THAN SMOOTHED OVER. A reader debugging a refused command would like the flags. But from Phase 3 the argv
 * is chosen by a MODEL: an argument can be an absolute path, a token read out of a file, or a tenant name,
 * and there is no predicate over an arbitrary argument that keeps a host layout out of a record — which is
 * this seam's standing rule that a normaliser is itself attackable. The program's own name is what
 * identifies the failure — "there is no `tsc` on this host" — and it is what a reader acts on.
 *
 * ── ⚠ `W1`, RULED 2026-09-15: **DISCLOSED, NOT FIXED** — the residue, and why the alternatives are worse
 * A third adversarial pass named what survives the reduction: this returns the LAST SEGMENT OF WHATEVER IT IS
 * GIVEN, so a model-chosen `argv[0]` that is a host path fragment still leaks its deepest name —
 * `programFileName('C:\\Users\\mchen')` is `'mchen'`. That is bounded to ONE segment and is not eliminated.
 * ⭐ **WHAT MAKES IT THE RIGHT TRADE, STATED AS A PROPERTY RATHER THAN A PREFERENCE:** every path in a
 * refusal that came FROM THE HOST — the workspace's own directory — is reduced by this same rule, and what
 * remains here is one segment of a string THE CALLER SUPPLIED. A model that spelled `C:\Users\mchen` already
 * holds it; the refusal discloses the model's own content back to it, not the host's layout to the model.
 * ⛔ **AND THE ALTERNATIVES WERE MEASURED AGAINST THIS SEAM'S STANDING INSTRUCTION, WHICH IS THAT EVERY NEW
 * NORMALISER IS ITSELF ATTACKABLE** (three rounds' worth of receipts on the adapter side):
 *   · NAME NOTHING — then `'…' could not be started (ENOENT)` identifies no program, and the commonest
 *     refusal in this whole seam becomes unactionable. Something must name the failed program.
 *   · NAME IT ONLY WHEN IT CARRIES NO SEPARATOR — the ordinary case is an ABSOLUTE path to an executable, so
 *     this drops the name exactly when it is most useful and keeps it when it is least.
 *   · DECIDE WHETHER A SEGMENT "LOOKS LIKE A PROGRAM NAME" — a predicate over an arbitrary string, which is
 *     a normaliser, which is the thing this seam has settled three times over not to write.
 * ⭑ **WHAT A READER OF THE REFUSAL CAN STILL ACT ON:** the errno CODE (the platform's own answer), the
 * workspace's DIRECTORY NAME, and the final segment of `argv[0]` AS THE CALLER SPELLED IT. What they cannot
 * recover — and what the bound exists to withhold — is the DIRECTORY the program was sought in.
 * ⛔ **AND THE BOUND CANNOT WIDEN WITHOUT AN EDIT A REVIEWER SEES:** `finalPathSegment` is the shared, private
 * body of both rules, and `process-runner.test.ts` drives this residue by name so a second segment reddens it.
 */
export function programFileName(program: string): string {
	return finalPathSegment(program);
}

/**
 * Win32 executes these by handing the file to a command interpreter, not by loading a program image.
 *
 * ⚠ TESTED AGAINST THE STEM WITH TRAILING DOTS AND SPACES STRIPPED, because Win32 strips them and
 * `node:path` does not — the same disagreement `containedWorkspacePath` refuses a workspace component
 * over. `build.cmd.` and `build.cmd ` both open `build.cmd`.
 */
const WIN32_BATCH_EXTENSION = /\.(?:bat|cmd)$/i;

/**
 * Does this path name a target whose ARGUMENTS would be re-parsed by a command interpreter?
 *
 * ⛔ THE GUARANTEE `ProcessRunRequest.argv` MAKES CANNOT BE KEPT FOR ONE, SO ONE IS REFUSED — see the
 * header for the driven vector and for why quoting is not the answer. ⭑ IT IS REFUSED ON EVERY PLATFORM,
 * and the over-refusal on POSIX is deliberate: it is the rule `containedWorkspacePath` already follows —
 * *"A path that named a file on Linux and a device on Windows would make ONE workspace path mean two
 * things."* An argv that runs a script on one host and hands a model a command interpreter on another is
 * that defect with the planes swapped.
 *
 * ⚠ IT ANSWERS ABOUT A PATH, NOT ABOUT A RESOLUTION, AND THE SECOND HALF IS AN ADAPTER'S. A bare `npm`
 * names no extension and is still `npm.cmd` once PATH and PATHEXT are applied — driven, and injectable.
 * Resolving a program is a FILESYSTEM act and this package has none, so an adapter applies this to the
 * program as SPELLED and to every candidate the platform would search.
 */
export function namesABatchTarget(program: string): boolean {
	return WIN32_BATCH_EXTENSION.test(finalPathSegment(program).replace(/[. ]+$/, ''));
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
 * ⭑ WHAT IT IS FOR: `cwd` is a required field on `ProcessRunRequest`, so a caller assembling one by hand has to
 * put SOMETHING there, and the obvious something is `process.cwd()` — the server's own source tree. That is not
 * a hypothetical: `openPiExecutionSession` hardcoded `process.cwd()` twice. Deriving the request's `cwd` from
 * the workspace's OWN `directoryPath` means a lawful caller never has to name a directory at all.
 *
 * ⛔⛔ AND WHAT IT IS NOT: THE CONTROL. This docblock used to claim the check "cannot be skipped by omission" and
 * the header called this *"the only sanctioned way to build a request"* — both false, and an adversary showed
 * how cheaply. `ProcessRunRequest` is a plain interface, this function had ZERO production call sites, and
 * `run({ argv: [...], cwd: <the repository root> })` executed in the server's own tree with nothing in the way.
 * **A CONVENTION WITH NO CALL SITES IS NOT A CONTROL**, and the correction is structural rather than
 * documentary: a REAL runner is CONSTRUCTED against the workspace it may run in and refuses any other `cwd`, so
 * the check is in the object a caller cannot go around. This function stays the early, cheap refusal — and
 * nothing downstream may assume it was called.
 *
 * ⚠ IT REFUSES AN IN_MEMORY WORKSPACE FOR EITHER RUNNER KIND, AND THE MESSAGES DIFFER ON PURPOSE. With a
 * REFUSING runner the combination is the library's own hermetic default and the refusal is expected; with a
 * REAL one it is a WIRING ERROR whose unguarded consequence is a command executing in some other directory.
 * Collapsing the two into one message would make a misconfiguration read exactly like the default.
 */
export function planProcessRun(input: ProcessRunPlanInput): ProcessRunPlan {
	const named = `${input.workspace.ownerKind} '${input.workspace.ownerId}'`;
	// ⭑ READ ONCE, AND NARROWED BY THE REFUSAL BELOW RATHER THAN BY A FALLBACK. `input.argv[0] ?? ''` at each
	// use site would compile and would add two branches NOTHING CAN REACH — the empty-argv refusal has already
	// returned by then — which is a guard that cannot fail wearing the shape of defensiveness.
	const [program] = input.argv;
	// ⛔ NOTHING TO START IS NOT AN EMPTY COMMAND. An empty argv would reach `spawn` as a missing program and
	// surface as a thrown ENOENT, which is a stack trace where a refusal belongs.
	if (program === undefined || program === '')
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
					? `The workspace of ${named} is ${input.workspace.materialization} and has no directory on disk, but the wired ProcessRunner is REAL. This is a HOST WIRING ERROR and it is refused before anything starts: a real runner needs a real cwd, and the alternative to refusing is that '${programFileName(program)}' executes in some other directory — the server's own source tree — while the record says it ran in the workspace.`
					: `The workspace of ${named} is ${input.workspace.materialization} and has no directory on disk, and the wired ProcessRunner is REFUSING. This is the library's hermetic default rather than a misconfiguration: nothing is executable here, so '${programFileName(program)}' was not run. Supply a FILESYSTEM workspace and a REAL runner to execute commands.`
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
