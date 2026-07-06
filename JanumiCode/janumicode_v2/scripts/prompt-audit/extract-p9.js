#!/usr/bin/env node
/**
 * Phase 9 Prompt-Materialization Audit — extraction (extends the P1–8 audit to
 * the Execution phase). Pulls the CORE generative P9 calls from a governed_stream
 * DB and writes self-contained call files + a manifest the audit Workflow consumes.
 *
 * P9 role classification (INVERTED from P1–8): the generative code-gen prompt is
 * `executor_agent` / sub_phase 9.1 (the leaf implementation prompt). The
 * verification ensemble (`harness:*_validator`, `*faithfulness`, `*_quality`,
 * `*final_synthesis`), DMR (`deep_memory_research`, `ingestion_pipeline_stage3`)
 * and `reasoning_review` / `json_repair` are ADDITIVE and excluded — same policy
 * as P1–8 (validators are not audit targets).
 *
 * Usage: node scripts/prompt-audit/extract-p9.js --db <cal-40 db> [--out-dir <dir>]
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const DB = arg('--db', null);
const OUT = arg('--out-dir', path.join(__dirname, 'audit-out', 'p9'));
if (!DB || !fs.existsSync(DB)) { console.error('need --db <existing path>'); process.exit(2); }
fs.mkdirSync(path.join(OUT, 'calls'), { recursive: true });

const db = new Database(DB, { readonly: true });
const rows = db.prepare(
  "SELECT id, sub_phase_id sub, produced_by_agent_role role, content, produced_at FROM governed_stream " +
  "WHERE record_type='agent_invocation' AND CAST(phase_id AS INTEGER)=9 AND produced_by_agent_role='executor_agent' " +
  "ORDER BY produced_at ASC"
).all();

// The response = the agent_output derived from the invocation.
const outStmt = db.prepare("SELECT content FROM governed_stream WHERE record_type='agent_output' AND json_extract(derived_from_record_ids,'$[0]')=? LIMIT 1");

// Deterministic pre-pass helpers.
const SENTINELS = ['(none)', '(none captured', 'No compliance', 'N/A', 'not available', 'undefined', 'no task-specific', '[]', '{}', '(not available)'];
const ID_RE = /\b(?:DM|US|AC|NFR|FR|SR|API|TECH|ADR|CC|IC|EVAL|TC|comp|task|res)-[A-Za-z0-9][A-Za-z0-9.\-]*/g;
function det(prompt, response) {
  const lc = prompt.toLowerCase();
  const empty = SENTINELS.filter((s) => lc.includes(s.toLowerCase()));
  const injected = [...new Set((prompt.match(ID_RE) || []))];
  const respIds = new Set((response || '').match(ID_RE) || []);
  const usedInjected = injected.filter((id) => respIds.has(id));
  const headers = (prompt.match(/^#{1,3} .+$/gm) || []).map((h) => h.trim());
  return {
    prompt_chars: prompt.length,
    approx_tokens: Math.round(prompt.length / 4),
    empty_sentinels: empty,
    injected_ids: injected.length,
    injected_ids_used_in_response: usedInjected.length,
    unused_id_ratio: injected.length ? +(1 - usedInjected.length / injected.length).toFixed(2) : 0,
    section_headers: headers,
  };
}

const manifest = [];
const seenTask = new Set();
for (const r of rows) {
  const c = JSON.parse(r.content);
  const label = c.label || r.sub;
  const task = (label.match(/task-[a-z0-9-]+/i) || [label])[0];
  if (seenTask.has(task)) continue; // dedup loop re-runs: one representative per distinct task
  seenTask.add(task);
  const prompt = c.prompt || '';
  let response = '';
  try { const o = outStmt.get(r.id); if (o) { const oc = JSON.parse(o.content); response = oc.text || oc.response || ''; } } catch { /* ignore */ }
  const slug = 'p9_' + task.replace(/[^a-z0-9]/gi, '_').slice(0, 48) + '_' + String(r.id).slice(0, 8);
  const d = det(prompt, response);
  const call = { slug, role: r.role, sub_phase: r.sub, label, task, invocation_id: r.id, prompt, response, det: d };
  fs.writeFileSync(path.join(OUT, 'calls', slug + '.json'), JSON.stringify(call, null, 1));
  manifest.push({ slug, role: r.role, sub_phase: r.sub, task, label, prompt_chars: d.prompt_chars, injected_ids: d.injected_ids, unused_id_ratio: d.unused_id_ratio, empty_sentinels: d.empty_sentinels.length });
}
fs.writeFileSync(path.join(OUT, 'p9-manifest.json'), JSON.stringify(manifest, null, 1));
db.close();

console.log('P9 executor_agent 9.1 calls: ' + rows.length + ' raw, ' + manifest.length + ' distinct-task targets');
console.log('slug'.padEnd(52) + 'chars  ids  unusedR  empties');
for (const m of manifest) console.log(m.slug.padEnd(52) + String(m.prompt_chars).padStart(6) + String(m.injected_ids).padStart(5) + String(m.unused_id_ratio).padStart(8) + String(m.empty_sentinels).padStart(6));
console.log('\nmanifest → ' + path.join(OUT, 'p9-manifest.json'));
