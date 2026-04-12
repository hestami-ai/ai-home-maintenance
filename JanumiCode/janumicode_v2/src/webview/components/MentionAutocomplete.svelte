<!--
  MentionAutocomplete — overlay dropdown for @mention candidates.
  Spec FR-3. Triggered by IntentComposer when the cursor is on or after a `@`.
-->
<script lang="ts">
  import type { MentionCandidate } from '../stores/composer.svelte';

  interface Props {
    open: boolean;
    candidates: MentionCandidate[];
    activeIndex: number;
    onSelect: (candidate: MentionCandidate) => void;
    onClose: () => void;
  }

  const { open, candidates, activeIndex, onSelect, onClose }: Props = $props();
</script>

{#if open && candidates.length > 0}
  <div class="autocomplete" role="listbox" aria-label="Mention candidates">
    {#each candidates as c, i (c.id)}
      <button
        type="button"
        class="item"
        class:active={i === activeIndex}
        role="option"
        aria-selected={i === activeIndex}
        onclick={() => onSelect(c)}
      >
        <span class="type">{c.type}</span>
        <span class="label">{c.label}</span>
        {#if c.detail}
          <span class="detail">{c.detail}</span>
        {/if}
      </button>
    {/each}
    <button type="button" class="close" onclick={onClose} aria-label="Close autocomplete">✕</button>
  </div>
{/if}

<style>
  .autocomplete {
    position: absolute;
    bottom: 100%;
    left: 8px;
    right: 8px;
    margin-bottom: 4px;
    max-height: 240px;
    overflow-y: auto;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-panel-border, #444);
    border-radius: 4px;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    background: transparent;
    color: var(--vscode-foreground);
    border: none;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85em;
  }
  .item:hover, .item.active {
    background: var(--vscode-list-activeSelectionBackground);
  }
  .type {
    font-size: 0.75em;
    opacity: 0.6;
    text-transform: uppercase;
    min-width: 60px;
  }
  .label { font-weight: bold; }
  .detail {
    font-size: 0.75em;
    opacity: 0.6;
    margin-left: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }
  .close {
    width: 100%;
    background: transparent;
    color: var(--vscode-foreground);
    border: none;
    border-top: 1px solid var(--vscode-panel-border, #444);
    padding: 4px;
    cursor: pointer;
    opacity: 0.5;
    font-size: 0.7em;
  }
</style>
