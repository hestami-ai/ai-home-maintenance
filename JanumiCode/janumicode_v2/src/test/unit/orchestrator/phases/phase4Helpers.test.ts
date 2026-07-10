/**
 * Characterization tests for the pure helpers extracted from
 * Phase4Handler.execute() during the S3776 cognitive-complexity refactor.
 *
 * These pin the ORIGINAL inline behaviour (id/label/tradeoff projection,
 * acceptance-set filtering, TECH-* roster rendering, leaf-vs-root ADR source,
 * tier histogram, DecompositionComponent conversion, DMR-seed collapse) so the
 * extraction stays behaviour-preserving. They deliberately exercise branches
 * the end-to-end phase smoke test (phases.test.ts) does NOT reach with its
 * empty-LLM fallback data (e.g. cross-cutting/leaf projections, coerced
 * dependency kinds, populated constraint rosters).
 */
import { describe, it, expect } from 'vitest';
import {
  optRecordIds,
  buildDomainContext,
  buildComponentGatekeeperItems,
  computeAcceptedScopeSets,
  toDecompositionComponents,
  buildAdrComponentsSource,
  summarizeTechnicalConstraints,
  computeComponentTierDistribution,
} from '../../../../lib/orchestrator/phases/phase4';

describe('optRecordIds', () => {
  it('collects recordIds of present contexts in order, skipping null/undefined', () => {
    expect(
      optRecordIds({ recordId: 'a' }, null, { recordId: 'b' }, undefined),
    ).toEqual(['a', 'b']);
  });

  it('returns [] when nothing is present', () => {
    expect(optRecordIds(null, undefined)).toEqual([]);
  });
});

describe('buildDomainContext', () => {
  it('renders per-domain context, byte-identical summary, and thin index', () => {
    const { domainContextById, domainsSummary, domainIndex } = buildDomainContext([
      {
        id: 'DOM-1', name: 'Alpha',
        ubiquitous_language: [{ term: 'T', definition: 'D' }],
        system_requirement_ids: ['SR-1', 'SR-2'],
      },
      {
        id: 'DOM-2', name: 'Beta',
        ubiquitous_language: [],
      },
    ]);
    expect(domainContextById['DOM-1']).toBe('DOM-1: Alpha (reqs: SR-1, SR-2)\n  Terms: T: D');
    // missing system_requirement_ids → empty reqs list, empty terms
    expect(domainContextById['DOM-2']).toBe('DOM-2: Beta (reqs: )\n  Terms: ');
    expect(domainsSummary).toBe(`${domainContextById['DOM-1']}\n${domainContextById['DOM-2']}`);
    expect(domainIndex).toBe('DOM-1: Alpha\nDOM-2: Beta');
  });
});

describe('buildComponentGatekeeperItems', () => {
  it('projects id/label/description/tradeoffs from a fully-populated component', () => {
    const [item] = buildComponentGatekeeperItems([
      { id: 'C1', name: 'Svc', domain_id: 'd1', description: 'desc', traces_to: ['US-1', 'US-2'] },
    ]);
    expect(item).toEqual({
      id: 'C1',
      label: 'C1: Svc [domain: d1]',
      description: 'desc',
      tradeoffs: 'traces_to: US-1, US-2',
    });
  });

  it('falls back to empty id, ? domain, and undefined description/tradeoffs', () => {
    const [item] = buildComponentGatekeeperItems([
      { id: 42, name: 'X' }, // non-string id, no domain/description/traces_to
    ]);
    expect(item.id).toBe('');
    expect(item.label).toBe('42: X [domain: ?]');
    expect(item.description).toBeUndefined();
    expect(item.tradeoffs).toBeUndefined();
  });
});

describe('computeAcceptedScopeSets', () => {
  it('collects accepted biz-domain and user-story ids from current-version artifacts only', () => {
    const { acceptedBizDomainIds, acceptedUserStoryIds } = computeAcceptedScopeSets([
      { is_current_version: true, content: { kind: 'business_domains_bloom', domains: [{ id: 'DOM-1' }, { id: 'DOM-2' }] } },
      { is_current_version: false, content: { kind: 'business_domains_bloom', domains: [{ id: 'DOM-STALE' }] } },
      { is_current_version: true, content: { kind: 'functional_requirements', user_stories: [{ id: 'US-1' }] } },
      { is_current_version: true, content: { kind: 'something_else', domains: [{ id: 'DOM-IGNORE' }] } },
    ]);
    expect([...acceptedBizDomainIds].sort()).toEqual(['DOM-1', 'DOM-2']);
    expect([...acceptedUserStoryIds]).toEqual(['US-1']);
  });
});

