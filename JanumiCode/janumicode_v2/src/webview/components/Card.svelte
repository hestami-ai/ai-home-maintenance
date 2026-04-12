<!--
  Card — dispatches to the appropriate card renderer based on record_type.
  Wave 5 update: routes mirror_presented / menu_presented / phase_gate_evaluation
  to the specialized cards; renders raw_intent_received / open_query_received
  / client_liaison_response with friendlier previews.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { recordsStore } from '../stores/records.svelte';
  import { PHASE_NAMES, type PhaseId } from '../../lib/types/records';
  import { formatTimestamp } from '../utils/timestamps';
  import MirrorCard from './MirrorCard.svelte';
  import MenuCard from './MenuCard.svelte';
  import PhaseGateCard from './PhaseGateCard.svelte';
  import AgentInvocationCard from './AgentInvocationCard.svelte';
  import PreMortemCard from './PreMortemCard.svelte';

  interface Props {
    record: SerializedRecord;
    ondecision?: (detail: { recordId: string; decision: { type: string; payload?: Record<string, unknown> } }) => void;
    vscode?: { postMessage(message: unknown): void };
  }

  const { record, ondecision, vscode }: Props = $props();

  type CardCategory =
    | 'phase_milestone'
    | 'agent_output'
    | 'human_interaction'
    | 'review_result'
    | 'system_event'
    | 'liaison_response'
    | 'user_input'
    | 'warning';

  function getCategory(recordType: string): CardCategory {
    switch (recordType) {
      case 'phase_gate_approved':
      case 'phase_gate_rejected':
        return 'phase_milestone';
      case 'phase_gate_evaluation':
      case 'mirror_presented':
      case 'menu_presented':
      case 'decision_bundle_presented':
        return 'human_interaction';
      case 'raw_intent_received':
      case 'open_query_received':
        return 'user_input';
      case 'client_liaison_response':
      case 'query_classification_record':
        return 'liaison_response';
      case 'reasoning_review_record':
      case 'reasoning_review_ensemble_record':
      case 'invariant_check_record':
      case 'domain_compliance_review_record':
        return 'review_result';
      case 'warning_acknowledged':
      case 'warning_batch_acknowledged':
      case 'ingestion_pipeline_failure':
      case 'consistency_challenge_escalation':
      case 'error':
        return 'warning';
      case 'artifact_produced':
      case 'agent_reasoning_step':
      case 'agent_output':
      case 'agent_self_correction':
      case 'tool_call':
      case 'intent_quality_report':
        return 'agent_output';
      default:
        return 'system_event';
    }
  }

  function getRoleLabel(role: string | null): string {
    if (!role) return 'System';
    return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function getContentPreview(content: Record<string, unknown>): string {
    if (typeof content.text === 'string') return content.text.slice(0, 300);
    if (typeof content.responseText === 'string') return content.responseText.slice(0, 300);
    if (typeof content.response_text === 'string') return content.response_text.slice(0, 300);
    if (typeof content.description === 'string') return content.description.slice(0, 200);
    if (typeof content.statement === 'string') return content.statement.slice(0, 200);
    if (typeof content.overall_status === 'string') return `Status: ${content.overall_status}`;
    if (typeof content.workspace_type === 'string') return `Workspace: ${content.workspace_type}`;
    if (typeof content.query_type === 'string') return `Type: ${content.query_type}`;
    const keys = Object.keys(content);
    if (keys.length === 0) return '(empty)';
    return `{${keys.slice(0, 5).join(', ')}${keys.length > 5 ? ', …' : ''}}`;
  }

  const category = $derived(getCategory(record.record_type));
  const roleLabel = $derived(getRoleLabel(record.produced_by_agent_role));
  const contentPreview = $derived(getContentPreview(record.content));
  const provenanceIds = $derived(
    Array.isArray((record.content as { provenance_record_ids?: string[] }).provenance_record_ids)
      ? (record.content as { provenance_record_ids: string[] }).provenance_record_ids
      : [],
  );
  let collapsed = $state(true);

  // Agent child records (agent_output, tool_call, agent_reasoning_step, etc.)
  // are rendered nested inside their parent AgentInvocationCard, NOT as
  // top-level cards. If this record is a child of an invocation, skip it.
  const isAgentChild = $derived(recordsStore.isChildOfInvocation(record));
</script>

<!-- Agent child records: skip at top level (rendered nested by AgentInvocationCard) -->
{#if isAgentChild}
  <!-- deliberately empty — rendered by parent AgentInvocationCard -->
<!-- Agent invocation card (always expanded, owns its children) -->
{:else if record.record_type === 'agent_invocation'}
  <div data-record-id={record.id} data-phase-id={record.phase_id}>
    <AgentInvocationCard {record} {ondecision} />
  </div>
<!-- Specialized cards (always expanded) -->
{:else if record.record_type === 'mirror_presented' && record.content.kind === 'pre_mortem'}
  <div data-record-id={record.id}>
    <PreMortemCard {record} {ondecision} {vscode} />
  </div>
{:else if record.record_type === 'mirror_presented'}
  <div data-record-id={record.id}>
    <MirrorCard {record} {ondecision} {vscode} />
  </div>
{:else if record.record_type === 'menu_presented' || record.record_type === 'decision_bundle_presented'}
  <div data-record-id={record.id}>
    <MenuCard {record} {ondecision} {vscode} />
  </div>
{:else if record.record_type === 'phase_gate_evaluation'}
  <div data-record-id={record.id}>
    <PhaseGateCard {record} {ondecision} />
  </div>
{:else}
  <!-- Generic card with category styling -->
  <div
    class="card card-{category}"
    class:quarantined={record.quarantined}
    data-record-id={record.id}
    data-phase-id={record.phase_id}
    data-phase-label={record.phase_id ? PHASE_NAMES[record.phase_id as PhaseId] : undefined}
  >
    <button class="card-header" onclick={() => (collapsed = !collapsed)}>
      <span class="role-badge">{roleLabel}</span>
      <span class="record-type">{record.record_type}</span>
      {#if record.phase_id}
        <span class="phase-badge">P{record.phase_id}</span>
      {/if}
      {#if record.quarantined}
        <span class="quarantined-badge">QUARANTINED</span>
      {/if}
      <span class="collapse-indicator">{collapsed ? '▶' : '▼'}</span>
    </button>

    {#if !collapsed}
      <div class="card-content">
        <div class="content-preview">{contentPreview}</div>
        {#if provenanceIds.length > 0}
          <div class="provenance">
            {#each provenanceIds as id (id)}
              <span class="ref-chip" title={id}>[ref:{id.slice(0, 8)}]</span>
            {/each}
          </div>
        {/if}

        <details class="raw-content">
          <summary>Raw JSON</summary>
          <pre>{JSON.stringify(record.content, null, 2)}</pre>
        </details>

        <div class="card-meta">
          <span class="timestamp" title={record.produced_at}>{formatTimestamp(record.produced_at)}</span>
          <span class="authority">Authority: {record.authority_level}</span>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .card {
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 4px;
    overflow: hidden;
    font-size: 0.85em;
  }
  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
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
  .card-header:hover { background: var(--vscode-list-hoverBackground); }

  .role-badge { font-weight: bold; font-size: 0.85em; }
  .record-type { opacity: 0.7; font-size: 0.8em; }
  .phase-badge {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 0.75em;
  }
  .quarantined-badge {
    background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
    color: var(--vscode-inputValidation-errorForeground, #f88);
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 0.75em;
  }
  .collapse-indicator { margin-left: auto; opacity: 0.5; font-size: 0.7em; }

  .card-content {
    padding: 8px 10px;
    border-top: 1px solid var(--vscode-panel-border, #333);
  }
  .content-preview {
    margin-bottom: 8px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .provenance {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }
  .ref-chip {
    font-size: 0.75em;
    background: var(--vscode-badge-background, #333);
    color: var(--vscode-badge-foreground, #ddd);
    padding: 1px 6px;
    border-radius: 8px;
    cursor: help;
  }
  .raw-content { margin-top: 8px; }
  .raw-content summary { cursor: pointer; opacity: 0.6; font-size: 0.85em; }
  .raw-content pre {
    background: var(--vscode-textCodeBlock-background);
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.8em;
    max-height: 300px;
    overflow-y: auto;
  }
  .card-meta {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    opacity: 0.5;
    font-size: 0.8em;
  }

  /* ── Card Category Accents ─────────────────────────────────── */
  .card-phase_milestone { border-left: 3px solid var(--vscode-terminal-ansiGreen, #4ec9b0); }
  .card-agent_output { border-left: 3px solid var(--vscode-terminal-ansiCyan, #9cdcfe); }
  .card-human_interaction { border-left: 3px solid var(--vscode-terminal-ansiBlue, #569cd6); }
  .card-review_result { border-left: 3px solid var(--vscode-terminal-ansiYellow, #dcdcaa); }
  .card-system_event { border-left: 3px solid var(--vscode-descriptionForeground, #888); }
  .card-warning { border-left: 3px solid var(--vscode-terminal-ansiRed, #f44747); }
  .card-liaison_response { border-left: 3px solid var(--vscode-terminal-ansiMagenta, #c586c0); }
  .card-user_input {
    border-left: 3px solid var(--vscode-textLink-foreground, #4da6ff);
    margin-left: 24px;
    background: var(--vscode-editor-inactiveSelectionBackground, rgba(80, 110, 200, 0.08));
  }

  .card.quarantined {
    border-color: var(--vscode-inputValidation-errorBorder, #f44747);
    opacity: 0.7;
  }
</style>
