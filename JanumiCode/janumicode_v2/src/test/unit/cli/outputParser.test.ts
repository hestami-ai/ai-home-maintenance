import { describe, it, expect, beforeEach } from 'vitest';
import { OutputParser, createClaudeCodeParser } from '../../../lib/cli/outputParser';

describe('OutputParser', () => {
  describe('Claude Code stream-json parser', () => {
    let parser: OutputParser;

    beforeEach(() => {
      parser = createClaudeCodeParser();
    });

    it('maps flat assistant events to agent_reasoning_step', () => {
      // Flat shape — used by fixtures and pre-unwrapped streams.
      const events = parser.parseLine('{"type":"assistant","content":"I will read the file"}');
      expect(events).toHaveLength(1);
      expect(events[0].recordType).toBe('agent_reasoning_step');
    });

    it('maps flat tool_use events to tool_call', () => {
      const events = parser.parseLine('{"type":"tool_use","name":"Read","input":{"path":"src/main.ts"}}');
      expect(events).toHaveLength(1);
      expect(events[0].recordType).toBe('tool_call');
    });

    it('maps flat tool_result events to tool_result', () => {
      const events = parser.parseLine('{"type":"tool_result","content":"file contents..."}');
      expect(events).toHaveLength(1);
      expect(events[0].recordType).toBe('tool_result');
    });

    it('maps result envelope to artifact_produced', () => {
      const events = parser.parseLine('{"type":"result","result":"final output","session_id":"abc"}');
      expect(events).toHaveLength(1);
      expect(events[0].recordType).toBe('artifact_produced');
    });

    it('increments sequence position across calls', () => {
      const e1 = parser.parseLine('{"type":"assistant","content":"step 1"}');
      const e2 = parser.parseLine('{"type":"assistant","content":"step 2"}');
      expect(e1[0].sequencePosition).toBe(0);
      expect(e2[0].sequencePosition).toBe(1);
    });

    it('returns empty array for empty lines', () => {
      expect(parser.parseLine('')).toEqual([]);
      expect(parser.parseLine('   ')).toEqual([]);
    });

    it('returns empty array for unknown outer type', () => {
      expect(parser.parseLine('{"type":"unknown_event"}')).toEqual([]);
    });

    it('skips system envelopes', () => {
      expect(parser.parseLine('{"type":"system","subtype":"init","session_id":"abc"}')).toEqual([]);
    });

    it('treats invalid JSON as reasoning step', () => {
      const events = parser.parseLine('This is not JSON');
      expect(events).toHaveLength(1);
      expect(events[0].recordType).toBe('agent_reasoning_step');
    });
  });

  describe('self-correction detection', () => {
    let parser: OutputParser;

    beforeEach(() => {
      parser = createClaudeCodeParser();
    });

    it('detects consecutive writes to same file as self-correction', () => {
      parser.parseLine('{"type":"tool_use","name":"Write","input":{"path":"src/main.ts","content":"v1"}}');
      const events = parser.parseLine('{"type":"tool_use","name":"Write","input":{"path":"src/main.ts","content":"v2"}}');
      expect(events[0].isSelfCorrection).toBe(true);
      expect(events[0].recordType).toBe('agent_self_correction');
    });

    it('does not flag different files as self-correction', () => {
      parser.parseLine('{"type":"tool_use","name":"Write","input":{"path":"src/a.ts","content":"v1"}}');
      const events = parser.parseLine('{"type":"tool_use","name":"Write","input":{"path":"src/b.ts","content":"v1"}}');
      expect(events[0].isSelfCorrection).toBe(false);
    });

    it('detects explicit correction language', () => {
      const events = parser.parseLine('{"type":"assistant","content":"I need to fix the previous implementation"}');
      expect(events[0].isSelfCorrection).toBe(true);
      expect(events[0].recordType).toBe('agent_self_correction');
    });

    it('does not flag normal reasoning as self-correction', () => {
      const events = parser.parseLine('{"type":"assistant","content":"I will implement the authentication handler"}');
      expect(events[0].isSelfCorrection).toBe(false);
    });
  });

  describe('nested stream-json envelopes (real Claude Code shape)', () => {
    let parser: OutputParser;
    beforeEach(() => { parser = createClaudeCodeParser(); });

    it('unwraps assistant envelope with a single text block', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'I will create the file.' }] },
      });
      const events = parser.parseLine(line);
      expect(events).toHaveLength(1);
      expect(events[0].recordType).toBe('agent_reasoning_step');
      expect(events[0].data.content).toBe('I will create the file.');
    });

    it('unwraps assistant envelope with a thinking block to agent_reasoning_step', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'thinking', thinking: 'I should inspect the file before editing it.' }] },
      });
      const events = parser.parseLine(line);
      expect(events).toHaveLength(1);
      expect(events[0].recordType).toBe('agent_reasoning_step');
      expect(events[0].data.content).toBe('I should inspect the file before editing it.');
      expect(events[0].data.text).toBe('I should inspect the file before editing it.');
    });

    it('unwraps assistant envelope with both thinking and text blocks in order', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'First reason about the request.' },
            { type: 'text', text: 'I will inspect the relevant files now.' },
          ],
        },
      });
      const events = parser.parseLine(line);
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.recordType)).toEqual([
        'agent_reasoning_step',
        'agent_reasoning_step',
      ]);
      expect(events[0].data.content).toBe('First reason about the request.');
      expect(events[1].data.content).toBe('I will inspect the relevant files now.');
    });

    it('unwraps assistant envelope with a tool_use block to a tool_call', () => {
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [{
            type: 'tool_use',
            id: 'toolu_01',
            name: 'Write',
            input: { file_path: 'src/app.ts', content: 'console.log(1)' },
          }],
        },
      });
      const events = parser.parseLine(line);
      expect(events).toHaveLength(1);
      expect(events[0].recordType).toBe('tool_call');
      expect(events[0].data.name).toBe('Write');
      expect((events[0].data.input as Record<string, unknown>).file_path).toBe('src/app.ts');
    });

    it('unwraps assistant envelope with both text and tool_use blocks into multiple events', () => {
      // Real Claude Code frequently emits a single "assistant" message
      // that contains narration + one or more tool_use calls. Both must
      // surface as independent events so the executor can attribute
      // each tool call to the right file write.
      const line = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Creating two files.' },
            { type: 'tool_use', id: 't1', name: 'Write', input: { file_path: 'a.ts', content: 'A' } },
            { type: 'tool_use', id: 't2', name: 'Write', input: { file_path: 'b.ts', content: 'B' } },
          ],
        },
      });
      const events = parser.parseLine(line);
      expect(events).toHaveLength(3);
      expect(events.map((e) => e.recordType)).toEqual([
        'agent_reasoning_step',
        'tool_call',
        'tool_call',
      ]);
      // Sequence positions should be distinct and increasing.
      expect(events[0].sequencePosition).toBe(0);
      expect(events[1].sequencePosition).toBe(1);
      expect(events[2].sequencePosition).toBe(2);
    });

    it('unwraps user envelope with tool_result block to tool_result event', () => {
      const line = JSON.stringify({
        type: 'user',
        message: {
          content: [{
            type: 'tool_result',
            tool_use_id: 'toolu_01',
            content: 'File written.',
          }],
        },
      });
      const events = parser.parseLine(line);
      expect(events).toHaveLength(1);
      expect(events[0].recordType).toBe('tool_result');
    });

    it('flags consecutive Write tool_use blocks to same file even across nested envelopes', () => {
      const env1 = JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'x.ts', content: 'v1' } }] },
      });
      const env2 = JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'x.ts', content: 'v2' } }] },
      });
      parser.parseLine(env1);
      const events = parser.parseLine(env2);
      expect(events[0].isSelfCorrection).toBe(true);
      expect(events[0].recordType).toBe('agent_self_correction');
    });

    it('skips the init system envelope that Claude Code emits first', () => {
      const line = JSON.stringify({
        type: 'system',
        subtype: 'init',
        session_id: 'sess-1',
        tools: ['Read', 'Write'],
      });
      const events = parser.parseLine(line);
      expect(events).toEqual([]);
    });

    it('maps the final result envelope to artifact_produced', () => {
      const line = JSON.stringify({
        type: 'result',
        subtype: 'success',
        session_id: 'sess-1',
        result: 'Implementation complete.',
      });
      const events = parser.parseLine(line);
      expect(events).toHaveLength(1);
      expect(events[0].recordType).toBe('artifact_produced');
      expect(events[0].data.result).toBe('Implementation complete.');
    });
  });

  describe('reset', () => {
    it('resets sequence counter and state', () => {
      const parser = createClaudeCodeParser();
      parser.parseLine('{"type":"assistant","content":"step 1"}');
      parser.parseLine('{"type":"assistant","content":"step 2"}');

      parser.reset();

      const events = parser.parseLine('{"type":"assistant","content":"step 1 after reset"}');
      expect(events[0].sequencePosition).toBe(0);
    });
  });
});
