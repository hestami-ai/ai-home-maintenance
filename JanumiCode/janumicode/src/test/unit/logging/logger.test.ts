import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, initializeLogger, getLogger, isLoggerInitialized, resetLogger } from '../../../lib/logging/logger';
import { LogLevel } from '../../../lib/logging/levels';

vi.mock('vscode');

describe('Logger', () => {
	let mockOutputChannel: any;

	beforeEach(() => {
		mockOutputChannel = {
			appendLine: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		};
		resetLogger();
	});

	afterEach(() => {
		resetLogger();
	});

	describe('createRoot', () => {
		it('creates root logger with output channel', () => {
			const logger = Logger.createRoot(mockOutputChannel);

			expect(logger).toBeInstanceOf(Logger);
		});

		it('uses configured log level from settings', async () => {
			const vscode = await import('vscode');
			const mockConfig = {
				get: vi.fn((key: string) => {
					if (key === 'logLevel') {return 'warn';}
					return undefined;
				}),
			};

			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

			const logger = Logger.createRoot(mockOutputChannel);

			expect(logger.getLevel()).toBe(LogLevel.WARN);
		});
	});

	describe('child loggers', () => {
		it('creates child logger with extended context', () => {
			const root = Logger.createRoot(mockOutputChannel);
			const child = root.child({ component: 'test-component' });

			child.info('Test message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[test-component]')
			);
		});

		it('child inherits parent context', () => {
			const root = Logger.createRoot(mockOutputChannel);
			const parent = root.child({ component: 'parent', dialogueId: 'dialogue-123' });
			const child = parent.child({ component: 'child' });

			child.info('Test message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('dialogueId=dialogue-123')
			);
		});

		it('child overrides parent context fields', () => {
			const root = Logger.createRoot(mockOutputChannel);
			const parent = root.child({ component: 'parent' });
			const child = parent.child({ component: 'child' });

			child.info('Test message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[child]')
			);
			expect(mockOutputChannel.appendLine).not.toHaveBeenCalledWith(
				expect.stringContaining('[parent]')
			);
		});

		it('merges multiple context fields', () => {
			const root = Logger.createRoot(mockOutputChannel);
			const child = root.child({
				component: 'cli',
				role: 'executor',
				providerId: 'claude-code',
			});

			child.info('Test message');

			const call = mockOutputChannel.appendLine.mock.calls[0][0];
			expect(call).toContain('role=executor');
			expect(call).toContain('providerId=claude-code');
		});
	});

	describe('log levels', () => {
		it('filters logs below minimum level', () => {
			const root = Logger.createRoot(mockOutputChannel);
			root.setLevel(LogLevel.WARN);

			root.debug('Debug message');
			root.info('Info message');
			root.warn('Warn message');
			root.error('Error message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(2);
		});

		it('logs debug when level is DEBUG', () => {
			const root = Logger.createRoot(mockOutputChannel);
			root.setLevel(LogLevel.DEBUG);

			root.debug('Debug message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('DEBUG')
			);
		});

		it('logs info when level is INFO or lower', () => {
			const root = Logger.createRoot(mockOutputChannel);
			root.setLevel(LogLevel.INFO);

			root.info('Info message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('INFO')
			);
		});

		it('logs warn when level is WARN or lower', () => {
			const root = Logger.createRoot(mockOutputChannel);
			root.setLevel(LogLevel.WARN);

			root.warn('Warn message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('WARN')
			);
		});

		it('logs error at all levels except NONE', () => {
			const root = Logger.createRoot(mockOutputChannel);
			root.setLevel(LogLevel.ERROR);

			root.error('Error message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('ERROR')
			);
		});

		it('logs nothing when level is NONE', () => {
			const root = Logger.createRoot(mockOutputChannel);
			root.setLevel(LogLevel.NONE);

			root.debug('Debug');
			root.info('Info');
			root.warn('Warn');
			root.error('Error');

			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
		});

		it('updates level at runtime', () => {
			const root = Logger.createRoot(mockOutputChannel);
			root.setLevel(LogLevel.WARN);

			root.info('Should not log');
			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();

			root.setLevel(LogLevel.INFO);
			root.info('Should log');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(1);
		});
	});

	describe('log methods', () => {
		it('debug logs with DEBUG level', () => {
			const root = Logger.createRoot(mockOutputChannel);
			root.setLevel(LogLevel.DEBUG);

			root.debug('Debug message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[DEBUG]')
			);
		});

		it('info logs with INFO level', () => {
			const root = Logger.createRoot(mockOutputChannel);
			root.setLevel(LogLevel.INFO);

			root.info('Info message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[INFO]')
			);
		});

		it('warn logs with WARN level', () => {
			const root = Logger.createRoot(mockOutputChannel);
			root.setLevel(LogLevel.WARN);

			root.warn('Warn message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[WARN]')
			);
		});

		it('error logs with ERROR level', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.error('Error message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[ERROR]')
			);
		});

		it('includes message in log output', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Test message')
			);
		});

		it('includes data object in log output', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test message', { userId: 'user-123', count: 42 });

			const call = mockOutputChannel.appendLine.mock.calls[0][0];
			expect(call).toContain('userId=user-123');
			expect(call).toContain('count=42');
		});

		it('handles undefined data gracefully', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test message', undefined);

			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});

		it('handles empty data object', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test message', {});

			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});
	});

	describe('ring buffer', () => {
		it('stores log entries in ring buffer', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Message 1');
			root.info('Message 2');
			root.info('Message 3');

			const entries = root.getRecentEntries();

			expect(entries.length).toBe(3);
			expect(entries[0].message).toBe('Message 1');
			expect(entries[2].message).toBe('Message 3');
		});

		it('returns requested number of entries', () => {
			const root = Logger.createRoot(mockOutputChannel);

			for (let i = 0; i < 100; i++) {
				root.info(`Message ${i}`);
			}

			const entries = root.getRecentEntries(10);

			expect(entries.length).toBe(10);
		});

		it('returns all entries when count exceeds buffer size', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Message 1');
			root.info('Message 2');

			const entries = root.getRecentEntries(100);

			expect(entries.length).toBe(2);
		});

		it('maintains bounded buffer size', () => {
			const root = Logger.createRoot(mockOutputChannel);

			for (let i = 0; i < 3000; i++) {
				root.info(`Message ${i}`);
			}

			const allEntries = root.getRecentEntries(5000);

			expect(allEntries.length).toBeLessThanOrEqual(2000);
		});

		it('keeps most recent entries when buffer overflows', () => {
			const root = Logger.createRoot(mockOutputChannel);

			for (let i = 0; i < 2100; i++) {
				root.info(`Message ${i}`);
			}

			const entries = root.getRecentEntries(1);

			expect(entries[0].message).toBe('Message 2099');
		});

		it('includes all entry fields', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test message', { key: 'value' });

			const entries = root.getRecentEntries(1);
			const entry = entries[0];

			expect(entry.timestamp).toBeTruthy();
			expect(entry.level).toBe(LogLevel.INFO);
			expect(entry.levelLabel).toBe('INFO');
			expect(entry.component).toBeTruthy();
			expect(entry.message).toBe('Test message');
			expect(entry.data).toEqual({ key: 'value' });
			expect(entry.context).toBeTruthy();
		});
	});

	describe('output channel', () => {
		it('returns output channel', () => {
			const root = Logger.createRoot(mockOutputChannel);

			const channel = root.getOutputChannel();

			expect(channel).toBe(mockOutputChannel);
		});

		it('formats timestamp in ISO format', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test');

			const call = mockOutputChannel.appendLine.mock.calls[0][0];
			expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
		});

		it('pads level label', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test');

			const call = mockOutputChannel.appendLine.mock.calls[0][0];
			expect(call).toMatch(/\[INFO \]/);
		});

		it('includes component in brackets', () => {
			const root = Logger.createRoot(mockOutputChannel);
			const child = root.child({ component: 'test' });

			child.info('Test');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[test]')
			);
		});
	});

	describe('singleton pattern', () => {
		it('initializeLogger creates and returns root logger', () => {
			const logger = initializeLogger(mockOutputChannel);

			expect(logger).toBeInstanceOf(Logger);
		});

		it('getLogger returns initialized logger', () => {
			initializeLogger(mockOutputChannel);

			const logger = getLogger();

			expect(logger).toBeInstanceOf(Logger);
		});

		it('getLogger throws when not initialized', () => {
			expect(() => getLogger()).toThrow('Logger not initialized');
		});

		it('isLoggerInitialized returns false before initialization', () => {
			expect(isLoggerInitialized()).toBe(false);
		});

		it('isLoggerInitialized returns true after initialization', () => {
			initializeLogger(mockOutputChannel);

			expect(isLoggerInitialized()).toBe(true);
		});

		it('resetLogger clears singleton', () => {
			initializeLogger(mockOutputChannel);

			resetLogger();

			expect(isLoggerInitialized()).toBe(false);
		});

		it('returns same instance on multiple getLogger calls', () => {
			initializeLogger(mockOutputChannel);

			const logger1 = getLogger();
			const logger2 = getLogger();

			expect(logger1).toBe(logger2);
		});
	});

	describe('edge cases', () => {
		it('handles null data fields', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test', { value: null });

			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});

		it('handles undefined data fields', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test', { value: undefined });

			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});

		it('handles object data values', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test', { obj: { nested: 'value' } });

			const call = mockOutputChannel.appendLine.mock.calls[0][0];
			expect(call).toContain('obj=');
		});

		it('handles array data values', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test', { arr: [1, 2, 3] });

			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});

		it('handles empty string data values', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Test', { empty: '' });

			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});

		it('handles deeply nested child loggers', () => {
			const root = Logger.createRoot(mockOutputChannel);
			const child1 = root.child({ component: 'level1' });
			const child2 = child1.child({ component: 'level2' });
			const child3 = child2.child({ component: 'level3' });

			child3.info('Deep message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[level3]')
			);
		});

		it('shares level changes across children', () => {
			const root = Logger.createRoot(mockOutputChannel);
			const child = root.child({ component: 'child' });

			root.setLevel(LogLevel.WARN);

			child.info('Should not log');

			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
		});

		it('handles special characters in messages', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Message with "quotes" and {braces}');

			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});

		it('handles multiline messages', () => {
			const root = Logger.createRoot(mockOutputChannel);

			root.info('Line 1\nLine 2\nLine 3');

			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});
	});
});
