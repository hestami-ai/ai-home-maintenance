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

process.env.JANUMICODE_TEST_SEED = process.env.JANUMICODE_TEST_SEED ?? '1337';
process.env.TZ = process.env.TZ ?? 'UTC';
