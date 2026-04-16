/**
 * Phase Iteration - Helpers for iterating through phases 2-10 in tests.
 *
 * Provides:
 *   - Phase test runner
 *   - Phase fixture loading
 *   - Phase result collection
 *   - Iteration state management
 */

import type { Database } from '../../lib/database/init';
import type { PhaseId } from '../../lib/types/records';
import { PHASE_ORDER } from '../../lib/types/records';
import type { MockFixture } from '../helpers/mockLLMProvider';
import type { PipelineRunnerConfig } from './types';

export interface PhaseIterationConfig {
  /** Phases to iterate through */
  phases: PhaseId[];
  /** Fixtures to load for each phase */
  fixtures: Map<PhaseId, MockFixture[]>;
  /** Decision overrides for each phase */
  decisions: Map<PhaseId, DecisionOverride>;
  /** Stop conditions */
  stopOn: 'failure' | 'gap' | 'never';
  /** Maximum iterations per phase */
  maxIterationsPerPhase: number;
}

export interface DecisionOverride {
  phase: PhaseId;
  decision: 'approve' | 'reject' | 'revise';
  feedback?: string;
}

export interface PhaseIterationResult {
  phase: PhaseId;
  success: boolean;
  iterations: number;
  records: Array<{ record_type: string; produced_at: string }>;
  gapReport?: {
    missing_records: string[];
    violations: string[];
  };
  error?: string;
}

export interface IterationState {
  currentPhase: PhaseId;
  phaseIndex: number;
  iterationCount: number;
  totalIterations: number;
  results: PhaseIterationResult[];
  startTime: number;
}

/**
 * Phase iterator for systematic testing.
 */
export class PhaseIterator {
  private readonly config: PhaseIterationConfig;
  private state: IterationState;

  constructor(config: Partial<PhaseIterationConfig> = {}) {
    this.config = {
      phases: config.phases ?? PHASE_ORDER.filter(p => p !== '0.5'),
      fixtures: config.fixtures ?? new Map(),
      decisions: config.decisions ?? new Map(),
      stopOn: config.stopOn ?? 'failure',
      maxIterationsPerPhase: config.maxIterationsPerPhase ?? 3,
    };

    this.state = this.createInitialState();
  }

  /**
   * Get current iteration state.
   */
  getState(): IterationState {
    return { ...this.state };
  }

  /**
   * Reset to initial state.
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  /**
   * Check if there are more phases to iterate.
   */
  hasNext(): boolean {
    return this.state.phaseIndex < this.config.phases.length;
  }

  /**
   * Get the next phase to iterate.
   */
  next(): PhaseId | null {
    if (!this.hasNext()) {
      return null;
    }

    const phase = this.config.phases[this.state.phaseIndex]!;
    this.state.currentPhase = phase;
    this.state.iterationCount = 0;
    return phase;
  }

  /**
   * Record a phase result and advance.
   */
  recordResult(result: PhaseIterationResult): void {
    this.state.results.push(result);
    this.state.totalIterations += result.iterations;

    // Check stop conditions
    if (this.config.stopOn === 'failure' && !result.success) {
      // Don't advance - stop iteration
      return;
    }

    if (this.config.stopOn === 'gap' && result.gapReport && result.gapReport.missing_records.length > 0) {
      // Don't advance - stop iteration
      return;
    }

    // Advance to next phase
    this.state.phaseIndex++;
  }

  /**
   * Get fixtures for current phase.
   */
  getFixturesForPhase(phase: PhaseId): MockFixture[] {
    return this.config.fixtures.get(phase) ?? [];
  }

  /**
   * Get decision override for current phase.
   */
  getDecisionForPhase(phase: PhaseId): DecisionOverride | undefined {
    return this.config.decisions.get(phase);
  }

  /**
   * Check if phase should continue iterating.
   */
  shouldContinue(): boolean {
    return this.state.iterationCount < this.config.maxIterationsPerPhase;
  }

  /**
   * Increment iteration count.
   */
  incrementIteration(): void {
    this.state.iterationCount++;
  }

