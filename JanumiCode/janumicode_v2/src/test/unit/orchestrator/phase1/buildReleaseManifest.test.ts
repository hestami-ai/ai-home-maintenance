/**
 * Unit tests for Phase 1.8 deterministic manifest builder.
 *
 * Covers the Path C design: LLM output is narrow (releases + journey
 * placement); buildReleaseManifest deterministically assigns workflows,
 * entities, compliance, integrations, and vocabulary.
 */

import { describe, it, expect } from 'vitest';
import {
  buildReleaseManifest,
  type LlmReleaseSkeleton,
  type BuildManifestInputs,
} from '../../../../lib/orchestrator/phases/phase1/buildReleaseManifest';
import type {
  Entity,
  Integration,
  UserJourney,
  VocabularyTerm,
  WorkflowV2,
} from '../../../../lib/types/records';

// ── Fixture helpers ────────────────────────────────────────────────

function journey(id: string, opts: { domains?: string[] } = {}): UserJourney {
  return {
    id,
    personaId: 'P-X',
    title: id,
    scenario: 's',
    steps: [{ stepNumber: 1, actor: 'P-X', action: 'a', expectedOutcome: 'o' }],
    acceptanceCriteria: ['ac'],
    implementationPhase: 'Phase 1',
    ...({ businessDomainIds: opts.domains ?? [] } as object),
  };
}

function workflow(opts: {
  id: string;
  domain?: string;
  triggers?: WorkflowV2['triggers'];
}): WorkflowV2 {
  return {
    id: opts.id,
    businessDomainId: opts.domain ?? 'DOM-X',
    name: opts.id,
    description: 'd',
    steps: [{ stepNumber: 1, actor: 'System', action: 'a', expectedOutcome: 'o' }],
    triggers: opts.triggers ?? [{ kind: 'schedule', cadence: 'daily' }],
    actors: ['System'],
    backs_journeys: [],
  };
}

function entity(id: string, domain: string): Entity {
  return { id, businessDomainId: domain, name: id, description: 'd', keyAttributes: [], relationships: [] };
}

function integration(id: string): Integration {
  return { id, name: id, category: 'generic', description: 'd', standardProviders: [], ownershipModel: 'consumed', rationale: 'r' };
}

function voc(id: string): VocabularyTerm {
  return { id, term: id, definition: 'd' };
}

function skeleton(id: string, ordinal: number, journeys: string[]): LlmReleaseSkeleton {
  return {
    release_id: id,
    ordinal,
    name: `Release ${ordinal}`,
    description: `d`,
    rationale: 'r',
    contains_journeys: journeys,
  };
}

