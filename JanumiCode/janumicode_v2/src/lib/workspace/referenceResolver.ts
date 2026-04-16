/**
 * File Reference Resolver — detects explicit file references in raw intent
 * text and resolves them against the workspace filesystem.
 *
 * Supports three reference forms:
 *   1. Double-quoted paths:  `Review "specs/Product.md"`
 *   2. @mention syntax:      `@path/to/file.ts`
 *   3. file:// URIs:         `file:///C:/...`
 *
 * Resolution is workspace-relative. Unresolved references are returned with
 * an explanatory status so Phase 0 can surface them to the human rather
 * than silently dropping them.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { URL } from 'node:url';
import { classifyFile, type FileType } from './fileClassifier';
import { readFileContent } from './workspaceScanner';

export type ResolutionStatus =
  | 'resolved'
  | 'not_found'
  | 'outside_workspace'
  | 'binary_skipped'
  | 'too_large'
  | 'permission_denied';

export interface FileReference {
  /** The exact text that matched — useful for provenance */
  referenceText: string;
  /** The form of the reference */
  form: 'quoted_path' | 'mention' | 'file_uri';
}

export interface ResolvedReference {
  reference: FileReference;
  status: ResolutionStatus;
  /** Absolute path if resolved; null otherwise */
  absolutePath: string | null;
  /** Workspace-relative path, forward slashes */
  relativePath: string | null;
  sizeBytes: number | null;
  type: FileType | null;
  language?: string;
  /** File content as UTF-8 (null for binary/unreadable) */
  content: string | null;
  /** True if content was truncated */
  truncated: boolean;
  /** Explanatory note — shown to humans on failure */
  note?: string;
}

export interface ReferenceResolverOptions {
  /** Max content bytes to include per file (default 256KB) */
  maxContentBytes?: number;
  /** Max overall file size to accept (default 5MB) */
  maxFileSizeBytes?: number;
}

const DEFAULT_MAX_CONTENT = 256 * 1024;
const DEFAULT_MAX_FILE = 5 * 1024 * 1024;

/**
 * Detect all file references in the given text.
 * Returns references in document order.
 */
export function detectReferences(text: string): FileReference[] {
  const results: FileReference[] = [];

  // 1) file:// URIs — match first so they're not consumed by quoted-path
  const fileUriRegex = /file:\/\/\S+/g;
  for (const m of text.matchAll(fileUriRegex)) {
    results.push({ referenceText: m[0], form: 'file_uri' });
  }

  // 2) Double-quoted strings that look like paths
  //    "..." where contents has at least one path separator or a file extension
  const quotedRegex = /"([^"\n\r]+)"/g;
  for (const m of text.matchAll(quotedRegex)) {
    const inner = m[1];
    if (looksLikePath(inner)) {
      results.push({ referenceText: inner, form: 'quoted_path' });
    }
  }

  // 3) @mention paths — @path/to/file.ext (stop at whitespace / common punctuation)
  const mentionRegex = /(?:^|\s)@([^\s"',;:!?]+)/g;
  for (const m of text.matchAll(mentionRegex)) {
    const inner = m[1];
    if (looksLikePath(inner) || hasFileExtension(inner)) {
      results.push({ referenceText: inner, form: 'mention' });
    }
  }

  return results;
}

/**
 * Resolve a single reference against the workspace. Reads content if
 * the file is text and within size limits.
 */
export function resolveReference(
  ref: FileReference,
  workspaceRoot: string,
  options: ReferenceResolverOptions = {},
): ResolvedReference {
  const maxContent = options.maxContentBytes ?? DEFAULT_MAX_CONTENT;
  const maxFile = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE;

  const raw = ref.referenceText;
  let candidatePath: string;

  try {
    if (ref.form === 'file_uri') {
      const url = new URL(raw);
      candidatePath = url.protocol === 'file:'
        ? decodeURIComponent(url.pathname.replace(/^\/([a-zA-Z]):/, '$1:'))
        : raw;
    } else {
      // Normalize Windows-style separators and strip any trailing punctuation
      candidatePath = raw.replaceAll('\\', '/').replace(/[).,;:!?]+$/, '');
    }
  } catch {
    return failure(ref, 'not_found', 'Could not parse reference as a path or URI');
  }

  // Absolute? Otherwise resolve relative to workspace
  const absolutePath = path.isAbsolute(candidatePath)
    ? path.normalize(candidatePath)
    : path.resolve(workspaceRoot, candidatePath);

  // Containment check — don't let references escape the workspace
  const normalizedWorkspace = path.resolve(workspaceRoot);
  if (!isPathInside(absolutePath, normalizedWorkspace)) {
    return failure(ref, 'outside_workspace',
      `Reference resolves outside the workspace (${absolutePath})`);
  }

  if (!fs.existsSync(absolutePath)) {
    // Try case-insensitive lookup and common extensions (.md first)
    const retry = tryCommonVariations(workspaceRoot, candidatePath);
    if (retry) {
      return resolveReference({ ...ref, referenceText: retry }, workspaceRoot, options);
    }
    return failure(ref, 'not_found', `File does not exist at ${absolutePath}`);
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolutePath);
  } catch (err) {
    return failure(ref, 'permission_denied',
      err instanceof Error ? err.message : String(err));
  }

  if (!stat.isFile()) {
    return failure(ref, 'not_found', `Path exists but is not a regular file (${absolutePath})`);
  }

  if (stat.size > maxFile) {
    return {
      reference: ref,
      status: 'too_large',
      absolutePath,
      relativePath: path.relative(workspaceRoot, absolutePath).replaceAll('\\', '/'),
      sizeBytes: stat.size,
      type: classifyFile(absolutePath).type,
      content: null,
      truncated: false,
      note: `File size ${stat.size} exceeds max ${maxFile}`,
    };
  }

  const classification = classifyFile(absolutePath);
  if (!classification.isText) {
    return {
      reference: ref,
      status: 'binary_skipped',
      absolutePath,
      relativePath: path.relative(workspaceRoot, absolutePath).replaceAll('\\', '/'),
      sizeBytes: stat.size,
      type: classification.type,
      language: classification.language,
      content: null,
      truncated: false,
      note: 'Binary file — content not read',
    };
  }

  const read = readFileContent({
    absolutePath,
    relativePath: path.relative(workspaceRoot, absolutePath).replaceAll('\\', '/'),
    name: path.basename(absolutePath),
    sizeBytes: stat.size,
    type: classification.type,
    language: classification.language,
    isText: classification.isText,
  }, maxContent);

  if (!read) {
    return failure(ref, 'permission_denied', 'Failed to read file content');
  }

  return {
    reference: ref,
    status: 'resolved',
    absolutePath,
    relativePath: path.relative(workspaceRoot, absolutePath).replaceAll('\\', '/'),
    sizeBytes: stat.size,
    type: classification.type,
    language: classification.language,
    content: read.content,
    truncated: read.truncated,
  };
}

