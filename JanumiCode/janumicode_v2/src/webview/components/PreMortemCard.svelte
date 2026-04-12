<!--
  PreMortemCard — severity-graded risk evaluation card.
  Matches v1's MMP pre-mortem pattern from mmpRenderer.ts lines 269-329.

  Triggers on `mirror_presented` records with `content.kind === 'pre_mortem'`.
  Each risk row shows severity badge + assumption text + failure scenario +
  optional mitigation. Per-row Accept Risk / Unacceptable buttons. Rationale
  textarea appears on reject.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { decisionStagingStore } from '../stores/decisionStaging.svelte';

  interface PreMortemItem {
    id: string;
    assumption: string;
    severity: 'critical' | 'medium' | 'low';
    failureScenario: string;
    mitigation?: string;
    status: 'pending' | 'accepted' | 'rejected';
    rationale?: string;
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
  const summary = $derived((content.summary as string) ?? '');
  const risks = $derived.by<PreMortemItem[]>(() => {
    if (Array.isArray(content.risks)) return content.risks as PreMortemItem[];
    return [];
  });

  const stagedCount = $derived(decisionStagingStore.countByCard(record.id));

  function acceptRisk(item: PreMortemItem) {
    decisionStagingStore.stage(record.id, { itemId: item.id, action: 'accepted' });
  }

  function rejectRisk(item: PreMortemItem) {
    decisionStagingStore.stage(record.id, { itemId: item.id, action: 'rejected' });
  }

  function acceptAllRisks() {
    for (const r of risks) {
      decisionStagingStore.stage(record.id, { itemId: r.id, action: 'accepted' });
    }
  }

  function submitDecisions() {
    if (vscode) {
      decisionStagingStore.submit(record.id, vscode);
    } else {
      // Fallback: dispatch aggregate approval via ondecision.
      ondecision?.({
        recordId: record.id,
        decision: { type: 'mirror_approval' },
      });
    }
  }
</script>

<div class="premortem-card">
  <div class="pm-header">
    <span class="pm-icon">⚠️</span>
    <span class="pm-title">Pre-Mortem — Risks to evaluate</span>
  </div>

  {#if summary}
    <div class="pm-summary">{summary}</div>
  {/if}

  <div class="pm-risks">
    {#each risks as item (item.id)}
      {@const itemDecision = decisionStagingStore.getItemDecision(record.id, item.id)}
      <div class="pm-risk-row">
        <div class="pm-risk-header">
          <span class="severity-badge severity-{item.severity}">{item.severity.toUpperCase()}</span>
          <span class="pm-assumption">{item.assumption}</span>
        </div>
        <div class="pm-failure">
          <strong>If this fails:</strong> {item.failureScenario}
        </div>
        {#if item.mitigation}
          <div class="pm-mitigation">
            <strong>Mitigation:</strong> {item.mitigation}
          </div>
        {/if}
        <div class="pm-actions">
          <button class="mmp-btn mmp-accept" class:selected={itemDecision?.action === 'accepted'} onclick={() => acceptRisk(item)}>✓ Accept Risk</button>
          <button class="mmp-btn mmp-reject" class:selected={itemDecision?.action === 'rejected'} onclick={() => rejectRisk(item)}>✗ Unacceptable</button>
        </div>
      </div>
    {/each}
  </div>

  <div class="pm-footer">
    <span class="progress-counter">Risks: {stagedCount}/{risks.length} evaluated</span>
    <button class="bulk-btn" onclick={acceptAllRisks}>Accept All</button>
    {#if vscode}
      <button class="btn-submit-decisions" disabled={stagedCount === 0} onclick={submitDecisions}>
        Submit Decisions ({stagedCount})
      </button>
    {:else}
      <button class="btn-approve" onclick={submitDecisions}>Submit</button>
    {/if}
  </div>
</div>

<style>
  .premortem-card {
    border: 1px solid var(--vscode-panel-border, #333);
    border-left: 3px solid var(--vscode-charts-orange, #d18616);
    border-radius: 4px;
    overflow: hidden;
  }

  .pm-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--vscode-editor-background);
    font-weight: bold;
    font-size: 0.9em;
  }
  .pm-title { flex: 1; }

  .pm-summary {
    padding: 6px 10px;
    font-size: 0.85em;
    opacity: 0.8;
    border-bottom: 1px solid var(--vscode-panel-border, #333);
  }

  .pm-risks { padding: 6px 10px; }

  .pm-risk-row {
    margin-bottom: 10px;
    padding: 6px 8px;
    border-radius: 3px;
    border-left: 2px solid var(--vscode-descriptionForeground, #888);
    background: rgba(100, 100, 100, 0.04);
  }

  .pm-risk-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .severity-badge {
    font-size: 0.65em;
    font-weight: bold;
    padding: 1px 6px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .severity-critical { background: #ef4444; color: #fff; }
  .severity-medium { background: #f59e0b; color: #222; }
  .severity-low { background: #22c55e; color: #fff; }

  .pm-assumption { font-size: 0.85em; flex: 1; }

  .pm-failure, .pm-mitigation {
    font-size: 0.8em;
    margin: 4px 0;
    padding-left: 8px;
  }
  .pm-failure { color: var(--vscode-inputValidation-errorForeground, #f88); }
  .pm-mitigation { opacity: 0.8; }

  .pm-actions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }

  .mmp-btn {
    padding: 2px 8px;
    font-size: 0.75em;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
    border: 1px solid var(--vscode-panel-border, #555);
    background: transparent;
    color: var(--vscode-foreground);
  }
  .mmp-btn:hover { background: var(--vscode-list-hoverBackground); }
  .mmp-accept:hover { background: rgba(34, 197, 94, 0.15); }
  .mmp-reject:hover { background: rgba(244, 71, 71, 0.15); }

  .pm-footer {
    display: flex;
    gap: 8px;
    padding: 8px 10px;
    border-top: 1px solid var(--vscode-panel-border, #333);
  }

  .btn-approve {
    padding: 4px 16px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-approve:hover { background: var(--vscode-button-hoverBackground); }

  .mmp-btn.selected {
    border-color: var(--vscode-focusBorder);
    background: var(--vscode-list-activeSelectionBackground);
    font-weight: bold;
  }
  .progress-counter {
    font-size: 0.8em;
    opacity: 0.7;
    font-weight: bold;
  }
  .bulk-btn {
    padding: 2px 8px;
    font-size: 0.7em;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
    border: 1px solid var(--vscode-panel-border, #555);
    background: transparent;
    color: var(--vscode-foreground);
    opacity: 0.7;
  }
  .bulk-btn:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
  .btn-submit-decisions {
    margin-left: auto;
    padding: 4px 16px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
    font-weight: bold;
  }
  .btn-submit-decisions:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-submit-decisions:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
</style>
