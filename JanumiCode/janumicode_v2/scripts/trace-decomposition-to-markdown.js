#!/usr/bin/env node
/**
 * Trace the full decomposition from original intent → Phase 1 artifacts →
 * Phase 2 user stories & ACs → Phase 3–5 specs/components/data-models →
 * Phase 6 tasks → Phase 9 execution, rendered as a single markdown
 * report.
 *
 * Sibling of export-decomposition-to-markdown.js (which renders just the
 * Phase 2 FR/NFR tree). This script's job is end-to-end traceability:
 * spec → artifact → task → file. It produces the operator's hands-on
 * audit surface — every AC, every task, every execution outcome, every
 * drift — without LLM calls. Read-only against the governed-stream DB.
 *
 * Usage:
 *   node scripts/trace-decomposition-to-markdown.js \
 *     [--workspace <path>]           default: most-recently-modified ts workspace
 *     [--out <path.md>]              default: <workspace>/decomposition-trace-report.md
 *     [--run-id <id>]                default: latest workflow run in the DB
 *     [--ac-keyword-fallback]        also flag AC-task matches via measurable_condition keyword scan
 *
 * Exit codes: 0 success, 2 CLI usage error, 3 no run / no data.
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

// ── CLI parsing + workspace discovery ──────────────────────────────

function parseArgs(argv) {
  const out = { acKeywordFallback: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--workspace') out.workspace = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--run-id') out.runId = argv[++i];
    else if (a === '--ac-keyword-fallback') out.acKeywordFallback = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'usage: [--workspace <path>] [--out <path.md>] [--run-id <id>] [--ac-keyword-fallback]\n',
      );
      process.exit(0);
    }
  }
  return out;
}

function discoverWorkspace(repoRoot) {
  const root = path.join(repoRoot, 'test-and-evaluation', 'thin-slice-workspaces');
  if (!fs.existsSync(root)) {
    process.stderr.write(`error: ${root} does not exist; pass --workspace explicitly\n`);
    process.exit(2);
  }
  const entries = fs.readdirSync(root).filter(
    (n) => fs.statSync(path.join(root, n)).isDirectory(),
  ).map((n) => ({ name: n, path: path.join(root, n), mtime: fs.statSync(path.join(root, n)).mtimeMs }));
  entries.sort((a, b) => b.mtime - a.mtime);
  if (entries.length === 0) {
    process.stderr.write(`error: no thin-slice workspaces found under ${root}\n`);
    process.exit(2);
  }
  return entries[0].path;
}

function findDbForWorkspace(workspace) {
  const candidates = [
    path.join(workspace, '.janumicode', 'test-harness'),
    path.join(workspace, '.janumicode', 'live'),
    path.join(workspace, '.janumicode', 'runs'),
  ];
  const found = [];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.db')) {
        const fp = path.join(dir, f);
        found.push({ path: fp, mtime: fs.statSync(fp).mtimeMs });
      }
    }
  }
  if (found.length === 0) {
    process.stderr.write(`error: no .db files found under ${workspace}/.janumicode/{test-harness,live,runs}\n`);
    process.exit(3);
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return found[0].path;
}

// ── DB query helpers ───────────────────────────────────────────────

function resolveRunId(db, wanted) {
  if (wanted) return wanted;
  const row = db.prepare(`SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1`).get();
  if (!row) {
    process.stderr.write('error: no workflow_runs in this database\n');
    process.exit(3);
  }
  return row.id;
}

function getRun(db, runId) {
  return db.prepare(`SELECT * FROM workflow_runs WHERE id = ?`).get(runId);
}

function getCurrentArtifact(db, runId, subPhaseId, kindFilter) {
  const rows = db.prepare(
    `SELECT content FROM governed_stream
      WHERE workflow_run_id = ?
        AND record_type = 'artifact_produced'
        AND sub_phase_id = ?
        AND is_current_version = 1
      ORDER BY produced_at DESC`,
  ).all(runId, subPhaseId);
  for (const r of rows) {
    try {
      const c = JSON.parse(r.content);
      if (!kindFilter || c.kind === kindFilter) return c;
    } catch { /* skip */ }
  }
  return null;
}

function getAllCurrentArtifacts(db, runId, subPhaseId) {
  const rows = db.prepare(
    `SELECT content FROM governed_stream
      WHERE workflow_run_id = ?
        AND record_type = 'artifact_produced'
        AND sub_phase_id = ?
        AND is_current_version = 1
      ORDER BY produced_at ASC`,
  ).all(runId, subPhaseId);
  return rows.map((r) => { try { return JSON.parse(r.content); } catch { return null; } }).filter(Boolean);
}

function getRecordsByType(db, runId, recordType) {
  const rows = db.prepare(
    `SELECT content, sub_phase_id, phase_id, produced_at FROM governed_stream
      WHERE workflow_run_id = ? AND record_type = ? AND is_current_version = 1
      ORDER BY produced_at ASC`,
  ).all(runId, recordType);
  return rows.map((r) => ({
    sub_phase_id: r.sub_phase_id, phase_id: r.phase_id, produced_at: r.produced_at,
    content: (() => { try { return JSON.parse(r.content); } catch { return null; } })(),
  })).filter((x) => x.content);
}

function getDecisionBundle(db, runId, subPhaseId) {
  const rows = db.prepare(
    `SELECT content FROM governed_stream
      WHERE workflow_run_id = ?
        AND record_type = 'decision_bundle_presented'
        AND sub_phase_id = ?
        AND is_current_version = 1
      ORDER BY produced_at DESC`,
  ).all(runId, subPhaseId);
  for (const r of rows) {
    try { return JSON.parse(r.content); } catch { /* skip */ }
  }
  return null;
}

function getDecisionTrace(db, runId, subPhaseId) {
  const rows = db.prepare(
    `SELECT content FROM governed_stream
      WHERE workflow_run_id = ?
        AND record_type = 'decision_trace'
        AND sub_phase_id = ?
        AND is_current_version = 1
      ORDER BY produced_at DESC`,
  ).all(runId, subPhaseId);
  for (const r of rows) {
    try { return JSON.parse(r.content); } catch { /* skip */ }
  }
  return null;
}

// ── Markdown helpers ───────────────────────────────────────────────

function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function bullet(s, depth = 0) {
  return `${'  '.repeat(depth)}- ${s}`;
}

function counters(arr) {
  return arr.length;
}

// ── Section 1: original intent ─────────────────────────────────────

function sectionOriginalIntent(workspace) {
  const intentPath = path.join(workspace, '.janumicode', 'intent.md');
  const out = ['## 1. Original Intent', ''];
  if (!fs.existsSync(intentPath)) {
    out.push('_(no intent.md found in workspace)_', '');
    return out.join('\n');
  }
  const text = fs.readFileSync(intentPath, 'utf8');
  out.push('```markdown', text.trimEnd(), '```', '');
  return out.join('\n');
}

