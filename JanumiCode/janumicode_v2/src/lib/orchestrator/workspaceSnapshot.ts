/**
 * Wave R — wave-level workspace snapshot.
 *
 * `ExecutorAgent.snapshotWriteDirectories` already produces per-leaf
 * pre/post Maps; this module:
 *   - aggregates per-leaf snapshots into a wave-level diff for the gate
 *     (counts of created/modified/deleted, total bytes, file lists)
 *   - retains the wave-start snapshot so wave rejection can reverse-apply
 *     (delete created files, restore prior content for modified files,
 *     restore deleted files)
 *
 * Mode B (feature-branch isolation) is deferred; this implementation is
 * Mode A (in-place) per the Wave R design.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { getLogger } from '../logging';

export type FileSnapshot = {
  /** Absolute path. */
  path: string;
  /** sha256 of the file contents at snapshot time, or null if file did not exist. */
  hash: string | null;
  /** Captured byte content for restoration. Null when the file did not exist OR is over the cap. */
  content?: Buffer | null;
  /** Size in bytes when captured (0 when missing). */
  size?: number;
  /** True when the file was too large to capture content; rollback can still delete it on a "created" diff but not restore content on a "modified" diff. */
  oversize?: boolean;
};

export interface WaveDiffEntry {
  path: string;
  operation: 'created' | 'modified' | 'deleted' | 'unchanged';
  /** Snapshot at wave start (when file existed pre-wave). */
  pre: FileSnapshot | null;
  /** Snapshot at wave end. */
  post: FileSnapshot | null;
}

export interface WaveDiffSummary {
  created: number;
  modified: number;
  deleted: number;
  total_bytes_added: number;
  files: WaveDiffEntry[];
}

const PER_FILE_BYTE_CAP = 5 * 1024 * 1024;

function safeHash(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function listFilesRecursive(absRoot: string, accumulator: string[], maxFiles = 50_000): void {
  if (!fs.existsSync(absRoot)) return;
  const stat = fs.statSync(absRoot);
  if (stat.isFile()) {
    accumulator.push(absRoot);
    return;
  }
  if (!stat.isDirectory()) return;
  const entries = fs.readdirSync(absRoot, { withFileTypes: true });
  for (const e of entries) {
    if (accumulator.length >= maxFiles) return;
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '.janumicode') continue;
    const child = path.join(absRoot, e.name);
    if (e.isDirectory()) listFilesRecursive(child, accumulator, maxFiles);
    else if (e.isFile()) accumulator.push(child);
  }
}

/**
 * Capture (hash + optionally content) a single file into `snapshot`.
 * Oversized files are recorded hash-only; capture failures are logged and skipped.
 * Extracted from `captureWaveSnapshot` to keep its cognitive complexity low.
 */
