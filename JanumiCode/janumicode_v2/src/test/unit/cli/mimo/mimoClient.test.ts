import { describe, it, expect } from 'vitest';
import { parseSse, parseModelRef, type MimoSseEvent } from '../../../../lib/cli/mimo/mimoClient';

async function* chunks(...c: string[]): AsyncGenerator<string> {
  for (const x of c) yield x;
}
async function collect(gen: AsyncGenerator<MimoSseEvent>): Promise<MimoSseEvent[]> {
  const out: MimoSseEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe('parseModelRef', () => {
  it('splits provider/model', () => {
    expect(parseModelRef('mimo/mimo-auto')).toEqual({ providerID: 'mimo', modelID: 'mimo-auto' });
  });
  it('defaults provider to mimo when no slash', () => {
    expect(parseModelRef('mimo-auto')).toEqual({ providerID: 'mimo', modelID: 'mimo-auto' });
  });
  it('keeps only the first slash as the separator', () => {
    expect(parseModelRef('openrouter/anthropic/claude')).toEqual({ providerID: 'openrouter', modelID: 'anthropic/claude' });
  });
});

describe('parseSse', () => {
  it('decodes one event per data: line', async () => {
    const events = await collect(parseSse(chunks(
      'data: {"type":"session.idle","properties":{"sessionID":"ses_1"}}\n',
      'data: {"type":"message.part.delta","properties":{"sessionID":"ses_1","field":"text","delta":"hi"}}\n',
    )));
    expect(events.map(e => e.type)).toEqual(['session.idle', 'message.part.delta']);
    expect((events[1].properties as { delta: string }).delta).toBe('hi');
  });

  it('reassembles a line split across chunks', async () => {
    const events = await collect(parseSse(chunks(
      'data: {"type":"sess',
      'ion.idle","properties":{"sessionID":"ses_2"}}\n',
    )));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('session.idle');
    expect((events[0].properties as { sessionID: string }).sessionID).toBe('ses_2');
  });

  it('handles CRLF line endings and yields a trailing line without newline', async () => {
    const events = await collect(parseSse(chunks(
      'data: {"type":"a","properties":{}}\r\n',
      'data: {"type":"b","properties":{}}',
    )));
    expect(events.map(e => e.type)).toEqual(['a', 'b']);
  });

  it('skips non-data lines, blank keepalives, and malformed JSON', async () => {
    const events = await collect(parseSse(chunks(
      ': keepalive\n',
      '\n',
      'event: ping\n',
      'data: not-json\n',
      'data: {"type":"ok","properties":{}}\n',
    )));
    expect(events.map(e => e.type)).toEqual(['ok']);
  });
});
