/**
 * Reactive store for Phase Indicator state (Svelte 5 runes).
 * Tracks current phase, sub-phase, and completed phases for the timeline.
 */

import type { PhaseId } from '../../lib/types/records';

// Re-export for convenience
export type { PhaseId } from '../../lib/types/records';
export { PHASE_ORDER, PHASE_NAMES, SUB_PHASE_NAMES, SUB_PHASE_ORDER } from '../../lib/types/records';

export interface PhaseIndicatorState {
  workflowRunId: string | null;
  status: 'no_run' | 'active' | 'paused' | 'completed' | 'failed';
  currentPhaseId: PhaseId | null;
  currentSubPhaseId: string | null;
  completedPhases: PhaseId[];
  completedSubPhases: string[];
  skippedSubPhases: string[];
}

class PhaseStore {
  state = $state<PhaseIndicatorState>({
    workflowRunId: null,
    status: 'no_run',
    currentPhaseId: null,
    currentSubPhaseId: null,
    completedPhases: [],
    completedSubPhases: [],
    skippedSubPhases: [],
  });

  // Derived getters
  get hasActiveRun(): boolean {
    return this.state.status !== 'no_run' && this.state.workflowRunId !== null;
  }

  // Actions
  update(payload: Partial<PhaseIndicatorState>): void {
    this.state = { ...this.state, ...payload };
  }

  reset(): void {
    this.state = {
      workflowRunId: null,
      status: 'no_run',
      currentPhaseId: null,
      currentSubPhaseId: null,
      completedPhases: [],
      completedSubPhases: [],
      skippedSubPhases: [],
    };
  }

  // Helpers for timeline rendering
  getPhaseStatus(phaseId: PhaseId): 'completed' | 'current' | 'future' {
    if (this.state.completedPhases.includes(phaseId)) return 'completed';
    if (this.state.currentPhaseId === phaseId) return 'current';
    return 'future';
  }

  getSubPhaseStatus(subPhaseId: string): 'completed' | 'current' | 'future' | 'skipped' {
    if (this.state.skippedSubPhases.includes(subPhaseId)) return 'skipped';
    if (this.state.completedSubPhases.includes(subPhaseId)) return 'completed';
    if (this.state.currentSubPhaseId === subPhaseId) return 'current';
    return 'future';
  }

  isPhaseNavigable(phaseId: PhaseId): boolean {
    return this.state.completedPhases.includes(phaseId);
  }

  isSubPhaseNavigable(subPhaseId: string): boolean {
    return this.state.completedSubPhases.includes(subPhaseId);
  }
}

export const phaseStore = new PhaseStore();
