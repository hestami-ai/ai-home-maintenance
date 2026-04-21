<!--
  Card — dispatches to the appropriate card renderer based on record_type.
  Routes mirror_presented / decision_bundle_presented / phase_gate_evaluation
  to the specialized cards; renders raw_intent_received / open_query_received
  / client_liaison_response with friendlier previews.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { recordsStore } from '../stores/records.svelte';
  import { PHASE_NAMES, type PhaseId } from '../../lib/types/records';
  import { formatTimestamp } from '../utils/timestamps';
  import MirrorCard from './MirrorCard.svelte';
  import PhaseGateCard from './PhaseGateCard.svelte';
  import AgentInvocationCard from './AgentInvocationCard.svelte';
  import PreMortemCard from './PreMortemCard.svelte';
  import DecisionBundleCard from './DecisionBundleCard.svelte';
  import DmrPipelineCard from './DmrPipelineCard.svelte';
  import DecompositionNodeCard from './DecompositionNodeCard.svelte';
  import AssumptionSnapshotCard from './AssumptionSnapshotCard.svelte';
  import DecompositionPipelineCard from './DecompositionPipelineCard.svelte';

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

  // "Human" badge surfaces on cards that represent user intent or a
  // direct human decision. Agent-produced records stay with their agent
  // role badge. Matches v1's role-human styling.
  const humanRecordTypes = new Set<string>([
    'raw_intent_received',
    'open_query_received',
    'mirror_approved',
    'mirror_rejected',
    'mirror_edited',
    'phase_gate_approved',
    'phase_gate_rejected',
    'decision_trace',
    'rollback_authorized',
    'quarantine_override',
    'warning_acknowledged',
    'warning_batch_acknowledged',
  ]);
  const isHumanRecord = $derived(humanRecordTypes.has(record.record_type));
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

  // DMR detail records (retrieval_brief_record, query_decomposition_record,
  // context_packet, or the Stage 1/7 agent_invocation cards themselves)
  // are rendered inline inside DmrPipelineCard when a sibling
  // dmr_pipeline record references them via `output_record_id`. Hide
  // them from top-level so the DMR pipeline surfaces as one card.
  const isDmrDetailChild = $derived(recordsStore.isReferencedByDmrPipeline(record));

  // Wave 6 — decomposition-tree descendants (depth ≥ 1) render nested
  // inside their root node's card, so suppress at top level.
  const isNonRootDecomp = $derived(recordsStore.isNonRootDecompositionNode(record));

  // Wave 6 follow-up — a decomposition pipeline container owns the
  // tree + snapshot records for its root_kind. When the container
  // exists, suppress the owned records at top level (they render nested
  // inside the pipeline card). Superseded pipeline versions are also
  // hidden so only the latest pipeline card appears.
  const isSupersededPipeline = $derived(recordsStore.isSupersededDecompositionPipeline(record));
  const isOwnedByPipeline = $derived(recordsStore.isOwnedByDecompositionPipeline(record));
</script>

