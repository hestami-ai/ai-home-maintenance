<script lang="ts">
  import {
    snapshot,
    expandedRoots,
    expandedTierBands,
    toggleRoot,
    toggleTierBand,
    filterReleaseIds,
    currentFilters,
    nodesByRoot,
    isNodeVisibleUnderFilters,
    type ViewerDecompositionNode,
    type ViewerRootSummary,
  } from '../stores/snapshot';
  import NodeRow from './NodeRow.svelte';

  // Runes mode: $derived recomputes when any $store subscription inside
  // it changes. Legacy `$: ...` statements don't fire under runes.
  const visibleRoots = $derived(
    ($snapshot?.roots ?? []).filter((r: ViewerRootSummary) => {
      if ($filterReleaseIds && r.release_id && !$filterReleaseIds.has(r.release_id)) return false;
      return true;
    }),
  );

  function tierNodes(r: ViewerRootSummary, tier: 'A' | 'B' | 'C' | 'D' | 'null'): ViewerDecompositionNode[] {
    const all = $nodesByRoot.get(r.root_fr_id) ?? [];
    const filtered = all.filter(n => {
      const t = (n.tier ?? 'null') as 'A' | 'B' | 'C' | 'D' | 'null';
      if (t !== tier) return false;
      return isNodeVisibleUnderFilters(n, $currentFilters);
    });
    return filtered;
  }

  function isTierExpanded(rootId: string, tier: 'A' | 'B' | 'C' | 'D' | 'null'): boolean {
    return $expandedTierBands[rootId]?.has(tier) ?? false;
  }
  function isRootExpanded(rootId: string): boolean {
    return $expandedRoots.has(rootId);
  }

  const tiers: Array<'A' | 'B' | 'C' | 'D' | 'null'> = ['A', 'B', 'C', 'D', 'null'];
</script>

