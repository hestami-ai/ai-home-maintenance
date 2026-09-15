// JAN-EXEC Phase 2b — the REAL `ProcessRunner`: a child process, in the Undertaking's workspace, whose output
// is retained under a disposition rather than captured and forgotten.
//
// ⭑ IT LIVES IN THE DEMO, NOT IN THE KERNEL, AND THAT IS `R3` APPLIED — the same split `filesystem-workspace.ts`
// follows. The port and its hermetic default ship together so *"no test gains a real filesystem or a real child
// process by importing them"* (`rph-ports/src/index.ts`); the adapter that DOES spawn is a host's business.
// ⚠ AND THERE IS A SECOND REASON, WORTH STATING BECAUSE IT LOOKS LIKE A CONVENIENCE FROM THE OTHER SIDE:
// `verif/agy-stderr-unbound.test.ts` walks `apps/rph-demo/src` ONLY — the population `REG-F-326` measured and
// recorded. Putting the one module in this repository that binds `stderr` into `packages/` would have satisfied
// that gate by leaving its population, which is dodging a guard rather than answering it.
//
// ══ ⭐⭐ `REG-Q-066`, RE-ANSWERED HERE BECAUSE THIS FILE IS WHAT REOPENS IT ═══════════════════════════════════
//
// **THE DEMAND BEING SATISFIED, VERBATIM from `verif/agy-stderr-unbound.test.ts`:** *"Binding `stderr` CREATES
// the retention surface REG-Q-066 asks about — a model CLI's stderr can echo prompt content, which PER-9
// governs and no redaction in this codebase covers (finding #60). If this is deliberate, it needs a retention
// disposition and REG-Q-066 needs re-answering; it must not arrive as a debugging convenience."*
//
// ⭑ SO ANSWERING IT IS NOT WEAKENING IT. The gate's own message names the two things an author who ends the
// absence owes: a retention disposition, and a re-answer. Both are below, and the gate is rewritten to check
// the disposition rather than the absence — which is strictly more than it could check before.
//
// **THE RE-ANSWER.** `REG-F-326` closed `REG-Q-066`'s stated bound as *"CLOSED BY NON-USE"*, and said in terms
// why that was gated rather than noted: *"An answer that rests on the code NOT doing something rots the moment
// someone does it."* It has. The bound is now **CLOSED BY DISPOSITION**, and the disposition is `R7`:
//
//   1. **BOTH STREAMS ARE RETAINED.** Not stdout only. A build's stderr is where a compiler puts the reason it
//      failed, and a step that recorded a failure whose reason it had thrown away would be evidencing nothing.
//   2. **BOTH CARRY `PURGEABLE_AT_EXPIRY`, AND THAT IS FORCED RATHER THAN CHOSEN.** `Purgeability` has exactly
//      two members and is *"DELIBERATELY NOT A RETENTION CLASS"* — it is `PER-8`'s participation predicate.
//      `RETAINED_BY_PARTICIPATION` makes `Workspace.purge` REFUSE; `R7` says both streams *"come under purge"*;
//      so the other member is the only one consistent with the ruling, and no third member is coined
//      (`REG-Q-056` is OPEN and is not this programme's question).
//      ⭑ AND THE PREDICATE AGREES WITH THE RULING, WHICH IS THE PART THAT MATTERS. `REG-D-050`: *"PARTICIPATION
//      IS A PROPERTY OF USE, NOT OF KIND."* Nothing today cites a captured stream in a recorded judgement — the
//      evidence join is Phase 5 and is not built — so these bytes have participated in nothing.
//      ⛔ A CONSTRAINT ON PHASE 5 FOLLOWS, AND IT IS WRITTEN HERE BECAUSE THAT IS WHERE IT WILL BE BROKEN: when
//      a `TEST_RESULT` becomes evidence, the PARTICIPATING object must be MINTED — content-addressed into the
//      `ArtifactStore` under `RETAINED_BY_PARTICIPATION` at the moment of participation — and must not be *this
//      capture re-labelled*. That is the split §9.7 already prescribes for a model reply whose halves carry
//      opposite obligations, and re-labelling instead would make `R7` false for every run after it.
//   3. **A SECOND WORKSPACE HOLDS THEM, BECAUSE ONE CANNOT HOLD BOTH CLASSES.** The port says so outright:
//      *"one workspace cannot hold participating and purgeable material side by side. A host needing both
//      declares two."* The deliverable workspace is `RETAINED_BY_PARTICIPATION` under `R8` — it must survive the
//      Undertaking — so the capture cannot live in it, and `workspace-host.ts` declares the second.
//   4. **WHAT REFERENCES THE BYTES.** `ProcessRunOutcome.retention` — required on the ran arm — carries the
//      owner id, the class, and both workspace-relative paths. `REG-F-336` C-2 forbids *"content on the content
//      plane with no record on the record plane pointing at it"*, and an outcome that returned only the strings
//      would have created exactly that orphan the first time a command printed anything.
//   5. **HOW PURGE REACHES THEM.** `outputWorkspace.purge(path)` — the same machinery, the same signature and
//      the same semantics as `ArtifactStore.purge`, on a workspace declared purgeable so it does not refuse.
//      The entry survives as a tombstone, so *"purged on schedule"* stays distinguishable from *"never
//      written"* and from *"lost"*. ⚠ NOTHING SCHEDULES A PURGE YET: retention expiry is a policy this
//      repository does not have. What `R7` requires and what is delivered here is that the bytes ARE reachable
//      and CAN be destroyed — the clause that makes retaining them lawful at all — not that a sweeper exists.
//      ⛔ SO THE CONSEQUENCE IS STATED RATHER THAN LEFT TO BE DISCOVERED: captures ACCUMULATE, one directory per
//      run, bounded only per-stream. `outputWorkspace.list()` enumerates every one of them — which is what a
//      sweep would be written against — but until something is, an Undertaking that runs a thousand commands
//      holds a thousand captures. That is a missing policy, not a missing mechanism.
//
// ── ⚠ SECRETS IN A CAPTURED STREAM — IN SCOPE, AND ANSWERED, BUT NOT ELIMINATED ──────────────────────────────
// A command's stderr can echo the environment it ran in, and this server's environment holds model-provider
// credentials. That is IN SCOPE and it is why `childEnvironment` exists: the child does NOT inherit
// `process.env`. It receives an ALLOWLIST — the variables a toolchain needs to run at all — so the server's
// keys, `JPWB_DEMO_DB` and everything else are not in the child's environment to be echoed, whatever the model
// makes it run. ⛔ THAT IS A REDUCTION, NOT AN ELIMINATION, and the residue is stated rather than implied:
//   · `PATH` and `USERPROFILE`-shaped variables are allowlisted and themselves disclose the host's layout and
//     the operating user's name. They are the price of a toolchain that runs.
//   · A secret placed IN an allowlisted variable is passed through. The allowlist is by NAME.
//   · ⛔ A SECRET THE COMMAND READS FROM DISK IS NOT COVERED AT ALL. A `.env` inside the workspace, a token in a
//     config file, a credential the toolchain caches — any of these can reach stderr and nothing here redacts
//     it. `REG-F-326` names the same gap from the other side (finding `#60`: *"no redaction in this codebase
//     covers"* prompt content in stderr), and closing it is a redaction capability this repository does not
//     have. ⭑ What bounds the exposure meanwhile is `R9`'s answer: the retained bytes sit in a purgeable
//     workspace inside the Undertaking's own root, and the security tier belongs to the deployment environment.
//
// ── ⛔ WHAT THIS RUNNER WILL NOT DO ──────────────────────────────────────────────────────────────────────────
//   · NO SHELL. `shell: false` and an argv ARRAY, never a joined string, so no quoting rule and no metacharacter
//     is ever interpreted: a model that names an argument `>` gets an argument, not a redirection.
//   · NO INHERITED STDIN. `stdio[0] = 'ignore'`, so a command that reads input gets EOF instead of blocking
//     until the timeout — which would report a TIMEOUT for a command that was merely waiting on the server.
//   · NO THROW OUT OF `run`. Every failure is a `ran: false` refusal naming the errno CODE. Phase 2's rule, one
//     port over: *"a refusal is a fact a step can record; a throw is a stack trace where a fact belongs."*
//   · NO EXIT CODE FOR A PROCESS THAT DID NOT START. A spawn failure is `ran: false`, never `ran: true` with an
//     invented number (`RULE 5` / `RULE 6`).
//
// ⚠ AND TWO BOUNDS ON THE KILL, MEASURED ON THIS HOST RATHER THAN ASSUMED. `child.kill('SIGKILL')` terminates
// the process this runner started; a GRANDCHILD it spawned is not in the signal's reach, so a build tool that
// forks a daemon can outlive its own timeout.
//
// ── ⚠ AND A CORRECTION TO WHAT THE PORT SAYS `timedOut` BUYS ON WINDOWS, BECAUSE A MUTANT FORCED THE MEASUREMENT
// The port's rationale is that *"a SIGKILLed process reports `null` on Windows rather than a distinguishable
// number"*, so `timedOut: exitCode === null` would look like a lawful inference. ⛔ THAT MUTATION SURVIVES ON
// THIS HOST, AND THE REASON IS A PLATFORM FACT NEITHER THE PORT NOR I HAD MEASURED. Four arrangements, driven:
//   · this runner's own `child.kill('SIGKILL')` → `exitCode: null, signal: 'SIGKILL'`
//   · an EXTERNAL `process.kill(pid, 'SIGKILL')` → `exitCode: 1,    signal: null`
//   · the child killing ITSELF (SIGKILL or SIGTERM) → `exitCode: 1, signal: null`
//   · `process.abort()`                            → `exitCode: 134, signal: null`
// So on Windows a `null` exit code arises ONLY from the kill this runner itself issued, and the inference
// cannot be told apart from the observation here. ⭑ ON POSIX IT CAN: an external SIGKILL delivers `null` there,
// and a process the OS killed is a `TOOL_FAILURE`, not a `TIMEOUT` (§36.2). The field therefore stays OBSERVED
// — the rule is right, and what is corrected is the claim that Windows is where it bites. ⚠ The declared
// mutants consequently pin both DIRECTIONS of the flag (never reported / always reported) rather than the
// inference, because a mutation nothing on this host can distinguish would be a guard that cannot fail.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
	workspaceDirectoryName,
	type ProcessOutputOmission,
	type ProcessOutputRetention,
	type ProcessRunOutcome,
	type ProcessRunRequest,
	type ProcessRunner,
	type Workspace
} from '@janumipwb/rph-ports';

