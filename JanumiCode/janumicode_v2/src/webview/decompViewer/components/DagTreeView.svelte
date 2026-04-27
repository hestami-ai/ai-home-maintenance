<script lang="ts">
  /*
   * DAG Tree (Option 3) — Phase 1 → Phase 2 traceability tree.
   *
   * Shape (top → bottom):
   *   Raw Intent → Intent Statement → [Functional forest, NFR forest]
   *   Each forest groups Phase 1 anchors (UJ, WF, ENT, …) under which
   *   FRs/NFRs hang. A root appears in full ("primary") under its
   *   primary_anchor_id; under each `secondary_anchor_ids` entry it
   *   appears as a "↪ → primary at <anchor>" reference link.
   *
   * Three edge types are visually distinguished:
   *   - decomposition (Wave 6 parent_node_id) — chevron expansion
   *     within a primary FR/NFR row.
   *   - traceability (anchor → root) — anchor expands to show roots.
   *   - qualification (NFR.applies_to_requirements → US) — rendered
   *     as a "qualified by:" footnote line under each FR row.
   *
   * Implementation notes: this component does NOT mutate the existing
   * IndentedTreeView. The two views share NodeRow, the snapshot
   * stores, and the FilterBar. expand state for anchors is a separate
   * `expandedDagAnchors` set; expand state for decomposition sub-trees
   * piggybacks on `expandedIndentedNodes` so an FR opened in Indented
   * stays opened when switched to DAG.
   */
  import {
    snapshot,
    dagModel,
    nodesByRoot,
    childrenByParent,
    expandedIndentedNodes,
    toggleIndentedNode,
    expandedDagAnchors,
    toggleDagAnchor,
    expandAllDagAnchors,
    collapseAllDagAnchors,
    type Phase1AnchorKind,
    type ViewerDecompositionNode,
    type ViewerPhase1Anchor,
  } from '../stores/snapshot';
  import NodeRow from './NodeRow.svelte';

  /** Section header labels for the two forests + anchor kind groups. */
  const KIND_LABELS: Record<Phase1AnchorKind, string> = {
    user_journey: 'User Journeys',
    system_workflow: 'System Workflows',
    entity: 'Entities',
    business_domain: 'Business Domains',
    persona: 'Personas',
    compliance_regime: 'Compliance Regimes',
    vv_quality_criterion: 'V&V Quality Criteria',
    technical_constraint: 'Technical Constraints',
  };

  /** Order kinds left-to-right within the FR forest. */
  const FR_KIND_ORDER: Phase1AnchorKind[] = [
    'user_journey', 'system_workflow', 'entity',
    'business_domain', 'persona', 'compliance_regime',
  ];
  const NFR_KIND_ORDER: Phase1AnchorKind[] = [
    'vv_quality_criterion', 'technical_constraint',
  ];

  /**
   * Group anchors by kind, preserving the model's iteration order
   * within each kind. Used twice: once for the FR forest (kinds
   * UJ/WF/ENT/DOM/PER/COMP), once for the NFR forest (QA/TECH).
   */
  function groupAnchors(
    kinds: Phase1AnchorKind[],
    anchors: Map<string, ViewerPhase1Anchor>,
  ): Map<Phase1AnchorKind, ViewerPhase1Anchor[]> {
    const out = new Map<Phase1AnchorKind, ViewerPhase1Anchor[]>();
    for (const k of kinds) out.set(k, []);
    for (const a of anchors.values()) {
      const arr = out.get(a.kind);
      if (arr) arr.push(a);
    }
    return out;
  }

  const anchorsByKindFr = $derived(groupAnchors(FR_KIND_ORDER, $dagModel.anchorsById));
  const anchorsByKindNfr = $derived(groupAnchors(NFR_KIND_ORDER, $dagModel.anchorsById));

  const allAnchorIds = $derived(
    Array.from($dagModel.anchorsById.keys()),
  );

  /** Find the depth-0 node for a root_fr_id (the FR/NFR seed itself). */
  function rootSeed(rootFrId: string): ViewerDecompositionNode | undefined {
    return ($nodesByRoot.get(rootFrId) ?? []).find(n => n.depth === 0);
  }

  /** Flatten the decomposition sub-tree of a root for indented rendering. */
  type SubRow = { node: ViewerDecompositionNode; depth: number; hasChildren: boolean };
  function walkSubtree(rootFrId: string): SubRow[] {
    const out: SubRow[] = [];
    const seed = rootSeed(rootFrId);
    if (!seed) return out;
    const recurse = (node: ViewerDecompositionNode, depth: number): void => {
      const children = $childrenByParent.get(node.node_id) ?? [];
      out.push({ node, depth, hasChildren: children.length > 0 });
      if ($expandedIndentedNodes.has(node.node_id)) {
        for (const c of children) recurse(c, depth + 1);
      }
    };
    recurse(seed, 0);
    return out;
  }

  /** Inbound primary + secondary count for an anchor (used for orphan badge). */
  function inboundCount(anchorId: string): number {
    return ($dagModel.primaryRootsByAnchor.get(anchorId)?.length ?? 0)
      + ($dagModel.secondaryRootsByAnchor.get(anchorId)?.length ?? 0);
  }

  function isOrphan(anchorId: string): boolean {
    return $dagModel.orphanAnchorIds.has(anchorId);
  }

  /** "qualified by: NFR-1, NFR-2" footnote for a given US id. */
  function qualifiedByFootnote(usId: string): string | null {
    const nfrs = $dagModel.qualifiedByMap.get(usId);
    if (!nfrs || nfrs.length === 0) return null;
    return `qualified by: ${nfrs.join(', ')}`;
  }

  /** Render a single FR/NFR root under its primary anchor (decomposition tree expanded). */
  function primaryRowsFor(rootFrId: string): SubRow[] {
    return $expandedIndentedNodes.has(rootSeed(rootFrId)?.node_id ?? '')
      ? walkSubtree(rootFrId)
      : (rootSeed(rootFrId)
        ? [{ node: rootSeed(rootFrId)!, depth: 0, hasChildren: ($childrenByParent.get(rootSeed(rootFrId)!.node_id) ?? []).length > 0 }]
        : []);
  }
