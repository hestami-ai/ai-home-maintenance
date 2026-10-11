// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D2, D3; `REG-F-530`) — THE REPLAYED `ProcessRunner`: it starts
// nothing, and answers each request from the recording.
//
// ⛔ COMMANDS ARE REPLAYED, NEVER RE-RUN (§5's finding). A command review's prompt carries the run's duration and its
// output, so a re-run — another duration, another temp path, another test order — would ask the reviewer something the
// recorded reply never answered, and the replay would refuse it as stale. So a request is checked against the recorded
// argv, the recorded capture's bytes are written where a real run leaves them, and the recorded outcome is returned.
//
// ⭑ THE CAPTURE IS LAID OUT AS THE REAL RUNNER LAYS IT OUT (`child-process-runner.ts`: `CAPTURE_DIRECTORY`,
// `declaredOmissions`): three files under `captures/<id>/`, in the PURGEABLE output workspace, named by `retention`. The
// evidence join (`R17`) blocks a result whose bytes were not kept (`process-result-floor.ts`), and a replay that named
// capture paths it does not hold would record a falsehood (`REG-F-530`, "Commands"): these paths name bytes on disk.
//
// ── ⛔ `REG-Q-066` — IT WRITES A RECORDED stderr BACK, UNDER `R7`'s DISPOSITION UNCHANGED ─────────────────────────────
// Both recorded streams are retained, in the output workspace declared `PURGEABLE_AT_EXPIRY`, named by
// `ProcessRunOutcome.retention`, beside `omissions.json`, and reachable by `Workspace.purge` — the real runner's
// disposition (`child-process-runner.ts`'s header), and this runner refuses construction where any of it is untrue. No
// new class: the bytes came from such a capture, and they go back into one. `verif/agy-stderr-unbound.test.ts` lists
// this module among the disposed sites, for this paragraph.
//
// ⛔ WHAT IT WILL NOT DO:
//   · START A PROCESS. There is no `spawn` here; the kind it declares, `REPLAYED`, says so to every reader of the port.
//   · RUN IN ANOTHER DIRECTORY. A request whose cwd is not the deliverable workspace's is refused before the recording
//     is read, as the real runner refuses it (`B8`) — so a mis-built request never takes a recorded command.
//   · ANSWER A REQUEST THE RECORDING DID NOT MAKE. An argv that is not the recorded one is refused `REPLAY_STALE` and
//     the replay is poisoned (`replay-run.ts`); nothing is written for it. ⚠ A refusal, never a throw: the port says
//     `run` always settles, and the executor's replay session then sees the call's outcome differ from the recording's
//     and fails the turn closed (`replay-executor.ts`).
import { randomUUID } from 'node:crypto';
import { resolve as resolvePath } from 'node:path';
import type {
	ProcessOutputRetention,
	ProcessRunOutcome,
	ProcessRunRequest,
	ProcessRunner,
	Workspace
} from '@janumipwb/rph-ports';
import { CAPTURE_DIRECTORY, declaredOmissions } from '../execution/child-process-runner.js';
import type { RecordedCommand } from './recording.js';
import type { ReplayCommandSource } from './replay-run.js';

export interface ReplayedProcessRunnerInput {
	/** The one directory a replayed command may be asked to run in — the deliverable workspace's. */
	readonly deliverableWorkspace: Workspace;
	/** Where the recorded capture bytes are written: PURGEABLE and on disk, as the real runner requires (`R7`). */
	readonly outputWorkspace: Workspace;
	/** The recording's commands, served in order, each checked. */
	readonly commands: ReplayCommandSource;
}

/**
 * ⭐ A `ProcessRunner` that replays. ⛔ Refuses construction against an output workspace with no directory or one that
 * cannot be purged, and against a deliverable with no directory — the real runner's three wiring refusals, for the same
 * reasons: a capture in a Map read as retained, a capture no purge can reach, a cwd nothing can check.
 */
