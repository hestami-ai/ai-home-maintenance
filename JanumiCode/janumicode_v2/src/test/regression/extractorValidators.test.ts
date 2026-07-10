/**
 * Characterization tests for extractValidators (Tier B fixture extractor).
 *
 * These pin the CURRENT observable orchestration behavior of
 * `extractValidators` so a cognitive-complexity refactor (decomposition
 * into helper functions) cannot change it. They deliberately exercise the
 * control-flow paths that do NOT require a full producer/validator fixture:
 *   - de-duplication of the requested validator list,
 *   - the "no template found" skip reason + result shape,
 *   - output-dir creation,
 *   - propagation of the "No workflow_runs found" error (thrown BEFORE the
 *     per-validator try/catch, so it must NOT be swallowed),
 *   - the empty-result path when no validators fired for the run.
 *
 * The happy path (fixture build + write) delegates to already-covered pure
 * helpers (determineBucket / inspectBaseline / buildValidatorAssertions /
 * FixtureSchema) and is straight-line code; it is not re-pinned here.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Database from 'better-sqlite3';

import { extractValidators } from './extractorValidators.js';

let tmpDir: string;

/**
 * Create a minimal WAL-mode SQLite DB matching the columns extractValidators
 * reads. WAL + checkpoint mirrors production DBs so the readonly
 * `PRAGMA journal_mode = WAL` inside extractValidators is a no-op read.
 */
function makeDb(name: string, workflowRuns: string[]): string {
  const dbPath = path.join(tmpDir, name);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE workflow_runs (id TEXT PRIMARY KEY);
    CREATE TABLE governed_stream (
      id TEXT,
      record_type TEXT,
      produced_by_agent_role TEXT,
      workflow_run_id TEXT,
      derived_from_record_ids TEXT,
      produced_at TEXT,
      content TEXT
    );
  `);
  const stmt = db.prepare('INSERT INTO workflow_runs (id) VALUES (?)');
  for (const id of workflowRuns) stmt.run(id);
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
  return dbPath;
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-extractvalidators-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('extractValidators — orchestration characterization', () => {
  it('de-duplicates targets and skips a validator with no matching template', async () => {
    const dbPath = makeDb('no-template.db', ['run-1']);
    const outDir = path.join(tmpDir, 'out-no-template');

    const result = await extractValidators({
      dbPath,
      outputDir: outDir,
      // duplicate id must collapse to a single skip entry via Set de-dup
      validators: ['__no_such_validator__', '__no_such_validator__'],
      workflowRunId: 'run-1',
      overwrite: true,
    });

    expect(result.written).toEqual([]);
    expect(result.skipped).toEqual([
      {
        reason: 'no template found at agent_role=harness sub_phase=__no_such_validator__',
        validator_id: '__no_such_validator__',
      },
    ]);
    // output dir is created up-front regardless of outcome
    expect(fs.existsSync(outDir)).toBe(true);
  });

  it('propagates (does not swallow) the missing-workflow_runs error', async () => {
    const dbPath = makeDb('empty-runs.db', []);

    await expect(
      extractValidators({
        dbPath,
        outputDir: path.join(tmpDir, 'out-empty-runs'),
        validators: 'all',
      }),
    ).rejects.toThrow('No workflow_runs found in DB');
  });

  it('returns an empty result when no validators fired for the run', async () => {
    const dbPath = makeDb('no-fired.db', ['run-1']);

    const result = await extractValidators({
      dbPath,
      outputDir: path.join(tmpDir, 'out-no-fired'),
      validators: 'all',
      workflowRunId: 'run-1',
    });

    expect(result).toEqual({ written: [], skipped: [] });
  });
});
