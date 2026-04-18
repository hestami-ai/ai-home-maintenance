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
});
