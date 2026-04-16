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
    position: relative;
    background: var(--jc-surface-container-low);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-md);
    overflow: hidden;
  }
  .mirror-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: var(--jc-status-bar-width);
    background: var(--jc-primary);
  }

  .mirror-header {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    padding: var(--jc-space-xl) var(--jc-space-xl) var(--jc-space-lg) var(--jc-space-2xl);
  }
  .mirror-icon { font-size: 1.1em; }
  .mirror-title {
    flex: 1;
    font-family: var(--jc-font-headline);
    font-weight: 600;
    font-size: 0.95em;
    color: var(--jc-on-surface);
  }

  .mirror-fields { padding: var(--jc-space-md) var(--jc-space-2xl) var(--jc-space-lg); }

  .mirror-field {
    margin-bottom: var(--jc-space-lg);
    padding: var(--jc-space-lg) var(--jc-space-lg);
    border-radius: var(--jc-radius-sm);
    border-left: 2px solid transparent;
    background: var(--jc-surface-container);
  }
  .mirror-field.annotated-system-proposed {
    background: var(--jc-warning-tint-weak);
    border-left-color: var(--jc-warning);
  }
  .mirror-field.annotated-conflict {
    background: var(--jc-error-tint-weak);
    border-left-color: var(--jc-error);
  }
  .mirror-field.annotated-assumption {
    background: var(--jc-warning-tint-weak);
    border-left-color: var(--jc-accent-amber);
  }

  .field-header {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    margin-bottom: var(--jc-space-md);
  }
  .field-label {
    font-family: var(--jc-font-body);
    font-weight: 600;
    font-size: 0.8em;
    color: var(--jc-on-surface);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .badge {
    font-size: 0.6em;
    padding: var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
  }
  .badge-system {
    background: var(--jc-warning-tint-strong);
    color: var(--jc-warning);
    border: 1px solid var(--jc-warning-tint-emphasis);
  }
  .badge-conflict {
    background: var(--jc-error-tint-medium);
    color: var(--jc-error);
    border: 1px solid var(--jc-error-tint-emphasis);
  }
  .badge-assumption {
    background: var(--jc-accent-amber-tint-soft);
    color: var(--jc-accent-amber);
    border: 1px solid var(--jc-accent-amber-tint-strong);
  }

  .annotation-text {
    font-size: 0.75em;
    color: var(--jc-on-surface-variant);
    font-style: italic;
    margin-bottom: var(--jc-space-md);
  }

  .field-value { font-size: 0.85em; color: var(--jc-on-surface-variant); }
  .value-scalar {
    display: block;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
  }
  .field-value pre {
    background: var(--jc-surface-container-lowest);
    color: var(--jc-secondary);
    padding: var(--jc-space-md) var(--jc-space-lg);
    border-radius: var(--jc-radius-sm);
    border: var(--jc-ghost-border);
    font-family: var(--jc-font-mono);
    font-size: 0.8em;
    overflow-x: auto;
    max-height: 220px;
    overflow-y: auto;
    margin: var(--jc-space-sm) 0 0;
  }

  .proposal-actions {
    display: flex;
    gap: var(--jc-space-md);
    margin-top: var(--jc-space-md);
  }
  .btn-small {
    padding: var(--jc-space-sm) var(--jc-space-lg);
    font-size: 0.7em;
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: all var(--jc-transition-fast);
  }
  .btn-approve-small {
    background: var(--jc-primary-container);
    color: var(--jc-on-primary-container);
    border: none;
  }
  .btn-approve-small:hover { filter: brightness(1.1); }
  .btn-reject-small {
    background: transparent;
    color: var(--jc-on-surface);
    border: var(--jc-ghost-border);
  }
  .btn-reject-small:hover { background: var(--jc-surface-container-high); }

  .mirror-actions {
    display: flex;
    gap: var(--jc-space-lg);
    padding: var(--jc-space-lg) var(--jc-space-2xl) var(--jc-space-xl);
  }
  .btn-approve {
    flex: 1;
    padding: var(--jc-space-lg) var(--jc-space-2xl);
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
  .btn-approve:hover { filter: brightness(1.1); }
  .btn-reject {
    flex: 1;
    padding: var(--jc-space-lg) var(--jc-space-2xl);
    background: var(--jc-surface-container-highest);
    color: var(--jc-on-surface);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
    font-family: var(--jc-font-body);
    font-weight: 700;
    font-size: 0.7em;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    transition: background var(--jc-transition-fast);
  }
  .btn-reject:hover { background: var(--jc-surface-bright); }

  /* ── Steel-man preamble ─────────────────────────────────────── */
  .mirror-steelman {
    padding: var(--jc-space-lg) var(--jc-space-2xl);
    font-size: 0.85em;
    color: var(--jc-on-surface-variant);
    font-style: italic;
    line-height: 1.5;
    border-left: 3px solid var(--jc-primary);
    margin: 0 var(--jc-space-2xl) var(--jc-space-lg);
    background: var(--jc-primary-tint-weak);
    border-radius: 0 var(--jc-radius-sm) var(--jc-radius-sm) 0;
    padding-left: var(--jc-space-lg);
  }

  /* ── Assumption-row layout ──────────────────────────────────── */
  .mirror-assumptions { padding: var(--jc-space-md) var(--jc-space-2xl) var(--jc-space-lg); }
  .assumption-row {
    margin-bottom: var(--jc-space-lg);
    padding: var(--jc-space-lg) var(--jc-space-lg);
    border-radius: var(--jc-radius-sm);
    border-left: 2px solid var(--jc-outline);
    background: var(--jc-surface-container);
    transition: opacity var(--jc-transition-base);
  }
  .assumption-header {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    flex-wrap: wrap;
    margin-bottom: var(--jc-space-md);
  }
  .mmp-category-badge {
    font-size: 0.6em;
    padding: var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    background: var(--jc-surface-container-highest);
    color: var(--jc-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge-source {
    font-size: 0.55em;
    padding: var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .badge-source-doc { background: var(--jc-accent-blue-tint-strong); color: var(--jc-accent-blue); border: 1px solid var(--jc-accent-blue-tint-strong); }
  .badge-source-user { background: var(--jc-accent-green-tint-strong); color: var(--jc-tertiary); border: 1px solid var(--jc-accent-green-tint-strong); }
  .badge-source-standard { background: var(--jc-accent-purple-tint-strong); color: var(--jc-accent-purple); border: 1px solid var(--jc-accent-purple-tint-strong); }
  .badge-source-ai { background: var(--jc-accent-amber-tint-strong); color: var(--jc-warning); border: 1px solid var(--jc-accent-amber-tint-strong); }
  .assumption-text {
    flex: 1;
    font-size: 0.85em;
    color: var(--jc-on-surface);
  }
  .assumption-rationale {
    margin: var(--jc-space-md) 0;
    font-size: 0.8em;
  }
  .assumption-rationale summary {
    cursor: pointer;
    font-style: italic;
    color: var(--jc-outline);
  }
  .assumption-rationale p {
    margin: var(--jc-space-sm) 0 0;
    padding-left: var(--jc-space-lg);
    border-left: 2px solid var(--jc-outline-variant);
    color: var(--jc-on-surface-variant);
  }
  .assumption-actions {
    display: flex;
    gap: var(--jc-space-md);
    margin-top: var(--jc-space-md);
    flex-wrap: wrap;
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
  .mmp-defer:hover { background: var(--jc-warning-tint-soft); color: var(--jc-warning); }
  .mmp-edit:hover { background: var(--jc-primary-tint-soft); color: var(--jc-primary); }
  .mmp-btn.selected {
    border-color: var(--jc-primary);
    background: var(--jc-primary-tint-soft);
    font-weight: 700;
    color: var(--jc-primary);
  }
  .assumption-row.decided { opacity: 0.8; }
  .staged-badge {
    font-size: 0.55em;
    padding: var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-left: auto;
    flex-shrink: 0;
  }
  .staged-accepted { background: var(--jc-tertiary-tint-medium); color: var(--jc-tertiary); }
  .staged-rejected { background: var(--jc-error-tint-medium); color: var(--jc-error); }
  .staged-deferred { background: var(--jc-warning-tint-medium); color: var(--jc-warning); }
  .staged-edited   { background: var(--jc-primary-tint-medium); color: var(--jc-primary); }

  /* ── Submit bar ─────────────────────────────────────────────── */
  .mirror-submit-bar {
    display: flex;
    align-items: center;
    gap: var(--jc-space-lg);
    flex-wrap: wrap;
    padding: var(--jc-space-lg) var(--jc-space-2xl);
    background: var(--jc-surface-container);
  }
  .progress-counter {
    font-family: var(--jc-font-mono);
    font-size: 0.7em;
    color: var(--jc-outline);
    font-weight: 500;
  }
  .bulk-actions { display: flex; gap: var(--jc-space-md); }
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
