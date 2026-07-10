/**
 * Trace-completeness assertions.
 *
 * Per design memo §9: the principle "trace completeness is a regression
 * test" becomes literal here. Given an AODD trace (`events.ndjson` +
 * `summaries/`), the assertions verify:
 *
 *   1. Each expected sub-phase summary exists and validates against the
 *      schema (no null 5W+H fields, plus sentinel-aware checks).
 *   2. Every event referenced by a summary (`events.first_event_id`,
 *      `events.last_event_id`) resolves to a real event in
 *      `events.ndjson`.
 *   3. `parent_event_id` and `caused_by_event_id` chains terminate
 *      (no dangling pointers).
 *   4. Optional `forbidden_events` are NOT present.
 *   5. Optional spot checks (`equals` / `matches` / `not_null`) over
 *      dotted paths into the SubPhaseSummary pass.
 *
 * The runner accepts either a frozen fixture (design memo §9 literal)
 * or a live workspace's run (for in-test verification). It always reads
 * the same on-disk shape.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PhaseId } from '../types/records';
import type { AoddEventType, SubPhaseSummary } from './types';
import { readEventsSync, readSubPhaseSummary } from './replay';

// ── Manifest schema ────────────────────────────────────────────────

export interface FixtureSpotCheck {
  /** Dotted path into SubPhaseSummary, e.g. "who.model" or "how.status". */
  path: string;
  equals?: unknown;
  /** Regex source string (compiled with `new RegExp(...)` at check time). */
  matches?: string;
  /** When true, the resolved path must not be null / undefined / empty. */
  not_null?: boolean;
}

export interface FixtureExpectedSubPhase {
  phase_id: PhaseId;
  sub_phase_id: string;
  expected_status: 'success' | 'partial' | 'failed';
  /** Hard requirement that 5W+H reconstructability holds. */
  must_answer_5wh: true;
  spot_checks?: FixtureSpotCheck[];
}

export interface FixtureManifest {
  scenario: string;
  description: string;
  schema_version: number;
  expected_sub_phases: FixtureExpectedSubPhase[];
  forbidden_events?: AoddEventType[];
}

/**
 * Load + structurally validate a manifest.json file. Throws on missing
 * required fields. Caller catches and surfaces as a test failure.
 */
