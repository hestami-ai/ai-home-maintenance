#!/usr/bin/env tsx
/**
 * Deep auditor for a thin-slice run.
 *
 * Reads three corpora produced by an instrumented workflow:
 *   1. governed_stream DB (full artifact content + run state)
 *   2. transforms.jsonl  (per-step trace chain — Tier 3)
 *   3. lifecycle.ndjson  (phase / sub-phase / decision events — Tier 1/2)
 *
 * Runs ten categories of validation:
 *   A. Contract conformance (run every ContractSuite against its matching artifact)
 *   B. Empty required template variables
 *   C. JSON repair semantic fidelity (keys lost across repair)
 *   D. Normalizer silent drops (field_diff.removed / size_changed)
 *   E. Cross-phase reference resolvability (dangling US-/comp-/dm-/etc. refs)
 *   F. Tinyurl out-of-scope keyword detection
 *   G. Tinyurl intent-anchored counts (cheap sanity layer)
 *   H. Phase 8.5 packet integrity (empty user_stories / nfrs, fabricated ids)
 *   I. Phase 9 executor lifecycle (missing agent_output / stuck status)
 *   J. Persistence integrity (trace-step output vs DB content round-trip)
 *
 * Output: `<workspace>/.janumicode/deep-audit-report.json` plus a
 * human-readable summary to stdout.
 *
 * Usage:
 *   tsx src/cli/deep-audit.ts \
 *     --workspace <path> \
 *     [--run-id <id>]          # default: latest run in DB
 *     [--db <path>]            # default: pick largest numeric *.db in test-harness
 *     [--intent <path>]        # default: <workspace>/.janumicode/intent.md
 *     [--out <path>]           # default: <workspace>/.janumicode/deep-audit-report.json
 *     [--categories A,B,...]   # default: all
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import type { ContractContext, ContractResult, ContractSuite } from '../test/contracts/types';
import { CONTRACT_SUITES } from '../test/contracts/registry';
import { runContractSuite } from '../test/contracts/runner';
import { readEventsSync } from '../lib/aodd';
import type { AoddEvent } from '../lib/aodd';

// ── Types ──────────────────────────────────────────────────────────

type Severity = 'BLOCK' | 'WARN' | 'INFO';

interface Finding {
  category: string;
  severity: Severity;
  phase_id?: string | null;
  sub_phase_id?: string | null;
  record_id?: string;
  ref?: string;
  message: string;
  details?: unknown;
}

interface DbArtifact {
  record_id: string;
  record_type: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  produced_at: string;
  content: Record<string, unknown>;
  kind: string | undefined;
}

interface TransformStep {
  step_id: string;
  ts: string;
  step_type: string;
  sub_phase_id: string;
  parent_step_id: string | null;
  input_record_ids: string[];
  output_record_id?: string;
  field_diff?: Record<string, unknown>;
  duration_ms?: number;
  error?: { message: string; stack?: string };
  metadata?: Record<string, unknown>;
  payload?: unknown;
}

interface LifecycleEvent {
  ts: string;
  event: string;
  workflow_run_id: string;
  phase_id?: string | null;
  sub_phase_id?: string | null;
  [key: string]: unknown;
}

// ── CLI ────────────────────────────────────────────────────────────

interface Args {
  workspace: string;
  runId?: string;
  db?: string;
  intent?: string;
  out?: string;
  categories: Set<string>;
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  let cats = 'ABCDEFGHIJ';
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--workspace') out.workspace = argv[++i];
    else if (a === '--run-id') out.runId = argv[++i];
    else if (a === '--db') out.db = argv[++i];
    else if (a === '--intent') out.intent = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--categories') cats = argv[++i];
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'usage: --workspace <path> [--run-id <id>] [--db <path>] [--intent <path>] [--out <path>] [--categories A,B,...]\n',
      );
      process.exit(0);
    }
  }
  if (!out.workspace) {
    process.stderr.write('error: --workspace is required\n');
    process.exit(2);
  }
  return {
    workspace: out.workspace!,
    runId: out.runId,
    db: out.db,
    intent: out.intent,
    out: out.out,
    categories: new Set(cats.replaceAll(',', '').split('')),
  };
}

// ── Resolvers ──────────────────────────────────────────────────────

function resolveDbPath(workspace: string, override?: string): string {
  if (override) return override;
  const dbDir = path.join(workspace, '.janumicode', 'test-harness');
  if (!fs.existsSync(dbDir)) {
    throw new Error(`No .janumicode/test-harness directory at ${dbDir}`);
  }
  const files = fs.readdirSync(dbDir).filter((f) => f.endsWith('.db'));
  if (files.length === 0) throw new Error(`No .db file in ${dbDir}`);
  // Prefer largest numeric-named .db (original from init-thin-slice-run.sh).
  // Fall back to most-recent mtime if none match the numeric pattern.
  const numeric = files
    .filter((f) => /^\d+\.db$/.test(f))
    .map((f) => ({ f, ts: Number.parseInt(f.replace('.db', ''), 10) }))
    .sort((a, b) => b.ts - a.ts);
  if (numeric.length > 0) return path.join(dbDir, numeric[0].f);
  return path.join(
    dbDir,
    files.map((f) => ({ f, m: fs.statSync(path.join(dbDir, f)).mtimeMs })).sort((a, b) => b.m - a.m)[0].f,
  );
}

function resolveRunId(db: Database.Database, override?: string): string {
  if (override) return override;
  const row = db
    .prepare(`SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1`)
    .get() as { id: string } | undefined;
  if (!row) throw new Error('no workflow_runs in DB');
  return row.id;
}

// ── Loaders ────────────────────────────────────────────────────────

function loadArtifacts(db: Database.Database, runId: string): DbArtifact[] {
  const rows = db.prepare(`
    SELECT id, record_type, phase_id, sub_phase_id, produced_at, content
      FROM governed_stream
     WHERE workflow_run_id = ? AND is_current_version = 1
     ORDER BY produced_at ASC
  `).all(runId) as Array<{
    id: string; record_type: string; phase_id: string | null;
    sub_phase_id: string | null; produced_at: string; content: string;
  }>;
  const out: DbArtifact[] = [];
  for (const r of rows) {
    let content: Record<string, unknown> = {};
    try { content = JSON.parse(r.content) as Record<string, unknown>; } catch { continue; }
    out.push({
      record_id: r.id,
      record_type: r.record_type,
      phase_id: r.phase_id,
      sub_phase_id: r.sub_phase_id,
      produced_at: r.produced_at,
      content,
      kind: typeof content.kind === 'string' ? content.kind : undefined,
    });
  }
  return out;
}

// AODD event_type → legacy step_type, mirroring the
// TRANSFORM_STEP_TYPE_BY_AODD table that lived in
// src/lib/aodd/legacyProjection.ts (now deleted). Events not in this
// map are dropped from the projection — they have no transformation_step
// counterpart that the deep-audit categories know how to interpret.
const TRANSFORM_STEP_TYPE_BY_AODD: Record<string, string> = {
  'prompt.template_rendered': 'template_rendered',
  'prompt.materialized': 'prompt_materialized',
  'llm.invoked': 'llm_invoked',
  'llm.returned': 'llm_returned',
  'llm.failed': 'llm_returned',
  'llm.cache_hit': 'llm_returned',
  'repair.json_succeeded': 'json_repaired',
  'repair.json_failed': 'json_repaired',
  'context.assembled': 'context_assembled',
  'record.added': 'persisted',
  'agent.invocation_started': 'cli_invoked',
  'agent.invocation_completed': 'cli_returned',
};

const LIFECYCLE_EVENT_BY_AODD: Record<string, string> = {
  'phase.entered': 'phase.entered',
  'phase.exited': 'phase.exited',
  'sub_phase.entered': 'sub_phase.entered',
  'sub_phase.exited': 'sub_phase.exited',
  'run.resumed': 'workflow.resumed',
  'llm.invoked': 'llm.call',
  'llm.returned': 'llm.call',
  'llm.failed': 'llm.call',
  'llm.cache_hit': 'llm.call',
  'agent.invocation_started': 'executor.dispatched',
  'agent.invocation_completed': 'executor.invocation_status_change',
  'record.added': 'artifact.produced',
};

function eventToTransformStep(e: AoddEvent, stepType: string): TransformStep {
  const payload = e.payload as Record<string, unknown>;
  const metadata: Record<string, unknown> = { ...(e.metadata ?? {}) };
  if (e.invocation_id !== null) metadata.invocation_id = e.invocation_id;
  const step: TransformStep = {
    step_id: e.event_id,
    ts: e.ts,
    step_type: stepType,
    sub_phase_id: e.sub_phase_id ?? '',
    parent_step_id: e.parent_event_id,
    input_record_ids: [],
    metadata,
    payload,
  };
  if (typeof payload.duration_ms === 'number') step.duration_ms = payload.duration_ms;
  if (payload.error && typeof payload.error === 'object') {
    const errObj = payload.error as Record<string, unknown>;
    const msg = typeof errObj.message === 'string' ? errObj.message : '';
    step.error = { message: msg };
  }
  return step;
}

function loadTransforms(workspace: string, runId: string): TransformStep[] {
  // Sole source of truth: AODD events.ndjson. The legacy
  // transforms.jsonl writer has been removed.
  const out: TransformStep[] = [];
  for (const e of readEventsSync(workspace, runId)) {
    const stepType = TRANSFORM_STEP_TYPE_BY_AODD[e.event_type];
    if (!stepType) continue;
    out.push(eventToTransformStep(e, stepType));
  }
  return out;
}

function loadLifecycle(workspace: string, runId: string): LifecycleEvent[] {
  // Sole source of truth: AODD events.ndjson. The legacy
  // lifecycle.ndjson writer has been removed.
  const out: LifecycleEvent[] = [];
  for (const e of readEventsSync(workspace, runId)) {
    const event = LIFECYCLE_EVENT_BY_AODD[e.event_type];
    if (!event) continue;
    const payload = e.payload as Record<string, unknown>;
    out.push({
      ts: e.ts,
      event,
      workflow_run_id: e.run_id,
      phase_id: e.phase_id,
      sub_phase_id: e.sub_phase_id,
      ...payload,
    });
  }
  return out;
}

function loadIntent(workspace: string, override?: string): string {
  const file = override ?? path.join(workspace, '.janumicode', 'intent.md');
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

// ── Categories ─────────────────────────────────────────────────────

/**
 * A. Contract conformance.
 * For each artifact whose `content.kind` has a matching ContractSuite,
 * run the suite and surface any blocking failures as BLOCK findings,
 * advisory failures as WARN.
 */
