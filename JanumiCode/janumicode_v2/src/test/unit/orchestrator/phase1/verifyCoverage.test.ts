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

// ── Characterization test (pins referential-integrity behavior across
//    ALL nine categories before/after the S3776 decomposition of
//    checkReferentialIntegrity). Order-independent set comparison on
//    `missing` avoids coupling to the localeCompare sort used by mkGap;
//    the ORDER of the emitted checks (deterministic addGap sequence) is
//    asserted explicitly. ────────────────────────────────────────────
describe('verifyCoverage — referential integrity characterization (all categories)', () => {
  // A journey that violates every journey-side referential rule at once.
  const badJourney = {
    id: 'UJ-1',
    personaId: 'P-BAD',                 // not an accepted persona
    title: 'J', scenario: 's', acceptanceCriteria: ['ok'], implementationPhase: 'Phase 1',
    businessDomainIds: ['DOM-BAD'],     // not an accepted domain
    steps: [
      { stepNumber: 1, actor: 'P-BAD2', action: 'a', expectedOutcome: 'o' },   // unaccepted persona actor
      { stepNumber: 2, actor: 'INT-BAD', action: 'a', expectedOutcome: 'o' },  // unaccepted integration actor
      { stepNumber: 3, actor: 'System', action: 'a', expectedOutcome: 'o' },   // System → skipped
    ],
    surfaces: {
      compliance_regimes: ['COMP-BAD'],
      retention_rules: ['RET-BAD'],
      vv_requirements: ['VV-BAD'],
      integrations: ['INT-BADSURF'],
    },
  } as unknown as UserJourney;

  // A workflow that violates every workflow-side referential rule at once.
  const badWorkflow = {
    id: 'WF-1',
    businessDomainId: 'DOM-BAD',        // not an accepted domain
    name: 'W', description: 'd',
    steps: [
      { stepNumber: 1, actor: 'P-BADW', action: 'a', expectedOutcome: 'o' },   // unaccepted persona actor
      { stepNumber: 2, actor: 'INT-BADW', action: 'a', expectedOutcome: 'o' }, // unaccepted integration actor
    ],
    triggers: [{ kind: 'integration', integration_id: 'INT-UNKNOWN', event: 'e' }], // unaccepted integration
    actors: ['System'],
    backs_journeys: ['UJ-EXTRA'],       // extra id not derivable from triggers
    surfaces: {
      compliance_regimes: ['COMP-BADW'],
      retention_rules: ['RET-BADW'],
      vv_requirements: ['VV-BADW'],
      integrations: ['INT-BADWSURF'],
    },
  } as unknown as WorkflowV2;

  const result = verifyCoverage(minimalInputs({
    personas: [persona('P-1')],
    domainIds: ['DOM-X'],
    integrations: [integration('INT-KNOWN')],
    complianceItems: [{ id: 'COMP-1', type: 'REQUIREMENT', text: 'x', timestamp: 't' }],
    retentionRules: [{ id: 'RET-1', type: 'REQUIREMENT', text: 'x', timestamp: 't' }],
    vvRequirements: [{ id: 'VV-1', category: 'performance', target: 't', measurement: 'm' }],
    journeys: [badJourney],
    workflows: [badWorkflow],
  }));

  const refGaps = result.filter(g => g.check.startsWith('referential_integrity_'));
  const byCheck = Object.fromEntries(refGaps.map(g => [g.check, g]));
  const asSet = (xs: string[]) => [...xs].sort();

  it('emits exactly the nine referential-integrity checks in deterministic order', () => {
    expect(refGaps.map(g => g.check)).toEqual([
      'referential_integrity_journey_persona',
      'referential_integrity_journey_domain',
      'referential_integrity_journey_step_actor',
      'referential_integrity_journey_surfaces',
      'referential_integrity_workflow_domain',
      'referential_integrity_workflow_triggers',
      'referential_integrity_workflow_step_actor',
      'referential_integrity_workflow_surfaces',
      'referential_integrity_backs_journeys',
    ]);
  });

  it('tags every referential gap blocking with empty expected/actual', () => {
    for (const g of refGaps) {
      expect(g.severity).toBe('blocking');
      expect(g.expected).toEqual([]);
      expect(g.actual).toEqual([]);
    }
  });

  it('collects the exact offender set for each journey-side category', () => {
    expect(asSet(byCheck['referential_integrity_journey_persona'].missing))
      .toEqual(asSet(['UJ-1:P-BAD']));
    expect(asSet(byCheck['referential_integrity_journey_domain'].missing))
      .toEqual(asSet(['UJ-1:DOM-BAD']));
    expect(asSet(byCheck['referential_integrity_journey_step_actor'].missing))
      .toEqual(asSet(['UJ-1#1:P-BAD2', 'UJ-1#2:INT-BAD']));
    expect(asSet(byCheck['referential_integrity_journey_surfaces'].missing))
      .toEqual(asSet([
        'UJ-1:compliance:COMP-BAD',
        'UJ-1:retention:RET-BAD',
        'UJ-1:vv:VV-BAD',
        'UJ-1:integration:INT-BADSURF',
      ]));
  });

  it('collects the exact offender set for each workflow-side category', () => {
    expect(asSet(byCheck['referential_integrity_workflow_domain'].missing))
      .toEqual(asSet(['WF-1:DOM-BAD']));
    expect(asSet(byCheck['referential_integrity_workflow_triggers'].missing))
      .toEqual(asSet(['WF-1:integration:INT-UNKNOWN:integration-not-accepted']));
    expect(asSet(byCheck['referential_integrity_workflow_step_actor'].missing))
      .toEqual(asSet(['WF-1#1:P-BADW', 'WF-1#2:INT-BADW']));
    expect(asSet(byCheck['referential_integrity_workflow_surfaces'].missing))
      .toEqual(asSet([
        'WF-1:compliance:COMP-BADW',
        'WF-1:retention:RET-BADW',
        'WF-1:vv:VV-BADW',
        'WF-1:integration:INT-BADWSURF',
      ]));
    expect(asSet(byCheck['referential_integrity_backs_journeys'].missing))
      .toEqual(asSet(['WF-1:extra-in-backs_journeys:UJ-EXTRA']));
  });

  it('does not resolve accepted retention ids to a gap when surfaced ids are unaccepted', () => {
    // A retention surface id counts as valid if it is in retentionIds OR
    // complianceIds; here neither holds for RET-BAD/RET-BADW so both fail.
    expect(byCheck['referential_integrity_journey_surfaces'].missing)
      .toContain('UJ-1:retention:RET-BAD');
    expect(byCheck['referential_integrity_workflow_surfaces'].missing)
      .toContain('WF-1:retention:RET-BADW');
  });
});
