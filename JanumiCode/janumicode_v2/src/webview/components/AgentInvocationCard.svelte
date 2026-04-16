<!--
  AgentInvocationCard — unified CLI / LLM / orchestrator agent call card.
  Matches v1's commandBlock pattern from JanumiCode/janumicode/src/webview/renderer/commandBlock.ts.

  Renders:
    Header:  [▶/▼] [icon] [label] [type badge] [status icon] [duration] [timestamp]
    Body:    progressive-disclosure output area + nested tool-call cards
    Footer:  retry button on error

  Data: the `record` prop is an `agent_invocation` record. Child records
  (agent_output, tool_call, tool_result, agent_reasoning_step) are pulled
  from recordsStore.getChildren(record.id) and rendered nested.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { recordsStore } from '../stores/records.svelte';
  import { streamingStore } from '../stores/streaming.svelte';

  interface Props {
    record: SerializedRecord;
    ondecision?: (detail: {
      recordId: string;
      decision: { type: string; payload?: Record<string, unknown> };
    }) => void;
  }

  const { record, ondecision }: Props = $props();

  let collapsed = $state(false); // invocations default expanded so user sees progress
  let outputExpanded = $state(false); // large outputs collapse to first 10 lines

  // ── Derived from content ──────────────────────────────────────
  const content = $derived(record.content as Record<string, unknown>);
  const label = $derived((content.label as string) ?? `${content.provider} ${content.model}`);
  const status = $derived((content.status as string) ?? 'running');
  const provider = $derived((content.provider as string) ?? '');
  const model = $derived((content.model as string) ?? '');
  const prompt = $derived((content.prompt as string) ?? '');
  const systemPrompt = $derived((content.system as string | null) ?? null);
  const commandLine = $derived((content.command_line as string | null) ?? null);
  const cwd = $derived((content.cwd as string | null) ?? null);

  // ── Child records ─────────────────────────────────────────────
  const children = $derived(recordsStore.getChildren(record.id));
  const agentOutput = $derived(children.find(c => c.record_type === 'agent_output'));
  const toolCalls = $derived(children.filter(c => c.record_type === 'tool_call'));
  const reasoningSteps = $derived(children.filter(c => c.record_type === 'agent_reasoning_step'));
  // Streaming chunks come from the transient store (no longer persisted as
  // governed_stream rows). Reads are reactive via the store's $state.
  const liveStream = $derived(streamingStore.get(record.id));
  const streamedResponse = $derived(liveStream.response);
  const streamedThinking = $derived(liveStream.thinking);
  // Thinking to display — prefer the final agent_output.thinking (full
  // chain) and fall back to streamed chunks while the call is in flight.
  // Never hide thinking once it has been produced; it's often the most
  // valuable content on the card for debugging reasoning.
  const thinkingText = $derived.by(() => {
    if (agentOutput) {
      const stored = (agentOutput.content as { thinking?: string | null }).thinking;
      if (typeof stored === 'string' && stored.length > 0) return stored;
    }
    return streamedThinking;
  });
  const streamedStdout = $derived(liveStream.stdout);
  const streamedStderr = $derived(liveStream.stderr);

  // ── Status from agent_output (overrides the invocation's 'running') ──
  const resolvedStatus = $derived(
    agentOutput
      ? ((agentOutput.content as Record<string, unknown>).status as string) ?? status
      : status,
  );

  const durationMs = $derived(
    agentOutput
      ? ((agentOutput.content as Record<string, unknown>).duration_ms as number) ?? null
      : null,
  );
  const inputTokens = $derived(
    agentOutput
      ? ((agentOutput.content as Record<string, unknown>).input_tokens as number) ?? null
      : null,
  );
  const outputTokens = $derived(
    agentOutput
      ? ((agentOutput.content as Record<string, unknown>).output_tokens as number) ?? null
      : null,
  );
  const outputText = $derived(
    agentOutput
      ? ((agentOutput.content as Record<string, unknown>).text as string) ?? ''
      : '',
  );
  const errorMessage = $derived(
    agentOutput
      ? ((agentOutput.content as Record<string, unknown>).error_message as string) ?? ''
      : '',
  );

  // ── Icons ─────────────────────────────────────────────────────
  const isCliInvocation = $derived(provider.includes('cli') || !!commandLine);
  function getIcon(): string {
    if (isCliInvocation) return '💻';
    if (record.produced_by_agent_role === 'orchestrator') return '🤖';
    return '✨';
  }

  function getTypeBadge(): string {
    return isCliInvocation ? 'CLI' : 'API';
  }

  function formatDuration(ms: number | null): string {
    if (ms === null) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }) +
      ' ' + d.toLocaleTimeString();
  }

  // ── Output progressive disclosure ─────────────────────────────
  const OUTPUT_COLLAPSE_THRESHOLD = 20;
  const OUTPUT_VISIBLE_LINES = 10;

  const outputLines = $derived(outputText ? outputText.split('\n') : []);
  const isLargeOutput = $derived(outputLines.length > OUTPUT_COLLAPSE_THRESHOLD);
  const visibleLines = $derived(
    isLargeOutput && !outputExpanded
      ? outputLines.slice(0, OUTPUT_VISIBLE_LINES)
      : outputLines,
  );
  const hiddenCount = $derived(outputLines.length - OUTPUT_VISIBLE_LINES);
  const outputSizeLabel = $derived(() => {
    const bytes = outputText.length;
    if (bytes < 1024) return `${bytes} chars`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  });

  function handleRetry() {
    ondecision?.({
      recordId: record.id,
      decision: { type: 'retry_invocation' },
    });
  }