function categoryA_contracts(artifacts: DbArtifact[], runId: string): Finding[] {
  const findings: Finding[] = [];
  // Index suites by producerArtifactKind for fast lookup.
  const suitesByKind = new Map<string, ContractSuite<unknown>>();
  for (const suite of CONTRACT_SUITES) {
    suitesByKind.set(suite.producerArtifactKind, suite);
  }
  // Build the relatedArtifacts context once (all artifacts grouped by kind).
  const byKind = new Map<string, unknown[]>();
  for (const a of artifacts) {
    if (!a.kind) continue;
    const list = byKind.get(a.kind);
    if (list) list.push(a.content); else byKind.set(a.kind, [a.content]);
  }
  const ctx: ContractContext = { workflowRunId: runId, relatedArtifacts: byKind };

  let suitesRun = 0;
  for (const artifact of artifacts) {
    if (!artifact.kind) continue;
    const suite = suitesByKind.get(artifact.kind);
    if (!suite) continue;
    suitesRun++;
    const results: ContractResult[] = runContractSuite(
      suite as ContractSuite<unknown>,
      artifact.content as unknown,
      ctx,
    );
    for (const r of results) {
      if (r.passed) continue;
      findings.push({
        category: 'A',
        severity: r.severity === 'blocking' ? 'BLOCK' : 'WARN',
        phase_id: artifact.phase_id,
        sub_phase_id: artifact.sub_phase_id,
        record_id: artifact.record_id,
        ref: `${r.boundaryId} ${r.clauseId}`,
        message: `${r.clauseDescription} — ${r.message ?? '(no message)'}`,
        details: r.details,
      });
    }
  }
  // Info finding noting coverage.
  findings.push({
    category: 'A',
    severity: 'INFO',
    message: `Ran ${suitesRun} contract suite invocations against artifacts (out of ${CONTRACT_SUITES.length} registered suites)`,
  });
  return findings;
}

