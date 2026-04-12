<!--
  MirrorCard — renders a Mirror artifact with annotations.
  Based on JanumiCode Spec v2.3, §17.3.

  Expects the record's content to be a mirror_presented payload produced by
  Phase 1 / MirrorGenerator:

    content = {
      kind: 'intent_bloom_mirror' | 'intent_statement_mirror' | ...
      mirror_id: string
      artifact_id: string
      artifact_type: string
      fields: MirrorField[]           // the rendered, annotated field list
      candidates?: BloomCandidate[]   // (intent_bloom mirrors only)
    }

  We render the `fields` array, not the whole content object — dumping
  every top-level key would produce the JSON-blob view we had before.

  Annotations per MirrorField.annotation:
    - system_proposed          → yellow background, "System-proposed" badge
    - prior_decision_conflict  → red left-border, "Conflicts with prior decision" badge
    - assumption               → orange left-border, "Assumption" badge
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { decisionStagingStore } from '../stores/decisionStaging.svelte';

  interface MirrorField {
    label: string;
    value: unknown;
    annotation: 'system_proposed' | 'prior_decision_conflict' | 'assumption' | null;
    annotationText: string | null;
    requiresApproval: boolean;
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

  // ── Staging state for batched submission ───────────────────────
  const stagedCount = $derived(decisionStagingStore.countByCard(record.id));

  // Derive title + fields from the content. Fallback to legacy "dump all
  // top-level keys" rendering ONLY when content.fields is missing entirely
  // (e.g. malformed record, partial reload state) so we never show nothing.
  interface AssumptionItem {
    id: string;
    text: string;
    category: string;
    source: string;
    rationale?: string;
    status: string;
    editedText?: string;
  }

  const content = $derived(record.content as Record<string, unknown>);
  const isAssumptionMirror = $derived(content.kind === 'assumption_mirror');
  const steelMan = $derived((content.steelMan as string) ?? '');

  const title = $derived(
    content.artifact_type && typeof content.artifact_type === 'string'
      ? formatTitle(content.artifact_type)
      : 'Mirror',
  );

  // Assumption-row shape (from Phase 1.3 bloom prune surface)
  const assumptions = $derived.by<AssumptionItem[]>(() => {
    if (isAssumptionMirror && Array.isArray(content.assumptions)) {
      return content.assumptions as AssumptionItem[];
    }
    return [];
  });

  // Field-based shape (from intent_statement approval + other artifacts)
  const fields = $derived.by<MirrorField[]>(() => {
    if (isAssumptionMirror) return []; // assumptions path handles rendering
    if (Array.isArray(content.fields)) {
      return content.fields as MirrorField[];
    }
    // Fallback: turn plain content into synthetic fields so a malformed
    // record still renders something human-readable.
    return Object.entries(content)
      .filter(([k]) => !['mirror_id', 'artifact_id', 'artifact_type', 'kind', 'fields', 'assumptions', 'steelMan', 'candidates'].includes(k))
      .map(([k, v]) => ({
        label: formatLabel(k),
        value: v,
        annotation: null,
        annotationText: null,
        requiresApproval: false,
      }));
  });

  // ── Source badge helpers (v1-style DOC / USER / STANDARD / AI) ──
  function getSourceBadge(source: string): { label: string; cssClass: string } {
    switch (source) {
      case 'document_specified': return { label: 'DOC', cssClass: 'badge-source-doc' };
      case 'user_specified': return { label: 'USER', cssClass: 'badge-source-user' };
      case 'domain_standard': return { label: 'STD', cssClass: 'badge-source-standard' };
      case 'ai_proposed': return { label: 'AI', cssClass: 'badge-source-ai' };
      default: return { label: source.toUpperCase().slice(0, 4), cssClass: 'badge-source-ai' };
    }
  }

  function formatTitle(artifactType: string): string {
    return artifactType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value, null, 2);
  }

  function isScalar(value: unknown): boolean {
    return (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }

  function approveMirror() {
    ondecision?.({
      recordId: record.id,
      decision: { type: 'mirror_approval' as const },
    });
  }

  function rejectMirror() {
    ondecision?.({
      recordId: record.id,
      decision: { type: 'mirror_rejection' as const },
    });
  }

  function approveProposal(field: MirrorField) {
    ondecision?.({
      recordId: record.id,
      decision: {
        type: 'system_proposal_approval',
        payload: { field: field.label },
      },
    });
  }

  function rejectProposal(field: MirrorField) {
    ondecision?.({
      recordId: record.id,
      decision: {
        type: 'system_proposal_rejection',
        payload: { field: field.label },
      },
    });
  }
</script>

<div class="mirror-card">
  <div class="mirror-header">
    <span class="mirror-icon">{isAssumptionMirror ? '💭' : '🚪'}</span>
    <span class="mirror-title">Mirror · {title}</span>
  </div>

  {#if steelMan}
    <div class="mirror-steelman">{steelMan}</div>
  {/if}

  <!-- ── Assumption-row layout (v1-style, from Phase 1.3 bloom) ── -->
  {#if isAssumptionMirror && assumptions.length > 0}
    <div class="mirror-assumptions">
      {#each assumptions as item (item.id)}
        {@const badge = getSourceBadge(item.source)}
        {@const itemDecision = decisionStagingStore.getItemDecision(record.id, item.id)}
        <div class="assumption-row" class:decided={!!itemDecision}>
          <div class="assumption-header">
            <span class="mmp-category-badge">{item.category}</span>
            <span class="badge-source {badge.cssClass}" title="Source: {item.source}">{badge.label}</span>
            <span class="assumption-text">{item.text}</span>
            {#if itemDecision}
              <span class="staged-badge staged-{itemDecision.action}">
                {itemDecision.action === 'accepted' ? '✓' : itemDecision.action === 'rejected' ? '✗' : itemDecision.action === 'deferred' ? '⏳' : '✏'}
                {itemDecision.action}
              </span>
            {/if}
          </div>
          {#if item.rationale}
            <details class="assumption-rationale">
              <summary>Why?</summary>
              <p>{item.rationale}</p>
            </details>
          {/if}
          <div class="assumption-actions">
            <button class="mmp-btn mmp-accept" class:selected={itemDecision?.action === 'accepted'} onclick={() => decisionStagingStore.stage(record.id, { itemId: item.id, action: 'accepted' })}>✓ Accept</button>
            <button class="mmp-btn mmp-reject" class:selected={itemDecision?.action === 'rejected'} onclick={() => decisionStagingStore.stage(record.id, { itemId: item.id, action: 'rejected' })}>✗ Reject</button>
            <button class="mmp-btn mmp-defer" class:selected={itemDecision?.action === 'deferred'} onclick={() => decisionStagingStore.stage(record.id, { itemId: item.id, action: 'deferred' })}>⏳ Defer</button>
            <button class="mmp-btn mmp-edit" class:selected={itemDecision?.action === 'edited'} onclick={() => decisionStagingStore.stage(record.id, { itemId: item.id, action: 'edited' })}>✏ Edit</button>
          </div>
        </div>
      {/each}
    </div>

    <div class="mirror-submit-bar">
      <span class="progress-counter">Mirror: {stagedCount}/{assumptions.length} decisions made</span>
      <div class="bulk-actions">
        <button class="bulk-btn" onclick={() => { for (const a of assumptions) decisionStagingStore.stage(record.id, { itemId: a.id, action: 'accepted' }); }}>Accept All</button>
        <button class="bulk-btn" onclick={() => { for (const a of assumptions) decisionStagingStore.stage(record.id, { itemId: a.id, action: 'rejected' }); }}>Reject All</button>
        <button class="bulk-btn" onclick={() => { for (const a of assumptions) decisionStagingStore.stage(record.id, { itemId: a.id, action: 'deferred' }); }}>Defer All</button>
      </div>
      {#if vscode}
        <button
          class="btn-submit-decisions"
          disabled={stagedCount === 0}
          onclick={() => decisionStagingStore.submit(record.id, vscode)}
        >
          Submit Decisions ({stagedCount})
        </button>
      {:else}
        <!-- Fallback: dispatch individual approval if no vscode handle -->
        <button class="btn-approve" onclick={approveMirror}>Approve</button>
        <button class="btn-reject" onclick={rejectMirror}>Reject</button>
      {/if}
    </div>

  <!-- ── Field-based layout (intent_statement approval, other artifacts) ── -->
  {:else}
  <div class="mirror-fields">
    {#each fields as field, i (i)}
      <div
        class="mirror-field"
        class:annotated-system-proposed={field.annotation === 'system_proposed'}
        class:annotated-conflict={field.annotation === 'prior_decision_conflict'}
        class:annotated-assumption={field.annotation === 'assumption'}
      >
        <div class="field-header">
          <span class="field-label">{field.label}</span>
          {#if field.annotation === 'system_proposed'}
            <span class="badge badge-system">System-proposed</span>
          {:else if field.annotation === 'prior_decision_conflict'}
            <span class="badge badge-conflict">Conflicts with prior decision</span>
          {:else if field.annotation === 'assumption'}
            <span class="badge badge-assumption">Assumption</span>
          {/if}
        </div>

        {#if field.annotationText}
          <div class="annotation-text">{field.annotationText}</div>
        {/if}

        <div class="field-value">
          {#if isScalar(field.value)}
            <span class="value-scalar">{formatValue(field.value)}</span>
          {:else}
            <pre>{formatValue(field.value)}</pre>
          {/if}
        </div>

        {#if field.requiresApproval}
          <div class="proposal-actions">
            <button class="btn-small btn-approve-small" onclick={() => approveProposal(field)}>
              Approve proposal
            </button>
            <button class="btn-small btn-reject-small" onclick={() => rejectProposal(field)}>
              Reject proposal
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="mirror-actions">
    <button class="btn-approve" onclick={approveMirror}>Approve Mirror</button>
    <button class="btn-reject" onclick={rejectMirror}>Reject</button>
  </div>
  {/if}
</div>

<style>
  .mirror-card {
    border: 1px solid var(--vscode-panel-border, #333);
    border-left: 3px solid var(--vscode-terminal-ansiBlue, #569cd6);
    border-radius: 4px;
    overflow: hidden;
  }

  .mirror-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--vscode-editor-background);
    font-weight: bold;
    font-size: 0.9em;
  }
  .mirror-title { flex: 1; }

  .mirror-fields {
    padding: 6px 10px;
  }

  .mirror-field {
    margin-bottom: 10px;
    padding: 6px 8px;
    border-radius: 3px;
    border-left: 2px solid transparent;
  }

  .mirror-field.annotated-system-proposed {
    background: rgba(220, 190, 50, 0.08);
    border-left-color: var(--vscode-charts-yellow, #dcdcaa);
  }
  .mirror-field.annotated-conflict {
    background: rgba(244, 71, 71, 0.08);
    border-left-color: var(--vscode-terminal-ansiRed, #f44747);
  }
  .mirror-field.annotated-assumption {
    background: rgba(209, 134, 22, 0.08);
    border-left-color: var(--vscode-charts-orange, #d18616);
  }

  .field-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .field-label {
    font-weight: bold;
    font-size: 0.85em;
    text-transform: capitalize;
  }

  .badge {
    font-size: 0.7em;
    padding: 1px 6px;
    border-radius: 8px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .badge-system {
    background: var(--vscode-charts-yellow, #dcdcaa);
    color: #222;
  }
  .badge-conflict {
    background: var(--vscode-terminal-ansiRed, #f44747);
    color: #fff;
  }
  .badge-assumption {
    background: var(--vscode-charts-orange, #d18616);
    color: #fff;
  }

  .annotation-text {
    font-size: 0.75em;
    opacity: 0.75;
    font-style: italic;
    margin-bottom: 4px;
  }

  .field-value {
    font-size: 0.85em;
  }
  .value-scalar {
    display: block;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .field-value pre {
    background: var(--vscode-textCodeBlock-background);
    padding: 6px 8px;
    border-radius: 3px;
    font-size: 0.8em;
    overflow-x: auto;
    max-height: 220px;
    overflow-y: auto;
    margin: 0;
  }

  .proposal-actions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }

  .btn-small {
    padding: 2px 8px;
    font-size: 0.75em;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-approve-small {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
  }
  .btn-reject-small {
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border, #555);
  }

  .mirror-actions {
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
    font-weight: bold;
  }
  .btn-approve:hover {
    background: var(--vscode-button-hoverBackground);
  }
  .btn-reject {
    padding: 4px 16px;
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
  }

  /* ── Steel-man preamble ─────────────────────────────────────── */
  .mirror-steelman {
    padding: 8px 10px;
    font-size: 0.85em;
    opacity: 0.8;
    font-style: italic;
    border-bottom: 1px solid var(--vscode-panel-border, #333);
  }

  /* ── Assumption-row layout (v1 MMP style) ───────────────────── */
  .mirror-assumptions {
    padding: 6px 10px;
  }
  .assumption-row {
    margin-bottom: 8px;
    padding: 6px 8px;
    border-radius: 3px;
    border-left: 2px solid var(--vscode-descriptionForeground, #888);
    background: rgba(100, 100, 100, 0.04);
  }
  .assumption-header {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .mmp-category-badge {
    font-size: 0.7em;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    text-transform: capitalize;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge-source {
    font-size: 0.65em;
    padding: 1px 5px;
    border-radius: 6px;
    font-weight: bold;
    letter-spacing: 0.05em;
  }
  .badge-source-doc { background: #3b82f6; color: #fff; }
  .badge-source-user { background: #22c55e; color: #fff; }
  .badge-source-standard { background: #a855f7; color: #fff; }
  .badge-source-ai { background: #f59e0b; color: #222; }
  .assumption-text {
    flex: 1;
    font-size: 0.85em;
  }
  .assumption-rationale {
    margin: 4px 0;
    font-size: 0.8em;
    opacity: 0.7;
  }
  .assumption-rationale summary {
    cursor: pointer;
    font-style: italic;
  }
  .assumption-rationale p {
    margin: 4px 0 0;
    padding-left: 8px;
    border-left: 2px solid var(--vscode-descriptionForeground, #666);
  }
  .assumption-actions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
    flex-wrap: wrap;
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
  .mmp-defer:hover { background: rgba(245, 158, 11, 0.15); }
  .mmp-edit:hover { background: rgba(99, 102, 241, 0.15); }
  .mmp-btn.selected {
    border-color: var(--vscode-focusBorder);
    background: var(--vscode-list-activeSelectionBackground);
    font-weight: bold;
  }
  .assumption-row.decided {
    opacity: 0.85;
  }
  .staged-badge {
    font-size: 0.65em;
    padding: 1px 5px;
    border-radius: 6px;
    font-weight: bold;
    text-transform: capitalize;
    margin-left: auto;
    flex-shrink: 0;
  }
  .staged-accepted { background: rgba(34, 197, 94, 0.2); color: var(--vscode-terminal-ansiGreen); }
  .staged-rejected { background: rgba(244, 71, 71, 0.2); color: var(--vscode-terminal-ansiRed); }
  .staged-deferred { background: rgba(245, 158, 11, 0.2); color: var(--vscode-charts-orange); }
  .staged-edited   { background: rgba(99, 102, 241, 0.2); color: var(--vscode-terminal-ansiBlue); }

  /* ── Submit bar ─────────────────────────────────────────────── */
  .mirror-submit-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 8px 10px;
    border-top: 1px solid var(--vscode-panel-border, #333);
  }
  .progress-counter {
    font-size: 0.8em;
    opacity: 0.7;
    font-weight: bold;
  }
  .bulk-actions {
    display: flex;
    gap: 4px;
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
  .btn-submit-decisions:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-submit-decisions:hover:not(:disabled) {
    background: var(--vscode-button-hoverBackground);
  }
</style>