/**
 * Convenience — detect and resolve all references in raw text.
 * Returns empty array if no references were found.
 */
export function resolveAllReferences(
  text: string,
  workspaceRoot: string,
  options: ReferenceResolverOptions = {},
): ResolvedReference[] {
  const refs = detectReferences(text);
  const seen = new Set<string>();
  const resolved: ResolvedReference[] = [];

  for (const ref of refs) {
    // Dedupe by normalized text
    const key = ref.referenceText.replaceAll('\\', '/').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push(resolveReference(ref, workspaceRoot, options));
  }

  return resolved;
}

// ── Helpers ────────────────────────────────────────────────────────

function looksLikePath(s: string): boolean {
  if (s.length < 2 || s.length > 500) return false;
  // Must contain a path separator OR a dot-extension
  if (!/[/\\]/.test(s) && !/\.[a-zA-Z0-9]{1,8}($|[^a-zA-Z0-9])/.test(s)) return false;
  // Reject URLs (http://, https://) unless they're file://
  if (/^https?:\/\//i.test(s)) return false;
  // Reject if it contains common sentence punctuation
  if (/[?]{2,}|!{2,}/.test(s)) return false;
  return true;
}

function hasFileExtension(s: string): boolean {
  return /\.[a-zA-Z0-9]{1,8}$/.test(s);
}

function isPathInside(candidate: string, parent: string): boolean {
  const rel = path.relative(parent, candidate);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function failure(
  ref: FileReference,
  status: ResolutionStatus,
  note: string,
): ResolvedReference {
  return {
    reference: ref,
    status,
    absolutePath: null,
    relativePath: null,
    sizeBytes: null,
    type: null,
    content: null,
    truncated: false,
    note,
  };
}

/**
 * Try common path variations for a missing reference.
 * Returns the first match or null.
 */
function tryCommonVariations(workspaceRoot: string, candidatePath: string): string | null {
  // Try adding .md extension
  const withMd = candidatePath + '.md';
  if (fs.existsSync(path.resolve(workspaceRoot, withMd))) return withMd;

  // Try case-insensitive match in the parent directory
  const dir = path.dirname(candidatePath);
  const base = path.basename(candidatePath).toLowerCase();
  const absDir = path.resolve(workspaceRoot, dir);
  try {
    if (fs.existsSync(absDir)) {
      const entries = fs.readdirSync(absDir);
      for (const entry of entries) {
        if (entry.toLowerCase() === base) {
          return path.join(dir, entry).replaceAll('\\', '/');
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}
