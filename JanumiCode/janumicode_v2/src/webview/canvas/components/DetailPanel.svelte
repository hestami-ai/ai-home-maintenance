/**
 * Detail Panel Component.
 *
 * Displays details for the selected node including identity, content,
 * traceability links, and warnings.
 *
 * Wave 11: Detail Panel
 */

<script lang="ts">
  import type { CanvasNode } from '../types';

  interface Props {
    node: CanvasNode | null;
    onClose: () => void;
  }

  let { node, onClose }: Props = $props();

  function getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      artifact: 'Artifact',
      requirement: 'Requirement',
      component: 'Component',
      adr: 'ADR',
      test_case: 'Test Case',
      acceptance_criterion: 'Acceptance Criterion',
      software_domain: 'Software Domain',
      responsibility: 'Responsibility',
      api_endpoint: 'API Endpoint',
      data_model: 'Data Model',
      sequence_diagram: 'Sequence Diagram',
      implementation_task: 'Implementation Task',
      test_suite: 'Test Suite',
      functional_eval_criterion: 'Functional Eval Criterion',
      quality_eval_criterion: 'Quality Eval Criterion',
      reasoning_scenario: 'Reasoning Scenario',
      consistency_report: 'Consistency Report',
    };
    return labels[type] ?? type;
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      generating: 'Generating',
      complete: 'Complete',
      flagged: 'Flagged',
    };
    return labels[status] ?? status;
  }

  function getStatusClass(status: string): string {
    return `status-${status}`;
  }

  // Safely get array from content
  function getStringArray(key: string): string[] {
    const value = node?.content?.[key];
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    return [];
  }

  const satisfiesReqs = $derived(getStringArray('satisfies_requirement_ids'));
  const governsComps = $derived(getStringArray('governs_components'));
  const warnings = $derived(getStringArray('warnings'));

  /**
   * Decompose the content object into a list of human-readable rows
   * for the Content section. Strings render as paragraphs; arrays as
   * "<key>: N items"; nested objects as "<key>: {N keys}". Skips
   * presentation-only fields already shown elsewhere (description,
   * summary, warnings) and infrastructure fields (kind, id, title).
   * Used as a fallback when the artifact has no description/summary
   * top-level field — e.g., implementation_plan exposes tasks[],
   * total_tasks, complexity_flagged_count and nothing else.
   */
  const HIDDEN_KEYS = new Set([
    'kind', 'id', 'title', 'description', 'summary', 'result',
    'warnings', 'satisfies_requirement_ids', 'governs_components',
  ]);

  type RowKind = 'string' | 'number' | 'bool' | 'list' | 'object';
  interface ContentRow {
    key: string;
    kind: RowKind;
    value: string;
    /** Bullet items for list/object kinds — rendered as nested ul. */
    items?: string[];
  }

  /**
   * Compress one item from a heterogeneous content array down to a
   * single readable bullet line. Strings pass through; objects with an
   * obvious headline field (description / action / name / id) use that;
   * everything else collapses to "{key1, key2, ...}" so the user at
   * least sees what shape is hiding there.
   */
  function bulletForArrayItem(item: unknown): string {
    if (typeof item === 'string') return item;
    if (typeof item === 'number' || typeof item === 'boolean') return String(item);
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      for (const k of ['description', 'action', 'name', 'title', 'summary', 'id']) {
        const v = obj[k];
        if (typeof v === 'string' && v.length > 0) return v;
      }
      return `{${Object.keys(obj).slice(0, 4).join(', ')}}`;
    }
    return '';
  }

  /** Render a nested object to bullets — one per top-level string/number field. */
  function bulletsForObject(obj: Record<string, unknown>): string[] {
    const out: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.length > 0) out.push(`${prettifyKey(k)}: ${v}`);
      else if (typeof v === 'number' || typeof v === 'boolean') out.push(`${prettifyKey(k)}: ${String(v)}`);
      else if (Array.isArray(v)) out.push(`${prettifyKey(k)}: ${v.length} item${v.length === 1 ? '' : 's'}`);
    }
    return out;
  }

  function summarizeContent(content: Record<string, unknown> | undefined): ContentRow[] {
    if (!content) return [];
    const rows: ContentRow[] = [];
    for (const [key, value] of Object.entries(content)) {
      if (HIDDEN_KEYS.has(key)) continue;
      if (typeof value === 'string') {
        rows.push({ key, kind: 'string', value });
      } else if (typeof value === 'number') {
        rows.push({ key, kind: 'number', value: String(value) });
      } else if (typeof value === 'boolean') {
        rows.push({ key, kind: 'bool', value: String(value) });
      } else if (Array.isArray(value)) {
        const bullets = value.map(bulletForArrayItem).filter(s => s.length > 0);
        rows.push({
          key, kind: 'list',
          value: `${value.length} item${value.length === 1 ? '' : 's'}`,
          items: bullets,
        });
      } else if (value && typeof value === 'object') {
        const bullets = bulletsForObject(value as Record<string, unknown>);
        rows.push({ key, kind: 'object', value: '', items: bullets });
      }
    }
    return rows;
  }

  function prettifyKey(key: string): string {
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  const contentRows = $derived(summarizeContent(node?.content));
  /**
   * Primary text resolution order:
   *   description → summary → result (Claude Code CLI envelope —
   *   Phase 9 task executions persist their narrative under `result`).
   * When none are present, the structured contentRows render instead.
   */
  function getPrimaryText(content: Record<string, unknown> | undefined): string | null {
    if (!content) return null;
    for (const key of ['description', 'summary', 'result']) {
      const v = content[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    // User-story shape: synthesize the canonical "As a / I want / so
    // that" line from role + action + outcome. Sub-artifact nodes
    // extracted from functional_requirements.user_stories[] don't
    // carry description/summary, so without this they'd fall through
    // to structured rows even though the prose form is the natural
    // representation.
    const role = content.role;
    const action = content.action;
    const outcome = content.outcome;
    if (typeof role === 'string' && typeof action === 'string') {
      const so = typeof outcome === 'string' && outcome.length > 0 ? `, so that ${outcome}` : '';
      return `As a ${role}, I want to ${action}${so}.`;
    }
    return null;
  }
  const primaryText = $derived(getPrimaryText(node?.content));
</script>

{#if node}
  <div class="detail-panel">
    <div class="panel-header">
      <h3>Node Details</h3>
      <button class="close-btn" onclick={onClose} aria-label="Close panel">×</button>
    </div>

    <div class="panel-content">
      <!-- Identity Section -->
      <section class="section identity-section">
        <h4>Identity</h4>
        <dl class="field-list">
          <dt>ID</dt>
          <dd class="node-id">{node.id}</dd>

          <dt>Type</dt>
          <dd class="node-type">{getTypeLabel(node.type)}</dd>

          <dt>Phase</dt>
          <dd class="node-phase">Phase {node.phaseId}</dd>

          <dt>Status</dt>
          <dd class="node-status {getStatusClass(node.status)}">
            {getStatusLabel(node.status)}
          </dd>
        </dl>
      </section>

      <!-- Content Section -->
      <section class="section content-section">
        <h4>Content</h4>
        <div class="content-preview">
          {#if primaryText}
            <p class="description">{primaryText}</p>
          {:else if contentRows.length > 0}
            <dl class="content-rows">
              {#each contentRows as row}
                <dt>{prettifyKey(row.key)}</dt>
                <dd class="row-value row-{row.kind}">
                  {#if row.kind === 'list' || row.kind === 'object'}
                    {#if row.items && row.items.length > 0}
                      <ul class="row-bullets">
                        {#each row.items as item}<li>{item}</li>{/each}
                      </ul>
                    {:else}
                      <span class="muted">{row.value}</span>
                    {/if}
                  {:else}
                    {row.value}
                  {/if}
                </dd>
              {/each}
            </dl>
          {:else}
            <p class="description muted">No description available</p>
          {/if}
        </div>
      </section>

      <!-- Traceability Links Section -->
      <section class="section links-section">
        <h4>Traceability</h4>
        <ul class="links-list">
          {#if satisfiesReqs.length > 0}
            {#each satisfiesReqs as reqId}
              <li>
                <span class="link-type">satisfies</span>
                <span class="link-target">{reqId}</span>
              </li>
            {/each}
          {/if}
          {#if governsComps.length > 0}
            {#each governsComps as compId}
              <li>
                <span class="link-type">governs</span>
                <span class="link-target">{compId}</span>
              </li>
            {/each}
          {/if}
          {#if node.parentRecordId}
            <li>
              <span class="link-type">parent</span>
              <span class="link-target">{node.parentRecordId}</span>
            </li>
          {/if}
        </ul>
      </section>

      <!-- Warnings Section -->
      {#if node.status === 'flagged' && warnings.length > 0}
        <section class="section warnings-section">
          <h4>Warnings</h4>
          <ul class="warnings-list">
            {#each warnings as warning}
              <li class="warning-item">{warning}</li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  </div>
{/if}

<style>
  .detail-panel {
    position: absolute;
    top: 0;
    right: 0;
    width: 320px;
    height: 100%;
    background: var(--jc-surface-container, #202020);
    border-left: 1px solid var(--jc-outline, #5C5C5C);
    display: flex;
    flex-direction: column;
    font-size: 13px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--jc-outline, #5C5C5C);
    background: var(--jc-surface-container-high, #2A2A2A);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--jc-on-surface, #E5E2E1);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 20px;
    color: var(--jc-on-surface-variant, #A0A0A0);
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--jc-on-surface, #E5E2E1);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
  }

  .section {
    margin-bottom: 16px;
  }

  .section h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--jc-on-surface-variant, #A0A0A0);
  }

  .field-list {
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
  }

  .field-list dt {
    font-weight: 500;
    color: var(--jc-on-surface-variant, #A0A0A0);
  }

  .field-list dd {
    margin: 0;
    color: var(--jc-on-surface, #E5E2E1);
  }

  .node-id {
    font-family: monospace;
    font-size: 12px;
  }

  .node-status {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .status-pending {
    background: var(--jc-surface-container-highest, #353535);
    color: var(--jc-on-surface-variant, #A0A0A0);
  }

  .status-generating {
    background: var(--jc-tertiary-container, #2A4A45);
    color: var(--jc-on-tertiary-container, #C8E6C9);
  }

  .status-complete {
    background: var(--jc-primary-container, #1B3A5F);
    color: var(--jc-on-primary-container, #BFD8FF);
  }

  .status-flagged {
    background: var(--jc-error-container, #5C1F1F);
    color: var(--jc-on-error-container, #FFB4AB);
  }

  .content-preview {
    background: var(--jc-surface-container-highest, #353535);
    padding: 8px 12px;
    border-radius: 6px;
  }

  .description {
    margin: 0;
    line-height: 1.5;
    color: var(--jc-on-surface, #E5E2E1);
  }

  .description.muted {
    color: var(--jc-on-surface-variant, #A0A0A0);
    font-style: italic;
  }

  .content-rows {
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    font-size: 12px;
  }

  .content-rows dt {
    font-weight: 500;
    color: var(--jc-on-surface-variant, #A0A0A0);
  }

  .content-rows dd {
    margin: 0;
    color: var(--jc-on-surface, #E5E2E1);
    word-break: break-word;
  }

  .row-bullets {
    list-style: disc;
    padding-left: 16px;
    margin: 2px 0 0 0;
  }

  .row-bullets li {
    margin: 1px 0;
    line-height: 1.4;
  }

  .row-value .muted {
    color: var(--jc-on-surface-variant, #A0A0A0);
    font-style: italic;
  }

  .links-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .links-list li {
    display: flex;
    gap: 8px;
    padding: 4px 0;
  }

  .link-type {
    font-size: 11px;
    font-weight: 500;
    color: var(--tertiary);
    text-transform: uppercase;
  }

  .link-target {
    font-family: monospace;
    font-size: 12px;
    color: var(--jc-on-surface, #E5E2E1);
  }

  .warnings-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .warning-item {
    padding: 8px 12px;
    background: var(--warning-container);
    color: var(--on-warning-container);
    border-radius: 6px;
    margin-bottom: 4px;
    font-size: 12px;
  }
</style>