// ── Section 1a: pruning effectiveness ──────────────────────────────

// Bloom rounds where we want to compare proposed vs kept (auto-approve effect).
const BLOOM_ROUNDS = [
  { subPhase: 'business_domains_bloom', label: 'Business Domains + Personas',
    proposedKeys: ['domains', 'personas'] },
  { subPhase: 'user_journey_bloom', label: 'User Journeys',
    proposedKeys: ['userJourneys'] },
  { subPhase: 'system_workflow_bloom', label: 'System Workflows',
    proposedKeys: ['workflows'] },
  { subPhase: 'entities_bloom', label: 'Entities',
    proposedKeys: ['entities'] },
  { subPhase: 'integrations_qa_bloom', label: 'Integrations + Quality Attributes',
    proposedKeys: ['integrations', 'qualityAttributes'] },
];

function sectionPruningEffectiveness(db, runId) {
  const out = ['## 1a. Pruning Effectiveness', ''];
  out.push('Each bloom round under the product lens over-proposes intentionally; the gate is where the operator prunes. Auto-approve emits empty selections, then a `safe…` fallback re-accepts every proposed item when nothing is selected. **Look for `kept = proposed` rows where `auto_approved = true` — that is over-supply leaking downstream.**', '');
  out.push('| Bloom Round | Proposed | Kept | Auto-Approved | Recommended (initially marked) |');
  out.push('|---|---:|---:|---|---|');

  for (const round of BLOOM_ROUNDS) {
    const artifact = getCurrentArtifact(db, runId, round.subPhase);
    const bundle = getDecisionBundle(db, runId, round.subPhase);
    const trace = getDecisionTrace(db, runId, round.subPhase);

    let proposed = 0;
    if (artifact) {
      for (const k of round.proposedKeys) {
        if (Array.isArray(artifact[k])) proposed += artifact[k].length;
      }
    }

    let kept = '?';
    let autoApprovedNote = 'n/a';
    let recommendedCount = '?';
    if (bundle?.menu?.options) {
      recommendedCount = bundle.menu.options.filter((o) => o.recommended === true).length;
    }
    if (trace) {
      const auto = trace.attribution === 'auto_approve' || trace.auto_approved === true;
      const selections = trace.payload?.menu_selections ?? [];
      autoApprovedNote = auto ? `yes (${selections.length} explicit selections)` : 'no';
      if (auto && selections.length === 0) {
        // Safe fallback semantics: nothing was selected so safe* keeps EVERY proposed item.
        kept = `${proposed} (safe fallback — all proposed kept)`;
      } else {
        kept = String(selections.length);
      }
    }
    out.push(`| ${round.label} | ${proposed} | ${kept} | ${autoApprovedNote} | ${recommendedCount} |`);
  }
  out.push('');
  return out.join('\n');
}

// ── Section 2: Phase 1 outputs ─────────────────────────────────────

function sectionPhase1(db, runId) {
  const out = ['## 2. Phase 1 Outputs', ''];

  // Lens classification
  const lens = getCurrentArtifact(db, runId, 'intent_lens_classification');
  if (lens) {
    out.push(`**Lens:** ${lens.lens ?? '?'} (confidence ${lens.confidence ?? '?'})`);
    if (lens.rationale) out.push(`_Rationale:_ ${lens.rationale}`);
    out.push('');
  }

  // Discovery extracts
  const discoveries = [
    ['Technical Constraints (1.0c)', 'technical_constraints_discovery', 'technicalConstraints'],
    ['Compliance & Retention (1.0d)', 'compliance_retention_discovery', 'compliance_extracted_items'],
    ['V&V Requirements (1.0e)', 'vv_requirements_discovery', 'vvRequirements'],
    ['Canonical Vocabulary (1.0f)', 'canonical_vocabulary_discovery', 'canonicalVocabulary'],
  ];
  for (const [label, subPhase, key] of discoveries) {
    const a = getCurrentArtifact(db, runId, subPhase);
    out.push(`### ${label}`);
    if (!a || !Array.isArray(a[key])) { out.push('_(none)_', ''); continue; }
    if (a[key].length === 0) { out.push('_(empty)_', ''); continue; }
    for (const item of a[key]) {
      const id = item.id ?? '(no-id)';
      const summary = item.text ?? item.target ?? item.term ?? item.category ?? '(no summary)';
      out.push(bullet(`**${id}** — ${esc(summary).slice(0, 200)}`));
    }
    out.push('');
  }

  // Business Domains + Personas
  const bd = getCurrentArtifact(db, runId, 'business_domains_bloom');
  if (bd) {
    out.push('### Business Domains');
    for (const d of bd.domains ?? []) {
      out.push(bullet(`**${d.id}** — ${esc(d.name)} · _source:_ ${d.source ?? '?'} · _rationale:_ ${esc(d.rationale ?? '').slice(0, 160)}`));
    }
    out.push('');
    out.push('### Personas');
    for (const p of bd.personas ?? []) {
      out.push(bullet(`**${p.id}** — ${esc(p.name)} · _source:_ ${p.source ?? '?'}`));
    }
    out.push('');
  }

  // Journeys
  const ujs = getCurrentArtifact(db, runId, 'user_journey_bloom');
  if (ujs) {
    out.push('### User Journeys');
    for (const j of ujs.userJourneys ?? []) {
      out.push(bullet(`**${j.id}** — ${esc(j.title)} · _persona:_ ${j.personaId ?? '?'} · _source:_ ${j.source ?? '?'}`));
    }
    out.push('');
  }

  // Workflows
  const wfs = getCurrentArtifact(db, runId, 'system_workflow_bloom');
  if (wfs) {
    out.push('### System Workflows');
    for (const w of wfs.workflows ?? []) {
      const triggers = (w.triggers ?? []).map((t) => t.kind).join('+');
      out.push(bullet(`**${w.id}** — ${esc(w.name)} · _domain:_ ${w.businessDomainId} · _triggers:_ ${triggers || '(none)'} · _backs:_ ${(w.backs_journeys ?? []).join(',') || '(none)'}`));
    }
    out.push('');
  }

  // Entities
  const ents = getCurrentArtifact(db, runId, 'entities_bloom');
  if (ents) {
    out.push('### Entities');
    for (const e of ents.entities ?? []) {
      out.push(bullet(`**${e.id}** — ${esc(e.name)} · _domain:_ ${e.businessDomainId}`));
    }
    out.push('');
  }

  // Integrations + QA
  const iqa = getCurrentArtifact(db, runId, 'integrations_qa_bloom');
  if (iqa) {
    out.push('### Integrations');
    for (const it of iqa.integrations ?? []) {
      out.push(bullet(`**${it.id}** — ${esc(it.name)} · _category:_ ${it.category} · _ownership:_ ${it.ownershipModel ?? '?'}`));
    }
    out.push('');
    out.push('### Quality Attributes');
    (iqa.qualityAttributes ?? []).forEach((qa, i) => {
      out.push(bullet(`**QA-${i + 1}** — ${esc(qa).slice(0, 240)}`));
    });
    out.push('');
  }

  // Release plan
  const rel = getCurrentArtifact(db, runId, 'release_plan');
  if (rel) {
    out.push('### Release Plan');
    out.push(`Approved: \`${rel.approved}\` · Schema: \`${rel.schemaVersion}\``);
    for (const r of rel.releases ?? []) {
      const c = r.contains ?? {};
      const counts = Object.entries(c).filter(([_, v]) => Array.isArray(v)).map(([k, v]) => `${k}:${v.length}`).join(' · ');
      out.push(bullet(`**${r.name}** (ordinal ${r.ordinal}) — ${counts}`));
    }
    if (rel.cross_cutting) {
      const cc = rel.cross_cutting;
      const counts = Object.entries(cc).filter(([_, v]) => Array.isArray(v)).map(([k, v]) => `${k}:${v.length}`).join(' · ');
      out.push(bullet(`**cross_cutting** — ${counts}`));
    }
    out.push('');
  }

  return out.join('\n');
}

