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
  }

  const { record, ondecision }: Props = $props();

  // Derive title + fields from the content. Fallback to legacy "dump all
  // top-level keys" rendering ONLY when content.fields is missing entirely
  // (e.g. malformed record, partial reload state) so we never show nothing.
  const content = $derived(record.content as Record<string, unknown>);

  const title = $derived(
    content.artifact_type && typeof content.artifact_type === 'string'
      ? formatTitle(content.artifact_type)
      : 'Mirror',
  );

  const fields = $derived.by<MirrorField[]>(() => {
    if (Array.isArray(content.fields)) {
      return content.fields as MirrorField[];
    }
    // Fallback: turn plain content into synthetic fields so a malformed
    // record still renders something human-readable.
    return Object.entries(content)
      .filter(([k]) => !['mirror_id', 'artifact_id', 'artifact_type', 'kind', 'fields'].includes(k))
      .map(([k, v]) => ({
        label: formatLabel(k),
        value: v,
        annotation: null,
        annotationText: null,
        requiresApproval: false,
      }));
  });

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
    <span class="mirror-icon">&#x1F6AA;</span>
    <span class="mirror-title">Mirror · {title}</span>
  </div>

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
</style>
