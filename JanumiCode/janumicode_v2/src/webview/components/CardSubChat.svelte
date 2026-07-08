<!--
  CardSubChat — a per-item sub-chat embedded in a card (ports the v1
  per-line-item feedback affordance). It is the SAME liaison and the SAME
  governed stream as the main chat, but scoped: every turn posts with
  `threadId = card:<recordId>` and an `anchor`, so retrieval is pre-seeded to
  this item, history stays scoped to this card, and the turn records render
  here (suppressed from the top-level stream) rather than in the main feed.

  Mode 1 (ASK) is implemented here as free-text questions. REFINE/REGENERATE
  and AUTHOR reuse the same surface and land as later increments.
-->
<script lang="ts">
  import { recordsStore, type SerializedRecord } from '../stores/records.svelte';

  interface Props {
    /** The governed_stream record id of the anchored item. */
    recordId: string;
    /** Anchor discriminator (e.g. 'user_journey', 'requirement_node'). */
    anchorKind?: string;
    vscode?: { postMessage(message: unknown): void };
  }
  const { recordId, anchorKind, vscode }: Props = $props();

  const threadId = $derived(`card:${recordId}`);

  // This card's sub-thread turns, chronological. Reads the reactive window;
  // the anchored turn records arrive via the normal snapshot/live-append path.
  const turns = $derived(
    recordsStore.records
      .filter((r) => (r.content as { thread_id?: unknown }).thread_id === threadId)
      .slice()
      .sort((a, b) => a.produced_at.localeCompare(b.produced_at)),
  );

  let text = $state('');
  let open = $state(false);
  let submitting = $state(false);

  function isUser(r: SerializedRecord): boolean {
    return r.record_type === 'open_query_received' || r.record_type === 'raw_intent_received';
  }
  function bubbleText(r: SerializedRecord): string {
    const c = r.content as { text?: string; response_text?: string };
    return (isUser(r) ? c.text : c.response_text) ?? '';
  }

  function post(message: Record<string, unknown>): void {
    // Svelte 5 `$state` proxies can't be structured-cloned across postMessage.
    vscode?.postMessage(JSON.parse(JSON.stringify(message)));
  }

  function send(): void {
    const t = text.trim();
    if (!t || submitting || !vscode) return;
    submitting = true;
    post({
      type: 'submitOpenQuery',
      text: t,
      threadId,
      anchor: { recordId, itemId: recordId, kind: anchorKind },
    });
    text = '';
    // Safety unlock if no response arrives.
    setTimeout(() => (submitting = false), 30_000);
  }

  // Unlock as soon as a new record lands in this thread (the reply).
  let seen = $state(0);
  $effect(() => {
    const n = turns.length;
    if (submitting && n > seen) submitting = false;
    if (!submitting) seen = n;
  });

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<div class="subchat">
  <button class="subchat-toggle" onclick={() => (open = !open)} aria-expanded={open}>
    <span class="subchat-icon">💬</span>
    <span>Ask about this item</span>
    {#if turns.length > 0}<span class="subchat-count">{turns.length}</span>{/if}
    <span class="subchat-caret">{open ? '▼' : '▶'}</span>
  </button>

  {#if open}
    <div class="subchat-body">
      {#if turns.length > 0}
        <div class="subchat-thread">
          {#each turns as turn (turn.id)}
            <div class="subchat-bubble" class:user={isUser(turn)} class:assistant={!isUser(turn)}>
              <span class="subchat-role">{isUser(turn) ? 'You' : 'Liaison'}</span>
              <span class="subchat-text">{bubbleText(turn)}</span>
            </div>
          {/each}
        </div>
      {/if}

      <div class="subchat-input">
        <textarea
          bind:value={text}
          onkeydown={onKeydown}
          placeholder="Ask a question or give feedback about this item…"
          rows="1"
          disabled={submitting}
          aria-label="Ask about this item"
        ></textarea>
        <button class="subchat-send" onclick={send} disabled={!text.trim() || submitting}>
          {submitting ? '…' : 'Ask'}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .subchat {
    margin-top: var(--jc-space-md);
    border-top: var(--jc-ghost-border);
    padding-top: var(--jc-space-sm);
  }
  .subchat-toggle {
    display: flex;
    align-items: center;
    gap: var(--jc-space-sm);
    width: 100%;
    background: transparent;
    border: none;
    color: var(--jc-on-surface-variant);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-size: 0.75em;
    padding: var(--jc-space-xs) 0;
    text-align: left;
  }
  .subchat-toggle:hover { color: var(--jc-primary); }
  .subchat-icon { font-size: 0.9em; }
  .subchat-count {
    background: var(--jc-primary-container-tint-soft);
    color: var(--jc-primary);
    border-radius: var(--jc-radius-xs);
    padding: 0 var(--jc-space-sm);
    font-family: var(--jc-font-mono);
    font-size: 0.9em;
  }
  .subchat-caret { margin-left: auto; font-size: 0.7em; color: var(--jc-outline); }
  .subchat-body { margin-top: var(--jc-space-sm); }
  .subchat-thread {
    display: flex;
    flex-direction: column;
    gap: var(--jc-space-sm);
    margin-bottom: var(--jc-space-md);
  }
  .subchat-bubble {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--jc-space-sm) var(--jc-space-md);
    border-radius: var(--jc-radius-sm);
    font-size: 0.8em;
    line-height: 1.45;
  }
  .subchat-bubble.user {
    background: var(--jc-primary-container-tint-soft);
    align-self: flex-end;
    max-width: 90%;
  }
  .subchat-bubble.assistant {
    background: var(--jc-surface-container-high);
    align-self: flex-start;
    max-width: 95%;
  }
  .subchat-role {
    font-size: 0.7em;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--jc-outline);
    font-family: var(--jc-font-mono);
  }
  .subchat-text { white-space: pre-wrap; word-break: break-word; color: var(--jc-on-surface); }
  .subchat-input { display: flex; gap: var(--jc-space-sm); align-items: flex-end; }
  .subchat-input textarea {
    flex: 1 1 auto;
    resize: none;
    min-height: 32px;
    max-height: 120px;
    background: var(--jc-surface-container-highest);
    color: var(--jc-on-surface);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-sm);
    padding: var(--jc-space-sm) var(--jc-space-md);
    font-family: var(--jc-font-body);
    font-size: 0.8em;
    line-height: 1.4;
  }
  .subchat-input textarea:focus { outline: none; border-color: var(--jc-primary); }
  .subchat-send {
    background: var(--jc-primary-container);
    color: var(--jc-on-primary-container);
    border: none;
    border-radius: var(--jc-radius-sm);
    padding: var(--jc-space-sm) var(--jc-space-lg);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-weight: 600;
    font-size: 0.75em;
  }
  .subchat-send:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
