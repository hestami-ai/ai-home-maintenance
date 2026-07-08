/**
 * Workflow Control capabilities — start, pause, resume, cancel.
 */

import type { Capability, CapabilityContext } from '../index';
import type { PhaseId, WorkflowRun } from '../../../../types/records';
import { AuthorityLevel } from '../../../../types/records';
import { endRun as aoddEndRun } from '../../../../aodd';

interface StartWorkflowParams {
  intent: string;
  attachments?: string[];
}

interface StartWorkflowResult {
  runId: string;
  phase: PhaseId;
  phase0Failed: boolean;
  error?: string;
}

export const startWorkflow: Capability<StartWorkflowParams, StartWorkflowResult> = {
  name: 'startWorkflow',
  category: 'workflow_control',
  tier: 'govern',
  description:
    'Start a new workflow run to build something. Use when the user expresses intent to create or build a new project.',
  parameters: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: "The user's raw intent text, verbatim if possible",
      },
      attachments: {
        type: 'array',
        items: { type: 'string' },
        description: 'File URIs the user attached as context',
      },
    },
    required: ['intent'],
  },
  preconditions: (ctx) => {
    if (ctx.activeRun?.status === 'in_progress') {
      return 'A workflow is already active. Cancel it first or ask the user to confirm replacement.';
    }
    return true;
  },
  execute: async (params, ctx) => {
    const { run, trace } = ctx.orchestrator.startWorkflowRun(ctx.workspaceId, params.intent);

    if (params.attachments?.length) {
      for (const uri of params.attachments) {
        ctx.orchestrator.writer.writeRecord({
          record_type: 'artifact_produced',
          schema_version: '1.0',
          workflow_run_id: run.id,
          phase_id: '0',
          janumicode_version_sha: ctx.orchestrator.janumiCodeVersionSha,
          content: { kind: 'attached_file', uri },
        });
      }
    }

    // Run Phase 0. If it fails (e.g. missing schema, failed invariant),
    // surface the error to the user and leave the run paused at Phase 0 —
    // do NOT advance to Phase 1 over a broken foundation.
    const phase0Result = await ctx.orchestrator.executeCurrentPhase(run.id, trace);
    if (!phase0Result.success) {
      return {
        runId: run.id,
        phase: '0' as PhaseId,
        phase0Failed: true,
        error: phase0Result.error ?? 'Phase 0 failed with no error message',
      };
    }

    // Advance to Phase 1 and kick it off. Phase 1 pauses internally on the
    // bloom mirror; it's fire-and-forget here so we can return the intent
    // acknowledgement to the user immediately.
    const advanced = ctx.orchestrator.advanceToNextPhase(run.id, '1');
    if (!advanced) {
      return {
        runId: run.id,
        phase: '0' as PhaseId,
        phase0Failed: true,
        error: 'Could not advance from Phase 0 to Phase 1',
      };
    }
    void ctx.orchestrator.executeCurrentPhase(run.id, trace);

    return { runId: run.id, phase: '1' as PhaseId, phase0Failed: false };
  },
  formatResponse: (result) => {
    if (result.phase0Failed) {
      return `Started workflow run \`${result.runId}\` but Phase 0 failed: ${result.error}`;
    }
    return `Started workflow run \`${result.runId}\`. Now in Phase ${result.phase}.`;
  },
};

interface RunIdParams { runId?: string }

function resolveRun(ctx: CapabilityContext, runId?: string): WorkflowRun | null {
  if (runId) return ctx.orchestrator.stateMachine.getWorkflowRun(runId);
  return ctx.activeRun;
}