describe('summarizeTechnicalConstraints', () => {
  it('returns the sentinel string when there are no constraints', () => {
    expect(summarizeTechnicalConstraints([])).toBe('No technical_constraints_discovery artifact available');
  });

  it('renders id/tech/category/text joined by em-dash, one per line', () => {
    const out = summarizeTechnicalConstraints([
      { id: 'TECH-1', technology: 'Bun', category: 'runtime', text: 'use Bun' } as never,
      // falls back to name and rationale when technology/text absent
      { id: 'TECH-2', name: 'Postgres', category: 'db', rationale: 'relational' } as never,
    ]);
    expect(out).toBe('TECH-1 — Bun — runtime — use Bun\nTECH-2 — Postgres — db — relational');
  });
});

describe('buildAdrComponentsSource', () => {
  it('returns the flat fallback (same reference) when no leaf tree exists', () => {
    const fallback = [{ id: 'C1', name: 'Svc', responsibilities: [{ id: 'R1', statement: 'do' }] }];
    const out = buildAdrComponentsSource({ source: 'roots', components: [] }, fallback);
    expect(out).toBe(fallback);
  });

  it('projects the leaf shape, preferring statement over description and target_component_id over component_id', () => {
    const out = buildAdrComponentsSource(
      {
        source: 'leaves',
        components: [
          {
            id: 'L1', name: 'Leaf', domain_id: 'd1',
            responsibilities: [{ id: 'R1', description: 'from-desc' }, { id: 'R2', statement: 'from-stmt' }],
            dependencies: [{ component_id: 'X' }, { target_component_id: 'Y', dependency_type: 'async_event' }],
          },
        ],
      },
      [],
    );
    expect(out).toEqual([
      {
        id: 'L1', name: 'Leaf', domain_id: 'd1',
        responsibilities: [{ id: 'R1', statement: 'from-desc' }, { id: 'R2', statement: 'from-stmt' }],
        dependencies: [
          { target_component_id: 'X', dependency_type: 'sync_call' },
          { target_component_id: 'Y', dependency_type: 'async_event' },
        ],
      },
    ]);
  });
});

describe('computeComponentTierDistribution', () => {
  it('counts nodes by tier and skips nodes with no tier', () => {
    const dist = computeComponentTierDistribution([
      { content: { tier: 'leaf' } },
      { content: { tier: 'leaf' } },
      { content: { tier: 'branch' } },
      { content: {} }, // no tier → skipped
    ]);
    expect(dist).toEqual({ leaf: 2, branch: 1 });
  });
});

describe('toDecompositionComponents', () => {
  it('maps to Wave-7 shape, coercing unknown dependency kinds to sync_call and null domain', () => {
    const out = toDecompositionComponents(
      [
        {
          id: 'C1', name: 'Svc',
          responsibilities: [{ id: 'R1', statement: 'do it' }],
          dependencies: [
            { target_component_id: 'C2', dependency_type: 'data_read' }, // valid → preserved
            { target_component_id: 'C3', dependency_type: 'weird_kind' }, // unknown → sync_call
          ],
          satisfies_requirement_ids: ['SR-1'],
        },
      ],
      [{ id: 'TECH-1' }, { id: 'TECH-2' }] as never,
    );
    expect(out).toEqual([
      {
        id: 'C1', name: 'Svc', domain_id: null,
        responsibilities: [{ id: 'R1', description: 'do it' }],
        dependencies: [
          { component_id: 'C2', kind: 'data_read' },
          { component_id: 'C3', kind: 'sync_call' },
        ],
        active_constraints: ['TECH-1', 'TECH-2'],
        traces_to: ['SR-1'],
      },
    ]);
  });

  it('gives each component its own fresh active_constraints array (no aliasing)', () => {
    const out = toDecompositionComponents(
      [
        { id: 'A', name: 'A', responsibilities: [] },
        { id: 'B', name: 'B', responsibilities: [] },
      ],
      [{ id: 'TECH-1' }] as never,
    );
    expect(out[0].active_constraints).not.toBe(out[1].active_constraints);
    expect(out[0].active_constraints).toEqual(['TECH-1']);
  });
});
