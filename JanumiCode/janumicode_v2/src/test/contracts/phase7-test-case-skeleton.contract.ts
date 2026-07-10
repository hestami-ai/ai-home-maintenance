/**
 * Contract for Phase 7.1 — test_case_skeleton (artifact kind: `test_plan`).
 *
 * Backwards-derived from Phase 9's packetBuilder.findTestCasesForAcs.
 * Suites must be component-keyed (so packetBuilder's component-id
 * fallback can match), and every test case's AC refs must resolve.
 */

import type { ContractSuite } from './types';
import type { FunctionalRequirementsArtifact } from './phase2-fr-bloom-skeleton.contract';
import type { ComponentModelArtifact } from './phase4-component-skeleton.contract';

// ── Producer artifact shape ─────────────────────────────────────

export type TestType = 'unit' | 'integration' | 'end_to_end';
export type TestCaseFunctionalKind = 'functional' | 'performance' | 'security' | 'observability';

export interface TestCase {
  test_case_id: string;
  type: TestCaseFunctionalKind | (string & {});
  acceptance_criterion_ids: string[];
  preconditions?: string[];
  expected_outcome: string;
}

export interface TestSuite {
  suite_id: string;
  component_id: string;
  test_type: TestType;
  test_cases: TestCase[];
}

export interface TestPlanArtifact {
  kind: 'test_plan';
  test_suites: TestSuite[];
  total_test_cases?: number;
}

// ── Contract suite ───────────────────────────────────────────────

const COMP_ID_PATTERN = /^comp-/;
const AC_ID_PATTERN = /^AC-/;
const US_ID_PATTERN = /^US-\d+$/;
const VALID_TEST_TYPES = new Set<string>(['unit', 'integration', 'end_to_end']);

// ── Clause check helpers (extracted to keep clause bodies flat) ──

/** Shape issues for a single test case (C-7.1.4). Preserves the
 *  original push order: a missing id short-circuits to one issue;
 *  otherwise expected_outcome then acceptance_criterion_ids. */
function collectTestCaseShapeIssues(
  suiteId: string,
  tc: TestCase,
): Array<{ suiteId: string; testId: string; reason: string }> {
  if (!tc.test_case_id) {
    return [{ suiteId, testId: '(missing)', reason: 'missing test_case_id' }];
  }
  const issues: Array<{ suiteId: string; testId: string; reason: string }> = [];
  if (typeof tc.expected_outcome !== 'string' || tc.expected_outcome.trim().length === 0) {
    issues.push({
      suiteId,
      testId: tc.test_case_id,
      reason: typeof tc.expected_outcome === 'string' ? 'empty expected_outcome' : `expected_outcome not a string (got ${typeof tc.expected_outcome})`,
    });
  }
  if (!Array.isArray(tc.acceptance_criterion_ids) || tc.acceptance_criterion_ids.length === 0) {
    issues.push({ suiteId, testId: tc.test_case_id, reason: 'empty acceptance_criterion_ids' });
  }
  return issues;
}

/** Set of every AC id declared across functional_requirements artifacts (C-7.1.7). */
function collectKnownAcIds(frArtifacts: ReadonlyArray<unknown>): Set<string> {
  const known = new Set<string>();
  for (const fr of frArtifacts) {
    const stories = (fr as FunctionalRequirementsArtifact).user_stories ?? [];
    for (const us of stories) for (const ac of us.acceptance_criteria ?? []) known.add(ac.id);
  }
  return known;
}

/** AC refs in the test plan that fail to resolve against `known` (C-7.1.7). */
function collectUnresolvedAcRefs(
  testSuites: TestSuite[],
  known: Set<string>,
): Array<{ testId: string; acId: string }> {
  const unresolved: Array<{ testId: string; acId: string }> = [];
  for (const s of testSuites) {
    for (const tc of s.test_cases ?? []) {
      for (const acRef of tc.acceptance_criterion_ids ?? []) {
        // Allow composite refs of the form "<US-id>-AC-…" — extract trailing AC part if present.
        if (AC_ID_PATTERN.test(acRef) && !known.has(acRef)) {
          unresolved.push({ testId: tc.test_case_id, acId: acRef });
        } else if (US_ID_PATTERN.test(acRef)) {
          // Suite-level US ref (rare); skip resolution check.
        }
      }
    }
  }
  return unresolved;
}