/**
 * How many UTF-8 bytes of EACH stream are kept.
 *
 * ⛔ A BOUND IS NOT OPTIONAL: an unbounded capture is a step that exhausts the host by printing, and a step's
 * output is under the control of whatever the model chose to run. ⚠ Deliberately NOT injectable — a cap a
 * caller can raise is a cap, and the guarantee here is that no run can be made unbounded from outside this file.
 */
const CAPTURE_CAP_BYTES = 64 * 1024;

/** Where a run's captured streams are written inside the output workspace. */
const CAPTURE_DIRECTORY = 'captures';

/**
 * The environment variable names a child may see, by NAME — see the header for what this buys and what it does
 * not.
 *
 * ⛔ AN ALLOWLIST, NEVER A BLOCKLIST, and the difference is the whole control. A blocklist has to name every
 * secret the server will ever hold, including the ones added after this line was written; an allowlist is wrong
 * only about variables a toolchain turns out to need, which fails LOUDLY (a command that cannot find its
 * interpreter) rather than silently (a key in a build log).
 *
 * ⚠ MATCHED CASE-INSENSITIVELY, because Windows environment names are. `Path`, `PATH` and `path` are one
 * variable there and three strings to a `Set.has`, so an exact-case list would drop the interpreter's own
 * search path on the platform this repository actually runs on.
 */
