// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D2; `REG-F-530`) — THE REPLAYED RUNNER: commands are REPLAYED,
// never re-run (a command review's prompt carries the run's duration, and a re-run's would differ).
//
// ⭑ WHAT MUST HOLD:
//   · it declares itself REPLAYED, and starts nothing — `spawn` is never called;
//   · a request whose argv is the recorded one gets the recorded outcome, and the recorded capture bytes are written into
//     the output workspace exactly as the real runner lays them out (`captures/<id>/stdout.txt`, `stderr.txt`,
//     `omissions.json`), the scrub's tokens expanded to this host's directories;
//   · ⛔ a request whose argv is not the recorded one runs nothing, writes nothing, and is refused REPLAY_STALE — and the
//     replay is poisoned, so the next request is refused too;
//   · a recorded refusal is returned as recorded; a cwd that is not the deliverable workspace is refused;
//   · it refuses construction against a workspace with no directory, as the real runner does.
// ⭑ PREDICTED RED, WRITTEN FIRST: the module did not exist, and the port had no REPLAYED kind (`process-runner.ts`).
import { vi } from 'vitest';

/** Every start of a program anything in this file asked for. Hoisted: the mock factory runs before this file's body. */
const spawned = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('node:child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:child_process')>();
	return {
		...actual,
		spawn: (...args: Parameters<typeof actual.spawn>) => {
			spawned.calls.push(String(args[0]));
			throw new Error('hermetic: a replay may not start a program');
		}
	};
});

import { createInMemoryWorkspace } from '@janumipwb/rph-ports';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import {
	RECORDING_FORMAT,
	SCRUB_TOKENS,
	scrubPairs,
	scrubText,
	type RecordedCommand,
	type Recording
} from './recording.js';
import { createReplayRun } from './replay-run.js';
import { createReplayedProcessRunner } from './replayed-runner.js';
import { fixtureManifest } from './replay-fixture.testing.js';

const recordingOf = (commands: readonly RecordedCommand[]): Recording => ({
	manifest: {
		format: RECORDING_FORMAT,
		commit: 'fixture-commit',
		reviewerFingerprint: 'fixture-fingerprint',
		...fixtureManifest(),
		models: {
			executor: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' },
			reviewer: { agentId: 'devin', modelId: 'r', providerId: 'devin', callBoundMs: 240_000 }
		},
		scrub: { tokens: [...SCRUB_TOKENS] },
		expectedMatrix: []
	},
	executor: [],
	commands,
	reviewer: []
});

/**
 * The recorded command, its workspace spelled by THIS host's scrub, as a recording made here spells it. ⭐ The review of
 * E4, finding 6: a recording replays on the OS family it was made on, and this one is made on the host that runs the
 * test — on POSIX, where a path's spellings coincide, the scrub names another token than Windows does, and a token
 * spelled out here for one family made this test go REPLAY_STALE on the other.
 */
const testRun = (): RecordedCommand => {
	const workspace = scrubText(
		workspaceDir,
		scrubPairs({ WORKSPACE: workspaceDir, PROCESS_OUTPUT: outputDir, HOME: homedir() })
	);
	return {
		argv: ['node', '--test', `${workspace}/test`],
		ran: true,
		exitCode: 0,
		timedOut: false,
		durationMs: 160,
		outputComplete: true,
		omissions: [],
		stdout: `# pass 3\nok ${workspace}/test/count.test.js\n`,
		stderr: ''
	};
};

let root = '';
let workspaceDir = '';
let outputDir = '';
const sandbox = () => {
	const deliverable = createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_replay',
		purgeability: 'RETAINED_BY_PARTICIPATION',
		directoryPath: workspaceDir
	});
	const output = createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_replay',
		purgeability: 'PURGEABLE_AT_EXPIRY',
		directoryPath: outputDir
	});
	return { deliverable, output };
};

