import { describe, it, expect } from 'vitest';
import { parseJsonWithRecovery } from '../../../lib/llm/jsonRecovery';

describe('stray-colon-after-object-open recovery', () => {
  it('drops stray `:` before first key in an object', () => {
    const input = '{ "steps": [\n  {\n    : "stepNumber": 2,\n    "actor": "x"\n  }\n] }';
    const r = parseJsonWithRecovery(input);
    expect(r.parsed).toEqual({ steps: [{ stepNumber: 2, actor: 'x' }] });
  });

  it('drops stray `:` in nested objects (multiple occurrences)', () => {
    const input = '{ "a": { : "b": 1 }, "c": { : "d": 2 } }';
    const r = parseJsonWithRecovery(input);
    expect(r.parsed).toEqual({ a: { b: 1 }, c: { d: 2 } });
  });

  it('does NOT touch a literal "{:..." inside a string value', () => {
    const r = parseJsonWithRecovery('{ "raw": "{ : weird }" }');
    expect(r.parsed).toEqual({ raw: '{ : weird }' });
  });

  it('does NOT touch valid {"key": value', () => {
    const r = parseJsonWithRecovery('{ "k": "v" }');
    expect(r.parsed).toEqual({ k: 'v' });
  });
});