const INHERITED_ENVIRONMENT_NAMES = [
	'PATH',
	'PATHEXT',
	'SYSTEMROOT',
	'SYSTEMDRIVE',
	'WINDIR',
	'COMSPEC',
	'TEMP',
	'TMP',
	'TMPDIR',
	'HOME',
	'HOMEDRIVE',
	'HOMEPATH',
	'USERPROFILE',
	'APPDATA',
	'LOCALAPPDATA',
	'PROGRAMDATA',
	'PROGRAMFILES',
	'PROGRAMFILES(X86)',
	'NUMBER_OF_PROCESSORS',
	'PROCESSOR_ARCHITECTURE',
	'OS',
	'LANG',
	'LC_ALL',
	'TZ'
];

/** What a host must STATE to get a real runner. Every field is required — this seam's rule since Phase 1. */
export interface ChildProcessRunnerInput {
	/**
	 * ⛔ WHERE THE CAPTURED STREAMS GO, AND IT IS NOT THE DELIVERABLE WORKSPACE. See the header, point 3: the
	 * deliverable is `RETAINED_BY_PARTICIPATION` under `R8`, and a workspace whose `purge` refuses cannot hold
	 * material `R7` requires to be purgeable.
	 */
	readonly outputWorkspace: Workspace;
}

