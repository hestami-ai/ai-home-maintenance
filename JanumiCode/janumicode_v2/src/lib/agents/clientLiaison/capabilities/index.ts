/**
 * CapabilityRegistry — central registry for the 19 Universal Router
 * capabilities. Generates provider-specific tool schemas for native LLM
 * tool-calling.
 */

import type { OrchestratorEngine } from '../../../orchestrator/orchestratorEngine';
import type { EventBus } from '../../../events/eventBus';
import type { EmbeddingService } from '../../../embedding/embeddingService';
import type { ToolDefinition } from '../../../llm/llmCaller';
import type { ClientLiaisonDB } from '../db';
import type {
  WorkflowRun,
  WorkflowRunStatus,
  PhaseId,
} from '../../../types/records';
import type { Reference, Attachment } from '../types';

export type CapabilityCategory =
  | 'workflow_control'
  | 'information_retrieval'
  | 'artifact_interaction'
  | 'context_management'
  | 'decision_history'
  | 'system';

export interface CapabilityContext {
  workspaceId: string;
  workspaceRoot: string;
  activeRun: WorkflowRun | null;
  currentPhase: PhaseId | null;
  currentSubPhase: string | null;
  runStatus: WorkflowRunStatus | null;
  orchestrator: OrchestratorEngine;
  db: ClientLiaisonDB;
  eventBus: EventBus;
  embedding: EmbeddingService;
  /** Composer attachments from the originating user input. */
  attachments?: Attachment[];
  /** Composer references from @mentions. */
  references?: Reference[];
}

/**
 * Capability effect tier — determines the context object the CapabilityBroker
 * hands to execute(), which physically bounds what the capability can reach.
 *   - read    → ReadCtx (no writer, no engine mutators)
 *   - propose → mints inert governed records at ≤ HumanEdited authority
 *   - govern  → routes through the orchestrator/gate lane; confirmation-gated
 */
export type CapabilityTier = 'read' | 'propose' | 'govern';

/**
 * READ-tier context — a structural subset of CapabilityContext with NO
 * `writer`, NO `eventBus`, and `orchestrator` narrowed to the two read-safe
 * members (DMR research + version sha). A capability typed to ReadCtx cannot
 * even reference `ctx.orchestrator.writer` / `advanceToNextPhase` /
 * `certifyPhaseGate` (compile error), and the broker hands it a facade that
 * omits them at runtime too. This is the object-capability safety spine:
 * a hallucinating model that calls a READ tool wrongly can change nothing.
 */
export interface ReadCtx {
  workspaceId: string;
  workspaceRoot: string;
  activeRun: WorkflowRun | null;
  currentPhase: PhaseId | null;
  currentSubPhase: string | null;
  runStatus: WorkflowRunStatus | null;
  db: ClientLiaisonDB;
  orchestrator: Pick<OrchestratorEngine, 'deepMemoryResearch' | 'janumiCodeVersionSha'>;
  embedding: EmbeddingService;
  attachments?: Attachment[];
  references?: Reference[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Capability<P = any, R = any, C = CapabilityContext> {
  name: string;
  category: CapabilityCategory;
  /** Effect tier — governs which context object the broker hands execute(). */
  tier: CapabilityTier;
  description: string;
  parameters: Record<string, unknown>;
  preconditions?: (ctx: C) => true | string;
  execute: (params: P, ctx: C) => Promise<R>;
  formatResponse: (result: R) => string;
  /**
   * Destructive capabilities (cancel, rollback, replace) must declare a
   * confirmation prompt here. On first invocation with `confirmed` absent
   * or false, the synthesizer returns the prompt as the response and the
   * capability is NOT executed. On a second invocation with
   * `confirmed: true`, it executes normally.
   *
   * This replaces the previous ad-hoc pattern where each destructive
   * capability's execute() manually threw when `confirmed` was missing —
   * which relied on the LLM remembering to include a `confirmed: true`
   * param on its first try. Now the framework enforces the two-step
   * dance and the LLM sees a clear "this needs user confirmation"
   * response instead of an error.
   */
  confirmation?: {
    /** Natural-language summary of what will happen, rendered to the user. */
    prompt: (params: P, ctx: C) => string;
  };
}

/**
 * A capability with its parameter/result/context types erased — used where
 * the registry and broker must hold read/propose/govern caps together in one
 * collection. The CapabilityBroker re-narrows the context per tier at
 * dispatch time, so the erasure is contained to storage/routing.
 */
export type AnyCapability = Capability<any, any, any>;

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Error thrown by the synthesizer-capability dispatch loop when a
 * destructive capability is called without confirmation. The synthesizer
 * catches it and surfaces the prompt to the user rather than treating
 * it as an execution failure.
 */
export class CapabilityConfirmationRequired extends Error {
  constructor(
    public readonly capabilityName: string,
    public readonly prompt: string,
  ) {
    super(`${capabilityName} requires user confirmation: ${prompt}`);
    this.name = 'CapabilityConfirmationRequired';
  }
}

export class CapabilityRegistry {
  // Stored with an unconstrained context type so read-tier caps (ctx: ReadCtx)
  // and govern-tier caps (ctx: CapabilityContext) coexist in one map. The
  // CapabilityBroker re-narrows the context per tier at dispatch time.
  private readonly map = new Map<string, AnyCapability>();

  register(c: AnyCapability): void {
    this.map.set(c.name, c);
  }

  registerAll(caps: AnyCapability[]): void {
    for (const c of caps) this.register(c);
  }

  get(name: string): AnyCapability | undefined {
    return this.map.get(name);
  }

  all(): AnyCapability[] {
    return [...this.map.values()];
  }

  byCategory(category: CapabilityCategory): AnyCapability[] {
    return this.all().filter(c => c.category === category);
  }

  /** Provider-agnostic tool definitions for the LLMCaller. */
  asToolDefinitions(): ToolDefinition[] {
    return this.all().map(c => ({
      name: c.name,
      description: c.description,
      input_schema: c.parameters,
    }));
  }

  /** One-line capability summaries for the classifier prompt. */
  capabilityListing(): string {
    const grouped = new Map<CapabilityCategory, Capability[]>();
    for (const c of this.all()) {
      const list = grouped.get(c.category) ?? [];
      list.push(c);
      grouped.set(c.category, list);
    }
    return [...grouped.entries()]
      .map(
        ([cat, caps]) =>
          `${cat}:\n${caps.map(c => `  - ${c.name}: ${c.description}`).join('\n')}`,
      )
      .join('\n');
  }

  /** Help-card text for the /help slash command. */
  formatHelp(): string {
    const grouped = new Map<CapabilityCategory, Capability[]>();
    for (const c of this.all()) {
      const list = grouped.get(c.category) ?? [];
      list.push(c);
      grouped.set(c.category, list);
    }
    const sections: string[] = [];
    for (const [cat, caps] of grouped.entries()) {
      sections.push(
        `## ${cat.replace(/_/g, ' ')}\n` +
          caps.map(c => `- **${c.name}**: ${c.description}`).join('\n'),
      );
    }
    return sections.join('\n\n');
  }
}
