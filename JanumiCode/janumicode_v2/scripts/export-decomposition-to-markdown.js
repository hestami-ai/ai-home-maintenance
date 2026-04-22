#!/usr/bin/env node
/**
 * Export the Wave 6 FR / NFR decomposition tree from a workflow-run's
 * governed stream as a human-readable markdown document (FRD/NFRD-style).
 *
 * Sibling of extract-phase2-decomposition.js, which emits flat JSON for
 * fixture regression. This script reconstructs the parent/child tree
 * from `content.parent_node_id` links and renders it with heading +
 * bullet nesting, so a reviewer can scan user stories, acceptance
 * criteria, tier, and status in the order a human would read them.
 *
 * Safe to run against a DB the sidecar is actively writing to — we open
 * read-only and do not block WAL writers.
 *
 * Usage:
 *   node scripts/export-decomposition-to-markdown.js \
 *     --db <path>                 (required)
 *     [--out <path.md>]           (default: stdout)
 *     [--run-id <id>]             (default: latest workflow_run)
 *     [--root-kind fr|nfr|both]   (default: both)
 *     [--include-context]         (prepend Phase 1 business-context section)
 *
 * Exit codes: 0 success, 2 CLI-usage error, 3 no run / no data.
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const Database = require('better-sqlite3');

// ── CLI parsing ────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { rootKind: 'both', includeContext: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.db = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--run-id') out.runId = argv[++i];
    else if (a === '--root-kind') out.rootKind = argv[++i];
    else if (a === '--include-context') out.includeContext = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'usage: --db <path> [--out <path.md>] [--run-id <id>] ' +
        '[--root-kind fr|nfr|both] [--include-context]\n',
      );
      process.exit(0);
    }
  }
  if (!out.db) {
    process.stderr.write('error: --db <path> is required\n');
    process.exit(2);
  }
  if (!['fr', 'nfr', 'both'].includes(out.rootKind)) {
    process.stderr.write(`error: --root-kind must be fr|nfr|both (got "${out.rootKind}")\n`);
    process.exit(2);
  }
  return out;
}

// ── Queries ────────────────────────────────────────────────────────

function pickRunId(db, wanted) {
  if (wanted) return wanted;
  const row = db.prepare(
    `SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1`,
  ).get();
  if (!row) {
    process.stderr.write('error: no workflow_runs in this database\n');
    process.exit(3);
  }
  return row.id;
}

function fetchWorkflowRun(db, runId) {
  return db.prepare(
    `SELECT id, current_phase_id, status, intent_lens,
            decomposition_budget_calls_used, decomposition_max_depth_reached,
            initiated_at
       FROM workflow_runs WHERE id = ?`,
  ).get(runId);
}

function fetchDecompositionNodes(db, runId) {
  const rows = db.prepare(
    `SELECT id, content, sub_phase_id, produced_at
       FROM governed_stream
      WHERE workflow_run_id = ?
        AND record_type = 'requirement_decomposition_node'
        AND is_current_version = 1
      ORDER BY produced_at ASC`,
  ).all(runId);
  return rows.map((r) => ({
    id: r.id,
    sub_phase_id: r.sub_phase_id,
    produced_at: r.produced_at,
    content: JSON.parse(r.content),
  }));
}

function fetchPhase1Artifact(db, runId, kind) {
  const rows = db.prepare(
    `SELECT content, sub_phase_id, produced_at
       FROM governed_stream
      WHERE workflow_run_id = ?
        AND record_type = 'artifact_produced'
        AND is_current_version = 1
        AND phase_id = '1'
      ORDER BY produced_at DESC`,
  ).all(runId);
  for (const r of rows) {
    try {
      const c = JSON.parse(r.content);
      if (c && c.kind === kind) return c;
    } catch { /* skip */ }
  }
  return null;
}

// ── Tree reconstruction ────────────────────────────────────────────

