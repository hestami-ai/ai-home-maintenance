/**
 * Regression tests for the Goose CLI stream-json parser.
 *
 * Pins that the parser correctly unwraps Goose's
 *   `{type:"message", message:{role, content:[…], …}}`
 * envelope and routes per-content-item types (text, thinking,
 * tool_use, tool_result) to the right Governed Stream record types.
 * Terminal `{type:"complete", …}` maps to `artifact_produced`.
 *
 * Shapes below are modeled on the real example run in
 * `JanumiCode/janumicode/docs/Goose CLI example run.md` plus the
 * inner content-item shapes that are shared with Claude Code.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OutputParser, createGooseCliParser } from '../../../lib/cli/outputParser';

describe('Goose CLI stream-json parser', () => {
  let parser: OutputParser;

  beforeEach(() => {
    parser = createGooseCliParser();
  });

  it('unwraps a message envelope with a thinking block to agent_reasoning_step', () => {
    const line = JSON.stringify({
      type: 'message',
      message: {
        id: 'chatcmpl-297',
        role: 'assistant',
        created: 1776430390,
        content: [{ type: 'thinking', thinking: 'The', signature: '' }],
        metadata: { userVisible: true, agentVisible: true },
      },
    });
    const events = parser.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].recordType).toBe('agent_reasoning_step');
    // `thinking` → normalized into `content` AND `text` so downstream
    // consumers don't need to branch on item type.
    expect(events[0].data.content).toBe('The');
    expect(events[0].data.text).toBe('The');
  });

  it('unwraps a message envelope with a text block to agent_reasoning_step', () => {
    const line = JSON.stringify({
      type: 'message',
      message: {
        id: 'chatcmpl-297',
        role: 'assistant',
        created: 1776430396,
        content: [{ type: 'text', text: 'Radius is half the diameter.' }],
        metadata: {},
      },
    });
    const events = parser.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].recordType).toBe('agent_reasoning_step');
    expect(events[0].data.content).toBe('Radius is half the diameter.');
  });

  it('unwraps a tool_use content item to a tool_call event', () => {
    const line = JSON.stringify({
      type: 'message',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'toolu_1',
          name: 'Write',
          input: { file_path: 'todo.py', content: 'print("hi")' },
        }],
      },
    });
    const events = parser.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].recordType).toBe('tool_call');
    expect(events[0].data.name).toBe('Write');
    expect((events[0].data.input as Record<string, unknown>).file_path).toBe('todo.py');
  });

  it('unwraps a tool_result content item from a user/tool envelope', () => {
    // Goose ferries tool results back through the same `message`
    // envelope with role='tool' (or 'user'). We don't switch on role
    // — the inner `type: tool_result` is the authoritative signal.
    const line = JSON.stringify({
      type: 'message',
      message: {
        role: 'tool',
        content: [{
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          content: 'file written',
        }],
      },
    });
    const events = parser.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].recordType).toBe('tool_result');
  });

  it('unwraps multi-item envelopes into separate events in order', () => {
    const line = JSON.stringify({
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'plan' },
          { type: 'text', text: 'Creating two files.' },
          { type: 'tool_use', id: 't1', name: 'Write', input: { file_path: 'a.ts' } },
          { type: 'tool_use', id: 't2', name: 'Write', input: { file_path: 'b.ts' } },
        ],
      },
    });
    const events = parser.parseLine(line);
    expect(events).toHaveLength(4);
    expect(events.map((e) => e.recordType)).toEqual([
      'agent_reasoning_step',
      'agent_reasoning_step',
      'tool_call',
      'tool_call',
    ]);
    expect(events[0].sequencePosition).toBe(0);
    expect(events[3].sequencePosition).toBe(3);
  });

  it('maps the terminal {type:"complete"} marker to artifact_produced', () => {
    const line = JSON.stringify({
      type: 'complete',
      total_tokens: null,
    });
    const events = parser.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].recordType).toBe('artifact_produced');
  });

  it('skips unknown outer envelope types silently', () => {
    expect(parser.parseLine('{"type":"not_a_real_goose_event","foo":1}')).toEqual([]);
  });

  it('flags two consecutive Write tool_use items to the same file as self-correction', () => {
    const env1 = JSON.stringify({
      type: 'message',
      message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'x.ts' } }] },
    });
    const env2 = JSON.stringify({
      type: 'message',
      message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'x.ts' } }] },
    });
    parser.parseLine(env1);
    const events = parser.parseLine(env2);
    expect(events[0].isSelfCorrection).toBe(true);
    expect(events[0].recordType).toBe('agent_self_correction');
  });

  it('handles invalid JSON as raw reasoning text', () => {
    const events = parser.parseLine('not json');
    expect(events).toHaveLength(1);
    expect(events[0].recordType).toBe('agent_reasoning_step');
  });
});
