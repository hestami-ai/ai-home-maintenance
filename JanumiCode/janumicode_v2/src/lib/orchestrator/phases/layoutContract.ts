/**
 * Project Layout Contract (deterministic, pure).
 *
 * The single authoritative source of the GENERATED codebase's structure:
 * the component_id → directory map, the canonical import aliases, the test
 * placement convention, and which top-level dirs / file extensions are
 * legal. Derived deterministically from the architecture (functional
 * components) + the project profile — no LLM involvement.
 *
 * Purpose: stop Phase-9 executor leaves from each inventing their own layout
 * (the slice-127 symptoms: a stray root ./shared duplicating src/shared, the
 * same model imported six ways, tests in four places, a .go file in a TS
 * project). The orchestrator owns directories; the LLM owns task semantics.
 *
 * This module is pure (no I/O except the read-only `detectLayoutViolations`
 * scan) so it is directly unit-testable.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProjectProfile } from './scaffoldSynthesis';

// ── Types ───────────────────────────────────────────────────────────

export interface ImportAlias {
  /** e.g. '@shared/*' */
  alias: string;
  /** workspace-relative target, e.g. 'src/shared/*' */
  target: string;
}

export interface ProjectLayoutContract {
  kind: 'project_layout_contract';
  /** component_id → workspace-relative canonical source dir (e.g. 'src/analytics'). */
  component_dir_map: Record<string, string>;
  /** tsconfig path aliases — the ONE canonical import form per target. */
  import_aliases: ImportAlias[];
  /** Where test files live relative to the implementation. */
  test_placement: 'colocated' | 'subdir';
  /** The single canonical shared dir (from profile.shared_dir). */
  shared_dir: string;
  /** Directories permitted at the workspace root. Anything else is a stray. */
  allowed_top_level_dirs: string[];
  /** File extensions legal for this profile's language (+ common non-source). */
  allowed_source_extensions: string[];
}

export interface LayoutViolationReport {
  /** Top-level dirs present that are not in `allowed_top_level_dirs`. */
  stray_top_level_dirs: string[];
  /** Top-level dirs that shadow the canonical shared dir (e.g. root `shared/`). */
  stray_shared_trees: string[];
  /** Files whose extension is not in `allowed_source_extensions`. */
  foreign_language_files: string[];
  /** True when `dist/` exists AND holds source-language files (build output committed). */
  build_output_has_source: boolean;
  /** Convenience: true when every category is empty. */
  passed: boolean;
}

// ── Slug / dir mapping ──────────────────────────────────────────────

const COMPONENT_PREFIX_RE = /^(comp|component|cmp)[-_]/i;

/**
 * Stacks whose package/module directory names must be valid IDENTIFIERS — they
 * cannot contain hyphens. Python (`import data_governance` — a hyphen is a syntax
 * error), Rust (snake_case modules), Go, Java (package segments). For these the
 * component slug uses underscores; node/TS keep hyphenated dir names (TS resolves
 * via path aliases / relative imports, so hyphens are fine and conventional).
 * Slice-156: a python run handed `src/data-governance` deadlocked the executor
 * into forking an underscore variant it could actually import → fragmentation.
 */
function usesUnderscorePackages(stack?: string): boolean {
  const s = (stack ?? '').trim().toLowerCase();
  return s === 'python' || s === 'rust' || s === 'go' || s === 'java';
}

/**
 * Deterministic component_id → canonical source directory. Strips the
 * conventional component prefix and slugifies; special-cases the shared and
 * root pseudo-components. The slug separator is stack-aware (underscore for
 * identifier-based stacks, hyphen for node). Mirrors the slug logic in
 * cycleDeltaSynthesizers.
 */
export function canonicalComponentDir(
  componentId: string,
  srcRoot = 'src',
  sharedDir = 'src/shared',
  stack?: string,
): string {
  const raw = (componentId ?? '').trim().toLowerCase();
  if (!raw) return `${srcRoot}/unknown`;
  if (raw === 'shared' || raw === 'comp-shared' || raw === 'cross_cutting' || raw === 'cross-cutting') {
    return sharedDir;
  }
  if (raw === 'root' || raw === 'app') return srcRoot;
  const sep = usesUnderscorePackages(stack) ? '_' : '-';
  const slug = raw
    .replace(COMPONENT_PREFIX_RE, '')
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), '');
  return `${srcRoot}/${slug || 'unknown'}`;
}

