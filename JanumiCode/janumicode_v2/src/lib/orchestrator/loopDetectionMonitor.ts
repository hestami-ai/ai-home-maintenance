/**
 * LoopDetectionMonitor — deterministic retry counting and flaw trend analysis.
 * Based on JanumiCode Spec v2.3, §7.9, §7.10.
 *
 * Classifies Loop Status: CONVERGING, STALLED, DIVERGING, SCOPE_BLIND.
 * Enhanced with tool call sequence analysis.
 * No LLM call required — purely deterministic.
 */

import type { LoopStatus, ReasoningReviewSeverity } from '../types/records';

// ── Types ───────────────────────────────────────────────────────────

export interface FlawRecord {
  attemptNumber: number;
  /**
   * Per-attempt review concerns. `type` is a freeform short-form summary
   * (e.g. the reviewer concern's `summary` field); the v1-style closed
   * `ReasoningFlawType` taxonomy was retired with the reasoning-review
   * unification — concerns now have severity HIGH/MEDIUM/LOW and a
   * caller-defined summary string.
   */
  flaws: { type: string; severity: ReasoningReviewSeverity }[];
}

export interface ToolCallRecord {
  attemptNumber: number;
  toolCalls: { name: string; params: string }[];
}

export interface LoopDetectionInput {
  retryCount: number;
  flawHistory: FlawRecord[];
  toolCallHistory: ToolCallRecord[];
  availableTools: string[];
}

export interface LoopDetectionResult {
  loopStatus: LoopStatus;
  highSeverityFlawCount: number;
  previousHighSeverityFlawCount: number | null;
  toolsNotCalled: string[];
  toolCallLoopDetected: boolean;
}

// ── LoopDetectionMonitor ────────────────────────────────────────────

export class LoopDetectionMonitor {
  /**
   * Assess Loop Status based on retry history.
   * Only invoked from the second attempt onward (after first Reasoning Review).
   */
  assess(input: LoopDetectionInput): LoopDetectionResult {
    const { retryCount, flawHistory, toolCallHistory, availableTools } = input;

    // Not invoked on first attempt
    if (retryCount < 2) {
      return {
        loopStatus: 'CONVERGING',
        highSeverityFlawCount: 0,
        previousHighSeverityFlawCount: null,
        toolsNotCalled: [],
        toolCallLoopDetected: false,
      };
    }

    // Count high-severity flaws for current and previous attempt
    const currentFlaws = flawHistory.find(f => f.attemptNumber === retryCount);
    const previousFlaws = flawHistory.find(f => f.attemptNumber === retryCount - 1);

    const currentHighCount = currentFlaws
      ? currentFlaws.flaws.filter(f => f.severity === 'HIGH').length
      : 0;

    const previousHighCount = previousFlaws
      ? previousFlaws.flaws.filter(f => f.severity === 'HIGH').length
      : 0;

    // Tool call sequence analysis
    const toolCallLoopDetected = this.detectToolCallLoop(toolCallHistory, retryCount);
    const toolsNotCalled = this.detectUnusedTools(toolCallHistory, availableTools, retryCount);

    // Determine Loop Status
    let loopStatus: LoopStatus;

    // SCOPE_BLIND: has available tools it's not using + specific flaw types
    if (toolsNotCalled.length > 0 && currentFlaws) {
      const hasRelevantFlaws = currentFlaws.flaws.some(
        f => f.type === 'unsupported_assumption' || f.type === 'completeness_shortcut',
      );
      if (hasRelevantFlaws) {
        loopStatus = 'SCOPE_BLIND';
        return {
          loopStatus,
          highSeverityFlawCount: currentHighCount,
          previousHighSeverityFlawCount: previousHighCount,
          toolsNotCalled,
          toolCallLoopDetected,
        };
      }
    }

    // DIVERGING: flaw count strictly increasing
    if (currentHighCount > previousHighCount) {
      loopStatus = 'DIVERGING';
    }
    // STALLED: identical tool call sequence or same flaw count
    else if (toolCallLoopDetected || currentHighCount === previousHighCount) {
      loopStatus = 'STALLED';
    }
    // CONVERGING: flaw count decreasing
    else {
      loopStatus = 'CONVERGING';
    }

    // Zero-tool-call handling: both attempts have zero tool calls + both fail
    if (retryCount >= 2) {
      const currentToolCalls = toolCallHistory.find(t => t.attemptNumber === retryCount);
      const previousToolCalls = toolCallHistory.find(t => t.attemptNumber === retryCount - 1);

      if (currentToolCalls?.toolCalls.length === 0 &&
          previousToolCalls?.toolCalls.length === 0 &&
          currentHighCount > 0 && previousHighCount > 0) {
        loopStatus = 'CONVERGING'; // Identical approach (zero tools both times)
      }
    }

    return {
      loopStatus,
      highSeverityFlawCount: currentHighCount,
      previousHighSeverityFlawCount: previousHighCount,
      toolsNotCalled,
      toolCallLoopDetected,
    };
  }

  /**
   * Detect identical tool call sequences within one invocation.
   * Pattern: identical tool invocations (same tool + parameters) within one attempt.
   */
  private detectToolCallLoop(
    toolCallHistory: ToolCallRecord[],
    currentAttempt: number,
  ): boolean {
    const current = toolCallHistory.find(t => t.attemptNumber === currentAttempt);
    if (!current || current.toolCalls.length < 2) return false;

    // Check for alternating between the same two tools (A,B,A,B,...) for >= 3
    // full cycles. True period-2 alternation means every call equals the one
    // two positions back — for BOTH parities in the window. The prior check
    // `calls[i - 1].name === calls[i - 1].name` compared a value to itself
    // (always true), so the odd (interleaved) calls were never verified and a
    // non-loop like A,X,A,Y,A,Z,A would false-trip the detector.
    const calls = current.toolCalls;
    const sameCall = (a: number, b: number): boolean =>
      calls[a].name === calls[b].name && calls[a].params === calls[b].params;
    for (let i = 3; i < calls.length; i++) {
      let run = 0;
      for (let j = i; j >= 2; j--) {
        if (sameCall(j, j - 2)) run++;
        else break;
      }
      // run = consecutive positions (both parities) matching their -2 neighbour;
      // A,B,A,B,A,B (6 calls) → positions 2..5 → run 4 = 3 alternation cycles.
      if (run >= 4) return true;
    }

    // Check for identical consecutive tool invocations
    for (let i = 1; i < calls.length; i++) {
      if (sameCall(i, i - 1)) return true;
    }

    return false;
  }

  /**
   * Detect available tools that were not called during the current attempt.
   * SCOPE_BLIND detection algorithm per §7.9.
   */
  private detectUnusedTools(
    toolCallHistory: ToolCallRecord[],
    availableTools: string[],
    currentAttempt: number,
  ): string[] {
    const current = toolCallHistory.find(t => t.attemptNumber === currentAttempt);
    if (!current) return [];

    const toolsCalled = new Set(current.toolCalls.map(tc => tc.name));
    return availableTools.filter(tool => !toolsCalled.has(tool));
  }
}
