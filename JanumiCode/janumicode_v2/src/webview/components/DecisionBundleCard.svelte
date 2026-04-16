<!--
  DecisionBundleCard — composite Mirror + Menu decision surface.

  The whole point of this card is atomicity: the user sees one header,
  one progress counter, and one Submit button, so it's impossible to
  resolve the Mirror section while missing the Menu section (or vice
  versa). Every per-row action (accept / reject / edit / defer, menu
  select, ask-more) flows through bundleStagingStore. Submit dispatches
  a single `decisionBundleSubmit` postMessage; DecisionRouter turns that
  into exactly one `decision_bundle_resolved` record.

  Inline edits stay local until Submit — that invariant lives in
  bundleStagingStore.stageMirror('edited', …), which buffers the final
  text without emitting a per-keystroke governed-stream record. Ask-more
  pre-fills the composer with `@bundle:<id>:<item>` and routes through
  the Client Liaison as an open query; the phase gate stays paused
  because the bundle itself isn't resolved yet.
-->
<script lang="ts">
  import type { SerializedRecord } from '../stores/records.svelte';
  import { bundleStagingStore } from '../stores/bundleStaging.svelte';
  import { composerStore } from '../stores/composer.svelte';
  import {
    countPendingInBundle,
    computeBundleCounters,
    type DecisionBundleContent,
    type MirrorDecisionAction,
  } from '../../lib/types/decisionBundle';

  interface Props {
    record: SerializedRecord;
    vscode?: { postMessage(message: unknown): void };
  }

  const { record, vscode }: Props = $props();

  const content = $derived(record.content as unknown as DecisionBundleContent);
  const mirror = $derived(content.mirror ?? null);
  const menu = $derived(content.menu ?? null);
  const surfaceId = $derived(content.surface_id ?? record.id);

  const draft = $derived(bundleStagingStore.getDraft(record.id));
  const pending = $derived(
    countPendingInBundle(content, Object.values(draft.mirror), draft.menu),
  );
  const counters = $derived(
    computeBundleCounters(Object.values(draft.mirror), draft.menu),
  );

  // Inline edit UX — which rows are currently showing the textarea. The
  // edited text itself lives in bundleStagingStore; this set just
  // controls visibility.
  let editOpen = $state<Set<string>>(new Set());
  function toggleEdit(itemId: string) {
    const next = new Set(editOpen);
    if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
    editOpen = next;
  }

  function stageMirror(itemId: string, action: MirrorDecisionAction | null, text?: string): void {
    bundleStagingStore.stageMirror(record.id, itemId, action, text);
  }

  function stageMenu(optionId: string, freeText?: string): void {
    if (!menu) return;
    bundleStagingStore.stageMenu(record.id, optionId, menu.multi_select, freeText);
  }

  function isMenuSelected(optionId: string): boolean {
    return draft.menu.some(s => s.option_id === optionId);
  }

  function mirrorAction(itemId: string): MirrorDecisionAction | null {
    return draft.mirror[itemId]?.action ?? null;
  }

  function mirrorEditedText(itemId: string, fallback: string): string {
    return draft.mirror[itemId]?.edited_text ?? fallback;
  }

  // Ask-more routes as an open query through the Client Liaison. We
  // pre-fill the composer with a reference token so the Liaison can
  // tell the follow-up is about this specific option; the phase gate
  // stays paused because the bundle hasn't been submitted.
  function askMore(kind: 'mirror' | 'menu', itemId: string, label: string): void {
    const prefix = kind === 'mirror' ? 'mirror' : 'menu';
    const prefill = `@bundle:${record.id}:${prefix}:${itemId}\n\nAsk more about "${label}":\n`;
    composerStore.setText(prefill);
    // Post a nudge so the extension can focus the composer on the user's
    // behalf. The extension ignores this message when it doesn't know
    // the type, so it's safe to send unconditionally.
    vscode?.postMessage({ type: 'focusComposer' });
  }

  function submit(): void {
    if (!vscode || !pending.submittable) return;
    bundleStagingStore.submit(record.id, surfaceId, vscode);
  }

  const mirrorTotal = $derived(mirror?.items.length ?? 0);
  const mirrorDecidedCount = $derived(mirrorTotal - pending.pendingMirror);
  const menuTotal = $derived(menu ? menu.options.length : 0);
  const menuDecidedCount = $derived(menu ? Math.min(counters.menu_selected, menuTotal) : 0);
