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
    border: 2px solid var(--vscode-terminal-ansiGreen, #4ec9b0);
    border-radius: 4px;
    overflow: hidden;
  }

  .gate-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--vscode-editor-background);
    font-weight: bold;
  }

  .gate-status { padding: 8px 12px; }

  .gate-blocker {
    color: var(--vscode-inputValidation-errorForeground, #f88);
    font-size: 0.85em;
    margin-bottom: 4px;
  }

  .gate-blocker::before { content: '⚠ '; }

  .gate-ready {
    color: var(--vscode-terminal-ansiGreen, #4ec9b0);
    font-size: 0.85em;
  }

  .gate-ready::before { content: '✓ '; }

  .gate-actions {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--vscode-panel-border, #333);
  }

  .btn-approve {
    padding: 6px 20px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-weight: bold;
  }

  .btn-approve:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-reject {
    padding: 6px 20px;
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 3px;
    cursor: pointer;
  }
</style>
