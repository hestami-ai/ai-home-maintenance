/**
 * Sub-phase summary writer.
 *
 * Per design memo §4: emits a `<sub_phase_id>.summary.json` + `.md`
 * twin file pair under
 *   runs/<run_id>/aodd/summaries/phase-<phase_id>/<sub_phase_id>.summary.{json,md}
 *
 * P6 implementation strategy: bulk-derive at `endRun()` rather than
 * firing per-sub-phase-exit. See `summaryDeriver.ts` for the rationale.
 *
 * Completeness invariant (design memo §4.3): the schema demands non-null
 * 5W+H fields. Today some fields lack a source event (record.*, retry.*,
 * gate.*, context.* were deferred from P5). The deriver fills those
 * with `'unknown'` (required strings) or `[]` (arrays). A future
 * tightening will swap `'unknown'` markers for hard errors once the
 * deferred sources are wired.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SubPhaseSummary } from './types';
import {
  deriveSubPhaseSummary,
  groupBySubPhase,
  readEventsFile,
} from './summaryDeriver';
import { phaseIdToFilenameSegment, subPhaseIdToFilenameSegment } from './idCanonicalize';

/**
 * Persist a sub-phase summary as `.json` and `.md` under
 *   runs/<run_id>/aodd/summaries/phase-<phase_id>/<sub_phase_id>.summary.{json,md}
 */
export function writeSubPhaseSummary(
  workspaceRoot: string,
  summary: SubPhaseSummary,
): void {
  const phaseSeg = phaseIdToFilenameSegment(summary.phase_id, { padded: false });
  const subSeg = subPhaseIdToFilenameSegment(summary.sub_phase_id);
  const dir = path.join(
    workspaceRoot,
    '.janumicode',
    'runs',
    summary.run_id,
    'aodd',
    'summaries',
    phaseSeg,
  );
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${subSeg}.summary.json`),
      JSON.stringify(summary, null, 2),
      { encoding: 'utf8' },
    );
    fs.writeFileSync(
      path.join(dir, `${subSeg}.summary.md`),
      renderSubPhaseSummaryMd(summary),
      { encoding: 'utf8' },
    );
  } catch (err) {
    process.stderr.write(
      `[aodd] WARN: failed to write sub-phase summary for ` +
        `${summary.run_id}/${summary.phase_id}/${summary.sub_phase_id}: ` +
        `${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

/**
 * Derive and persist sub-phase summaries for every (phase_id, sub_phase_id)
 * pair observed in the run's events.ndjson. Idempotent: a second call
 * overwrites the previous summaries with the latest event view.
 */
export function deriveAndWriteSubPhaseSummaries(
  workspaceRoot: string,
  runId: string,
): SubPhaseSummary[] {
  const { events } = readEventsFile(workspaceRoot, runId);
  const groups = groupBySubPhase(events);
  const out: SubPhaseSummary[] = [];
  for (const g of groups) {
    const summary = deriveSubPhaseSummary(runId, g);
    writeSubPhaseSummary(workspaceRoot, summary);
    out.push(summary);
  }
  return out;
}

/**
 * Focused variant: derive + write the summary for a single
 * (phase_id, sub_phase_id) pair. Called from `emit.ts` when a
 * `sub_phase.exited` event fires, so the summary lands on disk
 * incrementally as each sub-phase finishes — rather than only at
 * endRun. Lets an agent inspect a sub-phase that finished even if the
 * run is still in flight or crashed before endRun.
 *
 * Returns null when the sub-phase has no events (defensive).
 */
export function deriveAndWriteOneSubPhaseSummary(
  workspaceRoot: string,
  runId: string,
  phaseId: string,
  subPhaseId: string,
): SubPhaseSummary | null {
  const { events } = readEventsFile(workspaceRoot, runId);
  const group = {
    phase_id: phaseId as SubPhaseSummary['phase_id'],
    sub_phase_id: subPhaseId,
    events: events.filter(
      (e) => e.phase_id === phaseId && e.sub_phase_id === subPhaseId,
    ),
  };
  if (group.events.length === 0) return null;
  const summary = deriveSubPhaseSummary(runId, group);
  writeSubPhaseSummary(workspaceRoot, summary);
  return summary;
}

// ── Markdown projector ──────────────────────────────────────────────

/**
 * Render a `SubPhaseSummary` as Markdown. Pure function (so it can be
 * unit-tested against fixed input and so the `.md` is exactly the
 * projection of the `.json` — they cannot diverge).
 */
export function renderSubPhaseSummaryMd(s: SubPhaseSummary): string {
  const lines: string[] = [];
  lines.push(`# Sub-phase summary: phase ${s.phase_id} / ${s.sub_phase_id}`);
  lines.push('');
  lines.push(`- **Run**: \`${s.run_id}\``);
  lines.push(`- **Started**: ${s.started_at}`);
  lines.push(`- **Completed**: ${s.completed_at}`);
  lines.push(`- **Duration**: ${s.duration_ms} ms`);
  lines.push(`- **Status**: ${s.how.status}`);
  lines.push('');
  lines.push('## Who');
  lines.push(`- **Agent role**: ${s.who.agent_role ?? '(none)'}`);
  lines.push(`- **Model**: ${s.who.model}`);
  if (Object.keys(s.who.model_parameters).length > 0) {
    lines.push('- **Model parameters**:');
    for (const [k, v] of Object.entries(s.who.model_parameters)) {
      lines.push(`  - \`${k}\`: ${JSON.stringify(v)}`);
    }
  }
  if (s.who.invocation_chain.length > 0) {
    lines.push('- **Invocations**:');
    for (const inv of s.who.invocation_chain) {
      lines.push(`  - ${inv.invocation_id} (depth ${inv.depth})`);
    }
  }
  lines.push('');
  lines.push('## What');
  lines.push(`- **Inputs consumed**: ${s.what.inputs_consumed.length}`);
  lines.push(`- **Outputs produced**: ${s.what.outputs_produced.length}`);
  lines.push(`- **Decisions**: ${s.what.decisions.length}`);
  for (const d of s.what.decisions) {
    lines.push(`  - [${d.kind}] ${d.brief}  \`${d.ref_event_id}\``);
  }
  lines.push('');
  lines.push('## Why');
  lines.push(`- **Template**: \`${s.why.template_key}\``);
  lines.push(`- **Template SHA**: \`${s.why.template_source_sha}\``);
  lines.push(`- **Rendered prompt ref**: \`${s.why.rendered_prompt_ref}\``);
  if (s.why.governing_constraints.length > 0) {
    lines.push('- **Governing constraints**:');
    for (const c of s.why.governing_constraints) lines.push(`  - ${c}`);
  }
  lines.push('');
  lines.push('## How');
  lines.push(`- **Retries**: ${s.how.retries}`);
  lines.push(`- **JSON repairs**: ${s.how.repairs}`);
  lines.push(`- **Escalations**: ${s.how.escalations}`);
  if (s.how.fallbacks.length > 0) {
    lines.push('- **Fallbacks**:');
    for (const f of s.how.fallbacks) {
      lines.push(`  - ${f.from} → ${f.to}: ${f.reason}`);
    }
  }
  if (s.how.error) {
    lines.push(`- **Error**: ${s.how.error.message}  \`${s.how.error.event_id}\``);
  }
  lines.push('');
  lines.push('## Events');
  lines.push(`- **First**: \`${s.events.first_event_id}\``);
  lines.push(`- **Last**: \`${s.events.last_event_id}\``);
  lines.push(`- **Count**: ${s.events.count}`);
  lines.push('');
  return lines.join('\n');
}
