<!--
  MenuCard — renders a Menu with selectable option cards.
  Matches v1's MMP menu pattern from mmpRenderer.ts lines 192-265.

  Features:
    - Single-select (radio) or multi-select (checkbox) per menu item
    - Option cards with label, recommended ★ badge, description, tradeoffs
    - "Other" option with free-text textarea (when allowCustom is set)
    - Context subsection below the question (optional)
    - Submit button for multi-select with selection count
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { decisionStagingStore } from '../stores/decisionStaging.svelte';

  interface MenuOption {
    id: string;
    label: string;
    description?: string;
    tradeoffs?: string;
    recommended?: boolean;
  }

  interface Props {
    record: SerializedRecord;
    ondecision?: (detail: {
      recordId: string;
      decision: { type: string; payload?: Record<string, unknown> };
    }) => void;
    vscode?: { postMessage(message: unknown): void };
  }

  const { record, ondecision, vscode }: Props = $props();

  const content = $derived(record.content as Record<string, unknown>);
  const question = $derived((content.question as string) ?? 'Select an option:');
  const context = $derived((content.context as string) ?? '');
  const options = $derived((content.options as MenuOption[]) ?? []);
  const multiSelect = $derived((content.multi_select as boolean) ?? false);
  const allowCustom = $derived((content.allow_free_text as boolean) || (content.allowCustom as boolean) || false);

  let selectedOptions = $state<Set<string>>(new Set());
  let freeText = $state('');
  let showCustom = $state(false);

  function selectOption(optionId: string) {
    if (optionId === '_OTHER') {
      showCustom = true;
      return;
    }
    showCustom = false;
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
    if (vscode) {
      // Batched submission: stage each selected option then submit the batch.
      for (const optionId of selectedOptions) {
        decisionStagingStore.stage(record.id, { itemId: optionId, action: 'accepted' });
      }
      decisionStagingStore.submit(record.id, vscode);
    } else {
      // Fallback: dispatch as single decision via ondecision.
      ondecision?.({
        recordId: record.id,
        decision: { type: 'menu_selection', payload: { selected: Array.from(selectedOptions) } },
      });
    }
  }

  function submitFreeText() {
    if (vscode) {
      decisionStagingStore.stage(record.id, { itemId: '_OTHER', action: 'accepted', payload: { text: freeText } });
      decisionStagingStore.submit(record.id, vscode);
    } else {
      ondecision?.({
        recordId: record.id,
        decision: { type: 'menu_selection', payload: { text: freeText, selected: '_OTHER' } },
      });
    }
  }
</script>

<div class="menu-card">
  <div class="menu-header">
    <span class="menu-icon">📋</span>
    <span class="menu-title">Menu — Decisions needed</span>
  </div>

  <div class="menu-body">
    <div class="menu-question">{question}</div>
    {#if context}
      <div class="menu-context">{context}</div>
    {/if}

    <div class="menu-options">
      {#each options as option (option.id)}
        <button
          class="option-card"
          class:selected={selectedOptions.has(option.id)}
          class:recommended={option.recommended}
          onclick={() => selectOption(option.id)}
        >
          <div class="option-header">
            <span class="option-radio">{multiSelect ? (selectedOptions.has(option.id) ? '☑' : '☐') : '○'}</span>
            <span class="option-label">{option.label}</span>
            {#if option.recommended}
              <span class="option-recommended-badge">★ Recommended</span>
            {/if}
          </div>
          {#if option.description}
            <div class="option-description">{option.description}</div>
          {/if}
          {#if option.tradeoffs}
            <div class="option-tradeoffs">Tradeoff: {option.tradeoffs}</div>
          {/if}
        </button>
      {/each}

      {#if allowCustom}
        <button
          class="option-card other-option"
          class:selected={showCustom}
          onclick={() => selectOption('_OTHER')}
        >
          <div class="option-header">
            <span class="option-radio">{showCustom ? '◉' : '○'}</span>
            <span class="option-label">Other</span>
          </div>
          {#if showCustom}
            <textarea
              class="custom-textarea"
              bind:value={freeText}
              placeholder="Describe your preference..."
              rows="2"
            ></textarea>
          {/if}
        </button>
      {/if}
    </div>

    {#if multiSelect}
      <button class="btn-submit" onclick={submitMultiSelect}>
        Submit ({selectedOptions.size} selected)
      </button>
    {/if}

    {#if showCustom && freeText.trim().length > 0}
      <button class="btn-submit" onclick={submitFreeText}>Submit custom response</button>
    {/if}
  </div>
</div>

<style>
  .menu-card {
    border: 1px solid var(--vscode-panel-border, #333);
    border-left: 3px solid var(--vscode-terminal-ansiBlue, #569cd6);
    border-radius: 4px;
    overflow: hidden;
  }

  .menu-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--vscode-editor-background);
    font-weight: bold;
    font-size: 0.9em;
  }
  .menu-title { flex: 1; }

  .menu-body { padding: 8px 10px; }

  .menu-question {
    font-weight: bold;
    margin-bottom: 6px;
    font-size: 0.9em;
  }

  .menu-context {
    font-size: 0.8em;
    opacity: 0.7;
    margin-bottom: 8px;
  }

  .menu-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .option-card {
    display: block;
    width: 100%;
    padding: 8px 10px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    color: var(--vscode-foreground);
    font-family: inherit;
  }
  .option-card:hover {
    background: var(--vscode-list-hoverBackground);
  }
  .option-card.selected {
    border-color: var(--vscode-focusBorder);
    background: var(--vscode-list-activeSelectionBackground);
  }
  .option-card.recommended {
    border-color: var(--vscode-charts-yellow, #dcdcaa);
  }

  .option-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .option-radio {
    font-size: 1em;
    flex-shrink: 0;
    opacity: 0.6;
  }
  .option-label {
    font-weight: bold;
    font-size: 0.9em;
    flex: 1;
  }
  .option-recommended-badge {
    font-size: 0.7em;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--vscode-charts-yellow, #dcdcaa);
    color: #222;
    flex-shrink: 0;
  }
  .option-description {
    font-size: 0.8em;
    opacity: 0.75;
    margin-top: 4px;
    padding-left: 22px;
  }
  .option-tradeoffs {
    font-size: 0.75em;
    opacity: 0.6;
    margin-top: 2px;
    padding-left: 22px;
    font-style: italic;
  }

  .other-option .custom-textarea {
    width: 100%;
    margin-top: 6px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
    padding: 6px;
    font-family: inherit;
    resize: vertical;
  }

  .btn-submit {
    margin-top: 8px;
    padding: 4px 16px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-submit:hover { background: var(--vscode-button-hoverBackground); }
</style>