function captureFile(filePath: string, snapshot: Map<string, FileSnapshot>): void {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;
    if (stat.size > PER_FILE_BYTE_CAP) {
      snapshot.set(filePath, {
        path: filePath,
        hash: null,
        content: null,
        size: stat.size,
        oversize: true,
      });
      return;
    }
    const buf = fs.readFileSync(filePath);
    snapshot.set(filePath, {
      path: filePath,
      hash: safeHash(buf),
      content: buf,
      size: stat.size,
    });
  } catch (err) {
    getLogger().warn('workflow', 'workspaceSnapshot: capture failed for file', {
      filePath, error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Capture a snapshot of every file under each `writeDirectoryPath`.
 * `cwd` is the workspace root; relative paths resolve against it.
 * Captured `content` is used by `revertSnapshot` to restore on rejection;
 * skip oversized files (over cap) and rely on hash-only comparison for them.
 */
export function captureWaveSnapshot(
  writeDirectoryPaths: string[],
  cwd: string,
): Map<string, FileSnapshot> {
  const snapshot = new Map<string, FileSnapshot>();
  const seen = new Set<string>();
  for (const rel of writeDirectoryPaths) {
    const abs = path.isAbsolute(rel) ? rel : path.resolve(cwd, rel);
    if (seen.has(abs)) continue;
    seen.add(abs);
    const files: string[] = [];
    listFilesRecursive(abs, files);
    for (const filePath of files) {
      captureFile(filePath, snapshot);
    }
  }
  return snapshot;
}

/**
 * Classify a path present in BOTH snapshots as modified (different hash) or
 * unchanged, returning the diff entry plus the modified-count and positive
 * byte-delta contributions. Extracted from `diffWaveSnapshots` to flatten its
 * nesting; byte accounting matches the original (only positive deltas count).
 */
function diffExistingFile(
  p: string,
  a: FileSnapshot,
  b: FileSnapshot,
): { entry: WaveDiffEntry; modifiedCount: number; bytesAdded: number } {
  if (a.hash !== b.hash) {
    const delta = (b.size ?? 0) - (a.size ?? 0);
    return {
      entry: { path: p, operation: 'modified', pre: a, post: b },
      modifiedCount: 1,
      bytesAdded: Math.max(0, delta),
    };
  }
  return {
    entry: { path: p, operation: 'unchanged', pre: a, post: b },
    modifiedCount: 0,
    bytesAdded: 0,
  };
}

/**
 * Diff a pre-wave snapshot against a freshly-captured post-wave snapshot
 * across the same write directories. Result drives both the wave gate
 * summary and the rejection-rollback path.
 */
export function diffWaveSnapshots(
  pre: Map<string, FileSnapshot>,
  post: Map<string, FileSnapshot>,
): WaveDiffSummary {
  const allPaths = new Set<string>([...pre.keys(), ...post.keys()]);
  const files: WaveDiffEntry[] = [];
  let created = 0;
  let modified = 0;
  let deleted = 0;
  let totalBytesAdded = 0;
  for (const p of allPaths) {
    const a = pre.get(p) ?? null;
    const b = post.get(p) ?? null;
    if (!a && b) {
      created++;
      totalBytesAdded += b.size ?? 0;
      files.push({ path: p, operation: 'created', pre: null, post: b });
    } else if (a && !b) {
      deleted++;
      files.push({ path: p, operation: 'deleted', pre: a, post: null });
    } else if (a && b) {
      const result = diffExistingFile(p, a, b);
      modified += result.modifiedCount;
      totalBytesAdded += result.bytesAdded;
      files.push(result.entry);
    }
  }
  return { created, modified, deleted, total_bytes_added: totalBytesAdded, files };
}

/**
 * Restore a captured pre-wave file content to disk, creating parent dirs.
 * Extracted from `revertWaveSnapshot` so its per-entry dispatch stays flat.
 */
function restorePreContent(filePath: string, content: Buffer): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

/**
 * Reverse-apply a single wave-diff entry. Returns whether a file was reverted
 * plus an optional non-throwing failure record. Any fs error is left to
 * propagate so the caller records it uniformly via its per-entry try/catch.
 * Extracted from `revertWaveSnapshot` to keep its loop under the complexity cap.
 */
function revertDiffEntry(entry: WaveDiffEntry): {
  reverted: boolean;
  failure: { path: string; reason: string } | null;
} {
  if (entry.operation === 'created') {
    if (fs.existsSync(entry.path)) {
      fs.unlinkSync(entry.path);
      return { reverted: true, failure: null };
    }
    return { reverted: false, failure: null };
  }
  if (entry.operation === 'modified') {
    if (entry.pre?.content) {
      restorePreContent(entry.path, entry.pre.content);
      return { reverted: true, failure: null };
    }
    if (entry.pre?.oversize) {
      return { reverted: false, failure: { path: entry.path, reason: 'oversize_uncaptured' } };
    }
    return { reverted: false, failure: { path: entry.path, reason: 'no_pre_content' } };
  }
  if (entry.operation === 'deleted') {
    if (entry.pre?.content) {
      restorePreContent(entry.path, entry.pre.content);
      return { reverted: true, failure: null };
    }
    return { reverted: false, failure: { path: entry.path, reason: 'no_pre_content' } };
  }
  return { reverted: false, failure: null };
}

/**
 * Reverse-apply the wave diff:
 *   - created files → delete
 *   - deleted files → restore from pre-snapshot content (when captured)
 *   - modified files → restore pre-snapshot content (when captured)
 *
 * Oversized files have null content and cannot be restored bit-for-bit;
 * we log the gap and continue. Returns the count of files reverted.
 */
export function revertWaveSnapshot(diff: WaveDiffSummary): {
  reverted: number;
  failed: Array<{ path: string; reason: string }>;
} {
  let reverted = 0;
  const failed: Array<{ path: string; reason: string }> = [];
  for (const entry of diff.files) {
    try {
      const result = revertDiffEntry(entry);
      if (result.reverted) reverted++;
      if (result.failure) failed.push(result.failure);
    } catch (err) {
      failed.push({
        path: entry.path,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { reverted, failed };
}

/**
 * Detect overlapping `write_directory_paths` between two leaves where
 * both leaves wrote the same file. Used by the scheduler to surface
 * merge-conflict events (handled per `merge_conflict_default_strategy`).
 */
export function detectOverlapConflicts(
  byLeafFiles: Array<{ leafTaskId: string; writtenFiles: string[] }>,
): Array<{ filePath: string; leaves: string[] }> {
  const writers = new Map<string, string[]>();
  for (const e of byLeafFiles) {
    for (const f of e.writtenFiles) {
      const existing = writers.get(f);
      if (existing) existing.push(e.leafTaskId);
      else writers.set(f, [e.leafTaskId]);
    }
  }
  const conflicts: Array<{ filePath: string; leaves: string[] }> = [];
  for (const [filePath, leaves] of writers) {
    if (leaves.length > 1) conflicts.push({ filePath, leaves });
  }
  return conflicts;
}

// ── Lever 2c — divergent-duplicate detection ─────────────────────────

export interface DivergentDuplicateFinding {
  /** The shared basename (lowercased) that appears in ≥2 places. */
  basename: string;
  /** The divergent files — workspace-relative path + content hash. */
  files: Array<{ path: string; hash: string }>;
}

/**
 * Structural file basenames that legitimately recur across a codebase and
 * carry no "same module, divergent impl" signal. Pure naming conventions
 * (NOT domain keywords) so the detector stays general across any intent.
 */
const UBIQUITOUS_BASENAMES = new Set([
  'index', 'types', 'main', 'mod', '__init__', 'setup', 'conftest',
]);

function isTestFile(base: string): boolean {
  return /\.(test|spec)\./i.test(base) || base.startsWith('test_');
}

/**
 * Classify one absolute file path for the divergent-duplicate scan: apply the
 * protected-prefix, ubiquitous-name, test-file and root-config skip rules, then
 * stat + hash it. Returns `null` for any skipped/unreadable file. Extracted from
 * `detectDivergentDuplicates` to keep its scan loop under the complexity cap.
 */
function classifyFileForDuplicates(
  abs: string,
  workspaceRoot: string,
  normPrefixes: string[],
): { base: string; rel: string; hash: string } | null {
  const rel = path.relative(workspaceRoot, abs).split(path.sep).join('/');
  if (normPrefixes.some(p => rel === p.slice(0, -1) || rel.startsWith(p))) return null;
  const base = path.basename(abs).toLowerCase();
  const stem = base.replace(/\.[^.]+$/, '');
  if (UBIQUITOUS_BASENAMES.has(stem) || isTestFile(base)) return null;
  if (ROOT_CONFIG_BASENAMES.has(base)) return null;
  try {
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size > PER_FILE_BYTE_CAP) return null;
    return { base, rel, hash: safeHash(fs.readFileSync(abs)) };
  } catch {
    return null;
  }
}

/**
 * Lever 2c — detect divergent duplicate modules across the generated
 * workspace: files that share a basename but have DIFFERENT content hashes
 * in different directories (e.g. two `encryption-service.js`, one ESM/sync
 * and one CJS/async — the exact fragmentation symptom the shared scaffold
 * is meant to prevent). Purely structural (basename + content hash); no
 * domain keywords. Common structural names, test files, and root config
 * files are skipped to avoid false positives.
 *
 * `protectedPrefixes` (the scaffold's shared dir) are excluded from the
 * scan entirely — the scaffold owns single canonical copies there.
 */
export function detectDivergentDuplicates(
  workspaceRoot: string,
  protectedPrefixes: string[] = [],
): DivergentDuplicateFinding[] {
  const files: string[] = [];
  listFilesRecursive(workspaceRoot, files);

  const normPrefixes = protectedPrefixes
    .filter(p => p.endsWith('/'))
    .map(p => p.replaceAll('\\', '/'));

  const byBase = new Map<string, Array<{ path: string; hash: string }>>();
  for (const abs of files) {
    const classified = classifyFileForDuplicates(abs, workspaceRoot, normPrefixes);
    if (!classified) continue;
    const { base, rel, hash } = classified;
    const group = byBase.get(base);
    if (group) group.push({ path: rel, hash });
    else byBase.set(base, [{ path: rel, hash }]);
  }

  const findings: DivergentDuplicateFinding[] = [];
  for (const [base, group] of byBase) {
    if (group.length < 2) continue;
    const distinctHashes = new Set(group.map(g => g.hash));
    if (distinctHashes.size < 2) continue; // identical copies — not divergent
    findings.push({ basename: base, files: group });
  }
  return findings;
}

const ROOT_CONFIG_BASENAMES = new Set([
  'package.json', 'tsconfig.json', 'package-lock.json', 'pnpm-lock.yaml',
  'yarn.lock', 'vitest.config.ts', 'jest.config.js', '.gitignore', 'readme.md',
]);
