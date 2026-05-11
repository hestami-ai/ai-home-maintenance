import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { listGoldMatters, loadGoldMatter } from '../lib/calibration/loader.js';
import { AssertionRunner, computeHardGateBreaches } from '../lib/calibration/assertionRunner.js';

const GOLD_DIR = path.resolve(__dirname, '..', '..', 'calibration', 'gold');

describe('Wave 5 calibration scaffold', () => {
  it('discovers at least the seed gold matter', () => {
    const dirs = listGoldMatters(GOLD_DIR);
    expect(dirs.length).toBeGreaterThan(0);
    expect(dirs.some((d) => d.endsWith('JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001'))).toBe(true);
  });

  it('seed gold matter parses and has the 22 required states', () => {
    const root = path.join(GOLD_DIR, 'JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001');
    const gm = loadGoldMatter(root);
    expect(gm.metadata.testCaseId).toBe('JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001');
    expect(gm.requiredStates).toHaveLength(22);
    expect(gm.requiredStates[0]).toBe('MatterContextNormalize');
    expect(gm.requiredStates[gm.requiredStates.length - 1]).toBe('GovernedStreamFinalize');
  });

  it('seed gold matter passes its own assertion set (self-consistency)', () => {
    const root = path.join(GOLD_DIR, 'JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001');
    const gm = loadGoldMatter(root);
    const snap = AssertionRunner.snapshotFromGoldMatter(gm);
    const results = new AssertionRunner().run(snap, gm.assertions.assertions);
    const failures = results.filter((r) => r.status === 'fail');
    if (failures.length > 0) {
      throw new Error('seed gold matter self-consistency failures:\n' + failures.map((f) => `  ${f.assertionId}: ${f.reason}`).join('\n'));
    }
    expect(failures).toHaveLength(0);
  });

  it('seed gold matter encodes all 6 source-doc failure traps', () => {
    const root = path.join(GOLD_DIR, 'JLEGAL-FL-MD-CUSTODY-ENFORCEMENT-001');
    const gm = loadGoldMatter(root);
    expect(gm.failureTraps).toHaveLength(6);
    const ids = gm.failureTraps.map((t) => t.id);
    expect(ids).toContain('trap_1_support_dispute_treated_as_defense_for_withholding');
    expect(ids).toContain('trap_4_client_advice_sent_without_attorney_approval');
    expect(ids).toContain('trap_6_authority_marked_attorney_confirmed_when_only_machine_assessed');
  });

  it('hard-gate metric breaches are detected', () => {
    expect(
      computeHardGateBreaches({
        requiredStateCompletionRate: 1,
        issueBloomLateAdditionRate: 0.1, // breach
        silentPruningRate: 0,
        falseConfidenceRate: 0,
        crossMatterLeakageBytes: 0,
        releaseGateCorrectness: 1,
      }).length,
    ).toBeGreaterThanOrEqual(1);

    expect(
      computeHardGateBreaches({
        requiredStateCompletionRate: 1,
        issueBloomLateAdditionRate: 0,
        silentPruningRate: 0,
        falseConfidenceRate: 0,
        crossMatterLeakageBytes: 0,
        releaseGateCorrectness: 1,
      }),
    ).toEqual([]);
  });
});
