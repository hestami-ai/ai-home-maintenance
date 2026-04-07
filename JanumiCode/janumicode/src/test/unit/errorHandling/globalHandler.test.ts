import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as vscode from 'vscode';
import {
	getGlobalErrorHandler,
	initializeErrorHandler,
	handleError,
	ErrorSeverity,
	ErrorCategory,
} from '../../../lib/errorHandling/globalHandler';

describe('globalHandler', () => {
	let mockOutputChannel: vscode.OutputChannel;
	let mockWindow: typeof vscode.window;
	let appendLineSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Reset singleton
		(getGlobalErrorHandler as any).handlerInstance = null;

		// Mock output channel
		appendLineSpy = vi.fn();
		mockOutputChannel = {
			appendLine: appendLineSpy,
			show: vi.fn(),
			dispose: vi.fn(),
		} as any;

		// Mock vscode.window
		mockWindow = {
			showErrorMessage: vi.fn().mockResolvedValue(undefined),
			showWarningMessage: vi.fn().mockResolvedValue(undefined),
			showInformationMessage: vi.fn().mockResolvedValue(undefined),
			createWebviewPanel: vi.fn().mockReturnValue({
				webview: { html: '' },
			}),
		} as any;

		// Mock vscode module
		vi.mock('vscode', () => ({
			window: mockWindow,
			ViewColumn: { One: 1 },
		}));
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('ErrorSeverity enum', () => {
		it('defines all severity levels', () => {
			expect(ErrorSeverity.INFO).toBe('INFO');
			expect(ErrorSeverity.WARNING).toBe('WARNING');
			expect(ErrorSeverity.ERROR).toBe('ERROR');
			expect(ErrorSeverity.CRITICAL).toBe('CRITICAL');
			expect(ErrorSeverity.FATAL).toBe('FATAL');
		});
	});

	describe('ErrorCategory enum', () => {
		it('defines all error categories', () => {
			expect(ErrorCategory.DATABASE).toBe('DATABASE');
			expect(ErrorCategory.LLM_API).toBe('LLM_API');
			expect(ErrorCategory.WORKFLOW).toBe('WORKFLOW');
			expect(ErrorCategory.FILESYSTEM).toBe('FILESYSTEM');
			expect(ErrorCategory.CONFIGURATION).toBe('CONFIGURATION');
			expect(ErrorCategory.VALIDATION).toBe('VALIDATION');
			expect(ErrorCategory.EXTERNAL_TOOL).toBe('EXTERNAL_TOOL');
			expect(ErrorCategory.NETWORK).toBe('NETWORK');
			expect(ErrorCategory.UNKNOWN).toBe('UNKNOWN');
		});
	});

	describe('getGlobalErrorHandler', () => {
		it('returns singleton instance', () => {
			const handler1 = getGlobalErrorHandler();
			const handler2 = getGlobalErrorHandler();
			expect(handler1).toBe(handler2);
		});

		it('creates instance on first call', () => {
			const handler = getGlobalErrorHandler();
			expect(handler).toBeDefined();
		});
	});

	describe('initializeErrorHandler', () => {
		it('initializes handler with output channel', () => {
			initializeErrorHandler(mockOutputChannel);
			const handler = getGlobalErrorHandler();
			expect(handler).toBeDefined();
		});
	});

	describe('handleError - convenience function', () => {
		it('delegates to global handler', () => {
			initializeErrorHandler(mockOutputChannel);
			const error = new Error('Test error');
			const result = handleError(error);

			expect(result).toBeDefined();
			expect(result.message).toBe('Test error');
		});

		it('accepts severity and category options', () => {
			initializeErrorHandler(mockOutputChannel);
			const error = new Error('Custom error');
			const result = handleError(error, {
				severity: ErrorSeverity.WARNING,
				category: ErrorCategory.DATABASE,
			});

			expect(result.severity).toBe(ErrorSeverity.WARNING);
			expect(result.category).toBe(ErrorCategory.DATABASE);
		});
	});

	describe('handleError method', () => {
		beforeEach(() => {
			initializeErrorHandler(mockOutputChannel);
		});

		it('creates structured error from Error object', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Test error');
			const result = handler.handleError(error);

			expect(result.message).toBe('Test error');
			expect(result.errorId).toMatch(/^ERR-/);
			expect(result.severity).toBeDefined();
			expect(result.category).toBeDefined();
			expect(result.timestamp).toBeDefined();
		});

		it('creates structured error from non-Error value', () => {
			const handler = getGlobalErrorHandler();
			const result = handler.handleError('String error');

			expect(result.message).toBe('String error');
		});

		it('includes stack trace when available', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('With stack');
			const result = handler.handleError(error);

			expect(result.stack).toBeDefined();
			expect(result.originalError).toBe(error);
		});

		it('includes context when provided', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Context test');
			const context = { userId: '123', action: 'test' };
			const result = handler.handleError(error, { context });

			expect(result.context).toEqual(context);
		});

		it('logs error to output channel', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Log test');
			handler.handleError(error);

			expect(appendLineSpy).toHaveBeenCalled();
			expect(appendLineSpy).toHaveBeenCalledWith(expect.stringContaining('Log test'));
		});

		it('stores error in log', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Store test');
			handler.handleError(error);

			const log = handler.getErrorLog();
			expect(log).toHaveLength(1);
			expect(log[0].message).toBe('Store test');
		});
	});

	describe('severity determination', () => {
		beforeEach(() => {
			initializeErrorHandler(mockOutputChannel);
		});

		it('detects FATAL severity from message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Fatal error occurred');
			const result = handler.handleError(error);

			expect(result.severity).toBe(ErrorSeverity.FATAL);
		});

		it('detects CRITICAL severity from message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Critical database corruption');
			const result = handler.handleError(error);

			expect(result.severity).toBe(ErrorSeverity.CRITICAL);
		});

		it('detects WARNING severity from message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Warning: deprecated API');
			const result = handler.handleError(error);

			expect(result.severity).toBe(ErrorSeverity.WARNING);
		});

		it('detects INFO severity from message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Info: operation completed');
			const result = handler.handleError(error);

			expect(result.severity).toBe(ErrorSeverity.INFO);
		});

		it('defaults to ERROR severity', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Generic error');
			const result = handler.handleError(error);

			expect(result.severity).toBe(ErrorSeverity.ERROR);
		});

		it('respects provided severity option', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Test');
			const result = handler.handleError(error, { severity: ErrorSeverity.CRITICAL });

			expect(result.severity).toBe(ErrorSeverity.CRITICAL);
		});
	});

	describe('error categorization', () => {
		beforeEach(() => {
			initializeErrorHandler(mockOutputChannel);
		});

		it('categorizes DATABASE errors from message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Database connection failed');
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.DATABASE);
		});

		it('categorizes DATABASE errors from code', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Failed') as any;
			error.code = 'DB_ERROR';
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.DATABASE);
		});

		it('categorizes LLM_API errors', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('OpenAI API key invalid');
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.LLM_API);
		});

		it('categorizes WORKFLOW errors', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Workflow phase transition failed');
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.WORKFLOW);
		});

		it('categorizes FILESYSTEM errors from message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('File not found');
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.FILESYSTEM);
		});

		it('categorizes FILESYSTEM errors from ENOENT code', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Failed') as any;
			error.code = 'ENOENT';
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.FILESYSTEM);
		});

		it('categorizes CONFIGURATION errors', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Invalid configuration setting');
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.CONFIGURATION);
		});

		it('categorizes VALIDATION errors', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Validation failed: invalid input');
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.VALIDATION);
		});

		it('categorizes EXTERNAL_TOOL errors', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Claude Code execution failed');
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.EXTERNAL_TOOL);
		});

		it('categorizes NETWORK errors from code', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Request failed') as any;
			error.code = 'ECONNREFUSED';
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.NETWORK);
		});

		it('categorizes NETWORK errors from message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Network timeout');
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.NETWORK);
		});

		it('defaults to UNKNOWN category', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Mysterious error');
			const result = handler.handleError(error);

			expect(result.category).toBe(ErrorCategory.UNKNOWN);
		});

		it('respects provided category option', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Test');
			const result = handler.handleError(error, { category: ErrorCategory.WORKFLOW });

			expect(result.category).toBe(ErrorCategory.WORKFLOW);
		});
	});

	describe('recoverability', () => {
		beforeEach(() => {
			initializeErrorHandler(mockOutputChannel);
		});

		it('marks FATAL errors as non-recoverable', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Fatal system error');
			const result = handler.handleError(error, { severity: ErrorSeverity.FATAL });

			expect(result.recoverable).toBe(false);
		});

		it('marks NETWORK errors as recoverable', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Network request failed') as any;
			error.code = 'ETIMEDOUT';
			const result = handler.handleError(error);

			expect(result.recoverable).toBe(true);
		});

		it('marks LLM_API errors as recoverable', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('API rate limit exceeded');
			const result = handler.handleError(error);

			expect(result.recoverable).toBe(true);
		});

		it('marks CONFIGURATION errors as recoverable', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Invalid config value');
			const result = handler.handleError(error);

			expect(result.recoverable).toBe(true);
		});

		it('marks VALIDATION errors as non-recoverable', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Validation failed');
			const result = handler.handleError(error);

			expect(result.recoverable).toBe(false);
		});

		it('marks CRITICAL DATABASE errors as non-recoverable', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Critical database error');
			const result = handler.handleError(error, {
				severity: ErrorSeverity.CRITICAL,
				category: ErrorCategory.DATABASE,
			});

			expect(result.recoverable).toBe(false);
		});

		it('marks non-CRITICAL DATABASE errors as recoverable', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Database query timeout');
			const result = handler.handleError(error, {
				severity: ErrorSeverity.ERROR,
				category: ErrorCategory.DATABASE,
			});

			expect(result.recoverable).toBe(true);
		});
	});

	describe('recovery suggestions', () => {
		beforeEach(() => {
			initializeErrorHandler(mockOutputChannel);
		});

		it('provides DATABASE recovery suggestions', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Database error');
			const result = handler.handleError(error);

			expect(result.recoverySuggestions).toContain('Check database file permissions');
			expect(result.recoverySuggestions).toContain('Verify database is not corrupted');
		});

		it('provides LLM_API recovery suggestions', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('LLM API failed');
			const result = handler.handleError(error);

			expect(result.recoverySuggestions).toContain('Check API key configuration');
			expect(result.recoverySuggestions).toContain('Verify internet connection');
			expect(result.recoverySuggestions).toContain('Check API rate limits');
		});

		it('provides NETWORK recovery suggestions', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Network error') as any;
			error.code = 'ECONNREFUSED';
			const result = handler.handleError(error);

			expect(result.recoverySuggestions).toContain('Check internet connection');
			expect(result.recoverySuggestions).toContain('Verify proxy settings');
		});

		it('provides CONFIGURATION recovery suggestions', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Config error');
			const result = handler.handleError(error);

			expect(result.recoverySuggestions).toContain('Review extension settings');
			expect(result.recoverySuggestions).toContain('Reset to default settings');
		});

		it('provides FILESYSTEM recovery suggestions', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('File access denied') as any;
			error.code = 'EACCES';
			const result = handler.handleError(error);

			expect(result.recoverySuggestions).toContain('Check file permissions');
			expect(result.recoverySuggestions).toContain('Ensure sufficient disk space');
		});

		it('provides default recovery suggestions for UNKNOWN category', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Unknown error');
			const result = handler.handleError(error);

			expect(result.recoverySuggestions).toContain('Check error logs');
			expect(result.recoverySuggestions).toContain('Try restarting VS Code');
		});
	});

	describe('error log management', () => {
		beforeEach(() => {
			initializeErrorHandler(mockOutputChannel);
		});

		it('stores multiple errors in log', () => {
			const handler = getGlobalErrorHandler();
			handler.handleError(new Error('Error 1'));
			handler.handleError(new Error('Error 2'));
			handler.handleError(new Error('Error 3'));

			const log = handler.getErrorLog();
			expect(log).toHaveLength(3);
		});

		it('limits log size to maxLogSize', () => {
			const handler = getGlobalErrorHandler();
			// Create 1001 errors (maxLogSize is 1000)
			for (let i = 0; i < 1001; i++) {
				handler.handleError(new Error(`Error ${i}`));
			}

			const log = handler.getErrorLog();
			expect(log).toHaveLength(1000);
		});

		it('removes oldest error when exceeding maxLogSize', () => {
			const handler = getGlobalErrorHandler();
			for (let i = 0; i < 1001; i++) {
				handler.handleError(new Error(`Error ${i}`));
			}

			const log = handler.getErrorLog();
			expect(log[0].message).toBe('Error 1'); // First error removed
			expect(log.at(-1)?.message).toBe('Error 1000');
		});

		it('clears error log', () => {
			const handler = getGlobalErrorHandler();
			handler.handleError(new Error('Error 1'));
			handler.handleError(new Error('Error 2'));

			handler.clearErrorLog();
			const log = handler.getErrorLog();
			expect(log).toHaveLength(0);
		});

		it('filters errors by category', () => {
			const handler = getGlobalErrorHandler();
			handler.handleError(new Error('Database error'));
			handler.handleError(new Error('LLM error'));
			handler.handleError(new Error('Database error 2'));

			const dbErrors = handler.getErrorsByCategory(ErrorCategory.DATABASE);
			expect(dbErrors).toHaveLength(2);
			dbErrors.forEach((err) => {
				expect(err.category).toBe(ErrorCategory.DATABASE);
			});
		});

		it('filters errors by severity', () => {
			const handler = getGlobalErrorHandler();
			handler.handleError(new Error('Fatal error'));
			handler.handleError(new Error('Warning: test'));
			handler.handleError(new Error('Fatal error 2'));

			const fatalErrors = handler.getErrorsBySeverity(ErrorSeverity.FATAL);
			expect(fatalErrors).toHaveLength(2);
			fatalErrors.forEach((err) => {
				expect(err.severity).toBe(ErrorSeverity.FATAL);
			});
		});

		it('returns copy of error log', () => {
			const handler = getGlobalErrorHandler();
			handler.handleError(new Error('Test'));

			const log1 = handler.getErrorLog();
			const log2 = handler.getErrorLog();

			expect(log1).not.toBe(log2); // Different array instances
			expect(log1).toEqual(log2); // Same content
		});
	});

	describe('user notification', () => {
		beforeEach(() => {
			initializeErrorHandler(mockOutputChannel);
		});

		it('does not show INFO errors to user', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Info: test');
			handler.handleError(error);

			expect(mockWindow.showInformationMessage).not.toHaveBeenCalled();
			expect(mockWindow.showWarningMessage).not.toHaveBeenCalled();
			expect(mockWindow.showErrorMessage).not.toHaveBeenCalled();
		});

		it('shows WARNING errors as warning message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Warning: test');
			handler.handleError(error);

			expect(mockWindow.showWarningMessage).toHaveBeenCalledWith(
				expect.stringContaining('Warning: test'),
				'View Details'
			);
		});

		it('shows ERROR severity as error message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Generic error');
			handler.handleError(error);

			expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining('Generic error'),
				'View Details',
				'View Logs'
			);
		});

		it('shows CRITICAL errors as error message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Critical error');
			handler.handleError(error);

			expect(mockWindow.showErrorMessage).toHaveBeenCalled();
		});

		it('shows FATAL errors as error message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Fatal error');
			handler.handleError(error);

			expect(mockWindow.showErrorMessage).toHaveBeenCalled();
		});

		it('indicates if error is recoverable in message', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Network timeout') as any;
			error.code = 'ETIMEDOUT';
			handler.handleError(error);

			expect(mockWindow.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining('(Recoverable)'),
				'View Details',
				'View Logs'
			);
		});
	});

	describe('edge cases', () => {
		beforeEach(() => {
			initializeErrorHandler(mockOutputChannel);
		});

		it('handles error with custom code', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Test');
			const result = handler.handleError(error, { code: 'CUSTOM_001' });

			expect(result.code).toBe('CUSTOM_001');
		});

		it('handles error object with existing code property', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Test') as any;
			error.code = 'EXISTING_CODE';
			const result = handler.handleError(error);

			expect(result.code).toBe('EXISTING_CODE');
		});

		it('generates code from category and severity when no code provided', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Test');
			const result = handler.handleError(error, {
				category: ErrorCategory.DATABASE,
				severity: ErrorSeverity.CRITICAL,
			});

			expect(result.code).toBe('DATABASE_CRITICAL');
		});

		it('handles error without output channel', () => {
			const handler = getGlobalErrorHandler();
			// Don't initialize with output channel
			const error = new Error('Test');
			const result = handler.handleError(error);

			expect(result).toBeDefined();
			expect(result.message).toBe('Test');
		});

		it('handles error with all optional fields', () => {
			const handler = getGlobalErrorHandler();
			const error = new Error('Complete error');
			const result = handler.handleError(error, {
				severity: ErrorSeverity.ERROR,
				category: ErrorCategory.WORKFLOW,
				context: { step: 'validation', phase: 'VERIFY' },
				code: 'WORKFLOW_001',
			});

			expect(result.severity).toBe(ErrorSeverity.ERROR);
			expect(result.category).toBe(ErrorCategory.WORKFLOW);
			expect(result.context).toEqual({ step: 'validation', phase: 'VERIFY' });
			expect(result.code).toBe('WORKFLOW_001');
		});

		it('generates unique error IDs', () => {
			const handler = getGlobalErrorHandler();
			const result1 = handler.handleError(new Error('Test 1'));
			const result2 = handler.handleError(new Error('Test 2'));

			expect(result1.errorId).not.toBe(result2.errorId);
		});

		it('includes timestamp in ISO format', () => {
			const handler = getGlobalErrorHandler();
			const result = handler.handleError(new Error('Test'));

			expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});
	});
});
