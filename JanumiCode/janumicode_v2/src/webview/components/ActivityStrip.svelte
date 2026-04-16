<!--
  ActivityStrip — compact visual indicator for "what is the backend doing
  right now". Sits under the PhaseIndicator header. Shows:

    • an animated pulsing dot while an LLM call is running,
    • the call's traceContext label (e.g. "Phase 1.0 — Intent Quality Check"
      or "DMR Stage 1 — Query Decomposition"),
    • the current queue depth when non-empty.

  When idle, dims to a subtle "Idle" label so the strip space stays
  claimed (no layout thrash when work starts/stops). The last-completed
  label lingers for 3 seconds after finish so quick back-to-back calls
  don't flicker between "Running" and "Idle".
-->
<script lang="ts">
  import { activityStore } from '../stores/activity.svelte';
  import { phaseStore, PHASE_NAMES, SUB_PHASE_NAMES } from '../stores/phase.svelte';

  let now = $state(Date.now());
  // Re-render every 500ms while lastCompleted is fresh so the summary's
  // "Done — ..." label transitions back to "Idle" without another event.
  let rafHandle: ReturnType<typeof setInterval> | null = null;
  $effect(() => {
    if (activityStore.lastCompleted && activityStore.isIdle) {
      rafHandle = setInterval(() => { now = Date.now(); }, 500);
    } else if (rafHandle) {
      clearInterval(rafHandle);
      rafHandle = null;
    }
    return () => {
      if (rafHandle) clearInterval(rafHandle);
    };
  });

  // Referenced inside the template derivations below to ensure the effect
  // re-runs when either store changes. Svelte's reactivity picks up
  // accessed state during the render, so we read summary lazily.
  const summary = $derived.by(() => {
    void now; // touch the ticker so $derived recomputes on interval tick
    return activityStore.summary;
  });

  const running = $derived(activityStore.current !== null);
  const queued = $derived(activityStore.queueDepth > 0);
  const phaseLabel = $derived.by(() => {
    const p = phaseStore.state.currentPhaseId;
    if (!p) return null;
    const phaseName = PHASE_NAMES[p] ?? `Phase ${p}`;
    const sub = phaseStore.state.currentSubPhaseId;
    if (!sub) return phaseName;
    const subName = SUB_PHASE_NAMES[p]?.[sub] ?? sub;
    return `${phaseName} · ${subName}`;
  });
</script>

<div class="activity-strip" class:running class:queued aria-live="polite">
  <span class="dot" aria-hidden="true"></span>
  <span class="summary">{summary}</span>
  {#if phaseLabel && !running}
    <span class="phase-label">· {phaseLabel}</span>
  {/if}
  {#if queued}
    <span class="queue-badge">{activityStore.queueDepth} queued</span>
  {/if}
</div>

<style>
  .activity-strip {
    display: flex;
    align-items: center;
    gap: var(--jc-space-md);
    padding: var(--jc-space-sm) var(--jc-space-xl);
    font-family: var(--jc-font-mono);
    font-size: 0.7em;
    color: var(--jc-on-surface-variant);
    border-bottom: var(--jc-ghost-border);
    background: var(--jc-surface-container-lowest, var(--jc-surface));
    min-height: 22px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--jc-outline);
    flex-shrink: 0;
    transition: background var(--jc-transition-base);
  }

  .activity-strip.running .dot {
    background: var(--jc-primary);
    animation: jc-pulse-dot 1.2s ease-in-out infinite;
  }

  .activity-strip.queued:not(.running) .dot {
    background: var(--jc-tertiary);
  }

  .summary {
    color: var(--jc-on-surface);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .activity-strip:not(.running):not(.queued) .summary {
    color: var(--jc-outline);
    font-weight: 400;
  }

  .phase-label {
    color: var(--jc-outline);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .queue-badge {
    padding: var(--jc-space-hairline) var(--jc-space-md);
    border-radius: var(--jc-radius-pill);
    background: var(--jc-surface-container-highest, var(--jc-surface));
    color: var(--jc-tertiary);
    font-weight: 600;
    font-size: 0.9em;
    flex-shrink: 0;
  }

  @keyframes jc-pulse-dot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.6; }
  }
</style>
