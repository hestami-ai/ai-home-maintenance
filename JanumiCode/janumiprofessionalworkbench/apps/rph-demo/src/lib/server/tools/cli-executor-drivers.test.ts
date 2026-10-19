// ⭐ `JAN-MHX` MH-1 — the victim for THE DRIVER TABLE (`DESIGN-multi-harness-executor.md` D12, D30): empty until a driver's
// package fills it, and it answers only for a tool it holds. ⭐ MH-4 — devin's package filled its first entry.
import { describe, expect, it } from 'vitest';
import { cliExecutorDriver } from './cli-executor-drivers.js';

describe('⭐ D12 — the CLI executor driver table', () => {
	// ~~holds no driver yet: every tool, catalogued or not, answers undefined~~ ⭐ MH-4 — devin's is in it now.
	it('⭐ MH-4 — devin answers its driver', () => {
		// ⭑ RED FIRST: the table was empty, so a devin selection opened nothing (`model.ts`'s `CLI` branch refuses one).
		const driver = cliExecutorDriver('devin');
		expect(driver?.toolId).toBe('devin');
		expect(driver?.carriers).toEqual(['mcp_list_servers', 'mcp_list_tools', 'mcp_call_tool']);
	});

	it('holds no other driver yet: every other tool, catalogued or not, answers undefined', () => {
		for (const tool of ['agy', 'pi', 'codex', 'muse', 'claude']) expect(cliExecutorDriver(tool), tool).toBeUndefined();
	});

	it('⛔ a name the table inherits from Object.prototype is not a tool', () => {
		// ⛔ THE MUTANT: look the tool up without `Object.hasOwn`. `toString` would then be called as a driver.
		for (const name of ['toString', 'constructor', '__proto__', 'hasOwnProperty'])
			expect(cliExecutorDriver(name), name).toBeUndefined();
	});
});
