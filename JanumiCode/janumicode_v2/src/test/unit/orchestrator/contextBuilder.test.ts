import { describe, it, expect } from 'vitest';
import { ContextBuilder, type TraceRecord } from '../../../lib/orchestrator/contextBuilder';

const testOptions = {
  stdinMaxTokens: 8000,
  detailFileMaxBytes: 10_485_760,
  detailFilePathTemplate: '/tmp/test/{sub_phase_id}_{invocation_id}.md',
  workspacePath: '/tmp/test',
};

describe('ContextBuilder', () => {
  describe('buildStdinDirective', () => {
    it('assembles sections in correct order', () => {
      const builder = new ContextBuilder(testOptions);
      const result = builder.buildStdinDirective({
        governingConstraints: 'Constraint A\nConstraint B',
        requiredOutputSpec: 'Produce JSON with field X',
        summaryContext: 'Prior phase decided Y',
        detailFileReference: 'DETAIL FILE:\nAvailable at /path/to/file.md',
      });

      const text = result.text;
      const constraintIdx = text.indexOf('GOVERNING CONSTRAINTS');
      const outputIdx = text.indexOf('REQUIRED OUTPUT');
      const contextIdx = text.indexOf('CONTEXT SUMMARY');
      const detailIdx = text.indexOf('DETAIL FILE');

      // Verify ordering: constraints → output → context → detail
      expect(constraintIdx).toBeLessThan(outputIdx);
      expect(outputIdx).toBeLessThan(contextIdx);
      expect(contextIdx).toBeLessThan(detailIdx);
    });

    it('includes invariant violations when present', () => {
      const builder = new ContextBuilder(testOptions);
      const result = builder.buildStdinDirective({
        governingConstraints: '',
        requiredOutputSpec: '',
        summaryContext: '',
        detailFileReference: '',
        invariantViolations: 'CM-001: Component Responsibility contains conjunction',
      });

      expect(result.text).toContain('[JC:INVARIANT VIOLATION]');
      expect(result.text).toContain('CM-001');
    });

    it('includes reasoning review findings when present', () => {
      const builder = new ContextBuilder(testOptions);
      const result = builder.buildStdinDirective({
        governingConstraints: '',
        requiredOutputSpec: '',
        summaryContext: '',
        detailFileReference: '',
        reasoningReviewFindings: 'unsupported_assumption: Agent assumed X',
      });

      expect(result.text).toContain('[JC:REASONING REVIEW FINDINGS]');
    });

    it('detects governing constraint overflow', () => {
      const builder = new ContextBuilder({
        ...testOptions,
        stdinMaxTokens: 100, // Very small budget
      });

      // Create a very long governing constraint
      const longConstraint = 'X'.repeat(1000);
      const result = builder.buildStdinDirective({
        governingConstraints: longConstraint,
        requiredOutputSpec: '',
        summaryContext: '',
        detailFileReference: '',
      });

      expect(result.governingConstraintsTruncated).toBe(true);
    });

    it('truncates summary context when over budget', () => {
      const builder = new ContextBuilder({
        ...testOptions,
        stdinMaxTokens: 200,
      });

      const result = builder.buildStdinDirective({
        governingConstraints: 'Short constraint',
        requiredOutputSpec: 'Short spec',
        summaryContext: 'X'.repeat(2000), // Very long
        detailFileReference: '',
      });

      expect(result.summaryContextTruncated).toBe(true);
      expect(result.text).toContain('truncated due to token limit');
    });
  });

  describe('approximateTokens', () => {
    it('returns 0 for empty text', () => {
      const builder = new ContextBuilder(testOptions);
      expect(builder.approximateTokens('')).toBe(0);
    });

    it('approximates 4 chars per token with 10% margin', () => {
      const builder = new ContextBuilder(testOptions);
      // 400 chars / 4 * 1.1 ≈ 110, ceil'd
      const tokens = builder.approximateTokens('A'.repeat(400));
      expect(tokens).toBeGreaterThanOrEqual(110);
      expect(tokens).toBeLessThanOrEqual(111);
    });
  });

  describe('buildTraceSelection', () => {
    it('always includes self-corrections and tool calls', () => {
      const builder = new ContextBuilder(testOptions);
      const traces: TraceRecord[] = [
        { id: 'r1', type: 'agent_reasoning_step', sequencePosition: 0, content: 'thinking...', tokenCount: 10 },
        { id: 'sc1', type: 'agent_self_correction', sequencePosition: 1, content: 'fixing...', tokenCount: 10 },
        { id: 'tc1', type: 'tool_call', sequencePosition: 2, content: 'Read file', tokenCount: 5 },
        { id: 'tr1', type: 'tool_result', sequencePosition: 3, content: 'file content...', tokenCount: 100 },
        { id: 'r2', type: 'agent_reasoning_step', sequencePosition: 4, content: 'more thinking...', tokenCount: 10 },
      ];

      const selection = builder.buildTraceSelection(traces, false);

      expect(selection.selectedRecordIds).toContain('sc1'); // self-correction
      expect(selection.selectedRecordIds).toContain('tc1'); // tool call
      expect(selection.selectedRecordIds).toContain('r1'); // reasoning step
      expect(selection.selectedRecordIds).toContain('r2'); // reasoning step
      expect(selection.selectedRecordIds).not.toContain('tr1'); // tool result EXCLUDED
    });

    it('excludes tool results for both executor and planning agents', () => {
      const builder = new ContextBuilder(testOptions);
      const traces: TraceRecord[] = [
        { id: 'tc1', type: 'tool_call', sequencePosition: 0, content: 'Read', tokenCount: 5 },
        { id: 'tr1', type: 'tool_result', sequencePosition: 1, content: 'result', tokenCount: 100 },
      ];

      const executorSelection = builder.buildTraceSelection(traces, true);
      expect(executorSelection.selectedRecordIds).not.toContain('tr1');

      const planningSelection = builder.buildTraceSelection(traces, false);
      expect(planningSelection.selectedRecordIds).not.toContain('tr1');
    });

    it('includes all reasoning steps regardless of count', () => {
      // Earlier behavior selected first/last/pre-tool-call only and stride-sampled
      // the rest under an 8000-token budget. That budget caused false-positive
      // `completeness_shortcut` flags from reasoning_review on long executor
      // traces; the calibration loop has no monetary cost and the architectural
      // escape hatch for large content is the stdin + detail-file two-channel
      // pattern, not ad-hoc token accounting at every call site.
      const builder = new ContextBuilder(testOptions);
      const traces: TraceRecord[] = [];
      for (let i = 0; i < 100; i++) {
        traces.push({
          id: `r${i}`,
          type: 'agent_reasoning_step',
          sequencePosition: i,
          content: `step ${i}`,
          tokenCount: 200,
        });
      }

      const selection = builder.buildTraceSelection(traces, true);
      expect(selection.selectedRecordIds.length).toBe(100);
      expect(selection.selectedRecordIds).toContain('r0');
      expect(selection.selectedRecordIds).toContain('r99');
    });
  });
});
