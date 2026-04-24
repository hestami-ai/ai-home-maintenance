/**
 * Unit tests for Phase 1.3c coverage verifier.
 * All tests operate on fabricated minimal inputs — no DB, no LLM.
 */

import { describe, it, expect } from 'vitest';
import { verifyCoverage, type CoverageVerifierInputs } from '../../../../lib/orchestrator/phases/phase1/verifyCoverage';
import type { UserJourney, WorkflowV2, Persona, Integration } from '../../../../lib/types/records';

function persona(id: string): Persona {
  return { id, name: `Persona ${id}`, description: 'x', goals: [], painPoints: [] };
}
function journey(opts: Partial<UserJourney> & { id: string; personaId: string }): UserJourney {
  return {
    title: opts.title ?? 'J',
    scenario: opts.scenario ?? 's',
    acceptanceCriteria: opts.acceptanceCriteria ?? ['ok'],
    implementationPhase: opts.implementationPhase ?? 'Phase 1',
    steps: opts.steps ?? [{ stepNumber: 1, actor: opts.personaId, action: 'a', expectedOutcome: 'o' }],
    ...opts,
  };
}
function workflow(opts: Partial<WorkflowV2> & { id: string; businessDomainId: string }): WorkflowV2 {
  return {
    name: 'W',
    description: 'd',
    steps: opts.steps ?? [{ stepNumber: 1, actor: 'System', action: 'a', expectedOutcome: 'o' }],
    triggers: opts.triggers ?? [{ kind: 'schedule', cadence: 'daily' }],
    actors: opts.actors ?? ['System'],
    backs_journeys: opts.backs_journeys ?? [],
    ...opts,
  };
}
function integration(id: string): Integration {
  return { id, name: id, category: 'generic', description: 'x', standardProviders: [], ownershipModel: 'consumed', rationale: 'x' };
}

function minimalInputs(partial: Partial<CoverageVerifierInputs> = {}): CoverageVerifierInputs {
  return {
    personas: partial.personas ?? [],
    domainIds: partial.domainIds ?? [],
    journeys: partial.journeys ?? [],
    workflows: partial.workflows ?? [],
    complianceItems: partial.complianceItems ?? [],
    retentionRules: partial.retentionRules ?? [],
    vvRequirements: partial.vvRequirements ?? [],
    integrations: partial.integrations ?? [],
    vocabulary: partial.vocabulary ?? [],
    ...partial,
  };
}

describe('verifyCoverage — persona coverage', () => {
  it('passes when every persona initiates a journey', () => {
    const r = verifyCoverage(minimalInputs({
      personas: [persona('P-1'), persona('P-2')],
      journeys: [journey({ id: 'UJ-1', personaId: 'P-1' }), journey({ id: 'UJ-2', personaId: 'P-2' })],
    }));
    expect(r.filter(g => g.check === 'persona_coverage')).toHaveLength(0);
  });
  it('reports gap when a persona has no journey', () => {
    const r = verifyCoverage(minimalInputs({
      personas: [persona('P-1'), persona('P-2')],
      journeys: [journey({ id: 'UJ-1', personaId: 'P-1' })],
    }));
    const gap = r.find(g => g.check === 'persona_coverage');
    expect(gap).toBeDefined();
    expect(gap!.missing).toEqual(['P-2']);
    // Wave 7 tuning: persona coverage is advisory (propose-and-prune
    // philosophy — human decides, not blocked by verifier).
    expect(gap!.severity).toBe('advisory');
  });
  it('does not report gap for explicitly unreached personas', () => {
    const r = verifyCoverage(minimalInputs({
      personas: [persona('P-1'), persona('P-2')],
      journeys: [journey({ id: 'UJ-1', personaId: 'P-1' })],
      bloomExplicitlyUnreachedPersonas: ['P-2'],
    }));
    expect(r.filter(g => g.check === 'persona_coverage')).toHaveLength(0);
  });
});

