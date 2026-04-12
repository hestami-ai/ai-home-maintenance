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

      const selection = builder.buildTraceSelection(traces, false, 16000);

      expect(selection.selectedRecordIds).toContain('sc1'); // self-correction
      expect(selection.selectedRecordIds).toContain('tc1'); // tool call
      expect(selection.selectedRecordIds).not.toContain('tr1'); // tool result EXCLUDED
    });

    it('excludes tool results for both executor and planning agents', () => {
      const builder = new ContextBuilder(testOptions);
      const traces: TraceRecord[] = [
        { id: 'tc1', type: 'tool_call', sequencePosition: 0, content: 'Read', tokenCount: 5 },
        { id: 'tr1', type: 'tool_result', sequencePosition: 1, content: 'result', tokenCount: 100 },
      ];

      const executorSelection = builder.buildTraceSelection(traces, true, 16000);
      expect(executorSelection.selectedRecordIds).not.toContain('tr1');

      const planningSelection = builder.buildTraceSelection(traces, false, 16000);
      expect(planningSelection.selectedRecordIds).not.toContain('tr1');
    });

    it('includes first and last reasoning steps', () => {
      const builder = new ContextBuilder(testOptions);
      const traces: TraceRecord[] = [
        { id: 'r1', type: 'agent_reasoning_step', sequencePosition: 0, content: 'first', tokenCount: 10 },
        { id: 'r2', type: 'agent_reasoning_step', sequencePosition: 1, content: 'middle', tokenCount: 10 },
        { id: 'r3', type: 'agent_reasoning_step', sequencePosition: 2, content: 'last', tokenCount: 10 },
      ];

      const selection = builder.buildTraceSelection(traces, false, 16000);
      expect(selection.selectedRecordIds).toContain('r1'); // first
      expect(selection.selectedRecordIds).toContain('r3'); // last
    });

    it('includes reasoning steps preceding tool calls', () => {
      const builder = new ContextBuilder(testOptions);
      const traces: TraceRecord[] = [
        { id: 'r1', type: 'agent_reasoning_step', sequencePosition: 0, content: 'first', tokenCount: 10 },
        { id: 'r2', type: 'agent_reasoning_step', sequencePosition: 1, content: 'about to call tool', tokenCount: 10 },
        { id: 'tc1', type: 'tool_call', sequencePosition: 2, content: 'Read', tokenCount: 5 },
        { id: 'r3', type: 'agent_reasoning_step', sequencePosition: 3, content: 'last', tokenCount: 10 },
      ];

      const selection = builder.buildTraceSelection(traces, false, 16000);
      expect(selection.selectedRecordIds).toContain('r2'); // pre-tool-call
    });

    it('applies uniform stride sampling for executor agent when over budget', () => {
      const builder = new ContextBuilder(testOptions);
      const traces: TraceRecord[] = [];
      for (let i = 0; i < 100; i++) {
        traces.push({
          id: `r${i}`,
          type: 'agent_reasoning_step',
          sequencePosition: i,
          content: `step ${i}`,
          tokenCount: 200, // 100 steps * 200 tokens = 20000 tokens
        });
      }

      const selection = builder.buildTraceSelection(traces, true, 5000);
      expect(selection.samplingApplied).toBe(true);
      expect(selection.strideN).not.toBeNull();
      expect(selection.selectedRecordIds.length).toBeLessThan(100);
      // First and last always included
      expect(selection.selectedRecordIds).toContain('r0');
      expect(selection.selectedRecordIds).toContain('r99');
    });
  });
});