export function createReplayedProcessRunner(input: ReplayedProcessRunnerInput): ProcessRunner {
	const { deliverableWorkspace, outputWorkspace, commands } = input;
	if (
		outputWorkspace.materialization !== 'FILESYSTEM' ||
		outputWorkspace.directoryPath === undefined
	)
		throw new Error(
			`A replayed ProcessRunner writes each recorded capture where a real run leaves it, and a ${outputWorkspace.materialization} output workspace has no directory to write it in: 'retained: true' would then name bytes in a Map. Wire a FILESYSTEM output workspace.`
		);
	if (outputWorkspace.purgeability !== 'PURGEABLE_AT_EXPIRY')
		throw new Error(
			`A replayed ProcessRunner cannot write captures into a workspace declared ${outputWorkspace.purgeability}: R7 requires captured output to come under purge, as the real runner does.`
		);
	const deliverableDirectory = deliverableWorkspace.directoryPath;
	if (deliverableWorkspace.materialization !== 'FILESYSTEM' || deliverableDirectory === undefined)
		throw new Error(
			`A replayed ProcessRunner is paired with a FILESYSTEM deliverable workspace, where the replayed tool calls write; a ${deliverableWorkspace.materialization} one names no directory a request's cwd can be checked against.`
		);
	const deliverableRoot = resolvePath(deliverableDirectory);

	/** The recorded capture, written as the real runner writes one — or a stated reason it could not be. */
	async function retain(
		recorded: Extract<RecordedCommand, { ran: true }>,
		stdout: string,
		stderr: string
	): Promise<ProcessOutputRetention> {
		const directory = `${CAPTURE_DIRECTORY}/${randomUUID()}`;
		const stdoutPath = `${directory}/stdout.txt`;
		const stderrPath = `${directory}/stderr.txt`;
		const omissionsPath = `${directory}/omissions.json`;
		const refusals: string[] = [];
		for (const [name, path, contents] of [
			['stdout', stdoutPath, stdout],
			['stderr', stderrPath, stderr],
			['omissions', omissionsPath, declaredOmissions(recorded.omissions)]
		] as const) {
			const written = await outputWorkspace.writeFile(path, contents);
			if (!written.written) refusals.push(`${name}: ${written.refusedBecause}`);
		}
		if (refusals.length > 0)
			return {
				retained: false,
				notRetainedBecause: `the replayed capture could not be written — ${refusals.join('; ')}`
			};
		return {
			retained: true,
			workspaceOwnerId: outputWorkspace.ownerId,
			purgeability: outputWorkspace.purgeability,
			stdoutPath,
			stderrPath,
			omittedRegions: recorded.omissions,
			omissionsPath
		};
	}

	return {
		// ⛔ REPLAYED, NEVER REAL: the port's own member for a runner that starts nothing (`process-runner.ts`).
		kind: 'REPLAYED',
		async run(request: ProcessRunRequest): Promise<ProcessRunOutcome> {
			if (resolvePath(request.cwd) !== deliverableRoot)
				return {
					ran: false,
					refusedBecause: `a command may only be replayed in the workspace of ${deliverableWorkspace.ownerKind} '${deliverableWorkspace.ownerId}', and this request names another directory. Nothing was replayed.`
				};
			const next = commands.nextCommand(request.argv);
			if ('refusal' in next) return { ran: false, refusedBecause: next.refusal.message };
			const recorded = next.recorded;
			if (!recorded.ran)
				return { ran: false, refusedBecause: commands.expand(recorded.refusedBecause) };
			const stdout = commands.expand(recorded.stdout);
			const stderr = commands.expand(recorded.stderr);
			return {
				ran: true,
				exitCode: recorded.exitCode,
				timedOut: recorded.timedOut,
				stdout,
				stderr,
				omittedRegions: recorded.omissions,
				outputComplete: recorded.outputComplete,
				retention: await retain(recorded, stdout, stderr),
				// ⭐ THE RECORDED DURATION, never this replay's: a command review's prompt carries it.
				durationMs: recorded.durationMs
			};
		}
	};
}
