// One-shot fixture recapture script.
//
// Reads each <validator>__<sample>.response.txt under _debug/ and
// rewrites the matching fixtures/<validator>__<sample>.expected.json
// with the response's `passed` flag, finding count, and
// overallAssessment text. Designed to run AFTER the integration suite
// has produced fresh debug captures with the corrected provider
// config — so the rewritten fixtures reflect actual current behavior.
//
// Run from the repo root:  node src/test/integration/harness/_recapture-fixtures.mjs
//
// Skips fixtures that don't have a matching debug response (the test
// didn't run for that fixture). Skips final_synthesis fixtures (they
// have a different shape — recapture those manually if needed).

import * as fs from 'node:fs';
import * as path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const FIXTURES = path.join(HERE, 'fixtures');
const DEBUG = path.join(HERE, '_debug');

const fixtureFiles = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.expected.json'));
let updated = 0;
let skipped = 0;
const reasons = [];

for (const fname of fixtureFiles) {
  const slug = fname.replace(/\.expected\.json$/, '');
  const fixturePath = path.join(FIXTURES, fname);
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  if (fixture.kind === 'final_synthesis') {
    skipped++;
    reasons.push(`${slug}: skipped (final_synthesis kind)`);
    continue;
  }
  const respPath = path.join(DEBUG, `${slug}.response.txt`);
  if (!fs.existsSync(respPath)) {
    skipped++;
    reasons.push(`${slug}: skipped (no debug response)`);
    continue;
  }
  let response;
  try {
    response = JSON.parse(fs.readFileSync(respPath, 'utf8'));
  } catch (e) {
    skipped++;
    reasons.push(`${slug}: skipped (response not parseable: ${e.message})`);
    continue;
  }
  const newPassed = response.passed === true;
  const newCount = Array.isArray(response.findings) ? response.findings.length : 0;
  const newAssessment = typeof response.overallAssessment === 'string' ? response.overallAssessment : fixture.overallAssessment;

  const oldPassed = fixture.passed;
  const oldCount = fixture.expectedFindingCount;

  if (oldPassed === newPassed && oldCount === newCount && fixture.overallAssessment === newAssessment) {
    skipped++;
    reasons.push(`${slug}: unchanged`);
    continue;
  }

  fixture.passed = newPassed;
  fixture.expectedFindingCount = newCount;
  fixture.overallAssessment = newAssessment;
  fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
  updated++;
  reasons.push(`${slug}: passed ${oldPassed}→${newPassed}, count ${oldCount}→${newCount}`);
}

console.log(`updated ${updated}, skipped ${skipped}`);
for (const r of reasons) console.log(`  ${r}`);
