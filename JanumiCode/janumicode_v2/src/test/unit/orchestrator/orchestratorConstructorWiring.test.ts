/**
 * Characterization tests for the OrchestratorEngine constructor's review-harness
 * and json-repair wiring, extracted into configureReviewHarness /
 * configureJsonRepair for the S3776 decomposition.
 *
 * These wiring branches are otherwise dark under vitest: reviewEnabled is false
 * by default (VITEST='true' → the auto-disable else branch), and json_repair is
 * absent from DEFAULT_CONFIG. This test forces both branches to RUN and pins
 * that construction still succeeds (the helpers reference valid symbols and run
 * in order — the risk a mechanical extraction introduces).
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';

describe('OrchestratorEngine constructor — review/json-repair wiring (characterization)', () => {
  const extensionPath = path.resolve(__dirname, '..', '..', '..', '..');
  const prevReview = process.env.JANUMICODE_REVIEW_ENABLED;

  afterEach(() => {
    if (prevReview === undefined) delete process.env.JANUMICODE_REVIEW_ENABLED;
    else process.env.JANUMICODE_REVIEW_ENABLED = prevReview;
  });

  it('constructs without throwing when the review-harness + json-repair wiring branches both run', () => {
    process.env.JANUMICODE_REVIEW_ENABLED = 'true'; // force configureReviewHarness wiring branch
    const db = createTestDatabase();
    const configManager = new ConfigManager();
    // DEFAULT_CONFIG has no json_repair slot; add one to force the
    // configureJsonRepair wiring branch (setJsonRepairRouting).
    configManager.getLLMRouting().json_repair = {
      primary: { provider: 'llamacpp', model: 'gpt-oss:20b' },
      fallback: { provider: 'ollama', model: 'gpt-oss:20b' },
      temperature: 0,
      fallback_temperature: 0,
    };
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));
    let engine: OrchestratorEngine | undefined;
    expect(() => {
      engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
    }).not.toThrow();
    expect(engine).toBeDefined();
    db.close();
  });

  it('constructs without throwing when review is explicitly disabled (early-return branch)', () => {
    process.env.JANUMICODE_REVIEW_ENABLED = 'false'; // configureReviewHarness returns early
    const db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));
    expect(() => new OrchestratorEngine(db, configManager, workspacePath, extensionPath)).not.toThrow();
    db.close();
  });
});