/**
 * B. Empty required template variables.
 * For each template_rendered step, check the variables map: any variable
 * whose name is in required_variables but whose value is empty is a
 * BLOCK. metadata.empty_variable_count > 0 with no required overlap is
 * a WARN (might be intentional optional emptiness).
 */
function categoryB_emptyVars(steps: TransformStep[]): Finding[] {
  const findings: Finding[] = [];
  for (const s of steps) {
    if (s.step_type !== 'template_rendered') continue;
    const payload = (s.payload ?? {}) as Record<string, unknown>;
    const required = ((payload.template_metadata as Record<string, unknown> | undefined)?.required_variables as string[]) ?? [];
    const vars = (payload.variables ?? {}) as Record<string, { value?: string; size_chars?: number; empty?: boolean }>;
    for (const [name, info] of Object.entries(vars)) {
      if (!info?.empty) continue;
      const isRequired = required.includes(name);
      findings.push({
        category: 'B',
        severity: isRequired ? 'BLOCK' : 'WARN',
        sub_phase_id: s.sub_phase_id,
        ref: `template:${payload.template_key ?? '?'} var:${name}`,
        message: isRequired
          ? `Required variable {{${name}}} substituted with empty value`
          : `Optional variable {{${name}}} substituted with empty value`,
      });
    }
    const missing = (payload.missing_variables ?? []) as string[];
    for (const m of missing) {
      findings.push({
        category: 'B',
        severity: 'BLOCK',
        sub_phase_id: s.sub_phase_id,
        ref: `template:${payload.template_key ?? '?'} var:${m}`,
        message: `Required variable {{${m}}} not provided to template`,
      });
    }
  }
  return findings;
}

/**
 * C. JSON repair semantic fidelity.
 * For each json_repaired step, surface a WARN with the originalText
 * length, parsed presence, and attempts count. We can't easily assess
 * "did it preserve semantic intent" without a side-by-side comparison
 * the LLM might re-render, but we *can* surface every repair so the
 * operator can spot-check.
 */
