#!/usr/bin/env node
/**
 * One-off surgical patch for cal-26: resolve the VV-LICENSE-MONITORING
 * blocking coverage gap so the run can resume from DB.
 *
 * The agent's nfr_bloom_skeleton output silently dropped VV-LICENSE-MONITORING
 * (it was in the input seed set but not traced to any NFR or absorbed into
 * unreached_seeds). The deterministic NFR coverage verifier correctly halted
 * Phase 2.2c with a blocking gap. NFR-009 (compliance monitoring of
 * statutory deadlines / voting / notices) is the natural home for license /
 * regulatory monitoring, so we patch the artifact_produced record to add the
 * missing trace, stamp an audit field marking the trace as system-patched,
 * and supersede the coverage_gap with a resolved version.
 *
 * The systemic fix is a deterministic post-processor between
 * nfr_bloom_skeleton and nfr_bloom_verifier (separate work item). This script
 * is a tactical unblock for cal-26; it should not be re-used as a pattern.
 *
 * Usage:
 *   node scripts/patch-cal26-vv-license-monitoring.js --db <path>
 *   node scripts/patch-cal26-vv-license-monitoring.js --db <path> --apply
 *   (default is --dry-run; pass --apply to actually mutate)
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const out = { apply: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--db') out.db = argv[++i];
    else if (argv[i] === '--apply') out.apply = true;
  }
  if (!out.db) { console.error('--db <path> required'); process.exit(2); }
  return out;
}

const args = parseArgs(process.argv);
if (!fs.existsSync(args.db)) { console.error(`db not found: ${args.db}`); process.exit(2); }

const db = new Database(args.db);
const NFR_ARTIFACT_ID = 'dfef6fc6-b9b4-4ffc-b7b1-7b1e65d9b51e';
const COVERAGE_GAP_ID = 'd8397c60-5579-4ec5-abba-731d6b418b09';
const MISSING_VV = 'VV-LICENSE-MONITORING';
const TARGET_NFR_ID = 'NFR-009';

console.error(`[patch] db: ${args.db}`);
console.error(`[patch] mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`);

// Verify the records are still in the expected state.
const nfrArtifact = db.prepare('SELECT * FROM governed_stream WHERE id = ?').get(NFR_ARTIFACT_ID);
if (!nfrArtifact) { console.error(`NFR artifact not found: ${NFR_ARTIFACT_ID}`); process.exit(3); }
if (nfrArtifact.is_current_version !== 1) {
  console.error(`NFR artifact is not the current version (already superseded?). Aborting.`);
  process.exit(3);
}
const nfrContent = JSON.parse(nfrArtifact.content);
const nfr009 = nfrContent.requirements.find((r) => r.id === TARGET_NFR_ID);
if (!nfr009) { console.error(`${TARGET_NFR_ID} not found in NFR artifact`); process.exit(3); }
if ((nfr009.traces_to ?? []).includes(MISSING_VV)) {
  console.error(`${MISSING_VV} already present in ${TARGET_NFR_ID}.traces_to — patch already applied?`);
  process.exit(0);
}

const coverageGap = db.prepare('SELECT * FROM governed_stream WHERE id = ?').get(COVERAGE_GAP_ID);
if (!coverageGap) { console.error(`coverage_gap not found: ${COVERAGE_GAP_ID}`); process.exit(3); }
const gapContent = JSON.parse(coverageGap.content);
if (gapContent.resolution !== 'pending') {
  console.error(`coverage_gap resolution is already '${gapContent.resolution}' (not pending). Aborting.`);
  process.exit(3);
}

// Compose patched NFR artifact content.
const patchedNfrContent = JSON.parse(JSON.stringify(nfrContent));
const patchedNfr009 = patchedNfrContent.requirements.find((r) => r.id === TARGET_NFR_ID);
patchedNfr009.traces_to = [...patchedNfr009.traces_to, MISSING_VV];
patchedNfr009.system_patched_traces = [
  ...(patchedNfr009.system_patched_traces ?? []),
  {
    trace: MISSING_VV,
    rationale: 'Agent nfr_bloom_skeleton omitted this VV from all NFR traces and from unreached_seeds. NFR-009 (compliance monitoring of statutory deadlines / notices) is the natural home for license / regulatory monitoring per the VV target text.',
    patched_at: new Date().toISOString(),
    patch_script: 'scripts/patch-cal26-vv-license-monitoring.js',
  },
];

// Compose patched coverage_gap content.
const patchedGapContent = {
  ...gapContent,
  missing: [],   // resolved
  actual: [...gapContent.actual, MISSING_VV],
  resolution: 'resolved_by_system_patch',
  resolution_detail: {
    method: 'surgical_patch',
    target_nfr: TARGET_NFR_ID,
    rationale: `Added ${MISSING_VV} to ${TARGET_NFR_ID}.traces_to via patch script. See artifact_produced supersession chain for audit.`,
    resolved_at: new Date().toISOString(),
    patch_script: 'scripts/patch-cal26-vv-license-monitoring.js',
  },
};

const newArtifactId = randomUUID();
const newGapId = randomUUID();
const now = new Date().toISOString();

console.error(`\n[patch] would write new artifact_produced (id ${newArtifactId})`);
console.error(`[patch] would supersede artifact ${NFR_ARTIFACT_ID}`);
console.error(`[patch] would write new coverage_gap (id ${newGapId}) with resolution=resolved_by_system_patch`);
console.error(`[patch] would supersede coverage_gap ${COVERAGE_GAP_ID}`);

if (!args.apply) {
  console.error(`\n[patch] DRY-RUN — pass --apply to commit. Diffs:`);
  console.error(`  ${TARGET_NFR_ID}.traces_to: +${MISSING_VV}`);
  console.error(`  coverage_gap.missing: ${JSON.stringify(gapContent.missing)} → []`);
  console.error(`  coverage_gap.resolution: pending → resolved_by_system_patch`);
  process.exit(0);
}

// Build the INSERT shape from the original record's columns. Mirror every
// column except the patched fields and supersession metadata.
const cols = db.prepare('PRAGMA table_info(governed_stream)').all().map((c) => c.name);
const insertCols = cols.join(', ');
const insertPlaceholders = cols.map(() => '?').join(', ');
const insertStmt = db.prepare(`INSERT INTO governed_stream (${insertCols}) VALUES (${insertPlaceholders})`);
const updateStmt = db.prepare(`UPDATE governed_stream SET is_current_version = 0, superseded_by_id = ?, superseded_at = ?, superseded_by_record_id = ? WHERE id = ?`);

function buildRow(originalRow, newId, newContent) {
  const row = { ...originalRow };
  row.id = newId;
  row.content = JSON.stringify(newContent);
  row.is_current_version = 1;
  row.superseded_by_id = null;
  row.superseded_at = null;
  row.superseded_by_record_id = null;
  row.produced_at = now;
  row.effective_at = now;
  // Append derived_from_record_ids — the new record derives from the prior version.
  const prior = originalRow.derived_from_record_ids ? JSON.parse(originalRow.derived_from_record_ids) : [];
  row.derived_from_record_ids = JSON.stringify([...prior, originalRow.id]);
  return cols.map((c) => row[c]);
}

const tx = db.transaction(() => {
  // Insert patched NFR artifact, supersede the prior one.
  insertStmt.run(...buildRow(nfrArtifact, newArtifactId, patchedNfrContent));
  updateStmt.run(newArtifactId, now, newArtifactId, NFR_ARTIFACT_ID);

  // Insert resolved coverage_gap, supersede the prior one.
  insertStmt.run(...buildRow(coverageGap, newGapId, patchedGapContent));
  updateStmt.run(newGapId, now, newGapId, COVERAGE_GAP_ID);
});

tx();
console.error(`\n[patch] applied. New artifact: ${newArtifactId}. New coverage_gap: ${newGapId}.`);

// Verify post-state.
const after = db.prepare('SELECT content FROM governed_stream WHERE id = ?').get(newArtifactId);
const afterNfr = JSON.parse(after.content).requirements.find((r) => r.id === TARGET_NFR_ID);
console.error(`[patch] verify ${TARGET_NFR_ID}.traces_to: ${JSON.stringify(afterNfr.traces_to)}`);
const afterGap = db.prepare('SELECT content FROM governed_stream WHERE id = ?').get(newGapId);
console.error(`[patch] verify coverage_gap.resolution: ${JSON.parse(afterGap.content).resolution}`);