function buildTree(nodes, rootKind) {
  const filtered = nodes.filter((n) => (n.content.root_kind ?? 'fr') === rootKind);
  const byParent = new Map();
  const roots = [];
  for (const n of filtered) {
    const pid = n.content.parent_node_id;
    if (pid == null || n.content.depth === 0) roots.push(n);
    else {
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid).push(n);
    }
  }
  const sortKey = (a, b) =>
    (a.content.depth - b.content.depth) ||
    ((a.content.pass_number ?? 0) - (b.content.pass_number ?? 0)) ||
    a.produced_at.localeCompare(b.produced_at);
  roots.sort(sortKey);
  for (const kids of byParent.values()) kids.sort(sortKey);
  return { roots, byParent, filtered };
}

// ── Rendering ──────────────────────────────────────────────────────

function badges(c) {
  const parts = [];
  if (c.tier) parts.push(`Tier ${c.tier}`);
  if (c.status) parts.push(c.status);
  if (!parts.length) return '';
  return ' `[' + parts.join(' · ') + ']`';
}

function formatAc(ac, indent) {
  const pad = ' '.repeat(indent);
  const desc = (ac.description ?? '').trim();
  const meas = (ac.measurable_condition ?? '').trim();
  let out = `${pad}- **${ac.id}** — ${desc || '_no description_'}`;
  if (meas) out += `\n${pad}  - _Measurable:_ ${meas}`;
  return out;
}

function headingFor(depth) {
  // H3 roots → H4 depth-1 → H5 depth-2. Beyond H5, caller uses bullets.
  if (depth === 0) return '###';
  if (depth === 1) return '####';
  if (depth === 2) return '#####';
  return null;
}

function renderStoryBlock(c, bulletPrefix, extraIndent) {
  // Renders the user story + ACs + status-line as a contiguous block.
  // `bulletPrefix`: '' when called at heading level; '  ' (plus extra)
  // when the whole block is the body of a bullet.
  const lines = [];
  const indent = bulletPrefix;
  const story = c.user_story;
  if (!story) {
    lines.push(`${indent}_(${c.status ?? 'deferred'}${c.pruning_reason ? ' — ' + c.pruning_reason : ''})_`);
    return lines.join('\n');
  }
  if (story.role || story.action || story.outcome) {
    const role = (story.role ?? '').trim();
    const action = (story.action ?? '').trim();
    const outcome = (story.outcome ?? '').trim();
    lines.push(
      `${indent}**As a** ${role || '—'}, **I want** ${action || '—'}, ` +
      `**so that** ${outcome || '—'}.`,
    );
  }
  const acs = Array.isArray(story.acceptance_criteria) ? story.acceptance_criteria : [];
  if (acs.length > 0) {
    lines.push('');
    lines.push(`${indent}**Acceptance criteria:**`);
    for (const ac of acs) lines.push(formatAc(ac, indent.length + extraIndent));
  }
  // Metadata line
  const meta = [];
  if (c.status) meta.push(`Status: ${c.status}`);
  if (story.priority) meta.push(`Priority: ${story.priority}`);
  if (c.tier) meta.push(`Tier: ${c.tier}`);
  if (Array.isArray(story.traces_to) && story.traces_to.length) {
    meta.push(`Traces to: ${story.traces_to.join(', ')}`);
  }
  if (c.pass_number != null) meta.push(`Pass: ${c.pass_number}`);
  if (meta.length) {
    lines.push('');
    lines.push(`${indent}_${meta.join(' · ')}_`);
  }
  if (c.decomposition_rationale && c.decomposition_rationale.trim()) {
    lines.push('');
    lines.push(`${indent}_Decomposition rationale:_ ${c.decomposition_rationale.trim()}`);
  }
  if (c.pruning_reason && c.status === 'pruned') {
    lines.push('');
    lines.push(`${indent}_Pruning reason:_ ${c.pruning_reason}`);
  }
  if (Array.isArray(c.surfaced_assumption_ids) && c.surfaced_assumption_ids.length) {
    lines.push('');
    lines.push(`${indent}_Surfaced assumptions:_ ${c.surfaced_assumption_ids.join(', ')}`);
  }
  return lines.join('\n');
}