function categoryC_repair(steps: TransformStep[]): Finding[] {
  const findings: Finding[] = [];
  for (const s of steps) {
    if (s.step_type !== 'json_repaired') continue;
    const payload = (s.payload ?? {}) as Record<string, unknown>;
    const meta = s.metadata ?? {};
    findings.push({
      category: 'C',
      severity: payload.parsed ? 'WARN' : 'BLOCK',
      sub_phase_id: s.sub_phase_id,
      ref: `invocation:${meta.invocation_id ?? '?'}`,
      message: payload.parsed
        ? `JSON repair succeeded (operator should spot-check semantic fidelity)`
        : `JSON repair attempted but produced no parsed result`,
      details: {
        success: meta.success,
        attempt_count: Array.isArray(payload.attempts) ? payload.attempts.length : undefined,
      },
    });
  }
  return findings;
}

/**
 * D. Normalizer silent drops.
 * For each normalized step, surface field_diff.removed or size_changed
 * (where to < from).
 */
function categoryD_normalize(steps: TransformStep[]): Finding[] {
  const findings: Finding[] = [];
  for (const s of steps) {
    if (s.step_type !== 'normalized') continue;
    const diff = s.field_diff as
      | { removed?: string[]; size_changed?: Array<{ field: string; from: number; to: number }> }
      | undefined;
    if (!diff) continue;
    const removed = diff.removed ?? [];
    const shrunk = (diff.size_changed ?? []).filter((sc) => sc.to < sc.from);
    if (removed.length === 0 && shrunk.length === 0) continue;
    findings.push({
      category: 'D',
      severity: 'WARN',
      sub_phase_id: s.sub_phase_id,
      ref: `normalizer:${(s.metadata?.normalizer as string) ?? '?'}`,
      message:
        (removed.length ? `removed fields: ${removed.join(',')}` : '') +
        (removed.length && shrunk.length ? '; ' : '') +
        (shrunk.length ? `shrunk arrays: ${shrunk.map((c) => `${c.field}[${c.from}→${c.to}]`).join(',')}` : ''),
      details: diff,
    });
  }
  return findings;
}

/**
 * E. Cross-phase reference resolvability.
 * Scan every artifact's content for ID references (US-/FR-/NFR-/UJ-/
 * comp-/dm-/api-/task-/AC-/res-) and verify each resolves to a known
 * id in the workflow run.
 */
/**
 * ID-shape patterns. We match the WHOLE string (with anchors) so that
 * narrative strings that happen to BEGIN with a prefix (e.g.
 * "NFR-2 — Stored URLs encrypted at rest") are not treated as IDs.
 * An ID is the prefix plus alphanumerics / hyphens / digits ONLY, with
 * no whitespace and no punctuation.
 */
const ID_PATTERNS = [
  { regex: /^US-[A-Za-z0-9-]+$/,   namespace: 'user_story' },
  { regex: /^FR-[A-Za-z0-9-]+$/,   namespace: 'fr' },
  { regex: /^NFR-[A-Za-z0-9-]+$/,  namespace: 'nfr' },
  { regex: /^UJ-[A-Za-z0-9-]+$/,   namespace: 'uj' },
  { regex: /^comp-[A-Za-z0-9-]+$/, namespace: 'component' },
  { regex: /^dm-[A-Za-z0-9-]+$/,   namespace: 'data_model' },
  { regex: /^api-[A-Za-z0-9-]+$/,  namespace: 'api' },
  { regex: /^task-[A-Za-z0-9-]+$/, namespace: 'task' },
  { regex: /^res-[A-Za-z0-9-]+$/,  namespace: 'responsibility' },
  { regex: /^AC-[A-Za-z0-9.-]+$/,  namespace: 'ac' },
];

function matchIdPattern(s: string): { namespace: string } | null {
  for (const p of ID_PATTERNS) {
    if (p.regex.test(s)) return { namespace: p.namespace };
  }
  return null;
}

function categoryE_xref(artifacts: DbArtifact[]): Finding[] {
  // Build the set of all canonical ids minted upstream. An ID is a
  // string in the right shape that appears as the `id` field of some
  // object (deep). We don't restrict by record_type here — the orchestrator
  // emits ids on multiple record types (artifact_produced, decomposition_node,
  // implementation_packet, etc.) and any of them can be referenced.
  const knownIds = new Set<string>();
  const collectKnownIds = (node: unknown): void => {
    if (typeof node === 'string' || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const x of node) collectKnownIds(x);
      return;
    }
    if (typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const v = obj.id;
    if (typeof v === 'string' && matchIdPattern(v)) knownIds.add(v);
    for (const child of Object.values(obj)) collectKnownIds(child);
  };
  for (const a of artifacts) collectKnownIds(a.content);

  // Now scan every artifact for ID-shaped strings that don't resolve.
  // The matchIdPattern() check is anchored to the WHOLE string, so
  // narrative strings like "NFR-2 — Stored URLs encrypted at rest"
  // are no longer treated as references (they don't match the regex).
  const findings: Finding[] = [];
  const seenRefs = new Set<string>();
  const collectRefs = (node: unknown, path: string[], artifact: DbArtifact): void => {
    if (typeof node === 'string') {
      // Skip the SELF id field on this record — that's a definition,
      // not a reference. Other id-shaped strings in any field ARE
      // references and need to resolve.
      if (path.at(-1) === 'id') return;
      const match = matchIdPattern(node);
      if (!match) return;
      if (knownIds.has(node)) return;
      const key = `${artifact.record_id}::${node}`;
      if (seenRefs.has(key)) return;
      seenRefs.add(key);
      findings.push({
        category: 'E',
        severity: 'BLOCK',
        phase_id: artifact.phase_id,
        sub_phase_id: artifact.sub_phase_id,
        record_id: artifact.record_id,
        ref: node,
        message: `Reference "${node}" (${match.namespace}) does not resolve to any current-version artifact`,
      });
      return;
    }
    if (Array.isArray(node)) {
      for (const x of node) collectRefs(x, path, artifact);
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) collectRefs(v, [...path, k], artifact);
    }
  };
  for (const a of artifacts) collectRefs(a.content, [], a);
  return findings;
}

