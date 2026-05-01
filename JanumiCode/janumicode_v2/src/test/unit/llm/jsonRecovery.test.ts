import { describe, expect, it } from 'vitest';
import { tryParseJson, extractJsonObject } from '../../../lib/llm/jsonRecovery';

describe('extractJsonObject', () => {
  it('returns trimmed input when it already starts with `{`', () => {
    expect(extractJsonObject('  {"a":1}  ')).toBe('{"a":1}');
  });

  it('unwraps a markdown json fence', () => {
    const raw = 'Here is the JSON:\n```json\n{"a":1}\n```\nThanks.';
    expect(extractJsonObject(raw)).toBe('{"a":1}');
  });

  it('unwraps a generic code fence', () => {
    const raw = '```\n{"a":1}\n```';
    expect(extractJsonObject(raw)).toBe('{"a":1}');
  });

  it('uses outer brace span when prose surrounds the JSON', () => {
    const raw = 'Result follows: {"a":1, "b":[1,2]} done.';
    expect(extractJsonObject(raw)).toBe('{"a":1, "b":[1,2]}');
  });

  it('returns null when no brace pair is present', () => {
    expect(extractJsonObject('Sorry, I cannot help with that.')).toBeNull();
  });
});

describe('tryParseJson', () => {
  it('parses a valid JSON object', () => {
    const result = tryParseJson('{"name":"alice","items":[1,2,3]}');
    expect(result.parsed).toEqual({ name: 'alice', items: [1, 2, 3] });
    expect(result.error).toBeUndefined();
  });

  it('parses through a markdown fence', () => {
    const result = tryParseJson('```json\n{"x":42}\n```');
    expect(result.parsed).toEqual({ x: 42 });
  });

  it('returns parsed=null with error on malformed JSON', () => {
    const result = tryParseJson('{"phase": "phase": "Phase 3"}');
    expect(result.parsed).toBeNull();
    expect(result.error).toBeDefined();
    // Still returns the candidate jsonText so callers can hand it to a
    // repair fallback.
    expect(result.jsonText).toBe('{"phase": "phase": "Phase 3"}');
  });

  it('returns parsed=null when no JSON shape is present at all', () => {
    const result = tryParseJson('hello world');
    expect(result.parsed).toBeNull();
    expect(result.jsonText).toBeNull();
  });

  it('does NOT attempt local pathology repair (intentional)', () => {
    // Stray quote after number — old code recovered this. New code
    // returns null and lets the LLM repair fallback handle it.
    const broken = '{"value": 42"}';
    const result = tryParseJson(broken);
    expect(result.parsed).toBeNull();
  });
});
