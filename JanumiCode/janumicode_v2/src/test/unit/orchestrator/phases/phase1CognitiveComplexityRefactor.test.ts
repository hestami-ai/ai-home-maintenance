/**
 * Characterization tests pinning the OBSERVABLE behavior of the pure
 * helpers touched while reducing S3776 cognitive complexity in
 * `phase1.ts`. These lock the exact input→output contract so the
 * behavior-preserving extractions (mergeSurfacedAssumption,
 * collectInvalidStepActorRefs, remapJourneyStepActors,
 * indexCurrentArtifactsByKind) cannot silently drift.
 *
 * The assertions are derived from the ORIGINAL inline logic:
 *   - extractSurfacedAssumptions: case-insensitive dedup keyed on
 *     trimmed text; monotonic `assumption-N` ids; candidate-id merge on
 *     duplicates; rationale (from object `basis`) back-filled only when
 *     the retained entry had none; empty/blank text skipped.
 *   - collectInvalidStepActorRefs: a step.actor is invalid only when it
 *     is persona-shaped (`P-` prefix) and not accepted; `System` and
 *     accepted integration ids are always valid; non-object / non-string
 *     actors are skipped.
 *   - remapJourneyStepActors: remaps every persona-shaped actor in place
 *     via the supplied callback, `System`-fallback when it returns null;
 *     `System`/integration/non-`P-` actors untouched.
 *   - indexCurrentArtifactsByKind: last-write-wins per content `kind`,
 *     skipping non-current records and records lacking a string kind.
 */
import { describe, it, expect } from 'vitest';
import { Phase1Handler } from '../../../../lib/orchestrator/phases/phase1';

// The functions under test are private; cast through `any` to reach them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = new Phase1Handler() as any;

describe('extractSurfacedAssumptions — dedup + id numbering', () => {
  it('dedups case-insensitively, merges candidate ids, keeps first text, back-fills rationale', () => {
    const out = h.extractSurfacedAssumptions([
      { id: 'C-1', assumptions: [{ statement: 'Data is encrypted', basis: 'GDPR' }, '   '] },
      { id: 'C-2', assumptions: ['data is encrypted', { statement: 'Users self-serve' }] },
    ]);
    expect(out).toEqual([
      {
        id: 'assumption-1',
        text: 'Data is encrypted',
        rationale: 'GDPR',
        source_candidate_ids: ['C-1', 'C-2'],
        source: 'ai_proposed',
      },
      {
        id: 'assumption-2',
        text: 'Users self-serve',
        rationale: undefined,
        source_candidate_ids: ['C-2'],
        source: 'ai_proposed',
      },
    ]);
  });

  it('back-fills a missing rationale from a later duplicate carrying a basis', () => {
    const out = h.extractSurfacedAssumptions([
      { id: 'C-1', assumptions: [{ statement: 'X' }] },
      { id: 'C-2', assumptions: [{ statement: 'x', basis: 'reason' }] },
    ]);
    expect(out).toEqual([
      {
        id: 'assumption-1',
        text: 'X',
        rationale: 'reason',
        source_candidate_ids: ['C-1', 'C-2'],
        source: 'ai_proposed',
      },
    ]);
  });

  it('does not re-add the same candidate id and keeps the earlier rationale', () => {
    const out = h.extractSurfacedAssumptions([
      { id: 'C-1', assumptions: [{ statement: 'Y', basis: 'first' }, 'y'] },
    ]);
    expect(out).toEqual([
      {
        id: 'assumption-1',
        text: 'Y',
        rationale: 'first',
        source_candidate_ids: ['C-1'],
        source: 'ai_proposed',
      },
    ]);
  });

  it('returns an empty array when every assumption is blank', () => {
    expect(h.extractSurfacedAssumptions([{ id: 'C-1', assumptions: ['', '  '] }])).toEqual([]);
  });
});

describe('collectInvalidStepActorRefs — hallucinated persona actors in steps[]', () => {
  const accepted = new Set(['P-1']);
  const integrations = new Set(['INT-1']);

  it('flags only persona-shaped actors that are not accepted', () => {
    const refs = h.collectInvalidStepActorRefs(
      [
        { stepNumber: 1, actor: 'P-99' },   // invalid persona
        { stepNumber: 2, actor: 'P-1' },    // accepted persona
        { stepNumber: 3, actor: 'System' }, // System sentinel
        { stepNumber: 4, actor: 'INT-1' },  // accepted integration
        { stepNumber: 5, actor: 'Operator' }, // not P-shaped
        { stepNumber: 6 },                  // actor missing
        null,                               // non-object
      ],
      'UJ-1',
      accepted,
      integrations,
    );
    expect(refs).toEqual([{ id: 'P-99', where: 'UJ-1.step#1.actor' }]);
  });

  it('returns an empty array when steps is not an array', () => {
    expect(h.collectInvalidStepActorRefs(undefined, 'UJ-1', accepted, integrations)).toEqual([]);
    expect(h.collectInvalidStepActorRefs('nope', 'UJ-1', accepted, integrations)).toEqual([]);
  });
});

