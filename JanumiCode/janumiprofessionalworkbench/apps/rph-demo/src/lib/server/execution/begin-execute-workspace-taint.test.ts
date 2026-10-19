// ⭐ `JAN-MHX` MH-3 (`DESIGN-multi-harness-executor.md` D21a; roadmap MH-3 test 11) — A MODEL STEP IS REFUSED BEFORE
// DISPATCH WHILE ITS UNDERTAKING'S WORKSPACE IS TAINTED.
//
// ⛔ WHAT WAS WRONG. A CLI executor's breach (`CLI_OWN_TOOL_RAN`, `CLI_UNEXPLAINED_CHANGE`) writes a marker beside the
// workspace (`workspace-taint.ts`), and nothing read it: Begin & Execute dispatched the next model step into a workspace
// holding bytes no one recorded, and its review and evidence could rest on them.
//
// ⭑ THE ARRANGEMENT. The marker is written beside the directory `resolveUndertakingSandbox` gives the Undertaking on its
// DURABLE arm — the one a CLI executor's session is opened in — and the host is made to resolve that arm at call time
// (`RPH_DEMO_MODE=server` with `JPWB_DEMO_DB` under a temp folder; `workspace-host.ts` reads both per call). Everything
// else stays test mode: the executor and the reviewer are the declared stand-ins, which `workbench.ts` chose at load.
//
// ⛔ HERMETIC. The stand-ins call no model; agy's exec seam starts nothing; devin's adapter refuses, asserted never
// called; PATH finds no program; every directory is under `os.tmpdir()`.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	return {
		...actual,
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) =>
			actual.getExecutionSession(selection, {
				agyExec: async () => {
					throw new Error('hermetic: no taint test calls agy');
				},
				openPi: async () => {
					throw new Error('hermetic: no route test opens a real Pi session');
				}
			})
		)
	};
});

vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	return {
		...actual,
		devinPrint: vi.fn(async () => {
			throw new Error('hermetic: no route test runs a real devin review');
		})
	};
});

import { getObject, listPwuTypes, SEED_PWA } from '@janumipwb/rph-engine';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { devinPrint } from '../tools/devin-reviewer.js';
import { getEngine, resetEngine } from '../workbench.js';
import {
	beginExecute,
	eventCount,
	lifecycleOf,
	modelWorkUnit,
	proposeWorkUnit
} from './begin-execute.testing.js';
import { getExecutionSession } from './model.js';
import { resolveUndertakingSandbox } from './workspace-host.js';
import { writeWorkspaceTaint } from './workspace-taint.js';

const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_EXECUTOR_EFFORT',
	'JPWB_AGENT',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN',
	'JPWB_CODEX_BIN',
	'JPWB_REPLAY'
] as const;

const BREACH = {
	code: 'CLI_OWN_TOOL_RAN',
	toolId: 'agy',
	turn: 2,
	at: '2026-10-18T10:00:00.000Z'
} as const;

let container = '';

beforeEach(async () => {
	resetEngine('reference');
	vi.mocked(getExecutionSession).mockClear();
	vi.mocked(devinPrint).mockClear();
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	container = await mkdtemp(join(tmpdir(), 'jpwb-taint-route-'));
});
afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(container, { recursive: true, force: true });
});

/** The Undertaking a work unit belongs to. */
const undertakingOf = (pwuId: string): string =>
	String((getObject(getEngine(), pwuId) as Record<string, unknown>).undertakingId);

/**
 * The host made to resolve its DURABLE workspace arm under `container`, from here on — and the directory that arm gives
 * `undertakingId`, which is where a CLI executor's session runs and beside which its breach is marked.
 */
function durableWorkspaceOf(undertakingId: string): string {
	const db = join(container, 'demo.sqlite');
	const directory = resolveUndertakingSandbox(undertakingId, `${db}.workspaces`).workspace
		.directoryPath;
	expect(directory, 'arrangement: the durable arm gives the workspace a directory').toBeDefined();
	vi.stubEnv('RPH_DEMO_MODE', 'server');
	vi.stubEnv('JPWB_DEMO_DB', db);
	return directory!;
}

describe('⭐ D21a — Begin & Execute refuses a model step while its workspace is tainted, before anything is dispatched', () => {
	it('⛔ a marker beside the workspace: WORKSPACE_TAINTED, naming the breach — nothing dispatched, the executor never opened', async () => {
		// ⭑ RED FIRST: nothing read the marker, so the step was dispatched and the stand-in ran.
		const pwuId = await modelWorkUnit();
		writeWorkspaceTaint(durableWorkspaceOf(undertakingOf(pwuId)), BREACH);
		const before = eventCount();

		const result = await beginExecute(pwuId);

		expect(
			result.data?.error ?? '',
			'the step was not refused for its tainted workspace'
		).toContain('WORKSPACE_TAINTED');
		expect(result.data?.error).toContain("CLI_OWN_TOOL_RAN, on turn 2 of the executing tool 'agy'");
		expect(result.status).toBe(400);
		expect(eventCount(), 'a refused step dispatched something').toBe(before);
		expect(
			vi.mocked(getExecutionSession),
			'the executor was opened for a refused step'
		).not.toHaveBeenCalled();
		expect(vi.mocked(devinPrint)).not.toHaveBeenCalled();
		expect(lifecycleOf(pwuId)).toBe('PROPOSED');
	});

	it('⭑ CONTROL — the same host, the same Undertaking, no marker: the step is dispatched and the model runs', async () => {
		const pwuId = await modelWorkUnit();
		durableWorkspaceOf(undertakingOf(pwuId));

		const result = await beginExecute(pwuId);

		expect(result.data?.error ?? 'The model ran', 'the untainted step did not run').toMatch(
			/^The model ran/
		);
		expect(vi.mocked(getExecutionSession)).toHaveBeenCalled();
	});

	it('⭑ a marker beside ANOTHER Undertaking’s workspace refuses nothing here', async () => {
		const pwuId = await modelWorkUnit();
		durableWorkspaceOf(undertakingOf(pwuId));
		writeWorkspaceTaint(
			resolveUndertakingSandbox('und-another', join(container, 'demo.sqlite.workspaces')).workspace
				.directoryPath!,
			BREACH
		);

		const result = await beginExecute(pwuId);

		expect(result.data?.error ?? 'The model ran').toMatch(/^The model ran/);
	});

	it('⚠ a TRANSFORMATION step is not refused: no executor runs in it and no review reads it — the operator completes it', async () => {
		const architecture = listPwuTypes(getEngine(), SEED_PWA).find(
			(t) => t.state.name === 'Architecture Definition'
		);
		expect(architecture, 'arrangement: the seeded TRANSFORMATION type').toBeDefined();
		const pwuId = await proposeWorkUnit(architecture!.id, 'Arch Work');
		writeWorkspaceTaint(durableWorkspaceOf(undertakingOf(pwuId)), BREACH);

		const result = await beginExecute(pwuId);

		expect(result.data?.error, 'a TRANSFORMATION step was refused').toBeUndefined();
		expect(getObject(getEngine(), pwuId)?.executionState).toBe('SUCCEEDED');
	});
});
