#!/usr/bin/env tsx
/**
 * Red-team corpus CI gate (Wave 13).
 *
 * Walks every fixture under `test-and-evaluation/red-team-corpus/`, runs
 * each through the source-admission pipeline, and asserts that the
 * actual decision matches the fixture's `expected_outcome` frontmatter.
 *
 * Exit codes:
 *   0 — all fixtures passed
 *   2 — corpus invalid (no fixtures found)
 *   3 — at least one fixture regressed
 */

import * as path from 'node:path';
import { loadCorpus } from '../src/lib/redTeam/corpusLoader.js';
import { SourceAdmissionPipeline, defaultSourceAdmissionValidators } from '../src/lib/redTeam/sourceAdmission.js';

const CORPUS_ROOT = path.resolve(__dirname, '..', 'test-and-evaluation', 'red-team-corpus');

async function main(): Promise<number> {
  const fixtures = loadCorpus(CORPUS_ROOT);
  if (fixtures.length === 0) {
    console.error('[red-team-corpus] no fixtures found at', CORPUS_ROOT);
    return 2;
  }
  const validators = await defaultSourceAdmissionValidators();
  const pipeline = new SourceAdmissionPipeline({ validators, enrichWithLlm: false });

  let pass = 0;
  let fail = 0;
  for (const f of fixtures) {
    const r = await pipeline.admit({ sourceId: f.attackId, content: f.content });
    const ok = r.decision === f.expectedOutcome;
    if (ok) {
      pass += 1;
      console.log(`  ok    ${f.attackFamily}/${f.attackId}  → ${r.decision}`);
    } else {
      fail += 1;
      console.log(`  FAIL  ${f.attackFamily}/${f.attackId}  expected=${f.expectedOutcome} actual=${r.decision}`);
      for (const finding of r.findings.slice(0, 3)) {
        console.log(`        finding: ${finding.severity} ${finding.type} — ${finding.message}`);
      }
    }
  }
  console.log(`\nred-team corpus: ${pass}/${pass + fail} fixtures passed`);
  return fail === 0 ? 0 : 3;
}

main().then((code) => process.exit(code));
