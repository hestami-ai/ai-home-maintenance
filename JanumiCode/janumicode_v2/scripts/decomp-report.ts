/**
 * decomp-report.ts — standalone, re-runnable report over a calibration run's
 * governed_stream SQLite DB. Extracts Phases 0–8 + the validators' output and
 * emits ONE self-contained interactive HTML file organised around a HUMAN,
 * DOMAIN-ORIENTED trace (not the workflow phases). Primary lenses:
 *   • Trace — Intent → Release → User Journey → User Story → Acceptance
 *     Criterion → Realization (component / task / test / data-model), with
 *     cross-cutting concerns (NFRs, workflows) shown as chips in context and
 *     validator findings badged on the items they cite.
 *   • Components — each component and everything linked to it (stories/ACs it
 *     realizes, data models, APIs, config, error-handling, governing ADRs, tasks,
 *     tests).
 *   • Cross-cutting — NFRs, compliance, integrations, tech constraints, quality
 *     attributes, system workflows, vocabulary, multi-component ADRs, shared
 *     entities — each with what it touches.
 * Validators (findings) + Coverage are their own lenses; the raw P0–P8 artifacts
 * are demoted to a secondary "Deep dive" tab (verbatim JSON for deep inspection).
 *
 * It REUSES the extension's own extractors so it stays in lockstep with the
 * Decomposition Viewer rather than re-deriving joins:
 *   - `DecompViewerDataProvider.getSnapshot()` → the requirement spine + realization.
 *   - `findingSurfacing` primitives (AUTO_FIX_VALIDATORS / extractCitedIds) → findings.
 * The deep-dive sections are read generically from `artifact_produced` and
 * rendered by a shape-agnostic client so new artifact kinds appear automatically.
 *
 * Read-only; safe to run against a completed run's DB (or a live one — it only
 * reads committed rows).
 *
 * Usage:
 *   npx tsx scripts/decomp-report.ts <path-to.db> [--run <workflow_run_id>] [--out <file.html>]
 *
 * Defaults: newest run in the DB; output written next to the DB as
 * `decomp-report-<run8>.html`.
 */

import BetterSqlite3 from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DecompViewerDataProvider } from '../src/lib/decompViewer/decompViewerDataProvider';
import type { ViewerSnapshot, ViewerFinding } from '../src/lib/decompViewer/types';
import type { Database } from '../src/lib/database/init';
import {
  AUTO_FIX_VALIDATORS,
  REASONING_PROCESS_VALIDATORS,
  extractCitedIds,
} from '../src/lib/review/findingSurfacing';
import type { ReasoningReviewFindingRecordContent } from '../src/lib/types/records';

type Json = Record<string, unknown>;

// ── CLI ──────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { db: string; run?: string; out?: string } {
  const rest = argv.slice(2);
  const out: { db?: string; run?: string; out?: string } = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--run') out.run = rest[++i];
    else if (a === '--out') out.out = rest[++i];
    else if (a === '-h' || a === '--help') { printHelpAndExit(); }
    else if (!a.startsWith('-') && !out.db) out.db = a;
  }
  if (!out.db) { printHelpAndExit('Missing <path-to.db>.'); }
  return out as { db: string; run?: string; out?: string };
}

function printHelpAndExit(msg?: string): never {
  if (msg) console.error(`[decomp-report] ${msg}\n`);
  console.error('Usage: npx tsx scripts/decomp-report.ts <path-to.db> [--run <workflow_run_id>] [--out <file.html>]');
  process.exit(msg ? 2 : 0);
}

// ── DB helpers ───────────────────────────────────────────────────────

function openDb(dbPath: string): Database {
  if (!fs.existsSync(dbPath)) printHelpAndExit(`DB not found: ${dbPath}`);
  // Cast to the project's Database type — the provider only calls the
  // better-sqlite3 subset (prepare/pragma), same as the viewer's own tests.
  return new BetterSqlite3(dbPath, { readonly: true, fileMustExist: true }) as unknown as Database;
}

function resolveRunId(db: Database, requested?: string): string {
  const raw = db as unknown as BetterSqlite3.Database;
  if (requested) return requested;
  const row = raw.prepare('SELECT id FROM workflow_runs ORDER BY rowid DESC LIMIT 1').get() as { id?: string } | undefined;
  if (!row?.id) printHelpAndExit('No workflow_runs found in the DB.');
  return row!.id as string;
}

function parseContent(s: string): Json | null {
  try { return JSON.parse(s) as Json; } catch { return null; }
}

/** Latest current-version artifact_produced per content.kind. */
function latestArtifactsByKind(
  db: Database,
  runId: string,
): Map<string, { content: Json; phase_id: string; sub_phase_id: string; produced_at: string }> {
  const raw = db as unknown as BetterSqlite3.Database;
  const rows = raw.prepare(
    `SELECT phase_id, sub_phase_id, produced_at, content
       FROM governed_stream
      WHERE workflow_run_id = ? AND is_current_version = 1 AND record_type = 'artifact_produced'
      ORDER BY produced_at ASC`,
  ).all(runId) as Array<{ phase_id: string; sub_phase_id: string; produced_at: string; content: string }>;
  const byKind = new Map<string, { content: Json; phase_id: string; sub_phase_id: string; produced_at: string }>();
  for (const r of rows) {
    const c = parseContent(r.content);
    if (!c) continue;
    const kind = typeof c.kind === 'string' ? c.kind : (r.sub_phase_id || 'unknown');
    // ORDER BY produced_at ASC → last write wins = newest.
    byKind.set(kind, { content: c, phase_id: r.phase_id, sub_phase_id: r.sub_phase_id, produced_at: r.produced_at });
  }
  return byKind;
}

// ── Comprehensive findings (bound + unbound), reusing surfacing primitives ──

interface ReportFinding extends ViewerFinding {
  bound: boolean;
}

function loadItemIdSets(db: Database, runId: string): { acs: Set<string>; keys: Set<string> } {
  const raw = db as unknown as BetterSqlite3.Database;
  const acs = new Set<string>();
  const keys = new Set<string>();
  const push = (rows: Array<{ content: string }>, isComp: boolean): void => {
    for (const r of rows) {
      const c = parseContent(r.content);
      if (!c) continue;
      if (typeof c.display_key === 'string') keys.add(c.display_key);
      const obj = (isComp ? c.component : c.user_story) as Json | undefined;
      if (obj && typeof obj.id === 'string') keys.add(obj.id);
      const acsArr = obj && Array.isArray(obj.acceptance_criteria) ? obj.acceptance_criteria : [];
      for (const ac of acsArr) { const id = (ac as Json)?.id; if (typeof id === 'string') acs.add(id); }
    }
  };
  push(raw.prepare(`SELECT content FROM governed_stream WHERE record_type='requirement_decomposition_node' AND is_current_version=1 AND workflow_run_id=?`).all(runId) as Array<{ content: string }>, false);
  push(raw.prepare(`SELECT content FROM governed_stream WHERE record_type='component_decomposition_node' AND is_current_version=1 AND workflow_run_id=?`).all(runId) as Array<{ content: string }>, true);
  return { acs, keys };
}

/** harness_id → whether its reviewed output was superseded (finding is stale). */
function buildSupersededHarnessCheck(db: Database, runId: string): (harnessId: string) => boolean {
  const raw = db as unknown as BetterSqlite3.Database;
  const reviewedByHarness = new Map<string, string>();
  for (const r of raw.prepare(`SELECT content FROM governed_stream WHERE record_type='reasoning_review_harness_record' AND is_current_version=1 AND workflow_run_id=?`).all(runId) as Array<{ content: string }>) {
    const c = parseContent(r.content);
    if (c && typeof c.harness_id === 'string' && typeof c.reviewed_agent_output_id === 'string') reviewedByHarness.set(c.harness_id, c.reviewed_agent_output_id);
  }
  const superseded = new Set<string>();
  for (const r of raw.prepare(`SELECT id FROM governed_stream WHERE workflow_run_id=? AND is_current_version=0`).all(runId) as Array<{ id: string }>) superseded.add(r.id);
  return (harnessId: string) => { const out = reviewedByHarness.get(harnessId); return out ? superseded.has(out) : false; };
}

/**
 * All SURFACED reasoning-review findings (HIGH/MEDIUM, not auto-fix, not
 * superseded), each tagged bound/unbound — a superset of the viewer's shipped
 * (bound-only) set. Reuses the same surfacing primitives the executor uses.
 */