function renderNode(node, byParent, out, visited) {
  const c = node.content;
  if (visited.has(c.node_id)) {
    // Post-UUID-refactor cycles are impossible under normal operation
    // (each logical node is a fresh UUID). This guard remains as a
    // safety net for hand-edited DBs or cross-version resume paths.
    const depth = c.depth ?? 0;
    const pad = depth <= 2 ? '' : '  '.repeat(depth - 2);
    out.push(`${pad}- _(cycle: ${c.display_key ?? c.node_id} already rendered above — skipped)_`);
    return;
  }
  visited.add(c.node_id);
  const depth = c.depth ?? 0;
  const heading = headingFor(depth);
  // Tree joins key on the UUID `node_id`; everything user-facing shows
  // `display_key` (falls back to user_story.id then the UUID).
  const joinKey = c.node_id;
  const label = c.display_key ?? c.user_story?.id ?? c.node_id;
  const storyId = c.user_story?.id;
  const name = (storyId && storyId !== label) ? `${label} (${storyId})` : label;

  if (heading) {
    const rootPrefix = depth === 0
      ? ((c.root_kind ?? 'fr').toUpperCase() + ' ')
      : '';
    out.push(`${heading} ${rootPrefix}${name}${badges(c)}`);
    out.push('');
    const body = renderStoryBlock(c, '', 2);
    if (body) { out.push(body); out.push(''); }
    // Children
    const kids = byParent.get(joinKey) ?? [];
    for (const k of kids) renderNode(k, byParent, out, visited);
  } else {
    // Bullet-list rendering for depth >= 3.
    // Indent relative to depth-2 parent by (depth - 2) * 2 spaces.
    const baseIndent = '  '.repeat(depth - 2);
    const headLine = `${baseIndent}- **${label}**${badges(c)}`;
    out.push(headLine);
    // Story block indented one bullet-level deeper
    const body = renderStoryBlock(c, baseIndent + '  ', 2);
    if (body) out.push(body);
    const kids = byParent.get(joinKey) ?? [];
    for (const k of kids) renderNode(k, byParent, out, visited);
  }
}

function renderSection(title, rootKind, tree, allForKind) {
  const out = [];
  const telem = telemetry(allForKind);
  out.push(`## ${title} (${telem.rootCount} roots · ${telem.total} total nodes · ${telem.by_status.atomic} atomic leaves)`);
  out.push('');
  if (tree.roots.length === 0) {
    out.push(`_No ${title.toLowerCase()} recorded yet for this run._`);
    return out.join('\n');
  }
  const visited = new Set();
  for (const r of tree.roots) renderNode(r, tree.byParent, out, visited);
  return out.join('\n');
}

function telemetry(nodes) {
  const t = {
    total: nodes.length,
    rootCount: 0,
    by_status: { atomic: 0, decomposed: 0, pending: 0, pruned: 0, deferred: 0, downgraded: 0 },
    by_tier: { A: 0, B: 0, C: 0, D: 0, root: 0 },
  };
  for (const n of nodes) {
    const c = n.content;
    if ((c.depth ?? 0) === 0) t.rootCount++;
    if (c.status && t.by_status[c.status] != null) t.by_status[c.status]++;
    const tier = c.tier ?? ((c.depth ?? 0) === 0 ? 'root' : null);
    if (tier && t.by_tier[tier] != null) t.by_tier[tier]++;
  }
  return t;
}

// ── Business context ───────────────────────────────────────────────

