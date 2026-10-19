// ⭐ `JAN-MHX` MH-1 — the victim for THE DRIVER TABLE (`DESIGN-multi-harness-executor.md` D12, D30): ~~empty until a driver's
// package fills it~~ ⭐ MH-5: it holds agy's driver, and it answers only for a tool it holds.
import { describe, expect, it } from 'vitest';
import { cliExecutorDriver } from './cli-executor-drivers.js';

describe('⭐ D12 — the CLI executor driver table', () => {
	it('⭐ MH-5 — holds agy’s driver, and no other: every other tool, catalogued or not, answers undefined', () => {
		// ⭑ RED FIRST: the table was empty, so agy answered undefined.
		expect(cliExecutorDriver('agy')?.toolId).toBe('agy');
		for (const tool of ['devin', 'pi', 'codex', 'muse', 'claude', 'Agy', ' agy'])
			expect(cliExecutorDriver(tool), tool).toBeUndefined();
	});

	it('⭐ MH-5 — a fresh driver for each session: a driver keeps its session’s own state (the model of each turn)', () => {
		// ⛔ THE MUTANT: one driver shared by every session, so one session's turns would be read beside another's models.
		expect(cliExecutorDriver('agy')).not.toBe(cliExecutorDriver('agy'));
	});

	it('⛔ a name the table inherits from Object.prototype is not a tool', () => {
		// ⛔ THE MUTANT: look the tool up without `Object.hasOwn`. `toString` would then be called as a driver.
		for (const name of ['toString', 'constructor', '__proto__', 'hasOwnProperty'])
			expect(cliExecutorDriver(name), name).toBeUndefined();
	});
});
