// ⭐ `JAN-MHX` MH-1 — the victim for THE TAINT MARKER (`DESIGN-multi-harness-executor.md` D21a). Its writer is the CLI
// executor session's (`tools/cli-executor-session.ts`, C12 and C17 there); its reader is ~~to be~~ ⭐ Begin & Execute's and
// re-run's (MH-3: `workspaceTaintRefusal`, below). ⚠ Every directory is under `os.tmpdir()`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readdirSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
	readWorkspaceTaint,
	workspaceTaintPath,
	workspaceTaintRefusal,
	writeWorkspaceTaint
} from './workspace-taint.js';

let container = '';
let workspace = '';

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-taint-'));
	workspace = join(container, 'und-1-abc');
	await mkdir(workspace);
});
afterEach(async () => {
	await rm(container, { recursive: true, force: true });
});

const BREACH = { code: 'CLI_OWN_TOOL_RAN', toolId: 'fake', turn: 2, at: '2026-10-18T10:00:00Z' } as const;

describe('⭐ D21a — a breach marks the workspace, BESIDE it', () => {
	it('the marker is written beside the workspace, never inside it, and read back as a taint naming the try and the code', () => {
		// ⛔ THE MUTANT: write the marker inside the workspace, where the executor could delete it.
		expect(readWorkspaceTaint(workspace)).toEqual({ tainted: false });
		writeWorkspaceTaint(workspace, BREACH);
		expect(readdirSync(workspace), 'the marker landed inside the workspace').toEqual([]);
		expect(dirname(workspaceTaintPath(workspace))).toBe(container);
		expect(readWorkspaceTaint(workspace)).toEqual({ tainted: true, entries: [BREACH] });
	});

	it('a second breach is added to the first, not written over it', () => {
		// ⛔ THE MUTANT: overwrite the marker. The first breach's try would vanish from it.
		const second = { ...BREACH, code: 'CLI_UNEXPLAINED_CHANGE', turn: 3 } as const;
		writeWorkspaceTaint(workspace, BREACH);
		writeWorkspaceTaint(workspace, second);
		expect(readWorkspaceTaint(workspace)).toEqual({ tainted: true, entries: [BREACH, second] });
	});

	it('⛔ a marker that cannot be read still taints — the reader fails closed', () => {
		// ⛔ THE MUTANT: read an unreadable marker as no taint, which a person's half-finished clearing would produce.
		writeFileSync(workspaceTaintPath(workspace), 'not json', 'utf8');
		expect(readWorkspaceTaint(workspace)).toEqual({ tainted: true, entries: [] });
	});
});

// ⭐ `JAN-MHX` MH-3 (D21a) — THE REFUSAL Begin & Execute and a re-run of the work return while a mark stands.
describe('⭐ `JAN-MHX` MH-3 — what a tainted workspace refuses with (WORKSPACE_TAINTED)', () => {
	it('⛔ it names the code and every breach the marker holds, in order', () => {
		const second = { ...BREACH, code: 'CLI_UNEXPLAINED_CHANGE', turn: 3 } as const;
		writeWorkspaceTaint(workspace, BREACH);
		writeWorkspaceTaint(workspace, second);
		const refusal = workspaceTaintRefusal(workspace) ?? '';
		expect(refusal.startsWith('WORKSPACE_TAINTED: ')).toBe(true);
		expect(refusal).toContain(
			"CLI_OWN_TOOL_RAN, on turn 2 of the executing tool 'fake' (2026-10-18T10:00:00Z); " +
				"CLI_UNEXPLAINED_CHANGE, on turn 3 of the executing tool 'fake' (2026-10-18T10:00:00Z)."
		);
		// ⭑ AND IT SAYS THE TRUTH ABOUT CLEARING: no act in this host clears a mark yet (L7 is open).
		expect(refusal).toContain('no act in this host clears it yet');
	});

	it('⛔ it names the marker’s FILE, never its path: a host path reaches no message', () => {
		writeWorkspaceTaint(workspace, BREACH);
		const refusal = workspaceTaintRefusal(workspace) ?? '';
		expect(refusal).toContain('The mark is und-1-abc.jpwb-taint.json, beside the workspace');
		expect(refusal).not.toContain(container);
	});

	it('⛔ an unreadable marker still refuses, saying which breach made it is unknown — and an entry that is no breach is named so', () => {
		writeFileSync(workspaceTaintPath(workspace), 'not json', 'utf8');
		expect(workspaceTaintRefusal(workspace)).toContain(
			'its marker cannot be read, so which breach made it is unknown'
		);
		writeFileSync(workspaceTaintPath(workspace), JSON.stringify({ taints: [null] }), 'utf8');
		expect(workspaceTaintRefusal(workspace)).toContain('an entry that cannot be read');
	});

	it('⭑ CONTROL — no marker, or no directory to be beside, refuses nothing', () => {
		expect(workspaceTaintRefusal(workspace)).toBeUndefined();
		expect(workspaceTaintRefusal(undefined)).toBeUndefined();
	});
});
