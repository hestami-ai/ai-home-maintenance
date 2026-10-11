// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D3; `REG-F-530`) — THE REPLAY'S SANDBOX: in test mode with
// `JPWB_REPLAY` set, an Undertaking gets a FILESYSTEM workspace under a DISPOSABLE root, paired with the REPLAYED runner —
// never the REAL one — and the stores stay in memory.
//
// ⭑ PREDICTED RED, WRITTEN FIRST: test mode gives every Undertaking an IN_MEMORY workspace and the refusing runner
// (`workspace-host.ts:195-206` at `03b3bf03`), so a replayed `write_file` has nowhere to land and a replayed command is refused —
// `REG-F-530`'s *"the test-mode rule it adopts gives a replay no filesystem workspace"*.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveUndertakingSandbox } from '../execution/workspace-host.js';
import { getArtifactStore } from '../workbench.js';
import { RECORDING_FORMAT, recordingFiles, SCRUB_TOKENS, type Recording } from './recording.js';
import { forgetReplayRuns, replayRunFor } from './replay-run.js';

const EMPTY: Recording = {
	manifest: {
		format: RECORDING_FORMAT,
		commit: 'fixture-commit',
		reviewerFingerprint: 'fixture-fingerprint',
		pwaContentDigest: 'fixture-digest',
		models: {
			executor: { agentId: 'execution.model-invocation', modelId: 'm', providerId: 'p' },
			reviewer: { agentId: 'devin', modelId: 'r', providerId: 'devin', callBoundMs: 240_000 }
		},
		scrub: { tokens: [...SCRUB_TOKENS] },
		expectedMatrix: []
	},
	executor: [],
	commands: [],
	reviewer: []
};

const saved = {
	mode: process.env.RPH_DEMO_MODE,
	replay: process.env.JPWB_REPLAY,
	db: process.env.JPWB_DEMO_DB
};
const made: string[] = [];
afterEach(() => {
	forgetReplayRuns();
	for (const [k, v] of [
		['RPH_DEMO_MODE', saved.mode],
		['JPWB_REPLAY', saved.replay],
		['JPWB_DEMO_DB', saved.db]
	] as const)
		if (v === undefined) delete process.env[k];
		else process.env[k] = v;
	for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function recordingDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'jpwb-replay-sandbox-'));
	made.push(dir);
	for (const [file, text] of Object.entries(recordingFiles(EMPTY)))
		writeFileSync(join(dir, file), text);
	return dir;
}

describe('⭐ the replay’s sandbox (D3)', () => {
	it('test mode with the switch gives a FILESYSTEM workspace under the replay’s disposable root, and the REPLAYED runner', () => {
		const dir = recordingDir();
		process.env.RPH_DEMO_MODE = 'test';
		process.env.JPWB_REPLAY = dir;
		delete process.env.JPWB_DEMO_DB;

		const sandbox = resolveUndertakingSandbox('und_replayed');

		expect(sandbox.workspace.materialization).toBe('FILESYSTEM');
		expect(sandbox.outputWorkspace.materialization).toBe('FILESYSTEM');
		// ⛔ REPLAYED, never REAL: the replay starts no process.
		expect(sandbox.runner.kind).toBe('REPLAYED');
		const root = replayRunFor(dir).root();
		made.push(root);
		expect(sandbox.workspace.directoryPath?.startsWith(root)).toBe(true);
		expect(sandbox.outputWorkspace.directoryPath).toBe(
			`${sandbox.workspace.directoryPath}.process-output`
		);
		expect(sandbox.workspace.purgeability).toBe('RETAINED_BY_PARTICIPATION');
		expect(sandbox.outputWorkspace.purgeability).toBe('PURGEABLE_AT_EXPIRY');
		// ⭑ The stores stay in memory: the switch buys a directory for the workspaces, never a durable store.
		expect(getArtifactStore().durability).toBe('PROCESS_LOCAL');
	});

	it('outside test mode the switch buys nothing here — the selectors refuse it before anything is dispatched', () => {
		const dir = recordingDir();
		process.env.RPH_DEMO_MODE = 'server';
		process.env.JPWB_REPLAY = dir;
		delete process.env.JPWB_DEMO_DB;
		const sandbox = resolveUndertakingSandbox('und_replayed');
		expect(sandbox.workspace.materialization).toBe('IN_MEMORY');
		expect(sandbox.runner.kind).toBe('REFUSING');
	});

	it('a recording that cannot be read refuses the sandbox, rather than falling back to the in-memory one', () => {
		process.env.RPH_DEMO_MODE = 'test';
		process.env.JPWB_REPLAY = join(recordingDir(), 'absent');
		expect(() => resolveUndertakingSandbox('und_replayed')).toThrow(/REPLAY_RECORDING_REFUSED/);
	});
});
