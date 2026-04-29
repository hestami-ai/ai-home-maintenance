<!--
  ExecutionWaveCard — Wave R card for an execution_wave_started or
  execution_wave_completed record. Renders the wave's release context,
  leaf counts, success/quarantine breakdown, file-write summary,
  test summary, and reasoning_review-flaw summary. Tied to its sibling
  wave_gate_decision via wave_number for the gate verdict chip.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { recordsStore } from '../stores/records.svelte';

  interface Props {
    record: SerializedRecord;
  }

  const { record }: Props = $props();

  interface CompletedContent {
    kind: 'execution_wave_completed';
    wave_number: number;
    release_id: string | null;
    release_ordinal: number | null;
    release_name?: string;
    wave_kind: 'release' | 'deferred_batch' | 'single';
    leaf_count: number;
    successful_count: number;
    quarantined_count: number;
    rescued_count?: number;
    started_at?: string;
    completed_at: string;
    duration_ms?: number;
    files_written_count?: number;
    files_modified_count?: number;
    files_deleted_count?: number;
    test_summary?: {
      total_passed: number;
      total_failed: number;
      total_skipped: number;
      leaves_with_failing_tests: number;
    };
    reasoning_review_summary?: Record<string, number>;
    successful_leaf_ids?: string[];
    quarantined_leaf_ids?: string[];
  }

  interface StartedContent {
    kind: 'execution_wave_started';
    wave_number: number;
    release_id: string | null;
    release_ordinal: number | null;
    release_name?: string;
    wave_kind: 'release' | 'deferred_batch' | 'single';
    leaf_count: number;
    started_at: string;
    leaf_distribution_by_component?: Record<string, number>;
    leaf_ids?: string[];
  }

  const isCompleted = $derived(record.record_type === 'execution_wave_completed');
  const completedContent = $derived(
    isCompleted ? (record.content as unknown as CompletedContent) : null,
  );
  const startedContent = $derived(
    !isCompleted ? (record.content as unknown as StartedContent) : null,
  );
  const waveNumber = $derived(completedContent?.wave_number ?? startedContent?.wave_number ?? 0);
  const waveKind = $derived(completedContent?.wave_kind ?? startedContent?.wave_kind ?? 'release');
  const releaseLabel = $derived(
    completedContent?.release_name
      ?? startedContent?.release_name
      ?? (waveKind === 'deferred_batch'
        ? 'Deferred batch'
        : waveKind === 'single'
          ? 'Single wave'
          : `Wave ${waveNumber}`),
  );

  const gateRecord = $derived(
    recordsStore.records.find(r =>
      r.record_type === 'wave_gate_decision'
      && (r.content as { wave_number?: number }).wave_number === waveNumber,
    ),
  );
  const gateDecision = $derived(
    gateRecord
      ? (gateRecord.content as { decision?: string }).decision ?? null
      : null,
  );

  let collapsed = $state(false);

  function gateChipClass(decision: string | null): string {
    if (!decision) return 'gate-pending';
    if (decision === 'rejected') return 'gate-rejected';
    if (decision === 'auto_approved') return 'gate-auto';
    return 'gate-approved';
  }
</script>

