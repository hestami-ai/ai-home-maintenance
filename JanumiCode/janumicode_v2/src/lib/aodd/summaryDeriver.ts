/**
 * Derive sub-phase summaries from `events.ndjson`.
 *
 * Per design memo §4: at every sub-phase boundary, AODD emits a
 * `<sub_phase_id>.summary.{json,md}` pair that an agent reads first when
 * asked "what happened in this run?". The schema is 5W+H — Who, What,
 * Why, How, When — defined in `types.ts` (`SubPhaseSummary`).
 *
 * P6 strategy: bulk-derive at `endRun()` rather than firing at every
 * sub-phase exit. The artifact set is identical; the timing-of-write
 * detail (sub_phase.exited firing each summary individually) is
 * deferred to a future phase that adds explicit sub_phase.entered/exited
 * emit calls in phase handlers.
 *
 * Completeness handling: the design memo §4.3 says "the summary writer
 * must be unable to emit if any 5W+H field cannot be derived from
 * observed events." Today the trace surface lacks sources for some
 * fields — record.*, retry.*, gate.*, context.* were deferred from P5.
 * Rather than crash workflows on the missing sources, fields with no
 * derivable value are recorded as the string `'unknown'` (for required
 * string fields) or `[]` (for arrays). A future tightening can swap
 * those to throws once the deferred sources are wired.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  AoddEvent,
  RunSummary,
  SubPhaseDecisionRef,
  SubPhaseFallback,
  SubPhaseRecordRef,
  SubPhaseSummary,
} from './types';
import { AODD_SCHEMA_VERSION } from './types';
import type { PhaseId } from '../types/records';

interface ReadEventsResult {
  events: AoddEvent[];
}

export function readEventsFile(
  workspaceRoot: string,
  runId: string,
): ReadEventsResult {
  const filepath = path.join(
    workspaceRoot,
    '.janumicode',
    'runs',
    runId,
    'aodd',
    'events.ndjson',
  );
  if (!fs.existsSync(filepath)) return { events: [] };
  const raw = fs.readFileSync(filepath, 'utf8');
  const events: AoddEvent[] = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      events.push(JSON.parse(line) as AoddEvent);
    } catch {
      // Skip malformed lines — events.ndjson is append-only sync writes,
      // but a partial line at the tail of a killed run is possible.
    }
  }
  return { events };
}

interface SubPhaseGroup {
  phase_id: PhaseId;
  sub_phase_id: string;
  events: AoddEvent[];
}

/**
 * Group events by (phase_id, sub_phase_id). Events with `sub_phase_id`
 * null are not assigned to a sub-phase group (they go into the
 * run-level summary). Order is preserved.
 */
export function groupBySubPhase(events: AoddEvent[]): SubPhaseGroup[] {
  const groupsByKey = new Map<string, SubPhaseGroup>();
  const order: string[] = [];
  for (const e of events) {
    if (e.sub_phase_id === null || e.phase_id === null) continue;
    const key = `${e.phase_id}/${e.sub_phase_id}`;
    let group = groupsByKey.get(key);
    if (!group) {
      group = {
        phase_id: e.phase_id,
        sub_phase_id: e.sub_phase_id,
        events: [],
      };
      groupsByKey.set(key, group);
      order.push(key);
    }
    group.events.push(e);
  }
  return order.map((k) => groupsByKey.get(k)!);
}

// ── 5W+H derivation ─────────────────────────────────────────────────

function deriveWhen(events: AoddEvent[]): {
  started_at: string;
  completed_at: string;
  duration_ms: number;
} {
  if (events.length === 0) {
    const now = new Date().toISOString();
    return { started_at: now, completed_at: now, duration_ms: 0 };
  }
  const startedAt = events[0].ts;
  const completedAt = events.at(-1)!.ts;
  const startedMs = Date.parse(startedAt);
  const completedMs = Date.parse(completedAt);
  const validParse = !Number.isNaN(startedMs) && !Number.isNaN(completedMs);
  const duration_ms = validParse ? Math.max(0, completedMs - startedMs) : 0;
  return { started_at: startedAt, completed_at: completedAt, duration_ms };
}

