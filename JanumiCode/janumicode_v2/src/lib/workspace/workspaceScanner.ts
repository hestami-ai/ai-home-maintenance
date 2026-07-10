/**
 * Workspace Scanner — walks a workspace directory and produces a file
 * inventory used by:
 *   - Phase 0.1 workspace classification (greenfield vs brownfield)
 *   - Phase 0.2 artifact ingestion (brownfield only)
 *   - File reference resolution (resolving `specs/foo.md` style references
 *     in raw intents)
 *
 * Respects common ignore patterns (node_modules, .git, dist, etc.) and honors
 * .gitignore if present at the workspace root.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../logging';
import { classifyFile, shouldSkipDir, type FileType, type FileClassification } from './fileClassifier';

export interface ScannedFile {
  /** Absolute path */
  absolutePath: string;
  /** Path relative to workspace root, using forward slashes */
  relativePath: string;
  /** Filename (basename) */
  name: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Classification */
  type: FileType;
  /** Detected language (for source files) */
  language?: string;
  /** Whether the file is likely text (safe to read as UTF-8) */
  isText: boolean;
}

export interface WorkspaceScanResult {
  workspaceRoot: string;
  totalFiles: number;
  filesByType: Record<FileType, number>;
  files: ScannedFile[];
  /** Files that were skipped (permissions, too large, binary, etc.) */
  skipped: Array<{ path: string; reason: string }>;
}

export interface WorkspaceScanOptions {
  /** Max individual file size to include (default 5MB) */
  maxFileSizeBytes?: number;
  /** Max total files to collect (default 10000) */
  maxFiles?: number;
  /** Additional directory names to skip beyond the defaults */
  extraSkipDirs?: string[];
  /** Filter to specific file types — empty = include all */
  includeTypes?: FileType[];
  /** Extra ignore patterns (simple prefix/suffix matching) */
  extraIgnorePatterns?: string[];
}

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const DEFAULT_MAX_FILES = 10_000;

/**
 * Scan a workspace directory recursively and return a file inventory.
 */
export function scanWorkspace(
  workspaceRoot: string,
  options: WorkspaceScanOptions = {},
): WorkspaceScanResult {
  const maxFileSize = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const extraSkipDirs = new Set(options.extraSkipDirs ?? []);
  const includeTypes = options.includeTypes && options.includeTypes.length > 0
    ? new Set(options.includeTypes)
    : null;

  const files: ScannedFile[] = [];
  const skipped: Array<{ path: string; reason: string }> = [];
  const filesByType: Record<FileType, number> = {
    source: 0, config: 0, spec: 0, doc: 0, data: 0, other: 0,
  };

  // Load .gitignore patterns if present (simple prefix/glob matching only)
  const gitignorePatterns = loadGitignorePatterns(workspaceRoot);
  const extraPatterns = options.extraIgnorePatterns ?? [];
  const allPatterns = [...gitignorePatterns, ...extraPatterns];

  // Process a single directory entry: recurse into subdirectories (honoring
  // skip/ignore rules) or classify and collect a file. Returning early here is
  // equivalent to `continue` in the enclosing walk loop.
  function processEntry(entry: fs.Dirent, dir: string): void {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(workspaceRoot, absolutePath).replaceAll('\\', '/');

    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name) || extraSkipDirs.has(entry.name)) return;
      if (matchesIgnorePattern(relativePath + '/', allPatterns)) return;
      walk(absolutePath);
      return;
    }

    if (!entry.isFile()) return;
    if (matchesIgnorePattern(relativePath, allPatterns)) return;

    const stat = statFile(absolutePath, relativePath, skipped);
    if (stat === null) return;

    if (stat.size > maxFileSize) {
      skipped.push({ path: relativePath, reason: `exceeds max file size (${stat.size} > ${maxFileSize})` });
      return;
    }

    const classification: FileClassification = classifyFile(absolutePath);
    if (includeTypes && !includeTypes.has(classification.type)) return;

    const scanned: ScannedFile = {
      absolutePath,
      relativePath,
      name: entry.name,
      sizeBytes: stat.size,
      type: classification.type,
      language: classification.language,
      isText: classification.isText,
    };

    files.push(scanned);
    filesByType[classification.type]++;
  }

  function walk(dir: string): void {
    if (files.length >= maxFiles) return;

    const entries = readDirEntries(dir, skipped);
    if (entries === null) return;

    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      processEntry(entry, dir);
    }
  }

  try {
    walk(workspaceRoot);
  } catch (err) {
    getLogger().warn('workspace_scanner', 'Scan aborted with unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    workspaceRoot,
    totalFiles: files.length,
    filesByType,
    files,
    skipped,
  };
}

