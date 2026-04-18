<!--
  DmrPipelineCard — composite view of a Deep Memory Research run.

  Replaces the two separate "DMR Stage 1" and "DMR Stage 7" cards with a
  single card that lists all 7 stages (LLM-backed + deterministic) with
  status, duration, and output summary. Detail records referenced via
  `stages[].output_record_id` (e.g. query_decomposition_record,
  context_packet) are rendered inline below the stage list.

  Data model: the `record` prop is a `dmr_pipeline` record; the content
  field is `DmrPipelineContent` (see src/lib/types/records.ts). Stages
  2-6 are deterministic; their `kind: 'deterministic'` tag is the cue
  for the "this stage is intentionally silent, it did real work without
  an LLM call" visual treatment.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { recordsStore } from '../stores/records.svelte';

  interface Props {
    record: SerializedRecord;
  }

  const { record }: Props = $props();

  interface StageEntry {
    stage: number;
    name: string;
    kind: 'llm' | 'deterministic' | 'skipped';
    status: 'pending' | 'running' | 'completed' | 'failed';
    started_at: string | null;
    completed_at: string | null;
    output_summary?: string;
    output_record_id?: string;
    error?: string;
  }

  const content = $derived(record.content as {
    pipeline_id?: string;
    requesting_agent_role?: string;
    scope_tier?: string;
    query?: string;
    stages?: StageEntry[];
    completeness_status?: string;
  });

  const stages = $derived<StageEntry[]>(Array.isArray(content.stages) ? content.stages : []);
  const query = $derived(content.query ?? '');
  const requestingRole = $derived(content.requesting_agent_role ?? '—');
  const scopeTier = $derived(content.scope_tier ?? '—');
  const completeness = $derived(content.completeness_status ?? '—');

  let collapsed = $state(false);

  function stageIcon(s: StageEntry): string {
    if (s.status === 'failed') return '✗';
    if (s.status === 'completed') return s.kind === 'llm' ? '✦' : '·';
    if (s.status === 'running') return '⋯';
    if (s.kind === 'skipped') return '—';
    return '○';
  }

  function durationMs(s: StageEntry): number | null {
    if (!s.started_at || !s.completed_at) return null;
    return new Date(s.completed_at).getTime() - new Date(s.started_at).getTime();
  }

  function formatDuration(ms: number | null): string {
    if (ms == null) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function outputRecord(s: StageEntry): SerializedRecord | undefined {
    if (!s.output_record_id) return undefined;
    return recordsStore.getById(s.output_record_id);
  }

  function outputContentPreview(rec: SerializedRecord): string {
    const c = rec.content as Record<string, unknown>;
    if (typeof c.text === 'string') return c.text.slice(0, 400);
    const keys = Object.keys(c).slice(0, 6);
    if (keys.length === 0) return '(empty)';
    return keys.join(', ');
  }
</script>

<div class="card card-dmr" data-record-id={record.id} data-phase-id={record.phase_id}>
  <button class="header" onclick={() => (collapsed = !collapsed)}>
    <span class="toggle">{collapsed ? '▶' : '▼'}</span>
    <span class="icon">◎</span>
    <span class="label">Deep Memory Research</span>
    <span class="meta">{scopeTier} · {requestingRole}</span>
    <span class="completeness">completeness: {completeness}</span>
  </button>

  {#if !collapsed}
    <div class="body">
      {#if query}
        <div class="query"><span class="query-label">Query:</span> {query}</div>
      {/if}

      <ol class="stages">
        {#each stages as s (s.stage)}
          {@const rec = outputRecord(s)}
          <li class="stage stage-{s.status} stage-kind-{s.kind}">
            <span class="stage-num">{s.stage}</span>
            <span class="stage-status" title={s.status}>{stageIcon(s)}</span>
            <span class="stage-name">{s.name}</span>
            <span class="stage-kind">{s.kind}</span>
            <span class="stage-duration">{formatDuration(durationMs(s))}</span>
            <span class="stage-summary">{s.output_summary ?? ''}</span>
            {#if rec}
              <details class="stage-detail">
                <summary>view {rec.record_type}</summary>
                <pre class="stage-detail-body">{outputContentPreview(rec)}</pre>
              </details>
            {/if}
            {#if s.error}
              <div class="stage-error">{s.error}</div>
            {/if}
          </li>
        {/each}
      </ol>
    </div>
  {/if}
</div>

<style>
  .card-dmr {
    border: 1px solid var(--vscode-panel-border, #444);
    border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
    margin: 0.5em 0;
    background: var(--vscode-editor-background, #1e1e1e);
  }
  .header {
    display: flex;
    align-items: center;
    gap: 0.5em;
    width: 100%;
    padding: 0.5em 0.75em;
    background: transparent;
    border: none;
    color: var(--vscode-foreground, inherit);
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    text-align: left;
  }
  .toggle { width: 1em; color: var(--vscode-descriptionForeground, #888); }
  .icon { color: var(--vscode-textLink-foreground, #3794ff); }
  .label { font-weight: 600; }
  .meta { color: var(--vscode-descriptionForeground, #888); font-size: 0.9em; }
  .completeness {
    margin-left: auto;
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground, #888);
  }
  .body { padding: 0 0.75em 0.75em; }
  .query {
    margin: 0.25em 0 0.75em;
    padding: 0.5em;
    background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.1));
    font-size: 0.9em;
  }
  .query-label { color: var(--vscode-descriptionForeground, #888); margin-right: 0.5em; }
  .stages { list-style: none; padding: 0; margin: 0; }
  .stage {
    display: grid;
    grid-template-columns: 1.5em 1.5em 13em 6em 5em 1fr;
    gap: 0.5em;
    align-items: start;
    padding: 0.35em 0;
    border-bottom: 1px dashed var(--vscode-panel-border, #333);
    font-size: 0.9em;
  }
  .stage:last-child { border-bottom: none; }
  .stage-completed { opacity: 1; }
  .stage-pending { opacity: 0.55; }
  .stage-running { color: var(--vscode-textLink-foreground, #3794ff); }
  .stage-failed { color: var(--vscode-errorForeground, #f88); }
  .stage-num { color: var(--vscode-descriptionForeground, #888); }
  .stage-status { text-align: center; }
  .stage-name { font-weight: 500; }
  .stage-kind {
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground, #888);
    text-transform: uppercase;
  }
  .stage-duration {
    color: var(--vscode-descriptionForeground, #888);
    font-variant-numeric: tabular-nums;
  }
  .stage-summary {
    color: var(--vscode-descriptionForeground, #ccc);
  }
  .stage-detail {
    grid-column: 3 / -1;
    margin-top: 0.3em;
  }
  .stage-detail-body {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.85em;
    background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
    padding: 0.5em;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0.25em 0 0;
  }
  .stage-error {
    grid-column: 3 / -1;
    color: var(--vscode-errorForeground, #f88);
    margin-top: 0.25em;
  }
</style>
