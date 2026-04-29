<!--
  TaskDecompositionNodeCard — Wave 8 mirror of ComponentDecompositionNodeCard
  for implementation tasks. Renders a single task_decomposition_node record
  plus its subtree (children rendered recursively inside).
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { recordsStore } from '../stores/records.svelte';

  interface Props {
    record: SerializedRecord;
  }

  const { record }: Props = $props();

  interface CompletionCriterion {
    criterion_id: string;
    description: string;
    verification_method?: string;
  }

  interface TaskNodeContent {
    node_id: string;
    parent_node_id: string | null;
    display_key: string;
    root_task_id: string;
    depth: number;
    pass_number: number;
    status: 'pending' | 'decomposed' | 'atomic' | 'pruned' | 'deferred' | 'downgraded';
    tier?: 'A' | 'B' | 'C' | 'D';
    task: {
      id: string;
      name: string;
      description: string;
      task_type?: string;
      component_id: string;
      component_responsibility: string;
      backing_tool?: string;
      estimated_complexity?: string;
      complexity_flag?: string;
      completion_criteria: CompletionCriterion[];
      write_directory_paths?: string[];
      read_directory_paths?: string[];
      dependency_task_ids?: string[];
      active_constraints?: string[];
      traces_to?: string[];
    };
    decomposition_rationale?: string;
    surfaced_assumption_ids: string[];
    pruning_reason?: string;
  }

  const content = $derived(record.content as unknown as TaskNodeContent);
  const children = $derived(recordsStore.getTaskDecompositionChildren(content.node_id));
  const uniqueChildNodeIds = $derived(
    Array.from(new Set(children.map(c => (c.content as { node_id?: string }).node_id ?? ''))).filter(Boolean),
  );

  let collapsed = $state(false);
  let historyVisible = $state(false);

  const historyRecords = $derived(
    recordsStore.getTaskDecompositionChildren(content.parent_node_id ?? '__root_parent__')
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
  class="task-node task-depth-{content.depth} task-status-{content.status}"
  data-record-id={record.id}
  data-node-id={content.node_id}
>
  <button class="header" onclick={() => (collapsed = !collapsed)}>
    <span class="toggle">{collapsed ? '▶' : '▼'}</span>
    <span class="status-icon" title={content.status}>{statusIcon(content.status)}</span>
    <span class="node-id" title={content.node_id}>{content.display_key ?? content.task?.id ?? content.node_id}</span>
    {#if content.tier}
      <span class="tier-badge {tierColor(content.tier)}">Tier {content.tier}</span>
    {:else}
      <span class="tier-badge tier-root">Root</span>
    {/if}
    <span class="depth-badge">depth {content.depth}</span>
    <span class="task-name">{content.task.name}</span>
    {#if content.status !== 'pending' && content.status !== 'decomposed'}
      <span class="status-tag status-{content.status}">{content.status}</span>
    {/if}
    {#if historyRecords.length > 0}
      <span class="history-count" title="superseded versions">+{historyRecords.length}</span>
    {/if}
  </button>

  {#if !collapsed}
    <div class="body">
      <div class="comp-line">
        <span class="comp-label">Component:</span> <strong>{content.task.component_id}</strong> —
        <span class="resp-text">{content.task.component_responsibility}</span>
      </div>

      {#if content.task.description}
        <div class="description">{content.task.description}</div>
      {/if}

      {#if content.task.backing_tool || content.task.estimated_complexity}
        <div class="meta-line">
          {#if content.task.backing_tool}
            <span class="meta-chip">{content.task.backing_tool}</span>
          {/if}
          {#if content.task.estimated_complexity}
            <span class="meta-chip complexity-{content.task.estimated_complexity}">{content.task.estimated_complexity}</span>
          {/if}
          {#if content.task.task_type && content.task.task_type !== 'standard'}
            <span class="meta-chip">{content.task.task_type}</span>
          {/if}
        </div>
      {/if}

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

      {#if content.task.completion_criteria.length > 0}
        <details class="ccs" open>
          <summary>Completion criteria ({content.task.completion_criteria.length})</summary>
          <ul>
            {#each content.task.completion_criteria as cc (cc.criterion_id)}
              <li>
                <span class="cc-id">{cc.criterion_id}</span>
                <span class="cc-desc">{cc.description}</span>
                {#if cc.verification_method}
                  <span class="cc-verify">[{cc.verification_method}]</span>
                {/if}
              </li>
            {/each}
          </ul>
        </details>
      {/if}

      {#if (content.task.write_directory_paths ?? []).length > 0}
        <div class="paths">
          <span class="paths-label">Writes:</span>
          {#each content.task.write_directory_paths ?? [] as p (p)}
            <span class="path-chip">{p}</span>
          {/each}
        </div>
      {/if}

      {#if (content.task.read_directory_paths ?? []).length > 0}
        <div class="paths">
          <span class="paths-label">Reads:</span>
          {#each content.task.read_directory_paths ?? [] as p (p)}
            <span class="path-chip">{p}</span>
          {/each}
        </div>
      {/if}

      {#if (content.task.dependency_task_ids ?? []).length > 0}
        <div class="deps">
          <span class="deps-label">Dependencies:</span>
          {#each content.task.dependency_task_ids ?? [] as did (did)}
            <span class="dep-chip">{did}</span>
          {/each}
        </div>
      {/if}

      {#if (content.task.active_constraints ?? []).length > 0}
        <div class="constraints">
          <span class="constraints-label">Active constraints:</span>
          {#each content.task.active_constraints ?? [] as cid (cid)}
            <span class="constraint-chip">{cid}</span>
          {/each}
        </div>
      {/if}

      {#if (content.task.traces_to ?? []).length > 0}
        <div class="traces">
          <span class="traces-label">Traces to:</span>
          {#each content.task.traces_to ?? [] as tid (tid)}
            <span class="trace-chip">{tid}</span>
          {/each}
        </div>
      {/if}

      {#if historyRecords.length > 0}
        <details bind:open={historyVisible} class="history">
          <summary>Supersession history ({historyRecords.length})</summary>
          <ul>
            {#each historyRecords as hr (hr.id)}
              {@const hc = hr.content as unknown as TaskNodeContent}
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
            {@const childRec = recordsStore.getLatestTaskDecompositionNode(childId)}
            {#if childRec}
              <svelte:self record={childRec} />
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .task-node {
    margin: 0.35em 0;
    border-left: 3px solid var(--vscode-charts-orange, #d18616);
    padding-left: 0.5em;
    background: var(--vscode-editor-background, transparent);
  }
  .task-depth-0 {
    border: 1px solid var(--vscode-panel-border, #444);
    border-left: 3px solid var(--vscode-charts-orange, #d18616);
    padding: 0.25em 0.5em;
    background: var(--vscode-editor-background, #1e1e1e);
  }
  .task-status-pruned { opacity: 0.55; border-left-color: var(--vscode-errorForeground, #f88); }
  .task-status-deferred { opacity: 0.7; border-left-color: var(--vscode-editorWarning-foreground, #cca700); }
  .task-status-downgraded { border-left-color: var(--vscode-editorWarning-foreground, #cca700); }
  .task-status-atomic { border-left-color: var(--vscode-testing-iconPassed, #73c991); }

  .header {
    display: flex; align-items: center; gap: 0.4em; width: 100%;
    padding: 0.25em 0; background: transparent; border: none;
    color: var(--vscode-foreground, inherit); cursor: pointer;
    font-family: inherit; font-size: 0.95em; text-align: left;
  }
  .toggle { width: 1em; color: var(--vscode-descriptionForeground, #888); }
  .status-icon { width: 1em; color: var(--vscode-descriptionForeground, #888); }
  .node-id { font-family: var(--vscode-editor-font-family, monospace); font-weight: 600; }
  .tier-badge { padding: 0.05em 0.4em; border-radius: 0.2em; font-size: 0.75em; font-weight: 600; }
  .tier-a { background: rgba(100, 181, 246, 0.25); color: #64b5f6; }
  .tier-b { background: rgba(186, 104, 200, 0.25); color: #ba68c8; }
  .tier-c { background: rgba(129, 199, 132, 0.25); color: #81c784; }
  .tier-d { background: rgba(255, 183, 77, 0.25); color: #ffb74d; }
  .tier-root { background: rgba(128, 128, 128, 0.25); color: var(--vscode-descriptionForeground, #888); }
  .depth-badge { font-size: 0.75em; color: var(--vscode-descriptionForeground, #888); font-family: var(--vscode-editor-font-family, monospace); }
  .task-name { font-size: 0.9em; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status-tag { font-size: 0.7em; padding: 0.05em 0.4em; border-radius: 0.2em; font-weight: 600; text-transform: uppercase; }
  .status-pruned { background: rgba(244, 67, 54, 0.25); color: var(--vscode-errorForeground, #f88); }
  .status-deferred { background: rgba(255, 167, 38, 0.25); color: var(--vscode-editorWarning-foreground, #cca700); }
  .status-downgraded { background: rgba(255, 167, 38, 0.25); color: var(--vscode-editorWarning-foreground, #cca700); }
  .status-atomic { background: rgba(129, 199, 132, 0.25); color: var(--vscode-testing-iconPassed, #73c991); }
  .history-count { font-size: 0.75em; color: var(--vscode-descriptionForeground, #888); }

  .body { margin-left: 1.5em; padding: 0.25em 0; }
  .comp-line { font-size: 0.85em; margin: 0.2em 0; color: var(--vscode-descriptionForeground, #ccc); }
  .comp-label { color: var(--vscode-charts-orange, #d18616); margin-right: 0.3em; }
  .resp-text { color: var(--vscode-descriptionForeground, #aaa); }
  .description {
    font-size: 0.85em; margin: 0.35em 0;
    color: var(--vscode-descriptionForeground, #ccc);
    padding: 0.35em 0.5em;
    background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
    border-left: 2px solid var(--vscode-charts-orange, #d18616);
  }
  .meta-line { display: flex; gap: 0.25em; margin: 0.25em 0; }
  .meta-chip {
    font-size: 0.7em; padding: 0.05em 0.4em; border-radius: 0.2em;
    background: rgba(127, 127, 127, 0.15);
    color: var(--vscode-descriptionForeground, #aaa);
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .complexity-low { color: #73c991; }
  .complexity-medium { color: #cca700; }
  .complexity-high { color: #f88; }
  .rationale, .pruning-reason {
    font-size: 0.85em; margin: 0.35em 0;
    color: var(--vscode-descriptionForeground, #ccc);
    padding: 0.35em 0.5em;
    background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
    border-left: 2px solid var(--vscode-charts-orange, #d18616);
  }
  .rationale-label, .pruning-label, .comp-label {
    color: var(--vscode-charts-orange, #d18616); font-weight: 600; margin-right: 0.3em;
  }
  .pruning-reason { border-left-color: var(--vscode-editorWarning-foreground, #cca700); }
  .ccs { margin: 0.35em 0; font-size: 0.85em; }
  .ccs summary { cursor: pointer; color: var(--vscode-descriptionForeground, #888); }
  .ccs ul { margin: 0.35em 0; padding-left: 1.5em; }
  .cc-id { font-family: var(--vscode-editor-font-family, monospace); color: var(--vscode-charts-orange, #d18616); margin-right: 0.35em; }
  .cc-verify { font-size: 0.75em; color: var(--vscode-descriptionForeground, #888); margin-left: 0.35em; }
  .deps, .constraints, .traces, .paths { font-size: 0.8em; margin: 0.35em 0; color: var(--vscode-descriptionForeground, #888); }
  .dep-chip, .constraint-chip, .trace-chip, .path-chip {
    display: inline-block; padding: 0.05em 0.35em;
    background: rgba(127, 127, 127, 0.15); border-radius: 0.2em;
    margin: 0 0.15em; font-family: var(--vscode-editor-font-family, monospace);
  }
  .history { margin: 0.35em 0; font-size: 0.8em; }
  .history summary { cursor: pointer; color: var(--vscode-descriptionForeground, #888); }
  .history ul { padding-left: 1.5em; margin: 0.25em 0; }
  .history-status { font-weight: 600; margin-right: 0.35em; text-transform: uppercase; font-size: 0.9em; }
  .history-pass { color: var(--vscode-descriptionForeground, #888); margin-right: 0.35em; }
  .history-reason { color: var(--vscode-descriptionForeground, #ccc); }

  .children {
    margin-top: 0.5em; padding-left: 0.5em;
    border-left: 1px dashed var(--vscode-panel-border, #444);
  }
  .children-label {
    font-size: 0.75em; color: var(--vscode-descriptionForeground, #888);
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25em;
  }
</style>