export const pauseWorkflow: Capability<RunIdParams, { runId: string; note: string }> = {
  name: 'pauseWorkflow',
  category: 'workflow_control',
  tier: 'propose',
  description:
    'Acknowledge a user request to pause the active workflow. Writes a control record; phase handlers naturally pause at the next human-in-loop surface.',
  parameters: {
    type: 'object',
    properties: {
      runId: { type: 'string', description: 'Optional explicit run id' },
    },
  },
  preconditions: (ctx) => (ctx.activeRun ? true : 'No active workflow run to pause.'),
  execute: async (params, ctx) => {
    const run = resolveRun(ctx, params.runId);
    if (!run) throw new Error('Run not found');
    ctx.orchestrator.writer.writeRecord({
      record_type: 'warning_acknowledged',
      schema_version: '1.0',
      workflow_run_id: run.id,
      janumicode_version_sha: ctx.orchestrator.janumiCodeVersionSha,
      content: { kind: 'pause_requested', note: 'User requested workflow pause via Client Liaison.' },
    });
    return { runId: run.id, note: 'Pause acknowledged. Workflow halts at the next human-in-loop surface.' };
  },
  formatResponse: (r) => `Workflow ${r.runId}: ${r.note}`,
};

export const resumeWorkflow: Capability<RunIdParams, { runId: string; note: string }> = {
  name: 'resumeWorkflow',
  category: 'workflow_control',
  tier: 'govern',
  description:
    'Resume a previously paused workflow run by re-invoking the current phase handler.',
  parameters: {
    type: 'object',
    properties: {
      runId: { type: 'string', description: 'Optional explicit run id' },
    },
  },
  execute: async (params, ctx) => {
    const run = resolveRun(ctx, params.runId);
    if (!run) throw new Error('Run not found');
    void ctx.orchestrator.executeCurrentPhase(run.id);
    return { runId: run.id, note: 'Phase execution resumed.' };
  },
  formatResponse: (r) => `Workflow ${r.runId} resumed.`,
};

interface CancelParams extends RunIdParams { confirmed?: boolean }

export const cancelWorkflow: Capability<CancelParams, { runId: string; status: string }> = {
  name: 'cancelWorkflow',
  category: 'workflow_control',
  tier: 'govern',
  description:
    'Cancel the active workflow run. DESTRUCTIVE. The framework will ask the user to confirm before executing; re-invoke with `confirmed: true` once the user agrees.',
  parameters: {
    type: 'object',
    properties: {
      runId: { type: 'string', description: 'Optional explicit run id' },
      confirmed: {
        type: 'boolean',
        description: 'Must be true on the second invocation, after the user has agreed.',
      },
    },
  },
  preconditions: (ctx) => (ctx.activeRun ? true : 'No active workflow run to cancel.'),
  // Declarative confirmation — synthesizer intercepts the first call and
  // surfaces this prompt to the user. Replaces the old pattern where
  // execute() threw if `confirmed` was missing, which was a poor UX
  // because the LLM saw it as an error.
  confirmation: {
    prompt: (params, ctx) => {
      const run = resolveRun(ctx, params.runId);
      const id = run?.id ?? '(current run)';
      return `This will cancel workflow ${id} and mark it as failed. Any work in progress will be lost. Confirm?`;
    },
  },
  execute: async (params, ctx) => {
    const run = resolveRun(ctx, params.runId);
    if (!run) throw new Error('Run not found');
    ctx.orchestrator.stateMachine.failWorkflowRun(run.id);
    // AODD: emit run.failed + close the trace. Mirrors the success
    // path's aoddEndRun call in orchestratorEngine.ts. The user-initiated
    // cancel is recorded as the failure reason.
    aoddEndRun({
      status: 'failed',
      error: { message: 'workflow cancelled by user' },
    });
    return { runId: run.id, status: 'cancelled' };
  },
  formatResponse: (r) => `Workflow ${r.runId} cancelled.`,
};

interface RegenerateCollectionParams {
  /** e.g. 'user_journeys', 'requirements', 'components'. */
  collectionKind: string;
  /** Free-text guidance, e.g. "generate more journeys for the admin persona". */
  guidance: string;
  /** Optional phase id of the collection (defaults to the current phase). */
  phaseId?: string;
  confirmed?: boolean;
}

interface RegenerateCollectionResult {
  requestId: string;
  mode: 'rebloom_pending_gate' | 'recorded_pending_revision';
  decisionId?: string;
  collectionKind: string;
}

