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

export interface Finding {
  category: string;
  severity: Severity;
  phase_id?: string | null;
  sub_phase_id?: string | null;
  record_id?: string;
  ref?: string;
  message: string;
  details?: unknown;
}

export interface DbArtifact {
  record_id: string;
  record_type: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  produced_at: string;
  content: Record<string, unknown>;
  kind: string | undefined;
}

export interface TransformStep {
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

export interface LifecycleEvent {
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
 * Map a single suite's ContractResults for one artifact into findings.
 * Extracted from categoryA_contracts to keep its cognitive complexity
 * within budget; behavior (order + shape) is identical.
 */
function contractResultsToFindings(results: ContractResult[], artifact: DbArtifact): Finding[] {
  const out: Finding[] = [];
  for (const r of results) {
    if (r.passed) continue;
    out.push({
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
  return out;
}

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
    findings.push(...contractResultsToFindings(results, artifact));
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
      const ref = `template:${JSON.stringify(payload.template_key ?? '?')} var:${name}`;
      if (isRequired) {
        findings.push({
          category: 'B',
          severity: 'BLOCK',
          sub_phase_id: s.sub_phase_id,
          ref,
          message: `Required variable {{${name}}} substituted with empty value`,
        });
      } else {
        findings.push({
          category: 'B',
          severity: 'WARN',
          sub_phase_id: s.sub_phase_id,
          ref,
          message: `Optional variable {{${name}}} substituted with empty value`,
        });
      }
    }
    const missing = (payload.missing_variables ?? []) as string[];
    for (const m of missing) {
      findings.push({
        category: 'B',
        severity: 'BLOCK',
        sub_phase_id: s.sub_phase_id,
        ref: `template:${JSON.stringify(payload.template_key ?? '?')} var:${m}`,
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
      ref: `invocation:${JSON.stringify(meta.invocation_id ?? '?')}`,
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
    const shrunkCells = shrunk.map((c) => `${c.field}[${c.from}→${c.to}]`);
    findings.push({
      category: 'D',
      severity: 'WARN',
      sub_phase_id: s.sub_phase_id,
      ref: `normalizer:${(s.metadata?.normalizer as string) ?? '?'}`,
      message:
        (removed.length ? `removed fields: ${removed.join(',')}` : '') +
        (removed.length && shrunk.length ? '; ' : '') +
        (shrunk.length ? `shrunk arrays: ${shrunkCells.join(',')}` : ''),
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
  const collectStringRef = (node: string, nodePath: string[], artifact: DbArtifact): void => {
    // Skip the SELF id field on this record — that's a definition,
    // not a reference. Other id-shaped strings in any field ARE
    // references and need to resolve.
    if (nodePath.at(-1) === 'id') return;
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
  };
  const collectRefs = (node: unknown, path: string[], artifact: DbArtifact): void => {
    if (typeof node === 'string') {
      collectStringRef(node, path, artifact);
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
 * Intent-anchored count bounds for category G. Each entry names the
 * artifact `kind` to inspect, the array field to size, the inclusive
 * upper bound, and a message builder (invoked only when exceeded).
 */
const CATEGORY_G_BOUNDS: Array<{
  kind: string;
  field: string;
  max: number;
  message: (n: number) => string;
}> = [
  {
    kind: 'component_model',
    field: 'components',
    max: 8,
    message: (n) => `Phase 4 component_model has ${n} components — expected ≤8 for tinyurl (ts-18 was 11)`,
  },
  {
    kind: 'business_domains_bloom',
    field: 'domains',
    max: 5,
    message: (n) => `business_domains_bloom has ${n} domains — expected ≤5 (intent is one small product)`,
  },
  {
    kind: 'functional_requirements',
    field: 'user_stories',
    max: 16,
    message: (n) => `functional_requirements has ${n} user_stories — expected ~3 (intent has 3 FRs)`,
  },
];

/**
 * G. Intent-anchored counts (a pared-down version of the existing
 * tinyurl-expectations predicates — included here so the deep auditor
 * is self-contained).
 */
function categoryG_counts(artifacts: DbArtifact[]): Finding[] {
  const findings: Finding[] = [];
  const arrLen = (v: unknown): number => (Array.isArray(v) ? v.length : 0);
  for (const a of artifacts) {
    for (const bound of CATEGORY_G_BOUNDS) {
      if (a.kind !== bound.kind) continue;
      const n = arrLen(a.content[bound.field]);
      if (n > bound.max) {
        findings.push({
          category: 'G', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
          message: bound.message(n),
        });
      }
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
  return findings;
}

/**
 * Stable `ref` string for a packet finding. Mirrors the original inline
 * `packet:${JSON.stringify(c.packet_id ?? '?')}` expression verbatim.
 */
function packetRef(c: Record<string, unknown>): string {
  return `packet:${JSON.stringify(c.packet_id ?? '?')}`;
}

/**
 * BLOCK finding when a packet failed coherence, else null. Extracted from
 * categoryH_packets to keep its cognitive complexity within budget; the
 * predicate, severity, ref, message, and details are byte-identical.
 */
function packetCoherenceFinding(a: DbArtifact, c: Record<string, unknown>): Finding | null {
  const coherence = (c.coherence ?? {}) as { passed?: boolean; blocking_failures?: string[] };
  if (coherence.passed) return null;
  const blockingFailures = coherence.blocking_failures ?? [];
  return {
    category: 'H', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
    ref: packetRef(c),
    message: `Packet failed coherence: ${blockingFailures.slice(0, 3).join('; ')}`,
    details: { blocking_failures: coherence.blocking_failures },
  };
}

/** BLOCK finding when a packet's user_stories is an empty array, else null. */
function packetEmptyUserStoriesFinding(a: DbArtifact, c: Record<string, unknown>): Finding | null {
  if (!Array.isArray(c.user_stories) || c.user_stories.length !== 0) return null;
  return {
    category: 'H', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
    ref: packetRef(c),
    message: `Packet has user_stories=[] (no acceptance criteria reach executor)`,
  };
}

/** WARN finding when a packet's nfrs is an empty array, else null. */
function packetEmptyNfrsFinding(a: DbArtifact, c: Record<string, unknown>): Finding | null {
  if (!Array.isArray(c.nfrs) || c.nfrs.length !== 0) return null;
  return {
    category: 'H', severity: 'WARN', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
    ref: packetRef(c),
    message: `Packet has nfrs=[] (no quality bars reach executor)`,
  };
}

/**
 * H. Phase 8.5 packet integrity.
 * Per implementation_packet record: coherence.passed, user_stories /
 * nfrs non-empty. Mirrors the ts-18 forensic findings.
 */
export function categoryH_packets(artifacts: DbArtifact[]): Finding[] {
  const findings: Finding[] = [];
  for (const a of artifacts) {
    if (a.record_type !== 'implementation_packet') continue;
    const c = a.content as Record<string, unknown>;
    const coherence = packetCoherenceFinding(a, c);
    if (coherence) findings.push(coherence);
    const emptyUserStories = packetEmptyUserStoriesFinding(a, c);
    if (emptyUserStories) findings.push(emptyUserStories);
    const emptyNfrs = packetEmptyNfrsFinding(a, c);
    if (emptyNfrs) findings.push(emptyNfrs);
  }
  return findings;
}

/**
 * Set of invocation record ids that reached a terminal executor status
 * (`completed` / `failed`). Extracted from categoryI_executors to keep its
 * cognitive complexity within budget; the event filter and id predicate are
 * identical to the original inline loop.
 */
function collectTerminalInvocationIds(lifecycle: LifecycleEvent[]): Set<string> {
  const terminal = new Set<string>();
  for (const ev of lifecycle) {
    if (ev.event !== 'executor.invocation_status_change') continue;
    if (ev.to !== 'completed' && ev.to !== 'failed') continue;
    const id = ev.invocation_record_id as string | undefined;
    if (id) terminal.add(id);
  }
  return terminal;
}

/**
 * Set of invocation record ids that produced an `agent_output` artifact.
 * Extracted from categoryI_executors; the record_type filter and id
 * predicate match the original inline loop.
 */
function collectAgentOutputInvocationIds(artifacts: DbArtifact[]): Set<string> {
  const hasOutput = new Set<string>();
  for (const a of artifacts) {
    if (a.record_type !== 'agent_output') continue;
    const c = a.content as Record<string, unknown>;
    const inv = c.invocation_record_id as string | undefined;
    if (inv) hasOutput.add(inv);
  }
  return hasOutput;
}

/**
 * BLOCK/WARN finding for a single Phase 9 executor invocation, or null when
 * the artifact isn't an executor-style agent_invocation in Phase 9 or when it
 * completed cleanly (has agent_output). Extracted from categoryI_executors so
 * the loop body's branching no longer inflates the caller's complexity; the
 * predicate, severity, ref, and message are byte-identical to the original.
 */
function executorLifecycleFinding(
  a: DbArtifact,
  hasOutput: Set<string>,
  terminal: Set<string>,
): Finding | null {
  if (a.record_type !== 'agent_invocation') return null;
  if (a.phase_id !== '9') return null;
  const c = a.content as Record<string, unknown>;
  // Only flag executor-style invocations (CLI agents), not direct LLM.
  const backing = (c.backing_tool as string) ?? (c.provider as string) ?? '';
  if (!/cli/.test(backing) && backing !== 'goose_cli' && backing !== 'claude_code_cli') return null;
  const hasOut = hasOutput.has(a.record_id);
  const reachedTerminal = terminal.has(a.record_id);
  if (!hasOut && !reachedTerminal) {
    return {
      category: 'I', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
      ref: `task:${JSON.stringify(c.task_id ?? '?')}`,
      message: `Phase 9 executor invocation has neither agent_output nor terminal status_change (stuck or output-write failed)`,
    };
  }
  if (!hasOut) {
    return {
      category: 'I', severity: 'WARN', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
      ref: `task:${JSON.stringify(c.task_id ?? '?')}`,
      message: `Phase 9 executor invocation has no agent_output (reached terminal status_change, but DB record-write may have failed)`,
    };
  }
  return null;
}

/**
 * I. Phase 9 executor lifecycle.
 * Per agent_invocation in Phase 9: was there a matching agent_output
 * OR did executor.invocation_status_change reach a terminal state?
 */
export function categoryI_executors(artifacts: DbArtifact[], lifecycle: LifecycleEvent[]): Finding[] {
  const findings: Finding[] = [];
  const terminal = collectTerminalInvocationIds(lifecycle);
  const hasOutput = collectAgentOutputInvocationIds(artifacts);
  // Surface stuck Phase 9 invocations.
  for (const a of artifacts) {
    const finding = executorLifecycleFinding(a, hasOutput, terminal);
    if (finding) findings.push(finding);
  }
  return findings;
}

// ── Category J helpers (persistence-integrity decomposition) ───────

/**
 * Top-level keys that are structural metadata, not payload content, and are
 * therefore excluded from category J's dropped/surplus key comparisons.
 */
const PERSISTENCE_IGNORED_KEYS = new Set(['kind', 'schemaVersion']);

/**
 * Index steps that explicitly declare which DB record they produced. Steps
 * with an `output_record_id` are the trustworthy persist matches (last write
 * wins on duplicate ids, matching the original inline loop).
 */
function buildStepByOutputRecordId(steps: TransformStep[]): Map<string, TransformStep> {
  const map = new Map<string, TransformStep>();
  for (const s of steps) {
    if (s.output_record_id) map.set(s.output_record_id, s);
  }
  return map;
}

/**
 * Group steps by sub_phase_id (each list sorted ascending by ts) as a fallback
 * for artifacts whose producer step didn't declare output_record_id.
 */
function buildStepsBySubPhase(steps: TransformStep[]): Map<string, TransformStep[]> {
  const map = new Map<string, TransformStep[]>();
  for (const s of steps) {
    const list = map.get(s.sub_phase_id);
    if (list) list.push(s); else map.set(s.sub_phase_id, [s]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.ts.localeCompare(b.ts));
  }
  return map;
}

/**
 * Top-level keys a normalized/json_parsed step claims to have produced. Prefers
 * the explicit metadata list; falls back to the keys of a normalized step's
 * payload.output; a json_parsed step without metadata contributes none.
 */
function stepTopLevelKeys(s: TransformStep): string[] {
  const meta = s.metadata ?? {};
  const declared = meta.parsed_top_level_keys as string[] | undefined;
  if (declared) return declared;
  if (s.step_type === 'normalized') {
    const payload = (s.payload ?? {}) as { output?: Record<string, unknown> };
    return Object.keys(payload.output ?? {});
  }
  return [];
}

/**
 * Fallback producer-step match for an artifact whose producer step didn't
 * declare output_record_id: the LAST normalized/json_parsed step in the same
 * sub-phase at or before the artifact's produced_at whose parsed top-level keys
 * intersect the artifact's top-level keys (excluding kind + schemaVersion). The
 * intersection guards against picking up a reasoning_review validator's parse
 * step whose keys don't match the artifact's.
 */
function findFallbackCandidate(
  a: DbArtifact,
  stepsBySubPhase: Map<string, TransformStep[]>,
): TransformStep | null {
  const list = stepsBySubPhase.get(a.sub_phase_id ?? '');
  if (!list) return null;
  const artifactKeys = new Set(
    Object.keys(a.content).filter((k) => !PERSISTENCE_IGNORED_KEYS.has(k)),
  );
  let candidate: TransformStep | null = null;
  for (const s of list) {
    if (s.ts > a.produced_at) break;
    if (s.step_type !== 'normalized' && s.step_type !== 'json_parsed') continue;
    const overlaps = stepTopLevelKeys(s).some((k) => artifactKeys.has(k));
    if (overlaps) candidate = s;
  }
  return candidate;
}

/**
 * Producer step for an artifact: primary match on output_record_id, else the
 * sub-phase/key-intersection fallback.
 */
function findPersistenceCandidate(
  a: DbArtifact,
  stepByOutputRecordId: Map<string, TransformStep>,
  stepsBySubPhase: Map<string, TransformStep[]>,
): TransformStep | null {
  const primary = stepByOutputRecordId.get(a.record_id);
  if (primary) return primary;
  return findFallbackCandidate(a, stepsBySubPhase);
}

/**
 * The producer step's output object: payload.output for a normalized step,
 * payload.parsed otherwise (null when absent).
 */
function extractTraceOutput(candidate: TransformStep): Record<string, unknown> | null {
  if (candidate.step_type === 'normalized') {
    const payload = (candidate.payload ?? {}) as { output?: unknown };
    return (payload.output ?? null) as Record<string, unknown> | null;
  }
  const payload = (candidate.payload ?? {}) as { parsed?: unknown };
  return (payload.parsed ?? null) as Record<string, unknown> | null;
}

/**
 * Detect snake↔camel↔kebab rename pairs among `dropped` keys: a dropped trace
 * key whose case-variant appears in dbKeys is a rename, not a real drop. Each
 * dbKey target is claimed at most once. Returns the pairs plus the set of
 * dropped keys that were renamed (so they can be excluded from true drops).
 */
function detectRenames(
  dropped: string[],
  dbKeys: Set<string>,
): { renamed: Array<{ from: string; to: string }>; renamedFrom: Set<string> } {
  const renamed: Array<{ from: string; to: string }> = [];
  const renamedFrom = new Set<string>();
  const renamedTo = new Set<string>();
  for (const d of dropped) {
    for (const v of caseVariants(d)) {
      if (v === d) continue;
      if (dbKeys.has(v) && !renamedTo.has(v)) {
        renamed.push({ from: d, to: v });
        renamedFrom.add(d);
        renamedTo.add(v);
        break;
      }
    }
  }
  return { renamed, renamedFrom };
}

/** BLOCK finding when trace-step keys were dropped at the persist boundary. */
function droppedKeysFinding(a: DbArtifact, candidate: TransformStep, trueDropped: string[]): Finding | null {
  if (trueDropped.length === 0) return null;
  return {
    category: 'J', severity: 'BLOCK', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
    ref: `step:${candidate.step_id.slice(0, 8)}`,
    message: `Keys in trace-step output dropped at persist boundary: ${trueDropped.join(',')}`,
  };
}

/** INFO finding recording normalizer key renames (case-variant remaps). */
function renamedKeysFinding(
  a: DbArtifact,
  candidate: TransformStep,
  renamed: Array<{ from: string; to: string }>,
): Finding | null {
  if (renamed.length === 0) return null;
  const renamedPairs = renamed.map((r) => `${r.from}→${r.to}`);
  return {
    category: 'J', severity: 'INFO', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
    ref: `step:${candidate.step_id.slice(0, 8)}`,
    message: `Normalizer renamed ${renamed.length} key(s): ${renamedPairs.join(',')}`,
  };
}

/** INFO finding when the DB content has top-level keys absent from the trace. */
function surplusKeysFinding(a: DbArtifact, candidate: TransformStep, surplus: string[]): Finding | null {
  if (surplus.length === 0) return null;
  return {
    category: 'J', severity: 'INFO', phase_id: a.phase_id, sub_phase_id: a.sub_phase_id, record_id: a.record_id,
    ref: `step:${candidate.step_id.slice(0, 8)}`,
    message: `Keys in DB content not present in trace-step output: ${surplus.join(',')}`,
  };
}

/**
 * BLOCK/WARN findings for shared top-level array keys whose length differs
 * between the trace-step output and the persisted DB content (BLOCK when the
 * trace had MORE elements — a persist-side loss — WARN otherwise). Emitted in
 * traceKeys iteration order.
 */
function arraySizeFindings(
  a: DbArtifact,
  candidate: TransformStep,
  traceOutput: Record<string, unknown>,
  traceKeys: Set<string>,
  dbKeys: Set<string>,
): Finding[] {
  const findings: Finding[] = [];
  for (const k of traceKeys) {
    if (!dbKeys.has(k)) continue;
    const tv = traceOutput[k];
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
  return findings;
}

/**
 * All category-J findings for one artifact given its matched producer step's
 * output. Emission order matches the original inline implementation: dropped
 * keys, renames, array-size mismatches (in traceKeys order), then surplus.
 */
function persistenceFindingsForArtifact(
  a: DbArtifact,
  candidate: TransformStep,
  traceOutput: Record<string, unknown>,
): Finding[] {
  const findings: Finding[] = [];
  const dbKeys = new Set(Object.keys(a.content));
  const traceKeys = new Set(Object.keys(traceOutput));
  const dropped = [...traceKeys].filter((k) => !dbKeys.has(k) && !PERSISTENCE_IGNORED_KEYS.has(k));
  const surplus = [...dbKeys].filter((k) => !traceKeys.has(k) && !PERSISTENCE_IGNORED_KEYS.has(k));
  const { renamed, renamedFrom } = detectRenames(dropped, dbKeys);
  const trueDropped = dropped.filter((k) => !renamedFrom.has(k));

  const droppedFinding = droppedKeysFinding(a, candidate, trueDropped);
  if (droppedFinding) findings.push(droppedFinding);
  const renamedFinding = renamedKeysFinding(a, candidate, renamed);
  if (renamedFinding) findings.push(renamedFinding);
  findings.push(...arraySizeFindings(a, candidate, traceOutput, traceKeys, dbKeys));
  const surplusFinding = surplusKeysFinding(a, candidate, surplus);
  if (surplusFinding) findings.push(surplusFinding);
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
export function categoryJ_persistence(artifacts: DbArtifact[], steps: TransformStep[]): Finding[] {
  const findings: Finding[] = [];
  const stepByOutputRecordId = buildStepByOutputRecordId(steps);
  const stepsBySubPhase = buildStepsBySubPhase(steps);

  for (const a of artifacts) {
    if (a.record_type !== 'artifact_produced') continue;
    if (!a.sub_phase_id) continue;
    const candidate = findPersistenceCandidate(a, stepByOutputRecordId, stepsBySubPhase);
    if (!candidate) continue;

    const traceOutput = extractTraceOutput(candidate);
    if (!traceOutput || typeof traceOutput !== 'object') continue;
    findings.push(...persistenceFindingsForArtifact(a, candidate, traceOutput));
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

// Run as a CLI only when executed directly, not when imported (e.g. by
// unit tests). The `typeof` guard keeps this safe under ESM test runners
// where the CommonJS `require`/`module` globals may be absent.
if (typeof require !== 'undefined' && require.main === module) {
  main();
}

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