// ── Section 3: Phase 2 user stories + ACs ──────────────────────────

function sectionPhase2UserStoriesAndACs(db, runId) {
  const out = ['## 3. Phase 2 — User Stories, Acceptance Criteria, Decomposition'];
  out.push('');

  const fr = getCurrentArtifact(db, runId, 'fr_bloom_skeleton');
  const nfr = getCurrentArtifact(db, runId, 'nfr_bloom_skeleton');

  out.push('### 3a. Functional Requirements — User Stories');
  if (fr?.user_stories) {
    for (const us of fr.user_stories) {
      out.push('');
      out.push(`#### ${us.id} — _${esc(us.action || '(no action)')}_`);
      out.push(`- **Role:** ${esc(us.role)}`);
      out.push(`- **Outcome:** ${esc(us.outcome)}`);
      out.push(`- **Priority:** ${us.priority ?? '?'}`);
      out.push(`- **Traces to:** \`${(us.traces_to ?? []).join('`, `') || '(none)'}\``);
      out.push('- **Acceptance criteria:**');
      for (const ac of us.acceptance_criteria ?? []) {
        out.push(bullet(`**${ac.id}** — ${esc(ac.description)}`, 1));
        if (ac.measurable_condition) {
          out.push(bullet(`_measurable:_ ${esc(ac.measurable_condition).slice(0, 280)}`, 2));
        }
      }
    }
  } else { out.push('_(no FR skeleton)_'); }

  out.push('', '### 3b. Non-Functional Requirements');
  if (nfr?.nonfunctional_requirements) {
    for (const n of nfr.nonfunctional_requirements) {
      out.push('');
      out.push(`#### ${n.id} — _${n.category}_`);
      out.push(`- **Description:** ${esc(n.description)}`);
      out.push(`- **Priority:** ${n.priority ?? '?'}`);
      out.push(`- **Threshold:** ${esc(n.threshold ?? '?')}`);
      out.push(`- **Traces to:** \`${(n.traces_to ?? []).join('`, `') || '(none)'}\``);
    }
  } else { out.push('_(no NFR skeleton)_'); }

  out.push('', '### 3c. Requirements Decomposition Telemetry');
  const pipelines = getRecordsByType(db, runId, 'requirement_decomposition_pipeline');
  if (pipelines.length === 0) {
    out.push('_(no decomposition pipelines recorded)_');
  } else {
    out.push('| Pipeline | Final Atomic Leaves | Final Max Depth | Total LLM Calls | Termination |');
    out.push('|---|---:|---:|---:|---|');
    for (const p of pipelines) {
      const c = p.content;
      const last = c.passes?.[c.passes.length - 1];
      out.push(`| ${c.pipeline_id?.slice(0, 8) ?? '?'} (${c.root_fr_id ?? '?'}) | ${c.final_leaf_count ?? '?'} | ${c.final_max_depth ?? '?'} | ${c.total_llm_calls ?? '?'} | ${last?.termination_reason ?? '?'} |`);
    }
  }
  out.push('');

  return out.join('\n');
}

// ── Section 4: Phase 3–5 ───────────────────────────────────────────

function sectionPhase3to5(db, runId) {
  const out = ['## 4. Phase 3–5 — System Spec, Architecture, Technical Spec'];
  out.push('');

  // Phase 3 — system spec
  const sys = getCurrentArtifact(db, runId, 'system_specification_synthesis')
    || getCurrentArtifact(db, runId, 'system_boundary');
  out.push('### 4a. System Boundary (Phase 3)');
  if (sys?.boundary?.in_scope) {
    for (const cap of sys.boundary.in_scope) {
      out.push(bullet(`**${cap.capability ?? '(unnamed)'}** — ${esc(cap.description ?? '')}`));
    }
  } else if (sys?.in_scope) {
    for (const cap of sys.in_scope) {
      out.push(bullet(`**${cap.capability ?? '(unnamed)'}** — ${esc(cap.description ?? '')}`));
    }
  } else { out.push('_(no system spec found)_'); }
  out.push('');

  // Phase 4 — components
  const comps = getCurrentArtifact(db, runId, 'component_skeleton');
  out.push('### 4b. Components (Phase 4)');
  if (comps?.components) {
    out.push('| ID | Name | Domain | Responsibilities | Dependencies |');
    out.push('|---|---|---|---:|---:|');
    for (const c of comps.components) {
      out.push(`| ${c.id} | ${esc(c.name)} | ${esc(c.domain_id ?? '?')} | ${(c.responsibilities ?? []).length} | ${(c.dependencies ?? []).length} |`);
    }
  } else { out.push('_(no component skeleton)_'); }
  out.push('');

  // Phase 4 saturation telemetry
  const compPipelines = getRecordsByType(db, runId, 'component_decomposition_pipeline');
  if (compPipelines.length > 0) {
    out.push('**Component saturation telemetry:**');
    for (const p of compPipelines) {
      const last = p.content.passes?.[p.content.passes.length - 1];
      out.push(bullet(`pipeline ${p.content.pipeline_id?.slice(0, 8)} — termination: ${last?.termination_reason ?? '?'}, leaves: ${p.content.final_leaf_count ?? '?'}, depth: ${p.content.final_max_depth ?? '?'}`));
    }
    out.push('');
  }

  // Phase 5 — data models
  const dms = getCurrentArtifact(db, runId, 'data_model_skeleton');
  out.push('### 4c. Data Models (Phase 5)');
  if (dms?.data_models) {
    for (const dm of dms.data_models) {
      out.push(bullet(`**${dm.id}** — ${esc(dm.name ?? '(no name)')} · _component:_ ${dm.component_id ?? '?'}`));
    }
  } else { out.push('_(no data models)_'); }
  out.push('');

  // Phase 5 — API definitions
  const apis = getCurrentArtifact(db, runId, 'api_definitions');
  out.push('### 4d. API Definitions (Phase 5)');
  if (apis?.api_definitions) {
    for (const api of apis.api_definitions) {
      out.push(bullet(`**${api.id}** — \`${api.method ?? '?'} ${api.path ?? '?'}\` · ${esc(api.description ?? '').slice(0, 160)}`));
    }
  } else { out.push('_(no API definitions)_'); }
  out.push('');

  return out.join('\n');
}

