/**
 * Test Isolation - Ensure tests run in isolated environments.
 *
 * Provides:
 *   - Isolated database per test run
 *   - Workspace isolation
 *   - Cleanup after test completion
 *   - Parallel test support
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { initializeDatabase, type Database } from '../../lib/database/init';
import type { TestIsolationConfig } from './types';

export interface IsolatedTestEnvironment {
  testRunId: string;
  db: Database;
  dbPath: string;
  workspacePath: string;
  cleanup: () => void;
}

/**
 * Create an isolated test environment.
 */
export function createIsolatedEnvironment(config: Partial<TestIsolationConfig> = {}): IsolatedTestEnvironment {
  const testRunId = config.testRunId ?? generateTestRunId();
  const baseDir = config.dbPath
    ? path.dirname(config.dbPath)
    : path.join(os.tmpdir(), 'janumicode-test', testRunId);

  // Create directories
  const dbDir = path.join(baseDir, 'db');
  const workspacePath = path.join(baseDir, 'workspace');
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(workspacePath, { recursive: true });

  // Create isolated database
  const dbPath = path.join(dbDir, 'test.db');
  const db = initializeDatabase({ path: dbPath });

  const shouldCleanup = config.cleanup ?? true;

  return {
    testRunId,
    db,
    dbPath,
    workspacePath,
    cleanup: () => {
      if (shouldCleanup) {
        db.close();
        fs.rmSync(baseDir, { recursive: true, force: true });
      }
    },
  };
}

/**
 * Create multiple isolated environments for parallel tests.
 */
export function createParallelEnvironments(count: number): IsolatedTestEnvironment[] {
  const environments: IsolatedTestEnvironment[] = [];

  for (let i = 0; i < count; i++) {
    const env = createIsolatedEnvironment();
    environments.push(env);
  }

  return environments;
}

/**
 * Generate a unique test run ID.
 */
function generateTestRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `test-${timestamp}-${random}`;
}

/**
 * Run a test in an isolated environment.
 */
export async function withIsolation<T>(
  fn: (env: IsolatedTestEnvironment) => Promise<T>,
  config: Partial<TestIsolationConfig> = {},
): Promise<T> {
  const env = createIsolatedEnvironment(config);
  try {
    return await fn(env);
  } finally {
    env.cleanup();
  }
}

/**
 * Run multiple tests in parallel with isolation.
 */
export async function withParallelIsolation<T>(
  fns: Array<(env: IsolatedTestEnvironment) => Promise<T>>,
): Promise<T[]> {
  const environments = createParallelEnvironments(fns.length);

  try {
    const promises = fns.map((fn, i) => fn(environments[i]));
    return await Promise.all(promises);
  } finally {
    for (const env of environments) {
      env.cleanup();
    }
  }
}

/**
 * Create a test fixture workspace with sample files.
 */
export function createFixtureWorkspace(workspacePath: string, files: Record<string, string>): void {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(workspacePath, filePath);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
}

/**
 * Snapshot the current state of an isolated environment.
 */
export function snapshotEnvironment(env: IsolatedTestEnvironment): {
  dbPath: string;
  workspacePath: string;
  records: Array<{ record_type: string; produced_at: string }>;
} {
  const records = env.db.prepare(`
    SELECT record_type, produced_at
    FROM governed_stream
    ORDER BY produced_at
  `).all() as Array<{ record_type: string; produced_at: string }>;

  return {
    dbPath: env.dbPath,
    workspacePath: env.workspacePath,
    records,
  };
}

/**
 * Restore an environment from a snapshot.
 */
export function restoreFromSnapshot(
  snapshot: { dbPath: string; workspacePath: string },
  targetEnv: IsolatedTestEnvironment,
): void {
  // Copy database
  const dbContent = fs.readFileSync(snapshot.dbPath);
  targetEnv.db.close();
  fs.writeFileSync(targetEnv.dbPath, dbContent);
  targetEnv.db = initializeDatabase({ path: targetEnv.dbPath });

  // Copy workspace
  fs.rmSync(targetEnv.workspacePath, { recursive: true, force: true });
  fs.cpSync(snapshot.workspacePath, targetEnv.workspacePath, { recursive: true });
}
