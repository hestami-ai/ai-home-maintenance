// ⭐ `JAN-MHX` MH-1 — the victim for THE DRIVER TABLE (`DESIGN-multi-harness-executor.md` D12, D30): each driver's package
// fills it, and it answers only for a tool it holds.
import { describe, expect, it } from 'vitest';
import { cliExecutorDriver } from './cli-executor-drivers.js';

describe('⭐ D12 — the CLI executor driver table', () => {
	it('⭐ `JAN-MHX` MH-6 — holds Codex’s driver, under its own tool id', () => {
		// ⛔ THE MUTANT: leave Codex out of the table. The selector would answer the `CLI` kind for it, and the opener would
		// find no driver, so every Codex turn would be refused when it opened.
		expect(cliExecutorDriver('codex')?.toolId).toBe('codex');
	});

	it('holds no other driver yet: every other tool, catalogued or not, answers undefined', () => {
		for (const tool of ['agy', 'devin', 'pi', 'muse', 'claude']) expect(cliExecutorDriver(tool), tool).toBeUndefined();
	});

	it('⛔ a name the table inherits from Object.prototype is not a tool', () => {
		// ⛔ THE MUTANT: look the tool up without `Object.hasOwn`. `toString` would then be called as a driver.
		for (const name of ['toString', 'constructor', '__proto__', 'hasOwnProperty'])
			expect(cliExecutorDriver(name), name).toBeUndefined();
	});
});