<div class="wave-card wave-{waveKind}" data-record-id={record.id}>
  <button class="header" onclick={() => (collapsed = !collapsed)}>
    <span class="toggle">{collapsed ? '▶' : '▼'}</span>
    <span class="icon">▶</span>
    <span class="label">
      {isCompleted ? 'Wave completed' : 'Wave started'}: {releaseLabel}
    </span>
    <span class="meta">
      #{waveNumber} · {waveKind}
    </span>
    {#if isCompleted && completedContent}
      <span class="success-chip">{completedContent.successful_count}/{completedContent.leaf_count} ok</span>
      {#if completedContent.quarantined_count > 0}
        <span class="quar-chip">{completedContent.quarantined_count} quarantined</span>
      {/if}
    {:else if startedContent}
      <span class="meta">{startedContent.leaf_count} leaves</span>
    {/if}
    {#if gateDecision}
      <span class="gate-chip {gateChipClass(gateDecision)}">{gateDecision}</span>
    {/if}
  </button>

  {#if !collapsed}
    <div class="body">
      {#if completedContent}
        {#if completedContent.duration_ms !== undefined}
          <div class="row">
            <span class="row-label">Duration:</span>
            <span class="row-value">{(completedContent.duration_ms / 1000).toFixed(1)}s</span>
          </div>
        {/if}

        {#if completedContent.files_written_count !== undefined}
          <div class="row">
            <span class="row-label">Files:</span>
            <span class="row-value">
              {completedContent.files_written_count} created ·
              {completedContent.files_modified_count ?? 0} modified ·
              {completedContent.files_deleted_count ?? 0} deleted
            </span>
          </div>
        {/if}

        {#if completedContent.test_summary}
          <div class="row">
            <span class="row-label">Tests:</span>
            <span class="row-value">
              {completedContent.test_summary.total_passed} passed ·
              <span class:fail={completedContent.test_summary.total_failed > 0}>{completedContent.test_summary.total_failed} failed</span> ·
              {completedContent.test_summary.total_skipped} skipped
              {#if completedContent.test_summary.leaves_with_failing_tests > 0}
                ({completedContent.test_summary.leaves_with_failing_tests} leaves with failures)
              {/if}
            </span>
          </div>
        {/if}

        {#if completedContent.reasoning_review_summary && Object.keys(completedContent.reasoning_review_summary).length > 0}
          <div class="row">
            <span class="row-label">Reasoning review flaws:</span>
            <span class="row-value flaws">
              {#each Object.entries(completedContent.reasoning_review_summary) as [flawType, count] (flawType)}
                <span class="flaw-chip">{flawType}: {count}</span>
              {/each}
            </span>
          </div>
        {/if}

        {#if completedContent.successful_leaf_ids && completedContent.successful_leaf_ids.length > 0}
          <details class="leaf-list">
            <summary>Successful leaves ({completedContent.successful_leaf_ids.length})</summary>
            <ul>
              {#each completedContent.successful_leaf_ids as id (id)}
                <li class="leaf-id">{id}</li>
              {/each}
            </ul>
          </details>
        {/if}

        {#if completedContent.quarantined_leaf_ids && completedContent.quarantined_leaf_ids.length > 0}
          <details class="leaf-list quarantine-list" open>
            <summary>Quarantined leaves ({completedContent.quarantined_leaf_ids.length})</summary>
            <ul>
              {#each completedContent.quarantined_leaf_ids as id (id)}
                <li class="leaf-id quar">{id}</li>
              {/each}
            </ul>
          </details>
        {/if}
      {:else if startedContent}
        {#if startedContent.leaf_distribution_by_component && Object.keys(startedContent.leaf_distribution_by_component).length > 0}
          <div class="row">
            <span class="row-label">Distribution by component:</span>
            <span class="row-value">
              {#each Object.entries(startedContent.leaf_distribution_by_component) as [comp, n] (comp)}
                <span class="dist-chip">{comp}: {n}</span>
              {/each}
            </span>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .wave-card {
    margin: 0.5em 0;
    border: 1px solid var(--vscode-panel-border, #444);
    border-left: 3px solid var(--vscode-charts-purple, #b392f0);
    background: var(--vscode-editor-background, #1e1e1e);
  }
  .wave-deferred_batch {
    border-left-color: var(--vscode-editorWarning-foreground, #cca700);
  }
  .header {
    display: flex; align-items: center; gap: 0.5em; width: 100%;
    padding: 0.5em 0.75em; background: transparent; border: none;
    color: var(--vscode-foreground, inherit); cursor: pointer;
    font-family: inherit; font-size: inherit; text-align: left;
  }
  .toggle { width: 1em; color: var(--vscode-descriptionForeground, #888); }
  .icon { color: var(--vscode-charts-purple, #b392f0); }
  .label { font-weight: 600; flex: 1; }
  .meta { color: var(--vscode-descriptionForeground, #888); font-size: 0.85em; }
  .success-chip {
    font-size: 0.75em; padding: 0.05em 0.4em; border-radius: 0.2em;
    background: rgba(129, 199, 132, 0.25);
    color: var(--vscode-testing-iconPassed, #73c991);
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .quar-chip {
    font-size: 0.75em; padding: 0.05em 0.4em; border-radius: 0.2em;
    background: rgba(255, 167, 38, 0.25);
    color: var(--vscode-editorWarning-foreground, #cca700);
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .gate-chip {
    font-size: 0.7em; padding: 0.05em 0.4em; border-radius: 0.2em;
    text-transform: uppercase; font-weight: 600;
  }
  .gate-pending { background: rgba(127,127,127,0.25); color: var(--vscode-descriptionForeground, #888); }
  .gate-approved { background: rgba(129, 199, 132, 0.25); color: var(--vscode-testing-iconPassed, #73c991); }
  .gate-auto { background: rgba(100, 181, 246, 0.25); color: #64b5f6; }
  .gate-rejected { background: rgba(244, 67, 54, 0.25); color: var(--vscode-errorForeground, #f88); }

  .body { padding: 0 0.75em 0.75em; font-size: 0.85em; }
  .row { display: flex; gap: 0.5em; margin: 0.4em 0; align-items: baseline; }
  .row-label { color: var(--vscode-descriptionForeground, #888); min-width: 9em; }
  .row-value { color: var(--vscode-foreground, inherit); }
  .row-value .fail { color: var(--vscode-errorForeground, #f88); font-weight: 600; }
  .flaws, .row-value { display: flex; flex-wrap: wrap; gap: 0.25em; }
  .flaw-chip, .dist-chip {
    background: rgba(127,127,127,0.15);
    padding: 0.05em 0.35em; border-radius: 0.2em;
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .flaw-chip { background: rgba(244, 67, 54, 0.15); color: var(--vscode-errorForeground, #f88); }
  .leaf-list { margin: 0.5em 0; }
  .leaf-list summary { cursor: pointer; color: var(--vscode-descriptionForeground, #888); }
  .leaf-list ul { margin: 0.35em 0; padding-left: 1.5em; }
  .leaf-id { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.85em; }
  .leaf-id.quar { color: var(--vscode-editorWarning-foreground, #cca700); }
  .quarantine-list summary { color: var(--vscode-editorWarning-foreground, #cca700); font-weight: 600; }
</style>
