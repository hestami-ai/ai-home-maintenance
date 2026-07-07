/**
 * Increment 3 — server-side slash resolution (slash = capability).
 *
 * The hardcoded client-side switch is gone; the host resolves a slash
 * command to a capability name via the registry (+ a small alias table),
 * restricted to zero-argument capabilities. Unknown slashes and
 * argument-taking capabilities resolve to null so the text flows into the
 * natural-language ReAct loop instead. GPU-free (MockLLMProvider).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { driveWorkflow, type CapturedStream } from '../../helpers/workflowDriver';

const BLOOM_FIXTURE = {
  match: 'Intent Domain Bloom',
  parsedJson: {
    candidate_product_concepts: [
      {
        id: 'c1',
        name: 'Personal task tracker',
        description: 'Local CLI todo.',
        who_it_serves: 'Solo developers',
        problem_it_solves: 'Terminal task management',
        assumptions: [],
        constraints: [],
        open_questions: [],
      },
    ],
  },
};
const SYNTHESIS_FIXTURE = {
  match: 'Intent Statement Synthesis',
  parsedJson: {
    product_concept: {
      name: 'todo',
      description: 'x',
      who_it_serves: 'devs',
      problem_it_solves: 'y',
    },
    confirmed_assumptions: [],
    confirmed_constraints: [],
    out_of_scope: [],
  },
};

describe('slash command resolution (Increment 3)', () => {
  let stream: CapturedStream | null = null;
  afterEach(() => {
    stream?.cleanup();
    stream = null;
  });

  it('maps capability slashes + aliases; unknown or argument-taking → null', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      llmFixtures: { bloom: BLOOM_FIXTURE, synthesis: SYNTHESIS_FIXTURE },
    });
    const l = stream.liaison;

    // Friendly aliases.
    expect(l.resolveSlashCommand('status')).toBe('getStatus');
    expect(l.resolveSlashCommand('activity')).toBe('getRecentActivity');
    // Leading slash tolerated.
    expect(l.resolveSlashCommand('/status')).toBe('getStatus');
    // Exact capability names (zero-arg).
    expect(l.resolveSlashCommand('help')).toBe('help');
    expect(l.resolveSlashCommand('getStatus')).toBe('getStatus');
    expect(l.resolveSlashCommand('listConstraints')).toBe('listConstraints');
    // Case-insensitive.
    expect(l.resolveSlashCommand('GetStatus')).toBe('getStatus');
    // Argument-taking capability → null (routes to the loop which supplies args).
    expect(l.resolveSlashCommand('searchRecords')).toBeNull();
    // Unknown command → null (natural-language fallthrough).
    expect(l.resolveSlashCommand('deploy')).toBeNull();
    expect(l.resolveSlashCommand('')).toBeNull();
  });
});
