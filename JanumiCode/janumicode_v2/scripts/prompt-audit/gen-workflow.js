#!/usr/bin/env node
/**
 * Generate a self-contained Workflow script for the prompt-materialization audit.
 *
 * Reads dimensions.json (rubric), roleIntents.json, and audit-out/manifest.json,
 * selects the target set (--mode calibration | all | flagged), and injects
 * AUDIT_OUT_DIR / RUBRIC_MARKDOWN / ROLE_INTENTS / TARGETS into the workflow
 * template, producing `audit.workflow.gen.js`. The Workflow tool then runs that
 * file via scriptPath — no large `args` payload needed.
 *
 * Usage: node scripts/prompt-audit/gen-workflow.js --mode calibration
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

const DIR = __dirname;
const OUT_DIR = path.join(DIR, 'audit-out');

let mode = 'calibration';
let skipExisting = false;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--mode') mode = process.argv[++i];
  else if (process.argv[i] === '--skip-existing') skipExisting = true;
}

const dimensions = JSON.parse(fs.readFileSync(path.join(DIR, 'dimensions.json'), 'utf-8'));
const roleIntentsRaw = JSON.parse(fs.readFileSync(path.join(DIR, 'roleIntents.json'), 'utf-8'));
const manifest = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'manifest.json'), 'utf-8'));

const roleIntents = { ...roleIntentsRaw };
delete roleIntents._comment;

const allTargets = manifest.targets.map((t) => ({
  id: t.invocation_id, slug: t.slug, sub_phase: t.sub_phase, role: t.role, phase: t.phase,
  _prompt_chars: t.prompt_chars, _det: t.det_summary,
}));

function selectCalibration(targets) {
  const bySub = {};
  for (const t of targets) (bySub[t.sub_phase] ||= []).push(t);
  const picked = [];
  const seen = new Set();
  const add = (t) => { if (t && !seen.has(t.id)) { seen.add(t.id); picked.push(t); } };
  const top = (sub, n, key) => {
    const arr = (bySub[sub] || []).slice().sort((a, b) => (key(b) - key(a)));
    arr.slice(0, n).forEach(add);
  };
  const spread = (sub, n) => {
    const arr = (bySub[sub] || []).slice().sort((a, b) => a._prompt_chars - b._prompt_chars);
    if (!arr.length) return;
    const idxs = n === 1 ? [Math.floor(arr.length / 2)] : Array.from({ length: n }, (_, i) => Math.floor((i * (arr.length - 1)) / (n - 1)));
    idxs.forEach((i) => add(arr[i]));
  };
  // confirmed materialization defect
  top('evaluation_design', 1, (t) => 1);
  // catalog over-injection champions
  top('task_skeleton', 3, (t) => t._det.injected_ids);
  // giant prompts
  top('test_case_saturation', 3, (t) => t._prompt_chars);
  // saturation structural-vs-bloat judgement
  spread('fr_saturation', 3);
  top('component_saturation', 2, (t) => t._prompt_chars);
  top('task_saturation', 2, (t) => t._prompt_chars);
  // tech-stack materialization checks
  spread('nfr_bloom_skeleton', 2);
  spread('nfr_bloom_enrichment', 1);
  spread('data_model_saturation', 1);
  spread('interface_contracts', 1);
  // D3 high-count cases
  top('adr_capture', 1, (t) => 1);
  top('test_case_skeleton', 1, (t) => (t._det.empty_slot ? 1 : 0));
  // clean baselines
  spread('business_domains_bloom', 1);
  spread('canonical_vocabulary_discovery', 1);
  return picked;
}

let selected;
if (mode === 'all') selected = allTargets;
else if (mode === 'flagged') selected = allTargets.filter((t) => t._det.size_extreme || t._det.empty_slot || t._det.unsubstituted || t._det.unused_id_ratio >= 0.9);
else selected = selectCalibration(allTargets);

// optionally exclude targets that already have a results file (reuse prior batches)
if (skipExisting) {
  const resDir = path.join(OUT_DIR, 'results');
  const done = new Set(fs.existsSync(resDir) ? fs.readdirSync(resDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')) : []);
  const before = selected.length;
  selected = selected.filter((t) => !done.has(t.slug));
  console.error(`[gen-workflow] --skip-existing: ${done.size} done, ${before - selected.length} excluded, ${selected.length} remain`);
}

// strip the helper-only fields before embedding
const targets = selected.map((t) => ({ id: t.id, slug: t.slug, sub_phase: t.sub_phase, role: t.role, phase: t.phase }));

const auditOutDir = OUT_DIR.replace(/\\/g, '/');
const template = fs.readFileSync(path.join(DIR, 'audit.workflow.template.js'), 'utf-8');

const injected = [
  `const AUDIT_OUT_DIR = ${JSON.stringify(auditOutDir)};`,
  `const RUBRIC_MARKDOWN = ${JSON.stringify(dimensions.rubric_markdown)};`,
  `const ROLE_INTENTS = ${JSON.stringify(roleIntents)};`,
  `const TARGETS = ${JSON.stringify(targets)};`,
].join('\n');

const genScript = template.replace('/*__INJECTED_DATA__*/', injected);
const outPath = path.join(DIR, 'audit.workflow.gen.js');
fs.writeFileSync(outPath, genScript, 'utf-8');

console.error(`[gen-workflow] mode=${mode} · ${targets.length} targets · rubric v${dimensions.version}`);
console.error(`[gen-workflow] wrote ${outPath} (${(genScript.length / 1024).toFixed(0)} KB)`);
const bySub = {};
for (const t of targets) bySub[t.sub_phase] = (bySub[t.sub_phase] || 0) + 1;
console.error('[gen-workflow] by sub_phase: ' + Object.entries(bySub).map(([k, v]) => `${k}:${v}`).join(', '));