/** How many bytes the UTF-8 sequence led by `byte` declares itself to be. A malformed lead counts as one. */
function utf8SequenceLength(byte: number): number {
	if (byte < 0x80) return 1;
	if (byte >= 0xf0) return 4;
	if (byte >= 0xe0) return 3;
	if (byte >= 0xc0) return 2;
	return 1;
}

/**
 * How many bytes at the front of `buf` form COMPLETE UTF-8 sequences.
 *
 * ⛔ THE CAP IS IN BYTES AND THE CAPTURE IS TEXT, SO A CUT CAN LAND MID-CHARACTER. Decoding a buffer that ends
 * halfway through a multi-byte sequence yields U+FFFD — a character the process never emitted, appended to a
 * record that says what the process emitted. Trimming back to a boundary and ACCOUNTING for the trimmed bytes
 * in the declared omission is the difference between a bounded capture and a corrupted one.
 */
function completeUtf8PrefixLength(buf: Buffer): number {
	for (let back = 1; back <= 4 && back <= buf.length; back++) {
		const byte = buf[buf.length - back] ?? 0;
		// A continuation byte cannot start a sequence; keep walking back to the lead byte that owns it.
		if ((byte & 0b1100_0000) === 0b1000_0000) continue;
		return back === utf8SequenceLength(byte) ? buf.length : buf.length - back;
	}
	return buf.length;
}

/** A bounded, self-declaring sink for one stream. */
function captureSink(stream: 'STDOUT' | 'STDERR') {
	const kept: Buffer[] = [];
	let keptBytes = 0;
	let emittedBytes = 0;
	return {
		take(chunk: Buffer): void {
			// ⛔ COUNTED WHETHER OR NOT IT IS KEPT. The declared omission's `byteSize` is what the process EMITTED
			// minus what was retained, and a sink that stopped counting at the cap could only ever report "some".
			emittedBytes += chunk.length;
			// ⚠ THE BOUND IS `room`, AND THE EARLY RETURN IS AN ALLOCATION GUARD RATHER THAN A SECOND BOUND —
			// recorded because a declared mutant PROVED it: disabling this line alone changed nothing observable,
			// since `room` reaches 0 and every later slice is empty. What it saves is pushing an unbounded number
			// of empty buffers onto `kept` for a process that prints forever. Both are needed; only one bounds.
			if (keptBytes >= CAPTURE_CAP_BYTES) return;
			const room = CAPTURE_CAP_BYTES - keptBytes;
			const slice = chunk.length <= room ? chunk : chunk.subarray(0, room);
			kept.push(slice);
			keptBytes += slice.length;
		},
		settle(): { readonly text: string; readonly omission?: ProcessOutputOmission } {
			const whole = Buffer.concat(kept);
			if (emittedBytes === keptBytes) return { text: whole.toString('utf8') };
			const usable = completeUtf8PrefixLength(whole);
			return {
				text: whole.subarray(0, usable).toString('utf8'),
				omission: {
					stream,
					reason: `capture is bounded at ${CAPTURE_CAP_BYTES} UTF-8 bytes per stream and the process emitted ${emittedBytes}; the retained prefix is trimmed to a complete UTF-8 boundary so no character the process did not emit appears in the record`,
					byteSize: emittedBytes - usable,
					byteOffset: usable
				}
			};
		}
	};
}

