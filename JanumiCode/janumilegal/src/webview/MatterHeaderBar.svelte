<script lang="ts">
  import type { MatterContextPayload } from './types.js';

  let { context }: { context: MatterContextPayload | null } = $props();
</script>

{#if context}
  <header
    class="matter-header"
    style="--matter-color: #{context.colorHashHex}"
    aria-label="Active matter header"
  >
    <span class="client">{context.clientName}</span>
    <span class="sep">›</span>
    <span class="matter">{context.matterName}</span>
    <span class="sep">›</span>
    <span class="lens">
      {#if context.activeLens}
        {context.activeLens.lensId}@{context.activeLens.lensVersion}
      {:else}
        (no active lens)
      {/if}
    </span>
    {#if context.proceduralPosture}
      <span class="sep">›</span>
      <span class="posture">{context.proceduralPosture}</span>
    {/if}
    {#if context.readOnly}
      <span class="badge read-only">read-only</span>
    {/if}
  </header>
{:else}
  <header class="matter-header empty" aria-label="No active matter">
    <span>No active matter</span>
  </header>
{/if}

<style>
  .matter-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 3px solid var(--matter-color, #888);
    font-family: var(--vscode-font-family, sans-serif);
    font-size: 0.85rem;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #ddd);
  }
  .matter-header.empty {
    border-bottom-color: #555;
    color: #888;
  }
  .client { font-weight: 600; }
  .matter { font-weight: 500; }
  .lens { opacity: 0.85; font-style: italic; }
  .posture { opacity: 0.85; }
  .sep { opacity: 0.5; }
  .badge.read-only {
    margin-left: auto;
    background: #444;
    color: #fff;
    padding: 0.1rem 0.4rem;
    border-radius: 0.2rem;
    font-size: 0.7rem;
  }
</style>
