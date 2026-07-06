/**
 * Bounded id resolver — resolves LLM-drifted ids to a canonical oracle id,
 * robustly but safely (always an oracle member or null; never invented).
 */
import { describe, it, expect } from 'vitest';
import {
  resolveAgainstOracle,
  idComparisonKey,
  similarityRatio,
  techIdBodyKey,
  resolveTechId,
  resolveTechConstraintIds,
  resolveTechIdBySemantics,
  resolveComponentId,
  resolveByTokenSubset,
} from '../../../lib/orchestrator/idResolver';

const COMPS = [
  'comp-url-shortening-service',
  'comp-redirect-handling-service',
  'comp-stats-inspection-service',
  'comp-slug-deletion-service',
];

describe('idComparisonKey', () => {
  it('folds prefix-case + all separators to a bare body key', () => {
    expect(idComparisonKey('comp-redirect_handling_service')).toBe('redirecthandlingservice');
    expect(idComparisonKey('COMP-Redirect-Handling-Service')).toBe('redirecthandlingservice');
    expect(idComparisonKey('comp-redirect-handling-service')).toBe('redirecthandlingservice');
  });
});

describe('resolveAgainstOracle', () => {
  it('returns the exact id when already canonical', () => {
    expect(resolveAgainstOracle('comp-redirect-handling-service', COMPS)).toBe('comp-redirect-handling-service');
  });
  it('resolves underscore/hyphen/case drift to the canonical oracle id', () => {
    expect(resolveAgainstOracle('comp-redirect_handling_service', COMPS)).toBe('comp-redirect-handling-service');
    expect(resolveAgainstOracle('COMP-URL_SHORTENING_SERVICE', COMPS)).toBe('comp-url-shortening-service');
  });
  it('resolves a clear single-char typo above threshold', () => {
    expect(resolveAgainstOracle('comp-redirect-handling-servic', COMPS)).toBe('comp-redirect-handling-service');
  });
  it('returns null for a low-similarity candidate (never invents)', () => {
    expect(resolveAgainstOracle('comp-totally-different-thing', COMPS)).toBeNull();
  });
  it('returns null on empty oracle', () => {
    expect(resolveAgainstOracle('comp-x', [])).toBeNull();
  });
  it('returns null when two oracle ids normalize to the same key (ambiguous)', () => {
    expect(resolveAgainstOracle('comp-a_b', ['comp-a-b', 'comp-ab'])).toBeNull();
  });
  it('resolves TECH-* separator drift against a tech oracle', () => {
    expect(resolveAgainstOracle('TECH-JSON_LOGS', ['TECH-JSON-LOGS', 'TECH-PGSQL-16'])).toBe('TECH-JSON-LOGS');
  });
  it('leaves a true semantic alias unresolved (honest)', () => {
    // POSTGRES vs PGSQL is a semantic alias, not separator drift — below threshold.
    expect(resolveAgainstOracle('TECH-POSTGRES-16', ['TECH-PGSQL-16', 'TECH-JSON-LOGS'])).toBeNull();
  });
});

describe('similarityRatio', () => {
  it('is 1 for identical and lower for edits', () => {
    expect(similarityRatio('abc', 'abc')).toBe(1);
    expect(similarityRatio('abc', 'abd')).toBeCloseTo(2 / 3, 5);
  });
});

// PA-9 — the canonical constraint registry (from cal-38): every id carries a
// "-N" enumeration suffix. The planner drifts these during saturation.
const TECH_ORACLE = [
  'TECH-POSTGRESQL-RLS-1', 'TECH-NODEJS-BUN-1', 'TECH-OAPI-ZOD-1', 'TECH-CERBOS-1',
  'TECH-WORKFLOW-DBOS-1', 'TECH-BETTERAUTH-1', 'TECH-SEAWEEDFS-1', 'TECH-OPENMETRICS-1',
  'TECH-FFMPEG-1', 'TECH-SVELTEKIT-1', 'TECH-MOBILE-1', 'TECH-DOCKERCOMPOSE-1',
];

