<!--
  QuarantineLedgerCard — Wave R card for a task_quarantine record.
  Shows the quarantined leaf's retry trace (per-attempt outcome,
  reasoning_review flaws, test failures) so a human (or the
  deferred-batch wave) can act on it.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';

  interface Props {
    record: SerializedRecord;
  }

  const { record }: Props = $props();

  interface AttemptEntry {
    attempt_number: number;
    invocation_id: string;
    outcome: 'execution_failed' | 'reasoning_review_failed' | 'tests_failed' | 'passed';
    reasoning_review_flaws?: Array<{ flaw_type: string; severity: string; description?: string }>;
    test_failures?: string[];
    files_written_count?: number;
    error_message?: string;
  }

  interface Content {
    leaf_task_id: string;
    leaf_node_id?: string | null;
    wave_number: number;
    release_id: string | null;
    release_ordinal: number | null;
    attempts: AttemptEntry[];
    quarantine_reason: string;
    rescue_status: 'pending' | 'rescued' | 'terminally_deferred';
    quarantined_at: string;
  }

  const content = $derived(record.content as unknown as Content);

  let collapsed = $state(false);

  function statusClass(status: string): string {
    if (status === 'rescued') return 'rescued';
    if (status === 'terminally_deferred') return 'terminal';
    return 'pending';
  }

  function outcomeIcon(o: AttemptEntry['outcome']): string {
    switch (o) {
      case 'passed': return '✓';
      case 'execution_failed': return '✗';
      case 'reasoning_review_failed': return '◇';
      case 'tests_failed': return '⚠';
    }
  }
</script>