/**
 * Read a scanned file's content as UTF-8. Truncates at `maxBytes`.
 * Returns null for non-text files.
 */
export function readFileContent(
  file: ScannedFile,
  maxBytes = 512 * 1024,
): { content: string; truncated: boolean } | null {
  if (!file.isText) return null;
  try {
    const buf = fs.readFileSync(file.absolutePath);
    const truncated = buf.length > maxBytes;
    const slice = truncated ? buf.subarray(0, maxBytes) : buf;
    return { content: slice.toString('utf-8'), truncated };
  } catch (err) {
    getLogger().debug('workspace_scanner', 'File read failed', {
      path: file.relativePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Check if a workspace has any real artifacts — used by Phase 0.1 to
 * determine greenfield vs brownfield. A workspace with only the
 * `.janumicode/` directory and nothing else is greenfield.
 */
export function hasExistingArtifacts(workspaceRoot: string): boolean {
  try {
    const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) return true;
      if (entry.isFile()) {
        // Config files alone don't make it brownfield if they're the only thing there
        // Actually, any non-hidden file means there's existing content.
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Load simple .gitignore patterns. Only supports literal prefixes and
 * `*.ext` suffixes — intentionally narrow to avoid full glob complexity.
 */
function loadGitignorePatterns(workspaceRoot: string): string[] {
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return [];

  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    return content
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'));
  } catch {
    return [];
  }
}

/** Extract a human-readable message from an unknown thrown value. */
function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Read directory entries, recording a `skipped` entry and returning null when
 * the directory cannot be read (mirrors the original try/catch semantics).
 */
function readDirEntries(
  dir: string,
  skipped: WorkspaceScanResult['skipped'],
): fs.Dirent[] | null {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    skipped.push({ path: dir, reason: `readdir failed: ${describeError(err)}` });
    return null;
  }
}

/**
 * Stat a file, recording a `skipped` entry and returning null when the file
 * cannot be stat-ed (mirrors the original try/catch semantics).
 */
function statFile(
  absolutePath: string,
  relativePath: string,
  skipped: WorkspaceScanResult['skipped'],
): fs.Stats | null {
  try {
    return fs.statSync(absolutePath);
  } catch (err) {
    skipped.push({ path: relativePath, reason: `stat failed: ${describeError(err)}` });
    return null;
  }
}

function matchesSingleIgnorePattern(relativePath: string, raw: string): boolean {
  let pattern = raw;
  if (pattern.startsWith('!')) return false; // negation not supported
  if (pattern.startsWith('/')) pattern = pattern.slice(1);

  // `*.ext` — extension suffix match
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1);
    return relativePath.endsWith(ext);
  }
  // Trailing slash = directory-only pattern
  if (pattern.endsWith('/')) {
    return relativePath.startsWith(pattern) || relativePath.includes('/' + pattern);
  }
  // Literal match
  return relativePath === pattern || relativePath.startsWith(pattern + '/');
}

function matchesIgnorePattern(relativePath: string, patterns: string[]): boolean {
  for (const raw of patterns) {
    if (matchesSingleIgnorePattern(relativePath, raw)) return true;
  }
  return false;
}
