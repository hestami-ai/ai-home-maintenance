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

// ── dryRunResearch ───────────────────────────────────────────────────

interface DryRunResearchParams {
  /** Natural-language description of what the user wants to investigate. */
  query: string;
  /**
   * Scope: 'current_run' = only this run's records, 'all_runs' = all
   * governed stream runs. Defaults to all_runs when omitted because that
   * is almost always what the user means by "research X" interactively.
   */
  scope?: 'current_run' | 'all_runs';
}

interface DryRunResearchResult {
  query: string;
  scope: 'current_run' | 'all_runs';
  completenessStatus: string;
  completenessNarrative: string;
  topicEntities: string[];
  materialFindings: Array<{
    id: string;
    recordType: string;
    authorityLevel: number;
    governingStatus: string;
    summary: string;
    materialityScore: number;
  }>;
  activeConstraints: Array<{ id: string; statement: string; authorityLevel: number }>;
  supersessionCount: number;
  contradictionCount: number;
  openQuestions: Array<{ question: string; sourceRecordId: string }>;
  knownGaps: string[];
}

/**
 * Let the user invoke Deep Memory Research directly. Returns a
 * human-readable summary of what DMR would find for a given query —
 * material findings, active constraints, supersession chains,
 * contradictions, gaps — without taking any downstream action.
 *
 * This is the "show me what you know about X" capability. It's
 * deliberately read-only: the user can verify DMR's reconstruction of
 * the governing state before committing to a decision that depends on
 * it (rollback, escalation, scope change).
 */
export const dryRunResearch: Capability<DryRunResearchParams, DryRunResearchResult> = {
  name: 'dryRunResearch',
  category: 'information_retrieval',
  description:
    'Run a Deep Memory Research query and return a summary of what the agent would find — material findings, active constraints, supersessions, contradictions, gaps. Read-only; no side effects. Use when the user wants to verify what the system knows about a topic before acting on it.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural-language description of what to research.',
      },
      scope: {
        type: 'string',
        enum: ['current_run', 'all_runs'],
        description: 'Retrieval scope — defaults to all_runs.',
      },
    },
    required: ['query'],
  },
  execute: async (params, ctx) => {
    const scope = params.scope ?? 'all_runs';
    const workflowRunId = ctx.activeRun?.id ?? 'dry-run';
    const phaseId = ctx.currentPhase ?? '';
    const subPhaseId = ctx.currentSubPhase ?? 'liaison:dry_run';

    const packet = await ctx.orchestrator.deepMemoryResearch.research({
      requestingAgentRole: 'client_liaison_agent',
      scopeTier: scope,
      query: params.query,
      knownRelevantRecordIds: [],
      workflowRunId,
      phaseId,
      subPhaseId,
    });

    return {
      query: params.query,
      scope,
      completenessStatus: packet.completenessStatus,
      completenessNarrative: packet.completenessNarrative,
      topicEntities: packet.queryDecomposition.topicEntities,
      materialFindings: packet.materialFindings.slice(0, 10).map(f => ({
        id: f.id,
        recordType: f.recordType,
        authorityLevel: f.authorityLevel,
        governingStatus: f.governingStatus,
        summary: f.summary.slice(0, 200),
        materialityScore: Number(f.materialityScore.toFixed(3)),
      })),
      activeConstraints: packet.activeConstraints.map(c => ({
        id: c.id,
        statement: c.statement,
        authorityLevel: c.authorityLevel,
      })),
      supersessionCount: packet.supersessionChains.length,
      contradictionCount: packet.contradictions.length,
      openQuestions: packet.openQuestions.map(q => ({
        question: q.question,
        sourceRecordId: q.sourceRecordId,
      })),
      knownGaps: packet.coverageAssessment.knownGaps,
    };
  },
  formatResponse: (r) => {
    const lines: string[] = [
      `### Deep Memory Research — dry run`,
      `**Query:** "${r.query}"`,
      `**Scope:** ${r.scope}`,
      `**Completeness:** ${r.completenessStatus} — ${r.completenessNarrative}`,
      '',
    ];
    if (r.topicEntities.length > 0) {
      lines.push(
        `**Topic entities identified:** ${r.topicEntities.join(', ')}`,
        '',
      );
    }
    if (r.activeConstraints.length > 0) {
      lines.push('**Active constraints (Authority 6+):**');
      for (const c of r.activeConstraints) {
        lines.push(`- [ref:${c.id}] (authority ${c.authorityLevel}): ${c.statement}`);
      }
      lines.push('');
    }
    if (r.materialFindings.length > 0) {
      lines.push(`**Material findings (${r.materialFindings.length} shown):**`);
      for (const f of r.materialFindings) {
        lines.push(
          `- [ref:${f.id}] \`${f.recordType}\` (authority ${f.authorityLevel}, ${f.governingStatus}, score ${f.materialityScore}): ${f.summary}`,
        );
      }
      lines.push('');
    }
    if (r.supersessionCount > 0) {
      lines.push(`**Supersession chains:** ${r.supersessionCount} detected`);
    }
    if (r.contradictionCount > 0) {
      lines.push(`**Contradictions:** ${r.contradictionCount} detected`);
    }
    if (r.openQuestions.length > 0) {
      lines.push('**Open questions:**');
      for (const q of r.openQuestions) {
        lines.push(`- [ref:${q.sourceRecordId}] ${q.question}`);
      }
    }
    if (r.knownGaps.length > 0) {
      lines.push('**Known gaps in retrieval:**');
      for (const g of r.knownGaps) lines.push(`- ${g}`);
    }
    return lines.join('\n');
  },
};

export const informationRetrievalCapabilities = [
  getStatus,
  getPhaseHistory,
  searchRecords,
  getRecentActivity,
  dryRunResearch,
];
