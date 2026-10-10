// ⭐ `JAN-EXEC` Phase 7, P7-4 (DESIGN-the-live-end-to-end-run.md §6, P7-4d) — WHAT A COMMAND RAN WITH, MIRRORED FROM THE
// PRODUCT SO OUR RE-RUNS RUN WITH THE SAME.
//
// A model-run command reached the child-process runner, which gave it an ALLOWLISTED environment and a host deadline. A
// re-run that inherited this shell's whole environment, or waited forever, would be a different experiment: a test that
// reads a variable outside the list passes for us and failed for the model, and the disagreement would be ours.
//
// ⚠ MIRRORED, NOT IMPORTED, BECAUSE NEITHER IS EXPORTED. The task's rule: import `INHERITED_ENVIRONMENT_NAMES` if it is
// exported, otherwise mirror it, citing the line. At `60f81a20` both are module-private `const`s:
//   · `INHERITED_ENVIRONMENT_NAMES` — `apps/rph-demo/src/lib/server/execution/child-process-runner.ts:327-352`, applied
//     by `childEnvironment` (`:441-447`): a name is kept when it matches the list CASE-INSENSITIVELY (Windows's names are
//     case-insensitive: `Path` is `PATH`).
//   · `EXECUTION_COMMAND_TIMEOUT_MS` — `apps/rph-demo/src/lib/server/tools/execution-tool-surface.ts:127`, the deadline
//     `run_command` hands the runner for every model-chosen command.
// ⛔ A MIRROR ROTS SILENTLY, so it is held: `verif/phase7-rerun-commands.test.ts` reads both declarations back out of the
// product's source at the lines `MIRRORED_FROM` cites and requires them equal to these. An edit to either list, or a move
// of either line, reddens there — and if either is ever exported, the same test says so, and the mirror should become an
// import.
//
// ⚠ AND THE MIRROR IS OF THE LIST, NOT OF EVERYTHING THE RUNNER DOES. Its other refusals — a batch target (`B1`), a cwd
// outside the workspace (`B8`, `B11`) — are not reproduced: the re-runner re-runs only `node --test` commands, inside its
// own copy, and `node` is not a batch target on this host.

/** Where each mirrored value is declared in the product, by the line its declaration starts on. */
export const MIRRORED_FROM = {
	environment: { file: 'apps/rph-demo/src/lib/server/execution/child-process-runner.ts', line: 327 },
	timeout: { file: 'apps/rph-demo/src/lib/server/tools/execution-tool-surface.ts', line: 127 }
} as const;

/** The variable names a model-run command's child may see — `child-process-runner.ts:327-352`, exactly. */
export const INHERITED_ENVIRONMENT_NAMES: readonly string[] = [
	'PATH',
	'PATHEXT',
	'SYSTEMROOT',
	'SYSTEMDRIVE',
	'WINDIR',
	'COMSPEC',
	'TEMP',
	'TMP',
	'TMPDIR',
	'HOME',
	'HOMEDRIVE',
	'HOMEPATH',
	'USERPROFILE',
	'APPDATA',
	'LOCALAPPDATA',
	'PROGRAMDATA',
	'PROGRAMFILES',
	'PROGRAMFILES(X86)',
	'NUMBER_OF_PROCESSORS',
	'PROCESSOR_ARCHITECTURE',
	'OS',
	'LANG',
	'LC_ALL',
	'TZ'
];

/** How long a model-chosen command may run before the runner kills it — `execution-tool-surface.ts:127`. */
export const EXECUTION_COMMAND_TIMEOUT_MS = 120_000;

/** `parent`, cut to the allowlist as `childEnvironment` cuts it: by name, case-insensitively, defined values only. */
export function runnerEnvironment(parent: Readonly<Record<string, string | undefined>>): Record<string, string> {
	const permitted = new Set(INHERITED_ENVIRONMENT_NAMES.map((name) => name.toUpperCase()));
	const out: Record<string, string> = {};
	for (const [name, value] of Object.entries(parent))
		if (value !== undefined && permitted.has(name.toUpperCase())) out[name] = value;
	return out;
}
