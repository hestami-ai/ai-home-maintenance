/**
 * Workspace layout — the control-plane / project-root split.
 *
 * A thin-slice (or any) workspace has two distinct roots that used to be one:
 *
 *   <workspacePath>/                ← CONTROL PLANE (harness-owned)
 *   ├── .janumicode/                ← runs, DB, context detail files, config
 *   └── <PROJECT_CODE_DIR>/         ← PROJECT ROOT (agent-owned generated code)
 *       ├── package.json, src/, node_modules/, …
 *       └── .gooseignore
 *
 * Before this split the generated codebase was written DIRECTLY into
 * `workspacePath`, making `.janumicode` a visible sibling of the agent's
 * working tree. Weak interactive executors (slice-148: gemma4:26b) saw the
 * control directory in a plain `ls` of their cwd, fixated on it, and corrupted
 * the workspace with garbled `.janumcode`/`.janiumicode` variants. Running the
 * coding agent's PTY with `cwd = projectRoot` removes `.janumicode` from the
 * agent's cwd subtree entirely — a model-agnostic sandbox.
 *
 * `projectRoot` is therefore the canonical root for everything the AGENT
 * touches (PTY cwd, write-scope resolution, test/gate cwd, layout scanning,
 * scaffolding). `workspacePath` stays the root for everything the HARNESS owns
 * (anything under `.janumicode/`).
 *
 * NOTE: Phase 0's brownfield ingest still samples `workspacePath` (pre-code);
 * relocating that is the brownfield story, out of scope for the greenfield
 * sandbox. Keep this constant in sync with the mirror in
 * `scripts/` harness readers (they cannot import TS).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Subdirectory of the workspace that holds the generated project. */
export const PROJECT_CODE_DIR = 'project';

/** The agent-owned project root for a given control-plane workspace path. */
export function projectRootOf(workspacePath: string): string {
  return path.join(workspacePath, PROJECT_CODE_DIR);
}

/**
 * Normalize an absolute path to POSIX forward slashes for emission to the
 * coding agent. On Windows, `engine.workspacePath` arrives with native
 * backslashes (Git-Bash → node.exe path mangling) and `path.join` re-nativizes
 * to backslashes regardless of input — so any path rendered into the agent's
 * prompt/spec must be normalized HERE, at the emission point. Forward slash is
 * the portable choice: accepted by goose (Rust std::fs), PowerShell, cmd, Node,
 * Go — and REQUIRED by bash (backslash is an escape there). Prevents the
 * mixed-separator paths (`E:\…\ws/.janumicode/…`) that some tools mis-parse.
 */
export function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Ensure the project root exists before the coding agent's PTY spawns into it,
 * and drop a `.gooseignore` as defense-in-depth (the control plane is a sibling
 * ABOVE this dir, so it is already out of the agent's cwd subtree; the ignore
 * file just hardens against an agent that climbs `..`). Idempotent.
 */
export function ensureProjectRoot(workspacePath: string): string {
  const root = projectRootOf(workspacePath);
  fs.mkdirSync(root, { recursive: true });
  const ignorePath = path.join(root, '.gooseignore');
  if (!fs.existsSync(ignorePath)) {
    fs.writeFileSync(
      ignorePath,
      // Harness control plane — never readable/writable by the coding agent.
      ['../.janumicode/', '.janumicode/', ''].join('\n'),
      'utf8',
    );
  }
  return root;
}
