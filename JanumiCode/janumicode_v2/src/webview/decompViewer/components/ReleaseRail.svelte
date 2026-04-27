<script lang="ts">
  import { snapshot, filterReleaseIds } from '../stores/snapshot';

  function toggleRelease(id: string | null): void {
    if (id === null) {
      filterReleaseIds.set(null);
      return;
    }
    const cur = $filterReleaseIds ? new Set($filterReleaseIds) : new Set<string>();
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    filterReleaseIds.set(cur.size === 0 ? null : cur);
  }
</script>

<aside class="release-rail">
  <h2>Releases</h2>
  {#if $snapshot}
    <button class="rail-item" class:active={$filterReleaseIds === null} onclick={() => toggleRelease(null)}>
      <span class="ord">·</span>
      <span class="name">All releases</span>
      <span class="count">{$snapshot.totals.roots} roots</span>
    </button>
    {#each $snapshot.releases as r}
      <button
        class="rail-item"
        class:active={$filterReleaseIds?.has(r.release_id) ?? false}
        onclick={() => toggleRelease(r.release_id)}
      >
        <span class="ord">{r.ordinal}</span>
        <span class="name">{r.name}</span>
        <span class="count">
          {r.counts.journeys}j/{r.counts.workflows}w/{r.counts.entities}e
        </span>
      </button>
    {/each}
    {#if $snapshot.cross_cutting.workflows + $snapshot.cross_cutting.compliance + $snapshot.cross_cutting.integrations + $snapshot.cross_cutting.vocabulary > 0}
      <div class="cross-cutting">
        <div class="label">Cross-cutting</div>
        <div class="cc-row">wf: {$snapshot.cross_cutting.workflows}</div>
        <div class="cc-row">comp: {$snapshot.cross_cutting.compliance}</div>
        <div class="cc-row">int: {$snapshot.cross_cutting.integrations}</div>
        <div class="cc-row">voc: {$snapshot.cross_cutting.vocabulary}</div>
      </div>
    {/if}

    <h2 style="margin-top: 18px;" title="Wave 6 saturation pipeline — one per requirement kind. Each pass is one decomposer LLM call cycle that produces leaf nodes and surfaces new assumptions; the pipeline terminates when no new nodes are produced (saturation) or the call budget is hit.">Decomposition Pipelines</h2>
    {#each $snapshot.pipelines as p}
      <div class="pipeline">
        <div class="label">
          {p.root_kind === 'nfr' ? 'NFR Decomposition (Phase 2.2a)' : 'FR Decomposition (Phase 2.1a)'}
          <span class="pipeline-totals" title="Passes that ran · LLM calls consumed · max depth reached">
            {p.passes.length} pass{p.passes.length === 1 ? '' : 'es'}
            {#if p.budget_calls_used !== undefined} · {p.budget_calls_used} calls{/if}
            {#if p.max_depth_reached !== undefined} · depth {p.max_depth_reached}{/if}
          </span>
        </div>
        <div class="pass-list">
          {#each p.passes as pp}
            <div
              class="pass-row"
              class:completed={pp.status === 'completed'}
              title="Pass {pp.pass_number} ({pp.status}): produced {pp.nodes_produced} new decomposition nodes; surfaced {pp.assumption_delta >= 0 ? '+' : ''}{pp.assumption_delta} assumption{Math.abs(pp.assumption_delta) === 1 ? '' : 's'}{pp.termination_reason ? ' · terminated: ' + pp.termination_reason : ''}"
            >
              <span>pass {pp.pass_number}</span>
              <span class="pass-stats">
                {pp.nodes_produced} nodes
                · {pp.assumption_delta >= 0 ? '+' : ''}{pp.assumption_delta} asm
              </span>
            </div>
          {/each}
        </div>
        {#if p.termination_reason}
          <div class="termination">
            ⏹ {p.termination_reason}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</aside>

<style>
  /* Rail at Level 1 (surface-container-low); tree area at Level 0;
     separation is the background step, not a border. */
  .release-rail {
    background: var(--jc-surface-container-low);
    padding: var(--jc-space-lg) var(--jc-space-md);
    overflow-y: auto;
    font-size: 13px;
  }
  h2 {
    margin: 0 0 var(--jc-space-md) 0;
    font-family: var(--jc-font-headline);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--jc-on-surface-variant);
    font-weight: 500;
  }
  .rail-item {
    width: 100%;
    display: grid;
    grid-template-columns: 24px 1fr auto;
    gap: var(--jc-space-md);
    padding: var(--jc-space-sm) var(--jc-space-md);
    background: transparent;
    border: none;
    color: var(--jc-on-surface);
    cursor: pointer;
    text-align: left;
    border-radius: var(--jc-radius-sm);
    align-items: baseline;
    font-family: inherit;
    transition: background var(--jc-transition-fast);
    margin-bottom: var(--jc-space-xs);
  }
  .rail-item:hover { background: var(--jc-surface-bright); }
  .rail-item.active {
    background: var(--jc-primary-container);
    color: var(--jc-on-primary-container);
  }
  .ord {
    color: var(--jc-on-surface-variant);
    font-family: var(--jc-font-headline);
    font-size: 15px;
    font-weight: 500;
  }
  .rail-item.active .ord { color: var(--jc-on-primary-container); }
  .name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
  .count {
    color: var(--jc-on-surface-variant);
    font-family: var(--jc-font-mono);
    font-size: 11px;
  }
  .rail-item.active .count { color: var(--jc-on-primary-container); opacity: 0.75; }
  .cross-cutting {
    margin-top: var(--jc-space-md);
    padding: var(--jc-space-md);
    background: var(--jc-surface-container);
    border-radius: var(--jc-radius-sm);
    font-family: var(--jc-font-mono);
    font-size: 12px;
  }
  .cross-cutting .label {
    color: var(--jc-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: var(--jc-space-sm);
    font-family: var(--jc-font-body);
    font-size: 11px;
    font-weight: 500;
  }
  .cc-row { color: var(--jc-on-surface); padding: 1px 0; }
  .pipeline { margin-bottom: var(--jc-space-lg); }
  .pipeline .label {
    font-size: 11px;
    color: var(--jc-on-surface);
    margin-bottom: var(--jc-space-sm);
    font-weight: 600;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pipeline-totals {
    font-size: 10px;
    color: var(--jc-on-surface-variant);
    font-family: var(--jc-font-mono);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }
  .pass-stats { font-size: 11px; }
  .pass-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .pass-row {
    display: flex;
    justify-content: space-between;
    padding: var(--jc-space-xs) var(--jc-space-md);
    background: var(--jc-surface-container);
    border-radius: var(--jc-radius-xs);
    font-family: var(--jc-font-mono);
    font-size: 12px;
    color: var(--jc-on-surface-variant);
  }
  .pass-row.completed { color: var(--jc-tertiary); }
  .termination {
    margin-top: var(--jc-space-sm);
    padding: var(--jc-space-sm) var(--jc-space-md);
    background: var(--jc-error-container);
    color: var(--jc-on-error-container);
    border-radius: var(--jc-radius-sm);
    font-size: 11px;
  }
</style>
