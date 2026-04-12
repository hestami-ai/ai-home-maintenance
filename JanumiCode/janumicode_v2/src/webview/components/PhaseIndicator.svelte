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

<div class="phase-indicator">
  {#if phaseStore.hasActiveRun}
    <!-- Current Phase Display -->
    <div class="current-phase-area">
      <div class="current-phase-name">
        {PHASE_NAMES[phaseStore.state.currentPhaseId ?? '0']}
      </div>
      {#if phaseStore.state.currentSubPhaseId}
        <div class="current-subphase">
          {getSubPhaseName(phaseStore.state.currentPhaseId ?? '0', phaseStore.state.currentSubPhaseId)}
        </div>
      {/if}
    </div>

    <!-- Mini-Timeline -->
    <div
      class="phase-timeline"
      bind:this={timelineRef}
      onmouseenter={handleTimelineEnter}
      onmouseleave={handleTimelineLeave}
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
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-panel-border, #333);
    padding: 8px 12px;
    z-index: 20;
  }

  /* Current Phase Display */
  .current-phase-area {
    margin-bottom: 6px;
  }

  .current-phase-name {
    font-size: 1.05em;
    font-weight: 600;
    color: var(--vscode-foreground);
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .current-subphase {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
    opacity: 0.8;
  }

  /* Mini-Timeline */
  .phase-timeline {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .phase-dot {
    min-width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid var(--vscode-descriptionForeground);
    background: transparent;
    cursor: default;
    font-size: 0.65em;
    font-family: inherit;
    color: var(--vscode-descriptionForeground);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .phase-dot:hover:not(:disabled) {
    transform: scale(1.15);
    border-color: var(--vscode-button-background);
  }

  /* Completed phase - checkmark icon */
  .phase-dot.completed {
    border-color: var(--vscode-terminal-ansiGreen, #4caf50);
    color: var(--vscode-terminal-ansiGreen, #4caf50);
    cursor: pointer;
  }

  /* Current phase - filled dot with pulse */
  .phase-dot.current {
    background: var(--vscode-button-background);
    border-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    font-weight: bold;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 4px var(--vscode-button-background); }
    50% { box-shadow: 0 0 10px var(--vscode-button-background); }
  }

  /* Future phase - empty outline */
  .phase-dot.future {
    background: transparent;
    opacity: 0.4;
  }

  /* Conditional phase (0.5 not triggered) - dashed dimmed */
  .phase-dot.conditional {
    opacity: 0.3;
    border-style: dashed;
  }

  /* Flyout */
  .phase-flyout {
    position: absolute;
    left: 12px;
    right: 12px;
    min-width: 220px;
    max-width: 260px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    padding: 4px 0;
    z-index: 100;
  }

  .phase-flyout.above {
    bottom: 100%;
    margin-bottom: 4px;
  }

  .phase-flyout.below {
    top: 100%;
    margin-top: 4px;
  }

  /* Flyout header */
  .phase-flyout-header {
    padding: 6px 12px;
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-foreground);
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 4px;
  }

  /* Flyout item */
  .phase-flyout-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--vscode-foreground);
    cursor: default;
    font-family: inherit;
    font-size: 0.9em;
    text-align: left;
  }

  .phase-flyout-item:hover:not(:disabled) {
    background: var(--vscode-list-hoverBackground);
    cursor: pointer;
  }

  .phase-flyout-item:disabled {
    opacity: 0.6;
  }

  /* Flyout item status icon */
  .phase-flyout-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9em;
    flex-shrink: 0;
  }

  .phase-flyout-icon.completed {
    color: var(--vscode-terminal-ansiGreen, #4caf50);
  }

  .phase-flyout-icon.current {
    color: var(--vscode-button-background);
  }

  .phase-flyout-icon.future {
    color: var(--vscode-descriptionForeground);
    opacity: 0.7;
  }

  /* Flyout item name */
  .phase-flyout-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .phase-flyout-item.current .phase-flyout-name {
    font-weight: 600;
    color: var(--vscode-button-background);
  }

  /* Flyout item phase number */
  .phase-flyout-number {
    font-size: 0.8em;
    color: var(--vscode-foreground);
    opacity: 0.8;
    flex-shrink: 0;
  }

  /* Phase group container for sub-phases */
  .phase-flyout-phase-group {
    border-bottom: 1px solid var(--vscode-panel-border, #333);
  }

  .phase-flyout-phase-group:last-child {
    border-bottom: none;
  }

  /* Sub-phases container */
  .phase-flyout-subphases {
    padding: 0 12px 6px 28px;
  }

  /* Sub-phase item */
  .subphase-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    font-size: 0.8em;
    color: var(--vscode-foreground);
    opacity: 0.85;
  }

  .subphase-icon {
    width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85em;
    flex-shrink: 0;
  }

  .subphase-icon.completed {
    color: var(--vscode-terminal-ansiGreen, #4caf50);
  }

  .subphase-icon.current {
    color: var(--vscode-button-background);
  }

  .subphase-icon.future {
    color: var(--vscode-descriptionForeground);
    opacity: 0.6;
  }

  .subphase-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .subphase-item.current .subphase-name {
    color: var(--vscode-button-background);
    font-weight: 500;
  }

  .subphase-item.completed .subphase-name {
    color: var(--vscode-foreground);
    opacity: 0.85;
  }

  .subphase-item.future .subphase-name {
    opacity: 0.6;
  }

  /* Skipped sub-phase */
  .subphase-icon.skipped {
    color: var(--vscode-descriptionForeground);
    opacity: 0.5;
  }

  .subphase-item.skipped .subphase-name {
    opacity: 0.5;
    text-decoration: line-through;
  }

  .subphase-skipped-label {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
    opacity: 0.6;
    margin-left: 4px;
  }

  /* No Active Run State */
  .current-phase-name.no-run {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
  }

  /* Empty Timeline (no active run) */
  .phase-timeline.empty {
    opacity: 0.4;
  }

  .phase-dot.empty {
    cursor: default;
    opacity: 0.3;
  }
</style>
