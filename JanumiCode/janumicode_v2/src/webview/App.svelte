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
  import { phaseStore } from './stores/phase.svelte';
  import { activityStore } from './stores/activity.svelte';
  import { streamingStore } from './stores/streaming.svelte';
  import type { PhaseId } from '../lib/types/records';
  import Card from './components/Card.svelte';
  import VirtualScroll from './components/VirtualScroll.svelte';
  import IntentComposer from './components/IntentComposer.svelte';
  import PhaseIndicator from './components/PhaseIndicator.svelte';
  import ActivityStrip from './components/ActivityStrip.svelte';
  import { scrollToPhase } from './scroll';

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
  // Buffer for paginated snapshot delivery — accumulates records across
  // snapshotChunk messages until snapshotComplete commits them in one
  // setSnapshot call (so conversationalSort runs once, not per page).
  let snapshotBuffer: SerializedRecord[] = [];
  let snapshotInProgress = false;

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
        phaseStore.reset();
        // A fresh snapshot supersedes any in-flight buffers from a prior
        // session — buffers are transient and should not survive reload.
        streamingStore.reset();
        if (autoScroll) scrollToBottom();
        break;
      case 'snapshotStart':
        // Begin a paginated snapshot. Reset stores and accumulate batches
        // into a buffer; finalize on snapshotComplete to keep the in-store
        // resort cost (conversationalSort) to a single pass.
        recordsStore.clear();
        streamingStore.reset();
        snapshotBuffer = [];
        snapshotInProgress = true;
        break;
      case 'snapshotChunk':
        if (snapshotInProgress) {
          snapshotBuffer.push(...(message.records as SerializedRecord[]));
        }
        break;
      case 'snapshotComplete':
        if (snapshotInProgress) {
          recordsStore.setSnapshot(snapshotBuffer);
          snapshotBuffer = [];
          snapshotInProgress = false;
          composerStore.endSubmit();
          phaseStore.reset();
          if (autoScroll) scrollToBottom();
        }
        break;
      case 'streamChunk': {
        const payload = message.payload as {
          invocationId: string;
          channel: 'response' | 'thinking' | 'stdout' | 'stderr';
          text: string;
        };
        streamingStore.append(payload.invocationId, payload.channel, payload.text);
        break;
      }
      case 'phaseUpdate': {
        const payload = message.payload as {
          phaseId?: string;
          subPhaseId?: string;
          completedPhases?: string[];
          completedSubPhases?: string[];
          skippedSubPhases?: string[];
          status?: 'active' | 'paused' | 'completed' | 'failed';
          workflowRunId?: string;
        };
        phaseStore.update({
          currentPhaseId: (payload.phaseId as PhaseId) ?? null,
          currentSubPhaseId: payload.subPhaseId ?? null,
          completedPhases: (payload.completedPhases as PhaseId[]) ?? [],
          completedSubPhases: payload.completedSubPhases ?? [],
          skippedSubPhases: payload.skippedSubPhases ?? [],
          status: payload.status ?? 'active',
          workflowRunId: payload.workflowRunId ?? phaseStore.state.workflowRunId,
        });
        // Keep composerStore in sync for mode detection
        if (payload?.phaseId) composerStore.currentPhase = payload.phaseId;
        break;
      }
      case 'contextUpdate':
        composerStore.contextSummary = message.summary as never;
        break;
      case 'llmStatus': {
        const event = message.event as 'queued' | 'started' | 'finished';
        const payload = message.payload as {
          provider?: string;
          lane?: 'phase' | 'user_query';
          queueDepth?: number;
          label?: string | null;
          agentRole?: string | null;
          subPhaseId?: string | null;
        };
        if (event === 'queued') {
          if (typeof payload.queueDepth === 'number') {
            composerStore.llmQueueDepth = payload.queueDepth;
            activityStore.handleQueued(payload.queueDepth);
          }
        } else if (event === 'started') {
          activityStore.handleStarted({
            provider: payload.provider ?? '?',
            lane: payload.lane ?? 'phase',
            label: payload.label ?? null,
            agentRole: payload.agentRole ?? null,
            subPhaseId: payload.subPhaseId ?? null,
          });
        } else if (event === 'finished') {
          composerStore.llmQueueDepth = Math.max(0, composerStore.llmQueueDepth - 1);
          activityStore.handleFinished({
            label: payload.label ?? null,
            agentRole: payload.agentRole ?? null,
          });
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
          derived_from_record_ids: [],
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

  function handleNavigateToPhase(phaseId: PhaseId) {
    if (containerEl) {
      scrollToPhase(containerEl, phaseId);
    }
  }

  onMount(() => {
    window.addEventListener('message', handleMessage);
    post({ type: 'webviewReady' });
    return () => window.removeEventListener('message', handleMessage);
  });
</script>

<div class="root">
  <PhaseIndicator onNavigateToPhase={handleNavigateToPhase} />
  <ActivityStrip />
  <div class="stream" bind:this={containerEl} onscroll={handleScroll}>
    {#if recordsStore.records.length === 0}
      <div class="empty-state">
        <h2>JanumiCode v2</h2>
        <p>Governed Stream — Ready</p>
        <p class="hint">Type your intent below to start a new workflow.</p>
      </div>
    {:else if recordsStore.records.length > 200}
      <VirtualScroll items={recordsStore.records} estimatedItemHeight={120} bufferCount={10}>
        {#snippet children({ item })}
          <Card record={item} ondecision={handleDecision} {vscode} />
        {/snippet}
      </VirtualScroll>
    {:else}
      {#each recordsStore.records as record (record.id)}
        <Card {record} ondecision={handleDecision} {vscode} />
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
    background: var(--jc-surface);
  }
  .stream {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--jc-space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--jc-space-lg);
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: calc(var(--jc-space-2xl) * 2) var(--jc-space-2xl);
    min-height: 200px;
  }
  .empty-state h2 {
    margin: 0 0 var(--jc-space-md);
    font-family: var(--jc-font-headline);
    font-size: 1.4em;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--jc-on-surface);
  }
  .empty-state p {
    margin: 0;
    font-size: 0.85em;
    color: var(--jc-on-surface-variant);
  }
  .empty-state .hint {
    margin-top: var(--jc-space-xl);
    font-size: 0.75em;
    color: var(--jc-outline);
  }

  .jump-to-latest {
    position: sticky;
    bottom: 12px;
    align-self: center;
    padding: var(--jc-space-md) var(--jc-space-2xl);
    border-radius: var(--jc-radius-sm);
    border: var(--jc-ghost-border);
    background: var(--jc-surface-container-highest);
    color: var(--jc-primary);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-size: 0.7em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    z-index: 10;
    transition: background var(--jc-transition-base);
  }
  .jump-to-latest:hover {
    background: var(--jc-surface-bright);
  }
</style>
