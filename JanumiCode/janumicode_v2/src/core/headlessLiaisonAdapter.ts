/**
 * HeadlessLiaisonAdapter - CLI-to-Engine bridge for headless workflow execution.
 *
 * Reconstructs UserInput from CLI arguments to simulate what the webview provides,
 * then feeds ClientLiaisonAgent.handleUserInput() through the canonical ingress path.
 *
 * This ensures the CLI uses the exact same pipeline as the interactive extension,
 * satisfying the "Pipeline Fidelity over Spec Adherence" principle.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ClientLiaisonAgent, makeUserInput } from '../lib/agents/clientLiaisonAgent';
import type { CapabilityContext } from '../lib/agents/clientLiaison/capabilities/index';
import type { LiaisonResponse, Attachment } from '../lib/agents/clientLiaison/types';
import type { OrchestratorEngine } from '../lib/orchestrator/orchestratorEngine';
import type { EventBus } from '../lib/events/eventBus';
import type { EmbeddingService } from '../lib/embedding/embeddingService';
import type { ClientLiaisonDB } from '../lib/agents/clientLiaison/db';
// LLM provider registration is handled by the engine/liaison setup

// Re-export for convenience
export type { LiaisonResponse };

export interface HeadlessLiaisonConfig {
  /** The intent string or @filepath reference */
  intent: string;
  /** Auto-approve all decisions */
  autoApprove: boolean;
  /** Decision overrides keyed by sub-phase ID (any format, normalized internally) */
  decisionOverrides?: Record<string, DecisionOverride>;
  /** Workspace root path */
  workspacePath: string;
  /** Extension root path (for templates, etc.) */
  extensionPath: string;
}

export interface DecisionOverride {
  selection: 'index_0' | 'index_1' | 'index_2' | string;
  rationale?: string;
}

export interface HeadlessLiaisonResult {
  response: LiaisonResponse;
  workflowRunId: string | null;
}

/**
 * HeadlessLiaisonAdapter bridges CLI arguments to the ClientLiaisonAgent.
 */
export class HeadlessLiaisonAdapter {
  private readonly engine: OrchestratorEngine;
  private readonly liaison: ClientLiaisonAgent;
  private readonly db: ClientLiaisonDB;
  private readonly eventBus: EventBus;
  private readonly embedding: EmbeddingService;

  constructor(
    engine: OrchestratorEngine,
    liaison: ClientLiaisonAgent,
    db: ClientLiaisonDB,
    eventBus: EventBus,
    embedding: EmbeddingService,
  ) {
    this.engine = engine;
    this.liaison = liaison;
    this.db = db;
    this.eventBus = eventBus;
    this.embedding = embedding;
  }

  /**
   * Bootstrap intent from CLI arguments and execute through ClientLiaisonAgent.
   */
  async bootstrapIntent(config: HeadlessLiaisonConfig): Promise<HeadlessLiaisonResult> {
    // 1. Resolve "@filepath" into file content
    const isFile = config.intent.startsWith('@');
    let userPromptText: string;
    let attachments: Attachment[] = [];

    if (isFile) {
      const filePath = config.intent.slice(1);
      const resolvedPath = path.resolve(config.workspacePath, filePath);
      
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`File not found: ${resolvedPath}`);
      }

      // Verify file exists and is readable (content will be read by phase handlers from URI)
      fs.accessSync(resolvedPath, fs.constants.R_OK);
      userPromptText = `Execute the intent described in the attached document.`;
      
      attachments = [{
        uri: `file://${resolvedPath}`,
        name: path.basename(resolvedPath),
        type: 'file',
      }];
    } else {
      userPromptText = config.intent;
    }

    // 2. Build explicit UserInput representing exactly what the frontend DOM emits
    const userInput = makeUserInput({
      text: userPromptText,
      attachments,
      references: [],
      inputMode: 'raw_intent',
      workflowRunId: null,
      currentPhaseId: null,
    });

    // 3. Create mocked CapabilityContext (no webviews, headless telemetry)
    const ctx: CapabilityContext = this.createHeadlessCapabilityContext(
      config.workspacePath,
      config.autoApprove,
    );

    // 4. Apply decision overrides if provided
    if (config.decisionOverrides) {
      this.applyDecisionOverrides(config.decisionOverrides);
    }

    // 5. Hook straight into the existing v2 Agent Engine
    const response = await this.liaison.handleUserInput(userInput, ctx);

    // 6. Get the workflow run ID
    const newRun = this.db.getCurrentWorkflowRun();
    const workflowRunId = newRun?.id ?? null;

    return { response, workflowRunId };
  }

  /**
   * Create a CapabilityContext for headless execution.
   */
  private createHeadlessCapabilityContext(
    workspacePath: string,
    autoApprove: boolean,
  ): CapabilityContext {
    // Set auto-approve on the engine
    if (autoApprove) {
      this.engine.setAutoApproveDecisions(true);
    }

    return {
      workspaceId: 'cli-workspace',
      workspaceRoot: workspacePath,
      activeRun: null,
      currentPhase: null,
      currentSubPhase: null,
      runStatus: null,
      orchestrator: this.engine,
      db: this.db,
      eventBus: this.eventBus,
      embedding: this.embedding,
    };
  }

  /**
   * Apply decision overrides to the engine.
   * 
   * Decision overrides are stored and will be used when the corresponding
   * sub-phase reaches a decision point. The engine will check for pre-registered
   * overrides via the getDecisionOverride() method.
   */
  private readonly decisionOverrides = new Map<string, string>();

  private applyDecisionOverrides(overrides: Record<string, DecisionOverride>): void {
    const { normalizeSubPhaseId } = require('./identifierNormalizer');
    for (const [key, override] of Object.entries(overrides)) {
      const canonicalKey = normalizeSubPhaseId(key);
      this.decisionOverrides.set(canonicalKey, override.selection);
    }
    // Push the normalized overrides onto the engine so pauseForDecision
    // consumes them in auto-approve mode. Previously this map was only
    // kept on the adapter and never handed off — the CLI's
    // --decision-overrides flag was silently ignored.
    this.engine.setDecisionOverrides(this.decisionOverrides);
  }

  /**
   * Get a decision override for a sub-phase.
   * Called by the engine when resolving decisions in headless mode.
   */
  getDecisionOverride(subPhaseId: string): string | undefined {
    const { normalizeSubPhaseId } = require('./identifierNormalizer');
    const canonicalKey = normalizeSubPhaseId(subPhaseId);
    return this.decisionOverrides.get(canonicalKey);
  }
}

/**
 * Convenience function to create a headless adapter from existing components.
 */
export function createHeadlessAdapter(
  engine: OrchestratorEngine,
  liaison: ClientLiaisonAgent,
  db: ClientLiaisonDB,
  eventBus: EventBus,
  embedding: EmbeddingService,
): HeadlessLiaisonAdapter {
  return new HeadlessLiaisonAdapter(engine, liaison, db, eventBus, embedding);
}
