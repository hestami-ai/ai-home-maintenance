/**
 * Tests for lens-aware template lookup.
 *
 * Phase 1.0a classifies the intent into a lens (product / feature / bug /
 * infra / legal). Phases 1.2 (bloom) and 1.5 (synthesis) then look up
 * lens-tailored templates so the prompt can use lens-specific persona /
 * scope framing. Templates that do NOT declare a lens are treated as
 * neutral fallbacks for lenses that don't yet have a bespoke template.
 *
 * These tests pin:
 *   1. findTemplate(role, sub, lens) returns the lens-specific template
 *      when one exists with matching lens frontmatter.
 *   2. findTemplate(role, sub, lens) falls back to the lens-neutral
 *      template when no lens-specific match exists.
 *   3. findTemplate(role, sub) with no lens argument returns ONLY the
 *      lens-neutral template — it doesn't accidentally surface a
 *      lens-specific one.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateLoader, type PromptTemplate } from '../../../lib/orchestrator/templateLoader';

function makeTemplate(agentRole: string, subPhase: string, lens?: string): PromptTemplate {
  return {
    path: `fixture/${agentRole}_${subPhase}_${lens ?? 'neutral'}.md`,
    metadata: {
      agent_role: agentRole,
      sub_phase: subPhase,
      lens,
      schema_version: '1.0',
      co_invocation_exception: false,
      required_variables: [],
      reasoning_review_triggers: [],
      verification_ensemble_triggers: [],
    },
    body: `[BODY ${lens ?? 'neutral'}]`,
  };
}

describe('TemplateLoader — lens-aware findTemplate', () => {
  let loader: TemplateLoader;

  beforeEach(() => {
    loader = new TemplateLoader('/nonexistent'); // empty loader
    loader.addTemplate('bloom_neutral', makeTemplate('domain_interpreter', '01_2_bloom'));
    loader.addTemplate('bloom_product', makeTemplate('domain_interpreter', '01_2_bloom', 'product'));
    loader.addTemplate('bloom_feature', makeTemplate('domain_interpreter', '01_2_bloom', 'feature'));
  });

  it('returns the lens-specific template when the lens matches exactly', () => {
    const t = loader.findTemplate('domain_interpreter', '01_2_bloom', 'product');
    expect(t?.metadata.lens).toBe('product');
  });

  it('falls back to the lens-neutral template when no lens-specific match exists', () => {
    const t = loader.findTemplate('domain_interpreter', '01_2_bloom', 'bug');
    expect(t).not.toBeNull();
    expect(t?.metadata.lens).toBeUndefined();
  });

  it('returns the lens-neutral template when no lens argument is given', () => {
    const t = loader.findTemplate('domain_interpreter', '01_2_bloom');
    expect(t?.metadata.lens).toBeUndefined();
  });

  it('returns null when no template matches agent_role + sub_phase at all', () => {
    const t = loader.findTemplate('unknown_role', '01_2_bloom', 'product');
    expect(t).toBeNull();
  });
});
