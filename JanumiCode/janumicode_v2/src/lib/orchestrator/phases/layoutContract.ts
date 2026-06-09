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
 * Deterministic component_id → canonical source directory. Strips the
 * conventional component prefix and slugifies; special-cases the shared and
 * root pseudo-components. Mirrors the slug logic in cycleDeltaSynthesizers.
 */
export function canonicalComponentDir(
  componentId: string,
  srcRoot = 'src',
  sharedDir = 'src/shared',
): string {
  const raw = (componentId ?? '').trim().toLowerCase();
  if (!raw) return `${srcRoot}/unknown`;
  if (raw === 'shared' || raw === 'comp-shared' || raw === 'cross_cutting' || raw === 'cross-cutting') {
    return sharedDir;
  }
  if (raw === 'root' || raw === 'app') return srcRoot;
  const slug = raw
    .replace(COMPONENT_PREFIX_RE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${srcRoot}/${slug || 'unknown'}`;
}

// ── Allowed extensions per language ─────────────────────────────────

const COMMON_NON_SOURCE_EXT = [
  '.json', '.md', '.yaml', '.yml', '.env', '.gitignore', '.txt', '.sql', '.sh',
];

function allowedExtensionsFor(language: ProjectProfile['language']): string[] {
  const ts = ['.ts', '.tsx', '.d.ts', '.mts', '.cts'];
  const js = ['.js', '.jsx', '.mjs', '.cjs'];
  // TypeScript projects still legitimately contain .js (config, generated);
  // JavaScript projects do NOT contain .ts.
  const lang = language === 'typescript' ? [...ts, ...js] : js;
  return [...new Set([...lang, ...COMMON_NON_SOURCE_EXT])];
}

// ── Contract construction ───────────────────────────────────────────

const BASE_ALLOWED_TOP_LEVEL = ['src', 'node_modules', '.git', '.janumicode', 'dist', 'docs'];

export function buildProjectLayoutContract(
  components: Array<{ id?: string }>,
  profile: ProjectProfile,
  testPlacement: 'colocated' | 'subdir' = 'colocated',
  extraAllowedTopLevel: string[] = [],
): ProjectLayoutContract {
  const srcRoot = 'src';
  const sharedDir = profile.shared_dir.replace(/\\/g, '/').replace(/\/+$/, '');

  const componentDirMap: Record<string, string> = {};
  for (const c of components) {
    if (typeof c.id === 'string' && c.id.trim()) {
      componentDirMap[c.id] = canonicalComponentDir(c.id, srcRoot, sharedDir);
    }
  }

  // The shared dir's own top-level segment is allowed (e.g. 'src' for src/shared);
  // a SEPARATE top-level dir matching the shared leaf (e.g. root 'shared/') is a stray.
  const allowedTopLevel = [...new Set([...BASE_ALLOWED_TOP_LEVEL, srcRoot, ...extraAllowedTopLevel])];

  return {
    kind: 'project_layout_contract',
    component_dir_map: componentDirMap,
    import_aliases: [
      { alias: '@shared/*', target: `${sharedDir}/*` },
      { alias: '@/*', target: `${srcRoot}/*` },
    ],
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
  const sharedAlias = contract.import_aliases.find(a => a.alias.startsWith('@shared'))?.alias ?? '@shared/*';
  const testRule = contract.test_placement === 'colocated'
    ? 'Co-locate each test as `<file>.test.ts` in the SAME directory as the implementation file.'
    : 'Place tests in a `tests/` subdirectory inside the component directory.';
  return [
    `Language: ${profile.language}`,
    `Module system: ${profile.module}`,
    `Test runner: ${profile.test_runner} (root \`npm test\` → \`${profile.test_runner === 'vitest' ? 'vitest run' : profile.test_runner}\`)`,
    `Shared modules: ${contract.shared_dir}/ — import via the ${sharedAlias.replace('/*', '/')} alias (e.g. \`import { Foo } from '@shared/models/Foo'\`). Do NOT use relative, bare, or \`${contract.shared_dir}/…\` paths.`,
    `Tests: ${testRule}`,
    `Structure rules (hard): write ONLY inside your assigned directory; do NOT create new top-level directories (no root \`shared/\`, \`tests/\`, \`lib/\` — the shared dir is ${contract.shared_dir}/ only); do NOT write build output to \`dist/\`; do NOT create files in any language other than ${profile.language} (allowed extensions: ${contract.allowed_source_extensions.join(' ')}).`,
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
 * Read-only structural scan of the generated workspace against the contract.
 * Never throws, never blocks — returns a report the caller records/annotates.
 */
export function detectLayoutViolations(
  workspacePath: string,
  contract: ProjectLayoutContract,
): LayoutViolationReport {
  const allowed = new Set(contract.allowed_top_level_dirs);
  const sharedLeaf = contract.shared_dir.split('/').pop() ?? 'shared';

  const strayTopLevel: string[] = [];
  const strayShared: string[] = [];
  try {
    for (const e of fs.readdirSync(workspacePath, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (SCAN_SKIP_DIRS.has(e.name)) continue;
      if (!allowed.has(e.name)) strayTopLevel.push(e.name);
      // A top-level dir matching the shared leaf (e.g. root `shared/`) shadows the canonical one.
      if (e.name === sharedLeaf && contract.shared_dir !== e.name) strayShared.push(e.name);
    }
  } catch { /* workspace unreadable — empty report */ }

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