describe('remapJourneyStepActors — in-place persona-actor remap', () => {
  it('remaps persona-shaped actors via the callback and leaves the rest untouched', () => {
    const steps = [
      { stepNumber: 1, actor: 'P-99' },
      { stepNumber: 2, actor: 'System' },
      { stepNumber: 3, actor: 'INT-1' },
      { stepNumber: 4, actor: 'Guest' },
    ];
    const calls: Array<{ raw: string; where: string }> = [];
    h.remapJourneyStepActors(steps, 'UJ-1', new Set(['INT-1']), (raw: string, where: string) => {
      calls.push({ raw, where });
      return 'P-1';
    });
    expect(steps.map(s => s.actor)).toEqual(['P-1', 'System', 'INT-1', 'Guest']);
    // remap invoked for the sole persona-shaped, non-integration actor only
    expect(calls).toEqual([{ raw: 'P-99', where: 'UJ-1.step#1.actor' }]);
  });

  it('falls back to "System" when the remap callback returns null', () => {
    const steps = [{ stepNumber: 5, actor: 'P-42' }];
    h.remapJourneyStepActors(steps, 'UJ-2', new Set<string>(), () => null);
    expect(steps[0].actor).toBe('System');
  });

  it('is a no-op when steps is not an array', () => {
    expect(() => h.remapJourneyStepActors(undefined, 'UJ', new Set<string>(), () => null)).not.toThrow();
  });
});

describe('indexCurrentArtifactsByKind — last-write-wins index', () => {
  it('keeps the last current record per kind and skips non-current / kind-less records', () => {
    const map = h.indexCurrentArtifactsByKind([
      { is_current_version: true, content: { kind: 'a', v: 1 } },
      { is_current_version: false, content: { kind: 'b', v: 2 } },
      { is_current_version: true, content: { v: 3 } },
      { is_current_version: true, content: { kind: 'a', v: 4 } },
    ]);
    expect(map.get('a')).toEqual({ kind: 'a', v: 4 });
    expect(map.has('b')).toBe(false);
    expect(map.size).toBe(1);
  });
});

describe('extractUnreachedIds — de-blanked id list from unreached_* arrays', () => {
  it('maps the keyed id and drops blank / missing entries', () => {
    expect(h.extractUnreachedIds(
      [{ personaId: 'P-1' }, { personaId: 'P-2' }, { personaId: '' }, {}],
      'personaId',
    )).toEqual(['P-1', 'P-2']);
    expect(h.extractUnreachedIds([{ domainId: 'D-1' }], 'domainId')).toEqual(['D-1']);
  });
  it('returns an empty array when the input is not an array', () => {
    expect(h.extractUnreachedIds('nope', 'personaId')).toEqual([]);
    expect(h.extractUnreachedIds(undefined, 'domainId')).toEqual([]);
  });
});

describe('remapPersonaAgainstAccepted — accepted passthrough / fuzzy remap / drop', () => {
  it('passes an already-accepted id straight through with no logging', () => {
    const remapLog: Array<{ from: string; to: string; where: string }> = [];
    const dropLog: Array<{ id: string; where: string }> = [];
    const out = h.remapPersonaAgainstAccepted('P-1', 'w', new Set(['P-1']), remapLog, dropLog);
    expect(out).toBe('P-1');
    expect(remapLog).toEqual([]);
    expect(dropLog).toEqual([]);
  });
  it('fuzzy-remaps a near-miss to the nearest accepted id and logs the remap', () => {
    const remapLog: Array<{ from: string; to: string; where: string }> = [];
    const dropLog: Array<{ id: string; where: string }> = [];
    const out = h.remapPersonaAgainstAccepted('P-1X', 'w', new Set(['P-1']), remapLog, dropLog);
    expect(out).toBe('P-1');
    expect(remapLog).toEqual([{ from: 'P-1X', to: 'P-1', where: 'w' }]);
    expect(dropLog).toEqual([]);
  });
  it('drops an unresolvable id, logs the drop, and returns null', () => {
    const remapLog: Array<{ from: string; to: string; where: string }> = [];
    const dropLog: Array<{ id: string; where: string }> = [];
    const out = h.remapPersonaAgainstAccepted('ZZZZZ', 'w', new Set(['P-1']), remapLog, dropLog);
    expect(out).toBeNull();
    expect(remapLog).toEqual([]);
    expect(dropLog).toEqual([{ id: 'ZZZZZ', where: 'w' }]);
  });
});