beforeEach(() => {
	spawned.calls.length = 0;
	root = mkdtempSync(join(tmpdir(), 'jpwb-replayed-runner-'));
	workspaceDir = join(root, 'und_replay-0123456789abcdef');
	outputDir = `${workspaceDir}.process-output`;
	mkdirSync(workspaceDir);
	mkdirSync(outputDir);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('⭐ the REPLAYED runner (D2) — commands replayed, never re-run', () => {
	it('declares REPLAYED, returns the recorded outcome, and lays the recorded capture out as the real runner does', async () => {
		const run = createReplayRun(recordingOf([testRun()]), () => root);
		run.useSandbox({ workspace: workspaceDir, processOutput: outputDir });
		const { deliverable, output } = sandbox();
		const runner = createReplayedProcessRunner({
			deliverableWorkspace: deliverable,
			outputWorkspace: output,
			commands: run
		});
		expect(runner.kind).toBe('REPLAYED');

		const outcome = await runner.run({
			argv: ['node', '--test', `${workspaceDir}/test`],
			cwd: workspaceDir,
			timeoutMs: 120_000
		});

		expect(outcome).toMatchObject({
			ran: true,
			exitCode: 0,
			timedOut: false,
			durationMs: 160,
			outputComplete: true,
			omittedRegions: [],
			stdout: `# pass 3\nok ${workspaceDir}/test/count.test.js\n`,
			stderr: ''
		});
		if (!outcome.ran || !outcome.retention.retained)
			throw new Error('the replayed capture was not retained');
		expect(outcome.retention).toMatchObject({
			workspaceOwnerId: 'und_replay',
			purgeability: 'PURGEABLE_AT_EXPIRY'
		});
		expect(outcome.retention.stdoutPath).toMatch(/^captures\/[^/]+\/stdout\.txt$/);
		expect(readFileSync(join(outputDir, outcome.retention.stdoutPath), 'utf8')).toBe(
			outcome.stdout
		);
		expect(readFileSync(join(outputDir, outcome.retention.stderrPath), 'utf8')).toBe('');
		expect(
			JSON.parse(readFileSync(join(outputDir, outcome.retention.omissionsPath), 'utf8'))
		).toMatchObject({
			note: expect.stringMatching(/^COMPLETE\./),
			omittedRegions: []
		});
		expect(spawned.calls, 'a replay started a program').toEqual([]);
		expect(run.consumed().commands).toBe(1);
	});

	it('⛔ an argv that is not the recorded one runs nothing, writes nothing, is REPLAY_STALE — and poisons the replay', async () => {
		const run = createReplayRun(recordingOf([testRun(), testRun()]), () => root);
		run.useSandbox({ workspace: workspaceDir, processOutput: outputDir });
		const { deliverable, output } = sandbox();
		const runner = createReplayedProcessRunner({
			deliverableWorkspace: deliverable,
			outputWorkspace: output,
			commands: run
		});

		const stale = await runner.run({
			argv: ['node', '--test', 'other'],
			cwd: workspaceDir,
			timeoutMs: 120_000
		});
		expect(stale.ran).toBe(false);
		expect(!stale.ran && stale.refusedBecause).toMatch(
			/^REPLAY_STALE: command 1: this run asked to run \["node","--test","other"\]/
		);
		expect((await output.list()).length, 'a stale request wrote a capture').toBe(0);

		// ⛔ And the recorded argv, asked next, is refused too: a replay that has diverged once replays nothing after it.
		const after = await runner.run({
			argv: ['node', '--test', `${workspaceDir}/test`],
			cwd: workspaceDir,
			timeoutMs: 120_000
		});
		expect(!after.ran && after.refusedBecause).toMatch(/^REPLAY_STALE: command 1 was not replayed/);
		expect(spawned.calls).toEqual([]);
	});

	it('a recorded refusal is returned as recorded, and a cwd that is not the workspace is refused before the recording is read', async () => {
		const refusedRun: RecordedCommand = {
			argv: ['npm', 'test'],
			ran: false,
			refusedBecause: "'npm' cannot be run: it reaches 'npm.cmd'"
		};
		const run = createReplayRun(recordingOf([refusedRun]), () => root);
		run.useSandbox({ workspace: workspaceDir, processOutput: outputDir });
		const { deliverable, output } = sandbox();
		const runner = createReplayedProcessRunner({
			deliverableWorkspace: deliverable,
			outputWorkspace: output,
			commands: run
		});

		const elsewhere = await runner.run({ argv: ['npm', 'test'], cwd: root, timeoutMs: 120_000 });
		expect(!elsewhere.ran && elsewhere.refusedBecause).toMatch(
			/may only be replayed in the workspace/
		);
		expect(run.consumed().commands, 'a refused cwd took a recorded command').toBe(0);

		const asRecorded = await runner.run({
			argv: ['npm', 'test'],
			cwd: workspaceDir,
			timeoutMs: 120_000
		});
		expect(asRecorded).toEqual({
			ran: false,
			refusedBecause: "'npm' cannot be run: it reaches 'npm.cmd'"
		});
	});

	it('refuses to be constructed against a workspace with no directory, as the real runner does', () => {
		const run = createReplayRun(recordingOf([]), () => root);
		const memory = createInMemoryWorkspace({
			ownerKind: 'UNDERTAKING',
			ownerId: 'und_replay',
			purgeability: 'PURGEABLE_AT_EXPIRY'
		});
		const { deliverable } = sandbox();
		expect(() =>
			createReplayedProcessRunner({
				deliverableWorkspace: deliverable,
				outputWorkspace: memory,
				commands: run
			})
		).toThrow(/FILESYSTEM/);
		expect(() =>
			createReplayedProcessRunner({
				deliverableWorkspace: memory,
				outputWorkspace: sandbox().output,
				commands: run
			})
		).toThrow(/FILESYSTEM/);
	});
});
