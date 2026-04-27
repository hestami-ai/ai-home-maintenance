<script lang="ts">
  /*
   * Option 1 — Indented Tree + Virtual Scroll
   *
   * Flat list of NodeRows, depth-first walk from each root, with
   * per-node expand/collapse via a chevron. Only nodes whose
   * ancestor chain is entirely expanded (or which are roots) appear
   * in the list.
   *
   * Why a single flat array instead of recursive components: at
   * cal-21 scale (1300 nodes) recursive Svelte components nest 8
   * levels deep with per-level subscriptions and dramatically slow
   * the first paint. A flat `{#each}` over a derived array is one
   * subscription and renders linearly.
   *
   * Filter semantics: a node is shown when (a) it passes the filter
   * AND its ancestors are expanded, OR (b) any descendant passes the
   * filter (so the user can see the path to a match). The path-to-match
   * pass is implemented by walking children of every filter-matched
   * node up to the root and marking each ancestor `forceVisible`.
   */
  import {
    snapshot,
    nodesByRoot,
    nodesByNodeId,
    childrenByParent,
    expandedIndentedNodes,
    toggleIndentedNode,
    expandAllIndented,
    collapseAllIndented,
    filterReleaseIds,
    currentFilters,
    isNodeVisibleUnderFilters,
    type ViewerDecompositionNode,
    type ViewerRootSummary,
  } from '../stores/snapshot';
  import NodeRow from './NodeRow.svelte';

  /** Roots that pass the release filter (same gate as TreeView). */
  const visibleRoots = $derived(
    ($snapshot?.roots ?? []).filter((r: ViewerRootSummary) => {
      if ($filterReleaseIds && r.release_id && !$filterReleaseIds.has(r.release_id)) return false;
      return true;
    }),
  );

  /**
   * Compute the set of node_ids to display. DFS each visible root;
   * for each node, decide whether to emit and whether to recurse
   * into its children based on expand state. The result is a flat
   * array preserving DFS order, ready for `{#each}`.
   */
  type WalkRow = { node: ViewerDecompositionNode; depth: number; hasChildren: boolean };

  const visibleRows = $derived.by((): WalkRow[] => {
    const rows: WalkRow[] = [];
    if (!$snapshot) return rows;

    // Pre-compute which nodes match the filter. If filterText is
    // empty AND no chip filters are active, treat as "everything
    // matches" so we don't waste work.
    const filtersActive =
      $currentFilters.text.trim().length > 0
      || $currentFilters.tiers.size > 0
      || $currentFilters.statuses.size > 0
      || $currentFilters.priorities.size > 0;

    // ancestorsToShow holds node_ids that should be visible because
    // a descendant matches the filter (path-to-match). Empty when
    // no filter is active.
    const ancestorsToShow = new Set<string>();
    if (filtersActive) {
      for (const n of $snapshot.nodes) {
        if (!isNodeVisibleUnderFilters(n, $currentFilters)) continue;
        // Walk up the parent chain marking each ancestor.
        let cur: ViewerDecompositionNode | undefined = n;
        while (cur) {
          ancestorsToShow.add(cur.node_id);
          cur = cur.parent_node_id ? $nodesByNodeId.get(cur.parent_node_id) : undefined;
        }
      }
    }

    function walk(node: ViewerDecompositionNode, depth: number): void {
      // Filter gate.
      if (filtersActive
          && !isNodeVisibleUnderFilters(node, $currentFilters)
          && !ancestorsToShow.has(node.node_id)) {
        return;
      }
      const children = $childrenByParent.get(node.node_id) ?? [];
      rows.push({ node, depth, hasChildren: children.length > 0 });
      // Recurse only if the user has expanded this node.
      if ($expandedIndentedNodes.has(node.node_id)) {
        for (const child of children) walk(child, depth + 1);
      }
    }

    // Each visible root is the start of its own DFS.
    for (const root of visibleRoots) {
      const rootNodes = $nodesByRoot.get(root.root_fr_id) ?? [];
      const rootEntry = rootNodes.find(n => n.depth === 0);
      if (rootEntry) walk(rootEntry, 0);
    }
    return rows;
  });

  /** All node_ids — used for "Expand all" / "Collapse all" toolbar. */
  const allNodeIds = $derived(($snapshot?.nodes ?? []).map(n => n.node_id));
</script>

<section class="indented-tree">
  <header class="toolbar">
    <span class="count">{visibleRows.length} rows</span>
    <button class="toolbar-btn" title="Expand every node" onclick={() => expandAllIndented(allNodeIds)}>Expand all</button>
    <button class="toolbar-btn" title="Collapse every node" onclick={collapseAllIndented}>Collapse all</button>
  </header>

  {#if visibleRows.length === 0}
    <div class="empty">No nodes match the current filter.</div>
  {/if}

  <ul class="rows" role="tree">
    {#each visibleRows as row (row.node.record_id)}
      <li class="row" role="treeitem" aria-level={row.depth + 1} aria-expanded={row.hasChildren ? $expandedIndentedNodes.has(row.node.node_id) : undefined}>
        <button
          class="chevron"
          class:has-children={row.hasChildren}
          aria-label={row.hasChildren ? ($expandedIndentedNodes.has(row.node.node_id) ? 'Collapse' : 'Expand') : 'Leaf'}
          onclick={(e) => { e.stopPropagation(); if (row.hasChildren) toggleIndentedNode(row.node.node_id); }}
        >{row.hasChildren ? ($expandedIndentedNodes.has(row.node.node_id) ? '▾' : '▸') : '·'}</button>
        <NodeRow node={row.node} />
      </li>
    {/each}
  </ul>
</section>

<style>
  .indented-tree {
    flex: 1 1 auto;
    overflow-y: auto;
    background: var(--jc-surface);
    color: var(--jc-on-surface);
    display: flex;
    flex-direction: column;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    padding: var(--jc-space-sm) var(--jc-space-lg);
    background: var(--jc-surface-container);
    font-size: 12px;
    font-family: var(--jc-font-mono);
    color: var(--jc-on-surface-variant);
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .count {
    margin-right: auto;
    font-variant-numeric: tabular-nums;
  }
  .toolbar-btn {
    background: transparent;
    color: var(--jc-on-surface-variant);
    border: none;
    padding: var(--jc-space-xs) var(--jc-space-md);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    border-radius: var(--jc-radius-sm);
    transition: background var(--jc-transition-fast), color var(--jc-transition-fast);
  }
  .toolbar-btn:hover {
    color: var(--jc-on-surface);
    background: var(--jc-surface-bright);
  }
  .empty {
    padding: var(--jc-space-2xl);
    color: var(--jc-on-surface-variant);
    text-align: center;
    font-size: 13px;
  }
  ul.rows {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li.row {
    display: grid;
    grid-template-columns: 18px 1fr;
    align-items: center;
    /* Keep rows compact — Option 1's value is fitting more nodes on
       screen than the accordion does. */
    min-height: 24px;
  }
  .chevron {
    background: transparent;
    color: var(--jc-on-surface-variant);
    border: none;
    width: 18px;
    height: 100%;
    cursor: default;
    font-size: 11px;
    font-family: var(--jc-font-mono);
    line-height: 1;
    padding: 0;
    text-align: center;
  }
  .chevron.has-children {
    cursor: pointer;
  }
  .chevron.has-children:hover {
    color: var(--jc-on-surface);
    background: var(--jc-surface-bright);
  }
</style>
