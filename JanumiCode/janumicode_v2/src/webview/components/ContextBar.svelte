<!--
  ContextBar — compact context indicators above the composer.
  Spec FR-4. Renders only when at least one indicator has content.
-->
<script lang="ts">
  import type { ContextSummary } from '../stores/composer.svelte';

  interface Props {
    summary: ContextSummary | null;
  }

  const { summary }: Props = $props();

  const visible = $derived(
    !!summary &&
      ((summary.activeFile && summary.activeFile.length > 0) ||
        summary.constraintCount > 0 ||
        summary.referenceCount > 0),
  );
</script>

{#if visible && summary}
  <div class="context-bar" role="status" aria-live="polite">
    {#if summary.activeFile}
      <span class="indicator" title="Active file">
        📄 {summary.activeFile}
      </span>
    {/if}
    {#if summary.constraintCount > 0}
      <span class="indicator">
        🔒 {summary.constraintCount} constraint{summary.constraintCount === 1 ? '' : 's'}
      </span>
    {/if}
    {#if summary.referenceCount > 0}
      <span class="indicator">
        📎 {summary.referenceCount} reference{summary.referenceCount === 1 ? '' : 's'}
      </span>
    {/if}
  </div>
{/if}

<style>
  .context-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 4px 10px;
    font-size: 0.75em;
    opacity: 0.7;
    border-bottom: 1px solid var(--vscode-panel-border, #333);
  }
  .indicator {
    background: var(--vscode-badge-background, #333);
    color: var(--vscode-badge-foreground, #ddd);
    padding: 1px 6px;
    border-radius: 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }
</style>
