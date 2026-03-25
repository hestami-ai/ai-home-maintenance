/**
 * JanumiCode VS Code Extension
 * Governed Multi-Role Dialogue & Execution System
 * Phase 1: Foundation & Core Infrastructure
 */

import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
	initializeDatabase,
	closeDatabase,
	initializeSchema,
	getDatabaseStats,
	isDatabaseReady,
} from './lib/database';
import {
	getConfig,
	getTokenBudget,
	validateConfig,
	areAPIKeysConfigured,
	getMissingAPIKeyRoles,
	watchConfig,
	getSecretKeyManager,
} from './lib/config';
import { clearRoleProviderCache } from './lib/llm/roleManager';
import { GovernedStreamViewProvider } from './lib/ui';
import { registerRoleCLIProvider } from './lib/cli/roleCLIProvider';
import { ClaudeCodeRoleCLIProvider } from './lib/cli/providers/claudeCode';
import { GeminiCLIProvider } from './lib/cli/providers/geminiCli';
import { CodexCLIProvider } from './lib/cli/providers/codexCli';
import { initializeLogger, getLogger, parseLogLevel } from './lib/logging';
import { killAllActiveProcesses, getActiveProcessCount } from './lib/cli/spawnUtils';
import { resetEventBus } from './lib/integration/eventBus';
import { getActivePermissionBridge } from './lib/mcp/permissionBridge';
import { shutdownEmbeddingProvider } from './lib/embedding/factory';
import { unsubscribeCommandPersistence } from './lib/workflow/commandStore';

/**
 * Module-level state for graceful shutdown
 */
let cleanupDone = false;
let activeProcessStatusBarItem: vscode.StatusBarItem | undefined;

/**
 * Load environment variables from a .env file in the extension root.
 * Supports `KEY=VALUE` and `export KEY=VALUE` lines; skips comments and blanks.
 * Does NOT override existing process.env values.
 */
function loadDotenv(extensionPath: string): void {
	const envPath = path.join(extensionPath, '.env');
	try {
		if (!fs.existsSync(envPath)) {
			return;
		}
		const content = fs.readFileSync(envPath, 'utf-8');
		for (const raw of content.split('\n')) {
			const line = raw.trim();
			if (!line || line.startsWith('#')) {
				continue;
			}
			// Strip optional "export " prefix
			const stripped = line.startsWith('export ') ? line.slice(7) : line;
			const eqIdx = stripped.indexOf('=');
			if (eqIdx === -1) {
				continue;
			}
			const key = stripped.slice(0, eqIdx).trim();
			const value = stripped.slice(eqIdx + 1).trim();
			if (key && !(key in process.env)) {
				process.env[key] = value;
			}
		}
		// Logger may not be initialized yet — use console as bootstrap fallback
		console.log('JanumiCode: Loaded .env from', envPath);
	} catch {
		// Silently ignore — .env is optional
	}
}

/**
 * Extension activation
 * Called when the extension is activated
 */
