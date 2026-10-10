// ⭐ `JAN-EXEC` Phase 7, P7-4b and P7-4c — THE ENTRY THE BRIEF NAMES, AND THE STUB PUT IN ITS PLACE.
//
// The brief fixes the entry: `node bin/wordfreq.js [options] [file]` (`product-brief.md`). Two tools write over it on a
// copy — the seeded-faults tool a variant of the CLI, the spawn check a stub that exits 99 — and both are only as good as
// the assumption that the workspace's tests RUN that file.
//
// ⛔ SO NEITHER WRITES WHERE NOTHING WAS. A workspace with no `bin/wordfreq.js` is refused (NO_ENTRY), never given one: a
// variant or a stub written into a new file is run by no test, and every variant would read MISSED and every test
// DOES_NOT_SPAWN — a verdict about a file the product never had. And the seeded-faults tool runs the stub first: if the
// suite never starts the entry, no variant written there can be caught, and it says ENTRY_NOT_RUN rather than seven MISSED.
//
// ⛔ THE STUB RECORDS EACH START, BECAUSE "PASSED AGAINST THE STUB" IS NOT "NEVER RAN IT". A test that starts the entry and
// asserts only what a program that does nothing also satisfies — a non-zero exit, which the stub's 99 is — passes against
// the stub having run it. The first version of these tools read every such pass as a test that never ran the entry: the
// spawn check named the weak-e2e overlay's two spawning tests non-spawning, and the seeded-faults tool would have refused
// a suite of such tests as ENTRY_NOT_RUN (the verifier's finding). So the stub appends one byte to a trace file OUTSIDE
// the workspace each time it starts, and the tools read the count: a start recorded is a run of the entry; none is none.
// ⛔ AND IT PROVES ITSELF WHEN INSTALLED (`installStub`). A stub that cannot record its start — a Node without
// `process.getBuiltinModule` (it arrived in 20.16 and 22.3), a package scope that cannot load it — would read every start
// as none, the same false inference in another form. So it is run once, as the tests would run it, and must exit 99
// having recorded exactly one start; anything else throws, and nothing is judged.
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeExecutable, runProcess } from './node-tests.js';

/** The entry, relative to the workspace. */
export const ENTRY = 'bin/wordfreq.js';

export const STUB_EXIT_CODE = 99;

/**
 * The stub put in place of the entry: valid as an ES module and as CommonJS, printing nothing. It appends one byte to
 * `trace` — an absolute path, written in as a string literal — and exits 99; a trace it cannot write is skipped, never
 * allowed to change the exit (the install's own run is what catches that).
 */
export function stubEntry(trace: string): string {
	return [
		`// P7-4 stub entry: it records that it was started, and exits ${STUB_EXIT_CODE}. It does nothing else.`,
		`try { process.getBuiltinModule('node:fs').appendFileSync(${JSON.stringify(trace)}, 'x'); } catch {}`,
		`process.exit(${STUB_EXIT_CODE});`,
		''
	].join('\n');
}

/** Whether `workspace` holds the entry, as a file. */
export function hasEntry(workspace: string): boolean {
	const path = join(workspace, ENTRY);
	return existsSync(path) && statSync(path).isFile();
}

/** Write `text` over the entry of `copy` — a private copy, never the workspace itself. */
export function writeEntry(copy: string, text: string): void {
	mkdirSync(join(copy, 'bin'), { recursive: true });
	writeFileSync(join(copy, ENTRY), text);
}

/** A stub in place: how many times it has started since installed or reset, and its trace's removal. */
export interface InstalledStub {
	readonly starts: () => number;
	readonly reset: () => void;
	/** Remove the trace's folder. The copy, and the stub in it, are the caller's. */
	readonly remove: () => void;
}

/**
 * ⭐ Write the stub over the entry of `copy`, run it once there — `node bin/wordfreq.js` in `env`, as a test would — and
 * return it counting from zero. ⛔ Throws, leaving no trace folder behind, unless that run exited 99 and recorded exactly
 * one start.
 */
export async function installStub(copy: string, env: Readonly<Record<string, string>>): Promise<InstalledStub> {
	const folder = mkdtempSync(join(tmpdir(), 'jpwb-p7-stub-trace-'));
	const trace = join(folder, 'starts');
	const stub: InstalledStub = {
		starts: () => (existsSync(trace) ? statSync(trace).size : 0),
		reset: () => rmSync(trace, { force: true }),
		remove: () => rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
	};
	try {
		writeEntry(copy, stubEntry(trace));
		const proof = await runProcess(nodeExecutable(), [ENTRY], { cwd: copy, env, timeoutMs: 30_000 });
		if (proof.exitCode !== STUB_EXIT_CODE || stub.starts() !== 1)
			throw new Error(
				`the stub entry did not run as written: it exited ${String(proof.exitCode)} and recorded ${stub.starts()} ` +
					`start(s), not exit ${STUB_EXIT_CODE} and one, so no start of it during a test could be counted` +
					(proof.stderr.trim() === '' ? '' : ` (it printed: ${proof.stderr.trim().split(/\r?\n/)[0]})`)
			);
		stub.reset();
		return stub;
	} catch (error) {
		stub.remove();
		throw error;
	}
}
