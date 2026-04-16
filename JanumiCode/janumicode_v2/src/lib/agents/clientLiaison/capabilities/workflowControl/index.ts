/**
 * Workflow Control capabilities — start, pause, resume, cancel.
 */

import type { Capability, CapabilityContext } from '../index';
import type { PhaseId, WorkflowRun } from '../../../../types/records';

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
    return { runId: run.id, status: 'cancelled' };
  },
  formatResponse: (r) => `Workflow ${r.runId} cancelled.`,
};

export const workflowControlCapabilities = [
  startWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  cancelWorkflow,
];
