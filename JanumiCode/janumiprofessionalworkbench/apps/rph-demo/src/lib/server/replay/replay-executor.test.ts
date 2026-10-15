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
//   · ⛔ it refuses a REAL runner: a replay's commands go through the REPLAYED runner, never a real one;
//   · ⭐ (the review of E4) ⛔ a try whose recorded INSTRUCTIONS or TOOL DEFINITIONS are not what this code gives the
//     executor is REPLAY_STALE, naming the part (finding 1 — predicted red, observed: the turn replayed green); ⛔ no try
//     is served before the published PWA was held to the recording (finding 4); a recorded CALL_FAILED replays with its
//     recorded reporter (finding 9 — predicted red, observed: `reportedBy` "PROVIDER" where the recording said "TOOL");
//     and ⛔ after any refusal the executor serves no try (finding 7 — its mutant: the poison check deleted);
//   · ⭐ (the lead's delegated decision of 2026-10-15, to be registered) ⛔ a call whose RESULT, as this code renders it,
//     is not the one the model read is REPLAY_STALE, naming the call and both hashes; where its arguments name the run's
//     own directories, the refusal says a size measured of them is the host's; and a call to a tool the step has not
//     minted is keyed as Pi's own answer to it. Each try here is keyed in its test's own sandbox
//     (`fixtureResultSha256`).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import { getExecutionSession } from '../execution/model.js';
import type { ToolInvocationResult } from '../tools/backing-tool.js';
import {
	expandText,
	RECORDING_FORMAT,
	recordingFiles,
	SCRUB_TOKENS,
	scrubPairs,
	scrubText,
	sha256Hex,
	type ExecutorTry,
	type RecordedCommand,
	type RecordedToolCall,
	type Recording
} from './recording.js';
import { createReplayRun, forgetReplayRuns, replayRunFor, type ReplayRun } from './replay-run.js';
import { openReplayExecutionSession } from './replay-executor.js';
import { createReplayedProcessRunner } from './replayed-runner.js';
import {
	FIXTURE_PWA_OBJECTS,
	fixtureExecutorKey,
	fixtureManifest,
	fixtureResultSha256
} from './replay-fixture.testing.js';

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

/** The try's calls before each is keyed by its result: what the model made, and what the host observed. */
const CALLS: readonly Omit<RecordedToolCall, 'resultSha256'>[] = [
	{
		name: 'write_file',
		arguments: {
			path: 'docs/requirements.md',
			contents: '# Requirements\nRun from JPWB_REPLAY_WORKSPACE_POSIX.\n'
		},
		outcome: 'COMPLETED'
	},
	{ name: 'run_command', arguments: { argv: CHECK_ARGV }, outcome: 'COMPLETED' }
];
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
		...fixtureManifest(),
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

/**
 * ⭐ `calls` keyed by what this code renders for each in THIS test's sandbox (`fixtureResultSha256`), as the replay will
 * key them: the write's contents expanded to this test's workspace — a size the tool reports of them is this host's — or,
 * with `workspace`, expanded as if the run's workspace were that path instead.
 */
async function keyed(
	calls: readonly Omit<RecordedToolCall, 'resultSha256'>[],
	workspace: string = workspaceDir
): Promise<RecordedToolCall[]> {
	const pairs = scrubPairs({ WORKSPACE: workspace, PROCESS_OUTPUT: outputDir, HOME: homedir() });
	const o = {
		expand: (text: string) => expandText(text, pairs),
		scrub: (text: string) => scrubText(text, pairs),
		command: CHECK
	};
	return Promise.all(calls.map(async (c) => ({ ...c, resultSha256: await fixtureResultSha256(c, o) })));
}

/** The try, keyed in this test's sandbox (`keyed`) — made fresh for each test, after its folders exist. */
let TRY: ExecutorTry;
beforeEach(async () => {
	root = mkdtempSync(join(tmpdir(), 'jpwb-replay-executor-'));
	workspaceDir = join(root, 'und_replay-0123456789abcdef');
	outputDir = `${workspaceDir}.process-output`;
	mkdirSync(workspaceDir);
	mkdirSync(outputDir);
	TRY = {
		unit: 'requirements',
		turnSha256: sha256Hex(TURN),
		// ⭐ The key as this code gives the executor (finding 1): the contract and the two tools the grant below mints.
		...fixtureExecutorKey(),
		toolCalls: await keyed(CALLS),
		answer: { arrived: true, text: ANSWER },
		producer: PRODUCER
	};
});
afterEach(() => {
	forgetReplayRuns();
	rmSync(root, { recursive: true, force: true });
});

