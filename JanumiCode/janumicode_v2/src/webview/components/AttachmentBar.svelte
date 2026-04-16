<!--
  AttachmentBar — horizontal scrollable file chips above the composer.
  Spec FR-2. Supports both the [+ Attach] picker and drag-drop from the explorer.
-->
<script lang="ts">
  import type { Attachment } from '../stores/composer.svelte';

  interface Props {
    attachments: Attachment[];
    onPick: () => void;
    onRemove: (uri: string) => void;
    onDropFiles: (uris: string[]) => void;
  }

  const { attachments, onPick, onRemove, onDropFiles }: Props = $props();

  let dragOver = $state(false);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (!e.dataTransfer) return;
    const uriList = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (uriList) {
      const uris = uriList.split(/\r?\n/).filter(line => line && !line.startsWith('#'));
      onDropFiles(uris);
    }
  }
</script>

<div
  class="attachment-bar"
  class:drag-over={dragOver}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="region"
  aria-label="Attached files"
>
  <button class="attach-btn" onclick={onPick} aria-label="Attach files" title="Attach files (Ctrl+K)">
    + Attach
  </button>
  {#each attachments as a (a.uri)}
    <span class="chip" role="button" aria-label="Attached file {a.name} — press to remove">
      <span class="chip-icon">📄</span>
      <span class="chip-name">{a.name}</span>
      <button
        class="chip-remove"
        onclick={() => onRemove(a.uri)}
        aria-label="Remove attachment"
      >×</button>
    </span>
  {/each}
</div>

<style>
  .attachment-bar {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    padding: var(--jc-space-sm) var(--jc-space-md);
    overflow-x: auto;
    border-bottom: 1px solid var(--vscode-panel-border, var(--jc-outline-variant));
    scrollbar-width: thin;
  }
  .attachment-bar.drag-over {
    background: var(--vscode-list-dropBackground, var(--jc-primary-tint-medium));
  }
  .attach-btn {
    flex-shrink: 0;
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px dashed var(--vscode-panel-border, var(--jc-outline));
    border-radius: var(--jc-radius-pill);
    padding: var(--jc-space-xs) var(--jc-space-lg);
    cursor: pointer;
    font-size: 0.75em;
    font-family: inherit;
  }
  .attach-btn:hover {
    background: var(--vscode-list-hoverBackground);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--jc-space-sm);
    background: var(--vscode-badge-background, var(--jc-surface-container-highest));
    color: var(--vscode-badge-foreground, var(--jc-on-surface));
    padding: var(--jc-space-xs) var(--jc-space-md) var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-pill);
    font-size: 0.75em;
    flex-shrink: 0;
    max-width: 200px;
  }
  .chip-icon { font-size: 0.9em; }
  .chip-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip-remove {
    background: transparent;
    color: inherit;
    border: none;
    padding: 0 var(--jc-space-xs);
    cursor: pointer;
    font-size: 1em;
    line-height: 1;
  }
  .chip-remove:hover { opacity: 1; }
</style>