describe('verifyCoverage — automatable step backing', () => {
  it('passes when every automatable step has a workflow trigger', () => {
    const r = verifyCoverage(minimalInputs({
      personas: [persona('P-1')],
      domainIds: ['DOM-X'],
      journeys: [journey({
        id: 'UJ-1', personaId: 'P-1',
        steps: [
          { stepNumber: 1, actor: 'P-1', action: 'a', expectedOutcome: 'o', automatable: false },
          { stepNumber: 2, actor: 'System', action: 'a', expectedOutcome: 'o', automatable: true },
        ],
      })],
      workflows: [workflow({
        id: 'WF-1', businessDomainId: 'DOM-X',
        triggers: [{ kind: 'journey_step', journey_id: 'UJ-1', step_number: 2 }],
        backs_journeys: ['UJ-1'],
      })],
    }));
    expect(r.filter(g => g.check === 'automatable_step_backing')).toHaveLength(0);
  });
  it('reports gap when an automatable step has no backing workflow', () => {
    const r = verifyCoverage(minimalInputs({
      personas: [persona('P-1')],
      domainIds: ['DOM-X'],
      journeys: [journey({
        id: 'UJ-1', personaId: 'P-1',
        steps: [
          { stepNumber: 1, actor: 'System', action: 'a', expectedOutcome: 'o', automatable: true },
        ],
      })],
      workflows: [],
    }));
    const gap = r.find(g => g.check === 'automatable_step_backing');
    expect(gap).toBeDefined();
    expect(gap!.missing).toEqual(['UJ-1#1']);
  });
});

describe('verifyCoverage — referential integrity on triggers', () => {
  it('does NOT report a gap when a journey_step trigger targets a non-automatable step (Wave 7: workflow backing implicitly promotes the step)', () => {
    const r = verifyCoverage(minimalInputs({
      personas: [persona('P-1')],
      domainIds: ['DOM-X'],
      journeys: [journey({
        id: 'UJ-1', personaId: 'P-1',
        steps: [{ stepNumber: 1, actor: 'P-1', action: 'a', expectedOutcome: 'o', automatable: false }],
      })],
      workflows: [workflow({
        id: 'WF-1', businessDomainId: 'DOM-X',
        triggers: [{ kind: 'journey_step', journey_id: 'UJ-1', step_number: 1 }],
        backs_journeys: ['UJ-1'],
      })],
    }));
    expect(r.find(g => g.check === 'referential_integrity_workflow_triggers')).toBeUndefined();
  });
  it('reports a gap for a journey_step trigger pointing at a non-existent step', () => {
    const r = verifyCoverage(minimalInputs({
      personas: [persona('P-1')],
      domainIds: ['DOM-X'],
      journeys: [journey({
        id: 'UJ-1', personaId: 'P-1',
        steps: [{ stepNumber: 1, actor: 'P-1', action: 'a', expectedOutcome: 'o', automatable: false }],
      })],
      workflows: [workflow({
        id: 'WF-1', businessDomainId: 'DOM-X',
        triggers: [{ kind: 'journey_step', journey_id: 'UJ-1', step_number: 99 }],
        backs_journeys: ['UJ-1'],
      })],
    }));
    expect(r.find(g => g.check === 'referential_integrity_workflow_triggers')).toBeDefined();
  });
  it('reports gap for an integration trigger pointing at unaccepted integration', () => {
    const r = verifyCoverage(minimalInputs({
      domainIds: ['DOM-X'],
      integrations: [integration('INT-KNOWN')],
      workflows: [workflow({
        id: 'WF-1', businessDomainId: 'DOM-X',
        triggers: [{ kind: 'integration', integration_id: 'INT-UNKNOWN', event: 'e' }],
        backs_journeys: [],
      })],
    }));
    expect(r.find(g => g.check === 'referential_integrity_workflow_triggers')).toBeDefined();
  });
});

describe('verifyCoverage — backs_journeys cache correctness', () => {
  it('reports gap when backs_journeys is missing a journey derivable from triggers', () => {
    const r = verifyCoverage(minimalInputs({
      personas: [persona('P-1')],
      domainIds: ['DOM-X'],
      journeys: [journey({
        id: 'UJ-1', personaId: 'P-1',
        steps: [{ stepNumber: 1, actor: 'System', action: 'a', expectedOutcome: 'o', automatable: true }],
      })],
      workflows: [workflow({
        id: 'WF-1', businessDomainId: 'DOM-X',
        triggers: [{ kind: 'journey_step', journey_id: 'UJ-1', step_number: 1 }],
        backs_journeys: [],
      })],
    }));
    expect(r.find(g => g.check === 'referential_integrity_backs_journeys')).toBeDefined();
  });
});
