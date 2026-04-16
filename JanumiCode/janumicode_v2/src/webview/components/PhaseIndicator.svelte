<!--
  PhaseIndicator - compact phase navigation with timeline and flyout.
  
  Shows current phase name prominently, a mini-timeline of dots for all phases,
  and a flyout on hover with full phase names and status icons.
  
  Based on janumicode_v2 phase indicator feature.md (Option D + E hybrid).
-->
<script lang="ts">
  import { phaseStore, PHASE_ORDER, PHASE_NAMES, SUB_PHASE_NAMES, SUB_PHASE_ORDER } from '../stores/phase.svelte';
  import type { PhaseId } from '../../lib/types/records';

  // Use inline type for props to avoid TypeScript resolution issues
  const { onNavigateToPhase }: {
    onNavigateToPhase?: (phaseId: PhaseId) => void;
  } = $props();

  let showFlyout = $state(false);
  let flyoutPosition = $state<'above' | 'below'>('above');
  let timelineRef = $state<HTMLElement | null>(null);
  let flyoutRef = $state<HTMLElement | null>(null);

  // Flyout visibility with delay for mouse movement
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  const SHOW_DELAY = 150;
  const HIDE_DELAY = 200;

  function handleTimelineEnter() {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      showFlyout = true;
      updateFlyoutPosition();
    }, SHOW_DELAY);
  }

  function handleTimelineLeave() {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      showFlyout = false;
    }, HIDE_DELAY);
  }

  function handleFlyoutEnter() {
    if (hoverTimeout) clearTimeout(hoverTimeout);
  }

  function handleFlyoutLeave() {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      showFlyout = false;
    }, HIDE_DELAY);
  }

  /**
   * Click-to-toggle — hover alone was reported as flaky in some VS Code
   * webview builds. Click gives users a reliable way to open the flyout
   * regardless of hover dispatch quirks (transient mouseenter loss when
   * hovering over individual dot buttons, etc.).
   */
  function handleTimelineClick() {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    showFlyout = !showFlyout;
    if (showFlyout) updateFlyoutPosition();
  }

  function updateFlyoutPosition() {
    if (!timelineRef) return;
    const rect = timelineRef.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    flyoutPosition = spaceAbove > spaceBelow ? 'above' : 'below';
  }

  function handleDotClick(phaseId: PhaseId) {
    if (phaseStore.isPhaseNavigable(phaseId) && onNavigateToPhase) {
      onNavigateToPhase(phaseId);
    }
  }

  function handleFlyoutItemClick(phaseId: PhaseId) {
    handleDotClick(phaseId);
    showFlyout = false;
  }

  // Get display label for phase dot
  function getDotLabel(phaseId: PhaseId): string {
    if (phaseId === '0.5') return '½';
    return phaseId;
  }

  // Check if phase 0.5 is conditional (not triggered)
  function isConditional(phaseId: PhaseId): boolean {
    return phaseId === '0.5' && !phaseStore.state.completedPhases.includes('0.5');
  }

  // Get sub-phase name for display
  function getSubPhaseName(phaseId: PhaseId, subPhaseId: string): string {
    return SUB_PHASE_NAMES[phaseId]?.[subPhaseId] ?? subPhaseId;
  }
</script>

<div
  class="phase-indicator"
  onmouseenter={handleTimelineEnter}
  onmouseleave={handleTimelineLeave}
  role="region"
  aria-label="Phase indicator"
