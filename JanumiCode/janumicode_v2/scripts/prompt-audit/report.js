#!/usr/bin/env node
/**
 * Phase 1-8 Prompt-Materialization Audit — Stage 2: Report.
 *
 * Reads audit-out/manifest.json + audit-out/results/*.json (the per-call LLM
 * verdicts) and emits audit-out/audit-report.md:
 *   - run summary + coverage (results present vs manifest targets)
 *   - per-role x per-dimension defect matrix (severity-weighted)
 *   - roles ranked by defect density
 *   - top findings with evidence + suggested fix
 *   - per-role prompt-size distributions
 *   - confirm/refute of the 7 static pre-findings
 *
 * Re-runnable independently; tolerates partial results (run it mid-fan-out).
 *
 * Usage: node scripts/prompt-audit/report.js [--out-dir <audit-out>]
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

let outDir = path.join(__dirname, 'audit-out');
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--out-dir') outDir = process.argv[++i];

const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf-8'));
const bySlug = new Map(manifest.targets.map((t) => [t.slug, t]));

const resultsDir = path.join(outDir, 'results');
const files = fs.existsSync(resultsDir) ? fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json')) : [];
const verdicts = [];
let parseErrors = 0;
for (const f of files) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf-8'));
    const t = bySlug.get(v.slug) || bySlug.get(f.replace(/\.json$/, ''));
    if (!t) continue;
    v._role = t.role; v._sub_phase = t.sub_phase; v._phase = t.phase; v._prompt_chars = t.prompt_chars;
    verdicts.push(v);
  } catch { parseErrors++; }
}

const SEV_W = { low: 1, med: 2, high: 4 };
const DIMS = ['D1','D2','D3','D4','D5','A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4'];
const DIM_NAME = {
  D1: 'size', D2: 'unsubstituted', D3: 'empty-slot', D4: 'duplication', D5: 'catalog-overinject',
  A1: 'over-scoped', A2: 'raw-firehose', A3: 'monolithic', A4: 'dead-context', A5: 'redundant-boilerplate',
  B1: 'missing-binding', B2: 'empty-slot-semantics', B3: 'wrong-scope', B4: 'id-namespace', B5: 'intent-mismatch',
  C1: 'starvation', C2: 'coverage-shortfall', C3: 'instruction-drowning', C4: 'parse-fragility',
};

// ---- aggregates ----
const roles = [...new Set(verdicts.map((v) => v._role))].sort();
const roleCount = {};
for (const v of verdicts) roleCount[v._role] = (roleCount[v._role] || 0) + 1;

// per-role x dimension severity-weighted matrix
const matrix = {}; // role -> dim -> {low,med,high,w}
for (const v of verdicts) {
  for (const f of v.findings || []) {
    matrix[v._role] ||= {};
    matrix[v._role][f.dimension] ||= { low: 0, med: 0, high: 0, w: 0 };
    const cell = matrix[v._role][f.dimension];
    cell[f.severity] = (cell[f.severity] || 0) + 1;
    cell.w += SEV_W[f.severity] || 0;
  }
}
const roleDensity = roles.map((r) => {
  let w = 0;
  for (const d of Object.values(matrix[r] || {})) w += d.w;
  return { role: r, n: roleCount[r], weighted: w, density: +(w / roleCount[r]).toFixed(2) };
}).sort((a, b) => b.density - a.density);

// dimension totals
const dimTotals = {};
for (const v of verdicts) for (const f of v.findings || []) {
  dimTotals[f.dimension] ||= { low: 0, med: 0, high: 0, w: 0 };
  dimTotals[f.dimension][f.severity]++; dimTotals[f.dimension].w += SEV_W[f.severity] || 0;
}
const dimRank = Object.entries(dimTotals).map(([d, s]) => ({ d, ...s })).sort((a, b) => b.w - a.w);

// all findings sorted by severity
const allFindings = [];
for (const v of verdicts) for (const f of v.findings || []) allFindings.push({ ...f, slug: v.slug, role: v._role, sub_phase: v._sub_phase });
allFindings.sort((a, b) => (SEV_W[b.severity] - SEV_W[a.severity]));

// ---- 7 static pre-findings: confirm / refute from the verdicts ----
const PREFINDINGS = [
  { id: 1, label: 'P6 full-AC-catalog injected into per-component task skeleton', status: 'FIXED', match: (f, v) => v._sub_phase === 'task_skeleton' && (f.dimension === 'A1' || f.dimension === 'D5') },
  { id: 2, label: 'P6 monolithic orphan-AC reconciliation', status: 'FIXED', match: (f, v) => v._sub_phase === 'task_reconciliation' && f.dimension === 'A3' },
  { id: 3, label: 'P7 full-AC-catalog injected into per-test-case saturation', status: 'FIXED', match: (f, v) => v._sub_phase === 'test_case_saturation' && (f.dimension === 'A1' || f.dimension === 'D5') },
  { id: 4, label: 'P8 compliance_context hardcoded "No compliance regimes"', status: 'OPEN', match: (f, v) => v._sub_phase === 'evaluation_design' && (f.dimension === 'B2' || f.dimension === 'D3' || f.dimension === 'B5' || f.dimension === 'B1') },
  { id: 5, label: 'TECH-* absent from P6-8 (DMR authority gap)', status: 'OPEN', match: (f, v) => ['task_skeleton','task_saturation','test_case_skeleton','evaluation_design'].includes(v._sub_phase) && f.dimension === 'B1' },
  { id: 6, label: 'P4 component-narrowed TECH-* not carried into P6 skeleton', status: 'OPEN', match: (f, v) => v._sub_phase === 'task_skeleton' && (f.dimension === 'B1' || f.dimension === 'B3') },
  { id: 7, label: 'Reconciliation-path tasks not stamped active_constraints', status: 'OPEN', match: (f, v) => v._sub_phase === 'task_reconciliation' && f.dimension === 'B1' },
];
const prefindingHits = PREFINDINGS.map((pf) => {
  const hits = [];
  for (const v of verdicts) for (const f of v.findings || []) if (pf.match(f, v)) hits.push({ slug: v.slug, sub_phase: v._sub_phase, dimension: f.dimension, severity: f.severity, evidence: f.evidence });
  return { ...pf, hits };
});

// ---- render ----
const L = [];
L.push('# Phase 1-8 Prompt-Materialization Audit — Findings Report');
L.push('');
L.push(`_${verdicts.length} of ${manifest.core_total} core calls audited${parseErrors ? ` · ${parseErrors} result parse-errors` : ''}. Severity weights: high=4, med=2, low=1._`);
L.push('');

L.push('## Roles ranked by defect density (weighted findings / call)');
L.push('');
L.push('| Role | calls | weighted | density |');
L.push('|---|--:|--:|--:|');
for (const r of roleDensity) L.push(`| ${r.role} | ${r.n} | ${r.weighted} | ${r.density} |`);
L.push('');

L.push('## Dimensions ranked by weighted incidence');
L.push('');
L.push('| Dim | name | high | med | low | weighted |');
L.push('|---|---|--:|--:|--:|--:|');
for (const d of dimRank) L.push(`| ${d.d} | ${DIM_NAME[d.d] || ''} | ${d.high} | ${d.med} | ${d.low} | ${d.w} |`);
L.push('');

L.push('## Per-role × per-dimension defect matrix (weighted)');
L.push('');
const activeDims = DIMS.filter((d) => dimTotals[d]);
L.push('| Role | ' + activeDims.join(' | ') + ' |');
L.push('|---|' + activeDims.map(() => '--:').join('|') + '|');
for (const r of roleDensity) {
  const row = activeDims.map((d) => (matrix[r.role] && matrix[r.role][d] ? matrix[r.role][d].w : ''));
  L.push(`| ${r.role} | ` + row.join(' | ') + ' |');
}
L.push('');
L.push('_Legend: ' + activeDims.map((d) => `${d}=${DIM_NAME[d]}`).join(' · ') + '_');
L.push('');

L.push('## Static pre-findings — confirm / refute');
L.push('');
for (const pf of prefindingHits) {
  const verdict = pf.hits.length ? (pf.status === 'FIXED' ? '⚠️ STILL PRESENT' : '✅ CONFIRMED') : (pf.status === 'FIXED' ? '✅ clean (fix holds)' : '— not surfaced');
  L.push(`### #${pf.id} [${pf.status}] ${pf.label} — ${verdict} (${pf.hits.length} hits)`);
  for (const h of pf.hits.slice(0, 4)) L.push(`- \`${h.slug}\` ${h.dimension}/${h.severity}: ${(h.evidence || '').slice(0, 200)}`);
  L.push('');
}

L.push('## Top findings (by severity)');
L.push('');
for (const f of allFindings.slice(0, 60)) {
  L.push(`- **[${f.severity}] ${f.dimension} ${DIM_NAME[f.dimension] || ''}** · \`${f.slug}\` (${f.sub_phase})`);
  L.push(`  - evidence: ${(f.evidence || '').slice(0, 240)}`);
  L.push(`  - fix: ${(f.suggested_fix || '').slice(0, 200)}`);
}
L.push('');

L.push('## Per-role prompt-size (chars)');
L.push('');
L.push('| Role | n | median | p90 | p99 | max |');
L.push('|---|--:|--:|--:|--:|--:|');
for (const [role, p] of Object.entries(manifest.size_percentiles_by_role).sort((a, b) => b[1].n - a[1].n)) {
  L.push(`| ${role} | ${p.n} | ${p.median} | ${p.p90} | ${p.p99} | ${p.max} |`);
}
L.push('');

fs.writeFileSync(path.join(outDir, 'audit-report.md'), L.join('\n') + '\n', 'utf-8');
console.error(`[report] ${verdicts.length} verdicts → ${path.join(outDir, 'audit-report.md')}`);
console.error(`[report] role density: ${roleDensity.slice(0, 5).map((r) => `${r.role}=${r.density}`).join(', ')}`);
