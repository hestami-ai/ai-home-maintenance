/**
 * CapabilityBroker — the single chokepoint through which every capability
 * execute() is dispatched.
 *
 * It validates arguments, checks preconditions, enforces the confirmation
 * ritual for GOVERN/destructive capabilities, and — crucially — hands each
 * capability a *tier-scoped* context object it cannot exceed: the READ tier
 * receives a physically-narrowed facade with no `writer` and no engine
 * mutators, so a hallucinating model that calls a READ tool wrongly can
 * change nothing, independent of its reasoning quality.
 *
 * Every failure (unknown tool, missing arg, precondition, execute throw) is
 * converted into a structured observation the ReAct loop can feed back to
 * the model for self-repair, rather than a raw user-facing error string.
 */

import type { CapabilityRegistry, CapabilityContext, ReadCtx } from './index';
import type { ToolCall } from '../../../llm/llmCaller';
import type { CapabilityCallResult } from '../types';
import type { GovernedStreamWriter } from '../../../orchestrator/governedStreamWriter';
import { AuthorityLevel } from '../../../types/records';
import { getLogger } from '../../../logging';

type WriteRecordArg = Parameters<GovernedStreamWriter['writeRecord']>[0];

export class CapabilityBroker {
  constructor(private readonly registry: CapabilityRegistry) {}

  /**
   * Physically-narrowed READ context — a fresh object literal that omits
   * `writer`, `eventBus`, and every engine mutator. `orchestrator` carries
   * only the two read-safe members (DMR research + version). A READ
   * capability handed this object has no reference through which to mutate
   * the governed stream, no matter what the model asked it to do.
   */
  static toReadCtx(ctx: CapabilityContext): ReadCtx {
    return {
      workspaceId: ctx.workspaceId,
      workspaceRoot: ctx.workspaceRoot,
      activeRun: ctx.activeRun,
      currentPhase: ctx.currentPhase,
      currentSubPhase: ctx.currentSubPhase,
      runStatus: ctx.runStatus,
      db: ctx.db,
      orchestrator: {
        deepMemoryResearch: ctx.orchestrator.deepMemoryResearch,
        janumiCodeVersionSha: ctx.orchestrator.janumiCodeVersionSha,
      },
      embedding: ctx.embedding,
      attachments: ctx.attachments,
      references: ctx.references,
    };
  }

  /**
   * PROPOSE-tier context — the full context, but `orchestrator` is narrowed
   * to a writer that refuses to mint authority above HumanEdited (authority
   * elevation is gate-exclusive), plus the version sha, DMR, and a read-only
   * run lookup. The phase-advancing / gate-certifying mutators are physically
   * absent at runtime, so a PROPOSE capability cannot elevate authority or
   * advance the workflow even if the model coaxes it to. GOVERN caps get the
   * full context (post-confirmation).
   */
  static toProposeCtx(ctx: CapabilityContext): CapabilityContext {
    const restrictedWriter = {
      writeRecord: (record: WriteRecordArg) => {
        const authority = (record as { authority_level?: number }).authority_level;
        if (authority != null && authority > AuthorityLevel.HumanEdited) {
          throw new Error(
            `PROPOSE-tier capability may not mint authority ${authority} ` +
              `(> HumanEdited=${AuthorityLevel.HumanEdited}). Authority elevation is gate-exclusive.`,
          );
        }
        return ctx.orchestrator.writer.writeRecord(record);
      },
    };
    return {
      ...ctx,
      orchestrator: {
        writer: restrictedWriter,
        janumiCodeVersionSha: ctx.orchestrator.janumiCodeVersionSha,
        deepMemoryResearch: ctx.orchestrator.deepMemoryResearch,
        stateMachine: {
          getWorkflowRun: (id: string) => ctx.orchestrator.stateMachine.getWorkflowRun(id),
        },
      } as unknown as CapabilityContext['orchestrator'],
    };
  }

