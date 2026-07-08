/**
 * Context Management capabilities — attachFile, addConstraint, listConstraints.
 */

import type { Capability, ReadCtx } from '../index';
import type { GovernedStreamRecord } from '../../../../types/records';
import { AuthorityLevel } from '../../../../types/records';

interface AttachFileParams { uri: string; description?: string }

export const attachFile: Capability<AttachFileParams, { recordId: string; uri: string }> = {
  name: 'attachFile',
  category: 'context_management',
  tier: 'propose',
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
  tier: 'propose',
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

interface AuthorItemParams {
  /** The item kind, e.g. user_journey, requirement, component, acceptance_criterion. */
  kind: string;
  title?: string;
  description?: string;
  /** Any additional structured fields for the item. */
  fields?: Record<string, unknown>;
  /** Optional id of the collection/artifact this item joins. */
  collectionId?: string;
}

/**
 * AUTHOR mode — the user manually adds a NEW item (e.g. a user journey the
 * bloom under-generated). It enters the governed stream as a proper
 * HUMAN-AUTHORED artifact and is picked up by the workflow like a generated
 * item; it reaches certified authority only through the phase gate.
 *
 * Two integrity requirements, both handled here:
 *   1. `authority_level: HumanEdited` is passed EXPLICITLY — otherwise a
 *      bloom-sub-phase `artifact_produced` defaults to Authority 1
 *      (Exploratory) and the hand-authored item looks agent-generated
 *      (reverse authority-laundering). The PROPOSE tier caps authority at
 *      HumanEdited, so this is the ceiling by construction.
 *   2. `content.provenance = 'human_authored'` marks it so a later scoped
 *      re-bloom's scope-gatekeeper excludes it from its prune set (that
 *      exclusion lands with the re-bloom routing).
 */
export const authorItem: Capability<AuthorItemParams, { recordId: string; kind: string }> = {
  name: 'authorItem',
  category: 'context_management',
  tier: 'propose',
  description:
    'Add a NEW item authored by the user (e.g. a user journey, requirement, or component the workflow did not generate). The item enters the governed stream as a human-authored artifact and is picked up by the workflow like a generated item. Use when the user wants to manually add an item to a collection.',
  parameters: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        description: 'The item kind, e.g. user_journey, requirement, component, acceptance_criterion.',
      },
      title: { type: 'string', description: 'Short title / name of the item.' },
      description: { type: 'string', description: 'The item body / full description.' },
      fields: { type: 'object', description: 'Any additional structured fields for the item.' },
      collectionId: { type: 'string', description: 'Optional id of the collection this item joins.' },
    },
    required: ['kind'],
  },
  preconditions: (ctx) => (ctx.activeRun ? true : 'No active workflow run.'),
  execute: async (params, ctx) => {
    const record = ctx.orchestrator.writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: ctx.activeRun!.id,
      janumicode_version_sha: ctx.orchestrator.janumiCodeVersionSha,
      authority_level: AuthorityLevel.HumanEdited,
      produced_by_agent_role: 'human_author',
      content: {
        kind: 'human_authored_item',
        item_kind: params.kind,
        title: params.title ?? '',
        description: params.description ?? '',
        fields: params.fields ?? {},
        collection_id: params.collectionId,
        provenance: 'human_authored',
        authored_by: 'user',
      },
    });
    return { recordId: record.id, kind: params.kind };
  },
  formatResponse: (r) =>
    `Added your ${r.kind} [ref:${r.recordId}]. It enters the workflow as a human-authored item and will be reviewed at the phase gate like any generated item.`,
};

interface SubmitItemFeedbackParams {
  /** The governed_stream record id of the item the feedback is about. */
  targetRecordId: string;
  /** The user's feedback — a correction, nuance, or request. */
  feedbackText: string;
  /** Optional semantic id of the item (e.g. US-003). */
  anchorItemId?: string;
  /** Whether the feedback is about this item or its whole collection. */
  scope?: 'item' | 'collection';
}

/**
 * REFINE mode (feedback half) — attach the user's free-text feedback to a
 * SPECIFIC item, anchored to that item's record. This is the item-scoped
 * feedback primitive that was missing (every prior write path was coarse and
 * run-level). It is INERT: the target artifact is NOT modified. The
 * orchestrator picks the feedback up when the item's collection is next
 * revised. Regeneration ("generate more") and the scoped re-bloom that
 * consumes this feedback land with the re-bloom routing.
 */
export const submitItemFeedback: Capability<SubmitItemFeedbackParams, { recordId: string; targetRecordId: string }> = {
  name: 'submitItemFeedback',
  category: 'context_management',
  tier: 'propose',
  description:
    "Attach the user's free-text feedback (a correction or nuance) to a SPECIFIC item, anchored to that item. Records the feedback in the governed stream WITHOUT modifying the item; the workflow applies it when the item's collection is next revised. Use for line-item feedback on a requirement / journey / component.",
  parameters: {
    type: 'object',
    properties: {
      targetRecordId: {
        type: 'string',
        description: 'The governed_stream record id of the item the feedback is about.',
      },
      feedbackText: { type: 'string', description: "The user's feedback — a correction, nuance, or request." },
      anchorItemId: { type: 'string', description: 'Optional semantic id of the item (e.g. US-003).' },
      scope: {
        type: 'string',
        enum: ['item', 'collection'],
        description: 'Whether the feedback is about this item or its whole collection.',
      },
    },
    required: ['targetRecordId', 'feedbackText'],
  },
  preconditions: (ctx) => (ctx.activeRun ? true : 'No active workflow run.'),
  execute: async (params, ctx) => {
    const record = ctx.orchestrator.writer.writeRecord({
      record_type: 'human_item_feedback',
      schema_version: '1.0',
      workflow_run_id: ctx.activeRun!.id,
      janumicode_version_sha: ctx.orchestrator.janumiCodeVersionSha,
      authority_level: AuthorityLevel.HumanEdited,
      produced_by_agent_role: 'human_author',
      derived_from_record_ids: [params.targetRecordId],
      content: {
        kind: 'human_item_feedback',
        target_record_id: params.targetRecordId,
        anchor_item_id: params.anchorItemId,
        feedback_text: params.feedbackText,
        scope: params.scope ?? 'item',
        provenance: 'human_authored',
      },
    });
    return { recordId: record.id, targetRecordId: params.targetRecordId };
  },
  formatResponse: (r) =>
    `Recorded your feedback on [ref:${r.targetRecordId}]. It stays attached to that item and is applied when its collection is next revised.`,
};

export const listConstraints: Capability<Record<string, never>, GovernedStreamRecord[], ReadCtx> = {
  name: 'listConstraints',
  category: 'context_management',
  tier: 'read',
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

export const contextManagementCapabilities = [
  attachFile,
  addConstraint,
  authorItem,
  submitItemFeedback,
  listConstraints,
];
