/**
 * Fake Logger Helper
 * Initializes the logger singleton with a no-op OutputChannel mock.
 * Call in beforeEach for any test that imports modules using getLogger().
 */

import { initializeLogger, resetLogger } from '../../lib/logging';

/**
 * Initialize the logger with a no-op output channel.
 * Safe to call multiple times — resets the logger first.
 */
export function initTestLogger(): void {
	resetLogger();

	// Create a mock OutputChannel that satisfies the vscode.OutputChannel interface
	const mockOutputChannel = {
		name: 'JanumiCode Test',
		append: () => {},
		appendLine: () => {},
		clear: () => {},
		show: () => {},
		hide: () => {},
		dispose: () => {},
		replace: () => {},
	};

	initializeLogger(mockOutputChannel as never);
}

/**
 * Tear down the logger. Call in afterEach to avoid cross-test contamination.
 */
export function teardownTestLogger(): void {
	resetLogger();
}
