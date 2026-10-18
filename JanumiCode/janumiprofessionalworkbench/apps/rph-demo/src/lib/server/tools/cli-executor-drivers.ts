// ⭐⭐ `JAN-MHX` MH-1 (`DESIGN-multi-harness-executor.md` D12, D30) — THE TABLE A CLI EXECUTOR'S DRIVER IS FOUND IN.
//
// ⭑ ONE ENTRY PER DRIVER, ADDED BY THE PACKAGE THAT LANDS IT: agy's (MH-5), devin's (MH-4), Codex's (MH-6). Each driver is
// a top-level `tools/<tool>-executor-driver.ts`, exported as a function, so `verif/tool-adapter-exports-reachable.test.ts`
// holds it to a production caller — this table. ⚠ EMPTY TODAY: no CLI executor is wired, and nothing selects the `CLI`
// kind until a driver's package adds its tool to `WIRED_EXECUTORS` (`execution/executor-selection.ts`).
import type { CliDriver } from './cli-executor-session.js';

const CLI_EXECUTOR_DRIVERS: Readonly<Record<string, () => CliDriver>> = {};

/** The driver for `toolId`, or `undefined` when none is wired. ⛔ Own keys only: a prototype name is not a tool. */
export function cliExecutorDriver(toolId: string): CliDriver | undefined {
	return Object.hasOwn(CLI_EXECUTOR_DRIVERS, toolId) ? CLI_EXECUTOR_DRIVERS[toolId]!() : undefined;
}
