import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseJsonWithRecovery } from '../../../lib/llm/jsonRecovery';

describe('parseJsonWithRecovery', () => {
  it('parses valid JSON without modification', () => {
    const result = parseJsonWithRecovery('{"candidate_product_concepts":[{"id":"c1"}]}');
    expect(result.parsed).toEqual({ candidate_product_concepts: [{ id: 'c1' }] });
    expect(result.recovered).toBe(false);
  });

  it('recovers qwen-style single-quoted strings embedded in JSON', () => {
    const raw = `{
      "candidate_product_concepts": [
        {
          "id": "cp-platform-core",
          "assumptions": [
            {
              "inference": 'Eternal Perspective' requires all pillars to share the same 'PostgreSQL with RLS' data lake.",
              "basis": "Core Technological Infrastructure -> Database -> PostgreSQL RLS multi-tenant isolation."
            }
          ]
        }
      ]
    }`;

    const result = parseJsonWithRecovery(raw);
    expect(result.recovered).toBe(true);
    expect(result.parsed).toEqual({
      candidate_product_concepts: [
        {
          id: 'cp-platform-core',
          assumptions: [
            {
              inference: "'Eternal Perspective' requires all pillars to share the same 'PostgreSQL with RLS' data lake.",
              basis: 'Core Technological Infrastructure -> Database -> PostgreSQL RLS multi-tenant isolation.',
            },
          ],
        },
      ],
    });
  });

  it('recovers mixed quote strings and invalid backslashes in a qwen bloom payload', () => {
    const raw = `{
      "candidate_product_concepts": [
        {
          "id": "cp-api-platform",
          "assumptions": [
            {
              "assumption": 'The "Single Product Scope" in Context Summary is interpreted as a single product line, not a single executable binary.',
              "basis": "Context Summary: 'Scope: single_product' usually implies one codebase, but Spec Appendix 'Phase 1, Phase 2, Phase 3' implies distinct product lifecycles."
            }
          ],
          "constraints": [
            "Must support 'e:\\Projects\\...' directory structure for deployment consistency."
          ]
        }
      ]
    }`;

    const result = parseJsonWithRecovery(raw);
    expect(result.recovered).toBe(true);
    expect(result.parsed).toEqual({
      candidate_product_concepts: [
        {
          id: 'cp-api-platform',
          assumptions: [
            {
              assumption: 'The "Single Product Scope" in Context Summary is interpreted as a single product line, not a single executable binary.',
              basis: "Context Summary: 'Scope: single_product' usually implies one codebase, but Spec Appendix 'Phase 1, Phase 2, Phase 3' implies distinct product lifecycles.",
            },
          ],
          constraints: [
            "Must support 'e:\\Projects\\...' directory structure for deployment consistency.",
          ],
        },
      ],
    });
  });

  describe('trailing-comma recovery', () => {
    it('recovers from a trailing comma before }', () => {
      const raw = '{ "a": 1, "b": 2, }';
      const result = parseJsonWithRecovery(raw);
      expect(result.recovered).toBe(true);
      expect(result.parsed).toEqual({ a: 1, b: 2 });
    });

    it('recovers from a trailing comma before ]', () => {
      const raw = '{ "xs": [1, 2, 3, ] }';
      const result = parseJsonWithRecovery(raw);
      expect(result.recovered).toBe(true);
      expect(result.parsed).toEqual({ xs: [1, 2, 3] });
    });

    it('recovers from nested trailing commas (object-in-array-in-object)', () => {
      const raw = `{
        "items": [
          {
            "id": "a",
            "tags": ["x", "y", ],
          },
          {
            "id": "b",
          },
        ],
      }`;
      const result = parseJsonWithRecovery(raw);
      expect(result.recovered).toBe(true);
      expect(result.parsed).toEqual({
        items: [
          { id: 'a', tags: ['x', 'y'] },
          { id: 'b' },
        ],
      });
    });

    it('does NOT strip commas that live inside string values', () => {
      // Commas inside strings (e.g. "foo, bar") must survive the
      // trailing-comma repair. The walker tracks in/out of quoted
      // strings specifically so string content is untouched.
      const raw = `{ "a": "foo, bar", "b": "baz,", }`;
      const result = parseJsonWithRecovery(raw);
      expect(result.recovered).toBe(true);
      expect(result.parsed).toEqual({ a: 'foo, bar', b: 'baz,' });
    });

    it('recovers the real Hestami Phase 1.2 bloom response (captured live)', () => {
      // This is the 9KB qwen3.5:9b response the Hestami harness actually
      // produced. Stock JSON.parse fails at position 7217 on a trailing
      // comma after an object in an assumptions array. Before this fix
      // the Phase 1.2 handler fell through to the `c1/Primary
      // interpretation` placeholder — the Candidate Interpretations
      // card in the webview showed the raw intent text verbatim instead
      // of the three rich candidate concepts the model returned.
      const fixturePath = path.join(__dirname, 'hestami-bloom-output.fixture.txt');
      const raw = fs.readFileSync(fixturePath, 'utf8');
      const result = parseJsonWithRecovery(raw);
      expect(result.recovered).toBe(true);
      expect(result.parsed).not.toBeNull();
      const candidates = (result.parsed as Record<string, unknown>).candidate_product_concepts as Array<Record<string, unknown>>;
      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBeGreaterThanOrEqual(3);
      // Every candidate must have the real bloom fields — no placeholders.
      for (const c of candidates) {
        expect(typeof c.name).toBe('string');
        expect((c.name as string).length).toBeGreaterThan(0);
        expect(c.name).not.toBe('Primary interpretation');
        expect(typeof c.who_it_serves).toBe('string');
        expect(c.who_it_serves).not.toBe('(to be determined through bloom)');
      }
    });
  });

  describe('escapeUnescapedInternalQuotes repair layer', () => {
    it('recovers a JSON object whose string value contains unescaped internal quotes', () => {
      // Real pathology captured from Hestami iter-1 run: the LLM wrote
      // `"rationale": "Central to Vision ("AI-native OS")..."` — the
      // inner quotes close the value prematurely for JSON.parse.
      const raw = `{
        "id": "DOM-AI-ENGINE",
        "rationale": "Central to Vision ("AI-native operating system"). Supports AI verification."
      }`;
      const result = parseJsonWithRecovery(raw);
      expect(result.parsed, result.error).not.toBeNull();
      expect(result.recovered).toBe(true);
      expect((result.parsed as { rationale: string }).rationale).toContain('AI-native operating system');
    });

    it('leaves well-formed JSON untouched — quote-escape repair is a no-op when the input parses', () => {
      const clean = '{"a":"b","c":{"d":"e"}}';
      const result = parseJsonWithRecovery(clean);
      expect(result.recovered).toBe(false);
      expect(result.parsed).toEqual({ a: 'b', c: { d: 'e' } });
    });

    it('handles multiple internal quotes across multiple fields', () => {
      const raw = `{
        "one": "Cites "v1 Hestami" reference.",
        "two": "Quotes "a" and "b" together.",
        "three": "clean value"
      }`;
      const result = parseJsonWithRecovery(raw);
      expect(result.parsed, result.error).not.toBeNull();
      const p = result.parsed as { one: string; two: string; three: string };
      expect(p.one).toContain('v1 Hestami');
      expect(p.two).toContain('a');
      expect(p.three).toBe('clean value');
    });
  });
});
