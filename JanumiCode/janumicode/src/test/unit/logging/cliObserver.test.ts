import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	onDetect,
	onResolve,
	onInvokeStart,
	onSpawn,
	onStderr,
	onComplete,
	onSpawnError,
} from '../../../lib/logging/cliObserver';
import { initializeLogger, resetLogger, getLogger } from '../../../lib/logging/logger';
import { LogLevel } from '../../../lib/logging/levels';

describe('CLI Observer', () => {
	let mockOutputChannel: any;

	beforeEach(() => {
		mockOutputChannel = {
			appendLine: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		};
		initializeLogger(mockOutputChannel);
		// onInvokeStart and onSpawn log at DEBUG level. The default logger
		// level is INFO so DEBUG messages get dropped silently. Bump the
		// level so the observer's debug events reach the output channel.
		getLogger().setLevel(LogLevel.DEBUG);
	});

	afterEach(() => {
		resetLogger();
	});

	describe('onDetect', () => {
		it('logs successful detection with version', () => {
			const result = {
				success: true,
				value: {
					available: true,
					version: '1.2.3',
					apiKeyConfigured: true,
					requiresApiKey: true,
				},
			};

			onDetect('gemini-cli', result as any, 150);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('CLI detected')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('1.2.3')
			);
		});

		it('warns when CLI not available', () => {
			const result = {
				success: true,
				value: {
					available: false,
					requiresApiKey: true,
					apiKeyConfigured: false,
				},
			};

			onDetect('claude-code', result as any);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('not available')
			);
		});

		it('errors on detection failure', () => {
			const result = {
				success: false,
				error: new Error('Detection failed'),
			};

			onDetect('codex-cli', result as any);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('detection failed')
			);
		});

		it('includes elapsed time when provided', () => {
			const result = {
				success: true,
				value: {
					available: true,
					version: '1.0.0',
					apiKeyConfigured: true,
					requiresApiKey: false,
				},
			};

			onDetect('gemini-cli', result as any, 250);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('250')
			);
		});

		it('includes providerId in log context', () => {
			const result = {
				success: true,
				value: {
					available: true,
					version: '1.0.0',
					apiKeyConfigured: true,
					requiresApiKey: false,
				},
			};

			onDetect('test-provider', result as any);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('test-provider')
			);
		});

		it('does nothing when logger not initialized', () => {
			resetLogger();

			const result = {
				success: true,
				value: { available: true },
			};

			onDetect('gemini-cli', result as any);

			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
		});
	});

	describe('onResolve', () => {
		it('logs configured-cli outcome', () => {
			onResolve('executor', 'claude-code', 'configured-cli');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('resolved via CLI')
			);
		});

		it('logs api-fallback outcome', () => {
			onResolve('verifier', 'gemini-cli', 'api-fallback', 'CLI not available');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('API fallback')
			);
		});

		it('warns on not-available outcome', () => {
			onResolve('executor', 'claude-code', 'not-available', 'Not installed');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('not available')
			);
		});

		it('warns on not-found outcome', () => {
			onResolve('technicalExpert', 'unknown-cli', 'not-found');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('not registered')
			);
		});

		it('errors on error outcome', () => {
			onResolve('verifier', 'gemini-cli', 'error', 'Resolution error');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('ERROR')
			);
		});

		it('includes role in log context', () => {
			onResolve('executor', 'claude-code', 'configured-cli');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('executor')
			);
		});

		it('includes detail when provided', () => {
			onResolve('verifier', 'gemini-cli', 'not-available', 'Missing API key');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Missing API key')
			);
		});
	});

	describe('onInvokeStart', () => {
		it('logs invocation with command details', () => {
			const data = {
				command: 'claude',
				args: ['--output-format', 'json'],
				stdinSize: 1024,
				cwd: '/workspace',
				outputFormat: 'json',
			};

			onInvokeStart('claude-code', data);

			const call = mockOutputChannel.appendLine.mock.calls[0][0];
			expect(call).toContain('Invoking CLI');
			expect(call).toContain('claude');
		});

		it('joins args into string', () => {
			const data = {
				command: 'gemini',
				args: ['--model', 'gemini-2.0', '--json'],
			};

			onInvokeStart('gemini-cli', data);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('--model gemini-2.0 --json')
			);
		});

		it('includes stdin size', () => {
			const data = {
				command: 'claude',
				stdinSize: 4096,
			};

			onInvokeStart('claude-code', data);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('4096')
			);
		});

		it('includes additional context when provided', () => {
			const data = { command: 'test' };
			const context = { dialogueId: 'dialogue-123' };

			onInvokeStart('test-cli', data, context);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('dialogue-123')
			);
		});

		it('handles missing args gracefully', () => {
			const data = {
				command: 'claude',
			};

			onInvokeStart('claude-code', data);

			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});
	});

	describe('onSpawn', () => {
		it('logs process spawn with PID', () => {
			onSpawn('gemini-cli', 12345);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('spawned')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('12345')
			);
		});

		it('handles undefined PID', () => {
			onSpawn('claude-code', undefined);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('spawned')
			);
		});

		it('includes context when provided', () => {
			const context = { role: 'executor' };

			onSpawn('claude-code', 99999, context);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('executor')
			);
		});
	});

	describe('onStderr', () => {
		it('logs stderr output', () => {
			const stderr = 'Warning: deprecated flag used';

			onStderr('gemini-cli', stderr);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('stderr')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('deprecated flag')
			);
		});

		it('truncates long stderr output', () => {
			const stderr = 'x'.repeat(1000);

			onStderr('claude-code', stderr);

			const call = mockOutputChannel.appendLine.mock.calls[0][0];
			expect(call.length).toBeLessThan(1000);
			expect(call).toContain('…');
		});

		it('does not truncate short stderr', () => {
			const stderr = 'Short error message';

			onStderr('gemini-cli', stderr);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Short error message')
			);
		});

		it('includes context when provided', () => {
			const context = { phase: 'PROPOSE' };

			onStderr('claude-code', 'Error', context);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('PROPOSE')
			);
		});
	});

	describe('onComplete', () => {
		it('logs successful completion', () => {
			const data = {
				exitCode: 0,
				elapsedMs: 3500,
				responseSize: 2048,
			};

			onComplete('claude-code', data);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('completed successfully')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('3500')
			);
		});

		it('logs error completion with exit code', () => {
			const data = {
				exitCode: 1,
				elapsedMs: 1200,
				stderr: 'Authentication failed',
			};

			onComplete('gemini-cli', data);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('ERROR')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('exitCode=1')
			);
		});

		it('includes response size for success', () => {
			const data = {
				exitCode: 0,
				elapsedMs: 2000,
				responseSize: 4096,
			};

			onComplete('claude-code', data);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('4096')
			);
		});

		it('includes stderr snippet on error', () => {
			const data = {
				exitCode: 1,
				elapsedMs: 500,
				stderr: 'Error: API key invalid',
			};

			onComplete('gemini-cli', data);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('API key invalid')
			);
		});

		it('truncates long stderr in error logs', () => {
			const data = {
				exitCode: 1,
				elapsedMs: 1000,
				stderr: 'x'.repeat(500),
			};

			onComplete('claude-code', data);

			const call = mockOutputChannel.appendLine.mock.calls[0][0];
			expect(call.length).toBeLessThan(800);
		});

		it('includes context when provided', () => {
			const data = {
				exitCode: 0,
				elapsedMs: 1500,
			};
			const context = { dialogueId: 'dialogue-456' };

			onComplete('gemini-cli', data, context);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('dialogue-456')
			);
		});

		it('handles missing stderr gracefully', () => {
			const data = {
				exitCode: 1,
				elapsedMs: 1000,
			};

			onComplete('claude-code', data);

			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});
	});

	describe('onSpawnError', () => {
		it('logs spawn error with error code', () => {
			const error = new Error('spawn ENOENT') as NodeJS.ErrnoException;
			error.code = 'ENOENT';

			onSpawnError('gemini-cli', error, 'gemini');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('spawn failed')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('ENOENT')
			);
		});

		it('includes command when provided', () => {
			const error = new Error('spawn failed');

			onSpawnError('claude-code', error, 'claude --version');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('claude --version')
			);
		});

		it('includes error message', () => {
			const error = new Error('Permission denied');

			onSpawnError('codex-cli', error);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Permission denied')
			);
		});

		it('includes context when provided', () => {
			const error = new Error('Spawn error');
			const context = { role: 'verifier' };

			onSpawnError('gemini-cli', error, 'gemini', context);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('verifier')
			);
		});

		it('handles errors without errno code', () => {
			const error = new Error('Generic error');

			onSpawnError('claude-code', error);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Generic error')
			);
		});
	});

	describe('edge cases', () => {
		it('all functions handle uninitialized logger gracefully', () => {
			resetLogger();

			onDetect('test', { success: true, value: { available: true } } as any);
			onResolve('executor', 'test', 'configured-cli');
			onInvokeStart('test', { command: 'test' });
			onSpawn('test', 123);
			onStderr('test', 'error');
			onComplete('test', { exitCode: 0, elapsedMs: 100 });
			onSpawnError('test', new Error('test'));

			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
		});

		it('handles empty context objects', () => {
			onInvokeStart('test-cli', { command: 'test' }, {});

			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});

		it('handles multiple context fields', () => {
			const context = {
				dialogueId: 'dialogue-123',
				role: 'executor',
				phase: 'PROPOSE',
			};

			onSpawn('claude-code', 12345, context);

			const call = mockOutputChannel.appendLine.mock.calls[0][0];
			expect(call).toContain('dialogue-123');
			expect(call).toContain('executor');
			expect(call).toContain('PROPOSE');
		});

		it('handles zero elapsed time', () => {
			onDetect('test-cli', {
				success: true,
				value: { available: true, version: '1.0.0', apiKeyConfigured: true, requiresApiKey: false },
			} as any, 0);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('0')
			);
		});

		it('handles zero exit code explicitly', () => {
			const data = {
				exitCode: 0,
				elapsedMs: 1000,
			};

			onComplete('test-cli', data);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('successfully')
			);
		});

		it('handles exactly 500 character stderr', () => {
			const stderr = 'x'.repeat(500);

			onStderr('test-cli', stderr);

			const call = mockOutputChannel.appendLine.mock.calls[0][0];
			expect(call).not.toContain('…');
		});

		it('handles 501 character stderr', () => {
			const stderr = 'x'.repeat(501);

			onStderr('test-cli', stderr);

			const call = mockOutputChannel.appendLine.mock.calls[0][0];
			expect(call).toContain('…');
		});
	});
});