describe('techIdBodyKey', () => {
  it('strips the trailing -<digits> enumeration suffix so drift collapses', () => {
    expect(techIdBodyKey('TECH-CERBOS-1')).toBe('cerbos');
    expect(techIdBodyKey('TECH-CERBOS')).toBe('cerbos');
  });
  it('folds separators + case (a drifted separator matches the canonical)', () => {
    expect(techIdBodyKey('TECH-BETTER-AUTH')).toBe('betterauth');
    expect(techIdBodyKey('TECH-BETTERAUTH-1')).toBe('betterauth');
    expect(techIdBodyKey('TECH-WORKFLOWDBOS-1')).toBe('workflowdbos');
    expect(techIdBodyKey('TECH-WORKFLOW-DBOS-1')).toBe('workflowdbos');
  });
  it('does NOT strip a non-numeric trailing segment', () => {
    expect(techIdBodyKey('TECH-OAPI-ZOD-1')).toBe('oapizod');
  });
});

describe('resolveTechId', () => {
  it('returns the exact id when already canonical', () => {
    for (const o of TECH_ORACLE) expect(resolveTechId(o, TECH_ORACLE)).toBe(o);
  });
  it('resolves the missing "-1" enumeration suffix (the dominant drift)', () => {
    expect(resolveTechId('TECH-CERBOS', TECH_ORACLE)).toBe('TECH-CERBOS-1');
    expect(resolveTechId('TECH-SVELTEKIT', TECH_ORACLE)).toBe('TECH-SVELTEKIT-1');
    expect(resolveTechId('TECH-SEAWEEDFS', TECH_ORACLE)).toBe('TECH-SEAWEEDFS-1');
    expect(resolveTechId('TECH-POSTGRESQL-RLS', TECH_ORACLE)).toBe('TECH-POSTGRESQL-RLS-1');
  });
  it('resolves separator drift (with or without the suffix)', () => {
    expect(resolveTechId('TECH-BETTER-AUTH', TECH_ORACLE)).toBe('TECH-BETTERAUTH-1');
    expect(resolveTechId('TECH-WORKFLOWDBOS-1', TECH_ORACLE)).toBe('TECH-WORKFLOW-DBOS-1');
  });
  it('resolves a close typo within threshold', () => {
    expect(resolveTechId('TECH-OPI-ZOD-1', TECH_ORACLE)).toBe('TECH-OAPI-ZOD-1');
  });
  it('leaves a true semantic alias unresolved (honest residual, not a guess)', () => {
    // shorthand names, not string drift — no confident oracle match.
    expect(resolveTechId('TECH-BUN', TECH_ORACLE)).toBeNull();
    expect(resolveTechId('TECH-DBOS', TECH_ORACLE)).toBeNull();
    expect(resolveTechId('TECH-POSTGRES', TECH_ORACLE)).toBeNull();
  });
  it('never mis-resolves one canonical id to a DIFFERENT canonical (0 false positives)', () => {
    for (const o of TECH_ORACLE) expect(resolveTechId(o, TECH_ORACLE)).toBe(o);
  });
  it('returns null on empty oracle / empty candidate', () => {
    expect(resolveTechId('TECH-CERBOS', [])).toBeNull();
    expect(resolveTechId('', TECH_ORACLE)).toBeNull();
    expect(resolveTechId('TECH', TECH_ORACLE)).toBeNull();
  });
  it('returns null when two oracle ids collapse to the same body key (ambiguous)', () => {
    expect(resolveTechId('TECH-AUTH', ['TECH-AUTH-1', 'TECH-AUTH-2'])).toBeNull();
  });
});

// PA-4 — data-model saturation fabricates composite `comp-<component>-<entity>`
// ids (real cal-38 misses). resolveComponentId snaps them to the real component.
const COMP_ORACLE = [
  'comp-appointment-core',
  'comp-service-call-dashboard-provider',
  'comp-audit-event-module',
  'comp-property-listing-service',
  'comp-index-builder',
];

