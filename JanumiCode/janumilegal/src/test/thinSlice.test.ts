import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runThinSlice, parseSpec, type ThinSliceSpec } from '../lib/calibration/thinSlice.js';

const SPEC_PATH = path.resolve(__dirname, '..', '..', 'test-and-evaluation', 'thin-slice-specs', 'single_issue_access_denial.md');

describe('thin-slice spec parser', () => {
  it('parses the canonical spec', () => {
    const spec = parseSpec(SPEC_PATH);
    expect(spec.handle).toBe('single_issue_access_denial');
    expect(spec.title).toMatch(/Single-Issue Access Denial/);
    expect(spec.jurisdiction).toBe('Maryland, Anne Arundel County.');
    expect(spec.matterType).toBe('custody_visitation_enforcement');
    expect(spec.expectedPrimaryLens).toBe('family_law_production_lens');
    expect(spec.expectedSecondaryLenses).toContain('client_advice_draft_lens');
    expect(spec.clientMessage).toMatch(/did not let me see my son/);
  });
});

describe('thin-slice runner — structural mode', () => {
  let workspaceRoot: string;
  let spec: ThinSliceSpec;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-thin-'));
    spec = parseSpec(SPEC_PATH);
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('runs all 11 Family Law states end to end and emits a summary', async () => {
    const result = await runThinSlice({ workspaceRoot, spec });
    expect(result.capturedStates).toHaveLength(11);
    expect(result.opTrackEventCount).toBeGreaterThan(0);
    expect(result.matterTrackEventCount).toBeGreaterThanOrEqual(0);
    expect(fs.existsSync(result.summaryPath)).toBe(true);
    expect(fs.existsSync(result.platformDbPath)).toBe(true);
    expect(fs.existsSync(result.matterTrackDbPath)).toBe(true);
    const summary = JSON.parse(fs.readFileSync(result.summaryPath, 'utf8')) as { statesCompleted: number; sliceNumber: number };
    expect(summary.statesCompleted).toBe(11);
    expect(summary.sliceNumber).toBe(1);
  });

  it('numbers workspaces sequentially', async () => {
    const r1 = await runThinSlice({ workspaceRoot, spec });
    const r2 = await runThinSlice({ workspaceRoot, spec });
    expect(r1.workspacePath).toMatch(/thin-slice-workspace-1$/);
    expect(r2.workspacePath).toMatch(/thin-slice-workspace-2$/);
    // Each gets its own firm/client/matter id
    expect(r1.firmId).not.toBe(r2.firmId);
    expect(r1.activationId).not.toBe(r2.activationId);
  });

  it('captured state outputs reflect Family Law shape (issue prune retains, conclusion requires attorney review)', async () => {
    const result = await runThinSlice({ workspaceRoot, spec });
    const byState = new Map(result.capturedStates.map((s) => [s.stateId, s]));
    const issuePrune = byState.get('IssuePrune');
    expect(issuePrune).toBeDefined();
    const prune = JSON.parse(issuePrune!.outputJson) as { pruning_decisions: Array<{ decision: string; reason: string }> };
    expect(prune.pruning_decisions.length).toBeGreaterThan(0);
    expect(prune.pruning_decisions[0].decision).toBe('retain');
    expect(prune.pruning_decisions[0].reason.length).toBeGreaterThan(0);

    const conclusion = byState.get('DirectLegalConclusionDraft');
    const concl = JSON.parse(conclusion!.outputJson) as { attorney_review_required: boolean };
    expect(concl.attorney_review_required).toBe(true);
  });
});