function loadAllFindings(db: Database, runId: string): { findings: ReportFinding[]; summary: { total: number; surfaced: number; bound: number; unbound: number; by_severity: { HIGH: number; MEDIUM: number } } } {
  const raw = db as unknown as BetterSqlite3.Database;
  const { acs, keys } = loadItemIdSets(db, runId);
  const isSuperseded = buildSupersededHarnessCheck(db, runId);
  const rows = raw.prepare(`SELECT id, content FROM governed_stream WHERE record_type='reasoning_review_finding_record' AND is_current_version=1 AND workflow_run_id=? ORDER BY produced_at ASC`).all(runId) as Array<{ id: string; content: string }>;
  const findings: ReportFinding[] = [];
  const summary = { total: rows.length, surfaced: 0, bound: 0, unbound: 0, by_severity: { HIGH: 0, MEDIUM: 0 } };
  for (const r of rows) {
    const c = parseContent(r.content) as ReasoningReviewFindingRecordContent | null;
    if (!c) continue;
    if (c.severity !== 'HIGH' && c.severity !== 'MEDIUM') continue;
    if (AUTO_FIX_VALIDATORS.has(c.validator_id)) continue;
    if (typeof c.harness_id === 'string' && isSuperseded(c.harness_id)) continue;
    summary.surfaced++;
    summary.by_severity[c.severity]++;
    const cited = extractCitedIds(c);
    const acIds = cited.filter((id) => acs.has(id));
    const dkeys = cited.filter((id) => keys.has(id));
    const bound = acIds.length > 0 || dkeys.length > 0;
    if (bound) summary.bound++; else summary.unbound++;
    findings.push({
      record_id: r.id, validator_id: c.validator_id, severity: c.severity,
      finding_type: c.finding_type, summary: c.summary, detail: c.detail, recommendation: c.recommendation,
      category: REASONING_PROCESS_VALIDATORS.has(c.validator_id) ? 'process' : 'artifact',
      cited_ids: cited, ac_ids: [...new Set(acIds)], display_keys: [...new Set(dkeys)], bound,
    });
  }
  return { findings, summary };
}

// ── Packet coherence + coverage gaps ─────────────────────────────────

