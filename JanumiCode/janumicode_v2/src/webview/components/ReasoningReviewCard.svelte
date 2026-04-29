<!--
  ReasoningReviewCard — renders a `reasoning_review_record` produced by
  the automated reasoning-review hook. Each review is linked to a single
  reviewed `agent_output` via `derived_from_record_ids` and surfaces:

    - Status (success / parse_error / failed / skipped) + skip reason
    - Reviewer model + duration
    - Concerns sorted HIGH → MEDIUM → LOW with severity chips
    - Overall assessment (one-line summary)

  Advisory only. Never blocks workflow progression — these cards exist
  so the human sees questionable reasoning before scrolling past it. The
  card renders as a compact, inset note when nested inside an
  AgentInvocationCard, and as a standalone card when shown at the top
  level (e.g. when the parent invocation isn't in the current view).
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import type {
    ReasoningReviewConcern,
    ReasoningReviewRecordContent,
    ReasoningReviewSeverity,
  } from '../../lib/types/records';

  interface Props {
    record: SerializedRecord;
    /** When true, renders compact inline form (inside an invocation card). */
    inline?: boolean;
  }

  const { record, inline = false }: Props = $props();

  const content = $derived(record.content as unknown as ReasoningReviewRecordContent);

  let collapsed = $state(true);

  function severityClass(s: ReasoningReviewSeverity): string {
    switch (s) {
      case 'HIGH':   return 'sev-high';
      case 'MEDIUM': return 'sev-medium';
      case 'LOW':    return 'sev-low';
    }
  }

  const headlineCount = $derived(content.has_concerns ? content.concerns.length : 0);
  const highCount = $derived(content.concerns.filter(c => c.severity === 'HIGH').length);
  const mediumCount = $derived(content.concerns.filter(c => c.severity === 'MEDIUM').length);
  const lowCount = $derived(content.concerns.filter(c => c.severity === 'LOW').length);

  function statusLabel(): string {
    switch (content.status) {
      case 'success':     return content.has_concerns ? `${headlineCount} concern${headlineCount === 1 ? '' : 's'}` : 'No concerns';
      case 'parse_error': return 'Reviewer JSON unparseable';
      case 'failed':      return 'Reviewer call failed';
      case 'skipped':     return `Skipped (${content.skip_reason ?? 'unknown'})`;
    }
  }

  function statusClass(): string {
    if (content.status !== 'success') return 'status-warning';
    if (highCount > 0)   return 'status-high';
    if (mediumCount > 0) return 'status-medium';
    if (lowCount > 0)    return 'status-low';
    return 'status-clean';
  }

  function durationLabel(): string {
    if (!content.duration_ms) return '';
    const s = (content.duration_ms / 1000).toFixed(1);
    return `${s}s`;
  }
</script>

<div
  class="review-card"
  class:inline
  class:has-concerns={content.has_concerns}
  data-record-id={record.id}
>
  <button class="review-header" onclick={() => (collapsed = !collapsed)}>
    <span class="review-icon" aria-hidden="true">⊙</span>
    <span class="review-label">Reasoning Review</span>
    <span class="status-pill {statusClass()}">{statusLabel()}</span>
    {#if content.has_concerns}
      {#if highCount > 0}<span class="sev-chip sev-high">{highCount} HIGH</span>{/if}
      {#if mediumCount > 0}<span class="sev-chip sev-medium">{mediumCount} MED</span>{/if}
      {#if lowCount > 0}<span class="sev-chip sev-low">{lowCount} LOW</span>{/if}
    {/if}
    {#if content.reviewer_model}
      <span class="reviewer-model" title="Reviewer model">{content.reviewer_model}</span>
    {/if}
    {#if durationLabel()}
      <span class="duration">{durationLabel()}</span>
    {/if}
    <span class="chevron">{collapsed ? '▸' : '▾'}</span>
  </button>

  {#if !collapsed}
    <div class="review-body">
      {#if content.overall_assessment}
        <div class="assessment">
          <span class="assessment-label">Assessment</span>
          <span class="assessment-text">{content.overall_assessment}</span>
        </div>
      {/if}

      {#if content.error_message}
        <div class="error-message">
          <span class="error-label">Error</span>
          <span class="error-text">{content.error_message}</span>
        </div>
      {/if}

      {#if content.has_concerns}
        <div class="concerns-list">
          {#each content.concerns as concern, i (i)}
            <div class="concern {severityClass(concern.severity)}">
              <div class="concern-header">
                <span class="sev-chip {severityClass(concern.severity)}">{concern.severity}</span>
                <span class="concern-summary">{concern.summary}</span>
              </div>
              {#if concern.detail}
                <div class="concern-detail">{concern.detail}</div>
              {/if}
              {#if concern.location}
                <div class="concern-meta"><span class="meta-label">Location:</span> <span class="meta-text">{concern.location}</span></div>
              {/if}
              {#if concern.recommendation}
                <div class="concern-meta"><span class="meta-label">Recommendation:</span> <span class="meta-text">{concern.recommendation}</span></div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <div class="review-footer">
        <span class="footer-meta">reviewed agent: {content.reviewed_agent_role ?? 'unknown'}</span>
        {#if content.reviewed_phase_id || content.reviewed_sub_phase_id}
          <span class="footer-meta">phase: {content.reviewed_phase_id ?? '?'}/{content.reviewed_sub_phase_id ?? '?'}</span>
        {/if}
        {#if content.retry_attempts > 0}
          <span class="footer-meta">retries: {content.retry_attempts}</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .review-card {
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 4px;
    background: var(--vscode-editor-background, #1e1e1e);
    margin: 0.4rem 0;
    font-size: 0.85rem;
  }
  .review-card.inline {
    margin: 0.25rem 0 0.25rem 1rem;
    background: var(--vscode-editorWidget-background, #252526);
    border-left: 3px solid var(--vscode-charts-blue, #4ec9b0);
  }
  .review-card.has-concerns.inline {
    border-left-color: var(--vscode-editorWarning-foreground, #cca700);
  }
  .review-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
    color: var(--vscode-foreground, #cccccc);
    font-family: inherit;
    font-size: inherit;
  }
  .review-header:hover {
    background: var(--vscode-list-hoverBackground, #2a2d2e);
  }
  .review-icon {
    color: var(--vscode-charts-blue, #4ec9b0);
    font-size: 0.9rem;
  }
  .review-label {
    font-weight: 600;
    color: var(--vscode-foreground, #cccccc);
  }
  .status-pill {
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  .status-clean {
    background: var(--vscode-charts-green, #4ec9b0);
    color: var(--vscode-editor-background, #1e1e1e);
  }
  .status-low {
    background: var(--vscode-charts-blue, #569cd6);
    color: var(--vscode-editor-background, #1e1e1e);
  }
  .status-medium {
    background: var(--vscode-editorWarning-foreground, #cca700);
    color: var(--vscode-editor-background, #1e1e1e);
  }
  .status-high {
    background: var(--vscode-errorForeground, #f48771);
    color: var(--vscode-editor-background, #1e1e1e);
  }
  .status-warning {
    background: var(--vscode-editorWarning-foreground, #cca700);
    color: var(--vscode-editor-background, #1e1e1e);
  }
  .sev-chip {
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 600;
  }
  .sev-chip.sev-high {
    background: var(--vscode-errorForeground, #f48771);
    color: var(--vscode-editor-background, #1e1e1e);
  }
  .sev-chip.sev-medium {
    background: var(--vscode-editorWarning-foreground, #cca700);
    color: var(--vscode-editor-background, #1e1e1e);
  }
  .sev-chip.sev-low {
    background: var(--vscode-charts-blue, #569cd6);
    color: var(--vscode-editor-background, #1e1e1e);
  }
  .reviewer-model {
    color: var(--vscode-descriptionForeground, #999);
    font-size: 0.75rem;
    margin-left: auto;
  }
  .duration {
    color: var(--vscode-descriptionForeground, #999);
    font-size: 0.75rem;
  }
  .chevron {
    color: var(--vscode-descriptionForeground, #999);
    font-size: 0.7rem;
  }
  .review-body {
    padding: 0.4rem 0.7rem 0.6rem;
    border-top: 1px solid var(--vscode-panel-border, #333);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .assessment, .error-message {
    display: flex;
    gap: 0.5rem;
    font-size: 0.83rem;
  }
  .assessment-label, .error-label {
    color: var(--vscode-descriptionForeground, #999);
    font-weight: 600;
    min-width: 7em;
  }
  .error-label {
    color: var(--vscode-errorForeground, #f48771);
  }
  .concerns-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .concern {
    border-left: 3px solid var(--vscode-panel-border, #333);
    padding: 0.3rem 0.5rem;
    background: var(--vscode-editorWidget-background, #252526);
    border-radius: 0 3px 3px 0;
  }
  .concern.sev-high {
    border-left-color: var(--vscode-errorForeground, #f48771);
  }
  .concern.sev-medium {
    border-left-color: var(--vscode-editorWarning-foreground, #cca700);
  }
  .concern.sev-low {
    border-left-color: var(--vscode-charts-blue, #569cd6);
  }
  .concern-header {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
  }
  .concern-summary {
    font-weight: 500;
  }
  .concern-detail {
    margin-top: 0.25rem;
    color: var(--vscode-descriptionForeground, #cccccc);
    font-size: 0.82rem;
  }
  .concern-meta {
    margin-top: 0.2rem;
    font-size: 0.78rem;
  }
  .meta-label {
    color: var(--vscode-descriptionForeground, #999);
    font-weight: 600;
  }
  .meta-text {
    color: var(--vscode-foreground, #cccccc);
  }
  .review-footer {
    display: flex;
    gap: 0.8rem;
    color: var(--vscode-descriptionForeground, #999);
    font-size: 0.72rem;
    border-top: 1px dashed var(--vscode-panel-border, #333);
    padding-top: 0.3rem;
  }
</style>