// ── Saturation tree renderer (shared by Phase 4 / 5 / 6 / 7) ──────

/**
 * Render a saturation tree compactly:
 * - status counts (atomic / decomposed / deferred / pruned / downgraded)
 * - one row per pipeline (root) with termination reason + atomic-leaf count + depth
 * - the atomic-leaf list grouped by root
 *
 * `cfg` selects the record types and labels.
 */
function renderSaturationSection(db, runId, cfg) {
  const out = [`### ${cfg.heading}`, ''];
  const pipelines = getRecordsByType(db, runId, cfg.pipelineRecordType);
  const nodes = getRecordsByType(db, runId, cfg.nodeRecordType);
  if (pipelines.length === 0 && nodes.length === 0) {
    out.push('_(no saturation records)_', '');
    return out.join('\n');
  }

  // Status counts
  const statusCounts = {};
  for (const n of nodes) {
    const s = n.content?.status ?? '(unknown)';
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }
  const statusCells = Object.entries(statusCounts)
    .map(([k, v]) => `${k}: ${v}`).join(' · ');
  out.push(`**Node status counts:** ${statusCells || '(none)'}`);
  out.push('');

  // Per-pipeline summary
  if (pipelines.length > 0) {
    out.push('| Root | Termination | Atomic Leaves | Max Depth | LLM Calls |');
    out.push('|---|---|---:|---:|---:|');
    for (const p of pipelines) {
      const c = p.content;
      const lastPass = c.passes?.[c.passes.length - 1];
      const rootId = c[cfg.pipelineRootIdField] ?? c.pipeline_id?.slice(0, 8) ?? '?';
      out.push(`| ${esc(rootId)} | ${lastPass?.termination_reason ?? '?'} | ${c.final_leaf_count ?? '?'} | ${c.final_max_depth ?? '?'} | ${c.total_llm_calls ?? '?'} |`);
    }
    out.push('');
  }

  // Atomic leaves grouped by root
  const atomic = nodes.filter((n) => n.content?.status === 'atomic');
  if (atomic.length === 0) {
    out.push('_(no atomic leaves yet)_', '');
    return out.join('\n');
  }
  const byRoot = new Map();
  for (const n of atomic) {
    const root = n.content?.[cfg.nodeRootIdField] ?? '(no-root)';
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(n.content);
  }
  out.push('**Atomic leaves:**');
  for (const [root, leaves] of byRoot.entries()) {
    out.push(bullet(`Root \`${esc(root).slice(0, 24)}\` — ${leaves.length} atomic leaf/leaves`));
    for (const leaf of leaves.slice(0, 30)) {
      const label = cfg.nodeLabel(leaf);
      out.push(bullet(label, 1));
    }
    if (leaves.length > 30) out.push(bullet(`_(+${leaves.length - 30} more)_`, 1));
  }
  out.push('');
  return out.join('\n');
}

// ── Section 4e: All saturation summaries ──────────────────────────

function sectionAllSaturation(db, runId) {
  const out = ['### 4e. Saturation Trees (Phase 4.2a / 5.1a / 6.1a / 7.1a)', ''];
  out.push('Each decomposition phase produces a recursive tree: skeleton root nodes → tier-A/B/C/D children → atomic leaves. Phase 9 only executes the **atomic leaves** of the Phase 6 task tree.', '');

  out.push(renderSaturationSection(db, runId, {
    heading: 'Phase 4.2a — Component Decomposition',
    pipelineRecordType: 'component_decomposition_pipeline',
    nodeRecordType: 'component_decomposition_node',
    pipelineRootIdField: 'root_component_id',
    nodeRootIdField: 'root_component_id',
    nodeLabel: (c) => `**${c.component?.id ?? c.display_key ?? c.node_id?.slice(0,8) ?? '?'}** (tier ${c.tier ?? '?'}, depth ${c.depth ?? '?'}) — ${esc(c.component?.name ?? '(no name)').slice(0, 80)}`,
  }));

  out.push(renderSaturationSection(db, runId, {
    heading: 'Phase 5.1a — Data Model Decomposition',
    pipelineRecordType: 'data_model_decomposition_pipeline',
    nodeRecordType: 'data_model_decomposition_node',
    pipelineRootIdField: 'root_data_model_id',
    nodeRootIdField: 'root_data_model_id',
    nodeLabel: (c) => `**${c.data_model?.id ?? c.display_key ?? c.node_id?.slice(0,8) ?? '?'}** (tier ${c.tier ?? '?'}, depth ${c.depth ?? '?'}) — ${esc(c.data_model?.name ?? '(no name)').slice(0, 80)}`,
  }));

  out.push(renderSaturationSection(db, runId, {
    heading: 'Phase 6.1a — Task Decomposition (atomic leaves = what Phase 9 runs)',
    pipelineRecordType: 'task_decomposition_pipeline',
    nodeRecordType: 'task_decomposition_node',
    pipelineRootIdField: 'root_task_id',
    nodeRootIdField: 'root_task_id',
    nodeLabel: (c) => `**${c.task?.id ?? c.display_key ?? c.node_id?.slice(0,8) ?? '?'}** (tier ${c.tier ?? '?'}, depth ${c.depth ?? '?'}, complexity ${c.task?.estimated_complexity ?? '?'}) — ${esc(c.task?.name ?? '(no name)').slice(0, 80)}`,
  }));

  out.push(renderSaturationSection(db, runId, {
    heading: 'Phase 7.1a — Test Decomposition',
    pipelineRecordType: 'test_decomposition_pipeline',
    nodeRecordType: 'test_decomposition_node',
    pipelineRootIdField: 'root_test_case_id',
    nodeRootIdField: 'root_test_case_id',
    nodeLabel: (c) => `**${c.test_case?.test_case_id ?? c.test_case?.id ?? c.display_key ?? c.node_id?.slice(0,8) ?? '?'}** (tier ${c.tier ?? '?'}, depth ${c.depth ?? '?'}) — ${esc(c.test_case?.expected_outcome ?? c.test_case?.name ?? '(no description)').slice(0, 80)}`,
  }));

  return out.join('\n');
}