export const phase7TestCaseSkeletonContract: ContractSuite<TestPlanArtifact> = {
  boundaryId: '7.1_test_case_skeleton',
  phaseId: '7',
  subPhaseId: 'test_case_skeleton',
  producerArtifactKind: 'test_plan',
  description:
    'Phase 7 test plan — suites are component-keyed; test cases reference valid AC ids.',
  clauses: [
    {
      id: 'C-7.1.1',
      description: 'test_plan.test_suites is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.test_suites) || artifact.test_suites.length === 0) {
          return { message: 'test_suites is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-7.1.2',
      description: 'Every suite has a non-empty suite_id, a non-empty component_id, and a valid test_type.',
      severity: 'blocking',
      check: (artifact) => {
        // component_id namespace varies by project — see C-7.1.6 for the
        // resolvability check. Here we only require an id token, not a
        // specific prefix.
        const bad: Array<{ idx: number; reason: string }> = [];
        artifact.test_suites.forEach((s, idx) => {
          if (!s.suite_id) bad.push({ idx, reason: 'missing suite_id' });
          else if (!s.component_id || typeof s.component_id !== 'string' || s.component_id.includes(' ')) {
            bad.push({ idx, reason: `invalid component_id: ${s.component_id}` });
          } else if (!VALID_TEST_TYPES.has(s.test_type)) bad.push({ idx, reason: `invalid test_type: ${s.test_type}` });
        });
        if (bad.length === 0) return true;
        return { message: `${bad.length} suite(s) have invalid identifiers`, details: { bad } };
      },
    },
    {
      id: 'C-7.1.3',
      description: 'Every suite has at least one test_case.',
      severity: 'blocking',
      check: (artifact) => {
        const bad = artifact.test_suites
          .filter((s) => !Array.isArray(s.test_cases) || s.test_cases.length === 0)
          .map((s) => s.suite_id);
        if (bad.length === 0) return true;
        return { message: `${bad.length} suite(s) have no test_cases`, details: { suiteIds: bad } };
      },
    },
    {
      id: 'C-7.1.4',
      description: 'Every test case has a non-empty test_case_id, non-empty expected_outcome, and non-empty acceptance_criterion_ids array.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ suiteId: string; testId: string; reason: string }> = [];
        for (const s of artifact.test_suites) {
          for (const tc of s.test_cases ?? []) {
            bad.push(...collectTestCaseShapeIssues(s.suite_id, tc));
          }
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} test case(s) have shape issues`, details: { issues: bad.slice(0, 10) } };
      },
    },
    {
      id: 'C-7.1.5',
      description: 'Test case ids are unique within their suite.',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ suiteId: string; dups: string[] }> = [];
        for (const s of artifact.test_suites) {
          const counts = new Map<string, number>();
          for (const tc of s.test_cases ?? []) counts.set(tc.test_case_id, (counts.get(tc.test_case_id) ?? 0) + 1);
          const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
          if (dups.length) bad.push({ suiteId: s.suite_id, dups });
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} suite(s) have duplicate test_case_id`, details: { bad } };
      },
    },
    {
      id: 'C-7.1.6',
      description: 'Every suite.component_id resolves to a component in component_model.',
      severity: 'advisory',
      check: (artifact, context) => {
        const cmArtifacts = context.relatedArtifacts.get('component_model') ?? [];
        if (cmArtifacts.length === 0) return true;
        const known = new Set<string>();
        for (const cm of cmArtifacts) {
          const cmA = cm as ComponentModelArtifact;
          for (const c of cmA.components ?? []) known.add(c.id);
        }
        const unresolved = artifact.test_suites.filter((s) => !known.has(s.component_id)).map((s) => s.component_id);
        if (unresolved.length === 0) return true;
        return { message: `${unresolved.length} suite component_id(s) do not resolve`, details: { componentIds: unresolved } };
      },
    },
    {
      id: 'C-7.1.7',
      description: 'Every AC id referenced in a test_case resolves to an AC in functional_requirements.',
      severity: 'advisory',
      check: (artifact, context) => {
        const frArtifacts = context.relatedArtifacts.get('functional_requirements') ?? [];
        if (frArtifacts.length === 0) return true;
        const known = collectKnownAcIds(frArtifacts);
        const unresolved = collectUnresolvedAcRefs(artifact.test_suites, known);
        if (unresolved.length === 0) return true;
        return { message: `${unresolved.length} AC ref(s) do not resolve`, details: { examples: unresolved.slice(0, 10) } };
      },
    },
  ],
};
