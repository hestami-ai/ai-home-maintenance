/**
 * Characterization tests for `extractReasoningText` — pins the reasoning-channel
 * extraction behavior before/after the S3776 decomposition into
 * findFinalAnswerIndices + readEventReasoningText helpers.
 *
 * Behavior pinned (from the original inline logic):
 *   - Reasoning events are concatenated with '\n', reading text → content →
 *     thinking (in that priority) off each event's data.
 *   - tool_use / tool_result / tool_call events are skipped entirely.
 *   - Type-only 'result' envelopes carry no reasoning text.
 *   - The terminal 'result' envelope AND the last Codex agent_message
 *     (item.completed) are excluded — they are the final answer, not reasoning.
 *   - Whitespace-only text is dropped.
 */

import { describe, it, expect } from 'vitest';
import { extractReasoningText } from '../../../lib/orchestrator/orchestratorEngine';
import type { ParsedEvent } from '../../../lib/cli/outputParser';

function ev(data: Record<string, unknown>, i = 0): ParsedEvent {
  return { recordType: 'x', data, isSelfCorrection: false, sequencePosition: i };
}

describe('extractReasoningText (characterization)', () => {
  it('concatenates text/content/thinking reasoning events with newlines', () => {
    const events: ParsedEvent[] = [
      ev({ type: 'text', text: 'first thought' }, 0),
      ev({ type: 'reasoning', content: 'second thought' }, 1),
      ev({ type: 'thinking', thinking: 'third thought' }, 2),
    ];
    expect(extractReasoningText(events)).toBe('first thought\nsecond thought\nthird thought');
  });

  it('prefers text over content over thinking on a single event', () => {
    expect(extractReasoningText([ev({ type: 'x', text: 'T', content: 'C', thinking: 'K' })])).toBe('T');
    expect(extractReasoningText([ev({ type: 'x', content: 'C', thinking: 'K' })])).toBe('C');
    expect(extractReasoningText([ev({ type: 'x', thinking: 'K' })])).toBe('K');
  });

  it('skips tool_use / tool_result / tool_call events even when they carry text', () => {
    const events: ParsedEvent[] = [
      ev({ type: 'tool_use', text: 'ignored tool' }, 0),
      ev({ type: 'tool_result', text: 'ignored result' }, 1),
      ev({ type: 'tool_call', text: 'ignored call' }, 2),
      ev({ type: 'text', text: 'kept' }, 3),
    ];
    expect(extractReasoningText(events)).toBe('kept');
  });

  it('drops whitespace-only reasoning text', () => {
    const events: ParsedEvent[] = [
      ev({ type: 'text', text: '   ' }, 0),
      ev({ type: 'text', text: 'real' }, 1),
    ];
    expect(extractReasoningText(events)).toBe('real');
  });

  it('excludes the terminal result envelope (the final answer) from reasoning', () => {
    const events: ParsedEvent[] = [
      ev({ type: 'text', text: 'thinking aloud' }, 0),
      ev({ type: 'result', result: 'FINAL ANSWER' }, 1),
    ];
    expect(extractReasoningText(events)).toBe('thinking aloud');
  });

  it('excludes the last Codex agent_message (final answer), keeping earlier reasoning', () => {
    const events: ParsedEvent[] = [
      ev({ type: 'text', text: 'reasoning step' }, 0),
      // Top-level `text` present so that WITHOUT the index-exclusion this event
      // would be appended — proving the exclusion is what drops it.
      ev({ type: 'item.completed', item: { type: 'agent_message', text: 'CODEX FINAL' }, text: 'CODEX FINAL' }, 1),
    ];
    expect(extractReasoningText(events)).toBe('reasoning step');
  });

  it('returns empty string for no events', () => {
    expect(extractReasoningText([])).toBe('');
  });
});
