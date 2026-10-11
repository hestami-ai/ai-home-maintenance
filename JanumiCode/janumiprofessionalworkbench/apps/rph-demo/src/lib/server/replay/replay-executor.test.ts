// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D2; `REG-F-530`) — THE REPLAY EXECUTOR: a `ProducerSession`
// whose turn runs each recorded tool call, in order and one at a time, through the REAL minted tools, then returns the
// recorded answer — once the turn's text hashes to the recorded one.
//
// ⭑ WHAT MUST HOLD:
//   · `getExecutionSession` opens it for a REPLAY selection (predicted red: today the selection is unwired, and the
//     opener refuses it — `model.ts`, "No executor is wired for the selection");
//   · a matching turn writes through the real `write_file` (the bytes land in the workspace, tokens expanded), runs
//     through the real `run_command` (on the REPLAYED runner, so the host's process-run observer records the recorded
//     outcome), and returns the recorded answer and producer — graded HOST_CONFIGURED, never PROVIDER_REPORTED;
//   · ⛔ a turn whose text is not the recorded one is REPLAY_STALE, naming the try and both hashes, and runs no tool;
//   · ⛔ a call whose outcome now differs from the recorded one fails the turn REPLAY_STALE;
//   · ⛔ it refuses a REAL runner: a replay's commands go through the REPLAYED runner, never a real one.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import { getExecutionSession } from '../execution/model.js';
import type { ToolInvocationResult } from '../tools/backing-tool.js';
import {
	RECORDING_FORMAT,
	recordingFiles,
	SCRUB_TOKENS,
	sha256Hex,
	type ExecutorTry,
	type RecordedCommand,
	type Recording
} from './recording.js';
import { createReplayRun, forgetReplayRuns, replayRunFor, type ReplayRun } from './replay-run.js';
import { openReplayExecutionSession } from './replay-executor.js';
import { createReplayedProcessRunner } from './replayed-runner.js';

const TURN = 'Work unit: Requirements. Write docs/requirements.md, then check it exists.';
const ANSWER = JSON.stringify({
	workProduct: { document: 'docs/requirements.md' },
	rationale: {
		rationale: 'Written and checked.',
		assumptions: [],
		limitations: [],
		residualUncertainty: []
	}
});
const PRODUCER = {
	agentId: 'execution.model-invocation',
	modelId: 'fixture-executor-model',
	providerId: 'fixture-provider'
};
const CHECK_ARGV = ['node', '-e', "console.log(require('fs').existsSync('docs/requirements.md'))"];

const TRY: ExecutorTry = {
	unit: 'requirements',
	turnSha256: sha256Hex(TURN),
	toolCalls: [
		{
			name: 'write_file',
			arguments: {
				path: 'docs/requirements.md',
				contents: '# Requirements\nRun from JPWB_REPLAY_WORKSPACE_POSIX.\n'
			},
			outcome: 'COMPLETED'
		},
		{ name: 'run_command', arguments: { argv: CHECK_ARGV }, outcome: 'COMPLETED' }
	],
	answer: { arrived: true, text: ANSWER },
	producer: PRODUCER
};
const CHECK: RecordedCommand = {
	argv: CHECK_ARGV,
	ran: true,
	exitCode: 0,
	timedOut: false,
	durationMs: 42,
	outputComplete: true,
	omissions: [],
	stdout: 'true\n',
	stderr: ''
};

const recordingOf = (
	executor: readonly ExecutorTry[],
	commands: readonly RecordedCommand[]
): Recording => ({
	manifest: {
		format: RECORDING_FORMAT,
		commit: 'fixture-commit',
		reviewerFingerprint: 'fixture-fingerprint',
		pwaContentDigest: 'fixture-digest',
		models: {
			executor: PRODUCER,
			reviewer: { agentId: 'devin', modelId: 'r', providerId: 'devin', callBoundMs: 240_000 }
		},
		scrub: { tokens: [...SCRUB_TOKENS] },
		expectedMatrix: []
	},
	executor,
	commands,
	reviewer: []
});

let root = '';
let workspaceDir = '';
let outputDir = '';
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'jpwb-replay-executor-'));
	workspaceDir = join(root, 'und_replay-0123456789abcdef');
	outputDir = `${workspaceDir}.process-output`;
	mkdirSync(workspaceDir);
	mkdirSync(outputDir);
});
afterEach(() => {
	forgetReplayRuns();
	rmSync(root, { recursive: true, force: true });
});

/** The replay's sandbox, as the replay host builds it: two FILESYSTEM workspaces and the REPLAYED runner. */
function contextOn(run: ReplayRun) {
	run.useSandbox({ workspace: workspaceDir, processOutput: outputDir });
	const workspace = createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_replay',
		purgeability: 'RETAINED_BY_PARTICIPATION',
		directoryPath: workspaceDir
	});
	const outputWorkspace = createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_replay',
		purgeability: 'PURGEABLE_AT_EXPIRY',
		directoryPath: outputDir
	});
	return {
		workspace,
		runner: createReplayedProcessRunner({
			deliverableWorkspace: workspace,
			outputWorkspace,
			commands: run
		}),
		grantedCapabilities: ['file-system', 'process-execution'],
		bindingAuthorizationStatus: 'AUTHORIZED'
	};
}

