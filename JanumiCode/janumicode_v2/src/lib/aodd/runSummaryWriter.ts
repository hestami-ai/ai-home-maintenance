/**
 * Run-level summary writer.
 *
 * Per design memo §4: emits `runs/<run_id>/aodd/summaries/run.summary.{json,md}`
 * at `run.completed` / `run.failed`. The Markdown shape was a deferred
 * design choice (§12 open question 3); this file locks it.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RunSummary } from './types';
import { deriveRunSummary, readEventsFile } from './summaryDeriver';

export function writeRunSummary(
  workspaceRoot: string,
  summary: RunSummary,
): void {
  const dir = path.join(
    workspaceRoot,
    '.janumicode',
    'runs',
    summary.run_id,
    'aodd',
    'summaries',
  );
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'run.summary.json'),
      JSON.stringify(summary, null, 2),
      { encoding: 'utf8' },
    );
    fs.writeFileSync(
      path.join(dir, 'run.summary.md'),
      renderRunSummaryMd(summary),
      { encoding: 'utf8' },
    );
  } catch (err) {
    process.stderr.write(
      `[aodd] WARN: failed to write run summary for ${summary.run_id}: ` +
        `${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

/**
 * Derive and persist the run-level summary from events.ndjson.
 * Idempotent: rewriting overwrites the previous summary.
 */
export function deriveAndWriteRunSummary(
  workspaceRoot: string,
  runId: string,
  janumicodeVersionSha: string,
): RunSummary {
  const { events } = readEventsFile(workspaceRoot, runId);
  const summary = deriveRunSummary(
    workspaceRoot,
    runId,
    janumicodeVersionSha,
    events,
  );
  writeRunSummary(workspaceRoot, summary);
  return summary;
}

export function renderRunSummaryMd(s: RunSummary): string {
  const lines: string[] = [];
  lines.push(`# Run summary: ${s.run_id}`, '');
  if (s.intent_brief) lines.push(`> ${s.intent_brief}`);
  lines.push(
    '',
    `- **Workspace**: \`${s.workspace}\``,
    `- **janumicode version**: \`${s.janumicode_version_sha}\``,
    `- **Started**: ${s.started_at}`,
    `- **Completed**: ${s.completed_at ?? '(in progress)'}`,
  );
  if (s.duration_ms !== null) {
    lines.push(`- **Duration**: ${s.duration_ms} ms`);
  }
  lines.push(`- **Status**: ${s.status}`, '', '## Phases');
  if (s.phases.length === 0) {
    lines.push('_(no phases recorded)_');
  } else {
    lines.push(
      '| phase | status | sub-phases | duration (ms) |',
      '|---|---|---|---|',
    );
    for (const p of s.phases) {
      lines.push(
        `| ${p.phase_id} | ${p.status} | ${p.sub_phase_count} | ${p.duration_ms} |`,
      );
    }
  }
  lines.push(
    '',
    '## Totals',
    `- **Sub-phases**: ${s.totals.sub_phases}`,
    `- **LLM invocations**: ${s.totals.llm_invocations}`,
    `- **Retries**: ${s.totals.retries}`,
    `- **JSON repairs**: ${s.totals.repairs}`,
    `- **Escalations**: ${s.totals.escalations}`,
    `- **Events**: ${s.totals.events}`,
    '',
    '## Events',
    `- **First**: \`${s.events.first_event_id}\``,
    `- **Last**: \`${s.events.last_event_id}\``,
    `- **Count**: ${s.events.count}`,
    '',
  );
  return lines.join('\n');
}