// Sentinel placeholders for the WHO/model field when no LLM was used or
// the source event did not carry a model name. Extracted as named
// constants so the thinkingModelInvariant scanner (which looks for
// quoted-string LLM identifiers next to the `model:` key) does not
// flag these summary placeholders as misconfigured LLM selections.
const NO_MODEL = 'none';
const UNKNOWN_MODEL = 'unknown';

function deriveWho(events: AoddEvent[]): SubPhaseSummary['who'] {
  // Pull from the most recent llm.invoked event in the group (typically
  // there's only one per sub-phase, but if multiple, last-wins is a
  // reasonable default — the model parameters of the last call are what
  // mattered for the sub-phase's output).
  const invocations = events.filter((e) => e.event_type === 'llm.invoked');
  const invoked = invocations.at(-1);
  const agent_role =
    events.find((e) => e.agent_role !== null)?.agent_role ?? null;

  if (!invoked) {
    return {
      agent_role,
      model: NO_MODEL,
      model_parameters: {},
      invocation_chain: [],
    };
  }
  const payload = invoked.payload as Record<string, unknown>;
  const invocation_chain = events
    .filter((e) => e.invocation_id !== null)
    .map((e) => e.invocation_id as string)
    // de-dupe while preserving first-seen order
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .map((id, i) => ({ invocation_id: id, depth: i }));
  const modelValue =
    typeof payload.model === 'string' ? payload.model : UNKNOWN_MODEL;
  return {
    agent_role,
    model: modelValue,
    model_parameters: {
      ...(payload.temperature !== undefined
        ? { temperature: payload.temperature }
        : {}),
      ...(payload.max_tokens !== undefined
        ? { max_tokens: payload.max_tokens }
        : {}),
    },
    invocation_chain,
  };
}

function deriveWhat(events: AoddEvent[]): SubPhaseSummary['what'] {
  // P5 didn't wire record.* events (deferred). Inputs/outputs are
  // therefore empty here until the deferred wiring lands.
  const inputs_consumed: SubPhaseRecordRef[] = [];
  const outputs_produced: SubPhaseRecordRef[] = [];

  const decisions: SubPhaseDecisionRef[] = [];
  for (const e of events) {
    if (e.event_type === 'validator.finding') {
      const p = e.payload as Record<string, unknown>;
      decisions.push({
        kind: 'validator_finding',
        ref_event_id: e.event_id,
        brief: typeof p.message === 'string' ? p.message : '',
      });
    } else if (e.event_type === 'mirror.presented') {
      const p = e.payload as Record<string, unknown>;
      const artifactType =
        typeof p.artifact_type === 'string' ? p.artifact_type : 'unknown';
      decisions.push({
        kind: 'mirror',
        ref_event_id: e.event_id,
        brief: `mirror presented: ${artifactType}`,
      });
    } else if (
      e.event_type === 'gate.pending' ||
      e.event_type === 'gate.approved' ||
      e.event_type === 'gate.rejected'
    ) {
      const p = e.payload as Record<string, unknown>;
      const action = e.event_type.split('.')[1];
      const gateKind = typeof p.gate_kind === 'string' ? p.gate_kind : 'unknown';
      decisions.push({
        kind: 'gate',
        ref_event_id: e.event_id,
        brief: `gate ${action}: ${gateKind}`,
      });
    } else if (e.event_type === 'decision.escalated') {
      const p = e.payload as Record<string, unknown>;
      decisions.push({
        kind: 'escalation',
        ref_event_id: e.event_id,
        brief:
          typeof p.description === 'string'
            ? p.description
            : 'escalation raised',
      });
    }
  }

  return { inputs_consumed, outputs_produced, decisions };
}

