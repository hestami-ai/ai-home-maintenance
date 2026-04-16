// @vitest-environment happy-dom
/**
 * activityStore — tracks in-flight LLM calls so the ActivityStrip can show
 * a visible "what is being processed" indicator. Pins the summary-state
 * transitions the strip relies on: Idle → Running → Done → (fade back to) Idle.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { activityStore } from '../../../webview/stores/activity.svelte';

describe('activityStore — summary transitions', () => {
  beforeEach(() => {
    activityStore.reset();
  });

  it('reports "Idle" when no work has happened', () => {
    expect(activityStore.isIdle).toBe(true);
    expect(activityStore.summary).toBe('Idle');
  });

  it('reports the current call label while running', () => {
    activityStore.handleStarted({
      provider: 'ollama',
      lane: 'phase',
      label: 'DMR Stage 1 — Query Decomposition',
      agentRole: 'deep_memory_research',
      subPhaseId: 'liaison:historical_lookup',
    });
    expect(activityStore.isIdle).toBe(false);
    expect(activityStore.summary).toBe('DMR Stage 1 — Query Decomposition');
  });

  it('falls back to "<provider> (<lane>)" when label is null', () => {
    activityStore.handleStarted({
      provider: 'ollama',
      lane: 'user_query',
      label: null,
      agentRole: null,
      subPhaseId: null,
    });
    expect(activityStore.summary).toBe('ollama (user_query)');
  });

  it('reports queue depth when idle but work is pending', () => {
    activityStore.handleQueued(3);
    expect(activityStore.summary).toBe('3 queued');
  });

  it('shows "Done — <label>" briefly after finish, then decays', () => {
    activityStore.handleStarted({
      provider: 'ollama',
      lane: 'phase',
      label: 'Phase 1.2 — Bloom',
      agentRole: null,
      subPhaseId: '1.2',
    });
    activityStore.handleFinished({ label: 'Phase 1.2 — Bloom', agentRole: null });

    expect(activityStore.isIdle).toBe(true);
    expect(activityStore.summary).toBe('Done — Phase 1.2 — Bloom');

    // Simulate 4 seconds elapsed by pushing lastCompleted.at into the past.
    if (activityStore.lastCompleted) {
      activityStore.lastCompleted.at = Date.now() - 4000;
    }
    expect(activityStore.summary).toBe('Idle');
  });

  it('handleFinished decrements the queue depth', () => {
    activityStore.handleQueued(2);
    activityStore.handleStarted({
      provider: 'ollama', lane: 'phase', label: 'A', agentRole: null, subPhaseId: null,
    });
    activityStore.handleFinished({ label: 'A', agentRole: null });
    expect(activityStore.queueDepth).toBe(1);
  });

  it('handleFinished floors the queue depth at 0 (defensive against drift)', () => {
    activityStore.handleStarted({
      provider: 'ollama', lane: 'phase', label: 'solo', agentRole: null, subPhaseId: null,
    });
    activityStore.handleFinished({ label: 'solo', agentRole: null });
    expect(activityStore.queueDepth).toBe(0);
  });

  it('reset() clears every tracked field', () => {
    activityStore.handleStarted({
      provider: 'x', lane: 'phase', label: 'Y', agentRole: 'z', subPhaseId: '1',
    });
    activityStore.handleQueued(5);
    activityStore.handleFinished({ label: 'Y', agentRole: 'z' });

    activityStore.reset();

    expect(activityStore.current).toBeNull();
    expect(activityStore.queueDepth).toBe(0);
    expect(activityStore.lastCompleted).toBeNull();
    expect(activityStore.summary).toBe('Idle');
  });
});