// ── Section 5: Phase 6 task plan ───────────────────────────────────

function sectionPhase6Tasks(db, runId) {
  const out = ['## 5. Phase 6 — Implementation Tasks', ''];
  const plan = getCurrentArtifact(db, runId, 'task_skeleton');
  if (!plan?.tasks) { out.push('_(no implementation plan)_', ''); return { md: out.join('\n'), tasks: [] }; }
  out.push(`**Total tasks:** ${plan.total_tasks ?? plan.tasks.length} · **Complexity flagged:** ${plan.complexity_flagged_count ?? 0} · **Refactoring tasks:** ${plan.refactoring_tasks_included ? 'yes' : 'no'}`);
  out.push('');
  out.push('| Task ID | Name | Component | Complexity | Backing tool | Traces To | Write Paths |');
  out.push('|---|---|---|---|---|---|---|');
  for (const t of plan.tasks) {
    out.push(`| ${t.id} | ${esc(t.name)} | ${t.component_id ?? '?'} | ${t.estimated_complexity ?? '?'} | ${t.backing_tool ?? '?'} | ${(t.traces_to ?? []).map(esc).join(', ') || '(none)'} | ${(t.write_directory_paths ?? []).map(esc).join(', ')} |`);
  }
  out.push('');
  return { md: out.join('\n'), tasks: plan.tasks };
}

// ── Section 5b: Phase 7 test plan + atomic leaves ──────────────────

function sectionPhase7TestPlan(db, runId) {
  const out = ['## 6. Phase 7 — Test Plan', ''];
  const plan = getCurrentArtifact(db, runId, 'test_case_skeleton');
  if (!plan) {
    out.push('_(no test plan)_', '');
    return { md: out.join('\n'), testCases: [] };
  }
  out.push(`**Total test cases:** ${plan.total_test_cases ?? '?'}`);
  if (plan.coverage_by_type) {
    const ct = plan.coverage_by_type;
    out.push(`**Coverage by type:** unit ${ct.unit ?? 0} · integration ${ct.integration ?? 0} · end_to_end ${ct.end_to_end ?? 0}`);
  }
  out.push('');

  const testCases = [];
  for (const suite of plan.test_suites ?? []) {
    out.push(`### Suite \`${suite.suite_id}\` — component \`${suite.component_id ?? '?'}\` · type \`${suite.test_type ?? '?'}\``);
    out.push('| Test ID | Type | AC refs | Expected outcome |');
    out.push('|---|---|---|---|');
    for (const tc of suite.test_cases ?? []) {
      const acRefs = (tc.acceptance_criterion_ids ?? []).join(', ') || '(none)';
      out.push(`| ${tc.test_case_id} | ${tc.type ?? '?'} | \`${acRefs}\` | ${esc(tc.expected_outcome).slice(0, 140)} |`);
      testCases.push({
        suite_id: suite.suite_id,
        component_id: suite.component_id,
        test_case_id: tc.test_case_id,
        type: tc.type,
        acceptance_criterion_ids: tc.acceptance_criterion_ids ?? [],
        expected_outcome: tc.expected_outcome,
      });
    }
    out.push('');
  }

  // Coverage report
  const coverage = getCurrentArtifact(db, runId, 'test_plan_synthesis');
  if (coverage) {
    out.push('### Test coverage report');
    out.push('```json');
    out.push(JSON.stringify(coverage, null, 2).slice(0, 1500));
    out.push('```', '');
  }

  return { md: out.join('\n'), testCases };
}

// ── Section 5c: Phase 8 evaluation plans ───────────────────────────

function sectionPhase8Evaluation(db, runId) {
  const out = ['## 7. Phase 8 — Evaluation Plans', ''];

  // Functional eval
  const fn = getCurrentArtifact(db, runId, 'evaluation_design', 'functional_evaluation_plan');
  out.push('### 7a. Functional evaluation plan');
  const fnCriteria = fn?.criteria ?? [];
  if (fnCriteria.length === 0) {
    out.push('_(no functional criteria)_', '');
  } else {
    out.push('| FR / US id | Method | Success condition |');
    out.push('|---|---|---|');
    for (const c of fnCriteria) {
      out.push(`| ${c.functional_requirement_id ?? '?'} | ${esc(c.evaluation_method ?? '').slice(0, 80)} | ${esc(c.success_condition ?? '').slice(0, 160)} |`);
    }
    out.push('');
  }

  // Quality eval
  const ql = getCurrentArtifact(db, runId, 'evaluation_metrics', 'quality_evaluation_plan');
  out.push('### 7b. Quality evaluation plan');
  const qlCriteria = ql?.criteria ?? [];
  if (qlCriteria.length === 0) {
    out.push('_(no quality criteria)_', '');
  } else {
    out.push('| NFR id | Method | Success condition |');
    out.push('|---|---|---|');
    for (const c of qlCriteria) {
      out.push(`| ${c.nonfunctional_requirement_id ?? c.functional_requirement_id ?? '?'} | ${esc(c.evaluation_method ?? '').slice(0, 80)} | ${esc(c.success_condition ?? '').slice(0, 160)} |`);
    }
    out.push('');
  }

  // Reasoning eval
  const rs = getCurrentArtifact(db, runId, 'evaluation_thresholds', 'reasoning_evaluation_plan');
  out.push('### 7c. Reasoning evaluation plan');
  if (!rs) { out.push('_(no reasoning evaluation plan)_', ''); }
  else {
    out.push('```json');
    out.push(JSON.stringify(rs, null, 2).slice(0, 1500));
    out.push('```', '');
  }

  return { md: out.join('\n'), functionalEvalIds: new Set(fnCriteria.map((c) => c.functional_requirement_id)) };
}

// ── Section 9: Per-user-story coverage cross-tab ───────────────────

