<!--
  AssumptionSnapshotCard — renders a Wave 6 `assumption_set_snapshot`
  record produced by Phase 2.1a at the end of each saturation pass.
  Headers show pass number + delta from the previous pass so the
  saturation curve is visible at a glance. Expanded view lists all
  accumulated assumptions with their category chips.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';

  interface Props {
    record: SerializedRecord;
  }

  const { record }: Props = $props();

  interface Assumption {
    id: string;
    text: string;
    source: string;
    surfaced_at_node?: string;
    surfaced_at_pass: number;
    category: string;
    citations?: string[];
  }

  interface SnapshotContent {
    pass_number: number;
    root_fr_id: string;
    assumptions: Assumption[];
    delta_from_previous_pass: number;
  }

  const content = $derived(record.content as unknown as SnapshotContent);

  let collapsed = $state(true);

  function categoryColor(cat: string): string {
    switch (cat) {
      case 'domain_regime': return 'cat-domain';
      case 'compliance': return 'cat-compliance';
      case 'constraint': return 'cat-constraint';
      case 'scope': return 'cat-scope';
      case 'open_question': return 'cat-open';
      default: return 'cat-other';
    }
  }

  const newThisPass = $derived(
    content.assumptions.filter(a => a.surfaced_at_pass === content.pass_number),
  );
  const saturationSignal = $derived(
    content.delta_from_previous_pass === 0 ? 'saturated' : 'active',
  );
</script>

<div class="snapshot-card snapshot-{saturationSignal}" data-record-id={record.id}>
  <button class="header" onclick={() => (collapsed = !collapsed)}>
    <span class="toggle">{collapsed ? '▶' : '▼'}</span>
    <span class="icon">∫</span>
    <span class="label">Assumption snapshot — pass {content.pass_number}</span>
    <span class="delta" class:delta-zero={content.delta_from_previous_pass === 0}>
      Δ +{content.delta_from_previous_pass}
    </span>
    <span class="total">{content.assumptions.length} total</span>
    {#if saturationSignal === 'saturated'}
      <span class="saturated-chip">fixed point</span>
    {/if}
  </button>

  {#if !collapsed}
    <div class="body">
      {#if newThisPass.length > 0}
        <div class="new-label">New this pass ({newThisPass.length})</div>
        <ul class="assumptions">
          {#each newThisPass as a (a.id)}
            <li class="assumption">
              <span class="cat-chip {categoryColor(a.category)}">{a.category}</span>
              <span class="a-id">{a.id}</span>
              <span class="a-text">{a.text}</span>
              {#if a.surfaced_at_node}
                <span class="surfaced">@ {a.surfaced_at_node}</span>
              {/if}
              {#if (a.citations ?? []).length > 0}
                <span class="citations">
                  {#each a.citations ?? [] as c (c)}
                    <span class="cite-chip">{c}</span>
                  {/each}
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <div class="no-new">
          No new assumptions this pass — decomposition reached fixed point on this branch.
        </div>
      {/if}

      {#if content.assumptions.length > newThisPass.length}
        <details class="prior">
          <summary>Prior ({content.assumptions.length - newThisPass.length})</summary>
          <ul class="assumptions">
            {#each content.assumptions.filter(a => a.surfaced_at_pass !== content.pass_number) as a (a.id)}
              <li class="assumption">
                <span class="cat-chip {categoryColor(a.category)}">{a.category}</span>
                <span class="a-id">{a.id}</span>
                <span class="a-text">{a.text}</span>
                <span class="a-pass">pass {a.surfaced_at_pass}</span>
              </li>
            {/each}
          </ul>
        </details>
      {/if}
    </div>
  {/if}
</div>

<style>
  .snapshot-card {
    margin: 0.5em 0;
    border: 1px solid var(--vscode-panel-border, #444);
    border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
    background: var(--vscode-editor-background, #1e1e1e);
  }
  .snapshot-saturated {
    border-left-color: var(--vscode-testing-iconPassed, #73c991);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.5em;
    width: 100%;
    padding: 0.5em 0.75em;
    background: transparent;
    border: none;
    color: var(--vscode-foreground, inherit);
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    text-align: left;
  }
  .toggle { width: 1em; color: var(--vscode-descriptionForeground, #888); }
  .icon { color: var(--vscode-textLink-foreground, #3794ff); }
  .label { font-weight: 600; flex: 1; }
  .delta {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.85em;
    color: var(--vscode-editorWarning-foreground, #cca700);
  }
  .delta-zero { color: var(--vscode-testing-iconPassed, #73c991); }
  .total {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground, #888);
  }
  .saturated-chip {
    font-size: 0.7em;
    padding: 0.05em 0.4em;
    border-radius: 0.2em;
    background: rgba(129, 199, 132, 0.25);
    color: var(--vscode-testing-iconPassed, #73c991);
    font-weight: 600;
    text-transform: uppercase;
  }

  .body {
    padding: 0 0.75em 0.75em;
  }
  .new-label {
    font-size: 0.75em;
    color: var(--vscode-descriptionForeground, #888);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0.5em 0 0.25em;
  }
  .no-new {
    font-size: 0.9em;
    color: var(--vscode-testing-iconPassed, #73c991);
    font-style: italic;
    padding: 0.5em 0;
  }
  .assumptions { list-style: none; padding: 0; margin: 0; }
  .assumption {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.4em;
    padding: 0.35em 0;
    font-size: 0.9em;
    border-bottom: 1px dashed var(--vscode-panel-border, #333);
  }
  .assumption:last-child { border-bottom: none; }
  .cat-chip {
    font-size: 0.7em;
    padding: 0.05em 0.35em;
    border-radius: 0.2em;
    font-weight: 600;
    text-transform: uppercase;
  }
  .cat-domain { background: rgba(100, 181, 246, 0.25); color: #64b5f6; }
  .cat-compliance { background: rgba(186, 104, 200, 0.25); color: #ba68c8; }
  .cat-constraint { background: rgba(255, 167, 38, 0.25); color: #ffa726; }
  .cat-scope { background: rgba(129, 199, 132, 0.25); color: #81c784; }
  .cat-open { background: rgba(244, 67, 54, 0.25); color: #ef5350; }
  .cat-other { background: rgba(127, 127, 127, 0.25); color: var(--vscode-descriptionForeground, #888); }
  .a-id {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.75em;
    color: var(--vscode-descriptionForeground, #888);
  }
  .a-text { flex: 1; }
  .surfaced, .a-pass {
    font-size: 0.75em;
    color: var(--vscode-descriptionForeground, #888);
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .citations { display: inline-flex; gap: 0.2em; }
  .cite-chip {
    font-size: 0.75em;
    padding: 0.05em 0.3em;
    background: rgba(127, 127, 127, 0.15);
    border-radius: 0.2em;
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .prior { margin-top: 0.5em; font-size: 0.9em; }
  .prior summary { cursor: pointer; color: var(--vscode-descriptionForeground, #888); }
</style>
