import { describe, it, expect } from 'vitest';
import { ConsistencyChecker } from '../../../lib/agents/consistencyChecker';
import { LLMCaller } from '../../../lib/llm/llmCaller';

describe('ConsistencyChecker', () => {
  // Use LLMCaller with no providers — only test deterministic traceability
  const checker = new ConsistencyChecker(new LLMCaller({ maxRetries: 0 }));

  describe('checkTraceability', () => {
    it('passes when all source values have matching targets', () => {
      const results = checker.checkTraceability({
        artifacts: [
          {
            id: 'fr-1', type: 'functional_requirements',
            content: {
              user_stories: [{ id: 'US-1' }, { id: 'US-2' }],
            },
          },
          {
            id: 'sr-1', type: 'system_requirements',
            content: {
              items: [
                { id: 'SR-1', source_requirement_ids: ['US-1'] },
                { id: 'SR-2', source_requirement_ids: ['US-2'] },
              ],
            },
          },
        ],
        traceabilityAssertions: [{
          id: 'TA-001',
          description: 'Every FR maps to at least one SR',
          sourceField: 'user_stories[*].id',
          targetField: 'items[*].source_requirement_ids[*]',
          sourceArtifactType: 'functional_requirements',
          targetArtifactType: 'system_requirements',
        }],
        phaseId: '3',
      });

      expect(results).toHaveLength(1);
      expect(results[0].pass).toBe(true);
      expect(results[0].failures).toHaveLength(0);
    });

    it('fails when a source value has no matching target', () => {
      const results = checker.checkTraceability({
        artifacts: [
          {
            id: 'fr-1', type: 'functional_requirements',
            content: {
              user_stories: [{ id: 'US-1' }, { id: 'US-2' }, { id: 'US-3' }],
            },
          },
          {
            id: 'sr-1', type: 'system_requirements',
            content: {
              items: [
                { id: 'SR-1', source_requirement_ids: ['US-1'] },
                // US-2 and US-3 have no matching SR
              ],
            },
          },
        ],
        traceabilityAssertions: [{
          id: 'TA-001',
          description: 'Every FR maps to at least one SR',
          sourceField: 'user_stories[*].id',
          targetField: 'items[*].source_requirement_ids[*]',
          sourceArtifactType: 'functional_requirements',
          targetArtifactType: 'system_requirements',
        }],
        phaseId: '3',
      });

      expect(results[0].pass).toBe(false);
      expect(results[0].failures).toHaveLength(2);
      expect(results[0].failures[0].itemId).toBe('US-2');
      expect(results[0].failures[1].itemId).toBe('US-3');
    });

    it('fails when a required artifact is missing', () => {
      const results = checker.checkTraceability({
        artifacts: [
          {
            id: 'fr-1', type: 'functional_requirements',
            content: { user_stories: [{ id: 'US-1' }] },
          },
          // system_requirements artifact missing
        ],
        traceabilityAssertions: [{
          id: 'TA-001',
          description: 'Every FR maps to at least one SR',
          sourceField: 'user_stories[*].id',
          targetField: 'items[*].source_requirement_ids[*]',
          sourceArtifactType: 'functional_requirements',
          targetArtifactType: 'system_requirements',
        }],
        phaseId: '3',
      });

      expect(results[0].pass).toBe(false);
      expect(results[0].failures[0].explanation).toContain('Missing artifact');
    });

    it('handles multiple assertions independently', () => {
      const results = checker.checkTraceability({
        artifacts: [
          {
            id: 'cm-1', type: 'component_model',
            content: { components: [{ id: 'C-1' }] },
          },
          {
            id: 'sr-1', type: 'system_requirements',
            content: { items: [{ id: 'SR-1', allocated_component: 'C-1' }] },
          },
        ],
        traceabilityAssertions: [
          {
            id: 'TA-001',
            description: 'Every SR allocated to a component',
            sourceField: 'items[*].id',
            targetField: 'components[*].id',
            sourceArtifactType: 'system_requirements',
            targetArtifactType: 'component_model',
          },
          {
            id: 'TA-002',
            description: 'Every component has an SR',
            sourceField: 'components[*].id',
            targetField: 'items[*].allocated_component',
            sourceArtifactType: 'component_model',
            targetArtifactType: 'system_requirements',
          },
        ],
        phaseId: '4',
      });

      expect(results).toHaveLength(2);
      // TA-001: SR-1 → C-1 exists in component_model ✓
      // TA-002: C-1 → SR items[*].allocated_component ✓
    });
  });
});