<div class="quar-card status-{content.rescue_status}" data-record-id={record.id}>
  <button class="header" onclick={() => (collapsed = !collapsed)}>
    <span class="toggle">{collapsed ? '▶' : '▼'}</span>
    <span class="icon">⚠</span>
    <span class="label">Quarantined: {content.leaf_task_id}</span>
    <span class="meta">wave {content.wave_number} · {content.attempts.length} attempt{content.attempts.length === 1 ? '' : 's'}</span>
    <span class="status-chip {statusClass(content.rescue_status)}">{content.rescue_status}</span>
  </button>

  {#if !collapsed}
    <div class="body">
      <div class="reason">
        <span class="row-label">Reason:</span>
        <span>{content.quarantine_reason}</span>
      </div>
      {#if content.release_id}
        <div class="row">
          <span class="row-label">Release:</span>
          <span class="row-value">{content.release_id}{content.release_ordinal != null ? ` (ordinal ${content.release_ordinal})` : ''}</span>
        </div>
      {/if}
      {#if content.leaf_node_id}
        <div class="row">
          <span class="row-label">Leaf node:</span>
          <span class="row-value mono">{content.leaf_node_id.slice(0, 8)}</span>
        </div>
      {/if}

      <div class="attempts-section">
        <div class="section-label">Retry trace</div>
        <ol class="attempts">
          {#each content.attempts as a (a.attempt_number)}
            <li class="attempt outcome-{a.outcome}">
              <span class="attempt-icon">{outcomeIcon(a.outcome)}</span>
              <span class="attempt-num">attempt {a.attempt_number}</span>
              <span class="attempt-outcome">{a.outcome}</span>
              {#if a.files_written_count !== undefined}
                <span class="attempt-files">{a.files_written_count} files</span>
              {/if}
              {#if a.error_message}
                <div class="attempt-error">{a.error_message}</div>
              {/if}
              {#if a.reasoning_review_flaws && a.reasoning_review_flaws.length > 0}
                <ul class="flaws">
                  {#each a.reasoning_review_flaws as f, i (i)}
                    <li class="flaw severity-{f.severity}">
                      <span class="flaw-type">{f.flaw_type}</span>
                      <span class="flaw-severity">[{f.severity}]</span>
                      {#if f.description}<span class="flaw-desc">{f.description}</span>{/if}
                    </li>
                  {/each}
                </ul>
              {/if}
              {#if a.test_failures && a.test_failures.length > 0}
                <ul class="test-failures">
                  {#each a.test_failures as t, i (i)}
                    <li>{t}</li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ol>
      </div>
    </div>
  {/if}
</div>

<style>
  .quar-card {
    margin: 0.5em 0;
    border: 1px solid var(--vscode-panel-border, #444);
    border-left: 3px solid var(--vscode-editorWarning-foreground, #cca700);
    background: var(--vscode-editor-background, #1e1e1e);
  }
  .quar-card.status-rescued { border-left-color: var(--vscode-testing-iconPassed, #73c991); }
  .quar-card.status-terminally_deferred { border-left-color: var(--vscode-errorForeground, #f88); }

  .header {
    display: flex; align-items: center; gap: 0.5em; width: 100%;
    padding: 0.5em 0.75em; background: transparent; border: none;
    color: var(--vscode-foreground, inherit); cursor: pointer;
    font-family: inherit; font-size: inherit; text-align: left;
  }
  .toggle { width: 1em; color: var(--vscode-descriptionForeground, #888); }
  .icon { color: var(--vscode-editorWarning-foreground, #cca700); }
  .label { font-weight: 600; flex: 1; font-family: var(--vscode-editor-font-family, monospace); }
  .meta { color: var(--vscode-descriptionForeground, #888); font-size: 0.85em; }
  .status-chip {
    font-size: 0.7em; padding: 0.05em 0.4em; border-radius: 0.2em;
    text-transform: uppercase; font-weight: 600;
  }
  .status-chip.pending { background: rgba(255, 167, 38, 0.25); color: var(--vscode-editorWarning-foreground, #cca700); }
  .status-chip.rescued { background: rgba(129, 199, 132, 0.25); color: var(--vscode-testing-iconPassed, #73c991); }
  .status-chip.terminal { background: rgba(244, 67, 54, 0.25); color: var(--vscode-errorForeground, #f88); }

  .body { padding: 0 0.75em 0.75em; font-size: 0.85em; }
  .reason {
    margin: 0.5em 0; padding: 0.4em 0.5em;
    background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
    border-left: 2px solid var(--vscode-editorWarning-foreground, #cca700);
  }
  .reason span:first-child { color: var(--vscode-editorWarning-foreground, #cca700); margin-right: 0.3em; font-weight: 600; }
  .row { display: flex; gap: 0.5em; margin: 0.35em 0; align-items: baseline; }
  .row-label { color: var(--vscode-descriptionForeground, #888); min-width: 6em; }
  .row-value.mono { font-family: var(--vscode-editor-font-family, monospace); }

  .section-label {
    font-size: 0.75em; color: var(--vscode-descriptionForeground, #888);
    text-transform: uppercase; letter-spacing: 0.05em; margin: 0.5em 0 0.35em;
  }
  .attempts { list-style: none; padding: 0; margin: 0; }
  .attempt {
    padding: 0.4em 0.5em; margin: 0.25em 0;
    border-left: 2px solid var(--vscode-panel-border, #444);
    background: rgba(127,127,127,0.05);
  }
  .attempt.outcome-passed { border-left-color: var(--vscode-testing-iconPassed, #73c991); }
  .attempt.outcome-execution_failed { border-left-color: var(--vscode-errorForeground, #f88); }
  .attempt.outcome-reasoning_review_failed { border-left-color: var(--vscode-charts-purple, #b392f0); }
  .attempt.outcome-tests_failed { border-left-color: var(--vscode-editorWarning-foreground, #cca700); }
  .attempt-icon { font-weight: 600; margin-right: 0.4em; }
  .attempt-num { font-family: var(--vscode-editor-font-family, monospace); margin-right: 0.5em; color: var(--vscode-descriptionForeground, #888); }
  .attempt-outcome { font-weight: 600; }
  .attempt-files { font-size: 0.75em; color: var(--vscode-descriptionForeground, #888); margin-left: 0.5em; }
  .attempt-error { color: var(--vscode-errorForeground, #f88); margin-top: 0.3em; font-family: var(--vscode-editor-font-family, monospace); font-size: 0.85em; }

  .flaws, .test-failures {
    margin: 0.35em 0 0 1em; padding-left: 1em; font-size: 0.85em;
  }
  .flaw-type { font-family: var(--vscode-editor-font-family, monospace); font-weight: 600; }
  .flaw-severity { color: var(--vscode-descriptionForeground, #888); margin: 0 0.4em; font-size: 0.85em; }
  .flaw.severity-high { color: var(--vscode-errorForeground, #f88); }
  .flaw-desc { color: var(--vscode-descriptionForeground, #ccc); }
  .test-failures { color: var(--vscode-editorWarning-foreground, #cca700); }
</style>