export async function activate(
	context: vscode.ExtensionContext
): Promise<void> {
	console.warn('[JanumiCode] Extension activation started');

	// Initialize the structured logger FIRST — all subsequent logging uses it
	const outputChannel = vscode.window.createOutputChannel('JanumiCode');
	const logger = initializeLogger(outputChannel);
	context.subscriptions.push(outputChannel);
	logger.info('Activating extension...');

	// Load .env file from extension root (before any config reads)
	loadDotenv(context.extensionPath);

	// Initialize SecretKeyManager before any config reads
	getSecretKeyManager().initialize(context.secrets);

	// Get configuration (async — resolves API keys from SecretStorage/env)
	const config = await getConfig();
	logger.info('Configuration loaded', {
		tokenBudget: config.tokenBudget,
		databasePath: config.databasePath,
	});

	// Update log level from config
	const configuredLevel = vscode.workspace.getConfiguration('janumicode').get<string>('logLevel');
	logger.setLevel(parseLogLevel(configuredLevel));

	// Validate configuration (non-blocking - warn user if issues)
	const validationResult = await validateConfig();
	if (!validationResult.success) {
		logger.warn('Configuration validation issues', { error: validationResult.error.message });

		// Check API keys specifically
		if (!(await areAPIKeysConfigured())) {
			const missingRoles = await getMissingAPIKeyRoles();
			vscode.window.showWarningMessage(
				`JanumiCode: Missing API keys for: ${missingRoles.join(', ')}. Use "JanumiCode: Set API Key" command or set environment variables.`,
				'Set API Key'
			).then((selection) => {
				if (selection === 'Set API Key') {
					vscode.commands.executeCommand('janumicode.setApiKey');
				}
			});
		}
	}

	// Initialize database
	const dbLog = logger.child({ component: 'database' });
	dbLog.info('Initializing database...', { path: config.databasePath });
	console.warn('[JanumiCode] DB init starting, path:', config.databasePath);
	const dbInitResult = initializeDatabase({
		path: config.databasePath,
	});

	if (!dbInitResult.success) {
		const msg = `Failed to initialize database: ${dbInitResult.error.message}`;
		dbLog.error(msg);
		console.error('[JanumiCode]', msg);
		vscode.window.showErrorMessage(`JanumiCode: ${msg}`);
		return;
	}

	const db = dbInitResult.value;
	dbLog.info('Database connection established');
	console.warn('[JanumiCode] DB connection OK');

	// Run migrations (initialize schema)
	dbLog.info('Running database migrations...');
	console.warn('[JanumiCode] Running migrations...');
	const schemaResult = initializeSchema(db);

	if (!schemaResult.success) {
		const msg = `Failed to initialize schema: ${schemaResult.error.message}`;
		dbLog.error(msg);
		console.error('[JanumiCode]', msg);
		vscode.window.showErrorMessage(`JanumiCode: ${msg}`);
		closeDatabase();
		return;
	}

	dbLog.info('Database schema initialized successfully');
	console.warn('[JanumiCode] Schema OK');

	// Get and log database stats
	const stats = getDatabaseStats();
	if (stats) {
		dbLog.debug('Database stats', {
			sizeBytes: stats.sizeBytes,
			walMode: stats.walMode,
			pageCount: stats.pageCount,
		});
	}

	// Verify database is ready
	if (!isDatabaseReady()) {
		vscode.window.showErrorMessage('JanumiCode: Database initialization failed');
		return;
	}

	// Register CLI providers for multi-CLI role execution
	registerRoleCLIProvider(new ClaudeCodeRoleCLIProvider());
	registerRoleCLIProvider(new GeminiCLIProvider());
	registerRoleCLIProvider(new CodexCLIProvider());
	logger.info('CLI providers registered', { providers: ['claude-code', 'gemini-cli', 'codex-cli'] });

	// Watch for configuration changes
	const configWatcher = watchConfig((newConfig) => {
		logger.info('Configuration changed', {
			tokenBudget: newConfig.tokenBudget,
			databasePath: newConfig.databasePath,
		});
		// Update log level on config change
		const newLevel = vscode.workspace.getConfiguration('janumicode').get<string>('logLevel');
		logger.setLevel(parseLogLevel(newLevel));
		vscode.window.showInformationMessage('JanumiCode: Configuration updated');
	});
	context.subscriptions.push(configWatcher);

	// Register webview providers
	console.warn('[JanumiCode] Registering webview providers...');
	const governedStreamProvider = registerWebviewProviders(context);
	console.warn('[JanumiCode] Webview providers registered');

	// Register commands
	registerCommands(context, governedStreamProvider);
	console.warn('[JanumiCode] Commands registered');

	// Setup status bar
	setupStatusBar(context);

	// Active process status bar monitor
	setupActiveProcessMonitor(context);

	// Register terminate processes command
	const terminateCmd = vscode.commands.registerCommand(
		'janumicode.confirmTerminateProcesses',
		async () => {
			const count = getActiveProcessCount();
			if (count === 0) {
				vscode.window.showInformationMessage('JanumiCode: No active CLI processes.');
				return;
			}

			const choice = await vscode.window.showWarningMessage(
				`JanumiCode: ${count} CLI process${count > 1 ? 'es' : ''} currently running. Terminate all?`,
				{ modal: true },
				'Terminate All',
				'Let Them Finish'
			);

			if (choice === 'Terminate All') {
				const killed = killAllActiveProcesses();
				vscode.window.showInformationMessage(
					`JanumiCode: Terminated ${killed} CLI process${killed > 1 ? 'es' : ''}.`
				);
			}
		}
	);
	context.subscriptions.push(terminateCmd);

	// Show activation success
	logger.info('Extension activated successfully');
	console.warn('[JanumiCode] Extension activated successfully');
	vscode.window.showInformationMessage('JanumiCode: Ready');
}

