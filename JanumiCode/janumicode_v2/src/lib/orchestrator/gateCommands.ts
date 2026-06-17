/**
 * GateCommand — the stack-agnostic verification contract (Stage 0.5).
 *
 * A `GateCommand` is "one check to run against the workspace": a test run, a
 * typecheck, a build, a boot-smoke, or a dependency check. The stabilization
 * loop runs a `GateCommand[]` and reacts to failures; it carries ZERO language
 * assumptions — only the COMMANDS differ per stack.
 *
 * Two sources populate `GateCommand[]`, by difficulty (see the genericity
 * redesign plan):
 *   - {@link resolveGateCommands} — a DETERMINISTIC manifest-detection resolver
 *     for a HOMOGENEOUS (single detectable stack) workspace. Fact-reading
 *     ("a `Cargo.toml` ⇒ cargo commands"), generic across languages. Returns
 *     [] when the workspace has zero or MULTIPLE distinct stacks (ambiguous →
 *     the Stage 1+2 recon agent decides per-area).
 *   - the recon AGENT (Stage 1+2) — authors per-area commands for polyglot /
 *     brownfield / ambiguous stacks; supersedes the resolver.
 *
 * Pure + deterministic except the read-only manifest probe, so directly unit
 * testable.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export type GateKind = 'test' | 'typecheck' | 'build' | 'boot_smoke' | 'dep_check';

export interface GateCommand {
  /** Stable display/telemetry name, e.g. 'rust:test'. */
  name: string;
  kind: GateKind;
  /** Executable (resolved for the platform by the runner — e.g. npm→npm.cmd). */
  command: string;
  args: string[];
  /** Workspace-relative working directory; undefined = workspace root. */
  cwd?: string;
  timeoutMs: number;
}

export interface DetectedStack {
  /** 'node' | 'rust' | 'python' | 'go' | 'java' | … */
  id: string;
  /** The root manifest file that identified the stack. */
  manifest: string;
}

const FIVE_MIN = 300_000;
const TEN_MIN = 600_000;

/** Root manifest → stack family. Order is irrelevant; multiple distinct
 *  families present ⇒ ambiguous ⇒ defer to recon. */
const MANIFESTS: Array<{ file: string; stack: string }> = [
  { file: 'package.json', stack: 'node' },
  { file: 'Cargo.toml', stack: 'rust' },
  { file: 'go.mod', stack: 'go' },
  { file: 'pyproject.toml', stack: 'python' },
  { file: 'setup.py', stack: 'python' },
  { file: 'requirements.txt', stack: 'python' },
  { file: 'Pipfile', stack: 'python' },
  { file: 'pom.xml', stack: 'java' },
  { file: 'build.gradle', stack: 'java' },
  { file: 'build.gradle.kts', stack: 'java' },
];

/**
 * Detect the SINGLE stack of a homogeneous workspace from its ROOT manifests.
 * Returns null when zero stacks OR multiple DISTINCT stack families are present
 * — that "single" boundary is deliberate: a polyglot workspace needs per-area
 * roots (which dir = which stack), a judgment only the recon agent makes.
 */
export function detectWorkspaceStack(workspacePath: string): DetectedStack | null {
  const found: DetectedStack[] = [];
  const seen = new Set<string>();
  for (const m of MANIFESTS) {
    if (!fs.existsSync(path.join(workspacePath, m.file))) continue;
    if (seen.has(m.stack)) continue;
    seen.add(m.stack);
    found.push({ id: m.stack, manifest: m.file });
  }
  // Zero or 2+ distinct stacks → ambiguous → defer to recon.
  return found.length === 1 ? found[0] : null;
}

/**
 * Deterministic best-effort `GateCommand[]` for a homogeneous workspace.
 * Empty when the stack is undetectable/ambiguous (caller defers to recon).
 *
 * `test` is the cleanest signal across stacks; `typecheck`/`build` are
 * best-effort (some toolchains have no canonical default); `boot_smoke` is
 * app-specific and left to the recon agent / composition root.
 */
export function resolveGateCommands(workspacePath: string): GateCommand[] {
  const stack = detectWorkspaceStack(workspacePath);
  if (!stack) return [];
  switch (stack.id) {
    case 'node':
      return resolveNode(workspacePath);
    case 'rust':
      return [
        { name: 'rust:test', kind: 'test', command: 'cargo', args: ['test'], timeoutMs: TEN_MIN },
        { name: 'rust:check', kind: 'typecheck', command: 'cargo', args: ['check'], timeoutMs: FIVE_MIN },
      ];
    case 'go':
      return [
        { name: 'go:test', kind: 'test', command: 'go', args: ['test', './...'], timeoutMs: TEN_MIN },
        { name: 'go:vet', kind: 'typecheck', command: 'go', args: ['vet', './...'], timeoutMs: FIVE_MIN },
      ];
    case 'python':
      return [
        { name: 'python:test', kind: 'test', command: 'pytest', args: ['-q'], timeoutMs: TEN_MIN },
      ];
    case 'java':
      return fs.existsSync(path.join(workspacePath, 'pom.xml'))
        ? [{ name: 'java:test', kind: 'test', command: 'mvn', args: ['-q', 'test'], timeoutMs: TEN_MIN }]
        : [{ name: 'java:test', kind: 'test', command: 'gradle', args: ['test'], timeoutMs: TEN_MIN }];
    default:
      return [];
  }
}

/** Node: read package.json for the real test script + a typecheck/build when a
 *  tsconfig / build script is present. */
function resolveNode(workspacePath: string): GateCommand[] {
  const out: GateCommand[] = [];
  let scripts: Record<string, string> = {};
  let hasTypescript = false;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(workspacePath, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    scripts = pkg.scripts ?? {};
    hasTypescript = Boolean(pkg.devDependencies?.typescript || pkg.dependencies?.typescript);
  } catch { /* malformed package.json → no node gates */ return out; }

  if (scripts.test) {
    out.push({ name: 'node:test', kind: 'test', command: 'npm', args: ['test', '--silent'], timeoutMs: TEN_MIN });
  }
  // Typecheck: a `typecheck`/`tsc` script wins; else fall back to local tsc when
  // a tsconfig + the typescript dep are present.
  if (scripts.typecheck) {
    out.push({ name: 'node:typecheck', kind: 'typecheck', command: 'npm', args: ['run', 'typecheck', '--silent'], timeoutMs: FIVE_MIN });
  } else if (hasTypescript && fs.existsSync(path.join(workspacePath, 'tsconfig.json'))) {
    out.push({ name: 'node:tsc', kind: 'typecheck', command: 'npx', args: ['--no-install', 'tsc', '--noEmit'], timeoutMs: FIVE_MIN });
  }
  if (scripts.build) {
    out.push({ name: 'node:build', kind: 'build', command: 'npm', args: ['run', 'build', '--silent'], timeoutMs: FIVE_MIN });
  }
  return out;
}
