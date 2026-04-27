<script lang="ts">
  import { snapshot, nodesByNodeId, selectNode } from '../stores/snapshot';

  // Runes-mode: local form state must be $state so bind: works; derivations
  // must be $derived so they recompute when inputs change (legacy `$: ...`
  // is ignored under runes).
  let textFilter = $state('');
  let categoryFilter = $state<string>('all');
  let onlyDuplicates = $state(false);

  const filtered = $derived(
    ($snapshot?.assumptions ?? []).filter(a => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (onlyDuplicates && !a.duplicate_of) return false;
      if (textFilter.trim().length > 0) {
        const q = textFilter.toLowerCase();
        const hay = (a.id + ' ' + a.text + ' ' + a.category).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }),
  );

  const categoryCounts = $derived.by(() => {
    const m: Record<string, number> = {};
    if ($snapshot) for (const a of $snapshot.assumptions) m[a.category] = (m[a.category] ?? 0) + 1;
    return m;
  });

  function gotoNode(nodeId: string): void {
    const n = $nodesByNodeId.get(nodeId);
    if (n) selectNode(n.record_id);
  }
</script>

<div class="assumptions-panel">
  <header>
    <input type="text" bind:value={textFilter} placeholder="Search assumption text or id…" />
    <select bind:value={categoryFilter}>
      <option value="all">All categories ({$snapshot?.assumptions.length ?? 0})</option>
      {#each Object.entries(categoryCounts) as [cat, n]}
        <option value={cat}>{cat} ({n})</option>
      {/each}
    </select>
    <label>
      <input type="checkbox" bind:checked={onlyDuplicates} />
      Only duplicates
    </label>
    <span class="shown">{filtered.length} shown</span>
  </header>

  <ul class="list">
    {#each filtered as a}
      <li>
        <div class="row">
          <span class="asm-id">{a.id}</span>
          <span class="asm-cat">{a.category}</span>
          {#if a.duplicate_of}
            <span class="asm-dup">dup of {a.duplicate_of}
              {#if a.duplicate_similarity !== undefined}
                ({(a.duplicate_similarity).toFixed(3)})
              {/if}
            </span>
          {/if}
          <span class="asm-src">pass {a.surfaced_at_pass}</span>
          {#if a.surfaced_at_node}
            <button class="goto" onclick={() => gotoNode(a.surfaced_at_node)}>→ node</button>
          {/if}
        </div>
        <div class="text">{a.text}</div>
        {#if a.citations && a.citations.length > 0}
          <div class="citations">
            {#each a.citations as c}<span class="cit-chip">{c}</span>{/each}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .assumptions-panel {
    flex: 1;
    overflow-y: auto;
    padding: var(--jc-space-lg) var(--jc-space-xl);
    background: var(--jc-surface);
    color: var(--jc-on-surface);
  }
  header {
    display: flex;
    gap: var(--jc-space-lg);
    align-items: center;
    padding: var(--jc-space-md) 0 var(--jc-space-lg) 0;
    margin-bottom: var(--jc-space-lg);
  }
  input[type="text"] {
    flex: 1;
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
  select {
    background: var(--jc-surface-container-high);
    color: var(--jc-on-surface);
    border: none;
    padding: var(--jc-space-sm) var(--jc-space-md);
    font-family: inherit;
    font-size: 13px;
    border-radius: var(--jc-radius-sm);
  }
  label {
    font-size: 13px;
    display: flex;
    gap: var(--jc-space-sm);
    align-items: center;
    color: var(--jc-on-surface-variant);
  }
  .shown {
    font-family: var(--jc-font-mono);
    font-size: 12px;
    color: var(--jc-on-surface-variant);
    margin-left: auto;
  }
  .list { list-style: none; padding: 0; margin: 0; }
  li {
    margin-bottom: var(--jc-space-md);
    padding: var(--jc-space-md) var(--jc-space-lg);
    background: var(--jc-surface-container-low);
    border-radius: var(--jc-radius-sm);
  }
  .row { display: flex; gap: var(--jc-space-md); align-items: center; flex-wrap: wrap; }
  .asm-id {
    font-family: var(--jc-font-mono);
    font-size: 12px;
    color: var(--jc-on-surface-variant);
  }
  .asm-cat {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    padding: 1px var(--jc-space-sm);
    background: var(--jc-surface-container-high);
    color: var(--jc-on-surface-variant);
    border-radius: var(--jc-radius-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .asm-dup {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    padding: 1px var(--jc-space-sm);
    background: color-mix(in srgb, var(--jc-warning) 22%, transparent);
    color: var(--jc-warning);
    border-radius: var(--jc-radius-xs);
  }
  .asm-src {
    font-family: var(--jc-font-mono);
    font-size: 12px;
    color: var(--jc-on-surface-variant);
  }
  .goto {
    margin-left: auto;
    padding: 1px var(--jc-space-md);
    background: transparent;
    color: var(--jc-on-surface-variant);
    border: none;
    font-family: inherit;
    font-size: 12px;
    border-radius: var(--jc-radius-sm);
    cursor: pointer;
    transition: background var(--jc-transition-fast), color var(--jc-transition-fast);
  }
  .goto:hover {
    color: var(--jc-on-surface);
    background: var(--jc-surface-bright);
  }
  .text {
    margin-top: var(--jc-space-sm);
    color: var(--jc-on-surface);
    font-size: 14px;
    line-height: 1.5;
  }
  .citations { margin-top: var(--jc-space-md); display: flex; gap: var(--jc-space-sm); flex-wrap: wrap; }
  .cit-chip {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    padding: 1px var(--jc-space-sm);
    background: var(--jc-surface-container);
    color: var(--jc-on-surface-variant);
    border-radius: var(--jc-radius-xs);
  }
</style>