/**
 * Register webview providers
 */
function registerWebviewProviders(context: vscode.ExtensionContext): GovernedStreamViewProvider {
	// Governed Stream — unified sidebar view
	const governedStreamProvider = new GovernedStreamViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			GovernedStreamViewProvider.viewType,
			governedStreamProvider,
			{ webviewOptions: { retainContextWhenHidden: true } }
		)
	);

	getLogger().debug('Webview providers registered');
	return governedStreamProvider;
}

/**
 * Setup status bar
 */
function setupStatusBar(context: vscode.ExtensionContext): void {
	// Workflow phase status bar item
	const workflowStatusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100
	);
	workflowStatusBarItem.text = '$(gear) JanumiCode: Ready';
	workflowStatusBarItem.tooltip = 'JanumiCode Workflow Status';
	workflowStatusBarItem.command = 'janumicode.showWorkflowStatus';
	workflowStatusBarItem.show();
	context.subscriptions.push(workflowStatusBarItem);

	// Pending gates status bar item
	const gatesStatusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		99
	);
	gatesStatusBarItem.text = '$(warning) 0 Gates';
	gatesStatusBarItem.tooltip = 'Pending Human Gates';
	gatesStatusBarItem.command = 'janumicode.showPendingGates';
	gatesStatusBarItem.show();
	context.subscriptions.push(gatesStatusBarItem);

	getLogger().debug('Status bar items created');
}

/**
 * Setup active process status bar monitor.
 * Shows a status bar item when CLI subprocesses are running.
 * Clicking it opens a confirmation dialog to terminate processes.
 */
function setupActiveProcessMonitor(context: vscode.ExtensionContext): void {
	activeProcessStatusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		50
	);
	activeProcessStatusBarItem.command = 'janumicode.confirmTerminateProcesses';
	activeProcessStatusBarItem.backgroundColor = new vscode.ThemeColor(
		'statusBarItem.warningBackground'
	);
	context.subscriptions.push(activeProcessStatusBarItem);

	const updateProcessCount = () => {
		const count = getActiveProcessCount();
		if (count > 0 && activeProcessStatusBarItem) {
			activeProcessStatusBarItem.text = `$(debug-stop) ${count} CLI`;
			activeProcessStatusBarItem.tooltip = `${count} active JanumiCode CLI process${count > 1 ? 'es' : ''} — click to terminate`;
			activeProcessStatusBarItem.show();
		} else if (activeProcessStatusBarItem) {
			activeProcessStatusBarItem.hide();
		}
	};

	// Subscribe to event bus for process activity changes
	try {
		const { getEventBus } = require('./lib/integration/eventBus');
		const bus = getEventBus();
		bus.on('cli:activity', updateProcessCount);
		bus.on('workflow:command', updateProcessCount);
	} catch {
		// Event bus not yet initialized — polling fallback is sufficient
	}

	// Polling fallback (event bus may not fire on process exit)
	const pollInterval = setInterval(updateProcessCount, 5000);
	context.subscriptions.push({ dispose: () => clearInterval(pollInterval) });

	// Initial check
	updateProcessCount();
}

/**
 * Register extension commands
 */
