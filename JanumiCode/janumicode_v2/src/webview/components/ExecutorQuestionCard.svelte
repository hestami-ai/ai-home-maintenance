<!--
  ExecutorQuestionCard — the attended-run surface for a Phase-9 coding agent's
  blocking clarification that the spec-grounded voice-of-intent responder could
  NOT answer (see governedStreamViewProvider.escalateExecutorQuestion).

  Unlike the decision surfaces (approve/reject/menu via the decision rail), this
  is a FREE-TEXT answer: the human types a reply that is posted straight back to
  the provider (type 'executorQuestion:answer'), which resolves the awaiting
  ExecutorEscalation promise. The provider writes an 'executor_question_answered'
  follow-up record; we derive the answered state from it so a submitted answer
  survives a webview reload (a purely-local flag would reset).
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { recordsStore } from '../stores/records.svelte';

  interface Props {
    record: SerializedRecord;
    vscode?: { postMessage(message: unknown): void };
  }

  const { record, vscode }: Props = $props();

  const content = $derived(
    record.content as { question?: string; agent_context?: string; task_spec?: string },
  );
  const question = $derived(content.question ?? '(the agent requested clarification)');

  // Answered-state derives from the persisted follow-up record so it survives a
  // reload / window re-trim. Matches by target_record_id, not array position.
  const answeredRecord = $derived(
    recordsStore.records.find(
      (r) =>
        r.record_type === 'executor_question_answered' &&
        (r.content as { target_record_id?: string }).target_record_id === record.id,
    ),
  );
  const answered = $derived(!!answeredRecord);
  const submittedAnswer = $derived(
    (answeredRecord?.content as { answer?: string } | undefined)?.answer ?? '',
  );

  let answer = $state('');
  let submitting = $state(false);

  // Svelte 5 `$state` proxies can't be structured-cloned across postMessage.
  function post(message: Record<string, unknown>): void {
    vscode?.postMessage(JSON.parse(JSON.stringify(message)));
  }

  function submit(): void {
    const a = answer.trim();
    if (!a || submitting || answered || !vscode) return;
    submitting = true;
    post({ type: 'executorQuestion:answer', recordId: record.id, answer: a });
    // Safety unlock — the answered-derived state normally takes over once the
    // follow-up record streams back; this just re-enables the box if it doesn't.
    setTimeout(() => (submitting = false), 30_000);
  }

  function onKeydown(e: KeyboardEvent): void {
    // Cmd/Ctrl+Enter submits; plain Enter keeps a newline (answers can be multi-line).
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }
</script>

<div class="eq-card" data-record-id={record.id}>
  <div class="eq-header">
    <span class="eq-kind">Executor question</span>
    <h3 class="eq-title">The coding agent needs a decision</h3>
  </div>

  <p class="eq-question">{question}</p>

  {#if content.agent_context}
    <details class="eq-detail">
      <summary>Recent agent output</summary>
      <pre class="eq-pre">{content.agent_context}</pre>
    </details>
  {/if}
  {#if content.task_spec}
    <details class="eq-detail">
      <summary>Task specification</summary>
      <pre class="eq-pre">{content.task_spec}</pre>
    </details>
  {/if}

  {#if answered}
    <div class="eq-answered">
      <span class="eq-answered-label">Answered</span>
      <p class="eq-answered-text">{submittedAnswer}</p>
    </div>
  {:else}
    <textarea
      class="eq-answer"
      bind:value={answer}
      onkeydown={onKeydown}
      rows="3"
      placeholder="Answer the agent's question (Cmd/Ctrl+Enter to send). Leave blank and the agent proceeds on its own best judgment."
      disabled={submitting}
    ></textarea>
    <div class="eq-actions">
      <span class="eq-hint">The agent is waiting; if unsure, it can proceed without you.</span>
      <button class="eq-submit" disabled={!answer.trim() || submitting} onclick={submit}>
        {submitting ? 'Sending…' : 'Send answer'}
      </button>
    </div>
  {/if}
</div>

<style>
  .eq-card {
    background: var(--jc-surface-container);
    border: var(--jc-ghost-border);
    border-left: 3px solid var(--jc-secondary);
    border-radius: var(--jc-radius-md);
    padding: var(--jc-space-xl);
    margin-bottom: var(--jc-space-lg);
  }
  .eq-header {
    display: flex;
    align-items: baseline;
    gap: var(--jc-space-md);
    margin-bottom: var(--jc-space-sm);
  }
  .eq-kind {
    font-family: var(--jc-font-mono);
    font-size: 0.65em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--jc-secondary);
    padding: var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    background: var(--jc-surface-container-highest);
    white-space: nowrap;
  }
  .eq-title {
    margin: 0;
    font-family: var(--jc-font-headline);
    font-size: 1em;
    color: var(--jc-on-surface);
    font-weight: 600;
  }
  .eq-question {
    margin: 0 0 var(--jc-space-lg) 0;
    color: var(--jc-on-surface);
    font-size: 0.95em;
    line-height: 1.5;
    white-space: pre-wrap;
  }
  .eq-detail {
    margin-bottom: var(--jc-space-md);
    font-size: 0.85em;
    color: var(--jc-on-surface-variant);
  }
  .eq-detail summary {
    cursor: pointer;
  }
  .eq-pre {
    margin: var(--jc-space-sm) 0 0 0;
    padding: var(--jc-space-md);
    max-height: 16rem;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--jc-surface-container-lowest);
    border-radius: var(--jc-radius-xs);
    font-family: var(--jc-font-mono);
    font-size: 0.9em;
    color: var(--jc-on-surface-variant);
  }
  .eq-answer {
    width: 100%;
    margin-top: var(--jc-space-md);
    padding: var(--jc-space-md);
    font: inherit;
    font-family: var(--jc-font-body);
    font-size: 0.9em;
    background: var(--jc-surface-container-lowest);
    color: var(--jc-on-surface);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-xs);
    resize: vertical;
    box-sizing: border-box;
  }
  .eq-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--jc-space-md);
    margin-top: var(--jc-space-md);
  }
  .eq-hint {
    font-size: 0.8em;
    color: var(--jc-on-surface-variant);
  }
  .eq-submit {
    padding: var(--jc-space-md) var(--jc-space-xl);
    font-family: var(--jc-font-body);
    font-weight: 600;
    font-size: 0.9em;
    border: none;
    border-radius: var(--jc-radius-sm);
    background: var(--jc-primary);
    color: var(--jc-on-primary);
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--jc-transition-fast);
  }
  .eq-submit:disabled {
    background: var(--jc-surface-container-highest);
    color: var(--jc-on-surface-variant);
    cursor: not-allowed;
  }
  .eq-submit:not(:disabled):hover {
    background: var(--jc-primary-tint-emphasis);
  }
  .eq-answered {
    margin-top: var(--jc-space-md);
    padding: var(--jc-space-md) var(--jc-space-lg);
    border-radius: var(--jc-radius-sm);
    background: var(--jc-tertiary-tint-soft);
  }
  .eq-answered-label {
    font-family: var(--jc-font-mono);
    font-size: 0.65em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--jc-tertiary);
  }
  .eq-answered-text {
    margin: var(--jc-space-sm) 0 0 0;
    color: var(--jc-on-surface);
    font-size: 0.9em;
    white-space: pre-wrap;
  }
</style>
