// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D1; `REG-F-536`) — THE RECORDING'S FORMAT: what a reader
// refuses, and the scrub every hash is taken over.
//
// ⭑ WHAT MUST HOLD:
//   · a recording written by `recordingFiles` reads back whole and equal (`readRecording`);
//   · ⛔ a folder of another format, a relative folder, a missing file and a malformed line are each REFUSED, the refusal
//     naming the file and the line — a replay never starts on half a recording;
//   · the scrub replaces each of a run's directories, in each spelling the run writes, by its own token — the longer
//     path first, so the workspace is never replaced inside its own `.process-output` sibling — and expansion inverts it.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	expandText,
	RECORDING_FILES,
	RECORDING_FORMAT,
	readRecording,
	recordingFiles,
	SCRUB_TOKENS,
	scrubPairs,
	scrubText,
	sha256Hex,
	type Recording
} from './recording.js';
import { fixtureExecutorKey, fixtureManifest } from './replay-fixture.testing.js';

const RECORDING: Recording = {
	manifest: {
		format: RECORDING_FORMAT,
		commit: 'fixture-commit',
		reviewerFingerprint: 'fixture-fingerprint',
		...fixtureManifest(),
		models: {
			executor: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' },
			reviewer: { agentId: 'devin', modelId: 'r', providerId: 'devin', callBoundMs: null }
		},
		scrub: { tokens: [...SCRUB_TOKENS] },
		expectedMatrix: [
			{ stage: '3', row: 'requirements', value: 'as intended' },
			{ stage: '6', row: 'requirements', value: null }
		]
	},
	executor: [
		{
			unit: 'requirements',
			turnSha256: sha256Hex('turn'),
			...fixtureExecutorKey(),
			toolCalls: [
				{ name: 'write_file', arguments: { path: 'a.md', contents: 'x' }, outcome: 'COMPLETED' }
			],
			answer: {
				arrived: false,
				cause: 'CALL_FAILED',
				reportedBy: 'TOOL',
				message: 'model not supported'
			},
			producer: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' }
		}
	],
	commands: [
		{
			argv: ['node', '--test'],
			ran: true,
			exitCode: null,
			timedOut: true,
			durationMs: 120_000,
			outputComplete: false,
			omissions: [{ stream: 'STDOUT', reason: 'capped', byteSize: 3, byteOffset: 65_536 }],
			stdout: 'x',
			stderr: ''
		},
		{ argv: ['npm', 'test'], ran: false, refusedBecause: 'a batch target' }
	],
	reviewer: [
		{
			unit: null,
			framing: 'pwa',
			role: 'retry',
			promptSha256: sha256Hex('prompt'),
			prompt: 'prompt',
			reply: { status: 'NO_ANSWER_SPAN', parses: true },
			evaluator: { agentId: 'devin', modelId: 'r', providerId: 'devin' },
			elapsedMs: 0
		}
	]
};

