/**
 * Activity store — tracks what the backend is currently doing so the
 * ActivityStrip can show a visible "processing" indicator.
 *
 * Populated by App.svelte's llmStatus handler. An LLM call's lifecycle
 * is `queued` → `started` → `finished`; we keep the most recent
 * started/queued label in `current` and fall back to `lastCompleted` for
 * a brief period after finish so the strip doesn't flicker between
 * rapid-fire calls.
 */

import type { LLMLane } from '../../lib/llm/priorityLLMCaller';

export interface ActivityInfo {
  provider: string;
  lane: LLMLane;
  label: string | null;
  agentRole: string | null;
  subPhaseId: string | null;
  /** Wall-clock time the call became the current activity. */
  since: number;
}

class ActivityStore {
  /** The call currently in-flight (running, not just queued). */
  current = $state<ActivityInfo | null>(null);
  /** Total calls waiting in any lane for any provider. */
  queueDepth = $state(0);
  /** Last-finished call label — shown briefly as fade-out context. */
  lastCompleted = $state<{ label: string | null; agentRole: string | null; at: number } | null>(null);

  // ── Actions ─────────────────────────────────────────────────────

  handleStarted(info: Omit<ActivityInfo, 'since'>): void {
    this.current = { ...info, since: Date.now() };
  }

  handleQueued(depth: number): void {
    this.queueDepth = depth;
  }

  handleFinished(info: { label: string | null; agentRole: string | null }): void {
    this.lastCompleted = { label: info.label, agentRole: info.agentRole, at: Date.now() };
    this.current = null;
    this.queueDepth = Math.max(0, this.queueDepth - 1);
  }

  reset(): void {
    this.current = null;
    this.queueDepth = 0;
    this.lastCompleted = null;
  }

  get isIdle(): boolean {
    return this.current === null && this.queueDepth === 0;
  }

  /** Short, human-readable summary for the strip. */
  get summary(): string {
    if (this.current) {
      return this.current.label ?? `${this.current.provider} (${this.current.lane})`;
    }
    if (this.queueDepth > 0) {
      return `${this.queueDepth} queued`;
    }
    if (this.lastCompleted && Date.now() - this.lastCompleted.at < 3000) {
      return `Done — ${this.lastCompleted.label ?? 'LLM call'}`;
    }
    return 'Idle';
  }
}

export const activityStore = new ActivityStore();
