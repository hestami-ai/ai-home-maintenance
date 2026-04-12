/**
 * Context Management capabilities — attachFile, addConstraint, listConstraints.
 */

import type { Capability } from '../index';
import type { GovernedStreamRecord } from '../../../../types/records';
import { AuthorityLevel } from '../../../../types/records';

interface AttachFileParams { uri: string; description?: string }

export const attachFile: Capability<AttachFileParams, { recordId: string; uri: string }> = {
  name: 'attachFile',
  category: 'context_management',
  description: 'Attach a file URI as workflow context (e.g. a reference doc).',
  parameters: {
    type: 'object',
    properties: {
      uri: { type: 'string', description: 'File URI to attach' },
      description: { type: 'string', description: 'Why the file is relevant' },
    },
    required: ['uri'],
  },
  preconditions: (ctx) => (ctx.activeRun ? true : 'No active workflow run.'),
  execute: async (params, ctx) => {
    const record = ctx.orchestrator.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: ctx.activeRun!.id,
      janumicode_version_sha: ctx.orchestrator.janumiCodeVersionSha,
      content: {
        kind: 'attached_file',
        uri: params.uri,
        description: params.description ?? '',
      },
    });
    return { recordId: record.id, uri: params.uri };
  },
  formatResponse: (r) => `Attached \`${r.uri}\` [ref:${r.recordId}].`,
};

interface AddConstraintParams { statement: string; source?: string }

export const addConstraint: Capability<AddConstraintParams, { recordId: string; statement: string }> = {
  name: 'addConstraint',
  category: 'context_management',
  description: 'Add a constraint that future phases must respect.',
  parameters: {
    type: 'object',
    properties: {
      statement: { type: 'string', description: 'The constraint statement' },
      source: { type: 'string', description: 'Where it came from (regulation, stakeholder, etc.)' },
    },
    required: ['statement'],
  },
  preconditions: (ctx) => (ctx.activeRun ? true : 'No active workflow run.'),
  execute: async (params, ctx) => {
    const record = ctx.orchestrator.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: ctx.activeRun!.id,
      janumicode_version_sha: ctx.orchestrator.janumiCodeVersionSha,
      authority_level: AuthorityLevel.HumanEdited,
      content: {
        kind: 'constraint',
        statement: params.statement,
        source: params.source ?? 'user',
      },
    });
    return { recordId: record.id, statement: params.statement };
  },
  formatResponse: (r) => `Constraint added [ref:${r.recordId}]: ${r.statement}`,
};

export const listConstraints: Capability<Record<string, never>, GovernedStreamRecord[]> = {
  name: 'listConstraints',
  category: 'context_management',
  description: 'List all active constraints on the current workflow run.',
  parameters: { type: 'object', properties: {} },
  execute: async (_params, ctx) => {
    if (!ctx.activeRun) return [];
    return ctx.db
      .getRecordsByType('artifact_produced', ctx.activeRun.id)
      .filter(r => r.content?.kind === 'constraint');
  },
  formatResponse: (records) => {
    if (records.length === 0) return 'No constraints active on this run.';
    return records
      .map(r => `- ${(r.content as { statement?: string }).statement ?? '?'} [ref:${r.id}]`)
      .join('\n');
  },
};

export const contextManagementCapabilities = [attachFile, addConstraint, listConstraints];
