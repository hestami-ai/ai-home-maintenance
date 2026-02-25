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
	dbLog.info('Initializing database...');
	const dbInitResult = initializeDatabase({
		path: config.databasePath,
	});

	if (!dbInitResult.success) {
		dbLog.error('Failed to initialize database', { error: dbInitResult.error.message });
		vscode.window.showErrorMessage(`JanumiCode: Failed to initialize database: ${dbInitResult.error.message}`);
		return;
	}

	const db = dbInitResult.value;
	dbLog.info('Database connection established');

	// Run migrations (initialize schema)
	dbLog.info('Running database migrations...');
	const schemaResult = initializeSchema(db);

	if (!schemaResult.success) {
		dbLog.error('Failed to initialize schema', { error: schemaResult.error.message });
		vscode.window.showErrorMessage(`JanumiCode: Failed to initialize schema: ${schemaResult.error.message}`);
		closeDatabase();
		return;
	}

	dbLog.info('Database schema initialized successfully');

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
	const governedStreamProvider = registerWebviewProviders(context);

	// Register commands
	registerCommands(context, governedStreamProvider);

	// Setup status bar
	setupStatusBar(context);

	// Show activation success
	logger.info('Extension activated successfully');
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
			governedStreamProvider
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
 * Extension deactivation
 * Called when the extension is deactivated
 */
export function deactivate(): void {
	try {
		const logger = getLogger();
		logger.info('Deactivating extension...');

		// Close database connection
		const closeResult = closeDatabase();
		if (closeResult.success) {
			logger.info('Database connection closed');
		} else {
			logger.error('Error closing database', { error: closeResult.error.message });
		}

		logger.info('Extension deactivated');
	} catch {
		// Logger may not be initialized if activation failed
		closeDatabase();
	}
}
