#!/usr/bin/env node
/**
 * Phase 1–8 Prompt-Materialization Audit — Stage 0: Extract + deterministic pre-pass.
 *
 * Reads a JanumiCode v2 governed_stream DB (read-only), isolates the CORE
 * generative LLM calls for phases 1–8 (excluding validators / gatekeepers /
 * routers / json_repair / reasoning_review / ingestion_pipeline_stage3 / DMR),
 * and for every such call:
 *   - writes a self-contained `calls/<invocation_id>.json` (meta + system + prompt
 *     + thinking + response), middle-truncated to context-safe caps; and
 *   - computes the deterministic dimensions D1–D5 over the FULL prompt text
 *     (before truncation).
 * Emits `manifest.json` (the worklist the Workflow fan-out consumes via `args`)
 * and `deterministic-report.md` (a human-readable D1–D5 summary available
 * immediately, no LLM needed).
 *
 * This is the durable, re-runnable artifact. It performs NO LLM calls.
 *
 * Usage:
 *   node scripts/prompt-audit/extract.js \
 *     [--db <path>]            (default: cal-29 resume-1782771124303.db)
 *     [--out-dir <path>]       (default: scripts/prompt-audit/audit-out)
 *     [--prompt-cap <chars>]   (default: 360000 — middle-elide prompt above this)
 *     [--resp-cap <chars>]     (default: 120000)
 *     [--think-cap <chars>]    (default: 80000)
 *
 * Exit: 0 ok · 2 usage · 3 no DB / no records.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

// ---------------------------------------------------------------------------
// Classification: which roles are CORE generative agents (audit targets).
// Everything else (harness validators, gatekeepers, routers, json_repair,
// reasoning_review, ingestion_pipeline_stage3 verify/gate/compose, DMR) is
// excluded per the audit scope (validators are additive and not in scope).
// ---------------------------------------------------------------------------
const CORE_ROLES = new Set([
  'domain_interpreter',
  'requirements_agent',
  'systems_agent',
  'architecture_agent',
  'technical_spec_agent',
  'implementation_planner',
  'test_design_agent',
  'eval_design_agent',
  'orchestrator',
]);
// orchestrator also runs these non-generative router/validator sub-phases — drop them.
const EXCLUDED_SUBPHASES = new Set([
  'intent_quality_check',
  'intent_lens_classification',
]);

// Known JanumiCode id namespaces, for the D5 catalog-injection measure.
const ID_PREFIXES = [
  'AC', 'US', 'NFR', 'FR', 'SR', 'DM', 'API', 'TECH', 'ADR', 'CC', 'DOM',
  'IC', 'EVAL', 'TC', 'ENT', 'WF', 'JRN', 'PER', 'DEC', 'DOC', 'INT', 'QA',
  'comp', 'task', 'cc',
];
const ID_RE = new RegExp(
  `\\b(?:${ID_PREFIXES.join('|')})-[A-Za-z0-9][A-Za-z0-9.\\-]*`,
  'g',
);

const DEFAULT_DB =
  'e:/Projects/hestami-ai/JanumiCode/janumicode_v2/test-and-evaluation/calibration-workspaces/calibration-workspace-cal-29/.janumicode/test-harness/resume-1782771124303.db';

function parseArgs(argv) {
  const out = {
    db: DEFAULT_DB,
    outDir: path.join(__dirname, 'audit-out'),
    promptCap: 360000,
    respCap: 120000,
    thinkCap: 80000,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.db = argv[++i];
    else if (a === '--out-dir') out.outDir = argv[++i];
    else if (a === '--prompt-cap') out.promptCap = parseInt(argv[++i], 10);
    else if (a === '--resp-cap') out.respCap = parseInt(argv[++i], 10);
    else if (a === '--think-cap') out.thinkCap = parseInt(argv[++i], 10);
    else if (a === '-h' || a === '--help') { console.error(fs.readFileSync(__filename, 'utf-8').split('\n').slice(1, 32).join('\n')); process.exit(0); }
    else { console.error(`[extract] unknown option: ${a}`); process.exit(2); }
  }
  return out;
}

const args = parseArgs(process.argv);

if (!fs.existsSync(args.db)) {
  console.error(`[extract] DB not found: ${args.db}`);
  process.exit(3);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const approxTokens = (s) => Math.ceil((s ? s.length : 0) / 4 * 1.1); // matches ContextBuilder.approximateTokens

function middleElide(text, cap) {
  if (text == null) return { text: text, truncated: false };
  if (text.length <= cap) return { text, truncated: false };
  const head = Math.floor(cap * 0.6);
  const tail = cap - head;
  const elided = text.length - cap;
  return {
    text: `${text.slice(0, head)}\n\n…[${elided} chars elided from the middle by the audit extractor]…\n\n${text.slice(text.length - tail)}`,
    truncated: true,
  };
}

function slugFor(phase, subPhase, invId) {
  const sp = String(subPhase || 'unknown').replace(/[^a-zA-Z0-9_]+/g, '-');
  return `p${phase}_${sp}_${String(invId).slice(0, 8)}`;
}

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * p));
  return sortedAsc[idx];
}

// ---------------------------------------------------------------------------
// Deterministic dimensions D1–D5 (computed on the FULL prompt text).
// ---------------------------------------------------------------------------

// D2 — unsubstituted {{placeholder}} tokens left literal by TemplateLoader.render.
function checkD2(prompt) {
  const re = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  const found = new Map();
  let m;
  while ((m = re.exec(prompt)) !== null) {
    found.set(m[1], (found.get(m[1]) || 0) + 1);
  }
  return {
    has_unsubstituted: found.size > 0,
    placeholders: [...found.entries()].map(([name, n]) => ({ name, count: n })),
  };
}

// D3 — empty / sentinel slots: a labeled section that rendered empty or carries a
// known "nothing here" sentinel. Catches the tech-stack / compliance materialization gap.
const SENTINEL_PATTERNS = [
  { tag: 'compliance_empty', re: /No compliance regimes/gi },
  { tag: 'tech_constraints_empty', re: /\(No task-specific technical constraints[^)]*\)/gi },
  { tag: 'generic_none', re: /^[^\n]{0,80}:\s*(?:N\/A|none(?: provided| specified| captured)?|null|undefined|—|\[\]|\{\})\s*$/gim },
  { tag: 'parenthetical_none', re: /\((?:none|n\/a|not provided|not specified|empty)\)/gi },
  { tag: 'placeholder_marker', re: /\b(?:TBD|TODO|PLACEHOLDER|FIXME)\b/g },
];
function checkD3(prompt) {
  const hits = [];
  for (const { tag, re } of SENTINEL_PATTERNS) {
    re.lastIndex = 0;
    let m;
    let n = 0;
    const samples = [];
    while ((m = re.exec(prompt)) !== null && n < 200) {
      n++;
      if (samples.length < 5) {
        const at = m.index;
        const lineStart = prompt.lastIndexOf('\n', at) + 1;
        const lineEnd = prompt.indexOf('\n', at);
        samples.push(prompt.slice(lineStart, lineEnd < 0 ? prompt.length : lineEnd).trim().slice(0, 160));
      }
      if (m[0].length === 0) re.lastIndex++; // guard zero-width
    }
    if (n > 0) hits.push({ tag, count: n, samples });
  }
  return { has_empty_slot: hits.length > 0, hits };
}

// D4 — intra-prompt duplication: repeated paragraph blocks (the "injected twice" defect).
function checkD4(prompt, minBlockChars = 200) {
  const blocks = prompt.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b.length >= minBlockChars);
  const seen = new Map(); // hash -> {count, chars, sample}
  for (const b of blocks) {
    const norm = b.replace(/\s+/g, ' ');
    const h = crypto.createHash('sha1').update(norm).digest('hex');
    const e = seen.get(h);
    if (e) { e.count++; }
    else seen.set(h, { count: 1, chars: b.length, sample: b.slice(0, 160) });
  }
  const dups = [...seen.values()].filter((e) => e.count > 1).sort((a, b) => b.chars * b.count - a.chars * a.count);
  const dupChars = dups.reduce((s, e) => s + e.chars * (e.count - 1), 0);
  return {
    duplicate_block_count: dups.length,
    duplicate_chars: dupChars,
    top_duplicates: dups.slice(0, 5).map((e) => ({ repeats: e.count, chars: e.chars, sample: e.sample })),
  };
}

// D5 — catalog over-injection: enumerated ids present in the prompt vs referenced in the response.
function checkD5(prompt, response) {
  const inj = prompt.match(ID_RE) || [];
  const ref = response ? (response.match(ID_RE) || []) : [];
  const injSet = new Set(inj);
  const refSet = new Set(ref);
  const byPrefix = {};
  for (const id of injSet) {
    const pfx = id.slice(0, id.indexOf('-'));
    byPrefix[pfx] = (byPrefix[pfx] || 0) + 1;
  }
  let unused = 0;
  for (const id of injSet) if (!refSet.has(id)) unused++;
  return {
    injected_total: inj.length,
    injected_unique: injSet.size,
    referenced_unique: refSet.size,
    unused_unique: unused,
    unused_ratio: injSet.size ? +(unused / injSet.size).toFixed(3) : 0,
    injected_by_prefix: byPrefix,
  };
}

// ---------------------------------------------------------------------------
// Pass 1 — read all CORE generative calls.
// ---------------------------------------------------------------------------
console.error(`[extract] opening ${args.db}`);
const db = new Database(args.db, { readonly: true, fileMustExist: true });

const rows = db.prepare(`
  SELECT
    inv.id                       AS invocation_id,
    inv.phase_id                 AS phase_id,
    inv.sub_phase_id             AS sub_phase_id,
    inv.produced_by_agent_role   AS agent_role,
    inv.produced_at              AS produced_at,
    inv.content                  AS inv_content,
    out.content                  AS out_content
  FROM governed_stream inv
  LEFT JOIN governed_stream out
    ON out.record_type = 'agent_output'
    AND out.is_current_version = 1
    AND json_extract(out.derived_from_record_ids, '$[0]') = inv.id
  WHERE inv.record_type = 'agent_invocation'
    AND inv.is_current_version = 1
    AND CAST(inv.phase_id AS INTEGER) BETWEEN 1 AND 8
  ORDER BY CAST(inv.phase_id AS INTEGER) ASC, inv.produced_at ASC
`).all();
db.close();

// Diagnostic: which P1–8 sub_phases have NO call produced by a CORE role
// (i.e. a generative step that might be hiding under an excluded role label).
const subPhaseRoles = new Map(); // sub_phase -> Set(roles)
for (const r of rows) {
  if (!subPhaseRoles.has(r.sub_phase_id)) subPhaseRoles.set(r.sub_phase_id, new Set());
  subPhaseRoles.get(r.sub_phase_id).add(r.agent_role);
}

const core = rows.filter(
  (r) => CORE_ROLES.has(r.agent_role) && !EXCLUDED_SUBPHASES.has(r.sub_phase_id),
);

console.error(`[extract] ${rows.length} P1-8 invocations; ${core.length} CORE generative targets`);

// Parse + assemble call objects (full text retained for D1–D5).
const calls = core.map((r) => {
  const inv = JSON.parse(r.inv_content);
  const out = r.out_content ? JSON.parse(r.out_content) : null;
  const system = inv.system ?? null;
  const prompt = inv.prompt ?? '';
  const fullPromptText = (system ? system + '\n' : '') + prompt;
  const response = out?.text ?? '';
  const thinking = out?.thinking ?? null;
  return {
    invocation_id: r.invocation_id,
    phase: String(r.phase_id),
    sub_phase: r.sub_phase_id,
    role: r.agent_role,
    label: inv.label ?? null,
    model: inv.model ?? null,
    started_at: inv.started_at ?? r.produced_at,
    system, prompt, response, thinking,
    fullPromptText,
    prompt_chars: fullPromptText.length,
    approx_tokens: approxTokens(fullPromptText),
    input_tokens: out?.input_tokens ?? null,
    output_tokens: out?.output_tokens ?? null,
    duration_ms: out?.duration_ms ?? null,
    response_chars: response.length,
    thinking_chars: thinking ? thinking.length : 0,
    out_status: out?.status ?? 'missing',
  };
});

// ---------------------------------------------------------------------------
// Pass 2 — per-role size percentiles (for D1 outlier flags).
// ---------------------------------------------------------------------------
const byRoleSizes = {};
for (const c of calls) (byRoleSizes[c.role] ||= []).push(c.prompt_chars);
const rolePct = {};
for (const [role, arr] of Object.entries(byRoleSizes)) {
  const s = arr.slice().sort((a, b) => a - b);
  rolePct[role] = { n: s.length, median: percentile(s, 0.5), p90: percentile(s, 0.9), p99: percentile(s, 0.99), max: s[s.length - 1] };
}

// ---------------------------------------------------------------------------
// Pass 3 — write per-call files + compute D1–D5 + build manifest.
// ---------------------------------------------------------------------------
const outDir = args.outDir;
const callsDir = path.join(outDir, 'calls');
fs.mkdirSync(callsDir, { recursive: true });
fs.mkdirSync(path.join(outDir, 'results'), { recursive: true });

const targets = [];
for (const c of calls) {
  const det = {
    D1_size: {
      prompt_chars: c.prompt_chars,
      approx_tokens: c.approx_tokens,
      input_tokens: c.input_tokens,
      role_median: rolePct[c.role].median,
      role_p90: rolePct[c.role].p90,
      role_p99: rolePct[c.role].p99,
      size_outlier: c.prompt_chars >= rolePct[c.role].p90,
      size_extreme: c.prompt_chars >= rolePct[c.role].p99,
    },
    D2_unsubstituted: checkD2(c.fullPromptText),
    D3_empty_slot: checkD3(c.fullPromptText),
    D4_duplication: checkD4(c.fullPromptText),
    D5_catalog: checkD5(c.fullPromptText, c.response),
  };

  const slug = slugFor(c.phase, c.sub_phase, c.invocation_id);
  const pe = middleElide(c.prompt, args.promptCap);
  const re = middleElide(c.response, args.respCap);
  const te = middleElide(c.thinking, args.thinkCap);

  const callFile = {
    meta: {
      invocation_id: c.invocation_id, slug,
      phase: c.phase, sub_phase: c.sub_phase, role: c.role,
      label: c.label, model: c.model, started_at: c.started_at,
      prompt_chars: c.prompt_chars, approx_tokens: c.approx_tokens,
      input_tokens: c.input_tokens, output_tokens: c.output_tokens, duration_ms: c.duration_ms,
      response_chars: c.response_chars, thinking_chars: c.thinking_chars,
      thinking_present: !!c.thinking, out_status: c.out_status,
      prompt_truncated: pe.truncated, response_truncated: re.truncated, thinking_truncated: te.truncated,
      det,
    },
    system: c.system,
    prompt: pe.text,
    thinking: te.text,
    response: re.text,
  };
  fs.writeFileSync(path.join(callsDir, `${c.invocation_id}.json`), JSON.stringify(callFile, null, 2), 'utf-8');

  targets.push({
    slug, invocation_id: c.invocation_id, path: path.join('calls', `${c.invocation_id}.json`),
    phase: c.phase, sub_phase: c.sub_phase, role: c.role, label: c.label,
    prompt_chars: c.prompt_chars,
    det_summary: {
      size_outlier: det.D1_size.size_outlier,
      size_extreme: det.D1_size.size_extreme,
      unsubstituted: det.D2_unsubstituted.has_unsubstituted,
      empty_slot: det.D3_empty_slot.has_empty_slot,
      dup_blocks: det.D4_duplication.duplicate_block_count,
      dup_chars: det.D4_duplication.duplicate_chars,
      unused_id_ratio: det.D5_catalog.unused_ratio,
      injected_ids: det.D5_catalog.injected_unique,
    },
  });
}

// Manifest.
const byRoleCount = {};
for (const t of targets) byRoleCount[t.role] = (byRoleCount[t.role] || 0) + 1;
const coreSubphasesNoCoreRole = [...subPhaseRoles.entries()]
  .filter(([sp, roleset]) => ![...roleset].some((r) => CORE_ROLES.has(r)) && !EXCLUDED_SUBPHASES.has(sp))
  .map(([sp, roleset]) => ({ sub_phase: sp, producing_roles: [...roleset] }));

const manifest = {
  generated_at_note: 'timestamp omitted (deterministic extract); stamp at report time',
  db: args.db,
  core_total: targets.length,
  by_role_count: byRoleCount,
  size_percentiles_by_role: rolePct,
  truncation_caps: { promptCap: args.promptCap, respCap: args.respCap, thinkCap: args.thinkCap },
  diagnostics: { core_subphases_with_no_core_role_call: coreSubphasesNoCoreRole },
  targets,
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

// ---------------------------------------------------------------------------
// Deterministic report (immediately useful, no LLM).
// ---------------------------------------------------------------------------
function pct(n, d) { return d ? ((100 * n) / d).toFixed(1) + '%' : '0%'; }
const L = [];
L.push('# Phase 1–8 Prompt-Materialization Audit — Deterministic Pre-Pass (D1–D5)');
L.push('');
L.push(`_Source: \`${args.db}\` · ${targets.length} CORE generative calls · LLM-free deterministic scan._`);
L.push('');
L.push('## Per-role size (prompt chars) + deterministic-flag incidence');
L.push('');
L.push('| Role | n | median | p90 | p99 | max | ≥p90 | unsub {{}} | empty-slot | dup-blocks | mean unused-id ratio |');
L.push('|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
const roles = Object.keys(byRoleCount).sort((a, b) => byRoleCount[b] - byRoleCount[a]);
for (const role of roles) {
  const ts = targets.filter((t) => t.role === role);
  const p = rolePct[role];
  const out = ts.filter((t) => t.det_summary.size_outlier).length;
  const uns = ts.filter((t) => t.det_summary.unsubstituted).length;
  const emp = ts.filter((t) => t.det_summary.empty_slot).length;
  const dup = ts.filter((t) => t.det_summary.dup_blocks > 0).length;
  const meanUnused = (ts.reduce((s, t) => s + t.det_summary.unused_id_ratio, 0) / ts.length).toFixed(2);
  L.push(`| ${role} | ${ts.length} | ${p.median} | ${p.p90} | ${p.p99} | ${p.max} | ${out} | ${uns} | ${emp} | ${dup} | ${meanUnused} |`);
}
L.push('');
L.push('## D2 — Unsubstituted `{{placeholder}}` (render misses)');
L.push('');
const d2 = targets.filter((t) => t.det_summary.unsubstituted);
if (!d2.length) L.push('_None — every `{{…}}` was substituted._');
else {
  L.push('| slug | role | sub_phase | placeholders |');
  L.push('|---|---|---|---|');
  for (const t of d2.slice(0, 60)) {
    const cf = JSON.parse(fs.readFileSync(path.join(callsDir, `${t.invocation_id}.json`), 'utf-8'));
    const names = cf.meta.det.D2_unsubstituted.placeholders.map((x) => `${x.name}×${x.count}`).join(', ');
    L.push(`| ${t.slug} | ${t.role} | ${t.sub_phase} | ${names} |`);
  }
  if (d2.length > 60) L.push(`| … | | | _${d2.length - 60} more_ |`);
}
L.push('');
L.push('## D3 — Empty / sentinel slots (materialization-fidelity candidates)');
L.push('');
const d3 = targets.filter((t) => t.det_summary.empty_slot);
L.push(`${d3.length} of ${targets.length} calls (${pct(d3.length, targets.length)}) carry ≥1 empty/sentinel marker. By sub_phase:`);
L.push('');
const d3BySub = {};
for (const t of d3) (d3BySub[t.sub_phase] ||= []).push(t);
L.push('| sub_phase | calls w/ empty-slot | example tags |');
L.push('|---|--:|---|');
for (const sp of Object.keys(d3BySub).sort((a, b) => d3BySub[b].length - d3BySub[a].length)) {
  const ex = JSON.parse(fs.readFileSync(path.join(callsDir, `${d3BySub[sp][0].invocation_id}.json`), 'utf-8'));
  const tags = ex.meta.det.D3_empty_slot.hits.map((h) => `${h.tag}×${h.count}`).join(', ');
  L.push(`| ${sp} | ${d3BySub[sp].length} | ${tags} |`);
}
L.push('');
L.push('## D4 — Intra-prompt duplication (top offenders by duplicated chars)');
L.push('');
const d4 = targets.filter((t) => t.det_summary.dup_blocks > 0).sort((a, b) => b.det_summary.dup_chars - a.det_summary.dup_chars);
if (!d4.length) L.push('_None — no repeated ≥200-char blocks._');
else {
  L.push('| slug | role | sub_phase | dup-blocks | dup-chars |');
  L.push('|---|---|---|--:|--:|');
  for (const t of d4.slice(0, 30)) L.push(`| ${t.slug} | ${t.role} | ${t.sub_phase} | ${t.det_summary.dup_blocks} | ${t.det_summary.dup_chars} |`);
}
L.push('');
L.push('## D5 — Catalog over-injection (highest unused-id ratios, ≥30 injected ids)');
L.push('');
const d5 = targets.filter((t) => t.det_summary.injected_ids >= 30).sort((a, b) => b.det_summary.unused_id_ratio - a.det_summary.unused_id_ratio);
L.push('| slug | role | sub_phase | injected-ids | unused-ratio |');
L.push('|---|---|---|--:|--:|');
for (const t of d5.slice(0, 30)) L.push(`| ${t.slug} | ${t.role} | ${t.sub_phase} | ${t.det_summary.injected_ids} | ${t.det_summary.unused_id_ratio} |`);
L.push('');
if (coreSubphasesNoCoreRole.length) {
  L.push('## ⚠️ Diagnostic — core sub_phases with NO core-role call (possible mislabeled generative step)');
  L.push('');
  for (const d of coreSubphasesNoCoreRole) L.push(`- \`${d.sub_phase}\` — produced only by: ${d.producing_roles.join(', ')}`);
  L.push('');
}
fs.writeFileSync(path.join(outDir, 'deterministic-report.md'), L.join('\n') + '\n', 'utf-8');

console.error(`[extract] wrote ${targets.length} call files → ${callsDir}`);
console.error(`[extract] wrote manifest.json + deterministic-report.md → ${outDir}`);
console.error(`[extract] D2 unsubstituted: ${targets.filter((t) => t.det_summary.unsubstituted).length} · D3 empty-slot: ${targets.filter((t) => t.det_summary.empty_slot).length} · D4 dup: ${targets.filter((t) => t.det_summary.dup_blocks > 0).length}`);
process.exit(0);
