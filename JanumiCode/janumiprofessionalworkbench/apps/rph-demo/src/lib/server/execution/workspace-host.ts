// JAN-EXEC Phase 2 — WHERE AN UNDERTAKING'S WORKSPACE LIVES, and the runner that is wired beside it.
//
// ⭐ `R8` RULES THE OWNER: **the workspace is the DELIVERABLE**, it must persist, survive a restart and be
// inspectable after the undertaking ends — so `ownerKind` is `UNDERTAKING` and nothing narrower.
//
// ⛔ AND EVERY EXISTING LIFECYCLE IN THIS REPOSITORY IS NARROWER THAN THAT, WHICH IS WHY THE RULING HAD TO BE
// EXPLICIT. The producer session is disposed per work unit (`producer.dispose()` in a `finally`), `beginExecute`
// mints a fresh plan and a fresh step per click, and the only pre-existing filesystem scratch in production demo
// code is a `mkdtemp` created and removed inside ONE call. Absent the ruling the default that emerges is
// per-invocation — and the spike measured the consequence: with one UNDERTAKING-owned directory a SECOND step,
// in a NEW session with a NEW plan, ran against a file the FIRST step wrote. Step-owned, that call finds
// nothing, and a multi-phase PWA builds seven fragments instead of one product.
//
// ── ⛔ THE HOST HAD NOWHERE TO HANG SUCH A RESOURCE, AND THAT IS THE ACTUAL WORK ─────────────────────────────
// Measured before this file existed: no `hooks.server.ts`, no `locals`, no `+layout.server.ts`; `grep "locals"`
// over the app returns 0. The entire mutable process state of the server tree is FIVE `let` declarations, all in
// `workbench.ts`, and every shared resource is an exported getter. `getArtifactStore()` gets away with a bare
// process singleton because it is CONTENT-ADDRESSED and puts the tenant in the KEY; a workspace cannot be
// content-addressed — it is mutable and path-named — so it needs the same trick one level down:
// **one durable root, one subdirectory DERIVED from the owner id, RESOLVED PER REQUEST rather than held.**
// A SvelteKit form action cannot hold an object across requests, which is exactly what the spike did.
//
// ── ⭑ THE ROOT IS DERIVED FROM `JPWB_DEMO_DB`, NOT FROM A SECOND ENV KEY, AND THE REASON IS AN ORPHAN ───────
// `getArtifactStore()` derives the CONTENT plane's location from the RECORD plane's key — `${DB_PATH}.content.
// sqlite` — and `ArtifactStore.durability`'s docblock names the defect that derivation avoids: "The record plane
// can be durable (a SQLite adapter) while the content plane is not, and then a permanent record names a
// `storageKey` whose store answer, after one restart, is byte-indistinguishable from a key that was never
// stored." A SECOND env key would reintroduce exactly that orphan here, one plane over: an operator who set the
// database and not the workspace root would get a durable, permanent record of an execution step whose
// deliverable evaporated at restart, and nothing in either record would say so. One key configures all three
// planes or none of them.
//
// ── ⛔ DURABILITY IS GRANTED ONLY TO A PROCESS THAT DECLARES IT IS SERVING ───────────────────────
// This arm used to read "TEST MODE IGNORES THE ROOT UNCONDITIONALLY" and key on `RPH_DEMO_MODE === 'test'` —
// which ONLY the Playwright configs set. `vitest.config.ts` does not, so `vitest run --project app:rph-demo`
// with `JPWB_DEMO_DB` set was NOT test mode by that predicate: driven, it produced real directories on disk and
// a durable 2,719,744-byte `demo.sqlite`, and `undertaking-loader-object-type.test.ts`'s CONTROL went red —
// precisely the order-dependence `resetEngine` exists to prevent, arriving through the one runner the predicate
// did not name.
//
// ⛔ A SECOND ENV CHECK WOULD HAVE CLOSED THAT RUNNER AND NOT THE NEXT ONE, because a blocklist of runners is a
// list that rots — the failure mode this repository keeps filing. So the test is AFFIRMATIVE: `RPH_DEMO_MODE=
// server` buys durability, and every other process — named, unnamed, or future — is in-memory BY CONSTRUCTION.
// That is what `JPWB_DEMO_DB`'s own docblock already claimed and could not deliver: "a durable store shared
// across specs would make them order-dependent, which is the failure mode `resetEngine` exists to prevent. So
// test mode is in-memory by construction, not by configuration."
//
// ⚠ AND IT IS NOT A SECOND KEY CONFIGURING A PLANE, which the paragraph above forbids. `JPWB_DEMO_DB` still
// says WHERE all three planes live and nothing splits that. `RPH_DEMO_MODE` says WHAT THIS PROCESS IS — a fact
// about the process rather than about the deployment, and the one fact a test runner cannot supply by accident.
//
// ── ⛔ AND THE DERIVATION ITSELF HAS TWO BOUNDS, BOTH OF THEM BREACHED BEFORE THEY WERE WRITTEN ──────────
// 1. ⛔ THE ROOT MUST BE ABSOLUTE, AND ABSOLUTE IN THE SENSE WIN32 MEANS. `resolvePath(join(root, segment))`
//    resolves a RELATIVE root against `process.cwd()`, so `JPWB_DEMO_DB=demo.sqlite` put every Undertaking's
//    workspace INSIDE THE SERVER'S OWN SOURCE TREE — the exact defect this phase exists to remove, reached
//    through configuration instead of through an owner id. The suite held only because every case injected an
//    absolute root under `tmpdir()`; nothing required the DERIVED one to be absolute at all. ⚠ `isAbsolute`
//    IS NOT THE QUESTION: it answers TRUE for `\workspaces`, which resolves against the process's CURRENT
//    DRIVE, and FALSE-looking `C:workspaces` resolves against that drive's CURRENT DIRECTORY. The predicate
//    below asks the question that actually matters — does this root name the same directory NO MATTER what it
//    is resolved against — and refuses rather than substituting, for the reason the owner id refuses.
// 2. ⛔ THE DERIVATION MUST BE INJECTIVE UNDER THE FILESYSTEM'S EQUALITY, NOT THE STRING'S. `UND-ALPHA` and
//    `und-alpha` are two Undertakings and produced two different `directoryPath` STRINGS — so the suite's own
//    distinctness assertion passed — while NTFS gave them ONE DIRECTORY: one wrote `src/index.ts` and the other
//    read it back. Refusing the second would deny a lawful Undertaking its workspace forever, so the fix is to
//    make the map injective instead: the directory name carries a fingerprint of the EXACT id, in lower-case
//    hex, so two ids that a case-insensitive filesystem cannot tell apart get two directories it can.
//
// ⚠ READ IN THE DEFAULT-PARAMETER SHAPE, NOT A FROZEN MODULE CONST. `workbench.ts` freezes `DB_PATH` at import,
// and `floor-recording.test.ts:19-21` records what that costs: "a plain assignment below the imports would be
// read after the const froze", so every test of an env-dependent branch needs `vi.hoisted` plus a module reset.
// A default parameter is read at CALL time, so the same branches are reachable by calling the function.
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import {
	containedWorkspacePath,
	createInMemoryWorkspace,
	createRefusingProcessRunner,
	type ProcessRunner,
	type Workspace
} from '@janumipwb/rph-ports';
import { createChildProcessRunner } from './child-process-runner.js';
import { createFilesystemWorkspace } from './filesystem-workspace.js';
import { replayRunFor, type ReplayRun } from '../replay/replay-run.js';
import { createReplayedProcessRunner } from '../replay/replayed-runner.js';
import { REPLAY_VARIABLE, resolveReplayRecording } from '../replay/replay-switch.js';