function sectionUserStoryCrossTab(db, runId, tasks, testCases, functionalEvalIds) {
  const out = ['## 10. Per-User-Story Coverage Cross-Tab', ''];
  out.push('For each Phase 2 user story: which Phase 6 tasks, Phase 7 test cases, and Phase 8 evaluation criteria reach back to it? **A row with zero coverage in all three columns is an orphan user story — generated by Phase 2 but never implemented, tested, or evaluated.**', '');

  const fr = getCurrentArtifact(db, runId, 'fr_bloom_skeleton');
  const stories = fr?.user_stories ?? [];
  if (stories.length === 0) {
    out.push('_(no user stories)_', '');
    return out.join('\n');
  }

  // Pre-index task `traces_to` and component_id → component → trace
  const taskByUsId = new Map();
  for (const t of tasks) {
    const refs = [...(t.traces_to ?? [])];
    // Also accept task description / name containing US-XXX
    const blob = [t.description ?? '', t.name ?? '', t.component_responsibility ?? ''].join(' ');
    for (const us of stories) {
      const cited = refs.includes(us.id) || blob.includes(us.id);
      if (cited) {
        if (!taskByUsId.has(us.id)) taskByUsId.set(us.id, []);
        taskByUsId.get(us.id).push(t.id);
      }
    }
  }

  // Test cases: test.acceptance_criterion_ids may cite US-XXX directly or
  // some other id namespace. Coverage credit when a test's AC ref STARTS
  // with the user story id (catches `US-001-A1` style child refs too).
  const testByUsId = new Map();
  for (const tc of testCases) {
    for (const us of stories) {
      const cited = (tc.acceptance_criterion_ids ?? []).some((r) => String(r) === us.id || String(r).startsWith(`${us.id}-`));
      if (cited) {
        if (!testByUsId.has(us.id)) testByUsId.set(us.id, []);
        testByUsId.get(us.id).push(tc.test_case_id);
      }
    }
  }

  out.push('| US id | Action | Tasks | Test cases | Eval criterion? | Orphan? |');
  out.push('|---|---|---|---|---|---|');
  let orphanCount = 0;
  for (const us of stories) {
    const ts = taskByUsId.get(us.id) ?? [];
    const tcs = testByUsId.get(us.id) ?? [];
    const hasEval = functionalEvalIds.has(us.id) ? 'yes' : 'no';
    const orphan = ts.length === 0 && tcs.length === 0 && !functionalEvalIds.has(us.id);
    if (orphan) orphanCount++;
    out.push(`| ${us.id} | ${esc(us.action ?? '').slice(0, 50)} | ${ts.length === 0 ? '_(none)_' : ts.map((x) => `\`${x}\``).join(', ')} | ${tcs.length === 0 ? '_(none)_' : tcs.map((x) => `\`${x}\``).join(', ')} | ${hasEval} | ${orphan ? '**ORPHAN**' : ''} |`);
  }
  out.push('');
  out.push(`**Orphan user stories:** ${orphanCount} of ${stories.length} (${Math.round(100 * orphanCount / stories.length)}%)`, '');

  return out.join('\n');
}

// ── Section 6: Phase 9 execution outcomes ──────────────────────────

function sectionPhase9Execution(db, runId, tasks) {
  const out = ['## 8. Phase 9 — Execution Outcomes', ''];
  const summary = getCurrentArtifact(db, runId, 'implementation_task_execution', 'execution_summary');
  if (summary) {
    out.push(`**Tasks attempted:** ${summary.tasks_attempted ?? '?'} · **Completed:** ${summary.tasks_completed ?? '?'} · **Failed:** ${summary.tasks_failed ?? '?'} · **Quarantined:** ${summary.tasks_quarantined ?? '?'} · **Rescued:** ${summary.rescued ?? '?'} · **Terminally deferred:** ${summary.terminally_deferred ?? '?'}`);
    if (Array.isArray(summary.wave_outcomes)) {
      out.push('**Wave outcomes:**');
      for (const w of summary.wave_outcomes) {
        out.push(bullet(`Wave ${w.waveNumber} (${w.waveKind}) — successful: ${w.successful}, quarantined: ${w.quarantined}, decision: ${w.decision}`));
      }
    }
    out.push('');
  }

  // Per-task: gather quarantine + test results.
  const quarantines = getRecordsByType(db, runId, 'task_quarantine');
  const quarById = new Map();
  for (const q of quarantines) {
    const c = q.content;
    const id = c.leaf_task_id ?? c.task_id;
    if (id) quarById.set(id, c);
  }
  const testResults = getRecordsByType(db, runId, 'task_test_result');
  const testsByTask = new Map();
  for (const t of testResults) {
    const c = t.content;
    const id = c.task_id ?? c.leaf_task_id;
    if (!id) continue;
    if (!testsByTask.has(id)) testsByTask.set(id, []);
    testsByTask.get(id).push(c);
  }
  const fsWrites = getRecordsByType(db, runId, 'file_system_write_record');
  const writesByTask = new Map();
  for (const w of fsWrites) {
    const c = w.content;
    const id = c.task_id ?? c.leaf_task_id;
    if (!id) continue;
    if (!writesByTask.has(id)) writesByTask.set(id, []);
    writesByTask.get(id).push(c);
  }

  out.push('### Per-task outcomes');
  out.push('| Task ID | Outcome | Files Written | Files Modified | Test Results | Notes |');
  out.push('|---|---|---:|---:|---|---|');
  for (const t of tasks) {
    const q = quarById.get(t.id);
    const writes = writesByTask.get(t.id) ?? [];
    const written = writes.filter((w) => (w.operation ?? w.action) === 'create' || (w.operation ?? w.action) === 'write').length;
    const modified = writes.filter((w) => (w.operation ?? w.action) === 'modify' || (w.operation ?? w.action) === 'edit').length;
    const tests = testsByTask.get(t.id) ?? [];
    const passes = tests.filter((tr) => tr.passed === true || tr.outcome === 'passed').length;
    const fails = tests.filter((tr) => tr.passed === false || tr.outcome === 'failed').length;
    let outcome = 'succeeded';
    if (q?.rescue_status === 'terminally_deferred') outcome = '❌ terminally deferred';
    else if (q?.rescue_status === 'rescued') outcome = '⚠ rescued (after retry)';
    else if (q) outcome = '⚠ quarantined';
    const notes = q?.reason ? esc(q.reason).slice(0, 80) : '';
    out.push(`| ${t.id} | ${outcome} | ${written || (writes.length || '?')} | ${modified || '0'} | ${passes}/${tests.length} pass | ${notes} |`);
  }
  out.push('');

  return out.join('\n');
}

// ── Section 7: AC coverage report ──────────────────────────────────

function collectAllAcs(db, runId) {
  const fr = getCurrentArtifact(db, runId, 'fr_bloom_skeleton');
  const result = []; // [{usId, acId, description, measurable}]
  for (const us of fr?.user_stories ?? []) {
    for (const ac of us.acceptance_criteria ?? []) {
      result.push({
        usId: us.id,
        acId: ac.id,
        description: ac.description ?? '',
        measurable: ac.measurable_condition ?? '',
        usAction: us.action ?? '',
      });
    }
  }
  return result;
}

function buildAcCoverageReport(db, runId, tasks, testCases, useKeywordFallback) {
  const out = ['## 9. AC Coverage Report', ''];
  out.push('Covers each AC by **task** (Phase 6 traces) AND by **test case** (Phase 7 traces). A test referencing the AC id implies the AC was at least planned-for; a task referencing the AC id implies it was scheduled for implementation. Both are weak proxies — the report shows what was claimed, not what was actually built.', '');
  const acs = collectAllAcs(db, runId);
  if (acs.length === 0) {
    out.push('_(no acceptance criteria found)_', '');
    return out.join('\n');
  }

  // Build per-AC list of tasks that cite the AC id literally in `traces_to`,
  // `completion_criteria[].description`, or `description`.
  const acTaskMap = new Map(); // acId -> [{taskId, mode, citation}]
  function addHit(acId, taskId, mode, citation) {
    if (!acTaskMap.has(acId)) acTaskMap.set(acId, []);
    acTaskMap.get(acId).push({ taskId, mode, citation });
  }

  for (const t of tasks) {
    const tracesTo = (t.traces_to ?? []).map((s) => String(s));
    const completionCriteria = (t.completion_criteria ?? []).map((c) => c.description ?? '');
    const blob = [t.description ?? '', t.name ?? '', ...tracesTo, ...completionCriteria].join(' ');
    for (const ac of acs) {
      // Strict mode: explicit AC id in traces_to or completion_criteria description.
      if (tracesTo.includes(ac.acId)) {
        addHit(ac.acId, t.id, 'strict-traces_to', ac.acId);
      } else if (completionCriteria.some((c) => c.includes(ac.acId))) {
        addHit(ac.acId, t.id, 'strict-completion_criteria', ac.acId);
      } else if (useKeywordFallback) {
        // Fallback: any meaningful keyword from the measurable_condition
        // appears in the task blob. Splits on non-word chars and drops
        // words shorter than 5 chars to reduce false positives.
        const keywords = (ac.measurable ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 5);
        const hits = keywords.filter((k) => blob.toLowerCase().includes(k));
        if (hits.length >= 2) {
          addHit(ac.acId, t.id, 'keyword-fallback', `[${hits.slice(0, 4).join(',')}]`);
        }
      }
    }
  }

  // Build per-AC list of test cases that cite the AC id either directly or
  // via `${usId}-${acId}` style. Test cases use a separate acceptance_criterion_ids
  // schema field so the match is cleaner than the task case.
  const acTestMap = new Map(); // acId -> [{testCaseId, mode}]
  function addTestHit(acId, testCaseId, mode) {
    if (!acTestMap.has(acId)) acTestMap.set(acId, []);
    acTestMap.get(acId).push({ testCaseId, mode });
  }
  for (const tc of testCases) {
    const refs = (tc.acceptance_criterion_ids ?? []).map(String);
    for (const ac of acs) {
      const composite = `${ac.usId}-${ac.acId}`;
      if (refs.includes(ac.acId) || refs.includes(composite)) {
        addTestHit(ac.acId, tc.test_case_id, 'strict-ac-id');
      } else if (refs.some((r) => r.startsWith(`${ac.usId}-`))) {
        addTestHit(ac.acId, tc.test_case_id, 'strict-us-id-prefix');
      }
    }
  }

  // Render
  out.push('### 9a. Each AC → tasks & test cases');
  out.push('| User Story | AC | Description | Tasks Covering | Test Cases Covering |');
  out.push('|---|---|---|---|---|');
  for (const ac of acs) {
    const taskHits = acTaskMap.get(ac.acId) ?? [];
    const testHits = acTestMap.get(ac.acId) ?? [];
    const taskCell = taskHits.length === 0 ? '_(none)_' : taskHits.map((h) => `\`${h.taskId}\` (${h.mode})`).join('; ');
    const testCell = testHits.length === 0 ? '_(none)_' : testHits.map((h) => `\`${h.testCaseId}\` (${h.mode})`).join('; ');
    out.push(`| ${ac.usId} | ${ac.acId} | ${esc(ac.description).slice(0, 100)} | ${taskCell} | ${testCell} |`);
  }
  out.push('');

  // Uncovered list — uncovered by BOTH tasks AND tests is the strict orphan set.
  const uncoveredByTasks = acs.filter((ac) => !(acTaskMap.get(ac.acId)?.length > 0));
  const uncoveredByBoth = acs.filter((ac) =>
    !(acTaskMap.get(ac.acId)?.length > 0) && !(acTestMap.get(ac.acId)?.length > 0));
  out.push(`### 9b. AC coverage tallies`);
  out.push(`- Total ACs: **${acs.length}**`);
  out.push(`- Uncovered by tasks: **${uncoveredByTasks.length}**`);
  out.push(`- Uncovered by tasks AND tests (true orphans): **${uncoveredByBoth.length}**`);
  out.push('');
  out.push('### 9c. ACs uncovered by tasks AND tests (true orphans)');
  if (uncoveredByBoth.length === 0) {
    out.push('_All ACs have at least one tracing task or test case._');
  } else {
    for (const ac of uncoveredByBoth) {
      out.push(bullet(`**${ac.usId}/${ac.acId}** — ${esc(ac.description).slice(0, 200)}`));
    }
  }
  out.push('');

  if (useKeywordFallback) {
    out.push('_Keyword fallback is enabled. Strict mode (no fallback) would report higher uncovered count — these are best-effort matches that may include false positives._', '');
  } else {
    out.push('_Strict mode: an AC is covered only if a task explicitly cites the AC id in `traces_to` or `completion_criteria[].description`. Pass `--ac-keyword-fallback` to also accept keyword-overlap matches._', '');
  }

  return out.join('\n');
}

