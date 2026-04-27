<script lang="ts">
  import {
    snapshot,
    filterTiers,
    filterStatuses,
    filterPriorities,
    filterText,
    filterReleaseIds,
  } from '../stores/snapshot';

  const tierOrder: Array<'A' | 'B' | 'C' | 'D' | 'null'> = ['A', 'B', 'C', 'D', 'null'];
  const statuses = ['pending', 'atomic', 'pruned', 'deferred', 'downgraded'];
  const priorities = ['critical', 'high', 'medium', 'low'];

  function toggleTier(t: 'A' | 'B' | 'C' | 'D' | 'null'): void {
    const s = new Set($filterTiers);
    if (s.has(t)) s.delete(t);
    else s.add(t);
    filterTiers.set(s);
  }
  function toggleStatus(t: string): void {
    const s = new Set($filterStatuses);
    if (s.has(t)) s.delete(t);
    else s.add(t);
    filterStatuses.set(s);
  }
  function togglePriority(t: string): void {
    const s = new Set($filterPriorities);
    if (s.has(t)) s.delete(t);
    else s.add(t);
    filterPriorities.set(s);
  }
  function toggleRelease(id: string): void {
    const cur = $filterReleaseIds ? new Set($filterReleaseIds) : new Set<string>();
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    filterReleaseIds.set(cur.size === 0 ? null : cur);
  }
  function clearAll(): void {
    filterTiers.set(new Set());
    filterStatuses.set(new Set());
    filterPriorities.set(new Set());
    filterReleaseIds.set(null);
    filterText.set('');
  }
</script>

<div class="filter-bar">
  <input type="text" placeholder="Search display_key / action / outcome…" bind:value={$filterText} />
  <div class="chip-group">
    <span class="label">Tier:</span>
    {#each tierOrder as t}
      <button class="chip tier tier-{t}" class:active={$filterTiers.has(t)} onclick={() => toggleTier(t)}>
        {t === 'null' ? '—' : t}
      </button>
    {/each}
  </div>
  <div class="chip-group">
    <span class="label">Status:</span>
    {#each statuses as s}
      <button class="chip status status-{s}" class:active={$filterStatuses.has(s)} onclick={() => toggleStatus(s)}>
        {s}
      </button>
    {/each}
  </div>
  <div class="chip-group">
    <span class="label">Priority:</span>
    {#each priorities as p}
      <button class="chip" class:active={$filterPriorities.has(p)} onclick={() => togglePriority(p)}>
        {p}
      </button>
    {/each}
  </div>
  {#if $snapshot && $snapshot.releases.length > 0}
    <div class="chip-group">
      <span class="label">Release:</span>
      {#each $snapshot.releases as r}
        <button class="chip" class:active={$filterReleaseIds?.has(r.release_id) ?? false} onclick={() => toggleRelease(r.release_id)}>
          {r.ordinal}. {r.name}
        </button>
      {/each}
    </div>
  {/if}
  <button class="clear-btn" onclick={clearAll}>Clear all</button>
</div>

<style>
  /* Sits at Level 1 (surface-container-low); tree below at Level 0. */
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--jc-space-md) var(--jc-space-lg);
    padding: var(--jc-space-md) var(--jc-space-lg);
    background: var(--jc-surface-container-low);
    font-size: 13px;
    align-items: center;
  }
  input[type="text"] {
    flex: 1 1 240px;
    min-width: 240px;
    padding: var(--jc-space-sm) var(--jc-space-md);
    background: var(--jc-surface-container-high);
    color: var(--jc-on-surface);
    border: none;
    border-radius: var(--jc-radius-sm);
    font-family: inherit;
    font-size: 14px;
  }
  input[type="text"]::placeholder { color: var(--jc-on-surface-variant); }
  input[type="text"]:focus {
    outline: none;
    background: var(--jc-surface-container-highest);
  }
  .chip-group { display: flex; gap: var(--jc-space-sm); align-items: center; }
  .label {
    color: var(--jc-on-surface-variant);
    font-weight: 500;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .chip {
    padding: 2px var(--jc-space-md);
    background: var(--jc-surface-container-high);
    color: var(--jc-on-surface-variant);
    border: none;
    border-radius: var(--jc-radius-xs);
    font-family: var(--jc-font-mono);
    font-size: 12px;
    cursor: pointer;
    transition: background var(--jc-transition-fast), color var(--jc-transition-fast);
  }
  .chip:hover {
    color: var(--jc-on-surface);
    background: var(--jc-surface-bright);
  }
  .chip.active {
    background: var(--jc-primary-container);
    color: var(--jc-on-primary-container);
  }
  /* Tier-specific backgrounds when active reinforce the tier color. */
  .chip.tier-A.active { background: #8E6BB0; color: var(--jc-on-primary-container); }
  .chip.tier-B.active { background: #A48550; color: var(--jc-on-primary-container); }
  .chip.tier-C.active { background: #457EB8; color: var(--jc-on-primary-container); }
  .chip.tier-D.active { background: #6A9A5A; color: var(--jc-on-primary-container); }
  .clear-btn {
    margin-left: auto;
    padding: 2px var(--jc-space-md);
    background: transparent;
    color: var(--jc-on-surface-variant);
    border: none;
    border-radius: var(--jc-radius-sm);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .clear-btn:hover {
    color: var(--jc-on-surface);
    background: var(--jc-surface-bright);
  }
</style>