/**
 * The ports an Undertaking's execution runs against, resolved together.
 *
 * ⛔ TOGETHER RATHER THAN SEPARATELY, BECAUSE THE PORTS ARE NOT INDEPENDENT. `workspace.ts`'s header states it:
 * "A `ProcessRunner` needs a real `cwd`; an IN_MEMORY workspace has none … A host wiring a REAL runner against
 * an IN_MEMORY workspace has made an error that must be caught BEFORE anything runs." Handing a caller one
 * without the other is how that pairing stops being checkable at all.
 *
 * ⭐ AND PHASE 2b MAKES IT THREE, BECAUSE `R7` CANNOT BE SATISFIED BY TWO. A real runner captures both streams;
 * `R7` says both are retained AND both come under purge; `purge` REFUSES on the deliverable workspace, which
 * `R8` declares `RETAINED_BY_PARTICIPATION`. The port states the consequence rather than leaving it to be
 * discovered: *"one workspace cannot hold participating and purgeable material side by side. A host needing
 * both declares two."* This host needs both, so it declares two — which is the retention disposition
 * `REG-Q-066` demanded, expressed as a wiring rather than as a comment.
 */
export interface UndertakingSandbox {
	readonly workspace: Workspace;
	/**
	 * ⛔ WHERE `R7`'s RETAINED STREAMS LIVE — `PURGEABLE_AT_EXPIRY`, and NOT the deliverable.
	 *
	 * ⚠ IT IS NOT HANDED TO THE PRODUCER. `ProducerSessionContext` takes `workspace` and `runner`; a model gets
	 * no name for this one, and no path it can write through the deliverable workspace reaches a sibling.
	 */
	readonly outputWorkspace: Workspace;
	readonly runner: ProcessRunner;
}

