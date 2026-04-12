import { describe, it, expect } from 'vitest';
import { MirrorGenerator } from '../../../lib/orchestrator/mirrorGenerator';

describe('MirrorGenerator', () => {
  const generator = new MirrorGenerator();

  it('generates a mirror from artifact content', () => {
    const mirror = generator.generate({
      artifactId: 'art-1',
      artifactType: 'intent_bloom',
      content: {
        candidate_product_concepts: [
          { id: 'c1', name: 'TaskFlow' },
        ],
      },
    });

    expect(mirror.artifactId).toBe('art-1');
    expect(mirror.artifactType).toBe('intent_bloom');
    expect(mirror.fields.length).toBeGreaterThan(0);
    expect(mirror.renderedFieldCount).toBe(mirror.fields.length);
  });

  it('formats field labels from snake_case to Title Case', () => {
    const mirror = generator.generate({
      artifactId: 'art-1',
      artifactType: 'test',
      content: { product_concept: 'hello', user_stories: [] },
    });

    const labels = mirror.fields.map(f => f.label);
    expect(labels).toContain('Product Concept');
    expect(labels).toContain('User Stories');
  });

  it('annotates System-Proposed Content items', () => {
    const mirror = generator.generate({
      artifactId: 'art-1',
      artifactType: 'intent_bloom',
      content: {},
      systemProposedItems: [
        { field: 'mission', content: 'Proposed mission statement', approvalStatus: 'pending' },
      ],
    });

    const proposed = mirror.fields.find(f => f.annotation === 'system_proposed');
    expect(proposed).toBeDefined();
    expect(proposed!.annotationText).toContain('SYSTEM-PROPOSED');
    expect(proposed!.requiresApproval).toBe(true);
    expect(mirror.systemProposedContentCount).toBe(1);
  });

  it('does not require approval for already-approved System-Proposed items', () => {
    const mirror = generator.generate({
      artifactId: 'art-1',
      artifactType: 'test',
      content: {},
      systemProposedItems: [
        { field: 'vision', content: 'Approved vision', approvalStatus: 'approved' },
      ],
    });

    const proposed = mirror.fields.find(f => f.annotation === 'system_proposed');
    expect(proposed!.requiresApproval).toBe(false);
  });

  it('annotates prior decision conflicts', () => {
    const mirror = generator.generate({
      artifactId: 'art-1',
      artifactType: 'test',
      content: {},
      priorDecisionConflicts: [
        {
          candidateId: 'c1',
          priorDecisionRecordId: 'prior-1',
          priorDecisionAuthorityLevel: 6,
          conflictDescription: 'Changes the auth approach',
        },
      ],
    });

    const conflict = mirror.fields.find(f => f.annotation === 'prior_decision_conflict');
    expect(conflict).toBeDefined();
    expect(conflict!.annotationText).toContain('CONFLICTS WITH PRIOR DECISION');
    expect(conflict!.annotationText).toContain('prior-1');
    expect(mirror.priorDecisionConflictCount).toBe(1);
  });

  it('annotates assumptions', () => {
    const mirror = generator.generate({
      artifactId: 'art-1',
      artifactType: 'test',
      content: {},
      assumptions: [
        { assumption: 'Web-based application', basis: 'Not specified, defaulting to web' },
      ],
    });

    const assumption = mirror.fields.find(f => f.annotation === 'assumption');
    expect(assumption).toBeDefined();
    expect(assumption!.annotationText).toContain('ASSUMPTION');
    expect(mirror.assumptionCount).toBe(1);
  });

  it('includes invariant violation header when present', () => {
    const mirror = generator.generate({
      artifactId: 'art-1',
      artifactType: 'test',
      content: { name: 'test' },
      priorInvariantViolations: ['CM-001: Component Responsibility contains conjunction'],
    });

    const header = mirror.fields[0];
    expect(header.label).toContain('PRIOR INVARIANT VIOLATION');
    expect(header.value).toContain('CM-001');
  });
});