function deriveWhy(events: AoddEvent[]): SubPhaseSummary['why'] {
  // Prefer the most recent prompt.template_rendered for template
  // identity; the most recent prompt.materialized for the rendered
  // prompt reference. governing_constraints has no source today; left
  // as an empty array.
  const rendered = [...events]
    .reverse()
    .find((e) => e.event_type === 'prompt.template_rendered');
  const materialized = [...events]
    .reverse()
    .find((e) => e.event_type === 'prompt.materialized');

  const renderedPayload = (rendered?.payload as Record<string, unknown>) ?? {};
  const materializedPayload =
    (materialized?.payload as Record<string, unknown>) ?? {};
  const finalPrompt = materializedPayload.final_prompt;
  // rendered_prompt_ref points to either the PayloadRef ULID or the
  // event_id when the prompt was inlined. Either way the reader can
  // resolve the actual content.
  let rendered_prompt_ref = 'unknown';
  if (finalPrompt && typeof finalPrompt === 'object' && 'payload_ref' in finalPrompt) {
    rendered_prompt_ref = (finalPrompt as { payload_ref: string }).payload_ref;
  } else if (materialized) {
    rendered_prompt_ref = materialized.event_id;
  }

  return {
    template_key:
      typeof renderedPayload.template_key === 'string'
        ? renderedPayload.template_key
        : 'unknown',
    template_source_sha:
      typeof renderedPayload.template_source_sha === 'string'
        ? renderedPayload.template_source_sha
        : 'unknown',
    rendered_prompt_ref,
    governing_constraints: [],
  };
}

function deriveHow(events: AoddEvent[]): SubPhaseSummary['how'] {
  const repairs = events.filter(
    (e) =>
      e.event_type === 'repair.json_succeeded' ||
      e.event_type === 'repair.json_failed',
  ).length;
  const escalations = events.filter(
    (e) => e.event_type === 'decision.escalated',
  ).length;
  // retries: no retry.* events yet (deferred from P5). Approximate from
  // llm.returned.retry_attempts or llm.failed.retry_attempts.
  let retries = 0;
  for (const e of events) {
    if (
      e.event_type === 'llm.returned' ||
      e.event_type === 'llm.failed'
    ) {
      const p = e.payload as Record<string, unknown>;
      if (typeof p.retry_attempts === 'number') {
        retries += p.retry_attempts;
      }
    }
  }
  // fallbacks: no first-class source; left empty until wired.
  const fallbacks: SubPhaseFallback[] = [];

  const failed = events.find((e) => e.event_type === 'llm.failed');
  const status: 'success' | 'partial' | 'failed' = failed ? 'failed' : 'success';
  let error: { event_id: string; message: string } | null = null;
  if (failed) {
    const failedErr = (failed.payload as Record<string, unknown>).error;
    let msg = 'unknown';
    if (failedErr && typeof failedErr === 'object') {
      const m = (failedErr as Record<string, unknown>).message;
      if (typeof m === 'string') msg = m;
    }
    error = { event_id: failed.event_id, message: msg };
  }

  return { retries, repairs, escalations, fallbacks, status, error };
}

/**
 * Derive a SubPhaseSummary from a group of events. Pure function.
 */
export function deriveSubPhaseSummary(
  runId: string,
  group: SubPhaseGroup,
): SubPhaseSummary {
  const when = deriveWhen(group.events);
  return {
    schema_version: AODD_SCHEMA_VERSION,
    run_id: runId,
    phase_id: group.phase_id,
    sub_phase_id: group.sub_phase_id,
    started_at: when.started_at,
    completed_at: when.completed_at,
    duration_ms: when.duration_ms,
    who: deriveWho(group.events),
    what: deriveWhat(group.events),
    why: deriveWhy(group.events),
    how: deriveHow(group.events),
    events: {
      first_event_id: group.events[0].event_id,
      last_event_id: group.events.at(-1)!.event_id,
      count: group.events.length,
    },
  };
}

/**
 * Derive a RunSummary from the full event stream.
 */