/**
 * Appended to the deliverable directory's own path to name the process-output workspace BESIDE it.
 *
 * ⛔ A SIBLING, NOT A SUBDIRECTORY, AND PHASE 2's `F1` IS WHY. A reserved area INSIDE a directory a step writes
 * to is a name a step can spell — and two adversaries in a row beat that arrangement by spelling it differently
 * from the guard (case, then the NTFS 8.3 alias) while the filesystem read both spellings as the same file. The
 * correction recorded there is the arrangement, not a third spelling: *"A sibling has no spelling a contained
 * path can reach — `locate` admits only paths that resolve at or under the root."* Retained build output is
 * exactly the kind of thing a step must not be able to rewrite, so it goes where the tombstone record went.
 *
 * ⚠ AND IT IS A DISTINCT SUFFIX FROM THE TOMBSTONE RECORD'S, DELIBERATELY. `filesystem-workspace.ts` names its
 * record `<dir>.jpwb-workspace-tombstones.json`; this directory is `<dir>.process-output`, and its OWN record is
 * therefore `<dir>.process-output.jpwb-workspace-tombstones.json`. Three siblings, three names, no collision.
 */
const PROCESS_OUTPUT_DIRECTORY_SUFFIX = '.process-output';

/** The one declaration that BUYS durability. Nothing else does, and nothing is inferred — see the header. */
const SERVING_DECLARATION = 'server';

/**
 * The durable root, or `undefined` when there is none.
 *
 * ⛔ AFFIRMATIVE, AND BEFORE THE KEY IS EVEN READ: a process that has not declared itself a server gets no
 * durable root, whatever it has configured. Every runner is covered by that, including the ones nobody has
 * written yet — see the header for the one that was not covered by the predicate this replaces.
 */
function durableWorkspaceRoot(env: NodeJS.ProcessEnv): string | undefined {
	if (env.RPH_DEMO_MODE !== SERVING_DECLARATION) return undefined;
	const db = env.JPWB_DEMO_DB;
	return db === undefined || db === '' ? undefined : `${db}.workspaces`;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D3; `REG-F-530`) — THE REPLAY THIS PROCESS RUNS, or `undefined`.
 *
 * ⛔ TEST MODE AND THE SWITCH, BOTH, READ AFFIRMATIVELY — `RPH_DEMO_MODE === 'test'`, the one declaration the stand-ins
 * key on, and `JPWB_REPLAY` naming a recording. Outside test mode the switch buys nothing here: the selectors refuse it
 * before anything is dispatched (`replay-switch.ts`), so no sandbox of a refused replay is ever asked for.
 * ⛔ A RECORDING THAT CANNOT BE READ THROWS (`RecordingRefusal`): the step that asked for the sandbox records it as a
 * failure, rather than falling back to the in-memory arm, where a replayed write would have nowhere to land.
 */
function replayOfThisProcess(env: NodeJS.ProcessEnv): ReplayRun | undefined {
	if (env.RPH_DEMO_MODE !== 'test') return undefined;
	const recordingDir = resolveReplayRecording(env[REPLAY_VARIABLE]);
	return recordingDir === undefined ? undefined : replayRunFor(recordingDir);
}

/**
 * Does this root name the same directory NO MATTER what it is resolved against?
 *
 * ⛔ A COMPARISON RATHER THAN `isAbsolute`, AND THE WIN32 SPELLINGS ARE WHY — see bound 1 in the header. Two
 * probe bases on DIFFERENT drives: a root that is genuinely rooted resolves identically against both, while
 * every form that depends on the process (a plain relative path, a drive-relative `C:workspaces`, a
 * drive-less `\workspaces`) resolves differently. Measured on this host, it answers FALSE for all five
 * relative spellings and TRUE for drive-absolute and UNC roots. ⚠ ON POSIX the two bases are ordinary relative
 * segments, and the comparison still discriminates for the same reason: only a root that ignores its base can
 * ignore both of them.
 */
