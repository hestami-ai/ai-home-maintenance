<!--
  IntentComposer — main coordinator for the bottom-anchored input area.
  Implements the rich input area feature spec end-to-end:
    - Multi-line textarea (auto-grow 1→8 lines)
    - Mode badge (Intent / Open Query — Phase N)
    - Token estimate
    - Loading + LLM queue depth indicator
    - [+ Attach] button + drag-drop attachments
    - @mention autocomplete with 6 types
    - Slash commands: /help, /clear, /status, /attach, /start
    - Keyboard map per spec §12
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { composerStore, type MentionCandidate, type Reference } from '../stores/composer.svelte';
  import { recordsStore } from '../stores/records.svelte';
  import ContextBar from './ContextBar.svelte';
  import AttachmentBar from './AttachmentBar.svelte';
  import MentionAutocomplete from './MentionAutocomplete.svelte';

  interface Props {
    vscode: {
      postMessage(message: unknown): void;
      getState(): unknown;
      setState(state: unknown): void;
    };
  }

  const { vscode }: Props = $props();

  let textarea = $state<HTMLTextAreaElement | null>(null);
  let pendingPicks = new Map<string, (uris: { fsPath: string; basename: string }[]) => void>();
  let pendingMentions = new Map<string, (candidates: MentionCandidate[]) => void>();

  // ── Auto-grow textarea (1 → 8 lines) ───────────────────────────
  $effect(() => {
    if (!textarea) return;
    // Touch composerStore.text to make this effect track it
    const _t = composerStore.text;
    void _t;
    textarea.style.height = 'auto';
    const max = 8 * 20; // 8 lines × ~20px line height
    textarea.style.height = `${Math.min(textarea.scrollHeight, max)}px`;
  });

  // ── Inbound message listener for picks/mentions ───────────────
  function handleMessage(event: MessageEvent) {
    const msg = event.data;
    if (msg?.type === 'pickFileResult') {
      const resolver = pendingPicks.get(msg.requestId);
      if (resolver) {
        resolver(msg.uris);
        pendingPicks.delete(msg.requestId);
      }
    } else if (msg?.type === 'mentionCandidates') {
      const resolver = pendingMentions.get(msg.requestId);
      if (resolver) {
        resolver(msg.candidates);
        pendingMentions.delete(msg.requestId);
      }
    }
  }

  onMount(() => {
    window.addEventListener('message', handleMessage);
  });

  onDestroy(() => {
    window.removeEventListener('message', handleMessage);
  });

  // ── Helpers ───────────────────────────────────────────────────

  function placeholder(): string {
    return composerStore.mode === 'raw_intent'
      ? 'Start a new workflow… (Enter to send, Shift+Enter for newline)'
      : 'Ask a question… (Enter to send, Shift+Enter for newline)';
  }

  function modeBadge(): string {
    if (composerStore.mode === 'raw_intent') return '[Intent]';
    return `[Open Query — Phase ${composerStore.currentPhase}]`;
  }

  // ── Submission ────────────────────────────────────────────────

  /**
   * Svelte 5 `$state` wraps arrays and objects in a Proxy. Structured
   * cloning (which VS Code's webview postMessage uses internally) rejects
   * Proxies with `DataCloneError: [object Array] could not be cloned.`
   * Route every outbound payload through JSON round-trip so we ship plain
   * data across the MessagePort regardless of how reactive the source was.
   */
  function cloneForPost<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  function post(message: Record<string, unknown>): void {
    vscode.postMessage(cloneForPost(message));
  }

  async function submit() {
    if (!composerStore.canSubmit) return;
    const text = composerStore.text.trim();

    if (text.startsWith('/')) {
      handleSlash(text);
      return;
    }

    composerStore.beginSubmit();
    const attachments = composerStore.attachments.map((a) => a.uri);
    const references = composerStore.references.map((r) => ({
      type: r.type,
      id: r.id,
      display: r.display,
      uri: r.uri,
    }));

    if (composerStore.mode === 'raw_intent') {
      post({
        type: 'submitIntent',
        text,
        attachments,
        references,
      });
    } else {
      post({
        type: 'submitOpenQuery',
        text,
        attachments,
        references,
      });
    }

    composerStore.clear();

    // Safety reset after 60s if no response.
    setTimeout(() => composerStore.endSubmit(), 60_000);
  }

  function handleSlash(text: string) {
    const [cmd, ...rest] = text.slice(1).split(/\s+/);
    const arg = rest.join(' ');
    switch (cmd) {
      case 'clear':
        composerStore.clear();
        recordsStore.clear();
        break;
      case 'help':
        post({
          type: 'submitOpenQuery',
          text: 'help',
          forceCapability: 'help',
        });
        composerStore.clear();
        break;
      case 'status':
        post({
          type: 'submitOpenQuery',
          text: 'status',
          forceCapability: 'getStatus',
        });
        composerStore.clear();
        break;
      case 'attach':
        triggerPickFile();
        break;
      case 'start':
        composerStore.setText(arg);
        void submit();
        break;
      default:
        // Unknown — append a synthetic info card.
        recordsStore.add({
          id: `local-${Date.now()}`,
          record_type: 'system_info',
          phase_id: null,
          sub_phase_id: null,
          produced_by_agent_role: null,
          produced_at: new Date().toISOString(),
          authority_level: 1,
          quarantined: false,
          derived_from_record_ids: [],
          content: { text: `Unknown slash command: /${cmd}` },
        });
        composerStore.setText('');
    }
  }

  // ── File picker ───────────────────────────────────────────────

  function triggerPickFile() {
    const requestId = crypto.randomUUID();
    pendingPicks.set(requestId, (uris) => {
      for (const u of uris) {
        composerStore.addAttachment({
          uri: u.fsPath,
          name: u.basename,
          type: 'file',
        });
      }
    });
    post({ type: 'pickFile', requestId, multiple: true });
  }

  function handleDropFiles(uris: string[]) {
    for (const uri of uris) {
      const name = uri.split(/[\\/]/).pop() ?? uri;
      composerStore.addAttachment({ uri, name, type: 'file' });
    }
  }

  // ── @mention autocomplete ─────────────────────────────────────

  function detectMentionAtCursor(): { active: boolean; query: string } {
    if (!textarea) return { active: false, query: '' };
    const value = composerStore.text;
    const cursor = textarea.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const m = /@(\S*)$/.exec(before);
    if (!m) return { active: false, query: '' };
    return { active: true, query: m[1] };
  }

  function onInput() {
    const { active, query } = detectMentionAtCursor();
    if (active) {
      composerStore.openMentions(query);
      requestMentionCandidates(query);
    } else if (composerStore.mentionOpen) {
      composerStore.closeMentions();
    }
  }

  let mentionTimer: ReturnType<typeof setTimeout> | null = null;
  function requestMentionCandidates(query: string) {
    if (mentionTimer) clearTimeout(mentionTimer);
    mentionTimer = setTimeout(() => {
      const requestId = crypto.randomUUID();
      pendingMentions.set(requestId, (candidates) => {
        composerStore.setMentionCandidates(candidates);
      });
      post({ type: 'resolveMention', requestId, query });
    }, 200);
  }

  function selectMention(candidate: MentionCandidate) {
    if (!textarea) return;
    const value = composerStore.text;
    const cursor = textarea.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const replacement = before.replace(/@\S*$/, `@${candidate.label} `);
    composerStore.setText(replacement + after);
    const ref: Reference = {
      type: candidate.type,
      id: candidate.id,
      display: candidate.label,
      uri: candidate.uri,
    };
    composerStore.addReference(ref);
    composerStore.closeMentions();
  }

  // ── Keyboard ──────────────────────────────────────────────────

  function onKeydown(e: KeyboardEvent) {
    if (composerStore.mentionOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        composerStore.mentionActiveIndex = Math.min(
          composerStore.mentionActiveIndex + 1,
          composerStore.mentionCandidates.length - 1,
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        composerStore.mentionActiveIndex = Math.max(composerStore.mentionActiveIndex - 1, 0);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const c = composerStore.mentionCandidates[composerStore.mentionActiveIndex];
        if (c) {
          e.preventDefault();
          selectMention(c);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        composerStore.closeMentions();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      composerStore.clear();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      triggerPickFile();
      return;
    }
  }
</script>

<div class="composer">
  <ContextBar summary={composerStore.contextSummary} />
  {#if composerStore.attachments.length > 0}
    <AttachmentBar
      attachments={composerStore.attachments}
      onPick={triggerPickFile}
      onRemove={(uri) => composerStore.removeAttachment(uri)}
      onDropFiles={handleDropFiles}
    />
  {/if}

  <div class="composer-body">
    <MentionAutocomplete
      open={composerStore.mentionOpen}
      candidates={composerStore.mentionCandidates}
      activeIndex={composerStore.mentionActiveIndex}
      onSelect={selectMention}
      onClose={() => composerStore.closeMentions()}
    />

    <textarea
      bind:this={textarea}
      bind:value={composerStore.text}
      placeholder={placeholder()}
      disabled={composerStore.isSubmitting}
      oninput={onInput}
      onkeydown={onKeydown}
      aria-label="Intent composer"
      aria-multiline="true"
      rows="1"
    ></textarea>

    <div class="footer">
      <button
        class="attach-btn"
        onclick={triggerPickFile}
        disabled={composerStore.isSubmitting}
        aria-label="Attach file (Ctrl+K)"
        title="Attach file (Ctrl+K)"
      >+</button>
      <span class="mode-badge" role="status" aria-live="polite">{modeBadge()}</span>
      <span class="tokens">~{composerStore.tokenEstimate} tokens</span>
      {#if composerStore.llmQueueDepth > 0}
        <span class="queue">Queued — {composerStore.llmQueueDepth} ahead</span>
      {/if}
      <button
        class="send-btn"
        onclick={submit}
        disabled={!composerStore.canSubmit}
        aria-label={composerStore.isSubmitting ? 'Submitting' : 'Send intent'}
      >
        {#if composerStore.isSubmitting}
          ⏳
        {:else}
          Send
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .composer {
    flex-shrink: 0;
    border-top: 1px solid var(--vscode-panel-border, #333);
    background: var(--vscode-sideBar-background);
  }
  .composer-body {
    position: relative;
    padding: 6px 8px 8px;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 36px;
    max-height: 160px;
    resize: none;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 3px;
    padding: 6px 8px;
    font-family: inherit;
    font-size: inherit;
  }
  textarea:focus {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }
  .footer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    font-size: 0.75em;
  }
  .attach-btn {
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border, #555);
    border-radius: 3px;
    width: 24px;
    height: 22px;
    cursor: pointer;
    font-family: inherit;
    line-height: 1;
  }
  .attach-btn:hover { background: var(--vscode-list-hoverBackground); }
  .mode-badge {
    color: var(--vscode-textLink-foreground, #4da6ff);
    font-weight: bold;
  }
  .tokens, .queue {
    opacity: 0.6;
  }
  .queue {
    color: var(--vscode-charts-orange, #d18616);
    opacity: 1;
  }
  .send-btn {
    margin-left: auto;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    padding: 4px 16px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.95em;
  }
  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .send-btn:hover:not(:disabled) {
    background: var(--vscode-button-hoverBackground);
  }
</style>
