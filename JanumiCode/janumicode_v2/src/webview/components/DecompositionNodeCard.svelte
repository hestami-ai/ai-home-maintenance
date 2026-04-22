<!--
  DecompositionNodeCard — renders a single requirement_decomposition_node
  record plus its subtree (children rendered recursively inside).

  At top level we only render depth-0 (root) nodes; depth-1+ nodes are
  suppressed from the top-level feed by Card.svelte and rendered nested
  here. Each node shows its tier, status, depth badges, user story
  action/outcome preview, and a collapsible child list. Supersession
  records (e.g. status='pruned' / 'downgraded' / 'deferred') are shown
  inline on the node's current-version card with a history toggle.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { recordsStore } from '../stores/records.svelte';

  interface Props {
    record: SerializedRecord;
  }

  const { record }: Props = $props();

  interface NodeContent {
    /** Logical UUID — stable across revisions, used only for tree joins. */
    node_id: string;
    parent_node_id: string | null;
    /** Sibling-unique human label — the thing we actually display. */
    display_key: string;
    root_fr_id: string;
    depth: number;
    pass_number: number;
    status: 'pending' | 'decomposed' | 'atomic' | 'pruned' | 'deferred' | 'downgraded';
    tier?: 'A' | 'B' | 'C' | 'D';
    user_story: {
      id: string;
      role: string;
      action: string;
      outcome: string;
      acceptance_criteria: Array<{ id: string; description: string; measurable_condition: string }>;
      priority: string;
      traces_to?: string[];
    };
    decomposition_rationale?: string;
    surfaced_assumption_ids: string[];
    pruning_reason?: string;
  }

  const content = $derived(record.content as unknown as NodeContent);
  const children = $derived(recordsStore.getDecompositionChildren(content.node_id));
  // Latest version per child node_id (history lives beneath, not in main tree)
  const uniqueChildNodeIds = $derived(
    Array.from(new Set(children.map(c => (c.content as { node_id?: string }).node_id ?? ''))).filter(Boolean),
  );

  let collapsed = $state(false);
  let historyVisible = $state(false);

  // All versions of THIS node_id (to surface supersessions like pruned/deferred)
  const historyRecords = $derived(
    recordsStore.getDecompositionChildren(content.parent_node_id ?? '__root_parent__')
      .filter(r => (r.content as { node_id?: string }).node_id === content.node_id
        && r.id !== record.id),
  );

  function tierColor(tier?: string): string {
    switch (tier) {
      case 'A': return 'tier-a';
      case 'B': return 'tier-b';
      case 'C': return 'tier-c';
      case 'D': return 'tier-d';
      default: return 'tier-root';
    }
  }

  function statusIcon(status: string): string {
    switch (status) {
      case 'atomic': return '◆';
      case 'pending': return '○';
      case 'pruned': return '✗';
      case 'deferred': return '⋯';
      case 'downgraded': return '↩';
      case 'decomposed': return '●';
      default: return '?';
    }
  }
</script>

<div
  class="decomp-node decomp-depth-{content.depth} decomp-status-{content.status}"
  data-record-id={record.id}
  data-node-id={content.node_id}