function rootedIndependentlyOfTheProcess(root: string): boolean {
	return resolvePath('C:/jpwb-probe-a', root) === resolvePath('D:/jpwb-probe-b', root);
}

/**
 * 16 hex characters of SHA-256 over the EXACT owner id — what makes the directory derivation INJECTIVE on a
 * case-insensitive filesystem (bound 2 in the header).
 *
 * ⚠ LOWER-CASE HEX IS LOAD-BEARING: two fingerprints that differ at all therefore differ case-insensitively
 * too, so `UND-ALPHA-437b70bcd7e508e5` and `und-alpha-fce2765bdd2a3fce` are two directories on every filesystem
 * rather than one. The id stays in front of it, so the directory is still inspectable as `R8` requires.
 */
function ownerFingerprint(undertakingId: string): string {
	return createHash('sha256').update(undertakingId, 'utf8').digest('hex').slice(0, 16);
}

/**
 * The deliverable directory the DURABLE arm gives an owner: one subdirectory of the root, named by the owner and its
 * fingerprint. ⭑ One expression, read by `resolveUndertakingSandbox` and by `undertakingWorkspaceDirectory`, so the
 * directory a step runs in and the one a refusal looks beside cannot come apart.
 */
function durableDeliverableDirectory(root: string, segment: string, undertakingId: string): string {
	return resolvePath(join(root, `${segment}-${ownerFingerprint(undertakingId)}`));
}

/**
 * ⭐ `JAN-MHX` MH-3 (`DESIGN-multi-harness-executor.md` D21a) — THE DIRECTORY `resolveUndertakingSandbox` WOULD GIVE AN
 * UNDERTAKING ON ITS DURABLE ARM, CREATING NOTHING, or `undefined` where that arm would not be taken: no durable root, a
 * root that resolves against the process, or an owner id the sandbox refuses.
 *
 * ⭑ WHY IT EXISTS: a CLI executor's breach is marked beside the workspace its session ran in (`workspace-taint.ts`), and
 * Begin & Execute and a re-run of the work must read that mark BEFORE they dispatch — so before the sandbox is resolved,
 * which creates directories and, under a replay, takes the replay's own. A CLI executor's session refuses any workspace
 * without a directory (`producerWorkingDirectory`), and a replay runs no CLI executor, so the durable arm is the only one
 * a mark can be beside.
 */
export function undertakingWorkspaceDirectory(
	undertakingId: string,
	root: string | undefined = durableWorkspaceRoot(process.env)
): string | undefined {
	if (root === undefined || root === '' || !rootedIndependentlyOfTheProcess(root)) return undefined;
	const ownSegment = containedWorkspacePath(undertakingId);
	return ownSegment === undertakingId && !ownSegment.includes('/')
		? durableDeliverableDirectory(root, ownSegment, undertakingId)
		: undefined;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D3; `REG-F-530`) — A REPLAY'S SANDBOX: FILESYSTEM workspaces
 * under the replay's DISPOSABLE root, paired with the REPLAYED runner.
 *
 * ⭑ WHY A DIRECTORY AT ALL: a replay rebuilds the deliverable through the product's own `write_file`, and the evidence
 * join blocks a command result whose capture bytes were not kept (`R17`) — so both need a directory, which test mode's
 * IN_MEMORY arm does not have (`REG-F-530`'s *"the test-mode rule it adopts gives a replay no filesystem workspace"*).
 * ⛔ NEVER THE REAL RUNNER: test mode keeps "nothing executes" — the REPLAYED runner starts nothing and answers from the
 * recording. ⛔ AND THE STORES STAY IN MEMORY: the root is a temporary folder of this replay's (`ReplayRun.root`), and
 * `JPWB_DEMO_DB` buys nothing in test mode — a replay is as disposable as every other test-mode run.
 * ⭑ The same derivation as the durable arm (one subdirectory per owner, fingerprinted; a `.process-output` sibling), and
 * the replay is told the two directories, which are what its scrub replaces before it hashes.
 */
function replaySandbox(
	undertakingId: string,
	segment: string,
	replay: ReplayRun
): UndertakingSandbox {
	const directoryName = `${segment}-${ownerFingerprint(undertakingId)}`;
	const deliverableDirectory = resolvePath(join(replay.root(), directoryName));
	const outputDirectory = `${deliverableDirectory}${PROCESS_OUTPUT_DIRECTORY_SUFFIX}`;
	mkdirSync(deliverableDirectory, { recursive: true });
	mkdirSync(outputDirectory, { recursive: true });
	replay.useSandbox({ workspace: deliverableDirectory, processOutput: outputDirectory });
	const deliverable = createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: undertakingId,
		purgeability: 'RETAINED_BY_PARTICIPATION',
		directoryPath: deliverableDirectory
	});
	const output = createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: undertakingId,
		purgeability: 'PURGEABLE_AT_EXPIRY',
		directoryPath: outputDirectory
	});
	return {
		workspace: deliverable,
		outputWorkspace: output,
		runner: createReplayedProcessRunner({
			deliverableWorkspace: deliverable,
			outputWorkspace: output,
			commands: replay
		})
	};
}

