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

export const decisionHistoryCapabilities = [explainDecision, listDecisions, getAlternatives];
