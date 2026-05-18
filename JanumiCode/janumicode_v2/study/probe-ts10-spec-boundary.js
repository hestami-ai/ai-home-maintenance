/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const dbPath = path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-10/.janumicode/test-harness/1778618103737.db');
const db = new Database(dbPath, { readonly: true });
const run = db.prepare('SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1').get();

console.log('=== spec_boundary_respect_bloom HIGH findings ===\n');
const rows = db.prepare(`
  SELECT id, content, produced_at FROM governed_stream
   WHERE workflow_run_id=? AND record_type='reasoning_review_finding_record' AND is_current_version=1
     AND json_extract(content, '$.validator_id')='spec_boundary_respect_bloom'
     AND json_extract(content, '$.severity')='HIGH'
   ORDER BY produced_at ASC
`).all(run.id);

for (const r of rows) {
  const c = JSON.parse(r.content);
  console.log(`[${r.produced_at}] ${r.id}`);
  console.log(`  type            : ${c.finding_type ?? c.type}`);
  console.log(`  summary         : ${(c.summary ?? '').slice(0, 90)}`);
  console.log(`  target_field    : ${JSON.stringify(c.target_field)}`);
  console.log(`  target_identifier: ${JSON.stringify(c.target_identifier)}`);
  console.log(`  location        : ${c.location ?? '(none)'}`);
  console.log('');
}

console.log(`\n=== ALL fields seen on any spec_boundary HIGH finding ===`);
const fieldSet = new Set();
for (const r of rows) {
  const c = JSON.parse(r.content);
  for (const k of Object.keys(c)) fieldSet.add(k);
}
console.log([...fieldSet].sort().join(', '));

console.log(`\n=== Lookup the harness records that fed these findings ===`);
const harnessRows = db.prepare(`
  SELECT id, content FROM governed_stream
   WHERE workflow_run_id=? AND record_type='reasoning_review_harness_record' AND is_current_version=1
     AND json_extract(content, '$.validator_id')='spec_boundary_respect_bloom'
   ORDER BY produced_at ASC LIMIT 3
`).all(run.id);
console.log(`found ${harnessRows.length} harness records for spec_boundary`);
for (const r of harnessRows) {
  const c = JSON.parse(r.content);
  console.log(`  harness ${r.id}: sub_phase=${c.sub_phase_id} validator=${c.validator_id} passed=${c.passed} findings_count=${(c.findings??[]).length}`);
}