</script>

<div
  class="invocation-card"
  class:status-running={resolvedStatus === 'running'}
  class:status-success={resolvedStatus === 'success'}
  class:status-error={resolvedStatus === 'error'}
  data-record-id={record.id}
  data-phase-id={record.phase_id}
>
  <!-- Header row -->
  <button class="inv-header" onclick={() => (collapsed = !collapsed)}>
    <span class="inv-chevron">{collapsed ? '▶' : '▼'}</span>
    <span class="inv-icon">{getIcon()}</span>
    <span class="inv-label">{label}</span>
    <span class="inv-type-badge">{getTypeBadge()}</span>
    <span class="inv-status" aria-live="polite">
      {#if resolvedStatus === 'running'}
        <span class="inv-spinner" aria-label="running"></span>
      {:else if resolvedStatus === 'success'}
        <span class="inv-check" aria-label="success">✓</span>
      {:else if resolvedStatus === 'error'}
        <span class="inv-fail" aria-label="error">✗</span>
      {/if}
    </span>
    {#if durationMs !== null}
      <span class="inv-duration">{formatDuration(durationMs)}</span>
    {/if}
    {#if inputTokens !== null || outputTokens !== null}
      <span class="inv-tokens">{inputTokens ?? '?'}→{outputTokens ?? '?'} tok</span>
    {/if}
    <span class="inv-time" title={record.produced_at}>{formatTimestamp(record.produced_at)}</span>
  </button>

  {#if !collapsed}
    <div class="inv-body">
      <!-- Model / provider / command info -->
      <div class="inv-model-line">
        <span class="inv-model">{model}</span>
        <span class="inv-provider">via {provider}</span>
        {#if cwd}
          <span class="inv-cwd" title="Working directory">cwd: {cwd}</span>
        {/if}
      </div>

      <!-- CLI command line (when this was a CLI invocation) -->
      {#if commandLine}
        <div class="inv-section">
          <span class="inv-section-label">CMD</span>
          <pre class="inv-code">{commandLine}</pre>
        </div>
      {/if}

      <!-- System prompt (when present — LLM API calls only) -->
      {#if systemPrompt}
        <details class="inv-section inv-collapsible">
          <summary>
            <span class="inv-toggle-icon" aria-hidden="true"></span>
            <span class="inv-section-label">SYSTEM</span>
            <span class="inv-size">{systemPrompt.length} chars</span>
          </summary>
          <pre class="inv-code inv-input">{systemPrompt}</pre>
        </details>
      {/if}

      <!-- Prompt / stdin — collapsed by default; user expands when they want
           to inspect or copy. The body is selectable so Ctrl-C works. -->
      {#if prompt}
        <details class="inv-section inv-collapsible">
          <summary>
            <span class="inv-toggle-icon" aria-hidden="true"></span>
            <span class="inv-section-label">{isCliInvocation ? 'STDIN' : 'PROMPT'}</span>
            <span class="inv-size">{prompt.length < 1024 ? `${prompt.length} chars` : `${(prompt.length / 1024).toFixed(1)} KB`}</span>
          </summary>
          <pre class="inv-code inv-input">{prompt}</pre>
        </details>
      {/if}

      <!-- Thinking (LLM) — collapsible, persists after completion. While
           streaming, reads from chunk records; once agent_output lands,
           reads from the authoritative agent_output.thinking field. -->
      {#if thinkingText}
        <details class="inv-section inv-collapsible">
          <summary>
            <span class="inv-toggle-icon" aria-hidden="true"></span>
            <span class="inv-section-label thinking-label">THINKING</span>
            <span class="inv-size">{thinkingText.length < 1024 ? `${thinkingText.length} chars` : `${(thinkingText.length / 1024).toFixed(1)} KB`}</span>
          </summary>
          <pre class="inv-code" class:inv-stream={!agentOutput}>{thinkingText}</pre>
        </details>
      {/if}

      <!-- Live streaming: response (LLM) — shown until the final agent_output lands -->
      {#if streamedResponse && !agentOutput}
        <div class="inv-section">
          <span class="inv-section-label">OUT</span>
          <pre class="inv-code inv-stream">{streamedResponse}</pre>
        </div>
      {/if}

      <!-- Live streaming: stdout (CLI) -->
      {#if streamedStdout}
        <div class="inv-section">
          <span class="inv-section-label">STDOUT</span>
          <pre class="inv-code inv-stream">{streamedStdout}</pre>
        </div>
      {/if}

      <!-- Live streaming: stderr (CLI) -->
      {#if streamedStderr}
        <div class="inv-section">
          <span class="inv-section-label stderr-label">STDERR</span>
          <pre class="inv-code inv-stream inv-stderr">{streamedStderr}</pre>
        </div>
      {/if}

      <!-- Reasoning steps -->
      {#if reasoningSteps.length > 0}
        <div class="inv-reasoning">
          {#each reasoningSteps as step (step.id)}
            <div class="reasoning-step">
              <pre>{(step.content as Record<string, unknown>).text ?? JSON.stringify(step.content, null, 2)}</pre>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Tool calls (nested cards) -->
      {#if toolCalls.length > 0}
        <div class="inv-tool-calls">
          {#each toolCalls as tc (tc.id)}
            {@const tcContent = tc.content as Record<string, unknown>}
            <div class="tool-call-card">
              <div class="tool-call-header">
                <span class="tool-name">{tcContent.tool_name ?? 'tool'}</span>
                <span class="tool-status-dot"></span>
              </div>
              <div class="tool-call-body">
                {#if tcContent.parameters}
                  <div class="tool-params">
                    <span class="tool-label">IN</span>
                    <pre>{JSON.stringify(tcContent.parameters, null, 2)}</pre>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Final output (once agent_output lands) — collapsed by default,
           with progressive disclosure of long bodies once expanded. -->
      {#if outputText}
        <details class="inv-section inv-collapsible inv-output">
          <summary>
            <span class="inv-toggle-icon" aria-hidden="true"></span>
            <span class="inv-section-label">RESPONSE</span>
            <span class="inv-size">{outputSizeLabel()}</span>
          </summary>
          <pre class="output-text">{visibleLines.join('\n')}</pre>
          {#if isLargeOutput && !outputExpanded}
            <button class="output-expand-btn" onclick={() => (outputExpanded = true)}>
              Show {hiddenCount} more lines ({outputSizeLabel()})
            </button>
          {/if}
        </details>
      {/if}

      <!-- Error message -->
      {#if resolvedStatus === 'error' && errorMessage}
        <div class="inv-error">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{errorMessage}</span>
        </div>
      {/if}

      <!-- Retry button on error -->
      {#if resolvedStatus === 'error'}
        <div class="inv-actions">
          <button class="retry-btn" onclick={handleRetry}>Retry</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .invocation-card {
    position: relative;
    background: var(--jc-surface-container-low);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-md);
    overflow: hidden;
    font-size: 1em;
  }
  .invocation-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: var(--jc-status-bar-width);
  }

  .status-running::before { background: var(--jc-primary); }
  .status-success::before { background: var(--jc-tertiary); }
  .status-error::before   { background: var(--jc-error); }

  .inv-header {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    padding: var(--jc-space-lg) var(--jc-space-xl) var(--jc-space-lg) var(--jc-space-xl);
    background: transparent;
    border: none;
    color: var(--jc-on-surface);
    width: 100%;
    text-align: left;
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-size: inherit;
    transition: background var(--jc-transition-fast);
  }
  .inv-header:hover { background: var(--jc-surface-container-high); }

  .inv-chevron { font-size: 0.65em; color: var(--jc-outline); flex-shrink: 0; }
  .inv-icon { flex-shrink: 0; }
  .inv-label {
    font-family: var(--jc-font-headline);
    font-weight: 600;
    font-size: 0.95em;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inv-type-badge {
    font-size: 0.6em;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    background: var(--jc-surface-container-highest);
    color: var(--jc-on-surface-variant);
    border: var(--jc-ghost-border);
    font-weight: 600;
    flex-shrink: 0;
  }

  .inv-status {
    flex-shrink: 0;
    font-size: 0.85em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
  }
  .inv-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid var(--jc-outline-variant);
    border-top-color: var(--jc-primary);
    border-radius: 50%;
    animation: jc-invocation-spin 0.9s linear infinite;
  }
  .inv-check { color: var(--jc-tertiary); font-weight: 700; }
  .inv-fail  { color: var(--jc-error);    font-weight: 700; }
  @keyframes jc-invocation-spin {
    to { transform: rotate(360deg); }
  }
  .inv-duration {
    font-family: var(--jc-font-mono);
    font-size: 0.7em;
    color: var(--jc-outline);
    flex-shrink: 0;
  }
  .inv-tokens {
    font-family: var(--jc-font-mono);
    font-size: 0.6em;
    color: var(--jc-outline);
    flex-shrink: 0;
  }
  .inv-time {
    font-family: var(--jc-font-mono);
    font-size: 0.65em;
    color: var(--jc-outline);
    flex-shrink: 0;
    margin-left: auto;
  }

  .inv-body {
    padding: var(--jc-space-lg) var(--jc-space-xl);
  }

  .inv-model-line {
    font-family: var(--jc-font-mono);
    font-size: 0.75em;
    color: var(--jc-outline);
    margin-bottom: var(--jc-space-lg);
    display: flex;
    flex-wrap: wrap;
    gap: var(--jc-space-md);
    align-items: baseline;
  }
  .inv-model { font-weight: 600; color: var(--jc-on-surface-variant); }
  .inv-provider { color: var(--jc-outline); }
  .inv-cwd {
    font-size: 0.9em;
    color: var(--jc-outline);
    opacity: 0.8;
  }

  /* ── Generic inv-section blocks (CMD / SYSTEM / PROMPT / STDIN / STDOUT / STDERR) ── */
  .inv-section { margin-bottom: var(--jc-space-lg); }
  .inv-collapsible > summary {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    cursor: pointer;
    list-style: none;
    padding: var(--jc-space-sm) 0;
  }
  .inv-collapsible > summary::-webkit-details-marker { display: none; }
  .inv-collapsible > summary::marker { content: ''; }
  /* Custom +/- toggle — collapsed shows '+', expanded shows '−'. */
  .inv-toggle-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    font-family: var(--jc-font-mono);
    font-size: 0.85em;
    font-weight: 700;
    line-height: 1;
    color: var(--jc-on-surface-variant);
    border: 1px solid var(--jc-outline-variant);
    border-radius: var(--jc-radius-xs);
    background: var(--jc-surface-container-highest);
  }
  .inv-toggle-icon::before { content: '+'; }
  .inv-collapsible[open] > summary .inv-toggle-icon::before { content: '−'; }
  .inv-section-label {
    display: inline-block;
    font-family: var(--jc-font-mono);
    font-size: 0.6em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: var(--jc-space-xs) var(--jc-space-md);
    background: var(--jc-surface-container-highest);
    color: var(--jc-on-surface-variant);
    border-radius: var(--jc-radius-xs);
    border: var(--jc-ghost-border);
  }
  .inv-section-label.thinking-label { color: var(--jc-warning); }
  .inv-section-label.stderr-label   { color: var(--jc-error); }
  .inv-size {
    font-family: var(--jc-font-mono);
    font-size: 0.65em;
    color: var(--jc-outline);
  }
  .inv-code {
    margin: var(--jc-space-md) 0 0;
    font-family: var(--jc-font-mono);
    font-size: 0.75em;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 280px;
    overflow: auto;
    background: var(--jc-surface-container-lowest);
    color: var(--jc-secondary);
    padding: var(--jc-space-md) var(--jc-space-lg);
    border-radius: var(--jc-radius-sm);
    border: var(--jc-ghost-border);
    /* Make text selectable so Ctrl-C works inside webview <pre> blocks. */
    user-select: text;
    -webkit-user-select: text;
    cursor: text;
  }
  .inv-input { color: var(--jc-on-surface); }
  .inv-stream {
    border-left: 2px solid var(--jc-primary);
  }
  .inv-stderr { color: var(--jc-error); }

  .inv-reasoning { margin-bottom: var(--jc-space-lg); }
  .reasoning-step {
    border-left: 2px solid var(--jc-outline-variant);
    padding-left: var(--jc-space-lg);
    margin-bottom: var(--jc-space-md);
  }
  .reasoning-step pre {
    margin: 0;
    font-family: var(--jc-font-mono);
    font-size: 0.8em;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
    color: var(--jc-on-surface-variant);
  }

  .inv-tool-calls { margin-bottom: var(--jc-space-lg); }
  .tool-call-card {
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-sm);
    margin-bottom: var(--jc-space-md);
    overflow: hidden;
    background: var(--jc-surface-container);
  }
  .tool-call-header {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    padding: var(--jc-space-md) var(--jc-space-lg);
    background: var(--jc-surface-container-high);
    font-size: 0.8em;
  }
  .tool-name {
    font-family: var(--jc-font-mono);
    font-weight: 600;
    color: var(--jc-on-surface);
  }
  .tool-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--jc-tertiary);
  }
  .tool-call-body { padding: var(--jc-space-md) var(--jc-space-lg); }
  .tool-params { margin-bottom: var(--jc-space-sm); }
  .tool-label {
    display: inline-block;
    font-family: var(--jc-font-mono);
    font-size: 0.6em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: var(--jc-space-xs) var(--jc-space-md);
    background: var(--jc-surface-container-highest);
    color: var(--jc-on-surface-variant);
    border-radius: var(--jc-radius-xs);
    margin-right: var(--jc-space-md);
    vertical-align: middle;
  }
  .tool-params pre {
    margin: var(--jc-space-md) 0 0;
    font-family: var(--jc-font-mono);
    font-size: 0.75em;
    max-height: 150px;
    overflow: auto;
    background: var(--jc-surface-container-lowest);
    color: var(--jc-secondary);
    padding: var(--jc-space-md) var(--jc-space-lg);
    border-radius: var(--jc-radius-sm);
    border: var(--jc-ghost-border);
  }

  .inv-output { margin-bottom: var(--jc-space-lg); }
  .output-text {
    margin: 0;
    font-family: var(--jc-font-mono);
    font-size: 0.75em;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 400px;
    overflow-y: auto;
    background: var(--jc-surface-container-lowest);
    color: var(--jc-secondary);
    padding: var(--jc-space-lg) var(--jc-space-lg);
    border-radius: var(--jc-radius-sm);
    border: var(--jc-ghost-border);
    user-select: text;
    -webkit-user-select: text;
    cursor: text;
  }
  .output-expand-btn {
    display: block;
    width: 100%;
    padding: var(--jc-space-md);
    margin-top: var(--jc-space-md);
    background: transparent;
    color: var(--jc-primary);
    border: 1px dashed var(--jc-outline-variant-tint-strong);
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-size: 0.75em;
    font-weight: 500;
    transition: background var(--jc-transition-fast);
  }
  .output-expand-btn:hover { background: var(--jc-surface-container); }

  .inv-error {
    display: flex;
    align-items: flex-start;
    gap: var(--jc-space-md);
    padding: var(--jc-space-lg) var(--jc-space-lg);
    background: var(--jc-error-container-tint-soft);
    border: 1px solid var(--jc-error-tint-medium);
    border-radius: var(--jc-radius-sm);
    margin-bottom: var(--jc-space-lg);
  }
  .error-icon { flex-shrink: 0; }
  .error-text { font-size: 0.85em; color: var(--jc-error); line-height: 1.4; }

  .inv-actions { margin-top: var(--jc-space-lg); }
  .retry-btn {
    padding: var(--jc-space-md) var(--jc-space-2xl);
    background: var(--jc-surface-container-highest);
    color: var(--jc-on-surface);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-weight: 600;
    font-size: 0.7em;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: background var(--jc-transition-fast);
  }
  .retry-btn:hover { background: var(--jc-surface-bright); }
</style>
