<script lang="ts">
  import {
    snapshot, errorMessage, clearError,
    activeTab, type ViewerTab,
    treeViewMode, type TreeViewMode,
    sendMessage,
  } from './stores/snapshot';
  import FilterBar from './components/FilterBar.svelte';
  import SummaryStrip from './components/SummaryStrip.svelte';
  import ReleaseRail from './components/ReleaseRail.svelte';
  import TreeView from './components/TreeView.svelte';
  import IndentedTreeView from './components/IndentedTreeView.svelte';
  import DagTreeView from './components/DagTreeView.svelte';
  import AssumptionsPanel from './components/AssumptionsPanel.svelte';
  import DetailDrawer from './components/DetailDrawer.svelte';

  function refresh(): void {
    sendMessage({ type: 'refresh_requested' });
  }
  function setTab(t: ViewerTab): void {
    activeTab.set(t);
  }
  function onTreeModeChange(e: Event): void {
    const select = e.currentTarget as HTMLSelectElement;
    treeViewMode.set(select.value as TreeViewMode);
  }
</script>

<div class="viewer-root">
  {#if $errorMessage}
    <div class="error-banner">
      <span>{$errorMessage}</span>
      <button onclick={clearError}>dismiss</button>
    </div>
  {/if}

  <header class="viewer-header">
    <div class="header-left">
      <h1>Decomposition Viewer</h1>
      {#if $snapshot}
        <span class="subtitle">
          Phase {$snapshot.phase_id ?? '?'}/{$snapshot.sub_phase_id ?? '?'}
          · {$snapshot.run_status}
          · {$snapshot.totals.nodes} nodes
          · {$snapshot.totals.roots} roots
          · {$snapshot.totals.atomic} atomic
          · {$snapshot.totals.pending} pending
          · {$snapshot.totals.assumptions} assumptions
        </span>
      {:else}
        <span class="subtitle">loading…</span>
      {/if}
    </div>
    <div class="header-right">
      <nav class="tabs">
        <button class:active={$activeTab === 'tree'}       onclick={() => setTab('tree')}>Tree</button>
        <button class:active={$activeTab === 'assumptions'} onclick={() => setTab('assumptions')}>Assumptions</button>
        <button class:active={$activeTab === 'summary'}    onclick={() => setTab('summary')}>Summary</button>
      </nav>
      {#if $activeTab === 'tree'}
        <label class="view-mode-control" title="Choose tree layout (Option 7 = Multi-Level Accordion; Option 1 = Indented Tree)">
          <span class="vm-label">View:</span>
          <select class="vm-select" value={$treeViewMode} onchange={onTreeModeChange}>
            <option value="accordion">Accordion (Option 7)</option>
            <option value="indented">Indented Tree (Option 1)</option>
            <option value="dag">DAG Tree (Phase 1 → Phase 2)</option>
          </select>
        </label>
      {/if}
      <button class="refresh-btn" title="Refresh now (polls every 3s automatically)" onclick={refresh}>↻</button>
    </div>
  </header>

  {#if $snapshot}
    {#if $activeTab === 'tree'}
      <FilterBar />
      <main class="viewer-body">
        <ReleaseRail />
        {#if $treeViewMode === 'indented'}
          <IndentedTreeView />
        {:else if $treeViewMode === 'dag'}
          <DagTreeView />
        {:else}
          <TreeView />
        {/if}
        <DetailDrawer />
      </main>
    {:else if $activeTab === 'assumptions'}
      <AssumptionsPanel />
    {:else}
      <SummaryStrip />
    {/if}
  {:else}
    <div class="loading">Loading snapshot…</div>
  {/if}
</div>

<style>
  /* Design system tokens per docs/visual design/DESIGN.md.
     "No-Line" rule — structural separation via background-color steps,
     not 1px borders. */
  .viewer-root {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--jc-surface);
    color: var(--jc-on-surface);
    font-family: var(--jc-font-body);
  }
  .error-banner {
    background: var(--jc-error-container);
    color: var(--jc-on-error-container);
    padding: var(--jc-space-md) var(--jc-space-lg);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
  }
  .error-banner button {
    background: transparent;
    color: inherit;
    border: none;
    padding: var(--jc-space-xs) var(--jc-space-md);
    cursor: pointer;
    border-radius: var(--jc-radius-sm);
    font-family: inherit;
    font-size: 13px;
  }
  .error-banner button:hover { background: rgba(255, 255, 255, 0.1); }
  .viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--jc-space-md) var(--jc-space-xl);
    background: var(--jc-surface-container);
  }
  .header-left { display: flex; gap: var(--jc-space-lg); align-items: baseline; }
  h1 {
    margin: 0;
    font-family: var(--jc-font-headline);
    font-size: 18px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: var(--jc-on-surface);
  }
  .subtitle {
    font-size: 13px;
    font-family: var(--jc-font-mono);
    color: var(--jc-on-surface-variant);
  }
  .header-right { display: flex; gap: var(--jc-space-md); align-items: center; }
  .tabs { display: flex; gap: var(--jc-space-xs); }
  .tabs button {
    background: transparent;
    color: var(--jc-on-surface-variant);
    border: none;
    padding: var(--jc-space-sm) var(--jc-space-lg);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-radius: var(--jc-radius-sm);
    transition: background var(--jc-transition-fast), color var(--jc-transition-fast);
  }
  .tabs button:hover {
    color: var(--jc-on-surface);
    background: var(--jc-surface-bright);
  }
  .tabs button.active {
    background: var(--jc-primary-container);
    color: var(--jc-on-primary-container);
  }
  .view-mode-control {
    display: flex;
    align-items: center;
    gap: var(--jc-space-sm);
    padding-left: var(--jc-space-md);
    font-size: 12px;
    color: var(--jc-on-surface-variant);
    font-family: var(--jc-font-mono);
  }
  .vm-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .vm-select {
    background: var(--jc-surface-bright);
    color: var(--jc-on-surface);
    border: none;
    padding: var(--jc-space-xs) var(--jc-space-md);
    font-family: inherit;
    font-size: 12px;
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
  }
  .vm-select:focus { outline: 1px solid var(--jc-primary); }
  .refresh-btn {
    background: transparent;
    color: var(--jc-on-surface-variant);
    border: none;
    padding: var(--jc-space-sm) var(--jc-space-md);
    cursor: pointer;
    font-size: 16px;
    border-radius: var(--jc-radius-sm);
    transition: background var(--jc-transition-fast), color var(--jc-transition-fast);
  }
  .refresh-btn:hover {
    color: var(--jc-on-surface);
    background: var(--jc-surface-bright);
  }
  .viewer-body {
    flex: 1 1 auto;
    display: grid;
    grid-template-columns: 240px 1fr 400px;
    overflow: hidden;
    background: var(--jc-surface);
  }
  .loading {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--jc-on-surface-variant);
    font-size: 14px;
  }
</style>