function latestByType(db: Database, runId: string, recordType: string): Json | null {
  const raw = db as unknown as BetterSqlite3.Database;
  const row = raw.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 AND record_type=? ORDER BY produced_at DESC LIMIT 1`).get(runId, recordType) as { content?: string } | undefined;
  return row?.content ? parseContent(row.content) : null;
}

function allByType(db: Database, runId: string, recordType: string): Json[] {
  const raw = db as unknown as BetterSqlite3.Database;
  const rows = raw.prepare(`SELECT content FROM governed_stream WHERE workflow_run_id=? AND is_current_version=1 AND record_type=? ORDER BY produced_at ASC`).all(runId, recordType) as Array<{ content: string }>;
  return rows.map((r) => parseContent(r.content)).filter((x): x is Json => x !== null);
}

// ── Section metadata (friendly labels + phase grouping) ──────────────

const KIND_META: Record<string, { phase: string; label: string }> = {
  // P0
  workspace_classification: { phase: '0', label: 'Workspace Classification' },
  intent_statement: { phase: '0', label: 'Intent Statement' },
  prior_decision_summary: { phase: '0', label: 'Brownfield Continuity' },
  collision_risk_report: { phase: '0', label: 'Vocabulary Collision Check' },
  // P1
  intent_discovery: { phase: '1', label: 'Product Intent Discovery' },
  scope_classification: { phase: '1', label: 'Scope Bounding' },
  compliance_context: { phase: '1', label: 'Compliance Context' },
  technical_constraints_discovery: { phase: '1', label: 'Technical Constraints' },
  compliance_retention_discovery: { phase: '1', label: 'Compliance & Retention' },
  vv_requirements_discovery: { phase: '1', label: 'V&V Requirements' },
  canonical_vocabulary_discovery: { phase: '1', label: 'Canonical Vocabulary' },
  business_domains_bloom: { phase: '1', label: 'Business Domains & Personas' },
  user_journey_bloom: { phase: '1', label: 'User Journeys' },
  system_workflow_bloom: { phase: '1', label: 'System Workflows' },
  entities_bloom: { phase: '1', label: 'Entities' },
  integrations_qa_bloom: { phase: '1', label: 'Integrations & Quality Attributes' },
  release_plan: { phase: '1', label: 'Release Plan' },
  // P3
  system_boundary: { phase: '3', label: 'System Boundary' },
  system_requirements: { phase: '3', label: 'System Requirements' },
  interface_contracts: { phase: '3', label: 'Interface Contracts' },
  // P4
  software_domains: { phase: '4', label: 'Software Domains' },
  architectural_decisions: { phase: '4', label: 'Architectural Decisions (ADRs)' },
  // P5
  api_definitions: { phase: '5', label: 'API Definitions' },
  error_handling_strategies: { phase: '5', label: 'Error-Handling Strategies' },
  configuration_parameters: { phase: '5', label: 'Configuration Parameters' },
  entity_ownership_map: { phase: '5', label: 'Entity Ownership Map' },
  // P8
  functional_evaluation_plan: { phase: '8', label: 'Functional Evaluation Plan' },
  quality_evaluation_plan: { phase: '8', label: 'Quality Evaluation Plan' },
  reasoning_evaluation_plan: { phase: '8', label: 'Reasoning Evaluation Plan' },
};

const COVERAGE_KINDS = new Set([
  'task_ac_coverage_report', 'test_coverage_report', 'evaluation_coverage_report', 'consistency_report',
]);

const PHASE_TITLES: Record<string, string> = {
  '0': 'P0 · Workspace Init', '1': 'P1 · Intent & Discovery', '2': 'P2 · Requirements',
  '3': 'P3 · System Spec', '4': 'P4 · Architecture', '5': 'P5 · Technical Spec',
  '6': 'P6 · Tasks', '7': 'P7 · Tests', '8': 'P8 · Evaluation',
};

// ── Report assembly ──────────────────────────────────────────────────

interface ReportData {
  meta: {
    db: string; run_id: string; generated_at: string;
    product_name: string | null; phase_id: string | null; sub_phase_id: string | null; run_status: string;
    totals: ViewerSnapshot['totals'];
  };
  snapshot: ViewerSnapshot;
  findings: { list: ReportFinding[]; summary: ReturnType<typeof loadAllFindings>['summary'] };
  sections: Array<{ phase: string; kind: string; label: string; sub_phase_id: string; produced_at: string; content: Json }>;
  coverage: Array<{ phase: string; kind: string; label: string; content: Json }>;
  coherence: Json | null;
  coverage_gaps: Json[];
}

function buildReport(db: Database, runId: string, dbPath: string, generatedAt: string): ReportData {
  const provider = new DecompViewerDataProvider(db);
  const snapshot = provider.getSnapshot(runId);
  const findings = loadAllFindings(db, runId);
  const byKind = latestArtifactsByKind(db, runId);

  const sections: ReportData['sections'] = [];
  const coverage: ReportData['coverage'] = [];
  for (const [kind, a] of byKind) {
    if (COVERAGE_KINDS.has(kind)) {
      coverage.push({ phase: a.phase_id, kind, label: prettyKind(kind), content: a.content });
      continue;
    }
    const meta = KIND_META[kind];
    if (!meta) continue; // skip bloom-index/handoff/etc. kinds not meant for display
    sections.push({ phase: meta.phase, kind, label: meta.label, sub_phase_id: a.sub_phase_id, produced_at: a.produced_at, content: a.content });
  }
  sections.sort((x, y) => Number(x.phase) - Number(y.phase) || x.label.localeCompare(y.label));

  return {
    meta: {
      db: dbPath, run_id: runId, generated_at: generatedAt,
      product_name: snapshot.intent_summary?.product_name ?? null,
      phase_id: snapshot.phase_id, sub_phase_id: snapshot.sub_phase_id, run_status: snapshot.run_status,
      totals: snapshot.totals,
    },
    snapshot,
    findings: { list: findings.findings, summary: findings.summary },
    sections,
    coverage,
    coherence: latestByType(db, runId, 'packet_synthesis_failure'),
    coverage_gaps: allByType(db, runId, 'coverage_gap'),
  };
}

function prettyKind(kind: string): string {
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── HTML ─────────────────────────────────────────────────────────────

function renderHtml(report: ReportData): string {
  // Data goes in a JSON <script> to avoid HTML/JS escaping pitfalls; the
  // renderer parses it at load. Only `</script` needs neutralizing.
  const dataJson = JSON.stringify(report).replace(/<\/(script)/gi, '<\\/$1');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Decomposition Report — ${escapeHtml(report.meta.product_name ?? report.meta.run_id.slice(0, 8))}</title>
<style>${CSS}</style>
</head>
<body>
<div id="app"><div class="loading">Rendering…</div></div>
<script id="report-data" type="application/json">${dataJson}</script>
<script>${CLIENT_JS}</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

const CSS = String.raw`
:root { color-scheme: light dark; --bg:#fff; --fg:#1c2128; --muted:#6a737d; --line:#e1e4e8; --panel:#f6f8fa; --accent:#0969da; --high:#cf222e; --med:#9a6700; --ok:#1a7f37; --chip:#eaeef2; }
@media (prefers-color-scheme: dark){ :root{ --bg:#0d1117; --fg:#c9d1d9; --muted:#8b949e; --line:#30363d; --panel:#161b22; --accent:#58a6ff; --high:#ff7b72; --med:#d29922; --ok:#3fb950; --chip:#21262d; } }
*{box-sizing:border-box} html,body{margin:0;height:100%} body{font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:var(--fg);background:var(--bg)}
.loading{padding:40px;color:var(--muted)}
#app{display:grid;grid-template-columns:270px minmax(0,1fr) 360px;grid-template-rows:auto 1fr;height:100vh}
body.detail-collapsed #app{grid-template-columns:270px minmax(0,1fr)}
body.detail-collapsed #detail{display:none}
header{grid-column:1/-1;border-bottom:1px solid var(--line);padding:8px 14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:var(--panel)}
header h1{font-size:15px;margin:0;font-weight:600}
header .meta{color:var(--muted);font-size:12px}
header .totals{margin-left:auto;display:flex;gap:10px;flex-wrap:wrap}
.pill{background:var(--chip);border-radius:10px;padding:1px 8px;font-size:11px;white-space:nowrap}
nav{overflow:auto;border-right:1px solid var(--line);padding:6px 0}
nav .grp{padding:6px 12px 2px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
nav a{display:flex;justify-content:space-between;gap:8px;padding:4px 12px 4px 20px;cursor:pointer;text-decoration:none;color:var(--fg);border-left:2px solid transparent}
nav a:hover{background:var(--panel)} nav a.active{background:var(--panel);border-left-color:var(--accent);font-weight:600}
nav a .ct{color:var(--muted);font-size:11px}
main{overflow:auto;padding:14px 18px}
main h2{font-size:16px;margin:0 0 4px} main .sub{color:var(--muted);margin:0 0 12px;font-size:12px}
.search{width:100%;max-width:420px;padding:5px 9px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);margin-bottom:12px}
.card{border:1px solid var(--line);border-radius:8px;margin:0 0 8px;overflow:hidden}
.card>.hd{padding:7px 10px;cursor:pointer;display:flex;gap:8px;align-items:baseline;background:var(--panel)}
.card>.hd:hover{filter:brightness(.98)}
.card .idcode{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--accent);font-weight:600}
.card .ttl{font-weight:500} .card .meta2{color:var(--muted);font-size:11px;margin-left:auto}
.card>.bd{padding:8px 12px;border-top:1px solid var(--line);display:none}
.card.open>.bd{display:block}
.kv{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0 0 8px}
.kv dt{color:var(--muted)} .kv dd{margin:0;white-space:pre-wrap;word-break:break-word}
.subarr{margin:6px 0} .subarr>.lbl{font-size:11px;text-transform:uppercase;color:var(--muted);letter-spacing:.04em;margin-bottom:3px}
.mini{border:1px solid var(--line);border-radius:6px;padding:5px 8px;margin:3px 0;background:var(--bg)}
pre.raw{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:8px;overflow:auto;font-size:11.5px;max-height:420px}
.tree ul{list-style:none;margin:0;padding-left:16px} .tree>ul{padding-left:0}
.tree li{margin:1px 0}
.tw{display:flex;gap:6px;align-items:baseline;padding:2px 4px;border-radius:5px;cursor:pointer}
.tw:hover{background:var(--panel)} .tw.sel{background:var(--panel);outline:1px solid var(--accent)}
.tw .tog{width:12px;color:var(--muted);flex:none} .tw .k{font-family:ui-monospace,monospace;font-size:11.5px}
.tw .lab{color:var(--fg)} .tw .dim{color:var(--muted);font-size:11px}
.badge{font-size:10px;border-radius:8px;padding:0 6px;font-weight:600}
.badge.tier{background:var(--chip);color:var(--muted)} .badge.high{background:color-mix(in srgb,var(--high) 18%,transparent);color:var(--high)}
.badge.med{background:color-mix(in srgb,var(--med) 20%,transparent);color:var(--med)} .badge.layer{background:var(--chip);color:var(--accent)}
.badge.st{background:var(--chip);color:var(--muted)}
.kids{display:none} li.open>.kids{display:block}
.fbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.fbar select,.fbar input{padding:4px 7px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
.finding{border:1px solid var(--line);border-left-width:3px;border-radius:6px;padding:7px 10px;margin:5px 0}
.finding.HIGH{border-left-color:var(--high)} .finding.MEDIUM{border-left-color:var(--med)}
.finding .fh{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.finding .sev{font-weight:700;font-size:11px} .finding.HIGH .sev{color:var(--high)} .finding.MEDIUM .sev{color:var(--med)}
.finding .vid{font-family:ui-monospace,monospace;font-size:11px;color:var(--muted)}
.finding .sm{font-weight:500;margin:3px 0} .finding .dt{color:var(--muted);white-space:pre-wrap;font-size:12px}
.finding .cites{margin-top:4px;display:flex;gap:4px;flex-wrap:wrap}
.tag{font-size:10.5px;background:var(--chip);border-radius:8px;padding:0 6px;font-family:ui-monospace,monospace}
.tag.unbound{color:var(--med)}
.covrow{display:flex;gap:10px;align-items:center;margin:4px 0}
.bar{flex:1;height:8px;background:var(--chip);border-radius:5px;overflow:hidden;max-width:280px}
.bar>i{display:block;height:100%;background:var(--ok)} .bar.warn>i{background:var(--med)} .bar.bad>i{background:var(--high)}
.empty{color:var(--muted);padding:20px 0}
a.xref{color:var(--accent);cursor:pointer;text-decoration:none;font-family:ui-monospace,monospace} a.xref:hover{text-decoration:underline}

.chip{font-size:9.5px;border-radius:8px;padding:0 5px;margin-left:4px;font-weight:600;white-space:nowrap}
.chip.nfr{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent)}
.chip.wf{background:var(--chip);color:var(--muted)}
.linkgrp{margin:6px 0} .linkgrp>.lbl{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:3px}
#detail{overflow:hidden;border-left:1px solid var(--line);background:var(--panel);display:flex;flex-direction:column;min-height:0}
#detail .dhd{position:sticky;top:0;background:var(--panel);border-bottom:1px solid var(--line);padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex:none}
#detail .dhd .dttl{font-size:12.5px;font-weight:600;word-break:break-word}
#detail .dhd .dkind{font-weight:400;color:var(--muted)}
#detail .dbody{padding:10px 12px;overflow:auto;min-height:0}
#detail .dplaceholder{padding:22px 14px;color:var(--muted)}
#detail .dhint{font-size:12px;line-height:1.6}
#detail .dbody>.subarr:first-child,#detail .dbody>.kv:first-child{margin-top:0}
.detail-toggle{background:var(--chip);border:1px solid var(--line);border-radius:6px;color:var(--fg);padding:2px 9px;cursor:pointer;font-size:11px;white-space:nowrap}
.detail-toggle:hover{filter:brightness(.97)}
`;

const CLIENT_JS = String.raw`
"use strict";
const DATA = JSON.parse(document.getElementById('report-data').textContent);
const S = DATA.snapshot;
const app = document.getElementById('app');
const PHASES = {'0':'P0 · Workspace','1':'P1 · Intent & Discovery','2':'P2 · Requirements','3':'P3 · System Spec','4':'P4 · Architecture','5':'P5 · Technical Spec','6':'P6 · Tasks','7':'P7 · Tests','8':'P8 · Evaluation'};
const $ = (t,c,txt)=>{ const e=document.createElement(t); if(c)e.className=c; if(txt!=null)e.textContent=txt; return e; };
const esc = s => String(s==null?'':s);
const truncate = (s,n)=>{ s=String(s==null?'':s); return s.length>n? s.slice(0,n-1)+'…' : s; };
const compact = o => Object.entries(o).filter(([k,v])=>v!=null&&v!=='').map(([k,v])=>k+': '+(typeof v==='object'?JSON.stringify(v):String(v))).join('  |  ');
const arr = (o,k)=> (o && Array.isArray(o[k])) ? o[k] : [];

// ── indices ──────────────────────────────────────────────────────
const sec = {}; for(const s of DATA.sections) sec[s.kind]=s.content;
const journeys = (S.phase1_anchors||[]).filter(a=>a.kind==='user_journey');
const journeyById = {}; journeys.forEach(j=>journeyById[j.id]=j);
const workflows = (S.phase1_anchors||[]).filter(a=>a.kind==='system_workflow');
const nodeByNodeId = {}, nodesByParent = {};
for(const n of S.nodes||[]){ nodeByNodeId[n.node_id]=n; const p=n.parent_node_id||'__root__'; (nodesByParent[p]=nodesByParent[p]||[]).push(n); }
const nodeByKey = {}; for(const n of S.nodes||[]) nodeByKey[n.display_key]=n;
const realByAc = {}, realByComp = {}, realByKey = {};
for(const r of S.realization_nodes||[]){ realByKey[r.display_key]=r; for(const ac of r.realizes_ac_ids||[]) (realByAc[ac]=realByAc[ac]||[]).push(r); if(r.component_key) (realByComp[r.component_key]=realByComp[r.component_key]||[]).push(r); }
const nfrByUs = {};
for(const a of S.nfr_applications||[]) for(const us of a.applies_to_requirements||[]) (nfrByUs[us]=nfrByUs[us]||[]).push(a.nfr_id);
const findingsByItem = {};
for(const f of DATA.findings.list) for(const id of [...f.ac_ids,...f.display_keys]) (findingsByItem[id]=findingsByItem[id]||[]).push(f);
const releases = (S.releases||[]).slice().sort((a,b)=>(a.ordinal||0)-(b.ordinal||0));
const frRoots = (S.roots||[]).filter(r=>r.root_kind==='fr');
const nfrRoots = (S.roots||[]).filter(r=>r.root_kind==='nfr');
const compAdrs = {}, compApi = {}, compCfg = {}, compErr = {};
for(const adr of arr(sec.architectural_decisions,'adrs')) for(const c of adr.governs_components||[]) (compAdrs[c]=compAdrs[c]||[]).push(adr);
for(const d of arr(sec.api_definitions,'definitions')) compApi[d.component_id]=d.endpoints||[];
for(const p of arr(sec.configuration_parameters,'params')) (compCfg[p.component_id]=compCfg[p.component_id]||[]).push(p);
for(const e of arr(sec.error_handling_strategies,'strategies')) (compErr[e.component_id]=compErr[e.component_id]||[]).push(e);
const componentNodes = (S.realization_nodes||[]).filter(r=>r.layer==='component');
const componentNodeByKey = {}; for(const c of componentNodes) componentNodeByKey[c.display_key]=c;

// ── nav / lenses ─────────────────────────────────────────────────
const views = [
  { id:'trace', grp:'Traceability', label:'Trace (intent → release → story → component)', count:frRoots.length },
  { id:'components', grp:'Traceability', label:'Components & linkages', count:new Set([...componentNodes.map(c=>c.display_key), ...Object.keys(realByComp)]).size },
  { id:'crosscut', grp:'Traceability', label:'Cross-cutting concerns', count:nfrRoots.length+arr(sec.compliance_retention_discovery,'complianceExtractedItems').length+arr(sec.technical_constraints_discovery,'technicalConstraints').length+workflows.length },
  { id:'validators', grp:'Quality', label:'Validator findings', count:DATA.findings.summary.surfaced },
];
if(DATA.coherence) views.push({ id:'coherence', grp:'Quality', label:'Packet coherence', count:DATA.coherence.total_blocking_failures ?? 0 });
if((DATA.coverage||[]).length || (DATA.coverage_gaps||[]).length) views.push({ id:'coverage', grp:'Quality', label:'Coverage & consistency', count:(DATA.coverage||[]).length });
views.push({ id:'deepdive', grp:'Deep dive', label:'Raw artifacts (by phase)', count:DATA.sections.length });

function layout(){
  app.innerHTML='';
  const m=DATA.meta;
  const h=$('header'); h.appendChild($('h1',null,'Decomposition Report'));
  h.appendChild($('span','meta', (m.product_name?truncate(m.product_name,64)+' · ':'') + 'run '+m.run_id.slice(0,8)+' · '+(m.run_status||'')+(m.phase_id?(' · at P'+m.phase_id+(m.sub_phase_id?'/'+m.sub_phase_id:'')):'')));
  const tot=$('div','totals'); const T=m.totals||{};
  for(const [k,v] of [['stories',frRoots.length],['components',views[1].count],['nfrs',nfrRoots.length],['findings',DATA.findings.summary.surfaced],['blocking',DATA.coherence?DATA.coherence.total_blocking_failures:undefined]]) if(v!=null) tot.appendChild($('span','pill',k+' '+v));
  h.appendChild(tot);
  const tgl=$('button','detail-toggle','Hide details ▸'); tgl.title='Show / hide the details panel';
  tgl.onclick=()=>{ const c=document.body.classList.toggle('detail-collapsed'); tgl.textContent=c?'◂ Show details':'Hide details ▸'; };
  h.appendChild(tgl); app.appendChild(h);
  const nav=$('nav'); let grp=null;
  for(const v of views){ if(v.grp!==grp){ grp=v.grp; nav.appendChild($('div','grp',grp)); } const a=$('a'); a.dataset.id=v.id; a.appendChild($('span','lab',v.label)); a.appendChild($('span','ct',String(v.count))); a.onclick=()=>select(v.id); nav.appendChild(a); }
  app.appendChild(nav);
  const main=$('main'); main.id='main'; app.appendChild(main);
  const detail=$('aside'); detail.id='detail'; detail.appendChild(detailPlaceholder()); app.appendChild(detail);
  select(location.hash? location.hash.slice(1) : 'trace');
}
function select(id){
  for(const a of document.querySelectorAll('nav a')) a.classList.toggle('active', a.dataset.id===id);
  location.hash=id;
  const main=document.getElementById('main'); main.innerHTML=''; main.scrollTop=0;
  clearDetail();
  ({ trace:renderTrace, components:renderComponents, crosscut:renderCrossCutting, validators:renderFindings, coherence:renderCoherence, coverage:renderCoverage, deepdive:renderDeepDive }[id] || (()=>main.appendChild($('div','empty','Select a view.'))))(main);
}

// ── shared row / chip / link helpers ─────────────────────────────
function chip(cls,txt){ return $('span','chip '+cls,txt); }
function tag(t){ return $('span','tag',esc(t)); }
function topSev(id){ const fs=findingsByItem[id]||[]; return fs.some(f=>f.severity==='HIGH')?'high':'med'; }
function storyText(n){ if(!n) return ''; const p=[n.story_role,n.story_action,n.story_outcome].filter(Boolean).join(' · '); return p||n.display_key; }
let lastSel=null;
function selectRow(tw,onInspect){ if(lastSel)lastSel.classList.remove('sel'); tw.classList.add('sel'); lastSel=tw; if(onInspect)onInspect(); }
// a collapsible tree row with an optional inspector action
function nodeLi(code,kind,label,badges,expandable,onInspect){
  const li=$('li'); const tw=$('div','tw');
  const tog=$('span','tog', expandable===false?'':'▸'); tw.appendChild(tog);
  tw.appendChild($('span','badge layer',kind));
  tw.appendChild($('span','k',code));
  tw.appendChild($('span','lab dim',truncate(label,96)));
  for(const [c,t] of (badges||[])) if(t) tw.appendChild($('span',c,esc(t)));
  const kids=$('ul','kids'); li.appendChild(tw); li.appendChild(kids);
  tw.onclick=()=>{ li.classList.toggle('open'); tog.textContent=li.classList.contains('open')?'▾':(expandable===false?'':'▸'); selectRow(tw,onInspect); };
  return li;
}
function leafRow(r){
  const li=$('li'); const tw=$('div','tw'); tw.appendChild($('span','tog',''));
  tw.appendChild($('span','badge layer',r.layer));
  tw.appendChild($('span','k',r.display_key));
  tw.appendChild($('span','lab',truncate(r.title||'',80)));
  const f=(findingsByItem[r.display_key]||[]).length; if(f) tw.appendChild($('span','badge '+topSev(r.display_key),'⚑'+f));
  tw.onclick=()=>selectRow(tw,()=>inspectRealization(r));
  li.appendChild(tw); return li;
}
function xref(id,onClick){ const a=$('a','xref',id); a.onclick=(e)=>{ e.stopPropagation(); (onClick||(()=>inspectAnyId(id)))(); }; return a; }
function linkGroup(label,els){ const g=$('div','linkgrp'); g.appendChild($('div','lbl',label+' ('+els.length+')')); const row=$('div','cites'); for(const el of els) row.appendChild(el); g.appendChild(row); return g; }
function miniList(label,strings){ const sa=$('div','subarr'); sa.appendChild($('div','lbl',label+' ('+strings.length+')')); for(const s of strings){ const mini=$('div','mini'); mini.textContent=s; sa.appendChild(mini); } return sa; }

// ── LENS 1: Trace (release → journey → story → AC → realization) ──
function renderTrace(main){
  main.appendChild($('h2',null,'Traceability'));
  main.appendChild($('p','sub','Intent → release → user journey → user story → acceptance criterion → realization (component / task / test / data-model). Chips show cross-cutting concerns (NFRs, workflows) in context; ⚑ badges mark validator findings.'));
  // intent header
  const intent=$('div','card open'); const ih=$('div','hd'); ih.appendChild($('span','badge layer','INTENT')); ih.appendChild($('span','ttl', (S.intent_summary&&S.intent_summary.product_name)||'Product concept'));
  const ib=$('div','bd'); if(S.intent_summary){ if(S.intent_summary.raw_intent){ const g=$('div','linkgrp'); g.appendChild($('div','lbl','Raw intent')); g.appendChild($('div',null,truncate(S.intent_summary.raw_intent,2000))); ib.appendChild(g); } if(S.intent_summary.product_description){ const g=$('div','linkgrp'); g.appendChild($('div','lbl','Product concept')); g.appendChild($('div',null,S.intent_summary.product_description)); ib.appendChild(g); } }
  ih.onclick=()=>intent.classList.toggle('open'); intent.append(ih,ib); main.appendChild(intent);
  const search=$('input','search'); search.placeholder='Filter stories / journeys / releases…'; main.appendChild(search);
  const tree=$('div','tree'); const ul=$('ul'); tree.appendChild(ul); main.appendChild(tree);
  const byRel={}; for(const r of frRoots) (byRel[r.release_id||'__backlog__']=byRel[r.release_id||'__backlog__']||[]).push(r);
  function match(root,f){ if(!f)return true; const n=nodeByNodeId[root.root_fr_id]||{}; return (root.display_key+' '+storyText(n)+' '+(n.traces_to||[]).join(' ')).toLowerCase().includes(f); }
  function draw(f){
    ul.innerHTML='';
    const relOrder=[...releases, {release_id:'__backlog__',ordinal:null,name:'Backlog / unassigned'}];
    for(const rel of relOrder){
      const roots=byRel[rel.release_id]||[]; if(!roots.length) continue;
      const relLi=nodeLi('R'+(rel.ordinal!=null?rel.ordinal:'—'),'RELEASE', rel.name||rel.release_id, [['badge st', roots.length+' stories']], true, ()=>inspectRelease(rel));
      relLi.classList.add('open'); relLi.querySelector('.tog').textContent='▾';
      const relKids=relLi.querySelector('.kids');
      const byJ={}, noJ=[];
      for(const root of roots){ const n=nodeByNodeId[root.root_fr_id]; const js=((n&&n.traces_to)||[]).filter(id=>journeyById[id]); if(js.length){ for(const j of js)(byJ[j]=byJ[j]||[]).push(root); } else noJ.push(root); }
      let any=false;
      for(const jid of Object.keys(byJ).sort()){
        const jroots=byJ[jid].filter(r=>match(r,f)); if(!jroots.length) continue;
        const j=journeyById[jid];
        const jLi=nodeLi(jid,'JOURNEY',(j&&j.label)||jid,[['badge st', jroots.length+'']], true, ()=>inspectJourney(j));
        const jk=jLi.querySelector('.kids'); for(const root of jroots) jk.appendChild(storyLi(root)); relKids.appendChild(jLi); any=true;
      }
      const njF=noJ.filter(r=>match(r,f));
      if(njF.length){ const njLi=nodeLi('—','JOURNEY','(no journey linked)',[['badge st',njF.length+'']], true); const njk=njLi.querySelector('.kids'); for(const root of njF) njk.appendChild(storyLi(root)); relKids.appendChild(njLi); any=true; }
      if(any) ul.appendChild(relLi);
    }
    if(!ul.children.length) ul.appendChild($('div','empty','No stories match.'));
  }
  draw(''); search.oninput=()=>draw(search.value.trim().toLowerCase());
}
function storyLi(root){
  const n=nodeByNodeId[root.root_fr_id]||{display_key:root.display_key, node_id:root.root_fr_id, acceptance_criteria:[]};
  const badges=[['badge tier', n.tier?('T'+n.tier):(n.status||'')]];
  const fc=(findingsByItem[n.display_key]||[]).length; if(fc) badges.push(['badge '+topSev(n.display_key),'⚑'+fc]);
  const li=nodeLi(n.display_key,'US', storyText(n), badges, true, ()=>inspectNode(n));
  const tw=li.querySelector('.tw');
  for(const nfr of (nfrByUs[n.display_key]||[]).slice(0,4)) tw.appendChild(chip('nfr','NFR '+nfr));
  for(const w of ((n.traces_to||[]).filter(id=>String(id).startsWith('WF-'))).slice(0,3)) tw.appendChild(chip('wf', w));
  const kids=li.querySelector('.kids');
  drawStoryChildren(kids, n.node_id);
  for(const ac of (n.acceptance_criteria||[])) kids.appendChild(acLi(n,ac)); // the root story's own ACs
  return li;
}
function drawStoryChildren(container, parentNodeId){
  const kids=(nodesByParent[parentNodeId]||[]).slice().sort((a,b)=>a.display_key.localeCompare(b.display_key));
  for(const n of kids){
    const badges=[['badge tier', n.tier?('T'+n.tier):(n.status||'')]];
    const fc=(findingsByItem[n.display_key]||[]).length; if(fc) badges.push(['badge '+topSev(n.display_key),'⚑'+fc]);
    const li=nodeLi(n.display_key,'US', storyText(n), badges, true, ()=>inspectNode(n));
    const ck=li.querySelector('.kids');
    drawStoryChildren(ck, n.node_id);                                  // deeper decomposition
    for(const ac of (n.acceptance_criteria||[])) ck.appendChild(acLi(n,ac)); // this node's ACs
    container.appendChild(li);
  }
}
function acLi(n,ac){
  const badges=[]; const f=(findingsByItem[ac.id]||[]).length; if(f) badges.push(['badge '+topSev(ac.id),'⚑'+f]);
  const real=realByAc[ac.id]||[];
  const li=nodeLi(ac.id,'AC', ac.description||ac.measurable_condition||'', badges, real.length>0, ()=>inspectAc(n,ac));
  const k=li.querySelector('.kids'); for(const r of real) k.appendChild(leafRow(r));
  if(!real.length) li.querySelector('.tog').textContent='';
  return li;
}

// ── LENS 2: Components & linkages ────────────────────────────────
function renderComponents(main){
  main.appendChild($('h2',null,'Components & linkages'));
  main.appendChild($('p','sub','Each component and everything linked to it — the stories/ACs it realizes, its data models, APIs, config, error-handling, the ADRs that govern it, and its tasks + tests.'));
  const search=$('input','search'); search.placeholder='Filter components…'; main.appendChild(search);
  const host=$('div'); main.appendChild(host);
  const compIds=new Set([...componentNodes.map(c=>c.display_key), ...Object.keys(realByComp), ...Object.keys(compAdrs), ...Object.keys(compApi), ...Object.keys(compCfg)]);
  function draw(f){
    host.innerHTML='';
    for(const cid of [...compIds].sort()){
      if(f && !cid.toLowerCase().includes(f)) continue;
      const cnode=componentNodeByKey[cid];
      const under=realByComp[cid]||[];
      const tasks=under.filter(r=>r.layer==='task'), tests=under.filter(r=>r.layer==='test'), dms=under.filter(r=>r.layer==='data_model');
      const usSet=new Set(), acSet=new Set(); for(const r of under){ for(const u of r.serves_us_ids||[]) usSet.add(u); for(const a of r.realizes_ac_ids||[]) acSet.add(a); }
      if(cnode) for(const u of cnode.serves_us_ids||[]) usSet.add(u);
      const card=$('div','card'); const hd=$('div','hd'); hd.appendChild($('span','idcode',cid)); hd.appendChild($('span','ttl',(cnode&&cnode.title)||''));
      hd.appendChild($('span','meta2', tasks.length+' tasks · '+tests.length+' tests · '+dms.length+' dm'+(compAdrs[cid]?' · '+compAdrs[cid].length+' ADR':'')));
      const bd=$('div','bd');
      if(usSet.size) bd.appendChild(linkGroup('Serves user stories', [...usSet].sort().map(u=>xref(u))));
      if(acSet.size) bd.appendChild(linkGroup('Realizes ACs', [...acSet].sort().map(a=>xref(a))));
      if(dms.length) bd.appendChild(linkGroup('Data models', dms.map(d=>xref(d.display_key,()=>inspectRealization(d)))));
      if((compApi[cid]||[]).length) bd.appendChild(miniList('APIs', compApi[cid].map(e=>compact(e))));
      if((compCfg[cid]||[]).length) bd.appendChild(miniList('Config params', compCfg[cid].map(p=>compact(p))));
      if((compErr[cid]||[]).length) bd.appendChild(miniList('Error handling', compErr[cid].map(s=>compact(s))));
      if((compAdrs[cid]||[]).length) bd.appendChild(miniList('ADRs governing this component', compAdrs[cid].map(a=>a.id+': '+a.title)));
      if(tasks.length) bd.appendChild(linkGroup('Tasks', tasks.map(t=>xref(t.display_key,()=>inspectRealization(t)))));
      if(tests.length) bd.appendChild(linkGroup('Tests', tests.map(t=>xref(t.display_key,()=>inspectRealization(t)))));
      const fs=findingsByItem[cid]||[]; if(fs.length){ const sa=$('div','subarr'); sa.appendChild($('div','lbl','Findings ('+fs.length+')')); for(const ff of fs) sa.appendChild(findingEl(ff)); bd.appendChild(sa); }
      hd.onclick=()=>card.classList.toggle('open'); card.append(hd,bd); host.appendChild(card);
    }
    if(!host.children.length) host.appendChild($('div','empty','No components match.'));
  }
  draw(''); search.oninput=()=>draw(search.value.trim().toLowerCase());
}

// ── LENS 3: Cross-cutting concerns ───────────────────────────────
function renderCrossCutting(main){
  main.appendChild($('h2',null,'Cross-cutting concerns'));
  main.appendChild($('p','sub','Concerns that span the whole system — each with the stories / components it touches. These also appear as chips on the trace and in each component.'));
  const fams=[];
  fams.push(family('Non-Functional Requirements', nfrRoots.map(r=>{ const node=nodeByNodeId[r.root_fr_id]; const apps=(S.nfr_applications||[]).filter(a=>a.nfr_id===r.display_key); const us=[...new Set(apps.flatMap(a=>a.applies_to_requirements||[]))]; return { id:r.display_key, title:node?storyText(node):r.title, touches:us, raw:node }; })));
  fams.push(family('Compliance & Retention', arr(sec.compliance_retention_discovery,'complianceExtractedItems').map(c=>({id:c.id,title:c.text||c.type,meta:c.type,raw:c}))));
  fams.push(family('Integrations', arr(sec.integrations_qa_bloom,'integrations').map(i=>({id:i.id,title:i.name,meta:i.category,raw:i}))));
  fams.push(family('Quality Attributes / V&V', [...arr(sec.integrations_qa_bloom,'qualityAttributes'), ...arr(sec.vv_requirements_discovery,'vvRequirements')].map(q=>({id:q.id||q.name||'',title:q.name||q.description||q.text||'',raw:q}))));
  fams.push(family('Technical Constraints', arr(sec.technical_constraints_discovery,'technicalConstraints').map(t=>({id:t.id,title:t.text,meta:(t.category||'')+(t.technology?' · '+t.technology:''),raw:t}))));
  fams.push(family('System Workflows (cross-journey)', workflows.map(w=>{ const us=(S.nodes||[]).filter(n=>(n.traces_to||[]).includes(w.id)).map(n=>n.display_key); return {id:w.id,title:w.label,touches:[...new Set(us)],raw:w}; })));
  fams.push(family('Canonical Vocabulary', arr(sec.canonical_vocabulary_discovery,'canonicalVocabulary').map(v=>({id:v.id||v.term,title:v.term,meta:v.definition,raw:v}))));
  fams.push(family('Architectural Decisions (multi-component)', arr(sec.architectural_decisions,'adrs').filter(a=>(a.governs_components||[]).length>1).map(a=>({id:a.id,title:a.title,meta:a.status,touches:a.governs_components||[],raw:a}))));
  fams.push(family('Shared / Referenced Entities', arr(sec.entity_ownership_map,'decisions').filter(d=>/shared|referenc/i.test(d.verdict||'')).map(d=>({id:d.concept_key,title:d.concept_name,meta:d.verdict,touches:d.member_component_ids||[],raw:d}))));
  let n=0; for(const fam of fams){ if(fam){ main.appendChild(fam); n++; } }
  if(!n) main.appendChild($('div','empty','No cross-cutting artifacts present.'));
}
function family(title, items){
  if(!items || !items.length) return null;
  const wrap=$('div'); wrap.appendChild($('div','grp',title+' ('+items.length+')'));
  for(const it of items){
    const card=$('div','card'); const hd=$('div','hd'); if(it.id) hd.appendChild($('span','idcode',it.id)); hd.appendChild($('span','ttl',truncate(it.title||'',110))); if(it.meta) hd.appendChild($('span','meta2',truncate(String(it.meta),70)));
    const fc=(findingsByItem[it.id]||[]).length; if(fc) hd.appendChild($('span','badge '+topSev(it.id),'⚑'+fc));
    const bd=$('div','bd');
    if(it.touches && it.touches.length) bd.appendChild(linkGroup('Touches', it.touches.map(id=>xref(id))));
    if(it.raw && typeof it.raw==='object') bd.appendChild(kvBlock(Object.fromEntries(Object.entries(it.raw).filter(([k,v])=>k!=='kind'&&(typeof v!=='object'||v===null)))));
    const fs=findingsByItem[it.id]||[]; for(const ff of fs) bd.appendChild(findingEl(ff));
    hd.onclick=()=>card.classList.toggle('open'); card.append(hd,bd); wrap.appendChild(card);
  }
  return wrap;
}

// ── inspector (right-side details panel) ─────────────────────────
function detailPlaceholder(){ const d=$('div','dplaceholder'); d.appendChild($('div','dhint','Select any item — a release, journey, user story, acceptance criterion, component, or cross-cutting concern — to see its fields, linkages, and validator findings here.')); return d; }
function clearDetail(){ const box=document.getElementById('detail'); if(!box)return; box.classList.remove('has-sel'); box.innerHTML=''; box.appendChild(detailPlaceholder()); if(lastSel){ lastSel.classList.remove('sel'); lastSel=null; } }
function inspect(title, bodyEl){
  const box=document.getElementById('detail'); if(!box)return;
  document.body.classList.remove('detail-collapsed');
  const t=document.querySelector('.detail-toggle'); if(t) t.textContent='Hide details ▸';
  box.classList.add('has-sel'); box.innerHTML='';
  const hd=$('div','dhd'); const idx=String(title).indexOf('  ·  ');
  const ttl=$('span','dttl'); if(idx>=0){ ttl.appendChild(document.createTextNode(title.slice(0,idx)+'  ')); ttl.appendChild($('span','dkind','· '+title.slice(idx+5))); } else ttl.textContent=title;
  hd.appendChild(ttl); const x=$('a','xref','✕'); x.title='Close'; x.onclick=clearDetail; hd.appendChild(x); box.appendChild(hd);
  const body=$('div','dbody'); body.appendChild(bodyEl); box.appendChild(body); body.scrollTop=0;
}
function kvBlock(obj){ const dl=$('dl','kv'); for(const [k,v] of Object.entries(obj)){ if(v==null||v===''||(Array.isArray(v)&&!v.length)||typeof v==='object')continue; dl.appendChild($('dt',null,k)); dl.appendChild($('dd',null,String(v))); } return dl; }
function appendFindings(b, ids){ const seen=new Set(),fs=[]; for(const id of ids)for(const f of (findingsByItem[id]||[])) if(!seen.has(f.record_id)){seen.add(f.record_id);fs.push(f);} if(!fs.length)return; const sa=$('div','subarr'); sa.appendChild($('div','lbl','Validator findings ('+fs.length+')')); for(const f of fs) sa.appendChild(findingEl(f)); b.appendChild(sa); }
function inspectRelease(rel){ const b=$('div'); const raw=rel.release_id&&rel.release_id!=='__backlog__'? (releases.find(r=>r.release_id===rel.release_id)||rel):rel; b.appendChild(kvBlock({ordinal:raw.ordinal,name:raw.name,description:raw.description,rationale:raw.rationale})); if(raw.counts) b.appendChild(miniList('Contains', Object.entries(raw.counts).map(([k,v])=>k+': '+v))); inspect((rel.name||'Release')+'  ·  Release', b); }
function inspectJourney(j){ if(!j)return; const b=$('div'); b.appendChild(kvBlock({id:j.id,label:j.label,sub_phase:j.sub_phase_id,description:j.description})); const us=frRoots.filter(r=>((nodeByNodeId[r.root_fr_id]||{}).traces_to||[]).includes(j.id)).map(r=>r.display_key); if(us.length) b.appendChild(linkGroup('User stories', us.map(u=>xref(u)))); inspect(j.label+'  ·  User Journey', b); }
function inspectNode(n){ if(!n)return; const b=$('div'); b.appendChild(kvBlock({display_key:n.display_key,kind:n.root_kind,tier:n.tier,status:n.status,priority:n.priority,role:n.story_role,action:n.story_action,outcome:n.story_outcome,traces_to:(n.traces_to||[]).join(', '),tier_rationale:n.tier_rationale})); const nfrs=nfrByUs[n.display_key]||[]; if(nfrs.length) b.appendChild(linkGroup('Qualified by NFRs', nfrs.map(x=>xref(x)))); if((n.acceptance_criteria||[]).length) b.appendChild(miniList('Acceptance criteria', n.acceptance_criteria.map(a=>a.id+': '+(a.description||a.measurable_condition||'')))); appendFindings(b,[n.display_key,...((n.acceptance_criteria||[]).map(a=>a.id))]); inspect(n.display_key+'  ·  '+(n.root_kind==='nfr'?'NFR':'User Story'), b); }
function inspectAc(n,ac){ const b=$('div'); b.appendChild(kvBlock({id:ac.id,description:ac.description,measurable_condition:ac.measurable_condition,under_story:n.display_key})); const real=realByAc[ac.id]||[]; if(real.length) b.appendChild(linkGroup('Realized by', real.map(r=>xref(r.display_key,()=>inspectRealization(r))))); appendFindings(b,[ac.id]); inspect(ac.id+'  ·  Acceptance Criterion', b); }
function inspectRealization(r){ if(!r)return; const b=$('div'); b.appendChild(kvBlock({display_key:r.display_key,layer:r.layer,title:r.title,status:r.status,component:r.component_key,entity_kind:r.entity_kind,serves_us:(r.serves_us_ids||[]).join(', '),realizes_ac:(r.realizes_ac_ids||[]).join(', ')})); if(r.component_key) b.appendChild(linkGroup('Component', [xref(r.component_key)])); appendFindings(b,[r.display_key]); inspect(r.display_key+'  ·  '+r.layer, b); }
function inspectAnyId(id){
  if(nodeByKey[id]) return inspectNode(nodeByKey[id]);
  if(realByKey[id]) return inspectRealization(realByKey[id]);
  if(componentNodeByKey[id] || realByComp[id]) { const b=$('div'); const under=realByComp[id]||[]; b.appendChild(kvBlock({component:id, tasks:under.filter(r=>r.layer==='task').length, tests:under.filter(r=>r.layer==='test').length, data_models:under.filter(r=>r.layer==='data_model').length})); if(compAdrs[id]) b.appendChild(miniList('ADRs', compAdrs[id].map(a=>a.id+': '+a.title))); appendFindings(b,[id]); return inspect(id+'  ·  Component', b); }
  const b=$('div'); appendFindings(b,[id]); b.appendChild($('div','empty','No structured detail for '+id+' (shown where it is cited).')); inspect(id, b);
}

// ── Validators (findings) ────────────────────────────────────────
function findingEl(f){
  const el=$('div','finding '+f.severity);
  const fh=$('div','fh'); fh.appendChild($('span','sev',f.severity)); fh.appendChild($('span','vid',f.validator_id)); fh.appendChild($('span','tag',f.category)); if(!f.bound) fh.appendChild($('span','tag unbound','unbound')); el.appendChild(fh);
  el.appendChild($('div','sm',f.summary));
  if(f.detail) el.appendChild($('div','dt',truncate(f.detail,600)));
  if(f.recommendation) el.appendChild($('div','dt','→ '+truncate(f.recommendation,400)));
  const cites=$('div','cites'); for(const id of [...f.ac_ids,...f.display_keys]) cites.appendChild(xref(id)); if(!f.bound) for(const id of (f.cited_ids||[]).slice(0,6)) cites.appendChild($('span','tag unbound',id)); el.appendChild(cites);
  return el;
}
function renderFindings(main){
  main.appendChild($('h2',null,'Validator findings'));
  const s=DATA.findings.summary;
  main.appendChild($('p','sub','reasoning-review · '+s.surfaced+' surfaced (HIGH/MEDIUM; auto-fix + superseded dropped) · '+s.bound+' bound to items · '+s.unbound+' unbound · '+s.by_severity.HIGH+' HIGH / '+s.by_severity.MEDIUM+' MED · '+s.total+' total records. Bound findings also badge their items in the trace / components.'));
  const bar=$('div','fbar');
  const sev=sel(['','HIGH','MEDIUM'],['severity: all','HIGH','MEDIUM']);
  const vids=[...new Set(DATA.findings.list.map(f=>f.validator_id))].sort();
  const vf=sel(['',...vids],['validator: all',...vids]);
  const bnd=sel(['','bound','unbound'],['binding: all','bound','unbound']);
  const cat=sel(['','artifact','process'],['type: all','artifact','process']);
  const q=$('input'); q.placeholder='search text / cited id…';
  bar.append(sev,vf,bnd,cat,q); main.appendChild(bar);
  const host=$('div'); main.appendChild(host);
  const CAP=400;
  function draw(){
    host.innerHTML='';
    const f0=q.value.trim().toLowerCase(); const matches=[];
    for(const f of DATA.findings.list){
      if(sev.value&&f.severity!==sev.value)continue;
      if(vf.value&&f.validator_id!==vf.value)continue;
      if(bnd.value&&((bnd.value==='bound')!==f.bound))continue;
      if(cat.value&&f.category!==cat.value)continue;
      if(f0&&!(f.summary+' '+f.detail+' '+(f.cited_ids||[]).join(' ')).toLowerCase().includes(f0))continue;
      matches.push(f);
    }
    matches.sort((a,b)=>(a.severity==='HIGH'?0:1)-(b.severity==='HIGH'?0:1));
    if(!matches.length){ host.appendChild($('div','empty','No findings match.')); return; }
    host.appendChild($('p','sub','Showing '+Math.min(matches.length,CAP)+' of '+matches.length+' matching'+(matches.length>CAP?' — refine filters to see the rest':'')));
    for(const f of matches.slice(0,CAP)) host.appendChild(findingEl(f));
  }
  for(const c of [sev,vf,bnd,cat]) c.onchange=draw; q.oninput=draw; draw();
}
function sel(vals,labels){ const s=document.createElement('select'); vals.forEach((v,i)=>{const o=document.createElement('option');o.value=v;o.textContent=labels[i];s.appendChild(o);}); return s; }

// ── Packet coherence ─────────────────────────────────────────────
function renderCoherence(main){
  const c=DATA.coherence; main.appendChild($('h2',null,'Packet coherence'));
  main.appendChild($('p','sub', c.total_packets+' packets · '+c.failed_packets+' failed · '+c.total_blocking_failures+' blocking · '+(c.total_advisory_findings||0)+' advisory'));
  const fbp=c.failures_by_packet||{};
  const entries = Array.isArray(fbp) ? fbp.map(p=>[p.packet_id||p.task_id||'?', p.blocking_failures||p.failures||[]]) : Object.entries(fbp);
  const byCode={};
  for(const [pid,fails] of entries){ for(const b of (Array.isArray(fails)?fails:[fails])){ const str=typeof b==='string'?b:((b&&b.code)||JSON.stringify(b)); const m=str.match(/^[A-Z0-9_]+/); const cd=m?m[0]:'OTHER'; (byCode[cd]=byCode[cd]||[]).push({packet:String(pid).slice(0,12),msg:str}); } }
  const host=$('div');
  if(!Object.keys(byCode).length) host.appendChild($('div','empty','No per-packet failures recorded (packets coherent).'));
  else { host.appendChild($('div','grp','Failures by code')); for(const [cd,list] of Object.entries(byCode).sort((a,b)=>b[1].length-a[1].length)){ const card=$('div','card'); const hd=$('div','hd'); hd.appendChild($('span','idcode',cd)); hd.appendChild($('span','ttl',list.length+' failure(s)')); const bd=$('div','bd'); for(const it of list){ const mini=$('div','mini'); mini.textContent=(it.packet?it.packet+' — ':'')+it.msg; bd.appendChild(mini);} hd.onclick=()=>card.classList.toggle('open'); card.append(hd,bd); host.appendChild(card);} }
  const cpf=c.cross_packet_failures; const cpfN=Array.isArray(cpf)?cpf.length:(cpf&&typeof cpf==='object'?Object.keys(cpf).length:0);
  if(cpfN){ host.appendChild($('div','grp','Cross-packet failures')); host.appendChild($('pre','raw',JSON.stringify(cpf,null,2))); }
  main.appendChild(host);
}

// ── Coverage & consistency ───────────────────────────────────────
function renderCoverage(main){
  main.appendChild($('h2',null,'Coverage & consistency'));
  main.appendChild($('p','sub','Per-phase coverage reports + consistency checks + surfaced coverage-gap records.'));
  for(const cov of DATA.coverage){
    const c=cov.content; const card=$('div','card open'); const hd=$('div','hd'); hd.appendChild($('span','idcode','P'+cov.phase)); hd.appendChild($('span','ttl',cov.label));
    const pct=c.coverage_percentage; if(pct!=null) hd.appendChild($('span','meta2',pct+'%'));
    const bd=$('div','bd');
    if(pct!=null){ const row=$('div','covrow'); const bar=$('div','bar'+(pct>=95?'':pct>=70?' warn':' bad')); const i=$('i'); i.style.width=pct+'%'; bar.appendChild(i); row.appendChild(bar); row.appendChild($('span',null,pct+'%')); bd.appendChild(row); }
    if(c.overall_pass!=null) bd.appendChild($('div',null,'overall_pass: '+c.overall_pass));
    for(const [k,v] of Object.entries(c)) if(Array.isArray(v)&&v.length){ const sa=$('div','subarr'); sa.appendChild($('div','lbl',k+' ('+v.length+')')); for(const el of v.slice(0,200)){ const mini=$('div','mini'); mini.textContent=typeof el==='object'?compact(el):String(el); sa.appendChild(mini);} bd.appendChild(sa); }
    hd.onclick=()=>card.classList.toggle('open'); card.append(hd,bd); main.appendChild(card);
  }
  if((DATA.coverage_gaps||[]).length){ main.appendChild($('div','grp','coverage_gap records ('+DATA.coverage_gaps.length+')')); for(const g of DATA.coverage_gaps){ const card=$('div','card'); const hd=$('div','hd'); hd.appendChild($('span','idcode',g.sub_phase_id||'gap')); hd.appendChild($('span','ttl',truncate(g.assertion||g.check||'',120))); if(g.severity) hd.appendChild($('span','badge '+(String(g.severity).toLowerCase().includes('block')?'high':'med'),g.severity)); const bd=$('div','bd'); bd.appendChild(kvBlock(Object.fromEntries(Object.entries(g).filter(([k,v])=>typeof v!=='object')))); for(const [k,v] of Object.entries(g)) if(Array.isArray(v)&&v.length){const sa=$('div','subarr');sa.appendChild($('div','lbl',k));for(const el of v){const mini=$('div','mini');mini.textContent=typeof el==='object'?compact(el):String(el);sa.appendChild(mini);}bd.appendChild(sa);} hd.onclick=()=>card.classList.toggle('open'); card.append(hd,bd); main.appendChild(card);} }
}

// ── Deep dive (raw artifacts by phase) ───────────────────────────
function renderDeepDive(main){
  main.appendChild($('h2',null,'Deep dive — raw artifacts by phase'));
  main.appendChild($('p','sub','Every P0–P8 artifact, verbatim. Secondary view for inspection; the Trace / Components / Cross-cutting lenses are the primary navigation.'));
  const byPhase={}; for(const s of DATA.sections) (byPhase[s.phase]=byPhase[s.phase]||[]).push(s);
  for(const p of Object.keys(byPhase).sort()){ main.appendChild($('div','grp', PHASES[p]||('P'+p))); for(const s of byPhase[p]) main.appendChild(sectionCard(s)); }
}
function sectionCard(sec){
  const card=$('div','card'); const hd=$('div','hd'); hd.appendChild($('span','idcode','P'+sec.phase)); hd.appendChild($('span','ttl',sec.label)); hd.appendChild($('span','meta2',sec.kind)); const bd=$('div','bd');
  const arrays=Object.entries(sec.content).filter(([k,v])=>Array.isArray(v)&&v.length&&typeof v[0]==='object');
  const scalars=Object.fromEntries(Object.entries(sec.content).filter(([k,v])=>k!=='kind'&&(typeof v!=='object'||v===null)));
  if(Object.keys(scalars).length) bd.appendChild(kvBlock(scalars));
  for(const [key,a] of arrays){ const sa=$('div','subarr'); sa.appendChild($('div','lbl',key+' ('+a.length+')')); for(const item of a) sa.appendChild(itemCard(item.id||item.concept_key||item.component_id||item.term||item.name||'', item.name||item.title||item.statement||item.text||item.description||item.decision||'', item)); bd.appendChild(sa); }
  if(!arrays.length && !Object.keys(scalars).length) bd.appendChild($('pre','raw',JSON.stringify(sec.content,null,2)));
  hd.onclick=()=>card.classList.toggle('open'); card.append(hd,bd); return card;
}
function itemCard(idv, ttl, item){
  const c=$('div','card'); const hd=$('div','hd'); if(idv) hd.appendChild($('span','idcode',esc(idv))); hd.appendChild($('span','ttl',truncate(esc(ttl),120)));
  const fc=(findingsByItem[idv]||[]).length; if(fc) hd.appendChild($('span','badge '+topSev(idv),'⚑'+fc));
  const bd=$('div','bd');
  bd.appendChild(kvBlock(Object.fromEntries(Object.entries(item).filter(([k,v])=>typeof v!=='object'||v===null))));
  for(const [k,v] of Object.entries(item)){ if(Array.isArray(v)&&v.length){ const sa=$('div','subarr'); sa.appendChild($('div','lbl',k+' ('+v.length+')')); for(const el of v){ const mini=$('div','mini'); mini.textContent=typeof el==='object'?compact(el):String(el); sa.appendChild(mini);} bd.appendChild(sa); } else if(v&&typeof v==='object'){ const sa=$('div','subarr'); sa.appendChild($('div','lbl',k)); const mini=$('div','mini'); mini.textContent=compact(v); sa.appendChild(mini); bd.appendChild(sa);} }
  const fs=findingsByItem[idv]||[]; for(const f of fs) bd.appendChild(findingEl(f));
  hd.onclick=()=>c.classList.toggle('open'); c.appendChild(hd); c.appendChild(bd); return c;
}

window.addEventListener('hashchange',()=>{ const id=location.hash.slice(1); if(id) select(id); });
layout();
`;

// ── main ─────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv);
  const dbPath = path.resolve(args.db);
  const db = openDb(dbPath);
  const runId = resolveRunId(db, args.run);
  const generatedAt = new Date().toISOString();
  const report = buildReport(db, runId, dbPath, generatedAt);
  (db as unknown as BetterSqlite3.Database).close();

  const outPath = args.out
    ? path.resolve(args.out)
    : path.join(path.dirname(dbPath), `decomp-report-${runId.slice(0, 8)}.html`);
  fs.writeFileSync(outPath, renderHtml(report), 'utf-8');

  const s = report.findings.summary;
  console.log(`[decomp-report] run ${runId}`);
  console.log(`  nodes=${report.meta.totals.nodes} roots=${report.meta.totals.roots} sections=${report.sections.length} coverage=${report.coverage.length}`);
  console.log(`  findings surfaced=${s.surfaced} (bound=${s.bound} unbound=${s.unbound}) HIGH=${s.by_severity.HIGH} MED=${s.by_severity.MEDIUM}`);
  console.log(`  packet coherence: ${report.coherence ? `${report.coherence.total_blocking_failures} blocking / ${report.coherence.total_packets} packets` : 'n/a'}`);
  console.log(`  → ${outPath}`);
}

main();
