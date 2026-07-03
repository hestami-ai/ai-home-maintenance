#!/usr/bin/env node
/**
 * Cluster the audit verdicts (results/*.json) by (sub_phase × dimension) into a
 * digest for authoring the fix backlog. Prints counts by severity + representative
 * (evidence, fix) pairs (high-severity preferred). Writes cluster-digest.md.
 *
 * Usage: node scripts/prompt-audit/cluster.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, 'audit-out');
const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf-8'));
const bySlug = new Map(m.targets.map((t) => [t.slug, t]));
const DIM_NAME = { D1:'size',D2:'unsubstituted',D3:'empty-slot',D4:'duplication',D5:'catalog-overinject',A1:'over-scoped',A2:'raw-firehose',A3:'monolithic',A4:'dead-context',A5:'redundant-boilerplate',B1:'missing-binding',B2:'empty-slot-semantics',B3:'wrong-scope',B4:'id-namespace',B5:'intent-mismatch',C1:'starvation',C2:'coverage-shortfall',C3:'instruction-drowning/wrong-node',C4:'parse-fragility' };
const SEVW = { low:1, med:2, high:4 };

const cells = {}; // key sub_phase||dim -> {sp,dim,low,med,high,fixes:[{sev,ev,fix,slug}]}
for (const f of fs.readdirSync(path.join(dir, 'results'))) {
  if (!f.endsWith('.json')) continue;
  let v; try { v = JSON.parse(fs.readFileSync(path.join(dir, 'results', f), 'utf-8')); } catch { continue; }
  const t = bySlug.get(v.slug); if (!t) continue;
  for (const fd of v.findings || []) {
    const k = `${t.sub_phase}||${fd.dimension}`;
    cells[k] ??= { sp: t.sub_phase, dim: fd.dimension, low: 0, med: 0, high: 0, fixes: [] };
    cells[k][fd.severity]++;
    cells[k].fixes.push({ sev: fd.severity, ev: fd.evidence || '', fix: fd.suggested_fix || '', slug: v.slug });
  }
}
const arr = Object.values(cells).map((c) => ({ ...c, w: c.high * 4 + c.med * 2 + c.low })).sort((a, b) => b.w - a.w);

// group by sub_phase for readability
const bySp = {};
for (const c of arr) (bySp[c.sp] ??= []).push(c);
const spOrder = Object.keys(bySp).sort((a, b) => bySp[b].reduce((s, c) => s + c.w, 0) - bySp[a].reduce((s, c) => s + c.w, 0));

const L = [];
L.push('# Audit finding clusters — (sub_phase × dimension), for backlog authoring');
L.push('');
for (const sp of spOrder) {
  const tot = bySp[sp].reduce((s, c) => s + c.w, 0);
  L.push(`## ${sp}  (weighted ${tot})`);
  for (const c of bySp[sp].sort((a, b) => b.w - a.w)) {
    if (c.high === 0 && c.med === 0) continue; // skip pure-low noise in the digest
    L.push(`- **${c.dim} ${DIM_NAME[c.dim]}** — high ${c.high} / med ${c.med} / low ${c.low}`);
    // 1 representative high (or med) fix
    const rep = c.fixes.filter((x) => x.sev === 'high')[0] || c.fixes.filter((x) => x.sev === 'med')[0];
    if (rep) { L.push(`  - e.g. \`${rep.slug}\`: ${rep.ev.slice(0, 170)}`); L.push(`  - fix: ${rep.fix.slice(0, 170)}`); }
  }
  L.push('');
}
fs.writeFileSync(path.join(dir, 'cluster-digest.md'), L.join('\n') + '\n', 'utf-8');
console.error(`[cluster] wrote ${path.join(dir, 'cluster-digest.md')} · ${arr.length} (sub_phase×dim) cells`);
// compact console summary: sub_phase totals
console.error('\nsub_phase weighted totals (high/med counts):');
for (const sp of spOrder) {
  const cs = bySp[sp];
  const h = cs.reduce((s, c) => s + c.high, 0), md = cs.reduce((s, c) => s + c.med, 0);
  console.error(`  ${sp}: w=${cs.reduce((s, c) => s + c.w, 0)} (high ${h}, med ${md})  dims: ${cs.filter((c)=>c.high||c.med).map((c) => c.dim).join(',')}`);
}
