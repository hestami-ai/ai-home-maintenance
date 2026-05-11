<script lang="ts">
  import MatterHeaderBar from './MatterHeaderBar.svelte';
  import type { ExtToWebviewMessage, MatterContextPayload, CrossMatterPayload } from './types.js';

  let context: MatterContextPayload | null = $state(null);
  let crossMatter: CrossMatterPayload | null = $state(null);
  let mistakenMatterAffected: readonly string[] = $state([]);

  // Listen for messages from the extension host. The host posts a fresh
  // matter_context message on every switch — receiving one fully replaces
  // any prior matter content (per multi-matter §8.2).
  if (typeof window !== 'undefined') {
    window.addEventListener('message', (e: MessageEvent<ExtToWebviewMessage>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'matter_context':
          context = msg.payload;
          crossMatter = null;
          mistakenMatterAffected = [];
          break;
        case 'cross_matter_dashboard':
          crossMatter = msg.payload;
          context = null;
          break;
        case 'mistaken_matter_recovery':
          mistakenMatterAffected = msg.payload.affectedArtifactIds;
          break;
      }
    });
  }
</script>

<MatterHeaderBar {context} />

<main>
  {#if mistakenMatterAffected.length > 0}
    <section class="mistaken-banner" role="alert">
      Mistaken-matter action detected. Affected artifacts ({mistakenMatterAffected.length}) require re-evaluation.
    </section>
  {/if}

  {#if context}
    <section class="dashboard">
      <h2>Matter Dashboard</h2>
      <p>Active matter: <strong>{context.matterName}</strong> ({context.practiceArea}).</p>
      <p class="hint">Wave 7 — header bar live. Issue tree, authority map, release-gate view, etc., land in Wave 8 UI expansion.</p>
    </section>
  {:else if crossMatter}
    <section class="cross-matter">
      <h2>All Matters (read-only)</h2>
      <ul>
        {#each crossMatter.matters as m (m.scope.matterId)}
          <li>
            <span class="cm-client">{m.clientName}</span> ›
            <span class="cm-name">{m.matterName}</span>
            <span class="cm-status">[{m.status}]</span>
          </li>
        {/each}
      </ul>
      <p class="hint">Cross-matter view is read-only. To act on a matter, switch into it.</p>
    </section>
  {:else}
    <section class="empty-state">
      <p>Select a matter to begin.</p>
    </section>
  {/if}
</main>

<style>
  main {
    padding: 1rem;
    font-family: var(--vscode-font-family, sans-serif);
    color: var(--vscode-editor-foreground, #ddd);
  }
  h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
  }
  .hint {
    opacity: 0.7;
    font-size: 0.8rem;
  }
  .mistaken-banner {
    background: #6b1d1d;
    color: #ffd;
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    margin-bottom: 0.75rem;
  }
  ul { list-style: none; padding: 0; }
  li { padding: 0.25rem 0; }
  .cm-client { font-weight: 600; }
  .cm-name { font-weight: 500; }
  .cm-status { opacity: 0.6; font-size: 0.85rem; margin-left: 0.5rem; }
</style>