</script>

<div class="bundle-card" data-record-id={record.id} data-surface-id={surfaceId}>
  <!-- Header -->
  <div class="bundle-header">
    <span class="bundle-kind">Decision</span>
    <h3 class="bundle-title">{content.title ?? 'Resolve this decision'}</h3>
  </div>
  {#if content.summary}
    <p class="bundle-summary">{content.summary}</p>
  {/if}

  <!-- Composite progress counter -->
  <div class="bundle-counter" class:ready={pending.submittable}>
    {#if mirror}
      <span class="counter-segment">
        {mirrorDecidedCount}/{mirrorTotal} assumptions decided
      </span>
    {/if}
    {#if mirror && menu}
      <span class="counter-sep">·</span>
    {/if}
    {#if menu}
      <span class="counter-segment">
        {menuDecidedCount}/{menuTotal} menu choices made
      </span>
    {/if}
  </div>

  <!-- Mirror section -->
  {#if mirror}
    <section class="bundle-section">
      <h4 class="section-label">Assumptions</h4>
      <ul class="item-list">
        {#each mirror.items as item (item.id)}
          {@const action = mirrorAction(item.id)}
          {@const isEditOpen = editOpen.has(item.id)}
          {@const editedText = mirrorEditedText(item.id, item.text)}
          <li class="mirror-item" class:decided={action !== null}>
            <div class="row-text">
              {#if action === 'edited'}
                <span class="edited-indicator" aria-hidden="true">✎</span>
              {/if}
              <span class="row-label">{action === 'edited' ? editedText : item.text}</span>
            </div>
            {#if item.rationale}
              <details class="row-rationale">
                <summary>Why</summary>
                <p>{item.rationale}</p>
              </details>
            {/if}
            {#if isEditOpen}
              <textarea
                class="row-edit-area"
                value={editedText}
                rows="3"
                oninput={(e) => stageMirror(item.id, 'edited', (e.currentTarget as HTMLTextAreaElement).value)}
              ></textarea>
            {/if}
            <div class="row-actions">
              <button
                class="row-btn accept"
                class:active={action === 'accepted'}
                onclick={() => stageMirror(item.id, 'accepted')}
              >Accept</button>
              <button
                class="row-btn reject"
                class:active={action === 'rejected'}
                onclick={() => stageMirror(item.id, 'rejected')}
              >Reject</button>
              <button
                class="row-btn edit"
                class:active={action === 'edited'}
                onclick={() => { toggleEdit(item.id); if (!isEditOpen && action !== 'edited') stageMirror(item.id, 'edited', item.text); }}
              >{isEditOpen ? 'Close edit' : 'Edit'}</button>
              <button
                class="row-btn defer"
                class:active={action === 'deferred'}
                onclick={() => stageMirror(item.id, 'deferred')}
              >Defer</button>
              <button
                class="row-btn ask"
                onclick={() => askMore('mirror', item.id, item.text)}
              >Ask more</button>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- Menu section -->
  {#if menu}
    <section class="bundle-section">
      <h4 class="section-label">{menu.question}</h4>
      {#if menu.context}
        <p class="section-context">{menu.context}</p>
      {/if}
      <ul class="item-list option-list">
        {#each menu.options as option (option.id)}
          {@const selected = isMenuSelected(option.id)}
          <li class="menu-option" class:selected>
            <div class="option-head">
              <label class="option-label">
                <input
                  type={menu.multi_select ? 'checkbox' : 'radio'}
                  name={`bundle-${record.id}-menu`}
                  checked={selected}
                  onchange={() => stageMenu(option.id)}
                />
                <span>{option.label}</span>
                {#if option.recommended}
                  <span class="recommended-badge">Recommended</span>
                {/if}
              </label>
              <button class="row-btn ask small" onclick={() => askMore('menu', option.id, option.label)}>
                Ask more
              </button>
            </div>
            {#if option.description}
              <p class="option-description">{option.description}</p>
            {/if}
            {#if option.tradeoffs}
              <details class="option-tradeoffs">
                <summary>Tradeoffs</summary>
                <p>{option.tradeoffs}</p>
              </details>
            {/if}
          </li>
        {/each}
        {#if menu.allow_free_text}
          {@const otherSelected = isMenuSelected('_OTHER')}
          {@const otherText = draft.menu.find(s => s.option_id === '_OTHER')?.free_text ?? ''}
          <li class="menu-option" class:selected={otherSelected}>
            <label class="option-label">
              <input
                type={menu.multi_select ? 'checkbox' : 'radio'}
                name={`bundle-${record.id}-menu`}
                checked={otherSelected}
                onchange={() => stageMenu('_OTHER', otherText)}
              />
              <span>Other</span>
            </label>
            {#if otherSelected}
              <textarea
                class="row-edit-area"
                value={otherText}
                rows="2"
                placeholder="Describe your preferred option…"
                oninput={(e) => stageMenu('_OTHER', (e.currentTarget as HTMLTextAreaElement).value)}
              ></textarea>
            {/if}
          </li>
        {/if}
      </ul>
    </section>
  {/if}

  <!-- Single Submit for the bundle -->
  <div class="bundle-actions">
    <button
      class="submit-btn"
      disabled={!pending.submittable}
      title={pending.submittable ? 'Submit all decisions' : 'Every section must be answered before submitting'}
      onclick={submit}
    >
      Submit decisions
    </button>
  </div>
</div>

<style>
  .bundle-card {
    background: var(--jc-surface-container);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-md);
    padding: var(--jc-space-xl);
    margin-bottom: var(--jc-space-lg);
  }

  .bundle-header {
    display: flex;
    align-items: baseline;
    gap: var(--jc-space-md);
    margin-bottom: var(--jc-space-sm);
  }
  .bundle-kind {
    font-family: var(--jc-font-mono);
    font-size: 0.65em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--jc-on-surface-variant);
    padding: var(--jc-space-xs) var(--jc-space-md);
    border-radius: var(--jc-radius-xs);
    background: var(--jc-surface-container-highest);
  }
  .bundle-title {
    margin: 0;
    font-family: var(--jc-font-headline);
    font-size: 1em;
    color: var(--jc-on-surface);
    font-weight: 600;
  }
  .bundle-summary {
    margin: 0 0 var(--jc-space-lg) 0;
    color: var(--jc-on-surface-variant);
    font-size: 0.9em;
  }

  .bundle-counter {
    display: flex;
    flex-wrap: wrap;
    gap: var(--jc-space-md);
    align-items: baseline;
    padding: var(--jc-space-md) var(--jc-space-lg);
    margin-bottom: var(--jc-space-lg);
    border-radius: var(--jc-radius-sm);
    background: var(--jc-surface-container-high);
    color: var(--jc-on-surface-variant);
    font-size: 0.85em;
    font-family: var(--jc-font-mono);
  }
  .bundle-counter.ready {
    background: var(--jc-tertiary-tint-soft);
    color: var(--jc-tertiary);
  }
  .counter-sep { opacity: 0.5; }

  .bundle-section {
    margin-bottom: var(--jc-space-xl);
  }
  .section-label {
    margin: 0 0 var(--jc-space-md) 0;
    font-family: var(--jc-font-mono);
    font-size: 0.7em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--jc-on-surface-variant);
  }
  .section-context {
    margin: 0 0 var(--jc-space-md) 0;
    font-size: 0.9em;
    color: var(--jc-on-surface-variant);
  }

  .item-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--jc-space-md);
  }

  .mirror-item, .menu-option {
    background: var(--jc-surface-container-low);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-sm);
    padding: var(--jc-space-md) var(--jc-space-lg);
  }
  .mirror-item.decided, .menu-option.selected {
    border-color: var(--jc-primary-tint-medium);
    background: var(--jc-primary-tint-soft);
  }
  .row-text {
    display: flex;
    align-items: baseline;
    gap: var(--jc-space-sm);
    color: var(--jc-on-surface);
    font-size: 0.95em;
  }
  .edited-indicator {
    color: var(--jc-warning);
    font-weight: 700;
  }
  .row-rationale {
    margin-top: var(--jc-space-sm);
    font-size: 0.85em;
    color: var(--jc-on-surface-variant);
  }
  .row-rationale summary { cursor: pointer; }
  .row-rationale p {
    margin: var(--jc-space-sm) 0 0;
    color: var(--jc-on-surface-variant);
  }

  .row-edit-area {
    width: 100%;
    margin-top: var(--jc-space-md);
    padding: var(--jc-space-md);
    font: inherit;
    font-family: var(--jc-font-body);
    font-size: 0.9em;
    background: var(--jc-surface-container-lowest);
    color: var(--jc-on-surface);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-xs);
    resize: vertical;
  }

  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--jc-space-sm);
    margin-top: var(--jc-space-md);
  }
  .row-btn {
    padding: var(--jc-space-xs) var(--jc-space-md);
    font-family: var(--jc-font-body);
    font-size: 0.75em;
    font-weight: 600;
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-xs);
    background: var(--jc-surface-container-highest);
    color: var(--jc-on-surface);
    cursor: pointer;
    transition: background var(--jc-transition-fast);
  }
  .row-btn:hover { background: var(--jc-surface-bright); }
  .row-btn.active {
    background: var(--jc-primary);
    color: var(--jc-on-primary);
    border-color: var(--jc-primary);
  }
  .row-btn.ask {
    color: var(--jc-secondary);
    border-color: var(--jc-outline-variant);
    background: transparent;
  }
  .row-btn.small { font-size: 0.7em; padding: 0 var(--jc-space-md); }

  .option-head {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    justify-content: space-between;
  }
  .option-label {
    display: inline-flex;
    align-items: center;
    gap: var(--jc-space-sm);
    cursor: pointer;
    user-select: none;
    font-size: 0.95em;
    color: var(--jc-on-surface);
  }
  .recommended-badge {
    font-size: 0.7em;
    padding: var(--jc-space-xs) var(--jc-space-sm);
    border-radius: var(--jc-radius-xs);
    background: var(--jc-tertiary-tint-soft);
    color: var(--jc-tertiary);
  }
  .option-description {
    margin: var(--jc-space-sm) 0 0;
    font-size: 0.85em;
    color: var(--jc-on-surface-variant);
  }
  .option-tradeoffs {
    margin-top: var(--jc-space-sm);
    font-size: 0.85em;
    color: var(--jc-on-surface-variant);
  }
  .option-tradeoffs summary { cursor: pointer; }
  .option-tradeoffs p { margin: var(--jc-space-sm) 0 0; }

  .bundle-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--jc-space-lg);
  }
  .submit-btn {
    padding: var(--jc-space-md) var(--jc-space-2xl);
    font-family: var(--jc-font-body);
    font-weight: 600;
    font-size: 0.9em;
    border: none;
    border-radius: var(--jc-radius-sm);
    background: var(--jc-primary);
    color: var(--jc-on-primary);
    cursor: pointer;
    transition: background var(--jc-transition-fast);
  }
  .submit-btn:disabled {
    background: var(--jc-surface-container-highest);
    color: var(--jc-on-surface-variant);
    cursor: not-allowed;
  }
  .submit-btn:not(:disabled):hover { background: var(--jc-primary-tint-emphasis); }
</style>