describe('resolveComponentId', () => {
  it('returns the exact id when already canonical', () => {
    expect(resolveComponentId('comp-appointment-core', COMP_ORACLE)).toBe('comp-appointment-core');
  });
  it('resolves separator/case drift of the whole id (via resolveAgainstOracle)', () => {
    expect(resolveComponentId('comp-appointment_core', COMP_ORACLE)).toBe('comp-appointment-core');
  });
  it('resolves a fabricated composite comp-<component>-<entity> to its real component', () => {
    expect(resolveComponentId('comp-appointment-core-auditlogentry', COMP_ORACLE)).toBe('comp-appointment-core');
    expect(resolveComponentId('comp-property-listing-service-contact', COMP_ORACLE)).toBe('comp-property-listing-service');
    expect(resolveComponentId('comp-index-builder-auditlogdetails', COMP_ORACLE)).toBe('comp-index-builder');
  });
  it('resolves a deep composite to the longest real-component prefix', () => {
    expect(resolveComponentId('comp-service-call-dashboard-provider-user-role', COMP_ORACLE))
      .toBe('comp-service-call-dashboard-provider');
  });
  it('picks the MOST specific real component (longest prefix wins)', () => {
    const oracle = ['comp-a', 'comp-a-b'];
    expect(resolveComponentId('comp-a-b-widget', oracle)).toBe('comp-a-b');
  });
  it('never collapses to a bare `comp` prefix (>= 2 segment floor)', () => {
    // no real base for this fabrication → residual, not a bogus `comp` match.
    expect(resolveComponentId('comp-servicecall-auditlogentry', COMP_ORACLE)).toBeNull();
    expect(resolveComponentId('comp-foo-bar', ['comp-baz'])).toBeNull();
  });
  it('returns null on empty oracle / empty candidate', () => {
    expect(resolveComponentId('comp-appointment-core-x', [])).toBeNull();
    expect(resolveComponentId('', COMP_ORACLE)).toBeNull();
  });
});

// PA-9 semantic aliases — the constraint's own `technology`/`text` carries the
// vendor the shorthand names (real cal-38 constraint bodies).
const TECH_CONSTRAINTS = [
  { id: 'TECH-NODEJS-BUN-1', technology: 'Node.js on Bun', text: 'Backend: Node.js on Bun for high-performance API execution' },
  { id: 'TECH-WORKFLOW-DBOS-1', technology: 'DBOS', text: 'Workflow engine: DBOS durable, versioned workflows' },
  { id: 'TECH-POSTGRESQL-RLS-1', technology: 'PostgreSQL', text: 'Database: PostgreSQL with row-level security' },
  { id: 'TECH-CERBOS-1', technology: 'Cerbos', text: 'Authorization: Cerbos policy-based authorization' },
  { id: 'TECH-BETTERAUTH-1', technology: 'better-auth', text: 'Authentication: better-auth' },
];

describe('resolveTechIdBySemantics (PA-9 alias oracle)', () => {
  it('resolves a shorthand-name alias via the constraint technology/text', () => {
    expect(resolveTechIdBySemantics('TECH-BUN', TECH_CONSTRAINTS)).toBe('TECH-NODEJS-BUN-1');
    expect(resolveTechIdBySemantics('TECH-DBOS', TECH_CONSTRAINTS)).toBe('TECH-WORKFLOW-DBOS-1');
    expect(resolveTechIdBySemantics('TECH-POSTGRES', TECH_CONSTRAINTS)).toBe('TECH-POSTGRESQL-RLS-1');
    expect(resolveTechIdBySemantics('TECH-POSTGRESQL', TECH_CONSTRAINTS)).toBe('TECH-POSTGRESQL-RLS-1');
  });
  it('never mis-resolves a canonical id to a DIFFERENT constraint (0 FP)', () => {
    for (const c of TECH_CONSTRAINTS) {
      const r = resolveTechIdBySemantics(c.id, TECH_CONSTRAINTS);
      expect(r === null || r === c.id).toBe(true);
    }
  });
  it('returns null when no distinctive token matches (honest residual)', () => {
    expect(resolveTechIdBySemantics('TECH-PG-RLS', TECH_CONSTRAINTS)).toBeNull();
    expect(resolveTechIdBySemantics('TECH-FOOBAR', TECH_CONSTRAINTS)).toBeNull();
  });
  it('returns null for a token that appears in >1 constraint (ambiguous, never guesses)', () => {
    const dup = [
      { id: 'TECH-A-1', technology: 'AuthService' },
      { id: 'TECH-B-1', technology: 'AuthProxy' },
    ];
    expect(resolveTechIdBySemantics('TECH-AUTH', dup)).toBeNull();
  });
  it('ignores <3-char tokens and empty constraint sets', () => {
    expect(resolveTechIdBySemantics('TECH-PG', TECH_CONSTRAINTS)).toBeNull();
    expect(resolveTechIdBySemantics('TECH-BUN', [])).toBeNull();
  });
});