>
  {#if phaseStore.hasActiveRun}
    <!-- Current Phase Display — clickable so users can toggle the flyout
         via the phase name, not just by hovering the tiny dot row. -->
    <button
      type="button"
      class="current-phase-area"
      onclick={handleTimelineClick}
      aria-expanded={showFlyout}
      aria-haspopup="menu"
    >
      <div class="current-phase-name">
        {PHASE_NAMES[phaseStore.state.currentPhaseId ?? '0']}
      </div>
      {#if phaseStore.state.currentSubPhaseId}
        <div class="current-subphase">
          {getSubPhaseName(phaseStore.state.currentPhaseId ?? '0', phaseStore.state.currentSubPhaseId)}
        </div>
      {/if}
    </button>

    <!-- Mini-Timeline -->
    <div
      class="phase-timeline"
      bind:this={timelineRef}
      role="navigation"
      aria-label="Phase timeline"
    >
      {#each PHASE_ORDER as phaseId (phaseId)}
        {@const status = phaseStore.getPhaseStatus(phaseId)}
        <button
          class="phase-dot {status}"
          class:conditional={isConditional(phaseId)}
          onclick={() => handleDotClick(phaseId)}
          disabled={!phaseStore.isPhaseNavigable(phaseId)}
          aria-label="{PHASE_NAMES[phaseId]} ({status})"
          title="{PHASE_NAMES[phaseId]}"
        >
          {#if status === 'completed'}&#10003;{:else}{getDotLabel(phaseId)}{/if}
        </button>
      {/each}
    </div>

    <!-- Flyout -->
    {#if showFlyout}
      <div
        class="phase-flyout {flyoutPosition}"
        bind:this={flyoutRef}
        onmouseenter={handleFlyoutEnter}
        onmouseleave={handleFlyoutLeave}
        role="menu"
        aria-label="Phase list"
        tabindex="-1"
      >
        <div class="phase-flyout-header">Phase List</div>
        {#each PHASE_ORDER as phaseId (phaseId)}
          <div class="phase-flyout-phase-group">
            <button
              class="phase-flyout-item {phaseStore.getPhaseStatus(phaseId)}"
              onclick={() => handleFlyoutItemClick(phaseId)}
              disabled={!phaseStore.isPhaseNavigable(phaseId)}
              role="menuitem"
            >
              <span class="phase-flyout-icon {phaseStore.getPhaseStatus(phaseId)}">
                {#if phaseStore.getPhaseStatus(phaseId) === 'completed'}&#10003;{/if}
                {#if phaseStore.getPhaseStatus(phaseId) === 'current'}&#9679;{/if}
                {#if phaseStore.getPhaseStatus(phaseId) === 'future'}&#9675;{/if}
              </span>
              <span class="phase-flyout-name">{PHASE_NAMES[phaseId]}</span>
              <span class="phase-flyout-number">{phaseId}</span>
            </button>
            <!-- Sub-phases for this phase -->
            {#if SUB_PHASE_ORDER[phaseId]}
              <div class="phase-flyout-subphases">
                {#each SUB_PHASE_ORDER[phaseId] as subPhaseId (subPhaseId)}
                  {@const subStatus = phaseStore.getSubPhaseStatus(subPhaseId)}
                  <div class="subphase-item {subStatus}">
                    <span class="subphase-icon {subStatus}">
                      {#if subStatus === 'completed'}&#10003;{/if}
                      {#if subStatus === 'current'}&#9679;{/if}
                      {#if subStatus === 'future'}&#9675;{/if}
                      {#if subStatus === 'skipped'}&#10142;{/if}
                    </span>
                    <span class="subphase-name">{getSubPhaseName(phaseId, subPhaseId)}</span>
                    {#if subStatus === 'skipped'}
                      <span class="subphase-skipped-label">(skipped)</span>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <!-- No Active Run State -->
    <div class="current-phase-area">
      <div class="current-phase-name no-run">
        No Active Workflow
      </div>
      <div class="current-subphase">
        Start a new workflow to see phase progress
      </div>
    </div>
    <!-- Empty Timeline -->
    <div class="phase-timeline empty" role="navigation" aria-label="Phase timeline">
      {#each PHASE_ORDER as phaseId (phaseId)}
        <div class="phase-dot empty" aria-label="{PHASE_NAMES[phaseId]}" title="{PHASE_NAMES[phaseId]}">
          {getDotLabel(phaseId)}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .phase-indicator {
    position: relative;
    flex-shrink: 0;
    background: var(--jc-surface-container-low);
    padding: var(--jc-space-lg) var(--jc-space-xl);
    z-index: 20;
  }

  /* Current Phase Display — rendered as a button for click-to-toggle
     flyout behavior. Button visual chrome is reset so it matches the
     original div rendering. */
  .current-phase-area {
    display: block;
    width: 100%;
    margin-bottom: var(--jc-space-md);
    padding: 0;
    background: transparent;
    border: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
    font: inherit;
  }
  .current-phase-area:hover .current-phase-name {
    color: var(--jc-primary);
  }

  .current-phase-name {
    font-family: var(--jc-font-headline);
    font-size: 1.05em;
    font-weight: 700;
    color: var(--jc-on-surface);
    margin-bottom: var(--jc-space-xs);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .current-subphase {
    font-family: var(--jc-font-mono);
    font-size: 0.75em;
    color: var(--jc-on-surface-variant);
  }

  /* Mini-Timeline */
  .phase-timeline {
    display: flex;
    align-items: center;
    gap: var(--jc-space-sm);
    padding: var(--jc-space-sm) 0;
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .phase-dot {
    min-width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1.5px solid var(--jc-outline);
    background: transparent;
    cursor: default;
    font-family: var(--jc-font-mono);
    font-size: 0.6em;
    color: var(--jc-outline);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all var(--jc-transition-fast);
  }

  .phase-dot:hover:not(:disabled) {
    transform: scale(1.15);
    border-color: var(--jc-primary);
  }

  /* Completed phase */
  .phase-dot.completed {
    border-color: var(--jc-tertiary);
    color: var(--jc-tertiary);
    background: var(--jc-tertiary-tint-soft);
    cursor: pointer;
  }

  /* Current phase — spec: solid primary dot with pulse ring */
  .phase-dot.current {
    background: var(--jc-primary);
    border-color: var(--jc-primary);
    color: var(--jc-on-primary);
    font-weight: bold;
    animation: jc-pulse-ring 2s ease-in-out infinite;
  }

  /* Future phase — spec: hollow ring */
  .phase-dot.future {
    background: transparent;
    opacity: 0.35;
  }

  /* Conditional phase (0.5 not triggered) */
  .phase-dot.conditional {
    opacity: 0.25;
    border-style: dashed;
  }

  /* Flyout */
  .phase-flyout {
    position: absolute;
    left: 14px;
    right: 14px;
    min-width: 220px;
    max-width: 280px;
    background: var(--jc-surface-container-high);
    backdrop-filter: blur(12px);
    border: var(--jc-ghost-border);
    border-radius: var(--jc-radius-md);
    box-shadow: var(--jc-shadow-float);
    padding: var(--jc-space-md) 0;
    z-index: 100;
  }

  .phase-flyout.above {
    bottom: 100%;
    margin-bottom: var(--jc-space-md);
  }

  .phase-flyout.below {
    top: 100%;
    margin-top: var(--jc-space-md);
  }

  .phase-flyout-header {
    padding: var(--jc-space-md) var(--jc-space-xl);
    font-family: var(--jc-font-body);
    font-size: 0.65em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--jc-outline);
    margin-bottom: var(--jc-space-xs);
  }

  .phase-flyout-item {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    padding: var(--jc-space-md) var(--jc-space-xl);
    width: 100%;
    border: none;
    background: transparent;
    color: var(--jc-on-surface);
    cursor: default;
    font-family: var(--jc-font-body);
    font-size: 0.8em;
    text-align: left;
    transition: background var(--jc-transition-fast);
  }

  .phase-flyout-item:hover:not(:disabled) {
    background: var(--jc-surface-bright);
    cursor: pointer;
  }

  .phase-flyout-item:disabled {
    opacity: 0.5;
  }

  .phase-flyout-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85em;
    flex-shrink: 0;
  }

  .phase-flyout-icon.completed { color: var(--jc-tertiary); }
  .phase-flyout-icon.current { color: var(--jc-primary); }
  .phase-flyout-icon.future { color: var(--jc-outline); opacity: 0.5; }

  .phase-flyout-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .phase-flyout-item.current .phase-flyout-name {
    font-weight: 600;
    color: var(--jc-primary);
  }

  .phase-flyout-number {
    font-family: var(--jc-font-mono);
    font-size: 0.8em;
    color: var(--jc-outline);
    flex-shrink: 0;
  }

  .phase-flyout-phase-group + .phase-flyout-phase-group {
    border-top: 1px solid var(--jc-outline-variant-tint-soft);
  }

  .phase-flyout-subphases {
    padding: 0 14px 6px 30px;
  }

  .subphase-item {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    padding: var(--jc-space-xs) 0;
    font-size: 0.75em;
    color: var(--jc-on-surface-variant);
  }

  .subphase-icon {
    width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8em;
    flex-shrink: 0;
  }

  .subphase-icon.completed { color: var(--jc-tertiary); }
  .subphase-icon.current { color: var(--jc-primary); }
  .subphase-icon.future { color: var(--jc-outline); opacity: 0.4; }
  .subphase-icon.skipped { color: var(--jc-outline); opacity: 0.3; }

  .subphase-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .subphase-item.current .subphase-name {
    color: var(--jc-primary);
    font-weight: 500;
  }

  .subphase-item.completed .subphase-name {
    color: var(--jc-on-surface-variant);
  }

  .subphase-item.future .subphase-name {
    opacity: 0.5;
  }

  .subphase-item.skipped .subphase-name {
    opacity: 0.4;
    text-decoration: line-through;
  }

  .subphase-skipped-label {
    font-size: 0.8em;
    color: var(--jc-outline);
    opacity: 0.5;
    margin-left: var(--jc-space-sm);
  }

  /* No Active Run State */
  .current-phase-name.no-run {
    color: var(--jc-outline);
    font-style: italic;
    font-weight: 400;
  }

  .phase-timeline.empty { opacity: 0.3; }
  .phase-dot.empty { cursor: default; opacity: 0.25; }
</style>