function registerCommands(context: vscode.ExtensionContext, streamProvider: GovernedStreamViewProvider): void {
	// Hello World command (temporary for testing)
	const helloWorldCmd = vscode.commands.registerCommand(
		'janumicode.helloWorld',
		() => {
			const stats = getDatabaseStats();
			vscode.window.showInformationMessage(
				`JanumiCode is active! Database: ${stats?.sizeBytes || 0} bytes, Token Budget: ${getTokenBudget()}`
			);
		}
	);
	context.subscriptions.push(helloWorldCmd);

	// Show database stats command
	const showStatsCmd = vscode.commands.registerCommand(
		'janumicode.showDatabaseStats',
		() => {
			const stats = getDatabaseStats();
			if (stats) {
				const sizeMB = (stats.sizeBytes / (1024 * 1024)).toFixed(2);
				vscode.window.showInformationMessage(
					`Database: ${sizeMB} MB, ${stats.pageCount} pages, WAL mode: ${stats.walMode ? 'enabled' : 'disabled'}`
				);
			} else {
				vscode.window.showWarningMessage('JanumiCode: Database not initialized');
			}
		}
	);
	context.subscriptions.push(showStatsCmd);

	// Open settings command — toggles the settings panel in the Governed Stream sidebar
	const openSettingsCmd = vscode.commands.registerCommand(
		'janumicode.openSettings',
		() => {
			streamProvider.toggleSettingsPanel();
		}
	);
	context.subscriptions.push(openSettingsCmd);

	// Find in stream command — opens the find widget in the Governed Stream sidebar
	const findInStreamCmd = vscode.commands.registerCommand(
		'janumicode.findInStream',
		() => {
			streamProvider.openFindWidget();
		}
	);
	context.subscriptions.push(findInStreamCmd);

	// Validate configuration command
	const validateConfigCmd = vscode.commands.registerCommand(
		'janumicode.validateConfig',
		async () => {
			const result = await validateConfig();
			if (result.success) {
				vscode.window.showInformationMessage('JanumiCode: Configuration is valid');
			} else {
				vscode.window.showErrorMessage(
					`JanumiCode: Configuration validation failed:\n${result.error.message}`
				);
			}
		}
	);
	context.subscriptions.push(validateConfigCmd);

	// Start new dialogue command — focuses the sidebar and resets dialogue state
	const startDialogueCmd = vscode.commands.registerCommand(
		'janumicode.startDialogue',
		async () => {
			await vscode.commands.executeCommand('janumicode.governedStream.focus');
			streamProvider.startNewDialogue();
		}
	);
	context.subscriptions.push(startDialogueCmd);

	// Open Governed Stream command (focuses the sidebar view)
	const openGovernedStreamCmd = vscode.commands.registerCommand(
		'janumicode.openGovernedStream',
		() => {
			vscode.commands.executeCommand('janumicode.governedStream.focus');
		}
	);
	context.subscriptions.push(openGovernedStreamCmd);

	// Show workflow status command (now points to governed stream)
	const showWorkflowCmd = vscode.commands.registerCommand(
		'janumicode.showWorkflowStatus',
		() => {
			vscode.commands.executeCommand('janumicode.governedStream.focus');
		}
	);
	context.subscriptions.push(showWorkflowCmd);

	// Show pending gates command
	const showGatesCmd = vscode.commands.registerCommand(
		'janumicode.showPendingGates',
		() => {
			vscode.window.showInformationMessage('No pending gates');
			// TODO: Implement gates display
		}
	);
	context.subscriptions.push(showGatesCmd);

	// View active claims command (now points to governed stream)
	const viewClaimsCmd = vscode.commands.registerCommand(
		'janumicode.viewClaims',
		() => {
			vscode.commands.executeCommand('janumicode.governedStream.focus');
		}
	);
	context.subscriptions.push(viewClaimsCmd);

	// Set API Key command
	const setApiKeyCmd = vscode.commands.registerCommand(
		'janumicode.setApiKey',
		async () => {
			const roleItems = [
				{ label: 'All roles (same key)', value: 'all' },
				{ label: 'Executor', value: 'executor' },
				{ label: 'Technical Expert', value: 'technicalExpert' },
				{ label: 'Verifier', value: 'verifier' },
				{ label: 'Historian-Interpreter', value: 'historianInterpreter' },
			];

			const selected = await vscode.window.showQuickPick(roleItems, {
				placeHolder: 'Select which role to set the API key for',
			});

			if (!selected) {
				return;
			}

			const key = await vscode.window.showInputBox({
				password: true,
				prompt: `Enter API key for ${selected.label}`,
				placeHolder: 'sk-...',
				ignoreFocusOut: true,
			});

			if (!key) {
				return;
			}

			const manager = getSecretKeyManager();
			const roles = selected.value === 'all'
				? ['executor', 'technicalExpert', 'verifier', 'historianInterpreter']
				: [selected.value];

			for (const role of roles) {
				await manager.setApiKey(role, key);
			}

			// Invalidate cached providers so they pick up the new key
			clearRoleProviderCache();

			vscode.window.showInformationMessage(
				`API key set for: ${roles.length === 4 ? 'all roles' : selected.label}`
			);
		}
	);
	context.subscriptions.push(setApiKeyCmd);

	// Clear API Key command
	const clearApiKeyCmd = vscode.commands.registerCommand(
		'janumicode.clearApiKey',
		async () => {
			const roleItems = [
				{ label: 'All roles', value: 'all' },
				{ label: 'Executor', value: 'executor' },
				{ label: 'Technical Expert', value: 'technicalExpert' },
				{ label: 'Verifier', value: 'verifier' },
				{ label: 'Historian-Interpreter', value: 'historianInterpreter' },
			];

			const selected = await vscode.window.showQuickPick(roleItems, {
				placeHolder: 'Select which role to clear the API key for',
			});

			if (!selected) {
				return;
			}

			const manager = getSecretKeyManager();
			const roles = selected.value === 'all'
				? ['executor', 'technicalExpert', 'verifier', 'historianInterpreter']
				: [selected.value];

			for (const role of roles) {
				await manager.deleteApiKey(role);
			}

			clearRoleProviderCache();

			vscode.window.showInformationMessage(
				`API key cleared for: ${roles.length === 4 ? 'all roles' : selected.label}`
			);
		}
	);
	context.subscriptions.push(clearApiKeyCmd);

	// Export history command
	const exportHistoryCmd = vscode.commands.registerCommand(
		'janumicode.exportHistory',
		async () => {
			const uri = await vscode.window.showSaveDialog({
				filters: {
					'JSON files': ['json'],
				},
			});

			if (uri) {
				vscode.window.showInformationMessage(
					`Exporting history to ${uri.fsPath}`
				);
				// TODO: Implement history export
			}
		}
	);
	context.subscriptions.push(exportHistoryCmd);

	// Clear history command
	const clearHistoryCmd = vscode.commands.registerCommand(
		'janumicode.clearHistory',
		async () => {
			const confirm = await vscode.window.showWarningMessage(
				'Are you sure you want to clear all history? This cannot be undone.',
				{ modal: true },
				'Clear History'
			);

			if (confirm === 'Clear History') {
				vscode.window.showInformationMessage('History cleared');
				// TODO: Implement history clearing
			}
		}
	);
	context.subscriptions.push(clearHistoryCmd);

	getLogger().debug('Commands registered');
}

