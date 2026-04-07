/**
 * Global Error Handler
 * Implements Phase 9.4.1: Global error handling for JanumiCode
 * Catches and processes all errors in a centralized manner
 */

import * as vscode from 'vscode';
import { emitError } from '../integration/eventBus';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
	/** Informational - user should be aware */
	INFO = 'INFO',
	/** Warning - something unexpected but not critical */
	WARNING = 'WARNING',
	/** Error - operation failed but system is stable */
	ERROR = 'ERROR',
	/** Critical - system stability affected */
	CRITICAL = 'CRITICAL',
	/** Fatal - system cannot continue */
	FATAL = 'FATAL',
}

/**
 * Error category
 */
export enum ErrorCategory {
	/** Database-related errors */
	DATABASE = 'DATABASE',
	/** LLM API errors */
	LLM_API = 'LLM_API',
	/** Workflow execution errors */
	WORKFLOW = 'WORKFLOW',
	/** File system errors */
	FILESYSTEM = 'FILESYSTEM',
	/** Configuration errors */
	CONFIGURATION = 'CONFIGURATION',
	/** Validation errors */
	VALIDATION = 'VALIDATION',
	/** External tool errors (Claude Code, etc.) */
	EXTERNAL_TOOL = 'EXTERNAL_TOOL',
	/** Network errors */
	NETWORK = 'NETWORK',
	/** Unknown/uncategorized errors */
	UNKNOWN = 'UNKNOWN',
}

/**
 * Structured error
 */
export interface StructuredError {
	/** Error ID (unique) */
	errorId: string;
	/** Error code */
	code: string;
	/** Error message */
	message: string;
	/** Error severity */
	severity: ErrorSeverity;
	/** Error category */
	category: ErrorCategory;
	/** Timestamp */
	timestamp: string;
	/** Stack trace */
	stack?: string;
	/** Context information */
	context?: Record<string, unknown>;
	/** Original error */
	originalError?: Error;
	/** Whether error is recoverable */
	recoverable: boolean;
	/** Recovery suggestions */
	recoverySuggestions: string[];
}

/**
 * Error handler instance
 */
class GlobalErrorHandler {
	private outputChannel: vscode.OutputChannel | null = null;
	private errorLog: StructuredError[] = [];
	private readonly maxLogSize = 1000;

	/**
	 * Initialize error handler
	 */
	initialize(outputChannel: vscode.OutputChannel): void {
		this.outputChannel = outputChannel;
		this.setupUncaughtHandlers();
	}

	/**
	 * Setup handlers for uncaught errors
	 */
	private setupUncaughtHandlers(): void {
		// Handle uncaught exceptions
		process.on('uncaughtException', (error: Error) => {
			this.handleError(error, {
				severity: ErrorSeverity.FATAL,
				category: ErrorCategory.UNKNOWN,
				context: { source: 'uncaughtException' },
			});
		});

		// Handle unhandled promise rejections
		process.on('unhandledRejection', (reason: any) => {
			const error = reason instanceof Error ? reason : new Error(String(reason));
			this.handleError(error, {
				severity: ErrorSeverity.CRITICAL,
				category: ErrorCategory.UNKNOWN,
				context: { source: 'unhandledRejection' },
			});
		});
	}

	/**
	 * Handle error
	 * Central error processing
	 *
	 * @param error Error to handle
	 * @param options Error options
	 * @returns Structured error
	 */
	handleError(
		error: unknown,
		options?: {
			severity?: ErrorSeverity;
			category?: ErrorCategory;
			context?: Record<string, unknown>;
			code?: string;
		}
	): StructuredError {
		// Convert to structured error
		const structuredError = this.createStructuredError(error, options);

		// Log error
		this.logError(structuredError);

		// Emit error event
		emitError(structuredError.code, structuredError.message, {
			errorId: structuredError.errorId,
			severity: structuredError.severity,
			category: structuredError.category,
		});

		// Show to user if appropriate
		this.showErrorToUser(structuredError);

		// Store in error log
		this.storeError(structuredError);

		return structuredError;
	}

