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
import { LlamaCppProvider } from './lib/llm/providers/llamacpp';
import { ClientLiaisonAgent } from './lib/agents/clientLiaisonAgent';
import { DecisionRouter } from './lib/orchestrator/decisionRouter';
import {
  GovernedStreamViewProvider,
  buildExtensionHost,
  type WorkflowSession,
} from './lib/webview/governedStreamViewProvider';
import { CanvasEditorProvider } from './lib/canvas/canvasEditorProvider';
import { DecompViewerEditorProvider } from './lib/decompViewer/decompViewerEditorProvider';
import { registerTestHookCommands } from './testHooks';
import { loadDotenv } from './lib/config/dotenv';

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
  // Embedding backend is env-overridable so the calibration harness
  // can route through llama-swap (single proxy serving both chat and
  // embedding models) instead of running Ollama in parallel.
  //   JANUMICODE_EMBED_PROVIDER  → 'ollama' | 'llamacpp'      (default 'ollama')
  //   JANUMICODE_EMBED_MODEL     → tag/key for the embed model
  //   JANUMICODE_EMBED_BASE_URL  → backend URL (default http://127.0.0.1:11434)
  const embedProvider = (process.env.JANUMICODE_EMBED_PROVIDER as 'ollama' | 'llamacpp') ?? 'ollama';
  const embedDefaultModel = embedProvider === 'llamacpp'
    ? 'qwen3-embedding-8b'  // llama-swap key (no colon)
    : 'qwen3-embedding:8b'; // Ollama tag
  const embedding = new EmbeddingService(db, {
    provider: embedProvider,
    model: process.env.JANUMICODE_EMBED_MODEL ?? embedDefaultModel,
    baseUrl: process.env.JANUMICODE_EMBED_BASE_URL,
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
  engine.llmCaller.registerProvider(new LlamaCppProvider());
  log.info('activation', 'Bootstrap step 8/14: LLM provider adapters registered');

  // Register builtin CLI output parsers BEFORE validateLLMRouting so
  // any llm_routing entry with a CLI backing (default orchestrator
  // routing is gemini_cli — see config/defaults.ts) resolves without
  // hitting the "parser not registered" validation error.
  engine.registerBuiltinCLIParsers();

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
  context.subscriptions.push(CanvasEditorProvider.register(context, db, liaison.getDB()));
  log.info('activation', 'Architecture Canvas custom editor registered');

  // 13b2. Decomposition Viewer custom editor
  context.subscriptions.push(DecompViewerEditorProvider.register(context, db, liaison.getDB()));
  log.info('activation', 'Decomposition Viewer custom editor registered');

  // Status-bar button — opens the decomposition viewer for the current
  // workflow run (or prompts if no current run is known).
  const decompStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    99,
  );
  decompStatusBarItem.text = '$(list-tree) Decomp';
  decompStatusBarItem.tooltip = 'Open Decomposition Viewer';
  decompStatusBarItem.command = 'janumicode.openDecompViewer';
  decompStatusBarItem.show();
  context.subscriptions.push(decompStatusBarItem);

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
    vscode.commands.registerCommand('janumicode.openDecompViewer', async () => {
      // DB-as-truth: open the run-agnostic `/active` URI by default.
      // The viewer's resolver picks the right run on every tick, so
      // this works whether the workspace has 0, 1, or N runs and is
      // robust to DB swaps. The picker is offered as a follow-up to
      // pin a specific older run when the user wants post-mortem
      // viewing of a non-active run.
      if (!liaison) return;
      const ldb = liaison.getDB();
      const active = ldb.getActiveWorkflowRun();
      // workflow_runs has no intent_summary column — schema carries
      // raw_intent_record_id pointing at the raw_intent_received record
      // in governed_stream where the human-readable text lives. We
      // LEFT JOIN to get a short label per run; runs without a raw-intent
      // pointer still show via the id-prefix fallback in the label.
      // .all() on the sidecar RPC client may return undefined on query
      // error (rather than throwing) — defensively coerce to [].
      let runs: Array<{ id: string; current_phase_id: string | null; status: string | null; intent_text: string | null }> = [];
      try {
        const rows = db.prepare(
          `SELECT wr.id, wr.current_phase_id, wr.status,
                  json_extract(gs.content, '$.text') AS intent_text
             FROM workflow_runs wr
             LEFT JOIN governed_stream gs ON gs.id = wr.raw_intent_record_id
            ORDER BY wr.initiated_at DESC LIMIT 10`,
        ).all() as Array<{ id: string; current_phase_id: string | null; status: string | null; intent_text: string | null }> | null | undefined;
        runs = Array.isArray(rows) ? rows : [];
      } catch (err) {
        log.warn('ui', 'workflow_runs query failed in openDecompViewer; falling back to /active', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      if (runs.length === 0) {
        if (active) {
          // Resolver found something but the picker query failed — open
          // /active anyway so the user still sees the data.
          await vscode.commands.executeCommand(
            'vscode.openWith', DecompViewerEditorProvider.buildActiveUri(), 'janumicode.decompViewer');
          return;
        }
        void vscode.window.showInformationMessage('No workflow runs found in this database. Start a workflow or copy in a calibration DB.');
        return;
      }
      // Single-run shortcut: skip the picker entirely.
      if (runs.length === 1) {
        await vscode.commands.executeCommand(
          'vscode.openWith', DecompViewerEditorProvider.buildActiveUri(), 'janumicode.decompViewer');
        return;
      }
      // Multi-run: let the user pick. First option is always "Active
      // (auto-resolve)" so the default flow stays DB-as-truth.
      const summarize = (text: string | null, id: string): string => {
        const trimmed = (text ?? '').trim().replace(/\s+/g, ' ');
        return trimmed.length > 0 ? trimmed.slice(0, 80) : `Run ${id.slice(0, 8)}…`;
      };
      const items: Array<vscode.QuickPickItem & { runId: string | null }> = [
        {
          label: '$(refresh) Active run (auto-resolve)',
          description: active ? `Currently: ${active.id.slice(0, 8)}…` : 'No runs to resolve',
          runId: null,
        },
        ...runs.map(r => ({
          label: summarize(r.intent_text, r.id),
          description: `Phase ${r.current_phase_id ?? '?'} · ${r.status ?? '?'} · ${r.id.slice(0, 8)}…`,
          runId: r.id,
        })),
      ];
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Open viewer for the active run, or pin a specific past run',
      });
      if (!selected) return;
      // "Active" choice persists the focus as null (clears any prior
      // pin); specific-run choice writes the focus to ui_state so the
      // selection survives across viewer re-opens until cleared.
      if (selected.runId === null) {
        ldb.setFocusedWorkflowRun(null);
        await vscode.commands.executeCommand(
          'vscode.openWith', DecompViewerEditorProvider.buildActiveUri(), 'janumicode.decompViewer');
      } else {
        ldb.setFocusedWorkflowRun(selected.runId);
        await vscode.commands.executeCommand(
          'vscode.openWith', DecompViewerEditorProvider.buildPinnedUri(selected.runId), 'janumicode.decompViewer');
      }
    }),
    vscode.commands.registerCommand('janumicode.openArchitectureCanvas', async () => {
      // DB-as-truth: same pattern as openDecompViewer — open the
      // run-agnostic `/active` URI by default, offer a picker only when
      // the DB has multiple runs and the user might want to pin a
      // specific one. Survives DB swaps.
      if (!liaison) return;
      const ldb = liaison.getDB();
      const active = ldb.getActiveWorkflowRun();
      let runs: Array<{ id: string; current_phase_id: string | null; status: string | null; intent_text: string | null }> = [];
      try {
        const rows = db.prepare(
          `SELECT wr.id, wr.current_phase_id, wr.status,
                  json_extract(gs.content, '$.text') AS intent_text
             FROM workflow_runs wr
             LEFT JOIN governed_stream gs ON gs.id = wr.raw_intent_record_id
            ORDER BY wr.initiated_at DESC LIMIT 10`,
        ).all() as Array<{ id: string; current_phase_id: string | null; status: string | null; intent_text: string | null }> | null | undefined;
        runs = Array.isArray(rows) ? rows : [];
      } catch (err) {
        log.warn('ui', 'workflow_runs query failed in openArchitectureCanvas; falling back to /active', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      if (runs.length === 0) {
        if (active) {
          await vscode.commands.executeCommand(
            'vscode.openWith', CanvasEditorProvider.buildActiveUri(), 'janumicode.canvas');
          return;
        }
        void vscode.window.showInformationMessage('No workflow runs found in this database. Start a workflow or copy in a calibration DB.');
        return;
      }
      if (runs.length === 1) {
        await vscode.commands.executeCommand(
          'vscode.openWith', CanvasEditorProvider.buildActiveUri(), 'janumicode.canvas');
        return;
      }
      const summarize = (text: string | null, id: string): string => {
        const trimmed = (text ?? '').trim().replaceAll(/\s+/g, ' ');
        return trimmed.length > 0 ? trimmed.slice(0, 80) : `Run ${id.slice(0, 8)}…`;
      };
      const items: Array<vscode.QuickPickItem & { runId: string | null }> = [
        {
          label: '$(refresh) Active run (auto-resolve)',
          description: active ? `Currently: ${active.id.slice(0, 8)}…` : 'No runs to resolve',
          runId: null,
        },
        ...runs.map(r => ({
          label: summarize(r.intent_text, r.id),
          description: `Phase ${r.current_phase_id ?? '?'} · ${r.status ?? '?'} · ${r.id.slice(0, 8)}…`,
          runId: r.id,
        })),
      ];
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Open canvas for the active run, or pin a specific past run',
      });
      if (!selected) return;
      if (selected.runId === null) {
        ldb.setFocusedWorkflowRun(null);
        await vscode.commands.executeCommand(
          'vscode.openWith', CanvasEditorProvider.buildActiveUri(), 'janumicode.canvas');
      } else {
        ldb.setFocusedWorkflowRun(selected.runId);
        await vscode.commands.executeCommand(
          'vscode.openWith', CanvasEditorProvider.buildPinnedUri(selected.runId), 'janumicode.canvas');
      }
    }),
  );

  // 13c. Test-hook commands (JANUMICODE_E2E=1 only). Gives the
  // in-extension harness suite a scripted way to drive a Phase 0→10
  // run through the real liaison / decision router / engine — no
  // commands are registered when the env var isn't set, so production
  // installs never see `janumicode._test.*` in their command palette.
  const testHookDisposables = registerTestHookCommands({
    engine,
    liaison,
    db,
    provider,
    dbPath,
    workspacePath,
  });
  context.subscriptions.push(...testHookDisposables);

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

// loadDotenv moved to src/lib/config/dotenv.ts so the CLI entry
// point can reuse it — `node dist/cli/janumicode.js` needs the same
// API-key-injection path the extension host gets on activate().
