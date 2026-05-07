import { describe, it, expect } from 'vitest';
import { invokeTierAssignmentAudit } from '../../../../../../lib/review/harness/validators/llm/tierAssignmentAudit';
import { makeRuntime, makeLLMCaller, makeLoader, makeContext, emptyResult } from './_helpers';

describe('tier_assignment_audit (LLM validator)', () => {
  it('returns [] when LLM responds with empty findings', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({ parsed: { passed: true, findings: [] } }),
    );
    const findings = await invokeTierAssignmentAudit(
      makeRuntime({
        agentRole: 'requirements_agent',
        subPhaseId: 'fr_saturation',
        outputContent: {
          parent_branch_classification: 'decomposable',
          children: [{ id: 'c1', tier: 'C', description: 'payment validation' }],
        },
      }),
      caller,
      makeLoader(),
      makeContext(),
    );
    expect(findings).toEqual([]);
  });

  it('surfaces HIGH finding from LLM response', async () => {
    const { caller } = makeLLMCaller(async () =>
      emptyResult({
        parsed: {
          passed: false,
          findings: [
            {
              severity: 'HIGH',
              type: 'tier_cross_class_violation',
              summary: 'Tier D assigned to quality attribute',
              location: '$.children[0].tier',
              childId: 'c1',
              assignedTier: 'D',
              expectedTier: 'A',
              detail: 'Quality attributes should be Tier A.',
              recommendation: 'Reclassify to Tier A.',
            },
          ],
        },
      }),
    );
    const findings = await invokeTierAssignmentAudit(
      makeRuntime({
        agentRole: 'requirements_agent',
        subPhaseId: 'fr_saturation',
      }),
      caller,
      makeLoader(),
      makeContext(),
    );
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].validatorId).toBe('tier_assignment_audit');
  });

  it('returns [] and pushes failure when template not found', async () => {
    const { caller } = makeLLMCaller();
    const ctx = makeContext();
    const findings = await invokeTierAssignmentAudit(
      makeRuntime(),
      caller,
      makeLoader(false), // no template found
      ctx,
    );
    expect(findings).toEqual([]);
    expect(ctx.failures.length).toBeGreaterThan(0);
  });
});