/**
 * F. Tinyurl out-of-scope keyword detection.
 * Scan artifact content for substrings the intent doc says are out of
 * scope. Each artifact mentioning one of these is a WARN (LLM drift)
 * unless it's mentioning them explicitly to call them out-of-scope.
 */
const TINYURL_OUT_OF_SCOPE_KEYWORDS = [
  { kw: 'user accounts', clause: 'No user accounts, login, or per-user link history' },
  { kw: 'login', clause: 'No user accounts, login' },
  { kw: 'per-user link history', clause: 'No per-user link history' },
  { kw: 'vanity slug', clause: 'No custom (vanity) slugs' },
  { kw: 'custom slug', clause: 'No custom (vanity) slugs' },
  { kw: 'rate limiting', clause: 'No rate limiting on submission' },
  { kw: 'bulk submission', clause: 'No bulk submission APIs' },
  { kw: 'slug reservation', clause: 'No slug reservation or reuse after deletion' },
];

function categoryF_oos(artifacts: DbArtifact[]): Finding[] {
  const findings: Finding[] = [];
  for (const a of artifacts) {
    // Only check substantive content artifacts. Records that embed the
    // intent doc verbatim (discovery / handoff records) overwhelmingly
    // dominate the noise without surfacing actual drift.
    if (a.record_type !== 'artifact_produced') continue;
    const text = JSON.stringify(a.content).toLowerCase();
    // Single exclusion check: does this artifact's content contain
    // any out-of-scope-section marker AT ALL? If yes, it's quoting the
    // intent doc's Out-of-Scope section and every keyword mention is
    // legitimate. Only artifacts that mention an OOS keyword WITHOUT
    // such a marker are drift.
    const hasExclusionMarker = /out of scope|not in scope|out-of-scope|excluded for this slice/.test(text);
    for (const oos of TINYURL_OUT_OF_SCOPE_KEYWORDS) {
      if (!text.includes(oos.kw.toLowerCase())) continue;
      if (hasExclusionMarker) {
        // Likely a quote-back of the intent. Surface as INFO so
        // operators can spot-check without flooding the WARN bucket.
        findings.push({
          category: 'F',
          severity: 'INFO',
          phase_id: a.phase_id,
          sub_phase_id: a.sub_phase_id,
          record_id: a.record_id,
          ref: oos.kw,
          message: `Out-of-scope keyword "${oos.kw}" mentioned in content that contains an explicit-exclusion marker (likely intent-doc quote)`,
        });
        continue;
      }
      findings.push({
        category: 'F',
        severity: 'WARN',
        phase_id: a.phase_id,
        sub_phase_id: a.sub_phase_id,
        record_id: a.record_id,
        ref: oos.kw,
        message: `Out-of-scope keyword "${oos.kw}" appears in content (intent: ${oos.clause})`,
      });
    }
  }
  return findings;
}

/**
 * G. Intent-anchored counts (a pared-down version of the existing
 * tinyurl-expectations predicates — included here so the deep auditor
 * is self-contained).
 */
function categoryG_counts(artifacts: DbArtifact[]): Finding[] {
  const findings: Finding[] = [];
  const arrLen = (v: unknown): number => (Array.isArray(v) ? v.length : 0);
  // Phase 4 component_model bound
  for (const a of artifacts) {
    if (a.kind === 'component_model') {
      const n = arrLen(a.content.components);
      if (n > 8) {
        findings.push({
          category: 'G', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
          message: `Phase 4 component_model has ${n} components — expected ≤8 for tinyurl (ts-18 was 11)`,
        });
      }
    }
    if (a.kind === 'business_domains_bloom') {
      const n = arrLen(a.content.domains);
      if (n > 5) {
        findings.push({
          category: 'G', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
          message: `business_domains_bloom has ${n} domains — expected ≤5 (intent is one small product)`,
        });
      }
    }
    if (a.kind === 'functional_requirements') {
      const n = arrLen(a.content.user_stories);
      if (n > 16) {
        findings.push({
          category: 'G', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
          message: `functional_requirements has ${n} user_stories — expected ~3 (intent has 3 FRs)`,
        });
      }
    }

    // Note: semantic content checks (does the output match what the
    // intent doc actually declared?) are deliberately NOT done here.
    // They're the audit-agent's job, not the deep auditor's. Hard-
    // coding intent-specific assertions (e.g., "must mention Postgres")
    // would only work for the corpus we authored them against; what
    // we want is intent-doc-aware semantic validation that runs at
    // every sub-phase. That belongs in the audit-agent pass, where
    // the agent reads the rendered prompt + parsed output + intent
    // doc and reasons about consistency.
  }
  return findings;
}

