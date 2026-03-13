/**
 * Vitest global setup file.
 * The vscode module alias is configured in vitest.config.ts,
 * so all imports of 'vscode' resolve to our mock automatically.
 *
 * Individual tests manage their own DB/logger/event bus lifecycle
 * via beforeEach/afterEach hooks.
 */

// No global setup needed — the vscode alias handles everything.
// This file exists to satisfy the vitest setupFiles config entry.
