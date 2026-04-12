import { describe, it, expect, beforeEach } from 'vitest';
import { OutputParser, createClaudeCodeParser } from '../../../lib/cli/outputParser';

describe('OutputParser', () => {
  describe('Claude Code stream-json parser', () => {
    let parser: OutputParser;

    beforeEach(() => {
      parser = createClaudeCodeParser();
    });

    it('maps assistant events to agent_reasoning_step', () => {
      const event = parser.parseLine('{"type":"assistant","content":"I will read the file"}');
      expect(event).not.toBeNull();
      expect(event!.recordType).toBe('agent_reasoning_step');
    });

    it('maps tool_use events to tool_call', () => {
      const event = parser.parseLine('{"type":"tool_use","name":"Read","input":{"path":"src/main.ts"}}');
      expect(event).not.toBeNull();
      expect(event!.recordType).toBe('tool_call');
    });

    it('maps tool_result events to tool_result', () => {
      const event = parser.parseLine('{"type":"tool_result","content":"file contents..."}');
      expect(event).not.toBeNull();
      expect(event!.recordType).toBe('tool_result');
    });

    it('maps result events to artifact_produced', () => {
      const event = parser.parseLine('{"type":"result","content":"final output"}');
      expect(event).not.toBeNull();
      expect(event!.recordType).toBe('artifact_produced');
    });

    it('increments sequence position', () => {
      const e1 = parser.parseLine('{"type":"assistant","content":"step 1"}');
      const e2 = parser.parseLine('{"type":"assistant","content":"step 2"}');
      expect(e1!.sequencePosition).toBe(0);
      expect(e2!.sequencePosition).toBe(1);
    });

    it('returns null for empty lines', () => {
      expect(parser.parseLine('')).toBeNull();
      expect(parser.parseLine('   ')).toBeNull();
    });

    it('returns null for unknown event types', () => {
      expect(parser.parseLine('{"type":"unknown_event"}')).toBeNull();
    });

    it('treats invalid JSON as reasoning step', () => {
      const event = parser.parseLine('This is not JSON');
      expect(event).not.toBeNull();
      expect(event!.recordType).toBe('agent_reasoning_step');
    });
  });

  describe('self-correction detection', () => {
    let parser: OutputParser;

    beforeEach(() => {
      parser = createClaudeCodeParser();
    });

    it('detects consecutive writes to same file as self-correction', () => {
      parser.parseLine('{"type":"tool_use","name":"Write","input":{"path":"src/main.ts","content":"v1"}}');
      const e2 = parser.parseLine('{"type":"tool_use","name":"Write","input":{"path":"src/main.ts","content":"v2"}}');
      expect(e2!.isSelfCorrection).toBe(true);
      expect(e2!.recordType).toBe('agent_self_correction');
    });

    it('does not flag different files as self-correction', () => {
      parser.parseLine('{"type":"tool_use","name":"Write","input":{"path":"src/a.ts","content":"v1"}}');
      const e2 = parser.parseLine('{"type":"tool_use","name":"Write","input":{"path":"src/b.ts","content":"v1"}}');
      expect(e2!.isSelfCorrection).toBe(false);
    });

    it('detects explicit correction language', () => {
      const event = parser.parseLine('{"type":"assistant","content":"I need to fix the previous implementation"}');
      expect(event!.isSelfCorrection).toBe(true);
      expect(event!.recordType).toBe('agent_self_correction');
    });

    it('does not flag normal reasoning as self-correction', () => {
      const event = parser.parseLine('{"type":"assistant","content":"I will implement the authentication handler"}');
      expect(event!.isSelfCorrection).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets sequence counter and state', () => {
      const parser = createClaudeCodeParser();
      parser.parseLine('{"type":"assistant","content":"step 1"}');
      parser.parseLine('{"type":"assistant","content":"step 2"}');

      parser.reset();

      const event = parser.parseLine('{"type":"assistant","content":"step 1 after reset"}');
      expect(event!.sequencePosition).toBe(0);
    });
  });
});