describe('filterJourneySurfaces — drop non-accepted surface ids in place', () => {
  it('keeps accepted ids (retention also accepts a compliance id) and records drops', () => {
    const j: Record<string, unknown> = {
      surfaces: {
        compliance_regimes: ['COMP-A', 'COMP-BAD'],
        retention_rules: ['RET-A', 'COMP-A', 'RET-BAD'],
        vv_requirements: ['VV-A', 'VV-BAD'],
        integrations: ['INT-A', 'INT-BAD'],
      },
    };
    const dropped: Record<string, string[]> = {
      compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [],
    };
    h.filterJourneySurfaces(j, {
      compliance: new Set(['COMP-A']),
      retention: new Set(['RET-A']),
      vv: new Set(['VV-A']),
      integrations: new Set(['INT-A']),
    }, dropped);
    expect(j.surfaces).toEqual({
      compliance_regimes: ['COMP-A'],
      retention_rules: ['RET-A', 'COMP-A'],
      vv_requirements: ['VV-A'],
      integrations: ['INT-A'],
    });
    expect(dropped).toEqual({
      compliance_regimes: ['COMP-BAD'],
      retention_rules: ['RET-BAD'],
      vv_requirements: ['VV-BAD'],
      integrations: ['INT-BAD'],
    });
  });
  it('is a no-op when surfaces is absent or not an object', () => {
    const dropped: Record<string, string[]> = { compliance_regimes: [], retention_rules: [], vv_requirements: [], integrations: [] };
    const empty = { compliance: new Set<string>(), retention: new Set<string>(), vv: new Set<string>(), integrations: new Set<string>() };
    const j1: Record<string, unknown> = {};
    expect(() => h.filterJourneySurfaces(j1, empty, dropped)).not.toThrow();
    const j2: Record<string, unknown> = { surfaces: 'nope' };
    expect(() => h.filterJourneySurfaces(j2, empty, dropped)).not.toThrow();
    expect(dropped.compliance_regimes).toEqual([]);
  });
});

describe('collectInvalidPersonaRefs — hallucinated persona refs across a journey', () => {
  it('flags personaId, additionalPersonas, and persona-shaped step actors not in the accepted set', () => {
    const j: Record<string, unknown> = {
      id: 'UJ-1',
      personaId: 'P-BAD',
      additionalPersonas: ['P-2', 'P-BAD2', 5],
      steps: [{ stepNumber: 1, actor: 'P-BAD3' }, { stepNumber: 2, actor: 'P-2' }],
    };
    const refs = h.collectInvalidPersonaRefs(j, new Set(['P-1', 'P-2']), new Set<string>());
    expect(refs).toEqual([
      { id: 'P-BAD', where: 'UJ-1.personaId' },
      { id: 'P-BAD2', where: 'UJ-1.additionalPersonas' },
      { id: 'P-BAD3', where: 'UJ-1.step#1.actor' },
    ]);
  });
  it('returns no refs when every persona reference is accepted', () => {
    const j: Record<string, unknown> = { id: 'UJ-9', personaId: 'P-1', additionalPersonas: ['P-2'], steps: [] };
    expect(h.collectInvalidPersonaRefs(j, new Set(['P-1', 'P-2']), new Set<string>())).toEqual([]);
  });
});

describe('applyPersonaRemap — in-place persona remap with drop signal', () => {
  it('remaps personaId, additionalPersonas, and persona-shaped step actors, returning true', () => {
    const j: Record<string, unknown> = {
      id: 'UJ-1',
      personaId: 'P-BAD',
      additionalPersonas: ['P-2', 'P-BAD2'],
      steps: [{ stepNumber: 1, actor: 'P-BAD3' }, { stepNumber: 2, actor: 'System' }],
    };
    const ok = h.applyPersonaRemap(j, new Set<string>(), () => 'P-9');
    expect(ok).toBe(true);
    expect(j.personaId).toBe('P-9');
    expect(j.additionalPersonas).toEqual(['P-9', 'P-9']);
    expect((j.steps as Array<{ actor: string }>).map(s => s.actor)).toEqual(['P-9', 'System']);
  });
  it('returns false (drop) without further mutation when the initiator persona is unrecoverable', () => {
    const j: Record<string, unknown> = { id: 'UJ-2', personaId: 'P-BAD', additionalPersonas: ['P-X'] };
    const ok = h.applyPersonaRemap(j, new Set<string>(), () => null);
    expect(ok).toBe(false);
    expect(j.personaId).toBe('P-BAD');
    expect(j.additionalPersonas).toEqual(['P-X']);
  });
});