/**
 * Normalize a workspace-relative source path to the stack's package convention.
 * For identifier-based stacks, hyphens in the per-component dir segment (under
 * the source root) become underscores — so a PERSISTED hyphenated
 * write_directory_path (`src/data-governance`, minted by an earlier node-shaped
 * Phase 6) renders as a valid python package (`src/data_governance`) without
 * re-running Phase 6. Shared/config files and non-component paths are untouched.
 */
export function normalizeComponentDirForStack(p: string, stack?: string): string {
  if (!usesUnderscorePackages(stack)) return p;
  return p.replaceAll('-', '_');
}

/**
 * Resolve a component's write scope (directory) at PHASE 9 — the first phase that
 * knows the stack. This is the single authority that replaces the persisted
 * (Phase-6, pre-language) `write_directory_paths`, so every executor-prompt site
 * reads one consistent, stack-correct directory. Returns null to leave persisted
 * paths untouched. GREENFIELD ONLY: brownfield keeps its recon-detected real dirs
 * (pass `workspaceKind` from recon, or `scaffoldSource` as the fallback signal).
 */
export function resolveWriteScopeForComponent(opts: {
  componentId: string | undefined;
  isCompositionRoot: boolean;
  stack: string;
  workspaceKind?: string;
  scaffoldSource?: string;
}): string[] | null {
  let greenfield: boolean;
  if (opts.workspaceKind !== undefined) {
    greenfield = opts.workspaceKind === 'greenfield';
  } else if (opts.scaffoldSource !== undefined) {
    greenfield = opts.scaffoldSource !== 'brownfield_detected';
  } else {
    greenfield = false;
  }
  if (!greenfield) return null;
  if (opts.isCompositionRoot) return ['src']; // owns the whole tree — never slug
  const id = (opts.componentId ?? '').trim();
  if (!id) return null;
  // canonicalComponentDir special-cases shared/cross_cutting → the shared dir,
  // and uses the stack's package separator (underscore for python/rust/go/java).
  return [canonicalComponentDir(id, 'src', 'src/shared', opts.stack)];
}

// ── Allowed extensions per language ─────────────────────────────────

const COMMON_NON_SOURCE_EXT = [
  '.json', '.md', '.yaml', '.yml', '.env', '.gitignore', '.txt', '.sql', '.sh',
];

function allowedExtensionsFor(language: ProjectProfile['language']): string[] {
  const ts = ['.ts', '.tsx', '.d.ts', '.mts', '.cts'];
  const js = ['.js', '.jsx', '.mjs', '.cjs'];
  // TypeScript projects still legitimately contain .js (config, generated);
  // JavaScript projects do NOT contain .ts. Non-node stacks get their own.
  let lang: string[];
  switch (language) {
    case 'typescript': lang = [...ts, ...js]; break;
    case 'javascript': lang = js; break;
    case 'python': lang = ['.py', '.pyi']; break;
    case 'go': lang = ['.go']; break;
    case 'rust': lang = ['.rs']; break;
    case 'java': lang = ['.java']; break;
  }
  return [...new Set([...lang, ...COMMON_NON_SOURCE_EXT])];
}

/** The JS family — the only languages that use `@shared/*` path aliases. */
function usesPathAliases(language: ProjectProfile['language']): boolean {
  return language === 'typescript' || language === 'javascript';
}

// ── Contract construction ───────────────────────────────────────────

/** Linear trailing-slash strip (avoids the ReDoS-prone `/\/+$/` backtracking). */
function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.codePointAt(end - 1) === 47) end--;
  return s.slice(0, end);
}

const BASE_ALLOWED_TOP_LEVEL = ['src', 'node_modules', '.git', '.janumicode', 'dist', 'docs'];

