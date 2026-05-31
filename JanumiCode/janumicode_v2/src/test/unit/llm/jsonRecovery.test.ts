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

import { repairStructuralJson } from '../../../lib/llm/jsonRecovery';

describe('repairStructuralJson — deterministic structural completion', () => {
  it('appends a missing closing brace', () => {
    expect(JSON.parse(repairStructuralJson('{"a":1'))).toEqual({ a: 1 });
  });

  it('appends missing closing brackets and braces in nesting order', () => {
    const broken = '{"defs":[{"id":"x","items":["a","b"';
    expect(JSON.parse(repairStructuralJson(broken))).toEqual({ defs: [{ id: 'x', items: ['a', 'b'] }] });
  });

  it('strips a trailing comma before a closer', () => {
    expect(JSON.parse(repairStructuralJson('{"a":1,}'))).toEqual({ a: 1 });
    expect(JSON.parse(repairStructuralJson('{"a":[1,2,]}'))).toEqual({ a: [1, 2] });
  });

  it('closes an unterminated trailing string', () => {
    expect(JSON.parse(repairStructuralJson('{"a":"unterminated'))).toEqual({ a: 'unterminated' });
  });

  it('does NOT treat braces inside string values as structure', () => {
    const s = '{"a":"a } weird { value","b":1';
    expect(JSON.parse(repairStructuralJson(s))).toEqual({ a: 'a } weird { value', b: 1 });
  });

  it('respects escaped quotes inside strings', () => {
    const s = '{"a":"he said \\"hi\\"","b":2';
    expect(JSON.parse(repairStructuralJson(s))).toEqual({ a: 'he said "hi"', b: 2 });
  });

  it('returns equivalent JSON when already valid', () => {
    const valid = '{"a":1,"b":[2,3]}';
    expect(JSON.parse(repairStructuralJson(valid))).toEqual({ a: 1, b: [2, 3] });
  });

  it('recovers a truncated api-definitions-shaped object (ts-117 failure mode)', () => {
    // Model emitted nested endpoint JSON but ran out of closers.
    const truncated = '{"definitions":[{"component_id":"comp-shortening-service","endpoints":[{"path":"/shorten","method":"POST","inputs":{"long_url":"string"},"outputs":{"slug":"string"},"error_codes":["400"],"auth_requirement":"None"}';
    const obj = JSON.parse(repairStructuralJson(truncated)) as { definitions: Array<{ endpoints: unknown[] }> };
    expect(obj.definitions).toHaveLength(1);
    expect(obj.definitions[0].endpoints).toHaveLength(1);
  });
});

describe('tryParseJson — structural recovery integration', () => {
  it('flags structurallyRepaired and recovers a brace-truncated object', () => {
    const r = tryParseJson('{"a":1,"b":[2,3');
    expect(r.parsed).toEqual({ a: 1, b: [2, 3] });
    expect(r.structurallyRepaired).toBe(true);
  });

  it('does NOT set structurallyRepaired for already-valid JSON', () => {
    const r = tryParseJson('{"a":1}');
    expect(r.parsed).toEqual({ a: 1 });
    expect(r.structurallyRepaired).toBeUndefined();
  });

  it('still returns null for genuinely unrecoverable garbage', () => {
    const r = tryParseJson('not json at all, no braces');
    expect(r.parsed).toBeNull();
  });
});
