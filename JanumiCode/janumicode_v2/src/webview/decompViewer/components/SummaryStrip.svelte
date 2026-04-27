<script lang="ts">
  import { snapshot } from '../stores/snapshot';

  // Runes-mode: legacy `$: ...` reactive statements don't fire under runes.
  const totalsByTier = $derived.by(() => {
    const t = { A: 0, B: 0, C: 0, D: 0, null: 0 };
    if ($snapshot) {
      for (const n of $snapshot.nodes) {
        const k = (n.tier ?? 'null') as keyof typeof t;
        t[k]++;
      }
    }
    return t;
  });

  const totalsByDepth = $derived.by(() => {
    const m: Record<number, number> = {};
    if ($snapshot) {
      for (const n of $snapshot.nodes) m[n.depth] = (m[n.depth] ?? 0) + 1;
    }
    return m;
  });

  const rootSizeHistogram = $derived(
    $snapshot
      ? [...$snapshot.roots].sort((a, b) => b.node_count_total - a.node_count_total)
      : [],
  );

  const maxRootSize = $derived(
    rootSizeHistogram.reduce((m, r) => Math.max(m, r.node_count_total), 1),
  );
</script>

<div class="summary-strip">
  {#if $snapshot}
    <div class="summary-grid">
      <section>
        <h3>Totals</h3>
        <div class="stat-row"><span>nodes</span><span>{$snapshot.totals.nodes}</span></div>
        <div class="stat-row"><span>roots</span><span>{$snapshot.totals.roots}</span></div>
        <div class="stat-row"><span>atomic</span><span>{$snapshot.totals.atomic}</span></div>
        <div class="stat-row"><span>pending</span><span>{$snapshot.totals.pending}</span></div>
        <div class="stat-row"><span>pruned</span><span>{$snapshot.totals.pruned}</span></div>
        <div class="stat-row"><span>deferred</span><span>{$snapshot.totals.deferred}</span></div>
        <div class="stat-row"><span>downgraded</span><span>{$snapshot.totals.downgraded}</span></div>
        <div class="stat-row"><span>assumptions</span><span>{$snapshot.totals.assumptions}</span></div>
        <div class="stat-row"><span>dup flags</span><span>{$snapshot.totals.duplicate_assumptions}</span></div>
      </section>

      <section>
        <h3>By Tier</h3>
        <div class="stat-row"><span class="tier tier-A">A</span><span>{totalsByTier.A}</span></div>
        <div class="stat-row"><span class="tier tier-B">B</span><span>{totalsByTier.B}</span></div>
        <div class="stat-row"><span class="tier tier-C">C</span><span>{totalsByTier.C}</span></div>
        <div class="stat-row"><span class="tier tier-D">D</span><span>{totalsByTier.D}</span></div>
        <div class="stat-row"><span>—</span><span>{totalsByTier.null}</span></div>
      </section>

      <section>
        <h3>By Depth</h3>
        {#each Object.entries(totalsByDepth).sort((a, b) => +a[0] - +b[0]) as [d, n]}
          <div class="stat-row">
            <span>depth {d}</span>
            <span>{n}</span>
          </div>
        {/each}
      </section>

      <section class="wide">
        <h3>Root Size Histogram</h3>
        {#each rootSizeHistogram as r}
          <div class="hist-row">
            <span class="hist-key">{r.display_key}</span>
            <div class="bar-outer">
              <div class="bar" style="width: {(r.node_count_total / maxRootSize) * 100}%;"></div>
            </div>
            <span class="hist-count">{r.node_count_total}</span>
          </div>
        {/each}
      </section>

      {#each $snapshot.pipelines as p}
        <section class="wide">
          <h3>Pipeline: {p.root_kind ?? 'fr'}</h3>
          {#each p.passes as pp}
            <div class="pass-row">
              <span class="pass-num">pass {pp.pass_number}</span>
              <span class="pass-status pass-{pp.status}">{pp.status}</span>
              <span>{pp.nodes_produced} nodes</span>
              <span>Δ{pp.assumption_delta} asm</span>
              {#if pp.started_at && pp.completed_at}
                <span class="pass-dur">{((new Date(pp.completed_at).getTime() - new Date(pp.started_at).getTime()) / 60000).toFixed(1)} min</span>
              {/if}
            </div>
          {/each}
          {#if p.termination_reason}
            <div class="termination">⏹ terminated: {p.termination_reason}</div>
          {/if}
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Summary strip — uses Space Grotesk for the large numerical counts
     per DESIGN.md §3 "Editorial Contrast". Each stat card is a
     surface-container-low element on the surface background ("No-Line"
     rule — no borders between cards, just the background step). */
  .summary-strip {
    padding: var(--jc-space-xl);
    overflow-y: auto;
    background: var(--jc-surface);
    font-size: 14px;
    color: var(--jc-on-surface);
  }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--jc-space-lg);
  }
  section {
    background: var(--jc-surface-container-low);
    padding: var(--jc-space-lg) var(--jc-space-xl);
    border-radius: var(--jc-radius-md);
  }
  section.wide { grid-column: span 2; }
  h3 {
    margin: 0 0 var(--jc-space-md) 0;
    font-family: var(--jc-font-headline);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--jc-on-surface-variant);
    font-weight: 500;
  }
  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: var(--jc-space-xs) 0;
    font-size: 13px;
  }
  .stat-row > :first-child {
    color: var(--jc-on-surface-variant);
  }
  .stat-row > :last-child {
    font-family: var(--jc-font-headline);
    font-size: 16px;
    color: var(--jc-on-surface);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .tier {
    padding: 0 var(--jc-space-sm);
    border-radius: var(--jc-radius-xs);
    font-weight: 600;
    font-family: var(--jc-font-mono);
    font-size: 11px;
    letter-spacing: 0.05em;
  }
  .tier-A { background: color-mix(in srgb, #C678DD 22%, transparent); color: #C678DD; }
  .tier-B { background: color-mix(in srgb, #E5C07B 22%, transparent); color: #E5C07B; }
  .tier-C { background: var(--jc-primary-tint-strong); color: var(--jc-primary); }
  .tier-D { background: color-mix(in srgb, var(--jc-tertiary) 22%, transparent); color: var(--jc-tertiary); }
  .hist-row {
    display: grid;
    grid-template-columns: 110px 1fr 48px;
    gap: var(--jc-space-md);
    align-items: center;
    padding: var(--jc-space-xs) 0;
    font-size: 12px;
  }
  .hist-key {
    font-family: var(--jc-font-mono);
    color: var(--jc-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar-outer {
    background: var(--jc-surface-container);
    border-radius: var(--jc-radius-xs);
    height: 14px;
    overflow: hidden;
  }
  .bar {
    background: linear-gradient(90deg, var(--jc-primary), var(--jc-tertiary));
    height: 100%;
    border-radius: var(--jc-radius-xs);
  }
  .hist-count {
    text-align: right;
    font-family: var(--jc-font-headline);
    font-size: 13px;
    color: var(--jc-on-surface);
    font-variant-numeric: tabular-nums;
  }
  .pass-row {
    display: flex;
    gap: var(--jc-space-lg);
    padding: var(--jc-space-xs) 0;
    font-family: var(--jc-font-mono);
    font-size: 13px;
    align-items: center;
  }
  .pass-num { width: 72px; color: var(--jc-on-surface-variant); }
  .pass-status {
    padding: 1px var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: var(--jc-font-body);
    font-weight: 600;
  }
  .pass-completed  { background: color-mix(in srgb, var(--jc-tertiary) 22%, transparent); color: var(--jc-tertiary); }
  .pass-running    { background: var(--jc-primary-tint-strong); color: var(--jc-primary); }
  .pass-terminated { background: color-mix(in srgb, var(--jc-error) 22%, transparent); color: var(--jc-error); }
  .pass-dur { margin-left: auto; color: var(--jc-on-surface-variant); }
  .termination {
    margin-top: var(--jc-space-md);
    padding: var(--jc-space-md);
    background: var(--jc-error-container);
    color: var(--jc-on-error-container);
    border-radius: var(--jc-radius-sm);
    font-size: 12px;
  }
</style>