export function buildProjectLayoutContract(
  components: Array<{ id?: string }>,
  profile: ProjectProfile,
  testPlacement: 'colocated' | 'subdir' = 'colocated',
  extraAllowedTopLevel: string[] = [],
): ProjectLayoutContract {
  const srcRoot = 'src';
  const sharedDir = stripTrailingSlashes(profile.shared_dir.replaceAll('\\', '/'));

  const componentDirMap: Record<string, string> = {};
  for (const c of components) {
    if (typeof c.id === 'string' && c.id.trim()) {
      componentDirMap[c.id] = canonicalComponentDir(c.id, srcRoot, sharedDir, profile.language);
    }
  }

  // The shared dir's own top-level segment is allowed (e.g. 'src' for src/shared);
  // a SEPARATE top-level dir matching the shared leaf (e.g. root 'shared/') is a stray.
  const allowedTopLevel = [...new Set([...BASE_ALLOWED_TOP_LEVEL, srcRoot, ...extraAllowedTopLevel])];

  return {
    kind: 'project_layout_contract',
    component_dir_map: componentDirMap,
    // Path aliases are a TS/JS (tsconfig `paths`) construct. Python/go/rust/java
    // use native package imports, so they get NO aliases (an `@shared/*` alias
    // would be meaningless and mislead the executor prompt).
    import_aliases: usesPathAliases(profile.language)
      ? [
          { alias: '@shared/*', target: `${sharedDir}/*` },
          { alias: '@/*', target: `${srcRoot}/*` },
        ]
      : [],
    test_placement: testPlacement,
    shared_dir: sharedDir,
    allowed_top_level_dirs: allowedTopLevel,
    allowed_source_extensions: allowedExtensionsFor(profile.language),
  };
}

// ── Conventions string (replaces advisory prose) ────────────────────

/** Human/LLM-facing conventions text, derived from the contract + profile. */
export function renderLayoutConventions(
  contract: ProjectLayoutContract,
  profile: ProjectProfile,
): string {
  const sharedAlias = contract.import_aliases.find(a => a.alias.startsWith('@shared'))?.alias;
  const isNode = profile.language === 'typescript' || profile.language === 'javascript';

  // Stack-idiomatic shared-import + test-file convention. The node path keeps
  // its exact prior wording (tsconfig `@shared` alias, co-located `.test.ts`,
  // `npm test`); non-node stacks describe native package imports + their runner.
  let sharedRule: string;
  let testRule: string;
  let runnerRule: string;
  const sharedLeaf = contract.shared_dir.split('/').slice(1).join('/') || 'shared';
  if (isNode && sharedAlias) {
    runnerRule = `Test runner: ${profile.test_runner} (root \`npm test\` → \`${profile.test_runner === 'vitest' ? 'vitest run' : profile.test_runner}\`)`;
    sharedRule = `Shared modules: ${contract.shared_dir}/ — import via the ${sharedAlias.replace('/*', '/')} alias (e.g. \`import { Foo } from '@shared/models/Foo'\`). Do NOT use relative, bare, or \`${contract.shared_dir}/…\` paths.`;
    testRule = contract.test_placement === 'colocated'
      ? 'Co-locate each test as `<file>.test.ts` in the SAME directory as the implementation file.'
      : 'Place tests in a `tests/` subdirectory inside the component directory.';
  } else if (profile.language === 'python') {
    const pkg = sharedLeaf.replaceAll('/', '.');
    runnerRule = `Test runner: pytest (run from the project root)`;
    sharedRule = `Shared modules: ${contract.shared_dir}/ — import via the package path (e.g. \`from ${pkg}.models.Foo import Foo\`). Do NOT redefine shared types.`;
    testRule = contract.test_placement === 'colocated'
      ? 'Co-locate each test as `test_<file>.py` in the SAME directory as the implementation file.'
      : 'Place tests in a `tests/` subdirectory inside the component directory.';
  } else {
    // go/rust/java: describe generically by the resolved test runner.
    runnerRule = `Test runner: ${profile.test_runner}`;
    sharedRule = `Shared modules: ${contract.shared_dir}/ — import using your language's native package/module import. Do NOT redefine shared types.`;
    testRule = `Place tests per ${profile.language} convention.`;
  }

  return [
    `Language: ${profile.language}`,
    `Module system: ${profile.module}`,
    runnerRule,
    sharedRule,
    `Tests: ${testRule}`,
    `Structure rules (hard): write ONLY inside your assigned directory; do NOT create new top-level directories (the shared dir is ${contract.shared_dir}/ only); do NOT write build output to \`dist/\`; do NOT create files in any language other than ${profile.language} (allowed extensions: ${contract.allowed_source_extensions.join(' ')}).`,
  ].join('\n');
}

