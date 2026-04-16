/**
 * Decision History capabilities — explainDecision, listDecisions, getAlternatives.
 */

import type { Capability } from '../index';
import type { GovernedStreamRecord } from '../../../../types/records';

interface ExplainParams { decisionId: string }

export const explainDecision: Capability<ExplainParams, {
  decision: GovernedStreamRecord | null;
  surface: GovernedStreamRecord | null;
}> = {
  name: 'explainDecision',
  category: 'decision_history',
  description:
    'Explain a decision by fetching its decision_trace record together with the originating mirror or menu it resolved.',
  parameters: {
    type: 'object',
    properties: {
      decisionId: { type: 'string', description: 'The decision_trace record id' },
    },
    required: ['decisionId'],
  },
  execute: async (params, ctx) => {
    const decision = ctx.db.getRecordById(params.decisionId);
    if (!decision) return { decision: null, surface: null };
    const surfaceId = decision.derived_from_record_ids?.[0];
    const surface = surfaceId ? ctx.db.getRecordById(surfaceId) : null;
    return { decision, surface };
  },
  formatResponse: (r) => {
    if (!r.decision) return 'Decision not found.';
    const parts = [
      `### Decision [ref:${r.decision.id}]`,
      '```json\n' + JSON.stringify(r.decision.content, null, 2) + '\n```',
    ];
    if (r.surface) {
      parts.push(
        `\nResolved on: [ref:${r.surface.id}] (${r.surface.record_type})`,
      );
    }
    return parts.join('\n');
  },
};

export const listDecisions: Capability<{ phaseId?: string }, GovernedStreamRecord[]> = {
  name: 'listDecisions',
  category: 'decision_history',
  description: 'List decision_trace records for the current run, optionally filtered to a phase.',
  parameters: {
    type: 'object',
    properties: {
      phaseId: { type: 'string', description: 'Optional phase id filter' },
    },
  },
  execute: async (params, ctx) => {
    if (!ctx.activeRun) return [];
    const all = ctx.db.getRecordsByType('decision_trace', ctx.activeRun.id);
    return params.phaseId ? all.filter(d => d.phase_id === params.phaseId) : all;
  },
  formatResponse: (records) => {
    if (records.length === 0) return 'No decisions yet.';
    return records
      .map(r => `- ${r.produced_at} · ${(r.content as { decision_type?: string }).decision_type ?? '?'} [ref:${r.id}]`)
      .join('\n');
  },
};

interface AltParams { decisionId: string }

export const getAlternatives: Capability<AltParams, GovernedStreamRecord | null> = {
  name: 'getAlternatives',
  category: 'decision_history',
  description: 'Return the menu options that were offered alongside a particular decision.',
  parameters: {
    type: 'object',
    properties: {
      decisionId: { type: 'string', description: 'The decision_trace record id' },
    },
    required: ['decisionId'],
  },
  execute: async (params, ctx) => {
    const decision = ctx.db.getRecordById(params.decisionId);
    if (!decision) return null;
    const surfaceId = decision.derived_from_record_ids?.[0];
    if (!surfaceId) return null;
    return ctx.db.getRecordById(surfaceId);
  },
  formatResponse: (surface) => {
    if (!surface) return 'No alternatives recorded for that decision.';
    return [
      `### Alternatives offered (${surface.record_type}) [ref:${surface.id}]`,
      '```json\n' + JSON.stringify(surface.content, null, 2) + '\n```',
    ].join('\n');
  },
};

// ── escalateInconsistency ────────────────────────────────────────────

interface EscalateParams {
  /** Natural-language description of the inconsistency the user identified. */
  description: string;
  /** Record IDs the user is claiming are in conflict. */
  conflicting_record_ids: string[];
}

/**
 * When a consistency_challenge query reveals a real contradiction, the LLM
 * invokes this capability to escalate to the Orchestrator (§8.11). The
 * engine writes a `consistency_challenge_escalation` record and emits an
 * `inconsistency:escalated` event so the UI banner surfaces. The
 * Orchestrator then manages the bloom-and-prune resolution flow — Client
 * Liaison itself cannot unilaterally trigger rollbacks.
 *
 * This capability is the ONLY path by which the Client Liaison writes an
 * escalation record. A silent `escalatedToOrchestrator: true` synthesis
 * flag without a matching capability call used to be dead code; that
 * gap is closed here.
 */
export const escalateInconsistency: Capability<EscalateParams, {
  escalationRecordId: string;
  conflictingRecordIds: string[];
  description: string;
}> = {
  name: 'escalateInconsistency',
  category: 'decision_history',
  description:
    'Escalate a confirmed inconsistency to the Orchestrator. Use this ONLY when the user has identified a real contradiction between records and the retrieval evidence supports their claim. The Orchestrator handles resolution via bloom-and-prune; you cannot roll back directly.',
  parameters: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Human-readable summary of the inconsistency — what the user believes contradicts what.',
      },
      conflicting_record_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Record IDs of the artifacts or decisions that are claimed to be in conflict.',
      },
    },
    required: ['description', 'conflicting_record_ids'],
  },
  preconditions: (ctx) =>
    ctx.activeRun ? true : 'No active workflow run — nothing to escalate.',
  execute: async (params, ctx) => {
    if (!ctx.activeRun) {
      throw new Error('No active workflow run');
    }
    if (!Array.isArray(params.conflicting_record_ids) || params.conflicting_record_ids.length < 2) {
      throw new Error('escalateInconsistency requires at least two conflicting record IDs.');
    }
    // The engine writes the consistency_challenge_escalation record and
    // emits both `inconsistency:escalated` and `error:occurred` events.
    const escalationRecordId = ctx.orchestrator.escalateInconsistency({
      runId: ctx.activeRun.id,
      userQueryRecordId: params.conflicting_record_ids[0],
      conflictingRecordIds: params.conflicting_record_ids,
      description: params.description,
    });
    return {
      escalationRecordId,
      conflictingRecordIds: params.conflicting_record_ids,
      description: params.description,
    };
  },
  formatResponse: (r) => {
    const idList = r.conflictingRecordIds.map(id => `[ref:${id}]`).join(', ');
    return `Escalated to Orchestrator [ref:${r.escalationRecordId}]: ${r.description}\n\nConflicting records: ${idList}\n\nThe Orchestrator will resolve this via bloom-and-prune. You will see the resolution options surface in a menu.`;
  },
};

export const decisionHistoryCapabilities = [
  explainDecision,
  listDecisions,
  getAlternatives,
  escalateInconsistency,
];