// ── Section 8: drift / over-invention ──────────────────────────────

function sectionDriftReport(db, runId) {
  const out = ['## 11. Drift / Over-Invention Report', ''];

  // Phase 1 — items whose `source` field is `ai-proposed` (= over-invented under product lens).
  out.push('### 11a. Phase 1 — AI-proposed items not in source spec');
  out.push('_Items below were proposed by the model under the product lens. They may still be valid, but they did not originate in the spec text._', '');

  const candidates = [
    ['Domains', 'business_domains_bloom', 'domains'],
    ['Personas', 'business_domains_bloom', 'personas'],
    ['Journeys', 'user_journey_bloom', 'userJourneys'],
    ['Workflows', 'system_workflow_bloom', 'workflows'],
    ['Entities', 'entities_bloom', 'entities'],
    ['Integrations', 'integrations_qa_bloom', 'integrations'],
  ];
  for (const [label, subPhase, key] of candidates) {
    const a = getCurrentArtifact(db, runId, subPhase);
    if (!a || !Array.isArray(a[key])) continue;
    const ai = a[key].filter((x) => x.source === 'ai-proposed');
    out.push(`**${label} — ai-proposed (${ai.length}/${a[key].length}):**`);
    if (ai.length === 0) { out.push('_(none)_', ''); continue; }
    for (const x of ai) {
      out.push(bullet(`**${x.id}** — ${esc(x.name ?? x.title ?? '(no name)')}`));
    }
    out.push('');
  }

  // Phase 2+ — user stories whose `traces_to` doesn't reach a Phase 1 id.
  out.push('### 11b. Phase 2 — user stories whose `traces_to` doesn\'t resolve to any Phase 1 id');
  out.push('_If a user story\'s traces_to is empty OR none of its referenced ids exist among the Phase 1 outputs, it\'s likely an invention with no upstream anchor._', '');

  const allUpstreamIds = new Set();
  for (const [, subPhase, key] of candidates) {
    const a = getCurrentArtifact(db, runId, subPhase);
    for (const x of a?.[key] ?? []) if (x.id) allUpstreamIds.add(x.id);
  }
  // Also include the upstream extraction-set ids (compliance, retention, V&V, vocab, tech constraints).
  for (const [subPhase, key] of [
    ['compliance_retention_discovery', 'compliance_extracted_items'],
    ['vv_requirements_discovery', 'vvRequirements'],
    ['canonical_vocabulary_discovery', 'canonicalVocabulary'],
    ['technical_constraints_discovery', 'technicalConstraints'],
  ]) {
    const a = getCurrentArtifact(db, runId, subPhase);
    for (const x of a?.[key] ?? []) if (x.id) allUpstreamIds.add(x.id);
  }

  const fr = getCurrentArtifact(db, runId, 'fr_bloom_skeleton');
  const orphanStories = [];
  for (const us of fr?.user_stories ?? []) {
    const refs = us.traces_to ?? [];
    const resolvable = refs.filter((r) => allUpstreamIds.has(r));
    if (refs.length === 0 || resolvable.length === 0) {
      orphanStories.push({ us, refs, resolvable });
    }
  }
  if (orphanStories.length === 0) {
    out.push('_All user stories have at least one Phase 1 ancestor reference._');
  } else {
    out.push('| Story ID | Action | Traces To (all) | Resolved to Phase 1 |');
    out.push('|---|---|---|---|');
    for (const o of orphanStories) {
      out.push(`| ${o.us.id} | ${esc(o.us.action ?? '').slice(0, 60)} | \`${(o.refs).join('`, `') || '(empty)'}\` | ${o.resolvable.length === 0 ? '_(none)_' : `\`${o.resolvable.join('`, `')}\``} |`);
    }
  }
  out.push('');

  // Phase 6 — tasks whose component_id doesn't resolve to a Phase 4 component.
  out.push('### 11c. Phase 6 — tasks with `component_id` that doesn\'t resolve to a Phase 4 component');
  const comps = getCurrentArtifact(db, runId, 'component_skeleton');
  const knownComps = new Set((comps?.components ?? []).map((c) => c.id));
  // Also include child component ids from the saturation tree.
  const compNodes = getRecordsByType(db, runId, 'component_decomposition_node');
  for (const n of compNodes) {
    const c = n.content;
    if (c?.component?.id) knownComps.add(c.component.id);
    if (c?.node_id) knownComps.add(c.node_id);
  }
  const plan = getCurrentArtifact(db, runId, 'task_skeleton');
  const orphanTasks = (plan?.tasks ?? []).filter((t) => t.component_id && !knownComps.has(t.component_id));
  if (orphanTasks.length === 0) {
    out.push('_All tasks reference a known component._');
  } else {
    out.push('| Task ID | Name | Unresolved component_id |');
    out.push('|---|---|---|');
    for (const t of orphanTasks) {
      out.push(`| ${t.id} | ${esc(t.name)} | \`${t.component_id}\` |`);
    }
  }
  out.push('');

  return out.join('\n');
}