// ── Structural detection (read-only, report-only) ───────────────────

const SCAN_SKIP_DIRS = new Set(['node_modules', '.git', '.janumicode']);

function listFilesShallowRecursive(absRoot: string, acc: string[], maxFiles = 50_000): void {
  if (!fs.existsSync(absRoot)) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absRoot, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (acc.length >= maxFiles) return;
    if (SCAN_SKIP_DIRS.has(e.name)) continue;
    const child = path.join(absRoot, e.name);
    if (e.isDirectory()) listFilesShallowRecursive(child, acc, maxFiles);
    else if (e.isFile()) acc.push(child);
  }
}

function extOf(file: string): string {
  const base = path.basename(file).toLowerCase();
  if (base.endsWith('.d.ts')) return '.d.ts';
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot) : '';
}

/**
 * Scan the workspace's immediate top-level directories for strays (dirs not in
 * `allowed`) and shared-tree shadows (a top-level dir matching the shared leaf
 * that is not the canonical shared dir). Read-only; on an unreadable workspace
 * returns empty arrays. Extracted from `detectLayoutViolations` to keep it
 * within cognitive-complexity limits — behaviour is identical.
 */
function scanTopLevelStrays(
  workspacePath: string,
  allowed: Set<string>,
  sharedLeaf: string,
  sharedDir: string,
): { strayTopLevel: string[]; strayShared: string[] } {
  const strayTopLevel: string[] = [];
  const strayShared: string[] = [];
  try {
    for (const e of fs.readdirSync(workspacePath, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (SCAN_SKIP_DIRS.has(e.name)) continue;
      if (!allowed.has(e.name)) strayTopLevel.push(e.name);
      // A top-level dir matching the shared leaf (e.g. root `shared/`) shadows the canonical one.
      if (e.name === sharedLeaf && sharedDir !== e.name) strayShared.push(e.name);
    }
  } catch { /* workspace unreadable — empty report */ }
  return { strayTopLevel, strayShared };
}

/**
 * Read-only structural scan of the generated workspace against the contract.
 * Never throws, never blocks — returns a report the caller records/annotates.
 */
export function detectLayoutViolations(
  workspacePath: string,
  contract: ProjectLayoutContract,
): LayoutViolationReport {
  const allowed = new Set(contract.allowed_top_level_dirs);
  const sharedLeaf = contract.shared_dir.split('/').pop() ?? 'shared';

  const { strayTopLevel, strayShared } = scanTopLevelStrays(
    workspacePath, allowed, sharedLeaf, contract.shared_dir,
  );

  const allowedExt = new Set(contract.allowed_source_extensions);
  const files: string[] = [];
  listFilesShallowRecursive(workspacePath, files);
  const foreign: string[] = [];
  for (const f of files) {
    const ext = extOf(f);
    // Only flag code-like foreign extensions (has an extension, not allowed).
    if (ext && !allowedExt.has(ext)) {
      foreign.push(path.relative(workspacePath, f).split(path.sep).join('/'));
    }
  }

  // dist/ committed WITH source files (.ts/.tsx) is build output that shouldn't be there.
  const distDir = path.join(workspacePath, 'dist');
  let buildOutputHasSource = false;
  if (fs.existsSync(distDir)) {
    const distFiles: string[] = [];
    listFilesShallowRecursive(distDir, distFiles);
    buildOutputHasSource = distFiles.some(f => {
      const ext = extOf(f);
      return ext === '.ts' || ext === '.tsx';
    });
  }

  const passed = strayTopLevel.length === 0 && strayShared.length === 0
    && foreign.length === 0 && !buildOutputHasSource;

  return {
    stray_top_level_dirs: strayTopLevel,
    stray_shared_trees: strayShared,
    foreign_language_files: foreign.slice(0, 200),
    build_output_has_source: buildOutputHasSource,
    passed,
  };
}
