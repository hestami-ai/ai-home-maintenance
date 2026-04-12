/**
 * Information Retrieval capabilities — getStatus, getPhaseHistory, searchRecords, getRecentActivity.
 */

import type { Capability } from '../index';
import type { GovernedStreamRecord, PhaseId, RecordType } from '../../../../types/records';
import { PHASE_NAMES } from '../../../../types/records';
import type { WorkflowStatus } from '../../types';

export const getStatus: Capability<Record<string, never>, WorkflowStatus> = {
  name: 'getStatus',
  category: 'information_retrieval',
  description:
    'Return the current workflow run status: phase, sub-phase, and recent activity.',
  parameters: { type: 'object', properties: {} },
  execute: async (_params, ctx) => {
    if (!ctx.activeRun) {
      return {
        run: null,
        currentPhaseId: null,
        currentSubPhaseId: null,
        status: null,
        recentRecords: [],
      };
    }
    return ctx.db.getWorkflowStatus(ctx.activeRun.id);
  },
  formatResponse: (status) => {
    if (!status.run) return 'No active workflow run.';
    const phase = status.currentPhaseId
      ? `Phase ${status.currentPhaseId} (${PHASE_NAMES[status.currentPhaseId] ?? '?'})`
      : 'No phase';
    const sub = status.currentSubPhaseId ? ` · sub-phase ${status.currentSubPhaseId}` : '';
    const recent = status.recentRecords
      .slice(0, 5)
      .map(r => `- ${r.record_type} (id: ${r.id})`)
      .join('\n');
    return [
      `**Run:** \`${status.run.id}\``,
      `**Status:** ${status.status}`,
      `**Position:** ${phase}${sub}`,
      `**Recent activity:**`,
      recent || '_(none)_',
    ].join('\n');
  },
};

export const getPhaseHistory: Capability<{ phaseId?: PhaseId }, GovernedStreamRecord[]> = {
  name: 'getPhaseHistory',
  category: 'information_retrieval',
  description: 'Return phase gate approval records, optionally filtered to a specific phase.',
  parameters: {
    type: 'object',
    properties: {
      phaseId: { type: 'string', description: 'Optional phase id to filter' },
    },
  },
  execute: async (params, ctx) => {
    if (!ctx.activeRun) return [];
    const all = ctx.db.getRecordsByType('phase_gate_approved', ctx.activeRun.id);
    return params.phaseId ? all.filter(r => r.phase_id === params.phaseId) : all;
  },
  formatResponse: (records) => {
    if (records.length === 0) return 'No phase gate approvals yet.';
    return records.map(r => `- Phase ${r.phase_id} approved at ${r.produced_at} (id: ${r.id})`).join('\n');
  },
};

interface SearchParams {
  query: string;
  recordType?: RecordType;
  phaseId?: string;
  limit?: number;
}

export const searchRecords: Capability<SearchParams, GovernedStreamRecord[]> = {
  name: 'searchRecords',
  category: 'information_retrieval',
  description: 'Full-text search across the Governed Stream. Optionally filter by record type or phase.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keywords' },
      recordType: { type: 'string', description: 'Optional record type filter' },
      phaseId: { type: 'string', description: 'Optional phase id filter' },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
    required: ['query'],
  },
  execute: async (params, ctx) => {
    return ctx.db.ftsSearch(params.query, {
      workflowRunId: ctx.activeRun?.id,
      recordType: params.recordType,
      phaseId: params.phaseId,
      limit: params.limit ?? 10,
    });
  },
  formatResponse: (records) => {
    if (records.length === 0) return 'No matching records.';
    return records
      .map(r => `- [${r.record_type}, phase ${r.phase_id ?? '-'}] [ref:${r.id}]`)
      .join('\n');
  },
};

export const getRecentActivity: Capability<{ limit?: number }, GovernedStreamRecord[]> = {
  name: 'getRecentActivity',
  category: 'information_retrieval',
  description: 'Return the N most recent records on the active workflow run.',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max records (default 10)' },
    },
  },
  execute: async (params, ctx) => {
    if (!ctx.activeRun) return [];
    return ctx.db.getRecentRecords(ctx.activeRun.id, params.limit ?? 10);
  },
  formatResponse: (records) => {
    if (records.length === 0) return 'No recent activity.';
    return records
      .map(r => `- ${r.produced_at} · ${r.record_type} (id: ${r.id})`)
      .join('\n');
  },
};

export const informationRetrievalCapabilities = [
  getStatus,
  getPhaseHistory,
  searchRecords,
  getRecentActivity,
];