	/**
	 * Create structured error
	 */
	private createStructuredError(
		error: unknown,
		options?: {
			severity?: ErrorSeverity;
			category?: ErrorCategory;
			context?: Record<string, unknown>;
			code?: string;
		}
	): StructuredError {
		const errorObj = error instanceof Error ? error : new Error(String(error));

		// Determine severity and category
		const severity = options?.severity || this.determineSeverity(errorObj);
		const category = options?.category || this.categorizeError(errorObj);

		// Generate error ID
		const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substring(7)}`;

		// Extract code
		const code =
			options?.code ||
			(errorObj as any).code ||
			`${category}_${severity}`.toUpperCase();

		// Determine recoverability
		const recoverable = this.isRecoverable(severity, category);

		// Get recovery suggestions
		const recoverySuggestions = this.getRecoverySuggestions(category, errorObj);

		return {
			errorId,
			code,
			message: errorObj.message,
			severity,
			category,
			timestamp: new Date().toISOString(),
			stack: errorObj.stack,
			context: options?.context,
			originalError: errorObj,
			recoverable,
			recoverySuggestions,
		};
	}

	/**
	 * Determine error severity
	 */
	private determineSeverity(error: Error): ErrorSeverity {
		const message = error.message.toLowerCase();

		if (message.includes('fatal') || message.includes('cannot continue')) {
			return ErrorSeverity.FATAL;
		}
		if (message.includes('critical') || message.includes('corruption')) {
			return ErrorSeverity.CRITICAL;
		}
		if (message.includes('warning')) {
			return ErrorSeverity.WARNING;
		}
		if (message.includes('info')) {
			return ErrorSeverity.INFO;
		}

		return ErrorSeverity.ERROR;
	}

	/**
	 * Categorize error
	 */
	private categorizeError(error: Error): ErrorCategory {
		const message = error.message.toLowerCase();
		const code = (error as any).code?.toUpperCase() || '';

		if (
			message.includes('database') ||
			message.includes('sqlite') ||
			code.includes('DB')
		) {
			return ErrorCategory.DATABASE;
		}
		if (
			message.includes('llm') ||
			message.includes('api') ||
			message.includes('openai') ||
			message.includes('anthropic')
		) {
			return ErrorCategory.LLM_API;
		}
		if (message.includes('workflow') || message.includes('phase')) {
			return ErrorCategory.WORKFLOW;
		}
		if (
			message.includes('file') ||
			code === 'ENOENT' ||
			code === 'EACCES' ||
			code === 'EPERM'
		) {
			return ErrorCategory.FILESYSTEM;
		}
		if (message.includes('config') || message.includes('setting')) {
			return ErrorCategory.CONFIGURATION;
		}
		if (message.includes('validation') || message.includes('invalid')) {
			return ErrorCategory.VALIDATION;
		}
		if (message.includes('claude code') || message.includes('external')) {
			return ErrorCategory.EXTERNAL_TOOL;
		}
		if (
			code === 'ECONNREFUSED' ||
			code === 'ENOTFOUND' ||
			code === 'ETIMEDOUT' ||
			message.includes('network')
		) {
			return ErrorCategory.NETWORK;
		}

		return ErrorCategory.UNKNOWN;
	}

	/**
	 * Determine if error is recoverable
	 */
	private isRecoverable(severity: ErrorSeverity, category: ErrorCategory): boolean {
		// Fatal errors are never recoverable
		if (severity === ErrorSeverity.FATAL) {
			return false;
		}

		// Category-specific recoverability
		switch (category) {
			case ErrorCategory.NETWORK:
			case ErrorCategory.LLM_API:
				return true; // Can retry
			case ErrorCategory.CONFIGURATION:
				return true; // Can reconfigure
			case ErrorCategory.VALIDATION:
				return false; // Input error, user must fix
			case ErrorCategory.DATABASE:
				return severity !== ErrorSeverity.CRITICAL; // Depends on severity
			default:
				return true; // Default to recoverable
		}
	}

	/**
	 * Get recovery suggestions
	 */
	private getRecoverySuggestions(
		category: ErrorCategory,
		error: Error
	): string[] {
		const suggestions: string[] = [];

		switch (category) {
			case ErrorCategory.DATABASE:
				suggestions.push(
					'Check database file permissions',
					'Verify database is not corrupted',
					'Try restarting VS Code',
				);
				break;

			case ErrorCategory.LLM_API:
				suggestions.push(
					'Check API key configuration',
					'Verify internet connection',
					'Check API rate limits',
					'Retry after a short delay',
				);
				break;

			case ErrorCategory.NETWORK:
				suggestions.push(
					'Check internet connection',
					'Verify proxy settings',
					'Retry operation',
				);
				break;

			case ErrorCategory.CONFIGURATION:
				suggestions.push(
					'Review extension settings',
					'Verify configuration values',
					'Reset to default settings',
				);
				break;

			case ErrorCategory.FILESYSTEM:
				suggestions.push(
					'Check file permissions',
					'Verify file paths',
					'Ensure sufficient disk space',
				);
				break;

			default:
				suggestions.push(
					'Check error logs',
					'Try restarting VS Code',
					'Report issue if problem persists',
				);
		}

		return suggestions;
	}

	/**
	 * Log error to output channel
	 */
	private logError(error: StructuredError): void {
		if (!this.outputChannel) {
			return;
		}

		this.outputChannel.appendLine(`\n[${error.severity}] ${error.timestamp}`);
		this.outputChannel.appendLine(`Error ID: ${error.errorId}`);
		this.outputChannel.appendLine(`Code: ${error.code}`);
		this.outputChannel.appendLine(`Category: ${error.category}`);
		this.outputChannel.appendLine(`Message: ${error.message}`);

		if (error.context) {
			this.outputChannel.appendLine(`Context: ${JSON.stringify(error.context, null, 2)}`);
		}

		if (error.stack) {
			this.outputChannel.appendLine(`Stack Trace:\n${error.stack}`);
		}

		if (error.recoverySuggestions.length > 0) {
			this.outputChannel.appendLine(`Recovery Suggestions:`);
			error.recoverySuggestions.forEach((suggestion, index) => {
				this.outputChannel!.appendLine(`  ${index + 1}. ${suggestion}`);
			});
		}

		this.outputChannel.appendLine('---');
	}

	/**
	 * Show error to user
	 */
	private showErrorToUser(error: StructuredError): void {
		// Only show errors above INFO level
		if (error.severity === ErrorSeverity.INFO) {
			return;
		}

		const message = `${error.message}${error.recoverable ? ' (Recoverable)' : ''}`;

		switch (error.severity) {
			case ErrorSeverity.WARNING:
				vscode.window.showWarningMessage(message, 'View Details').then((selection) => {
					if (selection === 'View Details') {
						this.outputChannel?.show();
					}
				});
				break;

			case ErrorSeverity.ERROR:
			case ErrorSeverity.CRITICAL:
			case ErrorSeverity.FATAL:
				vscode.window
					.showErrorMessage(message, 'View Details', 'View Logs')
					.then((selection) => {
						if (selection === 'View Details') {
							this.showErrorDetails(error);
						} else if (selection === 'View Logs') {
							this.outputChannel?.show();
						}
					});
				break;
		}
	}

	/**
	 * Show error details
	 */
	private async showErrorDetails(error: StructuredError): Promise<void> {
		const panel = vscode.window.createWebviewPanel(
			'janumicode.errorDetails',
			`Error: ${error.code}`,
			vscode.ViewColumn.One,
			{}
		);

		panel.webview.html = this.getErrorDetailsHTML(error);
	}

	/**
	 * Get error details HTML
	 */
	private getErrorDetailsHTML(error: StructuredError): string {
		return `<!DOCTYPE html>
<html>
<head>
	<style>
		body {
			font-family: var(--vscode-font-family);
			padding: 20px;
			color: var(--vscode-foreground);
		}
		.section {
			margin-bottom: 20px;
		}
		.label {
			font-weight: bold;
			color: var(--vscode-descriptionForeground);
		}
		.value {
			margin-top: 5px;
		}
		.code {
			background: var(--vscode-textCodeBlock-background);
			padding: 10px;
			border-radius: 4px;
			font-family: monospace;
			white-space: pre-wrap;
		}
		.suggestions li {
			margin: 5px 0;
		}
	</style>
</head>
<body>
	<h1>Error Details</h1>

