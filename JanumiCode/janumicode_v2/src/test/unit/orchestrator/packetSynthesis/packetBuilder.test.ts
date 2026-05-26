/**
 * Unit tests for the packet builder.
 */
import { describe, it, expect } from 'vitest';
import {
  buildPackets,
  type BuilderAtomicTask,
  type BuilderComponent,
  type BuilderUserStory,
  type BuilderNfr,
  type BuilderTestSuite,
  type BuilderEvaluationCriterion,
  type BuilderTechnicalConstraint,
  type BuilderComplianceItem,
  type BuilderDataModel,
  type BuilderApiDef,
  type BuilderInput,
} from '../../../../lib/orchestrator/phases/packetSynthesis/packetBuilder';

function atomicTask(overrides: Partial<BuilderAtomicTask['content']['task']> = {}): BuilderAtomicTask {
  return {
    node_id: 'task-node-1',
    content: {
      node_id: 'task-node-1',
      task: {
        id: 'task-001',
        name: 'Implement foo',
        description: 'Implement foo on the bar service',
        component_id: 'comp-001',
        backing_tool: 'claude_code_cli',
        estimated_complexity: 'low',
        completion_criteria: [],
        write_directory_paths: ['src/server/foo'],
        read_directory_paths: [],
        dependency_task_ids: [],
        active_constraints: ['TECH-PG-16'],
        traces_to: [],
        ...overrides,
      },
      release_id: null,
      release_ordinal: null,
    },
  };
}

function emptyInput(): BuilderInput {
  return {
    atomicTasks: [],
    userStories: [],
    nfrs: [],
    componentsById: new Map(),
    dataModels: [],
    apiDefinitions: [],
    testSuites: [],
    evaluationCriteria: [],
    technicalConstraintsById: new Map(),
    complianceItemsById: new Map(),
  };
}

