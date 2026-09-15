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
//   · NO SHELL. `shell: false` and an argv ARRAY, never a joined string, so this runner interposes no quoting
//     rule and no metacharacter: a model that names an argument `>` gets an argument, not a redirection.
//     ⛔ AND THAT IS NOT SUFFICIENT ON WINDOWS, WHICH IS THE CORRECTION THIS FILE CARRIES — see `B1` below.
//     `shell: false` says nothing about a target the PLATFORM cannot load as a program image.
//   · NO INHERITED STDIN. `stdio[0] = 'ignore'`, so a command that reads input gets EOF instead of blocking
//     until the timeout — which would report a TIMEOUT for a command that was merely waiting on the server.
//   · NO CWD THE CALLER CHOSE, AND NO DIRECTORY THE OPERATING SYSTEM DISAGREES ABOUT. The runner is
//     constructed against the DELIVERABLE workspace and runs in the directory the FILESYSTEM resolves that
//     workspace's declared path to, or in none — see `B8` / `B11` below.
//   · NO THROW OUT OF `run`, AND NO SILENCE EITHER. Every failure is a `ran: false` refusal naming the errno
//     CODE. Phase 2's rule, one port over: *"a refusal is a fact a step can record; a throw is a stack trace
//     where a fact belongs."* ⛔ A PROMISE THAT NEVER SETTLES IS WORSE THAN EITHER, and this adapter had one.
//   · NO EXIT CODE FOR A PROCESS THAT DID NOT START. A spawn failure is `ran: false`, never `ran: true` with an
//     invented number (`RULE 5` / `RULE 6`).
//   · NO HOST LAYOUT IN A REFUSAL. A refusal names the program's FILE NAME and the workspace's DIRECTORY NAME,
//     and never the argv and never an absolute path.
//
// ══ ⛔⛔ ELEVEN BREACHES WERE DRIVEN THROUGH THE VERSIONS THIS REPLACES. EACH FIX BELOW IS ONE OF THEM ══════
//
// ⚠ TEN CAME FROM ONE PASS AND THE ELEVENTH FROM THE NEXT ONE, WHICH RE-DROVE ALL TEN AND FOUND THEM CLOSED.
// `B11` is `B8` again, one instrument down — which is why they are kept together below rather than listed as
// two findings.
//
// ── ⛔ B1 / B10 — A `.bat` OR `.cmd` TARGET IS REFUSED, BECAUSE THE NO-SHELL GUARANTEE CANNOT COVER IT ───────
// Win32 cannot load a batch file as a program image: the runtime hands it to `cmd.exe`, which re-parses the
// whole command line and interprets `&`, `|`, `>` and `"` INSIDE ARGUMENTS. Node closed this as CVE-2024-27980
// by raising `EINVAL` for such a target unless `shell: true` is stated. ⛔ **BUN HAS NO EQUIVALENT GUARD, AND
// BUN IS THE PRODUCTION RUNTIME HERE** — 29 `bun run` invocations in `package.json` and a declared
// `devEngines.packageManager`. DRIVEN under bun 1.3.14 with `shell: false`:
//   · an ABSOLUTE path to a `.cmd`, with `argv[1]` = `x" & echo INJECTED-VIA-ARGV & echo PWNED > pwned.txt & rem `
//     → exit 0, `INJECTED-VIA-ARGV` on stdout, and `pwned.txt` LEFT ON DISK.
//   · a BARE `npm` — no extension, resolved through PATH and PATHEXT to `npm.cmd` — → the same file written.
// ⭐ SO THE TARGET IS REFUSED RATHER THAN THE ARGUMENT QUOTED, AND THAT IS THIS SEAM'S STANDING INSTRUCTION
// RATHER THAN A PREFERENCE: Phase 2 spent three rounds discovering that every new normaliser is itself
// attackable, and settled only when a guard was DELETED by moving the hazard out of reach. There is no quoting
// scheme for `cmd.exe` this repository should be maintaining. `namesABatchTarget` lives in the PORT — the rule
// that makes a seam lawful belongs with the interface — and answers about the program AS SPELLED; the
// RESOLUTION half is here, because it needs a filesystem.
// ⚠ IT IS AN OVER-REFUSAL AND THAT IS THE SAFE SIDE. If `foo.exe` and `foo.cmd` both exist, the platform would
// run `foo.exe` and this refuses anyway, rather than reimplementing a resolution order that DIFFERS BETWEEN THE
// TWO RUNTIMES THIS REPOSITORY RUNS — measured: for a bare name, bun did NOT search the cwd and node DID.
// ⚠ AND THE SAME REFUSAL REPAIRS `B10`. Under real node a `.bat` target raises `EINVAL` SYNCHRONOUSLY, and the
// arm that caught it answered *"an embedded NUL byte, or an empty program name"* — a CLOSED disjunction of two
// causes, NEITHER of them true of an ordinary path to `build.cmd`. Phase 2 already recorded that a refusal
// stating something FALSE about its input is worse than no refusal. A batch target no longer reaches that arm,
// and that arm no longer closes its list of causes.
// ⛔ WHAT IS NOT CLAIMED: a model naming `cmd.exe` or `powershell.exe` AS THE PROGRAM gets a command
// interpreter, because it asked for one. That is an argv policy belonging to the phase that lets a model choose
// an argv, not to the no-shell guarantee — which is about what THIS CODE interposes.
//
// ── ⛔ B8 — THE `cwd` IS NOT THE CALLER'S TO CHOOSE, AND THE FIX IS STRUCTURAL ────────────────────────────────
// `ProcessRunRequest.cwd` is a required string, `planProcessRun` is a plain function with ZERO production call
// sites, and `run({ argv: [...], cwd: <this repository's root> })` therefore executed IN THE SERVER'S OWN TREE
// — the single outcome this whole phase exists to prevent, reached by not calling a helper. ⭐ A CONVENTION
// WITH NO CALL SITES IS NOT A CONTROL. So the runner is CONSTRUCTED against the DELIVERABLE workspace — the one
// directory it may run in — and refuses any other `cwd`. It could not check before because it was never given
// the workspace; it has it now, so the check sits in the object a caller cannot go around.
//
// ── ⛔⛔ `B11` — AND THE STRUCTURAL FIX WAS STILL DECIDED BY TWO STRINGS, WHICH A JUNCTION MAKES EQUAL ─────
// `B8`'s fix HELD — the check is in an object no caller can go around — and the check itself was
// `resolvePath(request.cwd) !== deliverableRoot`: ARITHMETIC ON TEXT, with one side fixed at construction.
// ⛔ DRIVEN, on a runner constructed while the workspace was a real directory: the directory was then REPLACED
// by an `mklink /J` junction pointing at a stand-in server tree, a LAWFUL `cwd` — the workspace's own
// `directoryPath` — was passed, the two strings matched EXACTLY, the operating system followed the junction,
// and the command wrote `PWNED_IN_SERVER_TREE.txt` INTO THE STAND-IN TREE. Neither field of the request was
// malformed; the directory underneath it was. ⚠ A junction needs no administrator right and no Developer Mode,
// measured on this host — which is why it is the vector and a symlink is not.
// ⭐ SO THE CHECK ASKS THE FILESYSTEM, PER CALL, AND COMPARES THE RESOLVED `cwd` AGAINST THE DECLARED DIRECTORY.
// Two properties the old check lacked and this one has: it is resolved AT CHECK TIME (a root measured once
// cannot notice a swap that happens afterwards, and the swap IS the attack), and a `cwd` that does not resolve
// AT ALL is REFUSED rather than decided by the path text — §16 fail-closed, at the one place this fix could
// have re-introduced the instrument it removes.
// ⛔ AND THE SIBLING'S `insideResolvedRoot` WAS *NOT* LIFTED, WHICH IS A MEASUREMENT AND NOT A PREFERENCE.
// `filesystem-workspace.ts` says of it, rightly, *"IT ASKS THE FILESYSTEM, NOT THE STRING"* — but it resolves
// BOTH sides, and under this arrangement both walk through the same junction: measured on node 24.11.1 and bun
// 1.3.14, `realpath(cwd) === realpath(root)` answers TRUE FOR THE BREACH. That is no defect in the sibling — it
// is right for ITS question (*is this CHILD PATH inside that root*) and that module already discloses this very
// arrangement as its bound 2, ROOT SWAP, OPEN. ⭑ WHAT THIS RUNNER HAS THAT A CONTAINMENT PREDICATE DOES NOT IS A
// DECLARED NAME: the host STATES this directory, and a swap cannot move a statement. The mutant `P2B-al` IS the
// lift, and it reddens — so the decision is re-runnable rather than remembered.
// ⚠ THE PRICE, STATED RATHER THAN DISCOVERED: a host whose durable root legitimately lies under a symlink, a
// junction or an 8.3 spelling has a deliverable directory that never resolves to its own declared name, and
// this runner then refuses EVERY run — loudly, immediately, with the remedy in the refusal. Phase 2's `F1`
// records what it costs to compare two spellings of one Win32 path (case, then the NTFS 8.3 alias, each beat a
// guard that tried), and this is that lesson's other side: the comparison stays EXACT, and being wrong lands on
// the refusing side. ⚠ MEASURED HERE: `realpath` equals `resolve` for this repository's root and for
// `tmpdir()` under both runtimes, and `realpath` does NOT canonicalise case on Win32 — so the case-sensitivity
// of this comparison is exactly what it already was.
// ⚠ AND WHAT IS *NOT* CLAIMED: this refuses to RUN A COMMAND in a directory the filesystem no longer agrees is
// the workspace. It does not close the ROOT SWAP for the workspace's own reads, writes and listings — that
// disclosure stands, its probes still pass, and nothing here should be read as having closed it.
//
// ── ⛔ B2 / B3 — THE OUTCOME COMES FROM THE CHILD, NEVER FROM THE STDIO STREAMS ──────────────────────────────
// These are ONE defect seen twice. `close` fires when the last pipe is released, and a pipe outlives its child:
// a grandchild that inherited the descriptors holds it open. DRIVEN — a child that spawns a DETACHED grandchild
// with `stdio: 'inherit'` and exits immediately:
//   · `exit` arrived at 151ms with code 0; `close` NEVER ARRIVED.
//   · the old adapter, whose only settle path was `close`, was STILL PENDING 9028ms after a 2000ms timeout —
//     `run()` produced NO FACT AT ALL, which is worse than any wrong one.
//   · and its watchdog had meanwhile set `timedOut: true` for a process that wrote its whole output and exited 0.
// ⭐ SO SETTLEMENT IS ON `exit`, with a BOUNDED drain for whatever is still in the pipes; `close` settles
// immediately when it does arrive, which is the ordinary case, so nothing pays the drain. What is LOST when the
// drain expires first is the guarantee that nothing more was coming — and that is DECLARED, as
// `ProcessRunOutcome.outputComplete: false`, rather than left to be assumed.
// ⛔ AND `timedOut` IS OBSERVED AS WHETHER THE CHILD WAS STILL RUNNING WHEN THE DEADLINE PASSED. The obvious
// observation — what `child.kill()` returned — is WORTHLESS ACROSS RUNTIMES, measured on this host against a
// child that exited at 151ms with the kill issued at 2000ms: **bun returned `true`, node returned `false`.** A
// deadline that passes over an already-exited child is not a timeout, and this adapter now says so.
// ⚠ AND `run` ALWAYS SETTLES, BY CONSTRUCTION: the deadline kills, and a second bounded grace follows the kill.
// A child outliving BOTH is a `ran: false` refusal saying exactly that — there is no exit code to report, and
// `exitCode: null` would assert a termination nobody observed.
//
// ── ⛔ B4 — RETENTION IS TIED TO THE OUTCOME, NOT TO AN EVENT ────────────────────────────────────────────────
// `close` fires AFTER `error`, and the close handler called `retain()` UNCONDITIONALLY while only the OUTCOME
// was guarded against settling twice. DRIVEN with `argv: ['no-such-tool-zzz']`: `run` resolved `{ ran: false }`
// with no retention field and an EMPTY captures directory — and 400ms later `stdout.txt` and `stderr.txt`
// existed and `list()` reported them live. That is `REG-F-336` C-2's orphan — content on the content plane with
// no record naming it — MINTED BY THE FUNCTION WRITTEN TO PREVENT IT, on the arm this file itself names as the
// commonest outcome of a model naming a tool the host does not have. ⭐ THE FIX IS THE GENERAL SHAPE: the single
// outcome is CLAIMED FIRST and retention happens INSIDE the claim, so nothing can be written for a run that
// produced no outcome.
//
// ── ⛔ B5 — A REFUSAL NAMES THE PROGRAM'S FILE NAME, NEVER THE ARGV ──────────────────────────────────────────
// `refusedBecause` interpolated `request.argv.join(' ')` raw, so a refusal read *"'C:\Program Files\nodejs\
// nope-missing.exe --flag' could not be started"* — and under bun, a path carrying the operating user's name —
// in the field the port defines as travelling into a governed record AND a model's context. The commit that
// landed it claimed the opposite rule and the test certifying it arranged a RELATIVE argv, so it could not see
// this. `programFileName` is the port's answer, beside `workspaceDirectoryName`, which was already applying
// exactly this rule to the `cwd` printed in the same sentence.
//
// ── ⛔ B6 — THE CUT TRAVELS WITH THE DURABLE COPY ────────────────────────────────────────────────────────────
// 200 KiB of stdout declared `{ STDOUT, byteSize: 139264, byteOffset: 65536 }` on the TRANSIENT outcome, while
// `captures/<uuid>/stdout.txt` was exactly 65536 bytes with NOTHING beside it saying so — and `retention` is
// documented as naming *"the DURABLE copy and the only one a purge can reach"*. The port's own hazard sentence
// names the consequence: a prefix that reads as the whole is a pass nothing produced. So a capture is THREE
// files rather than two: the declaration is written BESIDE the bytes as `omissions.json`, and `retention`
// carries both the regions and the path to it.
//
// ── ⛔ B7 — `retained: true` FOR BYTES IN A MAP ──────────────────────────────────────────────────────────────
// The construction guard checked `purgeability` and NOT `materialization`, so an IN_MEMORY workspace with the
// right class was ACCEPTED: a real child ran, retention claimed `retained: true` with a `stdoutPath`, and the
// workspace's `directoryPath` was `undefined`. Both facts are required now, and SEPARATELY, so an arrangement
// trips exactly one of them and each refusal proves its own limb rather than two at once.
//
// ⚠ AND TWO BOUNDS ON THE KILL, MEASURED ON THIS HOST RATHER THAN ASSUMED. `child.kill('SIGKILL')` terminates
// the process this runner started; a GRANDCHILD it spawned is not in the signal's reach, so a build tool that
// forks a daemon can outlive its own timeout — which is the other reason `outputComplete` exists.
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
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { delimiter, extname, resolve as resolvePath } from 'node:path';
import {
	namesABatchTarget,
	programFileName,
	workspaceDirectoryName,
	type ProcessOutputOmission,
	type ProcessOutputRetention,
	type PurgeOutcome,
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
 * How long the capture keeps draining after the CHILD has exited, while the pipes are still open.
 *
 * ⛔ A BOUND ON A WAIT, NOT A WAIT. `close` arrives within a tick of `exit` in the ordinary case and settles
 * immediately, so nothing pays this; it is reached only when a DESCENDANT still holds the inherited descriptors,
 * which is the arrangement that left the old adapter pending forever. ⚠ WHAT IT COSTS IS STATED RATHER THAN
 * HIDDEN: when it expires, `outputComplete` is `false`.
 *
 * ⚠ AND ITS SIZE IS NOT ARBITRARY. It is the window in which a deadline can pass over an ALREADY-EXITED child,
 * which is `B2`'s condition and is therefore the one thing a spec has to be able to arrange on purpose. A
 * quarter-second left that arrangement racing this host's ~70ms process startup; a second gives it an order of
 * magnitude of headroom, and costs a run nothing unless a descendant is holding the pipes.
 */
const STREAM_DRAIN_GRACE_MS = 1_000;

/**
 * How long the runner waits for the child to actually die after it issued `SIGKILL`.
 *
 * ⛔ THIS IS THE LAST THING STANDING BETWEEN `run` AND SILENCE. `SIGKILL` is uncatchable on POSIX and maps to
 * `TerminateProcess` on Win32, so a child surviving it is not an arrangement this host can make — which is
 * precisely why the arm needs driving rather than trusting: an unreachable-looking path that produces no fact is
 * how a promise stops settling. It is driven by handing the observer a `terminate` that does nothing.
 */
const KILL_GRACE_MS = 2_000;

/**
 * What Win32 appends to an extensionless program name when it searches, if `PATHEXT` is unset.
 *
 * ⚠ THE DOCUMENTED DEFAULT, USED ONLY AS A FALLBACK. The child's own environment carries `PATHEXT` (it is on the
 * allowlist below) and that is what the platform will actually resolve against; this is what to search when a
 * host has unset it, because "unset" does not mean "no extensions are tried".
 */
const WIN32_DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC';

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
	 * ⛔ THE ONE DIRECTORY A COMMAND MAY RUN IN — `R8`'s deliverable workspace, and the whole of `B8`'s fix.
	 *
	 * The runner needs this in order to CHECK a request's `cwd`, which it previously could not do because it was
	 * never given it. A `ProcessRunRequest` any caller can fill in is not made safe by a helper nobody has to
	 * call.
	 */
	readonly deliverableWorkspace: Workspace;
	/**
	 * ⛔ WHERE THE CAPTURED STREAMS GO, AND IT IS NOT THE DELIVERABLE WORKSPACE. See the `REG-Q-066` section,
	 * point 3: the deliverable is `RETAINED_BY_PARTICIPATION` under `R8`, and a workspace whose `purge` refuses
	 * cannot hold material `R7` requires to be purgeable.
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

/** `existsSync`, which may not become the thing that throws out of a guard. */
function present(path: string): boolean {
	try {
		return existsSync(path);
	} catch {
		return false;
	}
}

/**
 * What directory the FILESYSTEM says this path is, or the errno code it refused to say it with.
 *
 * ⛔ `B11` — THE ONE QUESTION A PATH COMPARISON CANNOT ANSWER, AND THE WHOLE OF THE FIX. `resolve` is
 * arithmetic on text: it collapses `..`, it picks a base, and it is finished. It cannot see a REPARSE POINT,
 * so a junction planted where the workspace directory used to be spells the workspace exactly while the
 * operating system opens somewhere else entirely — driven, and the command wrote into the stand-in server
 * tree. `realpath` follows what the OS will follow, which is the only instrument that answers the question
 * being asked.
 *
 * ⚠ IT RETURNS THE CODE RATHER THAN A BOOLEAN, because the two failures are different facts and the
 * refusals that report them say different things: a directory that RESOLVES ELSEWHERE has been redirected,
 * and a directory that does not resolve AT ALL is gone. A single `false` would force one refusal to cover
 * both, and one of the two would then be false about its own input.
 */
async function resolvedDirectory(
	path: string
): Promise<{ readonly directory: string } | { readonly unresolvable: string }> {
	try {
		return { directory: await realpath(path) };
	} catch (cause) {
		return { unresolvable: (cause as NodeJS.ErrnoException | undefined)?.code ?? 'unknown cause' };
	}
}

/**
 * The FILE NAME of a batch target this program would reach, or `undefined` when it reaches none.
 *
 * ⛔ `B1`'s SECOND HALF — the RESOLUTION the port's pure predicate cannot perform. A bare `npm` names no
 * extension and is `npm.cmd` once the platform has searched; driven, and injectable. So every directory and
 * every `PATHEXT` extension the platform would search is put to the same predicate.
 *
 * ⚠ RESOLUTION IS DELIBERATELY OVER-APPROXIMATED RATHER THAN REPRODUCED. The real order differs between the two
 * runtimes this repository runs — measured: for a bare name bun did NOT search the cwd and node DID — so an
 * exact reimplementation would be right on one and silently wrong on the other, which is the shape of defect
 * this seam keeps filing. ANY existing batch candidate refuses the run. ⭑ The cost is refusing an extensionless
 * program that a batch file merely shadows somewhere on `PATH`; the benefit is that being wrong lands on the
 * refusing side, and the refusal names the remedy.
 */
function batchTargetReached(
	program: string,
	cwd: string,
	env: Record<string, string>
): string | undefined {
	// AS SPELLED, first, and without touching the filesystem — the port's rule applied before anything else.
	if (namesABatchTarget(program)) return programFileName(program);
	// ⛔ A PROGRAM THAT ALREADY NAMES AN EXTENSION IS NOT EXTENDED BY THE PLATFORM, so there is nothing more to
	// search: the line above has already answered for it.
	if (extname(program) !== '') return undefined;
	const extensions = (env.PATHEXT ?? (process.platform === 'win32' ? WIN32_DEFAULT_PATHEXT : ''))
		.split(';')
		.map((extension) => extension.trim())
		.filter((extension) => extension !== '');
	// A platform that appends nothing leaves an extensionless program extensionless, and nothing here applies.
	if (extensions.length === 0) return undefined;
	// A program carrying a separator or a drive is a PATH, and `PATH` is not consulted for one.
	const carriesAPath = /[\\/]/.test(program) || /^[A-Za-z]:/.test(program);
	const directories = carriesAPath
		? [cwd]
		: [cwd, ...(env.PATH ?? '').split(delimiter).filter((directory) => directory !== '')];
	for (const directory of directories)
		for (const extension of extensions) {
			let candidate: string;
			try {
				candidate = resolvePath(directory, `${program}${extension}`);
			} catch {
				// A `PATH` entry the platform cannot resolve is one the platform cannot search either.
				continue;
			}
			if (!namesABatchTarget(candidate)) continue;
			if (present(candidate)) return programFileName(candidate);
		}
	return undefined;
}

/** What `omissions.json` says, so a capture DIRECTORY declares its own cut — `B6`. */
function declaredOmissions(regions: readonly ProcessOutputOmission[]): string {
	return `${JSON.stringify(
		{
			note:
				regions.length === 0
					? 'COMPLETE. stdout.txt and stderr.txt hold every byte the process emitted on each stream.'
					: 'INCOMPLETE — stdout.txt and stderr.txt are BOUNDED PREFIXES, and reading either as the whole output is a conclusion the process did not produce. Each region below says which stream was cut, why, how many UTF-8 BYTES were removed, and at what UTF-8 BYTE OFFSET the removal began; byteOffset + byteSize is what the process actually emitted on that stream.',
			omittedRegions: regions
		},
		null,
		'\t'
	)}\n`;
}

/**
 * A started child with stdin CLOSED and both output streams piped — exactly what `spawn` returns for the one
 * `stdio` this adapter uses, and not the wider `ChildProcessWithoutNullStreams`, which promises a writable
 * `stdin` this runner deliberately does not have.
 */
type PipedChild = ChildProcessByStdio<null, Readable, Readable>;

/** What the observer needs, which is a started child and the facts about the run it cannot see. */
export interface ChildRunObservation {
	readonly child: PipedChild;
	/** The program's FILE NAME, already derived — see `programFileName`. A refusal may say this and no more. */
	readonly programName: string;
	/**
	 * How the deadline ends the child.
	 *
	 * ⭑ A PARAMETER RATHER THAN `child.kill('SIGKILL')` INLINE, AND IT IS NOT AN INJECTION POINT — nothing in
	 * production passes anything else. It is the seam that makes the LAST arm below drivable: `SIGKILL` cannot be
	 * survived on either platform, so the only way to observe what this runner does when a kill accomplishes
	 * nothing is to hand it a kill that accomplishes nothing — against a REAL child, with real streams and real
	 * events, so the arrangement differs from production in exactly the one fact being tested.
	 */
	readonly terminate: () => void;
	readonly timeoutMs: number;
	readonly startedAt: number;
	readonly workspaceName: string;
	readonly retain: (
		stdout: string,
		stderr: string,
		omittedRegions: readonly ProcessOutputOmission[]
	) => Promise<ProcessOutputRetention>;
}

/**
 * Watch one started child and produce EXACTLY ONE outcome for it — `B2`, `B3` and `B4`, which are one seam.
 *
 * ⛔ EXPORTED FOR ITS SPEC AND FOR NOTHING ELSE. `run` below is the only production caller; what this buys is
 * that the arm which cannot be arranged with a real kill is nevertheless driven against a real child.
 */
export function observeChildRun(input: ChildRunObservation): Promise<ProcessRunOutcome> {
	return new Promise<ProcessRunOutcome>((resolve) => {
		const child = input.child;
		const outSink = captureSink('STDOUT');
		const errSink = captureSink('STDERR');
		let settled = false;
		let exited = false;
		let exitCode: number | null = null;
		let streamsClosed = false;
		let timedOut = false;
		let drain: ReturnType<typeof setTimeout> | undefined;
		let abandon: ReturnType<typeof setTimeout> | undefined;

		// ⚠ OBSERVED AT THE MOMENT OF THE DEADLINE, NEVER INFERRED AFTERWARDS AND NEVER READ OFF THE KILL. §36.2
		// separates TIMEOUT from TOOL_FAILURE; the fact that separates them is whether the CHILD WAS STILL RUNNING
		// when the budget ran out. `child.kill()` on an exited child returned `true` under bun and `false` under
		// node on this host — see the header — so its answer cannot carry this field.
		// ⚠ AND IT IS STARTED HERE, ABOVE THE FUNCTION THAT CLEARS IT, so `claim` never reads a binding that has
		// not been initialised. Every caller of `claim` is an event handler or a timer, so none of them can run
		// before this line; putting the deadline below them relied on that rather than on anything structural.
		const watchdog = setTimeout(() => {
			if (exited) {
				// The child is already gone and the deadline is merely late: a kill would accomplish nothing, and
				// calling this a timeout is the fabrication `B2` drove. Settle with what has arrived.
				settleRan();
				return;
			}
			timedOut = true;
			input.terminate();
			abandon = setTimeout(settleAfterKill, KILL_GRACE_MS);
		}, input.timeoutMs);

		/**
		 * ⛔ ONE OUTCOME, CLAIMED BEFORE ANYTHING IS DONE ON ITS BEHALF. `error` and `close` can both fire, and so
		 * can a deadline; the second must not overwrite the first AND must not perform the first's side effects.
		 * `B4` is what happens when only the RESOLUTION is guarded: `close` follows `error`, its handler retained
		 * the capture unconditionally, `finish` swallowed only the outcome — and a refused run left bytes on disk
		 * that no record named.
		 */
		function claim(): boolean {
			if (settled) return false;
			settled = true;
			clearTimeout(watchdog);
			if (drain !== undefined) clearTimeout(drain);
			if (abandon !== undefined) clearTimeout(abandon);
			// The outcome is decided, so this runner stops holding descriptors a descendant may still own.
			child.stdout.destroy();
			child.stderr.destroy();
			return true;
		}

		function settleRefused(refusedBecause: string): void {
			if (claim()) resolve({ ran: false, refusedBecause });
		}

		/** The ran arm — and the ONLY place a capture is retained, which is `B4`'s fix. */
		function settleRan(): void {
			// ⛔ READ BEFORE `claim`, WHICH DESTROYS THE PIPES AND WOULD THEREFORE MAKE THIS TRUE. Measured: read
			// afterwards it reported `outputComplete: true` for the very arrangement where a grandchild still held
			// the descriptors — a field that answers about the instrument's own act rather than about the run.
			const outputComplete = streamsClosed;
			if (!claim()) return;
			const out = outSink.settle();
			const err = errSink.settle();
			const omittedRegions = [out.omission, err.omission].filter(
				(region): region is ProcessOutputOmission => region !== undefined
			);
			const ran = (retention: ProcessOutputRetention): void => {
				resolve({
					ran: true,
					exitCode,
					timedOut,
					stdout: out.text,
					stderr: err.text,
					omittedRegions,
					outputComplete,
					retention,
					durationMs: Date.now() - input.startedAt
				});
			};
			// ⚠ THE REJECTION ARM IS NOT DEFENSIVE NOISE: `retain` awaits a Workspace this module does not own, and
			// an unhandled rejection here is a promise that never settles, which is the defect this whole function
			// exists to remove. A run that happened is reported either way.
			void input.retain(out.text, err.text, omittedRegions).then(ran, (cause: unknown) => {
				const code = (cause as NodeJS.ErrnoException | undefined)?.code;
				ran({
					retained: false,
					notRetainedBecause: `the run's output could not be retained: the output workspace raised rather than refusing (${code ?? 'unknown cause'}).`
				});
			});
		}

		/** After the kill: the child died and is reported, or it did not and that is said outright. */
		function settleAfterKill(): void {
			if (exited) {
				settleRan();
				return;
			}
			settleRefused(
				`the command in the workspace directory '${input.workspaceName}' exceeded its ${input.timeoutMs}ms budget, was sent SIGKILL, and had still not terminated ${KILL_GRACE_MS}ms later. No exit code was ever reported, so there is none to record: reporting one — including 'null', which states that the process was terminated by a signal — would assert a termination this runner did not observe. The process may still be running.`
			);
		}

		child.stdout.on('data', (chunk: Buffer) => outSink.take(chunk));
		child.stderr.on('data', (chunk: Buffer) => errSink.take(chunk));
		// Destroying a pipe can emit on it, and an unhandled stream error would take down the process that was
		// supposed to receive an outcome.
		child.stdout.on('error', () => undefined);
		child.stderr.on('error', () => undefined);

		// ⛔ A PROCESS THAT NEVER STARTED DID NOT RUN, AND THIS IS `RULE 5` AT THE ONE PLACE IT IS TEMPTING TO
		// BREAK. ENOENT is the commonest outcome of a model naming a tool the host does not have, and reporting it
		// as `ran: true, exitCode: 127` — the shell's convention for exactly this — would let a step record a
		// FAILED COMMAND where no command existed. The two are different facts.
		// ⚠ AND THE ARM IS NARROWED TO A SPAWN FAILURE BY `pid`, measured undefined on BOTH runtimes for a spawn
		// that failed and a number for one that did not. `error` also fires for a kill that could not be
		// delivered, and treating THAT as "nothing ran" would erase a process this runner watched start.
		child.on('error', (cause: NodeJS.ErrnoException) => {
			if (child.pid !== undefined) return;
			settleRefused(
				`'${input.programName}' could not be started in the workspace directory '${input.workspaceName}' (${cause.code ?? 'unknown cause'}). No process ran, so there is no exit code and no output: this is a refusal, not a failed command. The program's own file name is named and its arguments are not — an argv is a model's to choose and a host's layout belongs in nothing a step records.`
			);
		});

		// ⭐ THE CHILD, NOT THE PIPES — `B3`. `exit` is the child's own event and arrives whatever a descendant is
		// holding; `close` waits on the last descriptor and may never come at all.
		child.on('exit', (code: number | null) => {
			exited = true;
			exitCode = code;
			drain = setTimeout(settleRan, STREAM_DRAIN_GRACE_MS);
		});

		// The ordinary case, and it costs nothing: both pipes are released a tick after the child goes, so the
		// drain above is cancelled unused and `outputComplete` is true.
		child.on('close', () => {
			streamsClosed = true;
			if (exited) settleRan();
		});
	});
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
 * ⛔ AND IT REFUSES THREE MORE WIRINGS, EACH SEPARATELY, BECAUSE AN ARRANGEMENT THAT TRIPS TWO GUARDS PROVES
 * NEITHER. `B7` got in through the gap between two of them: the class was checked and the MATERIALIZATION was
 * not, so an IN_MEMORY workspace carrying the right class was accepted, a real child ran, and `retention` said
 * `retained: true` with a `stdoutPath` while `directoryPath` was `undefined` — bytes in a Map, reported as a
 * durable copy a purge could reach. And `B8` got in through a workspace this runner was never given at all.
 *
 * ⚠ IT THROWS, AND THAT IS NOT THE RULE THIS FILE OTHERWISE FOLLOWS — deliberately. The port's *"refuse, never
 * throw"* governs what a STEP records: an outcome a step must be able to write down. This is a HOST WIRING
 * error at CONSTRUCTION, before any step exists, and `createFilesystemWorkspace` sets the same precedent one
 * module over by refusing to open on a volume root. A runner that returned refusals forever because it was
 * wired wrongly would look exactly like the hermetic default.
 */
export function createChildProcessRunner(input: ChildProcessRunnerInput): ProcessRunner {
	const outputWorkspace = input.outputWorkspace;
	const deliverableWorkspace = input.deliverableWorkspace;
	if (outputWorkspace.purgeability !== 'PURGEABLE_AT_EXPIRY')
		throw new Error(
			`A real ProcessRunner cannot capture output into a workspace declared ${outputWorkspace.purgeability}. Sponsor ruling R7 requires stdout AND stderr to be retained and to come under purge, and PER-8 makes purge REFUSE on a workspace that declares its content has participated — so these captures could never be destroyed. Declare a second workspace with purgeability PURGEABLE_AT_EXPIRY for process output; the deliverable workspace stays RETAINED_BY_PARTICIPATION under R8.`
		);
	if (
		outputWorkspace.materialization !== 'FILESYSTEM' ||
		outputWorkspace.directoryPath === undefined
	)
		throw new Error(
			`A real ProcessRunner cannot capture output into a ${outputWorkspace.materialization} workspace. R7 requires a DURABLE copy of both streams that a purge can reach, and ProcessOutputRetention.stdoutPath is documented as naming it; a workspace with no directoryPath holds the bytes in a Map that dies with the process, so 'retained: true' would be a statement about memory dressed as a retention. Declare a FILESYSTEM workspace with purgeability PURGEABLE_AT_EXPIRY for process output.`
		);
	const deliverableDirectory = deliverableWorkspace.directoryPath;
	if (deliverableWorkspace.materialization !== 'FILESYSTEM' || deliverableDirectory === undefined)
		throw new Error(
			`A real ProcessRunner cannot be constructed against a ${deliverableWorkspace.materialization} deliverable workspace. The runner runs commands in that workspace's own directory and in no other — it is what makes a request's cwd checkable rather than caller-supplied — and a workspace with no directoryPath names no directory to run in. Wire the REFUSING default on an arm with no directory (RULE 5).`
		);
	const deliverableRoot = resolvePath(deliverableDirectory);

	/**
	 * A capture that did not land in full, refused — and whatever DID land, swept.
	 *
	 * ⛔ A PARTIAL CAPTURE IS NOT A RETENTION, AND LEAVING THE STRAY FILES IS `REG-F-336` C-2's ORPHAN PRODUCED
	 * BY THE FUNCTION WRITTEN TO PREVENT IT: bytes on the content plane with no record naming them. The strays
	 * are purged — which this workspace permits, because the whole point of its declared class is that it can be.
	 * ⚠ A purge that itself refuses is REPORTED rather than swallowed: the bytes are then genuinely an orphan,
	 * and a reader who is told so can act on it.
	 *
	 * ⛔ AND A PURGE THAT **RAISES** IS THE SAME FACT AS A PURGE THAT REFUSES, WHICH IS `W2` AND WAS A REAL HOLE.
	 * The port promises `purge` refuses rather than throws and both adapters here do — but `retain`'s outer
	 * `catch` already declines to trust that same promise for `writeFile`, and this arm did not. An adapter that
	 * raised produced `retained: false` with the landed bytes STILL ON DISK and nothing in the record naming
	 * them: `REG-F-336` C-2's orphan, arriving through the one function written to prevent it, for the second
	 * time. ⭐ THE POSTURE IS THE ONE THE RUNNER ALREADY TAKES ONE FUNCTION DOWN — rely on the promise AND do
	 * not trust it — and the reader is told the bytes are an orphan rather than left to infer it from silence.
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
			let outcome: PurgeOutcome;
			try {
				outcome = await outputWorkspace.purge(path);
			} catch (cause) {
				const code = (cause as NodeJS.ErrnoException | undefined)?.code;
				// ⚠ A THROW IS REPORTED AS THE REFUSAL IT AMOUNTS TO, rather than escaping to `retain`'s catch —
				// which would answer for the WRITE that never failed, drop every part's own reason, and say
				// nothing at all about the bytes it just left behind.
				outcome = {
					purged: false,
					refusedBecause: `the output workspace raised rather than refusing (${code ?? 'unknown cause'})`
				};
			}
			swept.push(
				outcome.purged
					? `the part that did land was purged, so no bytes remain that nothing points at`
					: `⚠ the part that did land could NOT be purged (${outcome.refusedBecause}), so those bytes are an orphan on the content plane`
			);
		}
		const sweepNote = swept.length === 0 ? '' : `. ${swept.join('; ')}`;
		return {
			retained: false,
			notRetainedBecause: `the run's output could not be retained — ${refusals.join('; ')}${sweepNote}`
		};
	}

	/**
	 * Write the capture into the output workspace, or state why it is not there.
	 *
	 * ⛔ THREE FILES, NOT TWO, AND THE THIRD IS `B6`. `retention` names *"the DURABLE copy and the only one a
	 * purge can reach"*, so a `stdout.txt` that is a bounded prefix with nothing beside it saying so hands the
	 * next reader a PREFIX THAT READS AS THE WHOLE — the port's own hazard sentence, and a pass nothing produced.
	 * The declaration travels twice: in the RECORD, as `retention.omittedRegions`, and ON DISK, as
	 * `omissions.json` beside the bytes it is about.
	 */
	async function retain(
		stdout: string,
		stderr: string,
		omittedRegions: readonly ProcessOutputOmission[]
	): Promise<ProcessOutputRetention> {
		const directory = `${CAPTURE_DIRECTORY}/${randomUUID()}`;
		const stdoutPath = `${directory}/stdout.txt`;
		const stderrPath = `${directory}/stderr.txt`;
		const omissionsPath = `${directory}/omissions.json`;
		// ⚠ ALL THREE ARE ALWAYS WRITTEN, INCLUDING AN EMPTY STREAM AND AN EMPTY CUT. An absent `stderr.txt` would
		// be ambiguous between "the command printed nothing" and "nothing was retained", and an absent
		// `omissions.json` between "nothing was cut" and "nobody looked". Those are different facts.
		const parts: readonly (readonly [string, string, string])[] = [
			['stdout', stdoutPath, stdout],
			['stderr', stderrPath, stderr],
			['omissions', omissionsPath, declaredOmissions(omittedRegions)]
		];
		try {
			const landed: (readonly [boolean, string, string])[] = [];
			for (const [name, path, contents] of parts) {
				const outcome = await outputWorkspace.writeFile(path, contents);
				landed.push([
					outcome.written,
					path,
					outcome.written ? '' : `${name}: ${outcome.refusedBecause}`
				]);
			}
			if (landed.every(([written]) => written))
				return {
					retained: true,
					workspaceOwnerId: outputWorkspace.ownerId,
					purgeability: outputWorkspace.purgeability,
					stdoutPath,
					stderrPath,
					omittedRegions,
					omissionsPath
				};
			return await refuseAndSweep(landed);
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
		async run(request: ProcessRunRequest): Promise<ProcessRunOutcome> {
			const startedAt = Date.now();
			const workspaceName = workspaceDirectoryName(deliverableRoot);
			const program = request.argv[0] ?? '';
			const programName = programFileName(program);

			// ⛔ B8 / B11 — THE ONE DIRECTORY THIS RUNNER MAY RUN IN, AND THE FILESYSTEM IS WHAT SAYS SO.
			// `cwd` is a required field on a plain interface and `planProcessRun` has no production call site, so
			// until this check existed a caller reached the host's filesystem by filling in a string. ⛔ AND
			// UNTIL `B11` IT WAS STILL TWO STRINGS: `resolvePath(request.cwd) !== deliverableRoot` compared the
			// TEXT, so a junction standing where the workspace directory used to be matched EXACTLY and the OS
			// followed it — driven, and the command wrote into the stand-in server tree. The question is not
			// *does this spell the workspace* but *does the operating system OPEN the workspace when it is given
			// this*, and `realpath` is the only instrument that answers that one.
			// ⛔ IT IS RESOLVED PER CALL, NEVER AT CONSTRUCTION, because that is precisely how the breach worked:
			// a root measured once cannot notice a swap that happens afterwards, and the swap IS the attack.
			// ⚠ AND THE COMPARISON IS ASYMMETRIC ON PURPOSE — the RESOLVED cwd against the DECLARED directory,
			// never resolved-against-resolved. Resolving BOTH sides is what `insideResolvedRoot` does one module
			// over, and it is right for ITS question (is this child path inside that root); for THIS question it
			// answers TRUE under the breach — MEASURED on node 24.11.1 and bun 1.3.14 — because both sides walk
			// through the same junction. `filesystem-workspace.ts` discloses that same arrangement as its bound
			// 2, OPEN, for exactly this reason. The DECLARED directory is the one name a swap cannot move, which
			// is why this runner can close for its own act what the workspace beneath it cannot close for hers.
			// ⚠ THE PRICE IS STATED RATHER THAN DISCOVERED: a host whose durable root legitimately lies under a
			// symlink, a junction or an 8.3 spelling has a deliverable directory that never resolves to its own
			// declared name, and this runner then refuses EVERY run with the second message below. That is loud,
			// it is immediate, and the remedy is in the refusal — the safe side of a comparison nobody gets right.
			const resolved = await resolvedDirectory(request.cwd);
			if ('unresolvable' in resolved)
				return {
					ran: false,
					refusedBecause: `a command may only be run in the workspace of ${deliverableWorkspace.ownerKind} '${deliverableWorkspace.ownerId}', whose directory is named '${workspaceName}', and the filesystem could not resolve the requested cwd at all (${resolved.unresolvable}). A check that cannot be answered REFUSES rather than falling back to the path text: the text is exactly what a directory that has been removed or replaced still spells correctly, so deciding on it would use the very instrument this check exists to replace. ⛔ AND WHICH directory this was is NOT stated, deliberately: an unresolvable path has not been identified as anything — saying the workspace is gone would assert a fact about an input this runner could not read, which is the defect B10 recorded. The errno code above is the platform's own answer and is what a reader acts on.`
				};
			if (resolved.directory !== deliverableRoot)
				// ⛔ TWO ARMS, BECAUSE THEY ARE TWO FACTS AND A REFUSAL MAY NOT STATE A FALSE ONE ABOUT ITS OWN
				// INPUT — this adapter's `B10` finding, at a new field. A cwd naming somewhere else is a CALLER
				// that assembled a path; a cwd naming this workspace that OPENS somewhere else is the workspace
				// directory being gone, and telling that reader to "derive the cwd from directoryPath" would be
				// advice that cannot help, about a mistake they did not make.
				return {
					ran: false,
					refusedBecause:
						resolvePath(request.cwd) === deliverableRoot
							? `a command may only be run in the workspace of ${deliverableWorkspace.ownerKind} '${deliverableWorkspace.ownerId}', whose directory is named '${workspaceName}' — and the filesystem no longer resolves that name to that directory. Something other than the workspace now stands at the path and REDIRECTS it: a junction, a symlink or a mount point. Running '${programName}' here would execute it somewhere the record does not describe while every path in the record still spells the workspace, which is the one outcome this seam exists to prevent. Where it now leads is deliberately not named — that is a host path, and this refusal travels into a governed record and a model's context.`
							: `a command may only be run in the workspace of ${deliverableWorkspace.ownerKind} '${deliverableWorkspace.ownerId}', whose directory is named '${workspaceName}'. This request carries a cwd naming '${workspaceDirectoryName(request.cwd)}' instead, and running there would execute '${programName}' somewhere the record does not describe. Derive the cwd from the workspace's own directoryPath — planProcessRun does — rather than assembling one.`
				};

			// ⛔ B1 — A TARGET WHOSE ARGUMENTS A COMMAND INTERPRETER WOULD RE-PARSE IS REFUSED, NOT QUOTED.
			const environment = childEnvironment(process.env);
			const batch = batchTargetReached(program, deliverableRoot, environment);
			if (batch !== undefined)
				return {
					ran: false,
					refusedBecause: `'${programName}' cannot be run: it reaches '${batch}', a .bat or .cmd target. Win32 cannot load one as a program image — the runtime hands the command line to cmd.exe, which re-parses '&', '|', '>' and '"' INSIDE ARGUMENTS — so this port's guarantee that an argv carries no quoting rules cannot be kept for it on this runtime. Driven under bun with shell:false, an argument containing '&' ran as a further command and wrote a file. The target is refused rather than the arguments escaped, because an escaping scheme for cmd.exe is a normaliser and every normaliser on this seam has been beaten. Name the executable the shim launches instead.`
				};

			let child: PipedChild;
			// ⛔ `spawn` THROWS SYNCHRONOUSLY FOR SOME ARGV, AND A THROW OUT OF `run` IS THE ONE THING THIS
			// ADAPTER MAY NOT DO. Driven: an embedded NUL in the program name, a NUL in an argument, and an
			// EMPTY program name all raise `ERR_INVALID_ARG_VALUE` BEFORE any process exists — so they never
			// reach the `error` event, and without this they would leave `run` as a rejected promise.
			// ⚠ AND `planProcessRun` DOES NOT COVER IT. It refuses an empty `argv[0]`, and nothing anywhere
			// looks for a NUL in a program name or an argument — so a lawfully PLANNED request reaches this
			// line and raises. The port's rule is about what a STEP can record, not about who built the
			// request, so the arm belongs here rather than as a second check up there.
			// ⛔ AND THE CAUSE IS NOT CLOSED, WHICH IS `B10`. This arm used to answer "an embedded NUL byte, or an
			// empty program name" — a disjunction of exactly two causes — and under real node a `.bat` target
			// raises `EINVAL` here, so the refusal stated something FALSE about its own input. A batch target is
			// refused above now and never reaches this line; the list below is named as EXAMPLES and the errno
			// CODE is what a reader acts on.
			// ⚠ THE MALFORMED ARGV IS NOT ECHOED BACK. It is malformed precisely by containing bytes no record
			// should carry — a NUL in a `refusedBecause` travels into a governed record and a model's context.
			try {
				child = spawn(program, request.argv.slice(1), {
					cwd: request.cwd,
					// ⛔ NO SHELL. An argv array, interpreted by nobody — and see B1 for the target class that
					// makes this insufficient on its own.
					shell: false,
					// ⛔ NO INHERITED ENVIRONMENT — see the header.
					env: environment,
					// stdin is closed; stdout and stderr are piped so they can be BOUNDED rather than streamed to
					// wherever this server's own descriptors point.
					stdio: ['ignore', 'pipe', 'pipe'],
					windowsHide: true
				});
			} catch (cause) {
				const code = (cause as NodeJS.ErrnoException | undefined)?.code;
				return {
					ran: false,
					refusedBecause: `a process could not be started in the workspace directory '${workspaceName}': the platform refused the argv itself (${code ?? 'unknown cause'}), before any process existed. The code above is the platform's own answer and is what a reader acts on; measured causes include an embedded NUL byte in the program name or an argument, and an empty program name, and that list is not closed. The argv is deliberately not quoted back here: an argv the platform refuses can carry bytes that belong in no record.`
				};
			}

			return observeChildRun({
				child,
				// ⭑ THE ONE KILL PRODUCTION USES. See `ChildRunObservation.terminate` for why it is a parameter.
				terminate: () => {
					child.kill('SIGKILL');
				},
				timeoutMs: request.timeoutMs,
				startedAt,
				workspaceName,
				programName,
				retain
			});
		}
	};
}