/** ⭐ `run`, its published PWA held to the recording — what the replay's re-creation does before the Undertaking. */
function checked(run: ReplayRun): ReplayRun {
	run.checkPublishedPwa(FIXTURE_PWA_OBJECTS);
	return run;
}

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
		const run = checked(replayRunFor(dir));
		const session = await getExecutionSession({ kind: 'REPLAY', recordingDir: dir })(
			contextOn(run)
		);
		expect(session.retainsHistory).toBe(true);
		const result = (await session.turn(TURN)) as ToolInvocationResult;
		expect(result.answer).toEqual({ arrived: true, text: ANSWER });
		expect(run.consumed()).toEqual({ executor: 1, commands: 1, reviewer: 0 });
	});

	it('a matching turn writes and runs through the real tools, and returns the recorded answer, graded HOST_CONFIGURED', async () => {
		const run = checked(createReplayRun(recordingOf([TRY], [CHECK]), () => root));
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
		const run = checked(createReplayRun(recordingOf([TRY], [CHECK]), () => root));
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
					outcome: 'COMPLETED',
					// ⭑ Never reached: the outcome differs first, and the turn stops there.
					resultSha256: sha256Hex('Wrote 1 UTF-8 bytes to ../outside.md.')
				}
			]
		};
		const run = checked(createReplayRun(recordingOf([escaping], []), () => root));
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

	it('⛔ a recording whose executor INSTRUCTIONS differ is REPLAY_STALE, naming both hashes, and runs no tool', async () => {
		const other: ExecutorTry = {
			...TRY,
			instructionsSha256: sha256Hex('another execution contract')
		};
		const run = checked(createReplayRun(recordingOf([other], [CHECK]), () => root));
		const session = await openReplayExecutionSession(contextOn(run), run);

		await expect(session.turn(TURN)).rejects.toThrow(
			/^REPLAY_STALE: executor try 1 \(unit requirements\): the executor's instructions/
		);
		expect(run.consumed()).toEqual({ executor: 0, commands: 0, reviewer: 0 });
		expect(() => readFileSync(join(workspaceDir, 'docs', 'requirements.md'))).toThrow();
	});

	it('⛔ a recording whose TOOL DEFINITIONS differ is REPLAY_STALE, naming both hashes, and runs no tool', async () => {
		// ⭑ Recorded under a grant of file-system alone: one tool offered, where this step's grant mints two.
		const other: ExecutorTry = {
			...TRY,
			toolsSha256: fixtureExecutorKey(['file-system']).toolsSha256
		};
		const run = checked(createReplayRun(recordingOf([other], [CHECK]), () => root));
		const session = await openReplayExecutionSession(contextOn(run), run);

		await expect(session.turn(TURN)).rejects.toThrow(
			/^REPLAY_STALE: executor try 1 \(unit requirements\): the executor's tool definitions' SHA-256 is [0-9a-f]{64}, and the recording's is [0-9a-f]{64}/
		);
		expect(run.consumed()).toEqual({ executor: 0, commands: 0, reviewer: 0 });
	});

	it('⛔ no try is served before the published PWA was held to the recording (REG-D-112 (c); finding 4)', async () => {
		const run = createReplayRun(recordingOf([TRY], [CHECK]), () => root);
		const session = await openReplayExecutionSession(contextOn(run), run);

		await expect(session.turn(TURN)).rejects.toThrow(
			/^REPLAY_PWA_UNCHECKED: executor try 1 was asked for before the published PWA was held to the recording's digest/
		);
		expect(run.consumed()).toEqual({ executor: 0, commands: 0, reviewer: 0 });
		expect(() => readFileSync(join(workspaceDir, 'docs', 'requirements.md'))).toThrow();
	});

	it('a recorded CALL_FAILED replays with the reporter the recording names — a TOOL is never re-reported as the PROVIDER', async () => {
		const failed: ExecutorTry = {
			...TRY,
			toolCalls: [],
			answer: {
				arrived: false,
				cause: 'CALL_FAILED',
				reportedBy: 'TOOL',
				message: 'the tool exited 1'
			}
		};
		const run = checked(createReplayRun(recordingOf([failed], []), () => root));
		const session = await openReplayExecutionSession(contextOn(run), run);

		const result = (await session.turn(TURN)) as ToolInvocationResult;

		expect(result.answer).toEqual({
			arrived: false,
			cause: 'CALL_FAILED',
			reportedBy: 'TOOL',
			message: 'the tool exited 1'
		});
	});

	it('⛔ after the replay has refused anything, the executor serves no try — not even one whose turn matches', async () => {
		const run = checked(createReplayRun(recordingOf([TRY], [CHECK]), () => root));
		run.stale('a reviewer call went stale first');
		const session = await openReplayExecutionSession(contextOn(run), run);

		await expect(session.turn(TURN)).rejects.toThrow(
			'REPLAY_STALE: executor try 1 was not replayed: the replay already refused (REPLAY_STALE: a reviewer call went stale first)'
		);
		expect(run.consumed()).toEqual({ executor: 0, commands: 0, reviewer: 0 });
		expect(() => readFileSync(join(workspaceDir, 'docs', 'requirements.md'))).toThrow();
	});

	it('⛔ refuses a REAL runner: a replay’s commands go through the REPLAYED runner, never a real one', async () => {
		const run = checked(createReplayRun(recordingOf([TRY], [CHECK]), () => root));
		const context = {
			...contextOn(run),
			runner: {
				kind: 'REAL' as const,
				run: async () => ({ ran: false as const, refusedBecause: 'never' })
			}
		};
		await expect(openReplayExecutionSession(context, run)).rejects.toThrow(/REPLAYED runner/);
	});

	// ── ⭐⭐ WHAT THE MODEL READ OF EACH CALL (the lead's delegated decision of 2026-10-15, to be registered) ─────────────

	it('⛔ a call whose RESULT, as this code renders it, is not the one the model read is REPLAY_STALE — naming the call and both hashes — and no later call runs', async () => {
		// ⭑ As if the recorded run's write_file had reported its write another way: the model read that, not this.
		const read = sha256Hex('Wrote the requirements.');
		const otherwise: ExecutorTry = {
			...TRY,
			toolCalls: [{ ...TRY.toolCalls[0]!, resultSha256: read }, TRY.toolCalls[1]!]
		};
		const run = checked(createReplayRun(recordingOf([otherwise], [CHECK]), () => root));
		const session = await openReplayExecutionSession(contextOn(run), run);

		await expect(session.turn(TURN)).rejects.toThrow(
			new RegExp(
				`^REPLAY_STALE: executor try 1 \\(unit requirements\\), tool call 1 \\(write_file\\): the result's SHA-256 as ` +
					`this code renders it is ${TRY.toolCalls[0]!.resultSha256}, and the recording's is ${read}\\. The model read ` +
					'another result than this code renders'
			)
		);
		expect(run.poisonedBy()?.code).toBe('REPLAY_STALE');
		// ⛔ The command after it never ran.
		expect(run.consumed()).toEqual({ executor: 1, commands: 0, reviewer: 0 });
	});

	it('⚠ a write whose contents name the run’s workspace reports a size this host measures: recorded where the workspace path was another length, it goes REPLAY_STALE, and says why', async () => {
		// ⭑ The recording's stated limit: keyed as if the recorded run's workspace were one character longer than this one.
		const elsewhere: ExecutorTry = {
			...TRY,
			toolCalls: await keyed(CALLS, `${workspaceDir}x`)
		};
		const run = checked(createReplayRun(recordingOf([elsewhere], [CHECK]), () => root));
		const session = await openReplayExecutionSession(contextOn(run), run);

		await expect(session.turn(TURN)).rejects.toThrow(
			"⚠ Its arguments name the run's own directories (a scrub token), so a size the tool reports of them is this host's"
		);
	});

	it('a call to a tool the step has not minted is keyed as Pi’s own answer to it — FAILED, as Pi reports it — and replays', async () => {
		const unminted: ExecutorTry = {
			...TRY,
			toolCalls: await keyed([{ name: 'read_file', arguments: { path: 'docs/requirements.md' }, outcome: 'FAILED' }])
		};
		const run = checked(createReplayRun(recordingOf([unminted], []), () => root));
		const session = await openReplayExecutionSession(contextOn(run), run);

		const result = (await session.turn(TURN)) as ToolInvocationResult;

		expect(result.observedToolCalls).toEqual({
			canObserve: true,
			mintedToolNames: ['write_file', 'run_command'],
			calls: [{ name: 'read_file', outcome: 'FAILED' }]
		});
		expect(run.poisonedBy()).toBeUndefined();
	});
});
