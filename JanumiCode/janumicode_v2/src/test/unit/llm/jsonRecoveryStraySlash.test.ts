import { describe, it, expect } from 'vitest';
import { parseJsonWithRecovery } from '../../../lib/llm/jsonRecovery';

describe('stray-slash-outside-strings recovery', () => {
  it('drops a lone `/` between array elements', () => {
    const input = '{ "goals": [\n  "a",\n  "b"\n/\n] }';
    const r = parseJsonWithRecovery(input);
    expect(r.parsed).toEqual({ goals: ['a', 'b'] });
  });

  it('strips a `// ...` line comment outside strings', () => {
    const r = parseJsonWithRecovery('{ "k": "v" // tail comment\n}');
    expect(r.parsed).toEqual({ k: 'v' });
  });

  it('strips a `/* ... */` block comment outside strings', () => {
    const r = parseJsonWithRecovery('{ "k": /* inline */ "v" }');
    expect(r.parsed).toEqual({ k: 'v' });
  });

  it('preserves `/` inside string values (URLs, paths, dates)', () => {
    const r = parseJsonWithRecovery('{ "url": "https://x.com/y", "path": "/a/b/c", "d": "2026/01/02" }');
    expect(r.parsed).toEqual({ url: 'https://x.com/y', path: '/a/b/c', d: '2026/01/02' });
  });

  it('preserves escaped slashes inside strings', () => {
    const r = parseJsonWithRecovery('{ "s": "a\\/b" }');
    expect(r.parsed).toEqual({ s: 'a/b' });
  });
});
