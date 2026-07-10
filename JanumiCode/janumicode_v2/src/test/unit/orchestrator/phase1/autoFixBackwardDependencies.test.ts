/**
 * Characterization tests pinning the OBSERVABLE behavior of the Phase 1.8
 * deterministic backward-dependency auto-fixer before it was decomposed to
 * reduce S3776 cognitive complexity. The assertions are derived from the
 * ORIGINAL inline logic:
 *   - A workflow whose triggers reference a target in a LATER release than
 *     its own placement is moved forward to that latest target release; the
 *     move is removed from its source release.contains.workflows (or from
 *     cross_cutting.workflows) and pushed onto the target release.
 *   - A cross_cutting workflow whose triggers reference a release-specific
 *     target is demoted from cross_cutting to that target release.
 *   - A workflow already at/after its constraining targets is left untouched.
 *   - A workflow not placed anywhere is skipped.
 *   - The returned log entry is
 *     { workflow_id, from, to, reason } with `from`/`to` = 'cross_cutting'
 *     or `REL-ord=<n>`, and reason = 'triggers reference targets up to
 *     REL-ord=<maxTargetOrd>'.
 */
import { describe, it, expect } from 'vitest';
import { autoFixBackwardDependencies } from '../../../../lib/orchestrator/phases/phase1';
import type { ReleasePlanContentV2, UserJourney, WorkflowV2 } from '../../../../lib/types/records';

function emptyContains() {
  return {
    journeys: [] as string[], workflows: [] as string[], entities: [] as string[],
    compliance: [] as string[], integrations: [] as string[], vocabulary: [] as string[],
    vv_requirements: [] as string[], quality_attributes: [] as string[], technical_constraints: [] as string[],
  };
}
function emptyCrossCutting() {
  return {
    workflows: [] as string[], compliance: [] as string[], integrations: [] as string[], vocabulary: [] as string[],
    vv_requirements: [] as string[], quality_attributes: [] as string[], technical_constraints: [] as string[],
  };
}
function journey(id: string, personaId = 'P-1'): UserJourney {
  return { id, personaId, title: 't', scenario: 's', steps: [], acceptanceCriteria: [], implementationPhase: 'Phase 1' };
}
function workflow(opts: { id: string; triggers?: WorkflowV2['triggers']; backs_journeys?: string[] }): WorkflowV2 {
  return {
    id: opts.id, businessDomainId: 'DOM-X', name: 'W', description: 'd',
    steps: [], triggers: opts.triggers ?? [{ kind: 'schedule', cadence: 'daily' }],
    actors: [], backs_journeys: opts.backs_journeys ?? [],
  };
}

describe('autoFixBackwardDependencies', () => {
  it('moves a release-placed workflow forward when it triggers off a journey in a later release', () => {
    const plan: ReleasePlanContentV2 = {
      kind: 'release_plan', schemaVersion: '2.0', approved: false,
      releases: [
        { release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), workflows: ['WF-1'] } },
        { release_id: 'REL-2', ordinal: 2, name: 'B', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-2'] } },
      ],
      cross_cutting: emptyCrossCutting(),
    };
    const fixes = autoFixBackwardDependencies(
      plan,
      [workflow({ id: 'WF-1', triggers: [{ kind: 'journey_step', journey_id: 'UJ-2', step_number: 1 }], backs_journeys: ['UJ-2'] })],
      [journey('UJ-2')],
    );
    expect(fixes).toEqual([
      { workflow_id: 'WF-1', from: 'REL-ord=1', to: 'REL-ord=2', reason: 'triggers reference targets up to REL-ord=2' },
    ]);
    expect(plan.releases[0].contains.workflows).toEqual([]);
    expect(plan.releases[1].contains.workflows).toEqual(['WF-1']);
  });

  it('leaves a workflow untouched when it is already at/after its constraining targets', () => {
    const plan: ReleasePlanContentV2 = {
      kind: 'release_plan', schemaVersion: '2.0', approved: false,
      releases: [
        { release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-1'] } },
        { release_id: 'REL-2', ordinal: 2, name: 'B', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), workflows: ['WF-1'] } },
      ],
      cross_cutting: emptyCrossCutting(),
    };
    const fixes = autoFixBackwardDependencies(
      plan,
      [workflow({ id: 'WF-1', triggers: [{ kind: 'journey_step', journey_id: 'UJ-1', step_number: 1 }], backs_journeys: ['UJ-1'] })],
      [journey('UJ-1')],
    );
    expect(fixes).toEqual([]);
    expect(plan.releases[1].contains.workflows).toEqual(['WF-1']);
    expect(plan.releases[0].contains.workflows).toEqual([]);
  });

  it('demotes a cross_cutting workflow to the release of its release-specific target', () => {
    const plan: ReleasePlanContentV2 = {
      kind: 'release_plan', schemaVersion: '2.0', approved: false,
      releases: [
        { release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-1'] } },
      ],
      cross_cutting: { ...emptyCrossCutting(), workflows: ['WF-1'] },
    };
    const fixes = autoFixBackwardDependencies(
      plan,
      [workflow({ id: 'WF-1', triggers: [{ kind: 'journey_step', journey_id: 'UJ-1', step_number: 1 }] })],
      [journey('UJ-1')],
    );
    expect(fixes).toEqual([
      { workflow_id: 'WF-1', from: 'cross_cutting', to: 'REL-ord=1', reason: 'triggers reference targets up to REL-ord=1' },
    ]);
    expect(plan.cross_cutting.workflows).toEqual([]);
    expect(plan.releases[0].contains.workflows).toEqual(['WF-1']);
  });

  it('skips a workflow that is not placed anywhere in the plan', () => {
    const plan: ReleasePlanContentV2 = {
      kind: 'release_plan', schemaVersion: '2.0', approved: false,
      releases: [
        { release_id: 'REL-1', ordinal: 1, name: 'A', description: 'd', rationale: 'r',
          contains: { ...emptyContains(), journeys: ['UJ-1'] } },
      ],
      cross_cutting: emptyCrossCutting(),
    };
    const fixes = autoFixBackwardDependencies(
      plan,
      [workflow({ id: 'WF-X', triggers: [{ kind: 'journey_step', journey_id: 'UJ-1', step_number: 1 }] })],
      [journey('UJ-1')],
    );
    expect(fixes).toEqual([]);
  });
});