// cal-39 P1.3c — gpt-oss TRUNCATED a journey's domain ref (`DOM-COMMUNICATION`
// for the accepted `DOM-COMMUNITY-COMMUNICATION`), a whole-token drop that
// similarity can't reach → blocking referential_integrity_journey_domain gap.
const DOMAIN_ORACLE = [
  'DOM-AGENT-MATCHING', 'DOM-AI-RECOMMENDATION-ENGINE', 'DOM-BOARD-ACCESS',
  'DOM-COMMUNITY-COMMUNICATION', 'DOM-DOCUMENT-STORAGE', 'DOM-FINANCIAL-REPORTING',
  'DOM-MASS-EMAIL', 'DOM-PROPERTY-MANAGEMENT', 'DOM-USER-AUTHENTICATION',
];

describe('resolveByTokenSubset (truncation drift)', () => {
  it('resolves a dropped-token truncation to the unique token-superset', () => {
    expect(resolveByTokenSubset('DOM-COMMUNICATION', DOMAIN_ORACLE)).toBe('DOM-COMMUNITY-COMMUNICATION');
  });
  it('returns the exact id when already canonical', () => {
    expect(resolveByTokenSubset('DOM-MASS-EMAIL', DOMAIN_ORACLE)).toBe('DOM-MASS-EMAIL');
  });
  it('never cross-resolves an accepted id to a different one (0 FP)', () => {
    for (const d of DOMAIN_ORACLE) {
      const r = resolveByTokenSubset(d, DOMAIN_ORACLE);
      expect(r === null || r === d).toBe(true);
    }
  });
  it('returns null when the token-subset is ambiguous (≥2 superset hosts)', () => {
    // `management` is a subset token of BOTH → don't guess.
    expect(resolveByTokenSubset('DOM-MANAGEMENT', ['DOM-PROPERTY-MANAGEMENT', 'DOM-VENDOR-MANAGEMENT'])).toBeNull();
  });
  it('refuses to resolve on a trivial (<4-char) fragment', () => {
    expect(resolveByTokenSubset('DOM-AI', DOMAIN_ORACLE)).toBeNull();
  });
  it('does not resolve an unrelated id (no shared tokens)', () => {
    expect(resolveByTokenSubset('DOM-BILLING', DOMAIN_ORACLE)).toBeNull();
  });
  it('returns null on empty oracle / candidate', () => {
    expect(resolveByTokenSubset('DOM-COMMUNICATION', [])).toBeNull();
    expect(resolveByTokenSubset('', DOMAIN_ORACLE)).toBeNull();
  });
});

describe('resolveTechConstraintIds (batch remapper)', () => {
  it('rewrites only TECH-* ids, passing non-TECH ids through untouched', () => {
    const { ids, rewrites } = resolveTechConstraintIds(
      ['TECH-CERBOS', 'comp-x', 'AC-US001-002', 'res-7'], TECH_ORACLE,
    );
    expect(ids).toEqual(['TECH-CERBOS-1', 'comp-x', 'AC-US001-002', 'res-7']);
    expect(rewrites).toEqual(['TECH-CERBOS→TECH-CERBOS-1']);
  });
  it('keeps unresolvable TECH ids in place and records no rewrite for them', () => {
    const { ids, rewrites } = resolveTechConstraintIds(['TECH-BUN', 'TECH-SVELTEKIT'], TECH_ORACLE);
    expect(ids).toEqual(['TECH-BUN', 'TECH-SVELTEKIT-1']);
    expect(rewrites).toEqual(['TECH-SVELTEKIT→TECH-SVELTEKIT-1']);
  });
  it('falls through to semantic resolution when constraints are supplied (alias closure)', () => {
    const { ids, rewrites } = resolveTechConstraintIds(
      ['TECH-BUN', 'TECH-DBOS'], TECH_ORACLE, TECH_CONSTRAINTS,
    );
    expect(ids).toEqual(['TECH-NODEJS-BUN-1', 'TECH-WORKFLOW-DBOS-1']);
    expect(rewrites).toEqual(['TECH-BUN→TECH-NODEJS-BUN-1', 'TECH-DBOS→TECH-WORKFLOW-DBOS-1']);
  });
  it('is a no-op (passes ids through) when the oracle is empty', () => {
    const { ids, rewrites } = resolveTechConstraintIds(['TECH-CERBOS'], []);
    expect(ids).toEqual(['TECH-CERBOS']);
    expect(rewrites).toEqual([]);
  });
});