describe('⭐ the replay executor (D2) — recorded tool calls through the real minted tools', () => {
	it('getExecutionSession opens it for a REPLAY selection, from the recording the selection names', async () => {
		const dir = join(root, 'recording');
		mkdirSync(dir);
		for (const [file, text] of Object.entries(recordingFiles(recordingOf([TRY], [CHECK]))))
			writeFileSync(join(dir, file), text);
		// ⭑ The sandbox's runner draws on the same replay the session opens: one recording, one set of cursors.
		const run = replayRunFor(dir);
		const session = await getExecutionSession({ kind: 'REPLAY', recordingDir: dir })(
			contextOn(run)
		);
		expect(session.retainsHistory).toBe(true);
		const result = (await session.turn(TURN)) as ToolInvocationResult;
		expect(result.answer).toEqual({ arrived: true, text: ANSWER });
		expect(run.consumed()).toEqual({ executor: 1, commands: 1, reviewer: 0 });
	});

	it('a matching turn writes and runs through the real tools, and returns the recorded answer, graded HOST_CONFIGURED', async () => {
		const run = createReplayRun(recordingOf([TRY], [CHECK]), () => root);
		const session = await openReplayExecutionSession(contextOn(run), run);

		const result = (await session.turn(TURN)) as ToolInvocationResult;

		expect(result.answer).toEqual({ arrived: true, text: ANSWER });
		expect(result.producer).toEqual(PRODUCER);
		// ⛔ No provider reported this turn: the host asserts the recorded producer, and the record says so (`REG-F-530`).
		expect(result.identityEvidence).toBe('HOST_CONFIGURED');
		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [
				{ name: 'write_file', outcome: 'COMPLETED' },
				{ name: 'run_command', outcome: 'COMPLETED' }
			]
		});
		// The real `write_file` wrote the recorded bytes, the scrub's token expanded to THIS host's workspace.
		expect(readFileSync(join(workspaceDir, 'docs', 'requirements.md'), 'utf8')).toBe(
			`# Requirements\nRun from ${workspaceDir.replaceAll('\\', '/')}.\n`
		);
		// The real `run_command` reached the REPLAYED runner, and the host's observer recorded the recorded outcome.
		const runs = session.processRuns();
		expect(runs.observedCount).toBe(1);
		expect(runs.runs[0]).toMatchObject({
			argv: CHECK_ARGV,
			exitCode: 0,
			durationMs: 42,
			stdout: 'true\n'
		});
		expect(run.consumed()).toEqual({ executor: 1, commands: 1, reviewer: 0 });
	});

	it('⛔ a turn whose text is not the recorded one is REPLAY_STALE, naming the try and both hashes, and runs no tool', async () => {
		const run = createReplayRun(recordingOf([TRY], [CHECK]), () => root);
		const session = await openReplayExecutionSession(contextOn(run), run);
		const other = `${TURN} And one more thing.`;

		await expect(session.turn(other)).rejects.toThrow(
			`REPLAY_STALE: executor try 1 (unit requirements): the turn text's SHA-256 is ${sha256Hex(other)}, and the recording's is ${TRY.turnSha256}`
		);
		expect(run.consumed()).toEqual({ executor: 0, commands: 0, reviewer: 0 });
		expect(() => readFileSync(join(workspaceDir, 'docs', 'requirements.md'))).toThrow();
	});

	it('⛔ a call whose outcome now differs from the recorded one fails the turn REPLAY_STALE', async () => {
		// Recorded COMPLETED; replayed now, the path escapes the workspace and the real tool refuses it.
		const escaping: ExecutorTry = {
			...TRY,
			toolCalls: [
				{
					name: 'write_file',
					arguments: { path: '../outside.md', contents: 'x' },
					outcome: 'COMPLETED'
				}
			]
		};
		const run = createReplayRun(recordingOf([escaping], []), () => root);
		const session = await openReplayExecutionSession(contextOn(run), run);

		await expect(session.turn(TURN)).rejects.toThrow(
			/^REPLAY_STALE: executor try 1 \(unit requirements\), tool call 1 \(write_file\): the recorded run observed COMPLETED, and this replay observed REFUSED/
		);
		expect(session.lastTurnObservation()).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [{ name: 'write_file', outcome: 'REFUSED' }]
		});
	});

	it('⛔ refuses a REAL runner: a replay’s commands go through the REPLAYED runner, never a real one', async () => {
		const run = createReplayRun(recordingOf([TRY], [CHECK]), () => root);
		const context = {
			...contextOn(run),
			runner: {
				kind: 'REAL' as const,
				run: async () => ({ ran: false as const, refusedBecause: 'never' })
			}
		};
		await expect(openReplayExecutionSession(context, run)).rejects.toThrow(/REPLAYED runner/);
	});
});