function renderBusinessContext(db, runId) {
  const out = [];
  out.push('## Business Context');
  out.push('');

  const lens = fetchPhase1Artifact(db, runId, 'intent_lens_classification');
  if (lens) {
    out.push('### Intent Lens');
    out.push(`**Lens:** ${lens.lens}${lens.fallback_lens && lens.fallback_lens !== lens.lens ? ` (fallback: ${lens.fallback_lens})` : ''}  `);
    if (typeof lens.confidence === 'number') out.push(`**Confidence:** ${lens.confidence.toFixed(2)}  `);
    if (lens.rationale) out.push(`**Rationale:** ${lens.rationale}`);
    out.push('');
  }

  const statement = fetchPhase1Artifact(db, runId, 'intent_statement');
  if (statement && statement.product_concept) {
    const pc = statement.product_concept;
    out.push('### Intent Statement');
    if (pc.name) out.push(`**${pc.name}**`);
    out.push('');
    if (pc.description) { out.push(pc.description); out.push(''); }
    if (pc.who_it_serves) out.push(`**Who it serves:** ${pc.who_it_serves}  `);
    if (pc.problem_it_solves) out.push(`**Problem:** ${pc.problem_it_solves}`);
    out.push('');
    if (Array.isArray(statement.confirmed_assumptions) && statement.confirmed_assumptions.length) {
      out.push('#### Confirmed Assumptions');
      for (const a of statement.confirmed_assumptions) {
        const text = a.assumption || a.text || JSON.stringify(a);
        const tag = a.assumption_id ? `**${a.assumption_id}** — ` : '';
        out.push(`- ${tag}${text}`);
      }
      out.push('');
    }
    if (Array.isArray(statement.confirmed_constraints) && statement.confirmed_constraints.length) {
      out.push('#### Confirmed Constraints');
      for (const c of statement.confirmed_constraints) out.push(`- ${c}`);
      out.push('');
    }
    if (Array.isArray(statement.out_of_scope) && statement.out_of_scope.length) {
      out.push('#### Out of Scope');
      for (const c of statement.out_of_scope) out.push(`- ${c}`);
      out.push('');
    }
  }

  const compliance = fetchPhase1Artifact(db, runId, 'compliance_context');
  if (compliance && Array.isArray(compliance.regimes) && compliance.regimes.length) {
    out.push('### Compliance Regimes');
    for (const r of compliance.regimes) {
      const name = r.name ?? r.regime ?? r.id ?? JSON.stringify(r);
      const rationale = r.rationale ?? r.reason ?? '';
      out.push(`- **${name}**${rationale ? ` — ${rationale}` : ''}`);
    }
    out.push('');
  }

  const handoff = fetchPhase1Artifact(db, runId, 'product_description_handoff');
  if (handoff) {
    if (handoff.productVision || handoff.productDescription || handoff.summary) {
      out.push('### Product Narrative');
      if (handoff.summary)            { out.push(`**Summary:** ${handoff.summary}`); out.push(''); }
      if (handoff.productVision)      { out.push(`**Vision:** ${handoff.productVision}`); out.push(''); }
      if (handoff.productDescription) { out.push(handoff.productDescription); out.push(''); }
    }
    if (Array.isArray(handoff.personas) && handoff.personas.length) {
      out.push(`### Personas (${handoff.personas.length})`);
      for (const p of handoff.personas) {
        out.push(`- **${p.name ?? p.id ?? 'unnamed'}** — ${(p.description ?? '').trim()}`);
      }
      out.push('');
    }
    if (Array.isArray(handoff.businessDomainProposals) && handoff.businessDomainProposals.length) {
      out.push(`### Business Domains (${handoff.businessDomainProposals.length})`);
      for (const d of handoff.businessDomainProposals) {
        out.push(`- **${d.name ?? d.id}** — ${(d.description ?? '').trim()}`);
      }
      out.push('');
    }
    if (Array.isArray(handoff.userJourneys) && handoff.userJourneys.length) {
      out.push(`### User Journeys (${handoff.userJourneys.length})`);
      for (const j of handoff.userJourneys) {
        out.push(`- **${j.title ?? j.id}** (${j.personaId ?? '?'}): ${(j.scenario ?? '').trim()}`);
      }
      out.push('');
    }
  }

  return out.length > 2 ? out.join('\n') : null;
}

