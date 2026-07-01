/**
 * NdjsonStreamDecoder — streaming NDJSON frame parsing for the Ollama provider.
 * Regression coverage for the multi-byte-UTF-8 boundary hazard and the
 * silent-drop hazard in the streaming read loop.
 */
import { describe, it, expect } from 'vitest';
import { NdjsonStreamDecoder } from '../../../lib/llm/providers/ollama';

describe('NdjsonStreamDecoder', () => {
  it('reassembles a multi-byte UTF-8 char split across chunks (preserves it intact)', () => {
    // The em-dash — (U+2014 = bytes E2 80 94) is a char gemma emits heavily in
    // its thinking. Split it across two chunks at the first byte.
    const full = Buffer.from('{"thinking":"a—b"}\n', 'utf8');
    const i = full.indexOf(0xe2);
    expect(i).toBeGreaterThan(0);

    const dropped: string[] = [];
    const dec = new NdjsonStreamDecoder((l) => dropped.push(l));
    const frames = [
      ...dec.push(full.subarray(0, i + 1)), // chunk ends mid em-dash (only E2)
      ...dec.push(full.subarray(i + 1)),    // remainder (80 94 ...)
      ...dec.flush(),
    ];
    expect(dropped).toEqual([]);                 // frame NOT dropped
    expect(frames).toHaveLength(1);
    expect(frames[0].thinking).toBe('a—b');      // em-dash preserved, no U+FFFD
    expect(JSON.stringify(frames[0])).not.toContain('�');
  });

  it('CONTROL: the naive chunk.toString(utf-8) corrupts the same split to U+FFFD', () => {
    // Documents the bug the decoder fixes: decoding each raw chunk independently
    // replaces the split bytes with the replacement char.
    const full = Buffer.from('{"thinking":"a—b"}', 'utf8');
    const i = full.indexOf(0xe2);
    const naive = full.subarray(0, i + 1).toString('utf-8') + full.subarray(i + 1).toString('utf-8');
    expect(naive).toContain('�');           // corrupted
    expect(naive).not.toContain('—');            // original char lost
  });

  it('buffers an NDJSON line split across chunks until complete', () => {
    const dec = new NdjsonStreamDecoder();
    expect(dec.push(Buffer.from('{"response":"hel'))).toEqual([]); // no newline yet
    expect(dec.push(Buffer.from('lo"}\n'))).toEqual([{ response: 'hello' }]);
  });

  it('processes a final newline-less frame on flush (previously dropped)', () => {
    const dec = new NdjsonStreamDecoder();
    expect(dec.push(Buffer.from('{"thinking":"x"}'))).toEqual([]); // no trailing newline
    expect(dec.flush()).toEqual([{ thinking: 'x' }]);
  });

  it('reports unparseable lines via onDrop instead of swallowing them', () => {
    const dropped: string[] = [];
    const dec = new NdjsonStreamDecoder((l) => dropped.push(l));
    const out = dec.push(Buffer.from('not json\n{"response":"ok"}\n'));
    expect(out).toEqual([{ response: 'ok' }]);
    expect(dropped).toEqual(['not json']);
  });

  it('skips blank lines without reporting them as drops', () => {
    const dropped: string[] = [];
    const dec = new NdjsonStreamDecoder((l) => dropped.push(l));
    const out = dec.push(Buffer.from('\n\n{"x":1}\n\n'));
    expect(out).toEqual([{ x: 1 }]);
    expect(dropped).toEqual([]);
  });

  it('handles many frames arriving in a single chunk', () => {
    const dec = new NdjsonStreamDecoder();
    const out = dec.push(Buffer.from('{"thinking":"a"}\n{"thinking":"b"}\n{"response":"c"}\n'));
    expect(out).toEqual([{ thinking: 'a' }, { thinking: 'b' }, { response: 'c' }]);
  });
});
