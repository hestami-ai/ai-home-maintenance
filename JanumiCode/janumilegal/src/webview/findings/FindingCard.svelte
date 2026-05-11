<script lang="ts">
  /**
   * FindingCard — renders a single reasoning-review finding.
   *
   * Per docs/design/wave12_review_ux_and_reviewer_agreement.md §2.1.
   *
   * Privilege-aware: deterministic findings get a blue left border
   * (work_product_factual); LLM findings get a yellow border
   * (work_product_mental).
   *
   * Three actions per finding: Acknowledge, Disagree, Open source.
   * The actions emit messages back to the extension host; the host
   * persists them via the AttorneyActionService (acknowledge/override)
   * or the ReviewerAgreementService (annotation).
   */

  export let findingId: string;
  export let validatorId: string;
  export let severity: 'HIGH' | 'MEDIUM' | 'LOW';
  export let type: string;
  export let message: string;
  export let classification: 'work_product_factual' | 'work_product_mental';
  export let evidence: Record<string, unknown> | undefined = undefined;
  export let unavailable = false;

  function emit(action: 'acknowledge' | 'disagree' | 'open_source'): void {
    // VS Code webview message bus
    const vscode = (globalThis as unknown as { acquireVsCodeApi?: () => { postMessage: (m: unknown) => void } })
      .acquireVsCodeApi?.();
    vscode?.postMessage({
      kind: 'finding_action',
      action,
      findingId,
      validatorId,
    });
  }

  $: borderColor =
    classification === 'work_product_mental' ? 'gold' : '#3a7ad9';
  $: severityClass =
    severity === 'HIGH' ? 'sev-high' :
    severity === 'MEDIUM' ? 'sev-medium' : 'sev-low';
</script>

<div class="finding-card {severityClass}" style="border-left-color: {borderColor}">
  <div class="finding-header">
    <span class="severity-badge">{severity}</span>
    <span class="validator-id">{validatorId}</span>
    {#if unavailable}<span class="unavailable">unavailable</span>{/if}
  </div>
  <div class="finding-type">{type}</div>
  <div class="finding-message">{message}</div>
  {#if evidence}
    <details class="evidence">
      <summary>evidence</summary>
      <pre>{JSON.stringify(evidence, null, 2)}</pre>
    </details>
  {/if}
  {#if !unavailable}
    <div class="actions">
      <button on:click={() => emit('acknowledge')}>Acknowledge</button>
      <button on:click={() => emit('disagree')}>Disagree</button>
      <button on:click={() => emit('open_source')}>Open source</button>
    </div>
  {/if}
</div>

<style>
  .finding-card {
    border: 1px solid var(--vscode-panel-border, #444);
    border-left-width: 4px;
    padding: 8px 12px;
    margin-bottom: 8px;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-foreground, #d4d4d4);
  }
  .finding-header {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 0.85em;
  }
  .severity-badge {
    font-weight: bold;
    padding: 1px 6px;
    border-radius: 3px;
  }
  .sev-high .severity-badge { background: #c14a4a; color: white; }
  .sev-medium .severity-badge { background: #c9a227; color: black; }
  .sev-low .severity-badge { background: #5a5a5a; color: white; }
  .validator-id { font-family: monospace; opacity: 0.8; }
  .unavailable { font-style: italic; opacity: 0.6; }
  .finding-type { font-family: monospace; font-size: 0.85em; opacity: 0.7; margin-top: 4px; }
  .finding-message { margin-top: 6px; }
  .evidence pre {
    font-size: 0.8em;
    background: rgba(255,255,255,0.04);
    padding: 6px;
    border-radius: 3px;
    overflow-x: auto;
  }
  .actions {
    margin-top: 8px;
    display: flex;
    gap: 6px;
  }
  button {
    background: var(--vscode-button-secondaryBackground, #2a2a2a);
    color: var(--vscode-button-secondaryForeground, #fff);
    border: 1px solid var(--vscode-button-border, #555);
    padding: 4px 10px;
    cursor: pointer;
    font-size: 0.85em;
  }
  button:hover { background: var(--vscode-button-secondaryHoverBackground, #3a3a3a); }
</style>
