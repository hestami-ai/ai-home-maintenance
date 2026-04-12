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

  // ── Child records ─────────────────────────────────────────────
  const children = $derived(recordsStore.getChildren(record.id));
  const agentOutput = $derived(children.find(c => c.record_type === 'agent_output'));
  const toolCalls = $derived(children.filter(c => c.record_type === 'tool_call'));
  const reasoningSteps = $derived(children.filter(c => c.record_type === 'agent_reasoning_step'));

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
  function getIcon(): string {
    if (provider.includes('cli') || provider === 'claude_code' || provider === 'gemini_cli') return '💻';
    if (record.produced_by_agent_role === 'orchestrator') return '🤖';
    return '✨';
  }

  function getTypeBadge(): string {
    if (provider.includes('cli')) return 'CLI';
    return 'API';
  }

  function getStatusIcon(): string {
    if (resolvedStatus === 'success') return '✅';
    if (resolvedStatus === 'error') return '❌';
    return '⏳'; // running
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
    <span class="inv-status">{getStatusIcon()}</span>
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
      <!-- Model info -->
      <div class="inv-model-line">
        <span class="inv-model">{model}</span>
        <span class="inv-provider">via {provider}</span>
      </div>

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

      <!-- Output area with progressive disclosure -->
      {#if outputText}
        <div class="inv-output">
          <pre class="output-text">{visibleLines.join('\n')}</pre>
          {#if isLargeOutput && !outputExpanded}
            <button class="output-expand-btn" onclick={() => (outputExpanded = true)}>
              Show {hiddenCount} more lines ({outputSizeLabel()})
            </button>
          {/if}
        </div>
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
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 4px;
    overflow: hidden;
    font-size: 0.85em;
  }

  .status-running { border-left: 3px solid var(--vscode-charts-blue, #569cd6); }
  .status-success { border-left: 3px solid var(--vscode-terminal-ansiGreen, #4ec9b0); }
  .status-error   { border-left: 3px solid var(--vscode-terminal-ansiRed, #f44747); }

  .inv-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--vscode-editor-background);
    border: none;
    color: var(--vscode-foreground);
    width: 100%;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
  }
  .inv-header:hover { background: var(--vscode-list-hoverBackground); }

  .inv-chevron { font-size: 0.7em; opacity: 0.5; flex-shrink: 0; }
  .inv-icon { flex-shrink: 0; }
  .inv-label { font-weight: bold; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .inv-type-badge {
    font-size: 0.7em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    flex-shrink: 0;
  }

  .inv-status { flex-shrink: 0; font-size: 0.9em; }
  .inv-duration { font-size: 0.8em; opacity: 0.7; flex-shrink: 0; }
  .inv-tokens { font-size: 0.7em; opacity: 0.5; flex-shrink: 0; }
  .inv-time { font-size: 0.75em; opacity: 0.5; flex-shrink: 0; margin-left: auto; }

  .inv-body {
    padding: 8px 10px;
    border-top: 1px solid var(--vscode-panel-border, #333);
  }

  .inv-model-line {
    font-size: 0.8em;
    opacity: 0.6;
    margin-bottom: 8px;
  }
  .inv-model { font-weight: bold; }
  .inv-provider { margin-left: 8px; }

  .inv-reasoning {
    margin-bottom: 8px;
  }
  .reasoning-step {
    border-left: 2px solid var(--vscode-descriptionForeground, #666);
    padding-left: 8px;
    margin-bottom: 4px;
  }
  .reasoning-step pre {
    margin: 0;
    font-size: 0.8em;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
  }

  .inv-tool-calls {
    margin-bottom: 8px;
  }
  .tool-call-card {
    border: 1px solid var(--vscode-panel-border, #444);
    border-radius: 3px;
    margin-bottom: 4px;
    overflow: hidden;
  }
  .tool-call-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--vscode-editor-inactiveSelectionBackground, rgba(100, 100, 100, 0.1));
    font-size: 0.85em;
  }
  .tool-name { font-weight: bold; }
  .tool-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--vscode-terminal-ansiGreen, #4ec9b0);
  }
  .tool-call-body { padding: 4px 8px; }
  .tool-params { margin-bottom: 4px; }
  .tool-label {
    display: inline-block;
    font-size: 0.7em;
    font-weight: bold;
    text-transform: uppercase;
    padding: 0 4px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 3px;
    margin-right: 4px;
    vertical-align: middle;
  }
  .tool-params pre {
    margin: 4px 0 0;
    font-size: 0.8em;
    max-height: 150px;
    overflow: auto;
    background: var(--vscode-textCodeBlock-background);
    padding: 4px 6px;
    border-radius: 3px;
  }

  .inv-output { margin-bottom: 8px; }
  .output-text {
    margin: 0;
    font-size: 0.8em;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 400px;
    overflow-y: auto;
    background: var(--vscode-textCodeBlock-background);
    padding: 6px 8px;
    border-radius: 3px;
  }
  .output-expand-btn {
    display: block;
    width: 100%;
    padding: 4px;
    margin-top: 4px;
    background: transparent;
    color: var(--vscode-textLink-foreground, #4da6ff);
    border: 1px dashed var(--vscode-panel-border, #555);
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8em;
  }
  .output-expand-btn:hover { background: var(--vscode-list-hoverBackground); }

  .inv-error {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 8px;
    background: rgba(244, 71, 71, 0.08);
    border-radius: 3px;
    margin-bottom: 8px;
  }
  .error-icon { flex-shrink: 0; }
  .error-text { font-size: 0.85em; color: var(--vscode-inputValidation-errorForeground, #f88); }

  .inv-actions { margin-top: 8px; }
  .retry-btn {
    padding: 4px 16px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
  }
  .retry-btn:hover { background: var(--vscode-button-hoverBackground); }
</style>