  /**
   * Get summary of all phase results.
   */
  getSummary(): {
    totalPhases: number;
    completedPhases: number;
    successfulPhases: number;
    failedPhases: number;
    totalIterations: number;
    durationMs: number;
  } {
    const completed = this.state.results.length;
    const successful = this.state.results.filter(r => r.success).length;
    const failed = completed - successful;

    return {
      totalPhases: this.config.phases.length,
      completedPhases: completed,
      successfulPhases: successful,
      failedPhases: failed,
      totalIterations: this.state.totalIterations,
      durationMs: Date.now() - this.state.startTime,
    };
  }

  private createInitialState(): IterationState {
    return {
      currentPhase: this.config.phases[0] ?? '0',
      phaseIndex: 0,
      iterationCount: 0,
      totalIterations: 0,
      results: [],
      startTime: Date.now(),
    };
  }
}

/**
 * Load fixtures for a range of phases.
 */
export function loadPhaseFixtures(
  baseDir: string,
  phases: PhaseId[],
): Map<PhaseId, MockFixture[]> {
  const fixtures = new Map<PhaseId, MockFixture[]>();

  for (const phase of phases) {
    const phaseFixtures: MockFixture[] = [];

    // Would load from disk in real implementation
    fixtures.set(phase, phaseFixtures);
  }

  return fixtures;
}

/**
 * Collect records for a phase from database.
 */
export function collectPhaseRecords(
  db: Database,
  workflowRunId: string,
  phase: PhaseId,
): Array<{ record_type: string; produced_at: string }> {
  const records = db.prepare(`
    SELECT record_type, produced_at
    FROM governed_stream
    WHERE workflow_run_id = ? AND phase_id = ?
    ORDER BY produced_at
  `).all(workflowRunId, phase) as Array<{ record_type: string; produced_at: string }>;

  return records;
}

/**
 * Check if a phase has completed successfully.
 */
export function isPhaseComplete(
  records: Array<{ record_type: string; produced_at: string }>,
  phase: PhaseId,
): boolean {
  // Phase-specific completion criteria
  const completionRecords: Record<PhaseId, string[]> = {
    '0': ['intent_received', 'intent_classified'],
    '0.5': ['intent_clarified'],
    '1': ['requirements_extracted', 'requirements_prioritized'],
    '2': ['architecture_proposed'],
    '3': ['implementation_plan_created'],
    '4': ['execution_completed', 'files_modified'],
    '5': ['claims_verified'],
    '6': ['historical_synthesis_produced'],
    '7': ['review_gate_presented', 'review_decision'],
    '8': ['commit_created'],
    '9': ['deployment_prepared'],
    '10': ['workflow_completed'],
  };

  const required = completionRecords[phase] ?? [];
  const recordTypes = new Set(records.map(r => r.record_type));

  return required.every(req => recordTypes.has(req));
}

/**
 * Create default phase iteration config for full workflow.
 */
export function createFullWorkflowConfig(): PhaseIterationConfig {
  return {
    phases: PHASE_ORDER.filter(p => p !== '0.5') as PhaseId[],
    fixtures: new Map(),
    decisions: new Map([
      ['7', { phase: '7', decision: 'approve' }],
    ]),
    stopOn: 'failure',
    maxIterationsPerPhase: 3,
  };
}

/**
 * Create phase iteration config for specific phases.
 */
export function createPhaseRangeConfig(
  startPhase: PhaseId,
  endPhase: PhaseId,
): PhaseIterationConfig {
  const startIndex = PHASE_ORDER.indexOf(startPhase);
  const endIndex = PHASE_ORDER.indexOf(endPhase);
  const phases = PHASE_ORDER.slice(startIndex, endIndex + 1);

  return {
    phases,
    fixtures: new Map(),
    decisions: new Map(),
    stopOn: 'failure',
    maxIterationsPerPhase: 3,
  };
}

/**
 * Run a phase iteration with the test harness.
 */
export async function runPhaseIteration(
  _config: PipelineRunnerConfig,
  _phase: PhaseId,
  _fixtures: MockFixture[],
): Promise<PhaseIterationResult> {
  // This would integrate with the actual test harness
  // For now, return a placeholder
  return {
    phase: _phase,
    success: true,
    iterations: 1,
    records: [],
  };
}
