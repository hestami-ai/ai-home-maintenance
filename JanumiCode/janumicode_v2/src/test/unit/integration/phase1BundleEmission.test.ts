/**
 * Regression test for Phase 1's bloom-prune surface migration.
 *
 * Pins that Sub-Phase 1.3 emits exactly ONE `decision_bundle_presented`
 * record (never the old mirror_presented + menu_presented pair), that
 * the bundle's Mirror section carries the per-candidate assumptions,
 * and that the Menu section is conditional — present with >1 candidate,
 * absent with a single candidate.
 *
 * Why this matters: the whole point of the composite bundle is the user
 * can't resolve the Mirror and accidentally bypass the Menu. If the
 * migration ever regresses to a two-record pair, that bug comes back.
 */

import { describe, it, expect } from 'vitest';
import { driveWorkflow, type CapturedStream } from '../../helpers/workflowDriver';
import type { DecisionBundleContent } from '../../../lib/types/decisionBundle';

const MULTI_CANDIDATE_BLOOM = {
  match: 'Intent Domain Bloom',
  parsedJson: {
    candidate_product_concepts: [
      {
        id: 'c1',
        name: 'Personal CLI todo',
        description: 'Local terminal-native task tracker.',
        who_it_serves: 'Solo developers',
        problem_it_solves: 'Terminal-native task management',
        assumptions: ['Local SQLite storage'],
        constraints: ['No network calls'],
        open_questions: ['How are recurring tasks handled?'],
      },
      {
        id: 'c2',
        name: 'Team todo service',
        description: 'Hosted collaborative task tracker.',
        who_it_serves: 'Small teams',
        problem_it_solves: 'Shared task coordination',
        assumptions: ['Server-backed'],
        constraints: [],
        open_questions: [],
      },
    ],
  },
};

const SINGLE_CANDIDATE_BLOOM = {
  match: 'Intent Domain Bloom',
  parsedJson: {
    candidate_product_concepts: [
      {
        id: 'c1',
        name: 'Personal CLI todo',
        description: 'Local terminal-native task tracker.',
        who_it_serves: 'Solo developers',
        problem_it_solves: 'Terminal-native task management',
        assumptions: ['Local SQLite storage'],
        constraints: ['No network calls'],
        open_questions: [],
      },
    ],
  },
};

const VALID_OBJECT_ASSUMPTION_BLOOM = {
  match: 'Intent Domain Bloom',
  parsedJson: {
    candidate_product_concepts: [
      {
        id: 'c-valid',
        name: 'Valid candidate',
        description: 'Already-valid bloom output.',
        who_it_serves: 'Solo developers',
        problem_it_solves: 'Keeps valid JSON on the happy path',
        assumptions: [
          {
            statement: 'A valid JSON bloom should keep its assumption text.',
            basis: 'This is the baseline pass-to-pass behavior for the happy path.',
          },
        ],
        constraints: [],
        open_questions: [],
      },
    ],
  },
};

const RECOVERABLE_TEXT_BLOOM = {
  match: 'Intent Domain Bloom',
  text: `{
    "candidate_product_concepts": [
      {
        "id": "c1",
        "name": "Recovered candidate",
        "description": "Recovered from malformed raw text.",
        "who_it_serves": "Solo developers",
        "problem_it_solves": "Avoids silent fallback cards",
        "assumptions": [
          {
            "inference": 'A malformed JSON string from qwen should still be usable.',
            "basis": "The model produced valid structure with single-quoted string delimiters in one field."
          }
        ],
        "constraints": [],
        "open_questions": []
      }
    ]
  }`,
};

const SYNTHESIS_FIXTURE = {
  match: 'Intent Statement Synthesis',
  parsedJson: {
    product_concept: {
      name: 'CLI todo',
      description: 'Personal task tracker',
      who_it_serves: 'Solo developers',
      problem_it_solves: 'Terminal-native task management',
    },
    confirmed_assumptions: ['Local SQLite storage'],
    confirmed_constraints: ['No network calls'],
    out_of_scope: [],
  },
};

