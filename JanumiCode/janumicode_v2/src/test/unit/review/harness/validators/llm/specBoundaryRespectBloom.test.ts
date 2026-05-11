import { describe, it, expect } from 'vitest';
import { invokeSpecBoundaryRespectBloom } from '../../../../../../lib/review/harness/validators/llm/specBoundaryRespectBloom';
import { runFactoryContractSuite } from './_factoryTestUtils';
import { emptyResult, makeLLMCaller, makeLoader, makeRuntime, makeContext } from './_helpers';

runFactoryContractSuite(
  'spec_boundary_respect_bloom',
  invokeSpecBoundaryRespectBloom,
  { runtime: { agentRole: 'domain_interpreter', subPhaseId: 'business_domains_bloom' } },
);

describe('spec_boundary_respect_bloom (preprocessGrounding)', () => {
  it('renders intent_discovery decisions and technical_constraints into the system prompt', async () => {
    const { caller, callMock } = makeLLMCaller(async () => emptyResult({ parsed: { findings: [] } }));
    const renderMock = vi_render_mock_capture();
    const findings = await invokeSpecBoundaryRespectBloom(
      makeRuntime({
        agentRole: 'domain_interpreter',
        subPhaseId: 'business_domains_bloom',
        priorArtifactsByKind: new Map<string, ReadonlyArray<Record<string, unknown>>>([
          [
            'intent_discovery',
            [
              {
                kind: 'intent_discovery',
                decisions: [
                  { id: 'DEC-5', type: 'DECISION', text: 'No rate limiting implemented on submissions' },
                  { id: 'DEC-2', type: 'DECISION', text: 'No user accounts or login authentication required' },
                ],
              },
            ],
          ],
          [
            'technical_constraints_discovery',
            [
              {
                kind: 'technical_constraints_discovery',
                technicalConstraints: [
                  { id: 'TECH-POSTGRES-16', category: 'database', text: 'Postgres 16+ on a single managed instance.' },
                  { id: 'TECH-CONTAINER-MONOLITH', category: 'deployment', text: 'a single containerised service; no microservices.' },
                ],
              },
            ],
          ],
        ]),
      }),
      caller,
      renderMock.loader,
      makeContext(),
    );
    expect(findings).toEqual([]);
    expect(callMock).toHaveBeenCalled();
    const renderVars = renderMock.lastVars();
    expect(renderVars.DISCOVERY_DECISIONS).toContain('DEC-5');
    expect(renderVars.DISCOVERY_DECISIONS).toContain('No rate limiting');
    expect(renderVars.DISCOVERY_DECISIONS).toContain('DEC-2');
    expect(renderVars.TECHNICAL_CONSTRAINTS).toContain('TECH-POSTGRES-16');
    expect(renderVars.TECHNICAL_CONSTRAINTS).toContain('TECH-CONTAINER-MONOLITH');
    expect(renderVars.TECHNICAL_CONSTRAINTS).toContain('no microservices');
  });

  it('emits stable placeholders when prior artifacts are missing', async () => {
    const { caller } = makeLLMCaller(async () => emptyResult({ parsed: { findings: [] } }));
    const renderMock = vi_render_mock_capture();
    await invokeSpecBoundaryRespectBloom(
      makeRuntime({
        agentRole: 'domain_interpreter',
        subPhaseId: 'business_domains_bloom',
        // priorArtifactsByKind absent
      }),
      caller,
      renderMock.loader,
      makeContext(),
    );
    const renderVars = renderMock.lastVars();
    expect(renderVars.DISCOVERY_DECISIONS).toContain('no product_intent_discovery artifact');
    expect(renderVars.TECHNICAL_CONSTRAINTS).toContain('no technical_constraints_discovery artifact');
  });

  it('handles an artifact with empty decisions array', async () => {
    const { caller } = makeLLMCaller(async () => emptyResult({ parsed: { findings: [] } }));
    const renderMock = vi_render_mock_capture();
    await invokeSpecBoundaryRespectBloom(
      makeRuntime({
        agentRole: 'domain_interpreter',
        subPhaseId: 'business_domains_bloom',
        priorArtifactsByKind: new Map<string, ReadonlyArray<Record<string, unknown>>>([
          ['intent_discovery', [{ kind: 'intent_discovery', decisions: [] }]],
          ['technical_constraints_discovery', [{ kind: 'technical_constraints_discovery', technicalConstraints: [] }]],
        ]),
      }),
      caller,
      renderMock.loader,
      makeContext(),
    );
    const renderVars = renderMock.lastVars();
    expect(renderVars.DISCOVERY_DECISIONS).toContain('no decisions captured');
    expect(renderVars.TECHNICAL_CONSTRAINTS).toContain('no technical constraints extracted');
  });
});

/**
 * Helper: build a TemplateLoader mock that captures the variables passed
 * to render(), so tests can assert what preprocessGrounding produced.
 */
function vi_render_mock_capture() {
  let lastVars: Record<string, string> = {};
  const loader = {
    findTemplate: () => ({
      metadata: { required_variables: [] },
      body: 'sys',
      path: 't',
    }),
    render: (_template: unknown, vars: Record<string, string>) => {
      lastVars = vars;
      return { rendered: 'sys', missing_variables: [] };
    },
  } as unknown as import('../../../../../../lib/orchestrator/templateLoader').TemplateLoader;
  return { loader, lastVars: () => lastVars };
}