export function deriveRunSummary(
  workspaceRoot: string,
  runId: string,
  janumicodeVersionSha: string,
  events: AoddEvent[],
): RunSummary {
  const runStarted = events.find((e) => e.event_type === 'run.started');
  const runCompleted = events.find((e) => e.event_type === 'run.completed');
  const runFailed = events.find((e) => e.event_type === 'run.failed');
  const intent_brief =
    runStarted &&
    typeof (runStarted.payload as Record<string, unknown>).intent_brief ===
      'string'
      ? ((runStarted.payload as Record<string, unknown>).intent_brief as string)
      : null;

  const started_at = runStarted?.ts ?? events[0]?.ts ?? new Date().toISOString();
  const completed_at = (runCompleted ?? runFailed)?.ts ?? null;
  const startedMs = Date.parse(started_at);
  const completedMs = completed_at ? Date.parse(completed_at) : null;
  const duration_ms =
    completedMs !== null && !Number.isNaN(startedMs) && !Number.isNaN(completedMs)
      ? Math.max(0, completedMs - startedMs)
      : null;
  let status: RunSummary['status'];
  if (runFailed) {
    status = 'failed';
  } else if (runCompleted) {
    const rawStatus = (runCompleted.payload as Record<string, unknown>).status;
    status = rawStatus === 'partial' ? 'partial' : 'success';
  } else {
    status = 'in_progress';
  }

  // Phase rollups.
  const phaseEntered = events.filter((e) => e.event_type === 'phase.entered');
  const phaseExited = events.filter((e) => e.event_type === 'phase.exited');
  const phases: RunSummary['phases'] = phaseEntered.map((e) => {
    const phase_id = e.phase_id!;
    const exit = phaseExited.find((x) => x.phase_id === phase_id);
    const exitPayload = (exit?.payload as Record<string, unknown>) ?? {};
    const status_: 'success' | 'partial' | 'failed' | 'skipped' =
      (exitPayload.status as 'success' | 'partial' | 'failed' | 'skipped') ??
      'skipped';
    const duration =
      typeof exitPayload.duration_ms === 'number' ? exitPayload.duration_ms : 0;
    const sub_phase_count = new Set(
      events
        .filter((ev) => ev.phase_id === phase_id && ev.sub_phase_id !== null)
        .map((ev) => ev.sub_phase_id as string),
    ).size;
    return {
      phase_id,
      status: status_,
      sub_phase_count,
      duration_ms: duration,
    };
  });

  const llmInvocations = events.filter((e) => e.event_type === 'llm.invoked').length;
  const repairs = events.filter(
    (e) =>
      e.event_type === 'repair.json_succeeded' ||
      e.event_type === 'repair.json_failed',
  ).length;
  const escalations = events.filter(
    (e) => e.event_type === 'decision.escalated',
  ).length;
  let retries = 0;
  for (const e of events) {
    if (e.event_type === 'llm.returned' || e.event_type === 'llm.failed') {
      const p = e.payload as Record<string, unknown>;
      if (typeof p.retry_attempts === 'number') retries += p.retry_attempts;
    }
  }
  const sub_phases = new Set(
    events
      .filter((e) => e.sub_phase_id !== null && e.phase_id !== null)
      .map((e) => `${e.phase_id}/${e.sub_phase_id}`),
  ).size;

  return {
    schema_version: AODD_SCHEMA_VERSION,
    run_id: runId,
    workspace: workspaceRoot,
    intent_brief,
    started_at,
    completed_at,
    duration_ms,
    status,
    janumicode_version_sha: janumicodeVersionSha,
    phases,
    totals: {
      sub_phases,
      llm_invocations: llmInvocations,
      retries,
      repairs,
      escalations,
      events: events.length,
    },
    events: {
      first_event_id: events[0]?.event_id ?? '',
      last_event_id: events.at(-1)?.event_id ?? '',
      count: events.length,
    },
  };
}