/**
 * H. Phase 8.5 packet integrity.
 * Per implementation_packet record: coherence.passed, user_stories /
 * nfrs non-empty. Mirrors the ts-18 forensic findings.
 */
function categoryH_packets(artifacts: DbArtifact[]): Finding[] {
  const findings: Finding[] = [];
  for (const a of artifacts) {
    if (a.record_type !== 'implementation_packet') continue;
    const c = a.content as Record<string, unknown>;
    const coherence = (c.coherence ?? {}) as { passed?: boolean; blocking_failures?: string[] };
    if (!coherence.passed) {
      findings.push({
        category: 'H', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
        ref: `packet:${c.packet_id ?? '?'}`,
        message: `Packet failed coherence: ${(coherence.blocking_failures ?? []).slice(0, 3).join('; ')}`,
        details: { blocking_failures: coherence.blocking_failures },
      });
    }
    if (Array.isArray(c.user_stories) && c.user_stories.length === 0) {
      findings.push({
        category: 'H', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
        ref: `packet:${c.packet_id ?? '?'}`,
        message: `Packet has user_stories=[] (no acceptance criteria reach executor)`,
      });
    }
    if (Array.isArray(c.nfrs) && c.nfrs.length === 0) {
      findings.push({
        category: 'H', severity: 'WARN', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
        ref: `packet:${c.packet_id ?? '?'}`,
        message: `Packet has nfrs=[] (no quality bars reach executor)`,
      });
    }
  }
  return findings;
}

/**
 * I. Phase 9 executor lifecycle.
 * Per agent_invocation in Phase 9: was there a matching agent_output
 * OR did executor.invocation_status_change reach a terminal state?
 */
function categoryI_executors(artifacts: DbArtifact[], lifecycle: LifecycleEvent[]): Finding[] {
  const findings: Finding[] = [];
  // Build a set of invocation_ids that reached terminal status.
  const terminal = new Set<string>();
  for (const ev of lifecycle) {
    if (ev.event !== 'executor.invocation_status_change') continue;
    if (ev.to === 'completed' || ev.to === 'failed') {
      const id = ev.invocation_record_id as string | undefined;
      if (id) terminal.add(id);
    }
  }
  // Build a map of invocation_id → agent_output presence.
  const hasOutput = new Set<string>();
  for (const a of artifacts) {
    if (a.record_type !== 'agent_output') continue;
    const c = a.content as Record<string, unknown>;
    const inv = c.invocation_record_id as string | undefined;
    if (inv) hasOutput.add(inv);
  }
  // Surface stuck Phase 9 invocations.
  for (const a of artifacts) {
    if (a.record_type !== 'agent_invocation') continue;
    if (a.phase_id !== '9') continue;
    const c = a.content as Record<string, unknown>;
    // Only flag executor-style invocations (CLI agents), not direct LLM.
    const backing = (c.backing_tool as string) ?? (c.provider as string) ?? '';
    if (!/cli/.test(backing) && backing !== 'goose_cli' && backing !== 'claude_code_cli') continue;
    const hasOut = hasOutput.has(a.record_id);
    const reachedTerminal = terminal.has(a.record_id);
    if (!hasOut && !reachedTerminal) {
      findings.push({
        category: 'I', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
        ref: `task:${c.task_id ?? '?'}`,
        message: `Phase 9 executor invocation has neither agent_output nor terminal status_change (stuck or output-write failed)`,
      });
    } else if (!hasOut) {
      findings.push({
        category: 'I', severity: 'WARN', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
        ref: `task:${c.task_id ?? '?'}`,
        message: `Phase 9 executor invocation has no agent_output (reached terminal status_change, but DB record-write may have failed)`,
      });
    }
  }
  return findings;
}

/**
 * J. Persistence integrity.
 * For each artifact_produced record, find the most-recent `normalized`
 * (or `json_parsed`) trace step in the same sub-phase. Compare:
 *   - top-level keys parity (key-presence)
 *   - top-level array sizes
 *   - missing/surplus keys
 */