	<div class="section">
		<div class="label">Error ID:</div>
		<div class="value">${error.errorId}</div>
	</div>

	<div class="section">
		<div class="label">Code:</div>
		<div class="value">${error.code}</div>
	</div>

	<div class="section">
		<div class="label">Message:</div>
		<div class="value">${error.message}</div>
	</div>

	<div class="section">
		<div class="label">Severity:</div>
		<div class="value">${error.severity}</div>
	</div>

	<div class="section">
		<div class="label">Category:</div>
		<div class="value">${error.category}</div>
	</div>

	<div class="section">
		<div class="label">Timestamp:</div>
		<div class="value">${error.timestamp}</div>
	</div>

	<div class="section">
		<div class="label">Recoverable:</div>
		<div class="value">${error.recoverable ? 'Yes' : 'No'}</div>
	</div>

	${
		error.recoverySuggestions.length > 0
			? `
	<div class="section">
		<div class="label">Recovery Suggestions:</div>
		<ul class="suggestions">
			${error.recoverySuggestions.map((s) => `<li>${s}</li>`).join('')}
		</ul>
	</div>
	`
			: ''
	}

	${
		error.stack
			? `
	<div class="section">
		<div class="label">Stack Trace:</div>
		<div class="code">${error.stack}</div>
	</div>
	`
			: ''
	}