/**
 * The child's environment — an allowlist of the parent's, never the parent's.
 *
 * See the header for what this buys, what it costs and what it does not reach.
 */
function childEnvironment(parent: NodeJS.ProcessEnv): Record<string, string> {
	const permitted = new Set(INHERITED_ENVIRONMENT_NAMES.map((name) => name.toUpperCase()));
	const out: Record<string, string> = {};
	for (const [name, value] of Object.entries(parent))
		if (value !== undefined && permitted.has(name.toUpperCase())) out[name] = value;
	return out;
}

/**
 * A `ProcessRunner` that actually starts processes, and retains what they print.
 *
 * ⛔ IT REFUSES TO BE CONSTRUCTED AGAINST A WORKSPACE WHOSE BYTES CANNOT BE PURGED, AND THAT REFUSAL IS THE
 * `REG-Q-066` DISPOSITION MADE STRUCTURAL RATHER THAN DOCUMENTARY. `R7` says both streams come under purge; a
 * `RETAINED_BY_PARTICIPATION` workspace's `purge` REFUSES by `PER-8`; so wiring one here would produce a runner
 * that captures `stderr` into bytes nothing can ever destroy — the exact surface the question is about, arrived
 * at through a one-word host mistake. A comment saying "use a purgeable workspace" would be a convention; this
 * is a refusal.
 *
 * ⚠ IT THROWS, AND THAT IS NOT THE RULE THIS FILE OTHERWISE FOLLOWS — deliberately. The port's *"refuse, never
 * throw"* governs what a STEP records: an outcome a step must be able to write down. This is a HOST WIRING
 * error at CONSTRUCTION, before any step exists, and `createFilesystemWorkspace` sets the same precedent one
 * module over by refusing to open on a volume root. A runner that returned refusals forever because it was
 * wired wrongly would look exactly like the hermetic default.
 */
