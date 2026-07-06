<script lang="ts">
  /*
   * Unified drill-down (the Phase 1-8 spine).
   *
   *   User Journey → User Story → requirement tree → leaf AC
   *                → Component → Task · Test
   *                → Data Model
   *
   * The requirement layer reuses NodeRow; the AC + realization layers
   * (component/task/test/data-model) render as compact inline rows. Expand
   * state reuses expandedIndentedNodes (a Set<string>) keyed by synthetic ids,
   * so it survives snapshot polls. Everything is a single flat row array per
   * root (same scale approach as the Indented view).
   *
   * Realization layers arrive lazily (realization_delta) and independently of
   * the base snapshot; layer chips let the operator declutter the leaf rows.
   */
  import {
    snapshot,
    nodesByRoot,
    childrenByParent,
    dagModel,
    realizationByAc,
    realizationByComponent,
    componentNodeByKey,
    realizationDrift,
    realizationLoaded,
    filterLayers,
    toggleLayer,
    ALL_LAYER_FILTERS,
    type RealizationLayerFilter,
    expandedIndentedNodes,
    toggleIndentedNode,
    filterReleaseIds,
    selectNode,
    selectRealization,
    selectedNodeRecordId,
    selectedRealizationRecordId,
    coverageModel,
    filterGapsOnly,
    toggleGapsOnly,
    findingsByAc,
    findingsByKey,
    findingsSummary,
    type ViewerFinding,
    type ViewerDecompositionNode,
    type ViewerRealizationNode,
    type ViewerRootSummary,
    type ViewerPhase1Anchor,
  } from '../stores/snapshot';
  import { sumRollups, EMPTY_ROLLUP, type CoverageRollup } from '../stores/coverage';
  import NodeRow from './NodeRow.svelte';

  /** Finding badge summary for an item: total + how many are HIGH. */
  function findingBadge(list: ViewerFinding[] | undefined): { n: number; high: number } | null {
    if (!list || list.length === 0) return null;
    return { n: list.length, high: list.filter((f) => f.severity === 'HIGH').length };
  }

  type DrillRow =
    | { kind: 'req'; key: string; depth: number; expandId: string; hasChildren: boolean; node: ViewerDecompositionNode }
    | { kind: 'coverage'; key: string; depth: number; expandId: null; hasChildren: false; rollup: CoverageRollup }
    | { kind: 'ac'; key: string; depth: number; expandId: string; hasChildren: boolean; acId: string; desc: string; leafRecordId: string; taskCount: number; testCount: number; gap: boolean }
    | { kind: 'component'; key: string; depth: number; expandId: string; hasChildren: boolean; compKey: string; title: string; resolved: boolean; recordId: string | null }
    | { kind: 'realization'; key: string; depth: number; expandId: null; hasChildren: false; node: ViewerRealizationNode };

  const expanded = (id: string): boolean => $expandedIndentedNodes.has(id);
  const layerOn = (layer: RealizationLayerFilter): boolean => $filterLayers.has(layer);

  /** Row click → open the node in the detail drawer (AC selects its leaf story). */
  function selectRow(row: DrillRow): void {
    if (row.kind === 'ac') selectNode(row.leafRecordId);
    else if (row.kind === 'component') { if (row.recordId) selectRealization(row.recordId); }
    else if (row.kind === 'realization') selectRealization(row.node.record_id);
  }
  function rowSelected(row: DrillRow): boolean {
    if (row.kind === 'realization') return $selectedRealizationRecordId === row.node.record_id;
    if (row.kind === 'component') return !!row.recordId && $selectedRealizationRecordId === row.recordId;
    if (row.kind === 'ac') return $selectedNodeRecordId === row.leafRecordId;
    return false;
  }
  function onRowKeydown(e: KeyboardEvent, row: DrillRow): void {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRow(row); }
  }

  /** Roots visible under the release filter. */
  const visibleRoots = $derived(
    ($snapshot?.roots ?? []).filter(
      (r: ViewerRootSummary) => !($filterReleaseIds && r.release_id && !$filterReleaseIds.has(r.release_id)),
    ),
  );
  const rootByFrId = $derived(new Map(visibleRoots.map((r) => [r.root_fr_id, r])));

  const gapsOnly = $derived($filterGapsOnly);
  const cov = $derived($coverageModel);
  const totalGaps = $derived(sumRollups(cov.byRoot.values()).gaps);
  const pctTested = (r: CoverageRollup): number => (r.totalAc === 0 ? 0 : Math.round((r.tested / r.totalAc) * 100));
  const rollupFor = (roots: ViewerRootSummary[]): CoverageRollup =>
    sumRollups(roots.map((r) => cov.byRoot.get(r.root_fr_id) ?? EMPTY_ROLLUP));
  /** In gaps-only mode, keep only roots that contain an untested AC. */
  const keepRoots = (roots: ViewerRootSummary[]): ViewerRootSummary[] =>
    gapsOnly ? roots.filter((r) => cov.rootHasGap.has(r.root_fr_id)) : roots;

  /** Group US roots under their primary user-journey anchor; NFR/unanchored → cross-cutting. */
  const journeyGroups = $derived.by(() => {
    const dag = $dagModel;
    const groups: Array<{ journey: ViewerPhase1Anchor; roots: ViewerRootSummary[]; rollup: CoverageRollup }> = [];
    const placed = new Set<string>();
    for (const [anchorId, anchor] of dag.anchorsById) {
      if (anchor.kind !== 'user_journey') continue;
      const allRoots = (dag.primaryRootsByAnchor.get(anchorId) ?? [])
        .map((frId) => rootByFrId.get(frId))
        .filter((r): r is ViewerRootSummary => !!r);
      if (allRoots.length === 0) continue;
      for (const r of allRoots) placed.add(r.root_fr_id);
      const roots = keepRoots(allRoots);
      if (roots.length === 0) continue; // gaps-only: journey has no holes
      groups.push({ journey: anchor, roots, rollup: rollupFor(allRoots) });
    }
    groups.sort((a, b) => (a.roots[0]?.release_ordinal ?? 99) - (b.roots[0]?.release_ordinal ?? 99));
    const crossAll = visibleRoots.filter((r) => !placed.has(r.root_fr_id));
    const cross = keepRoots(crossAll);
    return { groups, cross, crossRollup: rollupFor(crossAll) };
  });

  /** Data-model rows for a component, respecting the data_model chip. */
  function dataModelsFor(compKey: string): ViewerRealizationNode[] {
    if (!layerOn('data_model')) return [];
    return ($realizationByComponent.get(compKey) ?? []).filter((n) => n.layer === 'data_model');
  }

  /** Emit the realization sub-rows under one expanded acceptance criterion. */
  function walkAc(rows: DrillRow[], leaf: ViewerDecompositionNode, depth: number): void {
    for (const ac of leaf.acceptance_criteria) {
      // TRUE coverage from the shared model (independent of the layer chips,
      // so the gap flag reflects reality, not the current view).
      const c = cov.acCov.get(ac.id) ?? { task: 0, test: 0, gap: false, unrealized: true };
      if (gapsOnly && !c.gap) continue; // gaps-only: keep only untested ACs
      const all = $realizationByAc.get(ac.id) ?? [];
      // Rows to render are filtered to the enabled leaf layers.
      const realizing = all.filter((n) => layerOn(n.layer));
      const acExpand = `ac:${leaf.node_id}:${ac.id}`;
      rows.push({ kind: 'ac', key: acExpand, depth, expandId: acExpand, hasChildren: realizing.length > 0, acId: ac.id, desc: ac.description, leafRecordId: leaf.record_id, taskCount: c.task, testCount: c.test, gap: c.gap });
      if (!expanded(acExpand)) continue;

      // Bucket realizing nodes by their component.
      const byComp = new Map<string, ViewerRealizationNode[]>();
      const noComp: ViewerRealizationNode[] = [];
      for (const t of realizing) {
        if (t.component_key) { const a = byComp.get(t.component_key) ?? []; a.push(t); byComp.set(t.component_key, a); }
        else noComp.push(t);
      }

      if (layerOn('component')) {
        for (const [compKey, groupNodes] of byComp) {
          const comp = $componentNodeByKey.get(compKey);
          const compExpand = `comp:${ac.id}:${compKey}`;
          rows.push({ kind: 'component', key: compExpand, depth: depth + 1, expandId: compExpand, hasChildren: true, compKey, title: comp?.title ?? compKey, resolved: !!comp, recordId: comp?.record_id ?? null });
          if (!expanded(compExpand)) continue;
          for (const t of groupNodes) rows.push({ kind: 'realization', key: `rz:${ac.id}:${t.record_id}`, depth: depth + 2, expandId: null, hasChildren: false, node: t });
          for (const dm of dataModelsFor(compKey)) rows.push({ kind: 'realization', key: `dm:${ac.id}:${dm.record_id}`, depth: depth + 2, expandId: null, hasChildren: false, node: dm });
        }
        for (const t of noComp) rows.push({ kind: 'realization', key: `rz:${ac.id}:${t.record_id}`, depth: depth + 1, expandId: null, hasChildren: false, node: t });
      } else {
        // Component grouping off — leaves flat under the AC; data models
        // (component-scoped) collected across the components this AC touches.
        for (const t of realizing) rows.push({ kind: 'realization', key: `rz:${ac.id}:${t.record_id}`, depth: depth + 1, expandId: null, hasChildren: false, node: t });
        const seen = new Set<string>();
        for (const compKey of byComp.keys()) {
          for (const dm of dataModelsFor(compKey)) {
            if (seen.has(dm.record_id)) continue;
            seen.add(dm.record_id);
            rows.push({ kind: 'realization', key: `dm:${ac.id}:${dm.record_id}`, depth: depth + 1, expandId: null, hasChildren: false, node: dm });
          }
        }
      }
    }
  }

  /** Build the flat drill rows for one root's subtree. */
  function buildRootRows(rootFrId: string): DrillRow[] {
    const rows: DrillRow[] = [];
    const rootEntry = ($nodesByRoot.get(rootFrId) ?? []).find((n) => n.depth === 0);
    if (!rootEntry) return rows;
    // Gaps-only: skip roots with no untested AC (journeyGroups already filters,
    // but a stale call could still land here).
    if (gapsOnly && !cov.rootHasGap.has(rootFrId)) return rows;

    const walkReq = (node: ViewerDecompositionNode, depth: number): void => {
      // Gaps-only prunes every branch that doesn't lead to an untested AC.
      if (gapsOnly && !cov.reqSubtreeHasGap.has(node.node_id)) return;
      const reqChildren = $childrenByParent.get(node.node_id) ?? [];
      const hasChildren = reqChildren.length > 0 || node.acceptance_criteria.length > 0;
      const expandId = `req:${node.node_id}`;
      rows.push({ kind: 'req', key: node.record_id, depth, expandId, hasChildren, node });
      // Per-US coverage bar directly under the root (always visible).
      if (depth === 0) rows.push({ kind: 'coverage', key: `cov:${rootFrId}`, depth: depth + 1, expandId: null, hasChildren: false, rollup: cov.byRoot.get(rootFrId) ?? EMPTY_ROLLUP });
      // Gaps-only auto-reveals the path so holes are visible without expanding.
      if (!gapsOnly && !expanded(expandId)) return;
      for (const child of reqChildren) walkReq(child, depth + 1);
      walkAc(rows, node, depth + 1);
    };

    walkReq(rootEntry, 0);
    return rows;
  }

  const drift = $derived($realizationDrift);
  const layerBadge: Record<string, string> = { component: 'CMP', task: 'TASK', test: 'TEST', data_model: 'DATA' };
  const layerChips: Array<{ id: RealizationLayerFilter; label: string }> = [
    { id: 'component', label: 'Components' },
    { id: 'task', label: 'Tasks' },
    { id: 'test', label: 'Tests' },
    { id: 'data_model', label: 'Data Models' },
  ];
