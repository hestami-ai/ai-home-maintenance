import { describe, it, expect } from 'vitest';
import { parseJsonWithRecovery } from '../../../lib/llm/jsonRecovery';

describe('orphan-quote-colon-property recovery', () => {
  it('drops `": value,` (number value) at start of object', () => {
    const r = parseJsonWithRecovery('{ ": 2, "actor": "System" }');
    expect(r.parsed).toEqual({ actor: 'System' });
  });

  it('drops `": "value",` (string value)', () => {
    const r = parseJsonWithRecovery('{ ": "x", "k": "v" }');
    expect(r.parsed).toEqual({ k: 'v' });
  });

  it('drops orphan with array value', () => {
    const r = parseJsonWithRecovery('{ ": [1, 2, 3], "k": "v" }');
    expect(r.parsed).toEqual({ k: 'v' });
  });

  it('drops orphan with object value', () => {
    const r = parseJsonWithRecovery('{ ": { "a": 1, "b": 2 }, "k": "v" }');
    expect(r.parsed).toEqual({ k: 'v' });
  });

  it('drops orphan with boolean / null', () => {
    expect(parseJsonWithRecovery('{ ": true, "k": 1 }').parsed).toEqual({ k: 1 });
    expect(parseJsonWithRecovery('{ ": null, "k": 1 }').parsed).toEqual({ k: 1 });
  });

  it('preserves valid empty-key idiom `"":`', () => {
    const r = parseJsonWithRecovery('{ "": "empty-key", "k": "v" }');
    expect(r.parsed).toEqual({ '': 'empty-key', k: 'v' });
  });

  it('preserves real string starts (no `:` after)', () => {
    const r = parseJsonWithRecovery('{ "name": "John", "age": 42 }');
    expect(r.parsed).toEqual({ name: 'John', age: 42 });
  });

  it('handles orphan in nested object array', () => {
    const r = parseJsonWithRecovery('{ "steps": [\n  { "stepNumber": 1, "actor": "A" },\n  { ": 2, "actor": "B" }\n] }');
    expect(r.parsed).toEqual({
      steps: [
        { stepNumber: 1, actor: 'A' },
        { actor: 'B' },
      ],
    });
  });
});
