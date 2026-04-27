<script lang="ts">
  import { selectedNodeRecordId, nodesByRecordId, assumptionsById, selectNode } from '../stores/snapshot';

  // Runes-mode derivations (legacy `$: ...` is ignored under runes).
  const node = $derived(
    $selectedNodeRecordId ? $nodesByRecordId.get($selectedNodeRecordId) ?? null : null,
  );
  const nodeAssumptions = $derived(
    node
      ? (node.surfaced_assumption_ids || [])
          .map(id => $assumptionsById.get(id))
          .filter((x): x is NonNullable<typeof x> => x !== undefined)
      : [],
  );
</script>

<aside class="detail-drawer">
  {#if node}
    <header>
      <div class="key-row">
        <span class="display-key">{node.display_key}</span>
        {#if node.tier}
          <span class="tier tier-{node.tier}">Tier {node.tier}</span>
        {/if}
        <span class="status status-{node.status}">{node.status}</span>
      </div>
      <button class="close-btn" onclick={() => selectNode(null)}>✕</button>
    </header>
    <section class="story">
      <h3>User Story</h3>
      <p><strong>As a</strong> {node.story_role || '—'},</p>
      <p><strong>I want</strong> {node.story_action || '—'},</p>
      <p><strong>so that</strong> {node.story_outcome || '—'}.</p>
      {#if node.priority}<p class="meta">Priority: {node.priority}</p>{/if}
      <p class="meta">
        Depth: {node.depth} · Pass: {node.pass_number}
        {#if node.release_ordinal !== null}· Release: {node.release_ordinal}{/if}
        {#if node.tier_hint}· Hint: {node.tier_hint}{/if}
      </p>
    </section>

    {#if node.tier_rationale}
      <section class="rationale">
        <h3>Tier Rationale</h3>
        <p>{node.tier_rationale}</p>
      </section>
    {/if}

    {#if node.pruning_reason || node.downgrade_reason}
      <section class="banner-reason">
        {#if node.pruning_reason}<p><strong>Pruned:</strong> {node.pruning_reason}</p>{/if}
        {#if node.downgrade_reason}<p><strong>Downgraded:</strong> {node.downgrade_reason}</p>{/if}
      </section>
    {/if}

    {#if node.acceptance_criteria.length > 0}
      <section class="acs">
        <h3>Acceptance Criteria ({node.acceptance_criteria.length})</h3>
        <ul>
          {#each node.acceptance_criteria as ac}
            <li>
              <div class="ac-id">{ac.id}</div>
              <div class="ac-desc">{ac.description}</div>
              {#if ac.measurable_condition}
                <div class="ac-measurable">Measurable: {ac.measurable_condition}</div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if node.traces_to.length > 0}
      <section class="traces">
        <h3>Traces To</h3>
        <ul class="chip-list">
          {#each node.traces_to as t}<li class="trace-chip">{t}</li>{/each}
        </ul>
      </section>
    {/if}

    {#if nodeAssumptions.length > 0}
      <section class="assumptions">
        <h3>Surfaced Assumptions ({nodeAssumptions.length})</h3>
        <ul>
          {#each nodeAssumptions as a}
            <li>
              <div class="asm-head">
                <span class="asm-id">{a.id}</span>
                <span class="asm-cat">{a.category}</span>
                {#if a.duplicate_of}<span class="asm-dup">dup of {a.duplicate_of}</span>{/if}
              </div>
              <div class="asm-text">{a.text}</div>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if node.children_display_keys.length > 0}
      <section class="children">
        <h3>Children ({node.children_display_keys.length})</h3>
        <ul class="chip-list">
          {#each node.children_display_keys as k}<li class="child-chip">{k}</li>{/each}
        </ul>
      </section>
    {/if}

    <section class="mmp-section">
      <h3>MMP Decision (v2 — disabled)</h3>
      <div class="mmp-grid">
        <button disabled title="Accept this node">Accept</button>
        <button disabled title="Reject this node">Reject</button>
        <button disabled title="Defer">Defer</button>
        <button disabled title="Edit">Edit</button>
        <button disabled class="full" title="Accept whole subtree">Accept subtree</button>
        <button disabled class="full" title="Reject whole subtree">Reject subtree</button>
      </div>
    </section>
  {:else}
    <div class="empty">
      Select a node to see details.
    </div>
  {/if}
</aside>

<style>
  /* Drawer at Level 1 (surface-container-low); tree at Level 0.
     Separation is the background step, not a border. */
  .detail-drawer {
    background: var(--jc-surface-container-low);
    overflow-y: auto;
    padding: 0;
    font-size: 13px;
    color: var(--jc-on-surface);
  }
  .empty {
    padding: var(--jc-space-2xl);
    color: var(--jc-on-surface-variant);
    text-align: center;
    font-size: 13px;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: var(--jc-space-md) var(--jc-space-lg);
    background: var(--jc-surface-container);
  }
  .key-row { display: flex; gap: var(--jc-space-md); flex-wrap: wrap; align-items: center; }
  .display-key {
    font-family: var(--jc-font-mono);
    font-size: 14px;
    color: var(--jc-on-surface);
    font-weight: 600;
  }
  .tier, .status {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    padding: 1px var(--jc-space-sm);
    border-radius: var(--jc-radius-xs);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.05em;
  }
  .tier-A { background: color-mix(in srgb, #C678DD 22%, transparent); color: #C678DD; }
  .tier-B { background: color-mix(in srgb, #E5C07B 22%, transparent); color: #E5C07B; }
  .tier-C { background: var(--jc-primary-tint-strong); color: var(--jc-primary); }
  .tier-D { background: color-mix(in srgb, var(--jc-tertiary) 22%, transparent); color: var(--jc-tertiary); }
  .status-atomic     { background: color-mix(in srgb, var(--jc-tertiary) 22%, transparent); color: var(--jc-tertiary); }
  .status-pending    { background: var(--jc-primary-tint-strong); color: var(--jc-primary); }
  .status-pruned     { background: color-mix(in srgb, var(--jc-error) 22%, transparent); color: var(--jc-error); }
  .status-deferred   { background: color-mix(in srgb, var(--jc-warning) 22%, transparent); color: var(--jc-warning); }
  .status-downgraded { background: color-mix(in srgb, var(--jc-secondary) 30%, transparent); color: var(--jc-secondary); }
  .close-btn {
    background: transparent;
    color: var(--jc-on-surface-variant);
    border: none;
    cursor: pointer;
    padding: var(--jc-space-xs) var(--jc-space-md);
    font-size: 14px;
    border-radius: var(--jc-radius-sm);
    transition: background var(--jc-transition-fast);
  }
  .close-btn:hover { background: var(--jc-surface-bright); color: var(--jc-on-surface); }
  /* Section separation uses background tonal steps — odd sections get a
     slightly lighter surface to create rhythm without a divider. */
  section {
    padding: var(--jc-space-md) var(--jc-space-lg);
  }
  section + section { margin-top: 1px; }
  h3 {
    margin: 0 0 var(--jc-space-sm) 0;
    font-family: var(--jc-font-headline);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--jc-on-surface-variant);
    font-weight: 500;
  }
  p { margin: 2px 0; line-height: 1.5; font-size: 13px; }
  .meta {
    color: var(--jc-on-surface-variant);
    font-family: var(--jc-font-mono);
    font-size: 11px;
    margin-top: var(--jc-space-md);
  }
  .banner-reason {
    background: var(--jc-error-container);
    color: var(--jc-on-error-container);
  }
  .acs ul, .assumptions ul { list-style: none; padding: 0; margin: 0; }
  .acs li, .assumptions li {
    margin-bottom: var(--jc-space-md);
    padding: var(--jc-space-md);
    background: var(--jc-surface-container);
    border-radius: var(--jc-radius-sm);
  }
  .ac-id, .asm-id {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    color: var(--jc-on-surface-variant);
  }
  .ac-desc, .asm-text { margin: 2px 0; color: var(--jc-on-surface); font-size: 13px; }
  .ac-measurable {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    color: var(--jc-on-surface-variant);
    margin-top: var(--jc-space-sm);
  }
  .asm-head { display: flex; gap: var(--jc-space-md); align-items: center; flex-wrap: wrap; }
  .asm-cat {
    font-family: var(--jc-font-mono);
    font-size: 10px;
    padding: 1px var(--jc-space-sm);
    background: var(--jc-surface-container-high);
    color: var(--jc-on-surface-variant);
    border-radius: var(--jc-radius-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .asm-dup {
    font-family: var(--jc-font-mono);
    font-size: 10px;
    padding: 1px var(--jc-space-sm);
    background: color-mix(in srgb, var(--jc-warning) 22%, transparent);
    color: var(--jc-warning);
    border-radius: var(--jc-radius-xs);
  }
  .chip-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--jc-space-sm);
  }
  .trace-chip, .child-chip {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    padding: 2px var(--jc-space-md);
    background: var(--jc-surface-container);
    color: var(--jc-on-surface);
    border-radius: var(--jc-radius-xs);
  }
  .mmp-section { background: var(--jc-surface); }
  .mmp-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--jc-space-sm);
  }
  .mmp-grid button {
    padding: var(--jc-space-sm) var(--jc-space-md);
    background: var(--jc-surface-container);
    color: var(--jc-outline);
    border: none;
    border-radius: var(--jc-radius-sm);
    font-family: inherit;
    font-size: 12px;
    cursor: not-allowed;
    opacity: 0.5;
  }
  .mmp-grid .full { grid-column: span 2; }
</style>