export function createChildProcessRunner(input: ChildProcessRunnerInput): ProcessRunner {
	const outputWorkspace = input.outputWorkspace;
	if (outputWorkspace.purgeability !== 'PURGEABLE_AT_EXPIRY')
		throw new Error(
			`A real ProcessRunner cannot capture output into a workspace declared ${outputWorkspace.purgeability}. Sponsor ruling R7 requires stdout AND stderr to be retained and to come under purge, and PER-8 makes purge REFUSE on a workspace that declares its content has participated — so these captures could never be destroyed. Declare a second workspace with purgeability PURGEABLE_AT_EXPIRY for process output; the deliverable workspace stays RETAINED_BY_PARTICIPATION under R8.`
		);

	/**
	 * A pair that did not land in full, refused — and the half that DID land, swept.
	 *
	 * ⛔ A HALF-WRITTEN PAIR IS NOT A RETENTION, AND LEAVING THE STRAY HALF IS `REG-F-336` C-2's ORPHAN PRODUCED
	 * BY THE FUNCTION WRITTEN TO PREVENT IT: bytes on the content plane with no record naming them. The stray
	 * half is purged — which this workspace permits, because the whole point of its declared class is that it
	 * can be. ⚠ A purge that itself refuses is REPORTED rather than swallowed: the bytes are then genuinely an
	 * orphan, and a reader who is told so can act on it.
	 */
	async function refuseAndSweep(
		landed: readonly (readonly [boolean, string, string])[]
	): Promise<ProcessOutputRetention> {
		const refusals = landed
			.filter(([written]) => !written)
			.map(([, , refusedBecause]) => refusedBecause);
		const swept: string[] = [];
		for (const [written, path] of landed) {
			if (!written) continue;
			const outcome = await outputWorkspace.purge(path);
			swept.push(
				outcome.purged
					? `the half that did land was purged, so no bytes remain that nothing points at`
					: `⚠ the half that did land could NOT be purged (${outcome.refusedBecause}), so those bytes are an orphan on the content plane`
			);
		}
		const sweepNote = swept.length === 0 ? '' : `. ${swept.join('; ')}`;
		return {
			retained: false,
			notRetainedBecause: `the run's output could not be retained — ${refusals.join('; ')}${sweepNote}`
		};
	}

	/** Write both streams into the output workspace, or state why they are not there. */
	async function retain(stdout: string, stderr: string): Promise<ProcessOutputRetention> {
		const directory = `${CAPTURE_DIRECTORY}/${randomUUID()}`;
		const stdoutPath = `${directory}/stdout.txt`;
		const stderrPath = `${directory}/stderr.txt`;
		try {
			// ⚠ BOTH ARE ALWAYS WRITTEN, INCLUDING AN EMPTY ONE. An absent `stderr.txt` would be ambiguous between
			// "the command printed nothing" and "nothing was retained", and those are different facts.
			const wroteStdout = await outputWorkspace.writeFile(stdoutPath, stdout);
			const wroteStderr = await outputWorkspace.writeFile(stderrPath, stderr);
			if (wroteStdout.written && wroteStderr.written)
				return {
					retained: true,
					workspaceOwnerId: outputWorkspace.ownerId,
					purgeability: outputWorkspace.purgeability,
					stdoutPath,
					stderrPath
				};
			return await refuseAndSweep([
				[
					wroteStdout.written,
					stdoutPath,
					wroteStdout.written ? '' : `stdout: ${wroteStdout.refusedBecause}`
				],
				[
					wroteStderr.written,
					stderrPath,
					wroteStderr.written ? '' : `stderr: ${wroteStderr.refusedBecause}`
				]
			]);
		} catch (cause) {
			// The port promises `writeFile` refuses rather than throws, and both adapters in this repository do.
			// A third might not, and `run` may not throw — so the promise is relied on and also not trusted.
			const code = (cause as NodeJS.ErrnoException | undefined)?.code;
			return {
				retained: false,
				notRetainedBecause: `the run's output could not be retained: the output workspace raised rather than refusing (${code ?? 'unknown cause'}).`
			};
		}
	}

	return {
		// ⭑ DECLARED REAL, which is what `planProcessRun` and `producerWorkingDirectory` read to refuse an
		// IN_MEMORY workspace as a WIRING ERROR rather than as the hermetic default.
		kind: 'REAL',
		run(request: ProcessRunRequest): Promise<ProcessRunOutcome> {
			return new Promise<ProcessRunOutcome>((resolve) => {
				const startedAt = Date.now();
				const outSink = captureSink('STDOUT');
				const errSink = captureSink('STDERR');
				let settled = false;

				const startChild = () =>
					spawn(request.argv[0] ?? '', request.argv.slice(1), {
						cwd: request.cwd,
						// ⛔ NO SHELL. An argv array, interpreted by nobody — see the header.
						shell: false,
						// ⛔ NO INHERITED ENVIRONMENT — see the header.
						env: childEnvironment(process.env),
						// stdin is closed; stdout and stderr are piped so they can be BOUNDED rather than streamed to
						// wherever this server's own descriptors point.
						stdio: ['ignore', 'pipe', 'pipe'],
						windowsHide: true
					});

				// ⛔ `spawn` THROWS SYNCHRONOUSLY FOR SOME ARGV, AND A THROW OUT OF `run` IS THE ONE THING THIS
				// ADAPTER MAY NOT DO. Driven: an embedded NUL in the program name, a NUL in an argument, and an
				// EMPTY program name all raise `ERR_INVALID_ARG_VALUE` BEFORE any process exists — so they never
				// reach the `error` event below, and without this they would leave `run` as a rejected promise.
				// ⚠ AND `planProcessRun` DOES NOT COVER IT. It refuses an empty `argv[0]`, and nothing anywhere
				// looks for a NUL in a program name or an argument — so a lawfully PLANNED request reaches this
				// line and raises. The port's rule is about what a STEP can record, not about who built the
				// request, so the arm belongs here rather than as a second check up there.
				// ⚠ THE MALFORMED ARGV IS NOT ECHOED BACK. It is malformed precisely by containing bytes no record
				// should carry — a NUL in a `refusedBecause` travels into a governed record and a model's context —
				// so the refusal names the CODE and the shape of the fault instead, which is what a reader acts on.
				let child: ReturnType<typeof startChild>;
				try {
					child = startChild();
				} catch (cause) {
					const code = (cause as NodeJS.ErrnoException | undefined)?.code;
					resolve({
						ran: false,
						refusedBecause: `a process could not be started in the workspace directory '${workspaceDirectoryName(request.cwd)}': the platform refused the argv itself (${code ?? 'unknown cause'}), before any process existed. The program name or one of its arguments is not a value that can be passed to a process — an embedded NUL byte, or an empty program name. The argv is deliberately not quoted back here: it is malformed by carrying bytes that belong in no record.`
					});
					return;
				}

				// ⚠ OBSERVED AT THE MOMENT OF THE KILL, NEVER INFERRED AFTERWARDS. §36.2 separates TIMEOUT from
				// TOOL_FAILURE, and on POSIX the exit code cannot tell them apart — an external SIGKILL delivers
				// `null` there just as this one does. ⭑ On Windows they happen to coincide, which is measured in
				// the header rather than assumed; the field is observed so the rule holds on both.
				let timedOut = false;
				const watchdog = setTimeout(() => {
					timedOut = true;
					child.kill('SIGKILL');
				}, request.timeoutMs);

				/** ⛔ ONE RESOLUTION. `error` and `close` can both fire, and the second must not overwrite the first. */
				function finish(outcome: ProcessRunOutcome): void {
					if (settled) return;
					settled = true;
					clearTimeout(watchdog);
					resolve(outcome);
				}

				child.stdout.on('data', (chunk: Buffer) => outSink.take(chunk));
				child.stderr.on('data', (chunk: Buffer) => errSink.take(chunk));

				// ⛔ A PROCESS THAT NEVER STARTED DID NOT RUN, AND THIS IS `RULE 5` AT THE ONE PLACE IT IS TEMPTING
				// TO BREAK. ENOENT is the commonest outcome of a model naming a tool the host does not have, and
				// reporting it as `ran: true, exitCode: 127` — the shell's convention for exactly this — would let a
				// step record a FAILED COMMAND where no command existed. The two are different facts.
				child.on('error', (cause: NodeJS.ErrnoException) => {
					finish({
						ran: false,
						refusedBecause: `'${request.argv.join(' ')}' could not be started in the workspace directory '${workspaceDirectoryName(request.cwd)}' (${cause.code ?? 'unknown cause'}). No process ran, so there is no exit code and no output: this is a refusal, not a failed command.`
					});
				});

				child.on('close', (exitCode: number | null) => {
					const out = outSink.settle();
					const err = errSink.settle();
					const omittedRegions = [out.omission, err.omission].filter(
						(region): region is ProcessOutputOmission => region !== undefined
					);
					void retain(out.text, err.text).then((retention) => {
						finish({
							ran: true,
							exitCode,
							timedOut,
							stdout: out.text,
							stderr: err.text,
							omittedRegions,
							retention,
							durationMs: Date.now() - startedAt
						});
					});
				});
			});
		}
	};
}