<!-- Agent child records: skip at top level (rendered nested by AgentInvocationCard) -->
{#if isAgentChild}
  <!-- deliberately empty — rendered by parent AgentInvocationCard -->
<!-- DMR detail records: skip at top level (rendered inline by DmrPipelineCard) -->
{:else if isDmrDetailChild}
  <!-- deliberately empty — rendered by DmrPipelineCard -->
<!-- Wave 6: non-root decomposition nodes render inside root DecompositionNodeCard -->
{:else if isNonRootDecomp}
  <!-- deliberately empty — rendered nested by the root's DecompositionNodeCard -->
<!-- Wave 6 follow-up: superseded pipeline container records are hidden -->
{:else if isSupersededPipeline}
  <!-- deliberately empty — only the latest pipeline record per pipeline_id renders -->
<!-- Wave 6 follow-up: nodes + snapshots owned by a pipeline render nested inside its card -->
{:else if isOwnedByPipeline}
  <!-- deliberately empty — rendered inside DecompositionPipelineCard -->
<!-- DMR pipeline composite card -->
{:else if record.record_type === 'dmr_pipeline'}
  <div data-record-id={record.id} data-phase-id={record.phase_id}>
    <DmrPipelineCard {record} />
  </div>
<!-- Wave 6 follow-up: decomposition pipeline composite (latest per pipeline_id) -->
{:else if record.record_type === 'requirement_decomposition_pipeline'}
  <div data-record-id={record.id} data-phase-id={record.phase_id}>
    <DecompositionPipelineCard {record} />
  </div>
<!-- Wave 6: decomposition root (depth-0) when no pipeline card exists -->
{:else if record.record_type === 'requirement_decomposition_node'}
  <div data-record-id={record.id} data-phase-id={record.phase_id}>
    <DecompositionNodeCard {record} />
  </div>
<!-- Wave 6: assumption snapshot per saturation pass when no pipeline card exists -->
{:else if record.record_type === 'assumption_set_snapshot'}
  <div data-record-id={record.id} data-phase-id={record.phase_id}>
    <AssumptionSnapshotCard {record} />
  </div>
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
{:else if record.record_type === 'decision_bundle_presented'}
  <div data-record-id={record.id}>
    <DecisionBundleCard {record} {vscode} />
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
      {#if isHumanRecord}
        <span class="role-badge role-human">Human</span>
      {:else}
        <span class="role-badge">{roleLabel}</span>
      {/if}
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
    position: relative;
    background: var(--jc-surface-container-low);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-md);
    overflow: hidden;
    /* Inherit the 16px body size — no shrink. Earlier iterations used
       0.85em / 0.92em which compounded through em-based descendants
       down to 8–10px on output blocks. Cards now read at full body
       size and badges / meta labels handle their own smaller em
       reductions independently. */
    font-size: 1em;
    transition: background var(--jc-transition-base);
  }
  .card:hover {
    background: var(--jc-surface-container);
  }

  /* ── Status Bar (3px left edge) ──────────────────────────────── */
  .card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--jc-status-bar-width);
  }

  .card-header {
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
  .card-header:hover { background: var(--jc-surface-container-high); }

  .role-badge {
    font-family: var(--jc-font-body);
    font-weight: 600;
    font-size: 0.8em;
    color: var(--jc-on-surface);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .role-badge.role-human {
    background: var(--jc-primary-container-tint-soft);
    color: var(--jc-primary);
    padding: var(--jc-space-xs) var(--jc-space-lg);
    border-radius: var(--jc-radius-xs);
    font-size: 0.7em;
    letter-spacing: 0.08em;
  }
  .record-type {
    font-family: var(--jc-font-mono);
    font-size: 0.7em;
    color: var(--jc-outline);
  }
  .phase-badge {
    background: var(--jc-surface-container-highest);
    color: var(--jc-on-surface-variant);
    padding: var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    font-family: var(--jc-font-mono);
    font-size: 0.65em;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border: var(--jc-ghost-border);
  }
  .quarantined-badge {
    background: var(--jc-error-container-tint-soft);
    color: var(--jc-error);
    padding: var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    font-size: 0.65em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .collapse-indicator {
    margin-left: auto;
    color: var(--jc-outline);
    font-size: 0.65em;
    transition: transform var(--jc-transition-base);
  }

  .card-content {
    padding: var(--jc-space-lg) var(--jc-space-xl);
  }
  .content-preview {
    margin-bottom: var(--jc-space-lg);
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.9em;
    color: var(--jc-on-surface-variant);
    line-height: 1.5;
  }
  .provenance {
    display: flex;
    flex-wrap: wrap;
    gap: var(--jc-space-md);
    margin-bottom: var(--jc-space-lg);
  }
  .ref-chip {
    font-family: var(--jc-font-mono);
    font-size: 0.65em;
    background: var(--jc-primary-container-tint-soft);
    color: var(--jc-primary);
    padding: var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    cursor: help;
  }
  .raw-content { margin-top: var(--jc-space-lg); }
  .raw-content summary {
    cursor: pointer;
    color: var(--jc-outline);
    font-size: 0.8em;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .raw-content pre {
    background: var(--jc-surface-container-lowest);
    color: var(--jc-secondary);
    padding: var(--jc-space-lg) var(--jc-space-lg);
    border-radius: var(--jc-radius-sm);
    border: var(--jc-ghost-border);
    overflow-x: auto;
    font-family: var(--jc-font-mono);
    font-size: 0.75em;
    max-height: 300px;
    overflow-y: auto;
    margin-top: var(--jc-space-md);
  }
  .card-meta {
    display: flex;
    gap: var(--jc-space-lg);
    margin-top: var(--jc-space-lg);
    font-family: var(--jc-font-mono);
    font-size: 0.7em;
    color: var(--jc-outline);
  }

  /* ── Card Category Accents (status bar color) ──────────────── */
  .card-phase_milestone::before { background: var(--jc-tertiary); }
  .card-agent_output::before { background: var(--jc-primary); }
  .card-human_interaction::before { background: var(--jc-primary); }
  .card-review_result::before { background: var(--jc-warning); }
  .card-system_event::before { background: var(--jc-outline); }
  .card-warning::before { background: var(--jc-error); }
  .card-liaison_response::before { background: var(--jc-accent-pink); }
  .card-user_input {
    margin-left: var(--jc-space-2xl);
    background: var(--jc-primary-container-tint-soft);
  }
  .card-user_input::before { background: var(--jc-primary); }

  .card.quarantined {
    opacity: 0.7;
  }
  .card.quarantined::before {
    background: var(--jc-error) !important;
  }
</style>