</script>

<section class="dag-tree">
  <header class="toolbar">
    <span class="legend" title="Decomposition: parent → child via parent_node_id (Wave 6 records). Traceability: anchor → root via traces_to. Qualification: NFR.applies_to_requirements → FR.">
      Edges:
      <span class="edge-pill edge-decomp">decomposition ▾</span>
      <span class="edge-pill edge-trace">traceability →</span>
      <span class="edge-pill edge-qual">qualification ⓠ</span>
    </span>
    <button class="toolbar-btn" onclick={() => expandAllDagAnchors(allAnchorIds)}>Expand all</button>
    <button class="toolbar-btn" onclick={collapseAllDagAnchors}>Collapse all</button>
  </header>

  {#if $snapshot}
    <div class="dag-body">
      <!-- Intent root -->
      <section class="intent-root">
        <h2>Raw Intent</h2>
        {#if $snapshot.intent_summary.raw_intent}
          <p class="intent-text">{$snapshot.intent_summary.raw_intent}</p>
        {:else}
          <p class="intent-text muted">(no raw_intent_received artifact found)</p>
        {/if}
        {#if $snapshot.intent_summary.product_name}
          <h3>Intent Statement — {$snapshot.intent_summary.product_name}</h3>
          {#if $snapshot.intent_summary.product_description}
            <p class="intent-text">{$snapshot.intent_summary.product_description}</p>
          {/if}
        {/if}
      </section>

      <!-- Functional forest -->
      <section class="forest">
        <h2>Functional Traceability Forest</h2>
        {#each FR_KIND_ORDER as kind (kind)}
          {@const anchors = anchorsByKindFr.get(kind) ?? []}
          {#if anchors.length > 0}
            <div class="kind-group">
              <h3>{KIND_LABELS[kind]} <span class="count">({anchors.length})</span></h3>
              <ul class="anchors">
                {#each anchors as anchor (anchor.id)}
                  {@const primaryRoots = $dagModel.primaryRootsByAnchor.get(anchor.id) ?? []}
                  {@const secondaryRoots = $dagModel.secondaryRootsByAnchor.get(anchor.id) ?? []}
                  {@const expanded = $expandedDagAnchors.has(anchor.id)}
                  <li class="anchor-row" class:orphan={isOrphan(anchor.id)}>
                    <button
                      class="chevron"
                      class:has-children={inboundCount(anchor.id) > 0}
                      onclick={() => toggleDagAnchor(anchor.id)}
                    >{inboundCount(anchor.id) > 0 ? (expanded ? '▾' : '▸') : '·'}</button>
                    <span class="anchor-id">{anchor.id}</span>
                    <span class="anchor-label">{anchor.label}</span>
                    <span class="anchor-meta">
                      {#if anchor.phantom}<span class="phantom-pill" title="Referenced by a Phase 2 root but no Phase 1 artifact produces it (calibration gap)">⚠ phantom</span>{/if}
                      {#if isOrphan(anchor.id)}<span class="orphan-pill" title="No FR/NFR roots reference this anchor">⚠ orphan</span>{/if}
                      <span class="ref-count">{primaryRoots.length} primary · {secondaryRoots.length} secondary</span>
                    </span>
                    {#if expanded}
                      <ul class="anchor-children">
                        {#each primaryRoots as rootFrId (rootFrId)}
                          {#each primaryRowsFor(rootFrId) as row (row.node.record_id)}
                            <li class="row" style="--depth: {row.depth}">
                              <button
                                class="chevron"
                                class:has-children={row.hasChildren}
                                onclick={(e) => { e.stopPropagation(); if (row.hasChildren) toggleIndentedNode(row.node.node_id); }}
                              >{row.hasChildren ? ($expandedIndentedNodes.has(row.node.node_id) ? '▾' : '▸') : '·'}</button>
                              <NodeRow node={row.node} />
                              {#if row.depth === 0}
                                {@const fn = qualifiedByFootnote(row.node.display_key)}
                                {#if fn}<div class="footnote qualified-by">ⓠ {fn}</div>{/if}
                              {/if}
                            </li>
                          {/each}
                        {/each}
                        {#each secondaryRoots as rootFrId (rootFrId)}
                          {@const seed = rootSeed(rootFrId)}
                          {@const placement = $dagModel.placementByRoot.get(rootFrId)}
                          {#if seed && placement}
                            <li class="row secondary-row">
                              <span class="chevron">↪</span>
                              <span class="display-key">{seed.display_key}</span>
                              <span class="action">{seed.story_action || seed.story_role}</span>
                              <span class="ref-link" title="Primary occurrence under {placement.primary_anchor_id}">→ primary at {placement.primary_anchor_id ?? '(none)'}</span>
                            </li>
                          {/if}
                        {/each}
                      </ul>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        {/each}
      </section>

      <!-- NFR forest -->
      <section class="forest">
        <h2>Non-Functional Traceability Forest</h2>
        {#each NFR_KIND_ORDER as kind (kind)}
          {@const anchors = anchorsByKindNfr.get(kind) ?? []}
          {#if anchors.length > 0}
            <div class="kind-group">
              <h3>{KIND_LABELS[kind]} <span class="count">({anchors.length})</span></h3>
              <ul class="anchors">
                {#each anchors as anchor (anchor.id)}
                  {@const primaryRoots = $dagModel.primaryRootsByAnchor.get(anchor.id) ?? []}
                  {@const secondaryRoots = $dagModel.secondaryRootsByAnchor.get(anchor.id) ?? []}
                  {@const expanded = $expandedDagAnchors.has(anchor.id)}
                  <li class="anchor-row" class:orphan={isOrphan(anchor.id)}>
                    <button
                      class="chevron"
                      class:has-children={inboundCount(anchor.id) > 0}
                      onclick={() => toggleDagAnchor(anchor.id)}
                    >{inboundCount(anchor.id) > 0 ? (expanded ? '▾' : '▸') : '·'}</button>
                    <span class="anchor-id">{anchor.id}</span>
                    <span class="anchor-label">{anchor.label}</span>
                    <span class="anchor-meta">
                      {#if isOrphan(anchor.id)}<span class="orphan-pill">⚠ orphan</span>{/if}
                      <span class="ref-count">{primaryRoots.length} primary · {secondaryRoots.length} secondary</span>
                    </span>
                    {#if expanded}
                      <ul class="anchor-children">
                        {#each primaryRoots as rootFrId (rootFrId)}
                          {#each primaryRowsFor(rootFrId) as row (row.node.record_id)}
                            <li class="row" style="--depth: {row.depth}">
                              <button
                                class="chevron"
                                class:has-children={row.hasChildren}
                                onclick={(e) => { e.stopPropagation(); if (row.hasChildren) toggleIndentedNode(row.node.node_id); }}
                              >{row.hasChildren ? ($expandedIndentedNodes.has(row.node.node_id) ? '▾' : '▸') : '·'}</button>
                              <NodeRow node={row.node} />
                            </li>
                          {/each}
                        {/each}
                        {#each secondaryRoots as rootFrId (rootFrId)}
                          {@const seed = rootSeed(rootFrId)}
                          {@const placement = $dagModel.placementByRoot.get(rootFrId)}
                          {#if seed && placement}
                            <li class="row secondary-row">
                              <span class="chevron">↪</span>
                              <span class="display-key">{seed.display_key}</span>
                              <span class="action">{seed.story_action || seed.story_role}</span>
                              <span class="ref-link">→ primary at {placement.primary_anchor_id ?? '(none)'}</span>
                            </li>
                          {/if}
                        {/each}
                      </ul>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        {/each}
      </section>
    </div>
  {/if}
</section>

<style>
  .dag-tree {
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
  .legend { margin-right: auto; display: inline-flex; gap: var(--jc-space-sm); align-items: center; }
  .edge-pill {
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 11px;
  }
  .edge-decomp { background: var(--jc-primary-container); color: var(--jc-on-primary-container); }
  .edge-trace { background: var(--jc-tertiary-container, #2A4A45); color: var(--jc-on-tertiary-container, #C8E6C9); }
  .edge-qual { background: var(--jc-warning-container, #4D3F00); color: var(--jc-on-warning-container, #FFE08A); }
  .toolbar-btn {
    background: transparent;
    color: var(--jc-on-surface-variant);
    border: none;
    padding: var(--jc-space-xs) var(--jc-space-md);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    border-radius: var(--jc-radius-sm);
  }
  .toolbar-btn:hover { color: var(--jc-on-surface); background: var(--jc-surface-bright); }
  .dag-body { padding: var(--jc-space-md) var(--jc-space-lg); }
  .intent-root {
    margin-bottom: var(--jc-space-lg);
    padding: var(--jc-space-md);
    background: var(--jc-surface-container);
    border-radius: var(--jc-radius-md);
  }
  .intent-root h2 { margin: 0 0 var(--jc-space-sm) 0; font-size: 14px; font-weight: 600; }
  .intent-root h3 { margin: var(--jc-space-md) 0 var(--jc-space-sm) 0; font-size: 13px; font-weight: 500; }
  .intent-text { margin: 0; font-size: 13px; line-height: 1.5; color: var(--jc-on-surface); }
  .intent-text.muted { color: var(--jc-on-surface-variant); font-style: italic; }
  .forest { margin-bottom: var(--jc-space-xl); }
  .forest h2 {
    margin: 0 0 var(--jc-space-md) 0;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--jc-on-surface-variant);
    font-weight: 600;
  }
  .kind-group { margin-bottom: var(--jc-space-md); }
  .kind-group h3 {
    margin: 0 0 var(--jc-space-xs) 0;
    font-size: 12px;
    font-family: var(--jc-font-mono);
    color: var(--jc-on-surface-variant);
    font-weight: 500;
  }
  .count { color: var(--jc-on-surface-variant); font-weight: 400; }
  ul.anchors, ul.anchor-children { list-style: none; margin: 0; padding: 0; }
  li.anchor-row {
    display: grid;
    grid-template-columns: 18px auto 1fr auto;
    grid-template-rows: auto;
    align-items: center;
    column-gap: var(--jc-space-sm);
    padding: 2px 0;
  }
  li.anchor-row.orphan .anchor-id { color: var(--jc-on-surface-variant); }
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
    text-align: center;
    padding: 0;
  }
  .chevron.has-children { cursor: pointer; }
  .chevron.has-children:hover { color: var(--jc-on-surface); background: var(--jc-surface-bright); }
  .anchor-id {
    font-family: var(--jc-font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--jc-on-surface);
  }
  .anchor-label {
    font-size: 13px;
    color: var(--jc-on-surface);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .anchor-meta {
    font-size: 11px;
    color: var(--jc-on-surface-variant);
    font-family: var(--jc-font-mono);
    display: inline-flex;
    gap: var(--jc-space-sm);
    align-items: center;
  }
  .orphan-pill {
    background: var(--jc-warning-container, #4D3F00);
    color: var(--jc-on-warning-container, #FFE08A);
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 11px;
  }
  .phantom-pill {
    background: var(--jc-error-container, #5C1F1F);
    color: var(--jc-on-error-container, #FFB4AB);
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 11px;
  }
  ul.anchor-children {
    grid-column: 1 / -1;
    margin-left: 24px;
    padding-left: var(--jc-space-sm);
    border-left: 2px solid var(--jc-surface-bright);
    margin-top: 2px;
    margin-bottom: var(--jc-space-sm);
  }
  ul.anchor-children li.row {
    display: grid;
    grid-template-columns: 18px 1fr;
    align-items: center;
    padding-left: calc(var(--depth, 0) * 12px);
  }
  ul.anchor-children li.row.secondary-row {
    grid-template-columns: 18px auto 1fr auto;
    column-gap: var(--jc-space-sm);
    color: var(--jc-on-surface-variant);
    font-style: italic;
  }
  .secondary-row .display-key {
    font-family: var(--jc-font-mono);
    font-size: 12px;
  }
  .secondary-row .action {
    font-size: 12px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .secondary-row .ref-link {
    font-size: 11px;
    color: var(--jc-on-surface-variant);
    font-family: var(--jc-font-mono);
  }
  .footnote.qualified-by {
    grid-column: 2 / -1;
    margin-left: var(--jc-space-md);
    font-size: 11px;
    color: var(--jc-warning-container, #FFE08A);
    font-family: var(--jc-font-mono);
  }
</style>