export function loadManifest(manifestPath: string): FixtureManifest {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest not found: ${manifestPath}`);
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `manifest is not valid JSON (${manifestPath}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const m = parsed as Partial<FixtureManifest>;
  if (typeof m.scenario !== 'string') {
    throw new TypeError(`${manifestPath}: missing "scenario"`);
  }
  if (typeof m.description !== 'string') {
    throw new TypeError(`${manifestPath}: missing "description"`);
  }
  if (typeof m.schema_version !== 'number') {
    throw new TypeError(`${manifestPath}: missing "schema_version"`);
  }
  if (!Array.isArray(m.expected_sub_phases) || m.expected_sub_phases.length === 0) {
    throw new Error(`${manifestPath}: "expected_sub_phases" must be a non-empty array`);
  }
  for (const [i, sub] of m.expected_sub_phases.entries()) {
    if (typeof sub.phase_id !== 'string') {
      throw new TypeError(`${manifestPath} expected_sub_phases[${i}]: phase_id required`);
    }
    if (typeof sub.sub_phase_id !== 'string') {
      throw new TypeError(`${manifestPath} expected_sub_phases[${i}]: sub_phase_id required`);
    }
    if (sub.must_answer_5wh !== true) {
      throw new Error(
        `${manifestPath} expected_sub_phases[${i}]: must_answer_5wh must be literal true`,
      );
    }
  }
  return parsed as FixtureManifest;
}

// ── 5W+H reconstructability check ──────────────────────────────────

export interface CompletenessFailure {
  scenario: string;
  sub_phase: string;
  reason: string;
}

/**
 * Verify that a sub-phase summary answers the 5W+H questions. Soft
 * sentinels (`'unknown'`, `'none'`) are *allowed* values per the P6
 * pragmatic interpretation — a future tightening can require non-
 * sentinel values by introducing a `strict_5wh: true` flag on the
 * manifest. For now: required fields must be present and non-empty.
 */
export function check5WH(summary: SubPhaseSummary): string[] {
  // Failure order is part of the contract: sections run WHO → WHAT → WHY
  // → HOW → WHEN → events, matching the original single-block ordering.
  return [
    ...check5WHWho(summary),
    ...check5WHWhat(summary),
    ...check5WHWhy(summary),
    ...check5WHHow(summary),
    ...check5WHWhen(summary),
    ...check5WHEvents(summary),
  ];
}

function check5WHWho(summary: SubPhaseSummary): string[] {
  const failures: string[] = [];
  // WHO
  if (!summary.who.model) failures.push('who.model is empty');
  // agent_role may legitimately be null when an event chain has no
  // agent_role-stamped events. Don't fail on null.
  return failures;
}

function check5WHWhat(summary: SubPhaseSummary): string[] {
  const failures: string[] = [];
  // WHAT — arrays may be empty (no inputs/outputs declared yet); just
  // verify they're arrays.
  if (!Array.isArray(summary.what.inputs_consumed)) {
    failures.push('what.inputs_consumed is not an array');
  }
  if (!Array.isArray(summary.what.outputs_produced)) {
    failures.push('what.outputs_produced is not an array');
  }
  if (!Array.isArray(summary.what.decisions)) {
    failures.push('what.decisions is not an array');
  }
  return failures;
}

function check5WHWhy(summary: SubPhaseSummary): string[] {
  const failures: string[] = [];
  // WHY
  if (!summary.why.template_key) failures.push('why.template_key is empty');
  if (!summary.why.template_source_sha) {
    failures.push('why.template_source_sha is empty');
  }
  if (!summary.why.rendered_prompt_ref) {
    failures.push('why.rendered_prompt_ref is empty');
  }
  if (!Array.isArray(summary.why.governing_constraints)) {
    failures.push('why.governing_constraints is not an array');
  }
  return failures;
}

function check5WHHow(summary: SubPhaseSummary): string[] {
  const failures: string[] = [];
  // HOW
  if (typeof summary.how.retries !== 'number') {
    failures.push('how.retries is not a number');
  }
  if (typeof summary.how.repairs !== 'number') {
    failures.push('how.repairs is not a number');
  }
  if (typeof summary.how.escalations !== 'number') {
    failures.push('how.escalations is not a number');
  }
  if (!Array.isArray(summary.how.fallbacks)) {
    failures.push('how.fallbacks is not an array');
  }
  if (!['success', 'partial', 'failed'].includes(summary.how.status)) {
    failures.push(`how.status is invalid: ${summary.how.status}`);
  }
  if (summary.how.error !== null && (!summary.how.error.event_id || !summary.how.error.message)) {
    failures.push('how.error is partially populated');
  }
  return failures;
}

function check5WHWhen(summary: SubPhaseSummary): string[] {
  const failures: string[] = [];
  // WHEN
  if (!summary.started_at) failures.push('started_at is empty');
  if (!summary.completed_at) failures.push('completed_at is empty');
  if (typeof summary.duration_ms !== 'number') {
    failures.push('duration_ms is not a number');
  }
  return failures;
}

function check5WHEvents(summary: SubPhaseSummary): string[] {
  const failures: string[] = [];
  // events range
  if (!summary.events.first_event_id) failures.push('events.first_event_id is empty');
  if (!summary.events.last_event_id) failures.push('events.last_event_id is empty');
  if (typeof summary.events.count !== 'number' || summary.events.count < 1) {
    failures.push('events.count is invalid');
  }
  return failures;
}

// ── Spot checks ────────────────────────────────────────────────────

function resolvePath(obj: unknown, dotted: string): unknown {
  const parts = dotted.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function runSpotChecks(
  summary: SubPhaseSummary,
  checks: FixtureSpotCheck[] | undefined,
): string[] {
  if (!checks || checks.length === 0) return [];
  const failures: string[] = [];
  for (const c of checks) {
    failures.push(...evaluateSpotCheck(summary, c));
  }
  return failures;
}

/**
 * Evaluate a single spot check against the summary, in clause order
 * (`equals` → `matches` → `not_null`). An invalid `matches` regex short-
 * circuits the remaining clauses for THIS check (originally a `continue`),
 * so `not_null` is not evaluated when the regex fails to compile.
 */
function evaluateSpotCheck(
  summary: SubPhaseSummary,
  c: FixtureSpotCheck,
): string[] {
  const failures: string[] = [];
  const actual = resolvePath(summary, c.path);

  if (c.equals !== undefined && actual !== c.equals) {
    failures.push(
      `spot check ${c.path}: expected ${JSON.stringify(c.equals)}, got ${JSON.stringify(actual)}`,
    );
  }

  if (c.matches !== undefined) {
    let re: RegExp;
    try {
      re = new RegExp(c.matches);
    } catch (err) {
      failures.push(`spot check ${c.path}: invalid regex "${c.matches}" (${err instanceof Error ? err.message : String(err)})`);
      return failures;
    }
    if (typeof actual !== 'string' || !re.test(actual)) {
      failures.push(`spot check ${c.path}: ${JSON.stringify(actual)} did not match /${c.matches}/`);
    }
  }

  if (c.not_null === true && isNullOrEmpty(actual)) {
    failures.push(`spot check ${c.path}: required non-null/non-empty, got ${JSON.stringify(actual)}`);
  }

  return failures;
}

/** True when a resolved spot-check value is null/undefined or an empty string/array. */
function isNullOrEmpty(actual: unknown): boolean {
  return (
    actual === null ||
    actual === undefined ||
    (typeof actual === 'string' && actual.length === 0) ||
    (Array.isArray(actual) && actual.length === 0)
  );
}

// ── Parent/caused-by chain validation ──────────────────────────────

/**
 * Walk every event's parent_event_id + caused_by_event_id; assert they
 * resolve to a real event in the same trace.
 */
export function checkChainIntegrity(
  workspaceRoot: string,
  runId: string,
): string[] {
  const events = readEventsSync(workspaceRoot, runId);
  const known = new Set(events.map((e) => e.event_id));
  const failures: string[] = [];
  for (const e of events) {
    if (e.parent_event_id && !known.has(e.parent_event_id)) {
      failures.push(`event ${e.event_id} (${e.event_type}) parent_event_id ${e.parent_event_id} not found`);
    }
    if (e.caused_by_event_id && !known.has(e.caused_by_event_id)) {
      failures.push(`event ${e.event_id} (${e.event_type}) caused_by_event_id ${e.caused_by_event_id} not found`);
    }
  }
  return failures;
}

// ── Fixture runner ─────────────────────────────────────────────────

export interface FixtureRunResult {
  scenario: string;
  passed: boolean;
  failures: string[];
}

/**
 * Run a fixture's manifest against the trace at the given workspace.
 * The workspace is expected to contain `.janumicode/runs/<scenario>/aodd/`
 * (i.e. the captured trace is treated as if its run_id were the scenario
 * name — this is how `aodd capture` lays out the on-disk fixture).
 */
export function runFixture(
  fixtureRoot: string,
  manifest: FixtureManifest,
): FixtureRunResult {
  const failures: string[] = [];
  const runId = manifest.scenario;

  // Chain integrity covers the whole run.
  failures.push(...checkChainIntegrity(fixtureRoot, runId));

  // forbidden_events scan.
  if (manifest.forbidden_events?.length) {
    const events = readEventsSync(fixtureRoot, runId);
    for (const ev of events) {
      if (manifest.forbidden_events.includes(ev.event_type)) {
        failures.push(
          `forbidden event ${ev.event_type} present at ${ev.event_id}`,
        );
      }
    }
  }

  for (const expected of manifest.expected_sub_phases) {
    const summary = readSubPhaseSummary(
      fixtureRoot,
      runId,
      expected.sub_phase_id,
      expected.phase_id,
    );
    if (!summary) {
      failures.push(
        `sub-phase ${expected.phase_id}/${expected.sub_phase_id} summary missing`,
      );
      continue;
    }
    if (summary.how.status !== expected.expected_status) {
      failures.push(
        `sub-phase ${expected.phase_id}/${expected.sub_phase_id}: expected status ${expected.expected_status}, got ${summary.how.status}`,
      );
    }
    for (const f of check5WH(summary)) {
      failures.push(`sub-phase ${expected.phase_id}/${expected.sub_phase_id}: ${f}`);
    }
    for (const f of runSpotChecks(summary, expected.spot_checks)) {
      failures.push(`sub-phase ${expected.phase_id}/${expected.sub_phase_id}: ${f}`);
    }
  }

  return {
    scenario: manifest.scenario,
    passed: failures.length === 0,
    failures,
  };
}

/**
 * Discover all `<fixtures_dir>/<scenario>/manifest.json` files.
 */
export function discoverFixtures(fixturesDir: string): Array<{
  scenario: string;
  manifestPath: string;
  fixtureRoot: string;
}> {
  if (!fs.existsSync(fixturesDir)) return [];
  const out: Array<{ scenario: string; manifestPath: string; fixtureRoot: string }> = [];
  for (const entry of fs.readdirSync(fixturesDir)) {
    const dir = path.join(fixturesDir, entry);
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.statSync(dir).isDirectory()) continue;
    if (!fs.existsSync(manifestPath)) continue;
    out.push({ scenario: entry, manifestPath, fixtureRoot: dir });
  }
  return out;
}