/**
 * Graceful shutdown — shared cleanup function called by both
 * onWillShutdown and deactivate(). Idempotent via cleanupDone flag.
 *
 * Cleanup order (each step wrapped in its own try/catch):
 * 1. Kill active CLI subprocesses (highest priority — external resources)
 * 2. Stop permission bridge HTTP server
 * 3. Shut down embedding provider (VoyageRPC child process)
 * 4. Unsubscribe command persistence event listener
 * 5. Reset event bus (clear all remaining listeners)
 * 6. Close database (last — prior steps may need to log/write)
 */
async function performGracefulShutdown(): Promise<void> {
	if (cleanupDone) {
		return;
	}
	cleanupDone = true;

	// Suppress expected unhandled rejections during shutdown.
	// When CLI processes are killed and channels close, pending promises reject
	// with "Canceled" or "Channel has been closed" after deactivate() returns.
	// These are expected and harmless — suppress them to avoid debug console noise.
	const shutdownRejectionHandler = (reason: unknown) => {
		const msg = reason instanceof Error ? reason.message : String(reason);
		if (msg.includes('Canceled') || msg.includes('Channel has been closed') || msg.includes('client not ready')) {
			// Expected during shutdown — swallow silently
			return;
		}
		// Unexpected rejection during shutdown — log but don't crash
		console.error('[JanumiCode] Unexpected rejection during shutdown:', msg);
	};
	process.on('unhandledRejection', shutdownRejectionHandler);

	const logger = (() => {
		try { return getLogger(); }
		catch { return null; }
	})();

	// Safe logger wrapper — OutputChannel may be closed by the time shutdown steps run.
	// "Channel has been closed" errors from logger calls must not abort shutdown.
	const safeLog = (level: 'info' | 'error' | 'warn', msg: string, meta?: Record<string, unknown>) => {
		try { logger?.[level](msg, meta as any); } catch { /* channel closed — swallow */ }
	};

	console.warn('[JanumiCode] Performing graceful shutdown...');
	safeLog('info', 'Performing graceful shutdown...');

	// 1. Abort workflow signal + kill active CLI subprocesses
	try {
		console.warn('[JanumiCode] Shutdown step 1: Killing CLI processes...');
		const { setWorkflowAbortSignal } = await import('./lib/cli/spawnUtils.js');
		setWorkflowAbortSignal(undefined);
		const killed = killAllActiveProcesses();
		console.warn(`[JanumiCode] Shutdown step 1: Killed ${killed} CLI process(es)`);
		safeLog('info', 'Killed active CLI processes', { count: killed });
	} catch (err) {
		console.error('[JanumiCode] Shutdown step 1 failed:', err);
		safeLog('error', 'Error killing CLI processes', { error: err instanceof Error ? err.message : String(err) });
	}

	// 2. Stop permission bridge HTTP server
	try {
		console.warn('[JanumiCode] Shutdown step 2: Stopping permission bridge...');
		const bridge = getActivePermissionBridge();
		if (bridge) {
			await bridge.stop();
			console.warn('[JanumiCode] Shutdown step 2: Permission bridge stopped');
			safeLog('info', 'Permission bridge stopped');
		} else {
			console.warn('[JanumiCode] Shutdown step 2: No active permission bridge');
		}
	} catch (err) {
		console.error('[JanumiCode] Shutdown step 2 failed:', err);
		safeLog('error', 'Error stopping permission bridge', { error: err instanceof Error ? err.message : String(err) });
	}

	// 3. Shut down embedding provider (VoyageRPC child process)
	try {
		console.warn('[JanumiCode] Shutdown step 3: Shutting down embedding provider...');
		await shutdownEmbeddingProvider();
		console.warn('[JanumiCode] Shutdown step 3: Embedding provider shut down');
		safeLog('info', 'Embedding provider shut down');
	} catch (err) {
		console.error('[JanumiCode] Shutdown step 3 failed:', err);
		safeLog('error', 'Error shutting down embedding provider', { error: err instanceof Error ? err.message : String(err) });
	}

	// 4. Unsubscribe command persistence event listener
	try {
		console.warn('[JanumiCode] Shutdown step 4: Unsubscribing command persistence...');
		unsubscribeCommandPersistence();
		console.warn('[JanumiCode] Shutdown step 4: Done');
	} catch (err) {
		console.error('[JanumiCode] Shutdown step 4 failed:', err);
		safeLog('error', 'Error unsubscribing command persistence', { error: err instanceof Error ? err.message : String(err) });
	}

	// 5. Reset event bus (clear all remaining listeners)
	try {
		console.warn('[JanumiCode] Shutdown step 5: Resetting event bus...');
		resetEventBus();
		console.warn('[JanumiCode] Shutdown step 5: Event bus reset');
		safeLog('info', 'Event bus reset');
	} catch (err) {
		console.error('[JanumiCode] Shutdown step 5 failed:', err);
		safeLog('error', 'Error resetting event bus', { error: err instanceof Error ? err.message : String(err) });
	}

	// 6. Close database (last)
	try {
		console.warn('[JanumiCode] Shutdown step 6: Closing database...');
		const closeResult = closeDatabase();
		if (closeResult.success) {
			console.warn('[JanumiCode] Shutdown step 6: Database closed');
			safeLog('info', 'Database connection closed');
		} else {
			console.error('[JanumiCode] Shutdown step 6: Database close failed:', closeResult.error.message);
			safeLog('error', 'Error closing database', { error: closeResult.error.message });
		}
	} catch (err) {
		console.error('[JanumiCode] Shutdown step 6 failed:', err);
		safeLog('error', 'Error closing database', { error: err instanceof Error ? err.message : String(err) });
	}

	// 7. Remove the shutdown rejection handler to prevent process leak
	// Clean up context files written for CLI agents
	try {
		const { cleanupAllContextFiles } = require('./lib/context/contextFileWriter');
		await cleanupAllContextFiles();
	} catch { /* non-critical */ }

	process.removeListener('unhandledRejection', shutdownRejectionHandler);

	console.warn('[JanumiCode] Graceful shutdown complete');
	safeLog('info', 'Graceful shutdown complete');
}

/**
 * Extension deactivation
 * Called when the extension is deactivated
 */
export async function deactivate(): Promise<void> {
	console.warn('[JanumiCode] Extension deactivation started');
	try {
		await performGracefulShutdown();
	} catch (err) {
		console.error('[JanumiCode] Graceful shutdown threw:', err);
		// Last resort — at least close the database
		try { closeDatabase(); } catch { /* swallow */ }
	}
	console.warn('[JanumiCode] Extension deactivation finished');
}