  /**
   * Dispatch a single tool call. Never throws — every outcome (success,
   * unknown tool, precondition failure, confirmation-required, execute
   * throw) is returned as a CapabilityCallResult whose `formatted` string
   * is a self-contained observation.
   */
  async dispatch(call: ToolCall, ctx: CapabilityContext): Promise<CapabilityCallResult> {
    const cap = this.registry.get(call.name);
    if (!cap) {
      const available = this.registry.all().map((c) => c.name).join(', ');
      return {
        name: call.name,
        error: `Unknown capability "${call.name}" — the model hallucinated a tool name.`,
        formatted: `**Error:** Unknown capability \`${call.name}\`. Available tools: ${available}`,
      };
    }

    const params = (call.params ?? {}) as Record<string, unknown>;

    // Tier-scoped context — READ gets the physically-narrowed read facade;
    // PROPOSE gets a restricted-writer facade (authority ≤ HumanEdited, no
    // phase/gate mutators); GOVERN gets the full context (post-confirmation).
    let tierCtx: ReadCtx | CapabilityContext = ctx;
    if (cap.tier === 'read') tierCtx = CapabilityBroker.toReadCtx(ctx);
    else if (cap.tier === 'propose') tierCtx = CapabilityBroker.toProposeCtx(ctx);

    // Preconditions (e.g. "no active workflow run").
    const precond = cap.preconditions?.(tierCtx);
    if (precond !== true && precond !== undefined) {
      return {
        name: call.name,
        error: precond,
        formatted: `**Cannot run \`${call.name}\`:** ${precond}`,
      };
    }

    // Confirmation ritual — any capability declaring a `confirmation` (all
    // GOVERN/destructive ones). First call without `confirmed:true` returns
    // the prompt; the loop treats it as a terminal turn.
    if (cap.confirmation) {
      const confirmed = params.confirmed === true;
      if (!confirmed) {
        const prompt = cap.confirmation.prompt(params, tierCtx);
        return {
          name: call.name,
          needsConfirmation: true,
          formatted:
            `**Confirmation required for \`${call.name}\`:** ${prompt}\n\n` +
            `Re-invoke \`${call.name}\` with \`confirmed: true\` once the user agrees.`,
        };
      }
    }

    // Light argument validation — required params present. Deeper schema
    // validation is left to execute(); the goal here is to turn an obvious
    // mistake into a self-repairable observation rather than a throw.
    const missing = requiredMissing(cap.parameters, params);
    if (missing.length > 0) {
      return {
        name: call.name,
        error: `Missing required parameter(s): ${missing.join(', ')}`,
        formatted: `**Error in \`${call.name}\`:** missing required parameter(s): ${missing.join(', ')}.`,
      };
    }

    try {
      const out = await cap.execute(params, tierCtx);
      return {
        name: call.name,
        result: out,
        formatted: cap.formatResponse(out),
        recordIds: extractRecordIdsFromResult(out),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      getLogger().warn('agent', 'Capability execute failed', { name: call.name, error: msg });
      return {
        name: call.name,
        error: msg,
        formatted: `**Error in \`${call.name}\`:** ${msg}`,
      };
    }
  }
}

function requiredMissing(schema: Record<string, unknown>, params: Record<string, unknown>): string[] {
  const required = Array.isArray((schema as { required?: unknown }).required)
    ? ((schema as { required: unknown[] }).required as string[])
    : [];
  return required.filter((k) => params[k] === undefined || params[k] === null);
}

/**
 * Walk a capability result and collect the ids of any embedded governed
 * stream records (objects carrying both `id` and `record_type`), for
 * provenance accumulation in the ReAct loop.
 */
export function extractRecordIdsFromResult(result: unknown): string[] {
  if (!result || typeof result !== 'object') return [];
  const ids = new Set<string>();
  const visit = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
      return;
    }
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      if (typeof obj.id === 'string' && obj.record_type) ids.add(obj.id);
      for (const key of Object.keys(obj)) visit(obj[key]);
    }
  };
  visit(result);
  return [...ids];
}
