import { describe, it, expect } from 'vitest';
import { classifyCLIError, CLIErrorCode } from '../../../lib/logging/errorClassifier';

describe('Error Classifier', () => {
	describe('classifyCLIError', () => {
		describe('spawn-level errors', () => {
			it('classifies ENOENT as CLI_NOT_FOUND', () => {
				const error = new Error('spawn ENOENT') as NodeJS.ErrnoException;
				error.code = 'ENOENT';

				const classified = classifyCLIError(error, 'gemini-cli');

				expect(classified.code).toBe(CLIErrorCode.CLI_NOT_FOUND);
				expect(classified.userMessage).toContain('not installed');
				expect(classified.retryable).toBe(false);
			});

			it('classifies EACCES as CLI_PERMISSION_DENIED', () => {
				const error = new Error('spawn EACCES') as NodeJS.ErrnoException;
				error.code = 'EACCES';

				const classified = classifyCLIError(error, 'claude-code');

				expect(classified.code).toBe(CLIErrorCode.CLI_PERMISSION_DENIED);
				expect(classified.userMessage).toContain('Permission denied');
				expect(classified.retryable).toBe(false);
			});

			it('classifies EPERM as CLI_PERMISSION_DENIED', () => {
				const error = new Error('spawn EPERM') as NodeJS.ErrnoException;
				error.code = 'EPERM';

				const classified = classifyCLIError(error, 'codex-cli');

				expect(classified.code).toBe(CLIErrorCode.CLI_PERMISSION_DENIED);
				expect(classified.retryable).toBe(false);
			});

			it('includes install instructions for known providers', () => {
				const error = new Error('spawn ENOENT') as NodeJS.ErrnoException;
				error.code = 'ENOENT';

				const classified = classifyCLIError(error, 'claude-code');

				expect(classified.recoverySuggestions.length).toBeGreaterThan(0);
			});
		});

		describe('timeout errors', () => {
			it('classifies timeout message as CLI_TIMEOUT', () => {
				const error = new Error('Operation timeout after 30000ms');

				const classified = classifyCLIError(error, 'gemini-cli');

				expect(classified.code).toBe(CLIErrorCode.CLI_TIMEOUT);
				expect(classified.userMessage).toContain('timed out');
				expect(classified.retryable).toBe(true);
			});

			it('classifies TIMEOUT message as CLI_TIMEOUT', () => {
				const error = new Error('TIMEOUT: process did not complete');

				const classified = classifyCLIError(error, 'claude-code');

				expect(classified.code).toBe(CLIErrorCode.CLI_TIMEOUT);
				expect(classified.retryable).toBe(true);
			});
		});

		describe('exit code analysis', () => {
			it('classifies auth errors from stderr', () => {
				const error = new Error('CLI failed');
				const stderr = 'Error: Invalid API key provided';

				const classified = classifyCLIError(error, 'gemini-cli', 1, stderr);

				expect(classified.code).toBe(CLIErrorCode.CLI_AUTH_ERROR);
				expect(classified.userMessage).toContain('authentication');
				expect(classified.retryable).toBe(false);
			});

			it('classifies unauthorized errors', () => {
				const error = new Error('CLI failed');
				const stderr = '401 Unauthorized';

				const classified = classifyCLIError(error, 'claude-code', 1, stderr);

				expect(classified.code).toBe(CLIErrorCode.CLI_AUTH_ERROR);
			});

			it('classifies forbidden errors', () => {
				const error = new Error('CLI failed');
				const stderr = '403 Forbidden - check your API key';

				const classified = classifyCLIError(error, 'gemini-cli', 1, stderr);

				expect(classified.code).toBe(CLIErrorCode.CLI_AUTH_ERROR);
			});

			it('classifies rate limit errors', () => {
				const error = new Error('CLI failed');
				const stderr = 'Rate limit exceeded. Try again later.';

				const classified = classifyCLIError(error, 'claude-code', 1, stderr);

				expect(classified.code).toBe(CLIErrorCode.CLI_RATE_LIMITED);
				expect(classified.userMessage).toContain('rate limited');
				expect(classified.retryable).toBe(true);
			});

			it('classifies 429 status as rate limit', () => {
				const error = new Error('CLI failed');
				const stderr = '429 Too Many Requests';

				const classified = classifyCLIError(error, 'gemini-cli', 1, stderr);

				expect(classified.code).toBe(CLIErrorCode.CLI_RATE_LIMITED);
			});

			it('classifies killed processes (exit 137)', () => {
				const error = new Error('CLI failed');
				const stderr = 'Process killed';

				const classified = classifyCLIError(error, 'claude-code', 137, stderr);

				expect(classified.code).toBe(CLIErrorCode.CLI_KILLED);
				expect(classified.userMessage).toContain('killed');
				expect(classified.retryable).toBe(true);
			});

			it('classifies killed processes (exit 143)', () => {
				const error = new Error('CLI failed');

				const classified = classifyCLIError(error, 'gemini-cli', 143);

				expect(classified.code).toBe(CLIErrorCode.CLI_KILLED);
			});

			it('classifies network errors from stderr', () => {
				const error = new Error('CLI failed');
				const stderr = 'Network connection failed: ECONNREFUSED';

				const classified = classifyCLIError(error, 'claude-code', 1, stderr);

				expect(classified.code).toBe(CLIErrorCode.CLI_NETWORK_ERROR);
				expect(classified.userMessage).toContain('network');
				expect(classified.retryable).toBe(true);
			});

			it('classifies ENOTFOUND as network error', () => {
				const error = new Error('CLI failed');
				const stderr = 'getaddrinfo ENOTFOUND api.example.com';

				const classified = classifyCLIError(error, 'gemini-cli', 1, stderr);

				expect(classified.code).toBe(CLIErrorCode.CLI_NETWORK_ERROR);
			});

			it('classifies generic exit errors', () => {
				const error = new Error('CLI failed');
				const stderr = 'Unknown error occurred';

				const classified = classifyCLIError(error, 'claude-code', 1, stderr);

				expect(classified.code).toBe(CLIErrorCode.CLI_EXIT_ERROR);
				expect(classified.userMessage).toContain('exit code 1');
				expect(classified.retryable).toBe(false);
			});

			it('includes stderr in detail message', () => {
				const error = new Error('CLI failed');
				const stderr = 'Detailed error information here';

				const classified = classifyCLIError(error, 'gemini-cli', 1, stderr);

				expect(classified.detailMessage).toContain('Detailed error');
			});

			it('truncates long stderr in detail message', () => {
				const error = new Error('CLI failed');
				const stderr = 'x'.repeat(1000);

				const classified = classifyCLIError(error, 'claude-code', 1, stderr);

				expect(classified.detailMessage.length).toBeLessThan(1000);
			});
		});

		describe('parse errors', () => {
			it('classifies JSON parse errors', () => {
				const error = new Error('Unexpected token in JSON at position 10');

				const classified = classifyCLIError(error, 'gemini-cli');

				expect(classified.code).toBe(CLIErrorCode.CLI_PARSE_ERROR);
				expect(classified.userMessage).toContain('unexpected response');
				expect(classified.retryable).toBe(true);
			});

			it('classifies generic parse errors', () => {
				const error = new Error('Failed to parse CLI output');

				const classified = classifyCLIError(error, 'claude-code');

				expect(classified.code).toBe(CLIErrorCode.CLI_PARSE_ERROR);
			});
		});

		describe('unknown errors', () => {
			it('classifies unrecognized errors as CLI_UNKNOWN', () => {
				const error = new Error('Something unexpected happened');

				const classified = classifyCLIError(error, 'gemini-cli');

				expect(classified.code).toBe(CLIErrorCode.CLI_UNKNOWN);
				expect(classified.userMessage).toContain('unexpected error');
				expect(classified.retryable).toBe(false);
			});

			it('preserves original error', () => {
				const error = new Error('Original error');

				const classified = classifyCLIError(error, 'claude-code');

				expect(classified.originalError).toBe(error);
			});

			it('includes provider in messages', () => {
				const error = new Error('Test error');

				const classified = classifyCLIError(error, 'test-provider');

				expect(classified.detailMessage).toContain('test-provider');
			});
		});

		describe('provider display names', () => {
			it('uses friendly name for claude-code', () => {
				const error = new Error('Test') as NodeJS.ErrnoException;
				error.code = 'ENOENT';

				const classified = classifyCLIError(error, 'claude-code');

				expect(classified.userMessage).toContain('Claude Code');
			});

			it('uses friendly name for gemini-cli', () => {
				const error = new Error('Test') as NodeJS.ErrnoException;
				error.code = 'ENOENT';

				const classified = classifyCLIError(error, 'gemini-cli');

				expect(classified.userMessage).toContain('Gemini CLI');
			});

			it('uses friendly name for codex-cli', () => {
				const error = new Error('Test') as NodeJS.ErrnoException;
				error.code = 'ENOENT';

				const classified = classifyCLIError(error, 'codex-cli');

				expect(classified.userMessage).toContain('Codex CLI');
			});

			it('uses provider ID for unknown providers', () => {
				const error = new Error('Test') as NodeJS.ErrnoException;
				error.code = 'ENOENT';

				const classified = classifyCLIError(error, 'unknown-provider');

				expect(classified.userMessage).toContain('unknown-provider');
			});
		});

		describe('recovery suggestions', () => {
			it('provides actionable suggestions for ENOENT', () => {
				const error = new Error('Test') as NodeJS.ErrnoException;
				error.code = 'ENOENT';

				const classified = classifyCLIError(error, 'claude-code');

				expect(classified.recoverySuggestions.length).toBeGreaterThan(0);
				expect(classified.recoverySuggestions.some(s => s.includes('PATH'))).toBe(true);
			});

			it('provides suggestions for permission errors', () => {
				const error = new Error('Test') as NodeJS.ErrnoException;
				error.code = 'EACCES';

				const classified = classifyCLIError(error, 'gemini-cli');

				expect(classified.recoverySuggestions.some(s => s.includes('chmod'))).toBe(true);
			});

			it('provides suggestions for timeout errors', () => {
				const error = new Error('timeout');

				const classified = classifyCLIError(error, 'claude-code');

				expect(classified.recoverySuggestions.some(s => s.includes('network'))).toBe(true);
			});

			it('provides suggestions for auth errors', () => {
				const error = new Error('CLI failed');
				const stderr = 'API key invalid';

				const classified = classifyCLIError(error, 'gemini-cli', 1, stderr);

				expect(classified.recoverySuggestions.some(s => s.includes('API key'))).toBe(true);
			});

			it('provides suggestions for rate limit errors', () => {
				const error = new Error('CLI failed');
				const stderr = '429 rate limit';

				const classified = classifyCLIError(error, 'claude-code', 1, stderr);

				expect(classified.recoverySuggestions.some(s => s.includes('Wait'))).toBe(true);
			});
		});

		describe('edge cases', () => {
			it('handles missing stderr gracefully', () => {
				const error = new Error('CLI failed');

				const classified = classifyCLIError(error, 'gemini-cli', 1);

				expect(classified.code).toBe(CLIErrorCode.CLI_EXIT_ERROR);
				expect(classified.detailMessage).toBeTruthy();
			});

			it('handles empty stderr', () => {
				const error = new Error('CLI failed');

				const classified = classifyCLIError(error, 'claude-code', 1, '');

				expect(classified.code).toBe(CLIErrorCode.CLI_EXIT_ERROR);
			});

			it('handles exit code 0 as unknown', () => {
				const error = new Error('Strange error');

				const classified = classifyCLIError(error, 'gemini-cli', 0);

				expect(classified.code).toBe(CLIErrorCode.CLI_UNKNOWN);
			});

			it('handles case-insensitive stderr matching', () => {
				const error = new Error('CLI failed');
				const stderr = 'API KEY IS INVALID';

				const classified = classifyCLIError(error, 'claude-code', 1, stderr);

				expect(classified.code).toBe(CLIErrorCode.CLI_AUTH_ERROR);
			});

			it('handles multiple error indicators in stderr', () => {
				const error = new Error('CLI failed');
				const stderr = '401 unauthorized - network error';

				const classified = classifyCLIError(error, 'gemini-cli', 1, stderr);

				expect(classified.code).toBe(CLIErrorCode.CLI_AUTH_ERROR);
			});
		});
	});
});
