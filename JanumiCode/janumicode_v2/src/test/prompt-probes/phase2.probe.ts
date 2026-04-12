/**
 * Prompt probes: Phase 2 — Requirements Definition
 *   2.1 — Functional Requirements Bloom
 *   2.2 — Non-Functional Requirements Bloom
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Functional Requirements Bloom (2.1)', () => {
  it('produces valid functional_requirements with measurable acceptance criteria', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_2_1_functional_requirements',
      agentRole: 'requirements_agent',
      subPhase: '02_1_functional_requirements',
      variables: {
        active_constraints: 'Must work in modern browsers',
        intent_statement_summary: 'TaskFlow — task management platform for small software teams. Features: task creation with priorities, kanban boards, team assignment, email notifications for overdue tasks',
        compliance_context_summary: 'No compliance regimes identified',
        detail_file_path: '/dev/null',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'functional_requirements',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.user_stories)) {
          errors.push('Missing user_stories array');
          return errors;
        }
        const stories = parsed.user_stories as Record<string, unknown>[];
        if (stories.length === 0) errors.push('Expected at least one user story');
        for (let i = 0; i < stories.length; i++) {
          const s = stories[i];
          if (!s.id) errors.push(`Story ${i}: missing id`);
          if (!s.role) errors.push(`Story ${i}: missing role`);
          if (!s.action) errors.push(`Story ${i}: missing action`);
          if (!s.outcome) errors.push(`Story ${i}: missing outcome`);
          if (!Array.isArray(s.acceptance_criteria) || (s.acceptance_criteria as unknown[]).length === 0) {
            errors.push(`Story ${i}: missing acceptance_criteria`);
          }
        }
        return errors;
      },
      judgeRubric: {
        name: 'Functional Requirements Bloom for TaskFlow',
        criteria: [
          'At least 4 user stories covering the features mentioned in the intent (task creation, priorities, kanban boards, team assignment, notifications)',
          'Every user story has the As-a/I-want/so-that structure (role, action, outcome)',
          'Every acceptance_criterion has a measurable_condition that is testable (specific numbers, states, or observable behavior)',
          'No subjective measurable conditions ("fast", "easy", "user-friendly")',
          'No invented features not in the intent',
          'Priority is set on every user story',
        ],
        reasoningCriteria: [
          'The agent decomposed the intent into discrete, independently-implementable user stories',
          'Acceptance criteria are TESTABLE — not aspirational',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});

describe('Probe: Non-Functional Requirements Bloom (2.2)', () => {
  it('produces valid non_functional_requirements with measurable thresholds', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_2_2_nonfunctional_requirements',
      agentRole: 'requirements_agent',
      subPhase: '02_2_nonfunctional_requirements',
      variables: {
        active_constraints: 'Must support 100 concurrent users',
        intent_statement_summary: 'TaskFlow — production-grade task management',
        functional_requirements_summary: '5 user stories covering task CRUD, kanban, notifications',
        compliance_context_summary: 'No compliance regimes',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'non_functional_requirements',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!Array.isArray(parsed.requirements)) {
          errors.push('Missing requirements array');
          return errors;
        }
        const reqs = parsed.requirements as Record<string, unknown>[];
        if (reqs.length === 0) errors.push('Expected at least one NFR');
        for (const r of reqs) {
          if (!r.id) errors.push('NFR missing id');
          if (!r.category) errors.push('NFR missing category');
          if (!r.threshold) errors.push('NFR missing threshold');
        }
        return errors;
      },
      judgeRubric: {
        name: 'Non-Functional Requirements Bloom for TaskFlow',
        criteria: [
          'NFRs cover at least performance and reliability (production-grade product)',
          'Every NFR has a measurable threshold (e.g. "p95 < 300ms", "99.9% uptime")',
          'No vague thresholds ("highly available", "fast", "scalable")',
          'category field uses one of: performance, security, reliability, scalability, accessibility, maintainability',
          'NFRs do not duplicate functional requirements',
        ],
        reasoningCriteria: [
          'The agent set thresholds appropriate for production-grade scope',
          'The agent considered the 100-concurrent-users constraint when setting performance/scalability thresholds',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
