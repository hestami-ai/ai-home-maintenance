/**
 * Regression: OrchestratorEngine must load schemas, invariants, and prompt
 * templates from the EXTENSION root, not from the user's workspace.
 *
 * Background: on 2026-04-11 Phase 0 failed with
 *   "workspace_classification schema validation failed:
 *    No schema found for artifact type: workspace_classification"
 * in the dev host against an empty test-workspace folder. Root cause: the
 * engine was constructing SchemaValidator (and TemplateLoader, and
 * InvariantChecker) with `workspacePath` instead of the extension root.
 * The schemas live at `<extension>/.janumicode/schemas/artifacts/` — they
 * ship with the extension and define JanumiCode's own data format — so
 * pointing the validator at the user's workspace folder (which has none of
 * those files) guaranteed every Phase 0 validation would throw
 * "No schema found".
 *
 * The engine's constructor now takes both paths:
 *   new OrchestratorEngine(db, config, workspacePath, extensionPath)
 * and uses extensionPath for schemas / invariants / templates while still
 * using workspacePath for detail files, the database, and config overrides.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import type { Database } from '../../../lib/database/init';
import { createTestDatabase } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';

/**
 * The extension root of this repo — the place schemas actually live.
 * Test files are at src/test/unit/orchestrator/, so walk up 4 levels.
 */
const EXTENSION_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('OrchestratorEngine schema path resolution', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('pass-to-pass: engine loads workspace_classification schema when extensionPath is set', () => {
    // Simulate the production wiring: a separate, EMPTY workspace folder
    // (like test-workspace/) with the schemas living at the real extension
    // root. The engine must load schemas from extensionPath.
    const emptyWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'janumi-ws-'));
    try {
      const configManager = new ConfigManager();
      const engine = new OrchestratorEngine(
        db,
        configManager,
        emptyWorkspace,
        EXTENSION_ROOT,
      );

      // The critical assertion: the schema the user hit in the failing log
      // (workspace_classification) must actually be loaded.
      expect(engine.schemaValidator.hasSchema('workspace_classification')).toBe(true);

      // And validate() must not return the "No schema found" sentinel.
      const result = engine.schemaValidator.validate('workspace_classification', {
        workspace_type: 'greenfield',
        vocabulary_collisions: [],
      });
      expect(
        result.errors.some((e) => e.keyword === 'schema_missing'),
        'schema_missing keyword means the validator never found a schema file',
      ).toBe(false);
    } finally {
      fs.rmSync(emptyWorkspace, { recursive: true, force: true });
    }
  });

  it('fail-to-pass: engine fails to load schemas when extensionPath defaults to an empty workspace', () => {
    // Reproduce the bug: no extensionPath argument → constructor defaults
    // to using workspacePath for schemas. With an empty workspace, the
    // validator will have zero schemas loaded and hasSchema() returns false
    // for every artifact type.
    const emptyWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'janumi-ws-'));
    try {
      const configManager = new ConfigManager();
      const engine = new OrchestratorEngine(db, configManager, emptyWorkspace);
      // No 4th arg → extensionPath defaults to workspacePath.

      expect(engine.schemaValidator.hasSchema('workspace_classification')).toBe(false);

      const result = engine.schemaValidator.validate('workspace_classification', {});
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.keyword === 'schema_missing'),
        'fallback workspacePath=extensionPath with empty workspace must hit schema_missing',
      ).toBe(true);
    } finally {
      fs.rmSync(emptyWorkspace, { recursive: true, force: true });
    }
  });

  it('every .janumicode/schemas/artifacts/*.schema.json file on disk loads into the validator', () => {
    const configManager = new ConfigManager();
    const engine = new OrchestratorEngine(
      db,
      configManager,
      EXTENSION_ROOT,
      EXTENSION_ROOT,
    );

    const schemasDir = path.join(EXTENSION_ROOT, '.janumicode', 'schemas', 'artifacts');
    const files = fs.readdirSync(schemasDir).filter((f) => f.endsWith('.schema.json'));
    const expectedTypes = files.map((f) => f.replace(/\.schema\.json$/, ''));

    const loaded = engine.schemaValidator.getLoadedSchemas();
    const missing = expectedTypes.filter((t) => !loaded.includes(t));

    expect(
      missing,
      `These schema files exist on disk but are not loaded by the validator: ${missing.join(', ')}`,
    ).toEqual([]);
  });
});
