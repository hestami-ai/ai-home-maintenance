#!/usr/bin/env tsx
/**
 * Calibration runner — CI entry point.
 *
 * Per docs/calibration/gold_capture_protocol.md §8 §10.
 *
 * Discovers gold matters under calibration/gold/, runs each one's assertion
 * set, computes hard-gate metrics, emits regression_report.json, and exits
 * non-zero on any failure or hard-gate breach.
 *
 * Wave 5 runs assertions against the gold matter's own expected snapshot
 * (sanity scaffold). Wave 6 wires real activation execution and produces a
 * live snapshot to assert against.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { listGoldMatters, loadGoldMatter } from '../src/lib/calibration/loader.js';
import { AssertionRunner, buildRegressionReport, computeHardGateBreaches } from '../src/lib/calibration/assertionRunner.js';
import type { HardGateMetrics } from '../src/lib/calibration/types.js';

const ROOT = path.resolve(__dirname, '..');
const GOLD = path.join(ROOT, 'calibration', 'gold');
const OUT = path.join(ROOT, 'calibration', 'regression_report.json');

function main(): number {
  const dirs = listGoldMatters(GOLD);
  if (dirs.length === 0) {
    console.error(`no gold matters found under ${GOLD}`);
    return 2;
  }

  const runner = new AssertionRunner();
  const perGoldMatter = dirs.map((d) => {
    const gm = loadGoldMatter(d);
    const snapshot = AssertionRunner.snapshotFromGoldMatter(gm);
    const results = runner.run(snapshot, gm.assertions.assertions);
    return { testCaseId: gm.metadata.testCaseId, results, assertions: gm.assertions.assertions };
  });

  // Wave 5 hard-gate metrics: gold-self-consistency means a gold matter must
  // pass its own assertions against its own expected snapshot. Other metrics
  // are populated in Wave 6+ when real activations run.
  const allHardGatesPassed = perGoldMatter.every((g) => {
    const failedHardGates = g.results.filter((r) => {
      if (r.status !== 'fail') return false;
      const a = g.assertions.find((x) => x.id === r.assertionId);
      return a?.hardGate === true;
    });
    return failedHardGates.length === 0;
  });

  const hardGateMetrics: HardGateMetrics = {
    requiredStateCompletionRate: 1.0,
    issueBloomLateAdditionRate: 0,
    silentPruningRate: 0,
    falseConfidenceRate: 0,
    crossMatterLeakageBytes: 0,
    releaseGateCorrectness: allHardGatesPassed ? 1.0 : 0.0,
  };

  const report = buildRegressionReport({ perGoldMatter, hardGateMetrics });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log(`calibration: ${report.passed}/${report.goldSetSize} gold matters passed.`);
  if (report.failed > 0) {
    for (const g of report.perGoldMatter) {
      if (g.status === 'fail') {
        console.error(`  FAIL ${g.testCaseId}:`);
        for (const f of g.failures) console.error(`    ${f.assertionId}: ${f.reason}`);
      }
    }
  }
  const breaches = computeHardGateBreaches(hardGateMetrics);
  if (breaches.length > 0) {
    console.error(`hard-gate breaches:`);
    for (const b of breaches) console.error(`  ${b}`);
    return 1;
  }
  if (report.failed > 0) return 1;
  return 0;
}

process.exit(main());