describe('Phase 1 — bloom prune surface (decision bundle emission)', () => {
  let stream: CapturedStream | null = null;
  function tearDown() {
    if (stream) { stream.cleanup(); stream = null; }
  }

  it('emits exactly one decision_bundle_presented record at Sub-Phase 1.3 (multi-candidate case)', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      phaseLimit: '1',
      llmFixtures: { bloom: MULTI_CANDIDATE_BLOOM, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const runId = stream.workflowRunId;
      if (!runId) throw new Error('driveWorkflow did not start a run');
      const db = stream.liaison.getDB();

      // Exactly one bundle at Sub-Phase 1.3 — not a mirror + menu pair.
      const bundles = db.getRecordsByType('decision_bundle_presented', runId)
        .filter(r => r.sub_phase_id === '1.3');
      expect(bundles).toHaveLength(1);

      // The old standalone mirror at 1.3 must NOT appear. menu_presented
      // is no longer a valid record type at all; its absence is enforced
      // by the RecordType union, not by a runtime check.
      const mirrorsAt13 = db.getRecordsByType('mirror_presented', runId)
        .filter(r => r.sub_phase_id === '1.3');
      expect(mirrorsAt13).toHaveLength(0);

      // Bundle content sanity: Mirror section carries at least one
      // assumption, Menu section carries both candidates with the first
      // marked recommended.
      const content = bundles[0].content as unknown as DecisionBundleContent;
      expect(content.surface_id).toContain('phase1-bloom-prune-');
      expect(content.mirror?.items.length ?? 0).toBeGreaterThan(0);
      expect(content.menu).toBeDefined();
      expect(content.menu?.options).toHaveLength(2);
      expect(content.menu?.options[0].recommended).toBe(true);
      expect(content.menu?.multi_select).toBe(true);
    } finally {
      tearDown();
    }
  });

  it('emits a bundle with NO menu section when only one candidate is generated', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      phaseLimit: '1',
      llmFixtures: { bloom: SINGLE_CANDIDATE_BLOOM, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const runId = stream.workflowRunId;
      if (!runId) throw new Error('driveWorkflow did not start a run');
      const db = stream.liaison.getDB();

      const bundles = db.getRecordsByType('decision_bundle_presented', runId)
        .filter(r => r.sub_phase_id === '1.3');
      expect(bundles).toHaveLength(1);

      const content = bundles[0].content as unknown as DecisionBundleContent;
      expect(content.mirror).toBeDefined();
      expect(content.menu).toBeUndefined();
    } finally {
      tearDown();
    }
  });

  it('pass-to-pass: preserves rationale for already-valid assumption objects', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      phaseLimit: '1',
      llmFixtures: { bloom: VALID_OBJECT_ASSUMPTION_BLOOM, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const runId = stream.workflowRunId;
      if (!runId) throw new Error('driveWorkflow did not start a run');
      const db = stream.liaison.getDB();

      const bundles = db.getRecordsByType('decision_bundle_presented', runId)
        .filter(r => r.sub_phase_id === '1.3');
      expect(bundles).toHaveLength(1);

      const content = bundles[0].content as unknown as DecisionBundleContent;
      expect(content.mirror?.items).toHaveLength(1);
      expect(content.mirror?.items[0]?.text).toBe('A valid JSON bloom should keep its assumption text.');
      expect(content.mirror?.items[0]?.rationale).toBe('This is the baseline pass-to-pass behavior for the happy path.');
    } finally {
      tearDown();
    }
  });

  it('fail-to-pass: recovers malformed bloom JSON from raw text instead of emitting the empty fallback card', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      phaseLimit: '1',
      llmFixtures: { bloom: RECOVERABLE_TEXT_BLOOM, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const runId = stream.workflowRunId;
      if (!runId) throw new Error('driveWorkflow did not start a run');
      const db = stream.liaison.getDB();

      const blooms = db.getRecordsByType('artifact_produced', runId)
        .filter(r => r.sub_phase_id === '1.2' && (r.content as { kind?: string }).kind === 'intent_bloom');
      expect(blooms).toHaveLength(1);
      const bloom = blooms[0].content as {
        candidate_product_concepts: Array<{ name: string; assumptions: Array<{ inference?: string; basis?: string } | string> }>;
      };
      expect(bloom.candidate_product_concepts[0]?.name).toBe('Recovered candidate');

      const bundles = db.getRecordsByType('decision_bundle_presented', runId)
        .filter(r => r.sub_phase_id === '1.3');
      expect(bundles).toHaveLength(1);
      const content = bundles[0].content as unknown as DecisionBundleContent;
      expect(content.mirror?.items).toHaveLength(1);
      expect(content.mirror?.items[0]?.text).toContain('A malformed JSON string from qwen should still be usable.');
      expect(content.mirror?.items[0]?.rationale).toContain('single-quoted string delimiters');
      expect(content.summary).toContain('I identified 1 candidate interpretation(s) of your intent.');
    } finally {
      tearDown();
    }
  });

  it('regression: malformed bloom recovery still emits a populated mirror instead of the old 0/0 assumptions surface', async () => {
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      phaseLimit: '1',
      llmFixtures: { bloom: RECOVERABLE_TEXT_BLOOM, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const runId = stream.workflowRunId;
      if (!runId) throw new Error('driveWorkflow did not start a run');
      const db = stream.liaison.getDB();

      const bundles = db.getRecordsByType('decision_bundle_presented', runId)
        .filter(r => r.sub_phase_id === '1.3');
      expect(bundles).toHaveLength(1);
      const content = bundles[0].content as unknown as DecisionBundleContent;
      expect(content.mirror?.items.length ?? 0).toBeGreaterThan(0);
      expect(content.mirror?.items.some(item => item.text.includes('Open question:'))).toBe(false);
    } finally {
      tearDown();
    }
  });

  it('preserves Sub-Phase 1.5 intent-statement mirror as a plain mirror_presented (not a bundle)', async () => {
    // Sanity check that the Stage-3 migration is scoped to 1.3 and didn't
    // accidentally convert the 1.5 approval surface too. 1.5 is a
    // Mirror-only surface with no Menu, so it stays a mirror_presented.
    stream = await driveWorkflow({
      intent: 'Build a CLI todo app',
      phaseLimit: '1',
      llmFixtures: { bloom: MULTI_CANDIDATE_BLOOM, synthesis: SYNTHESIS_FIXTURE },
    });

    try {
      const runId = stream.workflowRunId;
      if (!runId) throw new Error('driveWorkflow did not start a run');
      const db = stream.liaison.getDB();

      const mirrorsAt15 = db.getRecordsByType('mirror_presented', runId)
        .filter(r => r.sub_phase_id === '1.5');
      expect(mirrorsAt15.length).toBeGreaterThan(0);

      // And 1.5 must NOT have been converted to a bundle.
      const bundlesAt15 = db.getRecordsByType('decision_bundle_presented', runId)
        .filter(r => r.sub_phase_id === '1.5');
      expect(bundlesAt15).toHaveLength(0);
    } finally {
      tearDown();
    }
  });
});