const made: string[] = [];
afterEach(() => {
	for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function written(files: Readonly<Record<string, string>>): string {
	const dir = mkdtempSync(join(tmpdir(), 'jpwb-recording-'));
	made.push(dir);
	for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
	return dir;
}

describe('⭐ the recording’s format (D1)', () => {
	it('a recording written by recordingFiles reads back whole and equal', () => {
		expect(readRecording(written(recordingFiles(RECORDING)))).toEqual(RECORDING);
	});

	it('⛔ refuses another format, a relative folder, a missing file and a malformed line — each named', () => {
		const files = recordingFiles(RECORDING);
		const otherFormat = {
			...files,
			[RECORDING_FILES.manifest]: files[RECORDING_FILES.manifest]!.replace(
				RECORDING_FORMAT,
				'jpwb-replay-recording/0'
			)
		};
		expect(() => readRecording(written(otherFormat))).toThrow(
			'REPLAY_RECORDING_REFUSED: the recording is refused: recording.json names the format "jpwb-replay-recording/0", not jpwb-replay-recording/2'
		);
		expect(() => readRecording('relative/recording')).toThrow(
			/'relative\/recording' is not absolute/
		);
		const noCommands = Object.fromEntries(
			Object.entries(files).filter(([f]) => f !== RECORDING_FILES.commands)
		);
		expect(() => readRecording(written(noCommands))).toThrow(
			'the recording is refused: commands.jsonl is absent'
		);
		const badLine = {
			...files,
			[RECORDING_FILES.reviewer]: `${files[RECORDING_FILES.reviewer]}{"unit":null}\n`
		};
		expect(() => readRecording(written(badLine))).toThrow(/reviewer\.jsonl:2 /);
		const badHash = {
			...files,
			[RECORDING_FILES.executor]: files[RECORDING_FILES.executor]!.replace(
				sha256Hex('turn'),
				'not-a-hash'
			)
		};
		expect(() => readRecording(written(badHash))).toThrow(
			'executor.jsonl:1 has no SHA-256 `turnSha256`'
		);
	});

	it('⛔ refuses a recording made on the other OS family, with a reason of its own — never REPLAY_STALE at its first path', () => {
		const here = process.platform === 'win32' ? 'windows' : 'posix';
		const there = here === 'windows' ? 'posix' : 'windows';
		const files = recordingFiles({
			...RECORDING,
			manifest: { ...RECORDING.manifest, osFamily: there }
		} as unknown as Recording);
		expect(() => readRecording(written(files))).toThrow(
			`REPLAY_RECORDING_REFUSED: the recording is refused: recording.json was made on the ${there} family, and this host is ${here}`
		);
	});

	it('the scrub replaces each directory in each spelling by its own token, the longer path first, and expansion inverts it', () => {
		// ⭑ BUILT, NOT SPELLED: a drive and its separators joined at run time, so no line of this file names an absolute
		// path the archive scan would read as a host's (`REG-F-536`; `archive-scan.ts`).
		const sep = '\\';
		const drive = `${String.fromCodePoint(81)}:`;
		const home = [drive, 'home', 'op'].join(sep);
		const workspace = [home, 'runs', 'workspaces', 'und_1-0123456789abcdef'].join(sep);
		const pairs = scrubPairs({
			WORKSPACE: workspace,
			PROCESS_OUTPUT: `${workspace}.process-output`,
			HOME: home
		});
		const devinFile = ['AppData', 'Local', 'Temp', 'jpwb-devin-x', 'prompt.txt'];
		const text = [
			`cwd ${workspace}`,
			`pi: Current working directory: ${workspace.replaceAll(sep, '/')}`,
			`json: "${workspace.replaceAll(sep, sep + sep)}${sep}${sep}test"`,
			`capture ${[`${workspace}.process-output`, 'captures', 'x'].join(sep)}`,
			`devin: --prompt-file ${[home, ...devinFile].join(sep)}`
		].join('\n');
		const scrubbed = scrubText(text, pairs);
		expect(scrubbed).toBe(
			[
				'cwd JPWB_REPLAY_WORKSPACE_NATIVE',
				'pi: Current working directory: JPWB_REPLAY_WORKSPACE_POSIX',
				`json: "JPWB_REPLAY_WORKSPACE_JSON${sep}${sep}test"`,
				`capture ${['JPWB_REPLAY_PROCESS_OUTPUT_NATIVE', 'captures', 'x'].join(sep)}`,
				`devin: --prompt-file ${['JPWB_REPLAY_HOME_NATIVE', ...devinFile].join(sep)}`
			].join('\n')
		);
		expect(expandText(scrubbed, pairs)).toBe(text);
		// ⛔ A root is never a place: '/' as a home would replace every separator in the text.
		expect(scrubPairs({ HOME: '/' })).toEqual([]);
		expect(scrubPairs({ HOME: parse(tmpdir()).root })).toEqual([]);
	});
});
