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
    position: relative;
    background: var(--jc-surface-container-low);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-md);
    overflow: hidden;
  }
  .premortem-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: var(--jc-status-bar-width);
    background: var(--jc-error);
  }

  .pm-header {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    padding: var(--jc-space-xl) var(--jc-space-xl) var(--jc-space-lg) var(--jc-space-2xl);
  }
  .pm-icon { font-size: 1.1em; }
  .pm-title {
    flex: 1;
    font-family: var(--jc-font-headline);
    font-weight: 600;
    font-size: 0.95em;
    color: var(--jc-on-surface);
  }

  .pm-summary {
    padding: var(--jc-space-md) var(--jc-space-2xl) var(--jc-space-lg);
    font-size: 0.85em;
    color: var(--jc-on-surface-variant);
    line-height: 1.5;
  }

  .pm-risks { padding: var(--jc-space-md) var(--jc-space-2xl) var(--jc-space-lg); }

  .pm-risk-row {
    margin-bottom: var(--jc-space-lg);
    padding: var(--jc-space-lg) var(--jc-space-lg);
    border-radius: var(--jc-radius-sm);
    border-left: 2px solid var(--jc-outline);
    background: var(--jc-surface-container);
  }

  .pm-risk-header {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    margin-bottom: var(--jc-space-md);
  }

  .severity-badge {
    font-size: 0.55em;
    font-weight: 700;
    padding: var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .severity-critical {
    background: var(--jc-error-tint-strong);
    color: var(--jc-error);
    border: 1px solid var(--jc-error-tint-emphasis);
  }
  .severity-medium {
    background: var(--jc-accent-amber-tint-strong);
    color: var(--jc-warning);
    border: 1px solid var(--jc-accent-amber-tint-strong);
  }
  .severity-low {
    background: var(--jc-tertiary-tint-strong);
    color: var(--jc-tertiary);
    border: 1px solid var(--jc-tertiary-tint-emphasis);
  }

  .pm-assumption {
    font-size: 0.85em;
    flex: 1;
    color: var(--jc-on-surface);
  }

  .pm-failure, .pm-mitigation {
    font-size: 0.8em;
    margin: var(--jc-space-sm) 0;
    padding-left: var(--jc-space-lg);
    line-height: 1.4;
  }
  .pm-failure { color: var(--jc-error); }
  .pm-mitigation { color: var(--jc-on-surface-variant); }

  .pm-actions {
    display: flex;
    gap: var(--jc-space-md);
    margin-top: var(--jc-space-md);
  }

  .mmp-btn {
    padding: var(--jc-space-sm) var(--jc-space-lg);
    font-size: 0.7em;
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-weight: 600;
    border: var(--jc-ghost-border);
    background: transparent;
    color: var(--jc-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    transition: all var(--jc-transition-fast);
  }
  .mmp-btn:hover { background: var(--jc-surface-container-high); }
  .mmp-accept:hover { background: var(--jc-tertiary-tint-soft); color: var(--jc-tertiary); }
  .mmp-reject:hover { background: var(--jc-error-tint-soft); color: var(--jc-error); }

  .pm-footer {
    display: flex;
    align-items: center;
    gap: var(--jc-space-lg);
    padding: var(--jc-space-lg) var(--jc-space-2xl);
    background: var(--jc-surface-container);
  }

  .btn-approve {
    padding: var(--jc-space-md) var(--jc-space-2xl);
    background: var(--jc-primary);
    color: var(--jc-on-primary);
    border: none;
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-weight: 700;
    font-size: 0.7em;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .btn-approve:hover { filter: brightness(1.1); }

  .mmp-btn.selected {
    border-color: var(--jc-primary);
    background: var(--jc-primary-tint-soft);
    font-weight: 700;
    color: var(--jc-primary);
  }
  .progress-counter {
    font-family: var(--jc-font-mono);
    font-size: 0.7em;
    color: var(--jc-outline);
    font-weight: 500;
  }
  .bulk-btn {
    padding: var(--jc-space-sm) var(--jc-space-lg);
    font-size: 0.65em;
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-weight: 600;
    border: var(--jc-ghost-border);
    background: transparent;
    color: var(--jc-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: all var(--jc-transition-fast);
  }
  .bulk-btn:hover { background: var(--jc-surface-container-high); color: var(--jc-on-surface); }
  .btn-submit-decisions {
    margin-left: auto;
    padding: var(--jc-space-md) var(--jc-space-2xl);
    background: var(--jc-primary);
    color: var(--jc-on-primary);
    border: none;
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-weight: 700;
    font-size: 0.7em;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    transition: filter var(--jc-transition-fast);
  }
  .btn-submit-decisions:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-submit-decisions:hover:not(:disabled) { filter: brightness(1.1); }
</style>
