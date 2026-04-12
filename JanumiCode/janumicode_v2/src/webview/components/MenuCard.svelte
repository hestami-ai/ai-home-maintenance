<!--
  MenuCard — renders a Menu with selectable options.
  Based on JanumiCode Spec v2.3, §17.3.

  Supports: single-select buttons, multi-select checkboxes, free-text textarea.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';

  interface Props {
    record: SerializedRecord;
    ondecision?: (detail: {
      recordId: string;
      decision: { type: string; payload?: Record<string, unknown> };
    }) => void;
  }

  const { record, ondecision }: Props = $props();

  const content = $derived(record.content as Record<string, unknown>);
  const question = $derived((content.question as string) ?? 'Select an option:');
  const options = $derived(
    (content.options as { id: string; label: string; description?: string }[]) ?? [],
  );
  const multiSelect = $derived((content.multi_select as boolean) ?? false);
  const allowFreeText = $derived(content.allow_free_text as boolean | undefined);

  // SvelteSet would also work; plain Set + reassignment is fine for small option lists.
  let selectedOptions = $state<Set<string>>(new Set());
  let freeText = $state('');

  function selectOption(optionId: string) {
    if (multiSelect) {
      const next = new Set(selectedOptions);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      selectedOptions = next;
    } else {
      ondecision?.({
        recordId: record.id,
        decision: { type: 'menu_selection', payload: { selected: optionId } },
      });
    }
  }

  function submitMultiSelect() {
    ondecision?.({
      recordId: record.id,
      decision: { type: 'menu_selection', payload: { selected: Array.from(selectedOptions) } },
    });
  }

  function submitFreeText() {
    ondecision?.({
      recordId: record.id,
      decision: { type: 'menu_selection', payload: { text: freeText } },
    });
  }
</script>

<div class="menu-card">
  <div class="menu-question">{question}</div>

  <div class="menu-options">
    {#each options as option (option.id)}
      <button
        class="menu-option"
        class:selected={selectedOptions.has(option.id)}
        onclick={() => selectOption(option.id)}
      >
        {#if multiSelect}
          <input type="checkbox" checked={selectedOptions.has(option.id)} />
        {/if}
        <span class="option-label">{option.label}</span>
        {#if option.description}
          <span class="option-desc">{option.description}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if multiSelect}
    <button class="btn-submit" onclick={submitMultiSelect}>
      Submit ({selectedOptions.size} selected)
    </button>
  {/if}

  {#if allowFreeText}
    <div class="free-text">
      <textarea bind:value={freeText} placeholder="Or type your response..."></textarea>
      <button class="btn-submit" onclick={submitFreeText}>Submit</button>
    </div>
  {/if}
</div>

<style>
  .menu-card {
    border: 1px solid var(--vscode-panel-border, #333);
    border-left: 3px solid var(--vscode-terminal-ansiBlue, #569cd6);
    border-radius: 4px;
    padding: 10px;
  }

  .menu-question {
    font-weight: bold;
    margin-bottom: 8px;
  }

  .menu-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .menu-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 3px;
    cursor: pointer;
    text-align: left;
    color: var(--vscode-foreground);
    font-family: inherit;
  }

  .menu-option:hover {
    background: var(--vscode-list-hoverBackground);
  }

  .menu-option.selected {
    border-color: var(--vscode-focusBorder);
    background: var(--vscode-list-activeSelectionBackground);
  }

  .option-label { font-weight: bold; font-size: 0.9em; }
  .option-desc { opacity: 0.7; font-size: 0.8em; }

  .btn-submit {
    margin-top: 8px;
    padding: 4px 16px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    cursor: pointer;
  }

  .free-text { margin-top: 8px; }
  .free-text textarea {
    width: 100%;
    min-height: 60px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
    padding: 6px;
    font-family: inherit;
    resize: vertical;
  }
</style>
