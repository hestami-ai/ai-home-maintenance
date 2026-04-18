/**
 * Regression tests for callForRole CLI-backing text extraction and
 * JSON recovery.
 *
 * Pins the failure mode observed in the live Gemini run:
 *   1. Gemini CLI emits plain text (not stream-json), so the per-line
 *      parser can't structure events. extractFinalText's
 *      `data.type === 'text'` filter matched nothing and returned ''.
 *   2. Stock JSON.parse then rejected the empty string and the
 *      Orchestrator fell through to a default "pass" verdict — the
 *      Intent Quality Check never actually ran.
 *
 * The fix routes the raw stdoutText (captured by CLIInvoker
 * unconditionally) into parseJsonWithRecovery, which handles
 * markdown code fences, trailing commas, and single-quoted strings.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';

describe('callForRole — CLI text extraction via stdoutText', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    engine.registerBuiltinCLIParsers();
    engine.configManager.setOrchestratorRouting({
      primary: { backing_tool: 'gemini_cli', model: 'gemini-2.5-flash' },
    });
  });

  afterEach(() => { db.close(); });

  function stubCli(stdout: string, events: unknown[] = []): void {
    const spy = vi.fn().mockResolvedValue({
      exitCode: 0, timedOut: false, idledOut: false,
      events,
      stdoutText: stdout,
      stderr: '',
      durationMs: 1,
    });
    (engine.agentInvoker as unknown as { cliInvoker: { invoke: unknown } })
      .cliInvoker.invoke = spy;
  }

  it('parses Gemini plain-text JSON output via stdoutText (the Phase 1.0 IQC failure mode)', async () => {
    // Exactly what Gemini emitted on the real Hestami run — plain
    // JSON, no stream-json envelope. Per-line parser couldn't
    // structure it; stdoutText captures the whole thing losslessly.
    const stdout = `{
  "completeness_findings": [
    {"field": "what is being built", "status": "absent", "severity": "high", "explanation": "The raw intent only references an external spec file."}
  ],
  "consistency_findings": [],
  "coherence_findings": [],
  "overall_status": "requires_input",
  "system_proposal_offered_for": ["what is being built"]
}`;
    stubCli(stdout);

    const result = await engine.callForRole('orchestrator', {
      prompt: 'IQC prompt body',
      responseFormat: 'json',
    });

    expect(result.text).toBe(stdout);
    expect(result.parsed).not.toBeNull();
    expect(result.parsed?.overall_status).toBe('requires_input');
    const findings = result.parsed?.completeness_findings as Array<{ field: string }>;
    expect(findings).toHaveLength(1);
    expect(findings[0].field).toBe('what is being built');
  });

  it('recovers markdown-fenced JSON from Gemini stdout (```json ... ```)', async () => {
    // Gemini occasionally wraps JSON in fences even when the prompt
    // says "return JSON only". parseJsonWithRecovery.extractJsonObject
    // already handles this; the test pins that the CLI path calls it.
    const stdout = '```json\n{"overall_status":"pass","completeness_findings":[]}\n```';
    stubCli(stdout);

    const result = await engine.callForRole('orchestrator', {
      prompt: 'IQC prompt',
      responseFormat: 'json',
    });
    expect(result.parsed?.overall_status).toBe('pass');
  });

  it('recovers JSON with trailing commas from CLI stdout (qwen/gemini pathology)', async () => {
    const stdout = `{
  "completeness_findings": [
    {"field": "x", "status": "present", "severity": "low", "explanation": "ok",},
  ],
  "consistency_findings": [],
  "coherence_findings": [],
  "overall_status": "pass",
}`;
    stubCli(stdout);

    const result = await engine.callForRole('orchestrator', {
      prompt: 'IQC prompt',
      responseFormat: 'json',
    });
    expect(result.parsed?.overall_status).toBe('pass');
    const findings = result.parsed?.completeness_findings as Array<{ field: string }>;
    expect(findings).toHaveLength(1);
  });

  it('falls back to extractFinalText when stdoutText is absent (older CLI invoker mocks)', async () => {
    // Some tests stub `cliInvoker.invoke` without stdoutText. The
    // extractFinalText path must still work for them — otherwise
    // every existing CLI-backing test would break on this refactor.
    const spy = vi.fn().mockResolvedValue({
      exitCode: 0, timedOut: false, idledOut: false,
      events: [
        {
          recordType: 'agent_reasoning_step',
          data: { type: 'text', text: '{"overall_status":"pass"}' },
          isSelfCorrection: false, sequencePosition: 0,
        },
      ],
      stderr: '',
      durationMs: 1,
      // Note: NO stdoutText field.
    });
    (engine.agentInvoker as unknown as { cliInvoker: { invoke: unknown } })
      .cliInvoker.invoke = spy;

    const result = await engine.callForRole('orchestrator', {
      prompt: 'p',
      responseFormat: 'json',
    });
    expect(result.parsed?.overall_status).toBe('pass');
  });

  it('returns parsed:null (not thrown) when stdout has no recoverable JSON', async () => {
    // Not every CLI call returns JSON — responseFormat='text' callers
    // just want the raw string. And a malformed JSON response should
    // still round-trip text, not throw; the caller decides how to
    // react. The engine's "throw on non-zero exit" guard stays
    // separate from the parse path.
    stubCli('just a plain text response with no braces');

    const result = await engine.callForRole('orchestrator', {
      prompt: 'p',
      responseFormat: 'json',
    });
    expect(result.text).toContain('plain text response');
    expect(result.parsed).toBeNull();
  });
});