function inputs(partial: Partial<BuildManifestInputs> = {}): BuildManifestInputs {
  return {
    releases: partial.releases ?? [skeleton('REL-1', 1, [])],
    journeys: partial.journeys ?? [],
    workflows: partial.workflows ?? [],
    entities: partial.entities ?? [],
    complianceIds: partial.complianceIds ?? [],
    integrations: partial.integrations ?? [],
    vocabulary: partial.vocabulary ?? [],
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('buildReleaseManifest — journey placement', () => {
  it('places each journey in the release the LLM chose', () => {
    const r = buildReleaseManifest(inputs({
      releases: [
        skeleton('REL-1', 1, ['UJ-A']),
        skeleton('REL-2', 2, ['UJ-B']),
      ],
      journeys: [journey('UJ-A'), journey('UJ-B')],
    }));
    expect(r.releases[0].contains.journeys).toEqual(['UJ-A']);
    expect(r.releases[1].contains.journeys).toEqual(['UJ-B']);
    expect(r.unplacedJourneys).toEqual([]);
  });

  it('silently skips LLM-invented journey ids not in the accepted set', () => {
    const r = buildReleaseManifest(inputs({
      releases: [skeleton('REL-1', 1, ['UJ-A', 'UJ-INVENTED'])],
      journeys: [journey('UJ-A')],
    }));
    expect(r.releases[0].contains.journeys).toEqual(['UJ-A']);
    expect(r.unplacedJourneys).toEqual([]);
  });

  it('defaults un-placed accepted journeys to the first release and reports them', () => {
    const r = buildReleaseManifest(inputs({
      releases: [
        skeleton('REL-1', 1, ['UJ-A']),
        skeleton('REL-2', 2, []),
      ],
      journeys: [journey('UJ-A'), journey('UJ-B')],
    }));
    expect(r.releases[0].contains.journeys).toEqual(['UJ-A', 'UJ-B']);
    expect(r.unplacedJourneys).toEqual(['UJ-B']);
  });

  it('gives first placement priority when the LLM double-places a journey', () => {
    const r = buildReleaseManifest(inputs({
      releases: [
        skeleton('REL-1', 1, ['UJ-A']),
        skeleton('REL-2', 2, ['UJ-A']),
      ],
      journeys: [journey('UJ-A')],
    }));
    expect(r.releases[0].contains.journeys).toEqual(['UJ-A']);
    expect(r.releases[1].contains.journeys).toEqual([]);
  });

  it('normalizes ordinals to contiguous 1..N', () => {
    const r = buildReleaseManifest(inputs({
      releases: [
        skeleton('REL-A', 5, []),
        skeleton('REL-B', 2, []),
      ],
    }));
    expect(r.releases.map(x => x.ordinal)).toEqual([1, 2]);
  });
});

describe('buildReleaseManifest — workflow assignment via journey_step triggers', () => {
  it('places a workflow in the earliest release containing any backed journey', () => {
    const r = buildReleaseManifest(inputs({
      releases: [
        skeleton('REL-1', 1, ['UJ-EARLY']),
        skeleton('REL-2', 2, ['UJ-LATE']),
      ],
      journeys: [journey('UJ-EARLY'), journey('UJ-LATE')],
      workflows: [workflow({
        id: 'WF-MULTI',
        triggers: [
          { kind: 'journey_step', journey_id: 'UJ-LATE', step_number: 1 },
          { kind: 'journey_step', journey_id: 'UJ-EARLY', step_number: 1 },
        ],
      })],
    }));
    // Earliest-ordinal wins (REL-1).
    expect(r.releases[0].contains.workflows).toEqual(['WF-MULTI']);
    expect(r.releases[1].contains.workflows).toEqual([]);
    expect(r.crossCutting.workflows).toEqual([]);
  });

  it('defaults a workflow to cross_cutting when it has no journey_step triggers', () => {
    const r = buildReleaseManifest(inputs({
      releases: [skeleton('REL-1', 1, [])],
      workflows: [workflow({
        id: 'WF-NIGHTLY',
        triggers: [{ kind: 'schedule', cadence: 'daily' }],
      })],
    }));
    expect(r.releases[0].contains.workflows).toEqual([]);
    expect(r.crossCutting.workflows).toEqual(['WF-NIGHTLY']);
  });

  it('falls back to cross_cutting when journey_step triggers all point at un-placed journeys', () => {
    const r = buildReleaseManifest(inputs({
      releases: [skeleton('REL-1', 1, [])],
      // No accepted journeys — the workflow's journey_step trigger resolves
      // to a journey that's not in the accepted set, so no release claim.
      workflows: [workflow({
        id: 'WF-ORPHAN',
        triggers: [{ kind: 'journey_step', journey_id: 'UJ-GHOST', step_number: 1 }],
      })],
    }));
    expect(r.crossCutting.workflows).toEqual(['WF-ORPHAN']);
  });
});

describe('buildReleaseManifest — entity assignment via domain', () => {
  it('places an entity in the earliest release containing any journey in its domain', () => {
    const r = buildReleaseManifest(inputs({
      releases: [
        skeleton('REL-1', 1, ['UJ-A']),
        skeleton('REL-2', 2, ['UJ-B']),
      ],
      journeys: [
        journey('UJ-A', { domains: ['DOM-EARLY'] }),
        journey('UJ-B', { domains: ['DOM-LATE'] }),
      ],
      entities: [entity('ENT-EARLY', 'DOM-EARLY'), entity('ENT-LATE', 'DOM-LATE')],
    }));
    expect(r.releases[0].contains.entities).toEqual(['ENT-EARLY']);
    expect(r.releases[1].contains.entities).toEqual(['ENT-LATE']);
    expect(r.orphanEntities).toEqual([]);
  });

  it('also considers workflow placement when deciding entity domain earliest-release', () => {
    const r = buildReleaseManifest(inputs({
      releases: [
        skeleton('REL-1', 1, ['UJ-A']),
        skeleton('REL-2', 2, []),
      ],
      journeys: [journey('UJ-A', { domains: ['DOM-JOURNEY'] })],
      workflows: [workflow({
        id: 'WF-1',
        domain: 'DOM-WORKFLOW',
        triggers: [{ kind: 'journey_step', journey_id: 'UJ-A', step_number: 1 }],
      })],
      entities: [entity('ENT-VIA-WF', 'DOM-WORKFLOW')],
    }));
    expect(r.releases[0].contains.entities).toEqual(['ENT-VIA-WF']);
  });

  it('defaults orphan entities (no domain surface) to the first release and reports them', () => {
    const r = buildReleaseManifest(inputs({
      releases: [skeleton('REL-1', 1, ['UJ-A'])],
      journeys: [journey('UJ-A', { domains: ['DOM-X'] })],
      entities: [entity('ENT-ORPHAN', 'DOM-UNREACHED')],
    }));
    expect(r.releases[0].contains.entities).toEqual(['ENT-ORPHAN']);
    expect(r.orphanEntities).toEqual(['ENT-ORPHAN']);
  });
});

describe('buildReleaseManifest — compliance assignment', () => {
  it('defaults compliance items to cross_cutting when no workflow references them', () => {
    const r = buildReleaseManifest(inputs({
      releases: [skeleton('REL-1', 1, [])],
      complianceIds: ['COMP-GDPR', 'COMP-HIPAA'],
    }));
    expect(r.crossCutting.compliance).toEqual(['COMP-GDPR', 'COMP-HIPAA']);
    expect(r.releases[0].contains.compliance).toEqual([]);
  });

  it('places a compliance item in a workflow\'s release when a compliance trigger references it', () => {
    const r = buildReleaseManifest(inputs({
      releases: [
        skeleton('REL-1', 1, ['UJ-A']),
        skeleton('REL-2', 2, []),
      ],
      journeys: [journey('UJ-A')],
      workflows: [workflow({
        id: 'WF-GDPR',
        triggers: [
          { kind: 'journey_step', journey_id: 'UJ-A', step_number: 1 },
          { kind: 'compliance', regime_id: 'COMP-GDPR', rule: 'x' },
        ],
      })],
      complianceIds: ['COMP-GDPR', 'COMP-OTHER'],
    }));
    expect(r.releases[0].contains.compliance).toEqual(['COMP-GDPR']);
    expect(r.crossCutting.compliance).toEqual(['COMP-OTHER']);
  });
});

describe('buildReleaseManifest — integrations', () => {
  it('defaults integrations to cross_cutting when no workflow references them', () => {
    const r = buildReleaseManifest(inputs({
      integrations: [integration('INT-STRIPE'), integration('INT-EMAIL')],
    }));
    expect(r.crossCutting.integrations.sort()).toEqual(['INT-EMAIL', 'INT-STRIPE']);
  });

  it('places an integration in the earliest workflow that uses it via an integration trigger', () => {
    const r = buildReleaseManifest(inputs({
      releases: [
        skeleton('REL-1', 1, ['UJ-A']),
        skeleton('REL-2', 2, ['UJ-B']),
      ],
      journeys: [journey('UJ-A'), journey('UJ-B')],
      workflows: [
        workflow({
          id: 'WF-USES-STRIPE-EARLY',
          triggers: [
            { kind: 'journey_step', journey_id: 'UJ-A', step_number: 1 },
            { kind: 'integration', integration_id: 'INT-STRIPE', event: 'e' },
          ],
        }),
        workflow({
          id: 'WF-USES-STRIPE-LATE',
          triggers: [
            { kind: 'journey_step', journey_id: 'UJ-B', step_number: 1 },
            { kind: 'integration', integration_id: 'INT-STRIPE', event: 'e' },
          ],
        }),
      ],
      integrations: [integration('INT-STRIPE')],
    }));
    // INT-STRIPE follows the EARLIEST workflow that uses it — REL-1.
    expect(r.releases[0].contains.integrations).toEqual(['INT-STRIPE']);
    expect(r.releases[1].contains.integrations).toEqual([]);
    expect(r.crossCutting.integrations).toEqual([]);
  });
});

describe('buildReleaseManifest — vocabulary', () => {
  it('always places vocabulary in cross_cutting (canonical terms are product-wide)', () => {
    const r = buildReleaseManifest(inputs({
      vocabulary: [voc('VOC-ACCRUAL'), voc('VOC-RBAC')],
    }));
    expect(r.crossCutting.vocabulary.sort()).toEqual(['VOC-ACCRUAL', 'VOC-RBAC']);
    for (const rel of r.releases) {
      expect(rel.contains.vocabulary).toEqual([]);
    }
  });
});

describe('buildReleaseManifest — full end-to-end coherence', () => {
  it('produces a fully-populated manifest with exact coverage and no drops', () => {
    const r = buildReleaseManifest({
      releases: [
        skeleton('REL-1', 1, ['UJ-ONBOARD']),
        skeleton('REL-2', 2, ['UJ-CLAIM']),
      ],
      journeys: [
        journey('UJ-ONBOARD', { domains: ['DOM-IDENTITY'] }),
        journey('UJ-CLAIM', { domains: ['DOM-CLAIMS'] }),
      ],
      workflows: [
        workflow({
          id: 'WF-PROVISION',
          domain: 'DOM-IDENTITY',
          triggers: [{ kind: 'journey_step', journey_id: 'UJ-ONBOARD', step_number: 1 }],
        }),
        workflow({
          id: 'WF-AUDIT-NIGHTLY',
          domain: 'DOM-AUDIT',
          triggers: [{ kind: 'schedule', cadence: 'daily at 02:00 UTC' }],
        }),
      ],
      entities: [entity('ENT-USER', 'DOM-IDENTITY'), entity('ENT-CLAIM', 'DOM-CLAIMS')],
      complianceIds: ['COMP-GDPR-RTBF'],
      integrations: [integration('INT-EMAIL')],
      vocabulary: [voc('VOC-CLAIM')],
    });

    expect(r.releases[0].contains.journeys).toEqual(['UJ-ONBOARD']);
    expect(r.releases[0].contains.workflows).toEqual(['WF-PROVISION']);
    expect(r.releases[0].contains.entities).toEqual(['ENT-USER']);
    expect(r.releases[1].contains.journeys).toEqual(['UJ-CLAIM']);
    expect(r.releases[1].contains.entities).toEqual(['ENT-CLAIM']);
    expect(r.crossCutting.workflows).toEqual(['WF-AUDIT-NIGHTLY']);
    expect(r.crossCutting.compliance).toEqual(['COMP-GDPR-RTBF']);
    expect(r.crossCutting.integrations).toEqual(['INT-EMAIL']);
    expect(r.crossCutting.vocabulary).toEqual(['VOC-CLAIM']);

    // Exact-coverage check: every accepted artifact appears exactly once.
    const countAcross = (id: string): number => {
      let n = 0;
      for (const rel of r.releases) {
        for (const arr of Object.values(rel.contains) as string[][]) if (arr.includes(id)) n++;
      }
      for (const arr of Object.values(r.crossCutting) as string[][]) if (arr.includes(id)) n++;
      return n;
    };
    for (const id of ['UJ-ONBOARD', 'UJ-CLAIM', 'WF-PROVISION', 'WF-AUDIT-NIGHTLY',
                      'ENT-USER', 'ENT-CLAIM', 'COMP-GDPR-RTBF', 'INT-EMAIL', 'VOC-CLAIM']) {
      expect(countAcross(id), `${id} exact coverage`).toBe(1);
    }
  });
});