// ── Section 9: telemetry summary ───────────────────────────────────

function sectionTelemetry(db, runId) {
  const out = ['## 12. Telemetry Summary', ''];
  const run = getRun(db, runId);
  if (!run) { out.push('_(no workflow_runs row)_'); return out.join('\n'); }
  out.push('| Field | Value |');
  out.push('|---|---|');
  out.push(`| workflow_run_id | \`${run.id}\` |`);
  out.push(`| initiated_at | ${run.initiated_at} |`);
  out.push(`| status | ${run.status ?? '?'} |`);
  out.push(`| intent_lens | ${run.intent_lens ?? '?'} |`);
  out.push(`| current_phase_id | ${run.current_phase_id ?? '?'} |`);
  out.push(`| decomposition_budget_calls_used | ${run.decomposition_budget_calls_used ?? '?'} |`);
  out.push(`| decomposition_max_depth_reached | ${run.decomposition_max_depth_reached ?? '?'} |`);
  out.push(`| quarantined_leaf_count | ${run.quarantined_leaf_count ?? '?'} |`);
  out.push(`| terminally_deferred_leaf_count | ${run.terminally_deferred_leaf_count ?? '?'} |`);
  out.push(`| total_execution_waves | ${run.total_execution_waves ?? '?'} |`);
  out.push('');
  return out.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  const repoRoot = path.resolve(__dirname, '..');
  const workspace = args.workspace
    ? path.resolve(args.workspace)
    : discoverWorkspace(repoRoot);
  if (!fs.existsSync(workspace)) {
    process.stderr.write(`error: workspace path does not exist: ${workspace}\n`);
    process.exit(2);
  }
  const dbPath = findDbForWorkspace(workspace);
  const outPath = args.out
    ? path.resolve(args.out)
    : path.join(workspace, 'decomposition-trace-report.md');

  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const runId = resolveRunId(db, args.runId);

    const sections = [];
    sections.push(`# Decomposition Trace Report\n`);
    sections.push(`**Workspace:** \`${workspace}\``);
    sections.push(`**Database:** \`${dbPath}\``);
    sections.push(`**Run ID:** \`${runId}\``);
    sections.push(`**Generated:** ${new Date().toISOString()}`);
    sections.push('');

    sections.push(sectionOriginalIntent(workspace));
    sections.push(sectionPruningEffectiveness(db, runId));
    sections.push(sectionPhase1(db, runId));
    sections.push(sectionPhase2UserStoriesAndACs(db, runId));
    sections.push(sectionPhase3to5(db, runId));
    sections.push(sectionAllSaturation(db, runId));
    const phase6 = sectionPhase6Tasks(db, runId);
    sections.push(phase6.md);
    const phase7 = sectionPhase7TestPlan(db, runId);
    sections.push(phase7.md);
    const phase8 = sectionPhase8Evaluation(db, runId);
    sections.push(phase8.md);
    sections.push(sectionPhase9Execution(db, runId, phase6.tasks));
    sections.push(buildAcCoverageReport(db, runId, phase6.tasks, phase7.testCases, args.acKeywordFallback));
    sections.push(sectionUserStoryCrossTab(db, runId, phase6.tasks, phase7.testCases, phase8.functionalEvalIds));
    sections.push(sectionDriftReport(db, runId));
    sections.push(sectionTelemetry(db, runId));

    const body = sections.join('\n');
    fs.writeFileSync(outPath, body, 'utf8');
    process.stdout.write(`Wrote ${outPath} (${body.length} bytes)\n`);
  } finally {
    db.close();
  }
}

main();
