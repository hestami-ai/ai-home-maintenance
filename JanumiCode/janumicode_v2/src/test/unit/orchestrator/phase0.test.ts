/**
 * Phase 0 — Workspace Initialization integration tests.
 * Covers the Wave 7 enhancements:
 *   - 0.1  Real filesystem-aware workspace classification
 *   - 0.1b External Reference Resolution (new)
 *   - 0.2  Brownfield Artifact Ingestion (new)
 *   - 0.2b Brownfield Continuity Check (new)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestEngine, type TestEngine } from '../../helpers/createTestEngine';

let runCounter = 0;
async function runPhase0(te: TestEngine, rawIntent: string): Promise<string> {
  const runId = `test-run-${++runCounter}`;
  // Create a workflow run (already starts at Phase 0)
  te.engine.stateMachine.createWorkflowRun({
    id: runId,
    workspace_id: 'ws-1',
    janumicode_version_sha: 'abc',
  });

  // Write raw intent
  te.engine.writer.writeRecord({
    record_type: 'raw_intent_received',
    schema_version: '1.0',
    workflow_run_id: runId,
    janumicode_version_sha: 'abc',
    content: { text: rawIntent },
  });

  // Execute Phase 0
  await te.engine.executeCurrentPhase(runId);

  return runId;
}

function getArtifactsByKind(te: TestEngine, runId: string, kind: string): Array<Record<string, unknown>> {
  const rows = te.engine.writer.getRecordsByType(runId, 'artifact_produced');
  return rows
    .map(r => r.content as Record<string, unknown>)
    .filter(c => c.kind === kind);
}

describe('Phase 0 — Workspace Initialization', () => {
  let tmpWorkspace: string;
  let te: TestEngine;

  beforeEach(async () => {
    tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'phase0-ws-'));
    te = await createTestEngine({ workspacePath: tmpWorkspace, autoApprove: true });
  });

  afterEach(() => {
    te.cleanup();
    fs.rmSync(tmpWorkspace, { recursive: true, force: true });
  });

  describe('0.1 — Workspace Classification', () => {
    it('classifies empty workspace as greenfield', async () => {
      const runId = await runPhase0(te, 'Build a CLI todo app');
      const classifications = getArtifactsByKind(te, runId, 'workspace_classification');
      // workspace_classification doesn't set content.kind — check by structure instead
      const wsClass = te.engine.writer.getRecordsByType(runId, 'artifact_produced')
        .find(r => (r.content as Record<string, unknown>).workspace_type !== undefined);
      expect(wsClass).toBeDefined();
      expect((wsClass!.content as Record<string, unknown>).workspace_type).toBe('greenfield');
      void classifications; // not used via kind
    });

    it('classifies workspace with source files as brownfield', async () => {
      fs.mkdirSync(path.join(tmpWorkspace, 'src'));
      fs.writeFileSync(path.join(tmpWorkspace, 'src', 'index.ts'), 'export {};');

      const runId = await runPhase0(te, 'Add authentication');
      const wsClass = te.engine.writer.getRecordsByType(runId, 'artifact_produced')
        .find(r => (r.content as Record<string, unknown>).workspace_type !== undefined);
      expect((wsClass!.content as Record<string, unknown>).workspace_type).toBe('brownfield');
    });

    it('treats .janumicode-only workspace as greenfield', async () => {
      fs.mkdirSync(path.join(tmpWorkspace, '.janumicode'));
      fs.writeFileSync(path.join(tmpWorkspace, '.janumicode', 'config.json'), '{}');

      const runId = await runPhase0(te, 'Build something');
      const wsClass = te.engine.writer.getRecordsByType(runId, 'artifact_produced')
        .find(r => (r.content as Record<string, unknown>).workspace_type !== undefined);
      expect((wsClass!.content as Record<string, unknown>).workspace_type).toBe('greenfield');
    });
  });

  describe('0.1b — External Reference Resolution', () => {
    it('resolves and ingests a quoted markdown reference', async () => {
      fs.mkdirSync(path.join(tmpWorkspace, 'specs'));
      fs.writeFileSync(
        path.join(tmpWorkspace, 'specs', 'Product.md'),
        '# Hestami AI\n\nA real estate OS.',
      );

      const runId = await runPhase0(te,
        'Review "specs/Product.md" and prepare for implementation.');

      const ingested = getArtifactsByKind(te, runId, 'external_file_ingested');
      expect(ingested.length).toBe(1);
      expect(ingested[0].relative_path).toBe('specs/Product.md');
      expect(ingested[0].content).toContain('# Hestami AI');
      expect(ingested[0].ingested_via).toBe('explicit_reference');
      expect(ingested[0].file_type).toBe('spec');
    });

    it('does not write a record for a missing reference', async () => {
      const runId = await runPhase0(te,
        'Review "specs/Does-Not-Exist.md" and prepare for implementation.');

      const ingested = getArtifactsByKind(te, runId, 'external_file_ingested');
      expect(ingested.length).toBe(0);
    });

    it('rejects references that escape the workspace', async () => {
      // Create an outside file
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
      const outsideFile = path.join(outsideDir, 'secret.md');
      fs.writeFileSync(outsideFile, 'secret content');

      try {
        const runId = await runPhase0(te, `Review "${outsideFile}" now.`);
        const ingested = getArtifactsByKind(te, runId, 'external_file_ingested');
        expect(ingested.length).toBe(0);
      } finally {
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });

    it('handles multiple references and dedupes by path', async () => {
      fs.mkdirSync(path.join(tmpWorkspace, 'specs'));
      fs.writeFileSync(path.join(tmpWorkspace, 'specs', 'a.md'), '# A');
      fs.writeFileSync(path.join(tmpWorkspace, 'specs', 'b.md'), '# B');

      const runId = await runPhase0(te,
        'Merge "specs/a.md" with "specs/b.md". Note the conflicts in "specs/a.md" again.');

      const ingested = getArtifactsByKind(te, runId, 'external_file_ingested');
      expect(ingested.length).toBe(2);
      const paths = ingested.map(i => i.relative_path).sort();
      expect(paths).toEqual(['specs/a.md', 'specs/b.md']);
    });

    it('runs reference resolution even in greenfield workspace', async () => {
      // Greenfield = no source files, but the spec file still gets ingested
      fs.mkdirSync(path.join(tmpWorkspace, 'specs'));
      fs.writeFileSync(path.join(tmpWorkspace, 'specs', 'proposal.md'), '# Proposal');

      const runId = await runPhase0(te, 'Implement what is in "specs/proposal.md".');

      const wsClass = te.engine.writer.getRecordsByType(runId, 'artifact_produced')
        .find(r => (r.content as Record<string, unknown>).workspace_type !== undefined);
      expect((wsClass!.content as Record<string, unknown>).workspace_type).toBe('brownfield');
      // (because we just wrote a non-hidden file)

      const ingested = getArtifactsByKind(te, runId, 'external_file_ingested');
      expect(ingested.length).toBe(1);
      expect(ingested[0].ingested_via).toBe('explicit_reference');
    });

    it('classifies ingested files with correct file_type', async () => {
      fs.mkdirSync(path.join(tmpWorkspace, 'src'));
      fs.writeFileSync(path.join(tmpWorkspace, 'src', 'auth.ts'), 'export {};');
      fs.writeFileSync(path.join(tmpWorkspace, 'README.md'), '# Readme');

      const runId = await runPhase0(te,
        'Refactor "src/auth.ts" and update "README.md".');

      const ingested = getArtifactsByKind(te, runId, 'external_file_ingested');
      expect(ingested.length).toBe(2);
      const byPath = new Map(ingested.map(i => [i.relative_path, i]));
      expect(byPath.get('src/auth.ts')?.file_type).toBe('source');
      expect(byPath.get('src/auth.ts')?.language).toBe('typescript');
      expect(byPath.get('README.md')?.file_type).toBe('doc');
    });
  });

  describe('0.2 — Artifact Ingestion (brownfield)', () => {
    it('runs only on brownfield workspaces', async () => {
      // Greenfield — no 0.2 run
      const runId = await runPhase0(te, 'Build new app');

      const index = getArtifactsByKind(te, runId, 'ingested_artifact_index');
      expect(index.length).toBe(0);
    });

    it('writes an ingested_artifact_index with file type counts', async () => {
      // Create a small brownfield workspace
      fs.mkdirSync(path.join(tmpWorkspace, 'src'));
      fs.writeFileSync(path.join(tmpWorkspace, 'src', 'index.ts'), 'export {};');
      fs.writeFileSync(path.join(tmpWorkspace, 'README.md'), '# hi');
      fs.writeFileSync(path.join(tmpWorkspace, 'package.json'), '{}');

      const runId = await runPhase0(te, 'Update the authentication flow');

      const index = getArtifactsByKind(te, runId, 'ingested_artifact_index');
      expect(index.length).toBe(1);
      expect(index[0].total_files).toBeGreaterThanOrEqual(3);
      expect((index[0].files_by_type as Record<string, number>).source).toBeGreaterThanOrEqual(1);
      expect((index[0].files_by_type as Record<string, number>).doc).toBeGreaterThanOrEqual(1);
      expect((index[0].files_by_type as Record<string, number>).config).toBeGreaterThanOrEqual(1);
    });

    it('does not duplicate files already ingested via explicit_reference', async () => {
      fs.mkdirSync(path.join(tmpWorkspace, 'specs'));
      fs.writeFileSync(path.join(tmpWorkspace, 'specs', 'product.md'), '# P');
      fs.writeFileSync(path.join(tmpWorkspace, 'main.ts'), 'ok');

      const runId = await runPhase0(te, 'Implement "specs/product.md" in TypeScript.');

      const ingested = getArtifactsByKind(te, runId, 'external_file_ingested');
      // Filter for explicit_reference vs workspace_scan
      const explicit = ingested.filter(i => i.ingested_via === 'explicit_reference');
      const scan = ingested.filter(i => i.ingested_via === 'workspace_scan');

      expect(explicit.length).toBe(1);
      expect(explicit[0].relative_path).toBe('specs/product.md');

      // Workspace scan should ingest main.ts but NOT re-ingest product.md
      const scanPaths = scan.map(s => s.relative_path);
      expect(scanPaths).not.toContain('specs/product.md');
      expect(scanPaths).toContain('main.ts');
    });
  });

  describe('0.2b — Brownfield Continuity Check', () => {
    it('produces an empty prior_decision_summary when no prior runs exist', async () => {
      fs.writeFileSync(path.join(tmpWorkspace, 'main.ts'), 'ok');

      const runId = await runPhase0(te, 'Add auth');

      const summaries = getArtifactsByKind(te, runId, 'prior_decision_summary');
      expect(summaries.length).toBe(1);
      expect(summaries[0].total_prior_runs).toBe(0);
      expect(summaries[0].active_constraints).toEqual([]);
      expect(summaries[0].coverage_confidence).toBe(1.0);
    });

    it('does not run on greenfield workspaces', async () => {
      const runId = await runPhase0(te, 'Build new app');

      const summaries = getArtifactsByKind(te, runId, 'prior_decision_summary');
      expect(summaries.length).toBe(0);
    });
  });

  describe('0.4 — Vocabulary Collision Check', () => {
    it('always runs and produces a clean report for empty workspace', async () => {
      const runId = await runPhase0(te, 'Build something');

      const rec = te.engine.writer.getRecordsByType(runId, 'artifact_produced')
        .find(r => (r.content as Record<string, unknown>).overall_status === 'clean');
      expect(rec).toBeDefined();
    });
  });
});