/**
 * REGENERATE mode ("generate more") — ask the workflow to produce ADDITIONAL
 * items for a collection (e.g. the user-journey bloom under-generated), never
 * a direct artifact edit. DESTRUCTIVE-ish (re-runs a bloom) → confirmation
 * required. Routing:
 *
 *   Case A — a bloom gate is OPEN for this run: resolve it with the guidance
 *     as `free_text_feedback`, which wakes the existing
 *     `runBloomRoundWithFeedbackLoop` (it re-runs the proposer with the
 *     guidance). This reuses proven machinery and is the low-risk path.
 *
 *   Case B — the collection is PAST its gate: the governed request record is
 *     recorded and surfaced; the scoped re-bloom of a CERTIFIED collection
 *     (delta-only re-certification that preserves the accepted core, plus the
 *     scope-gatekeeper human-authored exclusion) is deferred to work that must
 *     be validated on a live cal run before it mutates a certified gate.
 *
 * A `collection_regeneration_requested` record is always written so the ask
 * is governed and auditable regardless of which path runs.
 */
export const regenerateCollection: Capability<RegenerateCollectionParams, RegenerateCollectionResult> = {
  name: 'regenerateCollection',
  category: 'workflow_control',
  tier: 'govern',
  description:
    'Ask the workflow to GENERATE MORE items for a collection (e.g. "generate more user journeys"), preserving items already accepted. Re-runs a bloom — the framework asks the user to confirm first; re-invoke with `confirmed: true` once they agree.',
  parameters: {
    type: 'object',
    properties: {
      collectionKind: {
        type: 'string',
        description: 'The collection to expand, e.g. user_journeys, requirements, components.',
      },
      guidance: {
        type: 'string',
        description: 'What more to generate, e.g. "more journeys for the admin and auditor personas".',
      },
      phaseId: { type: 'string', description: 'Optional phase id of the collection.' },
      confirmed: {
        type: 'boolean',
        description: 'Must be true on the second invocation, after the user has agreed.',
      },
    },
    required: ['collectionKind', 'guidance'],
  },
  preconditions: (ctx) => (ctx.activeRun ? true : 'No active workflow run.'),
  confirmation: {
    prompt: (params) =>
      `This will re-run the ${params.collectionKind} bloom with your guidance ("${params.guidance}") to generate additional items, preserving what is already accepted. Confirm?`,
  },
  execute: async (params, ctx) => {
    const engine = ctx.orchestrator;
    const runId = ctx.activeRun!.id;

    // 1. Always write the governed, auditable request record.
    const request = engine.writer.writeRecord({
      record_type: 'collection_regeneration_requested',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: params.phaseId ?? ctx.currentPhase ?? null,
      produced_by_agent_role: 'human_author',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      authority_level: AuthorityLevel.HumanEdited,
      content: {
        kind: 'collection_regeneration_requested',
        collection_kind: params.collectionKind,
        guidance: params.guidance,
        preserve_accepted: true,
        provenance: 'human_authored',
      },
    });

    // 2. Case A — an open bloom gate: resolve it with the guidance as
    //    free_text_feedback, waking runBloomRoundWithFeedbackLoop.
    const pendingBundles = engine
      .pendingDecisionSurfaces(runId)
      .filter((p) => p.surfaceType === 'decision_bundle');
    for (const p of pendingBundles) {
      const woke = engine.resolveDecision(p.decisionId, {
        type: 'decision_bundle_resolution',
        payload: { free_text_feedback: params.guidance },
      });
      if (woke) {
        return {
          requestId: request.id,
          mode: 'rebloom_pending_gate',
          decisionId: p.decisionId,
          collectionKind: params.collectionKind,
        };
      }
    }

    // 3. Case B — no open gate: the request stands for the next revision.
    return {
      requestId: request.id,
      mode: 'recorded_pending_revision',
      collectionKind: params.collectionKind,
    };
  },
  formatResponse: (r) =>
    r.mode === 'rebloom_pending_gate'
      ? `Re-running the ${r.collectionKind} bloom now with your guidance to generate additional items [ref:${r.requestId}].`
      : `Recorded your request to generate more ${r.collectionKind} [ref:${r.requestId}]. It will be applied when this collection is next revised at its gate.`,
};

export const workflowControlCapabilities = [
  startWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  cancelWorkflow,
  regenerateCollection,
];