describe('buildPackets — happy path', () => {
  it('builds one packet per atomic task and bundles matching user story', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['US-001'] })],
      userStories: [{
        id: 'US-001',
        role: 'Sharer',
        action: 'shorten URL',
        outcome: 'short URL returned',
        priority: 'critical',
        acceptance_criteria: [
          { id: 'AC-001', description: 'returns 201', measurable_condition: 'HTTP 201' },
        ],
      }],
      componentsById: new Map([['comp-001', {
        id: 'comp-001', name: 'URL Generator',
        responsibilities: [{ id: 'resp-1', description: 'Generate slug' }],
      } as BuilderComponent]]),
    };
    const packets = buildPackets(input);
    expect(packets).toHaveLength(1);
    expect(packets[0].user_stories).toHaveLength(1);
    expect(packets[0].user_stories[0].id).toBe('US-001');
    expect(packets[0].user_stories[0].acceptance_criteria).toHaveLength(1);
    expect(packets[0].component.id).toBe('comp-001');
    expect(packets[0].task.id).toBe('task-001');
  });

  it('resolves user stories via component when task.traces_to does not cite a US directly', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['Generate slug'] })],   // free-text, not a US id
      userStories: [{
        id: 'US-001',
        action: 'shorten URL',
        traces_to: ['comp-001'],   // story traces to component
        acceptance_criteria: [{ id: 'AC-001', description: 'returns 201' }],
      }],
      componentsById: new Map([['comp-001', {
        id: 'comp-001',
        responsibilities: [{ id: 'resp-1', description: 'Generate slug' }],
      } as BuilderComponent]]),
    };
    const packets = buildPackets(input);
    expect(packets[0].user_stories[0].id).toBe('US-001');
  });

  it('bundles test cases matching the packet ACs', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['US-001'] })],
      userStories: [{
        id: 'US-001',
        action: 'shorten URL',
        acceptance_criteria: [{ id: 'AC-001', description: 'returns 201' }],
      }],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
      testSuites: [{
        suite_id: 'suite-001',
        test_cases: [
          { test_case_id: 'TC-001', acceptance_criterion_ids: ['AC-001'], preconditions: [], expected_outcome: 'returns 201' },
          { test_case_id: 'TC-002', acceptance_criterion_ids: ['AC-OTHER'], preconditions: [], expected_outcome: 'unrelated' },
        ],
      }],
    };
    const packets = buildPackets(input);
    expect(packets[0].test_cases).toHaveLength(1);
    expect(packets[0].test_cases[0].test_case_id).toBe('TC-001');
  });

  it('bundles test cases via US-id-prefix composite (ts-16 namespace failure mode)', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['US-001'] })],
      userStories: [{
        id: 'US-001',
        action: 'shorten URL',
        acceptance_criteria: [{ id: 'AC-001', description: 'returns 201' }],
      }],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
      testSuites: [{
        suite_id: 'suite-001',
        test_cases: [
          { test_case_id: 'TC-001', acceptance_criterion_ids: ['US-001-A1'], preconditions: [], expected_outcome: 'returns 201' },
        ],
      }],
    };
    const packets = buildPackets(input);
    expect(packets[0].test_cases).toHaveLength(1);
  });

  it('bundles evaluation criteria matching the packet user stories', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['US-001'] })],
      userStories: [{
        id: 'US-001',
        action: 'shorten URL',
        acceptance_criteria: [{ id: 'AC-001', description: 'returns 201' }],
      }],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
      evaluationCriteria: [
        { kind: 'functional', target_id: 'US-001', evaluation_method: 'API test', success_condition: 'POST returns 201' },
        { kind: 'functional', target_id: 'US-OTHER', evaluation_method: 'foo', success_condition: 'unrelated' },
      ],
    };
    const packets = buildPackets(input);
    expect(packets[0].evaluation_criteria).toHaveLength(1);
    expect(packets[0].evaluation_criteria[0].target_id).toBe('US-001');
  });

  it('resolves active_constraints via the technicalConstraintsById map', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ active_constraints: ['TECH-PG-16'] })],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
      technicalConstraintsById: new Map([['TECH-PG-16', {
        id: 'TECH-PG-16', category: 'database', text: 'Postgres 16+',
      } as BuilderTechnicalConstraint]]),
    };
    const packets = buildPackets(input);
    expect(packets[0].active_constraints).toHaveLength(1);
    expect(packets[0].active_constraints[0].text).toBe('Postgres 16+');
  });

  it('emits placeholder active_constraint when id is referenced but not found (for verifier to flag)', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ active_constraints: ['TECH-UNKNOWN'] })],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
    };
    const packets = buildPackets(input);
    expect(packets[0].active_constraints).toHaveLength(1);
    expect(packets[0].active_constraints[0].id).toBe('TECH-UNKNOWN');
    expect(packets[0].active_constraints[0].text).toBe('');
  });

  it('resolves depends_on_packets from task.dependency_task_ids', () => {
    const taskA: BuilderAtomicTask = atomicTask({ id: 'task-A', dependency_task_ids: [] });
    const taskB: BuilderAtomicTask = atomicTask({ id: 'task-B', dependency_task_ids: ['task-A'] });
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [taskA, taskB],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
    };
    const packets = buildPackets(input);
    const a = packets.find((p) => p.task.id === 'task-A')!;
    const b = packets.find((p) => p.task.id === 'task-B')!;
    expect(a.depends_on_packets).toHaveLength(0);
    expect(b.depends_on_packets).toEqual([a.packet_id]);
  });

  it('emits a packet with empty user_stories when no upstream story matches', () => {
    // Verifier will fail P1 on this — builder just produces the packet.
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ traces_to: ['NOTHING'] })],
      userStories: [{ id: 'US-001', action: 'unrelated', acceptance_criteria: [{ id: 'AC-001', description: 'd' }] }],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
    };
    const packets = buildPackets(input);
    expect(packets[0].user_stories).toHaveLength(0);
  });

  it('emits a packet with empty component fields when component_id does not resolve', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [atomicTask({ component_id: 'comp-unknown' })],
    };
    const packets = buildPackets(input);
    expect(packets[0].component.id).toBe('comp-unknown');
    expect(packets[0].component.responsibilities).toHaveLength(0);
  });

  it('all packet_ids are unique', () => {
    const input: BuilderInput = {
      ...emptyInput(),
      atomicTasks: [
        atomicTask({ id: 'task-A' }),
        atomicTask({ id: 'task-B' }),
        atomicTask({ id: 'task-C' }),
      ],
      componentsById: new Map([['comp-001', { id: 'comp-001', responsibilities: [{ id: 'resp-1', description: 'd' }] }]]),
    };
    const packets = buildPackets(input);
    const ids = new Set(packets.map((p) => p.packet_id));
    expect(ids.size).toBe(3);
  });
});
