/**
 * JanumiCode v2 — VS Code Extension Entry Point (Wave 5).
 *
 * Activation: onStartupFinished. Bootstraps:
 *   - Logging
 *   - .env loading
 *   - ConfigManager
 *   - Database (direct mode, better-sqlite3 in extension host)
 *   - EmbeddingService (background queue, Ollama qwen3-embedding:8b)
 *   - OrchestratorEngine (with Phase 0 + Phase 1 handlers)
 *   - LLM provider adapters (Ollama, Anthropic, Google) wired into the engine
 *     and into the ClientLiaisonAgent's internal PriorityLLMCaller
 *   - ClientLiaisonAgent (universal router for ALL user input)
 *   - DecisionRouter
 *   - GovernedStreamViewProvider (sidebar webview)
 *   - Real command implementations
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { getLogger, OutputChannelHandler } from './lib/logging';
import { initializeDatabase, closeWithCheckpoint } from './lib/database/init';
import { ConfigManager } from './lib/config/configManager';
import { EmbeddingService } from './lib/embedding/embeddingService';
import { OrchestratorEngine } from './lib/orchestrator/orchestratorEngine';
import { Phase0Handler } from './lib/orchestrator/phases/phase0';
import { Phase05Handler } from './lib/orchestrator/phases/phase05';
import { Phase1Handler } from './lib/orchestrator/phases/phase1';
import { Phase2Handler } from './lib/orchestrator/phases/phase2';
import { Phase3Handler } from './lib/orchestrator/phases/phase3';
import { Phase4Handler } from './lib/orchestrator/phases/phase4';
import { Phase5Handler } from './lib/orchestrator/phases/phase5';
import { Phase6Handler } from './lib/orchestrator/phases/phase6';
import { Phase7Handler } from './lib/orchestrator/phases/phase7';
import { Phase8Handler } from './lib/orchestrator/phases/phase8';
import { Phase9Handler } from './lib/orchestrator/phases/phase9';
import { Phase10Handler } from './lib/orchestrator/phases/phase10';
import { OllamaProvider } from './lib/llm/providers/ollama';
import { AnthropicProvider } from './lib/llm/providers/anthropic';
import { GoogleProvider } from './lib/llm/providers/google';
import { ClientLiaisonAgent } from './lib/agents/clientLiaisonAgent';
import { DecisionRouter } from './lib/orchestrator/decisionRouter';
import {
  GovernedStreamViewProvider,
  buildExtensionHost,
  type WorkflowSession,
} from './lib/webview/governedStreamViewProvider';
import { CanvasEditorProvider } from './lib/canvas/canvasEditorProvider';

let provider: GovernedStreamViewProvider | null = null;
let liaison: ClientLiaisonAgent | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 1. Logging — surface the output channel immediately so bootstrap traces
  //    are visible without the user having to run the showLogs command.
  const outputChannel = vscode.window.createOutputChannel('JanumiCode Logs');
  const outputHandler = new OutputChannelHandler();
  outputHandler.setChannel(outputChannel);
  const logger = getLogger();
  logger.setOutputChannel(outputHandler);
  if (process.env.JANUMICODE_AUTOSHOW_LOGS !== '0') {
    outputChannel.show(true); // preserveFocus: true — don't steal focus
  }
  logger.info('activation', 'JanumiCode v2 activating…', {
    extensionPath: context.extensionUri.fsPath,
    nodeVersion: process.version,
    electronVersion: process.versions.electron ?? '(not electron)',
    platform: process.platform,
  });

  // 2. .env
  loadDotenv(context.extensionPath);
  logger.info('activation', '.env loaded (if present)');

  try {
    await bootstrap(context, outputHandler);
    logger.info('activation', 'JanumiCode v2 activated successfully.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error('activation', 'Bootstrap failed', { error: msg, stack });
    void vscode.window.showErrorMessage(`JanumiCode failed to start: ${msg}`);
  }

  context.subscriptions.push(outputChannel);
}

async function bootstrap(
  context: vscode.ExtensionContext,
  outputHandler: OutputChannelHandler,
): Promise<void> {
  const log = getLogger();

  // 3. Workspace path
  const workspacePath =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.globalStorageUri.fsPath;
  await fs.promises.mkdir(workspacePath, { recursive: true });
  log.info('activation', 'Bootstrap step 3/14: workspacePath resolved', { workspacePath });

  // 4. ConfigManager
  const configManager = new ConfigManager(workspacePath);
  log.info('activation', 'Bootstrap step 4/14: ConfigManager constructed');

  // 5. Database
  //    The 'auto' detector picks 'sidecar' under Electron and 'direct' under
  //    plain Node, deterministically (no try-then-fall-back).
  const dbPath = path.isAbsolute(configManager.get().governed_stream.sqlite_path)
    ? configManager.get().governed_stream.sqlite_path
    : path.join(workspacePath, configManager.get().governed_stream.sqlite_path);
  await fs.promises.mkdir(path.dirname(dbPath), { recursive: true });
  log.info('activation', 'Bootstrap step 5/14: opening database', {
    dbPath,
    detected: typeof process.versions.electron === 'string' ? 'sidecar (electron)' : 'direct (plain node)',
  });
  const db = initializeDatabase({
    path: dbPath,
    extensionPath: context.extensionUri.fsPath,
  });
  log.info('activation', 'Bootstrap step 5/14: database open');

  // 6. Embedding service — background Ollama queue.
  //
  //    Default model: qwen3-embedding:8b — matches the Qwen-family LLM
  //    already used for inference (`qwen3.5:9b`), so the vector space is
  //    coherent with the primary reasoning model.
  //
  //    Alternative local model (smaller, faster, lower quality):
  //      embeddinggemma:300m
  //
  //    Override with JANUMICODE_EMBED_MODEL in the environment if you want
  //    to experiment or if the default isn't pulled locally.
  const embedding = new EmbeddingService(db, {
    provider: 'ollama',
    model: process.env.JANUMICODE_EMBED_MODEL ?? 'qwen3-embedding:8b',
    maxParallel: 1,
  });
  embedding.start();
  log.info('activation', 'Bootstrap step 6/14: EmbeddingService started');

  // 7. OrchestratorEngine
  //    Schemas, invariants, and prompt templates ship with the extension
  //    and must be loaded from the extension's own root (context.extensionUri.fsPath),
  //    NOT from the user's workspace. The workspace supplies the DB, detail
  //    files, and config overrides.
  const extensionPath = context.extensionUri.fsPath;
  const engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
  engine.setEmbeddingService(embedding);
  log.info('activation', 'Bootstrap step 7/14: OrchestratorEngine constructed', {
    workspacePath,
    extensionPath,
    loadedSchemas: engine.schemaValidator.getLoadedSchemas().length,
  });

  // Connect the writer to the embedding service so writes enqueue background embedding.
  engine.writer.setEmbeddingService(embedding);

  // Register LLM provider adapters on the engine's caller.
  engine.llmCaller.registerProvider(new OllamaProvider());
  engine.llmCaller.registerProvider(new AnthropicProvider());
  engine.llmCaller.registerProvider(new GoogleProvider());
  log.info('activation', 'Bootstrap step 8/14: LLM provider adapters registered');

  // Validate that every provider referenced by llm_routing config is
  // registered. Correctness-validation roles (Reasoning Review, Domain
  // Compliance) cannot fall back silently without undermining trust —
  // this check surfaces misconfigurations at startup instead of mid-flow.
  engine.validateLLMRouting();

  // Register all phase handlers (0-10) for Architecture Canvas support.
  engine.registerPhase(new Phase0Handler());
  engine.registerPhase(new Phase05Handler());
  engine.registerPhase(new Phase1Handler());
  engine.registerPhase(new Phase2Handler());
  engine.registerPhase(new Phase3Handler());
  engine.registerPhase(new Phase4Handler());
  engine.registerPhase(new Phase5Handler());
  engine.registerPhase(new Phase6Handler());
  engine.registerPhase(new Phase7Handler());
  engine.registerPhase(new Phase8Handler());
  engine.registerPhase(new Phase9Handler());
  engine.registerPhase(new Phase10Handler());
  log.info('activation', 'Bootstrap step 9/14: All phase handlers (0-10) registered');

  // 10. ClientLiaisonAgent (universal router)
  const extHost = buildExtensionHost();
  liaison = new ClientLiaisonAgent(
    db,
    engine,
    {
      provider: 'ollama',
      model: process.env.JANUMICODE_DEV_MODEL ?? 'qwen3.5:9b',
      embeddingService: embedding,
    },
    extHost,
  );

  // Mirror provider registrations into the Liaison's internal PriorityLLMCaller.
  liaison.registerProviders(new OllamaProvider());
  liaison.registerProviders(new AnthropicProvider());
  liaison.registerProviders(new GoogleProvider());
  liaison.setEventBus(engine.eventBus);
  log.info('activation', 'Bootstrap step 10/14: ClientLiaisonAgent constructed');

  // 11. DecisionRouter
  const decisionRouter = new DecisionRouter(engine);
  log.info('activation', 'Bootstrap step 11/14: DecisionRouter constructed');

  // 12. Workflow session + workspace id
  const session: WorkflowSession = { currentRunId: null };
  const workspaceId = createHash('sha256').update(workspacePath).digest('hex').slice(0, 16);
  log.info('activation', 'Bootstrap step 12/14: session ready', { workspaceId });

  // 13. View provider
  provider = new GovernedStreamViewProvider(
    context.extensionUri,
    engine,
    db,
    liaison,
    decisionRouter,
    session,
    workspaceId,
    workspacePath,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('janumicode.governedStream', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
  log.info('activation', 'Bootstrap step 13/14: webview view provider registered');

  // 13b. Architecture Canvas custom editor
  context.subscriptions.push(CanvasEditorProvider.register(context, db));
  log.info('activation', 'Architecture Canvas custom editor registered');

  // 13. Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('janumicode.startWorkflowRun', async () => {
      await provider?.focusComposer();
    }),
    vscode.commands.registerCommand('janumicode.showWorkflowStatus', async () => {
      if (!liaison || !provider) return;
      try {
        const result = await liaison.runCapability('getStatus', {}, provider.getCapabilityContext());
        void vscode.window.showInformationMessage(result.formattedText);
      } catch (err) {
        void vscode.window.showErrorMessage(`Status failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),
    vscode.commands.registerCommand('janumicode.openSettings', async () => {
      const uri = vscode.Uri.file(path.join(workspacePath, '.janumicode', 'config.json'));
      try {
        await vscode.workspace.fs.stat(uri);
        await vscode.window.showTextDocument(uri);
      } catch {
        void vscode.window.showInformationMessage(
          'No .janumicode/config.json — create one to override defaults.',
        );
      }
    }),
    vscode.commands.registerCommand('janumicode.findInStream', () => {
      provider?.postFindFocus();
    }),
    vscode.commands.registerCommand('janumicode.showLogs', () => {
      outputHandler.show();
    }),
    vscode.commands.registerCommand('janumicode.openArchitectureCanvas', async () => {
      // Open canvas for current workflow run or prompt for selection
      if (session.currentRunId) {
        const uri = vscode.Uri.parse(`janumicode-canvas:${session.currentRunId}?workflowRunId=${session.currentRunId}`);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'janumicode.canvas');
      } else {
        const runs = db.prepare('SELECT id, intent_summary FROM workflow_runs ORDER BY created_at DESC LIMIT 10').all() as Array<{ id: string; intent_summary: string }>;
        if (runs.length === 0) {
          void vscode.window.showInformationMessage('No workflow runs found. Start a workflow first.');
          return;
        }
        const selected = await vscode.window.showQuickPick(
          runs.map(r => ({ label: r.intent_summary ?? r.id, id: r.id })),
          { placeHolder: 'Select a workflow run to visualize' },
        );
        if (selected) {
          const uri = vscode.Uri.parse(`janumicode-canvas:${selected.id}?workflowRunId=${selected.id}`);
          await vscode.commands.executeCommand('vscode.openWith', uri, 'janumicode.canvas');
        }
      }
    }),
  );

  // 14. Cleanup — checkpoint the WAL before closing so the .db file on
  // disk is self-contained. See closeWithCheckpoint() for the rationale.
  context.subscriptions.push({
    dispose: () => {
      embedding.stop();
      try {
        closeWithCheckpoint(db);
      } catch { /* ignore */ }
    },
  });
  log.info('activation', 'Bootstrap step 14/14: commands + cleanup registered');
}

export function deactivate(): void {
  getLogger().info('activation', 'JanumiCode v2 deactivated.');
}

// ── .env loader (existing) ──────────────────────────────────────────

function loadDotenv(extensionPath: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsLocal = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pathLocal = require('path');
    const envPath = pathLocal.join(extensionPath, '.env');
    if (!fsLocal.existsSync(envPath)) return;

    const content = fsLocal.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const cleaned = trimmed.replace(/^export\s+/, '');
      const eqIndex = cleaned.indexOf('=');
      if (eqIndex === -1) continue;
      const key = cleaned.slice(0, eqIndex).trim();
      const value = cleaned.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    /* .env loading is optional */
  }
}
