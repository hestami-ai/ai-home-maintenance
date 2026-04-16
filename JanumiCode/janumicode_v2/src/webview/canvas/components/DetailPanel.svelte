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
          {#if typeof node.content.description === 'string'}
            <p class="description">{node.content.description}</p>
          {:else if typeof node.content.summary === 'string'}
            <p class="description">{node.content.summary}</p>
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
    background: var(--surface-container);
    border-left: 1px solid var(--outline);
    display: flex;
    flex-direction: column;
    font-size: 13px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--outline);
    background: var(--surface-container-high);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--on-surface);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 20px;
    color: var(--on-surface-variant);
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--on-surface);
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
    color: var(--on-surface-variant);
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
    color: var(--on-surface-variant);
  }

  .field-list dd {
    margin: 0;
    color: var(--on-surface);
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
    background: var(--surface-container-highest);
    color: var(--on-surface-variant);
  }

  .status-generating {
    background: var(--tertiary-container);
    color: var(--on-tertiary-container);
  }

  .status-complete {
    background: var(--primary-container);
    color: var(--on-primary-container);
  }

  .status-flagged {
    background: var(--error-container);
    color: var(--on-error-container);
  }

  .content-preview {
    background: var(--surface-container-highest);
    padding: 8px 12px;
    border-radius: 6px;
  }

  .description {
    margin: 0;
    line-height: 1.5;
    color: var(--on-surface);
  }

  .description.muted {
    color: var(--on-surface-variant);
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
    color: var(--on-surface);
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
