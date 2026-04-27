<script lang="ts">
  import { selectedNodeRecordId, selectNode, type ViewerDecompositionNode } from '../stores/snapshot';

  interface Props {
    node: ViewerDecompositionNode;
  }
  const { node }: Props = $props();

  // Runes mode: use $derived so `selected` recomputes when the subscribed
  // store value changes. (Legacy `$: ...` reactive statements don't fire
  // under runes — that's why the row click wasn't updating the UI.)
  const selected = $derived($selectedNodeRecordId === node.record_id);

  const statusIcon: Record<string, string> = {
    atomic: '◆',
    pending: '○',
    pruned: '✕',
    deferred: '⏸',
    downgraded: '↓',
  };

  function onClick(): void {
    selectNode(node.record_id);
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }
</script>

<!-- Svelte rejects nested <button>; outer row is a div with role=button. -->
<div
  class="node-row"
  class:selected
  role="button"
  tabindex="0"
  onclick={onClick}
  onkeydown={onKeydown}
>
  <span class="indent" style="width: {Math.min(node.depth, 8) * 10}px;"></span>
  <span class="status-icon status-{node.status}">{statusIcon[node.status] ?? '·'}</span>
  {#if node.tier}
    <span class="tier-badge tier-{node.tier}">{node.tier}</span>
  {/if}
  <span class="display-key">{node.display_key}</span>
  <span class="action">{node.story_action || node.story_role}</span>
  {#if node.priority}
    <span class="priority pri-{node.priority}">{node.priority}</span>
  {/if}
  {#if node.surfaced_assumption_ids.length > 0}
    <span class="asm-chip" title="{node.surfaced_assumption_ids.length} assumption(s) surfaced">
      ⓐ {node.surfaced_assumption_ids.length}
    </span>
  {/if}
  <!-- stopPropagation so MMP button clicks don't bubble up and select the node. -->
  <div
    class="mmp-controls"
    onclick={(e: MouseEvent) => e.stopPropagation()}
    onkeydown={(e: KeyboardEvent) => e.stopPropagation()}
    role="toolbar"
    tabindex="-1"
    aria-label="MMP decision controls"
  >
    <button class="mmp-btn" disabled title="MMP Accept (v2)">✓</button>
    <button class="mmp-btn" disabled title="MMP Reject (v2)">✗</button>
    <button class="mmp-btn" disabled title="MMP Defer (v2)">⏸</button>
    <button class="mmp-btn" disabled title="MMP Edit (v2)">✎</button>
  </div>
</div>

<style>
  /* Node row — hover uses surface-bright (per DESIGN.md do's);
     selected uses a 3px primary-colored left-edge status bar. */
  .node-row {
    width: 100%;
    display: grid;
    grid-template-columns: auto auto auto auto 1fr auto auto auto;
    gap: var(--jc-space-md);
    align-items: center;
    padding: var(--jc-space-xs) var(--jc-space-lg);
    background: transparent;
    border: none;
    color: var(--jc-on-surface);
    cursor: pointer;
    text-align: left;
    font-size: 13px;
    font-family: var(--jc-font-body);
    position: relative;
    transition: background var(--jc-transition-fast);
  }
  .node-row::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: var(--jc-status-bar-width);
    background: transparent;
    transition: background var(--jc-transition-fast);
  }
  .node-row:hover { background: var(--jc-surface-bright); }
  .node-row.selected { background: var(--jc-surface-container-high); }
  .node-row.selected::before { background: var(--jc-primary); }
  .indent { display: inline-block; height: 1px; }
  .status-icon {
    font-family: var(--jc-font-mono);
    width: 16px;
    text-align: center;
    font-size: 14px;
  }
  .status-atomic     { color: var(--jc-tertiary); }
  .status-pending    { color: var(--jc-primary); }
  .status-pruned     { color: var(--jc-error); }
  .status-deferred   { color: var(--jc-warning); }
  .status-downgraded { color: var(--jc-secondary); }
  .tier-badge {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    padding: 1px var(--jc-space-sm);
    border-radius: var(--jc-radius-xs);
    font-weight: 600;
    letter-spacing: 0.05em;
  }
  .tier-A { background: color-mix(in srgb, #C678DD 22%, transparent); color: #C678DD; }
  .tier-B { background: color-mix(in srgb, #E5C07B 22%, transparent); color: #E5C07B; }
  .tier-C { background: var(--jc-primary-tint-strong); color: var(--jc-primary); }
  .tier-D { background: color-mix(in srgb, var(--jc-tertiary) 22%, transparent); color: var(--jc-tertiary); }
  .display-key {
    font-family: var(--jc-font-mono);
    font-size: 12px;
    color: var(--jc-on-surface-variant);
    white-space: nowrap;
  }
  .action {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
  .priority {
    font-family: var(--jc-font-mono);
    font-size: 10px;
    padding: 1px var(--jc-space-sm);
    border-radius: var(--jc-radius-xs);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.05em;
  }
  .pri-critical { background: color-mix(in srgb, var(--jc-error) 22%, transparent);     color: var(--jc-error); }
  .pri-high     { background: color-mix(in srgb, var(--jc-warning) 22%, transparent);   color: var(--jc-warning); }
  .pri-medium   { background: var(--jc-primary-tint-strong);                            color: var(--jc-primary); }
  .pri-low      { background: color-mix(in srgb, var(--jc-tertiary) 22%, transparent);  color: var(--jc-tertiary); }
  .asm-chip {
    font-family: var(--jc-font-mono);
    font-size: 11px;
    padding: 1px var(--jc-space-md);
    background: var(--jc-primary-container);
    color: var(--jc-on-primary-container);
    border-radius: var(--jc-radius-xs);
  }
  .mmp-controls { display: flex; gap: 1px; }
  .mmp-btn {
    background: transparent;
    color: var(--jc-outline);
    border: none;
    padding: 1px var(--jc-space-sm);
    font-family: var(--jc-font-body);
    font-size: 12px;
    border-radius: var(--jc-radius-xs);
    cursor: not-allowed;
    opacity: 0.4;
  }
</style>