// ── Summary telemetry table ────────────────────────────────────────

function renderSummaryTable(nodes) {
  const fr = telemetry(nodes.filter((n) => (n.content.root_kind ?? 'fr') === 'fr'));
  const nfr = telemetry(nodes.filter((n) => n.content.root_kind === 'nfr'));
  const rows = [
    ['Kind', 'Roots', 'Total', 'Atomic', 'Decomposed', 'Pending', 'Pruned', 'Deferred', 'Downgraded', 'A', 'B', 'C', 'D'],
    ['FR',
      fr.rootCount, fr.total,
      fr.by_status.atomic, fr.by_status.decomposed, fr.by_status.pending,
      fr.by_status.pruned, fr.by_status.deferred, fr.by_status.downgraded,
      fr.by_tier.A, fr.by_tier.B, fr.by_tier.C, fr.by_tier.D],
    ['NFR',
      nfr.rootCount, nfr.total,
      nfr.by_status.atomic, nfr.by_status.decomposed, nfr.by_status.pending,
      nfr.by_status.pruned, nfr.by_status.deferred, nfr.by_status.downgraded,
      nfr.by_tier.A, nfr.by_tier.B, nfr.by_tier.C, nfr.by_tier.D],
  ];
  const out = ['## Summary Telemetry', ''];
  out.push('| ' + rows[0].join(' | ') + ' |');
  out.push('|' + rows[0].map(() => '---').join('|') + '|');
  for (let i = 1; i < rows.length; i++) {
    out.push('| ' + rows[i].join(' | ') + ' |');
  }
  return out.join('\n');
}

// ── Document header ────────────────────────────────────────────────

function renderDocumentHeader(wf) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + 'Z';
  const idShort = (wf.id ?? '').slice(0, 8);
  const lines = [
    `# Requirements Decomposition — ${idShort}`,
    '',
    `_Generated ${ts} · Run: ${wf.id}_`,
    `_Lens: ${wf.intent_lens ?? 'n/a'} · Phase: ${wf.current_phase_id ?? 'n/a'} · Status: ${wf.status ?? 'n/a'}_`,
    `_Budget used: ${wf.decomposition_budget_calls_used ?? 0} calls · Max depth reached: ${wf.decomposition_max_depth_reached ?? 0}_`,
  ];
  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  const db = new Database(args.db, { readonly: true, fileMustExist: true });
  try {
    const runId = pickRunId(db, args.runId);
    const wf = fetchWorkflowRun(db, runId);
    if (!wf) {
      process.stderr.write(`error: workflow_run ${runId} not found\n`);
      process.exit(3);
    }
    const nodes = fetchDecompositionNodes(db, runId);
    if (nodes.length === 0) {
      process.stderr.write(`warning: no requirement_decomposition_node records for run ${runId}\n`);
    }

    const parts = [];
    parts.push(renderDocumentHeader(wf));

    if (args.includeContext) {
      const ctx = renderBusinessContext(db, runId);
      if (ctx) parts.push(ctx);
    }

    const want = args.rootKind;
    if (want === 'fr' || want === 'both') {
      const tree = buildTree(nodes, 'fr');
      parts.push(renderSection('Functional Requirements', 'fr', tree, tree.filtered));
    }
    if (want === 'nfr' || want === 'both') {
      const tree = buildTree(nodes, 'nfr');
      parts.push(renderSection('Non-Functional Requirements', 'nfr', tree, tree.filtered));
    }

    parts.push(renderSummaryTable(nodes));

    const md = parts.join('\n\n') + '\n';
    if (args.out) {
      fs.writeFileSync(args.out, md);
      process.stderr.write(`[export] wrote ${md.length} bytes → ${args.out}\n`);
    } else {
      process.stdout.write(md);
    }
  } finally {
    db.close();
  }
}

main();
