/**
 * Corpus Lock - Lock a corpus document to a specific JanumiCode version.
 *
 * Ensures reproducibility of test harness runs by:
 *   - Locking corpus SHA to JanumiCode version SHA
 *   - Associating fixture manifest with the corpus
 *   - Detecting drift between locked and current versions
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CorpusLock, FixtureManifest } from './types';

/**
 * Create a corpus lock for a document.
 */
export function createCorpusLock(
  corpusPath: string,
  janumicodeVersionSha: string,
  manifest: FixtureManifest,
): CorpusLock {
  const corpusContent = fs.readFileSync(corpusPath, 'utf-8');
  const corpusSha = hashContent(corpusContent);

  return {
    corpus_sha: corpusSha,
    janumicode_sha: janumicodeVersionSha,
    locked_at: new Date().toISOString(),
    manifest,
  };
}

/**
 * Save a corpus lock to disk.
 */
export function saveCorpusLock(lock: CorpusLock, lockPath: string): void {
  const dir = path.dirname(lockPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), 'utf-8');
}

/**
 * Load a corpus lock from disk.
 */
export function loadCorpusLock(lockPath: string): CorpusLock | null {
  if (!fs.existsSync(lockPath)) {
    return null;
  }
  const content = fs.readFileSync(lockPath, 'utf-8');
  return JSON.parse(content) as CorpusLock;
}

/**
 * Verify that a corpus still matches its lock.
 */
export function verifyCorpusLock(
  corpusPath: string,
  lock: CorpusLock,
): { valid: boolean; drift: string[] } {
  const drift: string[] = [];

  // Check corpus SHA
  const corpusContent = fs.readFileSync(corpusPath, 'utf-8');
  const currentCorpusSha = hashContent(corpusContent);
  if (currentCorpusSha !== lock.corpus_sha) {
    drift.push(`Corpus SHA changed from ${lock.corpus_sha} to ${currentCorpusSha}`);
  }

  // Check JanumiCode version
  const currentJanumicodeSha = getJanumicodeVersionSha();
  if (currentJanumicodeSha !== lock.janumicode_sha) {
    drift.push(`JanumiCode SHA changed from ${lock.janumicode_sha} to ${currentJanumicodeSha}`);
  }

  return {
    valid: drift.length === 0,
    drift,
  };
}

/**
 * Check if fixtures have drifted from the manifest.
 */
export function checkFixtureDrift(
  fixtureDir: string,
  manifest: FixtureManifest,
): { drifted: string[]; missing: string[] } {
  const drifted: string[] = [];
  const missing: string[] = [];

  for (const fixture of manifest.fixtures) {
    const fixturePath = path.join(fixtureDir, `${fixture.key}.json`);

    if (!fs.existsSync(fixturePath)) {
      missing.push(fixture.key);
      continue;
    }

    const content = fs.readFileSync(fixturePath, 'utf-8');

    // Check if prompt template hash matches
    const fixtureData = JSON.parse(content) as { prompt_template_hash?: string };
    if (fixtureData.prompt_template_hash !== fixture.prompt_template_hash) {
      drifted.push(fixture.key);
    }
  }

  return { drifted, missing };
}

/**
 * Get the current JanumiCode version SHA.
 *
 * In a real implementation, this would read from git or a version file.
 * For now, we use a placeholder that can be overridden via environment variable.
 */
export function getJanumicodeVersionSha(): string {
  // Try to get from environment
  const envSha = process.env.JANUMICODE_VERSION_SHA;
  if (envSha) {
    return envSha;
  }

  // Try to read from git (if available)
  try {
    // This would require git to be available
    // For now, return a placeholder
    return 'dev-' + hashContent(Date.now().toString()).slice(0, 8);
  } catch {
    return 'unknown';
  }
}

/**
 * Hash content using SHA-256.
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate a lock file path for a corpus.
 */
export function getCorpusLockPath(corpusPath: string): string {
  const corpusName = path.basename(corpusPath, path.extname(corpusPath));
  const corpusDir = path.dirname(corpusPath);
  return path.join(corpusDir, '.locks', `${corpusName}.lock.json`);
}

/**
 * Ensure corpus is locked, creating a lock if needed.
 */
export function ensureCorpusLock(
  corpusPath: string,
  janumicodeVersionSha: string,
  manifest: FixtureManifest,
): { lock: CorpusLock; isNew: boolean } {
  const lockPath = getCorpusLockPath(corpusPath);
  const existingLock = loadCorpusLock(lockPath);

  if (existingLock) {
    return { lock: existingLock, isNew: false };
  }

  const newLock = createCorpusLock(corpusPath, janumicodeVersionSha, manifest);
  saveCorpusLock(newLock, lockPath);
  return { lock: newLock, isNew: true };
}
