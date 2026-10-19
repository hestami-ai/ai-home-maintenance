// ⭐ `JAN-MHX` MH-1 — the victim for THE DRIVER TABLE (`DESIGN-multi-harness-executor.md` D12, D30): filled one driver at a
// time by the package that lands it, and it answers only for a tool it holds.
import { describe, expect, it } from 'vitest';
import { cliExecutorDriver } from './cli-executor-drivers.js';

describe('⭐ D12 — the CLI executor driver table', () => {
	it('⭐ `JAN-MHX` MH-10 — holds Muse’s driver, and no other: every other tool, catalogued or not, answers undefined', () => {
		// ⛔ THE MUTANT: the table without Muse, so a Muse selection opens nothing.
		expect(cliExecutorDriver('muse')?.toolId).toBe('muse');
		for (const tool of ['agy', 'devin', 'pi', 'codex', 'claude']) expect(cliExecutorDriver(tool), tool).toBeUndefined();
	});

	it('⛔ a name the table inherits from Object.prototype is not a tool', () => {
		// ⛔ THE MUTANT: look the tool up without `Object.hasOwn`. `toString` would then be called as a driver.
		for (const name of ['toString', 'constructor', '__proto__', 'hasOwnProperty'])
			expect(cliExecutorDriver(name), name).toBeUndefined();
	});
});