	${
		error.context
			? `
	<div class="section">
		<div class="label">Context:</div>
		<div class="code">${JSON.stringify(error.context, null, 2)}</div>
	</div>
	`
			: ''
	}
</body>
</html>`;
	}

	/**
	 * Store error in log
	 */
	private storeError(error: StructuredError): void {
		this.errorLog.push(error);

		// Limit log size
		if (this.errorLog.length > this.maxLogSize) {
			this.errorLog.shift();
		}
	}

	/**
	 * Get error log
	 */
	getErrorLog(): StructuredError[] {
		return [...this.errorLog];
	}

	/**
	 * Clear error log
	 */
	clearErrorLog(): void {
		this.errorLog = [];
	}

	/**
	 * Get errors by category
	 */
	getErrorsByCategory(category: ErrorCategory): StructuredError[] {
		return this.errorLog.filter((e) => e.category === category);
	}

	/**
	 * Get errors by severity
	 */
	getErrorsBySeverity(severity: ErrorSeverity): StructuredError[] {
		return this.errorLog.filter((e) => e.severity === severity);
	}
}

// Singleton instance
let handlerInstance: GlobalErrorHandler | null = null;

/**
 * Get global error handler instance
 */
export function getGlobalErrorHandler(): GlobalErrorHandler {
	handlerInstance ??= new GlobalErrorHandler();
	return handlerInstance;
}

/**
 * Initialize global error handler
 */
export function initializeErrorHandler(outputChannel: vscode.OutputChannel): void {
	getGlobalErrorHandler().initialize(outputChannel);
}

/**
 * Handle error (convenience function)
 */
export function handleError(
	error: unknown,
	options?: {
		severity?: ErrorSeverity;
		category?: ErrorCategory;
		context?: Record<string, unknown>;
		code?: string;
	}
): StructuredError {
	return getGlobalErrorHandler().handleError(error, options);
}
