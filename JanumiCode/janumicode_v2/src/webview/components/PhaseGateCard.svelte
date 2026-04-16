<!--
  PhaseGateCard — renders a Phase Gate approval card.
  Based on JanumiCode Spec v2.3, §17.3.

  Approve button disabled until:
  - All consistency_report.warnings acknowledged
  - All System-Proposed Content approved/rejected
  - No severity: high Reasoning Review flaws unresolved
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';

  interface Props {
    record: SerializedRecord;
    ondecision?: (detail: {
      recordId: string;
      decision: { type: string; payload?: Record<string, unknown> };
    }) => void;
  }

  const { record, ondecision }: Props = $props();

  const content = $derived(record.content as Record<string, unknown>);
  const phaseId = $derived(record.phase_id ?? 'unknown');
  const hasUnresolvedWarnings = $derived(content.has_unresolved_warnings as boolean);
  const hasUnapprovedProposals = $derived(content.has_unapproved_proposals as boolean);
  const hasHighSeverityFlaws = $derived(content.has_high_severity_flaws as boolean);
  const canApprove = $derived(
    !hasUnresolvedWarnings && !hasUnapprovedProposals && !hasHighSeverityFlaws,
  );

  function approve() {
    ondecision?.({
      recordId: record.id,
      decision: { type: 'phase_gate_approval', payload: { phase_id: phaseId } },
    });
  }

  function reject() {
    ondecision?.({
      recordId: record.id,
      decision: { type: 'phase_gate_rejection', payload: { phase_id: phaseId } },
    });
  }
</script>

<div class="phase-gate-card">
  <div class="gate-header">
    <span class="gate-icon">&#x2693;</span>
    <span class="gate-title">Phase Gate — Phase {phaseId}</span>
  </div>

  <div class="gate-status">
    {#if hasUnresolvedWarnings}
      <div class="gate-blocker">Unresolved consistency warnings</div>
    {/if}
    {#if hasUnapprovedProposals}
      <div class="gate-blocker">Unapproved System-Proposed Content</div>
    {/if}
    {#if hasHighSeverityFlaws}
      <div class="gate-blocker">Unresolved high-severity Reasoning Review flaws</div>
    {/if}
    {#if canApprove}
      <div class="gate-ready">All criteria met — ready for approval</div>
    {/if}
  </div>

  <div class="gate-actions">
    <button class="btn-approve" disabled={!canApprove} onclick={approve}>
      Approve Phase Gate
    </button>
    <button class="btn-reject" onclick={reject}>
      Reject
    </button>
  </div>
</div>

<style>
  .phase-gate-card {
    position: relative;
    background: var(--jc-surface-container-low);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-md);
    overflow: hidden;
  }
  .phase-gate-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--jc-status-bar-width);
    background: var(--jc-tertiary);
  }

  .gate-header {
    display: flex;
    align-items: center;
    gap: var(--jc-space-lg);
    padding: var(--jc-space-xl) var(--jc-space-xl) var(--jc-space-xl) var(--jc-space-2xl);
    font-family: var(--jc-font-headline);
    font-weight: 700;
    font-size: 1em;
    color: var(--jc-on-surface);
  }
  .gate-icon {
    color: var(--jc-tertiary);
  }

  .gate-status {
    padding: var(--jc-space-md) var(--jc-space-2xl) var(--jc-space-lg);
  }

  .gate-blocker {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    color: var(--jc-error);
    font-size: 0.8em;
    margin-bottom: var(--jc-space-md);
    padding: var(--jc-space-md) var(--jc-space-lg);
    background: var(--jc-error-container-tint-soft);
    border-radius: var(--jc-radius-sm);
    border: 1px solid var(--jc-error-tint-medium);
  }
  .gate-blocker::before { content: '⚠'; margin-right: var(--jc-space-xs); }

  .gate-ready {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    color: var(--jc-tertiary);
    font-size: 0.8em;
    padding: var(--jc-space-md) var(--jc-space-lg);
    background: var(--jc-tertiary-container-tint-soft);
    border-radius: var(--jc-radius-sm);
  }
  .gate-ready::before { content: '✓'; font-weight: bold; }

  .gate-actions {
    display: flex;
    gap: var(--jc-space-lg);
    padding: var(--jc-space-lg) var(--jc-space-2xl) var(--jc-space-xl);
  }

  .btn-approve {
    flex: 1;
    padding: var(--jc-space-lg) var(--jc-space-2xl);
    background: var(--jc-tertiary);
    color: var(--jc-on-tertiary);
    border: none;
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-weight: 700;
    font-size: 0.7em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    transition: filter var(--jc-transition-fast);
  }
  .btn-approve:hover:not(:disabled) { filter: brightness(1.1); }
  .btn-approve:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-reject {
    flex: 1;
    padding: var(--jc-space-lg) var(--jc-space-2xl);
    background: var(--jc-error-tint-weak);
    color: var(--jc-error);
    border: 1px solid var(--jc-error-tint-strong);
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-weight: 700;
    font-size: 0.7em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    transition: background var(--jc-transition-fast);
  }
  .btn-reject:hover {
    background: var(--jc-error-tint-medium);
  }
</style>
