import { describe, it, expect } from 'vitest';
import { parseSse, parseModelRef, MimoClient, type MimoSseEvent } from '../../../../lib/cli/mimo/mimoClient';

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

describe('MimoClient.postJson long-running routing', () => {
  // Regression: the no-timeout fix attached a standalone-`undici`-package Agent
  // as a `dispatcher` on Node's BUILT-IN global fetch, which throws "invalid
  // onRequestStart method" on an undici-version mismatch (pkg 8.x vs Node 7.x).
  // An INJECTED fetchImpl must be used verbatim — never carrying that dispatcher
  // (it would break a non-undici/test fetch) and never routed through undici.
  it('uses the injected fetchImpl for a long-running sendMessage, with NO dispatcher attached', async () => {
    const seen: Array<{ url: string; init: RequestInit & { dispatcher?: unknown } }> = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init: (init ?? {}) as RequestInit & { dispatcher?: unknown } });
      return new Response(JSON.stringify({ info: { finish: 'stop' } }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new MimoClient('http://127.0.0.1:9/', fakeFetch);
    const res = await client.sendMessage('ses_1', {
      agent: 'build',
      model: { providerID: 'ollama-local', modelID: 'm' },
      text: 'hi',
    });

    expect(res.finish).toBe('stop');
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe('http://127.0.0.1:9/session/ses_1/message'); // trailing slash trimmed
    expect(seen[0].init.dispatcher).toBeUndefined(); // the version-mismatched Agent never leaks here
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
