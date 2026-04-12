/**
 * Artifact Interaction capabilities — show, explain, list.
 */

import type { Capability } from '../index';
import type { GovernedStreamRecord, RecordType } from '../../../../types/records';

interface ShowParams {
  recordId?: string;
  artifactType?: RecordType;
  phaseId?: string;
}

export const showArtifact: Capability<ShowParams, GovernedStreamRecord[]> = {
  name: 'showArtifact',
  category: 'artifact_interaction',
  description:
    'Show a specific artifact by record id, OR look up artifacts of a given type/phase.',
  parameters: {
    type: 'object',
    properties: {
      recordId: { type: 'string', description: 'Specific record id to show' },
      artifactType: { type: 'string', description: 'Record type filter (e.g. intent_statement)' },
      phaseId: { type: 'string', description: 'Phase id filter' },
    },
  },
  execute: async (params, ctx) => {
    if (params.recordId) {
      const r = ctx.db.getRecordById(params.recordId);
      return r ? [r] : [];
    }
    if (params.artifactType) {
      const records = ctx.db.getRecordsByType(params.artifactType, ctx.activeRun?.id);
      return params.phaseId ? records.filter(r => r.phase_id === params.phaseId) : records;
    }
    return [];
  },
  formatResponse: (records) => {
    if (records.length === 0) return 'No matching artifact.';
    return records
      .map(r =>
        `### ${r.record_type} [ref:${r.id}]\n` +
        '```json\n' + JSON.stringify(r.content, null, 2) + '\n```',
      )
      .join('\n\n');
  },
};

interface ExplainParams { recordId: string }

export const explainArtifact: Capability<ExplainParams, {
  artifact: GovernedStreamRecord | null;
  derivedFrom: GovernedStreamRecord[];
  decisions: GovernedStreamRecord[];
}> = {
  name: 'explainArtifact',
  category: 'artifact_interaction',
  description:
    'Explain an artifact by fetching it together with the records it derives from and any decision_traces that touch it.',
  parameters: {
    type: 'object',
    properties: {
      recordId: { type: 'string', description: 'The record id to explain' },
    },
    required: ['recordId'],
  },
  execute: async (params, ctx) => {
    const artifact = ctx.db.getRecordById(params.recordId);
    if (!artifact) return { artifact: null, derivedFrom: [], decisions: [] };
    const derivedFrom = ctx.db.getRecordsByIds(artifact.derived_from_record_ids);
    const decisions = ctx.db
      .getRecordsByType('decision_trace', artifact.workflow_run_id)
      .filter(d =>
        Array.isArray(d.derived_from_record_ids) &&
        d.derived_from_record_ids.includes(artifact.id),
      );
    return { artifact, derivedFrom, decisions };
  },
  formatResponse: (r) => {
    if (!r.artifact) return 'Artifact not found.';
    const sections = [
      `### ${r.artifact.record_type} [ref:${r.artifact.id}]`,
      'Derived from: ' +
        (r.derivedFrom.length === 0
          ? '_(nothing)_'
          : r.derivedFrom.map(d => `[ref:${d.id}] (${d.record_type})`).join(', ')),
      'Related decisions: ' +
        (r.decisions.length === 0
          ? '_(none)_'
          : r.decisions.map(d => `[ref:${d.id}]`).join(', ')),
    ];
    return sections.join('\n');
  },
};

export const listArtifacts: Capability<{ phaseId?: string; recordType?: RecordType }, GovernedStreamRecord[]> = {
  name: 'listArtifacts',
  category: 'artifact_interaction',
  description: 'List artifacts on the current run, optionally filtered by phase or type.',
  parameters: {
    type: 'object',
    properties: {
      phaseId: { type: 'string', description: 'Phase id filter' },
      recordType: { type: 'string', description: 'Record type filter' },
    },
  },
  execute: async (params, ctx) => {
    if (!ctx.activeRun) return [];
    if (params.recordType) {
      const records = ctx.db.getRecordsByType(params.recordType, ctx.activeRun.id);
      return params.phaseId ? records.filter(r => r.phase_id === params.phaseId) : records;
    }
    if (params.phaseId) {
      return ctx.db.getRecordsByPhase(params.phaseId as never, ctx.activeRun.id);
    }
    return ctx.db.getRecordsByType('artifact_produced', ctx.activeRun.id);
  },
  formatResponse: (records) => {
    if (records.length === 0) return 'No artifacts.';
    return records
      .map(r => `- [${r.record_type}] [ref:${r.id}] (phase ${r.phase_id ?? '-'})`)
      .join('\n');
  },
};

export const artifactInteractionCapabilities = [showArtifact, explainArtifact, listArtifacts];