function categoryJ_persistence(artifacts: DbArtifact[], steps: TransformStep[]): Finding[] {
  const findings: Finding[] = [];
  // Build an output_record_id → step index. Steps that explicitly
  // declare which DB record they produced are the trustworthy matches.
  const stepByOutputRecordId = new Map<string, TransformStep>();
  for (const s of steps) {
    if (s.output_record_id) {
      stepByOutputRecordId.set(s.output_record_id, s);
    }
  }
  // Group steps by sub_phase_id as a fallback for artifacts whose
  // producer step didn't declare output_record_id. Used only when the
  // primary match (output_record_id) fails AND the artifact's content
  // shape (kind) matches the most-recent json_parsed top-level keys.
  const stepsBySubPhase = new Map<string, TransformStep[]>();
  for (const s of steps) {
    const list = stepsBySubPhase.get(s.sub_phase_id);
    if (list) list.push(s); else stepsBySubPhase.set(s.sub_phase_id, [s]);
  }
  for (const list of stepsBySubPhase.values()) {
    list.sort((a, b) => a.ts.localeCompare(b.ts));
  }

  for (const a of artifacts) {
    if (a.record_type !== 'artifact_produced') continue;
    if (!a.sub_phase_id) continue;

    // Primary match: step's output_record_id == artifact.record_id.
    let candidate: TransformStep | null = stepByOutputRecordId.get(a.record_id) ?? null;

    // Fallback: most recent normalized/json_parsed step BEFORE the
    // artifact in the SAME sub-phase, AND whose parsed top-level keys
    // intersect with the artifact's top-level keys (excluding `kind` +
    // `schemaVersion`). The intersection guards against picking up a
    // reasoning_review validator's parse step whose keys (validator,
    // passed, findings, overallAssessment) don't match the artifact's.
    if (!candidate) {
      const list = stepsBySubPhase.get(a.sub_phase_id);
      if (list) {
        const artifactKeys = new Set(
          Object.keys(a.content).filter((k) => !['kind', 'schemaVersion'].includes(k)),
        );
        for (const s of list) {
          if (s.ts > a.produced_at) break;
          if (s.step_type !== 'normalized' && s.step_type !== 'json_parsed') continue;
          const meta = s.metadata ?? {};
          const stepKeys = (meta.parsed_top_level_keys as string[] | undefined) ??
            (s.step_type === 'normalized'
              ? Object.keys(((s.payload ?? {}) as { output?: Record<string, unknown> }).output ?? {})
              : []);
          // Intersection test
          const overlaps = stepKeys.some((k) => artifactKeys.has(k));
          if (overlaps) candidate = s;
        }
      }
    }
    if (!candidate) continue;

    // Get the trace-step's output object.
    let traceOutput: Record<string, unknown> | null = null;
    if (candidate.step_type === 'normalized') {
      const payload = (candidate.payload ?? {}) as { output?: unknown };
      traceOutput = (payload.output ?? null) as Record<string, unknown> | null;
    } else {
      const payload = (candidate.payload ?? {}) as { parsed?: unknown };
      traceOutput = (payload.parsed ?? null) as Record<string, unknown> | null;
    }
    if (!traceOutput || typeof traceOutput !== 'object') continue;

    const dbKeys = new Set(Object.keys(a.content));
    const traceKeys = new Set(Object.keys(traceOutput));
    const dropped = [...traceKeys].filter((k) => !dbKeys.has(k) && !['kind', 'schemaVersion'].includes(k));
    const surplus = [...dbKeys].filter((k) => !traceKeys.has(k) && !['kind', 'schemaVersion'].includes(k));

    // Detect rename pairs (snake↔camel + kebab variants). A "dropped"
    // trace key whose case-variant appears in dbKeys is a rename, not
    // a real drop — the normalizer is doing its job. We check against
    // dbKeys (not just surplus), because some normalizers dual-emit
    // BOTH cases on the trace-step output side, in which case the
    // variant is in both sets (not surplus-only).
    const renamed: Array<{ from: string; to: string }> = [];
    const renamedFrom = new Set<string>();
    const renamedTo = new Set<string>();
    for (const d of dropped) {
      const variants = caseVariants(d);
      for (const v of variants) {
        if (v === d) continue;
        if (dbKeys.has(v) && !renamedTo.has(v)) {
          renamed.push({ from: d, to: v });
          renamedFrom.add(d);
          renamedTo.add(v);
          break;
        }
      }
    }
    const trueDropped = dropped.filter((k) => !renamedFrom.has(k));

    if (trueDropped.length > 0) {
      findings.push({
        category: 'J', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
        ref: `step:${candidate.step_id.slice(0, 8)}`,
        message: `Keys in trace-step output dropped at persist boundary: ${trueDropped.join(',')}`,
      });
    }
    if (renamed.length > 0) {
      findings.push({
        category: 'J', severity: 'INFO', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
        ref: `step:${candidate.step_id.slice(0, 8)}`,
        message: `Normalizer renamed ${renamed.length} key(s): ${renamed.map((r) => `${r.from}→${r.to}`).join(',')}`,
      });
    }
    // Array-size parity for shared keys.
    for (const k of traceKeys) {
      if (!dbKeys.has(k)) continue;
      const tv = (traceOutput as Record<string, unknown>)[k];
      const dv = (a.content as Record<string, unknown>)[k];
      if (Array.isArray(tv) && Array.isArray(dv) && tv.length !== dv.length) {
        findings.push({
          category: 'J',
          severity: tv.length > dv.length ? 'BLOCK' : 'WARN',
          phase_id: a.phase_id,
          sub_phase_id: a.sub_phase_id,
          record_id: a.record_id,
          ref: `step:${candidate.step_id.slice(0, 8)} field:${k}`,
          message: `Array size mismatch on persist: trace[${k}]=${tv.length}, db[${k}]=${dv.length}`,
        });
      }
    }
    if (surplus.length > 0) {
      findings.push({
        category: 'J', severity: 'INFO', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
        ref: `step:${candidate.step_id.slice(0, 8)}`,
        message: `Keys in DB content not present in trace-step output: ${surplus.join(',')}`,
      });
    }
  }
  return findings;
}