>
  <button class="header" onclick={() => (collapsed = !collapsed)}>
    <span class="toggle">{collapsed ? '▶' : '▼'}</span>
    <span class="status-icon" title={content.status}>{statusIcon(content.status)}</span>
    <span class="node-id" title={content.node_id}>{content.display_key ?? content.user_story?.id ?? content.node_id}</span>
    {#if content.tier}
      <span class="tier-badge {tierColor(content.tier)}">Tier {content.tier}</span>
    {:else}
      <span class="tier-badge tier-root">Root</span>
    {/if}
    <span class="depth-badge">depth {content.depth}</span>
    <span class="action-summary">{content.user_story.action}</span>
    {#if content.status !== 'pending' && content.status !== 'decomposed'}
      <span class="status-tag status-{content.status}">{content.status}</span>
    {/if}
    {#if historyRecords.length > 0}
      <span class="history-count" title="superseded versions">+{historyRecords.length}</span>
    {/if}
  </button>

  {#if !collapsed}
    <div class="body">
      <div class="story-line">
        <span class="story-as">As a</span> <strong>{content.user_story.role}</strong>
        <span class="story-as">I want</span> <strong>{content.user_story.action}</strong>
        <span class="story-as">so that</span> {content.user_story.outcome}
      </div>

      {#if content.decomposition_rationale}
        <div class="rationale">
          <span class="rationale-label">Why:</span> {content.decomposition_rationale}
        </div>
      {/if}

      {#if content.pruning_reason}
        <div class="pruning-reason">
          <span class="pruning-label">Reason:</span> {content.pruning_reason}
        </div>
      {/if}

      {#if content.user_story.acceptance_criteria.length > 0}
        <details class="acs">
          <summary>Acceptance criteria ({content.user_story.acceptance_criteria.length})</summary>
          <ul>
            {#each content.user_story.acceptance_criteria as ac (ac.id)}
              <li>
                <span class="ac-id">{ac.id}</span>
                <span class="ac-desc">{ac.description}</span>
                <span class="ac-measure">— {ac.measurable_condition}</span>
              </li>
            {/each}
          </ul>
        </details>
      {/if}

      {#if (content.user_story.traces_to ?? []).length > 0}
        <div class="traces">
          <span class="traces-label">Traces to:</span>
          {#each content.user_story.traces_to ?? [] as tid (tid)}
            <span class="trace-chip">{tid}</span>
          {/each}
        </div>
      {/if}

      {#if historyRecords.length > 0}
        <details bind:open={historyVisible} class="history">
          <summary>Supersession history ({historyRecords.length})</summary>
          <ul>
            {#each historyRecords as hr (hr.id)}
              {@const hc = hr.content as unknown as NodeContent}
              <li>
                <span class="history-status">{hc.status}</span>
                <span class="history-pass">pass {hc.pass_number}</span>
                {#if hc.pruning_reason}<span class="history-reason">{hc.pruning_reason}</span>{/if}
              </li>
            {/each}
          </ul>
        </details>
      {/if}

      {#if uniqueChildNodeIds.length > 0}
        <div class="children">
          <div class="children-label">Children ({uniqueChildNodeIds.length})</div>
          {#each uniqueChildNodeIds as childId (childId)}
            {@const childRec = recordsStore.getLatestDecompositionNode(childId)}
            {#if childRec}
              <!-- svelte:self is deprecated but the self-import pattern
                   doesn't produce a bundleable function name; the
                   bundle-integrity test flags it. Retaining svelte:self
                   until an upstream fix lands. -->
              <svelte:self record={childRec} />
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .decomp-node {
    margin: 0.35em 0;
    border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
    padding-left: 0.5em;
    background: var(--vscode-editor-background, transparent);
  }
  .decomp-depth-0 {
    border: 1px solid var(--vscode-panel-border, #444);
    border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
    padding: 0.25em 0.5em;
    background: var(--vscode-editor-background, #1e1e1e);
  }
  .decomp-status-pruned { opacity: 0.55; border-left-color: var(--vscode-errorForeground, #f88); }
  .decomp-status-deferred { opacity: 0.7; border-left-color: var(--vscode-editorWarning-foreground, #cca700); }
  .decomp-status-downgraded { border-left-color: var(--vscode-editorWarning-foreground, #cca700); }
  .decomp-status-atomic { border-left-color: var(--vscode-testing-iconPassed, #73c991); }

  .header {
    display: flex;
    align-items: center;
    gap: 0.4em;
    width: 100%;
    padding: 0.25em 0;
    background: transparent;
    border: none;
    color: var(--vscode-foreground, inherit);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.95em;
    text-align: left;
  }
  .toggle { width: 1em; color: var(--vscode-descriptionForeground, #888); }
  .status-icon { width: 1em; color: var(--vscode-descriptionForeground, #888); }
  .node-id { font-family: var(--vscode-editor-font-family, monospace); font-weight: 600; }
  .tier-badge {
    padding: 0.05em 0.4em;
    border-radius: 0.2em;
    font-size: 0.75em;
    font-weight: 600;
  }
  .tier-a { background: rgba(100, 181, 246, 0.25); color: #64b5f6; }
  .tier-b { background: rgba(186, 104, 200, 0.25); color: #ba68c8; }
  .tier-c { background: rgba(129, 199, 132, 0.25); color: #81c784; }
  .tier-d { background: rgba(255, 183, 77, 0.25); color: #ffb74d; }
  .tier-root { background: rgba(128, 128, 128, 0.25); color: var(--vscode-descriptionForeground, #888); }
  .depth-badge {
    font-size: 0.75em;
    color: var(--vscode-descriptionForeground, #888);
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .action-summary {
    font-size: 0.9em;
    color: var(--vscode-foreground, inherit);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status-tag {
    font-size: 0.7em;
    padding: 0.05em 0.4em;
    border-radius: 0.2em;
    font-weight: 600;
    text-transform: uppercase;
  }
  .status-pruned { background: rgba(244, 67, 54, 0.25); color: var(--vscode-errorForeground, #f88); }
  .status-deferred { background: rgba(255, 167, 38, 0.25); color: var(--vscode-editorWarning-foreground, #cca700); }
  .status-downgraded { background: rgba(255, 167, 38, 0.25); color: var(--vscode-editorWarning-foreground, #cca700); }
  .status-atomic { background: rgba(129, 199, 132, 0.25); color: var(--vscode-testing-iconPassed, #73c991); }
  .history-count {
    font-size: 0.75em;
    color: var(--vscode-descriptionForeground, #888);
  }

  .body {
    margin-left: 1.5em;
    padding: 0.25em 0;
  }
  .story-line {
    font-size: 0.9em;
    margin: 0.35em 0;
    color: var(--vscode-foreground, inherit);
  }
  .story-as { color: var(--vscode-descriptionForeground, #888); font-style: italic; }
  .rationale, .pruning-reason {
    font-size: 0.85em;
    margin: 0.35em 0;
    color: var(--vscode-descriptionForeground, #ccc);
    padding: 0.35em 0.5em;
    background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
    border-left: 2px solid var(--vscode-textLink-foreground, #3794ff);
  }
  .rationale-label, .pruning-label {
    color: var(--vscode-textLink-foreground, #3794ff);
    font-weight: 600;
    margin-right: 0.3em;
  }
  .pruning-reason { border-left-color: var(--vscode-editorWarning-foreground, #cca700); }
  .acs {
    margin: 0.35em 0;
    font-size: 0.85em;
  }
  .acs summary {
    cursor: pointer;
    color: var(--vscode-descriptionForeground, #888);
  }
  .acs ul { margin: 0.35em 0; padding-left: 1.5em; }
  .acs li { margin: 0.15em 0; }
  .ac-id { font-family: var(--vscode-editor-font-family, monospace); color: var(--vscode-textLink-foreground, #3794ff); margin-right: 0.35em; }
  .ac-measure { color: var(--vscode-descriptionForeground, #888); font-style: italic; }
  .traces {
    font-size: 0.8em;
    margin: 0.35em 0;
    color: var(--vscode-descriptionForeground, #888);
  }
  .traces-label { margin-right: 0.35em; }
  .trace-chip {
    display: inline-block;
    padding: 0.05em 0.35em;
    background: rgba(127, 127, 127, 0.15);
    border-radius: 0.2em;
    margin: 0 0.15em;
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .history { margin: 0.35em 0; font-size: 0.8em; }
  .history summary { cursor: pointer; color: var(--vscode-descriptionForeground, #888); }
  .history ul { padding-left: 1.5em; margin: 0.25em 0; }
  .history-status {
    font-weight: 600;
    margin-right: 0.35em;
    text-transform: uppercase;
    font-size: 0.9em;
  }
  .history-pass { color: var(--vscode-descriptionForeground, #888); margin-right: 0.35em; }
  .history-reason { color: var(--vscode-descriptionForeground, #ccc); }

  .children {
    margin-top: 0.5em;
    padding-left: 0.5em;
    border-left: 1px dashed var(--vscode-panel-border, #444);
  }
  .children-label {
    font-size: 0.75em;
    color: var(--vscode-descriptionForeground, #888);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25em;
  }
</style>
