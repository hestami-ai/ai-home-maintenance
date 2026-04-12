import { describe, it, expect } from 'vitest';
import { LoopDetectionMonitor } from '../../../lib/orchestrator/loopDetectionMonitor';

describe('LoopDetectionMonitor', () => {
  const monitor = new LoopDetectionMonitor();

  describe('basic classification', () => {
    it('returns CONVERGING for first attempt (retryCount < 2)', () => {
      const result = monitor.assess({
        retryCount: 1,
        flawHistory: [],
        toolCallHistory: [],
        availableTools: [],
      });
      expect(result.loopStatus).toBe('CONVERGING');
    });

    it('classifies CONVERGING when flaw count decreases', () => {
      const result = monitor.assess({
        retryCount: 2,
        flawHistory: [
          { attemptNumber: 1, flaws: [{ type: 'circular_logic', severity: 'high' }, { type: 'invalid_inference', severity: 'high' }] },
          { attemptNumber: 2, flaws: [{ type: 'circular_logic', severity: 'high' }] },
        ],
        toolCallHistory: [
          { attemptNumber: 1, toolCalls: [{ name: 'Read', params: 'a' }] },
          { attemptNumber: 2, toolCalls: [{ name: 'Read', params: 'b' }, { name: 'Write', params: 'c' }] },
        ],
        availableTools: ['Read', 'Write'],
      });
      expect(result.loopStatus).toBe('CONVERGING');
    });

    it('classifies DIVERGING when flaw count increases', () => {
      const result = monitor.assess({
        retryCount: 2,
        flawHistory: [
          { attemptNumber: 1, flaws: [{ type: 'circular_logic', severity: 'high' }] },
          { attemptNumber: 2, flaws: [{ type: 'circular_logic', severity: 'high' }, { type: 'scope_violation', severity: 'high' }] },
        ],
        toolCallHistory: [
          { attemptNumber: 1, toolCalls: [{ name: 'Read', params: 'a' }] },
          { attemptNumber: 2, toolCalls: [{ name: 'Read', params: 'b' }, { name: 'Write', params: 'c' }] },
        ],
        availableTools: ['Read', 'Write'],
      });
      expect(result.loopStatus).toBe('DIVERGING');
    });

    it('classifies STALLED when flaw count is same', () => {
      const result = monitor.assess({
        retryCount: 2,
        flawHistory: [
          { attemptNumber: 1, flaws: [{ type: 'unsupported_assumption', severity: 'high' }] },
          { attemptNumber: 2, flaws: [{ type: 'invalid_inference', severity: 'high' }] },
        ],
        toolCallHistory: [
          { attemptNumber: 1, toolCalls: [{ name: 'Read', params: 'a' }] },
          { attemptNumber: 2, toolCalls: [{ name: 'Read', params: 'a' }] },
        ],
        availableTools: ['Read', 'Write'],
      });
      expect(result.loopStatus).toBe('STALLED');
    });
  });

  describe('SCOPE_BLIND detection', () => {
    it('classifies SCOPE_BLIND when tools unused + relevant flaws', () => {
      const result = monitor.assess({
        retryCount: 2,
        flawHistory: [
          { attemptNumber: 1, flaws: [{ type: 'unsupported_assumption', severity: 'high' }] },
          { attemptNumber: 2, flaws: [{ type: 'unsupported_assumption', severity: 'high' }] },
        ],
        toolCallHistory: [
          { attemptNumber: 1, toolCalls: [] },
          { attemptNumber: 2, toolCalls: [{ name: 'Read', params: 'a' }] },
        ],
        availableTools: ['Read', 'Write', 'Search', 'WebSearch'],
      });
      expect(result.loopStatus).toBe('SCOPE_BLIND');
      expect(result.toolsNotCalled).toContain('Write');
      expect(result.toolsNotCalled).toContain('Search');
    });

    it('does not classify SCOPE_BLIND without relevant flaw types', () => {
      const result = monitor.assess({
        retryCount: 2,
        flawHistory: [
          { attemptNumber: 1, flaws: [{ type: 'circular_logic', severity: 'high' }] },
          { attemptNumber: 2, flaws: [{ type: 'circular_logic', severity: 'high' }] },
        ],
        toolCallHistory: [
          { attemptNumber: 1, toolCalls: [] },
          { attemptNumber: 2, toolCalls: [] },
        ],
        availableTools: ['Read', 'Write'],
      });
      // circular_logic is not unsupported_assumption or completeness_shortcut
      expect(result.loopStatus).not.toBe('SCOPE_BLIND');
    });
  });

  describe('flaw count uses high-severity only', () => {
    it('ignores low-severity flaws in trend calculation', () => {
      const result = monitor.assess({
        retryCount: 2,
        flawHistory: [
          { attemptNumber: 1, flaws: [{ type: 'unsupported_assumption', severity: 'high' }] },
          { attemptNumber: 2, flaws: [
            { type: 'unsupported_assumption', severity: 'high' },
            { type: 'unacknowledged_uncertainty', severity: 'low' },
            { type: 'unacknowledged_uncertainty', severity: 'low' },
          ] },
        ],
        toolCallHistory: [
          { attemptNumber: 1, toolCalls: [{ name: 'Read', params: 'a' }] },
          { attemptNumber: 2, toolCalls: [{ name: 'Read', params: 'b' }] },
        ],
        availableTools: [],
      });
      // 1 high → 1 high = STALLED (low-severity ignored)
      expect(result.highSeverityFlawCount).toBe(1);
      expect(result.previousHighSeverityFlawCount).toBe(1);
    });
  });

  describe('zero-tool-call handling', () => {
    it('classifies CONVERGING when both attempts have zero tool calls', () => {
      const result = monitor.assess({
        retryCount: 2,
        flawHistory: [
          { attemptNumber: 1, flaws: [{ type: 'scope_violation', severity: 'high' }] },
          { attemptNumber: 2, flaws: [{ type: 'scope_violation', severity: 'high' }] },
        ],
        toolCallHistory: [
          { attemptNumber: 1, toolCalls: [] },
          { attemptNumber: 2, toolCalls: [] },
        ],
        availableTools: [],
      });
      expect(result.loopStatus).toBe('CONVERGING');
    });
  });
});