// ── Main ───────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv);
  const dbPath = resolveDbPath(args.workspace, args.db);
  process.stderr.write(`[deep-audit] DB: ${dbPath}\n`);
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const runId = resolveRunId(db, args.runId);
    process.stderr.write(`[deep-audit] runId: ${runId}\n`);
    const artifacts = loadArtifacts(db, runId);
    process.stderr.write(`[deep-audit] artifacts: ${artifacts.length}\n`);
    const steps = loadTransforms(args.workspace, runId);
    process.stderr.write(`[deep-audit] transforms.jsonl steps: ${steps.length}\n`);
    const lifecycle = loadLifecycle(args.workspace, runId);
    process.stderr.write(`[deep-audit] lifecycle.ndjson events: ${lifecycle.length}\n`);

    const findings: Finding[] = [];
    if (args.categories.has('A')) findings.push(...categoryA_contracts(artifacts, runId));
    if (args.categories.has('B')) findings.push(...categoryB_emptyVars(steps));
    if (args.categories.has('C')) findings.push(...categoryC_repair(steps));
    if (args.categories.has('D')) findings.push(...categoryD_normalize(steps));
    if (args.categories.has('E')) findings.push(...categoryE_xref(artifacts));
    if (args.categories.has('F')) findings.push(...categoryF_oos(artifacts));
    if (args.categories.has('G')) findings.push(...categoryG_counts(artifacts));
    if (args.categories.has('H')) findings.push(...categoryH_packets(artifacts));
    if (args.categories.has('I')) findings.push(...categoryI_executors(artifacts, lifecycle));
    if (args.categories.has('J')) findings.push(...categoryJ_persistence(artifacts, steps));

    // Summarize.
    const byCat: Record<string, number> = {};
    const bySev: Record<string, number> = { BLOCK: 0, WARN: 0, INFO: 0 };
    for (const f of findings) {
      byCat[f.category] = (byCat[f.category] ?? 0) + 1;
      bySev[f.severity] = (bySev[f.severity] ?? 0) + 1;
    }

    const report = {
      runId,
      generated_at: new Date().toISOString(),
      summary: {
        total_artifacts: artifacts.length,
        total_steps: steps.length,
        total_lifecycle_events: lifecycle.length,
        finding_count: findings.length,
        by_category: byCat,
        by_severity: bySev,
      },
      findings,
    };
    const outPath = args.out ?? path.join(args.workspace, '.janumicode', 'deep-audit-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

    // Human-readable summary to stdout.
    process.stdout.write(`\n=== Deep Audit Summary ===\n`);
    process.stdout.write(`run:        ${runId}\n`);
    process.stdout.write(`artifacts:  ${artifacts.length}\n`);
    process.stdout.write(`steps:      ${steps.length}\n`);
    process.stdout.write(`lifecycle:  ${lifecycle.length} events\n`);
    process.stdout.write(`findings:   ${findings.length} total ` +
      `(${bySev.BLOCK} BLOCK, ${bySev.WARN} WARN, ${bySev.INFO} INFO)\n`);
    for (const c of 'ABCDEFGHIJ') {
      if (byCat[c]) process.stdout.write(`  category ${c}: ${byCat[c]}\n`);
    }
    process.stdout.write(`\nreport: ${outPath}\n`);
  } finally {
    db.close();
  }
}

main();

// ── Case-variant helper (used by category J to recognize renames) ──

/**
 * Return common case-variant spellings of a key so J's rename-detection
 * can identify normalizer renames (snake_case ↔ camelCase ↔ kebab-case)
 * instead of flagging them as dropped/added.
 */
function caseVariants(key: string): string[] {
  const set = new Set<string>([key]);
  // snake → camel
  set.add(key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()));
  // snake → PascalCase
  set.add(
    key.charAt(0).toUpperCase() + key.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
  );
  // camel → snake
  set.add(key.replace(/([A-Z])/g, (_, c: string) => `_${c.toLowerCase()}`).replace(/^_/, ''));
  // kebab → snake
  set.add(key.replaceAll('-', '_'));
  // snake → kebab
  set.add(key.replaceAll('_', '-'));
  return [...set];
}
