/**
 * Prompt probe: Vocabulary Collision Check (Sub-Phase 0.4)
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Vocabulary Collision Check', () => {
  it('produces valid collision_risk_report with clean product scope', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'vocabulary_collision_clean',
      templateKey: 'cross_cutting/vocabulary_collision_check.system',
      variables: {
        canonical_vocabulary_summary: 'Governed Stream = lossless SQLite database. Artifact = schema-validated phase output. Workflow Run = end-to-end execution. Component = deployable unit. Phase Gate = validation checkpoint.',
        product_scope_text: 'A URL shortening service that creates short links, tracks click analytics, and provides an API for programmatic access. Users create accounts, manage their links through a dashboard, and view statistics.',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'collision_risk_report',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.aliases)) errors.push('Missing aliases array');
        if (!Array.isArray(parsed.collision_risks)) errors.push('Missing collision_risks array');
        if (!parsed.overall_status) errors.push('Missing overall_status');
        if (!['clean', 'aliases_found', 'collisions_found'].includes(parsed.overall_status as string)) {
          errors.push(`Invalid overall_status: ${parsed.overall_status}`);
        }
        return errors;
      },
      judgeRubric: {
        name: 'Vocabulary Collision Check on URL shortening service',
        criteria: [
          'overall_status is "clean" — URL shortening domain does not collide with JanumiCode canonical vocabulary',
          'aliases array is empty (the product scope uses none of the canonical terms)',
          'collision_risks array is empty',
          'No invented collisions for terms that do not appear in the product scope',
        ],
        reasoningCriteria: [
          'The reviewer understood that "users", "links", "API", "dashboard", "statistics" are NOT canonical JanumiCode terms',
          'The reviewer did not flag generic words as collisions',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);

  it('detects collisions when product scope uses canonical terms differently', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'vocabulary_collision_risky',
      templateKey: 'cross_cutting/vocabulary_collision_check.system',
      variables: {
        canonical_vocabulary_summary: 'Governed Stream = lossless SQLite database. Artifact = schema-validated phase output. Workflow Run = end-to-end execution. Component = deployable unit. Phase Gate = validation checkpoint. Mirror = annotated artifact reflecting understanding.',
        product_scope_text: 'A smart mirror product for retail stores. The mirror component displays product recommendations. Each workflow run shows different outfits. Artifacts are the physical items shown. The phase gate is the store entrance detector.',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'collision_risk_report',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.aliases) && !Array.isArray(parsed.collision_risks)) {
          errors.push('Expected aliases or collision_risks for conflicting terms');
        }
        const totalFindings = ((parsed.aliases as unknown[])?.length ?? 0) +
          ((parsed.collision_risks as unknown[])?.length ?? 0);
        if (totalFindings === 0) {
          errors.push('Expected at least one alias or collision for product using "mirror", "artifact", "workflow run", "component", "phase gate"');
        }
        if (parsed.overall_status === 'clean') {
          errors.push('Expected non-clean status for clearly colliding terms');
        }
        return errors;
      },
      judgeRubric: {
        name: 'Vocabulary Collision Check on smart mirror retail product',
        criteria: [
          'overall_status is "aliases_found" or "collisions_found" (NOT "clean")',
          'Findings include "mirror" — the product uses it as a physical device, JanumiCode uses it as an annotated artifact',
          'Findings include at least one of: "component", "workflow run", "artifact", "phase gate"',
          'Findings have severity assigned',
          'Each finding cites the canonical term and the product\'s alternate meaning',
        ],
        reasoningCriteria: [
          'The reviewer recognized that the product uses canonical JanumiCode terms with different meanings',
          'The reviewer did not give the product a free pass on terms that clearly clash',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
