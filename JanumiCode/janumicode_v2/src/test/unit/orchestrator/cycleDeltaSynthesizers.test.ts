/**
 * Unit tests for deterministic cycle-delta synthesizers.
 */
import { describe, it, expect } from 'vitest';
import {
  synthesizeDeltaTasks,
  synthesizeDeltaTestCases,
  synthesizeDeltaEvaluations,
} from '../../../lib/orchestrator/phases/cycleDeltaSynthesizers';
import type { CycleRestartSeed } from '../../../lib/orchestrator/phases/cycleSeed';

function emptySeed(): CycleRestartSeed {
  return {
    orphanUserStoryIds: new Set(),
    orphanAcceptanceCriteria: [],
    orphanEvaluationTargets: new Set(),
  };
}

describe('synthesizeDeltaTasks', () => {
  it('produces one task per orphan user story', () => {
    const seed = emptySeed();
    seed.orphanUserStoryIds.add('US-001');
    seed.orphanUserStoryIds.add('US-002');
    const tasks = synthesizeDeltaTasks({
      existingTasks: [],
      seed,
      userStoriesById: new Map([
        ['US-001', { id: 'US-001', role: 'Sharer', action: 'shorten URL', outcome: 'short URL returned' }],
        ['US-002', { id: 'US-002', role: 'Clicker', action: 'follow URL', outcome: 'redirected' }],
      ]),
      defaultComponentId: 'comp-001',
    });
    expect(tasks).toHaveLength(2);
    expect(tasks[0].traces_to).toContain('US-001');
    expect(tasks[1].traces_to).toContain('US-002');
    expect(tasks[0].description).toContain('US-001');
    expect(tasks[0].description).toContain('shorten URL');
  });

  it('is idempotent — skips US already covered by an existing task', () => {
    const seed = emptySeed();
    seed.orphanUserStoryIds.add('US-001');
    seed.orphanUserStoryIds.add('US-002');
    const tasks = synthesizeDeltaTasks({
      existingTasks: [{
        id: 'task-existing', name: 'existing', description: 'd',
        task_type: 'standard', component_id: 'comp-001', component_responsibility: 'r',
        backing_tool: 'cli', estimated_complexity: 'low',
        completion_criteria: [], write_directory_paths: [], read_directory_paths: [],
        dependency_task_ids: [], traces_to: ['US-001'],
      }],
      seed,
      userStoriesById: new Map(),
      defaultComponentId: 'comp-001',
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].traces_to).toContain('US-002');
  });

  it('returns empty array when seed has no orphan stories', () => {
    expect(synthesizeDeltaTasks({
      existingTasks: [], seed: emptySeed(),
      userStoriesById: new Map(), defaultComponentId: 'comp-001',
    })).toEqual([]);
  });

  it('falls back gracefully when US is not in the lookup map', () => {
    const seed = emptySeed();
    seed.orphanUserStoryIds.add('US-MISSING');
    const tasks = synthesizeDeltaTasks({
      existingTasks: [], seed,
      userStoriesById: new Map(), defaultComponentId: 'comp-001',
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].traces_to).toContain('US-MISSING');
    expect(tasks[0].description).toContain('US-MISSING');
  });
});

describe('synthesizeDeltaTestCases', () => {
  it('produces one test case per orphan AC', () => {
    const seed = emptySeed();
    seed.orphanAcceptanceCriteria.push({ usId: 'US-001', acId: 'AC-001' });
    seed.orphanAcceptanceCriteria.push({ usId: 'US-002', acId: 'AC-003' });
    const result = synthesizeDeltaTestCases({
      existingSuites: [],
      seed,
      acsByCompositeId: new Map([
        ['US-001/AC-001', { measurable_condition: 'HTTP 201 returned' }],
        ['US-002/AC-003', { description: '404 on unknown slug' }],
      ]),
      defaultComponentId: 'comp-001',
    });
    expect(result.newSuite).toBeDefined();
    expect(result.newSuite!.test_cases).toHaveLength(2);
    expect(result.newSuite!.test_cases[0].acceptance_criterion_ids).toEqual(['AC-001']);
    expect(result.newSuite!.test_cases[0].expected_outcome).toBe('HTTP 201 returned');
    expect(result.newSuite!.test_cases[1].expected_outcome).toBe('404 on unknown slug');
  });

  it('is idempotent — skips ACs already covered by an existing test', () => {
    const seed = emptySeed();
    seed.orphanAcceptanceCriteria.push({ usId: 'US-001', acId: 'AC-001' });
    seed.orphanAcceptanceCriteria.push({ usId: 'US-002', acId: 'AC-002' });
    const result = synthesizeDeltaTestCases({
      existingSuites: [{
        suite_id: 'existing', component_id: 'comp-001', test_type: 'integration',
        test_cases: [{
          test_case_id: 'TC-existing', type: 'functional',
          acceptance_criterion_ids: ['AC-001'], preconditions: [], expected_outcome: 'covered',
        }],
      }],
      seed,
      acsByCompositeId: new Map(),
      defaultComponentId: 'comp-001',
    });
    expect(result.newSuite!.test_cases).toHaveLength(1);
    expect(result.newSuite!.test_cases[0].acceptance_criterion_ids).toEqual(['AC-002']);
  });

  it('returns null suite when nothing to synthesize', () => {
    expect(synthesizeDeltaTestCases({
      existingSuites: [], seed: emptySeed(),
      acsByCompositeId: new Map(), defaultComponentId: 'comp-001',
    }).newSuite).toBeNull();
  });
});

describe('synthesizeDeltaEvaluations', () => {
  it('emits functional criterion for US-* targets', () => {
    const seed = emptySeed();
    seed.orphanEvaluationTargets.add('US-001');
    const result = synthesizeDeltaEvaluations({
      existingFunctional: [], existingQuality: [], seed,
      acsByUsId: new Map([['US-001', [{ id: 'AC-001' }, { id: 'AC-002' }]]]),
    });
    expect(result.newFunctional).toHaveLength(1);
    expect(result.newFunctional[0].functional_requirement_id).toBe('US-001');
    expect(result.newFunctional[0].success_condition).toContain('AC-001');
    expect(result.newQuality).toHaveLength(0);
  });

  it('emits quality criterion for NFR-* targets', () => {
    const seed = emptySeed();
    seed.orphanEvaluationTargets.add('NFR-001');
    const result = synthesizeDeltaEvaluations({
      existingFunctional: [], existingQuality: [], seed,
      acsByUsId: new Map(),
    });
    expect(result.newQuality).toHaveLength(1);
    expect(result.newQuality[0].nonfunctional_requirement_id).toBe('NFR-001');
    expect(result.newFunctional).toHaveLength(0);
  });

  it('is idempotent — skips targets already covered', () => {
    const seed = emptySeed();
    seed.orphanEvaluationTargets.add('US-001');
    seed.orphanEvaluationTargets.add('US-002');
    const result = synthesizeDeltaEvaluations({
      existingFunctional: [{
        functional_requirement_id: 'US-001',
        evaluation_method: 'existing', success_condition: 'covered',
      }],
      existingQuality: [], seed,
      acsByUsId: new Map(),
    });
    expect(result.newFunctional).toHaveLength(1);
    expect(result.newFunctional[0].functional_requirement_id).toBe('US-002');
  });

  it('returns empty result when seed has no orphan eval targets', () => {
    const result = synthesizeDeltaEvaluations({
      existingFunctional: [], existingQuality: [], seed: emptySeed(),
      acsByUsId: new Map(),
    });
    expect(result.newFunctional).toEqual([]);
    expect(result.newQuality).toEqual([]);
  });
});
