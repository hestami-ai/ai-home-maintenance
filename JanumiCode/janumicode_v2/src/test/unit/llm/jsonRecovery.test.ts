import { describe, expect, it } from 'vitest';
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
});