</script>

<section class="drilldown">
  <div class="chip-bar">
    <span class="chip-label">Layers:</span>
    {#each layerChips as chip (chip.id)}
      <button
        class="chip"
        class:on={$filterLayers.has(chip.id)}
        aria-pressed={$filterLayers.has(chip.id)}
        onclick={() => toggleLayer(chip.id)}
      >
        <span class="chip-badge {chip.id}">{layerBadge[chip.id]}</span>
        {chip.label}
      </button>
    {/each}
    <span class="chip-sep"></span>
    <button
      class="chip gaps"
      class:on={gapsOnly}
      aria-pressed={gapsOnly}
      title="Show only acceptance criteria that have tasks but no verifying test"
      onclick={toggleGapsOnly}
    >
      ⚠ Gaps only
      {#if cov.rootHasGap.size > 0}<span class="gaps-count">{totalGaps}</span>{/if}
    </button>
    {#if $findingsSummary.bound > 0}
      <span class="find-summary" title="{$findingsSummary.bound} findings bound to items · {$findingsSummary.surfaced} surfaced total ({$findingsSummary.unbound} cite no item)">
        ⚑ {$findingsSummary.bound} findings
      </span>
    {/if}
    {#if !$realizationLoaded}
      <span class="loading-hint">loading realization layers…</span>
    {/if}
  </div>

  {#if drift.unresolved_ac_ids.length > 0 || drift.unresolved_component_ids.length > 0}
    <div class="drift-banner" title="Referenced ids that resolved to no producer — surfaced, not hidden">
      ⚠ drift: {drift.unresolved_ac_ids.length} AC ref(s), {drift.unresolved_component_ids.length} component ref(s) unresolved
    </div>
  {/if}

  {#if visibleRoots.length === 0}
    <div class="empty">No user stories for the current filter.</div>
  {/if}

  {#each journeyGroups.groups as g (g.journey.id)}
    <div class="journey-header">
      <span class="journey-badge">JOURNEY</span>
      <span class="journey-id">{g.journey.id}</span>
      <span class="journey-label">{g.journey.label}</span>
      {#if g.journey.phantom}<span class="phantom">phantom</span>{/if}
      {@render covSummary(g.rollup)}
    </div>
    {#each g.roots as root (root.root_fr_id)}
      {@render rootTree(root)}
    {/each}
  {/each}

  {#if journeyGroups.cross.length > 0}
    <div class="journey-header cross">
      <span class="journey-badge">CROSS-CUTTING / NFR</span>
      {@render covSummary(journeyGroups.crossRollup)}
    </div>
    {#each journeyGroups.cross as root (root.root_fr_id)}
      {@render rootTree(root)}
    {/each}
  {/if}
</section>

{#snippet covSummary(r: CoverageRollup)}
  {#if r.totalAc > 0}
    <span class="cov-summary" title="{r.tested}/{r.totalAc} ACs verified · {r.gaps} untested · {r.unrealized} unrealized">
      <span class="cov-bar"><span class="cov-bar-fill" style="width: {pctTested(r)}%"></span></span>
      <span class="cov-frac">{r.tested}/{r.totalAc} tested</span>
      {#if r.gaps > 0}<span class="cov-gap">{r.gaps} gap{r.gaps === 1 ? '' : 's'}</span>{/if}
      {#if r.unrealized > 0}<span class="cov-none">{r.unrealized} unrealized</span>{/if}
    </span>
  {/if}
{/snippet}

{#snippet rootTree(root: ViewerRootSummary)}
  <ul class="rows" role="tree">
    {#each buildRootRows(root.root_fr_id) as row (row.key)}
      <li class="row" role="treeitem" style="padding-left: {row.depth * 16}px;">
        <button
          class="chevron"
          class:has-children={row.hasChildren}
          aria-label={row.hasChildren ? (row.expandId && expanded(row.expandId) ? 'Collapse' : 'Expand') : 'Leaf'}
          onclick={() => { if (row.hasChildren && row.expandId) toggleIndentedNode(row.expandId); }}
        >{row.hasChildren ? (row.expandId && expanded(row.expandId) ? '▾' : '▸') : '·'}</button>

        {#if row.kind === 'req'}
          <NodeRow node={row.node} />
        {:else if row.kind === 'coverage'}
          <div class="cov-row">{@render covSummary(row.rollup)}</div>
        {:else if row.kind === 'ac'}
          {@const fb = findingBadge($findingsByAc.get(row.acId))}
          <div class="rz-row ac" class:selected={rowSelected(row)} role="button" tabindex="0"
               onclick={() => selectRow(row)} onkeydown={(e) => onRowKeydown(e, row)}>
            <span class="rz-badge ac">AC</span>
            <span class="rz-key">{row.acId}</span>
            <span class="rz-desc">{row.desc}</span>
            <span class="rz-cov" title="tasks realizing · tests verifying this AC">
              {#if row.taskCount > 0}<span class="cov-task">{row.taskCount}◆</span>{/if}
              {#if row.testCount > 0}<span class="cov-test">{row.testCount}✓</span>{/if}
              {#if row.gap}<span class="cov-gap" title="Has tasks but no verifying test">no test</span>
              {:else if row.taskCount === 0 && row.testCount === 0}<span class="cov-none">unrealized</span>{/if}
            </span>
            {#if fb}<span class="find-badge" class:has-high={fb.high > 0} title="{fb.n} validator finding(s), {fb.high} HIGH">⚑ {fb.n}</span>{/if}
          </div>
        {:else if row.kind === 'component'}
          {@const cfb = findingBadge($findingsByKey.get(row.compKey))}
          <div class="rz-row component" class:unresolved={!row.resolved} class:selected={rowSelected(row)}
               role="button" tabindex="0" onclick={() => selectRow(row)} onkeydown={(e) => onRowKeydown(e, row)}>
            <span class="rz-badge cmp">CMP</span>
            <span class="rz-key">{row.compKey}</span>
            <span class="rz-desc">{row.title}</span>
            {#if !row.resolved}<span class="rz-drift">drift</span>{/if}
            {#if cfb}<span class="find-badge" class:has-high={cfb.high > 0} title="{cfb.n} validator finding(s), {cfb.high} HIGH">⚑ {cfb.n}</span>{/if}
          </div>
        {:else}
          <div class="rz-row {row.node.layer}" class:selected={rowSelected(row)} role="button" tabindex="0"
               onclick={() => selectRow(row)} onkeydown={(e) => onRowKeydown(e, row)}>
            <span class="rz-badge {row.node.layer}">{layerBadge[row.node.layer]}</span>
            <span class="rz-key">{row.node.display_key}</span>
            <span class="rz-desc">{row.node.title}</span>
            {#if row.node.status && row.node.status !== 'atomic'}<span class="rz-status">{row.node.status}</span>{/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<style>
  .drilldown {
    flex: 1 1 auto;
    overflow-y: auto;
    background: var(--jc-surface);
    color: var(--jc-on-surface);
  }
  .chip-bar {
    display: flex;
    align-items: center;
    gap: var(--jc-space-sm);
    flex-wrap: wrap;
    padding: var(--jc-space-sm) var(--jc-space-lg);
    background: var(--jc-surface-container);
    position: sticky;
    top: 0;
    z-index: 3;
  }
  .chip-label {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--jc-on-surface-variant);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--jc-space-xs);
    background: var(--jc-surface-bright);
    color: var(--jc-on-surface-variant);
    border: none;
    padding: 2px var(--jc-space-sm);
    border-radius: var(--jc-radius-sm);
    font-family: var(--jc-font-body);
    font-size: 12px;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity var(--jc-transition-fast), background var(--jc-transition-fast);
  }
  .chip:hover { background: var(--jc-surface-container-high, var(--jc-surface-bright)); }
  .chip.on { opacity: 1; color: var(--jc-on-surface); }
  .loading-hint {
    margin-left: auto;
    font-family: var(--jc-font-mono);
    font-size: 11px;
    color: var(--jc-on-surface-variant);
    opacity: 0.8;
  }
  .drift-banner {
    padding: var(--jc-space-sm) var(--jc-space-lg);
    background: color-mix(in srgb, var(--jc-warning) 15%, transparent);
    color: var(--jc-warning);
    font-family: var(--jc-font-mono);
    font-size: 12px;
    position: sticky;
    top: 34px;
    z-index: 2;
  }
  .empty { padding: var(--jc-space-2xl); color: var(--jc-on-surface-variant); text-align: center; }
  .journey-header {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    padding: var(--jc-space-md) var(--jc-space-lg);
    margin-top: var(--jc-space-sm);
    background: var(--jc-surface-container);
    border-top: 1px solid var(--jc-outline-variant, var(--jc-outline));
  }
  .journey-header.cross { color: var(--jc-on-surface-variant); }
  .journey-badge {
    font-family: var(--jc-font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 1px var(--jc-space-sm);
    border-radius: var(--jc-radius-xs);
    background: var(--jc-primary-container);
    color: var(--jc-on-primary-container);
  }
  .journey-id { font-family: var(--jc-font-mono); font-size: 12px; color: var(--jc-primary); }
  .journey-label { font-size: 13px; color: var(--jc-on-surface); }
  .phantom { font-size: 10px; color: var(--jc-warning); border: 1px solid var(--jc-warning); border-radius: var(--jc-radius-xs); padding: 0 4px; }
  ul.rows { list-style: none; margin: 0; padding: 0; }
  li.row { display: grid; grid-template-columns: 18px 1fr; align-items: center; min-height: 24px; }
  .chevron {
    background: transparent; color: var(--jc-on-surface-variant); border: none;
    width: 18px; height: 100%; cursor: default; font-size: 11px;
    font-family: var(--jc-font-mono); line-height: 1; padding: 0; text-align: center;
  }
  .chevron.has-children { cursor: pointer; }
  .chevron.has-children:hover { color: var(--jc-on-surface); background: var(--jc-surface-bright); }
  .rz-row {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    gap: var(--jc-space-md);
    align-items: center;
    padding: var(--jc-space-xs) var(--jc-space-lg);
    font-size: 12px;
  }
  .rz-row:hover { background: var(--jc-surface-bright); }
  .rz-row[role='button'] { cursor: pointer; position: relative; }
  .rz-row.selected { background: var(--jc-surface-container-high); }
  .rz-row.selected::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0;
    width: var(--jc-status-bar-width, 3px); background: var(--jc-primary);
  }
  .rz-row[role='button']:focus-visible { outline: 1px solid var(--jc-primary); outline-offset: -1px; }
  .rz-cov { display: inline-flex; gap: var(--jc-space-sm); align-items: center; font-family: var(--jc-font-mono); font-size: 10px; }
  .cov-task { color: var(--jc-tertiary); }
  .cov-test { color: #56B6C2; }
  .cov-gap {
    color: var(--jc-warning);
    border: 1px solid var(--jc-warning);
    border-radius: var(--jc-radius-xs);
    padding: 0 4px;
  }
  .cov-none { color: var(--jc-on-surface-variant); opacity: 0.7; }
  /* Chip-bar separator + gaps-only toggle. */
  .chip-sep { width: 1px; align-self: stretch; background: var(--jc-outline-variant, var(--jc-outline)); margin: 2px var(--jc-space-xs); opacity: 0.5; }
  .chip.gaps.on { background: color-mix(in srgb, var(--jc-warning) 22%, transparent); color: var(--jc-warning); opacity: 1; }
  .gaps-count {
    font-family: var(--jc-font-mono); font-size: 10px; font-weight: 700;
    padding: 0 4px; margin-left: 2px; border-radius: var(--jc-radius-xs);
    background: color-mix(in srgb, var(--jc-warning) 30%, transparent); color: var(--jc-warning);
  }
  /* Coverage summary (journey headers + per-US row). */
  .cov-summary { display: inline-flex; align-items: center; gap: var(--jc-space-sm); font-family: var(--jc-font-mono); font-size: 10px; color: var(--jc-on-surface-variant); }
  .cov-bar { display: inline-block; width: 56px; height: 6px; border-radius: 3px; background: var(--jc-surface-bright); overflow: hidden; }
  .cov-bar-fill { display: block; height: 100%; background: var(--jc-tertiary); }
  .cov-frac { white-space: nowrap; }
  .cov-row { padding: 2px var(--jc-space-lg); }
  .journey-header .cov-summary { margin-left: auto; }
  /* Validator-finding badges. */
  .find-badge {
    font-family: var(--jc-font-mono); font-size: 10px; white-space: nowrap;
    padding: 0 var(--jc-space-sm); border-radius: var(--jc-radius-xs);
    background: color-mix(in srgb, var(--jc-warning) 18%, transparent); color: var(--jc-warning);
  }
  .find-badge.has-high { background: color-mix(in srgb, var(--jc-error) 20%, transparent); color: var(--jc-error); }
  .find-summary {
    font-family: var(--jc-font-mono); font-size: 11px;
    padding: 0 var(--jc-space-sm); border-radius: var(--jc-radius-xs);
    background: color-mix(in srgb, var(--jc-warning) 15%, transparent); color: var(--jc-warning);
  }
  .rz-badge, .chip-badge {
    font-family: var(--jc-font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
    padding: 1px var(--jc-space-sm); border-radius: var(--jc-radius-xs);
  }
  .rz-badge.ac   { background: var(--jc-primary-tint-strong); color: var(--jc-primary); }
  .rz-badge.cmp,  .chip-badge.component  { background: color-mix(in srgb, #C678DD 20%, transparent); color: #C678DD; }
  .rz-badge.task, .chip-badge.task { background: color-mix(in srgb, var(--jc-tertiary) 20%, transparent); color: var(--jc-tertiary); }
  .rz-badge.test, .chip-badge.test { background: color-mix(in srgb, #56B6C2 22%, transparent); color: #56B6C2; }
  .rz-badge.data_model, .chip-badge.data_model { background: color-mix(in srgb, #E5C07B 20%, transparent); color: #E5C07B; }
  .rz-key { font-family: var(--jc-font-mono); font-size: 11px; color: var(--jc-on-surface-variant); white-space: nowrap; }
  .rz-desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--jc-on-surface); }
  .rz-count, .rz-status { font-family: var(--jc-font-mono); font-size: 10px; color: var(--jc-on-surface-variant); }
  .rz-drift { font-size: 10px; color: var(--jc-warning); border: 1px solid var(--jc-warning); border-radius: var(--jc-radius-xs); padding: 0 4px; }
  .rz-row.component.unresolved .rz-key { color: var(--jc-warning); }
</style>