<section class="tree-view">
  {#if visibleRoots.length === 0}
    <div class="empty">No roots match the current filter.</div>
  {/if}
  {#each visibleRoots as root (root.root_fr_id)}
    <article class="root root-kind-{root.root_kind ?? 'fr'}">
      <button class="root-header" onclick={() => toggleRoot(root.root_fr_id)}>
        <span class="caret">{isRootExpanded(root.root_fr_id) ? '▾' : '▸'}</span>
        <span class="kind-badge kind-{root.root_kind ?? 'fr'}">{(root.root_kind ?? 'fr').toUpperCase()}</span>
        <span class="display-key">{root.display_key}</span>
        <span class="title">{root.title}</span>
        <span class="counts">
          A:{root.tier_counts.A} B:{root.tier_counts.B} C:{root.tier_counts.C} D:{root.tier_counts.D}
          {#if root.tier_counts.null > 0}·:{root.tier_counts.null}{/if}
          · {root.node_count_total}n · d{root.max_depth}
          {#if root.release_ordinal !== null}· R{root.release_ordinal}{/if}
        </span>
      </button>

      {#if isRootExpanded(root.root_fr_id)}
        <div class="tier-bands">
          {#each tiers as tier}
            {@const band = tierNodes(root, tier)}
            {#if band.length > 0}
              <div class="tier-band tier-{tier}">
                <button class="tier-header" onclick={() => toggleTierBand(root.root_fr_id, tier)}>
                  <span class="caret">{isTierExpanded(root.root_fr_id, tier) ? '▾' : '▸'}</span>
                  <span>Tier {tier === 'null' ? '—' : tier}</span>
                  <span class="band-count">{band.length} nodes</span>
                </button>
                {#if isTierExpanded(root.root_fr_id, tier)}
                  <div class="tier-nodes">
                    {#each band as n (n.record_id)}
                      <NodeRow node={n} />
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </article>
  {/each}
</section>

<style>
  /* Tree area at Level 0 (surface). Roots are "Governed Stream Cards"
     per DESIGN.md — no border, sit at Level 1, use a 3px status bar
     on the far-left edge to indicate health / root kind. */
  .tree-view {
    overflow-y: auto;
    padding: var(--jc-space-lg);
    font-size: 14px;
    background: var(--jc-surface);
  }
  .empty {
    padding: var(--jc-space-2xl);
    color: var(--jc-on-surface-variant);
    text-align: center;
    font-size: 14px;
  }
  .root {
    margin-bottom: var(--jc-space-lg);
    border-radius: var(--jc-radius-md);
    background: var(--jc-surface-container-low);
    overflow: hidden;
    position: relative;
  }
  /* 3px vertical status bar on the far left — color keyed by root kind. */
  .root::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: var(--jc-status-bar-width);
    background: var(--jc-outline-variant);
  }
  .root.root-kind-fr::before  { background: var(--jc-primary); }
  .root.root-kind-nfr::before { background: var(--jc-tertiary); }
  .root-header {
    width: 100%;
    display: grid;
    grid-template-columns: 20px auto auto 1fr auto;
    gap: var(--jc-space-md);
    align-items: baseline;
    padding: var(--jc-space-md) var(--jc-space-lg) var(--jc-space-md) calc(var(--jc-space-lg) + var(--jc-status-bar-width));
    background: var(--jc-surface-container);
    border: none;
    color: var(--jc-on-surface);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    font-size: 14px;
    transition: background var(--jc-transition-fast);
  }
  .root-header:hover { background: var(--jc-surface-container-high); }
  .caret {
    color: var(--jc-on-surface-variant);
    font-family: var(--jc-font-mono);
    transition: transform var(--jc-transition-fast);
  }
  .kind-badge {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    padding: 1px var(--jc-space-sm);
    border-radius: var(--jc-radius-xs);
    font-weight: 600;
    letter-spacing: 0.05em;
  }
  .kind-fr  { background: var(--jc-primary-tint-strong); color: var(--jc-primary); }
  .kind-nfr { background: color-mix(in srgb, var(--jc-tertiary) 20%, transparent); color: var(--jc-tertiary); }
  .display-key {
    font-family: var(--jc-font-mono);
    font-size: 13px;
    color: var(--jc-on-surface);
    font-weight: 500;
  }
  .title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--jc-on-surface);
  }
  .counts {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    color: var(--jc-on-surface-variant);
    white-space: nowrap;
  }
  .tier-bands { padding: var(--jc-space-sm) 0; }
  /* Tier band separator is the surface color step, not a border. */
  .tier-band { background: var(--jc-surface-container-low); }
  .tier-band + .tier-band { margin-top: 1px; }
  .tier-header {
    width: 100%;
    display: flex;
    gap: var(--jc-space-md);
    align-items: center;
    padding: var(--jc-space-sm) var(--jc-space-lg) var(--jc-space-sm) var(--jc-space-xl);
    background: transparent;
    border: none;
    color: var(--jc-on-surface);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    position: relative;
    transition: background var(--jc-transition-fast);
  }
  .tier-header:hover { background: var(--jc-surface-bright); }
  .band-count {
    margin-left: auto;
    color: var(--jc-on-surface-variant);
    font-family: var(--jc-font-mono);
    font-size: 11px;
  }
  /* Tier indicator — 3px inset bar instead of a border. */
  .tier-header::before {
    content: '';
    position: absolute;
    left: var(--jc-space-lg);
    top: 20%; bottom: 20%;
    width: var(--jc-status-bar-width);
    border-radius: 2px;
  }
  .tier-band.tier-A .tier-header::before { background: #C678DD; }
  .tier-band.tier-B .tier-header::before { background: #E5C07B; }
  .tier-band.tier-C .tier-header::before { background: var(--jc-primary); }
  .tier-band.tier-D .tier-header::before { background: var(--jc-tertiary); }
  .tier-band.tier-null .tier-header::before { background: var(--jc-outline-variant); }
  .tier-nodes {
    background: var(--jc-surface);
    padding: var(--jc-space-xs) 0;
  }
</style>
