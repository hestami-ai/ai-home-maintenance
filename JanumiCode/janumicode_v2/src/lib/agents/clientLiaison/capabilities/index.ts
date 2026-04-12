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

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Capability<P = any, R = any> {
  name: string;
  category: CapabilityCategory;
  description: string;
  parameters: Record<string, unknown>;
  preconditions?: (ctx: CapabilityContext) => true | string;
  execute: (params: P, ctx: CapabilityContext) => Promise<R>;
  formatResponse: (result: R) => string;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export class CapabilityRegistry {
  private readonly map = new Map<string, Capability>();

  register(c: Capability): void {
    this.map.set(c.name, c);
  }

  registerAll(caps: Capability[]): void {
    for (const c of caps) this.register(c);
  }

  get(name: string): Capability | undefined {
    return this.map.get(name);
  }

  all(): Capability[] {
    return [...this.map.values()];
  }

  byCategory(category: CapabilityCategory): Capability[] {
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
