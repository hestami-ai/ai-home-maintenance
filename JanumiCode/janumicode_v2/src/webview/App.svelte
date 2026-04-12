<!--
  JanumiCode v2 — Root Svelte 5 Component (Wave 5).

  Layout:
    [stream area — flex 1, scrollable]
    [IntentComposer — flex none, pinned to bottom]

  Receives JSON records and protocol messages from the extension host;
  routes them to recordsStore / composerStore / pending callbacks.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { recordsStore, type SerializedRecord } from './stores/records.svelte';
  import { composerStore } from './stores/composer.svelte';
  import Card from './components/Card.svelte';
  import IntentComposer from './components/IntentComposer.svelte';

  interface Props {
    vscode: {
      postMessage(message: unknown): void;
      getState(): unknown;
      setState(state: unknown): void;
    };
  }

  const { vscode }: Props = $props();

  let containerEl = $state<HTMLElement | null>(null);
  let autoScroll = $state(true);

  // ── Message Handler ─────────────────────────────────────────
  function handleMessage(event: MessageEvent) {
    const message = event.data as { type: string; [key: string]: unknown };

    switch (message.type) {
      case 'addRecord':
        recordsStore.add(message.record as SerializedRecord);
        // If a client_liaison_response just landed, unlock the composer.
        if ((message.record as SerializedRecord).record_type === 'client_liaison_response') {
          composerStore.endSubmit();
        }
        if (autoScroll) scrollToBottom();
        break;
      case 'updateRecord':
        recordsStore.update(
          message.id as string,
          message.fields as Partial<SerializedRecord>,
        );
        break;
      case 'snapshot':
        recordsStore.setSnapshot(message.records as SerializedRecord[]);
        composerStore.endSubmit();
        if (autoScroll) scrollToBottom();
        break;
      case 'phaseUpdate': {
        const payload = message.payload as { phaseId?: string };
        if (payload?.phaseId) composerStore.currentPhase = payload.phaseId;
        break;
      }
      case 'contextUpdate':
        composerStore.contextSummary = message.summary as never;
        break;
      case 'llmStatus': {
        const event = message.event as 'queued' | 'started' | 'finished';
        const payload = message.payload as { queueDepth?: number };
        if (event === 'queued' && typeof payload.queueDepth === 'number') {
          composerStore.llmQueueDepth = payload.queueDepth;
        } else if (event === 'finished') {
          composerStore.llmQueueDepth = Math.max(0, composerStore.llmQueueDepth - 1);
        }
        break;
      }
      case 'error': {
        // Append a synthetic error card.
        recordsStore.add({
          id: `error-${Date.now()}`,
          record_type: 'error',
          phase_id: null,
          sub_phase_id: null,
          produced_by_agent_role: null,
          produced_at: new Date().toISOString(),
          authority_level: 1,
          quarantined: false,
          content: { text: String(message.message ?? 'Unknown error'), context: message.context },
        });
        composerStore.endSubmit();
        break;
      }
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (containerEl) {
        containerEl.scrollTop = containerEl.scrollHeight;
      }
    });
  }

  function handleScroll() {
    if (!containerEl) return;
    const { scrollTop, scrollHeight, clientHeight } = containerEl;
    autoScroll = scrollHeight - scrollTop - clientHeight < 50;
  }

  function jumpToLatest() {
    autoScroll = true;
    scrollToBottom();
  }

  /**
   * Svelte 5 `$state` wraps arrays and objects in Proxies. VS Code's webview
   * postMessage uses structured cloning under the hood, which rejects Proxies
   * with `DataCloneError: [object Array] could not be cloned.` Route every
   * outbound payload through JSON round-trip so we ship plain data across
   * the MessagePort regardless of how reactive the source was.
   */
  function post(message: Record<string, unknown>): void {
    vscode.postMessage(JSON.parse(JSON.stringify(message)));
  }

  function handleDecision(detail: {
    recordId: string;
    decision: { type: string; payload?: Record<string, unknown> };
  }) {
    post({
      type: 'decision',
      recordId: detail.recordId,
      decision: { ...detail.decision, recordId: detail.recordId },
    });
  }

  onMount(() => {
    window.addEventListener('message', handleMessage);
    post({ type: 'webviewReady' });
    return () => window.removeEventListener('message', handleMessage);
  });
</script>

<div class="root">
  <div class="stream" bind:this={containerEl} onscroll={handleScroll}>
    {#if recordsStore.records.length === 0}
      <div class="empty-state">
        <h2>JanumiCode v2</h2>
        <p>Governed Stream — Ready</p>
        <p class="hint">Type your intent below to start a new workflow.</p>
      </div>
    {:else}
      {#each recordsStore.records as record (record.id)}
        <Card {record} ondecision={handleDecision} />
      {/each}
    {/if}

    {#if !autoScroll && recordsStore.records.length > 0}
      <button class="jump-to-latest" onclick={jumpToLatest}>
        ↓ Jump to latest
      </button>
    {/if}
  </div>

  <IntentComposer {vscode} />
</div>

<style>
  .root {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .stream {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .empty-state {
    text-align: center;
    padding: 32px 16px;
    opacity: 0.6;
  }
  .empty-state h2 { margin: 0 0 8px; font-size: 1.1em; }
  .empty-state p { margin: 0; font-size: 0.9em; }
  .empty-state .hint { margin-top: 16px; font-size: 0.8em; opacity: 0.7; }

  .jump-to-latest {
    position: sticky;
    bottom: 8px;
    align-self: center;
    padding: 6px 16px;
    border-radius: 16px;
    border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    cursor: pointer;
    font-size: 0.8em;
    z-index: 10;
  }
  .jump-to-latest:hover {
    background: var(--vscode-button-hoverBackground);
  }
</style>
