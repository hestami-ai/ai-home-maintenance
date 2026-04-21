<!--
  DecompositionPipelineCard — Wave 6 composite card for a recursive
  requirements-decomposition run (FR or NFR). Mirrors DmrPipelineCard:
  shows the saturation loop's per-pass status (delta, nodes produced,
  duration) + final totals + termination reason + links into nested
  root-node cards and assumption-snapshot cards.

  One container record exists per (root_kind, run) pair, written
  incrementally through the saturation loop. This card reads the latest
  version (Card.svelte suppresses earlier pipeline records via
  `isSupersededDecompositionPipeline`), then renders all associated
  node + snapshot records inline.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { recordsStore } from '../stores/records.svelte';
  import DecompositionNodeCard from './DecompositionNodeCard.svelte';
  import AssumptionSnapshotCard from './AssumptionSnapshotCard.svelte';

  interface Props {
    record: SerializedRecord;
  }

  const { record }: Props = $props();

  interface PassEntry {
    pass_number: number;
    status: 'pending' | 'running' | 'completed' | 'terminated';
    started_at: string | null;
    completed_at: string | null;
    nodes_produced: number;
    assumption_delta: number;
    termination_reason?: 'fixed_point' | 'depth_cap' | 'budget_cap' | 'human_pruned_all';
  }

  interface PipelineContent {
    pipeline_id: string;
    root_fr_id: string;
    passes: PassEntry[];
    final_leaf_count?: number;
    final_max_depth?: number;
    total_llm_calls?: number;
  }

  const content = $derived(record.content as unknown as PipelineContent);
  const rootKind = $derived(content.root_fr_id === '*nfr*' ? 'nfr' : 'fr');
  const kindLabel = $derived(rootKind === 'nfr' ? 'NFR' : 'FR');
  const passes = $derived<PassEntry[]>(Array.isArray(content.passes) ? content.passes : []);

  // Gather the associated root nodes (depth 0) + assumption snapshots
  // for this pipeline's root_kind. Children of each root are rendered
  // recursively inside DecompositionNodeCard itself.
  const rootNodes = $derived(
    recordsStore.records.filter(r =>
      r.record_type === 'requirement_decomposition_node'
      && (r.content as { depth?: number; root_kind?: string }).depth === 0
      && ((r.content as { root_kind?: string }).root_kind ?? 'fr') === rootKind,
    ),
  );
  const snapshots = $derived(
    recordsStore.records.filter(r =>
      r.record_type === 'assumption_set_snapshot'
      && ((r.content as { root_fr_id?: string }).root_fr_id ?? '*') === content.root_fr_id,
    ),
  );

  let collapsed = $state(false);

  function passIcon(p: PassEntry): string {
    if (p.status === 'terminated') return '■';
    if (p.status === 'completed') return '·';
    if (p.status === 'running') return '⋯';
    return '○';
  }

  function durationMs(p: PassEntry): number | null {
    if (!p.started_at || !p.completed_at) return null;
    return new Date(p.completed_at).getTime() - new Date(p.started_at).getTime();
  }

  function formatDuration(ms: number | null): string {
    if (ms == null) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function terminationChipText(): string {
    const last = passes[passes.length - 1];
    if (!last?.termination_reason) return '';
    switch (last.termination_reason) {
      case 'fixed_point': return 'saturated (no new assumptions)';
      case 'depth_cap': return 'depth cap reached';
      case 'budget_cap': return 'budget cap reached';
      case 'human_pruned_all': return 'all branches pruned by human';
    }
    return last.termination_reason;
  }

  const isTerminated = $derived(content.final_leaf_count !== undefined);
</script>

<div class="pipeline-card pipeline-{rootKind}" data-record-id={record.id} data-phase-id={record.phase_id}>
  <button class="header" onclick={() => (collapsed = !collapsed)}>
    <span class="toggle">{collapsed ? '▶' : '▼'}</span>
    <span class="icon">◇</span>
    <span class="label">{kindLabel} Decomposition</span>
    <span class="meta">
      {passes.length} pass{passes.length === 1 ? '' : 'es'}
      {#if content.total_llm_calls !== undefined}· {content.total_llm_calls} LLM calls{/if}
    </span>
    {#if isTerminated}
      <span class="terminated-chip">{terminationChipText()}</span>
    {/if}
    {#if content.final_leaf_count !== undefined}
      <span class="leaf-count">{content.final_leaf_count} atomic leaves</span>
    {/if}
  </button>

  {#if !collapsed}
    <div class="body">
      <!-- Pass-by-pass table -->
      <section class="passes-section">
        <div class="section-label">Saturation passes</div>
        <ol class="passes">
          {#each passes as p (p.pass_number)}
            <li class="pass pass-{p.status}">
              <span class="pass-num">pass {p.pass_number}</span>
              <span class="pass-icon">{passIcon(p)}</span>
              <span class="pass-delta" class:pass-delta-zero={p.assumption_delta === 0}>
                Δ +{p.assumption_delta}
              </span>
              <span class="pass-nodes">{p.nodes_produced} nodes</span>
              <span class="pass-duration">{formatDuration(durationMs(p))}</span>
              {#if p.termination_reason}
                <span class="pass-term">[{p.termination_reason}]</span>
              {/if}
            </li>
          {/each}
        </ol>
      </section>

      <!-- Root-node trees for this pipeline's kind -->
      {#if rootNodes.length > 0}
        <section class="roots-section">
          <div class="section-label">Decomposition trees ({rootNodes.length} root{rootNodes.length === 1 ? '' : 's'})</div>
          {#each rootNodes as rn (rn.id)}
            <DecompositionNodeCard record={rn} />
          {/each}
        </section>
      {/if}

      <!-- Assumption snapshots -->
      {#if snapshots.length > 0}
        <section class="snapshots-section">
          <div class="section-label">Assumption snapshots ({snapshots.length})</div>
          {#each snapshots as s (s.id)}
            <AssumptionSnapshotCard record={s} />
          {/each}
        </section>
      {/if}

      <!-- Final totals -->
      {#if isTerminated}
        <section class="totals-section">
          <div class="section-label">Final totals</div>
          <dl class="totals">
            <dt>Atomic leaves</dt><dd>{content.final_leaf_count ?? 0}</dd>
            <dt>Max depth reached</dt><dd>{content.final_max_depth ?? 0}</dd>
            <dt>Total LLM calls</dt><dd>{content.total_llm_calls ?? 0}</dd>
          </dl>
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .pipeline-card {
    margin: 0.5em 0;
    border: 1px solid var(--vscode-panel-border, #444);
    border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
    background: var(--vscode-editor-background, #1e1e1e);
  }
  .pipeline-nfr {
    border-left-color: var(--vscode-editorWarning-foreground, #cca700);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.5em;
    width: 100%;
    padding: 0.5em 0.75em;
    background: transparent;
    border: none;
    color: var(--vscode-foreground, inherit);
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    text-align: left;
  }
  .toggle { width: 1em; color: var(--vscode-descriptionForeground, #888); }
  .icon { color: var(--vscode-textLink-foreground, #3794ff); }
  .pipeline-nfr .icon { color: var(--vscode-editorWarning-foreground, #cca700); }
  .label { font-weight: 600; }
  .meta {
    color: var(--vscode-descriptionForeground, #888);
    font-size: 0.85em;
    margin-right: auto;
  }
  .terminated-chip {
    font-size: 0.7em;
    padding: 0.05em 0.4em;
    border-radius: 0.2em;
    background: rgba(129, 199, 132, 0.25);
    color: var(--vscode-testing-iconPassed, #73c991);
    font-weight: 600;
    text-transform: uppercase;
  }
  .leaf-count {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground, #888);
    font-family: var(--vscode-editor-font-family, monospace);
  }

  .body { padding: 0 0.75em 0.75em; }
  .section-label {
    font-size: 0.75em;
    color: var(--vscode-descriptionForeground, #888);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0.75em 0 0.35em;
  }

  .passes { list-style: none; padding: 0; margin: 0; }
  .pass {
    display: grid;
    grid-template-columns: 5em 1.5em 5em 6em 5em 1fr;
    gap: 0.5em;
    align-items: center;
    padding: 0.25em 0;
    font-size: 0.85em;
    border-bottom: 1px dashed var(--vscode-panel-border, #333);
  }
  .pass:last-child { border-bottom: none; }
  .pass-num { font-family: var(--vscode-editor-font-family, monospace); color: var(--vscode-descriptionForeground, #888); }
  .pass-icon { text-align: center; }
  .pass-delta { font-variant-numeric: tabular-nums; color: var(--vscode-editorWarning-foreground, #cca700); }
  .pass-delta-zero { color: var(--vscode-testing-iconPassed, #73c991); }
  .pass-nodes { color: var(--vscode-descriptionForeground, #ccc); font-variant-numeric: tabular-nums; }
  .pass-duration { color: var(--vscode-descriptionForeground, #888); font-variant-numeric: tabular-nums; }
  .pass-term {
    font-size: 0.8em;
    color: var(--vscode-testing-iconPassed, #73c991);
  }

  .roots-section, .snapshots-section, .totals-section {
    margin-top: 0.5em;
  }
  .totals {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25em 1em;
    margin: 0.25em 0;
    font-size: 0.9em;
  }
  .totals dt { color: var(--vscode-descriptionForeground, #888); }
  .totals dd { margin: 0; font-family: var(--vscode-editor-font-family, monospace); }
</style>