/**
 * Resolve the sandbox for ONE Undertaking — per request, never held.
 *
 * ⛔ THE OWNER ID IS CHECKED BEFORE IT BECOMES A DIRECTORY NAME. It arrives from a stored object rather than
 * from a form, but it is still an id being spliced into a filesystem path, and `..`, a leading separator or a
 * drive letter would put the "workspace" above the root — in the limit, the server's own tree, which is the one
 * outcome this whole phase exists to make impossible. `containedWorkspacePath` is the predicate the port
 * exports for exactly this, and the extra equality is what keeps ONE owner to ONE directory: `a/b` is contained
 * but would nest one Undertaking's workspace inside another's.
 *
 * ⚠ IT THROWS RATHER THAN SUBSTITUTING. A fallback directory would be a workspace nobody chose, holding a
 * deliverable nobody could find — `NO DEFAULT THAT FABRICATES` reaching the host through the owner id.
 */
export function resolveUndertakingSandbox(
	undertakingId: string,
	root: string | undefined = durableWorkspaceRoot(process.env),
	/** ⭐ `JAN-EXEC` Phase 8 (D3) — the replay this process runs (`replayOfThisProcess`), unless a test hands in its own. */
	replay: ReplayRun | undefined = replayOfThisProcess(process.env)
): UndertakingSandbox {
	const segment = containedWorkspacePath(undertakingId);
	if (segment === undefined || segment !== undertakingId || segment.includes('/'))
		throw new Error(
			`'${undertakingId}' cannot name an Undertaking workspace directory. The owner id becomes ONE path segment under the durable root: it may not be empty, may not contain a separator, and may not resolve above the root. Refusing rather than substituting a directory: a workspace nobody chose would hold a deliverable nobody could find.`
		);

	// ⭐ `JAN-EXEC` Phase 8 (D3) — A REPLAY'S OWN ARM, before the in-memory one it would otherwise take in test mode.
	if (replay !== undefined) return replaySandbox(undertakingId, segment, replay);

	if (root === undefined || root === '')
		// ⚠ LAWFUL, AND DISCLOSED RATHER THAN SILENT — the same posture `getArtifactStore()` takes without a
		// configured database. An IN_MEMORY workspace DECLARES that it has no directory, so a producer session
		// is refused a working directory instead of inheriting the server's, and `planProcessRun` refuses a run
		// instead of executing somewhere else. What is lost is durability, which the declaration states.
		//
		// ⛔ AND THE RUNNER STAYS THE REFUSING DEFAULT ON THIS ARM — `RULE 5`, at the one place the two arms make
		// it expressible. A REAL runner needs a real `cwd` and there is none here; wiring one would mean either
		// a command executing in the server's own tree or, at best, `planProcessRun` reporting a HOST WIRING
		// ERROR that this host itself committed. The real runner is wired where and only where the workspace
		// materialization is FILESYSTEM.
		return {
			workspace: createInMemoryWorkspace({
				ownerKind: 'UNDERTAKING',
				ownerId: undertakingId,
				purgeability: 'RETAINED_BY_PARTICIPATION'
			}),
			// ⚠ DECLARED PURGEABLE ON THIS ARM TOO, THOUGH NOTHING CAN WRITE TO IT. The class is a statement
			// about what the workspace HOLDS, not about whether anything is holding it yet, and an in-memory
			// output workspace that declared itself participating would be a false statement waiting for the day
			// someone wires a runner to it.
			outputWorkspace: createInMemoryWorkspace({
				ownerKind: 'UNDERTAKING',
				ownerId: undertakingId,
				purgeability: 'PURGEABLE_AT_EXPIRY'
			}),
			runner: createRefusingProcessRunner()
		};

	// ⛔ A ROOT THAT RESOLVES AGAINST THE PROCESS IS REFUSED, NEVER RESOLVED. The next line would otherwise
	// resolve it against `process.cwd()` — the server's own tree, which is the one outcome this phase exists to
	// make impossible — and `mkdirSync` would then CREATE it there before anything was written.
	if (!rootedIndependentlyOfTheProcess(root))
		throw new Error(
			`'${root}' cannot be an Undertaking workspace root: it is not absolute, so it resolves against this process's own working directory and the deliverable would land inside the server's tree. Refusing rather than resolving it: configure JPWB_DEMO_DB with an absolute path.`
		);

	// ⭑ ONE SUBDIRECTORY PER OWNER, DERIVED — never a fresh directory per call. This single derivation
	// (`durableDeliverableDirectory`) is what makes a second step, in a new session with a new plan, land in the same
	// place as the first.
	// ⛔ AND THE FINGERPRINT IS WHAT MAKES THE DERIVATION INJECTIVE ON A CASE-INSENSITIVE FILESYSTEM (bound 2):
	// without it `UND-ALPHA` and `und-alpha` are two ids, two strings, and ONE directory on disk.
	const directoryPath = durableDeliverableDirectory(root, segment, undertakingId);
	// Created eagerly so the deliverable is INSPECTABLE the moment the Undertaking starts executing (`R8`),
	// rather than only once something has been written into it. `recursive` makes this idempotent per request.
	mkdirSync(directoryPath, { recursive: true });
	// ⭐ THE SECOND WORKSPACE — `R7`'s, and Phase 2b's answer to `REG-Q-066`. See `PROCESS_OUTPUT_DIRECTORY_SUFFIX`
	// for why it is a SIBLING, and `child-process-runner.ts`'s header for the disposition in full.
	const outputDirectoryPath = `${directoryPath}${PROCESS_OUTPUT_DIRECTORY_SUFFIX}`;
	mkdirSync(outputDirectoryPath, { recursive: true });
	const outputWorkspace = createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: undertakingId,
		// ⛔ PURGEABLE, AND FORCED RATHER THAN CHOSEN. `R7` says stdout and stderr *"both come under purge"*;
		// `PER-8` makes `purge` refuse on anything declared to have participated; `Purgeability` has exactly two
		// members and coining a third is forbidden (`REG-Q-056` is OPEN). One member survives that conjunction.
		// ⭑ AND `REG-D-050` AGREES ON THE MERITS: *"PARTICIPATION IS A PROPERTY OF USE, NOT OF KIND"*, and
		// nothing cites a captured stream in a recorded judgement today — the evidence join is Phase 5.
		purgeability: 'PURGEABLE_AT_EXPIRY',
		directoryPath: outputDirectoryPath
	});
	// ⭐ THE DELIVERABLE, HOISTED OUT OF THE RETURN BECAUSE THE RUNNER IS NOW CONSTRUCTED AGAINST IT — `B8`.
	// Until it was, the runner had no way to tell the workspace's directory from any other string a caller put
	// in `ProcessRunRequest.cwd`, and an adversary ran a command in THIS REPOSITORY by supplying one.
	const workspace = createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: undertakingId,
		// ⛔ `PER-8`, AND IT IS `R8` STATED AS A RETENTION CLASS. The deliverable must survive the
		// undertaking, so `purge` REFUSES here. ⚠ THE COST IS REAL AND THE PORT NAMES IT: "one workspace
		// cannot hold participating and purgeable material side by side; a host needing both declares two."
		// `R7`'s retained stdout and stderr are purgeable-at-expiry and therefore live in the SECOND
		// workspace declared just above — not under a third `Purgeability` member.
		purgeability: 'RETAINED_BY_PARTICIPATION',
		directoryPath
	});
	return {
		workspace,
		outputWorkspace,
		// ⭐ THE REAL RUNNER LANDS HERE AND ONLY HERE — the one arm with a real directory to run in. It is
		// constructed against BOTH workspaces, and refuses to be constructed against an output workspace whose
		// bytes could never be purged or that has no directory at all — which is what makes `R7` structural
		// rather than documentary. ⛔ AND IT TAKES THE DELIVERABLE BECAUSE A RUNNER THAT IS NOT GIVEN THE ONE
		// DIRECTORY IT MAY RUN IN CANNOT CHECK THE `cwd` IT IS HANDED: `planProcessRun` is a convention with no
		// production call site, and a convention is not a control.
		runner: createChildProcessRunner({ deliverableWorkspace: workspace, outputWorkspace })
	};
}
